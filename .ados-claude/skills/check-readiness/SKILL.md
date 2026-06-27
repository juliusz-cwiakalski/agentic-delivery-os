---
# GENERATED FILE — DO NOT EDIT DIRECTLY.
# Source of truth: .opencode/command/check-readiness.md
# Regenerate with: scripts/build-claude-plugin.sh
# If behavior must change, edit the source file above and rebuild.
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/check-readiness.md
name: check-readiness
description: Run the Definition of Ready gate.
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

<purpose>
Run the Definition of Ready gate for change `<workItemRef>`: delegate to `@readiness-reviewer` to adversarially critique the spec + test-plan + plan against the source ticket before delivery.
</purpose>

<inputs>
  <item>workItemRef='$1' — Tracker reference (e.g., `PDEV-123`, `GH-456`). REQUIRED.</item>
  <item>All arguments are available as `$ARGUMENTS`.</item>
</inputs>

<command>
User invocation: `/check-readiness <workItemRef>`
</command>

<output>
Emits `READY` or `NOT_READY` plus per-facet findings. On `NOT_READY`, reopen the relevant artifact phase (`specification`, `test_planning`, or `delivery_planning`), never `delivery`.
</output>

<user_input>$ARGUMENTS</user_input>
