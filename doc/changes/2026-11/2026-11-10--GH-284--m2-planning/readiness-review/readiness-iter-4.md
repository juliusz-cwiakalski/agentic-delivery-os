# Readiness Review Iteration 4 (focused confirmation, post-DoR)

Verdict: NOT_READY
Work Item: GH-284
Date: 2026-11-10
Pause Required: no

**Delivery may not proceed.** The v1.5 fix is real and correct for P03 and P08 — I reproduced both fixtures and both pre-change runs, and the pair is now jointly satisfiable. But while proving that, I found a **third unsatisfiable gate of the same class**: P29 flags M2-S9 as `body CHANGED` on *any* conforming head, so P1 (and the P6 re-run) still cannot go green. Details in Finding 1.

## Facets (only the test-plan-dependent ones were re-examined; spec v1.5 and plan v1.4 are unchanged since iteration 3)

- spec_completeness: PASS (unchanged)
- ac_quality: PASS (unchanged)
- plan_coverage: PASS (unchanged)
- test_traceability: **FAIL** — TC-029/P29 cannot pass on a conforming deliverable (Finding 1)
- cross_artifact_consistency: PASS (minor residue only, Findings 2–3)
- decision_capture: PASS (minor residue, Finding 5)
- system_spec_consistency: PASS (unchanged)
- plan_doc_update_coverage: PASS (unchanged)
- plan_code_area_coverage: PASS (unchanged)
- dod_defined: PASS (unchanged)

## Finding 1 (blocking) — P29 cannot pass on a conforming head

**Artifact:** test plan v1.5, P29 (`entry` extraction) · **Owner:** test_planning

`entry()` stops only at `^### `. In the base snapshot M2-S9 is the last story of Epic M2, so its entry runs past its own body through the block close and into the next epic:

```
$ entry base-backlog.md "### M2-S9 " | tail -4
- Depends on: M2-S8.
                       <- blank
---
                       <- epic separator
## Epic M3: Surfaces, adapters, validators (months 6-9)
```

In any conforming head the next `### ` is `### M2-S11`, so the same extraction stops at the depends line plus the blank:

```
$ entry <head> "### M2-S9 " | tail -3
- Depends on: M2-S8.
                       <- blank
```

`cmp` therefore always differs. Reproduced three ways (P29 run exactly as shipped, `BL` pointed at each head):

| Head | P29 output |
|---|---|
| base vs base (control) | `stories_compared=65 identical=65 changed=0` |
| minimal head: seven stories inserted only, no S4/S6 edits | `body CHANGED: ### M2-S9 …`; `identical=64 changed=1` |
| full head: M2-S4 depends change, M2-S6 task + depends change, seven stories | `body CHANGED: ### M2-S9 …`; `identical=64 changed=1` |

Both P1 and P6 gate on `P29 -> stories_compared=65 identical=65 changed=0`, and TC-029 expects `stories_compared=65 identical=65 changed=0`. There is no conforming position for `### M2-S11` other than immediately after M2-S9 (DEC-17/AC-F1-3), so the two requirements are mutually unsatisfiable: **delivery would halt at P1 a third time**, this time on P29.

This is pre-existing (P29's block is byte-identical between v1.4 and v1.5), not introduced by this fix; the earlier passes only ever ran P29 as a base-vs-base control.

**Fix (verified):** bound the extraction at the block close as well — stop at `^---$` and `^## ` in addition to `^### `. With that one-line change:
- base M2-S9 entry and head M2-S9 entry both become 14 lines and compare identical;
- all three heads report `stories_compared=65 identical=65 changed=0`;
- the pre-change control stays `65/65/0`, and no other story's extraction changes (every other story is followed by a `### ` first).

## Confirmation of the v1.5 P03/P08 fix (this part is closed)

**Reproduced exactly as recorded:**
- P03 pre-change: `insertion window … window=1167:1167`; `window_empty=no`; `separator_sequence=identical`; `blank_separation=FAIL (head M2-S9 last non-blank=1166; got [] then [---])`; conforming fixture `blank_separation=OK (head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169)`; `fixture_blank_separation=OK`; `classifier_self_tests=4/4`; `insertion_below_separator=never`.
- P08 pre-change: `changed_lines=0`; `tasks_clause=MISSING`; `depends=M2-S14 MISSING`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`; `fixture_task_lines_missing=0`; `fixture_s6_task_lines=3->4`; `fixture_ac_identity=identical`; `fixture_p08=OK`.

**Jointly satisfiable — proven:** on a head carrying the real amendment shapes (M2-S4 depends replacement, M2-S6 own-line clause + depends addition, seven stories inserted after the blank), P03 prints `blank_separation=OK (1167/1168/1169)` and P08 prints `changed_lines=3`, `tasks_clause=OK`, `depends=M2-S14 OK`, `heading=identical`, `base_task_lines_missing=0`, `- Goal: identical`, `- AC: identical`. P01 passes (`7/7`, shape 7/7) and P09 passes (`67→74`, added=7 removed=0, order OK) on the same head.

**Not loosened into vacuity — six negatives all detected by `blank_sep_check`:**

| Head variant | Result |
|---|---|
| S11 directly after the depends line (no blank) | `FAIL … got [### M2-S11 …]` |
| S11 inserted below the `---` separator | `FAIL … got [] then [---]` |
| S11 inserted inside the M2-S9 entry (before depends) | `FAIL … got [### M2-S11 …]` |
| two blank lines before S11 | `FAIL … got [] then []` |
| M2-S9 removed | `FAIL (M2-S9 absent)` |
| S11 inserted after M2-S8 instead | `FAIL … got [] then [---]` |

**P08 negatives all detected:** changed AC line → `- AC: CHANGED`; changed goal → `- Goal: CHANGED`; changed heading → `heading=CHANGED`; a dropped base task line → `base_task_lines_missing=1`.

**No other assertion was touched:** I extracted all 38 procedure blocks from v1.4 (`git show <prev>^`) and v1.5 and hashed them. **36 of 38 are byte-identical**; only P03 and P08 differ, and each diff is confined to the blank-separation block / the identity control plus the new fixture. The P03 hunk window, separator sequence, hunk guard, classifier self-tests (4/4) and verdict logic are untouched; P08's `changed_lines`, `tasks_clause`, `depends`, `heading`, and `base_task_lines_missing` are untouched. P08's only edit is `grep -A3 | head -4` → `grep -m1` (plus an `-n` guard, a strengthening).

**Adjacent gates sampled for collateral drift:** P02 (`61 present=0`), P04 (`S17=absent`), P06 (`criteria_present=0/7`, `ac_numbered_items=0/7`, both self-tests `detected`), P09 (`67/67`, retirement note identical, order OK) — all still match their recorded pre-change evidence, consistent with the byte-identical blocks.

## Non-blocking residue

2. [minor] delivery_planning — plan P1 gate, P08 parenthetical: *"changed_lines is 3 when the clause is inserted as its own task line and 4 when it is appended to an existing task line"*. Appending into an existing **base** task line modifies that line, so `base_task_lines_missing=1` and the same gate fails (verified: `changed_lines=4`, `base_task_lines_missing=1`). Task 1.4 already says every existing task line stays byte-identical, and AC-F3-2 agrees, so the instruction is right and only the parenthetical is wrong. Delete it or say a modified base task line is non-conforming.

3. [nit] delivery_planning — the P1 gate's `blank_separation=OK (the line after M2-S9's last line is empty and the next line is '### M2-S11 ')` no longer matches the procedure's parenthetical (`head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169`). The token and the meaning match; only a literal string compare would differ. The new `fixture_blank_separation=OK` / `fixture_p08=OK` lines are additive and not listed in the gate — harmless, but the plan's “expected lines” wording could mention them.

4. [nit] delivery_planning — M2-S6's `- Depends on:` line has no exact expected text (M2-S4's does). P08 accepts any line containing `M2-S14`, so a malformed `- Depends on: M1-S19, M2-S3., M2-S14` would pass. AC-F3-2 only requires the addition, so this is a polish item; pin the line if the reviewer wants byte-level certainty.

5. [nit] decision_capture — `chg-GH-284-pm-notes.yaml` bumps `test_planning.completed` to 20:10 but carries no note/retro for the post-DoR v1.5 revision or the P1 halt. One line ("P1 halted: P03/P08 contradiction; test plan v1.5 head-anchored the blank check and narrowed the AC identity") would make the audit trail readable.

## Bottom line

The v1.5 fix does exactly what it claims, and it was validated the way it should have been: I rebuilt a conforming head with the real amendment shapes and confirmed P03 and P08 both pass, then attacked the new predicate with six violations and confirmed each is still caught. **The change is not ready, because P29 is a third mutually-unsatisfiable gate** — it will report `body CHANGED: ### M2-S9` on any correct delivery. The fix is one line in P29's `entry` (or a local truncation in P29), verified to give `65/65/0` on the base and on both conforming heads; after that this pass can be re-run cheaply and should go READY.
