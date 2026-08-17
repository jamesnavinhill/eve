import { z } from "zod";
import { requireEnv } from "./config";
import type { EmailTransport } from "./types";

const responseSchema = z.object({ message_id: z.string() });

export const agentMailTransport: EmailTransport = {
  provider: "agentmail",
  async send(message, signal) {
    const inbox = encodeURIComponent(requireEnv("AGENTMAIL_EMAIL_ADDRESS"));
    const response = await fetch(`https://api.agentmail.to/v0/inboxes/${inbox}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("AGENTMAIL_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: [message.to],
        subject: message.subject,
        text: message.text,
        headers: { "X-Luna-Operation-Id": message.operationId },
        attachments: message.attachments.map((attachment) => ({
          filename: attachment.filename,
          content_type: attachment.contentType,
          content: attachment.content.toString("base64"),
        })),
      }),
      signal,
    });
    if (!response.ok) throw new Error(`AgentMail returned HTTP ${response.status}`);
    const body = responseSchema.parse(await response.json());
    return { accepted: true, provider: "agentmail", messageId: body.message_id };
  },
};
