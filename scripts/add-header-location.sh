#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/scripts/add-header-location.sh
# add-header-location.sh — Add Apache-2.0 license headers to markdown and bash files
#
# Dependencies: bash>=4, git, grep, sed
# Usage: ./add-header-location.sh [options] [PATH]
#
# Environment:
#   DRY_RUN       - Set to 'true' to skip writing (default false)
#   VERBOSE       - Set to 'true' for debug output
#   GITHUB_BRANCH - Branch used in generated source URLs (default main-tools)
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
readonly APP_VERSION="1.1.0"
readonly LOG_TAG="(${APP_NAME})"

# Exit codes
readonly EXIT_USAGE=2
readonly EXIT_CONFIG=3
readonly EXIT_RUNTIME=4

# Configurable via environment
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# Upstream repository and branch used in generated source links.
readonly GITHUB_REPO_SLUG="juliusz-cwiakalski/agentic-delivery-os"
# Branch the source links point at. Tooling docs live on main-tools until the
# public release; set GITHUB_BRANCH=main when flipping to the public baseline.
GITHUB_BRANCH="${GITHUB_BRANCH:-main-tools}"
readonly GITHUB_BRANCH
readonly GITHUB_URL_PREFIX="https://github.com/${GITHUB_REPO_SLUG}/blob/"
readonly GITHUB_BASE="${GITHUB_URL_PREFIX}${GITHUB_BRANCH}"

# Default paths to process when no arguments provided
readonly DEFAULT_PATHS=(".opencode/agent" ".opencode/command" "doc/guides" "doc/documentation-handbook.md" "doc/planning/concepts" "tools")

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

# Check if markdown file already has the source attribute for the current branch
has_md_source_attr() {
  local -r file="$1"
  local -r pattern="^source:[[:space:]]*${GITHUB_BASE}/"
  _grep -q "${pattern}" "${file}" 2>/dev/null
}

# Check if file has any ADOS source comment (# Latest version:), regardless of branch
has_old_source_comment() {
  local -r file="$1"
  local -r pattern="^#[[:space:]]*Latest version:[[:space:]]*${GITHUB_URL_PREFIX}"
  _grep -q "${pattern}" "${file}" 2>/dev/null
}

# Check if file has a source line for the current branch (for bash files)
has_source_line() {
  local -r file="$1"
  local -r prefix="Latest version:"
  local -r pattern="^#[[:space:]]*${prefix}[[:space:]]*${GITHUB_BASE}/"
  _grep -q "${pattern}" "${file}" 2>/dev/null
}

# Check if file has any ADOS source line, regardless of branch (for bash files)
has_any_source_line() {
  local -r file="$1"
  local -r pattern="^#[[:space:]]*Latest version:[[:space:]]*${GITHUB_URL_PREFIX}"
  _grep -q "${pattern}" "${file}" 2>/dev/null
}

# Detect whether a file is a bash script (by .sh extension or shebang)
is_bash_file() {
  local -r file="$1"
  # Check .sh extension
  if [[ "${file}" == *.sh ]]; then
    return 0
  fi
  # Check shebang line
  local first_line
  first_line="$(head -1 "${file}" 2>/dev/null)" || return 1
  if [[ "${first_line}" == "#!/usr/bin/env bash"* ]] || [[ "${first_line}" == "#!/bin/bash"* ]]; then
    return 0
  fi
  return 1
}

# Check if bash file already has the Apache-2.0 license header
bash_has_header() {
  local -r file="$1"
  _grep -q "^# Copyright.*2025-2026" "${file}" 2>/dev/null && \
  _grep -q "^# Apache-2.0 License.*see LICENSE" "${file}" 2>/dev/null && \
  has_any_source_line "${file}"
}

# Update source line in markdown frontmatter (handles both old comment and new attribute formats)
# Replaces any line containing the GitHub base URL in frontmatter with the new line,
# or inserts after Apache-2.0 License comment if no URL line found.
update_source_line() {
  local -r file="$1"
  local -r new_line="$2"
  local -r temp_file="$(mktemp)"
  local changed=false
  
  # Pattern to match any line containing an ADOS source URL (any branch)
  local -r url_pattern="${GITHUB_URL_PREFIX}"
  
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
    in_frontmatter && /^#[[:space:]]*Apache-2.0 License - see LICENSE file for full terms/ {
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

# Ensure basic header with copyright and Apache-2.0 license lines (for markdown files)
# Uses source: YAML attribute instead of # Latest version: comment
ensure_basic_header() {
  local -r file="$1"
  local -r repo_root="$2"
  local -r temp_file="$(mktemp)"
  local changed=false
  
  # Compute relative path and source line (YAML attribute for markdown)
  local rel_path
  rel_path="$(compute_relative_path "${repo_root}" "${file}")" || return $?
  local source_line="source: ${GITHUB_BASE}/${rel_path}"
  local copyright_line="# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)"
  local license_line="# Apache-2.0 License - see LICENSE file for full terms"
  
  # Patterns for matching (not exact strings)
  local copyright_pattern="^#[[:space:]]*Copyright.*2025-2026"
  local license_pattern="^#[[:space:]]*Apache-2.0 License.*see LICENSE"
  # Match old comment, old bare URL, and new attribute formats for any branch
  local old_source_pattern="^#[[:space:]]*Latest version:.*${GITHUB_URL_PREFIX}"
  local bare_source_pattern="^#[[:space:]]*${GITHUB_URL_PREFIX}"
  local new_source_pattern="^source:[[:space:]]*${GITHUB_URL_PREFIX}"
  
  awk -v copyright_line="${copyright_line}" \
      -v license_line="${license_line}" \
      -v source_line="${source_line}" \
      -v copyright_pattern="${copyright_pattern}" \
      -v license_pattern="${license_pattern}" \
      -v old_source_pattern="${old_source_pattern}" \
      -v bare_source_pattern="${bare_source_pattern}" \
      -v new_source_pattern="${new_source_pattern}" '
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
      print license_line
      print source_line
      print "---"
      for (i = 1; i <= NR; i++) print lines[i]
      exit
    }
    
    # Arrays to store header lines and other frontmatter lines
    header_copyright = ""
    header_license = ""
    header_source = ""
    other_count = 0
    split("", other)  # clear array
    
    # Process frontmatter lines (excluding boundaries)
    for (i = 2; i < frontmatter_end; i++) {
      line = lines[i]
      if (line ~ copyright_pattern && header_copyright == "") {
        header_copyright = line
      } else if (line ~ license_pattern && header_license == "") {
        header_license = line
      } else if ((line ~ old_source_pattern || line ~ bare_source_pattern || line ~ new_source_pattern) && header_source == "") {
        # Match old or new format; will be replaced with the current branch URL
        header_source = source_line
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
        if (header_license != "") {
          print header_license
        } else {
          print license_line
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
# Uses source: YAML attribute (not # Latest version: comment)
process_file() {
  local -r file="$1"
  local -r repo_root="$2"
  
  log_debug "Processing ${file}"
  
  # First ensure basic header (frontmatter, copyright, Apache-2.0 lines)
  # This also converts old # Latest version: comments to source: attributes
  local basic_header_changed=false
  if ensure_basic_header "${file}" "${repo_root}"; then
    log_debug "Basic header updated in ${file}"
    basic_header_changed=true
  fi
  
  # Compute relative path and source line (YAML attribute for markdown)
  local rel_path
  rel_path="$(compute_relative_path "${repo_root}" "${file}")" || return $?
  local source_line="source: ${GITHUB_BASE}/${rel_path}"
  
  log_debug "Source line: ${source_line}"
  
  # Check if file already has source attribute with correct URL
  if has_md_source_attr "${file}"; then
    log_debug "Skipping ${file} (already has source attribute)"
    # If we updated basic header, consider file updated
    [[ "${basic_header_changed}" == "true" ]] && return 0 || return 1
  fi
  
  # Update source line (replace existing URL line or insert after Apache-2.0 License line)
  if update_source_line "${file}" "${source_line}"; then
    # Changed
    return 0
  else
    # No change needed (should not happen if has_md_source_attr returned false)
    # Still consider basic header change
    [[ "${basic_header_changed}" == "true" ]] && return 0 || return 1
  fi
}

# Process a single bash script file
process_bash_file() {
  local -r file="$1"
  local -r repo_root="$2"
  
  log_debug "Processing bash file ${file}"
  
  # Compute relative path and header lines
  local rel_path
  rel_path="$(compute_relative_path "${repo_root}" "${file}")" || return $?
  local -r copyright_line="# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)"
  local -r license_line="# Apache-2.0 License - see LICENSE file for full terms"
  local -r source_line="# Latest version: ${GITHUB_BASE}/${rel_path}"
  
  # Existing header: refresh only the source line when the branch changed.
  if bash_has_header "${file}"; then
    if has_source_line "${file}"; then
      log_debug "Skipping ${file} (already has bash header)"
      return 1
    fi

    local -r existing_temp_file="$(mktemp)"
    if ! awk -v new_line="${source_line}" '
      BEGIN { replaced = 0 }
      !replaced && /^#[[:space:]]*Latest version:/ { print new_line; replaced = 1; next }
      { print }
    ' "${file}" > "${existing_temp_file}"; then
      log_err "Failed to update source line in ${file}"
      rm -f "${existing_temp_file}"
      return "${EXIT_RUNTIME}"
    fi

    if ! diff -q "${file}" "${existing_temp_file}" >/dev/null 2>&1; then
      run_cmd cp "${existing_temp_file}" "${file}"
      log_info "Updated source line in bash header in ${file}"
      rm -f "${existing_temp_file}"
      return 0
    fi

    rm -f "${existing_temp_file}"
    log_debug "No changes needed for ${file}"
    return 1
  fi

  local -r temp_file="$(mktemp)"
  local first_line
  first_line="$(head -1 "${file}")"
  
  if [[ "${first_line}" == "#!"* ]]; then
    # Has shebang: insert header after shebang line
    {
      echo "${first_line}"
      echo "${copyright_line}"
      echo "${license_line}"
      echo "${source_line}"
      tail -n +2 "${file}"
    } > "${temp_file}"
  else
    # No shebang: insert header at the very top
    {
      echo "${copyright_line}"
      echo "${license_line}"
      echo "${source_line}"
      cat "${file}"
    } > "${temp_file}"
  fi
  
  # Replace if changed
  if ! diff -q "${file}" "${temp_file}" >/dev/null 2>&1; then
    run_cmd cp "${temp_file}" "${file}"
    log_info "Updated bash header in ${file}"
    rm -f "${temp_file}"
    return 0
  fi
  
  rm -f "${temp_file}"
  log_debug "No changes needed for ${file}"
  return 1
}

# Find markdown files under given directory (prune temporary tmp/ subtrees)
find_markdown_files() {
  local -r dir="$1"
  find "${dir}" -type d -name tmp -prune -o -type f -name '*.md' -print | sort
}

# Find bash script files under given directory (.sh extension or shebang)
find_bash_files() {
  local -r dir="$1"
  {
    # Find .sh files
    find "${dir}" -type d -name tmp -prune -o -type f -name '*.sh' -print 2>/dev/null
    # Find files with bash shebang (no .sh extension, exclude .md files)
    find "${dir}" -type d -name tmp -prune -o -type f ! -name '*.md' ! -name '*.sh' ! -name '*.yaml' ! -name '*.yml' ! -name '*.json' ! -name '*.txt' ! -name '*.log' ! -name '*.metadata' -print 2>/dev/null | while IFS= read -r f; do
      local first_line
      first_line="$(head -1 "${f}" 2>/dev/null)" || continue
      if [[ "${first_line}" == "#!/usr/bin/env bash"* ]] || [[ "${first_line}" == "#!/bin/bash"* ]]; then
        echo "${f}"
      fi
    done
  } | sort -u
}

# Process a path (file or directory)
process_path() {
  local -r path="$1"
  local repo_root
  repo_root="$(get_repo_root)" || return $?
  
  local count=0 updated=0 skipped=0
  
  if [[ -f "${path}" && "${path}" == *.md ]]; then
    # Single markdown file
    log_info "Processing markdown file ${path}"
    count=1
    if process_file "${path}" "${repo_root}"; then
      updated=1
    else
      skipped=1
    fi
  elif [[ -f "${path}" ]] && is_bash_file "${path}"; then
    # Single bash script file
    log_info "Processing bash file ${path}"
    count=1
    if process_bash_file "${path}" "${repo_root}"; then
      updated=1
    else
      skipped=1
    fi
  elif [[ -d "${path}" ]]; then
    # Directory — process both markdown and bash files
    log_info "Processing markdown and bash files under ${path}"
    while IFS= read -r file; do
      count=$((count + 1))
      if process_file "${file}" "${repo_root}"; then
        updated=$((updated + 1))
      else
        skipped=$((skipped + 1))
      fi
    done < <(find_markdown_files "${path}")
    while IFS= read -r file; do
      count=$((count + 1))
      if process_bash_file "${file}" "${repo_root}"; then
        updated=$((updated + 1))
      else
        skipped=$((skipped + 1))
      fi
    done < <(find_bash_files "${path}")
  else
    log_err "Path is not a markdown file, bash script, or directory: ${path}"
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

Add Apache-2.0 license headers to markdown frontmatter and bash scripts.

Supported file types:
  - Markdown (.md): Adds 3-line YAML frontmatter header (copyright, Apache-2.0, source URL)
  - Bash scripts (.sh or shebang-detected): Adds 3-line bash comment header after shebang

Arguments:
  PATH          File or directory to process
                (defaults: .opencode/agent .opencode/command doc/guides
                 doc/documentation-handbook.md doc/planning/concepts tools;
                 missing defaults are skipped)

Options:
  -h, --help      Show this help message
  -V, --version   Show version
  -n, --dry-run   Show what would be done without doing it
  -v, --verbose   Enable debug output

Examples:
  ${APP_NAME} .opencode
  ${APP_NAME} --dry-run .opencode/agent
  ${APP_NAME} --verbose doc
  ${APP_NAME} doc/planning/concepts
  ${APP_NAME} tools/text-to-image
  ${APP_NAME} scripts/

Environment:
  DRY_RUN        Set to 'true' to skip writing
  VERBOSE        Set to 'true' for debug output
  GITHUB_BRANCH  Branch used in generated source URLs (default: main-tools)
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
  local using_defaults=false
  if [[ ${#ARGS[@]} -eq 0 ]]; then
    ARGS=("${DEFAULT_PATHS[@]}")
    using_defaults=true
  fi
  
  # Validate paths. Missing default paths are skipped so the same defaults work
  # on branches where a managed directory does not exist yet.
  local -a existing=()
  for path in "${ARGS[@]}"; do
    if [[ -e "${path}" ]]; then
      existing+=("${path}")
    elif [[ "${using_defaults}" == "true" ]]; then
      log_warn "Skipping missing default path: ${path}"
    else
      die "Path does not exist: ${path}"
    fi
  done

  ARGS=()
  if [[ ${#existing[@]} -gt 0 ]]; then
    ARGS=("${existing[@]}")
  fi
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
  
  if [[ ${#ARGS[@]} -eq 0 ]]; then
    log_warn "No existing paths to process"
  else
    for path in "${ARGS[@]}"; do
      process_path "${path}"
    done
  fi
  
  log_info "Done"
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
