---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-27--GH-47--fix-image-generator-tool-path/chg-GH-47-plan.md
id: chg-GH-47-fix-image-generator-tool-path
status: Proposed
created: 2026-03-27T00:00:00Z
last_updated: 2026-03-27T00:00:00Z
owners:
  - "@cwiakalski"
service: agentic-delivery-os
labels:
  - agents
  - documentation
  - developer-experience
links:
  change_spec: ./chg-GH-47-spec.md
summary: >
  Fix the @image-generator agent to correctly invoke text-to-image as a system PATH command
  (instead of a project-relative path), detect when the tool is not installed, and provide
  users with clear installation guidance. Update documentation to clarify that PATH
  installation is required for AI agent usage.
version_impact: none
---

# IMPLEMENTATION PLAN — GH-47: Fix @image-generator to invoke text-to-image as system PATH command

## Context and Goals

This change addresses a usability issue where the `@image-generator` agent references `text-to-image` using a project-relative path (`tools/text-to-image`) instead of invoking it as a system PATH command. When users have not installed the tool system-wide, the agent wastes effort searching project directories and provides unhelpful error messages instead of clear installation guidance.

**Goals**:
- G-1: Agent invokes `text-to-image` without `tools/` prefix
- G-2: Agent detects and reports "tool not installed" with clear installation URL
- G-3: Agent detects and reports "no providers configured" with setup guide link
- G-4: Documentation clarifies PATH installation is required for AI agent usage
- G-5: Agent does not search project directories for the tool

**No open questions** — the spec provides clear direction.

## Scope

### In Scope

- **F-1**: Update `.opencode/agent/image-generator.md` tool invocation from `tools/text-to-image` to `text-to-image`
- **F-2**: Add tool availability detection to agent's process (exit code 127 = "command not found")
- **F-3**: Add "tool not installed" error handling with installation URL
- **F-4**: Add "no providers configured" error handling with provider setup link
- **F-5**: Update `doc/tools/text-to-image.md` installation section to clarify PATH requirement

### Out of Scope

- [OUT] Modifying `tools/text-to-image` CLI tool code (NG-1)
- [OUT] Auto-installation scripts or setup automation (NG-2)
- [OUT] Changes to other agents that might use tools (NG-4)
- [OUT] Creating a pre-flight check for all tool-using agents (OQ-1)

### Constraints

- **C-1**: Must preserve all existing agent functionality for users who have `text-to-image` properly installed
- **C-2**: Must not break the agent prompt structure or markdown formatting
- **C-3**: Documentation must remain accurate for both CLI users and AI agent users

### Risks

- **RSK-1**: Users confused by "PATH required" change. **Mitigated by**: Clear documentation explaining system-level tool and direct links in error messages.
- **RSK-2**: Existing users break if they relied on `tools/` relative path. **Mitigated by**: PATH lookup still works if `tools/` is in PATH; documented migration.
- **RSK-3**: Incorrect error handling introduced. **Mitigated by**: Careful testing of error detection patterns (exit code 127 vs. empty providers list).

### Success Metrics

| Metric | Target |
|--------|--------|
| Failed invocations due to "tool not found" | 0 (agent detects and reports clearly) |
| Time from error to successful resolution | < 5 minutes (users follow installation guide) |
| Agent steps wasted on project directory search | 0 |
| Documentation clarity on installation | Clear statement in README and usage guide |

## Phases

### Phase 1: Update Documentation (doc/tools/text-to-image.md)

**Goal**: Clarify that PATH installation is required for AI agent usage and explain system-level vs. project-level tool distinction.

**Tasks**:

- [ ] **1.1** Restructure Installation section to emphasize system-level tool requirement
- [ ] **1.2** Remove "optionally" from PATH instructions (make clear it's required for AI agents)
- [ ] **1.3** Add clarification box explaining system tool vs. per-project dependency
- [ ] **1.4** Add explicit note: "For AI agent usage, PATH installation is required"

**Acceptance Criteria**:

- Must: Installation section states PATH installation is required for AI agent usage (AC-F5-1)
- Must: Documentation explains this is a system-level tool shared across projects (AC-F5-2)
- Should: Users can easily distinguish between CLI usage and AI agent requirements

**Files and modules**:

- `doc/tools/text-to-image.md` (updated)

**Tests**:

- Manual review: Verify Installation section clearly states PATH requirement
- Manual review: Verify system-level tool explanation is prominent

**Completion signal**: `docs(GH-47): clarify text-to-image PATH requirement in documentation`

---

### Phase 2: Update Agent Prompt (.opencode/agent/image-generator.md)

**Goal**: Fix tool invocation to use system PATH, add tool availability detection and error handling.

**Tasks**:

- [ ] **2.1** Update `<tool_reference>` section:
  - Change `CLI: tools/text-to-image` → `CLI: text-to-image`
  - Add installation URL link (GitHub source URL)
  - Docs link should use GitHub URL format
- [ ] **2.2** Update `<process>` Step 1 with tool availability detection:
  - Detect "command not found" (exit code 127)
  - Add clear stop condition with installation URL (`doc/tools/text-to-image.md#installation`)
  - Detect empty providers list from `--list-models` output
  - Add clear stop condition with provider setup link (`doc/tools/text-to-image.md#provider-setup`)
- [ ] **2.3** Update all example commands to use `text-to-image` (remove `tools/` prefix):
  - Lines 71, 207, 238, and all `<example>` blocks
- [ ] **2.4** Preserve all existing model selection, prompt engineering, and sidecar guidance unchanged

**Acceptance Criteria**:

- Must: All tool invocations use `text-to-image` (not `tools/text-to-image`) (AC-F1-1)
- Must: Agent reports "tool not installed" with installation URL when command not found (AC-F3-1)
- Must: Agent reports "no providers configured" with setup guide link when list is empty (AC-F4-1)
- Should: Agent does NOT search project directories for the tool

**Files and modules**:

- `.opencode/agent/image-generator.md` (updated)

**Tests**:

- Manual review: Verify all `tools/text-to-image` references changed to `text-to-image`
- Manual review: Verify Step 1 includes exit code 127 detection and installation guidance
- Manual review: Verify error handling links to correct documentation sections

**Completion signal**: `fix(GH-47): invoke text-to-image as system PATH command`

---

### Phase 3: Finalize and Release

**Goal**: Verify all changes, commit, and prepare for merge.

**Tasks**:

- [ ] **3.1** Review both modified files for consistency and accuracy
- [ ] **3.2** Verify no remaining `tools/text-to-image` references in agent prompt (search the file)
- [ ] **3.3** Verify documentation links are correct and resolvable
- [ ] **3.4** Stage changes (both files)
- [ ] **3.5** Create final commit

**Acceptance Criteria**:

- Must: All acceptance criteria from spec are met
- Must: No `<...>` placeholders remain
- Must: Documentation links are valid

**Files and modules**:

- `doc/tools/text-to-image.md` (finalized)
- `.opencode/agent/image-generator.md` (finalized)

**Tests**:

- Grep search: Verify no `tools/text-to-image` in agent file
- Link validation: Verify `doc/tools/text-to-image.md#installation` and `#provider-setup` anchors exist

**Completion signal**: `docs(GH-47): finalize plan — text-to-image PATH fix`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | Agent invoked with text-to-image installed | 2 | AC-F1-1 |
| TS-2 | Agent invoked with text-to-image NOT installed (command not found) | 2 | AC-F3-1 |
| TS-3 | Agent invoked with text-to-image installed but no providers configured | 2 | AC-F4-1 |
| TS-4 | User reads documentation Installation section | 1, 3 | AC-F5-1, AC-F5-2 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-47-spec.md | Spec |
| Implementation plan | ./chg-GH-47-plan.md | Plan |
| Agent prompt | `.opencode/agent/image-generator.md` | Updated |
| Tool documentation | `doc/tools/text-to-image.md` | Updated |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-27 | plan-writer | Initial plan |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Not Started | - | - | - | Documentation clarification |
| 2 | Not Started | - | - | - | Agent prompt fix |
| 3 | Not Started | - | - | - | Finalization |