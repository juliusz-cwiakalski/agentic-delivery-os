# Readiness Review Iteration 3

Verdict: **NOT_READY**
Work Item: GH-349 (M4-S11: Merge, closeout, and queue repair on the primitives, M4)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 3, run at `d907811c` against spec **v1.5**, test plan **v1.7** (87 TCs, 111 controls), plan **v1.1** (7 phases; `plan validate GH-349` re-run at this gate = `valid / full / readyForDevelopment=true`; `lint plan GH-349` = `valid`, exit 0), the amended ADR-0012 / TDR-0040 / ODR-0005, pm-notes, and the delivered tree.

**Delivery stays blocked.** Iteration 2's two blocking findings are one resolved and one *partially* resolved. N2 is fully closed and was re-verified against the delivered validators. N1's declared half is closed — every one of the 13 pins it names exists, is in phase 5, and the two closeout goldens and the two-phase `ceremony-nonregression` split are all in the plan. What the remediation still did not do is finish the sweep it introduced: five further delivered consumers enumerate the tenth operation's membership and must move in phase 5, and **four of them are named in no phase scope, no Appendix H pin row, and no TC-SYNC-009 item** — one of them (`tests/types/merge-delivery-request.type-test.ts`) is an exhaustive `never` switch that makes `pnpm typecheck` (G6) a hard fail, and one (`tests/behaviour/providers/provider-capabilities.test.ts`) is explicitly declared **read-only** by the plan while its assertions cannot pass once GitHub supports the new operation.

Confidence: each finding below was checked against the delivered file and its exact assertion, not inferred from the artifacts. The blocking set is mechanical: four of the five paths produce a red gate by construction, and the two typecheck/behaviour failures were read at their assertion sites.

## Iteration-2 disposition

| # | Sev | Facet | Disposition | Evidence |
|---|---|---|---|---|
| N1 | blocking | plan_buildability_ordering · plan_code_area_coverage · plan_doc_update_coverage | **Persistent (partially resolved)** | Fixed and re-verified: all **13** Appendix H pins are in phase 5 `scope.files` (plan:1879-2088) and all 13 paths exist in the tree; `tests/fixtures/closeout/golden/{human.txt,envelope-data.json}` are declared there (human.txt measured at 12 numbered step lines today, byte-compared by `tests/golden/closeout-human.test.ts:13`); `tests/behaviour/ceremony-nonregression.test.ts` is declared in phase 1 and phase 5 and the split (`:40` step count, identity total) is stated three times (plan:167-182, 1038-1048, 1788-1792); the two control registrations are declared with coverage **10 of 10**. Still open: five membership pins the sweep missed (B1). |
| N2 | blocking | carrier_observability · specification_quality | **Resolved** | `packages/core/src/state/merge.ts:187-192` (`isLanding` requires `typeof shaOnBase === "boolean"`) is in phase 2 (plan:1350) with obligation 2.3a (plan:1284) + M105; `packages/core/src/state/closeout.ts:64-104` (`default: return false`) is in phase 5 (plan:1894) with obligation 5.1a (plan:1799) + M106; round trips are asserted in AC-F1-2 / AC-F4-5 and TC-F1-012 / TC-SYNC-002. `OPERATION_NAMES` derives from `CLOSEOUT_OPERATION_NAMES` (`state/closeout.ts:41`), so the set check passes and only the argument arm is required — as declared. |
| N3 | major | cross_artifact_consistency · specification_quality | **Resolved** | Delivered population is exactly 16 (`tests/behaviour/merge-*.test.ts`); the eight changed suites are the ones that assert the removed mechanism (`merge-convergence:102`, `merge-rebase:53,113`, `merge-waivers:80,102,171,227`, `merge-coordinator-boundary:93`, `merge-landing:136,200`, plus the golden-driven `merge-bounds:127-147` and `merge-determinism:50`); the eight "green unedited" suites carry no `git-squash-land`/`refresh`/`rebase-conflict` count (only `merge-probe:160` asserts **zero** rebase operations, which stays true). AC-F1-1, §16, obligation 2.5 and TC-F1-014 now agree. |
| N4 | major | documentation_impact_identification | **Resolved** (one taxonomy nit split to N10) | `feature-provider-client-seeds.md` `:9/:21/:58/:72/:297`, `doc/spec/nonfunctional.md:349` and `doc/overview/architecture-overview.md:107` verified verbatim and now in Appendix A (spec:629-631), in phase 7 staging (plan:2288-2320) and asserted by TC-SYNC-010; `feature-adapter-reference-behavior.md` is in phase 5 and `tests/structure/reference-behavior.test.ts:117-122,494` genuinely reads the page (row count and set equality), so the reclassification is correct. |
| N5 | minor | cross_artifact_consistency | **Resolved** | Plan SOURCES cite spec **v1.5** and tests **v1.7** (plan:15-70); the four stale-prose claims are replaced by a "RESIDUALS — CLOSED, RECORDED AS HISTORY" block (plan:914-926) and the SPEC-AUTHORITY NOTE keeps the ADR's revision prose as history (plan:106-140). |
| N6 | minor | decision_capture | **Resolved** | ADR-0012's revision section now labels the two follow-up notes resolved and carries the `shaOnBase` carrier, the round trip and the retired-golden clause (ADR-0012:689-691, 421-428, 474); pm-notes records the DoR-2 remediation at 87 TCs / 111 controls as the current entry; no phase edits a record. |
| N7 | nit | traceability_coverage | **Resolved** | Legacy-token extension is declared in Appendix D's token row (spec:710 — `149`, `148` promoted, `+115` in; `151` as the delivered-row pin; two planted-stale controls), in phase 1 obligation 1.2a and in TC-SYNC-001 + M108. Delivered baseline confirmed: `LEGACY_TOKENS` (error-table.test.ts:2374-2399) has neither `149` nor `+115`, and `148` is currently restricted to entry forms (`LEGACY_ENTRY_148_FORMS`). |

Totals: **5 Resolved, 1 Resolved-with-nit (N4 → N10), 1 Persistent (N1), 0 regressed.**

**Iteration-1 regression check:** no F1–F19 fix regressed — the retired `refusal-rebase` pair (F1), the seven identity pin sites (F3), the two-value reason pair (F4), the `milestone-state` seventh family and the six-family trap vocabulary (F6), the `shaOnBase` three-state definition (F9), the OQ-1 phase-5 gate (F12) and the D8 closure (F13) were all re-read and hold. One iteration-1/2 *declaration* is now stale rather than regressed: F7's "exactly four cross-phase citations" (N9).

## Facets

| Facet | Result |
|---|---|
| ticket_alignment | **PASS** — all four ticket clauses and every named task traced (Appendix B); queue, milestone and defect obligations owned. |
| ac_quality | **PASS** — 46 ACs, each with a producing branch, a carrier and a control; no AC asserts an unreachable branch. |
| plan_coverage | **PASS** — 46/46 ACs and 87/87 TCs owned exactly once, vectors re-derived `[0,15,4,7,9,6,5]` / `[2,23,7,9,20,12,14]`. |
| test_traceability | **PASS** — every AC mapped in §3.1; no orphan case. |
| cross_artifact_consistency | **FAIL** — B1 (Appendix H's pin column and TC-SYNC-009 against the delivered consumers) and N9 (the citation set is five, the plan says four). |
| decision_capture | **PASS** — three `Proposed` records, cited not duplicated, staged in phase 1, index rows committed; OQ-1 is a phase-5 gate. |
| system_spec_consistency | **PASS** — no artifact contradicts a current-truth page; the remaining page question is a label, not a behaviour (N10). |
| plan_doc_update_coverage | **PASS** — six delivery-phase pages under four named carrier classes, three prose-only pages in phase 7, G8 in both phases. |
| plan_code_area_coverage | **FAIL** — B1: four files that must move in phase 5 are in no phase scope. |
| dod_defined | **PASS** — 46 testable ACs, §4.1 measurable metrics, G12 as the binding gate. |
| plan_buildability_ordering | **FAIL** — B1: phase 5's G1 and G6 are red inside its own scope, and the SCOPE DECLARATION RULE plus the "read-only" claim give four required files no staging authority. |
| specification_quality | **FAIL** — B1's pin inventory and N9's citation count are stated counts that do not match the tree. |
| carrier_observability | **PASS** — every widened/added value has a named delivered carrier and a write-then-read round trip. |
| scope_honesty | **PASS** — no new verb, kind, key, job, error identity or second mechanism; the two widenings (queue "integrity", single-page read) stay declared and bounded. |
| testability | **PASS** — 87 cases, 111 controls, declared control shapes, substitution stated; no case asserts a moving base. |

## Findings (new or persistent only)

### B1 [blocking] plan_code_area_coverage · plan_buildability_ordering · cross_artifact_consistency — the tenth operation's membership pins are still incomplete: five delivered consumers must move in phase 5 and four have no staging authority

**Artifacts:** `chg-GH-349-spec.md` §24.8 Appendix H `ADAPTER_OPERATIONS` row (spec:759, derived cell) and DM-6/DM-7 (spec:318-319); `chg-GH-349-test-plan.md` TC-SYNC-009 (test-plan:1076-1085), §7.2 (test-plan:1201) and §7.6 row 5 (test-plan:1430-1437); `chg-GH-349-plan.yaml` phase 1 folder (plan:1147), phase 5 `scope.files` (plan:1879-2088), SCOPE DECLARATION RULE (plan:167-182), phase 5 "READ-ONLY, NARROWED" block (plan:1788-1792).

**Gap.** Adding `close-milestone` to `ADAPTER_OPERATIONS` moves the three capability declarations (declared, `packages/adapters/src/{github,gitlab,jira}/capabilities.ts`) and thirteen further pins (declared). It also moves five consumers that the sweep either mislabels as *derived/no edit* or omits entirely, and each one is red inside phase 5:

| Delivered consumer | Assertion that fails at ten | Declared in phase 5? |
|---|---|---|
| `tests/types/merge-delivery-request.type-test.ts:54-80` | `operationLabel` handles the nine members, then `default: { const unhandled: never = operation; … }` with **no** `@ts-expect-error`; with a tenth member `operation` is `"close-milestone"`, so the assignment is a type error. Compiled by `tests/types/tsconfig.json` through `pnpm typecheck` (package.json:13) → **G6 red**. (The second helper at `:83-93` keeps its `@ts-expect-error` valid, so only the first must gain an arm.) The file's own comment says "the closed set grew". | **no** — the file is named in **no** artifact |
| `tests/behaviour/closeout-capabilities.test.ts:56-68` and `:14-28` | `expect([...GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations]).toEqual([…9 literal members])` and `expect(JIRA_ADAPTER_CONTRACT.capabilities.declaredGaps).toEqual([…6 literal gaps])` → **G1 red** on both. | **no** — absent from Appendix H, TC-SYNC-009, §7.6 and every phase |
| `tests/behaviour/providers/provider-capabilities.test.ts:83-95, 143-167, 196-213` | `declarationFailures` loops the live `ADAPTER_OPERATIONS` and requires exactly one gap per unsupported operation (`close-milestone: exactly one gap record is required, found 0` for jira and gitlab), compares GitHub's supported set to `EXPECTED_SEED_POSTURES.github.supported` (nine literals), and requires a client method for every supported operation via the literal `WRITE_METHODS` map, which has no `close-milestone` entry (`github:close-milestone needs an implementation method`) → **G1 red**. | **no**, and the plan says the opposite: "exactly THREE of its suites move … every OTHER suite under that tree stays read-only" (plan:177-182, 1788-1792) |
| `tests/fixtures/ports/capabilities.ts:208-255` | `EXPECTED_SEED_POSTURES` is a membership pin of the closed set (jira 6 gaps, gitlab 7 gaps, github 9 supported); it must gain the new gap/supported arm for the suite above to pass. | **no** — Appendix H lists it as **Derived (no edit)**; only a phase-1 `tests/fixtures/ports` folder exists (plan:1147) |
| `tests/conformance/mock-conformance.test.ts:141-158` | its own `ALL_OPERATIONS` (nine literals) feeds `gapsExcept`; with ten operations the new step is neither supported nor a gap, so `runConformance` returns `failClosed("undeclared unsupported operation", …)` (`runner.ts:614-623`) and the suites asserting `runtimeCoverageViolations(...) === []` fail → **G4/G1 red**. | the **file is** in phase 5 scope (route cases), but Appendix H calls it *derived* and TC-SYNC-009 does not name the edit |

This is the same class as iteration-2 N1, and the plan makes it fatal rather than cosmetic: the SCOPE DECLARATION RULE denies staging authority for the four undeclared files, the phase-5 block forbids touching the provider suite by name, and both the Appendix H residue rule and an escalation trigger say a pin discovered during delivery is a specification defect that returns for revision — i.e. delivery would stop in phase 5.

**Suggested remediation target phases:** delivery_planning (scope), specification (Appendix H pin column + DM-6/DM-7 companion text), test_planning (TC-SYNC-009, §7.2 and §7.6 row 5).

**Minimum fix (mechanical, no redesign):**
1. Add to phase 5 `scope.files`: `tests/types/merge-delivery-request.type-test.ts`, `tests/behaviour/closeout-capabilities.test.ts`, `tests/behaviour/providers/provider-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts` (phase 5 becomes 64 files). `mock-conformance.test.ts` is already declared; record the `ALL_OPERATIONS` edit there.
2. Move `tests/fixtures/ports/capabilities.ts`, `tests/behaviour/providers/provider-capabilities.test.ts` and `tests/conformance/mock-conformance.test.ts` from Appendix H's derived cell to the pin cell, and add the two new paths, so the `ADAPTER_OPERATIONS` pin count is **18**, not 13; state the same count in DM-6/DM-7, Appendix D, NFR-6/7, AC-F4-1's carrier cell, TC-SYNC-009 (one item per file), §7.2 and §7.6 row 5.
3. Amend the read-only claim from three to four provider-path items ("`github-cli-transport`, `github-landing`, `github-collection`, `provider-capabilities`") in the SCOPE DECLARATION RULE, the phase-5 block and the matching escalation trigger.
4. State the content of the posture edit in DM-6: GitHub supported += `close-milestone`; GitLab `adapter-not-implemented`; Jira `provider-unsupported`; `EXPECTED_SEED_POSTURES` and the `WRITE_METHODS` map follow; the type probe's `operationLabel` gains its tenth arm.
5. Re-derive the sweep mechanically before re-running this gate: grep every `--include=*.ts` occurrence of `ADAPTER_OPERATIONS`, of each operation literal, and of `Record<AdapterOperation`/`never = operation`, and classify each hit. Every miss above is findable exactly that way, and so is the next one.

### N9 [major] cross_artifact_consistency · test_traceability — the declared cross-phase citation set is five, not four

**Artifacts:** `chg-GH-349-test-plan.md` §3.1 AC-F4-1 row (test-plan:114, whose TC column names `TC-SYNC-010`); `chg-GH-349-plan.yaml` CROSS-PHASE CARRIER CASES (plan:760-810, "The set is FOUR, not three") and TC ownership (TC-SYNC-010 → phase 7).

**Gap.** Re-deriving §3.1 against plan ownership by the method iteration 2 used yields five citations, not four: the four declared ones (`AC-F1-6→TC-SYNC-004`, `AC-F1-7→TC-SYNC-003`, `AC-F2-5→TC-SYNC-001`, `AC-F2-6→TC-SYNC-008`) plus **`AC-F4-1 → TC-SYNC-010`** (AC-F4-1 is phase 5, TC-SYNC-010 is phase 7). The plan asserts "No other AC cites a TC outside its owning phase" and "The set is FOUR, not three: a plan that says 'three' is wrong", so the declaration is now wrong in the direction it warns about. No AC is *only* covered by a phase-7 case — AC-F4-1 also has TC-F4-001/TC-SYNC-002/003/009 in its own phase — so this is a bookkeeping/traceability defect, not an unbuildable phase. It is reported now because the same sentence is the DoD reader's map.

**Suggested remediation target phase:** test_planning, then delivery_planning.

**Minimum fix:** either drop `TC-SYNC-010` from AC-F4-1's §3.1 TC column (AC-F4-1's own text requires the closeout inventory, not the prose-only operation-count pages; the obligation is carried by DM-7's row and Appendix D), or declare the fifth citation in the plan and change "FOUR" to "FIVE" with the `AC-F4-1 → TC-SYNC-010` pairing and its documentation-phase rationale.

### N10 [minor] documentation_impact_identification · carrier taxonomy — Appendix A labels a page "delivered-check-bound" that no delivered check reads, and the plan counts three

**Artifacts:** `chg-GH-349-spec.md` Appendix A `feature-adapter-conformance.md` row (spec:628); `chg-GH-349-plan.yaml` DOCUMENTATION class (1) (plan:813-860) and §7.3 (plan:2232-2245); `chg-GH-349-test-plan.md` TC-SYNC-010 owner note (test-plan:1093).

**Gap.** The spec's row says the page is "**A delivered-check-bound carrier**: `tests/structure/conformance-coverage.test.ts` and `tests/conformance/control-registration.test.ts` read the registry it describes" — but those suites read `packages/testkit/src/conformance/*`, not the page (verified: neither reads `doc/spec`). The plan's class (1) is therefore correct at three pages, and the conformance page's "nine operations" / "fourteen-step" statements are reconciled by lifecycle phase 7 with no case asserting them. A DoD reader comparing the spec label with the plan's "exactly three" sees a contradiction that is only a wording defect. (The reference-behavior page is genuinely check-bound — `reference-behavior.test.ts:117-122,494` parses it — so it is not part of this finding.)

**Suggested remediation target phase:** specification.

**Minimum fix:** reword the Appendix A row to "registry-bound prose: the page documents the registry two delivered suites read, but no check reads the page; reconcile in phase 7 (staging only)" and drop the bold carrier label, leaving the four-class taxonomy at 3 / 1 / 1 / 1.

### N11 [nit] cross_artifact_consistency — folded into B1, recorded separately for the sweep's ledger

Appendix H's derived cell lists `tests/conformance/mock-conformance.test.ts` as "set equality → no edit". Its `ALL_OPERATIONS`/`gapsExcept` must gain the member (see B1). The fix is B1 item 2; this row exists so the sweep's own residue rule ("no changed set has an unowned pin") is not read as satisfied.

## Answers to the standing questions

1. **N1's thirteen pins and the two goldens.** All 13 listed paths exist and all 13 are in phase 5; `tests/fixtures/closeout/golden/{human.txt,envelope-data.json}` are declared there and today hold 12 numbered step lines; the four count-pinning closeout suites and both `ceremony-nonregression` halves are each declared exactly once per phase; control coverage is stated as 9 of 9 → 10 of 10 in DM-7, Appendix D, phase 5 obligations and its verification signal. The residual defect is B1, not the declared set.
2. **N2's state-layer carriers.** Both named files, both same-commit, both with round-trip acceptance criteria and both mutated by name (M105/M106). Closed.
3. **Eight changed / eight green.** Verified against the sixteen delivered files, not accepted from the artifact; the split is exactly the suites that assert the removed mechanism plus the two golden-forced edits.
4. **Count deltas, re-verified against delivered declarations.** 149 ✓; merge rows 7→9 ✓; documented lint rows 5 / machine 6 / `PM_NOTES_LINT_CODES` 5 ✓; closeout steps 12 ✓; operation names 6 (comment says "five", corrected in phase 5) ✓; residue kinds 8 ✓; operations 9 ✓; parity 27 (9×3) ✓; flow steps 14 and six assertion families ✓; trap families 6 ✓; merge goldens 15 = 3 success + 6 pairs ✓; closeout goldens 12 step lines ✓. The two stored-delta defects are B1 (five consumers, not thirteen) and N9 (five citations, not four).
5. **TC-SYNC-010's split and the carrier taxonomy.** One owner per assertion holds: TC-SYNC-001 is identity-only, TC-SYNC-009 the check-bound table, TC-SYNC-010 the three prose pages, and no page has two owners. The taxonomy is 3 check-bound / 1 case-bound / 1 AC-bound / 1 test-plan-bound in the plan; the only defect is the spec's label for the conformance page (N10).
6. **TC-SYNC-001's reachability authoring in phase 7.** Declared in both phases (phase 1 owns the case; phase 7 declares `tests/checks/error-table-sync.test.ts` for the reachability half), follows the GH-339 FLOOR-001 precedent, and is green at each phase boundary because no delivered check asserts reachability. Acceptable.
7. **No AC relies only on a phase-7 case.** AC-F7-* land in phase 7 by design and each repaired behaviour is asserted in its own repair phase (F1/F8 phase 2, F4 phase 4); AC-F4-1's phase-7 citation is the N9 defect and is non-exclusive.
8. **Buildability.** Each commit's pins otherwise move together: phase 1 (identity total + seven sites + legacy tokens + two identity pages + the metrics case), phase 2 (type widening + validator + golden deletion + eight suites), phase 3 (attribution + two goldens + determinism), phase 4 (fold + row + registry read), phase 5 (the whole Appendix E ripple, the two closeout goldens and the state-layer arm — once B1 is fixed), phase 6 (conditional repair), phase 7 (defect suites + residual pins + docs staging). `plan validate` and `lint plan` are green at this HEAD.
9. **Owner-judgment items.** OQ-1 remains a phase-5 **gate** with the correct blast radius; GH-349's own withheld closure is asserted everywhere (AC-F4-7, DEC-8, Appendix G-4, TC-F4-012) and no case asserts a closed M4; OQ-3 stays fixture-decided with the single-page consequence declared. Unchanged and accepted.

## Next step

Reopen **delivery_planning** for B1 (four files into phase 5, the pin count 13→18, the read-only claim 3→4, the posture content in DM-6) and for N9's plan half; reopen **specification** for Appendix H's pin column, DM-6/DM-7, AC-F4-1's carrier cell and N10's label; reopen **test_planning** for TC-SYNC-009, §7.2, §7.6 row 5 and N9's §3.1 cell. Then re-run this gate once, against a mechanically re-derived sweep. No delivery phase may reopen on a DoR finding.

Because this is the third iteration and the surviving finding is the third instance of one class (a closed-set consumer missing from the inventory), the next remediation should be gated on a scan result rather than on prose: every `ADAPTER_OPERATIONS` reference, every operation literal, and every `Record<AdapterOperation`/`never = operation` site classified as pin, derived or unrelated, with the classification checked into Appendix H. If that scan still leaves a pin unowned, the gap is in the sweep method and should be escalated to the human rather than iterated again.
