---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/06-workflows.md
---
# 06. Workflows: mental experiments

Each workflow lists the actors, the commands, what the agent sees, and the failure paths. The
examples use the same change (GH-416, a `push <ref>` command) so the facets stay consistent
across the pack.

## A. Intake to Definition of Ready

**Actors:** PM, spec-writer, test-plan-writer, plan-writer, readiness-reviewer.

```bash
# PM
jaiship change init GH-416 --tier L --milestone M4 \
  --title "A lane pushes its own last evidence commit before it stops"
jaiship context bundle --for pm --change GH-416
jaiship phase complete GH-416 clarify_scope

# spec-writer
jaiship context bundle --for spec-writer --change GH-416
jaiship spec set GH-416 --from-file /tmp/spec.yaml
jaiship spec ac add GH-416 --id AC-1 --statement "..." --evidence test --tests TC-LCMD-001
jaiship lint change GH-416
jaiship phase complete GH-416 specification

# test-plan-writer
jaiship context bundle --for test-plan-writer --change GH-416
jaiship test case add GH-416 --id TC-LCMD-001 --title "..." --acceptance AC-1 --phase P3 \
  --layer behaviour --path tests/behaviour/dispatch-lane-push-command.test.ts \
  --step "..." --expected "..."
jaiship test coverage rebuild GH-416
jaiship lint change GH-416
jaiship phase complete GH-416 test_planning

# plan-writer
jaiship context bundle --for plan-writer --change GH-416
jaiship plan phase add GH-416 --id P3 --title "..." --acceptance AC-1,AC-2,AC-3 \
  --tests TC-LCMD-001,TC-LCMD-003 \
  --path packages/cli/src/commands/push.ts:add:producer \
  --verify "pnpm typecheck:.:0"
jaiship lint change GH-416
jaiship phase complete GH-416 delivery_planning

# readiness-reviewer
jaiship readiness assess GH-416
jaiship phase complete GH-416 dor_check
```

**What the agents see.** The spec-writer sees the ticket, the milestone goal, the system spec
index, the related decisions, and the tier rules. It does not see the test plan or the plan.
The test-plan-writer sees the ACs and interfaces, not the spec prose. The plan-writer sees the
ACs, interfaces, components, and test list, not the spec prose. The readiness-reviewer sees
the contract, the coverage table, the plan summary, and the lint gaps.

**Failure paths.** A lint failure names the field and the limit. A reference failure names the
ID. A tier overflow raises the tier and records the re-tier. None of these writes a partial
facet.

## B. Definition of Ready not met

**Actors:** readiness-reviewer, PM, spec-writer, test-plan-writer, plan-writer.

```bash
# readiness-reviewer
jaiship readiness assess GH-416
# verdict: readiness.fail
# gaps:
#   AC-3 has no test case
#   P4 has no verify command
#   scope.out contradicts AC-1

# PM
jaiship pm loop add GH-416 --text "AC-3 has no test case" --owner test-plan-writer --due test_planning
jaiship pm loop add GH-416 --text "P4 has no verify command" --owner plan-writer --due delivery_planning
jaiship phase reopen GH-416 specification --reason "AC-3 has no test case; scope.out contradicts AC-1"

# spec-writer: gap bundle, not the whole specification
jaiship context bundle --for spec-writer --change GH-416 --gaps AC-3,AC-1
jaiship spec ac add GH-416 --id AC-3 --statement "..." --evidence test --tests TC-LCMD-003
jaiship spec set GH-416 --scope-out "No change to branch protection."
jaiship lint change GH-416
jaiship phase complete GH-416 specification

# test-plan-writer: gap bundle for AC-3
jaiship context bundle --for test-plan-writer --change GH-416 --gaps AC-3
jaiship test case add GH-416 --id TC-LCMD-003 --title "..." --acceptance AC-3 --phase P3
jaiship test coverage rebuild GH-416
jaiship lint change GH-416
jaiship phase complete GH-416 test_planning

# plan-writer: gap bundle for P4
jaiship context bundle --for plan-writer --change GH-416 --gaps P4
jaiship plan verify add GH-416 --phase P4 --cmd "pnpm test tests/checks/doc-conformance.test.ts" --cwd . --expect 0
jaiship lint change GH-416
jaiship phase complete GH-416 delivery_planning

# readiness-reviewer
jaiship readiness assess GH-416
# verdict: readiness.pass
jaiship phase complete GH-416 dor_check
```

**What the agents see.** A gap bundle contains only the gap, the related ACs, the related
decisions, and the tier rules. The spec-writer does not reread the 25-section specification;
it reads the gap. This is the fix for the reopen loop that cost about 2.5 hours on GH-416.

**Failure paths.** If the gap is a scope question, the PM publishes a typed blocker
(`jaiship blockers publish`) and the lane parks until the CEO answers. If the gap is a tier
overflow, the PM re-tiers and the artifact set grows. If the gap repeats after two attempts,
the PM escalates to the CEO with the gap history.

## C. Delivery with a handover

**Actors:** coder (P3), coder (P4), PM.

```bash
# coder P3
jaiship context bundle --for coder --change GH-416 --phase P3
# implement, run the verify commands
jaiship handover record GH-416 --phase P3 --from-file /tmp/handover-P3.yaml
jaiship plan phase complete GH-416 --phase P3
# refuses if the handover is missing or over budget

# coder P4
jaiship context bundle --for coder --change GH-416 --phase P4
# the bundle includes the P3 handover and the P4 nextInputs
jaiship handover record GH-416 --phase P4 --from-file /tmp/handover-P4.yaml
jaiship plan phase complete GH-416 --phase P4

# PM, at the lifecycle boundary
jaiship context bundle --for pm --change GH-416
jaiship phase complete GH-416 delivery
```

**What the agents see.** The P3 coder sees the phase goal, ACs, paths, interfaces, tests,
verify, the P2 handover, the invariants, and what P4 expects. The P4 coder sees the P3
handover, not the P3 transcript. The PM sees the handover summaries, not the full handovers.

**Failure paths.** A missing handover refuses the phase completion. An over-budget handover
is refused with the field and the limit. A handover that claims a test the gate did not run is
caught by the evidence check. A deviation that changes the contract reopens the specification
through the PM, with the finding as the gap.

## D. Code review and fix

**Actors:** reviewer, coder, PM.

```bash
# reviewer
jaiship context bundle --for reviewer --change GH-416 --phase P3
jaiship review finding add GH-416 --severity high --path packages/cli/src/commands/push.ts \
  --line 42 --ac AC-2 --text "A refusal adds a new error identity; the contract says the standard envelope."
jaiship review finding add GH-416 --severity low --path packages/cli/src/output/push-text.ts \
  --line 18 --ac AC-1 --text "The human form omits the cause when present."

# PM
jaiship review finding list GH-416
jaiship pm next add GH-416 --text "Resolve two review findings on P3" --owner coder --blocking true

# coder: a fix bundle filtered by the findings
jaiship context bundle --for coder --change GH-416 --phase P3 --findings RF-1,RF-2
# fix, run the targeted tests
jaiship review finding resolve GH-416 --id RF-1 --evidence "TC-LCMD-002 passes; no new error identity."
jaiship review finding resolve GH-416 --id RF-2 --evidence "TC-LCMD-001 golden updated."

# reviewer
jaiship context bundle --for reviewer --change GH-416 --phase P3
jaiship review verdict GH-416 --phase P3 --verdict pass
jaiship phase complete GH-416 review_fix
```

**What the agents see.** The reviewer sees the diff summary, the ACs the diff claims, the
tests that prove them, the decisions that constrain the diff, and the checklist. The coder
sees only the findings that touch its phase and paths, plus the ACs and tests they cite.

**Failure paths.** A finding that changes the contract is not a fix; it is a reopen. The PM
reopens the specification with the finding as the gap, and the review waits. A finding that
the coder disputes goes to the PM as a typed question; the CEO decides if it is blocking. A
flaky check is re-run, never patched (existing rule).

## E. A spec gap found in test planning

**Actors:** test-plan-writer, PM, spec-writer.

```bash
# test-plan-writer
jaiship spec gap add GH-416 --ac AC-2 \
  --question "Does a refused transport record the act when the fence also refuses the append?"
# the tool records the gap, links it to AC-2, and notifies the PM

# PM
jaiship pm brief
jaiship phase reopen GH-416 specification --reason "AC-2 is ambiguous on the fence refusal path"
jaiship pm loop add GH-416 --text "Resolve AC-2 ambiguity" --owner spec-writer --due specification

# spec-writer: gap bundle for AC-2 and its decisions
jaiship context bundle --for spec-writer --change GH-416 --gaps AC-2
jaiship spec decision add GH-416 --id DEC-3 --question "..." --choice "Record the act with recorded false; no retry." \
  --status accepted
jaiship spec ac add GH-416 --id AC-2 --statement "..." --evidence test --tests TC-LCMD-002
jaiship lint change GH-416
jaiship phase complete GH-416 specification

# test-plan-writer resumes from the gap, not from the beginning
jaiship context bundle --for test-plan-writer --change GH-416 --gaps AC-2
jaiship phase complete GH-416 test_planning
```

**What the agents see.** The spec-writer sees AC-2, the decisions that touch it, and the
question. It does not reread the whole specification. The test-plan-writer resumes from the
gap. The PM sees the gap, the owner, and the due phase.

**Failure paths.** A gap that is a product question goes to the owner as a typed blocker;
the lane parks. A gap that repeats is evidence that the specification's contract is
underspecified; the PM raises the tier.

## F. Peak park and resume

**Actors:** PM, coder.

```bash
# before the park, the PM context is current
jaiship pm next add GH-416 --text "Resume at P4 after the peak window" --owner coder --blocking true
jaiship pm brief
# the tool parks the lane; the park record is separate from the PM context

# after the park
jaiship context bundle --for pm --change GH-416
# the brief shows the next action, the last handover, and the park expiry
jaiship context bundle --for coder --change GH-416 --phase P4
# the bundle includes the P3 handover; the coder does not reread the transcript
```

**What the agents see.** The PM sees the next action and the handover summary. The coder sees
the P4 phase bundle plus the P3 handover. Neither reads the session history.

**Failure paths.** A park that expires while the branch is behind fails the first write with
`change.branch.behind`; the PM syncs and retries. A park that expires with an open blocker
keeps the lane parked; the brief shows the blocker.

## G. Parallel lanes and affected paths

**Actors:** scheduler (queue), PM, coder A, coder B.

```bash
# the queue compares the plans before dispatch
jaiship plan conflicts GH-416 GH-417
# verdict: serialize
# reason: both declare packages/cli/src/production.ts as a write path

# alternative: disjoint
jaiship plan conflicts GH-416 GH-418
# verdict: parallel
# reason: no write overlap; one read-only overlap on a contract file

# the second lane's bundle carries the order note
jaiship context bundle --for coder --change GH-417 --phase P2
# includes: "Serialized behind GH-416; rebase after it lands; production.ts is the shared write path."

# at the pull request
jaiship change audit GH-416 --base origin/main-tools
# compares declared paths with the diff; an undeclared path fails or is recorded
```

**What the agents see.** The scheduler sees the path sets and the conflict class. The second
coder sees the order note and the shared path. The PM sees the serialization decision and its
reason.

**Failure paths.** An undeclared path at the pull request is a lint failure or a recorded
drift, depending on the policy. A plan that over-declares serializes everything; the retro
measures the misprediction rate. A rename or a generated file is conservative: it serializes.

## H. Milestone goal verification

**Actors:** milestone verifier (independent), PM, CEO.

```bash
jaiship milestone verify M4
# reads the milestone contract, the tickets' ACs, and the evidence
# verdict per goal: met | not-met | partial, with evidence
```

**What the agents see.** The verifier sees each goal, its measure, its tickets, the merged
ACs, and the evidence (tests, gates, reviews). It does not see the tickets' prose.

**Failure paths.** A goal with no merged ticket is `not-met`; the PM opens or reopens a
ticket. A goal whose measure is not evidenced is `partial`; the verifier names the missing
evidence. A goal that is no longer wanted is a milestone contract change, recorded as a new
revision, not a silent edit.

## What the workflows prove

- The same facets serve every role; no role reads a whole file.
- The reopen loops are targeted: a gap bundle, not a full reread.
- The handover is the only cross-phase memory the next coder needs.
- The plan's paths are the scheduler's input and the audit's baseline.
- The PM's working memory stays small because history lives in the retrospective log and the
  decision records.
