#!/usr/bin/env bash
# test-dispatch-bash-fallback.sh — TC-BASH-001..004 (GH-239 F-7, NFR-8)
#
# Twelve-cell matrix: four bash entry points x three authority conditions
# (dual-run, authoritative, typed CLI absent/broken). Each cell runs the script's
# pure self-description path with an injected state root and repository, asserts
# the exit code, the deprecation-pointer presence, and that the typed CLI was
# never invoked. The stop-gap fake binary writes a marker if it is ever called.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

readonly TEST_TAG="(test-dispatch-bash-fallback)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m'
  readonly _GREEN=$'\033[0;32m'
  readonly _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _RESET=""
fi

_test_setup() {
  _test_tmpdir="$(mktemp -d)"
  _make_checkout >/dev/null
}
_test_teardown() {
  [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]] && rm -rf "${_test_tmpdir}"
  _test_tmpdir=""
}
trap '_test_teardown' EXIT

run_test() {
  local -r name="$1"
  local -r func="$2"
  ((++_test_count))
  _test_setup
  if (set -e; "${func}"); then
    ((++_test_passed))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    ((++_test_failed))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi
  _test_teardown
}

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." >/dev/null 2>&1 && pwd -P)"
readonly ROOT_DIR
readonly REPOSITORY="github.com/owner/repo"
readonly PROJECT_KEY="fixture-repo-0123abcd"
_fake_bin_dir() { printf '%s/bin\n' "${_test_tmpdir}"; }
_marker_path() { printf '%s/typed-cli-invoked\n' "${_test_tmpdir}"; }

_install_fake_typed_cli() {
  mkdir -p "$(_fake_bin_dir)"
  cat >"$(_fake_bin_dir)/delivery-os" <<FAKE
#!/usr/bin/env bash
printf 'invoked\n' >>"$(_marker_path)"
exit 99
FAKE
  chmod +x "$(_fake_bin_dir)/delivery-os"
}

# One hermetic checkout: the scripts are copied so their ROOT_DIR is the temp
# checkout, and its git common directory carries the identity marker the
# resolver reads. Nothing touches this repository's own checkout.
_make_checkout() {
  local -r checkout="${_test_tmpdir}/checkout"
  [[ -d "${checkout}/scripts" ]] && {
    printf '%s\n' "${checkout}"
    return 0
  }
  mkdir -p "${checkout}/.git"
  cp -R "${ROOT_DIR}/scripts" "${checkout}/scripts"
  printf '{"schema":"delivery.projects.identity.v1","projectKey":"%s","projectIdentifier":"0123abcd000000000000000000000000","basename":"fixture-repo"}\n' \
    "${PROJECT_KEY}" >"${checkout}/.git/project-identity.json"
  printf '%s\n' "${checkout}"
}

# The per-repository state root the derived document lives under.
_seed_authority() {
  local -r host_root="$1"
  local -r fixture="$2"
  local -r project_root="${host_root}/projects/${PROJECT_KEY}"
  mkdir -p "${project_root}/documents.workspace-a"
  if [[ "${fixture}" != "absent" ]]; then
    cp "${ROOT_DIR}/tests/fixtures/dispatch/bash/${fixture}.json" \
      "${project_root}/documents.workspace-a/dispatch-authority.json"
  fi
}

# Run one script cell; echoes "exit|pointer" where pointer is 1 when present.
_run_cell() {
  local -r script="$1"
  local -r state_root="$2"
  local -r path_prefix="${3:-}"
  local -r checkout="${_test_tmpdir}/checkout"
  local stdout_file="${_test_tmpdir}/stdout"
  local stderr_file="${_test_tmpdir}/stderr"
  local exit_code=0
  (
    if [[ -n "${path_prefix}" ]]; then
      PATH="${path_prefix}:$(_fake_bin_dir):/usr/bin:/bin"
    fi
    ADOS_DISPATCH_STATE_ROOT="${state_root}" DISPATCH_REPOSITORY="${REPOSITORY}" \
      bash "${checkout}/${script}" --help >"${stdout_file}" 2>"${stderr_file}"
  ) || exit_code=$?
  local pointer=0
  if grep -q 'engine-authoritative' "${stderr_file}" 2>/dev/null; then
    pointer=1
  fi
  printf '%s|%s\n' "${exit_code}" "${pointer}"
}

test_dual_run_has_no_pointer() {
  local -r state_root="${_test_tmpdir}/state-dual"
  _seed_authority "${state_root}" "dual-run"
  for script in scripts/deliver-ticket.sh scripts/batch-deliver.sh scripts/pm-liveness.sh scripts/ceo-loop.sh; do
    local cell
    cell="$(_run_cell "${script}" "${state_root}")"
    [[ "${cell%%|*}" == "0" ]] || {
      printf 'script %s exited %s\n' "${script}" "${cell%%|*}" >&2
      return 1
    }
    [[ "${cell##*|}" == "0" ]] || {
      printf 'script %s printed a pointer in dual-run\n' "${script}" >&2
      return 1
    }
  done
  [[ ! -f "$(_marker_path)" ]] || return 1
}

test_absent_or_malformed_means_dual_run() {
  for fixture in absent malformed; do
    local state_root="${_test_tmpdir}/state-${fixture}"
    _seed_authority "${state_root}" "${fixture}"
    for script in scripts/deliver-ticket.sh scripts/batch-deliver.sh scripts/pm-liveness.sh scripts/ceo-loop.sh; do
      local cell
      cell="$(_run_cell "${script}" "${state_root}")"
      [[ "${cell%%|*}" == "0" ]] || return 1
      [[ "${cell##*|}" == "0" ]] || {
        printf 'script %s treated %s as authoritative\n' "${script}" "${fixture}" >&2
        return 1
      }
    done
  done
}

test_authoritative_prints_pointer_and_still_runs() {
  local -r state_root="${_test_tmpdir}/state-authoritative"
  _seed_authority "${state_root}" "authoritative"
  for script in scripts/deliver-ticket.sh scripts/batch-deliver.sh scripts/pm-liveness.sh scripts/ceo-loop.sh; do
    local cell
    cell="$(_run_cell "${script}" "${state_root}")"
    [[ "${cell%%|*}" == "0" ]] || {
      printf 'script %s refused because authority moved (%s)\n' "${script}" "${cell%%|*}" >&2
      return 1
    }
    [[ "${cell##*|}" == "1" ]] || {
      printf 'script %s printed no pointer when authoritative\n' "${script}" >&2
      return 1
    }
  done
  local stderr_file="${_test_tmpdir}/stderr"
  grep -q 'dispatch handover' "${stderr_file}" || return 1
  grep -q -- '--revert' "${stderr_file}" || return 1
}

test_typed_cli_absent_never_changes_the_decision() {
  _install_fake_typed_cli
  local -r state_root="${_test_tmpdir}/state-authoritative-cli"
  _seed_authority "${state_root}" "authoritative"
  for script in scripts/deliver-ticket.sh scripts/batch-deliver.sh scripts/pm-liveness.sh scripts/ceo-loop.sh; do
    local cell
    cell="$(_run_cell "${script}" "${state_root}" "/nonexistent-typed-cli-path")"
    [[ "${cell%%|*}" == "0" ]] || return 1
    [[ "${cell##*|}" == "1" ]] || return 1
  done
  [[ ! -f "$(_marker_path)" ]] || {
    printf 'the typed CLI was invoked to decide authority\n' >&2
    return 1
  }
}

# The pre-migration layout is not authoritative: the resolver reads the project
# root, never the host root directly, so a legacy host document is dual-run.
test_legacy_host_document_is_not_authoritative() {
  local -r host_root="${_test_tmpdir}/host-legacy"
  mkdir -p "${host_root}/documents.workspace-a"
  cp "${ROOT_DIR}/tests/fixtures/dispatch/bash/authoritative.json" \
    "${host_root}/documents.workspace-a/dispatch-authority.json"
  for script in scripts/deliver-ticket.sh scripts/batch-deliver.sh scripts/pm-liveness.sh scripts/ceo-loop.sh; do
    local cell
    cell="$(_run_cell "${script}" "${host_root}")"
    [[ "${cell%%|*}" == "0" ]] || return 1
    [[ "${cell##*|}" == "0" ]] || {
      printf 'script %s read a host-root document as authoritative\n' "${script}" >&2
      return 1
    }
  done
}

# The environment override keeps precedence over the home default.
test_override_outranks_the_home_default() {
  local -r host_root="${_test_tmpdir}/host-override"
  local -r home_root="${_test_tmpdir}/home-authoritative"
  _seed_authority "${host_root}" "dual-run"
  _seed_authority "${home_root}" "authoritative"
  local cell=""
  cell="$(HOME="${home_root}" _run_cell scripts/deliver-ticket.sh "${host_root}")"
  [[ "${cell%%|*}" == "0" ]] || return 1
  [[ "${cell##*|}" == "0" ]] || {
    printf 'the home default outranked the environment override\n' >&2
    return 1
  }
}

test_matrix_is_deterministic_on_rerun() {
  local -r state_root="${_test_tmpdir}/state-rerun"
  _seed_authority "${state_root}" "authoritative"
  local first second
  first="$(_run_cell scripts/deliver-ticket.sh "${state_root}")"
  second="$(_run_cell scripts/deliver-ticket.sh "${state_root}")"
  [[ "${first}" == "${second}" ]]
}

run_test "TC-BASH-001 dual-run entry points are unchanged (no pointer, exit 0)" test_dual_run_has_no_pointer
run_test "TC-BASH-003 absent or malformed authority view means dual-run" test_absent_or_malformed_means_dual_run
run_test "TC-BASH-002 authoritative entry points print the deprecation pointer" test_authoritative_prints_pointer_and_still_runs
run_test "TC-BASH-004 typed CLI absent/broken never changes the decision" test_typed_cli_absent_never_changes_the_decision
run_test "TC-BASH-006 the resolver reads the project root, never the host root" test_legacy_host_document_is_not_authoritative
run_test "TC-BASH-007 the environment override keeps precedence over the home default" test_override_outranks_the_home_default
run_test "TC-BASH-004 the matrix is deterministic across a rerun" test_matrix_is_deterministic_on_rerun

printf '\n%s: %d tests, %d passed, %d failed\n' "${TEST_TAG}" "${_test_count}" "${_test_passed}" "${_test_failed}"
((_test_failed == 0))
