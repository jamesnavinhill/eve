# Eve

Eve is the studio's durable internal agent. This repository defines the agent;
it does not contain the eve framework or the Agency Gateway.

- [`eve`](https://github.com/jamesnavinhill/eve) — this agent project
- [`eve-source-code`](https://github.com/jamesnavinhill/eve-source-code) — sibling fork of `vercel/eve`
- [`agency`](https://github.com/studio-jami/agency) — sibling Agency Gateway configuration and operations

## Current state

Eve runs on `eve@0.37.0` and routes chat through the Agency Gateway's
`eve-orchestrator` alias with a 256K context window. The resolved agent has 15
tools, one HTTP channel, and no declared subagents, schedules, connections, or
agent-packaged skills.

The tool surface covers:

- host-native shell and filesystem access
- Tavily, Exa, Brave, and Firecrawl search behind shared adapters
- image generation, text-to-speech, and transcription through the gateway
- gateway health and session identity
- fixed-owner outbound SMS/MMS through swappable email transports

AgentMail provider acceptance is implemented but did not produce Verizon handset
delivery. A manual Gmail-to-Verizon test delivered. Resend and a bidirectional
Chat SDK email channel remain candidate work, pending verified domain and durable
state configuration.

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
