import { createOpenAI } from "@ai-sdk/openai";

// Agency Gateway — LiteLLM proxy at gateway.jami.studio
// OpenAI-compatible Chat Completions endpoint. Model names are LiteLLM
// aliases defined in agency/config/litellm/config.yaml.
//
// Single source of truth for gateway config. Agent and tools import from
// here instead of reading process.env independently.

export const GATEWAY_BASE_URL =
  process.env.AGENCY_GATEWAY_BASE_URL ?? "https://gateway.jami.studio/v1";

// The gateway host without the /v1 suffix. Health endpoints live at the
// front door root (/health/liveliness, /health/readiness), not under /v1.
export const GATEWAY_ORIGIN = GATEWAY_BASE_URL.replace(/\/v1\/?$/, "");

export const GATEWAY_API_KEY = process.env.AGENCY_GATEWAY_API_KEY ?? "";

/** Whether the gateway is configured with a non-empty key. */
export function isGatewayConfigured(): boolean {
  return GATEWAY_BASE_URL.length > 0 && GATEWAY_API_KEY.length > 0;
}

// Shared OpenAI-compatible provider for the model loop.
// A fetch wrapper injects Luna's surface identity into every chat completion
// request body. The gateway's enrichment hook reads user + metadata.tags
// and forwards them into PostHog / Langfuse traces, giving us per-surface
// attribution with a single gateway key.
export const gateway = createOpenAI({
  baseURL: GATEWAY_BASE_URL,
  apiKey: GATEWAY_API_KEY,
  fetch: async (input, init) => {
    if (init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        body.user = body.user ?? "luna";
        const meta = (body.metadata ?? {}) as Record<string, unknown>;
        const tags = Array.isArray(meta.tags) ? meta.tags : [];
        if (!tags.includes("surface:luna")) tags.push("surface:luna");
        meta.tags = tags;
        body.metadata = meta;
        init.body = JSON.stringify(body);
      } catch {
        // Not JSON — leave as-is.
      }
    }
    return fetch(input, init);
  },
});

// Auth headers for direct gateway fetch calls (image, audio, health probes).
// Tools that call the gateway outside the AI SDK model loop use this.
export function gatewayAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${GATEWAY_API_KEY}`,
    "Content-Type": "application/json",
  };
}
