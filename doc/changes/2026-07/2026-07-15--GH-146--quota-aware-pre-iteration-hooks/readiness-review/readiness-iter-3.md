# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-146
Date: 2026-07-16
Pause Required: yes

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Findings
1. [critical] cross_artifact_consistency — GitHub issue GH-146#owner scope-extension comment, `chg-GH-146-spec.md`#G-7/F-9/AC-F9-2, `TDR-0002-pre-iteration-hook-contract-details.md`#Evidence/D-6, and `doc/guides/opencode-model-configuration.md`#Key Principle/Model Assignment Structure
   Gap: Persistent extension of iteration 2 finding 1. The artifacts now name `OC_ADOS_MODEL_PROFILE`, tier defaults, and `OC_ADOS_AGENT_*_MODEL`, but they still do not define the binding that makes an exported `OC_ADOS_AGENT_*_MODEL` value select the model used by OpenCode. Current system guidance says model assignments live exclusively in OpenCode config files; the checked-in configs do not consume these variables, `deliver-ticket.sh` supplies no `-m` override, and `ceo-loop.sh` uses the unrelated `CEO_LOOP_MODEL` only for a fresh CEO command. AC-F9-2 and TC-HOOK-025 prove only environment inheritance, not the promised provider/model switch. The plan therefore lists neither the required config/command code area nor an actual selected-model test, so delivery could pass every AC while OpenCode continues using its old provider. This is a system-level contract choice and, at the third failed readiness iteration, requires human escalation: define a supported OpenCode config interpolation/profile prerequisite, add wrapper-side model selection (including resume semantics), or explicitly narrow the scope and claims with owner approval.
   Suggested remediation target phase: specification
   Suggested fix: Have the human decider and `@decision-advisor` revise TDR-0002 and the spec with one concrete model-binding/precedence contract; then add an AC, executable selected-model test, documentation semantics, and all affected config/wrapper code areas to the plan.

2. [major] ac_quality — `chg-GH-146-spec.md`#Success Metrics/NFR-1/AC-F2-1 and `chg-GH-146-test-plan.md`#TC-HOOK-001/Automation Plan
   Gap: “Zero added wall-clock delay” is not a deterministic acceptance threshold: even the required path existence check consumes nonzero time. TC-HOOK-001 proposes comparing against “the same scripts without hook code,” but no reproducible baseline artifact, sampling method, tolerance, or static substitute is defined, and its automation mapping declares no fixture. “Within measurement noise” can therefore pass or fail arbitrarily and cannot supply objective DoD evidence.
   Suggested remediation target phase: specification
   Suggested fix: Define the requirement as zero intentional wait plus zero new log output, or provide a measurable overhead threshold and reproducible baseline method; align TC-HOOK-001 and its plan tasks to that criterion.

3. [major] plan_coverage — `chg-GH-146-plan.md`#Phase 5/Phase 8 versus `.ai/rules/testing-strategy.md`#Test layers and quality gates
   Gap: The plan changes three Markdown current-truth documents but schedules only TC-HOOK-020 and the distribution guard. It omits the repository-required `git diff --check`, Markdown rendering review, and changed-link/path review. The final “format checks used by the repo” wording is not a checklistable replacement for these explicit mandatory checks.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add explicit Phase 5/8 checklist tasks and recorded commands/manual evidence for `git diff --check`, Markdown rendering, and changed-link/path validation alongside the distribution guard.

4. [minor] test_traceability — `chg-GH-146-test-plan.md`#TC-HOOK-020 preconditions versus `doc/spec/features/feature-delivery-lifecycle.md`#11-phase workflow and `chg-GH-146-plan.md`#Phase 5
   Gap: TC-HOOK-020 says documentation is available “after phase 11 (system_spec_update),” but `system_spec_update` is lifecycle phase 7 and phase 11 is PR creation; the delivery plan executes this test with its documentation phase before finalization. The stated precondition would sequence the required documentation check after the PR gate.
   Suggested remediation target phase: test_planning
   Suggested fix: Replace the stale phase-11 precondition with “after the planned documentation updates / lifecycle phase 7 system_spec_update and before DoD/PR creation.”
