## Summary

Enable Claude Code as an ADOS installation target while maintaining `.opencode/` as the single source of truth for all agent/command definitions. Build-time transformation generates the Claude Code plugin, with CI verification to prevent stale builds.

This change delivers single-source architecture, Claude Code plugin support, comprehensive tests, and extensible design for future tools (Copilot CLI, Codex, etc.).

## Scope

### Core (GH-40)
- Single-source architecture (`.opencode/` canonical)
- Build script generating `.ados-claude/` plugin
- CI verification for stale builds
- Marketplace support for Claude Code installation

### Expanded Scope (merged GH-51)
- Test suite for build script (12 test cases)
- Test suite for install script (47 test cases)
- Claude Code marketplace installation
- Updated documentation (README, AGENTS, onboarding guide)

## What Changed

### Files Modified/Created

| Category | Files | Change |
|----------|-------|--------|
| Agent frontmatter | `.opencode/agent/*.md` (20 files) | Added `claude.model` key |
| Command frontmatter | `.opencode/command/*.md` (18 files) | Added `claude.model` key |
| Build script | `scripts/build-claude-plugin.sh` | New - transforms OpenCode→Claude |
| Build tests | `scripts/.tests/test-build-claude-plugin.sh` | New - 12 test cases |
| Install tests | `scripts/.tests/test-install.sh` | Updated - 47 test cases |
| Generated plugin | `.ados-claude/**` | New - 20 agents, 18 skills |
| Marketplace | `.claude-plugin/marketplace.json` | New - Claude Code discovery |
| CI workflow | `.github/workflows/ci.yml` | New - verifies plugin freshness |
| Documentation | `README.md`, `AGENTS.md`, etc. | Updated - multi-tool support |

### Plugin Structure

```
.claude-plugin/
└── marketplace.json          # At repo root for Claude Code discovery

.ados-claude/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── agents/                  # 20 agents
│   ├── pm.md
│   ├── coder.md
│   └── ...
└── skills/                  # 18 skills
    ├── run-plan/SKILL.md
    ├── write-spec/SKILL.md
    └── ...
```

## Installation

### OpenCode Users (Primary)

```bash
# Global (all projects)
curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install.sh | bash -s -- --global

# Local (current project)
~/.ados/repo/scripts/install.sh --local
```

### Claude Code Users

**Recommended: Install from GitHub**

```bash
# Step 1: Add ADOS marketplace (one-time setup)
/plugin marketplace add juliusz-cwiakalski/agentic-delivery-os

# Step 2: Install ADOS plugin
/plugin install ados@ados
```

**For local development:**

```bash
claude --plugin-dir .ados-claude
```

## Tests

| Test Suite | Tests | Status |
|------------|-------|--------|
| `test-build-claude-plugin.sh` | 12/12 | ✅ PASS |
| `test-install.sh` | 47/47 | ✅ PASS |

**Test coverage:** Default model assignment, frontmatter transformation, skill wrapping, idempotency, license headers, CI verification

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Agent frontmatter has `claude.model` key | ✅ 20/20 agents |
| Command frontmatter has `claude.model` key | ✅ 18/18 commands |
| Build generates `.ados-claude/` structure | ✅ |
| Generated frontmatter correct | ✅ name, description, model, allowed-tools |
| CI verifies plugin freshness | ✅ |
| OpenCode backward compatible | ✅ ignores `claude:` key |
| Test suite for build script | ✅ 12 tests |
| Test suite for install script | ✅ 47 tests |
| Documentation updated | ✅ README, AGENTS, guides |
| Marketplace support | ✅ `marketplace.json` at repo root |

## Risk & Rollback

**Risk:** Low - Source definitions unchanged for OpenCode users.

**Rollback steps if needed:**
1. Remove `.ados-claude/` and `.claude-plugin/`
2. Remove `claude:` keys from `.opencode/**/*.md`
3. Remove `scripts/build-claude-plugin.sh` and test files
4. Remove `.github/workflows/ci.yml`

**Forward compatible:** Future tools can reuse this architecture.

Closes #40