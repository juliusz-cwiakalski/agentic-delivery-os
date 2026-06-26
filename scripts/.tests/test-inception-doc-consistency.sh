#!/usr/bin/env bash
# test-inception-doc-consistency.sh — cross-doc consistency guard for the
# GH-69 inception documentation set (guide + templates + handbook + index).
#
# The doc-distribution guard (test-doc-distribution.sh) validates the
# `ados_distribution` marker + install-set invariants, but NOT semantic/cell
# consistency BETWEEN the redistributable index surfaces. This test catches the
# class of drift that the GH-69 round-2 red-team found by hand:
#   - RT2-01: four-risk terminology drift ("desirability" instead of the
#     canonical Value/Usability/Feasibility/Viability) in templates/README.md;
#   - RT2-02: the handbook conditional matrix drifting from the guide's
#     canonical matrix (invented/missing rows).
# A future edit to one surface that drifts from the canonical guide now fails
# loudly instead of shipping verbatim to adopters.
#
# All checks are read-only greps; deterministic; CI-safe (no network, no temp
# mutation). Exits 0 on the green baseline; non-zero (with ::error:: annotations)
# on any drift.
set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly REPO_ROOT
readonly TAG="(inception-consistency)"

GUIDE="${REPO_ROOT}/doc/guides/project-inception.md"
HANDBOOK="${REPO_ROOT}/doc/documentation-handbook.md"
TEMPLATES_README="${REPO_ROOT}/doc/templates/README.md"

# The canonical four-risk lens set (Value / Usability / Feasibility / Viability).
# "desirability" is the wrong term that once drifted into templates/README.md.
readonly FOUR_RISK=("Value" "Usability" "Feasibility" "Viability")
readonly WRONG_RISK_TERM="desirability"

# Files that ENUMERATE the four-risk vocabulary and so must contain all four
# canonical terms. (The handbook is a condensed index — it is NOT required to
# enumerate all four; it is only required not to use the wrong term.)
readonly FOUR_RISK_FILES=(
  "${GUIDE}"
  "${TEMPLATES_README}"
  "${REPO_ROOT}/doc/templates/assumption-register-template.md"
  "${REPO_ROOT}/doc/templates/risk-register-template.md"
)

# The 5 conditional-matrix project-type columns (exact header-row string).
readonly MATRIX_HEADER="CLI/API only | Library | Web app new | Web app legacy | Business repo"

# The 17 inception templates that must be indexed in doc/templates/README.md.
readonly INCEPTION_TEMPLATES=(
  architecture-overview-template.md
  tech-stack-template.md
  glossary-template.md
  roadmap-engineering-template.md
  ubiquitous-language-template.md
  repo-analysis-template.md
  inception-summary-template.md
  inception-state-template.yaml
  material-inventory-template.md
  opportunity-solution-tree-template.md
  project-prd-template.md
  persona-jtbd-template.md
  user-journey-template.md
  screen-inventory-template.md
  ux-guidance-template.md
  assumption-register-template.md
  risk-register-template.md
)

_failures=0

emit_error() {
  printf '::error::%s\n' "$*"
  printf '%s[FAIL] %s\n' "${TAG}" "$*" >&2
  _failures=$((_failures + 1))
}

require_file() {
  [[ -f "$1" ]] || emit_error "missing file: $1"
}

# Extract the sorted, unique row-label set of the CONDITIONAL matrix — the table
# whose header is "Artifact | CLI/API only | Library | ...". The header match
# uniquely targets the conditional matrix (the always-produced catalog tables
# have different columns), so this does not pick up unrelated tables.
matrix_labels() {
  awk -F'|' '
    /^\|[[:space:]]*Artifact[[:space:]]*\|[[:space:]]*CLI\/API only/ { m=1; next }
    m && /^\|/ {
      c=$2; sub(/^[[:space:]]+/, "", c); sub(/[[:space:]]+$/, "", c)
      if (c != "" && c !~ /^[-]+$/) print c
    }
    m && !/^\|/ { m=0 }
  ' "$1" | sort -u
}

# --- Preconditions -----------------------------------------------------------
for f in "${GUIDE}" "${HANDBOOK}" "${TEMPLATES_README}" \
         "${REPO_ROOT}/doc/templates/assumption-register-template.md" \
         "${REPO_ROOT}/doc/templates/risk-register-template.md"; do
  require_file "$f"
done

# --- Check 1: canonical four-risk vocabulary (+ wrong term absent) -----------
# The enumerating files must carry all four canonical terms.
for f in "${FOUR_RISK_FILES[@]}"; do
  for term in "${FOUR_RISK[@]}"; do
    grep -qiE "${term}" "$f" \
      || emit_error "four-risk term '${term}' missing in $(basename "$f")"
  done
done
# The wrong term "desirability" must NEVER appear in the inception four-risk
# surfaces (RT2-01 drift guard). Scoped to the inception index/definition
# surfaces to avoid false positives in unrelated business templates.
DESIRABILITY_FILES=(
  "${GUIDE}"
  "${HANDBOOK}"
  "${TEMPLATES_README}"
  "${REPO_ROOT}/doc/overview/README.md"
  "${REPO_ROOT}/doc/templates/assumption-register-template.md"
  "${REPO_ROOT}/doc/templates/risk-register-template.md"
)
for f in "${DESIRABILITY_FILES[@]}"; do
  if grep -qiE "${WRONG_RISK_TERM}" "$f"; then
    emit_error "wrong four-risk term '${WRONG_RISK_TERM}' present in ${f#${REPO_ROOT}/} — use Value/Usability/Feasibility/Viability"
  fi
done

# --- Check 2: conditional-matrix header row present in guide AND handbook ----
for f in "${GUIDE}" "${HANDBOOK}"; do
  grep -qF "${MATRIX_HEADER}" "$f" \
    || emit_error "conditional-matrix header row missing in $(basename "$f") (expected the 5 project-type columns)"
done

# --- Check 3: conditional-matrix consistency (handbook ⊆ guide + landmarks) --
# The handbook conditional matrix is a CONDENSED subset of the guide's full
# matrix (the guide lists every artifact; the handbook omits the always-produced
# rows). Two invariants guard the RT2-02 drift class (invented OR dropped rows),
# which a bare term grep cannot catch (the term also appears in prose):
#  (a) handbook rows must be a SUBSET of guide rows — catches an invented row in
#      the handbook (e.g. a spurious "Ubiquitous language" matrix row).
#  (b) unambiguously-conditional landmark rows must appear in BOTH — catches a
#      dropped row (e.g. "Tribal knowledge" removed from either surface).
_guide_labels="$(matrix_labels "${GUIDE}")"
_hb_labels="$(matrix_labels "${HANDBOOK}")"
if [[ -z "${_guide_labels}" ]]; then
  emit_error "could not extract the guide conditional-matrix row labels (header not found?)"
fi
# (a) subset: every handbook row must appear in the guide (no invented rows).
#     grep -qxF (exact-line, locale-independent) — avoids comm's sort-order issues.
while IFS= read -r _label; do
  [[ -n "${_label}" ]] || continue
  grep -qxF "${_label}" <(printf '%s\n' "${_guide_labels}") \
    || emit_error "handbook conditional matrix has a row absent from the guide (invented/drifted): '${_label}'"
done < <(printf '%s\n' "${_hb_labels}")
# (b) landmark conditional rows must appear in BOTH surfaces.
for _lm in "Tribal knowledge" "OST" "Repo analysis"; do
  grep -qxF "${_lm}" <(printf '%s\n' "${_guide_labels}") \
    || emit_error "guide conditional matrix missing landmark row '${_lm}'"
  grep -qxF "${_lm}" <(printf '%s\n' "${_hb_labels}") \
    || emit_error "handbook conditional matrix missing landmark row '${_lm}' (dropped-row drift)"
done

# --- Check 4: every inception template is indexed in templates/README --------
grep -qiE "inception templates" "${TEMPLATES_README}" \
  || emit_error "doc/templates/README.md has no 'Inception templates' category"
for t in "${INCEPTION_TEMPLATES[@]}"; do
  grep -qF "${t}" "${TEMPLATES_README}" \
    || emit_error "inception template '${t}' is not indexed in doc/templates/README.md"
done

# --- Check 5: self-containment — no .ai/local/inception refs in deliverables -
SELF_CONTAIN_FILES=(
  "${GUIDE}"
  "${REPO_ROOT}/doc/templates/README.md"
  "${HANDBOOK}"
  "${REPO_ROOT}/doc/overview/README.md"
)
_self_violation=0
while IFS= read -r -d '' f; do
  if grep -qI "\.ai/local/inception" "$f"; then
    emit_error "self-containment violation: ${f#${REPO_ROOT}/} references .ai/local/inception"
    _self_violation=1
  fi
done < <(find "${REPO_ROOT}/doc/inception" "${REPO_ROOT}/doc/templates" \
              -type f \( -name '*.md' -o -name '*.yaml' \) -print0 2>/dev/null)
for f in "${SELF_CONTAIN_FILES[@]}"; do
  if grep -qI "\.ai/local/inception" "$f"; then
    emit_error "self-containment violation: ${f#${REPO_ROOT}/} references .ai/local/inception"
    _self_violation=1
  fi
done

# --- Check 6: guide structural integrity (4 diagrams / 8 phases / >=32 sub) --
_mermaid=$(grep -cE '^[[:space:]]*```mermaid[[:space:]]*$' "${GUIDE}")
[[ "${_mermaid}" -eq 4 ]] \
  || emit_error "guide has ${_mermaid} mermaid blocks (expected 4)"
_phases=$(grep -cE '^#+[[:space:]]*Phase[[:space:]]+[0-7]\b' "${GUIDE}")
[[ "${_phases}" -eq 8 ]] \
  || emit_error "guide has ${_phases} phase sections (expected 8)"
_sub=$(grep -cE '^#+[[:space:]]+(Activities|Anti-sycophancy|Human[[:space:]]+gate|Outputs)' "${GUIDE}")
[[ "${_sub}" -ge 32 ]] \
  || emit_error "guide has ${_sub} phase sub-parts (expected >=32: 8 phases x 4)"

# --- Verdict -----------------------------------------------------------------
if [[ "${_failures}" -gt 0 ]]; then
  printf '%s[FAIL] %d consistency failure(s)\n' "${TAG}" "${_failures}" >&2
  exit 1
fi
printf '%s[OK]   inception doc set is internally consistent (four-risk, matrix, index, self-containment, structure)\n' "${TAG}"
exit 0
