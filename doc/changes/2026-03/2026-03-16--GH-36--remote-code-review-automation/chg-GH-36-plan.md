---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-16--GH-36--remote-code-review-automation/chg-GH-36-plan.md
id: chg-GH-36-remote-code-review-automation
status: Implemented
created: 2026-03-16T00:00:00Z
last_updated: 2026-03-16T00:00:00Z
owners: [juliusz-cwiakalski]
service: delivery-os
labels: [code-review, automation, multi-platform, developer-experience]
links:
  change_spec: ./chg-GH-36-spec.md
summary: >
  Add two new ADOS agents (code-reviewer, review-feedback-applier) and two new commands
  (/review-remote, /apply-review-feedback) for remote code review generation and review-feedback
  application, with first-class support for both GitHub and GitLab platforms.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-36: Remote code review and review-feedback automation

## Context and Goals

This plan delivers two new agent/command pairs that extend ADOS into the remote review domain:

1. **Remote code review** — `code-reviewer` agent + `/review-remote` command: reads an active PR/MR, analyzes the diff against repository-local checklists and instructions, produces structured findings, and optionally publishes them to the remote platform.
2. **Review feedback application** — `review-feedback-applier` agent + `/apply-review-feedback` command: reads review comments from a PR/MR, classifies feedback as accepted/rejected/ambiguous, and applies accepted changes locally.

Both workflows reuse `@pr-manager` patterns (platform detection, branchPath sanitization, `tmp/` conventions) and support GitHub (`gh`) and GitLab (`glab`) from v1.

**Nature of this change:** All deliverables are agent prompts (`.opencode/agent/*.md`), command definitions (`.opencode/command/*.md`), and documentation updates. There is NO application code.

**Resolved open questions from spec:**

- **OQ-1**: Support both self-review and others' PRs — the user decides when to invoke. (Resolved)
- **OQ-2**: `AI-APPLY` markers are case-insensitive, standalone tokens. (Resolved)
- **OQ-3**: Confidence scores per finding — Resolved: include high/medium/low confidence per finding (DEC-8)
- **OQ-4**: Maximum inline comments per review — Resolved: cap at 30 inline comments, bundle overflow into summary (DEC-9)

**Delegation:** Agent and command creation MUST be delegated to `@toolsmith` per AGENTS.md extension guidance.

## Scope

### In Scope

- New agent: `code-reviewer` (F-1, F-5, F-6, F-7, F-8, F-10, F-11)
- New agent: `review-feedback-applier` (F-2, F-9, F-10, F-11)
- New command: `/review-remote` (F-3)
- New command: `/apply-review-feedback` (F-4)
- Repository-local review configuration: `.ai/checklists/code-review.md`, `.ai/agent/code-review-instructions.md` (F-6)
- Documentation updates: `.opencode/README.md`, `AGENTS.md` (F-12)

### Out of Scope

- Auto-merge, auto-approve, or auto-close PRs/MRs (NG-1)
- Auto-commit or auto-push applied changes by default (NG-2)
- Azure DevOps adapter implementation (NG-3)
- Autonomous reviewer conversations across threads (NG-4)
- Changing existing `@reviewer` agent behavior (NG-5)
- Automatic creation of work items from review findings (NG-6)

### Constraints

- All deliverables are agent prompts and documentation — no application code
- Agent and command creation must be delegated to `@toolsmith` per AGENTS.md
- Existing `@reviewer` agent must remain unmodified (G-5, AC-F5-1)
- Platform detection must mirror `@pr-manager` proven patterns (DEC-4)
- License headers must be applied to all new files via `scripts/add-header-location.sh`

### Risks

- **RSK-1 (Large scope)**: 2 agents + 2 commands + config + docs. Mitigated by phased delivery where each phase is independently testable.
- **RSK-2 (Platform CLI differences)**: Mitigated by mirroring `@pr-manager` patterns for platform detection and CLI usage.
- **RSK-3 (Diff position mapping)**: Mitigated by fallback to review-level comments when inline positioning fails.
- **RSK-4 (Fuzzy acceptance false positives)**: Mitigated by conservative classification — ambiguous items never auto-applied.

### Success Metrics

- 2 agents (`code-reviewer`, `review-feedback-applier`) operational on both GitHub and GitLab
- 2 commands (`/review-remote`, `/apply-review-feedback`) invocable
- Platform detection mirrors `@pr-manager` — auto-detects from `git remote get-url origin`
- Zero modifications to `.opencode/agent/reviewer.md`
- Review deduplication: re-running on unchanged PR/MR publishes zero new comments
- Ambiguous feedback items never auto-applied

## Phases

### Phase 1: Remote code review agent and command

**Goal**: Create the `code-reviewer` agent and `/review-remote` command — the complete remote code review workflow including platform detection, checklist loading, draft generation, deduplication, and publishing. Delegate to `@toolsmith`.

**Tasks**:

- [x] **1.1** Consult `@architect` on open questions OQ-3 (confidence scores per finding) and OQ-4 (maximum inline comments per review). Document decisions in spec decision log. (OQ-3: high/medium/low confidence per finding → DEC-8; OQ-4: cap 30 inline comments → DEC-9; both recorded in spec)
- [x] **1.2** Create `.opencode/agent/code-reviewer.md` via `@toolsmith` — the remote code review agent. (Created with all required sections: platform detection, pre-flight, PR/MR resolution, diff/metadata fetching via gh/glab, config loading with graceful fallback, structured findings, review-draft generation, deduplication, publishing with 30-comment cap, branchPath sanitization, read-only guarantee, built-in heuristics) Must include:
  - Platform detection mirroring `@pr-manager` patterns (`git remote get-url origin`, fallback to `gh auth status`/`glab auth status`, override via `--github`/`--gitlab`)
  - Pre-flight safety checks: clean working tree, git repo with branch, platform CLI available and authenticated, active PR/MR exists
  - PR/MR resolution: auto-detect from current branch or accept explicit ID
  - Diff and metadata fetching via `gh` (GitHub) and `glab` (GitLab) with JSON output modes
  - Repository-local config loading: `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md` (graceful fallback when absent)
  - Structured finding format: severity, file path, line reference, description, suggested fix
  - Review draft generation at `tmp/code-review/<branchPath>/review-draft.md` before any publishing
  - Finding deduplication against existing PR/MR comments (file path, line range, semantic similarity)
  - Publishing: inline comments at diff positions (with fallback to review-level) and summary comment
  - Dry-run by default — publishing is an explicit user-approved action
  - State persistence at `tmp/code-review/<branchPath>/`: `context.json`, `diff.patch`, `comments-snapshot.json`, `review-draft.md`, `findings.json`, `publish-report.json`
  - branchPath sanitization matching `@pr-manager` convention
  - CLI reference sections for both `gh` and `glab` (pattern, not full scripts)
  - Read-only guarantee: zero modifications to source code files in the working tree
  - Built-in general-purpose review heuristics when no repo-local config present
- [x] **1.3** Create `.opencode/command/review-remote.md` via `@toolsmith` — thin command entry point. (Created with agent: code-reviewer, subtask: true, optional args: --github/--gitlab, --pr/--mr, --publish/--dry-run, user invocation examples) Must:
  - Accept optional arguments: platform override (`--github`/`--gitlab`), dry-run/publish flag, PR/MR number
  - Delegate to `code-reviewer` agent
  - Use `subtask: true` pattern (like `/review` command)
  - Include user invocation examples
- [x] **1.4** Create `.ai/checklists/code-review.md` — the repository-local review checklist for ADOS itself. (Created with 31 checkbox items across 7 categories: prompt quality, naming, security, error handling, documentation, testing, consistency)
- [x] **1.5** Create `.ai/agent/code-review-instructions.md` — repository-local review instructions for ADOS. (Created with repo context, review priorities, what to ignore, and special patterns sections)

**Acceptance Criteria**:

- Must: AC-F1-1 — `code-reviewer` agent fetches PR diff and metadata via `gh` and produces structured findings
- Must: AC-F1-2 — `code-reviewer` agent fetches MR diff and metadata via `glab` and produces structured findings
- Must: AC-F3-1 — `/review-remote` command delegates to `code-reviewer` agent and accepts optional arguments
- Must: AC-F6-1 — Agent loads `.ai/checklists/code-review.md` when present
- Must: AC-F6-2 — Agent falls back to built-in heuristics when checklist absent (no errors)
- Must: AC-F6-3 — Agent loads `.ai/agent/code-review-instructions.md` when present
- Must: AC-F7-1 — Review draft written to `tmp/code-review/<branchPath>/review-draft.md` before publishing
- Must: AC-F8-1 — Re-running on unchanged PR/MR publishes zero duplicate comments
- Must: AC-F10-1 — Dirty working tree stops the command with a clear message
- Must: AC-F10-2 — Zero source code files modified in the working tree after review

**Files and modules**:

- `.opencode/agent/code-reviewer.md` (new — via @toolsmith)
- `.opencode/command/review-remote.md` (new — via @toolsmith)
- `.ai/checklists/code-review.md` (new)
- `.ai/agent/code-review-instructions.md` (new)

**Tests**:

- `.opencode/agent/code-reviewer.md` exists and contains: platform detection, pre-flight, review-draft, deduplication, branchPath, `tmp/code-review/`
- `.opencode/agent/code-reviewer.md` references both `gh` and `glab` CLI tools
- `.opencode/agent/code-reviewer.md` references `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md` with graceful fallback
- `.opencode/command/review-remote.md` exists and delegates to `code-reviewer` agent
- `.opencode/command/review-remote.md` contains `subtask: true` in frontmatter
- `.ai/checklists/code-review.md` exists with checkbox items
- `.ai/agent/code-review-instructions.md` exists with free-form instructions

**Completion signal**: `feat(GH-36): add code-reviewer agent and /review-remote command`

---

### Phase 2: Review feedback applier agent and command

**Goal**: Create the `review-feedback-applier` agent and `/apply-review-feedback` command — the complete feedback classification and application workflow. Delegate to `@toolsmith`.

**Tasks**:

- [x] **2.1** Create `.opencode/agent/review-feedback-applier.md` via `@toolsmith` — the review feedback application agent. (Created with all required sections: platform detection, pre-flight, PR/MR resolution, thread fetching via gh/glab, three-tier classification with AI-APPLY marker, classification report, local file modification, applied-changes.json, skipped-items.md, no auto-commit/push, branchPath sanitization) Must include:
  - Platform detection mirroring `@pr-manager` patterns (same as `code-reviewer`)
  - Pre-flight safety checks: clean working tree, git repo with branch, platform CLI available and authenticated, active PR/MR exists
  - PR/MR resolution: auto-detect from current branch or accept explicit ID
  - Review thread/comment fetching via `gh` and `glab` with JSON output modes
  - Three-tier feedback classification:
    - Explicit acceptance: `AI-APPLY` marker (case-insensitive, standalone token — not substring)
    - Implicit acceptance: conservative fuzzy patterns ("agreed", "good point", "will fix", "done", "fixed", etc.)
    - Ambiguous: everything else — never auto-applied
  - Classification report at `tmp/review-feedback/<branchPath>/classification-report.md`
  - Local file modification for accepted items (reads surrounding code context, not just comment text)
  - Applied changes log at `tmp/review-feedback/<branchPath>/applied-changes.json`
  - Skipped items report at `tmp/review-feedback/<branchPath>/skipped-items.md`
  - No auto-commit, no auto-push (DEC-5, NFR-3)
  - State persistence at `tmp/review-feedback/<branchPath>/`: `threads-snapshot.json`, `classification-report.md`, `applied-changes.json`, `skipped-items.md`
  - branchPath sanitization matching `@pr-manager` convention
  - CLI reference sections for both `gh` and `glab`
  - Safety: ambiguous feedback is never auto-applied (DEC-7, NFR-5)
- [x] **2.2** Create `.opencode/command/apply-review-feedback.md` via `@toolsmith` — thin command entry point. (Created with agent: review-feedback-applier, subtask: true, optional args: --github/--gitlab, --pr/--mr, user invocation examples) Must:
  - Accept optional arguments: platform override (`--github`/`--gitlab`), PR/MR number
  - Delegate to `review-feedback-applier` agent
  - Use `subtask: true` pattern
  - Include user invocation examples
- [x] **2.3** Verify existing `@reviewer` agent (`.opencode/agent/reviewer.md`) is unmodified — zero changes, confirming AC-F5-1. (Hash: 744163ac49f1ede72ec832fb8fcac90d3cd52efa; git diff main -- .opencode/agent/reviewer.md returns empty)

**Acceptance Criteria**:

- Must: AC-F2-1 — `review-feedback-applier` agent fetches all PR/MR threads and classifies each as accepted/rejected/ambiguous
- Must: AC-F4-1 — `/apply-review-feedback` command delegates to `review-feedback-applier` agent
- Must: AC-F9-1 — Comment with `AI-APPLY` marker classified as "explicitly accepted" and applied
- Must: AC-F9-2 — Comment with clear agreement language classified as "implicitly accepted" with documented reasoning
- Must: AC-F9-3 — Ambiguous comment classified as "ambiguous" and listed in `skipped-items.md` without being applied
- Must: AC-F10-1 — Dirty working tree stops the command with a clear message
- Must: AC-F10-3 — No git commit or push made automatically
- Must: AC-F5-1 — `.opencode/agent/reviewer.md` is identical before and after this change

**Files and modules**:

- `.opencode/agent/review-feedback-applier.md` (new — via @toolsmith)
- `.opencode/command/apply-review-feedback.md` (new — via @toolsmith)
- `.opencode/agent/reviewer.md` (verified unchanged)

**Tests**:

- `.opencode/agent/review-feedback-applier.md` exists and contains: `AI-APPLY`, classification, platform detection, pre-flight, branchPath, `tmp/review-feedback/`
- `.opencode/agent/review-feedback-applier.md` references both `gh` and `glab` CLI tools
- `.opencode/agent/review-feedback-applier.md` contains three-tier classification: explicit, implicit, ambiguous
- `.opencode/command/apply-review-feedback.md` exists and delegates to `review-feedback-applier` agent
- `.opencode/command/apply-review-feedback.md` contains `subtask: true` in frontmatter
- `.opencode/agent/reviewer.md` has zero modifications (diff against main branch or prior commit)

**Completion signal**: `feat(GH-36): add review-feedback-applier agent and /apply-review-feedback command`

---

### Phase 3: Documentation updates and final validation

**Goal**: Update `.opencode/README.md` and `AGENTS.md` inventories, apply license headers, and validate all acceptance criteria with evidence.

**Tasks**:

- [x] **3.1** Update `.opencode/README.md` — add new entries: (Added code-reviewer + review-feedback-applier in Agents; /apply-review-feedback + /review-remote in Commands; all alphabetically ordered)
  - Agents section: add `code-reviewer` and `review-feedback-applier` (alphabetical order)
  - Commands section: add `/review-remote` and `/apply-review-feedback` (alphabetical order)
- [x] **3.2** Update `AGENTS.md` — add new entries: (Added code-reviewer + review-feedback-applier under Verification subsection; /apply-review-feedback + /review-remote in commands table)
  - Agent team section: add `code-reviewer` and `review-feedback-applier` under a new "Verification" subsection (alongside existing `reviewer`, `fixer`, `runner`) or appropriate existing subsection
  - Commands table: add `/review-remote` and `/apply-review-feedback`
- [x] **3.3** Run `scripts/add-header-location.sh` on all new files to add license headers: (All 6 files processed, 6 updated with 3-line YAML frontmatter)
  - `.opencode/agent/code-reviewer.md`
  - `.opencode/agent/review-feedback-applier.md`
  - `.opencode/command/review-remote.md`
  - `.opencode/command/apply-review-feedback.md`
  - `.ai/checklists/code-review.md`
  - `.ai/agent/code-review-instructions.md`
- [x] **3.4** Final validation — confirm all acceptance criteria with evidence:
  - AC-F1-1/AC-F1-2: `code-reviewer` agent contains `gh` and `glab` CLI references
  - AC-F2-1: `review-feedback-applier` agent contains thread fetching and classification logic
  - AC-F3-1: `/review-remote` command delegates to `code-reviewer`
  - AC-F4-1: `/apply-review-feedback` command delegates to `review-feedback-applier`
  - AC-F5-1: `reviewer.md` unchanged (git diff confirms zero modifications)
  - AC-F6-1/AC-F6-2/AC-F6-3: `code-reviewer` references config files with graceful fallback
  - AC-F7-1: `code-reviewer` references `review-draft.md` generation before publishing
  - AC-F8-1: `code-reviewer` contains deduplication logic
  - AC-F9-1/AC-F9-2/AC-F9-3: `review-feedback-applier` contains three-tier classification
  - AC-F10-1: Both agents contain pre-flight dirty tree check
  - AC-F10-2: `code-reviewer` contains read-only guarantee
  - AC-F10-3: `review-feedback-applier` contains no-commit/no-push constraint
  - AC-F12-1: `.opencode/README.md` lists both new agents and commands
  - AC-F12-2: `AGENTS.md` lists both new agents and commands

**Acceptance Criteria**:

- Must: AC-F12-1 — `.opencode/README.md` lists `code-reviewer` and `review-feedback-applier` in Agents and `/review-remote` and `/apply-review-feedback` in Commands
- Must: AC-F12-2 — `AGENTS.md` lists both new agents in agent team and both new commands in commands table
- Must: All new files have license headers (3-line YAML frontmatter or comment block)
- Must: All AC-F* criteria from spec validated with evidence

**Files and modules**:

- `.opencode/README.md` (updated — inventory)
- `AGENTS.md` (updated — inventory)
- All files from Phase 1 and Phase 2 (license header application)

**Tests**:

- `.opencode/README.md` contains `code-reviewer` and `review-feedback-applier` in Agents section
- `.opencode/README.md` contains `/review-remote` and `/apply-review-feedback` in Commands section
- `AGENTS.md` contains `code-reviewer` and `review-feedback-applier` in agent team
- `AGENTS.md` contains `/review-remote` and `/apply-review-feedback` in commands table
- All new `.md` files contain `Copyright` or `MIT License` in first 5 lines
- `git diff main -- .opencode/agent/reviewer.md` returns empty (zero modifications)

**Completion signal**: `docs(GH-36): update inventories and apply license headers`

### Phase 4: PR/MR platform instructions extraction (from GH-39)

**Goal**: Extract hardcoded platform detection logic and CLI commands from `@pr-manager`, `@code-reviewer`, and `@review-feedback-applier` into a repo-local `.ai/agent/pr-instructions.md` file — mirroring the pattern of `.ai/agent/pm-instructions.md` for issue tracker access. Create supporting docs and update the bootstrapper.

**Tasks**:

- [x] **4.1** Create `.ai/agent/pr-instructions.md` for ADOS — the repo-local PR/MR platform configuration for this repo (GitHub, CLI via `gh`). (Created with platform type, access method, host, auth, and 14-row Operations Reference table covering all PR/MR operations)

- [x] **4.2** Create `doc/templates/pr-instructions-template.md` — a template that other repos can copy. (Created with 4 commented-out platform sections: GitHub CLI, GitLab CLI, GitHub MCP, Azure DevOps MCP; each with full Operations Reference table)

- [x] **4.3** Refactor `.opencode/agent/code-reviewer.md` — replaced `<platform_detection>` with `<platform_access>` referencing `pr-instructions.md`, refactored steps 2/3/4/10 to use Operations Reference table, added graceful fallback to auto-detection when `pr-instructions.md` absent.

- [x] **4.4** Refactor `.opencode/agent/review-feedback-applier.md` — replaced `<platform_detection>` with `<platform_access>` referencing `pr-instructions.md`, refactored steps 2/3/4 to use Operations Reference table, added graceful fallback.

- [x] **4.5** Refactor `.opencode/agent/pr-manager.md` — replaced `<platform_detection>` with `<platform_access>`, refactored steps 4/5/9 and `<cli_reference>` to use Operations Reference from `pr-instructions.md`, preserved helper patterns and robustness rules, added graceful fallback.

- [x] **4.6** Create `doc/guides/pr-platform-integration.md` — guide with 4 integration types (GitHub CLI, GitLab CLI, GitHub MCP, Azure DevOps MCP), decision flowchart, setup instructions, and relationship to other config files.

- [x] **4.7** Update `.opencode/agent/bootstrapper.md` — added PR/MR platform to interview questions, `pr_instructions` to state schema and confidence scores, `pr-instructions.md` as mandatory artifact #3 in Phase 4, `pr_platform_discovery` section, and path to write allowlist.

- [x] **4.8** Update `AGENTS.md` (repo structure, key references), `.opencode/README.md` (PR/MR platform config convention), `doc/documentation-handbook.md` (.ai/agent/ description, template index), `doc/templates/README.md` (template table).

- [x] **4.9** Run `scripts/add-header-location.sh` on all 3 new files (pr-instructions.md, pr-instructions-template.md, pr-platform-integration.md) — all updated with 3-line YAML frontmatter.

- [x] **4.10** Update the spec (`chg-GH-36-spec.md`) — added F-13 through F-17, AC-F13-1 through AC-F17-1, DEC-10 through DEC-12, updated affected components and document history.

**Acceptance Criteria**:

- Must: `.ai/agent/pr-instructions.md` exists with Operations Reference table covering all PR/MR operations
- Must: `doc/templates/pr-instructions-template.md` exists with multi-platform examples
- Must: `code-reviewer`, `review-feedback-applier`, and `pr-manager` agents reference `pr-instructions.md` with graceful fallback
- Must: All three agents preserve their existing workflow logic (WHAT) while delegating platform access (HOW) to `pr-instructions.md`
- Must: Graceful fallback — when `pr-instructions.md` is missing, agents fall back to auto-detection from `git remote get-url origin`
- Must: `doc/guides/pr-platform-integration.md` exists documenting supported integration types
- Must: `bootstrapper.md` includes PR/MR platform in interview and artifact generation
- Must: `AGENTS.md`, `.opencode/README.md`, `doc/documentation-handbook.md` updated where needed
- Must: All new files have license headers
- Must: Spec updated with GH-39 scope

**Files and modules**:

- `.ai/agent/pr-instructions.md` (new)
- `doc/templates/pr-instructions-template.md` (new)
- `doc/guides/pr-platform-integration.md` (new)
- `.opencode/agent/code-reviewer.md` (refactored)
- `.opencode/agent/review-feedback-applier.md` (refactored)
- `.opencode/agent/pr-manager.md` (refactored)
- `.opencode/agent/bootstrapper.md` (updated)
- `AGENTS.md` (updated)
- `.opencode/README.md` (updated)
- `doc/documentation-handbook.md` (updated if needed)
- `chg-GH-36-spec.md` (updated)

**Completion signal**: `feat(GH-36): extract platform instructions into pr-instructions.md (GH-39)`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | Code-reviewer agent GitHub support | 1 | AC-F1-1 |
| TS-2 | Code-reviewer agent GitLab support | 1 | AC-F1-2 |
| TS-3 | /review-remote command delegation | 1 | AC-F3-1 |
| TS-4 | Checklist loading when present | 1 | AC-F6-1 |
| TS-5 | Graceful fallback without checklist | 1 | AC-F6-2 |
| TS-6 | Instructions loading when present | 1 | AC-F6-3 |
| TS-7 | Review draft generation before publish | 1 | AC-F7-1 |
| TS-8 | Finding deduplication on re-run | 1 | AC-F8-1 |
| TS-9 | Feedback-applier thread classification | 2 | AC-F2-1 |
| TS-10 | /apply-review-feedback delegation | 2 | AC-F4-1 |
| TS-11 | AI-APPLY explicit acceptance | 2 | AC-F9-1 |
| TS-12 | Implicit acceptance classification | 2 | AC-F9-2 |
| TS-13 | Ambiguous feedback not applied | 2 | AC-F9-3 |
| TS-14 | Dirty tree blocks both commands | 1, 2 | AC-F10-1 |
| TS-15 | Review read-only guarantee | 1 | AC-F10-2 |
| TS-16 | Feedback no auto-commit/push | 2 | AC-F10-3 |
| TS-17 | Existing reviewer unchanged | 2 | AC-F5-1 |
| TS-18 | README inventory updated | 3 | AC-F12-1 |
| TS-19 | AGENTS.md inventory updated | 3 | AC-F12-2 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-36-spec.md` | Spec |
| Code-reviewer agent | `.opencode/agent/code-reviewer.md` | New |
| Review-feedback-applier agent | `.opencode/agent/review-feedback-applier.md` | New |
| /review-remote command | `.opencode/command/review-remote.md` | New |
| /apply-review-feedback command | `.opencode/command/apply-review-feedback.md` | New |
| Code review checklist | `.ai/checklists/code-review.md` | New |
| Code review instructions | `.ai/agent/code-review-instructions.md` | New |
| OpenCode README | `.opencode/README.md` | Updated |
| AGENTS.md | `AGENTS.md` | Updated |
| Existing reviewer agent | `.opencode/agent/reviewer.md` | Verified unchanged |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-16 | plan-writer | Initial plan — 3 phases: review agent+command, feedback agent+command, docs+validation |
| 1.1 | 2026-03-16 | coder | Added Phase 4: PR/MR platform instructions extraction (GH-39 scope merged into GH-36) |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | DONE | 2026-03-16 | 2026-03-16 | f140d1f | Created code-reviewer agent, /review-remote command, code-review checklist, code-review-instructions. OQ-3/OQ-4 resolved as DEC-8/DEC-9. |
| 2 | DONE | 2026-03-16 | 2026-03-16 | f140d1f | Created review-feedback-applier agent, /apply-review-feedback command. reviewer.md verified unchanged (hash 744163ac). |
| 3 | DONE | 2026-03-16 | 2026-03-16 | f140d1f | Updated .opencode/README.md and AGENTS.md inventories, applied license headers to all 6 new files, all AC validated. |
| 4 | DONE | 2026-03-16 | 2026-03-16 | 11da621 | GH-39 scope: created pr-instructions.md, template, guide; refactored 3 agents; updated bootstrapper, AGENTS.md, README, handbook, spec. |
