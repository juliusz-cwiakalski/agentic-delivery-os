#!/usr/bin/env bash
# pm-liveness.sh — multi-signal liveness probe for an opencode session tree
#
# Prints a parseable (key=value) report and exits non-zero when a session has
# been stalled (no activity from ANY signal) for longer than the stall
# threshold. Consumed by deliver-ticket.sh (INV-DM-5 PM watchdog) and
# ceo-loop.sh (INV-DM-3/5 CEO stuck detection).
#
# Two complementary signals (either healthy ⇒ session healthy):
#   1. Session-message traffic from the recursive session tree — queries the
#      current `session_message` table across the session AND its child
#      sessions (parent_id traversal), so a parent that delegated to @coder /
#      @spec-writer (and went quiet itself) is NOT a false stall.
#   2. Git/worktree activity — the most recent of git-commit epoch and
#      worktree file mtimes. Runs ALONGSIDE the DB signal (not only as a
#      degraded fallback): if EITHER shows recent activity, the session is
#      healthy.
#
# Graceful degradation: if the opencode DB query fails (CI has no real
# opencode DB), it logs a [WARN] degraded-mode message and decides on the
# git/worktree signal alone. It NEVER crashes on a missing DB.
#
# Dependencies: bash>=4, opencode (optional; degrades without it), jq, git
# Usage: pm-liveness.sh <session_id>
#
# Environment:
#   CEO_LOOP_STALL_MINUTES     Stall threshold in minutes (default: 10)
#   OPENCODE_DB_CMD            Override the opencode DB command (tests)
#   OPENCODE_SESSION_LIST_CMD  Override the opencode session-list command (tests)
#   ROOT_DIR                   Repo root for the git/worktree signal (default: auto)
#   VERBOSE                    Set to 'true' for debug output
#
# Exit codes:
#   0 - Healthy (recent activity from the session tree OR git/worktree)
#   1 - Stalled (no activity from any signal for >= threshold minutes)
#   2 - Usage error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="pm-liveness"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

readonly EXIT_STALLED=1
readonly EXIT_USAGE=2

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
readonly SCRIPT_DIR
# ROOT_DIR: repo root for the git/worktree fallback signal. Overridable via env
# (documented above) and intentionally NON-readonly so tests can point it at a
# temp repo per-invocation for deterministic git/worktree-signal coverage
# (bash.md §10.1 dependency injection). In production it is set once at startup
# and never reassigned.
ROOT_DIR="${ROOT_DIR:-$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd -P)}"

# Stall threshold (minutes). Read lazily inside main() so tests can override
# CEO_LOOP_STALL_MINUTES per-invocation without re-sourcing the script.
# deliver-ticket.sh aligns this with DELIVER_STUCK_MINUTES by exporting
# CEO_LOOP_STALL_MINUTES when it calls this probe; both default to 10 (OQ-DM-3).
readonly DEFAULT_STALL_MINUTES=10

# How many recent messages to read for the gap-trend heuristic.
readonly TREND_WINDOW=8

VERBOSE="${VERBOSE:-false}"

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap 'log_warn "Interrupted"; exit 130' INT TERM

# ============================================================================
# LOGGING
# ============================================================================
log_info()  { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_err()   { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*" >&2 || true; }

die() { log_err "$@"; exit "${EXIT_USAGE}"; }

# ============================================================================
# MOCKABLE WRAPPERS (for testing)
# ============================================================================
# _opencode dispatches the documented stable CLI:
#   opencode db "<SQL>" --format json   -> session/message rows
#   opencode session list --format json -> session list
_opencode() { command opencode "$@"; }
_jq()       { command jq "$@"; }
_git()      { command git "$@"; }

# ============================================================================
# PURE HELPERS
# ============================================================================

# PURE: validate an opencode session id shape (alphanumeric/underscore/hyphen).
# Guards the SQL string interpolation against injection / broken queries.
validate_session_id() {
  local -r sid="$1"
  [[ "${sid}" =~ ^[A-Za-z0-9_-]+$ ]]
}

# PURE: decide whether a session is stalled given seconds-since-last-message.
# Stalled iff seconds_since >= threshold_seconds (at-threshold == stalled, per
# the AC-5 test_at_threshold_stalled contract; matches deliver-ticket's
# is_session_stuck `>=` convention).
# Args: seconds_since_last_msg threshold_seconds
decide_stalled() {
  local -r seconds_since="$1"
  local -r threshold_seconds="$2"
  [[ "${seconds_since}" =~ ^[0-9]+$ && "${threshold_seconds}" =~ ^[0-9]+$ ]] || return 1
  (( seconds_since >= threshold_seconds ))
}

# PURE: classify the gap trend from a set of inter-message intervals (seconds,
# ascending chronological order: oldest interval first). Prints one of:
# growing | shrinking | stable. Fewer than 2 intervals -> stable.
# Heuristic: compare the average of the first half of intervals to the second
# half, with a 10% tolerance band.
compute_gap_trend() {
  local -a intervals=()
  local v
  for v in "$@"; do
    [[ "${v}" =~ ^[0-9]+$ ]] || continue
    intervals+=("${v}")
  done
  local -r n=${#intervals[@]}
  (( n >= 2 )) || { printf 'stable'; return 0; }

  local half=$(( n / 2 ))
  (( half >= 1 )) || half=1
  local i sum_first=0 sum_second=0
  for (( i = 0; i < half; i++ )); do sum_first=$(( sum_first + intervals[i] )); done
  for (( i = half; i < n; i++ )); do sum_second=$(( sum_second + intervals[i] )); done
  local avg_first=$(( sum_first / half ))
  local avg_second=$(( sum_second / (n - half) ))

  # Avoid divide-by-zero when the first half average is 0.
  if (( avg_first == 0 )); then
    if (( avg_second == 0 )); then
      printf 'stable'
    else
      printf 'growing'
    fi
    return 0
  fi

  # growing: second-half avg at least 10% larger than the first-half avg.
  if (( avg_second * 10 >= avg_first * 11 )); then
    printf 'growing'
  elif (( avg_second * 10 <= avg_first * 9 )); then
    printf 'shrinking'
  else
    printf 'stable'
  fi
}

# ============================================================================
# SESSION TRAFFIC (opencode DB)
# ============================================================================

# Query the opencode DB for the most recent messages and parse the result.
# Prints three TSV fields on stdout (consumed by the caller):
#   <last_msg_ms>\t<last_step>\t<timestamp_ms_csv_oldest_first>
# Returns non-zero (and prints nothing) when the query is unavailable / empty,
# so the caller can degrade gracefully. The DB time_created column is in
# MILLISECONDS (verified against a real opencode session DB).
#
# Recursive session-tree traversal: `session_message` is the CURRENT message
# store (the legacy `message` table is no longer written to — see
# doc/tmp/opencode-notes/opencode-database-schema.md). Walking session.parent_id
# catches traffic from child sessions (when the PM delegates to @coder /
# @spec-writer / …) so a quiet parent with active children is NOT a false
# stall. The `data` JSON shape (role, etc.) is identical in both tables, so the
# downstream jq parsing is unchanged. validate_session_id guards the
# interpolation (the recursive CTE is safe against injection for the same
# reason the legacy single-table query was).
fetch_recent_messages() {
  local -r session_id="$1"
  local sql
  sql="WITH RECURSIVE tree(id) AS (SELECT id FROM session WHERE id = '${session_id}' UNION ALL SELECT s.id FROM session s JOIN tree t ON s.parent_id = t.id) SELECT time_created, data FROM session_message WHERE session_id IN (SELECT id FROM tree) ORDER BY time_created DESC LIMIT ${TREND_WINDOW}"

  local rows
  rows="$(_opencode db "${sql}" --format json 2>/dev/null)" || return 1
  [[ -n "${rows}" ]] || return 1

  # Empty result set: no messages for this session.
  if _jq -e 'length == 0' >/dev/null 2>&1 <<<"${rows}"; then
    return 1
  fi

  local last_msg_ms last_step timestamps_csv
  last_msg_ms="$(_jq -r '.[0].time_created // empty' <<<"${rows}" 2>/dev/null)" || last_msg_ms=""
  [[ "${last_msg_ms}" =~ ^[0-9]+$ ]] || return 1

  # last_step: the role of the newest message (assistant/user/tool), parsed
  # from the data JSON string. Degrades to "unknown" if unparseable.
  last_step="$(_jq -r '.[0].data // "" | fromjson? // {} | .role // "unknown"' <<<"${rows}" 2>/dev/null)" || last_step="unknown"
  [[ -n "${last_step}" ]] || last_step="unknown"

  # Build an oldest-first (ascending) CSV of timestamps so the gap-trend
  # helper receives oldest-interval-first.
  timestamps_csv="$(_jq -r '[.[].time_created] | sort | map(tostring) | join(",")' <<<"${rows}" 2>/dev/null)" || timestamps_csv="${last_msg_ms}"

  printf '%s\t%s\t%s' "${last_msg_ms}" "${last_step}" "${timestamps_csv}"
}

# PURE: turn an oldest-first CSV of millisecond timestamps into the
# inter-message intervals (seconds), oldest-interval-first. Prints one per line.
intervals_from_timestamps() {
  local -r csv="$1"
  local -a arr=()
  local IFS=','
  read -r -a arr <<<"${csv}"
  local i prev=""
  for i in "${arr[@]}"; do
    [[ "${i}" =~ ^[0-9]+$ ]] || continue
    if [[ -n "${prev}" ]]; then
      printf '%s\n' $(( (i - prev) / 1000 ))
    fi
    prev="${i}"
  done
}

# ============================================================================
# WORKTREE FALLBACK (degraded mode)
# ============================================================================

file_mtime_epoch() {
  local path="$1"
  [[ -e "${path}" ]] || { printf '0\n'; return 0; }
  if stat --version >/dev/null 2>&1; then
    stat -c %Y "${path}" 2>/dev/null || printf '0\n'
  else
    stat -f %m "${path}" 2>/dev/null || printf '0\n'
  fi
}

git_last_commit_epoch() {
  _git -C "${ROOT_DIR}" log -1 --format=%ct 2>/dev/null || printf '0\n'
}

tree_mtime_epoch() {
  local dir="$1"
  [[ -d "${dir}" ]] || { printf '0\n'; return 0; }
  local latest item item_epoch
  latest="$(file_mtime_epoch "${dir}")"
  while IFS= read -r -d '' item; do
    item_epoch="$(file_mtime_epoch "${item}")"
    (( item_epoch > latest )) && latest="${item_epoch}"
  done < <(find "${dir}" -type f -print0 2>/dev/null)
  printf '%s\n' "${latest}"
}

# Fallback activity epoch: the most recent of git-commit, worktree mtime, and
# doc/changes mtime (the same signals deliver-ticket.sh used as its primary
# detector before session-traffic liveness). Excludes .git/tmp/.ai/local so
# trivial state writes don't mask a stall.
worktree_fallback_epoch() {
  local latest=0 value item item_epoch
  for value in \
    "$(git_last_commit_epoch)" \
    "$(tree_mtime_epoch "${ROOT_DIR}/doc/changes")"; do
    [[ "${value}" =~ ^[0-9]+$ ]] || value=0
    (( value > latest )) && latest="${value}"
  done
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

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
${APP_NAME} ${APP_VERSION} — opencode session-traffic liveness probe

Usage: ${APP_NAME} <session_id>

Prints a key=value report (stdout):
  seconds_since_last_message=<int>   (most recent of session-tree / git / worktree)
  last_step=<assistant|user|tool|unknown|git-commit|worktree-activity>
  gap_trend=<growing|shrinking|stable>

Exit codes:
  0 - healthy (recent activity from the session tree OR git/worktree)
  1 - stalled (no activity from any signal for >= threshold minutes)
  2 - usage error

Environment:
  CEO_LOOP_STALL_MINUTES     Stall threshold in minutes (default: 10)
  OPENCODE_DB_CMD            Override the opencode DB command (tests)
  OPENCODE_SESSION_LIST_CMD  Override the opencode session-list command (tests)
  ROOT_DIR                   Repo root for the git/worktree signal (default: auto)
EOF
}

# ============================================================================
# MAIN
# ============================================================================
# Fetch + decide inline (no pipes) so set -e/pipefail and variable scope
# behave predictably. `main()` is the testable entry point.
main() {
  local session_id="${1:-}"
  case "${session_id}" in
    -h|--help) usage; exit 0 ;;
    -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
    "") die "Missing session_id. See --help." ;;
  esac
  shift
  [[ $# -eq 0 ]] || die "Unexpected extra arguments. Usage: ${APP_NAME} <session_id>"
  validate_session_id "${session_id}" || die "Invalid session_id: '${session_id}'"

  local -r stall_minutes="${CEO_LOOP_STALL_MINUTES:-${DEFAULT_STALL_MINUTES}}"
  local -r stall_seconds=$(( stall_minutes * 60 ))

  local now_epoch
  now_epoch="$(date +%s)"

  # --- Primary signal: session-message traffic (recursive session tree) ---
  # fetch_recent_messages traverses session.parent_id so traffic from child
  # sessions (PM delegating to @coder / @spec-writer / …) is not a false stall.
  # On any failure/empty/unparseable result, db_seconds_since stays empty and
  # the decision falls through to the git/worktree signal below.
  local db_seconds_since="" db_last_step="unknown" trend="stable"
  local fetched
  if fetched="$(fetch_recent_messages "${session_id}" 2>/dev/null)"; then
    local last_ms csv
    IFS=$'\t' read -r last_ms db_last_step csv <<<"${fetched}"
    if [[ "${last_ms}" =~ ^[0-9]+$ ]]; then
      local last_epoch=$(( last_ms / 1000 ))
      db_seconds_since=$(( now_epoch - last_epoch ))
      (( db_seconds_since < 0 )) && db_seconds_since=0
      local -a ivals=()
      mapfile -t ivals < <(intervals_from_timestamps "${csv}")
      trend="$(compute_gap_trend "${ivals[@]}")"
    fi
  else
    # Degraded: opencode DB unavailable. The git/worktree signal (below) is the
    # only signal; it is always computed, so degraded behavior is unchanged.
    log_warn "opencode DB unavailable; using git/worktree fallback"
  fi

  # --- Secondary signal: git commits + worktree file activity (always run) ---
  # INV-DM-5: if EITHER signal shows recent activity, the session is healthy.
  # This runs ALONGSIDE the DB query (not only as a degraded fallback), so a
  # healthy delivery that the DB can't see (e.g. an active child session whose
  # parent went quiet) is not wrongly killed.
  local wt_epoch wt_seconds_since wt_last_step git_epoch
  wt_epoch="$(worktree_fallback_epoch)"
  [[ "${wt_epoch}" =~ ^[0-9]+$ ]] || wt_epoch=0
  wt_seconds_since=$(( now_epoch - wt_epoch ))
  (( wt_seconds_since < 0 )) && wt_seconds_since=0
  # Label the winning worktree source: a git commit vs. a file-mtime change.
  git_epoch="$(git_last_commit_epoch)"
  [[ "${git_epoch}" =~ ^[0-9]+$ ]] || git_epoch=0
  if (( git_epoch > 0 && git_epoch == wt_epoch )); then
    wt_last_step="git-commit"
  else
    wt_last_step="worktree-activity"
  fi

  # --- Combine: effective liveness = the MOST RECENT signal (min seconds_since) ---
  # Either signal healthy ⇒ session healthy. last_step reflects which signal was
  # the most recent (DB role for the session tree; git-commit/worktree-activity
  # for the fallback signal).
  local seconds_since last_step
  if [[ -n "${db_seconds_since}" ]] && (( db_seconds_since <= wt_seconds_since )); then
    seconds_since="${db_seconds_since}"
    last_step="${db_last_step}"
  else
    seconds_since="${wt_seconds_since}"
    last_step="${wt_last_step}"
  fi

  # Emit the key=value report on stdout.
  printf 'seconds_since_last_message=%s\n' "${seconds_since}"
  printf 'last_step=%s\n' "${last_step}"
  printf 'gap_trend=%s\n' "${trend}"

  if decide_stalled "${seconds_since}" "${stall_seconds}"; then
    return "${EXIT_STALLED}"
  fi
  return 0
}

# Testable main guard.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
