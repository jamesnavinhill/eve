# Session 3 — 2026-08-14

## What Changed

### Agency provider seam documented in AGENTS.md

- Added "Provider seam — Agency Gateway" section to `AGENTS.md` calling out the
  Agency Gateway (LiteLLM proxy at `gateway.jami.studio`) as the primary provider
  interface, with a pointer to the sibling `agency/` workspace folder
  (`studio-jami/agency` on GitHub) as the source of truth for model aliases,
  gateway ops, PostHog/Sentry credentials, and provider credentials
- Updated repo layout in AGENTS.md to include `../agency/` as a sibling
- Updated key commands to include `pnpm lint` and `pnpm fmt`

### PostHog + Sentry wired into eve .env

- Populated `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` in `.env` (shared from
  the agency project — same PostHog project)
- Added `SENTRY_DSN` and `SENTRY_ENVIRONMENT` to `.env` (same Sentry org/project
  as agency: yrka-io / agency-model-eval, environment tagged `eve-local`)
- Updated `.env.example` with the Sentry section
- Updated `docs/config.md` env vars table to include all observability vars

### Sentry added to agent/instrumentation.ts

- `Sentry.init()` runs before OTel setup so the error handler captures everything
- DSN from `SENTRY_DSN`, environment from `SENTRY_ENVIRONMENT` (defaults to
  `eve-local`), `tracesSampleRate` and `profilesSampleRate` at 1.0
- `@sentry/node` installed as a runtime dependency

### Linting + formatting tooling set up

- Installed `oxlint` and `oxfmt` as devDependencies (matching the eve framework's
  own tooling)
- Added `lint` (`oxlint --fix`) and `fmt` (`oxfmt`) scripts to `package.json`
- Created `.oxlintrc.json` with ignore patterns for `.agents/`, `.eve/`,
  `.output/`, `node_modules/`
- No custom rules, no constraints, no gates — just the tools, ready to use

### docs/config.md updated

- Env vars table now includes PostHog and Sentry vars with descriptions

## Verified

- `pnpm typecheck` — PASS (0 errors)
- `pnpm lint` — PASS (0 errors, 0 warnings)
- `pnpm fmt` — PASS (29 files, no changes needed)
- `pnpm run info` (eve info) — PASS (5 tools, 0 errors, 0 warnings)
- `pnpm build` — PASS (Nitro server built, 10.3 MB / 2.35 MB gzip, includes
  PostHog + Sentry + OTel bundles)

## Decisions

1. **Shared PostHog/Sentry project**: Eve traces flow into the same PostHog
   project and Sentry project as agency — one pane of glass for all jami-studio
   observability. Environment tag (`eve-local`) distinguishes eve from agency
   (`agency-local`).
2. **Sentry initialized in instrumentation.ts setup**: The `setup` callback runs
   at server startup, before any request. Sentry init before OTel ensures the
   error handler is installed first.
3. **oxlint + oxfmt, no config constraints**: Just the tools with ignore patterns
   for generated dirs. No custom rules, no gates, no pre-commit hooks. The tools
   are available for manual use; nothing blocks development.
