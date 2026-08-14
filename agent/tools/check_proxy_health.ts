import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  GATEWAY_BASE_URL,
  GATEWAY_ORIGIN,
  GATEWAY_API_KEY,
  isGatewayConfigured,
} from "../lib/gateway";

export default defineTool({
  description:
    "Check the health and configuration of the Agency Gateway. Probes the unified endpoint for chat, image, and audio services — reports model counts per modality and liveliness status.",
  inputSchema: z.object({}),
  async execute() {
    if (!isGatewayConfigured()) {
      return {
        mode: "not-configured",
        message: "Set AGENCY_GATEWAY_BASE_URL and AGENCY_GATEWAY_API_KEY in .env",
      };
    }

    const authHeaders = { Authorization: `Bearer ${GATEWAY_API_KEY}` };
    const results: Record<string, unknown> = {
      gateway: GATEWAY_BASE_URL,
      hasKey: GATEWAY_API_KEY.length > 0,
    };

    // Probe /v1/models (unified — front door merges chat + image + audio catalogs)
    try {
      const modelsResponse = await fetch(`${GATEWAY_BASE_URL}/models`, {
        headers: authHeaders,
      });
      results.modelsEndpoint = { reachable: modelsResponse.ok, status: modelsResponse.status };
      if (modelsResponse.ok) {
        const body = (await modelsResponse.json()) as {
          data?: Array<{ id: string; modality?: string }>;
        };
        const models = body.data ?? [];
        const byModality: Record<string, string[]> = {};
        for (const m of models) {
          const mod = m.modality ?? "chat";
          (byModality[mod] ??= []).push(m.id);
        }
        results.modelCount = models.length;
        results.modalities = Object.fromEntries(
          Object.entries(byModality).map(([k, v]) => [k, v.length]),
        );
        results.sampleModels = {
          chat: (byModality.chat ?? []).slice(0, 5),
          image: (byModality.image ?? []).slice(0, 5),
          tts: (byModality.tts ?? []).slice(0, 5),
          stt: (byModality.stt ?? []).slice(0, 5),
        };
      }
    } catch (error) {
      results.modelsEndpoint = {
        reachable: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Probe /health/liveliness (at the front door root, not under /v1)
    try {
      const healthResponse = await fetch(`${GATEWAY_ORIGIN}/health/liveliness`, {
        headers: authHeaders,
      });
      results.liveliness = { reachable: healthResponse.ok, status: healthResponse.status };
    } catch (error) {
      results.liveliness = {
        reachable: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Probe /health/readiness (checks all three upstream services)
    try {
      const readyResponse = await fetch(`${GATEWAY_ORIGIN}/health/readiness`, {
        headers: authHeaders,
      });
      if (readyResponse.ok) {
        const body = (await readyResponse.json()) as {
          status: string;
          checks?: Record<string, unknown>;
        };
        results.readiness = { status: body.status, checks: body.checks };
      } else {
        results.readiness = { status: "degraded", httpStatus: readyResponse.status };
      }
    } catch (error) {
      results.readiness = {
        status: "unreachable",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    return results;
  },
});
