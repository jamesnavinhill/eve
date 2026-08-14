# Testing Standards

Tests exist to protect the things that must never break as we develop. They are
not a coverage metric, a ceremony gate, or a substitute for proof.

## Principles

1. **System-level critical functions only.** Tests cover the surfaces that must
   never break: the agent boots, the channel responds, the gateway routes,
   instrumentation exports traces, the build compiles, the sync script runs.
   If a break here would silently corrupt a session, lose a tool call, or break
   the runtime — it needs a test.

2. **Never brittle, trivial, or changing.** Do not test transient shapes,
   internal restructuring, cosmetic output, configuration details that change
   with provider drift, or anything that would break on a harmless refactor.
   If a test would fail on a rename, it should not exist.

3. **Never mocked or faked.** Real calls, real responses, real build steps,
   real subprocess. A mocked test proves the mock, not the system. The one
   exception is metered LLM inference: HTTP-level checks (does the gateway
   route, does the model respond) are the default; any test that spends credits
   requires explicit owner approval for that session.

4. **Solid, intentional set.** Each test earns its place. If a test is not
   guarding a real failure mode that has happened or could realistically happen,
   it should not be in the set. Fewer tests with higher signal is the goal.

5. **Full verification ladder, every session.** Each working session runs the
   complete ladder for the surfaces it touched:
   - `pnpm typecheck` — TypeScript passes
   - `pnpm build` — agent compiles
   - `pnpm info` — agent resolves (tools, channels, model config)
   - Focused runtime check — `eve dev` boots and responds on the channel
   - Instrumentation check — traces export where applicable
   - `pnpm lint` and `pnpm fmt` — hygiene
   - Pre-commit when preparing the change

6. **Commit and push.** Verified work gets committed (`git commit -s`) and
   pushed to `main` in-session. Unverified work does not get committed.

## What We Do Not Test

- Provider response format details that drift with provider updates
- Internal code organization, module structure, or import paths
- Documentation content or formatting
- Configuration values that are environment-specific
- Cosmetic or presentational output
- Anything a `typecheck` or `build` already catches

## What We Do Test

- Agent boots and resolves all tools, channels, and model config
- Channel accepts requests and returns responses with correct shape
- Gateway routes to the configured model and returns a real completion
- Instrumentation exports spans to PostHog with correct session tagging
- Build produces a runnable server
- Sync script fetches and applies fork updates
- Any critical path that has broken before or could silently break

## Running Tests

```sh
pnpm typecheck    # TypeScript
pnpm build        # full compile
pnpm info         # agent resolution
pnpm lint         # oxlint
pnpm fmt          # oxfmt
```

Focused runtime checks run in the terminal against the live dev server when
the changed surface warrants it.

## Adding Tests

A new test must answer: what specific failure mode does this catch, and has
that failure happened or could it realistically happen? If the answer is
"theoretical" or "style enforcement," the test does not belong.
