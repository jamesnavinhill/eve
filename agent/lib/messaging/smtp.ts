import nodemailer from "nodemailer";
import { requireEnv } from "./config";
import type { EmailTransport } from "./types";

export const smtpTransport: EmailTransport = {
  provider: "smtp",
  async send(message) {
    const port = Number.parseInt(requireEnv("SMTP_PORT"), 10);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("SMTP_PORT must be a valid TCP port");
    }
    const user = requireEnv("SMTP_USER");
    const transporter = nodemailer.createTransport({
      host: requireEnv("SMTP_HOST"),
      port,
      secure: port === 465,
      auth: { user, pass: requireEnv("SMTP_PASSWORD") },
    });
    const result = await transporter.sendMail({
      from: requireEnv("SMTP_FROM_EMAIL"),
      to: message.to,
      subject: message.subject,
      text: message.text,
      attachments: message.attachments,
      messageId: `<${message.operationId}@eve.local>`,
    });
    return { accepted: true, provider: "smtp", messageId: result.messageId };
  },
};
