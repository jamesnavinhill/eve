# Project standards

The `technical-writing` skill is the primary workflow for writing, editing, and
reviewing documentation in this repository. It owns source verification, prose
quality, terminology, document structure, and review passes.

This repository is an internal agent project, not the published eve framework
documentation site. The following framework-site provisions in the symlinked
skill do not apply here:

- `docs/meta.json` and `llms-index.ts` navigation updates
- published-route redirects
- mandatory TypeScript examples for internal engineering notes
- `pnpm docs:check`, which this project does not define

Local standards extend the writing workflow with project-specific policy:

| Standard                                       | Owns                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| [`dev-docs-standard.md`](dev-docs-standard.md) | Durable internal architecture, operations, and decision documentation |
| [`planning-style.md`](planning-style.md)       | Implementation plans and workstream structure                         |
| [`report-style.md`](report-style.md)           | Feasibility reports and decision handoffs                             |
| [`testing-standards.md`](testing-standards.md) | System-level testing and verification policy                          |

When rules overlap, use the technical-writing workflow and apply the local
standard as the repository-specific overlay. Current code, generated artifacts,
command output, and live provider read-backs remain the source of truth.
