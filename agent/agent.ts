import { defineAgent } from "eve";
import { gateway } from "./lib/gateway";

export default defineAgent({
  // Luna routes through the Agency Gateway's eve-orchestrator alias. The
  // gateway owns the ordered fallback list (YRKA > JAMI; Kimi K2.7-code >
  // Kimi K2.6 > Gemma 4) so Luna does not pay a per-step resolver cost.
  // GLM 5.2 is excluded from the orchestrator group so image turns never
  // hit a text-only model.
  model: gateway.chat("eve-orchestrator"),
  modelContextWindowTokens: 256_000,

  // Reasoning effort for the model. All CF candidates support reasoning.
  reasoning: "high",

  // Runtime limits — generous for an internal agent, but not unbounded.
  limits: {
    maxInputTokensPerSession: 40_000_000,
    maxOutputTokensPerSession: 1_000_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000, // 7 days
  },
});
