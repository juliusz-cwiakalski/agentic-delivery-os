---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/pr.md
#
description: Create/update PR/MR title and description.
agent: pr-manager
subtask: true
#model: github-copilot/gpt-4.1
model: github-copilot/grok-code-fast-1
---

<purpose>Trigger the @pr-manager agent to create/update the PR/MR for the current branch (writes `tmp/pr/<branch>/description.md`).</purpose>

<inputs>
  <optional>
    <args>$ARGUMENTS</args>
  </optional>
</inputs>

<instructions>
  <rule>Invoke `@pr-manager` now with the provided args.</rule>
  <rule>Do not restate its workflow; do not add extra commentary.</rule>
  <rule>If blocked, surface the agent's message without alteration.</rule>
  <rule>If successful, return exactly the agent's output.</rule>
</instructions>

<user_input>$ARGUMENTS</user_input>
