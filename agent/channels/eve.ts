import { eveChannel } from "eve/channels/eve";
import { httpBasic, localDev, vercelOidc } from "eve/channels/auth";

function ownerAuth() {
  const password = process.env.LUNA_HTTP_PASSWORD?.trim();
  if (!password) return null;
  return httpBasic(
    { username: process.env.LUNA_HTTP_USERNAME?.trim() || "luna", password },
    { realm: "Luna" },
  );
}

// The eve HTTP channel — the default API surface for sessions, streaming,
// and tools. Auth is the ordered walk: vercelOidc() for Vercel-internal calls,
// localDev() for development. Production browser traffic is rejected (401)
// until you add an authenticator for your users (e.g. your app's session/JWT).
const basicAuth = ownerAuth();

export default eveChannel({
  auth: [vercelOidc(), ...(basicAuth ? [basicAuth] : []), localDev()],
  // Enable CORS for browser clients when you add a frontend. Narrow origins
  // for production. Leave disabled for CLI/API-only access.
  // cors: { origin: "http://localhost:3000" },
});
