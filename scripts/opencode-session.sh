#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/scripts/opencode-session.sh
# opencode-session.sh — ticket-scoped OpenCode session manager for ADOS.
#
# Starts or resumes an OpenCode session mapped to one work item (GH-123, PDEV-51,
# etc.). Session mappings live under .ai/local/ so branch switches/merges do not
# commit session state.
#
# Usage:
#   scripts/opencode-session.sh GH-12                         # start/resume ticket
#   scripts/opencode-session.sh --agent pm run GH-12 "msg"    # explicit agent + message
#   scripts/opencode-session.sh list                          # list mappings
#   scripts/opencode-session.sh show GH-12                    # show one mapping
#   scripts/opencode-session.sh forget GH-12                  # delete mapping
#   scripts/opencode-session.sh list-sessions                 # list OpenCode sessions
#
# Requires an OpenCode CLI that supports:
#   opencode run --session <id>
#   opencode run --format json --agent <name> --title <title> <message>
#   opencode session list --format json [--max-count N]

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

readonly APP_NAME="opencode-session"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

readonly EXIT_USAGE=2

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
readonly SCRIPT_DIR
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd -P)"
readonly ROOT_DIR

readonly OPENCODE_KEYS_ENV="${OPENCODE_KEYS_ENV:-${HOME}/.ai/opencode-keys-env.sh}"
readonly SESSION_DIR="${OPENCODE_SESSION_DIR:-${ROOT_DIR}/.ai/local/opencode-sessions}"
readonly TMP_ROOT="${OPENCODE_TMP_ROOT:-${ROOT_DIR}/tmp/opencode}"
readonly PREPARE_MAIN_FOR_NEW_SESSION="${OPENCODE_PREPARE_MAIN_FOR_NEW_SESSION:-true}"

DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
TICKET_AGENT="${OPENCODE_TICKET_AGENT:-pm}"

log_info() { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*"; }
log_warn() { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_err() { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*" >&2 || true; }
die() { log_err "$@"; exit "${EXIT_USAGE}"; }

on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

unset_opencode_env() {
  [[ "${_OPENCODE_ENV_SOURCED:-false}" == "true" ]] || return 0
  [[ -f "${OPENCODE_KEYS_ENV}" ]] || return 0

  local line var_name
  while IFS= read -r line; do
    if [[ "${line}" =~ ^[[:space:]]*export[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)= ]]; then
      var_name="${BASH_REMATCH[1]}"
      unset "${var_name}" 2>/dev/null || true
    fi
  done <"${OPENCODE_KEYS_ENV}"
}

trap 'on_err $LINENO "$BASH_COMMAND" $?' ERR
trap unset_opencode_env EXIT
trap 'log_warn "Interrupted"; exit 130' INT TERM

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

opencode_cli() { command opencode "$@"; }
jq_cli() { command jq "$@"; }

probe_opencode_cli() {
  local run_help session_help
  run_help="$(opencode_cli run --help 2>&1 || true)"
  session_help="$(opencode_cli session list --help 2>&1 || true)"

  [[ "${run_help}" == *"--session"* ]] || die "OpenCode CLI does not advertise 'run --session'; update opencode or adjust ${APP_NAME}."
  [[ "${run_help}" == *"--format"* ]] || die "OpenCode CLI does not advertise 'run --format'; update opencode or adjust ${APP_NAME}."
  [[ "${run_help}" == *"--agent"* ]] || die "OpenCode CLI does not advertise 'run --agent'; update opencode or adjust ${APP_NAME}."
  [[ "${session_help}" == *"--format"* ]] || die "OpenCode CLI does not advertise 'session list --format'; update opencode or adjust ${APP_NAME}."
}

source_opencode_env() {
  if [[ -f "${OPENCODE_KEYS_ENV}" ]]; then
    log_debug "Sourcing ${OPENCODE_KEYS_ENV}"
    # shellcheck source=/dev/null
    source "${OPENCODE_KEYS_ENV}"
    unset OPENCODE_SERVER_USERNAME 2>/dev/null || true
    unset OPENCODE_SERVER_PASSWORD 2>/dev/null || true
    _OPENCODE_ENV_SOURCED=true
  else
    log_warn "OpenCode keys env file not found: ${OPENCODE_KEYS_ENV}"
    _OPENCODE_ENV_SOURCED=false
  fi
}

ensure_dirs() {
  mkdir -p "${SESSION_DIR}" "${TMP_ROOT}"
}

validate_repo() {
  [[ -d "${ROOT_DIR}/.git" ]] || die "Not a git repository: ${ROOT_DIR}"
}

validate_ticket_ref() {
  local -r ticket_ref="$1"
  [[ "${ticket_ref}" =~ ^[A-Z]+-[0-9]+$ ]] || die "Invalid ticket reference '${ticket_ref}'. Expected PREFIX-NUMBER, e.g. GH-12."
}

working_tree_dirty() {
  [[ -n "$(git -C "${ROOT_DIR}" status --porcelain 2>/dev/null)" ]]
}

delete_safe_merged_branches() {
  local branch
  while IFS= read -r branch; do
    [[ -n "${branch}" ]] || continue
    case "${branch}" in
      main|master) continue ;;
    esac
    git -C "${ROOT_DIR}" branch -d "${branch}" >/dev/null 2>&1 || true
  done < <(git -C "${ROOT_DIR}" branch --merged main --format='%(refname:short)' 2>/dev/null)
}

prepare_main_for_new_session() {
  [[ "${PREPARE_MAIN_FOR_NEW_SESSION}" == "true" ]] || return 0

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would fetch/prune, require clean tree, delete merged branches, checkout main, pull --ff-only"
    return 0
  fi

  git -C "${ROOT_DIR}" fetch --prune origin

  if working_tree_dirty; then
    die "Working tree has uncommitted changes. Finalize/commit/PR/merge or stash existing work before starting a new ticket session."
  fi

  git -C "${ROOT_DIR}" checkout main
  git -C "${ROOT_DIR}" pull --ff-only origin main
  delete_safe_merged_branches
}

mapping_file_for() {
  local -r ticket_ref="$1"
  printf '%s/%s.json' "${SESSION_DIR}" "${ticket_ref}"
}

lookup_session() {
  local -r ticket_ref="$1"
  local mapping_file
  mapping_file="$(mapping_file_for "${ticket_ref}")"
  [[ -f "${mapping_file}" ]] || return 0
  jq_cli -r '.session_id // empty' "${mapping_file}" 2>/dev/null || true
}

verify_session_exists() {
  local -r session_id="$1"
  local sessions_json
  sessions_json="$(cd "${ROOT_DIR}" && opencode_cli session list --format json 2>/dev/null)" || return 1
  jq_cli -e --arg id "${session_id}" '.[] | select(.id == $id)' <<<"${sessions_json}" >/dev/null 2>&1
}

find_session_by_title() {
  local -r title="$1"
  local sessions_json
  sessions_json="$(cd "${ROOT_DIR}" && opencode_cli session list --format json 2>/dev/null)" || return 0
  jq_cli -r --arg title "${title}" '[.[] | select(.title == $title)] | .[0].id // empty' <<<"${sessions_json}" 2>/dev/null || true
}

extract_session_id() {
  local -r raw_output="$1"
  local first=""
  first="$(jq_cli -r 'select(.sessionID != null) | .sessionID' <<<"${raw_output}" 2>/dev/null | { IFS= read -r line || true; printf '%s' "${line:-}"; })" || true
  printf '%s' "${first}"
}

latest_session_id() {
  local sessions_json
  sessions_json="$(cd "${ROOT_DIR}" && opencode_cli session list --format json --max-count 1 2>/dev/null)" || return 0
  jq_cli -r '.[0].id // empty' <<<"${sessions_json}" 2>/dev/null || true
}

save_mapping() {
  local -r ticket_ref="$1" session_id="$2" action="$3"
  local branch="${4:-}"
  local status="${5:-}"
  local mapping_file
  mapping_file="$(mapping_file_for "${ticket_ref}")"
  local timestamp title
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  title="ticket-${ticket_ref}"
  local tmp_file="" created="" restart_count="0"

  # Preserve fields from existing mapping (backward-compatible)
  if [[ -f "${mapping_file}" ]]; then
    created="$(jq_cli -r '.created // empty' "${mapping_file}" 2>/dev/null || true)"
    restart_count="$(jq_cli -r '.restart_count // 0' "${mapping_file}" 2>/dev/null || true)"
    [[ -z "${branch}" ]] && branch="$(jq_cli -r '.branch // empty' "${mapping_file}" 2>/dev/null || true)"
    [[ -z "${status}" ]] && status="$(jq_cli -r '.status // empty' "${mapping_file}" 2>/dev/null || true)"
  fi
  [[ -n "${created}" ]] || created="${timestamp}"
  restart_count="${restart_count:-0}"

  # Build nullable JSON values for branch/status
  local branch_json="null" status_json="null"
  [[ -n "${branch}" ]] && branch_json="\"${branch}\""
  [[ -n "${status}" ]] && status_json="\"${status}\""

  tmp_file="$(mktemp)"
  jq_cli -n \
    --arg ticket "${ticket_ref}" \
    --arg session_id "${session_id}" \
    --arg agent "${TICKET_AGENT}" \
    --arg repo_path "${ROOT_DIR}" \
    --arg action "${action}" \
    --arg timestamp "${timestamp}" \
    --arg created "${created}" \
    --arg title "${title}" \
    --argjson branch "${branch_json}" \
    --argjson status "${status_json}" \
    --argjson restart_count "${restart_count}" \
    '{ticket:$ticket,session_id:$session_id,agent:$agent,repo_path:$repo_path,last_action:$action,updated:$timestamp,created:$created,title:$title,branch:$branch,status:$status,restart_count:$restart_count}' \
    >"${tmp_file}"
  mv "${tmp_file}" "${mapping_file}"
}

touch_mapping() {
  local -r ticket_ref="$1" action="$2"
  local mapping_file
  mapping_file="$(mapping_file_for "${ticket_ref}")"
  [[ -f "${mapping_file}" ]] || return 0
  local tmp_file timestamp
  tmp_file="$(mktemp)"
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq_cli --arg updated "${timestamp}" --arg action "${action}" '.updated = $updated | .last_action = $action' "${mapping_file}" >"${tmp_file}"
  mv "${tmp_file}" "${mapping_file}"
}

default_prompt_for() {
  local -r ticket_ref="$1"
  cat <<EOF
Deliver ${ticket_ref} end-to-end using ADOS.

Resume existing work for ${ticket_ref} if present. Deliver exactly this one workItemRef and no other ticket in this session.

Follow ticket -> PR -> squash merge to main discipline. Before new implementation, refresh latest main and ensure no stale PR/ticket/branch should be finished or closed first. Prefer finalizing pending branches/PRs over starting fresh work.

Run the full ADOS 11-phase lifecycle as @pm: clarify scope, specification, test planning, delivery planning, DoR, implementation, docs sync, review/fix, quality gates, DoD, PR/finalization. Delegate to the specialized subagents; do not implement source code directly as PM.

At intake, set `delivery_mode: autonomous` in chg-<workItemRef>-pm-notes.yaml so the phase-7 spec-coverage resolution resolves detected gaps in-change.

CREATE THE PR AND LEAVE IT OPEN. Do NOT merge it. Do NOT run \`gh pr merge\`, \`gh pr merge --squash\`, \`gh pr ready\`, or any other merge/approve/ready-for-review action. The human performs the final review and squash-merge as a separate gate, outside this PM session. When the PR is open, CI (if any) is green, and you have recorded the PR URL in .ai/local/pm-context.yaml, report the PR URL and STOP.

Do not select, plan, or start a next ticket in this PM session. If ${ticket_ref} becomes technically blocked (missing credentials/access/tooling that cannot be worked around), record the blocker in pm-context.yaml and STOP.
EOF
}

run_ticket_session() {
  local -r ticket_ref="$1"
  shift || true
  local message="$*"
  [[ -n "${message}" ]] || message="$(default_prompt_for "${ticket_ref}")"

  validate_ticket_ref "${ticket_ref}"
  validate_repo
  ensure_dirs
  source_opencode_env

  export TMPDIR="${TMP_ROOT}"
  export OPENCODE_DISABLE_CLAUDE_CODE="${OPENCODE_DISABLE_CLAUDE_CODE:-1}"

  cd "${ROOT_DIR}"

  local session_id action raw_output exit_code captured_id title branch
  title="ticket-${ticket_ref}"
  branch="$(git -C "${ROOT_DIR}" symbolic-ref --short HEAD 2>/dev/null || true)"

  # Session resolution: mapping → title-based lookup → create new
  session_id="$(lookup_session "${ticket_ref}")"
  action="create"
  if [[ -n "${session_id}" ]] && verify_session_exists "${session_id}"; then
    action="resume"
    log_debug "Session found in mapping and alive: ${session_id}"
  else
    log_debug "Mapping session stale or missing; trying title-based lookup"
    local title_session
    title_session="$(find_session_by_title "${title}")"
    if [[ -n "${title_session}" ]]; then
      session_id="${title_session}"
      action="resume"
      log_info "Found existing session by title '${title}': ${session_id}"
    else
      session_id=""
    fi
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    if [[ "${action}" == "resume" ]]; then
      log_info "[DRY-RUN] opencode run --session ${session_id} <message>"
    else
      prepare_main_for_new_session
      log_info "[DRY-RUN] opencode run --agent ${TICKET_AGENT} --title ${title} <message>"
      save_mapping "${ticket_ref}" "ses_dry_run_${ticket_ref}" "dry-run-create" "${branch}" "pending"
    fi
    return 0
  fi

  if [[ "${action}" == "resume" ]]; then
    log_info "Resuming ${ticket_ref} session ${session_id}"
    save_mapping "${ticket_ref}" "${session_id}" "resume" "${branch}" "in_progress"
    opencode_cli run --session "${session_id}" "${message}" || return $?
    return 0
  fi

  prepare_main_for_new_session

  # Write pending mapping before starting session
  save_mapping "${ticket_ref}" "" "pending-create" "${branch}" "pending"
  log_info "Wrote pending mapping for ${ticket_ref}"

  log_info "Creating ${ticket_ref} session with agent=${TICKET_AGENT}"
  raw_output=""
  exit_code=0
  raw_output="$(opencode_cli run --format json --agent "${TICKET_AGENT}" --title "${title}" "${message}" 2>&1)" || exit_code=$?
  printf '%s\n' "${raw_output}"

  captured_id="$(extract_session_id "${raw_output}")"
  [[ -n "${captured_id}" ]] || captured_id="$(latest_session_id)"

  if [[ -n "${captured_id}" ]]; then
    save_mapping "${ticket_ref}" "${captured_id}" "create" "${branch}" "in_progress"
    log_info "Saved mapping ${ticket_ref} -> ${captured_id}"
  else
    log_warn "Could not capture session id for ${ticket_ref}"
  fi

  return "${exit_code}"
}

cmd_list() {
  ensure_dirs
  local found=0 file
  for file in "${SESSION_DIR}"/*.json; do
    [[ -f "${file}" ]] || continue
    found=1
    jq_cli -r '"\(.ticket)  \(.agent)  \(.session_id)  \(.updated)"' "${file}" 2>/dev/null || true
  done
  [[ "${found}" -eq 1 ]] || log_info "No mappings in ${SESSION_DIR}"
}

cmd_show() {
  local -r ticket_ref="$1"
  validate_ticket_ref "${ticket_ref}"
  local file
  file="$(mapping_file_for "${ticket_ref}")"
  [[ -f "${file}" ]] || { log_info "No mapping for ${ticket_ref}"; return 0; }
  jq_cli '.' "${file}"
}

cmd_forget() {
  local -r ticket_ref="$1"
  validate_ticket_ref "${ticket_ref}"
  rm -f "$(mapping_file_for "${ticket_ref}")"
  log_info "Forgot mapping for ${ticket_ref}"
}

usage() {
  cat <<EOF
Usage: ${APP_NAME} [options] <command> [args]

Commands:
  run <ticket> [message..]       Start/resume ticket session (default command)
  list                           List ticket session mappings
  show <ticket>                  Show one mapping
  forget <ticket>                Delete one mapping (does not delete OpenCode session)
  list-sessions                  List OpenCode sessions for this repo

Options:
  --agent <name>                 Agent for new sessions (default: ${TICKET_AGENT})
  -n, --dry-run                  Print actions without running OpenCode
  -v, --verbose                  Debug logs
  -h, --help                     Show help
  -V, --version                  Show version

Environment:
  OPENCODE_TICKET_AGENT          Default agent for new ticket sessions (default: pm)
  OPENCODE_SESSION_DIR           Mapping dir (default: .ai/local/opencode-sessions)
  OPENCODE_KEYS_ENV              Keys env file (default: ~/.ai/opencode-keys-env.sh)
  OPENCODE_PREPARE_MAIN_FOR_NEW_SESSION
                             true/false; for new sessions, clean merged branches and refresh main (default: true)
  DRY_RUN=true                   Dry-run mode

Examples:
  scripts/opencode-session.sh GH-12
  scripts/opencode-session.sh --agent pm run GH-12 "Continue delivery"
  scripts/opencode-session.sh list
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
      -n|--dry-run) DRY_RUN=true; shift ;;
      -v|--verbose) VERBOSE=true; shift ;;
      --agent) [[ $# -ge 2 ]] || die "--agent requires a value"; TICKET_AGENT="$2"; shift 2 ;;
      --) shift; break ;;
      -*) die "Unknown option: $1" ;;
      *) break ;;
    esac
  done

  [[ $# -ge 1 ]] || die "Missing command or ticket. See --help."
  local cmd="$1"
  shift || true

  case "${cmd}" in
    run) [[ $# -ge 1 ]] || die "run requires <ticket>"; local ticket="$1"; shift; run_ticket_session "${ticket}" "$@" ;;
    list) cmd_list ;;
    show) [[ $# -eq 1 ]] || die "show requires <ticket>"; cmd_show "$1" ;;
    forget) [[ $# -eq 1 ]] || die "forget requires <ticket>"; cmd_forget "$1" ;;
    list-sessions) cd "${ROOT_DIR}" && opencode_cli session list ;;
    *) run_ticket_session "${cmd}" "$@" ;;
  esac
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi
  if [[ "${1:-}" == "-V" || "${1:-}" == "--version" ]]; then
    printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"
    exit 0
  fi
  require_cmd opencode
  require_cmd jq
  probe_opencode_cli
  parse_args "$@"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
