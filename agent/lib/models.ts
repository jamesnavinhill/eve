import type { LanguageModel } from "ai";
import { GATEWAY_API_KEY, GATEWAY_BASE_URL, gateway } from "./gateway";

/**
 * Canonical Eve orchestrator model preference.
 *
 * Eve runs only on Cloudflare Workers AI for now. The order is intentionally
 * deterministic: YRKA credit pool first, then JAMI; larger/stronger models
 * before smaller ones. If a model is unavailable or rate-limited, the selection
 * logic falls through to the next candidate.
 *
 * Context windows and capabilities come from agency/config/preferred_models.yaml
 * and agency/scripts/sync_surfaces.py (MODEL_CAPS). This file is the Eve-side
 * copy; the runtime gateway check below updates availability without blocking.
 */
export interface ModelCandidate {
  alias: string;
  contextWindowTokens: number;
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportsToolCalling: boolean;
}

export interface ModelSelection {
  model: LanguageModel;
  modelContextWindowTokens: number;
}

export const EVE_CF_PREFERENCE: readonly ModelCandidate[] = [
  {
    alias: "cf-yrka-moonshotai-kimi-k2-7-code",
    contextWindowTokens: 262_144,
    supportsVision: true,
    supportsReasoning: true,
    supportsToolCalling: true,
  },
  {
    alias: "cf-jami-moonshotai-kimi-k2-7-code",
    contextWindowTokens: 262_144,
    supportsVision: true,
    supportsReasoning: true,
    supportsToolCalling: true,
  },
  {
    alias: "cf-yrka-zai-org-glm-5-2",
    contextWindowTokens: 262_144,
    supportsVision: false,
    supportsReasoning: true,
    supportsToolCalling: true,
  },
  {
    alias: "cf-jami-zai-org-glm-5-2",
    contextWindowTokens: 262_144,
    supportsVision: false,
    supportsReasoning: true,
    supportsToolCalling: true,
  },
  {
    alias: "cf-yrka-moonshotai-kimi-k2-6",
    contextWindowTokens: 262_144,
    supportsVision: true,
    supportsReasoning: true,
    supportsToolCalling: true,
  },
  {
    alias: "cf-jami-moonshotai-kimi-k2-6",
    contextWindowTokens: 262_144,
    supportsVision: true,
    supportsReasoning: true,
    supportsToolCalling: true,
  },
  {
    alias: "cf-yrka-google-gemma-4-26b-a4b-it",
    contextWindowTokens: 256_000,
    supportsVision: true,
    supportsReasoning: true,
    supportsToolCalling: true,
  },
  {
    alias: "cf-jami-google-gemma-4-26b-a4b-it",
    contextWindowTokens: 256_000,
    supportsVision: true,
    supportsReasoning: true,
    supportsToolCalling: true,
  },
];

interface GatewayModelsResponse {
  data?: Array<{ id: string }>;
}

let gatewayAliasCache: Set<string> | null = null;
let gatewayAliasCacheAt = 0;
const GATEWAY_CACHE_TTL_MS = 60_000;

/**
 * Fetch the current model catalog from the gateway. Non-blocking: any failure
 * returns an empty set, which causes selection to fall back to the hardcoded
 * preference list.
 */
export async function fetchGatewayAliases(): Promise<Set<string>> {
  const now = Date.now();
  if (gatewayAliasCache && now - gatewayAliasCacheAt < GATEWAY_CACHE_TTL_MS) {
    return gatewayAliasCache;
  }

  try {
    const response = await fetch(`${GATEWAY_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      gatewayAliasCache ??= new Set();
      return gatewayAliasCache;
    }

    const body = (await response.json()) as GatewayModelsResponse;
    const aliases = new Set((body.data ?? []).map((m) => m.id));
    gatewayAliasCache = aliases;
    gatewayAliasCacheAt = now;
    return aliases;
  } catch {
    gatewayAliasCache ??= new Set();
    return gatewayAliasCache;
  }
}

function isImagePart(part: unknown): boolean {
  if (typeof part !== "object" || part === null) return false;
  const typed = part as Record<string, unknown>;
  if (typed.type === "image") return true;
  if (typed.type === "file") {
    const mediaType = typed.mediaType;
    return (
      typeof mediaType === "string" && (mediaType === "image" || mediaType.startsWith("image/"))
    );
  }
  return false;
}

/**
 * Detect whether any message in the conversation contains an image part.
 * Used to skip non-vision models (GLM 5.2) for that session/turn.
 */
export function hasImageInMessages(messages: readonly unknown[]): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some((message) => {
    if (typeof message !== "object" || message === null) return false;
    const content = (message as Record<string, unknown>).content;
    if (typeof content === "string") return false;
    if (!Array.isArray(content)) return false;
    return content.some(isImagePart);
  });
}

/**
 * Select the best Eve model for the current turn.
 *
 * 1. Checks the live gateway `/v1/models` (with a short-lived cache).
 * 2. Picks the highest-preference CF alias that the gateway serves.
 * 3. If the turn contains image content, skips GLM 5.2.
 * 4. Falls back to the top hardcoded preference on any mismatch or error.
 */
export async function selectEveModel(
  options: { messages?: readonly unknown[] } = {},
): Promise<ModelSelection> {
  const needsVision = hasImageInMessages(options.messages ?? []);
  const available = await fetchGatewayAliases();

  for (const candidate of EVE_CF_PREFERENCE) {
    if (needsVision && !candidate.supportsVision) continue;
    if (available.size > 0 && !available.has(candidate.alias)) continue;
    return {
      model: gateway.chat(candidate.alias),
      modelContextWindowTokens: candidate.contextWindowTokens,
    };
  }

  // No candidate matched the gateway/vision constraints. Fall back to the top
  // preference (which always exists) and let the gateway surface the real
  // error if it is unusable.
  const fallback = EVE_CF_PREFERENCE[0]!;
  return {
    model: gateway.chat(fallback.alias),
    modelContextWindowTokens: fallback.contextWindowTokens,
  };
}
