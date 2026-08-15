import { agentMailTransport } from "./agentmail";
import { configuredProvider } from "./config";
import { resendTransport } from "./resend";
import { smtpTransport } from "./smtp";
import type { EmailTransport } from "./types";

const transports: Record<string, EmailTransport> = {
  agentmail: agentMailTransport,
  resend: resendTransport,
  smtp: smtpTransport,
};

export function resolveTransport(): EmailTransport {
  return transports[configuredProvider()] as EmailTransport;
}
