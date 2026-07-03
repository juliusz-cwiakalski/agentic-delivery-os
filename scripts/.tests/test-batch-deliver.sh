#!/usr/bin/env bash
# test-batch-deliver.sh — Tests for scripts/batch-deliver.sh
#
# Tests pure functions (ticket parsing, duration formatting, summary output),
# mockable functions (pre-flight skip checks), and array building.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-batch-deliver)"
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

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/batch-deliver.sh"

# Reset ERR trap — the sourced script sets its own.
trap - ERR

# ============================================================================
# TESTS: Ticket Parsing (TC-BD-01 through TC-BD-03)
# ============================================================================

# TC-BD-01: ticket parsing — positional args → array of {ticket, branch?}
test_parse_positional_args() {
  PARSED_TICKETS=()
  PARSED_BRANCHES=()

  add_ticket "GH-108"
  add_ticket "GH-110"
  add_ticket "GH-37"

  assert_eq 3 "${#PARSED_TICKETS[@]}" "Should have 3 tickets"
  assert_eq "GH-108" "${PARSED_TICKETS[0]}"
  assert_eq "GH-110" "${PARSED_TICKETS[1]}"
  assert_eq "GH-37" "${PARSED_TICKETS[2]}"
  assert_eq "" "${PARSED_BRANCHES[0]}" "Branch should be empty for positional"
  assert_eq "" "${PARSED_BRANCHES[1]}"
  assert_eq "" "${PARSED_BRANCHES[2]}"
}

# TC-BD-02: ticket parsing — colon syntax → ticket + branch extracted
test_parse_colon_syntax() {
  PARSED_TICKETS=()
  PARSED_BRANCHES=()

  add_ticket "GH-108:fix/bug-108"
  add_ticket "GH-110:feat/feature-110"

  assert_eq 2 "${#PARSED_TICKETS[@]}"
  assert_eq "GH-108" "${PARSED_TICKETS[0]}"
  assert_eq "fix/bug-108" "${PARSED_BRANCHES[0]}"
  assert_eq "GH-110" "${PARSED_TICKETS[1]}"
  assert_eq "feat/feature-110" "${PARSED_BRANCHES[1]}"
}

# TC-BD-03: ticket parsing — mixed positional + colon
test_parse_mixed() {
  PARSED_TICKETS=()
  PARSED_BRANCHES=()

  add_ticket "GH-108:fix/branch"
  add_ticket "GH-110"
  add_ticket "GH-37"

  assert_eq 3 "${#PARSED_TICKETS[@]}"
  assert_eq "GH-108" "${PARSED_TICKETS[0]}"
  assert_eq "fix/branch" "${PARSED_BRANCHES[0]}"
  assert_eq "GH-110" "${PARSED_TICKETS[1]}"
  assert_eq "" "${PARSED_BRANCHES[1]}"
  assert_eq "GH-37" "${PARSED_TICKETS[2]}"
  assert_eq "" "${PARSED_BRANCHES[2]}"
}

# TC-BD-03b: load from file
test_parse_from_file() {
  PARSED_TICKETS=()
  PARSED_BRANCHES=()

  local tickets_file="${_test_tmpdir}/tickets.txt"
  cat >"${tickets_file}" <<'EOF'
GH-108:fix/branch
# This is a comment
GH-110

GH-37:feat/another
EOF

  load_tickets_file "${tickets_file}"

  assert_eq 3 "${#PARSED_TICKETS[@]}" "Should skip comments and blanks"
  assert_eq "GH-108" "${PARSED_TICKETS[0]}"
  assert_eq "fix/branch" "${PARSED_BRANCHES[0]}"
  assert_eq "GH-110" "${PARSED_TICKETS[1]}"
  assert_eq "GH-37" "${PARSED_TICKETS[2]}"
  assert_eq "feat/another" "${PARSED_BRANCHES[2]}"
}

# ============================================================================
# TESTS: Pre-flight Skip (TC-BD-04 through TC-BD-06)
# ============================================================================

# TC-BD-04: skip-merged — mock gh to return merged PR → SKIP
test_skip_merged() {
  _gh() {
    case "$1" in
      issue)
        printf '%s' '{"state":"OPEN","labelNames":[]}'
        ;;
      pr)
        printf '%s' '[{"mergedAt":"2025-01-15T10:30:00Z"}]'
        ;;
    esac
  }

  local skip_reason
  skip_reason="$(should_skip_ticket "GH-108" 2>/dev/null)" || skip_reason=""

  assert_eq "merged" "${skip_reason}" "Should skip merged ticket"
}

# TC-BD-05: skip-blocked — mock gh to return human-input-needed label → SKIP
test_skip_blocked() {
  _gh() {
    case "$1" in
      issue)
        printf '%s' '{"state":"OPEN","labelNames":["human-input-needed"]}'
        ;;
      pr)
        printf '%s' '[]'
        ;;
    esac
  }

  local skip_reason
  skip_reason="$(should_skip_ticket "GH-108" 2>/dev/null)" || skip_reason=""

  assert_eq "blocked" "${skip_reason}" "Should skip blocked ticket"
}

# TC-BD-06: skip-closed — mock gh to return CLOSED state → SKIP
test_skip_closed() {
  _gh() {
    printf '%s' '{"state":"CLOSED","labelNames":[]}'
  }

  local skip_reason
  skip_reason="$(should_skip_ticket "GH-108" 2>/dev/null)" || skip_reason=""

  assert_eq "closed" "${skip_reason}" "Should skip closed ticket"
}

# TC-BD-06b: don't skip open ticket with no blockers
test_no_skip_active() {
  _gh() {
    case "$1" in
      issue)
        printf '%s' '{"state":"OPEN","labelNames":[]}'
        ;;
      pr)
        printf '%s' '[]'
        ;;
    esac
  }

  local skip_reason=""
  skip_reason="$(should_skip_ticket "GH-108" 2>/dev/null)" || skip_reason=""

  assert_eq "" "${skip_reason}" "Should not skip active ticket"
}

# ============================================================================
# TESTS: Duration Formatting (TC-BD-07)
# ============================================================================

# TC-BD-07: duration formatting — seconds → "45m 23s" or "1h 2m"
test_format_duration_seconds() {
  assert_eq "45s" "$(format_duration 45)"
}

test_format_duration_minutes() {
  assert_eq "2m 3s" "$(format_duration 123)"
}

test_format_duration_45min() {
  assert_eq "45m 23s" "$(format_duration 2723)"
}

test_format_duration_hours() {
  assert_eq "1h 2m" "$(format_duration 3723)"
}

test_format_duration_large() {
  assert_eq "2h 30m" "$(format_duration 9000)"
}

# ============================================================================
# TESTS: Summary Output (TC-BD-08)
# ============================================================================

# TC-BD-08: summary output format — contains counts and per-ticket lines
test_summary_format() {
  local output
  output="$(print_batch_summary 5 3 1 1 "45m 23s")"

  assert_contains "${output}" "Batch complete"
  assert_contains "${output}" "5 tickets"
  assert_contains "${output}" "45m 23s"
  assert_contains "${output}" "Merged/Done: 3"
  assert_contains "${output}" "Skipped:     1"
  assert_contains "${output}" "Failed:      1"
}

# TC-BD-08b: summary with zeros
test_summary_zeros() {
  local output
  output="$(print_batch_summary 0 0 0 0 "0s")"

  assert_contains "${output}" "0 tickets"
  assert_contains "${output}" "Merged/Done: 0"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  run_test "TC-BD-01: parse positional args" test_parse_positional_args
  run_test "TC-BD-02: parse colon syntax" test_parse_colon_syntax
  run_test "TC-BD-03: parse mixed positional + colon" test_parse_mixed
  run_test "TC-BD-03b: load from file" test_parse_from_file
  run_test "TC-BD-04: skip merged" test_skip_merged
  run_test "TC-BD-05: skip blocked" test_skip_blocked
  run_test "TC-BD-06: skip closed" test_skip_closed
  run_test "TC-BD-06b: no skip active ticket" test_no_skip_active
  run_test "TC-BD-07: format seconds" test_format_duration_seconds
  run_test "TC-BD-07b: format minutes" test_format_duration_minutes
  run_test "TC-BD-07c: format 45m 23s" test_format_duration_45min
  run_test "TC-BD-07d: format hours" test_format_duration_hours
  run_test "TC-BD-07e: format large" test_format_duration_large
  run_test "TC-BD-08: summary format" test_summary_format
  run_test "TC-BD-08b: summary with zeros" test_summary_zeros

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
