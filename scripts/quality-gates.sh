#!/usr/bin/env bash
# quality-gates.sh — AI-tuned quality-gates runner/orchestrator.
#
# Resolves the repository's gate set (a declared gate-set file preferred, else
# the documented built-in default set), invokes each gate as a discrete unit,
# captures per-gate exit code + wall-clock duration, and emits an AI-actionable
# structured per-gate summary with log pointers. Exits non-zero if any gate
# fails — it never masks a gate failure (RSK-4).
#
# The runner INVOKES the repo's existing gates; it does not reimplement test or
# gate discovery (NG-1). It is the deterministic resolution target of `/check`.
#
# Dependencies: bash>=4, git, date, awk, tail, mkdir
# Usage: ./quality-gates.sh [all|fast|slow|<gate>...]   (see --help)
#
# Environment:
#   QGATES_GATE_SET_FILE  Path to a gate-set declaration file (preferred over
#                         the built-in default). One 'name command' per line;
#                         blank lines and '#' comments are ignored.
#   QGATES_OUTPUT_ROOT    Per-gate log root (default: <repo>/tmp/quality-gates).
#   VERBOSE               Set to 'true' for debug diagnostics on stderr.
#
# Output contract (AI-tuned; summary on stdout, diagnostics on stderr):
#   (quality-gates) START selector=<all|named> gates=<n>
#   (quality-gates) name=<gate> status=<PASS|FAIL> duration=<sec>s [exit=<n>]
#   (quality-gates) name=<gate> log=<path>            # only on FAIL
#   (quality-gates) name=<gate> excerpt:              # only on FAIL
#   (quality-gates)   | <bounded excerpt line>        # <= 10 lines
#   (quality-gates) SUMMARY passed=<n> failed=<n> total=<n> overall=<PASS|FAIL>
#
# Exit codes:
#   0 - All selected gates passed (or none selected)
#   1 - One or more selected gates failed
#   2 - Usage / invocation error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="quality-gates"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

# Exit-code contract (NFR-3 / DM-3): exactly two gate-verdict outcomes —
# 0 iff all pass; non-zero iff >=1 fails. Exit 2 is a pre-gate usage error.
readonly EXIT_ALL_PASS=0
readonly EXIT_SOME_FAIL=1
readonly EXIT_USAGE=2

# Configurable via environment (bash.md §10.1 — env-injectable settings).
QGATES_GATE_SET_FILE="${QGATES_GATE_SET_FILE:-}"
OUTPUT_ROOT=""
VERBOSE="${VERBOSE:-false}"

# Resolved gate registry (parallel indexed arrays; order is deterministic).
GATE_NAMES=()
GATE_CMDS=()

# Selector state.
SELECTOR_ARGS=()
SELECTED_NAMES=()
SELECTED_CMDS=()
SELECTOR_DESC="all"

# ============================================================================
# UTILITIES — logging (bash.md §5).
# Deviation from the §5 default: per this script's output contract (F-2 / NFR-5,
# Phase 3.3) ALL diagnostics — info progress, warnings, errors — go to stderr;
# ONLY the structured emit() summary goes to stdout. This keeps stdout a clean,
# machine-parseable per-gate report for @runner/@fixer.
# ============================================================================
log_info()  { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_err()   { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*" >&2; true; }

# Structured-summary emit (AI-actionable; always -> stdout).
emit() { printf '%s %s\n' "${LOG_TAG}" "$*"; }

# ============================================================================
# TRAPS — installed inside main() so sourcing the script is side-effect free
# (testable main guard, bash.md §10.4).
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "internal error at line ${line}: '${cmd}' exited ${code}"
}

_on_interrupt() {
  log_warn "interrupted"
  exit 130
}

_setup_traps() {
  trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
  trap '_on_interrupt' INT TERM
}

# ============================================================================
# REPO ROOT
# ============================================================================
_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

# ============================================================================
# USAGE
# ============================================================================
_usage() {
  cat <<'EOF'
Usage: quality-gates.sh [selector ...]

Run the repository's quality gates in one deterministic pass and emit an
AI-actionable per-gate summary (stable '(quality-gates)' tag) with log pointers.

Selectors (the args /check forwards):
  all              Run every gate in the resolved set (default when no args).
  <gate>           Run only the named gate(s); repeatable for a subset.
  fast, slow       NOT YET IMPLEMENTED — documented as future / deferred. They
                   are accepted and treated as 'all' (no duration-based
                   partition exists yet).

Unknown selectors are tolerated (warned and ignored) and NEVER mask a real
gate failure: a failing named gate still drives a non-zero exit.

Gate-set resolution (preferred first):
  1. QGATES_GATE_SET_FILE — explicit declaration file (one 'name command' per
                            line; '#' comments and blank lines ignored). This is
                            the documented extension point: a project adds or
                            overrides a gate via this file without editing the
                            script's core.
  2. Built-in default set  — this repo's real gates (listed below).

Built-in default gates (this repo — invoked, not reimplemented):
  bash-tests        bash scripts/test-all.sh
  doc-distribution  bash scripts/.tests/test-doc-distribution.sh
  plugin-freshness  bash scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/
  whitespace        git diff --check

Environment:
  QGATES_GATE_SET_FILE  Gate-set declaration file (preferred over the default).
  QGATES_OUTPUT_ROOT    Per-gate log root (default: <repo>/tmp/quality-gates).
  VERBOSE               Set to 'true' for debug diagnostics on stderr.

Output:
  Structured per-gate summary on stdout (stable '(quality-gates)' tag):
    name=<gate> status=<PASS|FAIL> duration=<sec>s [exit=<n>] [log=<path>]
  Diagnostics (progress, warnings) on stderr.
  Per-gate logs land under <QGATES_OUTPUT_ROOT>/<YYYY-MM-DD>/<gate>.log.

Exit codes:
  0  All selected gates passed (or none were selected).
  1  One or more selected gates failed.
  2  Usage / invocation error.
EOF
}

# ============================================================================
# CLI
# ============================================================================
parse_args() {
  SELECTOR_ARGS=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help) _usage; exit "${EXIT_ALL_PASS}" ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit "${EXIT_ALL_PASS}" ;;
      --)
        shift
        while [[ $# -gt 0 ]]; do SELECTOR_ARGS+=("$1"); shift; done
        ;;
      -*) log_err "unknown option: $1"; _usage >&2; exit "${EXIT_USAGE}" ;;
      *) SELECTOR_ARGS+=("$1") ;;
    esac
    shift
  done
}

# ============================================================================
# GATE-SET RESOLUTION (F-3)
# ----------------------------------------------------------------------------
# INVOKES (does not reimplement) the repo's real gates — NG-1 / RSK-1.
# ============================================================================
_load_builtin_default() {
  GATE_NAMES=(
    "bash-tests"
    "doc-distribution"
    "plugin-freshness"
    "whitespace"
  )
  GATE_CMDS=(
    "bash scripts/test-all.sh"
    "bash scripts/.tests/test-doc-distribution.sh"
    "bash scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/"
    "git diff --check"
  )
}

_parse_gate_set_file() {
  local -r file="$1"
  local name rest
  GATE_NAMES=()
  GATE_CMDS=()
  # IFS scoped to space/tab so 'read' splits the first token (name) from the
  # remainder (command). The global IFS=$'\n\t' is intentionally not used here.
  while IFS=$' \t' read -r name rest || [[ -n "${name:-}" ]]; do
    [[ -z "${name:-}" || "${name}" == \#* ]] && continue
    GATE_NAMES+=("${name}")
    GATE_CMDS+=("${rest}")
  done < "${file}"
}

resolve_gate_set() {
  if [[ -n "${QGATES_GATE_SET_FILE}" && -f "${QGATES_GATE_SET_FILE}" ]]; then
    log_info "using declared gate set: ${QGATES_GATE_SET_FILE}"
    _parse_gate_set_file "${QGATES_GATE_SET_FILE}"
  else
    log_info "using built-in default gate set"
    _load_builtin_default
  fi
}

# ============================================================================
# SELECTOR (F-4 / OQ-1 / DEC-4 / RSK-2)
# ============================================================================
apply_selector() {
  SELECTED_NAMES=()
  SELECTED_CMDS=()
  SELECTOR_DESC="all"

  # No args => run all gates (default = all) — AC-F4-1.
  if [[ ${#SELECTOR_ARGS[@]} -eq 0 ]]; then
    SELECTED_NAMES=("${GATE_NAMES[@]}")
    SELECTED_CMDS=("${GATE_CMDS[@]}")
    return
  fi

  local has_all=false has_future=false a
  for a in "${SELECTOR_ARGS[@]}"; do
    case "${a}" in
      all) has_all=true ;;
      fast|slow)
        # Documented future / deferred — no partition exists yet (OQ-1 / DEC-4).
        has_future=true
        log_warn "selector '${a}' is not yet implemented (documented future); running all gates"
        ;;
      *) : ;;  # candidate gate name — resolved below
    esac
  done

  # 'all', or a not-yet-implemented selector, => run the full resolved set.
  if [[ "${has_all}" == "true" || "${has_future}" == "true" ]]; then
    SELECTED_NAMES=("${GATE_NAMES[@]}")
    SELECTED_CMDS=("${GATE_CMDS[@]}")
    return
  fi

  # Named-gate subset — run only the named gates (AC-F4-2).
  SELECTOR_DESC="named"
  local i name found
  local unknowns=()
  for a in "${SELECTOR_ARGS[@]}"; do
    found=false
    for i in "${!GATE_NAMES[@]}"; do
      name="${GATE_NAMES[$i]}"
      if [[ "${name}" == "${a}" ]]; then
        SELECTED_NAMES+=("${name}")
        SELECTED_CMDS+=("${GATE_CMDS[$i]}")
        found=true
        break
      fi
    done
    [[ "${found}" == "true" ]] || unknowns+=("${a}")
  done

  # Unknown selectors are tolerated (warned/ignored), NEVER fatal-masking.
  if [[ ${#unknowns[@]} -gt 0 ]]; then
    for a in "${unknowns[@]}"; do
      log_warn "unknown selector '${a}' — ignored"
    done
  fi
}

# ============================================================================
# DISPATCH + REPORT (F-1, F-2 / NFR-3, NFR-5)
# ============================================================================
run_gate() {
  # Runs one gate command from repo root, capturing combined output to the log
  # file. Returns the gate's own exit code; never aborts the runner (RSK-4).
  local -r cmd="$2" logfile="$3"
  bash -c "${cmd}" >"${logfile}" 2>&1
}

_emit_excerpt() {
  # Emits a bounded (<= 10 line) tail excerpt of a gate's log with a stable tag.
  local -r logfile="$1"
  local -ri max_lines=10
  tail -n "${max_lines}" "${logfile}" 2>/dev/null | while IFS= read -r line; do
    printf '%s   | %s\n' "${LOG_TAG}" "${line}"
  done
  return 0
}

run_selected_gates() {
  local -r date_dir="${OUTPUT_ROOT}/$(date -u +%F)"
  mkdir -p "${date_dir}"

  local total="${#SELECTED_NAMES[@]}"
  local passed=0 failed=0 overall="${EXIT_ALL_PASS}"
  local i name cmd logfile rc start end duration

  emit "START selector=${SELECTOR_DESC} gates=${total}"

  for i in "${!SELECTED_NAMES[@]}"; do
    name="${SELECTED_NAMES[$i]}"
    cmd="${SELECTED_CMDS[$i]}"
    logfile="${date_dir}/${name}.log"
    log_info "running gate: ${name}"

    rc=0
    start=$(date +%s.%N)
    # The '|| rc=$?' prevents set -e from aborting on a gate failure — the
    # failure is captured and reported, never masked (RSK-4).
    run_gate "${name}" "${cmd}" "${logfile}" || rc=$?
    end=$(date +%s.%N)
    duration=$(awk -v s="${start}" -v e="${end}" 'BEGIN{printf "%.3f", e-s}')

    if [[ "${rc}" -eq "${EXIT_ALL_PASS}" ]]; then
      emit "name=${name} status=PASS duration=${duration}s"
      passed=$((passed + 1))
    else
      emit "name=${name} status=FAIL duration=${duration}s exit=${rc}"
      emit "name=${name} log=${logfile}"
      emit "name=${name} excerpt:"
      _emit_excerpt "${logfile}"
      failed=$((failed + 1))
      overall="${EXIT_SOME_FAIL}"
    fi
  done

  local verdict="PASS"
  [[ "${failed}" -gt 0 ]] && verdict="FAIL"
  emit "SUMMARY passed=${passed} failed=${failed} total=${total} overall=${verdict}"
  return "${overall}"
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  _setup_traps

  local root
  root="$(_repo_root)" || {
    log_err "not a git repository (cannot determine repo root)"
    exit "${EXIT_USAGE}"
  }
  cd "${root}"

  OUTPUT_ROOT="${QGATES_OUTPUT_ROOT:-$(pwd)/tmp/quality-gates}"

  parse_args "$@"
  resolve_gate_set
  apply_selector

  if [[ ${#SELECTED_NAMES[@]} -eq 0 ]]; then
    log_warn "no gates selected; nothing to run"
    emit "START selector=${SELECTOR_DESC} gates=0"
    emit "SUMMARY passed=0 failed=0 total=0 overall=PASS"
    exit "${EXIT_ALL_PASS}"
  fi

  local rc=0
  run_selected_gates || rc=$?
  exit "${rc}"
}

# Testable main guard (bash.md §10.4) — sourcing defines functions only.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
