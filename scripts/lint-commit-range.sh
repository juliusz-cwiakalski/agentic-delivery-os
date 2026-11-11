#!/usr/bin/env bash
# lint-commit-range.sh — lint the change branch's commit-message range against the
# repository's commitlint configuration and report per-commit attributed verdicts.
#
# Dependencies: bash>=4, git, commitlint (repository-local node_modules/.bin/commitlint
# or a commitlint on PATH). Read-only with respect to the repository and offline:
# it never fetches, never writes refs, the index, the working tree, or the stash,
# and removes its transient per-commit result directory on exit.
# Run ./scripts/lint-commit-range.sh --help for the invocation and exit contract.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="lint-commit-range"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

# Verdict-carrying exit codes. 130 is the interrupt convention (no verdict) and
# lives only in _on_interrupt.
readonly EXIT_PASS=0
readonly EXIT_VIOLATION=1
readonly EXIT_UNVERIFIABLE=2

readonly DEFAULT_BASE_REF="main"
readonly PR_INSTRUCTIONS_FILE="${ADOS_PR_INSTRUCTIONS_FILE:-.ai/agent/pr-instructions.md}"

readonly MAX_RULE_LINES_PER_COMMIT=20
readonly MAX_DIAGNOSTIC_LINES=200
readonly MAX_EXCERPT_CHARS=160
readonly CONDENSE_THRESHOLD=3
# Commitlint is spawned once per commit, so the wall-clock cost is bounded by
# running those independent processes concurrently. The cap keeps a large host
# from oversubscribing memory with node processes.
readonly MAX_LINT_JOBS=8

# The configuration filenames mirror commitlint's own cosmiconfig search places
# at the repository root, so a repository commitlint would enforce is never
# reported as unconfigured (a false SKIP is a silent pass). A root package.json
# `commitlint` property is detected separately by _has_package_json_config.
readonly CONFIG_CANDIDATES=(
  "commitlint.config.js"
  "commitlint.config.cjs"
  "commitlint.config.mjs"
  "commitlint.config.ts"
  "commitlint.config.cts"
  ".commitlintrc"
  ".commitlintrc.json"
  ".commitlintrc.yaml"
  ".commitlintrc.yml"
  ".commitlintrc.js"
  ".commitlintrc.cjs"
  ".commitlintrc.mjs"
  ".commitlintrc.ts"
  ".commitlintrc.cts"
)

# Runtime state (set by the resolution steps in main()).
BASE_OVERRIDE=""
BASE_OVERRIDE_SET="false"
BASE_REQUESTED=""
BASE_SOURCE=""
BASE_COMMIT=""
BASE_DISPLAY=""
BASE_REF_USED="unresolved"
MERGE_BASE=""
HEAD_SHA=""
REPO_TOP=""
COMMIT_COUNT=0
LINT_BINARY=""
BINARY_DISPLAY="none"
BINARY_ORIGIN="unavailable"

OFFENDER_COUNT=0
declare -A RULE_HITS=()
# Per-offender records, rendered only after the whole range is linted so the
# diagnostic budget can guarantee one headline per offender (AC-F2-1, NFR-10).
OFFENDER_SHAS=()
OFFENDER_MESSAGES=()
OFFENDER_RULES=()
DIAGNOSTIC_LINES=()
DIAGNOSTIC_APPENDED=0

# Per-commit worker scaffolding. Workers cannot mutate the parent's arrays, so
# each writes only into its own files under RESULT_DIR; the parent renders in
# rev-list order once every worker has been reaped.
RESULT_DIR=""
declare -a WORKER_PIDS=()
declare -a WORKER_STATUS=()

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  printf '[ERROR] %s line %s: %s (exit %s)\n' "${LOG_TAG}" "${line}" "${cmd}" "${code}" >&2
}

_on_exit() {
  if [[ -n "${RESULT_DIR}" && -d "${RESULT_DIR}" && "${RESULT_DIR}" == */lint-commit-range.* ]]; then
    rm -rf -- "${RESULT_DIR}"
  fi
}

_on_interrupt() {
  if ((${#WORKER_PIDS[@]})); then
    local pid
    for pid in "${WORKER_PIDS[@]}"; do
      kill "${pid}" 2>/dev/null || true
    done
  fi
  printf '[WARN]  %s interrupted; no verdict was produced\n' "${LOG_TAG}" >&2
  exit 130
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap '_on_exit' EXIT
trap '_on_interrupt' INT TERM

# ============================================================================
# USAGE (doubles as the file-level documentation)
# ============================================================================
usage() {
  cat <<'EOF'
Usage: ./scripts/lint-commit-range.sh [--base REF]

Lint every commit in this branch's own range (merge-base of the base ref and
HEAD, up to HEAD) against the repository's commitlint configuration. The
verdict is the configuration's verdict: no additional rule, no relaxed rule.

Options:
  --base REF      Base branch or ref to compare against. Precedence:
                  --base, then ADOS_BASE_BRANCH, then the
                  "Default base branch" line in ADOS_PR_INSTRUCTIONS_FILE
                  (default .ai/agent/pr-instructions.md), then main.
                  The remote-tracking ref refs/remotes/origin/REF is preferred
                  when it resolves.
  -h, --help      Show this help.
  -V, --version   Show the version.

Environment:
  ADOS_BASE_BRANCH           Environment override for the base ref.
  ADOS_PR_INSTRUCTIONS_FILE  Project configuration file that may declare the
                             default base branch.
  ADOS_LINT_JOBS             Maximum number of per-commit commitlint workers
                             to run in parallel. Defaults to the detected CPU
                             count, capped at 8; 1 forces serial execution.

Exit codes:
  0 - PASS or SKIP (all commits satisfy the configuration, or the repository
      configures no commitlint and there is no authority to mirror)
  1 - FAIL (one or more offending commits; attributed diagnostics and a
      remediation mode are reported)
  2 - ERROR or usage error (cannot verify: unresolvable base, undeterminable
      merge-base, unusable commitlint binary or configuration, or an invalid
      invocation)
  130 - Interrupted by a signal. This is the shell interrupt convention, not a
      verdict: no verdict line is produced.

The gate never fetches, never writes refs, the index, the working tree, or the
stash, and performs no network access.
EOF
}

# ============================================================================
# UTILITIES
# ============================================================================
log_info() { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*"; }
log_warn() { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_err() { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }

# Print usage to stderr and exit with the usage/error code.
_usage_error() {
  local -r problem="$1"
  printf 'Usage: ./scripts/lint-commit-range.sh [--base REF]\n' >&2
  printf 'Error: %s\n' "${problem}" >&2
  exit "${EXIT_UNVERIFIABLE}"
}

# Print the run header. Called once per terminal path; unknown values are
# reported explicitly so the header never implies work the gate did not do.
# `ref` is the ref actually used for the base commit (the requested ref, or the
# preferred refs/remotes/origin/<ref>), so a verdict is auditable to the exact
# ref rather than only to what the caller asked for (DM-1).
_print_header() {
  local -r base="${1:-unresolved}" source="${2:-none}" merge_base="${3:-unresolved}"
  local -r head="${4:-unresolved}" commits="${5:-unknown}" binary="${6:-none}" origin="${7:-unavailable}"
  local -r ref="${8:-unresolved}"
  printf 'RANGE LINT: base=%s source=%s merge-base=%s head=%s commits=%s binary=%s origin=%s ref=%s\n' \
    "${base}" "${source}" "${merge_base}" "${head}" "${commits}" "${binary}" "${origin}" "${ref}"
}

# Verdict lines are quotable evidence. Failing and error verdicts are mirrored to
# stderr so a caller that captures one stream still sees the failing signal.
_print_verdict() {
  local -r outcome="$1" detail="$2"
  printf 'VERDICT: %s — %s\n' "${outcome}" "${detail}"
  if [[ "${outcome}" == "FAIL" || "${outcome}" == "ERROR" ]]; then
    printf 'VERDICT: %s — %s\n' "${outcome}" "${detail}" >&2
  fi
}

# ============================================================================
# IMPURE: RESOLUTION (reads git state and the repository's configuration)
# ============================================================================

# Resolve the repository top level from the current working tree.
_resolve_repository() {
  local top
  if ! top="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    _print_header "unresolved" "none" "unresolved" "unresolved" "unknown" "none" "unavailable"
    printf 'Cause: the current directory is not inside a git repository.\n'
    printf 'Hint: run the gate from the repository root, or fetch/clone the repository first.\n'
    _print_verdict "ERROR" "cannot verify: not inside a git repository"
    exit "${EXIT_UNVERIFIABLE}"
  fi
  REPO_TOP="${top}"
}

# True when the repository carries a recognized commitlint configuration.
_has_commitlint_config() {
  local candidate
  for candidate in "${CONFIG_CANDIDATES[@]}"; do
    if [[ -e "${REPO_TOP}/${candidate}" ]]; then
      return 0
    fi
  done
  _has_package_json_config
}

# True when the root package.json declares a commitlint configuration object.
# commitlint's configuration property is an object, while a dependency named
# commitlint carries a version string, so requiring an object value keeps
# devDependencies from being mistaken for configuration. A config whose value
# starts on the next line is accepted too.
_has_package_json_config() {
  local -r file="${REPO_TOP}/package.json"
  [[ -r "${file}" ]] || return 1
  grep -qE '"commitlint"[[:space:]]*:[[:space:]]*(\{|[[:space:]]*$)' "${file}"
}

# Resolve the requested base ref in the fixed precedence: explicit override,
# environment override, project configuration, documented default.
_resolve_base_request() {
  if [[ "${BASE_OVERRIDE_SET}" == "true" ]]; then
    BASE_REQUESTED="${BASE_OVERRIDE}"
    BASE_SOURCE="explicit"
    return 0
  fi

  if [[ -n "${ADOS_BASE_BRANCH:-}" ]]; then
    BASE_REQUESTED="${ADOS_BASE_BRANCH}"
    BASE_SOURCE="environment"
    return 0
  fi

  if [[ -r "${REPO_TOP}/${PR_INSTRUCTIONS_FILE}" ]]; then
    local configured
    configured="$(sed -n 's/^- \*\*Default base branch\*\*:[[:space:]]*`\([^`]*\)`.*$/\1/p' \
      "${REPO_TOP}/${PR_INSTRUCTIONS_FILE}" | head -n 1)"
    if [[ -n "${configured}" ]]; then
      BASE_REQUESTED="${configured}"
      BASE_SOURCE="configuration"
      return 0
    fi
  fi

  BASE_REQUESTED="${DEFAULT_BASE_REF}"
  BASE_SOURCE="default"
}

# Resolve the base commit, preferring the remote-tracking ref when it exists.
# Never fetches: an unresolvable base is a loud inability to verify.
_resolve_base_commit() {
  local ref="${BASE_REQUESTED}"
  if git rev-parse --verify --quiet "refs/remotes/origin/${BASE_REQUESTED}^{commit}" >/dev/null 2>&1; then
    ref="refs/remotes/origin/${BASE_REQUESTED}"
  fi

  if ! BASE_COMMIT="$(git rev-parse --verify --quiet "${ref}^{commit}" 2>/dev/null)"; then
    _print_header "${BASE_REQUESTED}" "${BASE_SOURCE}" "unresolved" "${HEAD_SHA:-unresolved}" \
      "unknown" "none" "unavailable"
    printf "Cause: base ref '%s' does not resolve to a commit in this repository.\n" "${BASE_REQUESTED}"
    printf 'Hint: fetch the base branch so it exists locally, or pass a resolvable ref with --base REF.\n'
    _print_verdict "ERROR" "cannot verify: the base ref '${BASE_REQUESTED}' is unresolvable"
    exit "${EXIT_UNVERIFIABLE}"
  fi
  BASE_DISPLAY="${BASE_REQUESTED}"
  BASE_REF_USED="${ref}"
}

# Compute the range start. Failure is a loud error, never an empty range.
_resolve_merge_base() {
  if ! MERGE_BASE="$(git merge-base "${BASE_COMMIT}" "${HEAD_SHA}" 2>/dev/null)"; then
    _print_header "${BASE_DISPLAY}" "${BASE_SOURCE}" "unresolved" "${HEAD_SHA}" \
      "unknown" "none" "unavailable"
    printf 'Cause: no merge-base exists between base commit %s and HEAD %s.\n' "${BASE_COMMIT}" "${HEAD_SHA}"
    printf 'Hint: fetch the full history (unshallow the clone) so a common ancestor exists, then re-run.\n'
    _print_verdict "ERROR" "cannot verify: the merge-base between the base ref and HEAD is undeterminable"
    exit "${EXIT_UNVERIFIABLE}"
  fi
}

# Resolve the lint binary repository-local first, then PATH. The origin is
# disclosed because a foreign tool is a parity risk, not a verdict change.
_resolve_lint_binary() {
  local local_binary="${REPO_TOP}/node_modules/.bin/commitlint"
  if [[ -x "${local_binary}" ]]; then
    LINT_BINARY="${local_binary}"
    BINARY_DISPLAY="node_modules/.bin/commitlint"
    BINARY_ORIGIN="repository-local"
    return 0
  fi

  local path_binary
  if path_binary="$(command -v commitlint 2>/dev/null)" && [[ -n "${path_binary}" ]]; then
    LINT_BINARY="${path_binary}"
    BINARY_DISPLAY="${path_binary}"
    BINARY_ORIGIN="PATH"
    return 0
  fi

  return 1
}

# ============================================================================
# PURE: DIAGNOSTIC DERIVATION (derived from arguments only; no I/O, no state)
# ============================================================================

# Fold tab and carriage return, then strip ANSI escape sequences and control
# bytes so untrusted commit-message text can never reach a terminal or a log as
# an active sequence. UTF-8-encoded C1 controls are removed as whole sequences;
# other multi-byte characters survive unchanged.
_sanitize_excerpt_text() {
  local text="$1"
  text="${text//$'\t'/ }"
  text="${text//$'\r'/}"
  text="$(printf '%s' "${text}" |
    LC_ALL=C sed -e $'s/\x1b\\[[0-9;?]*[ -\\/]*[@-~]//g' \
      -e $'s/\x1b\\][^\x07]*\x07//g' \
      -e $'s/\x1b//g' \
      -e $'s/\xc2[\x80-\x9f]//g' |
    LC_ALL=C tr -d '\000-\010\012-\037\177')"
  printf '%s' "${text}"
}

# Bounded, single-line excerpt derived from message text (diagnostics only).
_bounded_excerpt() {
  _sanitize_excerpt_text "$1" | cut -c1-"${MAX_EXCERPT_CHARS}"
}

# Print the rule ids commitlint reported as problems, one per line, in the order
# the authority reported them. Only marker-prefixed problem lines are read, so
# the echoed `--- input ---` block can never contribute a phantom rule id.
_extract_problem_rule_ids() {
  local line
  while IFS= read -r line; do
    [[ "${line}" =~ ^[[:space:]]*(✖|⚠)[[:space:]] ]] || continue
    if [[ "${line}" =~ \[([a-z0-9-]+)\][[:space:]]*$ ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"
    fi
  done
}

# Index of the first line of the trailing trailer paragraph, or the line count
# when the message has no footer. A footer paragraph must be separated by a
# blank line and consist only of trailer-shaped lines.
_footer_start_index() {
  local -a lines=()
  mapfile -t lines < <(printf '%s\n' "$1")
  local -r total="${#lines[@]}"
  if [[ "${total}" -le 2 ]]; then
    printf '%s' "${total}"
    return 0
  fi

  local end=$((total - 1))
  while [[ "${end}" -gt 0 && -z "${lines[end]//[[:space:]]/}" ]]; do
    end=$((end - 1))
  done

  local start="${end}"
  while [[ "${start}" -gt 1 && -n "${lines[start - 1]//[[:space:]]/}" ]]; do
    start=$((start - 1))
  done

  if [[ "${start}" -le 1 || -n "${lines[start - 1]//[[:space:]]/}" ]]; then
    printf '%s' "${total}"
    return 0
  fi

  local i
  for ((i = start; i <= end; i++)); do
    if [[ ! "${lines[i]}" =~ ^[A-Za-z0-9-]+:\  && ! "${lines[i]}" =~ ^BREAKING[[:space:]]CHANGE: ]]; then
      printf '%s' "${total}"
      return 0
    fi
  done

  printf '%s' "${start}"
}

# Print the 1-based line number of the first over-long body line, or 0.
_first_overlong_body_line() {
  local -a lines=()
  mapfile -t lines < <(printf '%s\n' "$1")
  local -r total="${#lines[@]}"
  local footer_start
  footer_start="$(_footer_start_index "$1")"
  local i

  for ((i = 1; i < footer_start && i < total; i++)); do
    if [[ -n "${lines[i]}" && "${#lines[i]}" -gt 100 ]]; then
      printf '%s' "$((i + 1))"
      return 0
    fi
  done
  printf '0'
}

# Print the 1-based line number of the first over-long footer line, or 0.
_first_overlong_footer_line() {
  local -a lines=()
  mapfile -t lines < <(printf '%s\n' "$1")
  local -r total="${#lines[@]}"
  local footer_start
  footer_start="$(_footer_start_index "$1")"
  local i

  for ((i = footer_start; i < total; i++)); do
    if [[ -n "${lines[i]}" && "${#lines[i]}" -gt 100 ]]; then
      printf '%s' "$((i + 1))"
      return 0
    fi
  done
  printf '0'
}

# Attribute a rule id to a message line. Header rules and empty-type rules are
# line 1; length rules point at the first offending line of their section.
_line_for_rule() {
  local -r rule="$1" message="$2"
  case "${rule}" in
    body-max-line-length)
      local body_line
      body_line="$(_first_overlong_body_line "${message}")"
      if [[ "${body_line}" -gt 0 ]]; then
        printf '%s' "${body_line}"
        return 0
      fi
      ;;
    footer-max-line-length)
      local footer_line
      footer_line="$(_first_overlong_footer_line "${message}")"
      if [[ "${footer_line}" -gt 0 ]]; then
        printf '%s' "${footer_line}"
        return 0
      fi
      ;;
  esac
  printf '1'
}

# The message line used as the excerpt for a rule.
_excerpt_for_rule() {
  local -r rule="$1" message="$2" line_number="$3"
  local -a lines=()
  mapfile -t lines < <(printf '%s\n' "${message}")
  local index=$((line_number - 1))
  if [[ "${index}" -ge 0 && "${index}" -lt "${#lines[@]}" ]]; then
    _bounded_excerpt "${lines[index]}"
    return 0
  fi
  _bounded_excerpt "${lines[0]:-}"
}

# ============================================================================
# IMPURE: REPORTING (mutates run state and queries the repository)
# ============================================================================

# Append one diagnostic line while enforcing the total-output bound.
_append_diagnostic() {
  if [[ "${DIAGNOSTIC_APPENDED}" -ge "${MAX_DIAGNOSTIC_LINES}" ]]; then
    return 0
  fi
  DIAGNOSTIC_LINES+=("$1")
  DIAGNOSTIC_APPENDED=$((DIAGNOSTIC_APPENDED + 1))
}

# Append one offender's headline: the first rule, its attributed line, and a
# bounded excerpt of that line.
_append_offender_headline() {
  local -r index="$1"
  local -r sha="${OFFENDER_SHAS[index]}" message="${OFFENDER_MESSAGES[index]}"
  local -a rules=()
  mapfile -t rules < <(printf '%s\n' "${OFFENDER_RULES[index]}")

  local short_sha first_rule first_line first_excerpt
  short_sha="$(git rev-parse --short "${sha}")"
  first_rule="${rules[0]}"
  first_line="$(_line_for_rule "${first_rule}" "${message}")"
  first_excerpt="$(_excerpt_for_rule "${first_rule}" "${message}" "${first_line}")"

  _append_diagnostic "FAIL ${short_sha} (${sha}) · rule=${first_rule} line=${first_line} · ${first_excerpt}"
}

# Append the offender's bounded subject excerpt. DM-2 requires the block to name
# the commit by its subject, not only by the line that broke a rule.
_append_offender_subject() {
  local -r index="$1"
  local subject="${OFFENDER_MESSAGES[index]%%$'\n'*}"
  _append_diagnostic "  subject · $(_bounded_excerpt "${subject}")"
}

# The short SHAs of the offenders that did not fit the budget, bounded to 20
# names plus a count marker so the notice itself stays bounded.
_remaining_offender_shas() {
  local -r start="$1"
  local -i i count=0
  local -a names=()
  for ((i = start; i < ${#OFFENDER_SHAS[@]} && count < 20; i++)); do
    names+=("$(git rev-parse --short "${OFFENDER_SHAS[i]}")")
    count=$((count + 1))
  done
  local joined
  joined="$(printf '%s ' "${names[@]}")"
  joined="${joined% }"
  if [[ $((${#OFFENDER_SHAS[@]} - start)) -gt ${#names[@]} ]]; then
    printf '%s ...' "${joined}"
  else
    printf '%s' "${joined}"
  fi
}

# Render the diagnostics in two passes so the budget can never drop an offender:
# every offender's headline (and subject) first, then extra rule lines while the
# remaining budget lasts. A range too large to name one line per offender emits
# an explicit truncation notice naming the offenders that were not shown.
_render_diagnostics() {
  local -r total="${#OFFENDER_SHAS[@]}"
  [[ "${total}" -gt 0 ]] || return 0

  # The subject costs one extra line per offender; include it whenever every
  # offender can still be named within the budget.
  local -i include_subject=0
  if [[ $((total * 2)) -le "${MAX_DIAGNOSTIC_LINES}" ]]; then
    include_subject=1
  fi

  local -i shown="${total}" dropped=0
  if [[ "${total}" -ge "${MAX_DIAGNOSTIC_LINES}" ]]; then
    shown=$((MAX_DIAGNOSTIC_LINES - 1))
    dropped=$((total - shown))
  fi

  local -i i
  for ((i = 0; i < shown; i++)); do
    _append_offender_headline "${i}"
    if [[ "${include_subject}" -eq 1 ]]; then
      _append_offender_subject "${i}"
    fi
  done

  if [[ "${dropped}" -gt 0 ]]; then
    _append_diagnostic "TRUNCATED: ${dropped} further offending commit(s) not shown: $(_remaining_offender_shas "${shown}")"
  fi

  # Second pass: extra rule lines, round-robin so one chatty commit cannot
  # starve the others. Rule 1 of each offender is already in its headline.
  local -a rules=()
  local -i rule_index
  for ((rule_index = 1; rule_index < MAX_RULE_LINES_PER_COMMIT; rule_index++)); do
    for ((i = 0; i < shown; i++)); do
      [[ "${DIAGNOSTIC_APPENDED}" -lt "${MAX_DIAGNOSTIC_LINES}" ]] || return 0
      mapfile -t rules < <(printf '%s\n' "${OFFENDER_RULES[i]}")
      if [[ "${rule_index}" -ge "${#rules[@]}" ]]; then
        continue
      fi
      local rule="${rules[rule_index]}" line_number excerpt
      line_number="$(_line_for_rule "${rule}" "${OFFENDER_MESSAGES[i]}")"
      excerpt="$(_excerpt_for_rule "${rule}" "${OFFENDER_MESSAGES[i]}" "${line_number}")"
      _append_diagnostic "  rule=${rule} line=${line_number} · ${excerpt}"
    done
  done
}

# Lint one commit into its own per-index result files. Runs in a background
# subshell, so it must never write shared state or stdout: the parent renders
# diagnostics only after every worker is reaped, in rev-list order, which keeps
# the output byte-identical regardless of completion order.
#
# Files written (status last, so its presence means the record is complete):
#   <index>.message  the commit message
#   <index>.rules    one deduplicated rule id per line (offenders only)
#   <index>.status   `clean`, `offender`, or `error <commitlint-exit>`
#
# Returns 0 for every handled outcome. A non-zero return means the worker could
# not record a verdict (for example, it was killed); the collector turns a
# missing record into a fail-closed ERROR rather than a silent pass.
_lint_commit_to_result() {
  local -r index="$1" sha="$2"
  local -r prefix="${RESULT_DIR}/${index}"
  local message output status=0

  message="$(git log -1 --format=%B "${sha}")" || return 3
  output="$(printf '%s' "${message}" | "${LINT_BINARY}" --color=false 2>&1)" || status=$?

  printf '%s' "${message}" >"${prefix}.message" || return 3

  if [[ "${status}" -eq 0 ]]; then
    printf 'clean\n' >"${prefix}.status" || return 3
    return 0
  fi

  local -a parsed_rules=()
  mapfile -t parsed_rules < <(_extract_problem_rule_ids <<<"${output}")

  if [[ "${status}" -ge 2 || "${#parsed_rules[@]}" -eq 0 ]]; then
    printf 'error %s\n' "${status}" >"${prefix}.status" || return 3
    return 0
  fi

  local -a unique_rules=()
  declare -A seen=()
  local rule
  for rule in "${parsed_rules[@]}"; do
    if [[ -z "${seen[${rule}]:-}" ]]; then
      seen["${rule}"]=1
      unique_rules+=("${rule}")
    fi
  done

  printf '%s\n' "${unique_rules[@]}" >"${prefix}.rules" || return 3
  printf 'offender\n' >"${prefix}.status" || return 3
  return 0
}

# Worker budget: the requested override when valid, otherwise the detected CPU
# count (which already honours affinity), capped at MAX_LINT_JOBS. Any inability
# to detect a count degrades to a single worker, never to a wrong value.
_detect_lint_jobs() {
  local requested="${ADOS_LINT_JOBS:-}"
  local detected=""

  if [[ -n "${requested}" ]]; then
    if [[ "${requested}" =~ ^[1-9][0-9]*$ ]]; then
      detected="${requested}"
    else
      log_warn "ignoring ADOS_LINT_JOBS='${requested}': expected a positive integer"
    fi
  fi

  if [[ -z "${detected}" ]]; then
    if command -v nproc >/dev/null 2>&1; then
      detected="$(nproc 2>/dev/null || true)"
    elif command -v getconf >/dev/null 2>&1; then
      detected="$(getconf _NPROCESSORS_ONLN 2>/dev/null || true)"
    fi
  fi

  if [[ ! "${detected}" =~ ^[1-9][0-9]*$ ]]; then
    detected=1
  fi
  if ((detected > MAX_LINT_JOBS)); then
    detected="${MAX_LINT_JOBS}"
  fi
  printf '%s' "${detected}"
}

# Run at most `jobs` workers at a time, reaping the oldest whenever the budget
# is full, then drain the remainder. Every wait is guarded because workers
# legitimately exit non-zero on a violation or an unrenderable verdict.
_start_lint_workers() {
  local -a commits=("$@")
  local -r total="${#commits[@]}"
  ((total > 0)) || return 0

  local jobs
  jobs="$(_detect_lint_jobs)"
  if ((jobs > total)); then
    jobs="${total}"
  fi

  local -a pids=()
  local -i started=0 reaped=0 index
  for ((index = 0; index < total; index++)); do
    _lint_commit_to_result "${index}" "${commits[index]}" &
    pids[index]=$!
    WORKER_PIDS+=("$!")
    started=$((started + 1))

    if ((started - reaped >= jobs)); then
      _reap_worker "${reaped}" "${pids[reaped]}"
      reaped=$((reaped + 1))
    fi
  done

  for ((index = reaped; index < total; index++)); do
    _reap_worker "${index}" "${pids[index]}"
  done
  WORKER_PIDS=()
}

# Wait for one worker and remember its exit status so a missing result record
# can be reported with the status that produced it (a killed worker reports its
# signal status instead of appearing clean).
_reap_worker() {
  local -r index="$1" pid="$2"
  local status=0
  # A signal-killed worker makes bash print an asynchronous "[pid] Killed"
  # notice on the shell's stderr; the collector reports the failure instead, so
  # the notice is suppressed rather than leaking a non-deterministic pid.
  wait "${pid}" 2>/dev/null || status=$?
  WORKER_STATUS[index]="${status}"
}

# Fold the per-index records into the run state in rev-list order. The first
# unrenderable verdict aborts with ERROR exactly as the serial walk did; an
# absent record means the worker never rendered one, so it is an ERROR
# (fail-closed) and never a zero-offender PASS.
_collect_lint_results() {
  local -a commits=("$@")
  local -r total="${#commits[@]}"
  local -i index

  for ((index = 0; index < total; index++)); do
    local prefix="${RESULT_DIR}/${index}"
    local status_token="" detail=""

    if [[ ! -r "${prefix}.status" ]]; then
      _report_lint_execution_error "${commits[index]}" "${WORKER_STATUS[index]:-unknown}"
      exit "${EXIT_UNVERIFIABLE}"
    fi
    # The shell's global IFS is $'\n\t', where a space is not a field
    # separator; read the record with an explicit separator that includes it,
    # otherwise `error <exit>` stays one token, the `error` branch below never
    # matches, and the fallback reports the worker's exit instead of the cause.
    IFS=' ' read -r status_token detail <"${prefix}.status" || status_token=""

    case "${status_token}" in
      clean) ;;
      offender)
        if [[ ! -r "${prefix}.message" || ! -r "${prefix}.rules" ]]; then
          _report_lint_execution_error "${commits[index]}" "${WORKER_STATUS[index]:-unknown}"
          exit "${EXIT_UNVERIFIABLE}"
        fi
        local message rule
        local -a unique_rules=()
        message="$(<"${prefix}.message")"
        mapfile -t unique_rules <"${prefix}.rules"
        for rule in "${unique_rules[@]}"; do
          RULE_HITS["${rule}"]=1
        done
        OFFENDER_SHAS+=("${commits[index]}")
        OFFENDER_MESSAGES+=("${message}")
        OFFENDER_RULES+=("$(printf '%s\n' "${unique_rules[@]}")")
        OFFENDER_COUNT=$((OFFENDER_COUNT + 1))
        ;;
      error)
        _report_lint_execution_error "${commits[index]}" "${detail:-unknown}"
        exit "${EXIT_UNVERIFIABLE}"
        ;;
      *)
        _report_lint_execution_error "${commits[index]}" "${WORKER_STATUS[index]:-unknown}"
        exit "${EXIT_UNVERIFIABLE}"
        ;;
    esac
  done
}

# Report an unrenderable verdict with a cause and a remediation hint. No
# diagnostic rule line and no remediation mode is emitted: this is not a defect
# in the message. The caller owns the process exit so every return path stays
# explicit.
_report_lint_execution_error() {
  local -r sha="$1" status="$2"
  local short_sha
  short_sha="$(git rev-parse --short "${sha}")"
  printf 'Cause: commitlint could not render a verdict for commit %s (%s) (exit %s).\n' \
    "${short_sha}" "${sha}" "${status}"
  printf 'Hint: fix or validate the commitlint configuration, install the configured shareable config, and re-run.\n'
  _print_verdict "ERROR" "cannot verify: commitlint could not render a verdict for commit ${short_sha}"
}

# ============================================================================
# CLI
# ============================================================================
parse_args() {
  while (($#)); do
    case "$1" in
      -h | --help)
        usage
        exit "${EXIT_PASS}"
        ;;
      -V | --version)
        printf '%s\n' "${APP_VERSION}"
        exit "${EXIT_PASS}"
        ;;
      --base)
        shift
        if (($# == 0)); then
          _usage_error "option --base requires a value"
        fi
        BASE_OVERRIDE="$1"
        BASE_OVERRIDE_SET="true"
        ;;
      --base=*)
        BASE_OVERRIDE="${1#--base=}"
        BASE_OVERRIDE_SET="true"
        ;;
      --)
        shift
        if (($#)); then
          _usage_error "unexpected argument: $1"
        fi
        break
        ;;
      -*)
        _usage_error "unknown option: $1"
        ;;
      *)
        _usage_error "unexpected argument: $1"
        ;;
    esac
    shift
  done

  if [[ "${BASE_OVERRIDE_SET}" == "true" ]]; then
    if [[ -z "${BASE_OVERRIDE}" ]]; then
      _usage_error "option --base requires a non-empty ref"
    fi
    if [[ "${BASE_OVERRIDE}" == -* || "${BASE_OVERRIDE}" == *[[:space:]]* ]]; then
      _usage_error "invalid base ref: ${BASE_OVERRIDE}"
    fi
  fi
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"

  LC_ALL=C
  TZ=UTC
  export LC_ALL TZ

  _resolve_repository

  # DM-1.d precedes every other repository check: with no configuration there is
  # no authority to mirror, so the run is an explicit skip regardless of base or
  # binary state.
  if ! _has_commitlint_config; then
    HEAD_SHA="$(git rev-parse --verify --quiet HEAD^{commit} 2>/dev/null || true)"
    _print_header "not-required" "none" "not-required" "${HEAD_SHA:-unresolved}" "unknown" "none" "unavailable" "not-required"
    printf 'Cause: no commitlint configuration was found at the repository root; there is nothing to mirror.\n'
    _print_verdict "SKIP" "no commitlint configuration in this repository; nothing to lint"
    exit "${EXIT_PASS}"
  fi

  HEAD_SHA="$(git rev-parse --verify --quiet HEAD^{commit} 2>/dev/null || true)"
  if [[ -z "${HEAD_SHA}" ]]; then
    _print_header "unresolved" "none" "unresolved" "unresolved" "unknown" "none" "unavailable"
    printf 'Cause: HEAD does not resolve to a commit.\n'
    printf 'Hint: check out the change branch and re-run.\n'
    _print_verdict "ERROR" "cannot verify: HEAD does not resolve to a commit"
    exit "${EXIT_UNVERIFIABLE}"
  fi

  _resolve_base_request
  _resolve_base_commit
  _resolve_merge_base

  local commits_raw
  if ! commits_raw="$(git rev-list --reverse "${MERGE_BASE}..${HEAD_SHA}")"; then
    _print_header "${BASE_DISPLAY}" "${BASE_SOURCE}" "${MERGE_BASE}" "${HEAD_SHA}" \
      "unknown" "none" "unavailable" "${BASE_REF_USED}"
    printf 'Cause: the commit range %s..%s could not be enumerated.\n' "${MERGE_BASE}" "${HEAD_SHA}"
    printf 'Hint: verify the object database, for example with git fsck, then re-run the gate.\n'
    _print_verdict "ERROR" "cannot verify: the commit range could not be enumerated"
    exit "${EXIT_UNVERIFIABLE}"
  fi
  local -a commits=()
  if [[ -n "${commits_raw}" ]]; then
    mapfile -t commits < <(printf '%s\n' "${commits_raw}")
  fi
  COMMIT_COUNT="${#commits[@]}"

  if ! _resolve_lint_binary; then
    _print_header "${BASE_DISPLAY}" "${BASE_SOURCE}" "${MERGE_BASE}" "${HEAD_SHA}" \
      "${COMMIT_COUNT}" "none" "unavailable" "${BASE_REF_USED}"
    printf 'Cause: the repository has a commitlint configuration, but no usable commitlint binary was found.\n'
    printf 'Hint: install project dependencies so node_modules/.bin/commitlint exists, then re-run.\n'
    _print_verdict "ERROR" "cannot verify: the commitlint binary is unavailable"
    exit "${EXIT_UNVERIFIABLE}"
  fi

  _print_header "${BASE_DISPLAY}" "${BASE_SOURCE}" "${MERGE_BASE}" "${HEAD_SHA}" \
    "${COMMIT_COUNT}" "${BINARY_DISPLAY}" "${BINARY_ORIGIN}" "${BASE_REF_USED}"

  if [[ "${BINARY_ORIGIN}" == "PATH" ]]; then
    printf 'PARITY RISK: commitlint resolved from outside the repository via PATH (%s); the verdict came from a foreign tool and must be reconciled with the CI authority.\n' \
      "${BINARY_DISPLAY}"
  fi

  if [[ "${COMMIT_COUNT}" -eq 0 ]]; then
    printf 'Summary: 0 commit(s) in range; 0 offending commit(s); 0 distinct rule(s) hit\n'
    _print_verdict "PASS" "0 commits in range (HEAD equals the merge-base); nothing to lint"
    exit "${EXIT_PASS}"
  fi

  if ! RESULT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lint-commit-range.XXXXXXXX")"; then
    printf 'Cause: the gate could not create a temporary directory for per-commit results.\n'
    printf 'Hint: ensure TMPDIR points to a writable directory, then re-run.\n'
    _print_verdict "ERROR" "cannot verify: the gate could not create a temporary result directory"
    exit "${EXIT_UNVERIFIABLE}"
  fi

  _start_lint_workers "${commits[@]}"
  _collect_lint_results "${commits[@]}"

  _render_diagnostics

  local line
  if [[ "${#DIAGNOSTIC_LINES[@]}" -gt 0 ]]; then
    for line in "${DIAGNOSTIC_LINES[@]}"; do
      printf '%s\n' "${line}"
    done
  fi

  printf 'Summary: %s commit(s) in range; %s offending commit(s); %s distinct rule(s) hit\n' \
    "${COMMIT_COUNT}" "${OFFENDER_COUNT}" "${#RULE_HITS[@]}"

  if [[ "${OFFENDER_COUNT}" -eq 0 ]]; then
    _print_verdict "PASS" "${COMMIT_COUNT} commits in range; all satisfy the configuration"
    exit "${EXIT_PASS}"
  fi

  if [[ "${OFFENDER_COUNT}" -ge "${CONDENSE_THRESHOLD}" ]]; then
    printf 'MODE: CONDENSE-TO-ONE — collapse the branch range into one conventional commit.\n'
  else
    printf 'MODE: SURGICAL REWORD — reword only the named commit(s), leaving the rest intact.\n'
  fi

  _print_verdict "FAIL" "${COMMIT_COUNT} commits in range; ${OFFENDER_COUNT} offending commit(s); ${#RULE_HITS[@]} distinct rule(s) hit"
  exit "${EXIT_VIOLATION}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
