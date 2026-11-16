# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-287
Date: 2026-11-16
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Verification Evidence (spot-checks performed, not trusted)

- Ticket read live (`gh issue view 287`): milestone "M2: Ceremonies, measurement, and memory" attached; six verbatim ACs match spec §17's traceability decomposition; both PM scope exclusions verified honest — `concepts/inter-agent-communication.md` is genuinely parked ("designed, not scheduled"; DEC-1), and the failure-to-regression-test compiler appears only in `concepts/retrospectives.md` story mapping, absent from ticket tasks/AC and from the canonical backlog M2-S10 row (DEC-2).
- Concept authority verified: five-field contract, verb vocabulary (add/remove/change/test/deploy), aging ladder (14/30/second miss), closure routes, outcome verifier + rollback condition, artifact-vs-outcome closure, WIP 1–3 range, board surface beside asks, `retro` command family as registry home (all quoted accurately in the spec).
- Dependency truth verified against current repo: retro pipeline (`collect|report` grammar, `followThrough[]` `{action, verdict, artifactRef?}`, "enforcement is later work", four `retro` error rows in machine table and documented table), ceremony runner (asserted follow-through-first, `applied/partial/violated-with-consequence`, handoff "filing, the five-field action contract, aging, and closure belong to M2-S10"), board (`delivery.board.v1`, four sections, 15 `DATA_KEYS` pinned, `LANES, GATES, ASKS, PARKED` labels pinned), doctor `retro-registry` store-fact pattern at `packages/cli/src/edge.ts`, retro-registry boundary "exactly three" kinds, m2 README `telemetry.v1` advisory consumption row, M1 snapshot `retro.md` + coverage.json row (byte-unchanged target), m2 `commands/` page root without a `retro.md` yet (new page plausible).
- Drift register truthfulness: D-1/D-2/D-4 (4 retro rows, today exactly 4 in both tables), D-5 (`DATA_KEYS` length 15), D-6 (label sequence), D-11 (exact-four-keys assertion in `tests/behaviour/retro-report.test.ts`) all match current pins. All D-1..D-28 rows are mapped to a phase scope; goldens-regenerate-by-command discipline declared.
- TC ownership: plan TC→PHASE map sums 1+8+10+1+0+5+4+9+1 = 39, ids TC-ACTION-001..039 each owned by exactly one phase (TC-ACTION-036 single-homed in Phase 9 with Phase-5 halves named); test plan §5.1 index = 39 ids; §7 automation map = 39 rows; no orphan TCs; 15/15 spec AC ids covered in §3.1; ticket-AC verbatim table present.
- File-path truth: every "update" target in every phase scope exists; every "new" target (contracts/action.ts, state/action-registry.ts, domain/action-*.ts, all action test suites, tests/fixtures/action/, m2/commands/retro.md, feature-retro-action-registry.md, changeset file) does not yet exist — plausible-new — EXCEPT the one in Finding 1.
- Gates runnable: all gate suites/scripts exist (`board-purity`, `retro-collect`, `ceremony-hermetic`, `exports-parity.ts`, `changesets-group.ts`, `lint-commit-range.sh`, `test-doc-distribution.sh`) except the Finding-1 path. `plan validate GH-287` re-run in this review: verdict=valid, tier=full, readyForDevelopment=true (matches PM claim; no repo mutation).
- DoD: spec §17 AC table + §4.1 KPI table + plan Phase 9 Exit block ("every AC is met and every declared phase complete, AC-F1-1..AC-N8-1 mapped per the TC→PHASE MAP") give phase-10 dod_check a testable definition.
- Decision capture: DEC-1..DEC-11 logged in spec + pm-notes with @decision-advisor provenance; change-scoped classification defensible (DEC-5 follows delivered additive-row precedent; DEC-6 narrows within the concept's stated 1–3 range as contract data; DEC-7 follows the sibling-boundary paved road); no doc/decisions record missing.

## Findings

1. [major] plan_code_area_coverage — chg-GH-287-plan.yaml#Phase-2 (scope.files `tests/structure/packed-state.test.ts`; Gate line `bun test tests/structure/{state-scope,packed-state,...}`; header DELIVERED-SUITE DRIFT D-mapping "D-21..D-23 Phase 2")
   Gap: The declared suite path does not exist. The delivered packed-state suite is `tests/checks/packed-state.test.ts` (verified: only occurrence in the tree; `tests/structure/` has no packed-state). As written the Phase 2 gate runs a non-existent suite, and an edit to the real file is outside the plan-union scope — the commit primitive refuses it under `plan.scope.undeclared-paths`, so Phase 2 is not executable as declared.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Correct the path to `tests/checks/packed-state.test.ts` in Phase 2 scope.files and the Phase 2 gate line, and align the header D-23 mapping wording. One-line fix; re-run `plan validate GH-287` after.

2. [minor] cross_artifact_consistency — chg-GH-287-test-plan.md#frontmatter-links / §1.2 GAP-1 / §2 References / §8.3 OQ-T1
   Gap: Stale phase-state text: the plan is described as "authored in phase 4; not yet present (GAP-1)" / "PENDING", but delivery_planning is complete, the plan exists, re-validates (verdict=valid, readyForDevelopment=true), and satisfies GAP-1's constraints (no TC reshaped; plan-level refinements declared). The availability statement misrepresents the artifact set the way GAP-5 was before its resolution.
   Suggested remediation target phase: test_planning
   Suggested fix: Update GAP-1/OQ-T1/links to resolved-with-plan (mirror the GAP-5 resolution style), keeping the reopen-if-pinned-contract-moves clause.

3. [minor] test_traceability — chg-GH-287-test-plan.md#§4.4 D-23
   Gap: D-23 names `tests/structure/{state-scope,packed-state}.test.ts`; `state-scope` is in `tests/structure/` but `packed-state` is in `tests/checks/`. Same root error as Finding 1, carried on the test-plan side of the drift register.
   Suggested remediation target phase: test_planning
   Suggested fix: Split the row's path notation (`tests/structure/state-scope.test.ts`, `tests/checks/packed-state.test.ts`) in the same edit cycle as the delivery_planning fix so the register and the plan scope agree.

4. [nit] cross_artifact_consistency — chg-GH-287-test-plan.md#§2 ticket-AC table
   Gap: The sixth ticket AC is decomposed to (AC-F4-2, AC-F4-3) while spec §17's traceability note also names AC-F4-4. Both artifacts cover the AC; the decompositions differ cosmetically.
   Suggested remediation target phase: test_planning
   Suggested fix: Add AC-F4-4 to the test plan's sixth-AC row (or note "plus AC-F4-4 per spec §17").

5. [nit] test_traceability — chg-GH-287-test-plan.md#§2 "Delivered evidence to extend" / §6 Test data
   Gap: Cites `tests/fixtures/ceremony/notes.ts`; the delivered substrate is the directory `tests/fixtures/ceremony/notes/`.
   Suggested remediation target phase: test_planning
   Suggested fix: Correct the citation to the directory form.

## Gate Result

NOT_READY — one major finding (Finding 1) blocks delivery start. Reopen `delivery_planning` for the Phase 2 path fix; Finding 3 should ride the same cycle from the test_planning side, Findings 2/4/5 are minor editorial corrections that may batch with it. All other facets pass with strong verification depth; no pause flag, no human escalation needed. Expected: iteration 2 returns READY after a one-line scope/gate correction plus the register/text alignments.
