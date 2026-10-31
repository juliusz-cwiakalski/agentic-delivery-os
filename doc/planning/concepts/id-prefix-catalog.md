---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/id-prefix-catalog.md
---
# Concept: ID prefix catalog convention

Status: Draft (2026-10-29, ported from the production pilot's approved
catalog and generalized; pilot-specific allocators removed). Feeds the
framework-wide prefix standard
([#140](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/140)),
milestone IDs
([#139](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/139)),
and the M0-S17 decision batch. Proven in one production workspace; the
grammar, rules, and mechanics below are project-agnostic.

**Adopted by [ODR-0002](../../decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md)**
(Proposed; owner acceptance pending at the GH-186 PR review). The project
catalog declaration — per-type decision ranges, unchanged change-local
prefixes, catalogued tracker/story/`RTC-` allocations, and `MET-` with the
measurement baseline log as allocator — is recorded in ODR-0002 §Decision.
The Draft history above is retained; the grammar and rules below are not
rewritten.

## Why this exists

Delivery documents accumulate durable item IDs: decisions, change-local
questions, test cases, metrics, invariants. Unregistered prefixes drift,
collide, and become ungreppable, which is slow poison for AI-agent work:
an agent that cannot trust an ID cannot trust the reference chain. This
convention defines the **single source of truth for ID prefixes and
their allocation rules**: a formal grammar, a base registry ADOS ships,
and the customization model for project catalogs.

## Formal grammar

```text
ID            := <PREFIX> "-" <BODY>                (exactly ONE hyphen per ID)
PREFIX        := [A-Z]{2,5}                          (registered in a catalog)
BODY          := [A-Z0-9][A-Z0-9_]*                  (underscore = word separator; no hyphens)
SLUG-BODY     := meaningful word or abbreviation, 2-14 chars
NUM-BODY      := zero-padded sequential number (width fixed per space at registration)

QUALIFIED     := (<REPO-SLUG> ":")+ <ID>             (qualify each crossed namespace boundary)
REPO-SLUG     := [a-z0-9-]+                           (repository slug, e.g. recipes-service)
```

Case policy, structural not stylistic:

- **Catalog IDs are UPPERCASE only** (`ADR-0007`, `MET-CHURN`).
  Case-sensitive `rg` then never misses; catalog IDs are visually
  distinct from prose.
- **Code-native identifiers stay lowercase** (`plan_saved`, schema
  names). Docs mirror them verbatim: `UPPER-DASH` = catalog ID,
  `lower_snake` = code or domain name.
- **Event and schema identifiers are never numbered**; their code-native
  names are the durable identifiers. `EVT-`/`API-` remain change-local
  interface-coverage lists only.

Body style rule, decided at registration and never switched mid-life:

- Use a **slug body** when the ID is referenced in code, config, or
  queries, the space is or will be large, and humans already refer to
  items by a spoken name (`MET-CHURN`). First-letter acronym when
  already spoken, compact word otherwise.
- Use a **numeric body** when allocation order is itself meaningful, the
  space is small to moderate, and slugs would be arbitrary (`PRC-021`,
  `JR-003`). Where order matters and slugs are used, order lives as a
  column in the allocating registry.

## Rules

| # | Rule |
|---|---|
| R1 | **Catalog-before-create.** Before introducing any new item type or ID space, check the registry. If no prefix fits, add a catalog entry first (scope, source of truth, body style), then mint. |
| R2 | **One allocator per space.** Every prefix has exactly one source of truth: the tracker, a specific document, a repository's doc set, or a change folder. Only that allocator mints IDs in it; an ID not in the allocator's registry does not exist. |
| R3 | **Monotonic; never renumber, never reuse.** Renamed, split, or descoped items keep their ID; genuinely new work takes the next number or a new registered slug. Superseded IDs get a `superseded by` note in the allocating document. |
| R4 | **Durable references use IDs, not names.** Cross-document references that must survive edits cite the stable ID; human-readable names stay in prose. |
| R5 | **Confusion avoidance beats brevity.** A prefix must be at least 2 letters and not confusable with any existing one, including being a strict prefix of it or differing by one character. When in doubt, take a longer prefix. Verify with `rg '\b<DRAFT>-'` across repositories before adopting. |
| R6 | **Scope tags are explicit.** Every entry is `project-global`, `repo-local`, `area-local`, `doc-local`, or `change-local`. |
| R7 | **Change-local IDs are unique within one change folder.** The folder name (it contains the ticket key) is the namespace; no cross-change uniqueness for change-local classes. |
| R8 | **Framework alignment.** ADOS ships a base registry (below). Project catalogs extend it, never fork it: one truth per space, framework names preferred for new spaces unless that breaks live project IDs, in which case the project prefix stands and the catalog records the alias. |
| R9 | **Progressive qualification.** Qualify an ID only with the namespace levels actually crossed: bare inside the allocating scope; `repo-slug:ID` cross-repo; `repo-slug:change-folder:ID` when a cross-repo ticket has change folders in several repositories. |
| R10 | **Allocation tooling is a late addition.** Registry rows (prefix, scope, allocator, body style) are machine-consumable by design so an allocation CLI can adopt them later: tracker-allocated for global spaces, git-stored registries for doc spaces. |
| R11 | **No collisions with well-known abbreviations.** A prefix must not collide with a market-standard abbreviation whose meaning differs: software engineering (SLO, SLA, PR, CI, API, CAP, RTC, ASM), SaaS and business (MRR, CAC, ARPU, KPI), or terms proximate to the product's domain. Check against general abbreviations, domain-proximate terms, and existing project docs. Tracker-assigned keys are exempt: their identity is the tracker's. When collision risk exists, lengthen or change the prefix. |

## ADOS base registry

The registry ADOS ships and maintains for its own repositories. Projects
extend this list; they do not edit it.

| Prefix | Identifies | Scope | Source of truth | Body |
|---|---|---|---|---|
| `ADR-` / `PDR-` / `TDR-` / `BDR-` / `ODR-` | Decision records by type (architecture, product, technical, business, operating) | repo-local | `doc/decisions/` per type, one allocating index each | numeric x4, **separate range per type** (see customization) |
| `TC-` | Change test case: does this change meet its acceptance criteria; dies with the folder | change-local | the change folder | `TC-<FEATURE>-<nnn>` |
| `OQ-` / `DEC-` / `ALT-` / `F-` / `NG-` / `API-` / `EVT-` / `DM-` | Open questions, local decisions, alternatives, capabilities, non-goals, interface coverage, data-model items | change-local | the change folder | `<PREFIX>-<n>` |
| tracker keys (`GH-123`, project keys) | Work items | project-global | the tracker | tracker-assigned (exempt from R5/R11) |
| `M<n>-S<n>` | Backlog story codes | repo-local | the backlog document | allocated by the backlog |
| `RTC-` | Regression test scenarios graduated from change-local `TC-` | repo-local | the repository's quality index | numeric x3 |

**Test-case graduation rule:** when a change's `TC-` proves durable, it
is allocated the next `RTC-` number in the repo's quality index and the
change folder records `TC-3 -> RTC-017`. One-way, never renumbered.

## Customization model (the nuance that varies per project)

The base registry fixes grammar and rules, not every allocation shape.
Two deliberate degrees of freedom, chosen per project and recorded in
the project catalog:

1. **Decision ID allocation.** ADOS default: separate numeric ranges
   per decision type (`ADR-0004`, `TDR-0002`), each with its own index.
   Supported alternative: one shared sequence for all decision records
   (`DEC-0054` style or a tracker-allocated decision project), which
   trades type information for a single chronological register. Both are
   valid; the project catalog declares which one is in force, and tools
   (lint, indexes) read the declaration instead of assuming either.
2. **Project-space adoption.** Metric, journey, process, invariant, and
   similar spaces are opt-in per project. Adopt from the pattern list
   below (or register new ones via R1) only when the promotion test
   below fires; do not pre-register empty spaces.

## Project-space patterns (available, not default)

Patterns proven in the pilot workspace, offered as registered shapes a
project catalog may adopt (with its own allocators):

| Prefix | Identifies | Body | Notes |
|---|---|---|---|
| `MET-` | Metric definitions (what is calculated) | slug | metrics registry as allocator; inputs column records the dependency graph, which must stay acyclic |
| `INS-` | Instrumentation slices (how values become available) | slug | always leaves of the metric graph |
| `JR-` | User journeys | numeric x3 | journey document as allocator |
| `PRC-` | Business processes | numeric x3 | process catalog as allocator |
| `HYP-` | Discovery hypotheses | numeric x2 | assumption register as allocator |
| `MILE-` | Roadmap milestone IDs | numeric x4 | preferred over `MS-` per R11 (Microsoft, milliseconds); relevant to #139 |
| `INVAR-` | Invariants: properties that must always hold; referenced by specs, tests, release gates | numeric x3 | invariants register as allocator |
| `UNK-` | Unknowns: recognized knowledge gaps that may affect decisions; distinct from work items | numeric x3 | unknowns register as allocator |
| `CEO-D-` | Standing coordinator/owner decisions recorded by the coordinating agent | numeric x4 | local decision register as allocator |
| `QUE-` | Questions asked to the owner and his answers (point-in-time archives) | numeric x2 | questions archive as allocator |
| `SPEC-<AREA>-` | Feature or system spec anchors | `SPEC-<AREA>-<nnn>` | unique within one repo only; qualify cross-repo (R9) |

## Promotion test (when a new space earns a prefix)

Register an entity type only when it is referenced from multiple places,
has an independent lifecycle, affects decisions, requires provenance,
may become stale, must be searchable, can block or authorize actions, or
contributes to correctness or risk. Anything less stays prose until it
grows into the test. This extends R1 and keeps the catalog lean.

## Runtime entity identifiers (E-rules)

Runtime data IDs get informational prefixes (debuggability plus a
wrong-type safeguard), governed by:

| # | Rule |
|---|---|
| E1 | Identifiers are opaque strings everywhere; never parsed, never semantically interpreted by consuming code. |
| E2 | Only the code site that mints a new identifier knows its prefix. |
| E3 | Fields with a mandated machine format (for example a 26-char ULID validated by the envelope validator) are exempt: format constraint wins over prefixing. |
| E4 | Foreign IDs from other services are typed as opaque strings and never re-prefixed. |
| E5 | Prefixes follow the catalog rules (R5 minimum length, R11 no well-known-abbreviation collisions). |

## Uniqueness mechanics

1. Tracker-allocated spaces: uniqueness delegated to the tracker.
2. Single-allocating-document rule: the allocating document's registry
   table is the ID registry; slug spaces also fix delivery order where
   it matters.
3. Document-split rule: if an allocating document splits, the ID space
   does not reset; the registry moves to the area index and numbering
   stays monotonic.
4. Repo-local anchors: authoring-time `rg` within the repo; cross-repo
   homonyms are tolerated by design but must be qualified when
   referenced across repos (R9).
5. Change-local: uniqueness within the folder only (R7).
6. New-ID checklist: existing prefix fits, else draft prefix, R5
   confusability check, catalog entry, allocator registry exists or is
   planned.
7. Periodic audit, quarterly: `rg -o '\b[A-Z]{2,5}-[A-Z0-9_][A-Z0-9_]*\b' doc --no-filename | sort | uniq -c | sort -rn | head -30`; anything frequent and absent from the catalog gets triaged: register, rename, or remove.

## Adopting in an existing project

1. Inventory: run the audit command; list every live prefix.
2. Decide per space: register as-is, rename under R11, or grandfather as
   legacy (read-only, never allocate, references stay valid).
3. Record one-way migrations in the project catalog; raw evidence is
   never edited, current-truth documents use the new IDs.
4. Change-local and doc-local IDs stay untouched by principle: their
   namespace is the folder or document.

## Reserved-prefix collision guidance (R11 worked examples)

For factory-model entity types likely to earn prefixes later, adjusted
forms already vetted against well-known collisions:

| Drafted as | Adjusted | Collision avoided |
|---|---|---|
| `PO-` (proof obligation) | `PROOF-` | PO = Product Owner, Purchase Order |
| `REL-` / `R-` | `RELS-` (release) / `RELN-` (relationship) | internal draft collision; single letter violates R5 |
| `INC-` (incident) | `INCD-` | Inc. = incorporated |
| `DEP-` (deployment) | `DEPL-` | dep = dependency, deprecated |
| `ASM-` (assumption) | fold into `HYP-`; if split needed, `ASSUM-` | ASM = assembly |
| `CONST-` (constraint) | `CONSTR-` | `const` keyword |
| `CAP-` (capability) | `CAPB-` | CAP theorem |
| domain-proximate short forms (for example `CAL-`, `EXP-` in a domain where calories or expiry are proximate terms) | lengthen per domain | domain proximity is per-project; check against the product's own vocabulary |

Reserved rows are not active spaces; mint only through R1 plus the
promotion test.
