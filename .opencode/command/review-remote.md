---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/review-remote.md
description: Review open PR/MR and publish findings.
agent: reviewer
---

<purpose>
Run the reviewer agent in remote mode on the current branch's open PR/MR.
Analyzes the diff against repository-local checklists, instructions, and built-in heuristics.
Generates a review draft locally; optionally publishes findings to the remote platform.
</purpose>

<command>
User invocation:
  /review-remote [options]
Examples:
  /review-remote
  /review-remote --publish
  /review-remote --pr 42
  /review-remote --gitlab --publish
  /review-remote --mr 15 --dry-run
  /review-remote --github --pr 100 --publish
</command>

<inputs>
  <arguments>$ARGUMENTS</arguments>
  <item>--github | --gitlab: Force platform detection. OPTIONAL.</item>
  <item>--pr <N> | --mr <N>: Explicit PR/MR number. OPTIONAL (auto-detected from branch).</item>
  <item>--publish: Publish findings to remote (default: dry-run). OPTIONAL.</item>
  <item>--dry-run: Explicit dry-run mode (this is also the default). OPTIONAL.</item>
</inputs>

<instructions>
  <step>Parse $ARGUMENTS and delegate to the `reviewer` agent (remote mode) with the parsed options.</step>
  <step>The agent handles all platform detection, pre-flight checks, review, and optional publishing.</step>
  <constraints>
    <rule>This command is a thin entry point — all logic lives in the `reviewer` agent.</rule>
    <rule>Non-interactive: do not depend on follow-up questions; use $ARGUMENTS, safe defaults, or NEEDS_INPUT.</rule>
    <rule>Idempotent: reruns are safe; deduplication prevents duplicate comments.</rule>
  </constraints>
</instructions>

<output_format>
<what_to_return>Review findings summary (count, severity breakdown), artifact paths under `tmp/code-review/<branchPath>/`, and next action suggestion.</what_to_return>
</output_format>

<user_input>$ARGUMENTS</user_input>
