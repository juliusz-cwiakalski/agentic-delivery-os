---
# Copyright (c) 2025-2026 Juliusz Cwiakalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/change-lifecycle.md
id: GUIDE-CHANGE-LIFECYCLE
status: Draft
created: 2026-02-03
owners: ["engineering"]
summary: "End-to-end change delivery workflow (planning to PR) with PM-led gates and artifacts." 
---

# Change Lifecycle

This guide defines the canonical change workflow for this repository.

Principles:

- One ticket = one change.
- The ticket tracker is the source of truth for status.
- Change artifacts live under `doc/changes/` following the Unified Change Convention.
- Local, ephemeral agent state lives under `.ai/local/` and is git-ignored.
- `@pm` focuses on one ticket per conversation unless the user explicitly requests a planning-only session.

## Required Artifacts (per change)

Inside the change folder `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`:

- `chg-<workItemRef>-spec.md`
- `chg-<workItemRef>-test-plan.md`
- `chg-<workItemRef>-plan.md`
- `chg-<workItemRef>-pm-notes.yaml` (PM progress + decisions + open questions)

Optional (only when needed):

- `chg-<workItemRef>-notes.md` (free-form notes, experiments, links)

## Change Phases (PM-controlled)

Phases are ordered and gated. A phase is not complete unless its artifacts exist and are consistent.

### 1) Clarify scope

Goal:

- Ensure requirements are unambiguous enough to start drafting artifacts.

Actions:

- Read the ticket.
- Identify missing inputs or ambiguity.
- Ask open questions in the issue tracker only when it creates durable value (knowledge base).
- Record all open questions and assumptions in `chg-<workItemRef>-pm-notes.yaml`.

Exit criteria:

- Scope, acceptance criteria, and constraints are clear enough to write the spec.

### 2) Create change spec

Goal:

- Produce the canonical specification that drives planning and delivery.

Actions:

- Create or update `chg-<workItemRef>-spec.md`.

Exit criteria:

- Spec is complete enough for test planning and implementation planning.

### 3) Create change test plan

Goal:

- Define verification strategy and traceability to acceptance criteria.

Actions:

- Create or update `chg-<workItemRef>-test-plan.md`.

Exit criteria:

- Every acceptance criterion is covered or explicitly marked TODO with an open question.

### 4) Create change implementation/delivery plan

Goal:

- Produce an actionable phased plan for implementation.

Actions:

- Create or update `chg-<workItemRef>-plan.md`.

Exit criteria:

- Plan is phased, check-listable, and aligns with the spec and test plan.

### 5) Run change delivery (handover to delivery agent)

Goal:

- Implement the change in code according to the plan.

Actions:

- `@pm` hands over to `@delivery-agent`.
- `@delivery-agent` executes the plan in phases (delegating to `@executor`, `@runner`, `@fixer`, etc.).

Exit criteria:

- Plan tasks for implementation phases are complete with evidence.

### 6) Update current system specification

Goal:

- Ensure repo-level system specs/docs reflect the new truth.

Actions:

- Run doc reconciliation (typically via `@doc-syncer`).

Exit criteria:

- System specification is updated and consistent with the implementation.

### 7) Review-fix cycle

Goal:

- Ensure the implementation matches the spec and plan.

Actions:

- Run `@reviewer`.
- If reviewer returns FAIL or adds remediation tasks:
  - Update `chg-<workItemRef>-plan.md` with remediation tasks/phases.
  - Run `@delivery-agent` (or `@executor`) to address remediation.
  - Re-run `@reviewer` until PASS.

Exit criteria:

- Reviewer returns PASS.

### 8) Quality gates verification

Goal:

- Ensure builds/tests and repo conventions pass.

Actions:

- Run quality gates per repo conventions (typically via `@runner`).

Exit criteria:

- Required checks pass, logs/evidence captured if needed.

### 9) DoD check (Definition of Done)

Goal:

- Confirm the change is actually done.

Checklist:

- All phases above completed.
- Delivery plan tasks complete.
- Acceptance criteria double-checked.
- No pending TODOs without an explicit follow-up ticket.

Exit criteria:

- DoD satisfied.

### 10) PR/MR creation and human handoff

Goal:

- Create the PR/MR and hand off to a human reviewer.

Actions:

- Create/update PR/MR via `@pr-manager`.
- Assign the ticket to a human reviewer in the tracker.
- Stop: do not start another ticket automatically.

Exit criteria:

- PR/MR exists and ticket is assigned for review.

## Issue Tracker Communication Policy

Use comments as a knowledge base. Comment only when it adds durable value:

- Decisions taken (and rationale)
- Scope changes
- Open questions + answers
- Blockers and investigative findings

Avoid generic status updates. Use tracker state/labels for status.
