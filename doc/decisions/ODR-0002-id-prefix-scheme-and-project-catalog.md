---
id: ODR-0002
decision_type: odr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Adopt the base ID registry, grammar, and rules R1-R11 from the ID-prefix catalog by reference; declare the project catalog with per-type decision ranges (ADR/PDR/TDR/BDR/ODR each own a sequence and index, not one shared sequence), unchanged change-local prefixes, tracker/story/RTC- allocations as catalogued, and MET- adopted with the measurement baseline log as allocator; pre-register no other project space."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os documentation substrate
decision_scope: repo
review_date: null
classification:
  domains: [operations, documentation]
  archetype: policy
  environment: clear
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-186)"
  decider: "Juliusz Ćwiąkalski (human; acceptance pending at GH-186 PR review)"
  contributors:
    - "@spec-writer (GH-186 spec §5.1 F-2)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@reviewer"
    - "Owner (human acceptance)"
  performers:
    - "@doc-syncer (catalog status), @coder (M2-S6 metric IDs)"
  informed:
    - "M2-S6 metrics and spend"
    - "Documentation and decision-record contributors"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The base registry in `id-prefix-catalog.md` changes in a way that conflicts with the adopted project catalog: reconcile the project catalog explicitly rather than forking the base registry."
  - "A new durable ID space is needed (metric, journey, process, invariant, or unknown): apply the catalog promotion test and extend the project catalog, never mint an unregistered prefix."
  - "The owner prefers one shared decision sequence over per-type ranges: record the change in a superseding decision record and re-index the affected records."
links:
  related_changes: ["GH-186"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/planning/concepts/id-prefix-catalog.md"
  contracts: []
  diagrams: []
  decisions: ["ODR-0001"]
  experiments: []
  metrics:
    - "doc/planning/oss-tooling/measurement-baseline.yaml"
  roadmap_items: ["M2-S6"]
---

# ODR-0002: ID Prefix Scheme and Project Catalog

## Context

- **FACT:** `doc/planning/concepts/id-prefix-catalog.md` defines the formal ID grammar, rules R1–R11, the base registry ADOS ships, and a customization model with two legitimate decision-ID shapes: separate numeric ranges per decision type, or one shared sequence.
- **FACT:** The catalog is currently a Draft concept, not an adopted scheme. No decision record declares which customization is in force, and the repository already uses per-type decision files (`ADR-0007`, `ODR-0001`) with per-type numbering.
- **FACT:** Change-local prefixes (`F-`, `DM-`, `C-`, `NFR-`, `RSK-`, `DEC-`, `OQ-`, `AC-`, `NG-`, `TC-`) are in active use under the change-folder convention, and `RTC-` and tracker/story allocations are catalogued in the base registry.
- **FACT:** The M0-S17 measurement baseline needs stable metric IDs. The catalog's project-space pattern list offers `MET-` (metric definitions, slug body) as an opt-in space, and the baseline log is the natural allocator.
- **Why now:** Without an adopted catalog, tools and authors cannot know whether decision IDs are per-type or a single sequence, and new prefixes can drift outside the base registry. M2-S6 needs a registered `MET-` allocator before it consumes the baseline.

## Problem Framing (Clarified)

The question is not whether IDs should be well formed — the catalog already defines that. The question is which catalog **is in force for this repository** and what the project adds to the shipped base registry.

Two sub-questions follow:

1. **Decision-ID allocation:** per-type ranges (each type has its own sequence and index) or one shared decision sequence. The file layout and existing numbers already imply per-type; the record must state it so tools stop guessing.
2. **Project-space adoption:** which optional spaces are actually in use. `MET-` is in use now (the baseline log); other spaces are not. Pre-registering empty spaces would contradict the catalog's own promotion test.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Adopt the base registry, grammar, and rules R1–R11 by reference; do not fork or rewrite them in this repository. | Catalog R8 (framework alignment); GH-186 DEC-2 | record review; catalog diff | no |
| C-2 | Decision records use per-type numeric ranges; ADR/PDR/TDR/BDR/ODR each own a sequence and an index, not one shared sequence. | Catalog customization model; existing `doc/decisions/` layout | index/numbering review | no |
| C-3 | Change-local prefixes remain unchanged and stay change-local under R7. | Catalog base registry; unified change convention | change-artifact review | no |
| C-4 | Tracker keys, story codes, and `RTC-` allocations follow the catalogued base-registry entries. | Catalog base registry | reference review | no |
| C-5 | `MET-` is adopted with the measurement baseline log as its single allocator; no other project space is pre-registered. | Catalog R2 (one allocator) + project-space patterns; GH-186 DEC-10 | baseline/metric-ID review; catalog declaration | no |

> **Table stakes:** all alternatives keep the formal grammar and the catalog's case policy unchanged; acknowledged once rather than per alternative.

## Decision Drivers

1. **One truth per space** — an ID not in its allocator's registry must not exist.
2. **Tool-readable declaration** — linting and indexes read the declared shape instead of assuming it.
3. **Minimal catalog** — adopt only spaces the repository actually uses.
4. **Framework alignment** — the project extends the shipped base registry rather than forking it.
5. **Reversibility** — a catalog declaration is a small, easily superseded artifact.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-186).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance pending at GH-186 PR review. The record remains `Proposed` until then.
- **Contributors:** `@spec-writer` (GH-186 §5.1 F-2), the ID-prefix catalog concept.
- **Required reviewers:** `@reviewer`; the owner for acceptance.
- **Performers:** `@doc-syncer` (catalog status annotation), `@coder` (M2-S6 metric IDs).
- **Informed:** M2-S6 and documentation/decision contributors.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The catalog defines a complete grammar, rules R1–R11, and a base registry. | FACT | `id-prefix-catalog.md` | This record would have to define the grammar itself, duplicating the concept. | High |
| The repository already uses per-type decision files and numbers. | FACT | `doc/decisions/` (ADR-0001…0007, ODR-0001) | The per-type declaration would contradict current practice. | High |
| `MET-` is a catalogued optional project space with a slug body. | FACT | catalog "Project-space patterns" | The baseline metric IDs would lack a registered allocator. | High |
| The measurement baseline log can serve as the single `MET-` allocator. | FACT | `measurement-baseline.yaml` (four `MET-` IDs) | A separate metric registry would be required. | High |
| No other project space is currently in durable use. | ASSUMPTION | repository scan; GH-186 §5.1 F-2 | An unregistered in-use space would need adoption. | Medium |

## Mental Models & Techniques Used

- **Adopt by reference:** the base registry and rules stay in one document; the project record declares only the differences.
- **One allocator per space (R2):** the baseline log is the only minter of `MET-` IDs.
- **Promotion test:** register a space only when it is actually referenced and durable; empty spaces stay unregistered.
- **Least surprise:** per-type ranges match the directory layout a reader already sees.
- **Reversibility:** a declaration change is a small, explicit edit rather than a data migration.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 adopt by reference | C-2 per-type ranges | C-3 change-local | C-4 catalogued allocations | C-5 MET- only |
|----------|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the Draft concept | ❌ | ❌ | ✅ | ✅ | ❌ |
| ALT-1 adopt base + per-type ranges + MET- (selected) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 adopt base + one shared decision sequence | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-3 pre-register every project-space pattern | ✅ | ✅ | ✅ | ✅ | ❌ |

Legend: ✅ passes · ❌ fails.

### Alternative 0 — Keep the Draft Concept

- **Eligibility:** Not eligible (fails C-1, C-2, C-5).
- **Summary:** Leave the catalog as an unadopted Draft.
- **Pros:** No record to maintain.
- **Cons:** Tools and authors cannot know the decision-ID shape; `MET-` has no allocator.
- **Why rejected:** It preserves the exact ambiguity this record exists to remove.

### Alternative 1 — Adopt the Base Registry, Declare Per-Type Ranges, Adopt Only `MET-` (selected)

- **Eligibility:** Eligible.
- **Summary:** Adopt the base registry, grammar, and rules by reference; declare per-type decision ranges; keep change-local prefixes unchanged; follow catalogued tracker/story/`RTC-` allocations; adopt `MET-` with the baseline log as allocator; pre-register nothing else.
- **Constraint compliance:** Passes C-1…C-5.
- **Pros:** One truth per space; tool-readable; minimal catalog; matches existing practice.
- **Cons:** Per-type ranges mean five numeric sequences to track (already the practice).
- **Why chosen:** It satisfies every constraint and keeps the catalog lean.

### Alternative 2 — One Shared Decision Sequence

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** All decision records draw from one sequence (`DEC-0054` style) with a single index.
- **Pros:** One chronological register.
- **Cons:** Contradicts the existing per-type file layout and indexes; would force renumbering or a dual numbering scheme.
- **Why rejected:** It trades type information for chronology and conflicts with current artifacts; the catalog permits it but the project declares per-type.

### Alternative 3 — Pre-Register Every Project-Space Pattern

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Register metric, journey, process, invariant, unknown, and similar spaces now.
- **Pros:** Future IDs would be pre-approved.
- **Cons:** Registers empty spaces, contradicting the promotion test; increases the catalog surface without use.
- **Why rejected:** The catalog explicitly says not to pre-register empty spaces.

## Decision

- **Recommendation:** Alternative 1.
- **Authorized Decision:** pending — the owner accepts or adjusts at GH-186 PR review. Until then the record is `Proposed` and grants no authority.

### DC-1 — Adopt the base registry by reference

The project adopts the formal grammar, rules R1–R11, and the ADOS base registry from `doc/planning/concepts/id-prefix-catalog.md` by reference. This record does not restate or fork them; a change to the base registry is reconciled explicitly instead of being copied here.

### DC-2 — Per-type decision ranges

Decision IDs use separate numeric ranges per decision type. ADR, PDR, TDR, BDR, and ODR each own a sequence and an index; there is **not** one shared decision sequence. The next-free number is allocated per type at authoring time and is never reused or renumbered.

### DC-3 — Change-local prefixes unchanged

Change-local prefixes (`F-`, `DM-`, `C-`, `NFR-`, `RSK-`, `DEC-`, `OQ-`, `NG-`, `AC-`, `TC-`, and the other registered change-local classes) remain change-local and unique within one change folder under R7. This record does not elevate or renumber them.

### DC-4 — Catalogued tracker, story, and `RTC-` allocations

Tracker keys (for example `GH-123`), story codes (`M<n>-S<n>`), and `RTC-` allocations follow the base-registry entries as catalogued: the tracker, the backlog, and the repository quality index are their respective allocators. No new space is introduced for them.

### DC-5 — `MET-` adoption and allocator

`MET-` is adopted as a project space for metric definitions (slug body). The measurement baseline log at `doc/planning/oss-tooling/measurement-baseline.yaml` is its **single allocator**: a metric ID that is not in the log does not exist. The four current IDs are `MET-CEREMONY-SHARE`, `MET-CYCLE-TIME`, `MET-CI-FAILURE-RATE`, and `MET-FALSE-SIGNAL-INCIDENTS`. No other project space is pre-registered by this record; new spaces follow the catalog promotion test.

- **Decider:** Owner (Juliusz Ćwiąkalski) — acceptance pending at GH-186 PR review.
- **Conditions for revisit:** see `revisit_triggers`; the most important is an owner preference for one shared decision sequence or a base-registry change.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-5: the base registry and rules are adopted by reference (C-1); decision IDs use per-type ranges (C-2); change-local prefixes are unchanged (C-3); tracker/story/`RTC-` allocations follow the catalog (C-4); and only `MET-`, with the baseline log as allocator, is adopted (C-5). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- Tools and authors have one declared answer for both decision-ID shape and project spaces.
- The base registry stays the single grammar source; the project only declares differences.
- `MET-` has a concrete allocator before M2-S6 consumes the baseline.
- The catalog stays lean because empty spaces are not registered.

### Negative Outcomes

- Five per-type decision sequences must be tracked (already the practice).
- A future space adoption requires a catalog edit and, if durable, a decision amendment.
- The `MET-` allocator is the baseline log, so metric definitions and baseline values share a file.

### Unresolved Questions

- [ ] Confirm the owner accepts per-type decision ranges at PR review (owner: Juliusz Ćwiąkalski).
- [ ] Confirm that no currently used project space is missing from this declaration (owner: documentation maintainers).

## Implementation Plan

1. The catalog concept is annotated as adopted by this record (status + link) during GH-186's planning/doc-sync work.
2. Decision authors allocate the next free number per type and never reuse a number.
3. `MET-` IDs are allocated in the measurement baseline log; M2-S6 reads them from there.
4. A new durable space is adopted by extending the project catalog and, where cross-cutting, superseding or amending this record.

## Verification Criteria

- Metric: decision records that use a shared decision sequence — Target: 0 — Window: `doc/decisions/` review.
- Metric: `MET-` IDs absent from the baseline log — Target: 0 — Window: M2-S6 conformance check.
- Metric: project spaces pre-registered without use — Target: 0 — Window: catalog review.

## Confidence Rating

**High.** Every element follows the existing catalog and repository practice; the only judgement call is adopting `MET-` now rather than later, which the baseline already requires.

## References

- [GH-186 change specification](../changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/chg-GH-186-spec.md) — §5.1 F-2 (ID scheme and project catalog).
- [ID prefix catalog concept](../planning/concepts/id-prefix-catalog.md) — grammar, rules R1–R11, base registry, customization model, project-space patterns.
- [Measurement baseline log](../planning/oss-tooling/measurement-baseline.yaml) — the `MET-` allocator.
- [ODR-0001](ODR-0001-classify-yaml-register-templates-redistributable.md) — convention-level decision precedent.
