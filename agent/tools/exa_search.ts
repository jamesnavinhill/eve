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
    .describe("Search results with title, URL, and text snippet."),
});

export default defineTool({
  description: [
    "Search the web using Exa's neural/semantic search engine.",
    "",
    "Best for finding specific concepts, technical content, or semantically relevant pages rather than exact-keyword matches.",
  ].join("\n"),
  inputSchema,
  outputSchema,
  async execute({ query, numResults = 10 }) {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error("EXA_API_KEY is not set. Add it to .env to enable Exa search.");
    }

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        numResults,
        useAutoprompt: true,
        type: "neural",
        contents: {
          text: {
            maxCharacters: 1000,
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Exa search failed: ${response.status} ${text}`);
    }

    const body = (await response.json()) as {
      results?: Array<{ title: string; url: string; text: string }>;
    };

    return {
      results: (body.results ?? []).map((result) => ({
        title: result.title,
        url: result.url,
        content: result.text,
      })),
    };
  },
});
