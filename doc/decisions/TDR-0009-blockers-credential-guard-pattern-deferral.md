---
id: TDR-0009
decision_type: tdr
status: Proposed
created: 2026-11-06
decision_date: null
last_updated: 2026-11-06
summary: "The GH-230 blockers channel credential guard stays at the two declared layers — registered-secret-value refusal on every content path plus the variable-name shape on credential-missing question text — with no token-shape pattern layer; the unregistered-value residual on other content paths is a documented accepted risk, and pattern-based detection is deferred to a system-level shared content policy with named revisit triggers."
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os typed blocker and question channel (blockers CLI, M1-S16)
decision_scope: repo
review_date: null
business_impact: "Keeps the answer-and-resume flow free of false refusals (the change's core value conversion) while every registered credential value stays structurally refused; pattern-based secret scanning is not forked per-channel."
classification:
  domains: [security, privacy]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: local
  recurrence: one-off
governance:
  driver: "@pm (delegated the change-scoped decision in autonomous mode to unblock GH-230 specification)"
  decider: "Juliusz Ćwiąkalski — acceptance pending at GH-230 PR review; PM-fixed positions recorded here for delivery unblock (TDR-0006 precedent)"
  contributors:
    - "@spec-writer (DEC-2 layered guard design and the OQ-1 framing)"
    - "@decision-advisor (analysis and record)"
  reviewers: ["@reviewer", "@readiness-reviewer", "Human owner (PR review — security-residual acceptance is human-owned)"]
  performers: ["@spec-writer (OQ-1 closure fold)", "@coder (guard delivery per spec)"]
  informed: []
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M1-S20 (GH-242) delivers agent integration and lifecycle agents become primary publishers and answerers: reopen if agent-authored content raises unregistered-value transit risk (agents quote environment material mechanically and are not anchored by the human-facing remediation hint)."
  - "M1-S22 (GH-223) lands the invocation audit ledger and its audit-identity/credential posture review: confirm or revisit the accepted residual there."
  - "A shared injected content policy (the privacy-guard generic rules exposed as a reusable seam) becomes available: the blockers channel adopts it as a consumer via a reviewed change — the preferred superseding shape — rather than authoring channel-local patterns."
  - "Any incident in which an unregistered credential value transits the blockers channel (or any other content path): evidence flips this decision; the incident response chooses the system-level policy (preferred) or a channel-local set under the privacy-guard rule-governance discipline."
  - "Privacy-guard operating evidence (a real-violation or false-positive flurry against its generic rules) invalidates the premise that conservative pattern sets are governable at low false positives: revisit the residual assessment."
links:
  related_changes: ["GH-230"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-06--GH-230--typed-blockers/chg-GH-230-spec.md"
    - "doc/spec/features/feature-privacy-guard.md"
  contracts: []
  diagrams: []
  decisions: ["TDR-0006"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# TDR-0009: Blockers Credential Guard Boundary — Registered Values and Name-Shape Only; Pattern Layer Deferred

## Context

- **FACT:** GH-230 (M1-S16) delivers the typed blocker and question channel. Its authored DEC-2 fixes a two-layer credential guard: layer 1 refuses any content path (question text, option values, free-text answer) containing a **registered secret value** — the same registered-secrets record the serialization redaction chokepoint uses — with `blockers.credential-value-rejected`, exit 1, `not_landed`, zero persisted bytes; layer 2 restricts `credential-missing` **question text** to a declared variable-name shape so that question type is value-free by construction (chg-GH-230-spec F-3, DEC-2, NFR-6).
- **FACT:** The ticket pins (binding): "credential values never transit the channel" and "credential-missing with variable name only and never values" on questions **and** free-text answers alike; the verbatim ticket AC is "a credential-missing question or answer carries the variable name and never a value" (chg-GH-230-spec §1, G-3, §17).
- **FACT:** The residual is structural and already named by the spec, not silent: "Layer 1 … catches exactly the registered secret values … values absent from the registered set are out of layer 1's reach by design — that residual is OQ-1, not a silent gap" (§12), restated in §7.3 (Deferred) and RSK-2 (residual M).
- **FACT:** The registered-only posture is system-wide, not channel-local: the delivered redaction chokepoint matches registered secret values only, and layer 1 deliberately reuses that machinery (chg-GH-230-spec §2.1, §8.4, Appendix B). No content-transiting surface in the system performs pattern-based secret detection today.
- **FACT:** The repo's pattern-detection precedent is the privacy guard (GH-184, TDR-0006, delivered): seven generic secret/private-shape rules in committed code (`packages/adapters/src/io/privacy-rules.ts`), "high-specificity by design: they prioritize low false positives over recall, and rule tuning happens in code review rather than through registry data," a placeholder-suppression list, and a schema-versioned registry as the single authority — contract data, never operator-tunable configuration; "tightening or adding a rule requires a code change and an enabled-rule registry change in the same pull request" (doc/spec/features/feature-privacy-guard.md).
- **FACT:** Free-text answers are legitimate prose capped at 160 characters (question text 120; NFR-4), and the publish/answer path is live operator-facing from this change even though application is production-inert in v0 (`applied: false` until M1-S18/M1-S23; DEC-5). A false refusal blocks an operator mid-resume, directly against the change's purpose — "lane-idle hours convert into answer-and-resume seconds" (§ PURPOSE).
- **FACT:** The error family is closed at exactly four `blockers` rows (DEC-9); a future pattern layer would reuse the existing `blockers.credential-value-rejected` identity — extending detection later requires no new error row, no schema change, and no migration.

## Problem Framing (Clarified)

The guard's mechanism (layers 1+2, refuse-before-land, zero persisted bytes) is settled by DEC-2. The open question is the guard's **matching boundary**: may it also refuse content that merely *looks like* a credential (declared token-shape patterns, privacy-guard-style) even when the value was never registered in the environment record — and if so, on which paths?

The tension: pattern matching widens coverage to never-registered values, but every pattern rule is a bet that legitimate answer prose never matches it, and each false bet is an operator-facing refusal on the exact path (answer-and-resume) the change exists to make fast. Meanwhile the system's only existing pattern machinery (the privacy guard) carries real governance weight — committed rules, suppression lists, corpus tuning, code-review-gated rule edits — that a per-channel pattern set would duplicate at lower rigor, and the system-wide redaction boundary remains registered-only regardless of what this one channel does.

Desired outcomes: the pinned ticket AC holds structurally; no legitimate prose is refused; the guard is exactly testable; any residual risk is explicit, bounded, and owned; and extension remains cheaply adoptable later without contract churn.

Out of scope: the general pattern-detection story (the privacy guard owns that mechanism), the environment-record registration discipline, and any change to the redaction chokepoint.

## Constraints (Hard Requirements)

### C-1: `credential-missing` questions are value-free by construction

- **Statement:** A `credential-missing` question text must match the declared variable-name shape; anything beyond a name-shaped reference is refused at publish.
- **Source:** AC (GH-230 ticket, verbatim AC in spec §17)
- **Verification:** test (AC-F3-2 fixtures)
- **Negotiable:** no

### C-2: The guard evaluates every content path before landing; refusals persist zero bytes

- **Statement:** Question text, option values, and free-text answers are all guard-evaluated before any record lands; a refusal is `blockers.credential-value-rejected`, exit 1, consequence `not_landed`, zero persisted bytes.
- **Source:** AC (GH-230 ticket; NFR-6)
- **Verification:** test (AC-F3-1, negative controls per RSK-2)
- **Negotiable:** no

### C-3: Guard rules are contract data, never operator-tunable configuration

- **Statement:** Any guard rule — including any future pattern rule — is committed contract data evolving only through reviewed changes (the TDR-0006/privacy-guard discipline: rule code and registry/enabled-set edit in the same PR; no configuration key).
- **Source:** prior decision (TDR-0006) + internal standard (spec NG-8)
- **Verification:** code review
- **Negotiable:** no

### C-4: Guard evaluation is deterministic and exactly testable

- **Statement:** Guard evaluation is pure over its inputs with deterministic true/false outcomes demonstrable by fixtures (byte-identical across runs; true cases and negative controls both enumerated).
- **Source:** internal standard (planning-summary "precise, testable contract boundary"; NFR-1)
- **Verification:** test
- **Negotiable:** no

Table stakes inherited by every alternative: bounded content (NFR-4), refuse-before-land ordering, brand neutrality, and the closed four-row error family (DEC-9).

## Decision Drivers

Ranked; a single ordered list is authoritative.

1. **Zero false refusals on legitimate operator prose** — the change's core value conversion is "lane-idle hours into answer-and-resume seconds"; a false positive is an operator blocked mid-resume on the live publish/answer path. Free text legitimately carries spec quotes, option paraphrases, and identifier-shaped prose (commit ids, variable names).
2. **Posture consistency with the system-wide redaction boundary** — the serialization chokepoint matches registered values only; a per-channel pattern set forks the security posture (the channel refuses an unregistered token that every other surface lets transit), which is both inconsistent and expensive to explain forever.
3. **Reversibility / optionality** — adding patterns later is a contract-data edit with no new error identity, schema change, or migration; deferring keeps that option open at near-zero cost, while retracting an adopted pattern layer after operator harm means walking back a refusal behavior operators have planned around.
4. **Scope discipline** — this change is the question channel; general token-shape secret scanning is the privacy-guard mechanism with its own story, governance, and corpus. Importing a mini version duplicates that machinery at worse rigor.
5. **Coverage of never-registered credential values** — the one driver favoring patterns; strongest on credential-adjacent paths where paste-the-secret temptation is highest.
6. **Maintenance and governance cost** — a pattern set needs a false-positive corpus, a suppression/marker policy (the privacy guard needed one), and a rule owner; that machinery outlives the change and must be staffed forever.

## Decision Rights (DACI)

- **Driver:** `@pm` — delegated the change-scoped decision in autonomous mode to unblock GH-230 specification (OQ-1: "Decision needed: consult `@decision-advisor`"); `@decision-advisor` analyzed and authored this record.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. The positions recorded here are PM-fixed under that delegation for delivery unblocking; **acceptance — including acceptance of the documented security residual — is pending at the GH-230 PR review.** No acceptance is claimed by this record; it stays `Proposed` with `decision_date: null` until the owner accepts.
- **Contributors:** `@spec-writer` (DEC-2 layered guard design, OQ-1 framing); `@decision-advisor` (analysis, record).
- **Required reviewers:** `@reviewer` and `@readiness-reviewer` during delivery; the human owner at PR review. Security-residual acceptance is human-owned (TDR-0006 / ADR-0003 precedent).
- **Performers:** `@spec-writer` folds the OQ-1 closure into the change spec; `@coder` delivers the guard per the spec.
- **Informed:** none beyond the GH-230 change artifacts and PR.
- **Timing and escalation:** recorded during GH-230 specification, before delivery tasks execute; implementation may proceed with acceptance pending (TDR-0003/TDR-0004/TDR-0006 precedent). Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The redaction chokepoint and layer 1 match registered secret values only; no content-transiting surface performs pattern-based detection today. | FACT | Result contract via chg-GH-230-spec §2.1, §8.4, Appendix B | The consistency driver (D2) collapses; channel-local patterns would extend rather than fork the posture. | High |
| The privacy guard's generic rules are high-specificity/low-recall by design, tuned in code review, with a committed suppression list and registry authority; rule edits need code + registry changes in one PR. | FACT | doc/spec/features/feature-privacy-guard.md; TDR-0006 | The governance-cost driver (D6) would be overstated; a channel pattern set would be cheap to govern. | High |
| A future pattern layer needs no new error identity, schema change, or migration — `blockers.credential-value-rejected` and the record shapes already exist. | FACT | chg-GH-230-spec DEC-9, DEC-11, NFR-5 | Later adoption would carry contract churn; the deferral option (D3) would be weaker. | High |
| Content is bounded (question ≤120 chars, options ≤4×60, answer ≤160 chars). | FACT | chg-GH-230-spec NFR-4 | Residual exposure would be unbounded; the accepted-risk bounding argument weakens. | High |
| Conservative, prefix-anchored token patterns would have low false-positive rates on legitimate answer prose. | ASSUMPTION | Privacy-guard design goal ("low false positives over recall"), not yet measured on channel prose | Pattern alternatives would be worse than assessed; deferral remains safe (its FP rate is zero by construction). | Medium |
| The dominant paste-the-secret hazard follows the operator's clipboard, not the question type — a secret can be pasted as an answer to any question type. | ASSUMPTION | Reasoning over the grammar (free `--text` on three types); no incident data exists | Narrow-path targeting (ALT-2) would capture most of the real hazard and its rejection rationale needs the posture/consistency arguments to carry the decision. | Medium |
| The practically relevant credential surface of the delivery workflow is (or can cheaply be) registered in the environment record, making layer 1 the effective first line. | ASSUMPTION | Environment-record/redaction seam design (delivered) | If registration coverage is poor, the residual is larger than assessed; the registration-discipline unresolved question below covers this. | Medium-High |
| Real-world false-positive profile of any future pattern set against actual channel prose. | TO-CONFIRM | Deferred with this decision; verified by corpus + mutation tests under the privacy-guard discipline when a revisit trigger fires | A future adoption would need its own measurement before landing. | — |

## Mental Models & Techniques Used

- **Inversion ("how would a secret transit?"):** registered values → refused by layer 1 on every path; unregistered values on `credential-missing` questions → structurally impossible (layer 2 name-shape); unregistered values elsewhere → the one remaining channel, now made explicit and owned rather than discovered later.
- **Real options / reversibility asymmetry:** deferral keeps the adoption option alive at near-zero carrying cost (no contract churn to exercise it); adopting now buys partial coverage at the price of a refusal behavior that is socially hard to retract.
- **Second-order thinking:** pattern refusals on prose train operators to paraphrase around the guard; a channel-local pattern set also creates a two-posture system that reviewers must forever reconcile ("why did blockers refuse what the brief rendered?").
- **Systems thinking:** the environment record is the single registration seam — coverage scales with registration, and registering a value immediately brings it under both layer 1 and the system chokepoint. Pattern detection is the second line for where registration fails, and its natural home is the system-level policy, not one channel.
- **Least mechanism (KISS):** two exactly-testable rules (registered-value match, name shape) beat a rule corpus plus suppression machinery for a change whose guard is one capability among seven.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

All four alternatives satisfy C-1 and C-2 (all keep layers 1 and 2 and the refuse-before-land machinery); all satisfy C-4 (any committed rule set is deterministic and fixture-testable — precision is a driver, not a constraint). C-3 is satisfied by ALT-1/ALT-2/ALT-3 only as declared: patterns must land as committed contract data under the privacy-guard rule-governance discipline, which is part of each alternative's cost, not a differentiator. No constraint eliminates any alternative; the decision is made on drivers.

### Alternative 0 — Layers 1+2 Only, Pattern Extension Explicitly Deferred (selected)

- **Eligibility:** Eligible (C-1 ✅ C-2 ✅ C-3 ✅ vacuously — no pattern rules exist — C-4 ✅).
- **Summary:** Ship the spec as written: registered-value refusal on every content path plus the variable-name shape on `credential-missing` questions; close OQ-1 as "deferred, explicit" with named revisit triggers and this record's documented residual.
- **Constraint compliance:** Passes all; see attestation.
- **Driver fit:** Best on D1 (zero false refusals by construction), D2 (one posture with the system chokepoint), D3 (adoption option fully preserved), D4 (no scanner machinery in this change), D6 (nothing to govern). Worst on D5 — the residual is accepted rather than narrowed.
- **Pros:** Exactly testable; zero operator friction; no posture fork; later adoption is a contract-data edit.
- **Cons:** An unregistered credential value in a non-`credential-missing` question, option, or free-text answer transits and persists (accepted residual below).
- **Why chosen:** See Decision.

### Alternative 1 — Conservative Declared Pattern Set on All Content Paths

- **Eligibility:** Eligible (C-1 ✅ C-2 ✅ C-3 ✅ as committed contract data C-4 ✅).
- **Summary:** Add a privacy-guard-style pattern set (well-known token shapes, prefix-anchored, high-specificity) evaluated on every content path in the same guard pass.
- **Constraint compliance:** Passes all — but C-3 imports the full governance duty: rule code + enabled-set edit in one reviewed PR, suppression policy, corpus tests.
- **Driver fit:** Best on D5 (partial — see below); worst on D1 (every prose path exposed to false refusals), D2 (the channel becomes the only pattern-scanning content surface in the system — a posture fork), D4 (a general secrets scanner inside the question-channel change), D6 (a rule corpus to own forever).
- **Pros:** Narrows the residual for well-known token shapes; single guard pass; no new error identity needed.
- **Cons:** Coverage gain is bounded by conservatism — a conservative set catches prefixed tokens (`ghp_…`, `glpat-…`) but not raw secrets or passwords, so the residual is narrowed, not closed, while the false-refusal surface and governance cost are all incurred now.
- **Why rejected:** Trades the change's core driver (D1) and posture consistency (D2) for a partial D5 gain; if D5 ever dominates, the right shape is ALT-3, not a channel-local set.

### Alternative 2 — Patterns Only on the `credential-missing` Path (Question Text + Answers to credential-missing Questions)

- **Eligibility:** Eligible (C-1 ✅ C-2 ✅ C-3 ✅ as contract data C-4 ✅).
- **Summary:** Apply the pattern set only to `credential-missing` question text and free-text answers to `credential-missing` questions.
- **Constraint compliance:** Passes all; C-3 governance duty identical to ALT-1.
- **Driver fit:** Middle on D5 (targets the highest-temptation answer path); still negative on D2/D4/D6 (same machinery, partial placement) and exposes the credential-missing answer path — itself legitimate prose ("set in the environment; re-run the lane") — to false refusals (D1). Layer 2 already makes the question text structurally value-free, so the marginal add is only the answer path.
- **Pros:** The narrowest targeting of the paste-the-secret moment.
- **Cons:** The paste hazard follows the clipboard, not the question type (Evidence table) — the same pasted token transits as an answer to a `spec-ambiguity` question; inherits most of ALT-1's cost for partial coverage; leaves a permanent "why here and not there?" asymmetry to document and defend.
- **Why rejected:** Inherits ALT-1's governance and posture costs while conceding most of its coverage; a middle option that pays for both sides and fully delivers neither.

### Alternative 3 — Pattern Detection as a Shared System-Level Content Policy (deferred adoption shape)

- **Eligibility:** Eligible (C-1 ✅ C-2 ✅ C-3 ✅ C-4 ✅) — but out of GH-230's scope.
- **Summary:** Extend the privacy-guard generic rules into a reusable injected content policy consumed by **all** content-transiting surfaces — the blockers channel, the serialization redaction chokepoint, and downstream renders — delivered by its own story with its own corpus, suppression policy, and tests.
- **Constraint compliance:** Passes all for the blockers consumer; the system-level change carries its own constraints outside this record's scope.
- **Driver fit:** Best long-run D2 (one posture, one rule source), good D5 (system-wide coverage), but fails D4 for **this** change (touches every content surface, needs a dedicated story) and is not deliverable inside GH-230's scope.
- **Pros:** The only shape in which pattern detection does not fork the posture; consistent with TDR-0006's single-source-of-truth design (generic rules already shared between the file check and the emitter policy).
- **Cons:** Not this change; requires its own decision, story, and delivery.
- **Why rejected now, recorded permanently:** Rejected for GH-230 on scope and timing; recorded as the **preferred future adoption shape** — revisit trigger 3 names it, and trigger 4 routes an incident to it (or, failing that, to ALT-1 under the privacy-guard discipline).

## Decision

- **Decision:** **ALT-0.** The GH-230 credential guard ships as authored (DEC-2): layer 1 registered-secret-value refusal on every content path, layer 2 variable-name shape on `credential-missing` question text — **no token-shape pattern layer**. OQ-1 closes as *deferred, explicit*: pattern-based detection of never-registered values is out of scope for this change, the unregistered-value residual is a documented accepted risk (below), and any future adoption takes the ALT-3 shape — a shared system-level content policy consumed by this channel — never a channel-local pattern set, unless an incident forces the narrower ALT-1 response under the privacy-guard rule-governance discipline.
- **Rationale (tied to drivers):** The pinned ticket AC (C-1) is met structurally by layer 2, and every registered value is refused by layer 1 on every path (C-2) — the guard's *mechanism* is complete; the open question was only its matching boundary. ALT-0 is the only alternative with a zero-by-construction false-refusal rate (D1) on a live operator path whose entire purpose is speed (the change's KPI "credential values persisted or rendered: 0" is defined against exactly this guard and is met). It preserves the single registered-only posture shared with the system chokepoint (D2), keeps the adoption option exercisable later with zero contract churn (D3 — no new error row, schema, or migration), keeps scanner governance out of the question-channel change (D4, D6), and pays for it only on D5 — where the coverage ALT-1/ALT-2 would buy is bounded by conservative-pattern conservatism anyway (prefixed tokens yes, raw secrets no), so the residual is narrowed, never closed, by any defensible pattern set. ALT-2 additionally targets a hazard that follows the clipboard rather than the question type. When D5 evidence arrives (an incident, or agent publishers at M1-S20), ALT-3 is the shape that fixes it without forking the posture.
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-230 PR review; not claimed by this record. Positions PM-fixed under the delegated autonomous change-scoped authority for delivery unblocking; the security-residual acceptance in particular is human-owned.
- **Conditions for revisit:** See `revisit_triggers` in the front matter; primary ones are M1-S20 agent publishers, the M1-S22 audit posture review, availability of a shared pattern-policy seam, and any transit incident.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints: C-1 via layer 2's structural name-shape rule (AC-F3-2); C-2 via layer 1 on every content path with refuse-before-land and zero persisted bytes (AC-F3-1, NFR-6); C-3 vacuously (the guard's two rule sources — the registered-secrets record and the name-shape datum — are committed contract data, and no pattern rules exist); C-4 via deterministic fixture-testable evaluation (AC-F3-1/2/3). No accepted-risk exceptions are taken against any constraint.

The unregistered-value residual is **not** a constraint violation: the ticket's testable AC scopes the name-never-value requirement to `credential-missing` questions and answers, both held to the contract (C-1 structurally; the answer path by layer 1 plus the remediation hint). The broader "credential values never transit the channel" goal is pursued by the delivered guard and bounded by the accepted risk below — a consciously documented residual (spec §12 already declares it OQ-1's subject), not a silent gap and not a failed gate.

## Trade-offs & Consequences

### Positive Outcomes

- Zero false refusals on legitimate prose by construction — the answer-and-resume path never fights its own guard.
- One security posture across the system: the channel's matching boundary equals the redaction chokepoint's; no "why did blockers refuse what the brief rendered?" divergence to maintain.
- The smallest exactly-testable guard: two rules, deterministic fixtures, negative controls (RSK-2 mitigation unchanged).
- Adoption option preserved at zero carrying cost: a later pattern layer is a contract-data edit reusing `blockers.credential-value-rejected` — no error row, schema bump, or migration.
- Scope kept honest: the change delivers the question channel, not a secrets scanner.

### Negative Outcomes

- **Accepted residual:** a credential value that was never registered in the environment record can transit — in a non-`credential-missing` question, an option value, or any free-text answer (including an answer to a `credential-missing` question) — and would persist in the local ledger and render on the blockers list, digest section, and brief anchor. Bounded by: content caps (120/160 chars); the local-first, single-user posture; layer 2 making the highest-temptation question type structurally value-free; the remediation hint stating the name-only contract on every refusal; the registration seam (registering a value immediately brings it under layer 1 **and** the system chokepoint); and the M1-S20/M1-S22/privacy-guard revisit triggers above.
- The residual must be carried forward in the delivered feature spec's accepted-residuals section — if the doc-sync phase omits it, the deferral degrades into a silent gap (the exact failure mode this record exists to prevent).
- A determined or careless operator can still defeat the channel's hygiene by pasting an unregistered secret; the guard was never claimed to be that control.

### Unresolved Questions

- [ ] Spec tightening (owner: `@spec-writer`, folds with the OQ-1 closure): AC-F3-3's "given a value-shaped free text, then it is refused per AC-F3-1" should state that the refusal is the **registered-value match** (AC-F3-1's rule); unregistered value-shaped text is this record's accepted residual, and the AC as worded can be read to promise shape-based refusal.
- [ ] The channel's feature spec must record the accepted residual and the revisit triggers at system_spec_update (owner: `@doc-syncer`).
- [ ] Confirm the delivery workflow's real credential surface stays registered in the environment record so layer 1 remains the effective first line (owner: Juliusz Ćwiąkalski, operational discipline).
- [ ] M1-S20 delivery must assess agent-authored answers against the residual (revisit trigger 1) (owner: `@pm`).

## Implementation Plan

1. `@spec-writer` closes OQ-1 in the change spec referencing TDR-0009: DEC-2 unchanged (layers 1+2 as written), §7.3's deferred row now pointing at this record, and the AC-F3-3 wording tightened per the unresolved question above.
2. `@coder` delivers the guard per the spec: layer 1 + layer 2 only, with AC-F3-1/2/3 fixtures and the RSK-2 negative controls; no pattern machinery.
3. `@doc-syncer` records the accepted residual and revisit triggers in the channel's feature spec; the change spec's `links.decisions` gains `TDR-0009`.
4. If a revisit trigger fires: open a superseding decision choosing ALT-3 (preferred) or ALT-1; adoption lands as contract data under the privacy-guard rule-governance discipline — rule definitions and enabled-set edit in one reviewed PR, with a measured false-positive corpus against real channel prose before the first refusal ships.

## Verification Criteria

- The channel KPI "credential values persisted or rendered: 0" holds as defined against the declared guard — AC-F3-1/2/3 green in delivery; 100% of content paths guarded; 0 refused-but-landed records (NFR-6).
- Zero false refusals of legitimate prose — structural under ALT-0; spot-checked in use once the channel is live.
- Residual monitoring: no incident of an unregistered credential value transiting the channel (or any content path); any occurrence reopens this decision per revisit trigger 4.
- Process checkpoints: revisit confirmed at M1-S20 and M1-S22 delivery; first retrospective after GH-230 implementation sets `review_date` (front matter) per the iterative review cycle.

## Confidence Rating

**Medium-high.** The chosen composition reuses delivered, mutation-tested machinery (the registered-secrets record and redaction seam) plus one exactly-testable name-shape rule; the constraints are met structurally; and the deferral's reversibility is a verified fact (no new error identity or schema needed). The open halves are empirical and deferred honestly rather than assumed away: the false-positive profile of any future pattern set on real channel prose (TO-CONFIRM), and the agent-publisher risk at M1-S20. AI-generated confidence is not evidence; the owner's acceptance at PR review is the authoritative signal.

## References

- Change spec: `doc/changes/2026-11/2026-11-06--GH-230--typed-blockers/chg-GH-230-spec.md` — OQ-1 (§14), DEC-2 (§15), F-3 (§5.1), NFR-4/NFR-6 (§9), RSK-2 (§11), residual assumption (§12), deferred row (§7.3), AC-F3-1/2/3 (§17).
- Ticket GH-230 (M1-S16: Typed blocker and question channel) — pinned ACs.
- Privacy guard feature spec: `doc/spec/features/feature-privacy-guard.md` — pattern-rule discipline (committed rules, high-specificity design, registry authority, one-PR rule governance).
- [TDR-0006](TDR-0006-privacy-and-no-cloud-guard-mechanics.md) — pattern-detection precedent, PM-fixed-positions/acceptance-pending governance precedent, and the false-positive-flurry revisit discipline.
- Result contract (via change spec §2.1, Appendix B) — the registered-only redaction chokepoint layer 1 reuses.
- Downstream stories named in revisit triggers: M1-S20 (GH-242, agent integration), M1-S22 (GH-223, invocation audit ledger), M1-S18/M1-S23 (GH-238/GH-241, applying actors).
