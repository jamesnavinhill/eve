# Session 13 — 2026-08-15

## What changed

No repo changes. Live audit of navinhill.com DNS and email configuration,
triggered by the failed Resend integration (see session on outbound messaging
adapters). All findings below are live-probed, not document-derived.

## Findings

- **navinhill.com is not on Cloudflare DNS.** The .com registry delegates to
  `ns1/ns2.vercel-dns.com` (switched ~Aug 4–5, 2026, likely when the site was
  attached to a Vercel project). The Cloudflare zone
  (`1d561b7ab18fb22c3ecf01acc2210788`, created Jul 21) still reports "active"
  but is not authoritative — its records are invisible to the public.
- **Email is dark.** The authoritative Vercel zone carries no MX, SPF, DKIM, or
  DMARC — only a `*.navinhill.com` wildcard to Vercel anycast. Zoho receiving
  for @navinhill.com has been broken since the delegation switch.
- **Resend footprint identified in the Cloudflare zone** (added for sending
  domain `mail.navinhill.com`, inert): TXT `resend._domainkey.mail` (DKIM),
  TXT `send.mail` (`v=spf1 include:amazonses.com ~all`), MX `mail` →
  `inbound-smtp.us-east-1.amazonaws.com`.
- **Other email defects in the Cloudflare zone**: duplicate DMARC records at
  `_dmarc` (RFC-invalid, DMARC ignored); SPF carries a leftover
  `include:_spf-us.ionos.com`; Zoho DKIM (`zmail._domainkey`) missing; apex A
  is Cloudflare-proxied, which would break the Vercel-hosted site if
  delegation returned without a DNS-only A swap.
- **Zoho official values verified**: MX 10/20/50 → mx/mx2/mx3.zoho.com; SPF
  `v=spf1 include:zohomail.com -all`; DKIM TXT at `<selector>._domainkey`.

## Access blockers (why deletions did not run in-session)

- Env `CLOUDFLARE_API_TOKEN` (cfat_…) returns "Invalid API Token" — dead.
- Valid `cfut_` token is R2-scoped (zero zone visibility).
- Wrangler OAuth token (refreshed, zone:read + email_routing:write) lacks
  `dns_records` read/write and cannot mint API tokens.

## Verified

- Registry delegation via .com TLD server; zone contents via direct queries to
  authoritative NS (198.51.44.13) and Cloudflare assigned NS (108.162.195.228).
- Cloudflare zone detail + Email Routing status (disabled/unconfigured) via API.
- Vercel: domain not visible under studio-jami team or CLI personal scope;
  neither local Vercel token can manage the Vercel-side zone.

## Next (owner actions)

1. Create Cloudflare API token with Zone → DNS → Edit scoped to navinhill.com
   (or dashboard); delete the three Resend records; fix DMARC duplication,
   SPF include, apex A (DNS-only 64.29.17.1 / 216.198.79.1).
2. Generate Zoho DKIM key in Zoho admin console; publish as TXT.
3. Point IONOS nameservers back to `elliott`/`irena.ns.cloudflare.com`, then
   re-verify MX/SPF/DKIM/DMARC and site reachability live.
