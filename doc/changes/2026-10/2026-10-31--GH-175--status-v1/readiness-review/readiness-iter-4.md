# Readiness Review Iteration 4

Verdict: NOT_READY
Work Item: GH-175
Date: 2026-10-31
Pause Required: yes (PM-authorized single re-gate failed; delivery must stop for human input)

## Inputs Reviewed

- `chg-GH-175-spec.md` (v1.5, `last_updated` 2026-10-31), `chg-GH-175-test-plan.md` (v1.5, `last_updated` 2026-10-31T18:30:00Z), `chg-GH-175-plan.md` (v1.4, `last_updated` 2026-10-31T18:40:00Z), `chg-GH-175-pm-notes.yaml`.
- Prior readiness records: `readiness-review/readiness-iter-1.md`, `readiness-iter-2.md`, `readiness-iter-3.md`.
- Ticket GH-175 (`M0-S6: status v1`); both ticket ACs remain mapped in spec §17.
- Current-truth/system inputs used to verify claims: `doc/spec/features/{feature-provider-client-seeds,feature-state-layer,feature-provider-engine,feature-config-layer,feature-result-contract,feature-monorepo-scaffold-toolchain}.md`; `doc/decisions/ADR-0004*`; `packages/core/src/contracts/{ports,error-table}.ts`; `packages/core/src/provider/parks.ts` (`readProviderParkViews`); `packages/adapters/src/github/client.ts`; `tests/behaviour/providers/github-inputs.test.ts`; `tests/types/provider-views.type-test.ts`; `package.json` (`pnpm check` → `typecheck` includes `tests/types/tsconfig.json`); `tests/checks/secret-read-boundary.test.ts`.

## Disposition of Iteration-3 Findings

| # | Label | Disposition | Evidence |
|---|---|---|---|
| R-1 | Major — anonymous/credential-less guard per-section states | **PARTIAL — guard case FIXED, restored-control tracker pin still inconsistent** | The guard case is now consistent across spec F-12 (line 154), DEC-5 (389), §6 flow 3 (164), §12 (339), test plan TC-021 step 7 (893), TC-023 step 6 (964), TC-032 step 8 (1242), and plan D5 (202), 4.3 (403), 4.4 (404), 5.4 (436), 6.4 (469), Phase 4 AC (410): `tracker` `unknown`, `ci` `unknown`, `changes-and-prs` `degraded` while the active change is observed, `unknown`/`unavailable` only when the active-change source is unusable, never `observed`. **Residual defect (finding 1):** the restored credential-reference control pins `tracker` `observed` on the GitHub slice in spec F-12, test plan TC-021 step 9 / TC-023 step 7 / TC-032 step 9, and plan D5/4.3/4.4/5.4/6.4, while the GitHub slice declares blocked-dependency relations unavailable. |
| R-2 | Major — `readPipelineRun` return-shape consumers + ADR-0004 C-3 posture | **FIXED** | Plan task 2.1 (339) names both broken consumers; task 2.4 (342) adapts `tests/behaviour/providers/github-inputs.test.ts` (unwrap `.items`, keep `pageItemCount` equal to raw `check_runs` length) and `tests/types/provider-views.type-test.ts` (inline `{ items: readonly PipelineRun[]; pageItemCount: number }` probe); task 2.5 (343) includes `github-inputs.test.ts` in the focused gate and explains `pnpm check` → `typecheck` compiles `tests/types/tsconfig.json`; Phase 2 Files and modules (352) lists both files; the ADR-0004 C-3 inline-shape/no-parallel-surface posture is stated in 2.1 and 2.4. The delivered consumer code matches the described breakage (`Array.isArray(runs)`, `runs.flatMap`, `GithubPipelines = readonly PipelineRun[]`). |
| R-3 | Minor — test-plan §3.1 AC-F12-1 row | **FIXED** | The AC-F12-1 row (test plan line 106) is scoped to repository binding (`origin` HTTPS/SSH, no userinfo/credentials, unavailable forms, downstream reasons, no new key/remote) and no longer carries the anonymous-guard clause. The guard is traced to F-12/DEC-5 in the capability-coverage line (112) and in TC-021's Related IDs (872). |
| R-4 | Nit — TC-021 target location | **FIXED** | TC-021 Target Layer / Location (875) names `tests/behaviour/providers/github-collection.test.ts` (read-side steps 1–6, 8) plus `tests/behaviour/status-command.test.ts` (composition-guard/restored-control steps 7, 9); the §7 automation row (1346) and execution order (1363, 1368) repeat the split. |

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Counts: **0 critical, 1 major, 0 minor, 0 nit**.

## Findings

1. **[major]** cross_artifact_consistency + test_traceability — `chg-GH-175-spec.md`#F-12 (line 154, restored-control sentence) and #Appendix A tracker row (533) / #§6 flow 7 (168) / #Appendix D GitHub blocked-dependency row (599) / #Appendix E example (625); `chg-GH-175-test-plan.md`#TC-STATUS-021 step 9 (895), #TC-STATUS-023 step 7 (965), #TC-STATUS-032 step 9 (1243) vs #TC-STATUS-010 step 6 (554) and #TC-STATUS-004 precondition (350); `chg-GH-175-plan.md`#D5 (202), #4.3 (403), #4.4 (404), #5.4 (436), #6.4 (469), #Phase 4 acceptance criterion (410)
   Gap: the restored credential-reference control is described as the same composition / GitHub slice and pins `tracker` `observed`. The same GitHub slice declares blocked-dependency relations unavailable (spec §2.1, F-3, Appendix D; plan D5 wraps the list read with `blockedDependencies: "unavailable"`). Appendix A derives `tracker` `degraded` when the issues read succeeds but at least one family signal is unavailable; §6 flow 7 pins `tracker` `degraded` when blocked-dependency relations are unavailable; the Appendix E example shows `tracker degraded ... blocked unavailable`; and TC-STATUS-010 step 6 says the GitHub tracker section "follows the matrix". The restored-control assertion is therefore not a normal Appendix A state and is not jointly satisfiable with the same TC's step 3/TC-STATUS-010 without bypassing the declared availability. `ci` `observed` and `changes-and-prs` `degraded` in the restored control are correct; only `tracker` is wrong. This is a residual defect in the R-1 remediation area (not newly introduced by the authorized pass; it was retained from the earlier restored-control text and missed in iteration 3).
   Suggested remediation target phase: specification (F-12/DEC-5 restored-control wording), test_planning (TC-021/023/032 restored-control steps and §7 automation rows), delivery_planning (D5/4.3/4.4/5.4/6.4 and the Phase 4 acceptance criterion).
   Suggested fix: pin `tracker` `degraded` on the GitHub slice because blocked-dependency relations are unavailable (`signal-unavailable`), with `tracker` `observed` only when the bound source declares all four family signals available. Keep `ci` `observed` and `changes-and-prs` `degraded` while review state/threads are unavailable. If the restored control is deliberately a non-GitHub all-available tracker fixture, say so explicitly and stop identifying it with the GitHub slice/same composition, and reconcile that with the edge's declared `blockedDependencies: "unavailable"`; the spec-consistent fix is the `tracker` `degraded` pin.

## What Passed (evidence)

- R-2 is genuinely closed: both existing `readPipelineRun` consumers are named in Phase 2, explicitly adapted to the `{ items, pageItemCount }` return, and the Phase 2 gate compiles `tests/types/tsconfig.json`; the inline-shape/no-parallel-surface ADR-0004 C-3 posture is stated.
- R-3 is closed: the AC-F12-1 row is repository-binding-scoped, and the guard traceability runs through F-12/DEC-5.
- R-4 is closed: TC-021's two-file split is in the Target Layer / Location, the §7 automation row, and the execution order.
- R-1's guard case is closed: the anonymous/credential-less guard pins `tracker` `unknown`, `ci` `unknown`, and `changes-and-prs` `degraded` while the active change is observed, with `unknown`/`unavailable` only when the active-change source is unusable, and never `observed`, across all four artifacts.
- Coverage is intact: 33/33 TCs, 24/24 ACs, 10/10 NFRs, 15/15 DMs; no TC renumbered, added, or removed.
- Scope is intact: no new state API (`readProviderParkViews` exists at `packages/core/src/provider/parks.ts:504`; NFR-9 remains one logical fold read), no new config key, no state-schema change, no new error row (`config.credential.missing` and `config.value.invalid` already exist; `provider.chain.invalid` remains a forbidden identity), no new package/subpath/runtime-API location, and the secret-read allowlist remains four entries.
- The plan is structurally executable (Phases 1–7, task ordering, gates, evidence commands); the only blocker is the restored-control state pin, which is a narrow authoring correction, not a design change.

## Remediation Routing

- **specification**: finding 1 — F-12/DEC-5 restored-control sentence (and any matching §6 assumption/flow wording).
- **test_planning**: finding 1 — TC-STATUS-021 step 9, TC-STATUS-023 step 7, TC-STATUS-032 step 9, and the §7 automation rows.
- **delivery_planning**: finding 1 — D5, tasks 4.3/4.4/5.4/6.4, and the Phase 4 acceptance criterion.
- No finding reopens `delivery`. The DoR override is **not** available: the change adds behavior and touches contracts, so it is not genuinely trivial.

## Authorized Re-gate Outcome

The PM-authorized single re-gate has been consumed and **failed**. Per the authorization, delivery must not proceed and must stop for human input. This is not a silent fourth authoring loop. Human options: (a) authorize one further scoped authoring pass limited to the restored-control `tracker` state pin across the three artifacts, followed by a re-gate; or (b) explicitly defer/record the restored-control evidence question. A silent continuation or an override is not permitted. R-1's guard case, R-2, R-3, and R-4 require no further work.
