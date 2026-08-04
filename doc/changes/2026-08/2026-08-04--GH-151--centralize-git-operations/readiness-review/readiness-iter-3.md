# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-151
Date: 2026-08-04
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS (with one persistent minor carried from iter-1, now mitigated by the plan-side OQ-T1 resolution)
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Prior-iteration findings — resolution status

- **iter-1 Finding 1 (major, test_traceability — TC-GIT-012 commit-step grep): RESOLVED.**
  Test-plan TC-GIT-012 step 1 (lines 457–458) and §7 line 618 use the scoped 6-agent, imperative-pattern grep; allowlist step present. Confirmed live: against the current (pre-delivery) repo, the scoped grep returns only the imperative commit-step lines Phase 1 will remove (spec-writer `Stage ONLY this file` / `Commit with: docs(change-spec)…`; test-plan-writer/plan-writer `Stage ONLY this file`; decision-advisor `stage ONLY the decision record … create a single commit`). Post-Phase-1 the gate is achievable. Sound.

- **iter-1 Finding 2 (minor, decision_capture — pm-notes entries 2 & 3): RESOLVED** (confirmed in iter-2).

- **iter-1 Finding 3 / iter-2 Finding 2 (minor, system_spec_consistency — OQ-T1 `no commit` mechanism): RESOLVED on the plan side.**
  Plan §"Resolved open questions" (line 39) resolves OQ-T1 in favor of reusing the existing bare-string `"no commit"` directive (no new `directives.no_commit` field); Phase 2 task 2.3 (line 152) and Phase 3 task 3.6 (line 194) implement the bare-string check consistently. No parallel-mechanism drift. (Residual staleness on the test-plan side — see Finding 2 below — is non-blocking.)

- **iter-1 Finding 4 / iter-2 Finding 3 (nit, test-plan frontmatter typo): RESOLVED.**
  Test-plan line 4 now reads `github.com/juliusz-cwiakalski/…` (verified — no stray leading `c`).

- **iter-2 Finding 1 (major, plan_coverage / cross_artifact_consistency — plan Phase 6.1 commit-step grep): RESOLVED.**
  Plan Phase 6.1 first sub-bullet (line 295) now mirrors the refined TC-GIT-012 step 1 verbatim — scoped to the six delegated agents, imperative commit-step patterns, allowlist sub-step, and an explicit warning not to broad-grep `.opencode/agent/`. Plan Test Scenarios row for TC-GIT-012 (line 407) is also aligned. Plan ↔ test plan are now consistent on the **commit-step** half of the gate.

## AC coverage map
Unchanged from iter-1; all 13 ticket ACs remain covered (AC #2/#3/#4 in strengthened "pure writer" form). AC #11 → AC-F4-1 / NFR-1 / NFR-2 / TC-GIT-012 / Phase 6 remains the path of interest. The commit-step half is sound; the **branch-checkout** half is not (see Finding 1).

## Findings

1. [major] test_traceability / cross_artifact_consistency — chg-GH-151-test-plan.md §5.2 TC-GIT-012 step 3 (line 459) and §7 line 618 (branch-checkout grep); mirrored in chg-GH-151-plan.md §Phase 6.1 second sub-bullet (line 296) and §Phase 6.2 (line 298)
   Gap: The branch-checkout half of the universal gate is not verifiable as specified. TC-GIT-012 step 3 / plan 6.1 sub-bullet 2 / plan 6.2 grep the **whole** `reviewer.md` for `git checkout|git branch` and assert zero matches, but `reviewer.md` legitimately contains two **remote-mode** (`modes="remote"`) checkout instructions that must be retained:
   - line 161: `git checkout --detach <head_sha>` — PR/MR head checkout for full source access during remote review
   - line 304 (step 12, `modes="remote"`): `git checkout <original_branch>` — restore the original branch after remote review

   These are out of scope for GH-151: spec **AC-F3-3** scopes the reviewer change to *local mode* ("the reviewer agent in local mode … it performs no direct commit"), spec **F-3** lists reviewer as "`@reviewer` (local mode)", and plan **task 1.5** says "in local mode, remove the direct commit and 'stage the plan file' logic." Remote-mode PR/MR review is a separate operational mode and is not touched by Phase 1. Verified live: `rg "git checkout|git branch" .opencode/agent/{spec-writer,test-plan-writer,plan-writer,doc-syncer,reviewer,decision-advisor}.md` returns exactly these two reviewer.md matches and nothing else — so post-Phase-1 the gate would still emit them.

   The iter-1/iter-2 allowlist does **not** cover this case: it is scoped to *commit-step prohibition text* for step 1 ("verify they are prohibition text only … not actionable instructions") and is silent on actionable *branch-checkout* instructions in step 3. Predicted delivery failure mode (same class as iter-1's, relocated to the branch-checkout sub-grep): `@coder` running Phase 6.1/6.2 either (a) marks AC-F4-1 / NFR-2 FAIL incorrectly on the two retained remote-mode lines, or (b) "fixes" the gate by deleting the remote-mode checkout logic via `@toolsmith`, breaking remote PR/MR review (`/review-remote`).
   Suggested remediation target phase: test_planning
   Suggested fix: Scope TC-GIT-012 step 3 (and plan 6.1 second sub-bullet / task 6.2) consistently with AC-F3-3's local-mode scope. Concretely, either: (i) exclude `reviewer.md` from the universal branch-checkout grep and instead verify reviewer's *local-mode* section separately (e.g., grep with a section/mode anchor, or rely on TC-GIT-005 which already greps reviewer.md for `stage.*plan file|git add` — local-mode-only staging — and is sound); or (ii) add an explicit allowlist entry for the two known remote-mode checkout lines in reviewer.md (lines 161 and 304) analogous to the iter-1 prohibition-text allowlist. Propagate the same fix to plan 6.1 sub-bullet 2 and task 6.2, and to the §7 automation-mapping row for TC-GIT-012. Optionally tighten spec NFR-2 ("0 delegated agent prompts contain branch-checkout … instructions") to scope to *local mode* for reviewer, mirroring AC-F3-3, so the spec no longer over-claims against the retained remote-mode checkout.

2. [minor] cross_artifact_consistency / decision_capture — chg-GH-151-test-plan.md §8.2 assumption (line 649) and §8.3 OQ-T1 (line 655)
   Gap: The test plan still asserts the superseded pre-resolution wording. §8.2 assumption: "The `no commit` directive is passed as a frontmatter flag or environment variable (exact mechanism delegated to plan-writer)". §8.3 OQ-T1: status "Pending plan definition", owner "plan-writer". Both contradict the plan's resolution (line 39: bare-string `"no commit"` directive, no new field). The plan side is authoritative and consistent; the test-plan side is stale.
   Suggested remediation target phase: test_planning
   Suggested fix: Update §8.2 assumption and §8.3 OQ-T1 to reflect the resolved bare-string mechanism (or mark OQ-T1 "Resolved by plan §OQ-T1 — reuse existing bare-string directive"). Non-blocking because @coder executes the plan, not the test plan's open-questions table.

3. [minor] test_traceability — chg-GH-151-test-plan.md §8.3 OQ-T3 (line 657); interacts with chg-GH-151-plan.md §Phase 6.4 (line 300)
   Gap: OQ-T3 is marked "Resolved: TC-GIT-012 covers this via grep (these agents should have no direct commits before and after)" for verifying @coder / @meeting-organizer / @pr-manager remain unchanged (NG-3). The refinement in iter-1 correctly narrowed TC-GIT-012 to the **six delegated agents only** (specifically excluding @coder, which has a legitimate per-sub-phase `@committer` trigger — the "delivery exception"). TC-GIT-012 therefore no longer covers those three already-correct agents. The plan has Phase 6 task 6.4 ("Confirm already-correct agents untouched") for this, but task 6.4 is not traced to any TC — a small traceability gap.
   Suggested remediation target phase: test_planning
   Suggested fix: Either (i) reclassify OQ-T3 as "Resolved by plan task 6.4 (manual confirmation), not by TC-GIT-012" and add a TC pointer to plan task 6.4, or (ii) add a lightweight regression TC (e.g., grep @coder/@meeting-organizer/@pr-manager for new direct `git commit` steps relative to baseline) and trace 6.4 to it. Non-blocking.

## Gate result
NOT_READY — one major finding (Finding 1) blocks clean delivery: the iter-2 commit-step fix correctly propagated to the plan, but the **branch-checkout** half of the same universal gate (TC-GIT-012 step 3 / plan 6.1 sub-bullet 2 / plan task 6.2) still over-greps `reviewer.md` and will false-positive on the two retained **remote-mode** checkout instructions (lines 161 and 304, `modes="remote"`). The current allowlist covers commit-step prohibition text only and does not rescue this case, so `@coder` would either false-fail AC-F4-1 / NFR-2 or destructively remove the remote-mode checkout logic (breaking `/review-remote`). This is the same class of defect iter-1 caught, now in the sibling sub-grep that iter-2 explicitly called "already correct" — it was not.

Reopen **test_planning** to scope TC-GIT-012 step 3 to reviewer's local-mode section (or allowlist the two remote-mode checkout lines) and propagate the fix to plan 6.1 sub-bullet 2 and task 6.2; findings 2 and 3 (stale OQ-T1 / OQ-T3 in the test plan) can be resolved in the same pass.

This is iteration 3 of ~3. Note: this is **not** a stalemate — the blocking gap is new (a different sub-grep than iter-1/iter-2's commit-step grep), so one further remediation pass is warranted. If, after iter-4, the same branch-checkout gap persists, escalate to the human rather than looping again.
