# Security

## Secrets

| Secret | Where it lives | What it does |
|--------|---------------|--------------|
| `AGENCY_GATEWAY_API_KEY` | `eve/.env` (gitignored) | Authenticates all gateway requests (chat, image, audio) |
| `AGENCY_DO_MASTER_KEY` | `agency/.env` | The source-of-truth key (mirrored to `eve/.env`) |

**`.env` is gitignored and never committed.** The `.env.example` file documents the structure without values.

## Gateway auth

The Agency Gateway front door (`agency_api_gateway.py` on `:8790`) requires a Bearer token on **every** request, including health probes. The token is `LITELLM_MASTER_KEY` on the droplet, mirrored as `AGENCY_DO_MASTER_KEY` in the local agency `.env`, and copied into `eve/.env` as `AGENCY_GATEWAY_API_KEY`.

```
Authorization: Bearer sk-e9329a7a...
```

## Channel auth (eve HTTP API)

The eve HTTP channel (`agent/channels/eve.ts`) uses an auth walk:

1. `vercelOidc()` — accepts Vercel-issued OIDC tokens
2. `localDev()` — accepts everything in local development (synthetic principal)

**Local dev is wide open by design.** This is a personal development environment. Production deployment must replace this with a real authenticator (your app's session/JWT/API key).

## Trust boundaries

Eve separates two execution contexts:

| | App runtime (tools) | Sandbox (model shell) |
|---|---|---|
| `process.env` / secrets | ✅ Full access | ❌ No access |
| Your Node.js code | ✅ Runs directly | ❌ Isolated |
| Network | Unrestricted | Controlled by policy |
| Filesystem | App's own | Isolated `/workspace` |

Tools run in the **app runtime** with full access to `process.env` — our gateway tools read `AGENCY_GATEWAY_API_KEY` from here. The model's sandbox is isolated and never sees secrets.

## What the model can and cannot do

| Can | Cannot |
|-----|--------|
| Call all 5 tools (health, image, TTS, STT, whoami) | See `AGENCY_GATEWAY_API_KEY` directly |
| Read/write files in the sandbox `/workspace` | Access `process.env` from sandbox |
| Run bash commands in sandbox | Make arbitrary network calls from sandbox (policy-controlled) |

## Gateway key rotation

To rotate the gateway key:
1. Generate a new master key on the droplet (`LITELLM_MASTER_KEY`)
2. Update `agency/.env` → `AGENCY_DO_MASTER_KEY`
3. Update `eve/.env` → `AGENCY_GATEWAY_API_KEY`
4. Restart both services
