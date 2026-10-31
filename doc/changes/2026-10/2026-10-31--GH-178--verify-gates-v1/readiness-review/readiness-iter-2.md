# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-178
Date: 2026-10-31
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
- dod_defined: PASS

## Iteration-1 Finding Closure

1. **Closed** — the shared open-PR rule is now DM-13/F-5/F-7, `branch-mismatch` is reachable for both parity and squash, and TC-VGATES-011/030/060 cover it.
2. **Partial / persistent** — `provider.not-found` and the read-failure table exist, but the CI gate's dependency on the PR-detail read is unmapped and the check-run 404 source outcome contradicts F-8 (Findings 1–2).
3. **Closed for the contract** — DM-15/`EvaluateVerifyChange` is additive and `classifyVerifyChange` is a wrapper, but TC-VGATES-013 was not updated and now asserts the old classifier composition (Finding 4).
4. **Closed** — `tests/fixtures/ports/v1-contract-inventory.json`, `EXECUTABLE_ALLOWANCES`, and `tests/structure/inventory.json` are planned.
5. **Closed** — the required trap ids and the `tests/fixtures/providers/**` vs `tests/fixtures/verify-gates/providers/**` split are explicit.
6. **Closed** — `VERIFY_GATES_OPEN_PR_LIMIT` is declared and at-limit is fail-closed with and without a match.
7. **Closed** — the new feature doc is registered in `scripts/checks/forbidden-literals.registry.json` in Phase 7.
8. **Closed** — the `humanText` dispatch is pinned to `data.target`, with a pre-change golden and byte-equality assertion.
9. **Residual** — `createCommandProgram` is gone, but the `ConfigProgramOptions.verify` composition seam is still ambiguous (Finding 7).
10. **Closed** — Section 2.1 includes `unknown` in the status CI vocabulary.
11. **Closed** — the test plan now names `chg-GH-178-plan.md` and GAP-1 is resolved.
12. **Closed** — mergeability precedence is explicit, including `mergeable === true` + blocked/draft.
13. **Closed** — DM-9/Appendix C declare only new constants and reference the reused status constants.
14. **Closed** — Phase 3 adds fixtures only; `verify-gates-ci.test.ts` is created in Phase 4.9.

## Findings

1. [critical] cross_artifact_consistency / spec_completeness — `chg-GH-178-spec.md` §8.3 read-failure table (lines 331–340), F-3 (line 173), Appendix A (line 712); `chg-GH-178-plan.md` OQ-T4 (line 55) and task 4.4 (line 253); `chg-GH-178-test-plan.md` TC-VGATES-061 (lines 1887–1896) and TC-VGATES-011 step 2 (line 561)
   Gap: The CI gate consumes the resolved PR detail's `sourceHeadSha`, but the read-failure table maps a PR-detail 404 only for push parity and squash. The plan's OQ-T4 says "when the detail read itself fails, the gate is `unknown` (`read-failed`)", while the spec and the plan's own 4.4 say a detail 404 is a definitive `fail` (`head-unresolved` for parity, `no-open-pr` for squash). CI is left undefined: it can be implemented as `unknown` (OQ-T4) or `fail` `head-unresolved` (F-3/Appendix A). TC-VGATES-061 asserts only parity/squash for a detail 404; TC-VGATES-011 asserts CI `head-unresolved` only for zero open PRs. The iteration-1 404 remediation is therefore incomplete for the CI gate.
   Suggested remediation target phase: specification
   Suggested fix: Add the CI row/behavior to the Section 8.3 read-failure table (for example, detail 404 → `ci-green` `fail` `head-unresolved` with the detail source `absent`; non-404 detail failure → `unknown` `read-failed`), reconcile OQ-T4, and add the matching CI assertions to TC-VGATES-061 and the at-limit/branch-mismatch/ambiguous cases.

2. [major] cross_artifact_consistency / spec_completeness — `chg-GH-178-spec.md` F-8 (line 178) and DM-14 (line 278); `chg-GH-178-plan.md` task 4.3 (line 252); `chg-GH-178-test-plan.md` TC-VGATES-039 step 4 (line 1308) and TC-VGATES-061 step 4 (line 1890)
   Gap: F-8 states that a definitive HTTP 404 absence is cited as source outcome `absent` "(or the gate's declared resolution failure), not as `failed`". The plan and both TCs require a check-run 404 source `github-check-runs:failed` with `failureClass: provider.not-found`. Either the check-run 404 is not a "definitive absence" (then F-8 must say so and declare the exact source outcome) or the test/plan is wrong (`absent`). DM-14 fixes the gate reason as `unknown` `read-failed` but never declares the source outcome.
   Suggested remediation target phase: specification
   Suggested fix: Clarify F-8/DM-14 that a check-run 404 is not a definitive absence and pin its source outcome (either `failed` with `failureClass: provider.not-found`, or `absent` with `read-failed`); align TC-VGATES-039/TC-VGATES-061 and plan task 4.3.

3. [major] plan_coverage / plan_code_area_coverage — `chg-GH-178-plan.md` Phase 4.1 (line 250), 4.2 (line 251), 4.8 (line 257), Phase 4 Files (lines 268–271); `packages/core/src/index.ts` (explicit root export list)
   Gap: The plan exports `EvaluateVerifyChange`, `VerifyLedgerEvaluation`, `evaluateVerifyGates`, and the renderers only from `packages/core/src/domain/index.ts`. The package root `packages/core/src/index.ts` has an explicit named export list and is not listed in Phase 4 or any later phase. The CLI edge is a separate package and can only import `@delivery-os/core` (the package declares no `./domain` subpath; verified), so the planned edge composition and tests cannot import the new evaluator/renderers without an unplanned root re-export. The blast radius is incomplete and the task as written is not implementable for the CLI.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `packages/core/src/index.ts` to Phase 4's Files list and add a task to re-export the new public domain symbols; update the relevant structure/import test and inventory/allowance checks.

4. [major] test_traceability / cross_artifact_consistency — `chg-GH-178-test-plan.md` TC-VGATES-013 step 5 (line 618); `chg-GH-178-spec.md` F-2 (line 172), DM-15 (line 279); `chg-GH-178-plan.md` task 4.2 (line 251)
   Gap: TC-VGATES-013 requires a spy on the delivered `classifyVerifyChange` to observe the lifecycle gate's call. The fixed architecture requires the gate to consume the structured `EvaluateVerifyChange`/`VerifyLedgerEvaluation`; `classifyVerifyChange` is only a behavior-preserving wrapper. The test as written either fails (the gate does not call the wrapper) or forces the gate to call the wrapper, reintroducing the composition/duplication ambiguity the spec fixed. TC-VGATES-062 already owns the wrapper/evaluator relationship.
   Suggested remediation target phase: test_planning
   Suggested fix: Replace the TC-VGATES-013 spy with a spy on `EvaluateVerifyChange` (or the structured evaluation) and keep the `classifyVerifyChange` wrapper assertion in TC-VGATES-062.

5. [major] test_traceability / cross_artifact_consistency — `chg-GH-178-test-plan.md` TC-VGATES-008 step 2 (line 482); `chg-GH-178-spec.md` F-1 (line 171); `chg-GH-178-plan.md` task 5.1 (line 294)
   Gap: TC-VGATES-008 classifies plain `verify` as a parser-shape failure (`fallback.invocation`), while the spec and plan classify a missing/empty ref and a wrong subcommand as handler grammar (`input.value.rejected`). Plain `verify` has no subcommand and no ref; the current `verify` handler returns `input.value.rejected`, and the plan does not describe a parser path that would produce `fallback.invocation`. The exact assertion contradicts the contract and would fail unless the implementation adds an unplanned special case.
   Suggested remediation target phase: test_planning
   Suggested fix: Align TC-VGATES-008 with F-1/task 5.1 (plain `verify` → `input.value.rejected`), or explicitly add the parser classification to F-1/task 5.1 and the handler contract, then keep the test and spec consistent.

6. [major] plan_coverage / cross_artifact_consistency — `chg-GH-178-plan.md` OQ-T4 (line 55), task 4.4 (line 253); `chg-GH-178-spec.md` F-5/AC-F5-4, F-7/AC-F7-2, DM-14; `chg-GH-178-test-plan.md` TC-VGATES-061
   Gap: Related to Finding 1 but distinct: even after the spec table is fixed, OQ-T4 itself remains a stale rule. It says "when the detail read itself fails, the gate is `unknown` (`read-failed`)". This contradicts the spec's definitive 404 mapping and the plan's own task 4.4, which maps a matched-detail 404 to parity `head-unresolved` and squash `no-open-pr` as a definitive `fail`. The stale open-question text would make TC-VGATES-061 fail and reintroduces the flattening the iteration-1 finding closed. It is recorded as "non-blocking", but the plan cannot be executed with both rules.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Rewrite OQ-T4 to scope `unknown` to non-404 detail failures only; state that a detail 404 follows the spec's definitive mapping; remove the contradictory rule from the open questions.

7. [major] plan_coverage / plan_code_area_coverage — `chg-GH-178-plan.md` task 5.3 (line 296), Phase 5 Files (line 310); `packages/cli/src/edge.ts` `ConfigProgramOptions.verify?: VerifyCommandRuntime`; `packages/cli/src/commands/verify.ts`
   Gap: Task 5.3 says to wire the gates runtime "through the delivered `createConfigProgram` / `ConfigProgramOptions.verify` option" and to "add the `ConfigProgramOptions` option", but `verify` already exists and is typed to the pm-notes/registry-only `VerifyCommandRuntime`. The plan never states whether the gates runtime extends `VerifyCommandRuntime`, adds a new `verifyGates` option, or changes `createVerifyCommandDefinition`'s signature; Phase 5's Files list names `ConfigProgramOptions.verify` without the type change or barrel export. The test plan requires one `verify` definition exposing both subcommands (TC-VGATES-009/TC-VGATES-063), so the seam is binding and currently ambiguous.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Name the new runtime type and composition option (or the extended `VerifyCommandRuntime`), list `packages/cli/src/commands/verify.ts`, `verify-gates.ts`, `commands/index.ts`, and `edge.ts` explicitly, and state the final `createVerifyCommandDefinition`/`createConfigProgram` signatures.

8. [minor] spec_completeness — `chg-GH-178-spec.md` DM-15 (line 279), F-2 (line 172), AC-F2-4 (line 570); `chg-GH-178-test-plan.md` TC-VGATES-062 (line 1915); `chg-GH-178-plan.md` tasks 4.1–4.2
   Gap: DM-15 declares outcomes `finished | partial | failed | state-unverified` but does not define the structured field values for `failed` (malformed notes/missing target) or `state-unverified` (registry failure). TC-VGATES-062 asserts counts, missing phases, and registry evidence on those paths; without declared empty/partial/declaration-derived semantics, the citation values are implementation-chosen and the test's oracle is undefined. The evaluator must also be usable when the document never classified (no effective variant).
   Suggested remediation target phase: specification
   Suggested fix: Pin the per-outcome field semantics (for example: malformed/missing target → variant unknown, empty required/completed/missing, zero counts; state failure → declaration-derived counts and missing set with registry evidence `present: true`/failed) and align TC-VGATES-062.

9. [minor] spec_completeness — `chg-GH-178-spec.md` DM-11 (line 275), F-3 (line 173); `chg-GH-178-test-plan.md` TC-VGATES-019 (line 771), TC-VGATES-020 (line 798), TC-VGATES-022 (line 851)
   Gap: The CI count names are declared, but their denominators are not. TC-VGATES-022 expects `skipped=23` over the expected set while `runs` includes an extra non-expected success; TC-VGATES-019/020 count `succeeded`/`failed` over the expected set. An implementation counting all observed runs would fail the fixtures, and the spec does not state expected-vs-observed per count.
   Suggested remediation target phase: specification
   Suggested fix: Declare that `expected`/`missing` are over the expected set, `runs` is the observed page size, and `succeeded`/`failed`/`pending`/`skipped`/`canceled` are over expected jobs (or choose the opposite and align TC-VGATES-019/020/022/026).

10. [minor] spec_completeness / ac_quality — `chg-GH-178-spec.md` F-7 (line 177), DM-5 (line 269), AC-F8-1 (line 585); `chg-GH-178-test-plan.md` TC-VGATES-030 (line 1066), TC-VGATES-040 (line 1336)
    Gap: On a squash no-detail failure, F-7 says the `squash-signals` list is empty, while AC-F8-1 requires at least one declared count or name list and the citation's `names` array may be empty. The spec does not pin whether the empty list is a present `NameList` with `values: []` or an absent list, nor whether `commits`/`changedFiles` counts are omitted. TC-VGATES-030 says "empty" and TC-VGATES-040 says "at least one", so the exact valid citation is ambiguous.
    Suggested remediation target phase: specification
    Suggested fix: Declare the empty-list representation (present `NameList` with empty values) and the count presence on no-detail failures, then align AC-F8-1 and TC-VGATES-030/040.

11. [minor] spec_completeness — `chg-GH-178-spec.md` DM-5 (line 269), F-8 (line 178), DM-14 (line 278); `chg-GH-178-plan.md` task 1.1
    Gap: `failureClass` is described as an adapter-local class (`provider.payload.invalid`, `provider.not-found`) but its contract type is not declared. The new verify-gates `Source.failureClass` is not specified as a `string` or a closed union, and the domain cannot import the adapter-local type, so the edge mapping is implicit. The spec's "never an error-table code as a class" rule has no mechanical representation in the new contract.
    Suggested remediation target phase: specification
    Suggested fix: Declare `failureClass` as a string (or a closed union of adapter-local classes) in the verify-gates contract, state that the edge maps the read-result code to the citation class, and keep `provider.not-found` out of the error table.

12. [minor] test_traceability — `chg-GH-178-test-plan.md` TC-VGATES-059 step 2 (line 1831); `chg-GH-178-plan.md` task 6.4 (line 334)
    Gap: TC-VGATES-059 requires the default suite to run under a preloaded network guard (`tests/fixtures/verify-gates/cases/network-guard.ts` "or the repo equivalent"). The plan's Phase 6.4 adds only the `verify-gates-no-live-calls.test.ts` network spy and never names the guard/preload file or the exact repo equivalent, so the test's execution contract is not in the plan.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Add the guard/preload file to Phase 6's files and task, or state the exact repo equivalent and how the no-live-call suite is executed under it.

13. [nit] plan_code_area_coverage — `chg-GH-178-plan.md` Phase 1 Files (lines 163–166), Phase 2 Files (lines 198–201)
    Gap: The per-phase Files and modules lists omit some test files the tasks add or extend: Phase 1 omits `tests/structure/verify-gates-contract.test.ts`, `delivery-request-gate-facts.test.ts`, and `error-table.test.ts`; Phase 2 omits `tests/structure/trap-catalog.test.ts` and `tests/behaviour/providers/github-trap.test.ts`. The tasks name them, so the blast radius is discoverable, but the phase file lists are incomplete.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Add the named test files to each phase's Files and modules list.

## Adequacy Notes

- Traceability is numerically complete: the test plan covers all 34 ACs and all 66 TCs, and the plan's scenario and final acceptance tables carry the reverse direction. No AC or TC is dropped.
- The iteration-1 fixes are substantively present: the DM-13 shared resolution rule, at-limit closure, `provider.not-found`, `VerifyLedgerEvaluation`, trap-id/placement split, forbidden-literal registry, `humanText` dispatch, mergeability precedence, and inventory bindings. The remaining blocking issues are contradictions in the new 404 composition, a stale test assertion left by the ledger fix, an incomplete plan export/composition surface, and one grammar classification that conflicts with the spec/plan.
- Non-vacuity, the three ticket negative cases, read-only/no-merge/no-new-package constraints, the current-truth specs read, and the decision log are adequate; no scope creep or missing DoD was found.
- No decision record pause is required: the remaining issues are change-level specification/test-plan/plan corrections and can be resolved in those artifact phases. Delivery is blocked by Findings 1–7; Findings 8–12 are remediable in the same reopened phases.
