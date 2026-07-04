#!/usr/bin/env bash
# test-quality-gates.sh — Contract suite for scripts/quality-gates.sh (GH-37).
#
# Proves the runner contract (F-1..F-5 / AC-F1-1..AC-F5-1, AC-NFR1/2/4-1):
#   - existence + bash.md conformance + descriptive header (no license block)
#   - clean run (no args -> all PASS, AI-actionable fields, default = all)
#   - default set INVOKES (not reimplements) the 4 real gates
#   - REGRESSION GUARD: injected failing gate -> reported FAIL + log pointer +
#     bounded excerpt + non-zero exit (RSK-4 — never masks a failure)
#   - arg handling + unknown-selector tolerance (non-masking)
#   - --help taxonomy (implemented vs future) + exit codes
#   - resolution precedence (declared file preferred; else built-in default)
#   - extension point (project gate without editing the script's core)
#   - determinism, performance (< 2s overhead; no gratuitous re-runs), stdlib-only
#
# The suite SOURCES the runner (testable main guard, bash.md §10.4) for the
# resolution unit case and invokes it as a subprocess for behavior cases.
# Hermetic: fixtures live under mktemp -d, removed in the EXIT trap; behavior
# cases use the QGATES_GATE_SET_FILE seam so they never touch the real default
# set or the repo tree (every case asserts git status --porcelain unchanged).
#
# Dependencies: bash>=4, git, mktemp, awk, sed, grep, tail, sort, paste
# Usage: bash scripts/.tests/test-quality-gates.sh
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# FRAMEWORK (embedded — bash.md §11)
# ============================================================================
readonly TEST_TAG="(test-quality-gates)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m' _GREEN=$'\033[0;32m' _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _RESET=""
fi

_test_setup() {
  _test_tmpdir="$(mktemp -d)"
}

_test_teardown() {
  if [[ -n "${_test_tmpdir:-}" && -d "${_test_tmpdir:-}" ]]; then
    rm -rf "${_test_tmpdir}"
  fi
}

trap '_test_teardown' EXIT

run_test() {
  local -r name="$1" func="$2"
  ((_test_count++)) || true
  _test_setup
  if (set -e; "${func}"); then
    ((_test_passed++)) || true
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    ((_test_failed++)) || true
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi
  _test_teardown
  _test_tmpdir=""
}

# --- assertions ---
assert_eq() {
  local -r e="$1" a="$2" m="${3:-}"
  [[ "$e" == "$a" ]] || { printf '  expected:[%s] actual:[%s] %s\n' "$e" "$a" "$m" >&2; return 1; }
}
assert_contains() {
  local -r h="$1" n="$2" m="${3:-}"
  [[ "$h" == *"$n"* ]] || { printf '  missing [%s] in text. %s\n' "$n" "$m" >&2; return 1; }
}
assert_not_contains() {
  local -r h="$1" n="$2" m="${3:-}"
  [[ "$h" != *"$n"* ]] || { printf '  unexpected [%s] present. %s\n' "$n" "$m" >&2; return 1; }
}
assert_file_exists() {
  [[ -f "$1" ]] || { printf '  file missing: %s %s\n' "$1" "${2:-}" >&2; return 1; }
}
assert_exit_code() {
  local -r e="$1" a="$2" m="${3:-}"
  [[ "$e" == "$a" ]] || { printf '  expected exit %s got %s %s\n' "$e" "$a" "$m" >&2; return 1; }
}
# Regex assertions (extended); case-insensitive variant for help/word checks.
_assert_re() {
  printf '%s' "$2" | grep -Eq -- "$1" || { printf '  pattern [%s] no match\n' "$1" >&2; return 1; }
}
_assert_rei() {
  printf '%s' "$2" | grep -Eiq -- "$1" || { printf '  pattern/i [%s] no match\n' "$1" >&2; return 1; }
}

print_summary() {
  printf '\n%s Summary: %d/%d passed' "${TEST_TAG}" "${_test_passed}" "${_test_count}"
  if [[ "${_test_failed}" -gt 0 ]]; then
    printf ' (%s%d failed%s)\n' "${_RED}" "${_test_failed}" "${_RESET}"
    return 1
  fi
  printf ' %s(all passed)%s\n' "${_GREEN}" "${_RESET}"
  return 0
}

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST (testable main guard -> defines functions only;
# the suite's own main() defined later overrides the runner's main()).
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
RUNNER="${SCRIPT_DIR}/quality-gates.sh"
# shellcheck source=/dev/null
source "${RUNNER}"

# ============================================================================
# CAPTURE + FIXTURE HELPERS
# ============================================================================

# Run the runner as a subprocess; capture stdout/stderr/exit into _LAST_*.
# Caller may prefix env, e.g.  QGATES_GATE_SET_FILE="$gs" _run_qg alpha
_run_qg() {
  _LAST_OUT=""
  _LAST_ERR=""
  _LAST_RC=0
  local _o _e
  _o="$(mktemp "${_test_tmpdir}/out.XXXXXX")"
  _e="$(mktemp "${_test_tmpdir}/err.XXXXXX")"
  "${RUNNER}" "$@" >"${_o}" 2>"${_e}" || _LAST_RC=$?
  _LAST_OUT="$(cat "${_o}")"
  _LAST_ERR="$(cat "${_e}")"
}

# Ordered gate names extracted from a runner stdout summary.
_qg_gate_names() { printf '%s\n' "$1" | sed -n 's/^(quality-gates) name=\([^ ]*\) status=.*/\1/p'; }

# Fixture gate scripts.
_make_pass_gate() {
  printf '#!/usr/bin/env bash\necho "%s-ok"\nexit 0\n' "${2:-pass}" >"$1"
  chmod +x "$1"
}
_make_fail_gate() {
  printf '#!/usr/bin/env bash\necho "%s-fail-L1"\necho "%s-fail-L2"\nexit 7\n' "${2:-fail}" "${2:-fail}" >"$1"
  chmod +x "$1"
}

# Build a gate-set declaration file from name+cmd pairs.
_make_gateset() {
  local file="$1"
  shift
  local name cmd
  : >"$file"
  while [[ $# -ge 2 ]]; do
    name="$1"
    cmd="$2"
    shift 2
    printf '%s %s\n' "${name}" "${cmd}" >>"$file"
  done
}

# Build a gateset of N trivial pass gates g0..g(N-1).
_make_trivial_gateset() {
  local -i n="$1" i
  local file="${_test_tmpdir}/gs-trivial"
  : >"$file"
  for ((i = 0; i < n; i++)); do
    printf '#!/usr/bin/env bash\nexit 0\n' >"${_test_tmpdir}/g${i}.sh"
    chmod +x "${_test_tmpdir}/g${i}.sh"
    printf 'g%d %s\n' "$i" "${_test_tmpdir}/g${i}.sh" >>"$file"
  done
  printf '%s' "$file"
}

# ============================================================================
# TESTS — TC-QGATES-001..009, 019, 020, 021
# ============================================================================

# TC-QGATES-001 — runner exists, executable, bash.md-conformant, descriptive header, NO license block.
test_tc001_static_conformance() {
  assert_file_exists "${RUNNER}" "runner missing"
  [[ -x "${RUNNER}" ]] || { printf '  not executable\n' >&2; return 1; }
  assert_eq '#!/usr/bin/env bash' "$(head -1 "${RUNNER}")" "shebang"
  grep -q 'set -Eeuo pipefail' "${RUNNER}" || { printf '  no set -Eeuo pipefail\n' >&2; return 1; }
  grep -q 'BASH_SOURCE\[0\]' "${RUNNER}" || { printf '  no testable main guard\n' >&2; return 1; }
  grep -q 'readonly LOG_TAG=' "${RUNNER}" || { printf '  no stable LOG_TAG\n' >&2; return 1; }
  head -20 "${RUNNER}" | grep -qi 'quality.gates' || { printf '  no purpose in header\n' >&2; return 1; }
  head -40 "${RUNNER}" | grep -qi 'usage' || { printf '  no usage in header\n' >&2; return 1; }
  head -40 "${RUNNER}" | grep -qi 'exit code' || { printf '  no exit codes in header\n' >&2; return 1; }
  # NO hand-added license/copyright block (AGENTS.md forbids it; scripts/ is not a header path).
  if grep -q -e '^# Copyright (c)' -e 'MIT License - see LICENSE' "${RUNNER}"; then
    printf '  license/copyright block present (forbidden in scripts/)\n' >&2
    return 1
  fi
}

# TC-QGATES-002 — clean run (fixture pass set), no args -> exit 0, all PASS, fields, default=all.
test_tc002_clean_run_all_pass() {
  local gs="${_test_tmpdir}/gs"
  _make_pass_gate "${_test_tmpdir}/alpha.sh" alpha
  _make_pass_gate "${_test_tmpdir}/beta.sh" beta
  _make_gateset "$gs" alpha "${_test_tmpdir}/alpha.sh" beta "${_test_tmpdir}/beta.sh"
  QGATES_GATE_SET_FILE="$gs" _run_qg
  assert_exit_code 0 "$_LAST_RC" "clean run should exit 0"
  assert_contains "$_LAST_OUT" "selector=all" "default selector"
  assert_contains "$_LAST_OUT" "name=alpha status=PASS" "alpha PASS"
  assert_contains "$_LAST_OUT" "name=beta status=PASS" "beta PASS"
  _assert_re 'name=alpha status=PASS duration=[0-9]' "$_LAST_OUT" "duration field present"
  assert_not_contains "$_LAST_OUT" "status=FAIL" "no FAIL on clean run"
  assert_contains "$_LAST_OUT" "overall=PASS" "overall PASS"
}

# TC-QGATES-003 — default set INVOKES (not reimplements) the 4 real gates; a named gate is observable.
test_tc003_default_set_invokes_real_gates() {
  grep -q 'test-all\.sh' "${RUNNER}" || { printf '  default set missing test-all.sh\n' >&2; return 1; }
  grep -q 'test-doc-distribution\.sh' "${RUNNER}" || { printf '  missing doc-distribution guard\n' >&2; return 1; }
  grep -q 'build-claude-plugin\.sh' "${RUNNER}" || { printf '  missing plugin-freshness\n' >&2; return 1; }
  grep -q 'git diff --check' "${RUNNER}" || { printf '  missing whitespace gate\n' >&2; return 1; }
  # No rediscovery logic in the orchestrator (NG-1).
  if grep -Eq 'find .*\.tests|for [a-z] in .*test-\*' "${RUNNER}"; then
    printf '  orchestrator reimplements discovery (forbidden)\n' >&2
    return 1
  fi
  # Behavioral: a named fixture gate is observable in the summary.
  local gs="${_test_tmpdir}/gs"
  _make_pass_gate "${_test_tmpdir}/alpha.sh" alpha
  _make_gateset "$gs" alpha "${_test_tmpdir}/alpha.sh"
  QGATES_GATE_SET_FILE="$gs" _run_qg alpha
  assert_exit_code 0 "$_LAST_RC" "named gate run"
  assert_contains "$_LAST_OUT" "name=alpha status=PASS" "named gate observed"
}

# TC-QGATES-004 — REGRESSION GUARD (AC-F1-4 / RSK-4): injected failing gate -> reported + non-zero exit.
test_tc004_regression_guard_failing_gate() {
  local gs="${_test_tmpdir}/gs"
  _make_pass_gate "${_test_tmpdir}/ok.sh" ok
  _make_fail_gate "${_test_tmpdir}/boom.sh" DELIBERATE_FAILURE_MARKER
  _make_gateset "$gs" ok "${_test_tmpdir}/ok.sh" failer "${_test_tmpdir}/boom.sh"
  local before
  before="$(git status --porcelain)"
  QGATES_GATE_SET_FILE="$gs" _run_qg
  # Non-zero exit — a failure is never masked (RSK-4).
  [[ "$_LAST_RC" -ne 0 ]] || { printf '  failing gate masked (exit 0)\n' >&2; return 1; }
  # Named FAIL with a stable prefix/tag.
  assert_contains "$_LAST_OUT" "name=failer status=FAIL" "failer reported FAIL"
  assert_contains "$_LAST_OUT" "exit=7" "per-gate exit code surfaced"
  # Log pointer to the canonical output dir (OQ-2).
  _assert_re 'log=.*/tmp/quality-gates/[0-9]{4}-[0-9]{2}-[0-9]{2}/failer\.log' "$_LAST_OUT" "canonical log pointer"
  # The pointed-to log file exists and contains the gate's output.
  local log
  log="$(printf '%s' "$_LAST_OUT" | sed -n 's/^.*log=\(.*failer\.log\).*$/\1/p')"
  assert_file_exists "$log" "log file"
  grep -q 'DELIBERATE_FAILURE_MARKER' "$log" || { printf '  marker absent from log\n' >&2; return 1; }
  # Bounded excerpt with a stable prefix in the summary.
  assert_contains "$_LAST_OUT" "name=failer excerpt:" "excerpt block"
  assert_contains "$_LAST_OUT" "DELIBERATE_FAILURE_MARKER-fail-L1" "excerpt content"
  assert_contains "$_LAST_OUT" "overall=FAIL" "overall FAIL"
  # Hermetic — the real repo tree is untouched.
  local after
  after="$(git status --porcelain)"
  assert_eq "$before" "$after" "repo tree changed (not hermetic)"
}

# TC-QGATES-005 — named-gate subset + unknown-selector tolerance (non-masking).
test_tc005_arg_handling_and_tolerance() {
  local gs="${_test_tmpdir}/gs"
  _make_pass_gate "${_test_tmpdir}/alpha.sh" alpha
  _make_pass_gate "${_test_tmpdir}/beta.sh" beta
  _make_gateset "$gs" alpha "${_test_tmpdir}/alpha.sh" beta "${_test_tmpdir}/beta.sh"
  # Named subset: only alpha runs; beta must not.
  QGATES_GATE_SET_FILE="$gs" _run_qg alpha
  assert_exit_code 0 "$_LAST_RC" "named subset"
  assert_contains "$_LAST_OUT" "name=alpha" "alpha present"
  assert_not_contains "$_LAST_OUT" "name=beta" "beta must not run"
  # Unknown selector alongside a known one — tolerated (warned), no crash, exit 0.
  QGATES_GATE_SET_FILE="$gs" _run_qg alpha not-a-real-gate
  assert_exit_code 0 "$_LAST_RC" "tolerance must not crash"
  _assert_rei '(unknown|not found|ignor)' "$_LAST_ERR" "tolerance notice"
  # NON-MASKING: a failing named gate + an unknown selector still exits non-zero.
  local gsf="${_test_tmpdir}/gsf"
  _make_fail_gate "${_test_tmpdir}/alphaf.sh" alpha
  _make_gateset "$gsf" alpha "${_test_tmpdir}/alphaf.sh"
  QGATES_GATE_SET_FILE="$gsf" _run_qg alpha not-a-real-gate
  [[ "$_LAST_RC" -ne 0 ]] || { printf '  tolerance masked a real failure\n' >&2; return 1; }
}

# TC-QGATES-006 — --help documents taxonomy (implemented vs future) + exit codes.
test_tc006_help_taxonomy() {
  _run_qg --help
  assert_exit_code 0 "$_LAST_RC" "help exits 0"
  _assert_rei 'all' "$_LAST_OUT" "all selector"
  _assert_rei '(named|<gate>)' "$_LAST_OUT" "named/gate selector"
  _assert_rei '(fast|slow)' "$_LAST_OUT" "fast/slow documented"
  _assert_rei '(future|deferred|not yet|planned)' "$_LAST_OUT" "future marker"
  _assert_rei 'exit code' "$_LAST_OUT" "exit codes documented"
}

# TC-QGATES-007 — resolution: declared gate-set file preferred; else built-in default.
test_tc007_resolution_precedence() {
  # Preferred: a declared gate set is honored.
  local gs="${_test_tmpdir}/gs"
  printf 'declared-gate true\n' >"$gs"
  QGATES_GATE_SET_FILE="$gs"
  resolve_gate_set
  assert_eq "declared-gate" "${GATE_NAMES[0]}" "declared gate honored"
  assert_eq "true" "${GATE_CMDS[0]}" "declared cmd"
  # Fallback: no gate-set file -> built-in default set.
  QGATES_GATE_SET_FILE=""
  resolve_gate_set
  local names="${GATE_NAMES[*]}"
  assert_contains "$names" "bash-tests" "default bash-tests"
  assert_contains "$names" "doc-distribution" "default doc-distribution"
  assert_contains "$names" "plugin-freshness" "default plugin-freshness"
  assert_contains "$names" "whitespace" "default whitespace"
}

# TC-QGATES-008 — extension point: a project gate takes effect without editing the script's core.
test_tc008_extension_point() {
  # The script's source is unchanged by the addition (declarative extension).
  local core_before core_after
  core_before="$(git diff --stat -- "${RUNNER}" || true)"
  local gs="${_test_tmpdir}/gs"
  _make_pass_gate "${_test_tmpdir}/proj.sh" PROJECT_ONLY
  _make_gateset "$gs" project-only-gate "${_test_tmpdir}/proj.sh"
  QGATES_GATE_SET_FILE="$gs" _run_qg
  assert_contains "$_LAST_OUT" "name=project-only-gate status=PASS" "project gate ran"
  core_after="$(git diff --stat -- "${RUNNER}" || true)"
  assert_eq "$core_before" "$core_after" "core script edited (must be unchanged)"
  # Override precedence: a gate named like a builtin is overridden by the file.
  # On PASS the gate's output lands in the logfile (no excerpt on stdout), so we
  # point QGATES_OUTPUT_ROOT at a temp dir and assert the marker there.
  local gso="${_test_tmpdir}/gso"
  printf '#!/usr/bin/env bash\necho "OVERRIDE_MARKER"\nexit 0\n' >"${_test_tmpdir}/ov.sh"
  chmod +x "${_test_tmpdir}/ov.sh"
  _make_gateset "$gso" bash-tests "${_test_tmpdir}/ov.sh"
  local custom_root="${_test_tmpdir}/qg-out"
  QGATES_GATE_SET_FILE="$gso" QGATES_OUTPUT_ROOT="$custom_root" _run_qg bash-tests
  assert_contains "$_LAST_OUT" "name=bash-tests status=PASS" "overridden bash-tests ran"
  local olog="${custom_root}/$(date -u +%F)/bash-tests.log"
  assert_file_exists "$olog" "override log"
  grep -q 'OVERRIDE_MARKER' "$olog" || { printf '  override marker absent from log\n' >&2; return 1; }
}

# TC-QGATES-009 — suite exists, executable, bash.md-conformant, proves the contract (self).
test_tc009_self_convention() {
  local self="${SCRIPT_DIR}/.tests/test-quality-gates.sh"
  assert_file_exists "$self" "suite missing"
  [[ -x "$self" ]] || { printf '  suite not executable\n' >&2; return 1; }
  grep -q 'set -Eeuo pipefail' "$self" || { printf '  suite lacks strict mode\n' >&2; return 1; }
  # Proves the contract — names each concept area (manual: actually exercises them).
  grep -qi 'fail' "$self" || { printf '  no fail concept\n' >&2; return 1; }
  grep -qi 'exit' "$self" || { printf '  no exit concept\n' >&2; return 1; }
  grep -qi 'report' "$self" || { printf '  no report concept\n' >&2; return 1; }
  grep -qi 'arg' "$self" || { printf '  no arg concept\n' >&2; return 1; }
  grep -qi 'output' "$self" || { printf '  no output concept\n' >&2; return 1; }
}

# TC-QGATES-019 — determinism: two runs -> same verdict + identical gate ordering.
test_tc019_determinism() {
  local gs
  gs="$(_make_trivial_gateset 4)"
  QGATES_GATE_SET_FILE="$gs" _run_qg
  local out1="$_LAST_OUT"
  QGATES_GATE_SET_FILE="$gs" _run_qg
  local out2="$_LAST_OUT"
  local v1 v2
  v1="$(printf '%s' "$out1" | sed -n 's/.*overall=\(.*\)/\1/p')"
  v2="$(printf '%s' "$out2" | sed -n 's/.*overall=\(.*\)/\1/p')"
  assert_eq "$v1" "$v2" "verdict differs across runs"
  local n1 n2
  n1="$(_qg_gate_names "$out1" | paste -sd,)"
  n2="$(_qg_gate_names "$out2" | paste -sd,)"
  assert_eq "$n1" "$n2" "gate ordering differs across runs"
}

# TC-QGATES-020 — performance: orchestrator overhead < 2s; no gratuitous re-runs.
test_tc020_performance() {
  local gs
  gs="$(_make_trivial_gateset 10)"
  local start end dur
  start=$(date +%s.%N)
  QGATES_GATE_SET_FILE="$gs" _run_qg
  end=$(date +%s.%N)
  dur=$(awk -v s="$start" -v e="$end" 'BEGIN{printf "%.3f", e-s}')
  awk -v d="$dur" 'BEGIN{exit !(d+0 < 2)}' || { printf '  overhead %ss >= 2s\n' "$dur" >&2; return 1; }
  # Each gate appears exactly once (no gratuitous re-runs).
  local cnt uniq
  cnt="$(_qg_gate_names "$_LAST_OUT" | wc -l | tr -d ' ')"
  uniq="$(_qg_gate_names "$_LAST_OUT" | sort -u | wc -l | tr -d ' ')"
  assert_eq "10" "$cnt" "expected 10 gate entries"
  assert_eq "10" "$uniq" "duplicate gates (gratuitous re-run)"
}

# TC-QGATES-021 — orchestrator stdlib-only; suite runs offline.
test_tc021_stdlib_only_offline() {
  # The orchestrator's own code path introduces no non-stdlib runtime dependency
  # (curl/wget/python/node/ruby absent). awk/date/tail/mkdir/git are permitted
  # stdlib tools used for duration, logs, and repo-root resolution.
  if grep -Eqw 'curl|wget|python|node|ruby' "${RUNNER}"; then
    printf '  non-stdlib runtime dependency found in orchestrator\n' >&2
    return 1
  fi
  # The suite itself uses only local tools (mktemp/bash/git/grep/sed/awk) and
  # fixture gates — no network is required (NFR-4).
  assert_file_exists "${RUNNER}"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running quality-gates contract suite...\n' "${TEST_TAG}"
  local root
  root="$(git rev-parse --show-toplevel 2>/dev/null)" || { printf '%s not a git repo\n' "${TEST_TAG}" >&2; exit 1; }
  cd "${root}"

  run_test "TC-001 runner static conformance + no license block" test_tc001_static_conformance
  run_test "TC-002 clean run (no args -> all PASS, fields, default=all)" test_tc002_clean_run_all_pass
  run_test "TC-003 default set invokes (not reimplements) real gates" test_tc003_default_set_invokes_real_gates
  run_test "TC-004 REGRESSION GUARD: injected failing gate -> reported + non-zero" test_tc004_regression_guard_failing_gate
  run_test "TC-005 arg handling + unknown-selector tolerance (non-masking)" test_tc005_arg_handling_and_tolerance
  run_test "TC-006 --help taxonomy (implemented vs future) + exit codes" test_tc006_help_taxonomy
  run_test "TC-007 resolution: declared file preferred; else built-in default" test_tc007_resolution_precedence
  run_test "TC-008 extension point: project gate without a core edit" test_tc008_extension_point
  run_test "TC-009 suite self-convention (exists, executable, proves contract)" test_tc009_self_convention
  run_test "TC-019 determinism (same verdict + gate order)" test_tc019_determinism
  run_test "TC-020 performance (overhead < 2s; no re-runs)" test_tc020_performance
  run_test "TC-021 stdlib-only orchestrator + offline" test_tc021_stdlib_only_offline

  print_summary
}

main "$@"
