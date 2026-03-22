---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/blueprints/pr-instructions--github-cli.md
---
# PR/MR Platform Instructions

<!-- Copy this file to `.ai/agent/pr-instructions.md` in your project. -->
<!-- Blueprint: GitHub CLI (`gh`) -->
<!-- See doc/guides/pr-platform-integration.md for setup details. -->

## Platform

- **Type**: GitHub
- **Access method**: CLI (`gh`)
- **Host**: `github.com`  <!-- Change for GitHub Enterprise: `github.yourcompany.com` -->
- **Auth**: `gh auth login` (pre-configured; agents verify via `gh auth status`)

## Operations Reference

Agents reference this table for every PR/MR operation. Each row maps an abstract operation to the concrete CLI command.

| Operation | Command | Notes |
|-----------|---------|-------|
| **List open PRs for branch** | `gh pr list --head "$BRANCH" --state open --json number,baseRefName,url,title,body,headRefName,updatedAt --jq 'sort_by(.updatedAt) \| reverse \| .[0]'` | Returns most recently updated open PR |
| **Fetch PR diff** | `gh pr diff "$NUMBER"` | Full unified diff to stdout |
| **Fetch PR metadata** | `gh pr view "$NUMBER" --json number,baseRefName,headRefName,title,body,url,author,labels,reviewRequests,comments,reviews --jq '.'` | JSON metadata |
| **Fetch inline review comments** | `gh api "repos/{owner}/{repo}/pulls/$NUMBER/comments" --paginate` | Inline (diff-level) comments |
| **Fetch issue comments** | `gh api "repos/{owner}/{repo}/issues/$NUMBER/comments" --paginate` | Top-level PR comments |
| **Fetch reviews** | `gh api "repos/{owner}/{repo}/pulls/$NUMBER/reviews" --paginate` | Review objects (approved, changes requested, etc.) |
| **Publish summary comment** | `gh pr comment "$NUMBER" --body-file "$FILE"` | Post a top-level comment from file |
| **Publish inline review** | `gh api "repos/{owner}/{repo}/pulls/$NUMBER/reviews" -X POST --input "$PAYLOAD_FILE"` | Submit review with inline comments |
| **Publish MR note** | N/A (GitHub) | — |
| **Create PR** | `gh pr create --base "$BASE" --title "$TITLE" --body-file "$BODY_FILE"` | Creates new PR |
| **Update PR** | `gh pr edit "$NUMBER" --base "$BASE" --title "$TITLE" --body-file "$BODY_FILE"` | Updates existing PR |
| **View PR (confirm)** | `gh pr view "$NUMBER" --json number,baseRefName,url --jq '{number,baseRefName,url}'` | Confirm PR state after create/update |
| **Check auth** | `gh auth status` | Verify CLI is authenticated |
| **Detect platform** | `git remote get-url origin` | Parse for `github.com` host |
| **Reply to review comment** | `gh api "repos/{owner}/{repo}/pulls/$NUMBER/comments/$COMMENT_ID/replies" -X POST -f body="$BODY"` | Reply to an existing review comment thread |

## Resolve/Unresolve PR Review Threads (GraphQL via `gh`)

GitHub has no REST endpoint for resolving PR review threads. Use `gh api graphql`:

```bash
# Find thread node IDs for a PR
gh api graphql -f query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:200){nodes{id isResolved path line comments(first:5){nodes{id author{login} bodyText}}}}}}}' -F owner="OWNER" -F repo="REPO" -F number=PULL_NUMBER

# Resolve a thread
gh api graphql -f query='mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved resolvedBy{login}}}}' -f threadId="THREAD_NODE_ID"

# Unresolve a thread
gh api graphql -f query='mutation($threadId:ID!){unresolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}' -f threadId="THREAD_NODE_ID"
```

Match REST comment `node_id` to GraphQL `comments.nodes[].id` to find the owning thread.
