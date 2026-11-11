---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-quality-gates-and-pr.md
ados_distribution: internal
id: SPEC-QUALITY-GATES-AND-PR
status: Current
created: 2026-06-28
last_updated: 2026-11-11
owners: ["engineering"]
service: delivery-os
summary: "The verification-and-release neighborhood of the lifecycle: quality gates (/check, /check-fix), the pre-PR branch-range commit-message lint (scripts/lint-commit-range.sh) with the committer/PM message contract, the one-Conventional-Commit workflow through the commit primitive (@committer), and the PR/MR workflow (@pr-manager), with a platform/project configuration layer."
links:
  related_changes: ["GH-79", "GH-242", "GH-268"]
  guides:
    - "doc/guides/pr-platform-integration.md"
---

# Feature: Quality Gates and PR/MR Workflow

## Overview

This spec covers the **verification and release neighborhood** of the delivery lifecycle — the agents and commands that run quality gates, create commits, and open/update the PR/MR. Concretely: `/check` and `/check-fix` (run vs run+fix), the pre-PR branch-range commit-message lint (`scripts/lint-commit-range.sh`) with the message contract stated where `@committer` and `@pm` read it, the commit workflow (`@committer` producing exactly one Conventional Commit), and the PR/MR workflow (`@pr-manager`), supported by the `@runner`/`@fixer`/`@committer`/`@pr-manager` roles and a platform/project configuration layer in `.ai/agent/`.

> **Phase placement.** These capabilities implement the tail of the **11-phase lifecycle**: `review_fix` (8), `quality_gates` (9), `dod_check` (10), and `pr_creation` (11). The full lifecycle, PM orchestration, and gating are specced in the sibling [feature-delivery-lifecycle.md](feature-delivery-lifecycle.md). This spec does not restate the lifecycle; it scopes its verification/release slice.

## Business Context

### Problem Statement

- **Problem:** Without deterministic, configuration-driven quality gates and a disciplined commit/PR workflow, verification becomes ad hoc and PRs become un-reviewable.
- **Affected Users:** Developers, reviewers, and the AI agent team running delivery.
- **Business Impact:** Inconsistent gate runs and sloppy commits slow review and erode traceability. A commit-message rule violation is enforced by CI commitlint, so it surfaces after the PR exists, when the only remedy is a history rewrite and force-push.

### Goals & Success Metrics

- **Primary Goal:** Quality gates run from a single resolution path; every commit is one high-quality Conventional Commit; every change branch has an open, up-to-date PR/MR.
- **KPIs:** `/check` and `/check-fix` invocable; `@committer` never pushes or rewrites history; `@pr-manager` never merges; the branch-range lint reports `PASS` or `SKIP` before PR creation with the verdict recorded; zero commit-message CI failures per delivered change.

## User Experience & Functionality

### Capabilities

- **Quality gates — run only (`/check`, F-1):** Runs the repository's configured quality gates command and returns a concise, high-signal summary with log pointers. It **does not attempt fixes** — it is run-only. It delegates execution to `@runner` and resolves the gates command from `AGENTS.md` (preferred) or defaults to `./scripts/quality-gates.sh`. Logs land under `tmp/run-logs-runner/<YYYY-MM-DD>/`. Intended for direct human invocation.
- **Quality gates — run + fix (`/check-fix`, F-2):** Runs quality gates (fast gates first, then full gates when applicable), systematically fixes any issues found, then creates **a single** Conventional Commit summarizing the changes by delegating to `@committer`. Delegates to `@fixer` for the diagnosis/fix work.
- **Commit workflow (`@committer`, F-3):** Produces exactly **one** high-quality Conventional Commit for all current, safe-to-commit worktree changes by invoking the `commit` primitive. `@committer` invokes the `commit` primitive and performs no direct staging, commit, re-stage, or amend; the primitive owns staging precision, the safety scan, message selection, validation, and the commit act. Never push, never rewrite history, never lose work, never include raw diff hunks in the body, STOP on suspected secrets, never commit `tmp/` or `.ai/local/`. **Message contract:** the subject is a conventional header (`type(scope): summary`) carrying the work item reference; body and footer lines stay within 100 characters each, counting the whole line; a sync from the delivery branch never leaves a plain `Merge remote-tracking branch ...` subject behind — the sync carries a conventional subject referencing the work item, or the branch is integrated without a merge commit; a failing range is remediated by `MODE: SURGICAL REWORD` (one or two offending commits) or `MODE: CONDENSE-TO-ONE` (three or more), with offenders counted per commit and never per violation. The committer owns the message it produces and never rewrites history; the PM owns the range verdict and selects the remediation mode; the acting agent performs the history action outside the gate; the gate only reports. Gate and PR obligations unchanged.
- **PR/MR workflow (`@pr-manager`, F-4):** Ensures an **open** PR/MR exists for the current branch and its title + description are up to date. It **always checks for an existing open PR/MR before creating** (update vs create), generates `tmp/pr/<branchPath>/description.md` from the branch diff, detects GitHub vs GitLab from `origin`, and creates/updates via the platform tooling defined in `.ai/agent/pr-instructions.md`. Hard rules: **never merge** and no raw-git commit; when the worktree is dirty at PR time it invokes the `commit` primitive (or the thin `@committer`, which only invokes `commit`), so push and PR creation remain its only retained git writes. It stops and asks the user to review + merge manually.
- **Runner role (`@runner`, F-5):** A subagent that executes commands for a parent agent/human, captures all output as log artifacts under `tmp/run-logs-runner/`, and returns a tight summary. It never proposes/implements code changes and never runs destructive commands unless explicitly requested.
- **Fixer role (`@fixer`, F-6):** Reproduces failures and applies targeted fixes (invoked by `/check-fix` and the lifecycle when gates fail).
- **Platform/project configuration layer (F-7):** Two repository-local files externalize platform and review specifics:
  - `.ai/agent/pr-instructions.md` — PR/MR platform config (platform type, access method, an Operations Reference table mapping every PR/MR operation to a concrete CLI command), read by `@pr-manager`, `@reviewer`, and `@review-feedback-applier`.
  - `.ai/agent/code-review-instructions.md` — repository-local review guidance (priorities, checklist, conventions), read by `@reviewer`.
- **Pre-PR branch-range commit-message lint (`scripts/lint-commit-range.sh`, F-8):** A repository-owned gate that lints the change branch's own commit range — every commit from the merge-base of the delivery base branch with `HEAD` up to `HEAD` — against the repository's single root commitlint configuration, and reports exactly one verdict:
  - `PASS` (exit `0`) — every commit in range satisfies the configuration; an empty range is reported explicitly as zero commits.
  - `FAIL` (exit `1`) — one or more offending commits, with attributed diagnostics and a remediation mode.
  - `SKIP` (exit `0`) — the repository configures no commitlint, so there is no authority to mirror.
  - `ERROR` (exit `2`) — cannot verify: unresolvable base, undeterminable merge-base, no usable commitlint binary, unusable configuration, or a usage error. A signal-interrupted run produces no verdict and exits by the shell interrupt convention (`130`).

  Invocation is `./scripts/lint-commit-range.sh [--base <ref>]`. The base resolves in a fixed precedence — `--base`, then `ADOS_BASE_BRANCH`, then the `Default base branch` line of `.ai/agent/pr-instructions.md`, then `main` — preferring the remote-tracking ref when it resolves. The lint binary resolves to the repository-local `node_modules/.bin/commitlint` first and a `commitlint` on `PATH` second; the verdict header names the binary and its origin, so a tool resolved from outside the repository is visible rather than silent. Every offending commit gets one block, oldest to newest, carrying its short SHA, full SHA, the violated rule id(s) with the offending line number, and a bounded line excerpt; the summary counts commits in range, offending commits, and distinct rules hit, and names the remediation mode — `MODE: SURGICAL REWORD` for one or two offenders, `MODE: CONDENSE-TO-ONE` for three or more. The gate is read-only and offline (no fetch, no network, no ref/index/working-tree/stash write), creates no repository files, and holds no history-mutating capability; per-commit results live in a transient temporary directory under `TMPDIR` that the gate removes on exit, so no state survives a run. It **mirrors** the CI `ts-commitlint` authority rather than replacing it: it applies no rule of its own, rejects nothing the authority accepts, and accepts nothing the authority rejects. It is a required step of the lifecycle `quality_gates` phase with a verdict recorded in PM notes; it is not part of `pnpm check`, `/check`, or `/check-fix`, which stay working-tree gates.

### User Flows

```
Run gates only:    /check                 → @runner runs gates → summary + log pointers
Run + fix:         /check-fix             → @fixer diagnoses/fixes → @committer one Conventional Commit
Range lint:        ./scripts/lint-commit-range.sh --base <ref>
                     → PASS / SKIP → record the verdict in PM notes, phase completes
                     → FAIL       → remediate in the named mode, re-run the gate
                     → ERROR      → fix the cause it names, re-run; never recorded as a pass
Commit:            /commit (→ @committer) → one Conventional Commit (never push)
Open/update PR:    /pr (→ @pr-manager)    → update existing open PR/MR, or create → STOP (never merge)
```

### Edge Cases & Error Handling

- **No changes to commit:** `@committer` outputs exactly "No changes to commit." and stops.
- **Commit hooks modify files:** the `commit` primitive owns hook and staging behavior; a hook that modifies files is handled by the primitive, never by an agent re-stage or amend.
- **No open PR/MR:** `@pr-manager` creates one; if one exists, it updates.
- **Missing `pr-instructions.md`:** `@pr-manager` (and the review agents) fall back per their documented platform-detection behavior; the range lint then resolves its base from `--base`, `ADOS_BASE_BRANCH`, or `main`.
- **Range lint cannot verify:** the gate exits `ERROR` with the cause and a remediation hint (fetch the base, install dependencies, pass a resolvable `--base`). The lane fixes the cause and re-runs; an unresolved error is never recorded as a pass and blocks the `quality_gates` phase.
- **Repository without commitlint configuration:** the gate reports `SKIP` and the phase proceeds with the skip recorded — there is no authority to mirror.
- **Plain merge subject in the range:** the gate accepts it, because the conventional configuration ignores merge subjects; the rule is preventive and lives in the stated committer/PM contract, not in the gate's verdict.
- **Lane lacks the delivery base branch locally:** the gate fails loudly with a fetch hint instead of reporting a pass over a guessed range.

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
| `scripts/lint-commit-range.sh` | Range lint gate | Pre-PR branch-range commit-message lint against the root commitlint configuration: base and merge-base resolution, repository-local-then-`PATH` binary resolution with origin disclosure, per-commit diagnostics, remediation mode, `PASS`/`FAIL`/`SKIP`/`ERROR` exit contract; read-only and offline |
| `.ai/agent/pr-instructions.md` | Platform config | PR/MR platform type + Operations Reference (CLI command table) |
| `.ai/agent/code-review-instructions.md` | Review config | Repository-local review guidance |

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Gate parity | `/check` resolves the gates command from `AGENTS.md` (default `./scripts/quality-gates.sh`) | Deterministic resolution |
| NFR-2 | Commit discipline | `@committer` produces exactly one Conventional Commit; never pushes or rewrites history | One commit per invocation |
| NFR-3 | PR idempotency | `@pr-manager` updates an existing open PR/MR rather than duplicating | One open PR/MR per branch |
| NFR-4 | Safety | `@committer` never commits `tmp/`/`.ai/local/`; `@pr-manager` never merges | Enforced by prompts |
| NFR-5 | Range-lint parity | The range lint consumes the single root commitlint configuration and CLI; it adds no rule and relaxes none | 0 parity drift against CI `ts-commitlint` |
| NFR-6 | Range-lint truthfulness | A verdict the gate cannot render is `ERROR`, never a pass; a repository without commitlint reports `SKIP` | 0 silent passes |
| NFR-7 | Range-lint read-only | The gate performs no fetch, no network access, and no ref/index/working-tree/stash write | 0 mutations per run |
| NFR-8 | Range-lint determinism and bounds | The same range, configuration, and tool version yield the same diagnostics and exit code, within runtime and output budgets | 0 variance; ≤20 rule lines per commit; ≤200 diagnostic lines; excerpt ≤160 characters; ≤10 s for ≤20 commits |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | `/check` | Run on a clean tree; verify summary + log pointers, no fixes |
| Manual | `/check-fix` | Introduce a failing gate; verify fix + single commit |
| Manual | `/commit` | Verify one Conventional Commit; verify no push |
| Manual | `/pr` | Verify update-vs-create behavior and never-merge |
| Automated | Range lint gate | `bash scripts/.tests/test-lint-commit-range.sh` — verdicts and exit codes, per-commit attribution, remediation mode, base precedence, binary resolution and origin disclosure, skip, preconditions, determinism, read-only/no-network, runtime budgets |
| Manual | Range lint in a lane | Run `./scripts/lint-commit-range.sh --base <ref>` on a clean range (expect `PASS`) and on a range with one over-long body line (expect `FAIL` plus a named mode) |

## Dependencies & Risks

- **Depends on:** a repo quality-gates script (`./scripts/quality-gates.sh` or the path named in `AGENTS.md`).
- **Depends on:** `.ai/agent/pr-instructions.md` for platform CLI mapping (optional with documented fallback).
- **Depends on:** the root `commitlint.config.js` and its CLI (root dev dependencies) for the range lint — the gate mirrors their verdict and introduces no rule of its own.
- **Depends on:** a locally resolvable delivery base branch at `quality_gates` time; when it is absent the gate reports `ERROR` with a fetch hint rather than passing.
- **Risk:** A sloppy multi-commit history — mitigated by `@committer`'s one-commit discipline and the Conventional Commits format.
- **Risk:** Duplicate PRs — mitigated by `@pr-manager`'s check-before-create invariant.
- **Risk:** A commit-message violation discovered only after PR creation, when the only remedy is a history rewrite — mitigated by the pre-PR range lint and by the message contract stated in the committer/PM instructions.
- **Risk:** Plain merge subjects (`Merge remote-tracking branch ...`) pass the gate because the conventional configuration ignores them — mitigated by the stated contract and by the resume-sync instruction that emits a conventional sync subject; the gate deliberately stays at parity with the authority.

## Related Documentation

- **Commands:** `.opencode/command/{check,check-fix,commit,pr}.md`.
- **Agents:** `.opencode/agent/{runner,fixer,committer,pr-manager}.md`.
- **Range lint gate:** `scripts/lint-commit-range.sh` (`--help` prints the invocation and exit contract); suite `scripts/.tests/test-lint-commit-range.sh`.
- **Platform config:** `.ai/agent/pr-instructions.md`; review config: `.ai/agent/code-review-instructions.md`.
- **PR/MR integration guide:** [doc/guides/pr-platform-integration.md](../../guides/pr-platform-integration.md).
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — runner/fixer/committer/pr-manager roles, command table, pre-PR range gate.
- **Sibling spec (lifecycle context):** [feature-delivery-lifecycle.md](feature-delivery-lifecycle.md) — phases 8–11 (review_fix, quality_gates, dod_check, pr_creation).
- **Sibling spec (local review):** [feature-local-code-review.md](feature-local-code-review.md) — `/review`/`/review-deep` and the remediation loop, adjacent to this verification neighborhood.
