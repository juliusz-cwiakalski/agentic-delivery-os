#!/usr/bin/env bash
# test-generate-decision-index.sh — Tests for tools/generate-decision-index
# Covers determinism (AC-GH63-9), health-report findings (AC-GH63-10),
# the DEC-15 committed-vs-advisory split, idempotency, and flags.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded per .ai/rules/bash.md §11)
# ============================================================================
readonly TEST_TAG="(test-generate-decision-index)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m'
  readonly _GREEN=$'\033[0;32m'
  readonly _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _RESET=""
fi

_test_setup() {
  _test_tmpdir="$(mktemp -d)"
}

_test_teardown() {
  [[ -n "${_test_tmpdir:-}" && -d "${_test_tmpdir:-}" ]] && rm -rf "${_test_tmpdir}"
}

trap '_test_teardown' EXIT

run_test() {
  local -r name="$1"
  local -r func="$2"
  ((++_test_count))
  _test_setup
  if ( set -e; "${func}" ); then
    ((++_test_passed))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    ((++_test_failed))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi
  _test_teardown
  _test_tmpdir=""
}

assert_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" != "${actual}" ]]; then
    printf '  Expected: %s\n  Actual:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    printf '  Haystack: %s\n  Needle:   %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_not_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    printf '  Haystack should not contain: %s\n  Needle: %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_exit_code() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" -ne "${actual}" ]]; then
    printf '  Expected exit code: %s\n  Actual exit code:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

print_summary() {
  printf '\n%s Summary: %d/%d passed' "${TEST_TAG}" "${_test_passed}" "${_test_count}"
  if [[ "${_test_failed}" -gt 0 ]]; then
    printf ' (%s%d failed%s)\n' "${_RED}" "${_test_failed}" "${_RESET}"
    return 1
  else
    printf ' %s(all passed)%s\n' "${_GREEN}" "${_RESET}"
    return 0
  fi
}

# ============================================================================
# PATHS & HELPERS
# ============================================================================
_TESTS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
_TOOLS_DIR="$(cd -- "${_TESTS_DIR}/.." && pwd -P)"
readonly GEN="${_TOOLS_DIR}/generate-decision-index"

RC=0
OUT=""
# _gen <args...> — invokes the generator CLI as a subprocess; sets RC and OUT.
_gen() {
  RC=0
  OUT="$(bash "${GEN}" "$@" 2>&1)" || RC=$?
}

# _make_record <dir> <id> <status> <rigor> <decider|"null"> <vc:yes|no>
#              <last_updated> <review_date|"null">
# Writes a synthetic decision record into <dir>.
_make_record() {
  local -r dir="$1" id="$2" status="$3" rigor="$4" decider="$5" vc="$6"
  local -r last_updated="$7" review_date="$8"
  local -r title="${id} Record"
  local decider_line vc_block
  if [[ "$decider" == "null" ]]; then
    decider_line="  decider: null"
  else
    decider_line="  decider: \"${decider}\""
  fi
  if [[ "$vc" == "yes" ]]; then
    vc_block=$'\n\n## Verification Criteria\n\n- Metric: x — Target: y'
  else
    vc_block=""
  fi
  cat > "${dir}/${id}-synthetic.md" <<EOF
---
id: ${id}
decision_type: $(echo "$id" | tr '[:upper:]' '[:lower:]' | sed -E 's/-[0-9]+//')
status: ${status}
created: 2026-01-01
decision_date: 2026-01-01
last_updated: ${last_updated}
review_date: ${review_date}
summary: "Synthetic record ${id} for index tests."
owners:
  - "Tester"
service: delivery-os
classification:
  domains: []
  rigor: ${rigor}
governance:
  driver: "@decision-advisor"
${decider_line}
  contributors: []
  reviewers: []
  performers: []
ai_assistance:
  used: false
  roles: []
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
links:
  related_changes: []
  supersedes: []
  superseded_by: []
  spec: []
---

# ${id}: ${title}${vc_block}
EOF
}

# Build the canonical health-test corpus into a temp decisions dir.
_build_corpus() {
  local -r dir="${_test_tmpdir}/decisions"
  mkdir -p "$dir"
  # 9200: clean Accepted R2 (decider set, VC present, recent).
  _make_record "$dir" "ADR-9200" "Accepted" "R2" "Lead" "yes" "2026-06-01" "null"
  # 9201: Accepted R2, NO decider -> missing decider (time-independent).
  _make_record "$dir" "ADR-9201" "Accepted" "R2" "null" "yes" "2026-06-01" "null"
  # 9202: Accepted R2, NO VC -> missing verification criteria (time-independent).
  _make_record "$dir" "ADR-9202" "Accepted" "R2" "Lead" "no" "2026-06-01" "null"
  # 9203: Accepted R2, stale last_updated, no review_date -> overdue (advisory).
  _make_record "$dir" "ADR-9203" "Accepted" "R2" "Lead" "yes" "2024-01-01" "null"
  # 9204: Proposed, clean.
  _make_record "$dir" "ADR-9204" "Proposed" "R2" "null" "no" "2026-06-01" "null"
  printf '%s' "$dir"
}

# ============================================================================
# TESTS — determinism (AC-GH63-9)
# ============================================================================

test_dry_run_byte_identical() {
  local dir
  dir="$(_build_corpus)"
  _gen --dry-run "$dir"
  local -r first="${OUT}"
  _gen --dry-run "$dir"
  local -r second="${OUT}"
  assert_eq "$first" "$second" "two --dry-run runs must be byte-identical"
}

# ============================================================================
# TESTS — health findings (AC-GH63-10)
# ============================================================================

test_health_missing_decider_committed() {
  local dir
  dir="$(_build_corpus)"
  _gen --dry-run "$dir"
  assert_contains "${OUT}" "ADR-9201" "should list ADR-9201 in table"
  assert_contains "${OUT}" "Missing deciders" "should have missing-deciders section"
  assert_contains "${OUT}" "ADR-9201: Accepted R2 record has no governance.decider" "should flag ADR-9201"
}

test_health_missing_vc_committed() {
  local dir
  dir="$(_build_corpus)"
  _gen --dry-run "$dir"
  assert_contains "${OUT}" "Missing verification criteria" "should have missing-VC section"
  assert_contains "${OUT}" "ADR-9202: Accepted record has no Verification Criteria" "should flag ADR-9202"
}

test_health_overdue_advisory_only() {
  # AC-GH63-12 / DEC-15: overdue is advisory ONLY — never in committed output.
  local dir
  dir="$(_build_corpus)"
  # Committed (--dry-run) must NOT contain overdue findings (the record still
  # appears in the table; we check the finding text is absent).
  _gen --dry-run "$dir"
  assert_not_contains "${OUT}" "Overdue reviews" "committed index must not contain overdue section"
  assert_not_contains "${OUT}" "exceeds 180d review horizon" "committed health must not contain overdue finding"
  # Advisory (--summary) MUST contain the overdue finding.
  _gen --summary "$dir"
  assert_contains "${OUT}" "Overdue reviews" "summary must contain overdue section"
  assert_contains "${OUT}" "ADR-9203" "summary must flag overdue ADR-9203"
}

test_health_clean_records_unflagged() {
  local dir
  dir="$(_build_corpus)"
  _gen --summary "$dir"
  # ADR-9200 is clean (decider set, VC present, recent) -> must not appear in findings.
  # It appears in the table row, so check it does not appear in a finding context.
  assert_not_contains "${OUT}" "ADR-9200: Accepted" "clean record must not be flagged"
}

test_health_waiver_dimension_empty() {
  # DEC-11 future-field-aware waiver dimension is empty for all corpora today.
  local dir
  dir="$(_build_corpus)"
  _gen --dry-run "$dir"
  assert_contains "${OUT}" "Future-field waivers (DEC-11)**: none" "waiver dimension should be empty"
}

# ============================================================================
# TESTS — idempotency
# ============================================================================

test_write_then_write_no_diff() {
  local dir
  dir="$(_build_corpus)"
  # First write creates 00-index.md.
  _gen "$dir"
  assert_exit_code 0 "${RC}" "first write should succeed"
  local first
  first="$(cat "${dir}/00-index.md")"
  # Second write must produce identical bytes.
  _gen "$dir"
  assert_exit_code 0 "${RC}" "second write should succeed"
  local second
  second="$(cat "${dir}/00-index.md")"
  assert_eq "$first" "$second" "regenerating an already-generated index must yield no diff"
}

test_dry_run_matches_committed() {
  # --dry-run output must equal what write mode commits (the drift-check invariant).
  local dir
  dir="$(_build_corpus)"
  _gen --dry-run "$dir"
  local dry
  dry="${OUT}"
  _gen "$dir"
  local written
  written="$(cat "${dir}/00-index.md")"
  assert_eq "$dry" "$written" "--dry-run output must equal the committed file"
}

# ============================================================================
# TESTS — table ordering (deterministic sort)
# ============================================================================

test_table_sorted_by_type_then_id() {
  local dir
  dir="${_test_tmpdir}/decisions2"
  mkdir -p "$dir"
  _make_record "$dir" "ADR-0010" "Proposed" "R2" "null" "no" "2026-06-01" "null"
  _make_record "$dir" "ADR-0002" "Proposed" "R2" "null" "no" "2026-06-01" "null"
  _make_record "$dir" "PDR-0001" "Proposed" "R2" "null" "no" "2026-06-01" "null"
  _gen --dry-run "$dir"
  # ADRs must precede PDR; within ADR, 0002 before 0010.
  local -r trow_a2="| ADR-0002 |"
  local -r trow_a10="| ADR-0010 |"
  local -r trow_p1="| PDR-0001 |"
  local ia ip10 ip1
  ia="${OUT%%${trow_a2}*}"; ip10="${OUT%%${trow_a10}*}"; ip1="${OUT%%${trow_p1}*}"
  assert_eq "$(( ${#ia} < ${#ip10} ))" "1" "ADR-0002 row must precede ADR-0010"
  assert_eq "$(( ${#ip10} < ${#ip1} ))" "1" "ADR-0010 row must precede PDR-0001"
}

# ============================================================================
# TESTS — flags
# ============================================================================

test_help_exit0() {
  _gen --help
  assert_exit_code 0 "${RC}" "--help should exit 0"
  assert_contains "${OUT}" "Usage" "should print usage"
}

test_version_exit0() {
  _gen --version
  assert_exit_code 0 "${RC}" "--version should exit 0"
}

test_default_dir_works() {
  # No path arg -> defaults to repo doc/decisions (must exist and succeed).
  _gen --dry-run
  assert_exit_code 0 "${RC}" "default dir should resolve and succeed"
  assert_contains "${OUT}" "## Index" "should render an index section"
}

test_dec15_committed_has_no_timestamp() {
  # The committed artifact must not embed today's date (byte-stability).
  local dir today
  dir="$(_build_corpus)"
  today="$(date +%Y-%m-%d)"
  _gen --dry-run "$dir"
  assert_not_contains "${OUT}" "${today}" "committed index must not embed today's date"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  printf '\n%s --- Determinism (AC-GH63-9) ---\n' "${TEST_TAG}"
  run_test "dry-run output byte-identical across runs" test_dry_run_byte_identical

  printf '\n%s --- Health findings (AC-GH63-10) ---\n' "${TEST_TAG}"
  run_test "missing decider flagged in committed index" test_health_missing_decider_committed
  run_test "missing VC flagged in committed index" test_health_missing_vc_committed
  run_test "overdue is advisory-only (DEC-15 split)" test_health_overdue_advisory_only
  run_test "clean records are not flagged" test_health_clean_records_unflagged
  run_test "waiver dimension empty (DEC-11)" test_health_waiver_dimension_empty

  printf '\n%s --- Idempotency ---\n' "${TEST_TAG}"
  run_test "write-then-write produces no diff" test_write_then_write_no_diff
  run_test "dry-run matches committed file" test_dry_run_matches_committed

  printf '\n%s --- Table ordering ---\n' "${TEST_TAG}"
  run_test "table sorted by type then numeric id" test_table_sorted_by_type_then_id

  printf '\n%s --- Flags & byte-stability ---\n' "${TEST_TAG}"
  run_test "--help exits 0" test_help_exit0
  run_test "--version exits 0" test_version_exit0
  run_test "default dir resolves and works" test_default_dir_works
  run_test "committed index has no today-timestamp" test_dec15_committed_has_no_timestamp

  print_summary
}

main "$@"
