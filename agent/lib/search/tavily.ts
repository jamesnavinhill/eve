import { z } from "zod";
import { requireOk, requireSearchApiKey } from "./execute";
import type { SearchProvider } from "./types";

const responseSchema = z.object({
  answer: z.string().optional(),
  results: z
    .array(z.object({ title: z.string(), url: z.string(), content: z.string() }))
    .default([]),
});

export const tavilySearch: SearchProvider = {
  name: "Tavily",
  async search(query, maxResults, signal) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: requireSearchApiKey("TAVILY_API_KEY"),
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: maxResults,
      }),
      signal,
    });
    await requireOk(response);
    return responseSchema.parse(await response.json());
  },
};
