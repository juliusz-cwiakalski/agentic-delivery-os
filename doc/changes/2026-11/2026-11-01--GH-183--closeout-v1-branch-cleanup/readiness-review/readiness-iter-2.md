# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-183
Date: 2026-11-01
Pause Required: no

## Scope Reviewed

- Ticket: GitHub `juliusz-cwiakalski/agentic-delivery-os` issue 183, "M0-S14: closeout v1 with branch cleanup" (OPEN; goal/tasks/AC=M0-S14; depends on M0-S19; unblocks M1-S12; one PM scope-decision comment dated 2026-11-01). Read via the repository tracker (`gh issue view 183 --comments`).
- Change artifacts: `chg-GH-183-spec.md` (v1.2), `chg-GH-183-test-plan.md` (v1.1, 67 TCs), `chg-GH-183-plan.md` (v1.1, 12 phases, PIN-1..PIN-20, D1..D17), `chg-GH-183-pm-notes.yaml`.
- Decision record: `doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md`; decision context: ADR-0003, ODR-0003.
- Current truth inspected statically: `packages/adapters/src/io/provider-transport.ts`, provider client seeds, `packages/core/src/contracts/{ports,adapter-capabilities,error-table}.ts`, `packages/testkit/src/conformance/{types,flows,runner,coverage,adapters,mock-tenant,artifact}.ts`, `tests/structure/{port-contract-inventory,provider-surface,conformance-coverage,error-table,port-neutrality,content-inventory}.test.ts`, `tests/conformance/{mock-conformance,broken-adapter-control}.test.ts`, `tests/conformance/live/live-entrypoint.test.ts`, `tests/behaviour/providers/{support,provider-capabilities,github-trap,jira-trap}.test.ts`, `tests/fixtures/ports/{v1-contract-inventory.json,capabilities.ts}`, `scripts/checks/workspace-entrypoints.ts`, `tests/golden/helpers.ts`, `doc/spec/features/feature-provider-client-seeds.md`, ADR-0003, ODR-0003.
- Iteration-1 review re-checked; resolved findings are not repeated. Persistent gaps are marked `persistent`.

The ticket is still substantively covered (ticket-to-done, label sweep, unassign, owed-flip, comment resolution, checkout restore, squash-safe local cleanup, idempotent re-run; harness telemetry deferred to M1-S11). The verdict is driven by artifact-synchronization and blast-radius gaps that would fail a phase-boundary test or leave the critical fixes under-verified, not by missing ticket scope.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Findings

### Blocking findings (must-fix)

1. **[major] test_traceability / cross_artifact_consistency** — `chg-GH-183-test-plan.md` TC-018 (§5.2 lines 960-985; §4.3 line 267; §7 line 2383), TC-063 (§5.2 lines 2145-2170; §4.3 line 312; §7 line 2428), TC-064/§6.2 mutant list (lines 2320, 2429); `chg-GH-183-plan.md` tasks 2.8 (line 375), 8.3 (line 649), 8.4 (line 650), trace rows lines 275/298. **Persistent (test-plan half).**
   - Gap: the plan adds the SHA-256 known-answer/algorithm evidence (KAT vectors, fixed canonical tuple, test-only `node:crypto` cross-check), the FNV-1a/omitted-capability mutant, and the behavioral short-timeout never-resolving provider/git abort under TC-018/TC-063/TC-064. The test plan's TC oracles and control lists still assert only stability/sensitivity, a structural `30 000 ms` reference, and the old mutant list. Test-plan A-T6 and the plan's own traceability preamble say any plan change to a TC's assertion must reopen the test plan; it was not reopened. This is the unresolved test-plan half of iteration-1 findings 1 and 2.
   - Suggested remediation target phase: `test_planning`
   - Suggested fix: update TC-018 to assert the algorithm, not just stability (KAT `""`/`"abc"`, a fixed canonical closeout tuple, `node:crypto` cross-check, capability-context sensitivity, FNV-1a/omitted-context mutant); update TC-063 to name the behavioral never-resolving provider/git abort with a short injected timeout and the structural removal control; add the FNV-1a/omitted-capability, unavailable-signal-as-empty, and detached-as-unrelated mutants to §6.2/§7 as applicable; record the reopen in both revision logs.

2. **[major] test_traceability / cross_artifact_consistency** — `chg-GH-183-test-plan.md` §4.1 items 2-3 (lines 227-228); `chg-GH-183-plan.md` PIN-14/PIN-15 (lines 89-90), PIN-16 (line 91), Phase 3.7/3.8 (lines 417-418), Phase 4.6/5.5, Phase 6.6.
   - Gap: the binding in-process harness contract enumerates a `CloseoutProviderRuntime` fake without the reverse-dependent read (`listBlockedByDependents`) and without scripted not-found/invalid/unavailable/relation-signal hooks; the `CloseoutGitRuntime` fake omits `isClean` and `resolveRef`. TC-031..036 (owed-flip, relations), TC-044/TC-066 (dirty worktree / missing base), and TC-067 (not-found/invalid/unavailable) cannot be driven as specified against the stated fakes. The plan's PIN-14/PIN-15/PIN-16 and Phase 3.7/3.8/6.6 require these members.
   - Suggested remediation target phase: `test_planning`
   - Suggested fix: extend §4.1 items 2-3 to the plan's runtime members (add `listBlockedByDependents`, `isClean`, `resolveRef`) and name the scripted hooks for not-found, invalid payload, unavailable surface/signal, and unknown relation; keep the harness contract synchronized with PIN-14/PIN-15/PIN-16.

3. **[major] plan_coverage / plan_code_area_coverage** — `chg-GH-183-plan.md` Phase 4.7 (line 461), Phase 8.6 (line 652), File and Module Layout (lines 245-248); existing `tests/conformance/broken-adapter-control.test.ts` (lines 36-57) and `tests/conformance/live/live-entrypoint.test.ts` (line 261).
   - Gap: after the Phase 4 GitHub capability flip, `GITHUB_ADAPTER_CONTRACT` declares `write-work-item`, `transition-work-item`, and `resolve-delivery-thread` supported. `broken-adapter-control.test.ts` `corruptRegistration` returns a client with only read members; the runner's new "client write member then fail closed" branch will fail closed at `change-lifecycle.open-change` before returning the corrupted-read report the test expects. Separately, `live-entrypoint.test.ts` line 261 builds an inline mock transport that matches by URL only, while the plan adds write routes on the same issue/PR URLs; a POST/PATCH can receive a GET fixture. The plan names only `mock-conformance.test.ts` and `artifact.test.ts`; the broad `tests/conformance/**` glob does not specify either fix.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: add both files to Phase 4 code areas/tasks and to Phase 8.6; preserve the base client's write members in `corruptRegistration` (or supply a `writeHandler`) so the read-corruption control still returns a report; make the inline `live-entrypoint.test.ts` transport match method + URL (or route it through `createFixtureTransport`); run `bun test tests/conformance` at the Phase 4 boundary.

### Non-blocking findings

4. **[minor] decision_capture / system_spec_consistency** — `chg-GH-183-spec.md` §2.1 line 49, §8.1 line 417, DEC-1 line 565, Appendix E line 839, Authoring Guidelines line 868; `doc/decisions/ODR-0003-cli-command-naming-v1-lock.md` lines 108/181.
   - Gap: the spec/PM notes say ODR-0003 owner acceptance rides the GH-183 PR review; ODR-0003 itself records acceptance pending at the GH-186 PR review and states it grants no authority until then. TDR-0008 is correctly tied to GH-183.
   - Suggested remediation target phase: `specification` / PM notes
   - Suggested fix: state ODR-0003's proposed status and GH-186 acceptance path accurately (or record a superseding/acceptance note); keep TDR-0008's GH-183 acceptance wording.

5. **[minor] decision_capture / cross_artifact_consistency** — `chg-GH-183-spec.md` F-3 line 153, DM-9 line 440, DEC-7 line 571; `chg-GH-183-plan.md` PIN-12 line 87; ADR-0003 line 866; `chg-GH-183-pm-notes.yaml` idempotency decision line 19.
   - Gap: ADR-0003's formula is `sha256(workspaceId, workItemRef, engine, operation, canonical args, provider target)`; the spec/plan add `capabilityContext` while claiming "per ADR-0003". The PM notes and ticket decision omit the capability context. The refinement is recorded only as change-level DEC-7, not as an ADR-0003 addendum or an explicit "ADR-0003 + DEC-7" deviation statement. This is not a delivery blocker because no prior closeout ids exist, but it misstates the governing contract and leaves the decision's home ambiguous.
   - Suggested remediation target phase: `specification` (+ PM notes; route a decision addendum through `@decision-advisor` if the identity-formula change is treated as system-level)
   - Suggested fix: state the identity inputs as "ADR-0003 plus the additive capability-context input recorded in DEC-7", or record a decision/decision-record addendum; update the PM notes idempotency entry to match.

6. **[minor] system_spec_consistency** — `chg-GH-183-spec.md` §8.4 GitHub row line 460; `chg-GH-183-plan.md` Assumptions line 163 and Phase 4.3 line 457; `doc/spec/features/feature-provider-client-seeds.md` lines 86/94.
   - Gap: the spec states as fact that GitHub "has a reverse-read surface"; current truth only says GitHub list-read issues lack structured issue links and dependency truth must be treated as unavailable. The plan's `listBlockedByDependents` "issue-dependencies" read is an implementation assumption (exact response shape confirmed by fixtures), not verified current truth. If the surface is absent, F-7 requires a provider-level `skipped-gap`, not merely a signal-level `unavailable` skip; the plan does not require the adapter to distinguish an absent surface from an unavailable signal for GitHub.
   - Suggested remediation target phase: `specification`
   - Suggested fix: record the GitHub reverse-read surface as an implementation-confirmed assumption (like OQ-T2/OQ-T3) and require the adapter/runtime to yield the provider-level gap when the bounded query surface does not exist; keep the signal-level `skipped-noop` only when the surface exists and the current read is unavailable.

7. **[minor] plan_coverage / plan_code_area_coverage** — `chg-GH-183-plan.md` PIN-14 line 89 and Phase 4.3 line 457; existing `tests/types/provider-views.type-test.ts`, `tests/behaviour/providers/{github-inputs,provider-credentials,github-trap,jira-trap}.test.ts`, `packages/testkit/src/conformance/types.ts`.
   - Gap: Phase 4.3 says "a work-item read that returns the discriminated observation" but PIN-14 does not pin the carrier (a new closeout-specific read method versus an additive `observation` field on the existing `readWorkItem` result). Several existing type/behaviour/conformance consumers derive from `GithubClient["readWorkItem"]`/`JiraClient["readWorkItem"]`; changing that shape is not in the plan's code-area list. A new method is additive; changing the existing return shape is not.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: pin the additive carrier in PIN-14 (e.g. a new `readWorkItemObservation` member or an optional field on the existing result) and state that the existing `readWorkItem` return shape and its consumers are unchanged; if the shape changes, add the affected type/behaviour/conformance files to Phase 4/5.

8. **[minor] test_traceability** — `chg-GH-183-test-plan.md` §6.2 line 2317; §4.6 lines 365-366; `chg-GH-183-plan.md` Phase 6.5 line 560.
   - Gap: the fixture table says `tests/fixtures/closeout/branch.ts` covers BR-01..BR-12, while the binding branch matrix and the plan include BR-13/BR-14 (detached-HEAD clean/dirty-or-missing-base) asserted by TC-066. The fixture table's scope is stale.
   - Suggested remediation target phase: `test_planning`
   - Suggested fix: update the fixture table to BR-01..BR-14 (or state explicitly that TC-066's temp-repo harness owns BR-13/BR-14 and `branch.ts` covers BR-01..BR-12).

9. **[minor] cross_artifact_consistency** — `chg-GH-183-spec.md` F-1 line 135 and §8.1 line 413; `chg-GH-183-plan.md` PIN-17 line 92; `packages/cli/src/index.ts` parser lines 167-178.
   - Gap: the spec says "an extra positional" is `input.value.rejected`; the plan uses `positionals: { max: 2 }`, so one extra reaches the handler and is handler-rejected, but two extras are rejected by the shared parser as `fallback.invocation`. The grammar matrix tests only one extra.
   - Suggested remediation target phase: `specification` / `test_planning`
   - Suggested fix: define the multi-extra-positional behavior explicitly (handler `input.value.rejected` for up to the parser max, or state the parser-level fallback for more) and add a G-case if the distinction is intended.

10. **[minor] plan_coverage** — `chg-GH-183-plan.md` Phase 4.4 line 458; `tests/structure/provider-surface.test.ts` `EXPECTED_SURFACE` lines 31-42.
    - Gap: Phase 4.4 permits `packages/adapters/src/github/index.ts` to gain a new exported type "if required" while also saying "keep the provider-surface set pinned". A new exported type necessarily changes `EXPECTED_SURFACE`, so the instruction is internally ambiguous.
    - Suggested remediation target phase: `delivery_planning`
    - Suggested fix: state whether any new export is allowed; if not, keep all new types internal or in core contracts; if yes, add the `EXPECTED_SURFACE` update to the same task.

11. **[minor] plan_coverage** — `chg-GH-183-plan.md` PIN-19 line 94 and Phase 4.7 line 461; `tests/behaviour/providers/support.ts` `FixtureRoute` lines 15-19.
    - Gap: the plan requires method-aware `createFixtureTransport` but does not say whether `FixtureRoute.method` is required or optional; every existing route fixture currently has no `method`, so a required field forces edits across the provider fixture corpus not listed in the plan.
    - Suggested remediation target phase: `delivery_planning`
    - Suggested fix: pin the route shape (optional `method` defaulting to `GET`, or required with an explicit bulk fixture edit task) and add the affected fixture files to Phase 4.

### Iteration-1 finding resolution status

| # | Iteration-1 finding | Status | Evidence / note |
|---:|---|---|---|
| 1 | FNV-1a vs ADR-0003 SHA-256 | Partial — design fixed; test-plan half persistent | Spec DM-9/F-3 and plan PIN-12/Phase 2 use pure SHA-256; TC-018 still lacks the algorithm/KAT assertion (finding 1) |
| 2 | 30 s timeout wiring | Partial — wiring fixed; test-plan half persistent | Plan PIN-9/D16/Phases 4/6/8 wire `AbortSignal.timeout` and git `timeout`; TC-063 still lacks the behavioral never-resolving abort (finding 1) |
| 3 | Missing exact-inventory/assertion files | Resolved | Plan Phases 1.8/1.9/4.4/4.6/5.3/5.5/6.2 and file layout list `v1-contract-inventory.json`, `port-contract-inventory.test.ts`, `EXPECTED_SEED_POSTURES`, `WRITE_METHODS`, trap replay arrays/`defaultAssertions`, `workspace-entrypoints.ts`, `provider-surface.test.ts`, `mock-conformance.test.ts` |
| 4 | TC-010/011 phase split | Resolved | Plan trace row and tasks 2.7/7.6 split planner-level Phase 2 from in-process CLI-level Phase 7 |
| 5 | Owed-flip conditional model | Resolved | Spec F-7/DEC-16/§8.4, test TC-034/TC-036, plan PIN-14/15 + Phase 3.7 distinguish no-surface gap from unavailable-signal skip; asserted-empty eligibility |
| 6 | Not-found vs `provider.payload.invalid` | Resolved | Spec F-4/AC-F4-4/DM-11, plan PIN-14/15/Phase 3.6, test TC-067 distinguish not-found, invalid, unavailable |
| 7 | Flat `write-work-item` args | Resolved | Spec DM-5, plan PIN-4, test TC-027/TC-031 use flat `{ add, remove, assignee }` |
| 8 | Extra positional / case-sensitive refs | Resolved for the tested case; minor edge remains | Spec F-1/§8.1, test G-02/G-04, plan PIN-17 reject `GH-183 extra`/`gh-183` as `input.value.rejected`; multi-extra case is finding 9 |
| 9 | Runtime-coverage invariant | Resolved | TC-065 plus plan D3/Phases 4/5/8 assert `runtimeCoverageViolations` empty over new supported writes |
| 10 | HEAD protected-ref impossible case | Resolved | Test TC-047/§4.6 BR-03 assert HEAD via contract/resolved-base/current-checkout data, not a branch named HEAD |
| 11 | Detached-HEAD restore | Resolved | Spec AC-F9-5, test TC-066/BR-13/BR-14, plan Phase 2.5/6.5/8.5 |
| 12 | Integration base pinned `main-tools` | Resolved | Spec F-9/DEC-9/DM-7, plan PIN-8, test TC-058; no invented config key |
| 13 | ODR-0003/TDR-0008 authority wording | Partial — minor | TDR-0008 correct (Proposed, GH-183 PR); ODR-0003 acceptance is GH-186, not GH-183 (finding 4) |
| 14 | Registry description update | Resolved | Plan Phase 11.7 makes the update unconditional and names the M1-S11 deferral |
| 15 | Method-aware `createFixtureTransport` | Partial — behavior fixed; blast radius incomplete | Plan PIN-19/Phase 4.7 add method + URL and a mismatch control; two existing conformance transports are not listed (finding 3) |
| 16 | TC-003 phase split | Resolved | Plan trace splits Phase 1 contract/table from Phase 7/8 trigger/envelope/exit with TC-061 |
| 17 | Capability context in operation identity | Resolved in DM-9/PIN-3/PIN-12; governance wording minor | Spec DM-9/F-3/DEC-7 and plan PIN-12 include it; ADR-0003/PM-notes wording is finding 5 |
| 18 | `runCli` helper reference | Resolved | Test plan §2 now says `runCli` is imported directly from `packages/cli/src/index.ts` and not re-exported by `tests/golden/helpers.ts`; the file matches |

## Counts

- Blocking findings: 3 (all major; no critical)
- Non-blocking findings: 8 (all minor)
- Failing facets: 5 of 10 (`plan_coverage`, `test_traceability`, `cross_artifact_consistency`, `system_spec_consistency`, `plan_code_area_coverage`)
- Passing facets: 5 of 10 (`spec_completeness`, `ac_quality`, `decision_capture`, `plan_doc_update_coverage`, `dod_defined`)
- Iteration-1 status: 15 fully resolved, 3 partial (findings 1, 2, 13), 2 of those partials have persistent test-plan/plan gaps

## Reopen Recommendation

- `test_planning` (primary): findings 1, 2, 8 (and the test-plan half of 9).
- `delivery_planning`: findings 3, 7, 10, 11.
- `specification`: findings 4, 5, 6, 9 (minor; can ride the same remediation pass).
- Never reopen `delivery` for these findings.

Highest-value first pass: (1) bring TC-018/TC-063/TC-064 into line with the plan's SHA-256 and behavioral-timeout evidence, (2) complete the §4.1 harness contract with the reverse-dependent read and git safety members, and (3) add `broken-adapter-control.test.ts` and the `live-entrypoint.test.ts` inline transport to Phase 4. Those three remove the remaining phase-boundary failures and restore test-plan-to-plan consistency; the spec wording/governance items (4-6) are the next most consequential.

## Verification Notes

- No source, spec, test plan, plan, or PM notes were modified by this review. Only this readiness-review record was written.
- No builds, tests, or commands that mutate repository or provider state were run. Verification was static/read-only: file reads, `rg`/`grep`, path and exact-fixture inspection, type/contract inspection, and `gh issue view 183 --comments` for the ticket.
- The `readiness-review/` folder contained only `readiness-iter-1.md` at the start; this is iteration 2. Findings that persist from iteration 1 are marked `persistent`; resolved findings are recorded in the table above and are not repeated as new gaps.
- No accepted-risk override applies. The override is unavailable for this change (behavioral/contract impact, cross-artifact risk, workflow-relevant surfaces); no `pm-notes` triviality record exists.

## Accepted-Risk Assessment (context, not a READY verdict)

- **Pure `packages/core/src/domain/sha256.ts`:** acceptable on boundary grounds. `node:crypto` is a `core` dependency and the `runtime-apis-confinement` rule forbids it under `packages/**` outside the exact allowlist; the domain tier may import only `./contracts`; a no-import pure module is the compliant shape. Known-answer vectors plus a test-only `node:crypto` cross-check are adequate mitigation **provided** the test plan actually specifies them (blocking finding 1). No package-boundary violation.
- **Additive transport widening (`ProviderHttpMethod` set + `body?` + `timeoutMs?`):** does not by itself violate the boundary/conformance/live-read-only rules. Reads remain `GET`; the live runner already rejects non-`GET` (`tests/conformance/live/run-live.ts` lines 208-225); the mock-tenant/runner/support updates are in the plan. The two unlisted conformance-helper updates are blocking finding 3.
- **New ACs (AC-F4-4, AC-F7-7, AC-F9-5) and new TCs (065/066/067):** traceable to the coverage tables and plan phases, and non-vacuous via the stated mutants/controls. No new vacuous AC/TC was found.
- **No-new-dependency and read-only guarantees:** no contradiction found in the remediation; the plan's D15/D10/D11 and the unchanged status/queue/verify suites remain consistent.
