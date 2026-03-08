#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/test-text-to-image-e2e-suite.sh
#
# test-text-to-image-e2e-suite.sh — E2E battle-test suite for text-to-image
#
# Runs the e2e-providers script multiple times with different prompts and settings
# to battle-test all configured models across realistic web development scenarios.
#
# WARNING: This script calls REAL PAID APIs. It is NOT meant for CI/CD.
# Each full run generates images across all configured providers/models.
# Estimated cost depends on configured providers (~$0.03 avg per generation).
#
# Dependencies: bash>=4, jq, timeout (GNU coreutils)
#
# Usage: bash tools/.tests/test-text-to-image-e2e-suite.sh [options]
#
# Environment variables:
#   SUITE_OUTPUT_DIR  Output directory (default: <repo>/tmp/e2e-suite)
#   TIMEOUT           Timeout per model in seconds (default: 180)
#   VERBOSE           Set to 'true' for debug output
#   FORCE_REFRESH     Set to 'true' to bypass cache and regenerate all images
#
# Exit codes:
#   0 - All runs completed (individual models may have failed)
#   1 - One or more runs failed
#   2 - Usage error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="test-text-to-image-e2e-suite"
readonly LOG_TAG="(${APP_NAME})"

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly E2E_PROVIDERS_SCRIPT="${SCRIPT_DIR}/test-text-to-image-e2e-providers.sh"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"

SUITE_OUTPUT_DIR="${SUITE_OUTPUT_DIR:-${REPO_ROOT}/tmp/e2e-suite}"
TIMEOUT="${TIMEOUT:-180}"
VERBOSE="${VERBOSE:-false}"
FORCE_REFRESH="${FORCE_REFRESH:-false}"
DRY_RUN=false

# CLI filters
FILTER_USE_CASE=""
FILTER_SETTINGS=""

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_FAILURE=1
readonly EXIT_USAGE=2

# ============================================================================
# SETTINGS PROFILES
# ============================================================================

# Default: tool defaults (1024x1024, high quality)
readonly SETTINGS_DEFAULT_LABEL="default"
readonly SETTINGS_DEFAULT_WIDTH=""
readonly SETTINGS_DEFAULT_HEIGHT=""
readonly SETTINGS_DEFAULT_QUALITY=""

# Max: push to tool limits (2048x2048, high quality)
readonly SETTINGS_MAX_LABEL="max"
readonly SETTINGS_MAX_WIDTH="2048"
readonly SETTINGS_MAX_HEIGHT="2048"
readonly SETTINGS_MAX_QUALITY="high"

# ============================================================================
# USE CASE PROMPTS
# ============================================================================

readonly USE_CASE_NAMES=(
  "hero"
  "product"
  "blog"
  "logo"
)

readonly USE_CASE_LABELS=(
  "Hero Banner with Text"
  "E-Commerce Product Photography"
  "Blog Editorial Illustration"
  "Business Logo Design"
)

# Each prompt is ~200-350 tokens, specific and detailed for web development use cases.
# shellcheck disable=SC2016
readonly USE_CASE_PROMPTS=(
  # hero — Hero Banner with Text on Image
  "Professional website hero banner for a premium coffee subscription service. The image must contain the text 'ROAST & RITUAL' rendered in large, elegant serif typography centered in the upper third, with the tagline 'Artisan Coffee, Delivered Fresh' in smaller sans-serif lettering directly below. The background features a moody, cinematic close-up of freshly roasted arabica coffee beans with visible oil sheen and rich brown tones. Soft steam rises from an artisan ceramic pour-over dripper positioned in the right third of the frame. Warm amber side-lighting creates dramatic shadows and highlights the texture of the beans. A handcrafted stoneware mug sits on a rustic reclaimed-wood surface in the lower left, catching a gentle rim-light. The overall color palette is warm: deep espresso browns, burnt amber, cream highlights, and subtle gold accents. The composition uses the rule of thirds with generous negative space around the text for readability. Professional color grading with lifted shadows and warm split-toning. Shallow depth of field at f/2.8 equivalent keeps text area sharp while background elements have pleasing bokeh. The style is premium commercial photography suitable for a Shopify or Squarespace hero section at 16:9 aspect ratio. No watermarks, no borders."

  # product — E-Commerce Product Photography
  "Professional e-commerce product photograph of premium wireless over-ear headphones in matte charcoal black finish with brushed aluminum accents. The headphones are displayed at a three-quarter angle on a polished white Carrara marble surface with subtle gray veining, showing both the textured protein-leather ear cushion and the precision-machined adjustment slider on the headband. Key light from upper-left at 45 degrees creates a soft gradient shadow falling to the lower right. A secondary fill light from the right softens shadow contrast to 3:1 ratio. The ear cup interior reveals a fine metallic mesh driver cover with laser-etched brand mark. A single small potted succulent with thick jade-green leaves sits three inches behind and to the left, providing a pop of organic color and depth scale. The marble surface shows a subtle, controlled reflection of the product underside. Background transitions smoothly from pure white at top to warm light-gray at the bottom edge. Every surface detail is tack-sharp at f/8 equivalent with focus stacking. No clipped highlights, no crushed shadows, full dynamic range. Color temperature is neutral daylight at 5600K. This image must meet the standard of a product hero shot on the Apple Store or Bang and Olufsen website. No text, no watermarks."

  # blog — Blog Editorial Illustration
  "Vibrant editorial illustration for a technology blog article about artificial intelligence transforming modern healthcare. The scene shows a bright, airy hospital room where a friendly humanoid robot assistant with soft glowing blue eyes and a rounded pearl-white chassis gently holds the hand of an elderly woman seated in a comfortable armchair. The woman has silver hair, warm brown eyes, reading glasses pushed up on her forehead, and a genuine grateful smile. She wears a soft lavender cardigan over a hospital gown. The robot's design is deliberately non-threatening: smooth curves, no sharp edges, subtle breathing-light indicator on its chest pulsing calm blue. Behind them a large window reveals a sunlit healing garden with climbing jasmine and a stone fountain. Floating translucent holographic displays show vital-sign waveforms in clean teal and white UI elements. Natural golden-hour sunlight streams through the window casting long warm shadows across the light oak floor. Color palette: soft sky blues, warm cream whites, healing sage greens, gentle lavender, and touches of warm gold from the sunlight. The mood is optimistic and deeply human, conveying trust between technology and patient. Semi-realistic editorial illustration style with clean confident linework, soft gradients, and subtle paper texture overlay. Composition places the human-robot handshake at the visual center with supporting elements framing the story. Suitable as a 16:9 blog header image. No text overlays."

  # logo — Business Logo Design
  "Professional minimalist logo design for 'VERDE BOTANICS', an upscale organic skincare brand. The design features the brand name 'VERDE BOTANICS' typeset in a refined geometric sans-serif typeface with generous letter-spacing, medium font weight, and perfectly horizontal baseline — rendered in deep forest green hex #1B4332 on a pure white background. Centered above the text is an abstract botanical mark composed of three overlapping semi-transparent ellipses arranged in a radial pattern at 120-degree intervals, forming a stylized three-petal flower or leaf rosette. The ellipses use a gradient progression: the left petal in sage green #8FBC8F, the upper-right in forest green #2D6A4F, and the lower-right in antique gold #BFA048, with the overlapping intersections creating rich darker blended tones. The symbol sits within an implied circular boundary following golden-ratio proportions relative to the text width. A thin horizontal line in #2D6A4F separates the symbol from the text, spanning exactly the width of the word 'BOTANICS'. The overall composition is vertically stacked and perfectly centered. Clean vector-quality rendering with crisp anti-aliased edges, no gradients on the text itself, no drop shadows, no decorative flourishes. The aesthetic balances organic botanical warmth with modern geometric precision, communicating luxury, sustainability, and scientific expertise. Must be visually coherent at sizes from a 32-pixel favicon to a 1200-pixel website header. No background pattern, no tagline, no additional elements."
)

# ============================================================================
# RESULT TRACKING
# ============================================================================
declare -a RUN_USE_CASE=()
declare -a RUN_SETTINGS=()
declare -a RUN_EXIT_CODE=()

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
  print_combined_summary
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

# Get settings values for a given profile label
get_settings_width() {
  local -r profile="$1"
  case "${profile}" in
    default) printf '%s' "${SETTINGS_DEFAULT_WIDTH}" ;;
    max)     printf '%s' "${SETTINGS_MAX_WIDTH}" ;;
    *)       die "Unknown settings profile: ${profile}" ;;
  esac
}

get_settings_height() {
  local -r profile="$1"
  case "${profile}" in
    default) printf '%s' "${SETTINGS_DEFAULT_HEIGHT}" ;;
    max)     printf '%s' "${SETTINGS_MAX_HEIGHT}" ;;
    *)       die "Unknown settings profile: ${profile}" ;;
  esac
}

get_settings_quality() {
  local -r profile="$1"
  case "${profile}" in
    default) printf '%s' "${SETTINGS_DEFAULT_QUALITY}" ;;
    max)     printf '%s' "${SETTINGS_MAX_QUALITY}" ;;
    *)       die "Unknown settings profile: ${profile}" ;;
  esac
}

# Run a single combination: use_case × settings_profile
run_combination() {
  local -r use_case="$1"
  local -r use_case_index="$2"
  local -r settings_profile="$3"

  local -r prompt="${USE_CASE_PROMPTS[${use_case_index}]}"
  local -r output_prefix="${use_case}-${settings_profile}"

  local -r width="$(get_settings_width "${settings_profile}")"
  local -r height="$(get_settings_height "${settings_profile}")"
  local -r quality="$(get_settings_quality "${settings_profile}")"

  local prompt_display="${prompt}"
  if [[ "${#prompt_display}" -gt 80 ]]; then
    prompt_display="${prompt_display:0:80}..."
  fi

  local settings_display="defaults"
  if [[ -n "${width}" || -n "${quality}" ]]; then
    settings_display="${width:-1024}x${height:-1024}"
    [[ -n "${quality}" ]] && settings_display+=", quality=${quality}"
  fi

  printf '\n' >&2
  log_info "================================================================"
  log_info "Use case: ${use_case} (${USE_CASE_LABELS[${use_case_index}]})"
  log_info "Settings: ${settings_profile} (${settings_display})"
  log_info "Prefix: ${output_prefix}"
  log_info "Prompt: ${prompt_display}"
  log_info "================================================================"

  if [[ "${DRY_RUN}" == "true" ]]; then
    local force_display=""
    [[ "${FORCE_REFRESH}" == "true" ]] && force_display=" FORCE=true"
    log_info "[DRY-RUN] Would execute: PROMPT=<${use_case}> OUTPUT_PREFIX=${output_prefix} WIDTH=${width} HEIGHT=${height} QUALITY=${quality}${force_display} bash ${E2E_PROVIDERS_SCRIPT}"
    RUN_USE_CASE+=("${use_case}")
    RUN_SETTINGS+=("${settings_profile}")
    RUN_EXIT_CODE+=("0")
    return 0
  fi

  local exit_code=0
  local force_env="false"
  [[ "${FORCE_REFRESH}" == "true" ]] && force_env="true"
  PROMPT="${prompt}" \
  OUTPUT_PREFIX="${output_prefix}" \
  OUTPUT_DIR="${SUITE_OUTPUT_DIR}" \
  WIDTH="${width}" \
  HEIGHT="${height}" \
  QUALITY="${quality}" \
  TIMEOUT="${TIMEOUT}" \
  VERBOSE="${VERBOSE}" \
  FORCE="${force_env}" \
    bash "${E2E_PROVIDERS_SCRIPT}" || exit_code=$?

  RUN_USE_CASE+=("${use_case}")
  RUN_SETTINGS+=("${settings_profile}")
  RUN_EXIT_CODE+=("${exit_code}")

  if [[ "${exit_code}" -ne 0 ]]; then
    log_warn "Run ${use_case}/${settings_profile} exited with ${exit_code} (some models may have failed)"
  else
    log_info "Run ${use_case}/${settings_profile} completed successfully"
  fi

  return 0
}

# Print the combined summary across all runs
print_combined_summary() {
  local -r total_runs="${#RUN_USE_CASE[@]}"

  if [[ "${total_runs}" -eq 0 ]]; then
    log_info "No runs completed."
    return
  fi

  local total_pass=0
  local total_fail=0

  printf '\n'
  printf '================================================================\n'
  printf 'E2E Battle Test Suite — Combined Summary\n'
  printf '================================================================\n'
  printf '  %-16s | %-10s | %s\n' "Use Case" "Settings" "Result"
  printf '  %s\n' "$(printf '%0.s-' {1..50})"

  local i
  for (( i=0; i<total_runs; i++ )); do
    local use_case="${RUN_USE_CASE[${i}]}"
    local settings="${RUN_SETTINGS[${i}]}"
    local exit_code="${RUN_EXIT_CODE[${i}]}"
    local result_icon

    if [[ "${exit_code}" -eq 0 ]]; then
      result_icon="PASS"
      total_pass=$(( total_pass + 1 ))
    else
      result_icon="FAIL (exit ${exit_code})"
      total_fail=$(( total_fail + 1 ))
    fi

    printf '  %-16s | %-10s | %s\n' "${use_case}" "${settings}" "${result_icon}"
  done

  printf '  %s\n' "$(printf '%0.s-' {1..50})"
  printf 'Total runs: %d | Pass: %d | Fail: %d\n' "${total_runs}" "${total_pass}" "${total_fail}"

  if [[ "${DRY_RUN}" != "true" ]]; then
    printf 'Output: %s\n' "${SUITE_OUTPUT_DIR}"
  fi
  printf '================================================================\n'
}

# List all use cases with their prompts
list_cases() {
  printf 'Available use cases:\n\n'
  local i
  for (( i=0; i<${#USE_CASE_NAMES[@]}; i++ )); do
    printf '  %s — %s\n' "${USE_CASE_NAMES[${i}]}" "${USE_CASE_LABELS[${i}]}"
    printf '  Prompt:\n'
    # Word-wrap prompt at ~100 chars for readability
    printf '    %s\n\n' "${USE_CASE_PROMPTS[${i}]}"
  done

  printf 'Settings profiles:\n'
  printf '  default — tool defaults (1024x1024, default quality)\n'
  printf '  max     — maximum settings (2048x2048, high quality)\n'
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat >&2 <<EOF
Usage: ${APP_NAME} [options]

E2E battle-test suite for text-to-image. Runs the e2e-providers script
multiple times with different prompts and settings to test all configured
models across realistic web development scenarios.

WARNING: This calls REAL PAID APIs. Not for CI/CD use.

Use cases: hero (banner with text), product (e-commerce photo),
           blog (editorial illustration), logo (business logo)

Settings:  default (1024x1024, tool defaults), max (2048x2048, high quality)

Matrix: 4 use cases × 2 settings = 8 total runs.

Idempotent: The e2e-providers script skips existing files, so re-running
fills gaps without regenerating. Safe to re-run after partial failures.

Options:
  -h, --help           Show this help message
  -v, --verbose        Enable debug output
  --use-case NAME      Run only this use case (hero|product|blog|logo)
  --settings PROFILE   Run only this settings profile (default|max)
  --force-refresh      Bypass cache and regenerate all images with fresh API calls
  --list-cases         Show all use cases and their prompts
  --dry-run            Show what would be run without executing

Environment variables:
  SUITE_OUTPUT_DIR     Output directory (default: <repo>/tmp/e2e-suite)
  TIMEOUT              Timeout per model in seconds (default: 180)
  VERBOSE              Set to 'true' for debug output
  FORCE_REFRESH        Set to 'true' to bypass cache and regenerate

Examples:
  # Full suite (all 8 combinations):
  bash tools/.tests/test-text-to-image-e2e-suite.sh

  # Dry-run to preview:
  bash tools/.tests/test-text-to-image-e2e-suite.sh --dry-run

  # Single use case, single settings:
  bash tools/.tests/test-text-to-image-e2e-suite.sh --use-case hero --settings max

  # List available use cases:
  bash tools/.tests/test-text-to-image-e2e-suite.sh --list-cases

  # Re-run to fill gaps (skips existing images):
  bash tools/.tests/test-text-to-image-e2e-suite.sh

  # Force regeneration (bypass cache, fresh API calls):
  bash tools/.tests/test-text-to-image-e2e-suite.sh --force-refresh
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -v|--verbose) VERBOSE=true ;;
      --use-case)
        shift
        [[ $# -gt 0 ]] || die "--use-case requires a value (hero|product|blog|logo)"
        FILTER_USE_CASE="$1"
        ;;
      --settings)
        shift
        [[ $# -gt 0 ]] || die "--settings requires a value (default|max)"
        FILTER_SETTINGS="$1"
        ;;
      --list-cases) list_cases; exit 0 ;;
      --force-refresh) FORCE_REFRESH=true ;;
      --dry-run) DRY_RUN=true ;;
      --) shift; break ;;
      -*) die "Unknown option: $1" ;;
      *) break ;;
    esac
    shift
  done
}

# Validate filter values
validate_filters() {
  if [[ -n "${FILTER_USE_CASE}" ]]; then
    local valid=false
    local name
    for name in "${USE_CASE_NAMES[@]}"; do
      if [[ "${name}" == "${FILTER_USE_CASE}" ]]; then
        valid=true
        break
      fi
    done
    [[ "${valid}" == "true" ]] || die "Unknown use case: ${FILTER_USE_CASE}. Valid: hero, product, blog, logo"
  fi

  if [[ -n "${FILTER_SETTINGS}" ]]; then
    case "${FILTER_SETTINGS}" in
      default|max) ;;
      *) die "Unknown settings profile: ${FILTER_SETTINGS}. Valid: default, max" ;;
    esac
  fi
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"
  validate_filters

  require_cmd bash
  require_cmd jq
  require_cmd timeout

  [[ -f "${E2E_PROVIDERS_SCRIPT}" ]] || die "E2E providers script not found: ${E2E_PROVIDERS_SCRIPT}"

  local -r settings_profiles=("default" "max")

  log_info "================================================================"
  log_info "E2E Battle Test Suite — Starting"
  log_info "================================================================"
  log_info "Output directory: ${SUITE_OUTPUT_DIR}"
  log_info "Timeout per model: ${TIMEOUT}s"
  [[ -n "${FILTER_USE_CASE}" ]] && log_info "Filter use case: ${FILTER_USE_CASE}"
  [[ -n "${FILTER_SETTINGS}" ]] && log_info "Filter settings: ${FILTER_SETTINGS}"
  [[ "${FORCE_REFRESH}" == "true" ]] && log_info "Force refresh: enabled (bypassing cache)"
  [[ "${DRY_RUN}" == "true" ]] && log_info "Mode: DRY-RUN (no actual API calls)"

  if [[ "${DRY_RUN}" != "true" ]]; then
    mkdir -p "${SUITE_OUTPUT_DIR}"
  fi

  local i
  for (( i=0; i<${#USE_CASE_NAMES[@]}; i++ )); do
    local use_case="${USE_CASE_NAMES[${i}]}"

    # Apply use-case filter
    if [[ -n "${FILTER_USE_CASE}" && "${use_case}" != "${FILTER_USE_CASE}" ]]; then
      continue
    fi

    local profile
    for profile in "${settings_profiles[@]}"; do
      # Apply settings filter
      if [[ -n "${FILTER_SETTINGS}" && "${profile}" != "${FILTER_SETTINGS}" ]]; then
        continue
      fi

      run_combination "${use_case}" "${i}" "${profile}"
    done
  done

  print_combined_summary

  # Exit with failure if any run failed
  local any_failed=false
  local j
  for (( j=0; j<${#RUN_EXIT_CODE[@]}; j++ )); do
    if [[ "${RUN_EXIT_CODE[${j}]}" -ne 0 ]]; then
      any_failed=true
      break
    fi
  done

  if [[ "${any_failed}" == "true" ]]; then
    log_info "Some runs had failures — exiting with status 1"
    exit "${EXIT_FAILURE}"
  fi
  exit "${EXIT_SUCCESS}"
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
