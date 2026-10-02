#!/usr/bin/env bash
# test-delivery-mutation-sandbox.sh — PDEV-516 F-4 committed mutation sandbox.
#
# Proves TC-DT-SF-12 genuinely asserts the delivery result tuple: the sandbox
# copies scripts/deliver-ticket.sh + its harness to a temp tree (preserving the
# scripts/ + scripts/.tests/ sibling layout so SCRIPT_DIR resolves to the copy),
# deliberately breaks the result emission in the COPY only, and asserts:
#   * the mutated copy's harness exits non-zero AND reports
#     `[FAIL] … TC-DT-SF-12` (the harness prints [FAIL] to stderr, so the
#     capture MUST merge stderr via 2>&1);
#   * the unmutated copy's harness exits 0 (an always-failing suite cannot make
#     the mutation check vacuously pass);
#   * no tracked file in the real worktree is mutated (pre/post status +
#     checksums identical).
#
# Deterministic and offline: temp dirs only, no network, no wall-clock/random
# input. Mirrors the committed-negative-mode precedent of
# test-doc-distribution-modes.sh. At 8ad950f the mutated run is 121/124 with
# TC-DT-SF-12 (and the PDEV-512 summary cases) failing.
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd -P)"
readonly REPO_ROOT
readonly TAG="(delivery-mutation-sandbox)"

_tmp=""
cleanup() {
  if [[ -n "${_tmp}" && -d "${_tmp}" ]]; then rm -rf "${_tmp}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

fail() {
  printf '%s[FAIL] %s\n' "${TAG}" "$1" >&2
  exit 1
}

# Isolated harness invocation (host ~/.config/ados/env.sh would otherwise route
# tracker mocks to Jira).
ENV_ISO=(env -u ADOS_TRACKER -u JIRA_URL -u JIRA_USERNAME -u JIRA_API_TOKEN
  ADOS_ENV_LOADED=1 ADOS_DS_PEAK_DISABLED=1 ADOS_DS_BALANCE_DISABLED=1)

readonly TRACKED_SCRIPT="${REPO_ROOT}/scripts/deliver-ticket.sh"
readonly TRACKED_HARNESS="${REPO_ROOT}/scripts/.tests/test-deliver-ticket.sh"

pre_status="$(git -C "${REPO_ROOT}" status --porcelain 2>/dev/null || true)"
pre_script_sum="$(sha256sum "${TRACKED_SCRIPT}" | awk '{print $1}')"
pre_harness_sum="$(sha256sum "${TRACKED_HARNESS}" | awk '{print $1}')"

_tmp="$(mktemp -d)"
mkdir -p "${_tmp}/scripts/.tests"
cp "${TRACKED_SCRIPT}" "${_tmp}/scripts/deliver-ticket.sh"
cp "${TRACKED_HARNESS}" "${_tmp}/scripts/.tests/test-deliver-ticket.sh"

# ---------------------------------------------------------------------------
# 1) Unmutated copy must pass — prevents a vacuous always-failing mutation check.
# ---------------------------------------------------------------------------
unmutated_rc=0
set +e
( cd "${_tmp}" && "${ENV_ISO[@]}" bash scripts/.tests/test-deliver-ticket.sh ) \
  >"${_tmp}/unmutated.log" 2>&1
unmutated_rc=$?
set -e
if (( unmutated_rc != 0 )); then
  tail -n 30 "${_tmp}/unmutated.log" >&2
  fail "unmutated harness exited ${unmutated_rc} (expected 0)"
fi
printf '%s[OK]   unmutated copy passes (rc=0)\n' "${TAG}"

# ---------------------------------------------------------------------------
# 2) Inject a deliberate result-tuple break into the COPY only.
# ---------------------------------------------------------------------------
if ! grep -qF "printf 'result=%s\\n'" "${_tmp}/scripts/deliver-ticket.sh"; then
  fail "could not locate the result emission to mutate"
fi
perl -0pi -e "s/printf 'result=%s\\\\n'/printf 'result=broken\\\\n'/" \
  "${_tmp}/scripts/deliver-ticket.sh"
if ! grep -qF "printf 'result=broken\\n'" "${_tmp}/scripts/deliver-ticket.sh"; then
  fail "mutation injection did not apply to the copy"
fi

# ---------------------------------------------------------------------------
# 3) Mutated copy must exit non-zero AND report `[FAIL] … TC-DT-SF-12`.
#    Capture BOTH streams: the harness writes [FAIL] to stderr.
# ---------------------------------------------------------------------------
mutated_out=""
mutated_rc=0
set +e
mutated_out="$( ( cd "${_tmp}" && "${ENV_ISO[@]}" bash scripts/.tests/test-deliver-ticket.sh ) 2>&1 )"
mutated_rc=$?
set -e
if (( mutated_rc == 0 )); then
  fail "mutated harness exited 0 (expected non-zero) — TC-DT-SF-12 is vacuous"
fi
if [[ "${mutated_out}" != *"[FAIL]"*"TC-DT-SF-12"* ]]; then
  printf '%s\n' "${mutated_out}" | tail -n 30 >&2
  fail "mutated output did not report '[FAIL] … TC-DT-SF-12' (stderr captured via 2>&1)"
fi
printf '%s[OK]   mutated copy fails with [FAIL] TC-DT-SF-12 (rc=%s)\n' "${TAG}" "${mutated_rc}"

# ---------------------------------------------------------------------------
# 4) Isolation: the real worktree's tracked files are byte-identical.
# ---------------------------------------------------------------------------
post_status="$(git -C "${REPO_ROOT}" status --porcelain 2>/dev/null || true)"
post_script_sum="$(sha256sum "${TRACKED_SCRIPT}" | awk '{print $1}')"
post_harness_sum="$(sha256sum "${TRACKED_HARNESS}" | awk '{print $1}')"

[[ "${pre_status}" == "${post_status}" ]] || fail "the sandbox changed the real repo status"
[[ "${pre_script_sum}" == "${post_script_sum}" ]] || fail "the sandbox mutated scripts/deliver-ticket.sh"
[[ "${pre_harness_sum}" == "${post_harness_sum}" ]] || fail "the sandbox mutated scripts/.tests/test-deliver-ticket.sh"
printf '%s[OK]   real worktree untouched (status + checksums identical)\n' "${TAG}"

printf '%s[OK]   mutation sandbox passed\n' "${TAG}"
exit 0
