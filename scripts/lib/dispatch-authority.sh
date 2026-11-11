#!/usr/bin/env bash
# dispatch-authority.sh — CLI-independent dispatch authority read for the bash
# fallback stack.
#
# The derived authority document is read as a plain file with shell built-ins;
# no typed CLI, PATH lookup, network, or model call participates. The document
# lives under the checkout's per-repository state root
# (`<host root>/projects/<project key>/documents.<workspace>/`), so the resolver
# resolves that root first and keeps its unchanged `-maxdepth 2` search. An
# absent project root, an unreadable, or a malformed document means dual-run, so
# a missing typed installation can never break the fallback.
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

# The HOST state root: the environment override wins, then the repository-local
# default, then the home default. Precedence is unchanged by the per-repository
# layout; only the root the documents live under moved one level deeper.
_dispatch_authority_host_root() {
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

# The checkout's git COMMON directory: a normal `.git` directory, or a linked
# worktree's `.git` file plus its `commondir`. Empty when ROOT_DIR is not a
# checkout.
_dispatch_authority_common_dir() {
  local checkout="${ROOT_DIR:-}"
  [[ -n "${checkout}" ]] || return 0
  local dot_git="${checkout}/.git"
  local git_dir=""
  if [[ -d "${dot_git}" ]]; then
    printf '%s\n' "${dot_git}"
    return 0
  fi
  if [[ -f "${dot_git}" ]]; then
    git_dir="$(sed -n 's/^gitdir:[[:space:]]*\(.\{1,\}\)$/\1/p' "${dot_git}" 2>/dev/null | head -n 1)"
    [[ -n "${git_dir}" ]] || return 0
    [[ "${git_dir}" = /* ]] || git_dir="${checkout}/${git_dir}"
    if [[ -f "${git_dir}/commondir" ]]; then
      local common=""
      common="$(head -n 1 "${git_dir}/commondir" 2>/dev/null || true)"
      if [[ -n "${common}" ]]; then
        [[ "${common}" = /* ]] || common="${git_dir}/${common}"
        printf '%s\n' "${common}"
        return 0
      fi
    fi
    printf '%s\n' "${git_dir}"
  fi
  return 0
}

# The project state root: `<host root>/projects/<project key>`, where the key is
# read from the checkout identity marker in the git common directory. Nothing is
# derived from a path or a remote, and no marker is created or repaired here.
_dispatch_authority_project_root() {
  local -r host_root="$1"
  local common_dir=""
  common_dir="$(_dispatch_authority_common_dir)"
  [[ -n "${common_dir}" ]] || return 0
  local marker="${common_dir}/project-identity.json"
  [[ -f "${marker}" && -r "${marker}" ]] || return 0
  local project_key=""
  project_key="$(sed -n 's/.*"projectKey"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${marker}" 2>/dev/null | head -n 1)"
  [[ -n "${project_key}" ]] || return 0
  [[ "${project_key}" != */* ]] || return 0
  printf '%s/projects/%s\n' "${host_root}" "${project_key}"
}

# The state root the derived documents live under: the resolved project root.
# An unresolved project root yields the host root, which then holds no matching
# document, so the read stays dual-run exactly as before.
_dispatch_authority_state_root() {
  local host_root=""
  host_root="$(_dispatch_authority_host_root)"
  local project_root=""
  project_root="$(_dispatch_authority_project_root "${host_root}")"
  if [[ -n "${project_root}" ]]; then
    printf '%s\n' "${project_root}"
    return 0
  fi
  printf '%s\n' "${host_root}"
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
