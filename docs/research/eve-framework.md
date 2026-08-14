# Eve's Current state: what you have

Your agent is a **thin but well-wired foundation**. Here's what's actually there:

**The model loop:** `agent.ts` wires GLM-5.2 through the Agency Gateway (LiteLLM proxy), forces Chat Completions API via `.chat()`, sets a 128K context window with `high` reasoning, and generous session limits (7-day timeout, 40M input / 1M output tokens per session). This is solid — the model routing is correct and the compaction trigger is properly configured.

**The identity:** `instructions.md` is a minimal system prompt — "Eve, an internal AI agent for the studio" with a handful of standing rules (be concise, use tools, don't fabricate, read before writing). It's about 15 lines. It sets tone but doesn't give the model any real operational knowledge.

**The channel:** `eve.ts` is the default eve HTTP channel with an auth walk of `vercelOidc() → localDev()`. This means: Vercel-internal calls pass, local dev passes, everything else gets 401. It's an API surface — `POST /eve/v1/session` to create, `POST /eve/v1/session/:id` to message, `GET /eve/v1/session/:id/stream` to stream. No browser UI, no chat platform, no CORS.

**The tools (5):**

- `whoami` — returns the signed-in principal (identity check)
- `check_proxy_health` — probes gateway `/models`, `/health/liveliness`, `/health/readiness` and reports model counts per modality
- `generate_image` — FLUX image generation via gateway (CF Workers AI)
- `text_to_speech` — Aura TTS via gateway
- `transcribe_audio` — Whisper STT via gateway

All five are gateway-facing tools — they call your LiteLLM proxy's non-chat endpoints. Three of them (image/TTS/STT) are essentially proof-of-concept that the gateway can do multimedia. They're useful but narrow.

**The observability:** `instrumentation.ts` wires PostHog OTel spans (every model call, tool call, channel delivery) with `distinct_id` tagging from the auth principal, plus Sentry for errors. This is actually quite good — you have end-to-end tracing from session → turn → step → tool call, flowing into the same PostHog project as agency.

**What's NOT there:**

- No **sandbox** enabled (the built-in `bash`, `read_file`, `write_file`, `glob`, `grep` tools aren't wired — eve has them but they're not turned on)
- No **skills** (zero in `agent/skills/`)
- No **connections** (no MCP or OpenAPI servers wired)
- No **subagents** (no specialist delegation)
- No **schedules** (no cron jobs)
- No **hooks** (no audit logging or side effects)
- No **evals** (no regression tests)
- No **frontend** (no React/Vue chat UI)

So yes — right now it's essentially: one model call, one HTTP endpoint, five gateway tools, and observability. A clean but minimal API agent.

## The framework primitives: what you can attach

eve is designed as a filesystem-first agent framework where everything is a file under `agent`. The framework gives you 13 extension points, each discovered by directory convention:

### Execution layer

| Primitive | How it works | What it gives you |
| --- | --- | --- |
| **Tools** (`agent/tools/*.ts`) | `defineTool` with Zod schema, async `execute`, runs in app runtime with full `process.env` | The model can call typed actions — API calls, database queries, file operations, anything scriptable. You have 5; can add unlimited. Built-in tools (`bash`, `read_file`, `write_file`, `glob`, `grep`, `web_search`, `todo`, `ask_question`) can be enabled/disabled. |
| **Sandbox** (`agent/sandbox/`) | Isolated bash at `/workspace`, backed by Docker/microsandbox/just-bash | The agent can execute code, run builds, read/write files, do data analysis — all in isolation. This is the biggest missing capability right now. |
| **Connections** (`agent/connections/*.ts`) | `defineMcpClientConnection` or `defineOpenAPIConnection` — wires MCP/OpenAPI servers as tools the model calls | Zero-plumbing integration with Linear, GitHub, Sentry, PostHog, databases — the model gets `<connection>__<tool>` names. Auth is brokered per-caller, never shown to model. |
| **Subagents** (`agent/subagents/<id>/`) | Full mini-agent directories with own model, tools, instructions, sandbox | Specialist delegation: a researcher with web tools, a code reviewer with bash, a data analyst with database connections — each with isolated context and result-only return. |

### Lifecycle layer

| Primitive | How it works | What it gives you |
| --- | --- | --- |
| **Schedules** (`agent/schedules/*.ts`) | `defineSchedule` on cron cadence | Autonomous recurring work: daily gateway health checks, weekly cost summaries, periodic syncs. Can send to any channel. |
| **Hooks** (`agent/hooks/*.ts`) | `defineHook` subscribing to stream events | Observe-only side effects: audit every tool call to Postgres, alert on gateway failures, auto-cleanup after idle, persist transcripts. |
| **Skills** (`agent/skills/*.md`) | SKILL.md convention — description always visible, body loads on demand | On-demand procedures (deployment runbooks, troubleshooting guides, code review checklists) that keep the system prompt lean. progressive disclosure. |

### Surface layer

| Primitive | How it works | What it gives you |
| --- | --- | --- |
| **Channels** (`agent/channels/*.ts`) | Platform adapters — normalize input to messages, own delivery | Make the agent reachable from Slack, Discord, Telegram, GitHub PRs, Twilio SMS, Teams, Linear. Also `useEveAgent` React hook or `withEve` Next.js for a browser UI. |
| **Instructions** (`instructions.md`) | System or user role, static or dynamic | Can be dynamic per-tenant, per-channel. Can compose from a directory. The identity + standing rules. |
| **Dynamic capabilities** | `defineDynamic` — resolve model/tools/skills/instructions at runtime | Per-tenant tool sets, feature flags, dynamic model routing (images → vision model, text → GLM-5.2). |

### Quality + packaging layer

| Primitive | How it works | What it gives you |
| --- | --- | --- |
| **Evals** (`evals/*.eval.ts`) | `defineEval` drives real HTTP sessions, grades with assertions or LLM-as-judge | Regression tests: "when asked about gateway health, it calls `check_proxy_health`". `mockModel` for deterministic runs. |
| **Extensions** (`agent/extensions/*.ts`) | `defineExtension` — package tools/skills/hooks into npm packages | Reusable capability packs across multiple agent projects. |
| **Instrumentation** (`instrumentation.ts`) | Already wired — PostHog + Sentry | Done. Can add `recordInputs`/`recordOutputs` later. |

## The practical paths forward

Here are the meaningful directions, roughly ordered from "lowest effort, highest immediate value" to "bigger builds":

### 1. Turn on the sandbox (trivial — it's built in)

The framework ships `bash`, `read_file`, `write_file`, `glob`, `grep` tools. They proxy into an isolated `/workspace`. You just need to configure the backend (just-bash is already in your devDeps). Suddenly the agent can run scripts, inspect files, execute builds, and do real work — not just call APIs.

### 2. Add skills (drop files in a directory)

Your `.agents/skills/` already has `upstream`, `untard`, `eve`, `gh-pr-description`, `technical-writing`. Agent-level skills under `agent/skills/` would make those loadable by the model during sessions — deployment runbooks, gateway troubleshooting guides, model comparison checklists. The model sees the description, loads the body only when relevant.

### 3. Wire connections (huge multiplier)

An MCP or OpenAPI connection to your gateway admin, PostHog, Sentry, or Linear would immediately give the model callable tools with zero API plumbing. The connection brokers auth per-caller. This is how you go from "5 hardcoded tools" to "the model has access to every API in your stack."

### 4. Add a Slack/Discord channel

Drop in `slackChannel` or `discordChannel`, configure the bot token, and the agent becomes reachable from chat. Thread-aware, approval buttons, delivery handling. This turns it from an API into a living team member.

### 5. Enable subagents for specialist work

A researcher subagent with `web_search` + `glob`/`grep` in its sandbox. A gateway ops subagent with `check_proxy_health` + connection to LiteLLM admin. Each has isolated context so the root agent stays lean.

### 6. Dynamic model routing

`defineDynamic` on `step.started` to route image inputs to a vision model (Gemini Flash) while keeping GLM-5.2 for text. The model doesn't choose — the framework routes based on input type.

### 7. Schedules for autonomous ops

A daily schedule that runs `check_proxy_health` and posts the result to a Slack channel. A weekly schedule that pulls PostHog cost data and summarizes. Autonomous monitoring without human prompts.

### 8. Evals for regression protection

`evals/*.eval.ts` that drive the agent through real sessions: "when asked about gateway health, it calls `check_proxy_health` and reports the model count." With `mockModel` for deterministic CI runs.

### 9. Browser frontend

`useEveAgent` React hook + `withEve` Next.js = a chat UI with streaming, reasoning display, approval buttons, file attachments. Turns the API into a product.

---

The framework is genuinely well-designed — everything composes. You can start with any one of these and add more later. The filesystem-first convention means there's no registration boilerplate; you drop a file in the right directory and it's discovered.

What direction interests you? Or want me to go deeper on any specific primitive?

---

## 1. Model loop — `agent.ts` shape

You're right that the current shape is a scaffold. Here's the actual situation:

**The core issue:** You're using `gateway.chat("glm-5-2")` which creates a **direct `LanguageModel` instance** — a provider object pointing at your LiteLLM proxy. When `model` is a `LanguageModel`, eve can't look up context windows from its AI Gateway catalog, so `modelContextWindowTokens: 128_000` becomes a **required** escape hatch. The model is hardcoded, the context window is hardcoded, and the limits are hardcoded.

**What the framework actually offers:**

**Option A — Dynamic model selection via `defineDynamic`:**

```ts
import { defineAgent } from "eve";
import { defineDynamic } from "eve";

export default defineAgent({
  model: defineDynamic({
    events: {
      "session.started": (event, ctx) => {
        // Resolve model per-session based on auth, channel, or any context
        return { model: gateway.chat("glm-5-2"), modelContextWindowTokens: 128_000 };
      },
    },
  }),
});
```

Events: `session.started` (once), `turn.started` (per turn), `step.started` (every model call). Precedence: step > turn > session. You can return different models per turn, per caller, per input type. The selection object carries `{ model, modelContextWindowTokens?, modelOptions? }`.

**Option B — Gateway model IDs (strings):**
If you used a string like `"anthropic/claude-sonnet-5"`, eve resolves the context window automatically from the Vercel AI Gateway catalog. But your LiteLLM proxy isn't in the Vercel AI Gateway catalog — those are your custom aliases. So string IDs won't work for your gateway models unless they happen to match a catalog entry.

**The real answer:** Your model catalog is programmatically available from LiteLLM's `/v1/models` endpoint, but eve **doesn't consume that endpoint**. There's no mechanism to register custom models in eve's catalog. So for LiteLLM proxy models, you either:

1. Keep using `LanguageModel` + explicit `modelContextWindowTokens` (current approach, just make it dynamic)
2. Use `defineDynamic` to select models at runtime, returning each with its known context window

The ideal shape would be: a `defineDynamic` that resolves the model from session/turn context, with model metadata stored in a config file (or fetched from the gateway's `/v1/models` at startup and cached). No hardcoded single model. The `limits` and `reasoning` fields can stay on `defineAgent` since they're agent-level, not model-level.

## 2. Auth walk — what is it, practically

The **auth walk** is an ordered list of authenticators. For each inbound HTTP request, eve tries each one in order. The first one that returns a `SessionAuthContext` wins (accept). If one returns `null`, skip to the next. If every one skips, the request gets `401` with `WWW-Authenticate` headers listing the challenge schemes from each authenticator.

**Your current walk: `[vercelOidc(), localDev()]`**

### `localDev()` — what it actually does

```ts
// Returns a valid SessionAuthContext ONLY when running as a dev server
function localDev(): AuthFn {
  return () => isLocalDevelopmentServer()
    ? { principalId: "local-dev", principalType: "local-dev", authenticator: "local-dev", attributes: {} }
    : null;
}
```

- Checks if `EVE_DEV=1` (set by `eve dev`) or `VERCEL=1 && VERCEL_ENV=development` (set by `vercel dev`)
- This is a **deployment property** — no request header can fake it
- In production (`eve start`, Vercel deployment, any container), it returns `null` — no authentication happens
- Safe to keep permanently; it authenticates nothing in production

### `vercelOidc()` — what it actually does

Extracts a Bearer token from the `Authorization` header, verifies it's a Vercel OIDC JWT (issuer `https://oidc.vercel.com/`, audience `https://vercel.com/...`), and accepts it if:

1. **Same-project tokens** — always accepted (zero config). These are tokens minted for the same `VERCEL_PROJECT_ID`
2. **Cross-project tokens** — accepted only if the token's `sub` matches a `subjects: [...]` allowlist you configure
3. **User tokens** — development environment only, when both token and deployment are `"development"` environment

**"Vercel-internal calls"** means: subagent dispatch, schedule dispatch, internal fetches — these happen within the same Vercel deployment, use Vercel OIDC tokens for the current project, and authenticate automatically. It's machine-to-machine auth for Vercel's platform.

### "Everything else gets a 401" — practical scenarios

| Scenario | Local dev (`eve dev`) | Production (Vercel) | Production (self-hosted `eve start`) |
| --- | --- | --- | --- |
| `curl localhost:2000/eve/v1/session` (no auth) | ✅ Accepted by `localDev()` | 401 | 401 |
| Browser fetch to the API (no auth) | ✅ Accepted | 401 | 401 |
| Request with Vercel OIDC Bearer token | ✅ Accepted (either wins) | ✅ Accepted by `vercelOidc()` | 401 (no Vercel platform) |
| Request with API key / custom auth | ✅ Accepted by `localDev()` | 401 | 401 |
| Internal subagent/schedule dispatch | ✅ Accepted | ✅ Vercel OIDC token | N/A (internal) |

**The key insight for your project:** You're not deploying on Vercel. You're self-hosting. So `vercelOidc()` does nothing useful for you in production — there's no Vercel platform to mint OIDC tokens. And `localDev()` only works in dev.

For self-hosted production, you need a real authenticator. Your options:

- `httpBasic({ username, password })` — shared credentials for operator/service access
- `jwtHmac({ secret, issuer })` — shared-secret JWT signer (if you have a frontend that issues JWTs)
- `oidc({ ... })` — any OIDC provider (Google, GitHub, your own)
- Write a custom `AuthFn` — a function `(request) => SessionAuthContext | null` that does whatever you want (check an API key header, validate a session cookie, etc.)
- `none()` — explicitly accept anonymous traffic (if you just want it open)

## 3. `whoami` — what it pulls from

The `whoami` tool reads `ctx.session.auth.current`, which is the `SessionAuthContext` populated by the auth walk. So:

- **In local dev:** `whoami` returns `{ signedIn: true, principalId: "local-dev", principalType: "local-dev", authenticator: "local-dev" }` — it's literally just echoing back the synthetic local-dev principal
- **In production with the current config:** no request gets past the 401, so `whoami` never runs. If you added `httpBasic()`, it would return whatever `principalId`/`principalType` you configured for the basic auth
- **With a custom auth function:** it returns whatever you put in the `SessionAuthContext` — a user ID from a session cookie, a tenant ID, whatever

It's pulling from the channel's auth result. It's not looking up a database or an external identity provider. If your auth function stamps `principalId: "james@jami.studio"`, that's what `whoami` returns.

## 4. Multimodal tools — are tools the right place?

This is worth thinking through carefully. The current setup puts `generate_image`, `text_to_speech`, and `transcribe_audio` as tools the model calls. There are two paths:

**Path A: Tools (current) — the model decides when to generate/synthesize**

- Pro: The model can reason about *when* and *what* to generate. "Create a diagram of the architecture" → model calls `generate_image` with a crafted prompt
- Pro: The model can chain multimodal with text reasoning — analyze the transcription result, then respond
- Con: The model has to know these tools exist and when to use them (eating system prompt / context)
- Con: Tools return to the model, not directly to the user — the base64 image goes through the model context, which may not understand it

**Path B: Channel delivery / frontend rendering — the output is directly rendered**

- An image generation result could be streamed as a channel event to a frontend that renders it directly, rather than going through the model
- This is what the `useEveAgent` React hook + `withEve` Next.js integration would enable — rich content rendering on the client, not in the model's context

**Path C: Dynamic model routing — different models for different modalities**

- `defineDynamic` on `step.started` can route to a vision model when images are involved, a text model when not
- This isn't about tools — it's about which *model* handles the turn

The big-picture question: are these multimodal capabilities things the *model* should control, or things the *agent runtime* should control? For a gateway agent that's an API surface, tools make sense — the caller (another agent, a script, a frontend) sends a message and the model can use the gateway. For a user-facing agent, you might want the frontend to call these endpoints directly via connections, bypassing the model entirely.

## 5. Sandbox — do you need Docker?

**No.** Here's the full picture:

Every eve agent has exactly one sandbox by default, with no authoring required. The built-in `bash`, `read_file`, `write_file`, `glob`, `grep` tools always target the sandbox. The default backend selection is:

```
Vercel → Docker → microsandbox → just-bash
```

`just-bash` is a **pure-JS bash interpreter** over a virtual filesystem stored under `sandbox-cache`. No daemon, no VM, no Docker. It auto-installs when missing. But it has limitations — no real binaries (`git`, `node`, package managers don't work), no network isolation.

**The critical constraint:** the built-in file tools (`bash`, `read_file`, `write_file`, `glob`, `grep`) **always target the sandbox**. There's no way to have them work on the host filesystem directly. It's a fundamental isolation boundary in the framework.

If you want the model to have `bash` and file tools, you get a sandbox whether you want one or not — but `just-bash` has zero operational burden. It's just a JS process.

**However:** your authored tools (like `check_proxy_health`, `generate_image`, etc.) run in the **app runtime** with full `process.env` and host filesystem access. So you could write a custom `read_file` tool that reads from the host — you'd just be overriding the built-in one.

Docker only matters when:

- You need real binaries (`git`, `node`, `python`, etc.) in the sandbox
- You need network isolation for untrusted code
- You're deploying and want stronger isolation

For local dev where you just want the model to be able to read/write files and run simple shell commands, `just-bash` is fine. Docker is a deploy-time concern, not a dev-time requirement.

## 6. Skills — `.agents/skills/` vs `agent/skills/`

These serve **completely different consumers:**

| | `.agents/skills/` | `agent/skills/` |
| --- | --- | --- |
| **Who reads them** | VS Code Copilot (your coding assistant) | The eve agent runtime (the LLM running your agent) |
| **Path convention** | `<name>/SKILL.md` with YAML frontmatter | `<name>.md` or `<name>/SKILL.md` — same convention |
| **When loaded** | Injected into Copilot context on demand | Loaded by `load_skill` tool when the model asks |
| **Current state** | 5 skills symlinked from the fork | Zero — none exist yet |

They use the **same SKILL.md convention** — eve's docs explicitly say a skill authored against the Agent Skills standard ports over as-is. But they're consumed by different systems.

Your `.agents/skills/` is correct where it is — it's for VS Code Copilot. If you want the eve **agent** to have skills at runtime, you'd create `agent/skills/` and drop SKILL.md files there. You could symlink the same content to both if you want a skill available to both Copilot and the agent.

**You don't need to move `.agents/skills/`.** You need to *add* `agent/skills/` if you want the agent itself to load procedures at runtime. They're two different directories for two different purposes.

## 7. Connections, subagents, schedules, hooks, evals — the discussion

### Connections

Two types: **MCP** (for services that have an MCP server) and **OpenAPI** (for services that publish a Swagger/OpenAPI spec). eve discovers tools from the connection and surfaces them to the model as `<connection>__<tool>`.

The killer feature is **per-caller auth**: the `auth` and `headers` fields can be functions that receive `ctx.session.auth.current` — so the connection picks up tenant-specific credentials from the session, not a static key. The model never sees credentials.

For your project: the Agency Gateway already has 191+ model aliases. But connections aren't about models — they're about **non-model services**. A connection to PostHog's API would let the model query trace data. A connection to Sentry would let it look up errors. A connection to your LiteLLM admin API would let it manage models. A connection to Linear/GitHub would let it work with issues/PRs.

The registry has 42 example connections including `posthog.ts`, `sentry.ts`, `linear.ts`, `github.ts`, `notion.ts`, `supabase.ts` — these are ready-to-use patterns.

### Subagents

Two modes: the built-in `agent` tool (runs a fresh copy of the root agent, shares sandbox, root-only) vs declared subagents (`agent/subagents/<id>/` — specialists with own model, tools, instructions, sandbox, skills).

Declared subagents inherit **nothing** from root. Each is a self-contained mini-agent. The model sees their `description` and can delegate work to them. The subagent runs in its own session, returns only its result.

`defineRemoteAgent` lets a subagent be a **separately deployed eve agent** — it calls the remote agent's HTTP API with durable callback dispatch. Outbound auth via `vercelOidc()`, `bearer()`, or `basic()`.

For your project: a research subagent with `web_search` + `glob`/`grep`, a gateway-ops subagent with `check_proxy_health` + a connection to LiteLLM admin, a code-execution subagent with a Docker sandbox for script running. Each keeps the root context lean.

### Schedules

Files under `agent/schedules/`. Two forms: markdown (fire-and-forget prompt in task mode) or handler (`defineSchedule` with a `run` function that can send to channels). 5-field cron, minute granularity.

Key detail: **`eve dev` never fires schedules on cron cadence.** You trigger them manually via `POST /eve/v1/dev/schedules/<id>`. In production (`eve start` or Vercel), they fire on cron.

For your project: a daily `check_proxy_health` schedule, a weekly cost-summary from PostHog, periodic model availability checks. The handler form can use `to(channel).send(...)` to post results to Slack or any channel.

### Hooks

Files under `agent/hooks/<slug>.ts`. Subscribe to stream events — `session.started`, `turn.completed`, `message.completed`, `action.result`, `step.failed`, `*` (wildcard). Observe-only side effects: audit logging, metrics, alerting, persistence. They run **after** the event is durably recorded, so they can't corrupt the stream. A thrown hook becomes a `turn.failed`.

For your project: a hook that logs every tool call to Postgres, a hook that alerts on gateway failures, a hook that persists session transcripts to an external store. Hooks are the "observation plane" — they see everything that happens but don't intervene.

### Evals

Files under `evals/*.eval.ts`. Drive the agent through real HTTP sessions: `t.send("...")`, `t.succeeded()`, `t.calledTool("...")`, `t.check(t.reply, includes("..."))`. With `mockModel` for deterministic CI runs (no credit spend). `evals.config.ts` for shared config.

For your project: "when asked about gateway health, it calls `check_proxy_health` and reports model count" — that's an eval. "when asked to generate an image, it calls `generate_image` with a valid prompt" — another eval. These would be your testing-standards.md system-level critical functions.

### Frontend

`useEveAgent` React hook provides streaming chat, reasoning display, tool call rendering, HITL approval buttons, file attachments. `withEve` Next.js integration mounts the agent routes on the same origin. There are also Vue and Svelte hooks, plus Nuxt/SvelteKit integrations.

This is what turns an API into a product. The user sees a chat interface with streaming responses, can approve tool calls, upload files, and see rich content (images, code blocks, reasoning).

---

That's the full landscape. What direction do you want to go first?
