# Session 12 — documentation refresh and framework fork sync

## Changed

- Added a root README and refreshed architecture, configuration, operations, security, roadmap, and handoff documentation against current source and generated agent discovery.
- Made the symlinked technical-writing skill the documentation workflow authority and documented project-specific standard overlays.
- Marked historical design notes and upstream Chat SDK/Resend snapshots so they cannot be mistaken for shipped state.
- Corrected stale tool counts, model-routing status, context-window examples, build-script configuration, and provider-delivery claims.
- Documented the ownership boundary among `eve`, `eve-source-code`, and `agency`, including the framework-skill symlink chain.

## Framework fork

- Fast-forwarded the clean local `eve-source-code` checkout to the manual upstream merge already on `origin/main`.
- Verified that the fork contains the current `vercel/eve:main` ancestry.
- Found the scheduled sync root cause in live GitHub Actions state: repository policy allowed only local actions, so `actions/checkout@v4` failed before job startup.
- Changed repository Actions policy to selected actions with GitHub-owned actions allowed and arbitrary verified/third-party actions disallowed.
- Manually dispatched `sync-upstream.yml`; run `31875174237` completed successfully.
- Ran `pnpm sync` and verified all three framework skill symlinks resolve against the clean sibling checkout.

## Verification

- `pnpm sync`
- Framework skill symlink resolution for `eve`, `technical-writing`, and `gh-pr-description`
- Live GitHub Actions workflow success and fork/upstream ancestry
- `pnpm typecheck`, `pnpm build`, `pnpm run info`, `pnpm lint`, and `pnpm fmt` completed successfully; `eve info` reported 15 tools and zero diagnostics
