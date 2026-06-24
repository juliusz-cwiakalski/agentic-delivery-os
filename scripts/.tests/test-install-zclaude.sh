#!/usr/bin/env bash
# test-install-zclaude.sh — Tests for install-zclaude.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-install-zclaude)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""
# Per-test failure flag. Asserts set this on failure; run_test checks it so a
# failing assertion mid-test is never masked by a later success.
_current_test_failed=0
_saved_home=""
_saved_path=""

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
  _saved_home="${HOME}"
  _saved_path="${PATH:-}"
  HOME="${_test_tmpdir}/home"
  mkdir -p "${HOME}"
  # Reset installer env vars that individual tests may mutate.
  ZCLAUDE_INSTALL_DIR=""
  DRY_RUN="false"
  VERBOSE="false"
}

_test_teardown() {
  # Restore PATH/HOME FIRST: some tests clobber PATH (e.g. is_in_path,
  # choose_install_dir), which would make the rm below fail with "command not
  # found". Restore before invoking any external command.
  [[ -n "${_saved_path}" ]] && PATH="${_saved_path}"
  [[ -n "${_saved_home}" ]] && HOME="${_saved_home}"
  if [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]]; then
    rm -rf "${_test_tmpdir}" 2>/dev/null || true
  fi
}

trap '_test_teardown' EXIT

# Run a test function in the CURRENT shell with errexit temporarily disabled.
# Running in the current shell means shared state modified inside the function
# under test stays visible; disabling errexit lets every assertion run and
# report, while _current_test_failed captures any failure. (See test-install.sh
# for the full rationale — a `( set -e; func )` subshell silently masks
# failures in this bash version.)
run_test() {
  local -r name="$1"
  local -r func="$2"
  _test_count=$((_test_count + 1))

  _test_setup
  _current_test_failed=0

  local _rc=0
  set +e
  "${func}"
  _rc=$?
  set -e

  if [[ ${_current_test_failed} -ne 0 || ${_rc} -ne 0 ]]; then
    _test_failed=$((_test_failed + 1))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  else
    _test_passed=$((_test_passed + 1))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
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
    printf '  Haystack should not contain: %s\n  Needle: %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

assert_file_exists() {
  local -r path="$1" msg="${2:-}"
  if [[ ! -f "${path}" ]]; then
    printf '  File does not exist: %s\n' "${path}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    _current_test_failed=1
    return 1
  fi
}

assert_file_executable() {
  local -r path="$1" msg="${2:-}"
  if [[ ! -x "${path}" ]]; then
    printf '  File is not executable: %s\n' "${path}" >&2
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
source "${SCRIPT_DIR}/install-zclaude.sh"

# ============================================================================
# MOCK HELPERS
# ============================================================================

# Capture the -o <file> argument from a curl-style invocation and write a
# known script body into it. Returns 0 (success).
_curl_mock_write_script() {
  local out=""
  while (($#)); do
    if [[ "$1" == "-o" ]]; then out="$2"; shift 2; continue; fi
    shift
  done
  printf '#!/usr/bin/env bash\necho zclaude-mock\n' > "${out}"
}

# Mock curl that always fails.
_curl_mock_fail() {
  printf 'curl: (7) Failed to connect\n' >&2
  return 1
}

# ============================================================================
# TESTS — Constants (locks in the user's opus model bump)
# ============================================================================

test_constants_app_name() {
  assert_eq "install-zclaude" "${APP_NAME}" "APP_NAME"
}

test_constants_version() {
  assert_eq "1.0.0" "${APP_VERSION}" "APP_VERSION"
}

test_constants_raw_url() {
  assert_contains "${ZCLAUDE_RAW_URL}" "zclaude" "ZCLAUDE_RAW_URL should target zclaude"
  assert_contains "${ZCLAUDE_RAW_URL}" "raw.githubusercontent.com" "ZCLAUDE_RAW_URL should be a raw github url"
}

test_constants_claude_install_url() {
  assert_eq "https://claude.ai/install.sh" "${CLAUDE_INSTALL_URL}" "CLAUDE_INSTALL_URL"
}

# ============================================================================
# TESTS — command_exists
# ============================================================================

test_command_exists_true() {
  command_exists bash
}

test_command_exists_false() {
  ! command_exists __definitely_not_a_real_command_xyz__
}

# ============================================================================
# TESTS — is_in_path
# ============================================================================

test_is_in_path_true() {
  PATH="/usr/local/bin:/opt/bin:/foo/bar"
  is_in_path "/foo/bar"
}

test_is_in_path_false() {
  PATH="/usr/local/bin:/opt/bin"
  ! is_in_path "/nope/missing"
}

test_is_in_path_trailing_slash_normalized() {
  PATH="/usr/local/bin:/foo/bar"
  is_in_path "/foo/bar/"
}

# ============================================================================
# TESTS — detect_shell_rc
# ============================================================================

test_detect_shell_rc_zsh() {
  local result
  result="$(SHELL="/usr/bin/zsh" detect_shell_rc)"
  assert_eq "${HOME}/.zshrc" "${result}" "zsh should map to ~/.zshrc"
}

test_detect_shell_rc_bash_linux() {
  local result
  result="$(SHELL="/usr/bin/bash" detect_shell_rc)"
  # On the Linux CI host this returns .bashrc; on macOS it returns .bash_profile.
  if [[ "$(uname -s)" == "Darwin" ]]; then
    assert_eq "${HOME}/.bash_profile" "${result}" "bash on macos -> ~/.bash_profile"
  else
    assert_eq "${HOME}/.bashrc" "${result}" "bash on linux -> ~/.bashrc"
  fi
}

test_detect_shell_rc_bash_macos() {
  # Shadow uname so detect_shell_rc takes the Darwin branch.
  local result
  result="$(
    HOME="/tmp/fakehome-ados"
    SHELL="/usr/bin/bash"
    uname() { printf 'Darwin\n'; }
    detect_shell_rc
  )"
  assert_eq "/tmp/fakehome-ados/.bash_profile" "${result}" "bash on Darwin -> ~/.bash_profile"
}

test_detect_shell_rc_default_profile() {
  local result
  result="$(SHELL="/usr/bin/fish" detect_shell_rc)"
  assert_eq "${HOME}/.profile" "${result}" "unknown shell -> ~/.profile"
}

# ============================================================================
# TESTS — choose_install_dir
# ============================================================================

test_choose_install_dir_explicit_override() {
  ZCLAUDE_INSTALL_DIR="/custom/install/path"
  local result
  result="$(choose_install_dir)"
  assert_eq "/custom/install/path" "${result}" "ZCLAUDE_INSTALL_DIR wins"
  ZCLAUDE_INSTALL_DIR=""
}

test_choose_install_dir_prefers_local_bin_in_path() {
  PATH="${HOME}/.local/bin:/usr/bin"
  local result
  result="$(choose_install_dir)"
  assert_eq "${HOME}/.local/bin" "${result}" "~/.local/bin in PATH is chosen"
}

test_choose_install_dir_uses_home_bin_if_in_path() {
  PATH="${HOME}/bin:/usr/bin"
  local result
  result="$(choose_install_dir)"
  assert_eq "${HOME}/bin" "${result}" "~/.bin in PATH is chosen"
}

test_choose_install_dir_fallback_local_bin() {
  # No HOME-prefixed writable entry in PATH -> fallback to ~/.local/bin
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  local result
  result="$(choose_install_dir)"
  assert_eq "${HOME}/.local/bin" "${result}" "fallback to ~/.local/bin"
}

# ============================================================================
# TESTS — detect_platform
# ============================================================================

test_detect_platform_returns_valid_value() {
  local result
  result="$(detect_platform)"
  case "${result}" in
    linux|macos|wsl|gitbash|unsupported) ;;
    *) assert_eq "linux|macos|wsl|gitbash|unsupported" "${result}" "unexpected platform" ;;
  esac
}

# ============================================================================
# TESTS — print_claude_install_instructions
# ============================================================================

test_print_instructions_unix_contains_curl_cmd() {
  local out
  out="$(print_claude_install_instructions linux 2>&1)"
  assert_contains "${out}" "${CLAUDE_INSTALL_URL}" "should mention the unix install url"
  assert_contains "${out}" "curl" "should mention curl"
}

test_print_instructions_gitbash_contains_powershell() {
  local out
  out="$(print_claude_install_instructions gitbash 2>&1)"
  assert_contains "${out}" "${CLAUDE_INSTALL_PS_URL}" "should mention the powershell url"
  assert_contains "${out}" "irm" "should mention irm"
}

# ============================================================================
# TESTS — ask_yes_no (no interactive tty in CI)
# ============================================================================

test_ask_yes_no_returns_false_without_tty() {
  # In a non-interactive environment there is no /dev/tty, so ask_yes_no must
  # decline (return 1) rather than hang.
  ! ask_yes_no "should this be yes?" "Y"
}

# ============================================================================
# TESTS — download_tool
# ============================================================================

test_download_tool_dry_run_does_not_create_dest() {
  local dest="${_test_tmpdir}/bin/zclaude"
  mkdir -p "$(dirname "${dest}")"
  DRY_RUN="true"
  download_tool "${dest}"
  DRY_RUN="false"
  [[ ! -e "${dest}" ]] || {
    printf '  dest should NOT exist in dry-run: %s\n' "${dest}" >&2
    _current_test_failed=1
    return 1
  }
}

test_download_tool_writes_executable_dest() {
  local dest="${_test_tmpdir}/bin/zclaude"
  mkdir -p "$(dirname "${dest}")"
  DRY_RUN="false"
  # Override the _curl wrapper to produce a known script body.
  _curl() { _curl_mock_write_script "$@"; }
  download_tool "${dest}"
  assert_file_exists "${dest}" "dest should be created"
  assert_file_executable "${dest}" "dest should be executable"
  local content
  content="$(cat "${dest}")"
  assert_contains "${content}" "zclaude-mock" "dest should contain the downloaded body"
}

test_download_tool_returns_external_on_curl_failure() {
  local dest="${_test_tmpdir}/bin/zclaude"
  mkdir -p "$(dirname "${dest}")"
  DRY_RUN="false"
  _curl() { _curl_mock_fail "$@"; }
  local rc=0
  download_tool "${dest}" || rc=$?
  assert_exit_code "${EXIT_EXTERNAL}" "${rc}" "curl failure -> EXIT_EXTERNAL"
  [[ ! -e "${dest}" ]] || {
    printf '  dest should NOT exist after failed download: %s\n' "${dest}" >&2
    _current_test_failed=1
    return 1
  }
}

# ============================================================================
# TESTS — offer_path_setup
# ============================================================================

test_offer_path_setup_skips_when_dir_in_path() {
  local dir="${HOME}/.local/bin"
  PATH="${dir}:${PATH}"
  SHELL="/usr/bin/bash"
  offer_path_setup "${dir}"
  # rc file must not be created because dir is already in PATH (early return).
  [[ ! -f "${HOME}/.bashrc" ]] || {
    printf '  rc file should not be touched when dir already in PATH\n' >&2
    _current_test_failed=1
    return 1
  }
}

test_offer_path_setup_declines_without_tty() {
  local dir="${_test_tmpdir}/not/in/path"
  SHELL="/usr/bin/bash"
  PATH="/usr/bin"
  # No /dev/tty in CI -> ask_yes_no declines -> rc file not modified.
  offer_path_setup "${dir}"
  [[ ! -f "${HOME}/.bashrc" ]] || {
    printf '  rc file should not be created when user declines\n' >&2
    _current_test_failed=1
    return 1
  }
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  # Constants
  run_test "APP_NAME constant" test_constants_app_name
  run_test "APP_VERSION constant" test_constants_version
  run_test "ZCLAUDE_RAW_URL targets zclaude" test_constants_raw_url
  run_test "CLAUDE_INSTALL_URL constant" test_constants_claude_install_url

  # command_exists
  run_test "command_exists true for real command" test_command_exists_true
  run_test "command_exists false for bogus command" test_command_exists_false

  # is_in_path
  run_test "is_in_path true when present" test_is_in_path_true
  run_test "is_in_path false when absent" test_is_in_path_false
  run_test "is_in_path normalizes trailing slash" test_is_in_path_trailing_slash_normalized

  # detect_shell_rc
  run_test "detect_shell_rc: zsh -> ~/.zshrc" test_detect_shell_rc_zsh
  run_test "detect_shell_rc: bash on host" test_detect_shell_rc_bash_linux
  run_test "detect_shell_rc: bash on macos -> ~/.bash_profile" test_detect_shell_rc_bash_macos
  run_test "detect_shell_rc: unknown shell -> ~/.profile" test_detect_shell_rc_default_profile

  # choose_install_dir
  run_test "choose_install_dir: explicit override wins" test_choose_install_dir_explicit_override
  run_test "choose_install_dir: ~/.local/bin in PATH" test_choose_install_dir_prefers_local_bin_in_path
  run_test "choose_install_dir: ~/.bin in PATH" test_choose_install_dir_uses_home_bin_if_in_path
  run_test "choose_install_dir: fallback to ~/.local/bin" test_choose_install_dir_fallback_local_bin

  # detect_platform
  run_test "detect_platform returns a valid value" test_detect_platform_returns_valid_value

  # print_claude_install_instructions
  run_test "instructions (unix) mention curl + url" test_print_instructions_unix_contains_curl_cmd
  run_test "instructions (gitbash) mention powershell + irm" test_print_instructions_gitbash_contains_powershell

  # ask_yes_no
  run_test "ask_yes_no declines without a tty" test_ask_yes_no_returns_false_without_tty

  # download_tool
  run_test "download_tool dry-run creates no dest" test_download_tool_dry_run_does_not_create_dest
  run_test "download_tool writes executable dest" test_download_tool_writes_executable_dest
  run_test "download_tool returns EXIT_EXTERNAL on curl failure" test_download_tool_returns_external_on_curl_failure

  # offer_path_setup
  run_test "offer_path_setup skips when dir already in PATH" test_offer_path_setup_skips_when_dir_in_path
  run_test "offer_path_setup declines without tty" test_offer_path_setup_declines_without_tty

  print_summary
}

main "$@"
