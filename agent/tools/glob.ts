import { defineTool } from "eve/tools";
import { executeGlob, globInputSchema, globOutputSchema } from "../lib/host-tools";

export default defineTool({
  description: [
    "Fast file pattern matching tool that works with any codebase size.",
    "",
    "Usage:",
    '- Supports glob patterns like "**/*.js" or "src/**/*.ts".',
    "- Returns matching file paths.",
    "- Use this tool when you need to find files by name patterns.",
    "- If you are unsure of the correct file path, use the glob tool to look up filenames by glob pattern.",
    "- Use the grep tool instead if you need to search file contents.",
    "- Call this tool in parallel when you know there are multiple patterns to search for.",
  ].join("\n"),
  inputSchema: globInputSchema,
  outputSchema: globOutputSchema,
  execute: executeGlob,
});
