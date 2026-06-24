#!/usr/bin/env bash
# test-all.sh — Run every test-*.sh under scripts/.tests/ (and any other
# .tests/ or tests/ folder beneath BASE_DIR).
#
# Dependencies: bash>=4, find
# Usage: ./test-all.sh [BASE_DIR]
#
# Exit codes:
#   0 - All tests passed (or no tests found)
#   1 - One or more test files failed
#   2 - Invalid BASE_DIR argument

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="test-all"
readonly LOG_TAG="(${APP_NAME})"

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  printf '[ERROR] %s line %s: %s (exit %s)\n' "${LOG_TAG}" "${line}" "${cmd}" "${code}" >&2
}
trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap ':' EXIT

# ============================================================================
# UTILITIES
# ============================================================================
log_info() { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*"; }
log_err()  { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }

usage() {
  printf 'Usage: %s [BASE_DIR]\n' "$(basename -- "${BASH_SOURCE[0]}")"
  printf 'Run every test-*.sh in any .tests/ (or tests/) folder under BASE_DIR.\n'
  printf 'BASE_DIR defaults to this script'"'"'s directory.\n'
}

# ============================================================================
# MAIN
# ============================================================================
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -n "${1:-}" ]]; then
  base_dir="$(cd -- "$1" >/dev/null 2>&1 && pwd -P)" || {
    log_err "invalid BASE_DIR: $1"
    exit 2
  }
else
  base_dir="${script_dir}"
fi

log_info "scanning for tests under ${base_dir}"

fail=0
found_any=0

# Discover test files: must live under a .tests/ or tests/ folder, be named
# test-*.sh, and be executable. Sorted for stable output. Piped via process
# substitution so the while-loop runs in this shell (fail var persists).
while IFS= read -r -d '' test_file; do
  found_any=1
  rel="${test_file#${base_dir}/}"
  log_info "running ${rel}"
  if ! bash "${test_file}"; then
    log_err "FAILED ${rel}"
    fail=1
  fi
done < <(find "${base_dir}" -type f \( -path '*/.tests/*' -o -path '*/tests/*' \) -name 'test-*.sh' -perm -u+x -print0 | sort -z)

if [[ "${found_any}" -eq 0 ]]; then
  log_info "no tests found under ${base_dir}"
fi

if [[ "${fail}" -ne 0 ]]; then
  log_err "one or more test files failed"
  exit 1
fi

log_info "all tests passed"
exit 0
