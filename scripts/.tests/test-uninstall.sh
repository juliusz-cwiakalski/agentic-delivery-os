#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/scripts/.tests/test-uninstall.sh
# test-uninstall.sh — Tests for uninstall.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-uninstall)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

# Colors (disabled if not a terminal)
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
}

trap '_test_teardown' EXIT

# Run a test function
run_test() {
  local -r name="$1"
  local -r func="$2"
  _test_count=$((_test_count + 1))

  _test_setup

  if ( set -e; "${func}" ); then
    _test_passed=$((_test_passed + 1))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    _test_failed=$((_test_failed + 1))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi

  _test_teardown
  _test_tmpdir=""
}

# Assertions
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
    printf '  Haystack should not contain: %s\n  Needle: %s\n' "${haystack}" "${needle}" >&2
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

assert_file_not_exists() {
  local -r path="$1" msg="${2:-}"
  if [[ -f "${path}" ]]; then
    printf '  File should not exist: %s\n' "${path}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_dir_exists() {
  local -r path="$1" msg="${2:-}"
  if [[ ! -d "${path}" ]]; then
    printf '  Directory does not exist: %s\n' "${path}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_dir_not_exists() {
  local -r path="$1" msg="${2:-}"
  if [[ -d "${path}" ]]; then
    printf '  Directory should not exist: %s\n' "${path}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_exit_code() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" -ne "${actual}" ]]; then
    printf '  Expected exit code: %s\n  Actual exit code:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

# Print test summary
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

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/uninstall.sh"

# ============================================================================
# TEST FIXTURES
# ============================================================================

# Create a mock global install
create_mock_global_install() {
  local -r base="$1"
  local -r agent_dir="${base}/opencode/agent"
  local -r command_dir="${base}/opencode/command"
  local -r ados_home="${base}/ados-home"

  mkdir -p "${agent_dir}" "${command_dir}" "${ados_home}/repo"

  # Create agent files
  printf '# pm\n' > "${agent_dir}/pm.md"
  printf '# coder\n' > "${agent_dir}/coder.md"
  printf '# reviewer\n' > "${agent_dir}/reviewer.md"

  # Create command files
  printf '# run-plan\n' > "${command_dir}/run-plan.md"
  printf '# commit\n' > "${command_dir}/commit.md"

  # Create a non-ADOS file to ensure it's preserved
  printf '# custom agent\n' > "${agent_dir}/custom-agent.md"

  printf '%s' "${base}"
}

# Create a mock local ADOS project
create_mock_ados_project() {
  local -r base="$1"
  mkdir -p "${base}/.git"
  mkdir -p "${base}/.ai/agent"
  mkdir -p "${base}/.ai/local"
  mkdir -p "${base}/.ai/rules"
  mkdir -p "${base}/doc/templates/blueprints"
  mkdir -p "${base}/doc/overview"
  mkdir -p "${base}/doc/spec/features"
  mkdir -p "${base}/doc/decisions"
  mkdir -p "${base}/doc/changes"
  mkdir -p "${base}/doc/guides"

  # Helper: write an .md file carrying a frontmatter `ados_distribution` marker.
  # The marker-driven uninstall (PR #74 review C1) reads this to decide removal;
  # fixtures must therefore mirror the real repo's marker convention.
  _mock_md() {
    # $1=path  $2=marker  $3=heading
    printf -- '---\nados_distribution: %s\n---\n%s\n' "$2" "$3" > "${base}/$1"
  }

  # Project-specific files (NEVER removed)
  printf '# PM Instructions\n' > "${base}/.ai/agent/pm-instructions.md"

  # Updatable standalone docs (redistributable -> removed)
  _mock_md "doc/documentation-handbook.md"  redistributable "# Handbook"
  _mock_md "doc/00-index.md"                redistributable "# Index"

  # Guides — redistributable ones are removed by the marker-driven uninstall.
  _mock_md "doc/guides/change-lifecycle.md"                                              redistributable "# Change Lifecycle"
  _mock_md "doc/guides/unified-change-convention-tracker-agnostic-specification.md"      redistributable "# Change Convention"
  _mock_md "doc/guides/decision-records-management.md"                                   redistributable "# Decision Records"
  _mock_md "doc/guides/opencode-agents-and-commands-guide.md"                            redistributable "# Agents Guide"
  _mock_md "doc/guides/opencode-model-configuration.md"                                  redistributable "# Model Config"
  _mock_md "doc/guides/tools-convention.md"                                              redistributable "# Tools Convention"
  _mock_md "doc/guides/copywriting.md"                                                   redistributable "# Copywriting"
  _mock_md "doc/guides/ados-tools-system-dependencies.md"                                redistributable "# System Deps"
  _mock_md "doc/guides/onboarding-existing-project.md"                                   redistributable "# Onboarding"
  # An `internal` guide MUST be preserved (not installed, so not removed).
  _mock_md "doc/guides/adding-tool-support.md"                                           internal        "# Adding Tool Support"

  # Decision stubs — README is redistributable (removed); 00-index.md is
  # `project-generated` (regenerated per-repo per GH-63) and MUST be preserved.
  _mock_md "doc/decisions/README.md"    redistributable    "# Decisions README"
  _mock_md "doc/decisions/00-index.md"  project-generated  "# Decisions Index"

  # Rules index (redistributable -> removed)
  _mock_md ".ai/rules/README.md" redistributable "# AI Rules"

  # Templates — flat md, a nested blueprint, and a yaml register (all
  # redistributable -> removed by the recursive marker-driven path).
  _mock_md "doc/templates/change-spec-template.md"  redistributable "# Template"
  _mock_md "doc/templates/feature-spec-template.md" redistributable "# Template"
  _mock_md "doc/templates/README.md"                redistributable "# Template"
  _mock_md "doc/templates/blueprints/code-review-instructions--example.md" redistributable "# Blueprint"
  printf 'ados_distribution: redistributable\nregister_id: MOCK-REGISTER-001\n' > "${base}/doc/templates/register-template.yaml"

  printf '%s' "${base}"
}

# ============================================================================
# UNIT TESTS — Pure functions
# ============================================================================

test_reset_counters() {
  _removed=5
  _skipped=3
  reset_counters
  assert_eq "0" "${_removed}" "removed should be reset"
  assert_eq "0" "${_skipped}" "skipped should be reset"
}

# ============================================================================
# INTEGRATION TESTS — remove_file
# ============================================================================

test_remove_file_exists() {
  local file="${_test_tmpdir}/test.md"
  printf 'content\n' > "${file}"

  reset_counters
  remove_file "${file}" "test.md"

  assert_file_not_exists "${file}" "File should be removed"
  assert_eq "1" "${_removed}" "Should count as removed"
}

test_remove_file_not_exists() {
  reset_counters
  remove_file "${_test_tmpdir}/nonexistent.md" "test.md"

  assert_eq "0" "${_removed}" "Should not count as removed"
  assert_eq "1" "${_skipped}" "Should count as skipped"
}

test_remove_file_symlink() {
  local target="${_test_tmpdir}/target.md"
  local link="${_test_tmpdir}/link.md"
  printf 'target\n' > "${target}"
  ln -sf "${target}" "${link}"

  reset_counters
  remove_file "${link}" "link.md"

  assert_file_not_exists "${link}" "Symlink should be removed"
  assert_file_exists "${target}" "Target should still exist"
  assert_eq "1" "${_removed}" "Should count as removed"
}

test_remove_file_dry_run() {
  local file="${_test_tmpdir}/test.md"
  printf 'content\n' > "${file}"

  DRY_RUN=true
  reset_counters
  remove_file "${file}" "test.md"
  DRY_RUN=false

  assert_file_exists "${file}" "File should NOT be removed in dry-run"
  assert_eq "1" "${_removed}" "Counter still increments in dry-run"
}

# ============================================================================
# INTEGRATION TESTS — safe_rmdir
# ============================================================================

test_safe_rmdir_exists() {
  local dir="${_test_tmpdir}/to-remove"
  mkdir -p "${dir}/subdir"
  printf 'file\n' > "${dir}/subdir/file.txt"

  safe_rmdir "${dir}" "test-dir"

  assert_dir_not_exists "${dir}" "Directory should be removed"
}

test_safe_rmdir_not_exists() {
  # Should not error
  safe_rmdir "${_test_tmpdir}/nonexistent" "test-dir"
}

test_safe_rmdir_refuses_empty() {
  local exit_code=0
  safe_rmdir "" "empty-path" || exit_code=$?
  assert_eq "4" "${exit_code}" "Should refuse empty path"
}

test_safe_rmdir_refuses_root() {
  local exit_code=0
  safe_rmdir "/" "root" || exit_code=$?
  assert_eq "4" "${exit_code}" "Should refuse root path"
}

test_safe_rmdir_dry_run() {
  local dir="${_test_tmpdir}/to-remove"
  mkdir -p "${dir}"

  DRY_RUN=true
  safe_rmdir "${dir}" "test-dir"
  DRY_RUN=false

  assert_dir_exists "${dir}" "Directory should NOT be removed in dry-run"
}

test_safe_rmdir_refuses_trailing_slash_home() {
  local exit_code=0
  safe_rmdir "${HOME}/" "home-trailing" || exit_code=$?
  assert_exit_code "${EXIT_RUNTIME}" "${exit_code}" "Should refuse HOME with trailing slash"
}

test_safe_rmdir_refuses_dot_suffix_home() {
  local exit_code=0
  safe_rmdir "${HOME}/." "home-dot" || exit_code=$?
  assert_exit_code "${EXIT_RUNTIME}" "${exit_code}" "Should refuse HOME with dot suffix"
}

test_safe_rmdir_refuses_shallow_path() {
  local exit_code=0
  safe_rmdir "/tmp" "shallow-path" || exit_code=$?
  assert_exit_code "${EXIT_RUNTIME}" "${exit_code}" "Should refuse shallow path (depth < 3)"
}

# ============================================================================
# INTEGRATION TESTS — Global uninstall
# ============================================================================

test_global_uninstall_removes_agents() {
  local mock
  mock="$(create_mock_global_install "${_test_tmpdir}/global")"
  local agent_dir="${mock}/opencode/agent"

  # Override the global dir for this test
  reset_counters

  # Directly call remove logic for known files
  local name
  for name in pm.md coder.md reviewer.md; do
    remove_file "${agent_dir}/${name}" "agent/${name}"
  done

  assert_file_not_exists "${agent_dir}/pm.md" "pm.md should be removed"
  assert_file_not_exists "${agent_dir}/coder.md" "coder.md should be removed"
  assert_file_not_exists "${agent_dir}/reviewer.md" "reviewer.md should be removed"

  # Non-ADOS file should still exist
  assert_file_exists "${agent_dir}/custom-agent.md" "Custom agent should be preserved"

  assert_eq "3" "${_removed}" "Should have removed 3 files"
}

test_global_uninstall_removes_commands() {
  local mock
  mock="$(create_mock_global_install "${_test_tmpdir}/global")"
  local command_dir="${mock}/opencode/command"

  reset_counters

  local name
  for name in run-plan.md commit.md; do
    remove_file "${command_dir}/${name}" "command/${name}"
  done

  assert_file_not_exists "${command_dir}/run-plan.md" "run-plan.md should be removed"
  assert_file_not_exists "${command_dir}/commit.md" "commit.md should be removed"
  assert_eq "2" "${_removed}" "Should have removed 2 files"
}

test_global_uninstall_removes_ados_home() {
  local ados_home="${_test_tmpdir}/ados-home"
  mkdir -p "${ados_home}/repo/.git"
  printf 'state\n' > "${ados_home}/state.txt"

  safe_rmdir "${ados_home}" "~/.ados"

  assert_dir_not_exists "${ados_home}" "ADOS home should be removed"
}

# ============================================================================
# INTEGRATION TESTS — Local uninstall
# ============================================================================

test_local_uninstall_removes_files() {
  local project_dir
  project_dir="$(create_mock_ados_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    FORCE=true
    reset_counters
    remove_local_files
  )

  # pm-instructions.md should NOT be removed (user-created, not ADOS-installed)
  assert_file_exists "${project_dir}/.ai/agent/pm-instructions.md" "pm-instructions should be preserved"
  assert_file_not_exists "${project_dir}/doc/documentation-handbook.md" "handbook should be removed"
  assert_file_not_exists "${project_dir}/doc/00-index.md" "index should be removed"
  assert_file_not_exists "${project_dir}/doc/templates/change-spec-template.md" "template should be removed"
}

test_local_uninstall_removes_empty_dirs() {
  local project_dir="${_test_tmpdir}/project"
  mkdir -p "${project_dir}/.git"
  mkdir -p "${project_dir}/doc/overview"
  mkdir -p "${project_dir}/doc/decisions"
  # These should be removed if empty

  (
    cd "${project_dir}"
    FORCE=true
    reset_counters
    remove_local_files
  )

  assert_dir_not_exists "${project_dir}/doc/overview" "Empty overview dir should be removed"
  assert_dir_not_exists "${project_dir}/doc/decisions" "Empty decisions dir should be removed"
}

test_local_uninstall_keeps_nonempty_dirs() {
  local project_dir
  project_dir="$(create_mock_ados_project "${_test_tmpdir}/project")"

  # Add custom content
  printf '# My Guide\n' > "${project_dir}/doc/guides/my-guide.md"

  (
    cd "${project_dir}"
    FORCE=true
    reset_counters
    remove_local_files
  )

  # guides/ has a custom file, should NOT be removed
  assert_dir_exists "${project_dir}/doc/guides" "Non-empty guides dir should be preserved"
  assert_file_exists "${project_dir}/doc/guides/my-guide.md" "Custom file should be preserved"
}

test_local_uninstall_dry_run() {
  local project_dir
  project_dir="$(create_mock_ados_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    DRY_RUN=true
    FORCE=true
    reset_counters
    remove_local_files
  )

  # Files should still exist
  assert_file_exists "${project_dir}/.ai/agent/pm-instructions.md" "Files should NOT be removed in dry-run"
  assert_file_exists "${project_dir}/doc/documentation-handbook.md" "Handbook should NOT be removed in dry-run"
}

test_local_uninstall_removes_guides() {
  local project_dir
  project_dir="$(create_mock_ados_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    FORCE=true
    reset_counters
    remove_local_files
  )

  assert_file_not_exists "${project_dir}/doc/guides/change-lifecycle.md"
  assert_file_not_exists "${project_dir}/doc/guides/decision-records-management.md"
  assert_file_not_exists "${project_dir}/doc/guides/opencode-agents-and-commands-guide.md"
  assert_file_not_exists "${project_dir}/doc/guides/opencode-model-configuration.md"
  assert_file_not_exists "${project_dir}/doc/guides/tools-convention.md"
  assert_file_not_exists "${project_dir}/doc/guides/copywriting.md"
  assert_file_not_exists "${project_dir}/doc/guides/ados-tools-system-dependencies.md"
  assert_file_not_exists "${project_dir}/doc/guides/onboarding-existing-project.md"
  assert_file_not_exists "${project_dir}/doc/guides/unified-change-convention-tracker-agnostic-specification.md"
}

test_local_uninstall_removes_decision_stubs() {
  local project_dir
  project_dir="$(create_mock_ados_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    FORCE=true
    reset_counters
    remove_local_files
  )

  # README is redistributable -> removed; 00-index.md is `project-generated`
  # (regenerated per-repo per GH-63) -> PRESERVED by marker-driven uninstall.
  assert_file_not_exists "${project_dir}/doc/decisions/README.md"
  assert_file_exists "${project_dir}/doc/decisions/00-index.md" "project-generated decisions/00-index.md must be preserved"
}

test_local_uninstall_marker_driven_preservation() {
  # PR #74 review C1: marker-driven removal removes ONLY redistributable-marked
  # files; internal / project-generated / unmarked files are left in place.
  local project_dir
  project_dir="$(create_mock_ados_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    FORCE=true
    reset_counters
    remove_local_files
  )

  # Redistributable files ARE removed (guides, flat templates, recursive
  # blueprint + yaml, standalone docs).
  assert_file_not_exists "${project_dir}/doc/guides/copywriting.md"        "redistributable guide removed"
  assert_file_not_exists "${project_dir}/doc/templates/change-spec-template.md" "redistributable template removed"
  assert_file_not_exists "${project_dir}/doc/templates/blueprints/code-review-instructions--example.md" "recursive blueprint removed"
  assert_file_not_exists "${project_dir}/doc/templates/register-template.yaml" "yaml register removed"
  assert_file_not_exists "${project_dir}/doc/documentation-handbook.md"    "redistributable standalone removed"
  assert_file_not_exists "${project_dir}/.ai/rules/README.md"             "redistributable standalone removed"

  # Non-redistributable files are PRESERVED.
  assert_file_exists "${project_dir}/doc/guides/adding-tool-support.md"    "internal guide must be preserved"
  assert_file_exists "${project_dir}/doc/decisions/00-index.md"           "project-generated doc must be preserved"

  # User-created project files are untouched.
  assert_file_exists "${project_dir}/.ai/agent/pm-instructions.md"        "pm-instructions must be preserved"
}

test_local_uninstall_removes_rules_index() {
  local project_dir
  project_dir="$(create_mock_ados_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    FORCE=true
    reset_counters
    remove_local_files
  )

  assert_file_not_exists "${project_dir}/.ai/rules/README.md"
}

test_local_uninstall_removes_empty_rules_dir() {
  local project_dir="${_test_tmpdir}/project"
  mkdir -p "${project_dir}/.git"
  mkdir -p "${project_dir}/.ai/rules"
  # Marker-driven removal only takes redistributable-marked files, so the fixture
  # must carry the marker for the dir to end up empty.
  printf -- '---\nados_distribution: redistributable\n---\n# AI Rules\n' > "${project_dir}/.ai/rules/README.md"

  (
    cd "${project_dir}"
    FORCE=true
    reset_counters
    remove_local_files
  )

  assert_dir_not_exists "${project_dir}/.ai/rules" "Empty rules dir should be removed"
}

# ============================================================================
# BEHAVIOR TESTS — CLI
# ============================================================================

test_help_flag() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/uninstall.sh" --help 2>&1)" || exit_code=$?
  assert_exit_code 0 "${exit_code}" "Help should succeed"
  assert_contains "${stdout}" "Usage:" "Should show usage"
  assert_contains "${stdout}" "--global" "Should mention global"
  assert_contains "${stdout}" "--local" "Should mention local"
}

test_version_flag() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/uninstall.sh" --version 2>&1)" || exit_code=$?
  assert_exit_code 0 "${exit_code}" "Version should succeed"
  assert_contains "${stdout}" "ados-uninstall" "Should show app name"
  assert_contains "${stdout}" "2.0.0" "Should show version"
}

test_unknown_option() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/uninstall.sh" --bogus 2>&1)" || exit_code=$?
  assert_exit_code 2 "${exit_code}" "Unknown option should exit 2"
}

test_no_mode_specified() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/uninstall.sh" 2>&1)" || exit_code=$?
  assert_exit_code 2 "${exit_code}" "Should fail without mode"
  assert_contains "${stdout}" "Must specify --global or --local" "Should explain requirement"
}

test_local_requires_git_dir() {
  local project_dir="${_test_tmpdir}/no-git-project"
  mkdir -p "${project_dir}"

  local stdout exit_code=0
  stdout="$(
    cd "${project_dir}" && \
    FORCE=true \
    "${SCRIPT_DIR}/uninstall.sh" --local 2>&1
  )" || exit_code=$?

  assert_exit_code 2 "${exit_code}" "Should fail without .git directory"
  assert_contains "${stdout}" "Not a project root" "Should mention missing .git"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  # Unit tests
  run_test "reset_counters zeros all counters" test_reset_counters

  # remove_file tests
  run_test "remove_file removes existing file" test_remove_file_exists
  run_test "remove_file skips nonexistent file" test_remove_file_not_exists
  run_test "remove_file removes symlink" test_remove_file_symlink
  run_test "remove_file respects dry-run" test_remove_file_dry_run

  # safe_rmdir tests
  run_test "safe_rmdir removes directory" test_safe_rmdir_exists
  run_test "safe_rmdir handles nonexistent dir" test_safe_rmdir_not_exists
  run_test "safe_rmdir refuses empty path" test_safe_rmdir_refuses_empty
  run_test "safe_rmdir refuses root path" test_safe_rmdir_refuses_root
  run_test "safe_rmdir respects dry-run" test_safe_rmdir_dry_run
  run_test "safe_rmdir refuses HOME with trailing slash" test_safe_rmdir_refuses_trailing_slash_home
  run_test "safe_rmdir refuses HOME with dot suffix" test_safe_rmdir_refuses_dot_suffix_home
  run_test "safe_rmdir refuses shallow path" test_safe_rmdir_refuses_shallow_path

  # Global uninstall tests
  run_test "global uninstall removes agent files" test_global_uninstall_removes_agents
  run_test "global uninstall removes command files" test_global_uninstall_removes_commands
  run_test "global uninstall removes ADOS home" test_global_uninstall_removes_ados_home

  # Local uninstall tests
  run_test "local uninstall removes ADOS files" test_local_uninstall_removes_files
  run_test "local uninstall removes empty directories" test_local_uninstall_removes_empty_dirs
  run_test "local uninstall keeps non-empty directories" test_local_uninstall_keeps_nonempty_dirs
  run_test "local uninstall respects dry-run" test_local_uninstall_dry_run
  run_test "local uninstall removes guide files" test_local_uninstall_removes_guides
  run_test "local uninstall removes decision stubs" test_local_uninstall_removes_decision_stubs
  run_test "local uninstall marker-driven preservation" test_local_uninstall_marker_driven_preservation
  run_test "local uninstall removes rules index" test_local_uninstall_removes_rules_index
  run_test "local uninstall removes empty rules dir" test_local_uninstall_removes_empty_rules_dir

  # CLI behavior tests
  run_test "--help shows usage" test_help_flag
  run_test "--version shows version" test_version_flag
  run_test "unknown option exits with code 2" test_unknown_option
  run_test "no mode specified exits with code 2" test_no_mode_specified
  run_test "local uninstall requires .git directory" test_local_requires_git_dir

  print_summary
}

main "$@"
