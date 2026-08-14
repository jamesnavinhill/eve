---
name: upstream
description: "Use when: an error, constraint, failure, surprise, or hard decision appears - or when work is drifting toward patching symptoms. Trigger to course-correct by tracing a problem to its source before fixing it. Catch-all for 'why does this keep happening', repeated failures across places, brittle workarounds, or 'should we patch or fix properly'."
argument-hint: "the error, constraint, or decision to trace"
---

# Upstream

## Purpose

Trace any problem to its true source and fix it THERE, instead of patching the hole, bucket-catching
the overflow, or hand-rolling the boulder out of the stream. If upstream is in shape, everything
downstream flows. This is the single most important rule for every agent and repo in the family.

## The procedure

1. **Ask the first question.** "Why does this exist in the first place?" Not "how do I get past it" -
   "why is it here at all."
2. **Walk upstream.** Take the answer and ask why again. Repeat, noticing the surroundings (the
   connected decisions, contracts, and assumptions) as you go.
3. **Stop at the source.** Keep going until the answer is no longer within our control - you have
   reached a core primitive, contract, or external dependency. That point is the source.
4. **Decide at the source, not before.** Only once you can see the full system, the connected
   decisions, and the direct and indirect effects do you choose a deep fix vs a tactical one. Pick the
   most proportionate fix at the source - do not overengineer, do not underfix.
5. **Fix it there, once.** Remove the cause. Then everything downstream of it flows without per-case
   handling.

## Hard signals you are NOT at the source yet

- The same symptom shows up in more than one place. Two+ instances of one failure = proof of a single
  upstream constraint. Fix that one source; do NOT chase the instances one domino at a time.
- Your fix tolerates, skips, retries, or works-around the symptom rather than removing its cause.
- Your fix only holds for the exact environment you are in (breaks in CI, a fresh clone, an isolated
  workdir, another repo) - that means you patched a layout/assumption, not the source.

## Anti-patterns (forbidden)

- Patching the hole / bucket-catching the overflow / hand-rolling the boulder out of the stream.
- Adding a tolerance flag, conditional skip, retry, or shim to make a symptom pass.
- Building broad compatibility layers to absorb an upstream that simply is not in shape.

## Corollary: downstream never depends on upstream's physical presence

A downstream gate or consumer must validate only its OWN artifacts. It must never require an
upstream-owned file to be physically present (e.g. via a layout-dependent symlink). Reference upstream
by its canonical identity, not by mounting it. "Upstream it" - canon to the single source, organize by
concern, and let downstream flow from it.

## Worked example

`docs:check` failed in Multica workdirs because it required `docs/_standards/dev-docs-standard.md`,
reachable only through a relative symlink to the `_ops` repo. Symptom appeared in two repos.
- Patch (wrong): tolerate the missing symlink / skip the entry when absent.
- Source (right): a downstream gate was requiring an upstream-owned file's physical presence. Removed
  that requirement from both gates so each validates only its own docs. The symlink stays as a dev
  convenience nothing gates on. One source fix, both instances gone, holds in every checkout.

## Output

State the why-chain explicitly (each "why" and its answer), name the source, name the proportionate
fix at the source, and confirm the downstream cases now flow without per-case handling.
