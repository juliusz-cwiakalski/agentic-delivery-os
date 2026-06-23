#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/scripts/.tests/test-install.sh
# test-install.sh — Tests for install.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-install)"
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

  local _rc=0
  ( set -e; "${func}" ) || _rc=$?

  if [[ ${_rc} -eq 0 ]]; then
    _test_passed=$((_test_passed + 1))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    _test_failed=$((_test_failed + 1))
    printf '%s[FAIL]%s %s (exit %d)\n' "${_RED}" "${_RESET}" "${name}" "${_rc}" >&2
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

assert_dir_exists() {
  local -r path="$1" msg="${2:-}"
  if [[ ! -d "${path}" ]]; then
    printf '  Directory does not exist: %s\n' "${path}" >&2
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
source "${SCRIPT_DIR}/install.sh"

# ============================================================================
# TEST FIXTURES
# ============================================================================

# Create a mock ADOS source directory with minimal structure
create_mock_ados_source() {
  local -r base="$1"
  mkdir -p "${base}/.opencode/agent" "${base}/.opencode/command"
  mkdir -p "${base}/.ai/agent" "${base}/.ai/rules"
  mkdir -p "${base}/doc/templates" "${base}/doc/guides"
  mkdir -p "${base}/doc/decisions"

  # Agent files
  printf '# pm agent\n' > "${base}/.opencode/agent/pm.md"
  printf '# coder agent\n' > "${base}/.opencode/agent/coder.md"
  printf '# reviewer agent\n' > "${base}/.opencode/agent/reviewer.md"

  # Command files
  printf '# run-plan command\n' > "${base}/.opencode/command/run-plan.md"
  printf '# commit command\n' > "${base}/.opencode/command/commit.md"

  # Local install artifacts — project-specific
  printf '# PM Instructions\n' > "${base}/.ai/agent/pm-instructions.md"

  # Local install artifacts — updatable files
  printf '# Documentation Handbook\n' > "${base}/doc/documentation-handbook.md"
  printf '# Doc Index\n' > "${base}/doc/00-index.md"

  # Guide files (9 guides)
  printf '# Change Lifecycle\n' > "${base}/doc/guides/change-lifecycle.md"
  printf '# Unified Change Convention\n' > "${base}/doc/guides/unified-change-convention-tracker-agnostic-specification.md"
  printf '# Decision Records Management\n' > "${base}/doc/guides/decision-records-management.md"
  printf '# Opencode Agents and Commands Guide\n' > "${base}/doc/guides/opencode-agents-and-commands-guide.md"
  printf '# Opencode Model Configuration\n' > "${base}/doc/guides/opencode-model-configuration.md"
  printf '# Tools Convention\n' > "${base}/doc/guides/tools-convention.md"
  printf '# Copywriting\n' > "${base}/doc/guides/copywriting.md"
  printf '# System Dependencies\n' > "${base}/doc/guides/system-dependencies.md"
  printf '# Onboarding Existing Project\n' > "${base}/doc/guides/onboarding-existing-project.md"

  # Decision stubs
  printf '# Decisions README\n' > "${base}/doc/decisions/README.md"
  printf '# Decisions Index\n' > "${base}/doc/decisions/00-index.md"

  # AI rules index
  printf '# AI Rules Index\n' > "${base}/.ai/rules/README.md"

  # Template files
  printf '# Change Spec Template\n' > "${base}/doc/templates/change-spec-template.md"
  printf '# Feature Spec Template\n' > "${base}/doc/templates/feature-spec-template.md"

  printf '%s' "${base}"
}

# Create a mock project directory
create_mock_project() {
  local -r base="$1"
  mkdir -p "${base}/.git"  # Fake .git dir
  printf '%s' "${base}"
}

# ============================================================================
# UNIT TESTS — Pure functions
# ============================================================================

test_file_contains_line_found() {
  local test_file="${_test_tmpdir}/test.txt"
  printf '.ai/local/\ntmp/\n' > "${test_file}"
  file_contains_line "${test_file}" ".ai/local/"
}

test_file_contains_line_not_found() {
  local test_file="${_test_tmpdir}/test.txt"
  printf 'tmp/\nnode_modules/\n' > "${test_file}"
  ! file_contains_line "${test_file}" ".ai/local/"
}

test_file_contains_line_missing_file() {
  ! file_contains_line "${_test_tmpdir}/nonexistent.txt" "anything"
}

test_reset_counters() {
  _added=5
  _updated=3
  _unchanged=2
  reset_counters
  assert_eq "0" "${_added}" "added should be reset"
  assert_eq "0" "${_updated}" "updated should be reset"
  assert_eq "0" "${_unchanged}" "unchanged should be reset"
}

# ============================================================================
# INTEGRATION TESTS — copy_file_with_diff
# ============================================================================

test_copy_file_new() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest/file.md"
  printf '# Test content\n' > "${src}"

  INSTALL_MODE="global"
  reset_counters
  copy_file_with_diff "${src}" "${dest}" "test.md"

  assert_file_exists "${dest}" "Destination file should be created"
  assert_eq "1" "${_added}" "Should count as added"

  local content
  content="$(cat "${dest}")"
  assert_eq "# Test content" "${content}" "Content should match"
}

test_copy_file_identical() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# Same content\n' > "${src}"
  printf '# Same content\n' > "${dest}"

  INSTALL_MODE="global"
  reset_counters
  copy_file_with_diff "${src}" "${dest}" "test.md"

  assert_eq "0" "${_added}" "Should not count as added"
  assert_eq "0" "${_updated}" "Should not count as updated"
  assert_eq "1" "${_unchanged}" "Should count as unchanged"
}

test_copy_file_different_global() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# New content\n' > "${src}"
  printf '# Old content\n' > "${dest}"

  INSTALL_MODE="global"
  reset_counters
  copy_file_with_diff "${src}" "${dest}" "test.md"

  assert_eq "1" "${_updated}" "Should count as updated in global mode"

  local content
  content="$(cat "${dest}")"
  assert_eq "# New content" "${content}" "Content should be updated"
}

test_copy_file_different_local_no_force() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# New content\n' > "${src}"
  printf '# Old content\n' > "${dest}"

  INSTALL_MODE="local"
  FORCE=false
  reset_counters
  copy_file_with_diff "${src}" "${dest}" "test.md"

  assert_eq "0" "${_updated}" "Should NOT update in local mode without force"
  assert_eq "1" "${_unchanged}" "Should count as unchanged"

  local content
  content="$(cat "${dest}")"
  assert_eq "# Old content" "${content}" "Content should NOT be updated"
}

test_copy_file_different_local_force() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# New content\n' > "${src}"
  printf '# Old content\n' > "${dest}"

  INSTALL_MODE="local"
  FORCE=true
  reset_counters
  copy_file_with_diff "${src}" "${dest}" "test.md"

  assert_eq "1" "${_updated}" "Should update in local mode with force"

  local content
  content="$(cat "${dest}")"
  assert_eq "# New content" "${content}" "Content should be updated"
  FORCE=false
}

test_copy_file_symlink_replaced() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  local target="${_test_tmpdir}/link-target.md"
  printf '# Source content\n' > "${src}"
  printf '# Link target\n' > "${target}"
  ln -sf "${target}" "${dest}"

  INSTALL_MODE="global"
  reset_counters
  copy_file_with_diff "${src}" "${dest}" "test.md"

  assert_eq "1" "${_updated}" "Should count as updated (symlink replaced)"
  [[ ! -L "${dest}" ]] || {
    printf '  File should no longer be a symlink\n' >&2
    return 1
  }
}

test_copy_file_missing_source() {
  local dest="${_test_tmpdir}/dest.md"

  INSTALL_MODE="global"
  reset_counters
  local exit_code=0
  copy_file_with_diff "${_test_tmpdir}/nonexistent.md" "${dest}" "test.md" || exit_code=$?

  assert_eq "1" "${exit_code}" "Should return 1 for missing source"
}

test_copy_updatable_file_updates_without_force() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# Updated content\n' > "${src}"
  printf '# Old content\n' > "${dest}"

  INSTALL_MODE="local"
  FORCE=false
  reset_counters
  copy_updatable_file "${src}" "${dest}" "test.md"

  assert_eq "1" "${_updated}" "Should count as updated (updatable file)"

  local content
  content="$(cat "${dest}")"
  assert_eq "# Updated content" "${content}" "Content should be updated without --force"
}

# ============================================================================
# INTEGRATION TESTS — ensure_dir
# ============================================================================

test_ensure_dir_creates() {
  local dir="${_test_tmpdir}/new/nested/dir"
  ensure_dir "${dir}" "test-dir"
  assert_dir_exists "${dir}" "Directory should be created"
}

test_ensure_dir_exists_already() {
  local dir="${_test_tmpdir}/existing"
  mkdir -p "${dir}"
  # Should not error
  ensure_dir "${dir}" "test-dir"
  assert_dir_exists "${dir}" "Directory should still exist"
}

# ============================================================================
# INTEGRATION TESTS — ensure_gitignore_entry
# ============================================================================

test_gitignore_add_entry() {
  local gitignore="${_test_tmpdir}/.gitignore"
  printf 'node_modules/\n' > "${gitignore}"

  ensure_gitignore_entry "${gitignore}" ".ai/local/"

  local content
  content="$(cat "${gitignore}")"
  assert_contains "${content}" ".ai/local/" "Entry should be added"
  assert_contains "${content}" "node_modules/" "Existing entries preserved"
}

test_gitignore_skip_existing() {
  local gitignore="${_test_tmpdir}/.gitignore"
  printf 'node_modules/\n.ai/local/\n' > "${gitignore}"

  local original
  original="$(cat "${gitignore}")"

  ensure_gitignore_entry "${gitignore}" ".ai/local/"

  local current
  current="$(cat "${gitignore}")"
  assert_eq "${original}" "${current}" "File should not change if entry exists"
}

test_gitignore_create_new() {
  local gitignore="${_test_tmpdir}/.gitignore"

  ensure_gitignore_entry "${gitignore}" ".ai/local/"

  assert_file_exists "${gitignore}" "Gitignore should be created"
  local content
  content="$(cat "${gitignore}")"
  assert_contains "${content}" ".ai/local/" "Entry should be present"
}

test_gitignore_dry_run() {
  local gitignore="${_test_tmpdir}/.gitignore"
  printf 'tmp/\n' > "${gitignore}"

  DRY_RUN=true
  ensure_gitignore_entry "${gitignore}" ".ai/local/"
  DRY_RUN=false

  local content
  content="$(cat "${gitignore}")"
  assert_not_contains "${content}" ".ai/local/" "Entry should NOT be added in dry-run"
}

# ============================================================================
# INTEGRATION TESTS — Local install end-to-end
# ============================================================================

test_local_install_creates_structure() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local project_dir
  project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  # Run local install in the project directory
  (
    cd "${project_dir}"
    ADOS_SOURCE_DIR="${source_dir}" \
    INSTALL_MODE="local" \
    FORCE=false \
    DRY_RUN=false \
    VERBOSE=false \
    install_local_files "${source_dir}"
  )

  # Check core files were created (pm-instructions.md is NOT installed — it's user-created)
  assert_file_exists "${project_dir}/doc/documentation-handbook.md" "documentation-handbook.md"
  assert_file_exists "${project_dir}/doc/00-index.md" "00-index.md"
  assert_file_exists "${project_dir}/doc/templates/change-spec-template.md" "template file"

  # Check new updatable files were created
  assert_file_exists "${project_dir}/doc/guides/change-lifecycle.md" "change-lifecycle guide"
  assert_file_exists "${project_dir}/doc/decisions/README.md" "decisions README"
  assert_file_exists "${project_dir}/doc/decisions/00-index.md" "decisions index"
  assert_file_exists "${project_dir}/.ai/rules/README.md" "rules index"

  # Check directories were created
  assert_dir_exists "${project_dir}/doc/overview" "doc/overview"
  assert_dir_exists "${project_dir}/doc/spec/features" "doc/spec/features"
  assert_dir_exists "${project_dir}/doc/decisions" "doc/decisions"
  assert_dir_exists "${project_dir}/doc/changes" "doc/changes"
  assert_dir_exists "${project_dir}/doc/guides" "doc/guides"
  assert_dir_exists "${project_dir}/.ai/agent" ".ai/agent"
  assert_dir_exists "${project_dir}/.ai/local" ".ai/local"
  assert_dir_exists "${project_dir}/.ai/rules" ".ai/rules"
}

test_local_install_does_not_create_pm_instructions() {
  local -r source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local -r project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    INSTALL_MODE="local" \
    FORCE=false \
    DRY_RUN=false \
    VERBOSE=false \
    reset_counters
    install_local_files "${source_dir}"
  )

  # pm-instructions.md should NOT be created (it's user-created by /bootstrap)
  [[ ! -f "${project_dir}/.ai/agent/pm-instructions.md" ]] || {
    printf '  pm-instructions.md should NOT be created by install\n' >&2
    return 1
  }
  # But .ai/agent/ directory should exist (for bootstrapper to write into)
  assert_dir_exists "${project_dir}/.ai/agent" ".ai/agent dir should exist"
}

test_local_install_preserves_existing_pm_instructions() {
  local -r source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local -r project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  # Create existing pm-instructions with custom content (as if created by /bootstrap)
  mkdir -p "${project_dir}/.ai/agent"
  printf '# My custom PM config\n' > "${project_dir}/.ai/agent/pm-instructions.md"

  (
    cd "${project_dir}"
    INSTALL_MODE="local" \
    FORCE=false \
    DRY_RUN=false \
    VERBOSE=false \
    reset_counters
    install_local_files "${source_dir}"
  )

  # Existing pm-instructions.md should be untouched
  local content
  content="$(cat "${project_dir}/.ai/agent/pm-instructions.md")"
  assert_eq "# My custom PM config" "${content}" "Existing pm-instructions should be preserved"
}

test_local_install_updates_shared_files() {
  local -r source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local -r project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  # Create existing shared files with custom content
  mkdir -p "${project_dir}/doc/templates"
  printf '# My custom handbook\n' > "${project_dir}/doc/documentation-handbook.md"
  printf '# My custom template\n' > "${project_dir}/doc/templates/change-spec-template.md"

  (
    cd "${project_dir}"
    INSTALL_MODE="local" \
    FORCE=false \
    DRY_RUN=false \
    VERBOSE=false \
    reset_counters
    install_local_files "${source_dir}"
  )

  # Shared files SHOULD be updated to upstream content
  local content
  content="$(cat "${project_dir}/doc/documentation-handbook.md")"
  assert_eq "# Documentation Handbook" "${content}" "Shared handbook should be updated"

  content="$(cat "${project_dir}/doc/templates/change-spec-template.md")"
  assert_eq "# Change Spec Template" "${content}" "Shared template should be updated"
}

test_local_install_force_overwrites() {
  local -r source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local -r project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  # Create existing shared file with different content
  mkdir -p "${project_dir}/doc"
  printf '# My custom handbook\n' > "${project_dir}/doc/documentation-handbook.md"

  # Export vars so subshell inherits them
  INSTALL_MODE="local"
  FORCE=true
  DRY_RUN=false
  VERBOSE=false
  (
    cd "${project_dir}"
    reset_counters
    install_local_files "${source_dir}"
  )
  FORCE=false

  # Shared file SHOULD be overwritten with --force
  local content
  content="$(cat "${project_dir}/doc/documentation-handbook.md")"
  assert_eq "# Documentation Handbook" "${content}" "Handbook should be overwritten with --force"
}

test_local_install_gitignore_entries() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local project_dir
  project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    INSTALL_MODE="local" \
    FORCE=false \
    DRY_RUN=false \
    VERBOSE=false \
    reset_counters
    install_local_files "${source_dir}"
  )

  local content
  content="$(cat "${project_dir}/.gitignore")"
  assert_contains "${content}" ".ai/local/" "Should add .ai/local/ entry"
  assert_contains "${content}" ".ai/local" "Should add .ai/local entry"
}

# ============================================================================
# INTEGRATION TESTS — Global install file copy
# ============================================================================

test_global_install_copies_agents() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local global_dir="${_test_tmpdir}/opencode"
  mkdir -p "${global_dir}/agent" "${global_dir}/command"

  INSTALL_MODE="global"
  reset_counters

  # Override repo dir to point to our mock
  local saved_repo_dir="${ADOS_REPO_DIR}"

  # Directly test install_global_files logic by copying agent files
  local agent_file
  for agent_file in "${source_dir}/.opencode/agent"/*.md; do
    [[ -f "${agent_file}" ]] || continue
    local name
    name="$(basename "${agent_file}")"
    copy_file_with_diff "${agent_file}" "${global_dir}/agent/${name}" "agent/${name}"
  done

  assert_file_exists "${global_dir}/agent/pm.md" "pm.md should be installed"
  assert_file_exists "${global_dir}/agent/coder.md" "coder.md should be installed"
  assert_file_exists "${global_dir}/agent/reviewer.md" "reviewer.md should be installed"
  assert_eq "3" "${_added}" "Should have added 3 agent files"
}

test_global_install_updates_changed() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local global_dir="${_test_tmpdir}/opencode"
  mkdir -p "${global_dir}/agent"

  # Pre-existing but different file
  printf '# old pm agent\n' > "${global_dir}/agent/pm.md"

  INSTALL_MODE="global"
  reset_counters

  copy_file_with_diff \
    "${source_dir}/.opencode/agent/pm.md" \
    "${global_dir}/agent/pm.md" \
    "agent/pm.md"

  assert_eq "1" "${_updated}" "Should count as updated"

  local content
  content="$(cat "${global_dir}/agent/pm.md")"
  assert_eq "# pm agent" "${content}" "Content should be updated"
}

# ============================================================================
# BEHAVIOR TESTS — CLI and dry-run
# ============================================================================

test_help_flag() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/install.sh" --help 2>&1)" || exit_code=$?
  assert_exit_code 0 "${exit_code}" "Help should succeed"
  assert_contains "${stdout}" "Usage:" "Should show usage"
  assert_contains "${stdout}" "--global" "Should mention global mode"
  assert_contains "${stdout}" "--local" "Should mention local mode"
}

test_version_flag() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/install.sh" --version 2>&1)" || exit_code=$?
  assert_exit_code 0 "${exit_code}" "Version should succeed"
  assert_contains "${stdout}" "ados-install" "Should show app name"
  assert_contains "${stdout}" "2.0.0" "Should show version"
}

test_unknown_option() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/install.sh" --bogus 2>&1)" || exit_code=$?
  assert_exit_code 2 "${exit_code}" "Unknown option should exit 2"
}

test_local_dry_run() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local project_dir
  project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  local stdout exit_code=0
  stdout="$(
    cd "${project_dir}" && \
    ADOS_SOURCE_DIR="${source_dir}" \
    "${SCRIPT_DIR}/install.sh" --local --dry-run 2>&1
  )" || exit_code=$?

  assert_exit_code 0 "${exit_code}" "Dry-run should succeed"
  assert_contains "${stdout}" "DRY-RUN" "Output should contain DRY-RUN"

  # No files should have been created
  [[ ! -f "${project_dir}/doc/documentation-handbook.md" ]] || {
    printf '  File should not exist in dry-run mode\n' >&2
    return 1
  }
}

test_local_requires_git_dir() {
  local project_dir="${_test_tmpdir}/no-git-project"
  mkdir -p "${project_dir}"

  local stdout exit_code=0
  stdout="$(
    cd "${project_dir}" && \
    ADOS_SOURCE_DIR="${_test_tmpdir}" \
    "${SCRIPT_DIR}/install.sh" --local 2>&1
  )" || exit_code=$?

  assert_exit_code 2 "${exit_code}" "Should fail without .git directory"
  assert_contains "${stdout}" "Not a project root" "Should mention missing .git"
}

# ============================================================================
# INTEGRATION TESTS — New file installation (guides, decisions, rules)
# ============================================================================

test_local_install_creates_guides() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local project_dir
  project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    INSTALL_MODE="local" FORCE=false DRY_RUN=false VERBOSE=false
    reset_counters
    install_local_files "${source_dir}"
  )

  # Check all 9 guide files were created
  assert_file_exists "${project_dir}/doc/guides/change-lifecycle.md"
  assert_file_exists "${project_dir}/doc/guides/unified-change-convention-tracker-agnostic-specification.md"
  assert_file_exists "${project_dir}/doc/guides/decision-records-management.md"
  assert_file_exists "${project_dir}/doc/guides/opencode-agents-and-commands-guide.md"
  assert_file_exists "${project_dir}/doc/guides/opencode-model-configuration.md"
  assert_file_exists "${project_dir}/doc/guides/tools-convention.md"
  assert_file_exists "${project_dir}/doc/guides/copywriting.md"
  assert_file_exists "${project_dir}/doc/guides/system-dependencies.md"
  assert_file_exists "${project_dir}/doc/guides/onboarding-existing-project.md"
}

test_local_install_creates_decision_stubs() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local project_dir
  project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    INSTALL_MODE="local" FORCE=false DRY_RUN=false VERBOSE=false
    reset_counters
    install_local_files "${source_dir}"
  )

  assert_file_exists "${project_dir}/doc/decisions/README.md"
  assert_file_exists "${project_dir}/doc/decisions/00-index.md"
}

test_local_install_creates_rules_index() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local project_dir
  project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  (
    cd "${project_dir}"
    INSTALL_MODE="local" FORCE=false DRY_RUN=false VERBOSE=false
    reset_counters
    install_local_files "${source_dir}"
  )

  assert_dir_exists "${project_dir}/.ai/rules"
  assert_file_exists "${project_dir}/.ai/rules/README.md"
}

test_local_install_updates_guides() {
  local source_dir
  source_dir="$(create_mock_ados_source "${_test_tmpdir}/ados-source")"
  local project_dir
  project_dir="$(create_mock_project "${_test_tmpdir}/project")"

  # Create project with old guide content
  mkdir -p "${project_dir}/doc/guides"
  printf '# Old Lifecycle\n' > "${project_dir}/doc/guides/change-lifecycle.md"
  printf '# Old Copywriting\n' > "${project_dir}/doc/guides/copywriting.md"

  (
    cd "${project_dir}"
    INSTALL_MODE="local" FORCE=false DRY_RUN=false VERBOSE=false
    reset_counters
    install_local_files "${source_dir}"
  )

  # Guides are updatable — should be updated to upstream content
  local content
  content="$(cat "${project_dir}/doc/guides/change-lifecycle.md")"
  assert_eq "# Change Lifecycle" "${content}" "Guide should be updated to upstream"

  content="$(cat "${project_dir}/doc/guides/copywriting.md")"
  assert_eq "# Copywriting" "${content}" "Guide should be updated to upstream"
}

# ============================================================================
# INTEGRATION TESTS — Interactive mode
# ============================================================================

test_interactive_flag_parsed() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/install.sh" --help 2>&1)" || exit_code=$?
  assert_exit_code 0 "${exit_code}"
  assert_contains "${stdout}" "--interactive" "Should document interactive flag"
}

test_no_fetch_flag_parsed() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/install.sh" --help 2>&1)" || exit_code=$?
  assert_exit_code 0 "${exit_code}"
  assert_contains "${stdout}" "--no-fetch" "Should document no-fetch flag"
}

test_prompt_diff_overwrite_accept() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# New content\n' > "${src}"
  printf '# Old content\n' > "${dest}"

  # Simulate "y" answer
  local result=0
  printf 'y\n' | prompt_diff_overwrite "${src}" "${dest}" "test.md" || result=$?
  assert_eq "0" "${result}" "Should return 0 on 'y'"
}

test_prompt_diff_overwrite_reject() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# New content\n' > "${src}"
  printf '# Old content\n' > "${dest}"

  local result=0
  printf 'n\n' | prompt_diff_overwrite "${src}" "${dest}" "test.md" || result=$?
  assert_eq "1" "${result}" "Should return 1 on 'n'"
}

test_interactive_mode_with_accept() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# New content\n' > "${src}"
  printf '# Old content\n' > "${dest}"

  INSTALL_MODE="local"
  FORCE=false
  INTERACTIVE=true
  reset_counters

  # Pipe "y" to simulate user acceptance
  printf 'y\n' | copy_file_with_diff "${src}" "${dest}" "test.md"

  assert_eq "1" "${_updated}" "Should count as updated"
  local content
  content="$(cat "${dest}")"
  assert_eq "# New content" "${content}" "Content should be updated"
  INTERACTIVE=false
}

test_interactive_mode_with_reject() {
  local src="${_test_tmpdir}/src.md"
  local dest="${_test_tmpdir}/dest.md"
  printf '# New content\n' > "${src}"
  printf '# Old content\n' > "${dest}"

  INSTALL_MODE="local"
  FORCE=false
  INTERACTIVE=true
  reset_counters

  printf 'n\n' | copy_file_with_diff "${src}" "${dest}" "test.md"

  assert_eq "1" "${_unchanged}" "Should count as unchanged"
  local content
  content="$(cat "${dest}")"
  assert_eq "# Old content" "${content}" "Content should NOT be updated"
  INTERACTIVE=false
}

# ============================================================================
# INTEGRATION TESTS — Auto-fetch
# ============================================================================

test_auto_fetch_skips_with_no_fetch() {
  local source_dir="${_test_tmpdir}/source"
  mkdir -p "${source_dir}/.git"

  NO_FETCH=true
  VERBOSE=true
  local output
  output="$(auto_fetch_source "${source_dir}" 2>&1)"
  NO_FETCH=false
  VERBOSE=false

  assert_contains "${output}" "no-fetch" "Should mention --no-fetch in skip message"
}

test_auto_fetch_skips_explicit_source() {
  local source_dir="${_test_tmpdir}/source"
  mkdir -p "${source_dir}"

  local saved="${ADOS_SOURCE_DIR:-}"
  ADOS_SOURCE_DIR="${source_dir}"
  VERBOSE=true
  local output
  output="$(auto_fetch_source "${source_dir}" 2>&1)"
  VERBOSE=false
  if [[ -n "${saved}" ]]; then
    ADOS_SOURCE_DIR="${saved}"
  else
    unset ADOS_SOURCE_DIR
  fi

  assert_contains "${output}" "ADOS_SOURCE_DIR" "Should mention ADOS_SOURCE_DIR in skip message"
}

# ============================================================================
# --TOOL FLAG TESTS
# ============================================================================

test_tool_opencode_flag() {
  # Reset TOOL to default before test
  TOOL="opencode"
  
  parse_args --tool opencode
  assert_eq "opencode" "${TOOL}" "TOOL should be opencode"
}

test_tool_claude_flag() {
  # Reset TOOL to default before test
  TOOL="opencode"
  
  parse_args --tool claude
  assert_eq "claude" "${TOOL}" "TOOL should be claude"
}

test_tool_all_flag() {
  # Reset TOOL to default before test
  TOOL="opencode"
  
  parse_args --tool all
  assert_eq "all" "${TOOL}" "TOOL should be all"
}

test_tool_invalid_flag() {
  # Reset TOOL to default before test
  TOOL="opencode"
  
  local exit_code=0
  # parse_args calls die() on invalid tool, which exits
  (parse_args --tool invalid 2>/dev/null) || exit_code=$?
  
  # Should exit with error code 2 (usage error from die())
  assert_exit_code "${EXIT_USAGE}" "${exit_code}" "Should exit with usage error for invalid tool"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  # Unit tests
  run_test "file_contains_line finds existing entry" test_file_contains_line_found
  run_test "file_contains_line returns false for missing entry" test_file_contains_line_not_found
  run_test "file_contains_line handles missing file" test_file_contains_line_missing_file
  run_test "reset_counters zeros all counters" test_reset_counters

  # copy_file_with_diff tests
  run_test "copy_file_with_diff creates new file" test_copy_file_new
  run_test "copy_file_with_diff skips identical file" test_copy_file_identical
  run_test "copy_file_with_diff updates in global mode" test_copy_file_different_global
  run_test "copy_file_with_diff skips in local mode without force" test_copy_file_different_local_no_force
  run_test "copy_file_with_diff overwrites in local mode with force" test_copy_file_different_local_force
  run_test "copy_file_with_diff replaces symlink" test_copy_file_symlink_replaced
  run_test "copy_file_with_diff handles missing source" test_copy_file_missing_source
  run_test "copy_updatable_file updates without --force" test_copy_updatable_file_updates_without_force

  # ensure_dir tests
  run_test "ensure_dir creates new directory" test_ensure_dir_creates
  run_test "ensure_dir handles existing directory" test_ensure_dir_exists_already

  # gitignore tests
  run_test "ensure_gitignore_entry adds new entry" test_gitignore_add_entry
  run_test "ensure_gitignore_entry skips existing" test_gitignore_skip_existing
  run_test "ensure_gitignore_entry creates new file" test_gitignore_create_new
  run_test "ensure_gitignore_entry respects dry-run" test_gitignore_dry_run

  # Local install integration
  run_test "local install creates full directory structure" test_local_install_creates_structure
  run_test "local install does not create pm-instructions.md" test_local_install_does_not_create_pm_instructions
  run_test "local install preserves existing pm-instructions.md" test_local_install_preserves_existing_pm_instructions
  run_test "local install updates shared files" test_local_install_updates_shared_files
  run_test "local install with --force overwrites" test_local_install_force_overwrites
  run_test "local install adds .gitignore entries" test_local_install_gitignore_entries

  # New file installation tests
  run_test "local install creates guide files" test_local_install_creates_guides
  run_test "local install creates decision stubs" test_local_install_creates_decision_stubs
  run_test "local install creates rules index" test_local_install_creates_rules_index
  run_test "local install updates guides (updatable)" test_local_install_updates_guides

  # Global install integration
  run_test "global install copies agent files" test_global_install_copies_agents
  run_test "global install updates changed files" test_global_install_updates_changed

  # Behavior tests
  run_test "--help shows usage" test_help_flag
  run_test "--version shows version" test_version_flag
  run_test "unknown option exits with code 2" test_unknown_option
  run_test "local --dry-run doesn't create files" test_local_dry_run
  run_test "local install requires .git directory" test_local_requires_git_dir

  # Interactive mode tests
  run_test "help mentions --interactive flag" test_interactive_flag_parsed
  run_test "help mentions --no-fetch flag" test_no_fetch_flag_parsed
  run_test "prompt_diff_overwrite accepts on 'y'" test_prompt_diff_overwrite_accept
  run_test "prompt_diff_overwrite rejects on 'n'" test_prompt_diff_overwrite_reject
  run_test "interactive mode with accept updates file" test_interactive_mode_with_accept
  run_test "interactive mode with reject preserves file" test_interactive_mode_with_reject

  # Auto-fetch tests
  run_test "auto-fetch skips with --no-fetch" test_auto_fetch_skips_with_no_fetch
  run_test "auto-fetch skips with explicit ADOS_SOURCE_DIR" test_auto_fetch_skips_explicit_source

  # --tool flag tests
  run_test "--tool opencode sets TOOL variable" test_tool_opencode_flag
  run_test "--tool claude sets TOOL variable" test_tool_claude_flag
  run_test "--tool all sets TOOL variable" test_tool_all_flag
  run_test "invalid --tool value shows error" test_tool_invalid_flag

  print_summary
}

main "$@"
