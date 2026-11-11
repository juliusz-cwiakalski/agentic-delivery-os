# Readiness Review Iteration 6 — closure record

Verdict: READY
Work Item: GH-284
Date: 2026-11-11
Pause Required: no
Closes: `readiness-iter-4.md`, `readiness-iter-5.md` (both NOT_READY)

## Purpose and scope

Iterations 4 and 5 were **confirmation passes**, not re-reviews: each was asked to prove a specific gate fix and each ended NOT_READY because it found the *next* unsatisfiable gate. Both blockers have since been fixed and delivery completed (P1–P6 plus P7 `system_spec_update`). No record in the tree stated the gate's final standing, which the code review raised as `code-review/review-iter-2.yaml` F-7 ("a readiness closure record … supersedes the two NOT_READY verdicts"; `delivery-evidence/verification.md` F-5 row already points here as the owner).

This record closes that gap. It does not re-review the whole artifact set: iteration 3 established the ten facets, iterations 4 and 5 established the phase-level satisfiability, and this record verifies the two blockers by execution at HEAD and re-affirms the facets against the requirement changes that landed afterwards.

## 1. The blockers and the fixes that carry them

| Blocker (record) | Defect | Fixed in | Evidence carried by |
|---|---|---|---|
| iter-4 F1 | P29's `entry()` stopped only at `^### `, so base M2-S9 absorbed `---`/`## Epic M3` and every conforming head reported `body CHANGED: ### M2-S9` (`64/1`) | **test plan v1.6** | v1.6 revision row; P29 `p29_check` + five head fixtures + three negatives |
| iter-5 Finding 1 | P26's last token was `'entrypoint\.md'` matched with `grep -Fiq`; with `-F` the backslash is literal, so no delta note could match | **test plan v1.7** | v1.7 revision row; token now `entrypoint.md` |

Earlier satisfiability fixes in the same lineage, for completeness (they were the reason iterations 4–5 existed):

| Gate | Defect | Fixed in |
|---|---|---|
| P03 + P08 (P1 halt) | base-anchored blank check contradicted the P08 amendment shift; `- AC:` identity used a 4-line window that included the changed depends line | test plan **v1.5** |
| P28 (P6 halt) | did not expect the forbidden-literals registry file the guard requires (DEC-21) | test plan **v1.8** (31 files), **v1.9** (31 delivery + 3 phase-7 budgets) |
| P26 shape (review-iter-1 F-1) | back-pointer expectation replaced by the snapshot/forward-link shape (DEC-23) | test plan **v2.0** |
| P07 (review-iter-2) | exact depends line needed the restored terminal period (AC-F3-1) | test plan **v2.1** |
| Evidence rows (review-iter-2 F-1) | §10/§7.2 rows and verification.md still reported FAIL for gates that pass | test plan **v2.2**, plan **v1.9** |

Requirement-side versions carrying the review remediations: spec **v1.8** (DEC-23, DEC-24), **v2.0** (DEC-25), with **v1.6/v1.7** (DEC-21/DEC-22) and **v1.9** (AC-F3-1 period); plan **v1.8** (adds P7) and **v1.9** (P7 scope and artifact pins). AC count stayed 37 throughout.

## 2. Verified by execution at HEAD `d57ba77f`

Procedures were extracted from test plan v2.2 (38 blocks, all `bash -n` clean) and run against the current tree; only `P00`'s base snapshots and the standard `/tmp` scratch were used.

**P29 — the iteration-4 blocker:**

```
-- real head --        stories_compared=65 identical=65 changed=0 order=OK
-- base control --     stories_compared=65 identical=65 changed=0 order=OK
-- minimal stories-only head --  65/65/0 order=OK
-- full amendment + stories head --  65/65/0 order=OK
negative_body=detected  negative_removed=detected  negative_reordered=detected
```

**P26 — the iteration-5 blocker:** the `entrypoint\.md` token is gone from the test plan (`grep` finds no occurrence), and the rewritten procedure passes on the delivered delta note:

```
back_pointer_claim=ABSENT   m1_snapshot=OK   description_bound=OK
forward_m1_link=OK          m2_command_links=6/6   readme_reachable=OK
token sixteen|16 families OK / dispatch OK / coordinator OK / state OK / mcp OK /
daemon OK / unknown flag OK / unexpected argument OK / exit 1 OK / outside this OK
```

**Adjacent gates, same HEAD (cheap re-runs):**

| Procedure | Observed at HEAD |
|---|---|
| P03 | `blank_separation=OK (head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169)`; `insertion window … window=1167:1286`; `window_empty=no`; `separator_sequence=identical`; `backlog_hunks=4`; `hunks: inside=4 outside=0`; `hunk confinement OK`; `classifier_self_tests=4/4`; `P03 verdict: PASS` |
| P08 | `changed_lines=3`; `tasks_clause=OK`; `depends=M2-S14 OK`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`; `fixture_p08=OK` |
| P28 | `total_product_files=34`; `unexpected_planning_paths=0`; phase-7 budget `phase7_files=3 phase7_extra=0 phase7_unknown_paths=0`; `matcher_self_test=OK`; `non_vacuous=yes` |
| P11 | `header_attribution=14/14`; `forbidden_phrase_pages=0`; `tail_violations=0`; `current_violations=0`; `reachability_missing=0`; watchdog/verify-gates/closeout preservation OK; `doctor_reachability=exempt (recorded residual)` |
| P17 / P18 | four pointer groups present and retained; `m1_table_blank_before=OK`; `m1_table_separator=OK`; `removed_lines=0 added_lines=31`; `section_lines=26 pointer_runs=4 pointer_windows=4 bad_runs=0`; `retention_oracle=OK`; `P18 verdict: PASS` |
| P07 | `changed_lines=2 unexpected_lines=0`; `depends=expected`; `M2-S4 shape OK`; mutation self-test fires |
| P35 | `clause_scan: total=61 present=61` then `total=79 present=79 missing=0`; `missing_clauses=0`; `s17_missing_criteria=0`; `added_criteria=0` |
| P31 | `guard_exit=0`; "no drift — 82 in-scope docs"; `planning_markers=0` |
| P36 | `OK forbidden-literals: 5/5 scope classes scanned, 0 violations` |
| plan | `pnpm exec delivery-os plan validate GH-284` → `verdict=valid`, `readyForDevelopment=true`, `tier=lite` |

Both blockers are demonstrably closed, and the gates that replaced them are not vacuous: P29 still detects a mutated body, a removed story and a reordered pair; P03 still fails a missing blank / below-separator / two-blank / missing-M2-S9 insertion; P08 still detects a changed AC, goal or heading and a dropped task line.

## 3. Facets re-affirmed against the post-iteration-3 changes

The requirement set changed after iteration 3: spec v1.6→v2.0 added **DEC-21** (forbidden-literals registry), **DEC-22** (two-phase containment budgets), **DEC-23** (M1 entrypoint page is a snapshot; no back-pointer claim), **DEC-24** (uniform reachability note), **DEC-25** (lease release vs reason-bearing removal), and the plan gained **P7**. Checked against those changes:

- **spec_completeness — PASS.** 37 ACs (unchanged); DEC-1..25 present with rationale; NFR-1/AC-NFR1-1 now state the 31 delivery + 3 phase-7 = 34 product-file budget; F-8/AC-F8-3 now split lease release from reason-bearing removal; F-10/AC-F10-1 now require the snapshot statement and forward links. No ticket requirement was dropped — the ticket's 79 clauses still register `present=79 missing=0` at HEAD.
- **ac_quality — PASS.** 37 ACs, each procedure-backed, none untestable; the changed criteria (AC-F3-1, AC-F8-3, AC-F10-1, AC-NFR1-1) are each asserted by P07, P21, P26 and P28 respectively.
- **plan_coverage — PASS (one comment slip, Finding 1).** Phase→TC mapping is exact and non-overlapping across P1–P7: 8+5+2+2+1+5+14 = 37, no duplicates, no gaps (computed from the YAML). P7's scope holds 12 product files, all inside the 31-file delivery budget, plus the five change artifacts it revises; the plan validates.
- **test_traceability — PASS.** §3.1 forward 37, reverse 37, 38 procedure blocks; P7's re-delivery re-claims 14 TCs and the plan says so explicitly, keeping the 1:1 TC↔AC relation intact.
- **cross_artifact_consistency — PASS.** AC-NFR1-1 (34 files), the §4.1 KPI row, NFR-1, DEC-22 and the §17.3 DoD all state the same 31+3 budget that P28 observes; AC-F10-1's shape is exactly what P26 prints; AC-F3-1's period matches P07's exact line.
- **decision_capture — PASS.** DEC-21..25 record the new binding calls with rationale (registry scope, phase budgets, entrypoint snapshot, reachability rule, release/removal split) and each is reflected in the delivered documents.
- **system_spec_consistency — PASS.** `system_spec_update` touched exactly three current-truth docs — `feature-resident-daemon.md`, `feature-cli-entrypoint.md`, `architecture-overview.md` — and they now say the daemon family is composed only when a runtime is supplied and is not mounted at the production entrypoint, matching DEC-2/DEC-23/DEC-24, AC-F5-3 and the M2 delta note; the new `../../planning/.../entrypoint-delta.md` link resolves. No contradiction with `doc/spec/**` remains.
- **plan_doc_update_coverage — PASS.** P7 names the three current-truth docs plus the artifacts it revises, and the DoD carries the same budget.
- **plan_code_area_coverage — PASS.** P7's 12 product paths and 5 change artifacts are explicit; the product set is disjoint from P1–P6's (they are re-deliveries of the same files), and the total 34 matches the observed diff.
- **dod_defined — PASS.** §17.3 is checkable and covers the ticket's acceptance list, the two-run aggregate gate, the structural diagram procedure, and the 34-file containment statement.

## 4. Verdict

**READY.** The iteration-4 blocker (P29 entry bound) and the iteration-5 blocker (P26 escaped marker) are fixed in test plan v1.6 and v1.7 respectively, and both are verified by execution at HEAD `d57ba77f`. No new blocking finding was introduced by the later requirement changes (DEC-21..25, P7): the TC mapping remains exact 37/37, the budgets agree across artifacts and with the observed diff, and the updated system specs agree with the planning documents. The gate is satisfied; delivery evidence may point here.

## 5. Non-blocking residue

1. [minor] **delivery_planning** — the plan's AC-coverage comment lists `AC-F1-3` under P7 while its TC (`TC-M2PLAN-003`) is claimed by P1, and P1's AC list omits it; consequently the parenthetical counts read "(8)" for a 7-item list and "(14)" for a 15-item list. The authoritative per-phase **TC** sets are exact (8/5/2/2/1/5/14 = 37) and the plan validates, so this is a comment-level slip: move `AC-F1-3` from P7's list to P1's and both counts become right.
2. [nit] **PM / phase mirror** — `chg-GH-284-pm-notes.yaml` shows `specification`, `test_planning` and `delivery_planning` with `started: null, completed: null` at HEAD although the artifacts are at spec v2.0 / test plan v2.2 / plan v1.9 and `dor_check`, `delivery` and `system_spec_update` are complete. Artifacts and validation are unaffected; worth a phase-state check before the human gate so the mirror does not read as "never ran".
3. [nit] **test_planning** — P26 prints its checks as tokens with no single verdict line (the gate is read by expected lines). Pre-existing shape, not a defect; noted so a future runner does not expect `P26 verdict:`.

## 6. Code-review cross-reference

`code-review/review-iter-2.yaml` (status FAIL at `a2f45be7`) is the only reason this record is required: its **F-7** asks for a readiness closure record, and its **F-5** evidence says the two NOT_READY blockers are verifiable at HEAD. Both are now verified above. Its two blocking findings are also closed at HEAD and are noted here only for the trail: **F-1** — the §10/§7.2 rows and verification.md now report the passing values (`materially: P11 reachability_missing=0`, `P17/P18 m1_table_*=OK`, `P26 back_pointer_claim=ABSENT`, `P07 depends=expected`; the "Known gate discrepancy" section is gone). **F-2** — the release/removal split is propagated (`architecture.md` component `lease release / remove with reason`, flow step "remove the ref's queue entry / reason: landed", `entrypoint-delta.md` "reason-bearing entry removal", `SC-M2-S15-01 Auto-removal after closeout`, `queue.md` release-vs-remove). Those are code-review matters; they are listed here only because their closure is what makes this readiness verdict durable.
