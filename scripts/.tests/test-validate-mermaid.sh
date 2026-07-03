#!/usr/bin/env bash
# test-validate-mermaid.sh — Chromium-free test suite for validate-mermaid.sh (GH-110).
#
# Covers TC-MMD-001..012, TC-RULE-004 (drift guard), and TC-BASE-001 (mmdc-gated
# green baseline, self-skipping). Every render-dependent case injects a
# deterministic fake mmdc via the MMDC_CMD env seam — NO real Chromium is ever
# required by this suite. The keyword guard (a pure grep) is exercised with a
# guaranteed-absent mmdc so the "guard needs no mmdc" property is proven.
#
# Usage: bash scripts/.tests/test-validate-mermaid.sh
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded, bash.md §11)
# ============================================================================
readonly TEST_TAG="(test-validate-mermaid)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""
# Capture TMPDIR ONCE before any per-test export so teardown can restore it.
# Exporting TMPDIR and never restoring it makes the next mktemp -d (which honors
# $TMPDIR) target the deleted dir and fail (see test-add-header-location.sh:29).
readonly _ORIG_TMPDIR="${TMPDIR:-}"

if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m' _GREEN=$'\033[0;32m' _YELLOW=$'\033[0;33m' _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _YELLOW="" _RESET=""
fi

_test_setup() {
  _test_tmpdir="$(mktemp -d)"
  export TMPDIR="${_test_tmpdir}"
}

_test_teardown() {
  if [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]]; then
    rm -rf "${_test_tmpdir}"
  fi
  _test_tmpdir=""
  # Restore TMPDIR so the next mktemp -d doesn't target the deleted dir.
  if [[ -n "${_ORIG_TMPDIR}" ]]; then
    export TMPDIR="${_ORIG_TMPDIR}"
  else
    unset TMPDIR
  fi
}

trap '_test_teardown' EXIT

run_test() {
  local -r name="$1" func="$2"
  # NOTE: use arithmetic-assignment, not `((var++))` — postfix `++` returns the
  # old value, so the first increment (0) makes `(( ))` exit 1 and trips `set -e`.
  _test_count=$((_test_count + 1))
  _test_setup
  if (set -e; "${func}"); then
    _test_passed=$((_test_passed + 1))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    _test_failed=$((_test_failed + 1))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi
  _test_teardown
}

assert_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" != "${actual}" ]]; then
    printf '  Expected: %s\n  Actual:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_ne() {
  local -r unexpected="$1" actual="$2" msg="${3:-}"
  if [[ "${unexpected}" == "${actual}" ]]; then
    printf '  Unexpected: %s\n  Actual:     %s\n' "${unexpected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:    %s\n' "${msg}" >&2
    return 1
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    printf '  Haystack does not contain needle.\n  Needle: %s\n' "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_not_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    printf '  Haystack should NOT contain needle.\n  Needle: %s\n' "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_exit_code() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" -ne "${actual}" ]]; then
    printf '  Expected exit code: %s\n  Actual exit code:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_file_exists() {
  local -r path="$1" msg="${2:-}"
  if [[ ! -f "${path}" ]]; then
    printf '  File does not exist: %s\n' "${path}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

print_summary() {
  printf '\n%s Summary: %d/%d passed' "${TEST_TAG}" "${_test_passed}" "${_test_count}"
  if ((_test_failed > 0)); then
    printf ' (%s%d failed%s)\n' "${_RED}" "${_test_failed}" "${_RESET}"
    return 1
  fi
  printf ' %s(all passed)%s\n' "${_GREEN}" "${_RESET}"
  return 0
}

# ============================================================================
# SOURCE / PATHS
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
readonly REPO_ROOT
readonly VALIDATOR="${SCRIPT_DIR}/validate-mermaid.sh"
readonly DIAGRAMS_RULE="${REPO_ROOT}/.ai/rules/diagrams.md"

# Captured run output
_OUT=""
_ERR=""
_RC=0

# ----------------------------------------------------------------------------
# run_validator — invoke the validator as a subprocess, inheriting the current
# env (so exported MMDC_CMD / RENDER_SAFE_DENYLIST propagate). Captures stdout,
# stderr, and exit code into _OUT / _ERR / _RC.
# ----------------------------------------------------------------------------
run_validator() {
  local out err
  out="$(mktemp "${_test_tmpdir}/capXXXXXX")"
  err="$(mktemp "${_test_tmpdir}/capXXXXXX")"
  _RC=0
  "${VALIDATOR}" "$@" >"${out}" 2>"${err}" || _RC=$?
  _OUT="$(<"${out}")"
  _ERR="$(<"${err}")"
}

combined() {
  printf '%s\n%s' "${_OUT}" "${_ERR}"
}

# Deterministic fake mmdc shims (no Chromium). hit marker proves invocation.
make_success_shim() {
  local -r shim="$1" hit="$2"
  cat >"${shim}" <<EOF
#!/usr/bin/env bash
touch "${hit}"
exit 0
EOF
  chmod +x "${shim}"
}

make_fail_shim() {
  local -r shim="$1"
  cat >"${shim}" <<'EOF'
#!/usr/bin/env bash
printf 'Parse error: unmatched bracket at line 1\n' >&2
exit 1
EOF
  chmod +x "${shim}"
}

# ============================================================================
# TESTS — TC-MMD-*
# ============================================================================

# TC-MMD-001 — broken block + fail shim ⇒ non-zero + file + index + first error.
test_mmd_001_broken_block_fails() {
  local dir shim
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  cat >"${dir}/doc.md" <<'MMD'
# Doc

```mermaid
graph TD
    A -->>
```
MMD
  shim="${_test_tmpdir}/mmdc-fail"
  make_fail_shim "${shim}"
  export MMDC_CMD="${shim}"
  run_validator "${dir}"
  assert_ne 0 "${_RC}" "broken block must fail"
  assert_exit_code 4 "${_RC}" "render failure exit code"
  local comb
  comb="$(combined)"
  assert_contains "${comb}" "doc.md" "message must name the file"
  assert_contains "${comb}" "block #1" "message must name the block index"
  assert_contains "${comb}" "Parse error: unmatched bracket at line 1" "must surface first error"
}

# TC-MMD-002 — valid render-safe block + success shim ⇒ exit 0.
test_mmd_002_valid_block_passes() {
  local dir shim hit
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  cat >"${dir}/doc.md" <<'MMD'
# Doc

```mermaid
flowchart TD
    A --> B
```
MMD
  shim="${_test_tmpdir}/mmdc-ok"
  hit="${_test_tmpdir}/hit"
  make_success_shim "${shim}" "${hit}"
  export MMDC_CMD="${shim}"
  run_validator "${dir}"
  assert_exit_code 0 "${_RC}" "valid render-safe block must pass"
}

# TC-MMD-003 (behavioral part) — --help / --version exit 0 with expected text.
test_mmd_003_help_version() {
  run_validator --help
  assert_exit_code 0 "${_RC}" "--help must exit 0"
  assert_contains "${_OUT}" "Usage:" "--help must print a Usage line"
  run_validator --version
  assert_exit_code 0 "${_RC}" "--version must exit 0"
  assert_contains "${_OUT}" "validate-mermaid" "--version must print the tool name"
}

# TC-MMD-004 — MMDC_CMD dependency injection proven (shim invoked, not real mmdc).
test_mmd_004_mmdc_injection() {
  local dir shim hit
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  cat >"${dir}/doc.md" <<'MMD'
```mermaid
flowchart LR
    X --> Y
```
MMD
  shim="${_test_tmpdir}/mmdc-ok"
  hit="${_test_tmpdir}/invoked"
  make_success_shim "${shim}" "${hit}"
  export MMDC_CMD="${shim}"
  run_validator "${dir}"
  assert_exit_code 0 "${_RC}" "injected shim should make the block pass"
  assert_file_exists "${hit}" "the shim (not a real mmdc) must be invoked"
}

# TC-MMD-005 — C4 keyword block fails naming the keyword; guard needs no mmdc.
test_mmd_005_c4_keyword_fails() {
  local dir
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  cat >"${dir}/doc.md" <<'MMD'
```mermaid
C4Context
    title System Context
    Person(user, "User")
```
MMD
  # Deterministically force mmdc-absent: proves the keyword guard needs no mmdc
  # AND makes the verdict independent of whether real mmdc is installed.
  export MMDC_CMD="${_test_tmpdir}/no-such-mmdc"
  run_validator "${dir}"
  assert_exit_code 5 "${_RC}" "C4 keyword must fail (non-render-safe exit)"
  assert_contains "$(combined)" "C4Context" "must name the offending keyword"
}

# TC-MMD-006 — C4 keyword fails under --if-present even when mmdc is absent.
test_mmd_006_c4_fails_if_present() {
  local dir
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  cat >"${dir}/doc.md" <<'MMD'
```mermaid
C4Container
    Container(sys, "System")
```
MMD
  export MMDC_CMD="${_test_tmpdir}/no-such-mmdc"
  run_validator --if-present "${dir}"
  assert_ne 0 "${_RC}" "C4 block must fail under --if-present (keyword guard runs)"
  assert_exit_code 5 "${_RC}" "keyword failure exit under --if-present"
}

# TC-MMD-007 — valid render-safe block passes under --if-present when mmdc absent.
test_mmd_007_valid_passes_if_present() {
  local dir
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  cat >"${dir}/doc.md" <<'MMD'
```mermaid
sequenceDiagram
    Alice->>Bob: Hi
```
MMD
  export MMDC_CMD="${_test_tmpdir}/no-such-mmdc"
  run_validator --if-present "${dir}"
  assert_exit_code 0 "${_RC}" "valid block must pass under --if-present with mmdc absent"
  assert_contains "$(combined)" "skip" "must emit a skip notice"
}

# TC-MMD-008 — RENDER_SAFE_DENYLIST override drives the guard (REPLACE semantics).
test_mmd_008_denylist_override_replace() {
  local dir shim hit
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  shim="${_test_tmpdir}/mmdc-ok"
  hit="${_test_tmpdir}/hit"
  make_success_shim "${shim}" "${hit}"
  export MMDC_CMD="${shim}"

  # Step 1 — override flags a custom keyword.
  cat >"${dir}/a.md" <<'MMD'
```mermaid
graph TD
    A --> B
```
MMD
  RENDER_SAFE_DENYLIST="graph,sequenceDiagram" run_validator "${dir}"
  assert_exit_code 5 "${_RC}" "override keyword 'graph' must be flagged"
  assert_contains "$(combined)" "graph" "must name overridden keyword"

  # Step 2 — default denylist flags a C4 keyword.
  rm -f "${dir}/a.md"
  cat >"${dir}/b.md" <<'MMD'
```mermaid
C4Component
    Component(db, "DB")
```
MMD
  unset RENDER_SAFE_DENYLIST
  run_validator "${dir}"
  assert_exit_code 5 "${_RC}" "default denylist must flag C4Component"
  assert_contains "$(combined)" "C4Component" "must name default keyword"

  # Step 3 — override REPLACES default: a C4 keyword is NOT flagged.
  rm -f "${dir}/b.md"
  cat >"${dir}/c.md" <<'MMD'
```mermaid
C4Context
    Person(u, "User")
```
MMD
  RENDER_SAFE_DENYLIST="NonExistentThing" run_validator "${dir}"
  assert_exit_code 0 "${_RC}" "override replaces default; C4Context must NOT be flagged"
  assert_not_contains "$(combined)" "non-render-safe" "no keyword failure recorded"
}

# TC-MMD-009 — failure-message completeness 3/3 + multi-block indexing.
test_mmd_009_message_completeness_multiblock() {
  local dir shim
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"

  # Render-fail message: file + index + first error.
  cat >"${dir}/render.md" <<'MMD'
```mermaid
flowchart TD
    A
```
MMD
  shim="${_test_tmpdir}/mmdc-fail"
  make_fail_shim "${shim}"
  export MMDC_CMD="${shim}"
  run_validator "${dir}/render.md"
  assert_exit_code 4 "${_RC}"
  local comb
  comb="$(combined)"
  assert_contains "${comb}" "render.md"
  assert_contains "${comb}" "block #1"
  assert_contains "${comb}" "Parse error: unmatched bracket at line 1"

  # Keyword-fail message: file + index + keyword.
  rm -f "${dir}/render.md"
  cat >"${dir}/kw.md" <<'MMD'
```mermaid
C4Container
    Container(c, "C")
```
MMD
  export MMDC_CMD="${_test_tmpdir}/no-such-mmdc"
  run_validator "${dir}/kw.md"
  assert_exit_code 5 "${_RC}"
  comb="$(combined)"
  assert_contains "${comb}" "kw.md"
  assert_contains "${comb}" "block #1"
  assert_contains "${comb}" "C4Container"

  # Multi-block indexing: only the SECOND block fails (must report #2).
  rm -f "${dir}/kw.md"
  shim="${_test_tmpdir}/mmdc-ok2"
  make_success_shim "${shim}" "${_test_tmpdir}/hit2"
  export MMDC_CMD="${shim}"
  cat >"${dir}/multi.md" <<'MMD'
# Multi

```mermaid
flowchart TD
    A --> B
```

text

```mermaid
C4Context
    Person(u, "U")
```
MMD
  run_validator "${dir}/multi.md"
  assert_exit_code 5 "${_RC}"
  comb="$(combined)"
  assert_contains "${comb}" "multi.md"
  assert_contains "${comb}" "block #2" "second (failing) block must be indexed #2"
  assert_contains "${comb}" "C4Context"
}

# TC-MMD-010 — determinism: identical verdict across runs; sorted file order.
test_mmd_010_determinism() {
  local dir
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  cat >"${dir}/z-file.md" <<'MMD'
```mermaid
C4Context
    Person(u, "U")
```
MMD
  cat >"${dir}/a-file.md" <<'MMD'
```mermaid
C4Container
    Container(c, "C")
```
MMD
  export MMDC_CMD="${_test_tmpdir}/no-such-mmdc"
  local r1 r2 r3 c1 c2 c3
  run_validator "${dir}"
  r1="${_RC}"
  c1="$(combined)"
  run_validator "${dir}"
  r2="${_RC}"
  c2="$(combined)"
  run_validator "${dir}"
  r3="${_RC}"
  c3="$(combined)"
  assert_eq "${r1}" "${r2}" "run 1 == run 2 exit"
  assert_eq "${r2}" "${r3}" "run 2 == run 3 exit"
  assert_eq "${c1}" "${c2}" "run 1 == run 2 output"
  assert_eq "${c2}" "${c3}" "run 2 == run 3 output"
  assert_exit_code 5 "${r1}" "both C4 blocks fail"
  # Sorted enumeration: a-file must appear before z-file in the findings.
  local prefix="${c1%%z-file.md*}"
  assert_contains "${prefix}" "a-file.md" "sorted enumeration: a-file before z-file"
}

# TC-MMD-011 — documented exit codes reachable & distinct.
test_mmd_011_exit_codes_distinct() {
  local dir shim hit
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"

  # usage error -> 2
  run_validator --no-such-flag "${dir}" 2>/dev/null || true
  assert_exit_code 2 "${_RC}" "usage error exit"

  # missing-mmdc-when-required -> 3 (valid block, mmdc absent, no --if-present)
  cat >"${dir}/v.md" <<'MMD'
```mermaid
flowchart TD
    A --> B
```
MMD
  export MMDC_CMD="${_test_tmpdir}/no-such-mmdc"
  run_validator "${dir}"
  assert_exit_code 3 "${_RC}" "missing-mmdc-when-required exit"

  # render failure -> 4
  rm -f "${dir}/v.md"
  cat >"${dir}/v.md" <<'MMD'
```mermaid
flowchart TD
    A --> B
```
MMD
  shim="${_test_tmpdir}/mmdc-fail"
  make_fail_shim "${shim}"
  export MMDC_CMD="${shim}"
  run_validator "${dir}"
  assert_exit_code 4 "${_RC}" "render failure exit"

  # keyword failure -> 5
  rm -f "${dir}/v.md"
  cat >"${dir}/v.md" <<'MMD'
```mermaid
C4Component
    Component(x, "X")
```
MMD
  export MMDC_CMD="${_test_tmpdir}/no-such-mmdc"
  run_validator "${dir}"
  assert_exit_code 5 "${_RC}" "keyword failure exit"

  # success -> 0
  rm -f "${dir}/v.md"
  cat >"${dir}/v.md" <<'MMD'
```mermaid
flowchart TD
    A --> B
```
MMD
  shim="${_test_tmpdir}/mmdc-ok"
  hit="${_test_tmpdir}/hit"
  make_success_shim "${shim}" "${hit}"
  export MMDC_CMD="${shim}"
  run_validator "${dir}"
  assert_exit_code 0 "${_RC}" "success exit"
}

# TC-MMD-012 — DEC-7 AND-semantics 2x2 truth table.
test_mmd_012_and_semantics_truth_table() {
  local dir ok_shim fail_shim hit
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  ok_shim="${_test_tmpdir}/mmdc-ok"
  fail_shim="${_test_tmpdir}/mmdc-fail"
  hit="${_test_tmpdir}/hit"
  make_success_shim "${ok_shim}" "${hit}"
  make_fail_shim "${fail_shim}"

  local valid_block c4_block
  valid_block=$'```mermaid\nflowchart TD\n    A --> B\n```'
  c4_block=$'```mermaid\nC4Context\n    Person(u, "U")\n```'

  # Q1: mmdc-OK + no keyword -> PASS
  printf '%s\n' "${valid_block}" >"${dir}/q1.md"
  export MMDC_CMD="${ok_shim}"
  run_validator "${dir}/q1.md"
  assert_exit_code 0 "${_RC}" "Q1 mmdc-OK+no-kw must PASS"

  # Q2: mmdc-OK + C4 -> FAIL (the motivating DEC-7 guard)
  printf '%s\n' "${c4_block}" >"${dir}/q2.md"
  export MMDC_CMD="${ok_shim}"
  run_validator "${dir}/q2.md"
  assert_ne 0 "${_RC}" "Q2 mmdc-OK+C4 must FAIL (mmdc renders it, GitHub does not)"
  assert_exit_code 5 "${_RC}" "Q2 keyword failure"

  # Q3: mmdc-FAIL + no keyword -> FAIL (render)
  printf '%s\n' "${valid_block}" >"${dir}/q3.md"
  export MMDC_CMD="${fail_shim}"
  run_validator "${dir}/q3.md"
  assert_exit_code 4 "${_RC}" "Q3 render failure"

  # Q4: mmdc-FAIL + C4 -> FAIL (both reasons; at least one surfaced)
  printf '%s\n' "${c4_block}" >"${dir}/q4.md"
  export MMDC_CMD="${fail_shim}"
  run_validator "${dir}/q4.md"
  assert_ne 0 "${_RC}" "Q4 both-fail must FAIL"
  assert_contains "$(combined)" "C4Context" "Q4 surfaces at least one reason (keyword)"
}

# ============================================================================
# TESTS — TC-RULE-004 (drift guard: script default denylist == diagrams.md)
# ============================================================================

# TC-RULE-004 — the script's default denylist mirrors .ai/rules/diagrams.md.
test_rule_004_default_denylist_drift_guard() {
  local src rule
  src="$(<"${VALIDATOR}")"
  rule="$(<"${DIAGRAMS_RULE}")"

  # Source-level parity: each C4 keyword present in BOTH the script default and
  # the rule file (single source of truth, DM-3 / DEC-7).
  local kw
  for kw in C4Context C4Container C4Component; do
    assert_contains "${src}" "${kw}" "script default must name ${kw}"
    assert_contains "${rule}" "${kw}" "diagrams.md must name ${kw}"
  done

  # Behavioral parity: each default keyword is flagged with no override and a
  # guaranteed-absent mmdc (keyword guard path).
  local dir
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  export MMDC_CMD="${_test_tmpdir}/no-such-mmdc"
  unset RENDER_SAFE_DENYLIST
  for kw in C4Context C4Container C4Component; do
    rm -f "${dir}/k.md"
    {
      printf '```mermaid\n'
      printf '%s\n' "${kw}"
      printf '    Person(u, "U")\n'
      printf '```\n'
    } >"${dir}/k.md"
    run_validator "${dir}/k.md"
    assert_exit_code 5 "${_RC}" "${kw} must be flagged by the default denylist"
    assert_contains "$(combined)" "${kw}" "must name ${kw}"
  done
}

# ============================================================================
# TESTS — TC-BASE-001 (green baseline, mmdc-gated self-skip)
# ============================================================================

# TC-BASE-001 — validator passes the real repo doc tree; self-skips without mmdc.
test_base_001_green_baseline() {
  if ! command -v mmdc >/dev/null 2>&1; then
    printf '%s[INFO]%s TC-BASE-001 self-skip: mmdc not installed (CI runs the real baseline)\n' "${_YELLOW}" "${_RESET}"
    return 0
  fi
  unset MMDC_CMD
  run_validator "${REPO_ROOT}/doc" "${REPO_ROOT}/.ai"
  assert_exit_code 0 "${_RC}" "green baseline: validator must pass the current repo doc tree"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running tests...\n' "${TEST_TAG}"
  run_test "TC-MMD-001 broken block fails (file+index+error)" test_mmd_001_broken_block_fails
  run_test "TC-MMD-002 valid render-safe block passes" test_mmd_002_valid_block_passes
  run_test "TC-MMD-003 --help/--version behavior" test_mmd_003_help_version
  run_test "TC-MMD-004 MMDC_CMD injection (no Chromium)" test_mmd_004_mmdc_injection
  run_test "TC-MMD-005 C4 keyword fails naming keyword" test_mmd_005_c4_keyword_fails
  run_test "TC-MMD-006 C4 fails under --if-present (mmdc absent)" test_mmd_006_c4_fails_if_present
  run_test "TC-MMD-007 valid passes under --if-present (mmdc absent)" test_mmd_007_valid_passes_if_present
  run_test "TC-MMD-008 RENDER_SAFE_DENYLIST override (replace)" test_mmd_008_denylist_override_replace
  run_test "TC-MMD-009 message completeness + multi-block indexing" test_mmd_009_message_completeness_multiblock
  run_test "TC-MMD-010 determinism (sorted, identical verdict)" test_mmd_010_determinism
  run_test "TC-MMD-011 exit codes reachable & distinct" test_mmd_011_exit_codes_distinct
  run_test "TC-MMD-012 DEC-7 AND-semantics 2x2 truth table" test_mmd_012_and_semantics_truth_table
  run_test "TC-RULE-004 default denylist mirrors diagrams.md" test_rule_004_default_denylist_drift_guard
  run_test "TC-BASE-001 green baseline (mmdc-gated)" test_base_001_green_baseline
  print_summary
}

main "$@"
