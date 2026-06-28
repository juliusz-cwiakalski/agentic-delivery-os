---
ados_distribution: internal
id: SPEC-QUALITY-GATES-AND-PR
status: Current
created: 2026-06-28
last_updated: 2026-06-28
owners: ["engineering"]
service: delivery-os
summary: "The verification-and-release neighborhood of the lifecycle: quality gates (/check, /check-fix), the one-Conventional-Commit workflow (@committer), and the PR/MR workflow (@pr-manager), with a platform/project configuration layer."
links:
  related_changes: ["GH-79"]
  guides:
    - "doc/guides/pr-platform-integration.md"
---

# Feature: Quality Gates and PR/MR Workflow

## Overview

This spec covers the **verification and release neighborhood** of the delivery lifecycle — the agents and commands that run quality gates, create commits, and open/update the PR/MR. Concretely: `/check` and `/check-fix` (run vs run+fix), the commit workflow (`@committer` producing exactly one Conventional Commit), and the PR/MR workflow (`@pr-manager`), supported by the `@runner`/`@fixer`/`@committer`/`@pr-manager` roles and a platform/project configuration layer in `.ai/agent/`.

> **Phase placement.** These capabilities implement the tail of the **11-phase lifecycle**: `review_fix` (8), `quality_gates` (9), `dod_check` (10), and `pr_creation` (11). The full lifecycle, PM orchestration, and gating are specced in the sibling [feature-delivery-lifecycle.md](feature-delivery-lifecycle.md). This spec does not restate the lifecycle; it scopes its verification/release slice.

## Business Context

### Problem Statement

- **Problem:** Without deterministic, configuration-driven quality gates and a disciplined commit/PR workflow, verification becomes ad hoc and PRs become un-reviewable.
- **Affected Users:** Developers, reviewers, and the AI agent team running delivery.
- **Business Impact:** Inconsistent gate runs and sloppy commits slow review and erode traceability.

### Goals & Success Metrics

- **Primary Goal:** Quality gates run from a single resolution path; every commit is one high-quality Conventional Commit; every change branch has an open, up-to-date PR/MR.
- **KPIs:** `/check` and `/check-fix` invocable; `@committer` never pushes or rewrites history; `@pr-manager` never merges.

## User Experience & Functionality

### Capabilities

- **Quality gates — run only (`/check`, F-1):** Runs the repository's configured quality gates command and returns a concise, high-signal summary with log pointers. It **does not attempt fixes** — it is run-only. It delegates execution to `@runner` and resolves the gates command from `AGENTS.md` (preferred) or defaults to `./scripts/quality-gates.sh`. Logs land under `tmp/run-logs-runner/<YYYY-MM-DD>/`. Intended for direct human invocation.
- **Quality gates — run + fix (`/check-fix`, F-2):** Runs quality gates (fast gates first, then full gates when applicable), systematically fixes any issues found, then creates **a single** Conventional Commit summarizing the changes by delegating to `@committer`. Delegates to `@fixer` for the diagnosis/fix work.
- **Commit workflow (`@committer`, F-3):** Produces exactly **one** high-quality Conventional Commit for all current, safe-to-commit worktree changes. Hard non-negotiables: never push; never rewrite history (no rebase/squash/hard-reset/clean/stash; one allowed post-hook amend); never lose work; never include raw diff hunks in the body; STOP on suspected secrets; never commit `tmp/` or `.ai/local/`. It chooses a Conventional Commit type/scope, optionally applies a `BREAKING CHANGE:` footer, and commits via a temp message file under `tmp/`.
- **PR/MR workflow (`@pr-manager`, F-4):** Ensures an **open** PR/MR exists for the current branch and its title + description are up to date. It **always checks for an existing open PR/MR before creating** (update vs create), generates `tmp/pr/<branchPath>/description.md` from the branch diff, detects GitHub vs GitLab from `origin`, and creates/updates via the platform tooling defined in `.ai/agent/pr-instructions.md`. Hard rule: **never merge** — it stops and asks the user to review + merge manually.
- **Runner role (`@runner`, F-5):** A subagent that executes commands for a parent agent/human, captures all output as log artifacts under `tmp/run-logs-runner/`, and returns a tight summary. It never proposes/implements code changes and never runs destructive commands unless explicitly requested.
- **Fixer role (`@fixer`, F-6):** Reproduces failures and applies targeted fixes (invoked by `/check-fix` and the lifecycle when gates fail).
- **Platform/project configuration layer (F-7):** Two repository-local files externalize platform and review specifics:
  - `.ai/agent/pr-instructions.md` — PR/MR platform config (platform type, access method, an Operations Reference table mapping every PR/MR operation to a concrete CLI command), read by `@pr-manager`, `@reviewer`, and `@review-feedback-applier`.
  - `.ai/agent/code-review-instructions.md` — repository-local review guidance (priorities, checklist, conventions), read by `@reviewer`.

### User Flows

```
Run gates only:    /check                 → @runner runs gates → summary + log pointers
Run + fix:         /check-fix             → @fixer diagnoses/fixes → @committer one Conventional Commit
Commit:            /commit (→ @committer) → one Conventional Commit (never push)
Open/update PR:    /pr (→ @pr-manager)    → update existing open PR/MR, or create → STOP (never merge)
```

### Edge Cases & Error Handling

- **No changes to commit:** `@committer` outputs exactly "No changes to commit." and stops.
- **Commit hooks modify files:** `@committer` stages the hook changes and amends the just-created commit **once** (same message).
- **No open PR/MR:** `@pr-manager` creates one; if one exists, it updates.
- **Missing `pr-instructions.md`:** `@pr-manager` (and the review agents) fall back per their documented platform-detection behavior.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `.opencode/command/check.md` | `/check` command | Run-only quality gates; delegates to `@runner` |
| `.opencode/command/check-fix.md` | `/check-fix` command | Run + fix + one Conventional Commit via `@fixer` → `@committer` |
| `.opencode/command/commit.md` | `/commit` command | Thin entry delegating to `@committer` |
| `.opencode/command/pr.md` | `/pr` command | Thin entry delegating to `@pr-manager` |
| `.opencode/agent/runner.md` | Runner agent | Execute commands, capture logs, summarize (subagent) |
| `.opencode/agent/fixer.md` | Fixer agent | Reproduce failures, apply targeted fixes |
| `.opencode/agent/committer.md` | Committer agent | Exactly one Conventional Commit; never push/rewrite |
| `.opencode/agent/pr-manager.md` | PR manager agent | Create/update open PR/MR; never merge |
| `.ai/agent/pr-instructions.md` | Platform config | PR/MR platform type + Operations Reference (CLI command table) |
| `.ai/agent/code-review-instructions.md` | Review config | Repository-local review guidance |

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Gate parity | `/check` resolves the gates command from `AGENTS.md` (default `./scripts/quality-gates.sh`) | Deterministic resolution |
| NFR-2 | Commit discipline | `@committer` produces exactly one Conventional Commit; never pushes or rewrites history | One commit per invocation |
| NFR-3 | PR idempotency | `@pr-manager` updates an existing open PR/MR rather than duplicating | One open PR/MR per branch |
| NFR-4 | Safety | `@committer` never commits `tmp/`/`.ai/local/`; `@pr-manager` never merges | Enforced by prompts |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | `/check` | Run on a clean tree; verify summary + log pointers, no fixes |
| Manual | `/check-fix` | Introduce a failing gate; verify fix + single commit |
| Manual | `/commit` | Verify one Conventional Commit; verify no push |
| Manual | `/pr` | Verify update-vs-create behavior and never-merge |

## Dependencies & Risks

- **Depends on:** a repo quality-gates script (`./scripts/quality-gates.sh` or the path named in `AGENTS.md`).
- **Depends on:** `.ai/agent/pr-instructions.md` for platform CLI mapping (optional with documented fallback).
- **Risk:** A sloppy multi-commit history — mitigated by `@committer`'s one-commit discipline and the Conventional Commits format.
- **Risk:** Duplicate PRs — mitigated by `@pr-manager`'s check-before-create invariant.

## Related Documentation

- **Commands:** `.opencode/command/{check,check-fix,commit,pr}.md`.
- **Agents:** `.opencode/agent/{runner,fixer,committer,pr-manager}.md`.
- **Platform config:** `.ai/agent/pr-instructions.md`; review config: `.ai/agent/code-review-instructions.md`.
- **PR/MR integration guide:** [doc/guides/pr-platform-integration.md](../../guides/pr-platform-integration.md).
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — runner/fixer/committer/pr-manager roles, command table.
- **Sibling spec (lifecycle context):** [feature-delivery-lifecycle.md](feature-delivery-lifecycle.md) — phases 8–11 (review_fix, quality_gates, dod_check, pr_creation).
- **Sibling spec (local review):** [feature-local-code-review.md](feature-local-code-review.md) — `/review`/`/review-deep` and the remediation loop, adjacent to this verification neighborhood.
