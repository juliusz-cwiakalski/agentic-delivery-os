#!/usr/bin/env bash
# Tests the inactive Z.AI pre-iteration hook without real sleeps.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/hooks/pre-opencode-iteration-zai.sh"

pass=0; fail=0
check() { if "$2"; then printf '[PASS] %s\n' "$1"; ((++pass)); else printf '[FAIL] %s\n' "$1" >&2; ((++fail)); fi; }
at() { date -u -d "$1" +%s; }
test_boundaries() { ! is_zai_peak_window "$(at '2026-01-01 04:29:59')" && is_zai_peak_window "$(at '2026-01-01 04:30:00')" && is_zai_peak_window "$(at '2026-01-01 09:59:59')" && ! is_zai_peak_window "$(at '2026-01-01 10:00:00')"; }
test_duration() { [[ "$(seconds_until_window_end "$(at '2026-01-01 04:30:00')")" == 19800 && "$(seconds_until_window_end "$(at '2026-01-01 09:59:59')")" == 1 ]]; }
test_model_selection() { ADOS_HOOK_AGENT=ceo; OC_ADOS_AGENT_CEO_MODEL=zai-coding-plan/x; [[ "$(zai_configured_model)" == zai-coding-plan/x ]] || return 1; ADOS_HOOK_AGENT=pm; OC_ADOS_AGENT_PM_MODEL=other/x; [[ "$(zai_configured_model)" == other/x ]]; }
check 'TC-HOOK-016 UTC boundaries' test_boundaries
check 'TC-HOOK-017 seconds until window end' test_duration
check 'TC-HOOK-018 reads configured agent value only' test_model_selection
printf 'Results: %d passed, %d failed\n' "${pass}" "${fail}"
(( fail == 0 ))
