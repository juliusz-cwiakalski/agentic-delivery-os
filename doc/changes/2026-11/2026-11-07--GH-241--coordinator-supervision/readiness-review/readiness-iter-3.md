# Readiness Review Iteration 3

Verdict: **NOT_READY**
Work Item: GH-241
Date: 2026-11-07
Pause Required: no
Iteration: 3 of 3 (final permitted iteration — escalation required after this pass)

Gate: local Definition of Ready, adversarial re-application. Artifacts reviewed: `chg-GH-241-spec.md` v1.3 (48 ACs, 13 DECs, 6 config keys, 15 NFRs, 14 risks, EVT-1..EVT-7, DM-1..DM-11), `chg-GH-241-test-plan.md` v1.3 (72 TCs), `chg-GH-241-plan.yaml` (delivery.plan.v1, 10 phases; re-validated in this pass: `verdict=valid`, `readyForDevelopment=true`, 0 errors) + `chg-GH-241-plan.md`, `chg-GH-241-pm-notes.yaml`, TDR-0013/TDR-0014 (both amended to v1.3, both `Proposed`), SC-M1-25, GH-241 (read live), and the delivered source surfaces the change consumes (`packages/core/src/{contracts/state,state/index,state/blockers,domain/blockers}.ts`, `scripts/checks/error-table-sync.ts`, `tests/structure/error-table.test.ts`).

Blocking count: **5** (1 critical, 4 major). Advisory: 8.

## Facet Summary

- spec_completeness: **FAIL** — the claim-time behaviour of the delivered state write fence is doubly specified (per-append helper recovery vs `state.lock.busy` → `coordinator.already-running`), with a permanent-wedge outcome under one reading (RF3-01); the foreground supervision loop that `start` runs has no declared cycle driver, cycle body, or exit path (RF3-05); claim-time "alive unavailable" is simultaneously the age-fallback takeover input and a `coordinator.process.capability-gap` (RF3-03).
- ac_quality: **FAIL** — AC-F9-1 requires `coordinator status` to report `tickVerdict`, a value that by the same spec exists only for a `tick` invocation and is never persisted (RF3-02); AC-F8-5's claim-busy → `already-running` identity is asserted for a condition that also arises from a non-coordinator state writer (advisory AF3-06).
- plan_coverage: **FAIL** — 72/72 TCs are mapped exactly once and the YAML/MD phase maps agree exactly, but the header's "each phase's mapped TCs are fully provable at that phase's declared gate" is false for TC-013 (unproducible field), TC-094 (self-contradictory step), and TC-010/011/017/093 (no declared way to drive a live supervisor's cycle), and the Phase-6 verification block omits two mapped TC files (AF3-07).
- test_traceability: **PASS** — 48 AC rows in spec §17 == 48 rows in test plan §3.1; 72 TCs in §5.1 == §5.2 == §7 with no duplicate and no orphan; the plan's TC→phase map holds 72 unique ids matching the test plan exactly and matching `plan.md`'s 72-row table phase-for-phase; SC-M1-25 clause map complete (13 rows).
- cross_artifact_consistency: **FAIL** — TC-094 step 3 contradicts its own barrier precondition and the delivered non-blocking `acquireFence` (RF3-04); TC-010 step 9 and TC-017 step 8 assert opposite outcomes for the same claim-time acquire (RF3-01); `status` must report a per-tick value (RF3-02); "alive unavailable" carries two opposite outcomes across spec, TDR-0013, and the plan's own pinned block (RF3-03).
- decision_capture: **PASS** — DEC-1..DEC-13 captured; TDR-0013 carries the liveness-first atomic lease, single-record takeover, foreground-only v1, per-append helper and the four-way capability split; TDR-0014 carries DC-6 (persisted verdict vs tick verdict) and the render-first slot; both remain `Proposed`, correct pending owner acceptance at PR review; DEC-2 stays registry-only under ODR-0003 DC-4.
- system_spec_consistency: **FAIL** — after a writer dies holding the state write fence, `start`/`tick` are refused `coordinator.already-running` (claim-time busy) and the only declared recovery (the per-append helper) is unreachable, while `status` reports no instance and `stop` appends nothing: the surface is wedged until an undeclared manual lock removal (RF3-01). The delivered blocker append has no stale-lock recovery, so §12/RSK-14's "per-append helper" mitigation does not cover the escalation path (AF3-02).
- plan_doc_update_coverage: **PASS** — every spec §16 target has an owning phase (P1 result contract; P7 status/brief/blockers; P9 registry/contracts/man-page/changeset; P10 new feature spec, economics, harness adapters, result-contract re-check, `doc/00-index.md`).
- plan_code_area_coverage: **PASS** — each phase lists files/packages/folders; `packages/core/src/contracts/state.ts` and `packages/core/src/state/blockers.ts` are correctly in no phase; the process port lands in `packages/adapters/src/harness/process-lifecycle.ts` with no new subpath. The missing code area is the foreground loop (RF3-05).
- dod_defined: **PASS** — measurable ACs, KPIs, NFR thresholds, an exit matrix, per-phase exit criteria, the exact `48/48` + `72/72` trace obligation, and typed `doneArtifacts`.

## Prior Finding Disposition (RF2-01..RF2-12)

| Prior | Disposition | Evidence |
|---|---|---|
| RF2-01 (age-OR lease takeover steals a live holder) | **RESOLVED** | Liveness-first is now the rule everywhere: spec F-1:148, F-8:183, AC-F8-1:593, AC-F8-3:595, AC-F8-4:596, Appendix B lease-liveness states:733, DEC-6:477, TDR-0013 C-9:170 and 307-316, plan header:45-54, plan task 6.3:574-597. `alive=true` is held/refused regardless of age; `alive=false` is takeover-eligible; age (2×`collection-interval`) applies only when liveness is unknown; no heartbeat/refresh record exists (§7.3:324, Appendix E:783, TC-017 step 9). A live old holder is refused by `start`/`tick` and remains stoppable: AC-F8-4:596, TC-011 step 3:523, TC-093 steps 1-3:2370-2372. |
| RF2-02 (lease claim is not atomic) | **PARTIALLY RESOLVED** | The critical section is pinned (F-8:183, AC-F8-5:597, Flow 1:196-201, Flow 8:278-283, task 6.3:574-583, TC-010 step 2:486, TC-094:2382-2409) and is implementable over the delivered `acquireFence` (:604-627). Not resolved: the claim's own acquire is governed by two mutually exclusive rules (RF3-01), and TC-094 step 3 is impossible as written (RF3-04). |
| RF2-03 (tick cannot recover a crashed holder) | **RESOLVED** | AC-F8-6:598, F-1:148 ("`tick` uses the same atomic claim/takeover decision as `start`"), Flow 8:276-287, AC-F1-2:526, TC-095:2411-2438, TC-043 step 2:1366, plan task 6.3:590-593. `stop-requested` with a dead holder is also recoverable (TC-095 step 2). |
| RF2-04 (TC-040 mapped to a phase that cannot prove it) | **RESOLVED** | TC-040 now maps once to Phase 6 (plan header:132; plan.md:575); ownership is pinned in three places consistently: Phase 3 proves the record pair through the state API and explicitly does not compose the kill/budget (task 3.8:366-375), Phase 5 returns the adapter outcome only (task 5.1:488-520), Phase 6 composes the `phase=outcome` append and the budget check (task 6.4:598-611). Verified programmatically that YAML and MD phase maps agree for all 72 TCs and no TC is mapped twice. |
| RF2-05 (quiet-tick volume vs the log-growth claim) | **RESOLVED** | §8.2:349, §22:658, §10:405, NFR-6:390, AC-F1-2:526, Flow 8:286 all now declare exactly one lease pair per claiming tick as expected volume and scope the idempotency claim to action records; TC-012 step 7:556, TC-017 step 9:705, TC-087. Residual: the non-zero-exit path does not declare the `released` half (AF3-01). |
| RF2-06 (crash between `stale-takeover` and `acquired`) | **RESOLVED** | `stale-takeover` is the single acquisition record (F-8:183, EVT-7:347, DM-11:365, Appendix E:783, AC-F8-3:595); "never followed by a second `acquired`" is asserted by TC-015 step 1:639, TC-017 step 4:700, TC-095 step 1:2427; the fold over the four actions is declared total (F-8:183) and TC-015 step 8:646 asserts the post-crash state. |
| RF2-07 (state-fence stale-lock recovery; missing `state.lock.busy` row) | **PARTIALLY RESOLVED** | The helper exists as a contract (F-1:148, §12:433, task 3.10:381-390) and the exit rows were added (Appendix F:806-807, AC-F10-3:606, RSK-14:428), with no `contracts/state.ts` change — verified feasible against `fenceStatus()` (:645-652), `recoverFence()` stale-only (:654-674) and the 30 s default (:187). Not resolved: the claim's acquire is not covered by the helper rule and, read literally, wedges the surface (RF3-01); the delivered blocker append has no recovery (AF3-02). |
| RF2-08 (stale PLAN-MAP bullet) | **RESOLVED with residue** | §1.2:65 is now "[PLAN-MAP — satisfied]", §7 exit criteria no longer lists it, and §8.4:2671 records it closed — but §1.2:25, §1.2:65 and §2 (line 71) still describe the plan as "v1.2" and "the 69 v1.2 TCs" while the only plan file is revision 1.3 (AF3-08). |
| RF2-09 (detached start undefined) | **RESOLVED for the contract** | v1 is foreground-only and closed: AC-F1-1:525, AC-F8-2:594, Appendix B:734-735, Appendix G:817, DEC-6:477, TDR-0013:301-305, plan task 6.1:558-568; a bare `start` is `fallback.invocation` exit 1 naming `--foreground` and the M1-S18 seam (TC-010 step 8:492, TC-014 step 2:611); the supervisor records its own pid/start time; `detached` is reserved and never produced. The remediation created a new surface it did not declare: the foreground loop (RF3-05). |
| RF2-10 (`progressing` not representable) | **PARTIALLY RESOLVED** | The tick split is pinned (F-9:186, Appendix G:833-834 and 842, glossary:680, TC-012 step 6:555) and TDR-0014 DC-6 carries it. Not resolved: AC-F9-1:529, §10:406 and TC-013 step 1:581 still require `coordinator status` to report a `tickVerdict`, which no durable record holds (RF3-02). |
| RF2-11 (fold has no ordering key) | **RESOLVED** | Ledger sequence is the primary key for every coordinator fold (lease, stuck, last decision, last wake) with `recordedAt` descriptive only: F-3:168, F-8:183, EVT-7:347, DM-3:357, DM-11:365, glossary:690, plan header:85-87; asserted by TC-017 step 6:702, TC-018 step 7:740, TC-030 step 4:996, TC-040 step 5:1286. The delivered `StateArtifactRecord.sequence` (`contracts/state.ts:312-317`) makes it sourceable. |
| RF2-12 (`stuckId` derivation undeclared) | **RESOLVED** | `stuckId = iterationId` is pinned in EVT-3:343, DM-3:357, Appendix E:780, glossary:681, plan header:79-84, TDR-0014; asserted by TC-030 step 8:1000, TC-040 step 5:1286, TC-039 step 1-2:1251-1252. A different iteration yields a different `stuckId`, so the replay guard is durable-derivable. |

## New Blocking Findings

### RF3-01 [critical] spec_completeness / cross_artifact_consistency / system_spec_consistency — claim-time state-fence handling

Artifacts: `chg-GH-241-spec.md` F-1:148, F-8:183, AC-F8-5:597, AC-F10-3:606, RSK-14:428, §12:433, Appendix F:801 and 806; `chg-GH-241-test-plan.md` TC-010 step 9:493, TC-017 step 8:704, TC-094 step 5:2402; `doc/decisions/TDR-0013-...md:316`; delivered `packages/core/src/state/index.ts:604-627` (`acquireFence` is non-blocking and returns `state.lock.busy` whenever a lock file exists, stale or not), `:654-674` (`recoverFence` refuses unless held **and** stale).

Gap: the same `acquireFence` call is governed by two incompatible rules.
1. F-1:148 says *every* coordinator append, "including each `coordinator.fence` record", uses the per-append helper: on `state.lock.busy` with `fenceStatus().stale === true`, one `recoverFence` and one retry.
2. F-8:183 / AC-F8-5:597 say that when "`acquireFence` itself returns `state.lock.busy`" during the claim, the claim is refused `coordinator.already-running` at exit 2, with no recovery.

Read literally (rule 2, as AC-F8-5 and TC-010 step 9 assert without a staleness qualifier): after any writer dies holding the state write fence, the lock is stale, `acquireFence` returns busy, `start` and `tick` are refused `coordinator.already-running` **forever**, and the declared recovery (the per-append helper) is unreachable because no claim can ever succeed to reach a coordinator append. `coordinator stop` reports `not-running` and appends nothing (no live lease holder), so it recovers nothing either. `coordinator status` simultaneously reports no instance. The state dir is wedged until an operator deletes `fence.<workspace>.lock`, a remedy no artifact names. This directly contradicts RSK-14:428's mitigation ("the per-append helper ... performs one `recoverFence` and one retry") and §12:433.

The tests assert both readings: TC-010 step 9:493 forces busy during the claim and requires `already-running`; TC-017 step 8:704 forces busy with `fenceStatus().stale === true` and requires exactly one `recoverFence` plus a successful retry, and with a non-stale fence requires the delivered `state.lock.busy`. Applied to the claim, the second half of TC-017 step 8 contradicts AC-F8-5's mapping; applied only to non-claim appends, TC-017 does not say so. No test exercises "stale lock present, no live supervisor, `start`".

Suggested remediation target phase: **specification** (with a test_planning follow-up)
Suggested fix: split the two cases explicitly — (a) *claim acquire*: on `state.lock.busy`, read `fenceStatus()`; if `stale === true`, perform exactly one `recoverFence` + one acquire retry, and map only a still-busy/non-stale result to `coordinator.already-running`; (b) *non-claim appends*: same stale recovery, but map a still-busy result to the delivered `state.lock.busy`. Restate F-1/F-8/AC-F8-5/AC-F10-3/RSK-14/Appendix F and TDR-0013:316; align TC-010 step 9 (name the non-stale fixture) and TC-017 step 8 (state that it covers both branches); add a TC for "stale fence, no live supervisor, `start` succeeds after one recovery".

### RF3-02 [major] ac_quality / cross_artifact_consistency — `status` must report a value only a `tick` can produce

Artifacts: `chg-GH-241-spec.md` F-9:186, §10:406, AC-F9-1:529, Appendix G:833-834 and 842; `chg-GH-241-test-plan.md` TC-013 step 1:581, §8.3 OQ-T21:2646, §8.4 RF2-10 row:2668.

Gap: AC-F9-1 requires `coordinator status [--live]` to report "the tick result's separate `tickVerdict` field (`verdict` `progressing | stuck | unevaluable` ...)" for a "running, exhausted, or stopped supervisor". By the same contract, `tickVerdict` is the result of a `tick` invocation and `progressing` is never persisted (F-9:186, Appendix G:842, glossary:680); nothing durable carries it. `status` reads durable state (and, with `--live`, live process facts) and "never mutates state" (TC-013 step 6:586). Therefore `status` cannot produce a non-null `tickVerdict`, and TC-013 step 1's assertion is unprovable at the Phase-6 gate it is mapped to. The schema allows `tickVerdict: ... | null`, but neither the AC nor the TC admits `null` for `status`; §8.4 nevertheless records RF2-10 as resolved and §1.2:25/§8.4:2681 claim no remaining gaps.

Suggested remediation target phase: **specification** (with a test_planning follow-up)
Suggested fix: state that `tickVerdict` is populated only by `coordinator tick` and is `null` for `start`, `stop`, and `status` (a status invocation that wants an evaluation runs a tick); correct AC-F9-1, §10:406, Appendix G:842 and TC-013 step 1 accordingly (assert `null` for status fixtures, and keep the non-null `tickVerdict` assertion in TC-012).

### RF3-03 [major] ac_quality / system_spec_consistency — "alive unavailable" is both age-fallback takeover and a capability gap

Artifacts: `chg-GH-241-spec.md` F-1:148, F-8:183, AC-F8-1:593, AC-F8-3:595, Appendix B:733, DEC-11:482, AC-F10-4:607, §21:647; `chg-GH-241-plan.yaml` header:45-47 vs 98-103; `doc/decisions/TDR-0013-...md:312` vs `:324`; `chg-GH-241-test-plan.md` TC-015 step 2:640, TC-044 step 3:1396.

Gap: the lease rule says liveness is "unknown **or unavailable**", and in that case a lease older than 2×`collection-interval` is takeover-eligible (destructive: it steals ownership). DEC-11:482/AC-F10-4:607/§21:647 say a *missing process-port alive capability* is `coordinator.process.capability-gap` at exit 2 "with no destructive action", and the plan's own pinned block states both readings in one line (header:45-47 vs 98-103). The same words ("unavailable"/"absent") denote both "the probe returned no answer for this handle" and "the port declares no alive capability".

Consequence: whether a supervisor lacking an alive capability may take over by age, or must fail closed, is decided at implementation time, with a security-relevant fork (steal a possibly-live lease vs refuse). No TC covers claim-time alive absence: TC-015 step 2:640 seeds "alive unknown" (a per-handle unknown), and TC-044 step 3:1396 covers the gap only on the kill path.

Suggested remediation target phase: **specification** (with a test_planning follow-up)
Suggested fix: replace "unknown or unavailable" with "the alive capability is declared and the probe returns no answer for this handle"; state that an undeclared alive capability at claim time is `coordinator.process.capability-gap` exit 2 with no lease record and no takeover. Correct F-1/F-8/AC-F8-1/AC-F8-3/Appendix B/DEC-11/§21, plan header, TDR-0013:312, and add one TC for the claim-time capability gap.

### RF3-04 [major] test_traceability (test provability) / cross_artifact_consistency — TC-094 step 3 contradicts its own precondition

Artifacts: `chg-GH-241-test-plan.md` TC-094 precondition:2395, step 1:2398, step 3:2400, step 4:2401, step 5:2402; AC-F8-5:597; delivered `packages/core/src/state/index.ts:604-627`.

Gap: the precondition and step 1 require "a barrier lets both claims attempt `acquireFence` before either appends". The delivered fence is non-blocking: the loser receives `state.lock.busy` immediately and never reaches the fold re-read. Step 3 nevertheless asserts "the loser's re-read occurred after the winner's append, so it observed the held lease", which is only reachable if the loser's acquire is deferred until after the winner's release — i.e. not the barrier case. Step 5 independently asserts the busy path. The TC therefore demands two mutually exclusive interleavings in one scenario and cannot be green as written; step 7's mutant ("re-reads before `acquireFence` fails") does not help because step 3's sentence already requires the re-read to happen.

Suggested remediation target phase: **test_planning**
Suggested fix: split the assertion into two named interleavings — (i) barrier/lock-contention: loser gets `state.lock.busy` → `coordinator.already-running`, loser performs no re-read and no append (step 5 semantics); (ii) serialized: winner acquires/appends/releases, loser then acquires, re-reads the held lease, and refuses with no append (step 3 semantics). Assert exactly one acquisition in both.

### RF3-05 [major] spec_completeness / plan_coverage — the foreground supervision loop has no declared cycle, driver, or exit path

Artifacts: `chg-GH-241-spec.md` F-1:148, NFR-8:392, NFR-9:393, §9:401, Appendix G:817; `chg-GH-241-plan.yaml` tasks 6.1/6.4:558-611 and verification 634-639; `chg-GH-241-test-plan.md` GAP-T2:60, GAP-T4:62, TC-010 step 3:487, TC-011 step 4:524, TC-017 step 9:705, TC-093 step 4:2373.

Gap: v1.3 replaced the detached start with "`start` then runs the supervision loop in the foreground" (F-1:148, Appendix G:817). That loop is the only actor that can satisfy AC-F3-1/AC-F7-1 in a real deployment, because `tick` is refused while the supervisor holds the lease (F-1:148, AC-F8-1:593). But nothing declares: the loop's cycle body (it cannot be the `tick` handler — a claiming tick would be refused by its own live lease); how it waits between cycles (NFR-1 forbids ambient clocks, §9:401 says "no wall-clock timer is required"); how it observes a `stop-requested` and appends `released`; what it does on SIGINT or on a fatal error; or how a test drives "the live supervisor to its next cycle boundary" (TC-011 step 4:524, TC-093 step 4:2373) with no second process (GAP-T4:62). The plan scopes commands/edge/text but no loop seam and no loop test, and TC-017 step 9:705 pins only the negative ("a quiet live interval writes no record"). TC-010 step 1:485-487 additionally requires `start --foreground` to have returned a receipt while the process loops, which the in-process `runCli` test harness cannot do without a declared driver.

Suggested remediation target phase: **specification** (with a delivery_planning follow-up)
Suggested fix: declare the foreground loop explicitly — one claim-free evaluation cycle reusing the same cycle body as `tick` while the supervisor holds its lifetime lease, no per-cycle lease records, an injected cycle driver/clock seam, stop-request observation and `released` at the cycle boundary, and the exit path (stop request, fatal error, signal) with its exit code. Add the loop seam to the plan's Phase-6 scope/verification and add one TC that a foreground supervisor performs N cycles and appends one `acquired`/one `released` for its lifetime.

## New Advisory Findings

### AF3-01 [minor] spec_completeness — the `released` half of the lease pair is not defined on a non-zero tick exit
Artifacts: spec F-1:148, AC-F1-2:526, §8.2:349, §22:658; test plan TC-035:1126, TC-041:1295, TC-062, TC-074:2350.
Gap: "every `tick` appends exactly one lease pair" is stated unconditionally, but a tick that exits non-zero mid-cycle (`state.lock.busy`, `state.write.failed`, `wake.delivery-failed`, `kill-failed`, `unevaluable`, `escalation.publish-failed`) has no declared `released`. A literal early return leaves an `acquired` lease naming a dead pid; liveness-first makes that self-healing on the next claim, but the "exactly one pair" pin is then false and no TC covers it.
Remediation target: specification. Fix: state that `released` is attempted in a `finally` for every claimed tick and name the append-failure path when even `released` cannot land; add one negative-path assertion.

### AF3-02 [minor] system_spec_consistency — the escalation publish path has no stale-lock recovery
Artifacts: spec F-6:177, §12:433, RSK-14:428; delivered `packages/core/src/state/blockers.ts:342-375` (`appendRecord` calls `store.acquireFence` and fails busy, no `fenceStatus`/`recoverFence`), `packages/core/src/state/index.ts:654-674`.
Gap: F-6 claims the escalation "composes without a lock collision" because the blocker append takes its own fence, but that path has no stale recovery, so a dead writer's age-stale fence turns escalation into a terminal `coordinator.escalation.publish-failed` exit 2 with consequence `unknown`. `packages/core/src/state/blockers.ts` is correctly out of scope, so the spec must decide whether the supervisor recovers the stale fence before publishing.
Remediation target: specification. Fix: declare that the supervisor performs the same one-shot stale-fence recovery before calling the blocker append (and that a still-busy fence is `escalation.publish-failed`), or declare the publish-failed-on-stale-fence behaviour as intended and add a TC.

### AF3-03 [minor] system_spec_consistency — NFR-4's read budget vs the claim's under-fence read
Artifacts: spec NFR-4:388, F-8:183; test plan TC-088 step 4 (read cost = one verified read per store per tick).
Gap: the atomic claim adds a state-store fold read under the fence before the cycle's own read; NFR-4 says "at most one verified read per store per tick" and TC-088 counts reads. The pin is satisfiable only if the claim's read is reused as the tick's single state read, which no artifact says.
Remediation target: specification. Fix: state that the claim's under-fence state read is the tick's single verified state read (or qualify NFR-4 to exclude the claim read), and state it in TC-088 step 4.

### AF3-04 [minor] spec_completeness — the lease-age anchor is undefined
Artifacts: spec F-8:183, EVT-7:347, Appendix E:783, Appendix D:769; test plan TC-015 step 2:640, TC-093 precondition:2366.
Gap: "lease age" and `fenceAgeMs` are asserted but not anchored: age since the acquisition record (`acquired`/`stale-takeover`) or since the latest action (`stop-requested`)? The two differ whenever a stop request lands, and the age is the trigger for the only remaining takeover path.
Remediation target: specification. Fix: define lease age as (injected now − the acquisition record's `recordedAt`) and state that `fenceAgeMs` is the same quantity.

### AF3-05 [nit] ac_quality — an `unevaluable` verdict's record count is implied, not declared
Artifacts: spec EVT-3:343 ("One or two durable records per `stuck` or `unevaluable` verdict"), DM-3:357; test plan TC-039 step 2:1252 ("no outcome phase").
Gap: the test plan pins one append (no `phase=outcome`) for `unevaluable`; the spec leaves the count ambiguous, and a reader could append a second `phase=outcome` with `killOutcome=not-attempted`.
Remediation target: specification. Fix: state that `unevaluable` produces exactly one `phase=verdict` record and no `phase=outcome`.

### AF3-06 [minor] ac_quality — claim-time `state.lock.busy` reports `already-running` for a non-coordinator writer
Artifacts: spec AC-F8-5:597, F-1:148, Appendix F:801.
Gap: the state write fence is shared with every other state writer (lane appends, blocker appends, audit). A momentary unrelated hold makes `coordinator start` exit 2 with `coordinator.already-running` while no coordinator exists, and Appendix F folds that into one row. This is a deliberate fail-safe, but the identity and message are misleading and there is no degraded reason.
Remediation target: specification. Fix: keep the fail-safe but state the ambiguity in the remediation hint (retry; the lock may be held by another state writer) and let `--live`/`degradation` disclose "state write fence busy".

### AF3-07 [minor] plan executability — the Phase-6 gate omits two mapped TCs
Artifacts: `chg-GH-241-plan.yaml` task 6.6 scope:675-676 and verification:634-639; test plan TC-024/TC-025.
Gap: TC-024 (`coordinator-decision-recovery.test.ts`) and TC-025 (`coordinator-decision-durability.test.ts`) are mapped to Phase 6 (header:131) and listed in the Phase-6 scope files, but neither file appears in the Phase-6 verification commands or the exit criteria, so the declared gate can be green with two mapped TCs unexecuted.
Remediation target: delivery_planning. Fix: add both files to the Phase-6 verification and exit criteria.

### AF3-08 [minor] cross_artifact_consistency — the test plan still describes the plan as v1.2/69 TCs
Artifacts: `chg-GH-241-test-plan.md` §1.2:25, §1.2:65, §2:71, §8.4:2681.
Gap: RF2-08's bullet is closed, but the surrounding prose still reads "`chg-GH-241-plan.yaml`, v1.2 ... maps the 69 v1.2 TCs and its v1.3 revision maps ..." while the only plan file is revision 1.3 with a 72-row map. Self-referential and factually wrong about the current artifact, though the substantive claim is now true.
Remediation target: test_planning. Fix: replace every "v1.2 / 69" reference with "plan revision 1.3 maps all 72 TCs" and delete the "v1.3 revision of a v1.2 file" framing.

## Verified as Correct (no finding)

- **Trace arithmetic is exact.** 48 spec ACs == 48 test-plan §3.1 rows; 72 TCs identical across §5.1 index, §5.2 details and §7 automation plan with no duplicate and no orphan; the plan's TC→phase map has 72 unique ids matching the test plan exactly; `plan.md`'s 72-row table agrees with the YAML map phase-for-phase (verified programmatically); 48 AC rows in `plan.md` cover every spec AC; SC-M1-25 is inherited clause-for-clause (13 rows).
- **The plan validates.** Re-ran the delivered `validatePlan` over `chg-GH-241-plan.yaml`: `verdict=valid`, `readyForDevelopment=true`, 0 errors, 10 phases, declared full tier — the PM's claim is true, not asserted.
- **The error-table arithmetic is exact against the live tree.** `RESERVED_TWO_SEGMENT_CODES` has 22 entries today (`scripts/checks/error-table-sync.ts:113-136`); exactly two coordinator identities are two-segment (`coordinator.already-running`, `coordinator.restart-budget-exhausted`) and the other four are three-segment; 22 → 24. `ERROR_TABLE` is asserted at 99 in four places and documented as "99 identities"; +6 → 105. No `coordinator.*` wildcard, no generic widening; `fallback.invocation`/`fallback.internal` stay in their separate containment set and are unaffected. AC-F10-2, DEC-11, Appendix F, TC-081/082 and the plan's pinned block all agree.
- **The delivered state port supports the new model with no declared contract change.** `acquireFence(token)` (`state/index.ts:604-627`) provides the mutual exclusion the claim needs; `fenceStatus()` (`:645-652`) exposes `held`/`stale`/`token` without failing; `recoverFence(token)` (`:654-674`) clears only a held-and-stale lock; `releaseFence(handle)` requires the branded in-process handle, so no artifact asks another process to release one. `StateArtifactRecord.sequence` (`contracts/state.ts:312-317`) makes the ledger-sequence folds sourceable. No `contracts/state.ts` change is required, and none is scoped.
- **The escalation composes without a handle-reusing refactor.** `appendBlockerQuestion`/`appendRecord` acquire and release their own fence (`state/blockers.ts:342-375, 384-409`), and the supervisor holds no write-fence handle across a cycle; `packages/core/src/state/blockers.ts` is correctly in no phase. (The stale-lock gap is AF3-02, not a collision.)
- **No M1-S18 / M1-S9 / M1-S20 preemption.** No phase adds a `daemon`, `dispatch`, or `supervise` command, control socket, lane supervisor, OS installer, or agent-prompt change; `ceo-loop.sh` is asserted byte-unchanged (TC-089); the daemon-install wiring stays a descriptor seam (DEC-1/DEC-6, AC-F8-2, TC-014); `detached` is reserved and unreachable (TC-014 steps 2-3).
- **Documentation-impact coverage is complete.** Every spec §16 target has an owning phase (P1 result contract; P7 status/brief/blockers; P9 registry/contracts/man-page/changeset; P10 new feature spec, economics, harness adapters, result-contract re-check, `doc/00-index.md`), and the only digest/brief change is the declared reserved slot.
- **The decision records now agree with spec v1.3.** TDR-0013 carries the liveness-first atomic claim (C-9), the single-record takeover, foreground-only v1, and the per-append helper with no `contracts/state.ts` change; TDR-0014 carries DC-6 (persisted verdict vs tick verdict) and the render-first reserved slot. Both remain `Proposed`, which is correct pending owner acceptance at PR review.
- **No pinned contract is silently unowned.** The six config keys, the six record kinds, the four fence actions, the lease-liveness states, the wake outcomes, the escalation states, and the two-code allowlist each have a data home, an owning phase, and at least one TC. The residual implementation-time inventions are the five blocking findings and AF3-01/03/04.

## Iteration 3 Note — same class or new

v1.3 cleared eight of the twelve iteration-2 findings and closed the letter of the other four, but the four "partially resolved" ones were each closed at the point named by the finding and not at the neighbouring surface, which is where three of the five new blockers sit:

- **Same class as the iteration-2 findings (residual, not new):** RF3-01 (the claim/helper boundary is the RF2-02 + RF2-07 pair resolved separately and never reconciled), RF3-02 (the RF2-10 split applied to `tick` but not to `status`), RF3-03 (the "unknown or unavailable" wording carried forward from the RF2-01 rewrite into an existing DEC-11 conflict).
- **Genuinely new, introduced by the remediation:** RF3-04 (the new TC-094 is internally impossible), RF3-05 (foreground-only v1 in RF2-09 created a long-running loop surface that no artifact declares, scopes, or tests).

Three of the five are cross-artifact *consistency* defects of the same kind that iterations 1 and 2 surfaced, and two are new classes of defect produced by the remediation itself. `chg-GH-241-plan.md:638` ("No blocking inconsistency after v1.3") and test-plan §1.2:25/§8.4:2681 ("no remaining gaps") are therefore overstated and should be corrected by their owners.

This is the third and final permitted DoR iteration. The gate is a hard gate, so delivery remains blocked, and there is no trivial-change override available (the change adds behaviour and touches contracts). Because two blocking findings are new classes rather than a third pass over the same defect, the PM must escalate to the human owner with this record rather than iterating a fourth time; the human decides whether to authorise a single scoped repair round (specification for RF3-01/02/03/05, test_planning for RF3-04 and AF3-08) or to re-scope the story.

## Routing

- Blocking: `specification` — RF3-01, RF3-02, RF3-03, RF3-05; `test_planning` — RF3-04.
- Advisory: `specification` — AF3-01, AF3-02, AF3-03, AF3-04, AF3-05, AF3-06; `delivery_planning` — AF3-07; `test_planning` — AF3-08.
- No finding routes to `delivery`. No finding requires a new product-scope decision, so no pause flag is set; the required action is the DoR escalation to the human owner, not a workflow STOP.
- Idempotency: findings are deduplicated against iterations 1 and 2; RF2-01..RF2-12 dispositions above are the authoritative carry-forward, and no finding is re-raised without new evidence.
