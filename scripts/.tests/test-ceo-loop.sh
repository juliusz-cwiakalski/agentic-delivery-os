#!/usr/bin/env bash
# test-ceo-loop.sh — Tests for scripts/ceo-loop.sh (AC-3, INV-DM-3/5)
#
# Tests: stuck-detection decision logic, F-3 single-flight, session resume,
# durable stop (#97), signal propagation, max-restarts exhaustion, input
# validation, and (with RUN_SLOW_TESTS=true) full loop integration.
#
# Mocking approach:
#   - Override wrapper functions (_pm_liveness, delivery_in_progress, _opencode,
#     _setsid) directly — same-shell overrides (Phase 1 pattern).
#   - For loop integration tests: override spawn_or_resume_ceo to spawn a
#     controlled sleep child (avoids real opencode).
#   - State paths (CEO_PID_FILE, STOP_FILE, etc.) redirected to per-test temp.
# shellcheck disable=SC2034,SC2329
# SC2034: module-level vars consumed by sourced ceo-loop.sh functions.
# SC2329: mock function overrides (capture_session_id_by_title, spawn_or_resume_ceo)
#         are called indirectly by run_loop; ShellCheck can't trace across source.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded — same structure as test-deliver-ticket.sh)
# ============================================================================
readonly TEST_TAG="(test-ceo-loop)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m'
  readonly _GREEN=$'\033[0;32m'
  readonly _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _RESET=""
fi

_test_setup() {
  _test_tmpdir="$(mktemp -d)"
}

_test_teardown() {
  [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]] && rm -rf "${_test_tmpdir}"
  _test_tmpdir=""
}

trap '_test_teardown' EXIT

run_test() {
  local -r name="$1"
  local -r func="$2"
  (( ++_test_count )) || true

  _test_setup

  if ( set -e; "${func}" ); then
    (( ++_test_passed )) || true
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    (( ++_test_failed )) || true
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi

  _test_teardown
}

assert_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" != "${actual}" ]]; then
    printf '  Expected: %s\n  Actual:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    printf '  Haystack: %s\n  Needle:   %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_not_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    printf '  Should not contain: %s\n  In: %s\n' "${needle}" "${haystack}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/ceo-loop.sh"

# Reset ERR trap — the sourced script sets its own.
trap - ERR

# ============================================================================
# MOCK INFRASTRUCTURE
# ============================================================================

# Per-test marker / control variables (reset by _setup_ceo_state).
MOCK_SETSID_CALLS=""
MOCK_SPAWN_CALLS=""
MOCK_CEO_LIFETIME="60"
MOCK_LIVENESS_RC="2"       # 0=healthy, 1=stalled, 2=degraded
MOCK_DELIVERY_RC="1"       # 0=delivery in progress, 1=not
MOCK_DB_RESULT="[]"
MOCK_SESSION_LIST="[]"

_setup_ceo_state() {
  CEO_STATE_DIR="${_test_tmpdir}/ceo-state"
  CEO_PID_FILE="${CEO_STATE_DIR}/ceo.pid"
  STOP_FILE="${CEO_STATE_DIR}/stop"
  LAST_SESSION_FILE="${CEO_STATE_DIR}/last-session"
  LOG_DIR="${_test_tmpdir}/logs"
  MOCK_SETSID_CALLS="${_test_tmpdir}/setsid-calls"
  MOCK_SPAWN_CALLS="${_test_tmpdir}/spawn-calls"
  mkdir -p "${CEO_STATE_DIR}" "${LOG_DIR}"
  CURRENT_CEO_PID=""
}

# _pm_liveness mock: returns the configured code.
_pm_liveness() { return "${MOCK_LIVENESS_RC}"; }

# delivery_in_progress mock: returns the configured code.
delivery_in_progress() { return "${MOCK_DELIVERY_RC}"; }

# _opencode mock: handles db and session list subcommands with fixture data.
_opencode() {
  case "${1:-}" in
    db)
      printf '%s' "${MOCK_DB_RESULT}"
      ;;
    session)
      if [[ "${2:-}" == "list" ]]; then
        printf '%s' "${MOCK_SESSION_LIST}"
      fi
      ;;
    *) : ;;
  esac
}

# _setsid mock: records the command to a marker file (space-separated) and
# exits immediately (the background subshell dies; spawn_or_resume_ceo
# continues to session capture).
_setsid() {
  printf '%s ' "$@" >>"${MOCK_SETSID_CALLS}" 2>/dev/null || true
  printf '\n' >>"${MOCK_SETSID_CALLS}" 2>/dev/null || true
  exit 0
}

# Spawn a fake CEO child whose cmdline is "opencode" and cwd is ROOT_DIR, so
# ceo_pid_if_live accepts it. Echoes the PID. Blocks until killed or 30s.
_spawn_fake_ceo() {
  bash -c 'cd "'"${ROOT_DIR}"'"; exec -a opencode sleep 30' >/dev/null 2>&1 &
  local pid=$!
  sleep 0.3
  printf '%s' "${pid}"
}

# Kill a process and its children if still alive.
_kill_if_alive() {
  local pid="$1"
  [[ -n "${pid}" ]] || return 0
  kill -0 "${pid}" 2>/dev/null || return 0
  kill "${pid}" 2>/dev/null || true
  sleep 0.5
  kill -9 "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
}

# ============================================================================
# TESTS: Input Validation
# ============================================================================

# test_validate_uint_rejects_garbage — AC-3.
# Note: validate_uint calls die()→exit, so each call is wrapped in its own
# subshell to capture the exit code without killing the test function.
test_validate_uint_rejects_garbage() {
  if (validate_uint "X" "abc" 2>/dev/null); then return 1; fi
  if (validate_uint "X" "-1" 2>/dev/null); then return 1; fi
  if (validate_uint "X" "" 2>/dev/null); then return 1; fi
  if (validate_uint "X" "1.5" 2>/dev/null); then return 1; fi
  validate_uint "X" "0"   || return 1
  validate_uint "X" "15"  || return 1
  return 0
}

# validate_positive_uint rejects 0.
test_validate_positive_uint_rejects_zero() {
  if (validate_positive_uint "X" "0" 2>/dev/null); then return 1; fi
  validate_positive_uint "X" "1" || return 1
  return 0
}

# ============================================================================
# TESTS: Stuck-Detection Decision Logic (INV-DM-3/5)
# ============================================================================

# test_ceo_is_stuck_stalled_no_delivery — stalled traffic AND no delivery → stuck.
test_ceo_is_stuck_stalled_no_delivery() {
  _setup_ceo_state
  MOCK_LIVENESS_RC="1"   # stalled
  MOCK_DELIVERY_RC="1"   # no delivery
  ceo_is_stuck "ses_test" || return 1
  return 0
}

# test_ceo_is_stuck_stalled_with_delivery — stalled BUT delivery in progress → NOT stuck.
test_ceo_is_stuck_stalled_with_delivery() {
  _setup_ceo_state
  MOCK_LIVENESS_RC="1"   # stalled
  MOCK_DELIVERY_RC="0"   # delivery in progress
  if ceo_is_stuck "ses_test"; then return 1; fi
  return 0
}

# test_ceo_is_stuck_healthy_traffic — healthy session traffic → NOT stuck.
test_ceo_is_stuck_healthy_traffic() {
  _setup_ceo_state
  MOCK_LIVENESS_RC="0"   # healthy
  MOCK_DELIVERY_RC="1"   # no delivery
  if ceo_is_stuck "ses_test"; then return 1; fi
  return 0
}

# test_ceo_is_stuck_degraded_probe — degraded liveness probe → NOT stuck.
test_ceo_is_stuck_degraded_probe() {
  _setup_ceo_state
  MOCK_LIVENESS_RC="2"   # degraded
  MOCK_DELIVERY_RC="1"   # no delivery
  if ceo_is_stuck "ses_test"; then return 1; fi
  return 0
}

# test_ceo_is_stuck_empty_session — empty session id → NOT stuck (degraded).
test_ceo_is_stuck_empty_session() {
  _setup_ceo_state
  MOCK_LIVENESS_RC="2"   # _pm_liveness returns 2 for empty session
  if ceo_is_stuck ""; then return 1; fi
  return 0
}

# ============================================================================
# TESTS: PID File Lifecycle (F-3)
# ============================================================================

# test_pid_file_lifecycle — write, probe, clear.
test_pid_file_lifecycle() {
  _setup_ceo_state
  write_ceo_pid "12345" "$(date +%s)"
  [[ -f "${CEO_PID_FILE}" ]] || { echo "  PID file not written" >&2; return 1; }
  local pid
  pid="$(_jq -r '.pid // empty' "${CEO_PID_FILE}")"
  assert_eq "12345" "${pid}" "stored PID" || return 1
  clear_ceo_pid
  [[ ! -f "${CEO_PID_FILE}" ]] || { echo "  PID file not cleared" >&2; return 1; }
  return 0
}

# test_ceo_pid_if_live_rejects_dead_pid — dead PID → not live.
test_ceo_pid_if_live_rejects_dead_pid() {
  _setup_ceo_state
  write_ceo_pid "999999" "$(date +%s)"
  if ceo_pid_if_live 2>/dev/null; then return 1; fi
  return 0
}

# test_ceo_pid_if_live_accepts_opencode_process — live opencode process → live.
test_ceo_pid_if_live_accepts_opencode_process() {
  _setup_ceo_state
  local pid
  pid="$(_spawn_fake_ceo)"
  kill -0 "${pid}" 2>/dev/null || { echo "  setup: fake CEO not alive" >&2; return 1; }
  write_ceo_pid "${pid}" "$(date +%s)"
  local found
  found="$(ceo_pid_if_live)" || { _kill_if_alive "${pid}"; echo "  ceo_pid_if_live returned non-zero" >&2; return 1; }
  assert_eq "${pid}" "${found}" "ceo_pid_if_live should return the live PID" || return 1
  _kill_if_alive "${pid}"
  return 0
}

# test_ceo_pid_if_live_rejects_non_opencode — process whose cmdline lacks "opencode" → not live.
test_ceo_pid_if_live_rejects_non_opencode() {
  _setup_ceo_state
  # Spawn a plain sleep (cmdline has "sleep", not "opencode").
  sleep 30 &
  local pid=$!
  sleep 0.2
  write_ceo_pid "${pid}" "$(date +%s)"
  if ceo_pid_if_live 2>/dev/null; then
    _kill_if_alive "${pid}"
    echo "  should reject non-opencode process" >&2
    return 1
  fi
  _kill_if_alive "${pid}"
  return 0
}

# test_is_ceo_alive_no_pid_file — no PID file → not alive.
test_is_ceo_alive_no_pid_file() {
  _setup_ceo_state
  if is_ceo_alive 2>/dev/null; then return 1; fi
  return 0
}

# ============================================================================
# TESTS: F-3 Single-Flight — spawn_or_resume_ceo JOINs a live CEO
# ============================================================================

# test_spawn_joins_live_ceo_f3 — when a live CEO exists, JOIN (don't spawn).
test_spawn_joins_live_ceo_f3() {
  _setup_ceo_state
  local live_pid
  live_pid="$(_spawn_fake_ceo)"
  kill -0 "${live_pid}" 2>/dev/null || { echo "  setup: fake CEO not alive" >&2; return 1; }
  write_ceo_pid "${live_pid}" "$(date +%s)"

  : >"${MOCK_SETSID_CALLS}"  # ensure clean
  local returned_pid
  returned_pid="$(spawn_or_resume_ceo "${LOG_DIR}/test.log")"

  assert_eq "${live_pid}" "${returned_pid}" "should return the live CEO PID (JOIN)" || return 1
  # _setsid should NOT have been called.
  if [[ -s "${MOCK_SETSID_CALLS}" ]]; then
    echo "  _setsid should not be called when JOINing" >&2
    cat "${MOCK_SETSID_CALLS}" >&2
    _kill_if_alive "${live_pid}"
    return 1
  fi
  _kill_if_alive "${live_pid}"
  return 0
}

# test_spawn_fresh_when_no_ceo — no live CEO → spawn fresh (call _setsid).
test_spawn_fresh_when_no_ceo() {
  _setup_ceo_state
  : >"${MOCK_SETSID_CALLS}"
  # Override capture to avoid 10s loop.
  capture_session_id_by_title() { printf 'ses_fake_new'; }
  spawn_or_resume_ceo "${LOG_DIR}/test.log" >/dev/null
  sleep 0.2  # let the background _setsid mock finish
  [[ -s "${MOCK_SETSID_CALLS}" ]] || { echo "  _setsid should be called for fresh spawn" >&2; return 1; }
  return 0
}

# ============================================================================
# TESTS: Session Resume Decision (INV-DM-3)
# ============================================================================

# test_resume_under_threshold — context < limit → resume with --session.
test_resume_under_threshold() {
  _setup_ceo_state
  remember_session_id "ses_abc"
  MOCK_DB_RESULT='[{"total":50000}]'
  : >"${MOCK_SETSID_CALLS}"
  spawn_or_resume_ceo "${LOG_DIR}/test.log" >/dev/null
  sleep 0.2
  local cmd
  cmd="$(cat "${MOCK_SETSID_CALLS}" 2>/dev/null)" || cmd=""
  assert_contains "${cmd}" "--session ses_abc" "should resume with --session ses_abc" || return 1
  return 0
}

# test_fresh_over_threshold — context >= limit → fresh spawn with --agent ceo.
test_fresh_over_threshold() {
  _setup_ceo_state
  remember_session_id "ses_abc"
  MOCK_DB_RESULT='[{"total":150000}]'
  capture_session_id_by_title() { printf 'ses_new'; }
  : >"${MOCK_SETSID_CALLS}"
  spawn_or_resume_ceo "${LOG_DIR}/test.log" >/dev/null
  sleep 0.2
  local cmd
  cmd="$(cat "${MOCK_SETSID_CALLS}" 2>/dev/null)" || cmd=""
  assert_contains "${cmd}" "--agent ceo" "should spawn fresh with --agent ceo" || return 1
  assert_not_contains "${cmd}" "--session ses_abc" "should NOT resume" || return 1
  return 0
}

# test_fresh_when_no_previous_session — no last-session → fresh spawn.
test_fresh_when_no_previous_session() {
  _setup_ceo_state
  capture_session_id_by_title() { printf 'ses_new'; }
  : >"${MOCK_SETSID_CALLS}"
  spawn_or_resume_ceo "${LOG_DIR}/test.log" >/dev/null
  sleep 0.2
  local cmd
  cmd="$(cat "${MOCK_SETSID_CALLS}" 2>/dev/null)" || cmd=""
  assert_contains "${cmd}" "--agent ceo" "should spawn fresh with --agent ceo" || return 1
  return 0
}

# test_fresh_when_db_unavailable — previous session exists but DB fails → fresh.
test_fresh_when_db_unavailable() {
  _setup_ceo_state
  remember_session_id "ses_abc"
  MOCK_DB_RESULT=''   # empty → context_total_for returns empty
  capture_session_id_by_title() { printf 'ses_new'; }
  : >"${MOCK_SETSID_CALLS}"
  spawn_or_resume_ceo "${LOG_DIR}/test.log" >/dev/null
  sleep 0.2
  local cmd
  cmd="$(cat "${MOCK_SETSID_CALLS}" 2>/dev/null)" || cmd=""
  assert_contains "${cmd}" "--agent ceo" "should spawn fresh when DB unavailable" || return 1
  return 0
}

# test_resume_remembers_session_id — after a fresh spawn, session id is persisted.
test_resume_remembers_session_id() {
  _setup_ceo_state
  capture_session_id_by_title() { printf 'ses_remembered'; }
  spawn_or_resume_ceo "${LOG_DIR}/test.log" >/dev/null
  sleep 0.2
  local saved
  saved="$(last_session_id)"
  assert_eq "ses_remembered" "${saved}" "session id should be persisted after spawn" || return 1
  return 0
}

# ============================================================================
# TESTS: Durable Stop (#97)
# ============================================================================

# test_cmd_stop_writes_file — --stop writes the stop file.
test_cmd_stop_writes_file() {
  _setup_ceo_state
  cmd_stop
  [[ -f "${STOP_FILE}" ]] || { echo "  stop file not written" >&2; return 1; }
  return 0
}

# test_cmd_reset_clears_file — --reset removes the stop file.
test_cmd_reset_clears_file() {
  _setup_ceo_state
  cmd_stop
  [[ -f "${STOP_FILE}" ]] || return 1
  cmd_reset
  [[ ! -f "${STOP_FILE}" ]] || { echo "  stop file should be removed by --reset" >&2; return 1; }
  return 0
}

# test_durable_stop_survives_restart — stop file persists across process restarts.
test_durable_stop_survives_restart() {
  _setup_ceo_state
  cmd_stop
  [[ -f "${STOP_FILE}" ]] || return 1
  # Simulate a restart: call run_loop in a fresh context (stop file still present).
  : >"${MOCK_SPAWN_CALLS}"
  STUCK_SECONDS="3600" POLL_SECONDS="1" MAX_ITERATIONS="0" MAX_RESTARTS="0" \
    run_loop 2>/dev/null
  local rc=$?
  assert_eq "0" "${rc}" "run_loop should exit 0 when stop file present" || return 1
  [[ ! -s "${MOCK_SPAWN_CALLS}" ]] || { echo "  should not spawn CEO when stopped" >&2; return 1; }
  return 0
}

# test_stopped_file_not_wiped_at_startup — the stop file survives startup (seed bug #97).
test_stopped_file_not_wiped_at_startup() {
  _setup_ceo_state
  # Pre-create the stop file (as if written by a previous run).
  printf 'stopped at 2026-01-01T00:00:00Z\n' >"${STOP_FILE}"
  : >"${MOCK_SPAWN_CALLS}"
  STUCK_SECONDS="3600" POLL_SECONDS="1" MAX_ITERATIONS="0" MAX_RESTARTS="0" \
    run_loop 2>/dev/null || true
  [[ -f "${STOP_FILE}" ]] || { echo "  stop file should still exist after startup" >&2; return 1; }
  [[ ! -s "${MOCK_SPAWN_CALLS}" ]] || { echo "  should not spawn CEO when stopped" >&2; return 1; }
  return 0
}

# ============================================================================
# TESTS: Signal Propagation (INV-DM-2)
# ============================================================================

# test_cleanup_child_kills_ceo — _cleanup_child (EXIT trap) kills the CEO child.
test_cleanup_child_kills_ceo() {
  _setup_ceo_state
  # Spawn a fake CEO child.
  sleep 60 &
  local child_pid=$!
  sleep 0.2
  kill -0 "${child_pid}" 2>/dev/null || return 1
  CURRENT_CEO_PID="${child_pid}"
  write_ceo_pid "${child_pid}" "$(date +%s)"

  _cleanup_child

  sleep 1  # grace for SIGTERM to take effect
  if kill -0 "${child_pid}" 2>/dev/null; then
    echo "  CEO child should be killed by _cleanup_child" >&2
    kill -9 "${child_pid}" 2>/dev/null || true
    return 1
  fi
  [[ ! -f "${CEO_PID_FILE}" ]] || { echo "  PID file should be cleared" >&2; return 1; }
  return 0
}

# ============================================================================
# TESTS: Loop Integration (RUN_SLOW_TESTS=true)
# ============================================================================

# Helper: override spawn_or_resume_ceo to spawn a controlled sleep child in its
# own process group (via setsid). Records spawn invocations to MOCK_SPAWN_CALLS.
# The child blocks for MOCK_CEO_LIFETIME seconds (default 60) simulating a
# long-running CEO.  MUST be called as a function override, not directly.
_loop_spawn_override() {
  local log_file="$1"
  printf 'spawn\n' >>"${MOCK_SPAWN_CALLS}"
  # setsid puts the child in its own process group so kill_ceo_tree's
  # `kill -- -PID` targets the right group (not the test process).
  setsid sleep "${MOCK_CEO_LIFETIME}" >>"${log_file}" 2>&1 &
  local pid=$!
  CURRENT_CEO_PID="${pid}"
  write_ceo_pid "${pid}" "$(date +%s)"
  sleep 0.2  # let setsid child initialize
  printf '%s' "${pid}"
}

# test_stuck_ceo_killed_and_restarted — stalled + no delivery → kill + restart.
test_stuck_ceo_killed_and_restarted() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] (set RUN_SLOW_TESTS=true to run)\n'; return 0
  fi
  _setup_ceo_state
  MOCK_LIVENESS_RC="1"   # stalled
  MOCK_DELIVERY_RC="1"   # no delivery
  MOCK_CEO_LIFETIME="60"
  : >"${MOCK_SPAWN_CALLS}"
  spawn_or_resume_ceo() { _loop_spawn_override "$@"; }

  STUCK_SECONDS="2" POLL_SECONDS="1" MAX_RESTARTS="1" MAX_ITERATIONS="0" \
    LOOP_SLEEP_SECONDS="1" \
    run_loop 2>/dev/null || true

  local spawn_count
  spawn_count="$(wc -l <"${MOCK_SPAWN_CALLS}" 2>/dev/null)" || spawn_count="0"
  (( spawn_count >= 2 )) || { echo "  expected >=2 spawns (kill+restart), got ${spawn_count}" >&2; return 1; }
  return 0
}

# test_healthy_delivery_no_kill — stalled traffic BUT delivery in progress → no kill.
test_healthy_delivery_no_kill() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] (set RUN_SLOW_TESTS=true to run)\n'; return 0
  fi
  _setup_ceo_state
  MOCK_LIVENESS_RC="1"   # stalled
  MOCK_DELIVERY_RC="0"   # delivery in progress
  MOCK_CEO_LIFETIME="5"  # CEO exits naturally after 5s
  : >"${MOCK_SPAWN_CALLS}"
  spawn_or_resume_ceo() { _loop_spawn_override "$@"; }

  STUCK_SECONDS="2" POLL_SECONDS="1" MAX_RESTARTS="0" MAX_ITERATIONS="1" \
    LOOP_SLEEP_SECONDS="1" \
    run_loop 2>/dev/null

  local spawn_count
  spawn_count="$(wc -l <"${MOCK_SPAWN_CALLS}" 2>/dev/null)" || spawn_count="0"
  assert_eq "1" "${spawn_count}" "should NOT restart when delivery in progress" || return 1
  return 0
}

# test_healthy_session_traffic_no_kill — healthy traffic → no kill (INV-DM-5).
test_healthy_session_traffic_no_kill() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] (set RUN_SLOW_TESTS=true to run)\n'; return 0
  fi
  _setup_ceo_state
  MOCK_LIVENESS_RC="0"   # healthy
  MOCK_DELIVERY_RC="1"   # no delivery
  MOCK_CEO_LIFETIME="5"
  : >"${MOCK_SPAWN_CALLS}"
  spawn_or_resume_ceo() { _loop_spawn_override "$@"; }

  STUCK_SECONDS="2" POLL_SECONDS="1" MAX_RESTARTS="0" MAX_ITERATIONS="1" \
    LOOP_SLEEP_SECONDS="1" \
    run_loop 2>/dev/null

  local spawn_count
  spawn_count="$(wc -l <"${MOCK_SPAWN_CALLS}" 2>/dev/null)" || spawn_count="0"
  assert_eq "1" "${spawn_count}" "should NOT kill/restart when session traffic is healthy" || return 1
  return 0
}

# test_max_restarts_exhausts — every session stuck → N restarts then exit 1.
test_max_restarts_exhausts() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] (set RUN_SLOW_TESTS=true to run)\n'; return 0
  fi
  _setup_ceo_state
  MOCK_LIVENESS_RC="1"
  MOCK_DELIVERY_RC="1"
  MOCK_CEO_LIFETIME="60"
  : >"${MOCK_SPAWN_CALLS}"
  spawn_or_resume_ceo() { _loop_spawn_override "$@"; }

  STUCK_SECONDS="1" POLL_SECONDS="1" MAX_RESTARTS="2" MAX_ITERATIONS="0" \
    LOOP_SLEEP_SECONDS="1" \
    run_loop 2>/dev/null
  local rc=$?

  [[ ${rc} -ne 0 ]] || { echo "  expected non-zero exit after max restarts, got ${rc}" >&2; return 1; }
  local spawn_count
  spawn_count="$(wc -l <"${MOCK_SPAWN_CALLS}" 2>/dev/null)" || spawn_count="0"
  (( spawn_count >= 3 )) || { echo "  expected >=3 spawns (2 restarts + final), got ${spawn_count}" >&2; return 1; }
  return 0
}

# test_at_most_one_ceo_spawned — no double-spawn while CEO is alive.
test_at_most_one_ceo_spawned() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] (set RUN_SLOW_TESTS=true to run)\n'; return 0
  fi
  _setup_ceo_state
  MOCK_LIVENESS_RC="0"   # healthy (no kill)
  MOCK_DELIVERY_RC="1"
  MOCK_CEO_LIFETIME="5"  # CEO runs 5s then exits
  : >"${MOCK_SPAWN_CALLS}"
  spawn_or_resume_ceo() { _loop_spawn_override "$@"; }

  STUCK_SECONDS="3600" POLL_SECONDS="1" MAX_RESTARTS="0" MAX_ITERATIONS="1" \
    LOOP_SLEEP_SECONDS="1" \
    run_loop 2>/dev/null

  local spawn_count
  spawn_count="$(wc -l <"${MOCK_SPAWN_CALLS}" 2>/dev/null)" || spawn_count="0"
  assert_eq "1" "${spawn_count}" "should spawn exactly one CEO" || return 1
  return 0
}

# test_stop_file_honored_during_session — stop written during monitoring → exit.
test_stop_file_honored_during_session() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] (set RUN_SLOW_TESTS=true to run)\n'; return 0
  fi
  _setup_ceo_state
  MOCK_LIVENESS_RC="0"   # healthy
  MOCK_DELIVERY_RC="1"
  MOCK_CEO_LIFETIME="60"
  : >"${MOCK_SPAWN_CALLS}"
  spawn_or_resume_ceo() { _loop_spawn_override "$@"; }

  # Write stop file after 2s (simulating CEO writing it during session).
  ( sleep 2; printf 'stopped\n' >"${STOP_FILE}" ) &
  local stopper=$!

  STUCK_SECONDS="3600" POLL_SECONDS="1" MAX_RESTARTS="0" MAX_ITERATIONS="0" \
    LOOP_SLEEP_SECONDS="1" \
    run_loop 2>/dev/null
  local rc=$?
  wait "${stopper}" 2>/dev/null || true

  assert_eq "0" "${rc}" "should exit 0 when stop file appears during session" || return 1
  # Clean up any remaining CEO child.
  [[ -z "${CURRENT_CEO_PID:-}" ]] || _kill_if_alive "${CURRENT_CEO_PID}"
  return 0
}

# ============================================================================
# TESTS: Static Prompt Assertions for .opencode/agent/ceo.md (AC-4, INV-DM-4)
# ============================================================================
# Grep-based assertions on the canonical CEO prompt source. If the prompt is
# restructured, update the needle phrases — but the contract each test asserts
# must remain.

_CEO_PROMPT_PATH="${SCRIPT_DIR}/../.opencode/agent/ceo.md"

_read_ceo_prompt() {
  local p="${_CEO_PROMPT_PATH}"
  [[ -f "${p}" ]] || return 1
  cat "${p}"
}

# test_ceo_prompt_wait_for_delivery — INV-DM-1/4.
test_ceo_prompt_wait_for_delivery() {
  local prompt
  prompt="$(_read_ceo_prompt)" || { echo "  ceo.md not found" >&2; return 1; }
  assert_contains "${prompt}" "deliver-ticket.sh" "must reference deliver-ticket.sh" || return 1
  assert_contains "${prompt}" "wait" "must say wait" || return 1
  assert_contains "${prompt}" "last-message" "must reference last-message" || return 1
  return 0
}

# test_ceo_prompt_verify_pm_finalization — INV-DM-4.
test_ceo_prompt_verify_pm_finalization() {
  local prompt
  prompt="$(_read_ceo_prompt)" || { echo "  ceo.md not found" >&2; return 1; }
  assert_contains "${prompt}" "pm-notes" "must reference pm-notes" || return 1
  assert_contains "${prompt}" "11 phase" "must reference 11 phases" || return 1
  assert_contains "${prompt}" "before" "must say before merging" || return 1
  assert_contains "${prompt}" "merg" "must mention merge" || return 1
  return 0
}

# test_ceo_prompt_merge_not_yield — INV-DM-4 (#99).
test_ceo_prompt_merge_not_yield() {
  local prompt
  prompt="$(_read_ceo_prompt)" || { echo "  ceo.md not found" >&2; return 1; }
  assert_contains "${prompt}" "merge" "must mention merge" || return 1
  assert_contains "${prompt}" "yield" "must reference yield (merge-not-yield)" || return 1
  assert_contains "${prompt}" "proceed" "must say proceed" || return 1
  return 0
}

# test_ceo_prompt_never_detach — INV-DM-1.
test_ceo_prompt_never_detach() {
  local prompt
  prompt="$(_read_ceo_prompt)" || { echo "  ceo.md not found" >&2; return 1; }
  assert_contains "${prompt}" "detach" "must reference detach" || return 1
  assert_contains "${prompt}" "setsid" "must reference setsid" || return 1
  assert_contains "${prompt}" "MUST NEVER" "must use MUST NEVER phrasing" || return 1
  return 0
}

# test_ceo_prompt_multi_ticket_per_session — INV-DM-3.
test_ceo_prompt_multi_ticket_per_session() {
  local prompt
  prompt="$(_read_ceo_prompt)" || { echo "  ceo.md not found" >&2; return 1; }
  assert_contains "${prompt}" "many tickets" "must say many tickets" || return 1
  assert_contains "${prompt}" "next ticket" "must reference next ticket" || return 1
  return 0
}

# test_ceo_prompt_resume_prompt — INV-DM-4 (blocker resolution).
test_ceo_prompt_resume_prompt() {
  local prompt
  prompt="$(_read_ceo_prompt)" || { echo "  ceo.md not found" >&2; return 1; }
  assert_contains "${prompt}" "--resume-prompt" "must reference --resume-prompt" || return 1
  return 0
}

# test_ceo_prompt_must_must_not_phrasing — AC-4 structural quality.
test_ceo_prompt_must_must_not_phrasing() {
  local prompt
  prompt="$(_read_ceo_prompt)" || { echo "  ceo.md not found" >&2; return 1; }
  local must_count mustnot_count
  must_count="$(printf '%s' "${prompt}" | grep -ciE '\bMUST\b')" || must_count="0"
  mustnot_count="$(printf '%s' "${prompt}" | grep -ciE 'MUST NOT|MUST NEVER')" || mustnot_count="0"
  (( must_count >= 3 )) || { echo "  expected >=3 MUST phrases, got ${must_count}" >&2; return 1; }
  (( mustnot_count >= 2 )) || { echo "  expected >=2 MUST NOT/MUST NEVER phrases, got ${mustnot_count}" >&2; return 1; }
  return 0
}

# test_pr_manager_description_quality — F-6: PR descriptions usable as squash-commit body.
test_pr_manager_description_quality() {
  local pm_prompt
  local pm_path="${SCRIPT_DIR}/../.opencode/agent/pr-manager.md"
  [[ -f "${pm_path}" ]] || { echo "  pr-manager.md not found" >&2; return 1; }
  pm_prompt="$(cat "${pm_path}")"
  assert_contains "${pm_prompt}" "squash" "must reference squash-commit body" || return 1
  assert_contains "${pm_prompt}" "verbatim" "must say usable verbatim" || return 1
  return 0
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

main() {
  printf '=== test-ceo-loop.sh ===\n'

  # --- Input Validation ---
  run_test "validate_uint rejects garbage"           test_validate_uint_rejects_garbage
  run_test "validate_positive_uint rejects zero"     test_validate_positive_uint_rejects_zero

  # --- Stuck-Detection Decision Logic ---
  run_test "ceo_is_stuck: stalled + no delivery"     test_ceo_is_stuck_stalled_no_delivery
  run_test "ceo_is_stuck: stalled + delivery"        test_ceo_is_stuck_stalled_with_delivery
  run_test "ceo_is_stuck: healthy traffic"           test_ceo_is_stuck_healthy_traffic
  run_test "ceo_is_stuck: degraded probe"            test_ceo_is_stuck_degraded_probe
  run_test "ceo_is_stuck: empty session"             test_ceo_is_stuck_empty_session

  # --- PID File Lifecycle (F-3) ---
  run_test "PID file lifecycle (write/clear)"        test_pid_file_lifecycle
  run_test "ceo_pid_if_live rejects dead PID"        test_ceo_pid_if_live_rejects_dead_pid
  run_test "ceo_pid_if_live accepts opencode"        test_ceo_pid_if_live_accepts_opencode_process
  run_test "ceo_pid_if_live rejects non-opencode"    test_ceo_pid_if_live_rejects_non_opencode
  run_test "is_ceo_alive false with no PID file"     test_is_ceo_alive_no_pid_file

  # --- F-3 Single-Flight ---
  run_test "spawn JOINs live CEO (F-3)"              test_spawn_joins_live_ceo_f3
  run_test "spawn fresh when no CEO"                 test_spawn_fresh_when_no_ceo

  # --- Session Resume Decision ---
  run_test "resume under threshold"                  test_resume_under_threshold
  run_test "fresh over threshold"                    test_fresh_over_threshold
  run_test "fresh when no previous session"          test_fresh_when_no_previous_session
  run_test "fresh when DB unavailable"               test_fresh_when_db_unavailable
  run_test "resume remembers session id"             test_resume_remembers_session_id

  # --- Durable Stop (#97) ---
  run_test "cmd_stop writes file"                    test_cmd_stop_writes_file
  run_test "cmd_reset clears file"                   test_cmd_reset_clears_file
  run_test "durable stop survives restart"           test_durable_stop_survives_restart
  run_test "stop file not wiped at startup"          test_stopped_file_not_wiped_at_startup

  # --- Signal Propagation ---
  run_test "cleanup_child kills CEO"                 test_cleanup_child_kills_ceo

  # --- Loop Integration (RUN_SLOW_TESTS=true) ---
  run_test "stuck CEO killed + restarted"            test_stuck_ceo_killed_and_restarted
  run_test "healthy delivery no kill"                test_healthy_delivery_no_kill
  run_test "healthy session traffic no kill"         test_healthy_session_traffic_no_kill
  run_test "max restarts exhausts"                   test_max_restarts_exhausts
  run_test "at most one CEO spawned"                 test_at_most_one_ceo_spawned
  run_test "stop file honored during session"        test_stop_file_honored_during_session

  # --- Static Prompt Assertions (AC-4, INV-DM-4) ---
  run_test "ceo prompt: wait for delivery"           test_ceo_prompt_wait_for_delivery
  run_test "ceo prompt: verify PM finalization"      test_ceo_prompt_verify_pm_finalization
  run_test "ceo prompt: merge not yield"             test_ceo_prompt_merge_not_yield
  run_test "ceo prompt: never detach"                test_ceo_prompt_never_detach
  run_test "ceo prompt: multi ticket per session"    test_ceo_prompt_multi_ticket_per_session
  run_test "ceo prompt: resume prompt"               test_ceo_prompt_resume_prompt
  run_test "ceo prompt: must/must-not phrasing"      test_ceo_prompt_must_must_not_phrasing
  run_test "pr-manager: description quality (F-6)"   test_pr_manager_description_quality

  printf '\n'
  printf 'Results: %d passed, %d failed, %d total\n' \
    "${_test_passed}" "${_test_failed}" "${_test_count}"

  if (( _test_failed > 0 )); then
    exit 1
  fi
}

main "$@"
