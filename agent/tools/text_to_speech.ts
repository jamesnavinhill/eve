import { defineTool } from "eve/tools";
import { z } from "zod";
import { GATEWAY_BASE_URL, gatewayAuthHeaders, isGatewayConfigured } from "../lib/gateway";

export default defineTool({
  description:
    "Convert text to speech audio using the Agency Gateway (Cloudflare Workers AI / Aura TTS). " +
    "Returns a base64-encoded MP3 audio clip. Use for voice responses, audio feedback, or accessibility.",
  inputSchema: z.object({
    text: z.string().describe("The text to synthesize into speech."),
    model: z
      .string()
      .default("cf-tts-aura-2-en")
      .describe("TTS model alias. English: cf-tts-aura-2-en. Spanish: cf-tts-aura-2-es."),
    voice: z
      .string()
      .default("alpha")
      .describe("Voice variant. Options vary by model (alpha, beta, gamma, delta)."),
  }),
  async execute({ text, model, voice }) {
    if (!isGatewayConfigured()) {
      return {
        error:
          "Gateway not configured. Set AGENCY_GATEWAY_BASE_URL and AGENCY_GATEWAY_API_KEY in .env.",
      };
    }

    const response = await fetch(`${GATEWAY_BASE_URL}/audio/speech`, {
      method: "POST",
      headers: gatewayAuthHeaders(),
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `Gateway returned ${response.status}`, detail: errorText };
    }

    // The response is raw audio bytes (audio/mpeg). Convert to base64 for
    // structured return — the caller can decode and play/write as needed.
    const audioBuffer = await response.arrayBuffer();
    const b64 = Buffer.from(audioBuffer).toString("base64");

    return {
      model,
      voice,
      textLength: text.length,
      format: "mp3",
      audioBase64: b64,
      sizeBytes: audioBuffer.byteLength,
    };
  },
  // The model can't hear audio — the base64 is wasted context. Project it
  // down to a text summary. The full output still flows to the channel
  // stream and hooks for frontend rendering.
  toModelOutput(output) {
    if ("error" in output) {
      return { type: "text" as const, value: `TTS failed: ${output.error}` };
    }
    return {
      type: "text" as const,
      value: `Generated ${output.sizeBytes}-byte MP3 audio (${output.textLength} chars) using ${output.model} voice ${output.voice}.`,
    };
  },
});
