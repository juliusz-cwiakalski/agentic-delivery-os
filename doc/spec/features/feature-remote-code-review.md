---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-remote-code-review.md

id: SPEC-REMOTE-CODE-REVIEW
status: Current
created: 2026-03-16
last_updated: 2026-03-16T12:00:00Z
owners: [Juliusz Ćwiąkalski]
service: delivery-os
links:
  related_changes: ["GH-36", "GH-39"]
summary: "Two agent/command pairs for remote code review and review-feedback application on GitHub and GitLab, with repository-local review guidance, draft generation, deduplication, three-tier feedback classification, and externalized platform access via pr-instructions.md."
---

# Feature: Remote Code Review and Review-Feedback Application

## Overview

ADOS provides two complementary workflows for interacting with remote PR/MR review systems:

1. **Remote code review** — the `code-reviewer` agent (`.opencode/agent/code-reviewer.md`) and `/review-remote` command (`.opencode/command/review-remote.md`) analyze an open PR/MR diff against repository-local review guidance and built-in heuristics. The agent produces structured findings, generates a review draft for preview, deduplicates against existing comments, and optionally publishes findings to the remote platform.

2. **Review feedback application** — the `review-feedback-applier` agent (`.opencode/agent/review-feedback-applier.md`) and `/apply-review-feedback` command (`.opencode/command/apply-review-feedback.md`) read review comments from an open PR/MR, classify each as accepted/rejected/ambiguous using a three-tier system, and apply accepted changes to local source files without committing or pushing.

Both workflows support GitHub (`gh`) and GitLab (`glab`) from v1. Platform access is externalized into `.ai/agent/pr-instructions.md` — a repository-local configuration file that maps abstract operations (fetch diff, publish comment, etc.) to concrete CLI commands. Each agent reads this file at startup and falls back to auto-detection from `git remote get-url origin` when it is absent. This mirrors the `pm-instructions.md` pattern for issue tracker access and keeps agent prompts platform-neutral. Both workflows are entirely separate from the existing `@reviewer` agent, which validates implementation against change specs and plans locally.

## Business Context

### Problem Statement

- **Problem:** ADOS lacked a workflow for reviewing open PRs/MRs against repository-specific rules and for applying accepted review feedback locally — forcing developers to manually read threads and implement changes.
- **Affected Users:** Developers and reviewers using ADOS for PR/MR-based workflows.
- **Business Impact:** Slower review cycles, inconsistent review quality, and manual toil when addressing feedback.

### Goals & Success Metrics

- **Primary Goal:** Enable AI-driven code review and automated feedback application for PR/MR workflows on both GitHub and GitLab.
- **KPIs:**
  - 2 agents (`code-reviewer`, `review-feedback-applier`) operational on both platforms.
  - 2 commands (`/review-remote`, `/apply-review-feedback`) invocable.
  - Re-running `/review-remote` on an unchanged PR/MR publishes zero duplicate comments.
  - Ambiguous feedback is never auto-applied.

## User Experience & Functionality

### Capabilities

- **Remote code review (F-1):** The `code-reviewer` agent fetches a PR/MR diff and metadata, analyzes it against review criteria, and produces structured findings with severity (critical/major/minor/nit) and confidence (high/medium/low).
- **Review feedback application (F-2):** The `review-feedback-applier` agent fetches review threads, classifies each comment, and applies accepted changes to local files.
- **Platform access via pr-instructions (F-3):** All three PR/MR-facing agents (`code-reviewer`, `review-feedback-applier`, `pr-manager`) read `.ai/agent/pr-instructions.md` for platform type, access method, and an Operations Reference table mapping every PR/MR operation to a concrete CLI command. When `pr-instructions.md` is absent, agents fall back to auto-detecting the platform from `git remote get-url origin` (GitHub vs GitLab), then to CLI auth status checks, and finally to manual override via `--github`/`--gitlab` flags.
- **Repository-local review configuration (F-4):** One optional file customizes review behavior:
  - `.ai/agent/code-review-instructions.md` — repository-local review guidance including priorities, checklist items, conventions, and special patterns.
  - When absent, the agent falls back to built-in general-purpose heuristics with no errors.
- **Review draft generation (F-5):** The `code-reviewer` generates a `review-draft.md` file locally before any publishing occurs. Publishing is a separate explicit action requiring user approval.
- **Finding deduplication (F-6):** Before publishing, the `code-reviewer` compares new findings against existing PR/MR comments by file path, line range, and semantic similarity. Duplicates are suppressed.
- **Three-tier feedback classification (F-7):**
  - **Explicit acceptance:** Comment contains an `AI-APPLY` marker (case-insensitive, standalone token) — always applied.
  - **Implicit acceptance:** Comment matches conservative agreement patterns ("agreed", "good point", "will fix", etc.) — applied with documented reasoning.
  - **Ambiguous:** No clear acceptance signal — never applied; listed in `skipped-items.md` for manual review.
- **Pre-flight safety checks (F-8):** Both commands verify clean working tree, valid git branch, platform CLI authentication, and an active PR/MR before proceeding.
- **Inline comment cap (F-9):** Maximum 30 inline comments per review run. Remaining findings are bundled into a summary comment.

### User Flows

```
Flow 1: Remote code review
  User runs /review-remote [--publish] [--pr N]
  → Load .ai/agent/pr-instructions.md (if present; else auto-detect platform)
  → Pre-flight checks (clean tree, auth, active PR/MR)
  → Fetch diff + metadata + existing comments (via Operations Reference)
  → Load .ai/agent/code-review-instructions.md (if present)
  → Analyze diff → produce findings
  → Generate review-draft.md
  → Deduplicate against existing comments
  → Dry-run (default): display summary, STOP
  → --publish: ask user to confirm → publish inline + summary comments

Flow 2: Apply review feedback
  User runs /apply-review-feedback [--pr N]
  → Load .ai/agent/pr-instructions.md (if present; else auto-detect platform)
  → Pre-flight checks (clean tree, auth, active PR/MR)
  → Fetch all review threads (via Operations Reference)
  → Classify each: explicit-accept / implicit-accept / rejected / ambiguous
  → Generate classification-report.md
  → Apply accepted changes to local files
  → Generate applied-changes.json + skipped-items.md
  → Remind user to review, commit, and push manually
```

### Edge Cases & Error Handling

- **Dirty working tree:** Both commands stop immediately with a message advising to commit or stash.
- **No open PR/MR:** Both commands stop with a clear message.
- **Missing platform CLI or auth:** Stop with actionable message.
- **No repository-local config:** Graceful fallback to built-in heuristics.
- **Failed inline positioning:** Finding included in summary comment with file:line reference.
- **Change cannot be applied:** Skipped and documented in `skipped-items.md`.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `.opencode/agent/code-reviewer.md` | Code reviewer agent | Analyze PR/MR diff, produce findings, generate draft, deduplicate, publish |
| `.opencode/agent/review-feedback-applier.md` | Review feedback applier agent | Fetch threads, classify feedback, apply accepted changes locally |
| `.opencode/command/review-remote.md` | Review remote command | Thin entry point delegating to `code-reviewer` agent |
| `.opencode/command/apply-review-feedback.md` | Apply review feedback command | Thin entry point delegating to `review-feedback-applier` agent |
| `.ai/agent/pr-instructions.md` | PR/MR platform instructions | Repository-local platform config with Operations Reference table; read by `code-reviewer`, `review-feedback-applier`, and `pr-manager` |
| `.ai/agent/code-review-instructions.md` | Review guidance | Optional repository-local review guidance (priorities, checklist, conventions, patterns) |

### State Persistence

Both agents persist ephemeral state under `tmp/` following `@pr-manager` `branchPath` conventions:

**Code reviewer** (`tmp/code-review/<branchPath>/`):

| File | Purpose |
|------|---------|
| `context.json` | PR/MR metadata (platform, number, branch, base, title, author) |
| `diff.patch` | Full diff of the PR/MR |
| `comments-snapshot.json` | Existing PR/MR comments (for deduplication) |
| `review-draft.md` | Human-readable review draft for preview |
| `findings.json` | Structured findings with severity, file, line, description, fix |
| `publish-report.json` | Results of publishing (comment URLs, errors) |

**Review feedback applier** (`tmp/review-feedback/<branchPath>/`):

| File | Purpose |
|------|---------|
| `threads-snapshot.json` | Raw review threads/comments from PR/MR |
| `classification-report.md` | Classification results: accepted, rejected, ambiguous |
| `applied-changes.json` | Log of changes applied from accepted feedback |
| `skipped-items.md` | Items not applied (ambiguous + failed) for manual review |

`branchPath` sanitization: replace non-`[A-Za-z0-9._/-]` with `_`, replace `..` with `__`, trim leading `/`.

### AI-APPLY Marker Specification

The `AI-APPLY` marker is an explicit acceptance signal for review feedback:

- **Format:** The string `AI-APPLY` (case-insensitive) appearing as a standalone token.
- **Detection regex:** `(?<![A-Za-z0-9_-])(?i:AI-APPLY)(?![A-Za-z0-9_-])`
- **Scope:** Applies to the entire comment thread.
- **Examples:** "AI-APPLY", "Good catch, AI-APPLY this", "ai-apply"
- **Invalid:** "AI-APPLYED", "NOAI-APPLY" (not standalone)

### Platform Access Layer

Platform access is externalized into `.ai/agent/pr-instructions.md`, which defines:

- **Platform type** (GitHub, GitLab, etc.)
- **Access method** (CLI tool, MCP server, etc.)
- **Operations Reference table** — maps abstract operation names to concrete CLI commands

Agents reference this table for every PR/MR operation (fetch diff, list PRs, publish comment, etc.) rather than embedding platform-specific commands in their prompts. This separates WHAT the agent does from HOW it accesses the platform.

A template (`doc/templates/pr-instructions-template.md`) covers four integration types: GitHub CLI, GitLab CLI, GitHub MCP, and Azure DevOps MCP. A guide (`doc/guides/pr-platform-integration.md`) documents setup for each.

**Fallback behavior:** When `pr-instructions.md` is absent, agents fall back to auto-detection:

| Platform | CLI | PR/MR listing | Diff fetch | Comments fetch | Publish |
|----------|-----|---------------|------------|----------------|---------|
| GitHub | `gh` | `gh pr list --head <branch> --state open --json ...` | `gh pr diff <N>` | `gh api repos/{owner}/{repo}/pulls/<N>/comments` | `gh pr comment`, `gh api .../reviews` |
| GitLab | `glab` | `glab mr list --source-branch <branch> --output json` | `glab mr diff <IID>` | `glab api projects/:id/merge_requests/<IID>/discussions` | `glab mr note`, `glab api .../discussions` |

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Platform parity | Both agents produce equivalent behavior on GitHub and GitLab | Same finding format, same classification logic |
| NFR-2 | Read-only guarantee | `/review-remote` makes zero modifications to source code files | `git status --porcelain` unchanged after review |
| NFR-3 | Feedback safety | `/apply-review-feedback` never auto-commits or auto-pushes | Local changes only |
| NFR-4 | Deduplication | Re-running `/review-remote` on unchanged PR/MR publishes zero new comments | Zero duplicates |
| NFR-5 | Ambiguity safety | Ambiguous feedback items are never auto-applied | Listed in `skipped-items.md` only |
| NFR-6 | Graceful degradation | Both agents function when `.ai/agent/code-review-instructions.md` is absent | Built-in heuristics used |
| NFR-7 | State isolation | Review artifacts for different branches are isolated under separate `<branchPath>/` directories | No cross-contamination |
| NFR-8 | Platform config fallback | All three PR/MR-facing agents function when `.ai/agent/pr-instructions.md` is absent | Auto-detection from `git remote get-url origin` |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Structural | Agent prompt content validation | Verify agents contain required sections: platform detection, pre-flight, CLI references, state paths |
| Structural | Command delegation verification | Verify commands contain `agent:` and `subtask: true` in frontmatter |
| Structural | Config file validation | Verify `.ai/agent/code-review-instructions.md` contains review guidance (priorities, checklist items, conventions) |
| Manual | End-to-end review workflow | Run `/review-remote` on a branch with an open PR; verify draft generation and optional publishing |
| Manual | End-to-end feedback workflow | Run `/apply-review-feedback` on a PR with review comments; verify classification and application |
| Manual | Existing reviewer preservation | `git diff main -- .opencode/agent/reviewer.md` returns empty |

## Operational & Support

### Configuration

- **PR/MR platform instructions:** `.ai/agent/pr-instructions.md` — repository-local platform config with Operations Reference table. Generated by `@bootstrapper` or copied from `doc/templates/pr-instructions-template.md`. When absent, agents auto-detect platform from `git remote get-url origin`.
- **Review guidance:** `.ai/agent/code-review-instructions.md` — optional, human-authored, repository-specific priorities, checklist items, conventions, and patterns.
- **State directories:** `tmp/code-review/` and `tmp/review-feedback/` — git-ignored, ephemeral, no automated cleanup required.
- **Agent models:** Both agents use `anthropic/claude-opus-4-6`.

## Dependencies & Risks

- **Depends on (config):** `.ai/agent/pr-instructions.md` for platform access commands (optional — agents fall back to auto-detection when absent).
- **Depends on (pattern):** `@pr-manager` agent for `branchPath` sanitization and `tmp/` conventions (pattern reuse, not code dependency).
- **Depends on (tool):** `gh` CLI for GitHub operations; `glab` CLI for GitLab operations.
- **Does not affect:** `@reviewer` agent (existing local review agent is unchanged).
- **Risk:** Large PRs may produce many findings — mitigated by 30-inline-comment cap and severity prioritization.
- **Risk:** Fuzzy acceptance detection may produce false positives — mitigated by conservative classification patterns and no auto-commit.

## Related Documentation

- **Code reviewer agent:** `.opencode/agent/code-reviewer.md`
- **Review feedback applier agent:** `.opencode/agent/review-feedback-applier.md`
- **Review remote command:** `.opencode/command/review-remote.md`
- **Apply review feedback command:** `.opencode/command/apply-review-feedback.md`
- **PR/MR platform instructions:** `.ai/agent/pr-instructions.md`
- **PR/MR platform instructions template:** `doc/templates/pr-instructions-template.md`
- **PR/MR platform integration guide:** [doc/guides/pr-platform-integration.md](../../guides/pr-platform-integration.md)
- **Review guidance:** `.ai/agent/code-review-instructions.md`
- **Agent inventory:** [.opencode/README.md](../../../.opencode/README.md)
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md)
