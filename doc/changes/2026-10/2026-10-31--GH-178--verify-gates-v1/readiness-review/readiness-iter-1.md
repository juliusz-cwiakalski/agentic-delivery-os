# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-178
Date: 2026-10-31
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Findings

1. [critical] cross_artifact_consistency / ac_quality — `chg-GH-178-spec.md#F-5, #AC-F5-2, #8.3`; `chg-GH-178-test-plan.md#TC-VGATES-011, #TC-VGATES-030`; `chg-GH-178-plan.md#4.3`
   Gap: `branch-mismatch` has no consistent runtime path. The spec resolves the target as the unique open PR whose `sourceRef` equals the checkout branch, so a lone open PR with a different `sourceRef` yields `no-open-pr`, not `branch-mismatch`. TC-VGATES-011 precondition (d)/step 4 and TC-VGATES-030 precondition/step 4 require `branch-mismatch` from exactly that fixture. The squash gate reuses the same detail but its allowed reasons (Section 8.3) do not include `branch-mismatch`, so even a detail-read race cannot be reported consistently across parity and squash. The AC, corpus, and test plan therefore pin a reason that cannot be produced as written.
   Suggested remediation target phase: specification
   Suggested fix: Define resolution and mismatch semantics once: either select by `sourceRef` and make `branch-mismatch` a detail-read consistency check (with a retarget/race fixture) that both parity and squash can report, adding it to squash's allowed reasons; or drop `branch-mismatch` from the closed reason set. Update AC-F5-2, TC-VGATES-011, TC-VGATES-030, the corpus requirement, and the plan accordingly.

2. [critical] spec_completeness / ac_quality — `chg-GH-178-spec.md#F-6, #AC-F6-2, #DM-5, #Appendix A`; `chg-GH-178-test-plan.md#TC-VGATES-034, #TC-VGATES-039, #TC-VGATES-049`; `chg-GH-178-plan.md#4.4, #5.3`
   Gap: The owner gate requires a provider-absent numeric work item to be `fail`/`ticket-unresolved` with source outcome `absent`, and other non-2xx responses to be `unknown`/`read-failed`. The delivered read surface cannot distinguish them: `ProviderReadFailure` is only `config.credential.missing` or `provider.payload.invalid`, and `packages/adapters/src/github/client.ts` maps every non-2xx (including 404) to `providerPayloadFailure("GitHub returned HTTP <status>")`. The plan has no task to add an absence signal or expose HTTP status. TC-VGATES-034 expects a provider-absent numeric identity to fail with `absent`, while TC-VGATES-039 and TC-VGATES-049 include 404 in the generic `unknown`/`read-failed` matrix — a direct contradiction that cannot both pass.
   Suggested remediation target phase: specification
   Suggested fix: Add a declared adapter-local absence result or status signal (without adding a new adapter operation or subpath export), plan the read-surface change, and split 404/absence from other non-2xx in AC-F6-2, TC-VGATES-034, TC-VGATES-039, TC-VGATES-049, and the plan.

3. [critical] plan_coverage — `chg-GH-178-spec.md#F-2, #AC-F2-2, #DM-11`; `chg-GH-178-plan.md#4.1`; `packages/core/src/domain/verify-change.ts`
   Gap: The lifecycle citation must carry `required`/`completed`/`missing` counts and ordered `missing-phases` on the fail path, but the composed `classifyVerifyChange` returns only `{kind, code, summary}` on failure; structured `requiredPhases`, `completedPhases`, `missingPhases`, and `evidence` exist only in the success data. The plan says to compose the classifier and "implement citation counts/names" but never defines how the gate obtains structured failure fields without duplicating the ledger rules or parsing the human-readable summary. TC-VGATES-015 asserts ordered missing phases and counts, so the plan as written is not implementable against the delivered classifier.
   Suggested remediation target phase: specification
   Suggested fix: Additively expose structured partial evidence from the verify-change classifier (or a pure helper) and consume it in the lifecycle gate; add the task and test mapping to the plan while keeping ledger rules in one place.

4. [major] plan_code_area_coverage — `chg-GH-178-plan.md#1.5, #3.2, #5.7`; `tests/structure/port-contract-inventory.test.ts`; `tests/fixtures/ports/v1-contract-inventory.json`; `tests/structure/content-inventory.test.ts`
   Gap: Two binding checks will fail under the plan's current file list. `compareInventory` in `port-contract-inventory.test.ts` rejects every contract module not present in `tests/fixtures/ports/v1-contract-inventory.json`, so the new `packages/core/src/contracts/verify-gates.ts` must be added there — Phase 1.5 only mentions `tests/structure/inventory.json`. Separately, `content-inventory.test.ts` requires every exported function/const in package source files to appear in `EXECUTABLE_ALLOWANCES`; the plan mentions only `inventory.json` for the new contracts/domain/file/CLI modules. The planned verification commands for Phases 1, 3, and 5 will fail.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add tasks and file entries for `tests/fixtures/ports/v1-contract-inventory.json` and `tests/structure/content-inventory.test.ts` (including `commands/index.ts` if the new definition is barrel-exported), with the exact new exports in each phase's Files list.

5. [major] test_traceability — `chg-GH-178-spec.md#Appendix G`; `chg-GH-178-test-plan.md#TC-VGATES-055, #TC-VGATES-056`; `chg-GH-178-plan.md#2.2, #2.3`
   Gap: The spec and TC-VGATES-055 require trap coverage for the check-run and issue families as well — `GITHUB-CHECKRUN-EMPTY`, `GITHUB-CHECKRUN-ALL-SKIPPED`, `GITHUB-CHECKRUN-PAGE-LIMIT`, and `GITHUB-ISSUE-COMMENTS-ABSENT` — but Phase 2.2 lists only the six PR mergeability/head/surface traps. In addition, `tests/structure/trap-catalog.test.ts` requires every `fixtureReference` to be under `tests/fixtures/providers/`, while Phase 2.3 puts the new payloads under `tests/fixtures/verify-gates/providers/...`; the trap catalog cannot validate those references (TC-VGATES-056 names `tests/fixtures/providers/github/**`).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add tasks and fixture files for all ten trap behaviors under `tests/fixtures/providers/github/**`, update the catalog/assertions and TC-VGATES-055/TC-VGATES-056 mapping, and align TC-VGATES-054's PR fixture path with Phase 2.3.

6. [major] spec_completeness — `chg-GH-178-spec.md#F-5, #8.4, #DM-9, #Appendix C, #NFR-5`; `chg-GH-178-test-plan.md#TC-VGATES-011 step 5, #TC-VGATES-051`
   Gap: The open-PR list read is declared only in prose ("one bounded page (100)"); there is no `VERIFY_GATES_OPEN_PR_LIMIT` in DM-9/Appendix C, yet TC-VGATES-011 and TC-VGATES-051 assert a "declared limit". More importantly, the at-limit behavior is one-sided: only "at its read limit with no match" is specified as `no-open-pr`; a page at the limit that contains a matching PR is accepted even though another matching PR could exist beyond the page, allowing push parity and squash to pass on an ambiguous branch. No test covers the at-limit-with-match case.
   Suggested remediation target phase: specification
   Suggested fix: Declare the limit constant (and add it to DM-9/Appendix C/NFR-5), and specify/test that a list page at the limit fails closed (`unknown`/`ambiguous-open-pr`) rather than passing; add at-limit-with-match and at-limit-no-match fixtures.

7. [major] plan_doc_update_coverage — `chg-GH-178-plan.md#7.1, #7.5`; `scripts/checks/forbidden-literals.registry.json`; `scripts/checks/forbidden-literals.ts`
   Gap: The new `doc/spec/features/feature-verify-gates.md` is absent at the forbidden-literal corpus baseline, so `forbidden-literals.ts` requires it to be listed in `scripts/checks/forbidden-literals.registry.json`; otherwise the forbidden-literal gate fails ("unregistered user-facing doc absent at corpusBaseline"). Phase 7.1 only verifies `test-doc-distribution.sh`, and Phase 7.5 runs `forbidden-literals.ts` without a task to register the doc.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `doc/spec/features/feature-verify-gates.md` to the registry's `registered` list in Phase 7.1/7.2, list the registry file in the phase's Files/modules, and rerun the forbidden-literal check.

8. [major] plan_coverage — `chg-GH-178-spec.md#8.5`; `chg-GH-178-plan.md#5.4`; `packages/cli/src/index.ts`; `packages/cli/src/commands/verify.ts`; `packages/cli/src/output/serialize.ts`
   Gap: The plan adds a `humanText` hook to the shared `verify` definition and says `verify change` "keeps its current human output", but `CommandDefinition.humanText` returns `string` and takes precedence over `humanJson`; `verify` currently relies on `humanSuccess: true`/`humanJson`. The plan does not define the return/dispatch contract for `change` (or a type change), so the compatibility claim is unverifiable and may silently replace the current JSON output.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Specify the hook as a success-payload dispatch with an explicit `change` path that reproduces the current `humanJson` bytes (or make the hook `string | undefined`/per-subcommand), and add a regression assertion for `verify change` human output.

9. [minor] plan_code_area_coverage — `chg-GH-178-plan.md#5.3`; `packages/cli/src/edge.ts`
    Gap: The plan instructs wiring "into `createCommandProgram`", but no such symbol exists; the runtime is composed by `createConfigProgram` / `ConfigProgramOptions` and `EdgeOptions.verify`. The plan also does not list the `ConfigProgramOptions` option (and `commands/index.ts` export, if used) as an affected file.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Replace the symbol and list `createConfigProgram`, `ConfigProgramOptions`, `EdgeOptions`, and the relevant barrel/export files in Phase 5's Files list.

10. [minor] spec_completeness — `chg-GH-178-spec.md#2.1`; `chg-GH-178-spec.md#Appendix C`; `chg-GH-178-test-plan.md#TC-VGATES-001`
    Gap: Section 2.1 lists status CI values as `failed`, `pending`, `succeeded`, `canceled`, `none`, omitting `unknown`; Appendix C and TC-VGATES-001 include `unknown` in `STATUS_CI_RESULTS`. This is a small drift from current truth that could mislead the CI gate mapping.
    Suggested remediation target phase: specification
    Suggested fix: Add `unknown` to the Section 2.1 list or cite `STATUS_CI_RESULTS` explicitly.

11. [minor] test_traceability — `chg-GH-178-test-plan.md` frontmatter `implementation_plan: null` and `GAP-1`
    Gap: The plan now exists and is committed, but the test plan still records `implementation_plan: null` and "[GAP-1 — implementation plan absent]". This is stale cross-artifact metadata.
    Suggested remediation target phase: test_planning
    Suggested fix: Set `implementation_plan: ./chg-GH-178-plan.md` and replace GAP-1 with the plan's actual binding status.

12. [minor] spec_completeness — `chg-GH-178-spec.md#F-12`; `chg-GH-178-plan.md#2.1`
    Gap: The mergeability mapping is ambiguous when `mergeable === true` and `mergeable_state` is `blocked`/`behind`/`unstable`/`draft`: the first clause says true + clean/absent → `mergeable`, while the later clause says those states → `not-mergeable`. No fixture covers the combination.
    Suggested remediation target phase: specification
    Suggested fix: Declare the precedence explicitly and add a fixture/assertion for true + blocked (or state that the combination is not produced).

13. [minor] plan_code_area_coverage — `chg-GH-178-plan.md#1.1`; `chg-GH-178-spec.md#DM-9`
    Gap: Phase 1.1 says "all DM-9 constants and bounds", which includes the reused `STATUS_OWNER_ATTENTION_LABELS` and `STATUS_CI_RESULTS`; the spec forbids a duplicate owner-label list and the test plan asserts reuse. The plan should state that those two are imported/re-exported, not declared again.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Clarify that only the new `VERIFY_GATES_*` constants are declared in the new module and the status constants are imported/re-exported.

14. [minor] plan_coverage — `chg-GH-178-plan.md#3.3, #4.7`
    Gap: Phase 3.3 creates `tests/behaviour/verify-gates-ci.test.ts` and asserts CI extraction/validation before the pure evaluator exists (Phase 4); if the suite imports the evaluator, Phase 3's focused command fails, violating the plan's sequencing guard.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Split Phase 3.3 into an extraction-only suite or move evaluator-dependent CI cases to Phase 4.7, and state the exact seam.

## Adequacy Notes
- The artifacts do trace all 30 acceptance criteria to TCs and the plan maps all 59 TCs; the ticket's three negative cases (red pipeline, missing job, vacuous green) are first-class fixtures with restored controls.
- Determinism, bounds, read-only/read-budget, no-live-call default CI, the two additive error rows, the four optional `DeliveryRequest` fields, the current-truth feature spec, the documentation-impact list (Appendix H), and the minor changeset are present and generally well specified.
- The critical findings above are not scope creep or style issues: they are contradictions/unimplementable paths that would produce failing tests or false passes, so delivery is blocked.
- No decision record pause is required: the identified decisions can be resolved within `specification`/`test_planning`/`delivery_planning` and recorded in the change docs.
