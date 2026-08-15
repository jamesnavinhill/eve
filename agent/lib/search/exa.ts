import { z } from "zod";
import { requireOk, requireSearchApiKey } from "./execute";
import type { SearchProvider } from "./types";

const responseSchema = z.object({
  results: z.array(z.object({ title: z.string(), url: z.string(), text: z.string() })).default([]),
});

export const exaSearch: SearchProvider = {
  name: "Exa",
  async search(query, maxResults, signal) {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireSearchApiKey("EXA_API_KEY")}`,
      },
      body: JSON.stringify({
        query,
        numResults: maxResults,
        useAutoprompt: true,
        type: "neural",
        contents: { text: { maxCharacters: 1_000 } },
      }),
      signal,
    });
    await requireOk(response);
    const body = responseSchema.parse(await response.json());
    return {
      results: body.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.text,
      })),
    };
  },
};
