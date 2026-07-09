#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# ceo-loop.sh — Mode A outer process: run @ceo in a restartable loop.
#
# Spawns AT MOST ONE @ceo opencode session (INV-DM-3, F-3), detects a genuinely
# stuck CEO (no session-message traffic AND no healthy delivery — INV-DM-3/5)
# and kill+restarts it, resumes the previous session when context is small
# (INV-DM-3), and honors a durable stop signal (#97). Liveness is session-
# message progress (pm-liveness.sh), not process-alive.
#
# Usage:
#   scripts/ceo-loop.sh                # run the loop (foreground, until stopped)
#   scripts/ceo-loop.sh --stop         # write the durable stop signal
#   scripts/ceo-loop.sh --reset        # clear the stop signal and resume
#
# Dependencies: bash>=4, opencode, setsid, jq, scripts/pm-liveness.sh,
#               scripts/deliver-ticket.sh
#
# Platform note (F-7): the single-flight CEO-PID start-epoch guard prefers
# Linux /proc + `ps -o etimes=`. On BSD/macOS there is no `etimes=` field;
# `_pid_start_epoch` falls back to parsing `ps -o etime=`. Linux is the primary
# target — see doc/guides/delivery-modes.md Troubleshooting.
#
# Exit codes:
#   0 - stopped cleanly (stop signal / max restarts not exceeded on graceful exit)
#   1 - max restarts exceeded
#   2 - usage error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="ceo-loop"
readonly APP_VERSION="2.0.0"
readonly LOG_TAG="(${APP_NAME})"

readonly EXIT_FAILURE=1
readonly EXIT_USAGE=2

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
readonly SCRIPT_DIR
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd -P)"
readonly ROOT_DIR

# Stall threshold (minutes). Read lazily so tests can override per-invocation.
# F-7 context-size proxy columns: tokens_input + tokens_cache_read +
# tokens_output + tokens_reasoning (cache-read is a large fraction of the live
# window; excluding it mis-counts). Verified against a real opencode session DB.
# Default tightened 15 -> 10 (aligned with pm-liveness.sh / deliver-ticket.sh).
STUCK_MINUTES="${CEO_LOOP_STUCK_MINUTES:-10}"
POLL_SECONDS="${CEO_LOOP_POLL_SECONDS:-30}"
LOOP_SLEEP_SECONDS="${CEO_LOOP_SLEEP_SECONDS:-2}"
readonly KILL_GRACE_SECONDS="${CEO_LOOP_KILL_GRACE_SECONDS:-20}"
MAX_RESTARTS="${CEO_LOOP_MAX_RESTARTS:-10}"
MAX_ITERATIONS="${CEO_LOOP_MAX_ITERATIONS:-0}"   # 0 = forever
readonly CEO_RESUME_TOKEN_LIMIT="${CEO_RESUME_TOKEN_LIMIT:-100000}"
readonly OPENCODE_MODEL="${CEO_LOOP_MODEL:-}"
readonly OPENCODE_KEYS_ENV="${OPENCODE_KEYS_ENV:-${HOME}/.ai/opencode-keys-env.sh}"

# External command hooks (tests override these).
PM_LIVENESS_SCRIPT="${PM_LIVENESS_SCRIPT:-${SCRIPT_DIR}/pm-liveness.sh}"
readonly PM_LIVENESS_TIMEOUT_SECONDS="${PM_LIVENESS_TIMEOUT_SECONDS:-15}"
DELIVER_TICKET_SCRIPT="${DELIVER_TICKET_SCRIPT:-${SCRIPT_DIR}/deliver-ticket.sh}"

# INV-DM-3: the delivering marker written by deliver-ticket.sh on its OWN path
# (${DELIVERY_DIR}/delivering). ceo-loop reads it as a race-free "CEO is blocked
# on a delivery" signal (more reliable than the --is-delivering PID probe for
# the brief OWN→deliver_loop window). Non-readonly so tests can redirect it.
DELIVERY_DIR="${ROOT_DIR}/.ai/local/delivery"

LOG_DIR="${ROOT_DIR}/tmp/ceo-loop"
# State files (git-ignored via .ai/local). F-3 ceo.pid; #97 durable stop;
# INV-DM-3 last-session for resume; loop.pid for single-flight (prevent
# concurrent ceo-loop instances). Non-readonly so tests can redirect them.
CEO_STATE_DIR="${ROOT_DIR}/.ai/local/ceo"
CEO_PID_FILE="${CEO_STATE_DIR}/ceo.pid"
STOP_FILE="${CEO_STATE_DIR}/stop"
LAST_SESSION_FILE="${CEO_STATE_DIR}/last-session"
LOOP_PID_FILE="${CEO_STATE_DIR}/loop.pid"

readonly PROMPT_DEFAULT="continue project delivery in autonomous CEO mode (see .opencode/agent/ceo.md). Reconcile state with GitHub, pick the next ticket, and deliver it by calling scripts/deliver-ticket.sh <workItemRef> in the foreground (blocking). deliver-ticket.sh runs the full per-ticket lifecycle and returns a delivery summary; it does NOT merge — you are the merge authority in Mode A. Loop: pick, deliver (block), read the summary, decide (merge / resume-prompt / next). Write retrospectives to .ai/local/ceo/retrospective/. If all work is done or you are blocked, write the durable stop via: scripts/ceo-loop.sh --stop"
readonly PROMPT="${CEO_LOOP_PROMPT:-${PROMPT_DEFAULT}}"

VERBOSE="${VERBOSE:-false}"

# Current CEO opencode child PID (tracked for signal propagation + clear-on-exit).
CURRENT_CEO_PID=""

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

# INV-DM-2 propagation rule + F-3: on exit, kill the CEO child tree and clear
# the ceo.pid so a crashed loop is not mistaken for a live CEO.
_cleanup_child() {
  if [[ -n "${CURRENT_CEO_PID:-}" ]]; then
    kill_ceo_tree "${CURRENT_CEO_PID}" 2>/dev/null || true
    CURRENT_CEO_PID=""
  fi
  [[ -f "${CEO_PID_FILE}" ]] && rm -f "${CEO_PID_FILE}" 2>/dev/null || true
  [[ -f "${LOOP_PID_FILE}" ]] && rm -f "${LOOP_PID_FILE}" 2>/dev/null || true
}

_on_interrupt() {
  log_warn "Interrupted"
  exit 130
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap '_cleanup_child' EXIT
trap '_on_interrupt' INT TERM

# ============================================================================
# LOGGING
# ============================================================================
# Full date+time in every log line so multi-day sessions are unambiguous.
_ts() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
log_info()  { printf '[%s] ℹ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_warn()  { printf '[%s] ⚠ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_err()   { printf '[%s] ✗ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[%s] ℹ DEBUG %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2 || true; }
die() { log_err "$@"; exit "${EXIT_USAGE}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ============================================================================
# MOCKABLE WRAPPERS
# ============================================================================
_opencode() { command opencode "$@"; }
_jq()       { command jq "$@"; }
_git()      { command git "$@"; }
_setsid()   { command setsid "$@"; }

# ============================================================================
# INPUT VALIDATION (pure)
# ============================================================================
validate_uint() {
  local -r name="$1" value="$2"
  [[ "${value}" =~ ^(0|[1-9][0-9]*)$ ]] || die "${name} must be a non-negative base-10 integer, got '${value}'"
}

validate_positive_uint() {
  local -r name="$1" value="$2"
  validate_uint "${name}" "${value}"
  (( value > 0 )) || die "${name} must be greater than zero"
}

# ============================================================================
# PID IDENTITY HELPERS (F-3 reuse the deliver-ticket technique)
# ============================================================================
_pid_alive() {
  local -r pid="$1"
  [[ "${pid}" =~ ^[0-9]+$ ]] || return 1
  kill -0 "${pid}" 2>/dev/null
}

_pid_cmdline_contains() {
  local -r pid="$1" needle="$2"
  local cmdline=""
  if [[ -r "/proc/${pid}/cmdline" ]]; then
    cmdline="$(tr '\0' ' ' <"/proc/${pid}/cmdline" 2>/dev/null)" || cmdline=""
  else
    cmdline="$(ps -o command= -p "${pid}" 2>/dev/null)" || cmdline=""
  fi
  [[ "${cmdline}" == *"${needle}"* ]]
}

_pid_cwd_is() {
  local -r pid="$1" dir="$2"
  if [[ -L "/proc/${pid}/cwd" ]]; then
    local link
    link="$(readlink "/proc/${pid}/cwd" 2>/dev/null)" || link=""
    [[ "${link}" == "${dir}" ]]
  else
    local cwd
    cwd="$(lsof -a -p "${pid}" -d cwd -Fn 2>/dev/null | awk -F'n' '/^n/{print $2; exit}')" || cwd=""
    [[ "${cwd}" == "${dir}" ]]
  fi
}

# Estimate the epoch at which the PID started (now - elapsed_seconds).
# Prints an integer epoch or empty on failure (caller degrades gracefully).
# F-7: BSD/macOS fallback for `ps -o etime=` (see deliver-ticket.sh for the
# full rationale). Linux is the primary target.
_parse_elapsed_to_seconds() {
  local -r s="$1"
  [[ -n "${s}" ]] || return 0
  local days=0 hours=0 mins=0 secs=0
  if [[ "${s}" == *-* ]]; then
    days="${s%%-*}"
    local rest="${s#*-}"
    IFS=':' read -r hours mins secs <<<"${rest}"
  elif [[ "${s}" == *:* ]]; then
    local parts=()
    IFS=':' read -ra parts <<<"${s}"
    case "${#parts[@]}" in
      3) hours="${parts[0]}"; mins="${parts[1]}"; secs="${parts[2]}" ;;
      2) mins="${parts[0]}"; secs="${parts[1]}" ;;
      *) return 0 ;;
    esac
  else
    return 0
  fi
  [[ "${days:-0}" =~ ^[0-9]+$ && "${hours:-0}" =~ ^[0-9]+$ \
     && "${mins:-0}" =~ ^[0-9]+$ && "${secs:-0}" =~ ^[0-9]+$ ]] || return 0
  # 10# forces base-10 so zero-padded fields like "08" aren't read as octal.
  printf '%s' "$(( 10#${days} * 86400 + 10#${hours} * 3600 + 10#${mins} * 60 + 10#${secs} ))"
}

_pid_start_epoch() {
  local -r pid="$1"
  local raw
  raw="$(ps -o etimes= -p "${pid}" 2>/dev/null | tr -d '[:space:]')" || raw=""
  if [[ "${raw}" =~ ^[0-9]+$ ]]; then
    printf '%s' "$(( $(date +%s) - raw ))"
    return 0
  fi
  raw="$(ps -o etime= -p "${pid}" 2>/dev/null | tr -d '[:space:]')" || raw=""
  local secs
  secs="$(_parse_elapsed_to_seconds "${raw}")"
  if [[ "${secs}" =~ ^[0-9]+$ ]]; then
    printf '%s' "$(( $(date +%s) - secs ))"
    return 0
  fi
  printf ''
  return 0
}

# ============================================================================
# STATE FILES (F-3, #97, INV-DM-3)
# ============================================================================
ensure_state_dir() {
  mkdir -p "${CEO_STATE_DIR}"
}

# F-3: write/probe/clear the CEO child PID. The PID file holds the child PID +
# start epoch so a loop restart while a CEO is alive JOINs rather than spawns.
write_ceo_pid() {
  local -r pid="$1" start_epoch="${2:-$(date +%s)}"
  ensure_state_dir
  _jq -n --arg pid "${pid}" --argjson start "${start_epoch}" \
    '{pid:$pid,start:$start}' >"${CEO_PID_FILE}"
}

clear_ceo_pid() {
  [[ -f "${CEO_PID_FILE}" ]] && rm -f "${CEO_PID_FILE}" || true
}

# F-3: validate the recorded CEO child PID is still a live opencode-for-ceo
# process for this repo. Prints the PID on stdout when live; returns 1 otherwise.
ceo_pid_if_live() {
  [[ -f "${CEO_PID_FILE}" ]] || return 1
  local pid start_epoch
  pid="$(_jq -r '.pid // empty' "${CEO_PID_FILE}" 2>/dev/null)" || return 1
  start_epoch="$(_jq -r '.start // empty' "${CEO_PID_FILE}" 2>/dev/null)" || start_epoch=""
  [[ "${pid}" =~ ^[0-9]+$ ]] || return 1
  _pid_alive "${pid}" || return 1
  # cmdline must be an opencode run (the CEO child); cwd must be this repo.
  _pid_cmdline_contains "${pid}" "opencode" || return 1
  _pid_cwd_is "${pid}" "${ROOT_DIR}" || return 1
  # Start-epoch reuse guard (5s tolerance).
  if [[ "${start_epoch}" =~ ^[0-9]+$ ]]; then
    local actual_start
    actual_start="$(_pid_start_epoch "${pid}")"
    if [[ "${actual_start}" =~ ^[0-9]+$ ]]; then
      local diff=$(( actual_start - start_epoch ))
      (( diff < 0 )) && diff=$(( -diff ))
      (( diff <= 5 )) || return 1
    fi
  fi
  printf '%s' "${pid}"
}

is_ceo_alive() {
  local pid
  pid="$(ceo_pid_if_live)" || return 1
  [[ -n "${pid}" ]]
}

# INV-DM-3: remember / read the last CEO session id for the resume decision.
remember_session_id() {
  local -r sid="$1"
  ensure_state_dir
  printf '%s' "${sid}" >"${LAST_SESSION_FILE}"
}

last_session_id() {
  [[ -f "${LAST_SESSION_FILE}" ]] || { printf ''; return 0; }
  local sid
  sid="$(cat "${LAST_SESSION_FILE}" 2>/dev/null)" || sid=""
  printf '%s' "${sid}"
}

# ============================================================================
# SESSION-TRAFFIC LIVENESS (INV-DM-5) + DELIVERY PROBE (INV-DM-3)
# ============================================================================
# Wraps pm-liveness.sh with a timeout + graceful degradation.
# Returns: 0 healthy, 1 stalled, 2 degraded (caller treats as not-stuck).
_pm_liveness() {
  local -r session_id="$1"
  [[ -n "${session_id}" ]] || return 2
  [[ -x "${PM_LIVENESS_SCRIPT}" ]] || return 2
  local rc
  CEO_LOOP_STALL_MINUTES="${STUCK_MINUTES}" timeout "${PM_LIVENESS_TIMEOUT_SECONDS}" \
    "${PM_LIVENESS_SCRIPT}" "${session_id}" >/dev/null 2>&1 || rc=$?
  rc="${rc:-0}"
  case "${rc}" in
    0) return 0 ;;
    1) return 1 ;;
    *) return 2 ;;
  esac
}

# INV-DM-3: is a healthy delivery in progress in this repo? Delegates to
# deliver-ticket.sh --is-delivering (the repo-local single-flight probe).
# Returns: 0 if a delivery is in progress, 1 otherwise.
delivery_in_progress() {
  [[ -x "${DELIVER_TICKET_SCRIPT}" ]] || return 1
  "${DELIVER_TICKET_SCRIPT}" --is-delivering >/dev/null 2>&1 || return 1
  return 0
}

# INV-DM-3/5: a CEO is STUCK iff, for longer than the stall threshold:
#   - pm-liveness says the CEO session is stalled (no message traffic), AND
#   - NO healthy delivery is in progress.
# A CEO blocked on a healthy, progressing delivery is NOT stuck.
# F-6 defense-in-depth: if the session-id is unavailable (capture failed →
# empty), _pm_liveness returns degraded and a genuinely hung CEO would never be
# caught by the rc==1 path. When the session-id is empty AND no delivery is in
# progress, fall back to "stuck-candidate" so the caller's threshold timer can
# still kill a hung CEO whose session-id we couldn't read.
# Args: ceo_session_id
# Returns: 0 if stuck, 1 if not stuck.
ceo_is_stuck() {
  local -r session_id="$1"
  local liv_rc
  _pm_liveness "${session_id}" || liv_rc=$?
  liv_rc="${liv_rc:-0}"
  # Healthy traffic ⇒ not stuck.
  if [[ "${liv_rc}" -eq 0 ]]; then
    return 1
  fi
  # INV-DM-3: check the delivering marker file FIRST (more reliable than
  # --is-delivering). deliver-ticket.sh writes it on its OWN path BEFORE the
  # delivery starts, so a CEO blocked on a live delivery is never killed — even
  # in the brief window before the child PID is observable by the PID probe.
  local delivering_marker="${DELIVERY_DIR}/delivering"
  if [[ -f "${delivering_marker}" ]]; then
    local del_pid
    del_pid="$(_jq -r '.pid // empty' "${delivering_marker}" 2>/dev/null)" || del_pid=""
    if [[ "${del_pid}" =~ ^[0-9]+$ ]] && _pid_alive "${del_pid}"; then
      log_debug "delivering marker live (pid=${del_pid}); CEO not stuck"
      return 1
    fi
  fi
  # A healthy delivery keeps the CEO healthy regardless of session traffic.
  # (Defense-in-depth: the PID probe is kept as a second signal.)
  if delivery_in_progress; then
    log_debug "CEO session stalled but a healthy delivery is in progress — not stuck"
    return 1
  fi
  # Stalled session traffic with no delivery ⇒ stuck.
  if [[ "${liv_rc}" -eq 1 ]]; then
    return 0
  fi
  # rc==2 (degraded). If the session-id is unavailable, fall back to
  # defense-in-depth (F-6): a CEO whose session-id we can't read, with no
  # healthy delivery, is a stuck-candidate once the threshold elapses.
  if [[ -z "${session_id}" ]]; then
    log_warn "F-6: CEO session-id unavailable and liveness degraded; falling back to no-delivery stuck detection"
    return 0
  fi
  # Degraded probe with a known session-id ⇒ we don't know; don't kill.
  return 1
}

# ============================================================================
# SESSION RESUME (INV-DM-3)
# ============================================================================
# Read the previous CEO session's CURRENT context pressure (last assistant
# turn's tokens.total). Returns the integer total, or empty on failure (caller
# spawns fresh).
#
# BUG FIX: the old query used session.tokens_* (CUMULATIVE across all turns),
# which grows every turn and always exceeds the resume threshold after a few
# turns — so the loop almost never resumed. The correct metric is the LAST
# assistant message's tokens.total, which represents the current context window
# pressure (how full the window is RIGHT NOW). See:
# doc/tmp/opencode-notes/token-usage-and-compaction.md §3
context_total_for() {
  local -r session_id="$1"
  [[ -n "${session_id}" ]] || { printf ''; return 0; }
  local sql
  sql="SELECT json_extract(data, '\$.tokens.total') AS context_total FROM message WHERE session_id = '${session_id}' AND json_extract(data, '\$.role') = 'assistant' AND json_extract(data, '\$.tokens.input') > 0 ORDER BY time_created DESC LIMIT 1"
  local row
  row="$(_opencode db "${sql}" --format json 2>/dev/null)" || { printf ''; return 0; }
  [[ -n "${row}" ]] || { printf ''; return 0; }
  _jq -r '.[0].context_total // empty' <<<"${row}" 2>/dev/null || printf ''
}

# Capture the CEO session id for a freshly-spawned session by title lookup.
# Args: title
capture_session_id_by_title() {
  local -r title="$1"
  local sid
  sid="$(cd "${ROOT_DIR}" && _opencode session list --format json 2>/dev/null \
    | _jq -r --arg t "${title}" '[.[] | select(.title == $t)] | sort_by(.time) | last | .id // empty' 2>/dev/null)" || sid=""
  printf '%s' "${sid}"
}

# ============================================================================
# KILL MECHANISM (signal propagation)
# ============================================================================
kill_ceo_tree() {
  local pid="$1"
  [[ -n "${pid}" ]] || return 0
  _pid_alive "${pid}" || return 0

  log_warn "Sending SIGTERM to CEO pid=${pid}"
  kill -TERM -- "-${pid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true

  local deadline=$(( $(date +%s) + KILL_GRACE_SECONDS ))
  while _pid_alive "${pid}" && (( $(date +%s) < deadline )); do
    sleep 1
  done

  if _pid_alive "${pid}"; then
    log_warn "SIGTERM grace expired; sending SIGKILL pid=${pid}"
    kill -KILL -- "-${pid}" 2>/dev/null || kill -KILL "${pid}" 2>/dev/null || true
  fi
}

# ============================================================================
# SPAWN / RESUME (F-3, INV-DM-3)
# ============================================================================
source_opencode_env() {
  if [[ -f "${OPENCODE_KEYS_ENV}" ]]; then
    # shellcheck source=/dev/null
    source "${OPENCODE_KEYS_ENV}" 2>/dev/null || true
    unset OPENCODE_SERVER_USERNAME 2>/dev/null || true
    unset OPENCODE_SERVER_PASSWORD 2>/dev/null || true
  fi
}

# F-3 + INV-DM-3: spawn at most one CEO. If a live CEO child exists, JOIN/wait
# for it (return its PID) rather than spawn a second. Otherwise resume the prev
# session (if context is small) or spawn fresh. Prints the CEO child PID.
spawn_or_resume_ceo() {
  local log_file="$1"

  # F-3: a live CEO child already exists (e.g. loop restarted while CEO alive).
  local live_pid
  live_pid="$(ceo_pid_if_live)" || live_pid=""
  if [[ -n "${live_pid}" ]]; then
    log_info "F-3: live CEO child exists (pid=${live_pid}); JOINing instead of spawning"
    printf '%s' "${live_pid}"
    return 0
  fi

  # INV-DM-3: session-resume decision.
  local prev_sid resume="false"
  prev_sid="$(last_session_id)"
  if [[ -n "${prev_sid}" ]]; then
    local total
    total="$(context_total_for "${prev_sid}")"
    if [[ "${total}" =~ ^[0-9]+$ ]] && (( total < CEO_RESUME_TOKEN_LIMIT )); then
      resume="true"
      log_info "INV-DM-3: resuming CEO session ${prev_sid} (context=${total} < ${CEO_RESUME_TOKEN_LIMIT})"
    elif [[ "${total}" =~ ^[0-9]+$ ]]; then
      log_info "INV-DM-3: spawning fresh CEO (prev context=${total} >= ${CEO_RESUME_TOKEN_LIMIT})"
    else
      log_info "INV-DM-3: spawning fresh CEO (prev context unavailable)"
    fi
  else
    log_info "INV-DM-3: spawning fresh CEO (no previous session)"
  fi

  local title
  title="ceo-loop-$(date +%Y%m%d-%H%M%S)"
  local opencode_cmd=()
  if [[ "${resume}" == "true" ]]; then
    opencode_cmd=(opencode run --agent ceo --session "${prev_sid}" "${PROMPT}")
  else
    opencode_cmd=(opencode run --agent ceo --title "${title}")
    [[ -n "${OPENCODE_MODEL}" ]] && opencode_cmd+=(-m "${OPENCODE_MODEL}")
    opencode_cmd+=("${PROMPT}")
  fi

  _setsid "${opencode_cmd[@]}" >>"${log_file}" 2>&1 &
  local pid=$!
  CURRENT_CEO_PID="${pid}"
  write_ceo_pid "${pid}" "$(date +%s)"
  log_info "spawned CEO pid=${pid} resume=${resume}"

  # Capture + remember the session id (for the next resume decision + liveness).
  local sid=""
  if [[ "${resume}" != "true" ]]; then
    local i
    for ((i = 0; i < 10; i++)); do
      sleep 1
      sid="$(capture_session_id_by_title "${title}")"
      [[ -n "${sid}" ]] && break
    done
    # F-6: surface a capture failure so it's observable (a missing session-id
    # degrades the liveness watchdog until it's known).
    [[ -n "${sid}" ]] || log_warn "F-6: could not capture CEO session id (title=${title}); liveness watchdog degraded"
  else
    sid="${prev_sid}"
  fi
  [[ -n "${sid}" ]] && remember_session_id "${sid}"
  printf '%s' "${pid}"
}

# ============================================================================
# MAIN LOOP
# ============================================================================
run_loop() {
  # Stall threshold in seconds. Defaults to STUCK_MINUTES*60; tests override
  # via CEO_LOOP_STUCK_SECONDS for speed (bypasses the minutes→seconds multiply).
  local -r stuck_seconds="${STUCK_SECONDS:-$((STUCK_MINUTES * 60))}"
  ensure_state_dir

  # Single-flight: prevent two ceo-loop.sh instances in the same workspace.
  # A second invocation could spawn a second CEO, confuse the PID probes, or
  # have its CEO kill the first loop's parent process.
  if [[ -f "${LOOP_PID_FILE}" ]]; then
    local loop_pid
    loop_pid="$(_jq -r '.pid // empty' "${LOOP_PID_FILE}" 2>/dev/null)" || loop_pid=""
    if [[ "${loop_pid}" =~ ^[0-9]+$ ]] && _pid_alive "${loop_pid}" \
       && _pid_cmdline_contains "${loop_pid}" "ceo-loop.sh" \
       && _pid_cwd_is "${loop_pid}" "${ROOT_DIR}"; then
      log_info "another ceo-loop is already running (pid=${loop_pid}); exiting"
      log_info "to force restart: scripts/ceo-loop.sh --stop && scripts/ceo-loop.sh --reset && scripts/ceo-loop.sh"
      return 0
    fi
  fi
  # Write own PID so a second invocation detects us.
  ensure_state_dir
  _jq -n --arg pid "$$" --argjson start "$(date +%s)" \
    '{pid:$pid,start:$start}' >"${LOOP_PID_FILE}"

  mkdir -p "${LOG_DIR}"
  cd "${ROOT_DIR}"
  source_opencode_env
  export TMPDIR="${ROOT_DIR}/tmp/opencode"
  mkdir -p "${TMPDIR}"

  log_info "stuck_minutes=${STUCK_MINUTES} poll_seconds=${POLL_SECONDS} max_restarts=${MAX_RESTARTS} max_iterations=${MAX_ITERATIONS} resume_limit=${CEO_RESUME_TOKEN_LIMIT}"

  local iteration=0 restarts=0
  while true; do
    ((iteration++)) || true
    if (( MAX_ITERATIONS > 0 && iteration > MAX_ITERATIONS )); then
      log_info "max iterations reached; exiting"
      return 0
    fi

    # #97: honor a durable, non-expired stop. (Not wiped at startup.)
    if [[ -f "${STOP_FILE}" ]]; then
      log_info "durable stop signal present; honoring and exiting"
      log_info "to restart the CEO loop: scripts/ceo-loop.sh --reset && scripts/ceo-loop.sh"
      return 0
    fi

    local log_file
    # Deterministic log path so debugging is predictable: tmp/ceo-loop/ceo.log
    log_file="${LOG_DIR}/ceo.log"
    : >>"${log_file}"
    log_info "iteration=${iteration} restarts=${restarts} log=${log_file}"

    # F-3 + INV-DM-3: spawn or resume the CEO (JOINs a live one).
    local ceo_pid
    ceo_pid="$(spawn_or_resume_ceo "${log_file}")"
    local ceo_sid
    ceo_sid="$(last_session_id)"

    local last_progress_wall_epoch session_reason session_exit_code
    last_progress_wall_epoch="$(date +%s)"
    session_reason="finished"
    session_exit_code=0

    # Monitor the CEO until it exits or is declared stuck.
    while true; do
      if ! _pid_alive "${ceo_pid}"; then
        wait "${ceo_pid}" 2>/dev/null || session_exit_code=$?
        break
      fi

      # INV-DM-3/5: stuck detection (session traffic + delivery probe).
      if ceo_is_stuck "${ceo_sid}"; then
        local now_epoch idle
        now_epoch="$(date +%s)"
        idle=$(( now_epoch - last_progress_wall_epoch ))
        if (( idle >= stuck_seconds )); then
          session_reason="stuck"
          session_exit_code=124
          log_warn "CEO stuck for ${idle}s (no session traffic, no healthy delivery); killing + restarting"
          kill_ceo_tree "${ceo_pid}"
          wait "${ceo_pid}" 2>/dev/null || true
          break
        fi
      else
        # Not stuck ⇒ reset the progress timer (healthy session traffic or delivery).
        last_progress_wall_epoch="$(date +%s)"
      fi

      sleep "${POLL_SECONDS}"
    done

    CURRENT_CEO_PID=""
    clear_ceo_pid
    log_info "session ended reason=${session_reason} exit_code=${session_exit_code}"

    # Honor a stop written by the CEO itself during the session.
    if [[ -f "${STOP_FILE}" ]]; then
      log_info "stop signal written during session; exiting"
      return 0
    fi

    if [[ "${session_reason}" == "stuck" ]]; then
      ((restarts++)) || true
      if (( restarts > MAX_RESTARTS )); then
        log_err "max restarts (${MAX_RESTARTS}) exceeded; exiting"
        return "${EXIT_FAILURE}"
      fi
    fi

    sleep "${LOOP_SLEEP_SECONDS}"
  done
}

# ============================================================================
# SUBCOMMANDS
# ============================================================================
cmd_stop() {
  ensure_state_dir
  printf 'stopped at %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >"${STOP_FILE}"
  log_info "durable stop signal written to ${STOP_FILE}"
}

cmd_reset() {
  ensure_state_dir
  if [[ -f "${STOP_FILE}" ]]; then
    rm -f "${STOP_FILE}"
    log_info "stop signal cleared; loop will resume on next run"
  else
    log_info "no stop signal present; nothing to reset"
  fi
}

# `--status` — print the loop + CEO state as key=value pairs on stdout.
# Lets agents inspect process state without manual ps/kill/PID-file reading.
# Exit 0 always (status query).
cmd_status() {
  ensure_state_dir

  # Loop process
  local loop_running="no" loop_pid=""
  if [[ -f "${LOOP_PID_FILE}" ]]; then
    loop_pid="$(_jq -r '.pid // empty' "${LOOP_PID_FILE}" 2>/dev/null)" || loop_pid=""
    if [[ "${loop_pid}" =~ ^[0-9]+$ ]] && _pid_alive "${loop_pid}" \
       && _pid_cmdline_contains "${loop_pid}" "ceo-loop.sh"; then
      loop_running="yes"
    else
      loop_pid=""  # stale
    fi
  fi

  # CEO child
  local ceo_alive="no" ceo_pid_val="" ceo_sid=""
  ceo_pid_val="$(ceo_pid_if_live 2>/dev/null)" || true
  if [[ -n "${ceo_pid_val}" ]]; then
    ceo_alive="yes"
    ceo_sid="$(last_session_id)"
  fi

  # Stop signal
  local stop_signal="no"
  [[ -f "${STOP_FILE}" ]] && stop_signal="yes"

  printf 'loop_running=%s\n' "${loop_running}"
  printf 'loop_pid=%s\n' "${loop_pid}"
  printf 'ceo_alive=%s\n' "${ceo_alive}"
  printf 'ceo_pid=%s\n' "${ceo_pid_val}"
  printf 'ceo_session=%s\n' "${ceo_sid}"
  printf 'stop_signal=%s\n' "${stop_signal}"
}

# `--log [N]` — print the last N lines of the CEO loop log (default 50).
# Lets agents read logs without knowing the internal path.
cmd_log() {
  local n="${1:-${LOG_LINES:-50}}"
  [[ "${n}" =~ ^[0-9]+$ ]] || n=50
  local log="${LOG_DIR}/ceo.log"
  if [[ -f "${log}" ]]; then
    tail -n "${n}" "${log}"
  else
    log_warn "No log file at ${log}"
  fi
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
${APP_NAME} ${APP_VERSION} — Mode A outer process: restartable @ceo loop

Usage: ${APP_NAME} [--stop | --reset | --status | run]

Commands:
  run (default)   Run the CEO loop (foreground). Spawns at most one @ceo,
                  detects a stuck CEO (INV-DM-3/5) and kill+restarts, resumes
                  the previous session when context is small (INV-DM-3).
  --stop          Write the durable stop signal (.ai/local/ceo/stop). A running
                  loop honors it at the next iteration; a fresh loop exits
                  without spawning a CEO (#97 — survives restarts).
  --reset         Clear the stop signal so the loop resumes.
  --status        Print loop + CEO state as key=value pairs (loop_running,
                  ceo_alive, stop_signal, etc.). Lets agents inspect state
                  without manual ps/kill.
  --log [N]       Print the last N lines of the CEO loop log (default 50).
                  Lets agents read logs without knowing the internal path.

Options:
  -h, --help      Show this help message
  -V, --version   Show version
  -v, --verbose   Enable debug output

Environment:
  CEO_LOOP_STALL_MINUTES    Stall threshold in minutes (default: 10)
  CEO_LOOP_POLL_SECONDS     Liveness poll interval (default: 30)
  CEO_LOOP_MAX_RESTARTS     Max stuck-kill+restarts before exit 1 (default: 10)
  CEO_LOOP_MAX_ITERATIONS   Max CEO iterations, 0 = forever (default: 0)
  CEO_RESUME_TOKEN_LIMIT    Resume prev session if context < this (default: 100000)
  CEO_LOOP_KILL_GRACE_SECONDS  SIGTERM grace before SIGKILL (default: 20)
  CEO_LOOP_PROMPT           Override the CEO run prompt

Exit codes:
  0 - stopped cleanly
  1 - max restarts exceeded
  2 - usage error
EOF
}

main() {
  local cmd="${1:-run}"
  case "${cmd}" in
    -h|--help) usage; exit 0 ;;
    -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
    -v|--verbose) VERBOSE=true; shift; cmd="${1:-run}" ;;
    --stop) cmd_stop; exit 0 ;;
    --reset) cmd_reset; exit 0 ;;
    --status) cmd_status; exit 0 ;;
    --log) cmd_log "${2:-}"; exit 0 ;;
    run) : ;;
    *) die "Unknown command: ${cmd}. See --help." ;;
  esac
  shift 2>/dev/null || true

  validate_positive_uint CEO_LOOP_STUCK_MINUTES "${STUCK_MINUTES}"
  validate_positive_uint CEO_LOOP_POLL_SECONDS "${POLL_SECONDS}"
  validate_positive_uint CEO_LOOP_SLEEP_SECONDS "${LOOP_SLEEP_SECONDS}"
  validate_positive_uint CEO_LOOP_KILL_GRACE_SECONDS "${KILL_GRACE_SECONDS}"
  validate_uint CEO_LOOP_MAX_RESTARTS "${MAX_RESTARTS}"
  validate_uint CEO_LOOP_MAX_ITERATIONS "${MAX_ITERATIONS}"

  require_cmd opencode
  require_cmd setsid
  require_cmd jq

  run_loop
}

# Testable main guard.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
