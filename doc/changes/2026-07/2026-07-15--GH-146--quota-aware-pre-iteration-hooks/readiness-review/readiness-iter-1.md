# Readiness Review Iteration 1

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
- dod_defined: FAIL

## Findings
1. [critical] cross_artifact_consistency — `chg-GH-146-spec.md`#F-3/AC-F3-2 (lines 101, 301) and `TDR-0002-pre-iteration-hook-contract-details.md`#C-4 (lines 181-190)
   Gap: The committed contract promises cleanup after `SIGTERM/INT/HUP/killed`, but the plan and TC-HOOK-011 cover only SIGTERM-driven traps. A wrapper cannot trap SIGKILL, and a hook deliberately moved to a separate session/process group will survive a wrapper-only SIGKILL unless a stronger parent-death/supervisor mechanism is selected. The literal AC is therefore neither implementable nor test-covered by the proposed trap design. This is a system-level process-lifecycle decision and needs an explicit human choice: narrow the guarantee to trappable termination (and define HUP), or adopt a stronger mechanism with stated platform limits.
   Suggested remediation target phase: specification
   Suggested fix: Have `@decision-advisor` revise TDR-0002 and the spec/AC after human selection; align the test matrix to every supported termination mode and explicitly exclude unavoidable modes.

2. [critical] plan_code_area_coverage — `chg-GH-146-plan.md`#Phase 2 tasks 2.1-2.3 (lines 261-271), against `scripts/ceo-loop.sh`#`run_loop` (current lines 582-585)
   Gap: The plan puts `CURRENT_HOOK_PID` assignment inside `spawn_or_resume_ceo`, but that function is currently invoked through command substitution (`ceo_pid="$(spawn_or_resume_ceo ...)"`). Its global assignments occur in a subshell and are not visible to the main wrapper's EXIT/INT/TERM traps. On wrapper termination while the command substitution waits, the main cleanup can therefore have no hook PGID to kill. The plan does not list the required call-boundary/PID-publication refactor, so its prescribed implementation cannot establish the CEO no-orphan guarantee.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add an explicit task and affected code area to remove/redesign the command-substitution boundary (or safely publish/reap the hook PGID), then exercise the real wrapper process rather than only sourced helpers.

3. [major] cross_artifact_consistency — `TDR-0002-pre-iteration-hook-contract-details.md`#D-4 (lines 477-485) versus `chg-GH-146-spec.md`#AC-F1-2 and `chg-GH-146-plan.md`#Resolved during planning
   Gap: The revised TDR still says the deliver-ticket hook runs “before entering the PM restart loop,” while the ticket, spec AC, and plan require invocation inside that loop before every `run_single_iteration`. The parenthetical “before `run_single_iteration`” does not resolve whether it is once or per retry. This leaves the authoritative system decision internally stale on the highest-risk placement rule.
   Suggested remediation target phase: specification
   Suggested fix: Revise D-4 to say unambiguously “inside each retry iteration, immediately before each `run_single_iteration`,” and remove the once-before-loop wording.

4. [major] test_traceability — `chg-GH-146-test-plan.md`#TC-HOOK-007/007B/008/010/011 and coverage matrix (lines 80-84, 396-588)
   Gap: Failure-form coverage (including the explicit bad-shebang exec failure) and no-timeout coverage are assigned only to `deliver-ticket.sh`; TC-HOOK-011 allows “deliver-ticket.sh or ceo-loop” rather than requiring both. The two scripts duplicate the helper and have different failure policies, so these tests do not prove that ceo-loop routes not-executable/exec-failure into its bounded separate policy, permits a long-running hook, or cleans its actual wrapper/process-group path. AC-F2-2/F3-1/F3-2 are marked fully covered despite this component gap.
   Suggested remediation target phase: test_planning
   Suggested fix: Parameterize or add CEO cases for all three failure forms, no execution timeout, and real-wrapper process-group cleanup; require no-orphan trials for both wrappers.

5. [major] system_spec_consistency — `chg-GH-146-spec.md`#Current State/DM-3 (lines 36, 192) and `chg-GH-146-test-plan.md`#TC-HOOK-013, versus `doc/guides/delivery-modes.md`#Script subcommands (line 250), `.opencode/agent/ceo.md`#workflow step 1 (lines 286-294), and `scripts/deliver-ticket.sh`#classification/help
   Gap: The change calls `merged|blocked|pr-open|failed|finished|unknown` one unchanged “delivery-summary enum,” but current artifacts expose different sets: `classify_result` has no `finished`, the script help and CEO consumer omit `unknown`, and the current guide lists only four values. TC-HOOK-013 cannot meaningfully “assert the set remains” until the classification-vs-summary contract and consumer handling are explicitly distinguished. The current six-value claim silently normalizes pre-existing inconsistency.
   Suggested remediation target phase: specification
   Suggested fix: Define the exact existing classification and emitted-summary domains, including when `unknown` can escape and which values each consumer handles; then make the doc-update and tests preserve that explicit baseline without adding hook-specific values.

6. [major] plan_coverage — `chg-GH-146-plan.md`#Phase 2 task 2.4 (lines 272-279) and `chg-GH-146-test-plan.md`#TC-HOOK-012 (lines 608-624)
   Gap: The required CEO policy says `--stop` breaks out immediately, but the plan only specifies one `sleep ADOS_HOOK_RETRY_SECONDS` between attempts followed by STOP_FILE checks. Because `--stop` writes a file and sends no signal, a default 60-second sleep is not immediately interruptible. No implementation task defines polling/chunked waiting or another wake mechanism, while the test expects immediate exit.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Specify a bounded, interruptible retry-wait helper that polls STOP_FILE at a defined maximum latency; add that latency to AC-F4-2/TC-HOOK-012.

7. [major] test_traceability — `chg-GH-146-test-plan.md`#TC-HOOK-013/REG-2 and `chg-GH-146-plan.md`#Phase 3 tasks 3.2-3.3
   Gap: The unchanged-consumer claim is not regression-tested. TC-HOOK-013 scans forbidden words in the two loop scripts and CEO/PM prompts but omits `batch-deliver.sh`; REG-2 omits any batch-deliver suite. It also does not assert the existing CEO `failed` branch. Consequently a change to exit-code-based batch classification or the CEO failure branch could pass the proposed gate even though “no consumer changes” is a core constraint.
   Suggested remediation target phase: test_planning
   Suggested fix: Add behavior/static regression checks that deliver-ticket hook exit 1 is counted as failed-and-continue by batch delivery, the CEO retains its failed retry-or-park branch, and neither consumer requires a new enum.

8. [major] dod_defined — `chg-GH-146-spec.md`#entire specification
   Gap: The spec has acceptance criteria and rollout notes but no explicit, testable Definition of Done. The plan's later statement “all 12 ticket ACs met, all plan tasks done, all TCs passing” does not satisfy the authoritative requirement that the spec itself define DoD before delivery.
   Suggested remediation target phase: specification
   Suggested fix: Add a Definition of Done section covering all ACs, all 24 TC IDs, both-wrapper no-orphan/no-timeout evidence, unchanged consumers/enums, install-uninstall symmetry, documentation reconciliation, and required quality gates.

9. [minor] decision_capture — `TDR-0002-pre-iteration-hook-contract-details.md`#Constraint Compliance Attestation (lines 546-547)
   Gap: GAP-U1 is corrected in C-8 and D-1, but the final attestation still labels C-8 only “installed + registered” and attests only the install path. It omits the now-mandatory uninstall removal and empty-directory cleanup, contradicting the plan revision's claim that stale GAP-U1 wording was swept.
   Suggested remediation target phase: specification
   Suggested fix: Update the C-8 attestation to explicitly cover install and uninstall symmetry, including file removal and empty `scripts/hooks/` cleanup.

10. [minor] cross_artifact_consistency — `chg-GH-146-test-plan.md`#Automation Plan (lines 1044-1053) versus `chg-GH-146-plan.md`#GAP-U2/Phase 4
   Gap: The test plan still maps Z.AI cases to direct execution of the example and maps REG-2 to nonexistent `scripts/.tests/test-all.sh`; the delivery plan instead introduces `scripts/.tests/test-hook-zai-example.sh` and correctly uses `scripts/test-all.sh`. Thus the claimed final bidirectional sweep of all 24 TC IDs contains stale execution mappings.
   Suggested remediation target phase: test_planning
   Suggested fix: Map TC-HOOK-015..018 to the discoverable wrapper (while retaining any explicit self-test mode) and correct REG-2 to `bash scripts/test-all.sh`.
