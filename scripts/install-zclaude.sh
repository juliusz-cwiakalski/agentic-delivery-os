#!/usr/bin/env bash
# install-zclaude.sh — Install zclaude to ~/.local/bin/ for system-wide use
#
# Dependencies: bash>=3.2, curl or wget
# Usage: curl -fsSL <url> | bash
#        wget -qO- <url> | bash
#        ./install-zclaude.sh
#
# Environment:
#   ZCLAUDE_INSTALL_DIR  - Override install directory (default: ~/.local/bin)
#   ZCLAUDE_SKIP_CLAUDE_INSTALL - Set to 'true' to skip Claude Code install offer
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
readonly CLAUDE_INSTALL_URL="https://claude.ai/install.sh"
readonly CLAUDE_INSTALL_PS_URL="https://claude.ai/install.ps1"
readonly CLAUDE_INSTALL_CMD_URL="https://claude.ai/install.cmd"

DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
INSTALL_DIR="${ZCLAUDE_INSTALL_DIR:-}"

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

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ask_yes_no() {
  local -r prompt="$1"
  local -r default="${2:-N}"
  local answer=""
  local suffix="[y/N]"

  [[ "${default}" == "Y" ]] && suffix="[Y/n]"

  if ! { printf '%s %s ' "${prompt}" "${suffix}" > /dev/tty && read -r answer < /dev/tty; } 2>/dev/null; then
    log_warn "No interactive terminal available; assuming N."
    return 1
  fi

  case "${answer}" in
    [Yy]|[Yy][Ee][Ss]) return 0 ;;
    [Nn]|[Nn][Oo]) return 1 ;;
    "") [[ "${default}" == "Y" ]] ;;
    *) return 1 ;;
  esac
}

run_cmd() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf '[INFO]  %s [DRY-RUN] Would execute:' "${LOG_TAG}"
    printf ' %q' "$@"
    printf '\n'
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
_mv() { command mv "$@"; }
_rm() { command rm "$@"; }
_mktemp() { command mktemp "$@"; }

# ============================================================================
# PLATFORM / DEPENDENCIES
# ============================================================================
detect_platform() {
  local kernel
  kernel="$(uname -s 2>/dev/null || printf 'unknown')"

  case "${kernel}" in
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        printf 'wsl'
      else
        printf 'linux'
      fi
      ;;
    Darwin) printf 'macos' ;;
    MINGW*|MSYS*|CYGWIN*) printf 'gitbash' ;;
    *) printf 'unsupported' ;;
  esac
}

print_claude_install_instructions() {
  local -r platform="${1:-$(detect_platform)}"

  case "${platform}" in
    linux|macos|wsl)
      log_info "Manual Claude Code install:"
      printf '  curl -fsSL %s | bash\n' "${CLAUDE_INSTALL_URL}"
      ;;
    gitbash)
      log_info "Manual Claude Code install for Windows:"
      printf '  PowerShell: irm %s | iex\n' "${CLAUDE_INSTALL_PS_URL}"
      printf '  CMD:        curl -fsSL %s -o install.cmd && install.cmd && del install.cmd\n' "${CLAUDE_INSTALL_CMD_URL}"
      ;;
    *)
      log_info "See official setup docs: https://code.claude.com/docs/en/setup"
      ;;
  esac
}

refresh_path_for_local_bin() {
  local -r local_bin="${HOME}/.local/bin"
  if [[ -d "${local_bin}" ]] && ! is_in_path "${local_bin}"; then
    export PATH="${local_bin}:${PATH}"
    log_debug "Temporarily added ${local_bin} to PATH for this installer run"
  fi
}

install_claude_unix() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would install Claude Code via official native installer: ${CLAUDE_INSTALL_URL}"
    return 0
  fi

  log_info "Installing Claude Code via official native installer..."
  if command_exists curl; then
    _curl -fsSL "${CLAUDE_INSTALL_URL}" | bash
  elif command_exists wget; then
    command wget -qO- "${CLAUDE_INSTALL_URL}" | bash
  else
    die "Neither curl nor wget found. Install one to proceed."
  fi
}

install_claude_windows_from_gitbash() {
  if command_exists powershell.exe; then
    if [[ "${DRY_RUN}" == "true" ]]; then
      log_info "[DRY-RUN] Would run PowerShell installer: irm ${CLAUDE_INSTALL_PS_URL} | iex"
      return 0
    fi
    log_info "Installing Claude Code via official PowerShell installer..."
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "irm ${CLAUDE_INSTALL_PS_URL} | iex"
  else
    log_warn "PowerShell is not available from this Git Bash session."
    print_claude_install_instructions gitbash
    return 1
  fi
}

ensure_claude_available() {
  local platform
  platform="$(detect_platform)"

  if command_exists claude; then
    local version
    version="$(claude --version 2>/dev/null | head -1 || printf 'installed')"
    log_info "Claude Code found: ${version}"
    return 0
  fi

  if [[ "${ZCLAUDE_SKIP_CLAUDE_INSTALL:-false}" == "true" ]]; then
    log_warn "Claude Code CLI is not installed; skipping install offer because ZCLAUDE_SKIP_CLAUDE_INSTALL=true."
    print_claude_install_instructions "${platform}"
    return 1
  fi

  log_warn "Claude Code CLI ('claude') is not installed or not in PATH."
  print_claude_install_instructions "${platform}"

  if ! ask_yes_no "Install Claude Code now using the official installer?" "Y"; then
    log_warn "Skipping Claude Code install. zclaude will be installed, but it needs 'claude' to run."
    return 1
  fi

  case "${platform}" in
    linux|macos|wsl) install_claude_unix ;;
    gitbash) install_claude_windows_from_gitbash ;;
    *)
      log_warn "Unsupported platform for automatic Claude Code install: $(uname -s 2>/dev/null || printf 'unknown')"
      return 1
      ;;
  esac

  refresh_path_for_local_bin

  if command_exists claude; then
    local version
    version="$(claude --version 2>/dev/null | head -1 || printf 'installed')"
    log_info "Claude Code installed: ${version}"
    return 0
  fi

  log_warn "Claude Code installer finished, but 'claude' is still not in PATH."
  log_warn "Open a new terminal or add ~/.local/bin to PATH, then run: claude --version"
  return 1
}

# ============================================================================
# DOWNLOAD
# ============================================================================
download_tool() {
  local -r dest="$1"
  local -r url="${ZCLAUDE_RAW_URL}"
  local tmp=""

  if [[ "${DRY_RUN}" != "true" ]]; then
    tmp="$(_mktemp "${dest}.tmp.XXXXXX")"
  else
    tmp="${dest}.tmp.DRY_RUN"
  fi

  if command -v curl >/dev/null 2>&1; then
    log_debug "Using curl to download"
    if ! run_cmd _curl -fsSL "${url}" -o "${tmp}"; then
      [[ "${DRY_RUN}" == "true" ]] || _rm -f "${tmp}"
      return "${EXIT_EXTERNAL}"
    fi
  elif command -v wget >/dev/null 2>&1; then
    log_debug "Using wget to download"
    if ! run_cmd command wget -qO "${tmp}" "${url}"; then
      [[ "${DRY_RUN}" == "true" ]] || _rm -f "${tmp}"
      return "${EXIT_EXTERNAL}"
    fi
  else
    die "Neither curl nor wget found. Install one to proceed."
  fi

  run_cmd _chmod +x "${tmp}"
  run_cmd _mv "${tmp}" "${dest}"
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
  norm_path=":${PATH:-}:"
  [[ "${norm_path}" == *":${norm_dir}:"* ]]
}

choose_install_dir() {
  if [[ -n "${ZCLAUDE_INSTALL_DIR:-}" ]]; then
    printf '%s' "${ZCLAUDE_INSTALL_DIR}"
    return 0
  fi

  local -r local_bin="${HOME}/.local/bin"
  local -r home_bin="${HOME}/bin"

  if is_in_path "${local_bin}"; then
    printf '%s' "${local_bin}"
    return 0
  fi

  if is_in_path "${home_bin}"; then
    printf '%s' "${home_bin}"
    return 0
  fi

  local path_entry=""
  local old_ifs="${IFS}"
  IFS=':'
  for path_entry in ${PATH:-}; do
    IFS="${old_ifs}"
    [[ -n "${path_entry}" ]] || continue
    if [[ -d "${path_entry}" && -w "${path_entry}" && "${path_entry}" == "${HOME}"* ]]; then
      printf '%s' "${path_entry%/}"
      return 0
    fi
    IFS=':'
  done
  IFS="${old_ifs}"

  # Fallback: user-local location that is easy to add to PATH.
  printf '%s' "${local_bin}"
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

  if ask_yes_no "Add this PATH line to ${rc_file} now?" "N"; then
    if [[ "${DRY_RUN}" == "true" ]]; then
      log_info "[DRY-RUN] Would append PATH update to ${rc_file}"
    else
      mkdir -p "$(dirname "${rc_file}")"
      # Idempotent: skip if we already added this exact dir previously.
      local -r marker="# Added by install-zclaude.sh (${dir})"
      if [[ -f "${rc_file}" ]] && grep -qF "${marker}" "${rc_file}" 2>/dev/null; then
        log_info "${rc_file} already contains a PATH entry for ${dir}; skipping"
      else
        printf '\n%s\nexport PATH="%s:$PATH"\n' "${marker}" "${dir}" >> "${rc_file}"
        log_info "Updated ${rc_file}"
      fi
    fi
  fi

  log_info "For this terminal, run: export PATH=\"${dir}:\$PATH\""
  log_info "For future terminals, reload: source ${rc_file}"
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  # Need curl or wget
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    die "Neither curl nor wget found. Install one to proceed."
  fi

  INSTALL_DIR="$(choose_install_dir)"
  log_info "Install directory: ${INSTALL_DIR}"

  # Claude Code is required at runtime. Offer official install if missing,
  # but continue installing zclaude even if the user chooses to install Claude later.
  ensure_claude_available || true

  local -r dest="${INSTALL_DIR}/zclaude"

  log_info "Installing zclaude to ${dest}"

  # Create install dir if needed
  if [[ ! -d "${INSTALL_DIR}" ]]; then
    run_cmd _mkdir -p "${INSTALL_DIR}"
    log_info "Created ${INSTALL_DIR}"
  fi

  # Download
  download_tool "${dest}"

  # Verify
  if [[ "${DRY_RUN}" != "true" ]]; then
    if [[ -x "${dest}" ]]; then
      local version
      version="$("${dest}" --version 2>/dev/null | head -2 | tr '\n' '; ' || echo "unknown")"
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
