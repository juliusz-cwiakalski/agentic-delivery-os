#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/test-text-to-image-e2e-providers.sh
#
# test-text-to-image-e2e-providers.sh — End-to-end test: generate images from every model across all providers
#
# This is NOT a unit/integration test using the test framework. It is a standalone
# e2e exploration script that calls real APIs for every known model and produces
# a summary table showing pass/fail/skip/not-configured status.
#
# Dependencies: bash>=4, jq, timeout (GNU coreutils)
#
# Usage: bash tools/.tests/test-text-to-image-e2e-providers.sh [options]
#
# Environment variables:
#   PROMPT          - Text prompt for image generation (default: landscape architect garden scene)
#   OUTPUT_PREFIX   - Filename prefix (default: "e2e")
#   OUTPUT_DIR      - Output directory for generated images (default: <repo>/tmp/e2e-provider-tests)
#   TIMEOUT         - Timeout in seconds per model generation (default: 120)
#   VERBOSE         - Set to 'true' for debug output
#   WIDTH           - Image width passed as --width to the tool (default: tool default 1024)
#   HEIGHT          - Image height passed as --height to the tool (default: tool default 1024)
#   QUALITY         - Quality profile passed as --quality to the tool (default: tool default "high")
#   NEGATIVE_PROMPT - Negative prompt passed as --negative-prompt to the tool (default: not passed)
#   FORCE           - Set to 'true' to bypass cache and regenerate all images (default: false)
#
# Exit codes:
#   0 - All configured models passed (or were skipped)
#   1 - One or more configured models failed

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="test-text-to-image-e2e-providers"
readonly LOG_TAG="(${APP_NAME})"

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly TOOL_PATH="${SCRIPT_DIR}/../text-to-image"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"

PROMPT="${PROMPT:-Photorealistic aerial view of a modern residential garden design by a landscape architect, featuring a curved stone pathway through lush green lawn, raised wooden deck with outdoor dining furniture, ornamental grasses and lavender borders, a small water feature with natural stones, mature olive tree providing shade, warm golden hour sunlight, professional architectural visualization}"
OUTPUT_PREFIX="${OUTPUT_PREFIX:-e2e}"
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/tmp/e2e-provider-tests}"
TIMEOUT="${TIMEOUT:-120}"
VERBOSE="${VERBOSE:-false}"
WIDTH="${WIDTH:-}"
HEIGHT="${HEIGHT:-}"
QUALITY="${QUALITY:-}"
NEGATIVE_PROMPT="${NEGATIVE_PROMPT:-}"
FORCE="${FORCE:-false}"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_FAILURE=1
readonly EXIT_USAGE=2

# Result tracking arrays
declare -a RESULT_STATUS=()
declare -a RESULT_PROVIDER=()
declare -a RESULT_MODEL=()
declare -a RESULT_DETAILS=()

# Counters
_count_pass=0
_count_fail=0
_count_skip=0
_count_noconfig=0
_count_total=0

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
  log_warn "Interrupted — printing partial results"
  print_summary_table
  exit 130
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap '_on_exit' EXIT
trap '_on_interrupt' INT TERM

# ============================================================================
# UTILITIES
# ============================================================================
log_info()  { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_err()   { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*" >&2 || true; }

die() { log_err "$@"; exit "${EXIT_USAGE}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ============================================================================
# DOMAIN FUNCTIONS
# ============================================================================

# Sanitize model ID for use in filenames: replace / and : with _
sanitize_model_id() {
  local -r model_id="$1"
  printf '%s' "${model_id}" | tr '/:' '__'
}

# Format file size in human-readable form (KB, MB)
format_file_size() {
  local -r file="$1"
  local size_bytes
  size_bytes="$(stat --format='%s' "${file}" 2>/dev/null || stat -f '%z' "${file}" 2>/dev/null || printf '0')"

  if [[ "${size_bytes}" -ge 1048576 ]]; then
    printf '%.1f MB' "$(awk "BEGIN {printf \"%.1f\", ${size_bytes}/1048576}")"
  elif [[ "${size_bytes}" -ge 1024 ]]; then
    printf '%d KB' "$(( size_bytes / 1024 ))"
  else
    printf '%d B' "${size_bytes}"
  fi
}

# Record a result for the summary table
record_result() {
  local -r status="$1" provider="$2" model="$3" details="$4"
  RESULT_STATUS+=("${status}")
  RESULT_PROVIDER+=("${provider}")
  RESULT_MODEL+=("${model}")
  RESULT_DETAILS+=("${details}")
}

# Fetch all models from the tool as TSV lines: provider\tmodel\tname\tconfigured
fetch_all_models() {
  local raw_json
  raw_json="$("${TOOL_PATH}" --list-models --all-models --output-format json 2>/dev/null)"

  # Fix known JSON escaping issue (unescaped quotes in description fields)
  # shellcheck disable=SC2001
  raw_json="$(sed 's/""\([^"]*\)""/"\1"/g' <<< "${raw_json}")"

  jq -r '.[] | [.provider, .model, .name, (.configured | tostring)] | @tsv' <<< "${raw_json}"
}

# Generate image for a single model, capturing result
test_single_model() {
  local -r provider="$1" model="$2" name="$3" configured="$4"
  local -r sanitized_model="$(sanitize_model_id "${model}")"
  local -r output_file="${OUTPUT_DIR}/${OUTPUT_PREFIX}--${provider}--${sanitized_model}.png"

  _count_total=$(( _count_total + 1 ))

  # Not configured → skip
  if [[ "${configured}" != "true" ]]; then
    log_info "NOT CONFIGURED: ${provider}/${model} (${name})"
    record_result "NOT_CONFIGURED" "${provider}" "${model}" "provider not configured"
    _count_noconfig=$(( _count_noconfig + 1 ))
    return 0
  fi

  # Already exists → skip (unless force refresh)
  if [[ "${FORCE:-}" != "true" && -f "${output_file}" && -s "${output_file}" ]]; then
    local existing_size
    existing_size="$(format_file_size "${output_file}")"
    log_info "SKIPPED (exists): ${provider}/${model} → ${output_file} (${existing_size})"
    record_result "SKIPPED" "${provider}" "${model}" "file exists (${existing_size})"
    _count_skip=$(( _count_skip + 1 ))
    return 0
  fi

  # Attempt generation
  log_info "GENERATING: ${provider}/${model} (${name}) → ${output_file}"

  local stderr_file
  stderr_file="$(mktemp)"
  local exit_code=0

  local -a extra_args=()
  [[ -n "${WIDTH:-}" ]] && extra_args+=(--width "${WIDTH}")
  [[ -n "${HEIGHT:-}" ]] && extra_args+=(--height "${HEIGHT}")
  [[ -n "${QUALITY:-}" ]] && extra_args+=(--quality "${QUALITY}")
  [[ -n "${NEGATIVE_PROMPT:-}" ]] && extra_args+=(--negative-prompt "${NEGATIVE_PROMPT}")
  [[ "${FORCE:-}" == "true" ]] && extra_args+=(--force)

  # shellcheck disable=SC2086
  timeout "${TIMEOUT}" \
    "${TOOL_PATH}" \
    --prompt "${PROMPT}" \
    --output "${output_file}" \
    --provider "${provider}" \
    --model "${model}" \
    ${extra_args[@]+"${extra_args[@]}"} \
    --verbose \
    2>"${stderr_file}" || exit_code=$?

  if [[ "${exit_code}" -eq 0 && -f "${output_file}" && -s "${output_file}" ]]; then
    local file_size
    file_size="$(format_file_size "${output_file}")"
    log_info "PASS: ${provider}/${model} (${file_size})"
    record_result "PASS" "${provider}" "${model}" "${file_size}"
    _count_pass=$(( _count_pass + 1 ))
  else
    local error_detail="exit ${exit_code}"
    if [[ -s "${stderr_file}" ]]; then
      local first_error
      first_error="$(grep -m1 '\[ERROR\]' "${stderr_file}" 2>/dev/null || head -1 "${stderr_file}" 2>/dev/null || true)"
      # Truncate for display
      if [[ -n "${first_error}" ]]; then
        first_error="${first_error:0:80}"
        error_detail="exit ${exit_code}: ${first_error}"
      fi
    fi
    log_err "FAIL: ${provider}/${model} — ${error_detail}"
    record_result "FAIL" "${provider}" "${model}" "${error_detail}"
    _count_fail=$(( _count_fail + 1 ))
  fi

  rm -f "${stderr_file}"
  return 0
}

# Print the final summary table to stdout
print_summary_table() {
  local -r total="${_count_total}"
  local -r col_status=18
  local -r col_provider=14
  local -r col_model=50
  local sep

  local prompt_display="${PROMPT}"
  if [[ "${#prompt_display}" -gt 80 ]]; then
    prompt_display="${prompt_display:0:80}..."
  fi

  local settings_display="defaults"
  local -a settings_parts=()
  if [[ -n "${WIDTH:-}" || -n "${HEIGHT:-}" ]]; then
    settings_parts+=("${WIDTH:-1024}x${HEIGHT:-1024}")
  fi
  if [[ -n "${QUALITY:-}" ]]; then
    settings_parts+=("quality=${QUALITY}")
  fi
  if [[ ${#settings_parts[@]} -gt 0 ]]; then
    settings_display="$(printf '%s, ' "${settings_parts[@]}")"
    settings_display="${settings_display%, }"
  fi

  printf '\n'
  printf '=================================================================\n'
  printf 'End-to-End Provider Test Results\n'
  printf 'Prompt: %s\n' "${prompt_display}"
  printf 'Settings: %s\n' "${settings_display}"
  printf '=================================================================\n'
  printf '  %-*s | %-*s | %-*s | %s\n' "${col_status}" "Status" "${col_provider}" "Provider" "${col_model}" "Model" "Details"
  sep="$(printf '%0.s-' {1..140})"
  printf '%s\n' "${sep}"

  local i
  for (( i=0; i<${#RESULT_STATUS[@]}; i++ )); do
    local status="${RESULT_STATUS[${i}]}"
    local provider="${RESULT_PROVIDER[${i}]}"
    local model="${RESULT_MODEL[${i}]}"
    local details="${RESULT_DETAILS[${i}]}"
    local icon

    case "${status}" in
      PASS)           icon="✓ PASS"           ;;
      FAIL)           icon="✗ FAIL"           ;;
      SKIPPED)        icon="⊘ SKIPPED"        ;;
      NOT_CONFIGURED) icon="○ NOT CONFIGURED" ;;
      *)              icon="? ${status}"      ;;
    esac

    printf '  %-*s | %-*s | %-*s | %s\n' \
      "${col_status}" "${icon}" \
      "${col_provider}" "${provider}" \
      "${col_model}" "${model}" \
      "${details}"
  done

  printf '%s\n' "${sep}"
  printf 'Summary: %d passed, %d failed, %d skipped, %d not configured (%d total)\n' \
    "${_count_pass}" "${_count_fail}" "${_count_skip}" "${_count_noconfig}" "${total}"
  printf '=================================================================\n'
}

# Run all model tests
run_all_tests() {
  log_info "Fetching all known models from ${TOOL_PATH}..."
  local models_tsv
  models_tsv="$(fetch_all_models)"

  local line_count
  line_count="$(wc -l <<< "${models_tsv}")"
  log_info "Found ${line_count} models to test"
  log_info "Prompt: ${PROMPT}"
  log_info "Output directory: ${OUTPUT_DIR}"
  log_info "Timeout per model: ${TIMEOUT}s"
  [[ -n "${WIDTH:-}" ]] && log_info "Width: ${WIDTH}"
  [[ -n "${HEIGHT:-}" ]] && log_info "Height: ${HEIGHT}"
  [[ -n "${QUALITY:-}" ]] && log_info "Quality: ${QUALITY}"
  [[ -n "${NEGATIVE_PROMPT:-}" ]] && log_info "Negative prompt: ${NEGATIVE_PROMPT}"
  [[ "${FORCE:-}" == "true" ]] && log_info "Force refresh: enabled (bypassing cache)"
  printf '\n' >&2

  mkdir -p "${OUTPUT_DIR}"

  local provider model name configured
  while IFS=$'\t' read -r provider model name configured; do
    test_single_model "${provider}" "${model}" "${name}" "${configured}"
  done <<< "${models_tsv}"
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat >&2 <<EOF
Usage: ${APP_NAME} [options]

End-to-end test: generate images from every known model across all providers.
Calls real APIs for configured providers. Skips unconfigured providers and
already-generated files (safe to re-run).

Output goes to <repo>/tmp/e2e-provider-tests/ by default.

Options:
  -h, --help      Show this help message
  -v, --verbose   Enable debug output

Environment variables:
  PROMPT          Text prompt (default: landscape architect garden scene)
  OUTPUT_PREFIX   Filename prefix (default: "e2e")
  OUTPUT_DIR      Output directory (default: <repo>/tmp/e2e-provider-tests)
  TIMEOUT         Timeout per model in seconds (default: 120)
  VERBOSE         Set to 'true' for debug output
  WIDTH           Image width (passed as --width to tool; default: tool default 1024)
  HEIGHT          Image height (passed as --height to tool; default: tool default 1024)
  QUALITY         Quality profile (passed as --quality; default: tool default "high")
  NEGATIVE_PROMPT Negative prompt (passed as --negative-prompt; default: not passed)
  FORCE           Set to 'true' to bypass cache and regenerate (default: false)

Examples:
  # Run from repo root (default prompt and output dir):
  bash tools/.tests/test-text-to-image-e2e-providers.sh

  # Run with custom prompt and timeout:
  PROMPT="A red circle on white" TIMEOUT=60 bash tools/.tests/test-text-to-image-e2e-providers.sh

  # Verbose mode, custom output directory:
  bash tools/.tests/test-text-to-image-e2e-providers.sh --verbose
  OUTPUT_DIR=./tmp/my-test bash tools/.tests/test-text-to-image-e2e-providers.sh

  # Re-run to fill gaps (skips already-generated images):
  bash tools/.tests/test-text-to-image-e2e-providers.sh

  # Force regeneration (bypass cache):
  FORCE=true bash tools/.tests/test-text-to-image-e2e-providers.sh
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -v|--verbose) VERBOSE=true ;;
      --) shift; break ;;
      -*) die "Unknown option: $1" ;;
      *) break ;;
    esac
    shift
  done
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"

  require_cmd jq
  require_cmd timeout

  [[ -x "${TOOL_PATH}" ]] || die "Tool not found or not executable: ${TOOL_PATH}"

  run_all_tests
  print_summary_table

  if [[ "${_count_fail}" -gt 0 ]]; then
    log_info "${_count_fail} model(s) failed — exiting with status 1"
    exit "${EXIT_FAILURE}"
  fi
  exit "${EXIT_SUCCESS}"
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
