# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-175
Date: 2026-10-31
Pause Required: no

## Inputs Reviewed

- `chg-GH-175-spec.md` (v1.3), `chg-GH-175-test-plan.md` (v1.3, `last_updated` 2026-10-31T16:20Z), `chg-GH-175-plan.md` (v1.2, `last_updated` 2026-10-31T16:45Z), `chg-GH-175-pm-notes.yaml`.
- Iteration-1 record: `readiness-review/readiness-iter-1.md`.
- Ticket GH-175 (open; labels `change`, `planning`), backlog M0-S6, command-registry `status` row.
- Current-truth specs and delivered assets used to verify claims: `doc/spec/features/{feature-provider-client-seeds,feature-state-layer,feature-provider-engine,feature-config-layer,feature-result-contract,feature-monorepo-scaffold-toolchain}.md`; `packages/core/src/contracts/{error-table,ports,credentials}.ts`; `packages/adapters/src/github/client.ts`; `tests/behaviour/providers/{github-trap.test.ts,trap-harness.ts}`; `tests/structure/{trap-catalog.test.ts,content-inventory.test.ts,inventory.json}`; `.changeset/config.json`.

## Disposition of Iteration-1 Findings

| # | Iter-1 severity | Disposition | Evidence |
|---|---|---|---|
| 1 | critical (blocker) | **FIXED** | All artifacts now pin provider-config validation as `failureCode: "config.value.invalid"` + reason `provider-chain-unresolved` + no `failureClass`, and config resolution as `config-invalid` + the relevant existing `config.*` code. `provider.chain.invalid` is named only as forbidden. Spec F-15/DM-4/DM-9/AC-F15-1; plan lines 120/123/191/192/205/5.3/5.6; no artifact assigns a `provider.*` table row to `failureClass`/`failureCode`. |
| 2 | major | **FIXED** | Spec F-5/§8.4/§8.5/Appendix C/Appendix F, test plan TC-007/014/022/033, and plan D5/2.1/4.3/6.3 all say one bounded `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20) page, no pagination, raw page size drives `source-truncated`. The only "all runs" text is the historical revision-log note recording the replaced reading. The five exported GitHub names are unchanged; `readPipelineRun` keeps its name and gains the optional declared limit plus raw-page reporting. |
| 3 | major | **FIXED** | Plan Phase 2 names `tests/behaviour/providers/github-trap.test.ts`; task 2.4 extends `defaultAssertions` with the four new names, extends the exact `run.results` list from three to seven, and extends the mutation controls; the Phase 2 Files list includes the suite. |
| 4 | major | **FIXED** | Plan Phase 1 names `tests/structure/content-inventory.test.ts`; tasks 1.3/2.4/3.3/4.6/5.6 distinguish `tests/structure/inventory.json` (file set) from `EXECUTABLE_ALLOWANCES` in `content-inventory.test.ts` (executable exports). |
| 5 | major | **FIXED** | Test plan TC-STATUS-002 now uses a reachable fixture: binding `observed`; issues read fails → tracker `unknown`; PR read fails with active change observed → changes/PRs `degraded`; check-runs read fails → CI `unknown`; providers `unavailable`; parked `unavailable`; lanes `not-delivered`; summary `{sections:6, observed:0, degraded:1, unknown:2, unavailable:2, notDelivered:1, actionable:0}`. Plan task 4.4 mirrors the fixture and summary and explicitly rejects the unreachable no-binding combination. |
| 6 | minor | **PARTIALLY FIXED** | Current-version pointers now align: the plan artifact table, execution log, and revision log cite spec/test plan v1.3; the test plan `last_updated` matches its v1.3 revision-log entry; GAP-1/A-T3 are marked resolved. Residual: spec §14 and the spec v1.3 revision log still say the test plan was reconciled to v1.2, although it is v1.3. See F-3. |
| 7 | minor | **FIXED** | Plan lines 123/192 give the explicit reader-local translation: `not-configured` → `source-unavailable`, `missing` → `local-context-missing`, `malformed` → `local-context-malformed`; all other reader reasons (`read-failed`, `credential-unavailable`, `commit-unresolved`, `config-invalid`, `provider-chain-unresolved`, `state-unreadable`) are members of the closed 20-reason set. |
| 8 | minor | **PARTIALLY FIXED** | The instance is pinned (base URL `https://api.github.com`, `systemKind: "vcs"`, `credential-reference` to a `GITHUB_TOKEN` source through `CredentialPort`) and the plan names credential-less/anonymous controls (tasks 2.3, 4.4, 5.4, 6.4; D5; task 4.3). Residual: the plan does not specify the status-edge guard that makes an injected `authMethod: anonymous` instance classify rather than read, and the delivered client still honours the anonymous branch. See F-2. The test plan also does not contain the anonymous control (see F-1). |
| 9 | nit | **FIXED** | Plan D11 and task 6.5 require brand-neutral changeset text with no product literal; the five-package fixed group matches `.changeset/config.json`. |
| 10 | nit | **FIXED** | DEC-6 records the PM decision that it stays change-local (no separate decision record) and names the Phase 7 `feature-provider-client-seeds.md` maintenance-rule extension if the collection-read precedent needs durable documentation. Spec DEC-6/§15, plan Context line 59 and task 7.2, pm-notes. |

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Counts: 0 critical, 2 major, 1 minor, 2 nit.

Coverage check: 33/33 TCs (TC-STATUS-001..033), 24/24 ACs, 10/10 NFRs, 15/15 DMs remain mapped in the test plan and the plan; no TC was renumbered, added, or removed. The plan still adds no state-layer API: NFR-9/TC-033 measure one logical `readProviderParkViews` invocation, and D1/D12 add no package, subpath, runtime-API location, config key, state schema, error row, or secret-read allowlist entry.

## Findings

1. **[major]** cross_artifact_consistency + test_traceability — `chg-GH-175-plan.md`#Context (line 58), #TC mapping (lines 548/556/559), #Tasks 5.3/5.6/4.4/5.4/6.4 vs `chg-GH-175-test-plan.md`#TC-STATUS-017, #TC-STATUS-021, #TC-STATUS-023, #TC-STATUS-029, #TC-STATUS-032
   Gap: the plan states "No behavioural spec/test-plan inconsistency found" and "do not change any ... assertion", but it adds assertions that the authoritative test plan does not contain. Specifically: (a) the plan says TC-029/5.6 asserts the provider-config pin (`config.value.invalid` + `provider-chain-unresolved` + no `failureClass`) and 5.3 adds it to the TC-017 suite, while test-plan TC-029 steps 2–3 only assert the generic code/class rules and TC-017 step 5 only asserts state + reason; AC-F15-1's "no `failureClass`" and exact `config.value.invalid` code are therefore not traced; (b) the plan maps TC-021/TC-023/TC-032 to an anonymous/credential-less-instance control, while those test-plan TCs name only missing/rejected-credential controls and contain no anonymous control. Delivered as written, the plan would either reshape the TCs without reopening test planning (violating GAP-1/A-T3) or leave the plan's acceptance criteria untested by the authoritative suite.
   Suggested remediation target phase: test_planning (mirror the pin in TC-029 and TC-017 and add the credential-less/anonymous control to TC-021/TC-023/TC-032, or explicitly delegate the extra controls to the plan) and/or delivery_planning (drop the added assertions and keep the generic TC-029 assertions if the test plan is not reopened).
   Suggested fix: add the exact provider-config identity assertion to TC-029 (and the TC-017 case-(e) step) and the anonymous/credential-less control to the named TCs; or remove those claims from the plan's TC mapping and 5.3/5.6, and keep the pin as an implementation detail only.

2. **[major]** plan_coverage — `chg-GH-175-plan.md`#CLI and adapter spellings `StatusComposition` (line 180), #D5 (line 202), #Tasks 4.3/4.4/5.4/6.4 vs `packages/adapters/src/github/client.ts` `authorizedHeaders` (lines 70–73)
   Gap: the plan pins a credential-reference instance and requires an injected credential-less/anonymous instance to make the GitHub-dependent sections `unknown`/`unavailable`, never `observed`. But `StatusComposition` injects `github.instance`, the edge wires "the GitHub client with the injected instance", and the delivered client explicitly accepts `authMethod.mechanism === "anonymous"` and sends unauthenticated headers. With a fixture transport that returns a 2xx, an anonymous instance reads successfully and the dependent sections become `observed`, so the plan's control and acceptance criterion are unsatisfiable without an unstated status-edge guard (or without the control using a credential-reference instance whose credential resolution fails). This is the same hazard iteration 1 flagged; the remediation named the pin and the control but not the enforcing mechanism.
   Suggested remediation target phase: delivery_planning
   Suggested fix: specify in task 4.3 (and mirror in the acceptance criterion) that `createStatusCommandRuntime` validates the injected instance and rejects/classifies a non-`credential-reference` GitHub instance as `credential-unavailable`/unavailable evidence before any read, and state exactly which sections/evidence result; or change the control to a credential-reference instance with a rejecting `CredentialPort`. Do not leave the guard implicit.

3. **[minor]** cross_artifact_consistency — `chg-GH-175-spec.md`#14 OPEN QUESTIONS closing paragraph (line 379) and #25 revision log v1.3 (line 673) vs `chg-GH-175-test-plan.md` front matter v1.3
   Gap: spec §14 says the test plan "was reconciled to v1.2, and this v1.3 revision does not modify it"; the test plan is v1.3 (`last_updated` 16:20Z, revision-log row 1.3). The spec v1.3 revision log repeats "(reconciled to v1.2)". This is a stale version reference left by the iteration-1 fix; the two artifacts' current versions do not align at this sentence.
   Suggested remediation target phase: specification
   Suggested fix: change both references to v1.3 (or say "the test plan is authoritative at its current revision") so the spec's statement matches the test plan front matter and revision log.

4. **[nit]** cross_artifact_consistency — `chg-GH-175-test-plan.md`#1.2 GAP-1 (line 55), #8.2 A-T3 (line 1446), #8.3 recorded gaps
   Gap: GAP-1/A-T3 are marked "RESOLVED by plan v1.1" while the current plan is v1.2. The resolution is historically true (v1.1 mapped all 33 TCs and v1.2 preserved the mapping), but the citation points at a superseded plan revision after the iteration-1 requirement to remove stale v1.1 references.
   Suggested remediation target phase: test_planning
   Suggested fix: cite "the implementation plan (v1.1 onward; currently v1.2)" or the current plan revision, while keeping the historical revision-log rows unchanged.

5. **[nit]** plan_code_area_coverage — `chg-GH-175-plan.md`#Phase 2 task 2.4 (line 342) vs `tests/behaviour/providers/github-trap.test.ts` `defaultCheckRunReader`/`checkRunsCheck`
   Gap: task 2.1 changes `readPipelineRun` to return `ProviderReadResult<{ items, pageItemCount }>`, but task 2.4 names only `defaultAssertions`, the exact result list, and mutation controls. The existing `defaultCheckRunReader` returns `readonly PipelineRun[]` and `checkRunsCheck` consumes that array, so the Phase 2 gate will fail to compile unless the helper is adapted to unwrap `items`.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add to task 2.4 that `defaultCheckRunReader`/`checkRunsCheck` unwrap `{ items, pageItemCount }` (and that the raw page size assertion remains live) before the Phase 2 gate.

## What Passed (evidence)

- Blocker #1 is genuinely closed: `provider.chain.invalid` appears only as a forbidden identity, and every current identity statement uses `config.value.invalid` + `provider-chain-unresolved` + no `failureClass` (or `config-invalid` + `config.*`).
- The CI at-limit rule is coherent across spec §8.4/§8.5, Appendix F, test plan TC-007/014/022/033, and plan D5/2.1/4.3/6.3: one bounded page, `per_page=20`, raw page size (19 vs 20) drives `source-truncated`, no pagination, and the five exported GitHub names are unchanged.
- TC-STATUS-002 is now reachable through the mandated `runCli` harness and its summary is arithmetically correct; plan task 4.4 mirrors it and removes the unreachable no-binding combination.
- The trap and inventory blast radii are now named: `github-trap.test.ts` (four new `defaultAssertions`, seven-name exact list, extended mutation controls) and `content-inventory.test.ts` (`EXECUTABLE_ALLOWANCES`) plus `inventory.json` (file set).
- DEC-6 is captured as a change-local PM decision, and Phase 7 names the provider-client-seeds maintenance-rule extension.
- The plan remains within scope: no new state-layer API, package, subpath, runtime-API location, config key, state schema, error row, or secret-read allowlist entry; NFR-9 uses one logical park-fold read.

## Remediation Routing

- **test_planning**: F-1 (mirror the provider-config identity pin in TC-029/TC-017 and add the anonymous/credential-less control to the named TCs, or explicitly delegate it), F-4 (update the GAP-1/A-T3 citation).
- **delivery_planning**: F-2 (specify and test the anonymous-instance guard), F-5 (adapt the trap-suite check-run helper), and mirror F-1 if the test plan is not reopened.
- **specification**: F-3 (spec §14 / revision log v1.3 version reference).
- No finding reopens delivery. No human pause is required: the remaining findings are authoring consistency and plan-executability gaps, not decisions needing human input.

## Re-run Instruction

Re-run the DoR gate after the test-planning and delivery-planning revisions (and the one-line specification version fix). The gate should be `READY` when F-1–F-3 are closed and F-4/F-5 are acknowledged with the named edits. This is iteration 2 of a cap of ~3; if the same blocking gap persists, escalate to the human rather than looping.
