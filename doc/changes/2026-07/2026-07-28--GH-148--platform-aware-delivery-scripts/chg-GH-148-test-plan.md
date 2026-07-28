---
id: chg-GH-148-test-plan
status: Proposed
created: 2026-07-28T00:00:00Z
last_updated: 2026-07-28T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["autonomous-delivery", "gitlab", "platform-abstraction", "hardening"]
version_impact: minor
summary: "Make delivery scripts platform-aware (GitHub + GitLab) and harden GH-146 hook infrastructure"
links:
  change_spec: ./chg-GH-148-spec.md
  implementation_plan: ./chg-GH-148-plan.md
  testing_strategy: ../../.ai/rules/testing-strategy.md
  bash_rules: ../../.ai/rules/bash.md
---

# Test Plan - Make delivery scripts platform-aware (GitHub + GitLab) and harden GH-146 hook infrastructure

## 1. Scope and Objectives

This test plan validates that `scripts/deliver-ticket.sh`, `scripts/batch-deliver.sh`, and `scripts/ceo-loop.sh` behave identically on GitHub and GitLab through runtime platform detection and a tracker/MR abstraction, that GitLab deliveries report accurate results and populated PR URLs, that Mode B can merge GitLab MRs, that the new configuration knobs default to backward-compatible values, and that the three GH-146 hardening follow-ups (CG-SEC-003, CG-SRE-002, tuning OQ) are closed — all without changing any existing GitHub behavior or platform-agnostic invariant.

### 1.1 In Scope

- One-time platform detection with `ADOS_PLATFORM` override and GitHub default (F-1)
- Detection-first conditional CLI dependency — `require_cmd glab` on GitLab, `require_cmd gh` on GitHub (F-2)
- Tracker/MR dispatch seam (`_tracker` / `_mr`) replacing the `_gh` alias across affected scripts (F-3)
- JSON normalization shim presenting a common schema from divergent `gh --json` vs `glab --output json` outputs (F-4)
- Platform-aware `classify_result` and `pr_url_for` producing `pr-open`/`merged`/`blocked` and populated `pr_url` on GitLab, with no false "Could not fetch issue state" warning (F-5)
- Platform-neutral `build_delivery_prompt` emitting no literal `gh ` commands (F-6)
- Full `batch-deliver.sh` GitLab support: list / CI-gate (positive no-CI confirmation) / merge with platform-correct flags (F-7)
- Configurable blocked label (`ADOS_BLOCKED_LABEL`, default `human-input-needed`) and merge strategy (`ADOS_MERGE_STRATEGY`, default `squash`) (F-8, F-9)
- GitLab merge-status polling with stale-conflict no-op-push recovery (F-10)
- `find` liveness robustness on permission-denied subdirectories (F-11)
- Deterministic, seeded, bounded V1 parser property/fuzz test (F-12, CG-SEC-003)
- macOS lifecycle test portability (portable reaper OR documented Linux-only) (F-13, CG-SRE-002)
- Hook-failure tuning guidance in `doc/guides/delivery-modes.md` (F-14, GH-146 OQ-1)
- GitHub regression: zero behavior changes when `PLATFORM=github` (NFR-1)

### 1.2 Out of Scope & Known Gaps

- Jira, Bitbucket, or any tracker other than GitHub and GitLab (NG-1)
- Changes to liveness watchdog, single-flight + JOIN, branch resolution, resume, delivering marker, or hook protocol (NG-2)
- Changes to PM/CEO agent prompt definitions or the OpenCode session model (NG-3, NG-4)
- New delivery `result` values or changed consumer exit-code contracts (NG-5)
- Re-tuning `ADOS_HOOK_MAX_FAILURES`/`ADOS_HOOK_RETRY_SECONDS` defaults themselves — only documenting when to revisit (NG-6)
- A live GitLab CI runner integration beyond what Mode B's green-gate observes
- No partial-mutation / credential-delegation re-testing of the V1 parser (covered by GH-146 TC-HOOK-024..027); the property test here only exercises accept/reject against the grammar

## 2. References

- **Change Specification**: `doc/changes/2026-07/2026-07-28--GH-148--platform-aware-delivery-scripts/chg-GH-148-spec.md`
- **Implementation Plan**: `doc/changes/2026-07/2026-07-28--GH-148--platform-aware-delivery-scripts/chg-GH-148-plan.md` (pending)
- **Testing Strategy**: `.ai/rules/testing-strategy.md`
- **Bash Rules**: `.ai/rules/bash.md` (§10 testability, §11 testing framework)
- **Feature Spec**: `doc/spec/features/feature-autonomous-delivery.md`
- **Delivery Modes Guide**: `doc/guides/delivery-modes.md`
- **GH-146 Test Plan** (format reference + hardening origin): `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-test-plan.md`
- **Existing Test Files**:
  - `scripts/.tests/test-deliver-ticket.sh`
  - `scripts/.tests/test-batch-deliver.sh`
  - `scripts/.tests/test-ceo-loop.sh`
  - `scripts/.tests/test-hook-regression.sh`
- **Target Scripts**:
  - `scripts/deliver-ticket.sh`
  - `scripts/batch-deliver.sh`
  - `scripts/ceo-loop.sh`
  - `scripts/.tests/test-hook-regression.sh` (parser property test addition)

## 3. Test Environment

### 3.1 Required Environments

- **Local Development / CI Environment** (primary; all tests are mocked, no real forge calls):
  - Bash 4.0+ (associative arrays, `mapfile`)
  - Standard tools: `git`, `jq`, `mktemp`, `dd`, `od`, `chmod`
  - `opencode`, `gh`, `glab` CLIs are **mocked** via wrapper overrides (`_opencode`, `_gh`, `_glab`, `_tracker`, `_mr`, `_git`, `_jq`); no real authentication or network is required
- **macOS Environment** (only for F-13 portability verification): used only to confirm the lifecycle test platform documentation claim or the portable-reaper path

### 3.2 Test Data & Fixtures

- **GitLab JSON fixtures** use real `glab` field names: `.iid`, `.web_url`, `.source_branch`, `.merged_at`, `.state` = `"opened"`/`"closed"`, `.labels[].name`, `.detailed_merge_status`
- **GitHub JSON fixtures** use real `gh` field names: `.number`, `.url`, `.headRefName`, `.mergedAt`, `.state` = `"OPEN"`/`"CLOSED"`, `.labels[].name`
- **Parser property fixtures** are generated byte-oriented under `LC_ALL=C` with a fixed `RANDOM`/`SRANDOM` seed (deterministic), bounded iteration count
- **Temp state**: every test redirects `DELIVERY_DIR`, `STOP_FILE`, PID files, and the worktree into a `mktemp -d` cleaned up on EXIT (per `.ai/rules/bash.md` §11)

### 3.3 Isolation Strategy

- Each test runs in a fresh bash subshell with redirected state paths
- Wrapper overrides are scoped per-test and reset between tests
- No test writes to a real git remote, real forge, or real OpenCode session

## 4. Mock Strategy

All external boundaries are already wrapped in the existing scripts (`_gh`, `_git`, `_jq`, `_opencode`). This change adds `_glab`, `_tracker`, `_mr`, `detect_platform`, and the normalization seam. Tests mock at these boundaries:

| Wrapper / Seam | Mocked by | Returns |
|----------------|-----------|---------|
| `_gh` | function override | Controlled GitHub JSON / exit codes |
| `_glab` | function override | Controlled GitLab JSON / exit codes |
| `_tracker` | function override | Dispatch capture (records `$1` subcommand) + controlled JSON |
| `_mr` | function override | Dispatch capture (records `$1` subcommand) + controlled JSON |
| `_git` | function override | Remote URL (`remote get-url origin`), rev-parse, merge-base, push markers |
| `_jq` | real `jq` (fixtures are valid JSON) | — |
| `require_cmd` | override or set `command -v` stubs | Simulate `glab` present / `gh` absent |
| `detect_platform` | override OR feed via `_git` remote + `glab auth` stubs | Forced platform value |
| `sleep` | override (records calls, no real delay) | For merge-status poll + timeout tests |
| `opencode` / `_opencode` | override (no real session) | PM/CEO spawn markers |

**Platform forcing convention**: tests set `ADOS_PLATFORM=github|gitlab` directly where they need to pin the platform (the override is F-1's primary seam), and mock `_git remote get-url origin` + `command -v glab` for the auto-detection tests.

## 5. Test Cases

Test case IDs use the `TC-PLAT-NNN` prefix. `Type`: U = unit, I = integration, B = behavior. All assertions use the embedded framework from `.ai/rules/bash.md` §11 (`assert_eq`, `assert_contains`, `assert_not_contains`).

### 5.1 Scenario Index

| TC ID | Title | Type | Priority | AC/F/NFR |
|-------|-------|------|----------|----------|
| TC-PLAT-001 | `ADOS_PLATFORM=github` forces github regardless of remote | U | High | AC-F1-1, F-1 |
| TC-PLAT-002 | `ADOS_PLATFORM=gitlab` forces gitlab regardless of remote | U | High | AC-F1-2, F-1 |
| TC-PLAT-003 | git remote `gitlab.com` → gitlab | U | High | F-1 |
| TC-PLAT-004 | git remote `github.com` → github | U | High | F-1 |
| TC-PLAT-005 | no override, no recognizable remote, `glab auth` ok → gitlab fallback | U | Medium | F-1 |
| TC-PLAT-006 | no override, no recognizable remote, no `glab` → github default | U | High | F-1, NFR-5 |
| TC-PLAT-007 | platform=gitlab → `require_cmd glab` (not `gh`) | I | High | AC-F2-1, F-2 |
| TC-PLAT-008 | platform=github → `require_cmd gh` (unchanged) | I | High | F-2, NFR-1 |
| TC-PLAT-009 | `_tracker` on github dispatches `gh issue` | U | High | F-3, AC-F3-1 |
| TC-PLAT-010 | `_tracker` on gitlab dispatches `glab issue` | U | High | F-3 |
| TC-PLAT-011 | `_mr` on github dispatches `gh pr` | U | High | F-3 |
| TC-PLAT-012 | `_mr` on gitlab dispatches `glab mr` | U | High | F-3 |
| TC-PLAT-013 | GitHub issue JSON → normalized schema | U | High | F-4 |
| TC-PLAT-014 | GitLab issue JSON → normalized schema | U | High | F-4, AC-F5-1 |
| TC-PLAT-015 | GitHub PR JSON → normalized schema | U | High | F-4 |
| TC-PLAT-016 | GitLab MR JSON → normalized schema | U | High | F-4, AC-F5-2 |
| TC-PLAT-017 | GitLab open issue + open MR → `pr-open` | I | High | AC-F5-1, F-5 |
| TC-PLAT-018 | GitLab closed issue → `merged` | I | High | AC-F5-4, F-5 |
| TC-PLAT-019 | GitLab issue with blocked label → `blocked` | I | High | AC-F5-5, F-8 |
| TC-PLAT-020 | GitLab open issue, no MR → `failed` | I | High | F-5 |
| TC-PLAT-021 | GitLab tracker error → `unknown` (no restart burn) | I | High | F-5, NFR-3 |
| TC-PLAT-022 | No false "Could not fetch issue state" on queryable GitLab issue | I | High | AC-F5-3, F-5 |
| TC-PLAT-023 | GitLab open MR → `pr_url_for` returns web_url | I | High | AC-F5-2, F-5 |
| TC-PLAT-024 | GitLab no open MR → `pr_url_for` empty | I | High | F-5 |
| TC-PLAT-025 | Platform-neutral prompt contains no literal `gh ` commands | U | High | AC-F6-1, F-6 |
| TC-PLAT-026 | Prompt mentions project config / configured CLI | U | Medium | F-6 |
| TC-PLAT-027 | `should_skip_ticket` GitLab closed issue → skip | I | High | F-7 |
| TC-PLAT-028 | `should_skip_ticket` GitLab blocked issue → skip | I | High | F-7, F-8 |
| TC-PLAT-029 | `should_skip_ticket` GitLab merged MR → skip | I | High | F-7 |
| TC-PLAT-030 | `wait_for_pr_green` GitLab: no pipelines → green | I | High | AC-F7-1, F-7 |
| TC-PLAT-031 | `wait_for_pr_green` GitLab: pipelines running → poll | I | High | AC-F7-1, F-7 |
| TC-PLAT-032 | `wait_for_pr_green` GitLab: pipeline failed → red | I | High | AC-F7-1, F-7 |
| TC-PLAT-033 | `approved_pr_flow` GitLab merge uses `glab mr merge` with correct flags | I | High | AC-F7-1, F-7 |
| TC-PLAT-034 | `ADOS_BLOCKED_LABEL` unset → matches `human-input-needed` | U | High | AC-F8-1, NFR-5 |
| TC-PLAT-035 | `ADOS_BLOCKED_LABEL=custom-label` → matches custom-label | U | High | AC-F8-1 |
| TC-PLAT-036 | `ADOS_MERGE_STRATEGY` unset → squash both platforms | U | High | AC-F9-1, NFR-5 |
| TC-PLAT-037 | `ADOS_MERGE_STRATEGY=merge` → merge-commit flags | U | High | AC-F9-1 |
| TC-PLAT-038 | `ADOS_MERGE_STRATEGY=rebase` → rebase flags | U | High | AC-F9-1 |
| TC-PLAT-039 | GitLab `detailed_merge_status=mergeable` → proceed immediately | I | High | AC-F10-1, F-10 |
| TC-PLAT-040 | GitLab stale-conflict (`conflict` + `can_be_merged=true`) → no-op push, re-poll | I | High | AC-F10-1, F-10 |
| TC-PLAT-041 | GitLab status never settles → timeout (≤60s) | I | High | AC-F10-1, NFR-6 |
| TC-PLAT-042 | `find` with permission-denied subdir → no error logged | I | High | AC-F11-1, NFR-7 |
| TC-PLAT-043 | GitHub regression: all `classify_result` tests pass | B | High | AC-F3-1, NFR-1 |
| TC-PLAT-044 | GitHub regression: all `pr_url_for` tests pass | B | High | AC-F3-1, NFR-1 |
| TC-PLAT-045 | GitHub regression: all `build_delivery_prompt` tests pass | B | High | AC-F3-1, NFR-1 |
| TC-PLAT-046 | Property test: seeded valid byte sequences all accepted | U | High | AC-F12-1, F-12 |
| TC-PLAT-047 | Property test: seeded invalid (CR/NUL/no-LF) byte sequences all rejected | U | High | AC-F12-1, F-12 |
| TC-PLAT-048 | Property test: deterministic (same seed → same results) | U | High | AC-F12-1, NFR-4 |
| TC-PLAT-049 | Property test: completes in < 10s | U | High | AC-F12-1, NFR-4 |
| TC-PLAT-050 | macOS lifecycle portability: portable reaper OR documented Linux-only | B | Medium | AC-F13-1, F-13 |
| TC-PLAT-051 | `delivery-modes.md` has hook-failure tuning guidance | B | Medium | AC-F14-1, F-14 |

### 5.2 Scenario Details (Given / When / Then)

#### F-1 — Platform auto-detection with override

**TC-PLAT-001** — `ADOS_PLATFORM=github` forces github regardless of remote
- **Given** `_git remote get-url origin` returns `git@gitlab.com:acme/repo.git` and `ADOS_PLATFORM=github` is set
- **When** `detect_platform` runs
- **Then** it prints/returns `github`; the remote is ignored (escape hatch)

**TC-PLAT-002** — `ADOS_PLATFORM=gitlab` forces gitlab regardless of remote
- **Given** `_git remote get-url origin` returns `git@github.com:acme/repo.git` and `ADOS_PLATFORM=gitlab` is set
- **When** `detect_platform` runs
- **Then** it returns `gitlab`; the remote is ignored (escape hatch)

**TC-PLAT-003** — git remote `gitlab.com` → gitlab
- **Given** `ADOS_PLATFORM` is unset and `_git remote get-url origin` returns `https://gitlab.com/acme/repo.git`
- **When** `detect_platform` runs
- **Then** it returns `gitlab`

**TC-PLAT-004** — git remote `github.com` → github
- **Given** `ADOS_PLATFORM` is unset and `_git remote get-url origin` returns `git@github.com:acme/repo.git`
- **When** `detect_platform` runs
- **Then** it returns `github`

**TC-PLAT-005** — no override, no recognizable remote, `glab auth` ok → gitlab fallback
- **Given** `ADOS_PLATFORM` unset, `_git remote get-url origin` returns an unrecognized URL (e.g. `git@gitea.local:acme/repo.git`), and `glab auth status` (mocked via `command -v glab` + auth probe) succeeds
- **When** `detect_platform` runs
- **Then** it returns `gitlab` (glab-auth fallback)

**TC-PLAT-006** — no override, no recognizable remote, no `glab` → github default
- **Given** `ADOS_PLATFORM` unset, remote unrecognized, and `glab` not available / auth fails
- **When** `detect_platform` runs
- **Then** it returns `github` (safe default, NFR-5)

#### F-2 — Conditional CLI dependency

**TC-PLAT-007** — platform=gitlab → `require_cmd glab` (not `gh`)
- **Given** `ADOS_PLATFORM=gitlab`, `command -v glab` succeeds, and a `require_cmd` recorder captures its argument; `gh` is **absent** (`command -v gh` fails)
- **When** `deliver-ticket.sh` startup runs its CLI dependency check
- **Then** `require_cmd glab` is called; `require_cmd gh` is **not** called; startup does **not** abort (AC-F2-1)

**TC-PLAT-008** — platform=github → `require_cmd gh` (unchanged)
- **Given** `ADOS_PLATFORM=github`, `command -v gh` succeeds
- **When** startup runs its CLI dependency check
- **Then** `require_cmd gh` is called exactly as today; no `require_cmd glab` (NFR-1)

#### F-3 — Tracker/MR dispatch seam

**TC-PLAT-009** — `_tracker` on github dispatches `gh issue`
- **Given** platform resolved to `github` and a recorder wraps `_gh` capturing `$@`
- **When** `_tracker issue view 42 ...` is invoked
- **Then** the recorder observes a `gh issue view 42 ...` call (not `glab`)

**TC-PLAT-010** — `_tracker` on gitlab dispatches `glab issue`
- **Given** platform resolved to `gitlab` and a recorder wraps `_glab` capturing `$@`
- **When** `_tracker issue view 42 ...` is invoked
- **Then** the recorder observes a `glab issue view 42 ...` call (not `gh`)

**TC-PLAT-011** — `_mr` on github dispatches `gh pr`
- **Given** platform resolved to `github` with a `_gh` recorder
- **When** `_mr pr list ...` is invoked
- **Then** the recorder observes a `gh pr list ...` call

**TC-PLAT-012** — `_mr` on gitlab dispatches `glab mr`
- **Given** platform resolved to `gitlab` with a `_glab` recorder
- **When** `_mr ... list ...` is invoked (platform-correct subcommand surface)
- **Then** the recorder observes a `glab mr ...` call (not `gh pr`)

#### F-4 — JSON normalization shim

**TC-PLAT-013** — GitHub issue JSON → normalized schema
- **Given** raw GitHub issue JSON `{"state":"OPEN","labels":[{"name":"bug"},{"name":"human-input-needed"}]}`
- **When** the normalization shim produces the common schema
- **Then** output has `state` lowercased to `open` (or a normalized closed/open token) and `labels[].name` preserved as an array including `human-input-needed`

**TC-PLAT-014** — GitLab issue JSON → normalized schema
- **Given** raw GitLab issue JSON `{"state":"opened","labels":[{"name":"human-input-needed"}]}`
- **When** the normalization shim produces the common schema
- **Then** output `state` is normalized to the same token as GitHub's open case, and `labels[].name` is preserved

**TC-PLAT-015** — GitHub PR JSON → normalized schema
- **Given** raw GitHub PR JSON `{"number":42,"url":"https://github.com/acme/r/pull/42","headRefName":"feat/x","mergedAt":"2026-01-01T00:00:00Z"}`
- **When** the normalization shim produces the common schema
- **Then** output carries `.number=42`, `.url=<the url>`, `.head_branch=feat/x`, `.merged_at=<the ts>`

**TC-PLAT-016** — GitLab MR JSON → normalized schema
- **Given** raw GitLab MR JSON `{"iid":42,"web_url":"https://gitlab.com/acme/r/-/merge_requests/42","source_branch":"feat/x","merged_at":"2026-01-01T00:00:00Z"}`
- **When** the normalization shim produces the common schema
- **Then** output maps `.iid→number=42`, `.web_url→url=<the url>`, `.source_branch→head_branch=feat/x`, `.merged_at→merged_at=<the ts>` — identical shape to TC-PLAT-015

#### F-5 — Platform-aware result classification & PR URL

**TC-PLAT-017** — GitLab open issue + open MR → `pr-open`
- **Given** `ADOS_PLATFORM=gitlab`; `_tracker issue view` returns normalized open issue with no blocked label; `_mr` returns one open MR for the branch
- **When** `classify_result "GL-7" "feat/x"` runs
- **Then** it returns `pr-open` (not `unknown`/`failed`) — AC-F5-1

**TC-PLAT-018** — GitLab closed issue → `merged`
- **Given** `ADOS_PLATFORM=gitlab`; `_tracker issue view` returns a closed (normalized) issue
- **When** `classify_result "GL-7" "feat/x"` runs
- **Then** it returns `merged` — AC-F5-4

**TC-PLAT-019** — GitLab issue with blocked label → `blocked`
- **Given** `ADOS_PLATFORM=gitlab`; `_tracker issue view` returns an open issue carrying the configured blocked label
- **When** `classify_result "GL-7" "feat/x"` runs
- **Then** it returns `blocked` — AC-F5-5

**TC-PLAT-020** — GitLab open issue, no MR → `failed`
- **Given** `ADOS_PLATFORM=gitlab`; `_tracker issue view` returns an open issue with no blocked label; `_mr` returns no open MR
- **When** `classify_result "GL-7" "feat/x"` runs
- **Then** it returns `failed`

**TC-PLAT-021** — GitLab tracker error → `unknown` (no restart burn)
- **Given** `ADOS_PLATFORM=gitlab`; `_tracker issue view` exits non-zero (simulated auth/rate-limit/network error)
- **When** `classify_result "GL-7" "feat/x"` runs
- **Then** it returns `unknown`; `decide_after_iteration "stuck" "unknown" ...` returns `continue` (no restart slot burned) — preserves existing `unknown` semantics, NFR-3

**TC-PLAT-022** — No false "Could not fetch issue state" on queryable GitLab issue
- **Given** `ADOS_PLATFORM=gitlab`; `_tracker issue view` succeeds and returns a valid issue
- **When** `classify_result "GL-7" "feat/x"` runs with stderr captured
- **Then** stderr does **not** contain `Could not fetch issue state` — AC-F5-3

**TC-PLAT-023** — GitLab open MR → `pr_url_for` returns web_url
- **Given** `ADOS_PLATFORM=gitlab`; `_mr` returns an open MR with `web_url` `https://gitlab.com/acme/r/-/merge_requests/42`
- **When** `pr_url_for "GL-7" "feat/x"` runs
- **Then** it returns that web URL — AC-F5-2

**TC-PLAT-024** — GitLab no open MR → `pr_url_for` empty
- **Given** `ADOS_PLATFORM=gitlab`; `_mr` returns no open MR (empty array)
- **When** `pr_url_for "GL-7" "feat/x"` runs
- **Then** it prints empty (no URL)

#### F-6 — Platform-aware PM prompt builder

**TC-PLAT-025** — Platform-neutral prompt contains no literal `gh ` commands
- **Given** `ADOS_PLATFORM=gitlab` (and also tested under `github`)
- **When** `build_delivery_prompt "GL-7" "feat/x"` runs
- **Then** the prompt contains no literal `gh ` (space-delimited) command tokens (e.g. no `gh issue view`, `gh pr list`, `gh pr view`, `gh issue edit`); OQ-2 platform-neutral form — AC-F6-1

**TC-PLAT-026** — Prompt mentions project config / configured CLI
- **Given** the platform-neutral prompt from TC-PLAT-025
- **When** inspected
- **Then** it references detecting the platform from project config (`.ai/agent/pm-instructions.md`) or git remote and using the project's configured CLI — OQ-2

#### F-7 — batch-deliver.sh full GitLab support

**TC-PLAT-027** — `should_skip_ticket` GitLab closed issue → skip
- **Given** `ADOS_PLATFORM=gitlab`; `_tracker issue view` returns a closed issue
- **When** `should_skip_ticket "GL-7"` runs
- **Then** it prints `closed` and returns 0 (skip)

**TC-PLAT-028** — `should_skip_ticket` GitLab blocked issue → skip
- **Given** `ADOS_PLATFORM=gitlab`; `_tracker issue view` returns an open issue with the configured blocked label
- **When** `should_skip_ticket "GL-7"` runs
- **Then** it prints `blocked` and returns 0 (skip)

**TC-PLAT-029** — `should_skip_ticket` GitLab merged MR → skip
- **Given** `ADOS_PLATFORM=gitlab`; issue open with no blocked label; `_mr` returns a merged MR (normalized `merged_at` set)
- **When** `should_skip_ticket "GL-7"` runs
- **Then** it prints `merged` and returns 0 (skip)

**TC-PLAT-030** — `wait_for_pr_green` GitLab: no pipelines → green (positive confirm)
- **Given** `ADOS_PLATFORM=gitlab`; the GitLab pipeline API query (via `glab api` / `_mr`) positively confirms **zero pipelines** for the MR (mirrors GitHub `_pr_has_no_checks_configured`)
- **When** `wait_for_pr_green "42"` runs
- **Then** it returns 0 (green) — OQ-1 positive no-CI confirmation

**TC-PLAT-031** — `wait_for_pr_green` GitLab: pipelines running → poll
- **Given** `ADOS_PLATFORM=gitlab`; pipelines exist and are `running`/`pending` on first poll, then succeed on a later poll; `sleep` is mocked to record calls
- **When** `wait_for_pr_green "42"` runs
- **Then** it polls at least twice (sleep invoked) and returns 0 (green) once pipelines succeed

**TC-PLAT-032** — `wait_for_pr_green` GitLab: pipeline failed → red
- **Given** `ADOS_PLATFORM=gitlab`; a pipeline is in `failed` state
- **When** `wait_for_pr_green "42"` runs
- **Then** it returns 1 (red)

**TC-PLAT-033** — `approved_pr_flow` GitLab merge uses `glab mr merge` with correct flags
- **Given** `ADOS_PLATFORM=gitlab`; `_git` rebases cleanly (merge-base == main head); green-gate passes; `_mr`/`_glab` recorder captures the merge invocation; default strategy `squash`
- **When** `approved_pr_flow "GL-7" "feat/GH-200/x"` runs
- **Then** the recorder observes `glab mr merge 42 --squash --remove-source-branch` (platform-correct flag mapping of `gh pr merge N --squash --delete-branch`); flow returns 0 — AC-F7-1

#### F-8 — Configurable blocked label

**TC-PLAT-034** — `ADOS_BLOCKED_LABEL` unset → matches `human-input-needed`
- **Given** `ADOS_BLOCKED_LABEL` is unset; an issue carries label `human-input-needed`
- **When** blocked detection runs (via `classify_result` / `should_skip_ticket`)
- **Then** it matches `human-input-needed` and classifies `blocked`/skips — NFR-5 default

**TC-PLAT-035** — `ADOS_BLOCKED_LABEL=custom-label` → matches custom-label
- **Given** `ADOS_BLOCKED_LABEL=needs-review`; an issue carries label `needs-review` and **not** `human-input-needed`
- **When** blocked detection runs
- **Then** it matches `needs-review` (and does **not** match the old default)

#### F-9 — Configurable merge strategy

**TC-PLAT-036** — `ADOS_MERGE_STRATEGY` unset → squash both platforms
- **Given** `ADOS_MERGE_STRATEGY` unset
- **When** the merge flag resolver runs on github then gitlab
- **Then** github yields `--squash --delete-branch`; gitlab yields `--squash --remove-source-branch` — NFR-5 default

**TC-PLAT-037** — `ADOS_MERGE_STRATEGY=merge` → merge-commit flags
- **Given** `ADOS_MERGE_STRATEGY=merge`
- **When** the merge flag resolver runs on github then gitlab
- **Then** github yields a merge-commit flag (e.g. `--merge --delete-branch`); gitlab yields `--merge --remove-source-branch`

**TC-PLAT-038** — `ADOS_MERGE_STRATEGY=rebase` → rebase flags
- **Given** `ADOS_MERGE_STRATEGY=rebase`
- **When** the merge flag resolver runs on github then gitlab
- **Then** github yields `--rebase --delete-branch`; gitlab yields `--rebase --remove-source-branch`

#### F-10 — GitLab merge-status polling & stale-conflict recovery

**TC-PLAT-039** — GitLab `detailed_merge_status=mergeable` → proceed immediately
- **Given** `ADOS_PLATFORM=gitlab`; `glab api` returns `detailed_merge_status=mergeable` on the first poll
- **When** the merge-status poller runs (bounded timeout)
- **Then** it proceeds to merge immediately with zero `sleep` calls

**TC-PLAT-040** — GitLab stale-conflict (`conflict` + `can_be_merged=true`) → no-op push, re-poll
- **Given** first poll returns `detailed_merge_status=conflict` but `merge_status=can_be_merged` / `has_conflicts=false`; a `_git` recorder captures pushes; a subsequent poll returns `mergeable`
- **When** the merge-status poller runs
- **Then** it performs a no-op (empty) commit push to force recompute, re-polls, observes `mergeable`, then proceeds — AC-F10-1

**TC-PLAT-041** — GitLab status never settles → timeout (≤60s)
- **Given** `detailed_merge_status` stays `checking`/`unchecked` forever; `sleep` is mocked and a wall-clock/iteration cap is asserted; `ADOS_MR_POLL_TIMEOUT` forced low (e.g. 60s) and `ADOS_MR_POLL_INTERVAL` low
- **When** the merge-status poller runs
- **Then** it returns a timeout failure after ≤60s total (NFR-6); the merge is **not** attempted

#### F-11 — find liveness robustness

**TC-PLAT-042** — `find` with permission-denied subdir → no error logged
- **Given** a worktree containing a root-owned / chmod-000 subdirectory that makes `find` exit non-zero on permission denial
- **When** the liveness `find` runs
- **Then** stderr contains no `exited with 1` / `✗` error line for the find; liveness detection still functions — AC-F11-1, NFR-7 (the find is guarded with `|| true`)

#### NFR-1 — GitHub regression

**TC-PLAT-043** — GitHub regression: all `classify_result` tests pass with `PLATFORM=github`
- **Given** `ADOS_PLATFORM=github` (or unset with a github remote)
- **When** the existing `classify_result` test set runs (blocked/merged/pr-open/failed/unknown/empty-branch-fallback)
- **Then** every existing assertion passes unchanged — NFR-1, AC-F3-1

**TC-PLAT-044** — GitHub regression: all `pr_url_for` tests pass with `PLATFORM=github`
- **Given** `ADOS_PLATFORM=github`
- **When** the existing `pr_url_for` tests run
- **Then** every existing assertion passes unchanged — NFR-1

**TC-PLAT-045** — GitHub regression: all `build_delivery_prompt` tests pass with `PLATFORM=github`
- **Given** `ADOS_PLATFORM=github`
- **When** the existing prompt tests run (ticket ref, branch, DO NOT MERGE, blocked workflow, single-ticket, lifecycle, resume sync, fetch review comments)
- **Then** every existing assertion passes unchanged — NFR-1

#### F-12 — V1 parser property/fuzz test (CG-SEC-003)

**TC-PLAT-046** — Property test: seeded valid byte sequences all accepted
- **Given** a seeded (`SRANDOM=<fixed>` or `RANDOM=<fixed>`, bounded iteration count, e.g. 500) generator emitting only grammar-valid V1 batches under `LC_ALL=C` (LF-terminated, authorized names, within byte/record/line bounds)
- **When** each generated batch is fed to `_hook_validate_and_apply`
- **Then** every batch is accepted (parser returns 0) — AC-F12-1

**TC-PLAT-047** — Property test: seeded invalid (CR/NUL/no-LF) byte sequences all rejected
- **Given** the same seed/iteration bound; a generator emitting provably invalid byte sequences (embedded CR `0x0D`, embedded NUL `0x00`, missing final LF, over-limit lines, unauthorized names)
- **When** each is fed to `_hook_validate_and_apply`
- **Then** every batch is rejected (parser returns non-zero); no partial mutation — AC-F12-1

**TC-PLAT-048** — Property test: deterministic (same seed → same results)
- **Given** the property test is run twice with the identical seed
- **When** the accepted/rejected sequence is compared
- **Then** both runs produce byte-identical accept/reject verdicts — NFR-4 determinism

**TC-PLAT-049** — Property test: completes in < 10s
- **Given** the bounded property test (seeded, capped iteration count)
- **When** wall-clock time is measured
- **Then** total runtime is < 10s (NFR-4); no real long-running external fuzzer is invoked

#### F-13 — macOS lifecycle test portability (CG-SRE-002)

**TC-PLAT-050** — macOS lifecycle portability: portable reaper OR documented Linux-only
- **Given** the GH-146 lifecycle test in `scripts/.tests/test-hook-regression.sh` and its spec/CI docs
- **When** the test/docs are inspected for macOS handling
- **Then** either (a) the test uses a portable reaper that works on macOS (no `/proc`, no Linux-only `pgrep -g`/`pkill -g` assumption), or (b) the test/spec/CI docs explicitly state the lifecycle matrix is Linux-only — AC-F13-1 (DEC-5: either outcome closes the observation)

#### F-14 — Hook-failure tuning documentation (GH-146 OQ-1)

**TC-PLAT-051** — `delivery-modes.md` has hook-failure tuning guidance
- **Given** the updated `doc/guides/delivery-modes.md`
- **When** grepped/read for tuning guidance
- **Then** it documents that `ADOS_HOOK_MAX_FAILURES` and `ADOS_HOOK_RETRY_SECONDS` are initial values to revisit against production telemetry, including the trade-offs (too-tight cap exits the supervisor on a flaky hook; too-loose delays failure surfacing) — AC-F14-1, NG-6 (does not re-tune the defaults)

## 6. Coverage Matrix

### 6.1 Acceptance Criteria → Test Cases

| AC ID | Criterion (short) | TC ID(s) | Status |
|-------|-------------------|----------|--------|
| AC-F1-1 | GitLab remote + `ADOS_PLATFORM=github` forces GitHub | TC-PLAT-001 | Covered |
| AC-F1-2 | GitHub remote + `ADOS_PLATFORM=gitlab` forces GitLab | TC-PLAT-002 | Covered |
| AC-F2-1 | GitLab-only machine requires `glab` (not `gh`), no abort | TC-PLAT-007 | Covered |
| AC-F3-1 | `PLATFORM=github` preserves all `gh` paths, no regression | TC-PLAT-009, TC-PLAT-011, TC-PLAT-013, TC-PLAT-015, TC-PLAT-043, TC-PLAT-044, TC-PLAT-045 | Covered |
| AC-F5-1 | GitLab open MR → `pr-open` | TC-PLAT-014, TC-PLAT-016, TC-PLAT-017 | Covered |
| AC-F5-2 | GitLab open MR → `pr_url` populated | TC-PLAT-016, TC-PLAT-023 | Covered |
| AC-F5-3 | GitLab queryable issue → no false "Could not fetch" warning | TC-PLAT-010, TC-PLAT-022 | Covered |
| AC-F5-4 | GitLab closed issue + merged MR → `merged` | TC-PLAT-018 | Covered |
| AC-F5-5 | GitLab blocked label → `blocked` | TC-PLAT-019 | Covered |
| AC-F6-1 | GitLab platform → no literal `gh` commands in prompt | TC-PLAT-025, TC-PLAT-026 | Covered |
| AC-F7-1 | GitLab Mode B: list + CI-gate + merge | TC-PLAT-027, TC-PLAT-028, TC-PLAT-029, TC-PLAT-030, TC-PLAT-031, TC-PLAT-032, TC-PLAT-033 | Covered |
| AC-F8-1 | `ADOS_BLOCKED_LABEL` default + custom | TC-PLAT-034, TC-PLAT-035 | Covered |
| AC-F9-1 | `ADOS_MERGE_STRATEGY` default + custom | TC-PLAT-036, TC-PLAT-037, TC-PLAT-038 | Covered |
| AC-F10-1 | GitLab merge-status polling + stale-conflict recovery | TC-PLAT-039, TC-PLAT-040, TC-PLAT-041 | Covered |
| AC-F11-1 | `find` permission-denied → no error logged | TC-PLAT-042 | Covered |
| AC-F12-1 | Parser property test deterministic + fast | TC-PLAT-046, TC-PLAT-047, TC-PLAT-048, TC-PLAT-049 | Covered |
| AC-F13-1 | macOS lifecycle portability | TC-PLAT-050 | Covered |
| AC-F14-1 | Hook-failure tuning documentation | TC-PLAT-051 | Covered |

### 6.2 Functional Capabilities → Test Cases

| F ID | Capability | TC ID(s) |
|------|------------|----------|
| F-1 | Platform auto-detection with override | TC-PLAT-001..006 |
| F-2 | Conditional CLI dependency | TC-PLAT-007, TC-PLAT-008 |
| F-3 | Tracker/MR dispatch seam | TC-PLAT-009, TC-PLAT-010, TC-PLAT-011, TC-PLAT-012 |
| F-4 | JSON normalization shim | TC-PLAT-013, TC-PLAT-014, TC-PLAT-015, TC-PLAT-016 |
| F-5 | Platform-aware classification & PR URL | TC-PLAT-017..024 |
| F-6 | Platform-aware PM prompt builder | TC-PLAT-025, TC-PLAT-026 |
| F-7 | batch-deliver.sh full GitLab support | TC-PLAT-027..033 |
| F-8 | Configurable blocked label | TC-PLAT-034, TC-PLAT-035 |
| F-9 | Configurable merge strategy | TC-PLAT-036, TC-PLAT-037, TC-PLAT-038 |
| F-10 | GitLab merge-status polling | TC-PLAT-039, TC-PLAT-040, TC-PLAT-041 |
| F-11 | find liveness robustness | TC-PLAT-042 |
| F-12 | V1 parser property/fuzz test | TC-PLAT-046, TC-PLAT-047, TC-PLAT-048, TC-PLAT-049 |
| F-13 | macOS lifecycle test portability | TC-PLAT-050 |
| F-14 | Hook-failure tuning documentation | TC-PLAT-051 |

### 6.3 Non-Functional Requirements → Test Cases

| NFR ID | Requirement | TC ID(s) |
|--------|-------------|----------|
| NFR-1 | GitHub regression (0 behavior changes) | TC-PLAT-008, TC-PLAT-043, TC-PLAT-044, TC-PLAT-045 |
| NFR-2 | Platform-detection latency (one-time, <2s) | TC-PLAT-001..006 (detection is one-time, mocked) |
| NFR-3 | Result-domain stability (no new values; unknown doesn't burn restart) | TC-PLAT-017..021, TC-PLAT-043 |
| NFR-4 | Parser property test determinism & speed | TC-PLAT-048, TC-PLAT-049 |
| NFR-5 | Default preservation (platform→github, label→human-input-needed, strategy→squash) | TC-PLAT-006, TC-PLAT-034, TC-PLAT-036 |
| NFR-6 | GitLab merge-status poll bound (≤60s, ≤5s interval) | TC-PLAT-041 |
| NFR-7 | find robustness (no non-zero-exit error on permission-denied) | TC-PLAT-042 |
| NFR-8 | No-merge preservation (deliver-ticket never merges on either platform) | TC-PLAT-043, TC-PLAT-044 (existing no-merge regression retained) |

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | Test File | Execution | Mocking Requirements | Status |
|----------|-----------|-----------|----------------------|--------|
| TC-PLAT-001..006 | `scripts/.tests/test-deliver-ticket.sh` (shared `detect_platform` suite) | `bash scripts/.tests/test-deliver-ticket.sh` | `_git remote get-url`, `command -v glab`/`glab auth status` stubs, `ADOS_PLATFORM` override | To Implement |
| TC-PLAT-007, TC-PLAT-008 | `scripts/.tests/test-deliver-ticket.sh`, `scripts/.tests/test-batch-deliver.sh` | same | `require_cmd` recorder; `command -v gh`/`command -v glab` stubs | To Implement |
| TC-PLAT-009..012 | `scripts/.tests/test-deliver-ticket.sh` | same | `_gh`/`_glab` dispatch recorders; `ADOS_PLATFORM` pin | To Implement |
| TC-PLAT-013..016 | `scripts/.tests/test-deliver-ticket.sh` | same | raw JSON fixtures → real `jq` normalization | To Implement |
| TC-PLAT-017..022 | `scripts/.tests/test-deliver-ticket.sh` | same | `_tracker`/`_mr` overrides returning normalized GitLab fixtures; stderr capture for TC-PLAT-022 | To Implement |
| TC-PLAT-023, TC-PLAT-024 | `scripts/.tests/test-deliver-ticket.sh` | same | `_mr` override returning GitLab MR `web_url` / empty | To Implement |
| TC-PLAT-025, TC-PLAT-026 | `scripts/.tests/test-deliver-ticket.sh` | same | `ADOS_PLATFORM` pin; prompt string assertions | To Implement |
| TC-PLAT-027..029 | `scripts/.tests/test-batch-deliver.sh` | `bash scripts/.tests/test-batch-deliver.sh` | `_tracker`/`_mr` GitLab fixtures | To Implement |
| TC-PLAT-030..032 | `scripts/.tests/test-batch-deliver.sh` | same | `glab api`/pipeline-list override; mocked `sleep` | To Implement |
| TC-PLAT-033 | `scripts/.tests/test-batch-deliver.sh` | same | `_glab mr merge` recorder; `_git` rebase-clean stubs | To Implement |
| TC-PLAT-034, TC-PLAT-035 | `scripts/.tests/test-deliver-ticket.sh`, `scripts/.tests/test-batch-deliver.sh` | both | `ADOS_BLOCKED_LABEL` set/unset; label fixtures | To Implement |
| TC-PLAT-036..038 | `scripts/.tests/test-batch-deliver.sh` | same | merge-flag resolver unit; both platforms asserted | To Implement |
| TC-PLAT-039..041 | `scripts/.tests/test-batch-deliver.sh` | same | `glab api` `detailed_merge_status` sequence; `_git` no-op push recorder; mocked `sleep`; forced poll timeout/interval | To Implement |
| TC-PLAT-042 | `scripts/.tests/test-deliver-ticket.sh` (liveness section) | same | chmod-000 subdir fixture; stderr capture | To Implement |
| TC-PLAT-043..045 | `scripts/.tests/test-deliver-ticket.sh` | same | run existing test set under `ADOS_PLATFORM=github` | Existing – Parameterize |
| TC-PLAT-046..049 | `scripts/.tests/test-hook-regression.sh` | `bash scripts/.tests/test-hook-regression.sh` | seeded `SRANDOM`/`RANDOM`; `dd`/`od` byte generators under `LC_ALL=C`; wall-clock measurement | To Implement |
| TC-PLAT-050 | `scripts/.tests/test-hook-regression.sh` + spec/CI docs | same + doc read | grep for `/proc`/`pgrep -g`/`pkill -g` Linux-isms OR explicit Linux-only doc statement | To Implement |
| TC-PLAT-051 | doc-only assertion in a test (or hook-regression grep) | `bash scripts/.tests/test-hook-regression.sh` | grep `doc/guides/delivery-modes.md` for tuning vars + trade-offs | To Implement |

### Regression Suite (must remain green)

- `bash scripts/.tests/test-deliver-ticket.sh`
- `bash scripts/.tests/test-batch-deliver.sh`
- `bash scripts/.tests/test-ceo-loop.sh`
- `bash scripts/.tests/test-hook-regression.sh`
- `bash scripts/test-all.sh` (aggregate)

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| `gh`/`glab` subcommand surfaces differ enough that dispatch needs different flags, not just a CLI name swap | High | Medium | Normalize at the shim; TC-PLAT-009..012 + TC-PLAT-033 assert platform-correct flags on both paths (RSK-1) |
| GitLab async `detailed_merge_status` staleness blocks merges | Medium | High | TC-PLAT-039..041 cover mergeable-immediate, stale-conflict no-op-push recovery, and timeout (RSK-2) |
| Changing `classify_result` breaks consumers (batch-deliver, CEO) | High | Low | Same result-domain; GitHub unchanged (TC-PLAT-043); only GitLab moves unknown→correct (RSK-3) |
| Parser property test becomes a slow fuzzer | Medium | Medium | TC-PLAT-048/049 enforce determinism + <10s bound; seeded and capped (RSK-4) |
| GitLab CI-status gating differs from `gh pr checks` | Medium | Medium | TC-PLAT-030..032 cover positive no-CI confirmation, running-pipeline poll, and failed pipeline (RSK-5, OQ-1) |
| Configurable label/strategy changes GitHub default if misconfigured | Medium | Low | TC-PLAT-034/036 assert defaults preserved when unset (RSK-7) |

### 8.2 Assumptions

- The configured `origin` remote is a reliable platform signal; the `ADOS_PLATFORM` override exists for exceptions (spec §12).
- `glab` and `gh` are independently authenticatable; tests mock both, so no real auth is exercised.
- `to_issue_number` (strips `PREFIX-`) is sufficient for both `GH-` and `GL-` refs (out of scope — spec §7.2).
- The PM agent already delivers correctly on GitLab via project config; only the wrapper verification/prompt layers are in scope (NG-3).
- The single-flight, liveness, branch-resolution, resume, and hook machinery are already correct and platform-agnostic (GH-146 evidence).

### 8.3 Open Questions (PM-decided, binding for this plan)

| ID | Decision (binding) | Effect on tests |
|----|--------------------|-----------------|
| OQ-1 | GitLab green-gate positively confirms "no CI configured" via the pipeline API (mirrors `_pr_has_no_checks_configured`); pipelines exist → poll until success/failed | TC-PLAT-030 (no pipelines → green), TC-PLAT-031 (running → poll), TC-PLAT-032 (failed → red) |
| OQ-2 | `build_delivery_prompt` is platform-neutral: "Detect the tracker platform from `.ai/agent/pm-instructions.md` or git remote. Use the project's configured CLI." — not literal platform-specific commands | TC-PLAT-025 (no literal `gh `), TC-PLAT-026 (mentions project config / configured CLI) |
| OQ-3 | `ceo-loop.sh` does **not** need platform detection; only `deliver-ticket.sh` and `batch-deliver.sh` need `detect_platform()` | No `detect_platform` tests target `ceo-loop.sh`; ceo-loop suite remains a pure regression gate (TC-PLAT-043..045 + ceo-loop suite) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-28 | @test-plan-writer | Initial test plan (Proposed) — authored from the GH-148 spec, PM decisions (OQ-1/2/3), `.ai/rules/bash.md` §10–11, the GH-146 test plan (format reference + hardening origin), and direct reads of `deliver-ticket.sh`/`batch-deliver.sh`/existing test files. 51 test cases (TC-PLAT-001..051) cover F-1..F-14 and NFR-1..NFR-8; every AC (AC-F1-1..AC-F14-1) is traced to TC IDs in the coverage matrix. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| (To be populated during execution) | | | |
