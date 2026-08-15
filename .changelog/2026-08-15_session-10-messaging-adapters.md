# Session 10 — search adapters and outbound messaging

## Changed

- Moved Tavily, Brave, Exa, and Firecrawl HTTP integrations behind a shared search contract while preserving four distinct model-facing tools.
- Standardized search input/result schemas, response validation, content bounds, cancellation, and safe provider errors.
- Added a provider-neutral `send_message` tool restricted to configured owner destinations.
- Added SMTP, Resend, and AgentMail email transport adapters plus separate Verizon SMS/MMS destination selection.
- Added bounded local image attachments for MMS and operation identifiers for retry safety.
- Namespaced the local SMTP variables and documented every messaging variable.
- Made proactive messaging the completed priority before voice work in the handoff.

## Verified

- `pnpm typecheck`
- `pnpm build`
- `pnpm run info`: zero diagnostics and 15 tools
- Real Eve runtime calls through Tavily, Brave, Exa, and Firecrawl all returned the official `https://github.com/vercel/eve` result.
- SMTP authentication succeeded against the configured server. Sending is blocked until a valid `SMTP_FROM_EMAIL` is configured; the SMTP username is not an email address.
- Live Resend domain read-back returned HTTP 200 with no verified domains, so no Resend send was attempted.
- Live AgentMail read-back returned HTTP 200 and confirmed the configured inbox.
- Eve sent a text message through `send_message`; AgentMail accepted it and its message API read-back showed the message with the `sent` label addressed to the configured Verizon text gateway.
- Eve sent a PNG image MMS through `send_message`; AgentMail returned an accepted SES message ID.

Handset receipt remains outside machine-verifiable provider read-back.
