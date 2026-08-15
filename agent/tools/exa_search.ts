import { defineTool } from "eve/tools";
import { executeSearch } from "../lib/search/execute";
import { exaSearch } from "../lib/search/exa";
import { searchInputSchema, searchOutputSchema } from "../lib/search/types";

export default defineTool({
  description:
    "Search with Exa's neural index. Best for semantically relevant technical content and specific concepts.",
  inputSchema: searchInputSchema,
  outputSchema: searchOutputSchema,
  execute: ({ query, maxResults }, ctx) =>
    executeSearch(exaSearch, query, maxResults, ctx.abortSignal),
});
