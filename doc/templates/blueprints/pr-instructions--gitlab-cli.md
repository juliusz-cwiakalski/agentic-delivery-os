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
| **List open MRs for branch** | `glab mr list --source-branch "$BRANCH" --output json` | Filter result with `jq` for open + most recently updated |
| **Fetch MR diff** | `glab mr diff "$IID"` | Full unified diff to stdout |
| **Fetch MR metadata** | `glab mr view "$IID" --output json` | JSON metadata |
| **Fetch diff_refs** | `glab api "projects/:id/merge_requests/$IID" --jq '.diff_refs'` | Returns `{base_sha, start_sha, head_sha}` — required for inline discussions |
| **Fetch MR discussions** | `glab api "projects/:id/merge_requests/$IID/discussions" --paginate` | Threaded discussions (grouped) |
| **Fetch MR notes** | `glab api "projects/:id/merge_requests/$IID/notes?per_page=100"` | All notes/comments (paginate manually) |
| **Publish summary note** | `glab mr note "$IID" --message "$(cat "$FILE")"` | Top-level MR comment (not line-specific) |
| **Publish inline discussion** | See "Inline Discussion" section below | Line-specific diff comment — must use `glab api` with position payload |
| **Reply to discussion** | `glab api "projects/:id/merge_requests/$IID/discussions/$DISCUSSION_ID/notes" --method POST --raw-field "body=$BODY"` | Reply to existing thread |
| **Resolve discussion** | `glab api "projects/:id/merge_requests/$IID/discussions/$DISCUSSION_ID" --method PUT --raw-field "resolved=true"` | Mark thread as resolved |
| **Create MR** | `glab mr create --source-branch "$BRANCH" --target-branch "$BASE" --title "$TITLE" --description "$(cat "$BODY_FILE")" --yes` | Creates new MR |
| **Update MR** | `glab mr update "$IID" --target-branch "$BASE" --title "$TITLE" --description "$(cat "$BODY_FILE")" --yes` | Updates existing MR |
| **View MR (confirm)** | `glab mr view "$IID" --output json` | Confirm state after create/update |
| **Check auth** | `glab auth status` | Verify CLI is authenticated |
| **Detect platform** | `git remote get-url origin` | Parse for `gitlab.com` or self-hosted host |

## Inline Discussion (line-specific comments)

`glab mr note` only creates **general MR comments**, NOT line-specific discussions. For inline diff comments, use `glab api` with the Discussions API and a `position` payload.

**Step 1: Fetch diff_refs** (once per review session):
```bash
BASE_SHA=$(glab api "projects/:id/merge_requests/$IID" --jq '.diff_refs.base_sha')
START_SHA=$(glab api "projects/:id/merge_requests/$IID" --jq '.diff_refs.start_sha')
HEAD_SHA=$(glab api "projects/:id/merge_requests/$IID" --jq '.diff_refs.head_sha')
```

**Step 2: Create inline discussion** on an added/changed line:
```bash
glab api --method POST "projects/:id/merge_requests/$IID/discussions" \
  --raw-field "body=$BODY" \
  --raw-field "position[position_type]=text" \
  --raw-field "position[base_sha]=$BASE_SHA" \
  --raw-field "position[start_sha]=$START_SHA" \
  --raw-field "position[head_sha]=$HEAD_SHA" \
  --raw-field "position[old_path]=$FILE_PATH" \
  --raw-field "position[new_path]=$FILE_PATH" \
  --raw-field "position[new_line]=$LINE"
```

**Line placement rules:**
- Added/modified line (green in diff): use `position[new_line]` only
- Removed line (red in diff): use `position[old_line]` only
- Unchanged/context line: use both `position[old_line]` and `position[new_line]`
- Always send both `old_path` and `new_path` (same value unless file was renamed)

**Capture discussion ID** for later reply/resolve:
```bash
glab api --method POST "projects/:id/merge_requests/$IID/discussions" \
  --raw-field "body=$BODY" \
  --raw-field "position[position_type]=text" \
  --raw-field "position[base_sha]=$BASE_SHA" \
  --raw-field "position[start_sha]=$START_SHA" \
  --raw-field "position[head_sha]=$HEAD_SHA" \
  --raw-field "position[old_path]=$FILE_PATH" \
  --raw-field "position[new_path]=$FILE_PATH" \
  --raw-field "position[new_line]=$LINE" \
  --jq '{discussion_id: .id, note_id: .notes[0].id}'
```

**Fallback**: If the API returns 400 (position cannot be resolved — line no longer in diff), fall back to a general MR note referencing the file and line in the body text.

## Platform-Specific Notes

- `glab api` supports `:id` placeholder which auto-resolves to the current project ID from git context.
- `glab mr list` does NOT support `--state` flag in some versions — filter the JSON output with `jq` instead.
- For self-hosted GitLab: change Host above and ensure `glab config set host gitlab.yourcompany.com`.
- Pagination: `glab api --paginate` works for most endpoints. For notes, use `per_page=100&page=N` manually.
- Discussions created via the API are resolvable threads. Whether unresolved threads block merge depends on project settings.
