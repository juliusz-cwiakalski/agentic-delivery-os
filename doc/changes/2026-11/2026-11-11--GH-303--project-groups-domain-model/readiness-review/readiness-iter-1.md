# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-303
Date: 2026-11-11
Pause Required: no

Reviewed artifact set: `chg-GH-303-spec.md` v1.0 (594 lines), `chg-GH-303-test-plan.md` v1.0
(2766 lines), `chg-GH-303-plan.yaml` (6 phases), `chg-GH-303-pm-notes.yaml`, GitHub issue
`juliusz-cwiakalski/agentic-delivery-os#303` (body + owner comment), and the tree under test
(`doc/planning/oss-tooling/**`, `scripts/checks/forbidden-literals.registry.json`,
`package.json`, `.github/workflows/ci.yml`, `tests/checks/forbidden-literals.test.ts`).

Verification performed by execution, not by reading:

- Base pin: `5372dbac` = `origin/main-tools` (confirmed by `git rev-parse`), branch
  `docs/GH-303/project-groups-domain-model`.
- All 46 procedure blocks `P00..P45` were extracted from test plan §7.1 and re-executed
  against base; selected blocks were also re-executed against a **conforming simulated head**
  (ticket-verbatim S18/S19 entries + one Epic M2 context paragraph + retained S11) built in
  `/tmp/opencode/fx/backlog-head.md`.
- Derived facts confirmed: backlog 1454 lines, M2-S17 last content 1285, separator 1287,
  `## Epic M3` 1289, window `1286:1286`; retirement note 1051–1054, context window
  `1055:1055`; `status.md` 212 lines, last heading 187; registry 139 entries, `queue.md` row 88,
  `spend.md` row 89, one pre-existing out-of-order pair (confirmed);
  `architecture.md` 20 fences / 10 mermaid / C4 1-1-1 / 7 key flows; `test-scenarios.md`
  40 seeds / 40 `Assert:` lines; `m2/README.md` 12 contents rows; `milestones/README.md`
  12 M2 targets.
- Counted: 33 functional + 12 non-functional ACs = 45; 45 TCs; plan claims 45/45 ACs and
  45/45 TCs **exactly once** (programmatic check: no duplicates, no gaps, no extra); 13 product
  files across P1..P5, all distinct, matching spec Appendix C.
- Gate commands executed: `delivery-os plan validate GH-303` → `verdict=valid`,
  `readyForDevelopment=true`; `delivery-os lint GH-303` → conforms; `delivery-os lint plan GH-303`
  → `verdict=valid`, `errors=[]`; `plan diff GH-303` → `input.value.rejected` (plan's
  "unavailable" claim confirmed); `forbidden-literals` → 139 entries, 0 violations;
  `test-doc-distribution.sh` → exit 0, 82 in-scope docs.
- 26-clause oracle proven satisfiable: on the ticket-verbatim fixture, `P03 = 12/12`,
  `P05 = 11/11`, `P06 = 3/3`.

## Facet Summary

| Facet | Result | Basis |
|---|---|---|
| spec_completeness | PASS | Every ticket bullet (M2-S11 amendment, S18, S19, blueprint, backlog, status, owner-comment registry/index/delta scope) maps to an F-/DM-/AC- id; Appendix A reproduces the ticket text; no requirement invented beyond declared decisions |
| ac_quality | PASS | 45 ACs are Given/When/Then with mechanical predicates; the two declared predicate overlaps (AC-F12-2/AC-NFR11-1, AC-F3-3/AC-F6-4) are partitioned by TP-1/TP-2 |
| plan_coverage | PASS | All 45 ACs and 45 TCs claimed exactly once across P1–P5; 13 files distributed P1..P5 without overlap (verified from the YAML) |
| test_traceability | FAIL | Three ACs lose their only working oracle: AC-F14-1/AC-NFR12-1 (F1, F5), AC-F4-2/AC-F4-3 (F2), AC-F7-2/AC-F7-3 (F3) |
| cross_artifact_consistency | FAIL | F7 (spec vs plan on the TC-WIRE-002 verdict), F8 (spec vs tree on the S4 advisory), F9 (plan gate tokens vs procedure output), F13 (spec scope vs blueprint residue) |
| decision_capture | PASS | DEC-1..DEC-17 in the spec plus five intake decisions in pm-notes; all change-scoped, no precedent-setting decision needs an ODR before delivery |
| system_spec_consistency | PASS | `doc/spec/**` and `doc/overview/**` contain no `repos`/`projects` surface (verified); DEC-17's "no current-truth change required" is accurate |
| plan_doc_update_coverage | PASS | `changeShape.systemSpecUpdate` and P5's constraints discharge phase 7 explicitly rather than by omission |
| plan_code_area_coverage | PASS | Per-phase `scope.files` enumerate all 13 paths; P6 declares the full remediation surface |
| dod_defined | PASS | §17.3 gives 11 checkbox items bound to AC ids and to phase-level DoD lists in the plan |

## Findings

### Blocking

1. **[critical] test_traceability — `chg-GH-303-test-plan.md`#7.1 P32, matrix row `BL-18` (and §5.2 TC-032, §3.1 AC-F14-1)**
   Gap: the forbidden pattern for the M2-S18 entry, `repos.{0,40}group`, matches the S18 text the
   ticket mandates, so TC-032 (and the plan's P5 gate `rows_with_survivors=0/17`) is unsatisfiable
   without rewording a ticket clause (which NFR-8/AC-NFR8-1 forbids).
   Evidence: on the ticket-verbatim S18 entry the pattern matches twice —
   `repositories; the tooling can enumerate group` (S18 goal) and
   ``repos` = flat enumeration, `projects` = group`` (S18-T5, the boundary clause the change exists
   to introduce). The regex has no word boundary, so "repositories" is read as "repos".
   Remediation target: test_planning.
   Suggested fix: replace `BL-18`'s forbidden pattern with an enumeration-attached form (e.g.
   `` `projects list`[^.]{0,80}(enumerat|checkout) ``) and re-prove the row against the
   ticket-verbatim fixture plus a mutation fixture.

2. **[critical] test_traceability — `chg-GH-303-test-plan.md`#7.1 P09 and P10 (AC-F4-2, AC-F4-3; TCs 009/010)**
   Gap: both procedures bound the context paragraph as `(last non-empty line before '### M2-S2')+1`
   … `s2-1`. Once a paragraph exists it *is* that last non-empty line, so the computed window is
   always empty/after the paragraph: P09 reports `paragraph_lines=0` and `retirement_note=CHANGED`,
   and P10 classifies the paragraph hunk as `OUTSIDE`. The AC they own cannot be passed by any
   conforming edit.
   Evidence (conforming simulated head): `retirement_note=1051..1059 context_paragraph=1060..1060
   paragraph_lines=0`; `retirement_note=CHANGED`; `P09 verdict: FAIL`. P10:
   `OUTSIDE: @@ -1055,0 +1056,5 @@ (added 1056..1060)` → `hunk confinement FAILED`. The plan's P1
   gate requires `paragraph_lines>0` (P09 PASS) and `outside=0` (P10), so P1 is unsatisfiable.
   Remediation target: test_planning.
   Suggested fix: anchor the retirement note by its own first/last line (e.g. the known 4-line
   `Note:` block, or base line numbers) and let the paragraph region be
   `note_end_base+1 .. s2_head-1`; re-run both procedures on a fixture.

3. **[critical] test_traceability — `chg-GH-303-test-plan.md`#7.1 P19, P20, P21 (AC-F7-1, AC-F7-2, AC-F7-3)**
   Gap: the three command-page procedures use shell variables `$R` and `$PJ` that no procedure or
   P00 preamble ever assigns. As published they cannot produce their declared outputs.
   Evidence (executed as published): P20 emits `grep: : No such file or directory` eleven times,
   `checks=0/7 fields=0/3 forbidden_flat_statements=<empty>`; P21 emits the same errors and
   `projects_page: projects.v1= repos.v1= repos[]= header=0`. P19 short-circuits to
   `repos_md=absent` because `[ ! -f "" ]` is true. Consequence: the recorded §10 evidence for
   TC-020 (`checks=4/7 fields=1/3 forbidden=1`) cannot have come from the published block, so the
   "every procedure was executed" claim does not hold for V6's P3 gate.
   Remediation target: test_planning.
   Suggested fix: define `R="$M2/commands/repos.md"` and `PJ="$M2/commands/projects.md"` in P00 (or
   in each block) and re-run against the conforming fixtures named in the revision log.

4. **[major] test_traceability — `chg-GH-303-test-plan.md`#7.1 preamble (line ~1573) with P29/P30/P11 helpers**
   Gap: the deck claims "Everything else runs standalone after P00" and declares only
   P10→(P08,P09) and P45→P32. Execution shows five more undocumented dependencies: `newsec_of`
   (defined in P29) is required by P32, P33, P45; `diffstat` (P29) by P44; `$A` (P11) by P40;
   `$RG` (P30) by P31. Two of the failures are silent.
   Evidence (each block sourced after P00 only):
   `P40 → c4_headings=// key_flows_headings=0/8` plus `integer expression expected`;
   `P44 → diffstat: command not found`, verdict FAIL;
   `P32/P45 → newsec_of: command not found` for the `STAT` row, and P32 then reports
   `STAT forbidden=0 OK` — a fail-**open** for the status-section naming scan;
   `P31 → diff: '': No such file or directory`. The plan's phase gates list procedures
   individually, so a coder may hit these without the recommended whole-deck order.
   Remediation target: test_planning.
   Suggested fix: move `diffstat`, `newsec_of`, `A`, `RG`, `R`, `PJ` into P00 (or declare the
   full dependency list per block and make every region helper fail closed on an empty region).

5. **[critical] test_traceability — `chg-GH-303-test-plan.md`#7.1 P32 `region()` mode `s11group`, matrix row `BL-S11` (TC-032, TC-045; AC-F14-1, AC-NFR12-1)**
   Gap: the region is selected with `awk '/^## M2-S11 /'`, but the backlog story heading is
   `### M2-S11 Multi-repository workstations`. The region is therefore empty for every run, so the
   forbidden half reports a vacuous `BL-S11 forbidden=0 OK` (base already contains `projects list`
   twice in that entry) and P45's required half can never pass.
   Evidence: base run `BL-S11 forbidden=0 OK` while P02 reports `projects_list_in_entry=2`;
   P45 reports `BL-S11 required=MISSING`, which is unsatisfiable because the searched region is
   always empty. This removes the change's most important location from the matrix oracle that
   AC-F14-1/AC-NFR12-1 rely on.
   Remediation target: test_planning.
   Suggested fix: select the S11 region with `### M2-S11 ` (as P02 already does) — or reuse P02 for
   this row — and add an assertion that every matrix region is non-empty before counting.

6. **[major] plan_coverage / plan executability — `chg-GH-303-plan.yaml`#phases[5].gates (P34), and phases[5].definitionOfDone**
   Gap: P5's gate set contains P34, whose oracle needs `product_files=13/13` from
   `git diff --name-only "$BASE"...HEAD` (three-dot diff excludes uncommitted work) **and**
   `worktree_product_changes=0` (`git status --porcelain` filtered to product paths). Both can only
   be true after the P5 commit lands, yet P5 lists them among the gates that must PASS before the
   phase boundary; P5's own `dependsOn` states that P34 "requires ... a clean worktree".
   Consequence: P5's gate cannot be satisfied at the boundary it gates; the containment oracle is
   either run post-commit (and then gates nothing) or is met with `product_files=12/13` and
   `worktree_product_changes=4`.
   Evidence: `chg-GH-303-test-plan.md`#7.1 P34 lines (`$BASE...HEAD`, `worktree_product_changes`);
   §7.3 triage row "Commit it through the plan's phase structure".
   Remediation target: delivery_planning.
   Suggested fix: either move P34/P39 to an explicit post-commit verification step inside P5 (stated
   in the phase) or have P34 accept the four P5 paths as expected-pending and assert 13/13 only at
   P6/PR time.

7. **[major] cross_artifact_consistency — `chg-GH-303-plan.yaml`#gateCommands.aggregateGateRecorded + #upstreamGaps.UG-1 versus `chg-GH-303-spec.md`#9 NFR-6 / AC-NFR6-1 and test plan P39**
   Gap: two artifacts give the same observation two different outcomes. The plan says a lone
   default-`TMPDIR` `TC-WIRE-002` failure is "recorded, re-run in isolation … and escalated per
   UG-1 — never reclassified", while AC-NFR6-1 says "any other default-run failure … is a delivery
   failure" and P39's classifier sets `cls=delivery` and prints `P39 verdict: FAIL` for exactly that
   case. P5's gate text repeats the escalation-only disposition, contradicting the procedure it
   invokes.
   Evidence: `gateCommands.aggregateGateRecorded.expectation`; `upstreamGaps.UG-1.disposition`;
   test plan P39 classification branch and `chg-GH-303-spec.md` line 257 (NFR-6) / line 411
   (AC-NFR6-1); test plan §7.2 TC-039 record shows `default_failure_class=delivery`.
   Remediation target: delivery_planning (align the plan's prose and P5 gate wording with
   AC-NFR6-1); if the owner instead wants the exemption widened, that is a specification change with
   owner sign-off and must be recorded as a decision, not inferred.
   Suggested fix: delete the "except that a lone TC-WIRE-002 … is recorded and escalated" clause, or
   restate it as "fails the phase and is escalated as a gate defect" so prose and procedure agree.

8. **[major] cross_artifact_consistency — `chg-GH-303-spec.md`#AC-F6-5 / #DEC-14 versus the tree (`milestones/m2/README.md`:47) and the file manifest (#F-11, §7.1, Appendix C)**
   Gap: AC-F6-5 and DEC-14 state that the M2-S4 map row "carries the existing advisory note
   (`consumed at delivery; the owning story declares the edge`)". The S4 row has no such note; the
   convention exists only on the S3, S5 and S10 rows. The AC therefore mandates an addition to the
   S4 row that F-11, §7.1 and Appendix C do not list as a required change, described in the spec as
   pre-existing.
   Evidence: `sed -n '47p' doc/planning/oss-tooling/milestones/m2/README.md` →
   `| M2-S4 Board | multi-repository overview | \`projects.v1\` | SC-M2-S4-01, SC-M2-S4-02 |`;
   `grep -rn 'consumed at delivery' doc/planning/` → lines 46, 48, 53 only;
   test plan P18 requires `s4_advisory=OK` from that row.
   Remediation target: specification.
   Suggested fix: drop "existing" and add the S4 row edit to F-11 and Appendix C row 9 (path budget
   unchanged), or relax AC-F6-5/P18 to the map row pointing at the group envelope without the
   advisory parenthesis.

9. **[major] cross_artifact_consistency / plan executability — `chg-GH-303-plan.yaml`#phases[1].gates (P35, P08, P09)**
   Gap: gate expectations quote wrong or base-only token values, so a coder cannot tell a stale
   expectation from a failure. `P35 -> base_headings=67 head_headings=69 added=2` is wrong even as a
   base observation (the procedure prints 74 → post-change 76); `P08 -> separator=1287
   window=1286:1286` and `P09 -> retirement_note=1051..1054` are base values that the procedures
   recompute from the head and will legitimately differ.
   Evidence: base run `P35 → base_headings=74 head_headings=74 added=0` (test plan §10 records the
   same 74/74); conforming simulated head `P08 → separator=1307 epic_m3=1309 window=1291:1306`,
   `P09 → retirement_note=1051..1059`.
   Remediation target: delivery_planning.
   Suggested fix: pin only invariants (`placement=inside-window`, `separator_sequence=identical`,
   `blank_line_before_separator=1`, `paragraph_lines>0`, `P35 verdict: PASS`) and correct 67/69 to
   74/76.

### Non-blocking

10. **[minor] cross_artifact_consistency — `chg-GH-303-plan.yaml`#crossArtifactResolutions.TP-5 and #phases[5].constraints versus test plan P28**
    Gap: the plan states it "pins only the leading date token `2026-11-11` in the new section
    heading" and P5 requires a heading that "begins with `2026-11-11`", but P28 derives the section
    positionally and never checks the date. The pinned form also contradicts the file's convention
    (`## M2 planning snapshot (2026-11-10)` — title first, date parenthesised).
    Remediation target: delivery_planning. Fix: either drop the pin or add it to P28's anchors and
    follow the existing heading form.

11. **[minor] test_traceability — `chg-GH-303-test-plan.md`#7.3 rows for P19/P20**
    Gap: triage text says "P19 prints … `checks<10`" and "P20 prints `checks<8`", but P19 has 9
    checks and P20 has 7 (`[ "$n" -eq 9 ]` / `-eq 7`), so the triage thresholds contradict the
    procedures and every recorded result.
    Remediation target: test_planning. Fix: use `checks<9` / `checks<7`.

12. **[minor] test_traceability — `chg-GH-303-test-plan.md`#7.1 P33 `both_rows` (`M2RD`, `MSRD`)**
    Gap: P33 requires a boundary statement at 8 both-name locations including the `m2/README.md` map
    rows and the `milestones/README.md` M2 index row, but Appendix B's "What it must say" for those
    rows is "Both pages linked (13 targets)" with nothing about the boundary, and F-11/AC-F11-2
    require only the row and link additions. The coder must infer prose the spec does not ask for
    (and P45's `MSRD` row also carries `XXXNONE`, i.e. no forbidden pattern).
    Remediation target: test_planning (or specification if the requirement is intended). Fix: name
    the boundary sentence in F-11/AC-F11-1/2, or drop `MSRD` from `both_rows`.

13. **[minor] spec_completeness — `chg-GH-303-spec.md`#§2.1/§7.2/§7.3 and RSK-1 versus `milestones/m2/commands/board.md`:51,78,90**
    Gap: an in-pack page left out of scope still carries a field whose meaning this change alters:
    `projects[]` = "Project keys included in the board" (i.e. repository keys) and a see-also link to
    the redefined `projects.v1` and to the rewritten "multi-repository overview" flow. RSK-1's
    residual is generic ("a peripheral page outside the matrix"); §2.1 and §7.3 never name
    `board.md`, so the artifact set does not evidence awareness of this specific page.
    Remediation target: specification. Fix: declare `commands/board.md`'s `projects[]` reconciliation
    as an explicit deferred item with its follow-up owner (S4/S18), or add the one-line
    clarification and grow the manifest to 14 files.

14. **[minor] cross_artifact_consistency — `chg-GH-303-spec.md`#§18 versus `chg-GH-303-plan.yaml`#orderingConstraints**
    Gap: the spec's recommended commit sequence keeps the forbidden-literals row in the last commit
    ("(5) the indices, the status snapshot, the command registry, and the registry row"), while the
    plan implements it as P4 before P5. The deviation is well argued and declared in the plan and
    pm-notes, but the spec text was not reconciled and now describes a sequence delivery will not
    follow.
    Remediation target: specification. Fix: restate §18 as five commits with the registry row fourth,
    or label the spec sequence as superseded by the plan's ordering constraint.

15. **[nit] test_traceability — `chg-GH-303-test-plan.md`#9 Plan Revision Log**
    Gap: the revision log lists four authoring defects found by the base runs (clause-table pipe,
    `NR`/`FNR`, the repos-page condition count, the projects-page ban pattern), while §10 says "Two
    authoring defects were caught". Harmless, but it is evidence the deck changed after some numbers
    were recorded (see F4/F3).
    Remediation target: test_planning. Fix: state the count once.

16. **[nit] test_planning — `chg-GH-303-test-plan.md`#7.1 `newsec_of` resolution**
    Gap: `newsec_of` treats "the first `##` heading in head absent from base" as the new section, so
    a second new `##` heading anywhere in `status.md` would move the boundary and mask an
    out-of-section insertion; P28 asserts uniqueness of the anchor set but not of the heading.
    Remediation target: test_planning. Fix: assert exactly one new `##` heading.

## Not findings (checked and cleared)

- Base pin, branch, and all derived line windows/offsets (`1285/1287/1289`, `1055:1055`,
  `status.md` 187/212, registry 88/89, 139 entries, one out-of-order pair, 12 contents rows,
  12 M2 targets, 20/10/1-1-1/7 in `architecture.md`, 40/40 seeds) — all reproduced exactly.
- The P4-before-P5 sequencing rationale is factually sound: `pnpm check` includes `bun test`, and
  `tests/checks/forbidden-literals.test.ts` scans the live tree and fails closed on an unregistered
  new user-facing doc, so the guard-red window is real; CI additionally runs
  `bun run scripts/checks/forbidden-literals.ts` as its own job.
- `plan validate`, `lint GH-303`, `lint plan GH-303` all execute and agree with the plan's stated
  expectations; `plan diff` genuinely rejects (`input.value.rejected`), so the containment
  substitution is justified rather than convenient.
- 26-clause fidelity oracle is satisfiable: `P03=12/12`, `P05=11/11`, `P06=3/3` on ticket-verbatim
  text, so it does not force rewriting the ticket's clauses.
- TMPDIR duality, `test-doc-distribution` (82 docs, exit 0, planning markers 0) and
  `forbidden-literals` (139, 0 violations) reproduce; the `ados_distribution`/license-header rules
  do not apply to `doc/planning/**`.
- No `doc/spec/**` or `doc/overview/**` statement contradicts the change; DEC-17's phase-7
  declaration is accurate.

## Gate result

Delivery stays blocked. Reopen **test_planning** (findings 1–5, 11, 12, 15, 16),
**delivery_planning** (6, 7, 9, 10) and **specification** (8, 13, 14), then re-run this gate as
iteration 2. No human pause is required: every finding routes to an artifact phase. Finding 7 has an
owner-decision alternative (widening the NFR-6 exemption); if that path is chosen it must be
recorded as an explicit decision with owner sign-off instead of being read into the plan.
