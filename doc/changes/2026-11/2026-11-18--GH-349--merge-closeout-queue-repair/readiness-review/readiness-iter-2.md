# Readiness Review Iteration 2

Verdict: **NOT_READY**
Work Item: GH-349 (M4-S11: Merge, closeout, and queue repair on the primitives, M4)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 2, run against spec v1.4, test plan v1.5, plan v1.0 (7 phases, `plan validate` = `valid` / `full` / `readyForDevelopment=true`, re-run at this gate), pm-notes, the three untracked `Proposed` decision records, and the delivered tree named by the ticket.

**Delivery stays blocked.** Iteration 1's six blocking findings are closed at the level of *declaration* — the reason pair, the retired golden, the seven pin sites, the operation-name and flow-step deltas, and the seventh assertion family are all now stated, counted, and owned. What the remediation did not do is follow each newly declared delta into the files that enforce it. Two blocking findings remain, and both are the same shape as the ones this change has already fought: a declared value with no carrier, and a declared delta whose enforcing files no phase may stage. Every claim below was verified against the delivered declaration or suite, not inferred from the artifacts.

Confidence: both blocking findings are mechanically checkable and were checked — one is a `Record<AdapterOperation, …>` map plus six exact assertions, the other is two validators that return `state.store.torn`.

## Iteration-1 disposition

| # | Severity | Facet | Disposition | Evidence |
|---|---|---|---|---|
| F1 | blocking | testability · plan_buildability | **Resolved** | `refusal-rebase` is retired, not moved: spec §16, Appendix D golden row ("15 files → 13: 2 moved, 2 retired, 11 byte-identical") and Appendix G-5; plan phase 2 deletes `refusal-rebase-{human.txt,scripted.json}` + the `goldenScenarios()` entry and demands *eleven* byte-identical at its boundary (plan:985-994, 1097-1099); test plan TC-FLOOR-005 + §7.2/§7.3 assert 2 moved / 2 absent / 11 unchanged. Delivered directory holds exactly 15 files (3 success + 6 refusal pairs). |
| F2 | blocking | plan_buildability · traceability | **Resolved** | AC-F1-1 and spec §16 name `merge-rebase`, `merge-coordinator-boundary`, `merge-waivers` with their post-change obligations; plan phase 2 declares all three (plan:1072-1077) and states the population as sixteen; delivered population is 16 (`tests/behaviour/merge-*.test.ts`). |
| F3 | blocking | traceability · plan | **Resolved** | Spec Appendix D names exactly seven files, and a repo-wide grep confirms exactly those seven suites carry the total (`error-table-sync`, `supervision-error-socialization`, `error-table`, `dispatch-attempts-taxonomy`, `verify-gates-suite-map-contract`, `ceremony-contract`, `ceremony-nonregression`); phase 1 declares `supervision-error-socialization` (plan:860) and names its `+ 115` arithmetic; TC-SYNC-001 names seven, not five. |
| F4 | blocking | carrier_observability | **Resolved** | The closed vocabulary is the pair `dirty \| behind-unconfirmed` in F-2 (table + prose), AC-F2-2, AC-F2-3, DM-2, §8.5, Flow 2 (v1.4 sweep), Appendix D, Appendix G-1, glossary, RSK-7, and ADR-0012 §5 + its second revision entry. No branch and no case asserts a confirmed `behind`. |
| F5 | blocking | specification | **Partially resolved** | The two omitted deltas are now declared with owning ACs and counts (DM-4 `CLOSEOUT_OPERATION_NAMES` 6→7 + argument arm; DM-7 flow steps 14→15 + assertion families 6→7; AC-F4-1; Appendix D/E items 2-3; TC-SYNC-002/003; phase 5). The **plan** half is still open: the files that enforce those deltas are not in phase 5's scope (see N1), and Appendix D's golden row still counts only the merge set, omitting the closeout golden pair the thirteenth step moves. |
| F6 | blocking | specification | **Resolved** | `milestone-state` is declared as the seventh `ConformanceAssertionFamily` (DM-7, AC-F4-1, Appendix D/E item 2, glossary), with the trap-family vocabulary explicitly a different set. Delivered: `ConformanceAssertionFamily` = 6 members (`packages/testkit/src/conformance/types.ts:67-73`), `TRACKER_TRAP_FAMILIES` = 6, 18-cell accounting unchanged. |
| F7 | major | traceability | **Resolved** | Re-derived from test plan §3.1 against plan ownership: exactly four cross-phase AC→TC citations — AC-F1-6→TC-SYNC-004, AC-F1-7→TC-SYNC-003, AC-F2-5→TC-SYNC-001, AC-F2-6→TC-SYNC-008. All four appear in the plan's CROSS-PHASE CARRIER CASES (plan:565-592) and AC-F1-7 states the citation in its own text. |
| F8 | major | traceability | **Resolved** | `PM_NOTES_LINT_CODES` holds five (`packages/core/src/contracts/pm-notes.ts:76-82`); the `lint` kind holds six machine rows (the five + `lint.document.unreadable`, `error-table.ts:502-555`); DM-8/Appendix D/§4.1/NFR-6 state documented 5→6, machine 6→7, constant stays five. The decomposition ("five pm-notes identities, this one, and the unchanged plan-target row") is correct once `lint.document.unreadable` is read as the plan-target row, which the lint page states at `feature-pm-notes-lint-and-phase-transitions.md:51`. |
| F9 | major | carrier_observability | **Resolved (definition)** | DM-3, AC-F1-2, API-1, §8.5, glossary, Appendix D and Appendix G-9 define `shaOnBase` as `boolean \| "unknown"`, answered only when a local read answers, never landing evidence; TC-F1-011/012 assert the third state and the legacy boolean record; the success golden stays byte-identical (OBS-2). The delivered **state-layer validator** that rejects the new value is a separate gap — N2. |
| F10 | major | testability | **Resolved** | AC-F6-1, F-6, TC-F6-012 and M98 declare each control as a derived comparison or a deliberately broken double and forbid claiming a production-input breach. |
| F11 | major | testability | **Resolved** | F-7, AC-F7-2, AC-F7-4, GAP-TP-4 and M99 state that each control *substitutes* the pre-fix derivation/declaration/attempt; no case claims to execute pre-fix code. |
| F12 | major | risk_boundary_honesty | **Resolved** | OQ-1, RSK-2 and Appendix G-6 state the true blast radius (the whole phase-5 ripple), and the plan makes the owner's answer a **gate on phase 5** with its own escalation trigger (plan:712, 1342-1354, 645-656). |
| F13 | major | decision/cross-artifact | **Resolved** | Test plan §11.1 D8 is closed against the ADR revision and §11.2 reads "**No open finding**"; the plan's SPEC-AUTHORITY NOTE and OPEN ITEMS both record D8 closed. |
| F14 | major | documentation | **Resolved for the named pages** | `feature-metrics.md` (three count statements verified at `:260`, `:348`, `:390`) and `feature-ceremony-runner.md` (three `149 identities` statements) are in Appendix A and in phases 1/7. Three further current-truth pages carry the operation count and are still absent — N4. |
| F15 | major | risk_boundary_honesty | **Resolved** | One bounded page at the declared page size, truncation withholds: F-4, API-4, AC-F4-4, NFR-4, OQ-3, RSK-11, Appendix G-8, and ODR-0005 §4/§11 now agree. |
| F16 | minor | testability | **Resolved** | TC-F4-010 binds each fixture to its own outcome in order (satisfying→`would-apply`, already closed→`satisfied`, absent/malformed, mismatch, withheld→`skipped-noop`, `none` and gap adapter→`skipped-gap`). |
| F17 | minor | specification | **Resolved** | The F-4 outcome table, AC-F4-4 and TC-F4-007 map an unknown record state to `closure-withheld` with the state carried in bounded evidence. |
| F18 | minor | specification | **Resolved** | NFR-4 reads "1 pre-refusal request-detail read plus the ≤1 post-refusal re-read". |
| F19 | nit | ticket_alignment | **Resolved** | §4.1 separates "7/7 property suites with a declared control shape" from "3/3 named defects with a defect-named regression". |

Totals: **18 of 19 Resolved, 1 Partially resolved (F5), 0 Persistent, 0 regressed.**

## Facets

- ticket_alignment: **PASS** — all four ticket AC clauses and every named task are traced (Appendix B); the queue, milestone and defect obligations are owned.
- scope_honesty: **PASS** — no new queue verb, record kind, state key, workflow job, error identity beyond the three rows, or second landing mechanism; the F8 "no merge queue" reading stays disclosed (NG-2, Appendix G-7).
- specification_quality: **FAIL** — N2 (a widened value domain with no named validating carrier), and Appendix D's "complete, with counts" still omits the closeout golden pair (N1).
- carrier_observability: **FAIL** — N2 (two delivered validators reject the change's own values).
- testability: **PASS** — 84 cases, 101 controls, every absence paired with a positive, control shapes declared, substitution stated; the two blockers are ownership/oracle-target defects, not oracle-design defects.
- traceability_coverage: **PASS** — 46/46 ACs and 84/84 TCs owned exactly once; four declared cross-phase citations (re-derived, not accepted); ten moved sets in TC-FLOOR-001; seven pin sites.
- cross_artifact_consistency: **FAIL** — N3 (six delivered merge suites reference the removed mechanism; the spec and plan say three invert and thirteen stay unedited) and N5 (version citations and a residuals list that the later revisions already fixed).
- decision_capture: **PASS** — three records `Proposed`, cited not duplicated, staged in phase 1 with committed index rows, never authored or accepted by a phase; OQ-1 routed to the owner as a phase-5 gate; queue integrity recorded as R0.
- system_spec_consistency: **PASS** — no artifact contradicts a current-truth page; the failure is that three pages are not scheduled to be reconciled (N4).
- plan_doc_update_coverage: **FAIL** — N4 (three pages carrying the operation count are in neither Appendix A nor any phase) and N1 (a fourth delivered-check-bound carrier is scheduled in phase 7 only).
- plan_code_area_coverage: **FAIL** — N1 and N2 (enforcing files absent from the scopes that need them).
- plan_buildability_ordering: **FAIL** — N1: phase 5's G1/G2/G4/G6 cannot be green inside its declared scope, and the SCOPE DECLARATION RULE denies staging authority for the fix.
- dod_defined: **PASS** — 46 testable ACs, §4.1 measurable metrics, Appendix B ticket traceability, and G12 as the binding completion gate; no AC asserts an unreachable branch.

## Summary

| Severity | New | Persistent | Total open |
|---|---|---|---|
| Blocking | 2 | 0 | 2 |
| Major | 2 | 1 (F5, partial) | 3 |
| Minor / nit | 3 | 0 | 3 |

## Blocking findings

### N1 [blocking] plan_buildability_ordering · plan_code_area_coverage · plan_doc_update_coverage — phase 5's 35-file scope omits the enforcing surfaces of its own two deltas, so its gate battery is red with no staging authority

**Artifact:** `chg-GH-349-plan.yaml` phase 5 `scope.files` (plan:1501-1547), phase 5 verification (plan:1472-1494: G1, G2, G4, G6), DOCUMENTATION block (plan:618-641: "No delivery phase edits a system specification page EXCEPT the THREE BINDING CARRIERS whose live counts a delivered check reads"), THE RIPPLE (plan:298-328), GOLDEN DISCIPLINE (plan:425-451); `chg-GH-349-test-plan.md` §7.1 (conformance row), §7.3 ("Unchanged by obligation: `tests/behaviour/providers/**`"), TC-FLOOR-005 ("equal to their committed goldens"), §7.2 fixture table; `chg-GH-349-spec.md` Appendix D (golden row is merge-only) and Appendix E item 7.

**Gap.** Phase 5 owns the tenth operation and the thirteenth step. Both deltas move delivered surfaces that phase 5 does not declare, and each fails inside a gate phase 5 runs itself:

*Tenth operation (`ADAPTER_OPERATIONS` 9→10):*

| Enforcing surface | Failure | Declared? |
|---|---|---|
| `packages/adapters/src/github/cli-transport.ts:82-94` | `Readonly<Record<AdapterOperation, GithubTransportPreference>>` — adding the member is a **type error** until a `close-milestone` entry exists → G6 red | **no** |
| `tests/structure/reference-behavior.test.ts:120-181` | asserts the doc's transports table set-equals `ADAPTER_OPERATIONS` and each capability row's supported/gap counts equal the three contracts → G2 red | **no** (and the page it reads is a *fourth* delivered-check-bound carrier, scheduled only in phase 7 — see N4) |
| `tests/structure/registration-participation.test.ts:304-315` | `expect([...ADAPTER_OPERATIONS]).toEqual([…nine literals])` → G2 red | **no** |
| `tests/structure/provider-surface.test.ts:192-202` | `expect(GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations).toEqual([…nine literals])` → G2 red (GitHub must support the new operation) | **no** |
| `tests/behaviour/providers/github-landing.test.ts:112` | `expect([...ADAPTER_OPERATIONS]).toHaveLength(9)` → G1 red | **no** — and the test plan lists `tests/behaviour/providers/**` as read-only (§7.1) *and* "unchanged by obligation" (§7.3) |
| `tests/fixtures/providers/conformance/control/column.ts:13-31` and `tests/conformance/broken-adapter-control.test.ts:206-216` | both register adapters whose supported∪gaps covers nine of ten; `coverage.ts:187-191` emits "operation close-milestone is neither supported nor a gap", and the runner fails closed on the new step (`runner.ts:544-560`) → G4 red via `control-registration.test.ts:48` | **no** |

*Thirteenth step (`CLOSEOUT_STEP_IDS` 12→13):*

| Enforcing surface | Failure | Declared? |
|---|---|---|
| `tests/fixtures/closeout/golden/human.txt` (12 numbered step lines) and `tests/fixtures/closeout/golden/envelope-data.json` | byte-compared by `tests/golden/closeout-human.test.ts` and `closeout-envelope.test.ts` against `buildCloseoutPlan(makeFacts())` → G1 red | **no** — zero occurrences of `closeout/golden` in spec, test plan or plan; TC-FLOOR-005's own target list omits them while asserting the closeout plan "equals its committed golden" |
| `tests/behaviour/closeout-capsule-plan.test.ts:61` | `expect(data.steps.length).toBe(12)` → G1 red | **no** |
| `tests/behaviour/closeout-queue-removal-block.test.ts:19` | `expect(data.steps).toHaveLength(12)` → G1 red | **no** |
| `tests/behaviour/ceremony-nonregression.test.ts:39-40` | `expect([...CLOSEOUT_STEP_IDS]).toHaveLength(12)` → G2 red | **phase 1 only** — it is not in phase 5's `scope.files` and not in the two-phase file list (plan:164-180) |

The plan's own rule makes this fatal rather than cosmetic: the DOCUMENTATION block permits a delivery phase to edit a system page *only* when a delivered check reads its live count, and it says there are exactly **three** such pages. `feature-adapter-reference-behavior.md` is a fourth, and it is declared only in phase 7 (staging for `@doc-syncer`), so G2 is red in phase 5 and the page has no phase-5 staging authority. Likewise Appendix E item 7 requires the documented "nine operations" statements to move in the same change, but the only page carrying them that phase 5 may edit is `feature-adapter-conformance.md`.

**Suggested remediation target phase:** delivery_planning (scope and the two-phase file list), with test_planning for the golden/fixture ownership and the `providers/**` "unchanged" claim.

**Minimum fix:** add to phase 5 `scope.files`: `packages/adapters/src/github/cli-transport.ts`, `tests/structure/reference-behavior.test.ts`, `tests/structure/registration-participation.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/behaviour/providers/github-landing.test.ts`, `tests/fixtures/providers/conformance/control/column.ts`, `tests/conformance/broken-adapter-control.test.ts`, `tests/conformance/live/live-entrypoint.test.ts` (its `ALL_OPERATIONS` list feeds `gapsExcept`), `tests/fixtures/closeout/golden/human.txt`, `tests/fixtures/closeout/golden/envelope-data.json`, `tests/behaviour/closeout-capsule-plan.test.ts`, `tests/behaviour/closeout-queue-removal-block.test.ts`; add `tests/behaviour/ceremony-nonregression.test.ts` to the two-phase list and to phase 5; add `doc/spec/features/feature-adapter-reference-behavior.md` to phase 5 as the fourth binding carrier (row + transport-table reconciliation) while keeping its substance half in phase 7; then state the closeout golden delta (2 files, 12→13 step lines) in Appendix D's golden row and in test plan §7.2/§7.3, and strike "unchanged by obligation" for the `providers/**` file that must move.

### N2 [blocking] carrier_observability · specification_quality — the widened `shaOnBase` domain and the seventh recorded operation name have no state-layer carrier

**Artifact:** `chg-GH-349-spec.md` §5.1 F-1, §8.3 DM-3, §8.5, AC-F1-2, Appendix D (merge-transaction row: "existing records read as before"), Appendix G-9; DM-4, AC-F4-5, Appendix D (closeout-operation row: "the state-layer validation of the recorded operation"); `chg-GH-349-plan.yaml` phase 2 `scope.files` (plan:1053-1108) and phase 5 `scope.files` (plan:1501-1547); `chg-GH-349-test-plan.md` TC-F1-011/012, TC-SYNC-002, DM-3 row.

**Gap.** Two delivered validators reject exactly the values this change writes, and neither file is in any phase scope.

1. **`landing.shaOnBase`.** `packages/core/src/contracts/merge.ts:213` may widen, but `packages/core/src/state/merge.ts:187-192` (`isLanding`) requires `typeof value.shaOnBase === "boolean"`, and `readMergeTransactions` runs it on every record (`state/merge.ts:405-415` via `readMergeRecords`, `:256-266`), returning `state.store.torn` otherwise. `packages/cli/src/edge.ts:1461` consumes that read for convergence. Since the spec requires a production run to record `"unknown"` (F-1, DM-3, AC-F1-2, Appendix G-9), the first provider landing produces a record the state layer refuses to read back: TC-F1-011/012 cannot pass, and closeout's merged-evidence anchor would be unreadable. The spec's "existing records carrying a boolean stay valid" describes one direction only and names no file that must widen.
2. **`close-milestone`.** `packages/core/src/state/closeout.ts:64-104` (`validArguments`) switches on the operation name with `default: return false`; `recordFrom` calls it at `:162` and `readCloseoutHistory` aborts the whole history on a torn record (`:180-205`). A recorded `close-milestone` operation — which DM-4 and AC-F4-5 require ("the step's write is recorded as a `closeout.operation` under the seventh closed operation name") — therefore poisons the ledger on the first apply and every subsequent closeout run fails. Appendix D names this companion ("the state-layer validation of the recorded operation") but phase 5's 35-file scope does not contain the file.

**Suggested remediation target phase:** specification (the merge half's carrier), then delivery_planning and test_planning.

**Minimum fix:** in DM-3/§8.5/Appendix D, name the state-layer validation of `landing.shaOnBase` as a companion move, widened to accept exactly `boolean | "unknown"` with the legacy boolean unchanged; add `packages/core/src/state/merge.ts` to phase 2 and `packages/core/src/state/closeout.ts` to phase 5; extend a case in each half to round-trip the record through the delivered reader (TC-F1-012 for the landing record; TC-SYNC-002 for the recorded operation), and add both files to TC-SYNC-002's "everywhere they exist" pin list.

## Major findings

### N3 [major] cross_artifact_consistency · specification_quality — six delivered merge suites assert the removed mechanism; the artifacts claim three invert and thirteen stay unedited

**Artifact:** `chg-GH-349-spec.md` AC-F1-1 ("Three delivered merge suites invert under this change and are claimed by it") and §16's test-suites row; `chg-GH-349-plan.yaml` phase 2 obligation 2.5 ("Rewrite the THREE inverted suites … and keep the other thirteen delivered merge suites green unedited") against phase 2's own `scope.files`, which declares six merge suites.

**Gap.** A repo grep of `tests/behaviour/merge-*.test.ts` finds six suites asserting the behaviour this change removes: `merge-rebase` (`merge.rebase-conflict` + one refresh), `merge-coordinator-boundary` (`git-squash-land` positive control), `merge-waivers` (waiver-vs-landing ordering), **`merge-landing.test.ts:136,200`** (`git-squash-land` exactly 1), **`merge-convergence.test.ts:102`** (`git-squash-land` exactly 2), and **`merge-refusal-surface.test.ts:138`** (`merge.rebase-conflict` from the conflict path). All six are declared by phase 2, so delivery is *possible* — but the spec names three, obligation 2.5 tells the coder to leave the other thirteen untouched (three of which cannot be), and a DoD/review reader applying AC-F1-1 literally will treat three legitimate, necessary edits as out-of-scope.

**Suggested remediation target phase:** specification, then delivery_planning.

**Minimum fix:** state the delivered merge-suite delta as six suites (three *inverted*: rebase, coordinator-boundary, waivers; three *re-pointed*: landing, convergence, refusal-surface), name all six in AC-F1-1's sentence and §16, and change obligation 2.5 to "keep the other **ten** delivered merge suites green unedited".

### N4 [major] documentation_impact_identification — three current-truth pages carry the operation count and are in neither Appendix A nor phase 7; a fourth is a delivered-check-bound carrier scheduled a phase late

**Artifact:** `chg-GH-349-spec.md` §24.1 Appendix A; `chg-GH-349-plan.yaml` phase 7 `scope.files` (plan:1844-1872) and DOCUMENTATION block (plan:618-641).

**Gap.**
- `doc/spec/features/feature-provider-client-seeds.md` states the operation set four times (`:21` "the whole closed operation set" / "GitHub supports all nine closed operations and declares no gap"; `:58`; `:72`; `:297`).
- `doc/spec/nonfunctional.md:349` — "Cross-adapter parity is a declared matrix over the nine closed operations".
- `doc/overview/architecture-overview.md:107` — "GitHub is the complete reference: all nine closed operations".

None of the three is in Appendix A, in phase 1's three binding carriers, or in phase 7's staging list, so nothing in the plan authorizes or requires them to be reconciled even though Appendix E item 7 requires the documented "nine operations" statements to move. Separately, `doc/spec/features/feature-adapter-reference-behavior.md` is a **fourth** page whose live counts a delivered check reads (`reference-behavior.test.ts`), so the plan's "exactly three binding carriers" rule places it in the wrong phase (N1).

**Suggested remediation target phase:** specification (Appendix A), then delivery_planning (staging).

**Minimum fix:** add the three pages to Appendix A with their required reconciliation (operation set 9→10 on each; GitHub's "no gaps" statement and the GitLab/Jira gap counts), add them to phase 7's staging list, and reclassify `feature-adapter-reference-behavior.md` as the fourth binding carrier in phase 5.

## Minor findings

### N5 [minor] cross_artifact_consistency — the plan cites versions one behind and asserts four stale-prose defects that no longer exist

`chg-GH-349-plan.yaml` SOURCES cites spec "v1.3" and test plan "v1.4" while the artifacts are v1.4 and v1.5 (plan:11, 42). Its RESIDUALS CARRIED block (plan:681-693) asserts that spec DM-2/§8.5/Flow 2 "still show the withdrawn third member", that test plan §11.1 D3 still names `TC-F2-002` (`behind`) and a "three-member set", that §3.1/§3.4 disagree, and that ODR-0005 still treats 200 as the effective bound. All four were verified fixed: spec's v1.4 sweep covers the first three locations; test plan §11.1 D3 now reads "the two-member closed set"; §3.1 and §3.4 both state no open finding; ODR-0005 §4/§11 state the one-page effective bound. **Fix:** update the citations and delete the residuals block (or restate it as history). Target: delivery_planning.

### N6 [minor] decision_capture · cross_artifact — record and pm-notes state facts that later revisions superseded

`ADR-0012`'s revision entries still say the specification's DOCUMENT HISTORY "ends at the 1.1 row" and that the spec and test plan "still carry the withdrawn `behind` value" (ADR-0012:659, :668), which v1.4/v1.5 have corrected; `chg-GH-349-pm-notes.yaml:273-281` still reads "Plan realignment in progress". **Fix:** let the owner's `@decision-advisor`/PM append a one-line note; no phase may edit a record. Target: delivery_planning (pm-notes only).

### N7 [nit] traceability_coverage — the no-leftover pin scan's legacy set is not extended with the values this change retires

`tests/structure/error-table.test.ts:2380-2442` detects stale legacy counts by an explicit token/arithmetic set (146/147/145/140/139/62/56, `+102`/`+106`/`+112`/`+114`/`+113`, entry-146/148 forms, allowlist 63/64 forms). After the move, `149`, `148` and `+115` become legacy but are not added, so a stale `149` outside the seven suites and two pages would no longer be caught by the scan (the seven suites and both pages are covered by hard assertions, so nothing is vacuous). **Fix:** extend the scan's legacy set and its planted-stale detection test in the same commit. Target: test_planning (TC-SYNC-001's pin sweep).

## Answers to the standing questions

1. **Count deltas, re-verified against the delivered declarations.** 149 identities ✓; merge concrete rows 7 (plus one family row) ✓; documented pm-notes lint rows 5, machine 6, `PM_NOTES_LINT_CODES` 5 ✓; closeout steps 12 ✓; `CLOSEOUT_OPERATION_NAMES` 6 with a comment saying five ✓ and 6 argument arms ✓; residue kinds 8 ✓; adapter operations 9 ✓; parity 27 (9×3, derived) ✓; flow steps 14 (9+2+3) and 5 assertion families + carrier flag = the six-member union ✓; trap families 6 / 18 cells ✓; merge goldens 15 = 3 success + 6 pairs ✓. Every "after" state now has a declared home. The two *new* deltas the artifacts still do not count are the closeout golden pair (N1) and the four pages stating the operation count (N4).
2. **Reachability.** No AC asserts an unreachable branch: the reason pair has two emitted values, `shaOnBase`'s three values are all producible through the delivered `containedOnBase: boolean \| "failed"` tri-state, and the milestone outcome table's plan column is the four values a declared fact can produce. The reachability failure has moved from the *value* to the *validator* (N2).
3. **Controls.** The queue controls declare a derived comparison or a broken double (no claimed production breach), the defect controls substitute rather than re-run pre-fix code, every absence claim is paired with a positive in the same case, and the 101-register names the required failure. No case asserts a diff against a moving base.
4. **Plan coverage and ordering.** 46/46 ACs and 84/84 TCs are owned exactly once (vectors `[0,15,4,7,9,6,5]` and `[2,22,7,9,19,12,13]` both re-derived and correct); the four cross-phase citations are exactly four; `plan validate` re-run at this gate returns `valid / full / readyForDevelopment=true`. The ordering logic is sound where it is argued, but phase 5 cannot close inside its own scope (N1) and phase 2 cannot record its own outcome (N2).
5. **Contradictions.** Live: spec/plan vs delivered tree on the merge-suite delta (N3); plan vs the current spec/test-plan versions and residuals (N5); plan phase 5's carrier count vs the delivered check (N4). No residual `behind`, no `would-refuse` in the milestone table, no "four dimension"/"three tenants" text.
6. **Scope honesty.** No new queue verb/kind/state key, no workflow change, no fourth error identity, no milestone create/attach/detach/rename/reopen, no second landing mechanism, no fetch. The only widening reading remains "queue integrity" from four verbs to seven properties, disclosed and bounded (NG-6, Appendix C-1) — accepted.
7. **Owner-judgment items.** OQ-1 is a phase-5 **gate** with an escalation trigger and the correct blast radius ✓. GH-349's own withheld closure is asserted everywhere it must be (RSK-1, AC-F4-7, DEC-8, Appendix G-4, TC-F4-012) and no case asserts a closed M4 ✓. OQ-3 is honestly fixture-decided with the single-page consequence declared in Appendix G-8 ✓.

## Next step

Reopen `delivery_planning` for N1 (phase 5 scope, the two-phase file list, the closeout golden delta, the "providers/** unchanged" claim) and N2's plan half; reopen `specification` for N2's carrier statement, N3's suite count, N4's Appendix A list and the fourth binding-carrier classification; reopen `test_planning` for the closeout-golden ownership, the TC-F1-012/TC-SYNC-002 round-trip extension, and N7. Re-run this gate after the authors revise. No delivery phase may reopen on a DoR finding.
