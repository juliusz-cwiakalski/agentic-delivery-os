# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-241
Date: 2026-11-07
Pause Required: no

Gate: local Definition of Ready. Artifacts reviewed: `chg-GH-241-spec.md` v1.1 (43 ACs, 13 DECs, F-1..F-10, NFR-1..NFR-15, EVT-1..EVT-7, DM-1..DM-11), `chg-GH-241-test-plan.md` v1.1 (66 TCs), `chg-GH-241-plan.yaml` (delivery.plan.v1, 10 phases) + `chg-GH-241-plan.md`, `chg-GH-241-pm-notes.yaml`, TDR-0013/TDR-0014, SC-M1-25, the M1 design baseline, and the delivered source surfaces the change consumes.

## Facet Summary

- spec_completeness: FAIL — the instance identity required by AC-F1-1/AC-F9-1 has no record kind or payload field (RF-01), the detached-start contract is undefined in behavior terms (AF-01), and the fingerprint's `ready-to-merge` input has no declared source (RF-09).
- ac_quality: FAIL — AC-F1-3's fence release and AC-F8-3's process-gone takeover have no implementable mechanism (RF-05, RF-07); AC-F6-3 uses an undeclared `escalated` state (RF-10); the stuck-record kill outcome is self-contradictory (RF-04); "digest consumed" is only half-observable (RF-08).
- plan_coverage: FAIL — 66/66 TCs and 10 phases are mapped, but several phase boundaries cannot be green as declared and some required test/code files are in no phase scope (RF-11, RF-06, RF-07).
- test_traceability: PASS — 43/43 spec ACs appear in the §3.1 matrix; 66/66 TCs appear in §5.1, §5.2, and §7; no orphan TC (every TC names an AC/NFR/DEC/SC); no duplicate TC id; the SC-M1-25 clause map covers all 13 clauses; every ticket AC maps to ≥1 spec AC and ≥1 TC (AC–F2-4/024, F3-*+F4-1+F5-2/030–040/051, F5-3+F6-*/052+060–065, F7-*/070–075, F10-5/090+020/030/040/051/070).
- cross_artifact_consistency: FAIL — TDR-0013 contradicts the pinned capability ownership it is said to capture (RF-02); the wake dedupe key is not durable (RF-03); the stuck kill outcome cannot land on an append-only record (RF-04); the escalation state vocabulary is violated (RF-10); the reserved-slot render position is deferred to the implementer (RF-12).
- decision_capture: FAIL — the precedent-setting process-port decision is captured twice with different content (spec DEC-3/DEC-11 vs TDR-0013 DC-3, RF-02), and TDR-0014's acceptance checklist still carries two items the spec has already resolved as open follow-ups (A7).
- system_spec_consistency: FAIL — the delivered fence semantics (transient exclusive file; `recoverFence` only when age-stale; `releaseFence` only with an in-process handle) do not support AC-F1-3, AC-F8-1/AC-F8-3 as written, and the delivered blocker append acquires its own fence, which collides with a fence-holding `tick` (RF-05, RF-06, RF-07).
- plan_doc_update_coverage: PASS — the spec's documentation-impact list (§16) is fully mapped: `feature-result-contract.md` (P1), `feature-status-digest.md`/`feature-brief.md`/`feature-blockers.md` (P7), `cli-command-registry.md`/`m1/contracts.md`/`m1/man-page.md` (P9), new `feature-coordinator-supervision.md`/`feature-session-lifecycle-economics.md`/`feature-harness-adapters.md`/`doc/00-index.md` (P10). (The TC-092 phase mismatch is RF-11.)
- plan_code_area_coverage: FAIL — `packages/core/src/state/blockers.ts` (escalation write path), `packages/core/src/contracts/state.ts` (fence staleness/release contract), and `tests/structure/coordinator-regime.test.ts` (TC-014) appear in no phase scope (RF-06, RF-07, RF-11).
- dod_defined: PASS — the spec defines measurable ACs, KPIs, NFR thresholds and an exit matrix; the plan defines per-phase exit criteria, a full gate battery, exact `43/43`+`66/66` trace obligation, and typed done-artifacts (`doneArtifacts` in Phase 10).

### Verified as correct (no finding)

- **Error-table allowlist claim is correct.** Exactly two coordinator identities are two-segment: `coordinator.already-running`, `coordinator.restart-budget-exhausted`; the other four are three-segment. `RESERVED_TWO_SEGMENT_CODES` is 22 entries today in both `scripts/checks/error-table-sync.ts` (line 114) and `tests/structure/error-table.test.ts` (line 57); +2 → 24. `ERROR_TABLE` is asserted at `toHaveLength(99)` and documented as "99 identities"; +6 → 105. AC-F10-2, DEC-11, TP TC-081/082, and the plan's pinned block agree.
- **Reserved escalation slot is payload-feasible.** The delivered `BlockerQuestionRecord`/`BlockerQuestionView` already carry `lane: string` and `ref: string | null` (`packages/core/src/contracts/blockers.ts`), so the payload-only predicate needs no blocker contract change or extra read. The rendered cap is `STATUS_MAX_ITEMS_PER_SECTION = 8`, so "seven others + reserved" keeps the bound.
- **Dependencies are delivered.** `c4f6cd63` (GH-235, M1-S15) and `03edcdd7` (GH-230, M1-S16) are on `main-tools` and are ancestors of the delivery branch.
- **No M1-S18/M1-S9/M1-S20 preemption.** No phase adds a `daemon`/`dispatch`/`supervise` command, socket, lane supervisor, installer, or prompt change; `ceo-loop.sh` is asserted byte-unchanged.
- **SC-M1-25 is inherited clause-for-clause** (Appendix C and test-plan §3.4 agree; no clause dropped or re-scoped).
- **TC/AC arithmetic is consistent**: 43 spec ACs, 66 TCs, 10 phases, no orphan and no duplicate.

## Findings

### Blocking

1. [critical] spec_completeness/cross_artifact_consistency — spec §5.1 F-1, §17.1 AC-F1-1, §17.9 AC-F9-1, §8.2 EVT-1..EVT-7, §8.3 DM-1..DM-11, Appendix B/E/G; test plan TC-010, TC-013, TC-015, TC-016
   Gap: a durable **instance record** is required ("records the instance", "durable instance record", "no second instance record") but no instance record kind, identity, or payload schema exists; the record-kind set is closed at six (EVT-1..EVT-5, EVT-7) and `delivery.coordinator.v1` (Appendix G) has no `instance` field, although TC-010/013 assert it. The plan's Phase 3 implements "six record kinds" only.
   Suggested remediation target phase: specification
   Suggested fix: declare `coordinator.instance` (EVT-8/DM-12, payload schema, identity, fields: instanceId, coordinatorId, pid, processKind, supervisorMode, startedAt) and add `instance` to the `delivery.coordinator.v1` payload, Appendix B/E, and the closed-vocabulary table; or state that the fence holder *is* the instance identity and delete every "instance record" assertion.

2. [critical] cross_artifact_consistency/decision_capture — TDR-0013 DC-3 and its summary vs spec DEC-3, DEC-11, §8.4, AC-F2-3, AC-F10-4, TC-044
   Gap: TDR-0013 DC-3 says the process-lifecycle port "declares spawn, **resume**, alive, kill-with-grace, and sourced progress as capabilities" and "a needed capability that is absent is `coordinator.process.capability-gap` at exit 2". The spec pins the opposite: resume is a harness-session capability; its absence is a decision input selecting `spawn-fresh` reason `session-interrupted` with one ordinal and **no error identity**. The spec claims TDR-0013 captures DEC-3, so an implementer reading the governing TDR would build the forbidden behavior, and TC-044 step 1/6 would fail.
   Suggested remediation target phase: specification
   Suggested fix: amend TDR-0013 DC-3/summary to the four-way split exactly as DEC-11 (resume = decision input; spawn = delivered harness identity; alive/kill = `coordinator.process.capability-gap`; progress = `unknown` class), via `@decision-advisor`, and keep the spec reference accurate.

3. [critical] cross_artifact_consistency — spec §5.1 F-7, §8.2 EVT-5, §8.3 DM-5, Appendix B/E; test plan TC-071 step 3, TC-075 step 4
   Gap: wake dedupe is pinned to `(coordinatorId, questionId, askedAt)` and TC-071/TC-075 assert the `askedAt` identity on the persisted wake record, but `coordinator.wake` declares only `wakeId, coordinatorId, questionId, questionRank, outcome, iterationId, recordedAt`. The third dedupe component is not durable, so a reopened store cannot apply the declared dedupe key, and the asserted record field does not exist in the schema.
   Suggested remediation target phase: specification
   Suggested fix: add `askedAt` (question lifetime identity) to EVT-5, DM-5, Appendix E and the `wake` payload, or drop `askedAt` from the dedupe key and from TC-071/TC-075 (keeping `questionId` as the lifetime identity).

4. [major] cross_artifact_consistency — spec §5.1 F-3/F-4, §8.2 EVT-3, Appendix E; test plan TC-030 steps 2 and 5
   Gap: EVT-3 declares **one durable record per stuck/unevaluable verdict** carrying `killOutcome`; F-3 records the verdict before F-4 kills; TC-030 asserts "the stuck record precedes the kill" and that the kill outcome is then "carried as declared ... per the delivery's declared append/update discipline". The delivered ledger is append-only (`StateStorePort.append`; no record update), so the outcome cannot be written onto the existing record, and a second append would contradict "one durable record per verdict". The test plan explicitly defers the discipline to delivery.
   Suggested remediation target phase: specification
   Suggested fix: pin one of (a) a second append `coordinator.stuck` with the same `stuckId` and a declared latest-wins fold rule (EVT-3/E/reads), or (b) move `killOutcome` to the restart/iteration record, or (c) append the stuck record after the kill and restate the pre-kill evidence as the iteration record. Remove the "append/update discipline" deferral from TC-030.

5. [critical] system_spec_consistency/ac_quality — spec §5.1 F-1, §17.1 AC-F1-3; test plan TC-011 steps 1 and 6
   Gap: AC-F1-3 requires `coordinator stop` to "release the fence and report `released=true`" for a supervisor in another process. The delivered state port releases a fence only via `releaseFence(handle)` with an **in-process** unforgeable handle (`activeHandles.has(handle)`), and `recoverFence` requires an age-stale fence. No stop-request channel (record kind, control file, signal) is declared, and the record vocabulary is closed at six. A separate `stop` process therefore cannot satisfy the AC as written without inventing an undeclared mechanism.
   Suggested remediation target phase: specification
   Suggested fix: pin the stop-request mechanism (e.g., a declared `coordinator.stop-request` durable marker or a declared control-file artifact) plus who releases the fence and what `stop` reports when the request is merely accepted; add the corresponding record/artifact to the closed vocabulary and a TC.

6. [critical] system_spec_consistency/plan_executability — spec §5.1 F-1/F-6, §17.1 AC-F1-2, §17.6 AC-F6-1/AC-F6-2; delivered `packages/core/src/state/blockers.ts` (`appendBlockerQuestion` acquires its own fence); plan Phase 6
   Gap: `tick` is pinned to "acquire the state-dir fence for the duration of the cycle", but the delivered escalation path `appendBlockerQuestion` calls `store.acquireFence(...)` itself, which returns `state.lock.busy` while the tick holds the fence. Publishing the exhaustion question under the cycle fence is therefore impossible with the delivered helper, and `packages/core/src/state/blockers.ts` is in no phase scope, so the required refactor (handle-reusing append) is undeclared and unscoped.
   Suggested remediation target phase: delivery_planning (with a specification clarification)
   Suggested fix: pin the composition — either the tick composes appends under one acquired handle end-to-end (and add `packages/core/src/state/blockers.ts` + its tests to the Phase 6 scope with a handle-accepting append), or the spec defines an explicit, ordered release/republish sequence that preserves the single-instance guarantee; add an AC/TC for the escalation-under-fence ordering.

7. [major] system_spec_consistency/plan_code_area_coverage — spec §17.8 AC-F8-3; test plan TC-015 step 1; delivered `packages/core/src/state/index.ts` (`recoverFence`), `packages/core/src/contracts/state.ts`
   Gap: AC-F8-3 requires takeover when "the recorded process is gone" *or* the fence is older than two intervals. The delivered `recoverFence` refuses unless `lock.stale` is true, and `stale` is computed only from `acquiredAtMs` + `staleFenceMs`; there is no process-liveness input in the port signature. The "process gone with a young fence" case (TC-015 step 1) is unimplementable, and the port contract file that would have to change (`packages/core/src/contracts/state.ts`) is in no phase scope.
   Suggested remediation target phase: specification (mechanism) + delivery_planning (scope)
   Suggested fix: pin how process-gone staleness is supplied to the fence (e.g., `recoverFence` gains an injected stale-reason/liveness input, or the supervisor fence is declared as a separate declared artifact with its own takeover rule), and add the owning contract/state files to the plan scope.

8. [critical] ac_quality/testability — spec §5.1 F-3, §23 glossary ("new turn"), §9 NFR-9, Appendix D; test plan TC-032, TC-033, TC-034
   Gap: `digest-consumed` requires "the coordinator session produced a new turn (sourced session progress)", and the corroborator requires "positive sourced session progress **within the liveness bound**", but neither the "new turn" observable nor the liveness bound is declared. The five coordinator config keys include no liveness bound, and the tests inject "new turn"/"positive progress" as fixture facts (TC-032/033/034), so no test proves the real adapter derives either from a delivered signal (`session-traffic`, `heartbeat-age`, `token-delta`). This is the one declared SC-M1-25 clarification, and it is only half-testable.
   Suggested remediation target phase: specification
   Suggested fix: pin the observable source of a "new turn" (name the delivered signal and the comparison) and declare the corroborator's liveness bound as data (a sixth key or an explicit derivation from `collection-interval`), then add one adapter-level assertion that the mapping holds.

9. [major] spec_completeness/system_spec_consistency — spec §5.1 F-3 (fingerprint inputs), §13 Dependencies; plan Phase 6 task 6.2
   Gap: the digest-input fingerprint includes "the count of ready-to-merge candidates", but no delivered state-sourced count exists (the `ready-to-merge` section is computed from an open-PR read + review/CI signals), the plan composes no tracker/CI/status collector into the coordinator edge, and a live PR/CI read inside `tick` would contradict NFR-4 ("at most one verified read per store per tick") and NFR-5 (2 s p95) and add an undeclared network/credential dependency.
   Suggested remediation target phase: specification (source) + delivery_planning (composition)
   Suggested fix: pin the source as an injected fact or a state-sourced count (and declare who supplies it), add the dependency to §13 and the plan's composition scope, or drop the ready-to-merge component from the fingerprint.

10. [major] cross_artifact_consistency/ac_quality — spec §17.6 AC-F6-3, Appendix B escalation states, Appendix F row 2, Appendix G payload; test plan TC-061 step 3
    Gap: AC-F6-3/TC-061 return "the idempotent `escalated` state", and Appendix F says `escalation=escalated`, but the closed escalation-state vocabulary is exactly `not-exhausted | exhausted-escalated | exhausted-escalation-failed` and the `data.escalation.state` type declares only those three. `escalated` is an undeclared value in an explicitly closed vocabulary.
    Suggested remediation target phase: specification
    Suggested fix: use `exhausted-escalated` in AC-F6-3/TC-061/Appendix F, or declare a distinct tick-result field with its own closed values and keep `escalation.state` three-valued.

11. [major] plan_coverage/plan_executability — `chg-GH-241-plan.yaml` header "each phase's mapped TCs are fully provable at that phase's declared gate"; phases 5–10 `scope`; `chg-GH-241-plan.md` TC→phase index; test plan §7 target files
    Gap: the per-phase provability claim is false for at least five TCs. TC-092 (Phase 9) requires `doc/spec/features/feature-coordinator-supervision.md`, created in Phase 10. TC-014 (Phase 6) requires `tests/structure/coordinator-regime.test.ts`, which is in no phase scope at all. TC-012 and TC-013 (Phase 6) and TC-063 (Phase 7) require `tests/golden/coordinator.test.ts`, created in Phase 8. TC-043 and TC-044 (Phase 5, adapter layer) assert `tick`, `status`, and command exit behaviour that only exists after Phase 6.
    Suggested remediation target phase: delivery_planning
    Suggested fix: re-map or re-scope so every TC's declared files are in its phase (or move the TC to the later phase and remove it from the earlier header map), and add `tests/structure/coordinator-regime.test.ts` plus the golden file's owning phase explicitly.

12. [major] cross_artifact_consistency — spec §5.1 F-6 ("ordering rules and the omission count are otherwise unchanged"), §17.6 AC-F6-1; test plan TC-063 step 4; TDR-0014 acceptance checklist item 16
    Gap: the reserved escalation question's position in the rendered list is not pinned. F-6 says only that ordering is "otherwise unchanged"; TC-063 asserts presence, count, and the relative order of the other seven, but not the escalation's index. TDR-0014 explicitly leaves it to delivery: "whether it sorts first or occupies its ranking position is a render detail the implementation must pin deterministically". That is implementation-time invention on an owner-facing rendered contract, and the golden would silently freeze the choice.
    Suggested remediation target phase: specification
    Suggested fix: pin one rule (e.g., the reserved question renders last in its section, or first, or in rank position replacing the lowest-ranked rendered question) and assert it by index in TC-063/TC-064.

### Advisory (non-blocking, fix before or during delivery)

- A1. [minor] spec_completeness — Appendix G declares `supervisor=<foreground|detached|external-unit-absent>`, but F-8 says a detached start records `external-unit-absent`; `detached` has no producer and the detached supervision loop / durable instance behaviour has no AC or TC beyond the descriptor (TC-014). Pin the two-value set or the detached-mode behavior. Target: specification.
- A2. [minor] risk/security — the risk register and security review do not cover a stale recorded process handle after PID reuse (kill of an unrelated process between expectation and TERM). Add an explicit mitigation (verify process identity/start time before TERM) or an accepted-risk statement. Target: specification.
- A3. [minor] ac_quality — NFR-8/NFR-9 are asserted as "the next `tick`" (§9 collection-cycle semantics). That is honest for v1 but converts the latency promise into a caller-cadence assumption; state that a caller ticking slower than `coordinator.collection-interval` does not violate the policy only because the assertion is next-tick, or add a loop-cadence assertion. Target: test_planning.
- A4. [minor] decision_capture — `chg-GH-241-pm-notes.yaml` retains a false intermediate claim ("all six coordinator identities are two-segment") and a stale "5 event/record kinds"; the spec/plan/test-plan are correct (two two-segment codes, seven EVTs). Add correction notes for traceability. Target: delivery_planning (PM notes are PM-owned).
- A5. [minor] documentation consistency — the test plan still declares `GAP-T1` ("implementation plan absent") in §1.2 and `links.implementation_plan: null`, although the YAML plan exists and maps 66/66 TCs. Update the gap disposition and link. Target: test_planning.
- A6. [nit] ac_quality — the delivered `isCoordinatorPickup` treats `status === undefined` as open; AC-F7-3/TC-070 require a non-open head to yield `no-pickup`. Pin whether an absent status counts as open so the strict predicate and the delivered predicate cannot diverge. Target: specification.
- A7. [minor] decision_capture — TDR-0014's acceptance checklist still carries resolved items as open follow-ups (the audit-ledger premise and the "inside the eight-question bound" wording, both resolved in spec v1.1). Close them so the record and the spec agree. Target: specification (decision-advisor).

## Routing

- Blocking findings route to `specification` (RF-01, RF-02, RF-04, RF-05, RF-06 clarification, RF-08, RF-09 source, RF-10, RF-12, plus the mechanism halves of RF-05/RF-07) and to `delivery_planning` (RF-06 scope, RF-07 scope, RF-09 composition, RF-11).
- No finding routes to `delivery`; no finding requires a human product-scope decision, so this iteration does not pause.
- After revision, re-run the gate. If the same blocking set survives a third iteration, escalate to the human owner rather than looping.
