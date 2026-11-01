# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-183
Date: 2026-11-01
Pause Required: yes

## Scope Reviewed

- Ticket: GitHub `juliusz-cwiakalski/agentic-delivery-os` issue 183, "M0-S14: closeout v1 with branch cleanup" (OPEN; goal/tasks/AC=M0-S14; depends on M0-S19; unblocks M1-S12; one PM scope-decision comment dated 2026-11-01). Read via `gh issue view 183 --comments`.
- Change artifacts: `chg-GH-183-spec.md` (v1.3, 61 ACs), `chg-GH-183-test-plan.md` (v1.2, 67 TCs), `chg-GH-183-plan.md` (v1.2, 12 phases, PIN-1..PIN-20, D1..D17), `chg-GH-183-pm-notes.yaml`.
- Decision records: `doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md`; decision context: ADR-0003, ODR-0003.
- Current truth inspected statically: `packages/core/src/contracts/{adapter-capabilities,ports,error-table,state}.ts`, `packages/adapters/src/io/provider-transport.ts`, `packages/testkit/src/conformance/{flows,runner,coverage,types,mock-tenant}.ts`, `packages/cli/src/{index,edge}.ts`, `packages/cli/src/commands/index.ts`; `tests/structure/{conformance-coverage,error-table,port-contract-inventory,content-inventory,provider-surface,registry-imports,trap-catalog}.test.ts`; `tests/conformance/{mock-conformance,broken-adapter-control}.test.ts`; `tests/conformance/live/{live-entrypoint.test.ts,run-live.ts}`; `tests/behaviour/providers/{support,provider-capabilities,github-inputs}.test.ts`; `tests/types/provider-views.type-test.ts`; `tests/checks/{fixture-sanitization,error-table-sync}.test.ts`; `.dependency-cruiser.cjs`; `doc/spec/features/feature-provider-client-seeds.md`, `feature-adapter-ports.md`; `doc/planning/oss-tooling/{backlog,cli-command-registry}.md`; `doc/decisions/ADR-0003...`, `ODR-0003...`, TDR-0008.
- Iteration-1/2 reviews re-checked. Resolved findings are not repeated; the iteration-2 blocking findings are re-verified below. Prior `readiness-review/` contained iterations 1-2; this is iteration 3.

The ticket is substantively covered: ticket-to-done, label sweep, unassign, owed-flip, comment resolution, checkout restore, squash-safe local cleanup, and idempotent re-run are all represented; harness telemetry is explicitly deferred to M1-S11. The verdict is driven by two plan blast-radius gaps that make phase boundaries red as written, not by missing ticket scope.

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

## Findings

### Blocking findings (must-fix)

1. **[major] plan_code_area_coverage / plan_coverage** — `chg-GH-183-plan.md` Phase 1.6 (line 328), Phase 1 code areas (line 346), Phase 1 tests (line 360); existing `tests/conformance/mock-conformance.test.ts` `ALL_OPERATIONS`/`gapsExcept` (lines 130-149), `tests/conformance/live/live-entrypoint.test.ts` `ALL_OPERATIONS`/`gapsExcept` and `liveControl` (lines 166-200, used by the live-read-only deferral test at lines 431-442), `tests/conformance/broken-adapter-control.test.ts` explicit `declaredGaps` (lines 190-201); `packages/testkit/src/conformance/runner.ts` fail-closed branch (lines 605-610, 766-770).
   - Gap: Phase 1 appends `resolve-delivery-thread` to `ADAPTER_OPERATIONS` and adds a 13th `change-lifecycle.resolve-delivery-thread` step, but the hardcoded operation/gap lists in the conformance controls are not updated. The `liveControl` registration supports only `read-work-item` + `write-comment` and derives its gaps from a seven-operation `ALL_OPERATIONS`; after the new step, the runner reaches `resolve-delivery-thread` unsupported with no declared gap and `failClosed` throws before any report. `runLive` does not catch that throw, so the "supported non-read step is a live-read-only deferral" test fails. The same seven-operation `ALL_OPERATIONS`/`gapsExcept` pattern in `mock-conformance.test.ts` drives many test-only controls and fails closed the same way. `broken-adapter-control.test.ts`'s `withoutHandler` explicit gap list becomes vacuous (it now throws on the new undeclared gap instead of exercising the intended supported-non-read-without-handler branch). The plan names only `mock-conformance.test.ts`'s production matrix/Jira gap assertions for Phase 1, and lists `live-entrypoint.test.ts` only in Phases 4 and 8 (method+URL and integrated-control re-assertion), not Phase 1, so Phase 1's own `bun test tests/conformance` is red as written.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: Add `resolve-delivery-thread` to (or derive from `ADAPTER_OPERATIONS`) the `ALL_OPERATIONS` lists in `mock-conformance.test.ts` and `live-entrypoint.test.ts`; add the new gap to the `broken-adapter-control.test.ts` explicit gap list so its control remains non-vacuous; name all three updates in Phase 1.6 and add them to the Phase 1 code areas/tests while keeping `bun test tests/conformance` as the Phase 1 boundary command.

2. **[major] plan_code_area_coverage / plan_coverage** — `chg-GH-183-plan.md` Phase 2.6 (line 378), Phase 3.2 (line 417), Phase 3.4 (line 419), Phase 3 tests (line 447), Phase 4.2 (line 461), Phase 4/5 tests (lines 490-504, 542-551), Phase 5.1/5.2 (lines 516-517), Phase 7.2 (line 610), Phase 7.5 (line 613), Phase 7 tests (line 639); existing `tests/structure/content-inventory.test.ts` `EXECUTABLE_ALLOWANCES` for `core/src/domain/closeout.ts`, `cli/src/edge.ts` (lines 195-205), `adapters/src/github/normalize.ts` (lines 413-419), `adapters/src/jira/normalize.ts` (lines 405-409), `adapters/src/jira/workflow-map.ts` (lines 436-440), and `executableViolations` (lines 483-540).
    - Gap: `content-inventory` fails on any exported executable name absent from a file's allowance. The plan adds executable exports to existing allowance-governed files but the per-phase tasks only name the new files: Phase 3.2 adds `runCloseout` to `domain/closeout.ts` (it must be exported for the Phase 7 CLI; the sibling `closeout-run.ts` alternative is also an unlisted new file) while Phase 3.4 updates only `state/closeout.ts`; Phase 4.2 adds `normalizeMergedDeliveryRequestList`, `normalizeIssueDependencies`, `normalizeThreadResolution`, and the observation helper to `github/normalize.ts` — these must be exported for `client.ts` to import them; Phase 5.1/5.2 add Jira write/normalization exports; Phase 7.2 adds `createCloseoutCommandRuntime` to `edge.ts` (if it follows the exported-runtime pattern of the existing commands). Phase 3 and Phase 7 run `bun test tests/structure/content-inventory.test.ts`, so those boundaries are red as written; Phases 4/5 do not run the gate at all, so the failure surfaces only at Phase 8. D13 says every phase boundary keeps this gate green, but the per-phase test commands for Phases 4/5/6 omit it. Conditional new files (`github/closeout.ts`, `jira/closeout.ts`, `domain/closeout-run.ts`) also lack an inventory/allowance task.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: Add the new executable exports to the correct `EXECUTABLE_ALLOWANCES` entries in the same phase (`runCloseout` in Phase 3, `createCloseoutCommandRuntime` in Phase 7, the normalizers in Phases 4/5), add `bun test tests/structure/content-inventory.test.ts` to Phases 4/5/6, and give every conditional new file an inventory/allowance task in its phase.

### Non-blocking findings

3. **[minor] cross_artifact_consistency** — `chg-GH-183-test-plan.md` §4.1 item 2 (lines 226-228); `chg-GH-183-plan.md` PIN-1 (line 79), PIN-14 (line 92), PIN-15 (line 93), Phase 2.7 (line 379).
   - Gap: the `CloseoutProviderRuntime` harness contract lists `readWorkItem`, `readDeliveryRequest`, the merged-request lookup, `listBlockedByDependents`, the write members, and the scripted hooks, but omits the `readWorkItemObservation` carrier that PIN-14/PIN-15 pin as the additive observation member. The fake must implement the contract type, so the binding harness contract is one member short of the plan.
   - Suggested remediation target phase: `test_planning`
   - Suggested fix: Add `readWorkItemObservation` (returning the discriminated `CloseoutReadObservation`) to the §4.1 provider fake contract and keep the scripted hooks attached to it.

4. **[minor] cross_artifact_consistency** — `chg-GH-183-plan.md` PIN-14 (line 92), PIN-15 (line 93), Phase 4.3 (line 462), Phase 5.1 (line 516); Phase 1.6 (line 328).
   - Gap: PIN-14/PIN-15 say the existing `readWorkItem` return shape and its consumers (including `packages/testkit/src/conformance/types.ts`) "need no edits", while Phase 1.6 adds `writeWorkItem?`, `transitionWorkItem?`, and `resolveDeliveryThread?` to that same file. The carrier is additive, but the "no edits" claim is broader than the change.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: Scope the "need no edits" statement to the unchanged `readWorkItem` return shape; the conformance client member additions remain an explicit Phase 1 edit.

5. **[minor] test_traceability** — `chg-GH-183-test-plan.md` TC-CLOSE-018 step 2 (lines 974-985).
   - Gap: the fixed canonical closeout tuple is asserted against a "committed expected digest", but the test-only `node:crypto` cross-check is specified over "parameterized inputs". If the fixed tuple is not included in that cross-check, a self-generated digest would prove only self-consistency. The `""`/`"abc"` KATs and the FNV-1a/omitted-context mutants largely mitigate this.
   - Suggested remediation target phase: `test_planning`
   - Suggested fix: Explicitly include the fixed canonical closeout tuple in the `node:crypto` cross-check (or commit a digest independently reproduced by `node:crypto`).

6. **[minor] plan_coverage** — `chg-GH-183-plan.md` PIN-16 (line 94), Phase 6.1 (line 563), Phase 6.7 (line 569).
   - Gap: the behavioral git-timeout evidence requires an injected "child runner" that never resolves, but PIN-16's `GitBranchSeamOptions` only pins `timeoutMs`; a non-terminating child cannot otherwise be driven without a real hanging process, and the seam forbids arbitrary commands. The seam must be explicit for the test to be hermetic.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: Pin an injected child-runner/`execFile` option in `GitBranchSeamOptions` (test-only injection) and reference it in Phase 6.7.

7. **[minor] decision_capture** — `chg-GH-183-spec.md` F-3/DM-9/DEC-7 (lines 153, 441, 573); `chg-GH-183-pm-notes.yaml` idempotency decision (line 27); ticket PM comment; ADR-0003 (line 866).
   - Gap: `capabilityContext` is a deliberate additive refinement of the accepted ADR-0003 identity formula and is now stated accurately in the spec/plan/test plan, but the original PM-notes idempotency entry and the ticket comment still restate only the ADR-0003 inputs. The refinement is recorded only as change-level DEC-7.
   - Suggested remediation target phase: `specification` / PM notes (non-blocking; no prior closeout ids exist)
   - Suggested fix: Add an ADR-0003 addendum note or an explicit "ADR-0003 + DEC-7" statement to the PM record if the owner treats the identity-formula change as system-level; otherwise record it as an accepted risk.

## Iteration-2 Finding Resolution Status

| # | Iteration-2 finding | Status | Evidence |
|---:|---|---|---|
| 1 | TC-CLOSE-018/063/064 not aligned to the plan's SHA-256 KAT/behavioral-timeout/mutants | Resolved | TC-CLOSE-018 now asserts the `""`/`"abc"` KATs (verified correct: `e3b0c442...`, `ba7816bf...`), a fixed canonical tuple, a test-only `node:crypto` cross-check, capability-context sensitivity, and FNV-1a/omitted-context mutants; TC-CLOSE-063 now specifies the structural `CLOSEOUT_OPERATION_TIMEOUT_MS` removal control plus behavioral never-resolving provider/git aborts with a short injected timeout; TC-CLOSE-064 and §6.2 include the expanded mutant corpus. |
| 2 | §4.1 harness contract missing `listBlockedByDependents`, `isClean`, `resolveRef`, and scripted hooks | Resolved | §4.1 item 2 now lists `listBlockedByDependents` and `fakeNotFound`/`fakeInvalidPayload`/`fakeUnavailableSurface`/`fakeUnavailableRelation`/`fakeUnknownRelation`; item 3 lists `isClean`/`resolveRef`; synchronized with PIN-14/PIN-15/PIN-16 and Phases 3.7/3.8/4.6/5.5/6.6. Residual nit: the `readWorkItemObservation` carrier is still missing from §4.1 (finding 3). |
| 3 | Conformance blast radius for the Phase 4 write flip | Partial — Phase 4 fix present; Phase 1 blast radius missed | Plan Phase 4.7 now names `broken-adapter-control.test.ts` (preserve write members or `writeHandler`), `live-entrypoint.test.ts` (method+URL), and `bun test tests/conformance`; verified against the runner/coverage code and both files. The same class of gap remains for the Phase 1 step addition: the hardcoded `ALL_OPERATIONS`/`gapsExcept` helpers in `mock-conformance.test.ts` and `live-entrypoint.test.ts` and the explicit gap list in `broken-adapter-control.test.ts` are not updated in Phase 1 (blocking finding 1). |
| 4 | ODR-0003 acceptance is GH-186, TDR-0008 is GH-183 | Resolved | Spec v1.3 lines 49/418/DEC-1/Appendix E; plan line 42 and PIN-11; test plan §2; ODR-0003 confirms GH-186 and "no authority until then"; TDR-0008 confirms GH-183. |
| 5 | `capabilityContext` as an additive refinement over ADR-0003 | Resolved in artifacts; minor governance wording remains | Spec F-3/DM-9/DEC-7, plan PIN-12, test plan DM-9/TC-018 all state the additive DEC-7 refinement; PM notes line 86 records it; the historical PM idempotency entry remains (finding 7). |
| 6 | GitHub reverse-read surface | Resolved | Spec §12 and §8.4, plan Assumptions and D7, test plan A-T8/OQ-T5 all record the implementation-confirmed assumption and the absent-surface provider gap vs present-but-unavailable signal skip. |
| 7 | Read-observation carrier pin | Resolved | Plan PIN-14/PIN-15/Phase 4.3/5.1 pin `readWorkItemObservation`; existing `readWorkItem` shape unchanged. Residual wording nit: finding 4. |
| 8 | BR-13/BR-14 fixture ownership | Resolved | Test plan §6.2 (line 2325) says `branch.ts` covers BR-01..BR-12 and TC-066's temp-repo harness owns BR-13/BR-14; plan PIN-19/Phase 6.5 match. |
| 9 | Multi-extra positional behavior | Resolved | Spec F-1/§8.1, plan PIN-17, test plan G-09/TC-012 define one extra as handler `input.value.rejected` and two-or-more as parser `fallback.invocation`; verified against `packages/cli/src/index.ts` `positionals.max` semantics. |
| 10 | New provider-subpath export ambiguity | Resolved | Plan Phase 4.4 forbids a new provider-subpath export; `EXPECTED_SURFACE` unchanged; only the capability array and `Object.keys(client)` list update. |
| 11 | `FixtureRoute.method` optionality | Resolved | Plan PIN-19 pins optional `method` defaulting to `GET`; existing route fixtures stay unchanged; method+URL matching and a mismatch control are explicit. |

## Counts

- Blocking findings: 2 (both major)
- Non-blocking findings: 5 (all minor)
- Failing facets: 2 of 10 (`plan_coverage`, `plan_code_area_coverage`)
- Passing facets: 8 of 10 (`spec_completeness`, `ac_quality`, `test_traceability`, `cross_artifact_consistency`, `decision_capture`, `system_spec_consistency`, `plan_doc_update_coverage`, `dod_defined`)

## Reopen Recommendation

- `delivery_planning` (primary and only required reopen): findings 1 and 2 (plus the delivery-planning halves of 4 and 6). Both are Phase-map/allowance gaps in `chg-GH-183-plan.md`; the spec and test plan do not need another reopen.
- No `specification` or `test_planning` reopen is required for the blocking findings. Findings 3 and 5 are test-plan wording/evidence nits that can ride the same remediation pass; finding 7 is a PM-record note.
- Never reopen `delivery` for these findings.

Highest-value first pass: (1) add the new operation to the three conformance control helpers and name them in Phase 1.6/code areas/tests, and (2) add the missing `EXECUTABLE_ALLOWANCES` entries and `content-inventory` commands for Phases 3/4/5/7. Both are mechanical plan amendments; no spec or test-plan oracle changes are implied.

## Max-Iteration Escalation

This is iteration 3, the final permitted automated iteration. The gate is **NOT_READY** with a new blocking plan blast-radius gap (plus a second blocking allowance-cadence gap), so the workflow must **STOP and escalate to the human/PM**. The PM must decide between (a) reopening `delivery_planning` for the two targeted plan amendments above and re-running the gate with explicit human approval for the extra iteration, or (b) recording a human-owned override — which is **not available** under the current override rules for this change, because it has behavioral/contract impact, cross-artifact risk, and touches the conformance workflow; no `pm-notes` triviality record exists. Do not proceed to `delivery` on the strength of this artifact.

## Verification Notes

- No source, spec, test plan, plan, PM notes, or decision record was modified by this review. Only this readiness-review record was written.
- No builds, tests, or commands that mutate repository or provider state were run. Verification was static/read-only: file reads, `rg`/`grep`, exact-fixture inspection, type/contract inspection, and `gh issue view 183 --comments`.
- The `readiness-review/` folder contained iterations 1 and 2 at the start; this is iteration 3. Resolved findings are recorded in the table above and are not repeated as new gaps; the Phase 1 conformance-helper gap and the allowance-cadence gap are newly surfaced in this iteration.
- KAT verification: SHA-256("") = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` and SHA-256("abc") = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`; both values in TC-CLOSE-018 are correct.
- Boundary verification: a pure `packages/core/src/domain/sha256.ts` is the compliant shape; `node:crypto` under `packages/core/src/domain/` would violate the `runtime-apis-confinement` rule (no exact allowlist entry), and the test-only cross-check lives in `tests/**`, outside that rule's scope. No package-boundary violation found in the approach.
- Read-only/no-live-network guarantees: the plan's D10/D11/D14 and TC-CLOSE-007/008/062 remain consistent; the new `adapters/git` subpath is the only new spawn surface and the repo reader stays no-spawn. No contradiction found.
- AC/TC traceability: the spec still enumerates exactly 61 unique ACs (61 table rows) and the test plan exactly 67 unique TCs (67 scenario headings); every AC appears in the test plan §3.1 coverage table and in the plan trace (ranges are explicitly inclusive), and every TC names at least one AC in §5.1/§5.2. No uncovered AC, orphan TC, or newly vacuous TC was found in the remediated TC-018/063/064/066/067 set.

## Accepted Risks (only relevant if a future iteration returns READY)

None declared by this iteration. The two blocking findings are plan amendments, not accepted risks; the override path is unavailable for this change.
