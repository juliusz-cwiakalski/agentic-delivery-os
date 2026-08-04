# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-151
Date: 2026-08-04
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS (with one persistent minor carried from iter-1)
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iter-1 blocking finding — resolution status
- **Finding 1 (iter-1, major, test_traceability): RESOLVED in the test-plan artifact.**
  `chg-GH-151-test-plan.md` TC-GIT-012 (§5.2, lines 442–466) and its automation mapping (§7, line 618) are now verifiable:
  (a) the broken `--invert-match` was removed;
  (b) the gate is scoped to the 6 delegated agents (spec-writer, test-plan-writer, plan-writer, doc-syncer, reviewer, decision-advisor) rather than the whole inventory, which sidesteps the false-positive on prohibition text in `pm.md` / `review-feedback-applier.md`;
  (c) imperative commit-step patterns are matched (`Commit with:|git commit -F|create a single commit|Stage ONLY|\.add\(|\.commit\(|git add|git commit`);
  (d) an explicit allowlist step (step 5) classifies any residual match as prohibition-only.
  The test-plan half of the gate is now achievable.

- **Finding 2 (iter-1, minor, decision_capture): RESOLVED.** `chg-GH-151-pm-notes.yaml` entries 2 and 3 (lines 19, 21) now use the refined wording ("PM/command triggers @committer once"; "ALL delegated agents are pure writers … orchestrator always owns commit trigger"), consistent with spec DEC-3. A RETRO entry (lines 29–31) captures the iter-1 lesson. No contradiction remains.

- **Finding 3 (iter-1, minor, system_spec_consistency): PERSISTS (non-blocking).** See Finding 3 below.
- **Finding 4 (iter-1, nit, test-plan frontmatter): PERSISTS (non-blocking).** See Finding 4 below.

## AC coverage map
Unchanged from iter-1; all 13 ticket ACs remain covered (AC #2/#3/#4 in strengthened "pure writer" form). AC #11 → AC-F4-1 / TC-GIT-012 / Phase 6.1 remains the path of interest; the test-plan side is now sound, but the plan side is not (see Finding 1).

## Findings

1. [major] cross_artifact_consistency / plan_coverage — chg-GH-151-plan.md §Phase 6.1, task 6.1 (line 296); also referenced from §Phase 7.2 (line 332) and §Phase 7 Tests (line 350)
   Gap: The remediation refined the **test plan's** TC-GIT-012 but did **not** propagate the fix to the **plan**, which is the artifact `@coder` actually executes. Phase 6.1 still reads: *"Run the universal direct-commit gate (TC-GIT-012): `rg "git commit" .opencode/agent/` excluding `committer.md` → 0 matches; `rg "git commit" .opencode/command/` → 0 matches."* This is the exact broken gate iter-1 flagged:
   - Verified live against the current repo: `rg "git commit" .opencode/agent/ --glob '!committer.md'` returns **two legitimate prohibition-text matches** — `review-feedback-applier.md:32` ("Hard rule: No git commit or push made by this agent.") and `pm.md:33` ("…never use `@runner` for git commit operations…"). Both must be retained: `pm.md`'s line is the prohibition the refinement preserves, and `review-feedback-applier` is explicitly out of scope (NG-3, already correct). The specified "→ 0 matches" is therefore unachievable.
   - Cross-artifact contradiction: Phase 6.1 claims to run "TC-GIT-012" but specifies a command that contradicts the **refined** TC-GIT-012 (which scopes to 6 delegated agents, matches imperative patterns, and allowlists prohibition text). The plan and the test plan now disagree on how to verify the single most important AC of this change (AC-F4-1 / NFR-1 / ticket AC #11).
   - Predicted delivery failure mode: `@coder` executing Phase 6.1 hits a false-fail and either marks AC-F4-1 FAIL incorrectly, silently reinterprets the gate, or deletes legitimate prohibition text to satisfy the grep — the precise outcome iter-1 warned against, now relocated into the plan.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Rewrite plan task 6.1 to mirror the refined TC-GIT-012 verbatim — scope the grep to the six delegated agents, match imperative commit-step patterns (not the bare token), and include the prohibition-text allowlist step. Concretely, replace the broad grep with the two scoped greps already specified in TC-GIT-012 steps 1 and 3 (and duplicated correctly in test-plan §7 line 618). Note that sibling task 6.2 (`rg "git checkout|git branch"` scoped to the 6 agents) is already correct and can serve as the model.

2. [minor] system_spec_consistency — chg-GH-151-plan.md §"Open questions" OQ-T1 (line 41) and §Phase 2 task 2.3 (line 154); persistent from iter-1 Finding 3
   Gap: The plan still recommends introducing a *new structured* `no commit` mechanism (`directives.no_commit: true` frontmatter field in `pm-context.yaml`) while the directive already exists in the system as a bare *string* directive `"no commit"` consumed today by `doc-syncer.md` (lines 23, 77) and `/sync-docs` (lines 41, 117, 126) — re-verified live. Two parallel mechanisms risk drift unless deliberately reconciled; spec §8.3 (DM) does not treat this as a contract change.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Resolve OQ-T1 in favor of reusing the existing string directive `"no commit"` across the new PM/command triggers (single mechanism), OR — if the structured field is genuinely desired — flag it as an intentional contract change and reflect it consistently in spec §8.3 (DM), `doc-syncer.md`, `/sync-docs`, `pm.md`, and the manual commands. Either way, record the resolution in OQ-T1 before delivery starts.

3. [nit] test-plan frontmatter — chg-GH-151-test-plan.md line 4 `source:` URL; persistent from iter-1 Finding 4
   Gap: The owner segment still reads `github.com/cjuliusz-cwiakalski/…` (stray leading `c`); canonical per `AGENTS.md` header is `juliusz-cwiakalski`.
   Suggested remediation target phase: test_planning
   Suggested fix: Correct the owner segment to `juliusz-cwiakalski`.

## Gate result
NOT_READY — one major finding (Finding 1) blocks clean delivery: the iter-1 grep-gate defect was fixed in the test plan but not propagated to the plan, so Phase 6.1 still specifies an unachievable broad grep that false-positives on retained prohibition text in `pm.md` and `review-feedback-applier.md`, and directly contradicts the refined TC-GIT-012 it claims to invoke. Reopen **delivery_planning** to rewrite plan task 6.1 to match the refined TC-GIT-012; Finding 2 (persistent minor) can be resolved in the same pass, Finding 3 (persistent nit) opportunistically. No human input required (no pause).

This is iteration 2 of ~3; if the same blocking gap persists after the next remediation, escalate to the human rather than looping again.
