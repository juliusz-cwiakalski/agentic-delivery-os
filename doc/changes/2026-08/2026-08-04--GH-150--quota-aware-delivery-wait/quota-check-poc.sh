#!/usr/bin/env bash
# =============================================================================
# POC — Z.AI Coding Plan quota diagnostic (GH-150)
# =============================================================================
# Research-validation artifact. NOT production code.
#
# Purpose: query the Z.AI quota endpoint with your Coding Plan key and print:
#   1. HTTP status
#   2. Best-effort per-window breakdown (usage %, reset/end time, time remaining)
#   3. The RAW response body (always — for debugging; contains NO secret)
#
# Usage:
#   ZAI_API_KEY="…" bash quota-check-poc.sh
#
# Dependencies: curl, jq, date
# =============================================================================
set -Eeuo pipefail

readonly ENDPOINT="https://api.z.ai/api/monitor/usage/quota/limit"

die() { printf '[ERROR] %s\n' "$*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

# epoch-ms -> ISO-8601 UTC (portable: GNU then BSD date)
iso_from_ms() {
  local sec
  sec=$(( $1 / 1000 ))
  date -u -d "@$sec" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
    || date -u -r "$sec" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
    || printf '@%s' "$sec"
}
now_ms() { local s; s="$(date -u +%s)"; printf '%s000' "$s"; }
isnum() { [[ "${1:-}" =~ ^[0-9]+$ ]]; }

[[ -n "${ZAI_API_KEY:-}" ]] || die "ZAI_API_KEY env var is required (https://z.ai/manage-apikey/apikey-list)"
require_cmd curl
require_cmd jq

printf 'Endpoint : %s\n' "$ENDPOINT"
printf 'Key      : %s…%s\n' "${ZAI_API_KEY:0:4}" "${ZAI_API_KEY: -2}"
printf '\n'

# --- query (capture body + http code in one call) ---------------------------
tmp="$(mktemp)"
http_code="$(curl -sS -o "$tmp" -w '%{http_code}' -X GET "$ENDPOINT" \
  -H "Authorization: Bearer ${ZAI_API_KEY}" \
  -H "Accept: application/json" || true)"
body="$(cat "$tmp" 2>/dev/null || true)"; rm -f "$tmp"

printf 'HTTP     : %s\n' "$http_code"
if [[ -z "$body" ]]; then
  printf '[ERROR] empty response body (auth/network failure?)\n' >&2
  exit 1
fi
printf '\n'

# --- per-window breakdown (best-effort, null-tolerant) ----------------------
printf '===== PER-WINDOW BREAKDOWN =====\n'
limits_count="$(printf '%s' "$body" | jq -r '[.data.limits[]?] | length' 2>/dev/null || echo 0)"
if [[ "$limits_count" -eq 0 ]]; then
  printf 'No .data.limits entries found — response shape may differ. See RAW RESPONSE below.\n'
else
  now="$(now_ms)"
  for (( i=0; i<limits_count; i++ )); do
    entry="$(printf '%s' "$body" | jq -r ".data.limits[$i]")"
    type_v="$(printf '%s' "$entry" | jq -r '.type // "?"')"
    wl="$(printf '%s'    "$entry" | jq -r '.window_length // empty')"
    limit_v="$(printf '%s' "$entry" | jq -r '.limit // empty')"
    used_v="$(printf '%s'  "$entry" | jq -r '.used // empty')"
    rem_v="$(printf '%s'   "$entry" | jq -r '.remaining // empty')"
    reset_ms="$(printf '%s' "$entry" | jq -r '.reset_time // empty')"

    printf '\n[window %s] type=%s\n' "$i" "$type_v"
    printf '  raw entry: %s\n' "$(printf '%s' "$entry" | jq -c '.')"

    case "$wl" in
      18000)  printf '  window   : 5-hour (rolling)\n' ;;
      604800) printf '  window   : weekly (7-day)\n' ;;
      "")     printf '  window   : (window_length absent)\n' ;;
      *)      printf '  window   : %ss\n' "$wl" ;;
    esac

    isnum "$limit_v" && printf '  limit    : %s\n' "$limit_v" || printf '  limit    : (absent)\n'
    isnum "$used_v"  && printf '  used     : %s\n' "$used_v"  || printf '  used     : (absent)\n'
    isnum "$rem_v"   && printf '  remaining: %s\n' "$rem_v"   || printf '  remaining: (absent)\n'

    if isnum "$used_v" && isnum "$limit_v" && (( limit_v > 0 )); then
      pct="$(awk -v u="$used_v" -v l="$limit_v" 'BEGIN{ printf "%.1f", u/l*100 }')"
      printf '  %%used    : %s%%\n' "$pct"
      if (( used_v >= limit_v )); then printf '  state    : EXHAUSTED\n'; else printf '  state    : OK\n'; fi
    fi

    if isnum "$reset_ms"; then
      printf '  reset ms : %s\n' "$reset_ms"
      printf '  reset    : %s (UTC)\n' "$(iso_from_ms "$reset_ms")"
      if (( reset_ms > now )); then
        diff=$(( reset_ms - now ))
        printf '  ends in  : %s seconds (%s hours)\n' "$diff" "$(awk -v d="$diff" 'BEGIN{ printf "%.2f", d/3600 }')"
      else
        printf '  ends in  : reset_time is in the past (likely already reset)\n'
      fi
    else
      printf '  reset    : (reset_time absent — rolling window; no fixed end time)\n'
    fi
  done
fi
printf '\n'

# --- raw response (always, for debugging) -----------------------------------
printf '===== RAW RESPONSE =====\n'
if printf '%s' "$body" | jq -e . >/dev/null 2>&1; then
  printf '%s\n' "$body" | jq '.'
else
  printf '%s\n' "$body"
fi
printf '===== END RAW RESPONSE =====\n'
