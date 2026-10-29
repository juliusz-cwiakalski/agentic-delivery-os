---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/tracker-federation.md
---
# Concept: tracker federation

Status: Draft (2026-10-29, from owner review questions; parked concept:
designed, not scheduled). Projects live on one tracker at a time, but
estates do not: migrations (Linear to Jira or back, cloud trackers to
self-hosted), acquisitions, and multi-team organizations put work items
in two systems at once for months. ADOS must work during those windows
without agents or operators learning both systems.

## Principle

Per-system adapters stay exactly as the primitive surface defines them
(agent-primitive-surface.md): one adapter per tracker kind, normalized
primitives (WorkItem, WorkflowMap, WorkItemRelation, DeliveryRequest).
Federation is a **composition over adapters, not a new adapter kind**:
a federating layer that presents the same primitive surface while
spanning several ExternalSystemInstances. Consumers (agents, queue,
status) never know how many systems are behind it.

## Namespaces

A WorkItemRef is provider-qualified by invariant; under federation the
qualification becomes load-bearing: `jira:ACME-123` and
`linear:ENG-456` are distinct identities even when they map to the same
logical work. The federating layer owns:

- **Namespace registry**: which systems participate, which is the
  declared target (migration destination) and source.
- **Mapping registry**: id-linking table (this Jira item corresponds to
  that Linear item), with mapping provenance (manual declaration,
  imported during migration, inferred from links) and confidence.
- **Unmapped handling**: work present in only one system is simply
  itself; the mapping is an overlay, never a requirement.

## Conflict resolution

Two systems can disagree about one logical item. Policy, per field
class, not improvisation:

- **Canonical system per field class**: identity and workflow state from
  the declared target; discussion mirrors from both; relations follow
  whichever system owns the referenced item.
- **Divergence detection**: same item with contradictory workflow states
  is a classified finding surfaced to status and the board, never
  silently resolved by preferring one side.
- **Write routing**: during migration, writes go to the target; the
  source receives mirror updates (comment or link) so humans on the old
  system stay informed. Dual-write of mutable state is forbidden (it
  recreates the divergence it pretends to solve).

## Cross-references for humans and agents

The same link renders differently per audience:

- **Humans** get native links in both directions: the Jira item shows a
  link to its Linear counterpart and vice versa (via each system's
  native link or issue-field support; the adapter declares the carrier).
- **Agents** get translated ADOS WorkItemRefs: a reference to either
  system's id resolves through the mapping registry to the canonical
  identity, so dependency edges, specs, and capsules reference work
  stably across the migration.

## Migration window

1. **Declare**: namespaces registered, target declared, mapping seeded
   (import or manual).
2. **Read-federate**: status, queue, and verification read through the
   federating layer; both systems' work appears as one backlog.
3. **Write-target**: new work lands on the target; the source gets
   mirrors. The ready-set ignores source-only items once their
   successors exist on the target.
4. **Cutover**: source namespace marked read-only (archival reads
   keep working through the same adapter), target becomes the sole
   tracker. The mapping registry is kept: historical references to
   source ids keep resolving.

## Compatibility with the current build

- WorkItemRef stays provider-qualified and never predicted
  (primitive-catalogue.md): that invariant is what makes federation an
  overlay later. Nothing in M0-M4 may assume a single tracker instance
  per deployment at the type level (multiple configured instances are
  already normal: tracker plus VCS plus CI are separate systems).
- WorkItemRelation carries cross-system links without interpretation;
  no code assumes both endpoints share a system.
- Adapter conformance tests stay per-system; federation tests (mapping,
  divergence, mirror updates) join the suite when this concept is
  scheduled.
- No stories in M0-M4; revisit when a real migration or multi-tracker
  estate appears.

## Open questions

1. Mapping conflict review UX: who resolves a contested mapping (owner
   gate versus heuristic default with provenance)?
2. Do dependency edges span systems during the window (a Linear item
   blocking a Jira item), or does the ready-set treat cross-system
   blockers as owner-visible findings until cutover?
3. Import tooling: how much of the mapping can be seeded mechanically
   from each system's export or link fields?
