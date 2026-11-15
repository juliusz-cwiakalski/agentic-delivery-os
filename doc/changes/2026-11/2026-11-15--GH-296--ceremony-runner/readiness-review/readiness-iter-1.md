# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-296
Date: 2026-11-15
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
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Scope of this review

Ticket #296 read via tracker; spec (928 lines), test plan (60 TCs), plan.yaml (11
phases), and pm-notes read in full. Delivered-contract claims verified against
current truth, not taken from the spec: documented error table = 136 identities;
reserved two-segment allowlist = 52 (sum of the per-kind counts in
feature-result-contract.md); `ceremony.note-invalid` is two-segment (one dot) so
52 -> 53 is correct and `ceremony.declaration.invalid` (three segments) needs no
allowlist entry; `PLAN_KNOWN_TIERS = [full, lite]`; `PM_NOTES_REQUIRED_PHASES_BY_
VARIANT.lite` matches the spec's six-phase set element for element;
`PROMPT_REQUIRED_COMMANDS` has exactly 20 entries; retro registry R2-R5 are
`declared` owning M2-S3 with triggers matching F-9 exactly (session-end /
incident-severity / daily / milestone-end) and R1 implemented at closeout;
`delivery.brief.v1` ten surfaces / three anchor groups / two-entry placeholder
catalog / 65 536-byte bound as cited; `MET-CEREMONY-SHARE` value `0.406648`,
status `PARTIAL`, comparison protocol (same ID + definition over equal-length
window) as cited; measurement log `schema_version: 1` with no `comparisons` key
(additive target); backlog M2-S6 `Depends on: M1-S19, M2-S3, M2-S14` so the
metrics-surface deferral (NG-1) is consistent with the dependency graph;
registry `ados ceremony` row names the same six built-ins; delivered identities
(`fallback.invocation`, `input.value.rejected`, `config.file.malformed`,
`state.store.torn`/`unknown`, `state.permission.denied`) all exist; state-layer
artifact-boundary factory and file-artifact-not-state-record patterns support
DM-5/DM-6; every plan-declared existing path exists; `plan validate GH-296`
returns `verdict=valid`, `readyForDevelopment=true`.

Ticket coverage: all four ticket ACs are addressed (AC1 -> F-8/AC-F8-2/3 with an
honest `insufficient-sample` at n=0 per DEC-14 and OQ-T2; AC2 -> AC-F3-1/AC-F2-1
via one parametric parity suite with per-built-in negative cases; AC3 ->
AC-F6-1/TC-030 declaration-document-only; AC4 -> F-9 covers all five retro
requirements with the note schema matching retrospectives.md verbatim). All six
required built-ins are present as declarations. 60 TCs are each owned by exactly
one phase (count verified: 5+1+7+4+16+3+7+2+6+6+3 = 60); 45/45 ACs, 9/9 DMs,
14/14 NFRs, and both inherited seeds traced; the one evidence-only half
(AC-NFR14-1) is honestly declared (GAP-5). Decisions are captured (DEC-1..15 +
two pm-notes decisions; OQ-1..3 adopted by plan authoring as the spec
authorises, recorded in the plan header). DoD-1..14 are defined and testable.

## Findings

1. [major] spec_completeness — chg-GH-296-spec.md §5.1 F-4 (Intake) / DM-2 / §23 glossary
   Gap: The run identity `(ceremony, scopeKey, window)` is load-bearing (F-4.1,
   DM-3, NFR-5, E-4, AC-F4-6), but the scope key is sourced only from the note
   (DM-2: "required by every note-consuming ceremony"; DEC-7: "the ceremony note
   is the idempotency anchor"). Four of six built-ins require no note
   (morning-brief, sprint-rollover, night-watch, decision-record-mirror-sync),
   and a project declaration may be note-less (TC-030's fixture is). The
   glossary says the scope key is "declaration-supplied", yet the F-2 declaration
   member set has no scope-key member. Nothing defines the scope key for
   note-less runs, so the coder must invent the idempotency semantics of the
   majority of the built-ins (does a second morning-brief in one window reuse?
   does a mirror sync dedupe across invocations?). Knock-on: AC-F4-6/TC-025 is
   exercised only on a note-consuming ceremony, so the hole is invisible to the
   suites as planned.
   Suggested remediation target phase: specification
   Suggested fix: Define the scope-key source for note-less declarations as a
   declaration member (e.g. a fixed `scopeKey` on the declaration, or a declared
   derivation rule such as the repository identity), pin it in F-2/DM-1/DM-2,
   and extend the intake rule; then add a note-less idempotency case to the test
   plan (test_planning follow-up in the same cycle).

2. [major] cross_artifact_consistency — chg-GH-296-spec.md §5.1 F-3 table (retro-evidence-pass trigger cell) vs F-9/DEC-4 and chg-GH-296-test-plan.md TC-CEREMONY-014 step 4
   Gap: F-3 declares the retro-evidence-pass trigger as "event `change-merged`
   plus the four level triggers", but F-9 and DEC-4 state R1 (change level)
   stays closeout's own retro, the delivered registry maps no sub-R1 level to
   `change-merged` (R2=session-end, R3=incident-severity, R4=daily,
   R5=milestone-end), and TC-014 step 4 asserts R1 "is not produced by this
   declaration". A `change-merged` firing therefore has no defined level and no
   defined output — unspecified behaviour in the declared data. Related: the spec
   never states which declared trigger an explicit `ceremony run` records (F-2
   "A run records the one trigger that fired" presumes a firing mechanism that a
   manual invocation does not have; AC-F3-3 expects the level's trigger to be
   recorded).
   Suggested remediation target phase: specification
   Suggested fix: Remove `change-merged` from the retro-evidence-pass declaration
   (or define exactly what a change-merged-triggered run produces without
   touching R1), and state the trigger-resolution rule for explicit runs (e.g.
   the note's level resolves its declared trigger; schedule/catch-up kinds
   otherwise). Mirror the resolution in TC-CEREMONY-014 if a new case is added.

3. [major] spec_completeness — chg-GH-296-spec.md §5.1 F-1 ("Window precedence")
   Gap: "when no note is required, `--window` supplies the window and its
   omission uses the trigger's declared window" — an event trigger
   (`{ kind: "event", event: "pre-dispatch" }`) declares no window. For
   `decision-record-mirror-sync` (event-triggered, note-less, the highest
   blast-radius built-in) an invocation without `--window` has no defined
   window, so the run identity and its dedupe semantics are undefined (every
   invocation a new identity, or reuse?).
   Suggested remediation target phase: specification
   Suggested fix: Define the fallback window for note-less event-triggered runs
   (e.g. an invocation window derived from the injected clock, or a required
   `--window` for such declarations refused via `input.value.rejected`), and add
   the case to the F-1 rule and the note/window intake edge cases.

4. [minor] cross_artifact_consistency — chg-GH-296-spec.md §5.1 F-2 (`triggers[]` 1..8) vs DM-1 and chg-GH-296-test-plan.md TC-CEREMONY-009
   Gap: F-2 bounds triggers at 1..8, but DM-1's bound list omits the trigger
   count and TC-009's bound ladder (16/17 ceremonies, 12/13 phases, 32/33
   steps, 16/17 inputs, 8/9 targets, 1 MiB, id 64/65) has no 8/9-trigger rung,
   so the one bound is declared twice inconsistently and tested zero times.
   Suggested remediation target phase: test_planning
   Suggested fix: Add the 8/9-trigger rung to TC-009's generated bound ladder
   and restate the trigger bound in DM-1 so the spec states it once.

5. [minor] plan_coverage — chg-GH-296-plan.yaml Phase 8 summary line
   Gap: Phase 8's summary claims it "delivers AC-F8-1..AC-F8-3", but AC-F8-1's
   only TC (TC-CEREMONY-040) is owned by Phase 2 per the TC -> PHASE map
   ("every id is owned by exactly one phase"). Phase 8's TC set is 041..042
   (AC-F8-2/AC-F8-3). Coverage is complete; the summary over-claims the phase
   boundary, which will disagree with per-phase DoD evidence at phase 10.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Correct the Phase 8 summary to "delivers AC-F8-2..AC-F8-3"
   (AC-F8-1 delivered in Phase 2).

6. [nit] system_spec_consistency — chg-GH-296-spec.md §13 (Dependencies)
   Gap: The spec's "Blocks | Retro action registry (M2-S10)" row asserts a
   dependency edge the planning truth does not record: the backlog's M2-S10
   entry declares `Depends on: M1-S8` only. The exclusion boundary itself
   (NG-2/§7.2) is consistent with the ticket and the backlog; only the
   blocks-claim overstates the recorded graph.
   Suggested remediation target phase: specification
   Suggested fix: Reword the §13 row as "feeds (dependency not yet recorded in
   the backlog)" or record the edge in the backlog progress line Phase 11
   already updates (Appendix C #15).

## Gate result

NOT_READY. Reopen `specification` for findings 1-3 (and 6 in the same pass);
finding 4 requires a `test_planning` follow-up (bound-ladder rung plus the
note-less idempotency case from finding 1), finding 5 a `delivery_planning`
summary correction. No human input is required; no pause. The mechanical quality
of the artifact set is high — plan validate green, all traceability matrices
closed, all delivered-contract citations verified against current truth — and
none of the findings touch delivered contracts; all three blocking findings are
contract-detail holes inside the new ceremony declaration/intake rules that
would otherwise force the coder to invent product behaviour during delivery.
