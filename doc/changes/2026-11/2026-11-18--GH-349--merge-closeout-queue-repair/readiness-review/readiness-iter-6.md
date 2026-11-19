# Readiness Review Iteration 6

Verdict: **READY**
Work Item: GH-349 (M4-S11: Merge, closeout, and queue repair on the primitives, M4)
Date: 2026-11-19
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 6 — a **reconciliation re-run**, not a fresh gate. Iteration 5 returned READY; the branch then merged `origin/main-tools` (PR #357, merge commit `1bd66293`) and three artifacts changed. This run verifies that the reconciliation is correct and introduces no blocking defect, and does not reopen settled scope or ACs.

Artifacts reviewed at HEAD `5c933ea5`: spec **v1.8** (last written `89ccf135`), test plan **v1.10** (`89ccf135`), plan `chg-GH-349-plan.yaml` (`89ccf135`), pm-notes (release note uncommitted at gate time), ticket `gh issue view 349` (`updatedAt` 2026-11-18T21:41:15Z — unchanged since iteration 5), and the delivered tree at `5c933ea5`.

## What changed since iteration 5

| Area | Change | Commit |
|---|---|---|
| Base of the identity arithmetic | `origin/main-tools` added four upstream `harness` identities: base 149 → **153**. GH-349's delta stays **+3**, so the merged truth is **156 documented / 155 delivered / 67 allowlist / `+122`**; the event baseline fixture is **150 rows** and the supervision oracle keeps its positional rule at `live` **153** with exactly the two merge rows plus `lint.phases.divergent` outside it. | `1bd66293` |
| Decision-record identifier | Upstream took `TDR-0040`–`TDR-0043` (harness-seat, harness-dispatch, opencode-mode, opencode-adapter), so GH-349's phase-truth record became **`TDR-0044`**, content unchanged, swept through the index and all three artifacts. | `1bd66293`, `89ccf135` |
| Release metadata | The merged aggregate gate exposed that a publishable-package change shipped no changeset. Phase 1 gained obligation **1.0** and three paths; the test plan gained **`TC-SYNC-011`** with `M117`–`M123`. | `89ccf135`, `5c933ea5` |

No AC text, criterion, invariant, boundary, appendix, phase ordering or AC vector changed. Independently measured: the AC id set is **identical** before and after the reconciliation (46/46); the TC set grew by exactly one id (`TC-SYNC-011`, 87 → 88) with none removed or repurposed.

## Verification of the six reconciliation checks

| # | Check | Result | Evidence measured at this gate |
|---|---|---|---|
| 1 | Every absolute count agrees with the tree; delta stated as +3; no artifact presents `152`/`151`/`65`/`+115` as current outside labelled history | **PASS** | `ERROR_TABLE` parses to **156** rows (154 quoted + the 2 fallback constants); delivered filter ex-`spend` = **155**; `RESERVED_TWO_SEGMENT_CODES` = **67**; `BASELINE_ROWS.length` = **34** → `+122` = 156; baseline fixture `rows` length **150**; live oracle excluding `supervise`/`metrics` = **153** with the three named outside rows (`merge.sync-required`, `merge.mergeability-unknown`, `lint.phases.divergent`); per-kind `merge` 9, `lint` 7, `harness` 13 all match. All seven pin sites carry 156 (`error-table-sync`, `supervision-error-socialization`, `error-table`, `dispatch-attempts-taxonomy`, `verify-gates-suite-map-contract`, `ceremony-contract`, `ceremony-nonregression`). The three carrier pages read `156/155/67/+122` and `156 identities`. Every occurrence of `152`/`151`/`+118` is inside a labelled history row, a "deliberately not added" clause, or a pre-merge passage carrying the POST-MERGE ADDENDUM; every `65` is inside a labelled pre-merge row or the `65→67` allowlist move. Delta stated as +3 in spec §2.1 note, spec §4.1, test-plan reconciliation block and plan RECONCILIATION block. |
| 2 | `TDR-0040` appears only in renumbering explanations; every citation is `TDR-0044` | **PASS** | Four occurrences survive and all are renumbering explanation: spec history 1.8 ("not TDR-0040"), test-plan §2 renumbering note, plan RECONCILIATION item 2, plan obligation 1.4. All live citations resolve to `doc/decisions/TDR-0044-phase-truth-registry-fold-mirror.md` (spec front matter, §5 deps row, DEC-5 source, Appendix A index row, §6 deliverables; test-plan §2 sources row; plan SOURCES, staging block, phase-1 scope path, phase-4 note). Upstream `TDR-0040`–`TDR-0043` exist in the tree with exactly the subjects the note names, so the renumbering is a real collision, not a cosmetic rename. |
| 3 | The release obligation is buildable and honest | **PASS** | `.changeset/` holds **65** `.md` files against a **64**-entry baseline → exactly one added file, `gh-349-merge-closeout-queue-repair-minor.md`. Its front matter declares exactly the five fixed-group packages at `minor` and `.changeset/config.json`'s `fixed` array is that same five; `@delivery-os/testkit` is absent and the pin is a five-key map; the body is non-empty prose naming the two merge rows, the lint row, the title, the milestone step/operation/residue and the tenth operation. Every other changeset is untouched (per-file SHA-256 digests) and all six packages remain `0.0.0` — changesets owns the bump. Executed at this gate: `bun test tests/structure/changeset-additivity.test.ts` → **11 pass / 0 fail**, and `privacy-release.test.ts` + `supervision-error-socialization.test.ts` → **14 pass / 0 fail**, so the delivered repository guard that first caught the gap and the new tree pin agree. The seven controls are present and each asserts its own violation code and detail (`added.zero`, `added.multiple`, `bump.not-minor`, `package.unexpected` for both a sixth package and `testkit`, `body.empty`, `baseline.digest`, `version.hand-edited`); every control runs `releaseViolations` over a synthetic baseline, so no control passes vacuously and none depends on tree state. |
| 4 | Phase 1's declared scope covers what phase 1 delivered; no delivered path is undeclared | **PASS** (with one explained phase-local gap) | Machine comparison of `phase 1 scope.files` (**28**) against the union of the delivered commits (`0a3dc3ff` 28 paths + `5c933ea5` 3 paths = 31 unique): the 28 declared files match the declared set exactly, including the four earlier scope-drift files (`scripts/checks/error-table-sync.ts`, `tests/fixtures/events/error-table-baseline.json`, `tests/structure/supervision-error-family.test.ts`, `tests/types/delivery-thread.type-test.ts`) and the three release paths (`.changeset/gh-349-…-minor.md`, `tests/fixtures/pins/changeset-baseline.json`, `tests/structure/changeset-additivity.test.ts`), plus the renumbered `doc/decisions/TDR-0044-…md` path. The three remaining delivered paths are **not** undeclared: `chg-GH-349-pm-notes.yaml` is the command-owned change artifact (the change folder is declared in phase 7), and `tests/structure/merge-classification-conformance.test.ts` and `tests/structure/reference-behavior.test.ts` are declared in phases 2 and 5 and were moved early — the plan's PHASE 1 AS DELIVERED note names both, states why they had to move with the rows, and states the advisory `undeclared-missing` consequence for the later phase. Only `.changeset/` is declared in phase 1 (verified: no other phase declares a changeset path). |
| 5 | No AC, criterion, invariant or boundary changed; 46 ACs, 88 TCs each owned once | **PASS** | 46 AC ids identical pre/post reconciliation; AC-owner vector `[0,15,4,7,9,6,5]` = 46 unchanged in the plan; §3.1 holds 46 rows. 88 test-plan ids vs 88 plan-owned ids form an exact bijection (range expansion of `TC-F1-001..014`, `TC-F2-001..008`, `TC-F3-001..006`, `TC-F4-001..015`, `TC-F5-001..008`, `TC-F6-001..012`, `TC-F7-001..006`, `TC-SYNC-001..011`, `TC-FLOOR-001..008`) — zero unowned, zero unknown, ownership vector `[3,23,7,9,20,12,14]` = 88 as declared. Mutation register **123** rows, `M1`–`M123` contiguous with no duplicate; the seven new rows `M117`–`M123` match the seven failure modes the delivered suite actually asserts. No new verb, record kind, state key, job or second mechanism; the changeset is release metadata, not a surface. |
| 6 | Nothing blocking from iterations 1–5 regressed | **PASS** | The 18 operation pins are all in phase 5 (20 spot-checked paths incl. `parity.ts`, `adapter-operation-consumers.test.ts`, both `provider-surface` arrays, the two control registrations, the two `ALL_OPERATIONS` lists); phase 5 is **64** files; the seven identity sites now assert 156 (iteration 5's single total was 152); `harness` is 13 not 9, which is the merge's own delta; the three decision records are now **tracked**, still `Proposed`, never accepted, with their index rows (`00-index.md:24/27/76`), closing iteration-5 N6; the two `provider-surface` arrays, the narrowed provider read-only set, the five cross-phase citations and the `milestone-state` family are unchanged. `delivery-os plan validate GH-349` → `valid / full / readyForDevelopment=true`; `delivery-os lint plan GH-349` → `valid`, zero errors. Supplementary aggregate evidence, run at this HEAD: `bun test tests/structure tests/checks` → **2977 pass, 0 fail** across 320 files (exit 0), which covers both the reconciled identity surface and the new release pin. |

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS (N7–N9 recorded, non-blocking)
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS
- plan_buildability_ordering: PASS
- scope_honesty: PASS
- testability: PASS

## Findings

No blocking finding. The reconciliation is a count/identity/release reconciliation and introduces no new AC, criterion, invariant, boundary, risk or scope-honesty gap.

### Persistent (unchanged since iteration 5, non-blocking)

1. [minor] plan_code_area_coverage · cross_artifact_consistency — `chg-GH-349-plan.yaml#2190-2191, #2308`
   Gap: the `Object.keys(client)` array's post-change length is still stated as 15 (`14→15`) although a milestone read on the recorded closeout-read precedent makes it 16. **Non-blocking and already settled**: pm-notes records the PM direction (2026-11-18) that the delivered 16 supersedes the plan's clause and that the expectation is authored from the real key set in the phase-5 commit.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: none required before delivery; the phase-5 commit authors the list from the actual client and the plan clause is superseded by the pm-notes decision.

2. [nit] cross_artifact_consistency — `chg-GH-349-plan.yaml#21, #635`
   Gap: the withdrawn `329`-hit figure survives in two rationale lines describing Appendix H.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: replace the parenthetical with "2 135 files, pin set transcribed".

3. [nit] cross_artifact_consistency — `chg-GH-349-test-plan.md#168`
   Gap: the DM-7 row still reads "the thirteenth-operation enforcing pins … eighteen pins in all".
   Suggested remediation target phase: test_planning.
   Suggested fix: "the tenth operation's **eighteen** enforcing pins".

4. [nit] cross_artifact_consistency — `chg-GH-349-test-plan.md#71`
   Gap: the binding-source row still cites spec **v1.6** while the artifact under review is v1.8 (its AC/NFR inventory is unchanged, and §2 carries the v1.10 reconciliation block, so no requirement is ambiguous). The plan-side half of iteration-5 N4 is resolved.
   Suggested remediation target phase: test_planning.
   Suggested fix: cite spec v1.8.

5. [nit] specification_quality — `chg-GH-349-spec.md#757, #769`
   Gap: Appendix H still promises that every filter hit is classified, while 27 hits carry no cell (all previously verified no-edit). The pin inventory is unaffected.
   Suggested remediation target phase: specification.
   Suggested fix: the one clause naming the three residual classes already proposed at iteration 5.

### New in this iteration (non-blocking)

6. [minor] cross_artifact_consistency — `chg-GH-349-plan.yaml#276-278, #1447-1448, #1075-1079`
   Gap: the merge reconciliation restated the count block but missed three current (non-history) passages. Two phase-1 scope annotations still say the captured baseline is "146 captured rows" and that "the live filtered set grows 146→149", while the merged truth — which the same plan states at `#314` and the tree delivers — is a **150-row** baseline with `live` **153**. A carrier-class entry still describes the two identity pages as carrying "`149` statements" although both pages now read 156. This is an internal contradiction, not a delivery instruction: phase 1 already delivered those files, no later phase's scope includes the baseline fixture or the supervision oracle, and the delivered assertion (`tests/structure/supervision-error-family.test.ts`: 150 rows, live 153, three named outside rows) is green, so no value can be fabricated from it.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: in the two phase-1 passages read "150 captured rows still present and byte-identical; the live filtered set is 153"; at `#1075-1079` read "the `156` statements" for both pages.

7. [nit] cross_artifact_consistency — `chg-GH-349-test-plan.md#5`
   Gap: `last_updated: 2026-11-18T22:20:00Z` while the v1.10 revision row is dated 2026-11-19 (spec and plan carry no equivalent field, so nothing else is inconsistent).
   Suggested remediation target phase: test_planning.
   Suggested fix: bump `last_updated` with the next test-plan edit.

8. [nit] testability — `tests/structure/changeset-additivity.test.ts#1-16` (and `chg-GH-349-plan.yaml#1326-1333`)
   Gap: the permanent pin digests 64 foreign changeset files and hard-asserts "exactly one added file", so any later merge that lands a changeset (as this merge did with `gh-335-…`) or any edit to a pre-existing changeset makes the case red and requires a deliberate baseline re-capture. The test's provenance says it is "never regenerated by a test" but states no update rule, so the next author meets a red gate with no declared remedy.
   Suggested remediation target phase: test_planning.
   Suggested fix: one sentence in the provenance (and mirrored in obligation 1.0): "re-captured only by the change that lands the next changeset, never by a test run".

## Prior-iteration regression check

Iterations 1–5 residuals: N6 (untracked decision records) is **closed** by phase 1 (`0a3dc3ff`); N1 is still present but superseded by an explicit PM decision note (finding 1); N2–N5 are editorial and still present (findings 2–5). Nothing that was resolved at iterations 1–5 has regressed: the retired `refusal-rebase` pair's 2 moved / 2 retired / 11 unchanged arithmetic, the seven identity pin sites, the `merge.sync-required` `dirty` | `behind-unconfirmed` pair, the `landing.shaOnBase` widening with its state-layer validator and round trip, `milestone-state` as the seventh assertion family with the trap families at six / 18 cells, `CLOSEOUT_OPERATION_NAMES` 6→7 with both arms, the OQ-1 phase-5 gate, the eighteen Appendix H pins and the parity module's two authored columns, the five cross-phase citations, and the TC-FLOOR-003 narrowed read-only set are all unchanged.

Counts re-measured at this gate: 46 ACs (id-identical), 88 TCs, 88/88 owned exactly once, 123 controls (`M1`–`M123` contiguous, no duplicate), 7 phases, phase 1 = **28** declared files, phase 5 = **64** files, 18 pins in phase 5 (spot-checked), 7 pin sites at 156, 65 changesets = 64 pinned + 1 added, plan `valid / full / readyForDevelopment=true`, `lint plan` valid.

## Next step

Delivery continues at **phase 2**. Nothing reopens; no pause flag. Findings 6–8 are one-pass editorial cleanups that need no gate re-run, and finding 1 stays settled by the pm-notes PM direction: the number the client actually has wins in the phase-5 commit.
