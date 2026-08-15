import { defineTool } from "eve/tools";
import { bashInputSchema, bashOutputSchema, executeBash } from "../lib/host-tools";

export default defineTool({
  description: "Execute a shell command in the shared workspace environment.",
  inputSchema: bashInputSchema,
  outputSchema: bashOutputSchema,
  execute: executeBash,
});
