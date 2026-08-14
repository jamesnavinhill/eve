import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

// Agency Gateway — LiteLLM proxy at gateway.jami.studio
// OpenAI-compatible Chat Completions endpoint. Model names are LiteLLM
// aliases defined in agency/config/litellm/config.yaml.
// Default: glm-5-2 (Neon AI Gateway route). Also available: z-ai-glm-5.2
// (NVIDIA NIM route), claude-sonnet-5, gpt-5, gemini-3-5-flash, etc.
const gateway = createOpenAI({
  baseURL: process.env.AGENCY_GATEWAY_BASE_URL ?? "https://gateway.jami.studio/v1",
  apiKey: process.env.AGENCY_GATEWAY_API_KEY ?? "",
});

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
