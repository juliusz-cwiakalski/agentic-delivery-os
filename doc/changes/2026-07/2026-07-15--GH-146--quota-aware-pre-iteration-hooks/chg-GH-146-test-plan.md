---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-test-plan.md
id: chg-GH-146-test-plan
status: Updated
created: 2026-07-15T00:00:00Z
last_updated: 2026-07-16T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["autonomous-delivery", "quota", "hooks"]
version_impact: minor
summary: "Add quota-aware pre-iteration hooks to autonomous delivery loops"
links:
  change_spec: ./chg-GH-146-spec.md
  implementation_plan: ./chg-GH-146-plan.md
  testing_strategy: ../../.ai/rules/testing-strategy.md
---

# Test Plan - Add quota-aware pre-iteration hooks to autonomous delivery loops

## 1. Scope and Objectives

This test plan validates the pre-iteration hook contract across `scripts/ceo-loop.sh` and `scripts/deliver-ticket.sh`, including its safe, wrapper-local environment-return channel. Core objectives include per-spawn/resume invocation, supported lifecycle cleanup for both wrappers, component-specific failure handling, inactive example install/uninstall symmetry, consumer-regression preservation, and bounded data-only model-selection updates with no parent-shell execution or partial mutation.

### 1.1 In Scope

- Hook resolution and invocation for both `ceo-loop.sh` and `deliver-ticket.sh` on the OWN/spawn path
- Hook invocation for every actual spawn/resume, including watchdog retries that create/respawn sessions
- Deterministic absent-hook path: required path check only, with no hook subprocess/artifact, intentional wait, or hook-related logs
- Explicit, actionable diagnostics for hook failures (non-executable, exec-failure, non-zero exit)
- Process-group lifecycle on normal exit and direct SIGTERM/SIGINT/SIGHUP, with bounded SIGTERM→SIGKILL cleanup for in-group processes only
- Component-specific hook-failure handling: deliver-ticket uses existing `failed`/exit-1 path; ceo-loop uses bounded non-busy retry with separate counter
- Z.AI example script with UTC-aware window detection and model-prefix matching
- Install inventory registration and inactivity guarantee
- Install ⇄ uninstall symmetry for the example and empty `scripts/hooks/` directory
- Per-invocation `ADOS_HOOK_ENV_V1` output artifacts, authorization, bounds, atomicity, wrapper-local inheritance, and value-safe diagnostics
- UTC boundary correctness (04:29:59, 04:30:00, 09:59:59, 10:00:00 UTC)
- Testability seams (mockable `_now_utc_epoch()`, `_sleep()`, hook path injection)
- No hook-specific result values (`vetoed`/`hook-error`) or consumer behavior changes; no assertion that pre-existing result domains are normalized
- Regression coverage for INV-DM-1..6 and wrapper, batch-deliver, install/uninstall, example, and aggregate suites

### 1.2 Out of Scope & Known Gaps

- Interrupting an actively running OpenCode session when a blocked window begins (only new spawns/resumes are gated)
- Provider quota API integrations or credential management
- Auto-activation of the Z.AI example on bare `install.sh --local`
- Changes to retry/liveness/single-flight/merge semantics beyond the separate hook-failure retry policy
- Changing the CEO prompt, batch-deliver.sh classification, or any consumer result behavior (static regression verification is in scope)
- Cleanup after wrapper-only SIGKILL, host/power failure, or processes that escape the hook group
- Copying workstation-specific model-profile files into ADOS

## 2. References

- **Change Specification**: `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-spec.md`
- **Implementation Plan**: `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-plan.md`
- **Testing Strategy**: `.ai/rules/testing-strategy.md`
- **Bash Rules**: `.ai/rules/bash.md`
- **Feature Spec**: `doc/spec/features/feature-autonomous-delivery.md`
- **Delivery Modes Guide**: `doc/guides/delivery-modes.md`
- **PM Notes**: `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-pm-notes.yaml`
- **Existing Test Files**:
  - `scripts/.tests/test-ceo-loop.sh`
  - `scripts/.tests/test-deliver-ticket.sh`
  - `scripts/.tests/test-install.sh`
  - `scripts/.tests/test-uninstall.sh`
  - `scripts/.tests/test-batch-deliver.sh`
  - `scripts/.tests/test-hook-zai-example.sh`
- **Target Scripts**:
  - `scripts/ceo-loop.sh`
  - `scripts/deliver-ticket.sh`
  - `scripts/install.sh`
  - `scripts/uninstall.sh`
  - `scripts/batch-deliver.sh`
  - `scripts/hooks/pre-opencode-iteration-zai.sh` (to be created)

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F1-1 | ceo-loop hook invoked before each spawn/resume (incl. watchdog retries) | TC-HOOK-001, TC-HOOK-002, TC-HOOK-003, TC-HOOK-009 | Covered |
| AC-F1-2 | deliver-ticket hook invoked before each run_single_iteration (incl. watchdog retries) | TC-HOOK-001, TC-HOOK-002, TC-HOOK-003, TC-HOOK-009 | Covered |
| AC-F1-3 | Hook never invoked on JOIN, status, log, stop, reset, last-message, dry-run paths | TC-HOOK-004, TC-HOOK-005 | Covered |
| AC-F1-4 | Hook receives ADOS_HOOK_AGENT and ADOS_HOOK_SCRIPT context, inherits model-profile env | TC-HOOK-006 | Covered |
| AC-F2-1 | Missing hook performs only required path check, creates no hook subprocess/artifact, intentionally waits/sleeps never, emits no hook log, and continues normal OpenCode path | TC-HOOK-001 | Covered |
| AC-F2-2 | Hook failure (not-exec / exec-fail / non-zero) emits diagnostic and uses existing failed/exit-1 path; no new result enums | TC-HOOK-007, TC-HOOK-007B, TC-HOOK-008, TC-HOOK-013, TC-HOOK-021 | Covered |
| AC-F3-1 | No wrapper timeout kills a sleeping hook (scheduling waits allowed) | TC-HOOK-010 | Covered |
| AC-F3-2 | Both wrappers clean hook process groups on normal exit and supported direct SIGTERM/SIGINT/SIGHUP, with no orphans | TC-HOOK-011, TC-HOOK-023 | Covered |
| AC-F4-1 | deliver-ticket hook failure prevents PM spawn, surfaces as failed/exit-1, consumes zero restart budget | TC-HOOK-007, TC-HOOK-007B, TC-HOOK-008 | Covered |
| AC-F4-2 | ceo-loop hook failure waits the total ADOS_HOOK_RETRY_SECONDS in non-busy STOP_FILE polling chunks <=1s; stop is observed <=1s, prevents another spawn, uses separate counter, and exits non-zero at cap | TC-HOOK-012 | Covered |
| AC-F5-1 | Z.AI example delays until 10:00 UTC when the configured model environment value starts with zai-coding-plan/ | TC-HOOK-015, TC-HOOK-016, TC-HOOK-017 | Covered |
| AC-F5-2 | Z.AI example logs reason and exact UTC wake time; returns immediately if model not zai-coding-plan/* | TC-HOOK-015, TC-HOOK-018 | Covered |
| AC-F6-1 | Example installed and executable at ./scripts/hooks/... but not at active hook path; passes install gate | TC-HOOK-019 | Covered |
| AC-F6-2 | Uninstall symmetry: uninstall.sh --local removes example and empty scripts/hooks/ dir (0 orphaned artifacts) | TC-HOOK-019B | Covered |
| AC-F7-1 | Test suite covers all hook behaviors without real multi-hour sleeps | All TCs | Covered |
| AC-F8-1 | delivery-modes documents optional OC_ADOS_MODEL_PROFILE/tier/per-agent/{env:...} examples, canonical cross-link, user-defined downstream semantics, hook contract, and existing result behavior | TC-HOOK-020 | Covered |
| AC-F9-1 | Both wrappers provide a fresh private output path and format context; remove artifacts on completion, failure, and supported shutdown | TC-HOOK-023, TC-HOOK-027 | Covered |
| AC-F9-2 | LC_ALL=C valid/empty/header-only V1 batches, including exact bounds, apply atomic parent environment state before command construction with wrapper-local inheritance and literal values | TC-HOOK-024, TC-HOOK-025, TC-HOOK-026 | Covered |
| AC-F9-3 | LC_ALL=C invalid/unsafe/limit+1/CR/NUL batches apply nothing, emit value-safe diagnostics, clean artifacts, and follow hook-failure semantics; explicit credential allowlisting remains operator-delegated | TC-HOOK-026, TC-HOOK-027 | Covered |
| AC-F9-4 | CEO and PM parent environment updates have the specified wrapper-parent inheritance boundary; no model/binding/-m semantics asserted | TC-HOOK-025 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| DM ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| DM-1 | ADOS_PRE_ITERATION_HOOK env override and fallback path | TC-HOOK-001, TC-HOOK-014 | Covered |
| DM-2 | ADOS_HOOK_AGENT and ADOS_HOOK_SCRIPT context variables | TC-HOOK-006 | Covered |
| DM-3 | Result-enum invariant preserved (no vetoed/hook-error) | TC-HOOK-007, TC-HOOK-007B, TC-HOOK-008, TC-HOOK-013 | Covered |
| DM-4 | New env knobs: ADOS_HOOK_RETRY_SECONDS, ADOS_HOOK_MAX_FAILURES, ADOS_HOOK_SHUTDOWN_GRACE_SECONDS | TC-HOOK-012, TC-HOOK-014 | Covered |
| DM-5 | ADOS_HOOK_EXAMPLES install inventory array | TC-HOOK-019, TC-HOOK-019B | Covered |
| DM-6 | Model-profile inheritance and documented optional profile/tier/per-agent configuration examples | TC-HOOK-006, TC-HOOK-015, TC-HOOK-016, TC-HOOK-020 | Covered |
| DM-7 | Per-invocation ADOS_HOOK_ENV_OUTPUT / ADOS_HOOK_ENV_FORMAT context and lifecycle | TC-HOOK-023, TC-HOOK-026, TC-HOOK-027 | Covered |
| DM-8 | LC_ALL=C V1 grammar, exact byte/record/line bounds, authorization including explicit credential delegation, atomic parent-environment apply, and wrapper-local inheritance without downstream semantics | TC-HOOK-024, TC-HOOK-025, TC-HOOK-026, TC-HOOK-027 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| NFR-1 | Hook-absent deterministic path: path check only; no hook subprocess/temp artifact/intentional wait/hook log | TC-HOOK-001 | Covered |
| NFR-2 | No-orphan on wrapper termination: 0 hook descendants surviving after SIGTERM across 20 trials | TC-HOOK-011 | Covered |
| NFR-3 | Restart-budget purity: N consecutive hook failures consume 0 stuck-restart slots | TC-HOOK-007, TC-HOOK-007B, TC-HOOK-008, TC-HOOK-012 | Covered |
| NFR-4 | Bounded ceo-loop retry and stop responsiveness: total retry interval is ADOS_HOOK_RETRY_SECONDS; newly created STOP_FILE is observed <=1s and prevents another spawn; cap exits with restarts=0 | TC-HOOK-012 | Covered |
| NFR-5 | UTC-boundary correctness: 100% pass at 04:29:59 / 04:30:00 / 09:59:59 / 10:00:00 UTC | TC-HOOK-015, TC-HOOK-016 | Covered |
| NFR-6 | Test speed: no real multi-hour sleep; sleeps mocked/bounded | All TCs | Covered |
| NFR-7 | Shutdown grace default: 2 seconds SIGTERM→SIGKILL | TC-HOOK-011, TC-HOOK-014 | Covered |
| NFR-8 | Uninstall orphan-prevention: after install/uninstall, example gone and scripts/hooks/ removed (empty) | TC-HOOK-019B | Covered |
| NFR-9 | Environment-return validation and atomicity: invalid/apply-failed batches change no parent state; valid batches apply before spawn | TC-HOOK-024, TC-HOOK-026 | Covered |
| NFR-10 | LC_ALL=C exact bounds/privacy: accept 65,536 bytes, 256 records, 8192-byte logical lines; reject limit+1, CR/NUL, and missing final LF; logs expose no values | TC-HOOK-024, TC-HOOK-026, TC-HOOK-027 | Covered |
| NFR-11 | Environment-return lifecycle: fresh 0700/0600 artifacts; none after success, failure, normal exit, or supported direct signal | TC-HOOK-023, TC-HOOK-027 | Covered |

## 4. Test Types and Layers

### Unit Tests

- **Framework**: Embedded bash test framework (from `.ai/rules/bash.md` §11)
- **Root Directory**: `scripts/.tests/test-ceo-loop.sh` (for ceo-loop hook behavior)
- **Root Directory**: `scripts/.tests/test-deliver-ticket.sh` (for deliver-ticket hook behavior)
- **Root Directory**: `scripts/.tests/test-install.sh` (for install inventory and example inactivity)
- **Root Directory**: `scripts/.tests/test-hook-zai-example.sh` (discoverable Z.AI example UTC/model tests; the hook self-test mode may be invoked by this suite)

Pure function tests cover:
- Hook path resolution with env override and fallback
- Hook existence, executability, and failure-category detection
- Z.AI example UTC boundary calculations (pure functions)
- Z.AI example model-prefix matching
- Computed seconds-to-10:00 UTC
- Environment-return V1 parser, exact allowlist configuration validation, bounds, and whole-batch staging

### Integration Tests

- **Framework**: Embedded bash test framework
- **Root Directory**: `scripts/.tests/test-ceo-loop.sh` (ceoloop hook lifecycle, per-spawn/resume, bounded retry, signal propagation)
- **Root Directory**: `scripts/.tests/test-deliver-ticket.sh` (deliver-ticket hook before each run_single_iteration, hook-failure handling, excluded paths)
- **Root Directory**: `scripts/.tests/test-install.sh` (local install places example executable but inactive)
- **Root Directory**: `scripts/.tests/test-uninstall.sh` (install ⇄ uninstall symmetry)

Integration tests cover:
- Per-spawn hook invocation for fresh spawn, resume, and watchdog retry
- Hook not invoked on JOIN, status, log, stop, reset, last-message, dry-run paths
- Hook receives correct context (AGENT, SCRIPT) and inherits model-profile env
- Both wrappers handle not-executable, exec-failure, and non-zero hook failures; deliver-ticket retains failed/exit-1 and zero PM restart budget
- ceo-loop hook failure prevents spawn, sleeps between attempts, stops signal honored, bounded counter, exits non-zero at cap
- Both wrappers clean hook process groups on normal exit and direct SIGTERM/SIGINT/SIGHUP; SIGKILL, host failure, and escaped groups are explicitly out of scope
- Install example to ./scripts/hooks/, verify executable, verify not at resolved hook path
- Environment-return artifact modes/lifecycle, wrapper-local inheritance, atomic rejection, and value-safe diagnostics

### E2E Tests

- **Framework**: Embedded bash test framework with RUN_SLOW_TESTS=true gating
- **Root Directory**: `scripts/.tests/test-ceo-loop.sh` and `scripts/.tests/test-deliver-ticket.sh`

E2E tests cover:
- Full loop with hook invoked before each actual spawn, including watchdog retries (gated by RUN_SLOW_TESTS=true)
- Sleeping hook terminated cleanly on each supported direct wrapper signal, no orphans for either wrapper
- ceo-loop respects stop signal during hook-failure retry loop

### Non-Functional Tests

- **Types**: Deterministic path correctness (NFR-1), Reliability (NFR-2 no-orphan, NFR-3 budget purity, NFR-11 lifecycle), Correctness (NFR-4, NFR-5, NFR-7, NFR-9, NFR-10)
- **Tools**: `bash` for shell tests, `ps`, `kill`, `jq` for process/termination verification

Performance/reliability tests cover:
- Hook-absent deterministic path: assert path check only, no hook subprocess/temp artifact/intentional wait/hook log (NFR-1)
- No-orphan test: spawn sleeping hook, exercise normal exit and each supported direct wrapper signal for both wrappers, verify 0 survivors across 20 trials per wrapper (NFR-2)
- Restart-budget purity: verify N hook failures (N > MAX_RESTARTS) consume 0 restart slots (NFR-3)
- Bounded ceo-loop retry: verify ADOS_HOOK_RETRY_SECONDS is the total interval, waits in <=1-second STOP_FILE polling chunks, observes stop <=1 second with no next spawn, and exits at cap with restarts=0 (NFR-4)
- UTC boundary correctness: verify pure function logic at exact timestamps (NFR-5)
- Shutdown grace: verify default 2-second SIGTERM→SIGKILL transition (NFR-7)
- Environment-return validation, bounds, atomicity, privacy, and 0700/0600 lifecycle (NFR-9..11)

### Regression Tests

- **Existing Test Suites**: Run `bash scripts/.tests/test-ceo-loop.sh`, `bash scripts/.tests/test-deliver-ticket.sh`, `bash scripts/.tests/test-hook-zai-example.sh`, `bash scripts/.tests/test-install.sh`, `bash scripts/.tests/test-uninstall.sh`, `bash scripts/.tests/test-batch-deliver.sh`, and `bash scripts/test-all.sh`
- **Coverage**: INV-DM-1..6 invariants preserved; batch-deliver keeps exit-code-based failed-and-continue behavior; CEO retains its existing failed retry-or-park branch; no hook-specific result values appear in scripts/consumers (without asserting a single canonical enum)

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-HOOK-001 | Both wrappers: absent hook follows deterministic normal path | Happy Path | Important | High | AC-F2-1, NFR-1 |
| TC-HOOK-002 | Hook invoked before fresh spawn in both scripts | Happy Path | Critical | High | AC-F1-1, AC-F1-2 |
| TC-HOOK-003 | Hook invoked before each watchdog retry | Happy Path | Critical | High | AC-F1-1, AC-F1-2 |
| TC-HOOK-004 | Hook never invoked on JOIN path | Negative | Important | High | AC-F1-3 |
| TC-HOOK-005 | Hook never invoked on status/log/stop/reset/last-message/dry-run | Negative | Important | High | AC-F1-3 |
| TC-HOOK-006 | Hook receives ADOS_HOOK_AGENT and ADOS_HOOK_SCRIPT, inherits model-profile env | Happy Path | Important | High | AC-F1-4, DM-2, DM-6 |
| TC-HOOK-007 | Both wrappers: not-executable hook is rejected with diagnostic | Negative | Critical | High | AC-F2-2, AC-F4-1, DM-3 |
| TC-HOOK-007B | Both wrappers: exec-failing hook is rejected with diagnostic | Negative | Critical | High | AC-F2-2, AC-F4-1, DM-3 |
| TC-HOOK-008 | Both wrappers: non-zero hook is rejected with diagnostic | Negative | Critical | High | AC-F2-2, AC-F4-1, DM-3 |
| TC-HOOK-009 | Hook success with exit 0 allows spawn to proceed | Happy Path | Critical | High | AC-F1-1, AC-F1-2 |
| TC-HOOK-010 | Both wrappers impose no execution timeout on a sleeping hook | Edge Case | Important | High | AC-F3-1 |
| TC-HOOK-011 | Both wrappers clean hook groups on normal exit and supported direct signals | Regression | Critical | High | AC-F3-2, NFR-2, NFR-7 |
| TC-HOOK-012 | ceo-loop total retry interval with <=1s stop polling, separate counter, no spawn after stop | Edge Case | Critical | High | AC-F4-2, NFR-3, NFR-4 |
| TC-HOOK-013 | No hook-specific result values; existing consumer semantics retained | Regression | Critical | High | AC-F2-2, DM-3 |
| TC-HOOK-014 | Env knobs override defaults: retry interval, max failures, shutdown grace | Happy Path | Important | Medium | DM-4, NFR-7 |
| TC-HOOK-015 | Z.AI example sleeps 04:30–10:00 UTC for configured zai-coding-plan/* env values | Happy Path | Important | High | AC-F5-1, AC-F5-2, NFR-5 |
| TC-HOOK-016 | Z.AI example UTC boundary correctness at 04:29:59 / 04:30:00 / 09:59:59 / 10:00:00 | Edge Case | Important | High | AC-F5-1, NFR-5 |
| TC-HOOK-017 | Z.AI example computes correct seconds-to-10:00 UTC | Happy Path | Important | High | AC-F5-1 |
| TC-HOOK-018 | Z.AI example returns immediately if configured env value is not zai-coding-plan/* | Happy Path | Important | High | AC-F5-2 |
| TC-HOOK-019 | Example installed executable at ./scripts/hooks/..., inactive at resolved path | Happy Path | Important | High | AC-F6-1, DM-5 |
| TC-HOOK-019B | Uninstall symmetry: example and empty scripts/hooks/ removed by uninstall.sh --local | Happy Path | Important | High | AC-F6-2, DM-5, NFR-8 |
| TC-HOOK-020 | Documentation covers hook-aware model-profile selection and contract | Manual | Minor | Medium | AC-F8-1, DM-6 |
| TC-HOOK-021 | batch-deliver treats deliver-ticket hook exit 1 as failed and continues | Regression | Critical | High | AC-F2-2, DM-3 |
| TC-HOOK-022 | CEO prompt retains failed retry-or-park branch | Regression | Important | High | AC-F2-2, DM-3 |
| TC-HOOK-023 | Both wrappers create and clean private environment-return artifacts | Regression | Critical | High | AC-F9-1, DM-7, NFR-11 |
| TC-HOOK-024 | Both wrappers accept compatible and valid authorized V1 batches literally and atomically | Happy Path | Critical | High | AC-F9-2, DM-8, NFR-9, NFR-10 |
| TC-HOOK-025 | Environment-return inheritance is wrapper-local and applies before imminent spawn | Integration | Critical | High | AC-F9-2, AC-F9-4, DM-8 |
| TC-HOOK-026 | Both wrappers enforce LC_ALL=C V1 boundaries, authority, and atomic rejection | Negative | Critical | High | AC-F9-2, AC-F9-3, DM-7, DM-8, NFR-9, NFR-10 |
| TC-HOOK-027 | Both wrappers use fresh output per retry and value-safe diagnostics | Regression | Critical | High | AC-F9-1, AC-F9-3, DM-7, DM-8, NFR-10, NFR-11 |
| TC-HOOK-REG-1 | Regression: INV-DM-1..6 invariants preserved by hook additions | Regression | Critical | High | F-3, F-4 |
| TC-HOOK-REG-2 | Regression: existing suites pass (including batch-deliver, uninstall, aggregate) | Regression | Critical | High | All F |

### 5.2 Scenario Details

#### TC-HOOK-001 - Both wrappers: absent hook follows deterministic normal path

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-2, AC-F2-1, NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- No hook file exists at default path or any ADOS_PRE_ITERATION_HOOK override

**Steps**:
1. Run ceo-loop.sh in a temp state dir with no hook present
2. Run deliver-ticket.sh in a temp state dir with no hook present
3. Instrument the required resolved-path check and wrapper process launcher; assert exactly the normal absent-path check occurs and no hook subprocess is launched.
4. Assert no hook temp output directory/file is created, no intentional sleep/wait helper is invoked, and stderr contains no hook-related log output.
5. Verify mocked OpenCode receives the normal spawn/resume invocation for each wrapper.

**Expected Outcome**:
- Each wrapper performs only its required absent-path check before continuing the normal path.
- No hook subprocess, hook output directory/file, intentional sleep/wait, or hook-related log output occurs.
- Normal mocked OpenCode spawn/resume continues; no timing baseline or wall-clock claim is made.

---

#### TC-HOOK-002 - Hook invoked before fresh spawn in both scripts

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F1-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists at resolved path, executable, exits 0
- Hook writes a marker file on each invocation for test verification

**Steps**:
1. Install temporary hook script that writes marker to a known path and exits 0
2. Run ceo-loop.sh in a temp state dir (spawn fresh CEO)
3. Verify marker file exists and contains expected context (ADOS_HOOK_AGENT=ceo)
4. Run deliver-ticket.sh in a temp state dir (run_single_iteration)
5. Verify marker file exists and contains expected context (ADOS_HOOK_AGENT=pm)

**Expected Outcome**:
- Hook is invoked once before the opencode spawn/resume in both scripts
- Marker file exists with correct ADOS_HOOK_AGENT and ADOS_HOOK_SCRIPT values
- Hook inherits model-profile env variables (OC_ADOS_AGENT_CEO_MODEL / OC_ADOS_AGENT_PM_MODEL)
- Hook exit 0 allows the spawn/resume to proceed
- No hook invocation on JOIN path (separate test covers this)

---

#### TC-HOOK-003 - Hook invoked before each watchdog retry

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F1-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, exits 0, writes invocation count to a counter file
- Configure short stuck threshold to trigger watchdog retry

**Steps**:
1. Install hook that increments a counter file and exits 0
2. Configure STUCK_SECONDS to force a watchdog retry within the test window
3. Run ceo-loop.sh in a temp state dir, trigger CEO stall, verify restart
4. Verify counter file shows hook invoked before initial spawn AND before retry spawn (2 invocations total)
5. Run deliver-ticket.sh in a temp state dir, trigger PM stall, verify restart
6. Verify counter file shows hook invoked before initial iteration AND before retry iteration (2 invocations total)

**Expected Outcome**:
- Hook is invoked before EACH actual spawn/resume, including every watchdog retry
- Invocation count matches: 1 initial + N retries (not one-time per delivery)
- Hook context is correct for each invocation (same agent/script)
- Hook exit 0 allows each spawn/resume to proceed

---

#### TC-HOOK-004 - Hook never invoked on JOIN path

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, writes marker on invocation
- Create a live owner for the same ticket (simulated or real process)

**Steps**:
1. Install marker-writing hook
2. Start a deliver-ticket.sh process in background for a ticket (mock or real)
3. In a second process, invoke deliver-ticket.sh for the same ticket (JOIN path)
4. Wait for JOIN to complete
5. Verify hook marker was NOT written by the JOINer
6. Repeat for ceo-loop: start a live CEO loop, invoke a second ceo-loop, verify hook not invoked on JOIN

**Expected Outcome**:
- JOIN path probes the live owner but does NOT invoke the hook
- Hook marker file remains unchanged during JOIN
- Only the original OWN owner invoked the hook
- Hook invocation is strictly on the OWN/spawn path after single-flight decision

---

#### TC-HOOK-005 - Hook never invoked on status/log/stop/reset/last-message/dry-run

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, writes marker on invocation

**Steps**:
1. Install marker-writing hook
2. Invoke ceo-loop.sh --status
3. Invoke ceo-loop.sh --log
4. Invoke ceo-loop.sh --stop
5. Invoke ceo-loop.sh --reset
6. Run ceo-loop.sh --is-delivering (if it exists)
7. Invoke deliver-ticket.sh --last-message GH-123
8. Invoke deliver-ticket.sh --is-delivering GH-123
9. Run deliver-ticket.sh --dry-run GH-123
10. Verify hook marker was NOT written for any of these invocations

**Expected Outcome**:
- Hook never invoked for status/log/stop/reset subcommands or probes
- Hook never invoked for dry-run mode
- Hook marker file remains unchanged
- Hook only invoked on the OWN/spawn path during actual opencode runs

---

#### TC-HOOK-006 - Hook receives ADOS_HOOK_AGENT and ADOS_HOOK_SCRIPT, inherits model-profile env

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-4, DM-2, DM-6
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, writes environment to a file for verification

**Steps**:
1. Install hook that writes ADOS_HOOK_AGENT, ADOS_HOOK_SCRIPT, and model-profile env vars to a file
2. Set OC_ADOS_AGENT_CEO_MODEL="zai-coding-plan/model-a" and OC_ADOS_AGENT_PM_MODEL="zai-coding-plan/model-b"
3. Run ceo-loop.sh in a temp state dir (spawn fresh CEO)
4. Verify hook received ADOS_HOOK_AGENT=ceo, ADOS_HOOK_SCRIPT=ceo-loop, and inherited OC_ADOS_AGENT_CEO_MODEL
5. Run deliver-ticket.sh in a temp state dir (run_single_iteration)
6. Verify hook received ADOS_HOOK_AGENT=pm, ADOS_HOOK_SCRIPT=deliver-ticket, and inherited OC_ADOS_AGENT_PM_MODEL

**Expected Outcome**:
- Hook receives correct ADOS_HOOK_AGENT (ceo or pm)
- Hook receives correct ADOS_HOOK_SCRIPT (ceo-loop or deliver-ticket)
- Hook inherits model-profile env variables in scope (OC_ADOS_AGENT_CEO_MODEL / OC_ADOS_AGENT_PM_MODEL)
- Hook inherits other relevant environment (e.g., OPENCODE_KEYS_ENV)

---

#### TC-HOOK-007 - Both wrappers reject a not-executable hook with diagnostic

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-2, AC-F4-1, DM-3, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook file exists at resolved path but is not executable (chmod -x)
- Each wrapper runs in an isolated temp state dir with mocked OpenCode

**Steps**:
1. Create hook file without execute permission
2. Run each wrapper independently and capture stdout, stderr, spawned-command marker, and exit behavior
3. Verify each emits the resolved path and "not executable", and does not spawn OpenCode
4. For deliver-ticket, verify exit 1, result=failed, and restarts=0; for ceo-loop, verify its separate bounded hook-failure retry path with restarts=0

**Expected Outcome**:
- Hook not-executable is detected before spawn attempt
- Both wrappers detect it before spawn; deliver-ticket uses failed/exit-1 and ceo-loop uses its specified bounded retry path
- Diagnostic names the resolved hook path and failure reason ("not executable")
- No OpenCode process starts and neither wrapper consumes stuck-restart budget
- Same behavior for exec-failure and non-zero exit (separate test)

---

#### TC-HOOK-007B - Both wrappers reject an exec-failing hook with diagnostic

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-2, AC-F4-1, DM-3, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook file exists at resolved path, is executable, but fails to exec (e.g., bad shebang, noexec mount)
- Each wrapper runs in an isolated temp state dir with mocked OpenCode

**Steps**:
1. Create hook file with executable permissions but bad shebang (e.g., `#!/nonexistent_interpreter`)
2. Run each wrapper independently and capture stdout, stderr, spawned-command marker, and exit behavior
3. Verify each emits the resolved path and exec-failure indication and does not spawn OpenCode
4. Verify deliver-ticket uses failed/exit-1 with restarts=0; verify ceo-loop uses only its separate bounded hook-failure retry with restarts=0

**Expected Outcome**:
- Hook exec-failure is detected before spawn attempt
- Both wrappers detect exec failure before spawn, without spending stuck-restart budget
- Diagnostic names the resolved hook path and failure reason (exec failure)
- Deliver-ticket starts no PM and spends zero PM restart budget; ceo-loop starts no CEO and spends zero stuck-restart budget
- Same exit behavior as not-executable and non-zero exit (single failure category per F-2)

---

#### TC-HOOK-008 - Both wrappers reject a non-zero hook with diagnostic

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-2, AC-F4-1, DM-3, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, exits 1 (or any non-zero)
- Each wrapper runs in an isolated temp state dir with mocked OpenCode

**Steps**:
1. Install hook that exits 1
2. Run each wrapper independently and capture stdout, stderr, spawned-command marker, and exit behavior
3. Verify each emits the resolved path and non-zero-exit reason and does not spawn OpenCode
4. Verify deliver-ticket uses failed/exit-1 with restarts=0; verify ceo-loop's separate hook-failure counter/retry leaves restarts=0

**Expected Outcome**:
- Hook non-zero exit is detected before spawn attempt
- Both wrappers reject the hook before spawn without spending stuck-restart budget
- Diagnostic names the resolved hook path and failure reason ("non-zero exit code")
- Deliver-ticket starts no PM and spends zero PM restart budget; ceo-loop starts no CEO and spends zero stuck-restart budget
- Same as not-executable and exec-failure categories (single failure category per F-2)

---

#### TC-HOOK-009 - Hook success with exit 0 allows spawn to proceed

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F1-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, exits 0
- For deliver-ticket test, mock opencode to avoid long-running real PM

**Steps**:
1. Install hook that exits 0 (no-op hook)
2. Run ceo-loop.sh in a temp state dir with mocked opencode
3. Verify CEO spawn proceeds and opencode command is executed
4. Run deliver-ticket.sh in a temp state dir with mocked opencode
5. Verify PM iteration proceeds and opencode command is executed
6. Verify hook was invoked in both cases (via marker or counter)

**Expected Outcome**:
- Hook exit 0 unblocks the spawn/resume path
- Opencode command is executed as normal
- Hook invocation count is correct (1 per spawn/resume)
- Behavior matches pre-hook baseline when hook succeeds

---

#### TC-HOOK-010 - No wrapper timeout; hook may sleep for hours

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, sleeps for a long time (simulated with short sleep for test)
- No execution timeout is imposed on the hook

**Steps**:
1. Install hook that sleeps for a configurable duration (test uses short sleep, e.g., 10 seconds)
2. Run each wrapper with a bounded test sleep and mocked OpenCode; do not configure or expect an execution timeout
3. Observe that neither wrapper kills the hook for "taking too long"
4. Verify each hook completes and its wrapper proceeds normally

**Expected Outcome**:
- No wrapper timeout kills a sleeping hook
- Hook is allowed to complete its sleep regardless of duration
- Script waits for hook exit before proceeding
- Only supported direct wrapper termination triggers hook cleanup; no real long sleep is used

---

#### TC-HOOK-011 - Both wrappers clean hook groups on normal exit and supported direct signals

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-2, NFR-7
**Test Type(s)**: Integration, Reliability
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, spawns a child sleep process
- Wrapper can be terminated while hook is sleeping

**Steps**:
1. Install a bounded test hook that records its group/PIDs and spawns an in-group child sleep; no real long sleep is used
2. Start each wrapper separately in a temp state dir with mocked OpenCode
3. For each wrapper, exercise normal wrapper completion and separate direct SIGTERM, SIGINT, and SIGHUP trials after the hook group starts
4. For every trial, wait for wrapper completion and prove its hook PID and child PID are gone
5. Repeat each supported-path set across 20 trials per wrapper

**Expected Outcome**:
- Each wrapper supplies process-group cleanup evidence for normal exit and each supported direct signal; neither wrapper may be inferred from the other
- Hook and its children receive SIGTERM and terminate gracefully within ADOS_HOOK_SHUTDOWN_GRACE_SECONDS
- If graceful shutdown exceeds grace, SIGKILL is sent to the process group
- Zero surviving hook or child processes after every supported-path trial across 20 trials per wrapper
- No orphaned processes reparented to init
- SIGKILL, host failure, and processes deliberately escaping the group are explicitly excluded because they are not supported/trappable wrapper-cleanup paths

---

#### TC-HOOK-012 - ceo-loop total retry interval with <=1s stop polling, separate counter, no spawn after stop

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-3, NFR-4, DM-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, always exits 1 (simulating persistent failure)
- ceo-loop is configured with a low failure cap and a deterministic sleep/time fixture (or tight bounded integration harness), never a real long wait
- The fixture records every retry-wait chunk and can create STOP_FILE between chunks

**Steps**:
1. Install hook that exits 1
2. Set `ADOS_HOOK_RETRY_SECONDS` to a multi-chunk test value and `ADOS_HOOK_MAX_FAILURES=2`.
3. With no STOP_FILE, use the deterministic fixture to verify retry-wait chunks are each <=1 second, their non-busy durations sum exactly to the configured total interval, and only then is the next hook attempt eligible.
4. Verify hook failures use a separate counter and `restarts` remains 0; verify exit is non-zero after two consecutive failures.
5. In a separate trial, create STOP_FILE immediately after a recorded wait chunk begins (or at the equivalent bounded integration synchronization point).
6. Verify the next poll observes STOP_FILE within <=1 second, terminates the retry wait, and no additional hook/OpenCode spawn occurs.
7. Assert the test uses recorded/mock time or a tightly bounded assertion; it must not depend on scheduler-sensitive long wall-clock sleeps.

**Expected Outcome**:
- Hook failure prevents CEO spawn
- `ADOS_HOOK_RETRY_SECONDS` remains the total non-busy interval between attempts, not a per-poll interval
- Each wait chunk is <=1 second and STOP_FILE is polled between chunks
- Hook failures are counted in a separate counter, not consuming stuck-restart budget
- Loop exits non-zero after ADOS_HOOK_MAX_FAILURES consecutive failures
- A stop request is observed within <=1 second, terminates the retry wait, and prevents another hook/OpenCode spawn
- restarts counter remains 0 throughout

---

#### TC-HOOK-013 - No hook-specific result values in scripts and consumers

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-3
**Test Type(s)**: Regression (grep-based)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-regression.sh`
**Tags**: @backend, @regression

**Preconditions**:
- Scripts and consumers are scanned for hook-specific result values

**Steps**:
1. Scan `scripts/`, `scripts/batch-deliver.sh`, and delivery consumers/prompts for hook-specific result values such as `vetoed` or `hook-error`
2. Verify no hook-specific result value is introduced in the wrapper/consumer result handling
3. Do not assert a single canonical result-enum string; assert only the no-new-hook-specific-value contract

**Expected Outcome**:
- No hook-specific result values occur in scripts or consumers
- Existing result handling remains unchanged without coupling the test to a single serialized enum declaration
- Hook failures surface through the existing "failed" result/exit-1 path

---

#### TC-HOOK-014 - Env knobs override defaults: retry interval, max failures, shutdown grace

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: DM-4, NFR-7
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`
**Tags**: @backend, @hooks

**Preconditions**:
- Hook exists, executable, exits 1 (to trigger retry logic)
- Environment variables override default values

**Steps**:
1. Install hook that exits 1
2. Set ADOS_HOOK_RETRY_SECONDS=0.1, ADOS_HOOK_MAX_FAILURES=3, ADOS_HOOK_SHUTDOWN_GRACE_SECONDS=1
3. Start ceo-loop.sh in a temp state dir with mocked opencode
4. Verify retry interval is 0.1 seconds (non-busy but fast)
5. Verify loop exits after 3 consecutive failures (not default 5)
6. Verify shutdown grace is 1 second when terminating a sleeping hook

**Expected Outcome**:
- ADOS_HOOK_RETRY_SECONDS overrides default 60s
- ADOS_HOOK_MAX_FAILURES overrides default 5
- ADOS_HOOK_SHUTDOWN_GRACE_SECONDS overrides default 2s
- Default values are used when env vars are not set

---

#### TC-HOOK-015 - Z.AI example sleeps 04:30–10:00 UTC for configured zai-coding-plan/* environment values

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F5-2, NFR-5
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-zai-example.sh` (discoverable suite; may invoke hook self-test mode)
**Tags**: @backend, @hooks, @example

**Preconditions**:
- Z.AI example script is installed at ./scripts/hooks/pre-opencode-iteration-zai.sh
- The relevant configured model environment value is set to a zai-coding-plan/* string
- Current UTC time is mocked via _now_utc_epoch wrapper

**Steps**:
1. Mock _now_utc_epoch to return timestamps at 04:30:00 UTC, 09:59:59 UTC, 10:00:00 UTC
2. Set OC_ADOS_AGENT_CEO_MODEL="zai-coding-plan/model-a" or OC_ADOS_AGENT_PM_MODEL accordingly
3. Invoke the example hook with ADOS_HOOK_AGENT=ceo or pm
4. Verify hook logs reason ("in peak window") and computed wake time
5. Verify hook sleeps until 10:00:00 UTC (mocked _sleep wrapper records duration)
6. Verify hook exits 0 after sleep
7. Repeat for 04:29:59 UTC (just before window) — verify immediate exit 0
8. Repeat for 10:00:01 UTC (just after window) — verify immediate exit 0

**Expected Outcome**:
- Hook detects the zai-coding-plan/* prefix from the configured environment value
- Hook identifies 04:30–10:00 UTC window via pure UTC functions
- Hook logs reason and exact UTC wake time before sleeping
- Hook sleeps until 10:00 UTC then exits 0
- Hook returns immediately if current time is outside window
- UTC boundary logic is correct at all edge cases
- This verifies only example behavior from configured environment values, not provider/model selection or an OpenCode binding.

---

#### TC-HOOK-016 - Z.AI example UTC boundary correctness at 04:29:59 / 04:30:00 / 09:59:59 / 10:00:00

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, F-7, AC-F5-1, NFR-5
**Test Type(s)**: Unit (pure function tests)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-zai-example.sh` (discoverable suite; may invoke hook self-test mode)
**Tags**: @backend, @hooks, @example

**Preconditions**:
- Z.AI example script is installed
- Pure UTC functions are extracted into testable form

**Steps**:
1. Call pure function that determines if in peak window, passing mock timestamps
2. Test at 04:29:59 UTC — verify returns false (not in window)
3. Test at 04:30:00 UTC — verify returns true (in window)
4. Test at 09:59:59 UTC — verify returns true (in window)
5. Test at 10:00:00 UTC — verify returns false (not in window)
6. Test at 04:30:01 UTC — verify returns true (in window)
7. Test at 09:58:30 UTC — verify returns true (in window)
8. Verify 100% pass at all boundary timestamps (NFR-5)

**Expected Outcome**:
- Pure function correctly identifies peak window at all boundaries
- 04:29:59 UTC is considered outside (before) window
- 04:30:00 UTC is considered inside window
- 09:59:59 UTC is considered inside window
- 10:00:00 UTC is considered outside (after) window
- Window logic is timezone-invariant (UTC only)

---

#### TC-HOOK-017 - Z.AI example computes correct seconds-to-10:00 UTC

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1
**Test Type(s)**: Unit (pure function tests)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-zai-example.sh` (discoverable suite; may invoke hook self-test mode)
**Tags**: @backend, @hooks, @example

**Preconditions**:
- Z.AI example script is installed
- Pure function computes seconds until 10:00 UTC from given epoch

**Steps**:
1. Call pure function with mock timestamp at 04:30:00 UTC
2. Verify computed seconds = (10:00:00 - 04:30:00) = 5 hours 30 minutes = 19800 seconds
3. Call pure function with mock timestamp at 09:59:59 UTC
4. Verify computed seconds = 1 second
5. Call pure function with mock timestamp at 09:58:30 UTC
6. Verify computed seconds = 90 seconds
7. Verify function never returns negative or zero (if outside window, caller should not call it)

**Expected Outcome**:
- Function computes exact seconds until 10:00 UTC
- 04:30:00 UTC → 19800 seconds (5h30m)
- 09:59:59 UTC → 1 second
- 09:58:30 UTC → 90 seconds
- Computation is UTC-only, timezone-invariant

---

#### TC-HOOK-018 - Z.AI example returns immediately if configured environment value is not zai-coding-plan/*

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-zai-example.sh` (discoverable suite; may invoke hook self-test mode)
**Tags**: @backend, @hooks, @example

**Preconditions**:
- Z.AI example script is installed
- Relevant configured model environment value is set to a non-zai string

**Steps**:
1. Set OC_ADOS_AGENT_CEO_MODEL="other/model-x" (not starting with zai-coding-plan/)
2. Set current UTC time to 05:00:00 UTC (inside peak window)
3. Invoke the example hook with ADOS_HOOK_AGENT=ceo
4. Verify hook exits 0 immediately (no sleep)
5. Verify no log about peak window or wake time
6. Repeat for PM agent with OC_ADOS_AGENT_PM_MODEL="another/model-y"

**Expected Outcome**:
- Hook checks the prefix from the configured environment value only
- Hook returns immediately without sleeping if model is not zai-coding-plan/*
- No UTC window logic is invoked
- No log messages about peak window or wake time
- No provider/model-selection or OpenCode binding behavior is asserted

---

#### TC-HOOK-019 - Example installed executable at ./scripts/hooks/..., inactive at resolved path

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`
**Tags**: @backend, @hooks, @example

**Preconditions**:
- scripts/install.sh is updated with ADOS_HOOK_EXAMPLES array
- Z.AI example script exists in scripts/hooks/

**Steps**:
1. Run install.sh --local in a temp project dir
2. Verify ./scripts/hooks/pre-opencode-iteration-zai.sh exists
3. Verify ./scripts/hooks/pre-opencode-iteration-zai.sh is executable (chmod +x)
4. Verify the example is NOT at the default hook path ($HOME/.ados/hooks/pre-opencode-iteration)
5. Verify the example is NOT at the ADOS_PRE_ITERATION_HOOK override path if not set
6. Run a delivery script and verify hook is not invoked (example inactive)
7. Verify install.sh passes all existing gates (Bash, install, doc-distribution)

**Expected Outcome**:
- Example is installed to ./scripts/hooks/ (content-synced + executable)
- Example is registered in the install inventory (ADOS_HOOK_EXAMPLES)
- Example is inactive — not at the resolved hook path
- Hook is not invoked by default (must be explicitly copied/env-overridden)
- Install gate passes for the example

---

#### TC-HOOK-019B - Uninstall symmetry: example and empty scripts/hooks/ removed by uninstall.sh --local

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-2, DM-5, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-uninstall.sh`
**Tags**: @backend, @hooks, @example, @install

**Preconditions**:
- scripts/install.sh has ADOS_HOOK_EXAMPLES array
- scripts/uninstall.sh has example in explicit file-removal list and scripts/hooks/ in empty-directory cleanup list
- Z.AI example script exists in repo

**Steps**:
1. Create a mock ADOS project using existing fixture (mirroring create_mock_ados_project())
2. Run install.sh --local in the mock project
3. Verify ./scripts/hooks/pre-opencode-iteration-zai.sh exists and is executable
4. Run uninstall.sh --local in the same mock project
5. Verify ./scripts/hooks/pre-opencode-iteration-zai.sh does NOT exist
6. Verify ./scripts/hooks/ directory does NOT exist (empty dir removed)
7. Verify zero orphaned files or directories remain in ./scripts/hooks/* or related paths
8. Verify other ADOS artifacts are still removed/uninstalled as expected

**Expected Outcome**:
- install.sh --local installs example to ./scripts/hooks/pre-opencode-iteration-zai.sh
- uninstall.sh --local removes the example file completely
- uninstall.sh --local removes the now-empty ./scripts/hooks/ directory
- Zero orphaned files or directories remain (install ⇄ uninstall symmetry)
- Existing uninstall behavior for other ADOS artifacts is preserved

---

#### TC-HOOK-020 - Documentation describes hook and environment-return contracts

**Scenario Type**: Manual
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-8, F-9, AC-F8-1, DM-3, DM-6, DM-7, DM-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-autonomous-delivery.md`, `doc/guides/delivery-modes.md`, `doc/guides/opencode-model-configuration.md`
**Tags**: @backend, @documentation

**Preconditions**:
- Planned documentation updates are available after lifecycle phase 7 (`system_spec_update`) and before DoD review and PR creation.

**Steps**:
1. Read `feature-autonomous-delivery.md` and verify it describes the hook contract
2. Verify opt-in installation instructions (copy to ~/.ados/hooks/... or set ADOS_PRE_ITERATION_HOOK)
3. Verify `delivery-modes.md` explicitly explains `OC_ADOS_MODEL_PROFILE`, tier defaults, and per-agent `OC_ADOS_AGENT_*_MODEL` overrides as optional configuration examples
4. Verify link to the installed Z.AI example is provided
5. Verify explicit statement that hook failures surface as the existing failed result/exit-1 (no new enums)
6. Read `delivery-modes.md` and verify it includes same hook documentation
7. Verify no new result classifications (vetoed/hook-error) are mentioned
8. Verify `delivery-modes.md` cross-links to `opencode-model-configuration.md` for canonical model-configuration details
9. Verify `{env:...}` per-agent configuration, `OC_ADOS_MODEL_PROFILE`, and tier profiles are identified as optional examples, not prerequisites or binding guarantees
10. Verify documentation states variable meaning, provider/model selection, and downstream behavior are user-defined and not verified by ADOS; it must not promise selected models, `{env:...}` binding, or wrapper `-m` semantics
11. Verify `ADOS_HOOK_ENV_V1`, default model-only authorization, exact allowlist extension, literal/no-shell semantics, wrapper-local scope, and the operator-risk credential-delegation boundary are documented

**Expected Outcome**:
- Both docs describe the hook contract, opt-in, and model-profile integration
- Delivery modes explicitly covers the profile selector, tier defaults, per-agent overrides, and cross-link to canonical model configuration as optional examples
- Example location and installation steps are documented
- Explicit no-new-enum statement is present
- Documentation is consistent between both files
- Environment-return contract guarantees safe atomic environment state and wrapper-local inheritance only; variable meaning and downstream selection/binding behavior are user-defined
- Environment-return documentation does not require `{env:...}` or promise provider/model switching, actual selected models, or wrapper `-m` behavior
- Explicit credential-delegation boundary and no ADOS-supplied/discovered/queried credential behavior are documented

---

#### TC-HOOK-021 - batch-deliver treats deliver-ticket hook exit 1 as failed and continues

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-3
**Test Type(s)**: Integration, Regression
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-batch-deliver.sh`
**Tags**: @backend, @regression

**Preconditions**:
- A mocked `deliver-ticket.sh` invocation reproduces its hook-failure exit code 1 for one ticket.

**Steps**:
1. Run batch delivery for at least two tickets with the first mocked delivery returning exit 1 and the next returning its normal success path.
2. Verify the first ticket is classified as failed through existing exit-code behavior.
3. Verify the second ticket is attempted; no hook-specific result value is required or consumed.

**Expected Outcome**:
- Exit 1 is treated as failed and batch processing continues according to existing behavior.
- No consumer change or hook-specific classification is introduced.

---

#### TC-HOOK-022 - CEO prompt retains failed retry-or-park branch

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-3
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-regression.sh`, `.opencode/agent/ceo.md`
**Tags**: @backend, @regression

**Preconditions**:
- Current CEO prompt is available to the regression scanner.

**Steps**:
1. Assert the CEO prompt retains its existing `failed` retry-or-park branch.
2. Assert no hook-specific result value is added to the prompt or consumer handling.

**Expected Outcome**:
- The existing failed retry-or-park behavior remains available without a new hook result domain.

---

#### TC-HOOK-023 - Both wrappers create and clean private environment-return artifacts

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DM-7, NFR-11
**Test Type(s)**: Integration, Reliability
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks, @security

**Preconditions**:
- A hook records `ADOS_HOOK_ENV_OUTPUT` and `ADOS_HOOK_ENV_FORMAT` without changing the output file.

**Steps**:
1. Run each wrapper with a successful present hook; assert the recorded output path is absolute, its parent directory is mode 0700, and it is a regular non-symlink mode-0600 file.
2. Verify `ADOS_HOOK_ENV_FORMAT` is exactly `ADOS_HOOK_ENV_V1`.
3. Verify cleanup after normal completion and hook failure.
4. Independently send direct SIGTERM, SIGINT, and SIGHUP to each wrapper while its hook is running; verify cleanup for each supported signal.
5. Repeat supported lifecycle checks 20 times per wrapper.

**Expected Outcome**:
- Each wrapper supplies fresh private artifacts and removes them after every supported completion/failure/shutdown path.
- SIGKILL, host failure, and escaped process groups are excluded from this supported cleanup claim.

---

#### TC-HOOK-024 - Both wrappers accept compatible and valid authorized V1 batches literally and atomically

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, DM-8, NFR-9, NFR-10
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks, @security

**Preconditions**:
- Mock hooks can write exact LF-terminated protocol files and mocked OpenCode records its inherited environment.

**Steps**:
1. For each wrapper, verify an untouched zero-byte file and an exact header-only `ADOS_HOOK_ENV_V1` file preserve existing environment.
2. Write valid LF-terminated batches with unique authorized default-namespace `set` and `unset` records, including literal shell metacharacters in a value.
3. Repeat with an additional exact valid identifier authorized by a valid comma-separated `ADOS_HOOK_ENV_ALLOWLIST`.
4. Inspect imminent mocked OpenCode environment and wrapper environment after the invocation.
5. Assert test instrumentation detects neither `source` nor `eval`, and that literal values were not expanded or interpreted.

**Expected Outcome**:
- Whole valid batches apply immediately before OpenCode construction, literally and atomically.
- Empty/header-only files are compatible no-update results; only authorized names change.
- Logs report names/counts only, never returned values.
- The test verifies parent environment state only; it makes no provider/model-selection, selected-model, `{env:...}` binding, or wrapper `-m` assertion.

---

#### TC-HOOK-025 - Environment-return inheritance is wrapper-local and applies before imminent spawn

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, AC-F9-4, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks, @security

**Preconditions**:
- Hook and OpenCode mocks capture output-path identity and environment at each spawn/retry.

**Steps**:
1. Verify a CEO-hook valid update reaches its imminent CEO command and a later ceo-loop iteration.
2. Verify a PM-hook valid update reaches its imminent PM command and a later iteration/descendant of that same deliver-ticket wrapper.
3. Run deliver-ticket as the CEO child and assert its PM update does not alter the already-running ceo-loop parent environment.

**Expected Outcome**:
- Updates are visible before the imminent command and persist only in the applying wrapper's later iterations/descendants.
- A PM child cannot mutate its already-running CEO parent.
- Evidence is limited to inherited parent environment state; variable meaning, provider/model selection, actual selected models, `{env:...}` bindings, and wrapper `-m` behavior are not asserted.

---

#### TC-HOOK-026 - Both wrappers enforce LC_ALL=C V1 boundaries, authority, and atomic rejection

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-9, AC-F9-2, AC-F9-3, DM-7, DM-8, NFR-9, NFR-10
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks, @security

**Preconditions**:
- Parent environment has sentinel values; fixtures generate protocol files byte-for-byte under `LC_ALL=C` without real waits.
- Both wrapper test suites invoke their own parser path; mocked OpenCode records any attempted spawn and logs are captured.

**Steps**:
1. Run the same table-driven fixture matrix against both duplicated wrapper parsers with `LC_ALL=C` and generated byte fixtures: accept exactly 65,536 raw whole-file bytes including header and all LFs; reject 65,537 bytes; accept exactly 256 operation records excluding the header; reject 257; accept a logical line of exactly 8,192 raw bytes excluding its terminating LF; reject 8,193.
2. For each accepted exact-boundary fixture, verify the authorized complete batch applies atomically before the mocked OpenCode command, without a performance-sensitive large-file construction.
3. Table-drive rejection fixtures for missing final LF, CR (`0x0D`) in the header, an operation record, and as a CRLF terminator, and embedded NUL (`0x00`), using byte-oriented generators rather than shell strings.
4. Table-drive missing/unsafe/non-regular/symlink output; malformed or extra-header records; blank/comment records; unknown verb; duplicate/conflicting names; unauthorized names; and invalid allowlist configuration (empty item, duplicate, or invalid identifier).
5. Verify a credential identifier is rejected by the built-in namespace, then verify that the same exact valid credential identifier is accepted only when named exactly in `ADOS_HOOK_ENV_ALLOWLIST`, as explicit operator delegation; assert no ADOS behavior supplies, discovers, queries, or auto-adds credential names or values.
6. Test an unwritable/readonly target and an injected parent apply failure after staging a multi-operation batch.
7. For every rejection case, verify zero sentinel/authorized-variable mutation, no OpenCode spawn, value-safe diagnostics, temporary-artifact cleanup, and existing hook-failure behavior. For accepted credential delegation, verify only the explicitly authorized variable is passed as data and its value never appears in logs.

**Expected Outcome**:
- Under `LC_ALL=C`, each inclusive exact boundary is accepted and the first byte/record over it is rejected: 65,536/65,537 whole bytes, 256/257 records, and 8,192/8,193 logical-line bytes excluding LF.
- Missing final LF, CR at any relevant protocol position, and embedded NUL are rejected before mutation.
- Validation and apply are whole-batch atomic: invalid, unsafe, unauthorized, bounded-out, or failed-apply batches cause zero mutation, no spawn, value-safe diagnostics, and cleanup.
- Empty-item, duplicate, or invalid-identifier allowlist configuration is rejected as a wrapper startup configuration error.
- Credentials are excluded from the built-in namespace but an exact credential identifier is accepted only through explicit operator allowlisting at operator risk; GH-146 supplies, discovers, and queries no credentials.
- No partial operation is retained and no returned value, including a credential value, is logged.

---

#### TC-HOOK-027 - Both wrappers use fresh output per retry and value-safe diagnostics

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, AC-F9-3, DM-7, DM-8, NFR-10, NFR-11
**Test Type(s)**: Integration, Reliability
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @hooks, @security

**Preconditions**:
- Retry fixtures capture each output path and emit a unique secret-like literal only through protocol data.

**Steps**:
1. Trigger a deterministic retry in each wrapper and record each `ADOS_HOOK_ENV_OUTPUT` path.
2. Verify every invocation uses a distinct fresh file and all artifacts are absent after the retry sequence.
3. Capture wrapper logs for valid and invalid protocol output and assert they contain operation names/counts but never the unique literal value.
4. Scan the return-processing implementation/test seam for prohibited source/eval execution of output data.

**Expected Outcome**:
- Each retry receives a fresh output file; no return artifacts remain.
- Diagnostics are value-safe and return data is never shell-executed.

---

#### TC-HOOK-REG-1 - Regression: INV-DM-1..6 invariants preserved by hook additions

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, all INV-DM-1..6
**Test Type(s)**: Regression (run existing test suite)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh`
**Tags**: @backend, @regression

**Preconditions**:
- Hook implementation is complete
- Existing test suites are available

**Steps**:
1. Run `bash scripts/.tests/test-ceo-loop.sh` with all tests
2. Run `bash scripts/.tests/test-deliver-ticket.sh` with all tests
3. Verify all existing tests pass (no failures)
4. Verify INV-DM-1 tests (foreground never detached) still pass
5. Verify INV-DM-2 tests (single-flight + JOIN) still pass
6. Verify INV-DM-3 tests (stuck-vs-healthy CEO detection) still pass
7. Verify INV-DM-5 tests (multi-signal liveness) still pass
8. Verify INV-DM-4 tests (merge authority) still pass
9. Verify INV-DM-6 tests (one-ticket-per-working-tree) still pass

**Expected Outcome**:
- All existing tests pass without modification
- Hook additions do not break any existing invariant
- INV-DM-1..6 remain intact and verified by existing tests

---

#### TC-HOOK-REG-2 - Regression: existing test suites pass (ceo-loop, deliver-ticket, install)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: All F
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: All test files
**Tags**: @backend, @regression

**Preconditions**:
- All hook code is implemented
- Test files are updated with new hook-specific tests

**Steps**:
1. Run `bash scripts/.tests/test-ceo-loop.sh` and `bash scripts/.tests/test-deliver-ticket.sh`
2. Run `bash scripts/.tests/test-hook-zai-example.sh`, `bash scripts/.tests/test-install.sh`, and `bash scripts/.tests/test-uninstall.sh`
3. Run `bash scripts/.tests/test-batch-deliver.sh`
4. Run aggregate discovery with `bash scripts/test-all.sh`
5. Verify zero test failures across all suites, including new hook-specific tests
6. Verify no test is skipped without reason

**Expected Outcome**:
- 100% pass rate across all test suites
- New hook functionality is fully tested
- Existing functionality is not regressed

---

## 6. Environments and Test Data

### Required Environments

- **Local Development Environment**: Primary environment for shell test execution
  - Bash 4.0+ (required for associative arrays, mapfile, globstar)
  - Standard tools: `git`, `jq`, `ps`, `kill`, `sleep`, `mktemp`, `diff`
  - `opencode` CLI (mocked via wrapper overrides for most tests)
  - `gh` CLI (mocked via wrapper overrides for most tests)
- **CI Environment**: For continuous integration
  - Same as local dev environment
  - Additional requirement: ensure hook paths are isolated between concurrent runs

### Test Data Generation and Cleanup

- **Temporary Directories**: All tests use `mktemp -d` for isolated state
  - Per-test temp directories are cleaned up in `_test_teardown`
  - State files (CEO_PID_FILE, DELIVERY_DIR, STOP_FILE, etc.) are redirected to temp dirs
- **Mock Hooks**: Temporary hook scripts are created in test temp dirs
  - Hook scripts write markers or counters to test-controlled paths
  - Hooks are deleted after each test via temp dir cleanup
- **Mock External Commands**: Wrapper functions (`_opencode`, `_gh`, `_git`, `_jq`, `_setsid`) are overridden in tests
  - Overrides capture invocations, return controlled responses, and avoid external dependencies
  - Overrides are reset between tests

### Isolation Strategy

- **Environment Isolation**: Each test runs in a fresh bash environment with redirected state paths
- **Process Isolation**: Hooks run in their own process groups (via `setsid`) to avoid PID conflicts
- **Signal Isolation**: Tests do not interfere with real background processes; PIDs are tracked and cleaned up
- **State Isolation**: All state files (PID files, markers, stop files) are written to test temp dirs

## 7. Automation Plan and Implementation Mapping

### Test File Creation/Update

| TC ID | Test File | Execution Command | Mocking Requirements | Implementation Status |
|-------|-----------|-------------------|---------------------|----------------------|
| TC-HOOK-001 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | absent-path check/process/temp/sleep/log instrumentation; mocked OpenCode | To Implement |
| TC-HOOK-002 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | Mock hook that writes marker | To Implement |
| TC-HOOK-002 | scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-deliver-ticket.sh | Mock hook that writes marker | To Implement |
| TC-HOOK-003 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | Mock hook that increments counter, short STUCK_SECONDS | To Implement |
| TC-HOOK-003 | scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-deliver-ticket.sh | Mock hook that increments counter, short STUCK_SECONDS | To Implement |
| TC-HOOK-004 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | Mock hook marker, background owner process | To Implement |
| TC-HOOK-004 | scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-deliver-ticket.sh | Mock hook marker, background owner process | To Implement |
| TC-HOOK-005 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | Mock hook marker | To Implement |
| TC-HOOK-005 | scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-deliver-ticket.sh | Mock hook marker | To Implement |
| TC-HOOK-006 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | Mock hook that writes env to file | To Implement |
| TC-HOOK-006 | scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-deliver-ticket.sh | Mock hook that writes env to file | To Implement |
| TC-HOOK-007 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | chmod -x hook, mocked OpenCode | To Implement |
| TC-HOOK-007B | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | executable bad-shebang hook, mocked OpenCode | To Implement |
| TC-HOOK-008 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | non-zero hook, mocked OpenCode | To Implement |
| TC-HOOK-009 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | Mock hook marker, mocked opencode | To Implement |
| TC-HOOK-009 | scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-deliver-ticket.sh | Mock hook marker, mocked opencode | To Implement |
| TC-HOOK-010 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | bounded sleeping hook, mocked OpenCode | To Implement |
| TC-HOOK-011 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | hook group with child sleep; normal/direct-signal process evidence | To Implement |
| TC-HOOK-012 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | Hook exits 1; deterministic sleep/time recorder; STOP_FILE injection; mocked OpenCode | To Implement |
| TC-HOOK-013 | scripts/.tests/test-hook-regression.sh | bash scripts/.tests/test-hook-regression.sh | None (grep scans) | To Implement |
| TC-HOOK-014 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | Hook that exits 1, env overrides, mocked opencode | To Implement |
| TC-HOOK-015 | scripts/.tests/test-hook-zai-example.sh | bash scripts/.tests/test-hook-zai-example.sh | Mock _now_utc_epoch, _sleep; model-profile env | To Implement |
| TC-HOOK-016 | scripts/.tests/test-hook-zai-example.sh | bash scripts/.tests/test-hook-zai-example.sh | Pure function tests with mock timestamps | To Implement |
| TC-HOOK-017 | scripts/.tests/test-hook-zai-example.sh | bash scripts/.tests/test-hook-zai-example.sh | Pure function tests with mock timestamps | To Implement |
| TC-HOOK-018 | scripts/.tests/test-hook-zai-example.sh | bash scripts/.tests/test-hook-zai-example.sh | Model-profile env, mock _now_utc_epoch | To Implement |
| TC-HOOK-019 | scripts/.tests/test-install.sh | bash scripts/.tests/test-install.sh | None (install test) | To Implement |
| TC-HOOK-019B | scripts/.tests/test-uninstall.sh | bash scripts/.tests/test-uninstall.sh | Mock ADOS project fixture | To Implement |
| TC-HOOK-020 | Manual | Manual review of lifecycle-phase-7 delivery-modes and model-configuration docs | Optional-example and user-defined-semantics checklist | Manual Only |
| TC-HOOK-021 | scripts/.tests/test-batch-deliver.sh | bash scripts/.tests/test-batch-deliver.sh | mocked deliver-ticket exit 1 then success | To Implement |
| TC-HOOK-022 | scripts/.tests/test-hook-regression.sh | bash scripts/.tests/test-hook-regression.sh | static CEO prompt assertion | To Implement |
| TC-HOOK-023 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | output-path/mode recorder; direct signals | To Implement |
| TC-HOOK-024 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | V1 writer, OpenCode environment recorder | To Implement |
| TC-HOOK-025 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | nested wrapper and environment recorders | To Implement |
| TC-HOOK-026 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | LC_ALL=C bash scripts/.tests/test-ceo-loop.sh; LC_ALL=C bash scripts/.tests/test-deliver-ticket.sh | generated exact-boundary/CR/NUL fixtures, credential allowlist cases, injected apply failure | To Implement |
| TC-HOOK-027 | scripts/.tests/test-ceo-loop.sh, scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-ceo-loop.sh; bash scripts/.tests/test-deliver-ticket.sh | retry path/output-path recorder, secret-like literal | To Implement |
| TC-HOOK-REG-1 | scripts/.tests/test-ceo-loop.sh | bash scripts/.tests/test-ceo-loop.sh | None (run existing tests) | Existing – Update |
| TC-HOOK-REG-1 | scripts/.tests/test-deliver-ticket.sh | bash scripts/.tests/test-deliver-ticket.sh | None (run existing tests) | Existing – Update |
| TC-HOOK-REG-2 | scripts/test-all.sh | bash scripts/test-all.sh | None (run aggregate suite) | Existing – Update |

### Mocking Requirements Summary

- **Hook Path Injection**: Temp dir hook files to avoid conflicts with user-installed hooks
- **Wrapper Overrides**: `_opencode`, `_gh`, `_git`, `_jq`, `_setsid` for controlled command behavior
- **Mock Functions**:
  - `_now_utc_epoch()`: Override to return mock epoch (for Z.AI example)
  - `_sleep()`: Override to record duration instead of sleeping (for Z.AI example)
   - Hook scripts: Write markers/counters to verify invocation count and context
- **Protocol Fixtures**: Generate exact raw-byte files under `LC_ALL=C` (including CR/NUL and exact-boundary cases) with byte-oriented utilities; avoid shell-string truncation and large real-time work
- **External Commands**: Avoid real opencode/gh/git calls for speed and reliability

### Definition of Done Evidence Traceability

| Spec DoD evidence | Test plan evidence |
|-------------------|--------------------|
| Both-wrapper deterministic absence path, success, all three failures, retries, excluded paths, and no timeout | TC-HOOK-001..010, TC-HOOK-012 |
| Normal exit and supported direct SIGTERM/SIGINT/SIGHUP group cleanup for both wrappers; no unsupported cleanup claim | TC-HOOK-011, TC-HOOK-023 |
| Batch exit-code continuity, CEO failed branch, and no hook-specific result values | TC-HOOK-013, TC-HOOK-021, TC-HOOK-022 |
| Both-wrapper private V1 artifacts, compatibility, LC_ALL=C exact-boundary acceptance/rejection, CR/NUL/final-LF handling, explicit credential delegation without credential discovery, valid literal parent-environment updates, atomic invalid rejection, same-wrapper inheritance boundary, retry freshness, and value-safe logs; no model/binding semantics claim | TC-HOOK-023..027 |
| Example install/inactivity and uninstall symmetry | TC-HOOK-019, TC-HOOK-019B |
| Documentation reconciliation, including optional profile/tier/override/{env:...} examples, user-defined downstream semantics, canonical model-configuration cross-link, and required suite/gate execution | TC-HOOK-020, TC-HOOK-REG-2 |

DoD execution records must show every current test case passing. No test plan evidence claims cleanup for wrapper-only SIGKILL, host/power failure, or hook descendants that escape the process group.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Hook invoked once-before-loop instead of per-spawn, so watchdog retries bypass the gate | High | Medium | Test TC-HOOK-003 explicitly verifies per-spawn invocation including watchdog retries; grep test asserts hook call placement in code |
| Sleeping hook orphaned (reparented to init) on wrapper SIGTERM | High | Medium | Test TC-HOOK-011 runs 20 trials verifying zero survivors; process-group cleanup tested with short grace |
| Hook failure masquerades as stuck-kill and exhausts MAX_RESTARTS | High | Medium | Tests TC-HOOK-007, TC-HOOK-008, TC-HOOK-012 verify zero restart budget consumed; separate counter verified |
| Parser boundary or credential-authority drift permits unsafe mutation | High | Medium | TC-HOOK-026 exercises both parsers under LC_ALL=C at exact/limit+1 bounds, CR/NUL, atomic rejection, and explicit-only credential delegation |
| Example auto-activates on bare install.sh --local | Medium | Medium | Test TC-HOOK-019 verifies example at ./scripts/hooks/ but not at resolved path; install test confirms inactivity |
| UTC boundary logic fails at DST transitions | Medium | Low | All time arithmetic is UTC (timezone-invariant); DST does not affect UTC timestamps |
| Hook process group cleanup fails on some platforms | Medium | Low | Uses `kill -- -PID` (negative PID) which is POSIX-standard; tested on Linux as primary target |

### 8.2 Assumptions

- Bash 4.0+ is available on all target systems (confirmed by `set -o errtrace` and globstar usage in existing scripts)
- `kill -- -PID` (negative PID for process group) is supported on target platforms
- `sleep` is SIGTERM-interruptible, so a group SIGTERM promptly ends a sleeping hook without needing SIGKILL
- Model-profile env variables (OC_ADOS_AGENT_CEO_MODEL, OC_ADOS_AGENT_PM_MODEL) are set when scripts run
- The Z.AI peak window (14:00–18:00 UTC+8) and 90-minute lead are stable enough for the static 04:30–10:00 UTC rule
- Users who place a file at the resolved hook path intend for it to run (existence is the opt-in boundary)
- Test machines have sufficient resources to run process-isolation tests (no PID exhaustion)

### 8.3 Open Questions

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-HOOK-1 | Should ADOS_HOOK_MAX_FAILURES and ADOS_HOOK_RETRY_SECONDS defaults be tuned before GA? | Reasonable starting points; may need production validation | Open — revisit per TDR-0002 revisit triggers; defaults acceptable for initial delivery |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-15 | @test-plan-writer | Initial test plan (Proposed) — authored from GH-146 spec, PM notes, TDR-0002 (R2), testing strategy, bash rules, and existing test files. All ACs traced to test scenarios; TC-HOOK-001 through TC-HOOK-020 defined with test types and automation mapping. |
| 1.1 | 2026-07-15 | @test-plan-writer | Updated (Corrected) — removed nonexistent AC-F9-1 reference from TC-HOOK-002, added TC-HOOK-007B to cover exec-failure scenario (bad shebang/noexec), updated coverage matrices and automation inventory to include TC-HOOK-007B. |
| 1.2 | 2026-07-15 | @test-plan-writer | Updated (Spec v1.1 sync) — added TC-HOOK-019B for uninstall symmetry (AC-F6-2, DM-5, NFR-8); added NFR-8 to coverage matrices; added AC-F6-2 to functional coverage; updated DM-5 coverage to include TC-HOOK-019B; updated regression suite list to include test-uninstall.sh; added TC-HOOK-019B to scenario index, details, and automation plan; bidirectional sweep confirmed all 24 TC IDs defined and mapped. |
| 1.3 | 2026-07-16 | @test-plan-writer | Updated for spec v1.3 and readiness iteration 1 findings 4, 7, and 10 — made failure/no-timeout/supported-cleanup evidence explicitly cover both wrappers; added consumer regressions (TC-HOOK-021/022); corrected Z.AI and aggregate-suite execution mappings; added environment-return protocol coverage (TC-HOOK-023..027) for DM-7/DM-8, NFR-9..11, and AC-F9-1..4; added DoD evidence traceability and expanded regression execution. |
| 1.4 | 2026-07-16 | @test-plan-writer | Updated for spec v1.4 stop responsiveness — refined AC-F4-2/NFR-4 and TC-HOOK-012 to verify `ADOS_HOOK_RETRY_SECONDS` as the total retry interval, <=1-second STOP_FILE polling chunks, <=1-second stop observation, no subsequent spawn, and zero stuck-restart consumption using deterministic/mockable time or a tight bounded assertion; updated its automation mapping. |
| 1.5 | 2026-07-16 | @test-plan-writer | Updated for spec v1.5 and readiness iteration 2 findings 7 and 9 — expanded TC-HOOK-026 across both parsers under `LC_ALL=C` for exact byte/record/line boundaries, CR/NUL/final-LF rejection, atomic rejection, and explicit credential delegation; expanded TC-HOOK-020 for profile selector/tier/per-agent guidance and canonical-guide cross-link; mapped TC-HOOK-001 to both wrappers; updated AC/DM/NFR, automation, and DoD traceability. |
| 1.6 | 2026-07-16 | @test-plan-writer | Updated for spec v1.6 and readiness iteration 3 findings 2/4 — narrowed environment-return evidence to safe atomic parent-environment updates and imminent/same-wrapper inheritance, explicitly excluding model selection/binding/`-m` claims; made Z.AI checks configured-environment-only; replaced TC-HOOK-001 timing baseline with deterministic absent-path assertions for both wrappers; corrected TC-HOOK-020 lifecycle timing and optional-example/user-defined-semantics documentation checks; updated matrices, automation, and DoD traceability. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| (To be populated during execution) | | | |
