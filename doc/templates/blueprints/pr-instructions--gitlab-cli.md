---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/blueprints/pr-instructions--gitlab-cli.md
---
# PR/MR Platform Instructions

<!-- Copy this file to `.ai/agent/pr-instructions.md` in your project. -->
<!-- Blueprint: GitLab CLI (`glab`) -->
<!-- See doc/guides/pr-platform-integration.md for setup details. -->

## Platform

- **Type**: GitLab
- **Access method**: CLI (`glab`)
- **Host**: `gitlab.com`  <!-- Change for self-hosted GitLab: `gitlab.yourcompany.com` -->
- **Auth**: `glab auth login` (pre-configured; agents verify via `glab auth status`)

## Operations Reference

Agents reference this table for every PR/MR operation. Each row maps an abstract operation to the concrete CLI command.

| Operation | Command | Notes |
|-----------|---------|-------|
| **List open MRs for branch** | `glab mr list --source-branch "$BRANCH" --state opened --output json` | Filter with `jq` for most recently updated |
| **Fetch MR diff** | `glab mr diff "$IID"` | Full unified diff to stdout |
| **Fetch MR metadata** | `glab mr view "$IID" --output json` | JSON metadata including `diff_refs` |
| **Fetch MR discussions** | `glab api "projects/:id/merge_requests/$IID/discussions" --paginate` | Threaded discussions (grouped) |
| **Fetch MR notes** | `glab api "projects/:id/merge_requests/$IID/notes?per_page=100"` | All notes/comments (paginate manually) |
| **Publish summary note** | `glab mr note "$IID" --message "$(cat "$FILE")"` | Top-level MR comment |
| **Publish inline discussion** | `glab api "projects/:id/merge_requests/$IID/discussions" -X POST --raw-field "body=$BODY" --raw-field "position[position_type]=text" --raw-field "position[base_sha]=$BASE_SHA" --raw-field "position[head_sha]=$HEAD_SHA" --raw-field "position[start_sha]=$START_SHA" --raw-field "position[new_path]=$FILE" --raw-field "position[new_line]=$LINE"` | Inline diff comment; requires `diff_refs` from metadata |
| **Reply to discussion** | `glab api "projects/:id/merge_requests/$IID/discussions/$DISCUSSION_ID/notes" -X POST --raw-field "body=$BODY"` | Reply to existing thread |
| **Resolve discussion** | `glab api "projects/:id/merge_requests/$IID/discussions/$DISCUSSION_ID" -X PUT --field "resolved=true"` | Mark thread as resolved |
| **Create MR** | `glab mr create --source-branch "$BRANCH" --target-branch "$BASE" --title "$TITLE" --description "$(cat "$BODY_FILE")" --yes` | Creates new MR |
| **Update MR** | `glab mr update "$IID" --target-branch "$BASE" --title "$TITLE" --description "$(cat "$BODY_FILE")" --yes` | Updates existing MR |
| **View MR (confirm)** | `glab mr view "$IID" --output json` | Confirm state after create/update |
| **Check auth** | `glab auth status` | Verify CLI is authenticated |
| **Detect platform** | `git remote get-url origin` | Parse for `gitlab.com` or self-hosted host |

## Platform-Specific Notes

- `glab api` supports `:id` placeholder which auto-resolves to the current project ID from git context.
- For inline discussions, `diff_refs` (base_sha, head_sha, start_sha) must be fetched from MR metadata first.
- If inline positioning fails (line no longer in diff), the API returns 400 — fall back to a top-level note.
- For self-hosted GitLab: change Host above and ensure `glab config set host gitlab.yourcompany.com`.
- Pagination: `glab api --paginate` works for most endpoints. For notes, use `per_page=100&page=N` manually.
