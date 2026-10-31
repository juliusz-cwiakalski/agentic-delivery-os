# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-186
Date: 2026-10-31
Pause Required: no

Reviewer: @readiness-reviewer (local DoR mode). Inputs read in full: `chg-GH-186-spec.md` (v1.2), `chg-GH-186-test-plan.md` (v1.2), `chg-GH-186-plan.md` (v1.1), `chg-GH-186-pm-notes.yaml`, `readiness-review/readiness-iter-1.md`, ticket GH-186 (body and owner scope comment), backlog M0-S17, the bound decision records and index, the command registry, the forbidden-literal check and registry, the pm-notes/evidence corpus, and `tests/fixtures/pm-notes/corpus-exclusions.json`. No human-input decision surfaced; no pause flag.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking findings: 2 (Findings 1-2). Should-fix: 1 (Finding 3). Note: 1 (Finding 4).

## Iteration-1 Closure Matrix

| Iter-1 item | Status | Evidence |
|---|---|---|
| B1 — corpus ingestion / GH-171 / native date-time / closed vocabulary | CLOSED | Spec F-4 and DEC-14 define parse -> normalize -> classify; the change-row vocabulary is the closed five plus `no_ci_observation` as a CI-sample reason; GH-171 is a named `unparseable_yaml` row; the manifest is cited read-only. TC-MEAS-005/006/007 helpers accept native `datetime`/`date` and treat `00:00:00` as a placeholder. The census command reproduces exactly (below). |
| B2 — lifecycle order and AC trace | CLOSED | Plan dependency order is 1-9 delivery -> 10 doc-sync (lifecycle 7) -> 11 review (lifecycle 8) -> 12 conditional remediation -> 13 gates/DoD/PR. Phase 10.7 sweeps AC-F6-1 and the feature-spec half of AC-C10-1; Phase 11.1 re-traces all 21 ACs after doc-sync; the coverage ledger separates produced-in from verified-after-production. Residual: the spec's phase pointer in Finding 3. |
| B3 — TC-MEAS-007 included filter | CLOSED | TC-MEAS-007 step 1 now has `if not r["included"]: continue` and asserts GH-186 is absent from `vals`; TC-MEAS-005, TC-MEAS-006, TC-MEAS-008, and TC-MEAS-009 all filter on `included`. Residual: the sample-counter semantics in Finding 1 are a different defect. |
| S4 — same-commit registration sequencing | PARTIAL | Same-commit staging is normative in spec §18, PD-1, Phase 7/10, AC-F6-1, AC-C10-1, and TC-GATE-005; the sequencing is correct. The spec still points at "plan Phase 12" for doc-sync (Finding 3). |
| S5 — reproducible census | CLOSED | The Appendix-A command, re-run at HEAD `4d79116`, prints `{'files': 41, 'parseable': 40, 'timestamped_any': 30, 'timestamped_real': 24, 'date_only_files': 10, 'placeholder_zero_time_files': 6, 'unparseable': 1}`. The six placeholder-only files are GH-57/67/69/71/72/174; GH-171 fails parsing; 24 real-time minus GH-186 = 23 time-metric changes. |
| Note 6 — branch-authoritative naming | PERSISTENT | Test-plan preconditions still name `feat/GH-186/decision-records-measurement-baseline` (Finding 4). |
| Note 7 — clean-tree disposition | CLOSED | Phase 13.3 and PD-9 allow only PM-owned `.ai/local/**` and the change-folder pm-notes to be dirty/untracked; the coder must not stage them. |
| Note 8 — `ados_distribution` pin | CLOSED | `ados_distribution: internal` is pinned in spec F-6/AC-F6-1/Appendix B, plan Phase 10.1/PD-10, and TC-SYNC-002. |
| Note 9 — stale `implementation_plan` | CLOSED | Test-plan frontmatter now has `implementation_plan: ./chg-GH-186-plan.md`. |

## Grounding Verification

- **Ticket coverage — PASS.** The ticket's six named topics, the command-naming lock, and the measurement baseline all resolve to artifact requirements. The owner's issue comment (committed repository-local log; bind already-decided topics; four new records; prospective names lock; `Proposed` only; committed-evidence-only baseline) is reflected in the spec and pm-notes.
- **Four Proposed records — PASS.** Exactly ADR-0008, ADR-0009, ODR-0002, ODR-0003; next-free IDs verified against the tree (highest ADR is ADR-0007, highest ODR is ODR-0001); all `Proposed` with owner acceptance pending at PR review; no `Accepted` path.
- **Binding register — PASS.** Eight M0-S17 topics; the five existing bindings are the exact pinned ADR-0003/ADR-0005/ADR-0007/TDR-0003/TDR-0004 anchors; the three new-only bindings are harness, ID prefix scheme, and command naming; release model combines the existing direction with ADR-0009.
- **Command-name lock — PASS.** ODR-0003 records the prospective v1 freeze; the registry promotion is annotation-only; AC-F3-2/TC-DEC-015 require zero renames and byte-identical tables; `provider`, `provider-quota`, and `DeliveryRequest` are confirmed.
- **Measurement no-invention and reproducibility — FAIL at the procedure level.** The spec's definitions, closed vocabulary, UNAVAILABLE/PARTIAL semantics, and source-traceability rule are sound, and the census reproduces. Two test-plan procedures cannot pass against a correct log (Findings 1-2).
- **Hard constraints — PASS.** AC-C1-1/TC-GATE-001/TC-GATE-005 bound the diff to `doc/**` plus the single `registered` data addition; the check code, seed set, allowlist, scope classes, and `corpusBaseline` stay byte-identical; `packages/**` and `tools/**` are untouched.
- **Coverage completeness — PASS.** 21 ACs in all three artifacts; 37 TC headings with 37 detail sections; 21/21 AC coverage; 77 plan tasks; no orphan AC or TC.

## Findings

1. [critical] spec_completeness + test_traceability + cross_artifact_consistency — `chg-GH-186-spec.md` §8.3 DM-2 (line 304) and §5.1 Inclusion/exclusion rules (line 185); `chg-GH-186-plan.md` PD-4 (lines 55-60); `chg-GH-186-test-plan.md` TC-MEAS-005 step 4 (lines 1215-1223 and note at 1230), TC-MEAS-007 step 1 note (line 1413), TC-MEAS-008 step 1 (lines 1513-1514), and A-3 (line 2327).
   Gap: The `metric-row.sample` counter semantics contradict each other. DM-2 and spec line 185 define `sample.changes_excluded` as every spine-excluded row and `changes_parsed = changes_included + changes_excluded`; on the actual corpus that forces `changes_included = 23` for every metric (41 parsed, 18 excluded). But TC-MEAS-005 step 4 hard-codes that spine arithmetic for all metrics, TC-MEAS-007 requires the cycle metric's `changes_included` to equal the included rows with a usable `clarify_scope.started` (20, not 23), and TC-MEAS-008 requires the CI metric's `changes_included` to equal the observed denominator (less than 23 whenever any included row is unobserved). The corpus makes the cycle case unavoidable: GH-177, GH-185, and GH-188 are included but have no usable `clarify_scope.started`, so the cycle sample is 20 while ceremony is 23. DM-2 has no field for the three metric-excluded cycle rows, so no single log can satisfy TC-MEAS-005, TC-MEAS-007, and TC-MEAS-008 simultaneously.
   Suggested remediation target phase: specification (DM-2 sample-counter semantics; add a metric-specific counter such as `sample.rows_excluded` or `aggregates.n`, or state that `changes_included`/`changes_excluded` are the spine counts and metric samples are reported separately), then test_planning (TC-MEAS-005/007/008) and delivery_planning (PD-4/Phase 6/7) alignment.
   Suggested fix: Pin in DM-2 exactly what `changes_parsed`, `changes_included`, `changes_excluded`, and `excluded_unobserved` mean per metric and how conservation holds. Then make TC-MEAS-005 step 4 metric-aware and align TC-MEAS-007/TC-MEAS-008 with the pinned fields.

2. [critical] test_traceability + cross_artifact_consistency — `chg-GH-186-test-plan.md` TC-MEAS-006 step 2 (lines 1305-1336, especially `num=den=0.0` at 1319 and `assert q(ratio,dp)==val` at 1336); `chg-GH-186-spec.md` F-4 ceremony formula (line 178); `chg-GH-186-plan.md` PD-5 (line 61) and Phase 6.4 (line 388).
   Gap: TC-MEAS-006 step 2 sums unrounded per-pair hours into `num`/`den` and compares `q(num/den, dp)` to the recorded `value`. Spec F-4 defines `Σ ceremony_duration_h / Σ total_phase_duration_h` over change rows, and PD-5/Phase 6.4 define `numerator`/`denominator` as sums of the recorded 1-decimal per-change hours. On the actual corpus the two methods diverge at 6 decimal places: raw sums give 0.406438, recorded-row sums give 0.406648. A PD-5-compliant log therefore fails TC-MEAS-006 step 2, while TC-MEAS-006 step 3 (`q(numerator/denominator, dp) == value`) passes. The delivery would be pressured to record raw sums, violating PD-5 and the spec formula.
   Suggested remediation target phase: test_planning.
   Suggested fix: Compute `num`/`den` from the recorded per-change fields (`r["ceremony_duration_h"]`, `r["total_phase_duration_h"]`) or from `q(cer)`/`q(tot)`, and keep step 3 as the second assertion. Add a sentence that the aggregate is taken over the recorded 1-decimal rows, not over unrounded pair sums.

3. [major] cross_artifact_consistency — `chg-GH-186-spec.md` §18 Registration staging (line 476) vs `chg-GH-186-plan.md` v1.1 Phase 10/PD-1.
   Gap: The spec says the feature spec and its `registered` entry are committed "in the same doc-sync commit (plan Phase 12)". After the B2 remediation, doc-sync is plan Phase 10; Phase 12 is conditional post-review remediation. The normative same-commit rule is right, but the stale phase pointer misdirects the doc-syncer/coder and is a new inconsistency introduced by the plan reorder.
   Suggested remediation target phase: specification.
   Suggested fix: Change "(plan Phase 12)" to "(plan Phase 10)" or drop the parenthetical; the plan and PD-1 already carry the authoritative sequencing.

4. [minor] cross_artifact_consistency — `chg-GH-186-test-plan.md` TC-DEC-001 preconditions (line 228) and TC-GATE-001 preconditions (line 1925) vs spec §18, plan Context (line 36), and the checked-out branch.
   Gap: The test plan still names `feat/GH-186/decision-records-measurement-baseline`; the authoritative branch is `feat/GH-186/decision-records-and-measurement-baseline` (the current branch, spec §18, and the plan). Iteration-1 finding 6 persists in the test plan; a tester following the precondition would check out a nonexistent branch.
   Suggested remediation target phase: test_planning.
   Suggested fix: Replace both precondition strings with `feat/GH-186/decision-records-and-measurement-baseline`, or use "the GH-186 feature branch".

## Decision Routing

No `needs_human_input` decisions surfaced. All four findings are authoring corrections within the existing decision set; none requires a new decision record. The spec/plan decisions (DEC-13, DEC-14, PD-1, PD-4, PD-5) remain the right homes for the fixes.

## Gate Result

NOT_READY.

Reopen **specification** first for Finding 1 (DM-2 sample-counter semantics) and Finding 3 (§18 stale plan-phase pointer). Then reopen **test_planning** for Findings 1, 2, and 4 (TC-MEAS-005/006/007/008 procedures; TC-DEC-001 and TC-GATE-001 preconditions). Reopen **delivery_planning** only to align PD-4/Phase 6/7 if the DM-2 fix adds or renames a metric-specific counter. Do not reopen delivery and do not start implementation.

This is iteration 2 of a maximum of 3. Re-run the gate after the revisions; no human escalation is required for these findings.
