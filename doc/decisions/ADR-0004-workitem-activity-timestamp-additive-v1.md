---
id: ADR-0004
decision_type: adr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Add an optional ISO-8601 `updatedAt` activity-timestamp field to the v1 `WorkItem` port contract as an additive extension, so the M0-S6 stall query reads a truthful provider-resolved signal instead of deriving activity from comments or ordering."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_scope: repo
review_date: null
classification:
  domains: [architecture, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (via GH-188 planning)"
  decider: "Juliusz Ćwiąkalski (human acceptance pending at PR review)"
  contributors: ["@decision-advisor (analysis)", "@spec-writer (GH-188 spec OQ-1/RSK-5 framing)"]
  reviewers: ["@readiness-reviewer", "@reviewer", "Owner (human final acceptance)"]
  performers: ["@coder"]
  informed: ["M0-S6 status-collector story (GH-175)"]
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M0-S6's stall query needs a finer-grained signal than a single last-modified timestamp (e.g., status-change time); propose a further additive field then, not a retype."
  - "A provider cannot supply any updated-at signal for work items; keep the field optional and represent activity as unknown — never fabricate a derived value."
  - "The v1→v2 contract boundary is ever opened; restate the activity-signal semantics deliberately at that boundary."
links:
  related_changes: ["GH-188", "GH-181", "GH-175"]
  supersedes: []
  superseded_by: []
  spec: ["doc/spec/features/feature-adapter-ports.md"]
  contracts: ["packages/core/src/contracts/ports.ts"]
  diagrams: []
  decisions: ["ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0004: WorkItem Activity Timestamp (`updatedAt`) as an Additive v1 Contract Extension

## Context

- **FACT:** The v1 `WorkItem` port (delivered by GH-181, `packages/core/src/contracts/ports.ts`) carries `identity`, `title`, `status`, `labels`, optional `assignee`, `relations`, and `comments` — no timestamp of any kind.
- **FACT:** The M0-S6 status collector's tracker query families are owner hand-backs, blocked dependencies, **stalls**, and ticket hygiene (backlog `doc/planning/oss-tooling/backlog.md`, M0-S6). The stall family needs an activity signal on the normalized data.
- **FACT:** GH-188's spec tracks exactly this gap as OQ-1 with RSK-5 ("missing activity-timestamp signal for the stall query"), delegates to `@decision-advisor` if a contract extension is indicated, and names additive evolution within v1 as the default path.
- **FACT:** The contracts tier is types and `as const` data only — no behavior, I/O, ambient environment, clock, or randomness — so a field addition is a type-shape change, not a behavior change (feature-adapter-ports.md; ADR-0003 DEC-2 tier rules).
- **FACT:** The substrate's stated evolution discipline is additive-within-v1 (feature-adapter-ports.md risk "contract churn": "contracts derive from the catalogue's semantic rows, evolution is additive within v1, and a decision record governs adapter-contract changes"). This record is that decision record for the first such extension.
- **FACT:** `tests/structure/port-contract-inventory.test.ts` pins the exact v1 contract inventory in both directions, so any field addition requires updating that inventory test in the same change — a mechanical consequence, not a barrier.
- **FACT:** Jira issues expose a native `updated` field and GitHub issues expose `updated_at` (public provider API documentation), so both read-slice providers can populate the signal natively without derivation.
- **FACT:** Jira comment omission (a ticket-named trap in GH-188 F-3) means comments may be absent from responses for permission or paging reasons; any activity signal derived from comments is therefore silently wrong on exactly the quirk the trap catalog exists to catch.

## Problem Framing (Clarified)

The stall query ("has this item gone quiet?") cannot be answered truthfully from the delivered `WorkItem` shape. Deriving last activity from comments or ordering heuristics fails on the comment-omission quirk (absence of comments is not absence of activity) and forces every adapter to invent its own derivation — the opposite of normalization. The question is where the activity signal lives: in the shared port contract (additively), in an adapter-side wrapper type, or not at all (narrow the claim). The substrate's own rules — one catalogue-keyed surface, no parallel adapter surfaces, additive-within-v1 evolution — frame this as a contract-extension decision governed by a decision record, which is why this record exists.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Additive within v1: no existing field of the nine delivered port types is removed, retyped, or made required; the new field is optional. | feature-adapter-ports.md evolution discipline; GH-188 RSK-5 | Contract-inventory structure test updated in the same change; type probes | no |
| C-2 | Contracts-tier neutrality: the extension is a type field only — no behavior, clock, or I/O enters `core ./contracts`. | ADR-0003 DEC-2; port-neutrality tests | `tests/structure/port-neutrality.test.ts` and boundary guards | no |
| C-3 | No parallel adapter surface: adapters must not ship a wrapper type that replaces or augments the port view for consumers. | feature-adapter-ports.md ("adapters implement behind the ports and never invent a parallel surface") | Boundary matrix; review of adapters public exports | no |
| C-4 | Truthful absence: a missing activity signal must be representable and distinguishable from "no activity" (mirrors the comment-omission representability discipline). | GH-188 F-3/F-5 trap discipline; M0-S6 AC ("no network call is treated as a verdict" — no fabricated signals) | Trap-catalog tests incl. a fixture with the field absent | no |
| C-5 | Zero secret-read boundary impact: the extension adds no credential path; the secret-read allowlist stays at exactly four entries. | GH-188 DEC-6; feature-adapter-ports.md | Secret-read invariant green, count = 4 | no |

## Decision Drivers

1. **Truthful stall detection from normalized data alone** — M0-S6 must answer stalls from `WorkItem` data, never provider-native payloads, and never a derived signal that lies on a known quirk.
2. **Minimal contract surface growth (least privilege)** — add exactly the signal the stall query needs; no speculative fields without a named consumer.
3. **Provider coverage without branching** — the field must be populatable by every work-item provider in scope (Jira, GitHub) from native provider data.
4. **Fixture determinism** — the signal must be present in recorded provider responses so trap tests prove its normalization offline.
5. **Solo-maintainer cost** — one optional field is cheaper to carry than a wrapper type or a per-adapter derivation protocol.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (during GH-188 planning; the spec's OQ-1 delegates the contract-extension call here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-188 PR review. AI does not accept this record.
- **Contributors:** `@decision-advisor` (analysis), `@spec-writer` (OQ-1/RSK-5 framing in the GH-188 spec).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on the GH-188 change; the owner for final acceptance of this record.
- **Performers:** `@coder` (contract field, inventory-test update, seed population, fixtures).
- **Informed:** the M0-S6 status-collector story (GH-175), the first consumer of the signal.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| `WorkItem` v1 has no timestamp field today. | FACT | `packages/core/src/contracts/ports.ts` (read 2026-10-31) | The extension would be redundant; decision void. | High |
| M0-S6's stall family needs an activity signal from normalized tracker data. | FACT | backlog M0-S6 (lines 183–184); GH-188 spec §24 coverage table | No consumer; the field would be speculative. | High |
| Jira issues expose `updated`; GitHub issues expose `updated_at`. | FACT | Public provider REST API documentation | A provider could not populate the field natively; would stay absent for it (truthful). | High |
| Comment omission makes comment-derived activity untrustworthy. | FACT | GH-188 spec F-3 (ticket-named quirk); Jira behavior | Derivation would be viable and ALT-0 defensible — rejected on truthfulness regardless, since omission is in-scope to trap. | High |
| The inventory structure test pins exact contract shape and must be updated with the field. | FACT | feature-adapter-ports.md QA table; `tests/structure/port-contract-inventory.test.ts` | CI fails until updated; mechanical. | High |
| GitLab's GH-188 slice does not normalize work items (MRs and pipelines only), so it is unaffected. | FACT | GH-188 spec F-2/F-4; backlog M0-S19 | GitLab seed would also populate the field — no impact on the decision. | High |
| M0-S6 will want only one activity signal now; finer signals (status-changed-at) are not yet named by a consumer. | ASSUMPTION | M0-S6 backlog entry names only "stalls" | A second additive field would be needed later — additive path stays open either way. | Medium |

## Mental Models & Techniques Used

- **First principles:** what does "stalled" mean? Time since the provider last recorded a change on the item. That is provider-resolved data, so it belongs in the normalized view — not reconstructed downstream.
- **Inversion:** any answer that must not silently lie on the comment-omission quirk rules out derivation from comments (ALT-0) — invert the stall query and the failure is obvious: an item with omitted comments looks perpetually fresh or perpetually stale.
- **Least privilege / minimal surface:** one optional field with one documented meaning; richer activity blocks wait for a named consumer (the substrate already forbids speculative primitives).
- **Reversibility:** an optional additive field is removable without breaking any consumer before the first consumer lands; after M0-S6 consumes it, removal is a v1-breaking change — the window for cheap reversal is this change.
- **Paved road:** additive-within-v1 is the substrate's declared evolution path; this is the first traversal, so it sets the precedent for how contract extensions are done (record first, then extend).

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 additive | C-2 neutrality | C-3 no parallel surface | C-4 truthful absence | C-5 secret boundary |
|----------|:---:|:---:|:---:|:---:|:---:|
| ALT-0 derive from comments/ordering | n/a (no change) | pass | pass | **fail** | pass |
| ALT-1 optional `updatedAt` on `WorkItem` | pass | pass | pass | pass | pass |
| ALT-2 adapter-level wrapper type | pass | pass | **fail** | pass | pass |
| ALT-3 richer activity block | pass | pass | pass | pass | pass |

### Alternative 0 — Do Nothing / Derive Activity from Comments and Ordering

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Keep the contract unchanged; M0-S6 derives last activity from comment timestamps and list ordering.
- **Constraint compliance:** Fails C-4 — comment omission (permission/paging) makes derived activity silently wrong; absence of comments is indistinguishable from absence of activity.
- **Driver fit:** Weak on driver 1 (truthfulness) and 4 (derivation is not fixture-provable as provider data).
- **Pros:** Zero contract change.
- **Cons:** Bakes a known trap into a downstream story; every adapter invents its own derivation.
- **Why rejected:** The trap-catalog discipline exists precisely to prevent this class of silent misreading.

### Alternative 1 — Additive Optional `updatedAt` on `WorkItem` (chosen)

- **Eligibility:** Eligible.
- **Summary:** Add `readonly updatedAt?: string` (ISO-8601 UTC) to `WorkItem`, populated verbatim from the provider's native last-modified field (Jira `updated`, GitHub `updated_at`); absent means activity unknown — never zero activity — and the stall query reports "cannot determine" for absence.
- **Constraint compliance:** Passes all (matrix above); C-1 by optionality, C-2 by being a type field, C-4 by the documented absent-means-unknown semantics proven by a fixture with the field missing.
- **Driver fit:** Best on all five drivers.
- **Pros:** Truthful, provider-native, fixture-recordable, one-time inventory-test bump; M0-S6 reads a first-class field.
- **Cons:** First v1 contract extension — sets precedent and requires this record; providers that cannot supply the signal leave it absent (a visible, honest gap).
- **Why chosen:** The only option that keeps consumers truthful without a parallel surface or a derived lie.

### Alternative 2 — Adapter-Level Wrapper Type (Provider-Native Timestamps Beside the Port View)

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Adapters export `WorkItem & { updatedAt }` view types; core contract untouched.
- **Constraint compliance:** Fails C-3 — a wrapper type is exactly the "parallel surface" the substrate forbids; M0-S6 would branch on provider-specific types, defeating normalization.
- **Driver fit:** Fails driver 1 (provider branching in the consumer) and 3.
- **Pros:** No core change.
- **Cons:** Fragmented surface; every work-item provider grows its own view type; the M0-S6 collector becomes provider-aware.
- **Why rejected:** Violates the delivered substrate rule and inverts the port boundary's purpose.

### Alternative 3 — Richer Activity Block (`updatedAt` + `statusChangedAt` + …)

- **Eligibility:** Eligible.
- **Summary:** Add a nested optional activity object covering several signals at once.
- **Constraint compliance:** Passes all constraints.
- **Driver fit:** Fails driver 2 (least privilege) — no consumer names the extra signals today.
- **Pros:** Fewer future extensions if M0-S6 later needs finer signals.
- **Cons:** Speculative contract surface the substrate's own bounded-catalogue discipline argues against; a nested object is also a heavier shape to evolve than scalar optional fields.
- **Why rejected:** Additive evolution makes later additions cheap; speculative fields are not free to carry, document, and fixture.

## Decision

- **Decision:** Extend the v1 `WorkItem` port contract additively with an optional `readonly updatedAt?: string` field (ISO-8601 UTC), carrying the provider's native last-modified timestamp for the work item, normalized verbatim without derivation. Absence means activity unknown — distinguishable from "no activity" — and consumers must treat absent as "cannot determine", never as fresh or stale. The Jira and GitHub seeds populate it from Jira `updated` and GitHub `updated_at` respectively; the GitLab slice (MRs/pipelines) is unaffected.
- **Rationale (tied to drivers):** The only option that satisfies truthfulness (driver 1) while staying minimal (driver 2), provider-uniform (driver 3), and fixture-provable (driver 4) within the delivered substrate rules; it also traverses the declared additive-within-v1 evolution path exactly as the substrate prescribes (record-governed).
- **Decider:** Owner (Juliusz Ćwiąkalski) — acceptance pending at GH-188 PR review; this record stays Proposed until then.
- **Conditions for revisit:** See `revisit_triggers` in the front matter; the first M0-S6 consumption retro confirms or revises the absent-means-unknown consumer contract.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies all constraints C-1 through C-5. No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The stall query reads a truthful, provider-resolved signal from normalized `WorkItem` data alone (AC-F3-1 of GH-188 stays answerable without provider payloads).
- The comment-omission trap can no longer corrupt activity interpretation; a missing-`updatedAt` fixture becomes a trap-catalog case.
- The additive-within-v1 evolution path gets its first governed traversal — a reusable precedent for later port extensions.

### Negative Outcomes

- `tests/structure/port-contract-inventory.test.ts` and the exact v1 inventory fixtures must be updated in the same change (mechanical cost).
- The port table in feature-adapter-ports.md and the GH-188 spec §24 coverage table need a doc-sync update naming the field.
- After M0-S6 consumes the field, removal becomes a v1-breaking change — the reversibility window closes with this change's merge.

### Unresolved Questions

- [ ] Will M0-S6's stall threshold also want a status-change time? (owner: M0-S6 story; additive later if named.)
- [ ] Do any Jira Data Center deployments omit `updated`? (owner: @coder during fixture capture; absent stays truthful.)

## Implementation Plan

1. GH-188 delivery adds the field to `packages/core/src/contracts/ports.ts` (`WorkItem`), updates the contract-inventory structure test and fixtures, and populates it in the Jira and GitHub seeds from the native fields, with trap-catalog coverage including a field-absent fixture.
2. The change's test plan adds the offline trap cases; no consumer changes (M0-S6 consumes later).
3. Doc-sync phase updates feature-adapter-ports.md's `WorkItem` port-table row and the GH-188-linked spec coverage table to name `updatedAt` and its absent-means-unknown semantics.

## Verification Criteria

- Metric: contract-inventory structure test green with the field present (both directions) — Target: 100% — Window: GH-188 CI.
- Metric: trap-catalog entries proving `updatedAt` normalization and field-absence handling per provider — Target: ≥1 per seed normalizing work items — Window: GH-188 CI, offline.
- Metric: secret-read allowlist entry count — Target: exactly 4 — Window: GH-188 CI.
- Metric: M0-S6 stall family answerable from normalized data including unknown-activity representation — Target: demonstrable at M0-S6 delivery.

## Confidence Rating

High — the gap and its cause are verified in the delivered contract and the consuming backlog entry; both in-scope providers expose the native signal; the decision runs with, not against, every delivered substrate rule.

## References

- GH-188 spec (OQ-1, RSK-5, F-3, §24 coverage table): `doc/changes/2026-10/2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-spec.md`
- Delivered port contracts: `packages/core/src/contracts/ports.ts`
- Current spec truth: `doc/spec/features/feature-adapter-ports.md`
- Backlog M0-S6 (tracker queries incl. stalls): `doc/planning/oss-tooling/backlog.md`
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — contracts-tier tier rules and additive substrate.
