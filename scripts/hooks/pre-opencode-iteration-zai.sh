#!/usr/bin/env bash
# Inactive example: defer configured Z.AI Coding Plan sessions during peak UTC.
#
# Z.AI peak hours (from Z.AI documentation):
#   14:00–18:00 daily (UTC+8) = 06:00–10:00 UTC
#   GLM-5.2 and GLM-5-Turbo consume quota at 3x during peak, 2x off-peak.
#
# This hook adds a configurable buffer BEFORE peak start so that a delivery
# that typically takes 1–2 hours does not run into the peak window.
#
# Configurable via environment variables (all optional):
#   ADOS_ZAI_PEAK_START_UTC   — peak start in UTC seconds-of-day (default: 21600 = 06:00 UTC)
#   ADOS_ZAI_PEAK_END_UTC     — peak end in UTC seconds-of-day   (default: 36000 = 10:00 UTC)
#   ADOS_ZAI_BUFFER_SECONDS   — pause this many seconds before peak start (default: 5400 = 1.5h)
#
# Effective pause window: [peak_start - buffer, peak_end)
# Default: [04:30 UTC, 10:00 UTC)
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# Z.AI peak hours: 14:00–18:00 UTC+8 = 06:00–10:00 UTC
readonly ADOS_ZAI_PEAK_START_UTC="${ADOS_ZAI_PEAK_START_UTC:-21600}"  # 06:00 UTC
readonly ADOS_ZAI_PEAK_END_UTC="${ADOS_ZAI_PEAK_END_UTC:-36000}"      # 10:00 UTC
# Buffer: start pausing earlier because delivery takes 1–2h
readonly ADOS_ZAI_BUFFER_SECONDS="${ADOS_ZAI_BUFFER_SECONDS:-5400}"   # 1.5h

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
  local now="$1" seconds_of_day pause_start
  seconds_of_day=$(( now % 86400 ))
  pause_start=$(( ADOS_ZAI_PEAK_START_UTC - ADOS_ZAI_BUFFER_SECONDS ))
  (( seconds_of_day >= pause_start && seconds_of_day < ADOS_ZAI_PEAK_END_UTC ))
}
seconds_until_window_end() {
  local now="$1" seconds_of_day
  seconds_of_day=$(( now % 86400 ))
  printf '%s' "$(( ADOS_ZAI_PEAK_END_UTC - seconds_of_day ))"
}
format_utc_epoch() {
  # Pure Gregorian conversion: avoids GNU `date -d` and BSD `date -r` divergence.
  local epoch="$1" days seconds z era doe yoe year doy mp month day hour minute second
  days=$(( epoch / 86400 )); seconds=$(( epoch % 86400 ))
  z=$(( days + 719468 )); era=$(( z / 146097 )); doe=$(( z - era * 146097 ))
  yoe=$(( (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365 )); year=$(( yoe + era * 400 ))
  doy=$(( doe - (365 * yoe + yoe / 4 - yoe / 100) )); mp=$(( (5 * doy + 2) / 153 ))
  day=$(( doy - (153 * mp + 2) / 5 + 1 )); month=$(( mp + (mp < 10 ? 3 : -9) )); year=$(( year + (month <= 2) ))
  hour=$(( seconds / 3600 )); minute=$(( (seconds % 3600) / 60 )); second=$(( seconds % 60 ))
  printf '%04d-%02d-%02dT%02d:%02d:%02dZ' "${year}" "${month}" "${day}" "${hour}" "${minute}" "${second}"
}
main() {
  local model now wait_seconds wake
  model="$(zai_configured_model)"
  [[ "${model}" == zai-coding-plan/* ]] || return 0
  now="$(_now_utc_epoch)"
  is_zai_peak_window "${now}" || return 0
  wait_seconds="$(seconds_until_window_end "${now}")"
  wake="$(format_utc_epoch "$((now + wait_seconds))")"
  printf '[INFO] (pre-opencode-iteration-zai) zai-coding-plan peak window; waiting until %s\n' "${wake}" >&2
  _sleep "${wait_seconds}"
}
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi
