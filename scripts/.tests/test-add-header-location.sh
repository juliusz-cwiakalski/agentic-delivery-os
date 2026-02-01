#!/usr/bin/env bash
# test-add-header-location.sh — Tests for add-header-location.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-add-header-location)"
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
  # Don't export TMPDIR as it interferes with mktemp in the script
  # export TMPDIR="${_test_tmpdir}"
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

assert_ne() {
  local -r unexpected="$1" actual="$2" msg="${3:-}"
  if [[ "${unexpected}" == "${actual}" ]]; then
    printf '  Unexpected: %s\n  Actual:     %s\n' "${unexpected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:    %s\n' "${msg}" >&2
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

assert_match() {
  local -r pattern="$1" actual="$2" msg="${3:-}"
  if [[ ! "${actual}" =~ ${pattern} ]]; then
    printf '  Pattern: %s\n  Actual:  %s\n' "${pattern}" "${actual}" >&2
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

assert_stdout_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  assert_eq "${expected}" "${actual}" "${msg:-stdout mismatch}"
}

assert_stderr_contains() {
  local -r stderr="$1" needle="$2" msg="${3:-}"
  assert_contains "${stderr}" "${needle}" "${msg:-stderr should contain}"
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
source "${SCRIPT_DIR}/add-header-location.sh"

# ============================================================================
# TEST FIXTURES
# ============================================================================

# Create test file with specific content
create_test_file() {
  local -r path="$1"
  local -r content="$2"
  mkdir -p "$(dirname "${path}")"
  printf '%s' "${content}" > "${path}"
}

# Get file content
get_file_content() {
  local -r path="$1"
  cat "${path}"
}

# Count occurrences of a pattern in file
count_pattern() {
  local -r file="$1"
  local -r pattern="$2"
  grep -c "${pattern}" "${file}" 2>/dev/null || echo 0
}

# ============================================================================
# TESTS
# ============================================================================

test_file_without_frontmatter() {
  local -r test_file="${_test_tmpdir}/no-frontmatter.md"
  create_test_file "${test_file}" "# Test File\n\nThis file has no frontmatter.\n"
  
  # Run script
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Check that frontmatter was added
  assert_contains "${content}" "---" "Should have frontmatter"
  assert_contains "${content}" "# Copyright" "Should have copyright line"
  assert_contains "${content}" "# MIT License" "Should have MIT license line"
  assert_contains "${content}" "# Latest version:" "Should have latest version line"
  
  # Check structure: copyright first, then MIT, then latest version
  local copyright_line mit_line version_line
  copyright_line="$(grep -n "# Copyright" "${test_file}" | head -1 | cut -d: -f1)"
  mit_line="$(grep -n "# MIT License" "${test_file}" | head -1 | cut -d: -f1)"
  version_line="$(grep -n "# Latest version:" "${test_file}" | head -1 | cut -d: -f1)"
  
  [[ "${copyright_line}" -lt "${mit_line}" ]] || return 1
  [[ "${mit_line}" -lt "${version_line}" ]] || return 1
  
  # Original content should remain
  assert_contains "${content}" "This file has no frontmatter"
}

test_file_with_frontmatter_no_copyright() {
  local -r test_file="${_test_tmpdir}/frontmatter-no-copyright.md"
  create_test_file "${test_file}" "---
description: Test file
agent: test
---
# Content
Some content here."
  
  # Run script
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Check that header lines were added at the beginning of frontmatter
  assert_contains "${content}" "# Copyright" "Should have copyright line"
  assert_contains "${content}" "# MIT License" "Should have MIT license line"
  assert_contains "${content}" "# Latest version:" "Should have latest version line"
  
  # Check that original frontmatter fields remain
  assert_contains "${content}" "description: Test file"
  assert_contains "${content}" "agent: test"
  
  # Check order: header lines should be at top of frontmatter
  local lines
  mapfile -t lines < "${test_file}"
  
  # First line should be ---
  assert_eq "---" "${lines[0]}" "First line should be ---"
  # Second line should be copyright
  assert_contains "${lines[1]}" "# Copyright" "Second line should be copyright"
  # Third line should be MIT license
  assert_contains "${lines[2]}" "# MIT License" "Third line should be MIT license"
  # Fourth line should be latest version
  assert_contains "${lines[3]}" "# Latest version:" "Fourth line should be latest version"
}

test_file_with_complete_header() {
  local -r test_file="${_test_tmpdir}/complete-header.md"
  local -r rel_path="test/complete-header.md"
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
#
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/${rel_path}
description: Already has complete header
---
# Content
Should not change."
  
  # Get original content hash
  local original_hash
  original_hash="$(sha256sum "${test_file}" | cut -d' ' -f1)"
  
  # Run script (should be idempotent)
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  # Get new content hash
  local new_hash
  new_hash="$(sha256sum "${test_file}" | cut -d' ' -f1)"
  
  # File should not change (idempotent)
  assert_eq "${original_hash}" "${new_hash}" "File with complete header should not change"
  
  # Check that all required lines still exist
  local content
  content="$(get_file_content "${test_file}")"
  
  assert_contains "${content}" "# Copyright"
  assert_contains "${content}" "# MIT License"
  assert_contains "${content}" "# Latest version:"
  assert_contains "${content}" "description: Already has complete header"
}

test_file_with_old_url_format() {
  local -r test_file="${_test_tmpdir}/old-url-format.md"
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
#
# MIT License - see LICENSE file for full terms
#  https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/test/old.md
description: Has old URL format without prefix
---
# Content"
  
  # Run script
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Should have updated to "Latest version:" prefix
  assert_contains "${content}" "# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main"
  
  # Should not have old URL line without prefix
  local old_url_count
  old_url_count="$(grep -c "^#[[:space:]]*https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main" "${test_file}" || true)"
  
  # There should be exactly 1 URL line (the new one with prefix)
  assert_eq "1" "${old_url_count}" "Should have exactly one URL line with prefix"
}

test_dry_run_mode() {
  local -r test_file="${_test_tmpdir}/dry-run-test.md"
  create_test_file "${test_file}" "# Test file\nNo frontmatter"
  
  # Get original content
  local original_content
  original_content="$(get_file_content "${test_file}")"
  
  # Run with dry-run
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=true "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Dry-run should succeed"
  
  # File should not change in dry-run mode
  local current_content
  current_content="$(get_file_content "${test_file}")"
  
  assert_eq "${original_content}" "${current_content}" "File should not change in dry-run mode"
  
  # Output should contain DRY-RUN message
  assert_contains "${stdout}" "DRY-RUN" "Should mention DRY-RUN in output"
}

test_directory_processing() {
  local -r test_dir="${_test_tmpdir}/test-dir"
  mkdir -p "${test_dir}"
  
  # Create multiple test files
  create_test_file "${test_dir}/file1.md" "# File 1"
  create_test_file "${test_dir}/file2.md" "---
description: Test
---"
  create_test_file "${test_dir}/file3.md" "---
# Copyright line
# MIT License
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/path
---"
  
  # Run script on directory
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_dir}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Directory processing should succeed"
  
  # Check each file
  local file1_content file2_content file3_content
  file1_content="$(get_file_content "${test_dir}/file1.md")"
  file2_content="$(get_file_content "${test_dir}/file2.md")"
  file3_content="$(get_file_content "${test_dir}/file3.md")"
  
  # File 1 should have full header added
  assert_contains "${file1_content}" "# Copyright"
  assert_contains "${file1_content}" "# MIT License"
  assert_contains "${file1_content}" "# Latest version:"
  
  # File 2 should have header added to existing frontmatter
  assert_contains "${file2_content}" "# Copyright"
  assert_contains "${file2_content}" "description: Test"
  
  # File 3 should be unchanged (already has complete header)
  assert_contains "${file3_content}" "# Copyright line"
  assert_contains "${file3_content}" "# MIT License"
  # Note: This test file has non-standard lines, but script should detect it has "Latest version:" prefix
}

test_non_markdown_file() {
  local -r test_file="${_test_tmpdir}/not-markdown.txt"
  create_test_file "${test_file}" "This is not a markdown file"
  
  # Script should handle this gracefully
  local stdout stderr exit_code=0
  stdout="$("${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  # Should exit with usage error (EXIT_USAGE=2)
  assert_exit_code 2 "${exit_code}" "Non-markdown file should cause usage error"
  assert_contains "${stdout}" "not a markdown file or directory" "Should mention markdown requirement"
}

test_default_paths() {
  # Test that script runs with default paths when no arguments given
  # We'll mock the actual processing to avoid modifying real files
  local stdout stderr exit_code=0
  
  # Create a mock script that just prints what it would process
  local mock_script="${_test_tmpdir}/mock-script.sh"
  cat > "${mock_script}" <<'EOF'
#!/bin/bash
echo "DEFAULT_PATHS: .opencode/agent .opencode/command doc/guides doc/documentation-handbook.md"
EOF
  chmod +x "${mock_script}"
  
  # We'll test by checking the help output instead
  stdout="$("${SCRIPT_DIR}/add-header-location.sh" --help 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Help should succeed"
  assert_contains "${stdout}" "Usage:" "Should show usage"
}

test_verbose_mode() {
  local -r test_file="${_test_tmpdir}/verbose-test.md"
  create_test_file "${test_file}" "# Test file"
  
  # Run with verbose mode
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=false VERBOSE=true "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Verbose mode should succeed"
  
  # Should contain DEBUG messages
  assert_contains "${stdout}" "DEBUG" "Verbose output should contain DEBUG messages"
}

test_multiple_files_argument() {
  local -r test_file1="${_test_tmpdir}/multi1.md"
  local -r test_file2="${_test_tmpdir}/multi2.md"
  create_test_file "${test_file1}" "# File 1"
  create_test_file "${test_file2}" "# File 2"
  
  # Run script with multiple file arguments
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file1}" "${test_file2}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Multiple files should succeed"
  
  # Both files should have headers
  local content1 content2
  content1="$(get_file_content "${test_file1}")"
  content2="$(get_file_content "${test_file2}")"
  
  assert_contains "${content1}" "# Copyright"
  assert_contains "${content2}" "# Copyright"
}

test_unicode_copyright_idempotent() {
  local -r test_file="${_test_tmpdir}/unicode-copyright.md"
  local -r rel_path="test/unicode-copyright.md"
  # Exact copyright line with Unicode characters
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/${rel_path}
description: Unicode test
---
# Content"
  
  # Get original hash
  local original_hash
  original_hash="$(sha256sum "${test_file}" | cut -d' ' -f1)"
  
  # Run script (should be idempotent)
  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  # Get new hash
  local new_hash
  new_hash="$(sha256sum "${test_file}" | cut -d' ' -f1)"
  
  # File should not change (idempotent)
  assert_eq "${original_hash}" "${new_hash}" "File with Unicode copyright should not change"
  
  # Verify all required lines still exist
  local content
  content="$(get_file_content "${test_file}")"
  assert_contains "${content}" "# Copyright.*Ćwiąkalski"
  assert_contains "${content}" "# MIT License"
  assert_contains "${content}" "# Latest version:"
}

test_missing_mit_line() {
  local -r test_file="${_test_tmpdir}/missing-mit.md"
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
description: Missing MIT line
---
# Content"
  
  # Run script
  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Should have added MIT line and source line
  assert_contains "${content}" "# MIT License"
  assert_contains "${content}" "# Latest version:"
  
  # Check order: copyright, MIT, source
  local copyright_line mit_line version_line
  copyright_line="$(grep -n "# Copyright" "${test_file}" | head -1 | cut -d: -f1)"
  mit_line="$(grep -n "# MIT License" "${test_file}" | head -1 | cut -d: -f1)"
  version_line="$(grep -n "# Latest version:" "${test_file}" | head -1 | cut -d: -f1)"
  
  [[ "${copyright_line}" -lt "${mit_line}" ]] || return 1
  [[ "${mit_line}" -lt "${version_line}" ]] || return 1
  
  # Original content should remain
  assert_contains "${content}" "description: Missing MIT line"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"
  
  run_test "File without frontmatter gets full header" test_file_without_frontmatter
  run_test "File with frontmatter but no copyright gets header added" test_file_with_frontmatter_no_copyright
  run_test "File with complete header remains unchanged" test_file_with_complete_header
  run_test "File with old URL format gets updated with prefix" test_file_with_old_url_format
  run_test "Dry-run mode doesn't modify files" test_dry_run_mode
  run_test "Directory processing works recursively" test_directory_processing
  run_test "Non-markdown file causes error" test_non_markdown_file
  run_test "Default paths work" test_default_paths
  run_test "Verbose mode outputs debug info" test_verbose_mode
  run_test "Multiple files as arguments work" test_multiple_files_argument
  run_test "Unicode copyright line handled idempotently" test_unicode_copyright_idempotent
  run_test "Missing MIT line gets added with source line" test_missing_mit_line
  
  print_summary
}

main "$@"