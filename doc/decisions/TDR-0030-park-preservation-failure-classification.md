---
id: TDR-0030
decision_type: tdr
status: Proposed
created: 2026-11-13
decision_date: null
last_updated: 2026-11-13
summary: "Resolve GH-294 OQ-3: a park is never refused because session state could not be preserved — the lane is stopped and parked anyway (reason `peak-window`, `until` at window end, zero-spend assertion intact), the park record, the `parked` event, and the status/brief park fields carry an additive closed-value preservation classification (`preserved` | `session-state-not-preserved`), window-end resume admission treats the failure classification as not-resumable-from-session and routes the lane to the delivered interrupted-lane recovery (resume from ledger position on the same branch, consuming one restart, governed by the restart budget and resume economics), and budget exhaustion follows the delivered precedent exactly: terminal exhaustion record plus a typed question — never an automatic fresh re-dispatch, never a silent requeue, never a lane left running through the window."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os resident daemon lane supervision (GH-294 F-3/F-5 park and resume path)"
decision_scope: repo
review_date: null
business_impact: "Peak-hour cost control never yields to a bookkeeping failure: the operator's declared window is enforced in every park episode, and the not-resumable state is an auditable classification with a governed recovery, not a silent exception."
customer_impact: "An operator whose lane's session state could not be preserved still gets the peak pause they declared (zero billable calls in the window, provable), sees the preservation failure named on the lane, the ledger, and status/brief, and answers one typed question if the restart budget is exhausted — instead of discovering a lane that either burned peak-rate tokens or silently vanished."
classification:
  domains: [architecture, contracts, operations, cost-control]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-294: PM routed OQ-3 to a record; record written before delivery planning finalizes)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-294 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-294 clarify-scope: OQ-3 framing — park refused vs parked-with-classification)"
    - "@spec-writer (GH-294 specification v1.0: AC-F6-5, DEC-4, DEC-5, RSK-2, OQ-3)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-294 PR review — this record fixes a lane-lifecycle outcome classification)"
  performers:
    - "@coder (GH-294 delivery: preservation classification, resume-admission routing, recovery tests)"
    - "@doc-syncer (resident-daemon and scheduling spec reconciliation)"
  informed:
    - "Status digest and brief (project the preservation classification in the park fields)"
    - "M2-S6 alarm and metric layers (a not-resumable park episode is a distinct observable)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Real episodes show preservation failure correlates with a specific harness/session kind: consider a pre-park preservation probe at stop time on that path rather than widening the classification vocabulary."
  - "The recovery path's restart consumption proves too costly in practice (preservation failures frequent): reopen the recovery routing; do not 'fix' it by refusing parks — that reopens this decision's C-1."
  - "An operator need emerges for manual unpark/resume ahead of window end (spec §7.3 deferred item): that decision composes with this one and is decided then."
  - "A preservation failure is observed for a lane whose stop also failed: that is supervision/liveness territory (delivered watchdog contracts), not this classification; keep the scopes separate."
links:
  related_changes: ["GH-294"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-13--GH-294--provider-peak-pausing/chg-GH-294-spec.md"
    - "doc/spec/features/feature-resident-daemon.md"
    - "doc/spec/features/feature-dispatch-engine.md"
  contracts: []
  decisions: ["TDR-0029"]
  diagrams: []
---

# TDR-0030: Park-Time Session-State Preservation Failure — Park Proceeds with a Named Classification and Budget-Governed Recovery

## Context

GH-294's park path (F-3) stops an in-flight lane with bounded grace and preserves session state so the episode is resumable at window end (F-5, DEC-5: the preserved session resume path on the same branch, never a fresh re-dispatch). The zero-spend assertion (F-6, AC-F6-5, DEC-4) is a hard, falsifiable claim: zero billable model calls on the parked profile from park timestamp through window end, with telemetry absence a classified outcome — never reported as zero.

What is not yet decided is the outcome when the bounded-grace stop completes but session state cannot be captured or preserved: the lane has been stopped, the window is open, and the resumability precondition of the happy path is gone. The specification carries this as OQ-3 with two candidate shapes: (a) the park is refused and the lane keeps running, or (b) the lane is parked anyway with a preservation-failure classification that changes resume admission.

Two delivered precedents govern the shape of the answer. Restart-budget exhaustion "appends the terminal exhaustion record and raises a typed question instead of silently failing the lane; exhaustion never silently requeues" — the resident daemon's established pattern for an admission that cannot proceed honestly. And startup reconciliation already classifies a lane whose session is gone without a failure record as `interrupted`: "resume from the ledger position and consume one restart" — a delivered, budget-governed recovery for exactly the "no resumable session" situation. The watchdog's fully corroborated stall applies `watchdog.liveness-stalled` and the same restart admission, so classification-then-budget-governed-recovery is the daemon's standing idiom, not a new pattern.

## Problem Framing (Clarified)

The decision is about which failure is allowed to dominate. A preservation failure is a local, recoverable bookkeeping failure; a lane running through a declared peak window is the exact unbounded-spend condition the entire change exists to prevent. Option (a) lets the lesser failure cancel the greater control; option (b) keeps the control and classifies the lesser failure.

Three properties must hold in any acceptable answer:

1. **The window is enforced.** The lane does not bill on the parked profile through the window (AC-F6-5 stays falsifiable, not vacuous).
2. **The record tells the truth.** Whatever the resume prospects are, the park record, the ledger events, and the surfaces say so; nothing is optimistic (spec RSK-2's mitigation already promises "the park records the applied grace and outcome").
3. **Recovery is governed, never improvised.** No automatic fresh re-dispatch (DEC-5), no silent requeue (delivered idiom), and the restart budget gates every recovery attempt.

A scope boundary matters up front: this decision covers the case where the **stop succeeded** (or grace expired) and preservation failed. A stop that cannot be effected at all is supervision/liveness territory under the delivered watchdog and lane contracts — GH-294 adds no new kill path (NG-6) — and is not reclassified here.

## Constraints (Hard Requirements)

### C-1: The window is enforced regardless of preservation outcome

- **Statement:** A lane whose profile's window is open is never left running because session-state preservation failed; AC-F6-5's zero-spend claim remains falsifiable for every park episode.
- **Source:** AC (GH-294 AC-F6-5, F-3, NFR-4) — the ticket's core cost-control goal.
- **Verification:** test (park episodes with induced preservation failure still park; telemetry scoping holds).
- **Negotiable:** no.

### C-2: No automatic fresh re-dispatch

- **Statement:** No recovery path spawned by the episode re-dispatches the delivery from scratch; window-end resume uses session resume where state was preserved and the delivered ledger-position recovery where it was not, both on the same branch.
- **Source:** prior decision (GH-294 DEC-5) and delivered resume discipline.
- **Verification:** test (branch/ordinal assertions; no new-branch spawns from the episode).
- **Negotiable:** no.

### C-3: No silent failure

- **Statement:** A preservation failure is a named classification visible on the park record, the `parked` event payload, and the status/brief park fields; it is never inferred from absence.
- **Source:** internal standard (classified-outcome discipline; "exhaustion never silently requeues").
- **Verification:** test + code review.
- **Negotiable:** no.

### C-4: Recovery reuses delivered machinery

- **Statement:** Recovery is governed by the delivered restart budget and resume economics; exhaustion produces the delivered terminal record plus typed question.
- **Source:** internal standard (resident-daemon restart admission; startup reconciliation `interrupted` classification).
- **Verification:** test (budget consumption, exhaustion escalation).
- **Negotiable:** no.

### C-5: Closed vocabulary, additive records, bounded evidence

- **Statement:** The classification is a member of a declared closed value set on additive record fields within the delivered envelope and evidence budgets; no in-place edit of delivered vocabularies.
- **Source:** AC (GH-294 G-9, NFR-6, DM-6).
- **Verification:** test (declaration pins; evidence bounds).
- **Negotiable:** no.

### C-6: Grace bounds are untouched by preservation failure

- **Statement:** A preservation failure never extends the applied grace; the grace bound stays ≤ the window buffer (NFR-1).
- **Source:** AC (GH-294 NFR-1, DEC-6).
- **Verification:** test.
- **Negotiable:** no.

## Decision Drivers

**Technical drivers (ranked):**

1. **Enforcement truthfulness** — the cost-control claim must be true in every episode; a control that yields to its own bookkeeping failure is not a control.
2. **Honesty over optimism** — recorded state matches reality; the resume prospect is classified, not assumed.
3. **Precedent coherence** — reuse the daemon's established classification-then-budget-governed-recovery idiom rather than inventing an exception path.

**Operational drivers:**

4. **Operator actionability** — a named classification plus, at worst, one typed question; never a silently dead lane or an invisible spend breach.
5. **Work preservation** — completed phases survive; recovery stays on the same branch with idempotent phase skipping.
6. **Determinism** — identical preservation outcome and budget state produce the identical classified recovery.

## Decision Rights (DACI)

Mirrors the `governance:` front matter. Driver: `@decision-advisor`. Decider: Juliusz Ćwiąkalski (human acceptance at the GH-294 PR review; AI does not accept this R2 record). Contributors: `@pm`, `@spec-writer`, `@decision-advisor`. Reviewers: `@readiness-reviewer`, `@reviewer`, human owner at the GH-294 PR review. Performers: `@coder` (classification, routing, tests), `@doc-syncer` (spec reconciliation). Informed: status/brief consumers, M2-S6 alarm/metric layers.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Restart-budget exhaustion appends a terminal record and raises a typed question; never silently requeues | FACT | doc/spec/features/feature-resident-daemon.md (Startup reconciliation, Lane supervision) | High — the escalation shape in D4 would lack precedent | High |
| Reconciliation classifies a gone-session lane as `interrupted`: resume from ledger position, consume one restart; `crashed` resumes per budget; `evidence-insufficient` holds | FACT | feature-resident-daemon.md (Startup reconciliation) | High — D3's recovery routing would need a new mechanism | High |
| Attach-and-continue session resume consumes no restart ordinal; restart admission is budget-governed | FACT | feature-dispatch-engine.md (admission of restarts and resumes) | Medium — ordinal accounting in D3 | High |
| GH-294 DEC-5: window-end resume uses the preserved session resume path, never a fresh re-dispatch; admission delegates to restart budget and resume economics | FACT | chg-GH-294-spec.md (§15 DEC-5) | High — C-2's source | High |
| AC-F6-5/NFR-4: zero billable calls on the parked profile in-window is a hard assertion; telemetry absence is classified, never zero | FACT | chg-GH-294-spec.md (§17, §9) | High — the vacuous-truth hazard of option (a) would be acceptable | High |
| RSK-2's mitigation already promises the park records the applied grace and outcome | FACT | chg-GH-294-spec.md (§11 RSK-2) | Medium — C-3 would be a new promise rather than a sharpened one | High |
| The delivered interrupted-lane recovery is applicable to a lane we stopped ourselves whose preservation failed (same branch, idempotent phase skipping, one restart) | ASSUMPTION | feature-resident-daemon.md + feature-dispatch-engine.md composition | Medium — D3's fallback would be the typed question alone; revisit trigger | Medium |
| Frequency of preservation failures in practice | TO-CONFIRM | none observable pre-delivery | Low — the decision is shape-correct regardless of frequency; frequency affects only the recovery-cost revisit trigger | Low |

## Mental Models & Techniques Used

- **Inversion** — asked "what must never happen": a lane billing peak-rate tokens inside a declared window, or a lane vanishing silently. Both options were then scored against only these.
- **5 Whys** on option (a): why would a park be refused? Preservation failed. Why does that matter? Resume needs session state. Why must the lane keep running then? No reason — it must only *not auto-resume*; conflating "cannot resume" with "cannot park" is the root error.
- **Second-order thinking** — traced option (a) forward: refused park → lane keeps running → next supervision cycle retries → refusal loop, peak spend, and a zero-spend metric that reads vacuously clean because nothing parked — a false all-clear.
- **Fail-safe vs fail-closed** — the park path fails safe (control retained, degradation classified) rather than failing open (control abandoned).
- **Systems thinking** — park, resume, restart budget, and typed questions are one lifecycle; the classification is the join that lets each component keep its delivered contract.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 |
|----------|-----|-----|-----|-----|-----|-----|
| ALT-0 (park refused, lane keeps running) | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| ALT-1 (park with classification + budget-governed recovery) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 (park + automatic fresh resume at window end) | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via an accepted-risk exception (none claimed)

### Alternative 0 — Do Nothing / Park Refused, Lane Keeps Running

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** If preservation fails, the park is refused; the lane continues through the window and the daemon retries on later cycles.
- **Constraint compliance:** Fails C-1 outright — the lane bills peak-rate tokens inside the declared window. The ⚠️ on C-3: even a classified "park-refused" outcome leaves the *zero-spend* metric vacuously true (no lane parked → no parked-lane spend to count), which is a false all-clear in spirit.
- **Driver fit:** Fails drivers 1, 2, 4 — the exact unbounded-spend condition the change prevents, made policy.
- **Pros:** The lane's session keeps running (no stop at all), so no preservation question arises… until the window ends and the lane finishes on its own, having paid peak rates.
- **Cons:** A local bookkeeping failure globalizes into a cost-control breach; the daemon enters a refusal loop against its own policy; the operator's declared window is unenforced precisely when the system is degraded.
- **Why rejected:** Fails the non-negotiable C-1; the 5-Whys analysis shows the refusal rests on conflating "cannot resume" with "cannot park".

### Alternative 1 — Park Proceeds with a Preservation-Failure Classification and Budget-Governed Recovery

- **Eligibility:** Eligible (passes C-1 through C-6).
- **Summary:** The lane is stopped and parked for the window regardless; the preservation outcome is a named classification on the park record and the `parked` event; window-end resume admission routes the not-resumable classification to the delivered interrupted-lane recovery, budget-governed, with typed-question escalation on exhaustion.
- **Constraint compliance:** C-1 — the lane is parked, so the zero-spend assertion applies and is falsifiable. C-2/C-4 — recovery is the delivered ledger-position resume on the same branch, consuming one restart under the delivered budget. C-3 — the classification is on the records, the event, and the surfaces. C-5 — one additive closed-value field. C-6 — grace is already expired when preservation is attempted post-stop; nothing extends it.
- **Driver fit:** Best on all six drivers.
- **Pros/Cons:** See Trade-offs.
- **Why chosen:** See Decision.

### Alternative 2 — Park Proceeds, Automatic Fresh Resume at Window End

- **Eligibility:** Not eligible (fails C-2, C-4).
- **Summary:** Park the lane, and at window end automatically re-spawn the delivery from scratch (same branch) because no session state exists.
- **Constraint compliance:** Fails C-2 — an automatic fresh re-dispatch is exactly what DEC-5 forbids; it discards session economics and duplicates the restart discipline with an ungoverned path. Fails C-4 — it bypasses the restart budget (a fresh spawn that consumes no restart ordinal is an unbounded retry loop wearing a resume costume).
- **Driver fit:** Scores on driver 4 superficially (no operator question) at the cost of drivers 1–3's foundation: ungoverned retries and dishonest "resume" semantics.
- **Pros:** Fully automatic; no typed question.
- **Cons:** Silent, ungoverned, budget-blind recovery — the precise pattern the delivered exhaustion-and-question precedent exists to prevent.
- **Why rejected:** Fails two non-negotiable constraints; the delivered budget machinery already provides the governed version of this recovery.

## Decision

- **Decision:** Adopt **ALT-1**, as five binding clauses:

  1. **D1 — The park is never refused for a preservation failure.** Scope: the bounded-grace stop completed (or its grace expired) and capturing/preserving session state failed. The lane is stopped and parked with reason `peak-window` and `until` at the window end exactly as the happy path. The zero-spend assertion is unaffected and stays truthful (the lane is parked; telemetry absence remains its own classified outcome per DEC-4). A stop that cannot be effected at all remains supervision/liveness territory under the delivered watchdog contracts (NG-6) and is out of this classification's scope.
  2. **D2 — The failure is a named, closed classification, carried everywhere the episode is.** The park record gains an additive closed-value preservation classification — `preserved` | `session-state-not-preserved` (default `preserved`; the exact literal is pinned by the plan against the declaration tests) — and the `parked` event payload and the status/brief park fields project it. Exactly one `parked` event lands per episode, carrying the classification (AC-F7-6 unchanged); the park-edge kind on `queue.graph` lands as declared (TDR-0029).
  3. **D3 — Resume admission reads the classification.** At window end, a lane classified `preserved` resumes through the session resume path as delivered (attach-and-continue, no restart ordinal). A lane classified `session-state-not-preserved` is not-resumable-from-session: no session resume is attempted, and the lane routes to the delivered interrupted-lane recovery — resume from the ledger position on the same branch, consuming one restart, governed by the restart budget and resume economics. Completed phases skip idempotently; branch, artifacts, and queue state stay unchanged; per-ref single-flight still prevents concurrency.
  4. **D4 — Exhaustion escalates exactly as delivered.** If the restart budget is at or above its bound, the episode follows the delivered precedent verbatim: the terminal exhaustion record is appended and a typed question is raised; the lane is never silently requeued and never automatically re-dispatched from scratch. The operator's answer governs what happens next.
  5. **D5 — Grace is untouched.** A preservation failure extends nothing: the applied grace was already bounded by the window buffer (NFR-1, DEC-6), and preservation is attempted at stop time within that bound; the classification records an outcome, never a delay.

- **Rationale (tied to drivers):** Driver 1 (enforcement truthfulness) eliminates ALT-0 at the constraint gate: the one state the system may never create is a lane billing inside a declared window, and option (a) creates it by design. Driver 2 (honesty) plus driver 3 (precedent) shape ALT-1's internals: the classification reuses the daemon's standing idiom (classify, then budget-governed recovery — `interrupted` reconciliation and `watchdog.liveness-stalled` both work this way), so no new recovery mechanism exists to get wrong. Driver 4 (operator actionability) is served by D2's visibility and D4's typed question — the operator learns the episode's true state from the lane, the ledger, and the surfaces, and answers at most one question. Driver 5 (work preservation) is why D3 recovers on the same branch rather than re-dispatching. Driver 6 falls out of deterministic classification-based routing. ALT-2 is eliminated because its "no operator question" benefit is bought with an ungoverned retry path — the exact failure mode the exhaustion precedent was built to close.

- **Decider:** Juliusz Ćwiąkalski (owner) — human acceptance at the GH-294 PR review; AI does not accept this R2 record.

- **Conditions for revisit:** See `revisit_triggers`; principally observed preservation-failure frequency making the restart-consuming recovery costly, or a correlation with a specific harness kind justifying a pre-park preservation probe.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-6 (see the ALT-1 compliance row). No accepted-risk exceptions are claimed.

## Trade-offs & Consequences

### Positive Outcomes

- The declared window is enforced in every park episode; AC-F6-5 stays a positive, falsifiable claim instead of a vacuous one.
- The not-resumable state is first-class: auditable on the ledger (one `parked` event carrying the classification), visible in status/brief, and recoverable through proven machinery.
- Zero new recovery mechanisms: the restart budget, ledger-position resume, and typed-question escalation all exist and are tested; this decision adds routing and a classification value.
- The operator's worst case is one typed question — the same worst case the system already delivers for budget exhaustion.

### Negative Outcomes

- A preservation-failure episode consumes one restart ordinal at recovery (the delivered `interrupted` semantics); frequent failures would tax the restart budget — recorded as a revisit trigger, never as a reason to refuse the park.
- The classification adds a field to the park record and the `parked` payload (bounded, closed-value, additive) — a small surface cost paid for truthfulness.
- D3 depends on the ASSUMPTION that the interrupted-lane recovery fits a lane the daemon itself stopped; if it does not, the fallback is the typed question alone (harsher, still honest).

### Unresolved Questions

- [ ] Exact classification literal and field placement (`preserved` | `session-state-not-preserved`; record field vs event payload copy) (owner: @plan-writer/@coder — pinned by declaration tests).
- [ ] Whether status/brief render the classification as a distinct park-field value or a separate marker (owner: @coder with spec reconciliation; the fields must not add reads, NFR-8).

## Implementation Plan

1. **Classification** — additive closed-value field on the park record family, projected into the `parked` event payload (TDR-0029's v2 declaration declares its field list) and the status/brief park fields; declaration tests pin the value set.
2. **Resume routing** — window-end resume admission branches on the classification: session resume for `preserved`; ledger-position restart (one ordinal, budget-governed) for `session-state-not-preserved`; exhaustion produces the terminal record and the typed question.
3. **Tests** — induce preservation failure: park still lands with the window enforced; exactly one classified `parked` event; recovery consumes one ordinal; exhaustion escalates with the typed question; branch/artifact/queue state unchanged; grace never extended; zero-spend evidence over the episode with `telemetryState` intact.
4. **Spec reconciliation** — resident-daemon (lane supervision and the park/resume section), scheduling engine (park record fields), status-digest/brief (park fields), and the GH-294 spec's OQ-3 row (amended by the PM to point here).

## Verification Criteria

- Metric: park episodes with preservation failure that still parked and enforced the window — Target: 100% — Window: GH-294 acceptance suites.
- Metric: lanes left running through their window due to a preservation failure — Target: 0 — Window: every run.
- Metric: recovery episodes consuming exactly one restart ordinal on the same branch, with zero fresh re-dispatches — Target: 100% / 0 — Window: resume suites.
- Metric: exhaustion episodes producing terminal record + typed question, with zero silent requeues — Target: 100% / 0 — Window: budget suites.
- Metric: episodes with exactly one classified `parked` event — Target: 100% — Window: event suites.

## Confidence Rating

High. Both load-bearing precedents (exhaustion→terminal+question; interrupted→ledger-position restart) are delivered and tested; the decision composes them behind a new classification value rather than inventing behavior. The one assumption (recovery fit) carries a recorded fallback that stays within the same precedent family.

## References

- GH-294 specification: `doc/changes/2026-11/2026-11-13--GH-294--provider-peak-pausing/chg-GH-294-spec.md` (F-3, F-5, F-6, AC-F6-5, DEC-4, DEC-5, DEC-6, RSK-2, OQ-3, §7.3)
- Resident daemon current truth: `doc/spec/features/feature-resident-daemon.md` (startup reconciliation, lane supervision, restart budget, typed question)
- Dispatch engine current truth: `doc/spec/features/feature-dispatch-engine.md` (restart/resume admission, ordinal accounting)
- TDR-0029 (the v2 taxonomy carrying the classified `parked` kind)
- Ticket: GitHub issue 294 (milestone M2); backlog story M2-S17
