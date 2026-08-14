import { defineTool } from "eve/tools";
import { z } from "zod";
import { GATEWAY_BASE_URL, gatewayAuthHeaders, isGatewayConfigured } from "../lib/gateway";

export default defineTool({
  description:
    "Generate an image from a text prompt using the Agency Gateway (Cloudflare Workers AI / FLUX models). " +
    "Returns a base64-encoded JPEG image. Use for creating diagrams, illustrations, or visual content.",
  inputSchema: z.object({
    prompt: z.string().describe("Text description of the image to generate."),
    model: z
      .string()
      .default("cf-img-flux-1-schnell")
      .describe(
        "Image model alias. Fast: cf-img-flux-1-schnell. " +
          "Higher quality: cf-img-flux-2-dev, cf-img-flux-2-klein-4b.",
      ),
    size: z
      .enum(["512x512", "768x768", "1024x1024"])
      .default("1024x1024")
      .describe("Output image dimensions."),
  }),
  async execute({ prompt, model, size }) {
    if (!isGatewayConfigured()) {
      return {
        error:
          "Gateway not configured. Set AGENCY_GATEWAY_BASE_URL and AGENCY_GATEWAY_API_KEY in .env.",
      };
    }

    const response = await fetch(`${GATEWAY_BASE_URL}/images/generations`, {
      method: "POST",
      headers: gatewayAuthHeaders(),
      body: JSON.stringify({ model, prompt, n: 1, size }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `Gateway returned ${response.status}`, detail: text };
    }

    const body = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };

    const image = body.data?.[0];
    if (!image) {
      return { error: "No image data in gateway response." };
    }

    return {
      model,
      prompt,
      size,
      format: image.b64_json ? "base64" : "url",
      // Return the image data — b64_json is the standard Workers AI path.
      // The agent can reference this in session state or write it to disk.
      b64_json: image.b64_json,
      url: image.url,
    };
  },
  // The model can't see image pixels — the base64 is wasted context. Project
  // it down to a text summary. The full output (including b64_json) still
  // flows to the channel stream and hooks for frontend rendering.
  toModelOutput(output) {
    if ("error" in output) {
      return { type: "text" as const, value: `Image generation failed: ${output.error}` };
    }
    return {
      type: "text" as const,
      value: `Generated ${output.size} image using ${output.model} for: "${output.prompt}".`,
    };
  },
});
