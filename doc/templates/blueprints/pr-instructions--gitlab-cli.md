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

`glab mr note` only creates **general MR comments**, NOT line-specific discussions.
`glab api --raw-field "position[key]=value"` sends flat form fields — GitLab does NOT parse these as a nested `position` object, resulting in `DiscussionNote` (general) instead of `DiffNote` (inline).

**The reliable method is `curl` with a JSON body** containing a properly nested `position` object.

**Step 1: Get the GitLab API token and project ID** (once per session):
```bash
GITLAB_TOKEN=$(glab auth status -t 2>&1 | grep -oP '(Token|token):?\s*\K\S+' | head -1)
PROJECT_ID=$(glab api "projects/:id" | jq -r '.id')
GITLAB_HOST="https://gitlab.com"  <!-- Change for self-hosted -->
```
Note: `glab` typically uses OAuth2 tokens. Use `Authorization: Bearer` header (not `PRIVATE-TOKEN`) for OAuth tokens. If your token is a personal access token (PAT), use `PRIVATE-TOKEN` instead.

**Step 2: Fetch diff_refs** (once per review session):
```bash
DIFF_REFS=$(glab api "projects/:id/merge_requests/$IID" | jq '.diff_refs')
BASE_SHA=$(echo "$DIFF_REFS" | jq -r '.base_sha')
START_SHA=$(echo "$DIFF_REFS" | jq -r '.start_sha')
HEAD_SHA=$(echo "$DIFF_REFS" | jq -r '.head_sha')
```

**Step 3: Create inline discussion** on an added/changed line:
```bash
curl -s -X POST "$GITLAB_HOST/api/v4/projects/$PROJECT_ID/merge_requests/$IID/discussions" \
  -H "Authorization: Bearer $GITLAB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "'"$BODY"'",
    "position": {
      "position_type": "text",
      "base_sha": "'"$BASE_SHA"'",
      "start_sha": "'"$START_SHA"'",
      "head_sha": "'"$HEAD_SHA"'",
      "old_path": "'"$FILE_PATH"'",
      "new_path": "'"$FILE_PATH"'",
      "new_line": '$LINE'
    }
  }'
```

**Line placement rules:**
- Added/modified line (green in diff): include `"new_line"` only
- Removed line (red in diff): include `"old_line"` only
- Unchanged/context line: include both `"old_line"` and `"new_line"`
- Always send both `old_path` and `new_path` (same value unless file was renamed)

**Important**: The `body` field in the JSON must have special characters escaped (newlines as `\n`, double quotes as `\"`, backslashes as `\\`). When constructing the JSON payload programmatically, use `jq` to safely encode the body:
```bash
PAYLOAD=$(jq -n \
  --arg body "$BODY" \
  --arg base "$BASE_SHA" \
  --arg start "$START_SHA" \
  --arg head "$HEAD_SHA" \
  --arg old_path "$FILE_PATH" \
  --arg new_path "$FILE_PATH" \
  --argjson line "$LINE" \
  '{body: $body, position: {position_type: "text", base_sha: $base, start_sha: $start, head_sha: $head, old_path: $old_path, new_path: $new_path, new_line: $line}}')

curl -s -X POST "$GITLAB_HOST/api/v4/projects/$PROJECT_ID/merge_requests/$IID/discussions" \
  -H "Authorization: Bearer $GITLAB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

**Capture discussion ID** for later reply/resolve:
```bash
RESULT=$(curl -s -X POST ... -d "$PAYLOAD")
DISCUSSION_ID=$(echo "$RESULT" | jq -r '.id')
NOTE_ID=$(echo "$RESULT" | jq -r '.notes[0].id')
```

**Fallback**: If the API returns 400 (position cannot be resolved — line no longer in diff), fall back to a general MR note via `glab mr note "$IID" --message "..."`.

## Platform-Specific Notes

- `glab api` supports `:id` placeholder which auto-resolves to the current project ID from git context. For `curl`, resolve the numeric project ID first.
- `glab mr list` does NOT support `--state` flag in some versions — filter the JSON output with `jq` instead.
- `glab api --raw-field` does NOT create nested objects — use `curl` with JSON for inline discussions.
- For self-hosted GitLab: change `GITLAB_HOST` and ensure `glab config set host gitlab.yourcompany.com`.
- Pagination: `glab api --paginate` works for most endpoints. For notes, use `per_page=100&page=N` manually.
- Discussions created via the API are resolvable threads. Whether unresolved threads block merge depends on project settings.
