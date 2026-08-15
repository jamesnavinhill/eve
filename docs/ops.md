# Operations

## Development

```bash
# Install dependencies
pnpm install

# Start dev TUI (interactive — talk to Eve directly)
pnpm exec eve dev

# Validate config (0 errors expected)
pnpm exec eve info

# Build to Nitro server
pnpm exec eve build

# Start production HTTP server (after build)
pnpm exec eve start

# Type-check
pnpm run typecheck
```

### When pnpm blocks on build scripts

If `pnpm run dev` fails with `ERR_PNPM_IGNORED_BUILDS`, either:

1. Run `pnpm approve-builds` and approve `@mongodb-js/zstd` + `node-liblzma`
2. Or bypass: `node_modules\.bin\eve.CMD dev`

The build-script approval only affects the sandbox's `just-bash` backend — all five tools and the model config work regardless.

## Testing the gateway connection

### Quick no-cost checks (no inference spend)

```bash
# Gateway reachable?
curl -s https://gateway.jami.studio/v1/health/liveliness -H "Authorization: Bearer $AGENCY_GATEWAY_API_KEY"

# Models list (191 expected)
curl -s https://gateway.jami.studio/v1/models -H "Authorization: Bearer $AGENCY_GATEWAY_API_KEY" | jq '.data | length'

# Free smoke model (mock response, zero cost)
curl -s https://gateway.jami.studio/v1/chat/completions \
  -H "Authorization: Bearer $AGENCY_GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"agency-smoke","messages":[{"role":"user","content":"hello"}]}'
```

### Through Eve

Ask Eve in the dev TUI:

- "Use the check_proxy_health tool and tell me what you see"
- "Use the generate_image tool to create a blue circle"
- "Use the web_search tool to find the latest news about Eve framework"
- "Use the bash tool to list the files in the current directory"

## Build artifacts

| Path       | What                                               |
| ---------- | -------------------------------------------------- |
| `.eve/`    | Compiled manifests, discovery, logs, workflow data |
| `.output/` | Nitro server output (from `eve build`)             |

Both are gitignored. Delete `.eve/` to force a full recompile.

## Upstream sync

The fork of `vercel/eve` lives in a sibling repo at `../eve-source-code/` (GitHub: `jamesnavinhill/eve-source-code`, a fork of `vercel/eve`). Sync it directly:

```sh
cd ../eve-source-code
git fetch upstream main
git merge upstream/main      # or: git rebase upstream/main
git push origin main
```

Or use GitHub's "Sync fork" button on the fork page.

This repo (`eve/`) is our agent project — it consumes the `eve` npm package, not the source tree. No in-repo sync workflow needed.

## Deployment

**Not yet decided.** Options:

| Target                 | Pros                                                  | Cons                                         |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------- |
| Vercel                 | Managed Workflow + Sandbox + Cron, OIDC auth built in | Need to add gateway key as Vercel env var    |
| Self-host (DO droplet) | Same machine as the gateway, full control             | Need to manage process supervisor, TLS, etc. |

See `docs/roadmaps/ROADMAP.md` for the phased plan.
