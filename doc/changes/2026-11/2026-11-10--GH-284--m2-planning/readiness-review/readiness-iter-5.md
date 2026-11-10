# Readiness Review Iteration 5 — pre-delivery satisfiability sweep (P2–P6)

Verdict: NOT_READY
Work Item: GH-284
Date: 2026-11-10
Pause Required: no

**Delivery may not proceed.** P2, P3, P5 and P6 are satisfiable by conforming artifacts. **P4 is not:** P26 contains a token that no conforming delta note can match, so the P4 gate cannot go green. One-line fix in Finding 1; everything else in this sweep is green.

## Method

Built a sandbox repository at `/tmp/sb` with the `fab46636` tree for the five paths the change touches (`backlog.md`, `status.md`, `milestones/README.md`, `milestones/m1/commands/*`), committed as base `b3e80d3a`, then committed each phase's minimal conforming artifact as its own commit and ran that phase's gate procedures with `BASE` bound to the sandbox base commit. `P00` was used unmodified except for `BASE` binding. Procedures were extracted from test plan v1.6 and all 38 pass `bash -n`. `P15` was run with `M1` overridden to the sandbox fixture and `pnpm exec delivery-os` (PATH-resolved) so the live root help was still observed. No artifact was modified.

| Phase | Fixture | Procedures run | Verdict |
|---|---|---|---|
| P2 | 15 pages (14 headers + entrypoint) — commit `76ef308` | P11, P12, P13, P14, P15, P30 | **SATISFIABLE** |
| P3 | `status.md` + 1 section + 4 pointers — commit `0583d11`/`p3b` | P16, P17, P18, P34 | **SATISFIABLE** |
| P4 | 12-file `milestones/m2/` pack | P19, P20, P21, P22, P23, P24, P25, P26, P33 | **UNSATISFIABLE** (P26) |
| P5 | twelve-target index row | P27 | **SATISFIABLE** |
| P6 | accumulated head (30 product paths) | P28, P31, P32, P35, P36, P37 | **SATISFIABLE** |

## P2 — SATISFIABLE

Fixture: 14 status headers rewritten per Appendix B — delivered story + GH ref on every page; `board`/`watchdog`/`mcp` keep the proposal tail *scoped to their named remainder*; the other eleven drop it; `watchdog` keeps `M1-S15 adds progress signals` and `SC-M1-14`; `verify-gates`/`closeout` keep their extension clauses with `GH-225`/`GH-240`; `daemon` states engine delivered (M1-S18/GH-238), command not mounted, delta note — plus `entrypoint.md`'s two-sentence DESCRIPTION rewritten with exactly the sixteen observed families and `state`, `mcp`, the resident daemon as the absent set.

Observed, all as the plan expects:

- `pages=28`; `M1_planned_hits=0`; `M1_milestone_planned_hits=0`; `header_attribution=14/14`; `tail_violations=0`; `watchdog_m1s15=OK`; `watchdog_sc=OK`; `verify_gates_extension=OK`; `closeout_extension=OK`.
- `board → M2-S4`, `watchdog → M2-S2`, `mcp → M3-S2`; daemon header `M1-S18`/`GH-238`/`not mounted`/`entrypoint delta` OK, `Current=ABSENT`, `daemon_body=byte-identical`.
- `changed_pages=14/14 total_hunks=14`, no `OUTSIDE` lines, `entrypoint_hunks=1`, `classifier_inside=OK`, `classifier_outside=OK`, `non_vacuous=yes`; `body_identical=14/14`; `desc_hunks=1`, `outside_desc_hunks=0`, `sentences_removed=2`, `sentences_added=2`, `entrypoint_bound=OK`; `P30 verdict: PASS`.
- `observed_families=16`, `enumerated_families=16`, both set differences empty, `not_registered_extra_families=none`, `dispatch=not-claimed-absent OK`, `enumeration_contains_registration=OK`, `registration_contains_enumeration=OK`; `P15 verdict: PASS`.

Tail rule behaves in both directions: an unscoped `Proposed contract.` on `doctor.md` produced `tail_violations=1` and the `doctor.md tail without remainder (violation)` line; dropping `board.md`'s tail while keeping its M2-S4 remainder still passed (`tail_violations=0`, no `remainder missing`).

Noted (non-blocking): the plan's task 2.5 also says "no header may contain `Current`", but P11 does not ban it globally and P13 checks only `daemon.md`. I put `Status: Current (GH-224); Delivered M1-S3.` into `doctor.md` and P11 still reported `header_attribution=14/14`, `tail_violations=0`. False green against the plan's own rule; low likelihood, one-line hardening.

## P3 — SATISFIABLE

Fixture: one new `## M2 planning snapshot (2026-11-10)` section appended immediately after the file's last line (no leading blank), carrying all eleven P16 markers, plus four pointer insertions: line 2 (title group), after the blank that closes the "M1 delivery starts now" paragraph, after the scheduling-engine section's last line, and as an indented continuation at the end of item 3.

Observed: `S11.S17|S11–S17 OK`, `S1 OK`, `retired OK`, `M2-S4 OK`, `M2-S6 OK`, `#268 OK`, `#280 OK`, `maintenance OK`, `not milestone exit OK`, `literal_pipe=ABSENT`, `exit_overclaim=ABSENT`; all four groups `*_retained=yes` and `*_pointer=yes`, `g4_pointer=1/1`.

`windows(base-anchored): newsec=186..194 title=2..4 paragraph=55..57 scheduling=151..153 items=103..105`; `retention: removed_lines=0 added_lines=13`; `whitelist: section_lines=9 pointer_runs=4 pointer_windows=4 bad_runs=0`; `retention_oracle=OK`; `reference_head_fixture=OK`; `P18 verdict: PASS`; `pointer_groups=4/4`; `sed_line_address_0_errors=0`; `P34 verdict: PASS`.

So the four-window whitelist admits exactly the placements F-7/3.2–3.5 prescribe, and every pointer both sits in its window and names the new section. The one negative I hit was instructive: appending the section with a stray blank line before the heading produced `OUTSIDE: added lines 186..195`, `bad_runs=1`, `retention_oracle=FAILED` — task 3.1 already forbids that leading blank, so the rule is satisfiable and the oracle is not vacuous.

## P4 — UNSATISFIABLE (P26)

Fixture: 12 files — `README.md`, `architecture.md` (3 `## C4 Level <n>: <subject>` each owning one diagram, `## Key flows` with exactly seven `###` each owning one diagram, 10 fences, persistence/concurrency and boundary-invariants sections), `contracts.md` (all 29 P21 markers), `test-scenarios.md` (32 `### SC-M2-*` headings, two per story S2–S17, twelve mandatory anchors), `journeys.md` (5 journeys incl. resume and other-provider isolation), `entrypoint-delta.md`, and six command pages with `# <name>(1)`, line 3 `Status: Proposed (M2)`, `<binary>`, and the seven sections plus `envelope`.

Green: `pack_files=12/12 actual_files=12 readme_lists=12/12 story_map_entries=16 deviation_statement=OK readme_self_link_self_test=detected pack_contents_table=byte-identical`; P20 headings all OK; `contract_markers_missing=0`; `scenario_headings=32`, every S2–S17 `=2`, `stories_below_two=0`, twelve mandatory anchors OK; `journey_headings=5` with all patterns, `cost-control resume OK`, `cost-control isolation OK`; `command_headers=6/6`; `attempts=dispatch subfamily OK`, `events=subscribe taxonomy OK`; `mermaid_fences=10`, `C4 Level 1/2/3 has diagram=OK (heads=1 own=1)`, `c4_headings_with_diagrams=3/3`, `flow_headings=7`, `flow_headings_with_diagrams=7/7`, `flow_section=OK`, `heading_association=OK`, `fixture_good=OK`, `fixture_good_metrics=3/3,7/7,OK`, `fixture_negative=detected`.

**Finding 1 (blocking) — P26's `entrypoint\.md` token can never match.** P26 greps a token list with `grep -Fiq` (fixed string), and the last token is `'entrypoint\.md'`. With `-F` the backslash is literal, so the check requires the document to contain `entrypoint\.md`. Any conforming delta note contains `entrypoint.md` and prints:

```
dispatch OK … exit 1 OK / outside this OK / entrypoint\.md MISSING
```

Verified in isolation: `printf 'See [entrypoint.md](…)' | grep -Fq -- 'entrypoint\.md'` → no match; `grep -Eiq` → match; a literal `entrypoint\.md` → match. Verified as a fix: replacing the token with `'entrypoint.md'` (the loop is `-F`, so no escape is needed) and re-running P26 on the same delta note gives all ten tokens `OK`, including `entrypoint.md OK`.

This contradicts both gates' own expectations — plan P4: "… `exit 1`, `outside this`, `entrypoint.md` all OK", and TC-026: "All eleven markers `OK`, including … `entrypoint.md`". No conforming artifact can satisfy it, so P4 halts exactly like P03/P08 and P29 did. Pre-existing (the token predates v1.6); it only surfaces on a real delta note, and the pre-change control prints `delta=absent`.

**Fix (one line):** in P26, `'entrypoint\.md'` → `'entrypoint.md'` (or `grep -Fiq` → `grep -Eiq` for that loop). Owner: test_planning. While there, TC-026 says "eleven markers" but lists ten.

## P5 — SATISFIABLE

Fixture: one `| M2 (…, planned) | … |` row after the M1 row with twelve `m2/<artifact>` links on the same physical line; M0/M1 rows untouched.

Observed: `m2_targets=12/12` with all twelve listed, `m2_row_marked_planned=yes`, `M0 (trust substrate row=identical`, `M1 (delivery engine row=identical`.

## P6 — SATISFIABLE

- **P28** on the accumulated head: `product_files=30`, `forbidden_root_files=0`, `outside_planning=0`, `unexpected_paths=0`, `matcher_self_test=OK`, `non_vacuous=yes` (1 backlog + 1 status + 1 index + 15 command pages + 12 pack = 30).
- **P31** (real repo, unchanged tree): `guard_exit=0`, `(guard-doc-distribution)[OK] no drift — 82 in-scope docs`, `planning_markers=0`.
- **P32** (real repo, one full pair, run to completion): `default_exit=1 default_failed_tests=1 default_failure_class=environmental (ci-baseline-parity only)`; `default_failures=CI baseline parity (hermetic partial clone) …`; `repo_tmpdir_exit=0`; `gate_verdict=PASS`. The suite now runs **7137** tests rather than the 7132/7133 recorded earlier; the gate is token-based (one failing test, named) and has no exact-count coupling, so the drift is harmless — worth knowing, not worth changing.
- **P35** on the ticket-faithful P1 draft (seven stories transcribed verbatim + the two amendments): `clause_scan: total=79 present=79 missing=0`, `missing_clauses=0`, `s17_missing_criteria=0`, `added_criteria=0`.
- **P36**: `bun run scripts/checks/forbidden-literals.ts` → `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`; seed scan over 652 added planning lines in the sandbox → `seed_hits=0`.
- **P37** on the accumulated head with a complete tree: `changed_planning_files=30`, `broken_links=0`, `restated_ac_blocks=0`, `non_vacuous=yes`. (My first run showed 27 broken links purely because the sandbox held only `milestones/m1/commands`; after restoring the rest of `doc/` they are all pre-existing links that resolve, and the count went first to 1 — `m0/architecture.md` — then to 0.)

Also re-verified in the same head (P1 gates, since P6 re-runs them): P01 `7/7` + `shape_ok=7/7`; P02 `61/61`; P03 `window=1167:1279`, `separator_sequence=identical`, `blank_separation=OK`, `hunks: inside=4 outside=0`, `classifier_self_tests=4/4`, `P03 verdict: PASS`; P04 `ac_numbered_items=7/7`; P05 `6/6`; P06 `criteria_present=7/7` with `S17-AC1..AC7 OK`; P07 `depends=expected`, `M2-S4 shape OK`; P08 `changed_lines=3`, `base_task_lines_missing=0`, `- Goal: identical`, `- AC: identical`; P09 `67→74`, `order=OK`; P10 `fm/rg/cc=byte-identical`; P29 four runs `65/65/0 order=OK` with `negative_body`/`negative_removed`/`negative_reordered` all detected.

## Non-blocking residue

2. [minor] test_planning — P11 does not ban `Current` in headers other than `daemon.md`, although plan task 2.5 says "no header may contain `Current`" (demonstrated false green above). Add `Current` to P11's global header ban.
3. [nit] test_planning — TC-026 says "All eleven markers `OK`" but the token list holds ten; align the count when fixing the token.
4. [nit] delivery_planning — the plan's P6 comment says the default run is "roughly 7132 passing"; the suite is now 7137. It is a comment, not an assertion, but the number will keep drifting.
5. [nit] delivery_planning — the P4 gate's `P26` expectation lists `entrypoint.md`, so after the P26 fix the plan text needs no change; recording it here only so the phase-8 reviewer does not "fix" the plan instead of the procedure.

## Bottom line

P2, P3, P5 and P6 are satisfiable, and I confirmed each with a conforming fixture rather than a reading: the 14-page header set with scoped tails and the sixteen-family entrypoint pass P11–P15/P30; the status snapshot with four pointers passes P16–P18/P34; the twelve-file pack passes P19–P25/P33; the index row passes P27; and the 30-path containment, guards, 79-clause fidelity and link checks all pass. The sweep also exercised the false-green direction where it matters (unscoped tail, leading blank before the new section, one `Current` header).

**One blocking defect remains: P26's `entrypoint\.md` is a fixed-string search for a literal backslash, so P4 cannot go green.** Change it to `entrypoint.md` (or switch that loop to `grep -Eiq`), and this sweep should close.
