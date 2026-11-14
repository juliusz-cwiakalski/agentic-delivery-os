# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-302
Date: 2026-11-14
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

## Findings

1. [major] cross_artifact_consistency — chg-GH-302-plan.yaml#SOURCES-header (line 44) + #phase-1-content-obligation-1.4 (lines 265-271) + #phase-1-summary (line 320 — parsed YAML content) — **persistent** (plan-side residue of iteration-1 finding 2, which was remediated in spec and test plan only)
   Gap: Plan revision 1.1 synced findings 4/5 and the test-plan v1.2 TC additions but NOT the spec v1.2 twelve-class kernel contract. Verified stale locations: (a) SOURCES header still cites "Spec: ./chg-GH-302-spec.md (v1.1; …)" — the spec is v1.2 with the twelve-class DM-2/AC-F2-1 and the §17.1 DoD; (b) obligation 1.4 still enumerates "ALL TEN content classes" with the old list (evidence bar and supersede-never-rewrite as separate classes; no advisory/untrusted preamble, unique ids, conflict reality, or growth/split rule); (c) the phase-1 `summary: >-` — parsed, executor-facing content — says "AGENTS.md kernel section with all ten content classes". Zero "twelve" occurrences in the plan. Consequence: a coder executing phase 1 faithfully from the plan authors a ten-class kernel template that then fails TC-MEMKERN-001 (twelve anchors, landed phase 4) and the TC-MEMKERN-003 side-by-side fidelity review — the binding C-1 mirror constraint is broken by the plan's own instruction, discovered two phases late.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Mechanical sync in all three locations: replace the ten-class enumeration with the spec v1.2 twelve-class list (advisory/untrusted preamble; canonical+ephemeral locations; read policy; capture bar; write ownership; evidence over recency with supersede-never-rewrite merged; unique ids; reviewer independence; caps and growth incl. the ~50-line topic-file split rule; promotion handoff; capsule completion; conflict reality) in obligation 1.4 and the phase-1 summary; update the SOURCES citation to spec v1.2 and acknowledge §17.1 as the dod_check contract the five phases must satisfy.

2. [nit] spec_completeness — chg-GH-302-spec.md#Appendix-A (source-mapping table)
   Gap: The v1.2 remediation extended F-2/DM-2/AC-F2-1/DoD-2 to twelve classes but Appendix A's mapping table still carries only the pre-v1.2 eight rows — no rows for the advisory/untrusted preamble, unique ids, the caps-and-growth split rule, or conflict reality (all → kernel section F-2). Internally inconsistent with §5.1/§8.3; a fidelity reviewer using Appendix A as the checklist under-checks against the twelve-class standard.
   Suggested remediation target phase: specification
   Suggested fix: Extend Appendix A with the four missing class rows (or replace the enumeration with a pointer to DM-2 as the authoritative list).

3. [nit] test_traceability — chg-GH-302-test-plan.md#TC-MEMRESUME-002 (and §5.1 index row) vs chg-GH-302-spec.md#4.1-Success-Metrics-row-1 — **persistent** (iteration-1 finding 7, claimed fixed but not)
   Gap: The v1.2 revision log claims "made TC-MEMRESUME-001/002 dry-run coverage explicit"; the added TC-MEMRESUME-001 note (line 710) makes the resume-probe path explicit but says nothing about flows — zero occurrences of "legacy", "either flow", "both flows", or any flow-agnostic rationale anywhere in the test plan. The spec's success metric still demands the capability set present "in both `new` and `legacy` flows" while the single dry-run still does not state which flow it exercises or why the other is covered.
   Suggested remediation target phase: test_planning
   Suggested fix: State in TC-MEMRESUME-002 which flow the dry-run exercises and the rationale that the Phase 5 memory wiring is flow-agnostic (or run both flows).

## Notes

- Iteration-1 findings verified REMEDIATED (adversarially checked, not taken on faith):
  - Finding 1 (dod_defined, critical): spec §17.1 "Definition of Done (change-specific)" present — seventeen conditions binding all eleven ACs (DoD-11 enumerates them), the manual-evidence items (TC-MEMRESUME-002 dry-run, TC-MEMKERN-003 fidelity review, TC-MEMSCAF-004/TC-MEMWIRE-004 changed-file checks), the full gate battery, PDR-0004 landing (DoD-15), backlog markers (DoD-16), PR posture (DoD-17), with the NG-4 populated-tree and DEC-1/DEC-3 pre-tooling framing rules, a fail-closed closing rule, per-condition verification methods and owning plan phases, the validation-checklist line, and Document History 1.2. Matches the sibling-spec convention (verified against ten November precedents).
  - Finding 2 (spec side): the twelve-class enumeration verified bullet-for-bullet against the actual AGENTS.md "Agent memory" section — preamble (locations + advisory/untrusted) plus all ten source bullets are now covered, with the evidence-bar/supersede merge matching the source's single "Evidence over recency" bullet; no stale "ten" remains in spec or test plan; TC-MEMKERN-001 asserts the twelve with the merged class and new anchors; TC-MEMKERN-003's comparison standard is the twelve-class set. The plan-side residue is finding 1 above.
  - Finding 3: TC-MEMALIGN-004 exists as a full Critical/High automated TC (carrier scan, per-hit failure naming file+line, URL-scheme carve-out for fully-qualified public ADOS URLs), wired into §3.1 (AC-F6-1 row), §5.1 index, §7 bun-suite mapping row; plan TC ownership recounts 28/28 with phase-1 ownership and the enforcement home pinned to the bun suite in phase 4 (not the bash guard), carrier scope and carve-out stated identically in both artifacts.
  - Finding 4: plan C-3 corrected to marker-only with the explicit boundary (no agent-added headers, no header-script edits, doc/templates outside script scope per AGENTS.md), echoed in phase-1 obligations (1.10 comment), done-when, and the phase-1 summary; new escalation trigger `agent-added-license-header-or-header-script-edited`.
  - Finding 5: allowlist representation pinned — the bootstrapper prompt's list-form entry is canonical; guide and feature spec adopt it verbatim; the feature spec's compact brace form is explicitly REPLACED in phase 2 (revision note F5, phase-2 representation pin, obligations 2.3/2.4, done-when "byte-identical LIST-FORM … compact brace form is gone").
  - Finding 6 (nit): TC-MEMBUDGET-001 now asserts the kernel-section template ≤200 lines (executable cap for the ~200 guidance) and that the template states its budget explicitly; consistent with spec F-2's note that AC-NFR2-1 itself measures entry points and index only.
- Standing decisions of record re-verified unchanged and consistent: DEC-1, PDR-0004 (untracked file + committed index row + plan phase 3 `doc/decisions` folder scope + TC-MEMALIGN-003 pinned-red rule), DEC-5 autonomous/STOP-before-merge, spec v1.1 reopen history.
- Blocker count: one major (finding 1), mechanically fixable in the plan without touching phase structure, scope paths, or parsed keys beyond the phase-1 summary text. Reopen `delivery_planning`; findings 2-3 are nits that can ride the same remediation pass (specification / test_planning respectively). Iteration 2 of max 3 — if finding 1 persists at iteration 3, escalate to the human per the stalemate rule.
