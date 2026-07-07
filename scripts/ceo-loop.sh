#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# ceo-loop.sh — run @ceo in a restartable OpenCode loop.
#
# Linux-oriented. The loop restarts the CEO OpenCode session when no progress is
# observed for a configured stuck window. CEO state stays in
# .ai/local/ceo-context.yaml and .ai/local/ceo/** so each restart can resume from
# local working memory.
#
# Usage:
#   scripts/ceo-loop.sh                          # run forever (until stopped)
#   CEO_LOOP_MAX_ITERATIONS=5 scripts/ceo-loop.sh  # max 5 CEO iterations
#   CEO_LOOP_STUCK_MINUTES=20 scripts/ceo-loop.sh  # custom stuck threshold

set -Eeuo pipefail
IFS=$'\n\t'

readonly TAG="(ceo-loop)"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
readonly ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd -P)"

readonly STUCK_MINUTES="${CEO_LOOP_STUCK_MINUTES:-30}"
readonly POLL_SECONDS="${CEO_LOOP_POLL_SECONDS:-60}"
readonly LOOP_SLEEP_SECONDS="${CEO_LOOP_SLEEP_SECONDS:-2}"
readonly KILL_GRACE_SECONDS="${CEO_LOOP_KILL_GRACE_SECONDS:-20}"
readonly MAX_ITERATIONS="${CEO_LOOP_MAX_ITERATIONS:-0}" # 0 = forever
readonly MAX_RESTART_BACKOFF_SECONDS="${CEO_LOOP_MAX_RESTART_BACKOFF_SECONDS:-300}"
readonly OPENCODE_MODEL="${CEO_LOOP_MODEL:-}"
readonly OPENCODE_KEYS_ENV="${OPENCODE_KEYS_ENV:-${HOME}/.ai/opencode-keys-env.sh}"

readonly LOG_DIR_REL="tmp/ceo-loop"
readonly LOG_DIR="${ROOT_DIR}/${LOG_DIR_REL}"
readonly STOPPED_FILE="${LOG_DIR}/stopped.txt"
readonly CEO_CONTEXT_REL=".ai/local/ceo-context.yaml"
readonly CEO_CONTEXT_FILE="${ROOT_DIR}/${CEO_CONTEXT_REL}"
readonly CEO_WORKSPACE_DIR="${ROOT_DIR}/.ai/local/ceo"
readonly OPENCODE_SESSION_SCRIPT_REL="scripts/opencode-session.sh"

readonly PROMPT_DEFAULT="continue project delivery

Run in autonomous CEO mode using @.opencode/agent/ceo.md.

Instructions:
1. Read and update @.ai/local/ceo-context.yaml plus @.ai/local/ceo/** as working memory.
2. Reconcile state with GitHub Issues, branches, PRs, and committed ADOS artifacts using @.ai/agent/pm-instructions.md and @.ai/agent/pr-instructions.md.
3. If a ticket delivery is needed, always start/resume exactly one ticket-scoped delivery using @scripts/deliver-ticket.sh <workItemRef>; do not deliver multiple tickets in the CEO conversation. deliver-ticket.sh handles the complete lifecycle: state detection, PM session with liveness monitoring, review-comment handling, merge approval (approved label), and exit classification.
4. The deliver-ticket.sh PM session must run the full ADOS 11-phase lifecycle for that one ticket, delegate to subagents, and stop without selecting another ticket.
5. Prevent stale work before new tickets: list active GitHub issues/PRs, favor finishing pending branches/PRs, close superseded work, delete merged branches, fetch/prune, checkout main, and pull --ff-only before new ticket work.
6. Keep delivery discipline: every product change goes ticket -> PR -> squash merge to main. Do not direct-push product work to main.
7. For every process gap, inefficiency, failed experiment, or reusable win, create a new additive note in @.ai/local/ceo/retrospective/<YYYY-MM-DD>-<note-slug>.md; never edit/delete older retro notes.
8. If all project work is complete, write ${LOG_DIR_REL}/stopped.txt with timestamp and reason, then stop.
9. If technically blocked, record the blocker in CEO memory and ${LOG_DIR_REL}/stopped.txt.
"
readonly PROMPT="${CEO_LOOP_PROMPT:-${PROMPT_DEFAULT}}"

current_log_file=""
opencode_pid=""
running=true

log_line() {
  local line="$1"
  printf '%s\n' "${line}"
  [[ -z "${current_log_file}" ]] || printf '%s\n' "${line}" >>"${current_log_file}"
}

utc_now() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
warsaw_session_timestamp() { TZ=Europe/Warsaw date '+%Y%m%d-%H%M%S%3N-%Z'; }
log_info() { log_line "[INFO] ${TAG} $(utc_now) $*"; }
log_warn() { log_line "[WARN] ${TAG} $(utc_now) $*"; }
log_err() { printf '[ERROR] %s %s %s\n' "${TAG}" "$(utc_now)" "$*" >&2; }

validate_uint() {
  local -r name="$1" value="$2"
  [[ "${value}" =~ ^(0|[1-9][0-9]*)$ ]] || { log_err "${name} must be a non-negative base-10 integer, got '${value}'"; exit 2; }
}

validate_positive_uint() {
  local -r name="$1" value="$2"
  validate_uint "${name}" "${value}"
  (( value > 0 )) || { log_err "${name} must be greater than zero"; exit 2; }
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { log_err "Required command not found: $1"; exit 127; }
}

source_opencode_env() {
  if [[ -f "${OPENCODE_KEYS_ENV}" ]]; then
    # shellcheck source=/dev/null
    source "${OPENCODE_KEYS_ENV}"
    unset OPENCODE_SERVER_USERNAME 2>/dev/null || true
    unset OPENCODE_SERVER_PASSWORD 2>/dev/null || true
  else
    log_warn "OpenCode keys env file not found: ${OPENCODE_KEYS_ENV}"
  fi
}

git_last_commit_epoch() {
  git -C "${ROOT_DIR}" log -1 --format=%ct 2>/dev/null || printf '0\n'
}

file_mtime_epoch() {
  local path="$1"
  [[ -e "${path}" ]] || { printf '0\n'; return 0; }
  if stat --version >/dev/null 2>&1; then
    stat -c %Y "${path}" 2>/dev/null || printf '0\n'
  else
    stat -f %m "${path}" 2>/dev/null || printf '0\n'
  fi
}

tree_mtime_epoch() {
  local dir="$1"
  [[ -d "${dir}" ]] || { printf '0\n'; return 0; }
  local latest; latest="$(file_mtime_epoch "${dir}")"
  local item item_epoch
  while IFS= read -r -d '' item; do
    item_epoch="$(file_mtime_epoch "${item}")"
    (( item_epoch > latest )) && latest="${item_epoch}"
  done < <(find "${dir}" -type f -print0 2>/dev/null)
  printf '%s\n' "${latest}"
}

worktree_mtime_epoch() {
  local latest=0
  local item item_epoch
  while IFS= read -r -d '' item; do
    item_epoch="$(file_mtime_epoch "${item}")"
    (( item_epoch > latest )) && latest="${item_epoch}"
  done < <(
    find "${ROOT_DIR}" \
      \( -path "${ROOT_DIR}/.git" \
      -o -path "${ROOT_DIR}/tmp" \
      -o -path "${ROOT_DIR}/.ai/local" \
      -o -path "${ROOT_DIR}/.idea" \) -prune \
      -o -type f -print0 2>/dev/null
  )
  printf '%s\n' "${latest}"
}

max_epoch() {
  local max=0 value
  for value in "$@"; do
    [[ "${value}" =~ ^[0-9]+$ ]] || value=0
    (( value > max )) && max="${value}"
  done
  printf '%s\n' "${max}"
}

activity_epoch() {
  max_epoch \
    "$(git_last_commit_epoch)" \
    "$(worktree_mtime_epoch)" \
    "$(file_mtime_epoch "${CEO_CONTEXT_FILE}")" \
    "$(tree_mtime_epoch "${CEO_WORKSPACE_DIR}")" \
    "$(tree_mtime_epoch "${ROOT_DIR}/doc/changes")" \
    "$(tree_mtime_epoch "${ROOT_DIR}/doc/inception")" \
    "$(tree_mtime_epoch "${ROOT_DIR}/doc/overview")" \
    "$(tree_mtime_epoch "${ROOT_DIR}/doc/planning")" \
    "$(tree_mtime_epoch "${ROOT_DIR}/doc/spec")"
}

kill_opencode_tree() {
  local pid="$1"
  [[ -n "${pid}" ]] || return 0
  kill -0 "${pid}" 2>/dev/null || return 0

  log_warn "sending SIGTERM to opencode pid=${pid}"
  kill -TERM -- "-${pid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true

  local deadline=$(( $(date +%s) + KILL_GRACE_SECONDS ))
  while kill -0 "${pid}" 2>/dev/null && (( $(date +%s) < deadline )); do
    sleep 1
  done

  if kill -0 "${pid}" 2>/dev/null; then
    log_warn "SIGTERM grace expired; sending SIGKILL pid=${pid}"
    kill -KILL -- "-${pid}" 2>/dev/null || kill -KILL "${pid}" 2>/dev/null || true
  fi
}

on_stop() {
  running=false
  if [[ -n "${opencode_pid}" ]]; then
    log_warn "stop requested; terminating opencode pid=${opencode_pid}"
    kill_opencode_tree "${opencode_pid}"
    wait "${opencode_pid}" 2>/dev/null || true
  fi
}

trap on_stop INT TERM

main() {
  validate_positive_uint CEO_LOOP_STUCK_MINUTES "${STUCK_MINUTES}"
  validate_positive_uint CEO_LOOP_POLL_SECONDS "${POLL_SECONDS}"
  validate_positive_uint CEO_LOOP_SLEEP_SECONDS "${LOOP_SLEEP_SECONDS}"
  validate_positive_uint CEO_LOOP_KILL_GRACE_SECONDS "${KILL_GRACE_SECONDS}"
  validate_uint CEO_LOOP_MAX_ITERATIONS "${MAX_ITERATIONS}"
  validate_uint CEO_LOOP_MAX_RESTART_BACKOFF_SECONDS "${MAX_RESTART_BACKOFF_SECONDS}"

  local -r stuck_seconds=$((STUCK_MINUTES * 60))

  require_cmd opencode
  require_cmd setsid
  require_cmd find

  mkdir -p "${LOG_DIR}" "${CEO_WORKSPACE_DIR}" "${ROOT_DIR}/tmp/opencode"
  cd "${ROOT_DIR}"
  rm -f "${STOPPED_FILE}"
  source_opencode_env

  export TMPDIR="${ROOT_DIR}/tmp/opencode"
  export OPENCODE_DISABLE_CLAUDE_CODE="${OPENCODE_DISABLE_CLAUDE_CODE:-1}"

  log_info "stuck_window_minutes=${STUCK_MINUTES} poll_seconds=${POLL_SECONDS} max_iterations=${MAX_ITERATIONS}"
  log_info "ticket_session_script=${OPENCODE_SESSION_SCRIPT_REL}"

  local iteration=0
  local consecutive_fast_failures=0

  while [[ "${running}" == true ]]; do
    iteration=$((iteration + 1))
    if (( MAX_ITERATIONS > 0 && iteration > MAX_ITERATIONS )); then
      log_info "max iterations reached; exiting"
      break
    fi

    local start_ts baseline_activity_epoch last_progress_wall_epoch session_reason session_exit_code session_start_epoch
    start_ts="$(warsaw_session_timestamp)"
    session_start_epoch="$(date +%s)"
    current_log_file="${LOG_DIR}/${start_ts}.log"
    opencode_pid=""
    : >>"${current_log_file}"

    log_info "starting CEO session iteration=${iteration} started_warsaw=${start_ts}"
    log_info "cwd=${ROOT_DIR} log=${LOG_DIR_REL}/${start_ts}.log"
    log_info "prompt=${PROMPT}"

    baseline_activity_epoch="$(activity_epoch)"
    last_progress_wall_epoch="$(date +%s)"
    log_info "progress_baseline activity_epoch=${baseline_activity_epoch} git_commit_epoch=$(git_last_commit_epoch) ceo_context_epoch=$(file_mtime_epoch "${CEO_CONTEXT_FILE}")"

    local opencode_cmd=(opencode run --agent ceo --title "ceo-loop-${start_ts}")
    if [[ -n "${OPENCODE_MODEL}" ]]; then
      opencode_cmd+=(-m "${OPENCODE_MODEL}")
    fi
    opencode_cmd+=("${PROMPT}")

    setsid "${opencode_cmd[@]}" >>"${current_log_file}" 2>&1 &
    opencode_pid=$!
    log_info "opencode_pid=${opencode_pid}"

    session_reason="finished"
    session_exit_code=0

    while [[ "${running}" == true ]]; do
      if ! kill -0 "${opencode_pid}" 2>/dev/null; then
        wait "${opencode_pid}" || session_exit_code=$?
        break
      fi

      local current_activity_epoch now_epoch idle_seconds
      current_activity_epoch="$(activity_epoch)"
      if (( current_activity_epoch > baseline_activity_epoch )); then
        baseline_activity_epoch="${current_activity_epoch}"
        last_progress_wall_epoch="$(date +%s)"
        log_info "activity_detected activity_epoch=${current_activity_epoch}"
      fi

      now_epoch="$(date +%s)"
      idle_seconds=$((now_epoch - last_progress_wall_epoch))
      if (( idle_seconds >= stuck_seconds )); then
        session_reason="stuck"
        session_exit_code=124
        log_warn "no progress for ${idle_seconds}s; restarting CEO session"
        kill_opencode_tree "${opencode_pid}"
        wait "${opencode_pid}" 2>/dev/null || true
        break
      fi

      sleep "${POLL_SECONDS}"
    done

    opencode_pid=""
    log_info "session finished reason=${session_reason} exit_code=${session_exit_code}"

    local session_runtime_seconds=$(( $(date +%s) - session_start_epoch ))
    if [[ "${session_reason}" == "finished" && "${session_exit_code}" -ne 0 && "${session_runtime_seconds}" -lt 120 ]]; then
      consecutive_fast_failures=$((consecutive_fast_failures + 1))
    else
      consecutive_fast_failures=0
    fi

    if [[ -f "${STOPPED_FILE}" ]]; then
      log_info "stopped file detected; exiting"
      sed -n '1,120p' "${STOPPED_FILE}" || true
      exit 0
    fi

    [[ "${running}" == true ]] || { log_info "stopping loop"; break; }

    local sleep_seconds="${LOOP_SLEEP_SECONDS}"
    if (( consecutive_fast_failures > 0 )); then
      sleep_seconds=$((LOOP_SLEEP_SECONDS * (2 ** consecutive_fast_failures)))
      (( sleep_seconds > MAX_RESTART_BACKOFF_SECONDS )) && sleep_seconds="${MAX_RESTART_BACKOFF_SECONDS}"
      log_warn "fast failure count=${consecutive_fast_failures}; backoff_seconds=${sleep_seconds}"
    fi
    sleep "${sleep_seconds}"
  done
}

main "$@"
