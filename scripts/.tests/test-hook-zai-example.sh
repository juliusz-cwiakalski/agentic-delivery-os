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
readonly JAN_1_2026=1767225600
test_boundaries() { ! is_zai_peak_window "$((JAN_1_2026 + 16199))" && is_zai_peak_window "$((JAN_1_2026 + 16200))" && is_zai_peak_window "$((JAN_1_2026 + 35999))" && ! is_zai_peak_window "$((JAN_1_2026 + 36000))"; }
test_duration() { [[ "$(seconds_until_window_end "$((JAN_1_2026 + 16200))")" == 19800 && "$(seconds_until_window_end "$((JAN_1_2026 + 35999))")" == 1 ]]; }
test_model_selection() { ADOS_HOOK_AGENT=ceo; OC_ADOS_AGENT_CEO_MODEL=zai-coding-plan/x; [[ "$(zai_configured_model)" == zai-coding-plan/x ]] || return 1; ADOS_HOOK_AGENT=pm; OC_ADOS_AGENT_PM_MODEL=other/x; [[ "$(zai_configured_model)" == other/x ]]; }
test_portable_wake_formatter() { [[ "$(format_utc_epoch "$((JAN_1_2026 + 36000))")" == '2026-01-01T10:00:00Z' ]] || return 1; [[ "$(format_utc_epoch 0)" == '1970-01-01T00:00:00Z' ]] || return 1; ! grep -q 'date -.*-d' "${SCRIPT_DIR}/hooks/pre-opencode-iteration-zai.sh"; }
check 'TC-HOOK-016 UTC boundaries' test_boundaries
check 'TC-HOOK-017 seconds until window end' test_duration
check 'TC-HOOK-018 reads configured agent value only' test_model_selection
check 'TC-HOOK-015 portable UTC wake formatter' test_portable_wake_formatter
printf 'Results: %d passed, %d failed\n' "${pass}" "${fail}"
(( fail == 0 ))
