---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/pr-platform-integration.md
ados_distribution: redistributable
id: GUIDE-PR-PLATFORM
status: Accepted
created: 2026-03-16
last_updated: 2026-03-16
owners: ["juliusz-cwiakalski"]
summary: "Guide for configuring PR/MR platform integration via .ai/agent/pr-instructions.md."
---

# PR/MR Platform Integration Guide

> **Audience:** Developers and AI agents working with ADOS in repositories that use pull requests or merge requests.
>
> **Goal:** Explain how to configure `.ai/agent/pr-instructions.md` so that ADOS agents (`@pr-manager`, `@reviewer`, `@review-feedback-applier`) can interact with your PR/MR platform.

---

## Overview

ADOS agents that interact with pull/merge requests read `.ai/agent/pr-instructions.md` for platform-specific configuration. This file is the single source of truth for **how** agents access the PR/MR platform — which CLI tool or MCP server to use, which commands to run, and how to authenticate.

The agent prompts define **what** operations to perform (list PRs, fetch diff, publish comment) and in **what order**. The `pr-instructions.md` file defines **how** to perform each operation.

### Agents that use `pr-instructions.md`

| Agent | Operations used |
|-------|-----------------|
| `@pr-manager` | List PRs, create PR, update PR, view PR, check auth |
| `@reviewer` (remote mode) | List PRs, fetch diff, fetch metadata, fetch comments, publish comment, publish inline review, check auth |
| `@review-feedback-applier` | List PRs, fetch comments, fetch reviews, check auth |

### Required configuration files

For full PR/MR platform integration, two files are involved:

1. **`.ai/agent/pr-instructions.md`** — HOW to access the platform (required). Defines platform type, access method, and the Operations Reference table that agents use for all platform commands.
2. **`.ai/agent/code-review-instructions.md`** — WHAT to focus on during review (recommended). Repository-specific review guidance that extends the reviewer agent's built-in heuristics.

If `.ai/agent/pr-instructions.md` does not exist, agents will STOP with an actionable error message directing the user to copy a blueprint from `doc/templates/blueprints/`.

---

## Supported Integration Types

### 1. GitHub CLI (`gh`)

**What it is:** The official GitHub CLI tool. Agents invoke `gh` commands to interact with GitHub pull requests.

**Prerequisites:**
- `gh` CLI installed ([cli.github.com](https://cli.github.com))
- Authenticated: `gh auth login`
- Repository hosted on GitHub (github.com or GitHub Enterprise)

**Configuration in `pr-instructions.md`:**

```markdown
## Platform

- **Type**: GitHub
- **Access method**: CLI (`gh`)
- **Host**: `github.com`
- **Auth**: `gh auth login` (pre-configured; agents verify via `gh auth status`)

## Operations Reference

| Operation | Command | Notes |
|-----------|---------|-------|
| **List open PRs for branch** | `gh pr list --head "$BRANCH" --state open --json number,baseRefName,url,title,body,headRefName,updatedAt --jq 'sort_by(.updatedAt) \| reverse \| .[0]'` | Most recently updated |
| **Fetch PR diff** | `gh pr diff "$NUMBER"` | Unified diff |
| **Fetch PR metadata** | `gh pr view "$NUMBER" --json number,baseRefName,headRefName,title,body,url,author,labels,reviewRequests,comments,reviews --jq '.'` | JSON |
| **Fetch inline review comments** | `gh api "repos/{owner}/{repo}/pulls/$NUMBER/comments" --paginate` | Diff-level |
| **Fetch issue comments** | `gh api "repos/{owner}/{repo}/issues/$NUMBER/comments" --paginate` | Top-level |
| **Fetch reviews** | `gh api "repos/{owner}/{repo}/pulls/$NUMBER/reviews" --paginate` | Review objects |
| **Publish summary comment** | `gh pr comment "$NUMBER" --body-file "$FILE"` | From file |
| **Publish inline review** | `gh api "repos/{owner}/{repo}/pulls/$NUMBER/reviews" -X POST --input "$PAYLOAD_FILE"` | With inline comments |
| **Create PR** | `gh pr create --base "$BASE" --title "$TITLE" --body-file "$BODY_FILE"` | New PR |
| **Update PR** | `gh pr edit "$NUMBER" --base "$BASE" --title "$TITLE" --body-file "$BODY_FILE"` | Existing PR |
| **View PR (confirm)** | `gh pr view "$NUMBER" --json number,baseRefName,url --jq '{number,baseRefName,url}'` | Confirm state |
| **Check auth** | `gh auth status` | Verify authenticated |
| **Detect platform** | `git remote get-url origin` | Parse for `github.com` |
```

**GitHub Enterprise:** Change the `Host` to your enterprise hostname. The `gh` CLI supports enterprise instances via `gh auth login --hostname your-github.example.com`.

### 2. GitLab CLI (`glab`)

**What it is:** The official GitLab CLI tool. Agents invoke `glab` commands to interact with GitLab merge requests.

**Prerequisites:**
- `glab` CLI installed ([gitlab.com/gitlab-org/cli](https://gitlab.com/gitlab-org/cli))
- Authenticated: `glab auth login`
- Repository hosted on GitLab (gitlab.com or self-hosted)

**Configuration in `pr-instructions.md`:**

```markdown
## Platform

- **Type**: GitLab
- **Access method**: CLI (`glab`)
- **Host**: `gitlab.com`
- **Auth**: `glab auth login` (pre-configured; agents verify via `glab auth status`)

## Operations Reference

| Operation | Command | Notes |
|-----------|---------|-------|
| **List open MRs for branch** | `glab mr list --source-branch "$BRANCH" --output json` | Filter with jq |
| **Fetch MR diff** | `glab mr diff "$IID"` | Unified diff |
| **Fetch MR metadata** | `glab mr view "$IID" --output json` | JSON |
| **Fetch MR discussions** | `glab api "projects/:id/merge_requests/$IID/discussions" --paginate` | Threaded |
| **Fetch MR notes** | `glab api "projects/:id/merge_requests/$IID/notes" --paginate` | All notes |
| **Publish summary note** | `glab mr note "$IID" --message "$(cat "$FILE")"` | From file |
| **Publish inline discussion** | `glab api "projects/:id/merge_requests/$IID/discussions" -X POST ...` | At diff position |
| **Create MR** | `glab mr create --source-branch "$BRANCH" --target-branch "$BASE" --title "$TITLE" --description "$(cat "$BODY_FILE")" --yes` | New MR |
| **Update MR** | `glab mr update "$IID" --target-branch "$BASE" --title "$TITLE" --description "$(cat "$BODY_FILE")" --yes` | Existing MR |
| **View MR (confirm)** | `glab mr view "$IID" --output json` | Confirm state |
| **Check auth** | `glab auth status` | Verify authenticated |
| **Detect platform** | `git remote get-url origin` | Parse for `gitlab.com` |
```

**Self-hosted GitLab:** Change the `Host` to your instance hostname. The `glab` CLI supports self-hosted instances via `glab auth login --hostname gitlab.your-company.com`.

### 3. GitHub MCP Tools

**What it is:** GitHub operations via MCP (Model Context Protocol) server tools. Agents call MCP tool functions instead of CLI commands.

**Prerequisites:**
- GitHub MCP server configured and running
- MCP server has access to the repository
- Agent runtime supports MCP tool calls

**Configuration in `pr-instructions.md`:**

```markdown
## Platform

- **Type**: GitHub
- **Access method**: MCP (GitHub tools)
- **Host**: `github.com`
- **Auth**: MCP server handles authentication

## Operations Reference

| Operation | Command | Notes |
|-----------|---------|-------|
| **List open PRs for branch** | `github_list_pull_requests` with `head: "$BRANCH"`, `state: "open"` | MCP tool |
| **Fetch PR diff** | `github_get_pull_request_diff` with `pull_number: $NUMBER` | MCP tool |
| **Fetch PR metadata** | `github_get_pull_request` with `pull_number: $NUMBER` | MCP tool |
| **Fetch review comments** | `github_list_pull_request_comments` with `pull_number: $NUMBER` | MCP tool |
| **Publish summary comment** | `github_create_issue_comment` with `issue_number: $NUMBER`, `body: "$CONTENT"` | MCP tool |
| **Publish inline review** | `github_create_pull_request_review` with `pull_number: $NUMBER`, `comments: [...]` | MCP tool |
| **Create PR** | `github_create_pull_request` with `base: "$BASE"`, `head: "$BRANCH"`, `title: "$TITLE"`, `body: "$BODY"` | MCP tool |
| **Update PR** | `github_update_pull_request` with `pull_number: $NUMBER`, `title: "$TITLE"`, `body: "$BODY"` | MCP tool |
| **Check auth** | MCP server availability check | MCP handles auth |
```

### 4. Azure DevOps MCP (Future)

**What it is:** Azure DevOps operations via MCP server tools. This integration type is planned but not yet implemented.

**Prerequisites:**
- Azure DevOps MCP server configured and running
- Agent runtime supports MCP tool calls

When available, configuration will follow the same pattern as GitHub MCP with Azure DevOps-specific MCP tool names.

---

## Which Integration to Use

```
Is your repo on GitHub?
├── Yes → Do you have `gh` CLI installed?
│   ├── Yes → Use "GitHub CLI" (recommended)
│   └── No → Do you have a GitHub MCP server?
│       ├── Yes → Use "GitHub MCP"
│       └── No → Install `gh` CLI, then use "GitHub CLI"
├── No → Is your repo on GitLab?
│   ├── Yes → Do you have `glab` CLI installed?
│   │   ├── Yes → Use "GitLab CLI" (recommended)
│   │   └── No → Install `glab` CLI, then use "GitLab CLI"
│   └── No → Is your repo on Azure DevOps?
│       ├── Yes → Use "Azure DevOps MCP" (when available)
│       └── No → Platform not yet supported
└── No → Skip `pr-instructions.md` (agents will auto-detect)
```

**Recommendation:** For most teams, the CLI integration (GitHub CLI or GitLab CLI) is the simplest and most reliable option. MCP integrations are useful when CLI tools are not available or when running in environments where MCP servers are already configured.

---

## Setup Instructions

1. Copy a blueprint matching your platform:
   - GitHub CLI: `cp doc/templates/blueprints/pr-instructions--github-cli.md .ai/agent/pr-instructions.md`
   - GitLab CLI: `cp doc/templates/blueprints/pr-instructions--gitlab-cli.md .ai/agent/pr-instructions.md`
   - GitHub MCP: `cp doc/templates/blueprints/pr-instructions--github-mcp.md .ai/agent/pr-instructions.md`
2. Update the `Host` field if using a self-hosted instance.
3. Verify the CLI is installed and authenticated.
4. (Recommended) Copy the code review blueprint: `cp doc/templates/blueprints/code-review-instructions--example.md .ai/agent/code-review-instructions.md` and customize for your repository.
5. Test by running `/review-remote --dry-run` or `/pr`.

Alternatively, run `/bootstrap` — the bootstrapper will ask about your Git platform and generate `pr-instructions.md` automatically.

---

## Relationship to Other Configuration Files

| File | Purpose | Pattern |
|------|---------|---------|
| `.ai/agent/pm-instructions.md` | Issue tracker access (Jira/GitHub Issues) | Same pattern — tells `@pm` HOW to access the tracker |
| `.ai/agent/pr-instructions.md` | PR/MR platform access (GitHub/GitLab) | This file — tells PR/MR agents HOW to access the platform |
| `.ai/agent/code-review-instructions.md` | Code review guidance (priorities, checklist, conventions) | Different — tells `@reviewer` WHAT to focus on and check during review. Copy blueprint from `doc/templates/blueprints/code-review-instructions--example.md` |
