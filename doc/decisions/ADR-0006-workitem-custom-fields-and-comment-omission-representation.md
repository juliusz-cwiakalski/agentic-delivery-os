---
id: ADR-0006
decision_type: adr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Resolve the two remaining Jira read-slice quirk representations on the v1 WorkItem contract: custom fields normalize per documented mapping rules with no contract change (unmapped fields visibly unrepresented), and comments becomes optional (absent = comment set unknown, present-empty = genuinely none)."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_scope: repo
review_date: null
classification:
  domains: [architecture]
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
  driver: "@decision-advisor (via GH-188 delivery)"
  decider: "Juliusz Ćwiąkalski (human acceptance pending at PR review)"
  contributors: ["@decision-advisor (analysis)", "@test-plan-writer (OQ-A/OQ-B framing)", "@spec-writer (F-3/AC-F3-2 quirk clauses)"]
  reviewers: ["@readiness-reviewer", "@reviewer", "Owner (human final acceptance)"]
  performers: ["@coder"]
  informed: ["M0-S6 status-collector story (GH-175)", "M0-S14 closeout story (GH-183)", "M3-S3 full GitHub adapter"]
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M0-S6 (or M0-S14) names a concrete consumer need for custom-field values beyond mapped normalized fields (e.g., required-field conformance on unmapped tenant custom fields); propose a purpose-shaped additive extension then — never a generic key/value bag."
  - "A consumer needs to know WHY comments are unknown (permission vs paging vs not fetched); add a reason-bearing evidence field as a further additive extension with that named consumer."
  - "The v1→v2 contract boundary is ever opened; restate the comments absent-means-unknown semantics and the custom-field mapping discipline deliberately at that boundary."
links:
  related_changes: ["GH-188", "GH-181", "GH-175", "GH-183"]
  supersedes: []
  superseded_by: []
  spec: ["doc/spec/features/feature-adapter-ports.md"]
  contracts: ["packages/core/src/contracts/ports.ts"]
  diagrams: []
  decisions: ["ADR-0003", "ADR-0004"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0006: WorkItem Custom-Field Mapping and Comment-Omission Representation (v1)

## Context

- **FACT:** The v1 `WorkItem` port (`packages/core/src/contracts/ports.ts`, delivered by GH-181) carries `identity`, `title`, `status`, `labels`, optional `assignee`, `relations`, and a **required** `comments: readonly WorkItemComment[]` — plus the planned additive optional `updatedAt` per ADR-0004, which rides in this same change (GH-188 DM-6).
- **FACT:** No v1 port contract carries any custom-field representation. The only "custom field" in the substrate is the `provider-custom-field` **carrier kind** — a metadata-envelope transport form, unrelated to tracker custom fields.
- **FACT:** GH-188's ticket quirk list names "label replace, custom fields, transitions as data, comment omission", each to be evidenced by trap-catalog tests against recorded fixtures. Two AC-F3-2 clauses are blocked because the current contract shape has no destination for either: the change test plan records this as OQ-A (custom-field destination, blocks TC-JIRA-002) and OQ-B (comment-omission representation, blocks TC-JIRA-004), and explicitly refuses to invent a contract field at test-plan level.
- **FACT:** The test plan already pins "no raw `customfield_*` key leaks into the `WorkItem` view" (TC-JIRA-002 step 2) — any option that passes provider-native custom-field keys through the boundary contradicts evidence already planned.
- **FACT:** The M0-S6 tracker-collector query families are owner hand-backs, blocked dependencies, stalls, ticket hygiene (backlog M0-S6; GH-188 spec §24). Stalls consume `updatedAt` (ADR-0004). The hygiene family is glossed "label, status, and custom-field conformance on normalized `WorkItem`"; the concrete M0-S6 story is not yet authored, so no consumer today names a need for custom-field **values** beyond fields that feed normalized data.
- **FACT:** Zero in-repo consumers read `WorkItem.comments` today (verified by search across `packages/**`, `tests/**`, `scripts/**` on 2026-10-31): the GH-188 seeds are the first implementations behind the ports, and M0-S6 — the first consumer — is undelivered. The only mechanical consequence of changing the field's shape is the contract-inventory update already riding in this change (DM-6, TC-CONTRACT-001).
- **FACT:** The substrate's evolution discipline is additive-within-v1, record-governed, with no parallel adapter surfaces and no speculative primitives without a named consumer (feature-adapter-ports.md; ADR-0003; ADR-0004 precedent).
- **FACT:** The envelope contract already demonstrates a visible-degradation pattern (`CommentReadView.degradation?: MetadataDegradationEvidence` with a closed reason set) — but for metadata-envelope reads, where degradation reasons are mechanically detectable and a heuristic provenance must attach; it is not a work-item read-view mechanism.

## Problem Framing (Clarified)

Two of the four ticket-named Jira quirks have no representable normalized outcome on the delivered v1 `WorkItem`, so their trap tests cannot assert anything and AC-F3-2 stays partially blocked:

1. **Custom fields (D-E):** Jira tenants carry provider-specific custom fields with inconsistent native typing. The question is where custom-field truth lives: on the contract (an additive field), in documented adapter mapping rules (contract unchanged), or nowhere (narrow the AC). The named-consumer discipline and closed-contract rules decide this before any custom client code is written.
2. **Comment omission (D-F):** Jira search endpoints omit comment payloads for permission/paging causes. Omission must be distinguishable from "genuinely no comments" through the port surface; today a required `comments` array forces the adapter to fabricate an empty set — exactly the silent misreading the trap-catalog discipline exists to prevent, and the same class of absence-truthfulness ADR-0004 resolved for `updatedAt`.

Both are the same decision class — representation of provider truth on the v1 `WorkItem` contract within GH-188 — so they are decided together in this record.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Additive within v1, no break for existing consumers: no delivered field is removed, retyped, or made required; any shape change compiles against every in-repo consumer and updates the contract-inventory field-shape probe in the same change. | feature-adapter-ports.md evolution discipline; ADR-0004 C-1 | Inventory/field-shape probe (TC-CONTRACT-001), `pnpm typecheck`, workspace build | no |
| C-2 | No speculative contract surface: a new or reshaped contract element requires a named consumer cited in the record. | Substrate bounded-catalogue discipline (feature-adapter-ports.md); ADR-0004 ALT-3 precedent | Design review at PR; named-consumer citation in this record | no |
| C-3 | No parallel adapter surface; no provider-native types or keys cross the port boundary. | feature-adapter-ports.md; GH-188 NFR-1/AC-F1-2 | Boundary matrix; `tests/structure/provider-surface.test.ts`; TC-JIRA-002 raw-key-leak assertion | no |
| C-4 | Truthful absence: a provider-omitted signal must be representable and distinguishable from a genuine empty/none value — never fabricated, never collapsed. | ADR-0004 C-4 precedent; GH-188 F-3/F-5 trap discipline | Trap-catalog tests with paired omitted/empty fixtures (TC-JIRA-004; TC-JIRA-007 analogue) | no |
| C-5 | Contracts-tier neutrality: any contract change is type shape only — no behavior, clock, I/O, or derivation enters `core ./contracts`. | ADR-0003 DEC-2 | `tests/structure/port-neutrality.test.ts` | no |
| C-6 | Zero secret-read boundary impact: no new credential path; the allowlist stays at exactly four entries. | GH-188 DEC-6; feature-adapter-ports.md | Secret-read invariant green, count = 4 | no |

## Decision Drivers

1. **Truthful reads through one normalized interface** — every M0 consumer answers queries from normalized `WorkItem` data; no consumer ever needs provider-native payloads, and no known quirk may be silently flattened into normalized truth.
2. **Minimal contract surface (least privilege)** — add or reshape exactly what a named consumer needs; the bounded-catalogue discipline rejects speculative fields.
3. **Uniform absence semantics** — one mental model across the contract: absence = unknown, presence = provider-asserted truth (the ADR-0004 precedent).
4. **Minimal consumer disruption** — zero in-repo consumers exist today; keep it that way-cost, and keep the cheap-reversal window open through this change.
5. **Fixture provability** — every decided representation must be assertable by an offline trap test against a recorded fixture.
6. **Solo-maintainer cost** — one declared rule set beats per-adapter improvisation or a policing burden over multi-field invariants.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (during GH-188 delivery; the test plan's OQ-A/OQ-B delegate the contract-shape calls here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-188 PR review. AI does not accept this record.
- **Contributors:** `@decision-advisor` (analysis), `@test-plan-writer` (OQ-A/OQ-B framing, blocked TC-JIRA-002/004), `@spec-writer` (F-3/AC-F3-2 quirk clauses).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on the GH-188 change; the owner for final acceptance of this record.
- **Performers:** `@coder` (contract reshaping where decided, mapping declaration, seeds, fixtures, trap suites).
- **Informed:** M0-S6 status collector (GH-175) — first consumer of `comments` semantics; M0-S14 closeout (GH-183) and M3-S3 full GitHub adapter (mapping-discipline and write-path inheritors).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| `WorkItem.comments` is a required array; no omission representation exists. | FACT | `packages/core/src/contracts/ports.ts` (read 2026-10-31) | D-F is void; TC-JIRA-004 would already be satisfiable. | High |
| No v1 contract carries a custom-field representation. | FACT | `ports.ts`, `adapter-capabilities.ts` (read 2026-10-31) | D-E is void. | High |
| Zero in-repo consumers read `WorkItem.comments`. | FACT | Search across `packages/**`, `tests/**`, `scripts/**` (2026-10-31) | Making the field optional would break a consumer; C-1 would force a different option. | High |
| The test plan already asserts no raw `customfield_*` key leaks (TC-JIRA-002 step 2). | FACT | chg-GH-188-test-plan.md §5.2 | A pass-through bag option would not conflict; it would still fail C-2/C-3. | High |
| No named consumer today needs custom-field values beyond mapped normalized fields; M0-S6 hygiene is glossed but not authored. | FACT (no consumer named) + ASSUMPTION (M0-S6 v1 hygiene will not need unmapped-field values) | backlog M0-S6; GH-188 spec §24 | If false: a further additive, purpose-shaped extension is added when M0-S6 names it — the additive path stays open either way. | Medium |
| Jira search-shaped responses omit the comment payload entirely (vs returning an empty list), so omission is detectable from the response shape and fixture-provable. | FACT (recorded-shape level) | Jira provider behavior; GH-188 F-3 | If some deployments differ, the fixture captures the recorded shape; M0-S20 live runs revalidate. | High |
| The envelope degradation-evidence pattern is metadata-envelope-specific (closed mechanically detectable reasons + heuristic provenance); no consumer names a need for comment-omission *reasons*. | FACT (pattern scope) / ASSUMPTION (no reason consumer) | `contracts/envelope.ts`; M0-S6 backlog | If false: reason-bearing evidence is a future additive field with its named consumer. | Medium |
| Making `comments` optional is a producer-compatible relaxation: every previously valid `WorkItem` literal remains valid. | FACT | TypeScript assignability; strict-mode typecheck | If false (a consumer breaks): zero consumers exist, so the break would surface only in fixtures — updated mechanically in this change. | High |

## Mental Models & Techniques Used

- **First principles:** what does the contract claim? `comments` present claims "the provider asserted this set (possibly empty)"; absence must claim "set unknown". A required array makes the second claim unrepresentable — the type itself lies on a known quirk.
- **Inversion:** invert each option against TC-JIRA-004's forbidden outcome — "omission collapsed into `[]`". Option F-a survives by construction (absent is absent); F-b fails (a fabricated `[]` rides on every omitted read, corrected only by a second field); F-0 fails outright.
- **Least privilege / minimal surface:** for D-E, the null change (mapping rules as reviewable adapter data) delivers the ticket-required evidence with zero contract growth; a bag field is the maximum-surface option and the only one without a named consumer.
- **Uniform semantics (paved road):** absence = unknown now holds for `updatedAt` (ADR-0004) and `comments` — one rule across optional `WorkItem` fields, instead of a per-field flag protocol.
- **Second-order thinking:** a generic custom-field bag would outlive its uselessness — every future adapter faces pressure to dump unmapped data there, and every consumer faces an unreliable shape; refusing it now is cheaper than policing it forever.
- **Reversibility:** both choices are cheapest to revisit now; after M0-S6 consumes `comments` semantics, re-tightening is a v1-breaking change — the window closes with this change's merge, exactly as ADR-0004 recorded for `updatedAt`.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

**D-E — custom fields:**

|          | C-1 additive | C-2 named consumer | C-3 no native leak | C-4 truthful absence | C-5 neutrality | C-6 secrets |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| E-0 keep AC, no destination | n/a | pass | pass | **fail** | pass | pass |
| E-a additive custom-field record | pass | **fail** | **fail** | pass | pass | pass |
| E-b mapping rules only (chosen) | pass | pass | pass | pass | pass | pass |
| E-c narrow AC to mapping-only, drop typed evidence | n/a | pass | pass | **fail** | pass | pass |

**D-F — comment omission:**

|          | C-1 additive | C-2 named consumer | C-3 | C-4 truthful absence | C-5 | C-6 |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| F-0 do nothing (required array stays) | n/a | pass | pass | **fail** | pass | pass |
| F-a optional `comments`, absent = unknown (chosen) | pass | pass | pass | pass | pass | pass |
| F-b required array + omission flag | pass | pass | pass | **fail** | pass | pass |
| F-c degradation-evidence object | pass | **fail** | pass | pass | pass | pass |

### D-E Alternatives

### Alternative E-0 — Do Nothing (No Destination, Trap Evidences Only the Drop)

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Contract unchanged; the trap entry documents that custom fields are dropped.
- **Constraint compliance:** Fails C-4 — the quirk's normalized outcome ("normalize to typed data") is unrepresentable and unassertable; the ticket AC requires each quirk evidenced with an expected normalized outcome, not with a documented void.
- **Driver fit:** Fails drivers 1 and 5.
- **Pros:** Zero work beyond the trap entry.
- **Cons:** AC-F3-2 stays unprovable; TC-JIRA-002 stays blocked.
- **Why rejected:** The ticket mandates fixture-proven normalization behavior for this quirk.

### Alternative E-a — Additive Optional Custom-Field Record on `WorkItem`

- **Eligibility:** Not eligible (fails C-2 and C-3).
- **Summary:** Add e.g. `customFields?: Record<string, string | number | boolean>` carrying provider-native custom-field values.
- **Constraint compliance:** Fails C-2 — no consumer names a need for arbitrary custom-field values (M0-S6 hygiene is glossed, not authored; mapped-field conformance is answerable from normalized data). Fails C-3 — the keys are tenant-specific, so the record is a provider-native values bag under a normalized name; it directly conflicts with the already-planned no-raw-`customfield_*`-leak assertion (TC-JIRA-002 step 2).
- **Driver fit:** Fails driver 2 (maximum surface, zero named consumer); weakens driver 1 (an untyped escape hatch invites every adapter to dump unmapped data, de-normalizing the interface by attrition).
- **Pros:** Future-proof for unknown tenant-field needs; one field.
- **Cons:** Speculative surface the substrate forbids; unclosable key space; unreliable shape for consumers; a policing burden forever.
- **Why rejected:** Exactly the "speculative field without a named consumer" and "untyped escape hatch" the substrate and ADR-0004 precedent reject; the additive path stays open for a purpose-shaped field when a consumer names one.

### Alternative E-b — Documented Mapping Rules Only, No Contract Change (chosen)

- **Eligibility:** Eligible (passes all).
- **Summary:** The Jira seed declares reviewable mapping rules: which provider custom fields feed which normalized fields (typed at the boundary — e.g., numeric-as-string parsed per the declared type), and that unmapped custom fields are visibly unrepresented on `WorkItem` — never silently retained, never leaked as raw keys. The `JIRA-CUSTOM-FIELD-TYPING` trap entry evidences both the typed mapping and the visible non-representation against its fixture.
- **Constraint compliance:** C-1 trivially (no contract change); C-2 (the named consumers are the normalized fields the mapping feeds and the trap suite itself); C-3 (nothing native crosses); C-4 (no presence claim exists to be untruthful — the quirk trapped is the typing behavior, and non-representation is declared, not silent); C-5/C-6 untouched.
- **Driver fit:** Best on all six — maximal truth at minimal surface, fixture-provable, uniform with the WorkflowMap precedent (DM-4: provider-specific truth as declared, reviewable data beside the view).
- **Pros:** Zero contract growth; the mapping is data, reviewable without test code; M0-S6 hygiene over mapped fields is answerable from normalized data; a later purpose-shaped extension composes cleanly.
- **Cons:** Hygiene conformance for unmapped tenant fields is out of reach until a consumer names it; the AC wording must be corrected to mapping semantics (spec correction, not scope cut — the trap evidence requirement stands).
- **Why chosen:** The only option that satisfies every constraint while keeping the ticket's evidence requirement fully assertable.

### Alternative E-c — Narrow the AC to Mapping Semantics Only

- **Eligibility:** Not eligible as normally framed (fails C-4).
- **Summary:** Weaken AC-F3-2's custom-field clause so no typed-normalization evidence is required.
- **Constraint compliance:** Fails C-4 via the ticket AC — the ticket mandates each named quirk be evidenced by trap-catalog tests; an AC that no longer requires evidence for this quirk violates its source. (The benign reading of E-c — clarify the AC to *mapping* semantics while keeping the evidence requirement — is E-b; the GH-188 spec correction adopts exactly that wording.)
- **Driver fit:** Fails driver 5 (unprovable quirk).
- **Pros:** Least effort.
- **Cons:** Weakens ticket-AC coverage; normalizes skipping evidence for inconvenient quirks.
- **Why rejected:** Subsumed by E-b's benign reading; the evidence-weakening reading violates the ticket.

### D-F Alternatives

### Alternative F-0 — Do Nothing (Required `comments` Stays)

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Adapters emit `comments: []` when the provider omits the payload.
- **Constraint compliance:** Fails C-4 — omission collapses into a fabricated empty set, the exact misreading TC-JIRA-004 step 3 forbids.
- **Driver fit:** Fails drivers 1, 3, 5.
- **Pros:** None beyond inaction.
- **Cons:** A known quirk baked into every downstream read; TC-JIRA-004 permanently blocked.
- **Why rejected:** Same class as ADR-0004 ALT-0 (derive from comments) — rejected on truthfulness.

### Alternative F-a — Make `comments` Optional; Absent = Unknown (chosen)

- **Eligibility:** Eligible (passes all).
- **Summary:** `WorkItem.comments` becomes `readonly comments?: readonly WorkItemComment[]`. Present (including explicitly empty) = the provider-asserted comment set — empty means genuinely no comments. Absent = comment set unknown (provider omitted the payload for permission/paging causes, or the read did not fetch comments) — consumers must treat absent as "cannot determine", never as "no comments". Mirrors `updatedAt` absent-means-unknown one-to-one.
- **Constraint compliance:** C-1 — a producer-compatible relaxation: no field removed, retyped-to-required, or breaking for the zero existing consumers; the field-shape probe (already extended in this change for `updatedAt`, TC-CONTRACT-001) pins the optionality in both directions. C-2 — named consumers: TC-JIRA-004 (this change) and the M0-S6 collector (GH-175, first runtime consumer). C-4 — absence is the omission representation; nothing is fabricated. C-5 — type-shape only.
- **Driver fit:** Best on all six; uniform absence semantics across optional `WorkItem` fields.
- **Pros:** One field, one meaning; trap-provable with paired omitted/empty fixtures; reversible cheaply until M0-S6 lands.
- **Cons:** Every future consumer must handle `comments | undefined` (a real cognitive cost, shifted to consumers — acceptable with exactly zero today); the *cause* of omission (permission vs paging vs not fetched) is not represented.
- **Why chosen:** The ADR-0004 precedent maps one-to-one; no alternative represents omission with less surface or more truth.

### Alternative F-b — Keep Required Array, Add Additive Omission Flag

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Keep `comments: []` required and add e.g. `commentsOmitted?: true`.
- **Constraint compliance:** Fails C-4 — every omitted read still carries a fabricated empty array with a correction flag beside it; distinguishability is outsourced to a two-field joint invariant (`[]` + flag vs `[]` alone vs non-empty + flag = must be defined forbidden/policable), which C-4's never-fabricate intent rejects and driver 6 scores poorly.
- **Driver fit:** Fails drivers 3 (a second absence idiom diverging from `updatedAt`) and 6 (multi-field invariant policing).
- **Pros:** No relaxation of a delivered field; additive in the strictest sense.
- **Cons:** Two fields to interpret together; undefined-combination semantics to police; the array still lies on the exact quirk.
- **Why rejected:** More surface for less truth than F-a.

### Alternative F-c — Reuse the Degradation-Evidence Pattern

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Add a `CommentReadView`-style evidence object, e.g. `commentsEvidence?: { reason: "omitted" \| "not-fetched" \| ... }`.
- **Constraint compliance:** Fails C-2 — no consumer names a need for the omission *reason*; the envelope pattern it imitates exists for mechanically detectable metadata degradation with heuristic provenance to attach, none of which applies here.
- **Driver fit:** Fails driver 2 (heavier surface than absence); the reason enum is speculative until a consumer names it.
- **Pros:** Richer diagnostics later; pattern-consistent with envelope reads.
- **Cons:** Speculative now; duplicates what absence already represents.
- **Why rejected:** Absence already carries the needed truth; the reason field is the canonical future additive extension if a consumer ever names it (revisit trigger).

## Decision

- **Decision (D-E — custom fields):** Jira custom fields normalize per **documented mapping rules** with **no v1 contract change**: a provider custom field that feeds a normalized field is read as typed data at the boundary (per the mapping's declared type), and unmapped custom fields are **visibly unrepresented** on `WorkItem` — never silently retained, never leaked as raw provider keys. The mapping rules are declared, reviewable adapter data; the `JIRA-CUSTOM-FIELD-TYPING` trap entry (with its fixture) is the durable evidence of what maps typed and what is unrepresented. No custom-field container is added to `WorkItem`; a purpose-shaped additive extension remains available when a consumer names a need (revisit trigger).
- **Decision (D-F — comment omission):** `WorkItem.comments` becomes **optional** (`readonly comments?: readonly WorkItemComment[]`) with ADR-0004-style truthful-absence semantics: **absent = comment set unknown** (omitted by the provider for permission/paging causes, or not fetched); **present — including an explicitly empty array — = the provider-asserted comment set** (empty means genuinely no comments). Consumers must treat absent as "cannot determine", never as "no comments". The Jira and GitHub seeds populate `comments` only when the read actually obtained the set; the contract-inventory field-shape probe pins the optionality in the same change.
- **Rationale (tied to drivers):** Both choices maximize truth through the one normalized interface (driver 1) at minimal surface (driver 2) with uniform absence semantics (driver 3), zero consumer disruption today (driver 4), full fixture provability (driver 5), and no perpetual policing burden (driver 6) — and both run with, not against, every delivered substrate rule.
- **Decider:** Owner (Juliusz Ćwiąkalski) — acceptance pending at GH-188 PR review; this record stays Proposed until then.
- **Conditions for revisit:** See `revisit_triggers` in the front matter; the first M0-S6 consumption retro confirms or revises the absent-means-unknown consumer contract for `comments`.

### Constraint Compliance Attestation

The chosen alternatives (E-b, F-a) satisfy all constraints C-1 through C-6. No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- AC-F3-2 becomes fully assertable; TC-JIRA-002 and TC-JIRA-004 unblock with concrete, offline-provable assertions; the Jira trap catalog reaches its five-entry count with zero TODO clauses.
- The v1 `WorkItem` contract gains uniform absence semantics (`updatedAt`, `comments`: absent = unknown) — one consumer rule instead of per-field idioms.
- The contract stays free of an unclosable custom-field bag; the refusal is itself precedent that mapping discipline beats an escape hatch.
- Both choices ride the contract-inventory update already in this change (DM-6/TC-CONTRACT-001) — no extra mechanical cost beyond extending the probe to `comments`.

### Negative Outcomes

- Every future `WorkItem` consumer must handle `comments | undefined`; after M0-S6 consumes the semantics, re-tightening is a v1-breaking change (the reversibility window closes with this change's merge, as with `updatedAt`).
- Ticket-hygiene conformance for **unmapped** tenant custom fields is unreachable from normalized data until a named consumer justifies a further additive extension.
- The *cause* of comment omission (permission vs paging vs not fetched) is not represented; the trap entry records it as documentation only.
- The GH-188 spec and test plan require a correction pass (F-3/AC-F3-2 wording, DM rows, OQ/DEC rows, TC rewrites) — mechanical but real.

### Unresolved Questions

- [ ] Will M0-S6 hygiene v1 require unmapped custom-field conformance? (owner: M0-S6 story; if yes, propose the purpose-shaped additive extension then.)
- [ ] Do any Jira Data Center deployments return comment payloads inline on search-shaped reads, changing the recorded omission shape? (owner: @coder during fixture capture; M0-S20 live runs revalidate.)

## Implementation Plan

1. GH-188 delivery makes `comments` optional in `packages/core/src/contracts/ports.ts` (`WorkItem`) and extends the field-shape probe/fixture (TC-CONTRACT-001) to pin `readonly comments?: readonly WorkItemComment[]` alongside `updatedAt?: string` — no other contract file changes.
2. The Jira seed declares its custom-field mapping rules as reviewable data (what feeds which normalized field, with declared types; everything else visibly unrepresented) and populates `comments` only from actually-obtained payloads; the GitHub seed follows the same absence semantics for issue reads.
3. Trap suites: `JIRA-CUSTOM-FIELD-TYPING` asserts typed mapped values + no raw-key leak + visible non-representation; `JIRA-COMMENT-OMISSION` asserts absent-vs-present-empty distinguishability with a collapse-to-`[]` negative control.
4. Doc-sync phase updates feature-adapter-ports.md's `WorkItem` port-table row (optional `comments`, absence semantics) and the custom-field mapping discipline; the GH-188 spec/test-plan corrections land before delivery per the correction lists accompanying this record.

## Verification Criteria

- Metric: contract-inventory field-shape probe green with `comments` optional and `updatedAt` optional (both directions; absence of each representable) — Target: 100% — Window: GH-188 CI.
- Metric: trap entries proving (a) typed custom-field mapping + no raw-key leak and (b) comment omission ≠ present-empty, each with ≥1 fixture and a firing negative control — Target: both entries, controls fire — Window: GH-188 CI, offline.
- Metric: in-repo consumers broken by the relaxation — Target: 0 (`pnpm typecheck`, `pnpm check` green) — Window: GH-188 CI.
- Metric: secret-read allowlist entry count — Target: exactly 4 — Window: GH-188 CI.
- Metric: M0-S6 query families answerable from normalized data with unknown-comment-set representation — Target: demonstrable at M0-S6 delivery.

## Confidence Rating

High — both gaps and their causes are verified in the delivered contract and the blocked test cases; the chosen representations reuse a just-traversed precedent (ADR-0004) and the substrate's own declared-data pattern (WorkflowMap); the only Medium-confidence items (future M0-S6 needs) are explicitly parked as revisit triggers rather than load-bearing.

## References

- GH-188 spec (F-3, §8.3 DM/normalization rules, AC-F3-2, §24 coverage): `doc/changes/2026-10/2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-spec.md`
- GH-188 test plan (§5.2 TC-JIRA-002/TC-JIRA-004, §8.3 OQ-A/OQ-B): `doc/changes/2026-10/2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-test-plan.md`
- Delivered port contracts: `packages/core/src/contracts/ports.ts`; envelope degradation pattern: `packages/core/src/contracts/envelope.ts`
- Current spec truth: `doc/spec/features/feature-adapter-ports.md`
- [ADR-0004](ADR-0004-workitem-activity-timestamp-additive-v1.md) — the additive-v1 and truthful-absence precedent this record extends
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — contracts-tier tier rules
