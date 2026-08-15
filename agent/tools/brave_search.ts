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
    .describe("Search results with title, URL, and description snippet."),
});

export default defineTool({
  description: [
    "Search the web using Brave Search.",
    "",
    "Useful for general web queries and privacy-focused search results.",
  ].join("\n"),
  inputSchema,
  outputSchema,
  async execute({ query, numResults = 10 }) {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      throw new Error("BRAVE_API_KEY is not set. Add it to .env to enable Brave search.");
    }

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(numResults, 20)));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Brave search failed: ${response.status} ${text}`);
    }

    const body = (await response.json()) as {
      web?: {
        results?: Array<{ title: string; url: string; description: string }>;
      };
    };

    return {
      results: (body.web?.results ?? []).map((result) => ({
        title: result.title,
        url: result.url,
        content: result.description,
      })),
    };
  },
});
