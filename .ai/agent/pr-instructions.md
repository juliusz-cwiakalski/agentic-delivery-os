---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.ai/agent/pr-instructions.md
---
# PR/MR Platform Instructions

Repository-level configuration for PR/MR platform access. Agents read this file to determine HOW to interact with the pull/merge request platform.

## Platform

- **Type**: GitHub
- **Access methods**: MCP (`github-mcp`) + CLI (`gh`)
- **Host**: `github.com`
- **Owner**: `juliusz-cwiakalski`
- **Repo**: `agentic-delivery-os`

## Access Method Preference

This repo has **both** GitHub MCP tools and `gh` CLI available.

**Prefer MCP** for: reading PR data, posting reviews, posting comments, creating/updating PRs — MCP tools are structured, type-safe, and don't require shell escaping.

**Use CLI (`gh`)** for: fetching full unified diffs (`gh pr diff`), operations not available via MCP (e.g., `gh api` for GraphQL queries), and when MCP tools are unavailable.

**Auth**:
- MCP: handled by the MCP server (configured in `.opencode/opencode.jsonc` with `GITHUB_PERSONAL_ACCESS_TOKEN`)
- CLI: `gh auth login` (pre-configured; verify via `gh auth status`)

## Operations Reference

### MCP Tools (preferred)

| Operation | MCP Tool | Parameters |
|-----------|----------|------------|
| **List open PRs for branch** | `mcp_github-mcp_list_pull_requests` | `owner`, `repo`, `head: "$BRANCH"`, `state: "open"` |
| **Fetch PR metadata** | `mcp_github-mcp_get_pull_request` | `owner`, `repo`, `pull_number` |
| **Fetch PR changed files** | `mcp_github-mcp_get_pull_request_files` | `owner`, `repo`, `pull_number` |
| **Fetch inline review comments** | `mcp_github-mcp_get_pull_request_comments` | `owner`, `repo`, `pull_number` |
| **Fetch reviews** | `mcp_github-mcp_get_pull_request_reviews` | `owner`, `repo`, `pull_number` |
| **Fetch PR status checks** | `mcp_github-mcp_get_pull_request_status` | `owner`, `repo`, `pull_number` |
| **Publish review with inline comments** | `mcp_github-mcp_create_pull_request_review` | `owner`, `repo`, `pull_number`, `body`, `event: "COMMENT"`, `comments: [{path, line, body}]` |
| **Publish summary comment** | `mcp_github-mcp_add_issue_comment` | `owner`, `repo`, `issue_number` (same as PR number), `body` |
| **Reply to review comment** | `mcp_github-mcp_create_pull_request_review` | Use `comments` array targeting same file/line, or use CLI fallback |
| **Create PR** | `mcp_github-mcp_create_pull_request` | `owner`, `repo`, `title`, `head`, `base`, `body` |
| **Merge PR** | `mcp_github-mcp_merge_pull_request` | `owner`, `repo`, `pull_number`, `merge_method` |
| **Update PR branch** | `mcp_github-mcp_update_pull_request_branch` | `owner`, `repo`, `pull_number` |
| **Get issue details** | `mcp_github-mcp_get_issue` | `owner`, `repo`, `issue_number` |
| **Create issue** | `mcp_github-mcp_create_issue` | `owner`, `repo`, `title`, `body`, `labels` |
| **Update issue** | `mcp_github-mcp_update_issue` | `owner`, `repo`, `issue_number`, `state`, `labels`, etc. |
| **Add issue comment** | `mcp_github-mcp_add_issue_comment` | `owner`, `repo`, `issue_number`, `body` |

### CLI Fallback (`gh`)

Use CLI when MCP tools don't cover the operation or when a unified diff is needed.

| Operation | Command | Notes |
|-----------|---------|-------|
| **Fetch PR diff** | `gh pr diff "$NUMBER"` | Full unified diff — MCP only returns per-file patches |
| **Check CLI auth** | `gh auth status` | Verify CLI is authenticated |
| **Detect platform** | `git remote get-url origin` | Parse for `github.com` host |

### PR Review Thread Management (GraphQL via `gh`)

GitHub has no REST API for thread resolution or thread replies. MCP tools also lack these capabilities. Use `gh api graphql` for:

- Fetching review threads (with resolution status)
- Replying to threads
- Resolving/unresolving threads

**Key GraphQL IDs:**
- `PullRequestReviewThread.id` — thread node ID (used for resolve/unresolve)
- `PullRequestReviewComment.id` — comment node ID (used for replies)

---

#### Fetch All Review Threads

```bash
gh api graphql -f query='
  query($owner:String!, $repo:String!, $number:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$number) {
        reviewThreads(first:100) {
          nodes {
            id
            isResolved
            path
            line
            comments(first:10) { nodes { id author { login } body } }
          }
        }
      }
    }
  }' -F owner="juliusz-cwiakalski" -F repo="agentic-delivery-os" -F number=$NUMBER
```

Returns thread node IDs (`id`) and resolution status (`isResolved`) for all threads.

---

#### Reply to a Thread (Preferred Method)

Use `addPullRequestReviewThreadReply` mutation with the thread node ID:

```bash
gh api graphql -f query='
  mutation($threadId:ID!, $body:String!) {
    addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId, body:$body}) {
      comment { id body author { login } }
    }
  }' -f threadId="$THREAD_NODE_ID" -f body="Your reply text here"
```

**Alternative (REST fallback):** If you have the REST comment ID (integer), use:
```bash
gh api "repos/{owner}/{repo}/pulls/$NUMBER/comments/$COMMENT_ID/replies" -X POST -f body="$BODY"
```

---

#### Resolve a Thread

```bash
gh api graphql -f query='
  mutation($threadId:ID!) {
    resolveReviewThread(input:{threadId:$threadId}) {
      thread { id isResolved resolvedBy { login } }
    }
  }' -f threadId="$THREAD_NODE_ID"
```

---

#### Unresolve a Thread

```bash
gh api graphql -f query='
  mutation($threadId:ID!) {
    unresolveReviewThread(input:{threadId:$threadId}) {
      thread { id isResolved }
    }
  }' -f threadId="$THREAD_NODE_ID"
```

---

#### Bulk Resolve Multiple Threads (Efficient)

Use GraphQL aliases to resolve multiple threads in a single request:

```bash
gh api graphql -f query='
  mutation {
    r1: resolveReviewThread(input:{threadId:"THREAD_ID_1"}) { thread { id isResolved } }
    r2: resolveReviewThread(input:{threadId:"THREAD_ID_2"}) { thread { id isResolved } }
    r3: resolveReviewThread(input:{threadId:"THREAD_ID_3"}) { thread { id isResolved } }
  }'
```

**Best practices:**
- Chunk requests to 20-50 threads per request to avoid payload limits
- Check `isResolved` in response to confirm success
- Implement exponential backoff for rate limiting
- Skip already-resolved threads (check before resolving)

---

#### Mapping REST Comment ID to GraphQL Thread

REST comment objects include `node_id` (GraphQL ID). To find the thread for a REST comment:

1. List REST comments: `GET /repos/{owner}/{repo}/pulls/{pull_number}/comments`
2. Find the comment's `node_id` field
3. Query GraphQL reviewThreads and match `comments.nodes[].id` to the REST `node_id`
4. The parent thread ID is the `PullRequestReviewThread.id`

---

### MCP Tool Gaps (Use GraphQL Fallback)

MCP tools currently lack:

| Capability | MCP Tool | Workaround |
|------------|----------|------------|
| Fetch review threads | Not available | Use `gh api graphql` with `reviewThreads` query |
| Reply to thread | Not available | Use `addPullRequestReviewThreadReply` mutation |
| Resolve thread | Not available | Use `resolveReviewThread` mutation |
| Unresolve thread | Not available | Use `unresolveReviewThread` mutation |

**Recommended MCP additions** (for future):
- `mcp_github-mcp_get_pull_request_review_threads(owner, repo, pull_number, first)`
- `mcp_github-mcp_add_pull_request_review_thread_reply(owner, repo, thread_id, body)`
- `mcp_github-mcp_resolve_review_thread(owner, repo, thread_id)`
- `mcp_github-mcp_unresolve_review_thread(owner, repo, thread_id)`

## Platform-Specific Notes

- `mcp_github-mcp_get_pull_request_files` returns per-file patches, not a unified diff. For full unified diffs, use `gh pr diff`.
- `mcp_github-mcp_create_pull_request_review` with `event: "COMMENT"` posts a review with inline comments without approving or requesting changes.
- `mcp_github-mcp_add_issue_comment` posts to the PR timeline (issue comments and PR comments share the same API on GitHub).
- MCP tools require `owner` and `repo` parameters — derive from `git remote get-url origin` or use the values documented above.
- Thread resolution requires GraphQL via `gh api graphql` — no REST endpoint or MCP tool available.
