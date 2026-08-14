# Model Routing & Agent Strategy — Eve Project

**Status:** agency model catalog updated; Eve wiring is the next open slice.  
**Date:** 2026-08-14.

## Canonical sources (owned by agency repo)

- Live model catalog / aliases: `agency/config/litellm/config.yaml`
- Preferred model list + capabilities: `agency/config/preferred_models.yaml`
- Surface capability map: `agency/scripts/sync_surfaces.py` (`MODEL_CAPS`)
- Human-readable capability docs: `agency/docs/providers/*-model-capabilities.md`
- Your tiered strategy notes: `agency/_ops/research/model-routing.md`

Eve should consume model metadata from agency through the gateway (`/v1/models`) and the shared `agent/lib/models.ts` catalog; it must not duplicate the upstream source of truth.

## Agency update completed today

Four new models were added to the gateway and synced to local surfaces:

| Alias                                   | Provider              | Status                                                 |
| --------------------------------------- | --------------------- | ------------------------------------------------------ |
| `cf-deepseek-ai-deepseek-v4-pro-0813`   | Cloudflare Workers AI | Wired; 403 at call time pending CF account entitlement |
| `cf-deepseek-ai-deepseek-v4-flash-0731` | Cloudflare Workers AI | Wired; 403 at call time pending CF account entitlement |
| `meta-muse-glimmer-30b`                 | NVIDIA API Catalog    | Wired; live probe OK                                   |
| `nvidia-nemotron-3-5-lightning-30b-a3b` | NVIDIA API Catalog    | Wired; live probe OK                                   |

Commit: `studio-jami/agency@d3216b0` on `main`.

DO gateway needs a restart/redeploy from the latest config before the DO-Agency surface lane sees the new aliases; then rerun `scripts/sync_surfaces.py --remote`.

## Eve implications

1. **Eve (root orchestrator) should use Cloudflare aliases**, not the current `gateway.chat("glm-5-2")` which routes through Neon. Target CF aliases:
   - `cf-deepseek-ai-deepseek-v4-pro-0813`
   - `cf-deepseek-ai-deepseek-v4-flash-0731`
   - `cf-zai-org-glm-5-2`
   - `cf-moonshotai-kimi-k2-7-code`

2. **Root `agent.ts` must stop hardcoding a single model + context window.** Use `defineDynamic` on `model` so the selected alias and its context window come from the agency catalog, not constants in `agent.ts`.

3. **Subagents use Neon/Nvidia first, CF fallback.** Each declared subagent (`coding`, `audit`, `research`, `creative`, `bounded-task`) imports a shared model-group resolver rather than duplicating lists.

4. **Gateway-level fallback is the eventual upstream fix; Eve tests it first.** LiteLLM `router_settings.fallbacks` will be added later in agency once we know the call-shape behavior. Until then, Eve's `agent/lib/models.ts` returns a deterministic ordered group for each intent.

## Eve implementation — done in this session

Moved the deterministic CF fallback from Eve into the Agency Gateway. Eve now uses a single static alias and pays no per-step resolver cost.

- `agency/config/litellm/config.yaml` — added `eve-orchestrator` meta alias. LiteLLM's `router_settings.fallbacks` tries CF models in order: YRKA > JAMI; Kimi K2.7-code > Kimi K2.6 > Gemma 4. GLM 5.2 is intentionally excluded so image turns never hit a text-only model.
- `agency/scripts/sync_surfaces.py` — added `eve-orchestrator` to `MODEL_CAPS` so IDE/agent surfaces get the right context/output tokens and capability flags.
- `agent/agent.ts` — replaced the `defineDynamic` `step.started` resolver and deleted `agent/lib/models.ts`. Now uses `gateway.chat("eve-orchestrator")` with `modelContextWindowTokens: 256_000`.
- Surfaces re-synced against the deployed DO gateway so `eve-orchestrator` appears in VS Code / ZCode / OpenCode model inventories.

Verification:

- Agency config smoke test — local LiteLLM proxy served `eve-orchestrator` and a chat completion succeeded.
- `scripts/digitalocean_deploy.ps1` — deployed to DO gateway; readiness probe reported 200 models ready.
- `scripts/sync_surfaces.py --remote` — ran; `eve-orchestrator` added to VS Code and ZCode configs, `opencode.json` updated.
- `pnpm typecheck` — PASS
- `pnpm lint` — PASS
- `pnpm fmt` — PASS
- `pnpm build` — PASS
- `pnpm dev` smoke test — session accepted; stream shows `modelId: "openai/eve-orchestrator"`, response generated, `step.completed` with usage.

## Remaining open decisions

1. **Group selection API for subagents.** Each declared subagent (`coding`, `audit`, `research`, `creative`, `bounded-task`) will need its own LiteLLM meta alias or a shared model-group resolver. Agree on naming and whether to keep the logic in agency or Eve?
2. **Next Eve slice:** scaffold the subagent filesystem and connect each subagent to its model group.
