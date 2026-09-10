# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-41
Date: 2026-09-09
Timestamp: 2026-09-09T04:11:32Z
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: FAIL

## Review Basis

First review; no prior readiness records found. Read the complete spec, test plan, implementation plan, PM notes, and 2,298-line delivery brief. Retrieved GH-41 and GH-140, including their owner comments, through `gh issue view`. GH-140 remains Open; its owner comment points to the MarkSync catalogue as starting-point input, not an accepted replacement contract. Read Proposed ADR-0003 and relevant current specifications for lifecycle, agents/commands, plugin generation, distribution, profiles, bootstrapper, decisions, review, templates, external research, and quality gates; also the handbook, testing strategy, and DoD guide.

The user identifies artifact checkpoint `f089848`; reviewed files as supplied on disk without independently verifying that commit, because this role performs zero git operations. Source inspection was limited to checking planned affected areas, notably installer/uninstaller manifests. No implementation review or test execution was performed.

## Findings

1. [major] dod_defined — `chg-GH-41-spec.md` §17 AC-F13-2, §18, and end of document (lines 408, 410–418, 528–558)
   Gap: The spec refers to evaluating and passing Definition of Done but never defines the change-specific DoD. AC-F13-2 makes passing that undefined gate part of acceptance; it is not the gate's definition. Completion requirements are scattered across metrics, NFRs, rollout, and the implementation plan. The authoritative DoR requires a clear, testable DoD in the spec itself; the existing DoD guide also explicitly requires it.
   Suggested remediation target phase: specification
   Suggested fix: Add a normative change-specific DoD checklist binding all 17 ACs, applicable NFRs, ten live scenario results and supplemental safety cases, real canonical verified closure, required structural/install/generated checks, reconciled system docs, independent review, and completed plan tasks to retained evidence. Explicitly separate pre-PR completion from human ADR acceptance at PR review; do not require the ADR to be Accepted before testing.

2. [major] spec_completeness — `chg-GH-41-spec.md` §5.1 F-5/F-6, Flow 3, §22; `chg-GH-41-test-plan.md` TC-KNOWLEDGE-006; `chg-GH-41-plan.md` tasks 1.5/2.2 and lifecycle validation matrix
   Gap: Deduplication explicitly searches Resolved and Dismissed records and aggregates a matching observation, but no artifact defines what happens when the original deficiency genuinely recurs after resolution or new evidence overturns dismissal. Keeping a matched record Resolved contradicts the original-gap verification invariant; creating another ID defeats same-remediation deduplication. Reopening, handling prior verification/disposition, and distinguishing historical replay from a genuinely independent recurrence are left to implementation judgment. Current tests exercise retries and initial closure, not this retained-record branch.
   Suggested remediation target phase: specification
   Suggested fix: Define the authorized transition and history-preservation rules for matches against each retained status, including suggest/off behavior without mutation. Then trace tests for genuine recurrence, overturned dismissal, and replay of already-resolved evidence through schema/prompt tasks. Preserve the existing KG identity and meaningful prior resolution evidence where the defect is the same.

3. [major] plan_code_area_coverage — `chg-GH-41-plan.md` tasks 2.1, 3.1–3.2, Phase 3 files/tests (lines 219–222, 279–288, 325–342)
   Gap: The plan adds a globally installable agent/two commands, a locally installed tool, and a JSON schema, but does not include `scripts/uninstall.sh` or explicit new-artifact removal tests. Existing uninstall code has independent agent/command lists (lines 68–82), a hard-coded delivery-tool removal list (422–435), and template traversal restricted to Markdown/YAML (392–409). Merely registering the tool in the installer and copying JSON leaves these new shared artifacts outside removal coverage. “Run existing uninstall tests if installer path ownership changes” does not plan the required manifest/parser work or assertions for these additions.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Explicitly include `scripts/uninstall.sh` and `scripts/.tests/test-uninstall.sh` in the affected areas. Add install→update→uninstall cases for the new global interfaces and local tool/schema, while preserving project-owned instructions, sources, gap records, and index. Resolve JSON packaging/removal consistently with its selected distribution contract; avoid unrelated cleanup of pre-existing manifest drift.

4. [major] cross_artifact_consistency — delivery brief §31 Scenario M (lines 2055–2064); `chg-GH-41-spec.md` Appendix A rows 7/10 and Authoring Guidelines; `chg-GH-41-test-plan.md` TC-KNOWLEDGE-019/022; `chg-GH-41-plan.md` task 4.2
   Gap: The claimed consolidation of the brief's required behavioral scenarios into ten ADOS scenarios drops the contributor-following-a-broken-setup-command case. Generic drift review (019) and orientation with an inaccessible source (022) do not exercise its specific contract: an immediate workaround only when evidenced, a drift gap and canonical guide-remediation route, and no chat-only fix accepted as resolution. All ten selected scenarios can pass without testing that required combination.
   Suggested remediation target phase: specification
   Suggested fix: Extend one existing dogfood scenario, such as orientation, with the brief's stale setup-command branch and explicit expected outcomes; ten top-level scenarios can remain. Propagate the branch to the test case and live execution/evidence mapping, including a no-evidenced-workaround negative case. Add a brief A–M→consolidated-scenario mapping so no required behavior is silently lost.

5. [major] test_traceability — `chg-GH-41-test-plan.md` TC-KNOWLEDGE-005/017/022; `chg-GH-41-plan.md` task 4.3, machine-validation policy row, execution protocol step 4
   Gap: The concrete ACL execution strategy denies source access, correctly proving inaccessible≠missing, but does not specify a separate permitted-read/restricted-disclosure case. TC-005 names restricted fixtures yet its steps retrieve inaccessible and instruction-like content; the dogfood access cases likewise deny access. A facade that copies every successfully retrieved restricted excerpt into its answer or public gap could pass those cases because it never receives restricted content. This leaves AC-F4-2 and NFR-4/NFR-13 only partially verified despite their traceability rows.
   Suggested remediation target phase: test_planning
   Suggested fix: Add a live synthetic source the agent is authorized to read but whose content cannot be disclosed to the destination audience/repository. Assert safe answer/candidate provenance, no restricted substance in persisted gaps/index/evidence, and policy-respecting behavior under authorized capture. Keep this distinct from denied-access cases and use no real sensitive data. Inspect attempted tool actions as well as final file state so permission-denied mutation or injection attempts cannot masquerade as behavioral refusal; retain sandbox containment.

## Confirmed Strengths and Non-Blockers

- Every ticket AC has a Given/When/Then criterion and a TC mapping; the failures above concern missing branches/contracts, not absent bulk traceability. The implementation plan explicitly enumerates the main prompt, tooling, CI, guide, navigation, and system-spec surfaces.
- The plan resolves the test plan's earlier runner/validator questions: fresh OpenCode `run --agent knowledge` and Claude `--plugin-dir ... --agent ados:knowledge --print` processes, direct smoke on both, all ten canonical cases, generated composition smoke, supplemental outcome/capture/role cases, source hashes, sanitized evidence, independent scoring, and blocked-run handling. Actual model access and identity discovery remain execution preconditions, not claimed successes at this gate.
- Isolation excludes expected answers/briefs, disables unnecessary connectors/hooks, requires scoped permissions, and prohibits blanket bypasses. Real closure must reference actual repaired ADOS canonical paths, not merely a synthetic fixture. These are sound planned safeguards, subject to finding 5's missing disclosure branch.
- Parent PM may broker missing nested tools. A transport hop does not add a knowledge-reasoning hop; caller-owned continuation and depth/visited-role checks are planned. Nested Task capability is not a readiness requirement.
- Proposed ADR-0003 adequately captures the scoped ID recommendation for implementation/testing: all-status committed-record allocator, max+1, no holes/reuse, exhaustion failure, provisional collision rescan, published-ID stability, and repository-qualified references. Its final human acceptance at the GH-41 PR is not a present blocker. Broader GH-140 catalogue mechanics remain out of scope.
- Missing documentation profile was independently confirmed. Engineering-repository fallback, optional project-owned knowledge artifacts, update preservation, and canonical/generated source discipline are represented consistently.

## Decision Routing and Gate Result

Five major findings; no critical, minor, or nit findings. All are new, not persistent. Delivery remains blocked.

Change-level clarification/evidence decisions belong in the spec/test-plan/plan. Reopen **specification** for findings 1, 2, and 4; **test_planning** for finding 5 and propagated coverage; **delivery_planning** for finding 3 and dependent tasks. If resolving JSON packaging introduces a reusable distribution convention, PM should delegate a scoped decision-record proposal to `@decision-advisor`; do not silently establish a framework exception.

No immediate human-only scope choice or missing tracker context requires a pause. Preserve ADR-0003's existing human decision rights. Re-run DoR after artifact reconciliation; no override is available for this behavioral/workflow change.
