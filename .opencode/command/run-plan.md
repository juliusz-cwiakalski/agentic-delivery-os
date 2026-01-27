---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
#
# MIT License - see LICENSE file for full terms
description: Execute implementation plan phases for a change.
agent: executor
subtask: true
---

<purpose>
Run the IMPLEMENTATION PLAN phase-by-phase for a tracked change. Mark each task as completed and perform a Conventional Commit (via `/commit`) after every finished phase (or per task if directed). Automatically resumes from first incomplete phase on subsequent invocations.
</purpose>

<command>
User invocation:
  /run-plan <workItemRef> [plain text directives]
Examples:
  /run-plan PDEV-123
  /run-plan GH-456 execute next 3 phases and then ask for review
  /run-plan PDEV-123 execute all remaining phases
  /run-plan GH-456 execute phase 5 only
  /run-plan PDEV-123 execute all remaining phases no review
  /run-plan GH-456 dry run execute next 2 phases
  /run-plan PDEV-123 execute phase 3 commit per task
</command>

<inputs>
  <item>workItemRef='$1' — Tracker reference (e.g., `PDEV-123`, `GH-456`). Uppercase prefix + hyphen + digits.</item>
  <item>directives='$ARGUMENTS' — Full arguments; if same as workItemRef, no directives.</item>
</inputs>

<discovery_rules>
<rule>Locate change folder: search `doc/changes/**/*--<workItemRef>--*/`</rule>
<rule>If not found, search for spec file: `doc/changes/**/chg-<workItemRef>-spec.md`</rule>
<rule>Plan file: `chg-<workItemRef>-plan.md` inside the change folder.</rule>
<rule>Spec file: `chg-<workItemRef>-spec.md` for change.type and slug validation.</rule>
<rule>Folder pattern: `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`</rule>
<rule>Never reference `doc/changes/current/` in edits or evidence.</rule>
</discovery_rules>

<branch_rules>
<format>`<change.type>/<workItemRef>/<slug>`</format>
<process> 1. If current branch matches pattern → keep. 2. Else attempt checkout existing branch. 3. Else create new branch. 4. Abort if dirty working tree contains unrelated staged changes.
</process>
</branch_rules>

<directive_parsing>
Supported (case-insensitive):

- "execute next N phases" → run current incomplete phase + N−1 subsequent.
- "execute all remaining phases" → run all incomplete phases.
- "execute phase N" → run only phase N (must be incomplete).
- "ask for review" / "and then ask for review" → pause after requested phases (default).
- "no review" / "continue without review" → do not pause.
- "dry run" → simulate; no edits/commits.
- "commit per task" → commit after each task instead of per phase.

Defaults (no directive): phasesToRun=1; askForReview=true; commitMode=per-phase.
</directive_parsing>

<plan_parsing_rules>
<rule>Phase header regex: `/^### Phase (\d+):/`</rule>
<rule>Tasks: checkboxes under "**Tasks**:" until blank line or "**Acceptance Criteria**:"</rule>
<rule>Unchecked: `- [ ]`; Completed: `- [x]`</rule>
<rule>Completion: replace token only, append note e.g. `(done: added config & tests)`</rule>
<rule>Acceptance criteria: lines start with "- Must:" or "- Should:"; append `(PASSED: <summary>)` or `(FAILED: <summary>)`</rule>
<rule>Execution Log: header "## Execution Log"; append if missing</rule>
</plan_parsing_rules>

<core_principles>
<principle>Determinism: parsing & updates never reorder tasks or phases.</principle>
<principle>Minimality: edit only necessary lines; avoid broad formatting changes.</principle>
<principle>Traceability: every edit tied to task completion; commits atomic.</principle>
<principle>Autonomy: proceed without prompting unless blocked.</principle>
<principle>Idempotence: re-running resumes cleanly without duplicating evidence.</principle>
</core_principles>

<phase_execution_rules>
For each selected phase:

1. Identify pending tasks (unchecked). If none but acceptance evidence missing, treat as completion-only phase.
2. For each pending task:
   a. Form internal contract (goal, inputs, outputs, success checks).
   b. Discover relevant files in: src/, app/, packages/, modules/, lib/, services/, infra/, config/, scripts/, tests/, static/, doc/.
   c. Implement minimal edits; avoid unrelated refactors.
   d. Add/adjust tests when functional behavior changes.
   e. Run quick validations (typecheck/build/test subset).
   f. Mark task completed with concise evidence note.
   g. If commitMode=per-task: stage only task changes + plan update, then `/commit`.
3. After tasks complete:
   a. Run full quality gates; capture PASS/FAIL summaries.
   b. Append evidence to acceptance criteria lines (once only).
   c. Append Execution Log entry.
   d. If commitMode=per-phase: `/commit`.
4. Stop after phasesToRun. If askForReview=true, pause with summary.
   </phase_execution_rules>

<commit_rules>
<rule>Use `/commit` for Conventional Commit generation.</rule>
<rule>Per-phase default; per-task if directive present.</rule>
<rule>Ensure no unrelated changes bleed across commits.</rule>
<rule>Tasks with no code changes: mark completed; commit with other changes.</rule>
</commit_rules>

<partial_failure_policy>
<rule>After 3 fix attempts: mark task as `(done: partial; deferred X)`.</rule>
<rule>Do not mark acceptance criteria PASSED if behaviors deferred.</rule>
<rule>Commit partial progress; pause and request guidance (override for blocking failure).</rule>
</partial_failure_policy>

<quality_gates>
Auto-detect once per invocation (cache for subsequent phases):

- build: scripts/, package.json ("build" script), Makefile, CI configs.
- test: package.json ("test" script), scripts/test.\*, make test, pytest, go test.
- typecheck: tsc --noEmit if tsconfig; mypy if pyproject; go vet.
  If detection fails: record attempts and skip with evidence.
  </quality_gates>

<dry_run_behavior>
No file edits, no commits. Output structured summary: starting phase, phasesToRun, task counts, detected commands, commit plan, next resume command.
</dry_run_behavior>

<output_contract>
<item>Update plan file with task completion, acceptance evidence, Execution Log (unless dry run).</item>
<item>Produce commits per commit_rules.</item>
<item>Emit concise summary: phases executed, tasks completed, gates status, deferrals, next phase.</item>
<item>On all phases complete: announce completion.</item>
</output_contract>

<process>
1. Parse $ARGUMENTS: first token → workItemRef; remainder → directives.
2. Validate workItemRef format (uppercase prefix + hyphen + digits).
3. Locate spec & plan via discovery_rules; derive slug & change.type; validate presence.
4. Validate plan structure (at least one phase with Tasks section).
5. Ensure correct branch per branch_rules.
6. Parse directives; decide phasesToRun, commitMode, askForReview, dryRun.
7. Identify start phase (earliest with unchecked task or missing acceptance evidence).
8. If dryRun: output summary; STOP.
9. Detect quality gate commands (cache).
10. Loop phases applying phase_execution_rules & partial_failure_policy.
11. Perform commits per policy.
12. Summarize; if askForReview=true and remaining phases exist → pause.
13. If all phases complete → final summary.
</process>

<plan_update_rules>
<rule>Modify only: task checkbox lines; acceptance criteria lines; Execution Log section.</rule>
<rule>Keep original line order & spacing (no reflow).</rule>
<rule>Evidence parenthetical ≤ 80 chars; lowercase verbs; avoid redundancy.</rule>
<rule>If Execution Log missing → append canonical section before first update.</rule>
</plan_update_rules>

<error_handling>
<rule>Capture stderr snippet (5-10 lines) for gate failures; summarize root cause.</rule>
<rule>Retry up to 3 focused fixes; if persists, log deferral & proceed if non-blocking.</rule>
<rule>Blocking failure → phase abort + partial commit; require review.</rule>
</error_handling>

<validation>
Fail fast if:
- Spec or plan missing.
- slug or change.type not derivable.
- Target phase invalid or already complete.
- No tasks and no acceptance criteria in targeted phase.
Produce clear error; no edits/commits.
</validation>

<examples>
1) /run-plan PDEV-123 → Executes next incomplete phase; commits once; asks for review.
2) /run-plan GH-456 execute next 3 phases no review → Runs 3 phases without pausing.
3) /run-plan PDEV-123 execute phase 4 commit per task → Jumps to phase 4; commits per task.
4) /run-plan GH-456 dry run execute all remaining phases → Simulates; outputs plan.
</examples>

<assumptions>
  <item>Plan produced by `/write-plan` template structure.</item>
  <item>`/commit` handles Conventional Commit formatting automatically.</item>
</assumptions>
