# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-187
Date: 2026-10-31
Pause Required: no

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking findings: 1. Non-blocking findings: 7. No override record exists, and none would be available for a behavioral/contract change.

## Resolution of Iteration-1 Blocking Findings

1. **DoD missing — RESOLVED with a residual wording defect (non-blocking finding 2).** Spec v1.2 §18.1 (L357-371) now defines ten testable change-specific DoD predicates, and plan Phase 8 references §18.1 (L455, L463, L469). The DoD exists and is traceable. Its `pnpm check` wording is inaccurate (non-blocking finding 2).
2. **Pre-existing test count 12 vs 13 — RESOLVED.** Spec/test plan/plan now say 13; plan L175/L183/L199/L218/L224/L243 and test plan L66/L220/L1141 require all 13 titles; TC-LICREG-029 step 1 remains the dynamic authority.
3. **ADR-0003 C-2 decision capture — RESOLVED.** `doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md` exists (Proposed; `decision_date: null`), is indexed in `doc/decisions/00-index.md` L29, and explicitly clarifies ADR-0003 C-2 without amending or superseding it. Plan Phase 6 now adds tasks 6.4/6.5 (L386-387) to cite TDR-0007 as Proposed and to keep an ADR-0003 editorial cross-reference as a separate owner-authorized change. The ADR literal text remains unchanged, which is the recorded boundary rather than silent drift.
4. **TC-LICREG-013 impossible expectation / 20-vs-25 removals — PARTIALLY RESOLVED; plan residual is the blocking finding below.** Test plan v1.3 TC-LICREG-013 step 5 (L673) now expects only the mandatory-floor failure and no overlap/denial; step 7 (L675) and §4.6 (L228) require 25 removal cases. Plan task 2.2 (L217) says 20 single + 5 adversarial. However, plan task 2.1 (L216) still declares `floor 20`, and plan Phase 2 acceptance (L223) still says `20/20 floor removals`. That is a direct contradiction with the test plan and with the plan's own task 2.2.

Iteration-1 non-blocking findings were also re-checked: TC-LICREG-026 is now 13 representatives (test plan L1052/L1056/L1273); the scope check is preserved in spec CON-10/AC-F1-3, test plan TC-LICREG-031, and plan tasks 1.2/1.3; M4-S2 vs M4-S3 ownership is corrected in spec/plan/test plan; the deny-list extension wording is fixed to "at least the 20" (plan L170). These are resolved.

## Blocking Finding

1. [major] cross_artifact_consistency — `chg-GH-187-plan.md` task 2.1 (L216) and Phase 2 acceptance (L223); `chg-GH-187-test-plan.md` TC-LICREG-013 step 7 (L675), TC-LICREG-024 (L999), §4.6 (L228); `chg-GH-187-plan.md` task 2.2 (L217)
   Gap: Plan task 2.1 declares the `deny-list-cases.json` fixture class as `floor 20`, and plan Phase 2 acceptance declares `20/20 floor removals`. Test plan v1.3 requires `floor 25` (20 single removals + 5 adversarial removals) in TC-LICREG-024 (L999), asserts 25 removal cases in TC-LICREG-013 step 7 (L675), and states 25/25 in §4.6 (L228). Plan task 2.2 (L217) already says "20 single removals plus 5 adversarial removals". The plan therefore contradicts the test plan and itself: a fixture built to task 2.1's `floor 20` fails the TC-LICREG-024 meta-check and the TC-LICREG-013 count assertion. The remediation updated the test plan to 25, but these plan lines were not updated.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Change plan task 2.1 `floor 20` to `floor 25` and change Phase 2 acceptance `20/20 floor removals` to `25/25 removal cases (20 single + 5 adversarial)` (or remove the count from the acceptance line and point to TC-LICREG-013 step 7). Align every remaining `floor 20` / `20/20 floor` occurrence in the plan with the test plan's 25.

## Non-Blocking Findings

2. [major] dod_defined — `chg-GH-187-spec.md` §18.1 (L365)
   Gap: The DoD says "`pnpm check` passes, including the inherited bash suites and the `ts-license-audit` command". `pnpm check` is the pinned chain `lint → format:check → typecheck → test → check:boundaries → exports-parity` (root `package.json` L18); it does not run the inherited bash suites or the standalone `bun run scripts/checks/license-audit.ts`. The plan Phase 5/8 correctly runs those separately, so the DoD is still operationally testable, but the predicate's command grouping is false and could be used to mark the battery green without the bash/audit evidence.
   Suggested remediation target phase: specification
   Suggested fix: Reword the predicate to "The full gate battery is green: `pnpm check`, `bash scripts/.tests/test-*.sh`, `bash tools/.tests/test-*.sh`, the four invariant scripts, and `bun run scripts/checks/license-audit.ts`; the `ts-license-audit` job remains required and green."

3. [minor] cross_artifact_consistency — `chg-GH-187-spec.md` §18.1 (L362)
   Gap: The wrong-scope DoD predicate cites "(TC-LICREG-001/004 family)", but the test plan adds the dedicated wrong-scope case as **TC-LICREG-031** (test plan L1185, L1287; plan L173/L219/L463). TC-LICREG-001/004 do not assert a wrong-scope failure.
   Suggested remediation target phase: specification
   Suggested fix: Replace the parenthetical with `TC-LICREG-031`.

4. [minor] cross_artifact_consistency — `chg-GH-187-test-plan.md` §7 row TC-LICREG-016 (L1272) vs TC-LICREG-016 steps (L755) and expected outcome (L764)
   Gap: §7 says "13 non-asserted/empty/unparseable cases + `NONE`", which reads as 14 cases. TC-LICREG-016 step 1 explicitly lists **12** cases and step 3 adds `NONE`, for **13 total**; the expected outcome says 12/12 listed + `NONE` = 13. Plan task 2.3 (L218) says 13 values. The automation row is one case-count drift.
   Suggested remediation target phase: test_planning
   Suggested fix: Change the §7 row to "12 listed non-asserted/empty/reference/unparseable cases + `NONE` (13 total)" or equivalent, matching the TC detail.

5. [minor] test_traceability — `chg-GH-187-test-plan.md` §7 execution order (L1291-1299)
   Gap: The execution-order list omits TC-LICREG-031. The TC is mapped in §7 (L1287), the AC/DM tables (L80/L113), and plan task 2.2 (L217), so coverage is not lost, but the ordered evidence run does not place the new wrong-scope case in the schema/policy-integrity group.
   Suggested remediation target phase: test_planning
   Suggested fix: Add TC-LICREG-031 to the "Schema and policy integrity" step (L1294) and keep the total 31/31 visible.

6. [nit] cross_artifact_consistency — `chg-GH-187-plan.md` RSK-P2 (L137)
   Gap: RSK-P2 still says "the resolved test-plan v1.1 binding", while the current test plan is v1.3 and the plan's own Context (L27) and revision log (L596) cite v1.3. The counts in RSK-P2 (18 malformed, 10 spawned) remain correct; only the version is stale.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Change `v1.1` to `v1.3`.

7. [nit] decision_capture — `doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md` frontmatter summary (L8) and Decision (L210)
   Gap: TDR-0007's summary and Decision say a branch must be "known, not denied, and allow-listed" / "unknown, denied, or non-allow-listed", omitting **non-asserted**, while its own constraint C-1 and spec CON-3/Appendix C explicitly include `NOASSERTION`, `SEE LICENSE`, and non-asserted values. C-1 closes the behavioral gap, so this is a wording inconsistency in the decision record, not a behavior change.
   Suggested remediation target phase: specification
   Suggested fix: Add "non-asserted" to the summary and Decision wording (or state that a non-asserted branch is rejected under C-1) so the record matches CON-3/Appendix C.

8. [nit] test_traceability — `chg-GH-187-test-plan.md` §3.3 NFR-6 row (L129)
   Gap: NFR-6 ("100% of failures name package/use/license/reason; no uncaught stack trace") cites TC-LICREG-022, 026, and 010 but not TC-LICREG-031, even though TC-LICREG-031 asserts the wrong-scope diagnostic (observed scope + supported value) and is in the §4.2 schema/scope class. TC-LICREG-031 itself covers the behavior; the NFR evidence row is incomplete.
   Suggested remediation target phase: test_planning
   Suggested fix: Add TC-LICREG-031 to the NFR-6 row, or explicitly note that the schema/scope representative is covered by TC-LICREG-026 plus TC-LICREG-031.

## Verification Performed

- Re-loaded the live ticket GH-187 via `gh`: OPEN, labels `change` + `planning`, no assignee/comments; body unchanged and matches backlog M0-S18 (`doc/planning/oss-tooling/backlog.md` L353-361).
- Re-verified live repository facts: `doc/legal/dependency-licenses.yaml` still has schema 2, 16 `package:` entries, 20 registered uses, four-entry allow list, and no deny list (the change is still pre-delivery); `doc/legal/` has exactly one file; `tests/checks/license-audit.test.ts` still has 13 tests; `ts-license-audit` still runs `bun run scripts/checks/license-audit.ts` with `permissions.contents: read`, no timeout, no bypass; `TS_JOBS` 16 + `BASH_JOBS` 7 = 23 workflow jobs; root `scripts.check` chain unchanged; Bun 1.4.4 / pnpm 10.18.3 unchanged; lockfile ~59 KB.
- Read `doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md`: status `Proposed`, `decision_date: null`, owner acceptance pending at PR; it clarifies (not amends/supersedes) ADR-0003 C-2, references GH-187/GH-170, and is indexed at `doc/decisions/00-index.md` L29. The plan's Phase 6 tasks 6.4/6.5 correctly keep it Proposed and defer an ADR-0003 editorial cross-reference to a separate owner-authorized change.
- Re-verified counts and traceability: spec §18.1 is present; test plan has 15 AC rows and 31 TC rows; plan has 33 tasks; all 31 `TC-LICREG-###` IDs appear in the plan; all 15 ACs map to TCs; the 18 malformed, 10 spawned, 13 pre-existing-test, and 31-TC totals agree across the test plan and plan except for the blocking plan `floor 20` / `20/20 floor removals` residue.
- Checked for regressions introduced by the remediation: TDR-0007 is a new Proposed record (no premature acceptance claim); spec/plan/test plan milestone ownership is M4-S2 for release artifacts and M4-S3 for registry completeness/public materials; scope preservation is in spec CON-10/AC-F1-3, test plan TC-LICREG-031, and plan tasks 1.2/1.3; the `.opencode`/source tree was not touched.
- Prior readiness records: iteration 1 under `readiness-review/readiness-iter-1.md`; this is iteration 2. No source, spec, test-plan, plan, pm-notes, or decision-record file was edited by this review.

## Gate Result

**NOT_READY.** The iteration-1 blocking findings are substantively resolved: the DoD exists, the 13-test count is fixed, TDR-0007 captures the ADR-0003 C-2 interpretation without claiming acceptance, and TC-LICREG-013/TC-LICREG-026 are corrected. One blocking contradiction remains: the plan still instructs `floor 20` and `20/20 floor removals` while the test plan requires 25 removal cases (20 single + 5 adversarial), so a fixture built to the plan fails TC-LICREG-013 and TC-LICREG-024.

Reopen **`delivery_planning`** to correct plan task 2.1 (L216) and Phase 2 acceptance (L223) to 25/25 (20 single + 5 adversarial). The non-blocking findings target **`specification`** (DoD command wording L365 and TC-LICREG-031 reference L362; TDR-0007 summary/Decision wording) and **`test_planning`** (TC-LICREG-016 §7 count L1272; execution order L1294; NFR-6 row L129). Delivery is blocked; no override applies and no human-input pause is required at this gate.
