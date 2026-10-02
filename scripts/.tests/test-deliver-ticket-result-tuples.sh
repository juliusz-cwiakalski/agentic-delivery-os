#!/usr/bin/env bash
# test-deliver-ticket-result-tuples.sh — PDEV-516 F-3 content guard.
#
# The delivery `result` domain is a documented contract consumed by the CEO
# loop, batch-deliver.sh, and fork/join. The canonical machine-readable source
# is the `result=<…>` help line of scripts/deliver-ticket.sh. This guard scans
# the configured current-truth docs for every enumeration of result values and
# fails when a detected enumeration omits a canonical value — so a new result
# value cannot land against stale documentation.
#
# Matching rule (spec DM-5 / DEC-7), deterministic and offline:
#   * each doc is split into enumeration units at blank lines and Markdown
#     block markers (`#`, `-`, `*`, `+`, `>`, `|`, or `digit.`/`digit)`);
#     newline-wrapped lines within a unit are joined with single spaces
#     (required for the wrapped INV-DM-1 sentence in delivery-modes.md);
#   * each unit is tokenized as maximal `[A-Za-z0-9-]+` runs; a token counts as
#     a result token only when its ASCII-lowercase form EXACTLY equals a
#     canonical value (case-insensitive; boundary-aware, so `pr-open-unverified`
#     never credits `pr-open`; result-like-only, so `clean-merged-branches` /
#     `squash-merged` are ignored);
#   * a unit is an enumeration iff it holds >= RESULT_ENUM_QUORUM distinct
#     result tokens (baseline full enumerations hold 8; the densest
#     non-enumeration baseline unit holds 3);
#   * PASS iff every detected enumeration contains the full canonical set and
#     every configured doc contains at least one detected enumeration.
#
# The generated `.ados-claude/` plugin is intentionally NOT scanned: it is a
# faithful projection of the `.opencode/` source, guarded by verify-claude-build
# (DEC-6). Test seams: RESULT_TUPLE_SCAN_ROOT overrides the doc root and
# RESULT_TUPLE_CANONICAL_SCRIPT overrides the canonical result-domain source.
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd -P)"
readonly REPO_ROOT

CANONICAL_SCRIPT="${RESULT_TUPLE_CANONICAL_SCRIPT:-${REPO_ROOT}/scripts/deliver-ticket.sh}"
SCAN_ROOT="${RESULT_TUPLE_SCAN_ROOT:-${REPO_ROOT}}"
readonly CANONICAL_SCRIPT SCAN_ROOT

# Minimum number of DISTINCT result tokens for a unit to count as an
# enumeration. Baseline full enumerations hold 8 distinct tokens; the densest
# non-enumeration unit holds 3, so 4 cleanly separates enumeration from prose.
readonly RESULT_ENUM_QUORUM=4

readonly DOCS=(
  ".opencode/agent/ceo.md"
  "doc/guides/delivery-modes.md"
  "doc/spec/features/feature-autonomous-delivery.md"
)

# awk program: emit one enumeration unit per line, joining wrapped lines.
readonly AWK_UNITS='
function is_marker(line,   s) {
  s = line
  sub(/^[ \t]+/, "", s)
  if (s ~ /^[#*+>|-]/) return 1
  if (s ~ /^[0-9]+[.)]/) return 1
  return 0
}
{
  line = $0
  if (line ~ /^[ \t]*$/) {
    if (started) { print unit; unit = ""; started = 0 }
    next
  }
  if (is_marker(line)) {
    if (started) { print unit; unit = "" }
    started = 1
    unit = line
    next
  }
  if (!started) { started = 1; unit = line }
  else { unit = unit " " line }
}
END { if (started) print unit }
'

# Derive the canonical result values (lowercased) from the help line.
derive_canonical() {
  local line inner
  if ! line="$(grep -m1 -E '^[[:space:]]*result=<[^>]*>' "${CANONICAL_SCRIPT}" 2>/dev/null)"; then
    printf 'ERROR: canonical result= help line not found in %s\n' "${CANONICAL_SCRIPT}" >&2
    return 1
  fi
  inner="${line#*result=<}"
  inner="${inner%%>*}"
  if [[ -z "${inner}" ]]; then
    printf 'ERROR: canonical result= help line is empty in %s\n' "${CANONICAL_SCRIPT}" >&2
    return 1
  fi
  local IFS='|'
  local -a parts
  read -r -a parts <<<"${inner}"
  local p
  for p in "${parts[@]}"; do
    printf '%s\n' "${p}" | tr 'A-Z' 'a-z'
  done
}

# check_unit <doc-rel> <unit-text>: return non-zero when the unit is a
# detected enumeration that omits a canonical value. Increments ENUMERATIONS.
check_unit() {
  local -r rel="$1" unit="$2"
  local tokens=""
  tokens="$(printf '%s' "${unit}" | grep -oE '[A-Za-z0-9-]+' | tr 'A-Z' 'a-z' | sort -u)" || tokens=""

  local -A present=()
  local tok c
  while IFS= read -r tok; do
    [[ -n "${tok}" ]] || continue
    for c in "${CANONICAL[@]}"; do
      if [[ "${tok}" == "${c}" ]]; then
        present["${c}"]=1
      fi
    done
  done <<<"${tokens}"

  local count="${#present[@]}"
  if (( count >= RESULT_ENUM_QUORUM )); then
    ENUMERATIONS=$((ENUMERATIONS + 1))
    local -a missing=()
    for c in "${CANONICAL[@]}"; do
      [[ -n "${present[${c}]:-}" ]] || missing+=("${c}")
    done
    if (( ${#missing[@]} > 0 )); then
      printf 'FAIL: %s: result enumeration omits: %s\n' "${rel}" "${missing[*]}"
      return 1
    fi
  fi
  return 0
}

main() {
  local -a CANONICAL
  if ! mapfile -t CANONICAL < <(derive_canonical); then
    printf 'FAIL: could not derive canonical result set\n' >&2
    exit 2
  fi
  # shellcheck disable=SC2034 # Used indirectly by check_unit.
  CANONICAL=("${CANONICAL[@]}")
  if (( ${#CANONICAL[@]} == 0 )); then
    printf 'FAIL: empty canonical result set\n' >&2
    exit 2
  fi

  printf 'result-tuple guard: canonical set (%d): ' "${#CANONICAL[@]}"
  local canonical_display=""
  printf -v canonical_display '%s ' "${CANONICAL[@]}"
  printf '%s\n' "${canonical_display% }"

  local overall_rc=0 rel doc
  for rel in "${DOCS[@]}"; do
    case "${rel}" in
      .ados-claude/*)
        printf 'ERROR: generated plugin must not be scanned: %s\n' "${rel}" >&2
        overall_rc=1
        continue
        ;;
    esac
    doc="${SCAN_ROOT}/${rel}"
    if [[ ! -f "${doc}" ]]; then
      printf 'FAIL: configured doc missing: %s\n' "${rel}" >&2
      overall_rc=1
      continue
    fi

    ENUMERATIONS=0
    local doc_rc=0 unit
    while IFS= read -r unit; do
      [[ -n "${unit}" ]] || continue
      check_unit "${rel}" "${unit}" || doc_rc=1
    done < <(awk "${AWK_UNITS}" "${doc}")

    if (( doc_rc != 0 )); then
      overall_rc=1
    fi
    if (( ENUMERATIONS == 0 )); then
      printf 'FAIL: %s: no result enumeration found\n' "${rel}" >&2
      overall_rc=1
    elif (( doc_rc == 0 )); then
      printf 'OK:   %s: %d enumeration(s)\n' "${rel}" "${ENUMERATIONS}"
    fi
  done

  if (( overall_rc != 0 )); then
    printf 'FAIL: result-tuple guard detected stale documentation\n' >&2
    exit 1
  fi
  printf 'OK:   result-tuple guard passed (quorum=%d)\n' "${RESULT_ENUM_QUORUM}"
  exit 0
}

main "$@"
