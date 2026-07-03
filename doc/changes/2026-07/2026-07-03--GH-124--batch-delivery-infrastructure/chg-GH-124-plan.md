# Implementation Plan — GH-124

> **Spec**: `chg-GH-124-spec.md`
> **Branch**: `feat/GH-124/batch-delivery-infrastructure`
> **Bash rules**: `.ai/rules/bash.md` (STRICT)

## Phase 1: `tools/clean-merged-branches` (standalone)

### Tasks
- [x] Read PoC: `/home/juliusz/git/cwiakalski-priv/cwiakalski-web-page/scripts/workstation/git-clean-merged-branches.sh`
- [x] Read `.ai/rules/bash.md` for bash coding standards
- [x] Read `doc/guides/tools-convention.md` for tools/ naming/structure
- [x] Create `tools/clean-merged-branches` (no `.sh`, executable, English, license header):
  - Clean-tree guard (refuse if `git status --porcelain` non-empty); `--allow-dirty` to override
  - Save current branch (`git symbolic-ref --short HEAD`)
  - `git checkout <base>`, `git pull origin <base>`, `git fetch --prune origin`
  - Delete ancestry-merged branches: `git branch --merged origin/<base> | grep -v '^\* ' | grep -v '<base>'`
  - Delete content-identical branches: `git diff <base>..<branch>` is empty → `git branch -D`
  - Protected branches: `main`, `master`, `develop` + `--protected` comma-separated list; never delete
  - `--base <branch>` (default `main`)
  - `--dry-run` (list, don't delete)
  - `--color` flag for colored output (off by default)
  - Restore original branch if it still exists; else stay on base
  - Strict mode (`set -Eeuo pipefail`), ERR trap with line context, logging with `[INFO]`/`[WARN]` tag
  - Testable main guard (`if [[ "${BASH_SOURCE[0]}" == "$0" ]]`)
- [x] Create `tools/.tests/test-clean-merged-branches.sh`:
  - TC-CMB-01: clean-tree guard — refuses with dirty tree (creates temp git repo)
  - TC-CMB-02: ancestry-merged delete — branch with ancestry to main is deleted
  - TC-CMB-03: content-identical delete — branch with empty diff vs main is deleted (squash-merge case)
  - TC-CMB-04: protected-branch skip — main/master/develop never deleted
  - TC-CMB-05: dry-run — lists but doesn't delete
  - TC-CMB-06: original-branch restore — returns to original branch after cleanup
- [x] Run `scripts/add-header-location.sh tools` for license header
- [x] Run `bash tools/.tests/test-clean-merged-branches.sh` — fix until all pass (11/11 PASS)
- [x] Commit: `feat(tools): add clean-merged-branches — squash-merge-safe branch cleanup` (commit d60aed2)

## Phase 2: `scripts/opencode-session.sh` enhancements

### Tasks
- [x] Read current `scripts/opencode-session.sh` (already on main, commit e8a66a1)
- [x] Read current `scripts/.tests/test-opencode-session.sh`
- [x] Add `find_session_by_title()`:
  - Query `opencode session list --format json`
  - Filter by `.title == $title`
  - Return first matching session ID (or empty)
  - Degrade gracefully on opencode errors (return empty)
- [x] Update `run_ticket_session()` session resolution:
  1. Check mapping file for session_id → verify alive → resume
  2. **NEW**: If mapping stale/missing → `find_session_by_title "ticket-${ticket_ref}"` → if found, update mapping, resume
  3. If not found → create new with `--title ticket-${ticket_ref}`
- [x] Add `branch` field to mapping JSON:
  - `save_mapping()` accepts optional branch parameter
  - Mapping JSON includes `"branch": "<branch>"` or `"branch": null`
- [x] Add `title` field to mapping JSON: `"title": "ticket-${ticket_ref}"`
- [x] Add `status` field: `"pending"` before run, `"in_progress"` when session detected, `"done"` on clean exit
- [x] Add `restart_count` field: initialized to 0, incremented by deliver-ticket.sh
- [x] Write pending mapping before `opencode run`:
  - Before starting new session: `save_mapping` with `status: "pending"`, `session_id: null`
  - After session detected (title lookup within 10s of start): update with real session_id and `status: "in_progress"`
- [x] Update `scripts/.tests/test-opencode-session.sh`:
  - TC-OS-14: find_session_by_title returns matching session ID
  - TC-OS-15: find_session_by_title returns empty on no match
  - TC-OS-16: mapping JSON includes branch field
  - TC-OS-17: pending mapping written before run
  - TC-OS-18: title-based resume path (mapping stale → title lookup finds session)
- [x] Run `bash scripts/.tests/test-opencode-session.sh` — fix until all 21 tests pass (13 original + 8 new)
- [x] Commit: `feat(scripts): opencode-session.sh — title-based session lookup, branch tracking, pending mapping` (commit dbd9f6f)

## Phase 3: `scripts/deliver-ticket.sh` (new)

### Tasks
- [x] Read CEO loop reference: `/home/juliusz/git/hackathon/julek-experiment/scripts/ceo-loop.sh` (liveness pattern)
- [x] Read current `scripts/opencode-session.sh` (API to call)
- [x] Create `scripts/deliver-ticket.sh`:
  - **Input parsing**: `GH-112`, `GH-112:feat/branch`, or `GH-112 feat/branch`
    - Split on `:` for colon syntax; validate ticket ref format
  - **Branch resolution**:
    1. Read mapping `.ai/local/opencode-sessions/<ticket>.json`
    2. If mapping has `branch` → use it; if arg branch differs → WARN, use recorded
    3. If no mapping + branch arg → use provided
    4. If no mapping + no branch → prepare main (fetch, checkout, pull --ff-only), let PM create branch
    5. Always: if creating from main, `git fetch --prune origin && git checkout main && git pull --ff-only origin main` first
  - **Liveness loop** (max `DELIVER_MAX_RESTARTS` iterations, default 10):
    - Build delivery prompt (see spec AC-5 for full prompt text)
    - Session resolution: mapping → title lookup → create new
    - If session found: `opencode run --session <id> "<prompt>"` (resume)
    - If no session: `opencode run --agent pm --title ticket-<ref> "<prompt>"` (new)
    - Start opencode via `setsid` in background; poll `opencode session list` for ID; save mapping
    - **Activity monitoring** (every `DELIVER_POLL_SECONDS`, default 60):
      - `activity_epoch = max(git_last_commit_epoch, worktree_mtime_epoch, doc/changes_mtime_epoch)`
      - Exclude `.git`, `tmp`, `.ai/local`, `.idea` from worktree scan
      - If activity increased → reset stuck timer, log
      - If no activity for `DELIVER_STUCK_MINUTES` (default 30) → kill (SIGTERM → 20s grace → SIGKILL), increment restart_count, loop
    - On opencode exit (not killed):
      - Check `gh issue view <ticket> --json state,labelNames`
      - If CLOSED → exit 0 "merged/closed"
      - If has `human-input-needed` label → exit 0 "blocked"
      - Check `gh pr list --head <branch> --state open` → if PR → exit 0 "pr-open"
      - Check merged PR → if found → exit 0 "merged"
      - If iterations remain → restart; else exit 1 "max-restarts"
  - **Logging**: `[HH:MM:SS] ▶ START / ℹ info / ⚠ warn / ✓ done / ✗ failed`
  - **Flags**: `-h/--help`, `--version`, `--dry-run`, `-v/--verbose`, `--stuck-minutes <n>`, `--max-restarts <n>`
  - Strict mode, ERR trap, testable main guard
- [x] Create `scripts/.tests/test-deliver-ticket.sh`:
  - TC-DT-01: input parsing — `GH-112` → ticket=GH-112, branch=""
  - TC-DT-02: input parsing — `GH-112:feat/branch` → ticket=GH-112, branch="feat/branch"
  - TC-DT-03: branch mismatch warning — mapping has branch A, arg has branch B → warns, uses A
  - TC-DT-04: branch resolution from mapping — no arg, mapping has branch → uses mapping branch
  - TC-DT-05: stale detection — mock activity_epoch to not increase → triggers kill after threshold
  - TC-DT-06: max-restarts — mock 10 failed iterations → exits with "max-restarts"
  - TC-DT-07: exit classification mock — ticket has human-input-needed → exits "blocked"
  - TC-DT-08: prompt generation — contains ticket ref, branch, push-to-completion language
- [x] Run `bash scripts/.tests/test-deliver-ticket.sh` — fix until all pass (23/23 PASS)
- [x] Commit: `feat(scripts): add deliver-ticket.sh — liveness-monitored single-ticket orchestrator`

## Phase 4: `scripts/batch-deliver.sh` (new)

### Tasks
- [x] Create `scripts/batch-deliver.sh`:
  - **Input parsing**:
    - Positional args: `GH-108 GH-110 GH-37` (tickets without branches)
    - Colon syntax: `GH-108:fix/branch GH-110:feat/branch` (ticket:branch pairs)
    - Mixed: `GH-108:fix/branch GH-110 GH-37`
    - `--tickets-file <path>`: one ticket or ticket:branch per line
  - **Pre-flight per ticket** (before calling deliver-ticket.sh):
    - `gh issue view <ticket> --json state` → if CLOSED → log SKIP, continue
    - Check labels for `human-input-needed` → if present → log SKIP (blocked), continue
    - `gh pr list --search "<ticket>" --state closed --json mergedAt` → if merged → log SKIP, continue
  - **Sequential execution**:
    - Record start time
    - Call `scripts/deliver-ticket.sh "<ticket>:<branch>"` — blocks until done
    - Record end time, compute duration
    - Classify result: merged / pr-open / blocked / failed (from exit code + GitHub state)
    - Call `tools/clean-merged-branches` if it exists (between tickets)
  - **Summary logging** (stdout + `tmp/batch-deliver-summary.log`):
    - Per-ticket: `[HH:MM:SS] [N/M] ▶ START / ✓ DONE / ⊘ SKIP / ⏸ BLOCKED / ✗ FAILED <ticket> — <detail> (<duration>)`
    - Final: `═══ Batch complete: N tickets in <total-duration> ═══` + result counts
  - **Idempotent restart**: safe to re-run; skips already-done tickets
  - **Flags**: `-h/--help`, `--version`, `--dry-run`, `-v/--verbose`, `--tickets-file <path>`
  - Strict mode, ERR trap, testable main guard
- [x] Create `scripts/.tests/test-batch-deliver.sh`:
  - TC-BD-01: ticket parsing — positional args → array of {ticket, branch?}
  - TC-BD-02: ticket parsing — colon syntax → ticket + branch extracted
  - TC-BD-03: ticket parsing — mixed positional + colon
  - TC-BD-04: skip-merged — mock gh to return merged PR → SKIP
  - TC-BD-05: skip-blocked — mock gh to return human-input-needed label → SKIP
  - TC-BD-06: skip-closed — mock gh to return CLOSED state → SKIP
  - TC-BD-07: duration formatting — seconds → "45m 23s" or "1h 2m"
  - TC-BD-08: summary output format — contains counts and per-ticket lines
- [x] Run `bash scripts/.tests/test-batch-deliver.sh` — fix until all pass (15/15 PASS)
- [x] Commit: `feat(scripts): add batch-deliver.sh — sequential batch delivery with pre-flight skip`

## Phase 5: Docs + integration

### Tasks
- [x] Create `doc/tools/clean-merged-branches.md` — usage, flags, examples
- [x] Verify all test scripts pass together:
  - `bash tools/.tests/test-clean-merged-branches.sh` — 11/11 PASS
  - `bash scripts/.tests/test-opencode-session.sh` — 21/21 PASS
  - `bash scripts/.tests/test-deliver-ticket.sh` — 23/23 PASS
  - `bash scripts/.tests/test-batch-deliver.sh` — 15/15 PASS
  - `bash scripts/.tests/test-doc-distribution.sh` — OK (no drift, 76 in-scope docs)
- [x] Add `ados_distribution: redistributable` to `doc/tools/clean-merged-branches.md` frontmatter
- [x] Commit: `docs(GH-124): add clean-merged-branches tool documentation`
- [x] Final commit if needed for any integration fixes (none needed)

## Acceptance criteria validation

### AC-1: clean-merged-branches tool — PASSED
- AC-1.1: `tools/clean-merged-branches` exists, PATH-able, no `.sh`, English, with `--base`, `--dry-run`, `--protected`, `--allow-dirty` flags — PASSED
- AC-1.2: Deletes ancestry-merged AND content-identical branches; protected branches never deleted; restores original branch — PASSED (commit d60aed2)
- AC-1.3: `tools/.tests/test-clean-merged-branches.sh` passes (11/11) — PASSED
- AC-1.4: License header applied via `scripts/add-header-location.sh` — PASSED

### AC-2: opencode-session.sh enhancements — PASSED
- AC-2.1: `find_session_by_title()` queries `opencode session list` and filters by title — PASSED (commit dbd9f6f)
- AC-2.2: Session resolution order: mapping → title lookup → create new — PASSED
- AC-2.3: Mapping JSON includes `title`, `branch`, `status`, `restart_count` — PASSED
- AC-2.4: Pending mapping written before `opencode run` starts — PASSED
- AC-2.5: No regression in `run`, `list`, `show`, `forget`, `list-sessions` — PASSED
- AC-2.6: `scripts/.tests/test-opencode-session.sh` updated and passing (21/21) — PASSED

### AC-3: deliver-ticket.sh — PASSED
- AC-3.1: Accepts `GH-112`, `GH-112:feat/branch` formats — PASSED (commit 3b02eb9)
- AC-3.2: Branch mismatch detection with warning — PASSED
- AC-3.3: Liveness loop with staleness kill and restart — PASSED
- AC-3.4: Session resume by title on restart — PASSED
- AC-3.5: Max 10 restarts with failure exit — PASSED
- AC-3.6: Exit classification (blocked/merged/pr-open/failed/max-restarts) — PASSED
- AC-3.7: `scripts/.tests/test-deliver-ticket.sh` passes (23/23) — PASSED

### AC-4: batch-deliver.sh — PASSED
- AC-4.1: Accepts positional tickets, `ticket:branch` pairs, `--tickets-file` — PASSED (commit dd7c019)
- AC-4.2: Pre-flight skip: closed, blocked, merged tickets — PASSED
- AC-4.3: Calls deliver-ticket.sh sequentially; calls clean-merged-branches between tickets — PASSED
- AC-4.4: Summary log with timestamps, durations, per-ticket results — PASSED
- AC-4.5: Idempotent restart — PASSED
- AC-4.6: `scripts/.tests/test-batch-deliver.sh` passes (15/15) — PASSED

### AC-5: PM delivery prompt — PASSED
- AC-5.1: Prompt checks for open PR, addresses comments, merges on APPROVED review, continues delivery, flags blocked — PASSED
- AC-5.2: Prompt is identical on every start/resume (state detection at top) — PASSED
- AC-5.3: `human-input-needed` label workflow — PASSED
- AC-5.4: Multi-signal approval detection for solo-developer mode — any ONE of (a) GitHub-native APPROVED review, (b) `approved` label on the ticket, (c) LGTM comment on the PR authorizes squash-merge; prompt auto-creates the `approved` label — PASSED (TC-DT-08f, TC-DT-08g; deliver-ticket tests 25/25)

### AC-6: Tests pass — PASSED
- AC-6.1: All test scripts pass (11 + 21 + 23 + 15 = 70 tests) — PASSED
- AC-6.2: No regressions — `test-doc-distribution.sh` OK (76 in-scope docs, no drift) — PASSED

## Execution log

- **Phase 1** (commit d60aed2): `tools/clean-merged-branches` + tests (11/11)
- **Phase 2** (commit dbd9f6f): `scripts/opencode-session.sh` enhancements + tests (21/21)
- **Phase 3** (commit 3b02eb9): `scripts/deliver-ticket.sh` + tests (23/23)
- **Phase 4** (commit dd7c019): `scripts/batch-deliver.sh` + tests (15/15)
- **Phase 5** (this commit): `doc/tools/clean-merged-branches.md` + full test suite verification (70/70 pass, 0 regressions)
- **Post-completion fix** (this commit): `scripts/deliver-ticket.sh` prompt — multi-signal approval detection (APPROVED review / `approved` label / LGTM comment) for solo-developer mode; auto-creates `approved` label; added TC-DT-08f/08g (deliver-ticket 25/25, opencode-session 21/21 regression-clean)
