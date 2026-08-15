# Operations

## Development and verification

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm run info
pnpm lint
pnpm fmt
```

`pnpm run info` is the authoritative local read-back for the resolved agent. The
current expected result is one channel, 15 tools, and zero diagnostics.

Use `pnpm exec eve invoke "<instruction>"` for a focused end-to-end runtime check.
It starts a local server, creates a durable session, streams the result, and stops
the server.

## Provider verification

Documents and local environment files are leads, not live-system proof. Verify
provider claims with authenticated read-back:

- Agency Gateway: health endpoints, model catalog, and a focused completion when
  inference is required.
- Search: invoke each model-facing search tool through Eve.
- Messaging: inspect provider message records and delivery events. A provider's
  `accepted` or `sent` state does not prove handset or inbox receipt.

Do not duplicate a volatile model count in durable docs. Query the live gateway
when the count matters.

## Generated artifacts

| Path                   | Contents                                            |
| ---------------------- | --------------------------------------------------- |
| `.eve/compile/`        | Compiled manifest, module map, and compile metadata |
| `.eve/discovery/`      | Discovery manifest and diagnostics                  |
| `.eve/.workflow-data/` | Durable runs, steps, streams, events, and waits     |
| `.eve/logs/`           | Local runtime logs                                  |
| `.output/`             | Nitro server build                                  |

All are gitignored. Delete `.eve/` only when a clean recompile is intentionally
required; it also contains local durable workflow state.

## Framework fork synchronization

The owning fork is `jamesnavinhill/eve-source-code`, in the sibling
`../eve-source-code/` checkout. GitHub Actions runs the fork-owned
`eve-source-code/.github/workflows/sync-upstream.yml` four times daily to rebase
its `main` branch onto `vercel/eve:main`.

Repository Actions policy must allow GitHub-owned actions because the workflow
uses `actions/checkout`. Arbitrary third-party actions remain disallowed.

Refresh the local fork from this repo with:

```bash
pnpm sync
```

The script requires a clean `eve-source-code` checkout, fetches `origin/main`, and
hard-resets the local fork to that remote branch. Do not run it with uncommitted
fork work.

The `eve`, `technical-writing`, and `gh-pr-description` skill entries are symlinks
into the sibling fork and update immediately after the local refresh. This agent
repo does not synchronize framework source and does not need an upstream-sync
workflow.

## Deployment

The production deployment target is not yet selected. Vercel aligns with eve's
managed runtime, Workflow, deployment, and OIDC surfaces. Self-hosting keeps the
agent near the Agency Gateway but requires process supervision, TLS, durable
storage, and webhook operations.

Choose a target as part of the first feature that requires a public callback or
always-on execution, such as a bidirectional email channel or Google OAuth.
