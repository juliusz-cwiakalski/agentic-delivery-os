#!/usr/bin/env bash
# test-doc-distribution.sh — GH-67 doc-distribution drift guard.
#
# Forces the `ados_distribution` marker + install-set invariants on the closed
# DM-2 doc set. Requires bash>=4 (uses `shopt globstar`); otherwise POSIX
# (awk/sort/find), no YAML library, no network (NFR-2/NFR-4). Exits 0 on the
# green baseline; non-zero (with named-condition `::error::` annotations) on any
# of the FIVE failure modes (spec §8.3, plan 3.2):
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

# --- bash>=4 capability check (Fix: silent under-scan on macOS bash 3.2) ---
# `shopt globstar` (used by enumerate_dm2 / derive_*_install_set) is bash>=4. On
# macOS system bash 3.2 the option does not exist; under `set -e` the failed
# `shopt -s globstar` would otherwise abort, and without `set -e` it would
# silently under-scan. Fail loudly instead. install.sh also requires bash>=4.
if ! (shopt -s globstar) >/dev/null 2>&1; then
  printf '::error::%s requires bash>=4 (globstar unsupported by this shell: %s). On macOS install bash 4+ (e.g. "brew install bash") or run via the CI container.\n' \
    "${0##*/}" "${BASH_VERSION:-unknown}" >&2
  printf '%s[FAIL] requires bash>=4 (globstar unsupported) — aborting\n' "${GUARD_TAG}" >&2
  exit 1
fi

# Root under test. Defaults to this repo; the negative-mode harness
# (test-doc-distribution-modes.sh) overrides via ADOS_GUARD_ROOT to scan a
# synthetic doc tree, so each of the 5 failure modes can be exercised in CI.
_GUARD_ROOT="${ADOS_GUARD_ROOT:-${REPO_ROOT}}"

# --- temp-artifact cleanup on early termination (Fix: leaked temp dirs on Ctrl-C) ---
# The guard creates dm2_list/expected/actual files and (when deriving the real
# install set) a sandbox + log. Register every temp path; rm -rf is idempotent on
# the normal-exit path, so an EXIT/INT/TERM trap never leaks even on Ctrl-C.
_guard_tmp_paths=()
_guard_register_tmp() { _guard_tmp_paths+=("$@"); }
_guard_cleanup() {
  # ${#arr[@]} (no `:-` default; that is invalid syntax). The array is always
  # declared above, so under `set -u` an empty array reads as 0 here.
  if [[ ${#_guard_tmp_paths[@]} -gt 0 ]]; then
    rm -rf "${_guard_tmp_paths[@]}" 2>/dev/null || true
  fi
}
trap _guard_cleanup EXIT INT TERM

# Standalone non-guide DOC paths to SCAN (marker presence/validity) — MIRRORS
# install.sh's ADOS_UPDATABLE_FILES non-guide entries, PLUS doc/decisions/00-index.md
# which is `project-generated` (scanned for a valid marker but NOT installed — PR
# #74 review C3). This is the SCAN set (every path is marker-checked by modes 1
# & 2). The EXPECTED install set is derived marker-aware (only `redistributable`
# standalone docs install) in derive_expected_install_set. The ACTUAL set is
# observed from the sandbox (see derive_actual_install_set). This is an
# INDEPENDENT COPY so the oracle is not tautological: if the two lists drift,
# mode 5 (derived-set drift) fires. The two lists MUST be kept in sync by hand
# (or derived the same way) — see DEC-2 / ODR-0001.
readonly STANDALONE_DOCS=(
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
        # CRLF tolerance (Fix): strip a trailing CR per record so the ^---$ /
        # ^ados_distribution: regexes still match on a Windows working tree.
        { sub(/\r$/, "") }
        NR == 1 && /^---[ \t]*$/ { in_fm = 1; next }
        in_fm && /^---[ \t]*$/ { in_fm = 0 }
        in_fm && /^[#]/ { next }
        in_fm && /^ados_distribution:[ \t]*.+$/ {
          s = $0
          sub(/^ados_distribution:[ \t]*/, "", s)
          sub(/[ \t]+$/, "", s)
          # Quote stripping (Fix): valid YAML allows `ados_distribution: "x"`
          # / '"x"' — return the bare enum value so the enum check matches.
          sub(/^['"'"'"]/, "", s)
          sub(/['"'"'"]$/, "", s)
          val = s
          in_fm = 0
        }
        END { print val }
      ' "${file}"
      ;;
    yaml|yml)
      awk '
        BEGIN { val = "missing" }
        # CRLF tolerance (Fix) + quote stripping (Fix) — see the .md path above.
        { sub(/\r$/, "") }
        /^ados_distribution:[ \t]*.+$/ {
          s = $0
          sub(/^ados_distribution:[ \t]*/, "", s)
          sub(/[ \t]+$/, "", s)
          sub(/^['"'"'"]/, "", s)
          sub(/['"'"'"]$/, "", s)
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
# get_marker() self-tests (RSK-1 / OQ-1): 7 .md + 4 .yaml cases (incl. CRLF +
# quoted-value coverage added per the post-delivery review findings).
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

  # 6. .md with CRLF (\\r\\n) line endings + valid marker -> still parses (Fix).
  printf -- '---\r\nados_distribution: redistributable\r\n---\r\nbody\r\n' > "${d}/crlf.md"
  got="$(get_marker "${d}/crlf.md")"
  [[ "${got}" == "redistributable" ]] || { printf 'self-test 6 FAIL (CRLF): expected redistributable, got %s\n' "${got}" >&2; failed=1; }

  # 7. .md with a DOUBLE-quoted marker value -> bare enum returned (Fix).
  printf -- '---\nados_distribution: "redistributable"\n---\nbody\n' > "${d}/quoted-dq.md"
  got="$(get_marker "${d}/quoted-dq.md")"
  [[ "${got}" == "redistributable" ]] || { printf 'self-test 7 FAIL (double-quoted value): expected redistributable, got %s\n' "${got}" >&2; failed=1; }

  # 8. .md with a SINGLE-quoted marker value -> bare enum returned (Fix).
  #    (printf %s avoids embedding a literal ' in the format string.)
  printf -- '---\nados_distribution: %sredistributable%s\n---\nbody\n' "'" "'" > "${d}/quoted-sq.md"
  got="$(get_marker "${d}/quoted-sq.md")"
  [[ "${got}" == "redistributable" ]] || { printf 'self-test 8 FAIL (single-quoted value): expected redistributable, got %s\n' "${got}" >&2; failed=1; }

  # 9. .yaml with CRLF + quoted value -> bare enum returned (Fix).
  printf -- 'ados_distribution: "internal"\r\ncalendar_id: X\r\n' > "${d}/crlf-quoted.yaml"
  got="$(get_marker "${d}/crlf-quoted.yaml")"
  [[ "${got}" == "internal" ]] || { printf 'self-test 9 FAIL (yaml CRLF+quoted): expected internal, got %s\n' "${got}" >&2; failed=1; }

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
  for f in "${STANDALONE_DOCS[@]}"; do
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
  # Standalone explicit targets — marker-aware: only `redistributable`-marked
  # standalone docs install. decisions/00-index.md is `project-generated` and is
  # therefore excluded from the EXPECTED install set (PR #74 review C3). Mirrors
  # install.sh's ADOS_UPDATABLE_FILES non-guide entries.
  for f in "${STANDALONE_DOCS[@]}"; do
    [[ "$(get_marker "$f")" == "redistributable" ]] && printf '%s\n' "$f"
  done
}

# ----------------------------------------------------------------------------
# Derive the ACTUAL install set from a sandbox `install.sh --local` run.
# Independent oracle: observes the resulting files, does not reuse install logic.
# Prints REPO-RELATIVE paths (sandbox-relative == repo-relative for these docs).
# ----------------------------------------------------------------------------
derive_actual_install_set() {
  local sandbox log f rc

  # TEST SEAM (Fix: committed negative-mode self-tests). When the harness sets
  # ADOS_GUARD_ACTUAL_SET_FILE, emit that file (sorted) instead of running
  # install.sh, so modes 3/4/5 can be exercised deterministically regardless of
  # install.sh's behavior. Unset => the real independent-oracle install run below
  # (unchanged CI behavior).
  if [[ -n "${ADOS_GUARD_ACTUAL_SET_FILE:-}" ]]; then
    sort -u "${ADOS_GUARD_ACTUAL_SET_FILE}"
    return 0
  fi

  sandbox="$(mktemp -d)"; _guard_register_tmp "${sandbox}"
  mkdir -p "${sandbox}/.git"
  log="$(mktemp)"; _guard_register_tmp "${log}"

  set +e
  (
    cd "${sandbox}"
    ADOS_SOURCE_DIR="${_GUARD_ROOT}" NO_FETCH=true \
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
  for f in "${STANDALONE_DOCS[@]}"; do
    [[ -f "${sandbox}/${f}" ]] && printf '%s\n' "$f"
  done

  rm -rf "${sandbox}" "${log}"
  return 0
}

main() {
  cd "${_GUARD_ROOT}"

  # --- Parser self-tests (gate everything else on a correct parser). ---
  if ! run_self_tests; then
    emit_error "get_marker() self-tests failed — parser is broken (see stderr above)"
    printf '%s[FAIL] aborting: parser self-tests failed\n' "${GUARD_TAG}" >&2
    exit 1
  fi
  printf '%s[OK]   get_marker() self-tests passed (7 .md + 4 .yaml cases)\n' "${GUARD_TAG}"

  local dm2_list expected actual marker f total
  dm2_list="$(mktemp)"; expected="$(mktemp)"; actual="$(mktemp)"
  _guard_register_tmp "${dm2_list}" "${expected}" "${actual}"

  # DM-2 enumeration -> root-relative, sorted, unique.
  enumerate_dm2 "${_GUARD_ROOT}" | while read -r p; do printf '%s\n' "${p#${_GUARD_ROOT}/}"; done | sort -u > "${dm2_list}"
  total="$(wc -l < "${dm2_list}" | tr -d ' ')"

  # --- Modes 1 & 2: marker presence + closed-enum validity (per doc). ---
  while read -r f; do
    marker="$(get_marker "${_GUARD_ROOT}/${f}")"
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
    if [[ "$(get_marker "${_GUARD_ROOT}/${f}")" == "redistributable" ]] && ! grep -qxF "${f}" "${actual}"; then
      emit_error "redistributable-not-installed: ${f} is redistributable but absent from the install set"
    fi
  done < "${dm2_list}"

  # --- Mode 4: internal-installed. ---
  while read -r f; do
    if [[ "$(get_marker "${_GUARD_ROOT}/${f}")" == "internal" ]] && grep -qxF "${f}" "${actual}"; then
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
