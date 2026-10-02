#!/usr/bin/env bash
# test-deliver-ticket-result-tuples-modes.sh — PDEV-516 F-3 negative-mode
# self-tests for scripts/.tests/test-deliver-ticket-result-tuples.sh.
#
# The result-tuple guard documents the DM-5 matching rule but, without this
# harness, its failure modes would only be proven by out-of-band injection.
# For each mode this harness builds a synthetic tree (temp dirs only — never the
# repo), injects exactly that defect, runs the guard with
# RESULT_TUPLE_SCAN_ROOT pointing at the tree, and asserts the expected exit
# and message. A refactor that silently disables a mode turns this red.
#
# Deterministic + offline: no network, no wall-clock, no repo mutation. The
# canonical result domain is still derived from the real
# scripts/deliver-ticket.sh help line.
set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly REPO_ROOT
readonly GUARD="${REPO_ROOT}/scripts/.tests/test-deliver-ticket-result-tuples.sh"
readonly TAG="(result-tuple-modes-test)"

_pass=0
_fail=0
_tmp_paths=()
_guard_rc=0
_guard_out=""

cleanup() {
  if [[ ${#_tmp_paths[@]} -gt 0 ]]; then rm -rf "${_tmp_paths[@]}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

mktree() {
  local d
  d="$(mktemp -d)"
  _tmp_paths+=("${d}")
  printf '%s' "${d}"
}

# build_tree <root>: copy the three real configured docs into the synthetic root.
build_tree() {
  local -r root="$1"
  mkdir -p "${root}/.opencode/agent" "${root}/doc/guides" "${root}/doc/spec/features"
  cp "${REPO_ROOT}/.opencode/agent/ceo.md" "${root}/.opencode/agent/ceo.md"
  cp "${REPO_ROOT}/doc/guides/delivery-modes.md" "${root}/doc/guides/delivery-modes.md"
  cp "${REPO_ROOT}/doc/spec/features/feature-autonomous-delivery.md" "${root}/doc/spec/features/feature-autonomous-delivery.md"
}

# run_guard <root>: sets _guard_rc and _guard_out (stdout+stderr).
run_guard() {
  local -r root="$1"
  set +e
  _guard_out="$(RESULT_TUPLE_SCAN_ROOT="${root}" bash "${GUARD}" 2>&1)"
  _guard_rc=$?
  set -e
}

# check <label> <zero|nonzero> <root> [must_contain] [must_not_contain]
check() {
  local -r label="$1" expect="$2" root="$3" needle="${4:-}" anti="${5:-}"
  run_guard "${root}"
  local ok=1
  if [[ "${expect}" == "zero" ]]; then
    (( _guard_rc == 0 )) || ok=0
  else
    (( _guard_rc != 0 )) || ok=0
  fi
  if (( ok == 1 )) && [[ -n "${needle}" ]] && [[ "${_guard_out}" != *"${needle}"* ]]; then ok=0; fi
  if (( ok == 1 )) && [[ -n "${anti}" ]] && [[ "${_guard_out}" == *"${anti}"* ]]; then ok=0; fi

  if (( ok == 1 )); then
    printf '%s[OK]   %s (rc=%s)\n' "${TAG}" "${label}" "${_guard_rc}"
    _pass=$((_pass + 1))
  else
    printf '%s[FAIL] %s (rc=%s, wanted=%s, needle=%q, anti=%q)\n' \
      "${TAG}" "${label}" "${_guard_rc}" "${expect}" "${needle}" "${anti}" >&2
    printf '%s\n' "${_guard_out}" | sed 's/^/         /' >&2
    _fail=$((_fail + 1))
  fi
}

# mode-0: the unmutated baseline passes — the real densest prose unit and the
# embedded hyphenated tokens are not treated as enumerations.
m0_baseline() {
  local root
  root="$(mktree)"; build_tree "${root}"
  check "baseline passes (no false positive)" zero "${root}" "guard passed"
}

# mode-1: remove `pr-open` from the L457 enumeration only, while
# `pr-open-unverified` remains — the DM-5 boundary-awareness oracle. A
# substring matcher would silently pass.
m1_stale_pr_open() {
  local root
  root="$(mktree)"; build_tree "${root}"
  perl -0pi -e 's/`pr-open` \/ //' "${root}/doc/guides/delivery-modes.md"
  check "stale pr-open (boundary oracle) fails" nonzero "${root}" "omits: pr-open" "omits: pr-open-unverified"
}

# mode-2: a configured doc with no detected enumeration fails.
m2_no_enumeration() {
  local root
  root="$(mktree)"; build_tree "${root}"
  # Only result-like tokens (3 distinct) + hyphenated non-results: below quorum.
  printf '# no enumeration here\n\nThe system may be blocked or merged, and pr-open is possible; use clean-merged-branches and squash-merged.\n' \
    >"${root}/doc/guides/delivery-modes.md"
  check "configured doc with no enumeration fails" nonzero "${root}" "no result enumeration found"
}

# mode-3: remove `finished` from the wrapped INV-DM-1 sentence only. The L457
# row still carries it, so this fails only because the wrapped lines are joined
# into one unit — i.e. the line-join is load-bearing.
m3_wrapped_stale() {
  local root
  root="$(mktree)"; build_tree "${root}"
  perl -0pi -e 's/failed,\nfinished, max-restarts/failed,\nmax-restarts/' "${root}/doc/guides/delivery-modes.md"
  check "wrapped INV-DM-1 stale variant fails" nonzero "${root}" "omits: finished"
}

# mode-4: false-positive control — an extra 3-result-token prose unit carrying
# `clean-merged-branches` / `squash-merged` is not treated as an enumeration.
m4_prose_no_false_positive() {
  local root
  root="$(mktree)"; build_tree "${root}"
  printf '\n- The system may be blocked, merged, or pr-open, but never what clean-merged-branches or squash-merged imply.\n' \
    >>"${root}/doc/guides/delivery-modes.md"
  check "3-token prose / hyphenated tokens not flagged" zero "${root}" "guard passed"
}

# mode-5: the generated .ados-claude/ plugin is excluded from the direct scan —
# a stale enumeration there never trips the guard (verify-claude-build owns it).
m5_generated_excluded() {
  local root
  root="$(mktree)"; build_tree "${root}"
  mkdir -p "${root}/.ados-claude/agents"
  printf 'result values: merged, blocked\n' >"${root}/.ados-claude/agents/ceo.md"
  check "generated .ados-claude/ excluded" zero "${root}" "guard passed"
}

main() {
  printf '%s start: 6 result-tuple guard mode self-tests\n' "${TAG}"
  local pre_status
  pre_status="$(git -C "${REPO_ROOT}" status --porcelain 2>/dev/null || true)"
  m0_baseline
  m1_stale_pr_open
  m2_no_enumeration
  m3_wrapped_stale
  m4_prose_no_false_positive
  m5_generated_excluded

  # Isolation: the harness must not add to (or remove from) the real repo's
  # status; any pre-existing dirt is preserved exactly.
  local post_status
  post_status="$(git -C "${REPO_ROOT}" status --porcelain 2>/dev/null || true)"
  if [[ "${pre_status}" != "${post_status}" ]]; then
    printf '%s[FAIL] mode self-tests changed the real repo status:\n--- before ---\n%s\n--- after ---\n%s\n' \
      "${TAG}" "${pre_status}" "${post_status}" >&2
    _fail=$((_fail + 1))
  fi

  printf '%s done:   %d passed, %d failed\n' "${TAG}" "${_pass}" "${_fail}"
  if [[ "${_fail}" -gt 0 ]]; then
    printf '%s[FAIL] one or more result-tuple guard modes did not fire — see output above\n' "${TAG}" >&2
    exit 1
  fi
  printf '%s[OK]   all result-tuple guard modes behave correctly\n' "${TAG}"
  exit 0
}

main "$@"
