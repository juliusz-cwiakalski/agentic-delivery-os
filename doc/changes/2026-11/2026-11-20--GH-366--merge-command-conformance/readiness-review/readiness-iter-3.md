# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-366
Date: 2026-11-20
Pause Required: no

## Basis of review

- Artifacts read: `chg-GH-366-spec.md` (v2.1, 1342 lines, 25 AC ids),
  `chg-GH-366-test-plan.md` (v1.2, 3278 lines, 49 cases; one uncommitted edit to
  TC-MRG-046), `chg-GH-366-plan.yaml` (v1.2, 1302 lines, 7 phases),
  `chg-GH-366-pm-notes.yaml` (282 lines, top-level `branch` present), and
  `readiness-review/readiness-iter-1.md` / `readiness-iter-2.md`.
- Decision records re-read: TDR-0071 (ALT-6, C-9, DC-2/DC-3), TDR-0072 (corrected
  premise, DC-8/DC-9, the `expected-set read` FACT row). TDR-0073 (DC-1…DC-8,
  DR-1…DR-7, amendment rows). All three `Proposed`, one `doc/decisions/00-index.md`
  row each (99–101); no challenge or acceptance claimed — expected, not a finding.
- Base/tree re-verified in this session (not accepted from the artifacts):
  `listDeliveryRequests` is `GET …/pulls?state=open` (`client.ts:462-475`) while
  `findMergedDeliveryRequest` is a **separate** `GET …/pulls?state=closed`
  (`:478-499`) that filters by `matchesWorkItemRef` and **ranks** several matches
  by entity id via `selectMerged` (`:228-244`); both are used by the merge
  composition (`production.ts:2579, 2595`) and by closeout
  (`production.ts:3101`, `edge.ts:2368`); the dry-run report's gates are the
  merge projection (`merge-transaction.ts:1220-1268, 1317-1326`) while the merged
  report's gates are the stored record's list (`:912, :917, :1083-1099`); the
  delivered default set is `ci-green`/`four others` on `battery` plus
  `tracker-freshness` on `merge` (`contracts/merge.ts:72-92`); the golden test
  pins exactly 13 files and 11 byte comparisons of distinct files
  (`tests/golden/merge.test.ts:109-134, 39-45, 66-85`); the composition still
  emits `merge.transaction-aborted` for an unresolved request
  (`production.ts:2578, 2599`; asserted at
  `merge-production-composition.test.ts:424-426`); `merge-convergence.test.ts:66-79`
  drives the refused-landing cell with the arbitrary port code `protection-rule`;
  `verify-gates.ts:231` still holds module-private `expectedSetValid`;
  `doc/spec/nonfunctional.md:180` states the merge read budget without any
  merged-request read.
- Mechanical re-derivation: 49 `Plan Phase(s)` lines, 0 duplicate ids, 0 missing
  ids, allocation 8 / 16 / 16 / 3 / 5 / 1 = 49; 25/25 AC ids carry at least one
  case; DOD-1 arithmetic (22 + AC-F2-8 + AC-F4-2 + AC-F1-6 = 25) adds up; the
  golden arithmetic 13 → 15 (phase 2) → 19 (phase 3) and 11 → 13 → 17
  comparisons matches the delivered suite's own counting rule.
- PM rebuttal to iteration 2, finding 9 re-checked independently: the workspace
  clock is CET (+01:00) (`date`, `stat`), so 12:46/12:58/13:05 local are
  11:46/11:58/12:05Z — before the recorded completions. The rebuttal holds **for
  the v1.1/v2.0 pair it describes**; finding 9 is closed as stated.
- Limitation: the tracker was not re-fetched (no tracker tool in this session).
  Owner scope was re-checked against the pm-notes' verbatim quotation and spec
  §17.6, both verified against the live ticket in iteration 1. Basis limitation,
  not a scored finding.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Iteration 2 findings — disposition

| # | Iter. 2 finding | Disposition | Where it now stands |
|---|---|---|---|
| 1 | Phase split left the golden suite red at four boundaries | **CLOSED** | Per-phase subsets with `tests/golden/merge.test.ts` in each affected gate (plan 79-135, 443-449, 725-730, 938-944, 1137-1141); arithmetic re-derived against the delivered 13 files / 11 distinct-file comparisons and it reconciles. Residual weakening in phase 6 only — new finding 5. |
| 2 | Abort row's `false` + "no convergence" false for the refused-landing cause | **CLOSED (spec/plan)** | F-3 546-565, AC-F3-3, AC-F3-6, §8.5, Appendix B row 1269-1270; TDR-0073 DC-4 pinned with the either-or removed. The routing is a genuine pass-through for the production port, but its boundary claim is not true at phase 2 — new finding 3. |
| 3 | Convergence had no acceptance criterion | **CLOSED (as written)** | AC-F1-6 (990), TC-MRG-049, GAP-TP-3 closed, §17.6 row, DOD-1. The criterion's read premise is the blocker — new finding 1. |
| 4 | `operation=<token>` asserted by cases but undeclared in the spec | **CLOSED** | F-3 511-520, API-3, AC-F3-1, Appendix B header, TC-MRG-014/020/022/023/024, OQ-TP-4. Vocabulary edge cases — new finding 6. |
| 5 | `verify-gates.ts` unscoped in phase 4 | **CLOSED** | Phase 4 scope 966-967 + barrel 967, export-unchanged/no-second-predicate note 899-913, inventory allowance in scope. |
| 6 | TDR-0073 stale either-or and open `TO-CONFIRM` | **CLOSED** | DC-4 (322), evidence rows 213-214 promoted to FACT, Unresolved Questions closed, amendment row 495. TDR-0072's anticipated-read row closed (234). Residual attribution wording — finding 4. |
| 7 | TC-MRG-009 targeted the lint half only | **CLOSED** | Case 927-969 (per-branch preservation after a real `phase complete`), §7.1 row 3054, plan scope 778-780. |
| 8 | 22-cell provenance mis-attributed | **PARTIAL** | The test plan now declares it its own enumeration (1506-1513, 1597) but TDR-0073 still says "derived from the spec's Appendix B rows by declared expansions" in five places — finding 4. |
| 9 | Artifact phases completed before their artifacts were written | **CLOSED** | PM rebuttal verified (CET vs UTC). Note: the current uncommitted test-plan edit post-dates `test_planning.completed` — finding 7. |
| 10 | `ref=-` unasserted by construction | **CLOSED** | Clause dropped in F-3 507-510, API-3, AC-F3-1; GAP-TP-4 and OQ-TP-7 closed. |
| 11 | Saturation precedence undecided | **CLOSED** | F-1 step 3 334-340, AC-F1-4, Appendix A step 3, Appendix B, TC-MRG-005/006. |
| 12 | "gates it actually enforced" wording | **CLOSED** | F-2 475-482, §10, glossary 1185, DEC-12. |
| 13 | §2.1 claimed the current page states the merged report's gate list | **CLOSED** | The paragraph now separates the four amendments from the semantics stated here and reconciled in phase 7. |
| 14 | `readPmNotesText` called "the parse" | **CLOSED** | §2 268-271 and §7.2 3107-3109 cite `parsePmNotesText` as the parse and `readPmNotesText` as the unused acquisition. |

## Findings

### Critical

1. [critical] cross_artifact_consistency / spec_completeness / plan_code_area_coverage / test_traceability — spec F-1 steps 1-2 (lines 319-330), AC-F1-6 (line 990), NFR-2 (§9 line 838), NFR-10 (line 846), §24-A steps 1-2 (1198-1205); test plan NFR-2 row (line 399), TC-MRG-049 (2893-2939), §6 fixture family (2991-2994); plan phase 3 goal and scope (540-560, 737-810); `packages/adapters/src/github/client.ts:228-244, 462-499`; `packages/cli/src/production.ts:2574-2599, 3101`; `packages/cli/src/edge.ts:2368`; `doc/spec/nonfunctional.md:180`; TDR-0072 evidence row 234
   Gap: AC-F1-6 states that "a delivery-request list read carry[ies] exactly
   one merged request", F-1 step 1 says the one bounded **open**-request list
   read "yields the merged and open entries", and TC-MRG-049 asserts "exactly
   one provider read (the list) per run". The delivered surface cannot do that:
   `listDeliveryRequests` is `?state=open` and never returns a merged request;
   merged requests come from a second, distinct `?state=closed` read
   (`findMergedDeliveryRequest`), which (a) filters by `matchesWorkItemRef`, not
   by the declared branch convention the spec requires, (b) is shared with
   closeout (`production.ts:3101`, `edge.ts:2368`), and (c) **ranks** multiple
   matches by entity id in `selectMerged`, which is exactly the behaviour
   AC-F1-6 forbids ("two or more merged matches refuse rather than rank"). Three
   consequences, all blocking:
   (i) the read budget is false on the resolution path — a converged run, and a
   run that must rule convergence out first (F-1 decides convergence "before any
   change-record read", so before the candidate set), spends **two** provider
   reads, contradicting NFR-2, NFR-10, AC-F1-3's "no other provider read" and
   TDR-0072's FACT row ("no second provider read");
   (ii) the two-match refusal needs the count/ambiguity that the delivered
   observation type does not expose, so it can only be implemented by editing
   `packages/adapters/src/github/client.ts` — a file in **no** phase's scope
   (`plan.scope.undeclared-paths` would reject it) — and any change there moves
   the shared closeout read, which NG-5/§7.2 keep out of scope;
   (iii) TC-MRG-049's fixture ("an optional merged section" inside the
   open-request list reply) fabricates a provider shape that cannot occur, so the
   case would pass against a transport that lies while the production path stays
   at two reads — the same defect TP-R-10 forbids for the change record.
   Blocks: yes — one AC of the 25 cannot be satisfied as written, its carrier
   cannot be green against a truthful transport, and the code area that would
   implement it is undeclared.
   Suggested remediation target phase: specification (primary), then
   delivery_planning and test_planning
   Suggested fix: State the convergence read honestly and decide it in one
   place: either (a) declare the delivered merged-request read as the second
   permitted provider read, give it the convention filter and an
   ambiguity/count observation (with closeout's regression named), scope
   `packages/adapters/src/github/client.ts` in phase 3, and restate NFR-2/NFR-10,
   TDR-0072's FACT row and TC-MRG-049's read assertion; or (b) keep the one-read
   budget and declare how merged truth is obtained from the same open list read
   (today impossible) — which needs an owner ruling. Either way the fixture must
   serve the read the production path actually performs.

### Major

2. [major] plan_coverage / cross_artifact_consistency — test plan TC-MRG-030 (1897-1931), TC-MRG-010 contrast cell (1016-1018), TC-MRG-011 (1053-1059); plan phase 3 gate (727-730), phase 4 gate (938-944), phase 4 "GOLDEN MOVEMENT IN THIS PHASE: NONE" (923-929), phase 6 (1081-1105), header table (115-135); `merge-transaction.ts:1220-1268, 1317-1326` (dry-run gates = merge projection) and `:912, 917, 1083-1099` (merged gates = stored record's list); `contracts/merge.ts:72-92`
   Gap: three phase-owned cases assert the **end-state report projection**
   ("both render the same two-entry projection (`ci-green`, `tracker-freshness`)")
   that only two later phases create. At the end of phase 3 the dry run renders
   `gates=1/1` (`ci-green` is still on the `battery` surface) and the merged
   report renders the verification record's five-entry battery list, because the
   report's gate list changes in phase 6. TC-MRG-030 therefore fails at phase 3
   on both halves (entry count and report-vs-dry-run equality), and phase 3's gate
   runs `merge-production-composition.test.ts`. TC-MRG-010's contrast cell has
   the same dependency and passes at phase 4 only if an undisclosed dry run
   happens to leave a two-entry record as the freshest record — an accidental
   oracle, not the projection. TC-MRG-011 is safe only by that same side effect.
   This is the iteration-2 major 1 defect reproduced in behaviour assertions
   rather than goldens: a phase boundary red by construction, with the plan's own
   escalation trigger ("A phase boundary is not gate-green") firing.
   Blocks: yes — phases 3 and 4 cannot be gate-green with their declared cases.
   Suggested remediation target phase: test_planning (with a delivery_planning
   cross-check)
   Suggested fix: Move the projection assertions out of 030/010 and into
   TC-MRG-044 (phase 6): 030 keeps the resolved-object equality and asserts each
   run's **own** projection; 010's contrast cell asserts `result=merged`, one
   landing and the gate ids the run evaluated (one at phase 4, two after phase
   6), or is split into a phase-4 half and a phase-6 half. Do not move the
   report rendering earlier — that would contradict the golden table and phase 6.

3. [major] cross_artifact_consistency / ac_quality — plan phase 2 goal 2 (309-331) and "Declared row change in this phase" (413-417); plan escalation trigger 2 (line 214); spec F-3 (546-565), AC-F3-6 (1014), Appendix B abort row (1269); `packages/cli/src/production.ts:2578, 2599`; `merge-transaction.ts:599`; `tests/behaviour/merge-production-composition.test.ts:424-426`
   Gap: the phase-2 claim "`merge.transaction-aborted` … reaches exactly two
   causes" is false at the phase-2 boundary. `mergeRequestDetail` still returns
   `merge.transaction-aborted` for an undefined target and for "no open and no
   merged match", and the transaction forwards it verbatim; that return is
   replaced only in phase 3 by the candidate-set resolution. The delivered
   composition suite asserts exactly that behaviour (`merge.transaction-aborted`
   for an unresolved request), and it is scoped in phase 3, not phase 2. So at
   the end of phase 2 the row reaches four causes, the current-truth documented
   row that phase 2 edits states two, and escalation trigger 2 ("reaches any
   cause other than its two pre-mutation causes") fires. TC-MRG-026/047, both
   phase-2-owned, must either count those two causes (fail) or silently narrow
   their population (the "fix the check by narrowing" failure the plan names).
   Blocks: yes — the phase-2 boundary is either red or its oracle is narrowed.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Either route the two `mergeRequestDetail` abort returns in
   phase 2 to a declared identity the phase already adds (for example
   `merge.request-unresolved` / `no-open-request` as a pre-resolution
   placeholder, superseded in phase 3), or state that trigger 2 and the
   documented cause set are evaluated at the **post-phase-3** state and have
   TC-MRG-026 derive the cause set from the transaction's emission sites only —
   and name `merge-production-composition.test.ts:424-426` explicitly among the
   cells phase 2 moves.

### Minor

4. [minor] cross_artifact_consistency — TDR-0073 lines 90, 130, 334, 359, 432,
   440 vs test plan 1506-1508, 1597 and TDR-0073's own amendment row (495)
   Gap: the record's amendment says "the record no longer attributes the 22-cell
   enumeration to the spec", but five body passages still say the matrix is
   "derived from the spec's Appendix B rows by declared expansions", while the
   test plan now declares it "this plan's own closed enumeration, **not** an
   arithmetic derivation from spec Appendix B". A critic reading the record sees
   a provenance the plan denies.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Have `@decision-advisor` restate the five passages as "the
   test plan's own closed 22-cell enumeration; Appendix B is its reference, not
   its arithmetic source", matching the amendment row.

5. [minor] plan_coverage — plan phase 6 `scope.folders: [tests/fixtures/merge/golden]` (1165-1170) vs header table (79-135), TC-MRG-046 ("every phase declares its subset by exact path", 2692-2718), escalation trigger 15 (line 227)
   Gap: phases 2 and 3 declare their golden files by exact path; phase 6 declares
   the whole folder, so a blanket regeneration in phase 6 (any of the ten refusal
   files, not just the success trio) would stay inside the declared scope and the
   golden suite would pass, because the suite compares runtime output to the file
   and asserts no file is byte-identical to a prior baseline (`success-scripted.json`
   is not compared at all). The plan says "a change to one here fails the suite by
   name" — it does not.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Replace phase 6's folder with the three success files by exact
   path and keep the folder only as a read-only assertion target in the case's
   prose (or keep the folder and add the missing byte-identity assertion to
   `tests/golden/merge.test.ts` so "outside the subset" is detectable).

6. [minor] ac_quality / cross_artifact_consistency — spec F-3 (511-520), Appendix B (1238-1246), AC-F3-1 (1009), AC-F3-6 (1014); plan phase 2 (340-349)
   Gap: four vocabulary edges are undefined: (i) the plan says the vocabulary is
   "derived from the delivered source-name vocabulary", but
   `VERIFY_GATES_SOURCE_NAMES` also carries `pm-notes`, `delivery-registry` and
   `repository-head`, which the closed set omits — the derivation is a filter,
   not a derivation; (ii) `github-delivery-request-detail` appears unreachable
   once the list read is also the detail read, so it is a declared token no cell
   can emit; (iii) a landing refused for a missing credential emits the declared
   `config.credential.missing` (via `mergeReadCodeOf`), a fourth landing-fault
   identity AC-F3-6's enumeration does not name; (iv) `merge.state-unverified`
   (a local record-store read) has no operation token and no stated `-` rule.
   No cell is unassertable and the matrix's membership check is not vacuous, so
   this does not block.
   Suggested remediation target phase: specification
   Suggested fix: State the derivation rule (the six provider source names plus
   two local tokens plus `-`), drop or justify
   `github-delivery-request-detail`, add `config.credential.missing` to the
   landing-fault enumeration, and state that a non-provider state read renders
   `operation=-`.

7. [minor] cross_artifact_consistency (housekeeping) — `chg-GH-366-test-plan.md` working-tree state vs `chg-GH-366-pm-notes.yaml:12`
   Gap: at review time the test plan carries an uncommitted 62/29-line edit
   (TC-MRG-046's phase-split rewrite) with mtime 12:36Z, i.e. after
   `test_planning.completed` 12:34:13Z, and its frontmatter says
   `last_updated: 2026-11-20T14:10:00Z`, a time still in the future (review
   clock 12:38Z). The iteration-2 timestamp rebuttal covers the earlier
   v1.1/v2.0 pair; this remediation step is not covered by it.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Commit the reviewed test plan (the PM's `commit` primitive),
   correct `last_updated` to the real UTC write time, and let the phase ledger
   describe the commit through the `phase` family (reopen + re-complete if the
   completion must post-date the commit). No hand-edited timestamp.

8. [minor] ac_quality — plan phase 2 "this is a pass-through, not a new mapping" (322-324); `merge-transaction.ts:963-975`; `merge-convergence.test.ts:66-79`; NFR-7 (spec 844)
   Gap: the refused-landing site emits whatever string the `land` port returns.
   The delivered port type is `{ ok: false; code: string }` and the delivered
   cell drives it with the arbitrary code `protection-rule`; once the abort
   wrapper is removed that code becomes the emitted identity, which resolves to
   no declared row (NFR-7 totality), and `mergeReadCodeOf`'s
   `provider.not-found → merge.transaction-aborted` branch is a mapping the
   pass-through does not remove. The plan calls this "not a new mapping" and does
   not require a closed landing-fault type.
   Suggested remediation target phase: specification + delivery_planning
   Suggested fix: Declare the landing-fault identity set as a closed type on the
   port contract (or state the one mapping table the site applies), and note that
   `merge-convergence.test.ts`'s cell is re-pointed to a declared identity, not
   merely re-asserted.

### Nit

9. [nit] test_traceability — TC-MRG-014/020/022 (1083-1096, 1303-1321, 1389-1398) vs the matrix's `operation=-` rule (1530-1534)
   Gap: the three cases assert the field exists and is in-vocabulary; none
   asserts the negative direction ("a read-named cause must not render `-`") for
   the credential cell, which the matrix states. Covered by TC-MRG-023, so this
   is redundancy rather than a gap.
   Suggested remediation target phase: test_planning
   Suggested fix: Add the `-`-is-wrong assertion to TC-MRG-020, or note the
   delegation to 023.

10. [nit] test_traceability — AC-F1-2 (986) vs F-1 (418-421)
    Gap: AC-F1-2 says the head record "governs over any record present in the
    checkout's working tree", but F-1 says the working-tree read "does not
    participate" at all. The criterion is satisfiable trivially; the strong claim
    is the scan in TC-MRG-037.
    Suggested remediation target phase: specification
    Suggested fix: Say "is not read at all, so a worktree record cannot govern"
    and keep the scan as its oracle.

## Notes that are not findings

- The v2.1 abort narrowing is the right shape and was checked against the tree,
  not the prose: the production landing seam (`mergeLanding`,
  `production.ts:2616-2666`) can only yield `config.credential.missing`,
  `provider.auth.rejected`, `provider.outage` or the fired-but-unobserved
  `landing-unverified` path — never `provider.not-found` — so the pass-through
  produces declared identities for every **production** landing fault, and the
  waiver-append and declared-landing-gap cells are the only remaining abort
  causes. Findings 3 and 8 are about boundaries and the port contract, not about
  the decision.
- AC-F1-6's behavioural clauses are sound and assertable: the delivered
  transaction already replays from provider truth at exit 0 with
  `replayed=true`, appends a transaction and lands nothing, and the zero-record-
  read claim is made decidable by making the head object absent (a run that read
  first would refuse `record-unreadable`) — a genuinely non-vacuous oracle. Only
  its read premise (finding 1) is wrong.
- The `operation` field is the right fix for a vacuous `merge`-prefix assertion,
  and the matrix's act-required column is now a genuine oracle (derived from the
  shipped mapping plus a plain re-run) rather than transcribed data. Cell 17's
  two causes and cell 20's three landing identities are disjoint and correct.
- The 22-cell enumeration reconciles arithmetically (1 + 3 + 1 + 6 + 2 + 3 + 1 +
  1 + 4 = 22) and no cell is unassertable; only its provenance wording in
  TDR-0073 is stale (finding 4).
- The 49-case allocation, the 25-AC inventory, DOD-1's arithmetic, §17.6's owner
  trace, and the plan's index agree exactly and are disjoint.
- The identity arithmetic is untouched by v2.1: 173 / 173 / 172 / 71 / `+ 139`,
  `merge` kind 12, gate-set identity unchanged; the base at `e1ebc76c` still
  supports it (170 / 170 / 169 / 68 / `+ 136`, kind 9).
- `plan_doc_update_coverage` passes: phase 7 names the feature spec, the five
  test-specification rows, the reference page, `nonfunctional.md`, both guides,
  `.ai/agent/pm-instructions.md`, `.opencode/agent/pm.md` and its regenerated
  `.ados-claude` mirror, the conditional agents page, the changeset, the plan
  artifact and the phrase table.
- `decision_capture` passes: three R3 records in `doc/decisions/`, `Proposed`,
  one index row each, no challenge or acceptance claimed; DEC-11/DEC-12 are
  change-scoped and correctly in the spec's decision log. Finding 4 is content
  staleness in a correctly placed record, not a placement defect.
- Commit-primitive hygiene still holds: no phase `title` or `summary` carries a
  `TC-`/`TDR-` token (checked with `\b[A-Z][A-Z0-9]*-\d+\b` over the parsed
  YAML); the plan parses as `delivery.plan.v1` with the declared keys; every
  `interactions[].target` lies in its own phase's scope; no `tasks` key or
  progress log.
- The golden table's arithmetic is correct on the delivered set: 13 committed
  files, ten of them moving in phase 2, the success trio and stale pair in phase
  3, the success trio again in phase 6 — 18 movements over 13 files with five
  doubled; 2 files added in phase 2 and 4 in phase 3 → `EXPECTED` 13 → 15 → 19
  and distinct-file byte comparisons 11 → 13 → 17, which matches the delivered
  suite's counting rule. Findings 2 and 5 concern **behaviour assertions** and
  phase 6's folder scope, not this arithmetic.

## What remains before READY

1. Finding 1 must be settled in one place — which read supplies merged truth, at
   what budget, with what convention filter and what multi-match behaviour —
   and the spec (NFR-2/NFR-10/AC-F1-6/§24-A), TDR-0072's FACT row, the plan's
   phase-3 code areas, and TC-MRG-049's fixture/read assertion must all move with
   it. This is the one item that may need the human owner: option (b) (a genuinely
   single read) changes either a shared closeout read or the no-new-provider-
   operation constraint (NG-1/NG-5), which is an owner-scope ruling.
2. Finding 2 must move the projection assertions to TC-MRG-044 or split them, so
   phases 3 and 4 can be green with their own declared cases.
3. Finding 3 must make the phase-2 abort boundary true, or scope its claim and
   its trigger to phase 3.
4. Findings 4-10 are non-blocking and may ride with the same remediation pass.
   Findings 5-8 are cheap and should be taken in the same edit to avoid a fourth
   iteration.

Escalation assessment: findings 2 and 3 are author-level fixes (test planning and
delivery planning) and need no human input. Finding 1 is author-level **unless**
the owner holds the one-provider-read constraint: then the choice between
"declare the delivered merged-request read" and "rework a shared read" is an
owner decision and should go to the human rather than a fourth automated
iteration. If a further iteration shows findings 1-3 still open, escalate.
