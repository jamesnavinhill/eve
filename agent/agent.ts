import { defineAgent, defineDynamic } from "eve";
import { selectEveModel } from "./lib/models";

export default defineAgent({
  // Dynamic model selection lets Eve choose the right Cloudflare Workers AI
  // model per turn instead of hardcoding a single alias. The resolver:
  //   - prefers YRKA over JAMI,
  //   - prefers Kimi K2.7-code > GLM 5.2 > Kimi K2.6 > Gemma 4,
  //   - skips GLM 5.2 when the turn contains image content,
  //   - refreshes available aliases from the gateway /v1/models endpoint
  //     with a graceful fallback to the hardcoded preference list.
  model: defineDynamic({
    events: {
      // step.started is required here because we return a live LanguageModel
      // from our custom OpenAI-compatible provider. Session/turn selections
      // must be model id strings.
      async "step.started"(_event, ctx) {
        return selectEveModel({ messages: ctx.messages });
      },
    },
  }),

  // Reasoning effort for the model. All CF candidates support reasoning.
  reasoning: "high",

  // Runtime limits — generous for an internal agent, but not unbounded.
  limits: {
    maxInputTokensPerSession: 40_000_000,
    maxOutputTokensPerSession: 1_000_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000, // 7 days
  },
});
