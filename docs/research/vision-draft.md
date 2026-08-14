\# Vision Outline for Eve Project

> Updated 2026-08-13 — items marked ✅ are resolved, the rest are open for discussion.

## ✅ Set up the vercel eve agent framework with my proxy api

Done. Agency Gateway (LiteLLM) at `gateway.jami.studio/v1` wired into eve via `@ai-sdk/openai` `.chat()`. All three lanes (chat, image, audio) verified live. See `docs/architecture.md`.

## ✅ Map out each feature — potential solutions for each — decide if included

Done. See `docs/roadmaps/ROADMAP.md` — the feature map section covers all 10 eve capability slots with current status and next steps.

## Integrate existing working ElevenLabs + Anam as a Top-Layer agent

**Open — needs discussion.** This is the key architectural question for Phase 3.

The goal: an always-on voice/avatar agent that can converse **uninterrupted** by the background agents executing tasks underneath it. The voice layer should never block or be blocked by task execution.

**Key questions to resolve together (reviewing official ElevenLabs + EVE docs):**
- What is the voice agent really doing? Reading from what? Connected to what?
- How does it route to tools/subagents without blocking the conversation?
- What's the best way to expose the voice agent to the tools/subagents?
- Which provider offers what we need? (ElevenLabs Conversational AI? Anam avatar streaming? Both?)
- How do we avoid vendor lock-in (multiple providers, multiple accounts)?

**References:**
- `C:\Users\james\orgs\oss\avatar-agent` — dormant but working chat+video agent with ElevenLabs agent + Anam avatar
- `C:\Users\james\projects\gardens` — working ElevenLabs/Anam avatar with multiple account providers (key: multi-provider, multi-account)

## ✅ Always adaptable agnostic seams — no vendor lock-in

Principle established. The gateway tools use standard OpenAI-compatible endpoints. The model is a single `gateway.chat("alias")` string — swap providers by changing the alias. Voice integration will follow the same pattern (provider-agnostic seams).

## ✅ Source code for eve: forked, synced, referenced

Resolved. The fork lives at `../eve-source-code/` (sibling, VS Code workspace folder, GitHub: `jamesnavinhill/eve-source-code`, fork of `vercel/eve`). Sync via `git fetch upstream main && git merge upstream/main` or GitHub's "Sync fork" button. No in-repo sync workflow. Bundled eve docs at `node_modules/eve/docs/` are the authoritative version reference.

## ✅ How the repo works for agents — do I need more than one?

Resolved. See `docs/roadmaps/ROADMAP.md` "Answers to your questions" section:
- One root agent is the entry point
- Declared subagents (`agent/subagents/<name>/`) for specialists
- Remote agents (`defineRemoteAgent`) for separately deployed agents
- Vision: start with one root, add subagents as specialties emerge

I want to obv create my own github repo for this eve/ repo.. and want the forked code .. in a seperate repo.. it may be best to move source-code outside of eve, and then do a proper workspace file so we can have both withotu them beign nested.. ?

lets discuss.
