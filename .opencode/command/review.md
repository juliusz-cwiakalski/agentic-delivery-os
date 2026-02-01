---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/review.md
#
description: Review change vs spec & plan; append remediation phase if needed.
agent: reviewer
subtask: true
model: github-copilot/grok-code-fast-1
---

<purpose>
Perform focused code review of diff between base branch (default: main) and the canonical change branch. Validate alignment against specification, implementation plan, and repository rules. If gaps found, append remediation phase to the plan.
</purpose>

<command>
User invocation:
  /review <workItemRef> [directives...]
Examples:
  /review PDEV-123
  /review GH-456 dry run
  /review PDEV-123 base=staging
  /review GH-456 head=feat/GH-456/new-endpoint base=production preview only
  /review PDEV-123 no commit
</command>

<inputs>
  <item>workItemRef='$1' — Tracker reference (e.g., `PDEV-123`, `GH-456`). REQUIRED.</item>
  <item>directives: remainder free-text. OPTIONAL.</item>
  <item>Derived flags: baseBranch, headRef, commit (default true), dryRun (default false).</item>
</inputs>

<discovery_rules>
<rule>Locate change folder: search `doc/changes/**/*--<workItemRef>--*/`</rule>
<rule>If not found, search: `doc/changes/**/chg-<workItemRef>-spec.md`</rule>
<rule>Spec file: `chg-<workItemRef>-spec.md`; derive slug & change.type from frontmatter.</rule>
<rule>Plan file: `chg-<workItemRef>-plan.md`</rule>
<rule>Folder pattern: `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`</rule>
<rule>Abort with clear error if spec OR plan missing.</rule>
</discovery_rules>

<branch_resolution>
<rule>changeBranch = `<change.type>/<workItemRef>/<slug>`</rule>
<rule>headRef: directives override, else try changeBranch, fallback: current HEAD.</rule>
<rule>baseBranch: directives override, else `main`, fallback: `master`.</rule>
<rule>Compute merge-base and gather symmetric diff `baseBranch...headRef`.</rule>
</branch_resolution>

<directive_parsing>
Directives (case-insensitive):

- Base branch: `base=<branch>` | `base branch <branch>` | `compare vs <branch>`
- Head ref: `head=<ref>` | `head ref <ref>` | `branch <ref>`
- Disable commit: `commit=false` | `no commit`
- Dry run: `dry run` | `preview only`
  Unrecognized tokens ignored.
  </directive_parsing>

<pre_flight>

1. Validate workItemRef format (uppercase prefix + hyphen + digits).
2. Resolve spec; extract change.type & slug.
3. Resolve plan; parse phases & existing remediation.
4. Load repository rules (AGENTS.md, `.ai/rules/**`).
5. Resolve branches & compute diff metadata.
6. If dryRun: prepare preview but do NOT write.
   </pre_flight>

<review_method>

- Scope compliance: changed files align with spec capabilities.
- Plan alignment: tasks & acceptance criteria covered.
- Quality dimensions: readability, dead code, error handling, security, tests.
- Out-of-scope detection: changes to files not in plan.
- Evidence of under-tested capabilities or NFRs.
  </review_method>

<findings_format>
`[severity: major|minor|nit] <file>[:line] — <description>; fix: <action>`
</findings_format>

<remediation_phase>
If findings exist, append new phase to plan:

```
### Phase X: Code Review Remediation

- Goal: Address code review findings.
- Tasks:
  - [ ] <precise fix per finding>
- Acceptance criteria:
  - Must: All fixes implemented and validated.
  - Must: Updated tests pass.
- Files and modules: <paths>
- Completion signal: docs(plan): remediate review findings for <workItemRef>
```

Rules:

- X = max existing phase + 1.
- Do NOT modify earlier phases.
- Append revision log entry.
  </remediation_phase>

<commit_rules>

- If commit=true and not dryRun: stage plan file, create Conventional Commit via `/commit`.
- If commit=false: write only.
- Dry run: no write; include preview in output.
  </commit_rules>

<output>
1. Review Summary: pass/fail; changed files count; key themes.
2. Findings: one line per item.
3. Plan Update: "Added Phase X" OR "No plan changes required." OR dry-run preview.
4. Branch info: base, head, changeBranch.
5. Next action: suggest `/run-plan <workItemRef>` if remediation added.
</output>

<constraints>
- Only modify plan file; never touch spec or code.
- Never include `doc/changes/current` in paths.
- Idempotent: re-running yields no duplicate tasks.
- No external network calls.
</constraints>

<errors>
- Missing spec or plan: abort with message.
- Unable to derive slug or change.type: abort.
- Branch resolution failure: fallback to HEAD; note in summary.
- Empty diff: advisory; no remediation unless plan gaps found.
</errors>
