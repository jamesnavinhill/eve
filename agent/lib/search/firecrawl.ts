import { z } from "zod";
import { requireOk, requireSearchApiKey } from "./execute";
import type { SearchProvider } from "./types";

const responseSchema = z.object({
  success: z.boolean().optional(),
  data: z
    .array(
      z.object({
        title: z.string().optional(),
        url: z.string().optional(),
        markdown: z.string().optional(),
        content: z.string().optional(),
      }),
    )
    .default([]),
  error: z.string().optional(),
});

export const firecrawlSearch: SearchProvider = {
  name: "Firecrawl",
  async search(query, maxResults, signal) {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireSearchApiKey("FIRECRAWL_API_KEY")}`,
      },
      body: JSON.stringify({
        query,
        limit: maxResults,
        scrapeOptions: { formats: ["markdown"] },
      }),
      signal,
    });
    await requireOk(response);
    const body = responseSchema.parse(await response.json());
    if (body.success === false) throw new Error(body.error ?? "provider rejected the request");
    return {
      results: body.data.map((result) => ({
        title: result.title ?? "",
        url: result.url ?? "",
        content: result.markdown ?? result.content ?? "",
      })),
    };
  },
};
