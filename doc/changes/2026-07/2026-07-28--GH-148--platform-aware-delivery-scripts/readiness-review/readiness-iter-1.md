# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-148
Date: 2026-07-28
Pause Required: no

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Summary

All 18 ticket acceptance criteria are traced to capabilities (F-1..F-14),
test cases (TC-PLAT-001..051), and plan phases (1..8). Line-number targets in
the plan were spot-checked against the live scripts and are accurate
(`_gh`@200, `classify_result`@934, `pr_url_for`@1002, `build_delivery_prompt`@577,
`worktree_mtime_epoch`@839, batch `require_cmd gh`@601, `should_skip_ticket`@134,
`approved_pr_flow`@312, branch-from-PR@486). The critical spec assumption that
`to_issue_number` handles `GL-` refs was verified: it uses `${ticket_ref#*-}`,
which strips any `PREFIX-`, so it works for both `GH-` and `GL-`. The bash.md
testability rules (mockable wrappers, embedded framework, regression suite) are
respected.

The change is **not yet ready** because of cross-artifact contradictions that
predate the binding PM decisions and were not propagated back into the spec,
plus one doc-update coverage gap. None of the blocking findings require human
input; all are fixable in the specification and delivery-planning phases.

## Findings

### 1. [major] cross_artifact_consistency — spec §16 (Affected Components)

Gap: Spec §16 lists `ceo-loop.sh` as **"Updated (minimal) — share platform
detection where relevant; no tracker calls introduced"**, but the plan's
Out-of-Scope explicitly excludes `ceo-loop.sh` changes
("[OUT] ceo-loop.sh platform detection (OQ-3 binding decision — confirmed no
tracker calls exist)") and states "No changes to ceo-loop.sh are in scope."
The binding OQ-3 decision is recorded in `chg-GH-148-pm-notes.yaml`. The plan's
position is correct and was independently verified during this review
(`grep -nE "_gh|gh |glab" scripts/ceo-loop.sh` returns zero tracker calls —
only a documentation comment matched). The spec §16 row is stale and
contradicts both the binding decision and the plan, leaving the blast radius
ambiguous: a spec reader believes ceo-loop.sh is touched; a plan reader
believes it is not.

Suggested remediation target phase: specification
Suggested fix: Update spec §16 to reflect the OQ-3 resolution — either remove
the `ceo-loop.sh` row or restate it as "No change (OQ-3: ceo-loop.sh has no
tracker calls; detection is not needed)." Also reconcile the soft wording in
§5.1 F-3 / §4.2 NG-3 that implies ceo-loop.sh shares detection, so a single
artifact is internally consistent with the plan.

### 2. [medium] decision_capture — spec §14 (Open Questions)

Gap: Spec §14 still lists OQ-1, OQ-2, and OQ-3 with status
**"Decision needed: consult @decision-advisor"**, but all three are RESOLVED
with binding PM decisions recorded in `chg-GH-148-pm-notes.yaml` (decisions
block, entries dated 2026-07-28) and operationalized in the plan's "Resolved
open questions" preamble and the test plan's §8.3. The decisions are captured
in the correct artifact (pm-notes), but the spec's OQ table was never updated,
so a spec-only reader cannot tell the questions are closed. This creates
ambiguity about which artifact is authoritative and risks a downstream agent
re-escalating an already-decided question.

Suggested remediation target phase: specification
Suggested fix: Mark OQ-1/2/3 as "Resolved (PM-decided 2026-07-28)" in spec §14
and record a one-line decision summary + a back-reference to pm-notes for each,
matching how DEC-1..5 are already captured in §15.

### 3. [medium] plan_doc_update_coverage — plan Phase 7 / Phase 8 (System docs)

Gap: The plan's doc-update tasks list only `doc/spec/features/feature-autonomous-delivery.md`
(Phase 8.3) and `doc/guides/delivery-modes.md` (Phase 7.3). However
`chg-GH-148-pm-notes.yaml` explicitly records "Doc impacts: delivery-modes.md,
**autonomous-batch-delivery.md**, feature-autonomous-delivery.md, delivery-modes.md
hook section (B3)." The new `ADOS_MERGE_STRATEGY` (F-9) and the GitLab Mode B
merge behavior (F-7, F-10) directly affect Mode B operations — the subject of
`doc/guides/autonomous-batch-delivery.md` (the canonical Mode B operations
guide referenced from the feature spec). That guide currently documents the
squash-merge flow and GitHub-only commands; with configurable strategy and
GitLab merge support it needs at least a config-variable note and likely a
GitLab-mode note. Neither the spec §16 nor the plan enumerates this guide as an
update target, so the doc-sync phase could silently miss it.

Suggested remediation target phase: delivery_planning
Suggested fix: Add `doc/guides/autonomous-batch-delivery.md` to Phase 8.3
(Phase 7 covers F-14 in delivery-modes.md; autonomous-batch-delivery.md covers
Mode B ops). Either add an explicit doc-update task for the new
`ADOS_MERGE_STRATEGY` variable + GitLab merge behavior, or record an explicit
justification in the plan for why that guide needs no change. Also add the
guide to spec §16 for consistency.

### 4. [minor] test_traceability — test-plan §6.3 / NFR-2

Gap: NFR-2 ("Platform-detection latency ... well under 2s") is mapped in the
coverage matrix to TC-PLAT-001..006 with the parenthetical "detection is
one-time, mocked", but none of those tests asserts wall-clock latency against
the <2s threshold — they only assert platform-resolution correctness. By
contrast TC-PLAT-049 explicitly measures runtime to assert NFR-4's <10s bound.
As written, NFR-2 has no measurable test despite having a numeric threshold.

Suggested remediation target phase: test_planning
Suggested fix: Either add a wall-clock assertion to one detection test
(analogous to TC-PLAT-049) or explicitly record in §6.3 that NFR-2 is bounded
by construction (one `git remote get-url` read + optional `glab auth status`
probe) and therefore not assertion-tested, so the gap is intentional.

### 5. [nit] cross_artifact_consistency — test-plan §8.1

Gap: The Risks table mitigation column references **"RSSK-7"** — a typo for
`RSK-7`. All other risk IDs in spec/plan/test-plan use the `RSK-N` form.

Suggested remediation target phase: test_planning
Suggested fix: Correct `RSSK-7` → `RSK-7` in test-plan §8.1.

### 6. [nit] ac_quality / test_traceability — test-plan §5.2 TC-PLAT-012

Gap: TC-PLAT-012's Given/When/Then is vague —
"When `_mr ... list ...` is invoked (platform-correct subcommand surface)" —
and does not state the concrete input args or the concrete observed
`glab mr ...` invocation, unlike its sibling dispatch tests TC-PLAT-009/010/011
which give precise invocations (e.g. "`_tracker issue view 42 ...`"). This
leaves the implementer to infer the exact call shape.

Suggested remediation target phase: test_planning
Suggested fix: Make TC-PLAT-012 concrete — e.g. "When `_mr pr list ...` is
invoked, the recorder observes a `glab mr list ...` call (not `gh pr`)",
parallel to TC-PLAT-011.

## Verdict Rationale

`cross_artifact_consistency` and `decision_capture` are the two highest-value
DoR facets and both FAIL: the spec was not propagated with the binding OQ-1/2/3
decisions, leaving the spec's §14 OQ status and §16 ceo-loop.sh row
contradicting the plan and pm-notes. `plan_doc_update_coverage` also FAILS on
the autonomous-batch-delivery.md gap. Per the gate rule, delivery is blocked
until the cross-artifact contradictions are resolved. No finding requires human
input (Pause Required: no); findings 1-2 route to the specification phase and
finding 3 routes to delivery_planning. Findings 4-6 are non-blocking polish.

## Next Steps for @pm

- Reopen **specification** to address findings 1 and 2 (propagate OQ-1/2/3
  resolutions into spec §14 and reconcile §16 / §5.1 / §4.2 on ceo-loop.sh).
- Reopen **delivery_planning** to address finding 3 (add
  `autonomous-batch-delivery.md` to the plan's doc-update scope).
- Optionally address findings 4-6 in test_planning.
- Re-run `/check-readiness GH-148` (iteration 2) once revised.
