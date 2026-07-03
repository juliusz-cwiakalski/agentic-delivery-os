#!/usr/bin/env bash
# test-docs-mermaid-workflow.sh — TC-CI-003 structural validity of
# docs-mermaid-validate.yml (GH-110).
#
# Portable baseline = grep assertions (required-present + forbidden-absent).
# Enhancements self-adapt to tool availability: actionlint runs only if on PATH
# (skip-notice otherwise); YAML parse runs only if python3/yq is available. The
# test NEVER hard-fails solely because actionlint or a YAML tool is absent.
#
# Usage: bash scripts/.tests/test-docs-mermaid-workflow.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded, bash.md §11)
# ============================================================================
readonly TEST_TAG="(test-docs-mermaid-workflow)"
_test_count=0
_test_passed=0
_test_failed=0

if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m' _GREEN=$'\033[0;32m' _YELLOW=$'\033[0;33m' _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _YELLOW="" _RESET=""
fi

run_test() {
  local -r name="$1" func="$2"
  _test_count=$((_test_count + 1))
  if (set -e; "${func}"); then
    _test_passed=$((_test_passed + 1))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    _test_failed=$((_test_failed + 1))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    printf '  Missing required element.\n  Needle: %s\n' "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_not_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    printf '  Forbidden element present.\n  Needle: %s\n' "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

print_summary() {
  printf '\n%s Summary: %d/%d passed' "${TEST_TAG}" "${_test_passed}" "${_test_count}"
  if ((_test_failed > 0)); then
    printf ' (%s%d failed%s)\n' "${_RED}" "${_test_failed}" "${_RESET}"
    return 1
  fi
  printf ' %s(all passed)%s\n' "${_GREEN}" "${_RESET}"
  return 0
}

# ============================================================================
# PATHS
# ============================================================================
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly REPO_ROOT
readonly WF="${REPO_ROOT}/.github/workflows/docs-mermaid-validate.yml"

# ============================================================================
# TESTS
# ============================================================================

test_workflow_exists() {
  [[ -f "${WF}" ]]
}

# Required-present: trigger, paths filter, job name, runner, permissions, mmdc
# install, validator run.
test_required_elements_present() {
  local content
  content="$(<"${WF}")"
  assert_contains "${content}" "on:" "trigger block"
  assert_contains "${content}" "pull_request" "pull_request trigger"
  assert_contains "${content}" "paths:" "paths filter"
  assert_contains "${content}" "docs (mermaid validate)" "job display name"
  assert_contains "${content}" "runs-on: ubuntu-latest" "runner"
  assert_contains "${content}" "contents: read" "least-privilege permissions"
  assert_contains "${content}" "mermaid-cli" "mmdc install step"
  assert_contains "${content}" "validate-mermaid.sh" "validator run step"
}

# Forbidden-absent: no pull_request_target, no continue-on-error, no || true,
# no deploy step.
test_forbidden_elements_absent() {
  local active
  # Strip YAML/shell comment lines so only ACTIVE syntax is checked. The header
  # comment intentionally names these tokens by way of explanation; TC-CI-003
  # targets an active pull_request_target trigger / continue-on-error step, not
  # an explanatory comment.
  active="$(grep -Ev '^[[:space:]]*#' "${WF}")"
  assert_not_contains "${active}" "pull_request_target" "no secret-surface widening"
  assert_not_contains "${active}" "continue-on-error" "no soft-fail"
  assert_not_contains "${active}" "|| true" "no suppressed failures"
  assert_not_contains "${active}" "deploy" "no deploy step"
}

# actionlint when available (skip-notice otherwise; never hard-fail on absence).
test_actionlint_when_available() {
  if ! command -v actionlint >/dev/null 2>&1; then
    printf '%s[INFO]%s actionlint not on PATH — skipping (grep assertions are the baseline)\n' "${_YELLOW}" "${_RESET}"
    return 0
  fi
  actionlint "${WF}"
}

# YAML parse when a tool is available (skip-notice otherwise).
test_yaml_parses_when_available() {
  if command -v python3 >/dev/null 2>&1 && python3 -c 'import yaml' 2>/dev/null; then
    python3 -c 'import sys,yaml; yaml.safe_load(open(sys.argv[1]))' "${WF}"
    return 0
  fi
  if command -v yq >/dev/null 2>&1; then
    yq eval '.' "${WF}" >/dev/null
    return 0
  fi
  printf '%s[INFO]%s no YAML parser available — skipping YAML parse (grep assertions are the baseline)\n' "${_YELLOW}" "${_RESET}"
  return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"
  run_test "workflow file exists" test_workflow_exists
  run_test "required structural elements present" test_required_elements_present
  run_test "forbidden elements absent" test_forbidden_elements_absent
  run_test "actionlint (when available)" test_actionlint_when_available
  run_test "YAML parses (when parser available)" test_yaml_parses_when_available
  print_summary
}

main "$@"
