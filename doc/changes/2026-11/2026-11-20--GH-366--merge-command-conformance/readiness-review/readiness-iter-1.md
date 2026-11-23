# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-366
Date: 2026-11-20
Pause Required: no

## Basis of review

- Change artifacts: `chg-GH-366-spec.md` (v1.2), `chg-GH-366-test-plan.md` (v1.0), `chg-GH-366-plan.yaml` (7 phases), `chg-GH-366-pm-notes.yaml`.
- Ticket: GH-366 body + all four owner comments (`2026-11-19T20:49Z`, `2026-11-20T01:22Z`, `2026-11-20T01:23Z`, `2026-11-20T10:42Z`).
- Decisions: TDR-0071/0072/0073 (all `Proposed`, R3, challenge not performed) and `doc/decisions/00-index.md` rows 91–93.
- Current truth: `feature-merge-verify-deploy.md`, `test-spec-merge-verify-deploy.md`, `feature-result-contract.md`, `nonfunctional.md`, `definition-of-done.md`.
- Tree evidence read: `packages/cli/src/classify.ts:76-97`, `packages/core/src/domain/merge-gate-set.ts:36-52,83`, `packages/core/src/domain/merge-transaction.ts:598,690-710,755,912-917,1195-1330`, `packages/cli/src/production.ts:1814,2444-2520`, `packages/core/src/contracts/error-table.ts`, `tests/structure/defect-f1-merge-refusal-containment.test.ts`, `tests/golden/merge.test.ts` + `tests/fixtures/merge/golden/`, `tests/structure/merge-suite-obligations.test.ts`, `tests/checks/merge-suite-discovery.test.ts`.
- Merge base: `origin/main-tools` is **one commit ahead** of the branch base, `e1ebc76c feat(GH-350): deliver declarative provider policy (#372)`.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: FAIL
- dod_defined: FAIL

## Findings

### Critical

1. [critical] cross_artifact_consistency — `chg-GH-366-spec.md` §5.1 F-1 (lines 240-288), §6 Flow 1, §12 assumption (line 625); enforced by AC-F1-1/AC-F5-2 and test-plan TC-MRG-001/TC-MRG-031
   Gap: The only declared branch source is a `branch` key on the change's pm-notes, read through the delivered text read, whose root is `${cwd}/doc/changes` (`production.ts:1814,2621`; `readPmNotesTarget`). For an in-flight change that record exists only on the change branch: `git ls-tree origin/main-tools doc/changes/2026-11/` has no GH-366 (nor had GH-350 before it merged). So in the scenario the owner demands — `merge` invoked from the integration-base checkout — the read finds no record, and the run can only refuse (`merge.branch-unresolved`, or whatever an absent record becomes). Flow 1 and AC-F1-1 assume the record is readable from the base checkout; it is not. TC-MRG-001 papers over this by having the fixture *write* `chg-<ref>-pm-notes.yaml` into a checkout whose HEAD is on the base (test plan lines 360-367) — a state a real checkout cannot be in. As specified, the change would replace the owner's observed "verified the base tip" with "cannot resolve the branch", and the capability is unavailable exactly where owner AC 1 requires it.
   Blocks: yes — the primary user-visible outcome (owner AC 1 / regression (a)) is not achievable by the specified mechanism.
   Suggested remediation target phase: specification
   Suggested fix: State a branch-declaration source that exists in the invocation checkout or is readable without the change branch checked out (read the change-archive document at the resolved request head via the delivered read path, or a declared git-object read of the change ref's tree), and amend TDR-0071 accordingly (it is still `Proposed`). Then restate Flow 1, AC-F1-1/AC-F5-1/AC-F5-2 and TC-MRG-001/TC-MRG-030/TC-MRG-031 on a fixture that reproduces the real base checkout (no change folder in the worktree).

2. [critical] cross_artifact_consistency — spec §9 NFR-8 (line 580), §4.1, §16 (line 680); test plan §3.3 NFR-8 row and TC-MRG-038 (lines 1717-1748); plan identity block (lines 63-69) and phase 2/7 comments
   Gap: The "167 → 170" arithmetic was true at intake (`31e56a15`) and is now stale. `origin/main-tools` already carries GH-350 (`e1ebc76c`), whose merge moved the table to **170 entries / 170 documented / 169 delivered / 68 allowlist / `BASELINE_ROWS.length + 136`** (`tests/structure/error-table.test.ts` asserts 170; `feature-result-contract.md` says 170; `feature-metrics.md` says +136). After a sync the three additive rows must move **170 → 173**, documented 173, delivered 169 → 172, `+136` → `+139`, merge kind 9 → 12 (still valid), and the **allowlist 68 → 71**. Also note `LEGACY_ENTRY_167_FORMS` now treats 167 as a banned stale total, so a page that "moves" 167 → 170 would be asserting the pre-change value. Every phase-2/7 gate command and TC-MRG-038's oracle would fail or, worse, pass against the wrong total.
   Blocks: yes — NFR-8 and TC-MRG-038 are the acceptance for the identity move; the spec, test plan and plan all state numbers that no longer describe the base.
   Suggested remediation target phase: specification
   Suggested fix: Sync the branch to `origin/main-tools` before re-authoring, then restate NFR-8, §16, TC-MRG-038, and the plan's identity block from the post-sync tree (173 / 173 / 172 / 71 / +139), and add the post-sync numbers to the pm-notes as the recorded intake base. Propagate to test_planning and delivery_planning in the same revision.

3. [critical] test_traceability — spec AC-F4-1 (line 726) vs F-4/G-5/DEC-7 (§5.1 lines 375-395, line 664); test plan TC-MRG-028/TC-MRG-029 (lines 1366-1437); `tests/structure/defect-f1-merge-refusal-containment.test.ts:108-114`
   Gap: The v1.2 correction is factually right — `mergeGateFamilyEntry` (`classify.ts:76-97`) already resolves a live family refusal, and the delivered containment suite already asserts both the family row and the live mismatch control. But the artifacts did not follow the correction: AC-F4-1 (and TC-MRG-028/029) assert *delivered* behaviour that is green at HEAD, and the suite's `productionDeclaration()` proves "a family declaration exists" by matching `MergeCompositionEmittableFamily` + prefix/suffix strings in source text. Nothing in the 22 ACs or 41 cases fails if the runtime declaration is never added: the `family: true` flag in the test is hard-coded, not read from a runtime value. F-4's actual deliverable (a runtime family declaration beside the exact-member list, with the totality proof ranging over it) is asserted only by prose, and DEC-7's claim that it "must be made declarative here" has no oracle. This is the one capability whose delivery could be silently skipped while every AC stays green.
   Blocks: yes — an acceptance criterion that passes before the work is done cannot gate the work.
   Suggested remediation target phase: specification
   Suggested fix: Add an AC (and a negative control) of the form: the totality proof reads a runtime family declaration exported by the composition; deleting that declaration (or replacing it with the bare exact-member list) makes the proof fail by name, and no source-text match remains as the proof. Then re-point TC-MRG-028/029 at the runtime value and add a pre-change control.

### Major

4. [major] system_spec_consistency — spec §2.1 "Recorded CI verdict" (lines 81-86), P-3 (lines 150-151), DEC-3 rationale (line 660)
   Gap: The spec asserts a persisted failing `ci-green` verdict "can never reach the merge refusal" because the shipped default excludes it from the merge-applicable surface. False at HEAD: `resolveMergeGateSet` puts every built-in id into `enforcedMergeEntries` regardless of surface (`merge-gate-set.ts:83`, type comment lines 46-52), and `merge-transaction.ts:690-710` refuses on a recorded non-pass `ci-green` found there. The real defect is narrower and different: `ci-green` is never *freshly* evaluated on the merge path (skipped at `merge-transaction.ts:755` and absent from `mergeEntries`, so the dry run's recipe switch yields `unknown/read-failed` — `:1219-1276`). TDR-0072 carries exactly this as an open TO-CONFIRM ("the recorded half is a delivered safeguard rather than a gap"), and the spec states the unresolved answer as fact while the decision's rationale repeats it.
   Blocks: no — the chosen design still fixes the fresh-evaluation gap, but the defect narrative and the decision's stated basis are wrong, and the TDR will otherwise be challenged for a false premise.
   Suggested remediation target phase: specification
   Suggested fix: Restate §2.1/P-3/DEC-3 as "the recorded battery verdict is consulted but the fresh check-run page is never consulted on the merge path, and the merge-applicable projection is one fresh gate", record the TO-CONFIRM's answer, and have `@decision-advisor` align TDR-0072's context row before the PR review.

5. [major] dod_defined — `chg-GH-366-spec.md` (no DoD section, §1-25)
   Gap: `doc/guides/definition-of-done.md` requires every change to define its own concrete, testable DoD in its spec, traceable to its ACs, and `dod_check` reads "the change's DoD + AC" from that file. The spec has ACs, metrics and a rollout, but no DoD block; "all ACs green and all phases complete" is not written anywhere the DoD gate reads.
   Blocks: yes — `dod_defined` is a hard facet; delivery cannot start without it.
   Suggested remediation target phase: specification
   Suggested fix: Add an explicit "Definition of Done" section: the 22 ACs and 10 NFRs green with named evidence, the three TDRs accepted or amended, the identity totals reconciled on the post-sync base, the changed docs and changeset landed, and the stated scope held / not claimed.

6. [major] cross_artifact_consistency — spec §9 NFR-2 (line 574) vs test plan TC-MRG-034 (lines 1594-1605) vs TDR-0071 C-4/DC-3/DR-1 (lines 153, 324, 334) and `production.ts:2491-2509`
   Gap: NFR-2 budgets "one open-request list read" **and** "one request-detail read" as two separate reads, and TC-MRG-034 asserts them as an exact multiset. TDR-0071 states the opposite as the delivered and intended design: "the list read *is* the detail read ... so no read is added", and the code confirms it (`mergeRequestDetail` performs the bounded list read; the transaction calls that one port). Either the test forces a redundant second provider read (breaking NFR-10 and the decision), or a correct implementation fails an exact-multiset assertion.
   Blocks: no — but the exact-budget case cannot be written to a single truth as it stands.
   Suggested remediation target phase: specification
   Suggested fix: Make NFR-2 say "one bounded open-request list read that also supplies the request detail (one provider read)" and re-point TC-MRG-034 at that multiset; keep the request-detail *fact* requirement without a second read.

7. [major] plan_code_area_coverage / cross_artifact_consistency — plan phase 2 comment (lines 176-184) and scope (lines 244-281); spec AC-F3-6 (line 720), §8.5 (lines 555-561); TDR-0073 TO-CONFIRM (line 225); `tests/behaviour/merge-convergence.test.ts:73`
   Gap: Narrowing the abort removes the credential/request/work-item causes but leaves the landing-gap and head-mismatch causes (`feature-merge-verify-deploy.md`: "A declared landing gap is refused through the delivered `merge.transaction-aborted` row"), and those need an operator act before a re-run converges. AC-F3-6 therefore already fixes the answer: the row must declare `retryable: false` and drop the convergence hint. The plan instead defers it ("Whether the narrowed row keeps `true` ... is decided here") and does not scope `tests/behaviour/merge-convergence.test.ts`, which asserts `expect(errorOf(result)?.retryable).toBe(true)` for that row. Phase 2 would go red at a suite outside its declared scope and outside its gate list.
   Blocks: no — determinable now, and cheap to fix.
   Suggested remediation target phase: specification
   Suggested fix: Pin `merge.transaction-aborted` to `retryable: false` with a remediation true of the residual causes; add `tests/behaviour/merge-convergence.test.ts` to phase 2's scope and gate, and record the documented-row change in the same phase.

8. [major] cross_artifact_consistency — spec F-3 (lines 349-361) and AC-F3-1 (line 715); plan golden table "IDENTICAL (6)" (lines 618-624); test plan TC-MRG-023 (line 1206); the five refusal goldens
   Gap: F-3 requires *every* refusal to carry "the command name (`merge`) and the `<ref>` it was invoked with". No refusal carries either today: the human and scripted summaries are `result=refused; condition=<code>` plus evidence lines (`commands/merge.ts:57,76`; `tests/fixtures/merge/golden/refusal-waiver-human.txt` etc.). Implementing F-3 uniformly therefore moves all five refusal human goldens and all five scripted goldens — not just gate/stale — contradicting the plan's "six byte-identical, untouched" declaration. Conversely, AC-F3-1 only requires "names the command", and TC-MRG-023 asserts the literal `merge` in the summary, which is vacuous because every code starts with `merge.`; no case can detect a missing command token, and the `<ref>` has no AC at all.
   Blocks: no — but the plan's golden arithmetic and the AC's testability rest on an unresolved choice.
   Suggested remediation target phase: specification
   Suggested fix: Decide the rendering contract: either F-3 drops command/ref for refusals and AC-F3-1 is narrowed to the code + named cause, or F-3 stands and the five refusal pairs move. If it stands, assert the command token against a rendering that cannot contain it via the code (e.g. a dedicated `command=merge ref=<ref>` field) and add the `<ref>` to AC-F3-1; then rewrite the plan's golden movement table.

9. [major] spec_completeness — spec F-1 step 2 (line 253); test plan TC-MRG-004 (lines 490-516); TDR-0071 TO-CONFIRM rows (lines 229-230); plan phase 3 (line 296)
   Gap: Two conditions the test asserts have no decided specification. (a) "a value longer than the declared cap": no cap exists in the spec, the test plan, the plan or the contracts (`QUEUE_READY_MAX_BRANCH_CHARS` is unrelated), and TDR-0071 requires a declared constant with the value plan-pinned — the plan does not pin it, so the over-cap cell has no oracle. (b) TC-MRG-004 asserts an *absent* change record and a malformed one both refuse `merge.branch-unresolved`; F-1 only covers a record that declares no branch, and TDR-0071 records the absent-record case as an owner decision (a fourth reason or a third row), not as branch-unresolved.
   Blocks: no — both are small, but they are undecidable as written.
   Suggested remediation target phase: specification
   Suggested fix: Pin the branch-value cap as a named contract constant and state its value; state the absent-record and unreadable-record outcome (identity, exit, named cause) explicitly, or remove those cells from TC-MRG-004. If the absent-record answer differs from `merge.branch-unresolved`, re-trace it to an AC.

10. [major] plan_code_area_coverage — plan phase 6 scope (lines 650-661) vs `packages/core/src/contracts/merge.ts:304-334`
    Gap: API-1/API-2 add resolved branch, resolution source, request identity, resolved head and the required-check count/set size to the merged and dry-run reports. Those report shapes are declared in `packages/core/src/contracts/merge.ts` (`MergeReport`, `MergeDryRunReport`), which phase 6 does not scope (only phase 4 does, for gate-set/admitted-surface data). A phase-6 edit to the type file is out of its declared scope; an edit in phase 4 would put rendering data in the wrong phase.
    Blocks: no — but the declared blast radius cannot produce phase 6's stated outcome.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Add `packages/core/src/contracts/merge.ts` (and `packages/core/src/contracts/index.ts` if the exports move) to phase 6, and register any new exported type/member in both export inventories there.

11. [major] plan_code_area_coverage / test_traceability — test plan TC-MRG-009 (line 659) vs plan phase 3 scope (lines 385-398)
    Gap: TC-MRG-009's second half is DM-1's load-bearing claim — the `branch` value is preserved value-faithfully by *every* document-writing branch (`stagePmNotesPhaseEntry` edits the YAML document in place). The test plan targets "the phase document-write suites over `tests/behaviour/phase-support.ts`" (in practice `phase-completion-convergence.test.ts`, "every document-writing branch writes the fold's completion"). The plan substitutes `phase-write-path-lint.test.ts`, which only asserts that lint blocks malformed writes; no phase's scope contains a suite that writes the document through each branch and re-reads the key. If a branch drops it, every change loses its branch on the next phase transition and merge refuses.
    Blocks: no — but the mitigation for RSK-1 is untested.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Add the phase document-write suite (e.g. `tests/behaviour/phase-completion-convergence.test.ts` and its support fixture) to phase 3's scope, and state that the `branch` key is asserted byte-faithfully after a real `phase complete` write.

12. [major] cross_artifact_consistency — spec §10 (lines 586-589); plan phase 6 golden rationale (lines 599-606); `merge-transaction.ts:912-917,1086-1100`; `success-human.txt`
    Gap: §10 says the *merged* report exposes `gates=<passed>/<total>` "with the merge-applicable total". The delivered merged report renders the *record's* gates (`reportFor(..., record?.gates ?? [])`), which for a battery record is the five built-ins — the current `success-human.txt` literally says `gates=5/5 passed`. The plan's phase-6 rationale nonetheless says the success golden's gate line and per-gate lines are "regenerated ... from the merge-applicable projection", i.e. it assumes a merged-report semantics change that no API, AC or case defines (TC-MRG-011 asserts only the dry-run report; TC-MRG-030 asserts resolution facts).
    Blocks: no — but the golden movement cannot be judged correct without the contract.
    Suggested remediation target phase: specification
    Suggested fix: Decide whether the merged report keeps echoing the verification record's gates or renders the merge-applicable projection; state it in API-1/§10, and add a case asserting the merged report's gate list and total. Then align the success golden rationale.

13. [major] plan_doc_update_coverage — plan phase 7 scope (lines 738-750); spec §16 (line 684) and §19
    Gap: The change creates a mandatory authoring obligation on `chg-<ref>-pm-notes.yaml`, but no phase updates the surfaces that actually create that file: `.opencode/agent/pm.md` (and its generated `.ados-claude/agents/pm.md` mirror) and `.ai/agent/pm-instructions.md` — plus `doc/guides/unified-change-convention-tracker-agnostic-specification.md`, which documents the artifact set. Only `doc/guides/change-lifecycle.md` is scoped. The result is the documented outcome of RSK-1: every new change is born without `branch` and refuses at merge, with no instruction telling the PM to write it.
    Blocks: no — accepted risk, but its mitigation is missing.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Add the PM instruction/prompt surfaces to phase 7 (delegating the prompt edit to `@toolsmith` and regenerating `.ados-claude` via `scripts/build-claude-plugin.sh`), and document the key in the change-convention guide.

### Minor

14. [minor] test_traceability — spec Appendix B row `merge.transaction-aborted` (line 878); test plan TC-MRG-026 (lines 1298-1328)
    Gap: The "Act required" oracle for the abort row is defined in terms of the row's own value ("none for any cause it still reaches — otherwise the row declares `retryable: false`"), and the 22-cell matrix has no cell for the landing-gap or head-mismatch causes. TC-MRG-026 therefore cannot detect the exact overstatement P-5 describes; it can pass while the row still promises convergence for an act-requiring cause.
    Suggested remediation target phase: test_planning
    Suggested fix: Add the residual abort causes as explicit matrix cells (or declared cause data) with their act-required values, independent of the row declarations.

15. [minor] plan_coverage — plan TC allocation index (line 58) vs phase 2 and phase 7 scope
    Gap: TC-MRG-038 is allocated to phase 7, but its target files (`error-table.test.ts`, `error-table-sync.test.ts`, `merge-refusal-rows.test.ts`) are edited in phase 2 and are not in phase 7's scope; phase 7 only re-runs it. The one-case-per-phase rule is unsatisfiable as written (authored in phase 2, owned by phase 7).
    Suggested remediation target phase: delivery_planning
    Suggested fix: Allocate 038 to phase 2 as authored and make phase 7 a declared re-run over the reconciled doc surfaces, or split it into two ids.

16. [minor] cross_artifact_consistency — test plan frontmatter (line 13), §2 (lines 168-174), §1 (lines 33-34), §8.3 OQ-TP-1/OQ-TP-2
    Gap: The test plan still says `links.implementation_plan: null` and "not yet authored", references spec v1.1, repeats the corrected-away claim that "a gate refusal renders as the containment identity", and keeps OQ-TP-1/OQ-TP-2 open although the spec v1.2 correction and the plan's golden table discharge them. It is now inconsistent with both published artifacts.
    Suggested remediation target phase: test_planning
    Suggested fix: Update the frontmatter link, the spec version, the F-4 premise paragraph, and close OQ-TP-1/OQ-TP-2 with pointers to the spec v1.2 correction and plan phase 6.

17. [minor] test_traceability — spec §17.6 owner trace (line 744)
    Gap: The owner item "pending-check refusal and the retained explicit waiver path" is carried by AC-F2-2, AC-F2-3 and AC-F2-7. AC-F2-7 asserts admitted surfaces and built-in immutability, not the waiver path, and no case asserts that a successful `--waive <gate> --waived-by ...` still authorizes where a class binding exists (only unauthorized/missing cases are covered).
    Suggested remediation target phase: test_planning
    Suggested fix: Re-trace the waiver item to the cases that actually assert the explicit waiver path (or add one), and drop AC-F2-7 from that row.

18. [minor] plan_code_area_coverage — plan phase 3/4 folder scopes (lines 399-402, 518-519)
    Gap: Phases 3 and 4 declare the folder `tests/fixtures/merge`, which contains `tests/fixtures/merge/golden` — phase 6's declared folder. A golden edit is therefore in-scope in phases 3/4, so scope enforcement cannot back the escalation trigger "a golden file is regenerated without its per-file entry in phase 6's declared movement table".
    Suggested remediation target phase: delivery_planning
    Suggested fix: Declare the fixture files (`harness.ts`, `production-composition.ts`, `golden-scenarios.ts`) instead of the folder, leaving `golden/` exclusive to phase 6.

19. [minor] plan_coverage — plan phase 3 meta-suite comment (lines 346-359)
    Gap: The plan moves only `merge-production-composition` GREEN → CHANGED, but it also edits the other six GREEN suites (`merge-classification`, `merge-dry-run`, `merge-freshness`, `merge-gate-set`, `merge-privacy`, `merge-verification-record`). The meta-check tolerates that (it pins case-id inventories and banned tokens only), but the plan's "seven green suites stay green unedited" premise and the per-phase obligations understate the blast radius, and nothing tells the coder to keep the GREEN_INVENTORY case ids when rewriting those files.
    Suggested remediation target phase: delivery_planning
    Suggested fix: State that all seven GREEN suites are edited, name the inventory ids each must keep, and move only the one whose obligation markers change.

20. [minor] spec_completeness — spec §7.2 (lines 480-484)
    Gap: §7.2 puts the ticket body's "family-wide battery ... on the installed binary" out of scope, but never states that the merge slice itself is proven in-process only and that no installed-binary end-to-end proof is claimed. The ticket body's AC ("the battery is green on the installed binary") therefore reads as unaddressed rather than explicitly waived for this slice.
    Suggested remediation target phase: specification
    Suggested fix: Add one sentence to §7.2 (and §18's PR-body statement) that the merge slice is proven by in-process suites and no installed-binary conformance run is claimed.

21. [nit] cross_artifact_consistency — `chg-GH-366-pm-notes.yaml` line 10 — *resolved during this review*
    Gap (as reviewed): `clarify_scope.started` (`11:45:00Z`) post-dated its `completed` (`10:47:14.870Z`), and `phase` never rewrites `started` (`packages/cli/src/commands/phase.ts:865`), so the value could not have come from the phase family; hand-edited phase state is forbidden. The PM corrected the value to the fold's `10:47:14.870Z` and recorded why in a note while this review ran (working-tree change, not yet committed). No action remains beyond committing it with the rest of the artifacts.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Commit the corrected value plus its explanatory note; keep the delivery phases on the `phase` family.

22. [nit] system_spec_consistency — spec F-4 (lines 391-393)
    Gap: "Adding `ci-green` to the merge surface adds one more family instance ... `merge.gate.ci-green.failed`" — `ci-green` is already an effective gate id in the shipped default, so that family instance is already in the derived population (`defect-f1` test `effectiveGateIds()`), and the live proof case is not new.
    Suggested remediation target phase: specification
    Suggested fix: Rephrase as "the already-declared family instance over `ci-green` stays the live proof case once `ci-green` is merge-applicable".

## Notes that are not findings

- The ticket-body narrowing is faithfully disclosed: spec §7.2 `[OUT]`, NG-4, DEC-10, the pm-notes scope ruling, and §18's PR-body statement all agree, and the latest owner comment's four acceptance items and three regressions are traced in §17.6. This review does not reopen the owner's narrowing.
- The commit-primitive tracker-token hazard is handled: all seven phase titles/summaries carry only `GH-366` (checked with the `\b[A-Z][A-Z0-9]*-\d+\b` matcher); no `TC-MRG-*` or `TDR-*` token reaches a title or summary.
- The meta-suite facts in the plan check out against the tree: closed population 16, CHANGED/GREEN 9/7 (and unchanged on `origin/main-tools`), `NEW_SUITES` 5, golden set 13 with a 13 → 19 / 11 → 17 arithmetic that is internally consistent.
- The decision records are in the correct home for R3/precedent decisions, are `Proposed`, carry one index row each, and claim no challenge or acceptance. The `decision_capture` facet passes; the false premise in finding 4 is routed to the specification, not to record placement.
