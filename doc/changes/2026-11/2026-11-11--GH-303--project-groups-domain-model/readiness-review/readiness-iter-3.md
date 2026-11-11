# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-303
Date: 2026-11-11
Pause Required: no

Reviewed artifact set: `chg-GH-303-spec.md` v1.2 (598 lines), `chg-GH-303-test-plan.md`
v1.2 (3017 lines), `chg-GH-303-plan.yaml` v1.2 (1436 lines), `chg-GH-303-pm-notes.yaml`,
`readiness-review/readiness-iter-1.md`, `readiness-review/readiness-iter-2.md`, GitHub issue
`juliusz-cwiakalski/agentic-delivery-os#303` (body + owner scope comment), and the tree under
test.

Every claim below was re-verified **by execution**, not by reading the remediation notes.
Method: base pin `5372dbacb9c36e1d79d1e55873264155a53f44ff` = `origin/main-tools`, branch
`docs/GH-303/project-groups-domain-model` at `c2e83ff9`, working tree clean. All 46 procedure
blocks (`P00` + `P01..P45`) were re-extracted programmatically from test plan §7.1 and executed
**each in a fresh shell** as `source P00; source Pn`. Five **reviewer-built** detached
worktrees at base `5372dbac` were used (never committed, never the author's
`/tmp/gh303/fx/repo`, all removed afterwards):

| Head | Shape | Purpose |
|---|---|---|
| A | 4-line context paragraph, 6-hunk backlog diff | primary conforming head (13 product files, `P34 13/13`) |
| B | 7-line context paragraph, 6-hunk diff | second conforming head, different paragraph measurement |
| C | 7-line context paragraph, 5-hunk diff | third conforming head, different hunk count |
| D | paragraph inserted **below** `### M2-S2` (outside the window) | invariant violator (P09 + P10) |
| E | conforming backlog **plus** an edited M2-S12 line | invariant violator (P10 only) |

Two further negatives were planted into head A in place (no blank line after the retirement
note; `ados` literal in the new `status.md` section; unregistered `repos.md`; `delivery unit`
removed from the C4 context; a positive mandatory-workspace claim; an AC-vocabulary S19 seed
and a property-omitting one).

## Facet Summary

| Facet | Result | Basis |
|---|---|---|
| spec_completeness | PASS | 26 ticket clauses (12 S18 + 11 S19 + 3 amendment) mapped in Appendix A and satisfiable on ticket-verbatim text (`P41 26/26` on head A); the 12/10/2 planning-document split (`12` touched = `10` literal-scanned + `2` exempt) now agrees across G-5, F-14, NFR-1, NFR-9, NFR-12, AC-NFR1-1, AC-NFR9-1, AC-NFR12-1, §17.3, Appendix D, plan header/`changeShape`/gates and test plan §3.1/§6 (no contradicting count found by pattern scan) |
| ac_quality | PASS | 45 Given/When/Then ACs (33 functional + 12 NFR) with mechanical predicates; the two declared overlaps stay partitioned by TC-029/TC-044 and TC-007/TC-017 |
| plan_coverage | PASS | 45/45 ACs and 45/45 TCs claimed **exactly once** across P1..P5 (scripted count, no duplicate, no orphan); the union of `phases[].scope.files` is exactly the 13-path Appendix C manifest |
| test_traceability | PASS | 45 AC ↔ 45 TC is bijective in §7.2 in both directions; every AC has a decidable oracle at gate level — see finding 1 for the summary-verdict defect, which the plan's enumerated gate tokens compensate for (proved by execution) |
| cross_artifact_consistency | PASS | The iteration-2 blocking contradiction is gone: plan P1's P09/P10 gates and test plan §6's "Plan-gate contract for P09/P10" now carry the **identical** invariant list; spec §8.5, TP-5 and TP-7 are restated correctly; three conforming heads are accepted and two violators rejected |
| decision_capture | PASS | DEC-1..DEC-17 plus the five intake decisions; TP-1..TP-8 and UG-1..UG-3 remain declarations, not silent absorption; no precedent-setting decision needs an ODR before delivery |
| system_spec_consistency | PASS | `doc/spec/**` and `doc/overview/**` still carry no `repos`/`projects` surface, so DEC-17/NG-3's "no current-truth change" is accurate for a planning-corpus-only change |
| plan_doc_update_coverage | PASS | `changeShape.systemSpecUpdate` and P5's constraint discharge phase 7 explicitly, with the release/tracker obligations declared rather than omitted |
| plan_code_area_coverage | PASS | Per-phase `scope.files` enumerate the manifest exactly (13 unique paths over P1..P5); P6 declares the conditional remediation surface; `commands/board.md` is absent from every list |
| dod_defined | PASS | §17.3 gives 11 checkbox items bound to AC ids; each maps to a phase `definitionOfDone` list |

## The iteration-2 blocking finding is CLOSED (verified by execution)

**Over-pinned P09/P10 measurements — CLOSED.** The plan no longer gates any fixture measurement.

- Gate text (parsed from YAML, not grepped as text): zero occurrences of `paragraph_lines=4`,
  `1055..1060`, `backlog_hunks=6` or `inside=6` in **any** `phases[].gates`,
  `phases[].definitionOfDone` or `phases[].constraints`. The four literals survive only in
  `revision.history[]` (narrative) and `revision.adoptedExpectations.nonGatedMeasurements`,
  which is explicitly labelled as satisfiability evidence and not a gate.
- P1 `definitionOfDone` now says "every hunk confined inside those regions and zero hunks outside
  them … (no hunk-count literal is gated)"; "three changed regions (six zero-context hunks)" is
  gone.
- P1 constraint 2 now states that the paragraph's length and line numbers are deliberately not
  constrained, so the constraint no longer contradicts its own gate.

Mechanically evaluated gate tokens (scripted: each plan token must appear in the procedure's
output; `key>0` requires a printed integer ≥ 1):

| Head | P09 plan gate | P10 plan gate |
|---|---|---|
| A — 4-line paragraph, `context_paragraph=1055..1060`, `backlog_hunks=6`, `inside=6` | **PASS** 15/15 | **PASS** 5/5 |
| B — 7-line paragraph, `context_paragraph=1055..1063`, `paragraph_lines=7` | **PASS** 15/15 | **PASS** 5/5 |
| C — 7-line paragraph, `backlog_hunks=5`, `inside=5` | **PASS** 15/15 | **PASS** 5/5 |
| D — paragraph below `### M2-S2` | **REJECT** (`paragraph_lines=0`, `paragraph_strictly_between=FAIL`) | **REJECT** (`hunks: inside=5 outside=1`, `hunk confinement FAILED`) |
| E — neighbour story line edited | PASS (paragraph intact) | **REJECT** (`hunks: inside=6 outside=1`, `hunk confinement FAILED`) |
| F — no blank line after the retirement note | **REJECT** (`blank_after_note=0`, `paragraph_strictly_between=FAIL`) | n/a |
| base `5372dbac` | **REJECT** (`paragraph_lines=0`) | **REJECT** (`backlog_hunks=0 non_vacuous=no`) |

The invariants are therefore neither over- nor under-pinned: two heads with **different**
paragraph lengths, and three with **different** hunk counts (5, 6, 6), all pass; every planted
invariant violation is rejected by the gate the plan declares. `P08` is also invariant-only in
practice — head A reports `s17_last=1291 separator=1332 epic_m3=1334 window=1292:1331` (not the
fixture-derived `1294:1309`) and still `P08 verdict: PASS` on `placement=inside-window`,
`separator_sequence=identical`, `blank_line_before_separator=1`, `window_empty=no`.

## Iteration-2 non-blocking findings — closure verified

1. **Spec §8.5 advisory note (finding 2) — CLOSED.** §8.5 now says the row "gains the pack's
   advisory phrase … the same form the M2-S3, M2-S5 and M2-S10 rows carry — rather than a new
   dependency edge" and adds that the base row carries none. No stale adjective remains.
2. **P22 anchor (finding 3) — CLOSED.** With the S19 seed written in AC-F8-1's own vocabulary
   ("two member branch names and two pull-request numbers") `coverage_anchors=10/10`,
   `P22 verdict: PASS`; removing the branch/PR property yields `9/10`, `FAIL`. The anchor is
   still a real check, not a rubber stamp.
3. **P11 mandatory-claim diagnostic (finding 4) — CLOSED.** The required sentence
   ("an optional directory usable as a discovery root … never required") yields
   `workspace_mandatory_claim=ABSENT`, `PASS`; a planted "The workspace directory is required."
   yields `PRESENT (violation, 1 sentence(s))` with the offending sentence printed and
   `P11 verdict: FAIL`. The false positive is gone and the true positive still bites.
4. **TP-5 / TP-7 (finding 5) — CLOSED.** TP-5 no longer describes a withdrawn plan pin and states
   the parenthesised-date invariant from F-12/AC-F12-1 alone. TP-7 no longer cites a `board.md`
   deferral in spec §7.3; it records the deferral in the two places that hold it (§8.4 TP-7 and
   the plan's P5 constraint) and notes that §7.3 defers only board *scoping* to M2-S4 and never
   names the page. The plan's P5 constraint carries the same clause.
5. **P42 evidence line and the ten-document scanned set (finding 6) — CLOSED.** Verified below.
6. **Commit-safety secret false positive (raised by the author, not by this gate) — CLOSED.**
   `SECRET_CONTENT_PATTERNS` from `packages/adapters/src/file/secret-scan.ts` run over
   `chg-GH-303-test-plan.md`: `whole_file_matching=0`, `per_line_matching=0`, filename patterns
   no match. Control: the same file with that helper's local renamed back to one of the
   scanner's credential trigger words, bound to the `matchSeedLiteral` result, reports exactly
   1 match on the pre-fix line (line 2701 only), so the scanner and the pattern are the right
   ones and would have caught the old shape. The sample is described rather than quoted here:
   the scanner is content-based, so reproducing the assignment would trip it in this record
   too.

## P42 — green, red and fail-closed, all verified

| Corpus | Result |
|---|---|
| base `5372dbac` | `forbidden_exit=0`, `planning_scanned=9/10`, `scanned_total=139`, `violations=0`, `failures=0`, `seed_hits=0`, `classes=5/5` → **PASS (control)**, exactly as the plan's P1/P2 control claims |
| head A (13 files) | `forbidden_exit=0`, `scanned_total=140`, `planning_present=10`, `planning_scanned=10/10`, `missing_from_scan=0`, `not_scanned_hits=0`, `violations=0`, `failures=0`, `seed_hits=0`, `classes=5/5` → **PASS** |
| planted `` `ados` `` in the new `status.md` section | `forbidden_exit=1`, `FAIL forbidden-literals: doc/planning/oss-tooling/status.md:231: ados`, `violations=1`, `VIOLATION doc/planning/oss-tooling/status.md:231: ados` → **FAIL** with the offending `file:line: token` |
| `repos.md` present but unregistered | `failures=1`, `missing_from_scan=1`, `UNSCANNED doc/planning/oss-tooling/milestones/m2/commands/repos.md` → **FAIL** |

The ten `SCANNED` paths printed on head A are byte-for-byte the ten documents AC-NFR9-1(a)
enumerates (`milestones/README.md`, `m2/README.md`, `m2/architecture.md`, `m2/contracts.md`,
`m2/commands/projects.md`, `m2/commands/repos.md`, `m2/test-scenarios.md`, `m2/journeys.md`,
`m2/entrypoint-delta.md`, `status.md`), and `backlog.md` plus `cli-command-registry.md` are
confirmed absent from the registry, i.e. the 10/2 split the spec states is the guard's actual
behaviour. The oracle no longer reads `violations` from a log grep: the red run reports
`violations=1` (the old shape reported `violations=0` while red).

## Counts, containment and gates — re-measured

- **45 ACs / 45 TCs / 1:1.** 45 AC ids in §17.1–§17.2 (33 `AC-F*` + 12 `AC-NFR*`, no duplicates);
  45 `TC-M2DOM-0xx` ids; §7.2 maps every TC to at least one AC and every AC to at least one TC
  with no orphan and no duplicate; the plan claims all 45 ACs and all 45 TCs exactly once;
  `coverageSummary` = 45/45, 33/12, `claimedExactlyOnce: true`.
- **13 product files, no `board.md`.** Appendix C has 13 rows and P4's `scope.files` union is
  exactly those 13 (11 modified planning docs + 1 new `commands/repos.md` + 1 registry row).
  `milestones/m2/commands/board.md` appears in no phase scope and no manifest row; P6 re-lists
  the same 13 paths as the conditional remediation surface. Head A reproduces
  `product_files=13/13`, `expected_not_changed=0`, `unexpected_changed=` empty,
  `other_scripts_changed=0`, `P34 verdict: PASS`.
- **Suite claim.** Base re-measured today: **38 FAIL / 7 PASS** (`P29`, `P35`, `P38`, `P39`,
  `P42`, `P43`, `P44`), identical to test plan §10 and to iteration 2.
- **Artifact gates.** `delivery-os plan validate GH-303` → `verdict=valid`,
  `readyForDevelopment=true`, rc 0; `delivery-os lint GH-303` → `class: conforms`, rc 0;
  `delivery-os lint plan GH-303` → `verdict=valid`, `errors=[]`, rc 0.
- **No gate is verdict-only.** Every `phases[].gates` entry that names a procedure also names at
  least one `key=value` invariant, so no gate rests solely on a procedure's summary line.

## Findings

### Blocking

None.

### Non-blocking

1. **[major] test_traceability — `chg-GH-303-test-plan.md` §7.1 verdict lines P09 (line 1932),
   P10 (line 1968), P11 (line 1995) and P31 (line 2352)**
   Gap: each summary verdict omits the property it is supposed to test, so a head that violates
   the AC still prints `Pn verdict: PASS` (reproduced today):
   - P10 on head D and head E: `hunks: inside=5 outside=1`, `OUTSIDE: @@ …`, `hunk confinement
     FAILED` — and `P10 verdict: PASS`. The verdict condition is only
     `[ "$hc" -ge 1 ] && [ "$t" -eq 3 ]`, i.e. "a diff exists and the classifier self-tests
     pass"; the `hunk_guard` return value is discarded.
   - P09 on head F: `blank_after_note=0`, `paragraph_strictly_between=FAIL` — and
     `P09 verdict: PASS` (the condition is only `pl>=1` and a non-empty window).
   - P11 on a head whose C4 context loses "delivery unit":
     `repository_as_delivery_unit=MISSING` — and `P11 verdict: PASS`.
   - P31 on a registry carrying an out-of-scope row change (`outside=3`): prints **no verdict at
     all**, because the `||` branch only fires when `changed==0`.

   Why this does **not** block: the plan's P1/P2/P5 gates enumerate the individual tokens
   (`hunk confinement OK`, `outside=0`, `paragraph_strictly_between=OK`, `blank_after_note=1`,
   `repository_as_delivery_unit=OK`), and I verified mechanically that the plan gate **rejects**
   every one of these heads even though the procedure verdict says PASS. So no delivery gate is
   vacuous or unsatisfiable; the defect is in the summary line, and it is pre-existing (all four
   verdict clauses are unchanged from v1.1). It is recorded because test plan §6 (v1.2) now lists
   "verdict `PASS`" among the gated invariants, which overstates what the verdict proves, and
   because the §10 log contains no negative fixture for P10/P31 — the gap that let this survive
   two reviews.
   Suggested remediation target phase: test_planning.
   Suggested fix: carry the property into each verdict (`… | hunk_guard … && echo PASS`, and
   equivalently for P09's `paragraph_strictly_between`, P11's
   `repository_as_delivery_unit`, and P31's `out`/`mut`), or state in §7.1 that the verdict is a
   summary and the tokens are the oracle; add the D/E/F negatives to §10.

2. **[minor] cross_artifact_consistency — `chg-GH-303-spec.md` AC-F13-1 (line 399) and §13
   (line 312), `chg-GH-303-test-plan.md` §3.1 (line 111) versus P36's delivered-claim detector**
   Gap: the three artifact statements describe the M3-S6 row as "`repos` subcommands **delivered
   later**". The product file that carries that row (`cli-command-registry.md`) is scanned by
   P36, whose claim regex matches any `delivered` within the same line as `repos` unless it hits
   the exclusion vocabulary ("delivered later" does not). A coder quoting the AC's wording
   therefore produces `delivered_claims>=1`, and the plan gates `delivered_claims=0`
   (P3 gate, plan line 1069). Reproduced on head A's own registry wording: two hits
   (`status.md`, `cli-command-registry.md`). The gate is satisfiable — the plan's P5 registry
   constraint already prescribes "later `repos` subcommands", which passes — so this is a wording
   hazard, not an unsatisfiable gate.
   Suggested remediation target phase: specification.
   Suggested fix: use "later `repos` subcommands" in AC-F13-1, §13 and the test plan's coverage
   row, or add `delivered later` to P36's negation list.

3. **[nit] cross_artifact_consistency — `chg-GH-303-pm-notes.yaml` `notes[]` (last entry, line 212)**
   Gap: the PM notes still record the artifact set as "Spec v1.1 … Plan v1.1", while spec, test
   plan and plan are all at v1.2 and the plan's `revision.driver` cites
   `readiness-review/readiness-iter-2.md`. A reader of pm-notes alone sees stale versions; the
   iteration-2 and iteration-3 remediation records live only in the artifacts' own revision logs.
   Suggested remediation target phase: delivery_planning (the pm-notes owner).
   Suggested fix: add one `info`/`decision` note recording the iteration-2 remediation and this
   iteration's verdict with the artifact versions.

## Not findings (checked and cleared)

- The four measurement literals are absent from every gate, DoD and constraint (parsed, not
  grepped as free text); `nonGatedMeasurements` is labelled non-gated and no gate references it.
- Test plan §6's invariant list and the plan's P1 P09/P10 gate list are word-for-word the same
  set — the two artifacts now cite the same contract, which was the iteration-2 defect.
- `P31`'s `fixture_outside=2` and `P37`'s `queue_row=88 repos_row=89 spend_row=90` are properties
  of the procedure's own fixture and of base, not measurements of a head: the mutation is a fixed
  `sed` on the `supervise` row and every allowed row is classified before it.
- `P35`'s `base_headings=74 head_headings=76 added=2` is an invariant given the change adds
  exactly two stories (reproduced on heads A and C).
- Base facts reproduce: 1454-line backlog, retirement note `1051..1054`, context window
  `1055:1055`, separator 1287 / Epic M3 1289, 74 `###` headings, registry 139 with `queue.md`
  at 88 and `spend.md` at 89, `status.md` 212 lines with last heading 187, architecture
  20 fences / 10 mermaid / 7 key flows.
- The conforming heads reproduce the shape invariants: registry `139 → 140`, headings `74 → 76`,
  `repos.md` 4 fences, `product_files=13/13`, `P41 26/26`, `P40 8/8` key flows.
- `plan diff` remains genuinely unavailable as the plan declares; the containment substitution
  (P34 base..worktree) is justified and decides at the P5 boundary (`post_commit_check=pending`
  is not a gate).
- No `doc/spec/**` or `doc/overview/**` statement contradicts the change; DEC-17's phase-7
  declaration remains accurate for a planning-corpus-only change.
- `doc/changes/**` additions are outside both doc guards' scope, so this record needs no marker
  or registration.

## Gate result

Delivery is unblocked. The single iteration-2 blocking finding is closed by execution: the plan
gates only invariants, three conforming heads with different paragraph lengths and hunk counts
are accepted, and every planted invariant violation is rejected by the plan's own gate tokens.
The two prior rounds' non-blocking findings are also closed. The remaining findings are one
summary-line defect inside the test plan (compensated by the plan's enumerated tokens — proved,
not assumed) and two wording/recording nits; none of them stops delivery or makes a gate
unsatisfiable or vacuous.

No artifact, source file, or git state was changed by this review; the five reviewer worktrees
were removed and the repository was left clean (`git status --short` empty).
