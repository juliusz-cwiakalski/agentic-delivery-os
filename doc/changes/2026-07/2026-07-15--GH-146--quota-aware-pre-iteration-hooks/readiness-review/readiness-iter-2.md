# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-146
Date: 2026-07-16
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings
1. [major] spec_completeness — GitHub issue GH-146#Scope (“Document how environment-based model profiles…”) versus `chg-GH-146-spec.md`#F-8/AC-F8-1, `chg-GH-146-test-plan.md`#TC-HOOK-020, and `chg-GH-146-plan.md`#Phase 5
   Gap: The ticket explicitly requires guidance for `OC_ADOS_MODEL_PROFILE`, tier defaults, and per-agent `OC_ADOS_AGENT_*_MODEL` overrides. The artifact chain reduces this to generic “model-profile integration”; its AC/test checks only per-agent inheritance, and the plan names no task that documents the profile selector or tier defaults. The existing model-configuration guide also contains no such environment-profile contract, so this ticket requirement can be omitted while every current AC and TC passes.
   Suggested remediation target phase: specification
   Suggested fix: Add the three explicit documentation requirements to F-8/AC-F8-1, then trace them through TC-HOOK-020 and a checklist task/file in the plan (either the canonical delivery guide or the model-configuration guide, with cross-links as appropriate).

2. [major] cross_artifact_consistency — `TDR-0002-pre-iteration-hook-contract-details.md`#D-6 Authorized names (lines 671-684) versus `chg-GH-146-spec.md`#NG-7/F-9/Security Review (lines 85, 122-124, 387) and `chg-GH-146-plan.md`#Scope/Constraints (lines 121-124, 149-152)
   Gap: The Accepted TDR says an operator may consciously add a secret/provider-credential variable through the exact allowlist, while the spec repeatedly says credentials remain excluded from the return channel. The plan simultaneously accepts any allowlisted valid identifier and claims credential transport is out of scope; it specifies no credential denylist. These contracts authorize different batches at the security boundary.
   Suggested remediation target phase: specification
   Suggested fix: Align the spec and plan to the Accepted TDR’s precise rule—credentials are denied by the built-in namespace but can be explicitly delegated by the operator—or revise the decision record and define an enforceable absolute denylist if absolute exclusion is intended; update AC/test wording accordingly.

3. [major] cross_artifact_consistency — `chg-GH-146-spec.md`#F-4 (line 111) and `TDR-0002-pre-iteration-hook-contract-details.md`#Alternative 1 (lines 400-408), versus TDR D-4 (lines 547-550), AC-F1-2, and plan Phase 1 task 1.4
   Gap: Persistent from iteration 1 finding 3. The normative spec still says the PM hook runs “before entering the PM restart loop” and immediately parenthesizes “before each run_single_iteration”; the chosen-alternative summary in the Accepted TDR retains the once-before-loop wording. D-4, the AC, tests, and plan correctly require execution inside every retry iteration. The highest-risk placement rule therefore remains self-contradictory despite the D-4 correction.
   Suggested remediation target phase: specification
   Suggested fix: Remove every “before entering/before the PM restart loop” statement and state only “inside each retry iteration, immediately before that iteration’s run_single_iteration.”

4. [major] decision_capture — `TDR-0002-pre-iteration-hook-contract-details.md`#D-4/D-5/Verification Criteria (lines 558-591, 889-891) versus `chg-GH-146-spec.md`#AC-F4-2/NFR-4 and `chg-GH-146-test-plan.md`#TC-HOOK-012
   Gap: Persistent from iteration 1 finding 6. The Accepted TDR still says to sleep `ADOS_HOOK_RETRY_SECONDS` between attempts and merely “honor STOP_FILE … immediately”; its test seam and verification metric cover only the failure cap. The remediated spec/test/plan instead require that setting to be the total interval, split into chunks no longer than one second, with stop observed within one second and no next spawn. That precedent-setting retry contract was never captured back into the Accepted decision.
   Suggested remediation target phase: specification
   Suggested fix: Have `@decision-advisor` reconcile D-4, D-5, implementation guidance, and verification criteria with the accepted total-interval/≤1-second polling contract before implementation.

5. [major] system_spec_consistency — `TDR-0002-pre-iteration-hook-contract-details.md`#Positive Outcomes (lines 759-763) versus `chg-GH-146-spec.md`#Current State/DM-3 and current `scripts/deliver-ticket.sh`#`deliver_loop`/`join_delivery`
   Gap: Persistent from iteration 1 finding 5. The TDR still calls `merged | blocked | pr-open | failed | finished` the unchanged delivery-summary enum, omitting the existing `unknown` classification and `max-restarts` emitted outcome. The spec and plan now correctly distinguish classifier and emitted-summary domains, but the Accepted system decision still records the normalized five-value claim that the remediation was meant to remove.
   Suggested remediation target phase: specification
   Suggested fix: Update the TDR consequence to use the same explicit classifier-versus-emitted-summary baseline as spec DM-3, including `unknown` and `max-restarts`, while retaining the no-new-hook-value decision.

6. [major] ac_quality — `chg-GH-146-spec.md`#F-9/DM-8/NFR-10/AC-F9-2 (lines 122-124, 219, 247, 345) and `TDR-0002-pre-iteration-hook-contract-details.md`#Exact file format (lines 622-649)
   Gap: The protocol calls its bounds exact but does not define whether 64 KiB means 65,536 bytes inclusive, whether the terminating LF counts toward the 8,192-byte line bound, or how byte counts remain byte-based under a multibyte locale. AC-F9-2 requires all data “within the documented bounds” to succeed, so edge behavior is not uniquely implementable or testable.
   Suggested remediation target phase: specification
   Suggested fix: Define each bound as an inclusive integer byte/record limit, state whether line delimiters count, and require raw-byte/C-locale measurement; make exact-limit acceptance and limit+1 rejection part of the AC.

7. [major] test_traceability — `chg-GH-146-test-plan.md`#TC-HOOK-024/TC-HOOK-026 (lines 1010-1086) versus TDR D-6 Exact file format (lines 633-649) and plan Constraints (lines 144-158)
   Gap: TC-HOOK-026 tests only over-limit inputs, not acceptance at exactly 64 KiB/256 records/8,192 bytes or rejection at the first byte/record over each clarified edge. It also omits explicit CR and NUL fixtures even though the TDR says neither is representable and Bash parsers can silently strip or mishandle NUL. Generic “malformed” coverage is insufficient for these parser-specific cases in both duplicated implementations.
   Suggested remediation target phase: test_planning
   Suggested fix: Add table-driven both-wrapper cases for exact limit and limit+1 behavior, CR in every relevant position, and embedded NUL bytes, asserting atomic rejection, no spawn, value-safe diagnostics, and cleanup.

8. [major] plan_coverage — `chg-GH-146-spec.md`#Maintenance & Operations (line 393) and TDR Negative Outcomes (lines 784-789), versus `chg-GH-146-plan.md`#Phases 1, 2, and 5
   Gap: The spec/TDR require all new operator knobs to appear in wrapper `--help`/settings as well as the guide. The plan adds settings and guide prose but has no checklist task to update either wrapper’s help text and no test/manual check for those entries, defaults, or the distinction between operator knobs and per-invocation context variables.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add explicit per-wrapper help/settings tasks and verification for `ADOS_PRE_ITERATION_HOOK`, retry/cap/grace, and `ADOS_HOOK_ENV_ALLOWLIST`; identify `ADOS_HOOK_ENV_OUTPUT`/`FORMAT` as hook context rather than operator settings.

9. [minor] test_traceability — `chg-GH-146-test-plan.md`#Automation Plan (lines 1215-1218) versus TC-HOOK-001 details, DoD traceability, and plan Phase 1/2 mapping
   Gap: Persistent form of iteration 1 finding 10. TC-HOOK-001 is a both-wrapper no-hook baseline scenario, but the final automation inventory maps it only to `test-deliver-ticket.sh`. Earlier test-plan sections and the delivery plan require both wrapper suites, so the claimed final bidirectional execution mapping remains stale.
   Suggested remediation target phase: test_planning
   Suggested fix: Add the `test-ceo-loop.sh` TC-HOOK-001 mapping and re-run the final bidirectional TC-to-file sweep.
