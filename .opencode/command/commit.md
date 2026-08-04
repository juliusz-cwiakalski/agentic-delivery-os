---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/commit.md
#
description: Delegate a single Conventional Commit.
agent: committer
subtask: true
claude:
  model: sonnet
---

<purpose>Trigger the @committer agent to create exactly one Conventional Commit.</purpose>

<inputs>
  <arguments>$ARGUMENTS</arguments>
  <formats>
    <free_text>Any existing free-text intent remains valid.</free_text>
    <structured>Recognized labels are `workItemRef`, `outcome`, `why`, and `verification`. In `key=value; ...` form, each value must be single-line and cannot contain semicolons. Fields are optional and order-independent. Text after an unrecognized or malformed field remains intent.</structured>
  </formats>
</inputs>

<instructions>
  <rule>Pass all `$ARGUMENTS` to `@committer` without dropping free text or structured fields, then invoke it now.</rule>
  <rule>Do not restate its workflow; do not add extra commentary.</rule>
  <rule>If blocked, surface the agent's message without alteration.</rule>
  <rule>If successful, return exactly the agent's output.</rule>
</instructions>

<user_input><intent>$ARGUMENTS</intent></user_input>
