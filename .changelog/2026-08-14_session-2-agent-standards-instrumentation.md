# Session 2 — 2026-08-14

## What Changed

### Item 1: .changelog structure

- Created `.changelog/` directory for session-by-session verified work records
- This entry is the first file in the new structure

### Item 2: AGENTS.md refreshed

- Rewrote `AGENTS.md` from old Orchestra-era content to eve-specific guide
- Includes: source truth, guiding principles, execution standard, repo layout, key commands, sync chain
- `upstream` and `untard` skills called out as guiding principles for every session (item 4)

### Item 3: docs/standards refreshed

- `dev-docs-standard.md`: removed `_ops` references, removed `user-manual-standard.md` reference, updated legacy-shelf guidance for eve's deletion policy
- `planning-style.md`: removed "Jami Studio OSS family" and `_ops` references, aligned roadmap paths to `docs/roadmaps/`, updated top-level docs guidance to `README.md`/`AGENTS.md`
- `report-style.md`: verified already aligned — references `docs/research/`, `docs/decisions/`, `docs/roadmaps/` which are correct for eve. No changes needed.

### Item 5: testing-standards.md created

- New `docs/standards/testing-standards.md` defining testing principles
- Core rules: system-level critical functions only, never brittle/trivial/changing, never mocked/faked, solid intentional set, full verification ladder each session, commit and push
- Referenced by AGENTS.md

### Item 6: agent/instrumentation.ts created — PostHog tracing

- Created `agent/instrumentation.ts` with `defineInstrumentation` from `eve/instrumentation`
- Uses `PostHogTraceExporter` from `@posthog/ai/otel` with `SimpleSpanProcessor`
- `registerOTel` from `@vercel/otel` with `serviceName: agentName`
- `events["step.started"]` tags each span with `posthog.distinct_id` from session auth principal (initiator → current fallback) so PostHog can attribute traces to the calling identity
- Env vars: `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST` (added to `.env.example`)
- Dependencies installed: `@posthog/ai`, `@vercel/otel`, `@opentelemetry/api`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/exporter-trace-otlp-http`, `@types/node`
- `pnpm build approvals` configured via `pnpm approve-builds --all` for transitive native deps (`@mongodb-js/zstd`, `node-liblzma`)

## Verified

- `pnpm typecheck` — PASS (0 errors)
- `pnpm run info` (eve info) — PASS (5 tools, 0 errors, 0 warnings, instrumentation discovered)

## Issues

- `pnpm typecheck` script still triggers a deps-status check via pnpm that fails on `ERR_PNPM_IGNORED_BUILDS` for transitive native deps. Fixed by running `pnpm approve-builds --all` — builds are now approved in pnpm config (`allowBuilds` in `.npmrc`). The `pnpm` field in `package.json` is deprecated in pnpm 11; config lives in `~/.npmrc` (global) or `.npmrc` (project) now.
- `node-liblzma` build failed (skipped as optional) — this is a transitive dep of `@posthog/ai` and is non-critical; the package works without it.

## Decisions

1. **PostHog project token, not API key**: The OTel exporter uses `POSTHOG_PROJECT_TOKEN` (ingestion token), not the `POSTHOG_API_KEY` (management API key). The `.env.example` documents this distinction.
2. **distinct_id from auth principal**: Sessions are tagged with `posthog.distinct_id` from the session auth principal — falls back from `initiator` (root session) to `current` (this turn's caller), so subagent sessions resolve to their root initiator.
3. **No `recordInputs`/`recordOutputs`**: Left at defaults (false) — inputs and outputs are not recorded on spans. Can be enabled later with explicit approval.
4. **`.changelog` is a directory**: Each session gets its own `.md` file (dated) rather than one growing file. This is the structure the user set up.
5. **`report-style.md` needed no changes**: Already aligned to eve repo paths. Only `dev-docs-standard.md` and `planning-style.md` needed updates.
