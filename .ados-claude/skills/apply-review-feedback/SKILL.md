---
# GENERATED FILE — DO NOT EDIT DIRECTLY.
# Source of truth: .opencode/command/apply-review-feedback.md
# Regenerate with: scripts/build-claude-plugin.sh
# If behavior must change, edit the source file above and rebuild.
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/apply-review-feedback.md
name: apply-review-feedback
description: Classify and apply accepted PR/MR review feedback.
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
Run the review-feedback-applier agent on the current branch's open PR/MR.
Fetches review comments, classifies feedback as accepted/rejected/ambiguous,
and applies accepted changes to local files. No auto-commit or auto-push.
</purpose>

<command>
User invocation:
  /apply-review-feedback [options]
Examples:
  /apply-review-feedback
  /apply-review-feedback --pr 42
  /apply-review-feedback --gitlab
  /apply-review-feedback --mr 15
  /apply-review-feedback --github --pr 100
</command>

<inputs>
  <arguments>$ARGUMENTS</arguments>
  <item>--github | --gitlab: Force platform detection. OPTIONAL.</item>
  <item>--pr <N> | --mr <N>: Explicit PR/MR number. OPTIONAL (auto-detected from branch).</item>
</inputs>

<instructions>
  <step>Parse $ARGUMENTS and delegate to the `review-feedback-applier` agent with the parsed options.</step>
  <step>The agent handles all platform detection, pre-flight checks, classification, and application.</step>
  <constraints>
    <rule>This command is a thin entry point — all logic lives in the `review-feedback-applier` agent.</rule>
    <rule>Non-interactive: do not depend on follow-up questions; use $ARGUMENTS, safe defaults, or NEEDS_INPUT.</rule>
    <rule>Idempotent: reruns are safe; already-applied changes are detected via code context comparison.</rule>
  </constraints>
</instructions>

<output_format>
<what_to_return>Classification summary (accepted/rejected/ambiguous counts), list of modified files, artifact paths under `tmp/review-feedback/<branchPath>/`, and reminder to review and commit manually.</what_to_return>
</output_format>

<user_input>$ARGUMENTS</user_input>
