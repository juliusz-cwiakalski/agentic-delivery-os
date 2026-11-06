#!/usr/bin/env bash
# test-bash-suite-aggregation-modes.sh — GH-251 committed negative control.
#
# Proves end to end that a deliberately failing bash suite fails the same
# suite-aggregation runner the CI `bash-tests` job invokes (TC-CIPROP-008), and
# that the control itself fails whenever the runner could be made green on that
# suite (TC-CIPROP-009). Hermetic: synthetic trees live under mktemp, the real
# worktree is checked before/after, and no tracked file is mutated
# (TC-CIPROP-010). The synthetic root contains exactly one planted suite, so
# nesting is single-level and bounded (TC-CIPROP-011).
#
# Test seam (documented): RUNNER_PATH overrides the runner artifact under test;
# AGGREGATION_CONTROL_SINGLE=1 runs only the propagation assertion. Neither seam
# changes the production runner or the workflow.
#
# Dependencies: bash>=4, find, git, sha256sum, timeout, mktemp
# Exit codes:
#   0 - control passed (propagation demonstrated and counterfactuals enforced)
#   1 - control failed

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

readonly TAG="(bash-suite-aggregation-control)"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd -P)"
readonly REPO_ROOT
SELF="${SCRIPT_DIR}/$(basename -- "${BASH_SOURCE[0]}")"
readonly SELF
readonly DEFAULT_RUNNER="${REPO_ROOT}/scripts/run-bash-suites.sh"
readonly PLANTED_RELATIVE="./synthetic/.tests/test-planted-failure.sh"
# Kept split in source so the marker scan of committed test-* files cannot match
# this control file itself while still matching any leaked planted suite.
readonly PLANTED_MARKER="PLANTED-FAILURE""-MARKER-251"

WORK=""
CASE_TREE=""

cleanup() {
  if [[ -n "${CASE_TREE}" && -d "${CASE_TREE}" ]]; then rm -rf "${CASE_TREE}" 2>/dev/null || true; fi
  if [[ -n "${WORK}" && -d "${WORK}" ]]; then rm -rf "${WORK}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

log_info() { printf '[INFO]  %s %s\n' "${TAG}" "$*"; }
log_fail() { printf '[FAIL]  %s %s\n' "${TAG}" "$*" >&2; }

fail() {
  log_fail "$1"
  exit 1
}

# ---------------------------------------------------------------------------
# Single propagation check (child mode).
# ---------------------------------------------------------------------------
single_check() {
  local -r runner_path="${RUNNER_PATH:-${DEFAULT_RUNNER}}"
  [[ -f "${runner_path}" ]] || fail "runner under test does not exist: ${runner_path}"

  CASE_TREE="$(mktemp -d)"
  mkdir -p "${CASE_TREE}/synthetic/.tests"
  printf '#!/usr/bin/env bash\nprintf "%%s\\n" "%s"\nexit 9\n' "${PLANTED_MARKER}" \
    > "${CASE_TREE}/synthetic/.tests/test-planted-failure.sh"
  chmod +x "${CASE_TREE}/synthetic/.tests/test-planted-failure.sh"
  cp "${runner_path}" "${CASE_TREE}/run-bash-suites.sh"
  chmod +x "${CASE_TREE}/run-bash-suites.sh"

  local discovered=""
  discovered="$(
    cd "${CASE_TREE}"
    find . -path '*/.tests/test-*.sh' \
      -not -path './tmp/*' \
      -not -name '*e2e-providers*' \
      -not -name '*e2e-suite*' \
      -not -name '*performance*' \
      -print
  )"
  if [[ "${discovered}" != "${PLANTED_RELATIVE}" ]]; then
    log_fail "synthetic root discovered set is not exactly the planted suite: ${discovered}"
    exit 1
  fi

  local rc=0 log=""
  log="$( ( cd "${CASE_TREE}" && bash run-bash-suites.sh ) 2>&1 )" || rc=$?

  log_info "planted suite: ${PLANTED_RELATIVE} (marker ${PLANTED_MARKER})"
  log_info "observed runner exit: ${rc}"

  # A green runner is the counterfactual the control exists to catch: report it
  # before inspecting the log, so an always-zero stub fails with the meaningful
  # "propagation missing" verdict rather than an incidental log-shape complaint.
  if (( rc == 0 )); then
    log_fail "propagation missing: runner exited 0 on a deliberately failing suite"
    exit 1
  fi

  local executed
  executed="$(printf '%s\n' "${log}" | grep -cE '^\[(PASS|FAIL)\] ' || true)"
  if [[ "${executed}" != "1" ]]; then
    printf '%s\n' "${log}" >&2
    fail "nested run executed ${executed} suites (expected exactly 1)"
  fi
  if [[ "${log}" != *"[FAIL] ${PLANTED_RELATIVE}"* ]]; then
    printf '%s\n' "${log}" >&2
    fail "nested runner did not report the planted suite as failed"
  fi
  if [[ "${log}" == *"scripts/.tests/test-"* || "${log}" == *"tools/.tests/test-"* ]]; then
    fail "nested run saw real repository suites (recursion or scope leak)"
  fi

  printf '%s[PASS] propagation observed: a deliberately failing synthetic suite failed the runner (exit %s)\n' \
    "${TAG}" "${rc}"
  exit 0
}

# ---------------------------------------------------------------------------
# Parent orchestration: green path + counterfactuals + hermeticity.
# ---------------------------------------------------------------------------
run_child() {
  local -r runner_path="$1" log_path="$2"
  local rc=0
  (
    cd "${REPO_ROOT}"
    RUNNER_PATH="${runner_path}" AGGREGATION_CONTROL_SINGLE=1 \
      timeout 60 bash "${SELF}"
  ) >"${log_path}" 2>&1 || rc=$?
  return "${rc}"
}

make_stub() {
  local -r path="$1" body="$2"
  printf '#!/usr/bin/env bash\n%s\n' "${body}" > "${path}"
  chmod +x "${path}"
}

parent_check() {
  command -v git >/dev/null 2>&1 || fail "git is required"
  command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"
  command -v timeout >/dev/null 2>&1 || fail "timeout is required"
  [[ -x "${DEFAULT_RUNNER}" ]] || fail "real runner is missing or not executable: ${DEFAULT_RUNNER}"

  local pre_status pre_runner_sum pre_control_sum
  pre_status="$(git -C "${REPO_ROOT}" status --porcelain 2>/dev/null || true)"
  pre_runner_sum="$(sha256sum "${DEFAULT_RUNNER}" | awk '{print $1}')"
  pre_control_sum="$(sha256sum "${SELF}" | awk '{print $1}')"

  local started="${SECONDS}"
  WORK="$(mktemp -d)"

  local log="${WORK}/runner.log" rc=0
  rc=0
  run_child "${DEFAULT_RUNNER}" "${log}" || rc=$?
  if (( rc != 0 )); then
    tail -n 20 "${log}" >&2 || true
    fail "green path: control exited ${rc} against the real runner (expected 0)"
  fi
  local green
  green="$(cat "${log}")"
  [[ "${green}" == *"planted suite: ${PLANTED_RELATIVE}"* ]] \
    || fail "green path output does not name the planted suite"
  [[ "${green}" == *"observed runner exit:"* ]] \
    || fail "green path output does not report the observed runner exit"
  [[ "${green}" == *"[PASS] propagation observed"* ]] \
    || fail "green path output does not carry the [PASS] verdict"
  printf '%s[PASS] green path: propagation demonstrated and verdict printed\n' "${TAG}"

  local stub_zero="${WORK}/stub-zero-runner.sh"
  make_stub "${stub_zero}" 'exit 0'
  rc=0
  run_child "${stub_zero}" "${WORK}/stub-zero.log" || rc=$?
  if (( rc == 0 )); then
    fail "counterfactual: control passed against an always-zero runner"
  fi
  [[ "$(cat "${WORK}/stub-zero.log")" == *"propagation missing"* ]] \
    || fail "counterfactual: control did not explain the missing propagation"
  printf '%s[PASS] counterfactual: an always-zero runner makes the control fail\n' "${TAG}"

  local stub_selective="${WORK}/stub-selective-runner.sh"
  make_stub "${stub_selective}" \
    'if find . -path "*/.tests/test-planted-failure.sh" -print -quit | grep -q .; then exit 0; fi
exit 1'
  rc=0
  run_child "${stub_selective}" "${WORK}/stub-selective.log" || rc=$?
  if (( rc == 0 )); then
    fail "counterfactual: control passed against a runner that is green on the planted suite"
  fi
  printf '%s[PASS] counterfactual: a runner green on the planted suite makes the control fail\n' "${TAG}"

  rc=0
  run_child "${DEFAULT_RUNNER}" "${WORK}/restored.log" || rc=$?
  if (( rc != 0 )); then
    fail "counterfactual: control fails against the restored real runner (always-failing control)"
  fi
  printf '%s[PASS] counterfactual: the restored real runner makes the control pass\n' "${TAG}"

  local post_status post_runner_sum post_control_sum
  post_status="$(git -C "${REPO_ROOT}" status --porcelain 2>/dev/null || true)"
  post_runner_sum="$(sha256sum "${DEFAULT_RUNNER}" | awk '{print $1}')"
  post_control_sum="$(sha256sum "${SELF}" | awk '{print $1}')"
  [[ "${pre_status}" == "${post_status}" ]] || fail "control changed the real repository status"
  [[ "${pre_runner_sum}" == "${post_runner_sum}" ]] || fail "control mutated the runner"
  [[ "${pre_control_sum}" == "${post_control_sum}" ]] || fail "control mutated itself"

  local leaked=""
  while IFS= read -r -d '' leaked; do
    if grep -qF -- "${PLANTED_MARKER}" "${leaked}" 2>/dev/null; then
      fail "planted marker leaked into a committed/worktree test file: ${leaked}"
    fi
  done < <(
    find "${REPO_ROOT}" \
      \( -path '*/.git' -o -path '*/node_modules' -o -path '*/tmp' \) -prune \
      -o -name 'test-*' -type f -print0
  )
  printf '%s[PASS] hermetic: worktree status and checksums identical, no leaked marker\n' "${TAG}"

  local elapsed=$((SECONDS - started))
  if (( elapsed > 60 )); then
    fail "control wall time ${elapsed}s exceeds the 60s bound"
  fi
  printf '%s[PASS] bounded runtime: %ss (limit 60s)\n' "${TAG}" "${elapsed}"
  printf '%s[PASS] negative control passed\n' "${TAG}"
}

main() {
  if [[ "${AGGREGATION_CONTROL_SINGLE:-0}" == "1" ]]; then
    single_check
  fi
  parent_check
}

main "$@"
