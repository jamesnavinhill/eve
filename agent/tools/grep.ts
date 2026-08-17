import { defineGrepTool, defineTool } from "eve/tools";
import { executeGrep, grepInputSchema, grepOutputSchema } from "../lib/host-tools";

const description = [
  "Fast content search tool that works with any codebase size.",
  "",
  "Usage:",
  "- Searches file contents using regular expressions.",
  '- Supports full regex syntax (e.g. "log.*Error", "function\\s+\\w+").',
  '- Filter files by pattern with the glob parameter (e.g. "*.js", "*.{ts,tsx}").',
  "- Returns matching lines with file paths and line numbers.",
  "- Use this tool when you need to find files containing specific patterns.",
  "- Use the glob tool instead if you only need to find files by name.",
  "- Call this tool in parallel when you have multiple independent searches.",
  "- Any line longer than 2000 characters is truncated.",
].join("\n");

export default process.env.VERCEL === "1"
  ? defineGrepTool({ description })
  : defineTool({
      description,
      inputSchema: grepInputSchema,
      outputSchema: grepOutputSchema,
      execute: executeGrep,
    });
