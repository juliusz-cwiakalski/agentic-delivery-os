# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-289
Date: 2026-11-11
Pause Required: no

Reviewed: `chg-GH-289-spec.md` v1.3 (36 ACs, DEC-1..DEC-16, §15.1, §16.1,
Appendices A-D), `chg-GH-289-test-plan.md` v1.2 (39 TCs, §3.1, §5.2, §7.1,
§7.3 incl. the new cell-ownership paragraph, §7.4, §8.3), `chg-GH-289-plan.yaml`
revision 2.0 (5 delivery phases; `plan validate GH-289` re-run → `verdict=valid`,
`readyForDevelopment=true`, `tier=full`), `chg-GH-289-pm-notes.yaml`, and
`doc/decisions/TDR-0024-...md` (now tracked, `status: Proposed`, `## Revision`
present, index row unchanged). Working tree is clean; TDR-0024 and
`doc/decisions/00-index.md` are committed on the branch.

Source evidence re-derived or re-read for this review (not taken from the
artifacts): `packages/cli/src/index.ts` (`parseInvocation`, lines 241-291),
`packages/cli/src/commands/dispatch.ts` (definition lines 115-155),
`packages/core/src/domain/dispatch-gate.ts` (`foldEvidenceWindow`, signature and
inline fold, lines 132-153), `packages/core/src/app/dispatch-ledger.ts`
(`summarizeDispatchDivergences` 282-296, `readDispatchAttempts` 219-231),
`tests/structure/port-contract-inventory.test.ts` (`declaredNames`,
`collectInventory`, `compareInventory`), `tests/fixtures/ports/v1-contract-inventory.json`
(72 `dispatch.ts` names, 2075 `index.ts` names, 44 modules),
`packages/core/src/contracts/index.ts` (named re-export list from `./dispatch.js`),
`tests/structure/dispatch-composition.test.ts:120-125`,
`tests/checks/reference-page-parity.test.ts:46-70`,
`scripts/checks/help-guide-coverage.ts:38-70`,
`tests/golden/dispatch-summary.test.ts` + `tests/fixtures/dispatch/golden/summary.txt`,
`tests/fixtures/dispatch/ledger.ts` (`makeDivergence`), `tests/types/dispatch-contract.type-test.ts`,
`tests/checks/privacy-literals.test.ts:775`, `scripts/checks/privacy-literals.registry.json`,
`packages/adapters/src/io/privacy-rules.ts:80-90`, `.github/workflows/ci.yml:244`,
`doc/spec/features/{feature-dispatch-engine,feature-cli-entrypoint,feature-state-layer,feature-projects}.md`,
`doc/quality/test-specs/test-spec-dispatch-engine.md` frontmatter.

## Verdict in one line

Iteration 1's three blockers are genuinely discharged — B1 by a correctly
re-derived eleven-name contract-surface obligation in both phases, B2 by an
ownership split that matches the test plan cell for cell, B3 by a single
consistent corrected statement of delivered behaviour in all four artifacts — and
seven of the ten advisories are closed outright. Two defects remain. One is a
hard, reproducible gate failure inside the change's own artifacts that reds a
declared phase boundary and CI (W2). The other is a false test citation for the
delivered forms' refusal identity: the plan and spec claim TC-ATTEMPT-034 cell 6
pins the guard that `acceptsAnyFlag` makes load-bearing, but that cell is a
branch-diff review, no AC asserts the behaviour, and no suite anywhere exercises
it (W1).

## Facet Summary
- spec_completeness: PASS (every M2-S12 clause traced in Appendix A; no requirement dropped by the v1.3 edits)
- ac_quality: FAIL (W1: F-9's delivered-refusal requirement has no AC anchor and its cited TC cell does not assert it; N1: AC-F5-5/AC-F9-1 still claim the summary block keeps its delivered "meanings")
- plan_coverage: FAIL (W2: phase 2's declared gate battery is red on a file outside phase 2's scope; W1: phase 2's TC-034 cell map is factually wrong)
- test_traceability: FAIL (W1: the spec's evidence cell for the guard does not exist in TC-034 or TC-039)
- cross_artifact_consistency: FAIL (W1, W2)
- decision_capture: PASS (DEC-1..DEC-16 in-spec; five graduated rulings in TDR-0024; D-5 rationale and C-5/C-7 corrected; OQ-1 deferred with its precondition)
- system_spec_consistency: PASS (B3 discharged — no artifact claims an upward movement or an unchanged summary shape; §8.5/RSK-6/DEC-15/F-7/NFR-9/AC-F7-1/DM-3/DM-5 and TDR D-5 all state the same three real movements)
- plan_doc_update_coverage: PASS (A8 discharged: 5.3 advances `last_updated` and appends `GH-289` on every edited feature page; 5.4 states the test-spec list policy; both frontmatter facts verified)
- plan_code_area_coverage: PASS (B1 discharged: the contract-surface fixture is declared in phase 1 and phase 3; per-phase scope vs comment-declared paths re-checked for all five phases with no other miss)
- dod_defined: PASS (spec §4.1 metrics, §17 evidence classes, test-plan §10 log, per-phase evidence obligations)

## Blocking findings

### W1. **[major] test_traceability / ac_quality / cross_artifact_consistency — spec §5.1 F-9 (line 138), AC-F9-1 (line 475); test plan TC-ATTEMPT-034 steps 1 and 6 (lines 1489, 1494) and its Notes (lines 1504-1509); plan work 2.1 (lines 658-664) and phase-2 obligation for TC-034 (lines 765-771); verified in `packages/cli/src/index.ts:269-273` and `packages/cli/src/commands/dispatch.ts:114-119`**

Gap: the change's single riskiest delivered-behaviour mechanism — opting the whole
`dispatch` family out of the shared parser's unknown-flag refusal via
`acceptsAnyFlag: true` — is asserted by no test, cited by an AC that does not
contain it, and claimed (in two artifacts) to be pinned by a test cell that does
something else.

Verified mechanism. Today the refusal comes only from the parser:
`parseInvocation` answers `{ ok: false, reason: "unknown flag \"--x\"" }`
whenever `!definition.acceptsAnyFlag && !allowedFlags.has(token)`
(`packages/cli/src/index.ts:271-273`), and the dispatch definition declares no
`acceptsAnyFlag` (`packages/cli/src/commands/dispatch.ts:114-119`), so
`dispatch GH-301 --bogus`, `dispatch dual-run summary|resolve ... --bogus` and
`dispatch handover ... --bogus` all exit `1` with `fallback.invocation` *only*
because of that parser branch. Plan work 2.1 adds `acceptsAnyFlag: true` plus "the
guard that keeps the four delivered forms' unknown-flag refusal at
`fallback.invocation`" (lines 658-664). Without that guard the same invocations
reach the handler with the unknown flag in `flags` and proceed — a silent
behaviour change on delivered forms, i.e. exactly what AC-F9-1/NG-6 exist to
prevent.

What the artifacts claim versus what the test plan asserts:
- Spec F-9 (line 138): "The four delivered forms keep their `fallback.invocation`
  refusal through a handler guard **pinned by TC-ATTEMPT-034 cell 6 and
  TC-ATTEMPT-039**."
- Plan phase-2 obligation (lines 765-771): "TC-ATTEMPT-034 CELLS 1, 4, 5, 6 … the
  delivered branches' unknown-flag refusal still `fallback.invocation` — the P1
  negative control."
- TC-ATTEMPT-034 step 1 (line 1489) runs `dispatch GH-301 --json`,
  `dispatch dual-run summary --repo <repo> --json` and
  `dispatch handover <repo> --json` **without** any unknown flag and asserts key
  sets/order. Step 6 (line 1494) is "Review the branch diff for renames,
  removals, or retyping of delivered keys, for a second count rule, and for any
  change beyond the declared additions" — a whole-branch review, not a suite cell
  and not a refusal assertion. TC-ATTEMPT-039 (lines 1677-1690) exercises only
  `dispatch attempts …` cells. No other suite covers it: `grep` over `tests/**`
  for `fallback.invocation` plus `dispatch` finds no delivered-form unknown-flag
  case (`tests/behaviour/dispatch-*.test.ts` contain none; the hits are
  commit/board/spend/pm-notes/queue suites).
- AC-F9-1 (line 475) asserts shapes, key order, the discriminator and "the only
  additive changes are the ones this specification declares" — it does not assert
  the refusal identity, so the requirement has no acceptance criterion at all.
  This is the same defect class the test plan itself raised and closed as X-1
  (a requirement with no AC → AC-F1-6, §8.3), applied to F-9's refusal clause.

Secondary defect in the same cell map: even taken at face value, "cell 6 green at
phase 2's boundary" is unsatisfiable, because a diff review against the merge base
cannot complete mid-delivery. The plan's phase-2 `Done when` (lines 776-778)
therefore rests on a misdescribed cell.

Why it blocks: the plan's own boundary claim ("the delivered branches'
unknown-flag refusal … the P1 negative control") is false, the spec's pin is
false, and the guard has zero detection power. A coder can land phase 2 without
the guard and every declared TC still passes; the regression ships green, and
`@reviewer` is pointed at a test that does not exist rather than at the code.

Suggested remediation target phase: test_planning (primary), with one clause in
specification and one label in delivery_planning.
Suggested fix (exact):
1. Test plan, TC-ATTEMPT-034: add one suite cell owned by phase 2 — e.g. step 7 —
   "run `dispatch GH-301 --bogus`, `dispatch dual-run summary --repo <repo>
   --bogus`, `dispatch dual-run resolve DIV-1 --note n --bogus` and
   `dispatch handover <repo> --bogus`; each exits `1` with
   `error.code === "fallback.invocation"` and performs zero store reads", with the
   expectation stated; move the existing step 6 (diff review) into the
   review-verified bucket alongside "Review-verified (additive-only half)" instead
   of counting it as a boundary-green cell.
2. Test plan §3.1 and spec: fold the requirement into AC-F9-1 rather than adding a
   37th AC — "and the four delivered forms still refuse an unknown flag with
   `fallback.invocation`" — and replace F-9's "/pinned by TC-ATTEMPT-034 cell 6 and
   TC-ATTEMPT-039/" with the real cell, keeping TC-039 as the attempts-grammar
   owner.
3. Plan: relabel phase-2's obligation from "cell 6" to the new suite cell, keep the
   guard in work 2.1, and state that the additive-only diff review is a review-gate
   obligation (phase 5's review-verified list already exists for this).

### W2. **[critical] cross_artifact_consistency / plan_coverage — `chg-GH-289-test-plan.md:65` and `:1711`; `tests/checks/privacy-literals.test.ts:775`; `.github/workflows/ci.yml:244`; plan phase-2 `Done when` lines 785-788 and phase-2 scope lines 823-842**

Gap: the privacy-literal guard fails on the change's own test plan, so a gate the
plan requires green at phase 2's boundary is red today, and the only file that can
fix it is outside phase 2's declared scope. CI runs the same guard on every PR, so
the branch cannot go green as it stands.

Verified failure, reproduced this iteration:
- `bun run scripts/checks/privacy-literals.ts` → **exit 1**:
  `FAIL privacy-literals: private.absolute-user-path
  doc/changes/2026-11/2026-11-11--GH-289--evidence-inspection/chg-GH-289-test-plan.md:65
  fingerprint=c796b58bf3a81320` and the same at `:1711`.
- `bun test tests/checks/privacy-literals.test.ts` → **38 pass, 1 fail**; the
  failing test is `TC-PRIVACY-020 live-tree green and non-vacuous scope reporting >
  the live tree is green with a non-vacuous summary` (assertion at line 775), and
  its violation list contains only the GH-289 test plan.
- Root cause: on both lines the phrase joins "host", "home" and "checkout" with
  slashes, which renders as a home-root-shaped absolute path token. The committed
  rule `private.absolute-user-path` matches a home root segment followed by two or
  more name characters (`packages/adapters/src/io/privacy-rules.ts:80-90`); the
  resulting token is 14 characters, above the 12-character floor, and carries no
  placeholder or redaction marker, so no suppression applies. It is a false
  positive, but the guard is fail-closed and the registry allowlist covers only
  archival files, not a live change folder.

Why it blocks: plan phase 2's `Done when` names
`bun run scripts/checks/privacy-literals.ts` and
`bun test tests/checks/exit-code-literals.test.ts tests/checks/privacy-literals.test.ts`
(lines 785-788), and phase 2's scope (lines 823-842) declares no document under
`doc/changes/`. The boundary therefore cannot be made green from inside its
declared scope, and `chg-GH-289-test-plan.md` is declared only in phase 5
(line 1288). This is the same scope-completeness class as iteration 1's B1, and it
is also outside the aggregate `pnpm check` (which does not run privacy-literals),
so a coder would discover it only at the phase-2 battery — or in CI.

History: persistent, not introduced by v1.2. The literal is present in all three
committed revisions of the test plan (`87220721`, `7640cbe3`, `b33e215a`);
iteration 1 did not run the privacy scan.

Suggested remediation target phase: test_planning.
Suggested fix (exact): reword both occurrences so no home-root path token exists —
e.g. line 65 "host, home and checkout composition" → "host-root, home and checkout
composition", and line 1711 "the `tests/fixtures/projects/production.ts`'s
host, home and checkout facts" → "the `tests/fixtures/projects/production.ts` host-root,
home and checkout facts". Then confirm
`bun run scripts/checks/privacy-literals.ts` exits `0`. Add one line to plan 5.8:
the §10 edits must keep
`bun run scripts/checks/privacy-literals.ts` green (the file is in phase 5's
scope, so a regression there would be inside scope but still gate-red).

## Non-blocking findings (fix in the same pass; none reds a boundary on its own)

N1. **[minor] ac_quality / cross_artifact_consistency — spec AC-F5-5 (line 463), AC-F9-1 (line 475), test plan §3.1 rows for AC-F5-5 (line 99) and AC-F9-1 (line 111)**
Gap: all four still say the summary block's four delivered fields keep their
delivered "meanings", while §8.5 (line 278), F-7 (line 136), NFR-9 (line 298) and
AC-F7-1 (line 469) declare `unresolvedIds` a narrowing (every open identifier →
at most 20 with `idsTruncated`). A reviewer auditing AC-F9-1 literally can read
the diff as a violation. The substance is correctly pinned in five places and in
TC-022/TC-034, so this is wording, not design.
Fix: "…keep their names, types and order; `unresolvedIds` narrows as declared in
§8.5, and `reported`, `resolved` and `unresolved` keep their meanings as exact
counts." Target: specification (test plan rows mirror it).

N2. **[minor] cross_artifact_consistency — spec §22 (line 510) against plan work 1.2 (lines 495-504)**
Gap: §22 still says "the page bound, the ledger bound, and the two byte/line
budgets are declared constants beside the delivered dispatch bounds", but A5's
discharge makes the three byte/line budgets *imported* delivered constants
(`DISPATCH_MAX_MACHINE_BYTES`, `DISPATCH_MAX_HUMAN_LINES`,
`DISPATCH_MAX_HUMAN_BYTES`) rather than new declarations — and the plan now says a
second declaration is the drift the sentence prevents. Only the page bound
(`ATTEMPTS_DEFAULT_LIMIT`/`MIN`/`MAX`, `ATTEMPTS_HUMAN_ROW_BUDGET`,
`ATTEMPTS_LIMIT_PATTERN`) is new.
Fix: "the page and ledger bounds are declared constants beside the delivered
dispatch bounds, and the byte/line budgets are the delivered constants themselves,
so tuning stays a one-line change". Target: specification.

N3. **[minor] cross_artifact_consistency — plan work 1.1 (lines 481-487)**
Gap: "it is authored and currently untracked in the working tree … is committed
here" is no longer true: `git ls-files` shows TDR-0024 and
`doc/decisions/00-index.md` tracked, both committed on the branch, and the working
tree is clean. A phase-1 deliverable that is already landed invites a needless
commit or an amend.
Fix: restate 1.1 as "verify TDR-0024 is committed and indexed (both already on this
branch) and cited by the later phases' artifacts; make no content change".
Target: delivery_planning.

N4. **[nit] cross_artifact_consistency — `chg-GH-289-pm-notes.yaml:5-8, :93, :130-139`**
Gap: the hand-maintained `phases:` mirror still shows `started: null` for
specification/test_planning/delivery_planning while `phase list GH-289` (the
authoritative registry) shows valid started/completed pairs; the archived note at
:93 ("can move a reported number in either direction") and the note at :130-139
("Two declared deviations") are stale relative to spec v1.3 and plan 2.0. Phase
state is registry-owned and the lint only requires the keys, so this is
reader-confusion only.
Fix: append one superseding note (do not rewrite history): registry pairs verified
via `phase list`, and the plan now declares the full TP1..TP7 → plan 1..5 mapping
rather than two deviations. Target: delivery_planning.

## Iteration-1 findings: discharge evidence

- **B1 (critical) — DISCHARGED.** `tests/fixtures/ports/v1-contract-inventory.json`
  is in phase 1 `scope.files` (plan line 629) and phase 3 `scope.files` (line 1006).
  The same-commit two-entry rule is stated three times and names both entries: work
  1.2 (lines 505-512), work 1.5 (lines 537-540), work 3.1 (lines 872-876). Both
  boundaries run the suite: phase 1 `Done when` (line 583) and phase 3 `Done when`
  (line 958).
  Re-derived name list against the plan's work items: phase 1 adds exactly **nine**
  names — four types (`DispatchAttemptView`, `DispatchAttemptsTruncation`,
  `DispatchAttemptsData`, `AttemptsRefSource`) and five constants
  (`ATTEMPTS_DEFAULT_LIMIT`, `ATTEMPTS_MIN_LIMIT`, `ATTEMPTS_MAX_LIMIT`,
  `ATTEMPTS_HUMAN_ROW_BUDGET`, `ATTEMPTS_LIMIT_PATTERN`) — and phase 3 adds
  **two** types (`DispatchDivergenceBlock`, `DispatchResolveData`). The plan's own
  arithmetic ("nine names … these four types and five constants", "BOTH of their
  names") matches. All eleven are absent from today's fixture (72 `dispatch.ts`
  names, 2075 `index.ts` names), so the fixture must gain 9 → 81 and 9 → 2084 in
  two commits; `contracts/index.ts` uses a named re-export list from
  `./dispatch.js` (lines 863-866), so the barrel edit and its fixture row are
  indeed one edit. The A5 reuse also removes three would-be names and three
  allowance rows, consistent with work 1.6 ("five new constants", "no allowance
  row for the three reused dispatch budgets").
- **B2 (critical) — DISCHARGED.** Plan ownership: phase 1 = 3 (009, 010, 037);
  phase 2 = 20 (001-008, 011-017, 023-026, 039); phase 3 = 10 (018-022, 027, 036,
  038, plus 028 and 034); phase 4 = 3 (029-031); phase 5 = 3 (032, 033, 035);
  3+20+10+3+3 = 39, every id 001-039 present exactly once. AC ownership
  2+22+6+3+3 = 36, every criterion F1-1..F9-2 present exactly once. The cell split
  is identical in all three places: plan ownership block (lines 184-195), phase-2
  and phase-3 obligation lists (lines 759-771, 932-948), test plan TC-028 Notes
  (line 1296), TC-034 Notes (line 1509) and §7.3's cell-ownership paragraph
  (line 1813). No TC cell is unowned: TC-028 steps 1-4 and TC-034 steps 1-5 are
  covered; step 6 is the review cell whose handling is W1's second half.
- **B3 (major) — DISCHARGED.** One consistent statement now appears in spec §8.5
  (line 278), RSK-6 (line 319), DEC-15 (line 377), F-7 (line 136), DM-3 (line 259),
  NFR-9 (line 298), §16.1 (line 415), AC-F7-1 (line 469); in the plan's residual-risk
  paragraph (lines 327-346), rollback paragraph (lines 435-444) and pinned
  contracts (lines 271-275); in test plan §1 (line 23), §7.4 P2 (line 1820), §8.2
  (line 1897), TR-9 (line 1881), TC-022 (lines 1059-1073) and TC-038 (lines 1632-1657);
  and in TDR-0024 D-5 (line 322), the two-folds row (line 211), C-5/C-7 (lines 347-349),
  Trade-offs (lines 365-371) and the new `## Revision` section (lines 423-432).
  Numbers cross-check: 25 open for the reported repository + 5 open foreign + 3
  resolved → delivered store-wide 33/3/30, scoped 28/3/25, post-resolve 28/4/24,
  below-cap control 3/0/3 with `idsTruncated: false`. `foldEvidenceWindow` already
  receives `repository` (domain `dispatch-gate.ts:133`), so the shared computation
  is feasible where the plan puts it. No artifact still claims an upward movement
  or an unchanged summary shape; the residual "either direction" sentence lives
  only in an archived pm-notes entry (N4).
- **A1 (major) — DISCHARGED.** Work 2.3 states "OPTIONALITY IS THE CONTRACT"
  (lines 689-705): `DispatchCommandRuntime.attempts` is optional like
  `summary`/`resolve`/`handover`, the new gate-composition ports are optional, the
  runtime return type gains `attempts?`, and the three fixtures are explicitly not
  declared because they need no edit. Verified against the code:
  `tests/structure/dispatch-composition.test.ts:120-125` asserts
  `Object.keys(scenario.runtime)` = `["run"]` for a gate-less command scenario, the
  two fixtures build gate blocks by conditional spread
  (`tests/fixtures/dispatch/golden/harness.ts:266-275`,
  `tests/conformance/dispatch/controlled-repo.ts:166-170`), and the suite is green
  today (24 pass).
- **A2 (major) — DISCHARGED.** TC-003's note (line 335) now says `--limit` is
  deliberately not a `requiresValue` flag, that the command module's grammar
  refuses the missing-value cell before any runtime call, and that the shared
  parser would answer `fallback.invocation` — which matches the parser
  (`packages/cli/src/index.ts:274-278`).
- **A3 (major) — DISCHARGED.** The plan header replaces "two deviations" with a
  complete TP1..TP7 → plan 1..5 mapping (lines 111-153). I checked it against test
  plan §7.3 row by row: TP1 → plan 2 (006-008, 024, 028c1-3); TP2 → plan 2
  (011-016) + plan 1 (037); TP3 → plan 2 (001-005, 023, 025, 026, 034c1/4/5/6, 039)
  + plan 1 (009, 010); TP4 → plan 3 (018-022, 027, 038 + 028c4 + 034c2-3);
  TP5 → plan 4 (029-031); TP6 → plan 5 (032, 033) + plan 2 (017); TP7 → plan 5
  (035) + plan 3 (036). All 39 TCs appear once, and each stated reason matches the
  §7.3 note it moves away from.
- **A4 (major) — DISCHARGED.** Work 4.6 (lines 1056-1066) authors
  `tests/structure/dispatch-attempts-composition.test.ts` with the three cells
  A4 asked for (pointer line, family synopsis, attempts entry) and leaves the
  reference-page half review-verified in phase 5; the file is in phase 4's scope
  (line 1126) and in its `Done when` battery (line 1086).
- **A5 (major) — DISCHARGED (implementation), one wording residue.** Work 1.2
  (lines 495-504) reuses `DISPATCH_MAX_MACHINE_BYTES`, `DISPATCH_MAX_HUMAN_LINES`
  and `DISPATCH_MAX_HUMAN_BYTES` and declares only the five genuinely new names,
  with the drift reason stated; the phase-1 summary repeats it (line 602), the
  consumption sites use the delivered names (lines 674-677), and work 1.6 forbids
  extra allowance rows. Spec §22 still describes the budgets as newly declared —
  see N2.
- **A6 (minor) — DISCHARGED.** F-9 (line 138) and §16 row 1 (line 396) now say the
  flags are declared in the published grammar and validated by the command module,
  with the four delivered forms keeping `fallback.invocation` through a handler
  guard. Behaviour is unchanged by this rewording; the pinning claim it carries is
  W1.
- **A7 (minor) — DISCHARGED.** AC-F9-2 (line 476) reads "Suite (scans and gates),
  review-verified (lockfile and manifest diff)"; test plan §3.1 (line 112), §7.1
  (line 1785) and TC-035 agree.
- **A8 (minor) — DISCHARGED.** Plan 5.3 (lines 1169-1175) requires every edited
  feature page to advance `last_updated` and append `GH-289` preserving existing
  entries, and names the resulting `…, "GH-288", "GH-289"` list; 5.4 (lines
  1176-1184) states the test-spec list policy. Verified: `feature-dispatch-engine.md`
  carries `last_updated: 2026-11-10` and ends `…, "GH-288"`; the quality test spec
  carries `["GH-239", "GH-275", "GH-277", "GH-279"]` with GH-288 absent, exactly as
  5.4 says, so "append GH-289 only" is correct and needs no GH-288 fabrication.
- **A9 (nit) — DISCHARGED.** F-2 (line 131), DM-1 (line 257), Appendix D (line 569)
  and plan work 1.2 (line 493) all say "eight always-present keys plus `truncation`
  only when a bound binds"; TC-028 step 2 encodes the same eight plus one.
- **A10 (nit) — DISCHARGED.** `phase list GH-289` now returns valid pairs for all
  four planning phases (clarify_scope 16:18:24→17:32:07, specification
  16:31:34→17:31:06, test_planning 16:56:02→17:31:16, delivery_planning
  17:06:01→17:31:24; `evidence.class: verified`). The change-folder mirror still
  shows nulls — see N4.

## New-consistency checks requested this iteration

- **AC-F5-5 / AC-F9-1 vs the narrowed `unresolvedIds`:** the only remaining
  contradiction is the "meanings" clause (N1). Everything the fix must preserve is
  intact: AC-F7-1, NFR-9, §8.5 and TC-022/TC-034 all name the narrowing and keep
  exact counts for `reported`/`resolved`/`unresolved`.
- **Plan phase summaries vs parsed scope:** re-checked per phase. Every path named
  as work is in that phase's `scope.files` (phase 1: 15 entries incl. both
  barrels, inventory, fixture, two fixtures + two suites; phase 2: 19 entries for
  commands/edge/production/renderers + fixtures + suites; phase 3: 19 entries
  incl. the fixture, count-rule suite and isolation suite; phase 4: 6 entries;
  phase 5: 15 entries). Files named only as read-only references (the parser
  `packages/cli/src/index.ts`, the three fixtures under A1, the regression suites
  run at boundaries) are correctly excluded, and the plan says why.
- **Changeset scope vs A5's constant reuse:** no interaction. 5.7 (lines 1195-1204)
  adds exactly one changeset declaring the five fixed-group packages at `minor`;
  constant reuse changes no package set, no manifest and no lockfile, and the
  no-dependency/no-lockfile clause stays review-verified. `privacy-release.test.ts`
  is green today.
- **Help / parity / inventory split:** unchanged from iteration 1 and still sound.
  Adding an M2 `referencePages` row is safe — `runHelpGuideCoverage` only requires
  prompt-required pages to be present and rejects extra `commands` entries, never
  extra reference pages (`scripts/checks/help-guide-coverage.ts:38-70`);
  `reference-page-parity.test.ts:46-70` requires every see-also target to exist and
  be registered (the M2 attempts page exists today) and pins the dispatch entry
  count at 4; `dispatch-help-inventory.test.ts` carries the second pin. Phase 4 owns
  all of it in one commit, phase 5 owns only the page content.
- **B3 side effects on existing suites:** `tests/golden/dispatch-summary.test.ts`
  compares the summary text byte-for-byte against
  `tests/fixtures/dispatch/golden/summary.txt` (`divergences=1/0/1`,
  `unresolved_divergences=DIV-1`). That fixture's divergence is seeded with
  `makeDivergence`, whose `repository` is `REPOSITORY`
  (`tests/fixtures/dispatch/ledger.ts:100-115`), so repository scoping leaves the
  golden unchanged and the `idsTruncated` addition is machine-only. No type-level
  probe pins the divergence block either
  (`tests/types/dispatch-contract.type-test.ts:117-121` asserts only
  `eligibility`/`verdict`), and `tests/behaviour/dispatch-determinism.test.ts:83`
  builds a window literal without `idsTruncated` that is only passed to
  `evaluateHandoverGate` (which reads the count, not the flag) and is never
  typechecked (`typecheck` covers packages plus `tests/types` only). So phase 3's
  "single permitted existing-test adjustment" claim still holds.

## Mechanical gates re-run for this review

| Gate | Result |
|---|---|
| `bun packages/cli/bin/delivery-os.ts plan validate GH-289` | `verdict=valid`, `artifact=yaml:chg-GH-289-plan.yaml`, `tier=full`, `readyForDevelopment=true` |
| `phase list GH-289` | four planning phases completed, started before completed, `evidence.class=verified` |
| `bun test tests/structure/port-contract-inventory.test.ts` | **11 pass, 0 fail** (B1's gate is live and green) |
| `bun test tests/checks/reference-page-parity.test.ts tests/structure/dispatch-help-inventory.test.ts` | **9 pass, 0 fail** (both entry-count pins live at four) |
| `bun test tests/checks/doc-conformance.test.ts tests/checks/dispatch-doc-conformance.test.ts` | **15 pass, 0 fail** |
| `bun test tests/structure/dispatch-composition.test.ts` | **24 pass, 0 fail** (A1's `["run"]` assertion holds) |
| `bun test tests/structure/subpaths.test.ts tests/structure/content-inventory.test.ts` | **10 pass, 0 fail** |
| `bun test tests/checks/help-guide-coverage.test.ts tests/checks/help-guide-coverage-mutants.test.ts tests/behaviour/dispatch-help-version.test.ts tests/golden/dispatch-summary.test.ts` | **9 pass, 0 fail** |
| `bun run scripts/checks/help-guide-coverage.ts` | all prompt-required commands covered, exit 0 |
| `bun run scripts/checks/forbidden-literals.ts` | exit 0 |
| `bun test tests/checks/error-table-sync.test.ts tests/structure/dispatch-error-identity.test.ts tests/checks/exit-code-literals.test.ts tests/checks/privacy-release.test.ts tests/behaviour/dispatch-token-closure.test.ts` | pass |
| `bun run scripts/checks/privacy-literals.ts` | **exit 1 — 2 violations (W2)** |
| `bun test tests/checks/privacy-literals.test.ts` | **38 pass, 1 FAIL** (`TC-PRIVACY-020` live-tree green — W2) |
| `bun test tests/checks/forbidden-literals.test.ts` | 25 pass, 2 fail — **environmental**: both are 5 s timeouts on `git commit` inside `mkdtemp` fixture repos (`tests/checks/fixture-repo.ts:18,65`), reproducible on this host independent of GH-289; the live-tree scan itself passes |

## Residual risks I would accept once W1 and W2 are fixed

1. **`fallback.invocation` vs `input.value.rejected` at arity 4.** A second extra
   positional still freezes to the parser's `fallback.invocation`; accepted as a
   pre-existing global grammar class, now explicit in TC-003's note.
2. **`acceptsAnyFlag: true` widens the parser for every dispatch form.**
   Accepted once W1's suite cell exists: the observable contract then has a
   permanent pin, and the alternative (new error rows) is closed by DEC-1.
3. **Second divergence-ledger read on resolve.** Computing the block after the
   append re-reads the divergence ledger; NFR-2 bounds only the attempts read.
   Accepted, worth the one sentence plan 3.3 already implies.
4. **Identifier narrowing.** On a root with more than 20 open divergences the
   summary's `unresolvedIds` and the human line return fewer identifiers than the
   delivered code did, with no single-call path to the rest. Declared in §8.5,
   RSK-6, DEC-15 and pinned by TC-022 and TC-028 cell 4; accepted as declared.
5. **Review-verified halves.** AC-F7-2's page half, AC-F8-3/4, AC-F9-1's
   additive-only half, AC-F9-2's diff half and AC-F4-1's side-effect enumeration
   rest on review with named checks and §10 rows; accepted as the strongest form
   available for a diff against a moving base.
6. **Cross-repository resolve stays disclosed, not prevented** (OQ-1, NG-7).
   Accepted; the result names the divergence's own repository.

## Can delivery proceed with a recorded accepted risk?

No. W2 is a reproduced gate failure in the change's own artifacts: the privacy
guard exits `1` on `chg-GH-289-test-plan.md:65,1711`, which reds phase 2's declared
battery and CI, and the only fix is in a file phase 2 does not own. W1 leaves the
delivered forms' refusal identity — the mechanism `acceptsAnyFlag` puts at risk —
without an acceptance criterion or a test, while two artifacts assert a pin that
does not exist. The override path is unavailable: this change adds behaviour and a
command surface, so it is not "genuinely trivial".

Both are mechanical: two wordings in the test plan (W2), one test cell plus a
three-line spec/plan re-point (W1), and N1-N4 in the same pass. A third iteration
should be a formality.

Reopen: `test_planning` (W1's TC-034 cell, W2's two wordings, §3.1 mirrors),
`delivery_planning` (W1's cell label and the review-cell handling, N3, N4), and
`specification` (W1's AC-F9-1/F-9 wording, N1, N2). No delivery phase has been
entered.

VERDICT: NOT_READY
