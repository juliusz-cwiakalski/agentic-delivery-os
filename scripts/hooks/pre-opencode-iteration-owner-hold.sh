#!/usr/bin/env bash
# Inactive example hook: keep deferring pre-openCode iterations for as long as an
# owner-declared delivery hold exists.
#
# The hook is a pure gate under the GH-146 / TDR-0002 contract: it either sleeps
# (to defer the spawn) or returns 0 (to proceed); it never writes
# ADOS_HOOK_ENV_V1 output, never creates state, and never signals a session.
#
# It recognises exactly TWO settings:
#   DELIVERY_OS_OWNER_HOLD               non-empty value activates the hold; the
#                                        value is the operator reason
#   DELIVERY_OS_OWNER_HOLD_POLL_SECONDS  poll interval in seconds, default 300,
#                                        accepted range 1-3600; unset/empty/
#                                        whitespace is silent, any other invalid
#                                        value uses 300 with one warning
#
# The two setting names and the marker default below are the current default
# product's resolved names (working name `delivery-os`, brand-derived
# <PREFIX>_OWNER_HOLD in general). An adopter who sets a different working name
# edits those two names and the marker default below, or exports the
# brand-derived <PREFIX>_OWNER_HOLD variable so the environment source matches
# what the typed engine reads.
#
# The marker source is the host root's marker, $HOME/.delivery-os-state/owner-hold
# by default. The hold is host-wide: the typed engine reads it at the host root
# (an absolute <PREFIX>_STATE_DIR when set, otherwise
# <home>/<brand.stateDirectoryName>) and never per project, so one marker stops
# every project on the host. The example accepts NO marker-path override: a
# shell-only path would leave the typed engine unheld.
#
# Condition-function contract (DM-1): a condition is a function named
# howLongToSleepDueTo<Reason>() that echoes exactly ONE non-negative integer to
# stdout = seconds to sleep (0/empty/error = no wait from this condition) and
# emits at most one diagnostic line to stderr. Conditions compose by MAX. The
# owner hold has no expiry and therefore applies NO fixed iteration cap; a
# time-bounded condition appended to the same registry inherits the unbounded
# driver because the hold is the floor.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

readonly OWNER_HOLD_DEFAULT_POLL_SECONDS=300
readonly OWNER_HOLD_MAX_POLL_SECONDS=3600
readonly OWNER_HOLD_MAX_REASON_CHARS=160
readonly OWNER_HOLD_MARKER_PATH="${HOME}/.delivery-os-state/owner-hold"
# Set by main from the parsed setting; a direct condition call uses the default.
OWNER_HOLD_POLL_SECONDS="${OWNER_HOLD_POLL_SECONDS:-300}"

# ============================================================================
# SEAMS — injectable for deterministic testing
# ============================================================================
# Sleep seam: sleeps the given seconds.
_sleep() { sleep "$1"; }

# Marker-reader seam: returns 0 when the fixed marker path exists (stdout = up to
# the first 4 096 characters; the engine's own bound is 4 096 bytes) and 1 when
# it is absent. A non-regular path is present with empty content, so it fails
# closed (active without a reason). Tests redefine this seam; production uses
# bash builtins only.
_owner_hold_marker_read() {
  [[ -e "${OWNER_HOLD_MARKER_PATH}" ]] || return 1
  [[ -f "${OWNER_HOLD_MARKER_PATH}" ]] || return 0
  local content=""
  IFS= read -r -N 4096 content < "${OWNER_HOLD_MARKER_PATH}" 2>/dev/null || true
  printf '%s' "${content}"
  return 0
}

# ============================================================================
# HELPERS
# ============================================================================
_owner_hold_warn() {
  printf '[WARN] (pre-opencode-iteration-owner-hold) %s\n' "$1" >&2
}

# Sanitize a reason to one control-free line of at most 160 characters. The
# value is data only: it is never sourced, evaluated, or used to build a command.
_owner_hold_sanitize() {
  local value="$1"
  # Strip ANSI CSI sequences (the ESC byte is embedded, never a product literal).
  local esc=$'\e'
  value="$(printf '%s' "${value}" | LC_ALL=C sed -E "s/${esc}\\[[0-9;?]*[ -/]*[@-~]//g")"
  value="${value//$'\e'/}"
  # Fold line breaks and tabs to one space, then remove remaining C0/C1 runs.
  value="${value//$'\r'/ }"
  value="${value//$'\n'/ }"
  value="${value//$'\t'/ }"
  value="${value//$'\v'/ }"
  value="${value//$'\f'/ }"
  value="$(printf '%s' "${value}" | LC_ALL=C tr -d '\000-\010\013\014\016-\037\177-\237')"
  # Collapse whitespace runs and trim.
  while [[ "${value}" == *"  "* ]]; do value="${value//  / }"; done
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  [[ -n "${value}" ]] || return 1
  printf '%s' "${value:0:${OWNER_HOLD_MAX_REASON_CHARS}}"
}

# Parse the poll interval once per run. Exact grammar: integer 1..3600.
_owner_hold_poll_seconds() {
  local raw="${DELIVERY_OS_OWNER_HOLD_POLL_SECONDS:-}"
  local stripped="${raw//[[:space:]]/}"
  if [[ -z "${stripped}" ]]; then
    printf '%s' "${OWNER_HOLD_DEFAULT_POLL_SECONDS}"
    return 0
  fi
  if [[ "${raw}" =~ ^[0-9]+$ ]]; then
    local value=$((10#${raw}))
    if (( value >= 1 && value <= OWNER_HOLD_MAX_POLL_SECONDS )); then
      printf '%s' "${value}"
      return 0
    fi
  fi
  _owner_hold_warn "invalid owner-hold poll interval; using ${OWNER_HOLD_DEFAULT_POLL_SECONDS}s"
  printf '%s' "${OWNER_HOLD_DEFAULT_POLL_SECONDS}"
}

# Resolve the fact: environment wins when non-empty; otherwise the fixed marker.
# Sets OWNER_HOLD_SOURCE and OWNER_HOLD_REASON (empty when absent) and returns 0
# when active, 1 when inactive.
_owner_hold_resolve() {
  OWNER_HOLD_SOURCE=""
  OWNER_HOLD_REASON=""
  if [[ -n "${DELIVERY_OS_OWNER_HOLD:-}" ]]; then
    OWNER_HOLD_SOURCE="env"
    OWNER_HOLD_REASON="$(_owner_hold_sanitize "${DELIVERY_OS_OWNER_HOLD}")" || OWNER_HOLD_REASON=""
    return 0
  fi
  local marker
  if ! marker="$(_owner_hold_marker_read)"; then
    return 1
  fi
  OWNER_HOLD_SOURCE="marker"
  local first_line="${marker%%$'\n'*}"
  first_line="${first_line%%$'\r'*}"
  OWNER_HOLD_REASON="$(_owner_hold_sanitize "${first_line}")" || OWNER_HOLD_REASON=""
  return 0
}

# ============================================================================
# CONDITIONS (DM-1)
# ============================================================================
# Echo the poll interval while held and 0 otherwise. It applies to every agent
# and model: an owner pause is provider-independent. No absolute time is used,
# so a clock jump can neither end the hold nor extend a deferral beyond one poll.
howLongToSleepDueToOwnerHold() {
  if _owner_hold_resolve; then
    printf '%s' "${OWNER_HOLD_POLL_SECONDS}"
  else
    printf '0'
  fi
}

# ============================================================================
# CONDITION REGISTRY — the driver takes MAX over these (append a condition)
# ============================================================================
OWNER_HOLD_CONDITIONS=(
  howLongToSleepDueToOwnerHold
)

# ============================================================================
# GENERIC DRIVER (MAX; no fixed iteration cap)
# ============================================================================
main() {
  OWNER_HOLD_POLL_SECONDS="$(_owner_hold_poll_seconds)"
  local max_sleep cond cond_out line
  while true; do
    max_sleep=0
    for cond in "${OWNER_HOLD_CONDITIONS[@]}"; do
      cond_out="$("${cond}")" || cond_out=0
      if [[ "${cond_out}" =~ ^[0-9]+$ ]] && (( cond_out > max_sleep )); then
        max_sleep="${cond_out}"
      fi
    done
    (( max_sleep > 0 )) || return 0
    # Re-resolve in the current shell so the source and reason are visible to the
    # line (the condition runs in a command-substitution subshell).
    _owner_hold_resolve || true
    line="owner-hold (${OWNER_HOLD_SOURCE:-unknown})"
    if [[ -n "${OWNER_HOLD_REASON}" ]]; then
      line="${line}: ${OWNER_HOLD_REASON}"
    fi
    printf '[INFO] (pre-opencode-iteration-owner-hold) %s; sleeping %ss\n' "${line}" "${max_sleep}" >&2
    _sleep "${max_sleep}"
  done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi
