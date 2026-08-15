import { defineTool } from "eve/tools";
import { z } from "zod";

const inputSchema = z.strictObject({
  query: z.string().describe("The search query."),
  numResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .describe("Number of results to return. Defaults to 10.")
    .optional(),
});

const outputSchema = z.strictObject({
  results: z
    .array(
      z.strictObject({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      }),
    )
    .describe("Search results with title, URL, and extracted content snippet."),
});

export default defineTool({
  description: [
    "Search the web using Firecrawl.",
    "",
    "Returns structured, extracted content from real-time web search results. Good when you need clean markdown-style content rather than raw snippets.",
  ].join("\n"),
  inputSchema,
  outputSchema,
  async execute({ query, numResults = 10 }) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set. Add it to .env to enable Firecrawl search.");
    }

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: numResults,
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firecrawl search failed: ${response.status} ${text}`);
    }

    const body = (await response.json()) as {
      success?: boolean;
      data?: Array<{ title?: string; url?: string; markdown?: string; content?: string }>;
      error?: string;
    };

    if (body.success === false) {
      throw new Error(`Firecrawl search failed: ${body.error ?? "unknown error"}`);
    }

    const MAX_CONTENT_CHARS = 4000;

    return {
      results: (body.data ?? []).map((result) => {
        const raw = result.markdown ?? result.content ?? "";
        return {
          title: result.title ?? "",
          url: result.url ?? "",
          content: raw.length > MAX_CONTENT_CHARS ? `${raw.slice(0, MAX_CONTENT_CHARS)}…` : raw,
        };
      }),
    };
  },
});
