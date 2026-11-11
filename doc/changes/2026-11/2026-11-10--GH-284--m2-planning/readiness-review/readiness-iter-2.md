# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-284
Date: 2026-11-10
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
- plan_code_area_coverage: PASS
- dod_defined: PASS

## The four iteration-1 blockers are genuinely closed

Verified against the files and by executing the procedures, not by reading the remediation claims.

**1. S17's seven acceptance criteria (was FINDING 1) — CLOSED.**
- `spec` v1.4 §5.1 F-2 now enumerates criteria (1)–(7); each matches the ticket's AC line in substance (profile nomination visible on lane/attempt; bounded-grace park with reason `peak-window` and the window end; other providers unaffected; resume with no branch/artifact/queue state lost or duplicated; zero billable model calls; stop/park/resume auditable in status and brief; daemon-resident with declared daemon-absent degradation).
- AC-F2-1 asserts content, not a count; AC-F2-3 keeps independent identifiability.
- The test plan's clause table carries `S17-AC1..AC7`, each with a content anchor; P06 scores them against the `- AC:` block and prints `criteria_present=7/7`, plus `ac_numbered_items` and `extra_criteria`.
- **Independent proof the anchors are satisfiable by faithful transcription:** I ran the artifact's own `clause_rows`/`clause_check` against the GH-284 ticket body itself — `clause_scan: total=15 present=15 missing=0` for S17 and `total=61 present=61 missing=0` for S11–S16. The anchors match the ticket's wording, not a preferred delivery wording.
- Pre-change control (executed): `S17=absent criteria_present=0/7`; P35 `s17_missing_criteria=7`. The oracle bites.

**2. Clause-fidelity oracle (was FINDING 2) — CLOSED.**
- The 79-row table is the ticket's own clause set: 7 goals + 36 task clauses + 26 acceptance clauses + 7 dependency lines + 3 amendment clauses = 79. I re-derived the per-story counts independently (S11 9, S12 8, S13 11, S14 12, S15 10, S16 11, S17 15) and they match.
- Every clause I flagged in iteration 1 now has a row: `S11-AC1/AC2`, `S12-AC2` ("resolved with a note"), `S13-AC1` ("observes entry and dependency changes"), `S15-AC1/AC2/AC3` ("without manual action", "classified error naming the holder", "without editing state files"), `S16-AC1` ("corroborated outcomes accrue").
- Pre-change control (executed): `clause_scan: total=79 present=0 missing=79`, `missing_clauses=79`; post-change the gate requires `total=79 present=79 missing=0`.
- G-1 is now narrowed honestly to the paraphrase/meaning residue and names the 79-row table as the reviewer's checklist. The false "every clause has an anchor" claim is gone.

**3. Aggregate gate (was FINDING 3) — CLOSED.**
- NFR-5, AC-NFR5-1, the §4.1 KPI row, RSK-9, the §17.3 DoD bullet, the §12 assumption, and DEC-19 all state the same two-run gate.
- I reproduced both behaviours independently: default `bun test tests/checks/ci-baseline-parity.test.ts` fails with the cross-device hardlink error; the same test passes when `TMPDIR` is on the repository filesystem. P32 now runs both for real, creates its own `tmpdir` directory, classifies a lone `CI baseline parity (hermetic partial clone)` failure as environmental, and fails on any other failure. The spec-vs-plan contradiction is gone.

**4. Proposal tail and Appendix B (was FINDING 4) — CLOSED.**
- F-5, DM-2, AC-F5-1 and DEC-18 carry the rule: no proposal tail without a named planned remainder; retained tails are scoped; delivered-extension clauses survive.
- Appendix B's watchdog row now records the true current claim and requires preserving `M1-S15 adds progress signals` and `SC-M1-14`.
- P11 implements it (`tail_violations=0`, plus `watchdog_m1s15`, `watchdog_sc`, `verify_gates_extension`, `closeout_extension`). Pre-change control (executed): `tail_violations=11`, with the three preservation checks already `OK`.
- I confirmed the rule's scope is complete: all 11 pages that carry a proposal tail today are inside the 14-page reconciliation set; no untouched page carries one.

**Iteration-1 minors:** P34 is self-contained and executes standalone (no `ptr: command not found`); P32's `mkdir -p` is present in the procedure; packed-contents deviation and twelve-target index row are normative (DEC-20) and gated (P19/P27); AC-F1-1/P03 add the blank-line separation (control `blank_separation=FAIL` pre-change, logic verified for the compliant head); §18 allows finer commit splits; DEC-6 now cites `AGENTS.md` and the guard's path set.

**XF-9 acceptance is sound.** `head_line_for_base` over-shifts only when a replacement hunk exists, and any replacement makes `removed_lines>0`, which the same oracle fails in the same invocation. A compliant head has only pure insertion hunks, so no false PASS is possible — only a misleading window print on a head that already fails. Accepting it as a recorded residual is correct.

## Findings

1. [major] cross_artifact_consistency — plan v1.3 task 4.2 vs test plan v1.3 P33 lines 2218/2222
   Gap: task 4.2 prescribes exactly `## C4 Level 1`, `## C4 Level 2`, `## C4 Level 3` (quoted twice: "Exactly three C4 headings (`## C4 Level 1`, …)" and "each `## C4 Level 1/2/3` heading owns exactly one diagram"), but P33's association predicate is `grep -qE "^[0-9]+\|## C4 Level $lvl[^0-9]"` and its count is `grep -cE '^[0-9]+\|## C4 Level [123][^0-9]'`. `[^0-9]` cannot match end-of-line, so a heading that ends right after the level digit never matches. Reproduced on a compliant fixture built to the plan's own heading text (3 C4 headings, 6 flow headings, 1 park/resume, 10 mermaid fences): `C4 Level 1/2/3 has diagram=MISSING`, `c4_headings_with_diagrams=0/3`, while the flow and park checks all report OK. The P4 gate ("`C4 Level 1 has diagram=OK`, … `c4_headings_with_diagrams=3/3`") and the P6 regression gate therefore cannot go green on a deliverable that follows task 4.2 literally, and the coder may not retype the uncommitted procedure ("materialised by copy … never retyped"). This is a new contradiction introduced by the P33 association fix; the same regex also matches a heading with trailing text (e.g. M1's `## C4 Level 1: system context`), which is why it can pass by accident.
   Suggested remediation target phase: test_planning
   Suggested fix: terminate the class with `([^0-9]|$)` in both predicates (and in the `c4=` count), or make task 4.2 prescribe a trailing subject ("`## C4 Level 1: system context`", mirroring M1) — one of the two, not both as today.

2. [minor] cross_artifact_consistency — plan v1.3 gates (lines 531, 573, 1245) and test plan evidence rows (§5.2 TC-006 note, §7.2 TC-006 row, §10 log)
   Gap: these expect/record `ac_items=7/7` and `ac_items=0`, but P06 v1.3 prints `ac_numbered_items`, `criteria_present`, `extra_criteria`, `duplicate_numbers` and nothing called `ac_items` (confirmed by running P06: `S17=absent criteria_present=0/7` only). The expected-output lists therefore contain a token the procedure cannot emit, and the recorded pre-change evidence for TC-006 claims a line that was never produced. No verdict is affected because the stronger `criteria_present` lines are present, but an operator comparing expected to observed will hit a false mismatch.
   Suggested remediation target phase: delivery_planning
   Suggested fix: replace `ac_items=…` with `ac_numbered_items=…`/`extra_criteria=0` in the three plan gates and the three test-plan rows (and re-record the TC-006 evidence from an actual run).

3. [nit] ac_quality — test plan P06 and P35 "added criteria" guards
   Gap: both count items with `[[:space:]]+[1-7]\.`, so an eighth criterion numbered `8.` is invisible to `extra_criteria`/`added_criteria`; and P06's `duplicate_numbers` is vacuous because it pipes `grep -n` output into `awk '{print $1}'`, which yields the distinct line numbers, so `uniq -d` can never fire. The content anchors and `criteria_present` carry the real check.
   Suggested remediation target phase: test_planning
   Suggested fix: count with `[0-9]+\.` and compare `> 7`; derive duplicate numbers from the matched text (`sed -E 's/^[[:space:]]+([0-9]+)\..*/\1/'`) instead of the line number.

4. [nit] spec_completeness — spec v1.4 Appendix E
   Gap: AC-NFR6-1 says the Appendix E procedure proves condition (d) and "reports zero failures", but Appendix E still ends with "a counted grep for the C4 levels plus a named heading review for the flows" — it does not perform the association check that P33 now performs. The requirement is met in practice (P33 refines Appendix E, which the spec permits), but the spec's own reference procedure is stale relative to the AC it is cited for.
   Suggested remediation target phase: specification
   Suggested fix: add the association step to Appendix E (or point it at the test plan's procedure) so the cited procedure and the AC agree.

5. [nit] spec_completeness — spec v1.4 Appendix B, watchdog row vs AC-F5-1
   Gap: Appendix B says "supervision battery planned M2-S2 scopes the **retained** proposal tail", which reads as mandatory retention, while AC-F5-1 and P11 only forbid a tail *without* a named remainder and accept dropping it. Both outcomes are truthful; the artifacts disagree on which is required.
   Suggested remediation target phase: specification
   Suggested fix: say either "keeps the tail, scoped to M2-S2" (and have P11 require it for watchdog, as it already requires the remainder token) or "may keep the tail scoped to M2-S2".

6. [nit] test_traceability — test plan §5.2 TC-M2PLAN-011 precondition
   Gap: it says "P11 has run first (it defines the `NEED` page map used by this procedure)" inside the scenario whose procedure *is* P11 — a circular copy of TC-014's correct precondition. Harmless, but it hides the real dependency (P14/P30 reuse `NEED`).
   Suggested remediation target phase: test_planning
   Suggested fix: delete the line from TC-011 (keep it on TC-014 and any other procedure that reuses `NEED`).

7. [nit] ac_quality — test plan P19 `readme_lists`
   Gap: the per-file check for `README.md` greps the token `README.md` in the README, which is satisfied by the required `../README.md` link, so the README need not list itself. AC-F8-1 requires the README to map all twelve.
   Suggested remediation target phase: test_planning
   Suggested fix: check the self-entry with a row-shaped pattern (e.g. a table line starting `| \`README.md\``) rather than a bare basename grep.

8. [nit] cross_artifact_consistency — spec v1.4 AC-F1-2
   Gap: AC-F1-2 still asserts "Zero clauses are missing" while its colon-list remains a summary of task clauses plus a few acceptance clauses; the exhaustive set now lives only in the test plan's 79-row table. Acceptable because the table is the operative oracle, but the spec's own enumeration can no longer be read as the clause list.
   Suggested remediation target phase: specification
   Suggested fix: one sentence pointing AC-F1-2 at the ticket-derived clause table (as the definition of "every normative clause") and marking the list illustrative.

## Remediation Routing

- **test_planning** (reopen): F1 (blocking), F3, F6, F7.
- **delivery_planning** (reopen, small): F2.
- **specification** (reopen, nit-only): F4, F5, F8.
- No finding targets `delivery`; no human input is required.

## Bottom line

The four blockers from iteration 1 are closed on the merits — each is now enumerated, anchored, executable, and demonstrably biting on the pre-change tree, and I verified the new anchor table against the ticket itself rather than against the delivery plan. The change is not yet ready because the association check added in this round contains an unsatisfiable predicate for the heading text the plan mandates (F1): as written, a compliant M2 architecture document fails P33, and therefore the P4 and P6 gates, with no permitted way to reconcile it at delivery time. That is a one-line fix plus the stale-token cleanup; iteration 3 should be short.
