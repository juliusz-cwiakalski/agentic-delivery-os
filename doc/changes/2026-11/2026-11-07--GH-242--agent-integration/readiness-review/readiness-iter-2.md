# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-242
Date: 2026-11-07
Pause Required: no

Inputs reviewed: ticket GH-242 (GitHub issue, `juliusz-cwiakalski/agentic-delivery-os`), the revised `chg-GH-242-spec.md` (41 ACs, DoD-1..DoD-20, DEC-14/15/16), the revised `chg-GH-242-test-plan.md` (70 TCs), the revised `chg-GH-242-plan.yaml` (10 phases; validated with `validatePlanValue` at zero errors), `chg-GH-242-pm-notes.yaml`, `TDR-0013-agent-session-commit-guard-reversal.md`, `doc/guides/definition-of-ready.md`, the current `doc/spec/features/**` pages named by the spec, and the relevant source seams (`packages/cli/src/edge.ts`, `packages/core/src/contracts/{commit,config,error-table}.ts`, `tests/structure/state-scope.test.ts`, `.opencode/agent/pr-manager.md`).

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Iteration-1 Remediation Check

| Finding | Status | Evidence |
|---|---|---|
| RR-1 | CLOSED | Spec now has §17.1 DoD-1..DoD-20 and a validation-checklist item; every AC (AC-F1-1..AC-NFR9-1), every NFR (NFR-1..NFR-13), the §4.1 metrics, TDR-0013/PR disclosure, plugin freshness, `pnpm check`, one-PR posture, and clean-tree/commit inventory are bound to evidence and plan phases. |
| RR-2 | CLOSED | F-5 (spec lines 148–150), Flow 1 (lines 166–181), AC-F2-4 (line 506), DEC-16 (line 441), RSK-11 (line 377); TC-STAGE-009/010 (test plan lines 1056–1116); plan phase 3 scope/summary (plan lines 139–179). Snapshot/restore, failed-restore exit 2, classified fault/reconciliation instruction, retry one transition/one commit, and legacy post-commit convergence are all specified and tested. |
| RR-3 | CLOSED | TC-SESS-002 is now explicitly the “phase-2 half” and excludes staging/order/commit-content assertions (test plan lines 605–633); plan phase 2 summary repeats the exclusion and phase 3 owns TC-STAGE-001/003/006/009 (plan lines 127, 170). |
| RR-4 | CLOSED | Phase 4 now owns only `plan-consumer-inventory.test.ts` (code/template) and `plan-writer-prompt.test.ts`; TC-PLANSUM-005 is phase 5/8 (plan lines 214–222; test plan lines 1174–1260, §7.2). |
| RR-5 | CLOSED | Phase 7 runs `doc-conformance` with `scope: docs` only and explicitly must not read `doc/spec/features/**`; phase 10 runs `scope: full` (plan lines 360–362, 489–492; test plan TC-DOCREC-002/003). |
| RR-6 | CLOSED | Spec §2.1 (line 62), §8.1 (line 301), NG-10 (line 124), AC-F1-6 (line 535); `state` is a no-command state layer, `mcp` a package surface; TC-ENTRY-009 asserts `state`/`mcp`/`dispatch`/daemon absent; plan phase 1 re-runs `state-scope`. `tests/structure/state-scope.test.ts` exists and enforces the absence. |
| RR-7 | CLOSED | The four current-truth pages are in §7.1 (line 243), §16.1 with stale/required phrases (lines 489–492), Appendix E (line 700), AC-F8-5, NFR-13, plan phase 10 scope (lines 471–474), and TC-DOCREC-003. |
| RR-8 | CLOSED | Test-plan §6.2 is the canonical fixture list with standardized names (`help-guide/coverage.json`, `plan/summary/`, `tests/golden/plan/`, `prompt-inventory/lifecycle.json`, `retained-retired.json`); plan phases 1/4/5/6/8/9 declare the matching files/folders, and phase 9 names its individual test/fixture files; the privacy/safety re-runs are in phase 8. |
| RR-9 | CLOSED | F-1/§7.1/DEC-14 define a non-installed Bun bin mapped in `bin` plus a `main`/composition entry; the identity chain is configuration → `DELIVERY_OS_WORKING_NAME` → neutral `delivery-os`, which is the same neutral default `packages/mcp/src/serve.ts` uses and is not the seed literal (“ados”). AC-F1-3/5/7 and TC-ENTRY-002/005/010/008 cover it; plan phase 1 scopes `packages/cli/bin/delivery-os.ts`, `entrypoint.ts`, `help.ts`, and `package.json`. |
| RR-10 | CLOSED | AC-NFR1-1/TC-ENTRY-006 now gate zero state/network/git/configuration reads and zero writes inside the fixed suite timeout, with wall-clock timing informational; AC-F1-6 is a must-pass composition/fail-closed AC and TC-ENTRY-009 is in the must-pass list; plan phase 1 pins the classified failure code. |
| RR-11 | PARTIALLY CLOSED | DEC-15/RSK-8 now record the one-ticket/one-PR posture and the explicit PM review-risk acceptance; the split is not required by the ticket. However, the stated mitigation (“the ten plan phases are sequenced so each is independently green”) is contradicted by RR-17 (phase 8 depends on phase 9 pilot data). The acceptance itself needs no change; the phase-independence premise does. |
| RR-12 | CLOSED | Appendix C and test-plan §3.1.1 both use six ticket-AC rows. |
| RR-13 | CLOSED | AC-F10-3 now says “stubbed or deterministically injected” for clock/ids. |
| RR-14 | CLOSED | Phase 9 summary and assertions include `verify change`/`phase list` before merge. |
| RR-15 | CLOSED | Phase 2 summary records the `sessionFacts` wiring decision and the tier trigger is now `tdr-acceptance-required-at-pr` (plan lines 25–28, 127), matching TDR-0013’s acceptance-pending posture. The scope omission for the wiring is RR-18, a new finding. |
| RR-16 | CLOSED | TC-ERRROW-003 now names the error-table sync scan as the detection mechanism, updates the existing `true-positives.json` in place, and adds no corpus file. |

## Blocking Findings

### RR-17 [critical] plan_coverage / cross_artifact_consistency — `chg-GH-242-plan.yaml` phase 8 summary/tests; `chg-GH-242-test-plan.md` TC-PSCAN-009/§7.2/§7.3; `chg-GH-242-spec.md` RSK-8/DEC-15

- **Facet:** plan_coverage / cross_artifact_consistency
- **Severity:** critical
- **Artifact + location:** plan phase 8 summary (line 413) and tests (lines 414–425); plan phase 9 scope/tests (lines 429–455); test plan TC-PSCAN-009 preconditions/steps (lines 1512, 1518), §7.2 rows 8/9 (lines 2459–2460), §7.3 DoD-17 (line 2487); spec RSK-8 (line 374), DEC-15 (line 440).
- **Gap:** Phase 8 is not independently green because its privacy/secret re-run (TC-PSCAN-009) scans `tests/fixtures/pilot/` and “pilot data”, but the pilot fixtures are created by **phase 9**. The plan says so explicitly: phase 8’s summary lists “pilot data” among the TC-PSCAN-009 classes, and phase 8’s tests run `prompt-secret-scan.test.ts`/`privacy-authoring.test.ts`; phase 9’s tests do not re-run those scans. The test plan’s §7.3 already acknowledges TC-PSCAN-009 spanning phases 8 and 9, but §7.2 row 8 assigns all PSCAN cases to phase 8 and row 9 only PILOT. This directly contradicts RSK-8/DEC-15/plan-header “each phase independently green” and “the conformance scans (phase 8) and the pilot (phase 9) follow the artifacts they scan.”
- **Evidence:** `chg-GH-242-plan.yaml` line 413 (“… prompt inventory, key register, help coverage, entrypoint programs, plan summary, plan goldens, and **pilot data**”), phase 8 tests lines 414–425, phase 9 scope lines 429–442, phase 9 tests lines 449–455; `chg-GH-242-test-plan.md` line 1512 (`tests/fixtures/pilot/` is required test data), line 1518 (“pilot data”), §7.2 line 2459 (all `TC-PSCAN-001`..`009` in phase 8), line 2460 (phase 9 only `TC-PILOT-001`..`006`), §7.3 line 2487 (`TC-PSCAN-009` in phases 8, 9); spec line 374 (“each is independently green”; “the conformance scans (phase 8) and the pilot (phase 9) follow the artifacts they scan”).
- **Suggested remediation target:** delivery_planning (with a test_planning touch)
- **Suggested fix:** Split TC-PSCAN-009 by fixture availability: phase 8 scans only the fixture classes that exist by then (prompt inventory, key register, help coverage, entrypoint programs, plan summary, plan goldens); add the pilot-data secret/privacy re-run to phase 9 after `tests/fixtures/pilot/` is created (add the scan to phase 9’s `tests` list and scope, or add a dedicated pilot-secret test). Update test-plan §7.2 row 9, the plan phase 8 summary (remove “pilot data”), the plan phase 9 summary, and DoD-17/§7.3 so the phase mapping states the split explicitly.

### RR-18 [major] plan_code_area_coverage — `chg-GH-242-plan.yaml` phase 2 scope vs summary; `packages/cli/src/edge.ts`

- **Facet:** plan_code_area_coverage
- **Severity:** major
- **Artifact + location:** plan phase 2 summary (line 127) and scope files (lines 93–114); `packages/cli/src/edge.ts` lines 452, 621, 643–658, 2423–2424; TDR-0013 “Unresolved Questions”/Implementation Plan (lines 276–282).
- **Gap:** Phase 2’s summary commits to dropping the now-unused `sessionFacts` wiring (“the guard is removed, not merely unwired, and the now-unused sessionFacts wiring is dropped while the contract and adapter export stay in place”), but phase 2’s declared `scope.files` contains only `commands/commit.ts`, `commands/phase.ts`, the core contracts, the TDR/specs, and tests. The production composition that injects `sessionFacts` into the commit/phase runtimes is `packages/cli/src/edge.ts` (lines 2423–2424 and the composition at 643–658/452/621), and `edge.ts` is not in phase 2’s scope. An implementer following the scope either leaves the wiring in place (contradicting the summary/TDR) or edits an undeclared file (scope deviation). `edge.ts` is scoped in phases 1 and 3 for other reasons, so the wiring has no owning phase.
- **Evidence:** `chg-GH-242-plan.yaml` line 127; phase 2 `scope.files` lines 93–114 (no `packages/cli/src/edge.ts`); `packages/cli/src/edge.ts` lines 452/621/643–658/2423–2424; TDR-0013 lines 276–282 (“remove the wiring; keep the `CommitSessionFacts` contract and adapter export”).
- **Suggested remediation target:** delivery_planning
- **Suggested fix:** Add `packages/cli/src/edge.ts` (and, if its option types or comments change, the relevant unit/structure assertions) to phase 2’s `scope.files` and test list, or change the phase 2 summary/TDR to keep the wiring and record why. Do not leave the summary and scope disagreeing.

### RR-19 [major] plan_doc_update_coverage / system_spec_consistency — `chg-GH-242-plan.yaml` phase 3; `doc/spec/features/feature-commit-primitive.md`

- **Facet:** plan_doc_update_coverage / system_spec_consistency
- **Severity:** major
- **Artifact + location:** plan phase 3 scope/summary (lines 142–179); plan phase 2 scope (line 100); plan phase 10 scope (lines 460–475); `doc/spec/features/feature-commit-primitive.md` lines 51 and 97; spec F-5 (lines 148–150), NFR-13 (line 353), DoD-14 (line 560); test plan TC-DOCREC-003 (lines 1687–1700).
- **Gap:** Phase 3 changes the completion ordering (pm-notes transition written before the commit act, with restore) and the staging scope (mapped plan scope ∪ change folder; plan-absent change-folder staging). `doc/spec/features/feature-commit-primitive.md` is the current-truth page for both behaviors: line 97 still states the old order (“create the commit object, append the transition record … then write the pm-notes entry”) and line 51 still describes the old `commit --phase` staging scope. The page is in phase 2’s scope only for the session-guard/error-row changes; phase 3 has no `doc/spec` file, and phase 10 does not list `feature-commit-primitive.md`. No phase owns the page for the ordering/staging reversal, and TC-DOCREC-003 step 4 only asserts the five-row `commit` domain, not the ordering/staging text. The delivered change would leave a directly contradicted current-truth spec.
- **Evidence:** `feature-commit-primitive.md` line 97 (old order), line 51 (old plan-union staging); plan phase 3 scope lines 142–159 (no `doc/spec`), summary line 170 (behavior change only); plan phase 2 scope line 100 (page owned for guard/error row); plan phase 10 scope lines 460–475 (page absent); spec F-5 lines 148–150; test plan TC-DOCREC-003 lines 1691–1700 (only the five-row domain is concretely asserted).
- **Suggested remediation target:** specification + delivery_planning
- **Suggested fix:** Add `doc/spec/features/feature-commit-primitive.md` to phase 3’s scope (or phase 10’s final reconciliation) and add named stale/required phrases to §16.1 and TC-DOCREC-003 for (a) the completion write order and (b) the lifecycle completion staging scope (plan scope ∪ change folder; plan-absent change-folder staging; strays excluded). The phrase assertions must be concrete so the page cannot remain stale.

### RR-20 [major] system_spec_consistency / plan_doc_update_coverage — `chg-GH-242-plan.yaml` phase 1 `config.composition.unavailable`; `doc/spec/features/feature-config-layer.md`

- **Facet:** system_spec_consistency / plan_doc_update_coverage
- **Severity:** major
- **Artifact + location:** plan phase 1 summary (line 75); spec §7.1 (line 243) and §16.1 (line 488); plan phase 1 scope (lines 36–58) and phase 10 scope (lines 460–475); `doc/spec/features/feature-config-layer.md` line 137; test plan TC-ERRROW-002 (line 756) and TC-DOCREC-003 (line 1699).
- **Gap:** Phase 1 pins the fail-closed composition error as `config.composition.unavailable`, “an added row in the existing config kind — no new domain kind or open-slot family; platform category, `not_landed`, platform-provider projection, exit 2”, and updates the machine table and the documented table in `feature-result-contract.md`. But `feature-config-layer.md` is the current-truth page for the `config` domain and states: “All are `category=user`, `retryable=false`, `consequence=not_landed`, and project to `user-validation`/exit 1”, then enumerates the nine config rows. A platform/exit-2 `config.*` row directly contradicts that blanket statement. The page is not in the spec’s §7.1/§16.1 lists, not in phase 1’s scope, and not in phase 10’s scope; TC-ERRROW-002 only reads `feature-commit-primitive.md`/`feature-result-contract.md`, and TC-DOCREC-003 only asserts the five-row `commit` domain. The change would leave the config-layer spec stale and internally contradicted.
- **Evidence:** plan line 75 (`config.composition.unavailable`; platform, `not_landed`, `platform-provider`, exit 2); `feature-config-layer.md` line 137 (“All are `category=user` … exit 1” and the nine-row enumeration); spec §7.1 line 243 and §16.1 line 488 (no `feature-config-layer.md`); plan phase 1 scope lines 36–58 and phase 10 scope lines 460–475 (no `feature-config-layer.md`); test plan line 756 (TC-ERRROW-002 only names commit-primitive/result-contract), line 1699 (five-row commit only).
- **Suggested remediation target:** specification + delivery_planning
- **Suggested fix:** Either (a) update `doc/spec/features/feature-config-layer.md` to document `config.composition.unavailable` as a declared non-layer composition failure with its platform/exit-2 projection, add the page to §16.1 and phase 1 (or phase 10) scope, and add a doc-conformance assertion; or (b) place the fail-closed composition failure in a domain kind whose current-truth page does not claim all rows are user/exit-1. Do not add a config-kind row that current-truth documentation forbids.

### RR-21 [major] plan_coverage / cross_artifact_consistency — `chg-GH-242-test-plan.md` TC-PSCAN-001/TC-PSCAN-002 system-spec scan in phase 8

- **Facet:** plan_coverage / cross_artifact_consistency
- **Severity:** major
- **Artifact + location:** test plan TC-PSCAN-001 step 7 (line 1285), TC-PSCAN-002 step 5 (line 1315), §7.2 row 8 (line 2459); plan phase 8 summary/tests (lines 413–425); plan phase 7 scoped doc-conformance (line 360); plan phase 10 feature-spec reconciliation (lines 460–475).
- **Gap:** Phase 8’s prompt-conformance cases say to “Run the same phase-state rule / raw-git rule over the reconciled guides and **system specs**”. The guides are reconciled in phase 7, but the `doc/spec/features/**` pages are not reconciled until phase 10; phase 7’s `doc-conformance` is explicitly scoped to `scope: docs` and “must not read any `doc/spec/features/**` page.” At phase 8 the feature specs are therefore still pre-reconciliation. Either the scan reads them and fails on stale raw-git/phase-state language (or on descriptive code-map mentions such as `feature-commit-primitive.md` line 163 and `feature-delivery-lifecycle.md` lines 59/114), or the stated scan scope is not actually executed. This is the same forward-dependency pattern as iteration-1 RR-4/RR-5.
- **Evidence:** test plan lines 1285 and 1315 (“system specs”); §7.2 line 2459 (PSCAN in phase 8); plan phase 8 summary line 413 and tests lines 414–425 (prompt/doc scan); plan phase 7 summary line 360 (“must not read any `doc/spec/features/**` page”); plan phase 10 scope lines 460–475 (feature specs); current feature specs with descriptive `git commit`/phase-state prose (`feature-commit-primitive.md` line 163, `feature-delivery-lifecycle.md` lines 59/114).
- **Suggested remediation target:** test_planning (with a delivery_planning touch)
- **Suggested fix:** Scope the phase-8 prompt/doc scan to prompts, commands, and the phase-7 guides/reference pages, and move the system-spec scan to phase 10’s full doc-conformance (TC-DOCREC-003), or define an explicit descriptive-text allowlist and reconcile the system specs before phase 8. State the split in §7.2 and add the corresponding phase test/scope.

### RR-22 [major] ac_quality / test_traceability — `chg-GH-242-spec.md` §16.1 generic row, NFR-13, DoD-14; `chg-GH-242-test-plan.md` TC-DOCREC-003

- **Facet:** ac_quality / test_traceability
- **Severity:** major
- **Artifact + location:** spec §16.1 generic row (line 488), NFR-13 (line 353), DoD-14 (line 560); test plan TC-DOCREC-003 precondition/steps (lines 1687–1700), §3.3 NFR-13 (line 186).
- **Gap:** NFR-13 and DoD-14 claim “every §16.1 row no longer contains its **named stale phrase** and contains its required replacement”, and TC-DOCREC-003 says “the full §16.1 stale/required phrase table is encoded in the parameterized doc-conformance fixtures.” But the §16.1 generic row for the behavioral primitives is a single row with **no** named phrases: “Affected `doc/spec/features/**` pages … Reconcile the delivered behavior for commit, phase, plan, blockers, status, brief, merge/verify, closeout, scheduling, result contract, and agents/commands.” Only the four current-truth pages and the five-row `commit` domain have concrete phrases. The “full phrase table” cannot be complete, “every row” is vacuous for the generic row, and the delivery has no mechanical evidence that the commit/phase/plan pages (notably the ordering/staging text in `feature-commit-primitive.md` and the session-refusal/six-row text in `feature-pm-notes-lint-and-phase-transitions.md`) were reconciled.
- **Evidence:** spec line 488 (generic row, no phrases), line 353 (NFR-13 “every §16.1 row … named stale phrase”), line 560 (DoD-14 “each row”); test plan line 1687 (“full §16.1 stale/required phrase table”), lines 1691–1700 (only four named pages + five-row domain are concretely asserted), line 186 (NFR-13 coverage claim).
- **Suggested remediation target:** specification + test_planning
- **Suggested fix:** Split the generic §16.1 row into concrete per-page rows with named stale/required phrases for every page that changes behavior (at minimum `feature-commit-primitive` ordering/staging, `feature-pm-notes-lint-and-phase-transitions` session-refusal/six-row text, and `feature-plan-schema` summary). If the intent is to assert only the named rows, narrow NFR-13/DoD-14/TC-DOCREC-003 wording to “each named-phrase row” and add a separate coverage obligation for the generic row. Do not claim “every row” without a phrase.

### RR-23 [major] cross_artifact_consistency — `chg-GH-242-test-plan.md` TC-ADOPT-002 step 3 vs `chg-GH-242-spec.md` §16.1 pr-manager row

- **Facet:** cross_artifact_consistency
- **Severity:** major
- **Artifact + location:** test plan TC-ADOPT-002 step 3 (line 1945); spec §16.1 `.opencode/agent/pr-manager.md` row (line 475) and F-3 (line 146); `.opencode/agent/pr-manager.md` line 249.
- **Gap:** TC-ADOPT-002 step 3 requires `@pr-manager` to “keep push/PR creation but **perform no merge and no commit**.” Spec §16.1 says the opposite for the dirty-tree case: “No merge; dirty tree uses `commit` (or thin `@committer`); push/PR creation retained.” F-3 confirms prompts may call `commit` directly or delegate to the thin `@committer`. The current `pr-manager.md` explicitly instructs “If `git status --porcelain` is non-empty: you MUST invoke `@committer` now.” A test that treats that delegated commit as a violation would either fail on the correct behavior or push the implementer to remove the dirty-tree commit, contradicting the spec. This is a direct test/spec conflict, not a prompt bug.
- **Evidence:** test plan line 1945 (“performs no merge and no commit”); spec line 475 (“dirty tree uses `commit` (or thin `@committer`)”), line 146 (F-3 delegation); `.opencode/agent/pr-manager.md` line 249 (MUST invoke `@committer`).
- **Suggested remediation target:** test_planning (with a specification clarification if the spec row is meant to forbid any pr-manager commit trigger)
- **Suggested fix:** Align TC-ADOPT-002 with the spec: assert `@pr-manager` performs no **direct staging/commit** and no merge, while a dirty-tree commit may go through `commit` or the thin `@committer`. If the spec intends no pr-manager commit at all, update §16.1/F-3 and the prompt accordingly and state which path handles a dirty tree before PR creation.

### RR-24 [major] plan_coverage / test_traceability — `chg-GH-242-test-plan.md` TC-ENTRY-004 step 4 (reference-page inventory) vs plan phases 1/7/8

- **Facet:** plan_coverage / test_traceability
- **Severity:** major
- **Artifact + location:** test plan TC-ENTRY-004 step 4 (line 386), §6.2 coverage fixture (line 2330), TC-HELP-001 precondition (line 1542), TC-HELP-003 (line 1594); plan phase 1 test list (line 79) and scope (lines 36–58); plan phase 7 scope (line 330); plan phase 8 scope (line 389).
- **Gap:** TC-ENTRY-004 (assigned to phase 1) requires “Assert every see-also target exists in the reference-page inventory.” The only declared reference-page inventory is `tests/fixtures/help-guide/coverage.json`, which is created in phase 8 and maps invocations to reference-page paths; the new `commands/entrypoint.md` page is created in phase 7. Phase 1 runs `entrypoint-help-coverage.test.ts` but neither the coverage matrix nor the entrypoint page exists yet. Unless “reference-page inventory” is a phase-1 fixture (it is not declared in §6.2 or phase 1 scope), phase 1 cannot be green, or the assertion is silently reduced to a pointer-presence check. Page existence/parity is already owned by TC-HELP-001/TC-HELP-003 in phases 7/8.
- **Evidence:** test plan line 386 (step 4), line 2330 (`tests/fixtures/help-guide/coverage.json` “Invocation to help and reference-page coverage mapping”), line 1542 (TC-HELP-001 maps the root obligation to `man-page.md` + the new `commands/entrypoint.md`), line 1594 (TC-HELP-003 parity); plan phase 1 test line 79 (`entrypoint-help-coverage.test.ts`) and scope lines 36–58 (no coverage inventory); plan phase 7 scope line 330 (creates `commands/entrypoint.md`); plan phase 8 scope line 389 (creates `coverage.json`).
- **Suggested remediation target:** test_planning + delivery_planning
- **Suggested fix:** Either declare the reference-page inventory as a phase-1 fixture (for example in `tests/fixtures/entrypoint/programs.ts` or a new phase-1 fixture) and have TC-ENTRY-004 assert the pointer is present in that inventory; or remove step 4 from TC-ENTRY-004 and leave target existence/parity to TC-HELP-001/TC-HELP-003 in phases 7/8. Make the owning phase explicit in §7.2 and the plan scope.

## Non-Blocking Observations

### RR-25 [minor] ac_quality / cross_artifact_consistency — `chg-GH-242-spec.md` NFR-8/§4.1 vs `chg-GH-242-test-plan.md` TC-PILOT-006

- **Artifact + location:** spec NFR-8 (line 348) and §4.1 (line 111); test plan TC-PILOT-006 step 3 (line 2297), §3.3 NFR-8 (line 181).
- **Gap:** NFR-8 says the pilot “Completes within the suite’s fixed timeout (≤ 180 s on the reference environment); timing is informational, not a per-run gate”, while TC-PILOT-006 says “Measure the suite wall time and **assert** it is at or under 180 s on the reference environment.” The spec’s own §4.1 metric also states a 180 s bound. The intended gate needs one wording: a hard 180 s bound, or an informational measurement plus the suite timeout.
- **Suggested remediation target:** specification (with a test_planning touch)
- **Suggested fix:** Make NFR-8, §4.1, and TC-PILOT-006 say the same thing (hard 180 s gate or informational measurement) and keep the wall-clock assertion out of the deterministic gate if the spec keeps “informational”.

### RR-26 [minor] test_traceability — `chg-GH-242-test-plan.md` TC-STAGE-009 step 2 “no commit object”

- **Artifact + location:** test plan TC-STAGE-009 step 2 (line 1074); spec F-5/AC-F2-4 (lines 150, 506); `doc/spec/features/feature-commit-primitive.md` line 97.
- **Gap:** The atomic-abort mode can occur after a commit object is created but the ledger append fails; the atomic contract resets the checkout to the pre-act head, leaving the object unreachable rather than absent from the object database. Asserting “no commit object is created” is stronger than “no commit exists” (HEAD/commit-count unchanged) and may fail a correct atomic-abort implementation.
- **Suggested remediation target:** test_planning
- **Suggested fix:** Assert HEAD/commit-count and ledger unchanged (no reachable commit), not object-database absence, or define the atomic-abort injection point before object creation.

### RR-27 [nit] test_traceability — `chg-GH-242-test-plan.md` OQ-T6 is stale

- **Artifact + location:** test plan OQ-T6 (line 2529).
- **Gap:** OQ-T6 still says the plan YAML “must align … Until then, the plan YAML is a residual alignment item”, but the plan was revised (plan YAML timestamp 21:00; test-plan revision log 0.2). The open question should be closed or re-scoped to the remaining findings above.
- **Suggested remediation target:** test_planning
- **Suggested fix:** Update OQ-T6 to reflect the revised plan and close it, or restate the specific remaining alignment item (RR-17/RR-24).

## Scope Realism Judgment

The one-ticket/one-PR posture is now correctly recorded and accepted in DEC-15/RSK-8; the ticket’s leaf-story shape does not force a split. The acceptance itself stands. However, RSK-8/DEC-15’s stated mitigation — “the ten plan phases are sequenced so each is independently green” — is not yet true: phase 8 depends on phase 9 pilot data (RR-17), and phase 1’s see-also assertion depends on phase 7/8 artifacts (RR-24). Fix those dependencies and the one-PR review-risk acceptance is coherent; do not open delivery on the current sequence.

## Gate Result

`NOT_READY`. Remediation targets: `specification` for RR-19, RR-20, RR-22 (and any RR-23 spec clarification); `test_planning` for RR-21, RR-22, RR-23, RR-24 (and RR-25/RR-26 if fixed); `delivery_planning` for RR-17, RR-18, RR-19, RR-20, RR-24. Do not open delivery.

## Evidence Notes

- No source code, spec, test plan, or plan was modified by this review; this verdict is the only written artifact.
- The plan YAML validates against the current `validatePlanValue` with zero errors (10 phases, `delivery.plan.v1`, tier `full`); the validator still ignores the not-yet-declared `summary` and the non-schema `tests` key, so phase 4’s schema work remains required.
- Ticket GH-242 was loaded via `gh issue view 242`; its five acceptance clauses match Appendix C’s six-row split (phase-state writes and hand-crafted commits separated).
- TDR-0013 exists, is indexed in `doc/decisions/00-index.md`, is authored with `@decision-advisor` involvement, and is `Proposed` with `decision_date: null`; its acceptance-pending posture is consistent with TDR-0012 and is not a DoR pause.
- `tests/structure/state-scope.test.ts` exists and enforces the absence of a `state` CLI command; `packages/cli/package.json` has no `bin`/`main` today; `packages/cli/src/edge.ts` contains the `sessionFacts` wiring at lines 452/621/643–658/2423–2424; `feature-commit-primitive.md` line 97 still states the pre-change completion order; `feature-config-layer.md` line 137 still says all config failures are user/exit-1.
