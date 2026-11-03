# Milestone outcome packs

Per-milestone review surfaces for planned outcomes: the architecture, the
journeys, the command surface, and the command contracts as they will exist
at the end of a milestone. They exist so the owner can validate and refine
the planned shape before delivery starts; the backlog
([../backlog.md](../backlog.md)) stays canonical for scope and order, and
the command registry
([../cli-command-registry.md](../cli-command-registry.md)) stays canonical
for the locked naming surface.

## Pack contents

| Artifact | Content | Present for |
|---|---|---|
| `architecture.md` | C4 diagrams (context, containers, components) of the system at milestone end, plus boundary invariants | every milestone |
| `journeys.md` | User and agent journeys delivered at milestone end, each with the no-token guarantees and the story map | milestones with an operational CLI (M1 on) |
| `man-page.md` | The command surface available after the milestone, with usage lines and delivery attribution | milestones with an operational CLI (M1 on) |
| `contracts.md` | Per-command proposed contracts: inputs, outputs (text digest and machine envelope), exit codes, examples, test scenarios | milestones with an operational CLI (M1 on) |

M0 is backfilled with architecture only: the M0 CLI engines exist beside
the bash stack (which stays authoritative), so journeys, a man page, and
contracts describe the wrong regime for M0. From M1 on, the pack is
authored during milestone planning and refined as stories deliver.

## Conventions

- **Binary name placeholder.** Pack documents write commands bare
  (`status`, `queue ready`, `phase complete`) and use `<binary>` for the
  invocation prefix. The working name lives behind the branding seam and is
  named in the command registry; new documents do not repeat it (rename
  hygiene through the naming freeze).
- **Status semantics.** Until a milestone exits, everything in its pack is
  planned: contracts are proposals refined at story delivery, and the pack
  records the intended end state, not delivered behavior. After exit, the
  pack is the milestone snapshot and later milestones supersede it.
- **Diagrams** are mermaid flowcharts structured into C4 levels (context,
  containers, components) with the level named in each heading.
- **No private content.** Packs are committed public documents: no private
  fleet, repository, or product names; production evidence is described by
  class, not by name.

## Index

| Milestone | Pack |
|---|---|
| M0 (trust substrate, delivered) | [m0/architecture.md](m0/architecture.md) |
| M1 (delivery engine and autonomous dispatch, planned) | [m1/architecture.md](m1/architecture.md), [m1/journeys.md](m1/journeys.md), [m1/man-page.md](m1/man-page.md), [m1/contracts.md](m1/contracts.md) |
