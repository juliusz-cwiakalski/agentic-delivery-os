#!/usr/bin/env bash
# test-batch-deliver.sh — Tests for scripts/batch-deliver.sh
#
# Tests pure functions (ticket parsing, duration formatting, summary output),
# mockable functions (pre-flight skip checks), and array building.
# shellcheck disable=SC2034
# (Module-level vars DELIVER_SCRIPT, CLEAN_TOOL, PARSED_TICKETS etc. are
# consumed by the sourced batch-deliver.sh; ShellCheck cannot track across.)
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

# TC-BD-03c: to_issue_number converts workItemRef to bare number for gh CLI
test_to_issue_number() {
  assert_eq "37" "$(to_issue_number "GH-37")" "GH-37 → 37"
  assert_eq "123" "$(to_issue_number "PDEV-123")" "PDEV-123 → 123"
  assert_eq "37" "$(to_issue_number "37")" "bare number stays"
}

# ============================================================================
# TESTS: Pre-flight Skip (TC-BD-04 through TC-BD-06)
# ============================================================================

# TC-BD-04: skip-merged — mock gh to return merged PR → SKIP
test_skip_merged() {
  _gh() {
    case "$1" in
      issue)
        printf '%s' '{"state":"OPEN","labels":[]}'
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
        printf '%s' '{"state":"OPEN","labels":[{"name":"human-input-needed"}]}'
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
    printf '%s' '{"state":"CLOSED","labels":[]}'
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
        printf '%s' '{"state":"OPEN","labels":[]}'
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
# TESTS: Approved-PR Flow (TC-BD-09+, AC-6, Mode B)
# ============================================================================
# These tests mock _gh/_git (same-shell overrides) to test the
# rebase-before-merge + green-gate + squash-merge flow.

# TC-BD-09: is_pr_approved returns 0 when approved label present.
test_is_pr_approved_yes() {
  _gh() {
    case "$1" in
      issue) printf '{"labels":[{"name":"approved"},{"name":"change"}]}' ;;
    esac
  }
  is_pr_approved "GH-200"
}

# TC-BD-09b: is_pr_approved returns 1 when no approved label.
test_is_pr_approved_no() {
  _gh() {
    case "$1" in
      issue) printf '{"labels":[{"name":"change"}]}' ;;
    esac
  }
  if is_pr_approved "GH-201" 2>/dev/null; then return 1; fi
  return 0
}

# TC-BD-10: get_pr_number finds the open PR.
test_get_pr_number() {
  _gh() {
    case "$1" in
      pr) printf '[{"number":42}]' ;;
    esac
  }
  local num
  num="$(get_pr_number "GH-200")"
  assert_eq "42" "${num}" "should find PR #42" || return 1
  return 0
}

# TC-BD-11: get_pr_title_and_body returns title + body.
test_get_pr_title_and_body() {
  _gh() {
    case "$1" in
      pr) printf '{"title":"GH-200 fix bug","body":"This fixes the bug."}' ;;
    esac
  }
  local info title body
  info="$(get_pr_title_and_body "42")"
  title="$(printf '%s' "${info}" | head -1)"
  body="$(printf '%s' "${info}" | tail -n +2)"
  assert_eq "GH-200 fix bug" "${title}" || return 1
  assert_eq "This fixes the bug." "${body}" || return 1
  return 0
}

# TC-BD-12: wait_for_pr_green returns 0 when all checks pass.
test_wait_for_pr_green_green() {
  _gh() { printf 'PASS  check  title  detail\n'; }
  wait_for_pr_green "42"
}

# TC-BD-12b: wait_for_pr_green returns 1 when any check fails.
test_wait_for_pr_green_red() {
  _gh() { printf 'FAIL  check  title  detail\n'; }
  if wait_for_pr_green "42" 2>/dev/null; then return 1; fi
  return 0
}

# TC-BD-13: approved_pr_flow — approved + rebase clean + green → squash-merge.
test_approved_green_squash_merge() {
  local marker="${_test_tmpdir}/merge-called"
  rm -f "${marker}"
  _gh() {
    case "$1 $2" in
      "pr list")   printf '[{"number":42}]' ;;
      "pr checks") printf 'PASS  ci  title  detail\n' ;;
      "pr view")   printf '{"title":"GH-200 fix","body":"body text"}' ;;
      "pr merge")  printf 'merged'; printf 'squash' >>"${marker}" ;;
    esac
  }
  _git() {
    case "$1" in
      fetch) return 0 ;;
      checkout) return 0 ;;
      merge-base) printf "abc123" ;;
      rev-parse) printf "abc123" ;;  # same as merge-base → on latest main
      rebase) return 0 ;;
      push) return 0 ;;
    esac
  }
  approved_pr_flow "GH-200" "feat/GH-200/x" 2>/dev/null
  local rc=$?
  [[ ${rc} -eq 0 ]] || { echo "  expected exit 0 (merged), got ${rc}" >&2; return 1; }
  [[ -f "${marker}" ]] || { echo "  squash merge not called" >&2; return 1; }
  return 0
}

# TC-BD-14: approved_pr_flow — rebase conflict → AI resolve → green → merge.
test_approved_rebase_conflict_ai_resolve_then_merge() {
  local rebase_attempted=0
  _gh() {
    case "$1 $2" in
      "pr list")   printf '[{"number":42}]' ;;
      "pr checks") printf 'PASS  ci  title  detail\n' ;;
      "pr view")   printf '{"title":"GH-200","body":"body"}' ;;
      "pr merge")  printf 'merged' ;;
    esac
  }
  _git() {
    case "$1" in
      fetch) return 0 ;;
      checkout) return 0 ;;
      merge-base) printf "old123" ;;
      rev-parse) printf "new123" ;;  # different → not on latest main
      rebase)
        rebase_attempted=$((rebase_attempted + 1))
        if (( rebase_attempted == 1 )); then
          return 1  # First rebase fails (conflict)
        fi
        return 0  # Second call (after resolution) succeeds
        ;;
      diff)
        # No conflict markers remaining after resolution
        return 1
        ;;
      push) return 0 ;;
    esac
  }
  # Mock resolve_rebase_conflicts to succeed
  resolve_rebase_conflicts() { return 0; }
  approved_pr_flow "GH-200" "feat/GH-200/x" 2>/dev/null
  local rc=$?
  [[ ${rc} -eq 0 ]] || { echo "  expected exit 0 (merged after resolve), got ${rc}" >&2; return 1; }
  return 0
}

# TC-BD-15: not approved → park and continue.
test_not_approved_park_and_continue() {
  _gh() {
    case "$1 $2" in
      "issue view")
        printf '{"state":"OPEN","labels":[{"name":"change"}]}'  # NOT approved
        ;;
      "pr list") printf '[]' ;;  # No merged PRs
    esac
  }
  # Mock deliver script to succeed
  DELIVER_SCRIPT="true"
  CLEAN_TOOL=""
  PARSED_TICKETS=("GH-200" "GH-201")
  PARSED_BRANCHES=("feat/GH-200/x" "feat/GH-201/y")
  is_pr_approved() { return 1; }  # Never approved

  local output
  output="$(run_batch 2>&1)" || true
  assert_contains "${output}" "pending review" "should log pending review" || return 1
  assert_contains "${output}" "Parked:      2" "should park both tickets" || return 1
  return 0
}

# TC-BD-16: already on latest main → skip rebase, direct merge.
test_already_on_latest_main_direct_merge() {
  local git_rebase_called=0
  _gh() {
    case "$1 $2" in
      "pr list")   printf '[{"number":42}]' ;;
      "pr checks") printf 'PASS  ci  title  detail\n' ;;
      "pr view")   printf '{"title":"GH-200","body":"body"}' ;;
      "pr merge")  printf 'merged' ;;
    esac
  }
  _git() {
    case "$1" in
      fetch) return 0 ;;
      checkout) return 0 ;;
      merge-base) printf "same123" ;;
      rev-parse) printf "same123" ;;  # same → already on main
      rebase) git_rebase_called=1; return 0 ;;
      push) return 0 ;;
    esac
  }
  approved_pr_flow "GH-200" "feat/GH-200/x" 2>/dev/null
  local rc=$?
  [[ ${rc} -eq 0 ]] || { echo "  expected exit 0, got ${rc}" >&2; return 1; }
  [[ ${git_rebase_called} -eq 0 ]] || { echo "  rebase should not be called when already on main" >&2; return 1; }
  return 0
}

# TC-BD-17: green-gate red → no merge, route back to deliver.
test_green_gate_red_routes_to_deliver() {
  local merge_called=0
  _gh() {
    case "$1 $2" in
      "pr list")   printf '[{"number":42}]' ;;
      "pr checks") printf 'FAIL  ci  title  detail\n' ;;
      "pr merge")  merge_called=1; printf 'merged' ;;
    esac
  }
  _git() {
    case "$1" in
      fetch) return 0 ;;
      checkout) return 0 ;;
      merge-base) printf "abc123" ;;
      rev-parse) printf "abc123" ;;
      rebase) return 0 ;;
      push) return 0 ;;
    esac
  }
  approved_pr_flow "GH-200" "feat/GH-200/x" 2>/dev/null
  local rc=$?
  [[ ${rc} -ne 0 ]] || { echo "  expected non-zero (no merge on red), got ${rc}" >&2; return 1; }
  [[ ${merge_called} -eq 0 ]] || { echo "  merge should NOT be called on red" >&2; return 1; }
  return 0
}

# TC-BD-18: commit message sourced from PR title + body.
test_commit_msg_from_pr_title_body() {
  local marker="${_test_tmpdir}/merge-args"
  rm -f "${marker}"
  _gh() {
    case "$1 $2" in
      "pr list")   printf '[{"number":42}]' ;;
      "pr checks") printf 'PASS  ci  title  detail\n' ;;
      "pr view")   printf '{"title":"GH-200 Fix the thing","body":"Detailed description."}' ;;
      "pr merge")
        printf '%s ' "$@" >>"${marker}"
        printf 'merged'
        ;;
    esac
  }
  _git() {
    case "$1" in
      fetch) return 0 ;;
      checkout) return 0 ;;
      merge-base) printf "abc123" ;;
      rev-parse) printf "abc123" ;;
      rebase) return 0 ;;
      push) return 0 ;;
    esac
  }
  approved_pr_flow "GH-200" "feat/GH-200/x" 2>/dev/null || true
  local merge_args
  merge_args="$(cat "${marker}" 2>/dev/null)" || merge_args=""
  assert_contains "${merge_args}" "--subject" "should use --subject" || return 1
  assert_contains "${merge_args}" "--body" "should use --body" || return 1
  assert_contains "${merge_args}" "GH-200 Fix the thing" "should use PR title as subject" || return 1
  return 0
}

# TC-BD-19: batch never adds the approved label.
test_batch_never_adds_approved() {
  local marker="${_test_tmpdir}/gh-all-calls"
  rm -f "${marker}"
  _gh() {
    printf '%s\n' "$*" >>"${marker}"
    case "$1 $2" in
      "issue view") printf '{"state":"OPEN","labels":[]}' ;;
      "pr list") printf '[]' ;;
    esac
  }
  DELIVER_SCRIPT="true"
  CLEAN_TOOL=""
  PARSED_TICKETS=("GH-200")
  PARSED_BRANCHES=("feat/GH-200/x")
  is_pr_approved() { return 1; }

  run_batch 2>/dev/null || true
  local all_calls
  all_calls="$(cat "${marker}" 2>/dev/null)" || all_calls=""
  # Verify no "label create approved" or "issue edit ... approved" was called
  assert_not_contains "${all_calls}" "label create approved" "batch should not create approved label" || return 1
  assert_not_contains "${all_calls}" "issue edit" "batch should not edit issues (add labels)" || return 1
  return 0
}

# TC-BD-09b summary with parked
test_summary_with_parked() {
  local output
  output="$(print_batch_summary 3 1 0 0 "10m" 2)"
  assert_contains "${output}" "Parked:      2" || return 1
  return 0
}

# TC-BD-12c: wait_for_pr_green returns 3 on gh error (F-2). gh pr checks fails
# AND _pr_has_no_checks_configured cannot positively confirm no-checks (gh pr
# view also errors). The caller must PARK, never assume green.
test_wait_for_pr_green_gh_error_returns_3() {
  _gh() { return 1; }
  wait_for_pr_green "42" 2>/dev/null
  local rc=$?
  assert_eq "3" "${rc}" "expected rc=3 (unknown/park) on gh error (F-2)" || return 1
  return 0
}

# TC-BD-12d: wait_for_pr_green returns 0 when no checks configured (F-2). gh pr
# checks fails (non-zero) BUT _pr_has_no_checks_configured positively confirms
# zero checks via gh pr view → legit green.
test_wait_for_pr_green_no_checks_is_green() {
  _gh() {
    case "$1 $2" in
      "pr checks") return 1 ;;
      "pr view")   printf '{"statusCheckRollup":[]}' ;;
    esac
  }
  wait_for_pr_green "42" 2>/dev/null
  local rc=$?
  assert_eq "0" "${rc}" "expected rc=0 (green: no checks configured) (F-2)" || return 1
  return 0
}

# TC-BD-17b: approved_pr_flow parks (not merges) on gh error (F-2). wait_for_pr_green
# returns 3 → approved_pr_flow returns 1 and gh pr merge is NEVER called.
test_approved_pr_flow_gh_error_parks_not_merges() {
  local merge_called=0
  _gh() {
    case "$1 $2" in
      "pr list")   printf '[{"number":42}]' ;;
      "pr checks") return 1 ;;
      "pr view")   return 1 ;;
      "pr merge")  merge_called=1; printf 'merged' ;;
    esac
  }
  _git() {
    case "$1" in
      fetch) return 0 ;;
      checkout) return 0 ;;
      merge-base) printf "abc123" ;;
      rev-parse) printf "abc123" ;;
      rebase) return 0 ;;
      push) return 0 ;;
    esac
  }
  approved_pr_flow "GH-200" "feat/GH-200/x" 2>/dev/null
  local rc=$?
  [[ ${rc} -ne 0 ]] || { echo "  expected non-zero (parked), got ${rc}" >&2; return 1; }
  [[ ${merge_called} -eq 0 ]] || { echo "  merge must NOT be called on gh error (F-2)" >&2; return 1; }
  return 0
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
  run_test "TC-BD-03c: to_issue_number strips prefix" test_to_issue_number
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

  # AC-6: Approved-PR flow (Mode B)
  run_test "TC-BD-09: is_pr_approved yes" test_is_pr_approved_yes
  run_test "TC-BD-09b: is_pr_approved no" test_is_pr_approved_no
  run_test "TC-BD-10: get_pr_number" test_get_pr_number
  run_test "TC-BD-11: get_pr_title_and_body" test_get_pr_title_and_body
  run_test "TC-BD-12: wait_for_pr_green green" test_wait_for_pr_green_green
  run_test "TC-BD-12b: wait_for_pr_green red" test_wait_for_pr_green_red
  run_test "TC-BD-12c: wait_for_pr_green gh error→3 (F-2)" test_wait_for_pr_green_gh_error_returns_3
  run_test "TC-BD-12d: wait_for_pr_green no-checks→0 (F-2)" test_wait_for_pr_green_no_checks_is_green
  run_test "TC-BD-13: approved+green→squash-merge" test_approved_green_squash_merge
  run_test "TC-BD-14: approved+conflict→resolve→merge" test_approved_rebase_conflict_ai_resolve_then_merge
  run_test "TC-BD-15: not approved→park+continue" test_not_approved_park_and_continue
  run_test "TC-BD-16: already-on-main→direct merge" test_already_on_latest_main_direct_merge
  run_test "TC-BD-17: green-gate red→no merge" test_green_gate_red_routes_to_deliver
  run_test "TC-BD-17b: gh-error→park not merge (F-2)" test_approved_pr_flow_gh_error_parks_not_merges
  run_test "TC-BD-18: commit-msg from PR title+body" test_commit_msg_from_pr_title_body
  run_test "TC-BD-19: batch never adds approved" test_batch_never_adds_approved
  run_test "TC-BD-20: summary with parked" test_summary_with_parked

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
