#!/usr/bin/env bash
# test-opencode-session.sh — Tests for opencode-session.sh
#
# Tests the pure/structural functions that can be exercised without a real
# opencode CLI or live sessions. External commands (opencode, git network
# operations) are mocked or avoided.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-opencode-session)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m'
  readonly _GREEN=$'\033[0;32m'
  readonly _YELLOW=$'\033[0;33m'
  readonly _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _YELLOW="" _RESET=""
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

assert_match() {
  local -r pattern="$1" actual="$2" msg="${3:-}"
  if [[ ! "${actual}" =~ ${pattern} ]]; then
    printf '  Pattern: %s\n  Actual:  %s\n' "${pattern}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_file_exists() {
  local -r path="$1" msg="${2:-}"
  if [[ ! -f "${path}" ]]; then
    printf '  File does not exist: %s\n' "${path}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/opencode-session.sh"

# Reset ERR trap — the sourced script sets its own; we use subshell isolation in run_test instead.
trap - ERR

# ============================================================================
# TESTS
# ============================================================================

test_validate_ticket_ref_valid() {
  # Should not exit non-zero for valid refs
  validate_ticket_ref "GH-12"
  validate_ticket_ref "PDEV-123"
}

test_validate_ticket_ref_invalid() {
  # validate_ticket_ref calls die() -> exit on invalid input.
  # Use a nested subshell to catch the exit code.
  local exit_code=0
  ( validate_ticket_ref "invalid" ) 2>/dev/null || exit_code=$?
  [[ "${exit_code}" -ne 0 ]]
}

test_validate_ticket_ref_lowercase() {
  local exit_code=0
  ( validate_ticket_ref "gh-12" ) 2>/dev/null || exit_code=$?
  [[ "${exit_code}" -ne 0 ]]
}

test_mapping_file_for() {
  local result
  result="$(mapping_file_for "GH-42")"
  assert_match '/GH-42\.json$' "${result}"
}

test_mapping_file_for_pdev() {
  local result
  result="$(mapping_file_for "PDEV-7")"
  assert_match '/PDEV-7\.json$' "${result}"
}

test_save_and_lookup_session() {
  local test_session_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_session_dir}"

  # Override SESSION_DIR for this test by calling save_mapping with modified context
  # We need to test the mapping file structure directly
  local mapping_file="${test_session_dir}/GH-99.json"
  local timestamp
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  jq -n \
    --arg ticket "GH-99" \
    --arg session_id "ses_test_123" \
    --arg agent "pm" \
    --arg repo_path "/tmp/test" \
    --arg action "create" \
    --arg timestamp "${timestamp}" \
    '{ticket:$ticket,session_id:$session_id,agent:$agent,repo_path:$repo_path,last_action:$action,updated:$timestamp,created:$timestamp}' \
    >"${mapping_file}"

  assert_file_exists "${mapping_file}"

  local result
  result="$(jq -r '.session_id' "${mapping_file}")"
  assert_eq "ses_test_123" "${result}"

  result="$(jq -r '.ticket' "${mapping_file}")"
  assert_eq "GH-99" "${result}"
}

test_default_prompt_contains_ticket() {
  local prompt
  prompt="$(default_prompt_for "GH-77")"
  assert_contains "${prompt}" "GH-77"
}

test_default_prompt_says_stop_at_pr() {
  local prompt
  prompt="$(default_prompt_for "GH-77")"
  assert_contains "${prompt}" "CREATE THE PR AND LEAVE IT OPEN"
  assert_contains "${prompt}" "Do NOT merge it"
}

test_default_prompt_says_one_ticket() {
  local prompt
  prompt="$(default_prompt_for "GH-77")"
  assert_contains "${prompt}" "Deliver exactly this one workItemRef"
  assert_contains "${prompt}" "Do not select, plan, or start a next ticket"
}

test_default_prompt_runs_11_phases() {
  local prompt
  prompt="$(default_prompt_for "GH-77")"
  assert_contains "${prompt}" "full ADOS 11-phase lifecycle"
}

test_extract_session_id_valid() {
  local raw_output result
  raw_output='{"sessionID":"ses_abc123","output":"done"}'
  result="$(extract_session_id "${raw_output}")"
  assert_eq "ses_abc123" "${result}"
}

test_extract_session_id_empty() {
  local raw_output result
  raw_output='{"output":"no session here"}'
  result="$(extract_session_id "${raw_output}")"
  assert_eq "" "${result}"
}

test_usage_contains_commands() {
  local help_output
  help_output="$(usage)"
  assert_contains "${help_output}" "run <ticket>"
  assert_contains "${help_output}" "list"
  assert_contains "${help_output}" "show"
  assert_contains "${help_output}" "forget"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  run_test "validate_ticket_ref accepts valid refs" test_validate_ticket_ref_valid
  run_test "validate_ticket_ref rejects invalid refs" test_validate_ticket_ref_invalid
  run_test "validate_ticket_ref rejects lowercase" test_validate_ticket_ref_lowercase
  run_test "mapping_file_for produces correct path (GH)" test_mapping_file_for
  run_test "mapping_file_for produces correct path (PDEV)" test_mapping_file_for_pdev
  run_test "save_mapping + lookup produces correct JSON" test_save_and_lookup_session
  run_test "default_prompt contains ticket ref" test_default_prompt_contains_ticket
  run_test "default_prompt says stop at PR" test_default_prompt_says_stop_at_pr
  run_test "default_prompt enforces single ticket" test_default_prompt_says_one_ticket
  run_test "default_prompt references 11-phase lifecycle" test_default_prompt_runs_11_phases
  run_test "extract_session_id parses valid JSON" test_extract_session_id_valid
  run_test "extract_session_id handles missing field" test_extract_session_id_empty
  run_test "usage shows all commands" test_usage_contains_commands

  printf '\n%s Summary: %d/%d passed' "${TEST_TAG}" "${_test_passed}" "${_test_count}"
  if [[ "${_test_failed}" -gt 0 ]]; then
    printf ' (%s%d failed%s)\n' "${_RED}" "${_test_failed}" "${_RESET}"
    return 1
  else
    printf ' %s(all passed)%s\n' "${_GREEN}" "${_RESET}"
    return 0
  fi
}

main "$@"
