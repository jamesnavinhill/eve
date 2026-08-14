import { defineTool } from "eve/tools";
import { z } from "zod";

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
        "Higher quality: cf-img-flux-2-dev, cf-img-flux-2-klein-4b."
      ),
    size: z
      .enum(["512x512", "768x768", "1024x1024"])
      .default("1024x1024")
      .describe("Output image dimensions."),
  }),
  async execute({ prompt, model, size }) {
    const baseUrl = process.env.AGENCY_GATEWAY_BASE_URL;
    const apiKey = process.env.AGENCY_GATEWAY_API_KEY;

    if (!baseUrl || !apiKey) {
      return {
        error: "Gateway not configured. Set AGENCY_GATEWAY_BASE_URL and AGENCY_GATEWAY_API_KEY in .env.",
      };
    }

    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt, n: 1, size }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `Gateway returned ${response.status}`, detail: text };
    }

    const body = await response.json() as {
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
});
