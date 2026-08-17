# Luna

Luna is the studio's durable internal agent. This repository defines the agent;
it does not contain the eve framework or the Agency Gateway.

- [`luna`](https://github.com/jamesnavinhill/luna) — this agent project
- [`eve-source-code`](https://github.com/jamesnavinhill/eve-source-code) — sibling fork of `vercel/eve`
- [`agency`](https://github.com/studio-jami/agency) — sibling Agency Gateway configuration and operations

## Current state

Luna runs on `eve@0.38.3` and routes chat through the Agency Gateway's
`eve-orchestrator` alias with a 256K context window. The resolved agent has 15
 tools, the eve HTTP and Resend email channels, one daily schedule, and no
 declared subagents, connections, or agent-packaged skills.

The tool surface covers:

- host-native shell and filesystem access
- Tavily, Exa, Brave, and Firecrawl search behind shared adapters
- image generation, text-to-speech, and transcription through the gateway
- gateway health and session identity
- fixed-owner outbound SMS/MMS through swappable email transports

Resend sending and receiving are verified for `mail.navinhill.com`. Luna's email
channel uses the official Resend Chat SDK adapter with durable Chat SDK state in
Neon Postgres. AgentMail remains only as cutover evidence: provider acceptance did
not produce Verizon handset delivery.

## Run and verify

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm run info
pnpm lint
pnpm fmt
```

Run `pnpm sync` to fast-forward the clean local `eve-source-code` checkout to its
GitHub fork. Framework skills linked from that sibling repo update automatically.

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration](docs/config.md)
- [Operations](docs/ops.md)
- [Security](docs/security.md)
- [Roadmap](docs/roadmaps/ROADMAP.md)
- [Current handoff](docs/research/handoff-2026-08-15.md)
- [Project standards](docs/standards/README.md)

See [AGENTS.md](AGENTS.md) for repository workflow and source-of-truth rules.

## Luna Workspace

luna: Canon repo for the Luna project
C:/Users/james/projects/luna
<https://github.com/jamesnavinhill/luna>
<https://luna.navinhill.com/>

eve-source-code: Synced fork of 'Luna's" upstream source code from Vercel
C:/Users/james/projects/eve-source-code
<https://github.com/jamesnavinhill/eve-source-code>

agency: Local + Deployed LiteLLM proxy API Gateway
C:/Users/james/projects/agency
<https://github.com/studio-jami/agency>
<https://gateway.jami.studio/v1>

insights: Agency Model Benchmarks & Quota Tracker
C:/Users/james/projects/insights
<https://github.com/jamesnavinhill/insights.git>
<https://insights.jami.studio/>

elements: Prototype UI design shells for Luna
C:/Users/james/projects/elements
<https://github.com/jamesnavinhill/elements>

avatar-agent: Live working chat/video avatar project for Luna reference
C:/Users/james/orgs/oss/avatar-agent
<https://github.com/studio-jami/avatar-agent>
<https://avatar.jami.studio/>
