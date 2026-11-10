# GH-284 delivery evidence — M2 planning

Change: GH-284 *Plan M2: engine-first operations, multi-repo workstations,
evidence inspection, and telemetry* (docs-only).
Base revision: `fab46636cc0b5abfbd22257711f594adc0af4660` (`origin/main-tools`).
Branch: `docs/GH-284/m2-planning`.
Procedures: materialised by copy from `chg-GH-284-test-plan.md` v1.8 §7.1
(`/tmp/gh284/procedures-v18/pNN.sh`), never retyped and never committed.
Recorded: 2026-11-10.

## Phase commits

| Phase | Commit | Scope |
|---|---|---|
| P1 | `1842e181` + remediation `110fb160` | `backlog.md`: M2-S11..S17, M2-S4 and M2-S6 amendments (the remediation re-wrapped one S17 task clause so two P35 anchors stay contiguous) |
| P2 | `57120f4e` | 14 status headers + `milestones/m1/commands/entrypoint.md` |
| P3 | `5e00d4f2` | `status.md`: one dated 2026-11-10 section and four pointers |
| P4 | `39bb4afb` | the twelve-document `milestones/m2/` pack |
| P5 | `13171be1` | `milestones/README.md` M2 index row |
| P6 | `166df7ff` (registration) and this evidence commit | `scripts/checks/forbidden-literals.registry.json` (twelve registrations) + change evidence |

## TC → procedure → observed result

| TC | AC | Procedure | Observed |
|---|---|---|---|
| TC-M2PLAN-001 | AC-F1-1 | P01 | `m2_story_headings=7 new_found=7/7 order=OK`; `shape_ok=7/7`; `P01 verdict: PASS` |
| TC-M2PLAN-002 | AC-F1-2 | P02 | `M2-S11 9/9`, `S12 8/8`, `S13 11/11`, `S14 12/12`, `S15 10/10`, `S16 11/11`; `clause_scan: total=61 present=61 missing=0`; PASS |
| TC-M2PLAN-003 | AC-F1-3 | P03 | `window=1167:1278`; `window_empty=no`; `separator_sequence=identical`; `blank_separation=OK (head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169)`; `fixture_blank_separation=OK`; `backlog_hunks=4`; `hunks: inside=4 outside=0`; `classifier_self_tests=4/4`; `insertion_below_separator=never`; `non_vacuous=yes`; PASS |
| TC-M2PLAN-004 | AC-F2-1 | P04 | four labels present; `M1-S15/M1-S18/M1-S21/M1-S22/M2-S14/#280` OK; `ac_numbered_items=7/7` |
| TC-M2PLAN-005 | AC-F2-2 | P05 | six clauses OK; `softening may=ABSENT`; `clauses_present=6/6` |
| TC-M2PLAN-006 | AC-F2-3 | P06 | `S17-AC1..AC7 OK`; `criteria_present=7/7`; `ac_numbered_items=7/7`; `extra_criteria=0`; `duplicate_numbers=0`; `extra_self_test=detected (8 items, extra=1)`; `duplicate_self_test=detected` |
| TC-M2PLAN-007 | AC-F3-1 | P07 | `changed_lines=2 unexpected_lines=0`; `depends=expected`; goal-mutation self-test `changed_lines=4 unexpected_lines=2` |
| TC-M2PLAN-008 | AC-F3-2 | P08 | `changed_lines=3`; `tasks_clause=OK`; `depends=M2-S14 OK`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`; `fixture_task_lines_missing=0`; `fixture_s6_task_lines=3->4`; `fixture_ac_identity=identical`; `fixture_p08=OK` |
| TC-M2PLAN-009 | AC-F4-1 | P09 | `base_headings=67 head_headings=74 added=7 removed=0 unexpected=0`; `retirement_note=identical`; `order=OK`; `negative_control=detected` |
| TC-M2PLAN-010 | AC-F4-2 | P10 | `fm=byte-identical`; `rg=byte-identical`; `cc=byte-identical` |
| TC-M2PLAN-011 | AC-F5-1 | P11 | `pages=28`; `M1_planned_hits=0`; `M1_milestone_planned_hits=0`; `header_attribution=14/14`; `forbidden_phrase_pages=0`; `tail_violations=0`; `current_violations=0`; `watchdog_m1s15=OK`; `watchdog_sc=OK`; `verify_gates_extension=OK`; `closeout_extension=OK`; `real_headers=PASS` |
| TC-M2PLAN-012 | AC-F5-2 | P12 | `board.md -> M2-S4 OK`; `watchdog.md -> M2-S2 OK`; `mcp.md -> M3-S2 OK` |
| TC-M2PLAN-013 | AC-F5-3 | P13 | `header M1-S18 OK`; `GH-238 OK`; `not mounted OK`; `entrypoint delta OK`; `Current=ABSENT`; `daemon_body=byte-identical` |
| TC-M2PLAN-014 | AC-F5-4 | P14 | `changed_pages=14/14 total_hunks=14`; zero `OUTSIDE` lines; `entrypoint_hunks=1`; `classifier_inside=OK`; `classifier_outside=OK`; `non_vacuous=yes` |
| TC-M2PLAN-015 | AC-F6-1 | P15 | `observed_families=16`; `enumerated_families=16`; both set differences empty; `not_registered: state OK, mcp OK, resident daemon OK`; `dispatch=not-claimed-absent OK`; `not_registered_extra_families=none`; `desc_hunks=1 outside_desc_hunks=0 sentences_removed=2 sentences_added=2`; `entrypoint_bound=OK`; `positive_two_sentence=OK`; `negative_merged=detected`; PASS |
| TC-M2PLAN-016 | AC-F7-1 | P16 | `new_sections=1`; markers `23 of 23`, `S2–S10`, `S11–S17`, `S1`, `retired`, `M2-S4`, `M2-S6`, `#268`, `#280`, `maintenance`, `not milestone exit` all OK; `literal_pipe=ABSENT`; `exit_overclaim=ABSENT`; `alternation_self_test=OK` |
| TC-M2PLAN-017 | AC-F7-2 | P17 | `title_base_retained=yes title_pointer=yes`; `g2_bytes_retained=yes g2_pointer=yes`; `g3_bytes_retained=yes g3_pointer=yes`; `g4_bytes_retained=yes g4_pointer=1/1` |
| TC-M2PLAN-018 | AC-F7-3 | P18 | `windows(base-anchored): newsec=186..211 title=2..4 paragraph=55..57 scheduling=151..153 items=103..105`; `retention: removed_lines=0 added_lines=30`; `whitelist: section_lines=26 pointer_runs=4 pointer_windows=4 bad_runs=0`; `retention_oracle=OK`; `negative_modified=detected`; `negative_outside=detected`; `positive_pointer=permitted`; `reference_head_fixture=OK`; PASS |
| TC-M2PLAN-019 | AC-F8-1 | P19 | `pack_files=12/12 actual_files=12`; `readme_lists=12/12 story_map_entries=16`; `deviation_statement=OK`; `readme_self_link_self_test=detected`; `pack_contents_table=byte-identical` |
| TC-M2PLAN-020 | AC-F8-2 | P20 | C4 Level 1/2/3 headings OK; all seven flow headings OK; `persistence`, `concurrency`, `boundary invariants` deltas OK |
| TC-M2PLAN-021 | AC-F8-3 | P21 | `contract_markers_missing=0` (29 surfaces) |
| TC-M2PLAN-022 | AC-F8-4 | P22 | `scenario_headings=38`; every story S2..S17 `>=2`; `stories_below_two=0`; twelve mandatory anchors OK |
| TC-M2PLAN-023 | AC-F8-5 | P23 | `journey_headings=5`; all five patterns OK; `cost-control resume OK`; `cost-control isolation OK` |
| TC-M2PLAN-024 | AC-F9-1 | P24 | `command_headers=6/6` |
| TC-M2PLAN-025 | AC-F9-2 | P25 | every page has an empty missing list (SYNOPSIS/OPTIONS/OUTPUT/EXIT STATUS/EXAMPLES/ERRORS/SEE ALSO/envelope); `attempts=dispatch subfamily OK`; `events=subscribe taxonomy OK` |
| TC-M2PLAN-026 | AC-F10-1 | P26 | `dispatch/coordinator/state/mcp/daemon/unknown flag/unexpected argument/exit 1/outside this/entrypoint.md` all OK |
| TC-M2PLAN-027 | AC-F11-1 | P27 | `m2_targets=12/12`; `m2_row_marked_planned=yes`; `M0 (trust substrate row=identical`; `M1 (delivery engine row=identical` |
| TC-M2PLAN-028 | AC-NFR1-1 | P28 | `product_files=31`; `planning_files=30 registry_files=1 outside_planning_outside_registry=0`; `forbidden_root_files=0`; `unexpected_planning_paths=0`; `matcher_self_test=OK`; `non_vacuous=yes` |
| TC-M2PLAN-029 | AC-NFR2-1 | P29 | `stories_compared=65 identical=65 changed=0 order=OK`; `real_head=PASS`, `base_control=PASS`, `minimal_head=PASS`, `full_head=PASS`; `negative_body/removed/reordered=detected` |
| TC-M2PLAN-030 | AC-NFR3-1 | P30 | `body_identical=14/14`; `entrypoint_bound=OK (desc_hunks=1, outside_desc_hunks=0, sentences_removed=2, sentences_added=2)`; PASS |
| TC-M2PLAN-031 | AC-NFR4-1 | P31 | `guard_exit=0`; `(guard-doc-distribution)[OK] no drift — 82 in-scope docs`; `planning_markers=0` |
| TC-M2PLAN-032 | AC-NFR5-1 | P32 | `default_exit=1 default_failed_tests=1 default_failure_class=environmental (ci-baseline-parity only)`; `repo_tmpdir_exit=0`; `gate_verdict=PASS` (see both runs below) |
| TC-M2PLAN-033 | AC-NFR6-1 | P33 | `mermaid_fences=10`; `keyword_and_fence_exit=0`; `C4 Level 1/2/3 has diagram=OK (heads=1 own=1)`; `c4_headings_with_diagrams=3/3`; `flow_headings=7`; `flow_headings_with_diagrams=7/7`; `flow_section=OK`; `heading_association=OK`; `fixture_good=OK`; `fixture_good_metrics=3/3,7/7,OK`; `fixture_negative=detected` |
| TC-M2PLAN-034 | AC-NFR7-1 | P34 | `retention_oracle=OK`; `pointer_groups=4/4`; `sed_line_address_0_errors=0`; PASS |
| TC-M2PLAN-035 | AC-NFR8-1 | P35 | `clause_scan: total=79 present=79 missing=0`; `missing_clauses=0`; `s17_missing_criteria=0`; `added_criteria=0`; `changed_meaning=manual clause-by-clause review (declared gap G-1)` |
| TC-M2PLAN-036 | AC-NFR9-1 | P36 | `registered_total=139`; `m2_registry_sorted=yes`; `m2_registry_duplicates=0`; `registry_m2=12/12 baseline_absent=12/12`; `registry_sorted_self_test=detected`; `registry_duplicate_self_test=detected`; `forbidden_exit=0`; `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`; `unregistered_findings=0`; `added_lines=1665`; `seed_hits=0 non_vacuous=yes` |
| TC-M2PLAN-037 | AC-NFR10-1 | P37 | `changed_planning_files=30`; `broken_links=0`; `restated_ac_blocks=0`; `non_vacuous=yes` |

## Plan validation

```
$ pnpm exec delivery-os plan validate GH-284
verdict=valid
artifact=yaml:chg-GH-284-plan.yaml
tier=lite
readyForDevelopment=true
```

## Containment (§6.1, TC-028)```
product_files=31
planning_files=30 registry_files=1 outside_planning_outside_registry=0
forbidden_root_files=0
unexpected_planning_paths=0
matcher_self_test=OK
non_vacuous=yes
```

The 31 product paths are `doc/planning/oss-tooling/backlog.md`,
`doc/planning/oss-tooling/status.md`,
`doc/planning/oss-tooling/milestones/README.md`, the fifteen
`doc/planning/oss-tooling/milestones/m1/commands/*.md` pages, the twelve
`doc/planning/oss-tooling/milestones/m2/**` documents, and
`scripts/checks/forbidden-literals.registry.json` (the single permitted
non-planning product file, DEC-21).

## Registry registration (D-14, DR-20, DEC-21)

Twelve entries appended to `registered` after the M1 block, sorted among
themselves, duplicate-free, with no existing entry reordered and
`corpusBaseline` untouched:

```
registered_total=139
m2_registry_sorted=yes
m2_registry_duplicates=0
registry_m2=12/12 baseline_absent=12/12
```

## Aggregate gate — both runs (D-12, DEC-19, TC-032)

Run 1, default `TMPDIR`:

```
$ pnpm check
default_exit=1
default_failed_tests=1
default_failures=CI baseline parity (hermetic partial clone) > a depth-1 checkout fails closed and the baseline fetch is the remedy
default_failure_class=environmental (ci-baseline-parity only)
```

Run 2, repository-filesystem `TMPDIR` (P32 creates it):

```
$ mkdir -p "$REPO_ROOT/tmp/tmpdir" && TMPDIR="$REPO_ROOT/tmp/tmpdir" pnpm check
repo_tmpdir_exit=0
gate_verdict=PASS
```

The lone default-run failure is `tests/checks/ci-baseline-parity.test.ts`
(`git clone --local` hardlinks crossing into tmpfs), the documented
environmental exemption; every other stage passed in both runs. Before the
registry registration the default run reported four failures — that one plus
three forbidden-literals tests — and both runs were red; the registration
reduced it to the single environmental failure and the repo-local run to exit
0.

## Doc-distribution guard (TC-031)

```
guard_exit=0
(guard-doc-distribution)[OK]   no drift — 82 in-scope docs; install set matches ados_distribution markers
planning_markers=0
```

## Fidelity evidence (TC-002, TC-035)

P02 (S11-S16, 61 rows): `clause_scan: total=61 present=61 missing=0`, with
per-story counts `9/9`, `8/8`, `11/11`, `12/12`, `10/10`, `11/11`.
P35 (all 79 rows including S17 and both amendments):
`clause_scan: total=79 present=79 missing=0`, `missing_clauses=0`,
`s17_missing_criteria=0`, `added_criteria=0`. P04/P06 report
`criteria_present=7/7` with `S17-AC1..AC7 OK` by content.

## Status retention evidence (TC-018, TC-034)

```
windows(base-anchored): newsec=186..211 title=2..4 paragraph=55..57 scheduling=151..153 items=103..105
retention: removed_lines=0 added_lines=30
whitelist: section_lines=26 pointer_runs=4 pointer_windows=4 bad_runs=0
retention_oracle=OK
oracle=whole-file-line-retention (whole-section cmp not used)
reference_whitelist: section_lines=3 pointer_runs=4 pointer_windows=4 bad_runs=0
reference_head_fixture=OK
pointer_groups=4/4
sed_line_address_0_errors=0
```

No whole-section `cmp` was used as an oracle at any point.

## Backlog insertion evidence (TC-003)

```
insertion window: start=base M2-S9 last content+1=1167 end=head separator-1=1278 window=1167:1278
window_empty=no
separator_sequence=identical
blank_separation=OK (head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169)
fixture_blank_separation=OK
backlog_hunks=4
hunks: inside=4 outside=0
classifier_self_tests=4/4
insertion_below_separator=never
```

## Page and entrypoint evidence (TC-011, TC-014, TC-015, TC-030)

`pages=28`; `M1_planned_hits=0`; `M1_milestone_planned_hits=0`;
`header_attribution=14/14`; `tail_violations=0`; `current_violations=0`;
`watchdog_m1s15=OK`; `watchdog_sc=OK`; `verify_gates_extension=OK`;
`closeout_extension=OK`; `changed_pages=14/14 total_hunks=14`;
`entrypoint_hunks=1`; `body_identical=14/14`;
`observed_families=16`, `enumerated_families=16`, `not_registered_extra_families=none`;
`entrypoint_bound=OK` with `desc_hunks=1`, `outside_desc_hunks=0`,
`sentences_removed=2`, `sentences_added=2`.

## Pack and index evidence (TC-019, TC-027, TC-033)

`pack_files=12/12 actual_files=12`; `readme_lists=12/12`;
`story_map_entries=16`; `deviation_statement=OK`;
`readme_self_link_self_test=detected`;
`pack_contents_table=byte-identical`;
`m2_targets=12/12`; `m2_row_marked_planned=yes`; M0 and M1 rows identical;
`mermaid_fences=10`; `heading_association=OK`;
`c4_headings_with_diagrams=3/3`; `flow_headings_with_diagrams=7/7`.

## Residuals and manual reads owed by review

- **XF-9 (accepted residual, plan-level).** `head_line_for_base` still treats
  every hunk's new-side count as an insertion, so a *replacement* hunk above a
  pointer window over-shifts the windows and reports the pointers OUTSIDE
  instead of naming the replaced line. Not a false-PASS risk: the same oracle
  prints `removed_lines>0` and fails, and this change's status head contains
  only pure insertion hunks. Recorded, not fixed; hardening (`d>0` reports the
  hunk instead of shifting) is deferred.
- **G-1 clause semantics** — a paraphrase read of the seven entries and two
  amendments against GH-284, using the 79-row table as the checklist, is owed
  by `@reviewer`.
- **G-3 mermaid rendering** — the reviewer opens the rendered preview for
  `milestones/m2/architecture.md`; the structural procedure cannot prove
  syntax.
- **G-4 private/Vendor names** — the reviewer reads the added lines against
  NFR-9; no hosted, proprietary, fleet, repository, or product name appears,
  and provider examples use `profile-a` / `profile-b`.
- **G-5 restated criteria** — the reviewer checks that the pack references
  story codes and does not paraphrase an acceptance block; P37 reports
  `restated_ac_blocks=0`.
- **G-6 header/pointer/entrypoint wording** — the reviewer reads the fifteen
  edited headers, the four pointers, and the corrected DESCRIPTION region;
  token checks pass as recorded above.

## Close-out statement

No tracker ticket was created for M2-S11..S17; no M2 story was delivered; no
product behaviour changed (DEC-1, NG-1, NG-2, NG-4). The M2 pack is proposed
until milestone exit (DEC-4). `doc/spec/**` is unchanged because this change
delivers no behaviour to reconcile (NG-3). The single `scripts/**` edit is the
forbidden-literals registration required by the guard (DEC-21); the guard
implementation and its tests are untouched.
