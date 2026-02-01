# Bash Scripts Coding Rules

These rules define a rigorous standard for writing robust, maintainable, testable, and bug-free Bash scripts. Scripts following these rules are production-grade, easy to navigate for both humans and AI coding agents, and fully testable.

## 1) Baseline & Shell Mode

- Target shell: Bash 4.0+ (associative arrays, `mapfile`, etc.).
- Always start scripts with:
  - `#!/usr/bin/env bash`
  - `set -Eeuo pipefail` and `set -o errtrace`
  - `shopt -s inherit_errexit` (when available)
  - `IFS=$'\n\t'` to avoid word-splitting pitfalls.
- Use `trap` to centralize error handling and cleanup:
  - `trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR`
  - `trap '_on_exit' EXIT`
  - `trap '_on_interrupt' INT TERM`
- Prefer `[[ ... ]]` over `[ ... ]` for conditionals; avoid `test` unless needed for portability.
- Never source untrusted files; validate paths before sourcing.

## 2) Structure & Single Responsibility (Uncle Bob style)

- Keep functions small and single-purpose; name them with clear verbs (e.g., `ensure_dir`, `parse_args`, `validate_config`).
- Organize scripts in clear sections:
  1. Header and purpose
  2. Strict mode and traps
  3. Settings/Configuration (single source of truth for flags, paths, toggles)
  4. Utilities (logging, error handling, validation)
  5. Domain functions (script-specific logic)
  6. CLI parsing
  7. Main entry point
- Prefer composition over large monolithic functions.
- Avoid hidden global state; pass parameters explicitly where feasible.
- Default to single responsibility per script. If several related responsibilities must coexist, adopt a command/subcommand pattern: the first arg selects a command, each command is single-purpose and reuses shared helpers.
  - Example command-pattern skeleton:

```bash
# my-tool.sh — multi-command script following the command pattern
# Commands: init, sync, clean
main() {
  local cmd="${1:-help}"; shift || true
  case "${cmd}" in
    init) cmd_init "$@";;
    sync) cmd_sync "$@";;
    clean) cmd_clean "$@";;
    help|-h|--help) cmd_help;;
    *) log_err "Unknown command: ${cmd}"; cmd_help; return 2;;
  esac
}
cmd_init() { :; }   # single-purpose
cmd_sync() { :; }   # single-purpose
cmd_clean() { :; }  # single-purpose
cmd_help() { printf 'Usage: %s <init|sync|clean>\n' "${APP_NAME}"; }
```

## 3) Naming Conventions

- Global constants (read-only): `UPPER_SNAKE_CASE` with `readonly`.
  - Example: `readonly APP_VERSION="1.2.3"`
- Global mutable config: `UPPER_SNAKE_CASE` but keep usage minimal; document in the settings section.
- Script file names: kebab-case (e.g., `test-all.sh`, `extract-tag-content.sh`).
- Test scripts location: place tests under a dedicated `.tests` subfolder adjacent to the scripts they test (e.g., `scripts/ci/.tests`). A visible `tests/` subfolder is also acceptable when discoverability is preferred. Name test files `test-*.sh` and make them executable.
- Local variables: `lower_snake_case` and always declared with `local`.
- Function names: `lower_snake_case`, verbs first (e.g., `create_stub_files`, `log_error`).
- "Private" helpers: prefix with `_` (e.g., `_is_dir_empty`).
- Environment variables: `UPPER_SNAKE_CASE`; validate and document if they affect behavior.

## 4) Arguments, Flags, and Usage

- Support `-h|--help` and `--version`.
- Parse flags with a clear loop using `case`:
  ```bash
  while (($#)); do
    case "$1" in
      -n|--dry-run) DRY_RUN=true ;;
      -v|--verbose) VERBOSE=true ;;
      --) shift; break ;;
      -*) die "Unknown option: $1" ;;
      *) break ;;  # positional args start
    esac
    shift
  done
  ```
- Provide a concise usage message and examples.
- Validate inputs early and fail fast with actionable error messages.
- Use `getopts` only for simple POSIX-compatible scripts; prefer manual parsing for long options.

## 5) Logging & Errors

- Implement leveled logging functions in every script: `log_err`, `log_warn`, `log_info`, `log_debug`.
- All log lines MUST include a stable script context tag in parentheses to identify the source (e.g., `(mr_review_job)`), so CI logs are easily scannable. Use a consistent identifier per script.
- Recommended template (errors go to stderr):

```bash
readonly LOG_TAG="(script-name)"
log_info()  { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*"; }
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*"; }
log_err()   { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE:-false}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*"; }
log_fatal() { log_err "$@"; exit 1; }
```

- For other scripts, change the context tag accordingly (e.g., `(mr_desc_job)`, `(create-code-review)`, `(aider-run-and-extract)`).
- Send errors to stderr; normal output to stdout.
- Include context in error logs (function, line, command, exit code); centralize with traps:
  `trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR`
- Use `return` within functions; only `exit` from `main`/top-level.
- Never ignore exit codes; use `||` handlers or strict mode (`set -e` + traps).

## 6) Safety & Correctness

- Quote all variable expansions: `"${var}"` and `"${arr[@]}"`.
- Use `${var:-default}` and `${var:?message}` for robust defaults and required values.
- Disable globbing side-effects:
  - Never rely on implicit globbing; prefer `nullglob` if appropriate.
- Use `read -r` to avoid backslash escapes.
- Avoid `eval` and command injection; validate input; prefer arrays for arguments.
- Use `mktemp` for temp files/dirs; clean up in `trap`.
- Use `command -v <tool>` to detect external dependencies.
- Never use `rm -rf` with variables without validation:
  ```bash
  # DANGEROUS - never do this
  rm -rf "${dir}"
  
  # SAFE - validate first
  [[ -n "${dir}" && "${dir}" != "/" && -d "${dir}" ]] || die "Invalid dir: ${dir}"
  rm -rf "${dir}"
  ```
- Prefer `printf` over `echo` for portability and predictability.
- Use `local -r` for function-local constants.

## 7) Filesystem & Processes

- Create directories with `mkdir -p` and check for success.
- Detect empty directories with `shopt -s nullglob` patterns or explicit checks.
- Use `chmod` only when necessary; be explicit about modes.
- Prefer built-ins and shell features over spawning subshells or external processes.
- Use `pushd`/`popd` or subshells for directory changes to avoid state leakage:
  ```bash
  # Option 1: subshell (preferred for isolation)
  (cd "${target_dir}" && do_work)
  
  # Option 2: pushd/popd
  pushd "${target_dir}" >/dev/null || die "Cannot cd to ${target_dir}"
  do_work
  popd >/dev/null
  ```

## 8) Portability & Dependencies

- Keep GNU-specific features optional; detect availability.
- Document required tools in the header comment and `--help`.
- Where portability is required, avoid Bash-specific features; otherwise lean into Bash 4+ for clarity.
- Check for required commands at script start:
  ```bash
  require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
  }
  require_cmd jq
  require_cmd curl
  ```

## 9) Performance

- Avoid UUOC (Unnecessary Use Of `cat`); use redirection or `read`.
- Batch filesystem operations when possible.
- Reuse computed values (e.g., repo root) instead of recomputing.
- Prefer `mapfile` over `while read` loops for reading files into arrays.
- Use `[[ ... ]]` instead of `[ ... ]` (faster, more features).

## 10) Testability Design Principles

Scripts MUST be designed for testability from the start. This section defines patterns that make scripts easy to test.

### 10.1) Dependency Injection via Environment

All external dependencies (paths, URLs, commands) should be overridable via environment variables:

```bash
# Settings with testable defaults
readonly CONFIG_DIR="${CONFIG_DIR:-${HOME}/.config/myapp}"
readonly API_URL="${API_URL:-https://api.example.com}"
readonly CURL_CMD="${CURL_CMD:-curl}"
readonly JQ_CMD="${JQ_CMD:-jq}"
```

### 10.2) Pure Functions Where Possible

Separate pure logic (no side effects) from impure operations (I/O, network, filesystem):

```bash
# PURE: can be tested in isolation
calculate_checksum() {
  local -r input="$1"
  printf '%s' "${input}" | sha256sum | cut -d' ' -f1
}

# PURE: string transformation
normalize_path() {
  local -r path="$1"
  printf '%s' "${path}" | sed 's|//|/|g; s|/$||'
}

# IMPURE: wraps external command (mockable via CURL_CMD)
fetch_url() {
  local -r url="$1"
  "${CURL_CMD}" -sSfL "${url}"
}
```

### 10.3) Mockable Boundaries

Wrap all external commands in functions that can be overridden:

```bash
# Wrapper functions for external commands
_git() { command git "$@"; }
_curl() { "${CURL_CMD:-curl}" "$@"; }
_jq() { "${JQ_CMD:-jq}" "$@"; }

# In tests, override these:
# _git() { echo "mock git output"; }
```

### 10.4) Testable Main Guard

Always guard the main execution so the script can be sourced for testing:

```bash
# At the end of the script
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
```

### 10.5) Exit Code Contract

Document and enforce exit codes:

```bash
# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_CONFIG=3
readonly EXIT_RUNTIME=4
readonly EXIT_EXTERNAL=5
```

### 10.6) Dry-Run Support

All scripts with side effects MUST support `--dry-run`:

```bash
DRY_RUN="${DRY_RUN:-false}"

run_cmd() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would execute: $*"
    return 0
  fi
  "$@"
}

# Usage
run_cmd rm -rf "${temp_dir}"
run_cmd curl -X POST "${api_url}"
```

## 11) Testing Framework

This section defines a simple, embedded testing framework for Bash scripts. No external dependencies required.

### 11.1) Test File Structure

```bash
#!/usr/bin/env bash
# test-<script-name>.sh — Tests for <script-name>.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-<script-name>)"
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
  export TMPDIR="${_test_tmpdir}"
}

_test_teardown() {
  [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]] && rm -rf "${_test_tmpdir}"
}

trap '_test_teardown' EXIT

# Run a test function
run_test() {
  local -r name="$1"
  local -r func="$2"
  ((_test_count++))
  
  _test_setup
  
  if ( set -e; "${func}" ); then
    ((_test_passed++))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    ((_test_failed++))
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
  local -r path="$1" msg="${3:-}"
  if [[ ! -f "${path}" ]]; then
    printf '  File does not exist: %s\n' "${path}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_dir_exists() {
  local -r path="$1" msg="${3:-}"
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
source "${SCRIPT_DIR}/<script-name>.sh"

# ============================================================================
# TEST FIXTURES
# ============================================================================
setup_fixture_config() {
  local -r config_dir="${_test_tmpdir}/config"
  mkdir -p "${config_dir}"
  printf 'key=value\n' > "${config_dir}/settings.conf"
  printf '%s' "${config_dir}"
}

# ============================================================================
# TESTS
# ============================================================================
test_example_pure_function() {
  local result
  result="$(normalize_path "/foo//bar/")"
  assert_eq "/foo/bar" "${result}"
}

test_example_with_fixture() {
  local config_dir
  config_dir="$(setup_fixture_config)"
  assert_file_exists "${config_dir}/settings.conf"
}

test_example_exit_code() {
  local exit_code=0
  some_function "invalid_arg" || exit_code=$?
  assert_exit_code 2 "${exit_code}" "Should fail with usage error"
}

test_example_stdout_stderr() {
  local stdout stderr exit_code=0
  stdout="$(some_function "arg" 2>&1)" || exit_code=$?
  # Or capture separately:
  # { stdout="$(some_function "arg" 2>&1 1>&3 3>&-)"; } 3>&1
  assert_stdout_eq "expected output" "${stdout}"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"
  
  run_test "pure function works" test_example_pure_function
  run_test "fixture setup works" test_example_with_fixture
  run_test "exit code validation" test_example_exit_code
  run_test "stdout/stderr capture" test_example_stdout_stderr
  
  print_summary
}

main "$@"
```

### 11.2) Test Categories

Organize tests into three categories:

#### Unit Tests (fast, isolated)
- Test pure functions in isolation
- No filesystem, network, or external commands
- Mock all dependencies
- Run in milliseconds

```bash
test_unit_calculate_checksum() {
  local result
  result="$(calculate_checksum "hello")"
  assert_eq "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" "${result}"
}
```

#### Integration Tests (medium, controlled environment)
- Test interactions between functions
- Use temp directories for filesystem operations
- May call real external commands
- Run in seconds

```bash
test_integration_config_loading() {
  local config_dir
  config_dir="$(setup_fixture_config)"
  export CONFIG_DIR="${config_dir}"
  
  local result
  result="$(load_config)"
  assert_contains "${result}" "key=value"
}
```

#### Behavior Tests (slow, black-box)
- Test the script as a user would invoke it
- Assert on exit codes, stdout, stderr, and file side-effects
- No internal function testing
- Run in seconds to minutes

```bash
test_behavior_help_flag() {
  local stdout exit_code=0
  stdout="$("${SCRIPT_DIR}/<script-name>.sh" --help 2>&1)" || exit_code=$?
  assert_exit_code 0 "${exit_code}"
  assert_contains "${stdout}" "Usage:"
}

test_behavior_dry_run() {
  local stdout exit_code=0
  stdout="$(DRY_RUN=true "${SCRIPT_DIR}/<script-name>.sh" process 2>&1)" || exit_code=$?
  assert_exit_code 0 "${exit_code}"
  assert_contains "${stdout}" "[DRY-RUN]"
}
```

### 11.3) Mocking External Commands

```bash
# Mock git to return controlled output
mock_git() {
  _git() {
    case "$1" in
      rev-parse)
        printf '/mock/repo/root\n'
        ;;
      status)
        printf 'On branch main\nnothing to commit\n'
        ;;
      *)
        printf 'mock git: %s\n' "$*" >&2
        return 1
        ;;
    esac
  }
}

# Mock curl to return fixture data
mock_curl_success() {
  local -r fixture_file="$1"
  _curl() {
    cat "${fixture_file}"
  }
}

mock_curl_failure() {
  local -r exit_code="${1:-1}"
  _curl() {
    printf 'curl: (7) Failed to connect\n' >&2
    return "${exit_code}"
  }
}

# Usage in test
test_with_mocked_git() {
  mock_git
  local result
  result="$(get_repo_root)"
  assert_eq "/mock/repo/root" "${result}"
}
```

### 11.4) Capturing stdout/stderr Separately

```bash
# Capture stdout and stderr separately
capture_output() {
  local -n _stdout_ref="$1"
  local -n _stderr_ref="$2"
  local -n _exit_ref="$3"
  shift 3
  
  local _tmp_stdout _tmp_stderr
  _tmp_stdout="$(mktemp)"
  _tmp_stderr="$(mktemp)"
  
  _exit_ref=0
  "$@" >"${_tmp_stdout}" 2>"${_tmp_stderr}" || _exit_ref=$?
  
  _stdout_ref="$(cat "${_tmp_stdout}")"
  _stderr_ref="$(cat "${_tmp_stderr}")"
  
  rm -f "${_tmp_stdout}" "${_tmp_stderr}"
}

# Usage
test_capture_example() {
  local stdout stderr exit_code
  capture_output stdout stderr exit_code some_function "arg"
  
  assert_exit_code 0 "${exit_code}"
  assert_stdout_eq "expected" "${stdout}"
  assert_stderr_contains "${stderr}" "" "stderr should be empty"
}
```

### 11.5) Test Fixtures

```bash
# Create a fixture directory with known structure
create_project_fixture() {
  local -r base="${_test_tmpdir}/project"
  mkdir -p "${base}/src" "${base}/tests" "${base}/config"
  printf 'main() { echo "hello"; }\n' > "${base}/src/main.sh"
  printf 'CONFIG_VALUE=42\n' > "${base}/config/settings.conf"
  printf '%s' "${base}"
}

# Create a fixture file with content
create_file_fixture() {
  local -r path="$1"
  local -r content="$2"
  mkdir -p "$(dirname "${path}")"
  printf '%s' "${content}" > "${path}"
}
```

## 12) Test Aggregators

### 12.1) Top-Level Aggregator

Place at `scripts/test-all.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

trap 'printf "[ERROR] (test-all) line %s: %s (exit %s)\n" "$LINENO" "$BASH_COMMAND" "$?" >&2' ERR
trap ':' EXIT

readonly CONTEXT_TAG="(test-all)"
fail=0

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"

usage() {
  printf 'Usage: %s [BASE_DIR]\n' "$(basename -- "${BASH_SOURCE[0]}")"
  printf 'Run all test-*.sh in any .tests/ (or tests/) subfolders under BASE_DIR.\n'
  printf 'If BASE_DIR is omitted, defaults to: %s\n' "${script_dir}"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -n "${1:-}" ]]; then
  base_dir="$(cd -- "$1" >/dev/null 2>&1 && pwd -P)" || {
    printf '[ERROR] %s invalid BASE_DIR: %s\n' "${CONTEXT_TAG}" "$1" >&2
    exit 2
  }
else
  base_dir="${script_dir}"
fi

printf '[INFO]  %s scanning for tests under %s\n' "${CONTEXT_TAG}" "${base_dir}"

found_any=0

while IFS= read -r -d '' test_file; do
  found_any=1
  rel="${test_file#${base_dir}/}"
  printf '[INFO]  %s running %s\n' "${CONTEXT_TAG}" "${rel}"
  if ! bash "${test_file}"; then
    printf '[ERROR] %s FAILED %s\n' "${CONTEXT_TAG}" "${rel}" >&2
    fail=1
  fi
done < <(find "${base_dir}" -type f \( -path '*/.tests/*' -o -path '*/tests/*' \) -name 'test-*.sh' -perm -u+x -print0 | sort -z)

if [[ "${found_any}" -eq 0 ]]; then
  printf '[INFO]  %s no tests found under %s\n' "${CONTEXT_TAG}" "${base_dir}"
fi

exit "${fail}"
```

### 12.2) Aggregator Requirements

- Sort tests for stable output across runs
- Print relative paths for readability
- Return non-zero if any test fails
- Return success (0) if no tests found (not an error)
- Support optional base directory argument

## 13) Linting, Formatting, and CI

- Lint with ShellCheck; fix warnings or document exceptions inline with `# shellcheck disable=SC####`.
- Format with `shfmt -i 2 -ci -bn`.
- Run tests in CI on every PR.
- Consider pre-commit hooks to enforce lint/format and optionally run fast tests.

### 13.1) ShellCheck Configuration

Create `.shellcheckrc` in repo root:

```
# .shellcheckrc
shell=bash
enable=all
disable=SC2312  # Consider invoking this command separately
```

### 13.2) Pre-commit Hook

```bash
#!/usr/bin/env bash
# .git/hooks/pre-commit
set -Eeuo pipefail

# Lint all staged .sh files
staged_sh_files="$(git diff --cached --name-only --diff-filter=ACM | grep '\.sh$' || true)"
if [[ -n "${staged_sh_files}" ]]; then
  echo "Running ShellCheck..."
  echo "${staged_sh_files}" | xargs shellcheck
  
  echo "Running shfmt..."
  echo "${staged_sh_files}" | xargs shfmt -d
fi
```

## 14) Documentation

- Each script should contain:
  - A header describing purpose, dependencies, and examples.
  - A well-documented Settings/Configuration section with all tunables in one place.
  - Inline comments for non-obvious logic.
- Prefer self-documenting names over excessive comments.
- Document all environment variables that affect behavior.
- Document exit codes.

## 15) Reusable Patterns

- Centralized error handling (traps) and cleanup.
- Idempotent operations (safe to run multiple times).
- Dry-run support for destructive or large changes.
- Logging verbosity toggles.
- Testable main guard.
- Dependency injection via environment.

## 16) Reference Skeleton

```bash
#!/usr/bin/env bash
# <script-name>.sh — brief purpose
#
# Dependencies: bash>=4, jq, curl
# Usage: ./script.sh [options] <arg>
#
# Environment:
#   CONFIG_DIR  - Override config directory (default: ~/.config/myapp)
#   DRY_RUN     - Set to 'true' to skip destructive operations
#   VERBOSE     - Set to 'true' for debug output
#
# Exit codes:
#   0 - Success
#   2 - Usage error
#   3 - Configuration error
#   4 - Runtime error
#   5 - External command failure

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="script-name"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_CONFIG=3
readonly EXIT_RUNTIME=4
readonly EXIT_EXTERNAL=5

# Configurable via environment
readonly CONFIG_DIR="${CONFIG_DIR:-${HOME}/.config/${APP_NAME}}"
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

_on_exit() {
  # Cleanup temp files, etc.
  :
}

_on_interrupt() {
  log_warn "Interrupted"
  exit 130
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap '_on_exit' EXIT
trap '_on_interrupt' INT TERM

# ============================================================================
# UTILITIES
# ============================================================================
log_info()  { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*"; }
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*"; }
log_err()   { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*"; }
log_fatal() { log_err "$@"; exit "${EXIT_RUNTIME}"; }

die() { log_err "$@"; exit "${EXIT_USAGE}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

run_cmd() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would execute: $*"
    return 0
  fi
  "$@"
}

# ============================================================================
# MOCKABLE WRAPPERS (for testing)
# ============================================================================
_curl() { "${CURL_CMD:-curl}" "$@"; }
_jq() { "${JQ_CMD:-jq}" "$@"; }

# ============================================================================
# DOMAIN FUNCTIONS
# ============================================================================
do_work() {
  local -r arg="$1"
  log_info "Processing: ${arg}"
  # Implementation here
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
Usage: ${APP_NAME} [options] <arg>

Options:
  -h, --help      Show this help message
  -V, --version   Show version
  -n, --dry-run   Show what would be done without doing it
  -v, --verbose   Enable debug output

Examples:
  ${APP_NAME} process file.txt
  ${APP_NAME} --dry-run process file.txt
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
      -n|--dry-run) DRY_RUN=true ;;
      -v|--verbose) VERBOSE=true ;;
      --) shift; break ;;
      -*) die "Unknown option: $1" ;;
      *) break ;;
    esac
    shift
  done
  
  # Remaining args are positional
  ARGS=("$@")
}

validate_args() {
  [[ ${#ARGS[@]} -ge 1 ]] || die "Missing required argument. See --help."
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"
  validate_args
  
  require_cmd jq
  require_cmd curl
  
  do_work "${ARGS[0]}"
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
```

## 17) Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| `rm -rf $var` | Dangerous if var is empty/root | Validate var before rm |
| `cd dir && ...` | Pollutes shell state | Use subshell or pushd/popd |
| `echo $var` | Word splitting, escapes | Use `printf '%s\n' "${var}"` |
| `[ ... ]` | Less features, slower | Use `[[ ... ]]` |
| `cat file \| cmd` | UUOC | Use `cmd < file` |
| `for f in $(ls)` | Word splitting on spaces | Use `for f in *` or `find -print0` |
| Global variables | Hidden state, hard to test | Pass parameters explicitly |
| No error handling | Silent failures | Use `set -e` + traps |
| Hardcoded paths | Not testable | Use env vars for injection |
| Interactive prompts | Breaks automation | Use flags or env vars |

## 18) Checklist for New Scripts

Before committing a new script, verify:

- [ ] Shebang is `#!/usr/bin/env bash`
- [ ] Strict mode enabled (`set -Eeuo pipefail`)
- [ ] Traps configured for ERR, EXIT, INT, TERM
- [ ] All variables quoted
- [ ] `-h/--help` and `--version` supported
- [ ] Inputs validated early
- [ ] Exit codes documented and consistent
- [ ] Logging uses context tag
- [ ] External dependencies checked with `require_cmd`
- [ ] Temp files use `mktemp` and cleaned in trap
- [ ] `--dry-run` supported for destructive operations
- [ ] Testable main guard present
- [ ] Dependencies injectable via environment
- [ ] ShellCheck passes with no warnings
- [ ] shfmt formatting applied
- [ ] Tests written and passing

Adhering to these rules will keep our Bash scripts robust, readable, testable, and easy to evolve.
