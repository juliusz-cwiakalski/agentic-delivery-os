#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/generate-e2e-report.sh
#
# generate-e2e-report.sh — Generate HTML & Markdown comparison reports from E2E eval YAML files
#
# Reads .eval.yaml evaluation files from the E2E suite output directory and generates:
#   1. An HTML visual comparison report with embedded images
#   2. A Markdown summary report with scoring tables
#
# Dependencies: bash>=4, awk, sed, grep, date
#
# Usage: bash tools/.tests/generate-e2e-report.sh [options]
#
# Environment variables:
#   SUITE_DIR    Input directory (alternative to --dir)
#   VERBOSE      Set to 'true' for debug output
#
# Exit codes:
#   0 - Success
#   2 - Usage error
#   4 - Runtime error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="generate-e2e-report"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"

# Configurable via environment
INPUT_DIR="${SUITE_DIR:-${REPO_ROOT}/tmp/e2e-suite}"
OUTPUT_DIR=""
VERBOSE="${VERBOSE:-false}"

# Report mode
GENERATE_HTML=true
GENERATE_MD=true
EMBED_IMAGES=true

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_RUNTIME=4

# Scoring categories in display order
readonly SCORE_CATEGORIES=(
  "prompt_adherence"
  "visual_quality"
  "composition"
  "color_and_lighting"
  "detail_accuracy"
  "text_rendering"
  "web_readiness"
  "style_consistency"
)

readonly SCORE_LABELS=(
  "Prompt Adherence"
  "Visual Quality"
  "Composition"
  "Color & Lighting"
  "Detail Accuracy"
  "Text Rendering"
  "Web Readiness"
  "Style Consistency"
)

readonly SCORE_ABBREVS=(
  "PA" "VQ" "CL" "CaL" "DA" "TR" "WR" "SC"
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
log_info()  { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_err()   { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*" >&2 || true; }

die() { log_err "$@"; exit "${EXIT_USAGE}"; }

# ============================================================================
# YAML PARSING (pure bash/awk — no yq dependency)
# ============================================================================

# Extract a top-level or one-indent YAML value
# Usage: yaml_get <file> <key>
# Handles:  key: value  and  key: "value"
yaml_get() {
  local -r file="$1" key="$2"
  local result
  result="$(grep -E "^  ${key}:" "${file}" 2>/dev/null | head -1 | sed "s/^  ${key}: *//" | sed 's/^"//;s/"$//' | sed "s/^'//;s/'$//")" || true
  printf '%s' "${result}"
}

# Extract a score value nested under scores.<category>.score
# Usage: yaml_get_score <file> <category>
yaml_get_score() {
  local -r file="$1" category="$2"
  local result
  result="$(awk -v cat="  ${category}:" '
    $0 ~ cat { found=1; next }
    found && /^    score:/ { gsub(/.*score: */, ""); gsub(/[[:space:]]+$/, ""); print; exit }
    found && /^  [a-z]/ { exit }
  ' "${file}" 2>/dev/null)" || true
  printf '%s' "${result}"
}

# Extract score notes nested under scores.<category>.notes
yaml_get_notes() {
  local -r file="$1" category="$2"
  local result
  result="$(awk -v cat="  ${category}:" '
    $0 ~ cat { found=1; next }
    found && /^    notes:/ { gsub(/.*notes: */, ""); gsub(/^"/, ""); gsub(/"$/, ""); print; exit }
    found && /^  [a-z]/ { exit }
  ' "${file}" 2>/dev/null)" || true
  printf '%s' "${result}"
}

# Extract summary.percentage
yaml_get_summary_field() {
  local -r file="$1" key="$2"
  local result
  result="$(awk -v k="  ${key}:" '
    /^summary:/ { in_summary=1; next }
    in_summary && $0 ~ k { gsub(/.*: */, ""); gsub(/[[:space:]]+$/, ""); gsub(/^"/, ""); gsub(/"$/, ""); print; exit }
    in_summary && /^[a-z]/ { exit }
  ' "${file}" 2>/dev/null)" || true
  printf '%s' "${result}"
}

# Extract a YAML list (strengths/weaknesses) under summary.<key>
yaml_get_list() {
  local -r file="$1" key="$2"
  awk -v k="  ${key}:" '
    /^summary:/ { in_summary=1; next }
    in_summary && $0 ~ k { in_list=1; next }
    in_list && /^    - / { gsub(/^    - /, ""); gsub(/^"/, ""); gsub(/"$/, ""); print; next }
    in_list && !/^    -/ { exit }
  ' "${file}" 2>/dev/null || true
}

# Extract a multi-line YAML literal block value (e.g., input.prompt)
# Reads lines after "  prompt: |" until the next key at same or lower indentation
yaml_get_prompt() {
  local -r file="$1"
  awk '
    /^  prompt: \|/ { found=1; next }
    found && /^    / { gsub(/^    /, ""); line = (line ? line "\n" : "") $0; next }
    found && !/^    / { exit }
    END { if (line) print line }
  ' "${file}" 2>/dev/null || true
}

# ============================================================================
# DATA COLLECTION
# ============================================================================

# Global arrays to hold parsed eval data
declare -a EVAL_FILES=()
declare -a EVAL_IMAGE_FILES=()
declare -a EVAL_USE_CASES=()
declare -a EVAL_USE_CASE_LABELS=()
declare -a EVAL_SETTINGS=()
declare -a EVAL_PROVIDERS=()
declare -a EVAL_MODELS=()
declare -a EVAL_TIMESTAMPS=()
declare -a EVAL_TOTAL_SCORES=()
declare -a EVAL_MAX_POSSIBLE=()
declare -a EVAL_PERCENTAGES=()
declare -a EVAL_RECOMMENDATIONS=()

# Per-category scores stored as "idx:category:score"
declare -a EVAL_CATEGORY_SCORES=()
declare -a EVAL_CATEGORY_NOTES=()

# Per-use-case prompt text (same prompt for all models within a use case)
declare -A USE_CASE_PROMPTS=()

# Unique lists
declare -a UNIQUE_USE_CASES=()
declare -a UNIQUE_USE_CASE_LABELS=()
declare -a UNIQUE_PROVIDERS=()
declare -a UNIQUE_MODELS=()
declare -a UNIQUE_SETTINGS=()

# Collect all eval data from the input directory
collect_eval_data() {
  local -r dir="$1"

  shopt -s nullglob
  local eval_files_glob=("${dir}"/*.eval.yaml)
  shopt -u nullglob

  if [[ ${#eval_files_glob[@]} -eq 0 ]]; then
    log_warn "No .eval.yaml files found in ${dir}"
    return 1
  fi

  log_info "Found ${#eval_files_glob[@]} evaluation file(s)"

  local idx=0
  local eval_file
  for eval_file in "${eval_files_glob[@]}"; do
    local image_file use_case use_case_label settings provider model timestamp
    local total_score max_possible percentage recommendation

    image_file="$(yaml_get "${eval_file}" "image_file")"

    # Skip if corresponding image does not exist
    if [[ -n "${image_file}" && ! -f "${dir}/${image_file}" ]]; then
      log_debug "Skipping ${eval_file} — image not found: ${image_file}"
      continue
    fi

    use_case="$(yaml_get "${eval_file}" "use_case")"
    use_case_label="$(yaml_get "${eval_file}" "use_case_label")"
    settings="$(yaml_get "${eval_file}" "settings")"
    provider="$(yaml_get "${eval_file}" "provider")"
    model="$(yaml_get "${eval_file}" "model")"
    timestamp="$(yaml_get "${eval_file}" "timestamp")"

    total_score="$(yaml_get_summary_field "${eval_file}" "total_score")"
    max_possible="$(yaml_get_summary_field "${eval_file}" "max_possible")"
    percentage="$(yaml_get_summary_field "${eval_file}" "percentage")"
    recommendation="$(yaml_get_summary_field "${eval_file}" "recommendation")"

    EVAL_FILES+=("${eval_file}")
    EVAL_IMAGE_FILES+=("${image_file}")
    EVAL_USE_CASES+=("${use_case}")
    EVAL_USE_CASE_LABELS+=("${use_case_label}")
    EVAL_SETTINGS+=("${settings}")
    EVAL_PROVIDERS+=("${provider}")
    EVAL_MODELS+=("${model}")
    EVAL_TIMESTAMPS+=("${timestamp}")
    EVAL_TOTAL_SCORES+=("${total_score}")
    EVAL_MAX_POSSIBLE+=("${max_possible}")
    EVAL_PERCENTAGES+=("${percentage}")
    EVAL_RECOMMENDATIONS+=("${recommendation}")

    # Collect per-category scores and notes
    local cat_idx
    for (( cat_idx=0; cat_idx<${#SCORE_CATEGORIES[@]}; cat_idx++ )); do
      local cat="${SCORE_CATEGORIES[${cat_idx}]}"
      local score notes
      score="$(yaml_get_score "${eval_file}" "${cat}")"
      notes="$(yaml_get_notes "${eval_file}" "${cat}")"
      EVAL_CATEGORY_SCORES+=("${idx}:${cat}:${score}")
      EVAL_CATEGORY_NOTES+=("${idx}:${cat}:${notes}")
    done

    # Try to read prompt from the generation YAML sidecar
    local gen_yaml="${eval_file%.eval.yaml}.yaml"
    if [[ -n "${use_case}" && -f "${gen_yaml}" ]]; then
      local _existing_prompt="${USE_CASE_PROMPTS["${use_case}"]:-}"
      if [[ -z "${_existing_prompt}" ]]; then
        local prompt_text
        prompt_text="$(yaml_get_prompt "${gen_yaml}")"
        if [[ -n "${prompt_text}" ]]; then
          USE_CASE_PROMPTS["${use_case}"]="${prompt_text}"
        fi
      fi
    fi

    log_debug "Parsed: ${use_case}/${settings} — ${provider}/${model} — ${percentage}%"
    idx=$(( idx + 1 ))
  done

  EVAL_COUNT="${idx}"
  log_info "Loaded ${EVAL_COUNT} evaluation(s)"

  if [[ "${EVAL_COUNT}" -eq 0 ]]; then
    return 1
  fi

  # Build unique lists
  _build_unique_lists

  return 0
}

# Build deduplicated sorted lists
_build_unique_lists() {
  local i

  # Use associative arrays for dedup
  declare -A _seen_uc _seen_ucl _seen_prov _seen_model _seen_settings

  for (( i=0; i<EVAL_COUNT; i++ )); do
    local uc="${EVAL_USE_CASES[${i}]}"
    local ucl="${EVAL_USE_CASE_LABELS[${i}]}"
    local prov="${EVAL_PROVIDERS[${i}]}"
    local mod="${EVAL_MODELS[${i}]}"
    local set="${EVAL_SETTINGS[${i}]}"

    if [[ -z "${_seen_uc[${uc}]:-}" ]]; then
      UNIQUE_USE_CASES+=("${uc}")
      UNIQUE_USE_CASE_LABELS+=("${ucl}")
      _seen_uc["${uc}"]=1
    fi
    if [[ -z "${_seen_prov[${prov}]:-}" ]]; then
      UNIQUE_PROVIDERS+=("${prov}")
      _seen_prov["${prov}"]=1
    fi
    if [[ -z "${_seen_model[${prov}/${mod}]:-}" ]]; then
      UNIQUE_MODELS+=("${prov}/${mod}")
      _seen_model["${prov}/${mod}"]=1
    fi
    if [[ -z "${_seen_settings[${set}]:-}" ]]; then
      UNIQUE_SETTINGS+=("${set}")
      _seen_settings["${set}"]=1
    fi
  done
}

# Look up a category score for eval index
_get_score() {
  local -r idx="$1" category="$2"
  local entry
  for entry in "${EVAL_CATEGORY_SCORES[@]}"; do
    if [[ "${entry}" == "${idx}:${category}:"* ]]; then
      local val="${entry#*:*:}"
      printf '%s' "${val}"
      return
    fi
  done
  printf ''
}

# Look up category notes for eval index
_get_notes() {
  local -r idx="$1" category="$2"
  local entry
  for entry in "${EVAL_CATEGORY_NOTES[@]}"; do
    if [[ "${entry}" == "${idx}:${category}:"* ]]; then
      local val="${entry#*:*:}"
      printf '%s' "${val}"
      return
    fi
  done
  printf ''
}

# Get the label for a use case
_get_use_case_label() {
  local -r uc="$1"
  local i
  for (( i=0; i<${#UNIQUE_USE_CASES[@]}; i++ )); do
    if [[ "${UNIQUE_USE_CASES[${i}]}" == "${uc}" ]]; then
      printf '%s' "${UNIQUE_USE_CASE_LABELS[${i}]}"
      return
    fi
  done
  printf '%s' "${uc}"
}

# ============================================================================
# SCORE COLOR HELPERS
# ============================================================================

# Extract integer part of a score (handles both . and , decimals)
_score_int() {
  local -r val="$1"
  # Strip everything from the first . or , onward
  local int="${val%%[.,]*}"
  # Ensure it's numeric
  if [[ "${int}" =~ ^[0-9]+$ ]]; then
    printf '%s' "${int}"
  else
    printf '0'
  fi
}

# Return a hex color for a given score value
_score_color() {
  local -r score="$1"
  if [[ -z "${score}" || "${score}" == "N/A" ]]; then
    printf '#9ca3af'
    return
  fi
  local s
  s="$(_score_int "${score}")"
  if (( s >= 90 )); then
    printf '#10b981'
  elif (( s >= 75 )); then
    printf '#84cc16'
  elif (( s >= 60 )); then
    printf '#eab308'
  elif (( s >= 45 )); then
    printf '#f97316'
  else
    printf '#ef4444'
  fi
}

# Return a CSS class name for a score tier
_score_class() {
  local -r score="$1"
  if [[ -z "${score}" || "${score}" == "N/A" ]]; then
    printf 'score-na'
    return
  fi
  local s
  s="$(_score_int "${score}")"
  if (( s >= 90 )); then
    printf 'score-excellent'
  elif (( s >= 75 )); then
    printf 'score-good'
  elif (( s >= 60 )); then
    printf 'score-average'
  elif (( s >= 45 )); then
    printf 'score-below'
  else
    printf 'score-poor'
  fi
}

# ============================================================================
# COMPUTATION HELPERS
# ============================================================================

# Compute average percentage for a given provider/model across all evals
_compute_model_avg() {
  local -r target_provider="$1" target_model="$2"
  local sum=0 count=0 i
  for (( i=0; i<EVAL_COUNT; i++ )); do
    if [[ "${EVAL_PROVIDERS[${i}]}" == "${target_provider}" && "${EVAL_MODELS[${i}]}" == "${target_model}" ]]; then
      local pct="${EVAL_PERCENTAGES[${i}]}"
      if [[ -n "${pct}" && "${pct}" != "N/A" ]]; then
        # Use awk for float arithmetic
        sum="$(LC_ALL=C awk -v s="${sum}" -v p="${pct}" 'BEGIN { printf "%.1f", s + p }')"
        count=$(( count + 1 ))
      fi
    fi
  done
  if (( count > 0 )); then
    LC_ALL=C awk -v s="${sum}" -v c="${count}" 'BEGIN { printf "%.1f", s / c }'
  else
    printf 'N/A'
  fi
}

# Count unique use cases for a model
_count_model_use_cases() {
  local -r target_provider="$1" target_model="$2"
  declare -A seen
  local i
  for (( i=0; i<EVAL_COUNT; i++ )); do
    if [[ "${EVAL_PROVIDERS[${i}]}" == "${target_provider}" && "${EVAL_MODELS[${i}]}" == "${target_model}" ]]; then
      seen["${EVAL_USE_CASES[${i}]}"]=1
    fi
  done
  printf '%d' "${#seen[@]}"
}

# Count unique settings for a model
_count_model_settings() {
  local -r target_provider="$1" target_model="$2"
  declare -A seen
  local i
  for (( i=0; i<EVAL_COUNT; i++ )); do
    if [[ "${EVAL_PROVIDERS[${i}]}" == "${target_provider}" && "${EVAL_MODELS[${i}]}" == "${target_model}" ]]; then
      seen["${EVAL_SETTINGS[${i}]}"]=1
    fi
  done
  printf '%d' "${#seen[@]}"
}

# Find top N models by average score
# Output: lines of "avg_score|provider|model"
_rank_models() {
  local model_entry
  for model_entry in "${UNIQUE_MODELS[@]}"; do
    local prov="${model_entry%%/*}"
    local mod="${model_entry#*/}"
    local avg
    avg="$(_compute_model_avg "${prov}" "${mod}")"
    if [[ "${avg}" != "N/A" ]]; then
      printf '%s|%s|%s\n' "${avg}" "${prov}" "${mod}"
    fi
  done | sort -t'|' -k1 -rn
}

# Compute average score for a specific category across all evals for a model
_compute_model_category_avg() {
  local -r target_provider="$1" target_model="$2" category="$3"
  local sum=0 count=0 i
  for (( i=0; i<EVAL_COUNT; i++ )); do
    if [[ "${EVAL_PROVIDERS[${i}]}" == "${target_provider}" && "${EVAL_MODELS[${i}]}" == "${target_model}" ]]; then
      local score
      score="$(_get_score "${i}" "${category}")"
      if [[ -n "${score}" && "${score}" != "N/A" ]]; then
        sum="$(LC_ALL=C awk -v s="${sum}" -v v="${score}" 'BEGIN { printf "%.1f", s + v }')"
        count=$(( count + 1 ))
      fi
    fi
  done
  if (( count > 0 )); then
    LC_ALL=C awk -v s="${sum}" -v c="${count}" 'BEGIN { printf "%.1f", s / c }'
  else
    printf 'N/A'
  fi
}

# Compute global average for a category across ALL evals
_compute_category_global_avg() {
  local -r category="$1"
  local sum=0 count=0 i
  for (( i=0; i<EVAL_COUNT; i++ )); do
    local score
    score="$(_get_score "${i}" "${category}")"
    if [[ -n "${score}" && "${score}" != "N/A" ]]; then
      sum="$(LC_ALL=C awk -v s="${sum}" -v v="${score}" 'BEGIN { printf "%.1f", s + v }')"
      count=$(( count + 1 ))
    fi
  done
  if (( count > 0 )); then
    LC_ALL=C awk -v s="${sum}" -v c="${count}" 'BEGIN { printf "%.1f", s / c }'
  else
    printf 'N/A'
  fi
}

# Find best model for a specific category
# Returns: "avg|provider|model"
_best_model_for_category() {
  local -r category="$1"
  local best_avg="0" best_prov="" best_mod=""
  local model_entry
  for model_entry in "${UNIQUE_MODELS[@]}"; do
    local prov="${model_entry%%/*}"
    local mod="${model_entry#*/}"
    local avg
    avg="$(_compute_model_category_avg "${prov}" "${mod}" "${category}")"
    if [[ "${avg}" != "N/A" ]]; then
      local is_better
      is_better="$(LC_ALL=C awk -v a="${avg}" -v b="${best_avg}" 'BEGIN { if (a > b) print 1; else print 0 }')"
      if [[ "${is_better}" == "1" ]]; then
        best_avg="${avg}"
        best_prov="${prov}"
        best_mod="${mod}"
      fi
    fi
  done
  printf '%s|%s|%s' "${best_avg}" "${best_prov}" "${best_mod}"
}

# Find best model for a specific use case
_best_model_for_use_case() {
  local -r target_uc="$1"
  local best_pct="0" best_prov="" best_mod=""
  local i
  for (( i=0; i<EVAL_COUNT; i++ )); do
    if [[ "${EVAL_USE_CASES[${i}]}" == "${target_uc}" ]]; then
      local pct="${EVAL_PERCENTAGES[${i}]}"
      if [[ -n "${pct}" && "${pct}" != "N/A" ]]; then
        local is_better
        is_better="$(LC_ALL=C awk -v a="${pct}" -v b="${best_pct}" 'BEGIN { if (a > b) print 1; else print 0 }')"
        if [[ "${is_better}" == "1" ]]; then
          best_pct="${pct}"
          best_prov="${EVAL_PROVIDERS[${i}]}"
          best_mod="${EVAL_MODELS[${i}]}"
        fi
      fi
    fi
  done
  printf '%s|%s|%s' "${best_pct}" "${best_prov}" "${best_mod}"
}

# HTML-escape a string
_html_escape() {
  local -r text="$1"
  printf '%s' "${text}" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g'
}

# ============================================================================
# HTML REPORT GENERATION
# ============================================================================
generate_html_report() {
  local -r output_file="$1"
  local -r input_dir="$2"
  local -r timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  log_info "Generating HTML report: ${output_file}"

  {
    _html_header "${timestamp}"
    _html_executive_summary
    _html_leaderboard
    _html_per_use_case_sections "${input_dir}"
    _html_category_deep_dive
    _html_footer "${timestamp}" "${input_dir}"
  } > "${output_file}"

  log_info "HTML report written ($(wc -l < "${output_file}") lines)"
}

_html_header() {
  local -r timestamp="$1"
  cat <<'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>E2E Image Generation — Model Comparison Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6; color: #1f2937; background: #ffffff;
    max-width: 1400px; margin: 0 auto; padding: 20px 24px;
  }
  h1 { font-size: 1.8rem; color: #111827; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; }
  h2 { font-size: 1.4rem; color: #1f2937; margin-top: 2.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 1.15rem; color: #374151; margin-top: 1.5rem; }
  .meta { color: #6b7280; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .badge {
    display: inline-block; padding: 2px 10px; border-radius: 12px;
    font-size: 0.75rem; font-weight: 600; color: #fff; margin-left: 8px;
  }
  .badge-default { background: #6b7280; }
  .badge-max { background: #7c3aed; }
  table {
    width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem;
  }
  th, td {
    padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;
  }
  th { background: #f9fafb; font-weight: 600; color: #374151; position: sticky; top: 0; }
  tr:nth-child(even) { background: #f9fafb; }
  tr:hover { background: #f3f4f6; }
  td.score-cell { text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
  .score-bar {
    display: inline-block; height: 8px; border-radius: 4px; margin-right: 6px; vertical-align: middle;
  }
  .score-excellent .score-bar, td.score-excellent { color: #10b981; }
  .score-good .score-bar, td.score-good { color: #84cc16; }
  .score-average .score-bar, td.score-average { color: #eab308; }
  .score-below .score-bar, td.score-below { color: #f97316; }
  .score-poor .score-bar, td.score-poor { color: #ef4444; }
  td.score-na { color: #9ca3af; }
  .pct-bar-container {
    display: inline-flex; align-items: center; gap: 6px; width: 100%;
  }
  .pct-bar-bg {
    flex: 1; height: 10px; background: #f3f4f6; border-radius: 5px; overflow: hidden; min-width: 60px;
  }
  .pct-bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s; }
  .pct-label { font-weight: 600; font-variant-numeric: tabular-nums; min-width: 50px; text-align: right; }
  .gallery {
    display: flex; flex-wrap: wrap; gap: 16px; margin: 1rem 0;
  }
  .gallery-item {
    flex: 0 0 auto; text-align: center;
  }
  .gallery-item img {
    width: 300px; height: auto; border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s;
  }
  .gallery-item img:hover { transform: scale(1.02); }
  .gallery-item .caption {
    font-size: 0.8rem; color: #6b7280; margin-top: 4px;
  }
  .prompt-section {
    margin: 0.5rem 0 1rem 0;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0;
  }
  .prompt-section summary {
    padding: 8px 14px;
    cursor: pointer;
    font-size: 0.9rem;
    color: #475569;
    font-weight: 500;
  }
  .prompt-section summary:hover { background: #f1f5f9; border-radius: 6px; }
  .prompt-text {
    padding: 12px 16px;
    font-size: 0.85rem;
    line-height: 1.7;
    color: #334155;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: 'Georgia', 'Times New Roman', serif;
    border-top: 1px solid #e2e8f0;
    max-height: 400px;
    overflow-y: auto;
  }
  details { margin: 4px 0; }
  details summary {
    cursor: pointer; font-size: 0.85rem; color: #3b82f6;
  }
  details .notes-content {
    font-size: 0.85rem; color: #6b7280; padding: 4px 0 4px 16px;
    border-left: 2px solid #e5e7eb; margin-top: 4px;
  }
  .exec-summary {
    background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;
    padding: 16px 20px; margin: 1rem 0;
  }
  .exec-summary h3 { margin-top: 0; color: #0369a1; }
  .exec-summary ul { margin: 0.5rem 0; padding-left: 1.2rem; }
  .rank-badge {
    display: inline-block; width: 28px; height: 28px; line-height: 28px;
    text-align: center; border-radius: 50%; font-weight: 700; font-size: 0.85rem; color: #fff;
  }
  .rank-1 { background: #f59e0b; }
  .rank-2 { background: #9ca3af; }
  .rank-3 { background: #b45309; }
  .rank-other { background: #d1d5db; color: #374151; }
  .footer {
    margin-top: 3rem; padding-top: 1rem; border-top: 2px solid #e5e7eb;
    font-size: 0.85rem; color: #9ca3af;
  }
  @media (max-width: 768px) {
    body { padding: 12px; }
    .gallery-item img { width: 100%; max-width: 300px; }
    table { font-size: 0.8rem; }
    th, td { padding: 6px 8px; }
  }
</style>
</head>
<body>
HTMLEOF

  printf '<h1>E2E Image Generation — Model Comparison Report</h1>\n'
  printf '<p class="meta">Generated: %s | Evaluations: %d | Models: %d | Use Cases: %d</p>\n' \
    "${timestamp}" "${EVAL_COUNT}" "${#UNIQUE_MODELS[@]}" "${#UNIQUE_USE_CASES[@]}"
}

_html_executive_summary() {
  printf '<div class="exec-summary">\n'
  printf '<h3>Executive Summary</h3>\n'

  printf '<p><strong>Total images evaluated:</strong> %d</p>\n' "${EVAL_COUNT}"

  # Top 3 models
  local ranked
  ranked="$(_rank_models)"
  if [[ -n "${ranked}" ]]; then
    printf '<p><strong>Top 3 models by average score:</strong></p>\n<ol>\n'
    local count=0
    while IFS='|' read -r avg prov mod; do
      count=$(( count + 1 ))
      (( count > 3 )) && break
        printf '<li><strong>%s / %s</strong> — %s%%</li>\n' "$(_html_escape "${prov}")" "$(_html_escape "${mod}")" "${avg}"
    done <<< "${ranked}"
    printf '</ol>\n'
  fi

  # Top model per use case
  if [[ ${#UNIQUE_USE_CASES[@]} -gt 0 ]]; then
    printf '<p><strong>Top model per use case:</strong></p>\n<ul>\n'
    local uc
    for uc in "${UNIQUE_USE_CASES[@]}"; do
      local best
      best="$(_best_model_for_use_case "${uc}")"
      local pct="${best%%|*}"
      local rest="${best#*|}"
      local prov="${rest%%|*}"
      local mod="${rest#*|}"
      local label
      label="$(_get_use_case_label "${uc}")"
      if [[ -n "${prov}" ]]; then
        printf '<li><strong>%s</strong>: %s / %s (%s%%)</li>\n' \
          "$(_html_escape "${label}")" "$(_html_escape "${prov}")" "$(_html_escape "${mod}")" "${pct}"
      fi
    done
    printf '</ul>\n'
  fi

  printf '</div>\n'
}

_html_leaderboard() {
  printf '<h2>Overall Leaderboard</h2>\n'
  printf '<table>\n<thead><tr>'
  printf '<th>Rank</th><th>Provider</th><th>Model</th><th>Avg Score</th><th># Use Cases</th><th># Settings</th>'
  printf '</tr></thead>\n<tbody>\n'

  local ranked
  ranked="$(_rank_models)"
  local rank=0
  while IFS='|' read -r avg prov mod; do
    [[ -z "${avg}" ]] && continue
    rank=$(( rank + 1 ))
    local color
    color="$(_score_color "${avg%%.*}")"
    local rank_class="rank-other"
    (( rank == 1 )) && rank_class="rank-1"
    (( rank == 2 )) && rank_class="rank-2"
    (( rank == 3 )) && rank_class="rank-3"

    local num_uc num_set
    num_uc="$(_count_model_use_cases "${prov}" "${mod}")"
    num_set="$(_count_model_settings "${prov}" "${mod}")"

    printf '<tr>'
    printf '<td><span class="rank-badge %s">%d</span></td>' "${rank_class}" "${rank}"
    printf '<td>%s</td>' "$(_html_escape "${prov}")"
    printf '<td>%s</td>' "$(_html_escape "${mod}")"
    printf '<td><div class="pct-bar-container">'
    printf '<div class="pct-bar-bg"><div class="pct-bar-fill" style="width:%s%%;background:%s"></div></div>' "${avg}" "${color}"
    printf '<span class="pct-label" style="color:%s">%s%%</span>' "${color}" "${avg}"
    printf '</div></td>'
    printf '<td style="text-align:center">%d</td>' "${num_uc}"
    printf '<td style="text-align:center">%d</td>' "${num_set}"
    printf '</tr>\n'
  done <<< "${ranked}"

  printf '</tbody>\n</table>\n'
}

_html_per_use_case_sections() {
  local -r input_dir="$1"
  local uc_idx
  for (( uc_idx=0; uc_idx<${#UNIQUE_USE_CASES[@]}; uc_idx++ )); do
    local uc="${UNIQUE_USE_CASES[${uc_idx}]}"
    local ucl="${UNIQUE_USE_CASE_LABELS[${uc_idx}]}"

    printf '<h2>%s</h2>\n' "$(_html_escape "${ucl}")"

    # Show generation prompt if available for this use case
    if [[ -n "${USE_CASE_PROMPTS[${uc}]:-}" ]]; then
      printf '<details class="prompt-section">\n'
      printf '<summary>View generation prompt</summary>\n'
      printf '<div class="prompt-text">%s</div>\n' "$(_html_escape "${USE_CASE_PROMPTS[${uc}]}")"
      printf '</details>\n'
    fi

    # Image gallery per settings profile
    local setting
    for setting in "${UNIQUE_SETTINGS[@]}"; do
      local badge_class="badge-default"
      [[ "${setting}" == "max" ]] && badge_class="badge-max"
      printf '<h3>Settings: %s <span class="badge %s">%s</span></h3>\n' \
        "$(_html_escape "${setting}")" "${badge_class}" "${setting}"

      if [[ "${EMBED_IMAGES}" == "true" ]]; then
        printf '<div class="gallery">\n'
        local i
        for (( i=0; i<EVAL_COUNT; i++ )); do
          if [[ "${EVAL_USE_CASES[${i}]}" == "${uc}" && "${EVAL_SETTINGS[${i}]}" == "${setting}" ]]; then
            local img="${EVAL_IMAGE_FILES[${i}]}"
            local prov="${EVAL_PROVIDERS[${i}]}"
            local mod="${EVAL_MODELS[${i}]}"
            local pct="${EVAL_PERCENTAGES[${i}]}"
            local color
            color="$(_score_color "${pct%%.*}")"
            printf '<div class="gallery-item">\n'
            printf '<a href="%s" target="_blank"><img src="%s" alt="%s — %s/%s" loading="lazy"></a>\n' \
              "$(_html_escape "${img}")" "$(_html_escape "${img}")" \
              "$(_html_escape "${ucl}")" "$(_html_escape "${prov}")" "$(_html_escape "${mod}")"
            printf '<div class="caption">%s / %s<br><span style="color:%s;font-weight:600">%s%%</span></div>\n' \
              "$(_html_escape "${prov}")" "$(_html_escape "${mod}")" "${color}" "${pct}"
            printf '</div>\n'
          fi
        done
        printf '</div>\n'
      fi

      # Scoring comparison table
      printf '<table>\n<thead><tr>'
      printf '<th>Provider</th><th>Model</th>'
      local cat_idx
      for (( cat_idx=0; cat_idx<${#SCORE_ABBREVS[@]}; cat_idx++ )); do
        printf '<th title="%s" style="text-align:center">%s</th>' \
          "$(_html_escape "${SCORE_LABELS[${cat_idx}]}")" "${SCORE_ABBREVS[${cat_idx}]}"
      done
      printf '<th style="text-align:center">Total</th><th style="text-align:center">%%</th>'
      printf '</tr></thead>\n<tbody>\n'

      local i
      for (( i=0; i<EVAL_COUNT; i++ )); do
        if [[ "${EVAL_USE_CASES[${i}]}" == "${uc}" && "${EVAL_SETTINGS[${i}]}" == "${setting}" ]]; then
          printf '<tr>'
          printf '<td>%s</td>' "$(_html_escape "${EVAL_PROVIDERS[${i}]}")"
          printf '<td>%s</td>' "$(_html_escape "${EVAL_MODELS[${i}]}")"

          for (( cat_idx=0; cat_idx<${#SCORE_CATEGORIES[@]}; cat_idx++ )); do
            local cat="${SCORE_CATEGORIES[${cat_idx}]}"
            local score notes cls
            score="$(_get_score "${i}" "${cat}")"
            notes="$(_get_notes "${i}" "${cat}")"
            cls="$(_score_class "${score}")"

            if [[ -n "${score}" && "${score}" != "N/A" ]]; then
              printf '<td class="score-cell %s">' "${cls}"
              if [[ -n "${notes}" ]]; then
                printf '<details><summary>%s</summary><div class="notes-content">%s</div></details>' \
                  "${score}" "$(_html_escape "${notes}")"
              else
                printf '%s' "${score}"
              fi
              printf '</td>'
            else
              printf '<td class="score-cell score-na">N/A</td>'
            fi
          done

          local total="${EVAL_TOTAL_SCORES[${i}]}"
          local pct="${EVAL_PERCENTAGES[${i}]}"
          local pct_cls
          pct_cls="$(_score_class "${pct%%.*}")"
          printf '<td class="score-cell">%s</td>' "${total:-N/A}"
          printf '<td class="score-cell %s">%s%%</td>' "${pct_cls}" "${pct:-N/A}"
          printf '</tr>\n'
        fi
      done

      printf '</tbody>\n</table>\n'
    done
  done
}

_html_category_deep_dive() {
  printf '<h2>Category Deep-Dive</h2>\n'

  printf '<table>\n<thead><tr>'
  printf '<th>Category</th><th>Avg Score</th><th>Best Model</th><th>Best Avg</th>'
  printf '</tr></thead>\n<tbody>\n'

  local cat_idx
  for (( cat_idx=0; cat_idx<${#SCORE_CATEGORIES[@]}; cat_idx++ )); do
    local cat="${SCORE_CATEGORIES[${cat_idx}]}"
    local label="${SCORE_LABELS[${cat_idx}]}"
    local global_avg best_info best_avg best_prov best_mod

    global_avg="$(_compute_category_global_avg "${cat}")"
    best_info="$(_best_model_for_category "${cat}")"
    best_avg="${best_info%%|*}"
    local rest="${best_info#*|}"
    best_prov="${rest%%|*}"
    best_mod="${rest#*|}"

    local color
    color="$(_score_color "${global_avg%%.*}")"
    local best_color
    best_color="$(_score_color "${best_avg%%.*}")"

    printf '<tr>'
    printf '<td><strong>%s</strong></td>' "$(_html_escape "${label}")"
    printf '<td><div class="pct-bar-container">'
    printf '<div class="pct-bar-bg"><div class="pct-bar-fill" style="width:%s%%;background:%s"></div></div>' "${global_avg}" "${color}"
    printf '<span class="pct-label" style="color:%s">%s</span>' "${color}" "${global_avg}"
    printf '</div></td>'
    printf '<td>%s / %s</td>' "$(_html_escape "${best_prov}")" "$(_html_escape "${best_mod}")"
    printf '<td style="color:%s;font-weight:600">%s</td>' "${best_color}" "${best_avg}"
    printf '</tr>\n'
  done

  printf '</tbody>\n</table>\n'
}

_html_footer() {
  local -r timestamp="$1" input_dir="$2"
  printf '<div class="footer">\n'
  printf '<p>Generated by <code>%s v%s</code> on %s</p>\n' "${APP_NAME}" "${APP_VERSION}" "${timestamp}"
  printf '<p>Source: <code>%s</code></p>\n' "$(_html_escape "${input_dir}")"
  printf '</div>\n'
  printf '</body>\n</html>\n'
}

# ============================================================================
# MARKDOWN REPORT GENERATION
# ============================================================================
generate_md_report() {
  local -r output_file="$1"
  local -r input_dir="$2"
  local -r timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  log_info "Generating Markdown report: ${output_file}"

  {
    _md_header "${timestamp}"
    _md_leaderboard
    _md_per_use_case_tables
    _md_category_averages
    _md_strengths_weaknesses
    _md_footer "${timestamp}" "${input_dir}"
  } > "${output_file}"

  log_info "Markdown report written ($(wc -l < "${output_file}") lines)"
}

_md_header() {
  local -r timestamp="$1"
  printf '# E2E Image Generation — Model Comparison Report\n\n'
  printf '**Generated:** %s  \n' "${timestamp}"
  printf '**Evaluations:** %d | **Models:** %d | **Use Cases:** %d  \n\n' \
    "${EVAL_COUNT}" "${#UNIQUE_MODELS[@]}" "${#UNIQUE_USE_CASES[@]}"
}

_md_leaderboard() {
  printf '## Overall Model Leaderboard\n\n'
  printf '| Rank | Provider | Model | Avg Score (%%) | # Use Cases | # Settings |\n'
  printf '|------|----------|-------|---------------|-------------|------------|\n'

  local ranked
  ranked="$(_rank_models)"
  local rank=0
  while IFS='|' read -r avg prov mod; do
    [[ -z "${avg}" ]] && continue
    rank=$(( rank + 1 ))
    local num_uc num_set
    num_uc="$(_count_model_use_cases "${prov}" "${mod}")"
    num_set="$(_count_model_settings "${prov}" "${mod}")"
    printf '| %d | %s | %s | %s | %d | %d |\n' \
      "${rank}" "${prov}" "${mod}" "${avg}" "${num_uc}" "${num_set}"
  done <<< "${ranked}"

  printf '\n'
}

_md_per_use_case_tables() {
  local uc_idx
  for (( uc_idx=0; uc_idx<${#UNIQUE_USE_CASES[@]}; uc_idx++ )); do
    local uc="${UNIQUE_USE_CASES[${uc_idx}]}"
    local ucl="${UNIQUE_USE_CASE_LABELS[${uc_idx}]}"

    printf '## %s\n\n' "${ucl}"

    # Show generation prompt if available for this use case
    if [[ -n "${USE_CASE_PROMPTS[${uc}]:-}" ]]; then
      printf '<details>\n<summary>Generation prompt</summary>\n\n'
      # Output each line as a blockquote
      while IFS= read -r _prompt_line; do
        printf '> %s\n' "${_prompt_line}"
      done <<< "${USE_CASE_PROMPTS[${uc}]}"
      printf '\n</details>\n\n'
    fi

    local setting
    for setting in "${UNIQUE_SETTINGS[@]}"; do
      printf '### Settings: %s\n\n' "${setting}"
      printf '| Provider | Model | PA | VQ | CL | CaL | DA | TR | WR | SC | Total | %% |\n'
      printf '|----------|-------|----|----|----|-----|----|----|----|----|-------|----|\n'

      # Collect entries for this use case + settings, sort by total desc
      local lines=""
      local i
      for (( i=0; i<EVAL_COUNT; i++ )); do
        if [[ "${EVAL_USE_CASES[${i}]}" == "${uc}" && "${EVAL_SETTINGS[${i}]}" == "${setting}" ]]; then
          local prov="${EVAL_PROVIDERS[${i}]}"
          local mod="${EVAL_MODELS[${i}]}"
          local total="${EVAL_TOTAL_SCORES[${i}]}"
          local pct="${EVAL_PERCENTAGES[${i}]}"

          local line="| ${prov} | ${mod} "
          local cat_idx
          for (( cat_idx=0; cat_idx<${#SCORE_CATEGORIES[@]}; cat_idx++ )); do
            local cat="${SCORE_CATEGORIES[${cat_idx}]}"
            local score
            score="$(_get_score "${i}" "${cat}")"
            line+="| ${score:-N/A} "
          done
          line+="| ${total:-N/A} | ${pct:-N/A} |"
          # Use TAB as separator between sort key and line content
          lines+="${total:-0}"$'\t'"${line}"$'\n'
        fi
      done

      # Sort by total descending and print
      if [[ -n "${lines}" ]]; then
        printf '%s' "${lines}" | sort -t$'\t' -k1 -rn | while IFS=$'\t' read -r _sort_key md_line; do
          printf '%s\n' "${md_line}"
        done
      fi

      printf '\n'
    done
  done
}

_md_category_averages() {
  printf '## Category Averages — Best Model per Category\n\n'
  printf '| Category | Global Avg | Best Model | Best Avg |\n'
  printf '|----------|-----------|------------|----------|\n'

  local cat_idx
  for (( cat_idx=0; cat_idx<${#SCORE_CATEGORIES[@]}; cat_idx++ )); do
    local cat="${SCORE_CATEGORIES[${cat_idx}]}"
    local label="${SCORE_LABELS[${cat_idx}]}"
    local global_avg best_info best_avg best_prov best_mod

    global_avg="$(_compute_category_global_avg "${cat}")"
    best_info="$(_best_model_for_category "${cat}")"
    best_avg="${best_info%%|*}"
    local rest="${best_info#*|}"
    best_prov="${rest%%|*}"
    best_mod="${rest#*|}"

    printf '| %s | %s | %s / %s | %s |\n' \
      "${label}" "${global_avg}" "${best_prov}" "${best_mod}" "${best_avg}"
  done

  printf '\n'
}

_md_strengths_weaknesses() {
  printf '## Strengths & Weaknesses by Model\n\n'

  local model_entry
  for model_entry in "${UNIQUE_MODELS[@]}"; do
    local prov="${model_entry%%/*}"
    local mod="${model_entry#*/}"
    printf '### %s / %s\n\n' "${prov}" "${mod}"

    # Collect strengths and weaknesses
    local strengths="" weaknesses=""
    local i
    for (( i=0; i<EVAL_COUNT; i++ )); do
      if [[ "${EVAL_PROVIDERS[${i}]}" == "${prov}" && "${EVAL_MODELS[${i}]}" == "${mod}" ]]; then
        local eval_file="${EVAL_FILES[${i}]}"
        local s_list w_list
        s_list="$(yaml_get_list "${eval_file}" "strengths")"
        w_list="$(yaml_get_list "${eval_file}" "weaknesses")"
        [[ -n "${s_list}" ]] && strengths+="${s_list}"$'\n'
        [[ -n "${w_list}" ]] && weaknesses+="${w_list}"$'\n'
      fi
    done

    if [[ -n "${strengths}" ]]; then
      printf '**Strengths:**\n'
      printf '%s' "${strengths}" | sort | uniq -c | sort -rn | head -5 | while IFS= read -r line; do
        # Strip leading whitespace and count from uniq -c output
        local item="${line#"${line%%[! ]*}"}"  # strip leading spaces
        item="${item#*[0-9] }"                  # strip count and space
        printf -- '- %s\n' "${item}"
      done
      printf '\n'
    fi

    if [[ -n "${weaknesses}" ]]; then
      printf '**Weaknesses:**\n'
      printf '%s' "${weaknesses}" | sort | uniq -c | sort -rn | head -5 | while IFS= read -r line; do
        local item="${line#"${line%%[! ]*}"}"
        item="${item#*[0-9] }"
        printf -- '- %s\n' "${item}"
      done
      printf '\n'
    fi
  done
}

_md_footer() {
  local -r timestamp="$1" input_dir="$2"
  printf '%s\n\n' '---'
  printf '*Generated by `%s v%s` on %s*  \n' "${APP_NAME}" "${APP_VERSION}" "${timestamp}"
  printf '*Source: `%s`*\n' "${input_dir}"
}

# ============================================================================
# EMPTY REPORT GENERATORS
# ============================================================================
_generate_empty_html() {
  local -r output_file="$1"
  local -r timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  cat > "${output_file}" <<EMPTYHTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>E2E Report — No Data</title>
<style>body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; color: #374151; }
h1 { color: #111827; } .note { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; }</style>
</head><body>
<h1>E2E Image Generation — Model Comparison Report</h1>
<p class="meta">Generated: ${timestamp}</p>
<div class="note"><strong>No data found.</strong> No .eval.yaml files were found in the input directory. Run the E2E suite first to generate evaluation data.</div>
</body></html>
EMPTYHTML
}

_generate_empty_md() {
  local -r output_file="$1"
  local -r timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  cat > "${output_file}" <<EMPTYMD
# E2E Image Generation — Model Comparison Report

**Generated:** ${timestamp}

> **No data found.** No .eval.yaml files were found in the input directory.
> Run the E2E suite first to generate evaluation data.
EMPTYMD
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat >&2 <<EOF
Usage: ${APP_NAME} [options]

Generate HTML & Markdown comparison reports from E2E evaluation YAML files.

Options:
  -h, --help           Show this help message
  -V, --version        Show version
  -v, --verbose        Enable debug output
  -d, --dir DIR        Input directory (default: <repo>/tmp/e2e-suite)
  -o, --output DIR     Output directory for reports (default: same as input dir)
  --html-only          Generate only HTML report
  --md-only            Generate only Markdown report
  --no-images          Skip image embedding in HTML (faster, smaller file)

Environment variables:
  SUITE_DIR            Input directory (alternative to --dir)
  VERBOSE              Debug output

Examples:
  # Generate both reports from default location:
  bash tools/.tests/generate-e2e-report.sh

  # Custom input directory:
  bash tools/.tests/generate-e2e-report.sh -d /path/to/eval-results

  # HTML only, no images:
  bash tools/.tests/generate-e2e-report.sh --html-only --no-images

  # Verbose mode:
  bash tools/.tests/generate-e2e-report.sh -v

Exit codes:
  0 - Success
  2 - Usage error
  4 - Runtime error
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
      -v|--verbose) VERBOSE=true ;;
      -d|--dir)
        shift
        [[ $# -gt 0 ]] || die "--dir requires a value"
        INPUT_DIR="$1"
        ;;
      -o|--output)
        shift
        [[ $# -gt 0 ]] || die "--output requires a value"
        OUTPUT_DIR="$1"
        ;;
      --html-only) GENERATE_HTML=true; GENERATE_MD=false ;;
      --md-only) GENERATE_HTML=false; GENERATE_MD=true ;;
      --no-images) EMBED_IMAGES=false ;;
      --) shift; break ;;
      -*) die "Unknown option: $1" ;;
      *) break ;;
    esac
    shift
  done
}

validate_args() {
  [[ -d "${INPUT_DIR}" ]] || die "Input directory does not exist: ${INPUT_DIR}"
  if [[ -z "${OUTPUT_DIR}" ]]; then
    OUTPUT_DIR="${INPUT_DIR}"
  fi
  mkdir -p "${OUTPUT_DIR}" || die "Cannot create output directory: ${OUTPUT_DIR}"
}

# ============================================================================
# MAIN
# ============================================================================
EVAL_COUNT=0

main() {
  parse_args "$@"
  validate_args

  log_info "Input directory: ${INPUT_DIR}"
  log_info "Output directory: ${OUTPUT_DIR}"

  local has_data=true
  if ! collect_eval_data "${INPUT_DIR}"; then
    has_data=false
    log_warn "No valid evaluation data found — generating empty reports"
  fi

  if [[ "${GENERATE_HTML}" == "true" ]]; then
    local html_file="${OUTPUT_DIR}/report.html"
    if [[ "${has_data}" == "true" ]]; then
      generate_html_report "${html_file}" "${INPUT_DIR}"
    else
      _generate_empty_html "${html_file}"
    fi
    log_info "HTML report: ${html_file}"
  fi

  if [[ "${GENERATE_MD}" == "true" ]]; then
    local md_file="${OUTPUT_DIR}/report.md"
    if [[ "${has_data}" == "true" ]]; then
      generate_md_report "${md_file}" "${INPUT_DIR}"
    else
      _generate_empty_md "${md_file}"
    fi
    log_info "Markdown report: ${md_file}"
  fi

  log_info "Done"
  exit "${EXIT_SUCCESS}"
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
