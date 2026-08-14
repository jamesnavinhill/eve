import { defineTool } from "eve/tools";
import { z } from "zod";

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
    const baseUrl = process.env.AGENCY_GATEWAY_BASE_URL;
    const apiKey = process.env.AGENCY_GATEWAY_API_KEY;

    if (!baseUrl || !apiKey) {
      return {
        error:
          "Gateway not configured. Set AGENCY_GATEWAY_BASE_URL and AGENCY_GATEWAY_API_KEY in .env.",
      };
    }

    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
});
