---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/02-artifact-model.md
---
# 02. The artifact model

## One change, five core facets

A change is not a folder of documents that restate each other. It is a set of **facets**,
each owning one kind of fact. A facet is written by one role, through one command family, and
read by others through a projection. The same fact is written once and referenced by ID.

| Facet | Owns | Written by | Read by (projection) | Budget |
|---|---|---|---|---|
| Specification | The contract: acceptance criteria, decisions, interfaces, affected components, risks, open questions, non-goals, bounded context and rationale, and declared extension slots | `spec-writer` | test-plan-writer, plan-writer, readiness, coder, reviewer, doc-syncer | prose 300/700/1,200 words for S/M/L |
| Test plan | Test cases, shared preconditions, coverage of acceptance criteria | `test-plan-writer` | plan-writer, readiness, coder, reviewer | 40KB |
| Delivery plan | Phases, steps, affected paths, acceptance and test links, verify commands, dependencies, handover requirements, and a `contextFor` map per phase | `plan-writer` | PM, coder, reviewer, scheduler | 35KB, comments at most 20 percent |
| PM context | Working memory: open loops, next actions, blockers, decision and risk references, handover references | `pm` | PM brief, CEO brief, retrospective (log only) | 8KB |
| Handover | What the next phase needs: done, deviations, open risks, next inputs, evidence | `coder` (tool-drafted, coder-confirmed) | next coder, PM, reviewer | 1KB per phase |

The **milestone contract** is deferred (section 14). The specification's `milestone` field is a
free-text label, not a link to a goal graph. The deferred example is in
`schemas/deferred/milestone.yaml`.

The phase registry remains the source of phase state. The PM context does not duplicate phase
timestamps; it points at the registry. The specification's **extension slots** are declared
free-text fields with an audience (`useIn`) and a word budget, at most three per facet; the
default audience is empty, so an unused slot costs nothing at read time. The delivery plan's
**`contextFor`** map declares what each role needs for each phase; the tool has a mandatory set
per role, and the plan can add to it but never remove from it. The retrospective log is a separate append-only facet,
not part of the PM context, and is read only by the retrospective agent.

## Change folder layout

```text
doc/changes/<YYYY-MM>/<date>--<REF>--<slug>/
  chg-<REF>-spec.yaml            # contract + bounded prose
  chg-<REF>-spec-rationale.md    # optional, L only, word-budgeted
  chg-<REF>-test-plan.yaml
  chg-<REF>-plan.yaml            # delivery plan, schemaVersion delivery.plan.v2
  chg-<REF>-pm-context.yaml      # working memory
  chg-<REF>-retrospective.yaml   # append-only evidence, read at retro only
  chg-<REF>-handovers.yaml       # keyed by phase id, one bounded entry each
  readiness-review/              # gate evidence, unchanged
  code-review/                   # review evidence, unchanged
```

The file names stay close to the current convention so the change folder remains discoverable.
The `.md` specification and test plan become `.yaml`; a compatibility reader can still read
the old files during migration, but only the CLI writes the new ones.

## IDs and references

The catalog-before-create rule applies (`../id-prefix-catalog.md`, R1). The pack uses the
existing change-local prefixes where they fit and proposes a small number of new ones.

| ID | Identifies | Status | Notes |
|---|---|---|---|
| `TC-<FEATURE>-<nnn>` | Test case | existing | change-local; dies with the folder |
| `DEC-<n>` | Local decision | existing | durable decisions move to an ADR/PDR/TDR/BDR/ODR |
| `OQ-<n>` | Open question | existing | with a default, so delivery can proceed |
| `F-<n>` | Capability | existing | used by the specification's capability section |
| `NG-<n>` | Non-goal | existing | |
| `API-<n>` | Interface coverage item | existing | reuse for interface contracts; do not add `IF-` |
| `EVT-<n>`, `DM-<n>` | Event, data-model item | existing | |
| `AC-<n>` | Acceptance criterion | **proposed** | needs a catalog entry; check collision with "alternating current" is not relevant in this domain, but the catalog decides |
| `RSK-<n>` | Risk | **proposed** | clear, no known collision |
| `PRE-<n>` | Test precondition | **proposed** | check against the "pre" prefix; the catalog decides |
| `ACT-<n>` | PM next action | **proposed** | check against "active"; the catalog decides |
| `M<n>-G<nn>` | Milestone goal | **proposed** | milestone key plus G; no new prefix |

Phase IDs (`P1`, `P2`, ...) are plan-local and do not need a catalog entry. Handover entries
are keyed by phase ID (`P3`) and are not separately identified.

Rules:

- References use IDs, never names (catalog R4).
- Change-local IDs are unique within the change folder (catalog R7).
- IDs are monotonic: a reopened phase keeps its ID; a rewritten acceptance criterion keeps
  its ID and gets a new revision; a superseded decision keeps its ID and a `supersededBy`.
- A reference that cannot be resolved is a lint failure, not a warning.

## Single source of truth

| Fact | Home | Referenced from |
|---|---|---|
| Acceptance criterion | specification | test plan coverage, plan phases, review, DoD |
| Test case | test plan | plan phases, coverage, review, gate evidence |
| Decision | specification (local) or decision record (durable) | PM context, bundles, plan |
| Interface contract | specification | plan, coder bundle, doc-syncer, review |
| Affected path | delivery plan | scheduler, audit, coder bundle |
| Phase state | phase registry | PM brief, board, queue |
| Open loop, next action, blocker | PM context | PM brief, CEO brief |
| Phase handover | handovers file | next phase bundle, PM brief, review |

A projection selects and orders facts; it never rewrites them. If a projection needs a fact
that is not in a facet, the facet is missing a field, not the projection.

## Artifact lifecycle

Each facet moves through four states:

1. **Draft.** The author is writing it. The tool commits each write with `status: draft` in
   the file header. Drafts are readable by the author and the PM, not by downstream roles.
2. **Validated.** `jaiship lint change <ref>` passes schema, references, coverage, budget,
   and provenance. The tool writes `status: validated`.
3. **Committed.** The tool commits the validated facet with the `Jaiship-Tool` trailer. This
   is the only commit path for an artifact.
4. **Superseded.** A rewrite or a reopen creates a new revision. The old revision stays in
   git; the facet's `revision` field increments; IDs stay stable.

A facet can go back to draft when a gate finds a gap. The reopen is recorded in the phase
registry and in the PM context, with the gap IDs.

## Tiers

Tier is declared at `change init` and can be raised by a gate, never lowered without a PM
decision recorded in the PM context.

| Tier | Changed lines | Files | Contract | Security or data migration | Artifact set |
|---|---|---|---|---|---|
| S | up to 300 | up to 10 | none | no | one-page specification, test list, file-list plan, PM context, handover only if multi-phase |
| M | up to 3,000 | up to 40 | local | no | structured specification, test table (up to 40 cases), phased plan with handovers, PM context |
| L | above 3,000 | above 40 | cross-cutting | possible | full set, decision records, independent verification |

Thresholds are a proposal; the owner decides them (open point 1). A change that exceeds its
tier is re-tiered by the readiness gate, and the re-tier is evidence.

Every tier keeps the **safety checks**: acceptance criteria, tests, a review, the gates, the
DoD, the pull request, and provenance. The tiers slim the **artifact volume**: the
specification prose, the test-plan depth, the plan granularity, the readiness depth, and the
handover requirement. A tier never removes a safety check.

## Budgets and enforcement

- A field budget is enforced at write: the command refuses a value that exceeds it and names
  the field and the limit. The author shortens; the tool never truncates silently.
- A file budget is enforced by lint: schema, references, coverage, size, provenance.
- A bundle budget is enforced by the bundle builder: it selects sections in priority order,
  stops at the budget, and lists what it omitted.
- Budgets are per tier where it matters: the specification prose is 300, 700, or 1,200 words;
  the test plan is 20KB for S, 40KB for M and L; the plan is 12KB for S, 35KB for M and L.

## Relationship to memory and retrospectives

The model aligns with `../memory-architecture.md`:

- **Working memory** is the PM context: small, volatile, read at every phase boundary.
- **Durable memory** is the decision record set: append-only, referenced by ID, read on
  demand.
- **Episodic memory** is the handover set: one bounded entry per phase, read by the next
  phase.
- **Evidence memory** is the retrospective log: append-only, written by the tool from gate
  and review evidence, read only by the retrospective agent.

The PM does not reread the retrospective log to decide the next action. It reads the PM brief,
which is a projection of working memory plus decision summaries plus handover summaries.

## Migration from the current files

| Current | Target | Migration |
|---|---|---|
| `chg-<REF>-spec.md` (25 sections) | `chg-<REF>-spec.yaml` plus optional rationale | one-time import for in-flight changes; new changes start in the new shape |
| `chg-<REF>-test-plan.md` (prose per case) | `chg-<REF>-test-plan.yaml` | import cases and preconditions; coverage is derived |
| `chg-<REF>-plan.yaml` (comments) | `chg-<REF>-plan.yaml` with `schemaVersion: delivery.plan.v2` | keep the file name; move comments into bounded `detail` fields or drop them |
| `chg-<REF>-pm-notes.yaml` (notes and decisions) | `chg-<REF>-pm-context.yaml` plus `chg-<REF>-retrospective.yaml` | split working memory from evidence; phase timestamps stay in the registry |
| handover (none) | `chg-<REF>-handovers.yaml` | new |

During migration the CLI reads both shapes and writes only the new shape. A compatibility
reader is removed after two milestones.
