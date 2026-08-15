---
title: Give your eve agent an email inbox with Resend
description: Connect an eve agent to email using the Chat SDK channel and the Resend adapter. Handle inbound email, threaded replies, attachments, and proactive sends.
url: /kb/guide/eve-agent-with-resend
canonical_url: "https://vercel.com/kb/guide/eve-agent-with-resend"
published: 2026-07-07
last_updated: 2026-08-13
authors: Ben Sabic
related:
  - /kb/guide/marketing-team-eve
install_vercel_plugin: npx plugins add vercel/vercel-plugin
---

Email is still where most support requests, notifications, and long-running conversations happen, but agents rarely live there. The [eve Chat SDK channel](https://eve.dev/docs/channels/chat-sdk) bridges your agent to any [Chat SDK](https://chat-sdk.dev/) adapter, and the [Resend adapter](https://resend.com/docs/chat-sdk) turns that bridge into a full email inbox. Users email your agent, eve runs the conversation as a durable session, and replies land back in the same thread as rich HTML emails.

In this guide, you'll add the Chat SDK channel with the Resend adapter to an eve agent, deploy it, and point a Resend inbound webhook at it.

By the end, your agent holds multi-turn email conversations with automatic threading, and you'll know how to send proactive emails and handle attachments.

**Try the Marketing Team Template**

Give your marketing team an email subagent with Resend.

[Learn more](https://vercel.com/templates/eve/eve-marketing-team)

## [Copy link to heading](#prerequisites)Prerequisites

Before you begin, make sure you have:

- An existing eve app or scaffold one with `npx eve@latest init`.
- Node.js 24 or newer.
- A [Vercel account](https://vercel.com/signup) and [Resend account](https://resend.com/).
- A Resend domain configured for [receiving emails](https://resend.com/docs/dashboard/receiving/introduction), you can use either the default `.resend.app` inbound address or a custom domain. Either way, it must support sending and receiving emails, so replies route back to your agent.

The fastest way to set up Resend is to install it from the [Vercel Marketplace](https://vercel.com/marketplace/resend). It connects your domain and adds `RESEND_API_KEY` to your project's environment variables in one flow. See Resend's [Vercel Marketplace integration guide](https://resend.com/docs/guides/vercel-marketplace-integration) for the dashboard and CLI steps.

## [Copy link to heading](#how-it-works)How it works

The Chat SDK channel splits responsibilities between two layers:

- The Resend adapter owns email delivery, webhook signature verification, and threading, which it resolves from the standard `Message-ID`, `In-Reply-To`, and `References` headers.
- eve owns session dispatch, state, and the model loop. You register handlers for inbound email and call `send` to hand each message to your agent as a session turn.

Email delivers one message per reply, so the channel runs with `streaming: false`. Instead of posting a message and editing it as tokens arrive, the reply posts once when the turn completes. The adapter renders the agent's markdown output as an HTML email through `@react-email/components`.

## [Copy link to heading](#steps)Steps

### [Copy link to heading](#1.-install-the-dependencies)1\. Install the dependencies

Install the Chat SDK core (`chat`), Resend adapter, and in-memory state adapter:

```bash
pnpm i chat @resend/chat-sdk-adapter @chat-adapter/state-memory
```

The in-memory state store is recommended only for development.

In production, use a durable state adapter (e.g., [Redis](https://chat-sdk.dev/adapters/official/redis)) so thread subscriptions and inbound deduplication survive restarts.

### [Copy link to heading](#2.-add-the-channel)2\. Add the channel

Create `agent/channels/resend.ts`. The file stem becomes the channel ID, and the module's default export registers the channel:

```typescript
import { createMemoryState } from "@chat-adapter/state-memory";
import { createResendAdapter } from "@resend/chat-sdk-adapter";
import type { Message, Thread } from "chat";
import { chatSdkChannel } from "eve/channels/chat-sdk";

export const { bot, channel, send } = chatSdkChannel({
  userName: "Support Agent",
  adapters: {
    resend: createResendAdapter({
      fromAddress: "agent@yourdomain.com",
      fromName: "Support Agent",
    }),
  },
  state: createMemoryState(),
  streaming: false,
});

bot.onNewMention(async (thread: Thread, message: Message) => {
  await thread.subscribe();
  await send(message.text, { thread });
});

bot.onSubscribedMessage(async (thread: Thread, message: Message) => {
  await send(message.text, { thread });
});

export default channel;
```

The two `bot` handlers cover the email lifecycle:

- `onNewMention`: Fires when a new inbound email starts a thread. Calling `thread.subscribe()` here keeps later replies in that thread flowing to the agent.
- `onSubscribedMessage`: Fires on each follow-up email in a subscribed thread.

Both handlers call `send`, which starts or resumes the eve session tied to that thread, so the agent keeps its conversation history across the whole exchange.

Set `fromAddress` to an address on your receiving domain. When users reply to the agent's emails, those replies are sent to your webhook, continuing the session.

The adapter reads its credentials from the `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` environment variables.

### [Copy link to heading](#3.-deploy-the-agent)3\. Deploy the agent

Deploy to production on Vercel:

```bash
eve deploy
```

`eve deploy` links the project if needed and deploys it. Each adapter mounts one `POST` route at `/eve/v1/{adapterName}`, so the `resend` adapter above is served at:

```text
https://your-app.vercel.app/eve/v1/resend
```

Note this URL for the next step.

If you need a different path, set `route` to change the base for every adapter:

```typescript
export const { bot, channel, send } = chatSdkChannel({
  userName: "Support Agent",
  adapters: {
    resend: createResendAdapter({ fromAddress: "agent@yourdomain.com" }),
  },
  state: createMemoryState(),
  streaming: false,
  route: "/webhooks", // resend now mounts at /webhooks/resend
});
```

You can also use `routes` when a specific adapter needs an exact URL, such as when you're migrating an existing endpoint without changing your provider settings:

```typescript
routes: { resend: "/webhooks/inbound-email" }, // mounts at exactly this path
```

### [Copy link to heading](#4.-configure-the-resend-webhook)4\. Configure the Resend webhook

Point Resend's inbound events at your deployed channel:

1. Visit the [Webhooks page](https://resend.com/webhooks) in the Resend dashboard and click Add Webhook.
2. Set the endpoint URL to `https://your-app.vercel.app/eve/v1/resend`.
3. Select the `email.received` event and click Add.
4. Copy the Signing Secret after your webhook is generated.

Then add the environment variables to your Vercel project, either in your [project settings](https://vercel.com/d?to=%2F%5Bteam%5D%2F%5Bproject%5D%2Fsettings%2Fenvironment-variables) or with the CLI. If you installed Resend from the Vercel Marketplace, `RESEND_API_KEY` is already set, so you only need the webhook secret:

```bash
vercel env add RESEND_API_KEY  # skip if installed from the Vercel Marketplace
vercel env add RESEND_WEBHOOK_SECRET
```

Redeploy with `eve deploy` so the new variables take effect. The adapter verifies every inbound webhook signature before the event reaches your handlers, so unsigned or spoofed requests never start a session.

### [Copy link to heading](#5.-test-the-conversation)5\. Test the conversation

Send an email to your Resend inbound address (e.g., `agent@yourdomain.com` or `anything@your-id.resend.app`). Within a few seconds, you should receive an HTML reply from your agent.

Reply to that email to confirm threading works. The follow-up should continue the same conversation, with the agent aware of the earlier messages. You can inspect each inbound event and delivery on the [Resend Webhooks page](https://resend.com/webhooks), and each session in the eve dev TUI by pointing it at your deployment:

```bash
npx eve dev https://your-app.vercel.app
```

## [Copy link to heading](#send-proactive-emails)Send proactive emails

The agent doesn't have to wait for inbound mail.

`channel.receive` starts a session without a webhook, which is useful from a schedule handler or another channel. Pass a `target` with the adapter name and a thread ID built from the recipient's address, using the adapter's `resend:{email}` format:

```typescript
await channel.receive({
  message: "Your weekly digest is ready.",
  target: { adapterName: "resend", threadId: "resend:user@example.com" },
  auth: null,
});
```

eve runs the turn and the default delivery handlers post the result as a new email thread to that address.

## [Copy link to heading](#handle-attachments)Handle attachments

Inbound attachments arrive as URLs on the Chat SDK message.

Convert the message with `messageToUserContent` before calling `send`, and eve forwards each attachment to the model as a file part:

```typescript
import { messageToUserContent } from "eve/channels/chat-sdk";

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await send(messageToUserContent(message), { thread });
});
```

When a message has no attachments, `messageToUserContent` returns the plain text, so you can use it unconditionally.

## [Copy link to heading](#best-practices)Best practices

- Use a durable state store in production: `createMemoryState()` loses thread subscriptions on every restart, which breaks multi-turn threading. Swap in a [Postgres](https://chat-sdk.dev/adapters/official/postgres) or [Redis](https://chat-sdk.dev/adapters/official/redis) state adapter before sharing your agent.
- Expect email's one-shot limitations: email has no typing indicators, message edits, or reactions. The Resend adapter throws `NotImplementedError` for these operations, and the channel swallows those errors automatically, so you don't need to guard for them in your handlers.
- Keep the reply address on your receiving domain: if `fromAddress` is on a send-only domain, replies never reach your webhook, and every email is a dead end.

## [Copy link to heading](#troubleshooting)Troubleshooting

### [Copy link to heading](#the-agent-never-replies)The agent never replies

Confirm the webhook endpoint URL matches your deployed route exactly, including the `/eve/v1/resend` path, and that the `email.received` event is selected. Resend's Webhooks page shows each delivery attempt and its response status, and lets you replay individual events after fixing the endpoint.

### [Copy link to heading](#webhook-deliveries-fail-with-a-signature-error)Webhook deliveries fail with a signature error

The `RESEND_WEBHOOK_SECRET` in your Vercel project must match the signing secret for this specific webhook. Secrets are per-webhook, so if you recreated the webhook, update the environment variable and redeploy.

### [Copy link to heading](#replies-don't-continue-the-conversation)Replies don't continue the conversation

Check that your handler calls `thread.subscribe()` in `onNewMention`. Without a subscription, follow-up emails never reach `onSubscribedMessage`. If subscriptions look correct but stop working after deploys, you're likely losing them to the in-memory state store; move to a durable adapter.

## [Copy link to heading](#resources-and-next-steps)Resources and next steps

- [Chat SDK channel](https://eve.dev/docs/channels/chat-sdk): the full reference, including custom `events` and HITL options
- [Channels overview](https://eve.dev/docs/channels/overview): the channel contract and every built-in eve channel
- [Resend adapter](https://resend.com/docs/chat-sdk): cards, `openDM`, and adapter configuration
- [Receiving emails with Resend](https://resend.com/docs/dashboard/receiving/introduction): inbound domains, webhooks, and more
- [Run a marketing team from Slack with eve](https://vercel.com/kb/guide/marketing-team-eve)

**Deploy your own software factory with eve**

Ship a software factory with Foreman, an open-source template that helps maintain your projects with four built-in agents.

[Learn more](https://ask-foreman.dev/)