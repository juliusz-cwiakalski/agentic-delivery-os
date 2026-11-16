# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-297
Date: 2026-11-16
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Iteration-1 Finding Closure (verified against artifacts and code truth)

- F1 (critical, plan): **closed as named**. `scripts/checks/error-table-sync.ts`,
  `tests/structure/error-table.test.ts`, and `tests/checks/error-table-sync.test.ts`
  are all in phase-3 `scope.files` (plan lines 1189, 1209, 1211); obligation 3.5b
  pins the exact two-code widening (53 → 55 in BOTH files, `toHaveLength(53)` →
  `(55)`, same commit, no family/pattern); 3.5c pins the count updates (four 136 →
  138 sites, 135 → 137 delivered, 2 board rows, carrier 136 → 138 with paragraph
  52 → 55); the phase-3 done-when gates on the 55-member allowlist in both files,
  138/137/2 with no leftover 136, carrier 138/55, near-miss rejection, and the
  sync check + mirror + sync-side suite green inside `pnpm check`. However, the
  "four sites" enumeration is incomplete — see finding 1 (same defect class,
  residual instance).
- F2 (major, spec): **closed**. Spec v1.2 declares the exact reviewed widening in
  DM-8, new DEC-20, new C-16, extended C-7, §16.1 carrier row, new AC-F8-3,
  OQ-8 (closed), DoD-14, and the revision row; the arithmetic was independently
  verified against code truth: the allowlist holds 53 in both owning files
  (sync check line 147; mirror line 57 asserted at 1406), four `toHaveLength(136)`
  sites exist in the mirror (822/898/1132/1735), `toHaveLength(135)` at 1828,
  the sync-side suite pins 136/136 (1790/1791) and `toContain("136 identities")`
  (1802), and the carrier's allowlist paragraph states 52 with an enumerated sum
  of 52 that indeed omits the delivered `verify.narrowed-scope` — so 53 + 2 = 55
  (not 54) is factually correct and consistently stated across spec, test plan,
  and plan.
- F3 (minor, test plan): **closed**. TC-BOARD-053 (same id, extended in place)
  owns the whole gate-critical unit: exact 55-member set in both files with
  both-direction `board.*` set equality and the 53 delivered members unchanged,
  the four 138 assertions plus a no-leftover-136 scan, 137 delivered rows, 2
  board rows, carrier 138/55 with an enumeration that sums, two-segment near-miss
  probes, three-segment lookalikes, and five temp-copy mutation arms; §3.1
  (AC-F8-3 → TC-BOARD-053), §3.2, §5.1, and the DoD-14 binding all reconcile.
- F4 (minor, plan): **closed**. All six delivered suites
  (board-escalation/aging/records/waiver-recording/privacy/corpus) are in
  phase-2 `scope.files` (lines 1140-1145) with the explicit stay-green
  obligation 2.9 and the phase-2 done-when naming them.
- F5 (nit, spec): **persists, non-blocking** (finding 3 below).

## Findings

1. [critical] plan_code_area_coverage / cross_artifact_consistency —
   chg-GH-297-plan.yaml#phase-3 (scope.files; obligations 3.5c, done-when);
   propagated from chg-GH-297-spec.md#AC-F8-3/DM-8/DEC-20 and
   chg-GH-297-test-plan.md#TC-BOARD-053 step 5
   Gap: The F1 remediation (and iteration-1 F1 itself) enumerated the
   ERROR_TABLE total-count assertions as exactly "four structural sites", all in
   `tests/structure/error-table.test.ts`. The repo pins the same 136-total in
   two additional structural suites that appear in **no** phase's scope.files:
   - `tests/structure/dispatch-attempts-taxonomy.test.ts` line 50:
     `expect(entries).toHaveLength(136)` over the imported `ERROR_TABLE`
     (test title also states 136);
   - `tests/structure/verify-gates-suite-map-contract.test.ts` lines 149-150:
     live `runSyncCheck({ root: ROOT })` with `sourceEntries`/`documentedRows`
     `toBe(136)`.
   Both suites run in `pnpm check` (`bun test` discovers `tests/**`), which the
   phase-3 done-when requires green at its boundary. As scoped, phase 3's
   done-when is again unsatisfiable without editing out-of-scope files — the
   same defect class as iteration-1 F1 ("delivery must invent scope"; GH-230
   GAP-17 precedent). The incomplete enumeration is shared by all three
   artifacts: spec AC-F8-3/DM-8/DEC-20 ("the four structural count assertions"),
   test plan TC-BOARD-053 step 5 (no-leftover-136 scan scoped to the mirror
   only), and plan 3.5c/revision note ("all four structural assertions").
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add both suites to phase-3 scope.files with an obligation to
   move their 136 literals to 138 in the same commit as the rows (title string
   included), and broaden the "no leftover 136" obligation to cover every
   live-table total assertion (a repo-wide scan over `tests/**` for the 136
   total, not just the mirror). Recommended alignment edits: extend
   TC-BOARD-053 step 5's scan to all suites asserting the table totals
   (test_planning), and soften the spec's "the four structural assertions"
   wording to "all live table-total assertions (the four mirror sites plus the
   two cross-suite pins)" (specification) — these are one-line realignments;
   the blocking fix is plan scope.

2. [minor] plan_code_area_coverage — chg-GH-297-plan.yaml#phase-3 (obligation 3.5c)
   Gap: Declaration letter-gaps inside in-scope files, same count-update unit:
   (a) the plan attributes the `"136 identities"` doc-content expectation to
   `tests/checks/error-table-sync.test.ts` (its line 1802) but the structural
   mirror has its own at `tests/structure/error-table.test.ts` line 1847, which
   is not named by 3.5b/3.5c (the "no 136 count remains" scan is described as a
   table-length scan and may not match a string-contain); (b) the sync-side
   suite's baseline oracle pins the total as `BASELINE_ROWS.length + 102`
   (lines 1081-1082, 1162, 1185), which must become `+ 104` — covered in spirit
   by "live-tree assertions move with the table" but not in the letter. Both
   files are already in phase-3 scope, so no scope invention; risk is a delivery
   that greps only the declared literals.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Extend 3.5c to name the mirror's doc-content expectation
   (line ~1847) and the `+ 102` → `+ 104` baseline-oracle arithmetic explicitly.

3. [nit, persistent] decision_capture — chg-GH-297-spec.md#AUTHORING-GUIDELINES
   Gap: Iteration-1 finding 5 persists: the guidelines claim every deviation
   from the pack's example snippets (the envelope shape, `stateSource`,
   `ownerHold`) is "recorded as a decision", but the envelope-shape deviation
   still has no DEC row (only NFR-1); `stateSource` and `ownerHold` are
   decision-recorded, so the claim is one-third unmet. Non-blocking.
   Suggested remediation target phase: specification
   Suggested fix: Note the envelope-shape deviation in DEC-2 (or a DEC row) or
   drop it from the "recorded as a decision" list.

## Whole-Package Re-Judgment (beyond the remediation checks)

- Ticket↔spec: GH-297 (OPEN, milestone M2) loaded via tracker; body confirmed
  (backlog M2-S4 + M2 pack as source of truth, single AC, tasks, dependencies;
  the ticket's three-dependency list vs the backlog's four is the superset case
  cleared in iteration 1). Appendix B decomposes the single backlog AC without
  adding a second meaning; the binding test-plan mapping note is satisfied by
  v1.2 (AC-F3-6 on TC-BOARD-010, `phases-complete` cell, same-run `applied`,
  `fallback.invocation`, `provider-quota` no-row, bare `ref: null`, 128 not
  2 000, and the AC-F8-3 assertion set).
- Four sections, multi-repo forms (`--all`/`--project`/default/`unbound`), SLA
  preservation (C-3: gates section IS the delivered evaluator), mounting (21st
  family in phase 4), 128 cap with deterministic retained set, 64 KiB data /
  24-line / 4 096-byte human bounds with byte-guard order, and the write
  carve-out are each stated identically in spec (F-1..F-9, DM-8, DM-11, §16,
  §17), test plan, and plan constraints; the 24-line budget still closes
  (1 + 4 + 6+6+4+3).
- Counts reconcile: 29 ACs in spec §17 = §3.1 matrix rows = plan ownership set
  (1+11+10+3+4, each exactly once); 48 TCs = §5.1 index = §5.2 details = plan
  ownership (1+21+16+5+5, each exactly once); DoD-1..18 mapped (DoD-14 →
  phase 3 with the widened expectations; DoD-18 → lifecycle phase 11).
- No stale-count contradictions: the only "28 ACs" text is the test plan's v1.1
  revision-history row (historical record, correct in context).
- system_spec_consistency holds: the carrier row (§16.1) declares exactly what
  feature-result-contract.md must change in-boundary, matching verified code
  truth; DEC-20's 52-omits-`verify.narrowed-scope` reconciliation is factually
  accurate (enumeration sums to 52; the delivered set includes the code).

## Gate Result

NOT_READY — finding 1 blocks (phase-3 done-when unsatisfiable as scoped, same
class as iteration-1 F1). Reopen `delivery_planning` (findings 1, 2);
recommended one-line alignments in `specification` (finding 1 wording, finding 3)
and `test_planning` (finding 1 scan breadth) may ride the same revision. No
human input required (Pause: no). Iteration budget: 2 of ~3 used; the residual
gap is narrow and mechanical — one targeted revision should reach READY.
