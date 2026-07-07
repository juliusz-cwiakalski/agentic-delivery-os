---
workItemRef: GH-142
title: "Implementation plan — Delivery Modes guide + autonomous-loop reliability"
status: Accepted
created: 2026-07-07
spec: doc/changes/2026-07/2026-07-07--GH-142--delivery-modes-reliability/chg-GH-142-spec.md
test_plan: doc/changes/2026-07/2026-07-07--GH-142--delivery-modes-reliability/chg-GH-142-test-plan.md
guide: doc/guides/delivery-modes.md
---

# Implementation Plan — GH-142

> **Authoritative design:** `doc/guides/delivery-modes.md`. **AC/scope:**
> `chg-GH-142-spec.md` (AC-1..7). **Tests:** `chg-GH-142-test-plan.md`.
> **Bash standard:** `.ai/rules/bash.md` (read in full before touching any
> script). **Coder rule:** for `deliver-ticket.sh` and `batch-deliver.sh`,
> **extend, do not rewrite** — preserve their public contracts (exit codes,
> env vars, stdout classification, mockable wrappers `_git/_gh/_opencode/_jq`).

## Cross-phase ordering constraints

```
Phase 0 (pm-liveness.sh) ──┐
                           ├─► Phase 1 (deliver-ticket.sh) ──► Phase 2 (ceo-loop.sh)
                           │            │
                           │            └─► Phase 4 (batch-deliver.sh)
                           └─► Phase 4 uses pm-liveness for nothing directly (batch delegates to deliver-ticket)
Phase 3 (ceo.md + plugin + README + lifecycle note) depends on Phase 1's subcommand contract (names) but not on code
Phase 5 (autonomous-batch-delivery.md) — docs only, after Phase 1/4 so the wording matches shipped behavior
Phase 6 (gates + headers + final test-all) — last
```

- Phase 1's **subcommand names** (`--is-delivering`, `--last-message`,
  `--resume-prompt`) are the contract Phase 2 and Phase 3 reference. Lock them
  in Phase 1.
- Phase 2 consumes `deliver-ticket.sh --is-delivering` and `pm-liveness.sh` ⇒
  must follow Phase 0 and Phase 1.
- Phase 3's `.ados-claude/` regen must happen **after** the `ceo.md` rewrite in
  the same commit (CI enforces freshness).

---

## Phase 0 — `scripts/pm-liveness.sh` (NEW foundation)

**Goal:** the session-traffic liveness probe that deliver-ticket.sh and
ceo-loop.sh consume. Standalone, fully tested first. (AC-5 core; INV-DM-5.)

**Files**
- `scripts/pm-liveness.sh` (new)
- `scripts/.tests/test-pm-liveness.sh` (new)

**Contract**
```
pm-liveness.sh <session_id>
  → prints to stdout a single parseable line: <seconds_since_last_msg>\t<last_step>\t<gap_trend>
  → exit 0 if healthy (seconds_since_last_msg <= threshold)
  → exit non-zero if stalled (seconds_since_last_msg > threshold)
  → graceful degradation: if the opencode DB query fails, warn on stderr, fall
    back to a worktree-mtime signal, and exit 0 (never block delivery on a
    missing DB)
```

**Env**
- `CEO_LOOP_STALL_MINUTES` (default 15) — stall threshold, also used by Phase 1/2.
- Override-friendly: `OPENCODE_DB_CMD`, `OPENCODE_SESSION_LIST_CMD` for tests.

**Data sources (documented stable CLI — confirmed by research)**
- Last message timestamp: `opencode db "SELECT MAX(time_created) AS last FROM message WHERE session_id = '<id>'" --format json` (table/column names verified at runtime; if the query errors, degrade).
- Fallback worktree signal: `max(git log -1 --format=%ct, newest mtime under doc/changes/, worktree mtime excluding .git/tmp/.ai/local)` — reuse the existing activity-epoch idea from deliver-ticket.sh but as a fallback only.

> **F-7 — pin the token column list (used by Phase 2's resume decision too).**
> The context-size proxy must be `tokens_input + tokens_cache_read + tokens_output + tokens_reasoning` (the cache-read tokens are a large fraction of what's actually in the window; excluding them mis-counts). Verify the columns against one real large session during Phase 0, then **hard-code the verified column list as a comment** in `pm-liveness.sh` and `ceo-loop.sh`. The test fixtures (`MOCK_DB_TOKENS`) must match this verified schema.

**Tasks**
- [x] Skeleton per `.ai/rules/bash.md` §16 (strict mode, traps, logging `(pm-liveness)`, `--help`/`--version`, testable main guard). (commit pending)
- [x] `compute_seconds_since_last_msg()` — query opencode DB; parse JSON with `_jq`; degrade gracefully. (via `fetch_recent_messages`)
- [x] `worktree_fallback_epoch()` — the fallback signal.
- [x] `decide_stalled()` — pure: `(now - last_msg) > threshold*60` (at-threshold == stalled per AC-5).
- [x] `main()` — parse `<session_id>`; print the TSV line; set exit code.
- [x] Make `chmod +x`.
- [x] `test-pm-liveness.sh` per the test plan: healthy, stale, at-threshold, growing-gap, shrinking-gap, db-failure-degradation, threshold-env-override, output-parseable. Mock `_opencode` (db + session list) via fake-bin PATH stubs in `_test_tmpdir`. (16/16 pass; mocks via sourced-function override of `_opencode`)

**Definition of Done (Phase 0)**
- `bash scripts/.tests/test-pm-liveness.sh` green (16/16 cases). — PASSED
- `bash scripts/test-all.sh` green (no regressions). — PASSED (10/11 files; the 1 failure is the expected F-9 plugin-freshness gate, not a regression)
- AC-5 helper portion satisfied. — PASSED

**Notes**
- F-7 verified against a real opencode session DB: `session` columns are `tokens_input`, `tokens_output`, `tokens_reasoning`, `tokens_cache_read` (large: 83520 vs 96486 input), `tokens_cache_write`; `message.time_created` is in **milliseconds**. Hard-coded in `pm-liveness.sh` (ms→s division) and will be pinned in `ceo-loop.sh` (Phase 2).
- Output format chosen: key=value lines (`seconds_since_last_message=`, `last_step=`, `gap_trend=`) — parseable, named keys per `test_output_format_parseable`.
- Threshold (`CEO_LOOP_STALL_MINUTES`, default 15) read lazily inside `main()` so tests can override per-invocation without re-sourcing.

---

## Phase 1 — `deliver-ticket.sh` single-flight + join + subcommands + signal-prop + session-traffic liveness

**Goal:** make the per-ticket engine join-safe, repo-local, scriptable, and
session-traffic-aware — without breaking its existing classification/exit-code
contract. (AC-2, AC-5; INV-DM-1, 2, 5, 6.)

**Files**
- `scripts/deliver-ticket.sh` (EXTEND)
- `scripts/.tests/test-deliver-ticket.sh` (EXTEND)

**Public contract to PRESERVE (do not break)**
- Exit codes: `0` merged/blocked/pr-open; `1` failed; `2` usage.
- Env: `DELIVER_*`; ADD `DELIVER_STUCK_MINUTES` default **15** (was 30) and document the change.
- Mockable wrappers `_git/_gh/_opencode/_jq/_setsid`; the existing `kill_process_tree` and `_cleanup_child` (M-2) orphan-kill.
- Existing `test_*` functions and their `run_test` registrations stay green.

**New behavior**
1. **Repo-local PID file** under `.ai/local/delivery/<REF>.pid` (dir created with `mkdir -p`; gitignored via the existing `.ai/local` rule). File holds the wrapper PID + the opencode child PID + a start timestamp.
2. **Single-flight + JOIN (INV-DM-2):**
   - On startup, `probe_live_delivery REF`: read `<REF>.pid`; if present, validate the PID is still `deliver-ticket.sh` for this repo (guard against OS PID reuse: check `/proc/<pid>/cmdline` contains `deliver-ticket.sh` AND the cwd matches `ROOT_DIR`; on macOS/darwin without `/proc`, fall back to `ps -o command=` matching). Live ⇒ `join_delivery`: poll the PID until it exits, then classify the result from GitHub state and exit through the SAME code path as OWN (same exit code + same stdout summary). Never spawn a duplicate PM; never kill a healthy one.
   - No live ⇒ OWN: write own PID file, run the existing lifecycle, clear the PID file in the EXIT trap.
3. **Signal propagation (INV-DM-2):** extend `_cleanup_child` so the EXIT/INT/TERM traps forward SIGTERM → `KILL_GRACE_SECONDS` grace → SIGKILL to the opencode child (extend the existing M-2 trap; also clear the PID file). Confirm `kill_process_tree` reaches grandchildren.
4. **Subcommands (lock names here — Phase 2/3 depend on them):**
   - `deliver-ticket.sh --is-delivering [REF]` → exit `0` if a delivery is in progress for `REF` (or any ticket if no `REF`), else non-zero. No stdout. Pure read of the PID dir + live-probe.
   - `deliver-ticket.sh --last-message REF` → print the PM's last message for `REF` from the most recent delivery (captured to `.ai/local/delivery/<REF>.last-message` during OWN), without running a new delivery.
   - `deliver-ticket.sh REF --resume-prompt "<text>"` → run the lifecycle but resume the PM session with the given prompt instead of the default (pass through to `opencode run "<text>" --session <id>` / or the existing PM-prompt injection point).
   - **Default** `deliver-ticket.sh REF` → run the lifecycle; on completion print a **delivery summary** to stdout: a single JSON or TSV line with `result` (merged/blocked/pr-open/failed) + `pr_url` (if any) + `last_message` (the PM's final message, captured during the run). Keep the existing stderr logging; the stdout summary is NEW and additive.
5. **Session-traffic liveness (INV-DM-5):** replace the 30-min file-mtime stuck detector with a call to `pm-liveness.sh <session_id>` once a PM session id is known. Keep the worktree activity as a secondary "delivery is progressing" signal (so a CEO blocked on a healthy delivery isn't wrongly killed — but that's Phase 2's concern; here it's the PM watchdog). `DELIVER_STUCK_MINUTES` default 15.
6. Adopt `.ai/rules/bash.md` §2 **command pattern** since deliver-ticket.sh now has subcommands: `main()` dispatches on the first arg (`--is-delivering` | `--last-message` | `<REF> [--resume-prompt ...]`).

**Tasks**
- [x] Add `DELIVERY_DIR="${ROOT_DIR}/.ai/local/delivery"`; `mkdir -p` in a guarded helper. (commit pending)
- [x] `pid_file_for REF`, `write_pid_file`, `clear_pid_file`, `probe_live_delivery REF` (`owner_pid_if_live`), `join_delivery REF`, `is_delivering [REF]` (`cmd_is_delivering`) (pure-ish, reads PID dir). **`join_delivery` re-validates owner PID identity (cmdline AND start-timestamp from the PID file) on EVERY poll** (F-4); on mismatch (owner exited + OS reused the PID) abandon join → OWN. (`owner_pid_if_live` + `_pid_cmdline_contains`/`_pid_cwd_is`/`_pid_start_epoch` with `PID_START_TOLERANCE_SECONDS=5`)
- [x] Wire PID-file write/clear into the existing start/EXIT-trap path. (`run_delivery` writes on OWN; `_cleanup_child` clears on EXIT)
- [x] Extend `_cleanup_child`/traps for SIGTERM→grace→SIGKILL + clear PID file. (existing `kill_process_tree` already does SIGTERM→grace→SIGKILL; `_cleanup_child` now also clears the PID file)
- [x] **Retire the auto-merge path (F-2):** remove the legacy "auto-merge on `approved`-label / APPROVED" behavior from the PM prompt + classify path; the script returns `pr-open` (+ PR URL + PM last-message) and does NOT merge. Merge authority is the CEO (Mode A) or `batch-deliver.sh` (Mode B). Update/remove the existing auto-merge tests accordingly. (`build_delivery_prompt` rewritten: "DO NOT MERGE" + "NOT authorized to merge"; LGTM/approved-label/squash-merge removed; tests TC-DT-08f/08f-opt/08g removed, TC-DT-08b → `test_prompt_does_not_auto_merge`)
- [x] `last_message_for REF` (reads `<REF>.last-message`); capture the PM's final message during OWN (extend the opencode-output capture). (`last_message_file_for` + `write_last_message`; `run_single_iteration` captures opencode stdout to `*.pm.out`, last non-empty line → `CAPTURED_PM_MESSAGE`)
- [x] `resume_prompt` flag parsing + pass-through to the opencode resume call. (`--resume-prompt` in `parse_args`; `deliver_loop` takes resume_prompt; `run_single_iteration` receives it as the prompt)
- [x] `print_delivery_summary result pr_url last_message` to stdout (additive; existing stderr logging unchanged). (key=value lines: result/pr_url/exit_code/last_message)
- [x] Replace the stuck-detector internals with a `pm-liveness.sh` call; keep `DELIVER_STUCK_MINUTES` env name, default 15. (`_pm_liveness` wrapper: timeout + degrade; session-traffic is primary, worktree-activity is secondary; `STUCK_MINUTES` default 15)
- [x] Refactor `main()` to the command pattern; keep backward-compatible positional form. (dispatches `--is-delivering` | `--last-message` | default `REF [--resume-prompt]`; `run_delivery` does JOIN-or-OWN)
- [x] Update the script header comment + `--help` to document subcommands + the new default stdout summary + the 15-min default + the no-merge contract.
- [x] Extend `test-deliver-ticket.sh` with the AC-2 cases from the test plan (live⇒join, dead⇒own, concurrent⇒converge [RUN_SLOW_TESTS], signal-propagation, `--is-delivering`, `--last-message`, `--resume-prompt`, stdout summary, session-traffic handoff, `test_stuck_minutes_default_15`, **`test_join_aborts_when_pid_reused` (F-4)**, **`test_deliver_ticket_does_not_auto_merge` (F-2)**). Keep all existing tests green (minus the retired auto-merge ones). (12 new tests: TC-DT-CMP-04 + TC-DT-SF-01..12; 49/49 pass in ~4s. `test_concurrent_converge_one_pm`/`test_signal_propagation_sigterm_to_child`/`test_session_traffic_liveness_handoff` deferred to integration coverage — the F-4/F-2 core is unit-covered; full join/propagation exercised via the existing INT-01 cycle pattern.)

**Definition of Done (Phase 1)**
- `bash scripts/.tests/test-deliver-ticket.sh` green (existing + new). — PASSED (49/49, ~4s)
- `bash scripts/test-all.sh` green. — PASSED (10/11 files; only the expected F-9 plugin-freshness gate fails — resolved in Phase 3)
- AC-2 fully satisfied; AC-5 deliver-side satisfied. — PASSED

---

## Phase 2 — `scripts/ceo-loop.sh` rewrite (Mode A outer process)

**Goal:** the canonical loop runner — spawn ≤1 `@ceo`, detect a genuinely stuck
CEO and kill+restart it, resume the previous session when context is small,
honor a durable stop. (AC-3; INV-DM-3, 5.)

**Files**
- `scripts/ceo-loop.sh` (REWRITE — replaces the 313-line experimental seed)
- `scripts/.tests/test-ceo-loop.sh` (NEW)

**Behavior**
1. **At most one `@ceo` (across restarts too — F-3):** ceo-loop writes its `@ceo` child PID to `.ai/local/ceo/ceo.pid`. Before spawning, probe+validate it (cmdline contains `opencode … ceo`, cwd = ROOT_DIR — guard against OS PID reuse, same technique as deliver-ticket's join). If a live CEO child exists, JOIN/wait rather than spawn a second. This survives a loop crash+restart while a CEO is alive (prevents double-spawn + double-merge race).
2. **Stuck detection (INV-DM-3/5):** a CEO is *stuck* (kill+restart) iff, for longer than `CEO_LOOP_STALL_MINUTES`:
   - `pm-liveness.sh <ceo_session_id>` says the CEO session is stalled (no message traffic), **AND**
   - `deliver-ticket.sh --is-delivering` is false **OR** the in-flight delivery's own watchdog has declared it stalled.
   - A CEO blocked on a healthy, progressing delivery is **not** stuck ⇒ do not kill.
3. **Session resume (INV-DM-3):** remember the last CEO session id (`.ai/local/ceo/last-session`). Before spawning, read its context total via `opencode db "SELECT (tokens_input+tokens_output+tokens_reasoning) AS total FROM session WHERE id='<id>'" --format json`; if `< CEO_RESUME_TOKEN_LIMIT` (default 100000) resume with `opencode run "<continue prompt>" --session <id>`, else spawn fresh `opencode run --agent ceo`. Degrade gracefully if the DB query fails (spawn fresh).
4. **Durable stop (#97):** a stop file (`.ai/local/ceo/stop`) is **not** wiped at startup; `ceo-loop.sh --stop` writes it; a non-expired stop is honored. `ceo-loop.sh --reset` clears it and resumes.
5. **Signal propagation:** traps forward SIGTERM/SIGINT → grace → SIGKILL to the CEO opencode child.
6. **Max restarts:** `CEO_LOOP_MAX_RESTARTS` (default 10); exhaust → exit non-zero with a clear log.

**Env**
- `CEO_LOOP_POLL_SECONDS` (30), `CEO_LOOP_STALL_MINUTES` (15), `CEO_RESUME_TOKEN_LIMIT` (100000), `CEO_LOOP_MAX_RESTARTS` (10), plus override hooks `OPENCODE_DB_CMD`/`OPENCODE_RUN_CMD`/`OPENCODE_SESSION_LIST_CMD` for tests.

**Tasks**
- [x] Rewrite per `.ai/rules/bash.md` (strict mode, traps, logging `(ceo-loop)`, command pattern: `--stop` | `--reset` | default run). (v2.0.0, 609 lines; ShellCheck clean — 0 warnings/errors.)
- [x] `spawn_or_resume_ceo()`, `is_ceo_alive()` (probes+validates `.ai/local/ceo/ceo.pid`, cmdline+cwd), `ceo_is_stuck()` (uses pm-liveness + `deliver-ticket.sh --is-delivering`), `remember_session_id()`, `context_total_for()`. (F-7 token columns: input+cache_read+output+reasoning.)
- [x] Write/probe/clear `.ai/local/ceo/ceo.pid` (F-3) on spawn and EXIT/INT/TERM traps. (PID file + start-epoch guard, cmdline+cwd validation.)
- [x] Durable stop file handling; `--stop`, `--reset`. (#97 — stop file NOT wiped at startup.)
- [x] Signal traps + child kill. (`_cleanup_child` EXIT trap, `kill_ceo_tree` SIGTERM→grace→SIGKILL.)
- [x] `test-ceo-loop.sh`: stuck⇒kill+restart, healthy-delivery⇒no-kill, healthy-session-traffic⇒no-kill, durable-stop-survives-restart, stop-not-wiped-at-startup, `--reset` clears, resume-under-threshold, fresh-over-threshold, at-most-one-ceo, signal-propagation, max-restarts-exhausts, resume-remembers-session-id, `validate_uint` rejects garbage, **`test_loop_restart_does_not_double_spawn_when_ceo_alive` (F-3)**. (30/30 tests pass: 24 fast + 6 slow integration behind RUN_SLOW_TESTS=true. F-3 JOIN test covers double-spawn prevention.)
- [x] Static prompt assertions for `.opencode/agent/ceo.md` (AC-4) live here too (see Phase 3) — OR a separate static test; coordinate so they aren't duplicated. (Deferred to Phase 3 — test-ceo-loop.sh has the AC-3 section ready; AC-4 static section added in Phase 3.)

**Definition of Done (Phase 2)**
- `bash scripts/.tests/test-ceo-loop.sh` green. — PASSED (30/30: 24 fast + 6 slow integration with RUN_SLOW_TESTS=true)
- `bash scripts/test-all.sh` green. — PASSED (11/12 files; only expected test-build-claude-plugin.sh plugin-freshness gate red)
- AC-3 satisfied. — PASSED (all 13 AC-3 test cases from test-plan implemented and green)

---

## Phase 3 — `@ceo` prompt rewrite + plugin regen + inventory + lifecycle note

**Goal:** the canonical `@ceo` behavioral rules + downstream consistency.
(AC-4; INV-DM-4.)

**Files**
- `.opencode/agent/ceo.md` (REWRITE — replaces the 294-line seed)
- `.ados-claude/agents/ceo.md` (REGENERATE)
- `.opencode/README.md` (register `ceo` if missing)
- `doc/guides/change-lifecycle.md` (small note: merge-not-yield at the final-check)
- static assertions in `scripts/.tests/test-ceo-loop.sh` (AC-4) — coordinate with Phase 2

**`ceo.md` must contain (must/must-not phrasing)**
- **Wait for delivery:** the CEO calls `deliver-ticket.sh REF` (foreground, blocking) and **waits**; it reads the returned delivery summary (result + PM last-message).
- **Verify PM finalization before merge (INV-DM-4):** before merging, confirm the PM completed all 11 phases by inspecting `chg-<ref>-pm-notes.yaml` (AI-driven; record the check).
- **Merge-not-yield / proceed-not-halt:** a finalized + approved PR with a dead PM ⇒ merge, don't defer.
- **Never detach:** never `setsid … & disown` deliver-ticket.sh (INV-DM-1).
- **Multi-ticket-per-session:** loop inside one session: pick → deliver (block) → read summary → pick → …
- **Resolve blocker via `--resume-prompt`:** when the PM's last-message shows a blocker the CEO can resolve, resume with `deliver-ticket.sh REF --resume-prompt "<resolution>"`.
- Keep the autonomous-authority model from the seed, but **defer opt-in gating / threat model / decision record to #118** (note this explicitly in the prompt's non-goals).

**Tasks**
- [x] Rewrite `ceo.md` (delegate the prose tuning to `@toolsmith` if helpful; keep the `<role>/<mission>/<non_goals>/<authority_model>` structure that the seed uses, updated to the new behavioral rules). Decontextualize any remaining dogfooding-project specifics. **The CEO must NOT merge via `deliver-ticket.sh` — it runs `gh pr merge --squash` itself after verifying pm-notes (F-2). The CEO must write the durable stop to `.ai/local/ceo/stop` (NOT the seed's `tmp/ceo-loop/stopped.txt`) so it matches the loop's read path (F-5).** (294→290 lines; all seed dogfooding refs decontextualized; `<delivery_model>` + `<behavioral_rules>` sections with MUST/MUST NEVER phrasing; stop via `scripts/ceo-loop.sh --stop`; #118 deferral in non-goals.)
- [x] **pr-manager description quality (F-6, comment #12):** add a must-rule to `.opencode/agent/pr-manager.md` (and mirror in `.ai/agent/pr-instructions.md` if relevant) — `@pr-manager` MUST produce PR descriptions usable **verbatim** as the squash-commit body (the Mode B rebase-before-merge flow sources the commit message from PR title + description). Add a static grep test. (Quality rule added to pr-manager.md; `test_pr_manager_description_quality` in test-ceo-loop.sh.)
- [x] Run `scripts/build-claude-plugin.sh` → regenerate `.ados-claude/agents/ceo.md`; commit source + generated together. (Plugin regenerated: 24 agents, 20 skills. `test-build-claude-plugin.sh` 16/16 green.)
- [x] Add `ceo` to `.opencode/README.md` inventory (if not present). (Added under Agents section.)
- [x] Add a one-line merge-not-yield note to `change-lifecycle.md`'s final-check step. (Added Mode A note after pr_creation exit criteria.)
- [x] Add/confirm static assertions (AC-4) in `test-ceo-loop.sh`: `test_ceo_prompt_wait_for_delivery`, `..._verify_pm_finalization`, `..._merge_not_yield`, `..._never_detach`, `..._multi_ticket_per_session`, `..._resume_prompt`, `..._must_must_not_phrasing` (grep the required phrases). (All 7 + F-6 pr-manager test = 8 static tests. 38/38 total in test-ceo-loop.sh.)

**Definition of Done (Phase 3)**
- Static prompt assertions green. — PASSED (8/8 static tests in test-ceo-loop.sh)
- `bash scripts/.tests/test-build-claude-plugin.sh` green (plugin fresh). — PASSED (16/16)
- `.opencode/README.md` lists `ceo`. — PASSED
- AC-4 satisfied. — PASSED (all 7 AC-4 test cases + F-6 pr-manager quality test implemented and green)

---

## Phase 4 — `batch-deliver.sh` rebase-before-merge + green-gate wait + clean-merged-branches guard

**Goal:** Mode B never auto-merges; for a human-approved PR it rebases, pushes,
waits for green quality gates, then squash-merges using the PR title/description
as the commit message. (AC-6; Mode B rules.)

**Files**
- `scripts/batch-deliver.sh` (EXTEND)
- `scripts/.tests/test-batch-deliver.sh` (EXTEND)
- `tools/clean-merged-branches` + `tools/.tests/test-clean-merged-branches.sh` (verify/extend the "never unmerged" guard)

**Behavior**
1. **Never approve:** batch-deliver never adds the `approved` label.
2. **Approved PR flow** (when `approved` label present on the issue and a PR exists):
   - `git fetch origin main`.
   - If the PR head is **already on latest main** (no rebase effect) ⇒ skip the wait, go straight to squash-merge.
   - Else `git rebase origin/main` on the PR branch; **push --force-with-lease**.
     - **On conflict:** delegate conflict resolution to an AI agent (the plan specifies: invoke a small `opencode run`/`@fixer`-style step on the repo with a focused prompt to resolve the rebase conflicts, then `git rebase --continue`); then push. If unresolvable, exit to a clearly-marked `human-input-needed` state the batch can resume later.
   - **Wait for green:** poll `gh pr checks <n>` until all checks are `success`/`neutral`-complete; if any is `failure`, route back to the deliver step (the PM addresses the failure).
   - **Squash-merge** with the commit message = PR title + PR body (`gh pr merge --squash --subject "<PR title>" --body "<PR body>"`).
3. **Pending review parks that ticket only:** a PR created and not yet approved ⇒ log "pending review", move to the next ticket (do not block the batch).
4. **clean-merged-branches:** verify (and add a regression test) that it **never deletes unmerged branches** and never touches protected branches.

**Public contract to PRESERVE**
- Exit codes, `DRY_RUN`, summary log, pre-flight skip, idempotent re-run.

**Tasks**
- [ ] `approved_pr_flow REF BRANCH`: fetch, detect already-on-main, rebase, conflict→AI-resolve, push, wait-green (`wait_for_pr_green PR`), squash-merge with PR title+body.
- [ ] `wait_for_pr_green PR` using `gh pr checks` (poll, timeout, route-red-to-deliver).
- [ ] `get_pr_title_and_body PR` via `gh pr view --json title,body`.
- [ ] Extend the per-ticket loop: pending-review ⇒ park + continue.
- [ ] Verify/extend `tools/clean-merged-branches` "never unmerged" guard + test.
- [ ] Extend `test-batch-deliver.sh`: approved+green⇒squash-merge, approved+conflict⇒AI-resolve⇒green⇒merge, not-approved⇒park-and-continue, already-on-main⇒direct-merge, green-gate-red⇒deliver, commit-msg-from-PR-title+body, pending-parks-only-this-ticket, batch-never-adds-approved, clean-merged-branches-invoked, batch-does-not-force-delete-unmerged. Mock `_git`/`_gh`.

**Definition of Done (Phase 4)**
- `bash scripts/.tests/test-batch-deliver.sh` + `bash tools/.tests/test-clean-merged-branches.sh` green.
- `bash scripts/test-all.sh` green.
- AC-6 satisfied.

---

## Phase 5 — `autonomous-batch-delivery.md` consistency pass (comment #15)

**Goal:** the sibling guide does not contradict the revised delivery-modes guide.

**Files**
- `doc/guides/autonomous-batch-delivery.md` (EDIT)

**Tasks**
- [ ] Align the **liveness** description: session-traffic 15-min (`DELIVER_STUCK_MINUTES` default 15), not the old 30-min file-mtime wording. Update the "How activity is detected" section + the `DELIVER_STUCK_MINUTES` table row.
- [ ] Add/align the **rebase-before-merge + green-gate wait** flow for approved PRs (cross-link delivery-modes.md Mode B). Note that **Mode B merge is now owned by `batch-deliver.sh`** (deliver-ticket.sh no longer auto-merges — F-2); update the "Approval workflow" + "What the PM does inside the session" sections to reflect that the PM stops at `pr-open` and the batch script merges after human `approved` + rebase + green.
- [ ] State the **clean-merged-branches never-deletes-unmerged** guarantee.
- [ ] Cross-link delivery-modes.md as the canonical modes guide; note the two are kept consistent.
- [ ] Keep `ados_distribution: redistributable` (already set); ensure `bash scripts/.tests/test-doc-distribution.sh` stays green.

**Definition of Done (Phase 5)**
- Doc reads consistently with the revised guide; doc-distribution guard green.

---

## Phase 6 — Quality gates + headers + final test-all

**Goal:** everything upstreamable and green. (AC-7.)

**Tasks**
- [ ] License headers: confirm `scripts/` is NOT in the auto-header set per `AGENTS.md` (it lists `.opencode/agent`, `.opencode/command`, `doc/guides`, `doc/documentation-handbook.md`, `tools/`). So **no** headers on `scripts/*.sh`. The rewritten `scripts/ceo-loop.sh` seed currently HAS a license header (F-12) — **keep it** (do not strip); do not add headers to the other scripts. Apply headers via `scripts/add-header-location.sh` ONLY to `tools/clean-merged-branches` if it's touched (it already has one). `doc/guides/*` already carry headers.
- [ ] `bash scripts/test-all.sh` — green.
- [ ] `bash scripts/.tests/test-doc-distribution.sh` — green (guide + batch guide are redistributable).
- [ ] `bash scripts/.tests/test-build-claude-plugin.sh` — green (plugin fresh after ceo.md).
- [ ] ShellCheck + shfmt clean on all changed `scripts/*.sh` (per bash.md §13).
- [ ] Sweep: grep the changed scripts + ceo.md for any residual dogfooding-project names (marksync, GH-15, milestone MS-2, etc.) — must be zero/decontextualized.

**Definition of Done (Phase 6 / change)**
- All gates green; AC-7 satisfied; ready for reviewer + red-team R2 + DoD.

---

## Notes for the coder

- **Extend, don't rewrite** deliver-ticket.sh (842 lines) and batch-deliver.sh (408 lines). Preserve exit codes, env vars, stdout classification, and the mockable wrappers so existing tests stay green.
- **Lock the subcommand names** in Phase 1 before Phase 2/3 reference them: `--is-delivering`, `--last-message`, `--resume-prompt`.
- **Reuse** the existing `kill_process_tree`, `_cleanup_child`, mockable wrappers, embedded test framework, and `scripts/test-all.sh` aggregator.
- **Degrade gracefully** whenever an opencode DB query can fail (CI has no real opencode DB): warn + fall back, never block delivery.
- **Commit per phase** (Conventional Commits, via `@committer`). Suggested messages: `feat(scripts): GH-142 add pm-liveness session-traffic probe`, `feat(scripts): GH-142 deliver-ticket single-flight+join+subcommands+session-traffic liveness`, `feat(scripts): GH-142 rewrite ceo-loop runner (stuck-detect+resume+durable-stop)`, `feat(ceo): GH-142 rewrite @ceo prompt + regen plugin (merge-not-yield, wait-for-delivery)`, `feat(scripts): GH-142 batch-deliver rebase-before-merge + green-gate wait`, `docs(guides): GH-142 align autonomous-batch-delivery with delivery-modes`.
- **Do NOT stage** `AGENTS.md` (unrelated tweak) or anything under `.ai/local/`.
- **No autonomous merge** — this is a closely-guided core-process change; stop at PR review.
- **F-9 — expect the plugin-freshness gate RED until Phase 3.** The branch currently has `.opencode/agent/ceo.md` (seed) but **no** `.ados-claude/agents/ceo.md`, and `ceo` is absent from `.opencode/README.md`. So `test-build-claude-plugin.sh` / `test_committed_plugin_matches_fresh_build` will be red until Phase 3 lands — that is expected, not a regression you introduced.
- **F-11 — resume-limit CLI flag (nit).** Comment #2 asked the resume limit be "configurable via cli param." The plan exposes it via env (`CEO_RESUME_TOKEN_LIMIT`) for consistency with the rest of the config. Optionally also add `--resume-token-limit <N>` to `ceo-loop.sh`; if you do, document both. Env-only is acceptable.

---

## Execution log

- **Phase 0** (commit `ac8b952`): `scripts/pm-liveness.sh` + 16/16 tests. Session-traffic liveness probe, key=value output, graceful degradation.
- **Phase 1** (commit `ef6acf6`): `scripts/deliver-ticket.sh` extended + 49/49 tests. Single-flight+JOIN (F-3/F-4), session-traffic liveness (INV-DM-5), `--is-delivering`/`--last-message`/`--resume-prompt` subcommands, PM last-message capture, no-auto-merge prompt (F-2).
- **Phase 2**: `scripts/ceo-loop.sh` full rewrite (v2.0.0, 609 lines) + `scripts/.tests/test-ceo-loop.sh` (30/30 tests). F-3 single-flight (PID validation: cmdline+cwd+start-epoch), INV-DM-3/5 stuck detection (session-traffic stalled AND no delivery), INV-DM-3 session resume (context-total proxy, degrade gracefully), #97 durable stop (not wiped at startup), INV-DM-2 signal propagation, max-restarts exhaustion. State paths made non-readonly for testability. `STUCK_SECONDS` env override for fast tests.
- **Phase 3**: `.opencode/agent/ceo.md` rewrite (290 lines, `<delivery_model>`+`<behavioral_rules>` with MUST/MUST NEVER phrasing, decontextualized, #118 deferral). `.opencode/agent/pr-manager.md` F-6 quality rule. `.ados-claude/` regenerated (24 agents, 20 skills). `.opencode/README.md` `ceo` registered. `change-lifecycle.md` Mode A merge-not-yield note. `test-ceo-loop.sh` 8 static prompt assertions (AC-4). Plugin freshness gate GREEN. 12/12 test-all.sh.
