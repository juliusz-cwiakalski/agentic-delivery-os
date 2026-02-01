---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/check-fix.md
#
description: Execute quality gates, fix any issues found, and create a single high-quality Conventional Commit summarizing all changes made.
agent: fixer
subtask: true
model: deepseek/deepseek-reasoner
#model: github-copilot/gpt-4.1
#model: github-copilot/grok-code-fast-1
---

Run quality gates and make sure everything is fine.
If you find any issues then systematically fix them.
If project specifies fast quality gates check the first execute only those.
Once fast quality gates are passed then proceed to run the full quality gates and fix any issues found.
Finally, create a single high-quality Conventional Commit with a clear message summarizing all changes made to fix the
issues by delegating entirely to the @committer agent.
