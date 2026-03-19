# E2E Testing Strategy — GitLab Code Review (GH-36)

## Test Environment

- **Target repo**: `gitlab.com/cwiakalski/flagshipx/flagshipx`
- **Local clone**: `tmp/code-review-e2e-test/flagshipx/`
- **Platform**: GitLab with `glab` CLI + `curl` for inline discussions
- **ADOS install**: Global install from feature branch via `./scripts/install.sh --global --branch <branch>`

## Setup Steps

1. Clone the target repo into `tmp/code-review-e2e-test/flagshipx/`
2. Copy the GitLab CLI blueprint (`doc/templates/blueprints/pr-instructions--gitlab-cli.md`) verbatim to `.ai/agent/pr-instructions.md` in the target repo
3. Create `.ai/agent/code-review-instructions.md` with repo-specific review rules
4. Create a test branch with:
   - The ADOS config files above
   - A source file with intentional review-bait issues (e.g., `src/lib/utils-review-test.ts`)
5. Push the branch and create an MR via `glab mr create`
6. Install ADOS globally from the feature branch: `./scripts/install.sh --global --branch feat/GH-36/remote-code-review-feedback`

## Running the Test

Start opencode in the flagshipx directory and use a natural user prompt:

```bash
cd tmp/code-review-e2e-test/flagshipx
opencode
```

Then in the opencode session, invoke the code reviewer with a natural prompt:

```
@code-reviewer review MR 24 --publish
```

Or simply:

```
/review-remote --mr 24 --publish
```

The agent should:
- Read `.ai/agent/pr-instructions.md` for platform access
- Read `.ai/agent/code-review-instructions.md` for review rules
- Fetch the MR diff and metadata
- Checkout the head commit
- Analyze the diff against built-in heuristics + repo-specific rules
- Publish inline discussions as DiffNote (via curl with JSON body)
- Publish a high-level summary note (via glab mr note)

## Key Principle

**The pr-instructions.md in the test repo must be a verbatim copy of the blueprint** — no manual modifications. This ensures the blueprint is tested exactly as a real user would use it.

## Verification Checklist

- [ ] Inline discussions are `DiffNote` type (not `DiscussionNote`)
- [ ] Each inline discussion is positioned on the correct diff line
- [ ] Severity emoji prefixes are present (🔴 🟠 🟡 ⚪)
- [ ] Summary comment is high-level only (no individual finding list)
- [ ] Summary comment has ADOS footer link
- [ ] All intentional issues in the review-bait file are detected
- [ ] No source files in the working tree are modified
- [ ] All artifacts are under `tmp/code-review/<branchPath>/`

## Test Results

| MR | Branch | What was tested | Result |
|----|--------|-----------------|--------|
| !21 | `test/ados-code-review-setup` | Initial setup — basic review | PASS (findings correct, but generic comments not inline) |
| !22 | `test/ados-code-review-e2e-v2` | Corrected pr-instructions with glab api inline | PASS (DiffNote inline comments working, summary too verbose) |
| !23 | `test/ados-code-review-e2e-v3` | Improved summary format | FAIL (inline discussions broken — DiscussionNote instead of DiffNote) |
| !24 | `test/ados-code-review-e2e-v4` | curl-based inline + improved summary + emoji | PASS (DiffNote confirmed, summary high-level, emoji present) |

## Known Limitations

1. `glab api --raw-field "position[key]=value"` does NOT create nested JSON objects — GitLab returns DiscussionNote instead of DiffNote. Must use `curl` with `Content-Type: application/json` for inline discussions.
2. `glab api --input` returns HTTP 415 (Unsupported Media Type) — does not set Content-Type header.
3. `glab mr list --state` flag not available in all glab versions — filter JSON output with `jq` instead.
4. `glab auth status -t` token output format varies — the regex pattern must handle both "Token: X" and "Token found: X" formats.
5. `glab` uses OAuth2 tokens by default — use `Authorization: Bearer` header, not `PRIVATE-TOKEN`.
6. `opencode run --agent code-reviewer` requires an active session — cannot be run as a one-shot subprocess from a different process.
