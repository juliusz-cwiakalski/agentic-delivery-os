---
workItemRef: GH-142
title: "Test plan — Delivery Modes guide + autonomous-loop reliability"
status: Accepted
created: 2026-07-07
spec: doc/changes/2026-07/2026-07-07--GH-142--delivery-modes-reliability/chg-GH-142-spec.md
guide: doc/guides/delivery-modes.md
---

# Test Plan — GH-142

> **Authoritative design:** `doc/guides/delivery-modes.md` (invariants INV-DM-1..6,
> the AI-vs-script split, subcommand contracts). **Scope/AC:** `chg-GH-142-spec.md`
> (AC-1..7). **Testing standard:** `.ai/rules/bash.md` §10–12 (embedded framework,
> mockable wrappers, `capture_output`, fixtures, `scripts/test-all.sh`).
>
> AC-1 (the guide) is delivered and human-reviewed separately; this plan covers
> **AC-2..7**. Every invariant INV-DM-1..6 has at least one test.

## Test strategy

All tests follow `.ai/rules/bash.md` §11 (embedded framework — no shared lib;
each test file copies the framework boilerplate). Three categories per §11.2:

| Category | Used for | Example |
|---|---|---|
| **Unit** | Pure functions (`extract_*`, `is_session_stuck`, `decide_after_iteration`, `pid_file_for`, duration/summary formatters). No I/O, mocked deps, ms-fast. | `test_is_delivering_dead_pid` |
| **Integration** | Multi-function flows with mocked `_opencode`/`_gh`/`_git` and `_test_tmpdir` fixtures (fake bin stubs, fixture JSON, mini git repos). Seconds. | `test_join_live_delivery`, `test_approved_rebase_conflict_ai_resolve_then_merge` |
| **Behavior** | Black-box: exit codes, stdout/stderr, file side-effects (PID files, stop file, state file). Seconds. | `test_durable_stop_survives_restart`, `test_last_message_subcommand` |

**Conventions the coder MUST follow** (match existing `test-deliver-ticket.sh` / `test-batch-deliver.sh`):

- Shebang + `set -Eeuo pipefail` + `set -o errtrace` + `shopt -s inherit_errexit` + `IFS=$'\n\t'`.
- Embedded framework: `_test_count/_test_passed/_test_failed`, `_test_setup` (mktemp), `_test_teardown` (rm -rf), `trap '_test_teardown' EXIT`, `run_test`, `assert_eq/assert_contains/assert_not_contains/assert_exit_code/assert_match/assert_file_exists`.
- Source the script under test, then **`trap - ERR`** to reset the sourced script's ERR trap (existing pattern).
- **Do not regress** existing tests — extend, don't rewrite. Existing `test_*` functions and their `run_test` registrations stay.
- Slow / process-coordination tests (concurrent join, kill+restart cycles) gated behind `RUN_SLOW_TESTS=true` (existing pattern in `test_integration_kill_restart_cycle`).
- No license headers in `scripts/.tests/` (scripts/ is NOT in the auto-header set per AGENTS.md).

## AC traceability matrix

| AC | Invariant(s) | Test file | Test cases |
|---|---|---|---|
| **AC-2** deliver-ticket single-flight+join+signal-prop | INV-DM-1, 2, 5, 6 | `scripts/.tests/test-deliver-ticket.sh` (EXTEND) | `test_pid_file_path`, `test_is_delivering_no_pid_file`, `test_is_delivering_live_pid`, `test_is_delivering_dead_pid_cleans_stale`, `test_is_delivering_any_ref`, `test_join_live_delivery`, `test_own_when_no_live`, `test_concurrent_converge_one_pm`, `test_signal_propagation_sigterm_to_child`, `test_last_message_subcommand`, `test_resume_prompt_flag`, `test_stdout_returns_pm_last_message_and_result`, `test_session_traffic_liveness_handoff`, `test_stuck_minutes_default_15` |
| **AC-3** ceo-loop stuck-detection + durable stop + resume | INV-DM-3, 5 | `scripts/.tests/test-ceo-loop.sh` (NEW) | `test_stuck_ceo_killed_and_restarted`, `test_healthy_delivery_no_kill`, `test_healthy_session_traffic_no_kill`, `test_durable_stop_survives_restart`, `test_stopped_file_not_wiped_at_startup`, `test_reset_clears_stop`, `test_resume_under_threshold`, `test_fresh_over_threshold`, `test_at_most_one_ceo_spawned`, `test_signal_propagation_to_ceo_child`, `test_max_restarts_exhausts`, `test_resume_remembers_session_id`, `test_validate_uint_rejects_garbage` |
| **AC-4** @ceo behavioral rules (static) | INV-DM-4 | `scripts/.tests/test-ceo-loop.sh` (NEW, static section) | `test_ceo_prompt_wait_for_delivery`, `test_ceo_prompt_verify_pm_finalization`, `test_ceo_prompt_merge_not_yield`, `test_ceo_prompt_never_detach`, `test_ceo_prompt_multi_ticket_per_session`, `test_ceo_prompt_resume_prompt`, `test_ceo_prompt_must_must_not_phrasing` |
| **AC-5** pm-liveness + session-traffic watchdog | INV-DM-5 | `scripts/.tests/test-pm-liveness.sh` (NEW) | `test_healthy_session`, `test_stale_session`, `test_at_threshold_stalled`, `test_growing_gap`, `test_shrinking_gap`, `test_graceful_degradation_db_failure`, `test_threshold_env_override`, `test_output_format_parseable` |
| **AC-6** Mode B rebase-before-merge + green-gate | INV-DM-6 (sequential), Mode B rules | `scripts/.tests/test-batch-deliver.sh` (EXTEND) | `test_approved_green_squash_merge`, `test_approved_rebase_conflict_ai_resolve_then_merge`, `test_not_approved_park_and_continue`, `test_already_on_latest_main_direct_merge`, `test_green_gate_red_routes_to_deliver`, `test_squash_commit_message_from_pr_title_and_desc`, `test_pending_review_parks_only_this_ticket`, `test_batch_never_adds_approved_label`, `test_clean_merged_branches_invoked_after_merge`, `test_batch_does_not_force_delete_unmerged` |
| **AC-7** tests + rules | all | all files + gates | `bash scripts/test-all.sh` green; `bash scripts/.tests/test-doc-distribution.sh` green; `bash tools/.tests/test-clean-merged-branches.sh` green; ShellCheck + shfmt clean; `.ados-claude/` regenerated (CI freshness) |

## Invariant coverage

| Invariant | Covered by |
|---|---|
| **INV-DM-1** deliver-ticket runs FOREGROUND, never detached | `test_ceo_prompt_never_detach` (static must-not-detach); `test_join_live_delivery` (caller blocks until result); `test_stdout_returns_pm_last_message_and_result` (blocking return contract) |
| **INV-DM-2** single-flight + join, per repo | `test_pid_file_path`, `test_is_delivering_live_pid`, `test_join_live_delivery`, `test_own_when_no_live`, `test_concurrent_converge_one_pm`, `test_signal_propagation_sigterm_to_child` |
| **INV-DM-3** ceo-loop detects *stuck* CEO, not healthy wait; durable stop | `test_stuck_ceo_killed_and_restarted`, `test_healthy_delivery_no_kill`, `test_healthy_session_traffic_no_kill`, `test_durable_stop_survives_restart`, `test_stopped_file_not_wiped_at_startup`, `test_reset_clears_stop` |
| **INV-DM-4** CEO merges approved+finalized PRs, does not yield | `test_ceo_prompt_wait_for_delivery`, `test_ceo_prompt_verify_pm_finalization`, `test_ceo_prompt_merge_not_yield`, `test_ceo_prompt_must_must_not_phrasing` |
| **INV-DM-5** liveness = session-message progress, not process-alive | `test_session_traffic_liveness_handoff`, `test_healthy_session`, `test_stale_session`, `test_at_threshold_stalled`, `test_growing_gap`, `test_graceful_degradation_db_failure`, `test_healthy_session_traffic_no_kill`, `test_stuck_ceo_killed_and_restarted` |
| **INV-DM-6** one ticket in flight per repo working tree | `test_is_delivering_any_ref`, `test_concurrent_converge_one_pm`, `test_pid_file_path` (repo-local path under `.ai/local/delivery/`), `test_not_approved_park_and_continue` (sequential batch) |

---

## File: `scripts/.tests/test-deliver-ticket.sh` (EXTEND)

**Keep all existing tests** (TC-DT-01..08j, CMP-01..03, INT-01, decide/classify
tests) unchanged in spirit. Note: `STUCK_MINUTES` default changes 30→15
(OQ-DM-3); the existing `is_session_stuck` tests pass `stuck_seconds` explicitly
(`1800`), so they still pass — **do not** "fix" them to 900. Add a new explicit
default-threshold test instead.

### New unit tests

**`test_pid_file_path`** (unit) — AC-2, INV-DM-2/6.
Assert a pure helper `pid_file_for "<REF>"` returns `${ROOT_DIR}/.ai/local/delivery/<REF>.pid` (repo-local, git-ignored path). If the code inlines the path, test the function that builds it. Override `ROOT_DIR` to `${_test_tmpdir}` and assert the exact path for `GH-142` and `PDEV-9`.

**`test_stuck_minutes_default_15`** (unit) — AC-2, INV-DM-5, OQ-DM-3.
Source the script with `DELIVER_STUCK_MINUTES` unset; assert `STUCK_MINUTES == 15` (regression guard — the seed had 30). Also assert `--stuck-minutes` still overrides.

**`test_is_delivering_no_pid_file`** (behavior) — AC-2, INV-DM-2.
Invoke `deliver-ticket.sh --is-delivering GH-142` with no PID file present (override `ROOT_DIR` to a temp repo). Assert exit code ≠ 0 and stdout empty.

**`test_is_delivering_live_pid`** (behavior) — AC-2, INV-DM-2.
Write `${ROOT_DIR}/.ai/local/delivery/GH-142.pid` containing the PID of a live `sleep 999 &` child whose command line matches `deliver-ticket.sh` (the JOIN probe must validate the PID is *this script* for this repo, not a reused PID — see guide troubleshooting). Assert `--is-delivering GH-142` exits 0, prints nothing. Clean up the child.

**`test_is_delivering_dead_pid_cleans_stale`** (behavior) — AC-2, INV-DM-2.
Write a PID file pointing to a PID that is dead (or not `deliver-ticket.sh`). Assert `--is-delivering GH-142` exits ≠ 0 AND the stale PID file is removed (self-healing).

**`test_is_delivering_any_ref`** (behavior) — AC-2, INV-DM-6.
With a live delivery PID for `GH-142` present, `--is-delivering` (no REF) exits 0 (any delivery in progress in this repo). With no deliveries, exits ≠ 0.

### New integration tests (mocked `_opencode`/`_gh`/`_git`)

**`test_join_live_delivery`** (integration) — AC-2, INV-DM-1/2.
Fixture: a "live owner" `deliver-ticket.sh` for `GH-142` is simulated by writing a valid PID file pointing to a long-running stub process tagged as deliver-ticket. Invoke a second `deliver-ticket.sh GH-142`. Assert: the joiner does **not** call `_opencode run` (no duplicate PM), waits for the owner to exit, then classifies via `_gh` and returns through the same exit path. Use `MOCK_GH_ISSUE_JSON='{"state":"CLOSED","labels":[]}'` → joiner returns `merged`/exit 0.

**`test_own_when_no_live`** (integration) — AC-2, INV-DM-1.
No live owner. Invoke `deliver-ticket.sh GH-142` with `MOCK_OPENCODE_BLOCK_SECONDS=0` and a captured last-message. Assert `_opencode run` called exactly once (OWN path) and a PID file is written then cleared on exit.

**`test_concurrent_converge_one_pm`** (integration, `RUN_SLOW_TESTS=true`) — AC-2, INV-DM-2/6.
Launch two `deliver-ticket.sh GH-142` concurrently (background both). Assert across both invocations `_opencode run` is invoked **exactly once** (one owns, one joins); both return the same classified result. Use marker files + a run-counter (pattern from `test_integration_kill_restart_cycle`).

**`test_signal_propagation_sigterm_to_child`** (integration) — AC-2, INV-DM-2.
Start `deliver-ticket.sh GH-142` with `_opencode` mocked to a blocking stub (`sleep 300`). Send SIGTERM to the deliver-ticket PID. Assert the opencode child receives SIGTERM, then SIGKILL after `DELIVER_KILL_GRACE_SECONDS` (set short, e.g. 2), and no orphan remains. Extends existing `test_cleanup_child_kills_tracked_pid` with a real signal-driven path.

**`test_session_traffic_liveness_handoff`** (integration) — AC-2/5, INV-DM-5.
Mock `_opencode db` to return fixture session-message timestamps: (a) recent traffic (< threshold) → deliver-ticket does NOT kill the PM; (b) no traffic for > `DELIVER_STUCK_MINUTES` → deliver-ticket kills+restarts the PM. This bridges to `pm-liveness.sh` (AC-5); if deliver-ticket inlines the probe, mock the same `_opencode db`/`session` surface.

### New behavior tests (subcommands, stdout contract)

**`test_last_message_subcommand`** (behavior) — AC-2.
Write a fixture last-message file for `GH-142` (the stored PM last message). Invoke `deliver-ticket.sh --last-message GH-142`. Assert stdout equals the stored message exactly, exit 0, and **no** `_opencode run` invocation (it only reads stored state).

**`test_resume_prompt_flag`** (behavior) — AC-2, INV-DM-4.
Invoke `deliver-ticket.sh GH-142 --resume-prompt "Fix the failing test in X by Y"` with `_opencode` mocked to log its args. Assert the `_opencode run` args contain the custom resume prompt string, **not** the default `build_delivery_prompt` output. Assert `--resume-prompt` is rejected when empty or when combined with `--is-delivering`/`--last-message` (usage error, exit 2).

**`test_stdout_returns_pm_last_message_and_result`** (behavior) — AC-2, INV-DM-1/4.
Mock `_opencode run` to emit a fake PM last message on stdout (`"PR #143 open; blocker: needs design review"`). On completion, assert `deliver-ticket.sh GH-142` stdout contains **both** the result classification (`pr-open`/`merged`/`blocked`/`failed`) **and** the PM last-message text, in the documented parseable format (e.g., first line = classification, remainder = last message). This is the contract the CEO consumes (INV-DM-4).

---

## File: `scripts/.tests/test-pm-liveness.sh` (NEW)

Tests `scripts/pm-liveness.sh <session_id>`: prints seconds-since-last-message,
last step, gap trend; exits non-zero when stalled (no session message for >
`CEO_LOOP_STALL_MINUTES`, default 15). Consumes `opencode db`/`opencode session`
(AC-5, INV-DM-5). Mock `_opencode` for the `db` and `session` surfaces; never
touch a real opencode DB.

**`test_healthy_session`** (integration) — AC-5, INV-DM-5.
Mock `_opencode db` to return a last-message timestamp 30s ago. Assert exit 0; stdout prints `seconds_since_last_message` ≈ 30 (< 900); gap trend = `stable` or `shrinking`.

**`test_stale_session`** (integration) — AC-5, INV-DM-5.
Last message 20 minutes ago (1200s), threshold 15min. Assert exit ≠ 0; stdout prints `seconds_since_last_message` ≈ 1200 and a `stalled` indicator.

**`test_at_threshold_stalled`** (unit/integration) — AC-5.
Exactly 900s (15min) since last message → stalled (`>=` threshold, not `>`). Assert exit ≠ 0.

**`test_growing_gap`** (integration) — AC-5.
Fixture: a sequence of 4 messages with increasing inter-message intervals (10s, 30s, 90s, 200s). Assert `gap_trend=growing` in stdout (a leading indicator of a stall).

**`test_shrinking_gap`** (integration) — AC-5.
Fixture: decreasing intervals (200s, 90s, 30s, 10s). Assert `gap_trend=shrinking` (healthy).

**`test_graceful_degradation_db_failure`** (integration) — AC-5, spec risk note.
Mock `_opencode db` to return non-zero / empty output. Assert pm-liveness does **not** crash (`set -e`-safe): it logs a `[WARN]` degraded-mode message, falls back to file-mtime (or a documented signal), and exits with a controlled code (0 if the fallback says healthy, non-zero if stalled). Assert no unhandled `set -e` abort.

**`test_threshold_env_override`** (behavior) — AC-5.
`CEO_LOOP_STALL_MINUTES=5`; last message 6 minutes ago → stalled (exit ≠ 0). Last message 3 minutes ago → healthy (exit 0).

**`test_output_format_parseable`** (unit) — AC-5.
Assert stdout is a stable, machine-parseable format consumable by `deliver-ticket.sh` and `ceo-loop.sh` (e.g. `key=value` lines or a single TSV). Assert the keys `seconds_since_last_message`, `last_step`, `gap_trend` are present. The exact format is the coder's choice but must be asserted so downstream consumers can parse it.

---

## File: `scripts/.tests/test-ceo-loop.sh` (NEW)

Tests the rewritten `scripts/ceo-loop.sh` (AC-3, INV-DM-3/5). Mock `_opencode`
(session/db/run) and stub `deliver-ticket.sh` via `PATH` or a `DELIVER_SCRIPT`
override so `--is-delivering` returns fixture values. Use a fake CEO child
(blocking stub) for kill/restart tests. Slow/process-coordination tests gated
behind `RUN_SLOW_TESTS=true`.

### Loop behavior tests

**`test_stuck_ceo_killed_and_restarted`** (integration, `RUN_SLOW_TESTS=true`) — AC-3, INV-DM-3/5.
Mock: CEO child alive (`_opencode run` blocks), `_opencode db`/`session` returns no new message traffic for > `CEO_LOOP_STALL_MINUTES` (set to 1 for the test), and `deliver-ticket.sh --is-delivering` exits ≠ 0 (no healthy delivery). Assert: ceo-loop sends SIGTERM→SIGKILL to the CEO child, increments its restart counter, and spawns a fresh/resumed CEO. Use run-counter markers.

**`test_healthy_delivery_no_kill`** (integration, `RUN_SLOW_TESTS=true`) — AC-3, INV-DM-3.
Mock: CEO child alive, **no** session traffic for > threshold, BUT `deliver-ticket.sh --is-delivering` exits 0 (healthy delivery in progress). Assert: ceo-loop does **not** kill the CEO (it is blocked on a healthy delivery — INV-DM-3). No restart counter increment.

**`test_healthy_session_traffic_no_kill`** (integration, `RUN_SLOW_TESTS=true`) — AC-3, INV-DM-5.
Mock: CEO child alive, `_opencode db` returns recent message traffic (< threshold). Assert: ceo-loop does **not** kill even if `--is-delivering` is false. (Liveness is session-traffic, not process-alive — INV-DM-5.)

**`test_durable_stop_survives_restart`** (behavior) — AC-3, INV-DM-3.
Invoke `ceo-loop.sh --stop`; assert a stop file is written. Start `ceo-loop.sh` again (fresh process); assert it honors the non-expired stop signal (does **not** spawn a CEO) and exits cleanly. The stop signal is durable across process restarts (#97).

**`test_stopped_file_not_wiped_at_startup`** (behavior) — AC-3, INV-DM-3.
Pre-create the stop file. Start `ceo-loop.sh`. Assert: the loop exits without spawning a CEO **and** the stop file still exists on disk (the seed did `rm -f "${STOPPED_FILE}"` at startup — that bug must be gone). Direct INV-DM-3 assertion.

**`test_reset_clears_stop`** (behavior) — AC-3.
With a stop file present, invoke `ceo-loop.sh --reset`; assert the stop file is removed. A subsequent start spawns a CEO normally (assert `_opencode run` called).

**`test_resume_under_threshold`** (integration) — AC-3, session-resume.
Fixture: ceo-loop state file remembers `last_ceo_session_id=ses_abc`; mock `_opencode db` to return token total `50000` (< `CEO_RESUME_TOKEN_LIMIT` default 100000). Assert ceo-loop resumes via `_opencode run --session ses_abc "<continue prompt>"` (not a fresh `--agent ceo` spawn).

**`test_fresh_over_threshold`** (integration) — AC-3, session-resume.
Fixture: token total `150000` (> 100000). Assert ceo-loop spawns a **fresh** CEO (`_opencode run --agent ceo ...`, no `--session <prev>`).

**`test_at_most_one_ceo_spawned`** (integration, `RUN_SLOW_TESTS=true`) — AC-3, INV-DM-3.
Mock a long-running CEO child. Assert ceo-loop spawns exactly one `_opencode run` while the child is alive; it does not spawn a second (monitors, doesn't double-spawn). Use a run-counter marker file.

**`test_signal_propagation_to_ceo_child`** (integration) — AC-3, INV-DM-2 (propagation rule).
Start ceo-loop with a blocking fake CEO child; send SIGTERM to ceo-loop. Assert the CEO child receives SIGTERM (then SIGKILL after grace) and no orphaned child survives. (ceo-loop must propagate signals like every delivery script.)

**`test_max_restarts_exhausts`** (behavior) — AC-3.
`CEO_LOOP_MAX_RESTARTS=2`; mock every CEO session as immediately stuck. Assert ceo-loop performs 2 kill+restarts then exits non-zero (does not loop forever). Keep the existing `validate_*` exit-code-2 behavior for bad input.

**`test_resume_remembers_session_id`** (integration) — AC-3.
After a CEO session finishes, assert ceo-loop persists the session id to its state file (e.g. `.ai/local/ceo-loop-state.yaml` or the existing `ceo-context.yaml`). Next iteration reads it (feeds `test_resume_under_threshold`/`test_fresh_over_threshold`).

**`test_validate_uint_rejects_garbage`** (unit) — AC-7 (regression).
`CEO_LOOP_STUCK_MINUTES=abc` → exit 2. `CEO_LOOP_POLL_SECONDS=0` → exit 2. (Keep the seed's `validate_uint`/`validate_positive_uint` contract.)

### Static / structural tests for `.opencode/agent/ceo.md` (AC-4)

These are **grep-based** assertions on the canonical CEO prompt source (not the
generated `.ados-claude/` copy). Read `.opencode/agent/ceo.md` into a variable
and `assert_contains` the required must/must-not phrases. If the prompt is later
restructured, update the needle phrases — but the *contract* each test asserts
must remain.

**`test_ceo_prompt_wait_for_delivery`** — INV-DM-1/4.
Assert ceo.md contains a must-phrase requiring the CEO to **call `deliver-ticket.sh` and wait for it to return** (blocking), then **consume its returned last-message + result**. Needles (any one): `"deliver-ticket.sh"` + `"wait"`/`"blocking"` + `"last message"`/`"last-message"`.

**`test_ceo_prompt_verify_pm_finalization`** — INV-DM-4.
Assert ceo.md contains a must-phrase requiring the CEO to **verify the PM finalized all 11 phases** (via `chg-<ref>-pm-notes.yaml`) **before merging**. Needles: `"pm-notes"` (or `chg-` + `pm-notes`) + `"finaliz"`/`"11 phase"`/`"all phases"` + `"before merg"`.

**`test_ceo_prompt_merge_not_yield`** — INV-DM-4 (#99).
Assert ceo.md contains **merge-not-yield** + **proceed-not-halt** language: a ready, approved, PM-finalized PR **must be merged**, not deferred/yielded forever. Needles: `"merge"` + `"yield"`/`"defer"` (as a must-not) and `"proceed"`/`"halt"`.

**`test_ceo_prompt_never_detach`** — INV-DM-1.
Assert ceo.md contains a must-not phrase forbidding detaching `deliver-ticket.sh` (`setsid … & disown` / backgrounding). Needles: `"detach"`/`"setsid"`/`"disown"` + `"must not"`/`"never"`/`"do not"`.

**`test_ceo_prompt_multi_ticket_per_session`** — INV-DM-3 (one CEO, many tickets).
Assert ceo.md states **one CEO session delivers many tickets** (the CEO loops inside its session: pick → deliver → read summary → pick). Needles: `"many tickets"`/`"multiple tickets"`/`"one session"` + `"loop"`/`"next ticket"`.

**`test_ceo_prompt_resume_prompt`** — INV-DM-4 (blocker resolution).
Assert ceo.md references `--resume-prompt` as the mechanism to resolve a PM-raised blocker (resume the PM with a custom instruction). Needles: `"--resume-prompt"`.

**`test_ceo_prompt_must_must_not_phrasing`** — AC-4 (structural quality).
Assert ceo.md uses explicit **must**/**must not** (or MUST/MUST NOT) framing for the behavioral rules (not merely descriptive). At least N (e.g. 3) must-phrases and M (e.g. 2) must-not phrases. This guards against the prompt drifting back to soft/descriptive language.

> **Note:** the coder may split these static tests into a dedicated
> `scripts/.tests/test-ceo-agent-static.sh` if the file grows; either is
> acceptable. They are listed under `test-ceo-loop.sh` here to match the
> enumerated file set in the task brief.

---

## File: `scripts/.tests/test-batch-deliver.sh` (EXTEND)

**Keep all existing tests** (TC-BD-01..08b: parsing, skip, duration, summary).
Extend with Mode B rebase-before-merge + green-gate + approved-label merge
(AC-6). Mock `_gh` (pr merge/view/checks, issue edit/view), `_git` (rebase/push/
fetch/checkout), and `_opencode` (AI conflict resolution). Where a real conflict
is more honest, build a mini git repo fixture in `${_test_tmpdir}` with two
conflicting branches.

**`test_approved_green_squash_merge`** (integration) — AC-6.
Fixture: ticket `GH-200` has the `approved` label, an open PR on `feat/GH-200/x`, rebase is clean (`_git rebase` returns 0), `gh pr checks` returns all green. Assert: `_gh pr merge --squash` is called; the merge invocation's body arg is sourced from `gh pr view --json title,body`; the ticket is counted as merged in the summary.

**`test_approved_rebase_conflict_ai_resolve_then_merge`** (integration) — AC-6.
Fixture: approved PR, `_git rebase` returns non-zero (conflict). Assert: batch delegates conflict resolution to an AI agent (mock `_opencode run` for the resolve step, or a documented `--resolve-conflicts` subcommand), pushes the resolved result, waits for `gh pr checks` green, then merges. Assert `_gh pr merge --squash` called **after** the resolve step; assert merge not called before.

**`test_not_approved_park_and_continue`** (integration) — AC-6, Mode B rules.
Fixture: `GH-201` has an open PR but **no** `approved` label. Assert: batch does **not** merge, does **not** add the `approved` label, parks `GH-201`, and continues to the next ticket in the list (assert the next ticket's `deliver-ticket.sh` / pre-flight is invoked). Summary records `GH-201` as parked/pending.

**`test_already_on_latest_main_direct_merge`** (integration) — AC-6.
Fixture: approved PR whose head is already on latest `main` (rebase reports "up to date" / is a no-op). Assert: batch skips the green-gate wait (or merges directly) and calls `_gh pr merge --squash`. No rebase push side-effect.

**`test_green_gate_red_routes_to_deliver`** (integration) — AC-6.
Fixture: approved PR, rebase clean, but `gh pr checks` returns red (failing). Assert: batch does **not** merge; it routes back to `deliver-ticket.sh` (address feedback / fix the failing gate). Assert `_gh pr merge` NOT called.

**`test_squash_commit_message_from_pr_title_and_desc`** (integration) — AC-6.
Mock `gh pr view --json title,body` to return `{"title":"feat: add X","body":"Resolves GH-200.\n\nDetails…"}`. Assert the `--body` (and `--subject`/title) passed to `gh pr merge --squash` equals the PR title (subject) + PR description (body). This enforces "@pr-manager descriptions must be fit to become the final commit message."

**`test_pending_review_parks_only_this_ticket`** (integration) — AC-6, OQ comment #10.
Fixture: `GH-202` delivery results in `pr-open` (pending review), `GH-203` is next. Assert: batch parks `GH-202` only and proceeds to `GH-203` (the batch continues). Re-running is idempotent (skip logic handles `GH-202` on rerun).

**`test_batch_never_adds_approved_label`** (behavior) — AC-6, Mode B core rule.
Run a batch over `[GH-200, GH-201]` with mixed approval states. Assert: across the whole run, `_gh issue edit --add-label approved` is **never** called (Mode B never approves a PR — the human does). Log all `_gh` calls to a marker file and grep-assert the absence.

**`test_clean_merged_branches_invoked_after_merge`** (integration) — AC-6, regression.
After a successful merge, assert `clean-merged-branches` is invoked (existing between-tickets cleanup behavior is preserved). Stub the tool (override `CLEAN_TOOL` to a script that writes a marker) and assert the marker is touched.

**`test_batch_does_not_force_delete_unmerged`** (integration) — AC-6, clean-merged-branches safety.
Assert batch invokes `clean-merged-branches` with only safe flags (e.g. `--allow-dirty`) and **never** passes a flag that would delete unmerged branches. The "never removes unmerged branches" guarantee itself is owned by `tools/.tests/test-clean-merged-branches.sh` (cite it as the canonical guard); this test only asserts batch's invocation shape.

---

## Mocking approach (mock shapes)

All mocks override the mockable wrappers (`_opencode`/`_gh`/`_git`/`_jq`/`_setsid`)
that the scripts already define (§10.3). Define mock helpers per test file
(matching the existing `mock_git` pattern in bash.md §11.3). The shapes below
are the contract the coder should implement.

### `_opencode` mock (deliver-ticket, ceo-loop, pm-liveness)

```bash
mock_opencode() {
  _opencode() {
    case "$1" in
      session)            # opencode session list --format json
        printf '%s' "${MOCK_SESSION_LIST:-[]}"
        ;;
      db)                 # opencode db "<SQL>" --format json
        case "$2" in
          *tokens*)  printf '%s' "${MOCK_DB_TOKENS:-[{\"total\":50000}]}" ;;
          *message*|*last*) printf '%s' "${MOCK_DB_MESSAGES:-[]}" ;;
          *) printf '%s' '[]' ;;
        esac
        ;;
      run)                # opencode run [--session ID | --agent ceo] <prompt>
        MOCK_OPENCODE_RUN_COUNT=$((MOCK_OPENCODE_RUN_COUNT+1))
        printf '%s\n' "run:$*" >>"${MOCK_OPENCODE_RUN_LOG:?}"
        [[ -n "${MOCK_OPENCODE_BLOCK_SECONDS:-}" ]] && sleep "${MOCK_OPENCODE_BLOCK_SECONDS}"
        printf '%s' "${MOCK_OPENCODE_LAST_MESSAGE:-PM-LAST-MSG}"
        ;;
      *) return 1 ;;
    esac
  }
}
```

- `session` → fixture JSON array of sessions (id/title/time).
- `db` → fixture token totals (`SELECT ... FROM session`) and message rows (timestamps) for liveness.
- `run` → logs args, optionally blocks (to be killed), emits a fake PM last-message on stdout.

### `_gh` mock (batch-deliver, deliver-ticket)

```bash
mock_gh() {
  _gh() {
    case "$1" in
      issue)
        case "$2" in
          view) printf '%s' "${MOCK_ISSUE_JSON:-{\"state\":\"OPEN\",\"labels\":[]}}" ;;
          edit) printf '%s\n' "issue-edit:$*" >>"${MOCK_GH_LOG:?}"
                [[ "${MOCK_GH_ISSUE_EDIT_ALLOW:-false}" == true ]] || return 1 ;;
          *) return 1 ;;
        esac ;;
      pr)
        case "$2" in
          list)   printf '%s' "${MOCK_PR_LIST_JSON:-[]}" ;;
          view)   printf '%s' "${MOCK_PR_VIEW_JSON:-{\"title\":\"T\",\"body\":\"B\"}}" ;;
          checks) printf '%s' "${MOCK_PR_CHECKS_JSON:-[]}" ;;   # green/red fixture
          merge)  printf '%s\n' "pr-merge:$*" >>"${MOCK_GH_LOG:?}"; return 0 ;;
          *) return 1 ;;
        esac ;;
      *) return 1 ;;
    esac
  }
}
```

- `issue edit --add-label approved` defaults to **return 1** (so `test_batch_never_adds_approved_label` can assert the marker is never even touched).
- `pr checks` fixture: green = `[{"name":"ci","conclusion":"SUCCESS"}]`; red = `[{"name":"ci","conclusion":"FAILURE"}]`.
- `pr view --json title,body` feeds the squash commit-message test.

### `_git` mock (batch-deliver rebase, deliver-ticket)

```bash
mock_git() {
  _git() {
    [[ "$1" == "-C" ]] && shift 2   # swallow -C <dir> prefix used by deliver-ticket
    case "$1" in
      rebase) [[ "${MOCK_GIT_REBASE_CONFLICT:-false}" == true ]] && { printf 'CONFLICT\n' >&2; return 1; } || return 0 ;;
      push)   printf '%s\n' "push:$*" >>"${MOCK_GIT_LOG:?}"; return 0 ;;
      fetch|pull|checkout|rev-parse|log) return 0 ;;
      diff)   [[ "${MOCK_GIT_DIFF_IDENTICAL:-false}" == true ]] && return 0 || return 1 ;;
      *)      command git "$@" ;;  # fall through to real git for fixture-repo ops
    esac
  }
}
```

For the rebase-conflict test, prefer a **real mini git repo** fixture (two
branches with conflicting hunks in `${_test_tmpdir}`) so the conflict path is
honest; use the mocked `_git` only for the happy-path/already-on-main tests.

### `capture_output` helper (bash.md §11.4)

Use the standard nameref-based capture for behavior tests that assert on both
stdout and stderr:

```bash
capture_output() {
  local -n _stdout_ref="$1" _stderr_ref="$2" _exit_ref="$3"
  shift 3
  local _so _se; _so="$(mktemp)"; _se="$(mktemp)"
  _exit_ref=0; "$@" >"${_so}" 2>"${_se}" || _exit_ref=$?
  _stdout_ref="$(cat "${_so}")"; _stderr_ref="$(cat "${_se}")"
  rm -f "${_so}" "${_se}"
}
```

---

## Quality gates / regression expectations (AC-7)

| Gate | Command | Expectation |
|---|---|---|
| Script test aggregator | `bash scripts/test-all.sh` | green — all `scripts/.tests/test-*.sh` pass, including the 2 new + 2 extended files |
| Tools tests (run separately) | `bash tools/.tests/test-clean-merged-branches.sh` | green (clean-merged-branches "never unmerged" guarantee intact) |
| Doc distribution drift guard | `bash scripts/.tests/test-doc-distribution.sh` | green — `doc/guides/delivery-modes.md` is `redistributable` and in the install set; no drift |
| Claude plugin freshness | `bash scripts/build-claude-plugin.sh` + git diff | `.ados-claude/agents/ceo.md` regenerated, no stale diff (CI enforces) |
| ShellCheck | `shellcheck scripts/ceo-loop.sh scripts/pm-liveness.sh scripts/deliver-ticket.sh scripts/batch-deliver.sh scripts/.tests/test-ceo-loop.sh scripts/.tests/test-pm-liveness.sh` | no warnings (or inline `# shellcheck disable=` with justification) |
| shfmt | `shfmt -i 2 -ci -bn -d` on the above | no diff |
| License headers | `scripts/add-header-location.sh` on configured paths | `tools/clean-merged-branches` already headered; `scripts/` (incl. `pm-liveness.sh`, `ceo-loop.sh`) is NOT in the auto-header set — do NOT add headers there |
| Existing tests unchanged in spirit | diff `test-deliver-ticket.sh` / `test-batch-deliver.sh` | only additions (new `test_*` + `run_test` lines); no semantic change to existing assertions |

---

## Testability gaps & handling

| Gap | Why it matters | How the plan handles it |
|---|---|---|
| **Real opencode session DB unavailable in CI** | INV-DM-5 liveness reads `opencode db SELECT tokens_*/messages FROM session`; no real DB in CI. | Mock `_opencode` for `db`/`session` surfaces with fixture JSON (token totals, message timestamps). `pm-liveness.sh` tests feed controlled timestamps; deliver-ticket/ceo-loop tests assert the watchdog decision, not the DB itself. |
| **Real gh API unavailable / rate-limited** | Classification, PR checks, merge, label edits all hit `gh`. | Mock `_gh` dispatching on `issue`/`pr` + subcommand (see mock shape). `classify_result` already has this seam (existing `test_classify_*`). |
| **Real git rebase conflicts are environment-sensitive** | The conflict path must be tested honestly. | Prefer a real mini git repo fixture (two conflicting branches in `${_test_tmpdir}`) for `test_approved_rebase_conflict_ai_resolve_then_merge`; mocked `_git` for happy-path/already-on-main. |
| **Signal propagation to a real opencode child** | Can't run a real opencode in CI. | Use a blocking stub process (`sleep 300` or a fake `opencode` bin) as the child — existing pattern (`test_kill_process_tree_kills_process`, `test_cleanup_child_kills_tracked_pid`, `test_integration_kill_restart_cycle`). |
| **Concurrent join / at-most-one-CEO coordination** | Inherently timing-sensitive. | Gate behind `RUN_SLOW_TESTS=true`; use marker files + run-counters (existing pattern). Assert invariants (exactly one `_opencode run`), not exact timing. |
| **`@ceo` prompt is not behaviorally unit-testable** | AC-4 requires behavioral rules in the prompt. | Static grep-based assertions on `.opencode/agent/ceo.md` must/must-not phrases (see static test section). The generated `.ados-claude/agents/ceo.md` freshness is enforced by CI, not by these tests. |
| **pm-notes YAML schema not yet strict** | INV-DM-4 "CEO verifies PM finalization" is AI-driven (spec out-of-scope: formalize schema later). | Not tested at the script level — the ceo.md static test asserts the prompt *instructs* the CEO to verify `chg-<ref>-pm-notes.yaml`; scripting the verification is deferred per spec. |
| **Session-traffic vs file-mtime fallback boundary** | pm-liveness must degrade gracefully when `opencode db` fails (spec risk note). | `test_graceful_degradation_db_failure` asserts a controlled fallback (warn + file-mtime), no `set -e` crash. |

---

## Risks to the test plan itself

- **`deliver-ticket.sh` is 842 lines and in production (#124).** The single-flight/join and session-traffic changes touch the liveness loop and add subcommands. Mitigation: extend, don't rewrite; the existing test suite is a regression gate; new tests mock at the `_opencode`/`_gh`/`_git` boundary, not deeper.
- **`STUCK_MINUTES` default 30→15 could silently break callers** that rely on the old default. Mitigation: `test_stuck_minutes_default_15` pins the new default; existing `is_session_stuck` tests use explicit args and are unaffected.
- **Static prompt tests are brittle to phrasing.** If the CEO prompt is restructured, needles may need updating. Mitigation: assert the *contract* (wait-for-delivery, verify-finalization, merge-not-yield, never-detach, multi-ticket, --resume-prompt) via a small set of meaningful needles, and document that updating needles is allowed as long as the contract holds.
- **`ceo-loop.sh` rewrite changes the stop-file semantics** (seed wipes it at startup; new version must not). Mitigation: `test_stopped_file_not_wiped_at_startup` is a direct, explicit assertion of INV-DM-3.
