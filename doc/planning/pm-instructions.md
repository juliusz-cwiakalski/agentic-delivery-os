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

| PM Agent Phase          | GitHub Issue State | GitHub Labels               | Notes                                                                 |
|-------------------------|--------------------|-----------------------------|-----------------------------------------------------------------------|
| Planning started        | `open`             | `change`, `planning`        | Add comment with planning summary                                     |
| Spec/Plan/Tests created | `open`             | `change`, `spec-ready`      | Add comment with links to artifacts                                   |
| Delivery started        | `open`             | `change`, `in-progress`     | Update assignee if needed                                             |
| Ready for review        | `open`             | `change`, `review`          | Create PR/MR link in comment                                          |
| Done (implemented)      | `closed`           | `change`, `delivered`       | Add closure comment with summary                                      |
| Blocked                | `open`             | `change`, `blocked`         | Explain blocking reason                                               |

## Issue Creation & Management

### Creating New Changes
1. Use `gh_create_issue` MCP tool with:
   - `owner`: `juliusz-cwiakalski`
   - `repo`: `agentic-delivery-os`
   - `title`: Descriptive change title
   - `body`: Initial description with context, problem statement, goals
   - `labels`: `["change"]`

2. Record the returned `issue_number` as `workItemRef` in format `GH-{number}`

### Updating Issues
- Use `gh_update_issue` for state changes (open/closed)
- Use `gh_add_comment` for milestone updates
- Always include relevant links to artifacts in comments

## Change Artifact Locations

All change artifacts follow the unified change convention:

```
doc/changes/
  ├── YYYY-MM/
  │   └── YYYY-MM-DD--GH-{number}--{slug}/
  │       ├── chg-GH-{number}-spec.md
  │       ├── chg-GH-{number}-plan.md
  │       └── chg-GH-{number}-test-plan.md
  └── current/ (symlinks to active change)
```

## Product Backlog & Planning

### Primary Inputs
- `doc/planning/product-backlog.md` (if exists)
- `doc/planning/mvp-user-stories.md` (if exists)
- `doc/planning/mvp-prd.md` (if exists)

### Memory File
- `doc/planning/current-product-state.md` – local working memory (never commit)

## Priority & Selection Rules

1. **When no `workItemRef` provided**:
   - Query GitHub issues: `gh_list_issues` with `state:open`, `labels:change`
   - Sort by: priority label (`priority:high`, `priority:medium`, `priority:low`), then creation date (oldest first)
   - If exactly one issue has label `in-progress`, select it
   - Otherwise select highest priority non-closed issue
   - If ambiguous, request user selection

2. **Issue labeling for prioritization**:
   - `priority:high` – Critical functionality, blockers
   - `priority:medium` – Important features
   - `priority:low` – Nice-to-have, polish

## Decision Documentation

Product decisions should be documented under:
```
doc/planning/product-decisions/YYYY-MM-DD-{short-kebab-slug}.md
```

Include: Context, Decision, Options, Drivers, Reasoning, Consequences.

## Special Notes for This Repository

1. **Agentic Delivery OS Focus**: This repository implements an agentic delivery operating system. Changes should align with the overall architecture and vision.

2. **Cross-Agent Coordination**: The PM agent must coordinate with specialized agents (`@architect`, `@delivery-agent`, `@runner`, etc.) as per the workflow.

3. **Documentation Discipline**: Ensure system documentation (`doc/spec/**`, `doc/contracts/**`) stays synchronized with implementation via `@doc-syncer`.

4. **Quality Gates**: All changes must pass internal checks (plan complete, tests passing, docs synced) before PR creation.

## External References

- [GitHub Repository](https://github.com/juliusz-cwiakalski/agentic-delivery-os)
- [GitHub Issues](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues)

## Revision History

| Date       | Version | Changes                     |
|------------|---------|-----------------------------|
| 2025-01-28 | 1.0     | Initial configuration       |
