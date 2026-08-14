---
name: untard
description: "Use when: a constraint, process, abstraction, gate, dependency, daemon, or risk-surface is slowing work down and you suspect it earns less than it costs. Trigger to put a thing on trial for its right to exist and rip out net-negative drag. The complement to /upstream — upstream fixes the source of a problem; untard deletes the thing that should never have been a problem."
argument-hint: "the constraint / process / abstraction / risk-surface to put on trial"
---

# Untard

> Untard asks *should this thing exist at all, and is it paying rent?* If it's net-negative drag,
> you don't optimize it — you delete it.

## Purpose

Catch and remove **development-retarding drag**: constraints, gates, abstractions, daemons, shims,
profiles, or risk-surfaces that cost more than they return. Every constraint we accept is a tax. The
tax is only worth paying if the **net benefit is clearly in our favor**. If it isn't, the thing is
slowing us down for nothing — un-tard it.

## The one question

**"Is this thing's net benefit in our favor — or is it just retarding development?"**

If you can't state a concrete benefit that outweighs its cost + risk surface, the default verdict is
**remove**.

## The boogeyman test — the self-imposed constraint

Before you accept a "we have to," find out who is holding the gun. **A constraint you created is not
a law. It is a boogeyman** — it only has power while you believe it came from outside.

Walk it: *"what forces this?"* → answer → *"is THAT in our control?"* → repeat. In a one-dev +
agents shop, almost every "hard constraint" turns out to be a setting, a default, a convention, or a
hack papering over a collision of two of your *own* choices. Keep walking until you hit something
genuinely outside your control — a protocol, a vendor API, physics. Everything above that line is
negotiable. So renegotiate it.

If the only thing forcing the pain is something *you* set: stop obeying it. We do it our way.

## The procedure

1. **Name the thing on trial.** The exact constraint / process / abstraction / risk-surface, in one
   sentence. (e.g. "a second Multica daemon under a different profile.")
2. **Tally the cost.** What does it cost us *continuously*? Drag, ceremony, a second moving part, a
   nondeterminism, a collision/injection surface, cognitive load, one more thing that can break.
3. **Tally the benefit.** What does it actually buy us — concretely, today, for THIS project (one dev
   + agents, greenfield)? Not in theory, not "best practice," not "an enterprise would."
4. **Net it out.** Benefit minus cost-and-risk. If it isn't *clearly* positive, it's dead weight.
5. **Rip it out at the root**, then `/upstream` the hole it leaves so nothing downstream re-grows it.
   If it IS net-positive, say why in one line and keep it — don't torch working hygiene out of zeal.

## Hard signals you're looking at tardation

- A second moving part that does what one already does (a redundant daemon / profile / service / gate).
- Ceremony justified only by "best practice" or "an enterprise would" — not by THIS product's need.
- A risk surface (nondeterminism, collision, injection point) accepted with **no** benefit that beats it.
- Something everyone routes *around* instead of *through* — that's the tell it shouldn't be there.
- A constraint that only made sense for a stage we've already left.

## Anti-patterns (don't be the tard)

- Keeping a thing because it's already there (sunk cost), or because removing it is mildly scary.
- Swinging to the opposite extreme. Untard removes *net-negative* drag; it does **not** ban all
  hygiene, lints, or pre-commit checks that cheaply catch drift. Aim for the middle, then adjust on
  results. (A test that freezes a transient shape = tard. A format check that catches drift before
  commit = rent-paying — keep it.)
- Deleting something you never actually netted out. Do the tally, *then* cut.

## Relationship to /upstream

- `/upstream`: a problem exists → trace to source → fix it THERE.
- `/untard`: a *thing* exists → does it deserve to → if not, DELETE it, then upstream the gap.
- Run them as a pair: untard removes the net-negative thing; upstream solves the reason it was there
  so it can't grow back.

## Field receipt — the boogeyman symlink

Seven product repos each carried a `docs/_standards/` **symlink** into the shared `_ops` standards
canon, backed by a gate that wanted that file *present*. It looked load-bearing. It was pure
net-negative drag: the symlink only resolved in the nested-local layout and died everywhere that
counts — standalone clone, CI, isolated workdir — and it pointed at a path that had since been
renamed, so it was **dead on arrival in all seven**.

The "constraint" forcing it — *"a repo must reach the shared canon from inside itself"* — was a
boogeyman. It was born from trying to have it both ways: standalone repos that secretly depend on a
parent file. Net it out: cost = a brittle, dead, layout-coupled link in seven places; benefit =
none. **Verdict: cut.**

Upstream fix (the duality worth burning in): **repos go lean and self-sufficient** — they reference
the canon by *identity*, never require the file present, never carry a copy — **while `_ops` stays
the unbounded single source**, the brain that holds the full text. Risk drops exponentially (no
cross-repo file coupling left to break) and nothing duplicates (no drift). The repo *names* the rule;
`_ops` *owns* the rule.

Lesson: when you catch yourself building a bridge so A can reach B, first ask whether A should depend
on B at all. The bridge is usually the tell that the dependency itself is wrong.

