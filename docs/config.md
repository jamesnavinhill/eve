# Configuration

## Environment variables

Copy `.env.example` → `.env` and fill in:

| Variable                  | Required | Description                                                            |
| ------------------------- | -------- | ---------------------------------------------------------------------- |
| `AGENCY_GATEWAY_BASE_URL` | Yes      | Gateway endpoint. Live: `https://gateway.jami.studio/v1`               |
| `AGENCY_GATEWAY_API_KEY`  | Yes      | Gateway master key (mirrors `AGENCY_DO_MASTER_KEY` from agency `.env`) |
| `POSTHOG_PROJECT_TOKEN`   | Yes      | PostHog project token for OTel trace ingestion                         |
| `POSTHOG_HOST`            | No       | PostHog host (defaults to `https://us.i.posthog.com`)                  |
| `SENTRY_DSN`              | Yes      | Sentry DSN for error tracking and performance tracing                  |
| `SENTRY_ENVIRONMENT`      | No       | Environment tag (defaults to `eve-local`)                              |

## Model configuration (`agent/agent.ts`)

```ts
const gateway = createOpenAI({
  baseURL: process.env.AGENCY_GATEWAY_BASE_URL ?? "https://gateway.jami.studio/v1",
  apiKey: process.env.AGENCY_GATEWAY_API_KEY ?? "",
});

export default defineAgent({
  model: gateway.chat("glm-5-2"),
  modelContextWindowTokens: 128_000,
  reasoning: "high",
  limits: {
    maxInputTokensPerSession: 40_000_000,
    maxOutputTokensPerSession: 1_000_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
  },
});
```

### Switching models

Change the string in `gateway.chat("model-alias")`. Available aliases are defined in `agency/config/litellm/config.yaml`. Common choices:

| Alias              | Provider        | Notes                               |
| ------------------ | --------------- | ----------------------------------- |
| `glm-5-2`          | Neon AI Gateway | Current default, 128K context       |
| `z-ai-glm-5.2`     | NVIDIA NIM      | Same model, different route         |
| `claude-sonnet-5`  | Neon            | Anthropic family (omit temperature) |
| `gpt-5`            | Neon            | OpenAI family                       |
| `gemini-3-5-flash` | Neon            | Google family, fast + cheap         |

### Why `.chat()` not bare `gateway()`

`@ai-sdk/openai` v4 defaults to OpenAI's **Responses API** (`/v1/responses`). LiteLLM only implements **Chat Completions** (`/v1/chat/completions`). Using `.chat("model-id")` forces the correct path. Without it, every model call 404s.

### Why `modelContextWindowTokens`

When using a provider-authored `LanguageModel` (not a gateway string id), eve can't look up the context window from its AI Gateway catalog. `modelContextWindowTokens: 128_000` tells eve the window size so compaction triggers at the right point. Without it, `eve info` fails with "does not have known AI Gateway context window metadata."

## Gateway architecture

Our gateway at `gateway.jami.studio` is a single front door that routes by path:

| Path pattern               | Routes to  | Service                                      |
| -------------------------- | ---------- | -------------------------------------------- |
| `/v1/chat/completions`     | `:8787`    | LiteLLM (Neon + NVIDIA + CF models)          |
| `/v1/images/generations`   | `:8788`    | Cloudflare Workers AI (FLUX)                 |
| `/v1/audio/speech`         | `:8789`    | Cloudflare Workers AI (Aura TTS)             |
| `/v1/audio/transcriptions` | `:8789`    | Cloudflare Workers AI (Whisper STT)          |
| `/v1/models`               | all three  | Merged catalog (191 models, modality-tagged) |
| `/health/liveliness`       | front door | Gateway liveness (requires auth header)      |
| `/health/readiness`        | all three  | Full readiness check (requires auth header)  |

Source: `agency/scripts/agency_api_gateway.py`

## Channel auth (`agent/channels/eve.ts`)

The auth walk is `[vercelOidc(), localDev()]`:

- `vercelOidc()` — accepts Vercel-issued OIDC tokens (for Vercel-to-Vercel calls)
- `localDev()` — accepts everything in development (synthetic local principal)

In production (non-Vercel), replace with your own authenticator. See [eve auth docs](../eve-source-code/docs/guides/auth-and-route-protection.md).

## pnpm configuration (`pnpm-workspace.yaml`)

```yaml
allowBuilds:
  "@mongodb-js/zstd": set this to true or false
  node-liblzma: set this to true or false
```

These are transitive native deps from eve's sandbox backend. They don't affect agent functionality. Set to `true` if you want the sandbox's just-bash backend; leave `false` and eve still runs fine (sandbox falls back).

## TypeScript (`tsconfig.json`)

- `target: ES2024`, `module: esnext`, `strict: true`
- Includes `agent/**/*` and `evals/**/*`
- Excludes `node_modules`, `dist`
- `types: ["node"]` — Node globals (`process`, `fetch`, `Buffer`)
