# Readiness Review Iteration 3

Verdict: **NOT_READY**
Work Item: GH-275
Date: 2026-11-09
Pause Required: no

Artifacts reviewed: `chg-GH-275-spec.md` v1.3 (30 ACs), `chg-GH-275-test-plan.md` v1.3 (46 TCs), `chg-GH-275-plan.yaml` (revision 3; `plan validate GH-275` → `valid`, `readyForDevelopment: true`), `chg-GH-275-pm-notes.yaml`, `doc/decisions/TDR-0016-harness-streaming-spawn-seam.md`, ticket GH-275, and the delivered source/contracts used as oracles.

Counts: **1 blocking**, **3 gating-major**, **1 advisory**. Iteration-2 B-2, B-3, A-1 (plan + E2E), A-2 (as scoped), A-5 and A-6 are genuinely fixed. Iteration-2 **B-1 is not fixed in the plan** (P2 summary still states the superseded `failureReported` rule), and the A-3/A-4 corrections landed in the test plan but not in the plan summaries (P4/P6). No source-code, traceability, or decision-record defect remains.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS (30/30 ACs and 46/46 TCs each owned by one phase; `plan validate` valid)
- test_traceability: PASS (every AC covered by named TCs; 46 TCs)
- cross_artifact_consistency: FAIL (N-1, N-2, N-3, N-4)
- decision_capture: PASS (TDR-0016 meets the R2 bar; citations verified; untracked file is the accepted P6 constraint)
- system_spec_consistency: PASS (phase-7 reconciliation declared; no silent drift from desktop contracts)
- plan_doc_update_coverage: PASS (P6 names `feature-harness-adapters.md`, `feature-dispatch-engine.md`, "any contract table")
- plan_code_area_coverage: PASS (per-phase file scopes present; plan valid)
- dod_defined: PASS (ACs + NFRs + E2E + lease proof)

## Iteration-2 resolution (evidence)

| ID | Status | Proof / disproof |
|---|---|---|
| B-1 `failureReported` | **NOT FIXED** | Spec is fixed: F-4 lines 128-134, §8.4 line 226, DEC-5 line 317, AC-F1-5 line 345, AC-F4-3 line 357, AC-F4-4 line 358, glossary line 425, Appendix C line 476 all state explicit-fact-only. Test plan is fixed: §1.1 line 32, TC-OCS-015 line 548 (`failureReported: false` on a non-zero exit), TC-OCS-033 line 824, TC-OCS-045 line 1021, TC-OCS-048 line 1112, TC-OCS-082/100 carry no contrary claim. **The plan still contradicts all of them**: `chg-GH-275-plan.yaml` P2 summary lines 354-355 say "`failureReported` true iff an `error` event is present **or the exit is non-zero**". A coder executing P2 would fail AC-F1-5/AC-F4-3/AC-F4-4 and TC-OCS-015/033/045/048. See N-1. |
| B-2a TC-OCS-004 count | **FIXED** | Test plan line 350 now asserts the message once (`packages/core/src/app/dispatch.ts:482`) and explicitly records the code identifier at `dispatch.ts:210,471,474` without an "exactly once" requirement. Source probe confirms those are the only three occurrences of `dispatch.session.spawn-failed` and the only one of the message. |
| B-2b TC-OCS-053 `300_000` | **FIXED** | Test plan line 1226 scopes the assertion to "no `300_000`/`DEFAULT_TIMEOUT_MS` reaches the spawn/resume starter options" and explicitly retains `DEFAULT_TIMEOUT_MS = 300_000` for listing (`opencode.ts:76`, used at `:127` and `:305`), which matches source (`DEFAULT_TIMEOUT_MS = 300_000` at `opencode.ts:76`; listing timeout passed at `:127` and `:305`). |
| B-2c TC-OCS-082/100 fields | **FIXED** | Test plan lines 1484-1486 and 1522-1525 read `data.error.code`/`data.lastMessage` from `DispatchEnvelopeData` (`contracts/dispatch.ts:278-296`; `CommandResultError.code` at `contracts/result.ts:36-43`), assert the attempt's `attemptId`/`token`/`outcome`/`evidenceRefs` (`DispatchAttemptRecord` `contracts/dispatch.ts:189-210` has no `errorCode`/`lastMessage`/`sessionId`), and cite `evidenceRefs` `attempt:<id>` + `liveness:<verdict>` at `dispatch.ts:684`. Verified against source. |
| B-3 decision capture | **FIXED** | `doc/decisions/TDR-0016-harness-streaming-spawn-seam.md` exists with status `Proposed` (line 4), `rigor: R2` (line 18), `reversibility: easy` (line 19), named decider (line 27), C-1..C-7, ALT-0..ALT-4, consequences, and five revisit triggers (lines 49-54). Spec §13 line 297, §14 line 303 and DEC-1 line 313 cite it; every cited line still matches the file on disk (`## Decision` line 225, decision bullet line 227). |
| A-1 E2E attempt id + lease | **FIXED** | Test plan §6.3 step 7 extracts `attemptId`/`recordedAt`/`token`/`outcome`/`evidenceRefs` (lines 1710-1721); step 7a proves release via `queue list --json` and makes it part of PASS (lines 1729-1745, 1763). Field path verified: `.data.leases[]` with `ref`/`repository`/`leaseId`/`holder`/`scope`/`heartbeatAgeMs` (`contracts/queue.ts:572-582`; payload `packages/cli/src/commands/queue.ts:257-282`). `queue release <ref> --holder` grammar verified (`queue.ts:348,431-434`). |
| A-2 migration files | **FIXED (as scoped)** | §7.1 lines 1814-1821 list `harness-spawn-env`, `harness-spawn-credential`, `harness-liveness`, `harness-neutrality`; §7.2 lines 1885-1893 list them plus `contracts/index.ts` (P1). New/remaining omissions (queue fixture, `content-inventory`) are N-4. |
| A-3 TC-OCS-061/062 | **FIXED in test plan** | TC-OCS-061 step 1 line 1281 now asserts a multi-line `spawnStdout` acquisition and explicitly says do not assert "never over the one-shot runner" (`HarnessConformanceIo` at `packages/testkit/src/conformance/harness.ts:41-47`, `build` at `:61-65` — verified). TC-OCS-062 step 5 line 1318 states the honest M-17 set (step 1 green, step 2 red, step 3 green, step 4 first assertion red) and names the extra suite needed to observe step 4. Plan P4 still overclaims — N-2. |
| A-4 liveness ref | **FIXED in test plan** | TC-OCS-100 lines 1525/1536, TC-OCS-101 line 1561, and §6.3 line 1757 treat the `liveness:` ref as corroboration only (production adapter receives no `livenessFacts`; `production.ts:443-458`, `opencode.ts:257`). Plan P6 still overclaims — N-3. |
| A-5 golden fixture | **FIXED** | Plan P2 lines 378-387 and the revision note (lines 45-51) remove the golden fixture from the starter-injection claim; P4 lines 495-497 own the injectable `harnessPort`. The fixture is still an allowed P2 shared-path entry, not an injection claim. |
| A-6 titles | **FIXED** | TC-OCS-014 title line 202 "with the starter's `timedOut` fact"; TC-OCS-042 title line 914 "outcome `completed`, token `partial`" and step 3 line 933 distinguishes the internal `completed-with-tool-failure` key (`contracts/harness.ts:151-176` verified). |

## BLOCKING finding

### N-1 [critical] cross_artifact_consistency — plan P2 still requires `failureReported` on a non-zero exit

Artifact: `chg-GH-275-plan.yaml` P2 `summary` lines 354-355.

Gap: P2 says "`failureReported` true iff an `error` event is present **or the exit is non-zero**". This is the exact rule iteration-2 B-1 removed and is contradicted by spec v1.3 F-4/§8.4/DEC-5/AC-F1-5/AC-F4-3/AC-F4-4 and by test plan TC-OCS-015/033/045/048. P2 is the primary implementation instruction for the phase that owns AC-F1-5 and AC-F4-3/AC-F4-4 (plan header lines 102-104), so following it fails three Critical ACs and four Critical TCs. The plan revision-3 note (lines 34-61) records only the P5/A-5/P6 fixes, confirming B-1 was not propagated to P2.

Suggested remediation target phase: **delivery_planning**
Suggested fix: replace lines 354-355 with the explicit-fact rule: "`failureReported` true iff a JSONL `error` event is present; a non-zero exit is carried by `exitStatus` only and classifies `failed` through the classifier's exit branch (`packages/core/src/domain/harness-classify.ts:50-52`)".

## GATING-MAJOR findings

### N-2 [major] cross_artifact_consistency — plan P4 still orders an unobservable conformance assertion

Artifact: `chg-GH-275-plan.yaml` P4 `summary` lines 499-501.

Gap: P4 says the TC-OCS-061 conformance assertions must establish that the opencode registration "constructs its port over a starter derived from the scenario `spawnStdout` **and never over the one-shot runner**". Test plan TC-OCS-061 step 1 (line 1281) explicitly retracts that claim as unobservable from the public conformance surface (`HarnessConformanceIo`/`build` expose only `spawnStdout` plus deps). Leaving the plan instruction in place re-creates the A-3 defect on the plan side and asks the coder to write an assertion the test plan forbids.

Suggested remediation target phase: **delivery_planning**
Suggested fix: delete "and never over the one-shot runner" from P4; make the observable requirement the multi-line `spawnStdout` acquisition (and M-15's rebuild-over-runner mutation), as TC-OCS-061 step 1 states.

### N-3 [major] cross_artifact_consistency — plan P6 still calls the `liveness:` ref proof of non-blocking acquisition

Artifact: `chg-GH-275-plan.yaml` P6 `summary` lines 667-669.

Gap: P6 records "at least one `liveness:` evidence ref ... (positive evidence that the progress watch polled while the session was live, which a completion-gated spawn cannot produce)". Test plan TC-OCS-100 lines 1525/1536 and §6.3 line 1757 say the opposite: the production adapter is composed without `livenessFacts`, so the verdict can be `liveness:unknown` and the ref is corroboration only. The plan's overclaim contradicts the artifact that defines the E2E PASS rule (A-4).

Suggested remediation target phase: **delivery_planning**
Suggested fix: reword to "at least one `liveness:` evidence ref as corroboration only; non-blocking acquisition is proven by TC-OCS-020/021 and TC-OCS-082 step 1", matching the test plan.

### N-4 [major] plan_coverage / test_traceability — §7.1/§7.2 omit two plan-owned required edits

Artifact: `chg-GH-275-test-plan.md` §7.1 lines 1789-1832 and §7.2 lines 1885-1893; `chg-GH-275-plan.yaml` P1 line 296/314 and P2 line 414.

Gap: the plan requires editing two files the test plan's "Files the Delivery Must Add or Edit" inventory does not list:
- `tests/fixtures/queue/production/harness.ts` — P2 line 414 (its queue-binding suite dispatches; because `harnessSpawnStarter` is optional and defaults to `createHostSpawnStarter()`, omission would spawn a real child and break NFR-5);
- `tests/structure/content-inventory.test.ts` — P1 lines 296/314; the exact host executable allowance is `["createHostSpawnRunner"]` (`tests/structure/content-inventory.test.ts:682`), so the new exported `createHostSpawnStarter` fails "undeclared executable export" unless the allowance is updated.

§7.1/§7.2 and the plan therefore disagree on the required file set; the plan is complete, the test-plan inventory is not.

Suggested remediation target phase: **test_planning**
Suggested fix: add both paths to the §7.1 migration table and the §7.2 migration mapping with their phases (queue fixture P2, `content-inventory` P1), carrying no new TC.

## ADVISORY finding

### N-5 [nit] cross_artifact_consistency — stale plan source versions and unindexed TDR

Artifacts: `chg-GH-275-plan.yaml` lines 64, 68 (`Spec ... v1.2`, `Test plan ... v1.2`); `doc/decisions/00-index.md` (no TDR-0016 row).

Gap: the plan's "Sources" block still names spec v1.2 / test-plan v1.2 while both are v1.3, and every prior TDR has an index row. Neither affects implementation, and the index is documented as "manually maintained or auto-generated" (`.ai/agent/decision-instructions.md:65`).

Suggested remediation target phase: **delivery_planning** (version strings; optional index row if the team keeps the index current). Non-gating.

## Accepted constraint (not a finding)

`doc/decisions/TDR-0016-harness-streaming-spawn-seam.md` is untracked and a standalone `commit GH-275` currently fails with `commit.commitlint-failed` ("invented tracker references … TDR-0016"). It is declared in plan P6 scope (line 725) and lands with the P6 changeset commit (`.changeset/…` sorts before `doc/…`, so the template subject does not carry `TDR-0016`). The mitigation is sound; treated as advisory only.

## Required remediation per owning artifact

- **Plan (`@plan-writer`, `delivery_planning`)**: N-1 (P2 lines 354-355), N-2 (P4 line 501), N-3 (P6 lines 667-669), N-5 (header version strings).
- **Test plan (`@test-plan-writer`, `test_planning`)**: N-4 (§7.1/§7.2 add `tests/fixtures/queue/production/harness.ts` and `tests/structure/content-inventory.test.ts`).
- **Specification**: no remediation required; the v1.3 `failureReported` rule and TDR-0016 citation are correct and internally consistent.

The remaining gaps are textual contradictions in the plan (N-1..N-3) and one test-plan inventory omission (N-4). They are mechanically fixable; if the same plan-side B-1 contradiction recurs after this iteration, escalate to the human rather than looping.
