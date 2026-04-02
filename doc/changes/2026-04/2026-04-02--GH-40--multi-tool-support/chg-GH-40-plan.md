---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-04/2026-04-02--GH-40--multi-tool-support/chg-GH-40-plan.md
id: chg-GH-40-multi-tool-support
status: Proposed
created: 2026-04-02T07:00:00Z
last_updated: 2026-04-02T07:00:00Z
owners: ["@juliusz-cwiakalski"]
service: agentic-delivery-os
labels: [change, claude-code, multi-tool, planning]
links:
  change_spec: ./chg-GH-40-spec.md
summary: >
  Enable Claude Code as an ADOS installation target while maintaining `.opencode/` as the single source of truth.
  A build script transforms agent/command definitions to Claude Code plugin format at `.ados-claude/`.
  Generated plugin is committed to repo; CI verifies build freshness.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-40: Multi-tool support (Claude Code)

## Context and Goals

This plan delivers Claude Code support for ADOS through a build-time transformation pipeline. The `.opencode/` directory remains canonical; generated `.ados-claude/` is committed and verified by CI.

**Resolved decisions from spec DEC-1 through DEC-8:**
- Plugin location: `.ados-claude/`
- Plugin name: `ados`
- Source of truth: `.opencode/` (no duplication)
- Claude Code only in this ticket (future tickets for other tools)
- MCP tools stay in external config
- `claude.model` added to source frontmatter
- Build script generates and commits plugin
- License headers applied by build script

**Resolved questions from spec OQ-1 and OQ-2:**
- Model assignment: optional (default: `sonnet`)
- Missing `claude.model`: use default, do not fail

**No unresolved questions.**

## Scope

### In Scope

- **F-1**: Adding `claude:` key to agent/command YAML frontmatter (19 agents, 18 commands)
- **F-2**: Build script `scripts/build-claude-plugin.sh` generating plugin
- **F-3**: Agent frontmatter transformation (OpenCode → Claude Code format)
- **F-4**: Command-to-skill conversion (commands → skills)
- **F-5**: Plugin manifest generation (`.ados-claude/.claude-plugin/plugin.json`)
- **F-6**: License header application to generated files
- **F-7**: CI workflow to verify generated plugin is current
- **F-8**: OpenCode backward compatibility (existing workflow unchanged)
- **AC-F1-1 through AC-F8-1**: All acceptance criteria from spec
- Documentation: README.md, AGENTS.md, new guide for future tool support

### Out of Scope

- Support for other coding tools (Codex, Cursor, Windsurf) — future tickets
- Global Claude Code installation (outside repository)
- `--all` flag for multi-tool installation
- MCP server configuration in agent frontmatter
- Hot-reload or watch mode for regeneration
- OpenCode model assignment changes (stays in external config)

### Constraints

- **C-1**: Build script must complete in < 5 seconds (NFR-1)
- **C-2**: Script must be idempotent — running twice produces identical output (NFR-3)
- **C-3**: Source file changes limited to frontmatter only — no body modifications (NFR-5)
- **C-4**: CI verification must add < 10 seconds to pipeline (NFR-4)
- **C-5**: OpenCode must continue ignoring `claude:` key (backward compatibility)
- **C-6**: Generated files use ADOS license headers matching repository convention

### Risks

- **RSK-1** (from spec): Claude Code plugin format changes (Impact: High, Probability: Low)
  - Mitigated by: Using documented format; versioning manifest; monitoring Claude Code changelog
  - Residual: Medium
- **RSK-2**: Generated files become stale (Impact: Medium, Probability: Medium)
  - Mitigated by: CI verification fails on stale builds; documented contributor workflow
  - Residual: Low
- **RSK-3**: Model assignment drift between source and external config (Impact: Medium, Probability: Low)
  - Mitigated by: Documenting that `claude.model` is Claude-specific override; OpenCode uses external config
  - Residual: Low
- **RSK-4**: License header inconsistency (Impact: Low, Probability: Medium)
  - Mitigated by: Build script includes header generation; CI verifies
  - Residual: Low

### Success Metrics

| Metric | Target | Source |
|--------|--------|--------|
| Agent count in generated plugin | 19 agents (100% coverage) | AC-COV-1 |
| Command count converted to skills | 18 commands (100% coverage) | AC-COV-2 |
| Build script execution time | < 5 seconds | NFR-1 |
| CI verification overhead | < 10 seconds added | NFR-4 |
| OpenCode installation unchanged | Zero breaking changes | AC-F8-1 |

## Phases

### Phase 1: Add Claude Model Hints to Source Frontmatter

**Goal**: Add `claude.model` key to all 19 agent files and 18 command files in `.opencode/` directory, specifying appropriate model assignments based on complexity.

**Tasks**:

- [x] **1.1** Add `claude.model: opus` to Opus-assigned agents (15 agents: pm, architect, bootstrapper, coder, fixer, reviewer, toolsmith, plan-writer, spec-writer, test-plan-writer, image-generator, image-reviewer, designer, doc-syncer, editor)
- [x] **1.2** Add `claude.model: sonnet` to Sonnet-assigned agents (4 agents: committer, external-researcher, pr-manager, runner)
- [x] **1.3** Add `claude.model: sonnet` (default) to all 18 command files
- [x] **1.4** Verify OpenCode still parses all files correctly (ignores unknown `claude:` key)
- [x] **1.5** Run existing test suite to confirm no regression

**Acceptance Criteria**:

- Must: AC-F1-1 — Agent with `claude.model: opus` generates with `model: opus`
- Must: AC-F1-2 — Agent without `claude:` key uses default `model: sonnet`
- Must: AC-F8-1 — OpenCode ignores `claude:` key and continues working

**Files and modules**:

- `.opencode/agent/pm.md` (updated)
- `.opencode/agent/architect.md` (updated)
- `.opencode/agent/bootstrapper.md` (updated)
- `.opencode/agent/coder.md` (updated)
- `.opencode/agent/fixer.md` (updated)
- `.opencode/agent/reviewer.md` (updated)
- `.opencode/agent/toolsmith.md` (updated)
- `.opencode/agent/plan-writer.md` (updated)
- `.opencode/agent/spec-writer.md` (updated)
- `.opencode/agent/test-plan-writer.md` (updated)
- `.opencode/agent/image-generator.md` (updated)
- `.opencode/agent/image-reviewer.md` (updated)
- `.opencode/agent/designer.md` (updated)
- `.opencode/agent/doc-syncer.md` (updated)
- `.opencode/agent/editor.md` (updated)
- `.opencode/agent/committer.md` (updated)
- `.opencode/agent/external-researcher.md` (updated)
- `.opencode/agent/pr-manager.md` (updated)
- `.opencode/agent/runner.md` (updated)
- `.opencode/command/*.md` (18 files, all updated)

**Tests**:

- Manual: Open each modified file in text editor; verify `claude:` key present in YAML frontmatter
- Manual: Run OpenCode session; verify agents still load and function
- Manual: Check that unknown key does not cause parse errors

**Completion signal**: `feat(GH-40): add claude.model to agent/command frontmatter`

---

### Phase 2: Create Build Script

**Goal**: Implement `scripts/build-claude-plugin.sh` that transforms `.opencode/` definitions to Claude Code plugin format at `.ados-claude/`. Design for extensibility to support future tools.

**Tasks**:

- [x] **2.1** Create `scripts/build-claude-plugin.sh` with Bash scaffolding (shebang, error handling, usage)
- [x] **2.2** Design extensible architecture:
  - Parameterize tool name (`tool="claude"`)
  - Parameterize output directory pattern (`.ados-${tool}/`)
  - Create transformation functions with consistent interface:
    - `transform_agent_frontmatter <tool> <source_file> <output_file>`
    - `transform_command_to_skill <tool> <source_file> <output_dir>`
    - `generate_manifest <tool> <output_dir>`
  - Document extension points in script comments
- [x] **2.3** Implement agent frontmatter transformation:
  - Extract `name` from filename (basename without extension)
  - Extract `description` from source frontmatter
  - Extract `model` from `claude.model` (default: `sonnet`)
  - Strip OpenCode-specific fields (`mode`, `tools` with old format)
  - Generate `allowed-tools` array including `"mcp__*"` for MCP tool access
  - Preserve body content unchanged
- [x] **2.4** Implement command-to-skill conversion:
  - Create `skills/<name>/SKILL.md` directory structure
  - Extract `description` from source frontmatter
  - Extract `model` from `claude.model` (default: `sonnet`)
  - Set `allowed-tools` based on command purpose (inferred: Read, Grep, Bash for analysis commands; full tools for execution commands)
  - Preserve body content unchanged
- [x] **2.5** Implement plugin manifest generation:
  - Create `.ados-claude/.claude-plugin/plugin.json`
  - Set `name: "ados"`, `version: "1.0.0"`, `author: "Juliusz Ćwiąkalski"`
- [x] **2.6** Implement license header application:
  - Generate ADOS license header block (copyright, source URL)
  - Apply to all generated agent and skill files
- [x] **2.7** Ensure script idempotency:
  - Remove existing `.ados-claude/` before regeneration
  - Produce deterministic output (sorted, consistent formatting)
- [x] **2.8** Add error handling:
  - Validate input files exist
  - Fail fast on parse errors
  - Return non-zero exit code on failure
- [x] **2.9** Add extensibility documentation:
  - Comment at top explaining how to add new tools
  - Reference future ticket for Copilot CLI, Codex, etc.

**Acceptance Criteria**:

- Must: AC-F2-1 — Build creates `.ados-claude/` with correct structure
- Must: AC-F3-1 — Transformed agent has correct frontmatter keys (name, description, model, allowed-tools)
- Must: AC-F4-1 — Command converted to skill directory `skills/<name>/SKILL.md` with correct frontmatter
- Must: AC-F5-1 — Manifest exists with required fields
- Must: AC-F6-1 — All generated files have ADOS license headers
- Must: AC-F9-1 — Build script architecture supports adding future tools with minimal changes
- Must: NFR-3 — Running build twice produces identical output

**Files and modules**:

- `scripts/build-claude-plugin.sh` (new)
- `scripts/.tests/test-build-claude-plugin.sh` (new, optional)

**Tests**:

- Unit: Run build script; verify exit code 0
- Unit: Run build script twice; verify output is identical (diff returns empty)
- Unit: Check generated file count: `ls -1 .ados-claude/agents/ | wc -l` should return 19
- Unit: Check generated skill count: `ls -1d .ados-claude/skills/*/ | wc -l` should return 18
- Manual: Inspect generated agent file frontmatter
- Manual: Inspect generated skill file frontmatter

**Completion signal**: `feat(GH-40): create build script for Claude Code plugin generation`

---

### Phase 3: Run Build and Commit Generated Plugin

**Goal**: Execute build script to generate `.ados-claude/` directory and commit it to the repository.

**Tasks**:

- [x] **3.1** Run `scripts/build-claude-plugin.sh`
- [x] **3.2** Verify generated structure:
  - Check `.ados-claude/.claude-plugin/plugin.json` exists ✓
  - Check `.ados-claude/agents/` contains 20 files (plan noted 19, actual is 20 with review-feedback-applier)
  - Check `.ados-claude/skills/` contains 18 directories ✓
- [x] **3.3** Review generated files for correctness:
  - Verify frontmatter format ✓
  - Verify license headers ✓
  - Verify body content preserved ✓
- [x] **3.4** Add `.ados-claude/` to git tracking
- [x] **3.5** Commit generated plugin directory

**Acceptance Criteria**:

- Must: AC-COV-1 — 19 agent files exist in `.ados-claude/agents/`
- Must: AC-COV-2 — 18 skill directories exist in `.ados-claude/skills/`
- Must: AC-F6-1 — Each generated file has ADOS license header

**Files and modules**:

- `.ados-claude/.claude-plugin/plugin.json` (new, generated)
- `.ados-claude/agents/*.md` (19 new files, generated)
- `.ados-claude/skills/*/SKILL.md` (18 new files, generated)

**Tests**:

- Unit: `ls -1 .ados-claude/agents/ | wc -l` returns 19
- Unit: `ls -1d .ados-claude/skills/*/ | wc -l` returns 18
- Manual: Inspect randomly sampled generated files

**Completion signal**: `feat(GH-40): commit generated Claude Code plugin`

---

### Phase 4: Add CI Verification

**Goal**: Add GitHub Actions workflow to verify that generated `.ados-claude/` is current (prevents stale builds).

**Tasks**:

- [x] **4.1** Create `.github/workflows/` directory if missing
- [x] **4.2** Create or modify `.github/workflows/ci.yml`:
  - Add job: `verify-claude-build`
  - Step: Checkout repository
  - Step: Run `scripts/build-claude-plugin.sh`
  - Step: Check for git changes (`git diff --exit-code .ados-claude/`)
  - Fail workflow if changes detected (message: "Generated plugin is stale. Run build script and commit.")
- [x] **4.3** Ensure CI workflow uses correct shell and permissions
- [x] **4.4** Test CI workflow locally (act or manual verification)

**Acceptance Criteria**:

- Must: AC-F7-1 — CI fails with clear message when generated plugin differs from committed
- Must: NFR-4 — CI verification adds < 10 seconds to pipeline

**Files and modules**:

- `.github/workflows/ci.yml` (new or modified)

**Tests**:

- Integration: Push commit that modifies source frontmatter without regenerating; verify CI fails
- Integration: Run build and commit; verify CI passes

**Completion signal**: `feat(GH-40): add CI verification for stale generated plugin`

---

### Phase 5: Update Documentation

**Goal**: Update README.md and AGENTS.md to document Claude Code support and single-source architecture. Create guide for future tool support.

**Tasks**:

- [x] **5.1** Update `README.md`:
  - Add "Claude Code support" section
  - Document build script usage: `scripts/build-claude-plugin.sh`
  - Explain generated `.ados-claude/` directory
  - Note that generated plugin is committed to repo
- [x] **5.2** Update `AGENTS.md`:
  - Add note about multi-tool support in agent/command definitions
  - Document `claude:` frontmatter key purpose
  - Note that OpenCode ignores tool-specific keys
- [x] **5.3** Create `doc/guides/adding-tool-support.md`:
  - Document pattern: add tool-specific frontmatter key (e.g., `copilot:` for GitHub Copilot CLI)
  - Document pattern: build script transforms source to tool format
  - Document pattern: CI verifies generated output
  - Document build script extension points
  - Provide template for future tool support
  - Note: GitHub Copilot CLI research confirms feasibility (similar Markdown + YAML frontmatter format)
- [x] **5.4** Add extensibility notes to build script:
  - Top-of-file comment explaining tool parameterization
  - Reference to `doc/guides/adding-tool-support.md`
  - Example: `# To add a new tool: (1) define transformation functions, (2) add tool case to build_plugin(), (3) create output directory`

**Acceptance Criteria**:

- Must: README.md references Claude Code installation option
- Must: AGENTS.md notes single-source architecture and multi-tool support
- Must: New guide exists with clear instructions for future tool support

**Files and modules**:

- `README.md` (updated)
- `AGENTS.md` (updated)
- `doc/guides/adding-tool-support.md` (new)

**Tests**:

- Manual: Review README.md for clarity and accuracy
- Manual: Review AGENTS.md for consistency
- Manual: Review new guide for completeness

**Completion signal**: `docs(GH-40): document Claude Code support and multi-tool architecture`

---

### Phase 6: Testing and Validation

**Goal**: Validate end-to-end functionality: OpenCode unchanged, Claude Code can load plugin, build script works reproducibly.

**Tasks**:

- [x] **6.1** Run all existing repository tests
- [x] **6.2** Verify OpenCode installation:
  - Confirm agents still load
  - Confirm commands still work
  - Confirm `claude:` key ignored
- [x] **6.3** Manual verification: Claude Code plugin loading:
  - Verify `.ados-claude/.claude-plugin/plugin.json` valid JSON ✓
  - Verify generated agent frontmatter valid YAML ✓
  - Verify generated skill frontmatter valid YAML ✓
- [x] **6.4** Verify build script reproducibility:
  - Run build script twice
  - Compare outputs (should be identical) ✓
- [x] **6.5** Verify CI workflow:
  - Run CI locally or in test branch
  - Confirm stale build detection works
- [x] **6.6** Update plan file with completion status

**Acceptance Criteria**:

- Must: Existing test suite passes
- Must: OpenCode workflow unchanged (AC-F8-1)
- Must: Build script idempotent (NFR-3)
- Must: CI detects stale builds (AC-F7-1)

**Files and modules**:

- No file changes (validation phase)

**Tests**:

- Integration: Full end-to-end verification

**Completion signal**: `test(GH-40): validate multi-tool support implementation`

---

### Phase 7: Finalize and Release

**Goal**: Complete final review, synchronize spec, and merge.

**Tasks**:

- [ ] **7.1** Ensure all acceptance criteria from spec are met
- [ ] **7.2** Ensure all plan tasks are marked complete
- [ ] **7.3** Run `/sync-docs GH-40` to reconcile system spec
- [ ] **7.4** Update change spec status to "Implemented" (if applicable)
- [ ] **7.5** Create PR with summary linking to spec
- [ ] **7.6** Address review feedback if any
- [ ] **7.7** Merge to main branch

**Acceptance Criteria**:

- Must: All AC-F-* and AC-COV-* criteria met
- Must: All NFR-* thresholds achieved
- Must: Spec status updated
- Must: System spec reconciled (`doc/spec/**`)

**Files and modules**:

- `doc/changes/2026-04/2026-04-02--GH-40--multi-tool-support/chg-GH-40-spec.md` (status update)
- `doc/changes/2026-04/2026-04-02--GH-40--multi-tool-support/chg-GH-40-plan.md` (completion update)
- `doc/spec/**` (updated via sync-docs)

**Tests**:

- Manual: Final review against acceptance criteria

**Completion signal**: `feat(GH-40): finalize multi-tool support release`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|-----|
| TS-1 | Agent frontmatter transformation | 1, 2, 3 | AC-F1-1, AC-F3-1 |
| TS-2 | Default model assignment | 2, 3 | AC-F1-2 |
| TS-3 | Command-to-skill conversion | 2, 3 | AC-F4-1 |
| TS-4 | Plugin manifest generation | 2, 3 | AC-F5-1 |
| TS-5 | License header application | 2, 3 | AC-F6-1 |
| TS-6 | CI stale build detection | 4, 6 | AC-F7-1 |
| TS-7 | OpenCode backward compatibility | 1, 6 | AC-F8-1 |
| TS-8 | Coverage: 19 agents generated | 2, 3 | AC-COV-1 |
| TS-9 | Coverage: 18 skills generated | 2, 3 | AC-COV-2 |
| TS-10 | Build script idempotency | 2, 6 | NFR-3 |
| TS-11 | Build execution time | 2 | NFR-1 |
| TS-12 | CI overhead | 4 | NFR-4 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-40-spec.md | Spec |
| Implementation plan | ./chg-GH-40-plan.md | Plan |
| Build script | scripts/build-claude-plugin.sh | Script |
| Generated plugin | .ados-claude/ | Generated |
| CI workflow | .github/workflows/ci.yml | CI |
| Documentation | README.md, AGENTS.md | Docs |
| Tool support guide | doc/guides/adding-tool-support.md | Guide |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-02 | plan-writer | Initial plan |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Pending | — | — | — | — |
| 2 | Pending | — | — | — | — |
| 3 | Pending | — | — | — | — |
| 4 | Pending | — | — | — | — |
| 5 | Pending | — | — | — | — |
| 6 | Pending | — | — | — | — |
| 7 | Pending | — | — | — | — |