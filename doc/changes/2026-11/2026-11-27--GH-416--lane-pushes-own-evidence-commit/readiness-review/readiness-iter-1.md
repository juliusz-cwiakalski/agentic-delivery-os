# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-416
Date: 2026-11-27
Pause Required: no

Artifact set reviewed in full: spec v1.2, test plan v1.3 (31 TCs), plan v1.2 (8 phases, tier full), pm-notes, ticket #416 body plus its single owner comment (`issuecomment-7205540856`, `author_association: OWNER`, unedited), and the delivered code the artifacts restate. `plan validate GH-416` was re-run read-only: `valid`, `readyForDevelopment: true`. No prior readiness record exists for this change.

Facet convention: a facet is FAIL when a blocking finding lands on it. A PASS facet may carry advisory findings; they are listed in Facet Basis and in Advisory Findings, and none of them gates this verdict.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

Counts: 5 blocking (1 critical, 4 major); 7 advisory (3 major, 3 minor, 1 nit bundle).

## Facet Basis (verified against the ticket and code, not the artifacts' framing)

- **Ticket traceability (check 1): complete.** Each ticket item resolves to a spec AC and at least one TC. Behaviour 1 and AC-1 -> AC-F1-1 -> TC-LPUSH-001. Behaviour 2 and AC-2 -> AC-F2-1 -> TC-LPUSH-002/003/004. Behaviour 3 and AC-3 -> AC-F4-1 + AC-F3-1 -> TC-LMSG-001, TC-LFOLD-001, TC-LCAUSE-001/002. Behaviour 4 -> AC-F5-1 -> TC-LSTATUS-001..003. Nothing in the ticket is unmapped.
- **Requirement 4's reading is disclosed honestly, but not owner-confirmed (advisory 8).** Spec section 14 states the answer is a recorded snapshot and why (the operator posture: `feature-dispatch-engine.md:609`). `DispatchStatusData` carries no head of any kind, so `lanePush` is the only head on the surface; the answer cannot say whether the *current* branch head is on the remote. Disclosed in F-5, RSK-2 and section 7.3. Not surfaced to the owner anywhere.
- **CB-1 is disclosed, not papered over.** The final message is unobservable; TC-LMSG-001/002 pin the two product surfaces and section 8.3 says so plainly. Accepted. Two further unobservable assertions exist and are not declared (findings 1, 2, 3).
- **Plan order and committability: sound.** Contracts -> seam -> command -> fold -> status -> surfaces -> decision record -> finalize. The command precedes its readers with a stated reason. Phase 1 is green with no writer; phase 2 is seam-only; phase 7 stages an artifact only. The changeset is in phase 1, before any gate.
- **The TDR-0076 amendment has an id path.** `TDR-0079` is the next free id (TDR-0078 is the highest on this branch). Amending without editing TDR-0076 follows TDR-0078 -> TDR-0050 (`links.decisions`, a footer, `supersedes`/`superseded_by` empty). `Proposed` with a null date is precedent.
- **Earlier defects, reconciled by reading operative text (check 4):**
  - Reserved-reference count: **closed.** `packages/core/src/app/dispatch.ts:1111-1115` holds five members; spec F-3, DM-2, NFR-5, section 4.1, Appendices A and C and the test plan all read five plus at most two. The only remaining "three delivered" text is the document-history row.
  - Protected-ref literal: **closed.** `packages/adapters/src/git/push.ts:147` emits `protected-ref`; spec DM-4, DEC-4, F-4, glossary and Appendix E match; TC-LCAUSE-002 step 5 forbids an alias.
  - RSK-9: **closed as an honest residual.** Spec v1.2 no longer claims a refusal that no rule produces; the owner follow-up is a pm-notes `question` note with ticket creation left to the owner. One stale tag remains (advisory 7).
  - I-1, I-3, I-5: **closed.** `<step id="10">` is at `.opencode/agent/pm.md:403`. All 17 `PINNING_FILES` members and every test file carrying the literal 28 are inside phase 3 scope; the 10 out-of-scope files that reference `PROMPT_REQUIRED_COMMANDS` iterate the set and do not pin a count. The help inventory is `packages/cli/src/help.ts`; `entrypoint.ts` needs no edit.
  - The two refusal arms (OQ-2) and I-2: **claimed closed, still open.** Finding 1 and finding 2.
  - I-4: **open and unrecorded.** Finding 5.
- **Residual honesty (check 5):** RSK-9's M residual, CB-1 and RSK-5 are each declared and carried to a phase 8 page. One residual of the same family is not declared (advisory 6).
- **DoD:** the plan carries per-phase exit criteria and a phase 8 dod_check list; AGENTS.md defines dod_check as all ACs met plus every plan phase complete. Operational. Consolidation advised (advisory 9).
- **Override:** not available. The change alters behaviour and touches contracts.

## Blocking Findings

1. [critical] cross_artifact_consistency — spec F-1 "Two refusal arms, one question each" (chg-GH-416-spec.md:143); plan phase 3 steps 2 and 5 and its conditional (chg-GH-416-plan.yaml:531-543, 552-556, 661-666); test plan TC-LCAUSE-001 preconditions and steps 3 and 5 (chg-GH-416-test-plan.md:698-702, 708, 710) against TC-LRES-004 step 6 (:473)
   Gap: Three artifacts tell three incompatible stories about the seam's two guards, and the safety-critical refusal matrix of ticket AC-3 cannot be built as written.
   - The plan says the command's resolution "reuse[s] the seam's own guard predicates ... no copy of either", and TC-LRES-004 step 6 says "the command never reaches it". Under both, a seam guard rejection is unreachable from the command.
   - TC-LCAUSE-001's preconditions demand the opposite: guard-produced instances that are "a seam-side rejection rather than a resolution refusal", and steps 3 and 5 demand they yield, on the command path, "a `dispatch.lane-push` record appended" with verdict `failed`. That needs a name that passes the command's resolution and fails the seam's guard, which is impossible when the predicates are shared. The contradiction is inside the test plan as well as across artifacts.
   - The plan's reuse is not implementable as placed. Resolution lives in `packages/core/src/app/dispatch-lane-push.ts` (plan :583-585). `.dependency-cruiser.cjs:19` forbids core -> adapters. `isSafeRef` is module-private at `packages/adapters/src/git/push.ts:78`, and core has no equivalent predicate. Only `PROTECTED_REF_NAMES` is reachable from core (`packages/core/src/contracts/closeout.ts:146`). The plan's conditional ("exported ... from adapters") does not cross the package boundary; the two real resolutions (a predicate moved into core contracts, or a guard port injected by `production.ts`) each need an undeclared file or an undeclared port.
   Suggested remediation target phase: specification (primary), test_planning, delivery_planning
   Suggested fix: Choose one story and write it in all three artifacts. Recommended, since it keeps "no copy": the command's resolution and the seam share one predicate, hosted in core contracts beside `PROTECTED_REF_NAMES` and imported by the seam. Declare that contracts file in scope and drop the adapters-export conditional. Then state that a seam guard rejection is reachable from the command by construction never, and by a direct seam call (the engine's) only, which writes no lane-push record. Re-scope TC-LCAUSE-001: the guard-produced instances are seam-level arms (outcome, detail, zero children); the record-and-answer assertions of steps 3 and 5 apply to the six child-act instances only; `unsafe-branch` is declared parity vocabulary with no reachable record producer. Align spec F-1's "a name resolution did not catch" and Appendix E with that.

2. [major] cross_artifact_consistency — spec DEC-4 consequence (chg-GH-416-spec.md:392) and section 22 (:462); test plan TC-LCAUSE-001 step 6 (chg-GH-416-test-plan.md:711) against spec NG-3 (:114) and plan phase 2 (chg-GH-416-plan.yaml:462-465)
   Gap: DEC-4 says "both producers (the engine's ensure-push and the lane's command) name a cause", section 22 says the seam "names a cause on both of its consumers", and step 6 says "Assert both consumers name a cause: ... the engine's ensure-push", in the same breath as "the engine ignores the cause". Code truth: the engine's parity port branches on `act.outcome !== "accepted"` and returns `{verdict: failed, parity: false}` (`packages/cli/src/production.ts:4275-4281`). `detail` is discarded, nothing observable carries a cause, and NG-3 forbids adding one to the envelope. The step is unassertable, and a coder trying to satisfy it would violate NG-3. The plan's phase 2 states the truth ("ignores `detail`"), so spec and plan disagree. No phase owns step 6's engine half.
   Suggested remediation target phase: test_planning (primary), specification
   Suggested fix: Reword step 6 to what is observable: the seam's return carries a closed cause at both call sites (asserted at the seam), and the engine's parity reading carries no cause member (NG-3). Reword DEC-4's consequence and section 22 to "the seam names a cause for both of its callers; the engine discards it".

3. [major] test_traceability — test plan TC-LPUSH-001 precondition 3 and step 3 (chg-GH-416-test-plan.md:260, 266); section 8.3's "one accepted coverage boundary" (:1213-1219); spec AC-F1-1 (chg-GH-416-spec.md:419)
   Gap: The ticket names the no-wrapper fixture as the gate for AC-1 ("the pull request's head equals the branch head when the session ends"). TC-LPUSH-001's precondition already sets "the transport's accepted head equals the ledger's current branch head", and step 3 then asserts that equality. The assertion restates a fixture input. The injected transport is a child-runner double; the argv it receives is the literal `HEAD:refs/heads/<branch>` (`push.ts:152`), so it has no head to "accept" and cannot observe what git pushed. The equality of PR head and branch head follows from git's fast-forward rule and pr-manager's pre-PR push; it is not observed by this fixture. The test plan declares exactly one coverage boundary and this is a second, undeclared one. Left as is, the gate evidence for the ticket's first AC would overclaim.
   Suggested remediation target phase: test_planning
   Suggested fix: Either declare CB-2 and reword step 3 to the observable facts (exactly one act; the argv; the record's `head` equals the head the fixture's branch read reported; the ledger is unchanged after the act), stating that the PR-head equality is an inference; or make this one fixture observational with a real local bare remote, which the repository already does in its checks (`tests/checks/fixture-repo.ts` and others). Phrase AC-F1-1's "then" in the same terms.

4. [major] plan_code_area_coverage — plan phase 5 golden comment and scope (chg-GH-416-plan.yaml:959-962, 971-972, 998-1013); test plan section 7, TC-LSTATUS-002 row (chg-GH-416-test-plan.md:1103)
   Gap: Phase 5 requires "ONE additive-lines cell ... created by the explicit regeneration path only", but its `scope` has no `folders:` entry and lists only `tests/golden/dispatch-text.test.ts`. The commit primitive stages untracked files only inside the declared scope (`packages/core/src/domain/commit-staging.ts:4-8`) and reports the rest as `untrackedNotStaged` (`commit-act.ts:94`); it blocks only when nothing else is staged (`:255-261`). So the new golden data file would be left out of a commit that otherwise succeeds: green locally, red on a fresh checkout. The comment's conditional names a folder the YAML does not declare. Separately, the delivered status-golden precedent is `tests/golden/dispatch-status-worktree.test.ts`, which reads `tests/golden/status-*.txt` and builds the status object inline; `dispatch-text.test.ts` holds only `dispatch <ref>` cells. The natural host suite is outside phase 5's scope. Same discipline gap, smaller: phase 1's conditional `packages/core/src/contracts/push.ts` would need `tests/structure/inventory.json`, which only phase 3 declares.
   Suggested remediation target phase: delivery_planning (primary), test_planning
   Suggested fix: Add `tests/golden` as a declared folder (or the exact new data file) and the host suite to phase 5's scope, and name the host suite in the TC-LSTATUS-002 row. Add `tests/structure/inventory.json` to phase 1's conditional list.

5. [major] decision_capture — plan findings I-4 (chg-GH-416-plan.yaml:223-229, 652-655, 715) and phase 8's AGENTS.md note (:1240-1242) against pm-notes (chg-GH-416-pm-notes.yaml:165-180, no I-4 entry) and test plan TC-LDOC-001 step 5 (chg-GH-416-test-plan.md:965)
   Gap: Two decisions are routed to the PM by the plan and neither ruling is recorded.
   - I-4: `doc/planning/oss-tooling/milestones/m1/commands/provider.md:31` says the family is "the twenty-eighth and last", and `tests/checks/doc-conformance.test.ts:1620` requires that phrase. The plan recommends correcting the page and its row in phase 3 and lists the file in scope. TC-LDOC-001 step 5 still asserts "the M1/M2 page sets stay byte-unchanged". Under the plan's own recommendation that step is red by design; under the alternative a false current-truth statement ships. The pm-notes record rulings for I-1, I-2, I-3, I-5, I-6 and I-9 and are silent on I-4.
   - AGENTS.md: its delivery-process table says `pr_creation` is "Create PR, record its URL as a pm-notes `notes:` entry, STOP". Phase 8 names the row "for the PM's decision and is not in scope". No decision is recorded, so the repository's entry document would describe the old tail after delivery.
   Suggested remediation target phase: delivery_planning (primary), test_planning; PM to record both rulings in pm-notes
   Suggested fix: Record the I-4 ruling and the AGENTS.md ruling as pm-notes decisions. If I-4 is "correct the tail" (recommended), amend TC-LDOC-001 step 5 to exempt that page's ordinal statement and its phrase row, and make the plan's conditional unconditional. For AGENTS.md, either declare the row's edit with an owner or record the deliberate exclusion with its follow-up.

## Advisory Findings (non-blocking; none gates READY)

6. [major] spec_completeness — spec F-1 (:142-143), F-5 (:174-176), section 11 (:338-348), against section 2.2 (:81) and ticket behaviours 3 and 4
   Gap: A pre-act resolution refusal (arm (a)) appends no record, by design. So when the lane's push is refused before the act with no wrapper alive, nothing durable exists: `dispatch status` shows no fact, the attempt record carries nothing, and the only report is the final message, which CB-1 declares unobservable. Absence of `lanePush` therefore covers "never ran", "refused before the act" and "record did not land" without distinguishing them. Section 2.2 names this exact condition as the pain ("nothing durable records that the lane tried to push, so a refusal is invisible") and section 11 declares no risk for it. RSK-5 is the same residual class for a different trigger and is declared.
   Suggested remediation target phase: specification
   Suggested fix: Declaration only, no behaviour change: add a risk row for the arm-(a) residual with its backstops (the merge bar and the engine's ensure-push), and state in F-5 and section 22 that an absent fact includes a pre-act refusal. Carry the sentence to the operations guide via TC-LDOC-002.

7. [major] system_spec_consistency — spec F-3 "No classification growth" (chg-GH-416-spec.md:162); NFR-7 (:325); Appendix A (:489); test plan TC-LRES-003 related ids (:427)
   Gap: F-3 justifies DEC-5 with "the engine's own ensure-push evaluates the same branch". The engine resolves the branch by a different rule: `readChangeBranch` takes `branches[0]` with no declaration cross-check and no ambiguity handling (`packages/cli/src/production.ts:3946-3953`). When the declaration disagrees with the convention read, or the read is ambiguous, the lane refuses and the engine pushes the first match. That is delivered behaviour the change correctly leaves alone (NG-4), but the spec's premise is false in those cases and the residual is undeclared. The plan's escalation trigger calls a guessed or ambiguous push "the worst outcome of the change"; it remains reachable through the engine. Also, TC-LRES-003 still tags RSK-9, a leftover from v1.1; no TC covers RSK-9's residual.
   Suggested remediation target phase: specification (primary), test_planning
   Suggested fix: Scope the "same branch" claim to a unique convention match that agrees with the declaration, declare the engine's first-match residual, and consider adding it to the owner's follow-up proposal. Drop the stale RSK-9 tag from TC-LRES-003.

8. [major] decision_capture — spec section 14 first reading (chg-GH-416-spec.md:380), DEC-3 (:391); pm-notes intake decision 2 (chg-GH-416-pm-notes.yaml:22-28)
   Gap: Requirement 4 is delivered under a reading that weakens the ticket's words, and the owner has not seen it. Intake recorded "requirements are complete and consistent with the system spec and need no owner question", which holds only under the reading. The reading is the only one compatible with the standing no-network posture, so it does not need a pause, but it should reach the owner with a default rather than at PR review by implication. The checkout-rule follow-up already uses the right mechanism.
   Suggested remediation target phase: change docs (pm-notes); no artifact phase reopens for this
   Suggested fix: Add a pm-notes `question` note stating the adopted reading, its default if unanswered, and that AC-F5-1 verifies a recorded snapshot and not the ticket's literal wording. Ensure the PR description carries it.

9. [minor] dod_defined — spec section 17 and 18 (chg-GH-416-spec.md:415-437)
   Gap: No consolidated Definition of Done. The predicates exist across section 18, the plan's per-phase exit criteria and phase 8. GH-394 passed this facet only after a section 17.1 was added. AC-F4-1's final-message clause cannot be verified at dod_check, and how it is judged lives only in test plan CB-1.
   Suggested remediation target phase: specification
   Suggested fix: Add a short section 17.1: 7/7 ACs via their mapped TCs; AC-F4-1's message clause judged by TC-LMSG-001/002 plus the post-merge observation; `pnpm check` and the commit-range gate green with evidence; the decision record present as `Proposed` with its index row; every phase 8 page reconciled; PR open against `main-tools`; merge authority human-only.

10. [minor] spec_completeness — spec F-4 and DEC-6 (chg-GH-416-spec.md:168, 394); plan phase 6 (:1054-1059); `.opencode/agent/pm.md:125, 129, 408`
    Gap: The element phase 6 edits carries a delivered `"no commit"` directive whose stated meaning is that "durable remote persistence is intentionally waived". The spec's tail does not say whether `push <ref>` runs under that directive. As written the push is added unconditionally after the `phase complete` line.
    Suggested remediation target phase: specification (primary), test_planning
    Suggested fix: One sentence in DEC-6 stating whether the push follows the directive (recommended: it is skipped when the invocation carries it), and a matching step in TC-LMSG-002.

11. [minor] cross_artifact_consistency — spec RSK-9 (:348), F-3 (:159), Appendix B (:502); plan phase 3 step 2 (:531-536) and NFR-2 (:320)
    Gap: RSK-9 says a fast-forwarding wrong checkout is "recorded as `pushed` with its head named", meaning the checkout's HEAD. The only declared head source is the branch read (`listBranches`, "carrying each matching branch's name and head"), while git pushes the checkout's HEAD. The two are equal in the lane's worktree and differ in exactly RSK-9's case, where the record would then name a head that was not the one pushed. Either the source is the branch head and RSK-9's sentence is wrong, or a HEAD read is required and NFR-2 and TC-LBND-002 undercount (neither counts the change-record read either).
    Suggested remediation target phase: specification (primary), test_planning
    Suggested fix: State the record's head source explicitly. If it is the checkout's HEAD, add that read to NFR-2 and TC-LBND-002 step 1; if it is the branch head, reword RSK-9 and Appendix B.

12. [nit] bundled wording, no reopens required on its own
    - Spec section 2.1 (:67) says the delivered evidence commits are "exactly two". `pm.md:406` lands the URL note "using `commit` if the note is landed separately", and the completion commit's scope is the plan scope plus the change folder, so the count is one or two. The ticket observed one. The mechanism is robust either way; TC-LPUSH-001's ledger precondition bakes in two.
    - Plan phase 8 exit criteria (:1262-1270) are labelled "verified at dod_check" but include the pull request, which lifecycle phase 11 creates after dod_check. Same shape as the GH-413 precedent.
    - Spec Flow 5 (:218-223) says "completed phases skipped" and then "pr_creation runs again"; both hold only for a resume that interrupts inside `pr_creation`.
    - pm-notes (:126) says "31 TCs across 13 families" and lists 12.

## Decision Routing

- Finding 1: `change`. The shared-predicate story is a change-level design decision; record it in F-1 and the plan. No human input needed.
- Finding 5: `change`, PM rulings. Both are change-level and need no human input; the AGENTS.md row may warrant an owner view if the PM prefers not to decide the entry document alone.
- Advisory 6 and advisory 7: `change` disclosures. If the PM wants the engine's first-match resolution aligned with the command's rule, that is a separate ticket under the owner's tracker policy, not scope for this change.
- Advisory 8: `change` with a default. Not `needs_human_input`: the standing operator posture leaves one compatible reading, and the decision record plus the PR give the owner the acceptance point. Pause Required stays no.
- No `system` decision is missing. DEC-7's companion record is declared with an id path (TDR-0079) and a collision rule.

## Gate Result

NOT_READY. Delivery is blocked. The override is not available.

Next remediation targets, in dependency order:
1. `specification`: finding 1 (F-1, Appendix E), finding 2 (DEC-4, section 22), advisory 6, 7, 10, 11, and the section 17.1 of advisory 9.
2. `test_planning`, after the spec settles finding 1: TC-LCAUSE-001 (preconditions, steps 3, 5, 6), TC-LRES-004 step 6, TC-LPUSH-001 (finding 3, with CB-2 or a real-remote fixture), the TC-LSTATUS-002 host suite (finding 4), and TC-LDOC-001 step 5 once I-4 is ruled (finding 5).
3. `delivery_planning`: the predicate's declared home (finding 1), phase 5's golden scope and host (finding 4), phase 1's conditional inventory file, and the I-4 and AGENTS.md conditionals per the PM's rulings (finding 5).

Re-run this gate after the three artifacts are revised. One earlier defect (OQ-2, the two refusal arms) is persistent into this iteration: it was recorded as closed by spec v1.1 and test plan v1.1/v1.3 and is not.
