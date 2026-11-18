#!/usr/bin/env bash
# test-engine-first-shell-parity.sh — TC-ENGINE-034 (GH-293 F-4, NFR-6, DEC-4)
#
# The cycle-safe parity claim the four delivered shell entry points make across
# the two authority states: stdout is byte-identical, both states exit 0, and the
# authoritative deprecation pointer is stderr-only and exactly one line.
#
# The matrix is four entry points x two authority states, run over each script's
# self-description path in an isolated temp checkout whose ROOT_DIR is the
# fixture, with an isolated HOME and a seeded per-repository authority document.
# Nothing outside the temp root is written.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

readonly TEST_TAG="(test-engine-first-shell-parity)"
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
  _make_checkout >/dev/null
}
_test_teardown() {
  [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]] && rm -rf "${_test_tmpdir}"
  _test_tmpdir=""
}
trap '_test_teardown' EXIT

run_test() {
  local -r name="$1"
  local -r func="$2"
  ((++_test_count))
  _test_setup
  if (set -e; "${func}"); then
    ((++_test_passed))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    ((++_test_failed))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi
  _test_teardown
}

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." >/dev/null 2>&1 && pwd -P)"
readonly ROOT_DIR
readonly REPOSITORY="github.com/owner/repo"
readonly PROJECT_KEY="fixture-repo-parity-0123abcd"
readonly ENTRY_POINTS=(
  "scripts/deliver-ticket.sh"
  "scripts/batch-deliver.sh"
  "scripts/pm-liveness.sh"
  "scripts/ceo-loop.sh"
)

# One hermetic checkout: the scripts are copied so their ROOT_DIR is the temp
# checkout, and its git common directory carries the identity marker the
# resolver reads.
_make_checkout() {
  local -r checkout="${_test_tmpdir}/checkout"
  mkdir -p "${checkout}/.git"
  cp -R "${ROOT_DIR}/scripts" "${checkout}/scripts"
  printf '{"schema":"delivery.projects.identity.v1","projectKey":"%s","projectIdentifier":"0123abcd000000000000000000000000","basename":"fixture-repo"}\n' \
    "${PROJECT_KEY}" >"${checkout}/.git/project-identity.json"
  printf '%s\n' "${checkout}"
}

_seed_authority() {
  local -r host_root="$1"
  local -r fixture="$2"
  local -r project_root="${host_root}/projects/${PROJECT_KEY}"
  mkdir -p "${project_root}/documents.workspace-a"
  cp "${ROOT_DIR}/tests/fixtures/dispatch/bash/${fixture}.json" \
    "${project_root}/documents.workspace-a/dispatch-authority.json"
}

# Run one cell and capture stdout/stderr separately; echoes the exit code.
_run_cell() {
  local -r script="$1"
  local -r state_root="$2"
  local -r stdout_file="$3"
  local -r stderr_file="$4"
  local -r checkout="${_test_tmpdir}/checkout"
  local -r home="${_test_tmpdir}/home"
  mkdir -p "${home}"
  local exit_code=0
  (
    HOME="${home}" ADOS_DISPATCH_STATE_ROOT="${state_root}" \
      DISPATCH_REPOSITORY="${REPOSITORY}" \
      bash "${checkout}/${script}" --help >"${stdout_file}" 2>"${stderr_file}"
  ) || exit_code=$?
  printf '%s\n' "${exit_code}"
}

test_stdout_is_byte_identical_across_authority_states() {
  local -r dual_root="${_test_tmpdir}/state-dual"
  local -r authoritative_root="${_test_tmpdir}/state-authoritative"
  _seed_authority "${dual_root}" "dual-run"
  _seed_authority "${authoritative_root}" "authoritative"
  for script in "${ENTRY_POINTS[@]}"; do
    local dual_out="${_test_tmpdir}/dual-$(basename "${script}").out"
    local dual_err="${_test_tmpdir}/dual-$(basename "${script}").err"
    local auth_out="${_test_tmpdir}/auth-$(basename "${script}").out"
    local auth_err="${_test_tmpdir}/auth-$(basename "${script}").err"
    [[ "$(_run_cell "${script}" "${dual_root}" "${dual_out}" "${dual_err}")" == "0" ]] || {
      printf '%s exited non-zero in dual-run\n' "${script}" >&2
      return 1
    }
    [[ "$(_run_cell "${script}" "${authoritative_root}" "${auth_out}" "${auth_err}")" == "0" ]] || {
      printf '%s exited non-zero when authoritative\n' "${script}" >&2
      return 1
    }
    cmp -s "${dual_out}" "${auth_out}" || {
      printf '%s stdout differs across authority states\n' "${script}" >&2
      return 1
    }
    grep -q '\[deprecation\]' "${dual_out}" && {
      printf '%s printed the pointer on stdout in dual-run\n' "${script}" >&2
      return 1
    }
    grep -q '\[deprecation\]' "${auth_out}" && {
      printf '%s printed the pointer on stdout when authoritative\n' "${script}" >&2
      return 1
    }
    grep -q 'engine-authoritative' "${auth_out}" && {
      printf '%s printed the authority marker on stdout\n' "${script}" >&2
      return 1
    }
    grep -q '\[deprecation\]' "${dual_err}" && {
      printf '%s printed a pointer in dual-run\n' "${script}" >&2
      return 1
    }
    local pointer_lines
    pointer_lines="$(grep -c '\[deprecation\]' "${auth_err}" || true)"
    [[ "${pointer_lines}" == "1" ]] || {
      printf '%s printed %s pointer lines when authoritative (expected 1)\n' \
        "${script}" "${pointer_lines}" >&2
      return 1
    }
    grep -q 'dispatch handover' "${auth_err}" || {
      printf '%s pointer names no reversal command\n' "${script}" >&2
      return 1
    }
    grep -q 'dispatch <ref>' "${auth_err}" || {
      printf '%s pointer names no forward command\n' "${script}" >&2
      return 1
    }
  done
}

test_entry_points_are_executable_and_the_suite_stays_in_its_temp_root() {
  for script in "${ENTRY_POINTS[@]}"; do
    [[ -x "${ROOT_DIR}/${script}" ]] || {
      printf '%s is not executable\n' "${script}" >&2
      return 1
    }
  done
  # Only the temp root was written: the checkout copy is byte-identical to the
  # delivered scripts and no file appeared beside them.
  local script
  while IFS= read -r script; do
    cmp -s "${ROOT_DIR}/${script}" "${_test_tmpdir}/checkout/${script}" || {
      printf '%s was modified by the suite\n' "${script}" >&2
      return 1
    }
  done < <(cd "${ROOT_DIR}" && find scripts -maxdepth 1 -name '*.sh' -print | sort)
  [[ -z "$(find "${_test_tmpdir}/checkout" -maxdepth 1 -name '*.tmp' -print -quit)" ]] || return 1
}

printf '%s running %s\n' "${TEST_TAG}" "${BASH_SOURCE[0]##*/}"
run_test "TC-ENGINE-034 stdout parity across authority states" \
  test_stdout_is_byte_identical_across_authority_states
run_test "TC-ENGINE-034 entry points executable and the suite is temp-root confined" \
  test_entry_points_are_executable_and_the_suite_stays_in_its_temp_root

printf '%s passed=%s failed=%s\n' "${TEST_TAG}" "${_test_passed}" "${_test_failed}"
[[ "${_test_failed}" -eq 0 ]]
