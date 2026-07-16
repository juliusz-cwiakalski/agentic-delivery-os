---
id: TEST-SPEC-AUTONOMOUS-DELIVERY
status: Current
created: 2026-07-16
last_updated: 2026-07-16
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-146"]
  feature_spec: doc/spec/features/feature-autonomous-delivery.md
  decisions: ["TDR-0002"]
---

# Test Specification: Autonomous Delivery

## Overview

The autonomous-delivery test suite verifies that the shell wrappers preserve
single-flight delivery, liveness, restart, merge-authority, and child-cleanup
invariants while safely supporting optional pre-iteration hooks.

## Test Scope

- `scripts/ceo-loop.sh`, `scripts/deliver-ticket.sh`, and their hook lifecycle
  and `ADOS_HOOK_ENV_V1` parser behavior.
- `scripts/hooks/pre-opencode-iteration-zai.sh` and local install/uninstall
  distribution symmetry.
- Existing `batch-deliver.sh` exit-code consumer behavior and the CEO failed
  ticket path.
- Excluded cleanup modes: wrapper-only SIGKILL, host/power failure, and hook
  descendants that escape their process group.

## Test Levels

### Unit Tests

The embedded Bash suites test hook-path resolution, allowlist validation,
data-only protocol grammar and exact C-locale bounds, and pure Z.AI UTC helpers.
UTC boundaries are 04:29:59, 04:30:00, 09:59:59, and 10:00:00.

### Integration Tests

`test-ceo-loop.sh` and `test-deliver-ticket.sh` use executable fixtures and
mocked OpenCode commands to verify hook invocation before each spawn/resume and
watchdog retry, excluded JOIN/probe/control/dry-run paths, wrapper context,
parent-only environment inheritance, failure handling, and cleanup. The suites
also verify 0700/0600 output artifacts are fresh and removed.

`test-install.sh`, `test-uninstall.sh`, and `test-hook-zai-example.sh` verify
that the Z.AI example is executable but inactive after local install, removed
with its empty directory on local uninstall, and waits only for matching
configured values in its UTC window.

### End-to-End Tests

Slow, real-wrapper cases are gated by `RUN_SLOW_TESTS=true`. They cover a
sleeping in-group hook on normal exit and direct HUP/INT/TERM, and CEO stop-file
observation during a failed-hook retry wait.

## Test Scenarios

### Per-spawn hook contract

Given an OWN path and a present executable hook, when either wrapper spawns or
resumes OpenCode, including a watchdog retry, then the hook receives its agent
and script context immediately before that command. Given a missing hook, the
normal spawn path continues with no hook subprocess, artifact, intentional wait,
or hook log. JOIN, probes, controls, and dry runs do not invoke it.

### Failure and lifecycle contract

Given a non-executable, exec-failing, non-zero, or invalid-output hook, when a
wrapper reaches its OWN path, then no OpenCode child starts and no stuck-restart
budget is used. `deliver-ticket.sh` returns existing `failed`/1 behavior;
`ceo-loop.sh` waits in at-most-one-second stop-aware chunks, uses its separate
failure cap, and exits non-zero at that cap. A sleeping hook has no execution
timeout and is cleaned only on the supported wrapper termination paths.

### Environment-return security contract

Given a zero-byte, header-only, or valid authorized `ADOS_HOOK_ENV_V1` output,
when the hook exits zero, then literal records apply atomically before the
imminent command and remain scoped to the applying wrapper. Given malformed,
unsafe, unauthorized, duplicate, CR/NUL-containing, unterminated, or limit+1
output, then no state from that batch applies and returned values do not appear
in logs. Tests cover exact 65,536-byte files, 256 records, and 8,192-byte lines.

## Automation Strategy

Run the focused suites under `scripts/.tests/` and the aggregate
`bash scripts/test-all.sh`. Mockable time and sleep seams prevent real multi-hour
waits. Update these suites and this specification whenever an autonomous-delivery
invariant, hook protocol, or installed example changes.

## References

- [Autonomous Delivery feature specification](../../spec/features/feature-autonomous-delivery.md)
- [Delivery Modes guide](../../guides/delivery-modes.md#optional-pre-iteration-hooks)
- [TDR-0002](../../decisions/TDR-0002-pre-iteration-hook-contract-details.md)
