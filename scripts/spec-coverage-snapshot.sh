#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/scripts/spec-coverage-snapshot.sh
# spec-coverage-snapshot.sh — repo-internal spec-coverage visibility aid.
#
# PURPOSE:
#   Make a silent spec-coverage drop observable. Counts feature specs present
#   under doc/spec/features/ vs the number of change folders under doc/changes/
#   (each folder = one delivered change that touched some feature area), and
#   prints a simple count/ratio. Intended as a cheap, conservative signal for
#   autonomous delivery runs — especially to detect modified feature areas that
#   acquired no feature spec across many merged changes (GH-108 / PDR-0002).
#
#   This is an OBSERVABILITY aid only: it creates no side effect, touches no
#   tracker, and performs no network access (stdlib bash only). Feature-area
#   detection itself is prompt-described behavior in .opencode/agent/doc-syncer.md;
#   this tool deliberately does not re-implement it — it derives a defensible
#   change-folder count instead.
#
# Usage:
#   scripts/spec-coverage-snapshot.sh [--root <repo-root>]
#   scripts/spec-coverage-snapshot.sh --kv [--root <repo-root>]   # one key=value line
#
# Exit codes:
#   0 - success
#   2 - usage error
#   4 - runtime error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

readonly APP_NAME="spec-coverage-snapshot"
readonly APP_VERSION="1.0.0"

readonly EXIT_SUCCESS=0
readonly EXIT_USAGE=2
readonly EXIT_RUNTIME=4

readonly FEATURE_SPECS_GLOB='feature-*.md'

log_err() { printf '[ERROR] %s %s\n' "(${APP_NAME})" "$*" >&2; }
die() { log_err "$@"; exit "${EXIT_USAGE}"; }

# Resolve repo root: explicit --root, else git toplevel, else cwd.
# Args: explicit_root (may be empty)
resolve_root() {
  local explicit="$1"
  if [[ -n "${explicit}" ]]; then
    [[ -d "${explicit}" ]] || die "Repo root does not exist: ${explicit}"
    cd "${explicit}" >/dev/null 2>&1 && pwd -P
    return 0
  fi
  if command -v git >/dev/null 2>&1; then
    local root
    if root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
      printf '%s' "${root}"
      return 0
    fi
  fi
  pwd -P
}

# Count feature specs present under <root>/doc/spec/features/feature-*.md.
# Args: repo_root
count_feature_specs() {
  local -r root="$1"
  local -r dir="${root}/doc/spec/features"
  if [[ ! -d "${dir}" ]]; then
    printf '0'
    return 0
  fi
  local -a files=()
  local f
  while IFS= read -r f; do
    [[ -n "${f}" ]] && files+=("${f}")
  done < <(find "${dir}" -type f -name "${FEATURE_SPECS_GLOB}" 2>/dev/null)
  printf '%d' "${#files[@]}"
}

# Count change folders under <root>/doc/changes/** matching the unified change
# convention basename pattern YYYY-MM-DD--<REF>--<slug> (i.e. basename contains
# '--' twice with a PREFIX-NUMBER workItemRef between them). Each such folder is
# one change that touched some feature area(s).
# Args: repo_root
count_change_folders() {
  local -r root="$1"
  local -r base="${root}/doc/changes"
  if [[ ! -d "${base}" ]]; then
    printf '0'
    return 0
  fi
  local n=0 d bn rest ref
  while IFS= read -r d; do
    [[ -n "${d}" ]] || continue
    bn="$(basename "${d}")"
    # basename must contain '--' twice: <date>--<REF>--<slug>
    if [[ "${bn}" == *"--"*"--"* ]]; then
      rest="${bn#*--}"   # <REF>--<slug>
      ref="${rest%%--*}" # <REF>
      if [[ "${ref}" =~ ^[A-Z]+-[0-9]+$ ]]; then
        n=$((n + 1))
      fi
    fi
  done < <(find "${base}" -mindepth 1 -type d 2>/dev/null)
  printf '%d' "${n}"
}

# Compute specs/changes ratio to 2 decimals; "n/a" when there are no changes.
# Args: specs changes
compute_ratio() {
  local -r specs="$1"
  local -r changes="$2"
  if [[ "${changes}" -eq 0 ]]; then
    printf 'n/a'
    return 0
  fi
  # LC_ALL=C forces a dot decimal separator so the ratio is locale-independent
  # and machine-parseable (some locales use a comma, e.g. "0,84").
  LC_ALL=C awk -v s="${specs}" -v c="${changes}" 'BEGIN { printf "%.2f", s / c }'
}

# Emit a human-readable snapshot to stdout.
# Args: repo_root
emit_snapshot() {
  local -r root="$1"
  local specs changes ratio
  specs="$(count_feature_specs "${root}")"
  changes="$(count_change_folders "${root}")"
  ratio="$(compute_ratio "${specs}" "${changes}")"
  cat <<EOF
spec-coverage-snapshot (root: ${root})
  feature-specs-present: ${specs}   (doc/spec/features/feature-*.md)
  change-folders:        ${changes} (doc/changes/**/*--<ref>--<slug>/)
  ratio (specs/changes): ${ratio}
EOF
}

# Emit a single machine-parseable key=value line to stdout.
# Args: repo_root
emit_kv() {
  local -r root="$1"
  local specs changes ratio
  specs="$(count_feature_specs "${root}")"
  changes="$(count_change_folders "${root}")"
  ratio="$(compute_ratio "${specs}" "${changes}")"
  printf 'feature_specs_present=%d change_folders=%d ratio=%s\n' "${specs}" "${changes}" "${ratio}"
}

usage() {
  cat <<EOF
Usage: ${APP_NAME} [options]

Repo-internal spec-coverage visibility aid. Counts feature specs present under
doc/spec/features/ vs change folders under doc/changes/ and prints a ratio.

Options:
  --root <path>   Repository root (default: git toplevel, else cwd)
  --kv            Print a single machine-parseable key=value line
  -h, --help      Show this help message
  -V, --version   Show version

No network access; stdlib bash only. Creates no side effect.
EOF
}

main() {
  local root="" mode="human"
  while (($#)); do
    case "$1" in
      --root) [[ $# -ge 2 ]] || die "--root requires a value"; root="$2"; shift 2 ;;
      --kv) mode="kv"; shift ;;
      -h|--help) usage; exit "${EXIT_SUCCESS}" ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit "${EXIT_SUCCESS}" ;;
      --) shift; break ;;
      -*) die "Unknown option: $1" ;;
      *) break ;;
    esac
  done

  root="$(resolve_root "${root}")"

  case "${mode}" in
    kv) emit_kv "${root}" ;;
    *) emit_snapshot "${root}" ;;
  esac
  exit "${EXIT_SUCCESS}"
}

# Testable main guard (allows sourcing for unit tests).
if [[ "${BASH_SOURCE[0]:-}" == "${0}" ]]; then
  main "$@"
fi
