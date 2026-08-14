import { defineAgent } from "eve";
import { gateway } from "./lib/gateway";

export default defineAgent({
  // GLM 5.2: 128K context window, 4K max output (Neon AI Gateway route).
  // modelContextWindowTokens tells eve how large the context window is so
  // compaction triggers correctly — required for any model not in the
  // AI Gateway catalog (i.e. custom proxy/OpenAI-compatible endpoints).
  //
  // .chat() forces the Chat Completions API (/v1/chat/completions) instead
  // of OpenAI's Responses API (/v1/responses), which LiteLLM doesn't support
  // for non-OpenAI upstream models.
  model: gateway.chat("glm-5-2"),
  modelContextWindowTokens: 128_000,

  // Reasoning effort for the model. Adjust as needed.
  reasoning: "high",

  // Runtime limits — generous for an internal agent, but not unbounded.
  limits: {
    maxInputTokensPerSession: 40_000_000,
    maxOutputTokensPerSession: 1_000_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000, // 7 days
  },
});
