import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

// The eve HTTP channel — the default API surface for sessions, streaming,
// and tools. Auth is the ordered walk: vercelOidc() for Vercel-internal calls,
// localDev() for development. Production browser traffic is rejected (401)
// until you add an authenticator for your users (e.g. your app's session/JWT).
export default eveChannel({
  auth: [vercelOidc(), localDev()],
  // Enable CORS for browser clients when you add a frontend. Narrow origins
  // for production. Leave disabled for CLI/API-only access.
  // cors: { origin: "http://localhost:3000" },
});
