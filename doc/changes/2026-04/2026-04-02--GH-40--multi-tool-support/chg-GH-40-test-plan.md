---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-04/2026-04-02--GH-40--multi-tool-support/chg-GH-40-test-plan.md
id: chg-GH-40-test-plan
status: Proposed
created: "2026-04-02"
last_updated: "2026-04-02"
owners: ["@juliusz-cwiakalski"]
service: agentic-delivery-os
labels: [change, claude-code, multi-tool, testing]
version_impact: minor
summary: >
  Test plan for GH-40: Multi-tool support (Claude Code). Covers build script generation of Claude Code plugin,
  agent frontmatter transformation, command-to-skill conversion, plugin manifest generation, license header
  application, CI verification, and OpenCode backward compatibility. Testing approach combines automated
  unit/integration tests (bash testing framework), CI workflow verification, and manual end-to-end verification
  in Claude Code.
links:
  change_spec: ./chg-GH-40-spec.md
  implementation_plan: "N/A — implementation plan not yet created"
  testing_strategy: ".ai/rules/bash.md (bash testing framework)"
---

# Test Plan - Support other coding tools (Claude Code) - Single-source agent definitions

## 1. Scope and Objectives

### 1.1 Overview

This test plan covers verification of GH-40: Multi-tool support for Claude Code. The change introduces a build script (`scripts/build-claude-plugin.sh`) that transforms ADOS agent and command definitions from `.opencode/` format to Claude Code plugin format at `.ados-claude/`. The transformation preserves semantics while adapting to Claude Code's frontmatter schema, ensuring single-source truth maintenance.

### 1.2 In Scope

- **F-1**: Claude model assignment in source frontmatter verification
- **F-2**: Build script execution and output correctness
- **F-3**: Agent frontmatter transformation accuracy
- **F-4**: Command-to-skill conversion correctness
- **F-5**: Plugin manifest generation
- **F-6**: License header application to generated files
- **F-7**: CI verification of build freshness
- **F-8**: OpenCode backward compatibility (no breaking changes)
- **NFR-1**: Build script performance (< 5 seconds)
- **NFR-3**: Idempotency (running twice produces identical output)
- **NFR-5**: Source file minimal modification (frontmatter only)
- All acceptance criteria (AC-F1-1 through AC-COV-2)

### 1.3 Out of Scope & Known Gaps

- **Runtime testing in Claude Code**: Plugin loading and execution in live Claude Code environment is out of scope for automated testing, covered by manual verification checklist
- **MCP tool functionality**: MCP tool behavior is config-driven and unchanged by this change
- **Other tool support**: Codex, Cursor, Windsurf support is deferred to future tickets (NG-1)
- **Performance benchmarking**: NFR-1 threshold is simple timing assertion, not rigorous benchmarking

## 2. References

| Document | Location |
|----------|----------|
| Change Specification | `doc/changes/2026-04/2026-04-02--GH-40--multi-tool-support/chg-GH-40-spec.md` |
| Bash Testing Framework | `.ai/rules/bash.md` (embedded testing framework) |
| Agent definitions | `.opencode/agent/*.md` (19 files) |
| Command definitions | `.opencode/command/*.md` (18 files) |
| Claude Code plugin spec | https://docs.anthropic.com/en/docs/claude-code/plugins (external reference) |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| F-ID | Capability | AC-IDs | TC-IDs | Status |
|------|-----------|--------|--------|--------|
| F-1 | Claude model assignment in source frontmatter | AC-F1-1, AC-F1-2 | TC-F1-001, TC-F1-002 | Covered |
| F-2 | Build script generates Claude Code plugin | AC-F2-1 | TC-F2-001, TC-F2-002, TC-F2-003 | Covered |
| F-3 | Agent frontmatter transformation | AC-F3-1 | TC-F3-001, TC-F3-002, TC-F3-003 | Covered |
| F-4 | Command-to-skill conversion | AC-F4-1 | TC-F4-001, TC-F4-002 | Covered |
| F-5 | Plugin manifest generation | AC-F5-1 | TC-F5-001, TC-F5-002 | Covered |
| F-6 | License header application | AC-F6-1 | TC-F6-001 | Covered |
| F-7 | CI verification of build freshness | AC-F7-1 | TC-F7-001, TC-F7-002 | Covered |
| F-8 | OpenCode backward compatibility | AC-F8-1 | TC-F8-001 | Covered |
| AC-COV-1 | Agent count coverage (19 agents) | AC-COV-1 | TC-COV-001 | Covered |
| AC-COV-2 | Command count coverage (18 skills) | AC-COV-2 | TC-COV-002 | Covered |

### 3.2 Interface Coverage (DM-#)

| ID | Element | TC-IDs | Status |
|----|---------|--------|--------|
| DM-1 | Agent frontmatter (`claude:` key addition) | TC-F1-001, TC-F1-002, TC-F8-001 | Covered |
| DM-2 | Command frontmatter (`claude:` key addition) | TC-F1-001, TC-F1-002, TC-F8-001 | Covered |
| DM-3 | Generated agent files (`.ados-claude/agents/*.md`) | TC-F3-001, TC-F3-002, TC-COV-001 | Covered |
| DM-4 | Generated skill files (`.ados-claude/skills/*/SKILL.md`) | TC-F4-001, TC-F4-002, TC-COV-002 | Covered |
| DM-5 | Plugin manifest (`.ados-claude/.claude-plugin/plugin.json`) | TC-F5-001, TC-F5-002 | Covered |

No API or event interfaces — this is a build-time transformation.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR-ID | Requirement | TC-IDs | Status |
|--------|-------------|--------|--------|
| NFR-1 | Build script execution time < 5 seconds | TC-NFR-001 | Covered |
| NFR-2 | Generated file count (19 + 18 + 1 = 38) | TC-COV-001, TC-COV-002 | Covered |
| NFR-3 | Idempotency (re-run produces identical output) | TC-NFR-002 | Covered |
| NFR-4 | CI overhead < 10 seconds | TC-F7-001 | Covered |
| NFR-5 | Source file minimal modification (frontmatter only) | TC-F8-001 | Covered |

## 4. Test Types and Layers

### 4.1 Unit Tests (Bash Testing Framework)

**Framework**: Embedded bash testing framework from `.ai/rules/bash.md`
**Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Pattern**: `test-*.sh` executable scripts with `run_test` helper functions

| Test Category | What it Tests | Test Count |
|---------------|---------------|------------|
| Agent frontmatter transformation | Parsing source frontmatter, generating Claude format | 4 |
| Command-to-skill conversion | Directory structure, frontmatter conversion | 3 |
| Plugin manifest generation | JSON structure, required fields | 2 |
| License header application | Presence and correctness of headers | 2 |
| Idempotency | Re-running produces identical output | 2 |
| Error handling | Missing files, invalid frontmatter | 3 |
| **Total unit tests** | | **16** |

### 4.2 Integration Tests

**Framework**: Bash integration tests
**Location**: `scripts/.tests/test-build-claude-plugin.sh` (integration section)
**Pattern**: End-to-end build execution with output verification

| Test Category | What it Tests | Test Count |
|---------------|---------------|------------|
| Full build execution | Complete build from scratch | 1 |
| DRY_RUN mode | No file changes when DRY_RUN=true | 1 |
| OpenCode compatibility | Existing `.opencode/` workflow unchanged | 1 |
| **Total integration tests** | | **3** |

### 4.3 CI Verification Tests

**Framework**: GitHub Actions workflow
**Location**: `.github/workflows/verify-claude-build.yml` (new)
**Pattern**: Run build script, check for git changes

| Test Category | What it Tests | Test Count |
|---------------|---------------|------------|
| Build freshness verification | CI fails if generated files stale | 1 |
| **Total CI tests** | | **1** |

### 4.4 Manual Verification

**Environment**: Local Claude Code installation
**Pattern**: End-to-end verification checklist

| Verification Category | What it Verifies | Item Count |
|-----------------------|------------------|------------|
| Plugin loading | Claude Code discovers and loads `.ados-claude/` | 1 |
| Agent availability | All 19 agents appear in Claude Code UI | 1 |
| Skill availability | All 18 skills appear in Claude Code skills list | 1 |
| Model assignment | `opus` agents use opus model, etc. | 1 |
| MCP tools | MCP tools work via `.opencode/opencode.jsonc` config | 1 |
| **Total manual verifications** | | **5** |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC-ID | Title | Type | Priority | AC Coverage |
|-------|-------|------|----------|-------------|
| TC-F1-001 | Agent with `claude.model: opus` generates correct model field | Happy Path | High | AC-F1-1 |
| TC-F1-002 | Agent without `claude:` key uses default model | Edge Case | High | AC-F1-2 |
| TC-F2-001 | Build script creates `.ados-claude/` directory structure | Happy Path | Critical | AC-F2-1, AC-COV-1, AC-COV-2 |
| TC-F2-002 | Build script runs successfully with all inputs present | Happy Path | Critical | AC-F2-1 |
| TC-F2-003 | Build script handles missing `.opencode/` directory | Negative | High | F-2 |
| TC-F3-001 | Agent frontmatter transformation preserves description | Happy Path | High | AC-F3-1 |
| TC-F3-002 | Agent frontmatter strips OpenCode-specific keys | Happy Path | High | AC-F3-1 |
| TC-F3-003 | Agent frontmatter generates `allowed-tools` array | Happy Path | High | AC-F3-1 |
| TC-F4-001 | Command converts to skill directory with `SKILL.md` | Happy Path | Critical | AC-F4-1, AC-COV-2 |
| TC-F4-002 | Skill frontmatter preserves command body content | Happy Path | High | AC-F4-1 |
| TC-F5-001 | Plugin manifest exists with required fields | Happy Path | Critical | AC-F5-1 |
| TC-F5-002 | Plugin manifest has correct name `ados` and version | Happy Path | High | AC-F5-1 |
| TC-F6-001 | Generated files have ADOS license headers | Happy Path | High | AC-F6-1 |
| TC-F7-001 | CI workflow runs build script | Happy Path | High | AC-F7-1 |
| TC-F7-002 | CI workflow fails on stale build | Negative | Critical | AC-F7-1 |
| TC-F8-001 | OpenCode ignores `claude:` key in frontmatter | Happy Path | High | AC-F8-1 |
| TC-COV-001 | Build generates exactly 19 agent files | Happy Path | Critical | AC-COV-1 |
| TC-COV-002 | Build generates exactly 18 skill directories | Happy Path | Critical | AC-COV-2 |
| TC-NFR-001 | Build script completes in < 5 seconds | Performance | High | NFR-1 |
| TC-NFR-002 | Re-running build produces identical output | Idempotency | High | NFR-3 |

### 5.2 Scenario Details

---

#### TC-F1-001 - Agent with `claude.model: opus` generates correct model field

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F1-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @frontmatter, @transformation

**Preconditions**:

- Build script `scripts/build-claude-plugin.sh` exists
- Source agent file `.opencode/agent/pm.md` has `claude.model: opus` in frontmatter

**Steps**:

1. Create test agent file with `claude.model: opus` in temporary directory
2. Run build script with test agent
3. Extract `model` field from generated agent frontmatter
4. Verify `model: opus` is present in generated file

**Expected Outcome**:

- Generated agent file contains `model: opus` (not default `sonnet`)

**Postconditions**:

- Test agent file cleaned up

---

#### TC-F1-002 - Agent without `claude:` key uses default model

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @frontmatter, @default

**Preconditions**:

- Build script `scripts/build-claude-plugin.sh` exists
- Source agent file has no `claude:` key in frontmatter

**Steps**:

1. Create test agent file without `claude:` key in temporary directory
2. Run build script with test agent
3. Extract `model` field from generated agent frontmatter
4. Verify default model (`sonnet`) is used

**Expected Outcome**:

- Generated agent file contains `model: sonnet`

---

#### TC-F2-001 - Build script creates `.ados-claude/` directory structure

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, AC-COV-1, AC-COV-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @integration, @directory-structure

**Preconditions**:

- Build script `scripts/build-claude-plugin.sh` exists
- `.opencode/agent/` contains 19 agent files
- `.opencode/command/` contains 18 command files
- `.ados-claude/` does not exist (clean state)

**Steps**:

1. Remove `.ados-claude/` directory if it exists
2. Run build script: `scripts/build-claude-plugin.sh`
3. Verify `.ados-claude/` directory is created
4. Verify `.ados-claude/agents/` directory exists
5. Verify `.ados-claude/skills/` directory exists
6. Verify `.ados-claude/.claude-plugin/` directory exists
7. Count files in `.ados-claude/agents/` (expect 19)
8. Count directories in `.ados-claude/skills/` (expect 18)

**Expected Outcome**:

- `.ados-claude/` directory structure is created
- `.ados-claude/agents/` contains exactly 19 `.md` files
- `.ados-claude/skills/` contains exactly 18 subdirectories

---

#### TC-F2-002 - Build script runs successfully with all inputs present

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @integration, @build-success

**Preconditions**:

- Build script `scripts/build-claude-plugin.sh` exists
- All source files present in `.opencode/`

**Steps**:

1. Run build script: `scripts/build-claude-plugin.sh`
2. Capture exit code
3. Verify exit code is 0

**Expected Outcome**:

- Build script exits with code 0 (success)

---

#### TC-F2-003 - Build script handles missing `.opencode/` directory

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @error-handling

**Preconditions**:

- Build script `scripts/build-claude-plugin.sh` exists
- `.opencode/` directory temporarily moved aside

**Steps**:

1. Move `.opencode/` to temporary location
2. Run build script
3. Capture exit code
4. Restore `.opencode/`

**Expected Outcome**:

- Build script exits with non-zero code
- Clear error message indicates missing source directory

---

#### TC-F3-001 - Agent frontmatter transformation preserves description

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @frontmatter, @transformation

**Preconditions**:

- Build script exists
- Test agent has description in frontmatter

**Steps**:

1. Create test agent with `description: "Test description"` in frontmatter
2. Run build script
3. Extract `description` from generated agent frontmatter
4. Verify description matches source

**Expected Outcome**:

- Generated agent frontmatter contains same description as source

---

#### TC-F3-002 - Agent frontmatter strips OpenCode-specific keys

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @frontmatter, @stripping

**Preconditions**:

- Build script exists
- Test agent has `mode:` and `tools:` keys in frontmatter

**Steps**:

1. Create test agent with `mode: all` and `tools: "*"` in frontmatter
2. Run build script
3. Generate agent frontmatter
4. Verify `mode:` key is absent
5. Verify old `tools:` format is absent (replaced by `allowed-tools:`)

**Expected Outcome**:

- Generated agent frontmatter does NOT contain `mode:`
- Generated agent frontmatter does NOT contain old `tools:` (OpenCode format)

---

#### TC-F3-003 - Agent frontmatter generates `allowed-tools` array

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @frontmatter, @tools

**Preconditions**:

- Build script exists
- Test agent file ready

**Steps**:

1. Run build script
2. Extract frontmatter from first generated agent file
3. Verify `allowed-tools:` key exists
4. Verify `allowed-tools` array contains at least `Read`, `Write`, `Grep`, `Bash`
5. Verify `allowed-tools` array contains `"mcp__*"`

**Expected Outcome**:

- Generated agent frontmatter has `allowed-tools:` array with required tools

---

#### TC-F4-001 - Command converts to skill directory with `SKILL.md`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, AC-COV-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @skill-conversion, @directory

**Preconditions**:

- Build script exists
- `.opencode/command/run-plan.md` exists

**Steps**:

1. Run build script
2. Check for directory `.ados-claude/skills/run-plan/`
3. Check for file `.ados-claude/skills/run-plan/SKILL.md`
4. Verify file is regular file (not symlink)

**Expected Outcome**:

- `.ados-claude/skills/run-plan/SKILL.md` exists as regular file

---

#### TC-F4-002 - Skill frontmatter preserves command body content

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @skill-conversion, @content

**Preconditions**:

- Build script exists
- Source command file has body content after frontmatter

**Steps**:

1. Extract body content from `.opencode/command/run-plan.md` (after frontmatter)
2. Run build script
3. Extract body content from `.ados-claude/skills/run-plan/SKILL.md` (after frontmatter)
4. Compare bodies for equality

**Expected Outcome**:

- Body content of skill file matches body content of command file exactly

---

#### TC-F5-001 - Plugin manifest exists with required fields

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @manifest, @json

**Preconditions**:

- Build script exists
- Build has been run

**Steps**:

1. Run build script
2. Check for file `.ados-claude/.claude-plugin/plugin.json`
3. Parse JSON
4. Verify `name` field exists
5. Verify `version` field exists
6. Verify `author` field exists

**Expected Outcome**:

- `plugin.json` exists and is valid JSON with all required fields

---

#### TC-F5-002 - Plugin manifest has correct name `ados` and version

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @manifest, @json

**Preconditions**:

- Build script exists
- Build has been run

**Steps**:

1. Run build script
2. Parse `.ados-claude/.claude-plugin/plugin.json`
3. Verify `name` equals `"ados"`
4. Verify `version` matches semantic version pattern (e.g., `1.0.0`)

**Expected Outcome**:

- `name` field is `"ados"`
- `version` field matches pattern `X.Y.Z`

---

#### TC-F6-001 - Generated files have ADOS license headers

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @license

**Preconditions**:

- Build script exists
- Build has been run

**Steps**:

1. Run build script
2. Extract first 5 lines from `.ados-claude/agents/pm.md`
3. Verify copyright header is present
4. Extract first 5 lines from `.ados-claude/skills/run-plan/SKILL.md`
5. Verify copyright header is present

**Expected Outcome**:

- All generated agent and skill files contain ADOS license header comment block

---

#### TC-F7-001 - CI workflow runs build script

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `.github/workflows/verify-claude-build.yml`
**Tags**: @ci, @workflow

**Preconditions**:

- CI workflow file exists
- Build script exists

**Steps**:

1. Review `.github/workflows/verify-claude-build.yml`
2. Verify workflow includes step to run `scripts/build-claude-plugin.sh`
3. Verify workflow runs on pull_request and push events

**Expected Outcome**:

- CI workflow includes build script execution step

---

#### TC-F7-002 - CI workflow fails on stale build

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `.github/workflows/verify-claude-build.yml`
**Tags**: @ci, @workflow, @stale-detection

**Preconditions**:

- CI workflow file exists
- Build script exists
- Git repository has uncommitted changes in `.ados-claude/`

**Steps**:

1. Run build script locally
2. Check for git changes: `git status --porcelain .ados-claude/`
3. Run CI workflow verification: `git diff --exit-code .ados-claude/`
4. Verify workflow would fail on changes

**Expected Outcome**:

- CI workflow fails if `git diff --exit-code .ados-claude/` returns non-zero

---

#### TC-F8-001 - OpenCode ignores `claude:` key in frontmatter

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @opencode, @compatibility

**Preconditions**:

- Build script exists
- Source agent files have `claude:` key added to frontmatter
- OpenCode installation unchanged

**Steps**:

1. Add `claude:\n  model: opus` to `.opencode/agent/pm.md` frontmatter
2. Verify frontmatter is valid YAML
3. Verify agent file still readable
4. Verify no OpenCode processing errors

**Expected Outcome**:

- Agent file with `claude:` key is valid and OpenCode-compatible
- OpenCode ignores the new key (YAML parser tolerance)

---

#### TC-COV-001 - Build generates exactly 19 agent files

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-COV-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @integration, @coverage

**Preconditions**:

- Build script exists
- 19 agent files in `.opencode/agent/`

**Steps**:

1. Count source agents: `ls -1 .opencode/agent/*.md | wc -l`
2. Run build script
3. Count generated agents: `ls -1 .ados-claude/agents/*.md | wc -l`
4. Verify counts match

**Expected Outcome**:

- Generated agent file count equals source agent file count (19)

---

#### TC-COV-002 - Build generates exactly 18 skill directories

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-COV-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @integration, @coverage

**Preconditions**:

- Build script exists
- 18 command files in `.opencode/command/`

**Steps**:

1. Count source commands: `ls -1 .opencode/command/*.md | wc -l`
2. Run build script
3. Count generated skills: `ls -d .ados-claude/skills/*/ | wc -l`
4. Verify counts match

**Expected Outcome**:

- Generated skill directory count equals source command file count (18)

---

#### TC-NFR-001 - Build script completes in < 5 seconds

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @unit, @performance

**Preconditions**:

- Build script exists
- All source files present

**Steps**:

1. Record start time
2. Run build script: `time scripts/build-claude-plugin.sh`
3. Record end time
4. Calculate duration
5. Assert duration < 5 seconds

**Expected Outcome**:

- Build script completes in under 5 seconds for full build

---

#### TC-NFR-002 - Re-running build produces identical output

**Scenario Type**: Idempotency
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @integration, @idempotency

**Preconditions**:

- Build script exists
- Build has been run once

**Steps**:

1. Run build script (first run)
2. Compute checksum of all generated files: `find .ados-claude -type f -exec md5sum {} \; | sort`
3. Run build script (second run)
4. Compute checksum of all generated files again
5. Compare checksums

**Expected Outcome**:

- Checksums are identical; no changes from re-running build

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Purpose | Setup |
|-------------|---------|-------|
| Local development | Unit and integration test execution | Bash, git, md5sum, standard Unix tools |
| CI (GitHub Actions) | Build freshness verification | Ubuntu runner, bash, git |
| Claude Code (optional) | Manual end-to-end verification | Claude Code CLI installation |

### 6.2 Test Data

| Data | Source | Purpose |
|------|--------|---------|
| Agent files (19) | `.opencode/agent/*.md` | Source agents for transformation |
| Command files (18) | `.opencode/command/*.md` | Source commands for skill conversion |
| License header template | Repository `LICENSE` file or hardcoded in script | Header application |

### 6.3 Test Isolation

- **Unit tests**: Each test runs in temporary directory (`mktemp -d`) with isolated state
- **Integration tests**: Clean `.ados-claude/` removal before each test
- **Idempotency tests**: Compare checksums between runs without file changes

## 7. Automation Plan and Implementation Mapping

### 7.1 Test File Location

| TC Category | File | Executor |
|-------------|------|----------|
| Unit tests | `scripts/.tests/test-build-claude-plugin.sh` | `bash scripts/.tests/test-build-claude-plugin.sh` |
| Integration tests | `scripts/.tests/test-build-claude-plugin.sh` | `bash scripts/.tests/test-build-claude-plugin.sh` |
| CI verification | `.github/workflows/verify-claude-build.yml` | GitHub Actions |

### 7.2 Test Framework

Following `.ai/rules/bash.md` embedded testing framework:

```bash
# scripts/.tests/test-build-claude-plugin.sh
readonly TEST_TAG="(test-build-claude-plugin)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

_test_setup() {
  _test_tmpdir="$(mktemp -d)"
  export TMPDIR="${_test_tmpdir}"
}

_test_teardown() {
  [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]] && rm -rf "${_test_tmpdir}"
}

run_test() { ... }
```

### 7.3 CI Workflow Structure

```yaml
# .github/workflows/verify-claude-build.yml
name: Verify Claude Plugin Build
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run build script
        run: scripts/build-claude-plugin.sh
      - name: Check for changes
        run: git diff --exit-code .ados-claude/
```

### 7.4 Implementation Mapping

| TC-ID | Implementation Status | Notes |
|-------|----------------------|-------|
| TC-F1-001 | To Implement | Unit test for model extraction |
| TC-F1-002 | To Implement | Unit test for default model |
| TC-F2-001 | To Implement | Integration test for directory structure |
| TC-F2-002 | To Implement | Integration test for build success |
| TC-F2-003 | To Implement | Unit test for error handling |
| TC-F3-001 | To Implement | Unit test for description preservation |
| TC-F3-002 | To Implement | Unit test for key stripping |
| TC-F3-003 | To Implement | Unit test for allowed-tools generation |
| TC-F4-001 | To Implement | Unit test for skill directory creation |
| TC-F4-002 | To Implement | Unit test for body content preservation |
| TC-F5-001 | To Implement | Unit test for manifest existence |
| TC-F5-002 | To Implement | Unit test for manifest fields |
| TC-F6-001 | To Implement | Unit test for license headers |
| TC-F7-001 | To Implement | CI workflow file creation |
| TC-F7-002 | To Implement | CI integration with git diff |
| TC-F8-001 | To Implement | Unit test for OpenCode compatibility |
| TC-COV-001 | To Implement | Integration test for agent count |
| TC-COV-002 | To Implement | Integration test for skill count |
| TC-NFR-001 | To Implement | Performance timing test |
| TC-NFR-002 | To Implement | Idempotency checksum test |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| TR-1 | Build script transformation logic may have edge cases | Comprehensive unit tests cover valid/invalid frontmatter, missing files, empty files |
| TR-2 | Claude Code plugin format may change | Document Claude Code plugin spec reference; add comment in build script pointing to spec location |
| TR-3 | Idempotency may fail due to timestamps or ordering | Test checksum comparison (not file timestamps); ensure deterministic output |
| TR-4 | CI verification may be slow on large repos | NFR-4 mandates <10s overhead; test with actual repo size |
| TR-5 | Manual verification in Claude Code depends on environment | Manual checklist clearly documents steps; automate what's feasible |

### 8.2 Assumptions

- `yq` or equivalent YAML parser is available for frontmatter extraction (or use pure bash sed/awk)
- `.ados-claude/` can be deleted and regenerated without data loss (it's derived from `.opencode/`)
- Claude Code plugin format matches current documentation (Anthropic maintains stability)
- OpenCode YAML parser ignores unknown keys (confirmed in spec: Section 14, Assumption OQ-24)
- Bash testing framework from `.ai/rules/bash.md` is sufficient for this testing scope

### 8.3 Open Questions

| ID | Question | Status |
|----|----------|--------|
| OQ-5 | Should build script validate `claude.model` values (`opus`, `sonnet`, `haiku`)? | OPEN — current spec allows any value; validation could add robustness |
| OQ-6 | Should CI workflow run build script before or after existing tests? | OPEN — recommend BEFORE to catch build staleness early |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-02 | test-plan-writer | Initial test plan — 20 test scenarios covering all 16 AC + 5 NFRs |

## 10. Test Execution Log

| Date | Executor | TC-IDs Executed | Result | Notes |
|------|----------|-----------------|--------|-------|
| — | — | — | — | No executions yet |

---

## 11. Manual Verification Checklist

### 11.1 Claude Code Plugin Loading

**Prerequisites**: Claude Code CLI installed, repository cloned, build script executed

**Steps**:

| Step | Verification | Status |
|------|--------------|--------|
| M1 | Claude Code discovers `.ados-claude/` as plugin directory | ☐ |
| M2 | Plugin loads without errors | ☐ |
| M3 | All 19 agents appear in Claude Code agent/skills UI | ☐ |
| M4 | All 18 skills appear in Claude Code skills list | ☐ |
| M5 | Agent with `claude.model: opus` runs with opus model | ☐ |
| M6 | Agent with no `claude:` key runs with sonnet model (default) | ☐ |
| M7 | MCP tools (via `.opencode/opencode.jsonc`) are accessible | ☐ |
| M8 | Agent and skill body content matches source `.opencode/` files | ☐ |

**Verification Command** (after Claude Code loads plugin):

```bash
# Verify agent count
ls -1 .ados-claude/agents/*.md | wc -l  # Expect: 19

# Verify skill count
ls -d .ados-claude/skills/*/ | wc -l    # Expect: 18

# Verify plugin manifest exists
cat .ados-claude/.claude-plugin/plugin.json
```

### 11.2 OpenCode Compatibility Verification

**Steps**:

| Step | Verification | Status |
|------|--------------|--------|
| O1 | OpenCode reads `.opencode/agent/*.md` with `claude:` key | ☐ |
| O2 | OpenCode reads `.opencode/command/*.md` with `claude:` key | ☐ |
| O3 | OpenCode ignores `claude:` keys (no errors) | ☐ |
| O4 | Existing OpenCode workflow unchanged | ☐ |

**Verification Command**:

```bash
# Verify agent files are valid YAML after adding claude: key
for f in .opencode/agent/*.md; do
  # Extract frontmatter and validate YAML structure
  sed -n '/^---$/,/^---$/p' "$f" | head -n -1 | tail -n +2 > /tmp/fm.yaml
  # If yq available: yq . /tmp/fm.yaml
  # Fallback: check that YAML is parseable
done
echo "Frontmatter validation complete"
```