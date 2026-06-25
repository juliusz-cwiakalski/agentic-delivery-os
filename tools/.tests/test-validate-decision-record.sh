#!/usr/bin/env bash
# test-validate-decision-record.sh — Tests for tools/validate-decision-record
# Covers TC-GH63-004..014,022 plus flags, directory mode, and schema-driven coverage.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded per .ai/rules/bash.md §11)
# ============================================================================
readonly TEST_TAG="(test-validate-decision-record)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m'
  readonly _GREEN=$'\033[0;32m'
  readonly _YELLOW=$'\033[0;33m'
  readonly _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _YELLOW="" _RESET=""
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
# PATHS & HELPER
# ============================================================================
_TESTS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
_TOOLS_DIR="$(cd -- "${_TESTS_DIR}/.." && pwd -P)"
_REPO_ROOT="$(cd -- "${_TOOLS_DIR}/.." && pwd -P)"
readonly VALIDATOR="${_TOOLS_DIR}/validate-decision-record"
readonly FIXTURES="${_TESTS_DIR}/fixtures"

# _run <args...> — invokes the validator CLI as a subprocess; sets RC and OUT.
RC=0
OUT=""
_run() {
  RC=0
  OUT="$(bash "${VALIDATOR}" "$@" 2>&1)" || RC=$?
}

# ============================================================================
# BEHAVIOR TESTS — valid records (exit 0)
# ============================================================================

test_valid_proposed_record_exit0() {
  # TC-GH63-004 / DEC-12: Proposed R3 with empty reviewers MUST pass (acceptance-gated).
  _run "${FIXTURES}/positive/ADR-0001-snapshot.md"
  assert_exit_code 0 "${RC}" "Proposed R3 with empty reviewers should pass (acceptance-gated)"
}

test_valid_accepted_r2_with_decider_exit0() {
  _run "${FIXTURES}/positive/ADR-9002-accepted-r2-with-decider.md"
  assert_exit_code 0 "${RC}" "Accepted R2 with decider set should pass"
}

test_valid_accepted_r3_with_reviewers_exit0() {
  _run "${FIXTURES}/positive/ADR-9003-accepted-r3-with-reviewers.md"
  assert_exit_code 0 "${RC}" "Accepted R3 with non-empty reviewers should pass"
}

test_valid_unclassified_defaults_r2_exit0() {
  # TC-GH63-012: no classification rigor -> default R2 (no decider required for Proposed).
  _run "${FIXTURES}/positive/ADR-9004-unclassified-r2.md"
  assert_exit_code 0 "${RC}" "Unclassified Proposed record defaults to R2 and should pass"
}

test_real_adr_0001_passes() {
  # AC: the real dogfood record (Proposed R3, empty reviewers) must validate clean.
  _run "${_REPO_ROOT}/doc/decisions/ADR-0001-decision-making-framework.md"
  assert_exit_code 0 "${RC}" "Real ADR-0001 must validate clean"
}

# ============================================================================
# BEHAVIOR TESTS — invalid records (exit 1, hard §28.3 fails)
# ============================================================================

test_invalid_decision_type_exit1() {
  # TC-GH63-005
  _run "${FIXTURES}/negative/ADR-9010-invalid-decision-type.md"
  assert_exit_code 1 "${RC}" "Invalid decision_type must fail"
  assert_contains "${OUT}" "decision_type" "should mention decision_type"
}

test_invalid_status_exit1() {
  # TC-GH63-006
  _run "${FIXTURES}/negative/ADR-9011-invalid-status.md"
  assert_exit_code 1 "${RC}" "Invalid status must fail"
  assert_contains "${OUT}" "status" "should mention status"
}

test_accepted_r2_missing_decider_exit1() {
  # TC-GH63-007 / DEC-12
  _run "${FIXTURES}/negative/ADR-9015-accepted-r2-missing-decider.md"
  assert_exit_code 1 "${RC}" "Accepted R2 with null decider must fail"
  assert_contains "${OUT}" "decider" "should mention decider"
}

test_accepted_r3_missing_reviewers_exit1() {
  # TC-GH63-008 / DEC-12
  _run "${FIXTURES}/negative/ADR-9017-accepted-r3-missing-reviewers.md"
  assert_exit_code 1 "${RC}" "Accepted R3 with empty reviewers must fail"
  assert_contains "${OUT}" "reviewer" "should mention reviewers"
}

test_accepted_missing_decision_date_exit1() {
  # TC-GH63-009
  _run "${FIXTURES}/negative/ADR-9016-accepted-missing-decision-date.md"
  assert_exit_code 1 "${RC}" "Accepted with null decision_date must fail"
  assert_contains "${OUT}" "decision_date" "should mention decision_date"
}

test_impossible_transition_exit1() {
  # TC-GH63-010: Accepted is terminal; superseded_by must be empty.
  _run "${FIXTURES}/negative/ADR-9012-impossible-transition.md"
  assert_exit_code 1 "${RC}" "Accepted with non-empty superseded_by must fail"
}

test_supersedes_mismatch_exit1() {
  # TC-GH63-011: Superseded status requires non-empty superseded_by.
  _run "${FIXTURES}/negative/ADR-9013-supersedes-mismatch.md"
  assert_exit_code 1 "${RC}" "Superseded with empty superseded_by must fail"
}

test_missing_owners_exit1() {
  # minItems violation
  _run "${FIXTURES}/negative/ADR-9014-missing-owners.md"
  assert_exit_code 1 "${RC}" "Empty owners must fail (minItems)"
  assert_contains "${OUT}" "owner" "should mention owners"
}

# ============================================================================
# BEHAVIOR TESTS — non-blocking heuristics (exit 0 + WARN)
# ============================================================================

test_accepted_missing_verification_criteria_warns_exit0() {
  # TC-GH63-014 / DEC-13: heuristic is non-blocking.
  _run "${FIXTURES}/negative/ADR-9018-accepted-missing-verification-criteria.md"
  assert_exit_code 0 "${RC}" "Missing VC heuristic must be non-blocking (exit 0)"
  assert_contains "${OUT}" "[HEURISTIC]" "should emit a [HEURISTIC] warning"
  assert_contains "${OUT}" "Verification Criteria" "should mention Verification Criteria"
}

# ============================================================================
# BEHAVIOR TESTS — planning-summary mode (--summary)
# ============================================================================

test_summary_generic_valid_exit0() {
  _run --summary "${FIXTURES}/planning-summary/generic-summary.json"
  assert_exit_code 0 "${RC}" "Valid generic planning-summary should pass"
}

test_summary_legacy_alias_exit0() {
  # Legacy adr.* alias block is accepted via normalization.
  _run --summary "${FIXTURES}/planning-summary/legacy-alias-summary.json"
  assert_exit_code 0 "${RC}" "Legacy alias planning-summary should pass"
}

test_summary_overlap_exit1() {
  # TC-GH63-013 / AC-GH63-5: hard_requirements ∩ decision_drivers must be empty.
  _run --summary "${FIXTURES}/negative/summary-constraint-driver-overlap.json"
  assert_exit_code 1 "${RC}" "Overlap between hard_requirements and decision_drivers must fail"
  assert_contains "${OUT}" "disjoint" "should mention disjoint"
}

test_summary_non_negotiable_violation_warns_exit0() {
  # TC-GH63-022 / DEC-13: chosen option violating a non-negotiable constraint -> WARN, exit 0.
  _run --summary "${FIXTURES}/negative/summary-non-negotiable-violation.json"
  assert_exit_code 0 "${RC}" "Non-negotiable violation heuristic must be non-blocking (exit 0)"
  assert_contains "${OUT}" "[HEURISTIC]" "should emit a [HEURISTIC] warning"
  assert_contains "${OUT}" "non-negotiable" "should mention non-negotiable"
}

test_summary_without_flag_is_frontmatter_mode() {
  # DEC-16: default mode is front-matter; a .json summary without --summary is treated as a record path.
  _run "${FIXTURES}/planning-summary/generic-summary.json"
  # JSON has no front matter -> parse error path; must NOT silently pass as a summary.
  assert_exit_code 1 "${RC}" "JSON file without --summary should not pass as a record"
}

# ============================================================================
# BEHAVIOR TESTS — CLI flags
# ============================================================================

test_help_flag_exit0() {
  _run --help
  assert_exit_code 0 "${RC}" "--help should exit 0"
  assert_contains "${OUT}" "Usage" "should print usage"
}

test_version_flag_exit0() {
  _run --version
  assert_exit_code 0 "${RC}" "--version should exit 0"
}

test_dry_run_marker_exit0() {
  _run --dry-run "${FIXTURES}/positive/ADR-9002-accepted-r2-with-decider.md"
  assert_contains "${OUT}" "[DRY-RUN]" "should emit DRY-RUN marker"
}

test_unknown_flag_exit_nonzero() {
  _run --bogus "${FIXTURES}/positive/ADR-9001-template-instantiated-r2.md"
  assert_exit_code 2 "${RC}" "unknown flag should exit with usage error (2)"
}

test_no_args_exit_nonzero() {
  _run
  assert_exit_code 2 "${RC}" "no path should exit with usage error (2)"
}

test_missing_path_exit_nonzero() {
  _run "/nonexistent/path/to/record.md"
  assert_exit_code 1 "${RC}" "missing path should exit with validation error (1)"
}

# ============================================================================
# INTEGRATION TESTS — directory mode & coverage
# ============================================================================

test_directory_mode_validates_all() {
  # Directory mode: aggregator processes every .md; mixing valid + invalid must fail
  # and report the offending record (proves iteration + aggregation, not just a single file).
  local -r dir="${_test_tmpdir}/records"
  mkdir -p "${dir}"
  cp "${FIXTURES}/positive/ADR-0001-snapshot.md" "${dir}/"
  cp "${FIXTURES}/negative/ADR-9010-invalid-decision-type.md" "${dir}/"
  _run "${dir}"
  assert_exit_code 1 "${RC}" "directory with one invalid record must fail"
  assert_contains "${OUT}" "ADR-9010" "should report the offending record id"
}

test_directory_mode_all_valid_exit0() {
  # All-valid directory must pass.
  _run "${FIXTURES}/positive"
  assert_exit_code 0 "${RC}" "directory of all-valid fixtures should pass"
  assert_contains "${OUT}" "validation passed" "should report success"
}

test_coverage_zero_uncovered() {
  # AC-GH63-15 / M5: schema-driven coverage must report 0 uncovered rules.
  _run --coverage
  assert_exit_code 0 "${RC}" "--coverage with full map should exit 0"
  assert_contains "${OUT}" "UNCOVERED: 0" "should report 0 uncovered"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"

  printf '\n%s --- Behavior: valid records (exit 0) ---\n' "${TEST_TAG}"
  run_test "TC-004 valid Proposed R3 empty reviewers passes" test_valid_proposed_record_exit0
  run_test "valid Accepted R2 with decider passes" test_valid_accepted_r2_with_decider_exit0
  run_test "valid Accepted R3 with reviewers passes" test_valid_accepted_r3_with_reviewers_exit0
  run_test "TC-012 unclassified defaults to R2 passes" test_valid_unclassified_defaults_r2_exit0
  run_test "real ADR-0001 validates clean" test_real_adr_0001_passes

  printf '\n%s --- Behavior: invalid records (exit 1) ---\n' "${TEST_TAG}"
  run_test "TC-005 invalid decision_type fails" test_invalid_decision_type_exit1
  run_test "TC-006 invalid status fails" test_invalid_status_exit1
  run_test "TC-007 Accepted R2 missing decider fails" test_accepted_r2_missing_decider_exit1
  run_test "TC-008 Accepted R3 missing reviewers fails" test_accepted_r3_missing_reviewers_exit1
  run_test "TC-009 Accepted missing decision_date fails" test_accepted_missing_decision_date_exit1
  run_test "TC-010 impossible transition fails" test_impossible_transition_exit1
  run_test "TC-011 supersedes mismatch fails" test_supersedes_mismatch_exit1
  run_test "missing owners (minItems) fails" test_missing_owners_exit1

  printf '\n%s --- Behavior: non-blocking heuristics (exit 0 + WARN) ---\n' "${TEST_TAG}"
  run_test "TC-014 missing VC heuristic warns + exit 0" test_accepted_missing_verification_criteria_warns_exit0

  printf '\n%s --- Behavior: planning-summary mode (--summary) ---\n' "${TEST_TAG}"
  run_test "summary generic valid passes" test_summary_generic_valid_exit0
  run_test "summary legacy alias passes" test_summary_legacy_alias_exit0
  run_test "TC-013 summary overlap fails" test_summary_overlap_exit1
  run_test "TC-022 non-negotiable violation warns + exit 0" test_summary_non_negotiable_violation_warns_exit0
  run_test "summary JSON without --summary is front-matter mode" test_summary_without_flag_is_frontmatter_mode

  printf '\n%s --- Behavior: CLI flags ---\n' "${TEST_TAG}"
  run_test "--help exits 0" test_help_flag_exit0
  run_test "--version exits 0" test_version_flag_exit0
  run_test "--dry-run marker present" test_dry_run_marker_exit0
  run_test "unknown flag exits 2" test_unknown_flag_exit_nonzero
  run_test "no args exits 2" test_no_args_exit_nonzero
  run_test "missing path exits 1" test_missing_path_exit_nonzero

  printf '\n%s --- Integration: directory mode & coverage ---\n' "${TEST_TAG}"
  run_test "directory mode aggregates valid+invalid" test_directory_mode_validates_all
  run_test "directory mode all-valid passes" test_directory_mode_all_valid_exit0
  run_test "AC-GH63-15 coverage reports 0 uncovered" test_coverage_zero_uncovered

  print_summary
}

main "$@"
