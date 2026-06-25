#!/usr/bin/env bash
# test-doc-distribution.sh — GH-67 doc-distribution drift guard.
#
# Forces the `ados_distribution` marker + install-set invariants on the closed
# DM-2 doc set. Pure POSIX (bash/awk/sort/find); no YAML library, no network
# (NFR-2/NFR-4). Exits 0 on the green baseline; non-zero (with named-condition
# `::error::` annotations) on any of the FIVE failure modes (spec §8.3, plan 3.2):
#   1. missing-marker            — an in-scope doc with no marker
#   2. invalid-enum-value        — value not in {redistributable,internal,project-generated}
#   3. redistributable-not-installed — a redistributable doc absent from the install set
#   4. internal-installed        — an internal doc present in the install set
#   5. derived-set drift         — marker-derived install set != sandbox install set
#
# The drift detector is an INDEPENDENT ORACLE: the EXPECTED set is derived from
# markers + the DM-2 enumeration + the known install rule; the ACTUAL set is
# derived from a real sandbox `install.sh --local` run. Only the get_marker()
# parser is shared with install.sh — the set derivation is reimplemented here.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly REPO_ROOT
readonly GUARD_TAG="(guard-doc-distribution)"
readonly VALID_ENUM_RE="^(redistributable|internal|project-generated)$"

# Standalone non-guide install targets — mirrors install.sh's ADOS_UPDATABLE_FILES
# non-guide entries (the install rule for docs that live outside the globbed
# guide/template classes). Independent copy => the oracle is not tautological.
readonly STANDALONE_INSTALL_TARGETS=(
  "doc/documentation-handbook.md"
  "doc/00-index.md"
  "doc/decisions/README.md"
  "doc/decisions/00-index.md"
  ".ai/rules/README.md"
)

_failures=0

# ----------------------------------------------------------------------------
# get_marker() — TWO-PATH parser (CRIT-1), mirrors install.sh EXACTLY.
#   .md        -> FIRST `---` frontmatter block only (line 1 must be `---`);
#                 within it match ^ados_distribution:[ \t]*(.+), skipping ^#;
#                 body / second-block occurrences are ignored.
#   .yaml/.yml -> a TOP-LEVEL ^ados_distribution: key anywhere (no `---` block;
#                 a `---` block would break yaml.safe_load() consumers).
# Returns the trimmed value, or "missing".
# ----------------------------------------------------------------------------
get_marker() {
  local -r file="$1"
  local ext="${file##*.}"
  case "${ext}" in
    md)
      awk '
        BEGIN { in_fm = 0; val = "missing" }
        NR == 1 && /^---[ \t]*$/ { in_fm = 1; next }
        in_fm && /^---[ \t]*$/ { in_fm = 0 }
        in_fm && /^[#]/ { next }
        in_fm && /^ados_distribution:[ \t]*.+$/ {
          s = $0
          sub(/^ados_distribution:[ \t]*/, "", s)
          sub(/[ \t]+$/, "", s)
          val = s
          in_fm = 0
        }
        END { print val }
      ' "${file}"
      ;;
    yaml|yml)
      awk '
        BEGIN { val = "missing" }
        /^ados_distribution:[ \t]*.+$/ {
          s = $0
          sub(/^ados_distribution:[ \t]*/, "", s)
          sub(/[ \t]+$/, "", s)
          val = s
        }
        END { print val }
      ' "${file}"
      ;;
    *)
      printf 'missing'
      ;;
  esac
}

valid_marker() {
  [[ "$1" =~ ${VALID_ENUM_RE} ]]
}

emit_error() {
  # GitHub Actions annotation (no-op outside CI) + plain stderr line.
  printf '::error::%s\n' "$*"
  printf '%s[FAIL] %s\n' "${GUARD_TAG}" "$*" >&2
  _failures=$((_failures + 1))
}

# ----------------------------------------------------------------------------
# get_marker() self-tests (RSK-1 / OQ-1): 4 .md + 3 .yaml cases.
# ----------------------------------------------------------------------------
run_self_tests() {
  local d failed=0 got
  d="$(mktemp -d)"

  # 1. .md with no frontmatter (line 1 is not `---`) -> missing.
  printf 'plain body\nados_distribution: redistributable\n' > "${d}/no-fm.md"
  got="$(get_marker "${d}/no-fm.md")"
  [[ "${got}" == "missing" ]] || { printf 'self-test 1 FAIL (no-frontmatter): expected missing, got %s\n' "${got}" >&2; failed=1; }

  # 2. .md whose marker-like line is only in the body -> missing.
  printf -- '---\n---\nados_distribution: redistributable\n' > "${d}/body.md"
  got="$(get_marker "${d}/body.md")"
  [[ "${got}" == "missing" ]] || { printf 'self-test 2 FAIL (body string): expected missing, got %s\n' "${got}" >&2; failed=1; }

  # 3. .md commented-out marker line inside the first block -> missing.
  printf -- '---\n# ados_distribution: redistributable\nsource: x\n---\n' > "${d}/commented.md"
  got="$(get_marker "${d}/commented.md")"
  [[ "${got}" == "missing" ]] || { printf 'self-test 3 FAIL (commented line): expected missing, got %s\n' "${got}" >&2; failed=1; }

  # 4. .md marker present only in a SECOND `---` block -> missing.
  printf -- '---\nsource: x\n---\n\n---\nados_distribution: redistributable\n---\n' > "${d}/second.md"
  got="$(get_marker "${d}/second.md")"
  [[ "${got}" == "missing" ]] || { printf 'self-test 4 FAIL (second block): expected missing, got %s\n' "${got}" >&2; failed=1; }

  # 5a. .yaml top-level key present -> matched.
  printf 'ados_distribution: redistributable\ncalendar_id: X\n' > "${d}/pos.yaml"
  got="$(get_marker "${d}/pos.yaml")"
  [[ "${got}" == "redistributable" ]] || { printf 'self-test 5a FAIL (yaml positive): expected redistributable, got %s\n' "${got}" >&2; failed=1; }

  # 5b. .yaml key absent -> missing.
  printf 'calendar_id: X\n' > "${d}/neg.yaml"
  got="$(get_marker "${d}/neg.yaml")"
  [[ "${got}" == "missing" ]] || { printf 'self-test 5b FAIL (yaml negative): expected missing, got %s\n' "${got}" >&2; failed=1; }

  # 5c. .yaml INDENTED (non-top-level) key -> missing (column-0 anchoring).
  printf 'parent:\n  ados_distribution: redistributable\n' > "${d}/indented.yaml"
  got="$(get_marker "${d}/indented.yaml")"
  [[ "${got}" == "missing" ]] || { printf 'self-test 5c FAIL (yaml indented): expected missing, got %s\n' "${got}" >&2; failed=1; }

  rm -rf "${d}"
  return "${failed}"
}

# ----------------------------------------------------------------------------
# Enumerate the closed DM-2 doc set (RSK-2: in-scope classes only).
# Prints ABSOLUTE paths (dedup + sort handled by caller).
# ----------------------------------------------------------------------------
enumerate_dm2() {
  local root="$1" f
  shopt -s globstar nullglob
  for f in "${root}/doc/guides"/*.md; do [[ -f "$f" ]] && printf '%s\n' "$f"; done
  for f in "${root}/doc/templates"/**/*.md; do [[ -f "$f" ]] && printf '%s\n' "$f"; done
  for f in "${root}/doc/templates"/**/*.yaml; do [[ -f "$f" ]] && printf '%s\n' "$f"; done
  shopt -u globstar nullglob
  for f in "${STANDALONE_INSTALL_TARGETS[@]}"; do
    [[ -f "${root}/${f}" ]] && printf '%s\n' "${root}/${f}"
  done
}

# ----------------------------------------------------------------------------
# Derive the EXPECTED install set from markers + the install rule.
# Prints REPO-RELATIVE paths (one per line).
# ----------------------------------------------------------------------------
derive_expected_install_set() {
  local f
  shopt -s globstar nullglob
  # Guides: marker-driven (only redistributable-marked install).
  for f in doc/guides/*.md; do
    [[ -f "$f" ]] || continue
    [[ "$(get_marker "$f")" == "redistributable" ]] && printf '%s\n' "$f"
  done
  # Templates: installed wholesale by recursive glob (install.sh does not
  # marker-filter templates). Their markers are enforced by modes 1 & 2.
  for f in doc/templates/**/*.md; do [[ -f "$f" ]] && printf '%s\n' "$f"; done
  for f in doc/templates/**/*.yaml; do [[ -f "$f" ]] && printf '%s\n' "$f"; done
  shopt -u globstar nullglob
  # Standalone explicit targets (mirror install.sh manifest).
  for f in "${STANDALONE_INSTALL_TARGETS[@]}"; do printf '%s\n' "$f"; done
}

# ----------------------------------------------------------------------------
# Derive the ACTUAL install set from a sandbox `install.sh --local` run.
# Independent oracle: observes the resulting files, does not reuse install logic.
# Prints REPO-RELATIVE paths (sandbox-relative == repo-relative for these docs).
# ----------------------------------------------------------------------------
derive_actual_install_set() {
  local sandbox log f rc
  sandbox="$(mktemp -d)"
  mkdir -p "${sandbox}/.git"
  log="$(mktemp)"

  set +e
  (
    cd "${sandbox}"
    ADOS_SOURCE_DIR="${REPO_ROOT}" NO_FETCH=true \
      bash "${REPO_ROOT}/scripts/install.sh" --local --no-fetch >"${log}" 2>&1
  )
  rc=$?
  set -e

  if [[ "${rc}" -ne 0 ]]; then
    printf 'sandbox install.sh exited %s:\n' "${rc}" >&2
    cat "${log}" >&2 || true
    rm -rf "${sandbox}" "${log}"
    return 1
  fi

  shopt -s globstar nullglob
  for f in "${sandbox}/doc/guides"/*.md; do [[ -f "$f" ]] && printf '%s\n' "${f#${sandbox}/}"; done
  for f in "${sandbox}/doc/templates"/**/*.md; do [[ -f "$f" ]] && printf '%s\n' "${f#${sandbox}/}"; done
  for f in "${sandbox}/doc/templates"/**/*.yaml; do [[ -f "$f" ]] && printf '%s\n' "${f#${sandbox}/}"; done
  shopt -u globstar nullglob
  for f in "${STANDALONE_INSTALL_TARGETS[@]}"; do
    [[ -f "${sandbox}/${f}" ]] && printf '%s\n' "$f"
  done

  rm -rf "${sandbox}" "${log}"
  return 0
}

main() {
  cd "${REPO_ROOT}"

  # --- Parser self-tests (gate everything else on a correct parser). ---
  if ! run_self_tests; then
    emit_error "get_marker() self-tests failed — parser is broken (see stderr above)"
    printf '%s[FAIL] aborting: parser self-tests failed\n' "${GUARD_TAG}" >&2
    exit 1
  fi
  printf '%s[OK]   get_marker() self-tests passed (4 .md + 3 .yaml cases)\n' "${GUARD_TAG}"

  local dm2_list expected actual marker f total
  dm2_list="$(mktemp)"; expected="$(mktemp)"; actual="$(mktemp)"

  # DM-2 enumeration -> repo-relative, sorted, unique.
  enumerate_dm2 "${REPO_ROOT}" | while read -r p; do printf '%s\n' "${p#${REPO_ROOT}/}"; done | sort -u > "${dm2_list}"
  total="$(wc -l < "${dm2_list}" | tr -d ' ')"

  # --- Modes 1 & 2: marker presence + closed-enum validity (per doc). ---
  while read -r f; do
    marker="$(get_marker "${REPO_ROOT}/${f}")"
    if [[ "${marker}" == "missing" ]]; then
      emit_error "missing-marker: ${f} has no ados_distribution marker"
    elif ! valid_marker "${marker}"; then
      emit_error "invalid-enum-value: ${f} marker '${marker}' is not one of {redistributable,internal,project-generated}"
    fi
  done < "${dm2_list}"

  # --- EXPECTED (markers + rule) and ACTUAL (sandbox install) sets. ---
  derive_expected_install_set | sort -u > "${expected}"
  if ! derive_actual_install_set | sort -u > "${actual}"; then
    emit_error "sandbox install run failed — cannot derive the actual install set"
    rm -f "${dm2_list}" "${expected}" "${actual}"
    exit 1
  fi

  # --- Mode 3: redistributable-not-installed. ---
  while read -r f; do
    if [[ "$(get_marker "${REPO_ROOT}/${f}")" == "redistributable" ]] && ! grep -qxF "${f}" "${actual}"; then
      emit_error "redistributable-not-installed: ${f} is redistributable but absent from the install set"
    fi
  done < "${dm2_list}"

  # --- Mode 4: internal-installed. ---
  while read -r f; do
    if [[ "$(get_marker "${REPO_ROOT}/${f}")" == "internal" ]] && grep -qxF "${f}" "${actual}"; then
      emit_error "internal-installed: ${f} is internal but IS in the install set"
    fi
  done < "${dm2_list}"

  # --- Mode 5: derived-set drift (expected == actual over DM-2 docs). ---
  if ! diff -u "${expected}" "${actual}" >/dev/null; then
    emit_error "derived-set drift: marker-derived install set != sandbox install set"
    {
      printf '    --- expected (markers+rule)\n'
      diff -u "${expected}" "${actual}" | sed 's/^/    /'
    } >&2 || true
  fi

  rm -f "${dm2_list}" "${expected}" "${actual}"

  if [[ "${_failures}" -gt 0 ]]; then
    printf '%s[FAIL] %d failure(s) across %d in-scope docs\n' "${GUARD_TAG}" "${_failures}" "${total}" >&2
    exit 1
  fi
  printf '%s[OK]   no drift — %d in-scope docs; install set matches ados_distribution markers\n' "${GUARD_TAG}" "${total}"
  exit 0
}

main "$@"
