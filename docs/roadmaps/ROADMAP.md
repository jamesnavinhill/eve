# Eve — Studio Internal Agent Roadmap

> Status: **Phase 0 — Foundation scaffolded** (2026-08-13)
> Repo: `jamesnavinhill/eve` (this project) | Fork: `jamesnavinhill/eve-source-code` (sibling, fork of `vercel/eve`) | Source: `vercel/eve` v0.37.0

---

## What was set up today

### Project structure

```
eve/                          ← your agent project (this repo)
├── package.json              ← eve 0.37.0, ai 7, zod 4, @ai-sdk/openai
├── tsconfig.json
├── .env.example              ← model credentials template
├── .gitignore                ← ignores node_modules/, .env, build artifacts
├── agent/
│   ├── agent.ts              ← model config (eve-orchestrator fallback alias)
│   ├── instructions.md       ← Eve identity + standing rules
│   ├── channels/
│   │   └── eve.ts            ← HTTP channel with auth walk (vercelOidc + localDev)
│   ├── lib/
│   │   ├── gateway.ts        ← shared Agency Gateway provider
│   │   └── host-tools.ts     ← host-native bash/read/write/glob/grep helpers
│   └── tools/
│       ├── whoami.ts         ← returns the signed-in principal
│       ├── check_proxy_health.ts ← probes all three gateway lanes
│       ├── generate_image.ts ← FLUX image generation via Workers AI
│       ├── text_to_speech.ts ← Aura TTS via Workers AI
│       ├── transcribe_audio.ts ← Whisper STT via Workers AI
│       ├── bash.ts           ← host-native shell override
│       ├── read_file.ts      ← host-native file read override
│       ├── write_file.ts     ← host-native file write override
│       ├── glob.ts           ← host-native glob override
│       ├── grep.ts           ← host-native grep override
│       ├── web_search.ts     ← Tavily web search
│       ├── exa_search.ts     ← Exa neural search
│       ├── brave_search.ts   ← Brave web search
│       ├── firecrawl_search.ts ← Firecrawl web search
│       └── send_message.ts   ← fixed-owner SMS/MMS through email transports
├── docs/                     ← our own docs (architecture, config, ops, security)
│   ├── research/             ← research notes and explorations
│   └── roadmaps/             ← phased roadmap and planning
└── ../eve-source-code/       ← vercel/eve fork (sibling, reference + docs)
```

### What works now

- ✅ `pnpm install` — all dependencies resolved
- ✅ `pnpm build` / `pnpm dev` / `pnpm typecheck` / `pnpm lint` / `pnpm fmt` all green
- ✅ Model routed through `eve-orchestrator` gateway alias with deterministic CF fallback
- ✅ Host-native shell/file tools: `bash`, `read_file`, `write_file`, `glob`, `grep`
- ✅ Four web search tools behind provider adapters: Tavily, Exa, Brave, Firecrawl (all live-verified)
- ✅ Proactive owner messaging through a provider-neutral SMS/MMS tool (AgentMail → Verizon live-verified)
- ✅ Image generation (FLUX), TTS (Aura-2), STT (Whisper) verified
- ✅ Gateway health probe via `check_proxy_health`
- ✅ `whoami` for session principal introspection

### Gateway integration (✅ Done)

- Agency Gateway at `https://gateway.jami.studio/v1` — OpenAI-compatible (LiteLLM)
- Model: `eve-orchestrator` fallback group via Agency Gateway, 256K context window
- Tools covering chat, image, audio, web search, shell, and filesystem
- ~200 models available across chat, image, TTS, STT

---

## How eve works — the mental model

### Filesystem-first agents

Everything is a file. eve walks `agent/` and compiles:

| Slot             | Path                                | What it does                                              |
| ---------------- | ----------------------------------- | --------------------------------------------------------- |
| **Instructions** | `agent/instructions.md`             | Always-on system prompt (identity + rules)                |
| **Agent config** | `agent/agent.ts`                    | Model, reasoning, compaction, limits                      |
| **Tools**        | `agent/tools/*.ts`                  | Typed actions the model can call (your code, app runtime) |
| **Skills**       | `agent/skills/*.md` or `*/SKILL.md` | On-demand procedures (progressive disclosure)             |
| **Connections**  | `agent/connections/*.ts`            | MCP servers + OpenAPI APIs (model never sees credentials) |
| **Channels**     | `agent/channels/*.ts`               | HTTP, Slack, Discord, Telegram, GitHub, Linear, iMessage  |
| **Subagents**    | `agent/subagents/*/agent.ts`        | Specialist child agents with their own tools/sandbox      |
| **Schedules**    | `agent/schedules/*.ts`              | Cron-triggered agent runs                                 |
| **Sandbox**      | `agent/sandbox/`                    | Isolated bash environment (model's filesystem)            |
| **State**        | `defineState()` in code             | Durable per-session memory (survives crashes/redeploys)   |

### Sessions are durable

A session is a long-lived conversation that survives process restarts and redeploys.
Work nests in three levels:

- **Session** — the whole conversation (days/weeks)
- **Turn** — one user message + all work it triggers
- **Step** — a durable checkpoint (one model call + its tool calls)

If the process crashes mid-turn, it resumes from the last completed step. No replay needed.

### Trust boundaries (local-dev posture)

We intentionally run shell and file tools on the **host** instead of the sandbox so the agent shares the developer environment. This is the right trade-off for an internal, trusted agent; production isolation can be reintroduced later if needed.

|                         | App runtime (tools) | Host shell/file tools |
| ----------------------- | ------------------- | --------------------- |
| `process.env` / secrets | ✅ Full access      | ✅ Inherits from env  |
| Your Node.js code       | ✅ Runs directly    | ❌ Not involved       |
| Network                 | Unrestricted        | Unrestricted          |
| Filesystem              | App's own           | Host filesystem       |

Tools run in the **app runtime** with full access to `process.env`. The built-in `bash` / file tools are overridden to execute directly on the host machine.

### Two ways to delegate to subagents

1. **Built-in `agent` tool** — root-only. Runs a fresh copy of the root agent. Inherits everything except root-only tools. Shared sandbox.
2. **Declared subagents** (`agent/subagents/<id>/`) — specialists with their own instructions, tools, sandbox, and state. Nothing inherits implicitly.

---

## Feature map — eve capabilities and how we'll use them

### 1. Model & Proxy API

**Status:** ✅ Wired and verified. `eve-orchestrator` via Agency Gateway (LiteLLM, Chat Completions API).

**Current config:**

- `@ai-sdk/openai` with custom `baseURL` → `gateway.jami.studio/v1`
- `.chat("eve-orchestrator")` resolves to a LiteLLM fallback group
- `modelContextWindowTokens: 256_000` for compaction
- Fallback order: YRKA > JAMI; Kimi K2.7-code > Kimi K2.6 > Gemma 4

### 2. Tools (typed actions)

**Status:** 13 tools. Chat, image, audio, web search, shell, and filesystem covered.

**Current tools:**

- `whoami` — returns the signed-in principal
- `check_proxy_health` — probes all three gateway lanes + health endpoints
- `generate_image` — FLUX image generation (cf-img-flux-1-schnell default)
- `text_to_speech` — Aura TTS (cf-tts-aura-2-en default)
- `transcribe_audio` — Whisper STT (cf-stt-whisper-large-v3-turbo default)
- `bash` / `read_file` / `write_file` / `glob` / `grep` — host-native filesystem/shell overrides
- `web_search` — Tavily
- `exa_search` — Exa neural search
- `brave_search` — Brave web search
- `firecrawl_search` — Firecrawl web search

### 3. Connections (MCP + OpenAPI)

**Status:** None yet.

**What this gives us:** Wire external services (Linear, GitHub, your internal APIs) without exposing credentials to the model. The model discovers tools via `connection_search` and calls them as `<connection>__<tool>`.

**Options:**

- MCP connection: `defineMcpClientConnection({ url, auth })` — for MCP-compatible servers
- OpenAPI connection: `defineOpenAPIConnection({ spec, baseUrl, auth })` — for any REST API with an OpenAPI spec
- Auth: static token, per-user OAuth (Vercel Connect), or app-scoped

### 4. Channels (entry points)

**Status:** Eve HTTP channel (default API). Ready for CLI/curl/frontend.

**Available channels:**

| Channel                | Use                                                  |
| ---------------------- | ---------------------------------------------------- |
| **eve HTTP** (current) | API, TUI, `curl`, browser frontend via `useEveAgent` |
| **Slack**              | Mention-driven agent in Slack channels               |
| **Discord**            | Slash command / component agent                      |
| **Telegram**           | Bot messages                                         |
| **GitHub**             | @mentions in issues/PRs, code review                 |
| **Linear**             | Issue delegation, Agent Sessions                     |
| **Teams**              | Messages + Adaptive Cards                            |
| **Twilio**             | SMS / voice-transcribed calls                        |
| **iMessage** (Photon)  | Blue-bubble agent                                    |
| **Custom**             | `defineChannel` for any webhook/WebSocket            |

### 5. Subagents (specialists)

**Status:** None yet.

**How to use:**

- **Declared subagents** under `agent/subagents/<name>/` — each with own persona, tools, sandbox
- **Remote agents** — `defineRemoteAgent` to call a separately deployed eve agent as if local
- **Parallel delegation** — emit multiple `agent` calls in one response; eve runs them concurrently

**Vision:** Voice/avatar top-layer (ElevenLabs + Anam) could be a channel or remote agent that delegates background work to specialist subagents.

### 6. Skills (on-demand procedures)

**Status:** Skills from the fork are symlinked from `../eve-source-code/` into `.agents/skills/` (eve, gh-pr-description, technical-writing). untard and upstream are curated personal skills kept as real dirs.

**How it works:** Skills are markdown (`SKILL.md`) that the model loads via `load_skill` when a turn calls for them. Progressive disclosure — keeps context lean.

**Decision:** Skills are symlinked from the `eve-source-code` sibling repo into `.agents/skills/` so they stay aligned with the fork. The `eve` npm package also ships bundled docs at `node_modules/eve/docs/` as the authoritative version reference.

### 7. Schedules (cron jobs)

**Status:** None yet.

**Use cases:** Daily digests, data syncs, heartbeat checks, automated reports.

### 8. Sandbox (isolated execution)

**Status:** Host-native overrides in place; default sandbox unused locally.

**What it does:** By default, eve provides a `/workspace` filesystem for shell/file tools. We override those tools so the agent operates on the host filesystem instead. This matches the developer environment and avoids needing Docker Desktop locally.

**Backends:** Default backends remain available (just-bash, Docker, microsandbox, Vercel). We can re-enable sandbox isolation later by removing the override files under `agent/tools/`.

### 9. State (durable memory)

**Status:** None yet.

**`defineState`** gives per-session memory that survives crashes and redeploys. For cross-session memory, use a connection to your database.

### 10. Frontend (browser chat UI)

**Status:** None yet.

**Options:**

- `useEveAgent` React hook (reference implementation)
- Vue + Svelte adapters ship too
- Next.js integration via `withEve()` — mounts eve routes on same origin, no CORS
- Can add later with `eve add channel/web`

---

## Answers to your questions

### "Do I need more than one agent? Can I have more than one?"

**One root agent** is the entry point. You **can** add:

1. **Declared subagents** — `agent/subagents/researcher/`, `agent/subagents/coder/`, etc. Each is a full specialist with its own instructions, tools, sandbox. The root delegates to them.

2. **Remote agents** — separately deployed eve agents called as subagents via `defineRemoteAgent`.

3. **Multiple named agents in Next.js** — `withEve(nextConfig, { agents: { support: "./agents/support", billing: "./agents/billing" } })`. Each mounts under `/eve/agents/<name>/eve/v1/*`.

**For our vision:** Start with one root agent. Add declared subagents as specialties emerge (researcher, coder, voice-avatar delegator). Keep the root as the orchestrator.

### "Should source-code/ move outside eve?"

**Resolved:** Moved to sibling `c:\Users\james\projects\eve-source-code` (GitHub: `jamesnavinhill/eve-source-code`, a fork of `vercel/eve`). Added as a VS Code workspace folder. Sync via `git fetch upstream main && git merge upstream/main` or GitHub's "Sync fork" button. No in-repo sync workflow.

### "Should we symlink or npx-install skills?"

**Resolved:** Skills are symlinked from the `eve-source-code` sibling repo into `.agents/skills/`. This keeps them aligned with the fork automatically. The `eve` npm package also ships bundled docs at `node_modules/eve/docs/` as the authoritative version reference.

---

## Phased roadmap

### Phase 0: Foundation (✅ Done)

- [x] Scaffold eve agent project
- [x] Model config — Agency Gateway (LiteLLM, OpenAI Chat Completions)
- [x] Eve HTTP channel with auth walk
- [x] Starter tools (whoami, gateway health check)
- [x] Skills symlinked from eve-source-code into `.agents/skills/`
- [x] Model credential in `.env` (gateway master key)
- [x] `pnpm run dev` live chat verified ("Hello, how can I help you today?")

### Phase 1: Gateway integration (✅ Done)

- [x] Wire Agency Gateway — `gateway.chat("eve-orchestrator")` fallback group
- [x] `modelContextWindowTokens: 256_000` for compaction
- [x] `check_proxy_health` — probes /models, /health/liveliness, /health/readiness; reports modalities
- [x] `generate_image` — POST /v1/images/generations (FLUX models via Workers AI)
- [x] `text_to_speech` — POST /v1/audio/speech (Aura TTS via Workers AI)
- [x] `transcribe_audio` — POST /v1/audio/transcriptions (Whisper STT via Workers AI)
- [x] Host-native overrides for `bash`, `read_file`, `write_file`, `glob`, `grep`
- [x] Web search tools: Tavily, Exa, Brave, Firecrawl
- [x] All verified end-to-end through `pnpm dev` sessions

### Phase 1.5: Core wiring (✅ Done)

- [x] Add real tools (search, shell, filesystem)
- [x] Durable sessions verified through reconnectable streams
- [x] Host filesystem access works without Docker sandbox

### Phase 2: Voice & avatar integration (next)

- [ ] Decide where `text_to_speech` / `transcribe_audio` belong: root agent, subagent, or removed in favor of ElevenLabs
- [ ] Evaluate: ElevenLabs + Anam as a channel, remote agent, or top-layer orchestrator
- [ ] Reference: `c:\Users\james\orgs\oss\avatar-agent` (dormant but working)
- [ ] Reference: `c:\Users\james\projects\gardens` (multi-provider ElevenLabs/Anam)
- [ ] Design: voice/video as uninterrupted top-layer, Eve executes background tasks via HTTP sessions
- [ ] Agnostic seams: no vendor lock-in (multiple providers, multiple accounts)

### Phase 3: Channels & delegation

- [ ] Choose first non-HTTP channel (Slack? Discord? Telegram? GitHub?)
- [ ] Add first declared subagent (researcher? coder?)
- [ ] Add a schedule (daily digest or heartbeat)
- [ ] Add `defineState` for session memory

### Phase 4: Production deployment

- [ ] Choose: Vercel (managed Workflow + Sandbox + Cron) or self-host (Node + Docker)
- [ ] Replace `localDev` with real route auth
- [ ] Harden or re-enable sandbox isolation if needed
- [ ] Set up evals for agent behavior

---

## Key decisions

1. ~~**Proxy API format**~~ ✅ OpenAI-compatible (LiteLLM Chat Completions). Resolved.
2. ~~**Model/routing**~~ ✅ `eve-orchestrator` gateway alias with ordered CF fallback. Resolved.
3. ~~**Sandbox for local dev**~~ ✅ Host-native shell/file overrides. Resolved.
4. **Voice integration approach** — channel? remote agent? top-layer orchestrator? (needs ElevenLabs + EVE official docs review together)
5. **Deployment target** — Vercel (managed) or self-host? (affects Workflow/Sandbox/Cron)
6. **First channel beyond HTTP** — GitHub? Slack/Discord/Telegram?

---

## Reference paths

| What                            | Where                                            |
| ------------------------------- | ------------------------------------------------ |
| Bundled docs (authoritative)    | `node_modules/eve/docs/`                         |
| Forked source (local reference) | `../eve-source-code/docs/`                       |
| Framework source                | `../eve-source-code/packages/eve/src/`           |
| Example agents                  | `../eve-source-code/apps/fixtures/`              |
| Next.js framework integration   | `../eve-source-code/apps/frameworks/next/`       |
| Getting started guide           | `node_modules/eve/docs/getting-started.mdx`      |
| First agent tutorial            | `node_modules/eve/docs/tutorial/first-agent.mdx` |
| Our docs                        | `docs/` (architecture, config, ops, security)    |
