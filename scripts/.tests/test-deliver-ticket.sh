#!/usr/bin/env bash
# test-deliver-ticket.sh — Tests for scripts/deliver-ticket.sh
#
# Tests pure functions (input parsing, prompt building, decision logic),
# mockable functions (branch resolution, result classification), and
# activity monitoring helpers.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-deliver-ticket)"
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
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/deliver-ticket.sh"

# Reset ERR trap — the sourced script sets its own.
trap - ERR

# ============================================================================
# TESTS: Input Parsing
# ============================================================================

# TC-DT-01: input parsing — GH-112 → ticket=GH-112, branch=""
test_parse_ticket_only() {
  local ticket branch
  ticket="$(extract_ticket_ref "GH-112")"
  branch="$(extract_branch "GH-112")"

  assert_eq "GH-112" "${ticket}" "ticket ref should be GH-112"
  assert_eq "" "${branch}" "branch should be empty"
}

# TC-DT-01b: validate ticket ref
test_validate_ticket_ref_valid() {
  validate_ticket_ref "GH-112" && return 0
  return 1
}

test_validate_ticket_ref_invalid() {
  if validate_ticket_ref "invalid"; then
    return 1
  fi
  return 0
}

# TC-DT-02: input parsing — GH-112:feat/branch → ticket=GH-112, branch="feat/branch"
test_parse_ticket_with_branch() {
  local ticket branch
  ticket="$(extract_ticket_ref "GH-112:feat/branch")"
  branch="$(extract_branch "GH-112:feat/branch")"

  assert_eq "GH-112" "${ticket}" "ticket ref should be GH-112"
  assert_eq "feat/branch" "${branch}" "branch should be feat/branch"
}

# TC-DT-02b: input with PDEV prefix
test_parse_pdev_ticket() {
  local ticket branch
  ticket="$(extract_ticket_ref "PDEV-42:fix/bug")"
  branch="$(extract_branch "PDEV-42:fix/bug")"

  assert_eq "PDEV-42" "${ticket}"
  assert_eq "fix/bug" "${branch}"
}

# ============================================================================
# TESTS: Branch Resolution
# ============================================================================

# TC-DT-03: branch mismatch warning — mapping has branch A, arg has branch B
test_branch_mismatch_warning() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"
  SESSION_DIR="${test_dir}"

  # Create mapping with recorded branch
  _jq -n --arg b "feat/A" '{branch:$b}' > "${test_dir}/GH-112.json"

  local stderr_output result
  stderr_output="$(resolve_branch "GH-112" "feat/B" 2>&1 1>/dev/null)" || true
  result="$(resolve_branch "GH-112" "feat/B" 2>/dev/null)"

  assert_eq "feat/A" "${result}" "Should use recorded branch"
  assert_contains "${stderr_output}" "mismatch" "Should warn about mismatch"
}

# TC-DT-04: branch resolution from mapping — no arg, mapping has branch
test_branch_from_mapping() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"
  SESSION_DIR="${test_dir}"

  _jq -n --arg b "feat/from-mapping" '{branch:$b}' > "${test_dir}/GH-113.json"

  local result
  result="$(resolve_branch "GH-113" "")"

  assert_eq "feat/from-mapping" "${result}" "Should use branch from mapping"
}

# TC-DT-04b: branch from arg when no mapping
test_branch_from_arg_no_mapping() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"
  SESSION_DIR="${test_dir}"

  local result
  result="$(resolve_branch "GH-114" "feat/from-arg")"

  assert_eq "feat/from-arg" "${result}" "Should use branch from arg"
}

# TC-DT-04c: no branch when no mapping and no arg
test_no_branch_when_nothing() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"
  SESSION_DIR="${test_dir}"

  local result
  result="$(resolve_branch "GH-115" "")"

  assert_eq "" "${result}" "Should be empty when no mapping and no arg"
}

# ============================================================================
# TESTS: Stale Detection (TC-DT-05)
# ============================================================================

# TC-DT-05: stale detection — no activity increase triggers kill
test_stale_detection_triggers() {
  # 30 minutes idle, 30 minute threshold → stuck
  is_session_stuck 1000 2800 1800 && return 0
  return 1
}

# TC-DT-05b: not stuck when within threshold
test_stale_detection_no_trigger() {
  # 5 minutes idle, 30 minute threshold → not stuck
  if is_session_stuck 1000 1300 1800; then
    return 1
  fi
  return 0
}

# TC-DT-05c: exactly at threshold
test_stale_detection_at_threshold() {
  # Exactly 30 minutes idle = 1800 seconds, threshold 1800 → stuck
  is_session_stuck 1000 2800 1800 && return 0
  return 1
}

# ============================================================================
# TESTS: Max Restarts (TC-DT-06)
# ============================================================================

# TC-DT-06: max restarts — failed iteration at max → stop with max-restarts
test_max_restarts_exceeded() {
  local result
  result="$(decide_after_iteration "finished" "failed" 10 10)"

  assert_contains "${result}" "stop" "Should stop"
  assert_contains "${result}" "max-restarts" "Should report max-restarts"
}

# TC-DT-06b: under max restarts → continue
test_under_max_restarts_continue() {
  local result
  result="$(decide_after_iteration "finished" "failed" 3 10)"

  assert_eq "continue" "${result}" "Should continue when under max restarts"
}

# TC-DT-06c: stuck at max → stop with max-restarts
test_stuck_at_max_restarts() {
  local result
  result="$(decide_after_iteration "stuck" "failed" 10 10)"

  assert_contains "${result}" "stop"
  assert_contains "${result}" "max-restarts"
}

# ============================================================================
# TESTS: Exit Classification (TC-DT-07)
# ============================================================================

# TC-DT-07: exit classification — human-input-needed → blocked
test_classify_blocked() {
  _gh() {
    printf '%s' '{"state":"OPEN","labelNames":["human-input-needed"]}'
  }

  local result
  result="$(classify_result "GH-112" "feat/test")"

  assert_eq "blocked" "${result}" "Should classify as blocked"
}

# TC-DT-07b: closed issue → merged
test_classify_merged_closed() {
  _gh() {
    printf '%s' '{"state":"CLOSED","labelNames":[]}'
  }

  local result
  result="$(classify_result "GH-112" "feat/test")"

  assert_eq "merged" "${result}" "Should classify as merged (closed issue)"
}

# TC-DT-07c: open PR → pr-open
test_classify_pr_open() {
  _gh() {
    case "$1" in
      issue)
        printf '%s' '{"state":"OPEN","labelNames":[]}'
        ;;
      pr)
        printf '%s' '[{"number":42}]'
        ;;
    esac
  }

  local result
  result="$(classify_result "GH-112" "feat/test")"

  assert_eq "pr-open" "${result}" "Should classify as pr-open"
}

# TC-DT-07d: no progress → failed
test_classify_failed() {
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

  local result
  result="$(classify_result "GH-112" "feat/test")"

  assert_eq "failed" "${result}" "Should classify as failed"
}

# ============================================================================
# TESTS: Prompt Generation (TC-DT-08)
# ============================================================================

# TC-DT-08: prompt generation — contains ticket ref, branch, push-to-completion language
test_prompt_contains_ticket() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "feat/test-branch")"

  assert_contains "${prompt}" "GH-112" "Prompt should contain ticket ref"
  assert_contains "${prompt}" "feat/test-branch" "Prompt should contain branch"
  assert_contains "${prompt}" "Deliver" "Prompt should have delivery instruction"
}

# TC-DT-08b: prompt has PR check instructions
test_prompt_has_pr_check() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "")"

  assert_contains "${prompt}" "open PR" "Prompt should check for open PR"
  assert_contains "${prompt}" "APPROVED" "Prompt should mention APPROVED review"
  assert_contains "${prompt}" "squash-merge" "Prompt should mention squash-merge"
}

# TC-DT-08c: prompt has human-input-needed workflow
test_prompt_has_blocked_workflow() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "")"

  assert_contains "${prompt}" "human-input-needed" "Prompt should mention human-input-needed"
  assert_contains "${prompt}" "blocked" "Prompt should mention blocked state"
}

# TC-DT-08d: prompt has single-ticket rule
test_prompt_single_ticket() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "")"

  assert_contains "${prompt}" "one workItemRef" "Prompt should enforce single ticket"
  assert_contains "${prompt}" "No other ticket" "Prompt should say no other ticket"
}

# TC-DT-08e: prompt has 11-phase lifecycle
test_prompt_has_lifecycle() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "")"

  assert_contains "${prompt}" "11-phase lifecycle" "Prompt should reference ADOS lifecycle"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  run_test "TC-DT-01: parse ticket only (no branch)" test_parse_ticket_only
  run_test "TC-DT-01b: validate ticket ref" test_validate_ticket_ref_valid
  run_test "TC-DT-01c: reject invalid ticket ref" test_validate_ticket_ref_invalid
  run_test "TC-DT-02: parse ticket:branch" test_parse_ticket_with_branch
  run_test "TC-DT-02b: parse PDEV ticket:branch" test_parse_pdev_ticket
  run_test "TC-DT-03: branch mismatch warning" test_branch_mismatch_warning
  run_test "TC-DT-04: branch resolution from mapping" test_branch_from_mapping
  run_test "TC-DT-04b: branch from arg (no mapping)" test_branch_from_arg_no_mapping
  run_test "TC-DT-04c: no branch when nothing provided" test_no_branch_when_nothing
  run_test "TC-DT-05: stale detection triggers kill" test_stale_detection_triggers
  run_test "TC-DT-05b: not stuck within threshold" test_stale_detection_no_trigger
  run_test "TC-DT-06: max restarts exceeded" test_max_restarts_exceeded
  run_test "TC-DT-06b: under max restarts continues" test_under_max_restarts_continue
  run_test "TC-DT-06c: stuck at max restarts" test_stuck_at_max_restarts
  run_test "TC-DT-07: classify blocked (human-input-needed)" test_classify_blocked
  run_test "TC-DT-07b: classify merged (closed issue)" test_classify_merged_closed
  run_test "TC-DT-07c: classify pr-open" test_classify_pr_open
  run_test "TC-DT-07d: classify failed" test_classify_failed
  run_test "TC-DT-08: prompt contains ticket and branch" test_prompt_contains_ticket
  run_test "TC-DT-08b: prompt has PR check instructions" test_prompt_has_pr_check
  run_test "TC-DT-08c: prompt has blocked workflow" test_prompt_has_blocked_workflow
  run_test "TC-DT-08d: prompt enforces single ticket" test_prompt_single_ticket
  run_test "TC-DT-08e: prompt references 11-phase lifecycle" test_prompt_has_lifecycle

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
