# Session 6 — 2026-08-14

## What changed

### Replaced Eve's dynamic model resolver with a static gateway alias

- Deleted `agent/lib/models.ts` and its runtime `/v1/models` check + vision-skip logic.
- Updated `agent/agent.ts` to use `gateway.chat("eve-orchestrator")` with `modelContextWindowTokens: 256_000`.
- The deterministic CF model fallback now lives in the Agency Gateway LiteLLM config (`router_settings.fallbacks`) instead of inside Eve.
- The `eve-orchestrator` alias order is YRKA > JAMI; Kimi K2.7-code > Kimi K2.6 > Gemma 4. GLM 5.2 is excluded so image turns never hit a text-only model.
- Updated `docs/research/model-routing-and-agent-strategy.md` with the new decision and verification results.

## Decisions

1. Upstream routing is the right place for the ordered fallback. It removes Eve's per-step resolver cost and keeps the routing contract with other gateway consumers.
2. Eve is now a simple consumer of the gateway orchestrator alias; it does not maintain a separate model capability catalog or cache.
3. Subagent model groups will follow the same pattern: declare an agency meta alias, then bind the Eve subagent to that alias.

## Verified

- `pnpm typecheck` — PASS (0 errors)
- `pnpm lint` — PASS (0 errors, 0 warnings)
- `pnpm fmt` — PASS (no changes needed)
- `pnpm build` — PASS
- `pnpm dev` live smoke test — session accepted; stream shows `modelId: "openai/eve-orchestrator"`, assistant response generated, `step.completed` with usage.
- Agency DO gateway deploy + surface sync completed; `eve-orchestrator` appears in local and deployed `/v1/models` responses and in VS Code / ZCode / OpenCode inventories.
