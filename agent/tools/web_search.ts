import { defineTool } from "eve/tools";
import { executeSearch } from "../lib/search/execute";
import { tavilySearch } from "../lib/search/tavily";
import { searchInputSchema, searchOutputSchema } from "../lib/search/types";

export default defineTool({
  description: [
    "Search the web using Tavily.",
    "",
    "Use this for current information, fact verification, documentation, and a concise synthesized answer.",
  ].join("\n"),
  inputSchema: searchInputSchema,
  outputSchema: searchOutputSchema,
  execute: ({ query, maxResults }, ctx) =>
    executeSearch(tavilySearch, query, maxResults, ctx.abortSignal),
});
