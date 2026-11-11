#!/usr/bin/env bash
# test-lint-commit-range.sh — Tests for scripts/lint-commit-range.sh
#
# Covers the gate's verdict parity, per-commit diagnostics, remediation modes,
# base/binary resolution precedence, the terminal-condition exit contract,
# read-only and no-network behaviour, and the runtime budget (TC-COMMITLINT-001
# through TC-COMMITLINT-021). Fixtures are real temporary git repositories; the
# lint tool is the repository's pinned commitlint binary.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-lint-commit-range)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""
# Per-test failure flag. Asserts set this so a failing assertion is never masked
# by a later success: running the test as an `if` condition disables errexit for
# the whole subshell, so a bare `set -e` harness silently ignores failures.
_current_test_failed=0

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
  _test_count=$((_test_count + 1))

  _test_setup
  _current_test_failed=0

  local rc=0
  set +e
  "${func}"
  rc=$?
  set -e

  if [[ "${_current_test_failed}" -ne 0 || "${rc}" -ne 0 ]]; then
    _test_failed=$((_test_failed + 1))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  else
    _test_passed=$((_test_passed + 1))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  fi

  _test_teardown
}

assert_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" != "${actual}" ]]; then
    printf '  Expected: %s\n  Actual:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

assert_ne() {
  local -r unexpected="$1" actual="$2" msg="${3:-}"
  if [[ "${unexpected}" == "${actual}" ]]; then
    printf '  Unexpected: %s\n' "${unexpected}" >&2
    [[ -n "${msg}" ]] && printf '  Message:    %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    printf '  Haystack: %s\n  Needle:   %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

assert_not_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    printf '  Should not contain: %s\n  In: %s\n' "${needle}" "${haystack}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

assert_matches() {
  local -r pattern="$1" text="$2" msg="${3:-}"
  if ! printf '%s\n' "${text}" | grep -qE "${pattern}"; then
    printf '  Pattern: %s\n  Text:    %s\n' "${pattern}" "${text}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

assert_not_matches() {
  local -r pattern="$1" text="$2" msg="${3:-}"
  if printf '%s\n' "${text}" | grep -qE "${pattern}"; then
    printf '  Should not match: %s\n  Text: %s\n' "${pattern}" "${text}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

assert_exit_code() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" -ne "${actual}" ]]; then
    printf '  Expected exit code: %s\n  Actual exit code:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

print_summary() {
  printf '\n%s Summary: %d/%d passed' "${TEST_TAG}" "${_test_passed}" "${_test_count}"
  if [[ "${_test_failed}" -gt 0 ]]; then
    printf ' (%s%d failed%s)\n' "${_RED}" "${_test_failed}" "${_RESET}"
    _current_test_failed=1
    return 1
  fi
  printf ' %s(all passed)%s\n' "${_GREEN}" "${_RESET}"
}

# ============================================================================
# PATHS AND FIXTURE HELPERS
# ============================================================================
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
GATE="${REPO_ROOT}/scripts/lint-commit-range.sh"
FIXTURES="${REPO_ROOT}/scripts/.tests/fixtures/lint-commit-range"
HOST_COMMITLINT="${REPO_ROOT}/node_modules/.bin/commitlint"

# The suite fails loudly when the pinned binary is missing; there is no silent
# skip (TR-3: fail closed, like the gate's own DM-1.g posture).
_require_host_binary() {
  if [[ ! -x "${HOST_COMMITLINT}" ]]; then
    printf '%s[FAIL] %s the repository-local commitlint is missing; run `pnpm install`\n' \
      "${_RED}" "${TEST_TAG}" >&2
    return 1
  fi
}

# Create a fixture repository with deterministic, hook-free git settings.
_new_repo() {
  local -r name="$1"
  local -r repo="${_test_tmpdir}/${name}"
  git init -q -b main "${repo}"
  git -C "${repo}" config user.email "test@example.invalid"
  git -C "${repo}" config user.name "Fixture Bot"
  git -C "${repo}" config commit.gpgsign false
  git -C "${repo}" config core.hooksPath /dev/null
  printf '%s' "${repo}"
}

# Add the recognized commitlint configuration to a fixture.
_add_config() {
  local -r repo="$1"
  cp "${FIXTURES}/commitlint.config.valid.txt" "${repo}/commitlint.config.js"
}

# Seed the base branch with one conventional commit.
_seed_main() {
  local -r repo="$1"
  printf 'seed\n' >"${repo}/seed.txt"
  git -C "${repo}" add -A
  git -C "${repo}" commit -q -m "chore(GH-268): seed the fixture branch"
}

# Standard configured fixture: valid config plus a seeded main.
_configured_repo() {
  local -r name="$1"
  _require_host_binary
  local repo
  repo="$(_new_repo "${name}")"
  _add_config "${repo}"
  _seed_main "${repo}"
  printf '%s' "${repo}"
}

_branch_from_main() {
  local -r repo="$1" branch="$2"
  git -C "${repo}" checkout -q -b "${branch}" main
}

_commit_msg() {
  local -r repo="$1" message_file="$2"
  git -C "${repo}" commit -q --allow-empty -F "${message_file}"
}

_commit_file() {
  local -r repo="$1" filename="$2" content="$3" message="$4"
  printf '%s\n' "${content}" >"${repo}/${filename}"
  git -C "${repo}" add -A
  git -C "${repo}" commit -q -m "${message}"
}

# Install the fixture-local lint binary as an EXEC WRAPPER (never a symlink or a
# copy): the repository shim resolves its CLI relative to its invoked path, so a
# link/copy fails with MODULE_NOT_FOUND and would be classified DM-1.h.
_install_local_commitlint() {
  local -r repo="$1"
  _require_host_binary
  mkdir -p "${repo}/node_modules/.bin"
  printf '#!/bin/sh\nexec "%s" "$@"\n' "${HOST_COMMITLINT}" >"${repo}/node_modules/.bin/commitlint"
  chmod +x "${repo}/node_modules/.bin/commitlint"
}

# The same wrapper form outside the fixture repository, so the origin is PATH.
_install_outer_commitlint() {
  local -r dir="$1"
  _require_host_binary
  mkdir -p "${dir}"
  printf '#!/bin/sh\nexec "%s" "$@"\n' "${HOST_COMMITLINT}" >"${dir}/commitlint"
  chmod +x "${dir}/commitlint"
}

# A malformed commit that breaks body, footer, subject, and type rules at once.
_write_multi_violation_message() {
  local -r path="$1"
  {
    printf 'wip stuff\n\n'
    printf '%0140d\n\n' 0 | tr '0' 'W'
    printf 'Refs: '
    printf '%0125d\n' 0 | tr '0' 'F'
  } >"${path}"
}

# ============================================================================
# GATE INVOCATION HELPERS
# ============================================================================
GATE_EXIT=0
GATE_OUT=""
GATE_ERR=""

_run_gate() {
  local -r repo="$1"
  shift
  local so se
  so="$(mktemp)"
  se="$(mktemp)"
  GATE_EXIT=0
  (cd "${repo}" && "${GATE}" "$@") >"${so}" 2>"${se}" || GATE_EXIT=$?
  GATE_OUT="$(cat "${so}")"
  GATE_ERR="$(cat "${se}")"
  rm -f "${so}" "${se}"
}

_run_gate_with_path() {
  local -r repo="$1" run_path="$2"
  shift 2
  local so se
  so="$(mktemp)"
  se="$(mktemp)"
  GATE_EXIT=0
  (cd "${repo}" && PATH="${run_path}" "${GATE}" "$@") >"${so}" 2>"${se}" || GATE_EXIT=$?
  GATE_OUT="$(cat "${so}")"
  GATE_ERR="$(cat "${se}")"
  rm -f "${so}" "${se}"
}

# Header field accessor (single-line header pinned by the gate's contract).
_header_field() {
  local -r field="$1"
  printf '%s\n' "${GATE_OUT}" | sed -n '1s/.*[[:space:]]'"${field}"'=\([^[:space:]]*\).*/\1/p'
}

# One digest over working tree, index, refs, stash, and HEAD.
_repo_digest() {
  local -r repo="$1"
  {
    git -C "${repo}" status --porcelain=v1
    git -C "${repo}" for-each-ref --format='%(refname) %(objectname)' | LC_ALL=C sort
    git -C "${repo}" ls-files -s
    git -C "${repo}" stash list
    git -C "${repo}" rev-parse HEAD
  } | sha256sum | cut -d' ' -f1
}

_repo_file_listing() {
  local -r repo="$1"
  (cd "${repo}" && find . -path ./.git -prune -o -type f -print | LC_ALL=C sort)
}

# ============================================================================
# TC-COMMITLINT-001 .. 006 — verdicts and parity
# ============================================================================

# TC-COMMITLINT-001: malformed commit in range fails with attribution
test_bad_body_commit_fails() {
  local repo
  repo="$(_configured_repo fx-bad-body)"
  _branch_from_main "${repo}" "feat/GH-268/fixture"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${repo}"

  local short full
  short="$(git -C "${repo}" rev-parse --short HEAD)"
  full="$(git -C "${repo}" rev-parse HEAD)"

  _run_gate "${repo}" --base main

  assert_exit_code 1 "${GATE_EXIT}" "A malformed commit must fail the gate"
  assert_contains "${GATE_OUT}" "${short}" "Short SHA must appear"
  assert_contains "${GATE_OUT}" "${full}" "Full SHA must appear in the same report"
  assert_contains "${GATE_OUT}" "body-max-line-length" "The violated rule id must appear"
  assert_not_contains "${GATE_OUT}" "ERROR" "A violation is FAIL, never ERROR"
  assert_contains "${GATE_OUT}" "SURGICAL REWORD" "One offender selects surgical reword"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS" "No silent pass"
}

# TC-COMMITLINT-002: clean conventional range passes
test_clean_range_passes() {
  local repo
  repo="$(_configured_repo fx-clean)"
  _branch_from_main "${repo}" "feat/GH-268/clean"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  _run_gate "${repo}" --base main

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "VERDICT: PASS"
  assert_contains "${GATE_OUT}" "2 commit(s) in range"
  assert_not_contains "${GATE_OUT}" "body-max-line-length"
  assert_not_contains "${GATE_OUT}" "VERDICT: FAIL"
  assert_not_contains "${GATE_ERR}" "VERDICT: FAIL"
}

# TC-COMMITLINT-003: conventional-subject merge commit does not fail
test_conventional_merge_commit_passes() {
  local repo
  repo="$(_configured_repo fx-merge-conv)"
  _branch_from_main "${repo}" "feat/GH-268/merge-conv"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"

  git -C "${repo}" checkout -q main
  _commit_file "${repo}" "advance.txt" "advance" "chore(GH-268): advance main"
  git -C "${repo}" checkout -q "feat/GH-268/merge-conv"
  git -C "${repo}" merge -q --no-ff -m "chore(GH-268): sync with main" main
  _install_local_commitlint "${repo}"

  local merges
  merges="$(git -C "${repo}" rev-list --merges main..HEAD)"
  [[ -n "${merges}" ]] || {
    printf '  Precondition failed: fixture has no merge commit\n' >&2
    return 1
  }

  _run_gate "${repo}" --base main

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "VERDICT: PASS"
}

# TC-COMMITLINT-004: plain merge subject passes (configuration parity)
test_plain_merge_subject_passes() {
  local repo
  repo="$(_configured_repo fx-merge-plain)"
  _branch_from_main "${repo}" "feat/GH-268/merge-plain"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"

  git -C "${repo}" checkout -q main
  _commit_file "${repo}" "advance.txt" "advance" "chore(GH-268): advance main"
  git -C "${repo}" checkout -q "feat/GH-268/merge-plain"
  git -C "${repo}" merge -q --no-ff main
  _install_local_commitlint "${repo}"

  local subject
  subject="$(git -C "${repo}" log -1 --format=%s)"
  assert_matches '^Merge ' "${subject}" "Precondition: the merge subject is a plain merge"

  _run_gate "${repo}" --base main

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "VERDICT: PASS"

  # Parity oracle: the committed configuration reaches the same verdict.
  local merge_base audit=0
  merge_base="$(git -C "${repo}" merge-base main HEAD)"
  (cd "${repo}" && "${HOST_COMMITLINT}" --from "${merge_base}" --to HEAD --verbose --color=false) || audit=$?
  assert_exit_code 0 "${audit}" "The authority's range invocation must agree"
}

# TC-COMMITLINT-005: merged-upstream offenders outside the range do not fail
test_upstream_history_outside_range_ignored() {
  local repo
  repo="$(_configured_repo fx-upstream-dirty)"
  _branch_from_main "${repo}" "feat/GH-268/upstream"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"

  git -C "${repo}" checkout -q main
  _commit_msg "${repo}" "${FIXTURES}/msg-wip.txt"
  local bad_sha
  bad_sha="$(git -C "${repo}" rev-parse HEAD)"
  # Advance main again so the offending commit is an ancestor inside the
  # upstream history, not the range start the header legitimately names.
  _commit_file "${repo}" "advance.txt" "advance" "chore(GH-268): advance main"
  git -C "${repo}" checkout -q "feat/GH-268/upstream"
  git -C "${repo}" merge -q --no-ff -m "chore(GH-268): sync with main" main
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  git -C "${repo}" merge-base --is-ancestor "${bad_sha}" HEAD || {
    printf '  Precondition failed: the bad upstream commit is not an ancestor\n' >&2
    return 1
  }

  _run_gate "${repo}" --base main

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "VERDICT: PASS"
  assert_not_contains "${GATE_OUT}" "${bad_sha}"

  local expected_count
  expected_count="$(git -C "${repo}" rev-list --count "$(git -C "${repo}" merge-base main HEAD)..HEAD")"
  assert_contains "${GATE_OUT}" "${expected_count} commit(s) in range"
}

# TC-COMMITLINT-006: empty range passes and states zero commits
test_empty_range_passes_zero_commits() {
  local repo
  repo="$(_configured_repo fx-empty)"
  _branch_from_main "${repo}" "feat/GH-268/empty"
  _install_local_commitlint "${repo}"

  assert_eq "$(git -C "${repo}" rev-parse 'main^{commit}')" \
    "$(git -C "${repo}" rev-parse 'HEAD^{commit}')" "Precondition: HEAD equals main"

  _run_gate "${repo}" --base main

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "VERDICT: PASS"
  printf '%s\n' "${GATE_OUT}" | grep -qiE '0 commit' || {
    printf '  A bare PASS is not enough: the zero-commit count must be stated\n' >&2
    return 1
  }
}

# ============================================================================
# TC-COMMITLINT-007 .. 009 — skip, binary resolution, unrenderable verdicts
# ============================================================================

# TC-COMMITLINT-007: no configuration skips explicitly, regardless of binary/base
test_skip_without_config() {
  local repo
  repo="$(_new_repo fx-no-config)"
  printf 'not a conventional subject\n' >"${repo}/seed.txt"
  git -C "${repo}" add -A
  git -C "${repo}" commit -q -m "chore(GH-268): seed the fixture branch"
  _branch_from_main "${repo}" "feat/GH-268/no-config"
  _commit_msg "${repo}" "${FIXTURES}/msg-wip.txt"

  _run_gate "${repo}" --base main

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "SKIP"
  assert_contains "${GATE_OUT}" "no commitlint configuration"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"
}

test_skip_is_binary_insensitive() {
  local repo
  repo="$(_new_repo fx-no-config-local-bin)"
  _seed_main "${repo}"
  _branch_from_main "${repo}" "feat/GH-268/no-config"
  _commit_msg "${repo}" "${FIXTURES}/msg-wip.txt"
  _install_local_commitlint "${repo}"

  _run_gate "${repo}" --base main

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "SKIP"
  assert_not_contains "${GATE_OUT}" "ERROR"
}

test_skip_is_base_insensitive() {
  local repo
  repo="$(_new_repo fx-no-config-base)"
  _seed_main "${repo}"
  _branch_from_main "${repo}" "feat/GH-268/no-config"
  _commit_msg "${repo}" "${FIXTURES}/msg-wip.txt"

  _run_gate "${repo}" --base no-such-ref

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "SKIP"
  assert_not_contains "${GATE_OUT}" "ERROR"
  assert_not_contains "${GATE_OUT}" "does not resolve"
}

test_alt_config_name_is_configured() {
  local repo
  repo="$(_new_repo fx-alt-config)"
  printf '%s\n' '{"extends": ["@commitlint/config-conventional"]}' >"${repo}/.commitlintrc.json"
  _seed_main "${repo}"
  _branch_from_main "${repo}" "feat/GH-268/alt-config"
  _commit_msg "${repo}" "${FIXTURES}/msg-wip.txt"
  _install_local_commitlint "${repo}"

  _run_gate "${repo}" --base main

  assert_exit_code 1 "${GATE_EXIT}" "An alternate config filename must be treated as configured"
  assert_matches 'subject-empty|type-empty' "${GATE_OUT}"
}

# TC-COMMITLINT-008 step 1: absence of any usable binary is loud
test_error_when_binary_unavailable() {
  local repo
  repo="$(_configured_repo fx-clean-no-deps)"
  _branch_from_main "${repo}" "feat/GH-268/clean"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"

  local scrubbed="/usr/local/bin:/usr/bin:/bin" probe=0
  (PATH="${scrubbed}" command -v commitlint) >/dev/null 2>&1 || probe=$?
  assert_ne 0 "${probe}" "Precondition: commitlint is absent from the scrubbed PATH"
  [[ ! -d "${repo}/node_modules" ]] || {
    printf '  Precondition failed: the fixture must not carry a node_modules tree\n' >&2
    return 1
  }

  _run_gate_with_path "${repo}" "${scrubbed}" --base main

  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "ERROR"
  assert_contains "${GATE_OUT}" "commitlint"
  assert_contains "${GATE_OUT}" "install"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"
  assert_not_contains "${GATE_OUT}" "SKIP"
}

# TC-COMMITLINT-008 step 2: repository-local binary preferred
test_local_binary_preferred_over_path() {
  local repo
  repo="$(_configured_repo fx-local-bin)"
  _branch_from_main "${repo}" "feat/GH-268/local"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${repo}"

  _run_gate "${repo}" --base main

  assert_exit_code 1 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "binary=node_modules/.bin/commitlint"
  assert_contains "${GATE_OUT}" "origin=repository-local"
}

# TC-COMMITLINT-008 step 3: a decoy earlier on PATH never executes
test_decoy_path_binary_not_executed() {
  local repo
  repo="$(_configured_repo fx-decoy-path)"
  _branch_from_main "${repo}" "feat/GH-268/decoy"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${repo}"

  local decoy_dir="${_test_tmpdir}/decoy-bin"
  local decoy_marker="${_test_tmpdir}/decoy-marker"
  mkdir -p "${decoy_dir}"
  {
    printf '#!/bin/sh\n'
    printf 'printf "%%s\\n" "$0" >> "%s"\n' "${decoy_marker}"
    printf 'exit 0\n'
  } >"${decoy_dir}/commitlint"
  chmod +x "${decoy_dir}/commitlint"
  rm -f "${decoy_marker}"

  _run_gate_with_path "${repo}" "${decoy_dir}:${PATH}" --base main

  assert_exit_code 1 "${GATE_EXIT}" "The local binary must decide the verdict, not the decoy"
  [[ ! -e "${decoy_marker}" ]] || {
    printf '  The decoy binary on PATH was executed\n' >&2
    return 1
  }
  assert_contains "${GATE_OUT}" "binary=node_modules/.bin/commitlint"
  assert_contains "${GATE_OUT}" "origin=repository-local"
}

# TC-COMMITLINT-008 step 4: a foreign origin is disclosed, not failed
test_foreign_binary_disclosed() {
  local repo
  repo="$(_configured_repo fx-path-foreign)"
  _branch_from_main "${repo}" "feat/GH-268/foreign"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"

  local outer_dir="${_test_tmpdir}/outer-bin"
  _install_outer_commitlint "${outer_dir}"
  [[ ! -d "${repo}/node_modules" ]] || {
    printf '  Precondition failed: the fixture must not carry a node_modules tree\n' >&2
    return 1
  }

  _run_gate_with_path "${repo}" "${outer_dir}:${PATH}" --base main

  assert_exit_code 0 "${GATE_EXIT}" "A disclosed foreign tool still renders its verdict"
  assert_contains "${GATE_OUT}" "origin=PATH"
  assert_matches 'parity|outside the repository' "${GATE_OUT}"
  assert_not_contains "${GATE_OUT}" "VERDICT: ERROR"
}

# TC-COMMITLINT-008 step 5: the binary field exists in every outcome class
test_header_binary_field_every_outcome() {
  local clean bad skip error_repo
  clean="$(_configured_repo fx-hdr-clean)"
  _branch_from_main "${clean}" "feat/GH-268/clean"
  _commit_msg "${clean}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${clean}"

  bad="$(_configured_repo fx-hdr-bad)"
  _branch_from_main "${bad}" "feat/GH-268/bad"
  _commit_msg "${bad}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${bad}"

  skip="$(_new_repo fx-hdr-skip)"
  _seed_main "${skip}"
  _branch_from_main "${skip}" "feat/GH-268/skip"
  _commit_msg "${skip}" "${FIXTURES}/msg-wip.txt"

  error_repo="$(_configured_repo fx-hdr-error)"
  _branch_from_main "${error_repo}" "feat/GH-268/error"
  _commit_msg "${error_repo}" "${FIXTURES}/msg-valid.txt"

  _run_gate "${clean}" --base main
  assert_contains "${GATE_OUT}" "binary=node_modules/.bin/commitlint"

  _run_gate "${bad}" --base main
  assert_contains "${GATE_OUT}" "binary=node_modules/.bin/commitlint"

  _run_gate "${skip}" --base main
  assert_contains "${GATE_OUT}" "binary=none"

  _run_gate_with_path "${error_repo}" "/usr/local/bin:/usr/bin:/bin" --base main
  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "binary=none"
}

# TC-COMMITLINT-009 steps 1-5: invalid configuration is ERROR, not FAIL
test_invalid_config_is_error() {
  local repo
  repo="$(_new_repo fx-bad-config)"
  cp "${FIXTURES}/commitlint.config.invalid.txt" "${repo}/commitlint.config.js"
  _seed_main "${repo}"
  _branch_from_main "${repo}" "feat/GH-268/bad-config"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  [[ -x "${repo}/node_modules/.bin/commitlint" ]] || {
    printf '  Precondition failed: the invalid-config half must be decided locally\n' >&2
    return 1
  }

  _run_gate "${repo}" --base main

  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "ERROR"
  assert_contains "${GATE_OUT}" "origin=repository-local"
  assert_not_contains "${GATE_OUT}" "SURGICAL REWORD"
  assert_not_contains "${GATE_OUT}" "CONDENSE-TO-ONE"
  assert_not_matches 'rule=[a-z-]+ line=[0-9]+' "${GATE_OUT}"
  assert_matches 'config.*(fix|valid|install)|(fix|valid|install).*config' "${GATE_OUT}"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"
  assert_not_contains "${GATE_OUT}" "VERDICT: FAIL"
  assert_not_contains "${GATE_ERR}" "VERDICT: PASS"
  assert_not_contains "${GATE_ERR}" "VERDICT: FAIL"
}

# TC-COMMITLINT-009 step 6: execution failure is ERROR and the shim provably ran
test_execution_failure_is_error() {
  local repo
  repo="$(_configured_repo fx-bad-config-no-local)"
  _branch_from_main "${repo}" "feat/GH-268/exec-failure"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"

  local shim_dir="${_test_tmpdir}/shim-bin"
  local shim_marker="${_test_tmpdir}/shim-marker"
  mkdir -p "${shim_dir}"
  cp "${FIXTURES}/fake-commitlint-exec-failure.sh" "${shim_dir}/commitlint"
  chmod +x "${shim_dir}/commitlint"
  rm -f "${shim_marker}"

  [[ ! -e "${repo}/node_modules/.bin/commitlint" ]] || {
    printf '  Precondition failed: a local binary would shadow the shim\n' >&2
    return 1
  }
  [[ ! -d "${repo}/node_modules" ]] || {
    printf '  Precondition failed: the fixture must not carry a node_modules tree\n' >&2
    return 1
  }
  assert_eq "1" "$(git -C "${repo}" rev-list --count "$(git -C "${repo}" merge-base main HEAD)..HEAD")" \
    "Precondition: exactly one commit in range"

  export SHIM_MARKER="${shim_marker}"
  _run_gate_with_path "${repo}" "${shim_dir}:${PATH}" --base main
  unset SHIM_MARKER

  assert_exit_code 2 "${GATE_EXIT}"
  [[ -s "${shim_marker}" ]] || {
    printf '  The execution-failure shim did not run: SHIM_MARKER is empty\n' >&2
    return 1
  }
  local invocation_count wrong_lines
  invocation_count="$(wc -l <"${shim_marker}" | tr -d ' ')"
  wrong_lines="$(grep -cvF "${shim_dir}/commitlint" "${shim_marker}" || true)"
  [[ "${invocation_count}" -ge 1 ]] || {
    printf '  The shim must run at least once\n' >&2
    return 1
  }
  assert_eq "0" "${wrong_lines}" "Every marker line must name the shim"

  assert_contains "${GATE_OUT}" "origin=PATH"
  assert_contains "${GATE_OUT}" "ERROR"
  assert_matches 'execution|could not render' "${GATE_OUT}"
  assert_matches 'config.*(fix|valid|install)|(fix|valid|install).*config' "${GATE_OUT}"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"
  assert_not_contains "${GATE_OUT}" "VERDICT: FAIL"
  assert_not_contains "${GATE_ERR}" "VERDICT: PASS"
  assert_not_contains "${GATE_ERR}" "VERDICT: FAIL"
}

# ============================================================================
# TC-COMMITLINT-010 .. 012 — base resolution, merge-base, usage/exit contract
# ============================================================================

# TC-COMMITLINT-010 steps 1-2: explicit override then environment override
test_base_override_precedence() {
  local repo
  repo="$(_configured_repo fx-base-override)"
  _branch_from_main "${repo}" "feat/GH-268/base"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  local expected_mb
  expected_mb="$(git -C "${repo}" merge-base main HEAD)"

  export ADOS_BASE_BRANCH="integration"
  _run_gate "${repo}" --base main
  unset ADOS_BASE_BRANCH

  assert_exit_code 0 "${GATE_EXIT}"
  assert_matches 'base=main source=(explicit|explicit-override)' "${GATE_OUT}"
  assert_contains "${GATE_OUT}" "merge-base=${expected_mb}"
}

test_environment_base_precedence() {
  local repo
  repo="$(_configured_repo fx-base-env)"
  _branch_from_main "${repo}" "feat/GH-268/base-env"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  local expected_mb
  expected_mb="$(git -C "${repo}" merge-base main HEAD)"

  export ADOS_BASE_BRANCH="main"
  _run_gate "${repo}"
  unset ADOS_BASE_BRANCH

  assert_exit_code 0 "${GATE_EXIT}"
  assert_matches 'base=main source=(environment|env)' "${GATE_OUT}"
  assert_contains "${GATE_OUT}" "merge-base=${expected_mb}"
}

# TC-COMMITLINT-010 step 3: project configuration supplies the base
test_configured_base_resolves() {
  local repo
  repo="$(_configured_repo fx-config-base)"
  mkdir -p "${repo}/.ai/agent"
  printf '%s\n' '- **Default base branch**: `integration`' >"${repo}/.ai/agent/pr-instructions.md"
  _branch_from_main "${repo}" "integration"
  git -C "${repo}" checkout -q main
  _branch_from_main "${repo}" "feat/GH-268/config-base"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  unset ADOS_BASE_BRANCH || true
  _run_gate "${repo}"

  assert_exit_code 0 "${GATE_EXIT}"
  assert_matches 'base=integration source=(configuration|config)' "${GATE_OUT}"
}

# TC-COMMITLINT-010 step 4: the remote-tracking ref is preferred when it exists
test_remote_tracking_preferred() {
  local repo
  repo="$(_configured_repo fx-remote-tracking)"
  local m1
  m1="$(git -C "${repo}" rev-parse main)"

  _branch_from_main "${repo}" "feat/GH-268/remote"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"

  git -C "${repo}" checkout -q main
  _commit_file "${repo}" "advance.txt" "advance" "chore(GH-268): advance main"
  local m2
  m2="$(git -C "${repo}" rev-parse main)"
  git -C "${repo}" checkout -q "feat/GH-268/remote"
  git -C "${repo}" merge -q --no-ff -m "chore(GH-268): sync with main" main
  _install_local_commitlint "${repo}"

  git -C "${repo}" update-ref refs/remotes/origin/main "${m2}"
  git -C "${repo}" update-ref refs/heads/main "${m1}"

  local expected_mb
  expected_mb="$(git -C "${repo}" merge-base refs/remotes/origin/main HEAD)"

  _run_gate "${repo}" --base main

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "merge-base=${expected_mb}"
  assert_ne "$(git -C "${repo}" merge-base main HEAD)" "${expected_mb}" \
    "Precondition: local main and origin/main give different merge-bases"
}

# TC-COMMITLINT-010 step 5: an unresolvable base is a loud error
test_unresolvable_base_override_errors() {
  local repo
  repo="$(_configured_repo fx-unresolvable-base)"
  _branch_from_main "${repo}" "feat/GH-268/unresolvable"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  _run_gate "${repo}" --base no-such-branch
  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "ERROR"
  assert_contains "${GATE_OUT}" "no-such-branch"
  assert_matches 'fetch|--base' "${GATE_OUT}"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"

  export ADOS_BASE_BRANCH="no-such-branch"
  _run_gate "${repo}"
  unset ADOS_BASE_BRANCH
  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "no-such-branch"
}

test_unresolvable_configured_base_errors() {
  local repo
  repo="$(_configured_repo fx-unresolvable-config-base)"
  mkdir -p "${repo}/.ai/agent"
  printf '%s\n' '- **Default base branch**: `missing-base`' >"${repo}/.ai/agent/pr-instructions.md"
  _branch_from_main "${repo}" "feat/GH-268/missing-base"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  unset ADOS_BASE_BRANCH || true
  _run_gate "${repo}"

  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "missing-base"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"
}

# TC-COMMITLINT-011: undeterminable merge-base is never an empty range/pass
test_unrelated_history_errors() {
  local repo
  repo="$(_configured_repo fx-unrelated)"
  git -C "${repo}" checkout -q --orphan unrelated
  git -C "${repo}" rm -qrf .
  _add_config "${repo}"
  printf 'orphan\n' >"${repo}/orphan.txt"
  git -C "${repo}" add -A
  git -C "${repo}" commit -q -m "chore(GH-268): orphan history"
  git -C "${repo}" checkout -q main
  _install_local_commitlint "${repo}"

  local probe=0
  git -C "${repo}" merge-base HEAD unrelated >/dev/null 2>&1 || probe=$?
  assert_ne 0 "${probe}" "Precondition: the histories are unrelated"

  _run_gate "${repo}" --base unrelated

  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "ERROR"
  assert_matches 'merge-base|common ancestor' "${GATE_OUT}"
  assert_matches 'fetch|unshallow|depth' "${GATE_OUT}"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"
}

test_shallow_history_errors() {
  local source="${_test_tmpdir}/shallow-src"
  git init -q -b main "${source}"
  git -C "${source}" config user.email "test@example.invalid"
  git -C "${source}" config user.name "Fixture Bot"
  _add_config "${source}"
  _seed_main "${source}"
  _commit_file "${source}" "a.txt" "second" "chore(GH-268): second commit"
  _commit_file "${source}" "a.txt" "third" "chore(GH-268): third commit"
  git -C "${source}" checkout -q -b feature HEAD~1
  _commit_file "${source}" "a.txt" "fourth" "chore(GH-268): fourth commit"

  local dest="${_test_tmpdir}/shallow-dest"
  git clone -q --depth 1 --no-single-branch --branch feature "file://${source}" "${dest}"
  [[ -f "${dest}/.git/shallow" ]] || {
    printf '  Precondition failed: the clone is not shallow\n' >&2
    return 1
  }
  _install_local_commitlint "${dest}"

  _run_gate "${dest}" --base main

  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "ERROR"
  assert_matches 'fetch|unshallow|depth' "${GATE_OUT}"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"
}

# TC-COMMITLINT-012: usage errors, help, version, and the outcome-code contract
test_unknown_argument_usage_error() {
  local repo
  repo="$(_configured_repo fx-usage)"
  _branch_from_main "${repo}" "feat/GH-268/usage"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${repo}"

  _run_gate "${repo}" --nonsense
  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_ERR}" "Usage:"
  assert_contains "${GATE_ERR}" "--nonsense"
  assert_contains "${GATE_ERR}" "./scripts/lint-commit-range.sh [--base REF]"

  _run_gate "${repo}" --base
  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_ERR}" "Usage:"

  _run_gate "${repo}" --base --not-a-ref
  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_ERR}" "Usage:"

  _run_gate "${repo}" --base ""
  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_ERR}" "Usage:"

  # No history is consulted on a usage error.
  export GIT_TRACE=1
  _run_gate "${repo}" --nonsense
  unset GIT_TRACE
  assert_exit_code 2 "${GATE_EXIT}"
  assert_not_matches 'rev-list|merge-base|rev-parse|for-each-ref' "${GATE_ERR}"
}

test_help_and_version() {
  local out err=0

  out="$("${GATE}" --help 2>/dev/null)" || err=$?
  assert_exit_code 0 "${err}"
  assert_contains "${out}" "Usage:"
  assert_contains "${out}" "./scripts/lint-commit-range.sh [--base REF]"
  assert_matches '^[[:space:]]*0[[:space:]]*-[[:space:]]*(PASS|SKIP)' "${out}"
  assert_matches '^[[:space:]]*1[[:space:]]*-[[:space:]]*(FAIL|violation)' "${out}"
  assert_matches '^[[:space:]]*2[[:space:]]*-[[:space:]]*(ERROR|usage)' "${out}"
  assert_matches '^[[:space:]]*130[[:space:]]*-' "${out}"

  err=0
  out="$("${GATE}" --version)" || err=$?
  assert_exit_code 0 "${err}"
  assert_matches '^[0-9]+\.[0-9]+\.[0-9]+' "${out}"

  # Outcome-path exit literals: only {0,1,2,130}, with 130 confined to the
  # interrupt handler and documented as an interrupt code.
  local unexpected
  unexpected="$(grep -oE 'exit [[:digit:]]+' "${GATE}" | awk '{print $2}' | sort -u | grep -vE '^(0|1|2|130)$' || true)"
  assert_eq "" "${unexpected}" "No undocumented exit literal may exist"

  assert_eq "1" "$(grep -cE '^[[:space:]]*exit 130[[:space:]]*$' "${GATE}")" \
    "Exactly one exit 130 statement may exist"
  assert_eq "1" "$(awk '/_on_interrupt\(\)[[:space:]]*\{/{inb=1} inb&&/exit 130/{hit=1} inb&&/^\}/{inb=0} END{print hit+0}' "${GATE}")" \
    "exit 130 must sit inside the interrupt handler"
  assert_matches 'trap .*_on_interrupt.* (INT|TERM)' "$(grep -nE 'trap .*_on_interrupt' "${GATE}")"
}

# ============================================================================
# TC-COMMITLINT-013 .. 017 — diagnostics, determinism, bounds, modes
# ============================================================================

# Build FX-MULTI: valid, body, footer, valid, wip (three offenders).
_build_multi_three_offenders() {
  local -r repo="$1"
  _branch_from_main "${repo}" "three-offenders"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-body.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-footer.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-wip.txt"
}

# TC-COMMITLINT-013: one attributed block per offender, oldest to newest
test_diagnostics_per_commit_and_ordering() {
  local repo
  repo="$(_configured_repo fx-multi-order)"
  _build_multi_three_offenders "${repo}"
  _install_local_commitlint "${repo}"

  local -a expected=()
  mapfile -t expected < <(git -C "${repo}" rev-list --reverse "$(git -C "${repo}" merge-base main HEAD)..HEAD")

  _run_gate "${repo}" --base main

  assert_exit_code 1 "${GATE_EXIT}"

  local idx sha short
  local -a offender_order=()
  for idx in 1 2 4; do
    sha="${expected[idx]}"
    short="$(git -C "${repo}" rev-parse --short "${sha}")"
    assert_contains "${GATE_OUT}" "${short}"
    assert_contains "${GATE_OUT}" "${sha}"
    offender_order+=("${short}")
  done

  assert_matches 'rule=(body-max-line-length|footer-max-line-length|type-empty|subject-empty|type-enum)' "${GATE_OUT}"
  assert_matches 'line[= ]+[0-9]+' "${GATE_OUT}"

  local previous=-1 current
  for short in "${offender_order[@]}"; do
    current="$(printf '%s\n' "${GATE_OUT}" | grep -nF "FAIL ${short} (" | head -n 1 | cut -d: -f1)"
    [[ "${current}" -gt "${previous}" ]] || {
      printf '  Diagnostics are not ordered oldest to newest (%s after %s)\n' "${current}" "${previous}" >&2
      return 1
    }
    previous="${current}"
  done

  assert_eq "3" "$(printf '%s\n' "${GATE_OUT}" | grep -cE '^FAIL [0-9a-f]{7,} \(')" \
    "Exactly one block header per offending commit"
  assert_contains "${GATE_OUT}" "5 commit(s) in range"
  assert_contains "${GATE_OUT}" "3 offending commit(s)"
  assert_matches 'distinct rule' "${GATE_OUT}"
}

# TC-COMMITLINT-014: repeated runs are byte-identical
test_determinism_repeated_runs() {
  local repo
  repo="$(_configured_repo fx-multi-determinism)"
  _build_multi_three_offenders "${repo}"
  _install_local_commitlint "${repo}"

  local run1="${_test_tmpdir}/run1.out" run2="${_test_tmpdir}/run2.out" run3="${_test_tmpdir}/run3.out"
  local c1=0 c2=0 c3=0
  (cd "${repo}" && LC_ALL=C TZ=UTC "${GATE}" --base main) >"${run1}" 2>/dev/null || c1=$?
  (cd "${repo}" && LC_ALL=C TZ=UTC "${GATE}" --base main) >"${run2}" 2>/dev/null || c2=$?
  (cd "${repo}" && LC_ALL=C TZ=UTC "${GATE}" --base main) >"${run3}" 2>/dev/null || c3=$?

  assert_exit_code 1 "${c1}"
  assert_exit_code 1 "${c2}"
  assert_exit_code 1 "${c3}"
  cmp -s "${run1}" "${run2}" || {
    printf '  run1 and run2 differ\n' >&2
    return 1
  }
  cmp -s "${run2}" "${run3}" || {
    printf '  run2 and run3 differ\n' >&2
    return 1
  }
}

# TC-COMMITLINT-015: pathological output stays bounded and informative
test_output_is_bounded() {
  local repo
  repo="$(_configured_repo fx-many-violations)"
  _branch_from_main "${repo}" "many"
  local message="${_test_tmpdir}/msg-many.txt"
  {
    printf 'feat(GH-268): pathological body\n\n'
    local i
    for ((i = 0; i < 30; i++)); do
      printf '%0200d\n' 0 | tr '0' 'X'
    done
  } >"${message}"
  _commit_msg "${repo}" "${message}"
  _commit_msg "${repo}" "${FIXTURES}/msg-wip.txt"
  _install_local_commitlint "${repo}"

  _run_gate "${repo}" --base main

  assert_exit_code 1 "${GATE_EXIT}"
  assert_eq "2" "$(printf '%s\n' "${GATE_OUT}" | grep -cE '^FAIL [0-9a-f]{7,} \(')" \
    "Two offenders, counted per commit"

  local total_lines
  total_lines="$(printf '%s\n' "${GATE_OUT}" | wc -l | tr -d ' ')"
  [[ "${total_lines}" -le 200 ]] || {
    printf '  Output exceeded 200 lines: %s\n' "${total_lines}" >&2
    return 1
  }

  local line excerpt
  while IFS= read -r line; do
    [[ "${line}" == *" · "* ]] || continue
    excerpt="${line##* · }"
    [[ "${#excerpt}" -le 160 ]] || {
      printf '  Excerpt exceeded 160 characters: %s\n' "${excerpt}" >&2
      return 1
    }
  done <<<"${GATE_OUT}"

  assert_contains "${GATE_OUT}" "2 offending commit(s)"
  assert_matches '([3-9]|[1-9][0-9]) distinct rule' "${GATE_OUT}"
}

# TC-COMMITLINT-016: 1-2 offenders reword, >=3 condense, nothing is rewritten
test_mode_surgical_one() {
  local repo
  repo="$(_configured_repo fx-mode-one)"
  _branch_from_main "${repo}" "one-offender"
  _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${repo}"

  local before
  before="$(git -C "${repo}" rev-parse HEAD)"
  _run_gate "${repo}" --base main
  assert_exit_code 1 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "SURGICAL REWORD"
  assert_not_contains "${GATE_OUT}" "CONDENSE-TO-ONE"
  assert_eq "${before}" "$(git -C "${repo}" rev-parse HEAD)" "The mode line must not rewrite history"
}

test_mode_surgical_two() {
  local repo
  repo="$(_configured_repo fx-mode-two)"
  _branch_from_main "${repo}" "two-offenders"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-body.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-footer.txt"
  _install_local_commitlint "${repo}"

  local before
  before="$(git -C "${repo}" rev-parse HEAD)"
  _run_gate "${repo}" --base main
  assert_exit_code 1 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "SURGICAL REWORD"
  assert_not_contains "${GATE_OUT}" "CONDENSE-TO-ONE"
  assert_contains "${GATE_OUT}" "2 offending commit(s)"
  assert_eq "${before}" "$(git -C "${repo}" rev-parse HEAD)"
}

test_mode_condense_three() {
  local repo
  repo="$(_configured_repo fx-mode-three)"
  _branch_from_main "${repo}" "three-offenders"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-body.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-footer.txt"
  _commit_msg "${repo}" "${FIXTURES}/msg-wip.txt"
  _install_local_commitlint "${repo}"

  local before
  before="$(git -C "${repo}" rev-parse HEAD)"
  _run_gate "${repo}" --base main
  assert_exit_code 1 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "CONDENSE-TO-ONE"
  assert_not_contains "${GATE_OUT}" "SURGICAL REWORD"
  assert_contains "${GATE_OUT}" "3 offending commit(s)"
  assert_eq "${before}" "$(git -C "${repo}" rev-parse HEAD)"
}

# TC-COMMITLINT-017: offenders are counted per commit, not per violation
test_offender_count_per_commit() {
  local repo
  repo="$(_configured_repo fx-multi-count)"
  _branch_from_main "${repo}" "two-commits-many-violations"
  local message="${_test_tmpdir}/msg-wip-all.txt"
  _write_multi_violation_message "${message}"
  _commit_msg "${repo}" "${message}"
  _commit_msg "${repo}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${repo}"

  _run_gate "${repo}" --base main

  assert_exit_code 1 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "2 offending commit(s)"
  assert_matches '([3-9]|[1-9][0-9]) distinct rule' "${GATE_OUT}"
  assert_contains "${GATE_OUT}" "SURGICAL REWORD"
  assert_not_contains "${GATE_OUT}" "CONDENSE-TO-ONE"
}

# ============================================================================
# TC-COMMITLINT-018 .. 021 — read-only, no network, exit matrix, runtime
# ============================================================================

# TC-COMMITLINT-018: read-only across pass, fail, skip, and error
test_read_only_all_outcomes() {
  local pass fail skip error_repo
  pass="$(_configured_repo fx-ro-pass)"
  _branch_from_main "${pass}" "feat/GH-268/ro-pass"
  _commit_msg "${pass}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${pass}"

  fail="$(_configured_repo fx-ro-fail)"
  _branch_from_main "${fail}" "feat/GH-268/ro-fail"
  _commit_msg "${fail}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${fail}"

  skip="$(_new_repo fx-ro-skip)"
  _seed_main "${skip}"
  _branch_from_main "${skip}" "feat/GH-268/ro-skip"
  _commit_msg "${skip}" "${FIXTURES}/msg-wip.txt"

  error_repo="$(_configured_repo fx-ro-error)"
  _branch_from_main "${error_repo}" "feat/GH-268/ro-error"
  _commit_msg "${error_repo}" "${FIXTURES}/msg-valid.txt"

  local repo digest_before digest_after
  for repo in "${pass}" "${fail}" "${skip}" "${error_repo}"; do
    digest_before="$(_repo_digest "${repo}")"
    local files_before files_after
    files_before="$(_repo_file_listing "${repo}")"
    if [[ "${repo}" == "${error_repo}" ]]; then
      _run_gate_with_path "${repo}" "/usr/local/bin:/usr/bin:/bin" --base main
      assert_exit_code 2 "${GATE_EXIT}"
    else
      _run_gate "${repo}" --base main
    fi
    digest_after="$(_repo_digest "${repo}")"
    files_after="$(_repo_file_listing "${repo}")"
    assert_eq "${digest_before}" "${digest_after}" "The gate mutated repository state in ${repo}"
    assert_eq "${files_before}" "${files_after}" "The gate created or removed files in ${repo}"
    git -C "${repo}" fsck --no-progress --connectivity-only >/dev/null 2>&1 || {
      printf '  git fsck failed after the run in %s\n' "${repo}" >&2
      return 1
    }
  done
}

# TC-COMMITLINT-019: no network access on any path
test_no_network_access() {
  # Static guard: no network helper in command position.
  local static
  static="$(grep -nE '(^|[[:space:];|&(])(curl|wget|nc|ssh|scp|git[[:space:]]+(fetch|pull|push|clone|ls-remote|remote[[:space:]]+update))([[:space:]]|$)' "${GATE}" || true)"
  assert_eq "" "${static}" "The gate must not invoke a network tool"

  local pass fail error_repo
  pass="$(_configured_repo fx-net-pass)"
  _branch_from_main "${pass}" "feat/GH-268/net-pass"
  _commit_msg "${pass}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${pass}"

  fail="$(_configured_repo fx-net-fail)"
  _branch_from_main "${fail}" "feat/GH-268/net-fail"
  _commit_msg "${fail}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${fail}"

  error_repo="$(_configured_repo fx-net-error)"
  _branch_from_main "${error_repo}" "feat/GH-268/net-error"
  _commit_msg "${error_repo}" "${FIXTURES}/msg-valid.txt"

  local poison_dir="${_test_tmpdir}/poison-bin"
  local marker="${_test_tmpdir}/network-marker"
  mkdir -p "${poison_dir}"
  local tool
  for tool in curl wget ssh scp nc git-remote-https git-remote-http; do
    {
      printf '#!/bin/sh\n'
      printf 'printf "%%s\\n" "$0" >> "%s"\n' "${marker}"
      printf 'exit 1\n'
    } >"${poison_dir}/${tool}"
    chmod +x "${poison_dir}/${tool}"
  done
  rm -f "${marker}"
  export NETWORK_MARKER="${marker}"
  export GIT_TERMINAL_PROMPT=0
  export GIT_ASKPASS=/bin/false

  _run_gate_with_path "${pass}" "${poison_dir}:${PATH}" --base main
  _run_gate_with_path "${fail}" "${poison_dir}:${PATH}" --base main
  _run_gate_with_path "${error_repo}" "${poison_dir}:/usr/local/bin:/usr/bin:/bin" --base main

  unset NETWORK_MARKER GIT_TERMINAL_PROMPT GIT_ASKPASS

  [[ ! -e "${marker}" ]] || {
    printf '  A network shim was executed\n' >&2
    return 1
  }

  # Git-level trace: no transport verb.
  export GIT_TRACE=1
  _run_gate "${pass}" --base main
  unset GIT_TRACE
  assert_not_matches 'fetch|push|ls-remote|clone|git-remote-' "${GATE_ERR}"
}

# TC-COMMITLINT-020: the exit-code matrix is exactly 0 / 1 / 2
test_exit_code_matrix() {
  local clean empty bad skip unrelated no_deps bad_config no_local usage_repo
  clean="$(_configured_repo fx-mx-clean)"
  _branch_from_main "${clean}" "feat/GH-268/mx-clean"
  _commit_msg "${clean}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${clean}"

  empty="$(_configured_repo fx-mx-empty)"
  _branch_from_main "${empty}" "feat/GH-268/mx-empty"
  _install_local_commitlint "${empty}"

  bad="$(_configured_repo fx-mx-bad)"
  _branch_from_main "${bad}" "feat/GH-268/mx-bad"
  _commit_msg "${bad}" "${FIXTURES}/msg-bad-body.txt"
  _install_local_commitlint "${bad}"

  skip="$(_new_repo fx-mx-skip)"
  _seed_main "${skip}"
  _branch_from_main "${skip}" "feat/GH-268/mx-skip"
  _commit_msg "${skip}" "${FIXTURES}/msg-wip.txt"

  unrelated="$(_configured_repo fx-mx-unrelated)"
  git -C "${unrelated}" checkout -q --orphan unrelated
  git -C "${unrelated}" rm -qrf .
  _add_config "${unrelated}"
  printf 'orphan\n' >"${unrelated}/orphan.txt"
  git -C "${unrelated}" add -A
  git -C "${unrelated}" commit -q -m "chore(GH-268): orphan history"
  git -C "${unrelated}" checkout -q main
  _install_local_commitlint "${unrelated}"

  no_deps="$(_configured_repo fx-mx-no-deps)"
  _branch_from_main "${no_deps}" "feat/GH-268/mx-no-deps"
  _commit_msg "${no_deps}" "${FIXTURES}/msg-valid.txt"

  bad_config="$(_new_repo fx-mx-bad-config)"
  cp "${FIXTURES}/commitlint.config.invalid.txt" "${bad_config}/commitlint.config.js"
  _seed_main "${bad_config}"
  _branch_from_main "${bad_config}" "feat/GH-268/mx-bad-config"
  _commit_msg "${bad_config}" "${FIXTURES}/msg-valid.txt"
  _install_local_commitlint "${bad_config}"

  no_local="$(_configured_repo fx-mx-no-local)"
  _branch_from_main "${no_local}" "feat/GH-268/mx-no-local"
  _commit_msg "${no_local}" "${FIXTURES}/msg-valid.txt"

  usage_repo="${clean}"

  local -a codes=()

  _run_gate "${clean}" --base main
  codes+=("${GATE_EXIT}")
  assert_exit_code 0 "${GATE_EXIT}" "row a"

  _run_gate "${empty}" --base main
  codes+=("${GATE_EXIT}")
  assert_exit_code 0 "${GATE_EXIT}" "row b"

  _run_gate "${bad}" --base main
  codes+=("${GATE_EXIT}")
  assert_exit_code 1 "${GATE_EXIT}" "row c"
  assert_not_contains "${GATE_OUT}" "VERDICT: PASS"
  assert_contains "${GATE_OUT}" "VERDICT: FAIL"
  assert_contains "${GATE_ERR}" "VERDICT: FAIL"

  _run_gate "${skip}" --base main
  codes+=("${GATE_EXIT}")
  assert_exit_code 0 "${GATE_EXIT}" "row d"

  _run_gate "${bad}" --base no-such-ref
  codes+=("${GATE_EXIT}")
  assert_exit_code 2 "${GATE_EXIT}" "row e"
  assert_matches 'base ref .*no-such-ref' "${GATE_OUT}"
  assert_not_contains "${GATE_OUT}" "VERDICT: FAIL"

  _run_gate "${unrelated}" --base unrelated
  codes+=("${GATE_EXIT}")
  assert_exit_code 2 "${GATE_EXIT}" "row f"

  _run_gate_with_path "${no_deps}" "/usr/local/bin:/usr/bin:/bin" --base main
  codes+=("${GATE_EXIT}")
  assert_exit_code 2 "${GATE_EXIT}" "row g"
  assert_contains "${GATE_OUT}" "binary is unavailable"
  assert_contains "${GATE_OUT}" "install"
  assert_not_contains "${GATE_OUT}" "could not render"

  _run_gate "${bad_config}" --base main
  codes+=("${GATE_EXIT}")
  assert_exit_code 2 "${GATE_EXIT}" "row h (invalid configuration)"
  assert_contains "${GATE_OUT}" "could not render"
  assert_contains "${GATE_OUT}" "origin=repository-local"
  assert_not_contains "${GATE_OUT}" "binary is unavailable"

  local shim_dir="${_test_tmpdir}/mx-shim-bin"
  local shim_marker="${_test_tmpdir}/mx-shim-marker"
  mkdir -p "${shim_dir}"
  cp "${FIXTURES}/fake-commitlint-exec-failure.sh" "${shim_dir}/commitlint"
  chmod +x "${shim_dir}/commitlint"
  rm -f "${shim_marker}"
  export SHIM_MARKER="${shim_marker}"
  _run_gate_with_path "${no_local}" "${shim_dir}:${PATH}" --base main
  unset SHIM_MARKER
  codes+=("${GATE_EXIT}")
  assert_exit_code 2 "${GATE_EXIT}" "row h (execution failure)"
  assert_contains "${GATE_OUT}" "origin=PATH"
  assert_contains "${GATE_OUT}" "could not render"
  [[ -s "${shim_marker}" ]] || {
    printf '  The row-h execution shim did not run\n' >&2
    return 1
  }

  _run_gate "${usage_repo}" --nonsense
  codes+=("${GATE_EXIT}")
  assert_exit_code 2 "${GATE_EXIT}" "row i"

  local observed
  observed="$(printf '%s\n' "${codes[@]}" | sort -u | tr '\n' ' ')"
  assert_eq "0 1 2 " "${observed}" "The matrix must observe exactly 0, 1, 2"

  # Precedence pair (b): an unresolvable base outranks a missing binary.
  _run_gate_with_path "${no_deps}" "/usr/local/bin:/usr/bin:/bin" --base no-such-ref
  assert_exit_code 2 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "no-such-ref"
  assert_not_contains "${GATE_OUT}" "binary is unavailable"

  # Error verdicts are mirrored to stderr.
  _run_gate "${unrelated}" --base unrelated
  assert_contains "${GATE_ERR}" "VERDICT: ERROR"
}

# TC-COMMITLINT-021: runtime budgets for a 20- and a 100-commit range
test_runtime_budget_20_commits() {
  local repo
  repo="$(_configured_repo fx-20)"
  _branch_from_main "${repo}" "feat/GH-268/twenty"
  local i
  for ((i = 0; i < 20; i++)); do
    _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  done
  _install_local_commitlint "${repo}"

  local start end elapsed
  start="$(date +%s%N)"
  _run_gate "${repo}" --base main
  end="$(date +%s%N)"
  elapsed=$(((end - start) / 1000000))

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "20 commit(s) in range"
  [[ "${elapsed}" -le 10000 ]] || {
    printf '  The 20-commit range took %s ms (budget 10000 ms)\n' "${elapsed}" >&2
    return 1
  }
}

test_runtime_budget_100_commits() {
  local repo
  repo="$(_configured_repo fx-100)"
  _branch_from_main "${repo}" "feat/GH-268/hundred"
  local i
  for ((i = 0; i < 100; i++)); do
    _commit_msg "${repo}" "${FIXTURES}/msg-valid.txt"
  done
  _install_local_commitlint "${repo}"

  local start end elapsed
  start="$(date +%s%N)"
  _run_gate "${repo}" --base main
  end="$(date +%s%N)"
  elapsed=$(((end - start) / 1000000))

  assert_exit_code 0 "${GATE_EXIT}"
  assert_contains "${GATE_OUT}" "100 commit(s) in range"
  [[ "${elapsed}" -le 60000 ]] || {
    printf '  The 100-commit range took %s ms (budget 60000 ms)\n' "${elapsed}" >&2
    return 1
  }
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running commit-range gate tests...\n' "${TEST_TAG}"

  run_test "TC-COMMITLINT-001 malformed commit fails with attribution" test_bad_body_commit_fails
  run_test "TC-COMMITLINT-002 clean conventional range passes" test_clean_range_passes
  run_test "TC-COMMITLINT-003 conventional-subject merge commit passes" test_conventional_merge_commit_passes
  run_test "TC-COMMITLINT-004 plain merge subject passes (parity)" test_plain_merge_subject_passes
  run_test "TC-COMMITLINT-005 upstream history outside the range ignored" test_upstream_history_outside_range_ignored
  run_test "TC-COMMITLINT-006 empty range passes with zero commits" test_empty_range_passes_zero_commits
  run_test "TC-COMMITLINT-007 no configuration skips explicitly" test_skip_without_config
  run_test "TC-COMMITLINT-007 skip is binary-insensitive" test_skip_is_binary_insensitive
  run_test "TC-COMMITLINT-007 skip is base-insensitive" test_skip_is_base_insensitive
  run_test "TC-COMMITLINT-007 alternate config name is configured" test_alt_config_name_is_configured
  run_test "TC-COMMITLINT-008 missing binary is a loud error" test_error_when_binary_unavailable
  run_test "TC-COMMITLINT-008 local binary preferred over PATH" test_local_binary_preferred_over_path
  run_test "TC-COMMITLINT-008 decoy on PATH never executes" test_decoy_path_binary_not_executed
  run_test "TC-COMMITLINT-008 foreign origin disclosed, not failed" test_foreign_binary_disclosed
  run_test "TC-COMMITLINT-008 binary field in every outcome" test_header_binary_field_every_outcome
  run_test "TC-COMMITLINT-009 invalid configuration is ERROR" test_invalid_config_is_error
  run_test "TC-COMMITLINT-009 execution failure is ERROR (shim proven)" test_execution_failure_is_error
  run_test "TC-COMMITLINT-010 explicit base override precedence" test_base_override_precedence
  run_test "TC-COMMITLINT-010 environment base override" test_environment_base_precedence
  run_test "TC-COMMITLINT-010 configured base resolves" test_configured_base_resolves
  run_test "TC-COMMITLINT-010 remote-tracking ref preferred" test_remote_tracking_preferred
  run_test "TC-COMMITLINT-010 unresolvable base override errors" test_unresolvable_base_override_errors
  run_test "TC-COMMITLINT-010 unresolvable configured base errors" test_unresolvable_configured_base_errors
  run_test "TC-COMMITLINT-011 unrelated history errors" test_unrelated_history_errors
  run_test "TC-COMMITLINT-011 shallow history errors" test_shallow_history_errors
  run_test "TC-COMMITLINT-012 usage errors and exit contract" test_unknown_argument_usage_error
  run_test "TC-COMMITLINT-012 help, version, and outcome codes" test_help_and_version
  run_test "TC-COMMITLINT-013 diagnostics per commit and ordering" test_diagnostics_per_commit_and_ordering
  run_test "TC-COMMITLINT-014 repeated runs are byte-identical" test_determinism_repeated_runs
  run_test "TC-COMMITLINT-015 diagnostic output is bounded" test_output_is_bounded
  run_test "TC-COMMITLINT-016 one offender selects surgical reword" test_mode_surgical_one
  run_test "TC-COMMITLINT-016 two offenders select surgical reword" test_mode_surgical_two
  run_test "TC-COMMITLINT-016 three offenders select condense-to-one" test_mode_condense_three
  run_test "TC-COMMITLINT-017 offenders counted per commit" test_offender_count_per_commit
  run_test "TC-COMMITLINT-018 read-only across every outcome" test_read_only_all_outcomes
  run_test "TC-COMMITLINT-019 no network access" test_no_network_access
  run_test "TC-COMMITLINT-020 exit-code matrix is exactly 0/1/2" test_exit_code_matrix
  run_test "TC-COMMITLINT-021 runtime budget for 20 commits" test_runtime_budget_20_commits
  run_test "TC-COMMITLINT-021 runtime budget for 100 commits" test_runtime_budget_100_commits

  print_summary
}

main "$@"
