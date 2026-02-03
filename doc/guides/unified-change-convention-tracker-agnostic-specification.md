---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/unified-change-convention-tracker-agnostic-specification.md
---
# Unified Change Convention (Tracker-Agnostic) — Specification v1

## Purpose
Establish a simple, deterministic, and future-proof convention for managing changes in Git that:
- Works with multiple trackers (Jira, GitHub, others).
- Requires **no manual index files**.
- Scales to thousands of changes while remaining navigable in an IDE.
- Supports parallel work without coordination overhead.
- Is friendly to AI agents (fast discovery, stable filenames, minimal merge conflicts).

This convention treats the external tracker (Jira/GitHub) as the authoritative workflow state, while Git stores the change artifacts (spec/plan/tests/notes and per-change agent context).

---

## Core Principles
1. **One ticket = one change**
   - A single tracker item (issue/ticket) corresponds to a single change folder.
   - The change folder remains the same for the entire ticket lifecycle until closure.

2. **Tracker is the source of truth for status**
   - “In progress / blocked / done” is ultimately derived from the tracker.
   - Git artifacts support implementation and auditability; they do not replace tracker state.

3. **Stable identifiers; no reliance on filesystem timestamps**
   - Git does not reliably preserve directory creation time across clones/checkouts.
   - Ordering is achieved via explicit **start date** encoded in the folder name.

4. **Stable filenames (slug-free)**
   - File names include only the tracker reference, not a mutable slug.
   - Folder slug is for readability only.

5. **No global mutable “index” or “current change” file committed to Git**
   - Avoids merge conflicts.
   - “What’s active?” is resolved via tracker queries (MCP) and/or optional local state.

---

## Definitions
### Work Item Reference (`workItemRef`)
Canonical identifier used in folder name and filenames.

Supported formats:
- **Jira**: `PDEV-123` (projectKey + hyphen + number)
- **GitHub**: `GH-456` (prefix + hyphen + issue number)

Rules:
- `workItemRef` is **immutable**.
- Always uppercase the prefix/key (`PDEV`, `GH`).

### Change Start Date (`startDate`)
The local date when work on the change is started and the folder is created.
- Format: `YYYY-MM-DD`
- This date anchors the change folder location and is not revised later.

### Slug (`slug`)
A short, human-readable descriptor.
- Lowercase, words separated by hyphens.
- Avoid special chars.
- Slug may evolve; it is not used by tools as an identifier.

---

## Directory and File Convention

### Root
All change artifacts live under:
- `doc/changes/`

### Month grouping
Changes are grouped by start month:
- `doc/changes/YYYY-MM/`

### Change folder name
Within a month folder, each change folder is:
- `YYYY-MM-DD--<workItemRef>--<slug>/`

Example:
- `doc/changes/2026-01/2026-01-22--PDEV-123--responsive-recipes-images/`
- `doc/changes/2026-01/2026-01-22--GH-456--inventory-bugfix/`

#### Same-day parallel starts
If two changes must start on the same date and you want deterministic ordering in the filesystem, append a short suffix **before** the delimiter:
- `YYYY-MM-DDa--...`
- `YYYY-MM-DDb--...`

Prefer suffixes only when needed (rare).

### Files inside the change folder
Stable, slug-free filenames:
- `chg-<workItemRef>-spec.md`
- `chg-<workItemRef>-plan.md`
- `chg-<workItemRef>-test-plan.md`
- `chg-<workItemRef>-pm-notes.yaml` (**mandatory**: PM progress + decisions + open questions)
- `chg-<workItemRef>-notes.md` (optional)

### PM notes (change-scoped)
PM progress notes are stored directly in the change folder:

- `chg-<workItemRef>-pm-notes.yaml`

This file is **mandatory** for every change. It serves as:
- PM's long-term memory for the change
- Status tracking across sessions (phases started/completed)
- Traceability via git history
- Decisions, open questions, and blockers log

Rules:

- Keep notes change-scoped.
- Do not store secrets, tokens, or credentials.
- Commit this file to git (it is NOT gitignored).

Structure (see `doc/guides/change-lifecycle.md` for full details):

```yaml
change_id: GH-5
title: "..."
phases:
  clarify_scope: { started: null, completed: null }
  specification: { started: null, completed: null }
  test_planning: { started: null, completed: null }
  delivery_planning: { started: null, completed: null }
  delivery: { started: null, completed: null }
  system_spec_update: { started: null, completed: null }
  review_fix: { started: null, completed: null }
  quality_gates: { started: null, completed: null }
  dod_check: { started: null, completed: null }
  pr_creation: { started: null, completed: null }
decisions: []
open_questions: []
blockers: []
notes: ""
```

---

## Optional Local (Git-ignored) Context
A local-only workspace for ephemeral state:
- `.ai/local/` (must be gitignored)

Recommended contents:
- `.ai/local/active-work-item.txt` (optional convenience)
- `.ai/local/scratch/` (temporary notes, partial logs)

Rules:
- Agents must never require `.ai/local/` to function.
- `.ai/local/` is a convenience for the developer; it is not a source of truth.

---

## Branch Naming Convention (Conventional-Commit-Aligned)
Branches are named to be:
- Meaningful,
- Tracker-linked,
- Consistent across repos,
- Compatible with conventional commits.

### Format
- `<type>/<workItemRef>/<slug>`

Examples:
- `feat/PDEV-123/responsive-recipes-images`
- `fix/GH-456/inventory-bugfix`
- `refactor/PDEV-789/recipe-service-cleanup`

### Allowed branch types
Use conventional commit types (recommended set):
- `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`, `style`

Rules:
- Type is chosen when the ticket is created (or when work starts).
- Slug in branch name should match folder slug for readability.
- If the slug evolves, branch rename is optional; do not block progress.

### Multi-repository changes
If a single ticket requires coordinated work across multiple repositories:
- Use the **exact same branch name** in each repo.
- Record the branch name in the ticket (field/comment).

---

## Ticket ↔ Repo Linkage
### Recording branch and artifacts in the ticket
At minimum, record:
- Branch name (`<type>/<workItemRef>/<slug>`)
- Link(s) to PR/MR(s)

Optional (recommended for long-running work):
- Path to change folder(s) in each repo
- Links to spec/plan/test plan if your tracker supports URLs

### Status synchronization
- Agents update ticket status via MCP.
- Ticket status is authoritative.

Recommended label(s):
- `change`
- optionally `blocked`, `parked` (or rely on status fields)

---

## Agent Discovery Rules (Deterministic Resolution)
Agents must be able to locate artifacts without indexes.

Given `workItemRef`:
1. Prefer locating by folder name match under `doc/changes/**`:
   - `*--<workItemRef>--*/`
2. If not found, search for spec file:
   - `doc/changes/**/chg-<workItemRef>-spec.md`
3. If still not found, create a new folder under the current month:
   - `doc/changes/<YYYY-MM>/<YYYY-MM-DD--workItemRef--slug>/`

Given no `workItemRef`:
- Query tracker via MCP:
  - Find non-closed issues labeled `change`, ordered by rank/priority.
  - If exactly one is “in progress,” select it.
  - Otherwise select the highest-ranked non-closed.
  - If ambiguity remains, request user selection.

---

## Change Lifecycle (Recommended Operating Procedure)

For detailed phase-by-phase guidance with agent responsibilities, see `doc/guides/change-lifecycle.md`.

### Summary

The PM agent (`@pm`) orchestrates these phases:

1. **clarify_scope** — Ensure requirements are unambiguous
2. **specification** — Create `chg-<workItemRef>-spec.md` via `@spec-writer`
3. **test_planning** — Create `chg-<workItemRef>-test-plan.md` via `@test-plan-writer`
4. **delivery_planning** — Create `chg-<workItemRef>-plan.md` via `@plan-writer`
5. **delivery** — Hand over to `@delivery-agent` for implementation
6. **system_spec_update** — Reconcile system docs via `@doc-syncer`
7. **review_fix** — Review and fix cycle via `@reviewer`
8. **quality_gates** — Run builds/tests via `@runner`
9. **dod_check** — Final acceptance gate (PM verifies all phases complete)
10. **pr_creation** — Create PR/MR via `@pr-manager`, assign to human, STOP

Phases can be reopened if gaps are discovered in later phases.

---

## Content Expectations per Artifact
### Spec (`chg-<workItemRef>-spec.md`)
Minimum recommended sections:
- Problem / Goal
- Scope / Non-goals
- Acceptance Criteria (AC)
- Definition of Done (DoD)
- Risks / Edge cases
- Dependencies

### Plan (`chg-<workItemRef>-plan.md`)
- Implementation phases and steps (ordered)
- Migration / rollout considerations
- Observability (logging/metrics/alerts)

### Test Plan (`chg-<workItemRef>-test-plan.md`)
- Test strategy (unit/integration/e2e)
- Test cases matrix
- Data setup notes
- Manual verification checklist

### Notes (`chg-<workItemRef>-notes.md`, optional)
- Decisions made, experiments, findings
- Links to relevant discussions

---

## Compatibility and Extensibility
- New trackers can be supported by introducing new `workItemRef` prefixes (e.g., `GL-123` for GitLab issues).
- The convention remains stable because tooling keys off `workItemRef` and start-date folder naming.

---

## Constraints and Pitfalls (Explicitly Avoided)
- No reliance on filesystem directory timestamps.
- No global committed “current change” pointer file (merge conflict magnet).
- No index/manifest files requiring manual maintenance.
- No slug-based file names (avoids rename churn).
- No numeric-only identifiers without a namespace prefix (prevents cross-repo collisions).

---

## Examples

### Jira feature
Path:
- `doc/changes/2026-01/2026-01-22--PDEV-123--responsive-recipes-images/`

Branch:
- `feat/PDEV-123/responsive-recipes-images`

Files:
- `chg-PDEV-123-spec.md`
- `chg-PDEV-123-plan.md`
- `chg-PDEV-123-test-plan.md`
- `chg-PDEV-123-pm-notes.yaml`

### GitHub fix
Path:
- `doc/changes/2026-02/2026-02-03--GH-456--inventory-bugfix/`

Branch:
- `fix/GH-456/inventory-bugfix`

Files:
- `chg-GH-456-spec.md`
- `chg-GH-456-plan.md`
- `chg-GH-456-test-plan.md`
- `chg-GH-456-pm-notes.yaml`

---

## Final Lock-Down Decisions (Confirmed)
- Use `workItemRef` with namespaces (e.g., `PDEV-123`, `GH-456`).
- Use start-date in folder name (not sequence numbers).
- One ticket maps to one change folder.
- Stable filenames include `workItemRef` and do not depend on slug.
- PM progress notes live in `chg-<workItemRef>-pm-notes.yaml` directly in the change folder (**mandatory**).
- Optional local-only context lives under `.ai/local/` and is gitignored.
- Branch names follow `<type>/<workItemRef>/<slug>` and are identical across repos when the same ticket spans multiple repositories.
- Change lifecycle is documented in `doc/guides/change-lifecycle.md`.
