#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/scripts/uninstall.sh
# uninstall.sh — Remove Agentic Delivery OS (ADOS) from global or local install
#
# Dependencies: bash>=4, rm, grep
# Usage: ./uninstall.sh [--global|--local] [options]
#
# Two modes:
#   --global (-g)  Remove agent/command files from ~/.config/opencode/ and ~/.ados/
#   --local  (-l)  Remove ADOS artifacts from the current project (with confirmation)
#
# Environment:
#   ADOS_HOME              - Override ADOS home directory (default: ~/.ados)
#   ADOS_REPO_DIR          - Override cloned repo location (default: ~/.ados/repo)
#   OPENCODE_GLOBAL_DIR    - Override opencode config dir (default: ~/.config/opencode)
#   DRY_RUN                - Set to 'true' to skip destructive operations
#   VERBOSE                - Set to 'true' for debug output
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

# --- bash>=4 capability check (PR #74 review C2). ---
# uninstall.sh uses `shopt -s globstar` for marker-driven recursive template
# removal (doc/templates/**; see remove_local_files). globstar is bash>=4 — on
# macOS system bash 3.2 the option does not exist and, under `set -e`, the
# failing `shopt -s globstar` would abort with an opaque error. Fail loudly
# instead. Mirrors scripts/.tests/test-doc-distribution.sh's capability check.
if ! (shopt -s globstar) >/dev/null 2>&1; then
  printf '[ERROR] %s requires bash>=4 (globstar unsupported by this shell: %s). On macOS install bash 4+ (e.g. "brew install bash") or run via the CI container.\n' \
    "${0##*/}" "${BASH_VERSION:-unknown}" >&2
  exit 1
fi

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="ados-uninstall"
readonly APP_VERSION="2.0.0"
readonly LOG_TAG="(${APP_NAME})"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_CONFIG=3
readonly EXIT_RUNTIME=4
readonly EXIT_EXTERNAL=5

# Configurable via environment
readonly ADOS_HOME="${ADOS_HOME:-${HOME}/.ados}"
readonly ADOS_REPO_DIR="${ADOS_REPO_DIR:-${ADOS_HOME}/repo}"
readonly OPENCODE_GLOBAL_DIR="${OPENCODE_GLOBAL_DIR:-${HOME}/.config/opencode}"

DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
FORCE="${FORCE:-false}"

# Uninstall mode: "global" or "local"
UNINSTALL_MODE=""

# Known ADOS agent files (installed globally)
readonly ADOS_AGENT_FILES=(
  bootstrapper.md doc-syncer.md test-plan-writer.md plan-writer.md
  spec-writer.md decision-advisor.md decision-critic.md pm.md image-reviewer.md image-generator.md
  toolsmith.md committer.md designer.md reviewer.md runner.md coder.md
  fixer.md pr-manager.md external-researcher.md editor.md
  meeting-organizer.md review-feedback-applier.md
)

# Known ADOS command files (installed globally)
readonly ADOS_COMMAND_FILES=(
  bootstrap.md plan-decision.md write-decision.md review-decision.md plan-change.md review.md
  commit.md pr.md run-plan.md check.md design.md write-spec.md
  review-deep.md write-plan.md write-test-plan.md sync-docs.md check-fix.md
)

# Known ADOS local files — project-specific (customized per project)
# Note: pm-instructions.md (.ai/agent/pm-instructions.md) is NOT removed — it's
# user-created (by /bootstrap or manually), never installed by install.sh, and
# lives outside the doc/guides|doc/templates|standalone paths walked below.
readonly ADOS_LOCAL_PROJECT_FILES=(
)

# Standalone non-guide DOC paths to CHECK for marker-driven removal (PR #74
# review C1). These live outside the globbed doc/guides|doc/templates classes,
# so the removal loop walks this explicit list and removes each ONLY when its
# `ados_distribution` marker is `redistributable` (e.g. decisions/00-index.md is
# `project-generated` and is therefore preserved). Mirrors install.sh's
# ADOS_UPDATABLE_FILES non-guide entries. Guides and templates are NOT listed
# here — their removal is glob+marker-driven (see remove_local_files). This list
# MUST stay in sync with install.sh's standalone manifest (independent copies,
# like the guard's STANDALONE set, so a drift is observable).
readonly ADOS_LOCAL_STANDALONE_DOCS=(
  "doc/documentation-handbook.md"
  "doc/00-index.md"
  "doc/decisions/README.md"
  "doc/decisions/00-index.md"
  ".ai/rules/README.md"
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
log_info()  { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*"; }
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*"; }
log_err()   { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*"; true; }
log_fatal() { log_err "$@"; exit "${EXIT_RUNTIME}"; }

die() { log_err "$@"; exit "${EXIT_USAGE}"; }

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
_rm() { command rm "$@"; }

# ----------------------------------------------------------------------------
# get_marker() — TWO-PATH parser, mirrors install.sh's parser EXACTLY (PR #74
# review C1). This is a deliberate byte-for-byte copy so marker-driven removal
# agrees with marker-driven install; consolidating the two into a shared lib is
# a separate future refactor (tracked independently).
#   .md        -> the FIRST `---`-delimited frontmatter block only (line 1 must
#                 be `---`); within it, match `^ados_distribution:[ \t]*(.+)`,
#                 skipping `^#` comment lines; body / second-block occurrences
#                 are ignored.
#   .yaml/.yml -> a TOP-LEVEL `^ados_distribution:` key anywhere (register
#                 templates have no frontmatter; a `---` block would break
#                 yaml.safe_load() consumers).
# CRLF-tolerant and strips surrounding single/double quotes from the value.
# Returns the trimmed marker value, or "missing" if absent / no frontmatter.
# ----------------------------------------------------------------------------
get_marker() {
  local -r file="$1"
  local ext
  ext="${file##*.}"
  case "${ext}" in
    md)
      awk '
        BEGIN { in_fm = 0; val = "missing" }
        { sub(/\r$/, "") }
        NR == 1 && /^---[ \t]*$/ { in_fm = 1; next }
        in_fm && /^---[ \t]*$/ { in_fm = 0 }
        in_fm && /^[#]/ { next }
        in_fm && /^ados_distribution:[ \t]*.+$/ {
          s = $0
          sub(/^ados_distribution:[ \t]*/, "", s)
          sub(/[ \t]+$/, "", s)
          sub(/^['"'"'"]/, "", s)
          sub(/['"'"'"]$/, "", s)
          val = s
          in_fm = 0
        }
        END { print val }
      ' "${file}"
      ;;
    yaml|yml)
      awk '
        BEGIN { val = "missing" }
        { sub(/\r$/, "") }
        /^ados_distribution:[ \t]*.+$/ {
          s = $0
          sub(/^ados_distribution:[ \t]*/, "", s)
          sub(/[ \t]+$/, "", s)
          sub(/^['"'"'"]/, "", s)
          sub(/['"'"'"]$/, "", s)
          val = s
        }
        END { print val }
      ' "${file}"
      ;;
    *)
      printf 'missing'
      ;;
  esac
}

# ============================================================================
# DOMAIN FUNCTIONS — Shared
# ============================================================================

_removed=0
_skipped=0

reset_counters() {
  _removed=0
  _skipped=0
}

# Remove a single file if it exists. Increments counters.
remove_file() {
  local -r path="$1"
  local -r label="${2:-${path}}"

  if [[ -f "${path}" || -L "${path}" ]]; then
    run_cmd _rm -f "${path}"
    log_info "remove ${label}"
    ((_removed++)) || true
  else
    log_debug "skip   ${label} (not found)"
    ((_skipped++)) || true
  fi
}

# Safely remove a directory if it exists and is valid
safe_rmdir() {
  local -r dir="$1"
  local -r label="${2:-${dir}}"

  # Safety: refuse empty path
  if [[ -z "${dir}" ]]; then
    log_err "Refusing to remove dangerous path: ''"
    return "${EXIT_RUNTIME}"
  fi

  # Canonicalize paths for safe comparison (resolve trailing slashes, dots, symlinks)
  local canonical_dir canonical_home
  canonical_dir="$(realpath -m "${dir}" 2>/dev/null || readlink -m "${dir}" 2>/dev/null || printf '%s' "${dir}")"
  canonical_home="$(realpath -m "${HOME}" 2>/dev/null || readlink -m "${HOME}" 2>/dev/null || printf '%s' "${HOME}")"

  # Safety: never rm root or home
  if [[ "${canonical_dir}" == "/" || "${canonical_dir}" == "${canonical_home}" ]]; then
    log_err "Refusing to remove dangerous path: '${dir}'"
    return "${EXIT_RUNTIME}"
  fi

  # Safety: minimum path depth (at least 3 components like /home/user/dir)
  local depth
  depth="$(printf '%s' "${canonical_dir}" | tr -cd '/' | wc -c)"
  if [[ "${depth}" -lt 3 ]]; then
    log_err "Refusing to remove shallow path (depth ${depth}): '${dir}'"
    return "${EXIT_RUNTIME}"
  fi

  if [[ -d "${dir}" ]]; then
    run_cmd _rm -rf "${dir}"
    log_info "remove ${label}/"
  else
    log_debug "skip   ${label}/ (not found)"
  fi
}

# Prompt user for confirmation (unless --force or DRY_RUN)
confirm_action() {
  local -r message="$1"

  if [[ "${FORCE}" == "true" || "${DRY_RUN}" == "true" ]]; then
    return 0
  fi

  printf '%s [y/N] ' "${message}"
  local answer
  read -r answer
  case "${answer}" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) return 1 ;;
  esac
}

# ============================================================================
# DOMAIN FUNCTIONS — Global Uninstall
# ============================================================================

remove_global_agents() {
  local -r agent_dir="${OPENCODE_GLOBAL_DIR}/agent"

  if [[ ! -d "${agent_dir}" ]]; then
    log_debug "Agent directory not found: ${agent_dir}"
    return 0
  fi

  local name
  for name in "${ADOS_AGENT_FILES[@]}"; do
    remove_file "${agent_dir}/${name}" "agent/${name}"
  done
}

remove_global_commands() {
  local -r command_dir="${OPENCODE_GLOBAL_DIR}/command"

  if [[ ! -d "${command_dir}" ]]; then
    log_debug "Command directory not found: ${command_dir}"
    return 0
  fi

  local name
  for name in "${ADOS_COMMAND_FILES[@]}"; do
    remove_file "${command_dir}/${name}" "command/${name}"
  done
}

do_global_uninstall() {
  log_info "=== ADOS Global Uninstall ==="
  log_info "ADOS_HOME:          ${ADOS_HOME}"
  log_info "OPENCODE_GLOBAL_DIR: ${OPENCODE_GLOBAL_DIR}"

  if ! confirm_action "Remove ADOS global installation? This will delete agent/command files and ${ADOS_HOME}"; then
    log_info "Aborted"
    return 0
  fi

  reset_counters
  remove_global_agents
  remove_global_commands

  # Remove ADOS home directory
  safe_rmdir "${ADOS_HOME}" "~/.ados"

  printf '\n'
  log_info "Done — ${_removed} files removed, ${_skipped} not found"
  log_info "ADOS global installation has been removed"
}

# ============================================================================
# DOMAIN FUNCTIONS — Local Uninstall
# ============================================================================

# Verify we're in a project root (has .git directory)
require_project_root() {
  if [[ ! -d ".git" ]]; then
    die "Not a project root (no .git directory). Run from your project's root directory."
  fi
}

remove_local_files() {
  # Marker-driven removal (PR #74 review C1) — symmetric to install.sh's
  # marker-driven install. The removal set is DERIVED from each installed
  # project file's `ados_distribution` marker: only `redistributable` files are
  # removed; `internal` / `project-generated` / unmarked files are preserved.
  # This eliminates the stale hand-list that orphaned newly-added redistributable
  # guides/templates on uninstall.
  #
  # Note: pm-instructions.md (.ai/agent/pm-instructions.md) is NOT removed — it
  # is user-created (by /bootstrap or manually), never installed by install.sh,
  # and lives outside the paths walked below.
  local file marker

  # --- Project-specific files ---
  for file in "${ADOS_LOCAL_PROJECT_FILES[@]}"; do
    remove_file "${file}" "${file}"
  done

  # --- Guides: marker-driven (remove only redistributable-marked) ---
  if [[ -d "doc/guides" ]]; then
    for file in doc/guides/*.md; do
      [[ -f "${file}" ]] || continue
      marker="$(get_marker "${file}")"
      if [[ "${marker}" == "redistributable" ]]; then
        remove_file "${file}" "${file}"
      else
        log_debug "keep   ${file} (ados_distribution=${marker})"
      fi
    done
  fi

  # --- Templates: marker-driven recursive (md + yaml incl. blueprints/**) ---
  if [[ -d "doc/templates" ]]; then
    local _gs_was_on="off" _ng_was_on="off"
    shopt -q globstar && _gs_was_on="on"
    shopt -q nullglob && _ng_was_on="on"
    shopt -s globstar nullglob
    for file in doc/templates/**/*.md doc/templates/**/*.yaml; do
      [[ -f "${file}" ]] || continue
      marker="$(get_marker "${file}")"
      if [[ "${marker}" == "redistributable" ]]; then
        remove_file "${file}" "${file}"
      else
        log_debug "keep   ${file} (ados_distribution=${marker})"
      fi
    done
    [[ "${_gs_was_on}" == "off" ]] && shopt -u globstar
    [[ "${_ng_was_on}" == "off" ]] && shopt -u nullglob
  fi

  # --- Standalone non-guide docs: marker-driven (explicit check list) ---
  for file in "${ADOS_LOCAL_STANDALONE_DOCS[@]}"; do
    [[ -f "${file}" ]] || continue
    marker="$(get_marker "${file}")"
    if [[ "${marker}" == "redistributable" ]]; then
      remove_file "${file}" "${file}"
    else
      log_debug "keep   ${file} (ados_distribution=${marker})"
    fi
  done

  # --- Remove empty directories (only if empty) ---
  local dir
  for dir in "doc/templates" "doc/overview" "doc/spec/features" "doc/spec" "doc/decisions" "doc/changes" "doc/guides" ".ai/agent" ".ai/rules" ".ai/local" ".ai"; do
    if [[ -d "${dir}" ]]; then
      if [[ -z "$(ls -A "${dir}" 2>/dev/null)" ]]; then
        run_cmd rmdir "${dir}"
        log_info "remove ${dir}/ (empty)"
      else
        log_debug "skip   ${dir}/ (not empty)"
      fi
    fi
  done
}

do_local_uninstall() {
  require_project_root

  log_info "=== ADOS Local Uninstall ==="
  log_info "Project: $(pwd)"

  if ! confirm_action "Remove ADOS artifacts from this project?"; then
    log_info "Aborted"
    return 0
  fi

  reset_counters
  remove_local_files

  printf '\n'
  log_info "Done — ${_removed} files removed, ${_skipped} not found"
  log_info "Note: .gitignore entries for .ai/local/ were NOT removed (manual cleanup if needed)"
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
Usage: ${APP_NAME} [--global|--local] [options]

Remove Agentic Delivery OS (ADOS) from global or local install.

Modes:
  -g, --global    Remove ADOS agent/command files from ~/.config/opencode/
                  and delete ~/.ados/ directory
  -l, --local     Remove ADOS artifacts from the current project

Options:
  -h, --help      Show this help message
  -V, --version   Show version
  -n, --dry-run   Show what would be removed without doing it
  -v, --verbose   Enable debug output
  -f, --force     Skip confirmation prompt

Environment:
  ADOS_HOME              Override ~/.ados directory
  ADOS_REPO_DIR          Override ~/.ados/repo directory
  OPENCODE_GLOBAL_DIR    Override ~/.config/opencode directory
  DRY_RUN                Set to 'true' to preview removals
  VERBOSE                Set to 'true' for debug output
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
      -g|--global) UNINSTALL_MODE="global" ;;
      -l|--local) UNINSTALL_MODE="local" ;;
      -n|--dry-run) DRY_RUN=true ;;
      -v|--verbose) VERBOSE=true ;;
      -f|--force) FORCE=true ;;
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

  if [[ -z "${UNINSTALL_MODE}" ]]; then
    die "Must specify --global or --local. See --help."
  fi

  log_debug "UNINSTALL_MODE=${UNINSTALL_MODE}"
  log_debug "DRY_RUN=${DRY_RUN}"
  log_debug "VERBOSE=${VERBOSE}"
  log_debug "FORCE=${FORCE}"

  case "${UNINSTALL_MODE}" in
    global) do_global_uninstall ;;
    local)  do_local_uninstall ;;
    *)      die "Invalid uninstall mode: ${UNINSTALL_MODE}" ;;
  esac
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
