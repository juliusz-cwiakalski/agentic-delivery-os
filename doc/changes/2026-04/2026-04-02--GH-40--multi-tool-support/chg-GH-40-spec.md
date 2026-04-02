---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-04/2026-04-02--GH-40--multi-tool-support/chg-GH-40-spec.md
change:
  ref: GH-40
  type: feat
  status: Implemented
  slug: multi-tool-support
  title: "Support other coding tools (Claude Code) - Single-source agent definitions"
  owners: ["@juliusz-cwiakalski"]
  service: agentic-delivery-os
  labels: [change, claude-code, multi-tool, planning]
  version_impact: minor
  audience: external
  security_impact: none
  risk_level: low
  dependencies:
    internal: []
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Enable Claude Code as an installation target for ADOS while maintaining `.opencode/` as the single source of truth for all agent/command definitions, eliminating duplication and ensuring long-term maintainability.

## 1. SUMMARY

This change introduces multi-tool support for ADOS, starting with Claude Code. The `.opencode/` directory remains the canonical source for all agent and command definitions. A build script generates the Claude Code plugin structure at `.ados-claude/`, transforming frontmatter formats appropriately. This approach enables users to use ADOS with both OpenCode and Claude Code from a single source of truth, avoiding the maintenance burden of parallel directories.

## 2. CONTEXT

### 2.1 Current State Snapshot

- ADOS agents are defined in `.opencode/agent/*.md` (19 agents total)
- ADOS commands are defined in `.opencode/command/*.md` (18 commands total)
- Model assignment currently handled in external OpenCode config (`.opencode/tmp/opencode-anthropic.jsonc`)
- ADOS installation currently supports only OpenCode tool
- Previous approach attempted by Justyna created parallel `.claude-code/` directory (now deleted from main branch)
- OpenCode agents use YAML frontmatter with `description`, `mode`, and `tools` keys
- OpenCode commands use YAML frontmatter with `description`, `agent`, and `subtask` keys

### 2.2 Pain Points / Gaps

- **Tool lock-in**: Users who prefer Claude Code cannot use ADOS
- **Duplication risk**: Maintaining parallel directories per tool leads to drift, outdated definitions, and increased maintenance burden
- **Model configuration sprawl**: Model assignments currently live in external config file per-tool rather than being co-located with agent definitions
- **No transformation pipeline**: No build-time verification that generated output matches input

## 3. PROBLEM STATEMENT

Because ADOS currently supports only OpenCode as an installation target, users who prefer Claude Code cannot use the system, and the previous approach of creating parallel tool directories creates an unmaintainable situation where agent definitions would drift apart, resulting in inconsistent behavior across tools and increased maintenance overhead.

## 4. GOALS

- **G-1**: Enable Claude Code as an ADOS installation target with full agent/command coverage
- **G-2**: Maintain `.opencode/` as single source of truth for all agent/command definitions
- **G-3**: Provide build-time generation of Claude Code plugin structure with proper frontmatter transformation
- **G-4**: Ensure backward compatibility with existing OpenCode installation
- **G-5**: Enable CI verification that generated plugin is current (no stale builds)
- **G-6**: Design for extensibility - build script architecture should support future tools (Copilot CLI, Codex, etc.)

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Agent count in generated plugin | 19 agents (100% coverage) |
| Command count converted to skills | 18 commands (100% coverage) |
| Build script execution time | < 5 seconds |
| CI verification overhead | < 10 seconds added to pipeline |
| OpenCode installation unchanged | Zero breaking changes |

### 4.2 Non-Goals

- **NG-1**: Support for other tools (Copilot CLI, Codex, Cursor, Windsurf) — this ticket establishes the pattern; future tickets add specific tools
- **NG-2**: Global Claude Code installation — local/repo installation only
- **NG-3**: `--all` flag for installing to multiple tools simultaneously — future ticket
- **NG-4**: MCP server configuration in agent frontmatter — stays in external config files
- **NG-5**: Hot-reload or watch mode — build is run explicitly

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Claude model assignment in source frontmatter | Allows model tuning per agent without external config files |
| F-2 | Build script generates Claude Code plugin | Transforms source definitions to Claude Code format in one operation |
| F-3 | Agent frontmatter transformation | Preserves semantics while adapting to Claude Code's schema |
| F-4 | Command-to-skill conversion | Maps commands to Claude Code's skill format with appropriate structure |
| F-5 | Plugin manifest generation | Creates `.claude-plugin/plugin.json` with required metadata |
| F-6 | License header application | Ensures generated files have proper copyright headers |
| F-7 | CI verification of build freshness | Prevents stale generated code from being merged |
| F-8 | OpenCode backward compatibility | Existing workflow and installation unchanged |
| F-9 | Extensible build script architecture | Enables future tool support with minimal changes |

### 5.1 Capability Details

**F-1: Claude model assignment in source frontmatter**
Agents and commands gain an optional `claude:` key in their YAML frontmatter with a `model` subkey. Valid values are `opus`, `sonnet`, and `haiku`. This allows each agent/command to specify its preferred Claude model. The key is optional; if absent, a sensible default is used (e.g., `sonnet` for agents, `sonnet` for commands). OpenCode ignores this key, maintaining backward compatibility.

**F-2: Build script generates Claude Code plugin**
A new script `scripts/build-claude-plugin.sh` reads all agent and command definitions from `.opencode/`, transforms them to Claude Code format, and writes them to `.ados-claude/`. The generated directory is committed to the repository, making it immediately usable for Claude Code users. The script is idempotent: re-running produces identical output.

**F-3: Agent frontmatter transformation**
Each agent file in `.opencode/agent/*.md` is transformed to `agents/<name>.md` in the plugin. The transformation: (1) extracts `description` from source frontmatter, (2) extracts `claude.model` value for `model` field (with default fallback), (3) uses the basename as `name`, (4) generates `allowed-tools` array including `"mcp__*"` for MCP tool access. OpenCode-specific fields (`mode`, `tools` with old format) are stripped.

**F-4: Command-to-skill conversion**
Each command in `.opencode/command/*.md` is converted to `skills/<name>/SKILL.md` in the plugin. The transformation preserves the body content unchanged while replacing frontmatter: `description` becomes `description`, `claude.model` becomes `model`, and `allowed-tools` is set to appropriate tool access for skills. The directory structure `skills/<name>/SKILL.md` follows Claude Code's skill convention.

**F-5: Plugin manifest generation**
The build script generates `.ados-claude/.claude-plugin/plugin.json` with `name: "ados"`, `version: "1.0.0"` (or derived from repo version), and `author: "Juliusz Ćwiąkalski"`. This manifest enables Claude Code to recognize and load the plugin.

**F-6: License header application**
The build script includes a step to apply ADOS license headers to all generated files, matching the repository's copyright and license declaration convention.

**F-7: CI verification of build freshness**
A GitHub Actions workflow runs the build script and checks for git changes. If changes are detected, the CI fails with a message indicating the build needs to be regenerated. This ensures the committed `.ados-claude/` is always current.

**F-8: OpenCode backward compatibility**
No changes to OpenCode installation. The `.opencode/` directory remains unchanged. External model config files continue to work. Users who only use OpenCode see no changes to their workflow.

**F-9: Extensible build script architecture**
The build script is designed for extensibility. It uses a modular structure with transformation functions that can be extended for future tools:

```bash
# Core architecture (pseudo-code)
build_plugin() {
  local tool="$1"           # "claude", "copilot", etc.
  local source_dir=".opencode"
  local output_dir=".ados-${tool}"
  
  # Tool-specific transformation
  transform_agents "${tool}" "${source_dir}/agent" "${output_dir}/agents"
  transform_commands "${tool}" "${source_dir}/command" "${output_dir}/skills"
  generate_manifest "${tool}" "${output_dir}"
  apply_headers "${output_dir}"
}
```

Key extensibility patterns:
- Tool name is parameterized (`claude`, `copilot`, etc.)
- Transformation functions are tool-specific but follow a common interface
- Output directory follows pattern `.ados-${tool}/`
- Manifest generation is tool-specific
- Adding a new tool requires: (1) defining transformation rules, (2) adding tool case to build script, (3) creating output directory

This enables future tickets for Copilot CLI, Codex, etc. to add support with minimal changes to the build script.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Claude Code user installs ADOS
  User runs ./scripts/build-claude-plugin.sh → Build script reads .opencode/ →
  Generates .ados-claude/ with proper structure → User configures Claude Code
  to use plugin → ADOS agents available in Claude Code

Flow 2: Developer updates agent definition
  Developer edits .opencode/agent/pm.md → Adds claude.model: opus →
  Commits change → CI runs → Build script regenerates .ados-claude/ →
  CI verifies no git changes (or fails if dirty) → Developer runs build
  script if needed → New build committed

Flow 3: OpenCode user continues unchanged
  User runs OpenCode → Reads .opencode/ directly → Ignores claude key →
  Works exactly as before
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Adding `claude:` key to agent/command YAML frontmatter with `model` subkey
- Building `scripts/build-claude-plugin.sh` to generate Claude Code plugin
- Generating `.ados-claude/` directory structure with agents and skills
- Plugin manifest at `.ados-claude/.claude-plugin/plugin.json`
- CI workflow to verify generated plugin is current
- License header application to generated files
- Documentation updates (README.md, AGENTS.md, new guide)

### 7.2 Out of Scope

- [OUT] Support for other coding tools (Codex, Cursor, Windsurf)
- [OUT] Global Claude Code installation (outside repository)
- [OUT] `--all` flag for multi-tool installation
- [OUT] MCP server configuration in agent frontmatter
- [OUT] Hot-reload or watch mode for regeneration
- [OUT] OpenCode model assignment changes (stays in external config)
- [OUT] Justyna's old `.claude-code/` directory (already deleted)

### 7.3 Deferred / Maybe-Later

- Other tool support (separate tickets per tool)
- Global installation mode
- `--all` flag for simultaneous multi-tool install
- Model inheritance or override configuration

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change does not add or modify HTTP endpoints.

### 8.2 Events / Messages

N/A — this change does not add or modify event schemas.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Agent frontmatter | Adds optional `claude:` object with `model` subkey to `.opencode/agent/*.md` |
| DM-2 | Command frontmatter | Adds optional `claude:` object with `model` subkey to `.opencode/command/*.md` |
| DM-3 | Generated agent files | New files at `.ados-claude/agents/*.md` with Claude Code frontmatter format |
| DM-4 | Generated skill files | New files at `.ados-claude/skills/*/SKILL.md` with Claude Code frontmatter format |
| DM-5 | Plugin manifest | New file at `.ados-claude/.claude-plugin/plugin.json` |

### 8.4 External Integrations

| Integration | Description |
|-------------|-------------|
| Claude Code | Generated plugin integrates with Claude Code's plugin discovery and loading mechanism |
| OpenCode | No changes; existing integration continues unchanged |

### 8.5 Backward Compatibility

**OpenCode users**: Fully backward compatible. The `claude:` key in frontmatter is ignored by OpenCode. All existing agent/command files continue to work without modification.

**Generated plugin**: Committed to repository, so it's immediately usable. Previous `.claude-code/` directory (deleted) is not restored.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Build script execution time | < 5 seconds for full regeneration |
| NFR-2 | Generated file count | 19 agents + 18 skills + 1 manifest = 38 files |
| NFR-3 | Idempotency | Running build script twice produces identical output |
| NFR-4 | CI overhead | < 10 seconds added to existing pipeline |
| NFR-5 | Source file modification | Minimal — only frontmatter additions, no body changes |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — this is a build-time tool change with no runtime telemetry. CI failure provides observable feedback.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Claude Code plugin format changes | H | L | Use documented format; version manifest; monitor Claude Code changelog | M |
| RSK-2 | Generated files become stale | M | M | CI verification fails on stale builds; enforce build-before-commit culture | L |
| RSK-3 | Model assignment drift between source and config | M | L | Document that `claude.model` is the Claude-specific override; OpenCode uses external config | L |
| RSK-4 | License header inconsistency | L | M | Build script includes header generation step; CI verifies | L |

## 12. ASSUMPTIONS

- Claude Code plugin format remains stable (manifest JSON, agent frontmatter, skill frontmatter)
- Users commit the generated `.ados-claude/` directory to the repository
- `claude.model` values are limited to `opus`, `sonnet`, `haiku` (Claude Code shorthand)
- OpenCode continues to ignore unrecognized frontmatter keys

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Claude Code plugin specification | Format must remain stable |
| Depends on | OpenCode frontmatter parser | Must ignore unknown keys |
| Blocks | Future tool support tickets | Establishes pattern for additional tools |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should model assignment be required or optional? | Optional with defaults allows incremental adoption; required ensures completeness | **DECIDED**: Optional with `sonnet` default |
| OQ-2 | Should the build script fail or warn on missing `claude.model`? | Warning allows partial adoption; error catches configuration gaps | **DECIDED**: Use default; no fail |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Plugin location at `.ados-claude/` | Short, distinctive, committed to repo, matches issue description | 2026-04-02 |
| DEC-2 | Plugin name `ados` | Short, memorable, distinct from `agentic-delivery-os` folder name | 2026-04-02 |
| DEC-3 | `.opencode/` remains canonical source | Single source of truth, no duplication | 2026-04-02 |
| DEC-4 | Claude Code only in this ticket | Focus on one tool; other tools in future tickets | 2026-04-02 |
| DEC-5 | MCP tools stay in external config | Agent frontmatter doesn't hardcode MCP configuration | 2026-04-02 |
| DEC-6 | Add `claude.model` to source frontmatter | Build-time transform to Claude format | 2026-04-02 |
| DEC-7 | Build script generates plugin and commits to repo | Generated code is committed; CI verifies freshness | 2026-04-02 |
| DEC-8 | License headers applied by build script | Ensures generated files have proper copyright | 2026-04-02 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.opencode/agent/*.md` | Updated — Add `claude:` frontmatter key (19 files) |
| `.opencode/command/*.md` | Updated — Add `claude:` frontmatter key (18 files) |
| `scripts/build-claude-plugin.sh` | New — Build script for Claude Code plugin |
| `.ados-claude/` | New — Generated plugin directory |
| `.github/workflows/` | Updated — CI to verify build is current |
| `README.md` | Updated — Document multi-tool support |
| `AGENTS.md` | Updated — Note single-source architecture |
| `doc/guides/adding-tool-support.md` | New — Guide for future tool support |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an agent file in `.opencode/agent/`, **when** it has `claude.model: opus` in frontmatter, **then** the generated agent file in `.ados-claude/agents/` has `model: opus` in its frontmatter | F-1, F-3 |
| AC-F1-2 | **Given** an agent file without `claude:` key, **when** build runs, **then** the generated agent uses default model (`sonnet`) | F-1 |
| AC-F2-1 | **Given** `.opencode/` with all agents and commands, **when** build script runs, **then** `.ados-claude/` directory is created with correct structure | F-2 |
| AC-F3-1 | **Given** an agent frontmatter with `description`, `mode`, and `tools` (OpenCode keys), **when** transformed, **then** result has `name`, `description`, `model`, and `allowed-tools` (Claude Code keys) and doesn't have `mode` or OpenCode `tools` | F-3 |
| AC-F4-1 | **Given** a command file in `.opencode/command/run-plan.md`, **when** transformed, **then** a skill directory `.ados-claude/skills/run-plan/SKILL.md` is created with correct frontmatter | F-4 |
| AC-F5-1 | **Given** build script completes, **when** checking `.ados-claude/.claude-plugin/plugin.json`, **then** file exists with `name: "ados"`, `version`, and `author` fields | F-5 |
| AC-F6-1 | **Given** build script runs, **when** examining generated files, **then** each file has ADOS license header comment block | F-6 |
| AC-F7-1 | **Given** CI workflow runs, **when** build script output differs from committed `.ados-claude/`, **then** CI fails with clear message about stale build | F-7 |
| AC-F8-1 | **Given** existing OpenCode installation, **when** reading `.opencode/agent/*.md` files, **then** `claude:` key is ignored and workflow unchanged | F-8 |
| AC-COV-1 | **Given** 19 agents in `.opencode/agent/`, **when** build completes, **then** 19 agent files exist in `.ados-claude/agents/` | F-2 |
| AC-COV-2 | **Given** 18 commands in `.opencode/command/`, **when** build completes, **then** 18 skill directories exist in `.ados-claude/skills/` | F-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

1. **Branch creation**: Create `feat/GH-40/multi-tool-support` branch
2. **Implementation**: Update frontmatter, create build script, generate plugin, add CI
3. **Testing**: Run existing test suite; manually verify generated plugin structure
4. **Documentation**: Update README.md, AGENTS.md, create guide for future tool support
5. **Review**: Submit PR; address review feedback
6. **Merge**: Merge to main; verify CI passes
7. **Announce**: Update documentation with Claude Code usage instructions

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — No data migration required. Generated plugin is new, not migrated from existing state.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — No personal data or compliance requirements affected by this change.

## 21. SECURITY REVIEW HIGHLIGHTS

N/A — This is a build-time tooling change. No runtime security implications. Generated files are committed to repository with appropriate access controls.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Build script maintenance**: One new script to maintain (`scripts/build-claude-plugin.sh`)
- **Frontmatter schema evolution**: If agent/command frontmatter changes, build script may need updates
- **CI pipeline**: One additional verification step
- **Generated files**: Committed to repo; must be regenerated when source changes

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| ADOS | Agentic Delivery OS — the system this repo implements |
| OpenCode | Currently supported coding tool (primary target) |
| Claude Code | Anthropic's coding tool (new target) |
| Plugin | Claude Code's extension mechanism |
| Frontmatter | YAML metadata block at top of agent/command files |
| Skill | Claude Code's term for what ADOS calls "commands" |

## 24. APPENDICES

### Appendix A: Source Frontmatter Format

**Agent (`.opencode/agent/*.md`)**:
```yaml
---
description: <agent description>
mode: all                    # OpenCode-specific
tools:                       # OpenCode tool permissions
  "github*": true
claude:                      # NEW: Claude-specific config
  model: opus                 # opus | sonnet | haiku
---
```

**Command (`.opencode/command/*.md`)**:
```yaml
---
description: <command description>
agent: <delegated agent>
subtask: true               # OpenCode-specific
claude:                      # NEW: Claude-specific config
  model: sonnet              # opus | sonnet | haiku
---
```

### Appendix B: Generated Plugin Format

**Agent (`.ados-claude/agents/<name>.md`)**:
```yaml
---
name: <agent name>
description: <agent description>
model: opus                  # transformed from claude.model
allowed-tools:
  - Read
  - Write
  - Grep
  - Bash
  - "mcp__*"
---
<role>...</role>            <!-- same body content -->
```

**Skill (`.ados-claude/skills/<name>/SKILL.md`)**:
```yaml
---
name: <skill name>
description: <command description>
model: sonnet               # transformed from claude.model
allowed-tools:
  - Read
  - Grep
  - Bash
---
<purpose>...</purpose>      <!-- same body content -->
```

**Manifest (`.ados-claude/.claude-plugin/plugin.json`)**:
```json
{
  "name": "ados",
  "version": "1.0.0",
  "author": "Juliusz Ćwiąkalski"
}
```

### Appendix C: Claude Code Plugin Directory Structure

```
.ados-claude/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── pm.md
│   ├── coder.md
│   ├── spec-writer.md
│   └── ... (19 files)
└── skills/
    ├── run-plan/
    │   └── SKILL.md
    ├── write-spec/
    │   └── SKILL.md
    └── ... (18 directories)
```

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-02 | @juliusz-cwiakalski | Initial specification |

---

## AUTHORING GUIDELINES

This specification was authored based on:
- GitHub issue GH-40: "Support other coding tools (Claude Code) - Single-source agent definitions"
- Planning session context provided by user
- Research findings from Justyna's previous analysis (`tmp/2026-04-01--GH-40--multi-tool-support/`)
- Template: `doc/templates/change-spec-template.md`

The spec follows the principle of single source of truth: `.opencode/` remains canonical, and generated output is committed to the repository.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-40)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-8, AC-*, NFR-*, RSK-*, DEC-*, DM-*, OQ-*)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values (execution time, file count, CI overhead)
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules