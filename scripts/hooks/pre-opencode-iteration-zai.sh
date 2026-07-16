#!/usr/bin/env bash
# Inactive example: defer configured Z.AI Coding Plan sessions during peak UTC.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

_now_utc_epoch() { date -u +%s; }
_sleep() { sleep "$1"; }
zai_configured_model() {
  case "${ADOS_HOOK_AGENT:-}" in
    ceo) printf '%s' "${OC_ADOS_AGENT_CEO_MODEL:-}" ;;
    pm) printf '%s' "${OC_ADOS_AGENT_PM_MODEL:-}" ;;
    *) printf '' ;;
  esac
}
is_zai_peak_window() {
  local now="$1" seconds_of_day
  seconds_of_day=$(( now % 86400 ))
  (( seconds_of_day >= 16200 && seconds_of_day < 36000 ))
}
seconds_until_window_end() {
  local now="$1" seconds_of_day
  seconds_of_day=$(( now % 86400 ))
  printf '%s' "$(( 36000 - seconds_of_day ))"
}
main() {
  local model now wait_seconds wake
  model="$(zai_configured_model)"
  [[ "${model}" == zai-coding-plan/* ]] || return 0
  now="$(_now_utc_epoch)"
  is_zai_peak_window "${now}" || return 0
  wait_seconds="$(seconds_until_window_end "${now}")"
  wake="$(date -u -d "@$(($now + $wait_seconds))" '+%Y-%m-%dT%H:%M:%SZ')"
  printf '[INFO] (pre-opencode-iteration-zai) zai-coding-plan peak window; waiting until %s\n' "${wake}" >&2
  _sleep "${wait_seconds}"
}
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi
