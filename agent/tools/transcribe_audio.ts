import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Transcribe speech to text from an audio file using the Agency Gateway (Cloudflare Workers AI / Whisper). " +
    "Accepts a base64-encoded audio clip and returns the transcribed text. Use for voice input processing.",
  inputSchema: z.object({
    audioBase64: z
      .string()
      .describe("Base64-encoded audio data (mp3, wav, ogg, flac, m4a)."),
    filename: z
      .string()
      .default("audio.mp3")
      .describe("Original filename with extension (used for format detection)."),
    model: z
      .string()
      .default("cf-stt-whisper-large-v3-turbo")
      .describe(
        "STT model alias. Fast: cf-stt-whisper-tiny-en. " +
        "Best multilingual: cf-stt-whisper-large-v3-turbo."
      ),
  }),
  async execute({ audioBase64, filename, model }) {
    const baseUrl = process.env.AGENCY_GATEWAY_BASE_URL;
    const apiKey = process.env.AGENCY_GATEWAY_API_KEY;

    if (!baseUrl || !apiKey) {
      return {
        error: "Gateway not configured. Set AGENCY_GATEWAY_BASE_URL and AGENCY_GATEWAY_API_KEY in .env.",
      };
    }

    // The OpenAI transcription endpoint expects multipart/form-data with
    // a file field and a model field.
    const audioBytes = Buffer.from(audioBase64, "base64");
    const boundary = "----agency-boundary-" + Date.now();

    const multipartBody = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="model"`,
      "",
      model,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      "Content-Type: application/octet-stream",
      "",
    ].join("\r\n");
    const closingBoundary = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(multipartBody, "utf-8"),
      audioBytes,
      Buffer.from(closingBoundary, "utf-8"),
    ]);

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `Gateway returned ${response.status}`, detail: errorText };
    }

    const result = await response.json() as { text?: string };

    return {
      model,
      filename,
      text: result.text ?? "",
    };
  },
});
