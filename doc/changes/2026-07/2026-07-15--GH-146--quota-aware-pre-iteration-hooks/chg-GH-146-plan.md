---
id: chg-GH-146-quota-aware-pre-iteration-hooks
status: Updated
created: 2026-07-15T00:00:00Z
last_updated: 2026-07-16T10:12:51Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["autonomous-delivery", "quota", "hooks"]
links:
  change_spec: ./chg-GH-146-spec.md
  test_plan: ./chg-GH-146-test-plan.md
  tdr: ../../../decisions/TDR-0002-pre-iteration-hook-contract-details.md
  feature_spec: ../../../spec/features/feature-autonomous-delivery.md
  delivery_modes_guide: ../../../guides/delivery-modes.md
summary: >
  Add one consistent, opt-in pre-iteration hook contract across ceo-loop.sh and
  deliver-ticket.sh so a user-owned hook can delay a session or return strictly
  validated, authorized parent-environment updates before each OpenCode spawn or
  resume, while preserving delivery invariants and existing result behavior,
  leaving downstream variable meaning user-defined, and shipping an
  installed-but-inactive Z.AI example.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-146: Add quota-aware pre-iteration hooks to autonomous delivery loops

## Context and Goals

This plan implements `chg-GH-146-spec.md` v1.6 and its v1.6 31-scenario test plan under
**Accepted TDR-0002 (R2, decision date 2026-07-16)**. A missing hook remains a
silent no-op. A present hook runs on the OWN path immediately before every actual
CEO or PM OpenCode spawn/resume, including watchdog retries, but never on JOIN,
probe, control-command, or dry-run paths. Scheduling deferral is sleep then exit
0. All hook failures use the existing component behavior; no `vetoed`,
`hook-error`, CEO-prompt change, or batch-consumer change is introduced.

The implementation also delivers F-9's parent-created `ADOS_HOOK_ENV_V1` return
channel. The parent validates bounded protocol data without `source`, `eval`, or
value expansion, then applies authorized set/unset operations atomically before
constructing the imminent OpenCode command. Updates persist only in the applying
wrapper and its later children/iterations. GH-146 guarantees that safe atomic
environment mutation and inheritance boundary only: variable meaning and
downstream behavior are user-defined, and no provider/model selection,
`{env:...}` binding, actual selected-model, wrapper `-m`, or `CEO_LOOP_MODEL`
behavior is required or asserted.

### Required implementation decisions

- **CEO parent-shell boundary (readiness finding 2):** `run_loop` must never call
  `spawn_or_resume_ceo` through `$(...)`. It invokes the function directly. The
  function publishes its PID through a documented internal global result,
  `SPAWN_OR_RESUME_CEO_PID`, and publishes hook-failure state through an internal
  status/result variable. It prints no PID for capture. Therefore
  `CURRENT_HOOK_PID`, temporary-output trackers, parser/apply mutations, and the
  returned CEO PID all remain in the main wrapper shell and are visible to
  EXIT/HUP/INT/TERM traps and later iterations.
- **PM parent-shell boundary:** `deliver_loop` invokes the hook, parses, and
  applies valid environment output in its parent shell inside every retry
  iteration, immediately before the existing command-substituted
  `run_single_iteration`. The command substitution may remain because it is
  created only after the parent exports the update; the imminent PM inherits it,
  and the parent retains it for future retries. Hook state must not be created
  inside `run_single_iteration` or any command substitution.
- **Contract-identical private helpers:** production wrappers do not currently
  source a shared runtime shell library, while install and uninstall use explicit
  artifact inventories. Implement private helper families in each wrapper with
  the same names, grammar, limits, authorization, staging/apply, cleanup, and
  diagnostics, and enforce parity through both-wrapper table-driven tests.
- **Interruptible CEO retry wait (readiness finding 6):** replace one 60-second
  sleep with a helper that checks `STOP_FILE` before and after bounded sleep
  chunks. Per spec v1.6 AC-F4-2/NFR-4/RSK-11 and TC-HOOK-012,
  `ADOS_HOOK_RETRY_SECONDS` remains the total non-busy interval, each chunk is no
  longer than one second, a newly created `STOP_FILE` is observed within ≤1
  second, and no subsequent hook/OpenCode spawn occurs. Preserve short intervals
  such as `0.1` without adding a new operator setting.

### Artifact alignment, rejected alternative, and scoped follow-ups

- **Artifact alignment complete:** spec v1.6, test-plan v1.6, and Accepted
  TDR-0002 consistently define PM per-retry placement, CEO total retry interval
  and ≤1-second stop response, exact C-locale protocol boundaries, explicit-only
  credential delegation, distinct result domains, deterministic missing-hook
  behavior, optional model-configuration examples, and safe wrapper-local
  environment inheritance without downstream interpretation guarantees. This
  plan consumes those rules directly; no cross-artifact inconsistency remains.
- **Rejected alternative — shared runtime helper:** a new sourced shell-library
  artifact would introduce path, trust, install, uninstall, testing, and version
  scope absent from GH-146. The repository has no existing production shared-
  library convention for these wrappers. The chosen in-scope design therefore
  keeps contract-identical private helpers in both wrappers and enforces parity
  with shared fixtures and both-wrapper tests; no new distributable artifact is
  added.
- `ADOS_HOOK_MAX_FAILURES=5` and `ADOS_HOOK_RETRY_SECONDS=60` are the delivery
  defaults. Spec OQ-1 permits later evidence-based tuning but requires no decision
  for GH-146 implementation.
- `@doc-syncer` decides whether the `AGENTS.md` repo map needs a `scripts/hooks/`
  entry (spec OQ-2); this does not change the defined artifact inventory.
- The repository has no centralized version. Finalization must follow the
  existing per-script `APP_VERSION` convention if applicable and must not invent
  a new version scheme.

## Scope

### In Scope

- F-1/F-2: one behavioral hook contract in both wrappers, called after OWN/JOIN
  resolution and before every spawn/resume; missing is silent, while
  not-executable, exec-failing, and non-zero hooks prevent spawn and diagnose the
  path/reason. Each wrapper's settings and `--help` surface distinguishes shared
  operator settings, CEO-only operator settings, and wrapper-provided context.
- F-3/F-4: tracked hook process groups; no execution timeout; cleanup on normal
  exit and direct HUP/INT/TERM; deliver-ticket existing `failed`/exit-1 path;
  CEO separate bounded failure counter and interruptible non-busy wait.
- F-9/DM-7/DM-8: fresh absolute mode-0600 output file in a mode-0700 private
  directory; exact `ADOS_HOOK_ENV_V1` grammar; built-in non-credential model
  namespace plus validated exact operator allowlist; exact `LC_ALL=C` raw-byte,
  record, line, CR/NUL, and final-LF rules; whole-batch staging; atomic set/unset;
  defensive rollback; same-wrapper inheritance; value-safe logs; cleanup.
- F-5/F-6/F-7: deterministic Z.AI example, `ADOS_HOOK_EXAMPLES` installation,
  symmetric uninstall, pure UTC logic, and mockable seams.
- F-8: update the autonomous-delivery feature spec and delivery-modes guide with
  activation, lifecycle, failure, environment-return, authorization, security,
  and inheritance contracts; present `OC_ADOS_MODEL_PROFILE`, tier defaults,
  per-agent overrides, and `{env:...}` only as optional user-setup examples;
  state that downstream semantics are user-defined; and cross-link delivery
  modes and the canonical OpenCode model-configuration guide in both directions.
- Every current test-plan scenario: TC-HOOK-001…027, including 007B and 019B,
  plus TC-HOOK-REG-1 and TC-HOOK-REG-2 (31 total).

### Out of Scope

- Interrupting an OpenCode session already running when a blocked window begins.
- Provider quota APIs and ADOS-supplied, discovered, queried, or automatically
  managed credentials. The built-in namespace grants no credential authority;
  an operator may explicitly delegate an exact valid credential identifier via
  `ADOS_HOOK_ENV_ALLOWLIST` at their own risk.
- Auto-activating the example, copying workstation profiles, or allowing returned
  shell execution.
- A PM hook mutating its already-running CEO parent or providing fleet-wide PM
  switching.
- Any guarantee that returned variables select a provider/model, change an
  actually selected model, are consumed through `{env:...}`, alter wrapper `-m`
  behavior, or change the existing `CEO_LOOP_MODEL` contract.
- Changes to single-flight, liveness, merge authority, stuck-restart semantics,
  result domains, CEO prompt behavior, or batch classification, except the
  explicitly separate CEO hook-failure retry policy.
- Cleanup claims for wrapper-only SIGKILL, host/power failure, or descendants
  that leave the hook process group.
- A shared runtime shell library; that alternative is rejected to avoid adding
  distribution and lifecycle scope beyond GH-146.

### Constraints

- Bash ≥4 and `.ai/rules/bash.md`: strict mode, quoted data, no untrusted source,
  no `eval`, dependency-injection seams, pure functions, testable main guards,
  and discoverable `test-*.sh` suites.
- A present-hook invocation receives wrapper-provided `ADOS_HOOK_AGENT`,
  `ADOS_HOOK_SCRIPT`, `ADOS_HOOK_ENV_OUTPUT`, and exact
  `ADOS_HOOK_ENV_FORMAT=ADOS_HOOK_ENV_V1`; these are per-invocation hook context,
  not operator settings.
- The return file is data only. Stdout/stderr remain diagnostics; delivery-summary
  stdout must not be contaminated by protocol data.
- Empty output and exact header-only output mean no update. Every non-empty file,
  including header-only, has the exact header/records and final LF. Before Bash
  string parsing, byte-oriented validation under `LC_ALL=C` rejects CR (`0x0D`)
  and NUL (`0x00`) anywhere, missing final LF, blank/comment lines, extra header
  text, unknown verbs, and malformed/duplicate/conflicting names.
- Exact inclusive limits under `LC_ALL=C` are 65,536 raw whole-file bytes,
  including the header and every LF; 256 operation records, excluding the header;
  and 8,192 raw bytes per logical line, excluding its terminating LF. Each exact
  limit is accepted and each limit+1 case is rejected in both wrappers.
- Names match `[A-Z_][A-Z0-9_]*`; built-in authorization is only
  `^OC_ADOS_AGENT_[A-Z0-9_]+_MODEL$` and excludes credentials. Additional exact
  names come from a startup-validated comma-separated
  `ADOS_HOOK_ENV_ALLOWLIST` with no empty, duplicate, or invalid entries. This is
  explicit operator delegation: an exact credential identifier may be allowlisted
  at operator risk, but GH-146 supplies, discovers, queries, and auto-adds no
  credential name or value; returned values are never logged.
- Before parsing, require a wrapper-owned regular non-symlink output file that is
  not group/world writable. Validate every operation and target writability before
  mutation; snapshot prior set/unset state and restore on unexpected apply error.
- Values after the first `=` are literal, including empty values, spaces, `=`,
  quotes, backslashes, dollars, backticks, semicolons, globs, and `$()`.
- Temp artifacts and tracked PIDs remain visible to parent traps and are removed
  on success, hook/validation/apply failure, normal exit, and direct HUP/INT/TERM.
- Every phase uses `@committer`, stages only that phase's files, and never stages
  `.ai/local/`. AI agents do not add license headers manually.

### Risks

- **RSK-1:** Retry call sites bypass the hook. Mitigate with inside-loop placement
  and counter tests in both real wrappers (TC-HOOK-002/003/027).
- **RSK-2:** Subshell state hides hook PID/temp state/environment from traps or
  later iterations. Mitigate by the direct CEO call/global-result contract and
  PM pre-command-substitution placement, with real-wrapper signal/inheritance
  tests (TC-HOOK-011/023/025).
- **RSK-3:** Hook failure consumes stuck restart budget. Mitigate with failure
  before PM iteration and a separate CEO counter (TC-HOOK-007/007B/008/012).
- **RSK-9:** Unsafe or locale-dependent output executes shell, crosses an
  authority boundary, or partially mutates state. Mitigate with byte preflight
  under `LC_ALL=C`, exact inclusive/limit+1 and CR/NUL/final-LF cases,
  explicit-only credential delegation, data-only staging, authorization,
  snapshot/rollback, and both-wrapper TC-HOOK-024/026/027 matrices.
- **RSK-11:** A one-shot retry sleep delays `--stop`. Mitigate per
  AC-F4-2/NFR-4 with `ADOS_HOOK_RETRY_SECONDS` as the total interval, ≤1-second
  chunks, stop observation within ≤1 second, and no next spawn in TC-HOOK-012.
- **RSK-2:** Sleeping hook or temp file survives supported shutdown. Mitigate with
  parent-visible trackers and 20-trial normal/HUP/INT/TERM tests per wrapper.
- **RSK-4/RSK-8:** Example auto-activates or remains after uninstall. Mitigate with
  separate inactive path and symmetric inventory tests (TC-HOOK-019/019B).
- **RSK-7:** Consumer/result behavior drifts. Mitigate with TC-HOOK-013/021/022;
  preserve distinct existing classifier and emitted-summary domains.
- **Implementation risk — private-helper drift:** Mitigate with the same
  constants, function contracts, fixtures, and table-driven assertions against
  both wrappers; review diffs side by side before considering any shared-artifact
  expansion.
- **RSK-10:** Operators mistake wrapper-local inheritance for provider/model
  selection. Mitigate by asserting only parent-environment state, treating model
  namespace/profile/`{env:...}` material as optional user-defined examples, and
  explicitly excluding bindings, selected models, wrapper `-m`, and PM-to-CEO
  mutation in TC-HOOK-020/024/025 and final review.
- **RSK-12:** Missing-hook code introduces hook work beyond the required path
  check. Mitigate with deterministic instrumentation in both wrappers proving no
  hook subprocess/temp artifact, intentional wait/sleep, or hook-related log
  before normal spawn/resume (TC-HOOK-001).

### Success Metrics

- The absent-hook path performs only the required path check before normal
  spawn/resume: no hook subprocess/temp artifact, intentional wait/sleep, or
  hook-related log output in either wrapper.
- Zero in-group hook processes and zero temp artifacts survive normal exit or
  direct HUP/INT/TERM across 20 trials per wrapper/path.
- Hook failures consume zero stuck-restart slots; CEO exits non-zero at its
  separate cap, and deliver-ticket starts no PM and returns existing failed/1.
- Per AC-F4-2/NFR-4/TC-HOOK-012, a stop file written during the total CEO retry
  interval is observed within ≤1 second, without another hook/OpenCode spawn.
- All valid V1 batches apply before the imminent command; every invalid or
  failed-apply batch changes zero variables from that invocation. Evidence stops
  at imminent/same-wrapper environment inheritance and asserts no downstream
  variable meaning or provider/model selection.
- Logs expose zero returned values; both wrappers accept exact 65,536-byte,
  256-record, and 8,192-byte-line limits and reject limit+1, CR, NUL, and missing
  final LF under `LC_ALL=C`; no temp artifacts remain.
- UTC boundaries pass at 04:29:59, 04:30:00, 09:59:59, and 10:00:00; no real
  multi-hour sleeps occur in tests.
- Installed example is executable but inactive and is removed with the now-empty
  `scripts/hooks/` directory on uninstall.
- Both wrapper `--help` outputs and delivery-mode docs list the correct shared
  and CEO-only operator settings/defaults and separately identify all four
  per-invocation context variables; help assertions and TC-HOOK-020 pass.
- Zero hook-specific result values and no CEO/batch consumer changes.

## Phases

### Phase 1: Deliver-ticket parent-shell hook and environment return

**Goal**: Implement the PM-side contract in `deliver_loop` so hook lifecycle and
environment mutations stay in the wrapper parent immediately before every
command-substituted PM iteration.

**Tasks**:

- [ ] **1.1** Add the deliver-ticket operator settings with defaults and startup
  validation: `ADOS_PRE_ITERATION_HOOK` (fallback
  `$HOME/.ados/hooks/pre-opencode-iteration`),
  `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS` (default 2), and
  `ADOS_HOOK_ENV_ALLOWLIST` (optional comma-separated exact identifiers). Keep
  `ADOS_HOOK_RETRY_SECONDS` and `ADOS_HOOK_MAX_FAILURES` CEO-only. Add private
  `CURRENT_HOOK_PID` and current temp directory/file state; extend EXIT/HUP/INT/
  TERM cleanup to TERM→grace→KILL/reap the group, remove artifacts, and clear
  trackers.
- [ ] **1.2** Update `deliver-ticket.sh --help`/`usage()` settings text with those
  three operator settings, defaults/semantics, and the allowlist's explicit
  operator-risk credential delegation. Add a separate **per-invocation hook
  context (not operator settings)** subsection for wrapper-provided
  `ADOS_HOOK_AGENT=pm`, `ADOS_HOOK_SCRIPT=deliver-ticket`, absolute fresh
  `ADOS_HOOK_ENV_OUTPUT`, and fixed
  `ADOS_HOOK_ENV_FORMAT=ADOS_HOOK_ENV_V1`; do not list CEO-only settings as PM
  settings.
- [ ] **1.3** Add private hook invocation that silently returns when absent;
  rejects not-executable/exec-failing/non-zero hooks with path/reason diagnostics;
  creates fresh 0700/0600 output artifacts; exports PM context and V1 context;
  launches with `setsid`, tracks/waits for the group, and imposes no timeout.
- [ ] **1.4** Add strict V1 validation/staging/apply helpers. Perform raw-byte
  preflight under `LC_ALL=C` before Bash string parsing; reject CR/NUL anywhere
  and every non-empty file lacking final LF. Accept exactly 65,536 whole-file
  bytes including header/LFs, 256 operations excluding the header, and 8,192
  bytes per logical line excluding terminating LF; reject 65,537/257/8,193.
  Preserve zero-byte/header-only compatibility, exact grammar and literal values.
  Validate unique writable names against the built-in non-credential model
  namespace plus the startup-validated exact allowlist; permit an exact credential
  identifier only through explicit operator delegation. Then stage the whole
  batch, snapshot prior state, apply exported set/unset operations without
  source/eval, rollback unexpected apply failures, emit value-free diagnostics,
  and clean up. Invalid output enters the existing hook-failure path.
- [ ] **1.5** Place invocation and parse/apply directly in the parent
  `deliver_loop`, after OWN and inside each retry iteration, immediately before
  `iteration_output="$(run_single_iteration ...)"`. Construct no PM command and
  consume/increment no PM restart budget before success. On failure set existing
  `DELIVERY_RESULT=failed`, exit code 1, and last-message/stderr diagnostic; do not
  spawn PM. Ensure exported updates reach that command substitution and later
  iterations of this wrapper.
- [ ] **1.6** Extend `scripts/.tests/test-deliver-ticket.sh` with PM-side cases for
  TC-HOOK-001…011 and TC-HOOK-023…027, using the real wrapper for signal,
  placement, fresh-file, and inheritance evidence. Assert hook/temp state is
  created outside command substitution and each retry gets a new output path.
  For TC-HOOK-026, run generated byte fixtures under `LC_ALL=C` for exact and
  limit+1 file/record/line bounds, CR in header/record/CRLF, embedded NUL, missing
  final LF, built-in credential rejection, and exact allowlisted credential
  acceptance. Assert accepted boundary/delegation fixtures can proceed without
  logging values, while every rejection fixture causes no mutation or spawn.
- [ ] **1.7** Add automated `deliver-ticket.sh --help` assertions for exact
  operator-setting names, defaults/classification, all four per-invocation context
  names, and absence of CEO-only retry/cap settings; include a manual help-text
  consistency check in TC-HOOK-020.

**Acceptance Criteria**:

- Must: AC-F1-2, AC-F1-3, AC-F1-4, AC-F2-1, AC-F2-2, AC-F3-1,
  AC-F3-2, AC-F4-1, PM portions of AC-F9-1…4, TC-HOOK-001/026, and the PM
  settings/help assertions pass without a PM spawn or restart-budget mutation on
  failure.
- Should: deterministic absent-path evidence shows only the required path check
  before the normal PM spawn/resume path, and valid return updates persist into
  the imminent PM and later same-wrapper retries only, without asserting
  downstream interpretation.

**Files and modules**:

- Code areas: `scripts/deliver-ticket.sh`; `scripts/.tests/test-deliver-ticket.sh`.
- System docs: none.

**Tests**:

- `bash scripts/.tests/test-deliver-ticket.sh`

**Completion signal**: `feat(GH-146): add parent-shell PM hook environment return`

---

### Phase 2: CEO direct-call boundary and interruptible retry

**Goal**: Implement the CEO-side contract without command substitution so hook
PID/temp/environment state remains visible to main-shell traps and iterations,
and remediate the noninterruptible retry wait.

**Tasks**:

- [ ] **2.1** Implement CEO settings explicitly: shared operator settings
  `ADOS_PRE_ITERATION_HOOK` (documented fallback),
  `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS` (default 2), and
  `ADOS_HOOK_ENV_ALLOWLIST`, plus CEO-only `ADOS_HOOK_RETRY_SECONDS` (default 60,
  total retry interval) and `ADOS_HOOK_MAX_FAILURES` (default 5). Mirror Phase
  1's contract-identical private lifecycle/parser helpers with CEO context,
  parent-visible hook/temp trackers, and EXIT/HUP/INT/TERM cleanup.
- [ ] **2.2** Update `ceo-loop.sh --help`/`usage()` settings text with all five
  operator settings and defaults/semantics, including fixed ≤1-second stop polling
  as behavior rather than another setting and explicit allowlist credential risk.
  Separately label wrapper-provided `ADOS_HOOK_AGENT=ceo`,
  `ADOS_HOOK_SCRIPT=ceo-loop`, fresh absolute `ADOS_HOOK_ENV_OUTPUT`, and fixed
  `ADOS_HOOK_ENV_FORMAT=ADOS_HOOK_ENV_V1` as per-invocation hook context, not
  operator settings.
- [ ] **2.3** Refactor `run_loop` from
  `ceo_pid="$(spawn_or_resume_ceo ...)"` to a direct function call. Initialize and
  consume `SPAWN_OR_RESUME_CEO_PID` plus an internal result/status variable; have
  JOIN and successful spawn/resume publish the PID there, and never print a PID
  for command substitution. Keep the live-CEO JOIN return before hook execution.
- [ ] **2.4** On the actual spawn/resume branch, invoke hook and process V1 output
  in the direct-called main shell before constructing the OpenCode command. A
  valid update must reach the imminent CEO and later CEO iterations. While the
  wrapper waits for the hook, its direct HUP/INT/TERM traps must see
  `CURRENT_HOOK_PID` and temp state. Hook failure publishes the internal failure
  status without incrementing stuck `restarts`.
- [ ] **2.5** Implement the separate consecutive hook-failure policy
  (AC-F4-2, NFR-4, RSK-11, TC-HOOK-012). Add a
  stop-aware retry-wait helper that checks `STOP_FILE` before and after chunks no
  longer than one second, preserves configured fractional intervals, makes the
  chunk durations sum to the total `ADOS_HOOK_RETRY_SECONDS`, observes stop within
  ≤1 second, exits without another hook/OpenCode spawn when stopped, and never
  performs one uninterruptible 60-second sleep. Reset the hook-failure counter on
  hook success or after a CEO has run; at `ADOS_HOOK_MAX_FAILURES`, log the
  distinct cap message and exit 1 with `restarts==0`.
- [ ] **2.6** Extend `scripts/.tests/test-ceo-loop.sh` for CEO sides of
  TC-HOOK-001…014 and TC-HOOK-023…027. Add static and real-wrapper assertions that
  `spawn_or_resume_ceo` is not command-substituted, traps can kill a hook and
  clean its temp output while it is running, and valid output persists to imminent
  and later CEO commands. For AC-F4-2/NFR-4/TC-HOOK-012, use deterministic
  sleep/time recording or a tight bounded harness to prove each wait chunk is
  ≤1 second, chunks sum to the configured total interval, stop is observed within
  ≤1 second, and no subsequent hook/OpenCode spawn occurs. Run the same
  `LC_ALL=C` TC-HOOK-026 exact/limit+1, CR/NUL/final-LF, credential-authority,
  atomic-rejection, value-safe-log, and cleanup matrix as deliver-ticket.
- [ ] **2.7** Add automated `ceo-loop.sh --help` assertions for all five operator
  settings and defaults, fixed polling behavior, all four separately labeled
  per-invocation context names, and their operator/context distinction; include a
  manual help-text consistency check in TC-HOOK-020.

**Acceptance Criteria**:

- Must: AC-F1-1, AC-F1-3, AC-F1-4, AC-F2-1, AC-F2-2, AC-F3-1,
  AC-F3-2, AC-F4-2/NFR-4 via TC-HOOK-012, CEO portions of AC-F9-1…4,
  TC-HOOK-001/014/026, and CEO settings/help assertions pass; readiness iteration
  1 findings 2/6 and iteration 2 finding 8 are regression-tested.
- Should: direct-call/global-result behavior is documented beside the functions,
  and the retry helper remains non-busy for every accepted interval.

**Files and modules**:

- Code areas: `scripts/ceo-loop.sh`; `scripts/.tests/test-ceo-loop.sh`.
- System docs: none.

**Tests**:

- `bash scripts/.tests/test-ceo-loop.sh`

**Completion signal**: `feat(GH-146): keep CEO hook state in parent shell`

---

### Phase 3: Cross-wrapper security, lifecycle, and consumer regressions

**Goal**: Prove both duplicated implementations satisfy one contract and preserve
process, delivery, result-domain, and consumer invariants.

**Tasks**:

- [ ] **3.1** Complete TC-HOOK-011 and TC-HOOK-023 reliability matrices against
  each real wrapper: normal completion and direct TERM/INT/HUP while a hook with
  an in-group child is active, 20 trials for each wrapper/path, zero surviving
  group members, zero output artifacts, and no unsupported SIGKILL/host/escaped-
  group assertion.
- [ ] **3.2** Table-drive the same V1 fixtures through both wrappers for
  TC-HOOK-024/026/027 under `LC_ALL=C`: literal metacharacters and empty-vs-unset;
  exact 65,536/65,537 whole-file bytes including header/LFs; 256/257 operations
  excluding header; 8,192/8,193 logical-line bytes excluding LF; final-LF
  presence/absence; CR in header, records, and CRLF; byte-generated embedded NUL;
  unsafe file types; duplicate/conflicting/unauthorized/readonly names; injected
  apply failure and rollback; fresh retry output; value-safe logs; zero
  source/eval. Prove credentials fail built-in authorization but an exact valid
  credential identifier succeeds only when explicitly operator-allowlisted, with
  no ADOS supply/discovery/query and no logged value. Compare outcomes to prevent
  helper drift.
- [ ] **3.3** Add/update `scripts/.tests/test-hook-regression.sh` for
  TC-HOOK-013 and TC-HOOK-022: forbid hook-specific result values without
  asserting a normalized pre-existing enum, and prove `.opencode/agent/ceo.md`
  retains its existing failed retry-or-park branch. Do not modify the prompt.
- [ ] **3.4** Add TC-HOOK-021 to `scripts/.tests/test-batch-deliver.sh`: a mocked
  deliver-ticket exit 1 is classified by existing exit-code behavior as failed,
  and the next ticket is attempted. Do not modify `scripts/batch-deliver.sh`.
- [ ] **3.5** Run TC-HOOK-REG-1 for INV-DM-1…6 and verify JOIN/OWN,
  foreground/process-group, liveness, restart, merge-authority, and working-tree
  behavior remains intact.

**Acceptance Criteria**:

- Must: NFR-2, NFR-9, NFR-10, NFR-11 and TC-HOOK-011/013/021…027/REG-1 pass for
  every applicable wrapper/consumer; TC-HOOK-026 proves identical exact-boundary,
  byte-rejection, credential-authority, atomicity, and cleanup behavior in both
  parsers; no values or new result domains leak.
- Should: both private helper implementations produce equivalent results and
  diagnostics for the common fixture corpus.

**Files and modules**:

- Code areas: `scripts/.tests/test-ceo-loop.sh`,
  `scripts/.tests/test-deliver-ticket.sh`,
  `scripts/.tests/test-hook-regression.sh`,
  `scripts/.tests/test-batch-deliver.sh`; production wrappers only if tests reveal
  a contract defect.
- System docs: none; `.opencode/agent/ceo.md` is read-only regression input.

**Tests**:

- `bash scripts/.tests/test-ceo-loop.sh`
- `bash scripts/.tests/test-deliver-ticket.sh`
- `bash scripts/.tests/test-hook-regression.sh`
- `bash scripts/.tests/test-batch-deliver.sh`

**Completion signal**: `test(GH-146): verify hook lifecycle and consumer invariants`

---

### Phase 4: Z.AI example and symmetric distribution

**Goal**: Ship the deterministic, installed-but-inactive Z.AI example and keep
install/uninstall inventories symmetric.

**Tasks**:

- [ ] **4.1** Create executable
  `scripts/hooks/pre-opencode-iteration-zai.sh` with a testable main guard, pure
  configured-value/window/seconds-to-end functions, and mockable
  `_now_utc_epoch`/`_sleep`. Read the CEO or PM configured environment value by
  hook context; only a value prefixed `zai-coding-plan/*` waits during
  04:30≤UTC<10:00, logs reason and exact wake time, sleeps until 10:00, and exits
  0. Other values/times return silently. This example makes no assertion about
  what provider/model OpenCode selects.
- [ ] **4.2** Add discoverable
  `scripts/.tests/test-hook-zai-example.sh` for TC-HOOK-015…018, including exact
  boundary and duration cases, with no real long sleep.
- [ ] **4.3** Add `ADOS_HOOK_EXAMPLES` and a content-synced executable hook-
  examples block to `scripts/install.sh`; assert a bare local install places the
  example at `./scripts/hooks/` but not at the resolved active hook path
  (TC-HOOK-019).
- [ ] **4.4** Extend `scripts/uninstall.sh`'s independent explicit removal and
  empty-directory lists; update `scripts/.tests/test-uninstall.sh` so local
  uninstall removes the example and then-empty `scripts/hooks/` directory
  (TC-HOOK-019B). Do not refactor uninstall to source install arrays.

**Acceptance Criteria**:

- Must: AC-F5-1, AC-F5-2, AC-F6-1, AC-F6-2, NFR-5, and NFR-8 pass; the example
  is reachable, executable, inactive, and uninstall-clean.
- Should: the discoverable suite may call an embedded self-test but is the CI
  entry point.

**Files and modules**:

- Code areas: `scripts/hooks/pre-opencode-iteration-zai.sh`, `scripts/install.sh`,
  `scripts/uninstall.sh`, `scripts/.tests/test-hook-zai-example.sh`,
  `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh`.
- System docs: none.

**Tests**:

- `bash scripts/.tests/test-hook-zai-example.sh`
- `bash scripts/.tests/test-install.sh`
- `bash scripts/.tests/test-uninstall.sh`

**Completion signal**: `feat(GH-146): distribute inactive ZAI hook example`

---

### Phase 5: Documentation, optional configuration guidance, and spec synchronization

**Goal**: Document the delivered user contract, hook-aware model-profile
examples, settings/context distinction, user-defined downstream semantics, and
F-9 security/boundary behavior, then reconcile current-truth system
documentation.

**Tasks**:

- [ ] **5.1** Update `doc/guides/delivery-modes.md` while preserving its
  `ados_distribution: redistributable` marker: opt-in path/override; per-spawn and
  excluded paths; no timeout; supported cleanup/exclusions; separate CEO failure
  retry with total interval and fixed ≤1-second stop response; installed example;
  existing failed/exit-1 behavior; and no hook-specific result value. Add a clear
  settings table: both wrappers accept `ADOS_PRE_ITERATION_HOOK`,
  `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS`, and `ADOS_HOOK_ENV_ALLOWLIST`; only CEO
  accepts `ADOS_HOOK_RETRY_SECONDS` and `ADOS_HOOK_MAX_FAILURES`. Separately label
  `ADOS_HOOK_AGENT`, `ADOS_HOOK_SCRIPT`, `ADOS_HOOK_ENV_OUTPUT`, and
  `ADOS_HOOK_ENV_FORMAT` as wrapper-provided per-invocation context, not operator
  settings, consistent with both `--help` outputs.
- [ ] **5.2** Add the explicit AC-F8-1/DM-6 optional configuration guidance to
  `doc/guides/delivery-modes.md`: explain `OC_ADOS_MODEL_PROFILE`, the existing
  tier defaults, per-agent `OC_ADOS_AGENT_*_MODEL` overrides, and `{env:...}`
  bindings only as optional owner-setup examples, never GH-146 prerequisites or
  guarantees. Explain that the example hook reads configured environment values
  and that a hook may update authorized parent environment state for the
  imminent/same-wrapper process scope, while variable meaning, provider/model
  selection, actual selected models, and downstream behavior are user-defined and
  not verified by ADOS. Link to `doc/guides/opencode-model-configuration.md` as
  canonical configuration detail, and add a reciprocal link from that guide back
  to delivery modes' pre-iteration hook behavior. Preserve both guides'
  distribution front matter.
- [ ] **5.3** Document `ADOS_HOOK_ENV_V1`: fresh private output capability;
  zero-byte/header-only compatibility; exact set/unset grammar and literal
  semantics; `LC_ALL=C` inclusive 65,536-byte file (header/LFs included),
  256-operation (header excluded), and 8,192-byte logical-line (LF excluded)
  limits; exact acceptance and limit+1 rejection; CR/NUL/final-LF rules; built-in
  non-credential model namespace; startup-validated exact allowlist; atomic
  behavior; value-safe logs; same-wrapper inheritance; and CEO/PM parent boundary.
  State precisely that an operator may explicitly allowlist an exact credential
  identifier at their own risk, while GH-146 supplies, discovers, queries, and
  auto-adds no credential and never logs returned values. State that the built-in
  model-variable namespace is an authorization choice, not a binding contract;
  require no wrapper `-m` or `CEO_LOOP_MODEL` change.
- [ ] **5.4** Reconcile
  `doc/spec/features/feature-autonomous-delivery.md` with implementation and
  Accepted TDR-0002, including the supported signal scope, distinct existing
  result domains, exact F-9 security/lifecycle/credential contract, and the
  previously flagged install-note drift. Have `@doc-syncer` assess the
  `autonomous-batch-delivery.md` 15-vs-10 drift and `AGENTS.md` repo-map mention
  per spec §7.3/OQ-2 rather than guessing.
- [ ] **5.5** Execute TC-HOOK-020 manually across
  `doc/spec/features/feature-autonomous-delivery.md`,
  `doc/guides/delivery-modes.md`, and
  `doc/guides/opencode-model-configuration.md` after the planned documentation and
  system-spec updates and before DoD review/PR creation. Verify profile selector,
  tier defaults, per-agent overrides, and `{env:...}` are optional examples;
  verify user-defined downstream semantics, bidirectional cross-links, complete
  hook/settings contract, exact parser/credential boundary, and no-new-result
  behavior. Compare both wrapper `--help` outputs to the guide and assert operator
  settings/defaults and per-invocation context are complete and correctly
  separated.
- [ ] **5.6** Run and record the documentation quality gates required by
  `.ai/rules/testing-strategy.md`: `git diff --check`; manual Markdown rendering
  review of changed headings, lists, tables, and code fences; changed-link/path
  validation for every modified reference; and
  `bash scripts/.tests/test-doc-distribution.sh`. Record commands/results and the
  manual rendering/link evidence in the change execution record.

**Acceptance Criteria**:

- Must: AC-F8-1/DM-6 and TC-HOOK-020 pass after documentation/system-spec updates
  and before DoD/PR creation; the three docs, both wrapper help outputs, and spec
  DoD agree that profile/tier/override/`{env:...}` material is optional and that
  downstream semantics are user-defined. `git diff --check`, Markdown rendering
  review, changed-link/path validation, and the documentation-distribution gate
  all pass with recorded evidence.
- Should: all pre-existing drift explicitly assigned by spec §7.3 is resolved or
  documented by `@doc-syncer`.

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/delivery-modes.md`,
  `doc/guides/opencode-model-configuration.md`,
  `doc/spec/features/feature-autonomous-delivery.md`; conditional reconciliation
  only as directed for `doc/spec/features/autonomous-batch-delivery.md` and
  `AGENTS.md`.

**Tests**:

- Manual TC-HOOK-020 review, including both wrapper `--help` outputs.
- `git diff --check`
- Manual Markdown rendering review for all changed Markdown.
- Changed-link/path validation for all modified references.
- `bash scripts/.tests/test-doc-distribution.sh`

**Completion signal**: `docs(GH-146): document safe pre-iteration hook contract`

---

### Phase 6: Code review (analysis)

**Goal**: Adversarially review the implementation against the accepted decision,
specification, plan, and 31-scenario test plan.

**Tasks**:

- [ ] **6.1** Run `/review-deep GH-146`; inspect both wrapper call graphs and
  verify CEO direct invocation/global PID publication, PM parent-shell placement,
  per-retry execution, parent-visible trap state, ≤1-second stop polling, and no
  hook work under command substitution.
- [ ] **6.2** Audit V1 file safety, exact grammar/bounds/authorization, literal
  parsing, `LC_ALL=C` exact/limit+1 byte boundaries, pre-string CR/NUL/final-LF
  handling, explicit-only credential delegation, complete staging, rollback,
  cleanup, same-wrapper inheritance, and value-safe logs; compare duplicated
  helpers for contract drift.
- [ ] **6.3** Audit all AC↔TC mappings, real-wrapper lifecycle evidence, result
  and consumer regressions, inactive install/symmetric uninstall, docs, and
  explicit exclusions. Verify both wrapper help outputs list the correct shared
  and CEO-only operator settings/defaults and separately classify all four
  per-invocation context variables. Confirm TC-HOOK-001 maps both wrapper files
  and TC-HOOK-020/026 map to their delivery phases. Confirm environment-return
  evidence stops at safe atomic state and imminent/same-wrapper inheritance, with
  no binding, selected-model, wrapper `-m`, or `CEO_LOOP_MODEL` requirement.
  Confirm Phase 5 records `git diff --check`, Markdown rendering, changed-link/path,
  and documentation-distribution evidence. Route every finding to Phase 7.

**Acceptance Criteria**:

- Must: reviewer verdict PASS or a complete actionable FAIL list assigned to
  Phase 7.
- Should: zero Critical or Major findings and explicit closure of readiness
  iteration 1 findings 2/6 and readiness iteration 2 finding 8.

**Files and modules**:

- Code areas: none (analysis only).
- System docs: none.

**Tests**:

- Review report against GH-146 artifacts and the implementation diff.

**Completion signal**: review PASS; no commit.

---

### Phase 7: Post-code-review fixes (conditional)

**Goal**: Apply only accepted review remediations and return the review to PASS.

**Tasks**:

- [ ] **7.1** Fix accepted findings in the smallest affected production, test,
  or documentation scope; add regression evidence for every defect.
- [ ] **7.2** Re-run affected suites and `/review-deep GH-146` until PASS.

**Acceptance Criteria**:

- Must: every accepted finding is closed and re-review passes.
- Should: no scope expansion or unrelated refactoring.

**Files and modules**:

- Code areas: only files named by accepted findings, or none if phase is skipped.
- System docs: only files named by accepted findings, or none.

**Tests**:

- Affected focused suites plus `bash scripts/test-all.sh`.

**Completion signal**: `fix(GH-146): address hook review findings` if needed.

---

### Phase 8: Finalize and release

**Goal**: Complete versioning, full quality gates, final spec reconciliation, DoD
evidence, and PR preparation.

**Tasks**:

- [ ] **8.1** Apply the minor version impact per repository conventions. Inspect
  touched scripts' `APP_VERSION` values and bump only where the established
  convention requires it; do not create a centralized version or new scheme.
- [ ] **8.2** Run TC-HOOK-REG-2 and all gates: focused wrapper, example, install,
  uninstall, batch, and regression suites; `bash scripts/test-all.sh`;
  shellcheck/format checks used by the repo; and a clean sandbox
  install→inactive check→uninstall round trip.
- [ ] **8.3** Perform final spec reconciliation with `@doc-syncer`: compare
  delivered behavior and test evidence to every AC, DM, NFR, risk mitigation,
  explicit DoD item, Accepted TDR-0002, spec v1.6, and test-plan v1.6. Confirm the
  settings/help/context, AC-F8-1 optional model-configuration examples and
  user-defined semantics, AC-F9-2/3 exact parser and credential semantics, and
  AC-F4-2/NFR-4/TC-HOOK-012 contracts are consistent; confirm no provider/model
  selection, `{env:...}` binding, selected-model, wrapper `-m`, or
  `CEO_LOOP_MODEL` guarantee entered the implementation; and confirm the rejected
  shared-library alternative introduced no artifact.
- [ ] **8.4** Confirm all 31 current TC IDs pass, all plan tasks are complete,
  TC-HOOK-001 names both wrapper files, TC-HOOK-020/026 evidence is recorded,
  help/manual checks pass, supported lifecycle trials are recorded, no return
  values leaked, no hook-specific result/consumer changes exist, and no
  temp/install artifacts remain.
- [ ] **8.5** Re-run and record the final documentation/static quality checklist:
  `git diff --check`; manual Markdown rendering review of changed headings, lists,
  tables, and code fences; changed-link/path validation for every modified
  reference; `bash scripts/.tests/test-doc-distribution.sh`; and YAML syntax
  validation for every changed `.yaml`/`.yml` file, explicitly including
  `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-pm-notes.yaml`
  and any other YAML touched. Enumerate the changed YAML set and run the existing
  repository convention once per file:
  `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" "$file"`.
  Record the complete file list and a passing parse result for each. Treat all
  five checks as explicit DoD checklist items, not implied format checks.
- [ ] **8.6** Record TC-HOOK-020 after the planned documentation/system-spec
  updates and before DoD approval and PR creation; verify its optional-example,
  user-defined-semantics, cross-link, help, protocol, and credential-boundary
  checklist is complete.
- [ ] **8.7** Use `@pr-manager` for the GH-146 PR only after all gates and DoD
  checklist items pass.

**Acceptance Criteria**:

- Must: version handling follows convention; all ACs, 31 TCs, spec DoD checks,
  quality gates, and final spec reconciliation pass before PR creation. Recorded
  DoD evidence explicitly includes `git diff --check`, Markdown rendering review,
  changed-link/path validation, the documentation-distribution gate, and passing
  `yaml.safe_load()` syntax validation for every changed `.yaml`/`.yml` file,
  including `chg-GH-146-pm-notes.yaml`, with the validated file list recorded.
- Should: PR description calls out the CEO parent-shell refactor, ≤1-second stop
  polling, F-9 security boundary, and explicit unsupported cleanup modes.

**Files and modules**:

- Code areas: touched script version fields only if convention requires them.
- System docs: reconciled `doc/spec/**` and linked guide files only as required by
  final `@doc-syncer` comparison.

**Tests**:

- `bash scripts/.tests/test-ceo-loop.sh`
- `bash scripts/.tests/test-deliver-ticket.sh`
- `bash scripts/.tests/test-hook-zai-example.sh`
- `bash scripts/.tests/test-install.sh`
- `bash scripts/.tests/test-uninstall.sh`
- `bash scripts/.tests/test-batch-deliver.sh`
- `bash scripts/.tests/test-hook-regression.sh`
- `bash scripts/test-all.sh`
- `git diff --check`
- Manual Markdown rendering review for all changed Markdown.
- Changed-link/path validation for all modified references.
- `bash scripts/.tests/test-doc-distribution.sh`
- For every changed `.yaml`/`.yml`, including
  `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-pm-notes.yaml`:
  `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" "$file"`

**Completion signal**: PR created for `feat(GH-146): quota-aware pre-iteration hooks`; STOP.

## Test Scenarios

Source of truth: `chg-GH-146-test-plan.md` v1.6. The table maps every current
scenario to its implementation phase and executable target.

| TC ID | Scenario | Phase(s) | Implementation / test target |
|-------|----------|----------|------------------------------|
| TC-HOOK-001 | Missing hook takes only the required path-check branch, with no hook subprocess/artifact, intentional wait/sleep, or hook log | 1, 2 | `scripts/.tests/test-ceo-loop.sh` and `scripts/.tests/test-deliver-ticket.sh`; deterministic path/process/temp/sleep/log instrumentation |
| TC-HOOK-002 | Hook before fresh spawn in both wrappers | 1, 2 | Both wrapper suites; parent-shell call sites |
| TC-HOOK-003 | Hook before every watchdog retry | 1, 2 | Both retry loops and counters |
| TC-HOOK-004 | No hook on JOIN | 1, 2 | Both wrapper OWN/JOIN fixtures |
| TC-HOOK-005 | No hook on probe/control/dry-run paths | 1, 2 | Both wrapper command-dispatch fixtures |
| TC-HOOK-006 | Correct context and model-profile inheritance | 1, 2 | Both wrapper environment recorders |
| TC-HOOK-007 | Reject not-executable hook | 1, 2 | Both failure-policy paths |
| TC-HOOK-007B | Reject exec-failing hook | 1, 2 | Both failure-policy paths; bad shebang fixture |
| TC-HOOK-008 | Reject non-zero hook | 1, 2 | Both failure-policy paths |
| TC-HOOK-009 | Exit 0 permits spawn | 1, 2 | Both wrapper OpenCode stubs |
| TC-HOOK-010 | No hook execution timeout | 1, 2 | Both real-wrapper bounded-sleep cases |
| TC-HOOK-011 | Cleanup on normal/HUP/INT/TERM | 1, 2, 3 | Both real wrappers; 20 trials/path |
| TC-HOOK-012 | CEO total retry interval, ≤1s stop polling, pure budget, no next spawn | 2 | AC-F4-2/NFR-4; deterministic chunk recorder and bounded real-wrapper harness |
| TC-HOOK-013 | No hook-specific result values | 3 | `test-hook-regression.sh`; distinct domains preserved |
| TC-HOOK-014 | Retry/cap/grace env overrides | 2 | CEO settings behavior and `--help` defaults in `test-ceo-loop.sh` |
| TC-HOOK-015 | Z.AI example waits in 04:30–10:00 UTC for configured `zai-coding-plan/*` environment values | 4 | `test-hook-zai-example.sh`; no actual-selection assertion |
| TC-HOOK-016 | Exact UTC boundaries | 4 | Pure example functions |
| TC-HOOK-017 | Exact seconds until 10:00 UTC | 4 | Pure example functions |
| TC-HOOK-018 | Non-Z.AI configured environment value returns immediately | 4 | Example configured-value fixtures; no OpenCode-binding assertion |
| TC-HOOK-019 | Example installed executable and inactive | 4 | `test-install.sh` |
| TC-HOOK-019B | Example and empty directory uninstalled | 4 | `test-uninstall.sh` |
| TC-HOOK-020 | Optional profile/tier/per-agent/`{env:...}` examples, user-defined downstream semantics, bidirectional links, and contract/help consistency | 5 | Manual review after documentation/system-spec updates and before DoD/PR creation; feature spec, both guides, and both wrapper `--help` outputs |
| TC-HOOK-021 | Batch treats exit 1 as failed and continues | 3 | `test-batch-deliver.sh` |
| TC-HOOK-022 | CEO retains failed retry-or-park branch | 3 | `test-hook-regression.sh`; prompt read-only |
| TC-HOOK-023 | Private artifacts and complete cleanup | 1, 2, 3 | Both real wrappers; modes/signals/20 trials |
| TC-HOOK-024 | Valid V1 batches apply literally and atomically to parent environment state | 1, 2, 3 | Both parsers and OpenCode environment recorders; no downstream-semantics assertion |
| TC-HOOK-025 | Pre-spawn wrapper-local environment inheritance | 1, 2, 3 | CEO direct-call and PM pre-substitution integration; no binding/model-selection/`-m` assertion |
| TC-HOOK-026 | Both parsers enforce C-locale exact bounds, CR/NUL/final-LF, authority, and atomic rejection | 1, 2, 3 | `LC_ALL=C` generated-byte matrix in both wrapper suites, including explicit credential delegation |
| TC-HOOK-027 | Fresh retry output and value-safe diagnostics | 1, 2, 3 | Both retry loops, log scans, no-source/eval scan |
| TC-HOOK-REG-1 | Preserve INV-DM-1…6 | 3 | Existing CEO/deliver suites |
| TC-HOOK-REG-2 | All existing and new suites pass | 8 | `bash scripts/test-all.sh` plus named suites |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-146-spec.md` | Source specification v1.6 |
| Test plan | `./chg-GH-146-test-plan.md` | Source test plan v1.6 (31 TCs) |
| TDR-0002 | `../../../decisions/TDR-0002-pre-iteration-hook-contract-details.md` | Accepted R2 decision |
| Readiness iteration 1 | `./readiness-review/readiness-iter-1.md` | Findings remediated by corrected source artifacts and this plan |
| Readiness iteration 2 | `./readiness-review/readiness-iter-2.md` | Finding 8 and latest artifact corrections consumed by this plan |
| Readiness iteration 3 | `./readiness-review/readiness-iter-3.md` | Findings 1–4 consumed through v1.6 scope narrowing, deterministic absent-path evidence, explicit documentation gates, and corrected TC-HOOK-020 sequencing |
| CEO wrapper | `scripts/ceo-loop.sh` | Updated |
| Ticket wrapper | `scripts/deliver-ticket.sh` | Updated |
| Z.AI hook example | `scripts/hooks/pre-opencode-iteration-zai.sh` | New |
| Install/uninstall | `scripts/install.sh`, `scripts/uninstall.sh` | Updated |
| Wrapper tests | `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh` | Updated |
| Hook regression tests | `scripts/.tests/test-hook-regression.sh` | New/updated |
| Consumer regression tests | `scripts/.tests/test-batch-deliver.sh` | Updated |
| Example tests | `scripts/.tests/test-hook-zai-example.sh` | New |
| Distribution tests | `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh` | Updated |
| Feature specification | `../../../spec/features/feature-autonomous-delivery.md` | Updated/reconciled |
| Delivery modes guide | `../../../guides/delivery-modes.md` | Updated redistributable guide |
| OpenCode model configuration guide | `../../../guides/opencode-model-configuration.md` | Updated reciprocal cross-link and canonical model-profile context |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-15 | plan-writer | Initial phased plan from the specification, test plan, and TDR-0002. |
| 1.1 | 2026-07-15 | plan-writer | Synchronized install/uninstall symmetry with spec F-6/AC-F6-2/NFR-8 and TC-HOOK-019B; retained discoverable example-test coverage. |
| 1.2 | 2026-07-16 | plan-writer | Re-rendered from spec v1.3, test plan v1.3, and Accepted TDR-0002. Added the complete F-9 data-only environment-return implementation, all 31 TCs, both-wrapper lifecycle/security evidence, consumer regressions, explicit CEO direct-call/global-result refactor for readiness finding 2, and proposed ≤1-second chunked STOP_FILE polling for finding 6. Replaced an unsupported shared-helper assumption with contract-identical private wrapper helpers. |
| 1.3 | 2026-07-16 | plan-writer | Final sync to spec v1.4 and test-plan v1.4: traced the now-canonical total `ADOS_HOOK_RETRY_SECONDS`, ≤1-second polling/observation, no-next-spawn, separate-counter behavior through AC-F4-2/NFR-4/RSK-11/TC-HOOK-012 in Phase 2, docs, review, release, and the test matrix. Recorded the shared runtime helper as a rejected alternative; confirmed contract-identical private helpers add no distributable artifact and all source artifacts align. |
| 1.4 | 2026-07-16 | plan-writer | Synchronized Accepted TDR-0002, spec v1.5, test-plan v1.5, and readiness iteration 2 finding 8. Added explicit per-wrapper operator-setting and `--help` tasks/assertions; separated four wrapper-provided context variables; added AC-F8-1 profile/tier/per-agent guidance with reciprocal guide links; made both parser phases and TC-HOOK-026 exact under `LC_ALL=C` for inclusive/limit+1 bounds, CR/NUL/final-LF, credential authority, atomicity, logs, and cleanup; mapped TC-HOOK-001 to both files and TC-HOOK-020/026 to phases. Swept stale absolute credential exclusion, ambiguous bounds, and placement/status wording; all 31 TCs and DoD remain complete with aligned source artifacts. |
| 1.5 | 2026-07-16 | plan-writer | Synchronized Accepted TDR-0002 D-6, spec v1.6, test-plan v1.6, and readiness iteration 3 findings 1–4. Narrowed the guarantee to safe atomic parent-environment state and imminent/same-wrapper inheritance; made profile/tier/per-agent/`{env:...}` material optional user-defined examples; excluded provider/model selection, selected-model, wrapper `-m`, and `CEO_LOOP_MODEL` requirements; replaced timing claims with deterministic TC-HOOK-001 path evidence; added explicit Phase 5/8 `git diff --check`, Markdown rendering, changed-link/path, and documentation-distribution DoD checks; and sequenced TC-HOOK-020 after documentation/system-spec updates and before DoD/PR creation. Preserved all 31 TC mappings and the execution log. |
| 1.6 | 2026-07-16 | plan-writer | Closed the post-escalation Phase 8 quality-gate gap by requiring recorded `yaml.safe_load()` syntax validation for every changed `.yaml`/`.yml` file, explicitly including `chg-GH-146-pm-notes.yaml`; preserved all other plan content, 31 TC mappings, and the execution log. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Not started | | | | |
| 2 | Not started | | | | |
| 3 | Not started | | | | |
| 4 | Not started | | | | |
| 5 | Not started | | | | |
| 6 | Not started | | | | |
| 7 | Conditional | | | | |
| 8 | Not started | | | | |
