# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-303
Date: 2026-11-11
Pause Required: no

Reviewed artifact set: `chg-GH-303-spec.md` v1.1 (596 lines), `chg-GH-303-test-plan.md`
v1.1 (2926 lines), `chg-GH-303-plan.yaml` v1.1 (1248 lines), `chg-GH-303-pm-notes.yaml`,
`readiness-review/readiness-iter-1.md`, GitHub issue `juliusz-cwiakalski/agentic-delivery-os#303`
(body + owner scope comment), and the tree under test.

Every iteration-1 blocking finding was re-verified **by execution**, not by reading the
remediation claims. Method:

- Base pin `5372dbacb9c36e1d79d1e55873264155a53f44ff` = `origin/main-tools`; branch
  `docs/GH-303/project-groups-domain-model` at `1439891a`; working tree clean; no product
  file edited by the change.
- All 46 procedure blocks (`P00` + `P01..P45`) were extracted programmatically from test plan
  §7.1 and executed **each in a fresh shell** as `source P00; source Pn`, from the repository
  root, with no shared state. Every block was also executed **without** `P00`: 45/45 abort
  loudly with `FATAL: P00 preamble not loaded`.
- Base tree: **38 FAIL + 7 PASS** (`P29`, `P35`, `P38`, `P39`, `P42`, `P43`, `P44`), matching
  test plan §10 exactly.
- **Independent conforming fixture built by this reviewer** (own builder script, my own prose;
  the author's `/tmp/gh303/fx/repo` was not used) in a detached `git worktree` at `5372dbac`:
  ticket-verbatim S18/S19 entries, the M2-S11 amendment, the context paragraph, and the spec
  Appendix C manifest — 12 modified planning documents + new `m2/commands/repos.md` +
  `scripts/checks/forbidden-literals.registry.json` = **13 product files**, never committed,
  removed after review. On that fixture **45/45 procedures PASS**.
- Gate commands executed: `delivery-os plan validate GH-303` → `verdict=valid`,
  `readyForDevelopment=true`, rc 0; `delivery-os lint GH-303` → `conforms`; `delivery-os lint
  plan GH-303` → `verdict=valid`, `errors=[]`.
- Counted programmatically: 45 ACs (33 functional + 12 non-functional) / 45 TCs, 1:1 in both
  directions, no duplicate and no orphan (§3.1, §5.1, §5.2 and §7.2 all agree); the plan claims
  all 45 ACs and all 45 TCs exactly once; 13 unique product paths across P1..P5, identical to
  Appendix C, `board.md` absent (P6 re-lists the same 13 paths as the conditional remediation
  surface, by design).

## Facet Summary

| Facet | Result | Basis |
|---|---|---|
| spec_completeness | PASS | Every ticket clause (M2-S11 amendment, S18, S19, blueprint, backlog, status, owner-comment registry/index/delta scope) maps to an F-/DM-/AC- id; Appendix A transcribes 26 clauses; containment counts (13 = 11 modified + 1 new planning doc + 1 registry row) now agree across G-5, §7.1, NFR-1, AC-NFR1-1, §16, DEC-1 and Appendix C (all re-counted) |
| ac_quality | PASS | 45 Given/When/Then ACs with mechanical predicates; the two declared predicate overlaps (AC-F12-2/AC-NFR11-1, AC-F3-3/AC-F6-4) remain partitioned by TC-029/TC-044 and TC-007/TC-017; AC-NFR6-1 now states (a)–(d) explicitly |
| plan_coverage | PASS | 45/45 ACs and 45/45 TCs claimed exactly once; 13 files distributed P1..P5 without overlap; every AC-bearing procedure is a gate of some phase |
| test_traceability | PASS | Every AC has at least one oracle that works: 45/45 procedures PASS on an independently built conforming head and 38 FAIL on base. Residual minors (findings 3, 4) are anchor wording, not lost oracles |
| cross_artifact_consistency | FAIL | Finding 1: the plan gates fixture-instantiation literals for P09/P10 that the test plan §6 explicitly declares non-universal and replaces with invariants; a conforming head fails them. Findings 2, 5 are residual/stale statements |
| decision_capture | PASS | DEC-1..DEC-17 plus five intake decisions; TP-1..TP-8 and UG-1..UG-3 are declarations, not silent absorption; no precedent-setting decision needs an ODR before delivery |
| system_spec_consistency | PASS | `doc/spec/**` and `doc/overview/**` still contain no `repos`/`projects` surface; DEC-17/NG-3's "no current-truth change" is accurate for a planning-corpus-only change |
| plan_doc_update_coverage | PASS | `changeShape.systemSpecUpdate` and P5's constraint discharge phase 7 explicitly; the release/tracker obligations are declared rather than omitted |
| plan_code_area_coverage | PASS | Per-phase `scope.files` enumerate exactly the manifest; P6 declares the full remediation surface |
| dod_defined | PASS | §17.3 gives 11 checkbox items bound to AC ids; each maps to a phase DoD list in the plan |

## Verified closures (iteration-1 blocking findings)

1. **BL-18 forbidden pattern (iter-1 finding 1) — CLOSED.** `repos.{0,40}group` no longer
   appears as a forbidden pattern anywhere (only inside the revision-log narrative). The matrix
   row is now `BL-18|BL|entry|### M2-S18 |projects list|@both` with sentence-level detectors.
   Executed: on a file holding the ticket-verbatim S18 text **including** the goal clause and
   the boundary clause, `forbidden_hits both` = **0**; the old pattern still matches that text
   twice (`repositories; the tooling can enumerate group`, ``repos` = flat enumeration,
   `projects` = group`), which reproduces iter-1's evidence exactly. A planted
   `` `projects list` enumerating the managed checkouts with their repo key and state
   location `` yields **1** FLAT hit, a planted ``The `repos` group lists its members`` yields
   **1** GROUP hit, and the required boundary sentence yields **0**. `base_board_accepted=OK`.
   Fix is real, not relabelled.
2. **P09/P10 context window (finding 2) — CLOSED.** The window is now
   `retirement-note last line + 1 .. ### M2-S2 - 1` with the note anchored by its own first and
   last line. Base: `paragraph_lines=0`, `paragraph_strictly_between=FAIL`. Conforming head:
   `retirement_note=1051..1054`, `context_paragraph=1055..1062`, `paragraph_lines=6`,
   `blank_after_note=1`, `blank_before_s2=1`, `paragraph_strictly_between=OK`, `P09 PASS`;
   `P10: backlog_hunks=6 inside=6 outside=0, classifier_self_tests=3/3, PASS`. The
   last-line-before-next-heading collapse is gone.
3. **P19/P20/P21 undefined `$R`/`$PJ` (finding 3) — CLOSED.** Both are P00 variables.
   Executed: `checks=9/9 fields=5/5`; `checks=7/7 fields=3/3 forbidden_flat_statements=0`;
   `repos_page: repos.v1=2 projects[]=0 header=1 not_registered=1`,
   `projects_page: projects.v1=2 repos.v1=0 repos[]=0 header=1 not_registered=1`.
4. **Cross-procedure dependencies and fail-open scans (finding 4) — CLOSED.** Every helper and
   path lives in P00; each block run alone after P00 passes; each block run without P00 aborts
   fatally (45/45); `P32` treats an empty region as a failure (`regions_empty` counted, base
   `STAT region=EMPTY` → FAIL) and `P44`'s own fixture runs. The `STAT` row no longer fails open.
5. **BL-S11 region anchor (finding 5) — CLOSED.** The region is `entry '### M2-S11 '`. Base
   `BL-S11 forbidden=3 SURVIVOR` (the goal's "one CLI overview" claim plus two `projects list`
   statements), conforming head `BL-S11 forbidden=0`, `P45 BL-S11 required=OK`.
6. **P34 decidability (finding 6) — CLOSED.** The gate is the base..worktree manifest
   (`git diff --name-only "$BASE" -- .` plus untracked). On the uncommitted conforming fixture:
   `product_files=13/13`, `expected_not_changed=0`, `unexpected_changed=` empty,
   `other_scripts_changed=0`, no `FORBIDDEN ROOT CHANGED`, `post_commit_check=pending`,
   `P34 PASS` — decidable at the P5 boundary; the committed range is reported separately.
7. **AC-NFR6-1 gate policy (finding 7) — CLOSED.** Spec NFR-6, AC-NFR6-1(a)(b)(c)(d), §4.1 KPI,
   RSK-7, DEC-16, §17.3 and Appendix D now agree, and the plan's `gateCommands`,
   `aggregateGateRerunRecord` and the P5 P39 gate agree with them. Executed with five synthetic
   log sets: `none` → PASS(none); `excused` (both named failures, rerun recorded) → PASS;
   unexcused default failure → FAIL(delivery); repository-local failure with a green default →
   FAIL(delivery); excused pair with no rerun record → FAIL(missing-rerun). The classifier's
   `allowed_re` matches real `bun` output: `(fail) CI baseline parity (hermetic partial
   clone) > …` and `(fail) TC-WIRE-002 local command is offline… > …`; `TC-WIRE-002` was
   reproduced standalone (`this test timed out after 5000ms`).
8. **AC-F6-5 / M2-S4 advisory note (finding 8) — CLOSED.** AC-F6-5, F-11 and Appendix C row 9
   now say the S4 row **gains** the advisory phrase in the same form as the S3/S5/S10 rows, and
   `P18` requires `s4_advisory=OK` from that row (conforming head: `consumer_note=OK
   s4_advisory=OK`). One stale adjective remains — see finding 2 below.
9. **P1 stale/duplicate gate tokens (finding 9) — PARTIALLY closed.** `P35` now gates
   `base_headings=74 head_headings=76 added=2` (invariant; reproduced) and `P08` gates only
   `placement=inside-window`, `separator_sequence=identical`, `blank_line_before_separator=1`,
   `window_empty=no` with the fixture numbers listed separately — both correct. `P09`'s
   `paragraph_lines=4`/`context_paragraph=1055..1060` and `P10`'s `backlog_hunks=6` are still
   gated. **This is the blocking finding below.**

Also re-verified and cleared: the 26-clause table is satisfiable on ticket-verbatim text
(`P41 26/26`, `P03 12/12`, `P05 11/11`, `P06 3/3`); registry grows 139 → 140 with
`queue=88 < repos=89 < spend=90`, no duplicate, no unregistered doc; `P26` 13 contents rows and
`P27` 13 index targets with M0/M1 rows byte-identical; `P28` exactly one new `##` heading in the
file's parenthesised-date form, nothing after it; `P38` guard exit 0 with 0 planning markers;
`P42` guard green (5/5 scope classes, 0 violations) once the new page is registered.

## Findings

### Blocking

1. **[major] cross_artifact_consistency / plan executability — `chg-GH-303-plan.yaml` `phases[0].gates` (P09, P10) and `phases[0].definitionOfDone` versus `chg-GH-303-test-plan.md` §6 "Plan-gate token note" (line 1569)**
   Gap: the plan still **gates** two fixture-instantiation literals that the test plan replaces
   with invariants, and that a conforming implementation need not satisfy.
   - P09 gate: "Gate (fixture-derived …): `context_paragraph=1055..1060`, `paragraph_lines=4`,
     `paragraph_strictly_between=OK`, …". The test plan's note says the opposite for that
     procedure: "For P08/P09 the post-change expectation is the invariant (… `paragraph_lines>0`
     …), because the separator and window are recomputed from the head".
   - P10 gate: "Gate (fixture-derived): `backlog_hunks=6`, `hunks: inside=6 outside=0` …". The
     same note says the fixture literals "are evidence that the oracles are satisfiable; they
     are not universal literals".
   - P1 `definitionOfDone`: "`backlog.md` has exactly three changed regions (six zero-context
     hunks)"; the phase's own constraint for the same phase only requires "at least one
     non-empty line inside it", so constraint and gate contradict each other inside one phase.
   Evidence (executed). Two conforming heads, both of which keep `P01`–`P45` at 45/45 PASS:
   - a **six-line** context paragraph (one paragraph, blank line each side, all three required
     statements) → `context_paragraph=1055..1062`, `paragraph_lines=6`, `P09 verdict: PASS`,
     but the gate's `paragraph_lines=4` / `1055..1060` read as a failure;
   - the mandated transition sentence folded into the M2-S11 Goal bullet instead of a separate
     bullet (AC-F1-1 satisfied; `P01 transition_note=OK`) → `backlog_hunks=5`,
     `hunk confinement OK`, `P10 verdict: PASS`, but the gate's `backlog_hunks=6` reads as a
     failure.
   With the author's exact formatting (`paragraph_lines=4`, `backlog_hunks=6`) both gates are
   satisfiable — confirmed — so this is over-pinning, not unsatisfiability. It is nonetheless
   the residual of iteration-1 finding 9: the value was **relabelled** as fixture-derived and
   kept as a gate, and the plan's revision note claims the relabel as the fix ("Every
   post-change expectation in P1..P5 is now labelled fixture-derived (source: test plan §6 and
   §10)") while §6 of that source prescribes `paragraph_lines>0`.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: in the P09 gate keep only `paragraph_lines>0` (or `>=1`),
   `paragraph_strictly_between=OK`, `blank_after_note=1`, `blank_before_s2=1`, the anchored
   note lines, and the byte-identity/heading invariants; in the P10 gate keep
   `hunk confinement OK`, `outside=0`, `non_vacuous=yes`, `classifier_self_tests=3/3`; restate
   the P1 DoD as "three changed regions with no hunk outside them". Keep the fixture numbers,
   if wanted, as explicitly non-gated observations (the form P08, P28, P29, P31 and P40 already
   use).

### Non-blocking

2. **[nit] spec_completeness — `chg-GH-303-spec.md` §8.5 Backward Compatibility (line 245)**
   Gap: "the M2-S4 map row carries the pack's **existing** advisory note rather than a new
   dependency edge" survived the AC-F6-5 fix; F-11, AC-F6-5 and Appendix C row 9 now say the row
   *gains* the phrase, and the base S4 row carries none. The adjective re-introduces the reading
   iter-1 finding 8 rejected.
   Remediation target: specification. Fix: "gains the pack's advisory phrase (the same one the
   S3/S5/S10 rows carry)".

3. **[minor] test_traceability — `chg-GH-303-test-plan.md` §7.1 P22 topic anchor `two branches|two PRs`**
   Gap: AC-F8-1 and F-8 describe the S19 coverage as "one spec with **two member branches, two
   pull requests**, one review flow and one closeout", but P22's anchor requires the exact token
   `two branches` or `two PRs`. Executed: a seed set written in the AC's own vocabulary
   ("two member branch names and two pull-request numbers", prose and assert) yields
   `topic MISSING: two branches|two PRs`, `coverage_anchors=9/10`, `P22 verdict: FAIL`, although
   the seed set is fully conforming. Workable (adding the literal token passes), but the Oracle
   is stricter than the criterion it traces to.
   Remediation target: test_planning. Fix: widen the anchor to
   `two (member )?branch|two (pull requests?|PRs)`.

4. **[minor] test_traceability — `chg-GH-303-test-plan.md` §7.1 P11 `workspace_mandatory_claim`**
   Gap: the diagnostic `grep -Eiq 'workspace[^.]{0,120}required'` fires on the **required**
   sentence "a workspace is an optional directory usable as a discovery root and never
   required", printing `workspace_mandatory_claim=PRESENT (violation)` on conforming prose
   (reproduced on my fixture; the verdict is unaffected because it is not a gate term). A coder
   reading the block is told they have a violation when they do not.
   Remediation target: test_planning. Fix: exclude negated forms
   (`workspace[^.]{0,120}(is|are) (required|mandatory)` with a `never|not` lookbehind, or test
   `(workspace|members?) (must|shall) (live inside|be inside)` only).

5. **[minor] cross_artifact_consistency — `chg-GH-303-test-plan.md` §8.4 TP-7 (line 2860) and TP-5 (line 2857)**
   Gap: TP-7 says the `commands/board.md` reconciliation is "a deferred item owned by S4/S18
   (spec §7.3)", but spec §7.3 contains no such item and the spec never names `board.md`; the
   page's `projects[]` field (base lines 51, 78, 90) keeps meaning repository keys while linking
   to the redefined envelope. Iteration-1 non-blocking finding 13 is therefore recorded in the
   test plan and the plan's P5 constraint, but not where TP-7 says it is. Separately, TP-5's
   "Ambiguity" column still describes "the plan's TP-5 pin names only the leading date token
   `2026-11-11`", a plan state that no longer exists (the plan now pins the parenthesised form
   and `P28` enforces it — verified PASS).
   Remediation target: specification (add the deferred `board.md` item to §7.3) and
   test_planning (drop the stale TP-5 description).

6. **[nit] test_traceability — `chg-GH-303-test-plan.md` §7.1 P42 evidence line**
   Gap: `violations=$(grep -cE '^  - |VIOLATION' …)` prints `violations=0` while the guard is
   red. Reproduced on a fixture where the new status section said "the `ados repos` row": guard
   output `FAIL forbidden-literals: doc/planning/oss-tooling/status.md:231: ados`, `forbidden_exit=1`,
   `violations=0`, `P42 verdict: FAIL`. The verdict is right but the summary line misreports, and
   the failure is not self-diagnosing. Related, and worth one sentence in the plan's P5
   constraint: 10 of the 12 planning documents are literal-scanned (only `backlog.md` and
   `cli-command-registry.md` predate `corpusBaseline`), so the new `status.md` section must avoid
   the product-name literal even though `cli-command-registry.md` may carry it.
   Remediation target: test_planning (count `^FAIL ` lines) and delivery_planning (one clause in
   P5's constraint).

## Not findings (checked and cleared)

- Base pin, branch, clean tree, and every derived base fact (`1454`-line backlog, `1285/1287/1289`,
  window `1286:1286`, note `1051..1054`, context `1055:1055`, `status.md` 212 lines / last
  heading 187, registry 139 with `queue.md` 88 and `spend.md` 89, 74 backlog `###` headings,
  `m2/README.md` 12 contents rows, `milestones/README.md` 12 targets, `architecture.md`
  20 fences / 10 mermaid / C4 1-1-1 / 7 key flows) reproduce exactly.
- The conforming head adds exactly the fixture-derived invariants: headings `74 → 76`
  (`added=2`, no `UNEXPECTED:` heading), registry `139 → 140`, `repos.md` 4 fences and
  `architecture.md` 22 fences / 11 mermaid / 8 key flows, `product_files=13/13`.
- The suite claim "base 38 FAIL / 7 PASS, conforming fixture 45/45" holds for a fixture built
  independently of the author's.
- `plan validate`, `lint GH-303`, `lint plan GH-303` all pass with the stated expectations;
  `plan diff` remains genuinely unavailable as the plan declares (the containment substitution
  is justified, and P34 now decides at the boundary).
- The 26-clause fidelity oracle is satisfiable on ticket-verbatim text, so no ticket wording
  must change; NFR-8/AC-NFR8-1 is not in tension with the oracles.
- AC-NFR6-1's two named default-run failures are the real ones: `CI baseline parity (hermetic
  partial clone)` and `TC-WIRE-002` (timed out after 5000 ms), both reproduced standalone.
- No `doc/spec/**` or `doc/overview/**` statement contradicts the change; DEC-17's phase-7
  declaration remains accurate for a planning-corpus-only change.
- `doc/changes/**` additions are outside both doc guards' scope, so this record needs no marker
  or registration.

## Gate result

Delivery stays blocked on **one** blocking finding, all of it inside
`chg-GH-303-plan.yaml`'s P1 gate text. Every iteration-1 blocking defect is verified closed by
execution, including the ones the author's own fixture could not have exposed. Reopen
**delivery_planning** (finding 1, plus the two one-line clauses in findings 6), 
**test_planning** (findings 3, 4, and the TP-5 half of 5) and **specification** (findings 2 and
the §7.3 half of 5), then re-run this gate as iteration 3. No human pause is required: every
finding routes to an artifact phase, and no AC, TC, decision or test-plan procedure needs a
semantic change — the count set (45/45), the manifest (13 files), the guard results and the
P39 classifier all stand as verified.

No artifact, source file, or git state was changed by this review; the fixture worktrees were
removed and the repository was left clean.
