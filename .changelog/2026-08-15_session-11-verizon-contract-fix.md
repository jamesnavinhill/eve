# Session 11 — Verizon destination contract correction

## Source

Verizon's current official support page states that email-to-text uses a 10-digit
mobile number at `@vtext.com`, attachments use `@vzwpix.com`, and text email must
be no more than 160 characters including the recipient address and subject:

- https://www.verizon.com/support/text-messaging-faqs/

## Changed

- Corrected the local MMS destination from an unverified domain to Verizon's official `@vzwpix.com` gateway.
- Added destination validation so SMS requires `@vtext.com` and MMS requires `@vzwpix.com`.
- Added Verizon's documented 160-character total limit for email-to-text before transport execution.
- Corrected the previous changelog and documentation so provider acceptance is not described as handset delivery.

## Verified

- Eve sent one short SMS to the configured `@vtext.com` address; AgentMail returned an accepted message ID.
- Eve sent one PNG attachment to the configured `@vzwpix.com` address; AgentMail returned an accepted message ID.
- AgentMail message read-back returned HTTP 200 and showed both records labeled `sent`, with the expected destination domains; the MMS record had one attachment.
- These records prove provider acceptance, not handset receipt.
