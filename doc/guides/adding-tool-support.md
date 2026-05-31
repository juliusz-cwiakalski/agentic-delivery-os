---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/adding-tool-support.md
---

# Adding Tool Support

This guide explains how to extend Agentic Delivery OS (ADOS) to support additional AI coding tools. The system uses a **single source of truth** architecture where `.opencode/` contains canonical definitions, and build scripts generate tool-specific formats.

## Current Architecture

### Single Source of Truth

All agent and command definitions live in `.opencode/`:

```
.opencode/
├── agent/           # Agent definitions (canonical)
│   ├── pm.md
│   ├── coder.md
│   └── ...
└── command/         # Command definitions (canonical)
    ├── run-plan.md
    ├── write-spec.md
    └── ...
```

### Generated Outputs

Build scripts transform `.opencode/` to tool-specific formats:

- **`.ados-claude/`** — Claude Code plugin (generated)

## Adding a New Tool

Follow these steps to add support for a new AI coding tool (e.g., GitHub Copilot CLI, Codex, Cursor, Windsurf).

### Step 1: Research Tool Format

Investigate the target tool's format:

1. **What format does it use?**
   - Markdown + YAML frontmatter?
   - JSON configuration?
   - Different directory structure?

2. **What fields are required?**
   - Agent: name, description, model, tools?
   - Command/Skill: name, description, prompt?

3. **How are model assignments handled?**
   - Inline in definition?
   - External config file?

4. **Where should files live?**
   - What directory name?
   - What file naming convention?

Example research findings for common tools:

| Tool | Format | Location | Model Assignment |
|------|--------|----------|------------------|
| Claude Code | Markdown + YAML | `.ados-claude/agents/`, `.ados-claude/skills/` | `model` in frontmatter |
| OpenCode | Markdown + YAML | `.opencode/agent/`, `.opencode/command/` | External config file |
| GitHub Copilot CLI | Markdown + YAML | `.copilot/` (TBD) | Inline or external |

### Step 2: Add Tool-Specific Frontmatter

Add a new frontmatter key for the tool in `.opencode/agent/*.md` and `.opencode/command/*.md`:

```yaml
---
description: <agent description>
mode: all                    # OpenCode-specific
claude:                      # Claude Code-specific
  model: opus
copilot:                     # NEW: Copilot CLI-specific
  model: gpt-4               # or appropriate model
---
```

**Guidelines:**

- Use the tool name as the key (e.g., `copilot:`, `codex:`, `cursor:`)
- Keep it minimal — only what the tool needs
- OpenCode ignores unknown keys, maintaining backward compatibility
- Document the new key in AGENTS.md

### Step 3: Create Build Script

Create `scripts/build-<tool>-plugin.sh` following this pattern:

```bash
#!/usr/bin/env bash
# ==============================================================================
# build-<tool>-plugin.sh - Generate <Tool> plugin from .opencode/ source
# ==============================================================================

set -euo pipefail

# Configuration
readonly TOOL="<tool>"           # e.g., "copilot"
readonly SOURCE_DIR="${REPO_ROOT}/.opencode"
readonly OUTPUT_DIR="${REPO_ROOT}/.ados-${TOOL}"

# ... (see scripts/build-claude-plugin.sh for full implementation)
```

**Key functions:**

1. **`transform_agent_frontmatter`** — Convert agent frontmatter from OpenCode to tool format
2. **`transform_command_to_skill`** — Convert commands to tool-specific skill format (if applicable)
3. **`generate_manifest`** — Create tool-specific manifest or config file
4. **`apply_license_headers`** — Add ADOS license headers with source reference

**Important:**

- Make script idempotent (running twice produces identical output)
- Clean output directory before generation
- Handle missing tool-specific frontmatter gracefully (use defaults)
- Add extensibility documentation in comments

### Step 4: Add CI Verification

Add a verification job to `.github/workflows/ci.yml`:

```yaml
jobs:
  verify-<tool>-build:
    name: Verify <Tool> plugin is current
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Build <Tool> plugin
        run: ./scripts/build-<tool>-plugin.sh

      - name: Check for changes
        run: |
          if git diff --exit-code .ados-<tool>/; then
            echo "✓ Generated plugin is current"
          else
            echo "::error::Generated plugin is stale. Run build script and commit."
            exit 1
          fi
```

### Step 5: Update Documentation

1. **README.md** — Add section for new tool support
2. **AGENTS.md** — Document new frontmatter key
3. **Create guide** — Add tool-specific usage notes if needed

### Step 6: Test Thoroughly

1. **Build script:**
   - Run twice and verify identical output (idempotency)
   - Verify all agents are generated
   - Verify all commands/skills are generated

2. **Tool compatibility:**
   - Test generated files with the target tool
   - Verify model assignments are correct
   - Verify body content is preserved

3. **CI verification:**
   - Push a commit that modifies source without regenerating
   - Verify CI fails with clear message
   - Regenerate and commit
   - Verify CI passes

## Transformation Patterns

### Agent Transformation

**Source (`.opencode/agent/pm.md`):**

```yaml
---
description: Orchestrate changes; manage tickets via MCP
mode: all
claude:
  model: opus
---
```

**Target (`.ados-<tool>/agents/pm.md`):**

```yaml
---
name: pm
description: Orchestrate changes; manage tickets via MCP
model: opus
allowed-tools:
  - Read
  - Write
  # ...
---
```

### Command-to-Skill Transformation

**Source (`.opencode/command/run-plan.md`):**

```yaml
---
description: Execute implementation plan phases
agent: coder
subtask: true
claude:
  model: sonnet
---
```

**Target (`.ados-<tool>/skills/run-plan/SKILL.md`):**

```yaml
---
name: run-plan
description: Execute implementation plan phases
model: sonnet
allowed-tools:
  - Read
  - Write
  # ...
---
```

## Best Practices

### Single Source of Truth

- **Never manually edit generated files** — they are overwritten by build script
- **Modify `.opencode/` files only** — changes propagate to all tools
- **Commit generated output** — keeps output in sync with source
- **Mark generated files clearly** — generated Markdown frontmatter must include `GENERATED FILE — DO NOT EDIT DIRECTLY`, source path, and regeneration command

### Extensibility

- **Parameterize tool name** — use `$TOOL` variable, not hardcoded paths
- **Consistent transformation interface** — all tools use similar functions
- **Document extension points** — add comments explaining how to add new tools

### Model Assignments

- **Per-tool model assignment** — each tool specifies its own model preferences
- **Fallback to defaults** — if tool-specific model is absent, use default
- **No build failures** — missing frontmatter should not break the build

### License Headers

- **Apply to all generated files** — maintain ADOS licensing
- **Include source reference** — point back to original `.opencode/` file
- **Include regeneration hint** — tell contributors and AI agents to edit `.opencode/` and run the generator
- **Format consistently** — match existing header style

## Troubleshooting

### Generated files differ from committed

**Problem:** CI fails with "Generated plugin is stale" error.

**Solution:**

1. Run the build script: `./scripts/build-<tool>-plugin.sh`
2. Commit the changes: `git add .ados-<tool>/ && git commit`

### Missing model assignment

**Problem:** Agent uses default model instead of intended model.

**Solution:**

Add tool-specific frontmatter to `.opencode/agent/<name>.md`:

```yaml
claude:
  model: opus
```

### Idempotency check fails

**Problem:** Running build twice produces different output.

**Solution:**

Check for:
- Non-deterministic ordering (use `sort` where needed)
- Timestamps or other dynamic values
- File system ordering issues

## Related Documentation

- [AGENTS.md](../../AGENTS.md) — Agent/command quick reference
- [scripts/build-claude-plugin.sh](../../scripts/build-claude-plugin.sh) — Reference implementation
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — CI verification example
