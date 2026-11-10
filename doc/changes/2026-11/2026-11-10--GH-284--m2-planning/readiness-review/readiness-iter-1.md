# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-284
Date: 2026-11-10
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

## What was verified independently (not taken on trust)

- **Ticket fidelity source.** Read `gh issue view 284` in full; compared each ticket section against spec §5.1, Appendix A, and the test plan's anchor matrix.
- **Repository facts.** `milestones/m1/commands` holds 28 pages; 9 say `M1 planned (<story>)` for a delivered story (`blockers, board, doctor, mcp, merge, retro, state, verify-deploy, watchdog`), 2 say `M1 milestone planned` (`commit`, `plan`), 2 attribute a delivered extension as proposed (`closeout`, `verify-gates`), `daemon.md` says `Current (GH-238 delivered)`, and `entrypoint.md` enumerates 14 families while listing `state`, `mcp`, `dispatch`, and the resident daemon as unregistered. Appendix B's 14+1 set is therefore complete and not over-broad; the 13 untouched pages do state delivered/shipped status consistently.
- **System-spec consistency.** `doc/spec/features/` carries delivered specs for every surface the set touches. `feature-cli-entrypoint.md` says exactly "`state` and `mcp` are not registered … The resident daemon is not part of the prompt-required composition", which is what the corrected page must say; `feature-resident-daemon.md` documents the command family as delivered behaviour, so "engine delivered, command not mounted" is the consistent correction and no `doc/spec` edit is needed.
- **Observed entrypoint truth.** Ran `bun packages/cli/bin/delivery-os.ts --help`: 16 families in the recorded order, no `daemon`/`mcp`/`state`; `daemon --help` → `unknown flag "--help"`, `daemon status` → `unexpected argument "status"`. `packages/cli/src/edge.ts` composes the daemon command only when `options.daemon !== undefined`. Appendix C is accurate.
- **Backlog insertion geometry.** `M2-S9` ends at base line 1166, blank at 1167, `---` at 1168, blank at 1169, `## Epic M3` at 1170; the `---` is the epic-block separator and DEC-17's pinned position is correct.
- **Procedure executability.** Extracted and ran P00, P03, P11, P15, P18, P28, P31, P34, P36, P37 against the pre-change tree. Recorded control values reproduce exactly (`window=1167:1167`, `separator_sequence=identical`, `classifier_self_tests=4/4`, `M1_planned_hits=9`, `M1_milestone_planned_hits=2`, `header_attribution=2/14`, `observed_families=16`, `enumerated_families=14`, `families_not_enumerated=coordinator dispatch`, `reference_head_fixture=OK`, `82 in-scope docs`, `planning_markers=0`, `5/5 scope classes, 0 violations`). The test plan was genuinely executed.
- **Plan schema.** `pnpm exec delivery-os plan validate GH-284` → `verdict=valid`, `readyForDevelopment=true`, `tier=lite`.
- **Traceability arithmetic.** 37 AC ↔ 37 TC ↔ 37 plan mappings is exact and non-duplicated across P1..P6 (`11+6+4+9+1+6`); phase file scopes are disjoint except `doc/changes/**` in P6; P02's 81 anchors match the declared per-story counts (10/15/11/21/12/12).
- **Declared gaps G-1..G-9.** Honest about what commands cannot prove (meaning, wording, mermaid syntax, private names, pack quality) and each has a named owner.
- **P18 replacement-hunk question (the plan-writer's last item).** `head_line_for_base` adds the new-side count for every hunk above the target, so a replacement hunk would over-shift the windows and mislabel the offending run. This is **plan-acceptable**: a replacement hunk means `removed_lines>0`, which the same oracle fails on, so no false PASS is possible. See F14 for a one-line hardening.

## Findings

1. [major] cross_artifact_consistency — spec §5.1 F-2 / §17.1 AC-F2-1, AC-F2-3; test plan P04, P06
   Gap: S17's seven acceptance criteria are never enumerated anywhere. F-2 lists only the six task clauses; AC-F2-1 requires "seven numbered criteria matching the ticket one-for-one" and AC-F2-3 says the list exists "so a test plan can map one criterion to one check", but P04 (`ac_numbered_items=7/7`) and P06 (`ac_items=7/7`, `duplicate_numbers=0`) verify only the count and the numbering. Ticket criteria 3 ("lanes using other providers are unaffected"), 4 ("no branch, artifact, or queue state is lost or duplicated"), and 6 ("stop, park, and resume are auditable ledger events surfaced in status and brief") appear in no spec requirement, no P02/P05 anchor and no procedure; a delivered S17 that omits criterion 6 passes every gate. This is the owner-hard story DEC-1 exists to protect.
   Suggested remediation target phase: specification
   Suggested fix: enumerate the seven S17 criteria verbatim in F-2 (or a new Appendix), make AC-F2-1 assert content rather than count, and have the test plan anchor each of the seven.

2. [major] cross_artifact_consistency — test plan §1.2 G-1, P02, P35; spec AC-F1-2
   Gap: G-1 states "the matrix makes a silent drop visible because each ticket clause has at least one anchor", and AC-F1-2 claims "Zero clauses are missing". Both are false at acceptance-criterion granularity. Unanchored ticket clauses include S12 "a recorded divergence can be resolved **with a note**", S13 "a client subscribed to `queue.graph` observes entry and dependency changes **it can act on**", S15 "{refused} **with a classified error naming the holder**" and "reconcilable **without editing state files**", S16 "**consecutive engine dispatches with corroborated outcomes accrue** in the summary", S11 "hold **disjoint phase state and queue entries**" and "enumerates them **without manual configuration**". None of these strings exists in the spec or in P02's anchor set, and P35's `missing_clauses` is only the sum of the P02/P05/P06 counts, so the fidelity oracle reports green on a matrix that lacks them.
   Suggested remediation target phase: test_planning
   Suggested fix: extend the P02 anchor sets with one anchor per ticket AC clause (and per S17 criterion), or correct G-1's coverage claim and enumerate the missing clauses as an explicit reviewer checklist.

3. [major] cross_artifact_consistency — spec §4.1 KPI, NFR-5, AC-NFR5-1, RSK-9, §17.3 DoD vs test plan G-2/P32 and plan D-12
   Gap: the spec requires plain `pnpm check` to exit 0 (NFR-5, KPI row, AC-NFR5-1, DoD bullet 6) and never mentions the environment caveat. Reproduced in this checkout: `bun test tests/checks/ci-baseline-parity.test.ts` fails with `Błędne dowiązanie między urządzeniami` (`git clone --local` crossing into tmpfs `/tmp`), and the same test passes with a repository-filesystem `TMPDIR`. The test plan (G-2, P32) and the plan (D-12) therefore treat `TMPDIR=… pnpm check` as authoritative while the normative spec text contradicts them. This is the same unsatisfiable-criterion class that caused the v1.2 and v1.3 reopens.
   Suggested remediation target phase: specification
   Suggested fix: qualify NFR-5/AC-NFR5-1/KPI/DoD with the repository-filesystem `TMPDIR` invocation (or "in the authoritative CI run"), and add the environment fact to §12 Assumptions with the one-line authority statement already used in D-12.

4. [major] cross_artifact_consistency — spec F-5 / DM-2; plan P2 task 2.1; test plan P11
   Gap: the "Proposed contract" / "Proposed examples" tail is part of the status header but is not covered by the reconciliation rule. Six pages with no planned remainder (`doctor`, `state`, `merge`, `verify-deploy`, `blockers`, `retro`) would read "Delivered M1-Sx (GH-nnn). Proposed contract." — still a planned-status claim on a fully delivered page — and P11 passes because it only requires the attribution tokens and bans the two phrases. Existing repo convention is unambiguous: every already-delivered page has dropped "Proposed contract" (`dispatch` → "Implemented contract", `provider` → "Shipped behavior summarized", `queue`/`spend`/`lanes`/`status` → no proposal tail). The same undecided rule also licenses dropping `watchdog.md`'s correct "M1-S15 adds progress signals" and its scenario reference (Appendix B omits both).
   Suggested remediation target phase: specification
   Suggested fix: state in F-5/DM-2 whether the proposal tail is a pack-level label (DEC-4, preserved and explained) or must be dropped/scoped to the remaining scope; add the corresponding token check to P11 and list in Appendix B which header text must survive each edit.

5. [minor] test_traceability — test plan P34 and its precondition note; plan P3/P6 ordering
   Gap: P34 calls `ptr()`, which is defined in P17, but the procedure guard and the plan's note say only "run P18 first". Executed as documented in the plan note (`P18` then `P34`), P34 prints four `ptr: command not found` errors and `pointer_groups=0/4` (reproduced). The declared gate order `P16/P17/P18/P34` works, so this is a false-failure trap rather than a wrong gate.
   Suggested remediation target phase: test_planning
   Suggested fix: say "run P16, P17, P18 first" in the P34 guard message, or define `ptr()` locally in P34.

6. [minor] cross_artifact_consistency — plan P6 task 6.3 and test plan §7.2 (TC-M2PLAN-032 row) vs P32
   Gap: P32 correctly does `mkdir -p "$TMPDIR"`, but the plan's 6.3 and the §7.2 execution-command column quote only `TMPDIR="$(git rev-parse --show-toplevel)/../.tmp-gh284" pnpm check`. Reproduced: with that directory absent the run dies with `ENOENT … mkdtemp` and reports a false gate failure. It works here only because `../.tmp-gh284` already exists.
   Suggested remediation target phase: delivery_planning
   Suggested fix: quote the copy-safe form in 6.3 (`mkdir -p "$TMPDIR" && TMPDIR=… pnpm check`) or point 6.3 at "run P32(b)" instead of restating the command.

7. [minor] ac_quality — spec AC-NFR6-1 (d); test plan P33
   Gap: AC-NFR6-1 (d) claims each diagram sits under a heading naming its subject, but P33 only counts headings and fences independently (3 C4, 6 flows, 1 park; ≥10 mermaid fences). Ten diagrams placed under the wrong headings, or seven diagrams plus three empty blocks, would pass. G-3 declares only mermaid *syntax* as untestable, not this association.
   Suggested remediation target phase: test_planning
   Suggested fix: either add an association assertion (each mermaid block's nearest preceding heading matches the expected token) or extend G-3/G-9 to declare the association as review-only.

8. [minor] cross_artifact_consistency — `milestones/README.md` "Pack contents" table; spec F-8/F-11; plan P5 task 5.2
   Gap: the index's contents table says `man-page.md` and `interactions.md` are present for "every milestone with an operational CLI (M1 on)", but the M2 pack deliberately ships neither (it ships an entrypoint delta note instead) and P5 leaves the table byte-identical. The change edits that file and exists to remove exactly this kind of stale convention claim; the deviation is recorded only in pm-notes, not in a decision or in the spec.
   Suggested remediation target phase: specification
   Suggested fix: record the deviation (a DEC or one F-8 sentence) and either annotate the contents table within P5's row-only scope or state why the table stays as written.

9. [nit] ac_quality — spec AC-F5-4, AC-NFR3-1, AC-F6-1
   Gap: the three criteria assert substantially the same containment check (P14 and P30 run the same predicates), so the "37 AC ↔ 37 TC" one-to-one count includes duplicated coverage. Not harmful, but it overstates distinct verification.
   Suggested remediation target phase: test_planning
   Suggested fix: leave as is and note the overlap in §3.1, or differentiate the three criteria (page body / entrypoint bound / exact family set) so each owns a distinct predicate.

10. [minor] spec_completeness — spec AC-F11-1 vs F-11
   Gap: F-11 says the M2 row follows "the existing row shape" (the M1 row links six artifacts and not `commands/`), while AC-F11-1 and plan P5 require links to `m2/README.md` and **each** of the twelve artifacts. Two defensible readings, one AC.
   Suggested remediation target phase: specification
   Suggested fix: pick one (recommend the twelve-link row, since the pack has no `man-page.md`) and drop the "existing row shape" clause or scope it to formatting.

11. [minor] decision_capture — spec DEC-6
   Gap: DEC-6 asserts a repo-wide interpretation ("no `ados_distribution` marker in `doc/planning/**`") by reading `AGENTS.md` as narrowing `pm-instructions.md`. That is a precedent-setting documentation rule, recorded only as a change-local decision.
   Suggested remediation target phase: specification
   Suggested fix: keep DEC-6 for this change and hand the interpretation to `@decision-advisor` (ODR) or to an `AGENTS.md` wording fix so the next planning change does not re-litigate it.

12. [nit] cross_artifact_consistency — spec §18 vs plan revision header
   Gap: §18 recommends four commits (backlog / contract pages / status / pack+index); the plan declares six phases and one commit each (pack and index split, plus the evidence commit). Defensible but unstated.
   Suggested remediation target phase: specification
   Suggested fix: change §18 to "recommended commit sequence, may be split per phase" or list the six.

13. [nit] spec_completeness — spec F-1 / DEC-17 / plan task 1.1
   Gap: insertion is pinned between base line 1166 and the blank line 1167, and task 1.1 says only "one blank line between entries". An implementation can legitimately place `### M2-S11` directly after M2-S9's `- Depends on:` line, losing the blank separator every other entry has; no gate or criterion checks it.
   Suggested remediation target phase: specification
   Suggested fix: require the inserted block to begin with a blank line (so S11 is separated from M2-S9 exactly as other entries are) and keep P03's window unchanged.

14. [nit] test_traceability — test plan P18 `head_line_for_base`
   Gap: the offset sums the new-side line count for every hunk above the target, but the correct shift is `new − old`; a replacement hunk would over-shift the paragraph/scheduling/items windows and blame the wrong pointer. Confirmed plan-acceptable: any replacement means `removed_lines>0`, and `retention_oracle` fails on that in the same invocation, so no false PASS exists — only a misleading window print on a head that already fails.
   Suggested remediation target phase: test_planning
   Suggested fix: add `d>0 { printf "FAIL replacement hunk %s\n", $0; bad=1 }` (or subtract `old`) so a replacement is reported as such rather than silently shifting the windows.

15. [nit] spec_completeness — spec Appendix B, `watchdog.md` row
   Gap: the "Current claim" column reads `M1 planned (M1-S1)` and the required correction omits the page's existing correct clauses ("M1-S15 adds progress signals", "scenario SC-M1-14"). The delivery may therefore delete a true delivered reference while satisfying every AC.
   Suggested remediation target phase: specification
   Suggested fix: list the header text that must survive on each of the 14 pages, or state that only the false fragment changes and correct clauses stay.

## Remediation Routing

- **specification** (reopen): F1, F3, F4, F8, F10, F11, F12, F13, F15 — F1 and F3 are the blockers.
- **test_planning** (reopen after specification): F2, F5, F7, F9, F14 — F2 must follow F1 so the S17 anchors match the enumerated criteria.
- **delivery_planning** (reopen, small): F6.
- No finding targets `delivery`; no human input is required to resolve any of them.

## Answer to the specific question posed

The P18 `head_line_for_base` replacement-hunk behaviour is plan-acceptable (F14): it cannot create a false PASS because the same oracle fails any head with a removed base line, and this change's compliant head contains only pure insertion hunks. The substantive seventh-plus defects are elsewhere: S17's seven acceptance criteria are unspecified and only counted (F1), the anchor matrix's "every clause has an anchor" claim is false (F2), and the aggregate-gate criterion is unachievable as written in the documented environment (F3).
