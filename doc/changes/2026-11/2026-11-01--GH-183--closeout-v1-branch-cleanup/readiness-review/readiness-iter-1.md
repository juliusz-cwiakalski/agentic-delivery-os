# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-183
Date: 2026-11-01
Pause Required: no

## Scope Reviewed

- Ticket: GitHub `juliusz-cwiakalski/agentic-delivery-os` issue 183, "M0-S14: closeout v1 with branch cleanup" (OPEN; body: goal/tasks/AC=M0-S14; depends on M0-S19; unblocks M1-S12; one PM scope-decision comment dated 2026-11-01). Read via the repository tracker access.
- Change artifacts: `chg-GH-183-spec.md` (v1.1, 58 ACs), `chg-GH-183-test-plan.md` (v1.0, 64 TCs), `chg-GH-183-plan.md` (v1.0, 12 phases / 69 tasks), `chg-GH-183-pm-notes.yaml`.
- Decision record: `doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md`.
- Current truth inspected: `doc/spec/features/feature-adapter-ports.md`, `feature-provider-client-seeds.md`, `feature-result-contract.md`, `feature-state-layer.md`, `feature-status-digest.md`, `feature-queue-ready.md`, `feature-verify-change-and-exit-taxonomy.md`; ADR-0003/0004/0005/0006; ODR-0003; `AGENTS.md`, `.ai/rules/typescript.md`, `.ai/rules/testing-strategy.md`.
- Repository facts verified statically (no builds/tests run): contract/port shapes, `ADAPTER_OPERATIONS`, error-table count (35), conformance registry (3 flows / 12 steps), GET-only `ProviderRequest`, `StateStorePort`, read-only `repo` adapter, CLI parser/`db` precedent, inventory/content-inventory/port-neutrality/subpaths/provider-surface hardcoded fixtures, boundary fixture registry, trap-catalog minima and exact replay arrays, `workspace-entrypoints.ts` subpath list, and the existing provider-capability fixture.
- The `readiness-review/` folder was empty; this is a fresh iteration 1. No prior findings are repeated or marked persistent.

The ticket is substantively covered by the spec: ticket-to-done, label sweep, unassign, owed-flip, comment resolution, checkout restore, squash-safe branch cleanup, and idempotent re-run are all represented (spec §1, §5.1, §17). Harness telemetry is explicitly deferred to M1-S11, matching the ticket and backlog. The verdict is driven by cross-artifact/system-truth contradictions and plan coverage gaps below, not by missing ticket scope.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
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

1. **[critical] system_spec_consistency / cross_artifact_consistency** — `chg-GH-183-plan.md` PIN-12 (line 86) and Phase 2 task 2.1 (line 347); `doc/decisions/ADR-0003-oss-monorepo-structure.md` line 866; `chg-GH-183-spec.md` DM-9 (line 425) and §2.1.
   - Gap: the plan pins `deriveCloseoutOperationId` as **FNV-1a 64-bit** over workspace/ref/engine/operation/arguments/target. The accepted current-truth ADR-0003 defines `operationId = sha256(workspaceId, workItemRef, engine, operation, canonical args, provider target)`. The spec links ADR-0003 and describes a "deterministic digest", and the test plan TC-018 tests stability/sensitivity but never the algorithm. FNV-1a is a corruption checksum (the state ledger's role), not the ADR-mandated operation identity; a 64-bit id also weakens collision resistance for an idempotency key. This silently contradicts an Accepted decision.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: use SHA-256 as the operation-identity digest (or record a superseding decision that changes ADR-0003), and add a test asserting the algorithm, not just stability.

2. **[major] plan_coverage** — `chg-GH-183-spec.md` NFR-6 (line 470); `chg-GH-183-plan.md` PIN-9 (line 83), Phase 4/5/6 tasks (lines 424-517), Phase 8 task 8.4 (line 600); `chg-GH-183-test-plan.md` TC-063 (lines 2139-2141).
   - Gap: NFR-6 requires every operation to have a 30 s timeout and no unbounded wait. The plan declares `CLOSEOUT_OPERATION_TIMEOUT_MS = 30_000` but no task wires a timeout into the provider transport (`packages/adapters/src/io/provider-transport.ts` and the GitHub/Jira/GitLab `fetch` defaults have no `AbortSignal`) or into the git seam (`execFile`/`spawn` has no timeout). TC-063's step 1 requires the constant "referenced on its I/O class", and Phase 8.4 only "proves" the reference. The current clients have no timeout implementation.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: add timeout enforcement in Phases 4/5/6 (`AbortSignal.timeout` on provider requests, `execFile`/`spawn` timeout on the git seam), pin the behavior in the contract/plumbing, and add the structural + behavioral evidence to TC-063.

3. **[major] plan_code_area_coverage** — `chg-GH-183-plan.md` Phase 1 task 1.7 (line 309), Phase 4 code areas (line 443), Phase 5 task 5.3 (line 471), Phase 6 task 6.2 (line 512).
   - Gap: the plan omits existing exact-inventory / exact-assertion files that the new contract module, capability flips, new trap entries, and `./git` subpath force:
     - `tests/fixtures/ports/v1-contract-inventory.json` and `tests/structure/port-contract-inventory.test.ts` — a new `packages/core/src/contracts/closeout.ts` is an "unexpected contract module" in the exact fixture; the test will fail at `pnpm check`.
     - `tests/fixtures/ports/capabilities.ts` `EXPECTED_SEED_POSTURES` — must add the `resolve-delivery-thread` gap and then the GitHub/Jira supported flips; `tests/behaviour/providers/provider-capabilities.test.ts` `WRITE_METHODS` must add `resolve-delivery-thread: resolveDeliveryThread`. The plan's Phase 5 task 5.3 points at the nonexistent `tests/behaviour/provider-capabilities.test.ts`; the actual path is `tests/behaviour/providers/provider-capabilities.test.ts`.
     - `tests/behaviour/providers/github-trap.test.ts` and `jira-trap.test.ts` — exact `run.results.map(...).toEqual([...])` arrays and `defaultAssertions` maps must include the new trap entries; the plan only adds new `github-closeout.test.ts` / `jira-closeout.test.ts`.
     - `scripts/checks/workspace-entrypoints.ts` — `ADAPTER_SUBPATHS` (and the derived `EXPECTED_ENTRYPOINTS` entries for cli/mcp/opencode/testkit) is a hardcoded list; the new `./git` subpath must be added or `workspace-entrypoints`/`pnpm check:boundaries` fails.
     - `tests/structure/provider-surface.test.ts` — hardcoded `GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations` and `Object.keys(client)` arrays must change when Phase 4 flips writes and adds client methods; the plan task 4.4 only mentions the exported set "if needed".
     - `tests/conformance/mock-conformance.test.ts` — the Jira gap-reason assertions and GitHub operation matrix must be updated when Phase 5 flips writes; the plan mentions the file in Phase 4 but not the Phase 5 Jira change.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: add these files/fixtures to the per-phase code-area lists and phase-boundary test lists; add `bun test tests/structure/port-contract-inventory.test.ts` to Phase 1 and `bun test tests/behaviour/providers/provider-capabilities.test.ts` to Phase 1/4/5.

4. **[major] plan_coverage / phase sequencing** — `chg-GH-183-plan.md` Phase 2 task 2.6 (line 352), Phase 7 task 7.1/7.2 (lines 554-555); `chg-GH-183-test-plan.md` TC-010/TC-011 (lines 742-779).
   - Gap: Phase 2 adds `tests/behaviour/closeout-plan.test.ts` for TC-010/TC-011, but those TCs execute `closeout GH-183 --json` and `--apply` through the in-process CLI composition, which only lands in Phase 7. Phase 2's own test command would fail or the tests would be written below the TC's required oracle, violating "each phase independently committable". The plan's traceability row says TC-010/011 "2, 7" but the Phase 2 task does not qualify the partial delivery.
   - Suggested remediation target phase: `delivery_planning`
   - Suggested fix: split TC-010/011 into planner-level Phase 2 assertions and CLI-level Phase 7 assertions (or move the CLI-level `closeout-plan.test.ts` to Phase 7) and record the split in the traceability table.

5. **[major] spec_completeness / cross_artifact_consistency** — `chg-GH-183-spec.md` §8.4 provider coverage (lines 438-444), F-7 (lines 186-194), DEC-16 (line 560); `chg-GH-183-plan.md` line 67; `chg-GH-183-test-plan.md` TC-036 (line 278, §5.2 lines 1410-1433); `doc/spec/features/feature-provider-client-seeds.md` line 94.
   - Gap: the spec's §8.4 table claims GitHub supports "all seven steps", but F-7/DEC-16 permit a declared gap when reverse-dependent/relation reads are unavailable, and the plan explicitly says GitHub's bounded issue-dependencies read may be unavailable and the step becomes a gap. The capability declaration has no reverse-read flag, and `WorkItem.relations` is a required array; the GH-188 current truth says GitHub relations can be an absent provider signal represented as `[]`. The engine therefore cannot distinguish "no blockers" from "unknown" for a candidate, which can violate "unknown is never satisfied" for owed-flip. This is both a spec contradiction and a capability-honesty/safety risk.
   - Suggested remediation target phase: `specification` (primary) + `delivery_planning`
   - Suggested fix: choose one model — (a) represent reverse/relation-read availability explicitly (capability flag or a distinct read result) and test it, or (b) change the §8.4 table/F-7 to a conditional gap and add the corresponding test/behavior.

6. **[major] spec_completeness / test_traceability** — `chg-GH-183-spec.md` F-14 (lines 257-262); `chg-GH-183-test-plan.md` TC-003 (lines 534-561) and TC-061 (lines 2068-2093); `packages/adapters/src/github/client.ts` (HTTP failure mapping).
   - Gap: `closeout.target.unobserved` exists as an error row, but no spec flow/AC or plan task defines how the engine detects "work item not observed". The current `ProviderReadResult` only carries credential or `provider.payload.invalid` failures; a GitHub HTTP 404 becomes `providerPayloadFailure(...)`, not a not-found signal. TC-003/TC-061 "trigger fixture" for the unobserved identity can be satisfied by a fake but may be vacuous in production.
   - Suggested remediation target phase: `specification` + `delivery_planning`
   - Suggested fix: define the not-found detection/mapping in the spec (or add a not-found result class) and trace it to an AC/TC and a plan task.

7. **[major] cross_artifact_consistency** — `chg-GH-183-spec.md` DM-5 (line 421), F-6 (line 182), F-7 (line 192); `chg-GH-183-plan.md` PIN-4 (line 78); `chg-GH-183-test-plan.md` TC-027 (line 269) and TC-031 (line 273).
   - Gap: DM-5 describes `write-work-item` arguments as `labels.add`, `labels.remove`, `assignee`, while F-6/F-7, plan PIN-4, and the test plan use flat `{ assignee: "none" }` / `{ add: [...], remove: [...] }`. The canonical argument shape is part of the operation identity; this ambiguity can produce different ids for the same semantic write and different adapter request shapes.
   - Suggested remediation target phase: `specification`
   - Suggested fix: reconcile DM-5 to the pinned flat shape (or change PIN-4/TC-027/TC-031 to the nested shape) and state the shape once as normative.

8. **[major] cross_artifact_consistency** — `chg-GH-183-spec.md` §8.1 (lines 396-399) and F-1 (line 133); `chg-GH-183-test-plan.md` G-02/G-04 (lines 383-385); `chg-GH-183-plan.md` PIN-17 (line 91).
   - Gap: the spec says an extra positional is `fallback.invocation` and refs are "canonicalized before any source read"; the test plan G-02 expects `input.value.rejected` for `GH-183 extra`, and G-04 expects `input.value.rejected` for lowercase `gh-183`. The plan's `positionals: { max: 2 }` makes the handler reject the extra as `input.value.rejected`, and the `^[A-Z][A-Z0-9]*-\d+$` regex rejects lowercase. The queue-ready precedent canonicalizes lowercase (`gh-176` → `GH-176`), so "canonicalized" is materially ambiguous.
   - Suggested remediation target phase: `specification`
   - Suggested fix: align §8.1/F-1 with the chosen handler behavior and state explicitly that case-folding is not performed (or change the test/plan to the spec's class and canonicalization).

9. **[major] test_traceability** — `chg-GH-183-plan.md` line 65 and D3 (line 100), Phase 4 task 4.7 (line 430), Phase 5 task 5.6 (line 474); `chg-GH-183-test-plan.md` TC-002 (lines 501-532) and §3.2 (line 165); `packages/testkit/src/conformance/coverage.ts` (`runtimeCoverageViolations`, lines 235-268).
   - Gap: the plan's discovered "production write execution in mock" obligation is not represented in the test plan's TCs. TC-002 asserts registry equality and the new `resolve-delivery-thread` step, but not that the newly supported `write-work-item`/`transition-work-item`/`resolve-delivery-thread` operations execute in mock mode. The existing `runtimeCoverageViolations` invariant enforces it mechanically, but the test plan's traceability and §3.2 row omit it, and the plan's Phase 8 acceptance depends on it.
   - Suggested remediation target phase: `test_planning` (primary)
   - Suggested fix: add a TC (or extend TC-002/053/054) to assert the existing runtime-coverage invariant over the new supported writes, and map it in §3.2/§4.3 and the plan traceability table.

### Non-blocking findings

10. **[minor] test_planning** — `chg-GH-183-test-plan.md` TC-047 (lines 1697-1721); `chg-GH-183-spec.md` F-10/AC-F10-3 (lines 222, 657).
    - Gap: TC-047's precondition requires a temp repo whose branch name equals each protected ref including `HEAD`. `HEAD` is not a valid local branch name, so that sub-case is impossible; the test would be vacuous or fail to construct.
    - Suggested remediation target phase: `test_planning`
    - Suggested fix: assert `HEAD` protection through the resolved-base/current-checkout logic or contract data only; keep branch-name cases for `main`, `main-tools`, and the resolved base.

11. **[minor] spec_completeness / ac_quality** — `chg-GH-183-spec.md` F-9 (line 207), AC-F9-1 (line 651); `chg-GH-183-test-plan.md` TC-041 (lines 1539-1564).
    - Gap: F-9 adds "detached at the delivery head" behavior, but AC-F9-1 covers only "current checkout is the delivery branch" and the test plan has no detached-HEAD case. A specified behavior is not traceable to an AC/TC.
    - Suggested remediation target phase: `specification` + `test_planning`
    - Suggested fix: add an AC/TC for the detached-HEAD case or remove the clause from F-9.

12. **[minor] system_spec_consistency** — `chg-GH-183-spec.md` F-9 (line 204) and DEC-9 (line 553); `chg-GH-183-plan.md` PIN-1 (line 75) and PIN-8 (line 82).
    - Gap: the spec says the integration base is "declarable", but the plan hardcodes `CLOSEOUT_INTEGRATION_BASE = "main-tools"` in redistributable `@delivery-os/core`. No configuration key for an integration base exists. Installed projects would silently fall back to an ADOS-repo branch name.
    - Suggested remediation target phase: `specification` + `delivery_planning`
    - Suggested fix: read the base from declared configuration, or explicitly record the v1 hardcoded pin and its portability limit in the spec/plan.

13. **[minor] decision_capture / system_spec_consistency** — `chg-GH-183-spec.md` DEC-1 (line 545); `doc/decisions/ODR-0003-cli-command-naming-v1-lock.md` (status `Proposed`); `doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md` (status `Proposed`, `decision_date: null`).
    - Gap: the spec says the command name is "locked by ODR-0003", but ODR-0003 is `Proposed` and states it "grants no authority" until owner acceptance; TDR-0008 is also `Proposed` with owner acceptance at GH-183 PR review. The decision is captured in the right place and the acceptance path is explicit, so this is a wording/authority issue, not a missing decision.
    - Suggested remediation target phase: `specification` (wording) / PM notes
    - Suggested fix: phrase the authority accurately (registry row + proposed lock) and record owner acceptance as a PR-review condition.

14. **[minor] plan_doc_update_coverage / system_spec_consistency** — `doc/planning/oss-tooling/cli-command-registry.md` line 137; `chg-GH-183-spec.md` NG-1 (line 96); `chg-GH-183-plan.md` Phase 11 task 11.7 (line 692).
    - Gap: the command registry describes `ados closeout` as capturing harness session telemetry, while the spec excludes it (M1-S11) and the row's deferred column names M1-S11. The plan says update the registry "only if the delivered grammar differs", which would leave the description stale.
    - Suggested remediation target phase: `delivery_planning` (Phase 11)
    - Suggested fix: reconcile the registry description or explicitly note the M1-S11 deferral.

15. **[minor] plan_coverage** — `tests/behaviour/providers/support.ts` `createFixtureTransport` (lines 67-81); `chg-GH-183-plan.md` Phase 4 task 4.7 (line 430).
    - Gap: `createFixtureTransport` matches by URL only. PATCH/POST writes to the same issue/PR URLs as reads can receive a read fixture. The plan says update the transport "only if the request body must be recorded", which does not address method collision.
    - Suggested remediation target phase: `delivery_planning`
    - Suggested fix: make the fixture transport method-aware or route write tests through the `CloseoutProviderRuntime` fake; add a method-mismatch negative control.

16. **[minor] test_traceability / plan_coverage** — `chg-GH-183-plan.md` traceability row for TC-003 (line 248); `chg-GH-183-test-plan.md` TC-003 (lines 534-561) and TC-061 (lines 2068-2093).
    - Gap: TC-003 is mapped to Phase 1 only, but its trigger half (unobserved/ambiguous/failed/unsafe) requires the engine/CLI from Phases 3/7. TC-061 covers the same triggers in Phase 7, so the traceability row should include Phase 7/8 or explicitly split the trigger half.
    - Suggested remediation target phase: `delivery_planning`
    - Suggested fix: update the TC-003 trace to Phase 1 + Phase 7/8 and record that TC-061 owns the output/exit trigger half.

17. **[minor] spec_completeness** — `chg-GH-183-spec.md` DM-9 (line 425) and `chg-GH-183-plan.md` PIN-3 (line 77) vs F-3/DEC-7 (lines 157, 551), PIN-12 (line 86), test-plan TC-018 (line 260).
    - Gap: DM-9 lists identity inputs but omits the capability context that F-3/DEC-7 and TC-018 require; PIN-3 defines `engine` as `systemName`/`"git"`, not the capability context. The plan's PIN-12 adds "capability context included", but the spec's data-model definition is incomplete.
    - Suggested remediation target phase: `specification` + `delivery_planning`
    - Suggested fix: name the capability context explicitly in DM-9 and in the engine-identity definition (or in PIN-3).

18. **[minor] test_planning** — `chg-GH-183-test-plan.md` §2 reference to `tests/golden/helpers.ts` (`runCli`); actual `tests/golden/helpers.ts` imports `runCli` from `packages/cli/src/index.ts` and does not re-export it.
    - Gap: a referenced helper export does not exist; the closeout harness would need to import `runCli` directly or add an explicit helper.
    - Suggested remediation target phase: `test_planning`
    - Suggested fix: correct the reference or add the helper.

## Counts

- Blocking findings: 9 (1 critical, 8 major)
- Non-blocking findings: 9 (all minor)
- Failing facets: 6 of 10 (`spec_completeness`, `ac_quality`, `plan_coverage`, `test_traceability`, `cross_artifact_consistency`, `system_spec_consistency`)
- Passing facets: 4 of 10 (`decision_capture`, `plan_doc_update_coverage`, `plan_code_area_coverage` is FAIL, `dod_defined` is PASS; the actual passing set is `decision_capture`, `plan_doc_update_coverage`, `dod_defined` — see the facet summary above for the authoritative list)

## Reopen Recommendation

- `delivery_planning` (primary): findings 1, 2, 3, 4, 9, 15, 16; plus the delivery-side halves of findings 5, 6, 12, 13, 17.
- `specification`: findings 5, 6, 7, 8, 11, 12, 13, 17.
- `test_planning`: findings 9, 10, 11, 18.

Highest-value first pass: fix the ADR-0003 SHA-256 contradiction (finding 1), add the timeout wiring (finding 2), and add the missing existing-test/fixture updates (finding 3) before re-running the gate. Those three alone remove the largest delivery-time failure blast radius; the spec wording items (7, 8) and the capability/relation-availability model (5) are the next most consequential.

## Verification Notes

- No source, spec, test plan, plan, or PM notes were modified by this review. Only this readiness-review record was written.
- No builds, tests, or commands that mutate repository or provider state were run. Verification was static/read-only: file reads, `rg`, path existence checks, exact-fixture inspection, and `gh issue view` for the ticket.
- The `readiness-review/` folder was empty at the start; this is iteration 1 and no finding is marked persistent.
