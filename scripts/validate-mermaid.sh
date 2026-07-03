#!/usr/bin/env bash
# validate-mermaid.sh — mermaid render + render-safe keyword validator (GH-110, DEC-7).
#
# Purpose
#   Extract every ```mermaid fenced block from in-scope .md files and apply the
#   DEC-7 dual check: a block PASSES iff (a) its mmdc headless render exits 0 AND
#   (b) it contains NO non-render-safe keyword from the denylist. Either failure
#   makes the run exit non-zero with a precise message (file + block index + reason).
#   The keyword guard is a pure grep needing NO mmdc, so it runs even under
#   --if-present when the render is skipped — a non-render-safe block cannot slip a
#   tool-less local run.
#
# Dependencies: bash>=4, mmdc (optional; skippable via --if-present), grep, find, sort
# Usage: validate-mermaid.sh [--if-present] [--help] [--version] [PATH...]
#
# Scan roots (DM-2): when no PATH is given, scans {doc, decisions, changes,
#   inception, .ai} relative to the repo root; in this repo decisions/changes/
#   inception live under doc/, so doc/** subsumes them. .ai/local/ (git-ignored
#   ephemeral scratch) is always excluded. Files are enumerated SORTED (NFR-1).
#
# Block index base: 1-based (block #1, #2, ...), per-file.
#
# Environment:
#   MMDC_CMD              - mermaid CLI to invoke for the render check
#                           (default: mmdc). Set to a shim to mock the render.
#   RENDER_SAFE_DENYLIST  - non-render-safe keyword denylist. Space- or comma-
#                           separated. Semantics: REPLACE the default (OQ-TP-1).
#                           Default mirrors .ai/rules/diagrams.md exactly:
#                           "C4Context C4Container C4Component" (DM-3 single source).
#   VERBOSE               - set to 'true' for debug output.
#
# Exit codes:
#   0 - success (every block passed the dual render+keyword check; or no blocks)
#   2 - usage error (bad flag/arg)
#   3 - missing-mmdc-when-required (mmdc absent, --if-present NOT given, and >=1
#       block needed rendering). Distinct from 4/5 so "tool missing" is separable.
#   4 - render failure (>=1 block failed the headless render)
#   5 - non-render-safe-keyword failure (>=1 block contains a denylist keyword)

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="validate-mermaid"
readonly APP_VERSION="1.0.0"
readonly LOG_TAG="(${APP_NAME})"

# Exit codes (DM-1 / bash.md §10.5)
readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_MISSING_MMDC=3
readonly EXIT_RENDER=4
readonly EXIT_KEYWORD=5

# Injectable render command (bash.md §10.1) — the SOLE render seam. Mock via env.
readonly MMDC_CMD="${MMDC_CMD:-mmdc}"

# Configurable behavior
IF_PRESENT="${IF_PRESENT:-false}"
VERBOSE="${VERBOSE:-false}"

# Default scan roots (DM-2). Named explicitly to mirror the CI paths: filter.
# Missing roots are skipped; doc/** subsumes decisions/changes/inception here.
readonly DEFAULT_SCAN_ROOTS=("doc" "decisions" "changes" "inception" ".ai")

# Mutable globals (populated at runtime)
DENYLIST=()
REPO_ROOT="."
readonly DEFAULT_DENYLIST="C4Context C4Container C4Component"

# Failure aggregation (NFR-1 deterministic; aggregate exit precedence:
# keyword > render > missing-mmdc > success)
_keyword_failures=0
_render_failures=0
_missing_mmdc_required=0
_render_skipped=0
_blocks_checked=0
_WORKDIR=""

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

_on_exit() {
  if [[ -n "${_WORKDIR}" && -d "${_WORKDIR}" ]]; then
    rm -rf "${_WORKDIR}" 2>/dev/null || true
  fi
}

_on_interrupt() {
  log_warn "Interrupted"
  exit 130
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap '_on_exit' EXIT
trap '_on_interrupt' INT TERM

# ============================================================================
# UTILITIES
# ============================================================================
log_info() { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*"; }
log_warn() { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*"; }
log_err() { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() {
  [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*"
  true
}

die() {
  log_err "$*"
  exit "${EXIT_USAGE}"
}

# Build the keyword denylist from RENDER_SAFE_DENYLIST (REPLACE semantics) or the
# default that mirrors .ai/rules/diagrams.md (DM-3). Accepts space- or comma-
# separated input. NOTE: a LOCAL IFS is required because the script's global
# IFS=$'\n\t' would otherwise prevent splitting on spaces.
build_denylist() {
  local raw="${RENDER_SAFE_DENYLIST-${DEFAULT_DENYLIST}}"
  local IFS=' '
  raw="${raw//,/ }"
  read -ra DENYLIST <<<"${raw}"
}

# Determine the repo root (location of .git) for relative path display + default
# roots. Falls back to the script's parent-of-parent if not in a git worktree.
resolve_repo_root() {
  local root
  root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "${root}" ]]; then
    REPO_ROOT="${root}"
  else
    REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
  fi
}

# Is the render command available? Works for PATH names and executable file paths.
_mmdc_available() {
  command -v "${MMDC_CMD}" >/dev/null 2>&1
}

# ----------------------------------------------------------------------------
# _keyword_guard <content> — pure grep, no mmdc. Prints the first matching
# denylist keyword on stdout and returns 0 if found; returns 1 if none match.
# ----------------------------------------------------------------------------
_keyword_guard() {
  local -r content="$1"
  if [[ ${#DENYLIST[@]} -eq 0 ]]; then
    return 1
  fi
  local kw
  for kw in "${DENYLIST[@]}"; do
    [[ -n "${kw}" ]] || continue
    if grep -qF -- "${kw}" <<<"${content}"; then
      printf '%s' "${kw}"
      return 0
    fi
  done
  return 1
}

# ----------------------------------------------------------------------------
# _render <content> — headless render via $MMDC_CMD (mockable wrapper, §10.3).
# Returns the render exit code. Captures stderr into global _LAST_RENDER_ERR.
# ----------------------------------------------------------------------------
_render() {
  local -r content="$1"
  local d mmd out err rc=0
  # mktemp -d (template ends in X's) avoids the suffix-after-X pitfall; the
  # .mmd extension matters for real mmdc format inference (TC-BASE-001).
  d="$(mktemp -d "${_WORKDIR}/rXXXXXX")"
  mmd="${d}/block.mmd"
  out="${d}/block.out"
  err="${d}/block.err"
  printf '%s' "${content}" >"${mmd}"
  _LAST_RENDER_ERR=""
  "${MMDC_CMD}" -i "${mmd}" -o "${out}" 2>"${err}" || rc=$?
  _LAST_RENDER_ERR="$(<"${err}")"
  return "${rc}"
}

# Relative path for display: strip the repo-root prefix when present.
_display_path() {
  local -r file="$1"
  local rel="${file}"
  if [[ "${rel}" == "${REPO_ROOT}/"* ]]; then
    rel="${rel#"${REPO_ROOT}/"}"
  fi
  printf '%s' "${rel}"
}

# Record a failure (keyword or render): logs a human line + a GitHub ::error::
# annotation, both carrying file + block index + reason (NFR-4, 3/3).
_record_keyword_failure() {
  local -r file="$1" idx="$2" kw="$3"
  local rel
  rel="$(_display_path "${file}")"
  _keyword_failures=$((_keyword_failures + 1))
  log_err "${rel}: mermaid block #${idx} non-render-safe keyword \"${kw}\" — does not render on GitHub (see .ai/rules/diagrams.md)"
  printf '::error::%s: mermaid block #%d non-render-safe keyword "%s" — does not render on GitHub\n' \
    "${rel}" "${idx}" "${kw}"
}

_record_render_failure() {
  local -r file="$1" idx="$2" reason="$3"
  local rel
  rel="$(_display_path "${file}")"
  _render_failures=$((_render_failures + 1))
  log_err "${rel}: mermaid block #${idx} render failed — ${reason}"
  printf '::error::%s: mermaid block #%d render failed — %s\n' \
    "${rel}" "${idx}" "${reason}"
}

# ----------------------------------------------------------------------------
# validate_block <file> <idx> <content> — DEC-7 dual check on one block.
# Keyword guard runs unconditionally (cheap grep, no mmdc). Render check runs
# only when mmdc is available; under --if-present it is skipped (but the keyword
# guard still ran). Both kinds of failure may be recorded for one block.
# ----------------------------------------------------------------------------
validate_block() {
  local -r file="$1" idx="$2" content="$3"
  _blocks_checked=$((_blocks_checked + 1))

  local kw
  kw="$(_keyword_guard "${content}")" || true
  if [[ -n "${kw}" ]]; then
    _record_keyword_failure "${file}" "${idx}" "${kw}"
  fi

  if _mmdc_available; then
    local rc=0 first_err
    _render "${content}" || rc=$?
    if ((rc != 0)); then
      first_err="$(awk 'NF{sub(/\r$/,"");print;exit}' <<<"${_LAST_RENDER_ERR}")"
      [[ -z "${first_err}" ]] && first_err="mmdc exited ${rc}"
      _record_render_failure "${file}" "${idx}" "${first_err}"
    fi
  else
    if [[ "${IF_PRESENT}" == "true" ]]; then
      _render_skipped=1
    else
      _missing_mmdc_required=1
    fi
  fi
}

# Fence regexes stored in variables to avoid backtick command-substitution
# pitfalls (backticks are literal inside single quotes here).
readonly _RE_FENCE_OPEN='^[[:space:]]*([`]+)(.*)$'
readonly _RE_FENCE_CLOSE='^[[:space:]]*([`]+)[[:space:]]*$'

# ----------------------------------------------------------------------------
# validate_file <file> — extract mermaid blocks and validate each. Tracks fence
# length so non-mermaid code spans (e.g. an example wrapped in 4-backticks) do
# not fool the extractor. Block index is 1-based, per-file.
# ----------------------------------------------------------------------------
validate_file() {
  local -r file="$1"
  local line in_fence=0 fence_len=0 capturing=0 block_index=0 content=""
  local bt rest info
  while IFS= read -r line || [[ -n "${line}" ]]; do
    if ((in_fence == 0)); then
      if [[ "${line}" =~ ${_RE_FENCE_OPEN} ]]; then
        bt="${BASH_REMATCH[1]}"
        rest="${BASH_REMATCH[2]}"
        if ((${#bt} >= 3)); then
          # info string = rest, trimmed
          info="${rest#"${rest%%[![:space:]]*}"}"
          info="${info%"${info##*[![:space:]]}"}"
          in_fence=1
          fence_len="${#bt}"
          if [[ "${info}" == "mermaid" ]]; then
            capturing=1
            block_index=$((block_index + 1))
            content=""
          else
            capturing=0
          fi
        fi
      fi
    else
      if [[ "${line}" =~ ${_RE_FENCE_CLOSE} ]]; then
        bt="${BASH_REMATCH[1]}"
        if ((${#bt} >= fence_len)); then
          if ((capturing == 1)); then
            validate_block "${file}" "${block_index}" "${content}"
          fi
          in_fence=0
          capturing=0
          continue
        fi
      fi
      if ((capturing == 1)); then
        content+="${line}"$'\n'
      fi
    fi
  done <"${file}"
  # Unterminated mermaid fence — validate what was captured (treats it as a block).
  if ((capturing == 1)); then
    validate_block "${file}" "${block_index}" "${content}"
  fi
}

# ----------------------------------------------------------------------------
# enumerate_md_files <roots...> — sorted, de-duplicated .md files under the
# roots, excluding .ai/local/ (git-ignored). Prints one path per line (NFR-1).
# ----------------------------------------------------------------------------
enumerate_md_files() {
  local roots=("$@")
  local root f
  local -a all=()
  for root in "${roots[@]}"; do
    if [[ -f "${root}" ]]; then
      # A single file argument: include it if it is markdown.
      case "${root}" in
        *.md) all+=("${root}") ;;
      esac
      continue
    fi
    [[ -d "${root}" ]] || continue
    while IFS= read -r -d '' f; do
      case "${f}" in
        */.ai/local/*) continue ;;
      esac
      all+=("${f}")
    done < <(find "${root}" -type f -name '*.md' -print0)
  done
  if ((${#all[@]} > 0)); then
    printf '%s\n' "${all[@]}" | sort -u
  fi
}

# ----------------------------------------------------------------------------
# validate_roots <roots...> — scan roots, validate each file's blocks.
# ----------------------------------------------------------------------------
validate_roots() {
  local roots=("$@")
  local file count=0
  while IFS= read -r file; do
    [[ -n "${file}" ]] || continue
    count=$((count + 1))
    validate_file "${file}"
  done < <(enumerate_md_files "${roots[@]}")
  log_debug "scanned ${count} markdown file(s); checked ${_blocks_checked} mermaid block(s)"
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
Usage: ${APP_NAME} [options] [PATH...]

Validate every \`mermaid\` fenced block under the given PATH(s) (default scan
roots: doc, decisions, changes, inception, .ai — relative to the repo root).
A block PASSES iff its mmdc headless render exits 0 AND it contains no
non-render-safe keyword (DEC-7).

Options:
  --if-present    Skip the render when mmdc is absent (the keyword guard still
                  runs — it needs no mmdc). Without this flag, an absent mmdc
                  with >=1 block exits ${EXIT_MISSING_MMDC} (missing-mmdc).
  -h, --help      Show this help message
  -V, --version   Show version

Environment:
  MMDC_CMD              Render command (default: mmdc). Mock via a shim.
  RENDER_SAFE_DENYLIST  Keyword denylist, space- or comma-separated. REPLACEs
                        the default: ${DEFAULT_DENYLIST}
  VERBOSE               Set to 'true' for debug output.

Exit codes:
  0  success
  2  usage error
  3  missing-mmdc-when-required
  4  render failure
  5  non-render-safe-keyword failure
EOF
}

parse_args() {
  ARGS=()
  while (("$#")); do
    case "$1" in
      --if-present) IF_PRESENT=true ;;
      -h | --help) usage; exit "${EXIT_SUCCESS}" ;;
      -V | --version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit "${EXIT_SUCCESS}" ;;
      --) shift; while (("$#")); do ARGS+=("$1"); shift; done; break ;;
      -*) die "Unknown option: $1" ;;
      *) ARGS+=("$1") ;;
    esac
    shift
  done
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"

  # bash>=4 capability (uses mapfile-style read -ra, associative-free; still guard).
  resolve_repo_root
  build_denylist
  _WORKDIR="$(mktemp -d)"

  local -a roots
  if ((${#ARGS[@]} == 0)); then
    roots=()
    local r
    for r in "${DEFAULT_SCAN_ROOTS[@]}"; do
      roots+=("${REPO_ROOT}/${r}")
    done
  else
    roots=("${ARGS[@]}")
  fi

  log_debug "MMDC_CMD=${MMDC_CMD}; denylist=${DENYLIST[*]:-<empty>}; if_present=${IF_PRESENT}"

  validate_roots "${roots[@]}"

  if (( _missing_mmdc_required == 1 )); then
    log_warn "mmdc ('${MMDC_CMD}') not found and --if-present not given; ${_blocks_checked} block(s) could not be rendered. Install @mermaid-js/mermaid-cli or pass --if-present."
  fi
  if (( _render_skipped == 1 )); then
    log_info "mmdc not found (--if-present): render skipped; keyword guard still applied to ${_blocks_checked} block(s)."
  fi

  # Aggregate exit precedence: keyword (5) > render (4) > missing-mmdc (3) > 0.
  if ((_keyword_failures > 0)); then
    log_err "${_keyword_failures} non-render-safe-keyword failure(s)."
    exit "${EXIT_KEYWORD}"
  fi
  if ((_render_failures > 0)); then
    log_err "${_render_failures} render failure(s)."
    exit "${EXIT_RENDER}"
  fi
  if ((_missing_mmdc_required == 1)); then
    exit "${EXIT_MISSING_MMDC}"
  fi

  log_info "OK — ${_blocks_checked} mermaid block(s) passed the dual render+keyword check."
  exit "${EXIT_SUCCESS}"
}

# Testable main guard (bash.md §10.4).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
