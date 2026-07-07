#!/usr/bin/env bash
# test-pm-liveness.sh — Tests for scripts/pm-liveness.sh
#
# Tests the session-traffic liveness probe (AC-5, INV-DM-5): pure decision
# logic (decide_stalled, gap-trend), graceful DB degradation, threshold env
# override, and the parseable key=value output contract. Mocks _opencode for
# the db surface via function override; never touches a real opencode DB.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-pm-liveness)"
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
  (( ++_test_count ))

  _test_setup

  if ( set -e; "${func}" ); then
    (( ++_test_passed ))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    (( ++_test_failed ))
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
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/pm-liveness.sh"

# Reset ERR trap — the sourced script sets its own.
trap - ERR

# ============================================================================
# TEST FIXTURES
# ============================================================================

# Build a JSON array of message rows {time_created,data} from a role and a set
# of millisecond timestamps (any order; sorted ascending internally). The data
# field is a JSON-encoded string carrying {"role":"<role>"}.
mk_messages() {
  local role="$1"; shift
  local ts first=1
  printf '['
  for ts in $(printf '%s\n' "$@" | sort -n); do
    (( first )) || printf ','
    printf '{"time_created":%s,"data":"{\\"role\\":\\"%s\\"}"}' "${ts}" "${role}"
    first=0
  done
  printf ']'
}

# Capture stdout + exit code of a function call into named refs.
capture_main() {
  local -n _co_out="$1"
  local -n _co_rc="$2"
  shift 2
  local _tmp
  _tmp="$(mktemp)"
  _co_rc=0
  "$@" >"${_tmp}" 2>/dev/null || _co_rc=$?
  _co_out="$(cat "${_tmp}")"
  rm -f "${_tmp}"
}

# ============================================================================
# TESTS: pure decision logic
# ============================================================================

# test_decide_stalled_at_threshold: exactly at threshold == stalled (>=).
test_decide_stalled_at_threshold() {
  decide_stalled 900 900 && return 0
  return 1
}

# test_decide_stalled_below_threshold: under threshold == healthy.
test_decide_stalled_below_threshold() {
  if decide_stalled 899 900; then
    return 1
  fi
  return 0
}

# test_gap_trend_growing_pure
test_gap_trend_growing_pure() {
  local trend
  trend="$(compute_gap_trend 10 30 90 200)"
  assert_eq "growing" "${trend}" "intervals 10,30,90,200 -> growing"
}

# test_gap_trend_shrinking_pure
test_gap_trend_shrinking_pure() {
  local trend
  trend="$(compute_gap_trend 200 90 30 10)"
  assert_eq "shrinking" "${trend}" "intervals 200,90,30,10 -> shrinking"
}

# test_gap_trend_stable_pure: roughly constant intervals.
test_gap_trend_stable_pure() {
  local trend
  trend="$(compute_gap_trend 30 30 30 30)"
  assert_eq "stable" "${trend}" "constant intervals -> stable"
}

# ============================================================================
# TESTS: integration with mocked _opencode db
# ============================================================================

# test_healthy_session: last message 30s ago, threshold 15 -> exit 0, ~30s.
test_healthy_session() {
  local now_ms last_ms
  now_ms=$(( $(date +%s) * 1000 ))
  last_ms=$(( now_ms - 30 * 1000 ))
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${last_ms}")" ;;
      *) return 1 ;;
    esac
  }

  local out rc
  capture_main out rc main "ses_healthy001"

  assert_eq 0 "${rc}" "healthy session (30s) -> exit 0"
  assert_contains "${out}" "seconds_since_last_message=30" "should report ~30s since last message"
}

# test_stale_session: last message 20min ago (1200s), threshold 15 -> stalled.
test_stale_session() {
  local now_ms last_ms
  now_ms=$(( $(date +%s) * 1000 ))
  last_ms=$(( now_ms - 20 * 60 * 1000 ))
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${last_ms}")" ;;
      *) return 1 ;;
    esac
  }

  local out rc
  capture_main out rc main "ses_stale001"

  [[ "${rc}" -ne 0 ]] || { printf '  expected non-zero exit for stale session\n' >&2; return 1; }
  assert_contains "${out}" "seconds_since_last_message=1200" "should report ~1200s"
}

# test_at_threshold_stalled: exactly 900s (15min) -> stalled (>=), exit !=0.
test_at_threshold_stalled() {
  local now_ms last_ms
  now_ms=$(( $(date +%s) * 1000 ))
  last_ms=$(( now_ms - 900 * 1000 ))
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${last_ms}")" ;;
      *) return 1 ;;
    esac
  }

  local out rc
  capture_main out rc main "ses_at_threshold001"

  [[ "${rc}" -ne 0 ]] || { printf '  expected non-zero exit at threshold (>=)\n' >&2; return 1; }
  assert_contains "${out}" "seconds_since_last_message=900" "should report 900s"
}

# test_growing_gap: intervals 10,30,90,200s -> gap_trend=growing.
test_growing_gap() {
  local now_ms t0 t1 t2 t3 t4
  now_ms=$(( $(date +%s) * 1000 ))
  # newest == now; walk back the intervals 200,90,30,10.
  t4="${now_ms}"
  t3=$(( t4 - 200 * 1000 ))
  t2=$(( t3 - 90 * 1000 ))
  t1=$(( t2 - 30 * 1000 ))
  t0=$(( t1 - 10 * 1000 ))
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${t0}" "${t1}" "${t2}" "${t3}" "${t4}")" ;;
      *) return 1 ;;
    esac
  }

  local out rc
  capture_main out rc main "ses_growing001"

  assert_contains "${out}" "gap_trend=growing" "increasing intervals -> growing"
}

# test_shrinking_gap: intervals 200,90,30,10s -> gap_trend=shrinking.
test_shrinking_gap() {
  local now_ms t0 t1 t2 t3 t4
  now_ms=$(( $(date +%s) * 1000 ))
  t4="${now_ms}"
  t3=$(( t4 - 10 * 1000 ))
  t2=$(( t3 - 30 * 1000 ))
  t1=$(( t2 - 90 * 1000 ))
  t0=$(( t1 - 200 * 1000 ))
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${t0}" "${t1}" "${t2}" "${t3}" "${t4}")" ;;
      *) return 1 ;;
    esac
  }

  local out rc
  capture_main out rc main "ses_shrinking001"

  assert_contains "${out}" "gap_trend=shrinking" "decreasing intervals -> shrinking"
}

# test_graceful_degradation_db_failure: opencode db fails -> warn + fallback,
# controlled exit, no crash, last_step=fallback-worktree. Uses the real repo
# ROOT_DIR (which is actively being written during the test run, so the
# worktree-fallback says healthy -> exit 0). The point: NO crash + WARN.
test_graceful_degradation_db_failure() {
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    # Simulate an unavailable opencode DB.
    printf 'opencode: db not available\n' >&2
    return 1
  }

  local out err rc tmp_out tmp_err
  tmp_out="$(mktemp)"; tmp_err="$(mktemp)"
  rc=0
  main "ses_degrade001" >"${tmp_out}" 2>"${tmp_err}" || rc=$?
  out="$(cat "${tmp_out}")"; err="$(cat "${tmp_err}")"
  rm -f "${tmp_out}" "${tmp_err}"

  assert_contains "${err}" "[WARN]" "degraded mode must log a WARN"
  assert_contains "${err}" "fallback" "degraded mode must mention fallback"
  assert_contains "${out}" "last_step=fallback-worktree" "must report fallback signal"
  # Controlled exit (0 healthy fallback — repo worktree is active in-test).
  assert_eq 0 "${rc}" "active worktree -> healthy fallback, exit 0"
}

# test_threshold_env_override: CEO_LOOP_STALL_MINUTES=5; 6min ago -> stalled,
# 3min ago -> healthy.
test_threshold_env_override() {
  local now_ms six_ago three_ago
  now_ms=$(( $(date +%s) * 1000 ))
  six_ago=$(( now_ms - 6 * 60 * 1000 ))
  three_ago=$(( now_ms - 3 * 60 * 1000 ))

  # 6 minutes ago with a 5-minute threshold -> stalled.
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${six_ago}")" ;;
      *) return 1 ;;
    esac
  }
  local out rc
  CEO_LOOP_STALL_MINUTES=5 capture_main out rc main "ses_thr_override1"
  [[ "${rc}" -ne 0 ]] || { printf '  6min @ threshold 5 should be stalled\n' >&2; return 1; }

  # 3 minutes ago with a 5-minute threshold -> healthy.
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${three_ago}")" ;;
      *) return 1 ;;
    esac
  }
  CEO_LOOP_STALL_MINUTES=5 capture_main out rc main "ses_thr_override2"
  assert_eq 0 "${rc}" "3min @ threshold 5 should be healthy"
}

# test_output_format_parseable: stdout has the three named keys.
test_output_format_parseable() {
  local now_ms last_ms
  now_ms=$(( $(date +%s) * 1000 ))
  last_ms=$(( now_ms - 5 * 1000 ))
  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${last_ms}")" ;;
      *) return 1 ;;
    esac
  }

  local out rc
  capture_main out rc main "ses_format001"

  assert_contains "${out}" "seconds_since_last_message=" "key present"
  assert_contains "${out}" "last_step=" "key present"
  assert_contains "${out}" "gap_trend=" "key present"
}

# test_default_threshold_is_15: regression guard — default stall is 15 minutes.
test_default_threshold_is_15() {
  # 14 minutes ago -> healthy under default (15). 16 minutes ago -> stalled.
  local now_ms fourteen_ago sixteen_ago
  now_ms=$(( $(date +%s) * 1000 ))
  fourteen_ago=$(( now_ms - 14 * 60 * 1000 ))
  sixteen_ago=$(( now_ms - 16 * 60 * 1000 ))

  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${fourteen_ago}")" ;;
      *) return 1 ;;
    esac
  }
  local out rc
  capture_main out rc main "ses_default_thr1"
  assert_eq 0 "${rc}" "14min ago @ default(15) -> healthy"

  # shellcheck disable=SC2329  # indirect override of the sourced _opencode(), called via main()
  _opencode() {
    case "$1" in
      db) printf '%s' "$(mk_messages assistant "${sixteen_ago}")" ;;
      *) return 1 ;;
    esac
  }
  capture_main out rc main "ses_default_thr2"
  [[ "${rc}" -ne 0 ]] || { printf '  16min ago @ default(15) -> should be stalled\n' >&2; return 1; }
}

# test_usage_missing_session: no session_id -> exit 2.
test_usage_missing_session() {
  local rc=0
  ( main "" ) >/dev/null 2>&1 || rc=$?
  assert_eq 2 "${rc}" "missing session_id -> usage error (exit 2)"
}

# test_validate_session_id: rejects garbage.
test_validate_session_id() {
  if validate_session_id "ses ok"; then return 1; fi
  if validate_session_id "'; DROP TABLE"; then return 1; fi
  validate_session_id "ses_abc-123" || return 1
  return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================
main_tests() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  run_test "decide_stalled: at threshold == stalled" test_decide_stalled_at_threshold
  run_test "decide_stalled: below threshold == healthy" test_decide_stalled_below_threshold
  run_test "compute_gap_trend: growing" test_gap_trend_growing_pure
  run_test "compute_gap_trend: shrinking" test_gap_trend_shrinking_pure
  run_test "compute_gap_trend: stable" test_gap_trend_stable_pure
  run_test "healthy session (30s)" test_healthy_session
  run_test "stale session (20min)" test_stale_session
  run_test "at threshold (900s) stalled" test_at_threshold_stalled
  run_test "growing gap trend" test_growing_gap
  run_test "shrinking gap trend" test_shrinking_gap
  run_test "graceful degradation on db failure" test_graceful_degradation_db_failure
  run_test "threshold env override" test_threshold_env_override
  run_test "output format parseable" test_output_format_parseable
  run_test "default threshold is 15" test_default_threshold_is_15
  run_test "usage: missing session -> exit 2" test_usage_missing_session
  run_test "validate_session_id rejects garbage" test_validate_session_id

  printf '\n%s Summary: %d/%d passed' "${TEST_TAG}" "${_test_passed}" "${_test_count}"
  if [[ "${_test_failed}" -gt 0 ]]; then
    printf ' (%s%d failed%s)\n' "${_RED}" "${_test_failed}" "${_RESET}"
    return 1
  else
    printf ' %s(all passed)%s\n' "${_GREEN}" "${_RESET}"
    return 0
  fi
}

main_tests "$@"
