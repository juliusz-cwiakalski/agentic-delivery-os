# Readiness Review Iteration 2

Verdict: **NOT_READY**
Work Item: GH-266
Date: 2026-11-08
Pause Required: no

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: **FAIL** (finding 7 partially closed; new finding N3)
- test_traceability: PASS (minor findings N2, N4)
- cross_artifact_consistency: PASS (minor finding N2)
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS (nit N7)
- dod_defined: PASS

Finding 1, 2 and 3 are **closed**. The remaining blocking gap is finding 7: the new P1 backlog corroboration gate is file-wide, so a partial M1-S9 corroboration/insufficiency defect still reaches P2's `p08`, whose declared phase scope is `status.md` only. This is small and fixable, but it is the exact phase/scope condition the round asked to verify, and the plan claims finding 7 closed without an accepted residual.

## Per-Finding Closure Table

| # | Iteration-1 finding | Status | Evidence at the original site |
|---|---|---|---|
| 1 | Missing AC for "no other story AC/dependency modified"; RSK-8 cited a non-existent AC | **CLOSED** | Spec §17 AC-F5-3, §5.1 F-5, §11 RSK-8 now all reference the same AC. Test plan TC-GATE-018 / §7.1 P15 implement hunk confinement plus a full other-story `- AC:`..`- Depends on:` comparison. Plan P1 task 1.6 and the P1 `p15` gate bind it. I ran the P15 logic on the plan's reference amendment: 2 hunks, both inside; 66 other stories compared, byte-identical; the M1-S8 negative control detected. Minor boundary defect recorded as N1 below. |
| 2 | TC-GATE-004 claimed other-story preservation its steps did not check | **CLOSED** | TC-GATE-004's expected outcome now ends "Both phase markers remain"; its note explicitly says it makes no other-story claim and that TC-GATE-018 owns containment. P4 no longer claims it. TC-GATE-018/P15 is the replacement oracle. |
| 3 | Plan task 1.1 vs 1.5 disagreed on the connective; no gate caught the broken grammar | **CLOSED** | Task 1.1 now says "Replace the whole anchor with the reference text in task 1.5, VERBATIM"; 1.5 starts with "requires the resident daemon live (M1-S18) and the evidence-based clean bar met." P1's plan-added connective gate greps the flattened backlog for that sentence and for the absence of "and the evidence window elapsed". I reconstructed the replacement: the sentence is grammatical and both greps pass. |
| 4 | P7c normalised whitespace while AC-F2-3 claimed byte identity | **CLOSED** | TC-GATE-008/P7 now extracts the 2026-11-03 section, the M0 lead-in, and the three numbered statements and `cmp`s each without normalisation, plus the P7d reflow negative control. I ran P7 on the base tree: `2026-11-03 section byte-identical`, `lead-in byte-identical`, statements 1/2/3 at 213/72/582 bytes, `negative control: reflow detected`, `P7 verdict: OK`. Minor stale-reference finding N2 relates to a different sentence set. |
| 5 | The forbidden-literals guard never scans `backlog.md`; half of AC-NFR5-1 was vacuous | **CLOSED, accepted residual N-1** | TC-GATE-014 now records the guard's registered-doc scan set and adds P17, which imports the production `matchSeedLiteral` and scans added lines under `doc/planning/oss-tooling/` with a non-vacuity guard and matcher self-tests. PM notes record the acceptance as a decision dated 2026-11-08; test plan OQ-5 proposes the follow-up AC wording. The acceptance is legitimate and disclosed, not a hidden finding. |
| 6 | P2 omitted `p00`, relying on P1's base snapshots | **CLOSED** | P2's `testGate` now begins with `p00.sh` ("re-materialise the base inside P2; readiness finding 6"). |
| 7 | P1 omitted the backlog corroboration check, so P2 `p08` could fail on a backlog defect P2 cannot fix | **PARTIALLY CLOSED** | P1 now has a plan-added backlog corroboration gate, but it is **file-wide**, not M1-S9-scoped. On the base backlog `pm-notes` occurs 8 times, `tracker state` 2 times, and `never sufficient` at line 464; only `CI on the pushed head` is unique to the amendment. A coder who omits the insufficiency rule from the M1-S9 region but keeps the sources (and the unique CI literal) passes P1, then fails P2's region-scoped `p08` on the backlog. P2's declared scope is still `status.md` only. See N3. |
| 8 | AC-NFR1-1 said "exactly two files" but the branch necessarily contains `doc/changes/**` | **CLOSED** | NFR-1 and AC-NFR1-1 now say "exactly two product files outside `doc/changes/**`"; P1a measures exactly that with `:(exclude)doc/changes/**`; §4.1 metrics and DoD use the product-file wording. |
| 9 | The 2026-11-03 "per-engine handover ... never waived" bullet was left unadjudicated | **CLOSED** | DEC-10 and AC-F2-4 now adjudicate it as the same M1-S9 gate, superseded not waived, with the coverage and elapsed-to-floor reasons. The new status section states it; P16 `adjudication: missing=0`; P7a proves the dated section is byte-identical. It does not contradict AC-F2-2/AC-F2-3: the adjudication is additive in the new section and the dated bullet is untouched. |
| 10 | "no longer defined by elapsed time" conflicted with the retained 7-day floor | **CLOSED** | AC-F2-5 and the plan's reference text use "no longer defined by a calendar window alone"; P16 reports `calendar-window-alone=OK elapsed-only-phrase=ABSENT floor-scope=OK`. AC-F2-4's elapsed-to-floor reason and AC-F2-5 can coexist; the gates do not pull. Wording nit N5 below. |
| 11 | `CEO-D-073` was not locatable in the repository | **CLOSED** | DEC-11 and AC-F2-6 require the exact citation `CEO-D-073 (GH-266, 2026-11-07)`; P16 `citation: OK`. GH-266 exists, its `createdAt` is `2026-11-07T18:11:11Z`, and its body contains `## Owner directive (CEO-D-073)`. The prose `GH-####` citation style matches the planning docs; the parenthetical form is new but readable and resolvable. |
| 12 | Phase 3 scope omitted the readiness-review record | **CLOSED** | P3 `scope.folders` now declares `readiness-review` and `code-review`; both are under `doc/changes/**` and excluded by P1a. |

## New Findings

1. **[minor] plan_coverage / test_traceability — `chg-GH-266-test-plan.md` P15a hunk guard (`hunk_guard`, §7.1 P15)**
   Gap: The pure-deletion branch (`+c,0`) accepts `c <= e+1`. On the base entry `e=559`, so a deletion at `+560,0` — the next `### M1-S10` heading line — is classified `inside` even though AC-F5-3 defines the entry as ending at the line before the next `###` heading. I reproduced it: `@@ -560,1 +560,0 @@` prints `hunks: inside=1 outside=0` / `hunk confinement OK`. P15b independently catches a deleted next heading (the other-story extraction loses the M1-S10 block), so the combined P15 verdict still fails; the hunk-confinement sub-oracle is the imprecise part.
   Suggested remediation target phase: delivery_planning (with a test-plan note)
   Suggested fix: use `c <= e` for the `d=0` case (or document `e+1` as the insertion point explicitly), and add a boundary self-test for `+<next heading>,0`.

2. **[minor] cross_artifact_consistency — `chg-GH-266-plan.yaml` task 2.2**
   Gap: Task 2.2 still says the three forward-looking status phrases ("stories that do not touch dispatch are unconstrained", "requires its per-repository two-clean-weeks evidence", "remains the critical path for M0 exit.") are "byte-identical (P7c)". P7c v1.1 byte-compares the three numbered M0 exit-criteria statements, not these forward-phrase sentences. Those three phrases sit in the paragraph that receives the pointer; P6 only checks the paragraph contains `two-clean-weeks` and a pointer, and TC-GATE-007's manual read is the only check of their wording. The PM notes claim the stale P7/P14 expected strings were replaced; this parenthetical was missed.
   Suggested remediation target phase: delivery_planning
   Suggested fix: cite P6 plus TC-GATE-007's manual read for the forward phrases, or add a byte comparison of those three sentences; do not cite P7c.

3. **[major] plan_coverage — `chg-GH-266-plan.yaml` P1 `testGate` and P2 `p08`/`p10`**
   Gap: The P1 backlog corroboration gate is file-wide. `pm-notes` (8 occurrences), `tracker state` (2) and `never sufficient` (line 464) all pre-exist elsewhere in `backlog.md`; only `CI on the pushed head` is unique to the M1-S9 amendment. A partial M1-S9 corroboration/insufficiency defect therefore passes P1 and reaches P2's region-scoped `p08`, whose declared scope is `status.md` only. The same shape exists for `p10a`: it compares the `backlog.md` frontmatter in P2, while P1 does not run `p10a`. The plan's P1 `completionArtifacts` claim "TC-GATE-009 backlog half observed" and the PM note "so a backlog defect is fixable inside phase 1" are therefore overstated for these partial defects. This is the remaining reason for NOT_READY.
   Suggested remediation target phase: delivery_planning
   Suggested fix: make the P1 corroboration gate region-scoped (extract the `### M1-S9` section as P3/P8 do and grep there), and add `p10a` to P1 (or move TC-GATE-011 to P1) so every backlog check that can fail is in a phase whose declared scope can repair it.

4. **[minor] test_traceability — `chg-GH-266-plan.yaml` task 1.5 vs the test plan**
   Gap: Task 1.5 instructs the M1-S9 entry's Goal line, Ticket line, the `(a)` evidence-accrual clause, the "Handover flips ... (recorded, reversible)" sentence, and the "Covers the functions of ..." sentence to stay byte-identical, but no TC/oracle checks inside-entry preservation beyond the AC block, dependency line, and heading. P4a starts at `- AC:`; P15a permits hunks inside the entry. The ticket's "recorded" wording lives in the "Handover flips ... (recorded, reversible)" sentence and is not mechanically checked.
   Suggested remediation target phase: test_planning
   Suggested fix: add a `cmp` of the M1-S9 entry with the amended anchor excluded (or a grep for "recorded, reversible" and the Goal/Ticket lines), or narrow task 1.5 to what is actually verified.

5. **[nit] ac_quality — `chg-GH-266-spec.md` AC-F2-4 and plan task 2.4**
   Gap: "replaces elapsed calendar time with an exposure floor" is imprecise because the floor retains the `>=7 consecutive days` alternative. The gates are compatible and P16 passes; a reader can still read the reason as eliminating days. The spec's N-2 already records the wording constraint.
   Suggested remediation target phase: specification (optional)
   Suggested fix: "replaces the calendar-window definition with a composite exposure floor" (or equivalent), while keeping the exact "no longer defined by elapsed time" negative check.

6. **[nit] test_traceability — `chg-GH-266-test-plan.md` TC-GATE-020 step 5 / P16 negative control**
   Gap: The lead-in negative control says to replace `no longer defined by a calendar window alone` in a `/tmp` copy, but the reference text wraps that phrase as `calendar` / `window alone`; a naive single-line replacement is a no-op and the negative control then falsely looks positive. I reproduced the no-op and the corrected multi-line replacement.
   Suggested remediation target phase: test_planning
   Suggested fix: say to replace the phrase after flattening, or build the negative fixture as a one-line synthetic amendment (as the plan says was done for P16).

7. **[nit] plan_coverage — `chg-GH-266-plan.yaml` header D-12**
   Gap: D-12 says "P1 and P3 re-run P15 and P16 where cheap"; P1's `testGate` runs `p15` but not `p16`.
   Suggested remediation target phase: delivery_planning
   Suggested fix: drop P1 from the P16 clause.

## Judgments Requested

- **AC-F5-3 genuinely closes finding 1, with one boundary caveat.** The AC exists, RSK-8 no longer cites a phantom AC, and P15 implements both clauses (hunk confinement and other-story byte identity) with self-tests and a negative control. The only imprecision is the `d=0` upper-boundary allowance (N1); P15b catches a deletion of the next heading, so a bad change is still blocked. The hunk-confinement sub-oracle should be tightened, but finding 1 is substantively closed.
- **AC-F2-4 does not contradict AC-F2-2/AC-F2-3 or the byte-identical history rule.** The adjudication is additive in the new EOF section; the 2026-11-03 section remains byte-identical (P7a); the two forward statements keep their pointers (P6); the dated bullet is not edited. The "same gate, superseded not waived" reading is the intended adjudication of the apparent "never waived" conflict.
- **AC-F2-5 and AC-F2-4 can be satisfied simultaneously; the gates do not pull.** The lead-in says "no longer defined by a calendar window alone"; the adjudication says elapsed calendar time is replaced by an exposure floor. P16 requires `calendar-window-alone=OK`, `elapsed-only-phrase=ABSENT`, `floor-scope=OK`, and the six adjudication marker groups; the reference text passes all of them. The N-2 constraint ("keep `elapsed` in the reason") is correctly encoded.
- **AC-F2-6's citation is resolvable and consistent enough.** `GH-266` is the ticket in the same tracker, its `createdAt` is 2026-11-07, and its body carries the `CEO-D-073` directive. Planning docs already cite `GH-####` in prose without links; the parenthetical tracker-home/date form is a reasonable extension and DEC-11 explains it.
- **N-1 and N-2 are legitimate accepted notes, not hidden findings.** N-1 is recorded as a PM decision dated 2026-11-08, compensated by P17 (which uses the production matcher), and followed up in OQ-5. N-2 is a wording constraint that keeps AC-F2-4 and AC-F2-5 from pulling against each other. The guard-scope limitation is real but cannot be fixed in this change without touching `scripts/**`; the disclosure is honest.
- **The D-6/P6 pointer-shape reconciliation is legitimate.** P6 accepts `CEO-D-073` as a pointer marker, but the authoring rule (D-6) keeps the pointers free of that literal so P5/P16 select the amendment section. The reference text uses "superseded"/"supersedes" and P6 sees `forward=2 pointed=2`. This is a documented superset, not an exploited loophole.

## Positive Verification Evidence

- I reconstructed the plan's v1.1 reference amendment in `/tmp` (backlog and status) and ran the literal/adapted procedures. Results: P2 `occurrences=0 unmarked=0`; P3 `conditions=4/4`, `floor-scope=OK`; P9 `tokens=11 missing=0 extra=0 duplicates=0`; P5 `residual-named=8`, `missing=0`; P6 `forward=2 pointed=2`; P8 `sources=3/3 insufficiency=OK` for both files; P14 `floor=OK` for both; P16 `adjudication: missing=0`, `calendar-window-alone=OK elapsed-only-phrase=ABSENT floor-scope=OK`, `citation: OK`.
- Base-revision falsifiability: P2 `occurrences=1 unmarked=1`; P3 `conditions=1/4`; P5/P16 `amendment: not found`; P6 `forward=2 pointed=0`; P9 `FAIL: enumeration paragraph not found`; P15 `backlog.md hunks: 0` + `P15 verdict: FAILED`; P17 `added-lines=0` + `seed scan exit=1`; P11/P12 green (81 in-scope docs; 5/5 classes, 0 violations).
- P7 byte counts confirmed: statement 1 `213 bytes, 3 lines`, statement 2 `72 bytes, 1 line`, statement 3 `582 bytes, 8 lines`; the reflow negative control printed the two-line diff and `P7 verdict: OK`.
- P15 on the simulated amendment: `M1-S9 entry lines: 529..578`, `hunks: inside=2 outside=0`, `hunk confinement OK`, `other-story AC/Depends byte-identical`, `stories compared: 66`, `negative control detected the M1-S8 edit`; the `OUTSIDE` and inside self-tests printed the expected lines.
- P16 negative controls: `stricter on coverage` → `missing=1 -> stricter-coverage`; multi-line replacement of the lead-in → `calendar-window-alone=MISSING elapsed-only-phrase=PRESENT`; bare `CEO-D-073` → `citation: MISSING`.
- P17 matcher self-tests: `positive: ados`, `positive2: ~/.ados`, `negative: none`; simulated added-line scan `added-lines=58 seed-hits=0`.
- The plan validates against the repository's `delivery.plan.v1` validator: `verdict=valid`, `readyForDevelopment=true`, `totalErrors=0`, phases 1-3. TC mapping is 21/21 exactly once (P1=7, P2=8, P3=6); AC mapping is 17/17.

## Next Remediation Targets

- delivery_planning: N3 (blocking: region-scope the P1 corroboration gate; add `p10a` to P1 or move TC-GATE-011), N1 (hunk boundary), N2 (P7c citation), N7 (D-12 P1/P16).
- test_planning: N4 (inside-entry preservation oracle), N6 (lead-in negative-control wrapping), and the N1 boundary self-test.
- specification: N5 (optional AC-F2-4 wording).

Finding 7 must be closed or explicitly accepted with a recorded rationale before READY. Findings 1, 2 and 3 are closed; findings 4, 5, 6 and 8-12 are closed, with finding 5 carrying the accepted N-1 residual. Re-run this gate after the small plan/test-plan revision; a third iteration is within the cap.
