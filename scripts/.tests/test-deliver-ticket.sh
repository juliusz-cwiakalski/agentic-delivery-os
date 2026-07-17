#!/usr/bin/env bash
# test-deliver-ticket.sh — Tests for scripts/deliver-ticket.sh
#
# Tests pure functions (input parsing, prompt building, decision logic),
# mockable functions (branch resolution, result classification), and
# activity monitoring helpers.
# shellcheck disable=SC2034
# (Module-level vars set below — DELIVERY_DIR, MAX_RESTARTS, CAPTURED_PM_MESSAGE,
# DELIVERY_RESULT/PR_URL/EXIT_CODE/LAST_MESSAGE, etc. — are consumed by the
# sourced deliver-ticket.sh functions; ShellCheck cannot track across source.)
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
source "${SCRIPT_DIR}/deliver-ticket.sh"

# Reset ERR trap — the sourced script sets its own.
trap - ERR

# Capture the real _pid_start_epoch so F-1 tests can stub it and restore it.
# Stored as a function-body string; restored via eval.
_REAL_PID_START_EPOCH_FN="$(declare -f _pid_start_epoch)"

# F-1 test bridge: when non-empty, the stubbed _pid_start_epoch echoes this value.
_F1_MOCK_PID_START_EPOCH=""

# Restore the real _pid_start_epoch captured above (after an F-1 test stubs it).
_restore_pid_start_epoch() {
  eval "${_REAL_PID_START_EPOCH_FN}"
  _F1_MOCK_PID_START_EPOCH=""
}

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

# TC-DT-02c: to_issue_number converts workItemRef to bare number for gh CLI
test_to_issue_number() {
  assert_eq "37" "$(to_issue_number "GH-37")" "GH-37 → 37"
  assert_eq "123" "$(to_issue_number "PDEV-123")" "PDEV-123 → 123"
  assert_eq "37" "$(to_issue_number "37")" "bare number stays"
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

  # Hermetic git mock: the git-scan fallback must not hit the REAL repo. These
  # branches intentionally do NOT match GH-115, so the scan misses → empty.
  _git() { printf 'main\nother\n'; }

  local result
  result="$(resolve_branch "GH-115" "")"

  assert_eq "" "${result}" "Should be empty when no mapping, no arg, and git scan misses"
}

# TC-DT-04d: resolve_branch git-scan fallback discovers a branch AND persists
# it to the mapping so future runs skip the scan (GH-142).
test_resolve_branch_git_scan_discovers_and_persists() {
  local test_dir="${_test_tmpdir}/sessions-scan"
  mkdir -p "${test_dir}"
  SESSION_DIR="${test_dir}"
  _git() { printf 'main\nfeat/GH-999/scanning\n'; }
  _jq -n '{branch:null}' >"${test_dir}/GH-999.json"
  local result; result="$(resolve_branch "GH-999" "")"
  assert_eq "feat/GH-999/scanning" "${result}" "git scan discovers branch"
  local persisted; persisted="$(_jq -r '.branch // empty' "${test_dir}/GH-999.json")"
  assert_eq "feat/GH-999/scanning" "${persisted}" "discovered branch persisted to mapping"
}

# TC-DT-04e: resolve_branch git-scan respects the ref-boundary regex — GH-99
# must NOT match a branch named feat/GH-990/thing (GH-142).
test_resolve_branch_scan_ref_boundary() {
  local test_dir="${_test_tmpdir}/sessions-boundary"
  mkdir -p "${test_dir}"; SESSION_DIR="${test_dir}"
  _git() { printf 'feat/GH-990/thing\n'; }
  local result; result="$(resolve_branch "GH-99" "")"
  assert_eq "" "${result}" "GH-99 must NOT match GH-990 (ref-boundary regex)"
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

# TC-DT-06: max restarts — failed iteration at max → stop with max-restarts.
# GH-142: a clean PM exit ("finished") is ALWAYS terminal now (stop:0:finished),
# so the only path that still produces max-restarts is stuck+failed+at-max.
test_max_restarts_exceeded() {
  local result
  result="$(decide_after_iteration "stuck" "failed" 10 10)"

  assert_contains "${result}" "stop" "Should stop"
  assert_contains "${result}" "max-restarts" "Should report max-restarts"
}

# TC-DT-06b: under max restarts → continue
# GH-142: "finished" is terminal, so use "stuck" to test the continue-under-max path.
test_under_max_restarts_continue() {
  local result
  result="$(decide_after_iteration "stuck" "failed" 3 10)"

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
    printf '%s' '{"state":"OPEN","labels":[{"name":"human-input-needed"}]}'
  }

  local result
  result="$(classify_result "GH-112" "feat/test")"

  assert_eq "blocked" "${result}" "Should classify as blocked"
}

# TC-DT-07b: closed issue → merged
test_classify_merged_closed() {
  _gh() {
    printf '%s' '{"state":"CLOSED","labels":[]}'
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
        printf '%s' '{"state":"OPEN","labels":[]}'
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
        printf '%s' '{"state":"OPEN","labels":[]}'
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

# TC-DT-07e: gh/network failure → unknown (m-7)
test_classify_unknown() {
  _gh() {
    # Simulate gh failure (rate limit, network error)
    return 1
  }

  local result
  result="$(classify_result "GH-112" "feat/test")"

  assert_eq "unknown" "${result}" "Should classify as unknown on gh failure"
}

# TC-DT-07f: classify_result empty-branch fallback — when no branch is resolved,
# classify_result searches open PRs by ticket ref in the title (GH-142).
test_classify_pr_open_empty_branch_fallback() {
  _gh() {
    case "$1" in
      issue) printf '%s' '{"state":"OPEN","labels":[]}' ;;
      pr)
        if printf '%s ' "$@" | grep -q -- '--search'; then
          printf '%s' '[{"number":777}]'
        else
          printf '%s' '[]'
        fi
        ;;
    esac
  }
  local result; result="$(classify_result "GH-999" "")"
  assert_eq "pr-open" "${result}" "empty branch falls back to title-based open-PR search"
}

# TC-DT-06d: stuck + unknown classification → continue (no restart burn)
# m-7: "unknown" (gh/network failure) doesn't burn a restart slot — but only
# when the session was killed for staleness (stuck). A finished session that
# can't be classified should STOP instead (see TC-DT-06e).
test_unknown_continues() {
  local result
  result="$(decide_after_iteration "stuck" "unknown" 1 10)"

  assert_eq "continue" "${result}" "Should continue (not burn restart) on stuck+unknown"
}

# TC-DT-06e: decide_after_iteration: finished + unknown → stop:0:finished
# GH-126: When the PM session finished normally (opencode exited on its own)
# but post-session GitHub classification is unknown (rate limit / network), the
# delivery should STOP — the PM completed its work; retrying won't change the
# outcome. Previously this returned "continue", causing an infinite retry loop.
test_decide_finished_unknown_stops() {
  local result
  result="$(decide_after_iteration "finished" "unknown" 1 10)"
  assert_eq "stop:0:finished" "${result}" "finished+unknown should stop with exit 0"
}

# TC-DT-06f: decide_after_iteration: stuck + unknown → continue (still retries)
test_decide_stuck_unknown_continues() {
  local result
  result="$(decide_after_iteration "stuck" "unknown" 1 10)"
  assert_eq "continue" "${result}" "stuck+unknown should continue"
}

# TC-DT-06g: decide_after_iteration: finished + failed → stop (terminal).
# GH-142: a clean PM exit is ALWAYS terminal now. finished+failed used to
# "continue" (retry up to max); it now stops with stop:0:finished.
test_decide_finished_failed_stops() {
  local result
  result="$(decide_after_iteration "finished" "failed" 1 10)"
  assert_eq "stop:0:finished" "${result}" "finished+failed is now TERMINAL"
}

# TC-DT-06h: finished + terminal classifications → stop (GH-142).
test_decide_finished_merged_stops() {
  local result; result="$(decide_after_iteration "finished" "merged" 1 10)"
  assert_eq "stop:0:merged" "${result}" "finished+merged stops"
}
test_decide_finished_blocked_stops() {
  local result; result="$(decide_after_iteration "finished" "blocked" 1 10)"
  assert_eq "stop:0:blocked" "${result}" "finished+blocked stops"
}
test_decide_finished_pr_open_stops() {
  local result; result="$(decide_after_iteration "finished" "pr-open" 1 10)"
  assert_eq "stop:0:pr-open" "${result}" "finished+pr-open stops"
}

# TC-DT-06i: stuck + terminal classification → stop (not continue) (GH-142).
# A watchdog-killed session that already reached a terminal GitHub state must
# accept it instead of restarting.
test_decide_stuck_merged_stops() {
  local result; result="$(decide_after_iteration "stuck" "merged" 1 10)"
  assert_eq "stop:0:merged" "${result}" "stuck+merged stops"
}
test_decide_stuck_blocked_stops() {
  local result; result="$(decide_after_iteration "stuck" "blocked" 1 10)"
  assert_eq "stop:0:blocked" "${result}" "stuck+blocked stops"
}
test_decide_stuck_pr_open_stops() {
  local result; result="$(decide_after_iteration "stuck" "pr-open" 1 10)"
  assert_eq "stop:0:pr-open" "${result}" "stuck+pr-open stops"
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

# TC-DT-08b: prompt does NOT auto-merge (F-2 / INV-DM-4). The PM creates the
# PR and STOPS at pr-open; merge authority is the CEO (Mode A) or
# batch-deliver.sh (Mode B). The legacy APPROVED/squash-merge path is retired.
test_prompt_does_not_auto_merge() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "")"

  # The no-merge contract must be explicit.
  assert_contains "${prompt}" "DO NOT MERGE" "Prompt must tell the PM not to merge"
  assert_contains "${prompt}" "NOT authorized to merge" "Prompt must state the PM is not the merge authority"

  # Legacy auto-merge signals are retired.
  assert_not_contains "${prompt}" "APPROVED" "Prompt must not check APPROVED review (F-2)"
  assert_not_contains "${prompt}" "squash-merge" "Prompt must not instruct squash-merge (F-2)"
  assert_not_contains "${prompt}" "gh pr merge" "Prompt must not invoke gh pr merge (F-2)"
  assert_not_contains "${prompt}" "approved" "Prompt must not reference the approved label (F-2)"
  assert_not_contains "${prompt}" "lgtm" "Prompt must not reference LGTM (F-2)"
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

# TC-DT-08g: prompt merges main into the feature branch before resuming work
test_prompt_merge_main_on_resume() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "feat/test-branch")"

  assert_contains "${prompt}" "git fetch origin main" "Prompt should fetch main before resuming"
  assert_contains "${prompt}" "git merge origin/main" "Prompt should merge main into the feature branch"
}

# TC-DT-08h: prompt has a Resume Sync section
test_prompt_has_resume_sync_section() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "")"

  assert_contains "${prompt}" "Resume Sync" "Prompt should have a Resume Sync section"
  assert_contains "${prompt}" "breaking changes" "Resume Sync should reference catching breaking changes"
  assert_contains "${prompt}" "merge conflicts" "Resume Sync should mention merge conflict handling"
}

# TC-DT-08i: prompt fetches review comments on resume in the open PR section
test_prompt_fetches_review_comments() {
  local prompt
  prompt="$(build_delivery_prompt "GH-112" "feat/test-branch")"

  assert_contains "${prompt}" "Fetch all review comments" "Open PR section should fetch all review comments"
}

# ============================================================================
# TESTS: Liveness mechanism components (m-6)
# ============================================================================

# TC-DT-CMP-01: kill_process_tree terminates a backgrounded process group.
# Verifies the kill mechanism the liveness loop relies on to stop a stale PM.
test_kill_process_tree_kills_process() {
  _setsid sleep 999 >/dev/null 2>&1 &
  local pid=$!
  kill -0 "${pid}" 2>/dev/null || { wait "${pid}" 2>/dev/null || true; return 1; }

  kill_process_tree "${pid}"

  sleep 1
  if kill -0 "${pid}" 2>/dev/null; then
    kill -KILL "${pid}" 2>/dev/null || true
    wait "${pid}" 2>/dev/null || true
    return 1
  fi
  wait "${pid}" 2>/dev/null || true
  return 0
}

# TC-DT-CMP-02: resolve_session finds an existing session by title (no mapping).
# Verifies the title-based resume lookup used after a kill-and-restart.
test_resolve_session_title_lookup() {
  local test_dir="${_test_tmpdir}/sessions"
  mkdir -p "${test_dir}"
  SESSION_DIR="${test_dir}"

  # No mapping file present → falls through to title-based lookup.
  _opencode() {
    printf '%s' '[{"id":"ses_abc","title":"ticket-TEST-001","time":"2026-01-01T00:00:00Z"},{"id":"ses_other","title":"ticket-OTHER","time":"2026-01-01T00:00:00Z"}]'
  }

  local result
  result="$(resolve_session "TEST-001")"

  assert_eq "ses_abc" "${result}" "Should resolve session by title"
}

# TC-DT-CMP-03: _cleanup_child (EXIT trap) kills a tracked opencode PID.
# Verifies orphan cleanup when the parent deliver-ticket process is killed.
test_cleanup_child_kills_tracked_pid() {
  _setsid sleep 999 >/dev/null 2>&1 &
  local pid=$!
  kill -0 "${pid}" 2>/dev/null || { wait "${pid}" 2>/dev/null || true; return 1; }

  CURRENT_OPENCODE_PID="${pid}"
  _cleanup_child

  sleep 1
  if kill -0 "${pid}" 2>/dev/null; then
    kill -KILL "${pid}" 2>/dev/null || true
    wait "${pid}" 2>/dev/null || true
    CURRENT_OPENCODE_PID=""
    return 1
  fi
  wait "${pid}" 2>/dev/null || true
  assert_eq "" "${CURRENT_OPENCODE_PID}" "_cleanup_child should clear CURRENT_OPENCODE_PID"
  return 0
}

# ============================================================================
# TESTS: Integration — full kill/restart liveness cycle (m-6)
# ============================================================================
# TC-DT-INT-01: end-to-end kill-and-restart using fake opencode/gh stubs.
# Takes ~65-75s (1 stuck minute + poll + restart). Skipped unless
# RUN_SLOW_TESTS=true so the default suite and CI stay fast.
test_integration_kill_restart_cycle() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] TC-DT-INT-01 (set RUN_SLOW_TESTS=true to run)\n'
    return 0
  fi

  local bin_dir="${_test_tmpdir}/bin"
  local marker_dir="${_test_tmpdir}/markers"
  mkdir -p "${bin_dir}" "${marker_dir}"
  local run_count_file="${marker_dir}/run_count"
  local session_json='[{"id":"ses_fake_int_001","title":"ticket-TEST-001","time":"2026-01-01T00:00:00Z"}]'

  # Fake opencode: distinguish `session list` from `run`; `run` writes a marker
  # and sleeps long enough to be killed by the stuck detector.
  cat >"${bin_dir}/opencode" <<OPENCODE
#!/usr/bin/env bash
if [[ "\$1" == "session" && "\$2" == "list" ]]; then
  printf '%s' '${session_json}'
  exit 0
fi
# opencode run ... — record an invocation, then block to be killed.
n=0
[[ -f "${run_count_file}" ]] && n=\$(<"${run_count_file}")
n=\$((n+1))
printf '%s' "\$n" >"${run_count_file}"
: >"${marker_dir}/ran.\${n}"
sleep "\${FAKE_OPENCODE_SLEEP_SECONDS:-300}"
exit 0
OPENCODE
  chmod +x "${bin_dir}/opencode"

  # Fake gh: open issue, no PR → classify as "failed" so the loop restarts.
  cat >"${bin_dir}/gh" <<GH
#!/usr/bin/env bash
case "\$1" in
  issue) printf '%s' '{"state":"OPEN","labels":[]}' ;;
  pr)
    if printf '%s ' "\$@" | grep -q -- '--state open'; then
      printf '%s' '[]'
    else
      printf '%s' '[]'
    fi
    ;;
  *) printf '%s' '[]' ;;
esac
GH
  chmod +x "${bin_dir}/gh"

  local saved_path="${PATH}"
  local deliver_pid=""
  local mapping_file="${SESSION_DIR}/TEST-001.json"
  _cleanup_integration() {
    [[ -n "${deliver_pid:-}" ]] && kill -TERM "${deliver_pid}" 2>/dev/null || true
    # Reap any lingering fake-opencode sleeps created in new sessions.
    pkill -KILL -f "sleep \${FAKE_OPENCODE_SLEEP_SECONDS:-300}" 2>/dev/null || true
    rm -f "${mapping_file}"
    PATH="${saved_path}"
  }

  PATH="${bin_dir}:${PATH}"
  export PATH
  export DELIVER_STUCK_MINUTES=1 DELIVER_POLL_SECONDS=2 DELIVER_MAX_RESTARTS=2 FAKE_OPENCODE_SLEEP_SECONDS=300

  # Launch deliver-ticket.sh in the background.
  bash "${SCRIPT_DIR}/deliver-ticket.sh" "TEST-001:feat/test-int" >/dev/null 2>&1 &
  deliver_pid=$!

  local deadline=$(( $(date +%s) + 150 ))
  local restarted=0
  while (( $(date +%s) < deadline )); do
    if [[ -f "${run_count_file}" && "$(<"${run_count_file}")" -ge 2 ]]; then
      restarted=1
      break
    fi
    if ! kill -0 "${deliver_pid}" 2>/dev/null; then
      break
    fi
    sleep 2
  done

  _cleanup_integration

  # At least one fake opencode invocation must have occurred.
  assert_eq "1" "$( compgen -G "${marker_dir}/ran.*" >/dev/null 2>&1 && echo 1 || echo 0 )" "fake opencode should have run (marker exists)"
  # A restart is evidenced by run_count >= 2.
  assert_eq "1" "${restarted}" "deliver-ticket should have killed + restarted (run_count >= 2)"
  return 0
}

# ============================================================================
# TESTS: Single-flight + join + subcommands (AC-2, INV-DM-1/2/5/6)
# ============================================================================

# TC-DT-CMP-04: _cleanup_child clears the repo-local PID file (INV-DM-2).
test_cleanup_child_clears_pid_file() {
  local fake_delivery="${_test_tmpdir}/delivery"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  CURRENT_REF="GH-999"
  printf '{"pid":1,"start":0,"ref":"GH-999"}' >"$(pid_file_for "GH-999")"
  [[ -f "$(pid_file_for "GH-999")" ]] || { echo "  setup failed: pid file not written" >&2; return 1; }

  _cleanup_child

  [[ -f "$(pid_file_for "GH-999")" ]] && { echo "  PID file should be cleared" >&2; return 1; }
  assert_eq "" "${CURRENT_REF}" "_cleanup_child should clear CURRENT_REF"
  return 0
}

# TC-DT-MARK-01: the OWN path writes the delivering marker (INV-DM-3) and the
# marker carries the ref + pid. deliver_loop is stubbed so the OWN path runs in
# isolation. The marker survives run_delivery's return (cleared only by the EXIT
# trap — see TC-DT-MARK-02).
test_delivering_marker_lifecycle() {
  local fake_delivery="${_test_tmpdir}/delivery_marker"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  deliver_loop() { DELIVERY_RESULT="pr-open"; DELIVERY_EXIT_CODE=0; return 0; }

  # Marker must NOT exist before OWN.
  [[ ! -f "$(delivering_marker_file)" ]] || { echo "  marker should not exist before OWN" >&2; return 1; }

  run_delivery "GH-142" "" "" >/dev/null 2>&1 || true

  # OWN path wrote the marker before entering deliver_loop.
  assert_file_exists "$(delivering_marker_file)" "OWN path must write the delivering marker" || return 1
  local mref mpid
  mref="$(_jq -r '.ref // empty' "$(delivering_marker_file)" 2>/dev/null)" || mref=""
  mpid="$(_jq -r '.pid // empty' "$(delivering_marker_file)" 2>/dev/null)" || mpid=""
  assert_eq "GH-142" "${mref}" "marker must carry the ref" || return 1
  [[ "${mpid}" =~ ^[0-9]+$ ]] || { echo "  marker pid should be numeric, got '${mpid}'" >&2; return 1; }
  return 0
}

# TC-DT-MARK-02: the EXIT trap (_cleanup_child) clears the delivering marker so
# ceo-loop no longer treats the CEO as blocked on a delivery once the owner exits.
test_delivering_marker_cleared_on_cleanup() {
  local fake_delivery="${_test_tmpdir}/delivery_marker_cleanup"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  write_delivering_marker "GH-142" "$$"
  assert_file_exists "$(delivering_marker_file)" "setup: marker written" || return 1

  _cleanup_child

  [[ ! -f "$(delivering_marker_file)" ]] || { echo "  marker should be cleared by _cleanup_child" >&2; return 1; }
  return 0
}

# TC-DT-SF-01: pid_file_for returns the repo-local git-ignored path.
test_pid_file_path() {
  local fake_delivery="${_test_tmpdir}/delivery"
  DELIVERY_DIR="${fake_delivery}"
  assert_eq "${fake_delivery}/GH-142.pid" "$(pid_file_for "GH-142")" "GH-142 pid path"
  assert_eq "${fake_delivery}/PDEV-9.pid" "$(pid_file_for "PDEV-9")" "PDEV-9 pid path"
}

# TC-DT-SF-02: STUCK_MINUTES default is 10 (OQ-DM-3 regression guard; was 15).
test_stuck_minutes_default_10() {
  assert_eq "10" "${STUCK_MINUTES}" "default STUCK_MINUTES should be 10 (was 15)"
}

# Helper: spawn a stub process whose cmdline is exactly "deliver-ticket.sh"
# and whose cwd is the real ROOT_DIR (so owner_pid_if_live accepts it). Echoes
# the PID. Uses `exec -a` so $! IS the long-running process (not a transient
# subshell wrapper). The stub blocks until killed (or 30s elapses).
_spawn_fake_owner() {
  # shellcheck disable=SC2089  # intentional word-splitting of the -c body
  bash -c 'cd "'"${ROOT_DIR}"'"; exec -a deliver-ticket.sh sleep 30' >/dev/null 2>&1 &
  local pid=$!
  sleep 0.3
  printf '%s' "${pid}"
}

# TC-DT-SF-03: --is-delivering with no PID file → non-zero, empty stdout.
test_is_delivering_no_pid_file() {
  local fake_delivery="${_test_tmpdir}/delivery3"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  local out rc
  out="$(cmd_is_delivering "GH-142" 2>/dev/null)" || rc=$?
  rc="${rc:-0}"
  assert_eq "" "${out}" "--is-delivering must print nothing with no PID file"
  [[ "${rc}" -ne 0 ]] || { echo "  expected non-zero exit, got ${rc}" >&2; return 1; }
  return 0
}

# TC-DT-SF-04: --is-delivering with a live deliver-ticket.sh PID → exit 0.
test_is_delivering_live_pid() {
  local fake_delivery="${_test_tmpdir}/delivery4"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"
  local pid
  pid="$(_spawn_fake_owner)"
  kill -0 "${pid}" 2>/dev/null || { kill "${pid}" 2>/dev/null; return 1; }

  write_pid_file "GH-142" "${pid}" "$(date +%s)"

  cmd_is_delivering "GH-142"
  local rc=$?
  kill_process_tree "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  [[ ${rc} -eq 0 ]] || { echo "  expected exit 0 for live PID, got ${rc}" >&2; return 1; }
  return 0
}

# TC-DT-SF-05: --is-delivering with a dead PID → non-zero AND stale file removed.
test_is_delivering_dead_pid_cleans_stale() {
  local fake_delivery="${_test_tmpdir}/delivery5"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"
  # A PID that is almost certainly not a live deliver-ticket.sh.
  write_pid_file "GH-142" "999999" "$(date +%s)"

  cmd_is_delivering "GH-142" 2>/dev/null
  local rc=$?
  [[ ${rc} -ne 0 ]] || { echo "  expected non-zero for dead PID" >&2; return 1; }
  [[ ! -f "$(pid_file_for "GH-142")" ]] || { echo "  stale PID file should be removed" >&2; return 1; }
  return 0
}

# TC-DT-SF-06: --is-delivering (no REF) exits 0 when ANY delivery is live.
test_is_delivering_any_ref() {
  local fake_delivery="${_test_tmpdir}/delivery6"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"
  local pid
  pid="$(_spawn_fake_owner)"
  kill -0 "${pid}" 2>/dev/null || { kill "${pid}" 2>/dev/null; return 1; }

  write_pid_file "GH-142" "${pid}" "$(date +%s)"

  # Any-ref scan should find the live delivery.
  cmd_is_delivering ""
  local rc=$?
  [[ ${rc} -eq 0 ]] || { echo "  any-ref scan should exit 0 when a delivery is live" >&2; kill_process_tree "${pid}" 2>/dev/null; return 1; }
  kill_process_tree "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true

  # With the owner gone, any-ref scan should exit non-zero.
  cmd_is_delivering ""
  rc=$?
  [[ ${rc} -ne 0 ]] || { echo "  any-ref scan should exit non-zero when no delivery is live" >&2; return 1; }
  return 0
}

# TC-DT-SF-06b: --status with no active delivery prints delivering=no.
test_cmd_status_no_delivery() {
  local fake_delivery="${_test_tmpdir}/delivery6b"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  local out rc=0
  out="$(cmd_status "")" || rc=$?
  assert_eq "0" "${rc}" "status query should always exit 0" || return 1
  assert_contains "${out}" "delivering=no" "no PID files → delivering=no" || return 1
  return 0
}

# TC-DT-SF-06c: --status with a live deliver-ticket.sh owner prints delivering=yes
# (plus the ref). Exercises owner_pid_if_live via the any-ref scan path.
test_cmd_status_live_delivery() {
  local fake_delivery="${_test_tmpdir}/delivery6c"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"
  local pid
  pid="$(_spawn_fake_owner)"
  kill -0 "${pid}" 2>/dev/null || { kill "${pid}" 2>/dev/null; return 1; }

  # F-R2-1: record the owner's TRUE birth epoch so owner_pid_if_live accepts it.
  write_pid_file "GH-142" "${pid}" "$(_pid_start_epoch "${pid}")"

  local out rc=0
  out="$(cmd_status "")" || rc=$?
  kill_process_tree "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true

  assert_eq "0" "${rc}" "status query should always exit 0" || return 1
  assert_contains "${out}" "delivering=yes" "live owner → delivering=yes" || return 1
  assert_contains "${out}" "ref=GH-142" "should report the live ref" || return 1
  return 0
}

# TC-DT-SF-07: --last-message prints the stored PM message without running.
test_last_message_subcommand() {
  local fake_delivery="${_test_tmpdir}/delivery7"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"
  printf '%s' 'PR #143 open; blocker: needs design review' >"$(last_message_file_for "GH-142")"

  local out rc
  out="$(cmd_last_message "GH-142")" || rc=$?
  rc="${rc:-0}"
  assert_eq "PR #143 open; blocker: needs design review" "${out}" "should print stored last message"
  [[ ${rc} -eq 0 ]] || { echo "  exit should be 0" >&2; return 1; }
  return 0
}

# TC-DT-SF-08: --resume-prompt replaces the default delivery prompt.
# Mocks run_single_iteration (same-shell override) to capture the prompt arg.
test_resume_prompt_flag() {
  local fake_delivery="${_test_tmpdir}/delivery8"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  local run_log="${_test_tmpdir}/run8.log"
  : >"${run_log}"
  local resume_text="Fix the failing test in X by Y"

  # resolve_session calls _opencode session list (mock returns no session).
  _opencode() { printf '%s' '[]'; }
  # Terminal classification (CLOSED → merged) so deliver_loop stops in 1 iter.
  _gh() { printf '%s' '{"state":"CLOSED","labels":[]}'; }
  # run_single_iteration: capture the prompt (arg 3) and finish immediately.
  run_single_iteration() {
    printf '%s\n' "PROMPT_ARG:$3" >>"${run_log}"
    CAPTURED_PM_MESSAGE="PM completed via resume"
    write_last_message "GH-142" "PM completed via resume"
    printf 'finished'
  }

  MAX_RESTARTS=1
  CAPTURED_PM_MESSAGE="" DELIVERY_RESULT="" DELIVERY_PR_URL="" DELIVERY_EXIT_CODE=0 DELIVERY_LAST_MESSAGE=""

  deliver_loop "GH-142" "feat/x" "${resume_text}" >/dev/null 2>&1 || true

  local logged
  logged="$(cat "${run_log}" 2>/dev/null)"
  assert_contains "${logged}" "PROMPT_ARG:${resume_text}" "resume prompt should reach run_single_iteration"
  return 0
}

# TC-DT-SF-09: --resume-prompt without a value is rejected (usage error, exit 2).
test_resume_prompt_rejected() {
  local rc=""
  ( parse_args "--resume-prompt" ) 2>/dev/null || rc=$?
  rc="${rc:-0}"
  [[ ${rc} -eq "${EXIT_USAGE}" ]] || { echo "  --resume-prompt without value should exit ${EXIT_USAGE}, got ${rc}" >&2; return 1; }
  return 0
}

# TC-DT-SF-10: join abandons when the owner PID is reused (F-4). A PID file
# pointing at a process whose cmdline is NOT deliver-ticket.sh must NOT be joined.
test_join_aborts_when_pid_reused() {
  local fake_delivery="${_test_tmpdir}/delivery10"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  # Spawn a plain sleep — $! IS the sleep (cmdline "sleep 30", NOT
  # deliver-ticket.sh), so owner_pid_if_live must reject it (F-4 cmdline guard).
  sleep 30 &
  local sleep_pid=$!
  sleep 0.2
  write_pid_file "GH-142" "${sleep_pid}" "$(date +%s)"

  # owner_pid_if_live must reject it (cmdline does not contain deliver-ticket.sh).
  local live
  live="$(owner_pid_if_live "GH-142" 2>/dev/null)" || true
  assert_eq "" "${live}" "a sleep PID must not be treated as a live owner (cmdline mismatch)"

  # join_delivery should therefore return "own" (proceed to OWN).
  local out
  out="$(join_delivery "GH-142" "feat/x")"
  assert_eq "own" "${out}" "join should abandon on PID reuse/mismatch and return own"

  kill_process_tree "${sleep_pid}" 2>/dev/null || true
  wait "${sleep_pid}" 2>/dev/null || true
  return 0
}

# TC-DT-SF-11: deliver-ticket.sh does not auto-merge (F-2). The script never
# calls `gh pr merge` — classify_result/pr_url_for only inspect state.
test_deliver_ticket_does_not_auto_merge() {
  local fake_delivery="${_test_tmpdir}/delivery11"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  local gh_log="${_test_tmpdir}/gh11.log"
  : >"${gh_log}"
  _gh() {
    printf '%s\n' "gh:$*" >>"${gh_log}"
    case "$1" in
      # CLOSED → "merged" classification: even in a would-be-merged scenario,
      # no gh pr merge may be called (F-2). Terminal state → 1 iteration.
      issue) printf '%s' '{"state":"CLOSED","labels":[]}' ;;
      pr)    printf '%s' '[]' ;;
    esac
  }
  _opencode() { printf '%s' '[]'; }
  run_single_iteration() { CAPTURED_PM_MESSAGE="done"; write_last_message "GH-142" "done"; printf 'finished'; }

  MAX_RESTARTS=1
  CAPTURED_PM_MESSAGE="" DELIVERY_RESULT="" DELIVERY_PR_URL="" DELIVERY_EXIT_CODE=0 DELIVERY_LAST_MESSAGE=""
  CURRENT_REF="GH-142"

  deliver_loop "GH-142" "feat/x" >/dev/null 2>&1 || true

  # No gh pr merge call should have occurred anywhere.
  if grep -q "pr merge" "${gh_log}" 2>/dev/null; then
    echo "  gh pr merge must NEVER be called (F-2); saw:" >&2
    grep "pr merge" "${gh_log}" >&2 || true
    return 1
  fi
  return 0
}

# TC-DT-SF-12: default invocation prints a delivery summary on stdout with both
# the result classification and the PM last-message (INV-DM-1/4).
test_stdout_returns_pm_last_message_and_result() {
  local fake_delivery="${_test_tmpdir}/delivery12"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  _gh() {
    case "$1" in
      issue) printf '%s' '{"state":"OPEN","labels":[]}' ;;
      pr)
        if printf '%s ' "$@" | grep -q -- '--state open'; then
          printf '%s' '[{"number":143,"url":"https://github.com/x/y/pull/143"}]'
        else
          printf '%s' '[]'
        fi
        ;;
    esac
  }
  _opencode() { printf '%s' '[]'; }
  run_single_iteration() { CAPTURED_PM_MESSAGE="PR #143 open; blocker: needs design review"; write_last_message "GH-142" "PR #143 open; blocker: needs design review"; printf 'finished'; }

  MAX_RESTARTS=1
  CAPTURED_PM_MESSAGE="" DELIVERY_RESULT="" DELIVERY_PR_URL="" DELIVERY_EXIT_CODE=0 DELIVERY_LAST_MESSAGE=""
  CURRENT_REF="GH-142"

  deliver_loop "GH-142" "feat/x" >/dev/null 2>&1 || true
  local summary
  summary="$(print_delivery_summary)"

  assert_contains "${summary}" "result=" "summary must include result= key"
  assert_contains "${summary}" "pr_url=" "summary must include pr_url= key"
  assert_contains "${summary}" "last_message=" "summary must include last_message= key"
  assert_contains "${summary}" "pr-open" "summary should classify pr-open"
  assert_contains "${summary}" "PR #143 open" "summary should carry the PM last-message text"
  return 0
}

# ============================================================================
# TESTS: F-1 — owner start-epoch preserved across restart iterations
# ============================================================================
# F-1 (Major): run_single_iteration used to rewrite the PID file with a fresh
# $(date +%s) on each iteration, so once an iteration outlived
# PID_START_TOLERANCE_SECONDS the start-epoch reuse guard rejected the
# legitimate owner → --is-delivering false mid-delivery → ceo-loop killed a
# healthy CEO AND a concurrent caller OWNed instead of JOINing. The fix
# captures the wrapper start ONCE and reuses it. This test characterizes the
# contract: preserving the true start keeps the owner live; a fresh start
# after >tolerance is rejected.

# TC-DT-SF-13: owner stays live when start is PRESERVED across an iteration
# refresh; a fresh start after >tolerance is rejected (F-1 regression guard).
test_owner_live_across_iteration_refresh() {
  local fake_delivery="${_test_tmpdir}/delivery_f1"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  local pid
  pid="$(_spawn_fake_owner)"
  kill -0 "${pid}" 2>/dev/null || { kill "${pid}" 2>/dev/null; return 1; }

  # Simulate a long-lived owner: pin the "actual" start epoch the kernel would
  # report (now - 120s) so an iteration lasting >tolerance is realistic without
  # a real 2-min sleep. Use a GLOBAL bridge var because the stub runs inside a
  # $(...) subshell where a `local` from this function is not on the call stack.
  _F1_MOCK_PID_START_EPOCH=$(( $(date +%s) - 120 ))
  _pid_start_epoch() { printf '%s' "${_F1_MOCK_PID_START_EPOCH}"; }

  # PRESERVED start (the fix): record the owner's TRUE start.
  write_pid_file "GH-142" "${pid}" "${_F1_MOCK_PID_START_EPOCH}"
  local live
  live="$(owner_pid_if_live "GH-142" 2>/dev/null)" || live=""
  assert_eq "${pid}" "${live}" "owner must stay LIVE when start is preserved across iterations (F-1)" \
    || { _restore_pid_start_epoch; kill_process_tree "${pid}" 2>/dev/null; wait "${pid}" 2>/dev/null || true; return 1; }

  # BUGGY start (the pre-fix behavior): a fresh $(date +%s) recorded now, while
  # the owner actually started 120s ago → diff > tolerance → rejected. This is
  # the regression the F-1 fix prevents.
  write_pid_file "GH-142" "${pid}" "$(date +%s)"
  live="$(owner_pid_if_live "GH-142" 2>/dev/null)" || live=""
  assert_eq "" "${live}" "regression guard: a fresh start after >tolerance must be REJECTED" \
    || { _restore_pid_start_epoch; kill_process_tree "${pid}" 2>/dev/null; wait "${pid}" 2>/dev/null || true; return 1; }

  _restore_pid_start_epoch
  kill_process_tree "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  return 0
}

# TC-DT-SF-13b: --is-delivering stays true across an iteration refresh (the
# post-iteration case) when start is preserved (F-1).
test_is_delivering_live_pid_across_iteration_refresh() {
  local fake_delivery="${_test_tmpdir}/delivery_f1b"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"
  local pid
  pid="$(_spawn_fake_owner)"
  kill -0 "${pid}" 2>/dev/null || { kill "${pid}" 2>/dev/null; return 1; }

  # GLOBAL bridge (see SF-13 note above): locals aren't visible in the $()
  # subshell that owner_pid_if_live runs in.
  _F1_MOCK_PID_START_EPOCH=$(( $(date +%s) - 120 ))
  _pid_start_epoch() { printf '%s' "${_F1_MOCK_PID_START_EPOCH}"; }

  # Initial OWN write with the true start.
  write_pid_file "GH-142" "${pid}" "${_F1_MOCK_PID_START_EPOCH}"
  cmd_is_delivering "GH-142" || { _restore_pid_start_epoch; kill_process_tree "${pid}" 2>/dev/null; return 1; }

  # Iteration refresh re-writes the PID file with the SAME start (F-1 fix).
  write_pid_file "GH-142" "${pid}" "${_F1_MOCK_PID_START_EPOCH}"
  cmd_is_delivering "GH-142" || { _restore_pid_start_epoch; kill_process_tree "${pid}" 2>/dev/null; return 1; }

  _restore_pid_start_epoch
  kill_process_tree "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  return 0
}

# TC-DT-SF-13c: _parse_elapsed_to_seconds handles BSD/macOS `ps -o etime=` shapes
# (F-7) so the start-epoch guard is not silently disabled on Darwin.
test_parse_elapsed_to_seconds_bsd() {
  assert_eq "" "$(_parse_elapsed_to_seconds "")" "empty → empty (degrade)" || return 1
  assert_eq "83" "$(_parse_elapsed_to_seconds "1:23")" "MM:SS → 83s" || return 1
  assert_eq "3723" "$(_parse_elapsed_to_seconds "1:02:03")" "H:MM:SS → 3723s" || return 1
  assert_eq "93723" "$(_parse_elapsed_to_seconds "1-02:02:03")" "D-HH:MM:SS → 93723s" || return 1
  # Zero-padded fields (08/09) must NOT be read as octal (regression guard).
  assert_eq "68" "$(_parse_elapsed_to_seconds "1:08")" "MM:SS with 08 secs → 68s (not octal)" || return 1
  assert_eq "3665" "$(_parse_elapsed_to_seconds "1:01:05")" "H:MM:SS → 3665s" || return 1
  assert_eq "" "$(_parse_elapsed_to_seconds "garbage")" "garbage → empty (degrade)" || return 1
  return 0
}

# ============================================================================
# TESTS: F-R2-1 — OWN captures the TRUE process birth epoch (red-team R2)
# ============================================================================
# F-R2-1 (red-team R2 must-fix): run_delivery used to capture
# WRAPPER_START_EPOCH="$(date +%s)" at OWN time — AFTER resolve_session
# (opencode session list) and, on a fresh delivery (no branch arg),
# prepare_main_for_delivery (git fetch --prune + git pull --ff-only). When that
# setup gap exceeds PID_START_TOLERANCE_SECONDS (realistic under GitHub
# rate-limit backoff / network jitter), the F-4 start-epoch guard in
# owner_pid_if_live compares the recorded capture-time value to $$'s TRUE birth
# → rejects the legitimate owner mid-delivery → --is-delivering false →
# INV-DM-2 double-PM / INV-DM-3 CEO kill. The fix records the TRUE process
# birth (via _pid_start_epoch, constant = now - etimes), so recorded matches
# recomputed exactly (diff == 0) however long setup took.

# TC-DT-SF-13d: the OWN path records $$'s TRUE process birth epoch, not
# capture-time $(date +%s) (F-R2-1). Directly guards the OWN capture line and
# exercises the fresh-delivery OWN shape (branch=""). _pid_start_epoch is
# constant, so the recorded value must match a fresh probe to within
# second-resolution rounding; a capture-time value would differ by $$'s full
# age (>> 1s).
test_run_delivery_captures_true_birth_epoch() {
  local fake_delivery="${_test_tmpdir}/delivery_rdel"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"
  # Stub the heavy iteration loop so run_delivery's OWN path runs in
  # isolation (the override is scoped to this run_test subshell).
  deliver_loop() { DELIVERY_RESULT="pr-open"; DELIVERY_EXIT_CODE=0; return 0; }
  run_delivery "GH-142" "" "" >/dev/null 2>&1 || true
  local recorded current_birth diff
  recorded="$(_pid_file_field "GH-142" "start")"
  current_birth="$(_pid_start_epoch "$$")"   # constant: equals $$'s true birth
  [[ "${recorded}" =~ ^[0-9]+$ ]] || { echo "  recorded start not numeric: '${recorded}'" >&2; return 1; }
  [[ "${current_birth}" =~ ^[0-9]+$ ]] || { echo "  _pid_start_epoch(\$\$) returned non-numeric: '${current_birth}'" >&2; return 1; }
  diff=$(( current_birth - recorded )); (( diff < 0 )) && diff=$(( -diff ))
  (( diff <= 1 )) || { echo "  OWN capture should record true birth; recorded=${recorded} birth=${current_birth} diff=${diff}" >&2; return 1; }
  return 0
}

# TC-DT-SF-13e (RUN_SLOW_TESTS): the definitive F-R2-1 regression. Simulates
# the fresh-delivery slow-setup path: the owner process is born, then setup
# (prepare_main_for_delivery's git fetch/pull under GitHub rate-limit backoff /
# network jitter) runs for > PID_START_TOLERANCE_SECONDS before the OWN path
# writes the PID file. Recording the TRUE birth (the fix) keeps the owner LIVE
# (and --is-delivering true); recording capture-time $(date +%s) (the pre-fix
# bug) is rejected — exactly the spurious "not live" the fix eliminates.
test_owner_live_after_slow_setup() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] TC-DT-SF-13e (set RUN_SLOW_TESTS=true to run)\n'
    return 0
  fi
  local fake_delivery="${_test_tmpdir}/delivery_slow"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"
  local pid
  pid="$(_spawn_fake_owner)"
  kill -0 "${pid}" 2>/dev/null || { kill "${pid}" 2>/dev/null; return 1; }

  # Fresh-delivery slow-setup gap (> PID_START_TOLERANCE_SECONDS, with margin).
  sleep 7

  # F-R2-1 FIX: record the owner's TRUE process birth epoch. After the slow
  # setup gap the owner must STILL be recognized as live (diff == 0: the
  # recomputed birth is the same constant).
  write_pid_file "GH-142" "${pid}" "$(_pid_start_epoch "${pid}")"
  local live
  live="$(owner_pid_if_live "GH-142" 2>/dev/null)" || live=""
  assert_eq "${pid}" "${live}" "F-R2-1: owner must stay LIVE after slow setup when TRUE birth is recorded" \
    || { kill_process_tree "${pid}" 2>/dev/null; wait "${pid}" 2>/dev/null || true; return 1; }
  cmd_is_delivering "GH-142" \
    || { kill_process_tree "${pid}" 2>/dev/null; wait "${pid}" 2>/dev/null || true; \
         echo "  --is-delivering must be true for a live owner after slow setup (F-R2-1)" >&2; return 1; }

  # Regression characterization: the pre-fix capture-time value ($(date +%s)
  # recorded now, while the owner was actually born ~7s ago) is REJECTED by the
  # F-4 guard — the spurious "not live" mid-delivery the fix eliminates.
  write_pid_file "GH-142" "${pid}" "$(date +%s)"
  live="$(owner_pid_if_live "GH-142" 2>/dev/null)" || live=""
  assert_eq "" "${live}" "F-R2-1 regression guard: capture-time start after >tolerance setup gap must be REJECTED (pre-fix bug)" \
    || { kill_process_tree "${pid}" 2>/dev/null; wait "${pid}" 2>/dev/null || true; return 1; }

  kill_process_tree "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  return 0
}

# ============================================================================
# F-3: the three integration behaviors deferred in Phase 1 (concurrency
# convergence, signal propagation, session-traffic liveness handoff). These
# exercise REAL deliver-ticket.sh subprocesses / the real monitor loop, so they
# are gated behind RUN_SLOW_TESTS=true (same as INT-01) to keep the default
# suite fast.
# ============================================================================

# TC-DT-INT-02: two concurrent deliver-ticket.sh for the SAME ticket converge on
# exactly ONE PM (INV-DM-2). The first OWNs + spawns opencode; the second probes
# the live owner and JOINs (waits) — it must NOT spawn a second opencode.
test_concurrent_converge_one_pm() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] TC-DT-INT-02 (set RUN_SLOW_TESTS=true to run)\n'
    return 0
  fi

  local bin_dir="${_test_tmpdir}/bin_conv"
  local marker_dir="${_test_tmpdir}/markers_conv"
  mkdir -p "${bin_dir}" "${marker_dir}"
  local run_count_file="${marker_dir}/run_count"
  local session_json='[{"id":"ses_conv_001","title":"ticket-CONV-001","time":"2026-01-01T00:00:00Z"}]'

  # Fake opencode: `session list` returns one session; `run` records an
  # invocation then sleeps long enough to still be "delivering" when the JOINer
  # probes. `db` returns an empty result so pm-liveness degrades instantly
  # (otherwise the `db` call would hit the `sleep 120` run-branch and stall the
  # owner's monitor loop for 15s per iteration).
  cat >"${bin_dir}/opencode" <<OPENCODE
#!/usr/bin/env bash
if [[ "\$1" == "session" && "\$2" == "list" ]]; then
  printf '%s' '${session_json}'
  exit 0
fi
if [[ "\$1" == "db" ]]; then
  printf '[]'
  exit 0
fi
n=0
[[ -f "${run_count_file}" ]] && n=\$(<"${run_count_file}")
n=\$((n+1))
printf '%s' "\$n" >"${run_count_file}"
: >"${marker_dir}/ran.\${n}"
sleep 120
exit 0
OPENCODE
  chmod +x "${bin_dir}/opencode"

  cat >"${bin_dir}/gh" <<'GH'
#!/usr/bin/env bash
case "$1" in
  issue) printf '%s' '{"state":"OPEN","labels":[]}' ;;
  *) printf '%s' '[]' ;;
esac
GH
  chmod +x "${bin_dir}/gh"

  local saved_path="${PATH}"
  local pid_file="${ROOT_DIR}/.ai/local/delivery/CONV-001.pid"
  _cleanup_converge() {
    pkill -TERM -f "deliver-ticket.sh CONV-001" 2>/dev/null || true
    sleep 1
    pkill -KILL -f "sleep 120" 2>/dev/null || true
    rm -f "${pid_file}" "${SESSION_DIR}/CONV-001.json"
    PATH="${saved_path}"
  }

  PATH="${bin_dir}:${PATH}"
  export PATH
  # Keep the owner "delivering" (not stuck) long enough for the JOINer to probe.
  # Fast pm-liveness stub (healthy ⇒ rc 0) so the owner's monitor loop isn't
  # blocked by the slow worktree-mtime fallback (which `find`s the whole repo).
  export DELIVER_POLL_SECONDS=2 DELIVER_MAX_RESTARTS=1 DELIVER_STUCK_MINUTES=10 \
         PM_LIVENESS_SCRIPT="${bin_dir}/pm-liveness-stub"
  printf '#!/usr/bin/env bash\nexit 0\n' >"${bin_dir}/pm-liveness-stub"
  chmod +x "${bin_dir}/pm-liveness-stub"

  # Launch the OWNER.
  bash "${SCRIPT_DIR}/deliver-ticket.sh" "CONV-001:feat/conv" >/dev/null 2>&1 &
  local owner_pid=$!

  # Wait until the owner has spawned its PM (run_count == 1).
  local deadline=$(( $(date +%s) + 30 ))
  while (( $(date +%s) < deadline )); do
    [[ -f "${run_count_file}" && "$(<"${run_count_file}")" -ge 1 ]] && break
    kill -0 "${owner_pid}" 2>/dev/null || break
    sleep 1
  done

  local count_before
  # NOTE: `$(<file 2>/dev/null)` is NOT the bash `$(<file)` idiom (the extra
  # redirect defeats it → empty output). Use `cat` for the error-tolerant read.
  count_before="$(cat "${run_count_file}" 2>/dev/null || printf '0')"
  assert_eq "1" "${count_before}" "owner should have spawned exactly one PM" \
    || { _cleanup_converge; return 1; }

  # Launch the JOINER (same ticket) and let it probe + settle into the JOIN wait.
  bash "${SCRIPT_DIR}/deliver-ticket.sh" "CONV-001:feat/conv" >/dev/null 2>&1 &
  local joiner_pid=$!
  local settle_deadline=$(( $(date +%s) + 8 ))
  while (( $(date +%s) < settle_deadline )); do
    kill -0 "${joiner_pid}" 2>/dev/null || break
    sleep 1
  done

  local count_after
  count_after="$(cat "${run_count_file}" 2>/dev/null || printf '0')"
  _cleanup_converge

  # The JOINer must NOT have spawned a second PM.
  assert_eq "1" "${count_after}" "concurrent caller JOINs → exactly one PM (INV-DM-2)" || return 1
  return 0
}

# TC-DT-INT-03: SIGTERM to the owner wrapper is propagated to its tracked
# opencode child (INV-DM-2). Exercises the REAL production trap chain —
# TERM → _on_interrupt → exit → EXIT trap → _cleanup_child → kill_process_tree —
# by sourcing deliver-ticket.sh in a harness, spawning a trackable child, and
# self-SIGTERMing. activity_epoch is stubbed because the real worktree scan is
# pathologically slow on large repos (it `find`s every file), which would defer
# the signal past any practical test window; the trap/kill chain is unaffected.
test_signal_propagation_sigterm_to_child() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] TC-DT-INT-03 (set RUN_SLOW_TESTS=true to run)\n'
    return 0
  fi

  local work="${_test_tmpdir}/sig"
  local harness="${work}/harness.sh"
  local child_pid_file="${work}/child_pid"
  mkdir -p "${work}"
  local script_under_test="${SCRIPT_DIR}/deliver-ticket.sh"

  cat >"${harness}" <<HARNESS
#!/usr/bin/env bash
set -e
source "${script_under_test}"
trap - ERR
# activity_epoch is stubbed (see test header): the real worktree scan (find)
# is pathologically slow on every repo file, deferring the signal.
activity_epoch() { printf '0\n'; }
# Spawn a trackable fake opencode child the EXIT trap will reap.
sleep 120 &
CURRENT_OPENCODE_PID="\$!"
printf '%s' "\$!" >"${child_pid_file}"
# Let the harness settle, then self-terminate to fire the TERM → EXIT trap chain.
sleep 2
kill -TERM "\$\$"
HARNESS

  bash "${harness}" >/dev/null 2>&1 &
  local harness_pid=$!

  # Wait for the child PID marker.
  local deadline=$(( $(date +%s) + 10 ))
  local child_pid=""
  while (( $(date +%s) < deadline )); do
    if [[ -f "${child_pid_file}" ]]; then
      child_pid="$(cat "${child_pid_file}" 2>/dev/null || printf '')"
      break
    fi
    kill -0 "${harness_pid}" 2>/dev/null || break
    sleep 1
  done
  [[ "${child_pid}" =~ ^[0-9]+$ ]] || { pkill -KILL -f "sleep 120" 2>/dev/null || true; echo "  no child PID captured" >&2; return 1; }

  # Wait for the harness to self-terminate (internal sleep 2 + self-SIGTERM) and
  # the EXIT trap to reap the tracked child.
  local reap=$(( $(date +%s) + 12 ))
  local harness_dead=0 child_dead=0
  while (( $(date +%s) < reap )); do
    kill -0 "${harness_pid}" 2>/dev/null || harness_dead=1
    kill -0 "${child_pid}" 2>/dev/null || child_dead=1
    [[ ${harness_dead} -eq 1 && ${child_dead} -eq 1 ]] && break
    sleep 1
  done

  pkill -KILL -f "sleep 120" 2>/dev/null || true

  assert_eq "1" "${harness_dead}" "SIGTERM ⇒ owner exits (TERM trap fired)" || return 1
  assert_eq "1" "${child_dead}" "SIGTERM ⇒ tracked opencode child reaped (INV-DM-2)" || return 1
  return 0
}

# TC-DT-SF-14: session-traffic liveness handoff (F-3, INV-DM-5). Drives the REAL
# run_single_iteration monitor loop with a fake opencode child + mocked
# pm-liveness, proving: healthy session traffic resets the stuck timer (child is
# NOT killed, finishes); stalled traffic lets the timer fire (child killed,
# "stuck"). POLL_SECONDS is readonly at source-time, so we re-source
# deliver-ticket.sh in a subprocess with a tuned env.
test_session_traffic_liveness_handoff() {
  if [[ "${RUN_SLOW_TESTS:-}" != "true" ]]; then
    printf '  [SKIP] TC-DT-SF-14 (set RUN_SLOW_TESTS=true to run)\n'
    return 0
  fi

  local fake_log="${_test_tmpdir}/logs_f3_liveness"
  local harness="${_test_tmpdir}/handoff_harness.sh"
  mkdir -p "${fake_log}"
  local script_under_test="${SCRIPT_DIR}/deliver-ticket.sh"

  cat >"${harness}" <<HARNESS
#!/usr/bin/env bash
set -e
source "${script_under_test}"
trap - ERR
# Fake opencode child: a killable sleep whose PID == \$!.
_setsid() { exec sleep "\${CHILD_SLEEP:-10}"; }
# No worktree activity → only session-traffic health resets the stuck timer.
activity_epoch() { printf '0\n'; }
if [[ "\${LIVENESS:-healthy}" == "stalled" ]]; then
  _pm_liveness() { return 1; }
else
  _pm_liveness() { return 0; }
fi
run_single_iteration "GH-142" "ses_f3" "prompt" "feat/x"
HARNESS

  local healthy stalled
  # NOTE: deliver-ticket.sh hardcodes `readonly LOG_DIR` (ignores env), so we do
  # NOT pass LOG_DIR here — and it is readonly in THIS shell, so a `LOG_DIR=…`
  # prefix would error. The default LOG_DIR (ROOT_DIR/tmp/deliver-ticket) is fine.
  # Healthy: child sleeps 5s (> stuck_seconds 2). Traffic resets the timer each
  # poll, so the child survives past the threshold and exits naturally.
  healthy="$(LIVENESS=healthy CHILD_SLEEP=5 DELIVER_POLL_SECONDS=1 \
    DELIVER_STUCK_SECONDS=2 bash "${harness}" 2>/dev/null)" || true
  # Stalled: child sleeps 20s but stuck_seconds 2 fires → child killed.
  stalled="$(LIVENESS=stalled CHILD_SLEEP=20 DELIVER_POLL_SECONDS=1 \
    DELIVER_STUCK_SECONDS=2 bash "${harness}" 2>/dev/null)" || true

  assert_eq "finished" "${healthy}" "healthy session-traffic ⇒ child NOT killed (finishes) (INV-DM-5)" || return 1
  assert_eq "stuck" "${stalled}" "stalled session-traffic ⇒ child killed (stuck) (INV-DM-5)" || return 1
  return 0
}

# ============================================================================
# TESTS: Bug 1 fix — unbound variable in cmd_status
# ============================================================================

# cmd_status with no live delivery must not crash under set -u.
test_cmd_status_no_delivery_no_unbound() {
  local fake_delivery="${_test_tmpdir}/delivery_bug1"
  mkdir -p "${fake_delivery}"
  DELIVERY_DIR="${fake_delivery}"

  local result
  result="$(INSTALL_MODE="local" cmd_status "GH-999-nolive" 2>&1)" || true
  # Must NOT contain "unbound variable"
  assert_not_contains "${result}" "unbound" "session_id must not be unbound"
}

# ============================================================================
# TESTS: Bug 2 fix — CAPTURED_PM_MESSAGE survives subshell boundary
# ============================================================================

# Regression: CAPTURED_PM_MESSAGE is lost across the $(...) subshell boundary.
# run_single_iteration must write the last-message file; deliver_loop reads it.
test_last_message_survives_subshell_boundary() {
  local ref="TEST-SUBSHELL"
  local lmf
  lmf="$(last_message_file_for "${ref}")"

  # Simulate what the REAL run_single_iteration does: write to the file
  # INSIDE the subshell.
  monitor_result="$(CAPTURED_PM_MESSAGE="PR open, needs review"; write_last_message "${ref}" "PR open, needs review"; printf 'finished')"

  # CAPTURED_PM_MESSAGE is empty in the parent (subshell lost it)
  assert_eq "" "${CAPTURED_PM_MESSAGE}" "global lost across subshell"

  # But the file persists
  assert_file_exists "${lmf}" "last-message file written inside subshell"
  local stored
  stored="$(cat "${lmf}")"
  assert_eq "PR open, needs review" "${stored}" "file content matches"
}

test_deliver_loop_reads_last_message_from_file() {
  local ref="TEST-LM-FILE"
  # Mock: mirrors the real run_single_iteration (writes file + returns finished)
  run_single_iteration() {
    write_last_message "${ref}" "PR open, awaiting review"
    printf 'finished'
  }
  # Mock classify_result to return pr-open
  classify_result() { printf 'pr-open'; }

  CAPTURED_PM_MESSAGE=""
  DELIVERY_RESULT="" DELIVERY_PR_URL="" DELIVERY_EXIT_CODE=0 DELIVERY_LAST_MESSAGE=""
  reset_counters

  deliver_loop "${ref}" "feat/test" "" || true

  assert_eq "PR open, awaiting review" "${DELIVERY_LAST_MESSAGE}" "DELIVERY_LAST_MESSAGE must be populated from file"

  # Restore
  unset -f classify_result 2>/dev/null || true
}

# Helper function to reset iteration counters
reset_counters() {
  # No-op stub for now; counters are tracked in the loop
  :
}

# ============================================================================
# RUN TESTS
# ============================================================================
test_hook_help_contract() {
  local help
  help="$(bash "${SCRIPT_DIR}/deliver-ticket.sh" --help)"
  assert_contains "${help}" "ADOS_PRE_ITERATION_HOOK" || return 1
  assert_contains "${help}" "ADOS_HOOK_SHUTDOWN_GRACE_SECONDS" || return 1
  assert_contains "${help}" "ADOS_HOOK_ENV_ALLOWLIST" || return 1
  assert_contains "${help}" "Default: empty. Built-in: OC_ADOS_AGENT_*_MODEL." || return 1
  assert_contains "${help}" "Extra exact valid names require comma-separated explicit" || return 1
  assert_contains "${help}" "allowlist; credentials at operator risk." || return 1
  assert_contains "${help}" "data-only/literal and never logged." || return 1
  assert_contains "${help}" "ADOS_HOOK_AGENT=pm" || return 1
  assert_contains "${help}" "ADOS_HOOK_SCRIPT=deliver-ticket" || return 1
  assert_contains "${help}" "ADOS_HOOK_ENV_OUTPUT" || return 1
  assert_contains "${help}" "ADOS_HOOK_ENV_FORMAT=ADOS_HOOK_ENV_V1" || return 1
  assert_not_contains "${help}" "ADOS_HOOK_RETRY_SECONDS" || return 1
  assert_not_contains "${help}" "ADOS_HOOK_MAX_FAILURES"
}

# TC-HOOK-005: deliver_loop is the public PM execution path; a dry-run must
# render its command without ever executing a configured hook.
test_hook_dry_run_exclusion() {
  local marker="${_test_tmpdir}/hook-ran" hook="${_test_tmpdir}/hook"
  cat >"${hook}" <<'HOOK'
#!/usr/bin/env bash
printf invoked >"${HOOK_MARKER}"
HOOK
  chmod 700 "${hook}"
  ADOS_PRE_ITERATION_HOOK="${hook}" HOOK_MARKER="${marker}" bash -c '
    source "$1"
    DELIVERY_DIR="$2/delivery"; mkdir -p "$DELIVERY_DIR"
    DRY_RUN=true; MAX_RESTARTS=1
    resolve_session() { printf ""; }
    run_single_iteration() { printf finished; }
    deliver_loop TEST-DRY-HOOK feat/test ""
  ' _ "${SCRIPT_DIR}/deliver-ticket.sh" "${_test_tmpdir}" || return 1
  [[ ! -e "${marker}" ]] || { printf 'dry-run executed hook\n' >&2; return 1; }
  [[ -z "${CURRENT_HOOK_TMPDIR:-}" && -z "${CURRENT_HOOK_ENV_OUTPUT:-}" ]]
}

# Black-box TC-HOOK-005 coverage: execute the installed CLI from an isolated
# project root so its OWN bookkeeping cannot touch this checkout's .ai/local.
test_hook_dry_run_cli_exclusion() {
  local project="${_test_tmpdir}/project" bin="${_test_tmpdir}/bin" hook="${_test_tmpdir}/hook" marker="${_test_tmpdir}/marker"
  mkdir -p "${project}/scripts" "${bin}"
  cp "${SCRIPT_DIR}/deliver-ticket.sh" "${project}/scripts/deliver-ticket.sh"
  cat >"${hook}" <<'HOOK'
#!/usr/bin/env bash
printf invoked >"${HOOK_MARKER}"
HOOK
  chmod 700 "${hook}"
  for command in git gh jq setsid; do
    cat >"${bin}/${command}" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod 700 "${bin}/${command}"
  done
  PATH="${bin}:${PATH}" HOOK_MARKER="${marker}" ADOS_PRE_ITERATION_HOOK="${hook}" \
    bash "${project}/scripts/deliver-ticket.sh" --dry-run TEST-905:feat/test >/dev/null || return 1
  [[ ! -e "${marker}" ]] || { printf 'public --dry-run invoked hook\n' >&2; return 1; }
  [[ ! -d "${project}/.ai/local" || ! -e "${project}/.ai/local/delivery/TEST-905.pid" ]]
}

test_hook_failure_variants() {
  local hook="${_test_tmpdir}/hook"
  : >"${hook}"
  chmod 600 "${hook}"
  ! ADOS_PRE_ITERATION_HOOK="${hook}" bash -c 'source "$1"; run_pre_iteration_hook' _ "${SCRIPT_DIR}/deliver-ticket.sh" || return 1
  printf '#!/missing/interpreter\n' >"${hook}"; chmod 700 "${hook}"
  ! ADOS_PRE_ITERATION_HOOK="${hook}" bash -c 'source "$1"; run_pre_iteration_hook' _ "${SCRIPT_DIR}/deliver-ticket.sh" || return 1
  printf '#!/usr/bin/env bash\nexit 7\n' >"${hook}"; chmod 700 "${hook}"
  ! ADOS_PRE_ITERATION_HOOK="${hook}" bash -c 'source "$1"; run_pre_iteration_hook' _ "${SCRIPT_DIR}/deliver-ticket.sh"
}
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  run_test "TC-DT-01: parse ticket only (no branch)" test_parse_ticket_only
  run_test "TC-DT-01b: validate ticket ref" test_validate_ticket_ref_valid
  run_test "TC-DT-01c: reject invalid ticket ref" test_validate_ticket_ref_invalid
  run_test "TC-DT-02: parse ticket:branch" test_parse_ticket_with_branch
  run_test "TC-DT-02b: parse PDEV ticket:branch" test_parse_pdev_ticket
  run_test "TC-DT-02c: to_issue_number strips prefix" test_to_issue_number
  run_test "TC-DT-03: branch mismatch warning" test_branch_mismatch_warning
  run_test "TC-DT-04: branch resolution from mapping" test_branch_from_mapping
  run_test "TC-DT-04b: branch from arg (no mapping)" test_branch_from_arg_no_mapping
  run_test "TC-DT-04c: no branch when nothing provided" test_no_branch_when_nothing
  run_test "TC-DT-04d: resolve_branch git-scan discovers+persists" test_resolve_branch_git_scan_discovers_and_persists
  run_test "TC-DT-04e: resolve_branch git-scan ref-boundary" test_resolve_branch_scan_ref_boundary
  run_test "TC-DT-05: stale detection triggers kill" test_stale_detection_triggers
  run_test "TC-DT-05b: not stuck within threshold" test_stale_detection_no_trigger
  run_test "TC-DT-06: max restarts exceeded" test_max_restarts_exceeded
  run_test "TC-DT-06b: under max restarts continues" test_under_max_restarts_continue
  run_test "TC-DT-06c: stuck at max restarts" test_stuck_at_max_restarts
  run_test "TC-DT-07: classify blocked (human-input-needed)" test_classify_blocked
  run_test "TC-DT-07b: classify merged (closed issue)" test_classify_merged_closed
  run_test "TC-DT-07c: classify pr-open" test_classify_pr_open
  run_test "TC-DT-07d: classify failed" test_classify_failed
  run_test "TC-DT-07e: classify unknown (gh failure)" test_classify_unknown
  run_test "TC-DT-07f: classify pr-open (empty-branch title search fallback)" test_classify_pr_open_empty_branch_fallback
  run_test "TC-DT-06d: stuck+unknown continues without restart burn" test_unknown_continues
  run_test "TC-DT-06e: finished+unknown stops (GH-126 retry-loop fix)" test_decide_finished_unknown_stops
  run_test "TC-DT-06f: stuck+unknown continues" test_decide_stuck_unknown_continues
  run_test "TC-DT-06g: finished+failed stops (terminal)" test_decide_finished_failed_stops
  run_test "TC-DT-06h: finished+merged stops" test_decide_finished_merged_stops
  run_test "TC-DT-06h: finished+blocked stops" test_decide_finished_blocked_stops
  run_test "TC-DT-06h: finished+pr-open stops" test_decide_finished_pr_open_stops
  run_test "TC-DT-06i: stuck+merged stops" test_decide_stuck_merged_stops
  run_test "TC-DT-06i: stuck+blocked stops" test_decide_stuck_blocked_stops
  run_test "TC-DT-06i: stuck+pr-open stops" test_decide_stuck_pr_open_stops
  run_test "TC-DT-08: prompt contains ticket and branch" test_prompt_contains_ticket
  run_test "TC-DT-08b: prompt does NOT auto-merge (F-2)" test_prompt_does_not_auto_merge
  run_test "TC-DT-08c: prompt has blocked workflow" test_prompt_has_blocked_workflow
  run_test "TC-DT-08d: prompt enforces single ticket" test_prompt_single_ticket
  run_test "TC-DT-08e: prompt references 11-phase lifecycle" test_prompt_has_lifecycle
  run_test "TC-DT-08g: prompt merges main on resume" test_prompt_merge_main_on_resume
  run_test "TC-DT-08h: prompt has Resume Sync section" test_prompt_has_resume_sync_section
  run_test "TC-DT-08i: prompt fetches review comments on resume" test_prompt_fetches_review_comments
  run_test "TC-DT-CMP-01: kill_process_tree terminates process" test_kill_process_tree_kills_process
  run_test "TC-DT-CMP-02: resolve_session title lookup" test_resolve_session_title_lookup
  run_test "TC-DT-CMP-03: _cleanup_child kills tracked PID" test_cleanup_child_kills_tracked_pid
  run_test "TC-DT-CMP-04: _cleanup_child clears PID file" test_cleanup_child_clears_pid_file
  run_test "TC-DT-MARK-01: delivering marker lifecycle (OWN write)" test_delivering_marker_lifecycle
  run_test "TC-DT-MARK-02: delivering marker cleared on cleanup" test_delivering_marker_cleared_on_cleanup
  run_test "TC-DT-INT-01: integration kill/restart cycle (slow)" test_integration_kill_restart_cycle

  # AC-2: single-flight + join + subcommands + signal-prop + session-traffic liveness
  run_test "TC-DT-SF-01: pid_file_for repo-local path" test_pid_file_path
  run_test "TC-DT-SF-02: stuck-minutes default is 10" test_stuck_minutes_default_10
  run_test "TC-DT-SF-03: --is-delivering no PID file" test_is_delivering_no_pid_file
  run_test "TC-DT-SF-04: --is-delivering live PID" test_is_delivering_live_pid
  run_test "TC-DT-SF-05: --is-delivering dead PID cleans stale" test_is_delivering_dead_pid_cleans_stale
  run_test "TC-DT-SF-06: --is-delivering any ref" test_is_delivering_any_ref
  run_test "TC-DT-SF-06b: --status no active delivery" test_cmd_status_no_delivery
  run_test "TC-DT-SF-06c: --status live delivery" test_cmd_status_live_delivery
  run_test "TC-DT-SF-07: --last-message subcommand" test_last_message_subcommand
  run_test "TC-DT-SF-08: --resume-prompt flag passthrough" test_resume_prompt_flag
  run_test "TC-DT-SF-09: --resume-prompt rejected empty/conflict" test_resume_prompt_rejected
  run_test "TC-DT-SF-10: join abandons on PID reuse (F-4)" test_join_aborts_when_pid_reused
  run_test "TC-DT-SF-11: deliver-ticket does not auto-merge (F-2)" test_deliver_ticket_does_not_auto_merge
  run_test "TC-DT-SF-12: stdout delivery summary (result+last_message)" test_stdout_returns_pm_last_message_and_result

  # Bug fixes: unbound variable + subshell boundary
  run_test "Bug 1: cmd_status no delivery no unbound" test_cmd_status_no_delivery_no_unbound
  run_test "Bug 2: last_message survives subshell boundary" test_last_message_survives_subshell_boundary
  run_test "Bug 2: deliver_loop reads last_message from file" test_deliver_loop_reads_last_message_from_file

  # F-1: owner start-epoch preserved across restart iterations
  run_test "TC-DT-SF-13: owner live across iteration refresh (F-1)" test_owner_live_across_iteration_refresh
  run_test "TC-DT-SF-13b: --is-delivering live across refresh (F-1)" test_is_delivering_live_pid_across_iteration_refresh
  run_test "TC-DT-SF-13c: BSD etime parse (F-7)" test_parse_elapsed_to_seconds_bsd
  run_test "TC-DT-SF-13d: OWN captures true birth epoch (F-R2-1)" test_run_delivery_captures_true_birth_epoch
  run_test "TC-DT-SF-13e: owner live after slow setup (F-R2-1, slow)" test_owner_live_after_slow_setup

  # F-3: the three deferred integration behaviors (RUN_SLOW_TESTS)
  run_test "TC-DT-INT-02: concurrent converge → one PM (F-3, slow)" test_concurrent_converge_one_pm
  run_test "TC-DT-INT-03: SIGTERM propagates to child (F-3, slow)" test_signal_propagation_sigterm_to_child
  run_test "TC-DT-SF-14: session-traffic liveness handoff (F-3, slow)" test_session_traffic_liveness_handoff
  run_test "TC-HOOK-020: PM help settings/context contract" test_hook_help_contract
  run_test "TC-HOOK-005: PM dry-run excludes hook" test_hook_dry_run_exclusion
  run_test "TC-HOOK-005: PM public dry-run excludes hook" test_hook_dry_run_cli_exclusion
  run_test "TC-HOOK-007/007B/008: PM hook failures block" test_hook_failure_variants

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
