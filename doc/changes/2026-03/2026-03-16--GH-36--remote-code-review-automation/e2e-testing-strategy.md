# E2E Testing Strategy — Code Review (GH-36)

## Overview

E2E tests validate the **code-reviewer** and **review-feedback-applier** agents against real PRs/MRs on three platforms:
1. **GitLab CLI** (`glab` + `curl` for inline discussions)
2. **GitHub CLI** (`gh`)
3. **GitHub MCP** (`mcp_github-mcp_*` tools)

Each test uses a separate clone with a **verbatim copy of the corresponding blueprint** as `pr-instructions.md`.

---

## Test Environments

### GitLab CLI

- **Target repo**: `gitlab.com/cwiakalski/flagshipx/flagshipx`
- **Local clone**: `tmp/code-review-e2e-test/flagshipx/`
- **Blueprint**: `doc/templates/blueprints/pr-instructions--gitlab-cli.md`
- **Review-bait file**: `src/lib/utils-review-test.ts` (TypeScript with hardcoded secret, SQL injection, off-by-one, any types, etc.)

### GitHub CLI

- **Target repo**: `github.com/juliusz-cwiakalski/example-bug-quarkus-aws-lambda-gateway-v2-multiple-cookies-broken`
- **Local clone**: `tmp/code-review-e2e-test/gh-cli-test/quarkus-bug/`
- **Blueprint**: `doc/templates/blueprints/pr-instructions--github-cli.md`
- **Review-bait file**: `src/main/java/com/cwiakalski/example/bug/ReviewTestService.java` (Java with hardcoded DB password, AWS key, SQL injection, off-by-one, resource leak)

### GitHub MCP

- **Target repo**: Same as GitHub CLI
- **Local clone**: `tmp/code-review-e2e-test/gh-mcp-test/quarkus-bug/`
- **Blueprint**: `doc/templates/blueprints/pr-instructions--github-mcp.md`
- **Review-bait file**: Same Java file
- **Extra config**: `.opencode/opencode.jsonc` with `github-mcp` MCP server and `"code-reviewer": { "tools": { "github*": true } }`

---

## Setup Steps (per platform)

1. Clone the target repo into the platform-specific test directory
2. Copy the corresponding blueprint **verbatim** to `.ai/agent/pr-instructions.md`
3. Create `.ai/agent/code-review-instructions.md` with repo-specific review rules
4. (MCP only) Create `.opencode/opencode.jsonc` enabling `github-mcp` for `code-reviewer`
5. Create a review-bait source file with intentional issues
6. Create a branch, commit, push, create PR/MR
7. Install ADOS globally: `./scripts/install.sh --global --branch <branch>`

## Key Principle

**The pr-instructions.md in each test repo must be a verbatim copy of the blueprint** — no manual modifications. This ensures the blueprint is tested exactly as a real user would use it.

---

## Verification Checklist

- [ ] Inline comments are positioned on correct diff lines
- [ ] Inline comments are true review comments (DiffNote on GitLab, pull request review comments on GitHub)
- [ ] Severity emoji prefixes are present (🔴 🟠 🟡 ⚪)
- [ ] Summary comment is high-level only (no individual finding list)
- [ ] Summary comment has ADOS footer link
- [ ] All intentional issues in the review-bait file are detected
- [ ] Deduplication works (existing comments are not double-reported)
- [ ] No source files in the working tree are modified
- [ ] All artifacts are under `tmp/code-review/<branchPath>/`

---

## Test Results

### GitLab CLI (`glab` + `curl`)

| MR | Branch | What was tested | Result |
|----|--------|-----------------|--------|
| !21 | `test/ados-code-review-setup` | Initial setup — basic review | PASS (findings correct, but comments not inline — used glab mr note) |
| !22 | `test/ados-code-review-e2e-v2` | Corrected pr-instructions with glab api | PASS (DiffNote inline comments via curl, summary too verbose) |
| !23 | `test/ados-code-review-e2e-v3` | Improved summary format | FAIL (glab api --raw-field created DiscussionNote, not DiffNote) |
| !24 | `test/ados-code-review-e2e-v4` | curl-based inline + improved summary + emoji | PASS (DiffNote confirmed, summary high-level, emoji present) |

### GitHub CLI (`gh`)

| PR | Branch | What was tested | Result |
|----|--------|-----------------|--------|
| #1 | `test/ados-code-review-gh-cli` | Full review with gh CLI + publish | PASS — 16 inline comments on correct lines via `gh api .../reviews -X POST --input`, 2 reviews (overview + summary with 9 findings: 6C/2M/1m), all pointing at ReviewTestService.java |

### GitHub MCP (`mcp_github-mcp_*`)

| PR | Branch | What was tested | Result |
|----|--------|-----------------|--------|
| #2 | `test/ados-code-review-gh-mcp` | Full review with MCP tools + publish | PASS — 12 findings total (5C/4M/1m), 8 deduplicated against existing Copilot comments, 4 new published inline via `mcp_github-mcp_create_pull_request_review`, summary via `mcp_github-mcp_add_issue_comment` with ADOS footer |

---

## Review Feedback Applier Test Results

Each test uses the review comments already posted by the code-reviewer (automated) plus 4 human feedback comments added manually with specific classification signals: 1 explicit `AI-APPLY`, 1 implicit accept ("good catch, will fix"), 1 ambiguous ("interesting, I'll think about it"), 1 rejected ("no, this is intentional").

### Verification Checklist (feedback-applier)

- [ ] `AI-APPLY` marker detected → explicit-accept → change applied
- [ ] Implicit acceptance pattern detected → implicit-accept → change applied with reasoning
- [ ] Ambiguous feedback → skipped, listed in `skipped-items.md`
- [ ] Rejected feedback → not applied, listed in `skipped-items.md`
- [ ] Classification report generated with reasoning for each classification
- [ ] Applied changes are correct (match the reviewer's suggestion)
- [ ] No auto-commit or auto-push — changes local only
- [ ] All artifacts under `tmp/review-feedback/<branchPath>/`

### GitLab CLI — Feedback Applier

| MR | What was tested | Result |
|----|-----------------|--------|
| !24 | Classify + apply feedback on 4 human comments | PASS — 2 applied (1 explicit AI-APPLY on line 3: API key → env var, 1 implicit "will fix" on line 19: SQL injection → parameterized query), 1 ambiguous skipped (line 12: "will think about"), 1 rejected (line 24: "intentional"). All artifacts generated. |

### GitHub CLI — Feedback Applier

| PR | What was tested | Result |
|----|-----------------|--------|
| #1 | Classify + apply feedback on 4 human comments | PASS — 2 applied (1 explicit AI-APPLY on line 9: password → `System.getenv()`, 1 implicit "will fix" on line 13: SQL injection → PreparedStatement with try-with-resources), 1 ambiguous skipped (line 19: "I'll think about"), 1 rejected (line 28: "intentional"). |

### GitHub MCP — Feedback Applier

| PR | What was tested | Result |
|----|-----------------|--------|
| #2 | Classify + apply feedback on 4 human comments | PASS — 2 applied (1 explicit AI-APPLY on line 10: AWS key → `System.getenv()`, 1 implicit "agreed, I'll update" on line 14: password removed from logs), 1 ambiguous skipped (line 34: "maybe later?"), 1 rejected (line 32: "this is fine"). |

---

## Platform-Specific Notes

### GitLab

- `glab api --raw-field "position[key]=value"` does NOT create nested JSON objects — confirmed DiscussionNote (not DiffNote). Must use `curl` with `Content-Type: application/json` and nested `position` object.
- `glab api --input` returns HTTP 415 — does not set Content-Type header.
- `glab api --field` — same flat form encoding, same DiscussionNote result.
- `glab mr list --state` flag not available in all versions — filter JSON output with `jq`.
- `glab auth status -t` token format varies — regex must handle "Token: X" and "Token found: X".
- `glab` uses OAuth2 tokens by default — use `Authorization: Bearer` header, not `PRIVATE-TOKEN`.

### GitHub CLI

- `gh api .../reviews -X POST --input "$FILE"` works correctly for creating reviews with inline comments. The JSON payload must include `event: "COMMENT"` and a `comments` array with `path`, `line` (not `position`), and `body`.
- `gh pr comment --body-file` works for summary comments.
- Git remote must use SSH (`git@github.com:...`) not HTTPS for non-interactive push.

### GitHub MCP

- MCP tools handle auth through the server — no explicit login needed.
- `mcp_github-mcp_get_pull_request_files` returns per-file patches, not unified diff — agent works with per-file patches.
- `mcp_github-mcp_create_pull_request_review` accepts `comments` array with `{path, line, body}` — native support for inline review comments.
- `mcp_github-mcp_add_issue_comment` is used for the summary comment (posted as issue comment, not review).
- Requires `.opencode/opencode.jsonc` enabling `github*` tools for `code-reviewer` agent.
- Deduplication against existing comments (e.g., Copilot) works correctly — 8 of 12 findings suppressed in the test.

---

## Known Limitations

1. `opencode run --agent code-reviewer` requires an active server session — cannot be run as a one-shot subprocess from a different process. E2E tests must be run interactively via opencode TUI or delegated as agent tasks.
2. The review-bait approach (intentional vulnerabilities) only tests detection — it does not test false positive rates on clean code.
3. Deduplication is semantic (approximate matching) — edge cases may exist where similar but distinct findings are incorrectly suppressed.
