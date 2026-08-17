# Session 15 — 2026-08-17

## What changed

Shipped Luna's first production deployment and proved the Resend email channel
end to end.

## Deployment

- Connected `jamesnavinhill/luna` to the Vercel `luna` project (git-connect,
  `main` production branch). Framework preset set to `eve`.
- First production deployment live at `https://luna.navinhill.com` (alias
  verified via the already-attached domain; DNS MX/SPF already green).
- Set `RESEND_WEBHOOK_SECRET` (svix `whsec_…`) in Vercel production + preview
  env, and created the Resend `email.received` webhook at
  `https://luna.navinhill.com/eve/v1/resend`.
- Extended `LUNA_OWNER_EMAILS` allow-list to include the Resend sender alias
  (`james@mail.navinhill.com`) alongside the Zoho owner mailbox, so the owner
  can drive a round-trip from either origin.

## Local fixes

- `pnpm-workspace.yaml` — removed the malformed `onlyBuiltDependencies` string
  that broke `pnpm install` (`…push is not a function`). `allowBuilds` map
  already covers the native build allow-list.
- `package.json` — `pnpm run info` now runs
  `node --env-file=.env node_modules/eve/bin/eve.js info` because `eve info`
  does not auto-load `.env` (while `eve build`/`dev` do).
- `scripts/context-index.ts` — prefixed unused `docstringOf` params to clear
  the lint warnings.
- `.vercelignore` — excludes `node_modules`, `.env*`, `.eve`, `.output`,
  `.tmp`, etc. so `eve deploy` uploads the agent only (was 193 MB / 7865 files,
  now ~114 KB). This also sidestepped Vercel's CLI free-tier upload limit by
  shipping via git-connect.

## Verified

- `luna.navinhill.com/eve/v1/health` → `200 {"ok":true,"status":"ready"}`.
- Production auth rejects anonymous `/eve/v1/info` → `401`; unsigned webhook
  `POST /eve/v1/resend` → `401` (svix verification active).
- Sign-signed Resend webhook `POST /eve/v1/resend` → `200`; chat-sdk adapter +
  Neon state initialized.
- Full round-trip: owner email → Resend inbound → webhook → allow-list match →
  durable model run (`wrun_41M0718…`, `openai/eve-orchestrator`, trigger
  `resend`) → Luna reply `"I got this."` delivered back to the owner
  (`last_event: delivered`).
- Local ladder green: `pnpm typecheck`, `pnpm lint`, `pnpm run info` (0 errors,
  0 warnings, 15 tools, 1 schedule).