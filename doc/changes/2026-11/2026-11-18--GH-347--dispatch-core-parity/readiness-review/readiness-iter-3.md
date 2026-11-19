# Readiness Review Iteration 3

Verdict: **READY**
Work Item: GH-347 (M4-S9: Dispatch core parity — durable lane, resume, admission, classifier, M4)
Date: 2026-11-19
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 3 (final planned iteration). The hand-off's claims were treated as hypotheses. Every count below was recomputed from the artifacts, not copied from the hand-off; every code claim was checked against the tree.

## Inputs

- `chg-GH-347-spec.md` v1.6 (revision log rows 1.0–1.6; 42 ACs; §18 eight DoD items; §25.2 Appendix B; §25.6 Appendix F; §8.5).
- `chg-GH-347-test-plan.md` 0.4 (50 cases / 11 groups; 42/42 ACs; 53 AC→case links; §7.4 register M1–M90; §6.1 registry; §7.2 no-shell design; §7.3 file map).
- `chg-GH-347-plan.yaml` (parsed with a YAML loader: 8 phases, ids 1–8 once each, `tier=full`, `readyForDevelopment=true`; `jaiship plan validate GH-347` → valid/full/readyForDevelopment=true; `jaiship lint plan GH-347` → valid, 0 errors).
- `chg-GH-347-pm-notes.yaml` (rulings (i)–(x), iteration-2 disposition, retros).
- Ticket: GitHub issue 347 body + its 2026-11-18 CEO parity-gap comment (scope authority: gaps 1–10 in scope, 11–12 → GH-354, hook retired).
- `doc/decisions/TDR-0049…TDR-0054` (all `Proposed`; still untracked; index rows committed — **not accepted by this review**).
- Code re-read for the claims this pass touches: `tests/behaviour/dispatch-watch.test.ts` (the delivered below-bound-stall case), `tests/behaviour/dispatch-liveness.test.ts` (pure evaluator), `tests/behaviour/dispatch-restart-budget.test.ts` (TC-RESUME-002), `tests/fixtures/dispatch/harness.ts` (`COMPLETED_EVIDENCE`), `packages/core/src/domain/dispatch-comparison.ts` (tri-state record, false-success predicate), `packages/adapters/src/host/index.ts` (`child_process`, `shell:false` ×2, `queue.shift()`), `packages/cli/src/edge.ts` (five `RegExp.prototype.exec`), `packages/core/src/app/dispatch.ts` / `packages/cli/src/production.ts` (port `.spawn`), `packages/adapters/src/daemon/lane-executor.ts` (`options.session.spawn`), `scripts/install.sh`, `package.json`, and the existence/absence of every gate-command path.

## Facet Summary

- spec_completeness: **PASS** — ticket ACs 1–5 and gaps 1–10 all map in Appendix B; the de-scoped surface and the lane-permission deferral map to GH-354/NG-10; the nothing-to-do corroboration half is now owned by AC-F8-4 and matches TDR-0053 DC-6 and the delivered `buildCorroborationRecord` encoding.
- ac_quality: **PASS** — 42 ACs, each singly observable and non-overlapping; AC-F3-2 and AC-F8-4 are now precise and testable; no AC embeds an obligation its owning case cannot observe.
- plan_coverage: **PASS** — 42/42 ACs and 50/50 TCs have exactly one owning phase (0+5+6+9+13+4+5+0=42; 0+6+7+10+14+4+9+0=50); all 90 mutation rows are allocated exactly once to the phase owning the last of their named cases (verified row by row; totals 0/10/4/22/24/6/24/0 = 90).
- test_traceability: **PASS** — 53 AC→case links, 0 unmapped, 0 orphans; the three iteration-2 trace majors are fixed (TC-DERIVE-006, TC-RESUME-102, TC-SHELL-002). Two residual minors (findings 2 and 3) are mapping-layer omissions, not missing or unachievable cases.
- cross_artifact_consistency: **PASS** — ticket ↔ spec ↔ test plan ↔ plan agree on 42 ACs / 50 TCs / 53 links / 90 mutations / 29 registry rows (11 class + 18 non-class) and on the seven group names; spec citations are v1.6 and v0.4 everywhere outside history. One residual minor (finding 1): the plan still describes the test plan's no-shell defect as uncorrected.
- decision_capture: **PASS** — six Proposed TDRs, one committed index row each; DEC-1…DEC-11 change-local where they belong; §15.1 cites rather than re-decides; TDR-0053 covers AC-F8-4's corroboration and AC-F3-2's operator-resume admission is authorised in §8.5.
- system_spec_consistency: **PASS** — the new §8.5 bullet matches delivered `dispatch-restart-budget` behaviour (`dispatch.restart-budget-exceeded` / `max-restarts` / exit 1); the §8.5 deliberate-change list now covers every rewritten delivered expectation; the three stale "no kill operation" statements remain and are declared for the documentation phase; no current-truth contradiction is introduced.
- plan_doc_update_coverage: **PASS** — all 9 Appendix A pages plus 6 additional pages are declared in phase 8; the header carries a page-by-page reconciliation handoff locating the three stale sentences; the proof-boundary publication/guard split (delivery phase 7 constant, lifecycle phase 7 page) is explicit; no delivery suite reads a change artifact.
- plan_code_area_coverage: **PASS** — every phase's code areas are named and match its declared `scope.files`; read-only controls are labelled as controls; `packages/core/src/state/**` is explicitly declared untouched in phase 5; the registry `cases.ts` is declared by every phase that authors or appends to it (2, 3, 4, 5, 6, 7).
- dod_defined: **PASS** — eight observable DoD items; DOD-1 is the §3.1-matrix + aggregate-log traceability review; the six TDRs are bound to phase 1's mechanical criterion and phase 8.7, and the escalation trigger no longer claims a DoD item covers them.

## Findings

Counts: **0 critical, 0 major, 3 minor, 2 nit (5 total).** None blocks delivery. Numbering continues from iteration 2.

### Minor

1. **[minor] cross_artifact_consistency** — `chg-GH-347-plan.yaml` lines 416-421 (TEST-PLAN DEVIATIONS (c)), 836-844 (discovery (d)), 2226-2228 (phase-7 obligations)
   Gap: these three passages still assert that "test plan §7.2 names `packages/adapters/src/host/spawn*.ts`" and that §7.2 states R3/R4 in the old name-only form. Test plan 0.4 corrected both: §7.2 now names `packages/adapters/src/host/index.ts` and binds R3/R4 to the `child_process` receiver with explicit `RegExp.exec` and port-`.spawn` controls. The plan's "correction" therefore now misdescribes its input — the exact "a correction the case it governs no longer needs" pattern the pm-notes retro named. No requirement, scope, gate, or mutation is affected; the operative instruction in all three passages (use `host/index.ts`, bind to the receiver) is correct.
   Suggested remediation target phase: **delivery_planning**
   Suggested fix: rewrite (c)/(d) and the phase-7 note as cross-references ("§7.2 already binds R3/R4 to the child_process receiver and names `host/index.ts`; phase 7's check declares the same surface"), deleting the claim that the test plan is still wrong.

2. **[minor] test_traceability** — `chg-GH-347-test-plan.md` lines 213 (§5.1 status), 788 (TC-TERM-002 location), 1710 (§7.3 file map); `chg-GH-347-plan.yaml` line 1894 and obligation 5.9; mutations M38/M39 (test plan 1791-1792)
   Gap: AC-F5-2 ("no terminate is invoked and no restart occurs") is owned solely by TC-TERM-002. The case's substance is right and its location names both files, but the three mapping layers route it to `tests/behaviour/dispatch-liveness.test.ts` only — a pure `evaluateDispatchLiveness` unit file that can observe a verdict, not a terminate call, a restart count, or an iteration count. The plan's 5.9 lists TERM-002 under the liveness file and omits it from the stall-loop suite it orders for TERM-001/003–006. A coder implementing exactly what 5.9 says produces a green case that proves none of AC-F5-2's engine-level clauses, leaving M38/M39 ("terminate on a clean exit", "terminate a cleared stall") without a control. This is pre-existing (not introduced by iteration 3) and is a mapping omission: the case text and phase-5 scope (`dispatch-parity-stall-loop.test.ts` is declared) both permit the correct implementation, so no gate goes red and delivery is not blocked.
   Suggested remediation target phase: **delivery_planning** (plan obligation 5.9) and **test_planning** (§7.3 row and the §5.1 status cell)
   Suggested fix: assign TC-TERM-002's command-level rows to `dispatch-parity-stall-loop.test.ts` (evaluator-only assertions stay in the liveness file), and record both files in §7.3/§5.1 and in 5.9 so M38/M39 have a named failing case.

3. **[minor] test_traceability** — `chg-GH-347-test-plan.md` line 1179 (TC-DERIVE-001 location); `chg-GH-347-plan.yaml` phase 4 scope
   Gap: TC-DERIVE-001 (phase-4-owned, `TC -> PHASE MAP`) declares its location as `dispatch-truth-derivation.test.ts` (extend) **+ `dispatch-parity-battery.test.ts`**, which phase 7 authors and phase 4 does not declare. The case is fully implementable in the truth-derivation file (its steps are pure + command), so this does not make it unachievable or produce a red phase-4 gate; but a coder who reads the location literally in phase 4 would either create an undeclared file (a stray the commit primitive will not stage) or add it to phase 4's scope mid-delivery. Pre-existing.
   Suggested remediation target phase: **test_planning**
   Suggested fix: mark the battery reference as the phase-7 11-class re-observation (as TC-PARITY-001's rows are), or drop it from the location line.

### Nit

4. **[nit] cross_artifact_consistency** — `chg-GH-347-pm-notes.yaml` lines 320 (ruling ii) and 333 (ruling x)
   Gap: ruling (ii) says the non-class row count is set to "the test plan's 17" and ruling (x) says "every version citation becomes v1.5"; the artifacts correctly state **18** non-class rows (ruling (iv) added the `resume-prompt-reentry` row after ruling (ii) was written) and **v1.6** (the spec advanced after ruling (x) was written). The pm-notes entry is a dated record of the iteration-2 instruction, and the delivery artifacts are internally consistent, so nothing a coder builds from is wrong — but a future reader comparing the ruling to the artifacts sees a stale number of exactly the kind the retro warns against.
   Suggested remediation target phase: **delivery_planning** (pm-notes note, not a plan change)
   Suggested fix: append a pm-notes `notes:` entry recording that the derived values are 18 and v1.6 (the owning artifacts), rather than editing the historical ruling.

5. **[nit] test_traceability** — `chg-GH-347-test-plan.md` §7.2 (line 1698) and TC-SHELL-002 step 3 (line 1559)
   Gap: both name "the two port `.spawn(` calls" (`ports.harness.spawn` in `app/dispatch.ts:859`, `resolvedHarness.port.spawn` in `production.ts:3401`) as R4's false-positive controls. The declared surface also contains a third: `options.session.spawn` in `packages/adapters/src/daemon/lane-executor.ts:61` (the plan's discovery (d) counts three). The R3/R4 rules as written still handle it correctly (it is not a child_process binding, so it must not match, and a name-only matcher would already fail on the two named controls plus the live scan), so achievability and non-vacuity are unaffected; the control inventory is one example short.
   Suggested remediation target phase: **test_planning**
   Suggested fix: add `options.session.spawn` to the control list (or drop the count and say "the port `.spawn(` call sites in the surface").

## Disposition of iteration-2 findings 1–12

1. **Resolved** — mutation allocation regenerated from §7.4: plan lines 426-482 give the rule ("the phase that owns the LAST named boundary"), the per-group table, and the check `0+10+4+22+24+6+24+0 = 90`; recomputed row by row against test plan §7.4: M1–M11→7, M12–M21→2, M22/25/26→3, M23/24/27→5, M28–M34→4, M35–M44→5, M45–M53→5, M54–M59→6, M60→7, M61–M75→4, M76–M82→7, M83/85→5, M84/86/87→7, M88–M90→7; every row exactly once, totals `[0,10,4,22,24,6,24,0]`. Phase bodies restate the same subsets (3.8 = 4; 4.11 = 22; 5.12 = 24; 6.7 = 6; 7.9 = 24). Spec citation is v1.6 (lines 12, 71).
2. **Resolved** — `cases.ts` is authored in phase 2 (obligation 2.6, `scope.files`, `interactions` producer) and declared again by phases 3, 4, 5, 6, 7; each appends only its group (`resume` ×3 → 5; `tracker-outage` ×2 → 7; `loop` ×5 + `terminate` ×3 + one `resume` → 16; `spawn` ×2 → 18; `class` ×11 → 29). Counts agree across plan (lines 26, 394, 495-524, 2254, 2274, 2366), test plan §6.1 (1627) and §7.1 (1667): 29 = 11 `class` + 18 non-class; group vocabulary is exactly `class`, `admission`, `resume`, `tracker-outage`, `loop`, `terminate`, `spawn`; `race`/`outage` appear only as scenario/prose words, never as group names; "six non-class rows" survives only in the pm-notes history of the iteration-2 finding (305), not as a live claim.
3. **Resolved** — TC-DERIVE-006 (1315-1341): 21 derivation-reachable inputs (4 attempt-stage + 10 ladder + 4 collision + 3 read-precedence); A1–A9 explicitly "no token, typed pre-session refusal" with their evidence handed to TC-ADMIT-001…005/TC-LANE-002/TC-PARITY-001; the joint AC-F8-5 statement is present ("10 tokens by arm here, `max-restarts` by the loop cases, and all eleven replayed end-to-end by TC-PARITY-001"). B1–B4 and C1–C10 match Appendix F(B)/(C).
4. **Resolved** — TC-RESUME-102 (576-601) now pins both modes: `attach-continue` (`prefillCostAcknowledged` absent) and `resume-prompt-reentry` (`prefillCostAcknowledged === true`), both at persisted 3 and 4, both admitted, 0 `economics.restart` records, envelope `restarts` at the persisted total; M27 charges an ordinal on prompt-reentry; the plan's 5.9/5.11 and gate text repeat both modes.
5. **Resolved** — test plan §7.2 (1689-1698): R3 imports/calls bound to the `child_process` receiver/import; R4 only for a `spawn(` resolving to that import; the surface entry is `packages/adapters/src/host/index.ts`; false-positive controls name the five `RegExp.prototype.exec` calls in `edge.ts` (verified at 1139/1350/1945/3415/3420) and the port `.spawn(` calls; planted controls for both rules. R1's whole-literal anchoring and `.sha`/`queue.shift()` controls are unchanged. Residual: control inventory one call short (nit 5).
6. **Resolved** — TC-PARITY-006 (1501-1511) asserts the daemon attempt, not only tokens: tracker-done rows carry `{pmNotes:"not-applicable", tracker:"satisfied", ci:"not-applicable"}` with `falseSuccess === false`, and the already-merged-PR row keeps all three sources required (correctly refusing the token-wide weakening F-8/DEC-6 reject); plan 7.5 matches.
7. **Resolved** — plan delivered-expectation item 5 (746-758) states no assertion exists in `dispatch-liveness.test.ts` and names `tests/behaviour/dispatch-watch.test.ts`, case "a stall below the bound is recorded and never leaks a second spawn". Verified in the tree: the case exists at `dispatch-watch.test.ts:137`, asserts exactly one `spawn`, comments "deferred to lane supervision", and asserts token `pr-open` with no exhaustion; the phase-5 rewrite (spawn 1 + resume 1, 2 iterations, one `economics.restart`) matches TC-LOOP-001's spawn-then-resume model.
8. **Resolved** — spec §8.5 line 301 adds the operator-resume supersession bullet ("…is superseded by AC-F3-2: the operator resume is admitted, consumes no restart ordinal, and runs"), the delivered TC-RESUME-002 update is declared, and the delivered behaviour it supersedes is real (`dispatch-restart-budget.test.ts` asserts `dispatch.restart-budget-exceeded`/`max-restarts`/exit 1 at persisted 3 vs bound 3).
9. **Resolved** — AC-F8-4 (511) now carries the nothing-to-do clause (`corroboration.pmNotes`/`ci` `not-applicable`, `falseSuccess === false`); TC-DERIVE-005 row (a) asserts it; M75 is the control; TDR-0053 DC-6 and F-8 already state the same arm set; `buildCorroborationRecord` records an unrequired source as `not-applicable`, so the assertion is exactly the delivered encoding.
10. **Resolved** — test plan §2 cites spec v1.6 (56); plan cites v1.6 (12, 71) and test plan v0.4 (20, 71); remaining v1.3/v1.4/v1.5 mentions are revision-log history only.
11. **Resolved** — §7.4 heading (1730) cites "spec Appendix F, §25.6".
12. **Resolved** — the TDR escalation trigger (947) now cites COMMIT-BOUNDARY REALITY, phase 1's mechanical done criterion (`git ls-files --error-unmatch` per path; `git status --porcelain -- doc/decisions` empty) and phase 8 obligation 8.7, and states "No spec DoD item covers the six records"; DOD-1 is no longer cited.

## Reconciliation of the numbers (recomputed, not accepted)

- ACs: 42 in spec §17 and 42 rows in test plan §3.1 (unique, no duplicates); plan AC map = 42 with one owner each.
- Cases: 50 rows in §5.1 and 50 case sections in §5.2 (same ids); group totals LANE 5, ADMIT 6, RESUME 4, TRACKER 4, TERM 6, LOOP 6, SPAWN 4, DERIVE 6, PARITY 6, SHELL 2, CONTRACT 1 = 50.
- Links: 53 AC→case links parsed from §3.1 (extras = 11, as stated).
- Mutations: 90 contiguous rows M1–M90; group totals 11+10+6+7+10+9+7+15+7+5+3 = 90; allocation exact-once with phase totals summing to 90.
- Registry: 29 = 11 `class` + (2+4+2+5+3+2) = 18; boundary run counts 2/5/7/16/18/29.
- Case-level new/extended split: 36 New + 13 Extended + 1 New+Extended = 50 (matches §7.3).
- Plan validation: `jaiship plan validate GH-347` → valid, tier=full, `readyForDevelopment=true`; `jaiship lint plan GH-347` → valid, 0 errors.

## New-damage probes this pass

- **(a) Phase-5 scope now declares `dispatch-watch.test.ts`.** Legitimate. The file contains an artifact-facts literal at line 65 (hence phase 4's declaration) and the delivered below-bound-stall case at line 137 (hence phase 5's). The rewrite keeps the spawn count at 1 (an assertion that already exists) and adds resume/iteration/economics assertions; §8.5 names the behaviour ("a stalled session … is terminated instead of left running; a single dispatch may now run multiple session iterations in-process") and item 5 cites §8.5, AC-F6-1, DEC-4, DEC-5. Both phases declare the file and the plan records that each edits only its own assertion. Not a delivered-assertion deletion.
- **(b) Registry phasing vs phase scope.** No conflict: `cases.ts` is declared by every phase that authors or appends (2–7); every consuming suite is declared by the phase that authors it (admission 2, lane-resume 3, tracker 4, stall-loop 5, spawn 6, battery/no-shell 7); the phase-2 `admission` builders (`interleave.ts`, `harness.ts`) are declared in phase 2. No phase imports a module that does not exist at its boundary.
- **(c) Allocation vs boundary reachability.** No reverse-ordered row: every row's allocation phase is the maximum phase among its named cases (checked row by row), so every named case exists and is green at the owning boundary. Cross-controls (M2/M8/M9/M11 in phase 4; M60's SPAWN-004 half in phase 6) are labelled as controls and counted only once, in their owning phase.
- **(d) Count drift.** None between the three artifacts (42/50/53/90/29 and 0/10/4/22/24/6/24/0). The only stale numbers are inside the pm-notes historical rulings (nit 4).
- **(e) Gate commands.** Every phase's `bun test` target exists at that boundary or is authored there; `tests/structure/dispatch-contract.test.ts` is the only referenced path that does not exist yet and is a phase-1 new file.

## What would fail first if this went out as-is

Nothing red. The first soft gap is silent under-coverage, not a failure: if phase 5 implements TC-TERM-002 literally as plan 5.9 words it ("extend `dispatch-liveness.test.ts` (TERM-002)"), the case is green while AC-F5-2's "no terminate is invoked and no restart occurs" clause is unproven and M38/M39 have no control. This is finding 2 and it is the one item worth closing in the delivery commit that touches that case; it cannot produce a red gate, which is why it is a minor rather than a blocker.

## Next remediation targets (all non-blocking)

- **delivery_planning** (`@plan-writer`): findings 1, 2 (plan half), 4 (pm-notes note).
- **test_planning** (`@test-plan-writer`): findings 2 (map half), 3, 5.

No finding requires human input; nothing here is a `needs_human_input` decision, so `Pause Required: no`. The six TDRs remain `Proposed` and untracked; owner acceptance and the TDR commit are delivery/human acts and are not granted by this review.
