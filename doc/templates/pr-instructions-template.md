---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/pr-instructions-template.md
---
# PR/MR Platform Instructions — Template

This template has been replaced by standalone blueprints. Copy the one matching your platform to `.ai/agent/pr-instructions.md`:

| Platform | Blueprint |
|----------|-----------|
| GitHub (CLI `gh`) | `doc/templates/blueprints/pr-instructions--github-cli.md` |
| GitLab (CLI `glab`) | `doc/templates/blueprints/pr-instructions--gitlab-cli.md` |
| GitHub (MCP tools) | `doc/templates/blueprints/pr-instructions--github-mcp.md` |

For code review configuration, also copy:
| Purpose | Blueprint |
|---------|-----------|
| Repository-specific review rules | `doc/templates/blueprints/code-review-instructions--example.md` |

Copy to: `.ai/agent/code-review-instructions.md`

See `doc/guides/pr-platform-integration.md` for detailed setup instructions.
