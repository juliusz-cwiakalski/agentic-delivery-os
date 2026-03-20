---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-16--GH-36--remote-code-review-automation/chg-GH-36-test-plan.md
id: chg-GH-36-test-plan
status: Proposed
created: "2026-03-16"
last_updated: "2026-03-16"
owners: [juliusz-cwiakalski]
service: delivery-os
labels: [code-review, automation, multi-platform, developer-experience]
version_impact: minor
summary: >
  Test plan for GH-36: Remote code review and review-feedback automation.
  Covers 2 new agents (code-reviewer, review-feedback-applier), 2 new commands
  (/review-remote, /apply-review-feedback), repository-local review configuration,
  pre-flight safety checks, and documentation updates. All deliverables are agent
  prompts, command definitions, and Markdown docs — no application code. Testing is
  agent prompt inspection, structural validation, cross-reference verification, and
  manual review checklists.
links:
  change_spec: ./chg-GH-36-spec.md
  implementation_plan: ./chg-GH-36-plan.md
  testing_strategy: "N/A — .ai/rules/testing-strategy.md does not exist in this repo. This change is agent-prompt/command-definition only; testing strategy derived from repo conventions."
---

# Test Plan - Remote code review and review-feedback automation

## 1. Scope and Objectives

### Scope

This test plan covers all deliverables of GH-36:

1. **Remote code review agent and command**: `code-reviewer` agent + `/review-remote` command — agent prompt structure, platform detection instructions, review draft generation, finding deduplication, pre-flight checks, and temporary state conventions.
2. **Review feedback application agent and command**: `review-feedback-applier` agent + `/apply-review-feedback` command — feedback classification (explicit/implicit/ambiguous), safety constraints, and temporary state conventions.
3. **Repository-local review configuration**: `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md` — optional config files with graceful fallback behavior.
4. **Documentation updates**: `.opencode/README.md` and `AGENTS.md` inventory additions.
5. **Existing behavior preservation**: Zero modifications to `@reviewer` agent.

### Objectives

- Verify both new agent prompts are structurally complete and contain all required behavioral instructions.
- Verify both new command definitions delegate to the correct agents and accept specified arguments.
- Verify platform detection instructions mirror `@pr-manager` patterns (GitHub/GitLab auto-detection, manual override).
- Verify pre-flight safety checks are defined (dirty tree, auth, branch state, PR/MR existence).
- Verify review draft generation and deduplication are instructed before any publishing.
- Verify feedback classification defines the three-tier system (explicit/implicit/ambiguous) with `AI-APPLY` marker.
- Verify safety constraints: `/review-remote` is read-only; `/apply-review-feedback` never auto-commits/pushes.
- Verify graceful fallback when `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md` are absent.
- Verify temporary state paths follow `@pr-manager` `branchPath` conventions.
- Verify inventory files are updated with both new agents and commands.
- Verify `@reviewer` agent is completely unchanged.

### Testing approach

This is an **agent prompt and command definition change only** — there is no application code. Testing consists of:

- **Content validation**: `grep` commands to verify required patterns, instructions, and references within agent prompts and command definitions.
- **Structural review**: Manual inspection of prompt completeness, behavioral coverage, and cross-agent coherence.
- **Cross-reference validation**: Systematic verification that referenced paths, conventions, and patterns are correct.
- **Diff-based regression check**: `git diff` on `@reviewer` to confirm zero changes.

## 2. References

| Document | Location |
|----------|----------|
| Change Specification | `doc/changes/2026-03/2026-03-16--GH-36--remote-code-review-automation/chg-GH-36-spec.md` |
| Implementation Plan | `doc/changes/2026-03/2026-03-16--GH-36--remote-code-review-automation/chg-GH-36-plan.md` (pending) |
| PM Notes | `doc/changes/2026-03/2026-03-16--GH-36--remote-code-review-automation/chg-GH-36-pm-notes.yaml` |
| `@pr-manager` agent (pattern reference) | `.opencode/agent/pr-manager.md` |
| `@reviewer` agent (must not change) | `.opencode/agent/reviewer.md` |
| Agent/command inventory | `.opencode/README.md` |
| Repo bootstrap | `AGENTS.md` |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| F-ID | Capability | AC-IDs | TC-IDs | Status |
|------|-----------|--------|--------|--------|
| F-1 | `code-reviewer` agent analyzes PR/MR diff | AC-F1-1, AC-F1-2 | TC-CR-001, TC-CR-002 | Covered |
| F-2 | `review-feedback-applier` agent classifies and applies feedback | AC-F2-1 | TC-RFA-001 | Covered |
| F-3 | `/review-remote` command entry point | AC-F3-1 | TC-CMD-001 | Covered |
| F-4 | `/apply-review-feedback` command entry point | AC-F4-1 | TC-CMD-002 | Covered |
| F-5 | Platform detection mirroring `@pr-manager` | AC-F1-1, AC-F1-2 | TC-PLAT-001 | Covered |
| F-6 | Repository-local review configuration | AC-F6-1, AC-F6-2, AC-F6-3 | TC-CFG-001, TC-CFG-002, TC-CFG-003 | Covered |
| F-7 | Review draft generation before publishing | AC-F7-1 | TC-DRAFT-001 | Covered |
| F-8 | Finding deduplication against existing comments | AC-F8-1 | TC-DEDUP-001 | Covered |
| F-9 | Feedback acceptance detection (AI-APPLY + fuzzy) | AC-F9-1, AC-F9-2, AC-F9-3 | TC-CLASS-001, TC-CLASS-002, TC-CLASS-003 | Covered |
| F-10 | Pre-flight safety checks | AC-F10-1, AC-F10-2, AC-F10-3 | TC-SAFE-001, TC-SAFE-002, TC-SAFE-003 | Covered |
| F-11 | Temporary state persistence conventions | AC-F7-1 | TC-STATE-001 | Covered |
| F-12 | Documentation updates | AC-F12-1, AC-F12-2 | TC-DOC-001, TC-DOC-002 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| ID | Element | TC-IDs | Status |
|----|---------|--------|--------|
| DM-1 | `.ai/checklists/code-review.md` | TC-CFG-001 | Covered |
| DM-2 | `.ai/agent/code-review-instructions.md` | TC-CFG-003 | Covered |
| DM-3 | `tmp/code-review/<branchPath>/context.json` | TC-STATE-001 | Covered |
| DM-4 | `tmp/code-review/<branchPath>/findings.json` | TC-STATE-001 | Covered |
| DM-5 | `tmp/code-review/<branchPath>/review-draft.md` | TC-DRAFT-001, TC-STATE-001 | Covered |
| DM-6 | `tmp/review-feedback/<branchPath>/classification-report.md` | TC-STATE-001 | Covered |
| DM-7 | `tmp/review-feedback/<branchPath>/applied-changes.json` | TC-STATE-001 | Covered |

No REST/HTTP or Event interfaces — agent prompts and command definitions only.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR-ID | Requirement | TC-IDs | Status |
|--------|-------------|--------|--------|
| NFR-1 | Platform parity (GitHub + GitLab equivalent behavior) | TC-PLAT-001 | Covered |
| NFR-2 | Review read-only guarantee (no source file modifications) | TC-SAFE-002 | Covered |
| NFR-3 | Feedback application safety (no auto-commit, no auto-push) | TC-SAFE-003 | Covered |
| NFR-4 | Deduplication effectiveness (zero duplicates on re-run) | TC-DEDUP-001 | Covered |
| NFR-5 | Ambiguity safety (ambiguous items never auto-applied) | TC-CLASS-003 | Covered |
| NFR-6 | Graceful degradation (works without config files) | TC-CFG-002 | Covered |
| NFR-7 | State isolation (separate branchPath directories) | TC-STATE-001 | Covered |

### 3.4 Existing Behavior Preservation

| ID | Requirement | TC-IDs | Status |
|----|-------------|--------|--------|
| AC-F5-1 | `@reviewer` agent zero modifications | TC-REG-001 | Covered |

## 4. Test Types and Layers

| Test Type | Description | Executor | Applicable Areas |
|-----------|-------------|----------|-----------------|
| Content Validation | `grep`/`test -f` commands to verify file existence, required patterns, instruction presence | `@runner` | All |
| Cross-Reference Validation | Verify referenced paths, conventions, and patterns match repo reality | `@runner` + `@reviewer` | Platform detection, tmp/ conventions, config paths |
| Structural Review | Manual inspection of prompt completeness, behavioral coverage, coherence | `@reviewer` | Agent prompts, command definitions |
| Regression Check | `git diff` to confirm zero changes to existing agent | `@runner` | `@reviewer` agent |
| Inventory Validation | Verify `.opencode/README.md` and `AGENTS.md` list all new agents/commands | `@runner` | Documentation |

There are **no unit tests, integration tests, E2E tests, or performance tests** for this change — all deliverables are agent prompt definitions, command definitions, and optional configuration files.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC-ID | Title | Type | Priority | AC Coverage |
|-------|-------|------|----------|-------------|
| TC-CR-001 | `code-reviewer` agent exists and defines GitHub review workflow | Happy Path | High | AC-F1-1, F-1 |
| TC-CR-002 | `code-reviewer` agent defines GitLab review workflow | Happy Path | High | AC-F1-2, F-1 |
| TC-RFA-001 | `review-feedback-applier` agent exists and defines classification workflow | Happy Path | High | AC-F2-1, F-2 |
| TC-CMD-001 | `/review-remote` command delegates to `code-reviewer` | Happy Path | High | AC-F3-1, F-3 |
| TC-CMD-002 | `/apply-review-feedback` command delegates to `review-feedback-applier` | Happy Path | High | AC-F4-1, F-4 |
| TC-PLAT-001 | Platform detection mirrors `@pr-manager` patterns | Happy Path | High | F-5, NFR-1 |
| TC-CFG-001 | Agent loads `.ai/checklists/code-review.md` when present | Happy Path | High | AC-F6-1, F-6 |
| TC-CFG-002 | Agent falls back gracefully when config files absent | Edge Case | High | AC-F6-2, NFR-6 |
| TC-CFG-003 | Agent loads `.ai/agent/code-review-instructions.md` when present | Happy Path | High | AC-F6-3, F-6 |
| TC-DRAFT-001 | Review draft generation before publishing | Happy Path | High | AC-F7-1, F-7 |
| TC-DEDUP-001 | Finding deduplication against existing comments | Happy Path | High | AC-F8-1, NFR-4 |
| TC-CLASS-001 | Explicit acceptance via `AI-APPLY` marker | Happy Path | High | AC-F9-1, F-9 |
| TC-CLASS-002 | Implicit acceptance via agreement language | Happy Path | Medium | AC-F9-2, F-9 |
| TC-CLASS-003 | Ambiguous feedback never auto-applied | Edge Case | High | AC-F9-3, NFR-5 |
| TC-SAFE-001 | Dirty working tree blocks both commands | Negative | High | AC-F10-1, F-10 |
| TC-SAFE-002 | `/review-remote` is read-only (no source modifications) | Happy Path | High | AC-F10-2, NFR-2 |
| TC-SAFE-003 | `/apply-review-feedback` never auto-commits or pushes | Happy Path | High | AC-F10-3, NFR-3 |
| TC-STATE-001 | Temporary state follows `branchPath` conventions | Happy Path | Medium | F-11, NFR-7, DM-3..7 |
| TC-DOC-001 | `.opencode/README.md` lists new agents and commands | Happy Path | High | AC-F12-1, F-12 |
| TC-DOC-002 | `AGENTS.md` lists new agents and commands | Happy Path | High | AC-F12-2, F-12 |
| TC-REG-001 | `@reviewer` agent has zero modifications | Regression | High | AC-F5-1, G-5 |

### 5.2 Scenario Details

---

#### TC-CR-001 - `code-reviewer` agent exists and defines GitHub review workflow

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, AC-F1-1
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`
**Tags**: @agent-prompt, @code-review, @github

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify file exists: `test -f .opencode/agent/code-reviewer.md && echo OK`.
2. Verify it references GitHub PR operations: `grep -qi "gh\b\|github" .opencode/agent/code-reviewer.md && echo OK`.
3. Verify it instructs fetching PR diff: `grep -qi "diff" .opencode/agent/code-reviewer.md && echo OK`.
4. Verify it instructs fetching PR metadata: `grep -qi "metadata" .opencode/agent/code-reviewer.md && echo OK`.
5. Verify it instructs producing structured findings: `grep -qi "finding" .opencode/agent/code-reviewer.md && echo OK`.
6. Verify it references severity levels: `grep -qi "severity" .opencode/agent/code-reviewer.md && echo OK`.
7. Manually review: Does the agent prompt define a complete review workflow for GitHub PRs producing structured findings with severity, file path, line reference, description, and suggested fix?

**Expected Outcome**:

- `.opencode/agent/code-reviewer.md` exists and defines a complete GitHub PR review workflow that fetches diff + metadata via `gh` and produces structured findings.

---

#### TC-CR-002 - `code-reviewer` agent defines GitLab review workflow

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, AC-F1-2
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`
**Tags**: @agent-prompt, @code-review, @gitlab

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify it references GitLab MR operations: `grep -qi "glab\|gitlab" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify it instructs fetching MR diff and metadata via `glab`: `grep -qi "glab" .opencode/agent/code-reviewer.md && echo OK`.
3. Manually review: Does the agent prompt define equivalent review behavior for GitLab MRs as for GitHub PRs?

**Expected Outcome**:

- `.opencode/agent/code-reviewer.md` includes GitLab MR review workflow via `glab` producing equivalent findings to the GitHub path.

---

#### TC-RFA-001 - `review-feedback-applier` agent exists and defines classification workflow

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-9, AC-F2-1
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/review-feedback-applier.md`
**Tags**: @agent-prompt, @feedback-applier

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify file exists: `test -f .opencode/agent/review-feedback-applier.md && echo OK`.
2. Verify it references fetching review threads/comments: `grep -qi "thread\|comment" .opencode/agent/review-feedback-applier.md && echo OK`.
3. Verify it defines classification categories: `grep -qi "accepted\|rejected\|ambiguous" .opencode/agent/review-feedback-applier.md && echo OK`.
4. Verify it references `AI-APPLY` marker: `grep -qi "AI-APPLY" .opencode/agent/review-feedback-applier.md && echo OK`.
5. Verify it references both GitHub and GitLab: `grep -qi "gh\|github" .opencode/agent/review-feedback-applier.md && grep -qi "glab\|gitlab" .opencode/agent/review-feedback-applier.md && echo OK`.
6. Manually review: Does the agent define a complete three-tier classification workflow (explicit accept via AI-APPLY, implicit accept, ambiguous) that applies only accepted feedback and lists ambiguous items for manual review?

**Expected Outcome**:

- `.opencode/agent/review-feedback-applier.md` exists and defines a complete feedback classification and application workflow with three-tier classification, supporting both GitHub and GitLab.

---

#### TC-CMD-001 - `/review-remote` command delegates to `code-reviewer`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/review-remote.md`
**Tags**: @command, @code-review

**Preconditions**:

- Command definition file has been created.

**Steps**:

1. Verify file exists: `test -f .opencode/command/review-remote.md && echo OK`.
2. Verify delegation to code-reviewer: `grep -qi "code-reviewer" .opencode/command/review-remote.md && echo OK`.
3. Verify platform override arguments: `grep -qi "github\|gitlab\|platform" .opencode/command/review-remote.md && echo OK`.
4. Verify dry-run mode: `grep -qi "dry.run\|dry-run\|dryrun" .opencode/command/review-remote.md && echo OK`.
5. Verify publish option: `grep -qi "publish" .opencode/command/review-remote.md && echo OK`.
6. Manually review: Is the command a clear entry point that delegates to `@code-reviewer` and accepts optional arguments (platform override, dry-run, publish)?

**Expected Outcome**:

- `.opencode/command/review-remote.md` exists, delegates to `@code-reviewer`, and accepts optional arguments for platform override, dry-run, and publish.

---

#### TC-CMD-002 - `/apply-review-feedback` command delegates to `review-feedback-applier`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/apply-review-feedback.md`
**Tags**: @command, @feedback-applier

**Preconditions**:

- Command definition file has been created.

**Steps**:

1. Verify file exists: `test -f .opencode/command/apply-review-feedback.md && echo OK`.
2. Verify delegation to review-feedback-applier: `grep -qi "review-feedback-applier" .opencode/command/apply-review-feedback.md && echo OK`.
3. Manually review: Is the command a clear entry point that delegates to `@review-feedback-applier`?

**Expected Outcome**:

- `.opencode/command/apply-review-feedback.md` exists and delegates to `@review-feedback-applier`.

---

#### TC-PLAT-001 - Platform detection mirrors `@pr-manager` patterns

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-1
**Test Type(s)**: Content Validation, Cross-Reference Validation
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`, `.opencode/agent/review-feedback-applier.md`
**Tags**: @agent-prompt, @platform-detection

**Preconditions**:

- Both agent prompt files have been created.

**Steps**:

1. Verify `code-reviewer` references `git remote get-url origin` for platform detection: `grep -qi "remote.*get-url\|origin" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify `code-reviewer` mentions `github.com` and `gitlab.com` patterns: `grep -qi "github.com\|gitlab.com" .opencode/agent/code-reviewer.md && echo OK`.
3. Verify `code-reviewer` supports manual override flags: `grep -qi "\-\-github\|\-\-gitlab\|override\|flag" .opencode/agent/code-reviewer.md && echo OK`.
4. Repeat steps 1-3 for `review-feedback-applier`:
   - `grep -qi "remote.*get-url\|origin" .opencode/agent/review-feedback-applier.md && echo OK`
   - `grep -qi "github.com\|gitlab.com" .opencode/agent/review-feedback-applier.md && echo OK`
5. Verify fallback to `gh auth status` / `glab auth status`: `grep -qi "auth status" .opencode/agent/code-reviewer.md && echo OK`.
6. Manually review: Does the platform detection logic match `@pr-manager`'s approach (parse origin URL → auth fallback → manual override → NEEDS_INPUT)?

**Expected Outcome**:

- Both agents define platform detection that mirrors `@pr-manager`: parse `origin` remote URL for `github.com`/`gitlab.com`, fallback to auth status check, support manual override, and output `NEEDS_INPUT` when unresolvable.

---

#### TC-CFG-001 - Agent loads `.ai/checklists/code-review.md` when present

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1
**Test Type(s)**: Content Validation
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`
**Tags**: @agent-prompt, @config

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent references the checklist path: `grep -q ".ai/checklists/code-review.md" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify agent instructs evaluating checklist items against the diff: `grep -qi "checklist" .opencode/agent/code-reviewer.md && echo OK`.
3. Manually review: Does the agent instruct loading and evaluating each applicable checklist item when the file is present?

**Expected Outcome**:

- `code-reviewer` agent prompt references `.ai/checklists/code-review.md` and instructs evaluating each checklist item against the diff.

---

#### TC-CFG-002 - Agent falls back gracefully when config files absent

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-6
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`
**Tags**: @agent-prompt, @config, @edge-case

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent defines fallback behavior: `grep -qi "fallback\|default\|absent\|not found\|not exist\|missing\|heuristic" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify agent mentions built-in/general-purpose heuristics: `grep -qi "built.in\|general.purpose\|heuristic\|default" .opencode/agent/code-reviewer.md && echo OK`.
3. Manually review: Does the agent clearly instruct that when `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md` are absent, it uses built-in general-purpose review heuristics with no errors?

**Expected Outcome**:

- Agent prompt includes explicit fallback-to-defaults instruction when configuration files do not exist, with no error behavior.

---

#### TC-CFG-003 - Agent loads `.ai/agent/code-review-instructions.md` when present

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3
**Test Type(s)**: Content Validation
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`
**Tags**: @agent-prompt, @config

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent references the instructions path: `grep -q ".ai/agent/code-review-instructions.md" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify agent instructs following those instructions: `grep -qi "instruction" .opencode/agent/code-reviewer.md && echo OK`.
3. Manually review: Does the agent instruct loading and following the instructions when the file is present?

**Expected Outcome**:

- `code-reviewer` agent prompt references `.ai/agent/code-review-instructions.md` and instructs following the instructions when present.

---

#### TC-DRAFT-001 - Review draft generation before publishing

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-11, AC-F7-1
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`
**Tags**: @agent-prompt, @review-draft

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent references review draft: `grep -qi "review-draft\|review.draft" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify agent references the draft output path: `grep -q "tmp/code-review" .opencode/agent/code-reviewer.md && echo OK`.
3. Verify agent instructs draft generation before publishing: `grep -qi "before.*publish\|draft.*before\|preview\|dry.run" .opencode/agent/code-reviewer.md && echo OK`.
4. Manually review: Does the agent clearly define that a `review-draft.md` file is written to `tmp/code-review/<branchPath>/` before any publishing occurs, and that publishing is a separate explicit action?

**Expected Outcome**:

- Agent prompt defines review draft generation to `tmp/code-review/<branchPath>/review-draft.md` before any publishing, with publishing as a separate user-approved step.

---

#### TC-DEDUP-001 - Finding deduplication against existing comments

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-4
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`
**Tags**: @agent-prompt, @deduplication

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent references deduplication: `grep -qi "dedup\|duplicate\|existing.*comment" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify agent instructs fetching existing comments before publishing: `grep -qi "existing.*comment\|fetch.*comment\|comment.*fetch" .opencode/agent/code-reviewer.md && echo OK`.
3. Verify agent defines comparison criteria: `grep -qi "file.*path\|line.*range\|semantic\|similarity\|overlap" .opencode/agent/code-reviewer.md && echo OK`.
4. Manually review: Does the agent instruct comparing new findings against existing PR/MR comments by file path, approximate line range, and semantic similarity, suppressing duplicates before publishing?

**Expected Outcome**:

- Agent prompt defines a deduplication step that compares new findings against existing PR/MR comments and suppresses duplicates, ensuring re-running on an unchanged PR/MR produces zero new published comments.

---

#### TC-CLASS-001 - Explicit acceptance via `AI-APPLY` marker

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/review-feedback-applier.md`
**Tags**: @agent-prompt, @classification, @ai-apply

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent references `AI-APPLY` marker: `grep -q "AI-APPLY" .opencode/agent/review-feedback-applier.md && echo OK`.
2. Verify case-insensitivity instruction: `grep -qi "case.insensitive\|case insensitive" .opencode/agent/review-feedback-applier.md && echo OK`.
3. Verify standalone token requirement: `grep -qi "standalone" .opencode/agent/review-feedback-applier.md && echo OK`.
4. Verify it is classified as highest confidence: `grep -qi "explicit.*accept\|highest.*confidence" .opencode/agent/review-feedback-applier.md && echo OK`.
5. Manually review: Does the agent correctly define the `AI-APPLY` marker as a case-insensitive standalone token that triggers explicit acceptance and is always applied?

**Expected Outcome**:

- Agent prompt defines `AI-APPLY` as a case-insensitive standalone token that classifies feedback as "explicitly accepted" with highest confidence and is always applied.

---

#### TC-CLASS-002 - Implicit acceptance via agreement language

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-9, AC-F9-2
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/review-feedback-applier.md`
**Tags**: @agent-prompt, @classification

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent defines implicit acceptance patterns: `grep -qi "implicit\|agreement\|agreed\|will fix" .opencode/agent/review-feedback-applier.md && echo OK`.
2. Verify agent instructs documenting reasoning: `grep -qi "reasoning\|document.*why\|justify" .opencode/agent/review-feedback-applier.md && echo OK`.
3. Manually review: Does the agent define conservative fuzzy matching patterns for implicit acceptance (e.g., "agreed", "will fix", "good point") and instruct documenting reasoning for each implicit classification?

**Expected Outcome**:

- Agent prompt defines implicit acceptance via conservative agreement language patterns and requires documented reasoning for each implicit classification.

---

#### TC-CLASS-003 - Ambiguous feedback never auto-applied

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-3, NFR-5
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/review-feedback-applier.md`
**Tags**: @agent-prompt, @classification, @safety

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent defines ambiguous category: `grep -qi "ambiguous" .opencode/agent/review-feedback-applier.md && echo OK`.
2. Verify agent explicitly prohibits applying ambiguous items: `grep -qi "never.*appl\|not.*appl\|skip.*ambiguous\|ambiguous.*skip" .opencode/agent/review-feedback-applier.md && echo OK`.
3. Verify agent references `skipped-items.md` for ambiguous items: `grep -qi "skipped-items\|skipped.items" .opencode/agent/review-feedback-applier.md && echo OK`.
4. Manually review: Does the agent clearly define that ambiguous feedback is never auto-applied and is listed in `skipped-items.md` for manual resolution?

**Expected Outcome**:

- Agent prompt explicitly defines that ambiguous feedback is never auto-applied and is listed in `tmp/review-feedback/<branchPath>/skipped-items.md` for manual review.

---

#### TC-SAFE-001 - Dirty working tree blocks both commands

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`, `.opencode/agent/review-feedback-applier.md`
**Tags**: @agent-prompt, @safety, @pre-flight

**Preconditions**:

- Both agent prompt files have been created.

**Steps**:

1. Verify `code-reviewer` instructs checking for clean tree: `grep -qi "git status.*porcelain\|clean.*tree\|dirty.*tree\|uncommitted" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify `code-reviewer` instructs stopping on dirty tree: `grep -qi "stop\|abort\|stash\|commit" .opencode/agent/code-reviewer.md && echo OK`.
3. Verify `review-feedback-applier` instructs checking for clean tree: `grep -qi "git status.*porcelain\|clean.*tree\|dirty.*tree\|uncommitted" .opencode/agent/review-feedback-applier.md && echo OK`.
4. Verify `review-feedback-applier` instructs stopping on dirty tree: `grep -qi "stop\|abort\|stash\|commit" .opencode/agent/review-feedback-applier.md && echo OK`.
5. Manually review: Do both agent prompts define pre-flight checks that stop with a clear message when the working tree is dirty?

**Expected Outcome**:

- Both agent prompts define pre-flight checks using `git status --porcelain` that stop execution and advise the user to commit or stash when the working tree is dirty.

---

#### TC-SAFE-002 - `/review-remote` is read-only (no source modifications)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-2, NFR-2
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`
**Tags**: @agent-prompt, @safety, @read-only

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent defines read-only constraint: `grep -qi "read.only\|no.*modif\|never.*modif\|do not.*edit\|do not.*change\|do not.*write" .opencode/agent/code-reviewer.md && echo OK`.
2. Manually review: Does the agent prompt explicitly instruct that zero source code files in the working tree may be modified during the review workflow? (Only files under `tmp/` may be written.)

**Expected Outcome**:

- Agent prompt explicitly states the review workflow is read-only with respect to source code files. Only `tmp/` artifacts may be written.

---

#### TC-SAFE-003 - `/apply-review-feedback` never auto-commits or pushes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-3, NFR-3
**Test Type(s)**: Content Validation, Structural Review
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/review-feedback-applier.md`
**Tags**: @agent-prompt, @safety, @no-commit

**Preconditions**:

- Agent prompt file has been created.

**Steps**:

1. Verify agent prohibits auto-commit: `grep -qi "never.*commit\|no.*commit\|do not.*commit\|not.*auto.*commit" .opencode/agent/review-feedback-applier.md && echo OK`.
2. Verify agent prohibits auto-push: `grep -qi "never.*push\|no.*push\|do not.*push\|not.*auto.*push" .opencode/agent/review-feedback-applier.md && echo OK`.
3. Manually review: Does the agent prompt explicitly instruct that no git commit or push is made automatically, and that the user must review changes and commit/push manually?

**Expected Outcome**:

- Agent prompt explicitly prohibits auto-commit and auto-push. Applied changes remain as unstaged local modifications for the user to review.

---

#### TC-STATE-001 - Temporary state follows `branchPath` conventions

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-11, NFR-7, DM-3, DM-4, DM-5, DM-6, DM-7
**Test Type(s)**: Content Validation, Cross-Reference Validation
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/code-reviewer.md`, `.opencode/agent/review-feedback-applier.md`
**Tags**: @agent-prompt, @state, @conventions

**Preconditions**:

- Both agent prompt files have been created.

**Steps**:

1. Verify `code-reviewer` references `tmp/code-review/`: `grep -q "tmp/code-review" .opencode/agent/code-reviewer.md && echo OK`.
2. Verify `code-reviewer` references `branchPath` sanitization: `grep -qi "branchPath\|branch.path\|sanitiz" .opencode/agent/code-reviewer.md && echo OK`.
3. Verify `code-reviewer` references key artifacts: `grep -qi "context.json\|findings.json\|review-draft.md" .opencode/agent/code-reviewer.md && echo OK`.
4. Verify `review-feedback-applier` references `tmp/review-feedback/`: `grep -q "tmp/review-feedback" .opencode/agent/review-feedback-applier.md && echo OK`.
5. Verify `review-feedback-applier` references key artifacts: `grep -qi "classification-report\|applied-changes\|skipped-items" .opencode/agent/review-feedback-applier.md && echo OK`.
6. Verify `branchPath` sanitization rules match `@pr-manager`: compare sanitization description against `@pr-manager` prompt (replace non-`[A-Za-z0-9._/-]` with `_`, replace `..` with `__`, trim leading `/`).

**Expected Outcome**:

- Both agents define temporary state under per-branch directories (`tmp/code-review/<branchPath>/` and `tmp/review-feedback/<branchPath>/`) with `branchPath` sanitization matching `@pr-manager` conventions, and reference all expected artifact files.

---

#### TC-DOC-001 - `.opencode/README.md` lists new agents and commands

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1
**Test Type(s)**: Content Validation
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/README.md`
**Tags**: @content-validation, @inventory

**Preconditions**:

- Documentation updates have been applied.

**Steps**:

1. Verify `code-reviewer` agent is listed: `grep -qi "code-reviewer" .opencode/README.md && echo OK`.
2. Verify `review-feedback-applier` agent is listed: `grep -qi "review-feedback-applier" .opencode/README.md && echo OK`.
3. Verify `/review-remote` command is listed: `grep -qi "review-remote" .opencode/README.md && echo OK`.
4. Verify `/apply-review-feedback` command is listed: `grep -qi "apply-review-feedback" .opencode/README.md && echo OK`.
5. Manually review: Are all four entries in the correct sections (agents in Agents, commands in Commands)?

**Expected Outcome**:

- `.opencode/README.md` lists `code-reviewer` and `review-feedback-applier` in the Agents section and `/review-remote` and `/apply-review-feedback` in the Commands section.

---

#### TC-DOC-002 - `AGENTS.md` lists new agents and commands

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-2
**Test Type(s)**: Content Validation
**Automation Level**: Semi-automated
**Target Layer / Location**: `AGENTS.md`
**Tags**: @content-validation, @inventory

**Preconditions**:

- Documentation updates have been applied.

**Steps**:

1. Verify `code-reviewer` is listed: `grep -qi "code-reviewer" AGENTS.md && echo OK`.
2. Verify `review-feedback-applier` is listed: `grep -qi "review-feedback-applier" AGENTS.md && echo OK`.
3. Verify `/review-remote` command is listed: `grep -qi "review-remote" AGENTS.md && echo OK`.
4. Verify `/apply-review-feedback` command is listed: `grep -qi "apply-review-feedback" AGENTS.md && echo OK`.
5. Manually review: Is `code-reviewer` in the agent team table and are both commands in the commands table?

**Expected Outcome**:

- `AGENTS.md` lists both new agents in the agent team and both new commands in the commands table.

---

#### TC-REG-001 - `@reviewer` agent local mode behavior preserved

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: G-5, AC-F5-1 (superseded by DEC-13)
**Test Type(s)**: Regression Check
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md`
**Tags**: @regression, @reviewer

**Preconditions**:

- All deliverables committed.

**Steps**:

1. reviewer.md is intentionally modified to include remote mode capabilities (reviewer unification DEC-13). Regression check: verify local mode behavior is preserved — local mode steps, spec compliance audit, plan task audit, and remediation generation are all present.
2. Verify local mode steps: `grep -qi "local mode" .opencode/agent/reviewer.md && echo OK`.
3. Verify spec compliance audit: `grep -qi "spec compliance" .opencode/agent/reviewer.md && echo OK`.
4. Verify plan task audit: `grep -qi "plan task audit" .opencode/agent/reviewer.md && echo OK`.
5. Verify remediation generation: `grep -qi "remediation" .opencode/agent/reviewer.md && echo OK`.

**Expected Outcome**:

- `.opencode/agent/reviewer.md` preserves all local mode behavior: local mode steps, spec compliance audit, plan task audit, and remediation generation are present. Remote mode capabilities are additive (DEC-13).

---

## 6. Environments and Test Data

### Environment

All testing is performed against the local repository clone on the feature branch. No external environments, databases, or services are required.

### Test Data

No test data required. All verifications are against static agent prompt files, command definitions, and documentation within the repository.

### Tools

| Tool | Purpose |
|------|---------|
| `grep` | Search for patterns in agent prompts and docs |
| `test -f` | Verify file existence |
| `git diff` | Verify zero changes to `@reviewer` |
| `md5sum` | Hash comparison for regression check |
| Manual review | Structural inspection, behavioral completeness, cross-agent coherence |

## 7. Automation Plan and Implementation Mapping

| TC-ID | Automation Level | Implementation Approach | Target Location |
|-------|-----------------|------------------------|-----------------|
| TC-CR-001 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/code-reviewer.md` |
| TC-CR-002 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/code-reviewer.md` |
| TC-RFA-001 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/review-feedback-applier.md` |
| TC-CMD-001 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/command/review-remote.md` |
| TC-CMD-002 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/command/apply-review-feedback.md` |
| TC-PLAT-001 | Semi-automated | `grep` + cross-ref with `@pr-manager` by `@reviewer` | Both agent prompts |
| TC-CFG-001 | Semi-automated | `grep` by `@runner` | `.opencode/agent/code-reviewer.md` |
| TC-CFG-002 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/code-reviewer.md` |
| TC-CFG-003 | Semi-automated | `grep` by `@runner` | `.opencode/agent/code-reviewer.md` |
| TC-DRAFT-001 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/code-reviewer.md` |
| TC-DEDUP-001 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/code-reviewer.md` |
| TC-CLASS-001 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/review-feedback-applier.md` |
| TC-CLASS-002 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/review-feedback-applier.md` |
| TC-CLASS-003 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/review-feedback-applier.md` |
| TC-SAFE-001 | Semi-automated | `grep` + manual review by `@reviewer` | Both agent prompts |
| TC-SAFE-002 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/code-reviewer.md` |
| TC-SAFE-003 | Semi-automated | `grep` + manual review by `@reviewer` | `.opencode/agent/review-feedback-applier.md` |
| TC-STATE-001 | Semi-automated | `grep` + cross-ref with `@pr-manager` by `@reviewer` | Both agent prompts |
| TC-DOC-001 | Semi-automated | `grep` by `@runner` | `.opencode/README.md` |
| TC-DOC-002 | Semi-automated | `grep` by `@runner` | `AGENTS.md` |
| TC-REG-001 | Semi-automated | `git diff` + `md5sum` by `@runner` | `.opencode/agent/reviewer.md` |

### Implementation Notes

- **No automated test scripts** are created for this change. All deliverables are agent prompt definitions, command definitions, and optional configuration files.
- **Semi-automated** means `@runner` executes `grep`/`test`/`diff` commands and reports results; `@reviewer` performs structural review for behavioral completeness.
- A consolidated verification script could be composed from the `grep` commands in §5.2 for batch execution by `@runner`.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| TR-1 | Agent prompt behavioral verification via `grep` may miss nuanced instruction gaps | Manual structural review by `@reviewer` included for all critical scenarios |
| TR-2 | Platform detection pattern matching may vary between `@pr-manager` and new agents | TC-PLAT-001 explicitly cross-references against `@pr-manager` prompt |
| TR-3 | `AI-APPLY` marker specification completeness cannot be fully validated without runtime testing | TC-CLASS-001 verifies all specification properties are documented in the agent prompt; runtime testing deferred to adoption |
| TR-4 | Deduplication logic effectiveness cannot be verified without live PR/MR data | TC-DEDUP-001 verifies behavioral instructions are present; effectiveness validated during first real use |

### 8.2 Assumptions

- All deliverables are created on the same feature branch and can be tested together.
- Agent prompt files use `.md` extension and are located under `.opencode/agent/`.
- Command definition files use `.md` extension and are located under `.opencode/command/`.
- `@pr-manager` patterns (`.opencode/agent/pr-manager.md`) are stable and serve as the authoritative reference for platform detection and `branchPath` conventions.
- The `.opencode/` directory is the correct agent directory for this repository (confirmed: not `.Claude/`).

### 8.3 Open Questions

| ID | Question | Status |
|----|----------|--------|
| OQ-3 | Should the review draft include a confidence score per finding? | Decision needed — does not block test plan (TC-DRAFT-001 verifies draft generation regardless) |
| OQ-4 | Maximum number of inline comments per review? | Decision needed — does not block test plan (no TC depends on this limit) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-16 | test-plan-writer | Initial test plan — 21 scenarios covering all 17 AC + 7 NFRs + 7 DMs + 1 regression check |

## 10. Test Execution Log

| Date | Executor | TC-IDs Executed | Result | Notes |
|------|----------|-----------------|--------|-------|
| — | — | — | — | No executions yet |
