export type Delivery = "sms" | "mms";
export type EmailProvider = "smtp" | "resend" | "agentmail";

export interface MessageAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  attachments: MessageAttachment[];
  operationId: string;
}

export interface SendResult {
  accepted: true;
  provider: EmailProvider;
  messageId: string;
}

export interface EmailTransport {
  readonly provider: EmailProvider;
  send(message: OutboundEmail, signal?: AbortSignal): Promise<SendResult>;
}
