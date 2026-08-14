import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Returns the currently signed-in user or session principal. Call this once at the start of a conversation when you need to know who you're talking to.",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    const { auth } = ctx.session;
    if (auth.current === null) {
      return { signedIn: false };
    }
    return {
      signedIn: true,
      principalType: auth.current.principalType,
      principalId: auth.current.principalId,
      authenticator: auth.current.authenticator,
      attributes: auth.current.attributes,
    };
  },
});
