#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/test-clean-merged-branches.sh
# test-clean-merged-branches.sh — Tests for tools/clean-merged-branches
#
# Integration tests that create temp git repos and verify branch cleanup
# behavior: clean-tree guard, ancestry-merged delete, content-identical
# (squash-merge) delete, protected-branch skip, dry-run, and original-branch
# restore.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-clean-merged-branches)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

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
source "${SCRIPT_DIR}/clean-merged-branches"

# Reset ERR trap — the sourced script sets its own; we use subshell isolation.
trap - ERR

# ============================================================================
# TEST FIXTURES
# ============================================================================

# Create a temp git repo with main branch and one initial commit.
# Prints the repo path.
_create_test_repo() {
  local -r repo="${_test_tmpdir}/repo"
  mkdir -p "${repo}"
  git -C "${repo}" init -q
  git -C "${repo}" symbolic-ref HEAD refs/heads/main
  git -C "${repo}" config user.name "Test User"
  git -C "${repo}" config user.email "test@example.com"
  git -C "${repo}" commit -q --allow-empty -m "initial commit"
  printf '%s' "${repo}"
}

# Commit a file with given content in the current repo (cwd must be the repo)
_commit_file() {
  local -r filename="$1" content="$2" message="$3"
  printf '%s\n' "${content}" > "${filename}"
  git add "${filename}"
  git commit -q -m "${message}"
}

# ============================================================================
# TESTS
# ============================================================================

# TC-CMB-01: clean-tree guard — refuses with dirty tree
test_clean_tree_guard_refuses() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create an untracked file to make the tree dirty
  printf 'dirty\n' > untracked.txt

  # clean_branches should die (exit 2) because tree is dirty
  local exit_code=0
  ( clean_branches ) 2>/dev/null || exit_code=$?

  assert_eq 2 "${exit_code}" "Should exit with code 2 on dirty tree"
}

# TC-CMB-01b: --allow-dirty overrides the guard
test_allow_dirty_overrides() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create an untracked file
  printf 'dirty\n' > untracked.txt

  # Set ALLOW_DIRTY=true
  # shellcheck disable=SC2034  # read by the sourced clean_branches function
  ALLOW_DIRTY=true

  local exit_code=0
  ( clean_branches ) 2>/dev/null || exit_code=$?

  assert_eq 0 "${exit_code}" "Should succeed with --allow-dirty"
}

# TC-CMB-02: ancestry-merged delete — branch with ancestry to main is deleted
test_ancestry_merged_delete() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create feature branch with a commit
  git checkout -q -b feature
  _commit_file "feature.txt" "feature content" "add feature file"
  git checkout -q main

  # Merge feature into main (regular merge, creates ancestry link)
  git merge -q --no-ff feature -m "merge feature"

  # feature should be ancestry-merged now
  clean_branches 2>/dev/null

  # Verify feature is deleted
  local result
  result="$(git branch --format='%(refname:short)' | grep -c '^feature$' || true)"
  assert_eq 0 "${result}" "Branch 'feature' should be deleted after ancestry-merged cleanup"
}

# TC-CMB-03: content-identical delete (squash-merge case)
test_content_identical_delete() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create feature branch with a commit
  git checkout -q -b feature
  _commit_file "shared.txt" "same content" "add shared file on feature"
  git checkout -q main

  # Simulate squash merge: make the same change on main (different commit, same tree)
  _commit_file "shared.txt" "same content" "squash merge feature"

  # feature is NOT ancestry-merged (diverged), but IS content-identical
  # Verify it's not ancestry-merged
  local ancestry_check
  ancestry_check="$(git branch --merged main --format='%(refname:short)' | grep -c '^feature$' || true)"
  assert_eq 0 "${ancestry_check}" "Pre-condition: feature should NOT be ancestry-merged"

  # Run cleanup
  clean_branches 2>/dev/null

  # Verify feature is deleted (caught by content-identical check)
  local result
  result="$(git branch --format='%(refname:short)' | grep -c '^feature$' || true)"
  assert_eq 0 "${result}" "Branch 'feature' should be deleted (content-identical to main)"
}

# TC-CMB-04: protected-branch skip — main/master/develop never deleted
test_protected_branch_skip() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create master and develop branches (identical to main = would be deleted if not protected)
  git branch master
  git branch develop

  # Also create a non-protected feature branch that is content-identical
  git branch feature

  # Run cleanup
  clean_branches 2>/dev/null

  local branches
  branches="$(git branch --format='%(refname:short)')"

  # Protected branches must survive
  assert_contains "${branches}" "main" "main should survive"
  assert_contains "${branches}" "master" "master should survive"
  assert_contains "${branches}" "develop" "develop should survive"

  # Non-protected feature should be deleted
  local feature_count
  feature_count="$(printf '%s\n' "${branches}" | grep -c '^feature$' || true)"
  assert_eq 0 "${feature_count}" "feature should be deleted (not protected)"
}

# TC-CMB-04b: --protected adds custom protected branches
test_custom_protected_branch() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create branches identical to main
  git branch release
  git branch feature

  # Add release to protected list
  # shellcheck disable=SC2034  # read by the sourced clean_branches function
  PROTECTED_EXTRA="release"

  clean_branches 2>/dev/null

  local branches
  branches="$(git branch --format='%(refname:short)')"

  assert_contains "${branches}" "release" "release should survive (custom protected)"
  local feature_count
  feature_count="$(printf '%s\n' "${branches}" | grep -c '^feature$' || true)"
  assert_eq 0 "${feature_count}" "feature should be deleted (not protected)"
}

# TC-CMB-05: dry-run — lists but doesn't delete
test_dry_run_no_delete() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create an ancestry-merged branch
  git checkout -q -b feature
  _commit_file "feature.txt" "content" "feature commit"
  git checkout -q main
  git merge -q --no-ff feature -m "merge feature"

  # Enable dry-run
  # shellcheck disable=SC2034  # read by the sourced clean_branches function
  DRY_RUN=true

  clean_branches 2>/dev/null

  # Verify feature still exists
  local result
  result="$(git branch --format='%(refname:short)' | grep -c '^feature$' || true)"
  assert_eq 1 "${result}" "Branch 'feature' should still exist in dry-run mode"
}

# TC-CMB-06: original-branch restore — returns to original branch after cleanup
test_original_branch_restore() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create a branch with real changes (NOT identical to main)
  git checkout -q -b keep-me
  _commit_file "unique.txt" "unique content" "unique commit"
  git checkout -q main

  # Checkout keep-me as the starting branch
  git checkout -q keep-me

  clean_branches 2>/dev/null

  # Verify we're back on keep-me
  local current
  current="$(git symbolic-ref --short HEAD)"
  assert_eq "keep-me" "${current}" "Should restore to original branch 'keep-me'"
}

# TC-CMB-06b: deleted original branch stays on base
test_deleted_original_stays_on_base() {
  local repo
  repo="$(_create_test_repo)"
  cd "${repo}"

  # Create a feature branch identical to main (will be deleted)
  git branch feature

  # Checkout feature as starting branch
  git checkout -q feature

  clean_branches 2>/dev/null

  # feature is deleted, should stay on main
  local current
  current="$(git symbolic-ref --short HEAD)"
  assert_eq "main" "${current}" "Should stay on main when original branch was deleted"
}

# Pure function test: is_protected_branch
test_is_protected_branch_pure() {
  is_protected_branch "main" "main master develop" && return 0
  return 1
}

test_is_not_protected_branch_pure() {
  if is_protected_branch "feature" "main master develop"; then
    return 1
  fi
  return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  run_test "TC-CMB-01: clean-tree guard refuses dirty tree" test_clean_tree_guard_refuses
  run_test "TC-CMB-01b: --allow-dirty overrides guard" test_allow_dirty_overrides
  run_test "TC-CMB-02: ancestry-merged branch deleted" test_ancestry_merged_delete
  run_test "TC-CMB-03: content-identical (squash-merge) branch deleted" test_content_identical_delete
  run_test "TC-CMB-04: protected branches (main/master/develop) skip" test_protected_branch_skip
  run_test "TC-CMB-04b: custom --protected branches skip" test_custom_protected_branch
  run_test "TC-CMB-05: dry-run does not delete" test_dry_run_no_delete
  run_test "TC-CMB-06: original branch restored after cleanup" test_original_branch_restore
  run_test "TC-CMB-06b: stays on base when original deleted" test_deleted_original_stays_on_base
  run_test "pure: is_protected_branch true case" test_is_protected_branch_pure
  run_test "pure: is_protected_branch false case" test_is_not_protected_branch_pure

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
