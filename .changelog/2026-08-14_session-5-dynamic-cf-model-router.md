# Session 5 — 2026-08-14

## What Changed

### Replaced hardcoded Eve model with a dynamic Cloudflare-only router

- Removed the hardcoded `gateway.chat("glm-5-2")` + `modelContextWindowTokens: 128_000` from `agent/agent.ts`.
- Added `agent/lib/models.ts`:
  - `EVE_CF_PREFERENCE` — deterministic ordered CF Workers AI preference:
    1. `cf-yrka-moonshotai-kimi-k2-7-code`
    2. `cf-jami-moonshotai-kimi-k2-7-code`
    3. `cf-yrka-zai-org-glm-5-2`
    4. `cf-jami-zai-org-glm-5-2`
    5. `cf-yrka-moonshotai-kimi-k2-6`
    6. `cf-jami-moonshotai-kimi-k2-6`
    7. `cf-yrka-google-gemma-4-26b-a4b-it`
    8. `cf-jami-google-gemma-4-26b-a4b-it`
  - Non-blocking runtime check against gateway `/v1/models` with a 60-second cache.
  - Vision detection skips GLM 5.2 for turns that contain image parts.
  - Graceful fallback to the top preference if the gateway check fails.
- Updated `agent/agent.ts` to use `defineDynamic` with a `step.started` resolver returning the selected `LanguageModel` and context window.

## Decisions

1. **Hybrid metadata source.** Hardcoded canon in `agent/lib/models.ts` (non-blocking); runtime `/v1/models` refreshes availability. Does not block on fetch failure.
2. **Eve CF-only for now.** No Neon/Nvidia at the root orchestrator until the free endpoints are proven reliable.
3. **Dynamic resolver at `step.started`.** Required because we return a live `LanguageModel` from the custom OpenAI-compatible provider; session/turn selections must be model id strings.
4. **Gateway-level fallback deferred.** Once this Eve-level routing is proven, the ordered fallback will move into `agency/config/litellm/config.yaml` `router_settings.fallbacks`.

## Verified

- `pnpm typecheck` — PASS (0 errors)
- `pnpm lint` — PASS (0 errors, 0 warnings)
- `pnpm fmt` — PASS (no changes needed)
- `npx eve info` — PASS (5 tools, 0 errors/warnings)
- `pnpm dev` live smoke test — session created, message routed to `openai/cf-yrka-moonshotai-kimi-k2-7-code`, returned "OK" with 1 output token.
