---
id: chg-GH-294-test-plan
status: Proposed
version: 1.0
created: 2026-11-13
last_updated: 2026-11-13
owners: [engineering]
service: delivery-os
labels: [provider-profiles, daemon, dispatch, queue, lanes, telemetry, events, cost-control, m2]
version_impact: minor
summary: "Pin provider-aware peak pausing as comparisons tests run: the nomination invariant (every admitted delivery carries `providerProfile` on the lane and attempt records with the attempt-history read agreeing; a no-nomination dispatch is a recordless, eventless pre-session refusal at the delivered resolve identities and exits — absent/invalid/capability-denied at exit 1, unavailable at exit 2 with the eligibility list — inherited identically by the composed daemon claim; pre-change lanes resume on classified absence, resumes never re-nominate, and no read defaults, guesses, or borrows a profile); peak-window rules as versioned per-profile data with a fail-closed validator and a `graceSeconds` default and maximum bounded by the window buffer; the daemon's window watch parking every in-flight lane of the opening profile within one observed supervision cycle with the applied grace never exceeding the buffer, the park record carrying reason `peak-window`, the profile, `until` at the window end, and the `preserved | session-state-not-preserved` classification — a preservation failure never refuses a park and never extends grace; cross-profile isolation; window-end resume that is automatic, session-path for `preserved` lanes, delivered interrupted-lane recovery for not-preserved lanes (ledger position, same branch, one restart ordinal, budget-governed, terminal record + typed question on exhaustion), and never a fresh re-dispatch, a lost branch, or a duplicated artifact/queue state; the window-scoped zero-spend reading that is falsifiable, boundary-scoped from the park timestamp through the window end, and never reports zero on classified telemetry absence; taxonomy v2 carrying stop/parked/resumed/park-edge with every v1 kind and payload byte-identical, one stamp constant across event frames, degraded frames, and the reference surface, v1 retired as the single spoken version, and the six-point v1-consumer compatibility (ignore-and-continue, contiguous sequence, stamp drift as a signal, ordering/overflow untouched); status and brief park fields projected from the same collector pass with zero added reads; the daemon-absent degradation declared (`mode == \"iteration-start-gating\"`, `parkClaimed == false`) with zero surfaces claiming a park that did not happen; and the cross-cutting invariants (UTC-only window evaluation on the injected clock, determinism, hermeticity, event evidence bounds, additive record discipline, park-cause vocabulary additivity, owner-hold precedence at window end, single-flight interplay). 7 acceptance criteria are bound to 41 test cases; every criterion, capability, NFR, interface element, and decision (DEC-1..DEC-11) is covered; there are no TODO rows and no orphan cases. Six observability limits are declared as substitute assertions (§3.5), and six delivery-pinned ambiguities found in the sources are logged as open questions (§8.3) rather than silently resolved."
links:
  change_spec: ./chg-GH-294-spec.md
  implementation_plan: ./chg-GH-294-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S17: Provider-aware peak pausing

## 1. Scope and Objectives

This change composes seven delivered subsystems (provider profiles, resident daemon, dispatch engine, scheduling engine, telemetry v2, event taxonomy, state layer) into one enforcement loop, so the risk is not that a feature is missing — it is that enforcement **looks** real while one of its independent truths is false, and every downstream consumer inherits the falsehood. Each truth is therefore proven as a comparison a test runs, never as a prose claim. **First, the nomination is structural.** Every admitted delivery carries `providerProfile` on the lane record and the attempt record, and the attempt-history read returns the same value (`TC-PAUSE-001`); a delivery that cannot nominate is refused **before any session exists** with no lease, attempt, lane, or queue record and no event, carrying the resolve identity for its exact shape (`TC-PAUSE-002`), the composed daemon claim refuses identically (`TC-PAUSE-003`), the delivered empty-branch refusal is preserved and only moved earlier (`TC-PAUSE-004`), pre-change lanes resume on a classified absence with no backfill (`TC-PAUSE-005`), and no surface ever defaults, guesses, or borrows a profile (`TC-PAUSE-006`). **Second, the window is enforced in every park episode.** A window opening (buffer included) stops and parks every in-flight lane of that profile with the stop's grace deadline recorded (`TC-PAUSE-020`), the park record carries reason `peak-window`, the profile, `until`, and the preservation classification (`TC-PAUSE-021`), the applied grace never exceeds the window buffer (`TC-PAUSE-022`, `TC-PAUSE-025`), the park lands within one observed supervision cycle (`TC-PAUSE-023`), the lane stays parked until the window ends (`TC-PAUSE-024`), and a preservation failure never refuses the park and never extends the grace (`TC-PAUSE-025`). **Third, isolation is per profile.** Lanes on other providers keep running for the whole window (`TC-PAUSE-030`) and the park decision reads only the lane's recorded nomination (`TC-PAUSE-031`).

**Fourth, resume costs no work and no governance.** At window end, `preserved` lanes resume automatically through the session resume path on the same branch with no restart ordinal (`TC-PAUSE-040`), `session-state-not-preserved` lanes route to the delivered interrupted-lane recovery — ledger position, same branch, exactly one restart ordinal, restart-budget and resume-economics governed (`TC-PAUSE-041`) — budget exhaustion escalates exactly as delivered with a terminal record and a typed question (`TC-PAUSE-042`), no branch, artifact, or queue state is lost or duplicated and single-flight still holds the ref through the parked interval (`TC-PAUSE-043`), and an active owner hold outranks the window including at window end (`TC-PAUSE-044`). **Fifth, zero is a falsifiable positive.** The window-scoped reading proves zero billable calls over present telemetry with boundary scoping (`TC-PAUSE-050`, `TC-PAUSE-052`), absence is a classified outcome never reported as zero (`TC-PAUSE-051`), and a seeded mid-window call makes the reading non-zero — proving the assertion can fail (`TC-PAUSE-052`). **Sixth, the audit trail is exact and non-breaking.** Taxonomy v2 declares the four kinds with pinned payloads (`TC-PAUSE-060`), every v1 kind and payload stays byte-identical with envelope, ordering, and overflow unchanged (`TC-PAUSE-061`), one constant stamps frames, degraded frames, and the reference surface while v1 is retired as the single spoken version (`TC-PAUSE-062`), a v1-pinned consumer ignore-and-continues with a contiguous sequence and treats a foreign stamp as a drift signal, never an error (`TC-PAUSE-063`), exactly one stop, parked, resumed, and park-edge lands per episode with payloads that reconstruct the episode from the ledger alone (`TC-PAUSE-064`), and status and brief project the park fields from the same collector pass with zero added reads (`TC-PAUSE-070`..`TC-PAUSE-071`). **Seventh, degradation is truthful.** Without the daemon the mode is declared `iteration-start-gating` with `parkClaimed == false` (`TC-PAUSE-080`) and no surface claims a park that did not happen (`TC-PAUSE-081`).

The plan is deliberately adversarial about the failure modes the spec names. **A best-effort enforcement key**: a nomination that a read could synthesize would pass a "records exist" test, so `TC-PAUSE-006` scans every nomination-bearing surface beside a nominated lane and asserts the unnominated lane's absence is rendered classified, never filled. **A park that yields to its own bookkeeping failure**: `TC-PAUSE-025` injects the preservation failure and asserts the parked state, the classification, and an unextended grace — the exact inversion TDR-0030 rejects. **A zero that cannot fail**: `TC-PAUSE-052` seeds a mid-window call and requires the reading to report it, so a constant zero cannot pass. **A version bump that breaks v1 consumers**: `TC-PAUSE-061` and `TC-PAUSE-063` pin byte-identity and the six-point compatibility statement through the delivered codec and session. **A degradation that overclaims**: `TC-PAUSE-081` scans every surface for enforcement claims under daemon-absent operation.

This document is a verification map, not an execution claim: no command was run against a new implementation at authoring time, and phase ownership is declared in `chg-GH-294-plan.yaml` (authored in phase 4, delivery_planning), not asserted here. Where the spec deliberately leaves a mechanism to the plan — the exact surface carrying the daemon-absent machine read, the classification field's placement, the four kinds' exact payload field lists — the scenario asserts the declared property through the public surface, the record, or an injected seam, and names the seam; a case that cannot resolve its seam must fail naming the missing contract rather than skip. All 7 acceptance criteria are covered; there are no TODO rows and no orphan cases. Six properties are observed through a named substitute assertion (§3.5) because one half of the wording is a wall-clock bound, a client-side reaction, a byte-level artifact, or an unresolved delivery-pinned shape; each substitution is recorded, not smoothed over.

### 1.1 In Scope

- Nomination at dispatch admission: `providerProfile` on attempt records (`delivery.dispatch.attempt.v1`) and lane records, the attempt-history read agreement, the four no-nomination resolve identities at their delivered exits as recordless pre-session refusals, daemon-claim parity, the delivered empty-branch refusal preserved, pre-change lanes resumed on classified absence with no backfill, and the no-default/no-guess/no-borrow read discipline (F-1; AC-F1-1; DM-1, DM-2; DEC-9/TDR-0028).
- Peak-window rules as data: the per-profile versioned schema (window list with start, end, and time-zone declaration, multiplier per window, buffers before/after, `graceSeconds` default and maximum bounded by the window buffer), fail-closed classified validation, and the no-window-means-no-enforcement default (F-2; DM-3; DEC-6; NFR-1).
- The resident daemon's profile-window watch: buffer-inclusive window-start parking of every in-flight lane of the profile, the bounded-grace stop with recorded deadline, the park record (reason, profile, `until`, preservation classification) appended under one fence, the one-supervision-cycle bound, stay-parked-until-end, and composition with the delivered supervision/liveness/safe-boundary contracts without a new kill path (F-3; AC-F3-2; DM-4; NFR-1, NFR-2; DEC-11/TDR-0030 D1/D5).
- Cross-profile isolation: only lanes nominated to the in-window profile are parked; the park decision reads the recorded nomination only (F-4; AC-F4-3; RSK-3).
- Window-end resume: automatic resume from preserved session state on the same branch for `preserved` lanes; delivered interrupted-lane recovery (ledger position, same branch, one restart ordinal, restart-budget and resume-economics governed) for `session-state-not-preserved` lanes; delivered exhaustion escalation (terminal record + typed question); no loss or duplication of branch, artifact, or queue state; single-flight interplay; owner-hold precedence including at window end (F-5; AC-F5-4; DEC-5, DEC-8, DEC-11; NFR-5).
- The window-scoped zero-spend assertion: billable-call count over the telemetry v2 attribution join for the parked lane from park timestamp through window end, `telemetryState` distinguishing present zero from classified absence, boundary scoping, and falsifiability (F-6; AC-F6-5; DM-5; DEC-4; NFR-4).
- Taxonomy v2: the four new kinds with declared payload field lists, v1 kind/payload byte-identity, one stamp constant across frames/degraded frames/reference surface, v1 retired as the single spoken version, the six-point v1-consumer compatibility, and exactly-once episode emission with ledger-reconstructable payloads (EVT-1..EVT-4; AC-F7-6 ledger half; DEC-3, DEC-10/TDR-0029; NFR-6).
- Status digest and brief park fields: parked count, reason, `until`, and the preservation classification for open episodes, projected from the same collector facts with zero added reads; the lanes `parked:<cause>` projection gains `peak-window` and `owner-hold` with the delivered three unchanged; `queue release --park` accepts the new causes with the delivered `--until` requirement (F-7; AC-F7-6 surface half; DEC-2; NFR-8).
- Daemon-absent degradation: iteration-start gating at admission unchanged, the declared mode and `parkClaimed == false` in the machine read, and zero enforcement claims on any surface (F-8; AC-F8-7; DEC-7; NFR-7).
- Cross-cutting invariants: UTC-only window evaluation on the injected clock with TZ-independence, determinism of park/resume/event decisions, suite hermeticity (zero live network, zero live credential reads, zero real sleeps), event evidence bounds, additive record discipline (no schema bump, no migration, fenced appends), and the owner-hold park expiry field (DM-4 owner-hold half, DM-6; DEC-1; NFR-3, NFR-6, NFR-9, NFR-10).

### 1.2 Out of Scope & Known Gaps

- [OUT] Admission gating semantics: the delivered iteration-start gating (provider-profiles F-6) is exercised as a control (`TC-PAUSE-004`, `TC-PAUSE-080`) but is not re-specified or weakened by any case (NG-2, §7.2).
- [OUT] Quota-condition-driven in-flight pausing: `provider-quota` remains a delivered scheduling-engine park cause; no case drives a quota probe or quota park (NG-3, §7.2).
- [OUT] Non-UTC or local-timezone window modeling: `TC-PAUSE-090` asserts UTC-only evaluation and TZ-independence; whether a non-UTC zone literal *validates or refuses* is an open question (§8.3, OQ-TP-1), not an asserted behavior either way.
- [OUT] Cost conversion or re-pricing: multipliers are declared rule data (`TC-PAUSE-010` pins the schema); no case converts, re-prices, or renders a cost projection from them (NG-5, §7.2).
- [OUT] New session-kill operations or signal paths: `TC-PAUSE-026` asserts the delivered supervision contracts hold and no new termination mechanism exists; no case builds one (NG-6, §7.2).
- [OUT] Board/project-group rendering (M2-S18) and engine-first flip/deprecation pointers (M2-S16): the board is read only as an isolation witness surface in `TC-PAUSE-030`; its own S18 work is out of scope (NG-7).
- [OUT] Migration, backfill, or seeding of historical records: `TC-PAUSE-005` and `TC-PAUSE-094` assert the *absence* of migration and the validity of pre-change records; nothing seeds nominations (NG-8, §19).
- [OUT] Overlapping-window arbitration beyond declared validation: §7.3 defers it; the validation fixtures in `TC-PAUSE-011` stick to the spec-pinned failure classes and treat overlap validation as delivery-declared (OQ-TP-2).
- [OUT] Operator-triggered manual unpark/resume ahead of window end (§7.3 deferred): no case drives one; `TC-PAUSE-024` asserts no *automatic* early resume, which is a different property.
- [OUT] Documentation reconciliation of the seven spec pages and the backlog markers: owned by phase 7 (`@doc-syncer`) and review-attested at phase 8; content checks are not test scenarios in this plan.
- [GAP-T1 — "every in-flight lane … within one supervision cycle" is a wall-clock claim] NFR-2's threshold is observed as a **wake-cycle bound** through the injected clock and the delivered manual-wake seam (the delivered daemon-watch precedent): the case counts daemon cycles from the window-open observation to the last park and asserts the bound as ≤ 1 observed cycle, with the cycle count printed. Wall-clock latency is not measured. See AMB-P1, §3.5. Cases: 023.
- [GAP-T2 — "automatic resume" is driven, not awaited] The window-end trigger is reached by advancing the injected clock past the effective end and waking the same supervision code path; the *automatic* property is asserted negatively — zero operator commands, zero dispatch invocations, and a resume decision derived solely from the window-end observation. See AMB-P2, §3.5. Cases: 040, 041.
- [GAP-T3 — daemon-absent machine read surface is delivery-owned] The spec names "the machine view of the relevant read" without pinning which command/envelope carries `mode` and `parkClaimed`. The case asserts both values on the delivered machine read(s) of the lanes/status surface and fails naming the missing surface if delivery adds none. See AMB-P4, §3.5. Cases: 080.
- [GAP-T4 — "byte-identical" is asserted per kind, not as a raw diff against a pre-change artifact] v1 payload byte-identity is proven by the delivered bidirectional per-kind key-list comparisons extended to v2 plus golden frame comparison; version-bearing goldens are regenerated deliberately, once, with an explicit command at the version bump, never by blanket rewrite. See BYTE-P1, §3.5. Cases: 060, 061.
- [GAP-T5 — delivery-bound names] Module paths, suite file names, validator/helper names, the classification field's placement, and the machine-read surface the specification does not pin are delivery-bound. Behaviors, identities, exits, closed vocabularies, bounds, record fields named in the spec (DM-1..DM-5), and AC traceability are not. A test that cannot resolve a seam fails naming the missing contract; it never skips.
- [GAP-T6 — timing bounds are measured as counts, not assumed] The grace bound (`TC-PAUSE-022`), the supervision-cycle bound (`TC-PAUSE-023`), and the evidence bounds (`TC-PAUSE-093`) are asserted against the declared numeric thresholds with the measurement context (fixture matrix size, cycle counts) printed into the test output.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-294-spec.md`](./chg-GH-294-spec.md) v1.1 | Binding source: F-1..F-8, **7 ACs** (AC-F1-1, AC-F3-2, AC-F4-3, AC-F5-4, AC-F6-5, AC-F7-6, AC-F8-7), NFR-1..NFR-10, EVT-1..EVT-4, DM-1..DM-6, DEC-1..DEC-11, OQ-1..OQ-3 (resolved), §5.1 capability details, §6 flows 1–4, §7 scope boundaries, Appendix A (vocabulary mapping), Appendix B (source anchors). |
| [`TDR-0028-no-nomination-classified-admission-refusal.md`](../../../decisions/TDR-0028-no-nomination-classified-admission-refusal.md) (status `Proposed`, uncommitted working-tree file) | Binding decision record for AC-F1-1's refusal half: D1 refuse at admission (recordless, eventless pre-session), D2 carry the resolve identity per shape at its delivered exit (absent/invalid/capability-denied exit 1, unavailable exit 2 with the eligibility list), D3 one admission family (one-shot dispatch and the composed supervision claim), D4 resumes never re-nominate (classified absence, no backfill), D5 no dispatch-default concept; C-4 reads never default/guess/borrow, C-5 empty-branch refusal preserved. |
| [`TDR-0029-event-taxonomy-v2-peak-pause-kinds.md`](../../../decisions/TDR-0029-event-taxonomy-v2-peak-pause-kinds.md) (status `Proposed`, uncommitted working-tree file) | Binding decision record for the taxonomy half: D1 version `v2` whole-taxonomy, D2 declaration content (kind sets, v1 payloads byte-identical), D3 wire unchanged, D4 the stamp moves from one constant, D5 single spoken version (v1 retired), D6 the six-point v1-consumer compatibility statement, D7 drift/contract/reference-surface tests extend to v2. Its "exact payload field lists" unresolved question is delivery-pinned and asserted against the M2 contracts content (OQ-TP-5). |
| [`TDR-0030-park-preservation-failure-classification.md`](../../../decisions/TDR-0030-park-preservation-failure-classification.md) (status `Proposed`, uncommitted working-tree file) | Binding decision record for the preservation classification: D1 the park is never refused, D2 the classification is carried on the park record, the `parked` event, and status/brief (exactly one `parked` event per episode), D3 resume admission reads the classification (session resume vs delivered interrupted-lane recovery, one restart ordinal), D4 exhaustion escalates as delivered (terminal record + typed question, never silent requeue, never fresh re-dispatch), D5 grace untouched. Its two unresolved questions (classification literal/field placement; status/brief rendering shape) are logged as OQ-TP-3/§8.3 and asserted at the closed-value level. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | `bun:test` under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; suites under `tests/{structure,behaviour,golden,checks,boundaries}`; permanent suites assert the current tree, never a moving base branch; goldens regenerate only by an explicit command; `pnpm check` is the aggregate gate; absences are proven by a failing check that names the offending field. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict typing; injected clock/randomness/environment; data-only contracts; pure domain; adapters own I/O; injected fakes over `mock.module`. |
| **Planning seeds (contract authority and scenarios)** | `doc/planning/oss-tooling/backlog.md` M2-S17 (~line 1330; the ticket's seven ACs verbatim); `doc/planning/oss-tooling/milestones/m2/contracts.md` §Provider profiles and peak windows (S17 additions — the nomination field, rule schema, park-cause mapping, event shapes, zero-spend evidence form); `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` SC-M2-S17-01..07; `milestones/m2/architecture.md` (S17 park-and-resume flow); `milestones/m2/journeys.md` (S17 cost-control journey); `milestones/m2/commands/{events,queue,board,spend}.md` (surfaces, non-governing prose). |
| **Delivered contracts consumed under test** | Provider profiles configuration/lifecycle and resolve identities (`provider.profile.absent|invalid|capability-denied|unavailable` with exits 1/1/1/2); daemon lane records and park record discipline (fenced append, `until`, read-time expiry); dispatch attempt family (`delivery.dispatch.attempt.v1`) and the pre-session refusal discipline; scheduling-engine park causes (`provider-window | provider-quota | preempted-for-close-item`) and owner-hold precedence; telemetry v2 storage identity (`delivery.telemetry.storage.v1`) with five-dimension attribution and classified absence; spend v2 read side; event taxonomy v1 declaration, envelope, per-`(topic, lane)` sequence, overflow-to-repoll, and the `events` reference surface; restart budget and resume-economics admission; per-ref single-flight (GH-292). |
| **Delivered suites consumed as precedent or controls** | `tests/behaviour/daemon-lane-supervision.test.ts`, `daemon-watch-state-changes.test.ts` (real runtime + manual wake + injected clock + temp store — the window-watch harness pattern), `daemon-preemption.test.ts`, `daemon-reconciliation.test.ts`, `daemon-crash-restart.test.ts`, `daemon-degradation.test.ts`, `daemon-single-flight.test.ts`, `dispatch-admission-preflight.test.ts`, `dispatch-attempts-refusals.test.ts`, `dispatch-resume.test.ts`, `dispatch-restart-budget.test.ts`, `dispatch-resume-economics.test.ts`, `dispatch-single-flight.test.ts`, `provider-peak-window.test.ts`, `provider-profile-selection.test.ts`, `provider-profile-config.test.ts`, `queue-park.test.ts`, `queue-hold-park-resume.test.ts`, `queue-hold-dispatch.test.ts`, `spend-v2-breakdown.test.ts`, `telemetry-attribution.test.ts`, `telemetry-ingest.test.ts`, `status-providers-parked.test.ts`, `status-parked-conditions.test.ts`, `status-owner-hold.test.ts`, `tests/golden/lanes-list.test.ts`, `tests/structure/event-taxonomy-*.test.ts` (delivered by GH-290), `tests/checks/event-taxonomy-conformance.test.ts`, `daemon-hermetic.test.ts`, `events-hermetic.test.ts`. |
| **Precedent to mirror (plan-level)** | `doc/changes/2026-11/2026-11-11--GH-290--event-taxonomy/chg-GH-290-test-plan.md` — the verification-map format, exact-set-equality discipline, substitute-assertion registration, and the taxonomy drift/golden machinery this plan extends for v2. |
| [`chg-GH-294-pm-notes.yaml`](./chg-GH-294-pm-notes.yaml) | Context only: clarify-scope findings, TDR routing, delivery conventions (TMPDIR-qualified `pnpm check`, PR targets `main-tools`). The specification is the source of truth. |
| **Ticket** | GitHub issue `juliusz-cwiakalski/agentic-delivery-os#294` (milestone M2; seven verbatim ACs). |
| **TMPDIR caveat** | `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` — the canonical aggregate gate is `TMPDIR="$PWD/tmp/tmpdir" pnpm check`. |

## 3. Coverage Overview

All 7 acceptance criteria map to at least one named case, and no case is an orphan. The plan carries **41 cases** in ten blocks. The mapping is intentionally uneven in one direction: a criterion whose wording spans several independent observables is covered by more than one case (AC-F1-1 by six cases — records, refusal identities, claim parity, empty-branch preservation, pre-change absence, read discipline; AC-F3-2 by seven — stop, park record, grace bound, cycle bound, stay-parked, preservation failure, composition; AC-F5-4 by five — preserved resume, recovery routing, exhaustion, state fidelity, hold precedence; AC-F7-6 by eight across ledger and surfaces). Conversely, every case names at least one AC, so there are no orphan cases. Five properties carry a declared substitute assertion (§3.5) and are still counted as covered, with the substitution stated.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | A dispatch that nominates profile P records the nomination on the lane record and the attempt record with the attempt-history read agreeing; a dispatch that cannot nominate is refused at admission as a pre-session refusal carrying the resolve identity for the shape (absent, invalid, capability-denied, unavailable) with no lease, attempt, lane, or queue record and no event | TC-PAUSE-001, TC-PAUSE-002, TC-PAUSE-003, TC-PAUSE-004, TC-PAUSE-005, TC-PAUSE-006 | Covered |
| AC-F3-2 | When a peak window starts for P, every in-flight lane using P is stopped with bounded grace, marked parked with reason `peak-window` and the window end as `until`, and stays parked until the window ends | TC-PAUSE-020, TC-PAUSE-021, TC-PAUSE-022, TC-PAUSE-023, TC-PAUSE-024, TC-PAUSE-025, TC-PAUSE-026 | Covered |
| AC-F4-3 | When a peak window starts for P, lanes on other providers are unaffected and keep running for the whole window | TC-PAUSE-030, TC-PAUSE-031 | Covered |
| AC-F5-4 | When the window ends, each lane classified `preserved` resumes automatically from preserved session state on the same branch; each lane classified `session-state-not-preserved` routes automatically to the delivered interrupted-lane recovery (ledger position, same branch, one restart ordinal under the restart budget and resume economics); no branch, artifact, or queue state is lost or duplicated by either path | TC-PAUSE-040, TC-PAUSE-041, TC-PAUSE-042, TC-PAUSE-043, TC-PAUSE-044 | Covered |
| AC-F6-5 | Reading telemetry for the window proves zero billable model calls on P during the window for the parked lane; when telemetry is absent, the absence is reported as a classified outcome and never as zero | TC-PAUSE-050, TC-PAUSE-051, TC-PAUSE-052 | Covered |
| AC-F7-6 | After stop, park, and resume through a peak window, status and brief show the park fields (parked count, reason, `until`) and the ledger carries exactly one stop, parked, and resumed event for the episode | TC-PAUSE-060, TC-PAUSE-061, TC-PAUSE-062, TC-PAUSE-063, TC-PAUSE-064, TC-PAUSE-070, TC-PAUSE-071, TC-PAUSE-072 | Covered |
| AC-F8-7 | With no resident daemon, behavior degrades to iteration-start gating with the difference declared, and no park is claimed (`parkClaimed == false`) | TC-PAUSE-080, TC-PAUSE-081 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 001, 002, 003, 004, 005, 006; F-2 → 010, 011, 012, 022; F-3 → 020, 021, 022, 023, 024, 025, 026; F-4 → 030, 031; F-5 → 040, 041, 042, 043, 044; F-6 → 050, 051, 052; F-7 → 060, 061, 062, 063, 064, 070, 071, 072; F-8 → 080, 081.

**Decision coverage**: DEC-1 → 090; DEC-2 → 072, 094; DEC-3 → 060; DEC-4 → 050, 051, 052; DEC-5 → 040, 024; DEC-6 → 010, 011, 022; DEC-7 → 080, 081; DEC-8 → 044; DEC-9 (TDR-0028) → 002, 003, 004, 005, 006, 001; DEC-10 (TDR-0029) → 060, 061, 062, 063; DEC-11 (TDR-0030) → 021, 025, 041, 042.

**Ticket-scenario coverage** (milestone SC-M2-S17-01..07, per spec §17 traceability): SC-M2-S17-01 (park at peak start) → 020, 021, 023, 024; SC-M2-S17-02 (other-provider isolation) → 030; SC-M2-S17-03 (resume without state loss) → 040, 043; SC-M2-S17-04 (zero-spend assertion) → 050, 051; SC-M2-S17-05 (daemon-absent degradation) → 080, 081; SC-M2-S17-06 (nomination on records) → 001; SC-M2-S17-07 (stop/park/resume visible) → 064, 070, 071.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no REST/HTTP endpoint (§8.1: N/A) and no external integration (§8.4: none new). The interface surface is the four event kinds under taxonomy v2, the six data-model elements, and the existing CLI reads/writes the change extends (`dispatch`, `dispatch attempts`, `lanes`, `queue release --park`, `status`, `brief`, `spend`, `events`).

| Element | TC ID(s) | Observable assertion |
|---|---|---|
| EVT-1 `dispatch.attempt` / `stop` | 020, 064, 093 | Exactly one per episode; payload records the bounded-grace deadline; envelope, per-`(topic, lane)` sequence, and `taxonomyVersion: "v2"` stamp conform. |
| EVT-2 `dispatch.attempt` / `parked` | 021, 025, 064, 093 | Exactly one per episode; payload records reason `peak-window`, the profile, `until` at the window end, and the preservation classification (`preserved | session-state-not-preserved`); a preservation-failure episode emits the same single `parked` event with the failure classification. |
| EVT-3 `dispatch.attempt` / `resumed` | 040, 064, 093 | One per preserved-lane episode; payload records the preserved session-state reference, the same branch, and that no re-dispatch occurred. Whether a not-preserved lane's recovery emits `resumed` is delivery-pinned (OQ-TP-3); the case asserts no resumed frame carrying a session-state reference for a lane that has none. |
| EVT-4 `queue.graph` / `park-edge` | 061, 064 | One park lifecycle edge per episode; declared additively under v2; v1 `queue.graph` kinds unchanged. |
| DM-1 Nomination on attempt records | 001, 006, 094 | `providerProfile` present at admission as an additive field on `delivery.dispatch.attempt.v1`; read paths return the stored value; pre-change records valid without it (classified absence); no schema bump. |
| DM-2 Nomination on lane records | 001, 005, 006 | `providerProfile` on the daemon lane record family, recorded at admission, agreeing with the attempt record for the same delivery. |
| DM-3 Peak-window rule schema | 010, 011, 012, 090 | Per-profile versioned data: window list (start, end, time-zone declaration), multiplier per window, buffers before/after, `graceSeconds` default and max bounded by the window buffer; fail-closed classified validation; no window → no enforcement. |
| DM-4 Park reason record fields | 021, 044, 072, 094 | `peak-window` parks name the profile, carry `until`, and carry the closed-value preservation classification; `owner-hold` parks carry the hold's expiry; appends under one fence; read-time expiry semantics. |
| DM-5 Window-scoped zero-spend evidence | 050, 051, 052 | Billable-call count over the telemetry v2 storage identity for the parked lane from park timestamp through window end; `telemetryState` distinguishes present from classified absence; scoping excludes pre-park and post-window calls; falsifiable (a seeded mid-window call reads non-zero). |
| DM-6 Additive record discipline | 005, 094 | Additive, schema-versioned, fenced-append records; no in-place mutation, no schema bump of delivered payloads, no migration/backfill/seed. |
| §8.1 CLI surfaces | 001, 002, 072, 080 | `dispatch`/`dispatch attempts` (nomination, refusal identities), `lanes` (nomination, parked state, `parked:<cause>` gains `peak-window`/`owner-hold`), `queue release --park` (new causes, `--until` requirement), `status`/`brief` (park fields), `spend` (window-scoped evidence), `events` (v2 reference surface). |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Applied grace ≤ declared window buffer in 100% of parks; `graceSeconds` default declared and validated; a grace request above the profile maximum is a validation error | TC-PAUSE-022, TC-PAUSE-011, TC-PAUSE-025 | Covered |
| NFR-2 | Every in-flight lane of the profile is stopped and parked within one supervision cycle of the daemon's observation of window start (buffer included) | TC-PAUSE-023 (substitute AMB-P1: wake-cycle bound) | Covered |
| NFR-3 | Window start/end evaluated against declared UTC instants with the injected clock; 0 evaluations off the UTC basis | TC-PAUSE-090 | Covered |
| NFR-4 | 0 billable model calls attributable to parked lanes from park timestamp through window end when telemetry is present; absence always classified, never reported as zero | TC-PAUSE-050, TC-PAUSE-051, TC-PAUSE-052 | Covered |
| NFR-5 | 100% of window-end resumes use the preserved session resume path on the same branch; 0 fresh re-dispatches; 0 duplicate branches, artifacts, or queue entries | TC-PAUSE-040, TC-PAUSE-041, TC-PAUSE-043 | Covered |
| NFR-6 | Stop, parked, resumed, park-edge obey the declared envelope and bounded-evidence budgets (≤ 20 payload fields, ≤ 1024 bytes evidence) | TC-PAUSE-093, TC-PAUSE-064 | Covered |
| NFR-7 | Daemon-absent: mode declared `iteration-start-gating` and `parkClaimed == false`; 0 surfaces claiming a park that did not happen | TC-PAUSE-080, TC-PAUSE-081 | Covered |
| NFR-8 | Status and brief park fields come from the same collector pass as the delivered sections; the brief adds 0 reads of its own | TC-PAUSE-071, TC-PAUSE-070 | Covered |
| NFR-9 | Identical declared windows, provider facts, records, and injected clock produce identical park, resume, and event decisions across repeated runs | TC-PAUSE-091 | Covered |
| NFR-10 | The delivering test suite runs with zero live network, zero live credential reads, and zero real sleeps | TC-PAUSE-092 | Covered |

### 3.4 Coverage-Matrix Integrity

| Check | Value | Verdict |
|---|---|---|
| Acceptance criteria in the specification | 7 (AC-F1-1, AC-F3-2, AC-F4-3, AC-F5-4, AC-F6-5, AC-F7-6, AC-F8-7) | — |
| Acceptance criteria with at least one case | 7 | Pass |
| Acceptance criteria uncovered / TODO | 0 | Pass |
| Cases in this plan | 41 (`TC-PAUSE-001`..`TC-PAUSE-094`, block-structured) | — |
| Cases naming at least one AC (no orphans) | 41 | Pass |
| Cases that are manual-only | 0 | Pass |
| Cases with a substitute assertion recorded (§3.5) | 6 properties across 10 case references | Declared |
| Capabilities covered | F-1..F-8 (8/8) | Pass |
| NFRs covered | NFR-1..NFR-10 (10/10) | Pass |
| Interfaces covered | EVT-1..EVT-4 (4/4), DM-1..DM-6 (6/6) | Pass |
| Decisions covered | DEC-1..DEC-11 (11/11) | Pass |
| AC → TC direction present | §3.1 | Pass |
| TC → AC direction present | §5.1 index and every §5.2 header | Pass |
| Cases appearing in the Automation Plan (§7) | 41 of 41 | Pass |

### 3.5 Declared gaps, boundaries, and substitute assertions

| ID | What is asserted, and how | Cases | AC / NFR |
|---|---|---|---|
| **AMB-P1 — NFR-2's "within one supervision cycle"** | A wall-clock claim is not measured. **Substitute:** with the injected clock and the delivered manual-wake seam, the case counts daemon supervision cycles (wakes) from the clock instant that first exposes the buffer-inclusive window start to the wake at which the last in-flight lane of the profile is parked, and asserts the count is exactly the cycle that made the observation (≤ 1 observed cycle). The cycle count is printed with the fixture size. No real sleep is involved (hermeticity, NFR-10). | 023 | AC-F3-2, NFR-2 |
| **AMB-P2 — "automatic resume" is driven, not awaited** | The window-end trigger is reached by advancing the injected clock past the effective end and waking the same supervision path the daemon uses. **Substitute for "automatic":** zero operator commands and zero dispatch invocations during the transition (command counters), and the resume decision is derived solely from the window-end observation (no other input changed). The *timeliness* of a long-running daemon's own tick is not measured. | 040, 041 | AC-F5-4 |
| **AMB-P3 — preservation-classification rendering shape is unresolved** | TDR-0030 leaves open whether status/brief render the classification as a distinct park-field value or a separate marker. **Substitute:** both surfaces must render the classification truthfully and identically to the park record's value; the exact placement (field vs marker) is delivery-bound and the case asserts visibility + value agreement, not placement. | 021, 025, 070, 071 | AC-F3-2, AC-F7-6, DEC-11 |
| **AMB-P4 — the daemon-absent machine read surface is delivery-owned** | The spec names "the machine view of the relevant read" without pinning the command/envelope. **Substitute:** `mode == "iteration-start-gating"` and `parkClaimed == false` are asserted on the delivered machine read(s) of the lanes/status surface after the change; if delivery exposes no such read, the case fails naming the missing surface rather than passing vacuously. | 080 | AC-F8-7, NFR-7 |
| **BYTE-P1 — "byte-identical" v1 kinds/payloads under v2** | No raw byte diff against a pre-change artifact exists in a permanent suite. **Substitute:** the delivered bidirectional per-kind emitted-payload-key comparisons and envelope assertions extend to the v2 declaration, plus golden frame comparison for a representative v1 frame set; version-bearing goldens are regenerated deliberately, once, with an explicit command at the version bump, and the golden diff at that bump must show only version-bearing deltas. | 060, 061 | AC-F7-6, DEC-10 |
| **LIT-P1 — classification literal set and field placement** | The closed value set `preserved | session-state-not-preserved` is pinned by declaration/value-set tests against the TDR-0030 wording; the exact record/event field placement is delivery-bound (TDR-0030 unresolved question). **Substitute:** every carrier named by TDR-0030 D2 (park record, `parked` payload, status/brief fields) carries a value from exactly that two-member set, and the value agrees across carriers for the same episode. | 021, 025 | AC-F3-2, DEC-11 |

## 4. Test Types and Layers

- **Unit / structure (contract-level), `bun:test` under `tests/structure/`** — the peak-window rule schema round-trip and closed values (`TC-PAUSE-010`), taxonomy v2 declaration pinning and drift mutants (`TC-PAUSE-060`..`TC-PAUSE-062` structure halves), additive record discipline and state-contract additivity (`TC-PAUSE-094`). No I/O; imports the schema/declaration and pure comparators directly; data-only modules are scanned per the ambient-globals discipline.
- **Behaviour (integration over the delivered seams), `bun:test` under `tests/behaviour/`** — the majority of the plan: nomination and refusal paths over the real dispatch admission; the window watch over the real daemon runtime with manual wake + injected clock + temp store (the delivered `daemon-lane-supervision` / `daemon-watch-state-changes` pattern); isolation, resume routing, exhaustion, hold precedence; zero-spend over the telemetry v2 join and spend read side with a seeded store; episode event emission through the delivered control server/session over the in-memory transport pair (and one bounded real unix-socket variant for the subscription compatibility case, per the delivered GH-290 pattern); status/brief projection; daemon-absent degradation; UTC boundary matrix; determinism.
- **Golden, `bun:test` under `tests/golden/`** — the `lanes` projection with the new `parked:<cause>` values and a representative v1 frame set under the v2 stamp (`TC-PAUSE-072`, `TC-PAUSE-061`). Goldens are regenerated only by an explicit command, deliberately, at review; the regeneration diff must show only the declared deltas.
- **Checks (guards), `bun:test` under `tests/checks/`** — hermeticity counters across the new suites (`TC-PAUSE-092`, mirroring the delivered `daemon-hermetic` / `events-hermetic` pattern) and the taxonomy conformance page half extended to v2 (`TC-PAUSE-060`). These are the guards that fail in both directions when a contract is incomplete.
- **Measured bounds, `bun:test` with counters and printed context** — the grace bound, the supervision-cycle bound, and the event evidence bounds (`TC-PAUSE-022`, `TC-PAUSE-023`, `TC-PAUSE-093`); measurements print fixture size, cycle counts, and byte sizes. Absences (no record, no event, no spawn, no resume, no claim) are each proven three ways per the house discipline: a recording fake or armed guard, a zero counter, and an unchanged durable record count or byte-level key-set assertion.
- **Not used:** `mock.module`-style substitution of the modules under test; real network; live provider or credential reads; real `sleep`; the live tree or `$HOME` as state. Fakes are injected ports (clock, harness session port, telemetry drain, transport pair, manual wake, recording state store) — never a mock of the daemon runtime, the dispatch admission, the spend read, or the taxonomy declaration.
- **Boundaries:** no new cross-package edge is expected from this change; `check:boundaries` runs inside the aggregate gate as delivered. If delivery introduces a declared `workspaceImports` edge, the fixture-coverage meta-check requires the negative fixture in the same change (testing-strategy fallback rule).

## 5. Test Scenarios

TC IDs use the `PAUSE` feature prefix and follow the capability blocks of the specification: `001`–`006` nomination at admission; `010`–`012` peak-window rules as data; `020`–`026` window watch and in-flight parking; `030`–`031` cross-profile isolation; `040`–`044` window-end resume; `050`–`052` zero-spend assertion; `060`–`064` taxonomy v2 events; `070`–`072` surfaces and vocabulary; `080`–`081` daemon-absent degradation; `090`–`094` cross-cutting invariants. A new sequence appends at the end of its block; an ID is never reused for a different scenario. Every ID in this plan appears exactly once in §5.1, exactly once in §5.2, and exactly once in the §7 automation table — 41 in each.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-PAUSE-001 | Nomination is recorded on lane and attempt records and the attempt-history read agrees | Happy Path | Critical | Critical | AC-F1-1; F-1; DM-1, DM-2; DEC-9; SC-M2-S17-06 |
| TC-PAUSE-002 | A no-nomination dispatch is refused at admission with the resolve identity and zero records | Negative | Critical | Critical | AC-F1-1; F-1; DEC-9 |
| TC-PAUSE-003 | The composed daemon supervision claim inherits the nomination refusal | Negative | Critical | High | AC-F1-1; F-1; DEC-9 |
| TC-PAUSE-004 | The delivered empty-branch refusal is preserved, only earlier | Regression | Important | High | AC-F1-1; F-1; DEC-9; NG-2 |
| TC-PAUSE-005 | Pre-change lanes resume on classified absence; resumes never re-nominate; no backfill | Regression | Critical | High | AC-F1-1; F-1; DM-6; DEC-9; NG-8 |
| TC-PAUSE-006 | No surface defaults, guesses, or borrows a nomination | Negative | Critical | High | AC-F1-1; F-1; DEC-9 |
| TC-PAUSE-010 | The peak-window rule schema round-trips as versioned per-profile data with bounded grace | Happy Path | Critical | Critical | AC-F3-2; F-2; DM-3; DEC-6 |
| TC-PAUSE-011 | Fail-closed validation refuses malformed rule declarations with classified errors | Negative | Critical | Critical | AC-F3-2; F-2; DM-3; NFR-1; DEC-6 |
| TC-PAUSE-012 | No window declared → no peak enforcement, delivered behavior | Regression | Critical | High | AC-F3-2; F-2; NG-2 |
| TC-PAUSE-020 | Window start (buffer included) stops every in-flight P lane with bounded grace; the stop event records the deadline | Happy Path | Critical | Critical | AC-F3-2; F-3; DM-4; EVT-1; NFR-1; SC-M2-S17-01 |
| TC-PAUSE-021 | The park record carries reason, profile, `until`, and the preservation classification under one fence | Happy Path | Critical | Critical | AC-F3-2; F-3; DM-4; EVT-2; DEC-11 |
| TC-PAUSE-022 | The applied grace never exceeds the window buffer | Corner Case | Critical | Critical | AC-F3-2; F-2, F-3; NFR-1; DEC-6 |
| TC-PAUSE-023 | The park lands within one observed supervision cycle of the window-open observation | Happy Path | Important | High | AC-F3-2; F-3; NFR-2; AMB-P1 |
| TC-PAUSE-024 | The lane stays parked until the window ends; no early resume, no re-dispatch | Corner Case | Critical | High | AC-F3-2; F-3, F-5; DEC-5 |
| TC-PAUSE-025 | A preservation failure never refuses the park and never extends the grace | Negative | Critical | Critical | AC-F3-2, AC-F5-4; F-3; DM-4; NFR-1; DEC-11; AMB-P3, LIT-P1 |
| TC-PAUSE-026 | The bounded-grace stop composes with delivered supervision and adds no kill path | Regression | Important | High | AC-F3-2; F-3; NG-6; RSK-1 |
| TC-PAUSE-030 | Other-provider lanes keep running through P's window | Happy Path | Critical | Critical | AC-F4-3; F-4; NFR-2; SC-M2-S17-02 |
| TC-PAUSE-031 | The park decision reads only the lane's nominated profile and that profile's window state | Corner Case | Critical | High | AC-F4-3; F-4; RSK-3 |
| TC-PAUSE-040 | Window end (buffer included) resumes preserved lanes automatically via the session resume path on the same branch | Happy Path | Critical | Critical | AC-F5-4; F-5; EVT-3; NFR-5; DEC-5; SC-M2-S17-03; AMB-P2 |
| TC-PAUSE-041 | A not-preserved lane routes to the delivered interrupted-lane recovery: ledger position, same branch, one restart ordinal | Corner Case | Critical | Critical | AC-F5-4; F-5; NFR-5; DEC-11; AMB-P2 |
| TC-PAUSE-042 | Budget exhaustion escalates as delivered: terminal record + typed question, never silent requeue, never fresh re-dispatch | Negative | Critical | Critical | AC-F5-4; F-5; DEC-11 |
| TC-PAUSE-043 | No state lost or duplicated: branch, artifacts, queue, and single-flight intact across the episode | Corner Case | Critical | Critical | AC-F5-4; F-5; NFR-5; SC-M2-S17-03 |
| TC-PAUSE-044 | An active owner hold outranks the window, including at window end | Corner Case | Critical | High | AC-F5-4; F-5; DM-4; DEC-8 |
| TC-PAUSE-050 | Zero-spend positive reading over present telemetry, scoped park timestamp through window end | Happy Path | Critical | Critical | AC-F6-5; F-6; DM-5; NFR-4; DEC-4; SC-M2-S17-04 |
| TC-PAUSE-051 | Telemetry absence is classified, never reported as zero | Negative | Critical | Critical | AC-F6-5; F-6; DM-5; NFR-4; DEC-4 |
| TC-PAUSE-052 | Boundary scoping excludes pre-park and post-window calls and the zero is falsifiable | Corner Case | Important | High | AC-F6-5; F-6; DM-5; DEC-4 |
| TC-PAUSE-060 | The v2 declaration carries the four kinds with pinned payload fields; drift machinery extends | Happy Path | Critical | Critical | AC-F7-6; F-7; EVT-1..EVT-4; NFR-6; DEC-3, DEC-10; BYTE-P1 |
| TC-PAUSE-061 | Every v1 kind and payload is byte-identical under v2; envelope, ordering, overflow unchanged | Regression | Critical | Critical | AC-F7-6; F-7; EVT-4; DEC-10; BYTE-P1 |
| TC-PAUSE-062 | One declaration constant stamps frames, degraded frames, and the reference surface; v1 retired as spoken version | Contract | Critical | Critical | AC-F7-6; F-7; DEC-10 |
| TC-PAUSE-063 | v1-pinned consumer compatibility: ignore-and-continue, contiguous sequence, stamp-drift signal | Behaviour | Critical | Critical | AC-F7-6; F-7; DEC-10; RSK-6 |
| TC-PAUSE-064 | Exactly one stop, parked, resumed, and park-edge per episode with ledger-reconstructable payloads | Happy Path | Critical | Critical | AC-F7-6; F-7; EVT-1..EVT-4; NFR-6 |
| TC-PAUSE-070 | Status digest carries the lane park fields for open episodes and clears them after | Happy Path | Critical | Critical | AC-F7-6; F-7; NFR-8; SC-M2-S17-07; AMB-P3 |
| TC-PAUSE-071 | Brief projects the same park fields with zero added reads | Contract | Critical | High | AC-F7-6; F-7; NFR-8; SC-M2-S17-07; AMB-P3 |
| TC-PAUSE-072 | Park-cause vocabulary: lanes `parked:<cause>` gains `peak-window`/`owner-hold`; delivered three unchanged; `queue release --park` accepts them | Regression | Critical | High | AC-F7-6; F-7; DM-4; DEC-2 |
| TC-PAUSE-080 | Daemon-absent degradation: iteration-start gating with declared mode and `parkClaimed == false` | Happy Path | Critical | Critical | AC-F8-7; F-8; NFR-7; DEC-7; SC-M2-S17-05; AMB-P4 |
| TC-PAUSE-081 | No surface claims a park that did not happen (daemon-absent) | Negative | Critical | Critical | AC-F8-7; F-8; NFR-7; DEC-7 |
| TC-PAUSE-090 | UTC-only window evaluation on the injected clock, TZ-independent | Corner Case | Critical | Critical | AC-F3-2; F-2, F-3; NFR-3; DEC-1 |
| TC-PAUSE-091 | Determinism: identical inputs produce identical park, resume, and event decisions | Corner Case | Important | High | AC-F5-4; F-3, F-5; NFR-9 |
| TC-PAUSE-092 | Hermeticity of the delivering suite: zero live network, zero credential reads, zero sleeps | Negative | Critical | Critical | AC-F1-1..AC-F8-7; NFR-10 |
| TC-PAUSE-093 | Event evidence bounds on the four kinds: ≤ 20 payload fields, ≤ 1024 bytes evidence | Corner Case | Important | High | AC-F7-6; F-7; NFR-6 |
| TC-PAUSE-094 | Additive record discipline and the owner-hold park expiry | Regression | Critical | High | AC-F5-4; F-1, F-5; DM-4, DM-6; DEC-2; G-9 |

### 5.2 Scenario Details

#### TC-PAUSE-001 - Nomination is recorded on lane and attempt records and the attempt-history read agrees

**Objective**: Prove the nomination is a durable record field written once at admission — visible on both record families and agreeing across every read path — not a rendering-time inference.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, F-1, DM-1, DM-2, DEC-9 (positive half); SC-M2-S17-06
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-nomination-admission.test.ts` (new); dispatch attempt family (`delivery.dispatch.attempt.v1`) and daemon lane records over a temp store
**Harness entry**: `bun test tests/behaviour/provider-nomination-admission.test.ts`
**Tags**: @backend, @behaviour

**Preconditions**:
- Temp state directory; `provider.profiles` declares `profile-a` with a resolvable preference chain.
- The harness session port is a recording fake (no live provider); the admission preflight otherwise passes.
- Both delivery paths are exercisable: the one-shot dispatch path and the composed daemon supervision claim.

**Steps**:
1. Admit a dispatch for a ref through the one-shot dispatch path and let the fake session run one step; assert the appended attempt record carries `providerProfile == "profile-a"` as a stored field on the record (present in the appended record bytes, not derived at read).
2. Read the lane record for the delivery (`lanes`): assert the same non-empty value.
3. Read the attempt history (`dispatch attempts --ref`): assert the returned value equals the stored record value equals the lane value — three-way agreement.
4. Repeat admission through the composed daemon supervision claim path; assert both records carry the same nomination.
5. Clock control: open a window on `profile-a` mid-flight (advance the injected clock) and assert the recorded nomination is unchanged — the nomination is captured at admission and never rewritten by a later window observation.
6. Record discipline: assert the field is additive on the delivered record families (no schema bump; pre-change-shaped records still parse — deep coverage in `TC-PAUSE-005`, `TC-PAUSE-094`).

**Expected Outcome**:
- The lane record, the attempt record, and the attempt-history read return the same nomination for the same delivery, on both admission paths.
- The nomination survives window observations unchanged; the field is additive and stored, never synthesized.

**Notes / Clarifications**:
- The exact payload placement inside each record family is delivery-owned mechanism (spec §authoring: mechanism belongs to the plan); the assertion is on the stored field and the read agreement, not the byte offset.

#### TC-PAUSE-002 - A no-nomination dispatch is refused at admission with the resolve identity and zero records

**Objective**: Make TDR-0028 D1/D2 real: each of the four no-nomination shapes refuses pre-session with the delivered resolve identity at its delivered exit, appending nothing and publishing nothing.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, F-1, DEC-9; TDR-0028 C-1..C-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-nomination-admission.test.ts` (new); dispatch admission predicate
**Harness entry**: `bun test tests/behaviour/provider-nomination-admission.test.ts --filter no-nomination`
**Tags**: @backend, @behaviour, @errors

**Preconditions**:
- Four no-nomination fixtures: (a) an empty or chain-less `provider.profiles` branch; (b) an invalid explicit nomination; (c) all candidates capability-blocked; (d) all candidates ineligible for non-capability reasons (a profile parked in its own peak window is the natural (d) fixture, coupling the refusal with the delivered iteration-start gating).
- Recording state store with before/after record counts across all four families (lease, attempt, lane, queue); harness session port fake with a spawn counter; subscription probe able to observe zero published frames for the ref.

**Steps**:
1. For fixture (a): run `dispatch <ref>`; assert refusal identity `provider.profile.absent`, exit `1`.
2. For fixture (b): assert `provider.profile.invalid`, exit `1`.
3. For fixture (c): assert `provider.profile.capability-denied`, exit `1`.
4. For fixture (d): assert `provider.profile.unavailable`, exit `2`, with the eligibility list rendered in the refusal detail.
5. For every fixture: assert zero records appended in all four families (record counts unchanged), zero events published, zero session spawns (fake counter), no lease taken.
6. Cross-check identity/exit against the delivered profile-resolve surface for the same configuration: the dispatch refusal's identity and exit equal what `provider profile resolve` produces for the same shape — the admission reuses the resolve seam's classification, it does not invent one.

**Expected Outcome**:
- Exact identity/exit mapping per shape; the refusal is recordless, eventless, and spawnless in all four cases.
- No new `dispatch.*` identity or error-table row is introduced (cross-checked in `TC-PAUSE-094`'s additivity controls).

**Postconditions**:
- The store is byte-identical to its pre-call state for every fixture (no stray appends to clean up).

#### TC-PAUSE-003 - The composed daemon supervision claim inherits the nomination refusal

**Objective**: Prove TDR-0028 D3's one-admission-family rule: the daemon's composed supervision claim refuses a no-nomination ref with the same identity and the same recordless discipline as the one-shot path.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DEC-9; TDR-0028 D3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-nomination-admission.test.ts` (new); daemon supervision claim path (real runtime, temp store, manual wake)
**Harness entry**: `bun test tests/behaviour/provider-nomination-admission.test.ts --filter claim-parity`
**Tags**: @backend, @behaviour

**Preconditions**:
- Daemon composed with the lane composition over a temp store; one no-nomination ref queued (fixture (a) configuration from `TC-PAUSE-002`); one nominated control ref queued behind it.

**Steps**:
1. Drive one supervision claim cycle (manual wake); assert the claim of the no-nomination ref is refused with the same identity and exit as the one-shot path for the same configuration.
2. Assert zero records appended by the claim cycle (no lease, attempt, lane, or queue record) and zero events.
3. Assert the daemon stays healthy: the supervision loop continues (the control ref behind it is claimed and admitted normally, carrying its nomination per `TC-PAUSE-001`).
4. Assert parity explicitly: the refusal identity/exit observed through the claim equals the one observed through `dispatch <ref>` for the identical configuration.

**Expected Outcome**:
- One admission family: identical refusal semantics on both entry paths; the daemon neither crashes nor records a partial admission.

#### TC-PAUSE-004 - The delivered empty-branch refusal is preserved, only earlier

**Objective**: Prove TDR-0028 C-5: a fresh install's empty `provider.profiles` branch still refuses with `provider.profile.absent` semantics at exit 1 — the change moves the refusal earlier, it never removes or weakens it.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DEC-9; NG-2
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-nomination-admission.test.ts` (new); delivered provider-profile resolve fixtures as the comparison base
**Harness entry**: `bun test tests/behaviour/provider-nomination-admission.test.ts --filter empty-branch`
**Tags**: @backend, @regression

**Preconditions**:
- A store/configuration with no `provider.profiles` branch (the delivered fresh-install default).
- The delivered resolve behavior for the same configuration, captured through the resolve surface, as the comparison baseline.

**Steps**:
1. Run `dispatch <ref>` on the empty-branch configuration; assert identity `provider.profile.absent`, exit `1`.
2. Compare against the resolve surface's classification for the same configuration: same identity, same exit; the only delta is timing (the refusal now precedes any session, lease, or record).
3. Assert the spawn counter is zero — the delivery fails before any harness invocation, which is the delivered change in timing, not in outcome.
4. Assert the delivered provider-profile suites pass unchanged as controls (the resolve surface itself did not move).

**Expected Outcome**:
- Fresh-install behavior is unchanged in substance: same classification, same exit, zero records; only the failure point moved earlier.

#### TC-PAUSE-005 - Pre-change lanes resume on classified absence; resumes never re-nominate; no backfill

**Objective**: Prove TDR-0028 D4/C-6 and NG-8: a lane admitted before this change (no `providerProfile`) resumes without being blocked, its absence reads as a classified absence everywhere, it is simply not window-pausable, and nothing backfills it.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-6, DEC-9; NG-8; §8.5
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-nomination-admission.test.ts` (new); seeded pre-change lane record (delivered record shape, no nomination field)
**Harness entry**: `bun test tests/behaviour/provider-nomination-admission.test.ts --filter pre-change-absence`
**Tags**: @backend, @regression

**Preconditions**:
- A temp store seeded with a pre-change lane record lacking `providerProfile` (delivered family shape) and an in-flight fake session for it.
- A profile P with a declared window; a nominated control lane on P in the same store.

**Steps**:
1. Open P's window (clock) and drive supervision: assert the nominated control lane parks; the pre-change lane does **not** park — with no nomination there is no profile whose window can be watched for it, and the absence never causes a park decision (it also never causes a crash or an unclassified state).
2. Read every nomination-bearing surface for the pre-change lane: the absence renders as the declared classified absence (never a defaulted value — deep coverage in `TC-PAUSE-006`).
3. Drive the lane's resume path (window end or the delivered operator resume): assert the resume proceeds — the classified absence blocks nothing.
4. Assert no re-nomination: after resume, the lane record still lacks the field; no resolve runs for the resume (resolve counter zero); no other profile's value appears anywhere for this lane.
5. Assert no backfill: the stored record bytes are unchanged by every step above (byte-level before/after comparison of the lane record key).

**Expected Outcome**:
- Pre-change records stay valid: classified absence, resumable, not window-pausable, never backfilled, never re-nominated.

#### TC-PAUSE-006 - No surface defaults, guesses, or borrows a nomination

**Objective**: Prove TDR-0028 C-4 and F-1's read discipline: no surface may synthesize, infer, or borrow a nomination for a delivery that did not produce one — including when a nominated lane exists nearby to borrow from.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DEC-9; TDR-0028 C-4
**Test Type(s)**: Negative, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-nomination-admission.test.ts` (new); every nomination-bearing read surface (lanes, dispatch attempts, status digest, brief, board, spend attribution dimensions)
**Harness entry**: `bun test tests/behaviour/provider-nomination-admission.test.ts --filter no-default-no-borrow`
**Tags**: @backend, @negative

**Preconditions**:
- One store holding exactly two lanes: a pre-change lane without a nomination (A) and a nominated lane on `profile-a` (B) — the borrow bait.

**Steps**:
1. Read every surface that renders nomination or attribution data: `lanes`, `dispatch attempts`, `status`, `brief`, `board`, and the spend breakdown for A's ref.
2. Assert no surface renders any profile value for lane A: not the chain's base profile, not `profile-a` from lane B, not any literal resembling a default; absence renders as the declared classified absence (or is omitted per the delivered absent-dimension discipline, never filled).
3. Assert lane B's surfaces still render `profile-a` (the control), so the assertion is not vacuously passing on an empty store.
4. Mutant control: render A's surfaces with B's record removed from the store and assert the output is identical — A's rendering cannot have depended on B's record (no borrow).

**Expected Outcome**:
- Zero synthesized nomination values across all surfaces; absence is classified; neighboring nominations are never borrowed.

#### TC-PAUSE-010 - The peak-window rule schema round-trips as versioned per-profile data with bounded grace

**Objective**: Prove F-2/DM-3: peak-window rules are declared, validated, versioned configuration per profile — window list (start, end, time-zone declaration), multiplier per window, buffers before/after, and `graceSeconds` with a default and a maximum derived to be bounded by the window buffer.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-2, DM-3, DEC-6
**Test Type(s)**: Unit, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-peak-rules-schema.test.ts` (new); `provider.profiles` configuration branch and its validator
**Harness entry**: `bun test tests/structure/provider-peak-rules-schema.test.ts`
**Tags**: @backend, @structure, @contract

**Preconditions**:
- A profile declaration carrying peak-window rules: two windows with distinct multipliers, non-zero buffers, and an explicit `graceSeconds` default.
- The delivered provider-profiles configuration loader.

**Steps**:
1. Parse the declaration through the loader; assert the parsed rule value equals the declaration field-for-field: per-window `start`, `end`, time-zone declaration, `multiplier`; per-window buffer-before and buffer-after; profile-level `graceSeconds` default.
2. Assert the validator derives the grace maximum as bounded by the relevant window buffer (max ≤ buffer) and that the bound is exposed on the parsed value — the bound is data-derived, not asserted downstream at park time only.
3. Assert the rules are versioned with the profile (the rule data rides the profile's versioned configuration, additive to the delivered branch).
4. Assert the rule fields ride the declared windows even when the profile declares no rules (absent rules parse as an empty/closed absence, not a synthesized default window).
5. Data-only scan: the schema module contains no clock read, no environment read, no I/O, and no call expression (ambient-globals discipline) — window evaluation happens against the injected clock at watch time, never inside the schema.

**Expected Outcome**:
- The schema round-trips exactly; the grace bound is derived data; rules are versioned with the profile and ship empty by default.

#### TC-PAUSE-011 - Fail-closed validation refuses malformed rule declarations with classified errors

**Objective**: Prove F-2's fail-closed validation discipline and NFR-1's validation tail: malformed windows refuse rather than degrade silently, and a grace request above the profile's maximum is a validation error.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-2, DM-3, NFR-1, DEC-6
**Test Type(s)**: Negative, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-peak-rules-schema.test.ts` (new); configuration validation fixtures
**Harness entry**: `bun test tests/structure/provider-peak-rules-schema.test.ts --filter validation`
**Tags**: @backend, @structure, @negative

**Preconditions**:
- Malformed fixtures: window end at or before start; a window missing `start` or `end`; a negative or missing buffer; a missing `graceSeconds` default; a `graceSeconds` above the derived maximum (i.e., above the window buffer); a non-numeric multiplier; a malformed instant.
- One valid control declaration.

**Steps**:
1. Validate each fixture through the configuration validator; assert each is refused with a classified configuration error that names the offending field (fail-closed and classified, matching the provider-profiles validation discipline).
2. Assert the grace-above-maximum fixture is refused at validation time (NFR-1: "requests for a grace above the profile's maximum are validation errors") — never silently clamped, never accepted and bounded later.
3. Assert the valid control passes with zero warnings that would indicate silent coercion.
4. Cross-link: assert a configuration that validates (grace within bounds) is the only kind the daemon's watch accepts — an invalid rule set never reaches the window watcher (the watch refuses or the configuration refuses first; no run-with-partial-rules state).

**Expected Outcome**:
- Every malformed declaration fails by name; nothing degrades silently; the grace bound is enforced at the configuration boundary and holds at runtime (`TC-PAUSE-022`).

**Notes / Clarifications**:
- Whether a non-UTC time-zone literal validates or refuses is not pinned by the sources (OQ-TP-1, §8.3); no fixture asserts either way. `TC-PAUSE-090` proves evaluation stays on the UTC basis regardless.

#### TC-PAUSE-012 - No window declared → no peak enforcement, delivered behavior

**Objective**: Prove F-2's default and §19's configuration posture: a profile with no declared window has no peak enforcement and behaves exactly as delivered — adoption is a per-profile declaration, not a flag flip.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, F-2, NG-2; §19
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-park.test.ts` (new); delivered provider suites as controls
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-park.test.ts --filter no-window`
**Tags**: @backend, @regression

**Preconditions**:
- A profile with no peak-window rules; an in-flight lane nominated to it; daemon running with the lane composition.

**Steps**:
1. Drive several supervision cycles across the injected clock (arbitrary instants); assert no park, no stop, no park-edge event, and no zero-spend episode is ever produced for the profile — the watcher observes no window and does nothing.
2. Assert admission behavior for the profile equals the delivered gating (no peak-window ineligibility appears).
3. Assert the delivered provider-profile and daemon suites pass unchanged as controls: without declared windows the system behaves exactly as before except for the additive record fields.

**Expected Outcome**:
- Zero enforcement artifacts for a rule-less profile across arbitrary clock positions; delivered behavior byte-for-value.

#### TC-PAUSE-020 - Window start (buffer included) stops every in-flight P lane with bounded grace; the stop event records the deadline

**Objective**: Prove AC-F3-2's head: when P's window opens (buffer included), every in-flight lane nominated to P receives a bounded-grace stop whose deadline is recorded, and lands parked.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-3, DM-4, EVT-1, NFR-1; DEC-6; SC-M2-S17-01
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-park.test.ts` (new); real daemon runtime + manual wake + injected clock + temp store (delivered supervision-suite pattern)
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-park.test.ts --filter window-open`
**Tags**: @backend, @behaviour

**Preconditions**:
- Two in-flight lanes nominated to `profile-a` (fake harness sessions mid-step); `profile-a` declares a window with buffer-before B and the default grace.
- Recording state store; subscription probe on `dispatch.attempt` for the stop frame.

**Steps**:
1. Advance the injected clock to one instant before the buffer-inclusive window start and drive a cycle: assert no stop, no park (the buffer has not opened the window).
2. Advance to the buffer-inclusive start and drive one cycle: assert both lanes received a stop; each stop's recorded grace deadline equals observation + the applied grace, and the applied grace is within the declared bound (`TC-PAUSE-022` holds here too).
3. Assert the `stop` event (EVT-1) lands exactly once per lane with the deadline in its payload, stamped `v2`, per-`(topic, lane)` sequence contiguous.
4. Let the grace elapse on the injected clock (no real sleep) and drive the next cycle: assert both lanes are parked with reason `peak-window` and `until` present (park-record detail in `TC-PAUSE-021`).
5. Matrix: repeat with (a) one lane mid-phase-boundary (safe-boundary composition), (b) grace at its maximum, (c) a lane that completes a step during the grace — each variant must still park within the bound.

**Expected Outcome**:
- Every in-flight lane of the profile is stopped and parked when the window is observed open (buffer included); the stop event records the deadline; variants hold the bound.

**Notes / Clarifications**:
- The one-supervision-cycle timeliness bound is asserted separately in `TC-PAUSE-023` (AMB-P1).

#### TC-PAUSE-021 - The park record carries reason, profile, `until`, and the preservation classification under one fence

**Objective**: Prove DM-4 and TDR-0030 D2: the park record names the profile, carries reason `peak-window`, carries `until` at the window end, carries the closed-value preservation classification, and is appended under one fence exactly once per episode.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-3, DM-4, EVT-2, DEC-11; LIT-P1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-park.test.ts` (new); park record family + `parked` event payload
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-park.test.ts --filter park-record`
**Tags**: @backend, @behaviour, @contract

**Preconditions**:
- A completed park episode from the `TC-PAUSE-020` path (preservation succeeded → classification `preserved`); one with induced preservation failure (from `TC-PAUSE-025`) as the failure variant.

**Steps**:
1. Read the park record: assert `reason == "peak-window"`; the profile is named and equals the lane's recorded nomination; `until` is an absolute UTC instant equal to the instant the daemon actually resumes at (self-consistency: the same boundary the watch observes as the effective window end); the preservation classification is present and equals `preserved` (success variant).
2. Failure variant: the classification equals `session-state-not-preserved` and every other field is identical in shape (same reason, profile, `until` presence).
3. Fence and dedupe: assert exactly one park append per episode under one fence; drive several additional supervision cycles while the window stays open and assert no second park record, no second `parked` event (identity dedupe across repeated observations).
4. Read-time expiry discipline: the park's expiry is observed at read (the delivered park record discipline); assert the record itself is not mutated over time (no in-place write of a "resumed" state onto the park record — resume is a separate record/observation).
5. Cross-carrier agreement: the classification value on the park record, the `parked` event payload, and the status/brief park fields agree for the same episode (AMB-P3/LIT-P1).

**Expected Outcome**:
- The park record is complete, fenced, deduped, and truthful about preservation in both variants; all carriers agree on the classification value.

**Notes / Clarifications**:
- `until` is asserted as self-consistent with the observed effective window end rather than pinned as declared-end vs buffer-inclusive-end; the delivered provider-window precedent uses the effective end, and resume occurs at the boundary `until` names (Flow 2: "window end (buffer included)"). If delivery pins the other reading, the self-consistency assertion still holds and only the fixture expectation moves.

#### TC-PAUSE-022 - The applied grace never exceeds the window buffer

**Objective**: Prove NFR-1/DEC-6 across the whole configuration matrix: the applied stop grace is bounded by the window buffer in 100% of parks, and a preservation failure never extends it.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-2, F-3, NFR-1, DEC-6
**Test Type(s)**: Integration, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-park.test.ts` (new); fixture matrix over grace/buffer configurations
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-park.test.ts --filter grace-bound`
**Tags**: @backend, @behaviour, @bounds

**Preconditions**:
- Fixture matrix: default grace below the buffer; grace at its maximum equal to the buffer; small buffers with the default grace; the preservation-failure variant of each.

**Steps**:
1. For each matrix cell: run the window-open episode; compute the applied grace from the stop event's recorded request instant and deadline.
2. Assert applied grace ≤ declared window buffer in every cell (target: 0 occurrences of applied grace > buffer across the whole matrix, printed with cell count).
3. Failure-variant cells: assert the applied grace equals the success-variant grace for the same configuration — the preservation failure extended nothing (TDR-0030 D5/C-6).
4. Assert the grace-above-maximum configuration never reaches this path at all (validation refuses it — `TC-PAUSE-011`), so the runtime bound cannot be violated by configuration.

**Expected Outcome**:
- Zero grace-bound violations across the matrix; grace is identical with and without preservation failure; the bound is enforced at validation and holds at runtime.

#### TC-PAUSE-023 - The park lands within one observed supervision cycle of the window-open observation

**Objective**: Prove NFR-2 as a measured wake-cycle bound (AMB-P1): every in-flight lane of the profile is stopped and parked within one supervision cycle of the daemon's observation of window start.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F3-2, F-3, NFR-2; AMB-P1
**Test Type(s)**: Integration, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-park.test.ts` (new); manual-wake cycle counting
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-park.test.ts --filter cycle-bound`
**Tags**: @backend, @behaviour, @bounds

**Preconditions**:
- The delivered manual-wake seam driving the daemon's supervision loop; injected clock; lanes in flight on the profile.

**Steps**:
1. Advance the clock to the buffer-inclusive start; drive exactly one cycle; count parks: assert every in-flight lane of the profile is stopped within this cycle (the observation cycle itself), with grace elapsing and the park landing on the subsequent wake the grace bound predicts.
2. Count from observation to parked state per lane; assert the count matches the declared semantics: stop within the observation cycle, park when the recorded grace deadline passes — never a cycle later than the deadline requires.
3. Repeat across a multi-lane fixture (several lanes, staggered step positions); assert no lane required an extra cycle beyond its grace deadline.
4. Assert the sleep counter is zero throughout (the bound is observed via wakes, never wall-clock waits).

**Expected Outcome**:
- 100% of in-flight lanes stopped within the observation cycle and parked by their recorded deadline's wake; cycle counts printed with the fixture size.

#### TC-PAUSE-024 - The lane stays parked until the window ends; no early resume, no re-dispatch

**Objective**: Prove AC-F3-2's tail and DEC-5's negative half: between park and effective window end the lane stays parked, nothing resumes it early, and nothing re-dispatches it.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, F-3, F-5, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-park.test.ts` (new); injected clock swept across the open interval
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-park.test.ts --filter stay-parked`
**Tags**: @backend, @behaviour

**Preconditions**:
- A parked lane from the `TC-PAUSE-020` path; recording counters for dispatch invocations, session resumes, and spawns.

**Steps**:
1. Sweep the injected clock in small instants across the open interval (park → effective end, exclusive); at every instant, read the lane state: assert `parked` with unchanged reason and `until`.
2. At every instant, assert the resume counter is zero and the spawn counter is zero — no session resume is attempted and no fresh dispatch occurs before the window ends.
3. Assert the delivered read-time expiry discipline holds: the park record's `until` does not trigger any action before the boundary; the expiry is a read-time observation only.
4. At one instant before the effective end, drive a cycle and assert still parked (the boundary is inclusive at end, exclusive before it — boundary detail cross-checked in `TC-PAUSE-090`).

**Expected Outcome**:
- The lane is parked at every instant of the open interval with zero mid-window actions; nothing re-dispatches from scratch.

#### TC-PAUSE-025 - A preservation failure never refuses the park and never extends the grace

**Objective**: Prove TDR-0030 D1/D5 and DEC-11: when the bounded-grace stop completes but session-state preservation fails, the lane is still parked for the window with the failure classification, and the grace is untouched — the window is enforced in every park episode.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, AC-F5-4, F-3, DM-4, NFR-1, DEC-11; AMB-P3, LIT-P1
**Test Type(s)**: Negative, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-park.test.ts` (new); harness session port fake with preservation refusal injected
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-park.test.ts --filter preservation-failure`
**Tags**: @backend, @negative, @behaviour

**Preconditions**:
- The session port fake configured to preserve nothing (preservation failure injected at stop time); a success-variant twin episode for comparison.

**Steps**:
1. Drive the window-open episode with the injected preservation failure: assert the lane is stopped and parked — reason `peak-window`, `until` present, exactly one `parked` event.
2. Assert the classification equals `session-state-not-preserved` on the park record, the `parked` payload, and the status/brief park fields (value agreement per LIT-P1).
3. Compare against the success twin: the applied grace is identical (never extended), the `until` is identical, the park count is identical — the only delta is the classification value.
4. Inversion guard: assert the lane is never left running through the window (state is `parked` at every sweep instant per `TC-PAUSE-024`'s method) — the failure did not reopen the uncontrolled path.
5. Scope guard: the zero-spend assertion for this episode remains well-formed and scoped (`TC-PAUSE-050`'s method applies unchanged).

**Expected Outcome**:
- The park lands in every episode regardless of preservation outcome; the classification names the truth everywhere the episode is carried; grace and `until` are untouched.

#### TC-PAUSE-026 - The bounded-grace stop composes with delivered supervision and adds no kill path

**Objective**: Prove NG-6 and RSK-1's mitigation: the stop composes with the delivered lane supervision, liveness, and safe-boundary contracts, introduces no new termination mechanism, and leaves crash-safety guards intact.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F3-2, F-3, NG-6; RSK-1
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-park.test.ts` (new); delivered daemon suites as unmodified controls
**Harness entry**: `bun test tests/behaviour/daemon-preemption.test.ts tests/behaviour/daemon-lane-supervision.test.ts tests/behaviour/daemon-peak-window-park.test.ts --filter composition`
**Tags**: @backend, @regression

**Preconditions**:
- The delivered daemon supervision/preemption suites; a lane with a pending effect intent at stop time (mid-step, effect not yet receipted).

**Steps**:
1. Run the delivered daemon supervision, preemption, reconciliation, and crash-restart suites unchanged: all pass (the delivered contracts did not move).
2. Mid-step stop fixture: stop a lane with a pending effect intent during the grace; assert the effect intent/receipt discipline holds (no half-applied effect; the intent is either completed or cleanly resumed per the delivered crash-safety guards).
3. Resume the lane at window end (`TC-PAUSE-040` path) and assert completed phases skip idempotently — the stop left no duplicate phase work.
4. Source scan: the change's park/stop modules add no new signal operation or process-termination primitive beyond the delivered supervision seam (the only termination path remains the delivered one).

**Expected Outcome**:
- Delivered supervision contracts pass unmodified; the stop path traverses the delivered seam; crash-safety guards hold across a mid-step stop/resume.

#### TC-PAUSE-030 - Other-provider lanes keep running through P's window

**Objective**: Prove AC-F4-3: a window on profile P parks P's lanes and nothing else — lanes on other providers keep running, keep their leases, and keep their supervision for the whole window.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-3, F-4, NFR-2; SC-M2-S17-02
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-isolation.test.ts` (new); two-profile fixture with the window watch
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-isolation.test.ts --filter isolation`
**Tags**: @backend, @behaviour

**Preconditions**:
- One in-flight lane nominated to `profile-a` (window declared) and one to `profile-b` (no window); both mid-step on fake sessions.

**Steps**:
1. Open `profile-a`'s window (clock) and drive cycles across the whole open interval: assert the `profile-b` lane's state remains running at every read, its lease is unchanged, and its supervision records (heartbeat/liveness) keep advancing.
2. Assert zero stop, park, or park-edge artifacts exist for the `profile-b` lane (record scan) — target 0 lanes on providers other than P parked or stopped.
3. Assert the `profile-a` lane is parked per `TC-PAUSE-020`/`TC-PAUSE-021` (the control half of the same episode).
4. Surface witness: the lanes/board surfaces show both states side by side during the window (SC-M2-S17-02's assert: `profile-b` running beside `profile-a` parked).
5. At window end, assert only `profile-a`'s lane resumes (`TC-PAUSE-040` path) — isolation holds through the whole episode, not just the park.

**Expected Outcome**:
- The other provider's lane is untouched for the entire window; both states visible side by side; isolation holds through resume.

#### TC-PAUSE-031 - The park decision reads only the lane's nominated profile and that profile's window state

**Objective**: Prove F-4's decision discipline and RSK-3's misattribution guard: the recorded nomination is the only join key; no model-string, harness-kind, or config-proximity inference ever parks a lane.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-3, F-4; RSK-3
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-isolation.test.ts` (new); four-fixture matrix
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-isolation.test.ts --filter park-key`
**Tags**: @backend, @corner

**Preconditions**:
- Fixtures: (a) window on P with lanes on P and Q; (b) window declared on an unused profile R (no lanes nominated); (c) windows declared on P and S, only P's opening; (d) a lane nominated to P whose fake model string resembles another provider's naming.

**Steps**:
1. Fixture (a): only P's lanes park (isolation deep-run; `TC-PAUSE-030` covers the pair).
2. Fixture (b): drive cycles across R's window: zero parks anywhere — a window on an unused profile parks nothing.
3. Fixture (c): only P's lanes park; S's lanes keep running (independent windows, independent decisions).
4. Fixture (d): the P-nominated lane parks despite its model string; assert the park record names P from the recorded nomination, and the telemetry attribution join (lane + model dimensions) cross-checks consistently — the join never re-derives the profile from the model string.
5. Assert in every fixture that the park set is exactly `{lanes whose recorded nomination is the in-window profile}` — set equality, not subset.

**Expected Outcome**:
- The park decision is a pure function of the recorded nomination and that profile's window state; zero misattributed parks across the matrix.

#### TC-PAUSE-040 - Window end (buffer included) resumes preserved lanes automatically via the session resume path on the same branch

**Objective**: Prove AC-F5-4's preserved half, DEC-5, and Flow 2: at effective window end, a `preserved` lane resumes automatically through the delivered session resume path on the same branch, consuming no restart ordinal, with the resumed event recording the truth.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-4, F-5, EVT-3, NFR-5, DEC-5; SC-M2-S17-03; AMB-P2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-resume.test.ts` (new); session resume path over the fake session port; restart-ordinal accounting
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-resume.test.ts --filter preserved-resume`
**Tags**: @backend, @behaviour

**Preconditions**:
- A parked lane classified `preserved` (from the `TC-PAUSE-020`/`TC-PAUSE-021` path); recording counters for operator commands, dispatch invocations, session resumes, fresh spawns, and restart ordinals; the lane's branch recorded pre-park.

**Steps**:
1. Advance the injected clock to one instant before the effective end and drive a cycle: still parked (`TC-PAUSE-024`'s boundary).
2. Advance past the effective end (buffer included) and drive one cycle: assert the lane resumes — automatically per AMB-P2 (zero operator commands, zero dispatch invocations; the decision derives solely from the window-end observation).
3. Assert the resume traverses the session resume path: the fake session port records an attach-and-continue against the preserved session identity; the fresh-spawn counter is zero (no new session created; no re-dispatch).
4. Assert the restart-ordinal counter is unchanged — attach-and-continue consumes no restart ordinal (DEC-5, delivered economics).
5. Assert the lane is running again on the same branch value recorded pre-park.
6. Assert the `resumed` event (EVT-3) lands once with the preserved session-state reference, the same branch, and the no-re-dispatch fact in its payload, stamped `v2`.

**Expected Outcome**:
- Automatic, session-path, same-branch resume; no ordinal consumed; the resumed event is truthful and exactly once.

#### TC-PAUSE-041 - A not-preserved lane routes to the delivered interrupted-lane recovery: ledger position, same branch, one restart ordinal

**Objective**: Prove AC-F5-4's not-preserved half and TDR-0030 D3: a `session-state-not-preserved` lane is not resumable from session and routes to the delivered interrupted-lane recovery — ledger-position resume on the same branch, exactly one restart ordinal, budget-governed.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-4, F-5, NFR-5, DEC-11; AMB-P2
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-resume.test.ts` (new); preservation-failure episode + restart-budget fixtures
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-resume.test.ts --filter not-preserved-recovery`
**Tags**: @backend, @corner, @behaviour

**Preconditions**:
- A parked lane classified `session-state-not-preserved` (from `TC-PAUSE-025`); restart budget with headroom; ordinal accounting exposed through the delivered records.

**Steps**:
1. Advance past the effective end and drive a cycle: assert **no** session resume is attempted (session-resume counter zero — the classification routed away from session).
2. Assert the recovery path is the delivered interrupted-lane recovery: the lane resumes from the ledger position on the same branch (branch value unchanged; completed phases skip idempotently).
3. Assert exactly one restart ordinal was consumed (delivered `interrupted` semantics); assert admission consulted the restart budget and resume economics (with-headroom fixture proceeds; the exhausted fixture is `TC-PAUSE-042`'s subject).
4. Assert no fresh spawn occurred (spawn counter zero) — recovery is a resume, never a re-dispatch.
5. Assert the episode's records remain truthful: no `resumed` event carrying a preserved session-state reference exists for this lane (it has none — OQ-TP-3 guards the negative half).

**Expected Outcome**:
- Classification-routed recovery: ledger position, same branch, one ordinal, budget-governed, zero fresh spawns, zero false session references.

#### TC-PAUSE-042 - Budget exhaustion escalates as delivered: terminal record + typed question, never silent requeue, never fresh re-dispatch

**Objective**: Prove TDR-0030 D4: when the restart budget is exhausted at a not-preserved lane's window-end recovery, the delivered escalation fires verbatim — terminal exhaustion record and typed question.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-4, F-5, DEC-11; TDR-0030 C-2/C-4
**Test Type(s)**: Negative, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-resume.test.ts` (new); exhausted-budget fixture
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-resume.test.ts --filter exhaustion`
**Tags**: @backend, @negative

**Preconditions**:
- A parked lane classified `session-state-not-preserved`; the restart budget at or above its bound.

**Steps**:
1. Advance past the effective end and drive a cycle: assert the terminal exhaustion record is appended and a typed question is raised (blockers surface carries it, naming the lane and the recovery intent).
2. Assert no silent requeue: the queue entry is not re-activated (queue read unchanged in activation state).
3. Assert no automatic fresh re-dispatch (spawn counter zero) and no session resume (resume counter zero).
4. Control: answer the typed question with a resume-mode answer through the delivered answer channel; assert the delivered resume proceeds — the operator's answer governs what happens next.
5. Assert the lane stayed parked until the escalation (never left running, never silently dropped).

**Expected Outcome**:
- The delivered exhaustion escalation exactly: terminal record + typed question; zero silent requeues; zero fresh re-dispatches.

#### TC-PAUSE-043 - No state lost or duplicated: branch, artifacts, queue, and single-flight intact across the episode

**Objective**: Prove AC-F5-4's tail, NFR-5, and the GH-292 interplay: a full park/resume episode leaves branch, artifacts, and queue state unchanged, duplicates nothing, and single-flight still prevents a second concurrent lane on the ref.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-4, F-5, NFR-5; RSK-5; SC-M2-S17-03
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-resume.test.ts` (new); preserved and not-preserved variants; single-flight predicate
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-resume.test.ts --filter state-fidelity`
**Tags**: @backend, @corner

**Preconditions**:
- A lane with completed phases and existing artifacts; branch ref, artifact digest, and queue entry identity snapshotted pre-park; the per-ref single-flight predicate active.

**Steps**:
1. Run the full episode (park → window → resume) on the preserved variant: assert branch identical, artifact digest unchanged, queue entry identity unchanged (no duplicate entry created).
2. Repeat on the not-preserved variant (recovery path): same three assertions.
3. During the parked interval: attempt a second dispatch on the same ref; assert refusal with the delivered single-flight identity naming the holder — the parked lane still holds the ref.
4. Immediately after resume: repeat the second-dispatch attempt; assert the same refusal (the resumed lane holds it again).
5. Completed-phase idempotency: assert no phase re-executed across the episode (phase transition records unchanged in count for completed phases).

**Expected Outcome**:
- Zero duplicate branches, artifacts, or queue entries by either path; single-flight holds through park and resume; completed work is never redone.

#### TC-PAUSE-044 - An active owner hold outranks the window, including at window end

**Objective**: Prove DEC-8 and Flow 4: the delivered owner-hold precedence applies unchanged to peak-pause episodes — a lane inside a hold is governed by the hold, and a window-end resume never overrides an active hold.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-4, F-5, DM-4, DEC-8
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-peak-window-resume.test.ts` (new); owner-hold fixtures in three orderings
**Harness entry**: `bun test tests/behaviour/daemon-peak-window-resume.test.ts --filter hold-precedence`
**Tags**: @backend, @corner

**Preconditions**:
- Owner-hold gate available (delivered #280 semantics); profile-a window declared; a lane on profile-a.
- Three orderings: (a) hold active before the window opens; (b) hold activates while the lane is already peak-parked; (c) hold activates mid-window and clears before the effective end.

**Steps**:
1. Ordering (a): with the hold active, drive the window open: the lane is governed by the hold (park reads under the hold's reason; `owner-hold` park record carries the hold's expiry per DM-4) — no `peak-window` park decision overrides it.
2. Ordering (b): the lane parks for peak (`TC-PAUSE-020` path), then the hold activates: at window end, drive the resume cycle — assert **no resume** (the hold outranks the window-end trigger); the lane reads as hold-governed on every surface.
3. Ordering (c): the hold clears before the effective end; drive past the end: the lane resumes per its episode's classification path (preserved → session resume per `TC-PAUSE-040`'s method).
4. Assert in every ordering that the delivered hold suites' semantics are unchanged (delivered hold suites pass as controls) — no second precedence rule was invented.

**Expected Outcome**:
- Hold precedence exact in all three orderings; window-end resume is suppressed by an active hold and proceeds once the hold clears.

#### TC-PAUSE-050 - Zero-spend positive reading over present telemetry, scoped park timestamp through window end

**Objective**: Prove AC-F6-5's first half, DM-5, and DEC-4's evidence form: the window-scoped reading counts billable model calls attributable to the parked lane from the park timestamp through the window end, over present telemetry, and reports a positive zero.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-5, F-6, DM-5, NFR-4, DEC-4; SC-M2-S17-04
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-zero-window.test.ts` (new); telemetry v2 attribution join + spend read side over a seeded store
**Harness entry**: `bun test tests/behaviour/spend-zero-window.test.ts --filter zero-present`
**Tags**: @backend, @behaviour, @telemetry

**Preconditions**:
- A parked lane on profile-a with a complete park episode; telemetry present: seeded step records carrying the five attribution dimensions (ticket, repository, lane, agentRole, model) joined via the delivered identity seam.
- Boundary-control seeds: one billable call before the park timestamp and one after the window end (both on the lane).

**Steps**:
1. Read the window-scoped zero-spend evidence for the episode: assert the profile named is `profile-a` (from the lane's nomination), `billableCalls == 0`, and `telemetryState` names present telemetry.
2. Assert the scoping: the seeded pre-park call and post-window call are excluded (they are visible as outside the scoped interval, not silently dropped) — the count covers exactly [park timestamp, window end].
3. Assert the zero is a positive reading: the evidence identifies the attribution join it read (lane + model dimensions over the telemetry v2 storage identity), so "zero" names a read that happened, not an absence of reading.
4. Cross-check the join: the count for the same lane/interval via the spend breakdown surfaces agrees with the assertion reading.

**Expected Outcome**:
- `billableCalls == 0` with `telemetryState == present`, scoped exactly, backed by a named attribution read; SC-M2-S17-04's assert satisfied.

#### TC-PAUSE-051 - Telemetry absence is classified, never reported as zero

**Objective**: Prove AC-F6-5's second half, DEC-4, and RSK-4's false-proof guard: when telemetry is absent or the attribution join is unresolvable, the outcome is classified (`telemetryState` names it) and no surface reports zero from absent evidence.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-5, F-6, DM-5, NFR-4, DEC-4
**Test Type(s)**: Negative, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-zero-window.test.ts` (new); absent-sink and absent-dimension fixtures per the delivered telemetry discipline
**Harness entry**: `bun test tests/behaviour/spend-zero-window.test.ts --filter absence-classified`
**Tags**: @backend, @negative, @telemetry

**Preconditions**:
- Fixtures: (a) telemetry sink absent (delivered absent-sink behavior); (b) sink present but the lane attribution dimension unresolvable for the episode's window (absent dimension stored as null with a closed warning, per delivered telemetry v2 discipline).

**Steps**:
1. Read the assertion for fixture (a): assert `telemetryState` names the classified absence; assert no numeric zero is reported anywhere in the reading.
2. Read for fixture (b): assert the same classification discipline — the unresolvable join is never silently counted as zero calls.
3. Scan the assertion output (and any surface that renders it) for a zero value presented alongside an absence classification: assert none exists — zero and absence are mutually exclusive renderings.
4. Control: the `TC-PAUSE-050` fixture re-read in the same run still reports present-zero, so the classification branches are both live.

**Expected Outcome**:
- Absence is always a classified outcome; zero is never claimed on missing evidence; the distinction is pinned in both directions.

#### TC-PAUSE-052 - Boundary scoping excludes pre-park and post-window calls and the zero is falsifiable

**Objective**: Prove DEC-4's scoping rule and the assertion's falsifiability: pre-park boundary calls are excluded, and a call that lands inside the window despite the park makes the reading non-zero — a constant zero cannot pass.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-5, F-6, DM-5, DEC-4
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-zero-window.test.ts` (new); seeded-call position matrix
**Harness entry**: `bun test tests/behaviour/spend-zero-window.test.ts --filter boundary-scoping`
**Tags**: @backend, @corner, @telemetry

**Preconditions**:
- Seed matrix of billable calls at: park-timestamp − 1 (before), park-timestamp exactly (boundary), mid-window, window-end exactly (boundary), end + 1 (after); a breach fixture with a mid-window call despite the park.

**Steps**:
1. Clean episode with the seed matrix minus the mid-window call: assert `billableCalls == 0` — the exact-boundary calls (park timestamp inclusive per DEC-4's "excludes calls before the park timestamp"; window end inclusive) are excluded correctly.
2. Breach fixture (mid-window call seeded): assert the reading reports the call (`billableCalls > 0`) — the assertion detects a real spend breach, proving it is a count and not a constant.
3. Assert the breach reading still names present telemetry and the same scoping interval (the breach does not corrupt the classification).
4. Assert the boundary seeds' positions are visible in the reading's scope disclosure (the reader can see what was excluded and why).

**Expected Outcome**:
- Scoping exact at both boundaries; the zero is falsifiable — a seeded breach reads non-zero with the same evidence form.

#### TC-PAUSE-060 - The v2 declaration carries the four kinds with pinned payload fields; drift machinery extends

**Objective**: Prove TDR-0029 D2/D7 and DEC-3: taxonomy v2 declares the four kinds additively with per-kind payload field lists, and the delivered drift/pinning machinery extends to them.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-6, F-7, EVT-1..EVT-4, NFR-6, DEC-3, DEC-10; BYTE-P1
**Test Type(s)**: Unit, Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: delivered taxonomy declaration suites under `tests/structure/` (extended to v2, GH-290 machinery) + `tests/checks/event-taxonomy-conformance.test.ts` (page half extended)
**Harness entry**: `bun test tests/structure/event-taxonomy-declaration.test.ts tests/checks/event-taxonomy-conformance.test.ts`
**Tags**: @backend, @structure, @contract

**Preconditions**:
- The v2 declaration as the shipped compiled constant; the delivered declaration-cases fixture transcribed to the v2 kind sets with a comment naming the M2 contracts section.

**Steps**:
1. Assert `dispatch.attempt` kinds equal `["started","refused","completed","stop","parked","resumed"]` and `queue.graph` kinds equal `["entry","dependency-edge","release","remove","park-edge"]`, in declared order.
2. Assert the other four topics' kind sets are unchanged from v1 (exact equality) and every kind carries a non-empty declared payload field list.
3. Assert the per-kind payload content matches the M2 contracts/spec: `stop` carries the bounded-grace deadline; `parked` carries reason `peak-window`, the profile, `until`, and the preservation classification; `resumed` carries the session-state reference, the branch, and the no-re-dispatch fact; `park-edge` carries the park lifecycle edge fields.
4. Extend the drift suite: a mutant per new kind (rename, payload-field drop, payload-field add) fails a named per-topic assertion naming the drifted item; non-version mutants report `versionImplication` semantics consistent with the delivered comparator.
5. Extend the integrity check to the new kinds (duplicate kind, empty payload list each fail).
6. Reference surface: `events list --json` renders `taxonomyVersion: "v2"` with topic records equal to the v2 declaration; `events describe <topic>` names the new kinds with their payload fields.

**Expected Outcome**:
- The v2 declaration is exact and pinned; drift in any new kind fails by name; the reference surface equals the declaration.

#### TC-PAUSE-061 - Every v1 kind and payload is byte-identical under v2; envelope, ordering, overflow unchanged

**Objective**: Prove TDR-0029 D2/D3 (C-1/C-3): the version bump changes only the kind sets and the stamp — every v1 kind emits exactly its delivered payload, and the envelope, per-`(topic, lane)` sequence, overflow, and emission model are untouched.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-6, F-7, EVT-4, DEC-10; BYTE-P1
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: delivered taxonomy drift/contract suites and goldens (extended); real projector over the delivered case views
**Harness entry**: `bun test tests/structure/event-taxonomy-drift.test.ts tests/golden/`
**Tags**: @backend, @regression, @contract

**Preconditions**:
- The delivered per-kind emitted-payload-key comparators and golden frame fixtures from GH-290, extended to run under the v2 declaration.

**Steps**:
1. For every v1 kind on all six topics: the emitted payload key list equals the delivered list exactly, bidirectionally (a dropped key and an added key are both violations).
2. Golden comparison: representative v1 frames under v2 match their goldens except for version-bearing fields; the golden regeneration at the version bump is done once, deliberately, by explicit command, and the diff shows only version-bearing deltas.
3. Envelope: the eight `data` fields, their order, and the absent `cursor` are unchanged on every event topic; snapshot frames stay `{topic, cursor, snapshot}`.
4. Ordering: per-`(topic, lane)` monotonic sequence, cross-lane independence, and the restart discontinuity behave exactly as delivered (delivered ordering suites pass).
5. Overflow: an overflowing subscription still receives exactly one degraded frame with `overflow: "repoll"`; the capacity bound and `daemon.subscriber-degraded` refusal are unchanged.
6. Unknown-topic refusal unchanged.

**Expected Outcome**:
- Zero v1 drift under v2: payloads, envelope, ordering, and overflow byte-for-value identical; only the stamp and the additive kinds differ.

#### TC-PAUSE-062 - One declaration constant stamps frames, degraded frames, and the reference surface; v1 retired as spoken version

**Objective**: Prove TDR-0029 D4/D5 (C-4/C-6): the `v2` stamp on event frames, degraded frames, and the `events` reference surface renders from one declaration constant, and the daemon speaks exactly one version.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-6, F-7, DEC-10
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: delivered single-source/stamp machinery under `tests/structure/` (extended); mutant over the version constant
**Harness entry**: `bun test tests/structure/event-taxonomy-single-source.test.ts`
**Tags**: @backend, @contract, @mutation

**Preconditions**:
- The delivered declaration-injection seam (or an equivalent mutant entry point) that moves the version constant in memory without editing the shipped bytes.

**Steps**:
1. Baseline: event frames, the degraded/overflow frame, and the reference surface records all render `taxonomyVersion: "v2"` from the shipped constant.
2. Mutant: move the version constant once; assert all three consumers move together — a stamp that moves on frames but not on the reference surface (or vice versa) fails.
3. Restore; assert the shipped declaration module bytes are unchanged after the mutant ran (read-before/read-after guard).
4. Source scan: no production module outside the declaration renders a taxonomy version literal (no private copies).
5. Single spoken version: assert the subscribe surface serves only v2 frames (no `v1` stamp appears on any frame; no v1-only topic set is served) — v1 is retired, not served concurrently.

**Expected Outcome**:
- One constant, three consumers, zero divergence; exactly one spoken version on the wire and the reference surface.

#### TC-PAUSE-063 - v1-pinned consumer compatibility: ignore-and-continue, contiguous sequence, stamp-drift signal

**Objective**: Prove TDR-0029 D6 (C-5): a v1-pinned consumer keeps working by construction — the four new pairs are decodable and ignorable, sequences stay contiguous, a foreign stamp is a drift signal answered by re-reading the reference surface, and repoll stays reserved for discontinuity and overflow.
**Scenario Type**: Behaviour
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-6, F-7, DEC-10; RSK-6
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/event-taxonomy-v2-compat.test.ts` (new); delivered control server + session over the in-memory transport pair, with one bounded real unix-socket variant
**Harness entry**: `bun test tests/behaviour/event-taxonomy-v2-compat.test.ts`
**Tags**: @backend, @behaviour, @integration

**Preconditions**:
- The delivered codec/session as the peer implementation, pinned to `v1` (its stamp check enabled); a daemon speaking v2 emitting a full peak-pause episode plus ordinary v1 traffic on the same topics.

**Steps**:
1. Deliver `stop`, `parked`, `resumed`, and `park-edge` frames to the pinned consumer: each decodes, hits the kind switch's default-ignore branch, and the consumer continues receiving subsequent frames.
2. Assert sequence contiguity: the new kinds ride the same per-`(topic, lane)` sequence with no gap — the consumer is not routed to a repoll by an additive kind (the ignore-and-continue remedy, never repoll).
3. Stamp drift: deliver a frame whose stamp differs from the pin: assert the consumer raises the version-drift signal path (re-read the `events` reference surface), with no disconnect and no error — ordering behavior unchanged.
4. Repoll reservation: introduce a genuine sequence gap; assert the consumer routes to repoll (the delivered remedy fires only for discontinuity) — the two remedies did not multiply.
5. Overflow: deliver past the buffer; assert the one degraded frame with `repoll` and the `v2` stamp; only that subscription drops.
6. Socket variant: repeat steps 1–3 over a real unix socket under a temp state directory, bounded by a hard timeout and a `finally` close.

**Expected Outcome**:
- The six-point compatibility statement is observable end to end: shape kept, v1 content unchanged, new kinds ignorable, drift is a signal, ordering/overflow untouched, remedies unmultipled.

#### TC-PAUSE-064 - Exactly one stop, parked, resumed, and park-edge per episode with ledger-reconstructable payloads

**Objective**: Prove AC-F7-6's ledger half and §10's observability claim: every transition of a peak-pause episode lands exactly once as a ledger event with declared payloads, and an auditor can reconstruct the episode from the ledger alone.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-6, F-7, EVT-1..EVT-4, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pause-episode-events.test.ts` (new); real emission projection over a full episode; subscription probes on both topics
**Harness entry**: `bun test tests/behaviour/pause-episode-events.test.ts`
**Tags**: @backend, @behaviour, @events

**Preconditions**:
- A full episode: stop → parked → window → resume (preserved variant), plus the not-preserved variant; subscribers on `dispatch.attempt` and `queue.graph`.

**Steps**:
1. Preserved variant: assert exactly one `stop`, one `parked`, one `resumed` frame on `dispatch.attempt` and one `park-edge` frame on `queue.graph` for the episode — driven across many supervision ticks to prove no duplication (identity dedupe across repeated observations).
2. Payload audit: the `stop` payload carries the grace deadline; `parked` carries reason `peak-window`, the profile, `until`, and the classification; `resumed` carries the session-state reference, the branch, and the no-re-dispatch fact; `park-edge` carries the lifecycle edge.
3. Reconstruction: from the frames alone, reconstruct the episode — profile, window end, grace deadline, session-state reference, and branch are all present across the payloads (§10's auditor claim); assert no field required is missing.
4. Sequence: per-`(topic, lane)` sequence contiguous across the episode's frames and any interleaved v1 traffic.
5. Not-preserved variant: exactly one `stop` and one `parked` (with the failure classification); assert no `resumed` frame carrying a preserved session-state reference exists for the lane (the recovery's records follow the delivered interrupted-lane machinery; OQ-TP-3 guards the resumed-frame question).

**Expected Outcome**:
- Exactly-once, fully-payloaded, reconstructable episode events; dedupe holds across repeated ticks; the not-preserved episode's frames are truthful.

#### TC-PAUSE-070 - Status digest carries the lane park fields for open episodes and clears them after

**Objective**: Prove AC-F7-6's surface half for status: the digest shows lane-level parked count, reason, `until` (and the preservation classification per F-7) for open episodes, agreeing with the recorded truth, and shows no stale park fields after the episode closes.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-6, F-7, NFR-8; SC-M2-S17-07; AMB-P3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-brief-park-fields.test.ts` (new); status digest collector over the episode store
**Harness entry**: `bun test tests/behaviour/status-brief-park-fields.test.ts --filter status`
**Tags**: @backend, @behaviour, @surfaces

**Preconditions**:
- A store with an open peak-pause episode (lane parked) and a closed one (resumed); the delivered status digest composition.

**Steps**:
1. During the open episode: read `status` (text and `--json`); assert the lane park fields are present: parked count reflects the open episode, reason `peak-window`, `until` matching the park record, and the preservation classification rendering truthfully (AMB-P3: visibility + value agreement, placement delivery-bound).
2. Agreement: the rendered values equal the park record's fields for the same episode — one recorded truth, no surface-private copy.
3. Close the episode (window-end resume): re-read `status`; assert the parked count returns to the delivered baseline for that lane and no stale reason/`until` remains rendered for the closed episode (the episode remains auditable via the ledger, not via a stale render).
4. Isolation witness: with the `TC-PAUSE-030` two-profile store, status shows only P's lane in the park fields — the running lane contributes no parked count.
5. Control: with no episode ever opened, the park fields render the delivered empty state (no synthesized zeros presented as episodes).

**Expected Outcome**:
- Open-episode park fields exact and agreeing with records; closed episodes leave no stale rendering; empty state honest.

#### TC-PAUSE-071 - Brief projects the same park fields with zero added reads

**Objective**: Prove NFR-8 and F-7's brief discipline: the brief renders the same park fields from the same collector facts as status, adding zero reads of its own.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-6, F-7, NFR-8; SC-M2-S17-07; AMB-P3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-brief-park-fields.test.ts` (new); read-counting store wrapper; brief renderer
**Harness entry**: `bun test tests/behaviour/status-brief-park-fields.test.ts --filter brief`
**Tags**: @backend, @contract, @surfaces

**Preconditions**:
- The open-episode store from `TC-PAUSE-070`; a recording store wrapper counting reads per command invocation.

**Steps**:
1. Render `brief` on the open-episode store: assert the park fields (parked count, reason, `until`, classification) equal the status digest's values field-for-value.
2. Read accounting: the brief's read count equals the delivered collector pass's read count — the park fields add zero reads (count identical with and without an open episode, and identical to the delivered brief's count shape).
3. Mutant control: change one park-record field (e.g., `until`) in the store; re-render both surfaces; assert both move together — neither carries a private copy of the facts.
4. Assert the brief performs no read of its own beyond the collector pass (no second store pass attributable to park fields).

**Expected Outcome**:
- Same facts, same values, zero added reads; the surfaces cannot disagree.

#### TC-PAUSE-072 - Park-cause vocabulary: lanes `parked:<cause>` gains `peak-window`/`owner-hold`; delivered three unchanged; `queue release --park` accepts them

**Objective**: Prove DEC-2 and Appendix A: the park cause additions join the delivered vocabularies without a fourth set — no duplicate cause, no silent rename — and the CLI surfaces accept the new causes with the delivered requirements.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-6, F-7, DM-4, DEC-2
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-park-causes-s17.test.ts` (new) + `tests/golden/lanes-list.test.ts` (deliberate golden extension)
**Harness entry**: `bun test tests/behaviour/queue-park-causes-s17.test.ts tests/golden/lanes-list.test.ts`
**Tags**: @backend, @regression, @cli

**Preconditions**:
- A store with parkable lanes; the delivered `queue release --park` surface; the lanes projection.

**Steps**:
1. Park a lane with cause `peak-window` (with `--until` at the window end); assert the lanes projection renders `parked:peak-window` and the park record names the profile and carries the classification.
2. Park a lane with cause `owner-hold`; assert `parked:owner-hold` renders and the park record carries the hold's expiry (DM-4 owner-hold half).
3. Golden control: the delivered three causes (`provider-window`, `provider-quota`, `preempted-for-close-item`) render exactly as delivered — golden regeneration shows only the additive cause values.
4. `queue release --park peak-window` without `--until` is refused with the delivered requirement (provider-window parks require an explicit `--until <iso>`); `--park owner-hold` carries the hold's expiry semantics.
5. Closed-vocabulary equality: the park-cause set equals delivered-three + `peak-window` + `owner-hold` exactly — set equality in both directions (no rename, no removal, no extra member).

**Expected Outcome**:
- Additive vocabulary exact on record, projection, and command surfaces; delivered renders unchanged.

#### TC-PAUSE-080 - Daemon-absent degradation: iteration-start gating with declared mode and `parkClaimed == false`

**Objective**: Prove AC-F8-7, F-8, and DEC-7: with no resident daemon, behavior degrades to the delivered iteration-start gating, the degradation is declared in the machine read (`mode == "iteration-start-gating"`, `parkClaimed == false`), and a lane outside the daemon is honestly untouched mid-flight.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-7, F-8, NFR-7, DEC-7; SC-M2-S17-05; AMB-P4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-absent-degradation.test.ts` (new); no-daemon composition; delivered daemon-degradation suites as precedent
**Harness entry**: `bun test tests/behaviour/daemon-absent-degradation.test.ts --filter mode-declared`
**Tags**: @backend, @behaviour

**Preconditions**:
- No daemon running (the delivered daemon-absent composition); profile-a with an open window; a delivery running through the one-shot dispatch path on profile-b (unaffected) and admission attempts on profile-a.

**Steps**:
1. Admission half: attempt a new dispatch on profile-a while its window is open: assert the delivered iteration-start gating refuses at admission (profile ineligible; delivered F-6 identity/exit) — the degradation is the delivered gating, unchanged.
2. Machine read: read the machine view of the relevant surface (AMB-P4: the delivered machine read(s) the change declares); assert `mode == "iteration-start-gating"` and `parkClaimed == false` exactly.
3. Mid-flight honesty: a delivery already running outside the daemon (started before the window opened) proceeds to completion — nothing parks it; assert its attempt/records show no park, stop, or resume artifacts.
4. Control: with the window closed, admission on profile-a proceeds normally — the gating is window-conditional as delivered.

**Expected Outcome**:
- Declared degradation: delivered admission gating, explicit `mode` and `parkClaimed == false`, zero mid-flight interference.

#### TC-PAUSE-081 - No surface claims a park that did not happen (daemon-absent)

**Objective**: Prove NFR-7's zero-false-claims tail and RSK-7: with no daemon and a window open, no surface reports a parked lane, a stop, or a resume, and no zero-spend episode reading is synthesized for a park that never happened.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-7, F-8, NFR-7, DEC-7
**Test Type(s)**: Negative, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-absent-degradation.test.ts` (new); full surface scan over the daemon-absent store
**Harness entry**: `bun test tests/behaviour/daemon-absent-degradation.test.ts --filter no-false-claims`
**Tags**: @backend, @negative

**Preconditions**:
- Daemon-absent store with profile-a's window open and at least one delivery that ran through the window outside the daemon.

**Steps**:
1. Scan every surface: `status`, `brief`, `lanes`, `board`, `dispatch attempts`, and the `events` reference/frames: assert zero parked-lane renderings, zero stop/parked/resumed frames, zero park-edge edges.
2. Zero-spend honesty: assert no window-scoped zero-spend episode reading is presented for the window — absence of a park episode is never rendered as a proven zero (an episode-scoped assertion requires an episode; `TC-PAUSE-051`'s classification discipline governs any reading that does exist).
3. Ledger count: the durable records contain zero park-family records for the window interval.
4. Enforcement-claim count across all scanned surfaces: 0 (the NFR-7 target).

**Expected Outcome**:
- Zero false enforcement claims on any surface; the degradation is declared (per `TC-PAUSE-080`) and nothing else claims enforcement.

#### TC-PAUSE-090 - UTC-only window evaluation on the injected clock, TZ-independent

**Objective**: Prove NFR-3, DEC-1, and NG-4: window start/end are evaluated against the declared UTC instants on the injected clock, boundaries are exact, and host-timezone variation never shifts a decision.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-2, F-3, NFR-3, DEC-1
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/peak-window-utc-clock.test.ts` (new); boundary matrix over the injected clock
**Harness entry**: `bun test tests/behaviour/peak-window-utc-clock.test.ts`
**Tags**: @backend, @corner, @clock

**Preconditions**:
- A window declared as UTC instants with non-zero buffers; the injected clock; a lane on the profile.
- The boundary fixtures: start−buffer−1, start−buffer (open), effective-end−1 (parked), effective-end (resume).

**Steps**:
1. Drive each boundary fixture: assert the decision flips exactly at the declared instants — closed before start−buffer, open at start−buffer; parked before the effective end, resumed at it. 0 evaluations off the declared UTC instants.
2. TZ matrix: run the identical fixture with the process timezone environment varied across several zones (including a DST-observing zone crossing the window): assert every decision is identical to the UTC baseline — evaluation is TZ-independent.
3. Assert no wall-clock read participates: the sleep counter is zero and the clock is the injected one throughout (hermeticity cross-link).
4. Non-UTC zone declaration: with a time-zone declaration present in the schema (DM-3 carries it), assert the evaluation instants remain the declared UTC instants — the zone field never shifts a boundary (OQ-TP-1's validation question is out of scope here; this asserts evaluation only).

**Expected Outcome**:
- Boundary-exact, UTC-only, TZ-independent evaluation; 0 off-basis evaluations across the matrix.

#### TC-PAUSE-091 - Determinism: identical inputs produce identical park, resume, and event decisions

**Objective**: Prove NFR-9: identical declared windows, provider facts, records, and injected clock produce identical park, resume, and event decisions across repeated runs.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-4, F-3, F-5, NFR-9
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/peak-pause-determinism.test.ts` (new); two identical runs over identical fixture stores
**Harness entry**: `bun test tests/behaviour/peak-pause-determinism.test.ts`
**Tags**: @backend, @corner, @determinism

**Preconditions**:
- One episode fixture (park → resume, preserved and not-preserved variants) captured as a deterministic script: same declarations, same seeds, same clock schedule.

**Steps**:
1. Run the fixture twice from identical initial stores; compare: the park set (which lanes, which instants), the applied grace deadlines, the event sequence (kinds, order, payload values), the resume decisions, and the surface renderings.
2. Assert zero divergence on every compared dimension (byte-for-value equality of the decision records).
3. Repeat the comparison for the not-preserved variant including the recovery routing decision and ordinal consumption.

**Expected Outcome**:
- Identical inputs → identical outputs on every dimension, both variants; zero flakiness in the decision layer.

#### TC-PAUSE-092 - Hermeticity of the delivering suite: zero live network, zero credential reads, zero sleeps

**Objective**: Prove NFR-10: the delivering test suite runs with zero live network, zero live credential reads, and zero real sleeps — every provider, telemetry, clock, and transport dependency is an injected fake.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-10 (guards all ACs); §21, NG-1
**Test Type(s)**: Negative, Guard
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/peak-pause-hermetic.test.ts` (new); mirrors the delivered `daemon-hermetic` / `events-hermetic` pattern over the new suites
**Harness entry**: `bun test tests/checks/peak-pause-hermetic.test.ts`
**Tags**: @backend, @checks, @hermeticity

**Preconditions**:
- Instrumented counters for network connects, DNS, credential/environment reads of provider-secret shape, and sleeps, armed around every new suite in this plan.

**Steps**:
1. Run every new suite under the armed counters; assert zero network connects, zero credential reads (provider usage rides the fake harness session port; telemetry rides the fake drain), zero real sleeps (all timing via the injected clock and manual wake).
2. Assert all state lives in temp directories (no writes to the live tree or `$HOME`).
3. Assert the counters themselves are live (a canary that performs a fake-recorded network call trips them — the guard is not vacuously green).
4. Print the counters with the suite list as the hermeticity evidence record.

**Expected Outcome**:
- Zero live effects across the plan's suites; the evidence is recorded for the quality gate.

#### TC-PAUSE-093 - Event evidence bounds on the four kinds: ≤ 20 payload fields, ≤ 1024 bytes evidence

**Objective**: Prove NFR-6: the stop, parked, resumed, and park-edge events obey the declared envelope and the bounded-evidence budgets in the worst case, with no undeclared truncation.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-6, F-7, NFR-6
**Test Type(s)**: Corner Case, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pause-episode-events.test.ts` (new); worst-case fixture (max-length identifiers within declared caps)
**Harness entry**: `bun test tests/behaviour/pause-episode-events.test.ts --filter bounds`
**Tags**: @backend, @bounds

**Preconditions**:
- Worst-case episode: maximum-length profile name, ref, branch, and session reference within the delivered identifier caps.

**Steps**:
1. Emit the full episode; for each of the four kinds assert the payload field count ≤ 20 and the evidence size ≤ 1024 bytes (measured and printed).
2. Assert every frame respects the delivered frame bound (`DAEMON_MAX_FRAME_BYTES`) with no truncation marker and no undeclared cut (delivered discipline: the only cut is a declared one).
3. Assert the envelope field set is unchanged under the worst case (bounds never grow the envelope).

**Expected Outcome**:
- All bounds hold with printed measurements; no truncation, no envelope growth.

#### TC-PAUSE-094 - Additive record discipline and the owner-hold park expiry

**Objective**: Prove DM-6, DM-4's owner-hold half, and G-9: every new/changed record follows the state layer's additive, schema-versioned, fenced-append conventions — no in-place mutation, no schema bump of delivered payloads, no migration — and `owner-hold` parks carry the hold's expiry.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-4, F-1, F-5, DM-4, DM-6, DEC-2; G-9
**Test Type(s)**: Regression, Structure
**Automation Level**: Automated
**Target Layer / Location**: delivered state-contract suites under `tests/structure/` (extended) + `tests/behaviour/queue-park-causes-s17.test.ts`
**Harness entry**: `bun test tests/structure/state-contract.test.ts tests/behaviour/queue-park-causes-s17.test.ts --filter additivity`
**Tags**: @backend, @regression, @structure

**Preconditions**:
- A store containing pre-change records (attempt, lane, park) and post-change records from the episode fixtures.

**Steps**:
1. Assert `STATE_SCHEMA_VERSION` is unchanged; no record kind, payload schema, key prefix, migration, backfill, or seed was added by the change (delivered additivity inventory pattern, extended to the new fields).
2. Assert the new fields (`providerProfile` on attempt/lane; the preservation classification and profile/`until` on peak-window parks; the hold expiry on owner-hold parks) are additive on the delivered families — delivered payload shapes parse unchanged, pre-change records valid.
3. Assert appends are fenced: each park/episode append lands under one fence (delivered fenced-append discipline), and no delivered record is mutated in place by any episode step (byte-level comparison of untouched records).
4. Error-table control: no new `dispatch` error-table row was added by the admission refusal (TDR-0028 C-2/D2 — the refusal carries existing identities).

**Expected Outcome**:
- Additivity clean in both directions; the vocabulary and record families extended, never edited.

## 6. Environments and Test Data

- **Environments.** One hermetic local environment: Bun test runner over temp state directories (`tmp/` under the workspace; never `$HOME` or the live tree). No staging or external system is involved; every dependency is an in-process injected port.
- **Clock.** All window evaluation, grace deadlines, and scoping intervals run on an injected UTC clock driven stepwise by the tests (delivered injected-clock discipline). No real sleep anywhere; daemon cycles are driven by the delivered manual-wake seam.
- **Provider seams.** The harness session port is a recording fake with scriptable behaviors: normal steps, mid-step stop, preservation refusal, resume attachment. No live provider, no credential read, no network (NG-1, NFR-10).
- **Telemetry.** Step records are seeded through the delivered telemetry v2 ingest path with the five attribution dimensions; absence fixtures use the delivered absent-sink and absent-dimension behaviors. Scoping fixtures seed boundary-positioned calls explicitly.
- **Transport.** Event subscription cases use the delivered in-memory transport pair through the real control server/session; one bounded real unix-socket variant exists for the compatibility case (`TC-PAUSE-063`), under a temp state directory with a hard timeout and `finally` close (the delivered GH-290 pattern).
- **Fixtures.** Live under `tests/fixtures/**` and committed case-definition modules, never named `*.test.ts`. Pre-change records are seeded as delivered-shape records without the new fields (`TC-PAUSE-005`). The v2 declaration fixture is transcribed from the M2 contracts section with a source comment (`TC-PAUSE-060`).
- **Goldens.** The `lanes` projection goldens and representative frame goldens are regenerated only by an explicit command, once, at review; the regeneration diff must show only the declared additive/version-bearing deltas (testing-strategy golden rule).
- **Isolation and determinism.** Every suite constructs its own store; no cross-suite shared state; identical-input determinism is asserted by paired runs (`TC-PAUSE-091`).
- **Aggregate gate.** `TMPDIR="$PWD/tmp/tmpdir" pnpm check` is the canonical local gate (TMPDIR lesson); narrow suites are used while iterating, per the testing strategy.

## 7. Automation Plan and Implementation Mapping

Every case is automated under `bun test`. All new suites are **To Implement** in this change; rows marked **Existing – Update** extend delivered suites/goldens in place. Delivery owns exact module paths (GAP-T5); the files below are the planned locations following repo conventions, and a case that cannot resolve its seam fails naming the missing contract rather than skipping. Aggregate verification: `TMPDIR="$PWD/tmp/tmpdir" pnpm check`.

| TC ID | Suite / file | Command | Injection / fixture requirements | Status |
|---|---|---|---|---|
| TC-PAUSE-001 | `tests/behaviour/provider-nomination-admission.test.ts` | `bun test tests/behaviour/provider-nomination-admission.test.ts` | Recording harness session port; temp store; nominated + claim-path fixtures | To Implement |
| TC-PAUSE-002 | `tests/behaviour/provider-nomination-admission.test.ts` | `bun test … --filter no-nomination` | Four no-nomination config fixtures; record-count + spawn + event counters | To Implement |
| TC-PAUSE-003 | `tests/behaviour/provider-nomination-admission.test.ts` | `bun test … --filter claim-parity` | Daemon runtime with lane composition; manual wake; queued ref fixtures | To Implement |
| TC-PAUSE-004 | `tests/behaviour/provider-nomination-admission.test.ts` | `bun test … --filter empty-branch` | Empty-branch configuration; resolve-surface baseline capture | To Implement |
| TC-PAUSE-005 | `tests/behaviour/provider-nomination-admission.test.ts` | `bun test … --filter pre-change-absence` | Seeded pre-change lane record (byte-compare); window fixture | To Implement |
| TC-PAUSE-006 | `tests/behaviour/provider-nomination-admission.test.ts` | `bun test … --filter no-default-no-borrow` | Two-lane store (borrow bait); all read surfaces; mutant removal control | To Implement |
| TC-PAUSE-010 | `tests/structure/provider-peak-rules-schema.test.ts` | `bun test tests/structure/provider-peak-rules-schema.test.ts` | Rule declaration fixture; config loader; ambient-globals scan | To Implement |
| TC-PAUSE-011 | `tests/structure/provider-peak-rules-schema.test.ts` | `bun test … --filter validation` | Malformed fixture set; valid control; validator entry point | To Implement |
| TC-PAUSE-012 | `tests/behaviour/daemon-peak-window-park.test.ts` | `bun test … --filter no-window` | Rule-less profile; injected clock sweep; delivered controls | To Implement |
| TC-PAUSE-020 | `tests/behaviour/daemon-peak-window-park.test.ts` | `bun test … --filter window-open` | Real daemon runtime; manual wake; injected clock; subscription probe | To Implement |
| TC-PAUSE-021 | `tests/behaviour/daemon-peak-window-park.test.ts` | `bun test … --filter park-record` | Episode fixtures (success + failure variants); tick-dedupe driver | To Implement |
| TC-PAUSE-022 | `tests/behaviour/daemon-peak-window-park.test.ts` | `bun test … --filter grace-bound` | Grace/buffer matrix; stop-event deadline records | To Implement |
| TC-PAUSE-023 | `tests/behaviour/daemon-peak-window-park.test.ts` | `bun test … --filter cycle-bound` | Manual-wake cycle counter; multi-lane staggered fixture; sleep counter | To Implement |
| TC-PAUSE-024 | `tests/behaviour/daemon-peak-window-park.test.ts` | `bun test … --filter stay-parked` | Clock sweep across open interval; resume/spawn/dispatch counters | To Implement |
| TC-PAUSE-025 | `tests/behaviour/daemon-peak-window-park.test.ts` | `bun test … --filter preservation-failure` | Session port fake with preservation refusal; success twin; status/brief probes | To Implement |
| TC-PAUSE-026 | `tests/behaviour/daemon-peak-window-park.test.ts` | `bun test tests/behaviour/daemon-preemption.test.ts tests/behaviour/daemon-lane-supervision.test.ts tests/behaviour/daemon-peak-window-park.test.ts --filter composition` | Delivered suites as controls; effect-intent fixture; source scan | To Implement (controls Existing – No Change) |
| TC-PAUSE-030 | `tests/behaviour/daemon-peak-window-isolation.test.ts` | `bun test … --filter isolation` | Two-profile fixture; lanes/board read probes | To Implement |
| TC-PAUSE-031 | `tests/behaviour/daemon-peak-window-isolation.test.ts` | `bun test … --filter park-key` | Four-fixture matrix (unused profile, dual windows, model-string bait) | To Implement |
| TC-PAUSE-040 | `tests/behaviour/daemon-peak-window-resume.test.ts` | `bun test … --filter preserved-resume` | Session resume fake; ordinal accounting; command counters | To Implement |
| TC-PAUSE-041 | `tests/behaviour/daemon-peak-window-resume.test.ts` | `bun test … --filter not-preserved-recovery` | Preservation-failure episode; restart-budget headroom fixture | To Implement |
| TC-PAUSE-042 | `tests/behaviour/daemon-peak-window-resume.test.ts` | `bun test … --filter exhaustion` | Exhausted-budget fixture; blockers read; answer-channel control | To Implement |
| TC-PAUSE-043 | `tests/behaviour/daemon-peak-window-resume.test.ts` | `bun test … --filter state-fidelity` | Pre/post snapshots (branch, artifact digest, queue identity); single-flight predicate | To Implement |
| TC-PAUSE-044 | `tests/behaviour/daemon-peak-window-resume.test.ts` | `bun test … --filter hold-precedence` | Owner-hold gate; three orderings; delivered hold suites as controls | To Implement |
| TC-PAUSE-050 | `tests/behaviour/spend-zero-window.test.ts` | `bun test … --filter zero-present` | Seeded telemetry step records (five dimensions); boundary-call seeds | To Implement |
| TC-PAUSE-051 | `tests/behaviour/spend-zero-window.test.ts` | `bun test … --filter absence-classified` | Absent-sink + absent-dimension fixtures; output scan | To Implement |
| TC-PAUSE-052 | `tests/behaviour/spend-zero-window.test.ts` | `bun test … --filter boundary-scoping` | Boundary seed matrix; breach fixture | To Implement |
| TC-PAUSE-060 | delivered taxonomy declaration + conformance suites | `bun test tests/structure/event-taxonomy-declaration.test.ts tests/checks/event-taxonomy-conformance.test.ts` | v2 declaration fixture (transcribed from M2 contracts); drift mutants for new kinds | Existing – Update |
| TC-PAUSE-061 | delivered drift/contract/golden machinery | `bun test tests/structure/event-taxonomy-drift.test.ts tests/golden/` | Per-kind comparators under v2; deliberate golden regeneration | Existing – Update |
| TC-PAUSE-062 | `tests/structure/event-taxonomy-single-source.test.ts` (delivered, extended) | `bun test tests/structure/event-taxonomy-single-source.test.ts` | Version-constant mutant entry point; source scan; single-version assertion | Existing – Update |
| TC-PAUSE-063 | `tests/behaviour/event-taxonomy-v2-compat.test.ts` | `bun test tests/behaviour/event-taxonomy-v2-compat.test.ts` | v1-pinned consumer (delivered codec/session); transport pair; one bounded socket variant | To Implement |
| TC-PAUSE-064 | `tests/behaviour/pause-episode-events.test.ts` | `bun test tests/behaviour/pause-episode-events.test.ts` | Full-episode emitters (both variants); subscription probes; tick-dedupe driver | To Implement |
| TC-PAUSE-070 | `tests/behaviour/status-brief-park-fields.test.ts` | `bun test … --filter status` | Open + closed episode store; text/`--json` reads; isolation witness store | To Implement |
| TC-PAUSE-071 | `tests/behaviour/status-brief-park-fields.test.ts` | `bun test … --filter brief` | Read-counting store wrapper; record-field mutant control | To Implement |
| TC-PAUSE-072 | `tests/behaviour/queue-park-causes-s17.test.ts` + `tests/golden/lanes-list.test.ts` | `bun test tests/behaviour/queue-park-causes-s17.test.ts tests/golden/lanes-list.test.ts` | Park fixtures per cause; `--until` refusal fixture; deliberate golden extension | To Implement + Existing – Update (golden) |
| TC-PAUSE-080 | `tests/behaviour/daemon-absent-degradation.test.ts` | `bun test … --filter mode-declared` | Daemon-absent composition; machine read probe (AMB-P4 seam) | To Implement |
| TC-PAUSE-081 | `tests/behaviour/daemon-absent-degradation.test.ts` | `bun test … --filter no-false-claims` | Daemon-absent store with window open; full surface scan; ledger count | To Implement |
| TC-PAUSE-090 | `tests/behaviour/peak-window-utc-clock.test.ts` | `bun test tests/behaviour/peak-window-utc-clock.test.ts` | Boundary matrix; TZ-variation harness; injected clock only | To Implement |
| TC-PAUSE-091 | `tests/behaviour/peak-pause-determinism.test.ts` | `bun test tests/behaviour/peak-pause-determinism.test.ts` | Paired identical runs; decision-record comparison | To Implement |
| TC-PAUSE-092 | `tests/checks/peak-pause-hermetic.test.ts` | `bun test tests/checks/peak-pause-hermetic.test.ts` | Network/credential/sleep counters + canary; temp-dir assertion | To Implement |
| TC-PAUSE-093 | `tests/behaviour/pause-episode-events.test.ts` | `bun test … --filter bounds` | Worst-case identifier fixture; measurement printing | To Implement |
| TC-PAUSE-094 | delivered state-contract suites + `tests/behaviour/queue-park-causes-s17.test.ts` | `bun test tests/structure/state-contract.test.ts tests/behaviour/queue-park-causes-s17.test.ts --filter additivity` | Pre/post-change store; byte-compare of untouched records; error-table control | Existing – Update + To Implement |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation in this plan |
|---|---|
| **R-TP-1 — Production composition cannot exercise the path (supervise-only residual, RSK-8).** Peak pausing is daemon-supervision behavior; the delivered production composition mounts the daemon family without a lane composition. | The behaviour suites compose the daemon **with** the lane composition through the delivered seam (the same composition the daemon family proves at the seam), which is exactly the composition requirement the spec states (§16, §12). `TC-PAUSE-003` proves the claim-path parity that the supervise-only composition still shares (admission). The residual is a delivery/documentation obligation, not a test-suite gap; it is flagged for `@reviewer` at phase 8. |
| **R-TP-2 — Timing claims degrade into wall-clock flakiness.** NFR-2 and the grace bound could tempt real-time measurement. | All timing is wake-cycle and injected-clock based (AMB-P1); `TC-PAUSE-092` asserts the sleep counter stays zero; measurements print counts, never wall-clock durations. |
| **R-TP-3 — The v2 version bump regresses v1 consumers or goldens silently.** | `TC-PAUSE-061` pins byte-identity bidirectionally; golden regeneration is deliberate with a diff review of version-bearing deltas only (BYTE-P1); `TC-PAUSE-063` proves the consumer contract end to end. |
| **R-TP-4 — The zero-spend assertion passes vacuously** (no telemetry read, or a constant zero). | `TC-PAUSE-050` requires the reading to name its attribution read; `TC-PAUSE-052` proves falsifiability with a seeded breach; `TC-PAUSE-051` proves absence never renders as zero. |
| **R-TP-5 — Pre-change records and empty defaults create false failures.** | `TC-PAUSE-005` and `TC-PAUSE-094` pin classified absence and additivity; `TC-PAUSE-004`/`TC-PAUSE-012` pin the delivered defaults as controls. |
| **R-TP-6 — Unresolved delivery-pinned shapes (classification placement, machine-read surface, payload field lists) are implemented but unasserted.** | Each is registered as a substitute assertion (AMB-P3, AMB-P4, OQ-TP-5) that fails naming the missing seam if delivery exposes none — never passes vacuously. |

### 8.2 Assumptions

- The delivered daemon runtime with the lane composition, the manual-wake seam, the injected clock, and the recording state-store pattern are reusable as-is for the new suites (they are the delivered supervision-suite harness).
- The restart budget, resume economics, typed-question, and interrupted-lane recovery behaviors are delivered and testable through their existing seams; S17 only routes to them (`TC-PAUSE-041`..`TC-PAUSE-042`).
- The taxonomy drift/comparator/golden machinery delivered by GH-290 extends to the v2 declaration without redesign (`TC-PAUSE-060`..`TC-PAUSE-062`).
- Exact suite file names and module seams are delivery-bound (GAP-T5); behaviors, identities, exits, closed vocabularies, and bounds are not.
- Privacy posture (§20/§21: no new credential, identity, or content exposure) carries no NFR row in the spec; it is covered indirectly by NFR-10's zero-credential-reads guard (`TC-PAUSE-092`) and review attestation — no dedicated privacy case is invented beyond the declared requirements.
- Admission-stage ordering (nomination refusal vs credential preflight vs hold/lease/single-flight) is plan-owned (TDR-0028 unresolved question); the refusal fixtures are built so only the nomination gate can fire, making the cases ordering-agnostic.

### 8.3 Open Questions

| ID | Question | Status / Owner | Blocking |
|---|---|---|---|
| OQ-TP-1 | Does a non-UTC time-zone literal in a declared window validate (fail-closed refuse) or is it accepted with evaluation pinned to the UTC basis? DEC-1 pins evaluation, not validation. | Open — `@coder` pins via validation tests at delivery; `TC-PAUSE-090` asserts evaluation either way; `TC-PAUSE-011` excludes a fixture for it. | No |
| OQ-TP-2 | What validation applies to overlapping windows on one profile (§7.3 defers arbitration "beyond declared validation" without enumerating the declared set)? | Open — `@coder` declares and tests the validation set it ships; `TC-PAUSE-011`'s fixtures stick to the spec-pinned classes. | No |
| OQ-TP-3 | Does a `session-state-not-preserved` lane's window-end recovery emit a `resumed` event, and with what reference semantics (EVT-3's payload names a *preserved* session-state reference that does not exist on this path)? | Open — `@coder` with `@doc-syncer` reconciliation; `TC-PAUSE-064` asserts the pinned halves (exactly one stop/parked; no false session reference) and treats the resumed-frame question as delivery-pinned. | No |
| OQ-TP-4 | Admission-stage ordering of the nomination refusal relative to the credential preflight, owner-hold gate, and lease/single-flight predicates (TDR-0028's unresolved question, plan-owned). | Open — `@plan-writer` decides in phase 4; the refusal cases are ordering-agnostic by fixture construction (§8.2). | No |
| OQ-TP-5 | Exact payload field lists for the four new kinds (TDR-0029's unresolved question). | Open — `@coder` declares them in the v2 declaration from the M2 contracts content; `TC-PAUSE-060` pins the declared lists and the drift suite guards them. | No |
| OQ-TP-6 | The exact surface carrying the daemon-absent machine read (`mode`, `parkClaimed`) — spec §5.1 F-8 says "the machine view of the relevant read". | Open — `@coder` selects and documents the surface; `TC-PAUSE-080` asserts on it and fails naming the missing surface if none is exposed (AMB-P4). | No |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-13 | @test-plan-writer | Initial test plan against spec v1.1: 7 ACs bound to 41 cases in ten blocks (nomination 001–006, peak rules 010–012, window watch/parking 020–026, isolation 030–031, window-end resume 040–044, zero-spend 050–052, taxonomy v2 060–064, surfaces/vocabulary 070–072, daemon-absent 080–081, cross-cutting invariants 090–094); all F-1..F-8, NFR-1..NFR-10, EVT-1..EVT-4, DM-1..DM-6, and DEC-1..DEC-11 mapped; six substitute assertions registered (§3.5); six open questions logged from the spec/decision gaps (§8.3); no TODO rows, no orphans. |

## 10. Test Execution Log

No case has been executed against an implementation at authoring time; this plan is a verification map. Results are recorded here as delivery proceeds.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | No executions yet. |
