---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/check.md
#
description: Run this repo's quality gates script and summarize results via the run-logs-runner.
agent: runner
model: github-copilot/gpt-4.1
#model: github-copilot/grok-code-fast-1
---

<purpose>
Run the repository's configured quality gates command and return a concise, high-signal summary with log pointers.

This command is intended for humans to invoke directly.
Agents should preferentially call `@runner` directly for execution/log-heavy tasks.
</purpose>

<command>
User invocation:
  /check [fast|slow|all|<gate>...] [--skip-autofix] [--dry-run]

Examples:
/check # default (usually all)
/check fast
/check slow
/check lint test
</command>

<resolution>
Determine which quality gates command to run:

1. Read `AGENTS.md` and look for an explicit quality gates runner instruction.
   - If `AGENTS.md` includes a command like `./scripts/quality-gates.sh` (preferred) or any referenced path/command for quality gates, use that.
   - If multiple are present, prefer the most explicit "Run all quality gates" instruction.

2. Default fallback if no instruction found:
   - `./scripts/quality-gates.sh`

3. Pass through user-provided arguments (fast/slow/all/<gate>...) as-is to the resolved command.

4. Always run from repository root.
   </resolution>

<behavior>
- Delegate actual execution to `@runner` (this command uses it as its agent).
- Ensure logs are saved under `tmp/run-logs-runner/<YYYY-MM-DD>/` and that output includes:
  - exact command
  - exit code
  - duration
  - log path(s)
  - top error snippets and tail excerpts
- If quality gates fail, prominently surface:
  - which gate(s) failed
  - pointers mentioned by `quality-gates.sh` (e.g., `tmp/playwright-report`, `tmp/playwright-report/ai-failures.jsonl`)
</behavior>

<notes>
- Do not attempt fixes; this command is run-only.
- For fixing failures, use `/check-fix` (@fixer) or invoke `@fixer` directly.
</notes>
