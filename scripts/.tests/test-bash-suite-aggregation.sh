#!/usr/bin/env bash
# test-bash-suite-aggregation.sh — GH-251 runner contract suite.
#
# Exercises scripts/run-bash-suites.sh against synthetic trees (TC-CIPROP-001..007)
# and, once the workflow is wired, asserts the bash-tests job invokes the runner
# (TC-CIPROP-012). The runner is copied into each synthetic tree root so the suite
# exercises the same CWD-rooted contract CI uses (GAP-3 copied-tree seam).
#
# Dependencies: bash>=4, find, diff, mktemp
# Exit codes:
#   0 - all cases passed
#   1 - at least one case failed

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

readonly TAG="(bash-suite-aggregation)"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd -P)"
readonly REPO_ROOT
readonly RUNNER="${REPO_ROOT}/scripts/run-bash-suites.sh"

_passed=0
_failed=0
TREE=""

cleanup() {
  if [[ -n "${TREE}" && -d "${TREE}" ]]; then rm -rf "${TREE}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

pass() { printf '[PASS] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; return 1; }

assert_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" != "${actual}" ]]; then
    printf '  expected: %s\n  actual:   %s\n  message:  %s\n' "${expected}" "${actual}" "${msg}" >&2
    return 1
  fi
}

assert_ne() {
  local -r unexpected="$1" actual="$2" msg="${3:-}"
  if [[ "${unexpected}" == "${actual}" ]]; then
    printf '  unexpected: %s\n  message:    %s\n' "${unexpected}" "${msg}" >&2
    return 1
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    printf '  haystack: %s\n  needle:   %s\n  message:  %s\n' "${haystack}" "${needle}" "${msg}" >&2
    return 1
  fi
}

assert_not_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    printf '  haystack should not contain: %s\n  message: %s\n' "${needle}" "${msg}" >&2
    return 1
  fi
}

assert_file_exists() {
  local -r path="$1"
  if [[ ! -f "${path}" ]]; then
    printf '  missing file: %s\n' "${path}" >&2
    return 1
  fi
}

make_suite() {
  local -r path="$1" body="$2"
  mkdir -p "$(dirname -- "${path}")"
  printf '#!/usr/bin/env bash\n%s\n' "${body}" > "${path}"
  chmod +x "${path}"
}

run_runner_in() {
  local -r tree="$1"
  cp "${RUNNER}" "${tree}/run-bash-suites.sh"
  chmod +x "${tree}/run-bash-suites.sh"
  ( cd "${tree}" && bash run-bash-suites.sh )
}

extract_suites() {
  grep -E '^\[(PASS|FAIL)\] ' "$1" | sed -E 's/^\[(PASS|FAIL)\] //'
}

run_case() {
  local -r name="$1" func="$2"
  if ( set -Eeuo pipefail; TREE="$(mktemp -d)"; trap cleanup EXIT; "${func}" ); then
    _passed=$((_passed + 1))
    pass "${name}"
  else
    _failed=$((_failed + 1))
    printf '[FAIL] %s\n' "${name}" >&2
  fi
}

# ---------------------------------------------------------------------------
# TC-CIPROP-001 — all-passing set exits zero and names every suite.
# ---------------------------------------------------------------------------
tc_001_all_passing() {
  mkdir -p "${TREE}/a/.tests" "${TREE}/b/.tests"
  make_suite "${TREE}/a/.tests/test-one.sh" 'exit 0'
  make_suite "${TREE}/b/.tests/test-two.sh" 'exit 0'

  local rc=0 out=""
  out="$(run_runner_in "${TREE}" 2>&1)" || rc=$?
  assert_eq 0 "${rc}" "all-passing set must exit 0"
  assert_contains "${out}" '[PASS] ./a/.tests/test-one.sh' "first suite named"
  assert_contains "${out}" '[PASS] ./b/.tests/test-two.sh' "second suite named"
  assert_contains "${out}" 'discovered 2 suites' "summary count"
  assert_contains "${out}" '2 passed; 0 failed' "aggregate summary"
}

# ---------------------------------------------------------------------------
# TC-CIPROP-002 — one failing suite between passing ones fails the runner.
# ---------------------------------------------------------------------------
tc_002_one_failure() {
  mkdir -p "${TREE}/a/.tests" "${TREE}/b/.tests" "${TREE}/c/.tests"
  make_suite "${TREE}/a/.tests/test-a.sh" 'exit 0'
  make_suite "${TREE}/b/.tests/test-b.sh" 'exit 7'
  make_suite "${TREE}/c/.tests/test-c.sh" 'exit 0'

  local rc=0 out=""
  out="$(run_runner_in "${TREE}" 2>&1)" || rc=$?
  assert_ne 0 "${rc}" "a failing suite must fail the runner"
  assert_contains "${out}" '[FAIL] ./b/.tests/test-b.sh' "failing suite named"
  assert_contains "${out}" '[PASS] ./a/.tests/test-a.sh' "preceding suite still passing"
  assert_contains "${out}" '[PASS] ./c/.tests/test-c.sh' "following suite still executed"
  assert_not_contains "${out}" 'skipped' "a failure is not a skip"
}

# ---------------------------------------------------------------------------
# TC-CIPROP-003 — multiple failing suites are all named and aggregated.
# ---------------------------------------------------------------------------
tc_003_multiple_failures() {
  mkdir -p "${TREE}/a/.tests" "${TREE}/b/.tests" "${TREE}/c/.tests"
  make_suite "${TREE}/a/.tests/test-first-fail.sh" 'exit 1'
  make_suite "${TREE}/b/.tests/test-pass.sh" 'exit 0'
  make_suite "${TREE}/c/.tests/test-second-fail.sh" 'printf "assertion failed\n" >&2; exit 1'

  local rc=0 out=""
  out="$(run_runner_in "${TREE}" 2>&1)" || rc=$?
  assert_ne 0 "${rc}" "two failures must fail the runner"
  assert_contains "${out}" '[FAIL] ./a/.tests/test-first-fail.sh' "first failure named"
  assert_contains "${out}" '[FAIL] ./c/.tests/test-second-fail.sh' "second failure named"
  assert_contains "${out}" '[PASS] ./b/.tests/test-pass.sh' "passing suite reported passing"
  assert_contains "${out}" '2 failed' "aggregate failure count"
}

# ---------------------------------------------------------------------------
# TC-CIPROP-004 — every discovered suite runs exactly once even after a failure.
# ---------------------------------------------------------------------------
tc_004_exactly_once() {
  local variant root
  for variant in failure-first failure-last; do
    root="${TREE}/${variant}"
    mkdir -p "${root}/counts" "${root}/a/.tests" "${root}/b/.tests" "${root}/c/.tests"
    local failing="b"
    if [[ "${variant}" == "failure-last" ]]; then failing="c"; fi
    local name
    for name in a b c; do
      local code='exit 0'
      if [[ "${name}" == "${failing}" ]]; then code='exit 1'; fi
      make_suite "${root}/${name}/.tests/test-${name}.sh" \
        "printf 'run\\n' >> counts/test-${name}.txt; ${code}"
    done

    local rc=0
    run_runner_in "${root}" >"${TREE}/${variant}.log" 2>&1 || rc=$?
    assert_ne 0 "${rc}" "${variant}: runner must fail"
    for name in a b c; do
      local lines
      lines="$(wc -l < "${root}/counts/test-${name}.txt")"
      assert_eq 1 "${lines}" "${variant}: test-${name}.sh executed exactly once"
    done
  done
}

# ---------------------------------------------------------------------------
# TC-CIPROP-005 — discovery scope matches today's find expression.
# ---------------------------------------------------------------------------
tc_005_discovery_parity() {
  mkdir -p "${TREE}/a/.tests" "${TREE}/scripts/.tests" "${TREE}/tools/.tests"
  mkdir -p "${TREE}/tmp/.tests" "${TREE}/x/.tests"
  local path
  for path in \
    "${TREE}/a/.tests/test-one.sh" \
    "${TREE}/scripts/.tests/test-two.sh" \
    "${TREE}/tools/.tests/test-three.sh" \
    "${TREE}/tmp/.tests/test-excluded.sh" \
    "${TREE}/x/.tests/test-e2e-providers.sh" \
    "${TREE}/x/.tests/test-e2e-suite.sh" \
    "${TREE}/x/.tests/test-performance.sh" \
    "${TREE}/x/.tests/helper.sh" \
    "${TREE}/x/.tests/test-other.sh.bak"; do
    make_suite "${path}" 'exit 0'
  done

  (
    cd "${TREE}"
    find . -path '*/.tests/test-*.sh' \
      -not -path './tmp/*' \
      -not -name '*e2e-providers*' \
      -not -name '*e2e-suite*' \
      -not -name '*performance*' \
      -print
  ) | sort > "${TREE}/expected.txt"

  local rc=0
  run_runner_in "${TREE}" >"${TREE}/run1.log" 2>&1 || rc=$?
  assert_eq 0 "${rc}" "fixture tree must be green"
  run_runner_in "${TREE}" >"${TREE}/run2.log" 2>&1 || rc=$?

  extract_suites "${TREE}/run1.log" | sort > "${TREE}/actual.txt"
  diff -u "${TREE}/expected.txt" "${TREE}/actual.txt" >/dev/null \
    || fail "discovered set differs from today's find expression"
  extract_suites "${TREE}/run1.log" > "${TREE}/order1.txt"
  extract_suites "${TREE}/run2.log" > "${TREE}/order2.txt"
  diff -u "${TREE}/order1.txt" "${TREE}/order2.txt" >/dev/null \
    || fail "discovery order is not deterministic across two runs"

  local excluded
  for excluded in \
    './tmp/.tests/test-excluded.sh' \
    './x/.tests/test-e2e-providers.sh' \
    './x/.tests/test-e2e-suite.sh' \
    './x/.tests/test-performance.sh' \
    './x/.tests/helper.sh' \
    './x/.tests/test-other.sh.bak'; do
    assert_not_contains "$(cat "${TREE}/run1.log")" "${excluded}" "excluded ${excluded}"
  done
}

# ---------------------------------------------------------------------------
# TC-CIPROP-006 — a suite that cannot be executed counts as a failure.
# ---------------------------------------------------------------------------
tc_006_unrunnable() {
  mkdir -p "${TREE}/x/.tests" "${TREE}/y/.tests" "${TREE}/z/.tests"
  ln -s "${TREE}/missing-target.sh" "${TREE}/x/.tests/test-unrunnable.sh"
  make_suite "${TREE}/y/.tests/test-syntax-error.sh" 'if then'
  make_suite "${TREE}/z/.tests/test-pass.sh" 'exit 0'

  local rc=0 out=""
  out="$(run_runner_in "${TREE}" 2>&1)" || rc=$?
  assert_ne 0 "${rc}" "unrunnable suite must fail the runner"
  assert_contains "${out}" '[FAIL] ./x/.tests/test-unrunnable.sh' "dangling symlink reported failed"
  assert_contains "${out}" '[FAIL] ./y/.tests/test-syntax-error.sh' "failing interpreter reported failed"
  assert_contains "${out}" '[PASS] ./z/.tests/test-pass.sh' "passing suite still passing"
}

# ---------------------------------------------------------------------------
# TC-CIPROP-007 — zero discovered suites exits zero with an explicit summary.
# ---------------------------------------------------------------------------
tc_007_zero_suites() {
  local rc=0 out=""
  out="$(run_runner_in "${TREE}" 2>&1)" || rc=$?
  assert_eq 0 "${rc}" "zero suites is success under DM-2"
  assert_contains "${out}" 'discovered 0 suites' "explicit zero-suite summary"
  assert_not_contains "${out}" '[PASS]' "no fabricated pass list"
}

# ---------------------------------------------------------------------------
# TC-CIPROP-012 — the bash-tests job invokes the runner and states the real
# contract. Static tree assertion only; never a diff against a base branch.
# ---------------------------------------------------------------------------
job_block() {
  local -r text="$1" job="$2"
  printf '%s\n' "${text}" | awk -v job="${job}" '
    $0 == "  " job ":" { inside = 1; print; next }
    inside && /^  [a-z0-9-]+:[[:space:]]*$/ { inside = 0 }
    inside { print }
  '
}

tc_012_workflow_wiring() {
  local workflow block
  workflow="$(cat "${REPO_ROOT}/.github/workflows/ci.yml")"
  block="$(job_block "${workflow}" "bash-tests")"
  [[ -n "${block}" ]] || fail "bash-tests job not found in ci.yml"

  assert_contains "${block}" 'bash scripts/run-bash-suites.sh' \
    "bash-tests must invoke the runner by path"
  assert_file_exists "${RUNNER}"
  [[ -x "${RUNNER}" ]] || fail "runner is not executable: ${RUNNER}"
  assert_not_contains "${workflow}" '-exec bash' \
    "workflow must not execute suites through find -exec"
  assert_contains "${block}" 'aggregates' "job comment states child-status aggregation"
  assert_contains "${block}" 'runner' "job comment names the runner"
  assert_not_contains "${block}" 'set -e fails the job' \
    "job comment must not claim set -e alone fails the job"
  assert_not_contains "${block}" 'first failing suite' \
    "job comment must not claim fail-fast on the first failing suite"

  local exclusion
  for exclusion in "./tmp/*" '*e2e-providers*' '*e2e-suite*' '*performance*'; do
    assert_contains "$(cat "${RUNNER}")" "${exclusion}" \
      "runner keeps the CI-safe exclusion ${exclusion}"
  done
}

main() {
  [[ -x "${RUNNER}" ]] || { fail "runner is missing or not executable: ${RUNNER}"; exit 1; }
  printf '[INFO] %s runner contract suite\n' "${TAG}"
  run_case "TC-CIPROP-001 all-passing set exits zero and names every suite" tc_001_all_passing
  run_case "TC-CIPROP-002 one failing suite fails the runner and is named" tc_002_one_failure
  run_case "TC-CIPROP-003 multiple failing suites are all named" tc_003_multiple_failures
  run_case "TC-CIPROP-004 every suite runs exactly once after a failure" tc_004_exactly_once
  run_case "TC-CIPROP-005 discovery matches today's find expression" tc_005_discovery_parity
  run_case "TC-CIPROP-006 an unrunnable suite counts as a failure" tc_006_unrunnable
  run_case "TC-CIPROP-007 zero suites exits zero" tc_007_zero_suites
  run_case "TC-CIPROP-012 bash-tests invokes the runner and states the contract" \
    tc_012_workflow_wiring

  printf '\n[SUMMARY] %s %d passed, %d failed\n' "${TAG}" "${_passed}" "${_failed}"
  (( _failed == 0 ))
}

main "$@"
