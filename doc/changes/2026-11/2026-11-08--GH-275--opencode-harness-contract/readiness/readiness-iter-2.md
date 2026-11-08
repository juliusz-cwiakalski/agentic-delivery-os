# Readiness Review Iteration 2

Verdict: **NOT_READY**
Work Item: GH-275
Date: 2026-11-09
Pause Required: no

Artifacts reviewed: `chg-GH-275-spec.md` v1.2 (30 ACs), `chg-GH-275-test-plan.md` v1.2 (46 TCs), `chg-GH-275-plan.yaml` (6 phases, `plan validate` verdict `valid`, `readyForDevelopment: true`), `chg-GH-275-pm-notes.yaml`, ticket GH-275, the delivered repository, and the installed `opencode v2.2.5` emitter.

Counts: **3 blocking**, **6 advisory**. Iteration-1 blocking findings B-1/B-2/B-3 are genuinely fixed; iteration-1 A-6 is **not** fixed and is escalated. The new blocking findings are test-plan assertions that contradict the delivered source/record shape and one spec decision-capture contradiction.

## Facet Summary

- spec_completeness: FAIL (B-1 `failureReported`; B-3 DEC-1/TDR-0008)
- ac_quality: FAIL (B-1)
- plan_coverage: PASS (30/30 ACs and 46/46 TCs each owned by exactly one phase; `plan validate` valid)
- test_traceability: FAIL (B-2)
- cross_artifact_consistency: FAIL (B-1, B-2)
- decision_capture: FAIL (B-3)
- system_spec_consistency: PASS (the change acknowledges the `system_spec_update` reconciliation; the six-case conformance floor is preserved by the legacy precedence)
- plan_doc_update_coverage: PASS (P6 names `feature-harness-adapters.md`, `feature-dispatch-engine.md`, and "any contract table")
- plan_code_area_coverage: PASS (all 8 opencode construction sites are in P2; 35 plan paths, 5 declared shared, 30 single-owner; advisory A-5)
- dod_defined: PASS (30 ACs + NFRs + E2E; B-1/B-2 testability gaps are captured below)

## Iteration-1 resolution (evidence)

| ID | Status | Proof / disproof |
|---|---|---|
| B-1 legacy evidence precedence | **FIXED** | Spec F-4 lines 126-131, DEC-5 line 313 and §8.5 lines 233-234 now make a legacy single-document `result` envelope authoritative and merge host `exitStatus`/`timedOut` on top. The delivered mapping is at `packages/adapters/src/harness/opencode.ts:105-116`; the six envelopes are `tests/fixtures/harness/scenarios/classification.ts:36-168`; `TC-HARN-010` is `tests/behaviour/harness-opencode-session.test.ts:219-263`. All six cases and the three TC-HARN-010 outcomes are producible under the new rule. |
| B-2 failure encodings | **FIXED** | Spec §8.4 lines 220-224, DEC-5 line 313, F-7 line 134, AC-F7-1 line 361 and §14 OQ-T1 line 303 now name `tool_use` with `part.state.status === "error"` and the `error` event. The installed `opencode v2.2.5` emitter proves the paths: `u("tool_use", n, {part: O})` with `state:{status:"error", ..., error:y}` on `session.tool.failed`, and `u("error", n, {error:t.data.error})`; every event is written as `JSON.stringify({type, timestamp, sessionID, ...n})`. The falsifiability controls are TC-OCS-042 lines 935-936, TC-OCS-047 lines 1081-1085 and TC-OCS-048 lines 1108-1112. |
| B-3 deterministic acquisition | **FIXED** | TC-OCS-020 lines 627-635, TC-OCS-021 lines 658-667, TC-OCS-030 lines 740-748, TC-OCS-031 lines 767-769 and TC-OCS-032 line 796 now use the bounded `flushUntil(predicate, 64)` helper (§6.1 line 1585) and assert `spawnSettled`/`resumeSettled`, `acquiredCalls`, and `completionSettled`. Under M-3 the spawn path leaves `spawnSettled === false` and `acquiredCalls === 0` after 64 microtask turns and **fails step 3**; the resume path fails the same bounded assertion. Under M-4 `collectSettled` becomes true before `finish()` and **fails TC-OCS-021 step 2**. No unbounded await remains in the named five TCs. M-3's red set is corrected at §7.3 line 1865; M-4 owns TC-OCS-021 at line 1866. |
| A-1 timeout flag | **FIXED** | Spec AC-F1-4 line 340, AC-F5-1 line 356 and F-3 line 125 now say the timeout is observed from the starter's `timedOut: true` and that no structural field is added. `HarnessFailure` at `packages/core/src/contracts/harness.ts:303-311` has no `timedOut`; TC-OCS-014 line 520-522 asserts only the observed status and the summary. |
| A-2 TC-OCS-071 scope | **FIXED** | TC-OCS-071 lines 1370-1371 scans only `harness-opencode-stream.test.ts` and `harness-opencode-resume-stream.test.ts` and explicitly excludes `harness-host-stream.test.ts` while keeping the child-process/`Bun.spawn`/`Bun.$`/`execFile` ban on all suites. |
| A-3 plan path ownership | **FIXED** | `plan validate GH-275` returns `valid` / `readyForDevelopment: true`. The plan has 35 scoped paths, exactly 5 declared shared paths (`opencode.ts`, `harness-opencode-session.test.ts`, `dispatch-composition.test.ts`, `harness-claude-session.test.ts`, `dispatch/golden/harness.ts`) and 30 single-owner paths; `packages/testkit/src/conformance/harness.ts` is P2-only (line 367), `tests/fixtures/harness/scenarios/classification.ts` is P4-only and explicitly read-only (lines 476-479, header 118-120), and `tests/structure/harness-stream-contract.test.ts` is P1-only. |
| A-4 E2E cadence | **FIXED (with residual A-4 below)** | Test plan §6.3 lines 1642-1670 add step 1b (clone-local `.delivery-os/config.yaml` with `lane.liveness-interval: 3000`, proven by `config get`) and step 1c (bounded first-event probe). `production.ts:949` passes `livenessIntervalMs` and `dispatch.ts:516-542` starts the watcher after `collect`; a 3 s cadence over the 15 s window yields a recorded verdict. The `liveness:`-ref requirement is in TC-OCS-100 line 1525. |
| A-5 identity check severity | **FIXED** | Spec AC-F3-3 line 349, DEC-2 line 310 and F-3 line 125 now state the identity guard is defence-in-depth and unreachable with `opencode run --session <id>`. |
| A-6 TDR citation | **NOT FIXED / WORSENED** | Spec DEC-1 line 309 says "No new TDR is required: TDR-0008 ... is the precedent that an additive adapter-contract extension ... is recorded in the change's decision log", and §14 line 299 says no `@decision-advisor` consultation is required. `doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md:18` classifies the record `rigor: R2` and line 91 states "**A record is therefore required; this TDR is that record.**" The cited precedent says the opposite of the conclusion. This is blocking B-3. |
| A-7 optional composition fact | **FIXED** | `ProductionCompositionFacts.harnessSpawnRunner` is optional at `packages/cli/src/production.ts:197` and defaults at line 286 (`facts.harnessSpawnRunner ?? createHostSpawnRunner()`); the plan P2 lines 332-349 mirrors this for `harnessSpawnStarter` with `?? createHostSpawnStarter()`. All 8 source construction sites are in P2's scope: `packages/cli/src/production.ts:452`, `packages/testkit/src/conformance/harness.ts:91`, `tests/behaviour/harness-claude-session.test.ts:50`, `tests/behaviour/harness-opencode-session.test.ts:54`, `tests/behaviour/harness-spawn-credential.test.ts:108,146`, `tests/behaviour/harness-spawn-env.test.ts:113`, `tests/conformance/harness-liveness.test.ts:281`, `tests/structure/harness-neutrality.test.ts:124`. The queue production fixture that dispatches (`tests/behaviour/queue-production-binding.test.ts:504,624,670`) is injected at plan P2 line 375. |
| A-8 E2E state-root accounting | **PARTIAL** | Plan P6 lines 615-627 now records the appended attempt's `attemptId`, token and `evidenceRefs`, the GH-275 lease id from `queue list --json`, and proves/forces release. The test plan §6.3 step 7 lines 1710-1721 still extracts only `recordedAt`/`token`/`evidenceRefs` (no `attemptId`) and the cleanup lines 1740-1745 only release "if interrupted"; the procedure text the operator runs does not contain the lease proof. Advisory A-1. |

## BLOCKING findings

### B-1 [critical] cross_artifact_consistency / ac_quality — `failureReported` on a non-zero exit is both required and forbidden

Artifacts: `chg-GH-275-spec.md` F-4 line 128, §8.4 line 223, DEC-5 line 313; `chg-GH-275-test-plan.md` §1 summary line 32, TC-OCS-045 step 4 line 1021, TC-OCS-048 step 5 line 1112; `chg-GH-275-plan.yaml` P2 lines 321-322.

Gap: the spec says both "`failureReported` is true iff an `error` event is present (a non-zero exit is already a failure fact in its own right)" (F-4) and "`failureReported` is true iff an `error` event is present **or the exit is non-zero**" (§8.4, DEC-5); the test plan follows both sides — TC-OCS-048 step 5 asserts `failureReported: true` from a non-zero exit while TC-OCS-045 step 4 asserts "never inferred from the exit status alone". A correct implementation cannot make both Critical TCs green. The delivered legacy mapping (`opencode.ts:113`) sets `failureReported` only from `result.failure`/`result.status`, which supports the F-4/TC-OCS-045 side and contradicts the new TC-OCS-048 step 5.

Suggested remediation target phase: **specification** (primary), then test_planning.
Suggested fix: choose one rule and state it in F-4, §8.4 and DEC-5, then align TC-OCS-045 step 4 and TC-OCS-048 step 5. Recommended: `failureReported` mirrors explicit failure facts only (`result.failure`/`result.status`/an `error` event) and a non-zero process exit is carried only by `exitStatus`; alternatively state that `failureReported` is also true on a non-zero exit and remove TC-OCS-045's "never inferred" clause.

### B-2 [critical] test_traceability — three Critical test assertions contradict the delivered source/record shape

Artifacts: `chg-GH-275-test-plan.md` TC-OCS-004 step 4 line 350, TC-OCS-053 step 6 line 1226, TC-OCS-082 steps 3 and 5 lines 1484/1486, TC-OCS-100 step 3 line 1522; `chg-GH-275-plan.yaml` P5 line 538.

Gap:
- **TC-OCS-004 step 4** requires `dispatch.session.spawn-failed` to "appear exactly once" in `packages/core/src/app/dispatch.ts`. It appears **three** times: line 210 (switch case), line 471 (`errorCode`), line 474 (`comparisonFor`). The message at line 482 appears once. A correct delivery fails the identity count.
- **TC-OCS-053 step 6** requires the adapter source to contain "no `300_000` literal". The delivered listing path keeps `DEFAULT_TIMEOUT_MS = 300_000` (`opencode.ts:76`) and passes it to the one-shot runner for `listSessions` (`opencode.ts:127,305`); OQ-T3 (line 1939) leaves session listing unchanged, and the delivered default is 300 s. Removing the literal would silently change listing behavior, which spec §8.4 says is unchanged.
- **TC-OCS-082 step 3** reads `errorCode`/`lastMessage` from the **attempt** record. `DispatchAttemptRecord` (`packages/core/src/contracts/dispatch.ts:189-210`) has neither field; both are on the envelope (`DispatchEnvelopeData` lines 278-296). **Step 5** requires the `sessionId` in "the attempt evidence refs"; the attempt refs are only `attempt:<attemptId>` and `liveness:<verdict>` (`dispatch.ts:684`), and the record has no `sessionId`. A correct delivery fails these assertions. TC-OCS-100 step 3 repeats the attempt-`errorCode` claim.

Suggested remediation target phase: **test_planning** (and **delivery_planning** for the P5 wording).
Suggested fix: (a) TC-OCS-004: assert the message appears exactly once and the identity is returned by the spawn-failure branch (behavioural), or assert "present at least twice" with the switch/mapping explained; (b) TC-OCS-053: assert no `300_000`/`DEFAULT_TIMEOUT_MS` reaches the **spawn/resume starter options**, and allow the listing default to retain `DEFAULT_TIMEOUT_MS` (mirror plan P2 line 328); reword plan P5 line 538 the same way; (c) TC-OCS-082: read `data.error.code`/`data.lastMessage` from the envelope, assert the attempt's `token`/`outcome`/`evidenceRefs` and the adapter's recorded spawn→collect handle, and drop the "sessionId in the attempt evidence refs" claim; fix TC-OCS-100 step 3 the same way.

### B-3 [major] decision_capture — DEC-1's no-TDR rationale contradicts the cited TDR-0008

Artifacts: `chg-GH-275-spec.md` DEC-1 line 309 and §14 line 299; `doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md` line 18 (`rigor: R2`) and line 91; `.ai/agent/decision-instructions.md:21`.

Gap: DEC-1 says "No new TDR is required: TDR-0008 ... is the precedent that an additive adapter-contract extension ... is recorded in the change's decision log". TDR-0008 is a standalone decision record whose own governance section states "**A record is therefore required; this TDR is that record.**" The change adds an additive contract type to `packages/core/src/contracts/harness.ts` (a harness adapter contract), which is the class TDR-0008 says is record-governed. The spec's citation therefore disproves its conclusion; §14's "No additional `@decision-advisor` consultation is required" is unsupported. Iteration-1 A-6 is not resolved.

Suggested remediation target phase: **specification**.
Suggested fix: either author a short TDR/ADR for the `HarnessSpawnStarter` seam (the safe reading of TDR-0008), or rewrite DEC-1 to state why this host I/O seam is **not** an adapter-contract change (no provider operation, no `ADAPTER_OPERATIONS`/`DeliveryRequest` change, no parity surface, engine-invisible) and cite the correct R1 bar from `.ai/agent/decision-instructions.md:21`. Update §14 accordingly. Keep the PM's revisit trigger.

## ADVISORY findings

### A-1 [major] test_traceability — E2E §6.3 does not record the attempt id or prove lease release

Artifacts: `chg-GH-275-test-plan.md` §6.3 step 7 lines 1710-1721 and cleanup lines 1740-1745; `chg-GH-275-plan.yaml` P6 lines 615-627.

Gap: the plan P6 requires reading the appended `attemptId`, recording the GH-275 lease id from `queue list --json`, and proving/forcing release; the operator procedure in §6.3 does not extract `attemptId` and only releases the lease "if the run was interrupted", otherwise assuming the dispatch released it. The procedure the operator runs therefore cannot produce the plan's evidence.

Suggested remediation target phase: **test_planning** (or **delivery_planning** if the plan is treated as the authoritative extension).
Suggested fix: add `attemptId` to the jq extraction and a post-run `queue list --json` check (`no active lease for GH-275 with holder dispatch on github.com/juliusz-cwiakalski/agentic-delivery-os`), with `queue release` on failure; or state in P6 that it augments §6.3 and record both artifacts.

### A-2 [major] cross_artifact_consistency — test plan §7.1/§7.2 omit four migration suites and `contracts/index.ts`

Artifacts: `chg-GH-275-test-plan.md` §7.1 lines 1760-1785; `chg-GH-275-plan.yaml` P1 line 272 and P2 lines 363-377; delivered construction sites listed in A-7 above.

Gap: `tests/behaviour/harness-spawn-env.test.ts`, `tests/behaviour/harness-spawn-credential.test.ts`, `tests/conformance/harness-liveness.test.ts`, `tests/structure/harness-neutrality.test.ts` and `packages/core/src/contracts/index.ts` must be edited for the required-`starter` migration and the re-export, but the test plan's "Files the Delivery Must Add or Edit" table omits them. The plan is complete; the test plan is not.

Suggested remediation target phase: **test_planning**.
Suggested fix: add the four suites and `contracts/index.ts` to §7.1 and to §7.2's mapping (they carry no new TC; they are migration edits in P2).

### A-3 [major] test_traceability — TC-OCS-061's seam assertion is not observable, and TC-OCS-062 overclaims M-17's red set

Artifacts: `chg-GH-275-test-plan.md` TC-OCS-061 step 1 line 1281, TC-OCS-062 step 5 line 1318.

Gap: `HarnessConformanceIo`/`HarnessConformanceRegistration.build` (`packages/testkit/src/conformance/harness.ts:34-56`) exposes no seam, and a one-shot runner over a single-document `spawnStdout` is behaviorally indistinguishable from a starter for the delivered six cases; "never over the one-shot runner" cannot be asserted from the public test surface. Separately, M-17 deletes the legacy branch in the adapter and does not change `CLASSIFICATION_SCENARIOS`, so TC-OCS-062 step 1 (the structural fixture assertion) stays green; only step 2 (the opencode run) goes red.

Suggested remediation target phase: **test_planning**.
Suggested fix: assert an observable behavior (a gated/multi-line stream that acquires before completion) or add a recording seam to the registry; change TC-OCS-062 step 5 to "step 2 goes red, steps 1 and 3 stay green".

### A-4 [minor] test_traceability — the E2E `liveness:` ref does not by itself distinguish non-blocking from completion-gated

Artifacts: `chg-GH-275-test-plan.md` TC-OCS-100 line 1525 and line 1731; `packages/cli/src/production.ts:443-458`; `packages/adapters/src/harness/opencode.ts:257`; `packages/core/src/app/dispatch.ts:516-542`.

Gap: the production opencode adapter receives no `livenessFacts`, so `liveness()` returns all-absent and `evaluateDispatchLiveness` records `liveness:unknown`. A completion-gated spawn that returns only after the child is killed still starts the watcher after `spawn` and can record the same `unknown` verdict; the `liveness:` ref alone is not "positive evidence that the watch polled while the session was live". The deterministic suite (TC-OCS-020/021/082) is the real discriminator.

Suggested remediation target phase: **test_planning**.
Suggested fix: require a sourced liveness reading (inject facts) or assert at the dispatch level that `collect` was pending for at least one poll; stop claiming the ref alone proves non-blocking.

### A-5 [minor] plan_code_area_coverage — P2 summary claims the dispatch golden fixture injects a starter

Artifacts: `chg-GH-275-plan.yaml` P2 lines 339-349; `tests/fixtures/dispatch/golden/harness.ts:1-25`.

Gap: the fixture uses `createScriptedHarness` and constructs no opencode adapter, so there is no starter to inject there; the P2 summary's "the dispatch composition helper and fixture inject the fixture starter" is inaccurate. The P4 edit (injectable `harnessPort`) is the real change to that fixture.

Suggested remediation target phase: **delivery_planning**.
Suggested fix: remove `tests/fixtures/dispatch/golden/harness.ts` from the P2 starter-injection list or state that P2's edit is only the port-injection seam, with the starter injection confined to `dispatch-composition.test.ts` and `tests/fixtures/queue/production/harness.ts`.

### A-6 [nit] ac_quality — two test titles/keys still name non-delivered shapes

Artifacts: `chg-GH-275-test-plan.md` TC-OCS-014 title line 501; TC-OCS-042 step 3 line 933.

Gap: TC-OCS-014's title says "with `timedOut`" though the body and AC-F1-4 explicitly say no structural timeout field exists; TC-OCS-042 says "outcome `completed-with-tool-failure`" though the delivered `HARNESS_OUTCOMES` value is `completed` (the token is `partial`). The body hedges save both, but the titles invite a wrong assertion.

Suggested remediation target phase: **test_planning**.
Suggested fix: retitle TC-OCS-014 "with the starter's `timedOut` fact" and say TC-OCS-042 "outcome `completed`, token `partial`".

## Required remediation per owning artifact

- **Specification (`@spec-writer`)**: B-1 (choose the `failureReported` rule and align F-4, §8.4, DEC-5), B-3 (author a TDR/ADR for the streaming seam or rewrite DEC-1/§14 with a correct rationale and citation).
- **Test plan (`@test-plan-writer`)**: B-1 (align TC-OCS-045 step 4 with TC-OCS-048 step 5), B-2 (TC-OCS-004 count, TC-OCS-053 300_000 scope, TC-OCS-082/TC-OCS-100 attempt-vs-envelope fields and evidence-refs), A-1 (attemptId + lease proof in §6.3), A-2 (§7.1/§7.2 migration files), A-3 (TC-OCS-061 observability, TC-OCS-062 M-17 step set), A-4 (liveness-ref claim), A-6 (titles).
- **Plan (`@plan-writer`)**: B-2 (P5 line 538 wording, align with the corrected TC-OCS-053), A-1 (state P6 augments §6.3 or move the steps into the procedure), A-5 (P2 fixture-injection list).

Once the specification and test plan are revised, re-run this gate. Do not reopen `delivery` on any of these findings.
