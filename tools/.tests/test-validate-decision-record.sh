#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/test-validate-decision-record.sh
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
  [[ -n "${_test_tmpdir:-}" && -d "${_test_tmpdir:-}" ]] && rm -rf "${_test_tmpdir}" || true
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

test_valid_empty_links_flow_map_exit0() {
  # Reviewer iteration-1 #1: `links: {}` (YAML flow map) must parse to an empty
  # object and validate clean (was: exit 5 + raw jq stack trace).
  _run "${FIXTURES}/positive/ADR-9005-empty-links-flow-map.md"
  assert_exit_code 0 "${RC}" "links: {} flow-map record should validate clean"
}

test_flow_map_never_crashes() {
  # Regression guard: a flow-map value must NEVER yield the undocumented exit 5
  # or a raw `jq:` stack trace (NFR-8 actionable errors; AC-GH63-16).
  _run "${FIXTURES}/positive/ADR-9005-empty-links-flow-map.md"
  assert_exit_code 0 "${RC}" "flow-map parse must succeed"
  assert_not_contains "${OUT}" "jq: error" "must not leak a raw jq stack trace"
  assert_not_contains "${OUT}" "Cannot index string" "must not leak a jq indexing error"
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

test_malformed_decision_date_exit1() {
  # Reviewer iteration-1 #2: the decision_date PATTERN is now enforced (previously
  # only the Accepted non-null check ran -> schema<->validator drift).
  _run "${FIXTURES}/negative/ADR-9019-malformed-decision-date.md"
  assert_exit_code 1 "${RC}" "Malformed decision_date must fail"
  assert_contains "${OUT}" "decision_date" "should mention decision_date"
  assert_contains "${OUT}" "YYYY-MM-DD" "should mention the date format"
}

test_malformed_dates_exit1() {
  # Coverage enforcement-strength: created/last_updated/review_date patterns all
  # enforced via the shared _check_date.
  _run "${FIXTURES}/negative/ADR-9020-malformed-dates.md"
  assert_exit_code 1 "${RC}" "Malformed created/last_updated/review_date must fail"
  assert_contains "${OUT}" "created" "should mention created"
  assert_contains "${OUT}" "review_date" "should mention review_date"
}

test_malformed_id_exit1() {
  # Coverage enforcement-strength: id <TYPE>-<zeroPad4> pattern enforced.
  _run "${FIXTURES}/negative/ADR-9021-malformed-id.md"
  assert_exit_code 1 "${RC}" "Malformed id must fail"
  assert_contains "${OUT}" "id" "should mention id"
}

test_invalid_rigor_exit1() {
  # Coverage enforcement-strength: nested classification.rigor enum enforced.
  _run "${FIXTURES}/negative/ADR-9022-invalid-rigor.md"
  assert_exit_code 1 "${RC}" "Invalid classification.rigor must fail"
  assert_contains "${OUT}" "rigor" "should mention rigor"
}

test_unclosed_frontmatter_one_error_exit1() {
  # RT2 m1: a record with an opening '---' but no closing fence must yield ONE
  # actionable error (not ~9 misleading cascade "required field missing" errors).
  # The malformed file is generated at runtime because the header-adding script
  # cannot safely process an unclosed front-matter block.
  local -r f="${_test_tmpdir}/ADR-9023-unclosed-frontmatter.md"
  cat > "$f" <<'EOF'
---
id: ADR-9023
decision_type: adr
status: Proposed
created: 2026-06-25
decision_date: null
last_updated: 2026-06-25
summary: "Negative fixture (RT2 m1): opening fence, no closing fence."
owners:
  - "Test Author"
service: delivery-os
EOF
  _run "$f"
  assert_exit_code 1 "${RC}" "unclosed front matter must fail"
  assert_contains "${OUT}" "no closing '---' fence found" "should emit the single actionable fence error"
  # The misleading cascade (~9 "required field missing") must be gone.
  local cascade
  cascade="$(printf '%s\n' "${OUT}" | grep -c "required field .* is missing" || true)"
  assert_eq "0" "${cascade}" "must not emit cascade missing-field errors (was ~9 before RT2 m1)"
}

test_filename_prefix_collision_rejected() {
  # RT2 m2: 'id: ADR-0001' must NOT match filename 'ADR-00010-...' (boundary).
  _run "${FIXTURES}/negative/ADR-00010-filename-prefix-collision.md"
  assert_exit_code 1 "${RC}" "id/filename prefix collision must be rejected"
  assert_contains "${OUT}" "filename does not match" "should mention the filename match rule"
  assert_contains "${OUT}" "ADR-0001" "should reference the id"
}

test_invalid_calendar_date_exit1() {
  # RT2 m3: '2026-13-45' passes the YYYY-MM-DD format regex but is not a real
  # calendar date; fromisoformat must reject it.
  _run "${FIXTURES}/negative/ADR-9026-invalid-calendar-date.md"
  assert_exit_code 1 "${RC}" "invalid calendar date must fail"
  assert_contains "${OUT}" "created" "should mention the created field"
  assert_contains "${OUT}" "calendar date" "should mention calendar validity"
}

test_accepted_unclassified_missing_decider_dm4_note() {
  # RT2 m5: an un-classified Accepted record missing its decider must fail AND
  # explain the R2 default obligation at the point of failure (DM-4).
  _run "${FIXTURES}/negative/ADR-9027-accepted-unclassified-missing-decider.md"
  assert_exit_code 1 "${RC}" "un-classified Accepted missing decider must fail"
  assert_contains "${OUT}" "decider" "should mention decider"
  assert_contains "${OUT}" "defaulted to R2 because no 'classification'" "should explain the R2 default (DM-4)"
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
  # AC-GH63-15 / M5 / reviewer iteration-1 #2: schema-driven coverage must report
  # 0 uncovered rules AND prove enforcement-strength (the validator actually
  # rejects a malformed value per pattern/enum rule, not just fixture presence).
  _run --coverage
  assert_exit_code 0 "${RC}" "--coverage with full map should exit 0"
  assert_contains "${OUT}" "UNCOVERED: 0" "should report 0 uncovered"
  assert_contains "${OUT}" "ENFORCEMENT_PROVEN:" "should prove enforcement-strength"
  assert_not_contains "${OUT}" "ENFORCEMENT_FAILURE" "must have no enforcement failures (no tautology)"
  assert_not_contains "${OUT}" "NO_REJECTOR:" "every pattern/enum rule must have a rejecting fixture"
}

test_no_forbidden_dependencies() {
  # TC-GH63-016 / DEC-4 / DEC-14 / red-team M3: tool sources must not import yaml /
  # jsonschema or perform network calls (curl/wget/_check_version/raw.githubusercontent).
  # Comments are excluded so documenting the constraint does not trip the gate.
  local forbidden
  forbidden="$(grep -nE 'import yaml|jsonschema|curl |wget |_check_version|raw\.githubusercontent|requests\.|urllib' \
    "${_TOOLS_DIR}/validate-decision-record" \
    "${_TOOLS_DIR}/.lib/frontmatter.sh" \
    "${_TOOLS_DIR}/generate-decision-index" 2>/dev/null \
    | grep -vE ':[0-9]+:[[:space:]]*#' \
    | grep -vE 'NO jsonschema|NOT import yaml|no .*yaml|shellcheck source' || true)"
  assert_eq "" "${forbidden}" "tool sources must contain no forbidden deps/network calls (comments excluded)"
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
  run_test "TC-it1 links: {} flow-map record passes" test_valid_empty_links_flow_map_exit0
  run_test "TC-it1 flow-map never crashes (no exit 5 / jq trace)" test_flow_map_never_crashes

  printf '\n%s --- Behavior: invalid records (exit 1) ---\n' "${TEST_TAG}"
  run_test "TC-005 invalid decision_type fails" test_invalid_decision_type_exit1
  run_test "TC-006 invalid status fails" test_invalid_status_exit1
  run_test "TC-007 Accepted R2 missing decider fails" test_accepted_r2_missing_decider_exit1
  run_test "TC-008 Accepted R3 missing reviewers fails" test_accepted_r3_missing_reviewers_exit1
  run_test "TC-009 Accepted missing decision_date fails" test_accepted_missing_decision_date_exit1
  run_test "TC-010 impossible transition fails" test_impossible_transition_exit1
  run_test "TC-011 supersedes mismatch fails" test_supersedes_mismatch_exit1
  run_test "missing owners (minItems) fails" test_missing_owners_exit1
  run_test "TC-it1 malformed decision_date pattern fails" test_malformed_decision_date_exit1
  run_test "TC-it1 malformed created/last_updated/review_date fail" test_malformed_dates_exit1
  run_test "TC-it1 malformed id pattern fails" test_malformed_id_exit1
  run_test "TC-it1 invalid classification.rigor fails" test_invalid_rigor_exit1
  run_test "RT2-m1 unclosed front matter -> one actionable error" test_unclosed_frontmatter_one_error_exit1
  run_test "RT2-m2 id/filename prefix collision rejected" test_filename_prefix_collision_rejected
  run_test "RT2-m3 invalid calendar date fails" test_invalid_calendar_date_exit1
  run_test "RT2-m5 un-classified Accepted missing decider + DM-4 note" test_accepted_unclassified_missing_decider_dm4_note

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
  run_test "TC-016 no forbidden deps / network calls" test_no_forbidden_dependencies

  print_summary
}

main "$@"
