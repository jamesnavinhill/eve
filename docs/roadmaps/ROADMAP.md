# Eve — Studio Internal Agent Roadmap

> Status: **Phase 0 — Foundation scaffolded** (2026-08-13)
> Source: Forked from `vercel/eve` v0.37.0, kept in sync via `.github/workflows/sync-upstream.yml`

---

## What was set up today

### Project structure

```
eve/                          ← your agent project (this repo)
├── package.json              ← eve 0.37.0, ai 7, zod 4, @ai-sdk/openai
├── tsconfig.json
├── .env.example              ← model credentials template
├── .gitignore                ← ignores node_modules/, .env, build artifacts
├── .github/workflows/
│   └── sync-upstream.yml     ← daily sync from vercel/eve → source-code/ (in-repo)
├── agent/
│   ├── agent.ts              ← model config (glm-5-2 via Agency Gateway)
│   ├── instructions.md       ← Eve identity + standing rules
│   ├── channels/
│   │   └── eve.ts            ← HTTP channel with auth walk (vercelOidc + localDev)
│   └── tools/
│       ├── whoami.ts         ← returns the signed-in principal
│       ├── check_proxy_health.ts ← probes all three gateway lanes
│       ├── generate_image.ts ← FLUX image generation via Workers AI
│       ├── text_to_speech.ts ← Aura TTS via Workers AI
│       └── transcribe_audio.ts ← Whisper STT via Workers AI
├── docs/                     ← our own docs (architecture, config, ops, security)
│   ├── research/             ← research notes and explorations
│   └── roadmaps/             ← phased roadmap and planning
└── ../eve-source-code/       ← vercel/eve fork (sibling, reference + docs)
```

### What works now

- ✅ `pnpm install` — all dependencies resolved
- ✅ `pnpm exec eve info` — agent discovered: 5 tools, instructions loaded, 0 errors
- ✅ `pnpm exec eve build` — compiles to Nitro server under `.output/`
- ✅ `pnpm exec eve dev` → live chat through Agency Gateway ("Hello, how can I help you today?")
- ✅ Image generation (FLUX schnell), TTS (Aura-2), health check all verified live

### Gateway integration (✅ Done)

- Agency Gateway at `https://gateway.jami.studio/v1` — OpenAI-compatible (LiteLLM)
- Model: `glm-5-2` via Neon AI Gateway route, 128K context window
- 5 tools covering all three gateway lanes (chat, image, audio)
- 191 models available across chat (131), image (33), TTS (12), STT (15)

---

## How eve works — the mental model

### Filesystem-first agents

Everything is a file. eve walks `agent/` and compiles:

| Slot | Path | What it does |
|------|------|-------------|
| **Instructions** | `agent/instructions.md` | Always-on system prompt (identity + rules) |
| **Agent config** | `agent/agent.ts` | Model, reasoning, compaction, limits |
| **Tools** | `agent/tools/*.ts` | Typed actions the model can call (your code, app runtime) |
| **Skills** | `agent/skills/*.md` or `*/SKILL.md` | On-demand procedures (progressive disclosure) |
| **Connections** | `agent/connections/*.ts` | MCP servers + OpenAPI APIs (model never sees credentials) |
| **Channels** | `agent/channels/*.ts` | HTTP, Slack, Discord, Telegram, GitHub, Linear, iMessage |
| **Subagents** | `agent/subagents/*/agent.ts` | Specialist child agents with their own tools/sandbox |
| **Schedules** | `agent/schedules/*.ts` | Cron-triggered agent runs |
| **Sandbox** | `agent/sandbox/` | Isolated bash environment (model's filesystem) |
| **State** | `defineState()` in code | Durable per-session memory (survives crashes/redeploys) |

### Sessions are durable

A session is a long-lived conversation that survives process restarts and redeploys.
Work nests in three levels:
- **Session** — the whole conversation (days/weeks)
- **Turn** — one user message + all work it triggers
- **Step** — a durable checkpoint (one model call + its tool calls)

If the process crashes mid-turn, it resumes from the last completed step. No replay needed.

### Trust boundaries

| | App runtime | Sandbox |
|---|---|---|
| `process.env` / secrets | ✅ Yes | ❌ No |
| Your Node.js code | ✅ Yes | ❌ No |
| Network | Unrestricted | Controlled by policy |
| Filesystem | App's own | Isolated `/workspace` |

Tools run in the **app runtime** with full access to `process.env`. The sandbox is where the model runs shell commands — it never sees your secrets.

### Two ways to delegate to subagents

1. **Built-in `agent` tool** — root-only. Runs a fresh copy of the root agent. Inherits everything except root-only tools. Shared sandbox.
2. **Declared subagents** (`agent/subagents/<id>/`) — specialists with their own instructions, tools, sandbox, and state. Nothing inherits implicitly.

---

## Feature map — eve capabilities and how we'll use them

### 1. Model & Proxy API
**Status:** ✅ Wired and verified. `glm-5-2` via Agency Gateway (LiteLLM, Chat Completions API).

**Current config:**
- `@ai-sdk/openai` with custom `baseURL` → `gateway.jami.studio/v1`
- `.chat("glm-5-2")` forces Chat Completions (LiteLLM doesn't support Responses API)
- `modelContextWindowTokens: 128_000` for compaction
- Switch models by changing the alias string — 191 available

### 2. Tools (typed actions)
**Status:** 5 tools. All gateway lanes covered.

**Current tools:**
- `whoami` — returns the signed-in principal
- `check_proxy_health` — probes all three gateway lanes + health endpoints
- `generate_image` — FLUX image generation (cf-img-flux-1-schnell default)
- `text_to_speech` — Aura TTS (cf-tts-aura-2-en default)
- `transcribe_audio` — Whisper STT (cf-stt-whisper-large-v3-turbo default)

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
| Channel | Use |
|---------|-----|
| **eve HTTP** (current) | API, TUI, `curl`, browser frontend via `useEveAgent` |
| **Slack** | Mention-driven agent in Slack channels |
| **Discord** | Slash command / component agent |
| **Telegram** | Bot messages |
| **GitHub** | @mentions in issues/PRs, code review |
| **Linear** | Issue delegation, Agent Sessions |
| **Teams** | Messages + Adaptive Cards |
| **Twilio** | SMS / voice-transcribed calls |
| **iMessage** (Photon) | Blue-bubble agent |
| **Custom** | `defineChannel` for any webhook/WebSocket |

### 5. Subagents (specialists)
**Status:** None yet.

**How to use:**
- **Declared subagents** under `agent/subagents/<name>/` — each with own persona, tools, sandbox
- **Remote agents** — `defineRemoteAgent` to call a separately deployed eve agent as if local
- **Parallel delegation** — emit multiple `agent` calls in one response; eve runs them concurrently

**Vision:** Voice/avatar top-layer (ElevenLabs + Anam) could be a channel or remote agent that delegates background work to specialist subagents.

### 6. Skills (on-demand procedures)
**Status:** Skills from the fork are in `.agent/skills/` and `source-code/skills/`.

**How it works:** Skills are markdown (`SKILL.md`) that the model loads via `load_skill` when a turn calls for them. Progressive disclosure — keeps context lean.

**Decision:** We have the source-code fork. When eve is installed (npm), its bundled `node_modules/eve/docs/` is the authoritative reference. We don't need to symlink skills — the eve package ships the `eve` skill that points to bundled docs.

### 7. Schedules (cron jobs)
**Status:** None yet.

**Use cases:** Daily digests, data syncs, heartbeat checks, automated reports.

### 8. Sandbox (isolated execution)
**Status:** Default framework sandbox.

**What it does:** Gives the model a `/workspace` filesystem where it can run bash, read/write files, and execute scripts — without touching app runtime secrets.

**Backends:** Local (dev), Vercel Sandbox (Vercel deploy), Docker (self-host), microsandbox.

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

**Resolved:** Moved to sibling `c:\Users\james\projects\eve-source-code` and added as a VS Code workspace folder. The `.gitignore` no longer needs the `source-code/` entry for local purposes, but the GitHub Action still syncs `source-code/` as a subtree inside the git repo for CI reference. The sibling checkout is the local working reference.

### "Should we symlink or npx-install skills?"

**Neither permanently.** The `eve` npm package ships:
- Bundled docs at `node_modules/eve/docs/` (authoritative, matches installed version)
- The `eve` skill at `source-code/skills/eve/SKILL.md` that points to bundled docs

The `.agent/skills/` copies you made are fine for reference. When eve is installed via npm, its bundled skill is what the agent uses. No symlinking needed.

---

## Phased roadmap

### Phase 0: Foundation (✅ Done)
- [x] Scaffold eve agent project
- [x] Model config — Agency Gateway (LiteLLM, OpenAI Chat Completions)
- [x] Eve HTTP channel with auth walk
- [x] Starter tools (whoami, gateway health check)
- [x] GitHub Action for fork sync
- [x] Model credential in `.env` (gateway master key)
- [x] `pnpm run dev` live chat verified ("Hello, how can I help you today?")

### Phase 1: Gateway integration (✅ Done)
- [x] Wire Agency Gateway — `gateway.chat("glm-5-2")` forces Chat Completions API
- [x] `modelContextWindowTokens: 128_000` for compaction (custom model not in AI Gateway catalog)
- [x] `check_proxy_health` — probes /models, /health/liveliness, /health/readiness; reports modalities
- [x] `generate_image` — POST /v1/images/generations (FLUX models via Workers AI)
- [x] `text_to_speech` — POST /v1/audio/speech (Aura TTS via Workers AI)
- [x] `transcribe_audio` — POST /v1/audio/transcriptions (Whisper STT via Workers AI)
- [x] All verified end-to-end through eve dev TUI
- [x] 191 models across chat (131), image (33), TTS (12), STT (15)

### Phase 1.5: Core wiring (next)
- [ ] Add first real tools (your internal API callers)
- [ ] Add first connection (MCP or OpenAPI to an external service)
- [ ] Test durable sessions (crash → resume → verify)
- [ ] Explore the sandbox (seed workspace files, run scripts)

### Phase 2: Channels & delegation
- [ ] Choose first non-HTTP channel (Slack? Discord? Telegram?)
- [ ] Add first declared subagent (researcher? coder?)
- [ ] Add a schedule (daily digest or heartbeat)
- [ ] Add `defineState` for session memory

### Phase 3: Voice & avatar integration
- [ ] Evaluate: ElevenLabs + Anam as a channel, remote agent, or top-layer orchestrator
- [ ] Reference: `c:\Users\james\orgs\oss\avatar-agent` (dormant but working)
- [ ] Reference: `c:\Users\james\projects\gardens` (multi-provider ElevenLabs/Anam)
- [ ] Design: voice as uninterrupted top-layer, background agents execute tasks
- [ ] Agnostic seams: no vendor lock-in (multiple providers, multiple accounts)

### Phase 4: Production deployment
- [ ] Choose: Vercel (managed Workflow + Sandbox + Cron) or self-host (Node + Docker)
- [ ] Replace `placeholderAuth`/`localDev` with real route auth
- [ ] Add OpenTelemetry instrumentation
- [ ] Set up evals for agent behavior
- [ ] Configure sandbox network policy

---

## Key decisions for you

1. ~~**Proxy API format**~~ ✅ OpenAI-compatible (LiteLLM Chat Completions). Resolved.
2. **Deployment target** — Vercel (managed) or self-host? (affects Workflow/Sandbox/Cron)
3. **First channel beyond HTTP** — GitHub (your pick). Slack/Discord/Telegram later.
4. ~~**source-code/ location**~~ ✅ Moved to sibling `c:\Users\james\projects\eve-source-code` + workspace folder.
5. **Voice integration approach** — channel? remote agent? top-layer orchestrator? (needs ElevenLabs + EVE official docs review together)

---

## Reference paths

| What | Where |
|------|-------|
| Bundled docs (authoritative) | `node_modules/eve/docs/` |
| Forked source (local reference) | `../eve-source-code/docs/` |
| Framework source | `../eve-source-code/packages/eve/src/` |
| Example agents | `../eve-source-code/apps/fixtures/` |
| Next.js framework integration | `../eve-source-code/apps/frameworks/next/` |
| Getting started guide | `node_modules/eve/docs/getting-started.mdx` |
| First agent tutorial | `node_modules/eve/docs/tutorial/first-agent.mdx` |
| Our docs | `docs/` (architecture, config, ops, security) |
