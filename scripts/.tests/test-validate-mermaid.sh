#!/usr/bin/env bash
# test-validate-mermaid.sh — Chromium-free test suite for validate-mermaid.sh (GH-110).
#
# Covers TC-MMD-001..004, TC-MMD-007, TC-MMD-009..011, and TC-BASE-001 (mmdc-gated
# green baseline, self-skipping). Every render-dependent case injects a
# deterministic fake mmdc via the MMDC_CMD env seam — NO real Chromium is ever
# required by this suite.
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

# Captured run output
_OUT=""
_ERR=""
_RC=0

# ----------------------------------------------------------------------------
# run_validator — invoke the validator as a subprocess, inheriting the current
# env (so exported MMDC_CMD propagates). Captures stdout, stderr, and exit code
# into _OUT / _ERR / _RC.
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

# TC-MMD-002 — valid block + success shim ⇒ exit 0.
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
  assert_exit_code 0 "${_RC}" "valid block must pass"
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

# TC-MMD-007 — valid block passes under --if-present when mmdc absent.
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

  # Multi-block indexing: two blocks, both fail; both indices reported.
  rm -f "${dir}/render.md"
  shim="${_test_tmpdir}/mmdc-fail2"
  make_fail_shim "${shim}"
  export MMDC_CMD="${shim}"
  cat >"${dir}/multi.md" <<'MMD'
# Multi

```mermaid
flowchart TD
    A --> B
```

text

```mermaid
sequenceDiagram
    Alice->>Bob: Hi
```
MMD
  run_validator "${dir}/multi.md"
  assert_exit_code 4 "${_RC}"
  comb="$(combined)"
  assert_contains "${comb}" "multi.md"
  assert_contains "${comb}" "block #1" "first failing block indexed #1"
  assert_contains "${comb}" "block #2" "second failing block indexed #2"
}

# TC-MMD-010 — determinism: identical verdict across runs; sorted file order.
test_mmd_010_determinism() {
  local dir shim
  dir="${_test_tmpdir}/fix"
  mkdir -p "${dir}"
  cat >"${dir}/z-file.md" <<'MMD'
```mermaid
flowchart TD
    A --> B
```
MMD
  cat >"${dir}/a-file.md" <<'MMD'
```mermaid
sequenceDiagram
    Alice->>Bob: Hi
```
MMD
  shim="${_test_tmpdir}/mmdc-fail"
  make_fail_shim "${shim}"
  export MMDC_CMD="${shim}"
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
  assert_exit_code 4 "${r1}" "render failure deterministic"
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
  run_test "TC-MMD-002 valid block passes" test_mmd_002_valid_block_passes
  run_test "TC-MMD-003 --help/--version behavior" test_mmd_003_help_version
  run_test "TC-MMD-004 MMDC_CMD injection (no Chromium)" test_mmd_004_mmdc_injection
  run_test "TC-MMD-007 valid passes under --if-present (mmdc absent)" test_mmd_007_valid_passes_if_present
  run_test "TC-MMD-009 message completeness + multi-block indexing" test_mmd_009_message_completeness_multiblock
  run_test "TC-MMD-010 determinism (sorted, identical verdict)" test_mmd_010_determinism
  run_test "TC-MMD-011 exit codes reachable & distinct" test_mmd_011_exit_codes_distinct
  run_test "TC-BASE-001 green baseline (mmdc-gated)" test_base_001_green_baseline
  print_summary
}

main "$@"
