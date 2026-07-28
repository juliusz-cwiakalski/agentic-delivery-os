#!/usr/bin/env bash
# Cross-wrapper protocol and consumer regressions for GH-146.
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly TEST_DIR
ROOT="$(cd -- "${TEST_DIR}/../.." && pwd -P)"
readonly ROOT
tmp="$(mktemp -d)"
pass=0 fail=0
trap 'rm -rf "${tmp}"' EXIT

ok() { local name="$1"; shift; if "$@"; then printf '[PASS] %s\n' "${name}"; ((++pass)); else printf '[FAIL] %s\n' "${name}" >&2; ((++fail)); fi; }
run_parser() { local script="$1" file="$2"; bash -c 'source "$1"; _hook_validate_and_apply "$2"' _ "${script}" "${file}" >/dev/null; }
rejects() { local script="$1" file="$2"; ! run_parser "${script}" "${file}"; }
write_bytes() { local file="$1" count="$2"; dd if=/dev/zero bs=1 count="${count}" status=none | tr '\000' x >>"${file}"; }

# shellcheck disable=SC2016 # The child shell must receive literal command-substitution syntax.
test_literal_and_unset() {
  local script="$1" file="${tmp}/literal"
  printf 'ADOS_HOOK_ENV_V1\nset OC_ADOS_AGENT_PM_MODEL=literal $() `x` ; * = \\ "quoted"\nunset OC_ADOS_AGENT_CEO_MODEL\n' >"${file}"
  chmod 600 "${file}"
  bash -c 'source "$1"; export OC_ADOS_AGENT_CEO_MODEL=old; _hook_validate_and_apply "$2"; [[ "$OC_ADOS_AGENT_PM_MODEL" == *'"'"'$()'"'"'* && "$OC_ADOS_AGENT_PM_MODEL" == *'"'"'`x`'"'"'* && ! -v OC_ADOS_AGENT_CEO_MODEL ]]' _ "${script}" "${file}"
}
test_valid_utf8_cross_token_literal() {
  local script="$1" file="${tmp}/utf8-cross-token"
  printf 'ADOS_HOOK_ENV_V1\nset OC_ADOS_AGENT_PM_MODEL=0А\n' >"${file}"
  chmod 600 "${file}"
  bash -c 'source "$1"; _hook_validate_and_apply "$2"; [[ "$(LC_ALL=C printf %s "$OC_ADOS_AGENT_PM_MODEL" | od -An -t x1 | tr -d "[:space:]")" == 30d090 ]]' _ "${script}" "${file}"
}
test_file_bound() { local script="$1" file="${tmp}/file-${2}" bytes="$2" i prefix current remaining; printf 'ADOS_HOOK_ENV_V1\n' >"${file}"; for ((i=0; i<7; i++)); do prefix="set OC_ADOS_AGENT_X${i}_MODEL="; printf '%s' "${prefix}" >>"${file}"; write_bytes "${file}" "$((8192 - ${#prefix}))"; printf '\n' >>"${file}"; done; current="$(wc -c <"${file}")"; remaining="$((bytes - current))"; prefix='set OC_ADOS_AGENT_LAST_MODEL='; printf '%s' "${prefix}" >>"${file}"; write_bytes "${file}" "$((remaining - ${#prefix} - 1))"; printf '\n' >>"${file}"; chmod 600 "${file}"; if (( bytes == 65536 )); then run_parser "${script}" "${file}"; else rejects "${script}" "${file}"; fi; }
test_record_bound() { local script="$1" file="${tmp}/records-${2}" count="$2" i; : >"${file}"; printf 'ADOS_HOOK_ENV_V1\n' >"${file}"; for ((i=0; i<count; i++)); do printf 'set OC_ADOS_AGENT_X%s_MODEL=v\n' "${i}" >>"${file}"; done; chmod 600 "${file}"; if (( count == 256 )); then run_parser "${script}" "${file}"; else rejects "${script}" "${file}"; fi; }
test_line_bound() { local script="$1" file="${tmp}/line-${2}" bytes="$2"; printf 'ADOS_HOOK_ENV_V1\nset OC_ADOS_AGENT_PM_MODEL=' >"${file}"; write_bytes "${file}" "$((bytes - 27))"; printf '\n' >>"${file}"; chmod 600 "${file}"; if (( bytes == 8192 )); then run_parser "${script}" "${file}"; else rejects "${script}" "${file}"; fi; }
test_invalid_corpus() {
  local script="$1" file="${tmp}/invalid"
  printf 'ADOS_HOOK_ENV_V1\r\n' >"${file}"; chmod 600 "${file}"; rejects "${script}" "${file}" || return 1
  printf 'ADOS_HOOK_ENV_V1\nset OC_ADOS_AGENT_PM_MODEL=x\r\n' >"${file}"; rejects "${script}" "${file}" || return 1
  printf 'ADOS_HOOK_ENV_V1\nset OC_ADOS_AGENT_PM_MODEL=x' >"${file}"; rejects "${script}" "${file}" || return 1
  printf 'ADOS_HOOK_ENV_V1\nset OC_ADOS_AGENT_PM_MODEL=x\000\n' >"${file}"; rejects "${script}" "${file}" || return 1
  printf 'ADOS_HOOK_ENV_V1\nset OC_ADOS_AGENT_PM_MODEL=x\nset OC_ADOS_AGENT_PM_MODEL=y\n' >"${file}"; rejects "${script}" "${file}" || return 1
  printf 'ADOS_HOOK_ENV_V1\nset UNAUTHORIZED=x\n' >"${file}"; rejects "${script}" "${file}" || return 1
  ln -sf /etc/passwd "${file}.link"; rejects "${script}" "${file}.link" || return 1
  printf 'ADOS_HOOK_ENV_V1\n' >"${file}.unsafe"; chmod 666 "${file}.unsafe"; rejects "${script}" "${file}.unsafe"
}
test_credential_delegation() {
  local script="$1" file="${tmp}/credential"
  printf 'ADOS_HOOK_ENV_V1\nset API_TOKEN=secret-never-log\n' >"${file}"
  chmod 600 "${file}"
  rejects "${script}" "${file}" || return 1
  ADOS_HOOK_ENV_ALLOWLIST=API_TOKEN bash -c 'source "$1"; _hook_validate_and_apply "$2"; [[ "$API_TOKEN" == secret-never-log ]]' _ "${script}" "${file}"
}
test_atomic_rollback() {
  local script="$1" file="${tmp}/rollback"
  printf 'ADOS_HOOK_ENV_V1\nset OC_ADOS_AGENT_PM_MODEL=new\nset OC_ADOS_AGENT_CEO_MODEL=other\n' >"${file}"
  chmod 600 "${file}"
  bash -c 'source "$1"; unset OC_ADOS_AGENT_CEO_MODEL; OC_ADOS_AGENT_PM_MODEL=old; export OC_ADOS_AGENT_PM_MODEL; _hook_apply_operation(){ [[ "$2" != OC_ADOS_AGENT_CEO_MODEL ]]; }; ! _hook_validate_and_apply "$2"; [[ "$OC_ADOS_AGENT_PM_MODEL" == old && ! -v OC_ADOS_AGENT_CEO_MODEL ]]' _ "${script}" "${file}"
}
test_metadata_adapter() {
  local script="$1" style="$2" file uid calls
  file="${tmp}/metadata-${style}"
  calls="${tmp}/metadata-${style}.calls"
  : >"${calls}"
  uid="$(id -u)"
  printf 'ADOS_HOOK_ENV_V1\n' >"${file}"
  chmod 600 "${file}"
  HOOK_TEST_UID="${uid}" HOOK_TEST_STYLE="${style}" HOOK_TEST_CALLS="${calls}" bash -c '
    source "$1"
    _hook_stat() {
      printf "%s\n" "$1" >>"$HOOK_TEST_CALLS"
      if [[ "$HOOK_TEST_STYLE" == gnu ]]; then
        [[ "$1" == -c ]] && { printf "600 %s\n" "$HOOK_TEST_UID"; return 0; }
        return 1
      fi
      [[ "$1" == -c ]] && return 1
      [[ "$1" == -f ]] && { printf "600 %s\n" "$HOOK_TEST_UID"; return 0; }
      return 1
    }
    _hook_validate_and_apply "$2"
  ' _ "${script}" "${file}" || return 1
  if [[ "${style}" == gnu ]]; then
    [[ "$(<"${calls}")" == "-c" ]] || return 1
  else
    [[ "$(<"${calls}")" == $'-c\n-f' ]] || return 1
  fi
}

# TC-HOOK-011/023: exercise each real wrapper's OWN/spawn path and installed
# trap.  The harness sources only to inject external boundaries; it calls
# run_loop or run_delivery, never run_pre_iteration_hook directly.
# SIGKILL and children that deliberately leave setsid's process group are excluded:
# neither can be cleaned up by a trappable wrapper signal.
# F-13/CG-SRE-002: is_gone_or_zombie uses /proc/${pid}/stat which is Linux-only.
# On BSD/macOS, fall back to kill -0 only (less precise but functional).
is_gone_or_zombie() {
  local pid="$1" state=""
  [[ "${pid}" =~ ^[0-9]+$ ]] || return 0

  if [[ -r "/proc/${pid}/stat" ]]; then
    # Linux: read process state from /proc for precise zombie detection
    state="$(cut -d' ' -f3 "/proc/${pid}/stat" 2>/dev/null || true)"
    [[ "${state}" == "Z" ]] && return 0
  fi

  # Fallback: BSD/macOS or Linux /proc unavailable — check via kill -0
  ! kill -0 "${pid}" 2>/dev/null
}

wait_for_file() {
  local file="$1" i
  for ((i = 0; i < 100; i++)); do
    [[ -s "${file}" ]] && return 0
    sleep 0.01
  done
  return 1
}

run_lifecycle_trial() {
  local wrapper="$1" signal="$2" trial="$3"
  local work="${tmp}/lifecycle-${wrapper}-${signal}-${trial}"
  local hook="${work}/hook" harness="${work}/harness" marker="${work}/marker"
  mkdir -p "${work}"
  cat >"${hook}" <<'HOOK'
#!/usr/bin/env bash
sleep "${HOOK_SLEEP}" &
child=$!
printf '%s %s %s\n' "$$" "${child}" "${ADOS_HOOK_ENV_OUTPUT}" >"${HOOK_MARKER}"
wait "${child}"
HOOK
  chmod 700 "${hook}"
  cat >"${harness}" <<'HARNESS'
#!/usr/bin/env bash
set -Eeuo pipefail
export TMPDIR="$1/tmp"
mkdir -p "${TMPDIR}"
source "$2"
if [[ "$(basename -- "$2")" == ceo-loop.sh ]]; then
  CEO_STATE_DIR="$1/state"; CEO_PID_FILE="$1/state/pid"; LOOP_PID_FILE="$1/state/loop"; STOP_FILE="$1/state/stop"; LOG_DIR="$1/log"
  MAX_ITERATIONS=1; POLL_SECONDS=0; LOOP_SLEEP_SECONDS=0
  source_opencode_env(){ :; }; _jq(){ printf '{}'; }; ceo_pid_if_live(){ return 1; }; last_session_id(){ :; }; capture_session_id_by_title(){ printf ses; }
  _setsid(){ if [[ "$1" == opencode ]]; then sleep 0.01; else command setsid "$@"; fi; }
  run_loop
else
  DELIVERY_DIR="$1/delivery"; mkdir -p "$DELIVERY_DIR"
  resolve_session(){ :; }; run_single_iteration(){ printf finished; }; classify_result(){ printf failed; }; pr_url_for(){ :; }; decide_after_iteration(){ printf stop:0:finished; }
  run_delivery GH-146 feat/test >/dev/null
fi
HARNESS
  chmod 700 "${harness}"
  if [[ "${signal}" == normal ]]; then
    HOOK_MARKER="${marker}" HOOK_SLEEP=0.05 ADOS_PRE_ITERATION_HOOK="${hook}" \
      ADOS_HOOK_SHUTDOWN_GRACE_SECONDS=1 bash "${harness}" "${work}" "${ROOT}/scripts/${wrapper}" || return 1
  else
    local wrapper_pid_file="${work}/wrapper.pid" wrapper_pid
    # Run the harness in the foreground so Bash has a trappable SIGINT
    # disposition; a background-launched Bash inherits SIGINT ignored.
    (
      local target_pid="${BASHPID}"
      printf '%s\n' "${target_pid}" >"${wrapper_pid_file}"
      ( wait_for_file "${marker}" && kill -"${signal}" "${target_pid}" ) &
      exec env HOOK_MARKER="${marker}" HOOK_SLEEP=2 ADOS_PRE_ITERATION_HOOK="${hook}" \
        ADOS_HOOK_SHUTDOWN_GRACE_SECONDS=1 bash "${harness}" "${work}" "${ROOT}/scripts/${wrapper}"
    ) || true
    wrapper_pid="$(<"${wrapper_pid_file}")"
    is_gone_or_zombie "${wrapper_pid}" || return 1
    # The real EXIT trap performs TERM, the configured one-second grace, then
    # reap/KILL. Check only after that documented grace has elapsed.
    sleep 1.1
  fi
  local hook_pid child_pid output
  IFS=' ' read -r hook_pid child_pid output <"${marker}" || return 1
  is_gone_or_zombie "${hook_pid}" || { printf 'hook remains: %s\n' "${hook_pid}" >&2; return 1; }
  is_gone_or_zombie "${child_pid}" || { printf 'child remains: %s\n' "${child_pid}" >&2; return 1; }
  [[ ! -e "${output}" && ! -e "$(dirname -- "${output}")" ]] || { printf 'hook artifact remains: %s\n' "${output}" >&2; return 1; }
}

test_real_wrapper_lifecycle_matrix() {
  local wrapper signal trial
  for wrapper in ceo-loop.sh deliver-ticket.sh; do
    for signal in normal TERM INT HUP; do
      for ((trial = 1; trial <= 20; trial++)); do
        run_lifecycle_trial "${wrapper}" "${signal}" "${trial}" || {
          printf 'lifecycle failure: wrapper=%s path=%s trial=%s\n' "${wrapper}" "${signal}" "${trial}" >&2
          return 1
        }
      done
    done
  done
}

for wrapper in ceo-loop.sh deliver-ticket.sh; do
  script="${ROOT}/scripts/${wrapper}"
  ok "TC-HOOK-024 ${wrapper}: literal set/unset" test_literal_and_unset "${script}"
  ok "TC-HOOK-024 ${wrapper}: valid UTF-8 cross-token literal inherited exactly" test_valid_utf8_cross_token_literal "${script}"
  ok "TC-HOOK-026 ${wrapper}: exact 65536 bytes" test_file_bound "${script}" 65536
  ok "TC-HOOK-026 ${wrapper}: reject 65537 bytes" test_file_bound "${script}" 65537
  ok "TC-HOOK-026 ${wrapper}: exact 256 records" test_record_bound "${script}" 256
  ok "TC-HOOK-026 ${wrapper}: reject 257 records" test_record_bound "${script}" 257
  ok "TC-HOOK-026 ${wrapper}: exact 8192-byte line" test_line_bound "${script}" 8192
  ok "TC-HOOK-026 ${wrapper}: reject 8193-byte line" test_line_bound "${script}" 8193
  ok "TC-HOOK-026 ${wrapper}: C-locale invalid corpus" test_invalid_corpus "${script}"
  ok "TC-HOOK-026 ${wrapper}: explicit credential delegation" test_credential_delegation "${script}"
  ok "TC-HOOK-026 ${wrapper}: apply rollback" test_atomic_rollback "${script}"
  ok "TC-HOOK-026 ${wrapper}: GNU metadata adapter" test_metadata_adapter "${script}" gnu
  ok "TC-HOOK-026 ${wrapper}: BSD metadata adapter" test_metadata_adapter "${script}" bsd
done

ok 'TC-HOOK-013 no hook-specific result values' bash -c "! grep -RE 'vetoed|hook-error' '${ROOT}/scripts/ceo-loop.sh' '${ROOT}/scripts/deliver-ticket.sh' '${ROOT}/scripts/batch-deliver.sh' '${ROOT}/.opencode/agent/ceo.md'"
ok 'TC-HOOK-022 CEO retains failed retry-or-park branch' bash -c "grep -q 'failed' '${ROOT}/.opencode/agent/ceo.md'"
ok 'TC-HOOK-025 CEO uses direct spawn result boundary' bash -c "! grep -q 'ceo_pid=.*spawn_or_resume_ceo' '${ROOT}/scripts/ceo-loop.sh' && grep -q 'SPAWN_OR_RESUME_CEO_PID' '${ROOT}/scripts/ceo-loop.sh'"
ok 'TC-HOOK-027 hook return never source/eval' bash -c "! grep -E 'source .*HOOK_ENV|eval .*HOOK' '${ROOT}/scripts/ceo-loop.sh' '${ROOT}/scripts/deliver-ticket.sh'"
ok 'TC-HOOK-011/023 20-trial real-wrapper lifecycle matrix' test_real_wrapper_lifecycle_matrix
printf 'Results: %d passed, %d failed\n' "${pass}" "${fail}"
(( fail == 0 ))
