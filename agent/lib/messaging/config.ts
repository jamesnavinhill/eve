import type { Delivery, EmailProvider } from "./types";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function configuredProvider(): EmailProvider {
  const value = requireEnv("OUTBOUND_EMAIL_PROVIDER");
  if (value === "smtp" || value === "resend" || value === "agentmail") return value;
  throw new Error("OUTBOUND_EMAIL_PROVIDER must be smtp, resend, or agentmail");
}

const verizonDestinations = {
  sms: { variable: "VERIZON_TEXT_USER_EMAIL", domain: "@vtext.com" },
  mms: { variable: "VERIZON_MMS_USER_EMAIL", domain: "@vzwpix.com" },
} as const;

export function verizonDestination(delivery: Delivery): string {
  const { variable, domain } = verizonDestinations[delivery];
  const value = requireEnv(variable);
  if (!value.toLowerCase().endsWith(domain)) {
    throw new Error(`${variable} must end with ${domain}`);
  }
  return value;
}
