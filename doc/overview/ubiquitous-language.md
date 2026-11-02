---
id: TOOLING-UBIQUITOUS-LANGUAGE
status: Draft
created: 2026-11-02
last_updated: 2026-11-02
owners: [engineering]
area: domain
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Thin tooling vocabulary relationship map and disambiguation draft for Gate 4."
---

# Tooling ubiquitous language

## Scope and ownership

Gate 4 draft, not a new domain-design decision or approved binding vocabulary.
Scope: single-operator local delivery tooling. The [north star](01-north-star.md)
owns direction; the [architecture](architecture-overview.md) distinguishes current
implementation from target design. The engineering-repo fallback applies because
the documentation profile is absent.

| Home | Owns | This draft does not duplicate |
|---|---|---|
| [Primitive catalogue](../planning/concepts/primitive-catalogue.md) | Primitive names, semantic contracts, maturity and lifecycle inventory | Catalogue tables, inventories or new primitive definitions |
| This UL draft | Relationships, boundary translations and disambiguation | New bounded-context or aggregate mandates |
| [Glossary](glossary.md) | Reader definitions and acronym expansions | A second definition table for already housed terms |
| [Command registry](../planning/oss-tooling/cli-command-registry.md) | Planned command grammar and scope | Grammar or implementation claims derived from registry presence |
| [Feature specs](../spec/features/) | Delivered behavioral contracts | Planned behavior promoted to shipped behavior |

## Inferred context map

These are navigation lenses inferred from existing modules and concepts, not
ratified DDD contexts, new packages, or mandates for aggregates/entities/events.

| Lens | Relationship and translation boundary | Canonical home |
|---|---|---|
| Delivery evidence and lifecycle | Consumes normalized tracker/CI observations and verified phase records; completeness does not confer permission. | [Verification](../spec/features/feature-verify-change-and-exit-taxonomy.md), [ready set](../spec/features/feature-queue-ready.md) |
| External-system integration | Adapter ports translate provider dialects into shared vocabulary; supported operations and gaps are explicit. | [Adapter ports](../spec/features/feature-adapter-ports.md), [client seeds](../spec/features/feature-provider-client-seeds.md) |
| AI provider availability | Supplies eligibility, parks and announcements to callers; future model policy consumes availability rather than redefining it. | [Provider engine](../spec/features/feature-provider-engine.md), [model profiles](../planning/concepts/model-profiles.md) |
| Local operational state | Supplies verified ledger evidence and rebuildable projections to consumers; it does not own upstream session content. | [State layer](../spec/features/feature-state-layer.md), [session administration](../spec/features/feature-session-database-admin.md) |
| Harness execution and surfaces | A host runs sessions; a surface exposes capabilities. Typed dispatch parity is planned, distinct from existing prompt/plugin distribution. | [Harness adapters](../planning/concepts/harness-adapters.md), [primitive surface](../planning/concepts/agent-primitive-surface.md) |

## Disambiguation at boundaries

- **Primitive / engine / command / surface:** a primitive is a stable composable
  semantic contract, including typed data, not necessarily an operation. Engines
  compose primitives into policy; commands expose scoped invocations; CLI, MCP
  and host integrations are surfaces. A command name is not a primitive name.
  The catalogue owns exact names; current handlers, not planned registry rows,
  establish executable grammar. Typed MCP/host packages remain placeholders.
- **Harness / session:** the harness is the execution host; a session is one
  hosted execution. Plugin availability does not prove equivalent typed dispatch,
  spawn/resume or supervision across hosts. See the harness concept above.
- **Model profile / profile class:** a profile is a named agent-to-model mapping;
  a class groups profiles by task difficulty. Class working names are not profiles
  or newly frozen names. Model policy is planned. Current provider v1 evaluates
  provider availability; it neither selects models nor spawns sessions.
- **Provider availability / observed readiness:** tracker/VCS/CI providers are
  external-system adapters, not AI provider descriptors. `provider-available` in
  a ready set can carry `engine-not-run`; it is not a fresh quota probe or a model
  selection. See [queue-ready evidence](../spec/features/feature-queue-ready.md).
- **State fence / repository lease:** the implemented state fence serializes
  local store writes. A future delivery lease owns scheduling scope; these are
  not interchangeable. Only local state is implemented; project/global levels
  fail explicitly. [Parallel delivery](../planning/concepts/parallel-delivery.md)
  keeps single-flight per repository as the scheduled default, with remote
  identity distinct from checkout path. Scoped parallel leases are designed,
  not evidence of an implemented scheduler or permission to share a checkout.
- **Local ledger / session database:** JSONL is durable tooling truth; SQLite
  indexing and derived documents are rebuildable. The upstream session database
  is a separate administration target, not that ledger. Session checkpointing
  does not restart the host. Metadata-only administration is not transcript access.
- **Verification completeness / CI readiness / merge authorization:** `verify
  change` checks ledger/document completeness. CI observations have bounded
  checkout-head coverage, not proof of every required PR-head job. `merge-ready`
  is an observed approval-based close class, not merge permission; `verify gates`
  is the delivered read-only five-gate evaluation (dispatched from the `verify`
  command; contract in the verify-gates feature spec) and never authorizes a
  merge. Human gates and artifact evidence remain separate from any command's
  exit code.
- **Dual-run / strangler:** dual-run compares replacement behavior while the
  shell retains authority until explicit per-engine cutover evidence; strangler
  is the broader engine-by-engine migration with wrappers and late retirement.
  Neither means a clean pilot window has been observed. See [roadmap principles](../planning/oss-tooling/roadmap.md).
- **Ceremony share / owner attention:** the delivered measurement is a recorded
  phase-duration proxy, not measured active effort or the approved direct-attention
  outcome. See [measurement contract](../spec/features/feature-measurement-baseline.md).

## Review boundary

Use this as draft navigation, not an override of contracts, source, Proposed
decision status or existing instructions. Conflicts return to the owning home;
this draft creates no decision, union merge policy or naming freeze.
[Graduation accounting](../inception/analysis/phase-4-glossary-graduation.md)
keeps unapproved glossary edits and permanent-home debt explicit.
