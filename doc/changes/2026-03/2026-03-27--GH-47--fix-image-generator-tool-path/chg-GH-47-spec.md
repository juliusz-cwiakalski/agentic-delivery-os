---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-27--GH-47--fix-image-generator-tool-path/chg-GH-47-spec.md
change:
  ref: GH-47
  type: fix
  status: Proposed
  slug: fix-image-generator-tool-path
  title: "Fix @image-generator to invoke text-to-image as system PATH command and provide clear install guidance"
  owners:
    - "@cwiakalski"
  service: agentic-delivery-os
  labels:
    - agents
    - documentation
    - developer-experience
  version_impact: none
  audience: internal
  security_impact: none
  risk_level: low
  dependencies:
    internal: []
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Fix the `@image-generator` agent to correctly invoke the `text-to-image` CLI as a system PATH command (instead of a project-relative path), detect when the tool is not installed, and provide users with clear installation guidance. Update documentation to clarify that PATH installation is required for AI agent usage.

## 1. SUMMARY

This change fixes a discrepancy between how the `@image-generator` agent invokes the `text-to-image` tool and how the tool is designed to be installed. The agent currently references `tools/text-to-image` (a project-relative path), but the tool is designed to be installed system-wide and added to PATH. This causes confusion and wasted effort when the tool is not installed—agents search project directories, delegate to confused subagents, and never guide users toward installation. The fix updates the agent prompt to use `text-to-image` (system PATH) and adds clear error handling with installation guidance. Documentation is clarified to state that PATH installation is required for AI agent usage.

## 2. CONTEXT

### 2.1 Current State Snapshot

The `@image-generator` agent (`.opencode/agent/image-generator.md`) is designed to generate AI images using the `text-to-image` CLI tool. The agent references the tool using the project-relative path `tools/text-to-image` throughout its prompt:

- Line 46: `CLI: tools/text-to-image`
- Line 71: `tools/text-to-image --list-models --output-format json`
- Line 207: `Run tools/text-to-image --list-models --output-format json`
- Line 238: `Execute tools/text-to-image`
- Examples (multiple occurrences): `tools/text-to-image --prompt "..." --output ...`

The `text-to-image` tool (`tools/text-to-image`) is designed to be:

1. Cloned or copied to the user's machine
2. Optionally added to PATH for system-wide access
3. Invoked as `text-to-image` (without the `tools/` prefix) when in PATH

The documentation (`doc/tools/text-to-image.md`) says "optionally, add `tools/` to your PATH" without clarifying that PATH installation is required for AI agents to reliably discover and invoke the tool.

### 2.2 Pain Points / Gaps

1. **Broken invocation**: When `text-to-image` is not installed system-wide, the agent fails with "no such file or directory" because it invokes `tools/text-to-image` from the current project directory.

2. **Wasted agent effort**: The agent searches project directories attempting to locate the tool, confusing users who don't understand why a system tool is being sought in project files.

3. **Unhelpful subagent delegation**: The agent delegates to subagents that produce generic "SYSTEM_LIMITATION" messages about the current project, instead of diagnosing "tool not installed" clearly.

4. **No installation guidance**: Users who encounter this error receive no guidance on how to install the tool—it's a system-level CLI that needs to be added to PATH.

5. **Ambiguous documentation**: The documentation says PATH installation is "optional," but for AI agent usage, it's functionally required because agents don't know to check `tools/` in the current repo.

6. **Distinguishing failures**: The agent cannot distinguish between "tool not installed" vs. "no providers configured," both of which result in different user actions.

## 3. PROBLEM STATEMENT

Because the `@image-generator` agent invokes `text-to-image` using a project-relative path (`tools/text-to-image`) instead of treating it as a system PATH command, users who have not installed the tool system-wide experience confusing failures where the agent searches project directories, delegates to subagents for error handling, and produces unhelpful "SYSTEM_LIMITATION" messages. This results in a poor developer experience with no clear path to resolution, as users are not guided to install the tool or add it to PATH.

## 4. GOALS

- **G-1**: The `@image-generator` agent correctly invokes `text-to-image` as a system PATH command (using `text-to-image` not `tools/text-to-image`).
- **G-2**: When `text-to-image` is not found in PATH, the agent reports a clear "tool not installed" error with installation URL and explains it's a system-level tool.
- **G-3**: When `text-to-image` is found but has no configured providers, the agent reports "no providers configured" with setup guide link.
- **G-4**: Documentation clearly states that PATH installation is required for AI agent usage and clarifies system-level vs. project-level tool distinction.
- **G-5**: The agent does not search project directories for the tool or delegate to subagents for tool-not-found errors.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Failed invocations due to "tool not found" | 0 (agent detects and reports clearly) |
| Time from error to successful resolution | < 5 minutes (users follow installation guide) |
| Agent steps wasted on project directory search | 0 |
| Documentation clarity on installation | Clear statement in README and usage guide |

### 4.2 Non-Goals

- **NG-1**: Modifying the `text-to-image` CLI tool itself (no code changes to the tool).
- **NG-2**: Auto-installing the tool (users must install manually).
- **NG-3**: Supporting project-relative invocation (PATH-only invocation is the correct approach).
- **NG-4**: Changing how other agents invoke tools (scope is limited to `@image-generator`).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|-------------|-----------|
| F-1 | System PATH invocation | Agent must invoke `text-to-image` as a system command, not a project-relative path, matching the tool's design as a system-level CLI. |
| F-2 | Tool availability detection | Agent must check if `text-to-image` is available in PATH before attempting to use it, providing immediate feedback if not found. |
| F-3 | "Tool not installed" error handling | When the tool is absent, agent must report the error clearly with installation URL and explanation that it's a system-level tool. |
| F-4 | "No providers configured" error handling | When the tool is present but has no API keys, agent must report empty providers with link to setup guide. |
| F-5 | Documentation clarification | Documentation must state that PATH installation is required for AI agent usage and explain the system-level nature of the tool. |

### 5.1 Capability Details

**F-1: System PATH invocation**

The agent's `<tool_reference>` section and all example commands must use `text-to-image` (without the `tools/` prefix) to invoke the tool. This matches the tool's design as a system-level CLI that users add to PATH.

Examples section commands change from:
- `tools/text-to-image --list-models --output-format json`
- `tools/text-to-image --prompt "..." --output img.avif`

To:
- `text-to-image --list-models --output-format json`
- `text-to-image --prompt "..." --output img.avif`

**F-2: Tool availability detection**

The agent must detect whether `text-to-image` is available in PATH before proceeding with the generation workflow. This is done by attempting the command and checking the exit code. If the tool is not found (command fails to execute), the agent reports this immediately rather than searching project directories.

**F-3: "Tool not installed" error handling**

When `text-to-image` command is not found, the agent must:
1. Report that the tool is not installed (system-level CLI)
2. Provide the installation URL: `doc/tools/text-to-image.md`
3. Explain that the user needs to install the tool and add it to PATH
4. NOT search project directories or delegate to subagents for tool discovery

**F-4: "No providers configured" error handling**

When `text-to-image --list-models` succeeds but returns an empty list, the agent must:
1. Report that no providers are configured
2. Link to the Provider Setup section: `doc/tools/text-to-image.md#provider-setup`
3. Explain that at least one API key must be configured

**F-5: Documentation clarification**

The `doc/tools/text-to-image.md` file must be updated to:
1. Clarify that PATH installation is **required** for AI agent usage (not optional)
2. Explain that `text-to-image` is a system-level tool shared across projects
3. Remove or rephrase "optionally, add `tools/` to your PATH" to avoid confusion

## 6. USER & SYSTEM FLOWS

```
Flow 1: Tool installed and providers configured (success)
  User invokes @image-generator with image request
  → Agent runs: text-to-image --list-models --output-format json
  → Tool found, providers available
  → Agent selects model, generates image
  → Success: image created, sidecar YAML written
  → Agent reports results to user

Flow 2: Tool not installed (clear error)
  User invokes @image-generator with image request
  → Agent runs: text-to-image --list-models --output-format json
  → Command fails (tool not found)
  → Agent reports:
    "text-to-image is not installed or not in PATH.
     This is a system-level tool that must be installed separately.
     Installation guide: doc/tools/text-to-image.md#installation"
  → Agent does NOT search project directories
  → Agent does NOT delegate to subagents

Flow 3: Tool installed but no providers configured (clear error)
  User invokes @image-generator with image request
  → Agent runs: text-to-image --list-models --output-format json
  → Tool found, but returns empty list
  → Agent reports:
    "No providers configured. Set up at least one provider API key.
     Provider setup guide: doc/tools/text-to-image.md#provider-setup"
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Updating `.opencode/agent/image-generator.md`:
  - Changing all `tools/text-to-image` references to `text-to-image`
  - Adding tool availability detection step to `<process>`
  - Adding "tool not installed" error handling with installation guidance
  - Adding "no providers configured" error handling with setup guidance
- Updating `doc/tools/text-to-image.md`:
  - Clarifying PATH installation requirements
  - Explaining system-level vs. project-level tool usage

### 7.2 Out of Scope

- [OUT] Modifying `tools/text-to-image` CLI tool code
- [OUT] Auto-installation scripts or setup automation
- [OUT] Changes to other agents that might use tools
- [OUT] Adding tool dependency checking to other workflows
- [OUT] Creating a tool wrapper or alias system

### 7.3 Deferred / Maybe-Later

- Consider adding a tool discovery/verification command to ADOS that checks if all required tools are in PATH before any agent work begins.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — This change affects agent prompts and documentation only.

### 8.2 Events / Messages

N/A — This change affects agent prompts and documentation only.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|----------|-------------|
| DM-1 | Agent prompt reference | `.opencode/agent/image-generator.md` — changes to tool invocation pattern |
| DM-2 | Documentation | `doc/tools/text-to-image.md` — clarification on installation requirements |

### 8.4 External Integrations

N/A — This change affects agent prompts and documentation only.

### 8.5 Backward Compatibility

- **Breaking change for users**: Users who previously relied on `tools/text-to-image` being accessible from the project directory must now install the tool system-wide and add it to PATH. This is the intended usage pattern and is documented as required.
- **Agent compatibility**: The agent fix ensures correct usage going forward; existing projects that have the tool in `tools/` will continue to work because PATH-lookups will also find the tool if `tools/` is in PATH.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Error message clarity | "Tool not installed" vs. "No providers" must be distinctly reported; user should know exactly what to do in both cases |
| NFR-2 | Error recovery time | User should be able to resolve "tool not installed" error in < 5 minutes by following documentation |
| NFR-3 | Agent efficiency | Zero steps wasted on project directory search when tool is not installed |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — This change affects agent prompts and documentation only. No telemetry changes required.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Users confused by "PATH required" change | M | L | Documentation clearly explains system-level tool and installation steps; agent provides direct links to docs | Low |
| RSK-2 | Existing users break if they relied on `tools/` relative path | L | L | Document migration; PATH lookup still works if `tools/` is in PATH | Low |
| RSK-3 | Incorrect error handling introduced in agent prompt | L | L | Thorough testing of the three flows (success, tool missing, no providers) before merge | Low |

## 12. ASSUMPTIONS

- The `text-to-image` tool is correctly implemented as a system PATH command (its current design).
- Users read the documentation when directed by error messages.
- The agent's bash tool correctly reports command-not-found errors.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | `text-to-image` CLI tool | Must be installed system-wide and in PATH for agent to work |
| Depends on | Agent documentation | Users must follow installation guide to configure tool |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should we add a pre-flight check to all tool-using agents? | Other agents may have similar issues; this could be a pattern to adopt | Future consideration — out of scope |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Use `text-to-image` (system PATH) not `tools/text-to-image` (relative) | The tool is designed to be installed system-wide and added to PATH; this is the intended usage pattern for CLI tools shared across projects | 2026-03-27 |
| DEC-2 | Detect tool availability at start of workflow | Immediate detection provides clearer error messages and prevents wasted agent work searching project directories | 2026-03-27 |
| DEC-3 | Link to documentation in error messages | Users need actionable guidance; linking directly to installation/setup sections reduces resolution time | 2026-03-27 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.opencode/agent/image-generator.md` | Updated — Tool invocation and error handling |
| `doc/tools/text-to-image.md` | Updated — Installation requirements clarification |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the `@image-generator` agent prompt, **when** a user requests image generation, **then** all tool invocations use `text-to-image` (not `tools/text-to-image`) | F-1 |
| AC-F3-1 | **Given** `text-to-image` is not installed in PATH, **when** the agent attempts to run it, **then** the agent reports "tool not installed" with the installation URL (`doc/tools/text-to-image.md`) and does NOT search project directories | F-3 |
| AC-F4-1 | **Given** `text-to-image` is installed but no providers are configured, **when** the agent runs `--list-models`, **then** the agent reports "no providers configured" with link to Provider Setup section | F-4 |
| AC-F5-1 | **Given** the `text-to-image` documentation, **when** a user reads the Installation section, **then** they see a clear statement that PATH installation is required for AI agent usage | F-5 |
| AC-F5-2 | **Given** the `text-to-image` documentation, **when** a user reads about installation, **then** the documentation explains that this is a system-level tool shared across projects | F-5 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

1. Update `doc/tools/text-to-image.md` with clarified installation requirements
2. Update `.opencode/agent/image-generator.md` with corrected invocation and error handling
3. Verify the three flows work correctly in a clean environment without the tool installed
4. Merge to main branch
5. No version bump required (documentation and prompt fix only)

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — No data migration required.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — This change affects agent prompts and documentation only. No PII or sensitive data handling changes.

## 21. SECURITY REVIEW HIGHLIGHTS

N/A — This change affects agent prompts and documentation only. No security implications.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Users who previously worked around the issue by having `tools/` in their working directory must now install the tool system-wide.
- No ongoing maintenance impact—this is a one-time fix to align agent behavior with tool design.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| PATH | System environment variable listing directories where executable programs are searched |
| System-level tool | A CLI tool installed globally on the system, accessible from any directory via PATH |
| Project-relative path | A path relative to the current project directory (e.g., `tools/text-to-image`) |

## 24. APPENDICES

### A. Current error behavior (problem)

When `text-to-image` is not installed and the agent runs `tools/text-to-image --list-models`:

1. Command fails: `bash: tools/text-to-image: No such file or directory`
2. Agent attempts to locate the tool by searching project files (grep, glob)
3. Agent delegates to a subagent with vague context
4. Subagent produces "SYSTEM_LIMITATION" message about the project
5. User receives no actionable guidance

### B. Expected error behavior (solution)

When `text-to-image` is not installed and the agent runs `text-to-image --list-models`:

1. Command fails: `bash: text-to-image: command not found`
2. Agent immediately reports:
   ```
   text-to-image is not installed or not in PATH.
   
   This is a system-level CLI tool that must be installed separately.
   Installation guide: doc/tools/text-to-image.md#installation
   
   After installation, ensure 'text-to-image' is accessible from any directory.
   ```
3. Agent does NOT search project directories
4. User can follow the installation guide and retry

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-27 | @cwiakalski | Initial specification |

---

## AUTHORING GUIDELINES

- Derived from GitHub issue GH-47 and planning-session context
- Scoped to agent prompt and documentation changes only
- No implementation details or code-level tasks included
- Acceptance criteria use Given/When/Then format and reference capability IDs

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-47)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules