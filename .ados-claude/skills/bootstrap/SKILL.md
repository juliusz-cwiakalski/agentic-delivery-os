---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/bootstrap.md
name: bootstrap
description: Scaffold ADOS artifacts for an existing project
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
Entry point for the ADOS bootstrap workflow. Delegates to `@bootstrapper` agent for multi-session project onboarding.

User invocation:
  /bootstrap [<project-name>]

Examples:
  /bootstrap
    → Start or resume bootstrap workflow; auto-detect project name from repo.

  /bootstrap my-billing-service
    → Start or resume bootstrap with "my-billing-service" as the project name hint.
</purpose>

<inputs>
- projectName='$1': string — OPTIONAL. Project name hint passed to `@bootstrapper`.
- allArguments='$ARGUMENTS': string — full argument string for additional context.
</inputs>

<process>
1. Pass project-name hint (if provided) to `@bootstrapper` agent.
2. `@bootstrapper` checks for existing state at `.ai/local/bootstrapper-context.yaml`.
3. If state exists: resume from last phase.
4. If no state: start fresh with repo scan.
5. Follow the multi-session workflow: scan → assess → interview → draft → review → write.
</process>

<notes>
- This command uses `subtask: false` because the bootstrap workflow is multi-session and needs the main conversation context.
- The `@bootstrapper` agent manages its own persistent state across sessions.
- For the manual (non-automated) adoption path, see `doc/guides/onboarding-existing-project.md`.
</notes>
