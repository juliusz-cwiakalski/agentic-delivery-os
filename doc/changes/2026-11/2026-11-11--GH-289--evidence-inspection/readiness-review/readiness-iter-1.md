# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-289
Date: 2026-11-11
Pause Required: no

Reviewed: `chg-GH-289-spec.md` v1.2 (36 ACs, DEC-1..DEC-16, §15.1, §16.1, Appendices A-D),
`chg-GH-289-test-plan.md` v1.1 (39 TCs, §3.1 matrix, §5.2 scenarios, §7.1 mapping,
§7.3 grouping, §7.4 P1-P4, §8.2-8.3), `chg-GH-289-plan.yaml` revision 1.0 (5 delivery
phases; `plan validate GH-289` re-run for this review → `verdict=valid`,
`readyForDevelopment=true`, `tier=full`), `chg-GH-289-pm-notes.yaml`, and
`doc/decisions/TDR-0024-dispatch-attempt-read-side-and-local-evidence-resolve.md`
(untracked, `status: Proposed`).

Source evidence re-derived for this review (not re-read from the artifacts):
`packages/cli/src/index.ts` (`parseInvocation`), `packages/cli/src/commands/dispatch.ts`,
`packages/cli/src/help.ts`, `packages/cli/src/output/dispatch-text.ts`,
`packages/cli/src/entrypoint.ts`, `packages/cli/src/edge.ts`,
`packages/cli/src/production.ts`, `packages/core/src/contracts/dispatch.ts`,
`packages/core/src/contracts/error-table.ts`, `packages/core/src/contracts/state.ts`,
`packages/core/src/domain/dispatch-gate.ts`, `packages/core/src/app/dispatch-gate.ts`,
`packages/core/src/app/dispatch-ledger.ts`, `tests/fixtures/ports/v1-contract-inventory.json`,
`tests/structure/{port-contract-inventory,content-inventory,inventory.json,dispatch-help-inventory,dispatch-composition,dispatch-resolve-composition}.{ts,json}`,
`tests/behaviour/{dispatch-help-version,entrypoint-help-coverage,dispatch-bounds,dispatch-dual-run-summary,dispatch-delivered-evidence-divergence,dispatch-divergence,dispatch-gate-evidence,dispatch-gate-window}.test.ts`,
`tests/fixtures/{entrypoint/programs.ts,dispatch/golden/harness.ts,dispatch/admission.ts,projects/production.ts,projects/state-scope.ts}`,
`tests/conformance/dispatch/controlled-repo.ts`, `tests/checks/{reference-page-parity,help-guide-coverage,help-guide-coverage-mutants}.test.ts`,
`scripts/checks/{help-guide-coverage.ts,forbidden-literals.registry.json}`,
`doc/spec/features/feature-dispatch-engine.md`, `doc/quality/test-specs/test-spec-dispatch-engine.md`,
`doc/planning/oss-tooling/milestones/m2/{commands/attempts.md,contracts.md}`,
`doc/planning/oss-tooling/backlog.md` (`### M2-S12`).

## Verdict in one line

The requirement set is unusually strong: 36 ACs and 39 TCs map one-to-one with no
orphan and no duplicate, every TC names a real file and a real fixture, the
`acceptsAnyFlag` premise about the delivered parser is **correct**, and the
help/parity/inventory/doc-impact surfaces are complete and reachable. Three defects
remain, and each one either reds a phase boundary inside the declared scope or asserts a
false fact about delivered behaviour that phase 5 would write into the system spec.

## Facet Summary
- spec_completeness: PASS (every M2-S12 clause traced in Appendix A; the per-ref read side against the ticket's "for a repository" wording is a declared ruling, OQ-2/DEC-3)
- ac_quality: PASS (36 given/when/then criteria, each testable; two minor wording defects, A9/A10)
- plan_coverage: FAIL (B2: two TCs owned by a phase that cannot make them green; A4)
- test_traceability: PASS (36 §3.1 rows, 39 §7.1 rows; every TC names an existing or declared file and fixture)
- cross_artifact_consistency: FAIL (B2, B3; A2, A3, A5)
- decision_capture: PASS (DEC-1..DEC-16 in-spec, five rulings graduated to TDR-0024, OQ-1 deferred with its precondition; A5 is a contract-surface nit, not a capture gap)
- system_spec_consistency: FAIL (B3: the summary's delivered divergence block is described wrongly in §8.5/RSK-6/DEC-15 and in the plan's residual-risk paragraph)
- plan_doc_update_coverage: PASS (§16.1's fifteen rows are each owned by phase 4 or phase 5; A8 is frontmatter hygiene)
- plan_code_area_coverage: FAIL (B1: the contract-surface fixture is unscoped; A1, A4)
- dod_defined: PASS (spec §4.1 metrics + §17 evidence classes + test-plan §10 log give a verifiable DoD)

## Blocking findings

### B1. **[critical] plan_code_area_coverage / cross_artifact_consistency — plan phase 1 `scope.files` (lines 504-518) and phase 3 `scope.files` (lines 820-838); `tests/fixtures/ports/v1-contract-inventory.json:727` and `:1070`**

Gap: both phases add exported names to the contracts tier and neither declares the
fail-closed contract-surface fixture, so `pnpm test` — and therefore the aggregate gate
the plan runs at phase 1's boundary — reds on the first commit that lands a new export.

Verified mechanism. `tests/structure/port-contract-inventory.test.ts` (TC-PORT-001)
collects every exported and re-exported name of every module under
`packages/core/src/contracts` (`collectInventory`, lines 59-78) and compares the whole
map against the committed fixture in both directions
(`expect(compareInventory(collectInventory(ROOT), expected)).toEqual([])`, line 135),
pushing `missing export` (line 102) and `unexpected export` (line 105). The fixture pins
`"dispatch.ts"` at exactly **72** names (line 727) and the contracts barrel
`"index.ts"` at exactly **2075** names (line 1070). I re-ran the gate for this review:
`bun test tests/structure/port-contract-inventory.test.ts` → **11 pass, 0 fail**, so it
is a live, green gate today.

What phase 1 declares into `packages/core/src/contracts/dispatch.ts` (plan lines 396-408)
and re-exports through `packages/core/src/contracts/index.ts` (plan work 1.5, line 430-436):
`DispatchAttemptView`, `DispatchAttemptsTruncation`, `DispatchAttemptsData`,
`AttemptsRefSource`, `ATTEMPTS_DEFAULT_LIMIT`, `ATTEMPTS_MIN_LIMIT`,
`ATTEMPTS_MAX_LIMIT`, `ATTEMPTS_MAX_DATA_BYTES`, `ATTEMPTS_MAX_HUMAN_LINES`,
`ATTEMPTS_MAX_HUMAN_BYTES`, `ATTEMPTS_HUMAN_ROW_BUDGET`, `ATTEMPTS_LIMIT_PATTERN`.
Phase 3 adds `DispatchDivergenceBlock` and `DispatchResolveData` (plan lines 717-724).
Every one of those fourteen names must appear in **both** fixture entries or the gate is
red; nothing in either phase's scope names the file.

Why it blocks: phase 1's `Done when` (plan lines 469-477) requires the aggregate gate,
whose `test` step runs this suite. The only remedy is an edit to a file no phase
declares, which `plan diff` classifies `outside-declared` — the same class of defect the
DoR gate exists to catch.

Suggested remediation target phase: delivery_planning
Suggested fix (exact):
1. Add `tests/fixtures/ports/v1-contract-inventory.json` to phase 1 `scope.files` and to
   phase 3 `scope.files`.
2. In work item 1.2/1.5 state the contract: each new name is added to the `dispatch.ts`
   entry **and** the `index.ts` entry of the fixture in the same commit; work item 3.1
   says the same for the two phase-3 types.
3. Add `bun test tests/structure/port-contract-inventory.test.ts` to phase 1's and phase
   3's `Done when` battery, so the boundary that can red is also the boundary that
   proves it green.

### B2. **[critical] plan_coverage — plan AC/TC ownership table (lines 99-126), phase 2 obligations (lines 623-628), phase 3 `Done when` (lines 785-788); test plan TC-ATTEMPT-028 step 4 (line 1286) and TC-ATTEMPT-034 steps 2-3 (lines 1486-1487)**

Gap: TC-ATTEMPT-028 and TC-ATTEMPT-034 are owned by **phase 2**, but their definitions
assert product behaviour that only **phase 3** creates. Phase 2's `Done when` ("those
twenty-two TCs are green", line 633) is therefore unsatisfiable as written, and the cells
that complete the two TCs are owned by no phase.

Evidence, cell by cell:
- TC-ATTEMPT-028 step 4 (line 1286) requires the summary's divergence block to be
  "exactly `reported`, `resolved`, `unresolved`, `unresolvedIds`, `idsTruncated` in that
  order". `idsTruncated` is added by plan work 3.1/3.2 (phase 3), not by phase 2; the
  plan's own phase-2 obligation text (lines 623-624) drops that clause, and phase 3 only
  "re-runs" the TC (line 787) without taking ownership.
- TC-ATTEMPT-034 step 2 (line 1486) requires the resolve payload to carry the five
  delivered keys "followed by `mode`, `repository`, `divergences`" — delivered by plan
  work 3.3 (`packages/core/src/app/dispatch-gate.ts`, phase 3). Step 3 (line 1487)
  requires both blocks to carry `idsTruncated`. The plan re-describes TC-034 in phase 2
  (lines 625-628) as "delivered shapes stable … the payload discriminated … the
  delivered branches' unknown-flag refusal", i.e. only the phase-2-satisfiable cells, and
  phase 3's obligation list (lines 757-783) does not mention 034 at all.
- AC-F7-1 and AC-F9-1 are likewise owned by phase 2 (line 105) while their suite halves
  depend on the phase-3 resolve/count shape.

Consequence: either the coder writes two TCs short of their definition (leaving the
completion unowned and invisible to the DoD trace) or the phase-2 boundary is red with
`pnpm check` green elsewhere. AC-F5-5's block identity is still covered by TC-022 step 8
in phase 3, so the *substance* is not lost — the ownership bookkeeping is.

Suggested remediation target phase: delivery_planning
Suggested fix (exact):
1. Split the two TCs by cell and say so: phase 2 owns TC-028 cells 1-3 and TC-034 cells
   1, 4, 5, 6; phase 3 owns TC-028 cell 4 and TC-034 cells 2-3.
2. Update the ownership arithmetic: phase 2 `22 → 20`, phase 3 `8 → 10` (the totals stay
   39) and add TC-028/TC-034 to phase 3's obligation list with the cell labels.
3. Mirror the split in test-plan TC-028/TC-034 (one sentence each: "cells 1-3 are green at
   the command phase; cells 4 and 2-3 complete with the count rule"), so the TC definition
   and the plan agree.

### B3. **[major] cross_artifact_consistency / system_spec_consistency — spec §8.5 (line 277), RSK-6 (line 318), DEC-15 (line 376), AC-F7-1 (line 468); plan residual-risk paragraph (lines 253-259); verified in `packages/core/src/domain/dispatch-gate.ts:141-153`, `packages/core/src/app/dispatch-ledger.ts:282-296`, `packages/cli/src/output/dispatch-text.ts:66-67`**

Gap: the change describes the delivered summary's divergence block as deriving its count
from a capped identifier list, and describes its own change to that block as merely
additive. Both statements are contradicted by the delivered code, and the test plan
already says so correctly (§8.2, line 1888).

Verified current behaviour:
- `foldEvidenceWindow` (`packages/core/src/domain/dispatch-gate.ts:141-153`) folds
  divergences **store-wide** and with **no 20-cap**: `unresolvedIds` is every open
  identifier and `unresolved = unresolvedIds.length`, so `unresolved` is already the
  exact open count and `resolved = folded.length - unresolvedIds.length` is already exact.
  `toSummaryData` (lines 285-311) passes that block through unchanged, and the text
  projection prints every identifier: `unresolved_divergences=${data.divergences.unresolvedIds.join(",")}`
  (`packages/cli/src/output/dispatch-text.ts:67`).
- The capped list-length derivation the artifacts describe exists only in
  `summarizeDispatchDivergences` (`packages/core/src/app/dispatch-ledger.ts:282-296`),
  which has **no caller** — grep over `packages/**` and `tests/**` finds only the two
  barrel re-exports (`packages/core/src/app/index.ts:110,118`,
  `packages/core/src/index.ts:106,114`) and the allowance row
  (`tests/structure/content-inventory.test.ts:128`). The change deletes it (plan 3.4).

Therefore, on the delivered surface:
- The count does **not** move up past 20 open divergences — the plan's "UP when more than
  20 divergences are open (the delivered rule reported the capped list length)" (line 255)
  and spec RSK-6's "An operator comparing a historical summary line with a new one sees a
  larger number; the old number was a bounded-list artefact" (line 318) are false. The
  only real movement is **down** (a migrated root stops counting another repository's
  open divergences) plus a **new** count appearing on the resolve result.
- The change does narrow a delivered field: on a root with more than 20 open divergences
  the summary's `unresolvedIds` (and the human `unresolved_divergences=` line) loses
  identifiers that the delivered code returns. Spec §8.5's "the divergence block reports
  the exact folded counts … instead of a count derived from a bounded identifier list" and
  "The four delivered block fields keep their names, types, meanings, and order", and
  AC-F7-1's "its text projection unchanged apart from the exact divergence count of
  AC-F5-5 and the declared additive `idsTruncated` key", all deny that narrowing.

Why it blocks: phase 5 owns `doc/spec/features/feature-dispatch-engine.md` (§16.1 row 1)
and would carry the false history into current truth. That page already documents the
bound the code does not enforce — `| Unresolved divergence ids in a summary | 20 |`
(line 262) — so the correct statement is that the change *aligns the summary with its
documented bound*, which is a stronger and honest justification than the one written.
Note the TDR repeats the same rationale in D-5 and is owned by `@decision-advisor`.

Suggested remediation target phase: specification
Suggested fix (exact):
1. §8.5: replace "instead of a count derived from a bounded identifier list" with "the
   summary's `unresolved` was already exact but store-wide; both blocks now share one
   repository-scoped computation, and the summary's `unresolvedIds` becomes the declared
   at-most-20 list with `idsTruncated`, matching the bound the feature spec already
   states". Drop "meanings … unchanged" for that field, or name the narrowing.
2. RSK-6: say the number can move **down** on a migrated root and that the identifier
   list narrows to 20; delete the "larger number / bounded-list artefact" sentence.
3. AC-F7-1: add the `unresolvedIds` narrowing to the list of declared changes on the
   summary, alongside `idsTruncated`.
4. Plan lines 253-259: state the two real movements (down; new block on resolve) and the
   identifier narrowing; keep the P2 mutation rationale (a list-length implementation now
   under-reports 25 as 20), which is correct.
5. Ask `@decision-advisor` to align TDR-0024 D-5's rationale sentence with the corrected
   statement before the record is accepted at PR review.

## Non-blocking findings (apply in the same pass; none of these reds a gate)

A1. **[major] plan_code_area_coverage — plan phase 2 work 2.3 (lines 566-571) and §2.4 (lines 572-578); `tests/fixtures/dispatch/golden/harness.ts:269`, `tests/conformance/dispatch/controlled-repo.ts:166`**
Gap: the plan extends `DispatchGateComposition`/`DispatchComposition` with an attempts
port and an active-reference port but never says whether the new members are optional.
Both existing fixtures that supply a `gate:` block, plus the structural assertion that a
gate-less composition exposes only the run surface
(`tests/structure/dispatch-composition.test.ts:122`,
`expect(Object.keys(scenario.runtime)).toEqual(["run"])`), would fail
`pnpm typecheck`/`bun test` if the members are required, and none of the three files is
scoped. Every delivered optional member (`gate?`, `preflight?`, `restartBudget?`) sets
the precedent.
Fix: state in 2.3 that the new composition members are optional and that the attempts
surface is composed only when supplied; or, if they must be required, add
`tests/fixtures/dispatch/golden/harness.ts`, `tests/conformance/dispatch/controlled-repo.ts`
and `tests/structure/dispatch-composition.test.ts` to phase 2 `scope.files`.
Target: delivery_planning.

A2. **[major] cross_artifact_consistency — test plan TC-ATTEMPT-003 `Notes / Clarifications` (final bullet), against plan lines 154-175**
Gap: the note says "`--limit` is declared as a value-taking flag; the missing-value cell
exercises the parser branch before any state work", and the Expected Outcome requires the
message to name "the accepted range `1..100`". Under the plan's design `--limit` is
deliberately **not** in `requiresValue`; if it were, the delivered parser would answer
`missing value for "--limit"` as `fallback.invocation`
(`packages/cli/src/index.ts:274-277` → `invocationFailure`, line 200-204), which satisfies
neither the required code nor the required message. So the cell is satisfied by the
command module's local grammar, not by "the parser branch".
Fix: reword the note to "the missing-value cell is refused by the command module's
`attempts` grammar before any runtime call; the shared parser is deliberately not given
`--limit` as a value-taking flag because it would answer `fallback.invocation`".
Target: test_planning.

A3. **[major] cross_artifact_consistency — plan header "TWO DECLARED DEVIATIONS" (lines 82-95)**
Gap: the plan declares two deviations from test-plan §7.3 but regroups seven groups into
five, which moves more than two: TC-006/007/008/024/028 from TP1 to phase 2 (acknowledged
only inline in phase 1's test obligations, line 457-458), TC-015/016/017 from TP2/TP6 to
phase 2, TC-035 from TP7 to phase 5, and the whole read-runtime group (TP2) merges into
the command phase (TP3). The merges are defensible (the runtime is only observable
through the surface), but the count claim is false and a reviewer will treat the section
as the complete list.
Fix: replace "TWO DECLARED DEVIATIONS" with the full mapping (TP1..TP7 → plan 1..5, TC by
TC), keeping the two existing justifications. Target: delivery_planning.

A4. **[major] plan_coverage — plan phase 4 `scope.files` (line 934) and `Done when` (lines 895-901)**
Gap: `tests/structure/dispatch-attempts-composition.test.ts` is listed in the scope and
required green in the done-when, and test plan §7.1 assigns TC-ATTEMPT-029 to it, but no
work item (4.1-4.5) says to author it. Today the file does not exist (verified by
listing `tests/structure`), so the phase's done-when cannot be met from the declared work.
Fix: add a work item 4.6 authoring TC-ATTEMPT-029's suite half (digest pointer line, family
synopsis, and the `dispatch attempts` entry naming
`dispatch dual-run summary --repo <repository>`), with the page half left review-verified.
Target: delivery_planning.

A5. **[major] cross_artifact_consistency / decision_capture — plan work 1.2 (lines 403-406) against `packages/core/src/contracts/dispatch.ts:366-377`**
Gap: three proposed constants duplicate delivered ones with identical values —
`ATTEMPTS_MAX_DATA_BYTES = 65536` vs `DISPATCH_MAX_MACHINE_BYTES = 65536`,
`ATTEMPTS_MAX_HUMAN_LINES = 40` vs `DISPATCH_MAX_HUMAN_LINES = 40`,
`ATTEMPTS_MAX_HUMAN_BYTES = 8192` vs `DISPATCH_MAX_HUMAN_BYTES = 8192`. Spec §22 claims
the new bounds are "declared constants beside the delivered dispatch bounds", which reads
as reuse; two declarations of one bound is the drift the sentence is trying to prevent,
and each extra name costs a fixture row and an allowance row (see B1).
Fix: reuse the three delivered constants (`DISPATCH_MAX_MACHINE_BYTES`,
`DISPATCH_MAX_HUMAN_LINES`, `DISPATCH_MAX_HUMAN_BYTES`) and keep only the genuinely new
ones (`ATTEMPTS_DEFAULT_LIMIT`, `ATTEMPTS_MIN_LIMIT`, `ATTEMPTS_MAX_LIMIT`,
`ATTEMPTS_HUMAN_ROW_BUDGET`, `ATTEMPTS_LIMIT_PATTERN`); or, if separate names are
intentional, say in the plan that they are aliases of the delivered values and why.
Target: delivery_planning.

A6. **[minor] cross_artifact_consistency — spec §5.1 F-9 (line 138) and §16 row 1 (line 395)**
Gap: both say the command definition "gains two declared value-taking flags" and that
"its exit projection is unchanged", while the plan achieves the required refusals with
`acceptsAnyFlag: true` plus a command-module token grammar and explicitly leaves
`requiresValue` untouched (lines 162-175). `requiresValue` is not "merely a hint": it is
the parser's tokenisation table, and opting out of it is what forces the local grammar.
Behaviour is preserved (the handler guard restores `fallback.invocation` for the four
delivered forms), so this is a wording defect, not a design defect.
Fix: state that the two flags are declared in the published grammar (help entry, synopsis,
page) and validated by the command module, and that the delivered forms keep their
`fallback.invocation` refusal. Target: specification.

A7. **[minor] ac_quality — spec AC-F9-2 evidence cell (line 475)**
Gap: the cell says only "Suite", but its "no external dependency / no lockfile change"
half cannot be asserted in-tree; test plan §3.1 (line 112) and TC-ATTEMPT-035 correctly
split it as "Suite (scans) + Review-verified (lockfile and diff half)". AC-F4-4 and
AC-F9-1 both label their split, so this one is the outlier.
Fix: "Suite (scans and gates), review-verified (lockfile and manifest diff)". Target:
specification.

A8. **[minor] plan_doc_update_coverage — plan work 5.3 (lines 970-975)**
Gap: phase 5 edits five feature pages but only 5.4 mentions frontmatter upkeep (for the
quality test-spec). `doc/spec/features/feature-dispatch-engine.md:6,11` carry
`last_updated: 2026-11-10` and `related_changes: [... "GH-288"]`, so after this change the
page's own metadata is stale and GH-289 is absent — a `@doc-syncer` finding waiting to
happen. Also `doc/quality/test-specs/test-spec-dispatch-engine.md:10` omits GH-288 today,
which 5.4's wording ("gains `GH-289`") silently preserves.
Fix: add one line to 5.3: every edited feature page advances `last_updated` and appends
`GH-289` to `links.related_changes`; and say whether the test-spec list should read
`GH-288`, `GH-289` or only `GH-289`. Target: delivery_planning.

A9. **[nit] ac_quality — spec §5.1 F-2 (line 131) and plan work 1.2 (line 400)**
Gap: the envelope is described as nine keys in one place and eight-plus-optional-
`truncation` in another (Appendix D, TC-028 step 2). TC-028 encodes the correct eight
plus one.
Fix: "eight always-present keys plus `truncation` only when a bound binds". Target:
specification.

A10. **[nit] cross_artifact_consistency — `chg-GH-289-pm-notes.yaml:5`**
Gap: `clarify_scope` records `completed: 2026-11-11T16:18:24.374Z` before
`started: 2026-11-11T17:20:00Z`, and `specification.started` is `null` beside a real
completion. Phase state is command-owned (`phase` family); a completed-before-started
pair will confuse the DoD read.
Fix: re-establish the pair through the `phase` primitive rather than by editing the file.
Target: delivery_planning (no artifact rewrite needed before delivery).

## Facts verified this iteration (do not re-litigate)

- **The plan's parser premise is correct.** `parseInvocation` (`packages/cli/src/index.ts:241-291`)
  answers `fallback.invocation` (`invocationFailure`, lines 200-204) for a missing value of
  a `requiresValue` flag (lines 274-278), an unknown flag when `acceptsAnyFlag` is absent
  (lines 271-273), and a positional beyond `positionals.max` (lines 261-267); the dispatch
  definition declares `positionals: { max: 3 }` (`packages/cli/src/commands/dispatch.ts:119`).
  So AC-F1-3 / AC-F1-6 cannot be met by adding the flags to `requiresValue`, and the
  plan's `acceptsAnyFlag` + local-grammar route is the only in-scope way to meet them.
  `fallback.invocation` is a real table row (`packages/core/src/contracts/error-table.ts:128-136`,
  `projectionClass: "user-validation"`), and `input.value.rejected` exists at line 287, so
  the two identities are distinct and both exit `1`.
- **The grammar's arity fits.** With `--json` filtered (`GLOBAL_FLAGS`, line 236),
  `dispatch attempts --ref GH-241 --limit 3` is exactly three positionals, at `max: 3`;
  TC-ATTEMPT-039's three refusal cells (`--ref 241`, `--unknown-flag`, `EXTRA`) all parse
  and reach the command module. Only a second extra positional would fall through to
  `fallback.invocation`; no TC exercises that, and the plans do not claim it.
- **Taxonomy closure holds.** `ERROR_TABLE` has 124 identities (122 literal rows plus the
  two reserved fallbacks, `error-table.ts:50-53,128-146`) with exactly four
  `domainKind: "dispatch"` rows (lines 1137, 1148, 1159, 1170). `state.store.torn`,
  `state.schema.mismatch`, `state.permission.denied` and `state.store.unknown` all exist
  (`state.ts:75-84`), so AC-F4-3's three cells each have their own identity. No new row is
  needed — the spec's central ruling is satisfiable.
- **The record shape matches the projection exactly.** `DispatchAttemptRecord`
  (`contracts/dispatch.ts:190-212`) carries all sixteen projected facts plus
  `schema`/`handoverState`/`prefillCostAcknowledged`, which DEC-6 deliberately drops;
  `divergenceRef?: string` and `resumeMode?` explain the present-as-`null` rule;
  `DispatchEvidenceReference = string` (line 187) and the read guard enforces `≤ 16`
  (`dispatch-ledger.ts:69-72`); `comparison.token` is `null` iff the class is
  `not-applicable` (line 88-96). No spec claim contradicts the delivered record.
- **The delivered attempt read does what the plan assumes.** `readDispatchAttempts`
  (`dispatch-ledger.ts:219-231`) reads once, keeps the newest `DISPATCH_MAX_ATTEMPT_RECORDS = 5000`,
  returns `verifiedEmpty` and a `{bound, omittedRecords}` truncation, and maps a torn
  payload to `state.store.torn` (`dispatch-ledger.ts:140-147`). Mapping that to `{scope, bound,
  omittedRecords}` is additive, as DM-5 assumes.
- **`resolveProductionRepository(undefined, { persist: false })` is a valid call**
  (`packages/cli/src/production.ts:810-813`), and `schedulerKeyForRef` does read the queue
  ledger (`production.ts:839-843`), so the plan's "no scheduler key ⇒ no queue read ⇒
  exactly one store read" reasoning is sound. `pmContextPath` (line 597) and `localFs`
  (line 447) are in scope at the composition site (line 1412).
- **The resolve surface has no counts today**, so `mode`/`repository`/`divergences` are
  genuinely additive: `resolveDispatchDivergenceEvidence` returns exactly
  `divergenceId, state, resolved, note, principal` (`app/dispatch-gate.ts:118-127`), and
  the command prints nothing for it (`commands/dispatch.ts:154`).
- **Help, parity and inventory are complete and correctly split.** Exactly two pins exist
  on the dispatch entry count: `tests/checks/reference-page-parity.test.ts:57` and
  `tests/structure/dispatch-help-inventory.test.ts:48`, both in phase 4's scope.
  `renderRootHelp` lists only depth-1 entries (`help.ts:583-589`), so the seventeen-family
  claim holds. `helpEntryFor(tokens.slice(0, helpIndex))` (`entrypoint.ts:260-265`) serves a
  two-segment path with no composition, so `dispatch attempts --help` is a pure data
  lookup. `HELP_TUPLES` is derived from `allHelpEntries()` (`tests/fixtures/entrypoint/programs.ts:61-70`),
  so the new entry inherits TC-ENTRY-004's five-section requirement automatically and its
  example parses against a synthetic program whose flags come from the family entry.
  `pageIn`/`M2_REFERENCE_ROOT` already exist (`help.ts:36,40`), and
  `renderRootHelp`/`pageIn` precedent is a plain object literal (lines 509-524).
  `tests/checks/help-guide-coverage-mutants.test.ts:17-25` already copies the M2 page root,
  and `scripts/checks/help-guide-coverage.ts` is prompt-required-driven, so `attempts`
  needs no coverage-gate change — confirmed.
- **The phase-4 "aggregate not re-run" justification is honest.** No gate in the phase's
  `Done when` is claimed green by omission, and `pnpm check:help` is named explicitly.
- **No existing test encodes the retired list-length derivation at >20.** The delivered
  divergence assertions use `toMatchObject` with counts of 0 or 1
  (`dispatch-dual-run-summary.test.ts:72`, `dispatch-divergence.test.ts:88`,
  `dispatch-gate-window.test.ts:101`, `dispatch-gate-evidence.test.ts:237`,
  `dispatch-delivered-evidence-divergence.test.ts:236,501`), and
  `tests/behaviour/dispatch-bounds.test.ts` encodes no divergence count — so the plan's
  "single permitted existing-test adjustment" holds and no hidden suite reds.
- **Doc impact is executable.** Every path in spec §16.1 exists:
  `milestones/m2/commands/attempts.md` currently carries exactly the defects Appendix C
  names (`divergenceRefs[]` at line 50, `command: "dispatch attempts"` at line 74, the
  `success` token at lines 67-68, the three `attempts.*` rows at lines 81-83,
  `Status: Proposed (M2)` at line 3); `contracts.md`, `entrypoint-delta.md`, `backlog.md`,
  `status.md`, `cli-command-registry.md` and `test-spec-dispatch-engine.md` all exist.
  Phase 4 owns the two gate fixtures; phase 5 owns the other thirteen rows. Nothing §16.1
  requires is unowned.
- **TDR-0024 is indexed and untracked as the plan says** (`git status`: one untracked
  entry; `doc/decisions/00-index.md:49` already carries the TDR-0024 row), and phases 1
  and 5 reference it without restating it.
- **No delivery-evidence write outside the declared scope is implied.** `forbidden-literals`
  scans `doc/**` minus `doc/changes/` and `doc/decisions/`
  (`scripts/checks/forbidden-literals.registry.json:26-30`); `.changeset/*.md` is not a
  scanned root (`:1-24`), so the new changeset needs no registration and no new
  `doc/**` page is created in this change.
- **Ownership arithmetic is exact.** Parsing the plan's comment block: 36 ACs, 36 unique,
  none missing; 39 TCs, 39 unique, none missing; grouping 2+22+6+3+3 = 36 and
  3+22+8+3+3 = 39.
- `plan validate GH-289` → `verdict=valid`, `artifact=yaml:chg-GH-289-plan.yaml`,
  `tier=full`, `readyForDevelopment=true`.
- `bun test tests/structure/port-contract-inventory.test.ts` → 11 pass, 0 fail (the B1 gate
  is live).
- `bun test tests/checks/reference-page-parity.test.ts tests/structure/dispatch-help-inventory.test.ts`
  → 9 pass, 0 fail (both entry-count pins are live and currently at four).

## Residual risks I would accept once B1-B3 are fixed

1. **`fallback.invocation` vs `input.value.rejected` boundary at arity 4.** A second extra
   positional is classified by the shared parser as `fallback.invocation`; no AC cell
   exercises it and no consumer depends on it. Accepted as a pre-existing global grammar
   class, provided A2's rewording makes it explicit rather than accidental.
2. **`acceptsAnyFlag: true` widens the parser for every dispatch form.** The handler guard
   is the only thing preserving the four delivered forms' refusal identity, and it is
   pinned by TC-ATTEMPT-034 cell 6 (the P1 negative control) plus tc-039. Accepted: the
   observable contract is pinned, and the alternative (new rows) is closed by DEC-1.
3. **Second divergence-ledger read on resolve.** Computing the block after the append
   requires re-reading the divergence ledger; NFR-2 bounds only the *attempts* read.
   Accepted, but worth one sentence in plan 3.3.
4. **Cross-repository resolve stays disclosed, not prevented** (OQ-1, NG-7). Accepted: the
   result names the divergence's own repository, and the guard's precondition is recorded.
5. **Review-verified halves.** AC-F7-2's page half, AC-F8-3, AC-F8-4, AC-F9-1's
   additive-only half, AC-F9-2's diff half and AC-F4-1's side-effect enumeration rest on
   review, and each names the exact check and its §10 row. Accepted as the strongest
   available form for a diff against a moving base.

## Can delivery proceed with a recorded accepted risk?

No. B1 makes phase 1's declared aggregate gate red on the first commit, and the only
remedy is an edit to a fixture no phase declares. B2 makes phase 2's "twenty-two TCs green"
unsatisfiable while leaving the completing cells unowned. B3 would write a false history of
the delivered summary into `doc/spec/features/feature-dispatch-engine.md`. The override
path is unavailable: this change adds behaviour and a command surface, so it is not
"genuinely trivial".

All three are mechanical: one fixture added to two `scope.files` lists plus one gate line
(B1); one ownership split (B2); five one-sentence wording corrections plus a TDR alignment
(B3). A1-A10 are the same pass. Re-run this gate as iteration 2 after `delivery_planning`,
`test_planning` and `specification` are revised.

VERDICT: NOT_READY
