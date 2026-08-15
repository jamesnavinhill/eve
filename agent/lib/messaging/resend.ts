import { z } from "zod";
import { requireEnv } from "./config";
import type { EmailTransport } from "./types";

const responseSchema = z.object({ id: z.string() });

export const resendTransport: EmailTransport = {
  provider: "resend",
  async send(message, signal) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.operationId,
      },
      body: JSON.stringify({
        from: requireEnv("RESEND_FROM_EMAIL"),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        attachments: message.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content.toString("base64"),
          content_type: attachment.contentType,
        })),
      }),
      signal,
    });
    if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
    const body = responseSchema.parse(await response.json());
    return { accepted: true, provider: "resend", messageId: body.id };
  },
};
