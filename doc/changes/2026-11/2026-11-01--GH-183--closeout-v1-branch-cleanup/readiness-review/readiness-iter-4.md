# Readiness Review Iteration 4

Verdict: NOT_READY
Work Item: GH-183
Date: 2026-11-01
Pause Required: no

## Scope Reviewed

- Ticket: GitHub `juliusz-cwiakalski/agentic-delivery-os` issue 183, "M0-S14: closeout v1 with branch cleanup" (context carried from iterations 1-3; not re-read this pass).
- Change artifacts: `chg-GH-183-spec.md` (v1.3), `chg-GH-183-test-plan.md` (v1.2), `chg-GH-183-plan.md` (v1.3), `chg-GH-183-pm-notes.yaml`.
- Prior reviews: `readiness-iter-1.md`, `readiness-iter-2.md`, `readiness-iter-3.md`. This iteration is the PM-authorized **plan-only** extension: it re-verifies the two iteration-3 blocking plan findings and scans the plan v1.3 additions for regressions. Resolved and non-blocking items are not re-litigated.
- Decision record: `doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md` (unchanged; owner acceptance rides GH-183).
- Current truth inspected statically: `tests/conformance/mock-conformance.test.ts`, `tests/conformance/live/live-entrypoint.test.ts`, `tests/conformance/broken-adapter-control.test.ts`, `packages/testkit/src/conformance/{runner,flows,coverage,types}.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/conformance-coverage.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/behaviour/providers/provider-capabilities.test.ts`, `tests/behaviour/port-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts`, `packages/core/src/contracts/adapter-capabilities.ts`, `packages/core/src/contracts/error-table.ts`, `packages/core/src/state/{index,registry,ledger}.ts`, `packages/adapters/src/{github,jira,gitlab}/capabilities.ts`, `packages/cli/src/commands/index.ts`, `packages/cli/src/edge.ts`.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Verification of the Two Iteration-3 Blocking Findings

### Finding 1 (Phase 1 conformance blast radius) — RESOLVED

Verified the plan v1.3 text against the actual files:

- `chg-GH-183-plan.md` Phase 1.6 (line 328) now names all three helpers in the same commit: `ALL_OPERATIONS`/`gapsExcept` in `tests/conformance/mock-conformance.test.ts`, `ALL_OPERATIONS`/`gapsExcept`/`liveControl` in `tests/conformance/live/live-entrypoint.test.ts`, and the `withoutHandler` explicit `declaredGaps` in `tests/conformance/broken-adapter-control.test.ts`.
- Phase 1 code areas (line 347) list all three files with the exact update; Phase 1 tests (lines 361-362) keep `bun test tests/conformance` and the three targeted files as boundary commands; the Phase 1 acceptance criterion (line 342) requires `bun test tests/conformance` green at the boundary and `failClosed` unchanged.
- PIN-18 (line 98) and D3 (line 104) pin the same obligation, and Phase 4.7 / 4.8 / 8.6 re-assert the post-flip behavior.
- Actual source confirms the plan's claims: `ALL_OPERATIONS` is a seven-entry list in `tests/conformance/mock-conformance.test.ts` (lines 134-142) and `tests/conformance/live/live-entrypoint.test.ts` (lines 166-174); `liveControl` declares only `read-work-item` + `write-comment` (lines 184-200); the `withoutHandler` explicit gap list is at `tests/conformance/broken-adapter-control.test.ts` lines 190-201; the `failClosed` branches are at `packages/testkit/src/conformance/runner.ts` lines 486, 603-612, and 766-772. Without the updates the new step would throw undeclared-unsupported (runner lines 605-610), so the remediation is necessary and sufficient.
- No conflict with the Phase 4/5 capability flips: `gapsExcept` only drives test-only controls; `liveControl`'s supported set stays `read-work-item` + `write-comment`; `withoutHandler` overrides its own `supportedOperations`/`declaredGaps`; Phase 4.7 preserves the base client write members / supplies `writeHandler`; `runtimeCoverageViolations` (lines 235-284) only requires a supported operation to execute and a declared gap to be encountered, which the new step satisfies in Phase 1 and after each flip. `mock-conformance.test.ts` line 295 and 241/265/399 remain satisfiable.

### Finding 2 (Executable-allowance cadence) — PARTIALLY RESOLVED; one residual boundary-red omission

Verified the cadence and the named files against `tests/structure/content-inventory.test.ts`:

- Phase 2.6 (line 380) adds explicit allowances for `core/src/domain/sha256.ts` and `core/src/domain/closeout.ts`; Phase 3.2 (line 419) adds `runCloseout`; Phase 3.4 (line 421) adds the `state/closeout.ts` entry; Phase 4.2 (line 463) adds the four GitHub normalizers; Phase 5.2 (line 521) covers Jira `normalize.ts`/`workflow-map.ts`; Phase 6.2 (line 570) adds `createGitBranchSeam`; Phase 7.5 (line 620) adds `createCloseoutCommandDefinition` and appends `createCloseoutCommandRuntime` to `cli/src/edge.ts`.
- `bun test tests/structure/content-inventory.test.ts` is in the boundary tests of Phases 2 (line 405), 3 (line 449), 4 (line 506), 5 (line 556), 6 (line 600), 7 (line 646), and the Phase 1 preamble plus D13 (line 114) keeps the cadence binding.
- The named existing allowances are real: `adapters/src/github/normalize.ts` (lines 413-419), `adapters/src/jira/normalize.ts` (lines 405-409), `adapters/src/jira/workflow-map.ts` (lines 436-440), `cli/src/edge.ts` (lines 195-205).
- Conditional new files `domain/closeout-run.ts`, `github/closeout.ts`, `jira/closeout.ts` each have a same-phase inventory/allowance instruction.
- Residual: Phase 3.4's explicit allowance list for `core/src/state/closeout.ts` omits the exported constant `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX` that PIN-13 (line 91) and Phase 3.1 (line 418) declare. The scanner flags any exported variable statement not listed (see `executableViolations`, lines 483-540; precedent `PHASE_TRANSITION_RECORD_KEY_PREFIX` is allowed at line 154). The plan nonetheless claims Phase 3 is green (line 421), so the boundary is red as written. This is the only residual under-claim; no over-claiming found.

## Findings

### Blocking findings (must-fix)

1. **[major] plan_code_area_coverage / plan_coverage** — `chg-GH-183-plan.md` Phase 3.4 (line 421), Phase 3 code areas (line 439), Phase 3 tests (line 449), PIN-13 (line 91), Phase 3.1 (line 418); existing `tests/structure/content-inventory.test.ts` allowance semantics (lines 483-540) and the `core/src/state/registry.ts` precedent (allowance line 153-163 includes `PHASE_TRANSITION_RECORD_KEY_PREFIX`).
   - Gap: PIN-13 and Phase 3.1 declare that `packages/core/src/state/closeout.ts` exports `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX`, but the explicit `EXECUTABLE_ALLOWANCES` entry in Phase 3.4 lists only `closeoutOperationRecordKey`, `appendCloseoutOutcome`, `readCloseoutHistory`, and `foldCloseoutHistory`. The inventory scanner treats every exported variable statement as an executable export, so the omitted constant fails `bun test tests/structure/content-inventory.test.ts` at the Phase 3 boundary, contradicting the plan's explicit "green at the Phase 3 boundary" claim and D13. This is a residual of iteration-3 finding 2 (allowance cadence), introduced by the new explicit enumeration in v1.3.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: Add `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX` to the Phase 3.4 `EXECUTABLE_ALLOWANCES` entry (and to the Phase 3 code-area wording), or explicitly state it is internal and not exported; prefer adding it, matching the `PHASE_TRANSITION_RECORD_KEY_PREFIX` precedent. One-line plan amendment; no spec/test-plan change.

### Non-blocking findings

2. **[minor] cross_artifact_consistency** — `chg-GH-183-plan.md` Phase 2.7 (line 381); `chg-GH-183-test-plan.md` §4.1 item 2 (lines 226-228).
   - Gap: Phase 2.7 says the fake implements "the test-plan §4.1 `CloseoutProviderRuntime` contract, including ... `readWorkItemObservation`", but test plan v1.2 §4.1 item 2 still omits that carrier (it lists only `readWorkItem`, `readDeliveryRequest`, merged-request lookup, `listBlockedByDependents`, `writeWorkItem`, `transitionWorkItem`, `resolveDeliveryThread`). The plan is internally consistent with PIN-14/PIN-15, and no test fails on the extra member, but the plan's attribution to §4.1 is inaccurate. This is the unresolved (non-blocking) iteration-3 finding 3, which the plan-only authorization could not edit.
   - Suggested remediation target phase: `test_planning`
   - Suggested fix: Accept as a recorded risk for the plan-only iteration, or later add `readWorkItemObservation` to §4.1 item 2 so §4.1, PIN-14/PIN-15, and Phase 2.7 match. Do not block delivery on it.

3. **[nit] plan_coverage** — `chg-GH-183-plan.md` PIN-18 (line 98), Phase 1.6 (line 328).
   - Gap: the new `change-lifecycle.resolve-delivery-thread` step's position within the `change-lifecycle` flow is not pinned. The conformance tests assert only presence, count (13), and operation-set equality, so this is not a boundary risk, but the plan elsewhere pins delivery-bound spellings.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: Pin the insertion point (for example, after `change-lifecycle.comment`) in PIN-18/Phase 1.6 when the Phase 3.4 amendment is applied.

## Regression Scan Results

- **Phase 1 controls vs Phase 4/5 flips:** No re-break. The test-only controls keep declaring `resolve-delivery-thread` as a gap via `gapsExcept`; the production registrations flip independently; `withoutHandler` overrides its own capabilities; Phase 4.7 preserves write members; `runtimeCoverageViolations` is satisfied after each flip; Phase 4.8 and 8.6 re-assert.
- **Allowance coverage:** Covers every added executable in existing files (GitHub/Jira normalizers, Jira workflow map, CLI edge) and every conditional new file, without over-claiming; the single gap is the `state/closeout.ts` constant in finding 1.
- **Cross-artifact consistency:** Plan v1.3 additions align with spec v1.3 and test plan v1.2 on the operation, step, caps, identity, timeout seam, and harness members; the only mismatch is the §4.1 attribution in finding 2. No new dependency, schema, or closed-operation contradiction.
- **Phase committability:** All delivery-phase boundaries remain independently committable except Phase 3 as written (finding 1). Phase 1 is now gate-green with the added controls; Phases 2/4/5/6/7 have the allowance entries and the `content-inventory` command; Phase 8 re-runs the full battery.

## Counts

- Blocking findings: 1 (major)
- Non-blocking findings: 2 (one minor, one nit)
- Failing facets: 2 of 10 (`plan_coverage`, `plan_code_area_coverage`)
- Passing facets: 8 of 10

## Reopen Recommendation

- `delivery_planning` only, for finding 1 (and the nit in finding 3 if the same pass is used). Finding 2 is a `test_planning` item that may stay as a recorded accepted risk; it does not block.
- This issue is **mechanical**: one exported constant missing from one allowance list. No substantive design, contract, ticket-scope, or cross-artifact contradiction was found. The Phase 1 conformance remediation (the larger iteration-3 finding) is correct and complete.
- Never reopen `delivery` for these findings.

## Accepted Risks

- None declared as accepted by this iteration, because the verdict is NOT_READY. If finding 1 is amended and finding 2 is left in place, finding 2 is the only candidate accepted risk (test plan §4.1 omits the additive `readWorkItemObservation` carrier while PIN-14/PIN-15 and Phase 2.7 include it; no test is affected).

## Verification Notes

- No source, spec, test plan, plan, PM notes, or decision record was modified. Only this readiness-review record was written. No git operations were performed.
- No builds or tests were run; verification was static/read-only (file reads, `rg`/`grep`, exact-fixture and allowance inspection against the current tree).
- The `readiness-review/` folder contained iterations 1-3 at the start; this is iteration 4. Resolved iteration-3 findings are recorded above and are not repeated as new gaps.
- Iteration-3 non-blocking findings 4, 5, 6, 7 are not re-litigated here; the v1.3 changelog states the intended remediations (PIN-14/PIN-15 scoping, SHA-256 regeneration note, `GitChildRunner` seam, DEC-7 wording), and no regression in those areas was found during the bounded scan.
