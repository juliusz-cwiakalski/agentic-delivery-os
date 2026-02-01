---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/write-plan.md
#
description: Generate or update implementation plan
agent: plan-writer
subtask: true
---

<purpose>
Produce (or update) a fully structured IMPLEMENTATION PLAN from the canonical CHANGE SPECIFICATION.

User invocation: `/write-plan <workItemRef>`

Writes (or updates): `chg-<workItemRef>-plan.md` in the same change folder as the spec.
</purpose>

<inputs>
<arguments>$ARGUMENTS</arguments>
<parsing>
- `workItemRef` = first token matching pattern `<PREFIX>-<number>` (e.g., `PDEV-123`, `GH-456`)
- If no valid `workItemRef` found, output NEEDS_INPUT:
  ```
  NEEDS_INPUT: workItemRef required
  Usage: /write-plan <workItemRef>
  Example: /write-plan PDEV-123
  ```
</parsing>
</inputs>

<discovery_rules>
Given `workItemRef`:

1. Search for folder: `doc/changes/**/*--<workItemRef>--*/`
2. Locate spec: `chg-<workItemRef>-spec.md`
3. If spec not found → FAIL

Files:

- Spec: `chg-<workItemRef>-spec.md`
- Plan: `chg-<workItemRef>-plan.md`
- Branch: `<change.type>/<workItemRef>/<slug>`
  </discovery_rules>

<process>
1. Parse `workItemRef` from $ARGUMENTS
2. Locate change folder and spec file per <discovery_rules>
3. Extract slug, type, owners, etc. from spec front matter
4. Checkout/create branch
5. Delegate to `@plan-writer` agent (it has full template and rules)
6. Report: path to created plan, next step: `/write-test-plan <workItemRef>` or `/run-plan <workItemRef>`
</process>

<output>
After successful execution:
- Created/updated file path
- Branch name
- Recommendation: "Run `/write-test-plan <workItemRef>` to generate the test plan, or `/run-plan <workItemRef>` to begin execution"
</output>

<constraints>
- Spec must exist; fail if not found
- Only the plan file may be written
- Derive all context from spec; do not invent
</constraints>
