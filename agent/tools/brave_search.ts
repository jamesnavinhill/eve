import { defineTool } from "eve/tools";
import { braveSearch } from "../lib/search/brave";
import { executeSearch } from "../lib/search/execute";
import { searchInputSchema, searchOutputSchema } from "../lib/search/types";

export default defineTool({
  description: "Search the general web using Brave Search's independent index.",
  inputSchema: searchInputSchema,
  outputSchema: searchOutputSchema,
  execute: ({ query, maxResults }, ctx) =>
    executeSearch(braveSearch, query, maxResults, ctx.abortSignal),
});
