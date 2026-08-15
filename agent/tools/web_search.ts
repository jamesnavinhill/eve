import { defineTool } from "eve/tools";
import { z } from "zod";

const inputSchema = z.strictObject({
  query: z.string().describe("The search query."),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .describe("Maximum number of results to return. Defaults to 5.")
    .optional(),
});

const outputSchema = z.strictObject({
  answer: z
    .string()
    .describe("Concise answer synthesized from the search results, if available.")
    .optional(),
  results: z
    .array(
      z.strictObject({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      }),
    )
    .describe("Individual search results with title, URL, and content snippet."),
});

export default defineTool({
  description: [
    "Search the web using Tavily.",
    "",
    "Use this tool to find current information, verify facts, discover documentation,",
    "or gather context that is not already in the conversation.",
  ].join("\n"),
  inputSchema,
  outputSchema,
  async execute({ query, maxResults = 5 }) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY is not set. Add it to .env to enable web search.");
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Tavily search failed: ${response.status} ${text}`);
    }

    const body = (await response.json()) as {
      answer?: string;
      results?: Array<{ title: string; url: string; content: string }>;
    };

    return {
      answer: body.answer,
      results: body.results ?? [],
    };
  },
});
