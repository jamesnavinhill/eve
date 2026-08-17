# Configuration

## Environment variables

Copy `.env.example` → `.env` and fill in:

| Variable                  | Required | Description                                                            |
| ------------------------- | -------- | ---------------------------------------------------------------------- |
| `AGENCY_GATEWAY_BASE_URL` | Yes      | Gateway endpoint. Live: `https://gateway.jami.studio/v1`               |
| `AGENCY_GATEWAY_API_KEY`  | Yes      | Gateway master key (mirrors `AGENCY_DO_MASTER_KEY` from agency `.env`) |
| `TAVILY_API_KEY`          | No       | Tavily web search (used by `web_search`)                               |
| `EXA_API_KEY`             | No       | Exa neural search (used by `exa_search`)                               |
| `BRAVE_API_KEY`           | No       | Brave web search (used by `brave_search`)                              |
| `FIRECRAWL_API_KEY`       | No       | Firecrawl web search (used by `firecrawl_search`)                      |
| `OUTBOUND_EMAIL_PROVIDER` | No       | Outbound transport: `smtp`, `resend`, or `agentmail`                   |
| `VERIZON_TEXT_USER_EMAIL` | No       | Fixed owner destination: `<10-digit number>@vtext.com`                 |
| `VERIZON_MMS_USER_EMAIL`  | No       | Fixed owner destination: `<10-digit number>@vzwpix.com`                |
| `SMTP_HOST`               | No       | SMTP transport host                                                    |
| `SMTP_PORT`               | No       | SMTP transport port                                                    |
| `SMTP_USER`               | No       | SMTP authentication username                                           |
| `SMTP_PASSWORD`           | No       | SMTP authentication password                                           |
| `SMTP_FROM_EMAIL`         | No       | Valid sender address for SMTP messages                                 |
| `RESEND_API_KEY`          | Yes      | Resend channel and transport API key                                   |
| `RESEND_WEBHOOK_SECRET`   | Yes      | Signing secret for the Resend `email.received` webhook                 |
| `RESEND_FROM_EMAIL`       | Yes      | Luna sender on the verified Resend domain                              |
| `LUNA_OWNER_EMAIL`        | Yes      | Proactive email and schedule recipient                                 |
| `LUNA_OWNER_EMAILS`       | Yes      | Comma-separated inbound sender allow-list                              |
| `DATABASE_URL`            | Yes      | Neon Postgres URL used by Chat SDK state                               |
| `LUNA_HTTP_USERNAME`      | No       | Production HTTP Basic username; defaults to `luna`                     |
| `LUNA_HTTP_PASSWORD`      | Yes      | Production HTTP Basic password                                         |
| `AGENTMAIL_API_KEY`       | No       | AgentMail transport API key                                            |
| `AGENTMAIL_EMAIL_ADDRESS` | No       | AgentMail inbox used as the sender                                     |
| `POSTHOG_PROJECT_TOKEN`   | Yes      | PostHog project token for OTel trace ingestion                         |
| `POSTHOG_HOST`            | No       | PostHog host (defaults to `https://us.i.posthog.com`)                  |
| `SENTRY_DSN`              | No       | Sentry DSN for error tracking and performance tracing                  |
| `SENTRY_ENVIRONMENT`      | No       | Environment tag (defaults to `luna-local`)                             |

## Outbound messaging

`send_message` is a proactive outbound tool, not an inbound channel. Luna sees one
provider-neutral action. `OUTBOUND_EMAIL_PROVIDER` explicitly selects the email
transport; there is no fallback chain.

Verizon is the destination adapter rather than the transport. Its official
email-to-text contract uses `<10-digit number>@vtext.com` for text and
`<10-digit number>@vzwpix.com` for image attachments. Text email must total no
more than 160 characters including the recipient address, subject, and message.
The tool validates these constraints before sending. Those fixed addresses stay
in `.env` and are never provided by the model, so the initial tool cannot message
arbitrary recipients.

SMTP, Resend, and AgentMail implement the same transport contract. Resend uses
Luna's tool-call-derived idempotency key. SMTP uses a deterministic Message-ID.
AgentMail receives the operation ID as a message header, but its API does not
document provider-side idempotency, so an interruption during send can still
create a duplicate.

As of August 15, 2026, AgentMail accepted outbound messages but Verizon did not
deliver them. A manual Gmail send to the same address arrived immediately. The
Resend domain `mail.navinhill.com` is verified with sending and receiving enabled.
The bidirectional channel uses the official Resend Chat SDK adapter and durable
Postgres state.

## Model configuration (`agent/agent.ts`)

```ts
const gateway = createOpenAI({
  baseURL: process.env.AGENCY_GATEWAY_BASE_URL ?? "https://gateway.jami.studio/v1",
  apiKey: process.env.AGENCY_GATEWAY_API_KEY ?? "",
});

export default defineAgent({
  model: gateway.chat("eve-orchestrator"),
  modelContextWindowTokens: 256_000,
  reasoning: "high",
  limits: {
    maxInputTokensPerSession: 40_000_000,
    maxOutputTokensPerSession: 1_000_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
  },
});
```

### Switching models

Change the string in `gateway.chat("model-alias")`. The Agency Gateway owns the
live alias catalog and routing in `agency/config/litellm/config.yaml`; query the
live `/v1/models` endpoint before selecting another alias. Luna's default is
`eve-orchestrator`, a gateway-owned fallback group with a 256K context window.

### Why `.chat()` not bare `gateway()`

`@ai-sdk/openai` v4 defaults to OpenAI's **Responses API** (`/v1/responses`). LiteLLM only implements **Chat Completions** (`/v1/chat/completions`). Using `.chat("model-id")` forces the correct path. Without it, every model call 404s.

### Why `modelContextWindowTokens`

When using a provider-authored `LanguageModel` instead of an AI Gateway string
ID, eve cannot infer the context window from its catalog. The configured
`modelContextWindowTokens: 256_000` lets compaction trigger at the correct point.
Without explicit metadata, `eve info` rejects the model configuration.

## Gateway architecture

Our gateway at `gateway.jami.studio` is a single front door that routes by path:

| Path pattern               | Routes to  | Service                                     |
| -------------------------- | ---------- | ------------------------------------------- |
| `/v1/chat/completions`     | `:8787`    | LiteLLM (Neon + NVIDIA + CF models)         |
| `/v1/images/generations`   | `:8788`    | Cloudflare Workers AI (FLUX)                |
| `/v1/audio/speech`         | `:8789`    | Cloudflare Workers AI (Aura TTS)            |
| `/v1/audio/transcriptions` | `:8789`    | Cloudflare Workers AI (Whisper STT)         |
| `/v1/models`               | all three  | Merged, modality-tagged live catalog        |
| `/health/liveliness`       | front door | Gateway liveness (requires auth header)     |
| `/health/readiness`        | all three  | Full readiness check (requires auth header) |

Source: `agency/scripts/agency_api_gateway.py`

## Channel auth (`agent/channels/eve.ts`)

The auth walk accepts:

- `vercelOidc()` for Vercel-issued internal runtime calls;
- `httpBasic()` when `LUNA_HTTP_PASSWORD` is configured for direct owner access;
- `localDev()` for deliberately open local development.

The Resend route has a separate boundary: the adapter verifies the webhook signing
secret, then Luna's handler admits only senders listed in `LUNA_OWNER_EMAILS`.

## pnpm configuration (`pnpm-workspace.yaml`)

```yaml
allowBuilds:
  "@mongodb-js/zstd": true
  esbuild: true
  node-liblzma: true
```

The compression dependencies support eve's sandbox backend. `esbuild` is required
by the installed workflow toolchain. Local shell and file tools run on the host;
their Vercel branch uses the official sandbox implementations.

## TypeScript (`tsconfig.json`)

- `target: ES2024`, `module: esnext`, `strict: true`
- Includes `agent/**/*` and `evals/**/*`
- Excludes `node_modules`, `dist`
- `types: ["node"]` — Node globals (`process`, `fetch`, `Buffer`)
