#!/usr/bin/env bash
# dispatch-authority.sh — CLI-independent dispatch authority read for the bash
# fallback stack.
#
# The derived authority document is read as a plain file with shell built-ins;
# no typed CLI, PATH lookup, network, or model call participates. An absent,
# unreadable, or malformed document means dual-run, so a missing typed
# installation can never break the fallback.
#
# Sourced by deliver-ticket.sh, batch-deliver.sh, pm-liveness.sh, and ceo-loop.sh.
# Public functions:
#   dispatch_authority_repository  -> normalized host/owner/name (or empty)
#   dispatch_authority_state       -> "dual-run" or "authoritative"
#   dispatch_authority_announce    -> prints the deprecation pointer on stderr

readonly DISPATCH_AUTHORITY_SCHEMA_ID="delivery.dispatch.authority.v1"

# Normalize a Git remote URL to host/owner/name without touching the network.
dispatch_authority_repository() {
  local repository="${DISPATCH_REPOSITORY:-}"
  if [[ -n "${repository}" ]]; then
    printf '%s\n' "${repository}"
    return 0
  fi
  local url=""
  if command -v git >/dev/null 2>&1; then
    url="$(git -C "${ROOT_DIR:-.}" remote get-url origin 2>/dev/null || true)"
  fi
  if [[ -z "${url}" ]]; then
    return 0
  fi
  url="${url%.git}"
  if [[ "${url}" =~ ^[A-Za-z][A-Za-z0-9+.-]*://([^/]+)/(.+)$ ]]; then
    local host="${BASH_REMATCH[1]}"
    host="${host#*@}"
    host="${host%%:*}"
    local path="${BASH_REMATCH[2]}"
    if [[ "${path}" == */* ]]; then
      printf '%s/%s\n' "${host,,}" "${path}"
    fi
    return 0
  fi
  if [[ "${url}" =~ ^([^@/]+@)?([^:/]+):(.+/.+)$ ]]; then
    local host="${BASH_REMATCH[2]}"
    local path="${BASH_REMATCH[3]}"
    printf '%s/%s\n' "${host,,}" "${path}"
  fi
  return 0
}

# The state root the derived documents live under.
_dispatch_authority_state_root() {
  if [[ -n "${ADOS_DISPATCH_STATE_ROOT:-}" ]]; then
    printf '%s\n' "${ADOS_DISPATCH_STATE_ROOT}"
    return 0
  fi
  if [[ -n "${ROOT_DIR:-}" && -d "${ROOT_DIR}/.ai/local/state" ]]; then
    printf '%s\n' "${ROOT_DIR}/.ai/local/state"
    return 0
  fi
  printf '%s\n' "${HOME:-/nonexistent}/.delivery-os"
}

# Parse one authority document with a strict, fail-safe reader.
_dispatch_authority_parse() {
  local -r document="$1"
  local -r repository="$2"
  [[ -f "${document}" && -r "${document}" ]] || return 1
  local text=""
  text="$(cat -- "${document}" 2>/dev/null || true)"
  [[ -n "${text}" ]] || return 1
  [[ "${text}" == *"\"schema\""*"${DISPATCH_AUTHORITY_SCHEMA_ID}"* ]] || return 1
  [[ "${text}" == *"\"repository\""*"${repository}"* ]] || return 1
  if [[ "${text}" == *"\"authority\""*"authoritative"* ]]; then
    printf 'authoritative\n'
    return 0
  fi
  if [[ "${text}" == *"\"authority\""*"dual-run"* ]]; then
    printf 'dual-run\n'
    return 0
  fi
  return 1
}

# Read the authority state for the resolved repository; any failure is dual-run.
dispatch_authority_state() {
  local repository=""
  repository="$(dispatch_authority_repository 2>/dev/null || true)"
  repository="${repository%$'\n'}"
  if [[ -z "${repository}" ]]; then
    printf 'dual-run\n'
    return 0
  fi
  local state_root=""
  state_root="$(_dispatch_authority_state_root)"
  [[ -d "${state_root}" ]] || {
    printf 'dual-run\n'
    return 0
  }
  local document=""
  local parsed=""
  while IFS= read -r document; do
    parsed="$(_dispatch_authority_parse "${document}" "${repository}" 2>/dev/null || true)"
    if [[ -n "${parsed}" ]]; then
      printf '%s\n' "${parsed}"
      return 0
    fi
  done < <(find "${state_root}" -maxdepth 2 -type f -name 'dispatch-authority.json' 2>/dev/null | sort)
  printf 'dual-run\n'
}

# Print the bounded deprecation pointer only when the repository is authoritative.
dispatch_authority_announce() {
  local state=""
  state="$(dispatch_authority_state 2>/dev/null || true)"
  state="${state%$'\n'}"
  if [[ "${state}" != "authoritative" ]]; then
    return 0
  fi
  local repository=""
  repository="$(dispatch_authority_repository 2>/dev/null || true)"
  repository="${repository%$'\n'}"
  printf '[deprecation] %s is engine-authoritative: prefer `dispatch <ref>` and reverse with `dispatch handover %s --revert`.\n' \
    "${repository:-this repository}" "${repository:-<repo>}" >&2
  return 0
}
