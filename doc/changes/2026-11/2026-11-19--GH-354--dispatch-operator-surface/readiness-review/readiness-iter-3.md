---
title: "GH-354 readiness review — iteration 3 (final)"
work_item: GH-354
change: dispatch-operator-surface
iteration: 3
date: "2026-11-19"
verdict: READY
reviewer: readiness-reviewer
artifacts_reviewed:
  spec: chg-GH-354-spec.md (v1.4)
  test_plan: chg-GH-354-test-plan.md (v0.3, 72 cases, 83 AC links across 59 cases)
  plan: chg-GH-354-plan.yaml (8 phases: 1 planning + 7 delivery; 72 owned case ids; 68 mutation rows)
  pm_notes: chg-GH-354-pm-notes.yaml
  decision_record: TDR-0056 (status `Proposed`; human owner accepts at PR review)
  ticket: GitHub issue GH-354 (read via `gh issue view 354`; six tasks, four ACs)
  prior: readiness-review/readiness-iter-1.md, readiness-review/readiness-iter-2.md
scope_note: >-
  Findings are stated against the versions above. Iteration 2's blocking set was
  N1–N3; this iteration verifies their closure, hunts for defects the remediation
  introduced, re-checks the ticket, and re-checks the five artifact-level
  contradictions. Residual non-blocking items are recorded, not treated as gates.
---

# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-354
Date: 2026-11-19
Pause Required: no

Iteration 2's three blocking findings (N1–N3) are closed at the text. Recomputed
counts all sum. No case id has two owners or none, no phase gate runs a case it
cannot make green at its own boundary, no AC changed meaning, and the ticket's
six tasks and four ACs are all covered. Eight non-blocking residuals remain
(R1–R8); none makes an AC untestable or a phase boundary red, and each has a
one-line fix that can ride delivery or the review. Delivery is not blocked.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS (with R1, R3 recorded as non-material: the
  delivery-authoritative artifacts — spec and plan — state the correct contract;
  the surviving inversions are in test-plan notes and a `log`-row summary)
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Recomputed totals (verified, not trusted)

- Test plan: 72 `#### TC-*` detail headings, 0 duplicate ids; groups MATRIX 2,
  STATUS 8, LOG 11, ISDEL 7, MSG 10, GRAMMAR 5, PERSIST 11, RO 4, SHELL 4,
  CONTRACT 3, NFR 4, FIXTURE 3 = 72; §5.1 index has the same 72 ids, no
  difference in either direction. §3.1: 38 AC rows, 83 links, 59 distinct cases,
  45 extras — all three reproduce; the 13 unlinked cases are exactly the set
  named at line 138; no linked case is missing a detail heading.
- Plan case ownership: phase 1..8 = 0/15/9/13/10/6/19/0 = 72, sets disjoint
  (no id in two phases, none unowned). AC ownership 0+12+4+6+7+4+5+0 = 38.
- Plan mutation allocation: 68 rows M1–M68 contiguous with no gap; per-phase
  0/15/11/13/8/6/15/0 = 68 (phase 7 = M23 + M39 + M54–M59 + M60–M63/M66–M68 =
  15). Every row names at least one case that exists (no dangling case id).
- Test plan §7.4 mutation register: 68 rows, contiguous, same ids as the plan.

## Closure of iteration-2 blocking findings

| # | Finding | Verdict | Where checked |
|---|---|---|---|
| N1 | `TC-PERSIST-009` had no declared home in phase 4 | **CLOSED** | plan phase 4 `scope.files` line 1350; phase-4 code-area note 1269-1273; `SHARED-FILE NOTE` 11 (508-514); phase-4 gate 1313; test plan `TC-PERSIST-009` 1703-1730 |
| N2 | `TC-PERSIST-011` was phase-3-owned but needed `dispatch log` | **CLOSED** | plan case map 341-404 (phase 3 = `TC-PERSIST-001..008, 010`; phase 4 = LOG-001..011 + PERSIST-009/011); phase-3 contract 1127-1134 and gate 1146-1150 (no `dispatch log` step); test plan index row 268, `Plan Phase(s)` 1765, step 4 1781, Notes 1790, §7.3 2407-2409 |
| N3 | `TC-PERSIST-005/006` had three different case-id owners | **CLOSED** | test plan §5.1 rows 262-263, `Plan Phase(s)` 1583/1620, Notes 1613/1648, §7.1 2350/2354, §7.3 2391/2405, revision log v0.3 2668; plan `SPLIT CASES` 373-404 and AC ownership 352-372. The false claim "exactly as the test plan's v0.2 labels record" is gone (no match in the plan) |

Detail on N3: the plan and the test plan now say the same thing in the same
words — the ids are phase-3-owned, the write half is asserted at the phase-3
boundary, and the read-back half is executed at the phase-4 boundary as a
cross-control that owns no id. Phase 3 still carries the nine writer cases and
phase 4 the thirteen log-phase cases plus the two read-back halves, and neither
artifact presents the read-back execution as a second owner.

Other iteration-2 items: finding 5 (`TC-LOG-007` scope) CLOSED — both the
32 768-byte `bytes` fixture and the 200-line `tail` fixture are declared
(741-775). Finding 4 (M25) CLOSED — the register row names only
`TC-ISDEL-006`/`TC-STATUS-008` (2453) and the plan allocates it to phase 2, the
phase that owns both. Finding 8 (naming input) CLOSED at the record level —
TDR-0056 DR-4 (204), DC-2 (369) and its change note (475) now name the stream
kind / explicit stream ordinal. Finding 11 partially fixed but not closed (R6).
Findings 6, 7, 9, 10 are not closed (R1, R4, R5, R7).

## Defects introduced or left by this remediation

No new blocking defect. No phase gate is miswired: phase 3's gate runs only the
writer suites and the persist cases it owns, phase 4's gate runs the log suites
and the persist file whose two remaining cases it authors, and phase 7's sweep
runs the earlier phases only as read-only controls. Nothing was found that makes
a boundary red. The items below are recorded so they are not lost.

### Non-blocking

1. [major] cross_artifact_consistency — `chg-GH-354-test-plan.md` §8.3 item 5
   (line 2658) against spec API-9 (252), DM-3 (267), F-4 (134) and Appendix D
   (644). **Persistent (iteration-2 finding 9, spec half closed).**
   Gap: the open question still says Appendix D requires the per-adapter read
   bounds "to sit below the declared message bound". Appendix D now says the
   opposite (the read cap "is not a cut below 512 characters"); a cap actually
   set below 512 would truncate the stored text before the query redacts, which
   is the pre-redaction cut iteration-1 F1 closed, and §8.3 itself concedes the
   fixture is "sized to fit any declared cap", so no case would catch it.
   Materiality: the spec (authoritative) and the plan's phase-5 contract carry
   the correct order, and the case defers to "spec Appendix D", so no AC becomes
   untestable and no gate is red; the sentence is wrong and should not survive.
   Suggested remediation target phase: test_planning
   Suggested fix: delete the clause "while requiring them to sit below the
   declared message bound" and state that the adapter's storage cap must be at
   least the message bound (and the credential length), so the query's
   post-redaction cut is the only cut.

2. [major] plan_coverage — `chg-GH-354-plan.yaml` MUTATION REGISTER ALLOCATION
   (410-450), phase 2 gate (976), phase 7 gate (1763). **Pre-existing, surfaced
   by the row-by-row check this iteration.**
   Gap: the stated rule allocates a multi-phase row "to the phase owning the LAST
   boundary among them ... so the row can be exercised exactly as written". Four
   rows break it: M1 names `TC-STATUS-001` + `TC-RO-002` + `TC-SHELL-004`, M4
   names `TC-STATUS-004` + `TC-RO-001`, M10 names `TC-STATUS-007` + `TC-RO-004`,
   and M24 names `TC-ISDEL-002` + `TC-MATRIX-001` — all four are allocated to
   phase 2, and phase 2's gate declares them exercised there, although their
   phase-7 cases do not exist yet; phase 7's gate (M23, M39, M54–M63, M66–M68)
   never re-exercises them. The totals still sum (0/15/11/13/8/6/15/0 = 68)
   because the four rows are counted in phase 2, and each row keeps at least one
   phase-2 named case that fails, so no boundary is red and no invariant loses
   its non-vacuity (M55 covers the same phase-7 property).
   Suggested remediation target phase: delivery_planning
   Suggested fix: either move M1/M4/M10/M24 to phase 7 (totals become
   11/11/13/8/6/19 = 68) and keep their phase-2 cases as cross-controls, or add
   one sentence stating that a row whose named cases span phases is exercised at
   the first boundary where its load-bearing case exists, with the later cases
   re-observed in their own phase.

3. [minor] cross_artifact_consistency — `chg-GH-354-test-plan.md`
   `TC-LOG-004` Notes (line 689). **Persistent (iteration-2 finding 6).**
   Gap: `no-log` is still glossed as "this adapter streams nothing for `log`" —
   the single-cause pre-v1.4 reading — while the case's own rows (a) pre-change
   lane and (b) one-shot lane and (c) never-laned ref assert the two-cause
   answer. The behaviour is right; only the sentence contradicts spec F-2, AC-F2-3,
   §8.5, §10, RSK-17 and the glossary.
   Suggested remediation target phase: test_planning
   Suggested fix: align the Notes to "`no-log` means no artifact exists for this
   ref, with its two named causes".

4. [minor] cross_artifact_consistency — plan `SOURCES` header (12, 20) and phase-3
   contract (1053). **Persistent (iteration-2 finding 7, test-plan half closed).**
   Gap: the plan still cites `chg-GH-354-spec.md (v1.3)` and
   `chg-GH-354-test-plan.md (v0.2)`; the artifacts under review are v1.4 and
   v0.3, and the numbers quoted beside the versions are unchanged, so only the
   labels are stale. Test plan §2 now cites v1.4 as reported.
   Suggested remediation target phase: delivery_planning
   Suggested fix: update the three version references.

5. [minor] test_traceability — `chg-GH-354-test-plan.md` `TC-PERSIST-009`
   (1703-1730, index row 266, §7.3 row 2390). **Newly noticed.**
   Gap: this is the only moved case with no `Plan Phase(s)` field and no
   phase-4 note in §7.3 (011 has one, 005/006 have one). The plan states
   phase 4 twice, so ownership is not ambiguous in the delivery artifact, but a
   coder working from the test plan's file map could author the case into the
   phase-3 file creation and turn the phase-3 gate red — the exact N1/N2 class.
   Suggested remediation target phase: test_planning
   Suggested fix: add `Plan Phase(s)`: phase 4 (reader tear rule) and annotate
   the §7.3 row like `TC-PERSIST-011`'s.

6. [minor] test_traceability — `chg-GH-354-test-plan.md` `TC-MATRIX-001`
   preconditions (306-308). **Persistent (iteration-2 finding 11).**
   Gap: the preconditions give a resolvable transcript only for the terminal
   seed, while the expected outcome requires the live row's `last-message` to
   answer `available=true, final=false` at exit 0. Without a resolvable
   transcript for the active lane's session the ladder answers
   `session-unknown` at exit 1. A nit that will surface at implementation.
   Suggested remediation target phase: test_planning
   Suggested fix: state that the active lane's session id also resolves a
   transcript (a partial/mid-write variant).

7. [nit] test_traceability — `chg-GH-354-test-plan.md` `TC-PERSIST-008` (1698).
   **Persistent (iteration-2 finding 10).** "Exactly one append per yielded
   value (40 writes for 40 values)" still does not say all 40 values fit the
   current file, which is what makes one append per value true under API-8's
   multi-append rule for an oversized value. Suggested remediation target phase:
   test_planning.

8. [nit] cross_artifact_consistency — `TC-FIXTURE-001` step 2 forbids "a local
   stitch/split/tail loop", while the phase-3 write half must assert "the
   concatenation of the files in name order equals the declared transformation"
   (test plan 1599/1608; plan 386-392) and M47's named failure is a
   concatenation diff — and the reader seam that would perform the stitch does
   not exist until phase 4. Suggested remediation target phase:
   delivery_planning (one sentence distinguishing a raw byte comparison over the
   writer's own files from a reimplementation of the reader's selection/
   truncation decision), or test_planning (scope the scan's wording).

Also noted, not findings: spec §19 (523) still calls Appendix C "the
authoritative statement of what each query answers" while the `log` row carries
neither the one-fact rule nor the precedence (iteration-2 A3 residual), and
F-7/DM-2/Appendix D still offer "stream kind ... or an explicit stream ordinal",
which TDR-0056 now also records, so the spec-vs-record divergence is gone even
though the input set remains a sanctioned pair rather than one choice.

## Did any AC change meaning while keeping its id?

No. The spec is unchanged at v1.4 and all 38 ids reconcile against §17 by
feature (7/6/5/7/4/5/4). The v0.3 change moved `TC-PERSIST-011` between phases
and re-labelled 005/006 without touching an AC link: §3.1 still carries 38 rows,
83 links and 59 cases, and every AC keeps its owning phase in the plan
(0+12+4+6+7+4+5+0 = 38). The two ACs whose evidence now straddles phases are
declared rather than silently re-owned: AC-F7-3 stays phase 3's through
PERSIST-002/005/006/008's write clauses, and AC-F2-6 stays phase 4's through
LOG-002/009 plus the read-back halves the plan names explicitly.

## Ticket check (GitHub issue GH-354: six tasks, four ACs)

| Ticket requirement | Verdict | Evidence |
|---|---|---|
| Task: per-ref `status` (delivering, pid, session id, stale, marker) | PASS | F-1; AC-F1-1..7; DM-1/DM-5; `TC-STATUS-001..008` + `TC-MATRIX-001` status rows (phase 2) |
| Task: per-ref `log` with bounded tail | PASS | F-2; AC-F2-1..6; API-2/API-7; `TC-LOG-001..011`, `TC-PERSIST-009` (phase 4) |
| Task: `is-delivering` query | PASS | F-3; AC-F3-1..5; DEC-1 two forms; `TC-ISDEL-001..007` (phase 2) |
| Task: `last-message` from the persisted session transcript | PASS | F-4; AC-F4-1..7; DM-3; `TC-MSG-001..010` (phase 5) |
| Task: persist harness stdout per ref during a dispatch | PASS | F-7; AC-F7-1..4; API-8; DM-2; `TC-PERSIST-001..008, 010` (phase 3) + 009/011 (phase 4) |
| Task: one family with `--json` | PASS | F-5; AC-F5-1..4; API-5; `TC-GRAMMAR-001..005`, `TC-CONTRACT-002` (phase 6); help entries 5→9 |
| AC 1: four queries answer for a live dispatch | PASS | AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-3 (`TC-MATRIX-001` live row, both modes) |
| AC 2: four queries answer for a finished dispatch | PASS | AC-F1-2, AC-F2-1, AC-F3-2, AC-F4-1 |
| AC 3: four queries answer for an absent ref | PASS | AC-F1-3, AC-F2-3, AC-F3-2, AC-F4-4 |
| AC 4a: the log is bounded and reference-scoped | PASS | AC-F2-1/5/6; NFR-3/4; 1 048 576 per file by segmentation, 2 × cap family, 1..500 tail, one truncation fact, 0 foreign lines |
| AC 4b: `last-message` is the PM's final message, not a classifier sentence | PASS | AC-F4-1/2/7; the seam returns raw stored text, the query composes |
| AC 4c: no shell script is read or executed | PASS | F-6; API-12; AC-F6-2..5; `TC-SHELL-001..004`, `TC-RO-002/003`, shell-absent `TC-SHELL-003` |

The two declared scope reductions (Claude Code `capability-gap` for
`last-message`; one-shot adapter `no-log` for `log`) remain consistent with the
ticket's "depends on GH-347" and its persistence task, and are stated in F-4,
F-7, §8.4, §8.5 and Appendix B. No ticket requirement is unmet or silently
narrowed.

## The five artifact-level contradictions

| # | Contradiction | Verdict | Where checked |
|---|---|---|---|
| 1 | Seam bounds the message vs the query bounds it | PASS with R1 | spec F-4/API-9/DM-3/Appendix D/AC-F4-7 all say the seam returns raw text under the adapter's own read cap and the query composes redact → flatten → bound → mark; the plan's phase-5 contract says the same. The only inverted statement is the test-plan §8.3 note (R1) |
| 2 | Per-file vs per-stream LF rule | PASS | Stated over "the concatenation of one stream's files in name order" with the single oversized-value exception in F-7, DM-2, AC-F2-6, AC-F7-3, §21, glossary; plan 373-404; test plan 1599/1608 and M47 |
| 3 | Fold before filter vs filter before fold | PASS | Filter-first is normative in F-1, F-3, API-6, DM-1, NFR-4, AC-F1-6 and the plan's phase-2 contract; the test plan asserts both directions with a shared `dispatch.lanes:<ref>` fixture (`TC-STATUS-006` 489-521, `TC-ISDEL-007` 1039-1056); M3 is the register row that catches the inversion |
| 4 | What `no-log` means | PASS with R3 | Spec, plan (constraint 7, RSK-17, M53) and every `log` case row agree on "no artifact exists for this ref" with two named causes; the test plan's `TC-LOG-004` Notes carry the old one-cause gloss (R3) |
| 5 | One-shot scope | PASS | F-7, AC-F2-3, AC-F7-1, §8.5, §16, §20, glossary; plan constraint 7 and M53; test plan `TC-PERSIST-004` (1550-1576), `TC-LOG-004` row (b), §1.2 |

R1 and R3 are word-level inversions confined to test-plan prose; the spec (the
authority) and the delivery plan do not carry either, and no case's rows encode
the wrong rule. They therefore do not fail the cross-artifact facet on
materiality, but they should not be carried into the review unremarked.

## Residual risks the human decider inherits

- **TDR-0056 is `Proposed`** after four REWORK-challenged rounds (no PASS
  claimed). It is the binding design of this change; acceptance is the owner's
  at PR review. DR-4/DC-2 now carry the stream-kind/stream-ordinal naming input
  (R8's underlying gap is closed at the record).
- **The read cap is implementation-decided and no case pins it** (R1). The spec
  forbids a cut below 512; nothing in the battery proves it, so the guarantee
  that a credential cannot be exposed as a pre-redaction prefix rests on the
  coder obeying Appendix D and the reviewer checking it.
- **The proof boundary is fixtures, not live storage**: opencode
  `current`/`legacy` generations only (RSK-15), injected probe verdicts (no
  kernel semantics), scripted streaming, planted torn tails, no real snapshot
  race, no real disk-full or `0600` enforcement (Appendix C, §1.2).
- **Declared divergence, not parity**: the typed tail is the harness's own
  stdout (opencode JSON events); the shell's `--log` tails the child's stderr and
  the wrapper's progress lines reach the terminal (RSK-12; phase 6 page,
  operations guide, and lifecycle doc phase).
- **Claude Code lanes** answer `capability-gap` for `last-message` and `no-log`
  for `log`; no page may claim general harness support.
- **Redaction covers registered credential values only**; prose and
  harness-printed values pass through within the bound (RSK-18).
- **Two-file retention** can lose the start of a long run (one truncation fact,
  RSK-14/21) and same-ref concurrency can evict a still-growing older stream's
  evidence (RSK-20).
- **One undecided reading is carried by the test plan, not the spec**: a ref
  delivered by opencode and later by Claude Code would have an artifact
  directory but no new stream (`no-log` vs the existing family). No AC covers
  it; the coder records the reading (test plan §8.3 item 4).
- **The mutation register is a reviewer instrument, not a committed gate:** four
  rows are allocated ahead of their phase-7 cases (R2); the property still has a
  non-vacuous phase-7 mutation (M55), but a reviewer should not treat the phase-2
  gate line as proving all three named cases.
- **Operational prerequisite**: `TMPDIR=$PWD/tmp/tmpdir`,
  `PATH=$PWD/node_modules/.bin:$PATH`, and `pnpm build` before any `jaiship`
  invocation or primitive call.

## Remediation routing

- test_planning: R1, R3, R5, R6, R7 (and R8 if the scan's wording is scoped
  there)
- delivery_planning: R2, R4 (and R8 if stated in the plan)
- specification: none required (R1's spec half is already fixed)
- delivery: not a remediation target for any finding.

No pause flag and no human input are required for this gate. This is iteration 3
of the 3-iteration cap; the gate closes READY, and R1–R8 are bounded residuals
for the coder/reviewer, not re-opened artifact phases.
