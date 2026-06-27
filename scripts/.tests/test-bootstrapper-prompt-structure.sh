#!/usr/bin/env bash
# test-bootstrapper-prompt-structure.sh — Layer-1 static/structural guard for the
# @bootstrapper agent prompt (GH-71, TC-INFRA-001).
#
# The artifact under change is an agent PROMPT (the prompt IS the product). Most
# acceptance criteria are behavioral and cannot be executed in CI (RSK-2); they
# are signed off manually at the GH-71 PR review. This script bundles the Layer-1
# structural invariants that ARE CI-automatable, guarding the high-probability
# regression class (structural drift — RSK-6) and measuring prompt bloat (RSK-1).
#
# Bundled checks (see chg-GH-71-test-plan.md):
#   TC-STRUCT-001  write-allowlist inception + code-review + documentation-profile paths
#   TC-STRUCT-002  inception Phase 5 references all four *-instructions.md
#   TC-STRUCT-003  legacy two-tier parity vs BOOTSTRAPPER_BASELINE_SHA
#                    Tier A: frozen blocks byte-identical
#                    Tier B: shared blocks preserve every baseline line (additions OK)
#   TC-STRUCT-004  guide referenced, not recreated (per-phase line-overlap heuristic)
#   TC-STRUCT-005  XML-ish section tags well-formed (code-span-aware)
#   TC-STRUCT-008  anti-sycophancy placement (anchor-based, per <phase_N_inception>)
#   TC-STRUCT-009  Phase 0 characteristics detection (4 signals) + both modes referenced
#   TC-STRUCT-010  Phase 0 material-inventory step
#   TC-STRUCT-011  committed state + four-risk tags + per-mode state rule + no 'desirability'
#   TC-STRUCT-012  secrets-prohibition language for inception state
#   RSK-1          prompt-size guardrail (warn >~650, hard-fail >~800 lines; tunable)
#
# All checks are read-only greps/diffs; deterministic; CI-safe (no network, no
# mutation of repo files). Exits 0 on the green baseline; non-zero (with
# ::error:: GitHub annotations) on any drift.
set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly REPO_ROOT
readonly TAG="(bootstrapper-structure)"

AGENT="${REPO_ROOT}/.opencode/agent/bootstrapper.md"
GUIDE="${REPO_ROOT}/doc/guides/project-inception.md"
# Parity baseline: the last commit on the agent source before GH-71 (GH-69 merge).
# Overridable so CI is not hard-coupled to this SHA.
readonly BOOTSTRAPPER_BASELINE_SHA="${BOOTSTRAPPER_BASELINE_SHA:-0a1a28802b0e893eba30b636f2fae7b72aa31965}"
# Prompt-size guardrail thresholds (RSK-1). Warn is a soft signal; fail is fatal.
readonly WARN_LINES="${BOOTSTRAPPER_WARN_LINES:-650}"
readonly FAIL_LINES="${BOOTSTRAPPER_FAIL_LINES:-800}"
# Per-phase guide↔prompt line-overlap ceiling (TC-STRUCT-004 duplication heuristic).
readonly MAX_OVERLAP="${BOOTSTRAPPER_MAX_OVERLAP:-0.30}"

_failures=0
_warnings=0
_tmpdir=""

emit_error() {
  printf '::error::%s\n' "$*"
  printf '%s[FAIL] %s\n' "${TAG}" "$*" >&2
  _failures=$((_failures + 1))
}

emit_warn() {
  printf '::warning::%s\n' "$*"
  printf '%s[WARN] %s\n' "${TAG}" "$*" >&2
  _warnings=$((_warnings + 1))
}

require_file() {
  [[ -f "$1" ]] || emit_error "missing file: $1"
}

# --- helpers ----------------------------------------------------------------

# strip fenced code blocks AND inline backtick spans → a code-span-aware view.
# Used for tag well-formedness so prose references like `<tracker_workflow_discovery>`
# and the YAML-schema fence inside <persistent_state> do not fool the tag counter.
strip_spans() {
  awk '
    /^```/ { in_fence = !in_fence; next }
    in_fence { next }
    {
      line = $0
      while (match(line, /`[^`]*`/)) {
        line = substr(line, 1, RSTART - 1) substr(line, RSTART + RLENGTH)
      }
      print line
    }
  ' "$1"
}

# extract a <tag>...</tag> block from a raw file, skipping fenced code blocks.
extract_block() {
  awk '/^```/{c=!c;next} !c && /<'"$1"'>/{f=1} f{print} /<\/'"$1"'>/{f=0}' "$2"
}

# extract the guide's "### Phase N" block (raw guide; phases 1-7 are fence-free).
extract_guide_phase() {
  awk -v n="$1" '$0 ~ "^### Phase "n" "{off=1} off{print} /^### Phase [0-7]/ && $0 !~ "^### Phase "n" "{off=0}' "$2"
}

cleanup() {
  if [[ -n "${_tmpdir}" && -d "${_tmpdir}" ]]; then rm -rf "${_tmpdir}"; fi
}
trap cleanup EXIT

# --- preconditions ----------------------------------------------------------
require_file "$AGENT"
require_file "$GUIDE"
_tmpdir="$(mktemp -d)"
BASELINE="${_tmpdir}/baseline-bootstrapper.md"
STRIPPED="${_tmpdir}/stripped-bootstrapper.md"
strip_spans "$AGENT" > "$STRIPPED"

if ! git -C "${REPO_ROOT}" show "${BOOTSTRAPPER_BASELINE_SHA}:.opencode/agent/bootstrapper.md" > "${BASELINE}" 2>/dev/null; then
  emit_error "parity baseline ${BOOTSTRAPPER_BASELINE_SHA} is not reachable via git (cannot run TC-STRUCT-003)"
fi

# --- TC-STRUCT-001: write-allowlist paths -----------------------------------
allowlist_block="$(extract_block write_allowlist "$AGENT")"
if [[ -z "${allowlist_block}" ]]; then
  emit_error "TC-STRUCT-001: <write_allowlist> block not found"
else
  printf '%s\n' "${allowlist_block}" | grep -qE 'doc/inception/\*\*' \
    || emit_error "TC-STRUCT-001: <write_allowlist> missing doc/inception/**"
  printf '%s\n' "${allowlist_block}" | grep -qE '\.ai/agent/code-review-instructions\.md' \
    || emit_error "TC-STRUCT-001: <write_allowlist> missing .ai/agent/code-review-instructions.md"
  printf '%s\n' "${allowlist_block}" | grep -qE 'doc/inception/abandoned-[A-Za-z0-9_*-]*\.ya?ml' \
    || emit_error "TC-STRUCT-001: <write_allowlist> missing doc/inception/abandoned-*.yaml (DEC-6 archive target)"
  printf '%s\n' "${allowlist_block}" | grep -qE 'doc/documentation-profile\.md' \
    || emit_error "TC-STRUCT-001: <write_allowlist> missing doc/documentation-profile.md (REM-5)"
fi

# --- TC-STRUCT-002: inception Phase 5 references all four instruction files --
phase5_block="$(extract_block phase_5_inception "$AGENT")"
if [[ -z "${phase5_block}" ]]; then
  emit_error "TC-STRUCT-002: <phase_5_inception> block not found"
else
  for name in pm pr decision code-review; do
    printf '%s\n' "${phase5_block}" | grep -qE "\.ai/agent/${name}-instructions\.md" \
      || emit_error "TC-STRUCT-002: Phase 5 inception block missing .ai/agent/${name}-instructions.md"
  done
fi

# --- TC-STRUCT-003: legacy two-tier parity ----------------------------------
frozen_tags=(workflow_phases persistent_state phase_1_repo_scan phase_2_confidence \
             phase_3_interview phase_4_draft phase_5_review phase_6_write)
shared_tags=(resume_behavior write_allowlist)

# anchors must open AND close (both tiers).
for tag in "${frozen_tags[@]}" "${shared_tags[@]}"; do
  if ! grep -qE "<${tag}>" "$AGENT" || ! grep -qE "</${tag}>" "$AGENT"; then
    emit_error "TC-STRUCT-003: legacy anchor <${tag}> missing or unbalanced"
  fi
done
# legacy state path + schema version must live inside <persistent_state>.
ps_block="$(extract_block persistent_state "$AGENT")"
printf '%s\n' "${ps_block}" | grep -qE '\.ai/local/bootstrapper-context\.yaml' \
  || emit_error "TC-STRUCT-003: <persistent_state> missing .ai/local/bootstrapper-context.yaml"
printf '%s\n' "${ps_block}" | grep -qE 'schema_version: 1' \
  || emit_error "TC-STRUCT-003: <persistent_state> missing schema_version: 1"

if [[ -s "${BASELINE}" ]]; then
  # Tier A — frozen blocks must be byte-identical vs baseline.
  for tag in "${frozen_tags[@]}"; do
    if ! diff <(extract_block "$tag" "$AGENT") <(extract_block "$tag" "$BASELINE") >/dev/null; then
      emit_error "TC-STRUCT-003 Tier A: frozen block <${tag}> drifted vs ${BOOTSTRAPPER_BASELINE_SHA}"
    fi
  done
  # Tier B — shared blocks: every baseline non-empty line still present verbatim.
  for tag in "${shared_tags[@]}"; do
    new_block="$(extract_block "$tag" "$AGENT")"
    while IFS= read -r line; do
      [[ -z "${line}" ]] && continue
      printf '%s\n' "${new_block}" | grep -qF -- "${line}" \
        || emit_error "TC-STRUCT-003 Tier B: shared block <${tag}> dropped baseline line: ${line}"
    done < <(extract_block "$tag" "$BASELINE")
  done
fi

# --- TC-STRUCT-004: guide referenced, not recreated -------------------------
grep -qE 'doc/guides/project-inception\.md' "$AGENT" \
  || emit_error "TC-STRUCT-004: agent does not reference doc/guides/project-inception.md"

for n in 1 2 3 4 5 6 7; do
  guide_block="$(extract_guide_phase "$n" "$GUIDE")"
  [[ -z "${guide_block}" ]] && continue
  prompt_block="$(extract_block "phase_${n}_inception" "$AGENT")"
  total="$(printf '%s\n' "${guide_block}" | grep -c . || true)"
  [[ "${total}" -gt 0 ]] || continue
  hits=0
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    if printf '%s\n' "${prompt_block}" | grep -qF -- "${line}"; then
      hits=$((hits + 1))
    fi
  done <<< "${guide_block}"
  ratio="$(awk -v h="${hits}" -v t="${total}" 'BEGIN{printf "%.3f", h/t}')"
  if awk -v r="${ratio}" -v m="${MAX_OVERLAP}" 'BEGIN{exit !(r > m)}'; then
    emit_error "TC-STRUCT-004: guide↔prompt overlap for Phase ${n} too high: ${ratio} > ${MAX_OVERLAP} (duplication suspected)"
  fi
done

# --- TC-STRUCT-005: well-formed section tags (code-span-aware) ---------------
opens="$(grep -oE '<[a-z_0-9]+>' "${STRIPPED}" | sed -E 's/<([a-z_0-9]+)>/\1/' | sort)"
closes="$(grep -oE '</[a-z_0-9]+>' "${STRIPPED}" | sed -E 's/<\/([a-z_0-9]+)>/\1/' | sort)"
if ! diff <(printf '%s\n' "${opens}") <(printf '%s\n' "${closes}") >/dev/null; then
  emit_error "TC-STRUCT-005: unbalanced XML-ish section tags (open/close multiset mismatch)"
fi

# --- TC-STRUCT-008: anti-sycophancy placement (anchor-based) ----------------
declare -A want_tech=(
  [1]='devil.?s advocate|four.?risk'
  [2]='pre.?mortem|four.?risk'
  [3]='alternative comparison|pre.?mortem'
  [4]='unknown.?unknowns'
)
for n in 1 2 3 4; do
  block="$(extract_block "phase_${n}_inception" "$AGENT")"
  if [[ -z "${block}" ]]; then
    emit_error "TC-STRUCT-008: <phase_${n}_inception> block not found"
    continue
  fi
  printf '%s\n' "${block}" | grep -qE '<anti_sycophancy>' \
    || emit_error "TC-STRUCT-008: Phase ${n} missing <anti_sycophancy> anchor"
  printf '%s\n' "${block}" | grep -qEi "${want_tech[$n]}" \
    || emit_error "TC-STRUCT-008: Phase ${n} <anti_sycophancy> missing technique (${want_tech[$n]})"
done
for n in 0 5 6 7; do
  block="$(extract_block "phase_${n}_inception" "$AGENT")"
  [[ -z "${block}" ]] && continue
  if printf '%s\n' "${block}" | grep -qE '<anti_sycophancy>'; then
    emit_error "TC-STRUCT-008: Phase ${n} must NOT contain an <anti_sycophancy> anchor"
  fi
done

# --- TC-STRUCT-009: characteristics detection + both modes ------------------
for c in ui_bearing multi_user complex_domain code_project; do
  grep -qE "\b${c}\b" "$AGENT" \
    || emit_error "TC-STRUCT-009: missing characteristic signal ${c}"
done
grep -qEi 'flow.*new|mode:[[:space:]]*new' "$AGENT" \
  || emit_error "TC-STRUCT-009: 'new' mode/flow not referenced"
grep -qEi 'flow.*legacy|mode:[[:space:]]*legacy' "$AGENT" \
  || emit_error "TC-STRUCT-009: 'legacy' mode/flow not referenced"

# --- TC-STRUCT-010: Phase 0 material-inventory step -------------------------
grep -qE 'doc/inception/inputs/' "$AGENT" \
  || emit_error "TC-STRUCT-010: Phase 0 does not reference doc/inception/inputs/"
grep -qEi 'material inventory' "$AGENT" \
  || emit_error "TC-STRUCT-010: 'material inventory' not referenced"

# --- TC-STRUCT-011: committed state + four-risk tags + per-mode rule --------
grep -qE 'doc/inception/inception-state\.yaml' "$AGENT" \
  || emit_error "TC-STRUCT-011: committed state path doc/inception/inception-state.yaml not referenced"
for t in Value Usability Feasibility Viability; do
  grep -qE "\b${t}\b" "$AGENT" \
    || emit_error "TC-STRUCT-011: missing four-risk tag ${t}"
done
if grep -qEi 'desirability' "$AGENT"; then
  emit_error "TC-STRUCT-011: non-canonical four-risk term 'desirability' present (use Value/Usability/Feasibility/Viability)"
fi
grep -qE '\.ai/local/bootstrapper-context\.yaml' "$AGENT" \
  || emit_error "TC-STRUCT-011: legacy git-ignored state path no longer named"

# --- TC-STRUCT-012: secrets-prohibition for inception state -----------------
grep -qEi 'NEVER (store|contain) secrets|must NEVER contain secrets' "$AGENT" \
  || emit_error "TC-STRUCT-012: inception-state secrets-prohibition language missing"

# --- RSK-1: prompt-size guardrail -------------------------------------------
lines="$(wc -l < "$AGENT")"
if (( lines > FAIL_LINES )); then
  emit_error "RSK-1: bootstrapper.md is ${lines} lines (> ${FAIL_LINES}); prompt-bloat hard limit exceeded"
elif (( lines > WARN_LINES )); then
  emit_warn "RSK-1: bootstrapper.md is ${lines} lines (> ${WARN_LINES}); approaching prompt-bloat limit — consider trimming"
fi

# --- verdict ----------------------------------------------------------------
if (( _failures > 0 )); then
  printf '%s[FAIL] %d structural failure(s)\n' "${TAG}" "${_failures}" >&2
  exit 1
fi
printf '%s[OK]   bootstrapper prompt structure is sound (%d warnings; %d lines)\n' "${TAG}" "${_warnings}" "${lines}"
exit 0
