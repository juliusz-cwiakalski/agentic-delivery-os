---
change:
  ref: GH-146
  type: feat
  status: Proposed
  slug: quota-aware-pre-iteration-hooks
  title: "Add quota-aware pre-iteration hooks to autonomous delivery loops"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["autonomous-delivery", "quota", "hooks"]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal: ["scripts/ceo-loop.sh", "scripts/deliver-ticket.sh", "scripts/install.sh", "scripts/uninstall.sh", "doc/spec/features/feature-autonomous-delivery.md", "doc/guides/delivery-modes.md", "TDR-0002"]
    external: ["Z.AI Coding Plan (example hook only)"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Add an opt-in, user-owned pre-iteration hook to the two autonomous-delivery loop scripts so adopters can delay a session or safely update authorized parent environment state before each OpenCode spawn/resume, without embedding provider policy or arbitrary parent-shell execution inside the generic scripts, while preserving every existing delivery invariant and result-domain behavior.

## 1. SUMMARY

This change introduces a single, consistent pre-iteration hook contract across `scripts/ceo-loop.sh` and `scripts/deliver-ticket.sh`. When a user installs an executable at the resolved hook path, both scripts run it immediately before every actual OpenCode spawn or resume (including watchdog retries); a missing hook proceeds after the required path check with no intentional wait/sleep, hook subprocess/temp-file creation, or hook-related log output. The hook receives caller/agent context and may return a strictly validated, data-only set of authorized parent-environment updates. The imminent OpenCode process and later iterations of that same wrapper inherit committed updates; variable meaning and downstream behavior remain user-defined. A redistributable-but-inactive Z.AI example ships under `scripts/hooks`, registered in the install inventory, that sleeps through the 04:30–10:00 UTC peak-plus-lead-in window for `zai-coding-plan/*` model values. No hook-specific result value is introduced; hook failures, including invalid returned environment data, follow existing `failed`/exit-1 consumer behavior and a separate, bounded retry budget.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The autonomous-delivery neighborhood is delivered as deterministic bash scripts wrapping AI agents (see `doc/spec/features/feature-autonomous-delivery.md`).
- `scripts/ceo-loop.sh` (Mode A outer process) spawns one `@ceo` OpenCode session at a time, detects a stuck CEO, resumes prior sessions, and honors a durable stop signal.
- `scripts/deliver-ticket.sh` (per-ticket engine) is single-flight + join per repo working tree, spawns/resumes the PM OpenCode session, monitors multi-signal liveness, kill-and-restarts on stall, classifies the result, and returns a delivery summary. It does **not** merge.
- Both scripts already share a process-group cleanup pattern for normal exit and directly received, trappable shutdown signals; the hook lifecycle mirrors that bounded pattern. Wrapper-only SIGKILL, host/power failure, and descendants that leave the hook process group are outside that guarantee.
- Result domains are pre-existing and not normalized by this change: `classify_result` currently produces `merged | blocked | pr-open | failed | unknown`, while emitted delivery summaries can also contain control/outcome values such as `finished` and `max-restarts` depending on OWN/JOIN paths. `batch-deliver.sh` classifies a ticket purely on the `deliver-ticket.sh` **exit code** (non-zero → `failed`), not `result=`; `.opencode/agent/ceo.md` already has a `failed` (retry-or-park) branch.
- Six behavioral invariants (INV-DM-1..6) govern unattended delivery: foreground-never-detached, single-flight + join, stuck-vs-healthy CEO detection, merge authority, multi-signal liveness, and one-ticket-per-working-tree.
- Both scripts are registered in `scripts/install.sh` (`ADOS_DELIVERY_SCRIPTS`) and content-synced to `./scripts/` on `install.sh --local`. The documentation-distribution guard (`scripts/.tests/test-doc-distribution.sh`) scans only `doc/`; `scripts/` is out of its scope.

### 2.2 Pain Points / Gaps

- **No cost gate before a session starts.** Either loop can spawn an expensive OpenCode session at any wall-clock time. Providers such as Z.AI apply time-dependent quota multipliers (e.g. higher rates during 14:00–18:00 UTC+8 for GLM models); long-running autonomous delivery therefore spends more than necessary with no user-local way to steer scheduling.
- **Provider policy cannot live in the generic scripts.** Embedding Z.AI-specific windows, model names, or credentials into `ceo-loop.sh`/`deliver-ticket.sh` would couple generic tooling to one vendor and leak provider policy into a redistributable product.
- **No opt-in extension point.** There is no seam today for a user to run arbitrary local policy (quota, cost, workstation, maintenance windows) immediately before a session is created or resumed.
- **No safe pre-spawn environment-return channel.** A hook cannot currently return authorized parent-environment updates for the next OpenCode command without relying on unsafe shell-side coupling or changing persistent configuration.
- **Pre-existing doc drift** (out of scope for this change — see §7.3): `feature-autonomous-delivery.md` still states `ceo-loop.sh`/`pm-liveness.sh` are not installed although `install.sh` registers them; `autonomous-batch-delivery.md` documents a 15-minute stuck default while the scripts/spec/canonical guide use 10.

## 3. PROBLEM STATEMENT

Because the autonomous-delivery loop scripts start costly OpenCode sessions at any time with no user-local policy gate, an adopter subject to a provider's peak quota multipliers cannot avoid expensive windows without embedding provider-specific policy into generic, redistributable scripts, resulting in avoidable quota spend and a coupling that breaks the vendor-neutral contract.

## 4. GOALS

- **G-1**: Expose one generic, user-owned pre-iteration hook contract across both loop scripts that runs before every actual spawn/resume (including watchdog retries) and is a silent no-op when absent.
- **G-2**: Keep all provider and workstation policy outside the generic scripts; supply only an inactive, redistributable Z.AI example.
- **G-3**: Preserve every existing delivery invariant (INV-DM-1..6), result-domain behavior, and the no-merge behavior — add **no hook-specific** result values and require **no** consumer (CEO prompt, `batch-deliver.sh`) changes.
- **G-4**: Ensure a hook process group is cleaned up on normal wrapper exit and direct SIGTERM/SIGINT/SIGHUP, while retaining no execution timeout and explicitly excluding wrapper-only SIGKILL, host/power failure, and descendants that leave the hook process group.
- **G-5**: Ensure hook failures never corrupt the stuck-restart budget or any downstream consumer.
- **G-6**: Make the contract fully testable without real multi-hour sleeps, using pure UTC functions and mockable seams.
- **G-7**: Permit a successful hook to make authorized, atomic, data-only parent-environment updates that the imminent OpenCode process and future same-wrapper iterations inherit, without shell interpretation or any ADOS-supplied/discovered/queried credential; variable meaning and downstream behavior are user-defined.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Hook-absent path | After the required path check, no intentional wait/sleep, hook subprocess/temp-file creation, or hook-related log output; execution proceeds to the existing spawn/resume path |
| In-group hook processes after supported wrapper shutdown | 0 surviving after normal exit or a direct SIGTERM/SIGINT/SIGHUP, across 20 trials for each wrapper/signal case |
| Stuck-restart budget consumed by N hook failures (N > MAX_RESTARTS) | 0 slots |
| Hook-specific result values introduced | 0 (no `vetoed`/`hook-error`; existing result-domain inconsistencies remain unchanged) |
| UTC window-boundary pure-function correctness | 100% at 04:29:59 / 04:30:00 / 09:59:59 / 10:00:00 UTC |
| ceo-loop bounded retry exit | Non-zero exit after `ADOS_HOOK_MAX_FAILURES` consecutive failures with `restarts == 0` |
| Example reachability + inactivity | Installed + executable at `./scripts/hooks/…`, **not** at the active hook path after a bare `install.sh --local` |
| Uninstall symmetry | `uninstall.sh --local` removes the installed example and the now-empty `scripts/hooks/` directory (install ⇄ uninstall symmetric) |
| Valid environment-return batches | 100% of valid `ADOS_HOOK_ENV_V1` batches apply atomically to parent environment state before command construction; 0 changes from invalid batches; no assertion about variable meaning or selected model |
| Hook-return temp cleanup | 0 parent-created output files/directories remaining after success, failure, normal exit, or supported direct-signal cleanup across 20 trials per wrapper |

### 4.2 Non-Goals

- **NG-1**: Interrupting an OpenCode session that is already running when a blocked window begins.
- **NG-2**: Managing provider subscription credentials or querying quota APIs.
- **NG-3**: Enabling provider-specific throttling or auto-activating the example by default.
- **NG-4**: Changing retry, liveness, single-flight, or merge semantics — except the separate, bounded hook-failure retry policy for `ceo-loop.sh` (the sole exception, G-5).
- **NG-5**: Changing the AI-vs-script split (scheduling-wait stays script-side; judgement stays AI-side).
- **NG-6**: Copying workstation-specific model-profile files into ADOS.
- **NG-7**: Supplying, discovering, querying, or automatically managing provider credentials; arbitrary configuration content and arbitrary parent-shell commands remain excluded from the hook return channel. An operator may explicitly allowlist an exact credential identifier at their own risk.
- **NG-8**: Allowing a `deliver-ticket.sh` child to mutate its already-running `ceo-loop.sh` parent; guaranteeing provider/model switching, actual selected models, `{env:...}` bindings, or wrapper `-m` semantics from any returned variable.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Generic per-spawn pre-iteration hook | One consistent seam across both scripts; provider-neutral; off by default |
| F-2 | Missing / misconfigured / failing-hook behavior | Existence is the opt-in boundary; loud-fail is recoverable, silent-skip is costly |
| F-3 | Hook process/signal lifecycle (no timeout, bounded trappable-signal cleanup) | A scheduling hook may sleep for hours; cleanup must be reliable for supported wrapper termination without claiming coverage for uncontrollable modes |
| F-4 | Component-specific hook-failure handling, budget purity, and stop responsiveness | A scheduling hook must not exhaust the stuck-restart budget or leave the always-on supervisor unresponsive to a durable stop request |
| F-5 | Z.AI quota-aware example hook | Concrete, redistributable-but-inactive reference that demonstrates the contract |
| F-6 | Install/uninstall inventory symmetry + inactivity guarantee | Adopters receive the example via `install.sh --local` without it auto-activating, and `uninstall.sh --local` removes its installed file and empty directory |
| F-7 | Testability seams (pure UTC functions + mockable wrappers) | Deterministic, fast tests that do not weaken production behavior |
| F-8 | Documentation and user guidance | Adopters must discover, install, and understand the contract and its failure semantics |
| F-9 | Safe hook-returned environment updates | A hook can atomically update authorized parent environment state without arbitrary parent-shell execution or partial state changes; variable meaning remains user-defined |

### 5.1 Capability Details

**F-1 — Generic per-spawn pre-iteration hook.** Both scripts resolve the hook path from `${ADOS_PRE_ITERATION_HOOK:-$HOME/.ados/hooks/pre-opencode-iteration}`. When the resolved file exists and is executable, it is invoked as a subprocess immediately before each actual `opencode run` spawn **or** resume, including every watchdog retry that creates/respawns a session. The hook is never invoked on JOIN paths, status/log/stop/reset/last-message probes, `--is-delivering`, or dry-runs. The hook inherits the current environment and additionally receives context variables `ADOS_HOOK_AGENT=ceo|pm` and `ADOS_HOOK_SCRIPT=ceo-loop|deliver-ticket`; it also inherits any model-profile variables in scope. The invocation point is strictly on the OWN/spawn path, after the caller owns the right to spawn (preserves single-flight/JOIN invariants).

**F-2 — Missing / misconfigured / failing-hook behavior.** Existence at the hook path is the opt-in signal. **Missing** (`! -e`): after the required path check, proceed without intentional wait/sleep, hook subprocess/temp-file creation, or hook-related log output. **Present but not executable** (`-e && ! -x`), or present + executable but failing to exec (noexec mount, bad shebang, permission denied), or **runs and exits non-zero**: a single "hook failure" category that prevents that iteration from spawning and emits a clear, actionable diagnostic naming the path and reason. Scheduling policy that wants to *defer* a spawn expresses that by sleeping and later exiting `0` — never by a distinct non-zero classification. No hook-specific result value is introduced.

**F-3 — Hook process/signal lifecycle.** The hook runs in its own process group (mirroring how the scripts already run the OpenCode child), with its PID tracked. No execution timeout is ever imposed on the hook — a scheduling hook may legitimately sleep for hours; cleanup is performed only on normal wrapper exit or when the wrapper directly receives SIGTERM, SIGINT, or SIGHUP, never because the hook ran "too long." For those supported shutdown paths, the hook process group receives SIGTERM and, after a short configurable shutdown grace, may be escalated to SIGKILL. The guarantee applies only to processes that remain in the hook process group. Wrapper-only SIGKILL, host/power failure, and descendants that leave that group are explicitly excluded. This is the bounded hook-specific interpretation of INV-DM-2.

**F-4 — Component-specific hook-failure handling with budget purity.** Hook failures (non-zero / not-executable / exec-fail) never consume `restarts`/`iteration`/`MAX_RESTARTS` — those budgets are for stuck-CEO/PM kills only. The two components differ by role:
- *`deliver-ticket.sh` (per-ticket, foreground):* the hook runs on the OWN path inside each retry iteration, immediately before that iteration's `run_single_iteration`. On hook failure the script surfaces the existing `failed` result and exit-1, reports the hook diagnostic in the summary/last-message and to stderr, and returns 1. The PM never spawns, so no restart budget is consumed. `batch-deliver.sh` sees exit 1 → marks the ticket `failed` and continues (no change); the CEO sees `result=failed` → its existing retry-or-park branch handles it (no prompt change).
- *`ceo-loop.sh` (always-on supervisor):* on hook failure the script prevents that CEO spawn, logs clearly, and follows a bounded, non-busy retry that does **not** touch the stuck-session `restarts` budget. `ADOS_HOOK_RETRY_SECONDS` remains the total interval between attempts; while waiting for that interval, the loop polls `STOP_FILE` in bounded chunks no longer than 1 second. A `--stop` request is therefore observed and terminates the retry wait within 1 second, without adding a new setting. The loop counts consecutive failures against a separate cap and — on reaching the cap — exits non-zero with a distinct log line. The consecutive-failure counter resets to 0 on any hook success or once a CEO session has run.

**F-5 — Z.AI quota-aware example hook.** A redistributable-but-inactive example blocks new sessions during **04:30–10:00 UTC** (the 14:00–18:00 UTC+8 peak plus a 90-minute lead-in). It reads the relevant model value from `OC_ADOS_AGENT_CEO_MODEL` or `OC_ADOS_AGENT_PM_MODEL` based on `ADOS_HOOK_AGENT`; scheduling applies only when that value starts with `zai-coding-plan/`, otherwise it returns immediately without sleeping. When invoked inside the window it logs the reason and the exact UTC wake time, sleeps until 10:00 UTC, then exits `0`. All time arithmetic is UTC (timezone/DST-invariant). This is the mechanism by which a "scheduling deferral" is expressed (sleep → exit 0), per F-2.

**F-6 — Install/uninstall inventory symmetry + inactivity guarantee.** The example ships at `scripts/hooks/pre-opencode-iteration-zai.sh`, registered in a new `ADOS_HOOK_EXAMPLES` array in `scripts/install.sh`, content-synced + executable to `./scripts/hooks/` on `install.sh --local`. It is **available** to adopters yet **inactive** until the user copies/selects it for the resolved hook path: the loop scripts resolve only `${ADOS_PRE_ITERATION_HOOK:-$HOME/.ados/hooks/pre-opencode-iteration}`, never `scripts/hooks/`. A bare `install.sh --local` does not activate it. It carries no `ados_distribution` marker (the doc-distribution guard scans only `doc/`; `scripts/` is out of scope). **Install/uninstall symmetry:** `scripts/uninstall.sh --local` must remove the installed example and clean up the now-empty `scripts/hooks/` directory, following the existing explicit-removal-list + empty-directory-cleanup convention used for `ADOS_DELIVERY_SCRIPTS`/`ADOS_DELIVERY_TOOLS`. A reinstall followed by a clean uninstall leaves neither the installed example nor its empty installation directory, mirroring the symmetry already required of every other ADOS-delivered script/tool.

**F-7 — Testability seams.** Three seams, none changing production behavior: (a) the hook path itself is the injection point in the loop scripts — tests install a temporary hook (exit 0 / non-zero / unexecutable) and assert call-counts and exit handling across spawn/resume/retry vs JOIN/probe/dry-run, and the operator settings are env-overridable; (b) the environment-return path is a parent-created temporary file, allowing fixtures to supply valid/invalid bounded protocol data and observe atomic parent inheritance without executing returned text; (c) in the Z.AI example, UTC arithmetic is factored into pure functions taking `now_utc_epoch` as an argument, with the impure `date -u`/`sleep` wrapped in mockable `_now_utc_epoch()`/`_sleep()` wrappers.

**F-8 — Documentation and user guidance.** The autonomous-delivery feature spec and the canonical delivery-modes guide describe the hook contract, opt-in installation (copy to `~/.ados/hooks/…` or set `ADOS_PRE_ITERATION_HOOK`), the installed Z.AI example, and hook-failure behavior. The delivery-modes guide must explicitly explain `OC_ADOS_MODEL_PROFILE`, tier defaults, and per-agent `OC_ADOS_AGENT_*_MODEL` overrides, and cross-link to `doc/guides/opencode-model-configuration.md` for canonical model-configuration details. It may present `{env:...}` per-agent configuration with those model variables as an optional example matching the owner setup, not as a GH-146 prerequisite or guarantee. It must explain that hooks safely update authorized parent environment state only; variable meaning, provider/model selection, and downstream behavior are user-defined and not verified by ADOS. The documentation explicitly states that failures follow existing `failed`/exit-1 consumer behavior and add no hook-specific result value.

**F-9 — Safe hook-returned environment updates.** Before every present-hook invocation, the parent creates a fresh private temporary directory (mode `0700`) containing an empty regular output file (mode `0600`) and passes its absolute path as `ADOS_HOOK_ENV_OUTPUT` and `ADOS_HOOK_ENV_FORMAT=ADOS_HOOK_ENV_V1`, alongside the existing hook context. The file is protocol data only: stdout/stderr remain diagnostics. An untouched zero-byte file and a header-only file are valid no-update results, preserving sleep-only hooks as a primary use. A non-empty file must be LF-terminated and begin with the exact first line `ADOS_HOOK_ENV_V1`; every later line must be exactly `set NAME=literal value` or `unset NAME`. Blank lines, comments, extra header text, unknown verbs, malformed records, and a missing final LF are invalid. Values are literal data after the first `=`: no `source`, `eval`, shell expansion, or interpretation is permitted.

The default authorized namespace is `^OC_ADOS_AGENT_[A-Z0-9_]+_MODEL$`; it excludes credentials, wrapper controls, `OPENCODE_CONFIG_CONTENT`, shell internals, the allowlist itself, and broad `OC_ADOS_*` authorization. This model-variable namespace is a default authorization choice, not a statement of variable semantics or an OpenCode binding requirement. Additional names require an operator-supplied, comma-separated `ADOS_HOOK_ENV_ALLOWLIST` of exact valid identifiers; empty items, duplicates, or invalid identifiers are a wrapper startup configuration error. This is explicit operator delegation: an operator may allowlist any additional exact valid identifier, including a credential variable, at their own risk; GH-146 supplies, discovers, and queries no credentials. The entire regular, wrapper-owned, non-symlink output file is validated before any parent mutation under `LC_ALL=C`: at most 65,536 raw bytes including the header and every LF; at most 256 operation records excluding the header; and at most 8,192 raw bytes per logical line excluding its terminating LF. Exact limits are accepted and limit+1 is rejected. Every non-empty file, including header-only, ends in LF; CR (`0x0D`) and NUL (`0x00`) are invalid anywhere in a non-empty protocol file before string parsing. Each name must be unique, authorized, and writable. Unsafe, missing, malformed, oversized, unauthorized, duplicate, conflicting, or failed-apply batches apply nothing from that invocation and take the existing hook-failure path. On hook exit `0` and a valid batch, all staged `set`/`unset` operations apply atomically in the parent immediately before constructing the OpenCode command; the imminent process and later iterations of that same wrapper inherit the resulting environment state. A `deliver-ticket.sh` child cannot mutate its already-running `ceo-loop.sh` parent. GH-146 does not define the meaning of an updated variable, guarantee provider/model switching or actual selected models, require `{env:...}` bindings, or add wrapper `-m` semantics. The parent logs only operation names/counts, never values, and removes the temporary directory after parse/apply or on every failure, normal exit, and supported direct-signal path; every retry receives a new file.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Per-spawn hook (both scripts, OWN/spawn path only):
  caller decides OWN/spawn (after JOIN/OWN decision)
    → resolve hook path (${ADOS_PRE_ITERATION_HOOK:-$HOME/.ados/hooks/pre-opencode-iteration})
    → if missing  → silent no-op → proceed to spawn/resume OpenCode
    → if exists   → parent creates fresh private ADOS_HOOK_ENV_V1 output file; run hook in own process group with context + inherited env
        → exit 0 + empty/valid output → atomically apply authorized updates in parent → construct/spawn OpenCode
        → scheduling wait → hook sleeps until window end → exits 0 → proceed to spawn
        → non-zero / not-exec / exec-fail → F-4 component handling (no spawn)

Flow 2 — deliver-ticket hook failure (F-4, per-ticket):
  hook fails on OWN path inside a retry iteration immediately before that iteration's run_single_iteration
    → set DELIVERY_RESULT="failed", DELIVERY_EXIT_CODE=1, surface diagnostic
    → PM never spawns; no restart budget consumed
    → batch-deliver sees exit 1 → ticket failed, continue (no change)
    → CEO sees result=failed → existing retry-or-park branch (no prompt change)

Flow 3 — ceo-loop hook failure (F-4, supervisor):
  hook fails before a CEO spawn
    → prevent spawn, log clearly
    → wait the total ADOS_HOOK_RETRY_SECONDS interval in non-busy chunks ≤1s; poll STOP_FILE between chunks
    → STOP_FILE observed within ≤1s → terminate retry wait without another spawn
    → count consecutive failures (separate from restarts)
    → reset counter on success or once a CEO session has run
    → at ADOS_HOOK_MAX_FAILURES → exit non-zero (operator fixes hook + restarts)

Flow 4 — wrapper termination with sleeping hook (F-3):
  wrapper exits normally or directly receives SIGTERM/INT/HUP while hook is sleeping
    → hook process group receives SIGTERM → grace (ADOS_HOOK_SHUTDOWN_GRACE_SECONDS, default 2s) → SIGKILL
    → hook-group members, including its `sleep` child, are reaped

  excluded: wrapper-only SIGKILL, host/power failure, and descendants that leave the hook process group

Flow 5 — Model-selection return scope (F-9):
  CEO hook writes valid authorized set/unset records → ceo-loop parent applies environment state → imminent CEO + later ceo-loop iterations inherit that state
  PM hook writes valid authorized set/unset records  → deliver-ticket parent applies environment state → imminent PM + its retries inherit that state
  variable meaning/downstream behavior is user-defined; PM child cannot mutate its already-running ceo-loop parent; invalid/unsafe output → no update + existing hook-failure handling
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `scripts/ceo-loop.sh`: hook resolution + invocation before every actual CEO spawn/resume incl. retries; bounded non-busy hook-failure retry with ≤1-second `STOP_FILE` observation latency (separate budget, no new setting); tracked hook lifecycle; safe parent-side environment-return parsing/apply; extended group-kill trap; new allowlist setting.
- `scripts/deliver-ticket.sh`: hook resolution + invocation inside every retry iteration immediately before that iteration's `run_single_iteration` (new or resumed, including watchdog retries); on failure use the existing `failed`/exit-1 path without spawning the PM or consuming its restart budget; safe parent-side environment-return parsing/apply; extended group-kill trap; new allowlist setting.
- `scripts/install.sh`: new `ADOS_HOOK_EXAMPLES` array + a "Hook examples" install block (content-synced + `chmod +x` to `./scripts/hooks/`).
- `scripts/uninstall.sh`: add the installed example to the explicit file-removal list and `scripts/hooks/` to the empty-directory cleanup list, so `uninstall.sh --local` removes the installed example and the now-empty directory (install ⇄ uninstall symmetry).
- Z.AI example at `scripts/hooks/pre-opencode-iteration-zai.sh`: pure UTC functions + mockable wrappers; `zai-coding-plan/` model detection.
- Tests under `scripts/.tests/` (and the example's own co-located tests where applicable): hook absence/success/failure/context/retry/excluded-paths/model-detection/UTC-boundaries/computed-sleep/no-timeout/bounded trappable-signal cleanup/bounded-retry/no-hook-specific-result-value; `ADOS_HOOK_ENV_V1` grammar, validation, atomic application, inheritance, scope, and lifecycle.
- Documentation: `doc/spec/features/feature-autonomous-delivery.md`, `doc/guides/delivery-modes.md`, and the model-configuration cross-link target `doc/guides/opencode-model-configuration.md`: hook contract, opt-in install, `OC_ADOS_MODEL_PROFILE`, tier defaults, per-agent `OC_ADOS_AGENT_*_MODEL` overrides, optional `{env:...}` owner-setup example, example link, explicit no-hook-specific-result-value statement, environment-return format/allowlist and user-defined-variable examples, credential delegation boundary, no provider/model-selection or binding guarantee, and ≤1-second stop responsiveness during CEO hook-failure waits.
- Decision record TDR-0002 (Accepted, R2, decision date 2026-07-16) underpins this spec.

### 7.2 Out of Scope

- [OUT] Interrupting an active OpenCode session when a blocked window begins (only *new* spawns/resumes are gated).
- [OUT] Provider quota APIs, credential management, or automatic provider detection beyond the documented model-prefix mechanism.
- [OUT] Auto-activation of the example on `install.sh --local`.
- [OUT] Changes to retry/liveness/single-flight/merge semantics other than the separate, bounded hook-failure retry policy (NG-4 exception).
- [OUT] Hook-specific result values (including `vetoed`/`hook-error`) or reconciliation of pre-existing classifier, summary, help, and guide differences.
- [OUT] Copying workstation-specific model-profile files into ADOS.
- [OUT] Hook cleanup after wrapper-only SIGKILL, host/power failure, or for descendants that leave the hook process group.
- [OUT] ADOS-supplied, discovered, queried, or automatically managed credentials; arbitrary provider configuration and arbitrary parent-shell execution through `ADOS_HOOK_ENV_OUTPUT`. Explicit operator allowlisting of an exact credential identifier remains permitted at operator risk.
- [OUT] A PM hook changing the already-running CEO parent or an all-agent/fleet-wide switch from a PM hook.
- [OUT] Any guarantee that returned values select a provider/model, are consumed through `{env:...}` configuration, change actual selected models, or cause wrapper `-m` behavior.

### 7.3 Deferred / Maybe-Later

- Pre-existing documentation drift cleanup (`feature-autonomous-delivery.md` install-note + `autonomous-batch-delivery.md` 15-vs-10 default) — to be reconciled during phase 7 (`system_spec_update`) since those current-truth docs are already in the modified feature area; **not** a new requirement of this change.
- Whether `AGENTS.md`'s repo map should mention `scripts/hooks/` — deferred to `@doc-syncer` during the docs update (TDR-0002 unresolved question).
- A second provider/example hook and any sub-structuring of the `scripts/hooks/` inventory (TDR-0002 revisit trigger).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP endpoints. The integration surface is a local executable invoked as a subprocess.

### 8.2 Events / Messages

N/A — no new events/messages. The hook exit code remains the execution signal (0 = eligible to proceed, non-zero = prevent spawn); on exit 0, the private `ADOS_HOOK_ENV_V1` output file is the separate data-only return channel for authorized environment updates.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `ADOS_PRE_ITERATION_HOOK` | Env override for the hook path; resolves to `${ADOS_PRE_ITERATION_HOOK:-$HOME/.ados/hooks/pre-opencode-iteration}`. The resolved path is the sole opt-in surface. |
| DM-2 | `ADOS_HOOK_AGENT`, `ADOS_HOOK_SCRIPT` | Context variables passed to a present hook: `ceo\|pm` and `ceo-loop\|deliver-ticket`. The hook also inherits model-profile env in scope. |
| DM-3 | Result-domain behavior (preserved, not normalized) | `classify_result` currently produces `merged\|blocked\|pr-open\|failed\|unknown`; emitted delivery summaries can also contain control/outcome values such as `finished` and `max-restarts` depending on OWN/JOIN paths. GH-146 neither reconciles those pre-existing differences nor adds hook-specific values such as `vetoed`/`hook-error`; hook failure follows the existing `failed`/exit-1 consumer behavior. |
| DM-4 | Hook-failure retry settings | New env knobs: `ADOS_HOOK_RETRY_SECONDS` (default 60, total ceo-loop non-busy retry interval), `ADOS_HOOK_MAX_FAILURES` (default 5, ceo-loop consecutive-failure cap, separate from `restarts`), `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS` (default 2, wrapper-teardown SIGTERM→SIGKILL grace). While waiting within `ADOS_HOOK_RETRY_SECONDS`, ceo-loop polls `STOP_FILE` in chunks no longer than 1 second, guaranteeing ≤1-second stop observation latency; this is fixed behavior, not a new setting. All knobs remain env-overridable for tests. |
| DM-5 | `ADOS_HOOK_EXAMPLES` + uninstall symmetry | New install inventory array in `scripts/install.sh`; installs the example content-synced + executable to `./scripts/hooks/`. The example path is also added to `scripts/uninstall.sh`'s explicit file-removal list, and `scripts/hooks/` to its empty-directory cleanup list, so `uninstall.sh --local` removes the installed example and cleans the now-empty directory — mirroring the convention already used for `ADOS_DELIVERY_SCRIPTS`/`ADOS_DELIVERY_TOOLS`. |
| DM-6 | Model-profile variables (consumed by example) | The example reads `OC_ADOS_AGENT_CEO_MODEL` / `OC_ADOS_AGENT_PM_MODEL` according to `ADOS_HOOK_AGENT`; scheduling applies only when that read value starts with `zai-coding-plan/`. This example behavior does not guarantee how OpenCode interprets any variable. |
| DM-7 | `ADOS_HOOK_ENV_OUTPUT` / `ADOS_HOOK_ENV_FORMAT` | Per-invocation context, not operator knobs. The parent provides an absolute path to a fresh mode-`0600` regular output file in a mode-`0700` private directory, plus the literal format identifier `ADOS_HOOK_ENV_V1`; the file is read only after hook exit `0` and removed on every completion/failure/supported-shutdown path. |
| DM-8 | `ADOS_HOOK_ENV_V1` / `ADOS_HOOK_ENV_ALLOWLIST` | Data-only return protocol: zero-byte or header-only = no update; otherwise LF-terminated header plus `set NAME=literal value` / `unset NAME` records. Under `LC_ALL=C`, non-empty files require a final LF; CR/NUL are invalid anywhere; whole file is ≤65,536 raw bytes including header/LFs; operations are ≤256 excluding header; each logical line is ≤8,192 raw bytes excluding its terminating LF; exact limits are accepted and limit+1 rejected. Default names match `^OC_ADOS_AGENT_[A-Z0-9_]+_MODEL$` and exclude credentials. `ADOS_HOOK_ENV_ALLOWLIST` is an operator-supplied comma-separated list of additional exact valid identifiers, including a credential variable only by explicit operator delegation at their own risk. |

### 8.4 External Integrations

- **Z.AI Coding Plan (example only):** the redistributable example references Z.AI's published peak window (14:00–18:00 UTC+8) and model prefix (`zai-coding-plan/`). ADOS does **not** call Z.AI APIs, manage credentials, or hard-depend on Z.AI at runtime; the example is inactive until a user opts in. The peak-window/lead-time values are a tunable assumption (user-editable).

### 8.5 Backward Compatibility

- **Fully backward compatible.** For a missing hook, execution proceeds after the required path check with no intentional wait/sleep, hook subprocess/temp-file creation, or hook-related log output.
- Existing result domains, the exit-code contract, `batch-deliver.sh` classification (exit-code based), and the CEO's existing `failed` branch are unchanged — no consumer edits are required. This change does not reconcile pre-existing differences among classifier, summary, help, or guide wording.
- The stuck-restart budget semantics are unchanged for stuck-kills; the only new retry policy is the separate, bounded hook-failure retry in `ceo-loop.sh`.
- All new env knobs have documented defaults and are additive.
- The new example follows the existing install ⇄ uninstall symmetry: `install.sh --local`/`uninstall.sh --local` add and remove it in lockstep with the other ADOS-delivered scripts/tools, so adopters upgrading and later uninstalling are not left with an orphaned artifact.
- A hook that writes no environment data remains fully compatible: zero-byte or header-only output means no update, so sleep-only policy hooks do not need to change.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Hook-absent deterministic path | When the resolved hook path is absent, execution performs only the required path check before continuing to the existing spawn/resume path; it creates no hook subprocess or temporary output artifact, performs no intentional wait/sleep, and emits no hook-related log output |
| NFR-2 | Supported-shutdown hook-group cleanup | For each wrapper, normal exit and direct SIGTERM/SIGINT/SIGHUP leave 0 hook-group members (hook PID + its `sleep` child) surviving across 20 trials per supported case; wrapper-only SIGKILL, host/power failure, and descendants that leave the group are excluded |
| NFR-3 | Restart-budget purity | N (> `MAX_RESTARTS`) consecutive hook failures consume 0 stuck-restart slots; in `deliver-ticket` the ticket surfaces as `failed`/exit-1 without ever spawning the PM |
| NFR-4 | Bounded ceo-loop retry and stop responsiveness | With `ADOS_HOOK_MAX_FAILURES=2`, ceo-loop exits non-zero after 2 consecutive hook failures and `restarts == 0`; during each `ADOS_HOOK_RETRY_SECONDS` wait, a newly created `STOP_FILE` is observed within ≤1 second and prevents another spawn |
| NFR-5 | UTC-boundary correctness | Pure-function tests pass at 04:29:59 / 04:30:00 / 09:59:59 / 10:00:00 UTC — 100% |
| NFR-6 | Test speed (no real multi-hour sleeps) | The full test suite runs with no real multi-hour `sleep`; sleeps are mocked/bounded |
| NFR-7 | Shutdown grace default | Wrapper-teardown SIGTERM→SIGKILL grace for the hook group defaults to 2 seconds (overridable) |
| NFR-8 | Uninstall cleanup | After `install.sh --local` then `uninstall.sh --local`, the installed example is absent and `scripts/hooks/` is removed when left empty |
| NFR-9 | Environment-return validation and atomicity | 100% of invalid batches (unsafe file, malformed/oversized/unauthorized/duplicate/conflicting record, or apply failure) produce 0 parent-environment changes from that invocation; valid batches apply all staged operations to the parent before command construction. No assertion is made about variable meaning or downstream selection behavior. |
| NFR-10 | Environment-return exact bounds and privacy | Under `LC_ALL=C`, accept exactly 65,536 raw whole-file bytes (header/LFs included), 256 operation records (header excluded), and 8,192 raw bytes per logical line (terminating LF excluded); reject each limit+1 case, any CR/NUL, and any non-empty file missing final LF. Wrapper logs contain 0 returned values and only operation names/counts. |
| NFR-11 | Environment-return lifecycle | Each present-hook invocation uses a fresh mode-`0700` directory and mode-`0600` output file; 0 such artifacts remain after success, failure, normal exit, or supported direct-signal cleanup across 20 trials per wrapper |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- A **present** hook that fails emits a clear, actionable diagnostic to stderr naming the resolved path and the failure reason (not-executable / exec-failure / non-zero exit code), in addition to the existing delivery-summary `last_message`.
- `ceo-loop.sh` logs each hook-failure retry and the distinct "hook failed N consecutive times; exiting" line on reaching the cap.
- The Z.AI example logs the reason it is waiting and the exact UTC wake time before sleeping.
- No new metrics/telemetry infrastructure is introduced; observability is via the existing leveled stderr logging (with stable script context tags) and the delivery summary.
- Environment-return diagnostics identify only the operation name/count and validation category; returned values and output-file contents are never logged.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Hook placed outside individual spawn/retry iterations, so watchdog retries bypass the gate | H | M | Spec mandates per-spawn execution incl. retries (F-1, C-1); hook-counter fixture test across spawn/resume/retry vs JOIN/probe/dry-run | Low |
| RSK-2 | A sleeping hook-group member survives normal exit or a direct SIGTERM/SIGINT/SIGHUP | H | M | Run the hook in its own process group; extend normal-exit and direct-signal cleanup to group termination (SIGTERM → grace → SIGKILL); test all supported cases in both wrappers (F-3, NFR-2). Wrapper-only SIGKILL, host/power failure, and descendants that leave the group remain excluded. | Medium |
| RSK-3 | Hook failure masquerades as a stuck-kill and exhausts `MAX_RESTARTS`, failing the ticket (the safety feature causing the failure) | H | M | Single failure category; separate bounded counter in ceo-loop; deliver-ticket fails on existing path before PM spawn; budgets never consumed by hook failures (F-4, NFR-3) | Low |
| RSK-4 | Example auto-activates on a bare `install.sh --local`, surprising adopters with unexpected session delays | M | M | Example installed to `scripts/hooks/`, never resolved by the loop scripts; activation requires explicit copy/env-override (F-6) | Low |
| RSK-5 | A permanently broken ceo-loop hook exits the supervisor (no longer pure always-on) | M | L | Bounded cap is by design (operator fixes hook + restarts); cap/interval tunable; documented | Medium |
| RSK-6 | Z.AI peak windows/lead-time shift, making the static UTC rule wrong | M | M | Example is user-owned/editable; window is a tunable default, not a hard commitment (F-5) | Medium |
| RSK-7 | Hook failure changes CEO prompt or batch classification behavior, or introduces hook-specific result values | M | L | Preserve the current classifier/summary distinction and consumer behavior; verify no `vetoed`/`hook-error` value is added and existing exit-code/CEO failed-branch behavior is unchanged (F-2, DM-3) | Low |
| RSK-8 | Installed example or its empty directory remains in a user project after `uninstall.sh --local` because the explicit removal list / empty-dir cleanup was not updated for the new `scripts/hooks/` artifact | M | M | Require install ⇄ uninstall symmetry in scope (F-6, DM-5); extend `uninstall.sh` removal + empty-dir lists; add a fixture-based test in `test-uninstall.sh` mirroring `create_mock_ados_project()` (NFR-8) | Low |
| RSK-9 | Hook return data causes parent-shell execution, unauthorized configuration changes, accidental credential delegation, partial parent-environment mutation, or boundary-dependent parsing | H | M | Strict data-only protocol; no source/eval/expansion; built-in non-credential model namespace plus validated exact operator allowlist; validate/stage whole file under `LC_ALL=C` before atomic parent apply; exact bounds/CR/NUL/final-LF tests; values never logged. An explicitly allowlisted credential is operator-delegated at their risk (F-9, DM-7, DM-8, NFR-9, NFR-10) | Low |
| RSK-10 | Operators mistake wrapper-local environment inheritance for a guarantee of provider/model switching, actual selected models, or PM-to-CEO parent mutation | M | M | Document and test only the parent-environment inheritance boundary; state variable meaning is user-defined, model namespace/`{env:...}` are optional examples, and PM affects only its wrapper descendants/retries (F-8, F-9, DM-8) | Low |
| RSK-12 | Missing-hook behavior adds unintended waiting, hook artifacts, or hook-related logs | M | L | Require and test the deterministic absent-path contract: path check only; no intentional wait/sleep, hook subprocess/temp file, or hook-related log output (F-2, NFR-1) | Low |
| RSK-11 | A long `ADOS_HOOK_RETRY_SECONDS` interval delays honoring `--stop`, causing an unwanted retry/spawn after an operator requests shutdown | M | M | Treat the setting as total interval only; poll `STOP_FILE` in non-busy chunks no longer than 1 second and verify ≤1-second observation latency (F-4, DM-4, NFR-4) | Low |

## 12. ASSUMPTIONS

- A user placing a file at the resolved hook path signals opt-in intent and expects it to run (existence is the boundary between silent no-op and loud failure).
- `sleep` is SIGTERM-interruptible, so a group SIGTERM promptly ends a sleeping hook in the common supported-shutdown case.
- `batch-deliver.sh` classifies on `deliver-ticket.sh` exit code (verified: non-zero → `failed`), and `.opencode/agent/ceo.md` has an existing `failed` branch — so a hook failure returning exit 1 needs zero consumer changes.
- The Z.AI peak window (14:00–18:00 UTC+8) and 90-minute lead are stable enough for a static 04:30–10:00 UTC rule; the example is user-editable if they shift.
- Bash ≥ 4 and the `.ai/rules/bash.md` testability patterns (dependency injection, pure functions, mockable wrappers, testable main guard) apply throughout.
- The operator supplies `ADOS_HOOK_ENV_ALLOWLIST`, if needed, before wrapper startup; hooks cannot extend their own authorization.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Current autonomous-delivery scripts (`ceo-loop.sh`, `deliver-ticket.sh`), spec, and guides | The hook extends the existing spawn/resume and signal-propagation paths |
| Depends on | TDR-0002 (Accepted, R2; decision date 2026-07-16) | Resolves the contract details this spec implements, including bounded cleanup and owner-approved safe atomic environment return |
| Depends on | `scripts/install.sh` inventory mechanism | The `ADOS_DELIVERY_SCRIPTS`/`ADOS_DELIVERY_TOOLS` blocks are the model for `ADOS_HOOK_EXAMPLES` |
| Depends on | `scripts/uninstall.sh` removal mechanism | The explicit file-removal list + empty-directory cleanup convention (not marker-driven) is what the new example and `scripts/hooks/` dir must be added to for uninstall symmetry |
| Depends on | `.ai/rules/bash.md` §10–§11 | Testability + embedded test framework |
| Blocks | None directly | Future provider examples may extend `ADOS_HOOK_EXAMPLES` |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Are the `ADOS_HOOK_MAX_FAILURES` (5) and `ADOS_HOOK_RETRY_SECONDS` (60s) defaults well-tuned for real adopter usage? | Reasonable starting points; confirm against production. | Open — revisit per TDR-0002 revisit triggers; no decision needed before delivery. |
| OQ-2 | Should `AGENTS.md`'s repo map add a `scripts/hooks/` mention? | Minor doc discoverability; the example is otherwise reachable via the delivery-modes guide. | Open — deferred to `@doc-syncer` during the §11 docs update. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Adopt the user-approved core hook contract: `~/.ados` fallback with env override, per-spawn/resume execution, no wrapper timeout, subprocess isolation, CEO/PM context, model-profile inheritance. | Ticket + `chg-GH-146-pm-notes.yaml`; keeps provider policy out of generic scripts. | 2026-07-15 |
| DEC-2 | Adopt Accepted TDR-0002 (R2): installed-but-inactive example with symmetric uninstall; single hook-failure category (no `vetoed`/`hook-error` values; scheduling = sleep→exit-0); no execution timeout and cleanup limited to normal exit/direct SIGTERM/SIGINT/SIGHUP; component-split failure handling with restart-budget purity; pure UTC functions + mockable seams. | Preserves consumer behavior and existing result-domain differences without normalizing them; applies the owner-approved bounded cleanup scope. | 2026-07-16 |
| DEC-3 | Adopt Accepted TDR-0002 (R2) environment-return contract: parent-created private `ADOS_HOOK_ENV_V1` output, whole-file validation, built-in non-credential model namespace plus explicit allowlist authorization, atomic parent apply immediately before command construction, and wrapper-local inheritance. | Guarantees safe atomic environment state only, while allowing explicit operator-risk delegation of any additional exact identifier; it does not define variable meaning, provider/model switching, bindings, selected models, or wrapper `-m` semantics. | 2026-07-16 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `scripts/ceo-loop.sh` | Updated — hook invocation incl. retries; bounded hook-failure retry with ≤1-second stop observation; parent-side environment-return validation/atomic apply; group-kill and temporary-output cleanup; allowlist setting |
| `scripts/deliver-ticket.sh` | Updated — hook invocation before each `run_single_iteration`; existing failed/exit-1 path on failure; parent-side environment-return validation/atomic apply; group-kill and temporary-output cleanup; allowlist setting |
| `scripts/install.sh` | Updated — new `ADOS_HOOK_EXAMPLES` array + install block |
| `scripts/uninstall.sh` | Updated — example added to the explicit file-removal list; `scripts/hooks/` added to the empty-directory cleanup list (install ⇄ uninstall symmetry) |
| `scripts/hooks/pre-opencode-iteration-zai.sh` | New — inactive, redistributable Z.AI example |
| `scripts/.tests/` (relevant test files, incl. `test-uninstall.sh`) | Updated/New — existing hook contract plus bounded retry with ≤1-second stop observation, `ADOS_HOOK_ENV_V1` grammar/bounds, invalid-batch atomicity, authorized set/unset, literal values, parent-only inheritance, fresh-output lifecycle, value-safe logging; uninstall-symmetry fixture + non-existence assertion for the example and empty `scripts/hooks/` dir |
| `doc/spec/features/feature-autonomous-delivery.md` | Updated — hook contract, failure semantics, safe environment-return, scope boundary |
| `doc/guides/delivery-modes.md` | Updated — opt-in install, hook-aware `OC_ADOS_MODEL_PROFILE`/tier-default/per-agent-override guidance, optional `{env:...}` owner-setup example, cross-link to canonical model configuration, example link, protocol/allowlist/user-defined-variable guidance, credential-delegation boundary |
| `doc/guides/opencode-model-configuration.md` | Cross-linked from delivery-modes — canonical details for `OC_ADOS_MODEL_PROFILE`, tier defaults, and `OC_ADOS_AGENT_*_MODEL` overrides |

## 17. ACCEPTANCE CRITERIA

> Each criterion references at least one F-/DM-/NFR- ID. Grouped by feature area; the `[ticket AC #n]` marker traces back to GH-146's acceptance criteria.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** `ceo-loop.sh` is on the OWN/spawn path and a hook exists, **when** it is about to create or resume a CEO `opencode run` (including a watchdog retry that creates another session), **then** the hook is invoked immediately before that spawn and the spawn proceeds only on exit 0. `[ticket AC #1]` | F-1, DM-1 |
| AC-F1-2 | **Given** `deliver-ticket.sh` owns the delivery and a hook exists, **when** it is about to invoke `run_single_iteration` for a new or resumed PM `opencode run` (including each watchdog retry), **then** the hook is invoked immediately before that iteration and the PM spawns only on exit 0. `[ticket AC #2]` | F-1, DM-1 |
| AC-F1-3 | **Given** any JOIN path or non-running command (`--is-delivering`, `--last-message`, `--status`, `--log`, `--stop`, `--reset`, dry-run), **when** such a path is taken, **then** the hook is never invoked and no second session is spawned. `[ticket AC #3]` | F-1 |
| AC-F1-4 | **Given** a present hook, **when** it is invoked, **then** it receives `ADOS_HOOK_AGENT` and `ADOS_HOOK_SCRIPT` with the documented values and inherits the model-profile environment variables in scope. `[ticket AC #5]` | F-1, DM-2 |
| AC-F2-1 | **Given** the resolved hook path does not exist, **when** either loop script runs, **then** after the required path check it continues to the existing spawn/resume path with no intentional wait/sleep, hook subprocess/temp-file creation, or hook-related log output. `[ticket AC #4]` | F-2, NFR-1, RSK-12 |
| AC-F2-2 | **Given** a present hook that is not executable, fails to exec, or exits non-zero, **when** it is invoked, **then** that spawn is prevented and a clear, actionable diagnostic is emitted — **and** no hook-specific result value (`vetoed`/`hook-error`) is introduced; the failure follows the existing `failed`/exit-1 consumer behavior without reconciling pre-existing result-domain differences. `[ticket AC #6]` | F-2, DM-3, RSK-7 |
| AC-F3-1 | **Given** a hook is deliberately sleeping (scheduling wait), **when** it runs, **then** no default wrapper timeout kills it for taking too long. `[ticket AC #7]` | F-3, DM-4 |
| AC-F3-2 | **Given** a hook is running/sleeping and remains in its hook process group, **when** either wrapper exits normally or directly receives SIGTERM, SIGINT, or SIGHUP, **then** the hook-group members, including its `sleep` child, are terminated. Wrapper-only SIGKILL, host/power failure, and descendants that leave the group are excluded. `[ticket AC #7]` | F-3, NFR-2 |
| AC-F4-1 | **Given** `deliver-ticket.sh` and a hook failure on the OWN path, **when** the failure occurs inside a retry iteration immediately before that iteration's `run_single_iteration`, **then** the PM never spawns, the ticket surfaces as the existing `failed` result/exit-1, and zero PM restart budget is consumed. `[ticket AC #6, per-retry constraint]` | F-4, DM-3, NFR-3 |
| AC-F4-2 | **Given** `ceo-loop.sh` and consecutive hook failures, **when** the failures recur, **then** the loop waits the total `ADOS_HOOK_RETRY_SECONDS` interval non-busily using `STOP_FILE` polling chunks no longer than 1 second; a `--stop` request is observed within ≤1 second and prevents another spawn. The retry uses a separate counter from `restarts`, consumes zero stuck-restart budget, and exits non-zero on reaching `ADOS_HOOK_MAX_FAILURES`. `[ticket AC #6, per-retry constraint]` | F-4, DM-4, NFR-3, NFR-4, RSK-11 |
| AC-F5-1 | **Given** the inactive Z.AI example is installed and the model value read from `OC_ADOS_AGENT_CEO_MODEL`/`OC_ADOS_AGENT_PM_MODEL` by `ADOS_HOOK_AGENT` starts with `zai-coding-plan/`, **when** it is invoked from 04:30 UTC through 09:59:59 UTC, **then** it delays the spawn until 10:00 UTC (sleep then exit 0). `[ticket AC #8]` | F-5, DM-6, NFR-5 |
| AC-F5-2 | **Given** the Z.AI example, **when** it waits, **then** it logs why it is waiting and the exact UTC wake time; and **when** the model value read by the example is not `zai-coding-plan/*`, **then** it returns immediately without sleeping. `[ticket AC #9]` | F-5 |
| AC-F6-1 | **Given** a bare `install.sh --local`, **when** it completes, **then** the example is present and executable at `./scripts/hooks/pre-opencode-iteration-zai.sh` and registered in the install inventory, yet is **not** at the active hook path; the example and the new inventory pass the Bash, install, and documentation-distribution gates. `[ticket AC #12]` | F-6, DM-5 |
| AC-F6-2 | **Given** a project where the example was installed at `./scripts/hooks/pre-opencode-iteration-zai.sh`, **when** `uninstall.sh --local` runs, **then** the example file is removed and the now-empty `scripts/hooks/` directory is removed too, following the existing explicit-removal-list + empty-directory-cleanup convention. `[ticket AC #12]` | F-6, DM-5, NFR-8 |
| AC-F7-1 | **Given** the test suite, **when** it runs, **then** it covers hook absence, success, all three hook-failure forms, context, retry invocation, excluded paths, model detection, UTC window boundaries, computed sleep duration, no execution timeout, normal-exit/direct-SIGTERM/SIGINT/SIGHUP cleanup for in-group processes, and bounded retry — without any real multi-hour sleep. `[ticket AC #10]` | F-7, NFR-2, NFR-5, NFR-6 |
| AC-F8-1 | **Given** an adopter reads `doc/guides/delivery-modes.md`, **when** they need to configure hook-aware environment updates, **then** it explains `OC_ADOS_MODEL_PROFILE`, tier defaults, and per-agent `OC_ADOS_AGENT_*_MODEL` overrides; cross-links to `doc/guides/opencode-model-configuration.md` for canonical configuration details; identifies `{env:...}` per-agent configuration as an optional owner-setup example rather than a requirement; and states that variable meaning, provider/model selection, and downstream behavior are user-defined and not verified by ADOS. It also describes the hook contract, opt-in installation, Z.AI example, supported cleanup scope, existing `failed`/exit-1 behavior, and no hook-specific result values. `[ticket AC #11]` | F-8, DM-3, DM-6, NFR-2 |
| AC-F9-1 | **Given** either wrapper invokes a present hook, **when** it prepares that invocation, **then** it provides `ADOS_HOOK_ENV_OUTPUT` as an absolute path to a fresh private mode-`0600` regular output file in a mode-`0700` directory and provides `ADOS_HOOK_ENV_FORMAT=ADOS_HOOK_ENV_V1` alongside existing context; the temporary artifacts are removed after every completion/failure/supported-shutdown path. | F-9, DM-7, NFR-11 |
| AC-F9-2 | **Given** a hook exits 0 with an untouched file, a header-only file, or a valid `ADOS_HOOK_ENV_V1` file containing authorized unique `set NAME=literal value` and/or `unset NAME` records, **when** the parent validates it under `LC_ALL=C`, **then** it accepts exact inclusive bounds of 65,536 raw whole-file bytes (header/LFs included), 256 operation records (header excluded), and 8,192 raw bytes per logical line (terminating LF excluded), applies the entire staged batch atomically to parent environment state immediately before constructing the imminent OpenCode command without shell interpretation, and the imminent process plus later iterations of that same wrapper inherit that state. Variable meaning and downstream behavior are not asserted. | F-9, DM-8, NFR-9, NFR-10 |
| AC-F9-3 | **Given** a hook exits 0 with unsafe, missing, malformed, oversized, unauthorized, duplicate, conflicting, non-LF-terminated, blank/comment-containing, CR/NUL-containing, or limit+1 environment output, **when** the parent processes it under `LC_ALL=C`, **then** it applies nothing from that invocation, emits value-safe diagnostics, removes the temporary artifacts, and follows existing hook-failure semantics. **Given** an operator explicitly allowlists an exact credential identifier, **when** the hook returns that authorized identifier, **then** it is processed as operator-delegated data at that operator's risk; GH-146 does not supply, discover, or query its value. | F-2, F-9, DM-7, DM-8, NFR-9, NFR-10, NFR-11 |
| AC-F9-4 | **Given** valid environment output from a CEO hook or PM hook, **when** it is applied, **then** the corresponding parent wrapper's environment state is inherited by its imminent OpenCode process and later iterations/descendants of that same wrapper; the PM child does not mutate its already-running ceo-loop parent. This does not assert provider/model switching, actual selected models, `{env:...}` bindings, or wrapper `-m` semantics. | F-9, DM-8, RSK-10 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Off by default** — a missing hook is a silent no-op, so rollout is zero-risk for non-adopters; no migration, no config change required.
- Delivery order: (1) hook contract in both scripts + group-kill trap; (2) install inventory + Z.AI example; (3) uninstall symmetry (removal + empty-dir lists in `uninstall.sh`); (4) tests (including the uninstall-symmetry test); (5) docs. Each phase commits separately.
- The new env knobs are additive with documented defaults.
- CI gates that must pass: Bash tests (including no-timeout, supported-shutdown cleanup, bounded-retry with ≤1-second stop observation, and uninstall-symmetry tests), `test-doc-distribution.sh`, the install gate, and the no-`vetoed`/`hook-error` hook-specific-value assertion.
- Communication: the delivery-modes guide documents the opt-in activation (copy to `~/.ados/hooks/…` or set `ADOS_PRE_ITERATION_HOOK`) for external adopters.
- The additive operator setting `ADOS_HOOK_ENV_ALLOWLIST` is documented separately from the per-invocation `ADOS_HOOK_ENV_OUTPUT` and `ADOS_HOOK_ENV_FORMAT` context variables.

### 18.1 Definition of Done

GH-146 is done only when all of the following objective checks are satisfied:

- Every acceptance criterion in §17 has passing, recorded evidence; every test case in the current approved test plan at DoD review, including cases added after readiness iteration 1, is executed and passes.
- Evidence covers both wrappers for hook absence, success, all three hook-failure forms, per-retry placement, excluded paths, and no execution timeout; it also covers normal exit and direct SIGTERM/SIGINT/SIGHUP cleanup for in-group hook processes. It makes no unsupported claim for wrapper-only SIGKILL, host/power failure, or descendants that leave the hook process group.
- Missing-hook evidence proves the deterministic absent-path contract: required path check only, no intentional wait/sleep, hook subprocess/temp-file creation, or hook-related log output.
- CEO hook-failure retry evidence proves `ADOS_HOOK_RETRY_SECONDS` remains the total non-busy interval and a `STOP_FILE` created during that wait is observed within ≤1 second, preventing another spawn without a new configuration setting.
- Consumer-regression evidence confirms the exit-code-based batch behavior and CEO `failed` branch are unchanged, and no hook-specific result value (`vetoed`/`hook-error`) has been added; it does not require reconciliation of pre-existing classifier/summary/help/guide differences.
- Environment-return evidence covers both wrappers: private-file modes/lifecycle, empty/header-only compatibility as a primary sleep-only use, valid authorized set/unset with literal metacharacter values, allowlist validation including explicit operator-delegated credential identifiers, exact-limit acceptance and limit+1 rejection for each `LC_ALL=C` raw-byte/record/logical-line bound, CR/NUL/missing-final-LF rejection, all invalid/unsafe cases applying nothing, atomic rollback on apply failure, imminent-child and same-wrapper-next-iteration inheritance of parent environment state, the CEO/PM parent boundary, fresh files per retry, and value-safe diagnostics. It does not assert variable meaning, provider/model switching, selected models, bindings, or wrapper `-m` behavior. GH-146 supplies, discovers, and queries no credentials.
- Install/uninstall evidence confirms the example is installed, executable, inactive by default, and removed with the empty `scripts/hooks/` directory by `uninstall.sh --local`.
- The autonomous-delivery feature specification and delivery-modes guide are reconciled with the delivered hook contract, opt-in activation, bounded cleanup scope/exclusions, and result-domain behavior.
- Documentation also records `ADOS_HOOK_ENV_V1`, its model-only default authorization and explicit allowlist (including the operator-risk credential delegation boundary), user-defined-variable examples, wrapper-local environment inheritance scope, literal-data/no-shell semantics, and that GH-146 supplies, discovers, and queries no credentials. The delivery-modes guide explicitly covers `OC_ADOS_MODEL_PROFILE`, tier defaults, and `OC_ADOS_AGENT_*_MODEL` overrides with the required model-configuration-guide cross-link; `{env:...}` per-agent configuration is optional and no binding/selection guarantee is made.
- Every task in the approved delivery plan is checked complete, and all required quality gates pass: applicable Bash tests, install/uninstall gates, documentation-distribution gate, and the hook-specific-result-value regression assertion.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data model changes. The hook path is a user-local file outside the repo; no migration or seeding is required. New state is in-memory, wrapper-local environment, or a per-invocation temporary output file that is removed after use.

## 20. PRIVACY / COMPLIANCE REVIEW

- The hook is a user-owned local executable; ADOS does not transmit, store, or log hook contents. The example references only a public provider rate window and a model-name prefix — no credentials, PII, or sensitive data.
- Hook diagnostics log only the resolved path and failure reason (not-executable / exec-failure / non-zero) to stderr, consistent with existing script logging.
- Environment-return logs never include requested values, output-file contents, credential values, or arbitrary provider configuration; the channel is limited to authorized variable names and operation counts. An operator may still explicitly delegate an exact credential identifier through the allowlist at their own risk.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Opt-in execution surface:** the hook runs only when a user explicitly places a file at the resolved path; a missing hook is a no-op. Existence is the opt-in boundary (F-2).
- **Subprocess isolation:** the hook runs in its own process group (mirroring the OpenCode child), so it cannot interfere with the wrapper's signal handling or PID tracking.
- **No injection vector:** the hook path is resolved from an env var with a fixed default; the hook is invoked as a subprocess (not `eval`'d). Context is passed via well-named env vars.
- **Safe return channel:** `ADOS_HOOK_ENV_OUTPUT` is parent-created and private; the data-only `ADOS_HOOK_ENV_V1` grammar is parsed under `LC_ALL=C` without `source`, `eval`, or shell expansion. Whole-file authorization and validation precede atomic parent mutation. The built-in namespace excludes credentials and arbitrary configuration; an operator may explicitly delegate any additional exact valid identifier, including a credential, through the allowlist at their own risk (F-9, DM-7, DM-8).
- **No privilege change:** the hook inherits the wrapper's environment and privileges — it does not elevate. Model-profile variables are initial hook context; a valid return batch may update only authorized parent environment state and does not confer a guarantee about downstream interpretation.
- **Signal safety:** on normal wrapper exit and direct SIGTERM/SIGINT/SIGHUP, cleanup targets the hook group (F-3, NFR-2). Wrapper-only SIGKILL, host/power failure, and descendants that leave the group are explicitly outside the guarantee.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New env knobs** (`ADOS_HOOK_RETRY_SECONDS`, `ADOS_HOOK_MAX_FAILURES`, `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS`, `ADOS_PRE_ITERATION_HOOK`, `ADOS_HOOK_ENV_ALLOWLIST`) are documented in `--help`/settings and the guide; defaults are sensible. `ADOS_HOOK_RETRY_SECONDS` remains the total retry interval; its ≤1-second `STOP_FILE` polling is fixed behavior, not another knob. `ADOS_HOOK_ENV_OUTPUT` and `ADOS_HOOK_ENV_FORMAT` are per-invocation context, not operator settings.
- **New install inventory** (`ADOS_HOOK_EXAMPLES`) must be kept in sync with **both** `scripts/install.sh` and `scripts/uninstall.sh` (removal + empty-dir cleanup lists) if the example is renamed/removed — mirroring the existing `ADOS_DELIVERY_SCRIPTS`/`TOOLS` install ⇄ uninstall maintenance.
- **ceo-loop supervisor behavior change:** with a permanently broken hook, ceo-loop exits after the cap (by design) instead of spinning; the operator must fix the hook and restart — documented in the guide.
- **Z.AI example maintenance:** the window/lead-time are tunable; users own and edit their copy. A revisit is triggered if Z.AI windows shift materially or a second provider example is added.
- **Environment-return semantics:** the default `OC_ADOS_AGENT_*_MODEL` namespace and optional `{env:...}` documentation example do not define variable meaning or require a runtime binding. Operators own the meaning of allowlisted variables and any downstream configuration.
- No changes to the AI-vs-script split, the 11-phase lifecycle, or merge authority.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Pre-iteration hook | A user-owned local executable invoked immediately before an actual OpenCode spawn/resume to gate it on local policy |
| OWN path | The single-flight branch where no live owner exists and the caller starts/resumes the session itself |
| JOIN path | The single-flight branch where a live owner exists and the caller waits + classifies instead of spawning |
| Scheduling deferral | A hook expressing "not now" by sleeping until a wake time and then exiting 0 (not a hook-specific result value) |
| Hook failure | The single non-zero category: non-zero exit, not-executable, or exec-failure; prevents the spawn and emits a diagnostic |
| Environment return | The parent-created `ADOS_HOOK_ENV_V1` data file through which a successful hook may request authorized, atomic parent-environment set/unset updates; it is not shell code. Variable meaning and downstream behavior are user-defined. The built-in namespace excludes credentials, while explicit operator allowlisting may delegate an exact credential identifier at that operator's risk. |
| Wrapper-local inheritance | A committed environment state is inherited by the imminent OpenCode process and later iterations of the same wrapper only; a child wrapper cannot mutate its already-running parent. This does not guarantee downstream variable interpretation. |
| Result domains | Pre-existing, distinct result sources: `classify_result` produces merged/blocked/pr-open/failed/unknown, while emitted summaries can also contain control/outcome values such as finished and max-restarts depending on OWN/JOIN paths; unchanged and not normalized by this change |
| Restart budget | The `restarts`/`iteration`/`MAX_RESTARTS` counters consumed only by stuck-CEO/PM kills (never by hook failures) |
| Stop-responsive retry wait | The CEO hook-failure wait whose total duration is `ADOS_HOOK_RETRY_SECONDS` but which polls `STOP_FILE` at least once per second, so `--stop` is observed within ≤1 second |
| zai-coding-plan/ | The model-name prefix the Z.AI example keys scheduling on (via `OC_ADOS_AGENT_*_MODEL`) |

## 24. APPENDICES

- **Appendix A — Contract constraints.** The ten hard constraints (C-1 per-spawn incl. retries and excluded paths; C-2 missing = silent no-op; C-3 no execution timeout; C-4 cleanup on normal exit/direct SIGTERM/SIGINT/SIGHUP only, with explicit exclusions; C-5 single failure category / no hook-specific result values; C-6 Z.AI 04:30–10:00 UTC window + model detection; C-7 tests without real multi-hour sleeps; C-8 installed + registered example with symmetric uninstall; C-9 preserve single-flight/JOIN/signal invariants; C-10 safe atomic environment update) are defined and attested in Accepted TDR-0002 (R2). This spec implements them.
- **Appendix B — Consumer-contract evidence.** `batch-deliver.sh` classifies a ticket on `deliver-ticket.sh`'s exit code (non-zero → `failed`), not the `result=` enum; `.opencode/agent/ceo.md` has an existing `failed` (retry-or-park) branch. Together these confirm a hook failure returning exit 1 requires zero consumer changes.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-15 | @spec-writer | Initial specification (Proposed) — authored from GH-146, `chg-GH-146-pm-notes.yaml`, TDR-0002 (R2), the autonomous-delivery feature spec/guide, the two target scripts, `install.sh`, and `.ai/rules/bash.md`. |
| 1.1 | 2026-07-15 | @spec-writer | Revised for GAP-U1 (uninstall symmetry): broadened F-6/DM-5 to cover install ⇄ uninstall; removed the false §7.3 "uninstall is future work" item; added `scripts/uninstall.sh` to scope, affected components, and dependencies; added NFR-8, RSK-8, KPI row, AC-F6-2; updated rollout and maintenance. |
| 1.2 | 2026-07-16 | @spec-writer | Revised for readiness iteration 1 findings 1, 5, and 8: adopted Accepted TDR-0002 (R2) and owner decision; narrowed F-3/NFR-2/AC-F3-2 to normal exit and direct SIGTERM/SIGINT/SIGHUP; preserved no execution timeout; distinguished existing classifier and summary result domains; added §18.1 Definition of Done. |
| 1.3 | 2026-07-16 | @spec-writer | Reopened for the owner-approved Accepted TDR-0002 (R2) environment-return extension: added F-9, DM-7/DM-8, NFR-9–NFR-11, RSK-9/RSK-10, AC-F9-1–AC-F9-4, Flow 5, and DoD/docs/security/operations traceability for safe wrapper-local model selection. |
| 1.4 | 2026-07-16 | @spec-writer | Resolved readiness finding 6: F-4/DM-4/NFR-4/AC-F4-2 now define `ADOS_HOOK_RETRY_SECONDS` as the total CEO retry interval with fixed non-busy `STOP_FILE` polling and ≤1-second stop observation latency; added RSK-11 and corresponding flow/DoD/docs/operations traceability. |
| 1.5 | 2026-07-16 | @spec-writer | Revised for readiness iteration 2 findings 1, 2, 3, and 6: made model-profile docs/cross-link independently testable; reconciled explicit operator-risk credential allowlisting; corrected PM per-retry placement wording; and defined exact `LC_ALL=C` protocol bounds and boundary rejection. |
| 1.6 | 2026-07-16 | @spec-writer | Revised after owner resolution of readiness iteration 3 finding 2: narrowed F-9 to safe atomic environment state and same-wrapper inheritance only; made model configuration examples optional/user-defined; replaced absent-hook zero-overhead claims with deterministic-path requirements; added RSK-12 and updated AC/DoD/docs traceability. |

---

## AUTHORING GUIDELINES

- Authored from planning-session context only: the GH-146 ticket (12 ACs), `chg-GH-146-pm-notes.yaml` (including the repo-owner's 2026-07-16 bounded-cleanup decision), Accepted TDR-0002 (R2, decision date 2026-07-16), `doc/spec/features/feature-autonomous-delivery.md`, `doc/guides/delivery-modes.md`, the two target scripts (`ceo-loop.sh`, `deliver-ticket.sh`), `scripts/install.sh`, and `.ai/rules/bash.md`.
- The pre-existing documentation drift (feature-spec install note + batch-delivery 15-vs-10 default) was explicitly scoped as phase-7 cleanup, **not** new scope (§7.3), per the PM notes.
- The per-retry requirement (hook before every actual spawn/resume including watchdog retries) is traced in AC-F1-1, AC-F1-2, and the per-retry markers on AC-F4-1/AC-F4-2. The no-hook-specific-result-value constraint (`vetoed`/`hook-error`) is traced in AC-F2-2, DM-3, RSK-7, and the KPI; it deliberately does not normalize pre-existing result-domain differences.
- Implementation detail (file-level code paths, step-by-step tasks) is deliberately omitted; this is a problem/goals/AC spec for downstream `@plan-writer`. TDR-0002 carries the implementation-direction rationale.
- **GAP-U1 (uninstall symmetry):** the v1.1 revision was prompted by the finding that `scripts/uninstall.sh --local` uses an explicit hardcoded removal list + a separate empty-directory cleanup list (not marker-driven), neither of which the original spec covered. The revision extends F-6/DM-5 to require install ⇄ uninstall symmetry, adds NFR-8/RSK-8/AC-F6-2, and removes the false "uninstall is future work" §7.3 item. Accepted TDR-0002 (R2) records the corrected contract.
- **Accepted environment-return extension:** v1.3 consumes TDR-0002 D-6/C-10, explicitly authorized by the repo owner on 2026-07-16. F-9/DM-7/DM-8 and AC-F9-1–AC-F9-4 define a data-only, bounded, atomic environment-return channel; they do not broaden parent-shell execution, result domains, trappable-signal scope, per-retry placement, or uninstall symmetry. The built-in namespace excludes credentials; explicit operator allowlisting may delegate an exact credential identifier at that operator's risk.
- **Readiness iteration 2:** v1.5 consumes reconciled Accepted TDR-0002: model-profile docs are independently traceable through AC-F8-1, credential delegation is operator-explicit rather than categorically forbidden, PM placement is per retry iteration, and DM-8/NFR-10/AC-F9-2–3 use exact `LC_ALL=C` bounds.
- **Readiness finding 6:** v1.4 defines the plan-selected bounded chunked/polling wait without creating a new operator setting: `ADOS_HOOK_RETRY_SECONDS` is the total wait, while `STOP_FILE` is observed in ≤1-second chunks. This is traced through F-4/DM-4/NFR-4/AC-F4-2/RSK-11 and DoD evidence.
- **Readiness iteration 3:** v1.6 consumes the owner resolution for finding 2: the guaranteed surface is atomic parent-environment state plus imminent/same-wrapper inheritance. Model namespace and `{env:...}` are optional examples; GH-146 neither requires bindings nor guarantees selection/interpretation. The absent-hook contract is deterministic rather than a wall-clock zero-overhead promise.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-146)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
