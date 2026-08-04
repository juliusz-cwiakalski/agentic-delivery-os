---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-08/2026-08-04--GH-151--centralize-git-operations/chg-GH-151-test-plan.md
id: chg-GH-151-test-plan
status: Proposed
created: 2026-08-04
last_updated: 2026-08-04
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["agent-improvement", "git-operations", "conventional-commits", "prompt-governance"]
version_impact: minor
summary: "Establish one branch owner (PM in autonomous mode, commands in manual mode) and one commit path (@committer) across the agent/command team, eliminating six direct-commit bypass paths and ensuring universal secret/credential scanning, forbidden-path exclusion, and diff-derived Conventional Commit messages."
links:
  change_spec: ./chg-GH-151-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Centralize git operations: PM owns branch setup, all commits route through @committer

## 1. Scope and Objectives

This test plan validates a prompt/documentation refactor that centralizes git operations across the agent/command team. The change refactors the responsibility model so that the orchestrator (PM in autonomous mode, commands in manual mode, @coder for delivery) owns branch state and commit triggers, while delegated agents become pure writers with zero git operations. All commits route through @committer, ensuring universal safety scanning, forbidden-path exclusion, and diff-derived Conventional Commit messages.

The core behaviors to protect are:
- Six direct-commit bypass paths are eliminated, restoring universal @committer routing
- Every commit passes through secret/credential scanning and .gitignore enforcement
- Commit history becomes clean and phase-aligned (≥1 commit per lifecycle phase)
- Artifact agents become pure writers, shrinking prompts and reducing maintenance surface

Data/security integrity risks addressed:
- Secret/credential leakage from uncommitted files now universally scanned
- Forbidden paths (tmp/, .ai/local/) excluded from every commit
- Git operations reduced to one canonical path, lowering regression surface

Regressions this change guards against:
- Divergent commit implementations re-emerging across agents
- Branch-ensure logic being re-duplicated across artifact agents
- Hardcoded commit messages circumventing diff-derived Conventional Commits

### 1.1 In Scope

- Static verification that delegated agent prompts contain zero direct git operations
- Static verification that agent prompts other than @committer contain no direct `git commit`
- Behavioral verification that a test delivery produces clean, phase-aligned commits
- Regression verification that already-correct agents (@coder, @meeting-organizer, @pr-manager) remain unchanged
- Build verification that the Claude plugin regenerates correctly and the freshness guard passes
- Documentation verification that the responsibility model is properly recorded in change-lifecycle.md
- Grep-based acceptance criteria validation for NFR-1 (no direct commits outside @committer)

### 1.2 Out of Scope & Known Gaps

- [OUT] Unit/integration tests for application code (this is a prompt refactor with no app code changes)
- [OUT] Performance testing of @committer itself (unchanged by this change)
- [OUT] End-to-end testing of the full 11-phase autonomous delivery lifecycle (beyond a single test delivery)
- [OUT] Testing of the OpenCode session execution model (unchanged, per NG-4)
- [OUT] Testing of @committer's internal logic or safety thresholds (unchanged, per NG-2)
- [OUT] Automated regression test suite for the agent inventory (manual grep gates suffice)

## 2. References

- **Change Specification**: [chg-GH-151-spec.md](./chg-GH-151-spec.md) — complete requirements, acceptance criteria, and affected components
- **Testing Strategy**: [.ai/rules/testing-strategy.md](.ai/rules/testing-strategy.md) — test layers, quality gates, and fallback rules
- **Decision Records**:
  - ODR-0001: Classify YAML register templates as redistributable (for doc-distribution guard)
- **Related Guides**:
  - [doc/guides/change-lifecycle.md](../../guides/change-lifecycle.md) — will receive responsibility-model documentation
  - [AGENTS.md](../../AGENTS.md) — agent inventory and delivery process table (align if needed)
- **Tool References**:
  - `scripts/build-claude-plugin.sh` — plugin regeneration script
  - `scripts/.tests/test-doc-distribution.sh` — doc-distribution guard CI check

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F3-1 | spec-writer, test-plan-writer, plan-writer contain zero git operations and pure-write note | TC-GIT-001, TC-GIT-002, TC-GIT-003 | Covered |
| AC-F3-2 | doc-syncer delegates no direct commit, no multi-commit split | TC-GIT-004 | Covered |
| AC-F3-3 | reviewer (local mode) performs no direct commit | TC-GIT-005 | Covered |
| AC-F3-4 | decision-advisor performs no direct commit | TC-GIT-006 | Covered |
| AC-F1-1 | PM ensures branch exists and records it before first delegation | TC-GIT-007 | Covered |
| AC-F2-1 | PM triggers @committer after each delegated lifecycle phase returns | TC-GIT-008 | Covered |
| AC-F2-2 | Manual commands /write-spec, /write-test-plan, /write-plan, /sync-docs trigger /commit | TC-GIT-009 | Covered |
| AC-F2-3 | /write-decision triggers /commit after @decision-advisor returns | TC-GIT-010 | Covered |
| AC-F5-1 | PM triggers @committer to commit readiness-reviewer verdict | TC-GIT-011 | Covered |
| AC-F4-1 | Grep across agent inventory returns zero direct `git commit` (excluding @committer) | TC-GIT-012 | Covered |
| AC-F7-1 | change-lifecycle.md documents responsibility model | TC-GIT-013 | Covered |
| AC-F8-1 | .ados-claude/ regenerated, CI freshness guard green | TC-GIT-014 | Covered |
| AC-F6-1 | All prompt edits performed via @toolsmith (no hand-edits) | TC-GIT-015 | Covered |
| AC-F2-4 | Test delivery produces clean, phase-aligned commit history | TC-GIT-016 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| DM-1 | @committer <intent> hint contract (unchanged, used by orchestrators) | TC-GIT-008, TC-GIT-009, TC-GIT-010, TC-GIT-011 | Covered |
| DM-2 | pm-context.yaml branch field (branch guaranteed to exist) | TC-GIT-007 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Zero direct commits outside @committer (grep-verified) | TC-GIT-012 | Covered |
| NFR-2 | Zero branch/commit logic in delegated agents | TC-GIT-001 through TC-GIT-006 | Covered |
| NFR-3 | ≥1 @committer commit per delivered lifecycle phase (autonomous) | TC-GIT-016 | Covered |
| NFR-4 | Exactly 1 /commit per manual artifact command invocation | TC-GIT-009, TC-GIT-010 | Covered |
| NFR-5 | 100% of @no commit directives honored | TC-GIT-008, TC-GIT-009 | Covered |
| NFR-6 | 100% of commits pass @committer safety scans | TC-GIT-012, TC-GIT-016 | Covered |
| NFR-7 | .ados-claude/ regenerated, CI guard green | TC-GIT-014 | Covered |
| NFR-8 | 100% of prompt edits performed via @toolsmith | TC-GIT-015 | Covered |

## 4. Test Types and Layers

This is a prompt/documentation refactor change with no application code. The testing strategy adapts the repository's static/diff + content approach to the git-operations refactoring domain:

- **Static verification tests**: Grep-based searches for git operations in agent prompts, verifying that delegated agents are pure writers and that @committer is the only commit path (NFR-1, NFR-2). Framework: bash/rg; location: .opencode/ directory.
- **Content verification tests**: Manual review of prompt changes to confirm pure-writer notes, branch/commit logic removal, and @committer trigger additions. Framework: manual read; location: .opencode/agent/ and .opencode/command/.
- **Behavioral verification tests**: End-to-end test delivery (manual or autonomous) producing a clean, phase-aligned commit history. Framework: manual execution with @pm or commands; location: feature branch with traceability.
- **Regression tests**: Grep checks confirming already-correct agents (@coder, @meeting-organizer, @pr-manager) retain their correct commit delegation. Framework: bash/rg; location: .opencode/agent/.
- **Build/tests**: Plugin regeneration script execution and doc-distribution guard CI check. Framework: bash; location: scripts/ directory.

**Per repository testing strategy**:
- Static/diff checks: `git diff --check` for whitespace/conflict markers (always required)
- Content checks: manual traceability review against spec AC (for docs/template changes)
- Fallback rule: since no automated tests exist for prompt changes, we mark automated tests as N/A and require manual verification + static checks

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-GIT-001 | spec-writer agent is pure writer (no git operations) | Regression | Important | High | AC-F3-1 |
| TC-GIT-002 | test-plan-writer agent is pure writer (no git operations) | Regression | Important | High | AC-F3-1 |
| TC-GIT-003 | plan-writer agent is pure writer (no git operations) | Regression | Important | High | AC-F3-1 |
| TC-GIT-004 | doc-syncer agent is pure writer (no direct commit, no multi-commit split) | Regression | Important | High | AC-F3-2 |
| TC-GIT-005 | reviewer agent (local mode) is pure writer (no direct commit) | Regression | Important | High | AC-F3-3 |
| TC-GIT-006 | decision-advisor agent is pure writer (no direct commit) | Regression | Important | High | AC-F3-4 |
| TC-GIT-007 | PM ensures branch before first delegation (autonomous mode) | Happy Path | Important | High | AC-F1-1 |
| TC-GIT-008 | PM triggers @committer after each delegated phase (autonomous mode) | Happy Path | Critical | High | AC-F2-1, NFR-3, NFR-5 |
| TC-GIT-009 | Manual commands trigger /commit after agent returns | Happy Path | Important | High | AC-F2-2, NFR-4 |
| TC-GIT-010 | /write-decision triggers /commit after @decision-advisor returns | Happy Path | Important | High | AC-F2-3 |
| TC-GIT-011 | PM commits readiness-reviewer verdict after DoR check | Happy Path | Important | High | AC-F5-1 |
| TC-GIT-012 | Structural check: six delegated agents have no `<branch_rules>`/`<commit_rules>` sections and zero imperative commit instructions (prohibition text allowlisted; reviewer remote-mode checkouts excluded) | Negative | Critical | High | AC-F4-1, NFR-1, NFR-2 |
| TC-GIT-013 | change-lifecycle.md documents responsibility model | Happy Path | Minor | Medium | AC-F7-1 |
| TC-GIT-014 | Claude plugin regenerates and freshness guard passes | Happy Path | Important | High | AC-F8-1, NFR-7 |
| TC-GIT-015 | All prompt edits performed via @toolsmith (no hand-edits) | Process | Important | High | AC-F6-1, NFR-8 |
| TC-GIT-016 | Test delivery produces clean, phase-aligned commit history | Happy Path | Critical | High | AC-F2-4, NFR-3, NFR-6 |

### 5.2 Scenario Details

#### TC-GIT-001 - spec-writer agent is pure writer (no git operations)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-2
**Test Type(s)**: Static verification
**Automation Level**: Automated (grep)
**Target Layer / Location**: .opencode/agent/spec-writer.md
**Tags**: @prompt, @verification, @git-operations

**Preconditions**:
- The spec-writer agent prompt has been modified by @toolsmith per F-6

**Steps**:
1. Run grep for direct git operations: `rg "git checkout|git branch|git add|git commit" .opencode/agent/spec-writer.md`
2. Run grep for branch rules: `rg "<branch_rules>|<commit_rules>|stage ONLY this file" .opencode/agent/spec-writer.md`
3. Run grep for pure-write note: `rg "pure writer|zero git operations" .opencode/agent/spec-writer.md`
4. Verify that git operation grep returns zero matches
5. Verify that branch/commit logic grep returns zero matches
6. Verify that pure-write note is present

**Expected Outcome**:
- Zero matches for git operations, branch rules, or commit rules
- Pure-write note present indicating orchestrator handles branch and commit

#### TC-GIT-002 - test-plan-writer agent is pure writer (no git operations)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-2
**Test Type(s)**: Static verification
**Automation Level**: Automated (grep)
**Target Layer / Location**: .opencode/agent/test-plan-writer.md
**Tags**: @prompt, @verification, @git-operations

**Preconditions**:
- The test-plan-writer agent prompt has been modified by @toolsmith per F-6

**Steps**:
1. Run grep for direct git operations: `rg "git checkout|git branch|git add|git commit" .opencode/agent/test-plan-writer.md`
2. Run grep for branch rules: `rg "<branch_rules>|<commit_rules>|stage ONLY this file" .opencode/agent/test-plan-writer.md`
3. Run grep for pure-write note: `rg "pure writer|zero git operations" .opencode/agent/test-plan-writer.md`
4. Verify that git operation grep returns zero matches
5. Verify that branch/commit logic grep returns zero matches
6. Verify that pure-write note is present

**Expected Outcome**:
- Zero matches for git operations, branch rules, or commit rules
- Pure-write note present indicating orchestrator handles branch and commit

#### TC-GIT-003 - plan-writer agent is pure writer (no git operations)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-2
**Test Type(s)**: Static verification
**Automation Level**: Automated (grep)
**Target Layer / Location**: .opencode/agent/plan-writer.md
**Tags**: @prompt, @verification, @git-operations

**Preconditions**:
- The plan-writer agent prompt has been modified by @toolsmith per F-6

**Steps**:
1. Run grep for direct git operations: `rg "git checkout|git branch|git add|git commit" .opencode/agent/plan-writer.md`
2. Run grep for branch rules: `rg "<branch_rules>|<commit_rules>|stage ONLY this file" .opencode/agent/plan-writer.md`
3. Run grep for pure-write note: `rg "pure writer|zero git operations" .opencode/agent/plan-writer.md`
4. Verify that git operation grep returns zero matches
5. Verify that branch/commit logic grep returns zero matches
6. Verify that pure-write note is present

**Expected Outcome**:
- Zero matches for git operations, branch rules, or commit rules
- Pure-write note present indicating orchestrator handles branch and commit

#### TC-GIT-004 - doc-syncer agent is pure writer (no direct commit, no multi-commit split)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-2, NFR-2
**Test Type(s)**: Static verification
**Automation Level**: Automated (grep)
**Target Layer / Location**: .opencode/agent/doc-syncer.md
**Tags**: @prompt, @verification, @git-operations

**Preconditions**:
- The doc-syncer agent prompt has been modified by @toolsmith per F-6

**Steps**:
1. Run grep for direct git commit: `rg "git commit" .opencode/agent/doc-syncer.md`
2. Run grep for multi-commit split logic: `rg "split|more than.*files|two commits" .opencode/agent/doc-syncer.md`
3. Run grep for pure-write note: `rg "pure writer|zero git operations" .opencode/agent/doc-syncer.md`
4. Verify that git commit grep returns zero matches
5. Verify that multi-commit split logic grep returns zero matches
6. Verify that pure-write note is present

**Expected Outcome**:
- Zero matches for git commit or multi-commit split logic
- Pure-write note present indicating orchestrator handles branch and commit

#### TC-GIT-005 - reviewer agent (local mode) is pure writer (no direct commit)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-3, NFR-2
**Test Type(s)**: Static verification
**Automation Level**: Automated (grep)
**Target Layer / Location**: .opencode/agent/reviewer.md
**Tags**: @prompt, @verification, @git-operations

**Preconditions**:
- The reviewer agent prompt has been modified by @toolsmith per F-6

**Steps**:
1. Run grep for direct git commit: `rg "git commit" .opencode/agent/reviewer.md`
2. Run grep for staging logic in local mode: `rg "stage.*plan file|git add" .opencode/agent/reviewer.md`
3. Run grep for pure-write note: `rg "pure writer|zero git operations|command triggers.*commit" .opencode/agent/reviewer.md`
4. Verify that git commit grep returns zero matches
5. Verify that staging logic grep returns zero matches
6. Verify that pure-write note or command trigger note is present

**Expected Outcome**:
- Zero matches for git commit or staging logic
- Note present indicating command triggers /commit in local mode

#### TC-GIT-006 - decision-advisor agent is pure writer (no direct commit)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-4, DEC-3, NFR-2
**Test Type(s)**: Static verification
**Automation Level**: Automated (grep)
**Target Layer / Location**: .opencode/agent/decision-advisor.md
**Tags**: @prompt, @verification, @git-operations

**Preconditions**:
- The decision-advisor agent prompt has been modified by @toolsmith per F-6

**Steps**:
1. Run grep for direct git commit: `rg "git commit" .opencode/agent/decision-advisor.md`
2. Run grep for staging logic: `rg "stage.*decision record|git add" .opencode/agent/decision-advisor.md`
3. Run grep for pure-write note: `rg "pure writer|zero git operations|orchestrator.*commit" .opencode/agent/decision-advisor.md`
4. Verify that git commit grep returns zero matches
5. Verify that staging logic grep returns zero matches
6. Verify that pure-write note or orchestrator commit note is present

**Expected Outcome**:
- Zero matches for git commit or staging logic
- Note present indicating orchestrator triggers @committer

#### TC-GIT-007 - PM ensures branch before first delegation (autonomous mode)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-2
**Test Type(s)**: Content verification
**Automation Level**: Manual
**Target Layer / Location**: .opencode/agent/pm.md
**Tags**: @prompt, @branch-operations, @orchestrator

**Preconditions**:
- The PM agent prompt has been modified by @toolsmith per F-6

**Steps**:
1. Read the PM agent prompt to locate the pre-delegation workflow
2. Search for branch-ensure step before first delegation: `rg "ensure.*branch|checkout.*branch|create.*branch" .opencode/agent/pm.md`
3. Verify that branch-ensure step is present and uses the correct naming convention: `<type>/<workItemRef>/<slug>`
4. Verify that branch is recorded in pm-context.yaml
5. Verify that no other agent in autonomous mode touches branch state

**Expected Outcome**:
- Branch-ensure step present before first delegation
- Branch recorded in pm-context.yaml
- Correct naming convention used

#### TC-GIT-008 - PM triggers @committer after each delegated phase (autonomous mode)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-1, AC-F5-1, NFR-3, NFR-5
**Test Type(s)**: Content verification, Behavioral verification
**Automation Level**: Manual
**Target Layer / Location**: .opencode/agent/pm.md
**Tags**: @prompt, @commit-operations, @orchestrator

**Preconditions**:
- The PM agent prompt has been modified by @toolsmith per F-6

**Steps**:
1. Read the PM agent prompt to locate the post-delegation workflow for each lifecycle phase
2. Search for @committer trigger after spec-writer returns: `rg "specification.*returns|@committer" .opencode/agent/pm.md`
3. Search for @committer trigger after test-plan-writer returns: `rg "test-planning.*returns|@committer" .opencode/agent/pm.md`
4. Search for @committer trigger after plan-writer returns: `rg "delivery-planning.*returns|@committer" .opencode/agent/pm.md`
5. Search for @committer trigger after readiness-reviewer returns: `rg "dor-check.*returns|@committer" .opencode/agent/pm.md`
6. Search for @committer trigger after doc-syncer returns: `rg "system-spec-update.*returns|@committer" .opencode/agent/pm.md`
7. Search for @committer trigger after reviewer returns: `rg "review-fix.*returns|@committer" .opencode/agent/pm.md`
8. Search for `no commit` directive handling: `rg "no commit|suppress.*trigger" .opencode/agent/pm.md`
9. Verify that each phase has a @committer trigger (unless `no commit` directive present)
10. Verify that intent hints are passed to @committer per phase

**Expected Outcome**:
- @committer trigger present after each delegated phase returns
- `no commit` directive checked before triggering
- Intent hints passed to @committer for phase-appropriate messages

#### TC-GIT-009 - Manual commands trigger /commit after agent returns

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-2, NFR-4
**Test Type(s)**: Content verification
**Automation Level**: Manual
**Target Layer / Location**: .opencode/command/write-spec.md, .opencode/command/write-test-plan.md, .opencode/command/write-plan.md, .opencode/command/sync-docs.md
**Tags**: @prompt, @commit-operations, @commands

**Preconditions**:
- The manual commands have been modified by @toolsmith per F-6

**Steps**:
1. Read /write-spec command: verify branch-ensure step is retained and /commit trigger is added after @spec-writer returns
2. Read /write-test-plan command: verify branch-ensure step is retained and /commit trigger is added after @test-plan-writer returns
3. Read /write-plan command: verify branch-ensure step is retained and /commit trigger is added after @plan-writer returns
4. Read /sync-docs command: verify branch-ensure step is retained and /commit trigger is added after @doc-syncer returns (no multi-commit split)
5. Search for `no commit` directive handling in each command: `rg "no commit|suppress.*trigger" .opencode/command/`

**Expected Outcome**:
- Each command retains branch-ensure step
- Each command triggers /commit after agent returns
- `no commit` directive checked before triggering

#### TC-GIT-010 - /write-decision triggers /commit after @decision-advisor returns

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-3
**Test Type(s)**: Content verification
**Automation Level**: Manual
**Target Layer / Location**: .opencode/command/write-decision.md
**Tags**: @prompt, @commit-operations, @commands

**Preconditions**:
- The /write-decision command has been modified by @toolsmith per F-6

**Steps**:
1. Read /write-decision command
2. Search for /commit trigger after @decision-advisor returns: `rg "@decision-advisor.*returns|/commit" .opencode/command/write-decision.md`
3. Verify that /commit trigger is present
4. Verify that intent hint is passed to /commit for the decision record

**Expected Outcome**:
- /commit trigger present after @decision-advisor returns
- Intent hint passed for decision record message

#### TC-GIT-011 - PM commits readiness-reviewer verdict after DoR check

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1
**Test Type(s)**: Content verification
**Automation Level**: Manual
**Target Layer / Location**: .opencode/agent/pm.md, .opencode/agent/readiness-reviewer.md
**Tags**: @prompt, @commit-operations, @traceability

**Preconditions**:
- The PM and readiness-reviewer agents have been modified by @toolsmith per F-6

**Steps**:
1. Read readiness-reviewer agent prompt: verify it does not commit the verdict (pure writer)
2. Read PM agent prompt: verify it triggers @committer after @readiness-reviewer returns
3. Search for verdict commit logic in PM: `rg "readiness-reviewer.*returns|verdict|@committer" .opencode/agent/pm.md`
4. Verify that @committer is triggered to commit the verdict file

**Expected Outcome**:
- Readiness-reviewer is pure writer (no commit)
- PM triggers @committer to commit verdict file

#### TC-GIT-012 - Structural check: six delegated agents own no branch/commit rules and have zero imperative commit instructions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-1, NFR-2
**Test Type(s)**: Static verification
**Automation Level**: Automated (grep)
**Target Layer / Location**: .opencode/agent/, .opencode/command/
**Tags**: @prompt, @verification, @git-operations, @nfr

**Preconditions**:
- All agent and command prompt modifications are complete

**Steps**:
1. **Structural branch-ownership check (NFR-2)**: `rg "<branch_rules>" .opencode/agent/spec-writer.md .opencode/agent/test-plan-writer.md .opencode/agent/plan-writer.md .opencode/agent/doc-syncer.md .opencode/agent/reviewer.md .opencode/agent/decision-advisor.md` → must return 0 matches. A delegated agent that defines a `<branch_rules>` section owns branch logic, violating the pure-writer model. This deliberately replaces the earlier broad `git checkout|git branch` grep, which false-matched `reviewer.md`'s legitimate remote-mode (`modes="remote"`) checkout instructions at line 161 (`git checkout --detach <head_sha>`) and line 304 (`git checkout <original_branch>`); those live inside `<process>` steps, not inside a `<branch_rules>` section, and are out of scope for this change.
2. **Structural commit-ownership check (NFR-1, NFR-2)**: `rg "<commit_rules>" .opencode/agent/spec-writer.md .opencode/agent/test-plan-writer.md .opencode/agent/plan-writer.md .opencode/agent/doc-syncer.md .opencode/agent/reviewer.md .opencode/agent/decision-advisor.md` → must return 0 matches.
3. **Imperative commit-instruction check (defense-in-depth)**: `rg "Commit with:|git commit -F|create a single commit|Stage ONLY|\.add\(|\.commit\(|git add|git commit" .opencode/agent/spec-writer.md .opencode/agent/test-plan-writer.md .opencode/agent/plan-writer.md .opencode/agent/doc-syncer.md .opencode/agent/reviewer.md .opencode/agent/decision-advisor.md` → must return 0 actionable matches.
4. Allowlist check: if any match appears in step 3, verify it is prohibition/guidance text only (e.g., "never use git commit", "no git commit") and not an actionable commit instruction; any actionable instruction must be removed via `@toolsmith`.

**Expected Outcome**:
- Zero matches for `<branch_rules>` across the 6 delegated agents (no delegated agent owns branch logic)
- Zero matches for `<commit_rules>` across the 6 delegated agents (no delegated agent owns commit logic)
- Zero actionable matches for imperative commit instructions (prohibition text allowlisted)

#### TC-GIT-013 - change-lifecycle.md documents responsibility model

**Scenario Type**: Happy Path
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-7, AC-F7-1
**Test Type(s)**: Content verification
**Automation Level**: Manual
**Target Layer / Location**: doc/guides/change-lifecycle.md
**Tags**: @documentation, @responsibility-model

**Preconditions**:
- The change-lifecycle guide has been updated to document the responsibility model

**Steps**:
1. Read doc/guides/change-lifecycle.md
2. Search for responsibility model section: `rg "responsibility.*model|branch.*owner|commit.*trigger" doc/guides/change-lifecycle.md`
3. Verify that branch ownership per mode is documented (PM autonomous, commands manual)
4. Verify that commit trigger ownership per phase is documented
5. Verify that the universal "@committer is the only commit path" rule is documented
6. Compare with Appendix A of the spec to ensure completeness

**Expected Outcome**:
- Responsibility model section present and complete
- Branch ownership, commit trigger ownership, and universal routing documented

#### TC-GIT-014 - Claude plugin regenerates and freshness guard passes

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-7
**Test Type(s)**: Build verification
**Automation Level**: Automated (script)
**Target Layer / Location**: scripts/, .ados-claude/
**Tags**: @build, @plugin, @freshness

**Preconditions**:
- All .opencode/ prompt modifications are complete

**Steps**:
1. Run plugin build script: `bash scripts/build-claude-plugin.sh`
2. Verify that .ados-claude/ directory is regenerated with updated content
3. Run freshness guard check: `bash scripts/.tests/test-doc-distribution.sh` (or the equivalent CI check)
4. Verify that the freshness guard passes (no drift detected)

**Expected Outcome**:
- Plugin build script completes successfully
- .ados-claude/ regenerated
- Freshness guard passes (CI green)

#### TC-GIT-015 - All prompt edits performed via @toolsmith (no hand-edits)

**Scenario Type**: Process
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-8
**Test Type(s)**: Process verification
**Automation Level**: Manual
**Target Layer / Location**: .opencode/
**Tags**: @process, @prompt-governance, @toolsmith

**Preconditions**:
- The delivery plan is executed and prompt edits are complete

**Steps**:
1. Review the delivery plan for all prompt-edit tasks
2. Verify that each prompt-edit task explicitly delegates to @toolsmith
3. Verify that the delivery plan contains no direct edit instructions (e.g., "edit file", "replace text") for agent or command prompts
4. Verify that the commit history (if available) shows @toolsmith delegation

**Expected Outcome**:
- All prompt edits explicitly delegated to @toolsmith
- No direct edit instructions in the delivery plan
- Process compliant with repo prompt-governance rule

#### TC-GIT-016 - Test delivery produces clean, phase-aligned commit history

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-4, NFR-3, NFR-6
**Test Type(s)**: Behavioral verification
**Automation Level**: Manual
**Target Layer / Location**: Feature branch
**Tags**: @behavior, @commit-history, @phase-alignment

**Preconditions**:
- All prompt modifications are complete
- Branch is checked out and ready for test delivery

**Steps**:
1. Run a test delivery (manual or autonomous) for a small change
2. After delivery completes, inspect the feature branch commit history: `git log --oneline`
3. Verify that there is at least one commit per lifecycle phase (specification, test-planning, delivery-planning, dor-check, delivery phases, system-spec-update, review-fix)
4. Verify that all commit messages are Conventional Commits (type: scope)
5. Verify that no commit messages are hardcoded per-agent strings (e.g., "docs: add spec for GH-151" not "spec written by spec-writer")
6. Verify that commits are phase-aligned (spec commit before test plan, test plan before delivery plan, etc.)
7. Verify that readiness verdict commits are present for each DoR iteration (if multiple)

**Expected Outcome**:
- ≥1 commit per lifecycle phase
- All commit messages are Conventional Commits
- No hardcoded per-agent commit messages
- Commits are phase-aligned
- Readiness verdict commits present for traceability

## 6. Environments and Test Data

### Required Environments

- **Local dev environment**: Primary environment for all tests. Requires:
  - Git repo initialized on branch `refactor/GH-151/centralize-git-operations`
  - OpenCode agent/command definitions accessible in `.opencode/`
  - Bash/rg (ripgrep) available for grep-based tests
  - Python/bash interpreter for script execution

- **Clean worktree requirement**: For TC-GIT-016 (behavioral verification), ensure a clean git status between phases to avoid unintended staging.

### Test Data Generation

- No persistent test data required; tests operate on prompt definitions and git history
- For TC-GIT-016, use a small test change (e.g., documentation update) to avoid unnecessary complexity
- Test delivery should use a distinct workItemRef (e.g., GH-TEST) to avoid conflicts with real tickets

### Isolation Strategy

- Static verification tests (TC-GIT-001 through TC-GIT-012) read-only on `.opencode/` — no git state mutated
- Content verification tests (TC-GIT-007 through TC-GIT-011, TC-GIT-013) read-only on `.opencode/` and `doc/guides/` — no git state mutated
- Build verification test (TC-GIT-014) regenerates `.ados-claude/` — commits alongside source changes in delivery plan
- Process verification test (TC-GIT-015) reviews delivery plan — read-only
- Behavioral verification test (TC-GIT-016) creates a test change on a separate feature branch or uses a test artifact — isolates from production changes

## 7. Automation Plan and Implementation Mapping

This is a prompt/documentation refactor change. The testing strategy adapts the repository's fallback rule: no automated test framework exists for prompt changes, so we use manual verification + static checks (grep).

| TC ID | Test File / Script | Execution Command | Mocking Requirements | Implementation Status |
|-------|-------------------|-------------------|---------------------|----------------------|
| TC-GIT-001 | N/A (grep) | `rg "git checkout|git branch|git add|git commit" .opencode/agent/spec-writer.md` | None | To Implement |
| TC-GIT-002 | N/A (grep) | `rg "git checkout|git branch|git add|git commit" .opencode/agent/test-plan-writer.md` | None | To Implement |
| TC-GIT-003 | N/A (grep) | `rg "git checkout|git branch|git add|git commit" .opencode/agent/plan-writer.md` | None | To Implement |
| TC-GIT-004 | N/A (grep) | `rg "git commit|split|more than.*files" .opencode/agent/doc-syncer.md` | None | To Implement |
| TC-GIT-005 | N/A (grep) | `rg "git commit|stage.*plan file" .opencode/agent/reviewer.md` | None | To Implement |
| TC-GIT-006 | N/A (grep) | `rg "git commit|stage.*decision record" .opencode/agent/decision-advisor.md` | None | To Implement |
| TC-GIT-007 | N/A (manual read) | Manual review of .opencode/agent/pm.md | None | To Implement |
| TC-GIT-008 | N/A (manual read) | Manual review of .opencode/agent/pm.md | None | To Implement |
| TC-GIT-009 | N/A (manual read) | Manual review of command prompts | None | To Implement |
| TC-GIT-010 | N/A (manual read) | Manual review of .opencode/command/write-decision.md | None | To Implement |
| TC-GIT-011 | N/A (manual read) | Manual review of .opencode/agent/pm.md and .opencode/agent/readiness-reviewer.md | None | To Implement |
| TC-GIT-012 | N/A (grep) | `rg "<branch_rules>\|<commit_rules>" .opencode/agent/{spec-writer,test-plan-writer,plan-writer,doc-syncer,reviewer,decision-advisor}.md` (expect 0) and `rg "Commit with:\|git commit -F\|create a single commit\|Stage ONLY\|\\.add(\\|\\.commit(\\|git add\|git commit" .opencode/agent/{spec-writer,test-plan-writer,plan-writer,doc-syncer,reviewer,decision-advisor}.md` (expect 0 actionable; prohibition text allowlisted) | None | To Implement |
| TC-GIT-013 | N/A (manual read) | Manual review of doc/guides/change-lifecycle.md | None | To Implement |
| TC-GIT-014 | scripts/build-claude-plugin.sh | `bash scripts/build-claude-plugin.sh` then `bash scripts/.tests/test-doc-distribution.sh` | None | To Implement |
| TC-GIT-015 | N/A (manual review) | Manual review of delivery plan | None | To Implement |
| TC-GIT-016 | N/A (manual execution) | Manual test delivery via @pm or commands | None | To Implement |

**Automation Status**: Per repository testing strategy fallback rule, automated tests are N/A for prompt changes. All verification is manual + static (grep). No new test scripts are created for this change.

**Execution Order**:
1. Static verification tests (TC-GIT-001 through TC-GIT-006, TC-GIT-012) — can run in parallel after prompt edits complete
2. Content verification tests (TC-GIT-007 through TC-GIT-011, TC-GIT-013, TC-GIT-015) — run after prompt edits complete
3. Build verification test (TC-GIT-014) — run after all prompt edits complete, before behavioral test
4. Behavioral verification test (TC-GIT-016) — run last, after all other tests pass

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | Grep patterns may miss indirect git operations (e.g., bash commands, tool invocations) | M | L | Supplement with manual review of agent prompts for any bash tool calls or subprocess invocations that could perform git operations |
| RSK-T2 | Manual verification of content tests is error-prone and not reproducible | L | M | Document exact search patterns and expected findings in this test plan; create a checklist for each content test |
| RSK-T3 | Test delivery for TC-GIT-016 may not cover all lifecycle phases (e.g., phase reopen scenarios) | L | L | Note this limitation; phase reopen testing is deferred per spec (see section 7.3) |
| RSK-T4 | CI freshness guard may fail for reasons unrelated to this change (e.g., other drift) | M | L | Investigate CI guard failure logs; if drift is from other changes, fix those changes separately |

### 8.2 Assumptions

- The bash/rg (ripgrep) tool is available in the local dev environment for grep-based tests
- The plugin build script (`scripts/build-claude-plugin.sh`) is executable and completes successfully
- Manual test delivery for TC-GIT-016 can be performed without disrupting ongoing work (using a test workItemRef)
- The readiness-reviewer verdict file is written to a known location (from spec: implies file in change folder)
- The `no commit` directive is a bare-string `"no commit"` directive (resolved in plan §OQ-T1 and implemented by tasks 2.3 / 3.6) — `@pm` (autonomous mode) and the five manual commands check for the plain string and skip the `@committer`/`/commit` trigger when present. It is **not** a frontmatter flag or environment variable; no `pm-context.yaml` schema migration is involved.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | What is the exact mechanism for the `no commit` directive (frontmatter flag, environment variable, or other)? | The spec mentions the directive but does not define its format. | Resolved: bare-string `"no commit"` directive — `@pm` and the five manual commands check for the plain string and skip the `@committer`/`/commit` trigger when present. Not a frontmatter flag or env var. See plan §OQ-T1 and tasks 2.3 / 3.6. | N/A |
| OQ-T2 | Should TC-GIT-016 include a phase reopen scenario to verify reopen behavior? | The spec notes reopen behavior ("more on phase reopen") but does not mandate testing it; section 7.3 defers phase reopen testing. | Deferred per spec 7.3 | N/A |
| OQ-T3 | How should we verify that @coder, @meeting-organizer, and @pr-manager remain unchanged (per NG-3)? | These agents are already correct per the spec; we assume they are not touched, but we may want a verification step. | Resolved: covered by **plan task 6.4** (confirm already-correct agents untouched: `@coder`, `@meeting-organizer`, `@pr-manager` still delegate correctly), **not** TC-GIT-012 — TC-GIT-012 is scoped to the six delegated writers only. | N/A |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-04 | test-plan-writer (auto-generated) | Initial test plan |
| 1.1 | 2026-08-04 | reviewer feedback (DoR iter) | TC-GIT-012: replaced the broad `git checkout\|git branch` grep (which false-matched `reviewer.md`'s legitimate remote-mode checkout instructions at lines 161 and 304) with a **structural** `<branch_rules>`/`<commit_rules>` section-absence check; kept the imperative commit-instruction grep as defense-in-depth with the prohibition-text allowlist. Resolved OQ-T1: `no commit` is a bare-string directive (not a frontmatter flag/env var). Fixed OQ-T3 traceability: `@coder`/`@meeting-organizer`/`@pr-manager` regression is covered by **plan task 6.4**, not TC-GIT-012. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Tests not yet executed |