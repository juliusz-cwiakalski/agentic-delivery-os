# Change Specification — GH-124

> **Ticket**: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/124
> **Branch**: `feat/GH-124/batch-delivery-infrastructure`
> **Absorbs**: #98, #119, #120, #121

## Problem

The current batch delivery approach (`tmp/batch-delivery.sh` calling `scripts/opencode-session.sh`) has four critical gaps observed during overnight delivery: no liveness watchdog (GH-112 hung 2+ hours), no PR feedback loop (PM can't address review comments or merge on approval), no branch tracking (mismatched branches undetected), and no squash-merge-safe branch cleanup.

## Goals

1. **Liveness-monitored single-ticket delivery** — `scripts/deliver-ticket.sh` wraps `opencode-session.sh` with activity detection, kill-and-restart on 30-min staleness, branch tracking, max 10 restarts, and exit classification.
2. **Batch delivery with pre-flight skip** — `scripts/batch-deliver.sh` runs deliver-ticket.sh sequentially, skips closed/blocked/merged tickets, logs human-readable summaries, supports idempotent restart.
3. **Squash-merge-safe branch cleanup** — `tools/clean-merged-branches` ports the proven PoC, adds flags and protected-branch list.
4. **Session resilience** — `scripts/opencode-session.sh` gains title-based session lookup, branch field in mapping, pending mapping before run.
5. **Push-to-completion PM prompt** — PM checks for open PRs, addresses review comments, squash-merges on GitHub APPROVED review, flags `human-input-needed` when blocked.

## Scope

### In scope

| Component | File(s) | Absorbs |
|---|---|---|
| Branch cleanup tool | `tools/clean-merged-branches`, `tools/.tests/test-clean-merged-branches.sh` | #121 |
| Session enhancements | `scripts/opencode-session.sh` (modified), `scripts/.tests/test-opencode-session.sh` (updated) | #98, #120 |
| Single-ticket orchestrator | `scripts/deliver-ticket.sh`, `scripts/.tests/test-deliver-ticket.sh` | #119 (loop pattern) |
| Batch wrapper | `scripts/batch-deliver.sh`, `scripts/.tests/test-batch-deliver.sh` | new |
| Tool docs | `doc/tools/clean-merged-branches.md` | — |

### Out of scope

- Generic loop runner as standalone tool (future refactor from deliver-ticket.sh)
- Full opencode-session generalization to any agent (future work)
- CEO agent upstream (#118)
- `run-bg` subcommand for opencode-session.sh

## Constraints

- **Bash rules**: Follow `.ai/rules/bash.md` strictly (strict mode, traps, logging, testability patterns, dry-run support).
- **License headers**: `tools/clean-merged-branches` needs header via `scripts/add-header-location.sh`. `scripts/*.sh` are repo-internal (no header).
- **`scripts/` + `tools/` changes are CEO-gated** per repo convention.
- **Feature branch from latest main**: Always `git fetch --prune origin && git checkout main && git pull --ff-only origin main` before creating a feature branch.
- **Squash-merge authorization**: PM is authorized to merge when ANY ONE approval signal is present: GitHub-native APPROVED review, `approved` label on the ticket issue, or LGTM comment by the PR author (when `DELIVER_ALLOW_LGTM_COMMENT=true`). See the autonomous batch delivery guide for the full trust boundary.

## Acceptance criteria

### AC-1: clean-merged-branches tool
- AC-1.1: `tools/clean-merged-branches` exists (PATH-able, no `.sh`), English, with `--base`, `--dry-run`, `--protected`, `--allow-dirty` flags.
- AC-1.2: Deletes ancestry-merged AND content-identical branches; never deletes protected branches; restores original branch when possible.
- AC-1.3: `tools/.tests/test-clean-merged-branches.sh` passes: clean-tree guard, ancestry-merged delete, content-identical delete, protected-branch skip, dry-run, original-branch restore.
- AC-1.4: License header applied.

### AC-2: opencode-session.sh enhancements
- AC-2.1: `find_session_by_title()` finds an existing session by title string from `opencode session list`.
- AC-2.2: Session resolution order: mapping → title-based lookup → create new.
- AC-2.3: Mapping JSON includes `title`, `branch`, `status`, `restart_count` fields (additive, backward-compatible).
- AC-2.4: Pending mapping written before `opencode run` starts.
- AC-2.5: No regression in `run`, `list`, `show`, `forget`, `list-sessions` commands.
- AC-2.6: `scripts/.tests/test-opencode-session.sh` updated and passing.

### AC-3: deliver-ticket.sh
- AC-3.1: Accepts `GH-112`, `GH-112:feat/branch`, or `GH-112 feat/branch` input formats.
- AC-3.2: Branch mismatch detection: warns and uses recorded branch from mapping.
- AC-3.3: Liveness loop: detects staleness (no activity 30 min), kills (SIGTERM → grace → SIGKILL), restarts.
- AC-3.4: Session resume by title on restart (finds existing session, resumes with `--session <id>`).
- AC-3.5: Max 10 restarts; exits with failure report if exceeded.
- AC-3.6: Exit classification: blocked / merged / pr-open / failed / max-restarts.
- AC-3.7: `scripts/.tests/test-deliver-ticket.sh` passes.

### AC-4: batch-deliver.sh
- AC-4.1: Accepts list of tickets, `<ticket>:<branch>` pairs, or `--tickets-file`.
- AC-4.2: Pre-flight: skips closed tickets, blocked tickets (human-input-needed label), merged PRs.
- AC-4.3: Calls `deliver-ticket.sh` sequentially; calls `clean-merged-branches` between tickets.
- AC-4.4: Summary log with timestamps, durations, and result per ticket.
- AC-4.5: Idempotent restart (re-running skips already-done tickets).
- AC-4.6: `scripts/.tests/test-batch-deliver.sh` passes.

### AC-5: PM delivery prompt
- AC-5.1: Prompt instructs PM to check for open PR and address comments / merge on approval / continue delivery / flag blocked.
- AC-5.2: Prompt is identical on every start/resume (state detection at top).
- AC-5.3: `human-input-needed` label workflow: PM adds label, adds comment, stops.

### AC-6: Tests pass
- AC-6.1: All test scripts pass: `bash tools/.tests/test-clean-merged-branches.sh`, `bash scripts/.tests/test-opencode-session.sh`, `bash scripts/.tests/test-deliver-ticket.sh`, `bash scripts/.tests/test-batch-deliver.sh`.
- AC-6.2: Existing repo tests still pass (no regressions): `bash scripts/.tests/test-doc-distribution.sh`.

## Dependencies

- **None blocking** — builds on existing `scripts/opencode-session.sh` (commit e8a66a1 on main).
