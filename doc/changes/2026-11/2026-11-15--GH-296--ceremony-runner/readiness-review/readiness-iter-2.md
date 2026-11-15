# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-296
Date: 2026-11-16
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Scope of this review

Re-review after the iteration-1 remediation (spec v1.1, test plan v1.1, plan with the
64-id TC map). All four artifacts, the ticket (`gh issue view 296`), the iteration-1
verdict, and the relevant planning/current-truth documents read in full. Mechanical
and truth checks run, not taken from the artifacts: `plan validate GH-296` →
`verdict=valid`, `tier=full`, `readyForDevelopment=true`; the new §12 assumption
behind the `repository` derivation is backed by delivered code
(`packages/core/src/domain/dispatch-identity.ts` — rename-invariant normalized
`host/owner/name` identity, plus the queue-graph normalizer); backlog M2-S6 records
`Depends on: M1-S19, M2-S3, M2-S14` (line 1151) so the §13 Blocks claim is now a
recorded edge; M2-S10 records `Depends on: M1-S8` only (line 1118) so the reworded
"Feeds (edge not recorded)" row is accurate; `PROMPT_REQUIRED_COMMANDS` has exactly
20 entries with no `ceremony` yet, so the 20 → 21 mount claim holds; the 64-id TC →
PHASE map owns every id 001..064 exactly once (counted: 6+1+10+4+16+3+7+2+6+6+3 =
64) and the plan's map agrees with test-plan §7.1 id for id.

## Iteration-1 findings — resolution status

1. **Scope key for note-less declarations — RESOLVED.** `scopeKey` is a required F-2
   declaration member with a closed derivation set (`literal`, `repository`, `note`)
   and one precedence rule (F-2, DEC-16, E-19); the F-3 table declares the key for
   all six built-ins (four `repository`, two `note` — matching which built-ins
   require a note); intake resolves it before any read (F-4.1); DM-1/DM-2/DM-3 and
   the §23 glossary agree; AC-F2-4 refuses every illegal shape and TC-061/D-15..D-18
   exercise them; and the note-less re-run hole is now exercised, not just the
   note-consuming one: AC-F4-7 + TC-063 run `morning-brief` twice in one UTC day
   (derived day window, `repository` key, `data.reused: true`, zero appends, plus a
   UTC-midnight-straddling control). The `repository` derivation's one new external
   claim (§12, delivered identity resolver) verifies against current truth. No
   contradiction with any delivered contract; no vocabulary duplication.
2. **Retro trigger set / explicit-run trigger — RESOLVED.** The retro-evidence-pass
   cell declares exactly the four sub-R1 level triggers and names the `change-merged`
   and R1 exclusions; each trigger maps one-to-one to a level with a per-level output
   (F-9), so no declared firing lacks a level. The recorded-trigger vocabulary
   (`schedule`/`event`/`catch-up`/`explicit` × `note`/`declaration`/`unspecified`)
   is closed and stated once (F-2, DM-1, DM-3, E-20, DEC-17); TC-062 asserts all
   three resolutions plus the undeclared-note-trigger refusal, and TC-014 step 3 was
   correctly re-based from kind-equality to `explicit`/`note` (OQ-T6).
3. **Window for every declaration shape — RESOLVED.** F-1's three rules cover
   note-consuming (note governs; disagreeing `--window` refused), note-less scheduled
   (`--window` or the single declared cadence's UTC unit; the at-most-one-schedule
   bound makes the derivation single-valued), and note-less event-only (`--window`
   required; E-18/AC-F4-8/TC-064 refuse before any effect). DEC-18 records the
   granularity rationale. Every shape resolves a window or refuses.
4. **8/9-trigger bound — RESOLVED.** TC-009's ladder now carries the 8/9-trigger
   rung and D-12 the 9-trigger case; F-2 states the 1..8 count once and DM-1 restates
   only the single-schedule bound. OQ-T7 honestly documents the at-limit fixture
   wrinkle (6 events + 1 schedule = 7 unique names) as a delivery-time
   contract-constant decision with a fallback — non-blocking.
5. **Plan per-phase AC claims — RESOLVED for Phase 8** ("delivers AC-F8-2..AC-F8-3
   (AC-F8-1 is delivered in Phase 2 by TC-CEREMONY-040)"). A milder residue of the
   same class remains at Phase 1/5 (finding 4 below) — declared, not silent.
6. **§13 dependency edges — RESOLVED.** The Blocks row cites the backlog's recorded
   M2-S6 edge (verified verbatim); M2-S10 and M2-S4 are restated as feeds with the
   unrecorded edge named as such (M2-S10 verified: `Depends on: M1-S8` only).

## Findings

1. [major] cross_artifact_consistency — chg-GH-296-spec.md §5.1 F-5 + §5.2 E-14 vs chg-GH-296-test-plan.md TC-CEREMONY-062 step 4 + §4.4 CU-02 (+ OQ-T8)
   Gap: The v1.1 non-counting rule (F-2/E-20/AC-F3-8: "an explicit run is never
   counted as the fulfilment of a scheduled or event obligation") collides with the
   F-5 missed-window arithmetic ("the windows due before now, minus the windows
   already recorded for that ceremony, are the missed windows" — existence-based,
   no kind discrimination), and the artifacts encode both sides of the collision:
   F-5 + E-14 ("already recorded for that window → `nothing-missed`") make the
   explicitly-run window not-missed, while binding TC-062 step 4 asserts the
   explicitly-run window "stays due" and that `catch-up` "replays a different missed
   window" — unsatisfiable under F-5's plain set-minus. CU-02 ("one missed window
   already recorded") is only constructible under the kind-based reading and is
   vacuous under F-5's. Exactly one of {F-5, E-14} vs {TC-062 step 4, CU-02} can
   hold; whichever the coder picks, a binding artifact says it is wrong. This is a
   mainline combination, not a corner: NG-4 ships no scheduler, so scheduled
   ceremonies are run manually, and a manual `morning-brief` lands exactly on the
   scheduled day-window identity. Under the kind-based reading the occupied identity
   (F-4.1 refuses re-execution) makes the window permanently missed and, per CU-04's
   one-replay-per-invocation, permanently consumes the replay slot — catch-up jams;
   under the existence-based reading the scheduled obligation for that window can
   never be satisfied by anything — it is outstanding forever with no clearing path.
   OQ-T8 owns the question but is marked non-blocking; the plan's OQ RESOLUTIONS
   section (which resolves OQ-1..OQ-3 and OQ-T2) is silent on it. The identity reuse
   itself (one run per `(ceremony, scopeKey, window)`) is correct idempotency; the
   defect is the unpinned obligation/missed-window composition around it.
   Suggested remediation target phase: specification
   Suggested fix: Pin one predicate and its composition: state whether "the windows
   already recorded" in F-5 is kind-scoped, define what `catch-up` reports for a
   window whose obligation is outstanding but whose identity an explicit run
   occupies, define whether and how that scheduled obligation ever clears (replay,
   coalesce, or declared permanent gap), and reword E-14/CU-02 to match. Then a
   test_planning follow-up in the same cycle: align TC-062 step 4 and CU-02 with the
   pinned rule and add the collision assertion TC-062's note already reserves.

2. [minor] plan_code_area_coverage — chg-GH-296-plan.yaml Phase 5 scope vs TC map lines for TC-CEREMONY-007/TC-CEREMONY-061
   Gap: The plan declares that TC-007's six-built-in validation half and TC-061's
   six-built-in `scopeKey` sweep "complete in Phase 5", and Phase 5's gate runs
   `tests/structure/ceremony-contract.test.ts` — but that file (and
   `tests/behaviour/ceremony-declaration.test.ts`, which carries TC-061's per-built-in
   assertions) is declared only in Phase 1's scope. Completing the assertions
   requires editing both files in Phase 5, outside Phase 5's declared scope,
   violating the plan's own SCOPE CONVENTION ("a file edited in two phases is
   declared in both phases") and the commit primitive's stage-only-declared-scope
   rule — the completion literally cannot land as declared.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `tests/structure/ceremony-contract.test.ts` and
   `tests/behaviour/ceremony-declaration.test.ts` to Phase 5's `scope.files` (they
   are already run by its gate), or move the six-built-in completion assertions into
   a Phase-5-scoped suite (e.g. the parity suite) and say so in the map.

3. [nit] spec_completeness — chg-GH-296-spec.md §5.1 F-1 window rule 3 / §5.2 E-18 ("before any read or write")
   Gap: The refusal is stated as happening "before any read", but the declaration
   must be read to know the trigger set is event-only; TC-064 sensibly asserts the
   mechanically real form (zero declared-input reads, zero state reads, zero writes,
   zero records) and treats the declaration read as permitted (OQ-T9). The spec
   wording literally contradicts what the binding TC asserts.
   Suggested remediation target phase: specification
   Suggested fix: Reword F-1 rule 3/E-18 to "before any declared-input read, state
   read, or write" (or "after the declaration read, before any other read or write").

4. [nit] plan_coverage — chg-GH-296-plan.yaml Phase 1 summary line
   Gap: Phase 1's summary claims it "delivers AC-F2-1..AC-F2-4", but AC-F2-1's
   Given is the six built-in declarations, which land in Phase 5; Phase 5 claims
   "the AC-F2-1 completion". Unlike iteration-1 finding 5 the split is declared in
   both summaries' parentheticals, so this is wording residue of the same class,
   not a silent boundary error.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Reword the Phase 1 summary to "delivers AC-F2-2..AC-F2-4 and the
   declaration half of AC-F2-1 (completed in Phase 5)" alongside finding 2's edit.

5. [nit] test_traceability — chg-GH-296-test-plan.md §1.2 GAP-1/GAP-7 and §7.1 preamble
   Gap: The test plan still marks the plan-side TC-061..064 map entry as PENDING
   (GAP-7: "the plan must add those four ids"), but the plan has been corrected —
   its map owns all 64 ids and its Phase 1/3 summaries were updated (the plan header
   records GAP-1/GAP-7 as satisfied). The stale status contradicts the plan and will
   confuse the phase-10 DoD evidence read.
   Suggested remediation target phase: test_planning
   Suggested fix: Mark GAP-7 satisfied (record the plan correction landed, map
   counts 60 → 64) in the same revision that applies finding 1's TC-062/CU-02
   alignment.

## Gate result

NOT_READY. The iteration-1 remediation is real, not reworded: all six findings are
resolved on their merits (verified against current truth where the remediation added
new claims), traceability is closed (49/49 ACs, 9/9 DMs, 14/14 NFRs, 64 TCs each
owned by exactly one plan phase, both maps agreeing), the plan validates, and the
new `scopeKey`/trigger/window vocabulary neither contradicts a delivered contract
nor duplicates one. One new blocking hole remains, created by the remediation
itself: the non-counting rule for explicit runs is composed with the catch-up
missed-window arithmetic in two mutually exclusive ways across the spec and the
binding test rows (finding 1), and the coder would have to pick a side — the exact
failure mode this gate exists to prevent. Reopen `specification` for finding 1
(and finding 3 in the same pass), with the finding-1 test_planning follow-up;
findings 2 and 4 are a `delivery_planning` correction; finding 5 rides the
test_planning pass. No human input required; no pause. Iteration cap note: this is
iteration 2 of ~3; the remaining gap is narrow and localized, so one further
remediation cycle should close it.
