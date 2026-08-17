# Context-pool indexer — 2026-08-16

## What this is

A TypeScript port of the agency context-pool indexer
(`agency/scripts/context_index.py`), adapted to luna's TypeScript codebase.
Two disposable, regenerable artifacts live under `.tmp/context-pools/`:

1. `repo_map.txt` — tree-sitter skeletons of every tracked `.ts`/`.tsx` file.
2. `lance/code_chunks.lance` — a LanceDB table of one row per extracted symbol,
   embedded into 1024-dim vectors via the Agency Gateway's `agency-embed-code`
   route (Voyage `voyage-code-3`, funded by MongoDB Atlas Model API credits).

The map answers "what exists"; the LanceDB table answers "where is X" via
semantic query. Both caches are gitignored and disposable — delete `.tmp/`
and rerun `pnpm index` for an identical result.

## Why this shape (design choices, not agency verbatim)

- **TypeScript, not Python.** Agency's indexer is Python because agency is a
  Python project. Porting Python tree-sitter tooling into a Node repo just to
  reuse the same script would be the opposite of untarding — the tree-sitter
  map only earns its keep if it maps THIS repo in THIS repo's language.
  Node-native bindings (`@lancedb/lancedb`, `web-tree-sitter`) cover the same
  surface without a foreign toolchain.
- **Embeddings reuse agency's gateway routes.** Luna is a *client* of the
  gateway, not its operator. Declaring luna-specific `luna-embed-*` routes in
  `agency/config/litellm/config.yaml` would touch the live gateway — outside
  the "luna only" scope of this slice. The `agency-embed-code` route is already
  live and funded by the Atlas credits; luna's indexer simply calls it with its
  own `AGENCY_GATEWAY_API_KEY`.
- **No new env var.** `AGENCY_GATEWAY_API_KEY` and `AGENCY_GATEWAY_BASE_URL`
  are already documented in `.env.example`; the indexer reads them. The
  server-side Atlas credentials (`MONGODB_MODEL_API_KEY`) stay owned by the
  agency repo. Luna never sees them.

## What was ported

| Concern | Agency (Python) | Luna (TypeScript) |
|---|---|---|
| Tree-sitter grammar | `tree_sitter_language_pack.get_parser("python")` | `web-tree-sitter` + `@vscode/tree-sitter-wasm` prebuilt TS/TSX wams |
| File enumeration | `git.Repo.git.ls_files("*.py")` | `git ls-files "*.ts" "*.tsx"` via `child_process` |
| Symbol extraction | module-level functions/classes + methods | module-level functions/classes/`const` exports + `export default <expr>` (calls/identifiers/ternaries) |
| Storage | `lancedb.connect()` + `.open_table()` | `@lancedb/lancedb.connect()` + `.openTable()` |
| Embeddings auth | `Bearer $AGENCY_DO_MASTER_KEY` | `Bearer $AGENCY_GATEWAY_API_KEY` |
| Incremental gating | git blob hash manifest | same |

## Gotchas hit + how they were fixed

1. **`tree-sitter-wasms` package does NOT load.** Its wams are in a different
   ESM/dylink format that `web-tree-sitter` v0.26's `Language.load` rejects
   with an empty `Error` from `getDylinkMetadata`. **Fix:** switched to
   `@vscode/tree-sitter-wasm` (the wams VS Code itself uses; prebuilt by
   Microsoft in the web-tree-sitter-0.26-compatible dylink format). See README's
   `Generating .wasm files` section — the canonical way is
   `npx tree-sitter build --wasm`, but `@vscode/tree-sitter-wasm` ships them.
2. **Path resolution.** `new URL("node_modules/...", import.meta.url)` resolves
   relative to the *script's* directory, not the repo root. Used
   `ROOT_URL = new URL("..", import.meta.url)` then composed from there.
3. **Dynamic import order.** The original sketch had top-level
   `await import("web-tree-sitter")` at module load. A rejection there bypassed
   `main()`'s try/catch and exited silently. Moved imports inside the run
   functions so errors surface with a stack.
4. **`ERR_PNPM_IGNORED_BUILDS` aborting `pnpm index`.** Adding `@lancedb/lancedb`
   pulled optional `@huggingface/transformers` deps (`onnxruntime-node`,
   `protobufjs`, `sharp`) with unapproved build scripts; pnpm 11 treated that
   as a non-zero exit that aborted any `pnpm <script>` preflight. These are
   not on luna's runtime path (luna embeds via the gateway, not local
   models). Set `allowBuilds: { ...: false }` in `pnpm-workspace.yaml` —
   resolving placeholders left by a prior session.
5. **win32 native teardown crash.** `@lancedb/lancedb`'s native binding trips a
   libuv `!(handle->flags & UV_HANDLE_CLOSING)` assertion during Node's
   atexit teardown, AFTER all output has flushed. The indexer's work completes
   correctly; the crash is cosmetic. The public API has no `.close()` to
   pre-call. **Workaround:** `pnpm index` runs through `scripts/index.mjs`,
   which detects exit code `0xC0000409` (the assertion-hard-crash signature)
   and exits 0. Any other non-zero propagates.

## Live verification (2026-08-16)

- `pnpm index --map-only` → 36 files, 86 symbols, 0.2s.
- `pnpm index` (full, embeddings authorized this session) → 86 chunks
  embedded, 2 batches at the gateway's Voyage route, 23.5s. LanceDB table
  created at `.tmp/context-pools/lance/code_chunks.lance`, 1024-dim vectors.
- `pnpm index --query "how does the agent authenticate with the gateway"` →
  top hit `gatewayAuthHeaders` (0.649), then `ownerAuth`, `gateway` client
  construction, `checkProxyHealth` tool. Correct semantic matches.
- `pnpm index --stats` → manifest 36 files, repo map 8422 bytes, 86 rows.

## Usage

```bash
pnpm install
pnpm index            # incremental map + embeddings (embeds only changed files)
pnpm index --map-only # skeletons only, no embedding spend
pnpm index --query "where are virtual keys minted?"
pnpm index --stats
```

Rate budget: the Voyage route is free-tier-pinned (3 RPM / 10K TPM). The
indexer paces batches (`BATCH_INTERVAL_S = 21s`). A full first index of luna
(86 chunks) cost two batches and finished in ~24s; a `--query` spends one
embedding for the query vector.

## Alternative evaluated: wonk

[wonk](https://github.com/coder/wonk) (coder/wonk) was evaluated as a possible
drop-in code-indexing daemon for this repo. Verdict: **not viable on native
Windows** for luna's use case.

- Single Rust binary, POSIX-only. The `fork` crate in `daemon.rs` is ungated
  (no Windows path), `home_dir` is `$HOME`-only, and there is no Windows
  release binary on the releases page. `install.sh` rejects Windows outright.
- Embeddings are Ollama-only. The product spec (`specs/product_specs.md`
  §3.32) explicitly scopes Voyage AI / OpenAI-compatible providers as
  out-of-scope. wonk's roadmap V5 "BundledProvider" milestone — which would
  add OpenAI-compatible embedding backends — is not started.
- Maturity: 10 stars, 2 contributors, no packaged Windows artifact.

Recorded as a rerun candidate if (a) luna's indexing moves to a WSL/Linux
host, or (b) wonk ships a Windows binary plus an OpenAI-compatible embedding
backend. Until then the in-repo TS indexer + gateway Voyage route is the
correct path: it runs on the same Windows host as the agent, reuses the
authorized gateway credits, and has no extra daemon surface.
