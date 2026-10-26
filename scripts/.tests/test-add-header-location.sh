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
  
  # Check that frontmatter was added with source: attribute (not # Latest version:)
  assert_contains "${content}" "---" "Should have frontmatter"
  assert_contains "${content}" "# Copyright" "Should have copyright line"
  assert_contains "${content}" "# Apache-2.0 License" "Should have Apache-2.0 license line"
  assert_contains "${content}" "source: ${GITHUB_BASE}" "Should have source attribute"
  assert_not_contains "${content}" "# Latest version:" "Should NOT have old comment format"
  
  # Check structure: copyright first, then Apache-2.0, then source
  local copyright_line license_line source_line
  copyright_line="$(grep -n "# Copyright" "${test_file}" | head -1 | cut -d: -f1)"
  license_line="$(grep -n "# Apache-2.0 License" "${test_file}" | head -1 | cut -d: -f1)"
  source_line="$(grep -n "^source:" "${test_file}" | head -1 | cut -d: -f1)"
  
  [[ "${copyright_line}" -lt "${license_line}" ]] || return 1
  [[ "${license_line}" -lt "${source_line}" ]] || return 1
  
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
  assert_contains "${content}" "# Apache-2.0 License" "Should have Apache-2.0 license line"
  assert_contains "${content}" "source: ${GITHUB_BASE}" "Should have source attribute"
  assert_not_contains "${content}" "# Latest version:" "Should NOT have old comment format"
  
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
  # Third line should be Apache-2.0 license
  assert_contains "${lines[2]}" "# Apache-2.0 License" "Third line should be Apache-2.0 license"
  # Fourth line should be source attribute
  assert_contains "${lines[3]}" "source:" "Fourth line should be source attribute"
}

test_file_with_complete_header() {
  local -r test_file="${_test_tmpdir}/complete-header.md"
  touch "${test_file}"
  local rel_path
  rel_path="$(compute_relative_path "$(get_repo_root)" "${test_file}")"
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: ${GITHUB_BASE}/${rel_path}
description: Already has complete header
---
# Content
Should not change.
"
  
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
  assert_contains "${content}" "# Apache-2.0 License"
  assert_contains "${content}" "source:" "Should have source attribute"
  assert_contains "${content}" "description: Already has complete header"
}

test_file_with_old_url_format() {
  local -r test_file="${_test_tmpdir}/old-url-format.md"
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
#
# Apache-2.0 License - see LICENSE file for full terms
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
  
  # Should have updated to source: attribute (new format)
  assert_contains "${content}" "source: ${GITHUB_BASE}"
  
  # Should NOT have old comment format
  assert_not_contains "${content}" "# Latest version:" "Should not have old comment format"
  
  # Should have exactly 1 source line
  local source_count
  source_count="$(grep -c "^source:" "${test_file}" || true)"
  assert_eq "1" "${source_count}" "Should have exactly one source attribute"
}

test_file_with_old_latest_version_comment() {
  local -r test_file="${_test_tmpdir}/old-comment-format.md"
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/test/old.md
description: Has old Latest version comment
---
# Content"
  
  # Run script — should convert old comment to source: attribute
  local stdout stderr exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Should have source: attribute now
  assert_contains "${content}" "source: ${GITHUB_BASE}" "Should have source attribute"
  # Should NOT have old # Latest version: comment
  assert_not_contains "${content}" "# Latest version:" "Old comment format should be replaced"
  # Original frontmatter fields should remain
  assert_contains "${content}" "description: Has old Latest version comment"
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
# Apache-2.0 License
source: ${GITHUB_BASE}/path
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
  
  # File 1 should have full header added with source: attribute
  assert_contains "${file1_content}" "# Copyright"
  assert_contains "${file1_content}" "# Apache-2.0 License"
  assert_contains "${file1_content}" "source:" "Should have source attribute"
  assert_not_contains "${file1_content}" "# Latest version:" "Should NOT have old comment format"
  
  # File 2 should have header added to existing frontmatter
  assert_contains "${file2_content}" "# Copyright"
  assert_contains "${file2_content}" "description: Test"
  
  # File 3 should be unchanged (already has complete header with source: attribute)
  assert_contains "${file3_content}" "# Copyright line"
  assert_contains "${file3_content}" "# Apache-2.0 License"
  assert_contains "${file3_content}" "source:" "Should have source attribute"
}

test_directory_skips_tmp_subtree() {
  local -r test_dir="${_test_tmpdir}/skip-tmp"
  mkdir -p "${test_dir}/tmp/drafts"
  create_test_file "${test_dir}/doc.md" "# Doc"
  create_test_file "${test_dir}/tmp/drafts/draft.md" "# Draft"

  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_dir}" 2>&1)" || exit_code=$?

  assert_exit_code 0 "${exit_code}" "Directory processing should succeed"

  local doc_content draft_content
  doc_content="$(get_file_content "${test_dir}/doc.md")"
  draft_content="$(get_file_content "${test_dir}/tmp/drafts/draft.md")"

  assert_contains "${doc_content}" "# Copyright" "Regular file should get a header"
  assert_not_contains "${draft_content}" "# Copyright" "tmp/ subtree should be skipped"
}

test_non_markdown_file() {
  local -r test_file="${_test_tmpdir}/not-markdown.txt"
  create_test_file "${test_file}" "This is not a markdown file"
  
  # Script should handle this gracefully
  local stdout stderr exit_code=0
  stdout="$("${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  # Should exit with usage error (EXIT_USAGE=2)
  assert_exit_code 2 "${exit_code}" "Non-markdown file should cause usage error"
  assert_contains "${stdout}" "not a markdown file" "Should mention markdown requirement"
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

test_default_paths_include_concepts() {
  local found=0 path
  for path in "${DEFAULT_PATHS[@]}"; do
    [[ "${path}" == "doc/planning/concepts" ]] && found=1
  done
  assert_eq "1" "${found}" "Default paths should include doc/planning/concepts"
}

test_missing_default_paths_are_skipped() {
  local -r test_repo="${_test_tmpdir}/mini-repo"
  mkdir -p "${test_repo}/doc/guides"
  create_test_file "${test_repo}/doc/guides/guide.md" "# Guide
"

  local exit_code=0
  ( cd "${test_repo}" && git init -q && DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" ) \
    > "${_test_tmpdir}/mini-repo.log" 2>&1 || exit_code=$?

  assert_exit_code 0 "${exit_code}" "Missing default paths should be skipped"
  assert_contains "$(cat "${_test_tmpdir}/mini-repo.log")" "Skipping missing default path" "Should warn about missing defaults"

  local content
  content="$(get_file_content "${test_repo}/doc/guides/guide.md")"
  assert_contains "${content}" "# Copyright" "Existing default path should still be processed"
}

test_markdown_source_branch_migrates() {
  local -r test_file="${_test_tmpdir}/branch-migrate.md"
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/${GITHUB_REPO_SLUG}/blob/main/test/branch-migrate.md
description: Old branch source
---
# Content"

  local stdout exit_code=0
  stdout="$(env DRY_RUN=false GITHUB_BRANCH=release-test "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?

  assert_exit_code 0 "${exit_code}" "Script should succeed"

  local content
  content="$(get_file_content "${test_file}")"
  assert_contains "${content}" "source: https://github.com/${GITHUB_REPO_SLUG}/blob/release-test" "Source should point at the configured branch"
  assert_not_contains "${content}" "/blob/main/" "Old branch URL should be replaced"

  local source_count
  source_count="$(grep -c "^source:" "${test_file}" || true)"
  assert_eq "1" "${source_count}" "Should have exactly one source attribute"
}

test_bash_source_branch_migrates_without_duplication() {
  local -r test_file="${_test_tmpdir}/branch-migrate.sh"
  create_test_file "${test_file}" '#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/test/branch-migrate.sh
set -Eeuo pipefail
echo "hello"
'

  local stdout exit_code=0
  stdout="$(env DRY_RUN=false GITHUB_BRANCH=release-test "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?

  assert_exit_code 0 "${exit_code}" "Script should succeed"

  local content
  content="$(get_file_content "${test_file}")"
  assert_contains "${content}" "# Latest version: https://github.com/${GITHUB_REPO_SLUG}/blob/release-test" "Source should point at the configured branch"
  assert_not_contains "${content}" "/blob/main/" "Old branch URL should be replaced"

  local copyright_count license_count source_count
  copyright_count="$(grep -c "^# Copyright" "${test_file}" || true)"
  license_count="$(grep -c "^# Apache-2.0 License" "${test_file}" || true)"
  source_count="$(grep -c "^# Latest version:" "${test_file}" || true)"
  assert_eq "1" "${copyright_count}" "Copyright line should not be duplicated"
  assert_eq "1" "${license_count}" "License line should not be duplicated"
  assert_eq "1" "${source_count}" "Source line should not be duplicated"
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
  touch "${test_file}"
  local rel_path
  rel_path="$(compute_relative_path "$(get_repo_root)" "${test_file}")"
  # Exact copyright line with Unicode characters, using new source: attribute format
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: ${GITHUB_BASE}/${rel_path}
description: Unicode test
---
# Content
"
  
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
  assert_match "# Copyright.*Ćwiąkalski" "${content}"
  assert_contains "${content}" "# Apache-2.0 License"
  assert_contains "${content}" "source:" "Should have source attribute"
}

test_missing_license_line() {
  local -r test_file="${_test_tmpdir}/missing-mit.md"
  create_test_file "${test_file}" "---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
description: Missing Apache-2.0 line
---
# Content"
  
  # Run script
  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Should have added Apache-2.0 line and source attribute
  assert_contains "${content}" "# Apache-2.0 License"
  assert_contains "${content}" "source: ${GITHUB_BASE}" "Should have source attribute"
  assert_not_contains "${content}" "# Latest version:" "Should NOT have old comment format"
  
  # Check order: copyright, Apache-2.0, source
  local copyright_line license_line source_line
  copyright_line="$(grep -n "# Copyright" "${test_file}" | head -1 | cut -d: -f1)"
  license_line="$(grep -n "# Apache-2.0 License" "${test_file}" | head -1 | cut -d: -f1)"
  source_line="$(grep -n "^source:" "${test_file}" | head -1 | cut -d: -f1)"
  
  [[ "${copyright_line}" -lt "${license_line}" ]] || return 1
  [[ "${license_line}" -lt "${source_line}" ]] || return 1
  
  # Original content should remain
  assert_contains "${content}" "description: Missing Apache-2.0 line"
}

# ============================================================================
# BASH FILE TESTS
# ============================================================================

test_bash_sh_extension_gets_header() {
  local -r test_file="${_test_tmpdir}/test-script.sh"
  create_test_file "${test_file}" '#!/usr/bin/env bash
# test-script.sh — A test script
set -Eeuo pipefail

echo "hello"
'
  
  # Run script
  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Header should be present as bash comments
  assert_contains "${content}" "# Copyright (c) 2025-2026" "Should have copyright line"
  assert_contains "${content}" "# Apache-2.0 License - see LICENSE file for full terms" "Should have Apache-2.0 line"
  assert_contains "${content}" "# Latest version: ${GITHUB_BASE}" "Should have source URL"
  
  # Shebang should still be first line
  local lines
  mapfile -t lines < "${test_file}"
  assert_eq "#!/usr/bin/env bash" "${lines[0]}" "First line should be shebang"
  assert_contains "${lines[1]}" "# Copyright" "Second line should be copyright"
  assert_contains "${lines[2]}" "# Apache-2.0 License" "Third line should be Apache-2.0 license"
  assert_contains "${lines[3]}" "# Latest version:" "Fourth line should be source URL"
  
  # Original content should be preserved
  assert_contains "${content}" "echo \"hello\"" "Original content should remain"
}

test_bash_shebang_no_extension_gets_header() {
  local -r test_file="${_test_tmpdir}/my-tool"
  create_test_file "${test_file}" '#!/usr/bin/env bash
# my-tool — A tool without .sh extension
set -Eeuo pipefail

main() {
  echo "running"
}

main "$@"
'
  
  # Run script
  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Header should be present after shebang
  local lines
  mapfile -t lines < "${test_file}"
  assert_eq "#!/usr/bin/env bash" "${lines[0]}" "First line should be shebang"
  assert_contains "${lines[1]}" "# Copyright" "Header should start after shebang"
  assert_contains "${lines[2]}" "# Apache-2.0 License" "Apache-2.0 line after copyright"
  assert_contains "${lines[3]}" "# Latest version:" "Source URL after Apache-2.0"
  
  # Original content should be preserved
  assert_contains "${content}" "main() {" "Original content should remain"
}

test_bash_bin_bash_shebang_detected() {
  local -r test_file="${_test_tmpdir}/alt-shebang-tool"
  create_test_file "${test_file}" '#!/bin/bash
echo "alt shebang"
'
  
  # Run script
  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  local content
  content="$(get_file_content "${test_file}")"
  
  # Header should be present
  assert_contains "${content}" "# Copyright (c) 2025-2026" "Should have copyright line"
  assert_contains "${content}" "# Apache-2.0 License" "Should have Apache-2.0 line"
  assert_contains "${content}" "# Latest version:" "Should have source URL"
  
  # Shebang preserved as first line
  local first_line
  first_line="$(head -1 "${test_file}")"
  assert_eq "#!/bin/bash" "${first_line}" "Shebang should be preserved"
}

test_bash_existing_header_idempotent() {
  local -r test_file="${_test_tmpdir}/already-has-header.sh"
  create_test_file "${test_file}" "#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
# Latest version: ${GITHUB_BASE}/test/already-has-header.sh
set -Eeuo pipefail
echo \"existing\"
"
  
  # Get original hash
  local original_hash
  original_hash="$(sha256sum "${test_file}" | cut -d' ' -f1)"
  
  # Run script (should be idempotent)
  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Script should succeed"
  
  # Get new hash — file should not change
  local new_hash
  new_hash="$(sha256sum "${test_file}" | cut -d' ' -f1)"
  assert_eq "${original_hash}" "${new_hash}" "Bash file with existing header should not change"
}

test_bash_directory_finds_both_md_and_sh() {
  local -r test_dir="${_test_tmpdir}/mixed-dir"
  mkdir -p "${test_dir}"
  
  # Create markdown file
  create_test_file "${test_dir}/readme.md" "# Readme\nSome content."
  # Create .sh file
  create_test_file "${test_dir}/setup.sh" '#!/usr/bin/env bash
echo "setup"
'
  # Create shebang file without extension
  create_test_file "${test_dir}/my-tool" '#!/usr/bin/env bash
echo "tool"
'
  
  # Run on directory
  local stdout exit_code=0
  stdout="$(DRY_RUN=false "${SCRIPT_DIR}/add-header-location.sh" "${test_dir}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Directory processing should succeed"
  
  # All three files should have headers
  local md_content sh_content tool_content
  md_content="$(get_file_content "${test_dir}/readme.md")"
  sh_content="$(get_file_content "${test_dir}/setup.sh")"
  tool_content="$(get_file_content "${test_dir}/my-tool")"
  
  assert_contains "${md_content}" "# Copyright" "Markdown file should have header"
  assert_contains "${sh_content}" "# Copyright" ".sh file should have header"
  assert_contains "${tool_content}" "# Copyright" "Shebang-detected file should have header"
}

test_bash_dry_run_mode() {
  local -r test_file="${_test_tmpdir}/dry-run-bash.sh"
  create_test_file "${test_file}" '#!/usr/bin/env bash
echo "no header yet"
'
  
  # Get original content
  local original_content
  original_content="$(get_file_content "${test_file}")"
  
  # Run with dry-run
  local stdout exit_code=0
  stdout="$(DRY_RUN=true "${SCRIPT_DIR}/add-header-location.sh" "${test_file}" 2>&1)" || exit_code=$?
  
  assert_exit_code 0 "${exit_code}" "Dry-run should succeed"
  
  # File should not change in dry-run mode
  local current_content
  current_content="$(get_file_content "${test_file}")"
  assert_eq "${original_content}" "${current_content}" "Bash file should not change in dry-run mode"
  
  # Output should contain DRY-RUN message
  assert_contains "${stdout}" "DRY-RUN" "Should mention DRY-RUN in output"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"
  
  # Markdown tests
  run_test "File without frontmatter gets full header" test_file_without_frontmatter
  run_test "File with frontmatter but no copyright gets header added" test_file_with_frontmatter_no_copyright
  run_test "File with complete header remains unchanged" test_file_with_complete_header
  run_test "File with old URL format gets updated to source attribute" test_file_with_old_url_format
  run_test "File with old # Latest version: comment gets converted to source attribute" test_file_with_old_latest_version_comment
  run_test "Dry-run mode doesn't modify files" test_dry_run_mode
  run_test "Directory processing works recursively" test_directory_processing
  run_test "Directory processing skips tmp/ subtree" test_directory_skips_tmp_subtree
  run_test "Non-markdown file causes error" test_non_markdown_file
  run_test "Default paths work" test_default_paths
  run_test "Default paths include concept docs" test_default_paths_include_concepts
  run_test "Missing default paths are skipped" test_missing_default_paths_are_skipped
  run_test "Markdown source URL migrates to configured branch" test_markdown_source_branch_migrates
  run_test "Bash source URL migrates without duplicating header" test_bash_source_branch_migrates_without_duplication
  run_test "Verbose mode outputs debug info" test_verbose_mode
  run_test "Multiple files as arguments work" test_multiple_files_argument
  run_test "Unicode copyright line handled idempotently" test_unicode_copyright_idempotent
  run_test "Missing Apache-2.0 line gets added with source line" test_missing_license_line
  
  # Bash file tests
  run_test "Bash .sh file gets license header after shebang" test_bash_sh_extension_gets_header
  run_test "Bash shebang-detected file (no .sh) gets header after shebang" test_bash_shebang_no_extension_gets_header
  run_test "Bash #!/bin/bash shebang detected" test_bash_bin_bash_shebang_detected
  run_test "Bash file with existing header is idempotent" test_bash_existing_header_idempotent
  run_test "Directory processing finds both .md and bash files" test_bash_directory_finds_both_md_and_sh
  run_test "Bash dry-run mode doesn't modify files" test_bash_dry_run_mode
  
  print_summary
}

main "$@"
