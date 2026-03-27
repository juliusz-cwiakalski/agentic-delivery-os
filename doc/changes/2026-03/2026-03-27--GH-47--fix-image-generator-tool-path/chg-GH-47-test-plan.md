---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-27--GH-47--fix-image-generator-tool-path/chg-GH-47-test-plan.md
id: chg-GH-47-test-plan
status: Proposed
created: 2026-03-27
last_updated: 2026-03-27
owners:
  - "@cwiakalski"
service: agentic-delivery-os
labels:
  - agents
  - documentation
  - developer-experience
version_impact: none
summary: "Fix the @image-generator agent to invoke text-to-image as a system PATH command and provide clear install guidance"
links:
  change_spec: ./chg-GH-47-spec.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Fix @image-generator Tool Path Invocation

## 1. Scope and Objectives

This test plan verifies the fix for the `@image-generator` agent to correctly invoke the `text-to-image` CLI as a system PATH command and provide clear error handling and installation guidance. The change addresses confusion when the tool is not installed—agents should not search project directories or delegate to confused subagents, but rather report clear, actionable errors.

### 1.1 In Scope

- Verification that `.opencode/agent/image-generator.md` uses `text-to-image` (not `tools/text-to-image`) throughout the prompt
- Verification that the agent prompt includes error handling for "tool not installed" scenario with installation URL
- Verification that the agent prompt includes error handling for "no providers configured" scenario with setup guide link
- Verification that `doc/tools/text-to-image.md` clearly states PATH installation is required for AI agent usage
- Verification that documentation explains the system-level tool distinction

### 1.2 Out of Scope & Known Gaps

- Functional testing of the `text-to-image` CLI tool itself (no code changes to the tool)
- Auto-installation or setup automation
- Changes to other agents that might invoke tools
- End-to-end testing with actual AI model invocation (requires real API keys)

## 2. References

- [Change Specification](./chg-GH-47-spec.md) — GH-47: Fix @image-generator tool path invocation
- [Agent Prompt](/.opencode/agent/image-generator.md) — The `@image-generator` agent definition
- [Tool Documentation](/doc/tools/text-to-image.md) — User guide for `text-to-image` CLI

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F1-1 | Agent uses `text-to-image` (not `tools/text-to-image`) in all invocations | TC-AGENT-001 | Proposed |
| AC-F3-1 | Agent reports "tool not installed" with installation URL, does NOT search project directories | TC-AGENT-002 | Proposed |
| AC-F4-1 | Agent reports "no providers configured" with link to Provider Setup section | TC-AGENT-003 | Proposed |
| AC-F5-1 | Documentation states PATH installation is required for AI agent usage | TC-DOC-001 | Proposed |
| AC-F5-2 | Documentation explains system-level tool shared across projects | TC-DOC-002 | Proposed |
| F-1 | System PATH invocation verification | TC-AGENT-001 | Proposed |
| F-2 | Tool availability detection | TC-AGENT-002, TC-AGENT-003 | Proposed |
| F-3 | "Tool not installed" error handling | TC-AGENT-002 | Proposed |
| F-4 | "No providers configured" error handling | TC-AGENT-003 | Proposed |
| F-5 | Documentation clarification | TC-DOC-001, TC-DOC-002 | Proposed |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| ID | Element | TC ID(s) | Notes |
|----|----------|----------|-------|
| DM-1 | `.opencode/agent/image-generator.md` — tool invocation pattern | TC-AGENT-001, TC-AGENT-002, TC-AGENT-003 | Prompt content verification |
| DM-2 | `doc/tools/text-to-image.md` — installation requirements | TC-DOC-001, TC-DOC-002 | Documentation content verification |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Notes |
|--------|-------------|----------|-------|
| NFR-1 | Error message clarity | TC-AGENT-002, TC-AGENT-003 | Verify distinct error messages |
| NFR-2 | Error recovery time | TC-DOC-001 | Verify documentation provides clear resolution path |
| NFR-3 | Agent efficiency | TC-AGENT-002 | Verify no project directory search instructions |

## 4. Test Types and Layers

This change affects **agent prompts and documentation only**. Testing is primarily **manual verification** of content correctness.

| Test Type | Framework / Location | Applicability |
|-----------|---------------------|---------------|
| Manual Review | — | Primary — verify agent prompt and documentation content |
| Content Verification | — | Verify absence of `tools/text-to-image` pattern in examples |
| Reference Check | — | Verify presence of correct error handling and installation guidance |

**Note:** No automated unit/integration tests are applicable because:
1. The change modifies Markdown documentation and agent prompts, not executable code
2. The `@image-generator` agent runs within an AI assistant framework where verification requires human review
3. Functional testing of actual image generation requires real API keys and provider setup

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-AGENT-001 | Agent uses system PATH invocation | Happy Path | Important | High | AC-F1-1 |
| TC-AGENT-002 | Tool not installed error handling | Negative | Critical | High | AC-F3-1 |
| TC-AGENT-003 | No providers configured error handling | Negative | Important | High | AC-F4-1 |
| TC-DOC-001 | PATH installation requirement documented | Documentation | Critical | High | AC-F5-1 |
| TC-DOC-002 | System-level tool explanation | Documentation | Important | Medium | AC-F5-2 |

### 5.2 Scenario Details

#### TC-AGENT-001 - Agent uses system PATH invocation

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/agent/image-generator.md`
**Tags**: @agent, @prompt

**Preconditions**:

- Agent prompt file exists at `.opencode/agent/image-generator.md`
- Change specification has been reviewed

**Steps**:

1. Open `.opencode/agent/image-generator.md` in a text editor
2. Search for the pattern `tools/text-to-image` in the file
3. Verify NO occurrences of `tools/text-to-image` exist in:
   - `<tool_reference>` section (line ~46)
   - `<process>` steps (lines ~207, ~238)
   - `<examples>` section (all example commands)
   - Any other location in the prompt
4. Search for the pattern `text-to-image` (without `tools/` prefix)
5. Verify ALL occurrences use bare command `text-to-image` (system PATH invocation)
6. Verify `<tool_reference>` section shows:
   ```
   CLI: `text-to-image`
   ```
7. Verify example commands use:
   ```bash
   text-to-image --list-models --output-format json
   text-to-image --prompt "..." --output img.avif
   ```

**Expected Outcome**:

- Zero occurrences of `tools/text-to-image` pattern
- All command invocations use `text-to-image` (bare command)
- `<tool_reference>` documentation reflects system PATH usage
- Example commands use correct invocation pattern

**Postconditions**:

- Agent prompt is ready for use with PATH-installed tool

---

#### TC-AGENT-002 - Tool not installed error handling

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F3-1, NFR-1, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/agent/image-generator.md`
**Tags**: @agent, @prompt, @error-handling

**Preconditions**:

- Agent prompt file exists at `.opencode/agent/image-generator.md`
- Change specification has been reviewed

**Steps**:

1. Open `.opencode/agent/image-generator.md` in a text editor
2. Locate the `<process>` section (or equivalent error handling section)
3. Verify there is a step or section for detecting tool availability
4. Verify the error handling for "tool not installed" includes:
   - Clear identification that `text-to-image` is not installed/in PATH
   - Statement that this is a system-level CLI tool
   - Reference to installation guide: `doc/tools/text-to-image.md`
   - Clear instruction that user should install the tool and add to PATH
5. Verify the agent prompt does NOT include:
   - Instructions to search project directories for the tool
   - Delegation to subagents for tool location
   - Generic "SYSTEM_LIMITATION" error handling
6. Verify the error handling provides actionable guidance

**Expected Outcome**:

- Tool availability detection step exists before generation workflow
- "Tool not installed" error handling is present and explicit
- Error message includes installation URL (`doc/tools/text-to-image.md`)
- Error message explains system-level tool nature
- No project directory search instructions appear
- No subagent delegation for tool discovery

**Postconditions**:

- Agent can clearly report "tool not installed" to users

**Notes / Clarifications**:

- This is a content verification of the agent prompt, not functional testing with an actual agent session

---

#### TC-AGENT-003 - No providers configured error handling

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, F-4, AC-F4-1, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/agent/image-generator.md`
**Tags**: @agent, @prompt, @error-handling

**Preconditions**:

- Agent prompt file exists at `.opencode/agent/image-generator.md`
- Change specification has been reviewed

**Steps**:

1. Open `.opencode/agent/image-generator.md` in a text editor
2. Locate the `<process>` section step 1 (Discover available models)
3. Verify the step includes handling for empty providers list
4. Verify the error handling includes:
   - Clear identification that no providers are configured
   - Link to Provider Setup section: `doc/tools/text-to-image.md#provider-setup`
   - Explanation that at least one API key must be configured
5. Verify distinction between:
   - "Tool not installed" (command not found)
   - "No providers configured" (command runs but returns empty)

**Expected Outcome**:

- Step 1 includes check for empty providers list
- "No providers" error handling is distinct from "tool not installed"
- Error message includes Provider Setup link
- Error message explains API key configuration requirement

**Postconditions**:

- Agent can distinguish and clearly report "no providers" vs "tool not installed"

---

#### TC-DOC-001 - PATH installation requirement documented

**Scenario Type**: Documentation
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/tools/text-to-image.md`
**Tags**: @documentation, @installation

**Preconditions**:

- Documentation file exists at `doc/tools/text-to-image.md`
- Change specification has been reviewed

**Steps**:

1. Open `doc/tools/text-to-image.md` in a text editor
2. Locate the **Installation** section
3. Verify there is a clear statement that PATH installation is **required** for AI agent usage (not optional)
4. Verify the statement is prominent (not buried in fine print)
5. Verify the statement is separate from/contrasts with "optional for direct CLI usage"
6. Search for any phrases suggesting PATH installation is optional for AI agents
7. Verify no conflicting guidance exists elsewhere in the document

**Expected Outcome**:

- Installation section includes clear statement: "PATH installation is required for AI agent usage" (or equivalent)
- The requirement is prominent and unambiguous
- No conflicting "optional" statements for agent usage
- Users understand they must install the tool system-wide to use with `@image-generator`

**Postconditions**:

- Documentation provides clear resolution path for users

---

#### TC-DOC-002 - System-level tool explanation

**Scenario Type**: Documentation
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, AC-F5-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/tools/text-to-image.md`
**Tags**: @documentation, @installation

**Preconditions**:

- Documentation file exists at `doc/tools/text-to-image.md`
- Change specification has been reviewed

**Steps**:

1. Open `doc/tools/text-to-image.md` in a text editor
2. Locate the Installation section (or appropriate section)
3. Verify there is an explanation of:
   - `text-to-image` is a system-level tool shared across projects
   - The tool is not installed per-project
   - Users add the tool to PATH for system-wide access
4. Verify the distinction between:
   - Project-level tools (installed in project directory)
   - System-level tools (installed globally, added to PATH)
5. Verify this explanation helps users understand why `@image-generator` uses system PATH invocation

**Expected Outcome**:

- Documentation explains system-level vs. project-level tool distinction
- Users understand `text-to-image` is shared across projects
- Explanation supports understanding of why PATH installation is required

**Postconditions**:

- Users have clear mental model of tool installation architecture

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Purpose | Notes |
|------------|---------|-------|
| Local dev | Manual review | Agent prompt and documentation files are reviewed locally |
| - | - | No functional testing environment required |

### 6.2 Test Data

No test data required. This is a documentation/prompt content verification effort.

### 6.3 Isolation Strategy

Not applicable — manual content review does not require isolation.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test File | Execution Command | Implementation Status |
|------|-----------|-------------------|----------------------|
| TC-AGENT-001 | Manual review | `grep "tools/text-to-image" .opencode/agent/image-generator.md` | Manual |
| TC-AGENT-002 | Manual review | Review `.opencode/agent/image-generator.md` for error handling | Manual |
| TC-AGENT-003 | Manual review | Review `.opencode/agent/image-generator.md` for provider check | Manual |
| TC-DOC-001 | Manual review | Review `doc/tools/text-to-image.md` Installation section | Manual |
| TC-DOC-002 | Manual review | Review `doc/tools/text-to-image.md` for system-level explanation | Manual |

**Note**: All tests are manual content verification. This is appropriate because:
1. The deliverables are Markdown files, not executable code
2. Verification requires human judgment for clarity and completeness
3. Grep patterns can assist verification but human review confirms correctness

### 7.1 Verification Commands

```bash
# TC-AGENT-001: Verify no "tools/text-to-image" patterns remain
grep -n "tools/text-to-image" .opencode/agent/image-generator.md
# Expected: No matches

# TC-AGENT-001: Verify "text-to-image" (without tools/) is used
grep -n "text-to-image" .opencode/agent/image-generator.md | head -20
# Expected: All occurrences use bare "text-to-image" command

# TC-DOC-001: Check for PATH requirement statement
grep -n -i "path.*required\|required.*path" doc/tools/text-to-image.md
# Expected: Clear statement about PATH requirement for AI agents

# TC-DOC-002: Check for system-level explanation
grep -n -i "system-level\|system wide\|shared.*project" doc/tools/text-to-image.md
# Expected: Explanation of system-level tool nature
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk ID | Risk | Impact | Probability | Mitigation |
|---------|------|--------|-------------|-----------|
| RSK-TP-1 | Manual review misses edge cases in documentation | Medium | Low | Follow structured review checklist from this test plan |
| RSK-TP-2 | Agent prompt changes break other workflows | Low | Low | Scope is limited to tool invocation; other prompt sections unchanged |
| RSK-TP-3 | User confusion during transition period | Medium | Medium | Documentation clarifies migration; PATH works for both approaches |

### 8.2 Assumptions

- The `text-to-image` CLI tool is correctly implemented as a system PATH command (current design)
- Users read documentation when directed by error messages
- The agent's bash tool correctly reports command-not-found errors
- Reviewers have access to the repository files for manual verification

### 8.3 Open Questions

| Question ID | Question | Blocking | Owner | Resolution |
|-------------|----------|----------|-------|------------|
| OQ-TP-1 | Should there be a smoke test with actual agent invocation? | No | N/A | Out of scope — requires API keys and setup overhead; manual review suffices for prompt changes |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-27 | @cwiakalski | Initial test plan created |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| - | - | - | Test plan not yet executed |