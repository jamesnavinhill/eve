# Session 8 — 2026-08-15

## What changed

### Wired up web search via Tavily

Eve's built-in web search is provider-managed and only supports Exa or Parallel out of the box. Since Tavily is purpose-built for AI agent search (with a free tier), we overrode `agent/tools/web_search.ts` with a custom Tavily implementation.

- `agent/tools/web_search.ts`:
  - Accepts `query` and optional `maxResults` (1–20, default 5).
  - Calls `POST https://api.tavily.com/search` with `search_depth: "basic"` and `include_answer: true`.
  - Returns a synthesized `answer` plus individual `results` with `title`, `url`, and `content` snippets.
  - Fails with a clear error if `TAVILY_API_KEY` is not configured.
- Updated `.env.example` with `TAVILY_API_KEY=`.

## Built-in options considered

| Option | Notes |
| ------ | ----- |
| `eve/tools` `webSearch({ provider: "exa" })` | Native Exa integration; requires `EXA_API_KEY`. |
| `eve/tools` `webSearch({ provider: "parallel" })` | Native Parallel integration; requires Parallel API key. |
| Custom Tavily tool | Better agent-native results format; what we shipped. |
| Custom Brave / Firecrawl tool | Possible later if Tavily limits become an issue. |

## Verified

- `pnpm typecheck` — PASS
- `pnpm lint` — PASS
- `pnpm fmt` — PASS
- `pnpm build` — PASS
- Live smoke test skipped because `TAVILY_API_KEY` is not set in `.env`. Once the key is added, the agent can call `web_search` directly.
