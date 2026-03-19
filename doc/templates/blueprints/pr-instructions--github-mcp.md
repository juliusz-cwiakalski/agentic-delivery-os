---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/blueprints/pr-instructions--github-mcp.md
---
# PR/MR Platform Instructions

<!-- Copy this file to `.ai/agent/pr-instructions.md` in your project. -->
<!-- Blueprint: GitHub MCP Tools -->
<!-- See doc/guides/pr-platform-integration.md for setup details. -->

## Platform

- **Type**: GitHub
- **Access method**: MCP (GitHub tools)
- **Host**: `github.com`  <!-- Change for GitHub Enterprise: `github.yourcompany.com` -->
- **Auth**: MCP server handles authentication

## Operations Reference

Agents reference this table for every PR/MR operation. Each row maps an abstract operation to the concrete MCP tool call.

| Operation | Command | Notes |
|-----------|---------|-------|
| **List open PRs for branch** | MCP: `mcp_github-mcp_list_pull_requests` with `owner`, `repo`, `head: "$BRANCH"`, `state: "open"` | Returns PR list |
| **Fetch PR metadata** | MCP: `mcp_github-mcp_get_pull_request` with `owner`, `repo`, `pull_number` | Full PR details |
| **Fetch PR diff** | MCP: `mcp_github-mcp_get_pull_request_files` with `owner`, `repo`, `pull_number` | Changed files with patches |
| **Fetch review comments** | MCP: `mcp_github-mcp_get_pull_request_comments` with `owner`, `repo`, `pull_number` | Inline review comments |
| **Fetch reviews** | MCP: `mcp_github-mcp_get_pull_request_reviews` with `owner`, `repo`, `pull_number` | Review objects |
| **Publish review** | MCP: `mcp_github-mcp_create_pull_request_review` with `owner`, `repo`, `pull_number`, `body`, `event`, `comments` | Submit review with inline comments |
| **Publish summary comment** | MCP: `mcp_github-mcp_add_issue_comment` with `owner`, `repo`, `issue_number`, `body` | Top-level PR comment |
| **Create PR** | MCP: `mcp_github-mcp_create_pull_request` with `owner`, `repo`, `title`, `head`, `base`, `body` | Creates new PR |
| **Check auth** | MCP server availability — if MCP tools respond, auth is handled by the server | No explicit auth check needed |

## Platform-Specific Notes

- MCP tools handle authentication through the MCP server configuration. There is no separate `auth login` step — if the MCP tools respond successfully, auth is valid.
- The `owner` and `repo` parameters must be configured or derived from `git remote get-url origin`. Parse the remote URL to extract these values.
- `mcp_github-mcp_get_pull_request_files` returns changed files with per-file patches (not a single unified diff). The agent should work with per-file patches or reconstruct the full diff by concatenating patches.
- For updating an existing PR (title/body/base), use `mcp_github-mcp_update_pull_request` with `owner`, `repo`, `pull_number`, and the fields to update.
- MCP tool names may vary by server configuration. The names above follow the `mcp_<server>_<operation>` convention. Adjust if your MCP server uses different prefixes.
