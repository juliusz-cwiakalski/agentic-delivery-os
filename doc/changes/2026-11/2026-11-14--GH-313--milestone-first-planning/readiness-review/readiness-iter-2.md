# Readiness review — iteration 2 (GH-313)

Verdict: NOT_READY
Date: 2026-11-14
Artifacts reviewed: remediated spec, test plan 1.1, plan 1.1, PDR-0005, pm-notes, issue #313.

Facet summary: spec_completeness FAIL, ac_quality FAIL, plan_coverage FAIL, test_traceability FAIL, cross_artifact_consistency FAIL, decision_capture FAIL, system_spec_consistency FAIL, plan_doc_update_coverage PASS, plan_code_area_coverage PASS, dod_defined PASS.

Findings and disposition:

1. CRITICAL — the specified event set made an edited or labeled pre-existing unattached issue get flagged and written, contradicting the "existing debt is never mutated" rule. Disposition: the check's action set is narrowed by a canonical ordered decision table; flag writes occur only on `opened` and on `demilestoned` when the check's marker comment already exists.
2. MAJOR — the decision table overlapped because it lacked flag-label and marker-comment dimensions and an exemption precedence rule. Disposition: canonical table gains `needs-milestone` and marker dimensions plus explicit precedence (exemption > milestone > event).
3. MAJOR — "applied at most once" conflicted with restoration after detach. Disposition: qualified to at most once per flag-present state; restoration after a milestone detach is a new application; a manual label removal is respected and never re-applied.
4. MAJOR — plan 4.7 wrote phase 6's evidence file outside phase 4's scope. Disposition: phase 4 runs the sweep and reports the artifact path and summary only; phase 6 writes the evidence file.
5. MAJOR — `.ai/agent/pm-instructions.md` "Backlog Source of Truth" contradicts the committed planning mirror the change edits. Disposition: the section is reconciled in phase 3 (tracker = ticket backlog source; `doc/planning/oss-tooling/backlog.md` = committed planning mirror) with a prompt-suite assertion.
6. MAJOR — TC-EVID-001's "attached count" was undefined against attached-but-undeclared members. Disposition: renamed to declared-and-attached; total attached = declared-and-attached + attached-but-undeclared.
7. MAJOR — TC-PLAN-001's M2 assertion was a tautology. Disposition: the M2 baseline set is added to the committed heading fixture and compared.
8. MAJOR — the spec's job-summary requirement had no workflow obligation or test. Disposition: phase 4.4 gains the `$GITHUB_STEP_SUMMARY` obligation and the workflow suite asserts it.
9. MINOR — TC-PLAN-004 seed-count inconsistency. Disposition: the M2-S20 row must cite all five seeds.
10. MINOR — TC-SCOPE-001 omitted `readiness-review/`. Disposition: added to the allowed set.
11. MINOR — TC-GUIDE-001 asserted a wildcard PDR link. Disposition: exact record path.

Non-blocking note: "53 open" is a planning-time snapshot; the live count at iteration 2 was 42 open unattached `change` issues out of 94. Evidence artifacts label the figure as planning-time.
