#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/scripts/.tests/test-build-claude-plugin.sh
# test-build-claude-plugin.sh — Tests for build-claude-plugin.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-build-claude-plugin)"
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
  if [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]]; then
    rm -rf "${_test_tmpdir}"
  fi
  return 0
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
# SCRIPT_DIR is the scripts/ directory
# BASH_SOURCE[0] is this test file in scripts/.tests/, so we need to go up one level
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="$(cd "${TEST_DIR}/.." && pwd)"
# Build script path for integration tests
BUILD_SCRIPT="${SCRIPT_DIR}/build-claude-plugin.sh"
# shellcheck source=/dev/null
source "${BUILD_SCRIPT}"

# ============================================================================
# TEST FIXTURES
# ============================================================================

# Create a minimal .opencode structure for testing
create_minimal_opencode_source() {
  local -r base="$1"
  mkdir -p "${base}/.opencode/agent" "${base}/.opencode/command"

  # Agent without claude: frontmatter (should get default model)
  cat > "${base}/.opencode/agent/test-agent-no-claude.md" <<'EOF'
---
description: Agent without claude model
mode: all
---
# Test Agent

This agent has no claude model specified.
EOF

  # Agent with claude.model specified
  cat > "${base}/.opencode/agent/test-agent-with-claude.md" <<'EOF'
---
description: Agent with claude model
mode: all
claude:
  model: opus
---
# Test Agent with Claude

This agent has claude.model set to opus.
EOF

  # Command without claude: frontmatter
  cat > "${base}/.opencode/command/test-command-no-claude.md" <<'EOF'
---
description: Command without claude model
---
# Test Command

This command has no claude model specified.
EOF

  # Command with claude.model specified
  cat > "${base}/.opencode/command/test-command-with-claude.md" <<'EOF'
---
description: Command with claude model
claude:
  model: haiku
---
# Test Command with Claude

This command has claude.model set to haiku.
EOF

  return 0
}

# ============================================================================
# UNIT TESTS — Pure functions
# ============================================================================

test_default_model_assignment() {
  local source_dir="${_test_tmpdir}/source"
  create_minimal_opencode_source "${source_dir}"

  # Extract frontmatter and check default model assignment
  local frontmatter
  frontmatter="$(extract_frontmatter "${source_dir}/.opencode/agent/test-agent-no-claude.md")"
  
  local model
  model="$(get_yaml_value "$frontmatter" "claude.model")"
  
  # Should be empty (no claude.model in source)
  assert_eq "" "${model}" "Should have no claude.model in source agent"

  # Transform and check default is applied
  local transformed
  transformed="$(transform_agent_frontmatter "${source_dir}/.opencode/agent/test-agent-no-claude.md")"
  
  assert_contains "${transformed}" "model: sonnet" "Should assign default model sonnet"
}

test_frontmatter_transformation_strips_opencode_fields() {
  local source_dir="${_test_tmpdir}/source"
  create_minimal_opencode_source "${source_dir}"

  local transformed
  transformed="$(transform_agent_frontmatter "${source_dir}/.opencode/agent/test-agent-no-claude.md")"
  
  # Should NOT contain OpenCode-specific fields
  assert_not_contains "${transformed}" "mode:" "Should strip 'mode:' field"
  
  # Should contain Claude-specific fields
  assert_contains "${transformed}" "name:" "Should have 'name:' field"
  assert_contains "${transformed}" "description:" "Should have 'description:' field"
  assert_contains "${transformed}" "model:" "Should have 'model:' field"
  assert_contains "${transformed}" "allowed-tools:" "Should have 'allowed-tools:' field"
}

test_frontmatter_transformation_preserves_claude_model() {
  local source_dir="${_test_tmpdir}/source"
  create_minimal_opencode_source "${source_dir}"

  local transformed
  transformed="$(transform_agent_frontmatter "${source_dir}/.opencode/agent/test-agent-with-claude.md")"
  
  # Should preserve the explicitly set claude.model value
  assert_contains "${transformed}" "model: opus" "Should preserve claude.model=opus"
}

test_command_to_skill_transformation() {
  local source_dir="${_test_tmpdir}/source"
  create_minimal_opencode_source "${source_dir}"

  local transformed
  transformed="$(transform_command_to_skill "${source_dir}/.opencode/command/test-command-with-claude.md")"
  
  # Should have skill frontmatter
  assert_contains "${transformed}" "name:" "Should have 'name:' field"
  assert_contains "${transformed}" "model: haiku" "Should preserve claude.model=haiku"
}

test_license_header_applied() {
  local source_dir="${_test_tmpdir}/source"
  create_minimal_opencode_source "${source_dir}"

  local transformed
  transformed="$(transform_agent_frontmatter "${source_dir}/.opencode/agent/test-agent-no-claude.md")"
  
  # Should include license header
  assert_contains "${transformed}" "Copyright (c) 2025-2026" "Should have copyright"
  assert_contains "${transformed}" "MIT License" "Should have MIT License"
  assert_contains "${transformed}" "source:" "Should have source reference"
}

test_generated_warning_applied() {
  local source_dir="${_test_tmpdir}/source"
  create_minimal_opencode_source "${source_dir}"

  local transformed_agent transformed_skill
  transformed_agent="$(transform_agent_frontmatter "${source_dir}/.opencode/agent/test-agent-no-claude.md")"
  transformed_skill="$(transform_command_to_skill "${source_dir}/.opencode/command/test-command-no-claude.md")"

  assert_contains "${transformed_agent}" "GENERATED FILE — DO NOT EDIT DIRECTLY" "Agent should warn that it is generated"
  assert_contains "${transformed_agent}" "Source of truth: .opencode/agent/test-agent-no-claude.md" "Agent should identify source file"
  assert_contains "${transformed_agent}" "Regenerate with: scripts/build-claude-plugin.sh" "Agent should identify regeneration command"

  assert_contains "${transformed_skill}" "GENERATED FILE — DO NOT EDIT DIRECTLY" "Skill should warn that it is generated"
  assert_contains "${transformed_skill}" "Source of truth: .opencode/command/test-command-no-claude.md" "Skill should identify source file"
  assert_contains "${transformed_skill}" "Regenerate with: scripts/build-claude-plugin.sh" "Skill should identify regeneration command"
}

# ============================================================================
# INTEGRATION TESTS — Build functions
# ============================================================================

test_build_creates_output_structure() {
  local source_dir="${_test_tmpdir}/source"
  local output_dir="${_test_tmpdir}/.ados-claude"
  
  create_minimal_opencode_source "${source_dir}"
  
  # Call build with explicit paths (no cd needed)
  build_plugin "claude" "${source_dir}/.opencode" "${output_dir}"
  
  # Check output directories exist
  assert_dir_exists "${output_dir}/agents" "Should create agents/ directory"
  assert_dir_exists "${output_dir}/skills" "Should create skills/ directory"
  assert_dir_exists "${output_dir}/.claude-plugin" "Should create .claude-plugin/ directory"
  
  # Check manifest exists
  assert_file_exists "${output_dir}/.claude-plugin/plugin.json" "Should create plugin.json"
}

test_build_creates_agent_files() {
  local source_dir="${_test_tmpdir}/source"
  local output_dir="${_test_tmpdir}/.ados-claude"
  
  create_minimal_opencode_source "${source_dir}"
  
  build_plugin "claude" "${source_dir}/.opencode" "${output_dir}"
  
  # Should create agent files
  assert_file_exists "${output_dir}/agents/test-agent-no-claude.md" "Should create agent file"
  assert_file_exists "${output_dir}/agents/test-agent-with-claude.md" "Should create agent file"
  
  # Check content
  local agent_content
  agent_content="$(cat "${output_dir}/agents/test-agent-no-claude.md")"
  assert_contains "${agent_content}" "model: sonnet" "Agent should have default model"
  assert_contains "${agent_content}" "Test Agent" "Should preserve body content"
}

test_build_creates_skill_files() {
  local source_dir="${_test_tmpdir}/source"
  local output_dir="${_test_tmpdir}/.ados-claude"
  
  create_minimal_opencode_source "${source_dir}"
  
  build_plugin "claude" "${source_dir}/.opencode" "${output_dir}"
  
  # Should create skill directories and files
  assert_dir_exists "${output_dir}/skills/test-command-no-claude" "Should create skill directory"
  assert_file_exists "${output_dir}/skills/test-command-no-claude/SKILL.md" "Should create SKILL.md"
  assert_file_exists "${output_dir}/skills/test-command-with-claude/SKILL.md" "Should create SKILL.md"
  
  # Check content
  local skill_content
  skill_content="$(cat "${output_dir}/skills/test-command-with-claude/SKILL.md")"
  assert_contains "${skill_content}" "model: haiku" "Skill should have specified model"
  assert_contains "${skill_content}" "Test Command with Claude" "Should preserve body content"
}

test_idempotency() {
  local source_dir="${_test_tmpdir}/source"
  local output_dir="${_test_tmpdir}/.ados-claude"
  
  create_minimal_opencode_source "${source_dir}"
  
  # Build first time
  build_plugin "claude" "${source_dir}/.opencode" "${output_dir}"
  
  # Capture first build
  local first_build_agent checksum1
  first_build_agent="$(cat "${output_dir}/agents/test-agent-no-claude.md")"
  checksum1="$(echo "${first_build_agent}" | sha256sum | cut -d' ' -f1)"
  
  # Build second time
  build_plugin "claude" "${source_dir}/.opencode" "${output_dir}"
  
  # Capture second build
  local second_build_agent checksum2
  second_build_agent="$(cat "${output_dir}/agents/test-agent-no-claude.md")"
  checksum2="$(echo "${second_build_agent}" | sha256sum | cut -d' ' -f1)"
  
  # Should be identical
  assert_eq "${checksum1}" "${checksum2}" "Output should be identical on second run"
}

test_build_removes_existing_output() {
  local source_dir="${_test_tmpdir}/source"
  local output_dir="${_test_tmpdir}/.ados-claude"
  
  create_minimal_opencode_source "${source_dir}"
  
  # Create a stale file in output directory
  mkdir -p "${output_dir}/agents"
  echo "stale content" > "${output_dir}/agents/stale-agent.md"
  
  # Build should remove stale files
  build_plugin "claude" "${source_dir}/.opencode" "${output_dir}"
  
  # Stale file should be gone
  if [[ -f "${output_dir}/agents/stale-agent.md" ]]; then
    printf '  Stale file should have been removed\n' >&2
    return 1
  fi
  
  return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"
  
  run_test "default model assignment" test_default_model_assignment
  run_test "frontmatter transformation strips OpenCode fields" test_frontmatter_transformation_strips_opencode_fields
  run_test "frontmatter transformation preserves claude model" test_frontmatter_transformation_preserves_claude_model
  run_test "command to skill transformation" test_command_to_skill_transformation
  run_test "license header applied" test_license_header_applied
  run_test "generated warning applied" test_generated_warning_applied
  run_test "build creates output structure" test_build_creates_output_structure
  run_test "build creates agent files" test_build_creates_agent_files
  run_test "build creates skill files" test_build_creates_skill_files
  run_test "idempotency - running twice produces same output" test_idempotency
  run_test "build removes existing output" test_build_removes_existing_output
  
  # Run behavior tests separately (not sourced)
  printf '%s Running behavior tests...\n' "${TEST_TAG}"
  
  # --help flag test
  local help_output help_exit=0
  help_output="$(bash "${BUILD_SCRIPT}" --help 2>&1)" || help_exit=$?
  if [[ ${help_exit} -eq 0 ]] && [[ "${help_output}" == *"Usage:"* ]] && [[ "${help_output}" == *"Generate Claude Code plugin"* ]]; then
    printf '%s[PASS]%s --help flag\n' "${_GREEN}" "${_RESET}"
    _test_passed=$((_test_passed + 1))
  else
    printf '%s[FAIL]%s --help flag\n' "${_RED}" "${_RESET}" >&2
    if [[ ${help_exit} -ne 0 ]]; then
      printf '  Expected exit code: 0\n  Actual exit code:   %s\n' "${help_exit}" >&2
      printf '  Script path: %s/build-claude-plugin.sh\n' "${SCRIPT_DIR}" >&2
      printf '  File exists: %s\n' "$(ls -la "${SCRIPT_DIR}/build-claude-plugin.sh" 2>&1 || echo "NO")" >&2
    fi
    if [[ "${help_output}" != *"Usage:"* ]]; then
      printf '  Output should contain: Usage:\n' >&2
      printf '  Actual output:\n%s\n' "${help_output}" >&2
    fi
    _test_failed=$((_test_failed + 1))
  fi
  _test_count=$((_test_count + 1))
  
  # --dry-run flag test
  local dryrun_exit=0
  local dryrun_output
  dryrun_output="$(bash "${BUILD_SCRIPT}" --dry-run --verbose 2>&1)" || dryrun_exit=$?
  if [[ ${dryrun_exit} -eq 0 ]] && [[ "${dryrun_output}" == *"DRY RUN"* ]]; then
    printf '%s[PASS]%s --dry-run flag\n' "${_GREEN}" "${_RESET}"
    _test_passed=$((_test_passed + 1))
  else
    printf '%s[FAIL]%s --dry-run flag\n' "${_RED}" "${_RESET}" >&2
    if [[ ${dryrun_exit} -ne 0 ]]; then
      printf '  Expected exit code: 0\n  Actual exit code:   %s\n' "${dryrun_exit}" >&2
    fi
    if [[ "${dryrun_output}" != *"DRY RUN"* ]]; then
      printf '  Output should contain: DRY RUN\n' >&2
    fi
    _test_failed=$((_test_failed + 1))
  fi
  _test_count=$((_test_count + 1))
  
  print_summary
}

main "$@"
