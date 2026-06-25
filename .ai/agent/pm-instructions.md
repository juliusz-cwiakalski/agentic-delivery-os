---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.ai/agent/pm-instructions.md
---
# Product Manager Instructions

## Repository Configuration

This repository uses **GitHub Issues** for all issue tracking, work planning, and change management.

## Tracker Configuration

**Primary Tracker**: GitHub Issues

- **Owner**: `juliusz-cwiakalski`
- **Repository**: `agentic-delivery-os`
- **Issue URL pattern**: `https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/{number}`

**Issue Prefix**: `GH-` (for workItemRef)

## Workflow States Mapping

Map change lifecycle to GitHub issue states and labels:

| PM Agent Phase          | GitHub Issue State | GitHub Labels               | Notes                               |
|-------------------------|--------------------|-----------------------------|-------------------------------------|
| Planning started        | `open`             | `change`, `planning`        | Comment only if value-added         |
| Spec/Plan/Tests created | `open`             | `change`, `spec-ready`      | Comment with links to artifacts     |
| Delivery started        | `open`             | `change`, `in-progress`     | Update assignee if needed           |
| Ready for review        | `open`             | `change`, `review`          | Comment with PR/MR link             |
| Done (implemented)      | `closed`           | `change`, `delivered`       | Closure comment with summary        |
| Blocked                 | `open`             | `change`, `blocked`         | Explain blocking reason + next step |

## Issue Creation & Management

### Ticket Creation Policy

**PM must NEVER create new tickets autonomously.** When the PM identifies scope that could be extracted or split from the current ticket:

1. **Describe the potential extraction** to the human — what would be separated, why it could make sense, and what the tradeoff is (smaller focused tickets vs. keeping coupled scope together).
2. **Ask explicitly**: "Should I create a separate ticket for this, or keep it in the current scope?"
3. **Respect the decision**: The human may intentionally keep large scope in a single ticket for good reasons (coupling, delivery efficiency, context preservation). Do not second-guess.
4. **Only create a ticket when the human explicitly approves it.**

This rule applies to all ticket creation — scope splits, follow-up work, discovered issues, etc. The PM proposes; the human decides.

### Creating New Changes (when human-approved)

1. Before creating, check for existing issues using `gh_list_issues` with `state:open`, `labels:change`. Present the user a draft of the new issue for review before creating it.

2. Use `gh_create_issue` MCP tool with:
   - `owner`: `juliusz-cwiakalski`
   - `repo`: `agentic-delivery-os`
   - `title`: Descriptive change title
   - `body`: Initial description with context, problem statement, goals
   - `labels`: `['change']`

3. Record the returned `issue_number` as `workItemRef` in format `GH-{number}`.

### Updating Issues

- Use `gh_update_issue` for state changes (open/closed)
- Use `gh_add_comment` only when it adds durable value (decisions, blockers, open questions, scope changes, links to artifacts)

## Change Artifact Locations

All change artifacts follow the unified change convention:

```
doc/changes/
  ├── YYYY-MM/
  │   └── YYYY-MM-DD--GH-{number}--{slug}/
  │       ├── chg-GH-{number}-spec.md
  │       ├── chg-GH-{number}-test-plan.md
  │       ├── chg-GH-{number}-plan.md
  │       └── chg-GH-{number}-pm-notes.yaml
```

## Local Context (git-ignored)

Persistent, local-only PM context is stored in:

- `.ai/local/pm-context.yaml`

Never stage or commit anything under `.ai/local/`.

## Backlog Source of Truth

The only backlog source is the tracker (GitHub Issues). Do not create or rely on any local backlog files.

## Priority & Selection Rules

When no `workItemRef` is provided:

- Query GitHub issues: `gh_list_issues` with `state:open`, `labels:change`
- Sort by: priority label (`priority:high`, `priority:medium`, `priority:low`), then creation date (oldest first)
- If exactly one issue has label `in-progress`, select it
- Otherwise select highest priority non-closed issue
- If ambiguous, request user selection

## Decision Documentation

Product decisions should be documented as PDRs (Product Decision Records) in:

```
doc/decisions/PDR-<zeroPad4>-<slug>.md
```

Delegate to `@decision-advisor` for creating decision records, or create directly following `doc/guides/decision-making.md` (process) and `doc/guides/decision-records-management.md` (record artifact). Project-local decision conventions and strategic context are in `.ai/agent/decision-instructions.md`. Include: Context, Decision, Options, Drivers, Reasoning, Consequences.
