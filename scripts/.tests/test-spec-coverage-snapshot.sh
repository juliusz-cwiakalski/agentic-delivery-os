#!/usr/bin/env bash
# test-spec-coverage-snapshot.sh — Tests for spec-coverage-snapshot.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-spec-coverage-snapshot)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""
_assert_failed=0

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
  if [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]]; then
    rm -rf "${_test_tmpdir}"
  fi
  return 0
}

trap '_test_teardown' EXIT

run_test() {
  local -r name="$1"
  local -r func="$2"
  _test_count=$((_test_count + 1))

  _test_setup
  _assert_failed=0

  # NOTE: do NOT wrap func in a position whose status is tested (e.g. `if ( set -e; func )`
  # or `func || rc=$?`). Bash suspends errexit for commands whose status is tested, which
  # silently masks a failing assert that is not the function's last statement. Instead, each
  # assert sets the global `_assert_failed` flag; we report PASS iff no assert set it.
  "${func}" || true

  if [[ "${_assert_failed}" -eq 0 ]]; then
    _test_passed=$((_test_passed + 1))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    _test_failed=$((_test_failed + 1))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi

  _test_teardown
  _test_tmpdir=""
}

assert_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" != "${actual}" ]]; then
    _assert_failed=1
    printf '  Expected: %s\n  Actual:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    _assert_failed=1
    printf '  Haystack: %s\n  Needle:   %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_not_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    _assert_failed=1
    printf '  Haystack should not contain: %s\n  Needle: %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_ge() {
  local -r actual="$1" threshold="$2" msg="${3:-}"
  if (( actual < threshold )); then
    _assert_failed=1
    printf '  Expected >= %s\n  Actual:      %s\n' "${threshold}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST
# ============================================================================
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="$(cd "${TEST_DIR}/.." && pwd)"
SNAPSHOT_SCRIPT="${SCRIPT_DIR}/spec-coverage-snapshot.sh"
REPO_ROOT="$(cd "${TEST_DIR}/../.." && pwd)"
# shellcheck source=/dev/null
source "${SNAPSHOT_SCRIPT}"

# ============================================================================
# UNIT TESTS — counting functions on the real repo
# ============================================================================

test_feature_spec_count_nonzero_and_matches_direct_find() {
  local specs direct
  specs="$(count_feature_specs "${REPO_ROOT}")"
  direct="$(find "${REPO_ROOT}/doc/spec/features" -type f -name 'feature-*.md' 2>/dev/null | wc -l | tr -d ' ')"
  assert_ge "${specs}" 1 "feature-specs-present should be non-zero (16 expected on this repo)"
  assert_eq "${direct}" "${specs}" "count_feature_specs must match a direct find count"
}

test_change_folder_count_nonzero() {
  local changes
  changes="$(count_change_folders "${REPO_ROOT}")"
  assert_ge "${changes}" 1 "change-folders should be non-zero (there are existing change folders)"
}

test_change_folder_count_ignores_non_change_dirs() {
  # The basename filter must NOT count plain YYYY-MM month dirs (no '--REF--').
  # Build a synthetic tree with one month dir and one real change folder.
  local root="${_test_tmpdir}/repo"
  mkdir -p "${root}/doc/changes/2026-01/2026-01-01--GH-1--some-slug"
  mkdir -p "${root}/doc/changes/2026-01"          # plain month dir
  mkdir -p "${root}/doc/changes/2026-02/not-a-change"
  local changes
  changes="$(count_change_folders "${root}")"
  assert_eq "1" "${changes}" "only the *--<ref>--<slug> folder should count"
}

# ============================================================================
# INTEGRATION TESTS — run the script as a subprocess
# ============================================================================

test_kv_mode_exits_zero_and_emits_keys() {
  local out exit_code=0
  out="$(bash "${SNAPSHOT_SCRIPT}" --kv --root "${REPO_ROOT}" 2>&1)" || exit_code=$?
  assert_eq "0" "${exit_code}" "--kv must exit 0"
  assert_contains "${out}" "feature_specs_present=" "--kv output must include feature_specs_present key"
  assert_contains "${out}" "change_folders=" "--kv output must include change_folders key"
  assert_contains "${out}" "ratio=" "--kv output must include ratio key"
  # Non-zero, computable signal: both counts must be > 0 on the real repo.
  local specs changes
  specs="$(printf '%s' "${out}" | sed -n 's/.*feature_specs_present=\([0-9]\+\).*/\1/p')"
  changes="$(printf '%s' "${out}" | sed -n 's/.*change_folders=\([0-9]\+\).*/\1/p')"
  assert_ge "${specs}" 1 "feature_specs_present must be non-zero"
  assert_ge "${changes}" 1 "change_folders must be non-zero"
}

test_human_mode_emits_readable_keys() {
  local out exit_code=0
  out="$(bash "${SNAPSHOT_SCRIPT}" --root "${REPO_ROOT}" 2>&1)" || exit_code=$?
  assert_eq "0" "${exit_code}" "default mode must exit 0"
  assert_contains "${out}" "feature-specs-present:" "human output must include feature-specs-present key"
  assert_contains "${out}" "change-folders:" "human output must include change-folders key"
  assert_contains "${out}" "ratio (specs/changes):" "human output must include ratio key"
}

test_help_and_version_flags() {
  local out exit_code=0
  out="$(bash "${SNAPSHOT_SCRIPT}" --help 2>&1)" || exit_code=$?
  assert_eq "0" "${exit_code}" "--help must exit 0"
  assert_contains "${out}" "Usage:" "--help must show usage"

  exit_code=0
  out="$(bash "${SNAPSHOT_SCRIPT}" --version 2>&1)" || exit_code=$?
  assert_eq "0" "${exit_code}" "--version must exit 0"
  assert_contains "${out}" "${APP_NAME}" "--version must show app name"
}

# ============================================================================
# SYNTHETIC FIXTURE — computable signal from a minimal tree
# ============================================================================

test_synthetic_fixture_computable() {
  local root="${_test_tmpdir}/synth"
  mkdir -p "${root}/doc/spec/features"
  mkdir -p "${root}/doc/changes/2026-03/2026-03-01--GH-42--an-area"
  printf -- '---\nid: SPEC-X\nstatus: Current\n---\n# Feature X\n' > "${root}/doc/spec/features/feature-x.md"

  local specs changes ratio out exit_code=0
  specs="$(count_feature_specs "${root}")"
  changes="$(count_change_folders "${root}")"
  ratio="$(compute_ratio "${specs}" "${changes}")"

  assert_eq "1" "${specs}" "synthetic tree has 1 feature spec"
  assert_eq "1" "${changes}" "synthetic tree has 1 change folder"
  assert_eq "1.00" "${ratio}" "ratio of 1 spec / 1 change is 1.00 (not n/a)"

  # End-to-end via --root
  out="$(bash "${SNAPSHOT_SCRIPT}" --kv --root "${root}" 2>&1)" || exit_code=$?
  assert_eq "0" "${exit_code}" "synthetic --kv must exit 0"
  assert_contains "${out}" "feature_specs_present=1" "synthetic kv shows 1 spec"
  assert_not_contains "${out}" "ratio=n/a" "ratio must be computed when changes>0"
}

test_synthetic_fixture_no_changes_ratio_na() {
  local root="${_test_tmpdir}/empty-changes"
  mkdir -p "${root}/doc/spec/features"
  printf -- '---\n---\n# F\n' > "${root}/doc/spec/features/feature-y.md"
  # No doc/changes at all
  local specs changes ratio
  specs="$(count_feature_specs "${root}")"
  changes="$(count_change_folders "${root}")"
  ratio="$(compute_ratio "${specs}" "${changes}")"
  assert_eq "0" "${changes}" "no change folders in empty fixture"
  assert_eq "n/a" "${ratio}" "ratio is n/a when there are no changes"
}

# ============================================================================
# STATIC — no network dependency (stdlib only)
# ============================================================================

test_no_network_dependency() {
  local content
  content="$(cat "${SNAPSHOT_SCRIPT}")"
  # Network primitives / fetchers must be absent.
  assert_not_contains "${content}" "curl " "script must not call curl"
  assert_not_contains "${content}" "wget " "script must not call wget"
  assert_not_contains "${content}" "ssh " "script must not call ssh"
  assert_not_contains "${content}" "scp " "script must not call scp"
  assert_not_contains "${content}" "ftp " "script must not call ftp"
  assert_not_contains "${content}" "nc " "script must not call nc"
  assert_not_contains "${content}" "ncat " "script must not call ncat"
  assert_not_contains "${content}" "socat " "script must not call socat"
  assert_not_contains "${content}" "/dev/tcp/" "script must not use /dev/tcp"
  assert_not_contains "${content}" "/dev/udp/" "script must not use /dev/udp"
  assert_not_contains "${content}" "telnet " "script must not call telnet"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  run_test "feature-spec count non-zero and matches direct find" test_feature_spec_count_nonzero_and_matches_direct_find
  run_test "change-folder count non-zero" test_change_folder_count_nonzero
  run_test "change-folder count ignores non-change dirs" test_change_folder_count_ignores_non_change_dirs
  run_test "--kv mode exits 0 and emits keys" test_kv_mode_exits_zero_and_emits_keys
  run_test "human mode emits readable keys" test_human_mode_emits_readable_keys
  run_test "--help and --version flags" test_help_and_version_flags
  run_test "synthetic fixture is computable (ratio=1.00)" test_synthetic_fixture_computable
  run_test "synthetic fixture with no changes -> ratio n/a" test_synthetic_fixture_no_changes_ratio_na
  run_test "no network dependency (stdlib only)" test_no_network_dependency

  print_summary
}

# Print test summary (defined here to keep framework cohesive near run loop)
print_summary() {
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
