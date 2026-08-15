import { defineTool } from "eve/tools";
import { executeSearch } from "../lib/search/execute";
import { firecrawlSearch } from "../lib/search/firecrawl";
import { searchInputSchema, searchOutputSchema } from "../lib/search/types";

export default defineTool({
  description:
    "Search the web using Firecrawl. Best when clean extracted page content is more useful than short snippets.",
  inputSchema: searchInputSchema,
  outputSchema: searchOutputSchema,
  execute: ({ query, maxResults }, ctx) =>
    executeSearch(firecrawlSearch, query, maxResults, ctx.abortSignal),
});
