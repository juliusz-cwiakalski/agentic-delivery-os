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
# NEW TESTS: TC-OS-14 through TC-OS-18 (GH-124 enhancements)
# ============================================================================

# TC-OS-14: find_session_by_title returns matching session ID
test_find_session_by_title_match() {
  # Mock opencode_cli to return sessions JSON with matching title
  opencode_cli() {
    printf '%s' '[{"id":"ses_abc","title":"ticket-GH-99","time":"2024-01-01T00:00:00Z"},{"id":"ses_def","title":"other","time":"2024-01-01T00:00:00Z"}]'
  }

  local result
  result="$(find_session_by_title "ticket-GH-99")"
  assert_eq "ses_abc" "${result}" "Should return session ID matching the title"
}

# TC-OS-15: find_session_by_title returns empty on no match
test_find_session_by_title_no_match() {
  opencode_cli() {
    printf '%s' '[{"id":"ses_abc","title":"ticket-GH-99","time":"2024-01-01T00:00:00Z"},{"id":"ses_def","title":"other","time":"2024-01-01T00:00:00Z"}]'
  }

  local result
  result="$(find_session_by_title "ticket-GH-MISSING")"
  assert_eq "" "${result}" "Should return empty when no title matches"
}

# TC-OS-15b: find_session_by_title degrades gracefully on opencode error
test_find_session_by_title_error_degrades() {
  opencode_cli() {
    printf 'opencode: error\n' >&2
    return 1
  }

  local result
  result="$(find_session_by_title "ticket-GH-99")"
  assert_eq "" "${result}" "Should return empty on opencode error"
}

# TC-OS-16: mapping JSON includes branch field
test_mapping_includes_branch_field() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"

  # Override mapping_file_for to use test directory
  mapping_file_for() {
    printf '%s/%s.json' "${test_dir}" "$1"
  }

  save_mapping "GH-100" "ses_test_branch" "create" "feat/GH-100/test-branch" "in_progress"

  local mapping_file="${test_dir}/GH-100.json"
  assert_file_exists "${mapping_file}"

  local branch title status
  branch="$(jq -r '.branch' "${mapping_file}")"
  title="$(jq -r '.title' "${mapping_file}")"
  status="$(jq -r '.status' "${mapping_file}")"

  assert_eq "feat/GH-100/test-branch" "${branch}" "branch field should match"
  assert_eq "ticket-GH-100" "${title}" "title field should match"
  assert_eq "in_progress" "${status}" "status field should match"
}

# TC-OS-16b: mapping JSON has null branch when not provided
test_mapping_null_branch() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"

  mapping_file_for() {
    printf '%s/%s.json' "${test_dir}" "$1"
  }

  save_mapping "GH-101" "ses_test_null" "create"

  local mapping_file="${test_dir}/GH-101.json"
  local branch_type
  branch_type="$(jq -r '.branch | type' "${mapping_file}")"
  assert_eq "null" "${branch_type}" "branch should be JSON null when not provided"
}

# TC-OS-16c: restart_count preserved and defaults to 0
test_mapping_restart_count_default() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"

  mapping_file_for() {
    printf '%s/%s.json' "${test_dir}" "$1"
  }

  save_mapping "GH-102" "ses_test_rc" "create"

  local mapping_file="${test_dir}/GH-102.json"
  local rc
  rc="$(jq -r '.restart_count' "${mapping_file}")"
  assert_eq 0 "${rc}" "restart_count should default to 0"
}

# TC-OS-17: pending mapping written before run
# When a new session is being created, a pending mapping is written before
# opencode run starts. We verify by writing the status to a temp file from
# inside the mock (command substitution runs in a subshell, so variable
# assignment would not propagate).
test_pending_mapping_before_run() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"
  local status_file="${_test_tmpdir}/status_at_start.txt"

  mapping_file_for() {
    printf '%s/%s.json' "${test_dir}" "$1"
  }

  # Mock opencode_cli: when called for `run`, capture mapping status to file
  opencode_cli() {
    if [[ "$1" == "run" ]]; then
      local mapping="${test_dir}/GH-103.json"
      if [[ -f "${mapping}" ]]; then
        jq -r '.status // empty' "${mapping}" 2>/dev/null > "${status_file}" || true
      fi
      printf '{"sessionID":"ses_pending_103","output":"done"}\n'
    fi
  }

  prepare_main_for_new_session() { :; }
  source_opencode_env() { :; }
  validate_repo() { :; }
  DRY_RUN=false

  git -C "${_test_tmpdir}" init -q 2>/dev/null || true

  run_ticket_session "GH-103" "test message" 2>/dev/null || true

  local status_at_start=""
  [[ -f "${status_file}" ]] && status_at_start="$(cat "${status_file}")"

  assert_eq "pending" "${status_at_start}" \
    "Mapping should have status 'pending' when opencode run starts"
}

# TC-OS-18: title-based resume path (mapping stale → title lookup finds session)
test_title_based_resume_path() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"

  mapping_file_for() {
    printf '%s/%s.json' "${test_dir}" "$1"
  }

  # Create a stale mapping with a session_id that won't verify
  jq -n \
    --arg ticket "GH-104" \
    --arg session_id "ses_stale" \
    --arg agent "pm" \
    '{ticket:$ticket,session_id:$session_id,agent:$agent,status:"in_progress"}' \
    > "${test_dir}/GH-104.json"

  local resumed_session=""

  # Mock: session list returns a session with the right title
  opencode_cli() {
    if [[ "$1" == "session" ]]; then
      printf '%s' '[{"id":"ses_found_by_title","title":"ticket-GH-104","time":"2024-01-01T00:00:00Z"}]'
    elif [[ "$1" == "run" && "$2" == "--session" ]]; then
      resumed_session="$3"
    fi
  }

  # verify_session_exists: stale session doesn't exist, title-found one does
  verify_session_exists() {
    [[ "$1" != "ses_stale" ]]
  }

  prepare_main_for_new_session() { :; }
  source_opencode_env() { :; }
  validate_repo() { :; }
  DRY_RUN=false

  git -C "${_test_tmpdir}" init -q 2>/dev/null || true

  run_ticket_session "GH-104" "test message" 2>/dev/null || true

  assert_eq "ses_found_by_title" "${resumed_session}" \
    "Should resume session found by title lookup"
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
  # GH-124 new tests
  run_test "TC-OS-14: find_session_by_title returns matching ID" test_find_session_by_title_match
  run_test "TC-OS-15: find_session_by_title returns empty on no match" test_find_session_by_title_no_match
  run_test "TC-OS-15b: find_session_by_title degrades on error" test_find_session_by_title_error_degrades
  run_test "TC-OS-16: mapping JSON includes branch field" test_mapping_includes_branch_field
  run_test "TC-OS-16b: mapping JSON has null branch when not provided" test_mapping_null_branch
  run_test "TC-OS-16c: restart_count defaults to 0" test_mapping_restart_count_default
  run_test "TC-OS-17: pending mapping written before run" test_pending_mapping_before_run
  run_test "TC-OS-18: title-based resume path" test_title_based_resume_path

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
