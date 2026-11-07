# Readiness Review Iteration 1

Verdict: **NOT_READY**
Work Item: GH-266
Date: 2026-11-07
Pause Required: no

## Facet Summary

- spec_completeness: **FAIL**
- ac_quality: PASS
- plan_coverage: PASS (minor gate omissions; see findings 6-7)
- test_traceability: **FAIL**
- cross_artifact_consistency: **FAIL**
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [critical] spec_completeness — `chg-GH-266-spec.md` §17 AC table (lines 246-262), §4.1 metric row (line 64), §11 RSK-8 (line 197)
   Gap: The ticket's explicit acceptance item "No other story AC or dependency is modified" is not represented by any acceptance criterion. Spec G-4 (line 54), F-5 (line 84), the §4.1 metric "Other-story acceptance criteria or dependencies modified | 0", and RSK-8's mitigation ("AC requires the diff to show no change outside the M1-S9 entry and the status amendment") all assert or rely on such an AC, but none exists. AC-F1-3 covers only the M1-S9 `- AC:`/`- Depends on:` block; AC-NFR1-1 covers changed file paths only. A one-line edit to another story inside `backlog.md` would satisfy every current AC.
   Suggested remediation target phase: specification
   Suggested fix: Add an AC (for example AC-F5-3) requiring every other story's `- AC:` and `- Depends on:` line in `backlog.md` to be byte-identical to the base revision, or requiring all `backlog.md` diff hunks to lie inside the M1-S9 entry. Correct RSK-8's reference to that AC.

2. [critical] test_traceability — `chg-GH-266-test-plan.md` TC-GATE-004 (steps 274-278, expected outcome line 284) and §7.1 P4 (lines 809-828)
   Gap: The expected outcome asserts "No other story's `- AC:` or `- Depends on:` line appears in the diff", but the steps only compare the M1-S9 AC..Depends slice (`P4a`) and check the M1-S9 `- Ticket: GH-239`/dependency line; P4 contains no hunk-confinement or outside-M1-S9 comparison. P1a (file list), P1c (`--check`), P3, P9 and the TC-GATE-017 `--stat` proportion check would not catch a small edit to another story. The risk named in the test plan's own §1 (line 21) — "the amendment could drift into another story's acceptance criteria" — is therefore uncontrolled.
   Suggested remediation target phase: test_planning
   Suggested fix: Add a procedure that extracts every `- AC:` and `- Depends on:` line outside the M1-S9 line range from the base snapshot and HEAD and compares them (or asserts every `git diff -U0` hunk header lies within the M1-S9 entry), and bind it to TC-GATE-004 or a new TC. Add the corresponding gate to P1.

3. [major] cross_artifact_consistency — `chg-GH-266-plan.yaml` task 1.1 (lines 224-239) vs task 1.5 reference text (lines 279-301)
   Gap: Task 1.1 requires the phase (b) gate to read "... (M1-S18) and the evidence-based clean bar met." followed by the four-condition definition. Task 1.5 says "The replacement starts immediately after '(M1-S18) and ':" but its reference text begins "Clean is the conjunction of four conditions...", omitting the connective. Copying 1.5 verbatim yields "... the resident daemon live (M1-S18) and Clean is the conjunction...". No gate checks the connective: P2 checks only removal of the old phrases, P3 checks the four condition literal groups, and P9 checks the token set.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Align the 1.5 reference text with 1.1 (start with "the evidence-based clean bar met. Clean is the conjunction..."), and add the connective literal to P1's gate so a broken sentence cannot pass.

4. [major] cross_artifact_consistency — spec AC-F2-3 (line 255) / §5.1 F-2 (line 89) vs test plan TC-GATE-008 and P7c (lines 381-412, 909-915) and plan task 2.2 (lines 398-409)
   Gap: AC-F2-3 requires the "M0 pilot evidence statements" to be byte-identical, and plan task 2.2 claims the three statements stay "byte-identical (P7c)". P7c normalises whitespace (`tr '\n' ' ' | tr -s ' '`) and greps for the word sequence, so a reflow of those lines would pass while bytes change; it does not compare bytes. The spec never defines which sentences constitute the "M0 pilot evidence statements", and those three phrases sit in the forward-looking paragraph that task 2.2 also appends a pointer to, making the AC's "regions are byte-identical" ambiguous.
   Suggested remediation target phase: specification (wording) and test_planning (oracle)
   Suggested fix: Name the three statements explicitly and state that the pointer is appended after them, leaving their bytes unchanged; tighten P7c to compare the exact statement bytes (or the three-line block) rather than a normalised grep.

5. [minor] test_traceability — test plan TC-GATE-014 and P12 (lines 576-604, 1007-1013) vs AC-NFR5-1
   Gap: `scripts/checks/forbidden-literals.ts` scans only `registry.registered` docs (files absent at the corpus baseline). `doc/planning/oss-tooling/backlog.md` is present at baseline `32784aff…` and is not registered, so the amended backlog is never scanned; only `status.md` is. The "no new violation attributable to the two changed files" half of AC-NFR5-1 is therefore vacuous for `backlog.md`, and the TC-GATE-014 claim "a regression can therefore only come from the two amended files" is false for the backlog. A new `ados` / `ADOS_` / `~/.ados` literal in the amended backlog would pass every gate.
   Suggested remediation target phase: test_planning
   Suggested fix: Add a direct added-line grep over the `backlog.md` diff for the three seed literals, or record the guard's baseline-scan limitation and cover `backlog.md` explicitly. Optionally narrow AC-NFR5-1's attribution wording to what the guard actually scans.

6. [minor] plan_coverage — `chg-GH-266-plan.yaml` phase 2 `testGate` (lines 462-484)
   Gap: TC-GATE-008 and TC-GATE-011 (both P2) require the base snapshots `/tmp/gh266-base-backlog.md` and `/tmp/gh266-base-status.md` created by P0, but P2's `testGate` list omits `p00.sh` and relies on snapshots left by P1. If `origin/main-tools` advances between phases, P2's comparisons use stale snapshots, contrary to test-plan TR-3 ("P0 re-materialises snapshots at run time").
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `p00.sh` to P2's `testGate` (or state explicitly that P1's snapshots are inherited and must be re-materialised when the base moves).

7. [minor] plan_coverage — `chg-GH-266-plan.yaml` phase 1 `testGate` (lines 323-352)
   Gap: P1's gate does not run `p08` (the corroboration insufficiency rule in the backlog); it only runs P3's `d-corroboration` presence check. The backlog half of TC-GATE-009 (including "never sufficient") is first checked by P2's `p08`, but P2's declared scope is `status.md` only, so a backlog defect discovered there cannot be fixed inside P2's scope.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `p08` (or a backlog-only insufficiency literal check) to P1's `testGate`, or widen P2's scope to include the backlog corroboration region.

8. [minor] spec_completeness — spec NFR-1 (line 175) and AC-NFR1-1 (line 260) vs test plan P1a (line 528) and plan D-2 (lines 116-123)
   Gap: AC-NFR1-1 says "the full change diff ... exactly two files changed", but the branch necessarily contains the spec, test plan, plan, pm-notes, and the planned `delivery-evidence/verification.md` under `doc/changes/**`. P1a narrows the measurement with `:(exclude)doc/changes/**`; the plan records this as an interpretation, but the AC/NFR wording remains literally unsatisfiable and a reviewer inspecting the "full change diff" will see five or more files.
   Suggested remediation target phase: specification
   Suggested fix: Reword NFR-1/AC-NFR1-1 to "exactly two product files outside `doc/changes/**`" (or equivalent) so the AC matches the executable check.

9. [minor] cross_artifact_consistency — `status.md` 2026-11-03 bullet (line 14), spec §2.1 (line 33) and DEC-6 (line 231)
   Gap: The dated 2026-11-03 section says "Per-engine handover still requires its own two-clean-weeks evidence; that constraint is never waived." The spec classifies this as history and gives it no pointer, but never establishes whether "per-engine handover" is the same gate as M1-S9's per-repository handover. A reader of the amended `status.md` can see a live contradiction ("never waived" vs "no longer defined by elapsed time").
   Suggested remediation target phase: specification
   Suggested fix: In the new amendment section or the residual note, state explicitly whether the 2026-11-03 per-engine sentence is superseded for M1-S9 or addresses a different gate. Do not rewrite the dated bullet.

10. [nit] cross_artifact_consistency — plan task 2.4 reference text (lines 429-455)
    Gap: The status amendment lead-in says the gate is "no longer defined by elapsed time" while the same section retains the 7-consecutive-days floor; a skimming reader can read that as self-contradictory. The backlog wording ("exposure floor ... whichever comes first") is clearer.
    Suggested remediation target phase: specification
    Suggested fix: Reword to "no longer defined by a calendar window alone" (or equivalent) and keep the floor-only "whichever comes first" wording.

11. [nit] decision_capture — status amendment attribution (plan task 2.1, lines 373-397) and spec §12 assumption (line 201)
    Gap: `CEO-D-073` is cited as the authority in the new status section but is not locatable anywhere in the repository; it exists only in the GH-266 ticket title/body. The amendment has no link to GH-266 or the directive text, so a future reader cannot resolve the id.
    Suggested remediation target phase: specification
    Suggested fix: Require the status amendment to cite GH-266 (or the directive's date/source) so the id resolves, or record the directive text in a linkable artifact.

12. [nit] plan_code_area_coverage — plan phase 3 `scope` (lines 495-504)
    Gap: The DoR record is written under `doc/changes/.../readiness-review/`, and phase 3 declares only the `delivery-evidence` folder. If `plan diff` is run against HEAD, the readiness record classifies as `outside-declared`.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Declare `doc/changes/2026-11/2026-11-07--GH-266--evidence-based-handover-gate/readiness-review` in P3 `scope.folders`, or note it is excluded from the product diff.

## Judgments Requested

- **DEC-3 (eleven-token enumeration) is defensible and properly disclosed.** I verified `DELIVERY_RESULT_TOKENS` in `packages/core/src/contracts/delivery-result.ts` contains exactly the eleven tokens including `pr-open-unverified`, and TDR-0005 adopts that vocabulary. The ticket's normative clause "every TDR-0005 result class" governs over its ten-token parenthetical. The resolution is disclosed in spec §2.1, §5.1 F-4, §15 DEC-3, §17.1 DoD, §24, the PM notes, and plan D-8. The strict "result class" reading (projection classes) is disambiguated by the ticket's own token parenthetical. No objection.
- **DEC-5 (declared residual) is honestly declared and creates a real but acceptable, bounded contradiction — not an unacceptable one.** I verified every residual document in spec §7.2 and `status.md` (backlog-ranking.md rank 39, roadmap.md constraint 6 and the M1 exit-evidence row, cli-command-registry.md dispatch/deliver-ticket.sh rows, milestones/m1/commands/dispatch.md, milestones/m1/journeys.md, user-journeys.md, milestones/m1/test-scenarios.md SC-M1-29/30, operator-requirements-2026-11.md) still carries the superseded M1-S9 phrasing. The contradiction is planning-doc-only, M1-S9/GH-239 is undelivered, the canonical backlog entry is explicit, the ticket fixes the two-file scope, and the residual is named in both the status amendment and the spec. It is a disclosure-and-follow-up risk, not a reason to widen this change.
- The 2026-11-03 history and the M0 exit criterion are correctly treated as historical/preserved; the plan does not rewrite them. The ambiguity in finding 9 is about whether the per-engine sentence is the same gate, not about rewriting it.

## Verified Positive Evidence

- The eleven-token comparison is genuinely mechanical under the plan's paragraph-shaping constraint. I reconstructed the plan's reference amendment in `/tmp` and ran the literal P2/P3/P8/P9/P14 procedures: `occurrences=0 unmarked=0`, `conditions=4/4`, `floor-scope=OK`, `sources=3/3 insufficiency=OK` for both files, `tokens=11 missing=0 extra=0 duplicates=0`. The negative control (`pr-open-unverified` removed) produced `tokens=10 missing=1`, exit 1.
- Base-revision falsifiability was confirmed: P2 → `occurrences=1 unmarked=1`; P3 → `conditions=1/4`; P5 → `amendment: not found`; P6 → `forward=2 pointed=0`; P9 → `FAIL: enumeration paragraph not found`. P11 (`test-doc-distribution.sh`) and P12 (`forbidden-literals.ts`) pass on the base tree (81 in-scope docs, 5/5 scope classes, 0 violations).
- The plan validates against the repository's `delivery.plan.v1` validator: `verdict=valid`, `readyForDevelopment=true`, `totalErrors=0`, phases 1-3. TC mapping is 17/17 exactly once and AC mapping 13/13.
- The residual list is accurate and complete for M1-S9 phrasing; the M0 `two weeks` criterion and the M1-S21 "final two-week window" are different gates and are correctly untouched.

## Next Remediation Targets

- specification: findings 1, 4, 8, 9, 10, 11 (add the missing AC; clarify byte-identity and gate vocabulary; narrow NFR-1/AC-NFR1-1 wording)
- test_planning: findings 2, 4, 5 (add the outside-M1-S9 preservation procedure; tighten P7c; cover the forbidden-literals scope limitation)
- delivery_planning: findings 3, 6, 7, 12 (align the 1.1/1.5 replacement text; add P0 to P2; add the backlog corroboration gate to P1; declare the readiness-review folder)

After revision, re-run this gate. Findings 1-3 must be closed for `READY`; findings 4-12 may be closed or explicitly accepted with a recorded rationale.
