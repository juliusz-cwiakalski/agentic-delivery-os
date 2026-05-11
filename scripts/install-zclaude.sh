#!/usr/bin/env bash
# install-zclaude.sh — Install zclaude to ~/.local/bin/ for system-wide use
#
# Dependencies: bash>=4, curl or wget
# Usage: curl -fsSL <url> | bash
#        wget -qO- <url> | bash
#        ./install-zclaude.sh
#
# Environment:
#   ZCLAUDE_INSTALL_DIR  - Override install directory (default: ~/.local/bin)
#   DRY_RUN              - Set to 'true' to preview changes
#   VERBOSE              - Set to 'true' for debug output
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
readonly APP_NAME="install-zclaude"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_CONFIG=3
readonly EXIT_RUNTIME=4
readonly EXIT_EXTERNAL=5

readonly ZCLAUDE_RAW_URL="https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/tools/zclaude"

DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
INSTALL_DIR="${ZCLAUDE_INSTALL_DIR:-${HOME}/.local/bin}"

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
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
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
# MOCKABLE WRAPPERS
# ============================================================================
_curl() { command curl "$@"; }
_mkdir() { command mkdir "$@"; }
_chmod() { command chmod "$@"; }
_tee() { command tee "$@"; }

# ============================================================================
# DOWNLOAD
# ============================================================================
download_tool() {
  local -r dest="$1"
  local -r url="${ZCLAUDE_RAW_URL}"

  if command -v curl >/dev/null 2>&1; then
    log_debug "Using curl to download"
    run_cmd _curl -fsSL "${url}" -o "${dest}"
  elif command -v wget >/dev/null 2>&1; then
    log_debug "Using wget to download"
    run_cmd command wget -qO "${dest}" "${url}"
  else
    die "Neither curl nor wget found. Install one to proceed."
  fi
}

# ============================================================================
# PATH MANAGEMENT
# ============================================================================
# Detect the user's shell config file
detect_shell_rc() {
  local shell_name
  shell_name="$(basename "${SHELL:-bash}")"

  case "${shell_name}" in
    zsh)  printf '%s' "${HOME}/.zshrc" ;;
    bash)
      # Prefer .bashrc on Linux/Git Bash, .bash_profile on macOS
      if [[ "$(uname -s)" == "Darwin" ]]; then
        printf '%s' "${HOME}/.bash_profile"
      else
        printf '%s' "${HOME}/.bashrc"
      fi
      ;;
    *)    printf '%s' "${HOME}/.profile" ;;
  esac
}

# Check if INSTALL_DIR is already in PATH
is_in_path() {
  local -r dir="$1"
  # Normalize trailing slashes for comparison
  local norm_dir norm_path
  norm_dir="${dir%/}"
  norm_path=":${PATH}:"
  [[ "${norm_path}" == *":${norm_dir}:"* ]]
}

# Offer to add INSTALL_DIR to PATH in shell rc
offer_path_setup() {
  local -r dir="$1"

  if is_in_path "${dir}"; then
    log_debug "${dir} is already in PATH"
    return 0
  fi

  local -r rc_file="$(detect_shell_rc)"

  printf '\n'
  log_warn "${dir} is not in your PATH."
  log_info "Add this line to ${rc_file}:"
  printf '  export PATH="%s:\$PATH"\n' "${dir}"
  printf '\n'
  log_info "Then reload: source ${rc_file}"
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  # Need curl or wget
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    die "Neither curl nor wget found. Install one to proceed."
  fi

  local -r dest="${INSTALL_DIR}/zclaude"

  log_info "Installing zclaude to ${dest}"

  # Create install dir if needed
  if [[ ! -d "${INSTALL_DIR}" ]]; then
    run_cmd _mkdir -p "${INSTALL_DIR}"
    log_info "Created ${INSTALL_DIR}"
  fi

  # Download
  download_tool "${dest}"

  # Make executable
  run_cmd _chmod +x "${dest}"

  # Verify
  if [[ "${DRY_RUN}" != "true" ]]; then
    if [[ -x "${dest}" ]]; then
      local version
      version="$("${dest}" --version 2>/dev/null || echo "unknown")"
      log_info "Installed: ${version}"
    else
      log_fatal "Failed to make ${dest} executable"
    fi
  fi

  # PATH check
  offer_path_setup "${INSTALL_DIR}"

  printf '\n'
  if is_in_path "${INSTALL_DIR}"; then
    log_info "Done. Run 'zclaude' to get started."
  else
    log_info "Done. After adding ${INSTALL_DIR} to PATH, run 'zclaude' to get started."
  fi
}

# Testable main guard (${BASH_SOURCE[0]:-} handles curl|bash where BASH_SOURCE is unset)
if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
