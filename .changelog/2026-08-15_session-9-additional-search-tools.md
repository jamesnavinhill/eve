# Session 9 — 2026-08-15

## What changed

### Added Exa, Brave, and Firecrawl search tools

Building on the Tavily `web_search` tool, we now expose one tool per search provider so subagents can pick the backend that fits the task.

- `agent/tools/exa_search.ts` — Exa neural/semantic search. Requests up to 1000 characters of text per result.
- `agent/tools/brave_search.ts` — Brave Search, privacy-focused general web search.
- `agent/tools/firecrawl_search.ts` — Firecrawl real-time web search with structured markdown extraction; caps each result at 4000 characters.
- `.env.example` — added `EXA_API_KEY=`, `BRAVE_API_KEY=`, and `FIRECRAWL_API_KEY=`.

## Available search tools

| Tool               | Provider  | Best for                                                 |
| ------------------ | --------- | -------------------------------------------------------- |
| `web_search`       | Tavily    | Fast AI-native search with a synthesized answer.         |
| `exa_search`       | Exa       | Semantic/neural search and technical content retrieval.  |
| `brave_search`     | Brave     | Privacy-focused general web search.                      |
| `firecrawl_search` | Firecrawl | Real-time search with clean, extracted markdown content. |

## Verified

- `pnpm typecheck` — PASS
- `pnpm lint` — PASS
- `pnpm fmt` — PASS
- `pnpm build` — PASS
- `pnpm dev` live smoke tests:
  - `exa_search` returned 10 neural results with full text snippets about Exa AI.
  - `brave_search` returned 10 Brave Search results with descriptions.
  - `firecrawl_search` returned structured markdown results about Firecrawl.
