import type { SearchOutput, SearchProvider } from "./types";

const MAX_CONTENT_CHARS = 4_000;

export async function executeSearch(
  provider: SearchProvider,
  query: string,
  maxResults = 10,
  signal?: AbortSignal,
): Promise<SearchOutput> {
  try {
    const output = await provider.search(query, maxResults, signal);
    return {
      answer: output.answer,
      results: output.results.slice(0, maxResults).map((result) => ({
        ...result,
        content:
          result.content.length > MAX_CONTENT_CHARS
            ? `${result.content.slice(0, MAX_CONTENT_CHARS)}…`
            : result.content,
      })),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(`${provider.name} search failed: ${message}`);
  }
}

export function requireSearchApiKey(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function requireOk(response: Response): Promise<void> {
  if (!response.ok) throw new Error(`provider returned HTTP ${response.status}`);
}
