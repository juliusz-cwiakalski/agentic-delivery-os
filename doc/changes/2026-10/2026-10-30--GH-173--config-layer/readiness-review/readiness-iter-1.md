# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-173
Date: 2026-10-30
Reviewed At UTC: 2026-10-30T07:05:39Z
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: FAIL
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: FAIL

## Findings

1. [major] cross_artifact_consistency / ac_quality — `chg-GH-173-spec.md`#17, AC-F2-3 and AC-F2-4; `chg-GH-173-test-plan.md`#TC-CONFIG-005 and TC-CONFIG-006; `chg-GH-173-plan.md`#Tasks-3.4–3.5
   Gap: The same selected-file invocation under `CI=true`, without re-enable flags, has incompatible project-local skip-reason oracles. AC-F2-3 requires `ci-disabled` for project-local unless deliberately re-enabled; AC-F2-4 requires `selected-config`. TC-CONFIG-005 explicitly includes selected-file runs and expects all three ambient layers to report `ci-disabled`; TC-CONFIG-006 includes a CI variant and expects project-local to report `selected-config`. Spec §8.3 and Proposed TDR-0003 refinement 3 support the latter selected-file reason, but the unconditional CI AC/test has no exception. The layer remains disabled either way; the defect is contradictory observable evidence, not permission to read it. One implementation cannot satisfy both assertions.
   Suggested remediation target phase: specification
   Suggested fix: Define a single skip-reason precedence for overlapping eligibility conditions, explicitly covering CI plus selected config and CI outside git. Make AC-F2-3/4 consistent with that rule; reconcile TC-CONFIG-005/006 into an exact expected-reason matrix and align tasks 3.4–3.5. Preserve the prohibition on reading disabled layers and on implicitly enabling system/user sources.

2. [major] dod_defined — `chg-GH-173-spec.md`#17-Acceptance-Criteria, #18-Rollout, and #Validation-Checklist
   Gap: The specification contains 25 behavioral ACs and measurable NFRs, but no declared Definition of Done or equivalent completion predicate tying their evidence to the change's verification and documentation obligations. The implementation plan supplies completion gates, but cannot substitute for the required spec-defined DoD. The authoring checklist establishes artifact quality, not delivery completion.
   Suggested remediation target phase: specification
   Suggested fix: Add a concise, testable change DoD referencing all 25 ACs and applicable NFR evidence, executable negative controls, independent review, applicable quality gates, synchronized system/error documentation, packed schema/default artifacts and minor release intent. Distinguish readiness for the open-PR handoff from owner acceptance before merge/adoption; do not introduce a pre-PR license/TDR acceptance gate.

## Evidence and Passing Coverage

- First persisted review: the change directory contained only the four change artifacts; no prior readiness record exists. Findings: **2 major, 0 critical, 0 minor, 0 nit; none persistent**.
- Read all four artifacts and retrieved issue #173 body and comments with `gh issue view`. The issue is OPEN. Owner checkpoint comments are historical; PM notes record their resolution. Branch/sync state was supplied by the caller, not independently rechecked with git.
- Compared accepted ADR-0003, especially DEC-4 and the package/runtime constraints, with Proposed TDR-0003 and current branding, result-contract, scaffold, quality and testing documentation. The recorded CI project-local exclusion, brand-derived names and GH-172 exit projection correctly reconcile ticket shorthand. No ticket behavior was silently dropped.
- All **25 ACs map to TC-CONFIG-001–025 and phased tasks**. Tests specify the production resolver, real parser/adapters and actual command path rather than replacement test implementations. The contradictory skip-reason oracle above must be resolved before those assertions can pass together.
- Empty production catalog/defaults and richer typed test catalogs are intentional. Planned controls cover seven winners; per-layer validation before shadow/reset; final required validation; real YAML/alias/collection positions; shipped default-manifest drift including empty defaults; schema parity; and isolated packed Node/Bun consumers.
- Current code reads verified the plan's affected seams: placeholder core config and file/repo entries; core root/contracts and package exports; legacy mapping/process warning state; CLI edge, parser, classifier and serializer; boundary rules; exports-parity; and license-audit/registry/tests. Tasks explicitly address new runtime acquisition, direct/runtime/transitive/multi-use license accounting, exact nine-code classification and containment, safe provenance and unregistered-secret diagnostics through the sole redaction boundary.
- Proposed dependency/allow-list rows and TDR-0003 remain proposals. Truthful closure accounting, license/security checks and portability evidence are required before handoff; human compatibility/TDR acceptance remains at owner review before merge/adoption. This is not a present human-input pause.
- Credential resolution remains M0-S12; mediated execution is documentation-only behind unchanged primitive ports. Neither credential implementation nor sidecar work is needed for this gate.
- Documentation updates are explicit: new config feature, result table/output contract, branding/scaffold reconciliation, index/glossary and literal-scan registration. The plan preserves existing public subpaths and binding upstream gates.
- PM notes explicitly assign independent review/fixes and final handoff to PM lifecycle ownership when coder runs without review. Plan phases 6–8 therefore do not create a separate readiness blocker or authorize marking those tasks complete during implementation. Release intent and final evidence still require their stated follow-through.

## Decision Routing and Next Steps

- Skip-reason precedence and the completion predicate are **change** clarifications for the specification/PM workflow; no new system decision or human-only choice is required by these findings.
- Reopen **specification** for both findings, then **test_planning** for the skip-reason matrix and **delivery_planning** only as needed to synchronize its eligibility wording. Re-run DoR after the artifact revisions. Delivery remains blocked; no override applies.
- This is a pre-implementation artifact review, not code review or execution evidence. No builds/tests, nested agents, git operations, source edits or PM-note edits were performed. Only this readiness record was written.
