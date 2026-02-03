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

### Creating New Changes

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

Product decisions should be documented under:

```
doc/planning/product-decisions/YYYY-MM-DD-{short-kebab-slug}.md
```

Include: Context, Decision, Options, Drivers, Reasoning, Consequences.
