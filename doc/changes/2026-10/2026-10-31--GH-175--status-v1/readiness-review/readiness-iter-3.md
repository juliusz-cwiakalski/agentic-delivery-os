# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-175
Date: 2026-10-31
Pause Required: yes (iteration cap reached — see Escalation)

## Inputs Reviewed

- `chg-GH-175-spec.md` (v1.4, `last_updated` 2026-10-31), `chg-GH-175-test-plan.md` (v1.4, `last_updated` 2026-10-31T17:10Z), `chg-GH-175-plan.md` (v1.3, `last_updated` 2026-10-31T17:30:00Z), `chg-GH-175-pm-notes.yaml`.
- Iteration-1 and iteration-2 records: `readiness-review/readiness-iter-1.md`, `readiness-review/readiness-iter-2.md`.
- Ticket GH-175 (OPEN; labels `change`, `planning`; title `M0-S6: status v1`) re-read this iteration; both ticket ACs are still mapped in spec §17.
- Current-truth/system inputs used to verify claims: `doc/spec/features/{feature-provider-client-seeds,feature-state-layer,feature-provider-engine,feature-config-layer,feature-result-contract,feature-monorepo-scaffold-toolchain}.md`; `doc/decisions/ADR-0004*` (C-3); `packages/core/src/contracts/{error-table,ports}.ts`; `packages/core/src/provider/parks.ts` (`readProviderParkViews`); `packages/adapters/src/github/{client,normalize}.ts`; `tests/behaviour/providers/{github-trap,github-inputs}.test.ts`; `tests/types/provider-views.type-test.ts`; `package.json` (`pnpm check` → `typecheck` includes `tests/types/tsconfig.json`).

## Disposition of Iteration-2 Findings

| # | Label | Disposition | Evidence |
|---|---|---|---|
| 1a | Major — provider-config identity pin in TC-017/029 | **FIXED** | TC-STATUS-017 preconditions/steps 5–6/negative control 10 and expected outcome now assert `failureCode: "config.value.invalid"` + reason `provider-chain-unresolved` + **no** `failureClass`, a `config-invalid` + existing `config.*` case (g), and that `provider.chain.invalid` is never a `failureCode`/`failureClass` (test plan lines 754–755, 765–766, 770, 774). TC-STATUS-029 preconditions/step 3/expected outcome carry the same pin (lines 1140, 1146, 1154). Plan 5.3/5.6, D8, evidence model and reader types mirror it (plan 120, 123, 205, 435, 438). No artifact assigns a `provider.*` row as a code/class. |
| 1b | Major — satisfiable credential-less/anonymous control in TC-021/023/032 | **FIXED (control), with a residual state-classification defect reported as R-1** | TC-STATUS-021 precondition 3/step 7/step 9, TC-STATUS-023 precondition 11/steps 6–7, TC-STATUS-032 precondition 4/steps 8–9 now inject an `authMethod.mechanism: "anonymous"` instance over a would-answer-2xx fixture transport, assert zero requests, assert the refusal is the composition guard (not a client-level rejection), and pair it with a credential-reference restored control. The client-tolerance assumption is gone. Residual: the per-section expected state for `changes-and-prs` is not jointly satisfiable (R-1). |
| 2 | Major — composition guard refusing anonymous before any read | **FIXED** | Spec F-12 (line 154) and DEC-5 (line 389) pin a credential-reference-only admission with refusal before any read and `unknown`/`unavailable` + `credential-unavailable`/`source-unavailable`, never `observed`. Plan spells it in the CLI/adapter spellings (180), D5 (202), tasks 4.3/4.4/5.4/6.4 (403, 404, 436, 469) and the Phase 4 acceptance criterion (410): guard before client construction, zero transport/live requests, classified `credential-unavailable` (`config.credential.missing`, an existing `config.*` row at `error-table.ts:213`), restored control reaches the dependent outcome. The guard is expressible against `ExternalSystemAuthMethod` (`ports.ts:26–27`). |
| 3 | Minor — spec §14 / revision-log version reference | **FIXED** | Spec §14 now says "the test plan remains authoritative for test execution at its current revision (v1.4), and this v1.4 revision does not modify it" (line 379); the v1.3 history row is scoped to "current at that time" (673) and the v1.4 row records the alignment (674). No current spec text claims v1.2. |
| 4 | Nit — test plan GAP-1/A-T3 plan-revision citation | **FIXED** | GAP-1 (55), A-T3 (1458) and the recorded-gaps list (1482) now cite "the current implementation plan (v1.1 onward; currently v1.3)", which matches plan v1.3; historical v1.1 rows are retained as history only. |
| 5 | Nit — trap-suite check-run helper adaptation | **FIXED** | Task 2.4 (line 342) now adapts `defaultCheckRunReader`, `checkRunsCheck` and `dropFailedCheckRun` to unwrap `ProviderReadResult<{ items, pageItemCount }>` and keeps the raw-page assertion live (`pageItemCount` 4 for `SHA_A`, 1 for `SHA_B`), matching the delivered `readonly PipelineRun[]` helpers and fixture sizes. |

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

Counts: **0 critical, 2 major, 1 minor, 1 nit**.

Coverage check (unchanged): 33/33 TCs (TC-STATUS-001..033, 33 Scenario Index rows + 33 plan mapping rows), 24/24 ACs, 10/10 NFRs, 15/15 DMs mapped in test plan §3.1–§3.3 and the plan mapping; no TC renumbered, added, or removed. Scope check: the plan adds no state-layer API (`readProviderParkViews` already exists at `packages/core/src/provider/parks.ts:504`; NFR-9/TC-033 remains one logical fold read), no config key, no state schema, no error row, no package/subpath/runtime-API location, and no secret-read allowlist entry (allowlist stays at four). The guard uses the existing `ExternalSystemInstance`/`ExternalSystemAuthMethod` contract and the existing CLI edge.

## Findings

1. **[major]** cross_artifact_consistency + test_traceability — `chg-GH-175-spec.md`#F-12 (line 154), #§6 flow 3 (164), #DEC-5 (389), #Appendix A changes-and-prs row (534; §8.3 row 249) vs `chg-GH-175-test-plan.md`#TC-STATUS-021 steps 7/9 (893, 895), #TC-STATUS-023 step 6 (964), #TC-STATUS-032 step 8 (1242), #TC-STATUS-013 step 5 (642) and `chg-GH-175-plan.md`#spellings (180), #D5 (202), #4.3 (403), #4.4 (404), #410, #5.4 (436), #6.4 (469)
   Gap: the remediation states that under a refused credential-less/anonymous instance "the tracker, changes-and-prs, and CI sections classify as `unknown`/`unavailable` … never `observed`". That is wrong for `changes-and-prs` whenever the local active change remains observed: the guard refuses only the GitHub reads, the active change comes from the local PM context and is unaffected, and the normative matrix (Appendix A; DM-3/DM-6) plus AC-F4-1 ("a partial source failure yields `degraded`") and TC-STATUS-013 step 5 all derive **`degraded`** for exactly that fixture (PR read failed, PM context observed). The control is therefore not jointly satisfiable as written: the restored control requires the dependent sections to reach `observed` (which requires an observed/observed-empty active change and a succeeded PR list), while the guarded assertion requires `changes-and-prs` to be `unknown`/`unavailable` in the same composition; no single fixture satisfies both for that section. Forcing `unknown` instead of `degraded` would also drop the observed active-change evidence, violating F-9/DM-3 and AC-F4-1. The same pre-existing claim appears in spec §6 flow 3 for a missing credential and should be corrected in the same pass. This is a new contradiction introduced by the iteration-2 remediation (the guard text), not a repeat of iteration-2's control-satisfiability finding.
   Suggested remediation target phase: test_planning (TC-021/023/032) and delivery_planning (4.3/4.4/5.4/6.4 + Phase 4 must) and specification (F-12/DEC-5/§6 flow 3 wording).
   Suggested fix: replace "`unknown`/`unavailable`" with "`degraded`/`unknown`/`unavailable`, never `observed`" everywhere, and pin per-section expectations: tracker `unknown`, CI `unknown`, `changes-and-prs` `degraded` when the active change is observed (reuse TC-STATUS-013's partial-failure fixture: PR read failed, PM context observed) and `unknown` when the active change is itself unknown/absent; state the restored control's per-section outcome explicitly (tracker/CI `observed`; `changes-and-prs` `degraded` while review signals are declared unavailable).

2. **[major]** plan_code_area_coverage — `chg-GH-175-plan.md`#Phase 2 Files and modules (352), #task 2.4 (342), #task 2.5 gate (343) vs `tests/behaviour/providers/github-inputs.test.ts` (lines 88–99) and `tests/types/provider-views.type-test.ts` (lines 36–40)
   Gap: task 2.1 changes `GithubClient.readPipelineRun` from `ProviderReadResult<readonly PipelineRun[]>` to `ProviderReadResult<{ items, pageItemCount }>`, but the blast radius lists only the trap suite. Two existing consumers break and are neither listed nor adapted: (a) `github-inputs.test.ts` binds `const runs = requireValue(await client.readPipelineRun(HEAD_SHA), …)` and then asserts `Array.isArray(runs)` and calls `runs.flatMap(...)` — it will fail inside the Phase 2 gate that task 2.5 explicitly runs; (b) `provider-views.type-test.ts` asserts `ReadValue<Awaited<ReturnType<GithubClient["readPipelineRun"]>>>` equals `readonly PipelineRun[]` — it will fail `pnpm typecheck`, which `pnpm check` runs as part of the same gate. The probe also encodes the ADR-0004 C-3 invariant "each client's declared read return is the primitive view", so its change needs an explicit posture statement rather than a silent edit.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: add both files to task 2.4/2.5 and the Phase 2 "Files and modules" list — `github-inputs.test.ts` unwraps `.items` for the job-state assertions and asserts `pageItemCount` equals the raw `check_runs` length; `provider-views.type-test.ts`'s `GithubPipelines` is updated to the inline `{ items, pageItemCount }` shape — and record one line that the shape is inline and not an exported wrapper type (ADR-0004 C-3 verification is the adapters' public exports), mirroring the existing `readPipelineRun`-keeps-its-name note.

3. **[minor]** test_traceability — `chg-GH-175-test-plan.md`#§3.1 AC-F12-1 row (line 106) vs `chg-GH-175-spec.md`#AC-F12-1 (line 449)
   Gap: the AC coverage row's abbreviated criterion adds "anonymous/credential-less instance refused at composition before any read", a clause that does not exist in spec AC-F12-1 (the guard is normative only in F-12/DEC-5). The table therefore attributes an unstated criterion to AC-F12-1; the guard has no AC of its own and its traceability runs through F-12 → TC-020/021.
   Suggested remediation target phase: test_planning (minimal) or specification (if the AC is extended).
   Suggested fix: drop the guard clause from the AC-F12-1 row and add it to the F-12 capability-coverage line, or extend AC-F12-1's Given/When/Then in the spec to include the composition guard (extending the existing AC, not adding a 25th).

4. **[nit]** cross_artifact_consistency — `chg-GH-175-test-plan.md`#TC-STATUS-021 Target Layer / Location (line 875) vs `chg-GH-175-plan.md`#mapping (548) and #task 4.4 (404)
   Gap: the plan places TC-STATUS-021's anonymous-guard/restored-control steps in `tests/behaviour/status-command.test.ts` (Phase 4), while the authoritative TC location list names only `tests/behaviour/providers/github-collection.test.ts`. The two-file split is visible only in the plan.
   Suggested remediation target phase: test_planning.
   Suggested fix: add the composition-control location to TC-STATUS-021's Target Layer / Location (as TC-STATUS-023/032 already name their single suites), or note the split in both artifacts.

## What Passed (evidence)

- The iteration-2 identity pin (1a) is genuinely closed in TC-017 and TC-029 and matches spec F-15/DM-4/DM-9/AC-F15-1 and plan evidence/reader/D8 text; `provider.chain.invalid` appears only as a forbidden identity.
- The composition guard (2) is now explicit, is enforced before client construction, yields zero transport/live requests, uses only the existing `config.credential.missing`/`config.value.invalid` codes, and is wired through the CLI edge, D5, tasks 4.3/4.4/5.4/6.4 and the Phase 4 acceptance criterion. It is expressible against the delivered `ExternalSystemAuthMethod` union.
- The credential-less/anonymous control (1b) no longer relies on client tolerance: it asserts zero requests, the composition-level refusal, and a non-vacuous restored control.
- Version references (3, 4) are current: spec §14/test-plan v1.4 align; GAP-1/A-T3 cite plan v1.3; no current claim of v1.2 or plan v1.1-only.
- Task 2.4 (5) adapts the trap-suite helpers and keeps the raw-page assertion live with fixture-true counts (4/1).
- Coverage is intact at 33 TCs / 24 ACs / 10 NFRs / 15 DMs; the CI at-limit rule, reachable TC-STATUS-002 fixture, trap/inventory blast radii (other than finding 2), DEC-6 change-local capture and the no-new-surface posture all still hold.
- No new subpath/package/runtime-API location, config key, state schema, error row, or secret-read allowlist entry is introduced by the remediation.

## Remediation Routing

- **test_planning**: R-1 (per-section expected states for the anonymous control in TC-021/023/032), R-3 (AC-F12-1 row), R-4 (TC-021 location).
- **delivery_planning**: R-1 (mirror the per-section expectations in 4.3/4.4/5.4/6.4 and the Phase 4 must), R-2 (adapt `github-inputs.test.ts` and `provider-views.type-test.ts`; add them to the Phase 2 code areas and state the ADR-0004 C-3 posture).
- **specification**: R-1 wording in F-12/DEC-5/§6 flow 3 (one phrase, three places); optionally R-3 by extending AC-F12-1.
- No finding reopens `delivery`. R-1 and R-2 are narrow, mechanical authoring corrections (one classification phrase across three artifacts; two test files plus one code-area bullet); nothing requires a design change, a new decision record, or a new AC.

## Escalation (iteration cap)

This is iteration 3 of the ~3-iteration cap and the verdict is still NOT_READY, so the workflow must not silently start a fourth authoring loop. `Pause Required: yes` is set for **process authorization only** — no domain decision is outstanding. Per `readiness-iter-2.md`'s re-run instruction this gate was expected to be READY; it is not, because the remediation introduced R-1 (a state-classification contradiction) and left R-2 (two unlisted `readPipelineRun` consumers) open. Recommended human choice: authorize one final, scoped authoring pass covering R-1..R-4 (no design reopening), or accept an explicit recorded deferral of R-2/R-4 to delivery with R-1 fixed before delivery (R-1 is a test/evidence-truthfulness defect and should not be deferred). The DoR override is not available here: the change adds behavior and touches contracts.

## Re-run Instruction

Re-run the gate only after the authorized pass. Expected READY condition: R-1's per-section states match Appendix A in all four artifacts; R-2's two files and the C-3 posture are named in Phase 2; R-3/R-4 resolved or explicitly deferred in `pm-notes`.
