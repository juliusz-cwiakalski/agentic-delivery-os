---
id: TEST-SPEC-AUTONOMOUS-DELIVERY
status: Current
created: 2026-07-16
last_updated: 2026-11-10
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-146", "PDEV-514", "PDEV-516", "GH-280"]
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
- `scripts/hooks/pre-opencode-iteration-zai.sh`,
  `scripts/hooks/pre-opencode-iteration-owner-hold.sh`, and local
  install/uninstall distribution symmetry.
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
also verify 0700/0600 output artifacts are fresh and removed. Dry-run coverage
proves that no hook executes, artifact is created, or hook-return data is applied.
The shared security fixture exercises GNU and BSD/macOS `stat` metadata formats.

`test-install.sh`, `test-uninstall.sh`, `test-hook-zai-example.sh`, and
`test-hook-owner-hold-example.sh` verify
that both examples are executable but inactive after local install, removed with
any empty directory on local uninstall, and that each waits only for its own
configured inputs: the Z.AI example inside its UTC window, and the owner-hold
example while the environment value or the fixed production-store marker is
active.

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
or hook log. JOIN, probes, controls, and dry runs do not invoke it; the PM
dry-run path also does not create artifacts or apply returned environment data.

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
in logs. Tests cover exact 65,536-byte files, 256 records, 8,192-byte lines, and
both GNU and BSD/macOS metadata adapters. They also prove a valid multi-byte
UTF-8 literal value is inherited byte-for-byte, while actual CR and NUL bytes
remain rejected.

### Owner-hold hook contract

Given the owner-hold example with `ADOS_OWNER_HOLD` non-empty, when its condition
is evaluated, then it asks for the poll interval and the sleep line names the
`env` source and the sanitized reason. Given only the fixed production-store
marker `$HOME/.ados-state/owner-hold`, then the marker source and its first line
are named. Given neither, then the condition asks for `0` and the driver returns
without sleeping. The driver takes the MAX across conditions, applies no fixed
iteration cap, accepts `ADOS_OWNER_HOLD_POLL_SECONDS` only in `1`–`3600` and uses
`300` with one warning otherwise, reads no other marker path, emits one bounded
reason line per sleep, and uses no real sleep, network call, or clock read in the
suite. A clock jump neither ends the hold nor extends a deferral beyond one poll.

### Delivery result-contract guards

`scripts/.tests/test-deliver-ticket-result-tuples.sh` derives the canonical
`result=<…>` domain from `scripts/deliver-ticket.sh` and fails when any scanned
current-truth enumeration (`.opencode/agent/ceo.md`,
`doc/guides/delivery-modes.md`, `doc/spec/features/feature-autonomous-delivery.md`)
omits a value or a configured doc carries no enumeration. Its companion
`scripts/.tests/test-deliver-ticket-result-tuples-modes.sh` injects each failure
mode into a synthetic tree and asserts the guard fires. Both run in CI.

`scripts/.tests/test-delivery-mutation-sandbox.sh` copies `deliver-ticket.sh` and
its harness to a temp tree, breaks the result emission in the copy, and asserts
the harness fails on `TC-DT-SF-12` while the unmutated copy passes and no tracked
file is changed. It runs in CI.

## Automation Strategy

Run the focused suites under `scripts/.tests/` and the aggregate
`bash scripts/test-all.sh`. Mockable time and sleep seams prevent real multi-hour
waits. Update these suites and this specification whenever an autonomous-delivery
invariant, hook protocol, or installed example changes.

## References

- [Autonomous Delivery feature specification](../../spec/features/feature-autonomous-delivery.md)
- [Delivery Modes guide](../../guides/delivery-modes.md#optional-pre-iteration-hooks)
- [TDR-0002](../../decisions/TDR-0002-pre-iteration-hook-contract-details.md)
