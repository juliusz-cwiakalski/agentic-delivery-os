#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/scripts/install.sh
# install.sh — Install or update Agentic Delivery OS (ADOS) globally or into a local project
#
# Dependencies: bash>=4, git, diff, cp, mkdir
# Usage: ./install.sh [--global|--local] [options]
#
# Three modes:
#   --global (-g)  Clone ADOS repo to ~/.ados/ and install agent+command definitions
#                  to ~/.config/opencode/ so they're available in every project.
#                  Re-running --global updates to the latest version (idempotent).
#   --local  (-l)  Copy ADOS artifacts into the CURRENT project directory.
#                  This is the default mode when neither flag is specified.
#                  Re-running --local content-syncs (overwrites) redistributable
#                  guides/templates/handbook to the latest upstream version while
#                  preserving project-specific files (pm-instructions.md). Copy a
#                  template to a working file rather than editing it in place.
#
# Interactive mode:
#   --interactive (-i)  When a file differs from upstream, show a colored unified
#                       diff and prompt whether to overwrite or keep the local version.
#
# Branch selection:
#   --branch (-b) <name>  Install from a specific branch (default: main).
#                         Useful for testing pre-merge changes.
#
# Auto-fetch:
#   By default, --local pulls the latest ADOS source before copying files.
#   --no-fetch disables auto-fetch (useful for offline or pinned-version installs).
#
# One-liner install:
#   curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install.sh | bash -s -- --global
#
# Environment:
#   ADOS_REPO_URL          - Override ADOS git clone URL
#   ADOS_RAW_URL           - Override raw GitHub content URL
#   ADOS_HOME              - Override ADOS home directory (default: ~/.ados)
#   ADOS_REPO_DIR          - Override cloned repo location (default: ~/.ados/repo)
#   OPENCODE_GLOBAL_DIR    - Override opencode config dir (default: ~/.config/opencode)
#   ADOS_SOURCE_DIR        - Override source repo for local install (default: auto-detected)
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
# install.sh uses `shopt -s globstar` for recursive template copying
# (doc/templates/**; see install_local_files). globstar is bash>=4 — on macOS
# system bash 3.2 the option does not exist and, under `set -e`, the failing
# `shopt -s globstar` would abort with an opaque error. Fail loudly instead.
# Mirrors scripts/.tests/test-doc-distribution.sh's capability check.
if ! (shopt -s globstar) >/dev/null 2>&1; then
  printf '[ERROR] %s requires bash>=4 (globstar unsupported by this shell: %s). On macOS install bash 4+ (e.g. "brew install bash") or run via the CI container.\n' \
    "${0##*/}" "${BASH_VERSION:-unknown}" >&2
  exit 1
fi

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="ados-install"
readonly APP_VERSION="2.0.0"
readonly LOG_TAG="(${APP_NAME})"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_CONFIG=3
readonly EXIT_RUNTIME=4
readonly EXIT_EXTERNAL=5

# ============================================================================
# FILE MANIFEST — What gets installed locally
# Review these arrays to understand exactly what ADOS copies into your project.
# ============================================================================

# Files that ALWAYS track upstream ADOS (auto-updated on re-run)
# NOTE: Generic ADOS guides (doc/guides/*.md) are NOT hand-listed here. Their
# install set is DERIVED from the `ados_distribution` frontmatter marker (see
# get_marker() + install_local_files) — only guides marked `redistributable`
# install. The standalone non-guide docs below live outside the globbed guide
# class and remain explicit (they are marker-checked by the drift guard).
readonly ADOS_UPDATABLE_FILES=(
  # Documentation handbook
  "doc/documentation-handbook.md"
  # Documentation index
  "doc/00-index.md"
  # Decision records stubs
  "doc/decisions/README.md"
  "doc/decisions/00-index.md"
  # AI rules index
  ".ai/rules/README.md"
)

# Template files (also always track upstream) — glob-copied from doc/templates/
readonly ADOS_TEMPLATE_DIR="doc/templates"

# Files that are PROJECT-SPECIFIC (skip if exists, preserve local edits)
# Note: pm-instructions.md is NOT copied — it must be generated by /bootstrap
# or created manually per project. The ADOS version is specific to the ADOS repo.
readonly ADOS_PROJECT_FILES=(
)

# Directories to create as empty stubs
readonly ADOS_LOCAL_DIRS=(
  "doc/overview"
  "doc/spec/features"
  "doc/decisions"
  "doc/changes"
  "doc/guides"
  ".ai/agent"
  ".ai/local"
  ".ai/rules"
)

# ============================================================================
# CONFIGURABLE VIA ENVIRONMENT
# ============================================================================
readonly ADOS_REPO_URL="${ADOS_REPO_URL:-https://github.com/juliusz-cwiakalski/agentic-delivery-os.git}"
readonly ADOS_RAW_URL="${ADOS_RAW_URL:-https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main}"
readonly ADOS_HOME="${ADOS_HOME:-${HOME}/.ados}"
readonly ADOS_REPO_DIR="${ADOS_REPO_DIR:-${ADOS_HOME}/repo}"
readonly OPENCODE_GLOBAL_DIR="${OPENCODE_GLOBAL_DIR:-${HOME}/.config/opencode}"

DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
FORCE="${FORCE:-false}"
INTERACTIVE="${INTERACTIVE:-false}"
NO_FETCH="${NO_FETCH:-false}"
ADOS_BRANCH="${ADOS_BRANCH:-main}"
ALLOW_NON_ROOT="${ALLOW_NON_ROOT:-false}"

# Install mode: "global" or "local"
INSTALL_MODE=""

# Tool selection: "opencode", "claude", or "all"
TOOL="${TOOL:-opencode}"
CLAUDE_GLOBAL_DIR="${CLAUDE_GLOBAL_DIR:-${HOME}/.claude}"

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
_git() { command git "$@"; }
_diff() { command diff "$@"; }
_cp() { command cp "$@"; }
_mkdir() { command mkdir "$@"; }

# ============================================================================
# DOMAIN FUNCTIONS — Shared
# ============================================================================

# Copy a single file with diff-check. Returns 0 if copied, 1 if skipped.
# Sets global counters: _added, _updated, _unchanged
_added=0
_updated=0
_unchanged=0

reset_counters() {
  _added=0
  _updated=0
  _unchanged=0
}

# Show a colored unified diff between local and upstream, then prompt.
# Returns 0 (overwrite) or 1 (skip).
prompt_diff_overwrite() {
  local -r src="$1"
  local -r dest="$2"
  local -r label="${3:-$(basename "${dest}")}"

  printf '\n--- %s differs from upstream ---\n' "${label}"
  _diff --color=auto -u "${dest}" "${src}" 2>/dev/null || _diff -u "${dest}" "${src}" || true
  printf '\n'

  printf 'Overwrite %s with upstream version? [y/n]: ' "${label}"
  local answer
  read -r answer
  case "${answer}" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) return 1 ;;
  esac
}

copy_file_with_diff() {
  local -r src="$1"
  local -r dest="$2"
  local -r label="${3:-$(basename "${dest}")}"

  if [[ ! -f "${src}" ]]; then
    log_warn "Source file not found: ${src}"
    return 1
  fi

  if [[ -L "${dest}" ]]; then
    # Replace old symlinks
    run_cmd rm -f "${dest}"
    run_cmd _cp "${src}" "${dest}"
    log_info "update ${label} (replaced symlink with copy)"
    ((_updated++)) || true
  elif [[ -f "${dest}" ]]; then
    if _diff -q "${src}" "${dest}" >/dev/null 2>&1; then
      log_debug "skip   ${label} (already up to date)"
      ((_unchanged++)) || true
    else
      if [[ "${FORCE}" == "true" || "${INSTALL_MODE}" == "global" ]]; then
        # Always update in global mode or with --force
        run_cmd _cp "${src}" "${dest}"
        log_info "update ${label}"
        ((_updated++)) || true
      elif [[ "${INTERACTIVE}" == "true" ]]; then
        # Interactive: show diff and ask
        if prompt_diff_overwrite "${src}" "${dest}" "${label}"; then
          run_cmd _cp "${src}" "${dest}"
          log_info "update ${label}"
          ((_updated++)) || true
        else
          log_info "skip   ${label} (kept local version)"
          ((_unchanged++)) || true
        fi
      elif [[ "${_updatable:-false}" == "true" ]]; then
        # Updatable file: auto-update
        run_cmd _cp "${src}" "${dest}"
        log_info "update ${label}"
        ((_updated++)) || true
      else
        # Project-specific: preserve
        log_info "skip   ${label} (local changes; use --force or --interactive)"
        ((_unchanged++)) || true
      fi
    fi
  else
    run_cmd _mkdir -p "$(dirname "${dest}")"
    run_cmd _cp "${src}" "${dest}"
    log_info "add    ${label}"
    ((_added++)) || true
  fi
}

# Copy a file that should always be updated to match upstream (templates, handbook)
copy_updatable_file() {
  local _updatable=true
  copy_file_with_diff "$@"
}

# Ensure a directory exists; create stub if missing
ensure_dir() {
  local -r dir="$1"
  local -r label="${2:-${dir}}"

  if [[ -d "${dir}" ]]; then
    log_debug "skip   ${label}/ (already exists)"
  else
    run_cmd _mkdir -p "${dir}"
    log_info "create ${label}/"
  fi
}

# Check if a pattern exists in a file
file_contains_line() {
  local -r file="$1"
  local -r pattern="$2"

  [[ -f "${file}" ]] && grep -qF "${pattern}" "${file}" 2>/dev/null
}

# Add line to .gitignore if not already present
ensure_gitignore_entry() {
  local -r gitignore="$1"
  local -r entry="$2"

  if file_contains_line "${gitignore}" "${entry}"; then
    log_debug "skip   .gitignore entry '${entry}' (already present)"
    return 0
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would add '${entry}' to ${gitignore}"
    return 0
  fi

  # Create .gitignore if it doesn't exist
  if [[ ! -f "${gitignore}" ]]; then
    printf '%s\n' "${entry}" > "${gitignore}"
  else
    printf '\n%s\n' "${entry}" >> "${gitignore}"
  fi
  log_info "add    .gitignore entry '${entry}'"
}

# Validate that configurable paths are safe
validate_paths() {
  local canonical_home
  canonical_home="$(realpath -m "${HOME}" 2>/dev/null || readlink -m "${HOME}" 2>/dev/null || printf '%s' "${HOME}")"

  # Validate ADOS_HOME is under $HOME
  local canonical_ados_home
  canonical_ados_home="$(realpath -m "${ADOS_HOME}" 2>/dev/null || readlink -m "${ADOS_HOME}" 2>/dev/null || printf '%s' "${ADOS_HOME}")"
  if [[ "${canonical_ados_home}" != "${canonical_home}"/* ]]; then
    log_warn "ADOS_HOME is outside \$HOME: ${ADOS_HOME}"
  fi

  # Validate OPENCODE_GLOBAL_DIR is under $HOME
  local canonical_opencode
  canonical_opencode="$(realpath -m "${OPENCODE_GLOBAL_DIR}" 2>/dev/null || readlink -m "${OPENCODE_GLOBAL_DIR}" 2>/dev/null || printf '%s' "${OPENCODE_GLOBAL_DIR}")"
  if [[ "${canonical_opencode}" != "${canonical_home}"/* ]]; then
    log_warn "OPENCODE_GLOBAL_DIR is outside \$HOME: ${OPENCODE_GLOBAL_DIR}"
  fi

  # Validate ADOS_REPO_URL scheme (warn on non-https)
  if [[ -n "${ADOS_REPO_URL:-}" && "${ADOS_REPO_URL}" != https://* ]]; then
    log_warn "ADOS_REPO_URL does not use HTTPS: ${ADOS_REPO_URL}"
  fi
}

# ============================================================================
# DOMAIN FUNCTIONS — Global Install
# ============================================================================

clone_or_update_repo() {
  local before_sha=""

  if [[ -d "${ADOS_REPO_DIR}/.git" ]]; then
    before_sha="$(_git -C "${ADOS_REPO_DIR}" rev-parse --short HEAD 2>/dev/null || true)"
    log_info "Updating existing ADOS repo at ${ADOS_REPO_DIR} (current: ${before_sha:-unknown})"

    # Switch branch if needed
    local current_branch
    current_branch="$(_git -C "${ADOS_REPO_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    if [[ "${current_branch}" != "${ADOS_BRANCH}" ]]; then
      log_info "Switching branch: ${current_branch} → ${ADOS_BRANCH}"
      run_cmd _git -C "${ADOS_REPO_DIR}" fetch origin
      run_cmd _git -C "${ADOS_REPO_DIR}" checkout "${ADOS_BRANCH}" 2>/dev/null \
        || run_cmd _git -C "${ADOS_REPO_DIR}" checkout -b "${ADOS_BRANCH}" "origin/${ADOS_BRANCH}"
    fi

    run_cmd _git -C "${ADOS_REPO_DIR}" pull --ff-only
  else
    log_info "Cloning ADOS repo to ${ADOS_REPO_DIR} (branch: ${ADOS_BRANCH})"
    run_cmd _mkdir -p "${ADOS_HOME}"
    run_cmd _git clone --branch "${ADOS_BRANCH}" "${ADOS_REPO_URL}" "${ADOS_REPO_DIR}"
  fi

  # Report installed version
  if [[ -d "${ADOS_REPO_DIR}/.git" && "${DRY_RUN}" != "true" ]]; then
    local after_sha after_branch
    after_sha="$(_git -C "${ADOS_REPO_DIR}" rev-parse --short HEAD 2>/dev/null || true)"
    after_branch="$(_git -C "${ADOS_REPO_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    if [[ -n "${before_sha}" && "${before_sha}" != "${after_sha}" ]]; then
      log_info "Updated: ${before_sha} → ${after_sha} (${after_branch})"
    elif [[ -z "${before_sha}" ]]; then
      log_info "Installed at: ${after_sha:-unknown} (${after_branch})"
    else
      log_info "Already at latest: ${after_sha} (${after_branch})"
    fi
  fi
}

install_global_files() {
  local -r agent_src="${ADOS_REPO_DIR}/.opencode/agent"
  local -r command_src="${ADOS_REPO_DIR}/.opencode/command"
  
  # Install for OpenCode
  if [[ "${TOOL}" == "opencode" || "${TOOL}" == "all" ]]; then
    local -r agent_dest="${OPENCODE_GLOBAL_DIR}/agent"
    local -r command_dest="${OPENCODE_GLOBAL_DIR}/command"

    ensure_dir "${agent_dest}" "~/.config/opencode/agent"
    ensure_dir "${command_dest}" "~/.config/opencode/command"

    # Copy agent definitions
    if [[ -d "${agent_src}" ]]; then
      local agent_file
      for agent_file in "${agent_src}"/*.md; do
        [[ -f "${agent_file}" ]] || continue
        local name
        name="$(basename "${agent_file}")"
        copy_file_with_diff "${agent_file}" "${agent_dest}/${name}" "agent/${name}"
      done
    else
      log_warn "Agent source directory not found: ${agent_src}"
    fi

    # Copy command definitions
    if [[ -d "${command_src}" ]]; then
      local cmd_file
      for cmd_file in "${command_src}"/*.md; do
        [[ -f "${cmd_file}" ]] || continue
        local name
        name="$(basename "${cmd_file}")"
        copy_file_with_diff "${cmd_file}" "${command_dest}/${name}" "command/${name}"
      done
    else
      log_warn "Command source directory not found: ${command_src}"
    fi
  fi
  
  # Install for Claude Code
  if [[ "${TOOL}" == "claude" || "${TOOL}" == "all" ]]; then
    log_warn ""
    log_warn "=== DEPRECATION NOTICE ==="
    log_warn "The --tool claude option is deprecated."
    log_warn ""
    log_warn "Claude Code has its own plugin system. Instead, use:"
    log_warn "  /plugin marketplace add juliusz-cwiakalski/agentic-delivery-os"
    log_warn "  /plugin install ados@ados"
    log_warn ""
    log_warn "For local development: claude --plugin-dir .ados-claude"
    log_warn "=========================="
    log_warn ""
    
    local -r claude_agent_src="${ADOS_REPO_DIR}/.ados-claude/agents"
    local -r claude_skill_src="${ADOS_REPO_DIR}/.ados-claude/skills"
    local -r claude_agent_dest="${CLAUDE_GLOBAL_DIR}/agents"
    local -r claude_skill_dest="${CLAUDE_GLOBAL_DIR}/skills"

    ensure_dir "${claude_agent_dest}" "~/.claude/agents"
    ensure_dir "${claude_skill_dest}" "~/.claude/skills"

    # Copy agent definitions
    if [[ -d "${claude_agent_src}" ]]; then
      local agent_file
      for agent_file in "${claude_agent_src}"/*.md; do
        [[ -f "${agent_file}" ]] || continue
        local name
        name="$(basename "${agent_file}")"
        copy_file_with_diff "${agent_file}" "${claude_agent_dest}/${name}" "agents/${name}"
      done
    else
      log_warn "Claude agent source directory not found: ${claude_agent_src}"
    fi

    # Copy skill directories
    if [[ -d "${claude_skill_src}" ]]; then
      local skill_dir
      for skill_dir in "${claude_skill_src}"/*/; do
        [[ -d "${skill_dir}" ]] || continue
        local skill_name
        skill_name="$(basename "${skill_dir}")"
        local skill_file="${skill_dir}SKILL.md"
        if [[ -f "${skill_file}" ]]; then
          ensure_dir "${claude_skill_dest}/${skill_name}" "skills/${skill_name}"
          copy_file_with_diff "${skill_file}" "${claude_skill_dest}/${skill_name}/SKILL.md" "skills/${skill_name}/SKILL.md"
        fi
      done
    else
      log_warn "Claude skill source directory not found: ${claude_skill_src}"
    fi
  fi
}

do_global_install() {
  require_cmd git
  validate_paths

  log_info "=== ADOS Global Install ==="
  log_info "ADOS_HOME:          ${ADOS_HOME}"
  log_info "ADOS_REPO_DIR:      ${ADOS_REPO_DIR}"
  log_info "TOOL:               ${TOOL}"
  if [[ "${TOOL}" == "opencode" || "${TOOL}" == "all" ]]; then
    log_info "OPENCODE_GLOBAL_DIR: ${OPENCODE_GLOBAL_DIR}"
  fi
  if [[ "${TOOL}" == "claude" || "${TOOL}" == "all" ]]; then
    log_info "CLAUDE_GLOBAL_DIR:  ${CLAUDE_GLOBAL_DIR}"
  fi
  [[ "${ADOS_BRANCH}" != "main" ]] && log_info "Branch:             ${ADOS_BRANCH}"

  clone_or_update_repo
  reset_counters
  install_global_files

  printf '\n'
  log_info "Done — ${_added} added, ${_updated} updated, ${_unchanged} unchanged"
  log_info "ADOS agents and commands are now available globally"
  printf '\n'
  log_info "To update: re-run this same command (idempotent — only changed files are updated)"
  log_info "To set up a project: run '${ADOS_REPO_DIR}/scripts/install.sh --local' in a project root"
}

# ============================================================================
# DOMAIN FUNCTIONS — Local Install
# ============================================================================

# Resolve the ADOS source directory (where to copy artifacts from)
resolve_source_dir() {
  # 1. Explicit override via environment
  if [[ -n "${ADOS_SOURCE_DIR:-}" ]]; then
    if [[ -d "${ADOS_SOURCE_DIR}" ]]; then
      printf '%s' "${ADOS_SOURCE_DIR}"
      return 0
    else
      log_err "ADOS_SOURCE_DIR does not exist: ${ADOS_SOURCE_DIR}"
      return "${EXIT_CONFIG}"
    fi
  fi

  # 2. Running from the ADOS repo itself (script's own repo)
  # Note: BASH_SOURCE is unset when piped via curl|bash; skip this check in that case
  if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
    local script_dir
    script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
    local candidate="${script_dir}/.."
    if [[ -f "${candidate}/AGENTS.md" && -d "${candidate}/.opencode/agent" ]]; then
      printf '%s' "$(cd "${candidate}" && pwd -P)"
      return 0
    fi
  fi

  # 3. Global install location
  if [[ -d "${ADOS_REPO_DIR}/.opencode/agent" ]]; then
    printf '%s' "${ADOS_REPO_DIR}"
    return 0
  fi

  log_err "Cannot find ADOS source. Install globally first (--global) or set ADOS_SOURCE_DIR"
  return "${EXIT_CONFIG}"
}

# Pull latest ADOS source before copying files (unless disabled)
auto_fetch_source() {
  local -r source_dir="$1"

  # Skip if auto-fetch is disabled
  if [[ "${NO_FETCH}" == "true" ]]; then
    log_debug "Auto-fetch disabled (--no-fetch)"
    return 0
  fi

  # Skip if ADOS_SOURCE_DIR is explicitly set (user controls source)
  if [[ -n "${ADOS_SOURCE_DIR:-}" ]]; then
    log_debug "Auto-fetch skipped (ADOS_SOURCE_DIR is set by user)"
    return 0
  fi

  # Only fetch if source is a git repo
  if [[ ! -d "${source_dir}/.git" ]]; then
    log_debug "Auto-fetch skipped (source is not a git repo)"
    return 0
  fi

  log_info "Fetching latest ADOS source..."

  # Switch branch if needed
  local current_branch
  current_branch="$(_git -C "${source_dir}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -n "${current_branch}" && "${current_branch}" != "${ADOS_BRANCH}" ]]; then
    log_info "Switching source branch: ${current_branch} → ${ADOS_BRANCH}"
    run_cmd _git -C "${source_dir}" fetch origin 2>/dev/null || true
    run_cmd _git -C "${source_dir}" checkout "${ADOS_BRANCH}" 2>/dev/null \
      || run_cmd _git -C "${source_dir}" checkout -b "${ADOS_BRANCH}" "origin/${ADOS_BRANCH}" 2>/dev/null \
      || log_warn "Could not switch to branch ${ADOS_BRANCH}"
  fi

  if run_cmd _git -C "${source_dir}" pull --ff-only 2>/dev/null; then
    log_debug "Auto-fetch completed"
  else
    log_warn "Auto-fetch failed (continuing with current version; use --no-fetch to suppress)"
  fi

  # Show version info
  if [[ "${DRY_RUN}" != "true" ]]; then
    local short_sha
    short_sha="$(_git -C "${source_dir}" rev-parse --short HEAD 2>/dev/null || true)"
    if [[ -n "${short_sha}" ]]; then
      log_info "Source version: ${short_sha}"
    fi
  fi
}

# Verify we're in a git project (root or subdir with --allow-non-root)
require_project_root() {
  if [[ -d ".git" ]]; then
    return 0
  fi

  # Check if we're inside a git repo at all
  local git_root
  git_root="$(_git rev-parse --show-toplevel 2>/dev/null || true)"

  if [[ -z "${git_root}" ]]; then
    die "Not inside a git repository. Run from a project directory."
  fi

  # We're inside a git repo but not at the root
  if [[ "${ALLOW_NON_ROOT}" == "true" ]]; then
    log_warn "Not at git root. Installing into subdirectory: $(pwd)"
    log_warn "Git root is: ${git_root}"
    return 0
  fi

  log_err "Not a project root (no .git directory in current directory)."
  log_err "  Current directory: $(pwd)"
  log_err "  Git root:          ${git_root}"
  log_err ""
  log_err "If you want to install into this subdirectory (e.g., monorepo subproject),"
  log_err "add --allow-non-root to the command."
  exit "${EXIT_USAGE}"
}

# Read the `ados_distribution` marker from a doc using a TWO-PATH parser (CRIT-1):
#   .md        -> the FIRST `---`-delimited frontmatter block only (line 1 must be
#                 `---`); within it, match `^ados_distribution:[ \t]*(.+)`, skipping
#                 `^#` comment lines; occurrences in the body or a second block are
#                 ignored.
#   .yaml/.yml -> a TOP-LEVEL `^ados_distribution:` key anywhere (these register
#                 templates have no frontmatter; a `---` block would break
#                 yaml.safe_load() consumers).
# CRLF-tolerant (a trailing \r is stripped per record so the regexes still match
# on a Windows working tree) and strips surrounding single/double quotes from the
# value (valid YAML `ados_distribution: "x"` / '"x"' returns the bare enum).
# Returns the trimmed marker value, or "missing" if absent / no frontmatter.
# (Pure POSIX awk — NFR-4: no YAML library.) Mirrors the guard's parser EXACTLY.
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

install_local_files() {
  local -r source_dir="$1"

  # --- Project-specific files (preserve local edits) ---
  local file
  for file in "${ADOS_PROJECT_FILES[@]}"; do
    if [[ -f "${source_dir}/${file}" ]]; then
      copy_file_with_diff "${source_dir}/${file}" "${file}" "${file}"
    else
      log_warn "Skipping (not in source): ${file}"
    fi
  done

  # --- Updatable files (always track upstream) ---
  # A stale manifest entry (file renamed/removed upstream) must not abort the
  # whole install: warn and skip so the remaining files still get installed.
  for file in "${ADOS_UPDATABLE_FILES[@]}"; do
    if [[ -f "${source_dir}/${file}" ]]; then
      copy_updatable_file "${source_dir}/${file}" "${file}" "${file}"
    else
      log_warn "Skipping (not in source): ${file}"
    fi
  done

  # --- Guides: install set DERIVED from the ados_distribution marker ---
  # Only guides marked `redistributable` are installed (the hand-list is gone).
  # This is the marker-driven half of F-2: adding a redistributable guide needs
  # no manifest edit; the guard (test-doc-distribution.sh) keeps the set correct.
  if [[ -d "${source_dir}/doc/guides" ]]; then
    local guide_file marker guide_name
    for guide_file in "${source_dir}/doc/guides"/*.md; do
      [[ -f "${guide_file}" ]] || continue
      marker="$(get_marker "${guide_file}")"
      if [[ "${marker}" != "redistributable" ]]; then
        log_debug "skip   doc/guides/$(basename "${guide_file}") (ados_distribution=${marker})"
        continue
      fi
      guide_name="$(basename "${guide_file}")"
      copy_updatable_file "${guide_file}" "doc/guides/${guide_name}" "doc/guides/${guide_name}"
    done
  fi

  # --- Templates: recursive install (*.md + *.yaml + blueprints/**) ---
  # Per ODR-0001 / DEC-1 / DEC-2 — blueprints and the 4 YAML register templates
  # now install (previously the flat `*.md` glob silently dropped them).
  # Reuses copy_updatable_file (content-sync: overwrite only when content differs).
  if [[ -d "${source_dir}/${ADOS_TEMPLATE_DIR}" ]]; then
    ensure_dir "${ADOS_TEMPLATE_DIR}" "${ADOS_TEMPLATE_DIR}"
    # globstar covers nested blueprints/**; nullglob keeps unmatched globs empty.
    local _gs_was_on="off" _ng_was_on="off"
    shopt -q globstar && _gs_was_on="on"
    shopt -q nullglob && _ng_was_on="on"
    shopt -s globstar nullglob
    local tmpl_file tmpl_rel
    for tmpl_file in "${source_dir}/${ADOS_TEMPLATE_DIR}"/**/*.md "${source_dir}/${ADOS_TEMPLATE_DIR}"/**/*.yaml; do
      [[ -f "${tmpl_file}" ]] || continue
      # Preserve the relative path under doc/templates/ (e.g. blueprints/x.md).
      tmpl_rel="${tmpl_file#"${source_dir}/"}"
      copy_updatable_file "${tmpl_file}" "${tmpl_rel}" "${tmpl_rel}"
    done
    [[ "${_gs_was_on}" == "off" ]] && shopt -u globstar
    [[ "${_ng_was_on}" == "off" ]] && shopt -u nullglob
  else
    log_warn "Templates directory not found: ${source_dir}/${ADOS_TEMPLATE_DIR}"
  fi

  # --- Directory stubs ---
  local dir
  for dir in "${ADOS_LOCAL_DIRS[@]}"; do
    ensure_dir "${dir}" "${dir}"
  done

  # --- .gitignore entries ---
  ensure_gitignore_entry ".gitignore" ".ai/local/"
  ensure_gitignore_entry ".gitignore" ".ai/local"
  
  # Tool-specific: Copy .ados-claude/ for Claude Code
  # NOTE: --tool claude is deprecated for local mode too.
  # For local development, use: claude --plugin-dir .ados-claude
  # For global installation, use Claude Code's plugin system:
  #   /plugin marketplace add juliusz-cwiakalski/agentic-delivery-os
  #   /plugin install ados@ados
  if [[ "${TOOL}" == "claude" || "${TOOL}" == "all" ]]; then
    log_warn ""
    log_warn "=== DEPRECATION NOTICE ==="
    log_warn "The --tool claude option is deprecated."
    log_warn "For local development: claude --plugin-dir .ados-claude"
    log_warn "For global installation, use Claude Code's plugin system:"
    log_warn "  /plugin marketplace add juliusz-cwiakalski/agentic-delivery-os"
    log_warn "  /plugin install ados@ados"
    log_warn "=========================="
    log_warn ""
    
    local -r claude_src="${source_dir}/.ados-claude"
    if [[ -d "${claude_src}" ]]; then
      log_info "Copying Claude Code plugin..."
      
      # Copy agents
      if [[ -d "${claude_src}/agents" ]]; then
        local claude_agent_dest="./.claude/agents"
        ensure_dir "${claude_agent_dest}" "./.claude/agents"
        local agent_file
        for agent_file in "${claude_src}/agents"/*.md; do
          [[ -f "${agent_file}" ]] || continue
          local agent_name
          agent_name="$(basename "${agent_file}")"
          copy_file_with_diff "${agent_file}" "${claude_agent_dest}/${agent_name}" ".claude/agents/${agent_name}"
        done
      fi
      
      # Copy skills
      if [[ -d "${claude_src}/skills" ]]; then
        local claude_skill_dest="./.claude/skills"
        ensure_dir "${claude_skill_dest}" "./.claude/skills"
        local skill_dir
        for skill_dir in "${claude_src}/skills"/*/; do
          [[ -d "${skill_dir}" ]] || continue
          local skill_name
          skill_name="$(basename "${skill_dir}")"
          local skill_file="${skill_dir}SKILL.md"
          if [[ -f "${skill_file}" ]]; then
            ensure_dir "${claude_skill_dest}/${skill_name}" ".claude/skills/${skill_name}"
            copy_file_with_diff "${skill_file}" "${claude_skill_dest}/${skill_name}/SKILL.md" ".claude/skills/${skill_name}/SKILL.md"
          fi
        done
      fi
    else
      log_warn "Claude Code plugin directory not found: ${claude_src}"
    fi
  fi
}

do_local_install() {
  require_project_root
  validate_paths

  local source_dir
  source_dir="$(resolve_source_dir)" || exit $?

  # Auto-fetch latest source before installing
  auto_fetch_source "${source_dir}"

  log_info "=== ADOS Local Install ==="
  log_info "Source:  ${source_dir}"
  log_info "Target:  $(pwd)"
  log_info "TOOL:    ${TOOL}"
  [[ "${ADOS_BRANCH}" != "main" ]] && log_info "Branch:  ${ADOS_BRANCH}"
  [[ "${FORCE}" == "true" ]] && log_info "Mode:    force (overwrite existing files)"
  [[ "${INTERACTIVE}" == "true" ]] && log_info "Mode:    interactive (prompt on diff)"

  reset_counters
  install_local_files "${source_dir}"

  printf '\n'
  log_info "Done — ${_added} added, ${_updated} updated, ${_unchanged} unchanged"
  printf '\n'
  if [[ "${_added}" -gt 0 ]]; then
    log_info "Next steps:"
    if [[ "${TOOL}" == "opencode" || "${TOOL}" == "all" ]]; then
      log_info "  1. Open this project in OpenCode (https://opencode.ai)"
      log_info "  2. Run /bootstrap to complete setup with AI-guided configuration"
      log_info "     The bootstrapper will detect your tracker, generate PM instructions,"
      log_info "     and customize AGENTS.md for your project."
    fi
    if [[ "${TOOL}" == "claude" || "${TOOL}" == "all" ]]; then
      log_info ""
      log_info "  For Claude Code: Use Claude Code's plugin system instead:"
      log_info "    /plugin marketplace add juliusz-cwiakalski/agentic-delivery-os"
      log_info "    /plugin install ados@ados"
      log_info ""
      log_info "  For local development: claude --plugin-dir .ados-claude"
    fi
  else
    log_info "Project artifacts updated to latest ADOS version"
    log_info "Templates, guides, and handbook updated; project-specific files preserved"
  fi
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
Usage: ${APP_NAME} [--global|--local] [options]

Install or update Agentic Delivery OS (ADOS) globally or into a local project.
Re-running is safe and idempotent — only changed files are updated.

Modes:
  -g, --global       Clone/update ADOS repo at ~/.ados/ and install agent/command
                     definitions to ~/.config/opencode/ (available everywhere).
                     Re-running pulls latest changes and updates all definitions.
  -l, --local        Copy ADOS artifacts into the current project (default).
                     Re-running content-syncs (overwrites) redistributable guides,
                     templates, and handbook to the latest ADOS version while
                     preserving project-specific files (pm-instructions.md).
                     NOTE: copy a template to a working file rather than editing
                     it in place — re-running will overwrite in-place edits to
                     redistributable docs.

Tool Selection:
      --tool <name>  Which AI coding tool to install for (default: opencode)
                     opencode: Install for OpenCode only
                     claude:   [DEPRECATED] Use /plugin marketplace add instead
                     all:      [DEPRECATED] Install for both tools

Options:
  -h, --help             Show this help message
  -V, --version          Show version
  -b, --branch <name>    Install from a specific branch (default: main)
  -n, --dry-run          Show what would be done without doing it
  -v, --verbose          Enable debug output
  -f, --force            Overwrite ALL existing files (including project-specific)
  -i, --interactive      Show diff and prompt before overwriting changed files
      --no-fetch         Skip auto-fetching latest ADOS source before local install
      --allow-non-root   Allow local install in a subdirectory (for monorepo subprojects)

File handling (--local mode):
  Redistributable files (guides, templates, handbook) are CONTENT-SYNCED to
  upstream on every re-run — overwritten when content differs to match the latest
  ADOS version. To customize, copy a template to a working file rather than
  editing it in place (re-running will overwrite in-place edits).
  Project-specific files (pm-instructions.md) are preserved if they exist locally.
  Use --interactive to review each diff, or --force to overwrite everything.

Installation targets:
  OpenCode (default):
    --global: ~/.config/opencode/agent/ and ~/.config/opencode/command/
    --local:  ./.opencode/agent/ and ./.opencode/command/
  Claude Code:
    --tool claude is DEPRECATED. Use Claude Code's plugin system instead:
      /plugin marketplace add juliusz-cwiakalski/agentic-delivery-os
      /plugin install ados@ados
    For local development: claude --plugin-dir .ados-claude

One-liner global install:
  curl -fsSL ${ADOS_RAW_URL}/scripts/install.sh | bash -s -- --global

Install from a specific branch (for testing pre-merge changes):
  curl -fsSL ${ADOS_RAW_URL}/scripts/install.sh | bash -s -- --global -b feat/my-branch

Install for Claude Code globally:
  curl -fsSL ${ADOS_RAW_URL}/scripts/install.sh | bash -s -- --global --tool claude

Local project install (after global install):
  ${ADOS_REPO_DIR}/scripts/install.sh --local

Environment:
  ADOS_REPO_URL          Override git clone URL
  ADOS_BRANCH            Override branch (default: main; same as --branch)
  ADOS_HOME              Override ~/.ados directory
  ADOS_REPO_DIR          Override ~/.ados/repo directory
  OPENCODE_GLOBAL_DIR    Override ~/.config/opencode directory
  CLAUDE_GLOBAL_DIR      Override ~/.claude directory
  ADOS_SOURCE_DIR        Override source repo for local install (disables auto-fetch)
  DRY_RUN                Set to 'true' to preview changes
  VERBOSE                Set to 'true' for debug output
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
      -g|--global) INSTALL_MODE="global" ;;
      -l|--local) INSTALL_MODE="local" ;;
      -b|--branch) shift; ADOS_BRANCH="${1:?--branch requires a branch name}" ;;
      -n|--dry-run) DRY_RUN=true ;;
      -v|--verbose) VERBOSE=true ;;
      -f|--force) FORCE=true ;;
      -i|--interactive) INTERACTIVE=true ;;
      --no-fetch) NO_FETCH=true ;;
      --allow-non-root) ALLOW_NON_ROOT=true ;;
      --tool)
        shift
        case "${1}" in
          opencode|claude|all) TOOL="${1}" ;;
          *) die "Invalid tool: ${1}. Must be opencode, claude, or all" ;;
        esac
        ;;
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

  # Default to local if no mode specified
  if [[ -z "${INSTALL_MODE}" ]]; then
    INSTALL_MODE="local"
  fi

  log_debug "INSTALL_MODE=${INSTALL_MODE}"
  log_debug "ADOS_BRANCH=${ADOS_BRANCH}"
  log_debug "TOOL=${TOOL}"
  log_debug "DRY_RUN=${DRY_RUN}"
  log_debug "VERBOSE=${VERBOSE}"
  log_debug "FORCE=${FORCE}"
  log_debug "INTERACTIVE=${INTERACTIVE}"
  log_debug "NO_FETCH=${NO_FETCH}"

  case "${INSTALL_MODE}" in
    global) do_global_install ;;
    local)  do_local_install ;;
    *)      die "Invalid install mode: ${INSTALL_MODE}" ;;
  esac
}

# Testable main guard (${BASH_SOURCE[0]:-} handles curl|bash where BASH_SOURCE is unset)
if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
