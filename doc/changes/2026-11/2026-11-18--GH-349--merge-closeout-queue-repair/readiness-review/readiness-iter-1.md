# Readiness Review Iteration 1

Verdict: **NOT_READY**
Work Item: GH-349 (M4-S11: Merge, closeout, and queue repair on the primitives, M4)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 1, run against the working-tree artifacts the coder will read: spec v1.2, test plan v1.3, plan v1.0 (7 phases), pm-notes, the three `Proposed` decision records, and the delivered source named by the ticket.

**Delivery is blocked.** Six blocking findings. Five of them are mechanically checkable against the delivered tree and will produce a red gate inside a declared phase, or force the coder to fabricate a value the change's own NFR-5 forbids; the sixth is a specification contradiction that no phase may resolve. Two of the six are the same class the change has already fought twice (a count that moves in one place only, and a carrier that the delivered type cannot hold).

Confidence: each blocking finding below was verified against the delivered declaration or suite named in it, not inferred from the artifacts.

## Facets

- ticket_alignment: **PASS** — all four ticket AC clauses and every named task are traced (Appendix B); the queue, milestone, and defect obligations are real and owned.
- scope_honesty: **PASS** — no new queue verb, record kind, state key, workflow job, or error identity beyond the declared three rows; the F8 "no merge queue" reading is disclosed (NG-2, Appendix G-7) rather than smuggled.
- specification_quality: **FAIL** — F4, F5, F6, F8, F9, F11, F12, F17, F18, F19.
- carrier_observability: **FAIL** — F4 (`behind` has no carrier in the delivered normalization), F9 (`landing.shaOnBase` has no defined carrier after a provider landing).
- testability: **FAIL** — F1 (the golden oracle), F10 (the queue controls), F11 (the pre-fix controls), F16 (TC-F4-010's oracle).
- traceability_coverage: **FAIL** — F3 (an unpinned total), F5 (unowned deltas), F7 (an undeclared phase citation), F8 (a family delta with no named declaration).
- plan_buildability_ordering: **FAIL** — F1, F2, F3: three phases end red inside their own declared scope, and the plan's scope rule gives the required files no staging authority.
- decision_capture: **PASS** — the three records are `Proposed`, cited not duplicated, staged in phase 1 with their committed index rows; acceptance stays the owner's act. One cross-artifact staleness is recorded as F13.
- documentation_impact_identification: **FAIL** — F14 (a current-truth page whose counts all move is in neither Appendix A nor the plan).
- risk_boundary_honesty: **FAIL** — F12 (the OQ-1 withdrawal path is materially understated), F15 (the pagination-vs-cap trade is undisclosed).

## Summary

| Severity | Count |
|---|---|
| Blocking | 6 |
| Major | 9 |
| Minor / nit | 4 |
| Total | 19 |

## Blocking findings

### F1 [blocking] testability · plan_buildability_ordering — the `refusal-rebase` golden pair must move, and the plan forbids it

**Artifact:** `chg-GH-349-test-plan.md` §6, §7.2, §7.3, TC-FLOOR-005, RSK-TP-14, §7.6(vi); `chg-GH-349-plan.yaml` phase 2 verification ("the goldens must still be byte-identical"), phase 3 scope, GOLDEN DISCIPLINE block.

**Location:** `tests/fixtures/merge/golden-scenarios.ts:130` (`refusal-rebase`), `packages/core/src/domain/merge-transaction.ts:701-730`, `tests/fixtures/merge/golden/refusal-rebase-{human.txt,scripted.json}`.

**Gap:** the `refusal-rebase` scenario seeds `refresh: {outcome: "conflicted"}` over a `mergeableState: "conflicting"` request, and the delivered transaction calls the refresh **only** on `conflicting` and then returns `merge.rebase-conflict` with `evidence.paths`. Phase 2 removes the refresh from the command path and makes `conflicting` a `merge.sync-required`/`dirty` refusal. The scenario therefore renders a different code, summary, and remediation: both `refusal-rebase` files change. The test plan and the plan assert the opposite — "exactly two files regenerated, the other thirteen byte-identical", "`refusal-rebase-*` byte-identical to pre-change content", "NO PHASE MAY DECLARE THE GOLDEN DIRECTORY AS A FOLDER … a third moved golden fails TC-FLOOR-005 naming it". Phase 2's own G1 (`bun test tests/behaviour tests/golden`) cannot be green, and the only fix the plan permits is impossible.

**Suggested remediation target phase:** test_planning (moved-golden set and TC-FLOOR-005 oracle) + delivery_planning (declare the two extra files in phase 2 or phase 3).

**Minimum fix:** state the moved golden set as the `refusal-gate` pair **and** the `refusal-rebase` pair (or declare that the rebase scenario is retired and replaced at the seam, with the golden consequence named); align §6, §7.2, §7.3, TC-FLOOR-005, M91, RSK-TP-14, §7.6(vi), and the plan's phase-2 verification line to whatever set that is.

### F2 [blocking] plan_buildability_ordering — three delivered merge suites invert under phase 2 and are declared by no phase

**Artifact:** `chg-GH-349-test-plan.md` §7.6 row 2 ("the nine merge suites"); `chg-GH-349-plan.yaml` phase 2 `scope.files`, phase 2 "Read-only controls in this phase (NOT declared)", SCOPE DECLARATION RULE.

**Location:** `tests/behaviour/merge-rebase.test.ts:28-86`; `tests/behaviour/merge-coordinator-boundary.test.ts:87-93`; `tests/behaviour/merge-waivers.test.ts:81-83`; scope lists at plan lines 779-803.

**Gap:** the change removes the local landing and the internal refresh from the command path. Three delivered suites assert exactly those facts and are absent from every phase scope (verified: the strings `merge-rebase`, `merge-waivers`, `merge-coordinator-boundary` do not occur in the plan):

- `merge-rebase.test.ts` asserts the command emits `merge.rebase-conflict` and exactly one `git-rebase-refresh` on `conflicting`.
- `merge-coordinator-boundary.test.ts` is a **positive** control named "the CLI merge command is a positive landing control" and asserts the command produces `git-squash-land` — the precise behaviour AC-F1-8 requires to be zero.
- `merge-waivers.test.ts` asserts `harness.events.indexOf("git-squash-land")` is past the waiver append; with no local landing the index is `-1` and the ordering assertion fails.

Phase 2's G1 and G12 are therefore red, and the plan's own scope rule denies the coder staging authority for the files that make them green. The root cause is a count: the test plan says "the nine merge suites"; `tests/behaviour/merge-*.test.ts` holds **16** files.

**Suggested remediation target phase:** delivery_planning.

**Minimum fix:** enumerate the merge suites by name in phase 2's scope (or explicitly classify each as an inverted control and declare it), and replace "the nine merge suites" with the exact file list in test plan §7.6 and the plan.

### F3 [blocking] traceability_coverage · plan_buildability_ordering — the identity total is pinned at 149 by a suite no phase declares

**Artifact:** `chg-GH-349-plan.yaml` PIN MOVEMENT block ("the five `149` pin sites in the suite set listed below"), phase 1 `scope.files`, phase 1 verification (G3); `chg-GH-349-test-plan.md` TC-SYNC-001.

**Location:** `tests/checks/supervision-error-socialization.test.ts:57-63` (`sourceEntries === 149`, `documentedRows === 149`), plus the `BASELINE_ROWS.length + 115` arithmetic the same file's sibling pins (`tests/checks/error-table-sync.test.ts:1081,1162,1185`, declared).

**Gap:** phase 1 adds three rows and moves the total to 152. A delivered suite outside the plan's declared set asserts the old total literally, and phase 1's verification runs `bun test tests/checks` (G3) in that same commit. The commit is red, and the file is undeclared, so under the plan's SCOPE DECLARATION RULE the commit primitive has no authority to stage the fix. The claim "the five `149` pin sites" is wrong twice: the plan actually declares six files, and the delivered tree has **seven** test files carrying the total (`error-table-sync`, `error-table`, `dispatch-attempts-taxonomy`, `verify-gates-suite-map-contract`, `ceremony-contract`, `ceremony-nonregression`, and the undeclared `supervision-error-socialization`).

**Suggested remediation target phase:** delivery_planning.

**Minimum fix:** add `tests/checks/supervision-error-socialization.test.ts` to phase 1's `scope.files` and to the PIN MOVEMENT pairs, move its two literals (and its `corpusRows` expectation if it derives from the table), and have TC-SYNC-001 name every pin site rather than "the five".

### F4 [blocking] specification_quality · carrier_observability — `behind` is unreachable given the delivered four-value normalization

**Artifact:** `chg-GH-349-spec.md` §5.1 F-2 table, AC-F2-2 (branch 1), AC-F2-3, §8.3 DM-2, §8.1 API-2, Appendix D (reason triple), Appendix G-1, RSK-7; `chg-GH-349-test-plan.md` TC-F2-002, TC-F2-007, M90; `ADR-0012` "Unresolved Questions" 1.

**Location:** `packages/adapters/src/github/normalize.ts:138-152`; `packages/core/src/contracts/ports.ts:158-192`; `packages/core/src/domain/merge-transaction.ts:701`.

**Gap:** the normalizer collapses `behind`, `blocked`, `unstable`, and `draft` into `not-mergeable`, and `DeliveryRequest` carries no other provider state that can distinguish an out-of-date head. A post-refusal re-read through the same normalized port therefore returns `not-mergeable` — never a decisive "out-of-date" condition. So the arm AC-F2-2 requires ("a re-read resolving the out-of-date condition yields `merge.sync-required` with reason `behind`") cannot fire, the second member of the closed triple is dead, TC-F2-002's decisive-re-read oracle can only be satisfied by a fixture the production input domain cannot produce, and TC-F2-007's "three members, no fourth" asserts a member no branch can emit. This is the same carrier class as D1–D7, and the ADR already records it as an *unresolved* question whose owner is `@coder` — while the spectreats it as settled. Appendix G-1 says `behind` "is not always separable"; the delivered type makes it never separable.

**Suggested remediation target phase:** specification (then the dependent test-plan cases).

**Minimum fix:** decide and write one of two answers before delivery: (a) declare `behind` unreachable under the delivered normalization and reduce the closed vocabulary to `dirty | behind-unconfirmed` (revise F-2, AC-F2-2, AC-F2-3, DM-2, API-2, Appendix D/G, RSK-7, ADR-0012, TC-F2-002/007, M90); or (b) declare the second additive provider signal that carries the out-of-date fact and make it the named carrier — which contradicts DM-1's "one additive normalized field" and must then be entered in Appendix D as a fourth delta.

### F5 [blocking] specification_quality — the additive inventory omits two deltas that delivered exact pins will enforce

**Artifact:** `chg-GH-349-spec.md` §8.3 DM-4/DM-7, §24.4 Appendix D ("complete, with counts"), NFR-6 ("each set changes by exactly the declared delta"); `chg-GH-349-test-plan.md` TC-SYNC-002, TC-SYNC-003, TC-FLOOR-001.

**Location:** `packages/core/src/contracts/closeout.ts:85-95` (`CLOSEOUT_OPERATION_NAMES`, six members), `:441` (canonical operation-argument union), `tests/structure/closeout-contract.test.ts:183-190` (exact array), `tests/structure/closeout-contract.test.ts:238` (`CONFORMANCE_FLOWS.flatMap(...).toHaveLength(14)`), `tests/structure/closeout-contract.test.ts:222` (`operationsInFlows` equality).

**Gap:** two additive deltas are missing from the inventory, from DM-4/DM-7, from every AC/TC and from all 92 mutation rows:

1. The milestone close write is recorded as a `closeout.operation`, whose `operation` field is typed `CloseoutOperationName` — a closed six-member union (`transition-work-item`, `write-work-item`, `resolve-delivery-thread`, `restore-checkout`, `delete-branch`, `remove-worktree`) validated at the state layer. None of the six can express a milestone close, so a **seventh name plus a canonical-argument arm** must be declared. Appendix D declares only "Closeout operation record kind … unchanged", which hides the name-set delta (6→7).
2. The flow registry must gain a step for `close-milestone`, so the flat step count moves 14→15 and the exact `change-lifecycle` step array moves. Appendix D counts the parity cells and the family accounting but not the flow step count.

Both are enforced by exact-array/length assertions in a file phase 5 does declare, so delivery is *possible* — but only by moving an undeclared, unowned, unasserted contract surface, which is exactly what NFR-6 and the change's thesis forbid. The inventory's own claim ("complete, with counts"; "0 moved-but-unpinned counts") is false as written.

**Suggested remediation target phase:** specification, with test_planning follow-through.

**Minimum fix:** add the two deltas to Appendix D and DM-4/DM-7 with before→after counts, give each an owning AC (a seventh `CLOSEOUT_OPERATION_NAMES` member and its argument arm; flow steps 14→15), and add them to TC-SYNC-002/TC-SYNC-003 and to the mutation register.

### F6 [blocking] specification_quality — the tenth operation's conformance step cannot carry an `assertionFamily`

**Artifact:** `chg-GH-349-spec.md` §8.3 DM-7, §24.5 Appendix E item 2, Appendix D ("Trap-family accounting … unchanged (18) … the new operation is not a trap family and must not be added to the family vocabulary"); `participation`/`flows` ripple in the plan's phase-5 header.

**Location:** `packages/testkit/src/conformance/types.ts:66-82` (`ConformanceAssertionFamily` closed six-member union; `assertionFamily` is a **required** member of every flow step), `packages/testkit/src/conformance/flows.ts:16-70`.

**Gap:** every conformance step must declare one of exactly six assertion families: `work-item`, `delivery-request`, `pipeline-run`, `comment-provenance`, `label-semantics`, `delivery-thread`. A step for `close-milestone` describes none of them. DM-7 simultaneously requires the flow registry to represent the operation "with a step" and forbids the operation from entering the family vocabulary — so the required representation is unimplementable as specified: either the closed union grows to seven (contradicting "18 unchanged … must not enter the family vocabulary", and adding an undeclared additive surface), or the milestone step is filed under a family whose assertions do not describe it (an implied capability/parity claim the conformance gate exists to prevent). The spec never mentions the required `assertionFamily` member at all.

**Suggested remediation target phase:** specification.

**Minimum fix:** decide the tenth operation's assertion family and write it: either declare the seventh family (and its accounting) in Appendix D and DM-7, or name the existing family that hosts the step with the reason the assertions still describe a milestone close, and add the choice to TC-SYNC-003.

## Major findings

### F7 [major] specification_quality · traceability_coverage — a fourth cross-phase AC→TC citation, and the plan says there are only three

`chg-GH-349-plan.yaml` CROSS-PHASE CARRIER CASES ("No other AC cites a TC outside its owning phase"). Mechanically re-derived from test plan §3.1: four ACs cite a case owned by another phase — `AC-F1-6→TC-SYNC-004` (declared), `AC-F2-5→TC-SYNC-001` (declared), `AC-F2-6→TC-SYNC-008` (declared), and **`AC-F1-7→TC-SYNC-003`** (phase 2 AC, phase 5 case; undeclared). TC-SYNC-003 is the operation-set/parity ripple and does not carry AC-F1-7's subject (a declared landing gap), so the citation also looks wrong on substance. *Fix:* drop TC-SYNC-003 from AC-F1-7's row (TC-F1-008 already carries it) or declare the fourth case in the plan with its rationale. Target: test_planning.

### F8 [major] traceability_coverage — "the pm-notes lint family grows 5→6" names no declaration that changes

`chg-GH-349-spec.md` §8.3 DM-8, §24.4 Appendix D; `chg-GH-349-test-plan.md` TC-FLOOR-001 ("pm-notes family 5→6", one of nine asserted values). The only delivered declaration of that family is `PM_NOTES_LINT_CODES` (`packages/core/src/contracts/pm-notes.ts:75-84`), which holds exactly five codes and is in **no** phase scope; `lint.phases.divergent` is a cross-surface finding that the pm-notes-only lint cannot emit, so the constant arguably should *not* change. Either reading leaves TC-FLOOR-001's value uncarried (no declared object has six) or unimplementable as scoped (the file holding it is undeclared). *Fix:* restate the delta as the documented lint row set 5→6 plus the `ERROR_TABLE` lint rows 6→7, say explicitly that `PM_NOTES_LINT_CODES` stays five (with the reason), and align TC-FLOOR-001. Target: specification.

### F9 [major] carrier_observability — the success payload's `landing.shaOnBase` has no defined meaning after a provider landing

`chg-GH-349-spec.md` §5.1 F-1, §8.3 DM-3, §8.5. `packages/core/src/domain/merge-transaction.ts:796` writes `landing: { shaOnBase: true, requestState: "merged" }` as a literal on the success path, and `tests/fixtures/merge/golden/success-human.txt` renders `landing=sha-on-base:yes`. Once the landing is provider-side and `merge` performs no fetch, the merge commit is not in the checkout, so that field asserts a containment fact the change has just declared irrelevant — and NFR-5 forbids a defaulted value standing in for an absent signal. No AC defines the field's new semantics. *Fix:* state in DM-3/§8.5 what `landing.shaOnBase` means after this change (and whether the success golden's `sha-on-base=yes` remains truthful), and add the assertion to a named case. Target: specification.

### F10 [major] testability — the queue-integrity controls have no seam to inject a breach into

`chg-GH-349-spec.md` AC-F6-1; `chg-GH-349-test-plan.md` TC-F6-001..007, §1 ("a queue property 'proven' by a suite that never injects the breach"), §6 (`integrity-breaches.ts` "a compile error, not a passing no-op"). For a property that *holds* in production, no input can make production violate it, and no test seam exists to force it; the achievable oracle is a re-derivation or a deliberately broken double, which is a different (weaker) control shape than "injects the breach and fails naming the property". GAP-TP-4 discloses this posture for the three defect suites only. *Fix:* specify the control mechanism per property (broken double vs derived comparison), mirror GAP-TP-4's disclosure, and adjust AC-F6-1's wording. Target: test_planning.

### F11 [major] testability — "fails on the pre-fix behaviour" is asserted only against re-derived controls

`chg-GH-349-spec.md` AC-F7-2, AC-F7-4, G-7, Appendix F; `chg-GH-349-test-plan.md` GAP-TP-4, TC-F7-002/003/004. The controls recompute the pre-fix derivation (`history.find(...)`), the pre-fix declaration, or inject the refresh — none runs the pre-fix production code, so the AC's literal claim ("when it runs against the pre-fix behaviour, then it fails") is not what the suite proves. The controls are genuine discriminations, but the acceptance wording overstates them. *Fix:* either reword AC-F7-2/AC-F7-4/G-7 to "fails when the pre-fix derivation is substituted", or add a recorded one-time pre-fix run (stash the repaired files at the pre-fix commit and run the new suites) as a §10 gate row. Target: specification.

### F12 [major] risk_boundary_honesty — OQ-1's withdrawal path is materially understated

`chg-GH-349-spec.md` RSK-2, Appendix G-6; `ODR-0005` withdrawal entry; `chg-GH-349-plan.yaml` OPEN ITEMS. The artifacts say a global PDR-0005 reading withdraws "the write half" and degrades the step "without touching the rest of this change". Withdrawing the write half removes the tenth adapter operation, the 30 parity cells and their adjudication, the three capability declarations, the mock routes and projections, Appendix E items 1–11, the `applied` half of AC-F4-2, and AC-F4-5/AC-F4-8's write arms — i.e. phase 5's atomic ripple, not a local degradation. The decision record names the withdrawal correctly, but the spec and the plan claim containment that does not exist. *Fix:* state the true blast radius of the global reading and make the owner's OQ-1 answer a precondition of phase 5 rather than a review-time surprise. Target: specification (and a phase-5 precondition in the plan).

### F13 [major] decision_capture · cross-artifact consistency — the plan and the test plan disagree about D8

`chg-GH-349-plan.yaml` SOURCES ("test plan v1.2"; "§11.2 D8, CLOSED by the ADR-0012 revision") vs `chg-GH-349-test-plan.md` v1.3 §11.2 ("One finding remains open: **D8**") and §2's v1.2 reference. The ADR was in fact amended (`doc/decisions/ADR-0012-…md` §Revision, `:401`, `:405`, `:429` now carry the spec's bytes, the triple, and the attribution field), so the plan is right and the test plan is stale — but a reader of the test plan is told a spec-vs-record drift persists and may author against the old forms. *Fix:* close D8 in test plan §11.2 with the revision reference, update the plan's cited test-plan version to v1.3, and add a 1.4 revision row. Target: test_planning (plus a plan comment fix).

### F14 [major] documentation_impact_identification — two current-truth pages are outside every doc list

`chg-GH-349-spec.md` §24.1 Appendix A and `chg-GH-349-plan.yaml` DOCUMENTATION block / phase 7 scope. `doc/spec/features/feature-metrics.md` states the live counts three times (`:260` "149 entries, 148 delivered rows, and 65 allowlisted … `BASELINE_ROWS.length + 115`", `:348`, `:390`) and every one of those numbers moves (152 / 151 / 65 / +118). It is in neither Appendix A nor any phase scope, and it is not in `APPENDIX_D_FILES`, so nothing detects the resulting false statement. Separately, `doc/spec/features/feature-ceremony-runner.md` is edited by phase 1 (its `149` statement is inside the delivered no-leftover scan) but is absent from Appendix A, so the spec's own doc list is incomplete even where the plan is correct. *Fix:* add both pages to Appendix A with their required reconciliation and to phase 7's staging list (metrics also needs the delivered scan extended or an explicit note that it is prose-only). Target: specification.

### F15 [major] risk_boundary_honesty — the "one bounded read, cap 200, zero pagination" contract cannot hold above the provider page size

`chg-GH-349-spec.md` §8.1 API-4, NFR-4 ("Per closeout run: ≤1 milestone read … 0 polls, 0 pagination loops, 0 retries"), AC-F4-4, OQ-3; `chg-GH-349-test-plan.md` TC-F4-008, GAP-TP-5. A single non-paginating provider read cannot return 200 attached items where the provider caps a page (GitHub's is 100), so the declared cap is unreachable, every milestone above the real page size reports `attached-set-truncated`, and AC-F4-2's `applied` is impossible for such a milestone. The fixture-decided TC-F4-008 asserts the constant equals 200 and will pass regardless, so no case can surface the limit. *Fix:* declare the effective single-read bound (or allow one bounded page walk while keeping "no polls/retries"), and state the consequence above it in Appendix G and RSK-11. Target: specification.

## Minor findings

### F16 [minor] testability — TC-F4-010's outcome sequence contradicts its own fixture list

`chg-GH-349-test-plan.md` TC-F4-010 lists seven fixtures (satisfying, already closed, absent/malformed, `none`, mismatch, withheld, gap adapter) and then assigns `would-apply, satisfied, skipped-noop, skipped-noop, skipped-noop, skipped-noop, skipped-gap` "respectively". Position 4 (`none`) must be `skipped-gap` per AC-F4-3 and TC-F4-004. *Fix:* reorder the fixture list or the outcome list so the pairs match. Target: test_planning.

### F17 [minor] specification_quality — the unknown-state residue reason is defined only in the test plan

`chg-GH-349-spec.md` §5.1 F-4 outcome table and AC-F4-4 name four withholding facts but only three residue reasons; TC-F4-007 maps unknown state to `closure-withheld`. DM-9 requires the four decode facts never to collapse, but the residue vocabulary has no `unknown-state` member, so two of the four facts share one reason. *Fix:* state the mapping in F-4's table ("unknown state → `closure-withheld`, with the state carried in bounded evidence"). Target: specification.

### F18 [minor] specification_quality — NFR-4's "1 request-detail read" contradicts the taxonomy's two reads

`chg-GH-349-spec.md` NFR-4 lists "1 request-detail read" alongside "≤1 post-refusal re-read", while TC-F2-002 asserts the request-detail read count is exactly 2 for a `not-mergeable` refusal. *Fix:* express the bound as "1 pre-refusal + ≤1 re-read". Target: specification.

### F19 [nit] ticket_alignment — "7/7 queue properties carry a defect-named regression"

`chg-GH-349-spec.md` §4.1 success metric. The seven suites are property-named (claim, park, reconcile, CRUD, removal, single-flight, presence); the ticket's defect-named obligation covers F1, F4, F8. The metric inflates the ticket's wording. *Fix:* say "7/7 properties carry a named suite with a mutation control; 3/3 named defects carry a defect-named regression". Target: specification.

## Answers to the standing questions

1. **Carrier claims.** One survives (F4: `behind`), and one new carrier gap was found outside the D1–D7 set (F9: `landing.shaOnBase`). Every other AC's cited evidence member was checked against the delivered type and exists (`MergeFailureEvidence` has `recordedSha`/`currentSha`/`paths`/`gateId`/`jobs`/`detail`/`requestState` and no timestamp, so D7's reduction holds; `MergeDeliveryRequestInput`/`Outcome` match ADR-0012 exactly; `PM_NOTES_LINT_CODES` is five; the close-only operation shape is delivered).
2. **Count claims.** Verified against delivered declarations: 149 identities ✓, 7 concrete `merge` rows ✓, 5 `PM_NOTES_LINT_CODES` ✓, 6 lint concrete rows ✓, 9 adapter operations ✓, 12 closeout steps ✓, 8 residue kinds ✓, 27 parity cells ✓, 17 emittable members ✓, 15 golden files (2 moved + 13) ✓. Two "after" states have no declared home (F5: operation names 6→7, flow steps 14→15) and one before/after label is uncarried (F8: the pm-notes family). Two population counts are wrong in the artifacts: "the nine merge suites" (16 exist, F2) and "the five `149` pin sites" (seven files carry the total, six of them declared, F3).
3. **Testability.** No case asserts a diff against a moving base; every absence claim carries a paired positive; the pre-fix controls do discriminate the derivation but are not runs of the pre-fix code (F11). Two oracle gaps: the queue controls (F10) and the milestone cap (F15).
4. **Plan coverage and ordering.** 46/46 ACs and 81/81 TCs are owned exactly once, and the [0,15,4,7,9,6,5] / [2,19,7,9,19,12,13] vectors sum correctly. The ordering logic is sound where it is argued (identity total in one commit; the Appendix E ripple atomically; defect proofs last), but three phases cannot end green inside their declared scope (F1, F2, F3), two declaration deltas are unplanned (F5), and the phase-citation claim is off by one (F7). Decision records are correctly staged, not authored (`git status`: exactly the three untracked records; index rows committed at HEAD).
5. **Contradictions.** No residual "four dimension"/"three tenants" text was found. Live contradictions: the plan vs test plan on D8 (F13), TC-F4-010's own fixture/outcome pairing (F16), and NFR-4 vs TC-F2-002 (F18). The unreachable AC is AC-F2-2's decisive branch (F4).
6. **Scope honesty.** No new queue verb/kind/state/flag, no workflow change, no fourth error identity, no milestone create/attach/detach/rename/reopen, no second landing mechanism, no fetch. The only widening reading is "queue integrity" growing from the ticket's four verbs to seven properties, which is disclosed and bounded (NG-6, Appendix C-1) — accepted.
7. **Owner-judgment items.** RSK-1/AC-F4-7 is handled honestly everywhere (spec §24.7 G-4, DEC-8, RSK-1, test plan GAP-TP-1, TC-F4-012, plan OPEN ITEMS): GH-349 does not close M4, and a case asserting a closed M4 record is a blocking review finding. OQ-3 is honestly fixture-decided, with the caveat in F15. OQ-1 is disclosed but its blast radius is understated (F12).

## Next step

Reopen `specification` for F4, F5, F6 (and the specification halves of F8, F9, F11, F12, F14, F15, F17, F18, F19), then `test_planning` for F1, F3 (case side), F7, F10, F13, F16, then `delivery_planning` for F2, F3 (scope side), and F1's file declarations. Re-run this gate after the author agents revise. No delivery phase may reopen on a DoR finding.
