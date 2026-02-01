#!/usr/bin/env bash
# add-header-location.sh — Add GitHub location line to markdown frontmatter
#
# Dependencies: bash>=4, git, grep, sed
# Usage: ./add-header-location.sh [options] [PATH]
#
# Environment:
#   DRY_RUN     - Set to 'true' to skip writing (default false)
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
readonly APP_NAME="add-header-location"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_CONFIG=3
readonly EXIT_RUNTIME=4
readonly EXIT_EXTERNAL=5

# Configurable via environment
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# Base GitHub URL
readonly GITHUB_BASE="https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main"

# Default paths to process when no arguments provided
readonly DEFAULT_PATHS=(".opencode/agent" ".opencode/command" "doc/guides" "doc/documentation-handbook.md")

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
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*"; true; }
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
_git() { "${GIT_CMD:-git}" "$@"; }
_grep() { "${GREP_CMD:-grep}" "$@"; }
_sed() { "${SED_CMD:-sed}" "$@"; }

# ============================================================================
# DOMAIN FUNCTIONS
# ============================================================================

# Get repository root directory
get_repo_root() {
  local root
  root="$(_git rev-parse --show-toplevel 2>/dev/null)" || {
    log_err "Not a git repository (or parent of one)"
    return "${EXIT_CONFIG}"
  }
  printf '%s' "${root}"
}

# Compute relative path from repo root
compute_relative_path() {
  local -r repo_root="$1"
  local -r target_path="$2"
  local abs_target rel_path
  
  # Make target_path absolute
  abs_target="$(realpath "${target_path}")" || {
    log_err "Cannot resolve path: ${target_path}"
    return "${EXIT_RUNTIME}"
  }
  
  # Compute relative path
  rel_path="$(realpath --relative-to="${repo_root}" "${abs_target}")" || {
    log_err "Cannot compute relative path from ${repo_root} to ${abs_target}"
    return "${EXIT_RUNTIME}"
  }
  printf '%s' "${rel_path}"
}

# Check if file already has location line
# Check if file already has source line with exact prefix
has_source_line() {
  local -r file="$1"
  local -r prefix="Latest version:"
  local -r pattern="^#[[:space:]]*${prefix}[[:space:]]*${GITHUB_BASE}/"
  _grep -q "${pattern}" "${file}" 2>/dev/null
}

# Update source line with prefix, replace existing URL line if present
# Update source line with prefix, replace existing URL line if present
update_source_line() {
  local -r file="$1"
  local -r new_line="$2"
  local -r temp_file="$(mktemp)"
  local changed=false
  
  # Pattern to match any line containing the GitHub base URL (with or without prefix)
  local -r url_pattern="${GITHUB_BASE}/"
  
  awk -v new_line="${new_line}" -v url_pattern="${url_pattern}" '
    BEGIN { in_frontmatter = 0; replaced = 0; }
    /^---$/ {
      if (in_frontmatter == 0) {
        in_frontmatter = 1
        print $0
      } else {
        # Closing frontmatter
        if (in_frontmatter && !replaced) {
          # Insert source line before closing frontmatter
          print new_line
          replaced = 1
        }
        in_frontmatter = 0
        print $0
      }
      next
    }
    in_frontmatter && $0 ~ url_pattern {
      if (!replaced) {
        print new_line
        replaced = 1
      }
      next
    }
    in_frontmatter && /^#[[:space:]]*MIT License - see LICENSE file for full terms/ {
      print $0
      if (!replaced) {
        print new_line
        replaced = 1
      }
      next
    }
    { print }
  ' "${file}" > "${temp_file}" || {
    log_err "Failed to process ${file}"
    rm -f "${temp_file}"
    return "${EXIT_RUNTIME}"
  }
  
  # Replace original file if changed
  if ! diff -q "${file}" "${temp_file}" >/dev/null 2>&1; then
    run_cmd cp "${temp_file}" "${file}"
    log_info "Updated ${file}"
    changed=true
  else
    log_debug "No changes needed for ${file}"
    changed=false
  fi
  
  rm -f "${temp_file}"
  if [[ "${changed}" == "true" ]]; then
    return 0
  else
    return 1
  fi
}

# Ensure basic header with copyright and MIT license lines
ensure_basic_header() {
  local -r file="$1"
  local -r repo_root="$2"
  local -r temp_file="$(mktemp)"
  local changed=false
  
  # Compute relative path and source line
  local rel_path
  rel_path="$(compute_relative_path "${repo_root}" "${file}")" || return $?
  local source_line="# Latest version: ${GITHUB_BASE}/${rel_path}"
  local copyright_line="# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)"
  local mit_line="# MIT License - see LICENSE file for full terms"
  
  # Patterns for matching (not exact strings)
  local copyright_pattern="^#[[:space:]]*Copyright.*2025-2026"
  local mit_pattern="^#[[:space:]]*MIT License.*see LICENSE"
  local source_pattern="^#[[:space:]]*Latest version:.*${GITHUB_BASE}/"
  
  awk -v copyright_line="${copyright_line}" \
      -v mit_line="${mit_line}" \
      -v source_line="${source_line}" \
      -v copyright_pattern="${copyright_pattern}" \
      -v mit_pattern="${mit_pattern}" \
      -v source_pattern="${source_pattern}" '
  BEGIN {
    frontmatter_start = 0
    frontmatter_end = 0
  }
  {
    lines[NR] = $0
  }
  NR == 1 && $0 == "---" {
    frontmatter_start = 1
  }
  frontmatter_start && $0 == "---" && NR > 1 && !frontmatter_end {
    frontmatter_end = NR
  }
  END {
    # If no frontmatter at all, add it with header
    if (!frontmatter_start) {
      print "---"
      print copyright_line
      print mit_line
      print source_line
      print "---"
      for (i = 1; i <= NR; i++) print lines[i]
      exit
    }
    
    # Arrays to store header lines and other frontmatter lines
    header_copyright = ""
    header_mit = ""
    header_source = ""
    other_count = 0
    split("", other)  # clear array
    
    # Process frontmatter lines (excluding boundaries)
    for (i = 2; i < frontmatter_end; i++) {
      line = lines[i]
      if (line ~ copyright_pattern && header_copyright == "") {
        header_copyright = line
      } else if (line ~ mit_pattern && header_mit == "") {
        header_mit = line
      } else if (line ~ source_pattern && header_source == "") {
        header_source = line
      } else {
        other[++other_count] = line
      }
    }
    
    # Output reconstructed file
    for (i = 1; i <= NR; i++) {
      if (i == 1) {
        # Opening frontmatter boundary
        print lines[i]
        # Output header lines in correct order
        if (header_copyright != "") {
          print header_copyright
        } else {
          print copyright_line
        }
        if (header_mit != "") {
          print header_mit
        } else {
          print mit_line
        }
        if (header_source != "") {
          print header_source
        } else {
          print source_line
        }
        # Output other frontmatter lines
        for (j = 1; j <= other_count; j++) {
          print other[j]
        }
        # Print closing frontmatter boundary
        print lines[frontmatter_end]
        # Skip the rest of frontmatter lines
        i = frontmatter_end
        continue
      }
      if (i <= frontmatter_end) {
        # Already processed
        continue
      }
      # Lines after frontmatter
      print lines[i]
    }
  }
  ' "${file}" > "${temp_file}" || {
    log_err "Failed to process ${file}"
    rm -f "${temp_file}"
    return "${EXIT_RUNTIME}"
  }
  
  # Replace if changed
  if ! diff -q "${file}" "${temp_file}" >/dev/null 2>&1; then
    run_cmd cp "${temp_file}" "${file}"
    log_debug "Updated basic header in ${file}"
    changed=true
  fi
  
  rm -f "${temp_file}"
  [[ "${changed}" == "true" ]] && return 0 || return 1
}

# Process a single markdown file
process_file() {
  local -r file="$1"
  local -r repo_root="$2"
  
  log_debug "Processing ${file}"
  
  # First ensure basic header (frontmatter, copyright, MIT lines)
  local basic_header_changed=false
  if ensure_basic_header "${file}" "${repo_root}"; then
    log_debug "Basic header updated in ${file}"
    basic_header_changed=true
  fi
  
  # Compute relative path and source line with prefix
  local rel_path
  rel_path="$(compute_relative_path "${repo_root}" "${file}")" || return $?
  local source_line="# Latest version: ${GITHUB_BASE}/${rel_path}"
  
  log_debug "Source line: ${source_line}"
  
  # Check if file already has source line with exact prefix
  if has_source_line "${file}"; then
    log_debug "Skipping ${file} (already has source line)"
    # If we updated basic header, consider file updated
    [[ "${basic_header_changed}" == "true" ]] && return 0 || return 1
  fi
  
  # Update source line (replace existing URL line or insert after MIT License line)
  if update_source_line "${file}" "${source_line}"; then
    # Changed
    return 0
  else
    # No change needed (should not happen if has_source_line returned false)
    # Still consider basic header change
    [[ "${basic_header_changed}" == "true" ]] && return 0 || return 1
  fi
}

# Find markdown files under given directory
find_markdown_files() {
  local -r dir="$1"
  find "${dir}" -type f -name '*.md' | sort
}

# Process a path (file or directory)
process_path() {
  local -r path="$1"
  local repo_root
  repo_root="$(get_repo_root)" || return $?
  
  local count=0 updated=0 skipped=0
  
  if [[ -f "${path}" && "${path}" == *.md ]]; then
    # Single file
    log_info "Processing file ${path}"
    count=1
    if process_file "${path}" "${repo_root}"; then
      updated=1
    else
      skipped=1
    fi
  elif [[ -d "${path}" ]]; then
    # Directory
    log_info "Processing markdown files under ${path}"
    while IFS= read -r file; do
      count=$((count + 1))
      if process_file "${file}" "${repo_root}"; then
        updated=$((updated + 1))
      else
        skipped=$((skipped + 1))
      fi
    done < <(find_markdown_files "${path}")
  else
    log_err "Path is not a markdown file or directory: ${path}"
    return "${EXIT_USAGE}"
  fi
  
  log_info "Processed ${count} files, updated ${updated}, skipped ${skipped}"
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
Usage: ${APP_NAME} [options] [PATH]

Add GitHub location line to markdown frontmatter (after MIT License line).

Arguments:
  PATH          Directory to process (default: .opencode)

Options:
  -h, --help      Show this help message
  -V, --version   Show version
  -n, --dry-run   Show what would be done without doing it
  -v, --verbose   Enable debug output

Examples:
  ${APP_NAME} .opencode
  ${APP_NAME} --dry-run .opencode/agent
  ${APP_NAME} --verbose doc

Environment:
  DRY_RUN     Set to 'true' to skip writing
  VERBOSE     Set to 'true' for debug output
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
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
  # Default paths if none provided
  if [[ ${#ARGS[@]} -eq 0 ]]; then
    ARGS=("${DEFAULT_PATHS[@]}")
  fi
  
  # Validate each path exists
  for path in "${ARGS[@]}"; do
    if [[ ! -e "${path}" ]]; then
      die "Path does not exist: ${path}"
    fi
  done
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"
  validate_args
  
  require_cmd git
  require_cmd grep
  require_cmd sed
  require_cmd awk
  require_cmd realpath
  
  log_info "Starting ${APP_NAME} v${APP_VERSION}"
  log_debug "DRY_RUN=${DRY_RUN}"
  log_debug "VERBOSE=${VERBOSE}"
  
  for path in "${ARGS[@]}"; do
    process_path "${path}"
  done
  
  log_info "Done"
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
