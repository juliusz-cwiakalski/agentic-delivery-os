#!/usr/bin/env bash
# test-doc-distribution-modes.sh — committed negative-mode self-tests for the
# GH-67 doc-distribution drift guard (scripts/.tests/test-doc-distribution.sh).
#
# The guard documents FIVE failure modes but, before this harness, only proved
# them via out-of-band manual injection — nothing in CI re-proved a mode actually
# fires. For EACH mode this harness builds a tiny synthetic doc tree in a temp
# dir, injects the defect, runs the guard, and asserts non-zero exit + the
# expected mode/error identifier. A future refactor that silently disables a
# mode now turns this test red.
#
# Deterministic + CI-safe: temp dirs only, no network. The ACTUAL install set is
# injected via the guard's ADOS_GUARD_ACTUAL_SET_FILE test seam (so modes 3/4/5
# reproduce regardless of install.sh's behavior); the guard's own get_marker()
# parser self-tests still run as normal.
set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly REPO_ROOT
readonly GUARD="${REPO_ROOT}/scripts/.tests/test-doc-distribution.sh"
readonly TAG="(guard-modes-test)"

_pass=0
_fail=0
_tmp_paths=()

cleanup() {
  if [[ ${#_tmp_paths[@]} -gt 0 ]]; then rm -rf "${_tmp_paths[@]}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

# Write a .md doc with a frontmatter ados_distribution marker.
mkmd() {
  local -r path="$1" value="$2"
  mkdir -p "$(dirname "$path")"
  printf -- '---\nados_distribution: %s\nsource: synthetic\n---\nbody\n' "$value" > "$path"
}

# Write a .md doc with NO frontmatter marker (plain body).
mkmd_nomarker() {
  local -r path="$1"
  mkdir -p "$(dirname "$path")"
  printf 'plain body, no frontmatter marker\n' > "$path"
}

# Build the consistent baseline tree (all redistributable, valid markers) under
# $1 and echo the matching EXPECTED == ACTUAL install set (repo-relative paths).
build_baseline() {
  local -r root="$1"
  mkmd "${root}/doc/guides/guide-a.md"         redistributable
  mkmd "${root}/doc/templates/tmpl.md"         redistributable
  mkmd "${root}/doc/documentation-handbook.md" redistributable
  mkmd "${root}/doc/00-index.md"               redistributable
  mkmd "${root}/doc/decisions/README.md"       redistributable
  mkmd "${root}/doc/decisions/00-index.md"     redistributable
  mkmd "${root}/.ai/rules/README.md"           redistributable
  cat <<'EOF'
.ai/rules/README.md
doc/00-index.md
doc/decisions/00-index.md
doc/decisions/README.md
doc/documentation-handbook.md
doc/guides/guide-a.md
doc/templates/tmpl.md
EOF
}

# Remove a single repo-relative line from an actual-set file (set -e safe).
actual_remove() {
  local -r file="$1" line="$2"
  local tmp
  tmp="$(mktemp)"; _tmp_paths+=("${tmp}")
  grep -vxF -- "${line}" "${file}" > "${tmp}" || true
  mv "${tmp}" "${file}"
}

# Run the guard against $root with the injected actual set; sets _guard_rc and
# _guard_stderr (stderr only; stdout discarded).
run_guard() {
  local -r root="$1" actual_file="$2"
  set +e
  _guard_stderr="$(ADOS_GUARD_ROOT="${root}" ADOS_GUARD_ACTUAL_SET_FILE="${actual_file}" \
    bash "${GUARD}" 2>&1 >/dev/null)"
  _guard_rc=$?
  set -e
}

# assert_mode <label> <error_identifier> <root> <actual_file>
# Pass = guard exited non-zero AND stderr contains the expected identifier.
assert_mode() {
  local -r label="$1" id="$2" root="$3" actual="$4"
  run_guard "${root}" "${actual}"
  if [[ "${_guard_rc}" -ne 0 && "${_guard_stderr}" == *"${id}"* ]]; then
    printf '%s[OK]   %s fired (rc=%s)\n' "${TAG}" "${label}" "${_guard_rc}"
    _pass=$((_pass + 1))
  else
    printf '%s[FAIL] %s did NOT fire as expected (rc=%s, wanted id=%q)\n' \
      "${TAG}" "${label}" "${_guard_rc}" "${id}" >&2
    printf '       guard stderr:\n' >&2
    printf '%s\n' "${_guard_stderr}" | sed 's/^/         /' >&2
    _fail=$((_fail + 1))
  fi
}

# ----------------------------------------------------------------------------
# Per-mode tests. Each starts from the consistent baseline and injects ONE
# defect chosen so the target mode fires (see rationale comments).
# ----------------------------------------------------------------------------

# Mode 1: missing-marker — an in-scope doc with no marker.
m1_missing_marker() {
  local root actual
  root="$(mktemp -d)"; _tmp_paths+=("${root}")
  actual="$(mktemp)"; _tmp_paths+=("${actual}")
  build_baseline "${root}" > "${actual}"
  mkmd_nomarker "${root}/doc/guides/guide-a.md"   # defect: no marker
  # guide-a no longer redistributable -> drop from expected/actual so modes 3/5
  # stay quiet and ONLY mode 1 fires.
  actual_remove "${actual}" "doc/guides/guide-a.md"
  assert_mode "mode-1 missing-marker" "missing-marker" "${root}" "${actual}"
}

# Mode 2: invalid-enum-value — value not in {redistributable,internal,project-generated}.
m2_invalid_enum() {
  local root actual
  root="$(mktemp -d)"; _tmp_paths+=("${root}")
  actual="$(mktemp)"; _tmp_paths+=("${actual}")
  build_baseline "${root}" > "${actual}"
  mkmd "${root}/doc/guides/guide-a.md" "bogus-enum-value"   # defect
  actual_remove "${actual}" "doc/guides/guide-a.md"
  assert_mode "mode-2 invalid-enum-value" "invalid-enum-value" "${root}" "${actual}"
}

# Mode 3: redistributable-not-installed — a redistributable doc absent from the
# install set. (Mode 5 co-fires since expected != actual; we assert the mode-3 id.
# Disabling the mode-3 check would leave rc!=0 from mode 5 but drop the id -> FAIL.)
m3_redistributable_not_installed() {
  local root actual
  root="$(mktemp -d)"; _tmp_paths+=("${root}")
  actual="$(mktemp)"; _tmp_paths+=("${actual}")
  build_baseline "${root}" > "${actual}"
  # guide-a stays redistributable in the tree but is absent from the actual set.
  actual_remove "${actual}" "doc/guides/guide-a.md"
  assert_mode "mode-3 redistributable-not-installed" "redistributable-not-installed" "${root}" "${actual}"
}

# Mode 4: internal-installed — an internal doc present in the install set. A
# template marked internal is installed wholesale by install.sh, so it lands in
# the actual set while being internal. (expected still includes templates
# wholesale, so no mode-5 drift — only mode 4 fires.)
m4_internal_installed() {
  local root actual
  root="$(mktemp -d)"; _tmp_paths+=("${root}")
  actual="$(mktemp)"; _tmp_paths+=("${actual}")
  build_baseline "${root}" > "${actual}"
  mkmd "${root}/doc/templates/tmpl.md" internal   # defect: internal but installed
  assert_mode "mode-4 internal-installed" "internal-installed" "${root}" "${actual}"
}

# Mode 5: derived-set drift — expected != actual. A PHANTOM entry in the actual
# set (not present in the source tree) trips drift without touching any marker,
# so ONLY mode 5 fires (a missing redistributable doc would also trip mode 3).
m5_derived_set_drift() {
  local root actual
  root="$(mktemp -d)"; _tmp_paths+=("${root}")
  actual="$(mktemp)"; _tmp_paths+=("${actual}")
  build_baseline "${root}" > "${actual}"
  printf 'doc/templates/phantom.md\n' >> "${actual}"   # defect: phantom in install set
  assert_mode "mode-5 derived-set drift" "derived-set drift" "${root}" "${actual}"
}

main() {
  printf '%s start: 5 negative-mode self-tests\n' "${TAG}"
  m1_missing_marker
  m2_invalid_enum
  m3_redistributable_not_installed
  m4_internal_installed
  m5_derived_set_drift
  printf '%s done:   %d passed, %d failed\n' "${TAG}" "${_pass}" "${_fail}"
  if [[ "${_fail}" -gt 0 ]]; then
    printf '%s[FAIL] one or more guard modes did not fire — see output above\n' "${TAG}" >&2
    exit 1
  fi
  printf '%s[OK]   all 5 guard failure modes fire correctly\n' "${TAG}"
  exit 0
}

main "$@"
