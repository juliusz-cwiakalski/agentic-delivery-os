---
# GENERATED FILE — DO NOT EDIT DIRECTLY.
# Source of truth: .opencode/command/bootstrap.md
# Regenerate with: scripts/build-claude-plugin.sh
# If behavior must change, edit the source file above and rebuild.
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/bootstrap.md
name: bootstrap
description: Run ADOS project inception
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
Entry point for ADOS project inception. Delegates to `@bootstrapper` for the multi-session 8-phase workflow.

User invocation:
  /bootstrap [<project-name>]

Examples:
  /bootstrap
    → Start or resume inception; determine project.flow in Phase 0.

  /bootstrap my-billing-service
    → Start or resume inception with "my-billing-service" as the project name hint.
</purpose>

<inputs>
- projectName='$1': string — OPTIONAL. Project name hint passed to `@bootstrapper`.
- allArguments='$ARGUMENTS': string — full argument string for additional context.
</inputs>

<process>
1. Pass project-name hint (if provided) to `@bootstrapper` agent.
2. `@bootstrapper` checks `doc/inception/inception-state.yaml`.
3. If valid state exists: resume from the last incomplete inception phase.
4. If no state exists: start Phase 0 and select `project.flow: new|legacy`.
5. Follow the 8-phase inception workflow with a human gate at every phase.
</process>

<notes>
- This command uses `subtask: false` because inception is multi-session and needs main conversation context.
- The `@bootstrapper` agent manages committed state at `doc/inception/inception-state.yaml`.
- For the manual inception path, see `doc/guides/project-inception.md`.
</notes>
