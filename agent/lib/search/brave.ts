import { z } from "zod";
import { requireOk, requireSearchApiKey } from "./execute";
import type { SearchProvider } from "./types";

const responseSchema = z.object({
  web: z
    .object({
      results: z
        .array(z.object({ title: z.string(), url: z.string(), description: z.string() }))
        .default([]),
    })
    .optional(),
});

export const braveSearch: SearchProvider = {
  name: "Brave",
  async search(query, maxResults, signal) {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": requireSearchApiKey("BRAVE_API_KEY"),
      },
      signal,
    });
    await requireOk(response);
    const body = responseSchema.parse(await response.json());
    return {
      results: (body.web?.results ?? []).map((result) => ({
        title: result.title,
        url: result.url,
        content: result.description,
      })),
    };
  },
};
