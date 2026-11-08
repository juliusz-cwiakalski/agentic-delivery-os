---
ados_distribution: internal
id: TOOLING-UBIQUITOUS-LANGUAGE
status: Draft
created: 2026-11-02
last_updated: 2026-11-07
owners: [engineering]
area: domain
document_classification: working-analysis
links:
  related_changes: [GH-200, GH-231, GH-225, GH-233, GH-232, GH-234, GH-240]
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
| AI provider availability | Supplies eligibility, parks and announcements to callers; model-profile selection consumes availability rather than redefining it. | [Provider engine](../spec/features/feature-provider-engine.md), [provider profiles](../spec/features/feature-provider-profiles.md) |
| Local operational state | Supplies verified ledger evidence and rebuildable projections to consumers; it does not own upstream session content. | [State layer](../spec/features/feature-state-layer.md), [session administration](../spec/features/feature-session-database-admin.md) |
| Learning evidence and retrospection | Folds collector-truth evidence into level reports; the independent sidecar owns evidence integrity while the validated registry owns level and run data. | [Retro evidence pipeline](../spec/features/feature-retro-pipeline.md), [audit ledger](../spec/features/feature-audit-ledger.md) |
| Memory and change capsule | The change folder is the episode capsule: append-only events plus candidates. Closeout is the consolidation ceremony that records promotion decisions, home-writes lessons/tacit, and records sanctioned handoffs; the curator owns cross-folder maintenance. | [Change capsule](../spec/features/feature-capsule.md), [closeout](../spec/features/feature-closeout.md), [`.ai/memory/README.md`](../../.ai/memory/README.md) |
| Harness execution and surfaces | A host runs sessions; a surface exposes capabilities. Typed cross-harness adapter parity is delivered at the port boundary; the dispatch engine is the first production consumer of the session port. | [Harness adapters](../spec/features/feature-harness-adapters.md), [dispatch engine](../spec/features/feature-dispatch-engine.md) |

## Disambiguation at boundaries

- **Primitive / engine / command / surface:** a primitive is a stable composable
  semantic contract, including typed data, not necessarily an operation. Engines
  compose primitives into policy; commands expose scoped invocations; CLI, MCP
  and host integrations are surfaces. A command name is not a primitive name.
  The catalogue owns exact names; current handlers, not planned registry rows,
  establish executable grammar. The MCP package serves three read-only tools over
  a local stdio server; the typed host package remains a placeholder.
- **Harness / session:** the harness is the execution host; a session is one
  hosted execution. Typed spawn and classification parity are delivered at the
  adapter boundary; resume/steer and liveness gaps are declared per adapter, and
  the dispatch engine selects the configured harness and drives sessions through
  the port. See the harness concept above.
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
- **Change capsule / state ledger / telemetry stream:** the capsule is a
  file-based episode stream inside the change folder (`events.jsonl` plus
  `candidates/`) with its own framing, lock, event-key dedup, and terminal close.
  It is not a state record kind, not part of store salvage or index rebuild, and
  not a telemetry stream. Harness telemetry stays in the state-layer event log
  and is the only source `spend` reads; no telemetry statistic is copied into the
  capsule. Capsule event kinds and writers are a closed vocabulary, and the
  terminal `capsule.closed` is a marker, not an archive move.
- **Promotion decision / judgment residue:** a promotion decision is exactly one
  `promoted` or `rejected` verdict per candidate with a home or a closed reason,
  recorded in the capsule. Judgment residue is a separate bounded list of items
  that need human attention after the mechanical closeout sweep. A decision is
  not residue, and residue is not an error envelope; it is data that can exit 1
  through the `attention` class.
- **Owed-flip marker / owed-flip dependent:** a merged-diff marker
  (`todo-marker`, `when-merges-note`, `feature-flag`, `class-string`) names an
  action owed after merge and is detected, never code-rewritten. An owed-flip in
  the tracker steps moves an open direct dependent to `hand-back`. Both share the
  closeout vocabulary but describe different surfaces.
- **Delivery ledger / evidence sidecar:** the delivery state store's ledger is
  operational truth with fencing, salvage, and derived documents; the retro
  evidence sidecar is a separate collector-write-only artifact family with its
  own key and fence, outside the store's salvage path. A state-store repair never
  repairs evidence. Both carry claimed attribution, but the sidecar's keyed chain
  is tamper evidence, not authentication or prevention.
- **Verification completeness / CI readiness / merge authorization:** `verify
  change` checks ledger/document completeness. CI observations have bounded
  checkout-head coverage, not proof of every required PR-head job. `merge-ready`
  is an observed approval-based close class, not merge permission; `verify gates`
  is the config-declared merge battery (dispatched from the `verify` command;
  contract in the verify-gates feature spec), and `merge` lands only over a fresh
  recorded verification. Neither authorizes a merge by itself. Human gates and
  artifact evidence remain separate from any command's exit code.
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
