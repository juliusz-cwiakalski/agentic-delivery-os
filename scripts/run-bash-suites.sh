#!/usr/bin/env bash
# run-bash-suites.sh — discover and execute every CI-safe shell suite from the
# current working directory, aggregating child exit statuses (GH-251 DM-2).
#
# Dependencies: bash>=4, find
# Usage: ./run-bash-suites.sh [--help] [--version]
#
# Exit codes:
#   0 - Every discovered suite passed (also when zero suites were discovered)
#   1 - At least one discovered suite failed or could not be executed
#   2 - Usage error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="run-bash-suites"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

readonly EXIT_SUCCESS=0
readonly EXIT_FAILURE=1
readonly EXIT_USAGE=2

# The discovery expression is byte-identical to the CI expression this runner
# replaces (GH-251 TC-CIPROP-005): no -type filter, no sort, no new exclusion.
readonly FIND_EXPRESSION=(
  find . -path '*/.tests/test-*.sh'
  -not -path './tmp/*'
  -not -name '*e2e-providers*'
  -not -name '*e2e-suite*'
  -not -name '*performance*'
)

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

_on_exit() {
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
log_info() { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*"; }
log_warn() { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*"; }
log_err() { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE:-false}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*"; }

usage() {
  cat <<EOF
Usage: ${APP_NAME} [--help] [--version]

Discover every .tests/test-*.sh suite under the current working directory,
execute each one with bash, and fail if any suite fails or cannot run.

Discovery scope (identical to the CI expression this runner replaces):
  - include: */.tests/test-*.sh
  - exclude: ./tmp/*, *e2e-providers*, *e2e-suite*, *performance*

The runner is CWD-rooted: invoking it from the repository root and from a
synthetic tree are the same contract. It writes nothing and mutates no file.

Exit codes:
  0  all discovered suites passed (or none were discovered)
  1  at least one suite failed or could not be executed
  2  usage error
EOF
}

# ============================================================================
# DOMAIN
# ============================================================================
discover_suites() {
  local output="" rc=0
  # Fail closed: process substitution would discard find's exit status, so a
  # discovery error (e.g. an unreadable directory) must abort before any suite
  # runs instead of silently aggregating a partial set.
  output="$("${FIND_EXPRESSION[@]}" -print)" || rc=$?
  if (( rc != 0 )); then
    log_err "suite discovery failed: find exited ${rc}"
    exit "${EXIT_FAILURE}"
  fi
  local -a suites=()
  if [[ -n "${output}" ]]; then
    mapfile -t suites <<< "${output}"
  fi
  SUITES=("${suites[@]}")
}

run_suites() {
  local -a failures=()
  local suite rc=0
  local total=0 passed=0 failed=0

  if (( ${#SUITES[@]} == 0 )); then
    log_info "discovered 0 suites; nothing to run"
    printf '[SUMMARY] %s discovered 0 suites; 0 passed; 0 failed\n' "${LOG_TAG}"
    return "${EXIT_SUCCESS}"
  fi

  log_info "discovered ${#SUITES[@]} suites"

  for suite in "${SUITES[@]}"; do
    total=$((total + 1))
    log_info "running ${suite}"
    rc=0
    # Deliberately no `set -e` short-circuit across suites: capture each child's
    # status and aggregate it. A status of 126/127 (cannot execute) is a failure,
    # never a skip.
    bash "${suite}" || rc=$?
    if (( rc == 0 )); then
      passed=$((passed + 1))
      printf '[PASS] %s\n' "${suite}"
    else
      failed=$((failed + 1))
      failures+=("${suite}")
      printf '[FAIL] %s (exit %s)\n' "${suite}" "${rc}"
    fi
  done

  if (( failed > 0 )); then
    printf '\n[SUMMARY] %s discovered %d suites; %d passed; %d failed\n' \
      "${LOG_TAG}" "${total}" "${passed}" "${failed}"
    printf '[SUMMARY] %s failing suites:\n' "${LOG_TAG}"
    for suite in "${failures[@]}"; do
      printf '[SUMMARY] %s   - %s\n' "${LOG_TAG}" "${suite}"
    done
    return "${EXIT_FAILURE}"
  fi

  printf '\n[SUMMARY] %s discovered %d suites; %d passed; 0 failed\n' \
    "${LOG_TAG}" "${total}" "${passed}"
  return "${EXIT_SUCCESS}"
}

# ============================================================================
# CLI
# ============================================================================
parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit "${EXIT_SUCCESS}" ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit "${EXIT_SUCCESS}" ;;
      --) shift; break ;;
      -*) log_err "Unknown option: $1"; usage >&2; exit "${EXIT_USAGE}" ;;
      *) log_err "Unexpected argument: $1"; usage >&2; exit "${EXIT_USAGE}" ;;
    esac
    shift
  done
}

main() {
  parse_args "$@"
  discover_suites
  run_suites || exit "${EXIT_FAILURE}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
