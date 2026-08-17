# Security

## Secrets

| Secret                   | Where it lives          | What it does                                            |
| ------------------------ | ----------------------- | ------------------------------------------------------- |
| `AGENCY_GATEWAY_API_KEY` | `eve/.env` (gitignored) | Authenticates all gateway requests (chat, image, audio) |
| `AGENCY_DO_MASTER_KEY`   | `agency/.env`           | The source-of-truth key (mirrored to `eve/.env`)        |

**`.env` is gitignored and never committed.** The `.env.example` file documents the structure without values.

## Gateway auth

The Agency Gateway front door (`agency_api_gateway.py` on `:8790`) requires a Bearer token on **every** request, including health probes. The token is `LITELLM_MASTER_KEY` on the droplet, mirrored as `AGENCY_DO_MASTER_KEY` in the local agency `.env`, and copied into `eve/.env` as `AGENCY_GATEWAY_API_KEY`.

```
Authorization: Bearer <AGENCY_GATEWAY_API_KEY>
```

## Channel auth (eve HTTP API)

The eve HTTP channel (`agent/channels/eve.ts`) uses an auth walk:

1. `vercelOidc()` — accepts current-project Vercel OIDC tokens
2. `httpBasic()` — accepts the configured owner/operator credential
3. `localDev()` — accepts everything in local development (synthetic principal)

**Local dev is wide open by design.** This is a personal development environment.
Production direct access requires HTTP Basic or Vercel OIDC. The Resend channel
verifies its webhook signature separately and admits only configured owner senders.

## Trust boundaries

Local shell and file tools run directly on the **host** instead of inside eve's
sandbox. This is a deliberate local-development posture: Luna shares the developer
environment and can run any binary or script the host account can run. On Vercel,
the same authored tool names select eve's official Vercel Sandbox implementations.

|                         | App runtime (tools) | Host shell/file tools |
| ----------------------- | ------------------- | --------------------- |
| `process.env` / secrets | ✅ Full access      | ✅ Inherits from env  |
| Your Node.js code       | ✅ Runs directly    | ❌ Not involved       |
| Network                 | Unrestricted        | Unrestricted          |
| Filesystem              | App's own           | Host filesystem       |

Tools run in the **app runtime** with full access to `process.env` — our gateway and search tools read `AGENCY_GATEWAY_API_KEY`, `TAVILY_API_KEY`, etc. from here. The host shell/file tools inherit the same environment and filesystem access.

## What the model can and cannot do

| Can                                                                    | Cannot                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Call all resolved tools, including search, media, messaging, and shell | See secret values unless a tool returns or exposes them  |
| Read and write files anywhere allowed to the host process              | Exceed the host OS privileges of the running process     |
| Run arbitrary shell commands with the host process's privileges        | Access credentials absent from the process environment   |
| Trigger configured external side effects                               | Prove downstream delivery from provider acceptance alone |

## Gateway key rotation

To rotate the gateway key:

1. Generate a new master key on the droplet (`LITELLM_MASTER_KEY`)
2. Update `agency/.env` → `AGENCY_DO_MASTER_KEY`
3. Update `eve/.env` → `AGENCY_GATEWAY_API_KEY`
4. Restart both services
