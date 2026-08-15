import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadImageAttachments } from "../lib/messaging/attachments";
import { verizonDestination } from "../lib/messaging/config";
import { stableOperationId } from "../lib/messaging/operation";
import { resolveTransport } from "../lib/messaging/transport";

const inputSchema = z.strictObject({
  delivery: z.enum(["sms", "mms"]).describe("Send a text-only SMS or an MMS with images."),
  message: z.string().min(1).max(5_000).describe("Message to send to the owner."),
  subject: z.string().min(1).max(200).optional(),
  attachmentPaths: z
    .array(z.string().min(1))
    .max(3)
    .optional()
    .describe("Absolute local image paths to attach to an MMS."),
});

const outputSchema = z.strictObject({
  accepted: z.literal(true),
  provider: z.enum(["smtp", "resend", "agentmail"]),
  messageId: z.string(),
  delivery: z.enum(["sms", "mms"]),
});

export default defineTool({
  description: [
    "Send an outbound SMS or image MMS to Eve's owner through the configured email transport and Verizon destination.",
    "Use only when the owner requests a message or an owner-authorized workflow requires one.",
    "This tool cannot message arbitrary recipients. Never use it for bulk messaging.",
  ].join("\n"),
  inputSchema,
  outputSchema,
  async execute({ delivery, message, subject, attachmentPaths = [] }, ctx) {
    if (delivery === "sms" && attachmentPaths.length > 0) {
      throw new Error("Use MMS when sending image attachments");
    }
    if (delivery === "mms" && attachmentPaths.length === 0) {
      throw new Error("MMS requires at least one image attachment");
    }
    const attachments = await loadImageAttachments(attachmentPaths);
    const result = await resolveTransport().send(
      {
        to: verizonDestination(delivery),
        subject: subject ?? (delivery === "sms" ? "Eve" : "Eve MMS"),
        text: message,
        attachments,
        operationId: stableOperationId(ctx.callId),
      },
      ctx.abortSignal,
    );
    return { ...result, delivery };
  },
  toModelOutput(output) {
    return {
      type: "text" as const,
      value: `${output.delivery.toUpperCase()} accepted by ${output.provider} as ${output.messageId}.`,
    };
  },
});
