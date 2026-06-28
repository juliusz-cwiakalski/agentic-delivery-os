---
ados_distribution: internal
id: SPEC-LOCAL-CODE-REVIEW
status: Current
created: 2026-06-28
last_updated: 2026-06-28
owners: ["engineering"]
service: delivery-os
summary: "Local code review via /review and /review-deep: spec/plan compliance plus code-quality heuristics, with a remediation-phase append loop, handled by the unified @reviewer (distinct from the remote workflow)."
links:
  related_changes: ["GH-79"]
---

# Feature: Local Code Review

## Overview

ADOS reviews a delivered change **locally** against its specification, plan, code-quality heuristics, and repository rules via `/review` and `/review-deep`, both handled by the unified `@reviewer` agent. When findings exist, the reviewer appends a **remediation phase** to the change plan; `@coder` implements it; the reviewer is re-run until PASS. This spec covers the **local** review workflow — distinct from the remote PR/MR review workflow.

> **Local vs remote are distinct workflows.** Remote review (`/review-remote` against an open PR/MR diff, with draft generation, deduplication, and optional publishing) and review-feedback application (`/apply-review-feedback`) are specced in the sibling [feature-remote-code-review.md](feature-remote-code-review.md). This spec does **not** duplicate that content; the two share the unified `@reviewer` agent but have different commands, inputs, outputs, and state. This is a **companion** spec (DEC-7) — the remote spec is read-only here.

## Business Context

### Problem Statement

- **Problem:** An implementation can drift from its spec/plan or violate code-quality heuristics; without a structured local review, gaps are caught late (at quality gates or after merge) when they are expensive to fix.
- **Affected Users:** Developers and reviewers running the delivery lifecycle.
- **Business Impact:** Late defect discovery increases rework cost and erodes review quality.

### Goals & Success Metrics

- **Primary Goal:** Every delivered change is audited against spec/plan + heuristics before PR, with findings driving a deterministic remediation loop.
- **KPIs:** `/review` and `/review-deep` invocable; reviewer returns `PASS` (or remediation appended); re-running after remediation is idempotent.

## User Experience & Functionality

### Capabilities

- **Standard vs deep review (F-1):**
  - `/review <workItemRef>` — invokes the unified `@reviewer` in local mode with the standard reasoning model.
  - `/review-deep <workItemRef>` — identical framework, but uses a **stronger reasoning model** for deeper/thorough analysis.
- **Spec/plan compliance (F-2):** The reviewer validates the change diff against: scope compliance (changed files align with spec capabilities); plan alignment (all tasks done, AC have evidence); a plan-task audit (OPEN_TASKS, DONE_BUT_UNCHECKED, CHECKED_BUT_MISSING); and out-of-scope detection (changes to files not in the plan).
- **Code-quality heuristics (F-3):** A built-in heuristic framework — correctness, security, performance, reliability, API compatibility, testing gaps, documentation, dependencies — augmented by repository-local rules from `.ai/agent/code-review-instructions.md` and `.ai/rules/`.
- **Ticket context (F-4):** When available, AC verification against the implementation and linked-issue traversal for additional constraints/decisions.
- **Remediation-phase append (F-5):** If findings exist, the reviewer **appends** a new phase ("Code Review Remediation") to `chg-<workItemRef>-plan.md`:
  - The new phase number = max existing phase + 1.
  - It does **not** modify earlier phases.
  - It appends a revision-log entry.
  - Each finding becomes a check-listable task; acceptance criteria require all fixes implemented and tests passing.
  - The review is **idempotent** — re-running yields no duplicate tasks.
- **Remediation loop (F-6):** `@coder` implements the appended remediation phase (via `/run-plan <workItemRef> execute all remaining phases no review`), then `@reviewer` is re-run; the loop repeats until `Status=PASS` (max 3 iterations; escalate to human on stalemate).
- **Unified `@reviewer` (F-7):** The same agent handles local and remote modes; the heuristic definitions live in the `@reviewer` prompt, not in the commands.

### Findings Format

Findings use the form `[severity: major|minor|nit] <file>[:line] — <description>; fix: <action>`.

### User Flows

```
/review GH-456           → @reviewer audits diff vs spec/plan + heuristics
                         → if findings: append "Code Review Remediation" phase to plan, commit plan
                         → next action: /run-plan GH-456 (remediation)
                         → re-run /review until PASS
/review-deep GH-456      → same, stronger reasoning model
```

### Edge Cases & Error Handling

- **Missing spec or plan:** abort with a clear error.
- **Unable to derive slug/change.type:** abort.
- **Branch resolution failure:** fallback to HEAD; note in summary.
- **Empty diff:** advisory; no remediation unless plan gaps are found.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `.opencode/command/review.md` | `/review` command | Local review entry; delegates to `@reviewer` |
| `.opencode/command/review-deep.md` | `/review-deep` command | Local review entry with stronger reasoning model; delegates to `@reviewer` |
| `.opencode/agent/reviewer.md` | Reviewer agent (unified) | Spec/plan compliance + code-quality heuristics + remediation append; handles local + remote modes |
| `.ai/agent/code-review-instructions.md` | Review guidance | Repository-local review priorities, checklist, conventions |
| `.ai/rules/**` | Repo rules | Language/tool rules consulted during review |

### Plan Mutation Contract

The reviewer only modifies the **plan file** (`chg-<workItemRef>-plan.md`) — never the spec or code. When committing (default `commit=true`), it stages the plan and creates a Conventional Commit via `/commit`. It never uses `doc/changes/current` in paths.

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Scope | Reviewer modifies only the plan file (never spec/code) | Zero edits to spec or source |
| NFR-2 | Idempotency | Re-running `/review` after remediation yields no duplicate tasks | No duplicate remediation phases |
| NFR-3 | Determinism | Remediation phase = max existing phase + 1; earlier phases untouched | Append-only |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Remediation append | Run `/review` on a change with findings; verify a new phase is appended with one task per finding |
| Manual | Idempotency | Re-run `/review` without changes; verify no duplicate tasks |
| Manual | Deep parity | `/review-deep` produces the same finding format/framework as `/review` |

## Dependencies & Risks

- **Depends on:** spec + plan artifacts for the change; `.ai/agent/code-review-instructions.md` (optional, with graceful fallback).
- **Risk:** Remediation loop never converges — mitigated by the max-3-iterations + human-escalation rule.
- **Risk:** Conflating local and remote review — mitigated by the companion-spec split (DEC-7); the remote spec is untouched.

## Related Documentation

- **Commands:** `.opencode/command/{review,review-deep}.md`.
- **Reviewer agent (unified):** `.opencode/agent/reviewer.md`.
- **Review guidance:** `.ai/agent/code-review-instructions.md`; repo rules: `.ai/rules/**`.
- **Lifecycle context:** [doc/guides/change-lifecycle.md](../../guides/change-lifecycle.md) §8 (review_fix); [definition-of-done.md](../../guides/definition-of-done.md).
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — reviewer role, `/review` + `/review-deep` commands.
- **Sibling spec (remote review, distinct workflow — DEC-7):** [feature-remote-code-review.md](feature-remote-code-review.md) — `/review-remote` + `/apply-review-feedback`.
- **Sibling spec (verification neighborhood):** [feature-quality-gates-and-pr.md](feature-quality-gates-and-pr.md) — `/check`, commit, and PR workflow adjacent to review.
