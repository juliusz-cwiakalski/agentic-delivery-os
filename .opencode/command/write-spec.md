---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
#
# MIT License - see LICENSE file for full terms
description: Generate canonical change specification
agent: spec-writer
subtask: true
---

<purpose>
Generate a COMPLETE, implementation-agnostic CHANGE SPECIFICATION from planning session context.

User invocation: `/write-spec <workItemRef>`

Inputs other than `workItemRef` MUST be sourced from the active planning context; NOTHING may be invented.
Resulting spec becomes authoritative input for `/write-plan`.
</purpose>

<inputs>
<arguments>$ARGUMENTS</arguments>
<parsing>
- `workItemRef` = first token matching pattern `<PREFIX>-<number>` (e.g., `PDEV-123`, `GH-456`)
- If no valid `workItemRef` found, output NEEDS_INPUT:
  ```
  NEEDS_INPUT: workItemRef required
  Usage: /write-spec <workItemRef>
  Example: /write-spec PDEV-123
  ```
</parsing>
</inputs>

<discovery_rules>
Given `workItemRef`:

1. Search for existing folder: `doc/changes/**/*--<workItemRef>--*/`
2. If not found, create: `doc/changes/<YYYY-MM>/<YYYY-MM-DD>--<workItemRef>--<slug>/`

Files:

- Spec: `chg-<workItemRef>-spec.md`
- Branch: `<change.type>/<workItemRef>/<slug>`
  </discovery_rules>

<process>
1. Parse `workItemRef` from $ARGUMENTS
2. Gather planning-session context from conversation
3. Compute slug from title (lowercase kebab-case, ≤60 chars)
4. Locate or create change folder per <discovery_rules>
5. Determine `change.type` from context (feat/fix/refactor/etc.)
6. Checkout/create branch
7. Delegate to `@spec-writer` agent (it has the full template and rules)
8. Report: path to created spec, next step: `/write-plan <workItemRef>`
</process>

<output>
After successful execution:
- Created file path
- Branch name
- Recommendation: "Run `/write-plan <workItemRef>` to generate the implementation plan"
</output>

<constraints>
- No implementation details in the spec
- Only the spec file may be written
- Await human approval before `/write-plan`
</constraints>
