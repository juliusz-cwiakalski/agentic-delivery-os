#!/usr/bin/env bash
# Inactive example hook: defer configured Z.AI Coding Plan sessions during peak
# UTC hours and (opt-in) when the Z.AI token quota is exhausted.
#
# The hook is a pure gate under the GH-146 / TDR-0002 contract: it either sleeps
# (to defer the spawn) or returns 0 (to proceed); it never writes ADOS_HOOK_ENV_V1
# output. It is structured as a generic sleep-driver that takes the MAX across
# registered "condition functions" (DM-1 contract below), sleeps, and re-evaluates
# until no condition returns > 0, so composed waits across elapsed time are correct.
#
# Condition-function contract (DM-1): a condition is a function named
# howLongToSleepDueTo<Reason>() that (a) echoes exactly ONE non-negative integer
# to stdout = seconds to sleep (0/empty/error = no wait from this condition);
# (b) obtains time/HTTP strictly through the seams (_now_utc_epoch, _zai_quota_fetch);
# (c) emits at most one diagnostic line to stderr.
#
# v1 registers two conditions:
#   - howLongToSleepDueToPeakHours         (pure-bash; behavior-preserving)
#   - howLongToSleepDueToQuotaExhaustion   (opt-in via ZAI_API_KEY; fail-open)
#
# Z.AI peak hours: 14:00-18:00 daily (UTC+8) = 06:00-10:00 UTC. GLM-5.2 / GLM-5-
# Turbo consume quota at 3x during peak, 2x off-peak. A configurable buffer is
# added before peak start so a 1-2h delivery does not run into the peak window.
#
# Configurable via environment variables (all optional):
#   ADOS_ZAI_PEAK_START_UTC     peak start, UTC seconds-of-day (default 21600 = 06:00)
#   ADOS_ZAI_PEAK_END_UTC       peak end,   UTC seconds-of-day (default 36000 = 10:00)
#   ADOS_ZAI_BUFFER_SECONDS     pause this many seconds before peak start (default 7200)
#   ZAI_API_KEY                 when non-empty (and jq+curl present) enables quota
#                               checking; read-only to this hook, never logged in full
#   ADOS_ZAI_QUOTA_DISABLED=1   opts out of quota checking even with a key
#   ADOS_ZAI_MAX_SLEEP_LOOPS    defensive cap on the re-eval loop (default 24)
#
# Effective peak pause window: [peak_start - buffer, peak_end); default [04:00, 10:00) UTC.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
# Peak knobs are readonly at source time (re-source in a subshell to override).
readonly ADOS_ZAI_PEAK_START_UTC="${ADOS_ZAI_PEAK_START_UTC:-21600}" # 06:00 UTC
readonly ADOS_ZAI_PEAK_END_UTC="${ADOS_ZAI_PEAK_END_UTC:-36000}"     # 10:00 UTC
readonly ADOS_ZAI_BUFFER_SECONDS="${ADOS_ZAI_BUFFER_SECONDS:-7200}"  # 2h buffer
# ZAI_API_KEY / ADOS_ZAI_QUOTA_DISABLED / ADOS_ZAI_MAX_SLEEP_LOOPS are read at
# runtime (not readonly-blocked) so they can be overridden per invocation.

# ============================================================================
# SEAMS (DM-6) — injectable for deterministic testing
# ============================================================================
# Clock seam: returns current UTC epoch seconds.
_now_utc_epoch() { date -u +%s; }
# Sleep seam: sleeps the given seconds.
_sleep() { sleep "$1"; }

# _zai_quota_fetch — HTTP seam (DM-6). Tests redefine this to return a canned
# (http_code, body) pair. CHOSEN RETURN ENCODING (@coder per Flag-3):
#   prints "<http_code>\n<response_body>" to stdout — the caller takes the first
#   line as the HTTP status and the remainder as the body. A transport / curl /
#   network failure is signalled by http_code "000" (curl's %{http_code} on
#   connection failure) with an empty body. Encoding both fields on stdout (rather
#   than via a global) is deliberate: the caller captures the seam's output with a
#   command substitution, which runs in a subshell where global assignments do not
#   survive.
# Production: a single GET against the Z.AI quota endpoint with a bounded
# --max-time so the hook never hangs on a stalled connection (fails open on
# timeout). Reads $ZAI_API_KEY (present here only when the activation gate passed).
_zai_quota_fetch() {
  local tmp http_code body
  tmp="$(mktemp)"
  # Auth header is fed via curl --config stdin so $ZAI_API_KEY never appears in
  # the curl argv / process table (ps, /proc/<pid>/cmdline). The RETURN trap +
  # guarded rm guarantee the temp file is cleaned up even on interruption
  # mid-fetch. Contract preserved: stdout is "<http_code>\n<body>"; transport
  # failure -> code "000" + empty body.
  trap 'rm -f "${tmp}" 2>/dev/null || true' RETURN
  http_code="$(printf 'header = "Authorization: Bearer %s"\n' "${ZAI_API_KEY}" \
    | curl -sS --max-time 15 --config - \
      -o "${tmp}" -w '%{http_code}' \
      -X GET "https://api.z.ai/api/monitor/usage/quota/limit" \
      -H "Accept: application/json" 2>/dev/null || true)"
  body="$(cat "${tmp}" 2>/dev/null || true)"
  rm -f "${tmp}" 2>/dev/null || true
  printf '%s\n%s' "${http_code}" "${body}"
}

# ============================================================================
# HELPERS (unchanged — called directly by TC-HOOK-015..018)
# ============================================================================
zai_configured_model() {
  case "${ADOS_HOOK_AGENT:-}" in
    ceo) printf '%s' "${OC_ADOS_AGENT_CEO_MODEL:-}" ;;
    pm) printf '%s' "${OC_ADOS_AGENT_PM_MODEL:-}" ;;
    *) printf '' ;;
  esac
}
is_zai_peak_window() {
  local now="$1" seconds_of_day pause_start
  seconds_of_day=$((now % 86400))
  pause_start=$((ADOS_ZAI_PEAK_START_UTC - ADOS_ZAI_BUFFER_SECONDS))
  ((seconds_of_day >= pause_start && seconds_of_day < ADOS_ZAI_PEAK_END_UTC))
}
seconds_until_window_end() {
  local now="$1" seconds_of_day
  seconds_of_day=$((now % 86400))
  printf '%s' "$((ADOS_ZAI_PEAK_END_UTC - seconds_of_day))"
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

# ============================================================================
# LOGGING
# ============================================================================
# Single [WARN] helper for the fail-open catalog and the loop cap. Carries a
# reason CATEGORY only — never the full key, never the raw response body.
_zai_warn() { printf '[WARN] (pre-opencode-iteration-zai) %s\n' "$1" >&2; }

# ============================================================================
# CONDITIONS (DM-1)
# ============================================================================

# Peak-hours condition (behavior-preserving refactor of the prior main() body).
# Returns seconds-until-peak_end when inside the effective pause window
# [peak_start - buffer, peak_end); else 0. Pure-bash: no jq, no network.
howLongToSleepDueToPeakHours() {
  local now
  now="$(_now_utc_epoch)"
  if is_zai_peak_window "${now}"; then
    seconds_until_window_end "${now}"
  else
    printf '0'
  fi
}

# Z.AI token-quota condition (opt-in via ZAI_API_KEY + jq + curl; fail-open).
# On any failure (DM-3 catalog) returns 0 and emits exactly one [WARN] carrying a
# reason category. When not opted in, returns 0 SILENTLY (this is opt-out, not
# failure). nextResetTime is epoch-MILLISECONDS UTC (API-1).
howLongToSleepDueToQuotaExhaustion() {
  # --- Activation gate (DM-4): silent opt-out when not opted in. ---
  local model
  model="$(zai_configured_model)"
  if [[ "${model}" != zai-coding-plan/* ]]; then printf '0'; return 0; fi
  if [[ -z "${ZAI_API_KEY:-}" ]]; then printf '0'; return 0; fi
  if [[ "${ADOS_ZAI_QUOTA_DISABLED:-0}" == "1" ]]; then printf '0'; return 0; fi
  if ! command -v jq >/dev/null 2>&1; then printf '0'; return 0; fi
  if ! command -v curl >/dev/null 2>&1; then printf '0'; return 0; fi

  # --- Fetch via seam (DM-6). Encoding: "<http_code>\n<body>" on stdout. ---
  local fetch_out body http_code
  fetch_out="$(_zai_quota_fetch)"
  if [[ "${fetch_out}" == *$'\n'* ]]; then
    http_code="${fetch_out%%$'\n'*}"
    body="${fetch_out#*$'\n'}"
  else
    http_code="${fetch_out}"
    body=""
  fi

  # --- Transport / HTTP fail-open catalog (DM-3). ---
  case "${http_code}" in
    000 | "") _zai_warn "quota fetch transport failure"; printf '0'; return 0 ;;
    401) _zai_warn "HTTP 401"; printf '0'; return 0 ;;
    403) _zai_warn "HTTP 403"; printf '0'; return 0 ;;
    200) : ;;
    *) _zai_warn "HTTP ${http_code}"; printf '0'; return 0 ;;
  esac

  # --- JSON validity. ---
  if ! printf '%s' "${body}" | jq -e . >/dev/null 2>&1; then
    _zai_warn "malformed JSON"
    printf '0'
    return 0
  fi

  # --- Envelope: code==200 AND success==true. ---
  local env_ok
  env_ok="$(printf '%s' "${body}" | jq -r 'if (.code == 200 and .success == true) then "ok" else "bad" end' 2>/dev/null || true)"
  if [[ "${env_ok}" != "ok" ]]; then
    _zai_warn "non-200 envelope"
    printf '0'
    return 0
  fi

  # --- data.limits must be an array (absent / non-array -> fail-open). ---
  local limits_type
  limits_type="$(printf '%s' "${body}" | jq -r '.data.limits | type' 2>/dev/null || true)"
  if [[ "${limits_type}" != "array" ]]; then
    _zai_warn "data.limits absent or non-array"
    printf '0'
    return 0
  fi

  # --- Gather TOKENS_LIMIT (percentage, nextResetTime) pairs (API-1 / DM-2). ---
  # Each line: "<percentage>\t<nextResetTime>"; values via jq tostring (null -> "null").
  # TIME_LIMIT entries are filtered out (NG-4).
  local raw
  raw="$(printf '%s' "${body}" | jq -r '
    [.data.limits[] | select(.type == "TOKENS_LIMIT")] | .[] |
    "\(.percentage | tostring)\t\(.nextResetTime | tostring)"
  ' 2>/dev/null || true)"

  local now pct reset wait_s
  local has_exhausted=0 has_valid_reset=0
  local min_wait=""
  now="$(_now_utc_epoch)"

  while IFS=$'\t' read -r pct reset; do
    if [[ -z "${pct}" ]]; then continue; fi
    # Non-numeric percentage -> cannot evaluate exhaustion safely -> fail-open (DM-3).
    if [[ ! "${pct}" =~ ^[0-9]+$ ]]; then
      _zai_warn "non-numeric percentage"
      printf '0'
      return 0
    fi
    if ((pct >= 100)); then
      has_exhausted=1
      if [[ "${reset}" =~ ^[0-9]+$ ]]; then
        wait_s=$((reset / 1000 - now))
        if ((wait_s < 0)); then wait_s=0; fi
        has_valid_reset=1
        if [[ -z "${min_wait}" ]] || ((wait_s < min_wait)); then
          min_wait="${wait_s}"
        fi
      fi
      # else: exhausted entry with absent/malformed reset — skip; another exhausted
      # entry may still yield a valid reset (TC-ZAI-038). No WARN here.
    fi
  done <<< "${raw}"

  # No exhausted TOKENS_LIMIT -> proceed (NOT fail-open; no WARN).
  if ((has_exhausted == 0)); then
    printf '0'
    return 0
  fi
  # Exhausted but no entry yields a valid reset -> fail-open.
  if ((has_valid_reset == 0)); then
    _zai_warn "exhausted entry with no valid nextResetTime"
    printf '0'
    return 0
  fi
  printf '%s' "${min_wait}"
}

# ============================================================================
# CONDITION REGISTRY — the driver takes MAX over these (add a condition = append)
# ============================================================================
readonly -a ADOS_ZAI_CONDITIONS=(
  howLongToSleepDueToPeakHours
  howLongToSleepDueToQuotaExhaustion
)

# ============================================================================
# GENERIC DRIVER (DM-5)
# ============================================================================
main() {
  local model
  model="$(zai_configured_model)"
  # Gate: only zai-coding-plan/* models are evaluated (AC-F1-1).
  [[ "${model}" == zai-coding-plan/* ]] || return 0

  local -r max_loops="${ADOS_ZAI_MAX_SLEEP_LOOPS:-24}"
  local loop_count=0
  local cond cond_out max_sleep now wake reason name
  local -a active_names

  while true; do
    # Evaluate every condition fresh; take the MAX non-negative integer returned.
    max_sleep=0
    active_names=()
    for cond in "${ADOS_ZAI_CONDITIONS[@]}"; do
      cond_out="$("${cond}")" || cond_out=0
      if [[ "${cond_out}" =~ ^[0-9]+$ ]] && ((cond_out > 0)); then
        if ((cond_out > max_sleep)); then max_sleep="${cond_out}"; fi
        active_names+=("${cond}")
      fi
    done

    if ((max_sleep == 0)); then
      return 0
    fi

    # Defensive re-eval cap (NFR-6): <= max_loops sleeps, then one WARN + return 0.
    if ((loop_count >= max_loops)); then
      _zai_warn "sleep-loop cap reached (${max_loops}); proceeding"
      return 0
    fi

    now="$(_now_utc_epoch)"
    wake="$(format_utc_epoch "$((now + max_sleep))")"
    reason=""
    for name in "${active_names[@]}"; do
      case "${name}" in
        howLongToSleepDueToPeakHours) name="peak-hours" ;;
        howLongToSleepDueToQuotaExhaustion) name="quota-exhaustion" ;;
      esac
      reason="${reason:+${reason}, }${name}"
    done
    printf '[INFO] (pre-opencode-iteration-zai) %s; waiting until %s\n' "${reason}" "${wake}" >&2
    _sleep "${max_sleep}"
    loop_count=$((loop_count + 1))
  done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi
