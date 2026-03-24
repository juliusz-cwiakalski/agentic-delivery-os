# Change Specification: GH-44

## Problem

Two related issues:

1. **Anthropic OAuth ToS violation**: The `.opencode/opencode-anthropic.jsonc` configuration file encourages use of Anthropic models via OAuth authentication. However, Anthropic's Claude Code Terms of Service explicitly states that OAuth tokens from Claude Free/Pro/Max accounts are intended exclusively for Claude Code and Claude.ai. Using them in third-party tools like OpenCode is not permitted and constitutes a violation of the Consumer Terms of Service. This has been confirmed by community reports showing subscription keys being blocked (OpenCode issues #10937, #10956, #6930).

2. **Hardcoded models in agent definitions**: All 20 agent files in `.opencode/agent/*.md` contain hardcoded `model:` frontmatter lines (e.g., `model: anthropic/claude-opus-4-6`). This creates:
   - **Duplication**: Model assignments exist in both agent files AND `opencode*.jsonc` config files
   - **Portability issues**: Users switching providers must edit 20+ files
   - **Maintenance drift**: Model updates require changes in multiple places
   - **Architecture misalignment**: Agent definitions should describe behavior; model selection is deployment configuration

## Goals

1. Remove the ToS-violating Anthropic OAuth config file
2. Remove all hardcoded `model:` frontmatter lines from agent definitions
3. Establish single source of truth for model configuration (opencode*.jsonc files only)
4. Make agent definitions provider-agnostic and portable

## Non-Goals

- Adding new configuration files
- Changing model assignments in existing configuration files
- Modifying agent prompt content (only frontmatter changes)

## Scope

### Files to Delete

| File | Reason |
|------|--------|
| `.opencode/opencode-anthropic.jsonc` | ToS violation — encourages OAuth authentication that violates Anthropic's Terms |

### Files to Modify

All 20 agent files in `.opencode/agent/`:

| File | Current Model Line | Notes |
|------|---------------------|-------|
| `architect.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `bootstrapper.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `coder.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line + commented alternatives |
| `committer.md` | `model: anthropic/claude-sonnet-4-6` | Remove frontmatter line + commented alternatives |
| `designer.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `doc-syncer.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `editor.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line + commented alternatives |
| `external-researcher.md` | `model: github-copilot/gpt-5-mini` | Remove frontmatter line + commented alternatives |
| `fixer.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `image-generator.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `image-reviewer.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `plan-writer.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `pm.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `pr-manager.md` | `model: anthropic/claude-sonnet-4-6` | Remove frontmatter line |
| `review-feedback-applier.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `reviewer.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `runner.md` | `model: github-copilot/gpt-5-mini` | Remove frontmatter line + commented alternatives |
| `spec-writer.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `test-plan-writer.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line |
| `toolsmith.md` | `model: anthropic/claude-opus-4-6` | Remove frontmatter line + commented alternatives; **PRESERVE** model_profiles section (lines 586-669) |

**Important**: In `toolsmith.md`, the `model_profiles` section inside the prompt body (lines 586-669 and references in default_design_choices) is educational content about model capabilities and must remain intact. Only the frontmatter `model:` line is removed.

### Files to Verify

| File | What to Verify |
|------|----------------|
| `.opencode/opencode.jsonc` | Must have agent configurations for all agents |
| `.opencode/opencode-github-copilot.jsonc` | Must have agent configurations for all agents |

### Documentation to Update

| File | Change |
|------|--------|
| `AGENTS.md` | Add section explaining that model configuration is config-driven only |

## Acceptance Criteria

1. ✅ `.opencode/opencode-anthropic.jsonc` is deleted
2. ✅ All agent files (`.opencode/agent/*.md`) have no `model:` line in YAML frontmatter
3. ✅ No commented-out model lines remain in frontmatter (no `#model:` remnants)
4. ✅ `.opencode/opencode.jsonc` and `.opencode/opencode-github-copilot.jsonc` contain all agent model configurations
5. ✅ AGENTS.md updated to explain model configuration approach
6. ✅ `toolsmith.md` preserves its `model_profiles` documentation section

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Accidental removal of model_profiles in toolsmith.md | Low | Medium | Explicit verification in acceptance criteria |
| OpenCode tooling breaks after removal | Low | High | Config files already have all agents configured; fallback to default model |

## Dependencies

None — this is a standalone change with no dependencies on other changes.

## References

- [Anthropic Claude Code — Legal & Compliance](https://code.claude.com/docs/en/legal-and-compliance)
- [OpenCode Issue #10937](https://github.com/opencode-ai/opencode/issues/10937) — Subscription key issues
- [OpenCode Issue #10956](https://github.com/opencode-ai/opencode/issues/10956) — Recurring blocking
- [OpenCode Issue #6930](https://github.com/opencode-ai/opencode/issues/6930) — ToS violation discussion