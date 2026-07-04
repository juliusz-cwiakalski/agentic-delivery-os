#!/usr/bin/env bash
# batch-deliver.sh — Sequential batch delivery with pre-flight skip
#
# Runs deliver-ticket.sh for each ticket sequentially. Skips tickets that are
# already closed, blocked (human-input-needed), or have merged PRs. Logs a
# human-readable summary with timestamps and durations. Safe to re-run
# (idempotent — skips already-done tickets).
#
# Dependencies: bash>=4, gh, jq
# Usage: batch-deliver.sh [options] <ticket[:branch]>...
#
# Exit codes:
#   0 - All tickets succeeded (merged, blocked, or pr-open)
#   1 - One or more tickets failed
#   2 - Usage error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="batch-deliver"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

readonly EXIT_USAGE=2

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
readonly SCRIPT_DIR
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd -P)"
readonly ROOT_DIR

readonly DELIVER_SCRIPT="${SCRIPT_DIR}/deliver-ticket.sh"
readonly CLEAN_TOOL="${ROOT_DIR}/tools/clean-merged-branches"
readonly SUMMARY_LOG="${ROOT_DIR}/tmp/batch-deliver-summary.log"

DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# Parsed ticket arrays
PARSED_TICKETS=()
PARSED_BRANCHES=()

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap 'log_warn "Interrupted"; exit 130' INT TERM

# ============================================================================
# LOGGING
# ============================================================================
_ts() { date '+%H:%M:%S'; }

log_info()   { printf '[%s] ℹ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_warn()   { printf '[%s] ⚠ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_err()    { printf '[%s] ✗ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_debug()  { [[ "${VERBOSE}" == "true" ]] && printf '[%s] ℹ DEBUG %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2 || true; }

die() { log_err "$@"; exit "${EXIT_USAGE}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ============================================================================
# MOCKABLE WRAPPERS
# ============================================================================
_gh() { command gh "$@"; }
_jq() { command jq "$@"; }

# ============================================================================
# INPUT PARSING (pure functions)
# ============================================================================

# PURE: Extract ticket ref from a spec string
extract_ticket_ref() {
  local -r input="$1"
  printf '%s' "${input%%:*}"
}

# PURE: Extract branch from a spec string (empty if not present)
extract_branch() {
  local -r input="$1"
  if [[ "${input}" == *":"* ]]; then
    printf '%s' "${input#*:}"
  else
    printf ''
  fi
}

# PURE: Convert workItemRef (GH-37) to bare issue number (37) for gh CLI
to_issue_number() {
  local -r ticket_ref="$1"
  printf '%s' "${ticket_ref#*-}"
}

# Add a ticket spec to the parsed arrays
add_ticket() {
  local -r spec="$1"
  PARSED_TICKETS+=("$(extract_ticket_ref "${spec}")")
  PARSED_BRANCHES+=("$(extract_branch "${spec}")")
}

# Load tickets from a file (one per line, skipping blanks and comments)
load_tickets_file() {
  local -r file="$1"
  [[ -f "${file}" ]] || die "Tickets file not found: ${file}"
  local line
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"  # trim leading whitespace
    line="${line%"${line##*[![:space:]]}"}"   # trim trailing whitespace
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    add_ticket "${line}"
  done <"${file}"
}

# ============================================================================
# PRE-FLIGHT CHECK
# ============================================================================

# Check if a ticket should be skipped.
# Prints skip reason (closed|blocked|merged) and returns 0 if should skip.
# Prints nothing and returns 1 if should proceed.
should_skip_ticket() {
  local -r ticket_ref="$1"

  local issue_json
  issue_json="$(_gh issue view "$(to_issue_number "${ticket_ref}")" --json state,labels 2>/dev/null)" || {
    return 1  # Can't determine state → don't skip
  }

  local state
  state="$(printf '%s' "${issue_json}" | _jq -r '.state // empty' 2>/dev/null)" || state=""

  # Closed → skip
  if [[ "${state}" == "CLOSED" ]]; then
    printf 'closed'
    return 0
  fi

  # human-input-needed → skip
  if printf '%s' "${issue_json}" | _jq -r '.labels[].name' 2>/dev/null | grep -q 'human-input-needed'; then
    printf 'blocked'
    return 0
  fi

  # Merged PR → skip
  local merged_json
  merged_json="$(_gh pr list --search "${ticket_ref}" --state closed --json mergedAt 2>/dev/null)" || merged_json='[]'
  if printf '%s' "${merged_json}" | _jq -e '.[0].mergedAt' >/dev/null 2>&1; then
    printf 'merged'
    return 0
  fi

  return 1  # Don't skip
}

# ============================================================================
# DURATION FORMATTING (pure function)
# ============================================================================

# PURE: Format seconds into human-readable duration.
# Examples: 45 → "45s", 123 → "2m 3s", 2723 → "45m 23s", 3723 → "1h 2m"
format_duration() {
  local -r total_seconds="$1"
  local hours mins secs

  hours=$((total_seconds / 3600))
  mins=$(((total_seconds % 3600) / 60))
  secs=$((total_seconds % 60))

  if (( hours > 0 )); then
    printf '%dh %dm' "${hours}" "${mins}"
  elif (( mins > 0 )); then
    printf '%dm %ds' "${mins}" "${secs}"
  else
    printf '%ds' "${secs}"
  fi
}

# ============================================================================
# SUMMARY LOGGING
# ============================================================================

log_batch_start() {
  local -r index="$1" total="$2" ticket="$3"
  printf '[%s] [%s/%s] ▶ START %s\n' "$(_ts)" "${index}" "${total}" "${ticket}" >&2
}

log_batch_skip() {
  local -r index="$1" total="$2" ticket="$3" reason="$4"
  printf '[%s] [%s/%s] ⊘ SKIP %s — %s\n' "$(_ts)" "${index}" "${total}" "${ticket}" "${reason}" >&2
}

log_batch_done() {
  local -r index="$1" total="$2" ticket="$3" detail="$4" duration="$5"
  printf '[%s] [%s/%s] ✓ DONE %s — %s (%s)\n' "$(_ts)" "${index}" "${total}" "${ticket}" "${detail}" "${duration}" >&2
}

log_batch_blocked() {
  local -r index="$1" total="$2" ticket="$3" detail="$4" duration="$5"
  printf '[%s] [%s/%s] ⏸ BLOCKED %s — %s (%s)\n' "$(_ts)" "${index}" "${total}" "${ticket}" "${detail}" "${duration}" >&2
}

log_batch_failed() {
  local -r index="$1" total="$2" ticket="$3" detail="$4" duration="$5"
  printf '[%s] [%s/%s] ✗ FAILED %s — %s (%s)\n' "$(_ts)" "${index}" "${total}" "${ticket}" "${detail}" "${duration}" >&2
}

# PURE: Format the final batch summary line block
print_batch_summary() {
  local -r total="$1" merged="$2" skipped="$3" failed="$4" duration="$5"
  printf '\n═══ Batch complete: %d tickets in %s ═══\n' "${total}" "${duration}"
  printf '  Merged/Done: %d\n' "${merged}"
  printf '  Skipped:     %d\n' "${skipped}"
  printf '  Failed:      %d\n' "${failed}"
}

# ============================================================================
# SEQUENTIAL EXECUTION
# ============================================================================

run_batch() {
  local total=${#PARSED_TICKETS[@]}
  [[ ${total} -gt 0 ]] || { log_info "No tickets to process"; return 0; }

  local batch_start_epoch
  batch_start_epoch="$(date +%s)"

  local results_merged=0 results_skipped=0 results_failed=0

  local i
  for ((i = 0; i < total; i++)); do
    local ticket="${PARSED_TICKETS[$i]}"
    local branch="${PARSED_BRANCHES[$i]}"
    local index=$((i + 1))

    log_batch_start "${index}" "${total}" "${ticket}"

    # Pre-flight check
    local skip_reason=""
    skip_reason="$(should_skip_ticket "${ticket}" 2>/dev/null)" || skip_reason=""
    if [[ -n "${skip_reason}" ]]; then
      log_batch_skip "${index}" "${total}" "${ticket}" "${skip_reason}"
      results_skipped=$((results_skipped + 1))
      continue
    fi

    # Build input for deliver-ticket.sh
    local input="${ticket}"
    [[ -n "${branch}" ]] && input="${ticket}:${branch}"

    # Run deliver-ticket.sh
    local ticket_start_epoch exit_code=0
    ticket_start_epoch="$(date +%s)"

    if [[ "${DRY_RUN}" == "true" ]]; then
      log_info "[DRY-RUN] Would run: deliver-ticket.sh ${input}"
      exit_code=0
    else
      "${DELIVER_SCRIPT}" "${input}" || exit_code=$?
    fi

    local ticket_end_epoch duration
    ticket_end_epoch="$(date +%s)"
    duration="$(format_duration $((ticket_end_epoch - ticket_start_epoch)))"

    # Classify result
    if [[ ${exit_code} -eq 0 ]]; then
      log_batch_done "${index}" "${total}" "${ticket}" "completed" "${duration}"
      results_merged=$((results_merged + 1))
    else
      log_batch_failed "${index}" "${total}" "${ticket}" "exit=${exit_code}" "${duration}"
      results_failed=$((results_failed + 1))
    fi

    # Clean merged branches between tickets
    if [[ -x "${CLEAN_TOOL}" ]]; then
      log_debug "Running clean-merged-branches between tickets"
      "${CLEAN_TOOL}" --allow-dirty 2>/dev/null || true
    fi
  done

  # Final summary
  local batch_end_epoch total_duration
  batch_end_epoch="$(date +%s)"
  total_duration="$(format_duration $((batch_end_epoch - batch_start_epoch)))"

  print_batch_summary "${total}" "${results_merged}" "${results_skipped}" "${results_failed}" "${total_duration}"

  # Write summary log
  mkdir -p "$(dirname "${SUMMARY_LOG}")"
  {
    printf 'Batch delivery — %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'Total: %d, Merged: %d, Skipped: %d, Failed: %d, Duration: %s\n' \
      "${total}" "${results_merged}" "${results_skipped}" "${results_failed}" "${total_duration}"
  } >>"${SUMMARY_LOG}"

  [[ ${results_failed} -eq 0 ]]
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
${APP_NAME} ${APP_VERSION} — sequential batch delivery with pre-flight skip

Usage: ${APP_NAME} [options] <ticket[:branch]>...

Runs deliver-ticket.sh for each ticket sequentially. Skips tickets that are
already closed, blocked, or merged. Idempotent — safe to re-run.

Input formats:
  ${APP_NAME} GH-108 GH-110 GH-37                    Positional tickets
  ${APP_NAME} GH-108:fix/branch GH-110:feat/branch   Ticket:branch pairs
  ${APP_NAME} GH-108:fix/branch GH-110 GH-37         Mixed
  ${APP_NAME} --tickets-file tickets.txt              From file (one per line)

Options:
  -h, --help                  Show this help message
  -V, --version               Show version
  -n, --dry-run               Show what would be done
  -v, --verbose               Enable debug output
  --tickets-file <path>       Read tickets from file (one per line)

Environment:
  DRY_RUN                     Dry-run mode
  VERBOSE                     Debug output

Exit codes:
  0 - All tickets succeeded
  1 - One or more tickets failed
  2 - Usage error
EOF
}

parse_args() {
  local tickets_file=""
  local positional=()

  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
      -n|--dry-run) DRY_RUN=true ;;
      -v|--verbose) VERBOSE=true ;;
      --tickets-file)
        [[ $# -ge 2 ]] || die "--tickets-file requires a value"
        tickets_file="$2"; shift ;;
      --) shift; positional+=("$@"); break ;;
      -*) die "Unknown option: $1" ;;
      *) positional+=("$1") ;;
    esac
    shift
  done

  # Process positional args
  local arg
  for arg in "${positional[@]}"; do
    add_ticket "${arg}"
  done

  # Process tickets file
  if [[ -n "${tickets_file}" ]]; then
    load_tickets_file "${tickets_file}"
  fi
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"

  require_cmd gh
  require_cmd jq

  local total=${#PARSED_TICKETS[@]}
  [[ ${total} -gt 0 ]] || die "No tickets provided. See --help."

  log_info "Starting batch delivery of ${total} ticket(s)"
  local _i
  for ((_i = 0; _i < total; _i++)); do
    local _t="${PARSED_TICKETS[$_i]}" _b="${PARSED_BRANCHES[$_i]}"
    if [[ -n "${_b}" ]]; then
      log_info "  $((_i + 1))/${total}: ${_t}:${_b}"
    else
      log_info "  $((_i + 1))/${total}: ${_t}"
    fi
  done

  run_batch
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
