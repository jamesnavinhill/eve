import { defineBashTool, defineTool } from "eve/tools";
import { bashInputSchema, bashOutputSchema, executeBash } from "../lib/host-tools";

const description = "Execute a shell command in the shared workspace environment.";

export default process.env.VERCEL === "1"
  ? defineBashTool({ description })
  : defineTool({
      description,
      inputSchema: bashInputSchema,
      outputSchema: bashOutputSchema,
      execute: executeBash,
    });
