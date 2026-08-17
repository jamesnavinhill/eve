import { createPostgresState } from "@chat-adapter/state-pg";
import { createResendAdapter } from "@resend/chat-sdk-adapter";
import type { ResendRawMessage } from "@resend/chat-sdk-adapter";
import type { Message, Thread } from "chat";
import { chatSdkChannel, messageToUserContent } from "eve/channels/chat-sdk";
import type { SessionAuthContext } from "eve/context";
import { requireEnv } from "../lib/messaging/config";

const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || "luna@mail.navinhill.com";

function allowedSenders(): Set<string> {
  return new Set(
    requireEnv("LUNA_OWNER_EMAILS")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function ownerAuth(email: string): SessionAuthContext {
  return {
    authenticator: "resend-email",
    principalType: "user",
    principalId: email,
    attributes: { email },
  };
}

export const { bot, channel, send } = chatSdkChannel({
  userName: "Luna",
  adapters: {
    resend: createResendAdapter({
      fromAddress,
      fromName: "Luna",
    }),
  },
  state: createPostgresState({ keyPrefix: "luna-email" }),
  streaming: false,
  turnPolicy: "queue",
  concurrency: {
    strategy: "queue",
    maxQueueSize: 10,
    queueEntryTtlMs: 90_000,
    onQueueFull: "drop-oldest",
  },
});

async function receiveOwnerEmail(
  thread: Thread,
  message: Message<ResendRawMessage>,
): Promise<void> {
  if (message.author.isMe) return;

  const email = message.author.userId.trim().toLowerCase();
  if (!allowedSenders().has(email)) return;

  await thread.subscribe();
  await send(messageToUserContent(message), {
    thread,
    auth: ownerAuth(email),
    turnPolicy: "queue",
  });
}

bot.onNewMention(receiveOwnerEmail);
bot.onSubscribedMessage(receiveOwnerEmail);

export default channel;
