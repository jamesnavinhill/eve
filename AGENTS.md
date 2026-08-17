# AGENTS.md — eve agent project

This is the agent project (`jamesnavinhill/luna`), built on the
[eve](https://github.com/vercel/eve) framework. It wires an agent to the Agency
Gateway (LiteLLM proxy) for chat, images, TTS, and STT. The framework source
lives in a sibling repo (`eve-source-code/`, a fork of `vercel/eve`).

## Provider seam — Agency Gateway

The Agency Gateway is the primary provider interface for this agent. It is a
LiteLLM proxy running on a DigitalOcean droplet behind a Cloudflare Tunnel,
exposing a unified OpenAI-compatible endpoint at `https://gateway.jami.studio/v1`.
The proxy configuration, model catalog, and operational tooling live in the
sibling `agency/` workspace folder (`studio-jami/agency` on GitHub). That
project is the source of truth for:

- Model aliases and routing (`agency/config/litellm/config.yaml`)
- Gateway operational scripts, health probes, and proxy admin
- PostHog and Sentry project credentials (shared with this agent)
- API keys and provider credentials

Luna's chat model is the `eve-orchestrator` alias, a LiteLLM fallback group
that tries CF models in deterministic order (YRKA > JAMI; Kimi K2.7-code >
Kimi K2.6 > Gemma 4). When model config or gateway behavior changes, verify
against the live gateway, not just the agency repo's files.

## Source truth

- The live repo, generated artifacts, command output, provider read-backs, and
  board issue state are current truth.
- **DOCUMENTS ARE NOT VERIFICATION. EVER.** Any file on disk — CSVs, notes,
  envs, READMEs, prior reports — is a LEAD, not truth. Claims about live systems
  are verified only by live connection: API read-back, auth handshake, command
  output. Quote the probe, never the file.
- Historical logs and reports are evidence, not current behavior. Use them to
  understand why rules exist, then verify against live state before acting.

## Guiding principles (every session)

Two skills are non-negotiable — read and apply them before work begins:

- **`upstream`** — On any error, constraint, surprise, repeated failure, or hard
  decision: ask why it exists, walk to the source, and fix it there. Upstream is
  a north star at all times, not a recovery-mode tool. A repeated symptom across
  multiple places = proof of ONE upstream constraint. Address that source, not
  each instance.
- **`untard`** — Put any constraint, process, gate, or dependency on trial for
  its right to exist. If it earns less than it costs, rip it out. High risk
  appetite for deleting drag. Never trade away security, correctness, or
  evidence quality.

Both are in `.agents/skills/`. Load them before working.

## Execution standard

- Finish the requested thing, not a plan to finish it. Build the whole owning
  slice: implementation, contracts, config, tests, docs, changelog, and
  verification.
- No mocks, stubs, hidden demo paths, fake telemetry, weakened checks, or
  claims-only completion unless the owner explicitly asks for a disposable
  experiment.
- **Full send is the default posture.** These are our projects; agents operate
  with full access. We do not add constraints, self-gates, or approval loops.
  The one hard constraint is cost: allocated, active credits and subscription
  accounts only.

## Emphasis discipline

Emphasis in prompts and rules is earned by failure, not style. When a rule
exists because an agent actually broke it, mark it loud — **bold** or CAPS — so
it survives a skim under load. Keep the emphasis budget small. If everything is
emphasized, nothing is.

## Boundaries

- Work inside this repo or the fork sibling. Do not leave loose scratch files,
  logs, or generated residue in repo roots.
- Preserve unrelated user or agent work. Stage explicit paths only.
- Do not commit secrets. Secret values live only in `.env` (gitignored) or host
  secret stores; examples carry names only.
- Keep provider integrations behind thin adapters where swap value is real.

## Git and closeout

- Trunk-based: pull/rebase, commit directly to `main`, push in-session.
- Every commit includes `Signed-off-by` (DCO). Use `git commit -s`.
- Run the narrowest complete verification for the changed surface.
- Report what changed, what was verified, and what could not run with the
  exact reason.
- Update `.changelog` at session end with verified work only.

## Standards

`docs/standards/README.md` maps the project standards. The symlinked
`technical-writing` skill owns documentation workflow and review; local standards
add this repository's internal-doc, planning, reporting, and testing policy.

See `docs/standards/testing-standards.md` for the full testing policy. Summary:

- Tests run for system-level critical functions only — the things that must
  never break as we develop.
- Never create tests for brittle, changing, trivial, or non-critical stuff.
- Never mocked or faked. Solid, intentional test set.
- Each session: full verification ladder, commit, push.

## Repo layout

```
eve/                              <- this repo (agent project)
  agent/                          <- agent definition (compiled by eve)
    agent.ts                      <- model config (Agency Gateway)
    instrumentation.ts            <- PostHog + Sentry tracing setup
    instructions.md               <- agent identity + standing rules
    channels/                     <- HTTP channel with auth
    tools/                        <- custom tools + host-native overrides
                                  (search, image, audio, shell, files, gateway)
  .agents/skills/                 <- framework symlinks + project-owned Vercel skill snapshots
  .changelog/                     <- session-by-session record
  .github/dependabot.yml          <- weekly npm updates
  docs/                           <- our docs
    standards/                    <- dev-docs, planning, report, testing standards
    research/                     <- vision draft + research notes
    roadmaps/                     <- phased roadmap
  scripts/sync-fork.ps1           <- pnpm sync (pull fork changes)
  .env.example                    <- env var template (no secrets)
  ../eve-source-code/             <- fork of vercel/eve (sibling, workspace folder)
  ../agency/                      <- gateway provider (LiteLLM proxy config, scripts, models)
```

## Key commands

```sh
pnpm dev          # start eve dev server
pnpm build        # compile to Nitro server
pnpm info         # show resolved agent info (tools, skills, errors)
pnpm sync         # pull latest from eve-source-code fork
pnpm typecheck    # tsc --noEmit
pnpm lint         # oxlint (auto-fixes)
pnpm fmt          # oxfmt
```

## Sync chain

```
vercel/eve  --4x daily-->  jamesnavinhill/eve-source-code (GH Actions)
                            --pnpm sync-->  local eve-source-code/
                                             --symlinks-->  eve, technical-writing,
                                                            gh-pr-description skills

Vercel plugin skills under `.agents/skills/` are project-owned snapshots and do
not participate in this fork sync chain.
```
