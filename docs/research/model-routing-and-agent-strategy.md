# Model Routing & Agent Strategy — Luna Project

**Status:** gateway-owned Luna orchestrator routing shipped; declared subagent strategy remains future work.
**Date:** 2026-08-15.

## Canonical sources (owned by agency repo)

- Live model catalog / aliases: `agency/config/litellm/config.yaml`
- Preferred model list + capabilities: `agency/config/preferred_models.yaml`
- Surface capability map: `agency/scripts/sync_surfaces.py` (`MODEL_CAPS`)
- Human-readable capability docs: `agency/docs/providers/*-model-capabilities.md`
- Your tiered strategy notes: `agency/_ops/research/model-routing.md`

Luna consumes model metadata from agency through the gateway (`/v1/models`); it must not duplicate the upstream source of truth.

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

## Luna implications

1. **Root routing is shipped at the gateway.** Luna calls the static
   `eve-orchestrator` alias with a 256K context window. LiteLLM owns the ordered
   Cloudflare fallback group, so Luna pays no per-step resolver cost.
2. **Model metadata remains agency-owned.** The live gateway catalog and agency
   configuration own aliases and capabilities; Luna must not duplicate them.
3. **Declared subagents remain future work.** If specialist agents are added,
   their role-specific model groups should be owned centrally rather than copied
   into each definition.
4. **Dynamic root routing was rejected for the current design.** It added agent
   complexity without improving the gateway-owned fallback behavior.

## Luna implementation — done in this session

Moved the deterministic CF fallback from Luna into the Agency Gateway. Luna now uses a single static alias and pays no per-step resolver cost.

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

1. **Group selection API for subagents.** Each declared subagent (`coding`, `audit`, `research`, `creative`, `bounded-task`) will need its own LiteLLM meta alias or a shared model-group resolver. Agree on naming and whether to keep the logic in agency or Luna?
2. **Next Luna slice:** scaffold the subagent filesystem and connect each subagent to its model group.
