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

export function verizonDestination(delivery: Delivery): string {
  return requireEnv(delivery === "sms" ? "VERIZON_TEXT_USER_EMAIL" : "VERIZON_MMS_USER_EMAIL");
}
