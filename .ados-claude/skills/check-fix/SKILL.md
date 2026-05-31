---
# GENERATED FILE — DO NOT EDIT DIRECTLY.
# Source of truth: .opencode/command/check-fix.md
# Regenerate with: scripts/build-claude-plugin.sh
# If behavior must change, edit the source file above and rebuild.
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/check-fix.md
name: check-fix
description: Execute quality gates, fix any issues found, and create a single high-quality Conventional Commit summarizing all changes made.
model: sonnet
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebFetch
  - "mcp__*"
---

Run quality gates and make sure everything is fine.
If you find any issues then systematically fix them.
If project specifies fast quality gates check the first execute only those.
Once fast quality gates are passed then proceed to run the full quality gates and fix any issues found.
Finally, create a single high-quality Conventional Commit with a clear message summarizing all changes made to fix the
issues by delegating entirely to the @committer agent.
