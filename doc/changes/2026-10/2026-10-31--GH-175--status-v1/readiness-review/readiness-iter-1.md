# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-175
Date: 2026-10-31
Pause Required: no

## Inputs Reviewed

- `chg-GH-175-spec.md` (v1.2), `chg-GH-175-test-plan.md` (v1.2), `chg-GH-175-plan.md` (v1.1), `chg-GH-175-pm-notes.yaml`.
- Ticket GH-175 (open, labels `change`/`planning`, no comments), backlog M0-S6, command-registry `status` row.
- Current-truth specs: provider client seeds, state layer, provider engine, config layer, result contract, monorepo scaffold; ADR-0003/0004/0006.
- Delivered code and test assets to verify claims: `packages/core/src/{contracts,provider,state,config}`, `packages/adapters/src/{github,repo,file,credentials,io}`, `packages/cli/src/{index,edge,output,commands}`, `tests/structure/*`, `tests/behaviour/providers/*`, `tests/checks/*`, `scripts/checks/*`, `.changeset/config.json`.
- No prior readiness records (this is iteration 1).

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS (no contradiction with current-truth docs; the delivered-code drift is reported under F2)
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

Counts: 1 blocker (critical), 4 major, 3 minor, 2 nit.

## What Passed (evidence)

- Ticket AC is fully decomposed: "six sections with evidence-backed states" -> AC-F1-1/F2-1/F2-2/F16-1; "no network call is treated as a verdict" -> AC-F9-1 plus the per-collector controls. 24/24 ACs, 10/10 NFRs, 15/15 DMs and 12/12 spec risks trace to 33 TCs; TC-023 carries exactly the ten AC-F9-1 controls.
- ADR-0004/0006 absence semantics are honored: stalls use only parseable `updatedAt` (absent/invalid = unknown activity), owner hand-backs use labels only (absent `assignee` is not "unassigned"), hygiene never evaluates comments or unmapped custom fields. `WorkItem` really has optional `assignee`/`comments`/`updatedAt`.
- No-new-surface posture is credible: `SECRET_READ_ALLOWLIST` is 4 entries; `GITHUB_ADAPTER_CONTRACT.supportedOperations` is the three read ops; the GitHub index exports exactly the five asserted names; provider defaults ship no `defaultChain` and empty `chains`; `readProviderParkViews` exists and is read-only; the NFR-9/v1.2 logical-fold clarification is consistent across spec, test plan and plan without a state-layer change.
- Forbidden-literal scope is correct: the scan covers `packages/**`, root manifests/workspace files, `.gitignore` and `doc/**` (excluding `doc/changes/`, `doc/decisions/`), not `tests/**`, so the test-only `ADOS_STATUS_LIVE` literal is legal.
- Phase 7/Appendix H doc handoff is complete (new feature doc, six reconciled specs, registry, glossary, index, literal registration, doc-distribution), and the changeset group matches `.changeset/config.json` exactly (five fixed packages).
- The test plan's non-vacuity contract (canaries, restored controls, seeded deliberate calls, under/over-cap controls, mutation controls) is strong and the live smoke is correctly outside default CI.

## Findings

1. **[critical — blocker]** cross_artifact_consistency — `chg-GH-175-plan.md`#Exact error-identity reuse (line ~190) vs `chg-GH-175-spec.md`#AC-F15-1 and `chg-GH-175-test-plan.md`#TC-STATUS-029 step 3
   Gap: the plan pins `failureClass: "provider.chain.invalid"` for provider-config validation failures. `provider.chain.invalid` is an `ERROR_TABLE` row (`packages/core/src/contracts/error-table.ts`, provider domain kind), but AC-F15-1 and TC-029 require every `failureClass` to be an adapter-local class that is **not** an error-table identity (the plan's own example is `provider.payload.invalid`). Delivered as written, TC-029 fails or AC-F15-1 is silently weakened.
   Suggested remediation target phase: delivery_planning
   Suggested fix: replace the pinned class with a non-table class (e.g. `provider.config.invalid`), or drop the class and keep only the reason `provider-chain-unresolved`; update the §Exact error-identity reuse bullet. No spec change needed.

2. **[major]** cross_artifact_consistency — `chg-GH-175-plan.md`#D5 (line ~201) and rank-key note (line ~149) vs `chg-GH-175-spec.md` Appendix C/F and AC-F10-1; `chg-GH-175-test-plan.md`#TC-STATUS-007 step 2 and TC-STATUS-033 step 1; delivered `packages/adapters/src/github/client.ts` `readPipelineRun`
   Gap: the plan reuses `readPipelineRun(sha)` "unchanged" and claims its returned run count is the raw page count for the `STATUS_SOURCE_PIPELINE_LIMIT` (20) at-limit signal. The delivered client sends no `per_page` and returns `ProviderReadResult<readonly PipelineRun[]>`, so the CI read is bounded only by the server default, not the declared 20, and the spec's "raw page returned exactly the read limit" signal (F-10/DM-12/AC-F10-1) cannot be derived for CI. The plan's "at or above its declared read limit" is a normative change to a pinned rule, not a delivery spelling.
   Suggested remediation target phase: delivery_planning (specification if the constant/rule changes)
   Suggested fix: decide and record one rule: (a) the CI read gains a bounded page (optional limit or a documented fixed `per_page`) with spec §8.5/TC-022 surface wording reconciled, or (b) the CI at-limit signal is restated against the actual source page and `STATUS_SOURCE_PIPELINE_LIMIT`/Appendix F/AC-F10-1/TC-007/TC-033 are revised. Then align plan D5 and task 6.3.

3. **[major]** plan_code_area_coverage — `chg-GH-175-plan.md`#Phase 2 tasks 2.2–2.5 and Files list vs `tests/behaviour/providers/github-trap.test.ts`
   Gap: the GitHub trap assertions live in `github-trap.test.ts` (`defaultAssertions` with the three names) and that suite asserts the exact three-name `run.results` list and owns the mutation controls. Adding the four new catalog entries makes `runTrapCatalog`/`trapCoverageFailures` report four entries without assertions and breaks the exact-list assertion. Phase 2's gate runs this suite, but no task or Files entry names it, so the blast radius is incomplete and the phase gate cannot go green as planned.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add `tests/behaviour/providers/github-trap.test.ts` (four new assertions, extended exact result list, extended mutation controls) to Phase 2 tasks/files, or move the GitHub `TrapAssertions` into the new collection suite and update the old suite accordingly.

4. **[major]** plan_code_area_coverage — `chg-GH-175-plan.md`#Phase 1 tasks 1.3/1.6 and Files list; tasks 2.4/3.3/4.6/5.6 vs `tests/structure/content-inventory.test.ts` and `tests/structure/inventory.json`
   Gap: the per-file executable allowlist is `EXECUTABLE_ALLOWANCES` inside `tests/structure/content-inventory.test.ts`; `tests/structure/inventory.json` holds only the file set. Phase 1 adds `contracts/status.ts` (~30 `export const` constants) and `domain/status.ts` (two exported functions) and runs `content-inventory.test.ts` in its own gate, but its Files list omits that suite, and the tasks say to register "executable allowances" in `inventory.json`. The Phase 1 gate fails as specified.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add `tests/structure/content-inventory.test.ts` to Phase 1 Files; reword 1.3/2.4/3.3/4.6/5.6 to "inventory.json (file set) + `content-inventory.test.ts` `EXECUTABLE_ALLOWANCES` (executable exports)" for every phase that adds executable exports.

5. **[major]** cross_artifact_consistency — `chg-GH-175-test-plan.md`#TC-STATUS-002 preconditions/expected summary, mirrored by `chg-GH-175-plan.md`#Phase 4 task 4.4
   Gap: the fixture requires tracker `unknown` ("issues read fails") and changes `degraded` ("PR read fails, active change observed") together with CI `unavailable` ("no binding"). Appendix A makes CI `unavailable` only when no repository binding, and the plan's handler (4.1) does not call the issues/PR readers without a binding. No single binding state produces all three states, so the expected summary (`unknown 1, degraded 1, unavailable 3, notDelivered 1`) is unreachable through the mandated `runCli` harness.
   Suggested remediation target phase: test_planning
   Suggested fix: rebuild the fixture from a reachable combination (e.g. binding observed; issues read failed -> tracker `unknown`; PR read failed -> changes `degraded`; check-runs read failed -> CI `unknown`; providers `unavailable`; parked `unavailable`) and recompute the summary; mirror the corrected fixture in plan task 4.4.

6. **[minor]** cross_artifact_consistency — `chg-GH-175-plan.md`#Artifacts and Links (spec/test-plan rows), #Execution Log authoring row, #Plan Revision Log 1.0; `chg-GH-175-test-plan.md` front matter `last_updated`, §1.2 GAP-1, §8.2 A-T3, §8.3 gap list; `chg-GH-175-spec.md` §14 closing paragraph
   Gap: stale version references after the v1.2 reconciliation: the plan still cites spec/test plan v1.1 in the artifact table, execution-log authoring row and revision log 1.0 while its Context/summary cite v1.2; the test plan's `last_updated` (15:15) predates its own v1.2 revision-log entry (15:50); GAP-1/A-T3 "plan absent" remains although plan v1.1 now maps all 33 TCs; spec §14 still says the test plan "is not modified by this revision" (true for v1.1, stale after v1.2).
   Suggested remediation target phase: delivery_planning (test-plan metadata: test_planning)
   Suggested fix: update the plan artifact table/execution log/revision log to v1.2, bump the test plan `last_updated` and mark GAP-1/A-T3 resolved, and qualify the spec §14 sentence.

7. **[minor]** plan_coverage — `chg-GH-175-plan.md`#Pinned Delivery Spellings "Reader result types" (line ~122) and "Reason mapping" (line ~191)
   Gap: `StatusReadFailure.reason` includes `not-configured`, and `StatusLocalContextRead.reason` uses `missing`/`malformed`; none are members of the closed 20-value evidence reason set, and the plan does not state their translation to `source-unavailable` / `local-context-missing` / `local-context-malformed`. An implementation can emit an out-of-set reason and fail TC-STATUS-003 step 3.
   Suggested remediation target phase: delivery_planning
   Suggested fix: either use closed reasons directly in the reader result types, or add the explicit mapping to the plan's reason-mapping table.

8. **[minor]** plan_coverage — `chg-GH-175-plan.md`#CLI and adapter spellings `StatusComposition` (line ~179), Phase 4.3, Phase 6.4; spec DEC-5/OQ-2 and AC-F13-1
   Gap: status receives an arbitrary GitHub `ExternalSystemInstance` but no task pins the instance's construction (instance name, base URL, credential-reference auth resolving `GITHUB_TOKEN` via `CredentialPort`). The client accepts `authMethod: anonymous`, so "credential-required, no anonymous fallback" (DEC-5/OQ-2) is neither enforced nor evidenced at the edge; TC-021 step 6 only covers a credential-port failure.
   Suggested remediation target phase: delivery_planning
   Suggested fix: pin the instance construction in the edge/live-smoke task and add a control that an anonymous/credential-less instance yields a classified failure or explicit unavailable sections, never an observed read.

9. **[nit]** plan_coverage — `chg-GH-175-plan.md`#D11 and Phase 6.5 vs `scripts/checks/forbidden-literals.registry.json` scope
   Gap: the changeset is a committed user-facing release note, but the forbidden-literal scan does not cover `.changeset/*.md` and 6.5 does not restate the brand-neutral wording rule (Phase 7 does for docs). A product literal in the changeset summary would ship without a gate failure.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add "brand-neutral text; no product literal" to task 6.5. Extending the literal-scan scope is a separate change, not required here.

10. **[nit]** decision_capture — `chg-GH-175-spec.md`#DEC-6 and §14 OQ-1 vs the provider-client-seeds maintenance rule
    Gap: DEC-6 ("collection reads are the query-shaped form of an existing operation; the closed operation set and capability declaration are unchanged") is precedent-setting for how every provider surface grows, yet it lives only in the change spec. The workflow routes system/precedent-setting decisions to a decision record.
    Suggested remediation target phase: specification (route via @pm to @decision-advisor)
    Suggested fix: either author a decision record for the collection-read interpretation (or extend the provider-client-seeds maintenance-rule text explicitly in Phase 7), or have @pm record an explicit decision that it stays change-local. No implementation change.

## Remediation Routing

- **test_planning**: F5 (TC-STATUS-002 fixture/expected summary). Plan task 4.4 must mirror the fix.
- **delivery_planning**: F1 (failureClass), F2 (CI bounded page/at-limit rule), F3 (github trap assertions), F4 (executable allowance home + Phase 1 files), F6 (stale version references), F7 (reader reason mapping), F8 (GitHub instance/auth), F9 (changeset brand neutrality).
- **specification**: F10 (DEC-6 decision-record routing; no behavior change).
- No finding reopens delivery. No human pause is required: OQ-1..OQ-7 and OQ-T8 remain non-blocking and no decision needs human input at this gate.

## Re-run Instruction

Re-run the DoR gate after the test-planning and delivery-planning revisions. The gate should be `READY` when: F1–F4 are corrected in the plan, F5 is corrected in the test plan and mirrored in the plan, and F6–F10 are acknowledged with the named edits. This is iteration 1 of a cap of ~3.
