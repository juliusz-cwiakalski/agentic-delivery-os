---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/commit.md
#
description: Delegate a single Conventional Commit.
agent: committer
subtask: true
#model: github-copilot/gpt-4.1
model: github-copilot/grok-code-fast-1
---

<purpose>Trigger the @committer agent to create exactly one Conventional Commit.</purpose>

<inputs>
  <optional>
    <intent>$ARGUMENTS</intent>
  </optional>
</inputs>

<instructions>
  <rule>Invoke `@committer` now.</rule>
  <rule>Do not restate its workflow; do not add extra commentary.</rule>
  <rule>If blocked, surface the agent's message without alteration.</rule>
  <rule>If successful, return exactly the agent's output.</rule>
</instructions>

<intent>
$ARGUMENTS
</intent>
