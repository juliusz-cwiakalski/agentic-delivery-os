# Readiness Review Iteration 4 (confirmation pass)

Verdict: NOT_READY
Work Item: GH-300
Date: 2026-11-15
Pause Required: no

Reviewer stance: confirmation pass, not a new adversarial iteration. Iteration 3's six findings were
re-verified in the artifact that owns each one; revision headers, changelog rows and pm-notes closure
claims were not accepted as evidence. Every count was re-derived from the artifacts. The full facet
sweep was not reopened; one new cross-artifact defect was found, so the affected facets were re-read
only around it.

Artifacts reviewed: `chg-GH-300-spec.md` v1.4, `chg-GH-300-test-plan.md` v1.5,
`chg-GH-300-plan.yaml` revision 1.4, `chg-GH-300-pm-notes.yaml`,
`readiness-review/readiness-iter-3.md`, current truth under `doc/spec/**` (the two read-budget
sentences and the append sentences the D register quotes), and the two delivered seams the v1.4 pins
lean on (`packages/adapters/src/file/config-source.ts` — `FileAcquisitionInput.explicitProjectRoot`/
`gitRoot`/`selectedConfig` and the `unreadable("project-committed", selected)` refusal).

## Facet Summary

Carried from iteration 3 unless re-verified here.

- spec_completeness: PASS (findings 2 and 3 verified closed in the spec)
- ac_quality: PASS
- plan_coverage: PASS (38/38 TCs, 30/30 ACs re-derived)
- test_traceability: PASS (30/30 ACs; DM 9/9)
- cross_artifact_consistency: **FAIL** — one new minor finding (the test plan names plan revision 1.3
  as the current implementation plan; revision 1.4 exists)
- decision_capture: PASS (finding 5 mitigated; one non-blocking timestamp note)
- system_spec_consistency: PASS (D-27/D-28 close the two read-budget enumerations)
- plan_doc_update_coverage: PASS (phase 7 binds D-1..D-28; 7.22 applies the two new rows)
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-3 closure table

| # | Sev | Owner | Iter-3 gap (short) | Status | Evidence read in the owning artifact |
|---|-----|-------|--------------------|--------|--------------------------------------|
| 1 | major | test plan | §2/§8.3/§9 describe plan rev 1.2, 37 TCs, TC-SMAP-008 "in the next revision", and `error.kind` in 5.7 | **CLOSED as specified; same class recurs → finding 1** | §2 (line 61) now says 38/38 TCs, phase 5 owns TC-SMAP-008 with its suite and roots in scope, and 5.7 carries no `kind`; §8.3 (1703) drops the pending-revision and `error.kind` claims; §9's 1.4 row records the rewrite. The three named false claims are gone. The revision number itself is still one behind → finding 1 |
| 2 | minor | spec + plan | Appendix D omits the two read-budget enumerations | **CLOSED** | Spec Appendix D rows D-27 (lines 34–36) and D-28 (lines 311–315) quote both sentences verbatim with line anchors and reconcile them with the one resolution attempt (§24, line 665–666); §24's exhaustiveness paragraph (668) now names the read budget as the third search key and binds phase 7 to D-1..D-28; plan 7.22 (1808) applies both; both targets sit in phase 7 `scope.files`. Line anchors re-checked against `feature-verify-gates.md` 34–36 and 311–315: the quotes are verbatim |
| 3 | minor | spec / test plan / plan | Absent-vs-selected-missing carve-out unpinned and unwitnessed | **CLOSED** | Spec: DM-9, AC-F1-4, AC-NFR8-1, Appendix A row 22, C-15, DEC-18, F-1, §8.5/§21 and the globals (559–560) all define absent as "no selection in play and no committed document" and make a selected missing/unreadable path the unusable-selector `config.value.invalid` refusal, never parity. Test plan: TC-SMAP-006 step 1(c)/8/9, TC-SMAP-008 step 1(c)/7, TC-SPAR-006 steps 2/4/5. Plan: 4.2 SELECTED-FILE RESIDUAL (1050), 5.3 (1304), 5.11 (1433) all name `explicitProjectRoot`/`gitRoot` + `selectedConfig`. Delivered code agrees (`config-source.ts:102–103,126–127`) |
| 4 | minor | test plan | TC-SCTR-003 frames the error-row edit as a phase-7 reconciliation | **CLOSED** | Precondition (1382) and note (1400) land the row, the 135→136 count, the live assertions and the true-positive corpus entry in **phase 2** with plan 2.7/2.8; §6.6 (1582) and §8.4 repeat the phase-2 framing and the sync-gate rationale |
| 5 | minor | pm-notes | Reopen provenance contradicts the phase block; no re-issued-version record | **CLOSED (mitigated)** | The note now corrects `delivery_planning` from "pending" to a completed time and states "authoritative values are the `phases:` block above; this note is narrative only"; the ARTIFACT VERSIONS notes record spec v1.4 / test plan v1.5 / plan 1.4 with totals. Residual: the narrative times (12:45:42Z/12:53:33Z/13:01:59Z) still differ from the block (13:15:19Z/13:23:08Z/13:30:45Z); this is explicit non-authoritative prose → non-blocking observation |
| 6 | nit | test plan | TC-SMAP-008 step 6 was a mutation/meta-check; TC-SPAR-004 title unqualified; TC-SNARR-006 recorder unpinned | **CLOSED** | Step 6 (510) is now an executable mutation assertion inside the suite with two named mutants and an explicit mutation verdict; §3.4 (154–155) records 0 verification-only TCs and 2 non-vacuity assertions inside step 6; TC-SPAR-004's §5.1/index/detail titles (1207) are scoped to the seven enumerable sources plus the one resolution attempt; TC-SNARR-006 (926/935) pins the throwing recorder to `members.readMemberReads` and asserts the plan-declaration read ran as a control |

## Mechanical counts (re-derived here, not copied)

- **ACs: 30.** Spec §17 six families (5+3+6+4+6+6 = 30). Test plan §3.1 names 30, plan `AC -> PHASE`
  names 30, 0 orphans either way. No criterion added or renumbered in v1.4 (spec §25 row 1.4 and the
  validation checklist both say so, and the id set matches v1.3).
- **TCs: 38** — SMAP 8 · SCITE 6 · SNARR 6 · SRES 5 · SPAR 6 · SCTR 3 · SDET 2 · SHERM 1 · SWRITE 1.
  Test plan §5.1 declares 38; §7 has 38 rows; the plan's `TC -> PHASE MAP` lists 38 distinct ids,
  each in exactly one phase — P2 1 (TC-SCTR-003), P4 24, P5 4 (TC-SMAP-004/007/008, TC-SCITE-005),
  P6 9. No duplicate owner; no TC in the test plan is missing from the map and none is extra.
- **DM: 9/9** (DM-1..DM-9; DM-8 → TC-SMAP-004, DM-9 → TC-SMAP-006/007/008 + TC-SPAR-006).
- **D register: 28 rows, contiguous D-1..D-28.** Parsed the plan's phase-7 obligations: 7.1→D-1 …
  7.16→D-16, 7.17→D-17/18/19, 7.18→D-20/21, 7.19→D-22/23, 7.20→D-24/25, 7.21→D-26, 7.22→D-27/28.
  Each id is named by exactly one obligation; none uncovered, none twice. Phase 7 `scope.files`
  contains every document named by D-1..D-28 (including `feature-capsule.md`,
  `feature-verify-change-and-exit-taxonomy.md`, `architecture-overview.md`); both new rows target
  `feature-verify-gates.md`, already scoped, so no scope growth was needed.
- **Homes.** Plan declares 86 `scope.files` + 3 `scope.folders`. Every test/fixture path in test-plan
  §6.2–§6.4 and §7 resolves to a declared file, a declared folder
  (`tests/fixtures/verify-gates/suite-map`, `…/golden`), or a pre-existing read-only control
  (`tests/behaviour/verify-support.ts`, `tests/fixtures/cross-repository/goldens/gates-members-green.json`,
  the delivered goldens, the existing `workflows/` fixtures). No writable home sits outside a phase
  scope. The 67 total reconciles: 37 test/type homes (41 paths in §7 minus the four
  `tests/fixtures/**` data files counted as fixture homes) + 30 fixture/contract-data homes.
- **`plan validate`:** reproduced from workspace source
  (`bun run packages/cli/bin/delivery-os.ts plan validate GH-300`) → `verdict=valid`, `tier=full`,
  `readyForDevelopment=true`. See the environment note.

## New defect

### 1. [minor] cross_artifact_consistency — `chg-GH-300-test-plan.md` §2 (line 61) and §8.3 (line 1703); secondarily the 14 in-body "plan rev 1.3" citations

Gap: the test plan is v1.5 but still names **plan revision 1.3** as the implementation plan, and says
that revision is "reconciled with spec v1.3 and this test plan's v1.4". The current plan is
**revision 1.4**, reconciled with spec v1.4 and test plan v1.5 (plan header, revision notes 1.4,
lines 112–178). The gap is not cosmetic in one place: §2 and §8.3 state that "revision 1.3 freezes the
documentation register as D-1..D-26, and spec v1.4's own §25 cross-artifact note names the extension
to D-27/D-28 as a plan edit (no `scope.files` change follows)" — the plan has since made that edit
(obligation 7.22 binds D-1..D-28), so the test plan describes as *pending* a plan obligation that is
now delivered, two sentences after asserting "nothing here waits on a later plan revision". A reader
following §2/§8.3 for phase-7 or DoD evidence would look for rev 1.3 and could conclude the plan does
not cover D-27/D-28. This is iteration-3 finding 1 recurring one revision smaller: the surgical pass
fixed the three substantive false claims but the plan lane then advanced to 1.4, leaving the mirror
image of the same staleness (the plan is now one revision *ahead*, not behind).

Evidence that the citations are stale, not merely historical: §2 line 61; §8.3 line 1703; TC-SMAP-006
note (441), TC-SMAP-008 preconditions/step 1(c)/step 7 (500, 504, 510), TC-SNARR-006 (926, 935),
TC-SCTR-003 (1382, 1400), §6.6 (1582), TR-20 (1655), line 1672, OQ-T13 (1700). The plan's revision
note acknowledges exactly one of these (TC-SMAP-008 step 7's quoted phrase) and states the obligation
letters are unchanged in 1.4, so the *substance* holds — which is why this is minor, not major.

Also contradicted: `chg-GH-300-pm-notes.yaml` lines 268–276 claim "plan-rev 1.3/1.4 references
corrected". They were corrected from 1.2 to 1.3 in test plan v1.5, but no reference now names 1.4.

Owning artifact: test plan (test_planning). The PM-lane sentence is the PM notes' own (this gate
writes neither).
Suggested remediation target phase: test_planning (PM lane for the pm-notes sentence).
Suggested fix: in §2 and §8.3 cite plan **revision 1.4** / spec **v1.4** / test plan **v1.5**, and
replace the "rev 1.3 freezes D-1..D-26 … pending plan edit" sentence with "rev 1.4 binds D-1..D-28;
obligation 7.22 applies D-27/D-28". Add one sentence at §2 stating that the in-body "plan rev 1.3
obligation X" citations keep their revision-1.3 obligation letters unchanged in revision 1.4 (the
plan's own cross-artifact note already establishes this), or rewrite those citations to "plan rev 1.4
obligation X (unchanged from 1.3)". No AC/TC/count change results.

## Non-blocking observations

- pm-notes REOPEN PROVENANCE: the three narrative times still disagree with the authoritative
  `phases:` block (~25–30 minutes earlier). The note now declares itself non-authoritative, which is
  what makes this non-blocking; a PM-lane touch-up could align the three values without rewriting the
  historical record.
- spec §25 row 1.4 ends with "Cross-artifact note for the plan lane: plan rev 1.3 freezes D-1..D-26
  … must be extended to D-27 and D-28". That is a revision-history row describing the state when
  spec v1.4 shipped, so it is not a current claim; leaving it as history is acceptable, though a
  reader may take it as an open obligation. Owning artifact: specification, non-blocking.
- Environment note: the installed `delivery-os` binary still fails in this worktree
  (`evaluateCrossRepositoryGates` missing from the parent checkout's `packages/core/dist`), so the
  plan's validate verdict was reproduced from workspace source instead; it is `valid`.

## Next step

Iteration 4 is a confirmation pass and produced one minor, text-only cross-artifact defect. It is not
a new authoring cycle: `test_planning` needs three sentences in §2/§8.3 plus the citation sentence
(author-agent or PM-lane surgical edit), and the PM note needs its "references corrected" claim
aligned. After that edit, one confirmation re-read of §2/§8.3 plus a citation grep is sufficient —
every other facet, count, closure and the delivered-code pins are confirmed. Delivery must not start
from this verdict.
