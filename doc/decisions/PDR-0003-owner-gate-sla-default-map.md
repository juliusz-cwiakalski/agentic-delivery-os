---
id: PDR-0003
decision_type: pdr
status: Accepted
created: 2026-11-06
decision_date: 2026-11-06
last_updated: 2026-11-06
summary: "The initial owner-gate SLA default map: exactly two gate kinds (owner-review, waiver); owner-review is never-merge and carries NO pre-agreed default (perpetual visible escalation); waiver is defaultable with the single v0 default owner-review-first; any extension is an owner-signed policy-data change."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_scope: repo
review_date: null
business_impact: "None directly — shapes how much autonomous proceed authority the delivery tool may exercise near owner decisions."
customer_impact: "Adopters get a least-privilege SLA policy: the only automatic proceed decision v0 can make is itself a deferral to the owner, and every decision is recorded and inspectable."
classification:
  domains: [product, governance, security]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (consulted by @pm for GH-229 OQ-1)"
  decider: "Juliusz Ćwiąkalski — adopted for the GH-229 autonomous delivery run under the PM unblock delegation; final acceptance rides the GH-229 PR review (owner-vetoable there)"
  contributors:
    - "@pm (OQ framing, ticket-pinned constraints, autonomous-unblock context)"
    - "@spec-writer (chg-GH-229-spec OQ/DEC context)"
  reviewers:
    - "Juliusz Ćwiąkalski (GH-229 PR review — ratify or veto)"
    - "@decision-critic (optional independent challenge; R2)"
  performers:
    - "@coder (GH-229 delivery — encode the map as DM-3 contract data + tests)"
  informed:
    - "GH-228 (M1-S6 brief — consumes slaState/age, not the policy map)"
    - "GH-230 (M1-S16 coordinator audience — inherits the extension pattern)"
    - "M2-S4 fleet grid (same SLA state source)"
ai_assistance:
  used: true
  roles: [researcher, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A new gate kind is proposed (e.g. by the M1-S16 coordinator audience) — it must go through owner sign-off as a policy-data change before any default exists."
  - "The verify-gates/merge story's delivered classification contradicts mapping owner-review to the never-merge class — reconcile the class column (the no-default assignment for owner-review remains the safe reading either way)."
  - "Observed owner disagreement with waiver gates being reclassified by the owner-review-first default at 72 h — veto/amend at PR review or later via a superseding record."
  - "The 72 h expiry proves too coarse or too fine in practice — threshold review per the contract-data change path."
links:
  related_changes: ["GH-229"]
  supersedes: []
  superseded_by: []
  spec: ["doc/changes/2026-11/2026-11-06--GH-229--owner-gate-sla/chg-GH-229-spec.md"]
  contracts: []
  diagrams: []
  decisions: ["ADR-0004", "ADR-0006"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# PDR-0003: Owner-Gate SLA Initial Pre-Agreed Default Map

## Context

GH-229 (M1-S5: owner-gate SLA) delivers the aging mechanism for owner gates: 24 h stale-review escalation, 72 h default-on-expiry, exactly one pre-agreed default per gate kind/class held as policy-as-data, silence impossible, and an escalation mechanism reusable by M1-S16's coordinator audience (GH-230). The mechanism is specified; the **initial content of the policy table** is not. OQ-1 in the change spec leaves it open: what is the initial closed gate-kind/class vocabulary, each kind's never-merge classification, and the one default per defaultable kind?

Situational facts prompting the decision:

- The ticket pins "one pre-agreed default per gate" without saying whether *every* kind must carry one.
- The M1 planning pack's board worked example shows a `waiver`-kind gate at 2 days rendering `default-applied` with default `owner-review-first`; an `owner-review` gate at 26 h renders `escalated` with `default: null`. The pack pins exemplar *kinds* (`owner-review`, `waiver`) but not the full policy table.
- The change spec already encodes the permissive reading: G-2 states "**at most** one pre-agreed default exists per gate kind/class … a gate without a pre-agreed default keeps escalating", and AC-F3-2 tests the no-default path explicitly.
- The map is precedent-setting twice over: it is the template M1-S16 will copy for the coordinator audience's default posture, and it establishes the §22 pattern that adding a default is a policy-data change gated on owner sign-off.
- The decision is needed mid-delivery (autonomous mode) to unblock encoding of DM-3 contract data; the owner's accountability point is the GH-229 PR review.

## Problem Framing (Clarified)

The decision question: **what is the initial gate-kind/class vocabulary, and which kinds (if any) get the one pre-agreed default — such that the ticket's pins hold (one default per gate, silence impossible, never-merge never auto-proceeds) while owner authority over the riskiest asks is structurally preserved?**

Root cause framing: the ticket's "one pre-agreed default per gate" is a **uniqueness and no-invention constraint**, not a completeness mandate. Two readings:

1. *Completeness reading*: every gate kind must carry a default (the 72 h mechanism always fires).
2. *Uniqueness reading*: at most one default per kind (exactly one when the kind is defaultable), none invented at runtime; kinds without a default satisfy the ticket through the never-silence guarantee — perpetual, visible escalation.

The change spec (validated against the ticket at clarify_scope) already commits to the uniqueness reading: G-1's "ages into escalation **or** a proceed decision" makes escalation a first-class satisfying terminal, G-2 says "at most one", and AC-F3-2 exists precisely to test default-free escalation. F-5 additionally requires at least one non-defaultable class to exist (never-merge); under the completeness reading F-5 would be vacuous.

The residual decision is therefore the **content**: which kinds, which classes, which default(s) — chosen under least privilege near owner authority.

## Constraints (Hard Requirements)

Table stakes acknowledged once (every alternative below satisfies them by construction): policy data lives in the contracts tier per DEC-2; thresholds stay pinned at 24 h / 72 h; the escalation mechanism stays audience-parameterized per F-8/DEC-4.

### C-1: Never-merge classes are never auto-proceeded

- **Statement:** No proceed default is ever auto-applied to a gate in a never-merge class; an expired never-merge gate continues in `escalated` indefinitely and visibly; the only override is a recorded waiver authored by a principal authorized for the class.
- **Source:** Ticket GH-229 + change spec F-5 / AC-F5-1 (prior decision level: pinned).
- **Verification:** Test (AC-F5-1) + code review of the policy table's class column.
- **Negotiable:** no

### C-2: Defaults are genuine, pre-agreed, policy-as-data decisions

- **Statement:** At most one pre-agreed default per gate kind/class, held as contract data, never invented at runtime; every declared default is a genuine proceed decision (reclassifies proceed posture) — no sentinel or no-op values dressed up as defaults.
- **Source:** Ticket GH-229 + spec F-3 / F-4 / DEC-2.
- **Verification:** Code review of the contract data + tests (AC-F3-1, AC-F4-1).
- **Negotiable:** no

### C-3: Silence is impossible for every kind

- **Statement:** Every gate past an SLA threshold is visibly `escalated` or `default-applied` on every evaluation, including unknown-age gates (escalated, never fresh, never zero-age).
- **Source:** Ticket acceptance criterion + spec G-1 / F-6 / DEC-6 / AC-F6-2 / AC-F1-2.
- **Verification:** Tests (AC-F6-2, AC-F1-2).
- **Negotiable:** no

### C-4: The pinned 72 h default-on-expiry mechanism is exercisable at ship time

- **Statement:** The initial map includes at least one defaultable kind, so the ticket-pinned default-on-expiry mechanism and its audit record are reachable and testable in v0 (AC-F3-1 is not dead-lettered).
- **Source:** Ticket GH-229 (72 h default-on-expiry is a pinned constraint) + spec F-3.
- **Verification:** Test (AC-F3-1) against the shipped policy table.
- **Negotiable:** no

### C-5: Extension is an owner-signed policy-data change

- **Statement:** Adding a gate kind, changing a class, or adding a default is a contract-data edit gated on explicit owner sign-off — never a code change, never a runtime addition, never silent.
- **Source:** Change spec §22 (OQ-1 pattern) + DEC-2.
- **Verification:** Code review (policy file diff visible at PR) + process (sign-off recorded).
- **Negotiable:** no

## Decision Drivers

1. **Owner-authority preservation (highest).** Least privilege near owner-merge authority; irreversible trust damage from a wrong auto-proceed must be structurally impossible, not merely unlikely.
2. **Precedent quality for M1-S16.** This map is the template the coordinator audience's default posture will copy; it should encode "riskiest ask class gets no default; only deferral-shaped defaults ship".
3. **Ticket and planning-pack fidelity.** The worked example (`owner-review-first` on waiver) and the pinned constraints should be honored as-written where safe.
4. **Audit-trail cleanliness.** Every EVT-1 record must be a real decision; no non-decision events polluting the ledger (F-4/NFR-7).
5. **Minimal vocabulary / low cognitive load.** No speculative kinds without delivered consumers (YAGNI; the spec assumes "at least owner-review and waiver").
6. **Determinism and inspectability of the policy table.** One row per kind, closed set, trivially reviewable.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (consulted by `@pm` for OQ-1 resolution in autonomous delivery mode).
- **Decider / Approver:** Juliusz Ćwiąkalski (owner). The decision is **adopted for the GH-229 delivery run** under the PM's autonomous-unblock delegation; **final acceptance rides the GH-229 PR review** — the owner ratifies or vetoes there (see Decision).
- **Contributors:** `@pm` (constraints, framing), `@spec-writer` (spec DEC/OQ context).
- **Required reviewers:** owner at GH-229 PR review; `@decision-critic` optional (R2 — challenge valuable, not mandatory).
- **Performers:** `@coder` (encode DM-3 contract data + tests).
- **Informed:** GH-228 (M1-S6 brief), GH-230 (M1-S16 coordinator audience), M2-S4 fleet-grid consumers.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Planning-pack worked example: waiver gate at 2 days → `default-applied`, default `owner-review-first`; owner-review gate at 26 h → `escalated`, `default: null` | FACT | chg-GH-229-spec Appendix A (planning-pack board.md excerpt) | The exemplar default name would need re-sourcing; map shape unchanged | High |
| Ticket pins: 24 h escalation, 72 h default-on-expiry, one pre-agreed default per gate, silence impossible, M1-S16 mechanism reuse | FACT | Ticket GH-229 as pinned in spec §1/§17 (binding constraints) | None — this is the constraint base | High |
| Spec G-2 states "at most one" default per kind; AC-F3-2 tests the no-default path (escalation continues, nothing invented); G-1 accepts "escalation OR a proceed decision" | FACT | chg-GH-229-spec §4/§17 | None — this is the interpretive basis; if the owner reads the ticket as completeness instead, the map's owner-review row is the amendment point (veto at PR) | High |
| F-5/AC-F5-1 structurally exclude never-merge classes from auto-proceed | FACT | chg-GH-229-spec §5.1/§17 | None — constraint | High |
| `owner-review` maps to the never-merge class under the verify-gates/merge classification | ASSUMPTION | Spec §2.1 (verify gates' owner-gate merge gate fails while labels present → owner-review asks block merge) + glossary "Never-merge class" | Class column adjusts; the no-default assignment for `owner-review` remains the safe reading either way (robust: no-default is safe under either classification) | Medium-High |
| No downstream consumer (M1-S6 brief, M2-S4 grid) requires every kind to carry a default; they consume slaState/age, not the policy map | ASSUMPTION | Spec §2.1/§13 (downstream consumers listed) | Revisit via the spec §7.3 deferral path; would surface as an owner-signed extension | Medium-High |
| M1-S16's coordinator audience will need its own default posture (kinds/classes of its own) | TO-CONFIRM | Spec F-8/DEC-4 (seam only; NG-1) | Out of scope here; the C-5 extension pattern governs when it lands | n/a |

## Mental Models & Techniques Used

- **Least privilege:** grant the autonomous mechanism the minimum proceed authority that still exercises the pinned 72 h mechanism.
- **One-way vs two-way doors (irreversibility asymmetry):** a wrong auto-proceed on an owner review is irreversible trust damage; a permanently escalated gate is recoverable (the owner answers any time). Prefer the recoverable posture wherever the ticket permits.
- **Inversion:** "What would make silence possible?" (a kind with no default *and* no visible escalation — excluded by C-3) and "What would make a wrong auto-proceed possible?" (a default on a never-merge class — excluded by C-1). The map eliminates both failure modes by construction.
- **Second-order thinking:** the first automatic proceed decision ever made sets the precedent the coordinator audience copies; making it a deferral-to-owner teaches the right precedent.
- **Policy-as-data / single source of truth:** the map is contract data in the contracts tier, review-gated, never runtime-invented (DEC-2 precedent).
- **YAGNI:** exactly the two delivered kinds; no speculative vocabulary.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 | C-2 | C-3 | C-4 | C-5 |
|----------|-----|-----|-----|-----|-----|
| ALT-0 — no defaults anywhere | ✅ | ✅ (vacuous) | ✅ | ❌ | ✅ |
| ALT-1 — least-privilege map (waiver defaulted, owner-review default-free) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 — default-everything (proceed-flavored default on owner-review too) | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 — completeness with no-op default (owner-review gets a non-proceed sentinel default) | ✅ (letter) | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via an accepted-risk exception (none used).

### Alternative 0 — Do Nothing / No Defaults Anywhere

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Ship the mechanism with an empty default map; every gate escalates forever until the owner answers.
- **Constraint compliance:** C-1 ✅, C-2 ✅ vacuously, C-3 ✅ (all gates perpetually escalated), **C-4 ❌** — no defaultable kind means the ticket-pinned 72 h default-on-expiry mechanism is unreachable, AC-F3-1/AC-F4-1 are dead-lettered, and the EVT-1 audit substrate ships unused. C-5 ✅.
- **Driver fit:** Scores well on driver 1 (owner authority) but fails the ticket's pinned mechanism (driver 3).
- **Pros:** Maximally conservative; zero auto-proceed risk.
- **Cons:** Contradicts the ticket pin and the planning-pack worked example; the "never idles on an unanswered ask" intent is unaddressed for defaultable classes.
- **Why rejected:** Disqualified by C-4.

### Alternative 1 — Least-Privilege Map (chosen)

- **Eligibility:** Eligible (passes C-1 … C-5).
- **Summary:** Exactly two kinds. `owner-review` → never-merge class, **no pre-agreed default** (non-defaultable by design). `waiver` → waiver class (defaultable), pre-agreed default **`owner-review-first`**. Closed vocabulary; extension owner-signed.
- **Constraint compliance:** All ✅ — see the Decision section's attestation.
- **Driver fit:** Best on drivers 1, 2, 4, 5, 6; exact on driver 3 (matches the worked example verbatim). The only automatic proceed decision v0 can make is itself a deferral to the owner — the map makes the first autonomous decision "ask the owner", which is the right precedent for M1-S16.
- **Pros:** Irreversibility-averse; ticket-compliant via the uniqueness reading; matches the pack example; audit trail records only real decisions; trivially reviewable two-row table.
- **Cons:** `owner-review` gates past 72 h never resolve via the SLA (escalation continues indefinitely) — accepted deliberately; a future kind needs an owner-signed change (that is the point).
- **Why chosen:** See Decision.

### Alternative 2 — Default-Everything Map

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Read "one pre-agreed default per gate" as completeness: give `owner-review` a proceed-flavored default (e.g. `proceed-and-record`) so every kind resolves at 72 h.
- **Constraint compliance:** **C-1 ❌** — an owner review is exactly the ask category that must never auto-proceed; F-5/AC-F5-1 pin this. C-2–C-5 ✅.
- **Driver fit:** Fails driver 1 outright; also weakens driver 2 (the precedent copied by the coordinator audience would normalize auto-proceeding owner asks).
- **Pros:** Completeness symmetry; no kind sits in "limbo".
- **Cons:** Irreversible failure mode (wrong auto-proceed on an owner review = trust damage that no ledger entry repairs); violates a pinned constraint.
- **Why rejected:** Disqualified by C-1.

### Alternative 3 — Completeness with a No-Op Default

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Give every kind a table entry for symmetry, with `owner-review` carrying a non-proceed sentinel "default" (e.g. `owner-review-first` self-referentially, or a `none` value) so the table *looks* complete while behavior matches ALT-1.
- **Constraint compliance:** C-1 ✅ on the letter (nothing proceeds), **C-2 ❌** — a sentinel/no-op value is not a genuine pre-agreed proceed decision; applying it would record an EVT-1 "decision" that decided nothing, polluting the audit trail and blurring F-5's structural exclusion of never-merge classes from the default machinery. C-3–C-5 ✅.
- **Driver fit:** Weak on driver 4 (audit cleanliness) and driver 6 (table honesty); buys only pedantic symmetry.
- **Pros:** Closed table with a row per kind.
- **Cons:** Ceremony data; audit noise; semantic overlap with a default-free row (absence is already declarable as policy data).
- **Why rejected:** Disqualified by C-2; the honest representation of "this kind has no default" is an explicit non-defaultable row, not a fake default.

## Decision

- **Decision:** Adopt **ALT-1 — the least-privilege initial default map**, as the initial content of the SLA policy-as-data (spec DM-3):

  | Gate kind | Gate class | Never-merge | Defaultable | Pre-agreed default | Behavior at 72 h expiry |
  |---|---|---|---|---|---|
  | `owner-review` | owner-review | yes | **no** | **none (by design)** | Escalation continues indefinitely, permanently visible — never silence, never auto-proceed; only a recorded waiver by an authorized principal overrides |
  | `waiver` | waiver | no | yes | **`owner-review-first`** | Default applied as the gate's proceed decision (reclassifies proceed posture; does **not** authorize a merge); EVT-1 decision event recorded; idempotent thereafter |

  Vocabulary is **closed at these two kinds**. Any new kind, class change, or new default is an owner-signed policy-data change per the spec §22 pattern (C-5) — never invented at runtime, never added silently. Default application on a waiver gate must not synthesize `waivedBy` (expiry is never waiver authority; DM-1's `waivedBy` remains bound to a recorded waiver).

  On the framing question: the ticket's "one pre-agreed default per gate" is satisfied by the **uniqueness reading** — at most one default per kind (exactly one where defaultable), none invented, with default-free kinds held by the never-silence guarantee (perpetual visible escalation) rather than by a fabricated decision. This matches G-1 ("escalation **or** a proceed decision"), G-2 ("at most one"), AC-F3-2, and the structural necessity of a non-defaultable class under F-5.

- **Rationale (tied to drivers):** (Driver 1) The map makes the irreversible failure mode — a wrong auto-proceed on an owner ask — structurally impossible: the only defaultable kind resolves into *more owner review*, not into a proceed. (Driver 2) The precedent M1-S16 copies is "riskiest ask class gets no default; only deferral-shaped defaults ship". (Driver 3) It reproduces the planning-pack worked example verbatim and keeps every ticket pin live. (Driver 4) Every EVT-1 record is a real decision. (Drivers 5–6) Two rows, closed set, inspectable at a glance. The uniqueness reading is not a liberty taken with the ticket: the clarify_scope-validated spec already encodes it, and AC-F3-2 exists to test exactly this map's owner-review row.

- **Authorized decision / status:** Adopted for the GH-229 **autonomous delivery run** under the PM's unblock delegation (this is what unblocks DM-3 contract data mid-delivery). Per the bounded AI-authority model (decision-making guide §6; decision-instructions status lifecycle), an R2 record is not AI-Accepted: **the record stays `Proposed` until the owner ratifies or vetoes it at the GH-229 PR review.** A veto reopens the map before merge to `main-tools`; a ratification flips this record to `Accepted` with `decision_date` set.

- **Decider:** Juliusz Ćwiąkalski (owner) — ratification/veto at GH-229 PR review; PM holds the interim unblock delegation.

- **Conditions for revisit:** See front-matter `revisit_triggers` — chiefly: any proposed new gate kind (M1-S16 or later), a delivered never-merge classification that contradicts the `owner-review` mapping, or owner disagreement with the waiver default's observed behavior.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies **all** constraints:

- **C-1 (never-merge never auto-proceeds):** `owner-review` is classified never-merge and carries no default; the only defaultable kind (`waiver`) is not never-merge, and its default reclassifies proceed posture without authorizing a merge. Verified by AC-F5-1 and the policy-table review.
- **C-2 (genuine, at-most-one, policy-as-data defaults):** Exactly one default exists in v0 (`owner-review-first` on `waiver`); both rows are contract data in the contracts tier; no sentinel values. Verified by code review + AC-F3-1/AC-F4-1.
- **C-3 (silence impossible):** Every kind has a defined expiry behavior — `waiver` resolves into `default-applied`; `owner-review` continues `escalated` permanently; unknown-age gates (either kind) render `escalated` with age declared unknown. Verified by AC-F6-2/AC-F1-2.
- **C-4 (72 h mechanism exercisable):** `waiver` is defaultable, so AC-F3-1 is testable and the EVT-1 substrate is live at ship time.
- **C-5 (owner-signed extension):** The two-row closed vocabulary plus the §22 sign-off gate make every future default an explicit owner decision.

No accepted-risk exceptions are recorded (no `negotiable: yes` constraint is violated).

## Trade-offs & Consequences

### Positive Outcomes

- The first automatic proceed decision the system ever makes is itself a deferral to the owner — the audit trail starts with a demonstrably conservative precedent.
- Owner authority over never-merge asks is structural, not probabilistic.
- The coordinator audience (M1-S16) inherits a copyable, least-privilege template plus a governance path (owner-signed extension) instead of an open question.
- The policy table is two rows and a rule — reviewable in one glance at PR time.

### Negative Outcomes

- `owner-review` gates unanswered past 72 h never resolve via the SLA; they sit escalated indefinitely. This is deliberate (recoverable beats irreversible) but means the board will accumulate permanently escalated gates if the owner goes quiet — which is the honest signal, not a defect.
- A future gate kind (including M1-S16's) cannot default anything until the owner signs a policy-data change — an intentional friction point that costs a round-trip per extension.
- The completeness reading of the ticket remains open to owner override at PR review; if the owner wants a default on a never-merge-adjacent kind, that is a superseding decision, not a patch.

### Unresolved Questions

- [ ] Exact never-merge classification of `owner-review` is an upstream ASSUMPTION (see Evidence) — reconcile against the verify-gates/merge story's delivered classification if it differs (owner: @coder/@pm at GH-229 delivery).
- [ ] M1-S16 coordinator-audience default posture: kinds, classes, defaults — deferred to GH-230 under the C-5 pattern (owner: GH-230 driver).

## Implementation Plan

1. **Contract data (DM-3):** encode the two-row map (kinds, classes, never-merge flags, defaultability, the single `owner-review-first` default) in the contracts tier following the status-digest thresholds precedent (DEC-2).
2. **Evaluation engine:** default eligibility reads the map (kind → defaultable + default); never-merge classes are excluded from default application structurally (not by convention); waiver-default application reclassifies proceed posture and never populates `waivedBy`.
3. **Tests:** AC-F3-1 (waiver default at 72 h + EVT-1), AC-F3-2 (owner-review no default, escalation continues), AC-F5-1 (never-merge never auto-proceeds), AC-F4-1 (idempotent record).
4. **Spec reconciliation:** the change spec's OQ-1 resolves to this record; §12 assumption and DM-3/§22 wording stay consistent with the closed two-kind vocabulary.
5. **Guardrail:** the policy-table file diff is surfaced at PR review so owner ratification of the map is a visible, explicit act — the same gate that flips this record to `Accepted`.
6. **Rollback:** if the owner vetoes at PR review, amend the map in-change before merge; the mechanism (aging, escalation, records) is map-independent and unaffected.

## Verification Criteria

- Waiver-class gate crossing 72 h applies `owner-review-first` exactly once with a complete EVT-1 record — Target: 100% (AC-F3-1/AC-F4-1) — Window: GH-229 delivery tests + first 2 weeks of board usage.
- Owner-review gate crossing 72 h (and staying unanswered) remains `escalated` on every subsequent evaluation — Target: 100%, zero defaults invented (AC-F3-2) — Window: same.
- Auto-proceed decisions applied to never-merge classes — Target: 0 (AC-F5-1) — Window: continuous (regression test).
- Owner sign-offs recorded for every post-v0 addition to the map — Target: 100% (process check at each touching PR) — Window: ongoing.
- Owner perception: no "tool overreach" reports on default applications (RSK-6) — Target: 0 — Window: first month of SLA operation.

## Confidence Rating

**High.** The interpretive basis is not vibes but pinned, clarify_scope-validated spec language (G-1 "or", G-2 "at most one", AC-F3-2's existence, F-5's structural requirement) plus the planning-pack worked example matching ALT-1 verbatim. The main labeled ASSUMPTION (owner-review ↔ never-merge) is robustness-insulated: if false, the class column adjusts while the no-default assignment for `owner-review` remains the safe reading under either classification. Residual uncertainty is concentrated where it belongs — the owner's PR-review ratification of the completeness-vs-uniqueness reading.

## References

- Change: **GH-229** — spec `doc/changes/2026-11/2026-11-06--GH-229--owner-gate-sla/chg-GH-229-spec.md` (§4 G-1/G-2, §5.1 F-3/F-5, §14 OQ-1, §15 DEC-2/DEC-6, §22, Appendix A)
- Downstream consumers: GH-228 (M1-S6 brief), GH-230 (M1-S16 typed blocker channel / coordinator audience), M2-S4 (fleet grid)
- Related decisions: ADR-0004 (activity-timestamp semantics — the age clock), ADR-0006 (absence-not-fabrication discipline)
- Process authority: `doc/guides/decision-making.md` §6 (bounded AI authority — R2 records are not AI-Accepted), `.ai/agent/decision-instructions.md` (status lifecycle, per-type numbering)
- Precedent for the Proposed-until-PR pattern: PDR-0002 (final acceptance rides the change's PR review)

## Acceptance

Accepted by the owner on 2026-11-06 (owner inbox ratification thread,
`.ai/local/owner/inbox/2026-11-06--ceo--post-merge-ratification-and-two-small-items.md`):
"PRD-0003 is ok." Delivery had already merged with PR #248 under the
PM unblock delegation; acceptance ratifies the default map as recorded.
