# Readiness Review Iteration 3

Verdict: **NOT_READY**
Work Item: GH-266
Date: 2026-11-08
Pause Required: no (no human decision is needed for product scope; the remaining defect is a mechanical test-harness/expected-output correction — see "Remaining Gap" below)

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS (minor N9-N12)
- plan_coverage: **FAIL** (N8)
- test_traceability: PASS (minor N9, N12)
- cross_artifact_consistency: **FAIL** (N8: the test plan's post-amendment P15 expected output contradicts the P15 procedure at the amended HEAD; the plan copies it)
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS (nit N13)
- dod_defined: PASS

The three iteration-1 blockers remain **closed**. The iteration-2 findings N1-N7 are **closed** (N1's predicate is fixed, but its new boundary self-test is mis-anchored — new finding N8). One v1.2 regression blocks READY: the P15 boundary self-test hardcodes base-tree line 560, which is **inside** the amended entry (529..578), so the expected `OUTSIDE` line cannot occur at the amended HEAD.

## Iteration-2 Finding Closure

| Finding | Status | Evidence at the original site |
|---|---|---|
| **N1** — P15a deletion branch accepted `c <= e+1` (next heading line misclassified inside) | **CLOSED (predicate); regression in the new self-test (N8)** | The `d=0` branch is now `c <= e` in test plan §7.1 P15. I ran the updated guard on the amended range 529..578: `+579,0` (next heading) → `OUTSIDE`, `+559,0` (entry last line) → inside, `+541,9` → inside. The predicate is correct. However, the new self-test still hardcodes `+560,0`; on the amended range 529..578 that is **inside**, so the "Expected after the amendment" output is wrong. See N8. |
| **N2** — Plan task 2.2 cited P7c for the forward-looking status phrases | **CLOSED** | Task 2.2 now cites P6b for the byte oracle and P6a for pointer presence/shape. I ran P6 v1.2: base `forward=2 pointed=0 pointer-shape=2/2 bytes=2/2`; amended fixture `forward=2 pointed=2 pointer-shape=2/2 bytes=2/2`, with `milestone-exit-forward` 332 bytes and `next-steps-item-3` 247 bytes. The pointer-shape rule (a pointer containing `CEO-D-073` fails) is enforced. |
| **N3** — P1 corroboration gate was file-wide, not M1-S9-scoped | **CLOSED** | P1 `testGate` now runs a `bun -e` gate that extracts the `### M1-S9` section exactly as P3/P8 do and checks `pm-notes`, `tracker state`, `CI on the pushed head`, and `never sufficient|never counts` inside that region. I ran it: the correct draft prints `sources=3/3 insufficiency=OK`; a fixture with `pm-notes` removed from M1-S9 only (the file still has 8 other occurrences) prints `sources=2/3 insufficiency=OK`, exit 1. The old file-wide grep passed that mutant. P1 also runs `p10` for backlog frontmatter; P2 still completes TC-GATE-011's status halves. |
| **N4** — No oracle for inside-entry preservation of the M1-S9 prose | **CLOSED** | Spec v1.2 extends AC-F1-3 and adds DEC-12; test plan adds TC-GATE-022 and P4c/P4d; plan task 1.6 and P1's `p04` gate bind it. I ran P4c/P4d on the reference amendment: five regions byte-identical at 244/32/231/85/213 bytes, both mutants fired (`FAIL phase-a: bytes changed`, `FAIL handover-flips: bytes changed`), `P4 verdict: OK`. The five regions match the spec's five. Minor residuals N9/N10 below. |
| **N5** — "replaces elapsed calendar time" implied the 7-day alternative was removed | **CLOSED in the plan/status** | Plan task 2.4 and the status reference now say "replaces the calendar-only window with an exposure floor"; P16's elapsed-to-floor group (`/elapsed|calendar/` + `/floor/`) passes. The spec's F-2/AC-F2-4/DEC-10 still say "replaces elapsed time" — minor N11. |
| **N6** — TC-020 lead-in negative control was a no-op on the wrapped reference text | **CLOSED** | P16 v1.2 builds four mutants on the flattened amendment. I ran it on the v1.2 status: `mutant lead-in: changed=true raw-single-line-noop=true calendar-window-alone=MISSING`, `mutant elapsed-only-phrase: changed=true elapsed-only-phrase=PRESENT`, `mutant coverage: changed=true adjudication-missing=stricter-coverage`, `mutant citation: changed=true citation=MISSING`, `P16 verdict: OK`. `raw-single-line-noop=true` directly proves the N6 defect and its closure. |
| **N7** — D-12 said P1 re-runs P16 | **CLOSED** | D-12 now states "P3 re-runs P15 and P16 at the final HEAD; P1 does not run P16." P1's `testGate` runs `p15` and `p04`, not `p16`. |

## Iteration-1 Blockers (must remain closed)

| Blocker | Status | Evidence |
|---|---|---|
| **1** — Missing AC/TC for "no other story AC/dependency modified" | **STILL CLOSED** | AC-F5-3, TC-GATE-018/P15 remain. The v1.2 P15 predicate is correct (`c <= e`); the real reference amendment's two hunks are inside the M1-S9 range (529..578); P15b compares 66 other stories byte-for-byte and the M1-S8 negative control fires. The P15 self-test regression (N8) is a diagnostic/expected-output defect, not a failure of the containment oracle itself. |
| **2** — TC-GATE-004 claimed other-story preservation its steps did not check | **STILL CLOSED** | TC-GATE-004 remains narrowed to the M1-S9 AC/Depends block; TC-GATE-018/P15 owns containment; TC-GATE-022/P4c owns inside-entry preservation. No v1.2 edit re-widened TC-004. |
| **3** — Plan 1.1 vs 1.5 disagreed on the connective; no grammar gate | **STILL CLOSED** | Task 1.1 still says use task 1.5 verbatim; 1.5 still starts with "requires the resident daemon live (M1-S18) and the evidence-based clean bar met."; the P1 connective gate is unchanged and passes on the reconstructed replacement. |

## New Findings

1. **[major, blocking as written] test_traceability / cross_artifact_consistency — test plan §5.2 TC-GATE-018 step 4 and §7.1 P15; plan P1/P3 `p15` expected; PM notes v1.2**
   Gap: The P15 boundary self-test hardcodes `@@ -560,1 +560,0 @@` as "a deletion of the next `### M1-S10` heading line". That is the base entry's next heading (`end=559`). On the amended HEAD the entry range is 529..578, so `+560,0` is **inside** the entry; I ran the v1.2 guard with `start=529 end=578`: `+560,0` prints `hunks: inside=1 outside=0` / `hunk confinement OK`, not `OUTSIDE` / `hunk confinement FAILED`. The actual next heading line is 579; `+579,0` correctly prints `OUTSIDE`. The test plan's "Expected after the amendment" and the plan's P1/P3 `p15` expected both still print `+560,0` as `OUTSIDE`; the PM notes v1.2 claim the same. The self-tests are output-only (the P15 verdict is computed from `confine_ok`/`present`/`stories_ok`), so the P15 verdict itself remains `OK`, but the plan's expected-output contract is false at the amended HEAD and a tester following the plan will see a mismatch. This is the remaining blocker.
   Suggested remediation target phase: test_planning (procedure and expected strings) + delivery_planning (P1/P3 expected strings and PM note)
   Suggested fix: derive the boundary line from the derived next heading (`printf '@@ -%d,1 +%d,0 @@\n' "$next" "$((next-1))"`), so the amended run tests `+579,0`; or run the four boundary self-tests against the base snapshot range (529..559) and label them base-range boundary tests. Refresh the expected line in TC-GATE-018, test plan §7.1 P15, plan P1/P3 `p15`, and the PM notes. Also derive the "well outside" line from `end + 50` rather than a fixed `600`, so a larger amendment cannot move it inside (minor robustness; see N14).

2. **[minor] test_traceability — spec AC-F1-3 vs test plan §3.1 AC-F1-3 row**
   Gap: AC-F1-3 now says "the heading, the acceptance-criteria block, and the dependency line are unchanged". The AC-F1-3 forward row lists only TC-GATE-004 (AC block/dependency) and TC-GATE-022 (five regions); the heading is checked by TC-GATE-005 under AC-F5-1. The heading requirement is tested, but not traced from the AC-F1-3 row. The row's summary also omits "heading".
   Suggested remediation target phase: test_planning
   Suggested fix: add TC-GATE-005 to the AC-F1-3 row (or remove the heading from AC-F1-3 and leave it solely to AC-F5-1).

3. **[minor] ac_quality — spec AC-F1-3 "only editable prose" vs P4c's five slices**
   Gap: AC-F1-3 says "The replaced tasks clause defining `clean` is the only editable prose in the entry." P4c freezes exactly the five named regions, but the `(b) **handover per repository** additionally` marker, the word "additionally", and the ", and the bash entry points print deprecation pointers and remain reachable as fallback." clause after `(recorded, reversible)` are outside the five slices. The AC block separately freezes the bash-fallback **requirement**, but the Tasks prose bytes are not frozen, so the "only editable prose" claim is broader than the oracle.
   Suggested remediation target phase: specification (narrow the claim) or test_planning (extend the slices)
   Suggested fix: either narrow AC-F1-3's sentence to "these five regions are frozen; the AC block, dependency line and heading are frozen; the remaining Tasks prose is not part of the gate" or extend the phase-a slice through the `(b)` marker and the handover-flips slice through the fallback clause.

4. **[minor] cross_artifact_consistency — spec F-2 / AC-F2-4 / DEC-10 vs plan status reference**
   Gap: The plan and status now say "replaces the calendar-only window with an exposure floor" (N5), but spec F-2, AC-F2-4 and DEC-10 still say "replaces elapsed time with an exposure floor". The P16 marker group accepts both, so the gates pass; the spec wording is the same imprecision N5 flagged and is now out of step with the delivery text.
   Suggested remediation target phase: specification
   Suggested fix: align the spec's F-2/AC-F2-4/DEC-10 to "replaces the calendar-only window with an exposure floor", or state explicitly that the broader "elapsed time" phrasing is an acceptable instantiation.

5. **[nit] test_traceability — spec AC-F2-2 vs TC-GATE-007/P6b**
   Gap: AC-F2-2 only requires a supersession pointer; TC-GATE-007 now also requires the two forward statements to be byte-identical. The extra oracle is consistent with spec F-2/DEC-6's "without being rewritten" and with plan task 2.2, but the AC does not name byte identity.
   Suggested remediation target phase: specification (optional)
   Suggested fix: add "the statement's bytes are unchanged" to AC-F2-2, or mark the byte line as a plan-level stricter oracle.

6. **[nit] plan_code_area_coverage — plan P1 `testGate` `p10`**
   Gap: P1 now runs the whole `p10`, which includes P10b (status has no frontmatter) and P10c (added `ados_distribution`), while P1's scope is `backlog.md` only. At P1 the status is unamended, so these pass trivially and no failure is likely; but the gate/scope statement is imprecise if the status were touched early.
   Suggested remediation target phase: delivery_planning
   Suggested fix: run only the P10a backlog half in P1 and leave P10b/P10c to P2, or state explicitly that P10b/P10c are pre-checks that must be green and are re-run in P2.

7. **[nit] test_traceability — P15 `+600,1` self-test robustness**
   Gap: `+600,1` is outside the amended entry only while the amendment adds fewer than 41 lines; a larger valid amendment could make 600 an inside line and the self-test would no longer prove "well outside". The reference adds ~19 lines, so the current expected value is correct for the reference, but the test is not derivation-based.
   Suggested remediation target phase: test_planning
   Suggested fix: use `end + 50` (or `next + 20`) for the "well outside" line instead of the fixed 600.

## Judgments Requested

- **Five frozen regions vs P4: exactly matched, no extra/missing.** Spec AC-F1-3 names Goal, Ticket, phase (a), handover-flips, covers-functions; P4c checks the same five. The P4c `covers-functions` start literal is the broader-but-unique `Covers`, and the `handover-flips` slice ends at `as authoritative (recorded, reversible)`, exactly the spec's quoted sentence. Byte counts 244/32/231/85/213 match. The only nuance is N3: the AC's "only editable prose" claim is broader than the five slices (the `(b)` marker and the bash-fallback clause are outside).
- **The new frozen-region AC did not weaken AC-F1-3's original requirement.** The AC still requires the AC block, dependency line, "clean window" phrase, refusal/offer, per-repository reversibility and bash fallback; TC-GATE-004/P4a is unchanged. The heading was added (overlapping AC-F5-1; N2), and the five regions were added. No original clause was removed or softened.
- **The P1 region-scoped corroboration gate cannot pass while the corroboration rule is absent from M1-S9.** It extracts the `### M1-S9` section and requires all three sources and the insufficiency marker inside it. A full omission fails; a partial omission (`pm-notes` removed from the region but present elsewhere in the file) reports `sources=2/3`, exit 1. A scattered-literal dodge could still pass this presence check, but P8/TC-GATE-009's region check plus manual read is the authoritative coherence oracle. The file-wide-grep weakness of iteration 2 is gone.
- **N-1 and N-2 remain legitimate.** N-1 is the accepted AC-NFR5-1 guard-scope residual, recorded as a PM decision dated 2026-11-08, compensated by P17 and followed up in OQ-5. N-2 is the time-wording constraint; the v1.2 "calendar-only window" form satisfies P16's elapsed-to-floor group without implying the 7-day alternative is removed. The D-6/P6 pointer-shape reconciliation is also legitimate: P6 now enforces the no-`CEO-D-073` pointer rule and selects the last section, while P5/P16 select the first, so the authoring rule is stricter and not relaxed.

## Positive Verification Evidence

- P4c/P4d on the reference amendment: five `region …: byte-identical` lines at 244/32/231/85/213 bytes, both mutants `bytes changed`, `P4 verdict: OK`.
- P6 v1.2: base `forward=2 pointed=0 pointer-shape=2/2 bytes=2/2` (exit 1); amended fixture `forward=2 pointed=2 pointer-shape=2/2 bytes=2/2`, `milestone-exit-forward` 332 bytes, `next-steps-item-3` 247 bytes (exit 0).
- P16 v1.2: positive lines `adjudication: missing=0`, `calendar-window-alone=OK elapsed-only-phrase=ABSENT floor-scope=OK`, `citation: OK`; all four mutants fire; `P16 verdict: OK`.
- P1 region-scoped corroboration gate: correct draft `sources=3/3 insufficiency=OK`; partial-omission fixture `sources=2/3 insufficiency=OK`, exit 1; the old file-wide grep would have passed that fixture.
- P4c/P4d source anchors are unique in the backlog (`Covers` appears once, `Handover flips` once, the phase-a anchor once); the slices are stable.
- Plan validator: `verdict=valid`, `readyForDevelopment=true`, `totalErrors=0`, phases 1-3; 22/22 TCs mapped exactly once (P1=8, P2=8, P3=6); 17/17 ACs covered; test plan has 22 unique TCs and 17 forward AC rows.
- Base-revision falsifiability remains: P2 `occurrences=1 unmarked=1`; P3 `conditions=1/4`; P5/P16 `amendment: not found`; P6 `forward=2 pointed=0`; P9 `FAIL: enumeration paragraph not found`; P15 `backlog.md hunks: 0` + `P15 verdict: FAILED`; P17 `added-lines=0` + exit 1; P11/P12 green.

## Remaining Gap

**Blocking as written, mechanically correctable.** The only blocker is N1/N8: the P15 boundary self-test hardcodes the base-tree next heading line `560`, which is inside the amended entry range `529..578`; the test plan's "Expected after the amendment", the plan's P1/P3 `p15` expected strings, and the PM notes all claim `+560,0` is `OUTSIDE`. It is not. The P15 verdict itself remains `OK` because the self-tests are output-only, but the plan's expected-output contract is false at the amended HEAD.

No product, spec-scope, or contract decision is needed to fix it: derive the boundary line from the derived `next` heading (579) or run the four boundary self-tests against the base snapshot range (529..559) and label them base-range tests, then refresh the expected strings in test plan TC-GATE-018/§7.1 P15, plan P1/P3 `p15`, and the PM notes. The three iteration-1 blockers remain closed; N1-N7 are closed (N1's predicate is correct; this is the new self-test regression). If the human prefers to accept the P15 verdict as the binding gate and treat the self-test lines as diagnostic, that is the only acceptable-with-rationale reading; the artifacts as written still contain a false expected output.

Because this is the third iteration, the gate escalates to the human rather than looping. Recommended human disposition: authorize the mechanical P15 self-test/expected-string correction (test_planning + delivery_planning only), then proceed to delivery; do not reopen the specification or the handover-gate decisions.
