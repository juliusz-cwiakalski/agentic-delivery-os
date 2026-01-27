---
id: GUIDE-OPENCODE-AGENTS
status: Accepted
created: 2026-01-09
owners: ["engineering"]
summary: "Comprehensive guide to Opencode AI agents and commands for manual and autopilot workflows."
---

# Opencode Agents & Commands Guide

This guide details how to use the Opencode AI ecosystem to plan, implement, and deliver software changes. It covers the
available tools (agents and commands) and describes two primary workflows: **Manual Orchestration** (for hands-on
control) and **Autopilot** (for high-level delegation).

<!-- TOC -->

- [Opencode Agents & Commands Guide](#opencode-agents--commands-guide)
  - [1. Overview](#1-overview)
  - [2. Reference: Agents & Commands](#2-reference-agents--commands)
    - [2.1 Commands (Automation Macros)](#21-commands-automation-macros)
    - [2.2 Agents (Autonomous Roles)](#22-agents-autonomous-roles)
  - [3. Workflow 1: Manual Change Orchestration](#3-workflow-1-manual-change-orchestration)
    - [Step 1: Plan the Change](#step-1-plan-the-change)
    - [Step 2: Generate the Spec](#step-2-generate-the-spec)
    - [Step 3: Generate Plans](#step-3-generate-plans)
    - [Step 4: Implement (Phased Loop)](#step-4-implement-phased-loop)
    - [Step 5: Review & Refine](#step-5-review--refine)
    - [Step 6: Reconcile Docs](#step-6-reconcile-docs)
    - [Step 7: Finalize](#step-7-finalize)
  - [4. Workflow 2: Autopilot (Product Manager Orchestration)](#4-workflow-2-autopilot-product-manager-orchestration)
    - [Step 1: High-Level Handoff](#step-1-high-level-handoff)
    - [Step 2: PM Orchestration (Autonomous)](#step-2-pm-orchestration-autonomous)
    - [Step 3: Delivery (Autonomous)](#step-3-delivery-autonomous)
    - [Step 4: User Acceptance](#step-4-user-acceptance)
  - [5. Best Practices](#5-best-practices)
  <!-- TOC -->

---

## 1. Overview

Opencode provides a **specification-driven** workflow where AI acts as a co-engineer. The core principle is **Traceability**:
`Business Intent → Change Spec → Implementation Plan → Test Plan → Code → System Spec`

- **Commands** (`/command`): Deterministic macros that perform specific tasks (e.g., generating a file from a template).
- **Agents** (`@agent`): Autonomous roles that can reason, plan, and orchestrate multiple steps or other agents.

---

## 2. Reference: Agents & Commands

### 2.1 Commands (Automation Macros)

Use these when you want to trigger a specific step in the process.

| Command                  | Description                                                   | When to use                                |
| :----------------------- | :------------------------------------------------------------ | :----------------------------------------- |
| `/plan-change`           | Interactive session to define a change (scope, goals, risks). | **Step 1**: To start a new feature or fix. |
| `/write-spec <ref>`      | Generates the canonical `chg-<ref>-spec.md` file.             | **Step 2**: After planning is complete.    |
| `/write-plan <ref>`      | Generates the phased `chg-<ref>-plan.md`.                     | **Step 3**: After the spec is approved.    |
| `/write-test-plan <ref>` | Generates the test strategy `chg-<ref>-test-plan.md`.         | **Step 4**: Before implementation starts.  |
| `/run-plan <ref>`        | Launches the **Executor** to code the active phase.           | **Step 5**: To write code.                 |
| `/review <ref>`          | Launches the **Reviewer** to critique work.                   | **Step 6**: After coding a phase.          |
| `/sync-docs <ref>`       | Reconciles `doc/spec` with the implemented change.            | **Step 7**: Before merging.                |
| `/commit`                | Creates one Conventional Commit.                              | When saving progress.                      |
| `/pr`                    | Creates/updates a PR/MR and syncs title + description.        | When preparing for review/merge.           |
| `/plan-decision`         | Interactive session for architectural decisions.              | When a complex trade-off needs an ADR.     |
| `/write-adr`             | Generates the formal ADR document.                            | After the decision session.                |
| `/check`                 | Runs quality gates and summarizes logs to files.              | When you need clean, shareable results.    |
| `/check-fix`             | Runs quality gates and auto-fixes failures.                   | When you want automatic remediation.       |

### 2.2 Agents (Autonomous Roles)

Use these when you need intelligent analysis or orchestration.

| Agent             | Role                                                                                       | Usage                                           |
| :---------------- | :----------------------------------------------------------------------------------------- | :---------------------------------------------- |
| `@pm`             | **Orchestrator**. Manages tickets (Jira/GitHub) and turns backlog into accepted artifacts. | Use for **Autopilot** (see Section 4).          |
| `@delivery-agent` | **Executor**. Delivers a specified change end-to-end.                                      | Invoked by PM or User to run the delivery loop. |
| `@architect`      | **Advisor**. CTO-level sparring partner.                                                   | Use for complex design decisions or ADRs.       |
| `@fixer`          | **Troubleshooter**. Fixes broken tests or quality gates.                                   | Use when tests fail or bugs arise.              |
| `@designer`       | **Designer**. Implements UI/UX per design system.                                          | Use for frontend work.                          |
| `@image-reviewer` | **Reviewer**. Analyzes screenshots for visual bugs.                                        | Use to check UI artifacts or report glitches.   |
| `@runner`         | **Runner**. Executes commands and summarizes logs to artifacts.                            | Use for log-heavy builds/tests/gates.           |
| `@editor`         | **Writer**. Reviews, rewrites, and translates content per guidelines.                      | Use for docs/articles/i18n/UI copy.             |
| `@committer`      | **Scribe**. Creates standardized commits.                                                  | Helper used by other agents/commands.           |
| `@pr-manager`     | **PR/MR Manager**. Creates/updates PR/MR for current branch.                               | Use at the end of delivery; never merges.       |

---

## 3. Workflow 1: Manual Change Orchestration

In this workflow, **you** act as the lead engineer, triggering each step explicitly. This offers maximum control.

### Step 1: Plan the Change

Start an interactive session to clarify requirements.

```bash
/plan-change [optional-idea-text]
```

_Output_: A structured planning summary in the chat.

### Step 2: Generate the Spec

Turn the planning summary into a canonical file.

```bash
/write-spec <ref>
```

_Output_: `doc/changes/.../chg-<ref>-spec.md`

> **Recommendation**: Open the generated `chg-<ref>-spec.md` file and review it carefully. If the requirements (
> acceptance criteria, interface definitions) are incorrect, the downstream plans and code will be incorrect. Edit the
> file directly if needed before proceeding.

### Step 3: Generate Plans

Create the implementation and test plans based on the spec.

```bash
/write-plan <ref>
/write-test-plan <ref>
```

_Output_: `chg-<ref>-plan.md` and `chg-<ref>-test-plan.md`

> **Recommendation**: Review the plan and test plan files. Ensure the implementation phases
> make logical sense and the test scenarios cover the acceptance criteria before starting execution.

### Step 4: Implement (Phased Loop)

Execute the plan one phase at a time.

```bash
/run-plan <ref>
```

_Action_: The agent reads the plan, implements the current phase, updates the plan checklist, and runs relevant
validations (for log-heavy runs it may delegate to `@runner`).

### Step 5: Review & Refine

Ask for a code review against the spec.

```bash
/review <ref>
```

_Action_: The reviewer checks code vs. spec. If issues are found, it adds a remediation phase to your plan. You then run
`/run-plan <ref>` again to fix them.

### Step 6: Reconcile Docs

Update the "current truth" documentation.

```bash
/sync-docs <ref>
```

_Action_: Updates `doc/spec/**` and `doc/contracts/**`.

### Step 7: Finalize

Commit and prepare for merge.

```bash
/commit
/pr
```

`/pr` will create or update the PR/MR for your current branch and write:

- `tmp/pr/<branch>/description.md`

For large branches it may also create `tmp/pr/<branch>/review-plan.md` + `tmp/pr/<branch>/review-log.md` and reuse them
incrementally on reruns. It will not merge; review and merge manually.

If there are uncommitted changes, `/pr` will auto-commit via `@committer` and then push the branch.

---

## 4. Workflow 2: Autopilot (Product Manager Orchestration)

In this workflow, you act as the **Stakeholder**. You provide the "What" and "Why", and the **PM Agent**
orchestrates the "How" by coordinating other agents.

> **Repo configuration**: `@pm` reads `doc/planning/pm-instructions.md` for Jira/GitHub project keys, labels, and status mapping.

### Step 1: High-Level Handoff

Invoke the PM agent with your requirements or reference a backlog item.

> **User**: "Agent, please act as @pm. I want to add a new 'Dark Mode' feature to the settings page. It
> should persist in the user profile."

### Step 2: PM Orchestration (Autonomous)

The `@pm` will:

1. **Intake**: Clarify requirements with you if needed.
2. **Ticket**: Query or create the tracker ticket (Jira/GitHub) via MCP; record branch name and artifact links.
3. **Plan**: Internally run the planning process.
4. **Delegate**:
   - Call `@spec-writer` to create the spec.
   - Call `@plan-writer` to create the plan.
   - Call `@test-plan-writer` to create the test plan.
5. **Sync**: Update ticket status and link artifacts back to the tracker.
6. **Handoff**: Once artifacts are ready, hand off to the `@delivery-agent`.

> **Note**: In Autopilot mode, the `@pm` performs validation steps internally (reviewing spec vs plan vs
> tests) or will explicitly ask for your approval at key gates. This removes the need for you to manually review every
> intermediate file unless requested.

### Step 3: Delivery (Autonomous)

The `@delivery-agent` will:

1. **Cross-check** the plans.
2. **Execute** the implementation phases (calling `@executor`, `@designer` etc.).
3. **Review** the work (calling `@reviewer`).
4. **Reconcile** docs (calling `@doc-syncer`).
5. **Verify** quality gates (calling `@runner` first; escalate to `@fixer` only if fixes are required).
6. **Handoff to PM for pre-PR gate**: `@pm` re-runs required internal checks (review + doc sync) before creating/updating the PR/MR.

### Step 4: User Acceptance

The `@pm` will report back when the change is ready for final verification and then STOP.

Before creating/updating the PR/MR, `@pm` must run a **pre-PR internal gate**:

1. Run `@reviewer` (and if it returns `Status=FAIL` / adds remediation: ensure tasks are captured in the change plan and executed via `@executor`, then re-review until `Status=PASS`).
2. Run `@doc-syncer` to reconcile system docs (and re-run it if substantial refactors happened after the last doc sync).
3. Confirm plan tasks + acceptance criteria are complete, tests are implemented and passing, and system specs are updated.

Then `@pm` creates/updates the PR/MR via `@pr-manager` and stops for user approval and manual merge.
You review and merge manually.

---

## 5. Best Practices

- **Trust the Artifacts**: Don't try to "prompt" your way through complex coding. Generate the Spec and Plan first. The
  agents work much better when they have a document to follow.
- **One Change at a Time**: Keep changes scoped. If a change gets too big, split it.
- **Review the Spec**: The AI writes the spec, but **you** must read it. If the spec is wrong, the code will be wrong.
- **Use the IDs**: Refer to requirements by ID (e.g., "F-1", "AC-2") when discussing issues with agents.
- **Filesystem is Memory**: Agents rely on the files in `doc/changes/`. Do not delete them until the change is merged
  and settled.
- **Tracker is Source of Truth**: The external tracker (Jira/GitHub) owns workflow status. `@pm` syncs status via MCP;
  Git artifacts support implementation and auditability but do not replace tracker state.
