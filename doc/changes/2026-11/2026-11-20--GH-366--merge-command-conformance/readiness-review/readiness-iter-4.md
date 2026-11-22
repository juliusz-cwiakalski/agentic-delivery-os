# Readiness Review Iteration 4

Verdict: NOT_READY
Work Item: GH-366
Date: 2026-11-21
Pause Required: yes

## Basis of review

- Artifacts read: `chg-GH-366-spec.md` (**v2.3**, 1625 lines, 25 AC ids),
  `chg-GH-366-test-plan.md` (**v1.5**, 3647 lines, 49 cases),
  `chg-GH-366-plan.yaml` (**v1.4**, 1594 lines, 7 phases),
  `chg-GH-366-pm-notes.yaml` (331 lines; top-level `branch` present), and
  `readiness-review/readiness-iter-1.md` … `-iter-3.md`.
- Decision records re-read: TDR-0071, TDR-0072 (§Evidence row 234 and its
  amendment row 507), TDR-0073 (Context FACT 106, evidence row 228, DC-3/DC-4,
  amendment rows 500–502). All three `Proposed`; no challenge or acceptance
  claimed (expected, not a finding).
- The CEO-D-111 ruling was re-read where the artifacts carry it: the pm-notes
  `notes:` entry (with the PM's "assumption, stated for owner review"), spec §15
  DEC-13 and §24-C, TDR-0072's evidence row, TDR-0073's amendment row.
- **Tree re-verified in this session** (not accepted from the artifacts):
  `listDeliveryRequests` is `GET …/pulls?state=open` with an opt-in
  `includeGateFacts` (`packages/adapters/src/github/client.ts:142-158,462-476`);
  `findMergedDeliveryRequest({ workItemRef, limit })` is a separate
  `GET …/pulls?state=closed` that filters by `matchesWorkItemRef`, ranks through
  `selectMerged` (`:210-214,228-244,478-503`) and then **re-reads the selected
  request through GraphQL** for review threads (`:504-545`); it returns
  `{ observation: "unavailable" }` both when the page has **no** match (`:503`)
  and when the read itself failed (`:489-492`), and
  `CloseoutReadObservation`'s `unavailable` arm carries **no** `signals`
  (`packages/core/src/contracts/closeout.ts:380-401`); the delivered suite pins
  the thread read and `signals.threads`
  (`tests/behaviour/providers/github-closeout.test.ts:146-170`); the record-less
  convergence replay reports `postLanding: []`
  (`packages/core/src/domain/merge-transaction.ts:600-637,1080-1104`); the dry
  run has no replay branch and its report type is a literal
  `result: "verified"` with no `replayed` member
  (`merge-transaction.ts:1196-1332`, `packages/core/src/contracts/merge.ts:327-334`);
  `mergeReadCodeOf` still maps `provider.not-found → merge.transaction-aborted` and
  defaults to `provider.outage` (`production.ts:2527-2545`); the remaining abort
  sites are `production.ts:2552,2578,2601` and
  `merge-transaction.ts:838-844,962-974,1067-1072`; the composition fixture records
  every transport URL and already answers `/graphql`
  (`tests/fixtures/merge/production-composition.ts:160-168,197-198,256-266`).
- Working tree is **clean** for the change folder; `stat` vs ledger:
  spec 07:01:18Z / `specification.completed` 07:07:16Z, test plan 07:07:33Z /
  `test_planning.completed` 07:07:37Z, plan 07:07:59Z /
  `delivery_planning.completed` 07:08:38Z, `last_updated` 07:07:19Z. Iteration 3
  minor 7 is closed.
- Mechanical re-derivation: 49 `Plan Phase(s)` lines, 49 unique case headings,
  0 duplicate ids, 0 missing ids, allocation 0 / 8 / 16 / 16 / 3 / 5 / 1 = 49
  (phase 1 carries none); 25/25 AC ids carry a case;
  DOD-1 arithmetic (22 + AC-F2-8 + AC-F4-2 + AC-F1-6 = 25) adds up; the plan
  parses as `delivery.plan.v1`, no `tasks` key, no tracker token in any
  `title`/`summary`, every `interactions[].target` inside its own phase scope.
- Limitation: the tracker was not re-fetched (no tracker tool in this session).
  The owner scope was verified against the live ticket in iteration 1 and is
  re-checked against the pm-notes' verbatim quotation. Basis limitation, not a
  scored finding.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration 3 findings — disposition

| # | Iter. 3 finding | Disposition | Where it now stands |
|---|---|---|---|
| 1 | AC-F1-6's read premise was false on the delivered surface (open list can never carry merged truth; the merged read ranks and exposes no count) | **CLOSED (as written)** | CEO-D-111 is implemented coherently on the budget axis: F-1 steps 1–3 (spec v2.3 354-407), §1, §2.1, §4.1, §6 Flows 1/6, §7.1, §8.4, NFR-2/NFR-10, §12, §13, DEC-13, AC-F1-6, §24-A/B all state one open read plus at most one verbatim merged read; the adapter and the shared contract are now **in phase 3's scope** (`plan` phase 3 `scope.files`: `client.ts`, `closeout.ts`) with the closeout regression pinned (`github-closeout.test.ts`). The ruling's *mechanism*, however, is under-specified against the same tree — new findings 1 and 2. |
| 2 | Phase-owned cases asserted a projection only two later phases create | **CLOSED** | TC-MRG-030/031 assert the five resolved facts plus **each run's own** projection (`gates=1/1` at phase 3); TC-MRG-010/011 assert `result=merged`, one landing and the effective ids; the two-entry equality and the `gates=5/5` failing control live in TC-MRG-044 (phase 6). No rendering moved earlier. |
| 3 | The abort row's "two causes" was false at the phase-2 boundary | **CLOSED (plan)** | Plan phase 2 (436-462) routes both `mergeRequestDetail` returns (undefined target, no-match) to `merge.request-unresolved`/`no-open-request` as a pre-resolution placeholder, names `merge-production-composition.test.ts`'s unresolved cell among the moved cells, and phase 3 supersedes the placeholder and grows the documented row to three. Re-derived against the emission sites: after the phase-2 routing the abort row reaches exactly the waiver-append failure and the declared landing gap. Residual wording defect — finding 8. |
| 4 | TDR-0073 still attributed the 22-cell matrix to spec Appendix B | **CLOSED** | Five passages (90, 131, 336, 445, amendment rows 500-501) now say "the test plan's own closed enumeration… not an arithmetic derivation from spec Appendix B". |
| 5 | Phase 6 declared the golden **folder**, so a blanket regeneration stayed in scope | **CLOSED** | Phase 6 now declares the three success files by exact path and calls the other sixteen a read-only assertion target; the phase-6 comment names iteration-3 finding 5. |
| 6 | Four `operation`-vocabulary edges were undefined | **CLOSED** | F-3 (594-624) declares the eight-token set as a *filter* over the delivered source-name vocabulary with a stated reason per excluded member (`repository-head`, `pm-notes`, `github-delivery-request-detail`), adds `delivery-registry`, the two local tokens and `-`, and makes a non-member a rendering-site rejection; Appendix B gives `merge.state-unverified → delivery-registry` and enumerates `config.credential.missing` among the landing identities. Residual token mis-assignment — finding 7. |
| 7 | Uncommitted test-plan edit and a future `last_updated` | **CLOSED** | Tree clean; `last_updated` 07:07:19Z ≤ mtime 07:07:33Z ≤ `test_planning.completed` 07:07:37Z. |
| 8 | The landing port stayed an open string, so a raw token could become an identity | **CLOSED** | DEC-14 + F-3 (652-674): one total mapping at the seam with `provider.outage` as the declared default for an unclassified token; the delivered `protection-rule` cell is re-pointed (not re-asserted) and `merge-head-guard.test.ts`'s `head-mismatch` cell takes the same arm; both files are in phase 2's scope and gate. |
| 9 | Nit — the `-`-is-wrong direction was unasserted | **CLOSED** | TC-MRG-020 now asserts both directions ("the field is **not** `-`… the case asserts both directions"). |
| 10 | Nit — AC-F1-2 said the working-tree record "governs" | **NOT TAKEN** | AC-F1-2 (1203) is unchanged; still a nit, carried below. |

## The two questions this gate was asked to answer

**1. Is the primary-read filter well-defined, given that the resolved branch
comes from a change record read at a candidate head?** **Yes.** The circulation is
broken at step 2, not at step 1: the candidate set is defined by the *invocation
ref* through the declared convention (`^[a-z][a-z0-9-]*/<REF>/.+$`), independently
of any record; each candidate is accepted only when its declaration equals **its
own** `sourceRef` (step 4); the resolved branch is therefore a *candidate's*
`sourceRef`, never a value read from before the page. Step 1's equality filter is
then a duplicate detector, not a selector, and it is decidably a subset of the
candidate set: a `sourceRef` equal to the resolved branch necessarily satisfies the
convention (the resolved branch came from a convention-matching entry), so no
equal entry can hide outside the cap, and the `> 3` refusal fires before any
duplicate scan is reachable. The ordering is stated at 361-364 and 415-423 and
reconciled with §24-A steps 1–5. Two residual clarity gaps (not defects of
well-definedness): the spec never states the equality-⊆-candidate implication
explicitly, and it never states the precedence when one page yields both a
duplicate and two accepted candidates with distinct refs — finding 5.

**2. Is the additive `signals.mergedMatches` a defensible reading of "no scope
expansion" and "no change to closeout", or does it contradict rule 4?** It is
defensible on **scope** and **not sufficient** on **evidence**.

- *No scope expansion:* correct. The count is computed from the page the read
  already holds, before `selectMerged` (client.ts:497-503), so it adds no endpoint,
  no credential, no capability and **no extra request for the count itself**; the
  read is invoked with its delivered filter and its delivered selection. Closeout's
  *behaviour and output* are unchanged (it never reads `signals.mergedMatches`),
  which is what rule 4 requires. The one honest qualification is that "no change to
  closeout" is true of behaviour, not of the shared surface: `CloseoutObservedSignals`
  is closeout's own published contract type, and the plan now declares that edit and
  scopes it (`closeout.ts`, `client.ts`, `v1-contract-inventory.json`, all in phase
  3). That is a declared, additive, optional member — not a closeout change.
- *Not sufficient:* a **number cannot name identities**. F-3 (668-672),
  AC-F1-6 (1207), AC-F3-6 (1231), §6 Flow 6 (829-830) and Appendix B row 17
  (1528) all require the duplicate-merged abort to name **the duplicate
  identities**, plural, and TC-MRG-049 cell (i) requires "both matched requests"
  to be named and neither presented as *the* request. The delivered read returns
  one selected request plus (after the change) a count; the other matched
  identities are never exposed to any caller. The count-only signal therefore
  cannot satisfy the requirement it was introduced to serve — finding 1. A second
  insufficiency is on the zero path: the delivered read's *no match* result is the
  `unavailable` observation, which has no `signals` arm, so "`mergedMatches = 0`"
  — the value AC-F1-4 and AC-F1-6's zero half, TC-MRG-005, TC-MRG-043's third cell
  and TC-MRG-049 cell (ii) all read — has no carrier, and the same observation is
  what a failed read returns — finding 2.

Plainly: the ruling is implementable, but not in the shape the artifacts describe.

## Findings

### Critical

1. [critical] cross_artifact_consistency / ac_quality / plan_coverage /
   plan_code_area_coverage — spec F-1 step 3 (385-407), §2.1 (87-92), F-3
   (665-674), §6 Flow 6 (822-833), AC-F1-6 (1207), AC-F3-6 (1231), Appendix B row
   17 (1528), DEC-13 (1170); TDR-0072:234, TDR-0073:106,228,323; test plan
   TC-MRG-024 control and TC-MRG-049 cell (i) (3216-3223), matrix cell 17
   (1660-1661); plan phase 3 "DECLARED ADDITIVE-SIGNAL EDIT";
   `packages/adapters/src/github/client.ts:478-545`;
   `packages/core/src/contracts/closeout.ts:380-401`
   Gap: the ruling's mechanism is a **count**, but its own acceptance requires
   **identities**. `signals.mergedMatches: number` tells the merge path *that*
   more than one merged request matched; the read returns only
   `selectMerged(matching)` (`client.ts:497-503`), so neither the caller nor any
   downstream layer ever sees the second (or third) matched request. Every artifact
   nonetheless requires the abort to name them: "naming the duplicate identities"
   (F-1 399-401, AC-F1-6, §6 Flow 6), "named by their duplicate identities"
   (F-3 669-672, AC-F3-6), "the duplicate identities for a duplicate-request
   abort" (F-3 629), Appendix B's `merge.transaction.aborted` row, TC-MRG-049
   ("names the **duplicate identities** (both matched requests)", "presents neither
   request as *the* request") and TC-MRG-024's control, which must flag a summary
   that names one request as *the* request. With a count alone the duplicate-merged
   abort can name exactly one identity — the one the delivered selection chose —
   which is the failure the control is written to catch. The open-duplicate half is
   unaffected (the open page carries every entry). The artifacts also record the
   PM assumption as sound ("the minimum additive change is one optional count
   signal") in spec DEC-13's rationale, pm-notes and both TDRs, so the defect is
   invisible to the owner reading the ruling.
   Blocks: yes — AC-F1-6's duplicate half, AC-F3-6's merged clause, Appendix B row
   17 and two phase-3 cases cannot be satisfied by the specified mechanism; the
   coder must either invent a wider signal or emit a refusal that does not name
   what the spec says it names.
   Suggested remediation target phase: specification (and the ruling it implements)
   Suggested fix: carry the matched identities, not only a count — e.g. one
   additive optional observation of the matched request identities (empty ⇒ zero
   matches, one ⇒ replay, many ⇒ abort naming each) — or, if the owner prefers a
   count, relax AC-F1-6 / AC-F3-6 / F-3 / Appendix B to "a count above one plus the
   selected identity" and say so in DEC-13. See the escalation below: this is the
   owner's decision, not an author's.

### Major

2. [major] spec_completeness / ac_quality / plan_coverage / test_traceability —
   spec F-1 step 3 (380-407), §4.1 read metric (295), NFR-2 (1028), NFR-10 (1036),
   AC-F1-4 (1205), AC-F1-6 (1207), Appendix B (1515); test plan TC-MRG-005
   (795-830), TC-MRG-043 (2711-2731), TC-MRG-049 cell (ii) (3224-3227), NFR-2 row
   (435), §6 fixture family (3295-3302), TP-R-15 (3568); plan phase 3 (694-712);
   `client.ts:489-492,497-503`; `closeout.ts:388-401`
   Gap: the **zero-match** outcome has no carrier, and the same observation means
   two different things. `mergedMatches` is declared as an additive optional member
   of `CloseoutObservedSignals`, which exists only on the `observed` arm; but the
   delivered read returns `{ observation: "unavailable" }` when nothing matches
   (`:503`) — and returns the *same* shape when the request failed
   (`:489-492`). So (i) `signals.mergedMatches = 0` cannot be produced at all, and
   every case that reads it (TC-MRG-005 "reports `signals.mergedMatches = 0`, so
   `no-open-request` is decided rather than assumed"; TC-MRG-043's third cell;
   TC-MRG-049 cell (ii); AC-F1-4's "observing **zero** merged matches … naming …
   the observed merged-match count") is unsatisfiable as specified; and (ii) the
   convergence attempt has **no declared outcome for a failed or invalid merged
   read** — F-1 step 3 enumerates only 0 / 1 / >1, while the delivered surface also
   yields `unavailable` (transport, auth) and `invalid` (payload). The only
   implementation the artifacts permit is to treat `unavailable` as zero, which
   reports `merge.request-unresolved`/`no-open-request` — an act-required
   remediation ("open a conforming request") for a provider outage, i.e. exactly
   the unnamed-condition failure AC-F3-5 forbids, and it makes the very distinction
   TC-MRG-005's paired control claims to prove vacuous. A careful coder will add
   `signals` to the `unavailable` arm and use signal-presence as the
   zero-versus-fault discriminator — an undeclared widening of a shared
   discriminated union, with an undeclared outcome for `invalid`.
   Blocks: yes — AC-F1-4's zero clause and AC-F1-6's declaration that zero refuses
   `no-open-request` cannot be met, and the alternative silently converts a read
   fault into a factual claim.
   Suggested remediation target phase: specification (then test_planning, then
   delivery_planning)
   Suggested fix: state where the zero count is carried and how a read fault is
   distinguished (e.g. the count carried as an additive optional member on the
   `unavailable` outcome too, absent when the page could not be read), and add the
   fourth outcome: an unreadable/invalid merged read refuses `provider.outage`
   (or `provider.payload.invalid`'s delivered mapping) with
   `operation=github-delivery-request-list`, never `no-open-request`.

3. [major] system_spec_consistency / test_traceability / plan_coverage — spec
   §4.1 (295), NFR-2 (1028), NFR-10 (1036), §8.4 (957-966), §13 (1137),
   Appendix B (1502-1505), Appendix A step 3 (1451-1456); test plan NFR-2 row
   (435), TC-MRG-034 (2218-2245), TC-MRG-043 (2731-2735), TC-MRG-049 (3213-3220),
   §6 fixture family (3280-3302), TP-R-15 (3568); plan header READ BUDGET (58-85),
   phase 3 (697-740), escalation trigger 5;
   `packages/adapters/src/github/client.ts:504-545`;
   `tests/behaviour/providers/github-closeout.test.ts:146-170`;
   `tests/fixtures/merge/production-composition.ts:256-266`
   Gap: the delivered merged read is **not one provider request**. After
   `selectMerged` it re-reads the selected request over GraphQL
   (`send("POST", "/graphql", { query: REVIEW_THREADS_QUERY … })`) and the
   delivered suite pins that read and its `signals.threads` outcome. "Used
   verbatim" therefore means a match-bearing convergence attempt costs **three**
   transport requests — the open list, the closed list, and the review-thread
   query — on the replay path and on the duplicate-merged abort path (the query is
   issued for the selected request *before* the merge path can refuse). The
   artifacts state the opposite in the strongest terms: "at most 2 delivery-request
   provider reads on any run", "Both reads are bounded and unpaginated" with an
   inventory that omits the thread read, "exactly two provider reads … no third
   read" as an **exact multiset** in TC-MRG-034/043/049, and TP-R-15's "one request
   per surface". Against a truthful transport (the composition fixture records every
   URL and already answers `/graphql`) those assertions fail by construction, and
   phase 3's and phase 4's gates contain the suites that make them.
   Blocks: yes — a phase boundary red by construction, plus a false NFR and a false
   current-truth read-budget statement that phase 7 would publish.
   Suggested remediation target phase: specification (then test_planning and
   delivery_planning)
   Suggested fix: either state the thread read in the budget (three provider
   requests on a match-bearing convergence path, two when nothing matches, none
   extra on the open-page-only paths) and adjust the exact-multiset cases to count
   the read's own query, or authorize the one further additive option that
   suppresses it for the merge caller (default unchanged for closeout) — an owner
   question, see the escalation.

4. [major] cross_artifact_consistency / test_traceability — test plan TC-MRG-043
   (2675-2755), especially step 1 and 2715-2726 vs spec API-2 (935), AC-F5-2
   (1245), F-5 (721-732), AC-F1-6 (1207);
   `packages/core/src/contracts/merge.ts:327-334`;
   `packages/core/src/domain/merge-transaction.ts:600-637,1080-1104,1196-1332`;
   plan phase 3 gate (which runs `merge-production-composition.test.ts`)
   Gap: TC-MRG-043 — a **phase-3-owned** case — asserts two things the delivered
   and specified behaviour forbids. (i) "**Both runs** exit 0, report
   `result=merged` with `replayed=true`" after step 1 runs `--dry-run` then
   `merge`: the dry run has no replay branch and `MergeDryRunReport.result` is the
   literal `"verified"` with no `replayed` member, and API-2/AC-F5-2 say a dry run
   "never reports `result=merged`". TC-MRG-049's own note declines a dry-run cell
   for exactly this reason ("inventing a dry-run cell here would assert more than
   the contract states"), so the two cases contradict each other. (ii) "the
   post-landing steps are reported (`branch-deletion`, `closeout-ready`) rather
   than silently skipped": the record-less convergence replay reports
   `postLanding: []`; the two steps are reported only on the append-failure path,
   and no AC, NFR or plan phase asks for a change to that.
   Blocks: yes — the case cannot go green without either an unspecified behaviour
   change (a dry run that reports `merged`, contradicting API-2/AC-F5-2) or a
   silent narrowing of its oracle, in the phase whose gate runs its suite.
   Suggested remediation target phase: test_planning
   Suggested fix: drop the dry-run run from step 1 (or assert the dry run's own
   contract: exit 0, `result=verified`, never `result=merged`/`squash=`), and state
   what the replay's post-landing list is (`[]` today) instead of asserting the two
   step ids — or, if the change intends to report them, raise it as a declared
   report-shape change with its own AC.

### Minor

5. [minor] ac_quality / spec_completeness — spec F-1 step 2 (365-379), step 5
   (415-423), step 7 (429-454), Appendix A steps 2 and 5 (1442-1476), AC-F1-4
   (1205); test plan TC-MRG-006 (836-860), TC-MRG-007 (903-934)
   Gap: two precedence questions are decidable only by inference. (i) A page can
   yield three convention-matching candidates of which two share the resolved
   branch A and the third declares its own distinct branch B: the
   duplicate-request abort and `ambiguous-open-request` both fire, and no artifact
   states which wins (escalation trigger 6 implies duplicate-first, but a rule is
   not a trigger). (ii) `head-unresolved` is written at run level ("a candidate
   whose asserted head … refuses `head-unresolved` and is never read") while step 7
   is written as if acceptance is per-candidate ("if no candidate can be accepted"),
   so it is unstated whether one malformed unrelated entry blocks a merge whose
   other candidate is accepted; TC-MRG-007 only exercises single-candidate pages.
   (iii) The duplicate scan's population ("open entry") is never said to be the
   candidate set, although equality ⊆ candidates follows only from an unstated
   step.
   Suggested remediation target phase: specification (then test_planning)
   Suggested fix: state "a duplicate check runs before the distinct-refs
   ambiguity", state whether an unusable candidate head refuses the run or only
   that candidate, and state that the duplicate scan is over the candidate set
   (equality implies convention membership).

6. [minor] cross_artifact_consistency — spec §4.1 success metric (296) vs §12
   assumption (1102-1106), §13 (1137), Appendix A step 3, AC-F1-6
   Gap: the metric is absolute — "Duplicate matching delivery requests resolved by
   a silent selection | **0**" — while §12 disclaims any saturation claim about the
   closed page ("bounded at `TRUTH_PROVIDER_LIMIT` … states no saturation-uniqueness
   claim") and the delivered read returns no page size, so a saturated closed page
   with one visible match still replays over unseen duplicates. The open page
   handles this by refusing on saturation; the closed page cannot detect it. The
   limitation is honestly disclosed in §12 but the KPI and AC-F1-6 do not carry the
   precondition, so the change states a guarantee it knowingly cannot meet.
   Suggested remediation target phase: specification
   Suggested fix: qualify the metric and AC-F1-6 "(within the bounded page; a
   saturated closed page is not detectable on this path and is deferred with OQ-6)",
   or add the delivered page size to the signal so saturation is observable.

7. [minor] cross_artifact_consistency — test plan matrix cell 17 operation edges
   (1670-1676) vs spec F-3 (596-620), Appendix B (1528)
   Gap: the duplicate-merged sub-run is assigned `github-merge-delivery-request`,
   but F-3 defines that token as the **landing** operation and defines
   `github-delivery-request-list` as "either state filter on the one
   delivery-request list read"; Appendix B assigns the duplicate-request cause
   `github-delivery-request-list` without distinguishing the read. A coder
   following the test plan emits the landing token on a read, and the reference
   page would then document the wrong meaning.
   Suggested remediation target phase: test_planning
   Suggested fix: use `github-delivery-request-list` for the duplicate-merged read
   (or extend F-3's definition of the token if the separate state filter is meant
   to be distinguishable).

8. [minor] cross_artifact_consistency — plan phase 2 (450-456) vs spec AC-F3-6
   (1231)
   Gap: the plan says "the documented two-cause set and AC-F3-6 are true AT THE
   PHASE-2 BOUNDARY". AC-F3-6 states "reaches exactly **three** causes"; at the
   phase-2 boundary it reaches two. The substantive claim (documented cause count =
   reachable cause count at each boundary) is sound; the sentence reporting it is
   false, and a verifier applying AC-F3-6 literally at that boundary would fail the
   phase.
   Suggested remediation target phase: delivery_planning
   Suggested fix: say AC-F3-6 is an end-state criterion whose two-cause subset
   holds at this boundary and whose third cause lands in phase 3.

9. [minor] cross_artifact_consistency — plan header (274-279) and phase 3 (731)
   vs spec §4.2 (316-317), §7.2 (899-902), §7.3 (920-924), OQ-6 (1152)
   Gap: the plan justifies "a closeout behaviour change remains out of scope
   (NG-5)" and "an edit that re-decides closeout's merged-request behaviour is
   out-of-plan (NG-5)". NG-5 is "No automatic writer that maintains the
   change-record branch declaration"; the actual basis is the §7.2 `[OUT]` item and
   the deferred closeout decision in OQ-6/§7.3. A reader checking NG-5 finds an
   unrelated non-goal, which weakens the one boundary that protects the shared
   read.
   Suggested remediation target phase: delivery_planning
   Suggested fix: cite §7.2 `[OUT]` and OQ-6 (or add a non-goal for closeout
   behaviour) instead of NG-5.

10. [minor] system_spec_consistency / plan_doc_update_coverage —
    `doc/spec/features/feature-provider-client-seeds.md:64,247` vs plan phase 7
    scope
    Gap: that page is the current-truth statement of the operation set and of the
    `CloseoutReadObservation` discriminator ("`observed` (with optional `signals`) /
    `not-found` / `unavailable` / `invalid`"). The change amends exactly those two
    statements (the read gains a consumed signal; if finding 2 is answered as
    suggested, the `unavailable` arm gains an optional member). The page is in no
    phase's scope, so the provider-surface contract would drift from the delivered
    surface.
    Suggested remediation target phase: delivery_planning (with specification as
    the gating dependency)
    Suggested fix: add the page to phase 3 (if the observation shape changes there)
    or phase 7, and let finding 2's outcome decide which of its two sentences moves.

### Nit

11. [nit] cross_artifact_consistency — spec F-1 step 3 (383-384), §7.1 (845-846),
    §8.4 (959-962), §13 (1137), Appendix A (1453), glossary (1423); plan phase 3
    (697); test plan TC-MRG-005/043/049
    Gap: the invocation is cited as `findMergedDeliveryRequest(workItemRef,
    limit = TRUTH_PROVIDER_LIMIT)`, a positional call; the delivered signature is
    `({ workItemRef, limit })`. Harmless to a coder, but "used verbatim" is the
    claim, and the cited call shape does not exist.
    Suggested remediation target phase: specification
    Suggested fix: cite `findMergedDeliveryRequest({ workItemRef, limit:
    TRUTH_PROVIDER_LIMIT })`.

12. [nit] ac_quality — AC-F1-2 (1203), carried from iteration 3
    Gap: "the record read at the request head governs over any record present in
    the checkout's working tree" against F-1's "does not participate at all"; the
    criterion is trivially satisfiable and TC-MRG-037 carries the real claim.
    Suggested remediation target phase: specification
    Suggested fix: say "is not read at all, so a worktree record cannot govern".

## Notes that are not findings

- **The phase-2 boundary is now true.** Re-derived from the emission sites, not
  from the prose: after phase 2 routes the undefined-target and no-match returns
  to the request-row placeholder and splits `mergeReadCodeOf`'s
  `provider.not-found` branch (whose final default is the declared
  `provider.outage`, so removing the branch cannot leak an undeclared code), the
  abort row is reachable only from the waiver-append failure and the declared
  landing gap. Phase 3's placeholder supersession and documented-row growth are
  consistent with it.
- **The landing-fault mapping is complete for the production seam.** The delivered
  `mergeLanding` returns through `mergeReadCodeOf`'s closed mapping
  (`config.credential.missing`, `provider.auth.rejected`, `provider.outage`), and
  `merge.landing-unverified` comes from the transaction's `unverifiedFrom`; no
  production path can emit a raw port token once the abort wrapper is removed.
- **AC-F1-6's replay mechanics are sound as behaviour.** The delivered
  record-less replay writes one transaction with `replayed: true`, lands nothing,
  needs no freshness record and no declaration, and the "no readable record
  anywhere" precondition makes the zero-record-read claim decidable (a run that
  read first would refuse `record-unreadable`). Only its read premise (findings 1
  and 3) and its dry-run neighbour (finding 4) are wrong.
- **The 49-case allocation, the 25-AC inventory, DOD-1's arithmetic, §17.6's owner
  trace and the plan's index agree exactly** and are disjoint; no case is owned
  twice; `ambiguous-merged-request` survives only in document-history rows.
- **The identity arithmetic is untouched by v2.3:** 173 / 173 / 172 / 71 / `+ 139`,
  `merge` kind 12, gate-set identity unchanged; the base at `e1ebc76c` still
  supports it (170 / 170 / 169 / 68 / `+ 136`, kind 9).
- **`plan_code_area_coverage` now passes.** Phase 3 scopes the shared read's
  adapter, its contract file, its own adapter suite, the closeout fixture, both
  export inventories, and declares `packages/cli/src/edge.ts` and
  `pm-notes-parser.ts` as no-edit boundaries. That closes iteration 3's
  "unimplementable in any phase" objection to the ruling.
- **`decision_capture` passes.** The ruling is recorded in the right places (spec
  DEC-13 + §24-C, pm-notes, TDR-0072/0073 amendments) and the PM's assumption is
  explicitly flagged "for owner review". Findings 1 and 3 are content defects in a
  correctly placed record — the DEC-13 rationale's "minimum additive change" claim
  is what the tree refutes — not a routing defect.
- **`dod_defined` passes.** DOD-1…DOD-8 are testable and tied to named evidence.
- **`plan_doc_update_coverage` passes as written** (phase 7 names the feature spec,
  the five test-specification rows, the reference page, `nonfunctional.md`, both
  guides, `.ai/agent/pm-instructions.md`, `.opencode/agent/pm.md` and its
  regenerated mirror, the conditional agents page, the changeset, the plan and the
  phrase table). Finding 10 is the one current-truth page the shared-read edit adds
  to that set.
- The pm-notes' "the plan (14)" is a typo for `v1.4`; not scored.

## What remains, and why this gate stops here

Three of iteration 3's blockers are genuinely closed, and the ruling is a real
improvement: the budget is now honest about *which* read supplies merged truth, the
code areas are declared, and the abort row's third cause is properly witnessed at
each boundary. What remains is not a fourth round of author guesswork on the same
ground — it is that **CEO-D-111's "reuse the delivered merged read verbatim and add
one optional count" does not survive contact with the delivered read**:

- the read returns one selected request, so a count cannot name the duplicate
  identities the ruling itself requires (finding 1);
- the read's zero-match result is the shared `unavailable` observation, which has no
  signal arm and is also the read-fault shape, so `mergedMatches = 0` is
  unobservable and a fault would be reported as "nothing was open" (finding 2);
- the read performs its own bounded GraphQL review-thread query after selecting, so
  a match-bearing convergence attempt is three provider requests, not two
  (finding 3).

Each of the three is cheap to fix, but the fix chooses a different shape for the
shared read — which is the owner's ground, not the author's.

**Recommendation: human escalation. Pause required: yes.**

The single decision the owner must make:

> **What may the shared merged-request read expose?**
> **(A)** Authorize the minimal additive extension of that read's result so the
> merge path can observe 0 / 1 / many matches **and name every matched identity**
> (carried on every match outcome, with an unreadable page distinguishable from
> zero), and count the read's own bounded review-thread query inside the declared
> budget — i.e. three provider requests on a match-bearing convergence attempt,
> two when nothing matches, and closeout's behaviour and output still unchanged; or
> **(B)** keep the count-only signal and relax AC-F1-6, AC-F3-6, F-3, §6 Flow 6 and
> Appendix B row 17 to "a count above one plus the selected identity", accepting
> that a merged duplicate is reported as a count and one identity rather than by
> every duplicate identity.

A separate, smaller owner confirmation is worth taking at the same time, because
it is the same object: if (A) is chosen, the additive member also lands on the
`unavailable` arm of a shared closeout contract type — an additive optional member
closeout never reads, which the plan already scopes. If (B) is chosen, the zero
case still needs that carrier or an equivalent, so (B) is not free either.

Residual non-blocking items any outcome carries into delivery/review (findings
5–12): the duplicate/ambiguity and `head-unresolved` precedence statements; the
closed-page saturation qualification of the "0 silent selections" metric; the
`github-merge-delivery-request` token mis-assignment in matrix cell 17; the
"AC-F3-6 is true at both" sentence; the NG-5 citation; the
`feature-provider-client-seeds.md` reconciliation once the read's shape is
settled; the positional-call citation; and AC-F1-2's wording.

After the owner rules, the gate should be re-run once against the amended
artifacts — the edits are confined to the lines named above, and findings 4 and
5–12 are mechanical once findings 1–3 are decided. A further author-only
iteration on the same ground is not recommended.
