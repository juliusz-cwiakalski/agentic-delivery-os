# Readiness review — iteration 1 (GH-313)

Verdict: NOT_READY
Date: 2026-11-14
Artifacts reviewed: chg-GH-313-spec.md, chg-GH-313-test-plan.md, chg-GH-313-plan.yaml, chg-GH-313-pm-notes.yaml, PDR-0005 (draft), issue #313.

Facet summary: spec_completeness PASS, ac_quality PASS, plan_coverage FAIL, test_traceability FAIL, cross_artifact_consistency FAIL, decision_capture FAIL, system_spec_consistency PASS, plan_doc_update_coverage PASS, plan_code_area_coverage FAIL, dod_defined PASS.

Findings and disposition:

1. CRITICAL cross_artifact_consistency — the test plan still carried five open TP-Q items after the plan pinned them and the spec clarified the ACs; §2 called the plan pending; §9 stayed v1.0; the plan header mis-stated when TP-Q3/Q4 were clarified. Disposition: test plan revised to 1.1; plan header corrected.
2. CRITICAL plan_coverage — phase 1 asserted the pack `## Conventions` edit owned by phase 5; phase 2 asserted the `@spec-writer` prompt edit owned by phase 3. Disposition: the pack-conventions edit moved to phase 1; TC-TPL-002 moved to the prompts suite.
3. CRITICAL plan_code_area_coverage — `scripts/add-header-location.sh doc/guides` rewrites the existing headerless guide outside every declared scope. Disposition: the script now runs on the single new file only, with an explicit byte-identity obligation for the unrelated guide.
4. MAJOR plan_code_area_coverage — no production GitHub adapter module was scoped, so the workflow could not perform live reads/writes. Disposition: `scripts/checks/milestone-attachment-github.ts` added to phase 4 as the sole network-capable module.
5. MAJOR plan_coverage — a live sweep run was not producible before the PR (workflow exists only on the branch). Disposition: spec DoD-10/C-12 accept a recorded local read-only adapter run or the first post-merge run; phase 4 runs the sweep locally.
6. MAJOR test_traceability — TC-EVID-001 mis-modelled attached-but-undeclared tickets. Disposition: declared-vs-attached model plus a non-failing attached-but-undeclared report.
7. MAJOR test_traceability — TC-GUIDE-001 weakened the header rule and miscounted lines. Disposition: byte-for-byte assertion against the script output, unconditional.
8. MAJOR test_traceability — stale relative link and template filename. Disposition: corrected.
9. MAJOR decision_capture — public label names remained TO-CONFIRM. Disposition: PM decision under autonomous mode adopts `needs-milestone` and `backlog-capture`; reversible at the PR gate; recorded in the spec and PDR-0005.
10. MINOR plan_coverage — the M2 pack-contents line (S2-S20) was missing from phase 5. Disposition: added.
11. MINOR cross_artifact_consistency — stale Appendix B row references. Disposition: corrected to rows 1-34 / 25-31 / 34.
12. MINOR test_traceability — TC-SCOPE-001 allowed set too narrow; workflow "required check" assertion misplaced; constraint citations conflated. Disposition: corrected with namespaced citations.
