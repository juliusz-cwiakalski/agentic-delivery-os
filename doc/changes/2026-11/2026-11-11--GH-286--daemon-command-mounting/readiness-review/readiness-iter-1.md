# Readiness review — GH-286 — iteration 1

- **Verdict:** NOT_READY
- **Date:** 2026-11-11
- **Gate:** `@readiness-reviewer` (adversarial Definition of Ready)
- **Artifacts reviewed:** `chg-GH-286-spec.md`, `chg-GH-286-test-plan.md`, `chg-GH-286-plan.yaml`, `chg-GH-286-pm-notes.yaml`, `doc/decisions/TDR-0022-daemon-lifecycle-mount-and-degradation-composition.md`, ticket #286, delivered tree.
- **Pause required:** no — no human-input decision; every blocking finding is artifact-repairable.

## Facet summary

| Facet | Result |
|---|---|
| spec_completeness | FAIL (RF-1) |
| ac_quality | FAIL (RF-2, RF-4, RF-6) |
| plan_coverage | FAIL (RF-3, RF-7) |
| test_traceability | FAIL (RF-2, RF-5) |
| cross_artifact_consistency | FAIL (RF-1, RF-3) |
| decision_capture | FAIL (RF-1 amends TDR-0022 DC-1) |
| system_spec_consistency | FAIL (RF-4, RF-6) |
| plan_doc_update_coverage | PASS |
| plan_code_area_coverage | FAIL (RF-3) |
| dod_defined | PASS (47 ACs and per-phase exits are testable; count drift is A-7) |

## Blocking findings

### RF-1 [critical] — re-entry environment cannot execute the shipped entry

**Artifacts:** spec §5.1 F-3, §12 assumptions, AC-F2-1, AC-F3-2, RSK-2, DM-6; test plan TC-DAEMON-039 steps 1/6.

**Gap:** the pinned re-entry contract — spawn `process.argv[1]` with an environment of exactly one variable (no `PATH`) — cannot execute the shipped entry, so AC-F2-1 and the ticket's primary acceptance are unachievable in the tested configuration.

**Evidence:**
- `packages/cli/src/daemon-compose.ts:671-675` spawns `{ entry: daemonEntry, args: ["daemon","start","--foreground"], environment: { [environmentName]: stateDirectory } }`.
- `packages/adapters/src/daemon/process.ts:73-77` passes `env: { ...environment }`: the child environment is replaced, not extended.
- `packages/cli/bin/delivery-os.ts:1` is `#!/usr/bin/env bun`; `bun` lives at `~/.bun/bin/bun`.
- Empirical: a `#!/usr/bin/env bun` script under `env -i` fails with `env: 'bun': No such file or directory` (no `PATH` → `env` searches `/usr/bin:/bin`).
- RSK-2 only covers "not executable at spawn time"; the real failure is executable-but-interpreter-unresolvable without `PATH`.

**Why it blocks:** the acceptance cannot be met; the sole integration proof is either red or vacuous (only a `#!/bin/sh` wrapper with an absolute interpreter satisfies both the case and the claimed env shape).

**Remediation:** forward a minimum re-entry environment — `PATH`, `HOME`, and a non-empty working-name override — alongside `<PREFIX>_STATE_DIR`; amend TDR-0022 DC-1.

**Reopen:** `specification` (plus TDR amendment), `test_planning`.

### RF-2 [critical] — AC-F5-6 universal equivalence is unsatisfiable

**Artifacts:** spec DM-4, AC-F5-1, AC-F5-6; plan header pinned predicate and task 5.3; test plan TC-DAEMON-073 step 2, TC-DAEMON-075.

**Gap:** AC-F5-6's universal claim ("given any durable record set") fails at two cells that TC-075 itself includes.

**Evidence:**
- `packages/core/src/domain/daemon-heartbeat.ts:63` — `state: ageMs >= stalenessMs ? "stale" : "running"`, so at-bound is stale while the plan pins `<=` as reachable.
- `foldDaemonLiveness` reports `running` for `instance === undefined` plus a fresh heartbeat (`daemon-heartbeat.ts:60-63`), while the predicate degrades an absent instance.

**Remediation:** pin the predicate to `instance.operation ∈ {acquired, taken-over}`, `heartbeat.instanceId === instance.instanceId`, and `now − beatAt < lockStalenessMs`; restate AC-F5-6 over stores that carry an instance record; exclude the orphan-heartbeat cell explicitly; align DM-4, plan header pin, TC-073, TC-075.

**Reopen:** `specification`, `test_planning`, `delivery_planning`.

### RF-3 [major] — declared permitted-edit set is incomplete and one file is outside every phase scope

**Artifacts:** plan Phase 6 `scope.files`, tasks 6.6/8.3; spec §8.5; AC-F8-4.

**Evidence:**
- `tests/behaviour/entrypoint-help-coverage.test.ts:147-169` hard-codes the 16-command list and asserts equality with `coverage.commands`; adding `daemon` makes it red.
- `tests/behaviour/entrypoint-help.test.ts:29-45` is edited by Phase 6 task 6.6 but is not named in spec §8.5, which AC-F8-4 makes normative.

**Remediation:** add both suites to spec §8.5/AC-F8-4 and to Phase 6 `scope.files`; correct plan task 8.3 to five sites.

**Reopen:** `specification`, `delivery_planning`.

### RF-4 [major] — plain `daemon status` probes the socket, contradicting the narrative and TC-060

**Artifacts:** spec F-4, §10, AC-F4-1; plan task 2.6; test plan TC-060 step 6, TC-061 step 4.

**Evidence:** `packages/cli/src/daemon-compose.ts:640-641` runs `await probe()` for `live === false` too; `packages/core/src/app/daemon-status.ts:150-153` merges `daemon-unreachable` whenever the socket is unreachable.

**Remediation:** state one contract that matches delivered code — plain `status` probes, reports socket reachability, and never fails closed; `--live` fails closed. Restate AC-F4-1 and TC-060/TC-061; keep the zero-connect claim only for the queue/lanes degradation path.

**Reopen:** `specification`, `test_planning`, `delivery_planning`.

### RF-5 [major] — asserted install command order contradicts the delivered adapter

**Artifacts:** test plan TC-DAEMON-100 step 5; plan task 3.3.

**Evidence:** `packages/adapters/src/daemon/supervisor.ts:192-235` writes the unit, enables it, enables linger, then writes the ownership marker.

**Remediation:** correct the expected order in TC-100 and plan task 3.3; no adapter change.

**Reopen:** `test_planning`, `delivery_planning`.

### RF-6 [major] — two exit-digit claims are wrong

**Artifacts:** spec Appendix D, AC-NFR-6; plan Phase-3 exit; test plan TC-DAEMON-124 steps 4/6.

**Evidence:** `packages/core/src/contracts/error-table.ts:1278-1299` declares `user-validation` for `daemon.already-running` and `daemon.takeover-refused`; `packages/cli/src/projection.ts:12-16` maps `user-validation` to exit 1.

**Remediation:** correct Appendix D, AC-NFR-6, TC-124 to exit 1.

**Reopen:** `specification`, `test_planning`.

### RF-7 [major] — mutant consumer is declared in a phase that has already committed

**Artifacts:** plan task 5.4, Phase 6 task 6.7, Phase 5/6 `scope.files`.

**Gap:** Phase 6 creates `conditional-registration` and `help-composer-invoked` mutants but the consumer `tests/checks/daemon-mutants.test.ts` sits only in Phase 5's scope.

**Remediation:** declare each mutant consumer in the phase that creates the mutant, or make each owning suite self-contained.

**Reopen:** `delivery_planning`.

## Advisory findings

| ID | Severity | Finding | Reopen |
|---|---|---|---|
| A-1 | minor | AC-NFR-2/NFR-3 "≤ 2 durable state reads" is unachievable as literally written (lanes already reads queue facts and lanes). Restate as "≤ 2 additional daemon-fact reads". | specification |
| A-2 | minor | RSK-6/DEC-16 "fails closed at start" is imprecise: a renamed brand yields `homeDirectory === ""` and a root-level state path. State the real failure and guard it. | specification |
| A-3 | minor | Phase 6 task 6.4 says "keep both arrays sorted"; the coverage fixture is intentionally unsorted. Say "append at the end; order is not normative". | delivery_planning |
| A-4 | minor | Test plan §7 still names ~34 file paths that the plan consolidates into 14 suites. Add a pointer so there is one inventory. | test_planning |
| A-5 | minor | AC-F8-4 names delivered suites no phase gate runs (daemon degradation, control transport, queue-scheduling contract, daemon vocabulary). Add them to the Phase 4/5 gates. | delivery_planning |
| A-6 | minor | `renderSystemdUnit` emits `Environment=<NAME>=<path>` unquoted; a path with a space mis-parses. Declare the limitation. | specification |
| A-7 | nit | Count drift: §25 says 47 ACs (41 capability); the Authoring Guidelines say eight capabilities and 46 criteria. | specification |
| A-8 | minor | TC-104 preconditions say "no `daemonEntry` (and therefore no `binary`)"; `binary` is required. Key the refusal on entry-path absence. | test_planning |
| A-9 | minor | `packages/cli/src/daemon-main.ts` already implements a foreground lifetime that ignores a failed `stop()`; Phase 4 adds a second. Declare the disposition. | delivery_planning |

## Verified sound (do not re-litigate)

- Transport ownership predicate, stale-socket replacement seam, `renderSystemdUnit` shape, unit path/marker/linger/rollback/uninstall ownership scoping.
- `resolveStateDirectoryScope` rejects a non-absolute override exactly as AC-F3-4 asserts.
- The injectable `processPort` makes the zero-signal proof real.
- `daemon` is absent from `PROMPT_REQUIRED_COMMANDS`, the help inventory, and both coverage arrays; the reference page has no `--help`/`--version` today.
- Loop cancellation tolerance (≤ 250 ms) satisfies NFR-5 without engine changes.
- The 50-TC map is complete and duplicate-free.
- Phase ordering (runtime composed in Phase 2, prompt-required membership in Phase 6) avoids the `selectPromptRequiredProgram` throw.
- `tmp/` is git-ignored; `.changeset/` is not; `tests/types/tsconfig.json` and conformance discovery assumptions hold.

## Reopen routing

| Phase | Findings |
|---|---|
| `specification` | RF-1, RF-2, RF-3, RF-4, RF-6 (+ TDR-0022 DC-1 amendment via `@decision-advisor`), A-1, A-2, A-6, A-7 |
| `test_planning` | RF-2, RF-4, RF-5, RF-6, A-4, A-8 |
| `delivery_planning` | RF-2 (header pin), RF-3, RF-4 (task 2.6), RF-7, A-3, A-5, A-9 |

No finding targets `delivery`.
