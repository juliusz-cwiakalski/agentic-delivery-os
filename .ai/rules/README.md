---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.ai/rules/README.md
---

# AI Rules

## Purpose

`.ai/rules/` contains coding rules that AI agents load before working on specific tasks. Each rule file defines standards, conventions, and guardrails for a particular technology or domain within this project.

## File format

- Use **`.md`** extension (standard Markdown) — not `.mdc` or other variants.
- One rule file per topic.

## Naming convention

- Files use **kebab-case**: `<topic>.md`
- Examples: `bash.md`, `testing-strategy.md`, `typescript.md`

## Rule index

Agents (especially `@plan-writer` and `@coder`) should consult this index to determine which rule files to load for a given task.

| Task/Context | Rule File | Description |
|---|---|---|
| Bash scripting | `bash.md` | Bash coding standards, safety rules, testing framework |
| Installer scripts | `installer.md` | Cross-platform installer UX, PATH handling, dependency installation rules |
| Testing strategy | `testing-strategy.md` | Test types, coverage requirements, framework conventions |

## How agents use rules

1. Before starting implementation, check this index for rule files relevant to the task.
2. Load and parse each applicable rule file.
3. Follow the standards defined in the rule file throughout the task.
4. If a referenced rule file does not exist, note the gap and proceed with reasonable defaults.
