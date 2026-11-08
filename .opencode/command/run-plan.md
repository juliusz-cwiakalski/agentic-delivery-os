---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/.opencode/command/run-plan.md
#
description: Execute implementation plan phases for a change.
agent: coder
subtask: true
claude:
  model: sonnet
---

<purpose>
Run the IMPLEMENTATION PLAN phase-by-phase for a tracked change. Record each plan phase's evidence as a pm-notes `notes:` entry and commit through the `commit` primitive after every finished phase; at the lifecycle boundary run `phase complete <workItemRef> delivery`. Automatically resumes from the first phase without recorded evidence on subsequent invocations.
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
  /run-plan PDEV-123 execute phase 3 commit per plan phase
</command>

<inputs>
  <item>workItemRef='$1' — Tracker reference (e.g., `PDEV-123`, `GH-456`). Uppercase prefix + hyphen + digits.</item>
  <item>directives='$ARGUMENTS' — Full arguments; if same as workItemRef, no directives.</item>
</inputs>

<discovery_rules>
<rule>Locate change folder: search `doc/changes/**/*--<workItemRef>--*/`</rule>
<rule>If not found, search for spec file: `doc/changes/**/chg-<workItemRef>-spec.md`</rule>
<rule>Plan file: `chg-<workItemRef>-plan.yaml` inside the change folder (YAML wins when both plan formats exist).</rule>
<rule>Legacy plan: `chg-<workItemRef>-plan.md` remains readable during the transition; `plan validate` answers it with `plan.format.legacy-markdown`.</rule>
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
- "commit per plan phase" (the default) → one primitive commit per completed plan phase.

Defaults (no directive): phasesToRun=1; askForReview=true; one commit per plan phase.
</directive_parsing>

<plan_parsing_rules>
<rule>Current plan: YAML `chg-<workItemRef>-plan.yaml`; read `phases[]` in `id` order.</rule>
<rule>Each phase declares `kind`, `scope` (files, packages, folders), optional `interactions`, `doneArtifacts`, `leases`, `weightClass`, and `leaseClass`.</rule>
<rule>Declared scope is authoritative: execute only what a phase declares; `plan diff <workItemRef>` observes deviation.</rule>
<rule>Plan-phase completion evidence: one `notes:` entry per completed plan phase in `chg-<workItemRef>-pm-notes.yaml`, naming the plan phase id, commit hash, and test result. The phase command records lifecycle phases only (`clarify_scope`..`pr_creation`). Never rewrite declared YAML scope to record progress.</rule>
<rule>Acceptance evidence: report PASSED or FAILED with the commit and test result.</rule>
<rule>Legacy `chg-<workItemRef>-plan.md`: parse `### Phase N` headings as before; `plan validate` classifies it `plan.format.legacy-markdown`.</rule>
</plan_parsing_rules>

<core_principles>
<principle>Determinism: parsing never reorders phases or evidence.</principle>
<principle>Minimality: edit only necessary lines; avoid broad formatting changes.</principle>
<principle>Traceability: every edit tied to a plan phase; commits atomic.</principle>
<principle>Autonomy: proceed without prompting unless blocked.</principle>
<principle>Idempotence: re-running resumes cleanly without duplicating evidence.</principle>
</core_principles>

<phase_execution_rules>
For each selected phase:

1. Read the phase's declared `scope` and its spec/test-plan requirements. If the phase has no pending work and its acceptance evidence already exists, treat it as completion-only.
2. Execute the phase:
   a. Form the internal contract (goal, inputs, outputs, success checks).
   b. Discover relevant files inside the declared scope only.
   c. Implement minimal edits; avoid unrelated refactors.
   d. Add/adjust tests when functional behavior changes.
   e. Run the phase's declared tests and quick validations.
3. Close the phase:
   a. Run the phase's declared quality evidence; capture PASS/FAIL.
   b. Append one pm-notes `notes:` entry naming the plan phase id, commit hash, and test result. Never write progress into the plan and never add a `tasks` key.
   c. Commit with `commit <workItemRef>`, using actual values for the outcome, supported `why` from the spec/plan, and observed verification.
   d. At the lifecycle delivery boundary, run `phase complete <workItemRef> delivery` (with `--no-commit` when the request carries `"no commit"`).
4. Stop after phasesToRun. If askForReview=true, pause with a summary.
   </phase_execution_rules>

<commit_rules>
<rule>Use the `commit` primitive (or the thin `@committer`) for every commit; never run raw `git add`/`git commit`.</rule>
<rule>One commit per completed plan phase; the primitive computes the staging set, safety verdict, and message.</rule>
<rule>Ensure no unrelated changes bleed across commits.</rule>
<rule>A phase with no code changes still records its pm-notes evidence and commits if the primitive finds pending work.</rule>
<rule>Pass only actual single-line values; omit unsupported fields and never pass template/placeholders or phase metadata.</rule>
</commit_rules>

<partial_failure_policy>
<rule>After 3 fix attempts: record the partial state in a pm-notes `notes:` entry and publish a typed blocker with `blockers publish`.</rule>
<rule>Do not report an acceptance criterion PASSED when behavior is deferred.</rule>
<rule>Commit the partial progress through the primitive; pause and request guidance for the blocking failure.</rule>
</partial_failure_policy>

<quality_gates>
Auto-detect once per invocation (cache for subsequent phases):

- build: scripts/, package.json ("build" script), Makefile, CI configs.
- test: package.json ("test" script), scripts/test.\*, make test, pytest, go test.
- typecheck: tsc --noEmit if tsconfig; mypy if pyproject; go vet.
  If detection fails: record attempts and skip with evidence.
  </quality_gates>

<dry_run_behavior>
No file edits, no commits. Output a structured summary: starting phase, phasesToRun, phase counts, detected commands, commit plan, next resume command.
</dry_run_behavior>

<output_contract>
<item>Append pm-notes evidence per completed plan phase (unless dry run); never write progress into the plan.</item>
<item>Produce one primitive commit per completed plan phase, plus the lifecycle completion at the boundary.</item>
<item>Emit a concise summary: phases executed, gates status, deferrals, next phase.</item>
<item>On all phases complete: announce completion.</item>
</output_contract>

<process>
1. Parse $ARGUMENTS: first token → workItemRef; remainder → directives.
2. Validate workItemRef format (uppercase prefix + hyphen + digits).
3. Locate spec & plan via discovery_rules; derive slug & change.type; validate presence.
4. Validate plan structure (at least one phase with Tasks section).
5. Ensure correct branch per branch_rules.
6. Parse directives; decide phasesToRun, commitMode, askForReview, dryRun.
7. Identify the start phase (earliest without recorded pm-notes evidence or missing acceptance evidence).
8. If dryRun: output summary; STOP.
9. Detect quality gate commands (cache).
10. Loop phases applying phase_execution_rules & partial_failure_policy.
11. Perform commits per policy.
12. Summarize; if askForReview=true and remaining phases exist → pause.
13. If all phases complete → final summary.
</process>

<plan_update_rules>
<rule>Legacy markdown plan only: read heading and checkbox state as evidence. Never write progress into the plan file; record it in pm-notes `notes:` entries.</rule>
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
- No pending scope and no acceptance criteria in the targeted phase.
Produce clear error; no edits/commits.
</validation>

<examples>
1) /run-plan PDEV-123 → Executes next incomplete phase; commits once; asks for review.
2) /run-plan GH-456 execute next 3 phases no review → Runs 3 phases without pausing.
3) /run-plan PDEV-123 execute phase 4 → Jumps to phase 4; commits once per plan phase.
4) /run-plan GH-456 dry run execute all remaining phases → Simulates; outputs plan.
</examples>

<assumptions>
  <item>Plan produced by `/write-plan` template structure.</item>
  <item>`/commit` handles Conventional Commit formatting automatically.</item>
</assumptions>
