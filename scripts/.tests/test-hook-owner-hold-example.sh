#!/usr/bin/env bash
# shellcheck disable=SC2016,SC2034,SC2329
# Tests the inactive owner-hold pre-iteration hook without real sleeps.
#
# Determinism contract: the sleep seam and the marker-reader seam are overridden
# before invoking main; the fixed marker path is a temp HOME's production store.
# The suite performs zero real sleeps and zero network calls.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly SCRIPT_DIR

TEST_ROOT="$(mktemp -d)"
export HOME="${TEST_ROOT}/home"
mkdir -p "${HOME}/.delivery-os-state"
readonly TEST_ROOT
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/hooks/pre-opencode-iteration-owner-hold.sh"

pass=0; fail=0
check() { if "$2"; then printf '[PASS] %s\n' "$1"; ((++pass)); else printf '[FAIL] %s\n' "$1" >&2; ((++fail)); fi; }

RUN_OUT="${TEST_ROOT}/run.out"
SLEEP_LOG=""
SLEEP_COUNT=0
SLEEP_LIMIT=0
MARKER="${HOME}/.delivery-os-state/owner-hold"

_clear_hold() {
  unset DELIVERY_OS_OWNER_HOLD 2>/dev/null || true
  rm -f "${MARKER}"
}
reset_case() {
  _clear_hold
  unset DELIVERY_OS_OWNER_HOLD_POLL_SECONDS 2>/dev/null || true
  SLEEP_LOG=""
  SLEEP_COUNT=0
  SLEEP_LIMIT=0
  : > "${RUN_OUT}"
}
set_marker() { printf '%s' "$1" > "${MARKER}"; }
# Record the sleep; after SLEEP_LIMIT sleeps, clear the hold so main terminates.
_sleep() {
  SLEEP_LOG="${SLEEP_LOG:+${SLEEP_LOG} }$1"
  SLEEP_COUNT=$((SLEEP_COUNT + 1))
  if (( SLEEP_LIMIT > 0 && SLEEP_COUNT >= SLEEP_LIMIT )); then _clear_hold; fi
}
run_main() {
  RUN_RC=0
  main >"${RUN_OUT}" 2>&1 || RUN_RC=$?
}
line_count() { grep -c -E -- "$1" "${RUN_OUT}" 2>/dev/null || true; }

# --- TC-HOLDHOOK-001 active hold sleeps the default poll and prints one line ---
test_001_env_default() {
  reset_case; SLEEP_LIMIT=1; DELIVERY_OS_OWNER_HOLD="peak-hour cost pause"
  run_main
  (( RUN_RC == 0 )) || return 1
  [[ "${SLEEP_LOG}" == "300" ]] || return 1
  [[ "$(line_count '\[INFO\]')" == "1" ]] || return 1
  grep -qF '[INFO] (pre-opencode-iteration-owner-hold) owner-hold (env): peak-hour cost pause; sleeping 300s' "${RUN_OUT}" || return 1
  [[ "$(grep -c '' "${RUN_OUT}")" == "1" ]] || return 1
}
test_002_marker_default() {
  reset_case; SLEEP_LIMIT=1; set_marker $'peak-hour cost pause\nsecond line'
  run_main
  (( RUN_RC == 0 )) || return 1
  [[ "${SLEEP_LOG}" == "300" ]] || return 1
  grep -qF 'owner-hold (marker): peak-hour cost pause; sleeping 300s' "${RUN_OUT}" || return 1
  grep -qF 'second line' "${RUN_OUT}" && return 1
  return 0
}

# --- TC-HOLDHOOK-002 inactive returns immediately with no sleep and no line ---
test_003_inactive() {
  reset_case
  run_main
  (( RUN_RC == 0 )) || return 1
  [[ -z "${SLEEP_LOG}" ]] || return 1
  [[ "$(line_count '\[INFO\]')" == "0" ]] || return 1
  [[ ! -s "${RUN_OUT}" ]] || return 1
}

# --- TC-HOLDHOOK-003 no fixed loop cap while held ---
test_004_no_cap() {
  reset_case; SLEEP_LIMIT=25; DELIVERY_OS_OWNER_HOLD="long hold"
  run_main
  (( RUN_RC == 0 )) || return 1
  (( SLEEP_COUNT == 25 )) || return 1
  [[ "$(line_count 'cap')" == "0" ]] || return 1
  [[ "$(line_count '\[WARN\]')" == "0" ]] || return 1
}

# --- TC-HOLDHOOK-004 poll accepted range, silent defaults, one warning ---
test_005_poll_values() {
  local value expected warns
  for value in 1 600 3600; do
    reset_case; SLEEP_LIMIT=1; DELIVERY_OS_OWNER_HOLD="hold"; DELIVERY_OS_OWNER_HOLD_POLL_SECONDS="${value}"
    run_main
    (( RUN_RC == 0 )) || return 1
    [[ "${SLEEP_LOG}" == "${value}" ]] || return 1
    [[ "$(line_count '\[WARN\]')" == "0" ]] || return 1
  done
  for value in 0 -1 abc 99999; do
    reset_case; SLEEP_LIMIT=1; DELIVERY_OS_OWNER_HOLD="hold"; DELIVERY_OS_OWNER_HOLD_POLL_SECONDS="${value}"
    run_main
    (( RUN_RC == 0 )) || return 1
    [[ "${SLEEP_LOG}" == "300" ]] || return 1
    [[ "$(line_count '\[WARN\]')" == "1" ]] || return 1
  done
  for value in "" "   " $'\t'; do
    reset_case; SLEEP_LIMIT=1; DELIVERY_OS_OWNER_HOLD="hold"; DELIVERY_OS_OWNER_HOLD_POLL_SECONDS="${value}"
    run_main
    (( RUN_RC == 0 )) || return 1
    [[ "${SLEEP_LOG}" == "300" ]] || return 1
    [[ "$(line_count '\[WARN\]')" == "0" ]] || return 1
  done
  # unset silently defaults too.
  reset_case; SLEEP_LIMIT=1; DELIVERY_OS_OWNER_HOLD="hold"
  run_main
  (( RUN_RC == 0 )) || return 1
  [[ "${SLEEP_LOG}" == "300" ]] || return 1
  [[ "$(line_count '\[WARN\]')" == "0" ]] || return 1
}

# --- TC-HOLDHOOK-005 removing the marker during a sleep ends the hold ---
test_006_marker_removal() {
  reset_case; SLEEP_LIMIT=1; set_marker "pause"
  run_main
  (( RUN_RC == 0 )) || return 1
  (( SLEEP_COUNT == 1 )) || return 1
  [[ "${SLEEP_LOG}" == "300" ]] || return 1
  # A second run with no marker is inactive.
  reset_case
  run_main
  (( RUN_RC == 0 )) || return 1
  [[ -z "${SLEEP_LOG}" ]] || return 1
}

# --- TC-HOLDHOOK-006 conditions compose by MAX and the hold remains the floor ---
test_007_max_composition() {
  reset_case; DELIVERY_OS_OWNER_HOLD="hold"
  local counter="${TEST_ROOT}/peak-calls"
  : > "${counter}"
  howLongToSleepDueToPeakHours() {
    local n
    n="$(cat "${counter}" 2>/dev/null || printf 0)"
    n=$((n + 1))
    printf '%s' "${n}" > "${counter}"
    if (( n == 1 )); then printf '3600'; else printf '0'; fi
  }
  # shellcheck disable=SC2034
  OWNER_HOLD_CONDITIONS=(howLongToSleepDueToOwnerHold howLongToSleepDueToPeakHours)
  SLEEP_LIMIT=2
  run_main
  unset -f howLongToSleepDueToPeakHours
  OWNER_HOLD_CONDITIONS=(howLongToSleepDueToOwnerHold)
  (( RUN_RC == 0 )) || return 1
  [[ "${SLEEP_LOG}" == "3600 300" ]] || return 1
}

# --- TC-HOLDHOOK-007 pure gate: no env output, no file, no signal ---
test_008_pure_gate() {
  reset_case; SLEEP_LIMIT=1; DELIVERY_OS_OWNER_HOLD="hold"
  local before after
  before="$(find "${TEST_ROOT}" -type f | sort)"
  run_main
  after="$(find "${TEST_ROOT}" -type f | sort)"
  (( RUN_RC == 0 )) || return 1
  [[ "${before}" == "${after}" ]] || return 1
  grep -q 'ADOS_HOOK_ENV_V1' "${RUN_OUT}" && return 1
  grep -qE '\b(kill|pkill|killall)\b' "${RUN_OUT}" && return 1
  return 0
}

# --- TC-HOLDHOOK-008 no clock decision (a day jump is neutral) ---
test_009_clock_jump() {
  reset_case; SLEEP_LIMIT=1; DELIVERY_OS_OWNER_HOLD="hold"
  TZ="Pacific/Kiritimati" run_main
  (( RUN_RC == 0 )) || return 1
  [[ "${SLEEP_LOG}" == "300" ]] || return 1
  ! grep -qE '(^|[^[:alnum:]_])date([^[:alnum:]_]|$)' "${SCRIPT_DIR}/hooks/pre-opencode-iteration-owner-hold.sh" || return 1
  ! grep -q '_now_utc_epoch' "${SCRIPT_DIR}/hooks/pre-opencode-iteration-owner-hold.sh" || return 1
}

# --- TC-HOLDHOOK-009 the line is single-line, source-named, and bounded ---
test_010_line_bounded() {
  reset_case; SLEEP_LIMIT=1
  local long reason line
  long="$(printf 'a%.0s' {1..300})"
  DELIVERY_OS_OWNER_HOLD="${long}"
  run_main
  (( RUN_RC == 0 )) || return 1
  [[ "$(line_count '\[INFO\]')" == "1" ]] || return 1
  line="$(grep -F '[INFO]' "${RUN_OUT}")"
  reason="${line#*owner-hold (env): }"
  reason="${reason%; sleeping 300s}"
  [[ "${#reason}" -le 160 ]] || return 1
  [[ "${line}" != *$'\n'* ]] || return 1
  # Control characters and ANSI are stripped.
  reset_case; SLEEP_LIMIT=1
  DELIVERY_OS_OWNER_HOLD=$'  \e[31mred\e[0m\u0007 reason  '
  run_main
  (( RUN_RC == 0 )) || return 1
  grep -qF 'owner-hold (env): red reason; sleeping 300s' "${RUN_OUT}" || return 1
  ! grep -q $'\e' "${RUN_OUT}" || return 1
}

# --- Fixed path and no override negatives ---
test_011_fixed_path_no_override() {
  reset_case; SLEEP_LIMIT=1
  mkdir -p "${TEST_ROOT}/relocated"
  printf 'relocated' > "${TEST_ROOT}/relocated/owner-hold"
  DELIVERY_OS_STATE_DIR="${TEST_ROOT}/relocated" DELIVERY_OS_OWNER_HOLD_FILE="${TEST_ROOT}/relocated/owner-hold" run_main
  (( RUN_RC == 0 )) || return 1
  [[ -z "${SLEEP_LOG}" ]] || return 1
  # The fixed production path still works.
  reset_case; SLEEP_LIMIT=1; set_marker "fixed path"
  run_main
  (( RUN_RC == 0 )) || return 1
  grep -qF 'owner-hold (marker): fixed path' "${RUN_OUT}" || return 1
}

# --- Hermetic: zero real sleeps and zero network calls ---
test_012_hermetic() {
  reset_case; SLEEP_LIMIT=1; DELIVERY_OS_OWNER_HOLD="hold"
  local sleep_flag="${TEST_ROOT}/real-sleep" net_flag="${TEST_ROOT}/network"
  : > "${sleep_flag}"; : > "${net_flag}"
  sleep() { echo "REAL-SLEEP $*" >> "${sleep_flag}"; }
  curl() { echo "NETWORK $*" >> "${net_flag}"; return 1; }
  wget() { echo "NETWORK $*" >> "${net_flag}"; return 1; }
  run_main
  unset -f sleep curl wget
  (( RUN_RC == 0 )) || return 1
  [[ ! -s "${sleep_flag}" ]] || return 1
  [[ ! -s "${net_flag}" ]] || return 1
}

# --- Fixed-path self-description in the source ---
test_013_source_contract() {
  local hook="${SCRIPT_DIR}/hooks/pre-opencode-iteration-owner-hold.sh"
  grep -q 'OWNER_HOLD_MARKER_PATH="\${HOME}/.delivery-os-state/owner-hold"' "${hook}" || return 1
  grep -q 'DELIVERY_OS_OWNER_HOLD_POLL_SECONDS' "${hook}" || return 1
  grep -q 'DELIVERY_OS_OWNER_HOLD' "${hook}" || return 1
  ! grep -q 'DELIVERY_OS_OWNER_HOLD_FILE' "${hook}" || return 1
  ! grep -q 'DELIVERY_OS_STATE_DIR' "${hook}" || return 1
}

check 'TC-HOLDHOOK-001 env default poll 300' test_001_env_default
check 'TC-HOLDHOOK-001 marker source reason line' test_002_marker_default
check 'TC-HOLDHOOK-002 inactive returns immediately' test_003_inactive
check 'TC-HOLDHOOK-003 no fixed loop cap while held' test_004_no_cap
check 'TC-HOLDHOOK-004 poll range, defaults, one warning' test_005_poll_values
check 'TC-HOLDHOOK-005 marker removal during sleep' test_006_marker_removal
check 'TC-HOLDHOOK-006 MAX composition and hold floor' test_007_max_composition
check 'TC-HOLDHOOK-007 pure gate, no env output/file/signal' test_008_pure_gate
check 'TC-HOLDHOOK-008 no clock decision' test_009_clock_jump
check 'TC-HOLDHOOK-009 line bounded and sanitized' test_010_line_bounded
check 'TC-HOLDHOOK-009 fixed path, no override' test_011_fixed_path_no_override
check 'TC-HOLDREG-003 hermetic suite' test_012_hermetic
check 'TC-HOLDHOOK-009 source contract' test_013_source_contract

printf 'Results: %d passed, %d failed\n' "${pass}" "${fail}"
(( fail == 0 ))
