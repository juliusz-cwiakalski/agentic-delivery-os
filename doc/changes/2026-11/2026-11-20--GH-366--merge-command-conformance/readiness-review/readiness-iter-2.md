# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-366
Date: 2026-11-20
Pause Required: no

## Basis of review

- Change artifacts re-read in full for the changed sections: `chg-GH-366-spec.md`
  (v2.0, 1250 lines, 24 AC ids), `chg-GH-366-test-plan.md` (v1.1, 2995 lines, 48
  cases), `chg-GH-366-plan.yaml` (v1.1, 7 phases, 1045 lines),
  `chg-GH-366-pm-notes.yaml` (top-level `branch` present).
- Decision records re-read: TDR-0071 (ALT-6 amendment, C-9, DC-2/DC-3, 24-AC
  count note), TDR-0072 (corrected premise, DC-9 arithmetic, amendment rows),
  TDR-0073 (DC-1…DC-8, DR-1…DR-7, amendment row). All three `Proposed`, each with
  one `doc/decisions/00-index.md` row (99–101), no challenge claimed — expected,
  not a DoR failure.
- Base verified in the tree, not accepted from the artifacts: `HEAD` contains
  `origin/main-tools` @ `e1ebc76c`. Counted at that tree: `ERROR_TABLE` 170
  entries (`tests/structure/error-table.test.ts:891,967,1201,1841`), delivered
  169 (`:1934`), two-segment allowlist 68 (programmatic count of
  `RESERVED_TWO_SEGMENT_CODES`), arithmetic `BASELINE_ROWS.length + 136`
  (`tests/checks/error-table-sync.test.ts:1086`), nine concrete `merge` rows
  (`feature-result-contract.md:318`), `167` already a legacy banned total
  (`error-table.test.ts:2534`). The 170 → 173 / 169 → 172 / 68 → 71 / `+136` →
  `+139` / kind 9 → 12 arithmetic is correct on the synced base.
- Tree facts re-verified where a finding depends on them: `production.ts:1897`
  (`changesDirectory = ${cwd}/doc/changes`), `production.ts:430-466`
  (`MERGE_COMPOSITION_EMITTABLE_CODES` + `MergeCompositionEmittableFamily` as a
  type only), `defect-f1-merge-refusal-containment.test.ts:109-117`
  (`productionDeclaration()` asserting `MergeCompositionEmittableFamily` /
  prefix / suffix in source text), `merge-gate-set.ts:100-108` (six entries;
  `ci-green` on `battery`), `merge-convergence.test.ts:73`
  (`retryable` expected `true`), `error-table.ts:993-1004` (abort row `true`),
  `merge-transaction.ts:838-844,966-974,1067-1076` (three residual abort sites),
  `production.ts:2531-2604` (`mergeReadCodeOf`, `mergeLanding`), 13 committed
  merge goldens with 11 byte comparisons (1 success human + 5 human + 5 scripted
  refusals), `merge-suite-obligations.test.ts:124-127` (16 / 9 / 7),
  `merge-suite-discovery.test.ts:104` (`NEW_SUITES` 5), `verify-gates.ts:231`
  (`expectedSetValid` module-private), `closeout.ts:313-314` (private
  `branchConvention`), `git ls-tree origin/main-tools doc/changes/2026-11/`
  carries no GH-366 folder.
- Test-plan allocation re-derived mechanically: 48 `Plan Phase(s)` lines, 0
  duplicate ids, 0 missing ids, 8 / 15 / 16 / 3 / 5 / 1 per phase — identical to
  the plan's index and to test plan §5.1. The 24-AC inventory is 5 + 8 + 6 + 2 +
  3 = 24 and every id has a carrier in §3.1.
- Limitation: the tracker was not re-fetched in this session (no tracker tool
  available here). Owner scope was re-checked against the pm-notes' verbatim
  quotation of the owner comment of `2026-11-20T10:42:14Z` and spec §17.6, both of
  which iteration 1 verified against the live ticket. This is a basis
  limitation, not a scored finding.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Iteration 1 findings — disposition

| # | Iter. 1 finding | Disposition | Where it now stands |
|---|---|---|---|
| 1 | Branch declaration unreadable from the base checkout | **CLOSED** | Spec F-1 reads the declaration at the request's asserted head through one bounded local tree/blob read (§5.1 lines 294-412, Appendix A step 4), TDR-0071 ALT-6 + C-9, spec §2.1 "Change record reads" admits the working-tree read cannot serve; test plan §1 constraint 3 and TP-R-10 forbid a fixture that writes the record into the checkout, TC-MRG-001 preconditions require an empty worktree, plan phase 3 scopes the head read and the fixture files. Verified against `production.ts:1897` and the base tree listing. |
| 2 | Identity arithmetic stale at 167 → 170 | **CLOSED** | Spec §4.1, §9 NFR-8, §16, §18, §17.7 DOD-5; test plan TC-MRG-038 preconditions; plan identity block lines 102-114. All numbers re-counted at `e1ebc76c`. |
| 3 | AC-F4-1 asserted delivered behaviour; no runtime oracle | **CLOSED** | AC-F4-1 now ranges over the exported runtime declaration, AC-F4-2 is the removal control, TC-MRG-028/029/045 carry them, plan phase 5 declares the value-substitution removal control. |
| 4 | False "recorded CI verdict can never refuse" premise | **CLOSED** | Spec §2.1 lines 86-96, P-3 (176-179), DEC-3; TDR-0072 amendment row + evidence rows; test plan §2 base facts. Matches `merge-gate-set.ts:100-108` and `merge-transaction.ts:690-710,755`. |
| 5 | No Definition of Done | **CLOSED** | Spec §17.7 DOD-1…DOD-8 (970-983). |
| 6 | NFR-2 budgeted two provider reads | **CLOSED** | NFR-2/NFR-10 now "one provider read — the bounded open-request list read, which also supplies the request detail"; TC-MRG-034 asserts no separate detail URL. |
| 7 | Abort row retryable deferred; convergence suite out of scope | **CLOSED (value)** | Pinned `retryable: false` in AC-F3-6 / §8.5 / Appendix B; `merge-convergence.test.ts` is in phase 2 scope (line 363) and gate (313); plan no longer defers. The residual-cause truth claim is a new finding (#2 below). |
| 8 | Rendering contract unresolved; five refusal goldens vs "six identical" | **CLOSED** | DEC-11 decides dedicated `command`/`ref` fields, AC-F3-1 asserts the fields, plan's per-file table moves all 13 goldens, TC-MRG-046. Verified 13 files / 11 byte comparisons in the tree. |
| 9 | Branch cap and absent/malformed-record outcome undecided | **CLOSED** | 256 / 3 / 262 144 pinned; six closed reasons incl. `record-missing`/`record-invalid`/`record-unreadable`; TC-MRG-004 (cap boundary) and TC-MRG-042 (all six + precedence). |
| 10 | Report shapes file out of phase 6's scope | **CLOSED** | `packages/core/src/contracts/merge.ts` + `contracts/index.ts` in phase 6 scope (900-901). |
| 11 | No oracle for value-faithful preservation of `branch` | **PARTIAL** | Plan phase 3 now scopes `phase-completion-convergence.test.ts`, `phase-support.ts`, `fixtures/phase/history.ts` and states "every document-writing branch"; but the test plan's TC-MRG-009 (§5.2 line 863) and §7.1 (line 2761) still name `phase-write-path-lint.test.ts` and a single staged write. New finding #7. |
| 12 | Merged report's gate semantics undecided | **CLOSED** | DEC-12, AC-F2-8, API-1, §10, TC-MRG-044, phase 6 renders it. Wording nit in new finding #11. |
| 13 | PM prompt/instruction surfaces and change-convention guide not updated | **CLOSED** | Phase 7 scope includes `.ai/agent/pm-instructions.md`, `.opencode/agent/pm.md`, `.ados-claude/agents/pm.md` (regenerated) and the change-convention guide, with the mirror gate. |
| 14 | Abort row's act-required oracle read off the row | **CLOSED (oracle)** | TC-MRG-023 cell 17 expanded to three residual causes with declared act-required data; TC-MRG-026 consumes the declared column, not the row. The declared values are themselves wrong for one cause — new finding #2. |
| 15 | TC-MRG-038 owned by phase 7 but authored in phase 2 | **CLOSED** | Declared cross-phase split (plan lines 90-94): phase 2 authors the values, phase 7 re-runs 038 over reconciled docs; both gates run the suites. |
| 16 | Test plan stale frontmatter/version/premises; open OQ-TP-1/2 | **CLOSED** | `links.implementation_plan` points at the YAML, spec v2.0 cited, F-4 premise corrected, OQ-TP-1/OQ-TP-2 closed with pointers. |
| 17 | Waiver path traced to AC-F2-7 | **CLOSED** | §17.6 re-traced; TC-MRG-048 added and cited. |
| 18 | `tests/fixtures/merge` folder in phases 3/4 leaked golden scope | **CLOSED** | Phases 3/4 declare the three fixture files; `tests/fixtures/merge/golden` appears only in phase 6. |
| 19 | Meta-suite blast radius understated | **CLOSED** | Test plan §7.3 and plan phase 3 lines 504-520 state all six remaining GREEN suites are edited with their pinned ids, 9/7 → 10/6. |
| 20 | No statement that the installed-binary battery is not claimed | **CLOSED** | Spec §7.2 [OUT], §18, test plan §1.2 and §4 ("E2E / live provider — Not used"). |
| 21 | `clarify_scope.started` post-dated `completed` | **CLOSED** | Both `10:47:14.870Z`. The class of defect recurs for the artifact phases — new finding #9. |
| 22 | F-4 "adding `ci-green` adds one more family instance" | **CLOSED** | F-4 lines 536-539: the instance is already in the derived population and "stays the live proof case once `ci-green` is merge-applicable". |

## Findings

### Critical

None.

### Major

1. [major] plan_coverage / cross_artifact_consistency — `chg-GH-366-plan.yaml` phase 2 (lines 235-243, gate 311-315) and phase 6 (lines 838-884, gate 885-888); spec §18 (lines 993-997); plan escalation triggers (line 147); `tests/golden/merge.test.ts:45,69,76`
   Gap: Phase 2 authors the dedicated `command=merge` / `ref=<ref>` fields in the
   renderer and says so ("the uniform field moves ALL TEN delivered refusal
   goldens … performed in phase 6"), and phase 4 changes the merged report's
   projection (which moves `success-human.txt`). But every committed golden is
   regenerated only in phase 6, and `tests/golden/merge.test.ts` appears in no
   gate before phase 6 (phase 2, 3, 5 gates omit it; phase 4 runs only
   `tests/golden/verify-gates.test.ts`). The moment phase 2 commits, the golden
   suite is red — it compares exactly those bytes (`:45`, `:69`, `:76`) — and it
   stays red through phase 5. Each phase boundary can therefore report
   "declared gate green" while the repository's own golden check fails, which the
   plan's escalation trigger forbids ("a gate is reported green while a check was
   skipped, disabled, made vacuous, or narrowed to hide a failure") and spec §18
   contradicts ("every phase leaves the delivered behaviour consistent with its
   declarations"). This is the `fix-the-check-by-narrowing` failure the plan names
   in the abstract, instantiated by its own phase split.
   Blocks: yes — four phase boundaries are red by construction while reported
   green.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Either (a) move the refusal-field rendering to phase 6 together
   with the goldens and re-allocate TC-MRG-023/024/025 to phase 6 (all emitters
   exist by then), or (b) declare the intermediate redness as an explicit, named
   exception in phase 2/3/4/5's gate blocks and amend the escalation trigger to
   distinguish "declared intermediate golden drift with a per-file movement table"
   from "a narrowed gate hiding a failure".

2. [major] ac_quality / cross_artifact_consistency — spec AC-F3-6 (line 941), §8.5 (lines 751-756), Appendix B row 20 (line 1184); TDR-0073 DC-4 (line 322), accepted-risk row (line 347); test plan TC-MRG-023 cell 17 (line 1471), TC-MRG-026 (1587-1597), TC-MRG-047 (2589-2605); `merge-transaction.ts:966-974`; `production.ts:2537-2544,2630-2632`
   Gap: The spec pins `merge.transaction-aborted` to `retryable: false` with a
   remediation that "promises no convergence", and asserts this is "true of its
   residual causes (a waiver-append failure, a refused landing, a declared landing
   gap)". The tree contradicts it for the refused-landing cause: the transaction
   converts any `ports.land` failure into this row
   (`merge-transaction.ts:966-974`), and the composition maps a provider merge
   refusal to `mergeReadCodeOf(landed)` → `provider.outage` for any
   `provider.payload.invalid` whose status is not 401/403 (`production.ts:2537-2544`,
   2624-2632). A provider outage converges on a plain re-run with no operator act,
   so the pinned `false` plus "no convergence" is inaccurate for a cause the row
   reaches, and AC-F3-5's "its remediation is accurate for the named cause" is
   false for that cell. Nothing can detect it: TC-MRG-023/026/047 carry the three
   causes' act-required values as hard-coded declared data ("each declared
   act-required `true`", TC-MRG-026 precondition), so the oracle cannot disagree
   with the spec. This is P-5's defect inverted — the row now understates
   retryability instead of overstating it — and the change is the one that makes
   the claim explicit.
   Blocks: yes — AC-F3-5/AC-F3-6 can be green while the shipped remediation is
   wrong for a reachable cause.
   Suggested remediation target phase: specification
   Suggested fix: Decide the refused-landing cause honestly. Either narrow the
   landing-fault path to its own provider identity in this change (so the abort
   row keeps only act-requiring causes, and the transient case reports
   `provider.outage`), or keep the cause and state the row's remediation and value
   as true of it (which contradicts `false` + "no convergence", so this option
   requires re-opening the pin). Apply the same decision to the waiver-append
   fault. Then have `@test-plan-writer` derive the act-required column from the
   shipped mapping for that cell instead of asserting `true`, and amend TDR-0073.

3. [major] spec_completeness — spec F-1 step 2 (lines 309-314, 368-371), §8.5 (line 762), TC-MRG-043's workaround; test plan GAP-TP-3 (lines 204-209) and TC-MRG-043 notes (lines 2381-2393)
   Gap: Convergence-first ("a merged request replays from provider truth before
   any change-record read and needs neither a record nor a declaration") is a
   required behaviour of this change, stated in F-1 and §8.5, and it is the
   provision that makes the migration acceptable (RSK-1's residual). §17 carries
   no acceptance criterion for it, and the test plan says so explicitly: "This is
   a specification gap, not a test gap … a reviewer who requires one should add it
   to the spec." A delivery that resolves the candidate set first and refuses
   `merge.branch-unresolved` for an already-merged request would still satisfy all
   24 ACs (TC-MRG-043 is traced only as "the negative of AC-F1-3"), and `dod_check`
   reads ACs. This is exactly a deliverable that can be skipped while every AC
   stays green.
   Blocks: yes — an F-1 requirement has no acceptance criterion.
   Suggested remediation target phase: specification
   Suggested fix: Add AC-F1-6 (or extend AC-F1-3) for the converged re-run: given
   a unique merged request for the ref and no readable record anywhere, the run
   exits 0 with `replayed=true`, performs zero record reads and zero record-read
   git invocations, reports no `declared-at-head` and no `merge.branch-unresolved`,
   and lands nothing; two merged matches refuse. Re-trace TC-MRG-043 to it and
   close GAP-TP-3, and add the criterion id to the §17.6 owner trace and DOD-1.

4. [major] test_traceability / cross_artifact_consistency — test plan TC-MRG-014 (lines 1083-1096), TC-MRG-020 (lines 1303-1321), TC-MRG-022 (1389-1398), OQ-TP-4 (line 2973); spec F-3 (lines 477-503), API-3 (line 702), AC-F3-1 (line 936), AC-F2-5 (line 927)
   Gap: The three cases require the failed operation to be carried "in a **named
   field** (`operation=<token>`) … not only as incidental prose", and OQ-TP-4
   records the question as "Closed by spec v2.0: the operation is a named field",
   citing API-3/F-3. The spec declares exactly two dedicated fields (`command`,
   `ref`) and puts the operation under "the breached contract in operator terms";
   AC-F3-1 asserts only the `command`/`ref` fields, the code and a named cause;
   AC-F2-5/AC-F3-2/AC-F3-4 say "naming … the operation", which a summary token
   satisfies. A spec-conforming implementation that names the operation inside the
   summary/evidence fails three phase-2/phase-4 cases, and the plan's scope for
   phase 2 does not declare a new evidence-member type.
   Blocks: yes — a conforming implementation fails a declared gate.
   Suggested remediation target phase: specification
   Suggested fix: Declare `operation=<token>` as a third dedicated rendering field
   in F-3, API-3 and AC-F3-1/AC-F2-5 (with its closed vocabulary from
   `contracts/verify-gates.ts`), and add it to phase 2's declared code areas; or,
   if the field is not intended, amend TC-MRG-014/020/022 to assert the operation
   as a named cause rather than a parsed field and correct OQ-TP-4's citation.

5. [major] plan_code_area_coverage — plan phase 4 scope (lines 699-729) vs TDR-0072 DR-1 (line 338) and `packages/core/src/domain/verify-gates.ts:231`
   Gap: TDR-0072 DR-1 requires the merge path to share the battery's
   expected-set validity rule "rather than restating it", and F-2 requires an
   empty/malformed/duplicated/over-cap expected set to refuse. That predicate is
   `expectedSetValid`, module-private in `verify-gates.ts:231` (verified). Phase 4
   scopes `merge-gate-set.ts`, `merge-transaction.ts` and `production.ts` but not
   `verify-gates.ts`; exporting the predicate (the only way to satisfy DR-1) is an
   out-of-plan edit, and re-implementing it violates DR-1 and creates the exact
   two-copy drift the rule forbids. This is the same shape as iteration 1's
   finding 10, in a file the remediation did not add.
   Blocks: yes — the phase cannot produce its stated outcome inside its declared
   scope.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `packages/core/src/domain/verify-gates.ts` to phase 4 (with
   an explicit "export `expectedSetValid` unchanged, no second predicate" note) and
   register the new export in both export inventories/list the file in phase 4's
   gate; alternatively declare it a no-edit boundary and put the shared helper in
   a file that is already scoped.

6. [major] cross_artifact_consistency — TDR-0073 DC-4 (line 322), Unknowns row (line 225), confidence note (line 452); spec AC-F3-6 (line 941), §8.5 (751-756); plan phase 2 (lines 226-234)
   Gap: The record still offers the superseded either-or ("If delivery narrows the
   residual cause set to act-free causes only, the row may instead keep `true`
   with a convergence claim restricted to that set") and still lists "Which exact
   causes remain reachable for the narrowed abort" as a `TO-CONFIRM` owned by
   "`@coder` at phase 2; settled by the row text and the test". Spec v2.0 pins the
   value unconditionally and the plan states "This is not a decision to be taken
   during delivery — it is the v2.0 contract". A coder reading the record can
   legitimately narrow the causes and keep `true`, then fail AC-F3-6; a critic
   reading the record sees an unresolved decision where the spec claims one is
   made. TDR-0072's Unknowns row 234 ("Whether the merge path needs its own
   expected-set read … owner: `@coder` at plan time") is likewise answered by the
   plan but still open.
   Blocks: no — the spec and plan agree; the record is stale — but it is the input
   the challenge and the review will read, and it contradicts the contract.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Have `@decision-advisor` amend TDR-0073 DC-4 and the Unknowns
   row to the pinned shape (value fixed, causes fixed, the escape removed, the
   TO-CONFIRM closed with the spec citation), and close or restate TDR-0072's
   anticipated-read row as decided by the plan's single-read budget.

### Minor

7. [minor] test_traceability — test plan TC-MRG-009 target/steps (line 863) and §7.1 row (line 2761) vs plan phase 3 (lines 470-478, 580-585, 534) and test plan §1.1 ("preserved value-faithfully by every document-writing branch", line 155)
   Gap: The plan locates DM-1's preservation oracle in
   `tests/behaviour/phase-completion-convergence.test.ts`, scoped and gated,
   "through EVERY document-writing branch". The test plan still names
   `phase-write-path-lint.test.ts` "plus its support fixture" and describes one
   staged `phase complete` write, which is the lint half only. The case as written
   in the test plan would pass while some document-writing branch drops the key —
   the RSK-1 mitigation would be untested.
   Suggested remediation target phase: test_planning
   Suggested fix: Re-point TC-MRG-009's target/steps and §7.1 row to
   `phase-completion-convergence.test.ts` + `phase-support.ts` +
   `tests/fixtures/phase/history.ts`, with the per-branch assertion and the
   `phase-write-path-lint.test.ts` lint half kept as the first step.

8. [minor] test_traceability / cross_artifact_consistency — test plan TC-MRG-023 notes (line 1485), §3.3 NFR-5 (line 368); TDR-0073 traceability and DR-5 (lines 90, 344); spec Appendix B (lines 1163-1185), §4.1 (line 252), NFR-5 (line 773)
   Gap: The plan claims "the 22-cell count is the spec's" and TDR-0073 calls
   Appendix B "the 22-cell refusal matrix", but the spec never states 22 (it says
   "≥ 18 cases") and Appendix B has 21 data rows. The 22 cells are a test-plan
   construct reached by splitting branch 6 rows → 1 cell, gate 4 rows → 6 cells,
   the delivered row 1 → 5 cells and the abort row 1 → 3 sub-causes (−5 +2 +4).
   Only the cell-1 and cell-17 expansions are documented, so the derivation does
   not reconcile and the citation to the spec is wrong. The enumeration table
   itself is complete, so the case is testable; the provenance is not.
   Suggested remediation target phase: test_planning
   Suggested fix: State the four expansions and the resulting 22 in TC-MRG-023's
   notes (or drop the "derived from Appendix B" claim and declare the matrix as
   this plan's own closed enumeration), and correct TDR-0073's "Appendix B's
   22-cell" wording to "the test plan's 22-cell matrix".

9. [minor] cross_artifact_consistency — `chg-GH-366-pm-notes.yaml:10-13` vs artifact mtimes
   Gap: `specification`, `test_planning` and `delivery_planning` are recorded
   complete at `11:58:54Z`, `11:59:03Z` and `12:06:01Z`, but the DoR-remediated
   artifacts were written at `12:46` (spec v2.0), `12:58` (test plan v1.1) and
   `13:05` (plan v1.1). `phase complete` never rewrites `started` and a reopen +
   re-complete would have moved `completed`, so the ledger cannot describe the
   remediation it is supposed to record; iteration 1's finding 21 was the same
   class of defect for `clarify_scope`.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Reopen and re-complete the three artifact phases through the
   `phase` family with the DoR-remediation reason (never hand-edit the
   timestamps), so the DoR remediation has a phase-family record and `dod_check`
   reads a coherent ledger.

10. [minor] spec_completeness / ac_quality — spec AC-F3-1 (line 936), API-3 (line 702), F-3 (485-486); test plan GAP-TP-4 (210-215), OQ-TP-7 (2974), TC-MRG-020 (1315)
    Gap: AC-F3-1 requires `ref=-` "when no usable ref was supplied", but the test
    plan records that no invocation reaches a merge refusal without a usable ref
    (the grammar refusal is a delivered input rejection, not a merge refusal), so
    the clause is unasserted by construction and a conforming implementation could
    omit it unnoticed.
    Suggested remediation target phase: specification
    Suggested fix: Either declare the invocation that produces `ref=-` (for
    example, count the grammar rejection as a merge refusal and add it to the
    matrix), or drop the `ref=-` clause from AC-F3-1/API-3 and state that the
    field is always the invocation ref.

11. [minor] spec_completeness — spec F-1 step 3 (314-323) and AC-F1-4 (line 916)
    Gap: Two clauses have no declared precedence: "zero candidates refuse
    `no-open-request`" and "a saturated bounded page refuses
    `ambiguous-open-request`". For a saturated page with zero convention-matching
    entries both are literally true, no case covers the combination, and the
    implementer must guess (TC-MRG-006 cell (ii) uses a saturated page with one
    match; TC-MRG-005 uses an empty page).
    Suggested remediation target phase: specification
    Suggested fix: State that saturation is evaluated before the candidate count
    (a truncated page cannot establish any uniqueness claim), or state the
    opposite, and add the combination to TC-MRG-006 or TC-MRG-005.

### Nit

12. [nit] cross_artifact_consistency — spec §5.1 F-2 (lines 455-458), §10 (lines 782-788), glossary "Merge-applicable projection" (line 1108) vs §2.1 (86-96)
    Gap: The spec says the merged report states "which gates it actually enforced",
    but the enforced set is all five built-ins (the recorded-verdict check) while
    only two are freshly evaluated. The glossary and DEC-12 are precise; the
    sentence that motivates the change is not.
    Suggested remediation target phase: specification
    Suggested fix: Say "which gates it freshly evaluated" and let the recorded
    enforcement stay named as the enforced set.

13. [nit] system_spec_consistency — spec §2.1 "Contract that this change amends" (lines 158-166)
    Gap: The paragraph says the current-truth page "states … that the merged
    report's gate list is the verification record's". The merge feature page does
    not discuss the merged report at all (no "merged report"/`gates=` sentence in
    `doc/spec/features/feature-merge-verify-deploy.md`), so phase 7 adds that
    statement rather than amending one. Every other claim in the paragraph
    (checkout-facts branch at `:36-45`, six-entry default with one merge-applicable
    at `:130-131`, exhaustive emittable set at `:377-380`) was verified.
    Suggested remediation target phase: specification
    Suggested fix: Rephrase to say the page's merged-report semantics are stated
    here and reconciled there, and keep the four verified amendments named.

14. [nit] test_traceability — test plan §2 reference (lines 242-245) vs plan phase 3 (line 401-403) and TDR-0071 evidence row
    Gap: §2 points at "the delivered parse: `readPmNotesText`" and calls it "the
    parse"; `readPmNotesText` is the locate + read + parse acquisition, and the
    parse is `parsePmNotesText` (`pm-notes-parser.ts:167,198`). Both exist; the
    plan and the record name the right one.
    Suggested remediation target phase: test_planning
    Suggested fix: Cite `parsePmNotesText` as the reused parse and
    `readPmNotesText` only as the acquisition that is *not* used on this path.

## Notes that are not findings

- The four major resolutions the remediation introduced are substantially sound
  and were checked against the tree, not accepted from the prose: read-at-head with
  a bounded `ls-tree` + blob read through the existing child-runner seam; the
  candidate set narrowed by the delivered convention and confirmed by exact
  equality; convergence decided before any record read; the six closed reasons
  with a stated precedence; the one-provider-read budget (the list read is the
  detail read, verified at `production.ts:2579-2596`); the merged-report
  projection decided in DEC-12 and asserted by AC-F2-8/TC-MRG-044; the rendering
  fields decided in DEC-11 with all 13 goldens declared per file; the runtime
  family declaration with a value-substitution removal control.
- The precedence table `declaration-disagrees` > `record-invalid` >
  `record-unreadable` > `record-missing` > `declaration-missing` >
  `declaration-unusable` is coherent for its cells (each reason is disjoint per
  candidate and the multi-candidate cells in TC-MRG-042 resolve correctly), and
  "record-unreadable above record-missing" is right because the object cannot be
  inspected. The per-candidate evidence requirement keeps a lower-ranked cause
  diagnosable rather than hidden.
- The 48-case allocation is exact and disjoint (0/8/15/16/3/5/1), matches §5.1
  verbatim, and every case carries a `Plan Phase(s)` line. The 24-AC inventory,
  DOD-1's 22 + 2 split, and §17.6's trace are arithmetically correct.
- The commit-primitive tracker-token rule still holds: no phase `title` or
  `summary` carries a `TC-` or `TDR-` token (checked with
  `\b[A-Z][A-Z0-9]*-\d+\b` over the parsed YAML).
- The plan parses as `delivery.plan.v1` with the declared keys only; every
  `interactions[].target` lies inside its own phase's scope, and no `tasks` key or
  progress log is present.
- The doc-update surface is complete for this change: feature spec, test
  specification (all five named rows exist), merge reference page,
  `nonfunctional.md` (the merge read-budget row exists at `:180` and currently
  says "one request-detail read"), the change-lifecycle and change-convention
  guides, the PM instruction surface with its regenerated mirror, the documented
  identity table (phase 2), and one changeset. `plan_doc_update_coverage` passes.
- `decision_capture` passes: three R3 records in `doc/decisions/`, `Proposed`,
  `decision_date: null`, one index row each, no challenge or acceptance claimed.
  DEC-11/DEC-12 are change-scoped decisions correctly captured in the spec's
  decision log; finding 6 is about a record's stale content, not its placement.
- All three amended records are internally consistent with the spec on the points
  they bind — the 24-AC inventory (C-5 rows), the read-at-head resolution (C-9,
  DC-2), the one-provider-read budget (C-4), the arithmetic (DC-8/DC-9), the
  runtime declaration (DC-6/DC-7) — with the two exceptions recorded in findings 2
  and 6.
