---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/blueprints/pr-instructions--github-mcp.md
ados_distribution: redistributable
---
# PR/MR Platform Instructions

<!-- Copy this file to `.ai/agent/pr-instructions.md` in your project. -->
<!-- Blueprint: GitHub MCP Tools -->
<!-- See doc/guides/pr-platform-integration.md for setup details. -->
<!-- Requires: .opencode/opencode.jsonc with github-mcp server enabled for relevant agents -->

## Platform

- **Type**: GitHub
- **Access method**: MCP (GitHub tools)
- **Host**: `github.com`  <!-- Change for GitHub Enterprise: `github.yourcompany.com` -->
- **Owner**: `<your-org-or-user>`  <!-- Set to your GitHub username or org -->
- **Repo**: `<your-repo>`  <!-- Set to your repository name -->
- **Auth**: MCP server handles authentication (configured in `.opencode/opencode.jsonc`)

## Operations Reference

Agents reference this table for every PR/MR operation. Each row maps an abstract operation to the concrete MCP tool call.

### PR/MR Operations

| Operation | MCP Tool | Parameters | Notes |
|-----------|----------|------------|-------|
| **List open PRs for branch** | `mcp_github-mcp_list_pull_requests` | `owner`, `repo`, `head: "$BRANCH"`, `state: "open"` | Returns PR list |
| **Fetch PR metadata** | `mcp_github-mcp_get_pull_request` | `owner`, `repo`, `pull_number` | Full PR details including title, body, author, labels |
| **Fetch PR changed files** | `mcp_github-mcp_get_pull_request_files` | `owner`, `repo`, `pull_number` | Per-file patches (not unified diff) |
| **Fetch inline review comments** | `mcp_github-mcp_get_pull_request_comments` | `owner`, `repo`, `pull_number` | Diff-level review comments |
| **Fetch reviews** | `mcp_github-mcp_get_pull_request_reviews` | `owner`, `repo`, `pull_number` | Review objects (approved, changes requested, commented) |
| **Fetch PR status checks** | `mcp_github-mcp_get_pull_request_status` | `owner`, `repo`, `pull_number` | CI/CD status checks |
| **Publish review with inline comments** | `mcp_github-mcp_create_pull_request_review` | `owner`, `repo`, `pull_number`, `body`, `event: "COMMENT"`, `comments: [{path, line, body}]` | Submit review with positioned inline comments |
| **Publish summary comment** | `mcp_github-mcp_add_issue_comment` | `owner`, `repo`, `issue_number` (= PR number), `body` | Top-level PR comment |
| **Create PR** | `mcp_github-mcp_create_pull_request` | `owner`, `repo`, `title`, `head`, `base`, `body` | Creates new PR |
| **Merge PR** | `mcp_github-mcp_merge_pull_request` | `owner`, `repo`, `pull_number`, `merge_method` | Merge methods: `merge`, `squash`, `rebase` |
| **Update PR branch** | `mcp_github-mcp_update_pull_request_branch` | `owner`, `repo`, `pull_number` | Update with latest base branch changes |
| **Check auth** | MCP server availability | If MCP tools respond, auth is valid | No explicit auth check needed |

### Issue/Ticket Operations

| Operation | MCP Tool | Parameters | Notes |
|-----------|----------|------------|-------|
| **Get issue details** | `mcp_github-mcp_get_issue` | `owner`, `repo`, `issue_number` | Issue title, body, labels, state |
| **Create issue** | `mcp_github-mcp_create_issue` | `owner`, `repo`, `title`, `body`, `labels` | Returns issue number |
| **Update issue** | `mcp_github-mcp_update_issue` | `owner`, `repo`, `issue_number`, `state`, `labels`, etc. | Update state, labels, assignees |
| **Add issue comment** | `mcp_github-mcp_add_issue_comment` | `owner`, `repo`, `issue_number`, `body` | Works for both issues and PRs |
| **List issues** | `mcp_github-mcp_list_issues` | `owner`, `repo`, `state`, `labels` | Filter by state and labels |
| **Search issues** | `mcp_github-mcp_search_issues` | `q` (search query) | GitHub search syntax |

### Repository Operations

| Operation | MCP Tool | Parameters | Notes |
|-----------|----------|------------|-------|
| **Get file contents** | `mcp_github-mcp_get_file_contents` | `owner`, `repo`, `path`, `branch` | Read files from any branch |
| **Create/update file** | `mcp_github-mcp_create_or_update_file` | `owner`, `repo`, `path`, `content`, `message`, `branch`, `sha` | Single file commit |
| **Push multiple files** | `mcp_github-mcp_push_files` | `owner`, `repo`, `branch`, `files`, `message` | Multi-file commit |
| **Create branch** | `mcp_github-mcp_create_branch` | `owner`, `repo`, `branch`, `from_branch` | Branch from any ref |

## Prerequisites

The project must have an `.opencode/opencode.jsonc` with the GitHub MCP server configured:

```jsonc
{
  "mcp": {
    "github-mcp": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_API_TOKEN}"
      },
      "enabled": true
    }
  },
  "tools": { "github*": false },
  "agent": {
    "pm": { "tools": { "github*": true } },
    "pr-manager": { "tools": { "github*": true } },
    "reviewer": { "tools": { "github*": true } },
    "review-feedback-applier": { "tools": { "github*": true } }
  }
}
```

Set the `GITHUB_API_TOKEN` environment variable with a personal access token that has `repo`, `read:org`, and `user` permissions.

## Resolve/Unresolve PR Review Threads (GraphQL via `gh`)

No MCP tool or REST endpoint exists for resolving PR review threads. Use `gh api graphql`:

```bash
# Find thread node IDs for a PR
gh api graphql -f query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{id isResolved path line comments(first:5){nodes{id author{login} bodyText}}}}}}}' -F owner="OWNER" -F repo="REPO" -F number=PULL_NUMBER

# Resolve a thread
gh api graphql -f query='mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved resolvedBy{login}}}}' -f threadId="THREAD_NODE_ID"
```

Match REST comment `node_id` to GraphQL `comments.nodes[].id` to find the owning thread.

## Platform-Specific Notes

- MCP tools handle authentication through the MCP server configuration. If MCP tools respond successfully, auth is valid.
- `owner` and `repo` parameters must match your repository. Derive from `git remote get-url origin` or set explicitly above.
- `mcp_github-mcp_get_pull_request_files` returns per-file patches, not a unified diff. For full unified diffs, use `gh pr diff "$NUMBER"` (CLI fallback).
- `mcp_github-mcp_create_pull_request_review` with `event: "COMMENT"` posts inline comments without approving or requesting changes.
- `mcp_github-mcp_add_issue_comment` posts to the PR timeline (GitHub treats PR comments and issue comments identically).
- Thread resolution requires `gh api graphql` — no MCP tool or REST endpoint available.
- MCP tool names follow the `mcp_<server>_<operation>` convention. The `github-mcp` prefix matches the server name in `opencode.jsonc`.
