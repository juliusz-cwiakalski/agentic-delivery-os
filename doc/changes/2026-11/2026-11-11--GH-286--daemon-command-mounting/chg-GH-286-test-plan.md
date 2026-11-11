---
id: chg-GH-286-test-plan
status: Updated
version: 1.3
created: 2026-11-11T02:25:00Z
last_updated: 2026-11-11T18:40:00Z
owners: [engineering]
service: delivery-os daemon lifecycle mount (production composition, detached re-entry, foreground lifetime, durable degradation, install identity, help/coverage)
labels: [cli, daemon, entrypoint, degradation, help, process-lifecycle, install, m1]
version_impact: minor
summary: "Mount the delivered daemon lifecycle family in the production entrypoint and prove every property the ticket actually asks for: `daemon` becomes prompt-required with an unconditional runtime, a bare start re-enters the running entry path as a detached child whose environment is the composing `PATH`, `HOME` (or `USERPROFILE`), and a set working-name override beneath the authoritative `<PREFIX>_STATE_DIR` binding written last, and whose success is a durable `acquired` instance (never the child's output), a foreground start owns its lifetime through the injected signal host (SIGTERM → drain, SIGINT → immediate, listeners removed in a `finally`, start snapshot returned at exit), one `resolveStateDirectoryScope` value drives the store, lock, settings, socket, supervisor scope, re-entry binding, unit, and read side — an absolute override wins, else the home default applies only when a home exists, else the directory is unresolvable and the family stays mounted over an unavailable runtime that returns the delivered `config.value.invalid` at exit `1`, opening no store, lock, socket, transport, or supervisor path and touching no root-level directory — the delivered unix transport is composed at the resolved socket path, `QueueComposition.degraded` becomes a per-projection resolver over durable instance+heartbeat records (live with an owning heartbeat strictly below the bound ⇒ `[]`, released/absent/at-or-beyond-bound/torn/unowned ⇒ `[\"daemon-unreachable\"]`) instead of the hardcoded constant, the composing pid is recorded and a non-positive recorded pid is refused before any signal call (zero signal calls, so no process group can be addressed), and `daemon install` writes `${brand.binaryName}-daemon.service` under `XDG_CONFIG_HOME` or `<home>/.config` with the absolute entry path as `ExecStart` and the exact `<PREFIX>_STATE_DIR` binding, classifying an unsupported supervisor with no unit left behind. 50 acceptance criteria (44 capability + 6 NFR) are bound to 55 test cases, every case carries an explicit planned file path with new-versus-update status, the negative and refusal paths are proven as absences with call counters rather than by a passing happy path, and the additive contract is proven by byte-identical array-valued `degraded` output, an unchanged error table, an unchanged STATE_SCHEMA_VERSION, unchanged help/version purity, and `--help` for all five subcommands. One case is integration-marked (a bounded real `#!/usr/bin/env bun` detached re-entry smoke inside a temp root) and one is a manual Linux user-manager verification; every other proof is deterministic over injected ports with no socket, no real signal, and no sleep."
links:
  change_spec: ./chg-GH-286-spec.md
  implementation_plan: ./chg-GH-286-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Mount the daemon lifecycle command in the entrypoint (start/stop/status/install)

## 1. Scope and Objectives

This change mounts an already-delivered command family, so the risk is not that the engine breaks — it is that the mount looks done while one of six independent facts is false. The tests must therefore protect six properties at once, and each one is proven as a structural or durable fact rather than an impression. **First, the mount is unconditional.** `daemon` joins `PROMPT_REQUIRED_COMMANDS` and the production composer supplies a runtime on every path, because `selectPromptRequiredProgram` throws when a prompt-required command is missing; a conditionally registered family would turn every CLI invocation into the `fallback.internal` containment. An absent entry path, signal host, or supervisor must degrade one start or install shape and never remove the command (`TC-DAEMON-010`, `TC-DAEMON-014`, `TC-DAEMON-032`, `TC-DAEMON-104`). **Second, residency is a durable fact, not a return.** A bare `start` spawns the running entry path with the composing `PATH`, `HOME` (or `USERPROFILE`), and a set working-name override beneath the authoritative state-directory binding written last, and reports success only after a durable `acquired` instance exists; the environment is exactly that declared set, so a `#!/usr/bin/env bun` entry resolves the same interpreter the parent used, a caller that stripped `PATH` fails closed as `daemon.state-recovery-failed` at exit `2` instead of being repaired, and a caller with no home and no override receives the unavailable runtime's `config.value.invalid` at exit `1` instead of a root-level directory (`TC-DAEMON-030`, `TC-DAEMON-031`, `TC-DAEMON-040`, `TC-DAEMON-041`, `TC-DAEMON-054`). A readiness timeout is a classified failure that appends nothing and claims nothing (`TC-DAEMON-031`). A foreground start owns its lifetime: `SIGTERM` drains, `SIGINT` stops immediately, both listeners are removed in a `finally`, a failed release still terminates the loop, a second signal cannot produce a second stop, and the snapshot captured at start is what the command returns (`TC-DAEMON-033`..`TC-DAEMON-038`).

**Third, one state directory, or none of the identities agree.** The production composition resolves its directory through `resolveStateDirectoryScope` and uses that one value for the store, the daemon lock, the resolved daemon settings, the control socket, the supervisor scope, the re-entry environment, and the queue/lanes read side; the detached child, whose environment is rebuilt, resolves the same value from the same variable — written last, so the forwarded `PATH`, home, and working-name override cannot influence it — and the installed unit binds that variable to that directory. Two resolutions would put the ledger, the lock, and the socket in different places — the "works in tests, writes to the wrong ledger" class of failure this story exists to remove (`TC-DAEMON-050`..`TC-DAEMON-053`). **Fourth, degradation becomes a derived fact in both directions.** `QueueComposition.degraded` accepts a resolver and is resolved at every projection — the schedule read, the mutation outcome, the lanes read, and each watch iteration — from the latest instance operation plus a heartbeat that belongs to it and is strictly within the configured lock staleness. The proof is bidirectional and adversarial: a live fresh instance must yield `[]` (`TC-DAEMON-070`), a released or immediate-stopped instance, an absent instance, and a heartbeat at or beyond the bound must each yield `["daemon-unreachable"]` (`TC-DAEMON-071`..`TC-DAEMON-073`), a watch must flip within one iteration in both directions (`TC-DAEMON-074`), a torn or unreadable read must degrade rather than assert (`TC-DAEMON-076`), an unowned heartbeat must degrade while the delivered status fold calls it `running` — the one declared divergence, named rather than smoothed over (`TC-DAEMON-078`) — and the read must not gain a socket, a process probe, or a sleep (`TC-DAEMON-120`).

**Fifth, the pid is real and the stop fails closed.** The composing pid is recorded so an instance carries the process that actually acquired the lock, and a cross-process `stop` refuses any durable record whose pid is not a positive integer with the delivered recovery identity and **zero** process-port signal calls — because the engine's `0` fallback addresses the caller's own process group. The refusal is proven by a call counter, not by an exit code alone (`TC-DAEMON-090`..`TC-DAEMON-092`). **Sixth, the change stays additive.** No exported signature narrows; `DaemonComposition` and `ProductionCompositionFacts` gain only optional inputs; `QueueComposition.degraded` widens to a union whose array member is byte-identical; the command definition, its grammar, its envelopes, the error table, and `STATE_SCHEMA_VERSION` are untouched. The additive half is proven by controls that must pass **unmodified** plus equality oracles that would fail on a reworded payload (`TC-DAEMON-110`..`TC-DAEMON-114`).

The plan is deliberately adversarial about the failure modes the ticket names. **False green from a returning child**: a `start` that reports success without a durable `acquired` instance must fail (`TC-DAEMON-031`), and the readiness oracle reads the store, never the child's streams. **Permanent honesty about a dead daemon**: a hardcoded `["daemon-unreachable"]` would still pass a one-directional test, so the live direction is asserted first and a source-level mutant re-hardcoding the marker must be caught (`TC-DAEMON-070`, `TC-DAEMON-077`). **Process-group signalling**: a refusal test that only checks the exit code can pass while the signal was already sent, so the assertion is `signal` called zero times (`TC-DAEMON-091`). **A unit that cannot start**: an install test that only checks the file exists can pass with a bare `ExecStart` under the state directory, so the oracle parses the rendered unit's `ExecStart` and `Environment=` lines and asserts the absolute entry path and the resolved directory (`TC-DAEMON-100`, `TC-DAEMON-101`). **A degraded guard**: adding `daemon` to the prompt-required set without a reference page, a coverage inventory row, and a doc-conformance page entry fails three guards at once, so the guard fixtures and the conformance page list are updated in the same phase as the mount (`TC-DAEMON-013`).

This document is a verification map, not an execution claim: no command was run against a new implementation at authoring time. Where delivery owns a name (a helper module, a private function, a payload field beyond the ones the specification pins), the scenario asserts the declared property through the public composition or the injected port and names the seam, never a guessed spelling. All 50 acceptance criteria are covered; there are no TODO rows, no orphan cases, and no open questions.

### 1.1 In Scope

- The `daemon` prompt-required membership, the unconditional production runtime, the reachable lifecycle handlers, and the `fallback.internal` containment that must not fire (F-1; AC-F1-1, AC-F1-5, AC-F8-4).
- The help inventory addition (family entry plus one entry per subcommand), the `daemon` reference page's five-section help coverage, root `--help` listing membership, and the two guard fixtures plus the doc-conformance page list (F-1; AC-F1-2..AC-F1-4, DM-6).
- Detached re-entry: the spawn request's entry path, argument vector, and the declared environment set (authoritative state-directory binding written last, plus the composing `PATH`, `HOME`/`USERPROFILE`, and a set working-name override); a `#!/usr/bin/env bun` entry starting from that environment and resolving the forwarded interpreter; the split fail-closed outcomes for a caller that stripped `PATH` (exit `2`) and for a caller with no home and no override (exit `1`); the durable readiness poll (20 × 50 ms); the start receipt's provenance from durable state (F-2, F-3; AC-F2-1, AC-F2-2, AC-F2-10, AC-F3-2, AC-F3-5; DM-1, DM-5; EVT-1).
- The signal-owned foreground lifetime: readiness snapshot capture, `SIGINT`/`SIGTERM` listeners, the resident loop, mode selection by first signal (`drain`/`immediate`), listener removal in a `finally`, cancellation-first termination, the returned snapshot, the double-signal single-stop rule, and the no-signal-host embedder shape (F-2, F-6; AC-F2-3..AC-F2-9; DM-2).
- Cross-process `stop`: drained-lane detach evidence, the `draining` vs `noop` split, the refusal of a non-positive recorded pid before any signal, and the signal-target assertions (F-6; AC-F2-7, AC-F6-2, AC-F6-3; EVT-3).
- One state-directory scope across the parent, the detached child, the installed unit, the store, the lock, the socket, the supervisor scope, and the read side, including the invalid-override path that must not suppress the mount and the unresolvable outcome (no override, no home) that keeps the family mounted over an unavailable runtime refusing at exit `1` while opening nothing (F-3; AC-F3-1..AC-F3-5; DM-5, DM-6).
- The composed control plane: settings resolved through the delivered resolver over the resolved directory (empty-branch fallback), the delivered unix transport at the resolved socket path, the ownership predicate, `status --live` reachability and freshness classification, and the plain-status probe that reports reachability and stays a degraded success (F-4; AC-F4-1..AC-F4-4; NFR-6).
- The degradation resolver: the array-or-function union, per-projection resolution (schedule, mutation outcome, lanes, watch iteration), the durable reachability predicate (owning instance, heartbeat strictly below the bound), both directions of the marker, agreement with the status fold on owned cells, the declared unowned-heartbeat divergence, and the torn-read fail-closed path (F-5; AC-F5-1..AC-F5-8; DM-3, DM-4; NFR-3).
- The composing pid and its propagation to the instance record, plus the fail-closed refusal with zero signal calls (F-6; AC-F6-1..AC-F6-3; DM-1; EVT-1; NFR-8).
- Install identity: the brand-derived unit name, the absolute entry path, the configuration-root selection, the state-directory binding, unit enable, linger enable, the receipt descriptor, the unsupported-supervisor classification with rollback, the ownership-scoped uninstall, and the no-entry-path refusal (F-7; AC-F7-1..AC-F7-5; DM-6).
- The additive contract and non-regression: unchanged error table, unchanged `STATE_SCHEMA_VERSION`, byte-identical array-valued `degraded` output, preserved absent-`degraded` fallback, preserved help/version purity, and the delivered suites passing with only the declared mount updates (F-8; AC-F8-1..AC-F8-4, AC-NFR-1; DM-7).
- The measured NFRs: read cost and latency budget on the degradation path, foreground stop latency, status command latency and output bounds, privacy of every new value, and the idempotence triple (AC-NFR-2..AC-NFR-6; NFR-3, NFR-5, NFR-6, NFR-9, NFR-10, NFR-11).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any daemon engine, control-protocol, or record-semantics change — start/stop/tick behaviour, reconciliation, heartbeat cadence, lane records, and the instance lock are consumed unchanged (NG-1). The plan asserts the delivered semantics are preserved, never that they are re-implemented.
- [OUT] A lane executor, dispatch lane composition, or supervision cadence in the daemon. Production keeps the delivered `supervise-only` mode with `lane-executor-unavailable`; `TC-DAEMON-060` asserts that marker is distinct from `daemon-unreachable` and never used to represent reachability (NG-2, DEC-15).
- [OUT] `projects`, `events`, `attempts`, `board`, or any other M2 command (NG-3).
- [OUT] Any change to an envelope field meaning, a degraded-marker vocabulary, an error-table row, or a schema version (NG-4, DM-7).
- [OUT] A `--state-dir` flag, a daemon state-directory configuration key, or a second state-directory resolution (NG-5).
- [OUT] Multi-state-directory installs, a coordinator unit, a second OS supervisor adapter, or remote/container transports (NG-7). One unit name per user is declared and `TC-DAEMON-100` asserts the exact single name.
- [OUT] `daemon status` reporting installation truth by inspecting the supervisor; the install and uninstall receipts remain the truth (DEC-14). `TC-DAEMON-060` pins `installed: false` in the status descriptor and does not treat it as a defect.
- [OUT] Repairing an environment the caller has already destroyed. The re-entry environment forwards the composing `PATH`, `HOME`/`USERPROFILE`, and a set working-name override through one optional composition input, so `TC-DAEMON-040` asserts that exact key set and `TC-DAEMON-039` proves the shipped `#!/usr/bin/env bun` entry starts from it; a caller that strips `PATH` cannot be repaired by the spawn, and `TC-DAEMON-041` asserts the fail-closed `daemon.state-recovery-failed` at exit `2` rather than a PATH guess, while a caller that strips its home and sets no override gets the unresolvable outcome asserted by `TC-DAEMON-041` (start shape) and `TC-DAEMON-054` (family-wide shape), not a root-level directory (RSK-2, DEC-16, DEC-18).
- [OUT] Making the status fold and the degradation predicate agree on an unowned heartbeat. They intentionally do not: the predicate requires an owner, the delivered fold reports `running` for a fresh heartbeat nobody owns, and `TC-DAEMON-078` asserts the degraded marker alongside the fold's `running` state, naming the divergence. No case asserts that the two rules are equivalent outside the owned-cell domain of AC-F5-6 (DM-4, DEC-7).
- [OUT] Moving or migrating existing state when `<PREFIX>_STATE_DIR` is set. No test asserts a copy, a backfill, or a migration (NG-4, §19).
- [GAP-T1 — "no semantic change to delivered assertions" is review-attested, not machine-checkable] AC-F8-4 requires the delivered suites to pass "with only the mount-specific updates named in §8.5". The gate run proves the pass half mechanically (`TC-DAEMON-113`); the "only these updates" half is a diff-shape claim, which `.ai/rules/testing-strategy.md` assigns to review and CI PR-time gates rather than to a permanent suite. **Compensation:** the permitted update sites are enumerated by file and by changed assertion in §7 and in `TC-DAEMON-113`, and the set is derived from the delivered tree — every suite that carries the prompt-required enumeration or the family list derived from it — rather than from a sentence or a count; `@reviewer` verifies at phase 8 that no other assertion changed, and any deviation is a finding. Owner: `@reviewer`.
- [GAP-T2 — the two-process drain is proven sequentially, not concurrently] AC-F2-7 describes a second process signalling a resident daemon. The deterministic proof runs the resident handler in-process over a real temp store and the stopper over a **second store handle** to the same root, then advances the handler and re-reads; it exercises the same records and the same signal path without a real race or a sleep. The real detached form is one bounded, opt-in integration case (`TC-DAEMON-039`). No scenario relies on wall-clock ordering between two live processes.
- [GAP-T3 — absences need three observations] "No spawn", "zero signal calls", "no socket connect", "no process probe", "no sleep", "no unit written", and "nothing appended" are absences. Each is proven by (i) the seam not being reachable or being a recording fake, (ii) a zero counter on that fake, and (iii) an unchanged durable record count or directory listing — plus a source-level scan or mutant where one exists. A single passing assertion is never accepted as proof of an absence.
- [GAP-T4 — real systemd is never touched by an automated case] Install is proven through the injected supervisor port (DEC-11): the unit text is asserted from the captured write, the enable and linger commands from the recorded command list, and the rollback from the recorded sequence. An actual user-manager unit load is a manual host verification (`TC-DAEMON-105`, `Manual Only`), bounded to a temp `XDG_CONFIG_HOME` and recorded in §10. No automated suite calls `systemctl`.
- [GAP-T5 — delivery-bound names] Module paths, private helper names, export names, and field spellings the specification does not pin (`DM-1`..`DM-7` do pin the composition inputs, the union, the predicate inputs, and the identity values) are delivery-bound. Behaviour, identities, exits, closed vocabularies, ordering, bounds, and AC traceability are not. A test that cannot resolve a seam must fail naming the missing contract, never skip silently.
- [GAP-T6 — performance and latency method] NFR-3, NFR-5, and NFR-6 bounds are measured over a synthetic reference store on the reference host with an injected clock (no real sleeping), recording the environment, the iteration count, and the store shape in the test output; the degradation latency bound is a p95 against a freshly measured baseline of the same store in the same run, never a hardcoded absolute. A timing case that cannot be made deterministic enough to hold the declared bound is marked `Semi-automated` with a manual gate, not deleted or relaxed silently.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-286-spec.md`](./chg-GH-286-spec.md) v1.3 | Binding source: F-1..F-8, **50 ACs** (AC-F1-1..AC-F1-5, AC-F2-1..AC-F2-10, AC-F3-1..AC-F3-5, AC-F4-1..AC-F4-4, AC-F5-1..AC-F5-8, AC-F6-1..AC-F6-3, AC-F7-1..AC-F7-5, AC-F8-1..AC-F8-4, AC-NFR-1..AC-NFR-6), DM-1..DM-7, EVT-1..EVT-3, NFR-1..NFR-12, RSK-1..RSK-13, DEC-1..DEC-18, §6 flows 1-7, §11 risks, Appendix C (closed vocabularies), Appendix D (mount exit matrix), Appendix E (identity matrix), Appendix F (production composition values). v1.3 carries two qualifiers this plan asserts: AC-F7-5 is scoped to "given a resolvable state directory" (the unresolvable directory takes precedence and returns `config.value.invalid` at exit `1`), and AC-F3-4 states that the delivered edge returns no store for a non-absolute override. |
| [`TDR-0022-daemon-lifecycle-mount-and-degradation-composition.md`](../../../decisions/TDR-0022-daemon-lifecycle-mount-and-degradation-composition.md) | Binding decision record: C-1..C-8 and DC-1..DC-4 (entry-path re-entry and signal-owned lifetime, per-read durable degradation, composing pid with fail-closed stop, brand-derived install identity, one state-directory scope). DC-1's re-entry environment is read in its **2026-11-11 amendment** (state-directory binding authoritative and written last, plus the composing `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override, one optional additive input), and DC-2's **2026-11-11 amendment** pins the strict `now − beatAt < lockStalenessMs` bound (an age equal to the bound is stale). |
| [`chg-GH-286-pm-notes.yaml`](./chg-GH-286-pm-notes.yaml) | Context only: clarify-scope findings, the four routed design choices, and the specification-completion note. The specification is the source of truth. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | `bun:test` under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; suites under `tests/{structure,types,behaviour,conformance,golden,checks,boundaries}`; permanent suites assert the current tree, never a moving base branch; goldens regenerate only by an explicit command; `pnpm check` is the aggregate gate |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict typing; injected clock/randomness/environment; data-only contracts; pure domain; adapters own I/O; the error contract; injected fakes over `mock.module` |
| **Delivered composition seams under test** | `packages/cli/src/production.ts` (`createProductionComposer`, `ProductionCompositionFacts`, the hardcoded `degraded: ["daemon-unreachable"]`, the inline `<home>/<brand.stateDirectoryName>` template), `packages/cli/bin/delivery-os.ts` (`process.argv[1]`, `processId`, `signalHost`), `packages/cli/src/entrypoint.ts` (`runEntrypoint`, `selectPromptRequiredProgram`), `packages/cli/src/edge.ts` (`ConfigProgramOptions.daemon`, `QueueComposition`), `packages/cli/src/daemon-compose.ts` (`DaemonComposition` including the optional re-entry environment input, `createDaemonCommandRuntime`, the 20 × 50 ms readiness poll, the detached spawn whose `environment` object carries the authoritative state binding written last, the cross-process signal path, install/uninstall), `packages/cli/src/daemon-main.ts` (`createDaemonMainEntry`), `packages/cli/src/help.ts` (`ROOT_HELP`, `COMMAND_HELP`, `entry(...)`, `allHelpEntries`, `helpEntryFor`), `packages/cli/src/help/prompt-required-commands.ts` (`PROMPT_REQUIRED_COMMANDS`) |
| **Delivered core/adapters contracts consumed unchanged** | `packages/core/src/config/catalog.ts` (`resolveStateDirectoryScope`, `DAEMON_BRANCH`, `resolveDaemonSettings`), `packages/core/src/contracts/daemon.ts` (`DaemonProcessPort`, `DaemonStartData`, `DaemonStopData`, `DaemonInstallData`, `DaemonSupervisorDescriptor`, `DaemonInstanceRecord`), `packages/core/src/app/daemon-status.ts` (`readDaemonStatus`), `packages/core/src/app/daemon-supervisor.ts` (`installSupervisor`, `uninstallSupervisor`), `packages/core/src/domain/daemon-supervisor.ts` (`renderSystemdUnit`), `packages/adapters/src/daemon/supervisor.ts` (`createSupervisorAdapter`, `absentSupervisorDescriptor`), `packages/adapters/src/daemon/process.ts` (`createNodeProcessPort`), `packages/core/src/state/index.ts` (store, `createDaemonLockPort`) |
| **Guards and fixtures under test** | `scripts/checks/help-guide-coverage.ts` (`runHelpGuideCoverage`, `COVERAGE_PATH`), `tests/fixtures/help-guide/coverage.json` (`commands`, `referencePages`), `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/checks/doc-conformance.test.ts` (`PROMPT_REQUIRED_PAGES`), `scripts/checks/prompt-conformance.ts`, `scripts/checks/error-table-sync.ts`, `scripts/checks/ambient-globals.ts`, `scripts/checks/workspace-entrypoints.ts`, `scripts/checks/exports-parity.ts`, `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json` |
| **Reference page under reconciliation** | `doc/planning/oss-tooling/milestones/m1/commands/daemon.md` — its `## HELP` section must carry both `--help` and `--version` for `runHelpGuideCoverage` and `PROMPT_REQUIRED_PAGES` |
| **Precedent to mirror** | `tests/structure/coordinator-production-composition.test.ts` (GH-241: temp root, injected facts, `program.commands.<family>` defined, prompt-required membership, declared flag list) and `tests/behaviour/daemon-hermetic.test.ts` (GH-238: armed `fetch` guard plus source scans for the absence claims) |
| **Delivered suites that must keep passing** | `tests/behaviour/daemon-{lifecycle,degradation,lock,lock-concurrency,supervisor-install,watch-state-changes,polling,reconciliation*}.test.ts`, `tests/behaviour/queue-cli.test.ts`, `tests/behaviour/queue-watch.test.ts`, `tests/behaviour/lanes.test.ts`, `tests/behaviour/lanes-watch.test.ts`, `tests/behaviour/entrypoint-{help,help-coverage,help-isolation,version,composition}.test.ts`, `tests/structure/{queue-scheduling-contract,daemon-vocabulary,daemon-contract,state-contract}.test.ts`, `tests/golden/daemon-*.test.ts`, `tests/golden/{queue-list,lanes-list}.test.ts`, `tests/checks/{doc-conformance,reference-page-parity,help-guide-coverage}.test.ts` |
| **Ticket** | GitHub issue `juliusz-cwiakalski/agentic-delivery-os#286` — mount the daemon lifecycle command in the entrypoint |
| **TMPDIR caveat** | `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` — `tests/checks/ci-baseline-parity.test.ts` runs `git clone --local`, which fails on a cross-device hardlink error when `TMPDIR` is tmpfs; the canonical local gate is `TMPDIR="$PWD/tmp/tmpdir" pnpm check` |

## 3. Coverage Overview

All 50 acceptance criteria map to at least one named scenario and there are no TODO or uncovered criteria. Every TC names at least one AC; no case is an orphan. The matching is deliberately uneven in one direction only: a few criteria that fail independently across several observables are covered by more than one case (AC-F2-1/AC-F2-7 add the integration-marked real re-entry, AC-F2-10 adds the re-entry environment composition and its two split residuals — the stripped-`PATH` caller and the home-less caller, AC-F3-4/AC-F3-5 partition the invalid-override and unresolvable outcomes, AC-F4-1 adds the status-fold agreement, AC-F5-1..AC-F5-3/AC-F5-7 add the production-wiring case, AC-F5-6/AC-F5-8 partition the fold-agreement and fold-divergence cells, AC-F7-1 adds the manual host verification, AC-F8-4 names the delivered suites it protects), and no criterion is covered only by a manual case.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | `daemon` is in `PROMPT_REQUIRED_COMMANDS`, production supplies the runtime unconditionally, selection completes without the containment throw, and `daemon status` reaches the handler | TC-DAEMON-010, TC-DAEMON-014, TC-DAEMON-015, TC-DAEMON-113 | Covered |
| AC-F1-2 | Root `--help` lists the `daemon` family with a one-line summary; `daemon --help` exits `0` with usage, options, examples, exit codes, and a see-also naming the daemon page | TC-DAEMON-011 | Covered |
| AC-F1-3 | `help-guide-coverage` reports zero failures (page exists, carries `--help` and `--version`, is in both `commands` and `referencePages`), reference-page parity holds, and the doc-conformance page list includes `daemon` | TC-DAEMON-013 | Covered |
| AC-F1-4 | `<binary> daemon <start\|stop\|status\|install\|uninstall> --help` exits `0` with that subcommand's usage and options, never an unknown-flag refusal | TC-DAEMON-012, TC-DAEMON-113 | Covered |
| AC-F1-5 | A composer with no entry path, no signal host, and no injected supervisor still registers and selects `daemon` | TC-DAEMON-014, TC-DAEMON-015, TC-DAEMON-032 | Covered |
| AC-F2-1 | A bare `start` spawns the entry path as `daemon start --foreground` with the resolved state-directory binding written last plus the composing `PATH`, `HOME`/`USERPROFILE`, and a set working-name override, waits for a durable `acquired` instance, and reports a receipt whose pid/socket/heartbeat come from durable state | TC-DAEMON-030, TC-DAEMON-039, TC-DAEMON-040 | Covered |
| AC-F2-2 | A readiness timeout returns `daemon.state-recovery-failed` with the timeout detail at exit `2`, claims no success, and appends nothing | TC-DAEMON-031 | Covered |
| AC-F2-3 | With no entry path, a bare `start` runs in the invoking process, returns at readiness, stays mounted, and attempts no spawn | TC-DAEMON-032 | Covered |
| AC-F2-4 | `start --foreground` captures the snapshot, installs both listeners, advances heartbeats, drains on `SIGTERM`, appends one `released`/`releaseReason=drain`, removes both listeners, and returns the start snapshot at exit `0` | TC-DAEMON-033, TC-DAEMON-121 | Covered |
| AC-F2-5 | `SIGINT` stops with mode `immediate`, appends one `immediate-stop`, removes both listeners, exits `0`, and a later `stop` is a `noop` at exit `0` | TC-DAEMON-034 | Covered |
| AC-F2-6 | With no signal host, `start --foreground` returns the readiness receipt and starts no resident loop | TC-DAEMON-035 | Covered |
| AC-F2-7 | A second process runs `stop --mode drain`, sends `SIGTERM` to the recorded positive pid, reports `result=draining` at exit `0` without claiming completion; the resident then records `released`/`drain` and detaches delivering lanes | TC-DAEMON-036, TC-DAEMON-039 | Covered |
| AC-F2-8 | A failed release append still terminates the loop (cancellation first), removes both listeners in the `finally`, and returns the delivered state-write identity at exit `2` | TC-DAEMON-037 | Covered |
| AC-F2-9 | Two signals produce exactly one stop and exactly one terminal instance record, and no handler outlives the invocation | TC-DAEMON-038 | Covered |
| AC-F2-10 | With a non-empty `PATH`, a home directory, and a `#!/usr/bin/env bun` entry script, a bare `start` spawns a child that resolves its interpreter from the forwarded `PATH`, reaches a durable `acquired` instance within the readiness window, and records its own pid; with a home directory but no `PATH`, the child acquires nothing and the start fails closed as AC-F2-2 states with `daemon.state-recovery-failed` at exit `2`, never claiming success; with no home directory (`HOME` and `USERPROFILE` both absent or empty) and no `<PREFIX>_STATE_DIR` override, the state directory is unresolvable, no spawn is attempted, and the invocation returns the delivered `config.value.invalid` at exit `1` as AC-F3-5 states, so no directory is ever derived from an empty home | TC-DAEMON-039, TC-DAEMON-040, TC-DAEMON-041, TC-DAEMON-054 | Covered |
| AC-F3-1 | An absolute `<PREFIX>_STATE_DIR` override drives the store, lock, settings, socket, supervisor scope, and daemon composition to that one directory, and the edge's reported directory equals the composition's | TC-DAEMON-050 | Covered |
| AC-F3-2 | The spawned child receives the state-directory binding last, alongside the forwarded `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override, resolves the identical directory from that binding even when the forwarded environment carries a different value of the same name, and its `acquired` instance carries the same scope digest the parent expects | TC-DAEMON-030, TC-DAEMON-040, TC-DAEMON-051 | Covered |
| AC-F3-3 | With no override **and a home directory** the resolved directory is byte-identical to the previous `<home>/<brand.stateDirectoryName>` value | TC-DAEMON-052 | Covered |
| AC-F3-4 | A non-absolute override **with a home directory present** keeps `daemon` composed and mounted, keeps the home-based value, throws nowhere, and leaves the invalid value to the delivered resolution edge, which returns no store for that override exactly as before; the no-override-no-home outcome is AC-F3-5 | TC-DAEMON-053 | Covered |
| AC-F3-5 | With no override and no home directory (both `HOME` and `USERPROFILE` absent or empty), the `daemon` family stays registered and selectable over an **unavailable runtime**: every subcommand returns the delivered `config.value.invalid` at exit `1` (`user-validation`), the daemon composition opens no store, lock, socket, transport, or supervisor path, no `/<brand.stateDirectoryName>` root-level path is read, created, or probed, and a non-daemon command composed in the same program keeps the delivered home-based template | TC-DAEMON-054, TC-DAEMON-041, TC-DAEMON-015 | Covered |
| AC-F4-1 | A plain `status` in a new process reads durable state **and** probes the composed socket, reporting instance identity/pid/scope/acquisition time/mode, heartbeat age and interval, socket path and observed reachability, supervisor descriptor, and a `degraded` list derived from durable state at exit `0`; a live fresh instance yields empty derived markers | TC-DAEMON-060, TC-DAEMON-075 | Covered |
| AC-F4-2 | `status --live` probes the composed transport and returns `live: true` with the socket reachable and the heartbeat `running` at exit `0` | TC-DAEMON-061 | Covered |
| AC-F4-3 | With no reachable daemon, `status --live` fails closed as `daemon.socket-unreachable` (or `daemon.heartbeat-stale` when the socket answers but the beat is stale) at exit `2`, while plain `status` probes the same socket, reports it unreachable, carries `daemon-unreachable` in `degraded`, claims no live status, and exits `0` | TC-DAEMON-062 | Covered |
| AC-F4-4 | A configured socket path and heartbeat interval reach the composed runtime (observable in the status payload and in advancing heartbeat ordinals); when configuration cannot be acquired the same resolver runs over an empty branch and shipped defaults apply | TC-DAEMON-063 | Covered |
| AC-F5-1 | A live instance (`acquired` or `taken-over`) with a heartbeat belonging to it and an age strictly below the lock staleness yields `degraded: []` from both `queue list` and `lanes list` | TC-DAEMON-070, TC-DAEMON-077 | Covered |
| AC-F5-2 | A latest operation of `released` or `immediate-stop` yields `degraded: ["daemon-unreachable"]` from both reads | TC-DAEMON-071, TC-DAEMON-077 | Covered |
| AC-F5-3 | No instance record at all yields `degraded: ["daemon-unreachable"]` at exit `0` from both reads | TC-DAEMON-072, TC-DAEMON-077 | Covered |
| AC-F5-4 | An `acquired` instance whose latest heartbeat age is at or beyond the lock staleness yields `degraded: ["daemon-unreachable"]` from both reads | TC-DAEMON-073 | Covered |
| AC-F5-5 | A queue or lanes watch re-resolves at each iteration, so a start and then a release flip the marker in both directions within one iteration | TC-DAEMON-074 | Covered |
| AC-F5-6 | For a store whose latest heartbeat is owned by the instance record, or which has no heartbeat at all, no-degradation implies the status fold reports `running`, and degradation implies it reports `stale` or `stopped` — one shared bound applied as strictly-below on both surfaces | TC-DAEMON-060, TC-DAEMON-070, TC-DAEMON-073, TC-DAEMON-075 | Covered |
| AC-F5-7 | A torn or unreadable instance or heartbeat read yields `["daemon-unreachable"]`, opens no socket, raises no error identity, and fabricates nothing; an unreadable queue store still fails through its own delivered `state.*` identity | TC-DAEMON-076, TC-DAEMON-077 | Covered |
| AC-F5-8 | An unowned heartbeat (no instance record, or a latest heartbeat whose `instanceId` is not the latest instance's) with a `beatAt` strictly below the bound yields `["daemon-unreachable"]` from both reads while the delivered status fold reports `running` for the same store and instant, with the divergence named as intentional ownership-versus-liveness | TC-DAEMON-078 | Covered |
| AC-F6-1 | A production start writes an instance `pid` equal to the composing process id, a positive integer never `0`, reported by both `daemon status` and the start receipt | TC-DAEMON-090 | Covered |
| AC-F6-2 | A durable instance record whose pid is `0`, negative, or non-integer makes a cross-process `stop` return `daemon.state-recovery-failed` at exit `2` with **zero** process-port signal calls | TC-DAEMON-091 | Covered |
| AC-F6-3 | A positive pid receives `SIGTERM` for `drain` and `SIGINT` for `immediate`, that pid only, no group target; a failed signal call returns the delivered recovery identity at exit `2` | TC-DAEMON-036, TC-DAEMON-092 | Covered |
| AC-F7-1 | On Linux with a composed entry path, `install` writes `<config root>/systemd/user/<brand.binaryName>-daemon.service` with `ExecStart=<absolute entry path> daemon start --foreground` and `Environment=<PREFIX>_STATE_DIR=<resolved dir>`, enables the unit and linger, and reports `result=installed` with the descriptor at exit `0` | TC-DAEMON-100, TC-DAEMON-105 | Covered |
| AC-F7-2 | An absolute non-empty `XDG_CONFIG_HOME` puts the unit under `$XDG_CONFIG_HOME/systemd/user/`; unset, empty, or relative puts it under `<home>/.config/systemd/user/` | TC-DAEMON-101 | Covered |
| AC-F7-3 | No delivered supervisor adapter, or a linger failure, returns `daemon.supervisor-unsupported` at exit `2`, writes no unit, reports the platform evidence, and leaves nothing partially installed | TC-DAEMON-102 | Covered |
| AC-F7-4 | `uninstall` removes only the unit and ownership marker this installation created, disables linger only when it enabled it, and reports `result=uninstalled`; with nothing installed it reports `result=noop` at exit `0` | TC-DAEMON-103 | Covered |
| AC-F7-5 | **Given a resolvable state directory** and no composed entry path, `install` refuses with `daemon.state-recovery-failed` at exit `2` and writes no unit; with neither an entry path nor a state directory the unresolvable outcome takes precedence and returns the `config.value.invalid` at exit `1` of AC-F3-5 | TC-DAEMON-104, TC-DAEMON-015 | Covered |
| AC-F8-1 | No error-table row is added, removed, or reworded; every identity this change reaches is an existing row; every path exits only `0`, `1`, or `2` | TC-DAEMON-110 | Covered |
| AC-F8-2 | `STATE_SCHEMA_VERSION` is unchanged, no record kind or payload schema is added, no migration exists, and the only record-shape change is the value of `daemon.instance.pid` | TC-DAEMON-111 | Covered |
| AC-F8-3 | An array-valued `degraded` produces byte-identical `queue list`, `lanes list`, and mutation payloads; omitting `degraded` keeps the delivered `["daemon-unreachable"]` fallback | TC-DAEMON-112 | Covered |
| AC-F8-4 | The delivered daemon, queue, lanes, transport, entrypoint-help, entrypoint help coverage, parity, scheduling-contract, vocabulary, and doc-conformance suites pass with only the declared mount updates (derived from the tree: the family lists, the `daemon` absence assertions, the command enumeration, the coverage inventory rows, the conformance page list) and no semantic assertion change | TC-DAEMON-113, TC-DAEMON-010, TC-DAEMON-012, TC-DAEMON-013 | Covered |
| AC-NFR-1 | Any `--help` or `--version` performs zero state, configuration, git, network, or filesystem reads, writes nothing, and invokes no command composer | TC-DAEMON-114 | Covered |
| AC-NFR-2 | A `queue list` or `lanes list` degradation resolution performs at most two **additional** daemon-fact reads (latest instance, latest heartbeat) beyond the store reads the projection already performs, opens no socket, probes no process, sleeps zero times, and keeps p95 within 10% of the delivered baseline | TC-DAEMON-076, TC-DAEMON-120 | Covered |
| AC-NFR-3 | A foreground daemon handling `SIGTERM` stops, appends its release, and exits within 1 000 ms, with loop cancellation observed within 250 ms | TC-DAEMON-033, TC-DAEMON-121 | Covered |
| AC-NFR-4 | `daemon status` p95 ≤ 1 000 ms and `daemon status --live` p95 ≤ 2 000 ms on the reference store, with every output inside the delivered bounds | TC-DAEMON-122 | Covered |
| AC-NFR-5 | No new output, record, or error evidence carries a credential, token, prompt, transcript, diff, or repository content; the only environment value this change introduces into a contract is an absolute directory path, and the re-entry environment forwards only the composing process's own `PATH`, `HOME`/`USERPROFILE`, and working-name override | TC-DAEMON-123, TC-DAEMON-040 | Covered |
| AC-NFR-6 | A repeated install is idempotent, a stop against a released instance is a `noop` at exit `0`, and a start while an instance is live returns `daemon.already-running` at exit `1` (the delivered `user-validation` projection class for that identity) appending nothing | TC-DAEMON-124 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 010, 011, 012, 013, 014, 015, 053, 054, 104; F-2 → 030–041, 054; F-3 → 030, 036, 039, 040, 041, 050–054, 015, 090; F-4 → 060–063, 070–077; F-5 → 060, 070–078, 090; F-6 → 033–038, 060, 090–092, 124; F-7 → 100–105, 124; F-8 → 010, 014, 015, 032, 035, 052, 054, 077, 110–114.

**Decision coverage**: DEC-1/DEC-12/DEC-13 → 010–014; DEC-1 → 015; DEC-2 → 030, 032, 039, 040, 050, 100; DEC-3 → 033–038, 121; DEC-4 → 033, 035; DEC-5 → 050–054; DEC-6 → 060–063; DEC-7 → 070–078, 120; DEC-8 → 090–092, 124; DEC-9 → 100–104; DEC-10 → 100; DEC-11 → 102, 105; DEC-14 → 060; DEC-15 → 060; DEC-16 → 030, 039, 040, 041, 051, 123; DEC-18 → 041, 054.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no REST/HTTP endpoint (API-#) and adds no listener, record kind, or event. The interface surface is the CLI family, the delivered envelopes, three reused durable records, and the composition deltas.

| Element | TC ID(s) | Observable assertion |
|---|---|---|
| EVT-1 `daemon.instance` (unchanged) | TC-DAEMON-030, 031, 033, 034, 036, 038, 040, 051, 070, 071, 090 | Acquisition carries the composing pid (a positive integer, never `0`), release carries `releaseReason=drain`/`immediate`, `immediate-stop` is its own operation, and the latest operation is the first half of the reachability predicate. No new field, kind, or schema. |
| EVT-2 `daemon.heartbeat` (unchanged) | TC-DAEMON-033, 060, 061, 062, 070, 073, 075, 078 | `instanceId` plus `beatAt` are the second half of the predicate, and the `instanceId` must match the instance's identity before the freshness bound is consulted at all; the age bound is the configured lock staleness, identical to the status fold's bound, and the unowned family is where the two surfaces intentionally diverge. Ordinals advance one per interval while resident. |
| EVT-3 `daemon.lane` (unchanged) | TC-DAEMON-036 | A drain appends `detached` for every previously `delivering` lane; this change reads that evidence and appends nothing of its own. |
| DM-1 `DaemonComposition.pid?` / `signalHost?` / re-entry environment input | TC-DAEMON-030, 033–038, 040, 041, 090, 091, 092, 114 | All three inputs are optional; absent keeps the delivered behaviour (no signal lifetime, engine `0` fallback, the delivered spawn environment). The re-entry environment input carries `PATH`, `HOME`/`USERPROFILE`, and a set working-name override and is merged **beneath** the state-directory binding, which is written last and wins outright. No existing field is renamed, retyped, or made required. |
| DM-2 Foreground lifetime contract | TC-DAEMON-033, 034, 035, 037, 038, 121 | Start → snapshot → listeners → loop → first signal selects the mode → stop → listeners removed in `finally` → loop awaited → captured snapshot (or the stop failure) returned. No listener outlives the invocation; cancellation precedes the release append. |
| DM-3 `QueueComposition.degraded` union | TC-DAEMON-070–078, 112, 120 | Array or resolver; the array member and the absent fallback keep the delivered semantics; resolution happens at schedule, mutation outcome, lanes read, and every watch iteration. |
| DM-4 Reachability predicate | TC-DAEMON-070–078 | Pure function of the latest operation, the latest heartbeat's instance identity and `beatAt`, the injected now, and the configured lock staleness: reachable **iff** operation ∈ {`acquired`,`taken-over`} **and** a heartbeat exists **and** its `instanceId` equals that instance's **and** `now − beatAt < lockStalenessMs` strictly. Otherwise exactly `["daemon-unreachable"]`. The ordering matters: ownership gates freshness, so an unowned heartbeat is unreachable at any age, and the delivered fold's `running` verdict for that family is the one declared divergence (AC-F5-8). |
| DM-5 `ProductionCompositionFacts` additive facts | TC-DAEMON-030, 032, 040, 041, 050, 051, 054, 100, 104, 015 | `daemonEntry?` supplies the entry path from `process.argv[1]`; `supervisor?` is a pass-through so install is provable without a live systemd; `processId`/`signalHost` are forwarded; the re-entry environment is derived inside the composer from the injected environment record and `homeDirectory`, so no ambient read is added. The composer classifies the state-directory resolution into exactly three outcomes and composes one of two runtimes: the full runtime over the resolved directory, or — for the unresolvable outcome only — an unavailable runtime that composes no store, lock, settings, transport, socket path, supervisor scope, entry path, or pid and answers `config.value.invalid` at exit `1` (DEC-18). No existing fact changes, and no third fact is invented. |
| DM-6 Install identity values | TC-DAEMON-050, 051, 060, 100, 101, 123 | `binary` = absolute entry path; `unit` = `${brand.binaryName}-daemon.service`; `supervisorConfigDirectory` = `XDG_CONFIG_HOME` (absolute, non-empty) else `<home>/.config`; `environmentName` = the exact `<PREFIX>_STATE_DIR`; `scope` = the delivered digest of the resolved directory. The unit's environment binding stays the single state-directory variable: the re-entry environment is a spawn concern and adds no `Environment=` line, because systemd supplies its own `PATH` and `HOME`. |
| DM-7 No state-schema change | TC-DAEMON-111, 113 | `STATE_SCHEMA_VERSION` unchanged; no kind, payload, migration, or backfill added; no `daemon` configuration key added. |
| Appendix D mount exit matrix | TC-DAEMON-031, 034, 036, 037, 041, 053, 054, 060, 062, 070, 073, 090, 091, 092, 102, 104, 110, 124, 015 | Every listed outcome resolves to exactly one identity and one exit digit; a missing daemon is never an error on a state-derived surface; `daemon.already-running`, `daemon.takeover-refused`, and the unresolvable-state `config.value.invalid` exit `1` (`user-validation`), not `2`; every non-zero outcome is a delivered identity; the install-without-executable row is read with the AC-F7-5 qualifier (a resolvable state directory), and the no-directory cell is the AC-F3-5 exit `1` row. |
| Appendix E identity matrix | TC-DAEMON-050, 051, 100, 101 | The composing process, the detached child, the installed unit, the store/lock/socket, and the read side observe one directory, one entry path, one variable name, one unit name, and one scope digest. |
| Appendix F composition matrix | TC-DAEMON-030, 040, 050, 054, 060, 063, 077, 100 | Every production value named in the matrix is the value the composition actually uses: resolved store/lock/settings/restart bound, resolved directory, the unavailable runtime for the unresolvable outcome, unit, entry path, environment name, re-entry environment derived from the injected facts, config root, pid, signal host, transport and socket path, no wake, no executor, `mergeCodePath: "absent"`, durable resolver. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Help/version purity: 0 state, config, git, network, or filesystem reads; 0 writes; 0 composer invocations | TC-DAEMON-114, TC-DAEMON-011, TC-DAEMON-012 | Covered |
| NFR-2 | Composition determinism: identical brand and facts yield an identical composed program and help inventory; no ambient environment read outside the injected facts | TC-DAEMON-010, TC-DAEMON-014, TC-DAEMON-063, TC-DAEMON-113 | Covered |
| NFR-3 | Degradation read cost: ≤ 2 **additional** daemon-fact reads per projection, 0 socket connects, 0 process probes, 0 sleeps, p95 regression ≤ 10% | TC-DAEMON-076, TC-DAEMON-120 | Covered (GAP-T6) |
| NFR-4 | Start readiness: a receipt or a fail-closed outcome within 20 × 50 ms; 0 exit-`0` results without a durable `acquired` instance | TC-DAEMON-030, TC-DAEMON-031, TC-DAEMON-040, TC-DAEMON-041, TC-DAEMON-054 | Covered |
| NFR-5 | Foreground stop latency: stop + release + exit ≤ 1 000 ms, loop cancellation ≤ 250 ms | TC-DAEMON-121 | Covered |
| NFR-6 | Command latency: `status` p95 ≤ 1 000 ms, `status --live` p95 ≤ 2 000 ms, install/uninstall p95 ≤ 2 000 ms excluding the supervisor runner | TC-DAEMON-122, TC-DAEMON-100 | Covered (GAP-T6) |
| NFR-7 | Exit taxonomy: every outcome exits only `0`/`1`/`2` and every non-zero resolves to a delivered identity | TC-DAEMON-031, 037, 041, 053, 054, 060, 062, 091, 092, 102, 104, 110, 124 | Covered |
| NFR-8 | Signal safety: 0 signals to a non-positive pid, 0 signals to a process group, 0 name- or pattern-based kills | TC-DAEMON-091, TC-DAEMON-092, TC-DAEMON-123 | Covered |
| NFR-9 | Idempotence: repeated install idempotent; stop against released/absent is `noop` exit `0`; repeated start while live is `daemon.already-running` and appends nothing | TC-DAEMON-034, TC-DAEMON-103, TC-DAEMON-124 | Covered |
| NFR-10 | Privacy: 0 credentials/tokens/prompts/transcripts/diffs/repo contents in new output; the only environment value this change introduces into a contract is an absolute directory path, and the re-entry environment forwards only the composing process's own `PATH`, `HOME`/`USERPROFILE`, and working-name override | TC-DAEMON-123, TC-DAEMON-100, TC-DAEMON-040 | Covered |
| NFR-11 | Bounded output: existing envelope and human-output bounds unchanged; root listing and each help page within the delivered help bounds | TC-DAEMON-011, TC-DAEMON-012, TC-DAEMON-122 | Covered |
| NFR-12 | No new external dependency: 0 new package dependencies, 0 new listeners, 0 network egress | TC-DAEMON-110, TC-DAEMON-113 | Covered |

### 3.4 Coverage-Matrix Integrity

- **Uncovered ACs**: none (50/50 in §3.1). **Orphan TCs**: none — every TC in §5.1 names at least one AC and appears in §5.2 and §7 (55/55/55).
- **Invocation shape is partitioned by phase, and only the Phase-6 gate asserts selection.** Until Phase 6 adds `daemon` to `PROMPT_REQUIRED_COMMANDS`, `selectPromptRequiredProgram` returns the delivered 16-command set and drops extras, so any invocation through `runEntrypoint` answers `fallback.internal` at exit `2`. Every Phase 2-5 case that exercises a command is therefore `handler` (a composed program whose `daemon` command handler is invoked directly, or `runCli` with that program), and no Phase 2-5 case asserts `selectPromptRequiredProgram` or `fallback.internal`; the selection/containment half is `TC-DAEMON-015`, which runs at the Phase-6 gate (and again at Phase 8) through `runEntrypoint`. §7 states the shape per case.
- **Intentional duplicate coverage and why each duplicate fails independently:**
  - AC-F1-1 spans the prompt-required membership check, the production registration, the Phase-6 selection through the entrypoint, and the full-suite containment check because the set, the composition, the selection surface, and the containment path regress separately (`TC-DAEMON-010`, `-014`, `-015`, `-113`).
  - AC-F1-5 is a distinct criterion from AC-F1-1 because "registered with full facts" and "registered with every optional fact absent" fail independently; the second is the one that would turn a conditional mount into `fallback.internal` (`TC-DAEMON-014`).
  - AC-F2-1 and AC-F2-7 carry the same shapes in two places: the deterministic fake-port proof and one bounded real-spawn smoke. The real smoke exists because a fake port can agree with a spawn request that the real `node:child_process` adapter could never satisfy (RSK-2); it asserts only the envelope the fake also asserts (`TC-DAEMON-039`, GAP-T2).
  - AC-F2-10 is split across four cases because its three directions fail independently and its executable direction needs a real interpreter: the composition of the environment set is observable without spawning (`-040`), the real `#!/usr/bin/env bun` resolution needs a real spawn (`-039`), the stripped-`PATH` caller is a distinct fail-closed outcome at exit `2` (`-041`), and the no-home-no-override caller is a distinct unresolvable outcome at exit `1` (`-041` at the start shape, `-054` family-wide). No two of them assert different verdicts for the same fixture.
  - AC-F3-4 and AC-F3-5 partition the three state-directory outcomes instead of overlapping: `-053` owns the non-absolute override with a home present (mounted, home value kept, no store returned by the edge, exactly as before), and `-054` owns the no-override-no-home outcome (mounted, unavailable runtime, `config.value.invalid` at exit `1`, nothing opened). `-052` owns the third, no-override-with-a-home cell. No case asserts an outcome another case denies.
  - AC-F2-1, AC-F2-10 and AC-F3-2 overlap on `TC-DAEMON-040` by design: the environment set is simultaneously the re-entry contract, the interpreter-resolution input, and the reason the child lands on the parent's directory. The case asserts the key set, the ordering, and the derived-value fallback once, and each criterion reads a different part of that assertion.
  - AC-F4-1 and AC-F5-6 both read the status fold, but AC-F4-1 asserts the payload's completeness and AC-F5-6 asserts agreement of the staleness verdict between two surfaces; a complete payload can still disagree with the queue read (`TC-DAEMON-060`, `-075`).
  - AC-F5-1..AC-F5-3 and AC-F5-7 are re-asserted at the production wiring level because a correct pure resolver can be wired to a hardcoded constant; the wiring case would fail while every predicate case passes (`TC-DAEMON-077`).
  - AC-F5-6 and AC-F5-8 partition the record-set cells instead of contradicting each other: `-075` asserts agreement only where the instance owns the heartbeat or no heartbeat exists, and `-078` asserts the unowned family where the predicate degrades and the fold says `running`. `TC-DAEMON-072` keeps the orphan-heartbeat fixture as a no-fabrication guard but makes no claim about the fold, so no case asserts an outcome another case denies.
  - AC-F7-1 is proven twice: through the injected supervisor port for content and command sequence (deterministic, GAP-T4) and once manually on a real user manager for loadability (`TC-DAEMON-105`).
  - AC-F8-4 repeats the mount cases (010/012/013) because it is the criterion that says the *whole* delivered suite passes with only those updates; it is verified both per-file and as a full-suite run (`TC-DAEMON-113`).
- **Negative and refusal paths are first-class cases, not notes:** readiness timeout (`-031`), the stripped-`PATH` caller and the home-less caller's refusing runtime (`-041`, `-054`), pid-`0` stop refusal with zero signal calls (`-091`), unsupported supervisor with no unit written (`-102`), install with no entry path (`-104`), invalid non-absolute state-directory override (`-053`), torn/unreadable state reads (`-076`), uncomposed containment must not fire (`-010`, `-014`, `-015`, `-053`), and a failed release that still terminates (`-037`).
- **Both directions of degradation are asserted, never one:** live with an owning heartbeat strictly below the bound ⇒ `[]` (`-070`), released/absent/at-or-beyond-bound/torn ⇒ `["daemon-unreachable"]` (`-071`..`-073`, `-076`), the unowned family ⇒ degraded while the fold reports `running` (`-078`), and the watch flip asserts both directions inside one iteration (`-074`).
- **The staleness bound is one comparison, applied twice:** `now − beatAt < lockStalenessMs` is asserted at the boundary from the degraded side (`-073` step 2) and from the non-degraded side just below it (`-070`), so a `<=` drift fails at least one case rather than sliding between them.
- **Additive contract proofs:** byte-identical array-valued output (`-112`), unchanged error-table identities and counts (`-110`), unchanged `STATE_SCHEMA_VERSION` (`-111`), unchanged help/version purity (`-114`), and `--help` for all five subcommands (`-012`).

## 4. Test Types and Layers

All TypeScript tests use `bun:test` with `describe`/`test`; fixtures are never named `*.test.ts`. Suite paths follow the delivered tier layout. Where a path is marked **(new)** delivery creates it; where it is marked **(update)** delivery edits an existing file; where it is marked **(control)** the file must pass **unmodified** and is the proof of an additive contract.

| Layer | Runner / invocation | Location | Covers |
|---|---|---|---|
| Static / diff | `git diff --check`; changed-file naming and path review | change artifacts and touched docs | Gate precondition for every TC |
| Unit (pure predicate and rendering) | `bun test tests/behaviour/daemon-degradation-*.test.ts` importing the predicate and the unit renderer directly | the durable reachability predicate in the composition tier, `renderSystemdUnit` | TC-DAEMON-070–076, 078 (predicate cases), 100 (unit text) |
| Structure / invariant | `bun test tests/structure/daemon-production-composition.test.ts tests/structure/daemon-degradation-wiring.test.ts tests/structure/{content-inventory,error-table,state-contract,daemon-vocabulary}.test.ts` | `packages/cli/src/{production,daemon-compose,entrypoint,help}.ts`; source scans with temp-copy mutants | TC-DAEMON-010, 013, 014, 015, 077, 110, 111, 113 |
| Behaviour (CLI in-process) | `bun test tests/behaviour/daemon-*.test.ts tests/behaviour/queue-*.test.ts tests/behaviour/lanes*.test.ts tests/behaviour/entrypoint-*.test.ts` | `tests/fixtures/daemon/mount-harness.ts` (new), `tests/fixtures/state/harness.ts`, `tests/fixtures/entrypoint/programs.ts`; in-process `runEntrypoint` over temp state roots is used **only** by the Phase-6 selection/help cases (`TC-DAEMON-010` step 4, `-011`, `-012`, `-014`, `-015`, `-114`), while every Phase 2-5 case invokes a composed program's command handler directly and never depends on `daemon` being prompt-required | TC-DAEMON-010–015, 030–041, 050–054, 060–063, 070–078, 090–092, 100–104, 110–114, 120, 124 |
| Contract / additivity | `bun test tests/checks/{error-table-sync,doc-conformance,reference-page-parity,help-guide-coverage}.test.ts tests/golden/{queue-list,lanes-list,daemon-install}.test.ts` | committed fixtures and goldens | TC-DAEMON-013, 110, 111, 112, 113 |
| Golden | `bun test tests/golden/daemon-*.test.ts tests/golden/{queue-list,lanes-list}.test.ts` | committed normalized fixtures | TC-DAEMON-060, 112 |
| Type-level | `pnpm typecheck` (includes `tests/types/tsconfig.json`) | `tests/types/daemon-mount.type-test.ts` (new) | TC-DAEMON-111, 113 |
| Checks / mutants / hermeticity | `bun test tests/checks/{daemon-mutants,daemon-hermetic,daemon-privacy,exit-code-literals}.test.ts` | temp-copy mutants, armed guards | TC-DAEMON-077, 110, 114, 123 |
| Boundaries | `bun test tests/boundaries`; `pnpm check:boundaries` | production `.dependency-cruiser.cjs`, ambient-globals AST guard, workspace entrypoints, fixture-coverage meta-check | TC-DAEMON-113 |
| Performance | `bun test tests/behaviour/daemon-{degradation-read-cost,status-performance,foreground-stop-latency}.test.ts` | synthetic reference store; injected clock; p95 over declared iterations with the environment recorded | TC-DAEMON-120, 121, 122 |
| Integration (bounded, real child) | `bun test tests/conformance/daemon-mount/real-reentry.test.ts` | temp-rooted real detached spawn of a `#!/usr/bin/env bun` fixture entry; hard timeout; reaped in `finally` | TC-DAEMON-039 |
| Manual (host) | phase-9 operator verification on a Linux host with a live user manager | temp `XDG_CONFIG_HOME`; record in §10 | TC-DAEMON-105 |

**Layer rules that bind every TC** (mirroring the delivered suite discipline):

1. **Hermetic by construction.** Production modules are imported and fakes injected. No suite reads a real user state directory, an ambient `HOME`, `process.env`, or `Bun.env`; no suite opens a real socket, sends a real signal, or installs a real unit. A suite that cannot resolve an injection seam fails naming the missing contract.
2. **One injected state seam.** Every durable read and write goes through the delivered `StateStorePort` over a `mkdtemp` root with a fixed clock and deterministic fence/identity tokens (`tests/fixtures/state/harness.ts`). Process-boundary durability is proven by closing the writer handle and reopening a fresh handle over the same root (GAP-T3), never by a second OS process.
3. **One injected process seam.** The delivered `DaemonProcessPort` is the only process boundary: `spawnDetached`, `signal`, `isAlive`, and `startTimeMs` are recording fakes. The default suite asserts zero real `spawn`, zero real `kill`, and zero `process.kill` calls. The re-entry environment is asserted from the recorded request, never read from the test process's own `process.env`: the harness injects an environment record and the case asserts the request is exactly the declared set derived from it.
4. **One injected supervisor seam.** `SupervisorPort` (DM-5) is a recording fake that captures the unit path and content, the enable and linger commands, the disable and remove calls, and the injected failures (unknown platform, linger failure). No automated case calls `systemctl` (GAP-T4).
5. **Fixed facts.** Brand, clock, composing pid, ids, config branches, environment records, and home directories are injected and constant per case. `Date.now`, `Math.random`, `performance.now`, and timers are forbidden in the resolver and the composition's decision path; timing cases use an injected clock for ordering and a bounded real stopwatch only for the wall-clock bound.
6. **Temp roots only, under the repo tree.** Every filesystem-touching case creates its root with `mkdtemp` under `$REPO_ROOT/tmp/` (the shape the delivered suites already use) or `tmpdir()` where the existing suite does, sets `HOME`, `XDG_CONFIG_HOME`, and `<PREFIX>_STATE_DIR` inside it, and removes it in `afterEach` including on failure. A guard rejects any root equal to `process.cwd()`, the real user state directory, or the real `$HOME`.
7. **No moving-base diff.** Every assertion reads the current tree, a committed fixture, a temp copy, or a recorded invocation. The "only these updates" half of AC-F8-4 is a review-time diff check, declared as GAP-T1, never a permanent branch-diff assertion.
8. **Exact counts stay exact.** Where a guard asserts a count (prompt-required membership, help entry count, coverage inventory entries, error-table entries), the expected value is updated exactly; `toBeGreaterThan` never replaces a closed expectation.
9. **Absences get three observations.** A zero signal count, a zero spawn count, an absent unit, an unchanged record count, and a "no socket" claim each need the fake's zero counter, an unchanged durable or filesystem observation, and a source scan or mutant where one exists (GAP-T3).
10. **Two composition shapes, never a third production fact.** A case states which composition it exercises. **Production composer** cases call `createProductionComposer` with only the facts that type declares (the two new optional facts are `daemonEntry?` and `supervisor?`; `processId`, `signalHost`, `environment`, `cwd`, `homeDirectory`, and `workingName` already exist). **Directly composed** cases call `createDaemonCommandRuntime` with the delivered `DaemonComposition` fields — including the existing `processPort?`, `transport?`, `clock?`, `store`, `platform?`, and `supervisor?` — and therefore prove the runtime contract, not the composer's wiring. Where a case needs both a production-composition fact and an injected I/O seam, it composes both from the **same** facts and asserts the two agree; it never routes an undeclared field through the production composer, and it never invents a third production fact (§7 states the shape per case).

## 5. Test Scenarios

TC IDs use the `DAEMON` feature prefix. Sequence blocks are intentional and follow the capability order of the specification: `01x` mount, prompt-required membership, help, and reference coverage, with `015` appended for the Phase-6 selection/containment gate; `03x` detached start, readiness, foreground lifetime, and cross-process stop, with `040`/`041` appended to that block for the re-entry environment (composition and the two split residuals) and `039` the one integration-marked real spawn; `05x` the single state-directory scope, with `054` appended for the unresolvable-runtime outcome; `06x` the composed control plane and status; `07x` degradation resolved from durable state, with `078` appended for the unowned-heartbeat family; `09x` the composing pid and fail-closed stop; `10x` install and uninstall identity; `11x` the additive contract and non-regression; `12x` the measured NFRs. New sequences append at the end of their block; no ID is reused for a different scenario.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-DAEMON-010 | `daemon` is prompt-required, production composes it unconditionally, and `daemon status` reaches the handler | Happy Path | Critical | High | AC-F1-1, AC-F8-4; F-1; NFR-2 |
| TC-DAEMON-011 | Root `--help` lists the family and `daemon --help` renders the five sections with a see-also pointer | Happy Path | Critical | High | AC-F1-2; F-1; NFR-1, NFR-11 |
| TC-DAEMON-012 | Every daemon subcommand answers `--help` at exit `0` instead of an unknown-flag refusal | Happy Path | Critical | High | AC-F1-4, AC-F8-4; F-1; NFR-1 |
| TC-DAEMON-013 | The help, parity, and conformance guards pass with the daemon page and its inventory rows | Happy Path | Critical | High | AC-F1-3, AC-F8-4; F-1; DM-6 |
| TC-DAEMON-014 | A composition missing every optional input still registers and selects `daemon` | Edge Case | Critical | High | AC-F1-5, AC-F1-1; F-1, F-8; NFR-2 |
| TC-DAEMON-015 | Once membership lands, selection completes through the entrypoint, no `daemon` invocation is `fallback.internal`, and the nine unresolvable invocations refuse at exit `1` | Happy Path | Critical | Critical | AC-F1-1, AC-F1-5, AC-F3-5, AC-F2-10, AC-F7-5; F-1, F-3, F-8; DM-5; NFR-7 |
| TC-DAEMON-030 | A bare start re-enters the entry path with the declared environment and reports a durable receipt | Happy Path | Critical | Critical | AC-F2-1, AC-F3-2; F-2, F-3; DM-1, DM-5; EVT-1; NFR-4 |
| TC-DAEMON-031 | A readiness timeout is a classified failure that claims nothing and appends nothing | Negative | Critical | Critical | AC-F2-2; F-2; NFR-4, NFR-7 |
| TC-DAEMON-032 | With no entry path the command stays mounted and the start returns at readiness in-process | Edge Case | Critical | High | AC-F2-3, AC-F1-5; F-2, F-8 |
| TC-DAEMON-033 | `SIGTERM` drains a foreground daemon, records one release, removes both listeners, and returns the start snapshot | Happy Path | Critical | Critical | AC-F2-4, AC-NFR-3; F-2; DM-1, DM-2; EVT-1; NFR-5 |
| TC-DAEMON-034 | `SIGINT` stops immediately, records one `immediate-stop`, and a later stop is a `noop` | Happy Path | Critical | High | AC-F2-5; F-2, F-6; DM-2; NFR-9 |
| TC-DAEMON-035 | With no signal host the foreground start returns at readiness and starts no resident loop | Edge Case | Important | High | AC-F2-6; F-2, F-8 |
| TC-DAEMON-036 | A second process drains the resident daemon over the recorded positive pid and reports `draining` | Happy Path | Critical | Critical | AC-F2-7, AC-F6-3; F-2, F-6; EVT-1, EVT-3 |
| TC-DAEMON-037 | A failed release still terminates the loop, removes the listeners, and exits `2` with the state-write identity | Negative | Critical | Critical | AC-F2-8; F-2; DM-2; NFR-5, NFR-7 |
| TC-DAEMON-038 | A second signal produces exactly one stop and exactly one terminal record | Corner Case | Critical | High | AC-F2-9; F-2; DM-2; NFR-9 |
| TC-DAEMON-039 | **Integration-marked**: a bounded real `#!/usr/bin/env bun` detached re-entry reaches a durable `acquired` instance and is reaped | Happy Path | Important | Medium | AC-F2-1, AC-F2-7, AC-F2-10; F-2, F-3; RSK-2 |
| TC-DAEMON-040 | The re-entry environment is the authoritative state binding written last plus the composing `PATH`, home, and a set working-name override | Happy Path | Critical | High | AC-F2-10, AC-F2-1, AC-F3-2, AC-NFR-5; F-2, F-3; DM-1, DM-5; NFR-10 |
| TC-DAEMON-041 | A stripped-`PATH` caller with a home fails closed at exit `2`, and a caller with no home composes the refusing runtime at exit `1` | Negative | Critical | High | AC-F2-10, AC-F3-5; F-2, F-3; DM-5; NFR-4, NFR-7 |
| TC-DAEMON-050 | One resolved directory serves the store, lock, settings, socket, supervisor scope, and composition | Happy Path | Critical | Critical | AC-F3-1; F-3; DM-5, DM-6; Appendix E |
| TC-DAEMON-051 | The detached child resolves the identical directory from the authoritative binding whatever else it receives, and records the same scope | Happy Path | Critical | Critical | AC-F3-2; F-3; DM-5, DM-6; EVT-1 |
| TC-DAEMON-052 | With no override the resolved directory is byte-identical to the previous home default | Regression | Critical | High | AC-F3-3; F-3, F-8 |
| TC-DAEMON-053 | A non-absolute override keeps the command mounted, keeps the home value, and throws nowhere | Negative | Critical | Critical | AC-F3-4; F-1, F-3, F-8 |
| TC-DAEMON-054 | An unresolvable state directory keeps the family mounted over an unavailable runtime that refuses every subcommand at exit `1` and opens nothing | Negative | Critical | Critical | AC-F3-5, AC-F2-10; F-1, F-3, F-8; DM-5; NFR-7 |
| TC-DAEMON-060 | A plain status in a new process probes the socket and reports the full durable projection with derived markers | Happy Path | Critical | Critical | AC-F4-1, AC-F5-6; F-4, F-5; EVT-1, EVT-2; DEC-14, DEC-15 |
| TC-DAEMON-061 | `status --live` against a resident daemon returns the live envelope at exit `0` | Happy Path | Critical | High | AC-F4-2; F-4; NFR-6 |
| TC-DAEMON-062 | `status --live` fails closed while a plain status stays a degraded success | Negative | Critical | Critical | AC-F4-3; F-4; NFR-7 |
| TC-DAEMON-063 | The configured socket path and heartbeat interval reach the composed runtime, with an empty-branch fallback | Corner Case | Important | High | AC-F4-4; F-4; DM-6; NFR-2 |
| TC-DAEMON-070 | A live acquired instance with a matching fresh heartbeat yields `degraded: []` on both reads | Happy Path | Critical | Critical | AC-F5-1, AC-F5-6; F-5; DM-3, DM-4 |
| TC-DAEMON-071 | A released or immediate-stopped instance yields `["daemon-unreachable"]` on both reads | Happy Path | Critical | Critical | AC-F5-2; F-5; DM-4; EVT-1 |
| TC-DAEMON-072 | An absent instance yields `["daemon-unreachable"]` at exit `0` on both reads | Edge Case | Critical | High | AC-F5-3; F-5; DM-4 |
| TC-DAEMON-073 | A heartbeat at or beyond the lock staleness yields `["daemon-unreachable"]` on both reads | Edge Case | Critical | Critical | AC-F5-4, AC-F5-6; F-5; DM-4; EVT-2 |
| TC-DAEMON-074 | A watch flips the marker in both directions within one iteration | Corner Case | Critical | High | AC-F5-5; F-5; DM-3 |
| TC-DAEMON-075 | The degradation verdict and the status heartbeat fold share one strictly-below bound on every owned cell | Corner Case | Critical | High | AC-F5-6, AC-F4-1; F-4, F-5; DM-4 |
| TC-DAEMON-076 | A torn or unreadable read degrades, opens no socket, and raises no error identity | Negative | Critical | Critical | AC-F5-7, AC-NFR-2; F-5; DM-3, DM-4; NFR-3 |
| TC-DAEMON-077 | Production supplies the durable resolver; the hardcoded marker is gone and cannot return | Negative | Critical | Critical | AC-F5-1, AC-F5-2, AC-F5-3, AC-F5-7; F-5; DEC-7 |
| TC-DAEMON-078 | An unowned heartbeat degrades while the delivered fold reports `running`, and the divergence is named | Corner Case | Critical | Critical | AC-F5-8; F-5; DM-3, DM-4; EVT-2 |
| TC-DAEMON-090 | A production start records the composing pid, and both surfaces report it | Happy Path | Critical | Critical | AC-F6-1; F-6; DM-1; EVT-1 |
| TC-DAEMON-091 | A non-positive recorded pid refuses the stop and makes zero signal calls | Negative | Critical | Critical | AC-F6-2; F-6; NFR-8 |
| TC-DAEMON-092 | A positive pid receives the correct signal, that pid only, and a failed call is classified | Negative | Critical | Critical | AC-F6-3; F-6; NFR-8, NFR-9 |
| TC-DAEMON-100 | Install writes the brand-derived unit with the absolute entry path and the resolved binding | Happy Path | Critical | Critical | AC-F7-1; F-7; DM-6; NFR-6, NFR-10 |
| TC-DAEMON-101 | The configuration root is `XDG_CONFIG_HOME` when absolute, otherwise `<home>/.config` | Corner Case | Critical | High | AC-F7-2; F-7; DM-6 |
| TC-DAEMON-102 | An unsupported supervisor or a linger failure writes no unit and leaves nothing partial | Negative | Critical | Critical | AC-F7-3; F-7; NFR-7 |
| TC-DAEMON-103 | Uninstall removes only its own artifacts, and an absent install is a `noop` | Happy Path | Important | High | AC-F7-4; F-7; NFR-9 |
| TC-DAEMON-104 | Install without an entry path refuses and writes no unit | Negative | Critical | High | AC-F7-5; F-7, F-1; NFR-8 |
| TC-DAEMON-105 | **Manual**: a real user manager loads and enables the rendered unit, inside a temp config root | Manual | Important | Medium | AC-F7-1; F-7; GAP-T4 |
| TC-DAEMON-110 | The error table is unchanged, every reached identity exists, and exits stay in `{0,1,2}` | Happy Path | Critical | Critical | AC-F8-1; F-8; NFR-7, NFR-12 |
| TC-DAEMON-111 | The state schema, record kinds, and payload schemas are unchanged | Happy Path | Critical | High | AC-F8-2; F-8; DM-7 |
| TC-DAEMON-112 | An array-valued `degraded` stays byte-identical and the absent fallback still applies | Regression | Critical | Critical | AC-F8-3; F-8; DM-3 |
| TC-DAEMON-113 | The delivered suites pass with only the declared mount updates | Regression | Critical | Critical | AC-F8-4, AC-F1-1, AC-F1-4; F-8; GAP-T1 |
| TC-DAEMON-114 | Help and version purity is unchanged for the mounted family | Regression | Critical | Critical | AC-NFR-1; NFR-1 |
| TC-DAEMON-120 | The degradation path stays within its read, socket, probe, sleep, and latency budget | Happy Path | Important | High | AC-NFR-2; NFR-3 |
| TC-DAEMON-121 | A foreground stop lands inside 1 000 ms with cancellation inside 250 ms | Happy Path | Important | High | AC-NFR-3, AC-F2-4; NFR-5 |
| TC-DAEMON-122 | Status and live-status latency and output bounds hold | Happy Path | Important | High | AC-NFR-4; NFR-6, NFR-11 |
| TC-DAEMON-123 | No new output carries sensitive content and the only new value is an absolute path | Negative | Critical | Critical | AC-NFR-5; NFR-8, NFR-10 |
| TC-DAEMON-124 | Install is idempotent, stop is a `noop` when released, and a live start refuses | Regression | Critical | High | AC-NFR-6; NFR-9, NFR-7 |

### 5.2 Scenario Details

#### TC-DAEMON-010 - `daemon` is prompt-required, production composes it unconditionally, and `daemon status` reaches the handler

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F8-4, F-1, NFR-2
**Test Type(s)**: Unit, Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-production-composition.test.ts` **(new)**; `tests/behaviour/entrypoint-composition.test.ts` **(update)**; `packages/cli/src/{production,entrypoint,help/prompt-required-commands}.ts`
**Composition under test**: production composer (`createProductionComposer`) for steps 1-4 and 6; the delivered `entrypoint-composition.test.ts` fixture for step 5.
**Tags**: @backend, @cli, @composition

**Preconditions**:
- `createProductionComposer` accepts the injected facts (`environment`, `cwd`, `homeDirectory`, `workingName`) and the synthetic brand fixture.
- A temp root exists for `HOME` so the store and lock resolve inside it.

**Steps**:
1. Import `PROMPT_REQUIRED_COMMANDS` from `packages/cli/src/help/prompt-required-commands` and assert `daemon` is a member exactly once, with the set length increased by exactly one against the recorded delivered count.
2. Compose the production program over the synthetic brand and a temp `HOME`; assert `program.commands.daemon` is defined, its declared flag list is exactly `["--foreground", "--live", "--mode"]` (the delivered grammar, unchanged), and `requiresValue` is exactly `["--mode"]`.
3. Run `selectPromptRequiredProgram(program)` and assert it returns without throwing and that `daemon` is one of the selected keys; assert the `fallback.internal` containment path is never reached (no thrown error is caught by the entrypoint's containment).
4. Through `runEntrypoint`, invoke `["daemon", "status"]` over a temp state root and assert the handler runs: the exit code is a delivered digit, the payload is a `daemon` envelope (success `data` or a delivered `daemon.*` error), and the output contains neither `unknown` `argument` nor `unknown flag` text.
5. Update `tests/behaviour/entrypoint-composition.test.ts` in exactly four places, and keep every other assertion byte-identical:
   - add `daemon` to the hard-coded `EXPECTED` list (the prompt-required set grows by exactly one);
   - in the `extra registrations are dropped, not advertised` test, delete `daemon` from the first absence loop at `:73` (`for (const absent of ["state","mcp","daemon","config","doctor"])`), leaving `["state","mcp","config","doctor"]`; the four remaining names are still genuinely uncomposed, so no replacement is needed;
   - in the `an uncomposed command fails closed through fallback.internal` test, delete `daemon` from the second absence loop at `:86` (`for (const command of ["state","mcp","daemon","frobnicate"])`), leaving `["state","mcp","frobnicate"]`; the loop keeps a non-empty set of genuinely uncomposed names, so no replacement name is introduced, and the body's assertions (exit `2`, `fallback.internal`, `category: "platform"`, `retryable: false`, `consequence: "unknown"`, and the summary containing `not part of the composed`) stay byte-identical;
   - update the file's top doc comment, which currently states that "the daemon" is absent, because that sentence becomes false; it is a comment, not an assertion.
6. Non-vacuity: with a temp copy of the composer stripped of the daemon runtime, `selectPromptRequiredProgram` throws and the invocation is contained as `fallback.internal`; the mutant must fail naming the missing command.

**Expected Outcome**:
- `daemon` is prompt-required, the production composer supplies it on the ordinary path, and a real invocation reaches the lifecycle handler.
- The composition-gap containment stays a containment path, never a normal outcome.
- The only changes in `entrypoint-composition.test.ts` are the four named edits — the expected-family row, the two `daemon` absence loops at `:73` and `:86`, and the doc comment that would otherwise state a falsehood — and no other assertion changes.

**Notes / Clarifications**:
- The hard-coded flag list is asserted as an exact array: the mount must not widen the grammar (NG-1, NG-5).
- Mirror `tests/structure/coordinator-production-composition.test.ts` for the composer shape and the temp-root discipline.

#### TC-DAEMON-011 - Root `--help` lists the family and `daemon --help` renders the five sections with a see-also pointer

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, NFR-1, NFR-11
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-help.test.ts` **(update)**; `tests/behaviour/daemon-mount-help.test.ts` **(new — ships under this name; the earlier `daemon-help.test.ts` grouping name is renamed, and the delivery plan's name wins)**; `packages/cli/src/help.ts`
**Tags**: @ui, @cli, @help

**Preconditions**:
- The daemon family entry and its five subcommand entries exist in `COMMAND_HELP`.
- The synthetic brand renders as `example-product` so identity-bearing text is assertable.

**Steps**:
1. Run `--help` with a counting composer; assert exit `0`, zero composer invocations, and that the output contains `  daemon  ` with a non-empty one-line summary on the same row.
2. Add `daemon` to the family list asserted by `tests/behaviour/entrypoint-help.test.ts`; keep the existing global-flag and see-also assertions untouched.
3. Run `daemon --help`; assert exit `0` and that the output contains `Usage:`, `Options:`, `Examples:`, `Exit codes:`, and `See also:`.
4. Assert the usage line names the five subcommands (`start`, `stop`, `status`, `install`, `uninstall`) and that the options list names `--foreground`, `--live`, and `--mode` where the family entry declares them.
5. Assert the see-also targets resolve to existing files and include `doc/planning/oss-tooling/milestones/m1/commands/daemon.md` and the man page.
6. Assert the rendered length stays within the delivered help bounds (the same bound the other families are held to) and that the output contains no ANSI escape sequence.

**Expected Outcome**:
- An operator sees the family in root `--help` and receives complete, bounded help for the family.
- The see-also pointer names the page the coverage inventory will register.

**Notes / Clarifications**:
- The family renders from the delivered derivation (`allHelpEntries` → root listing); no bespoke listing code is added.

#### TC-DAEMON-012 - Every daemon subcommand answers `--help` at exit `0` instead of an unknown-flag refusal

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-4, AC-F8-4, F-1, NFR-1
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-mount-help.test.ts` **(new — ships under this name, not `daemon-help.test.ts`)**; `tests/behaviour/entrypoint-help-coverage.test.ts` **(control, derived from `allHelpEntries`)**
**Tags**: @ui, @cli, @help

**Preconditions**:
- `HELP_TUPLES` is derived from `allHelpEntries()`, so the five subcommand tuples appear automatically once the entries exist.
- A parser program built from the help model accepts the declared flags per command.

**Steps**:
1. For each of `start`, `stop`, `status`, `install`, `uninstall`, run `<binary> daemon <sub> --help`; assert exit `0`, empty stderr, and no `unknown flag` or `unexpected argument` text.
2. For each tuple, assert the five declared sections render and that the usage line begins with the subcommand's own path.
3. Assert the flags advertised per subcommand match the delivered grammar: `start` shows `--foreground`, `status` shows `--live`, `stop` shows `--mode`, `install`/`uninstall` show none beyond the global flags.
4. Assert `HELP_TUPLES` now contains six daemon tuples (family plus five subcommands) and that the tuple-derived coverage run reports zero failures.
5. Assert no state, configuration, or filesystem read occurs (a guard on the composed program's composer counter equals `0`).

**Expected Outcome**:
- All five subcommands answer help rather than refusing the flag, so the ticket's observed `unknown flag "--help"` transcript can no longer be reproduced.
- The help model remains the single source for both the family and the subcommands.

**Notes / Clarifications**:
- This case is the direct reversal of the M2 entrypoint-delta evidence; if any subcommand refuses, the mount is incomplete.

#### TC-DAEMON-013 - The help, parity, and conformance guards pass with the daemon page and its inventory rows

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, AC-F8-4, F-1, DM-6
**Test Type(s)**: Contract, Structure, Manual
**Automation Level**: Automated
**Target Layer / Location**: `tests/fixtures/help-guide/coverage.json` **(update)**; `tests/checks/doc-conformance.test.ts` **(update)**; `tests/checks/help-guide-coverage.test.ts` and `tests/checks/reference-page-parity.test.ts` **(controls, must pass unmodified)**; `doc/planning/oss-tooling/milestones/m1/commands/daemon.md` **(update, phase 7)**
**Tags**: @contract, @docs, @structure

**Preconditions**:
- The daemon reference page exists and carries a `## HELP` section naming both `--help` and `--version`.
- The coverage inventory declares `commands` and `referencePages` for every prompt-required command.

**Steps**:
1. Add `daemon` to `commands` and `doc/planning/oss-tooling/milestones/m1/commands/daemon.md` to `referencePages` in `tests/fixtures/help-guide/coverage.json`; append each entry at the end of its array. The fixture's order is **not** normative (it is intentionally unsorted today), so the rows are not sorted or deduplicated — a sortedness rewrite would be a semantic change to a delivered control (AC-F8-4).
2. Add `daemon` to `PROMPT_REQUIRED_PAGES` in `tests/checks/doc-conformance.test.ts`; leave the two pre-existing omissions (`dispatch`, `coordinator`) exactly as they are (DEC-13).
3. Run `runHelpGuideCoverage()`; assert it returns an empty failure list.
4. Run the reference-page parity suite; assert every see-also target exists and is registered, that `coverage.commands` equals `PROMPT_REQUIRED_COMMANDS` as a set, and that the `daemon` page names its command and carries `--help`.
5. Run the doc-conformance suite; assert every page in `PROMPT_REQUIRED_PAGES` carries `--help` and `--version`, including `daemon`.
6. Non-vacuity: with a temp copy of the inventory minus the `daemon` row, `runHelpGuideCoverage()` must report `daemon: missing from the coverage inventory`; with a temp copy of the page minus `--version`, it must name the page and the missing literal.

**Expected Outcome**:
- Three guards that would otherwise withhold the command now pass, and each fails by name when its row or literal is removed.
- The conformance page list covers the newly mounted family without rewriting unrelated omissions.

**Notes / Clarifications**:
- The page edit belongs to the system-specification phase, but the guard must be green before the phase-9 gate; the delivery plan sequences it accordingly.

#### TC-DAEMON-014 - A composition missing every optional input still registers and selects `daemon`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-5, AC-F1-1, F-1, F-8, NFR-2
**Test Type(s)**: Unit, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-production-composition.test.ts` **(new)**; `tests/behaviour/entrypoint-composition.test.ts` **(update)**
**Tags**: @backend, @composition

**Preconditions**:
- Three fact sets are available: full (entry path, signal host, injected supervisor), entry-only, and minimal (no entry path, no signal host, no supervisor, no process id).

**Steps**:
1. Compose with each fact set; assert in all three that `program.commands.daemon` is defined.
2. Assert `selectPromptRequiredProgram` succeeds for all three and never enters the containment branch.
3. Compose twice with the identical minimal fact set; assert the selected key set and the help inventory are deeply equal (composition determinism).
4. Assert the minimal composition passes no `daemonEntry`, no `signalHost`, and no `supervisor` into the daemon composition, so the degraded shapes are the delivered in-process start and the refusing install.
5. Non-vacuity: a temp-copy mutant that registers the family only when an entry path is present makes step 2 throw; the mutant must fail naming `daemon` and the containment identity.

**Expected Outcome**:
- No optional fact can remove the command; each absent fact degrades exactly one shape.
- Identical facts produce an identical composed program.

**Notes / Clarifications**:
- This is the criterion that makes "unconditional" testable; the mutant is the proof that the assertion is not vacuous.

#### TC-DAEMON-015 - Once membership lands, selection completes through the entrypoint, no `daemon` invocation is `fallback.internal`, and the nine unresolvable invocations refuse at exit `1`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, AC-F1-5, AC-F3-5, AC-F2-10, AC-F7-5, F-1, F-3, F-8, DM-5, NFR-7
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-production-composition.test.ts` **(new)**; `tests/behaviour/entrypoint-composition.test.ts` **(update)**
**Composition under test**: production composer (`createProductionComposer`) over two fact sets — the full facts (entry path, signal host, injected supervisor) and the unresolvable facts (`homeDirectory = ""`, no `HOME`/`USERPROFILE`, no `<PREFIX>_STATE_DIR`). Every step invokes through `runEntrypoint`; this is the only case permitted to assert the selection surface.
**Invocation shape**: `entrypoint`.
**Tags**: @backend, @cli, @composition, @entrypoint

**Preconditions**:
- `PROMPT_REQUIRED_COMMANDS` contains `daemon` exactly once (the Phase-6 membership), so `selectPromptRequiredProgram` returns a set that includes it; before that phase the same invocation answers `fallback.internal` at exit `2`, which is precisely what this case exists to assert.
- A temp state root and temp `HOME` so the full-facts program resolves inside it; the unresolvable facts use a faithful `homeDirectory = ""`.

**Steps**:
1. Compose the production program and call `selectPromptRequiredProgram(program)`; assert it returns without throwing, `daemon` is one of the selected keys, and the selected key set equals `PROMPT_REQUIRED_COMMANDS` — the extras-dropping rule is what makes a runtime-less prompt-required command observable.
2. Through `runEntrypoint`, invoke `["daemon","status"]` over the full facts; assert the outcome is never the containment: the exit code is a delivered digit and the payload is a `daemon` envelope (success `data` or a delivered `daemon.*` error) with no `fallback.internal` identity, no `category: "platform"` containment, and no "not part of the composed" summary.
3. Through `runEntrypoint`, invoke all nine unresolvable-outcome invocations over the no-home/no-override facts — `daemon start`, `daemon start --foreground`, `daemon stop`, `daemon stop --mode drain`, `daemon stop --mode immediate`, `daemon status`, `daemon status --live`, `daemon install`, `daemon uninstall` — and assert each returns `config.value.invalid`, the projected exit code `1` (`user-validation`, `not_landed`), and no success `data`, and that none of the nine is `fallback.internal` at exit `2`. `daemon install` here is the cell AC-F7-5 excludes by its "given a resolvable state directory" qualifier: with no state directory the refusal is the state-directory identity, not `daemon.state-recovery-failed`.
4. Assert the help/version surfaces stay pure through the entrypoint: `--help`, `daemon --help`, each of the five subcommand `--help` invocations, and `--version` exit `0` with zero composer invocations and zero state, configuration, filesystem, git, or network reads.
5. Assert one non-daemon prompt-required command still resolves in the same program (the control), so step 1's equality is the delivered 17-family set rather than a `daemon`-only set.
6. Non-vacuity: a temp-copy mutant that omits `daemon` from `PROMPT_REQUIRED_COMMANDS` makes step 1 fail naming `daemon`; a mutant that registers the family only when an entry path is present makes step 3 answer the containment, so the case fails naming `fallback.internal`.

**Expected Outcome**:
- After the membership lands, selection completes without the containment throw, every `daemon` invocation reaches a runtime — the full one or the unavailable one — the unresolvable outcome is the classified exit-`1` refusal, and help/version remain a pure render.

**Notes / Clarifications**:
- This case **supersedes the selection half that Phases 2-5 must not assert**. `TC-DAEMON-041` step 5, `TC-DAEMON-053` step 3, `TC-DAEMON-054` steps 1/2/5, `TC-DAEMON-063`'s production half, `TC-DAEMON-090`, and the Phase-3 install battery (`TC-DAEMON-100`/`-101`/`-103`/`-104`/`-124`, and the `TC-DAEMON-105` manual record) invoke composed handlers and make no claim about `selectPromptRequiredProgram` or `fallback.internal`; this is the only case that asserts them, and it runs at the Phase-6 gate and again at the Phase-8 gate.
- Step 3 is the entrypoint-level counterpart of `TC-DAEMON-054` step 2 (handler level): the same nine invocations, the same identity and exit digit, observed through `runEntrypoint` after membership. Neither case asserts the other's invocation shape, and neither contradicts the other's verdict.

#### TC-DAEMON-030 - A bare start re-enters the entry path with the declared environment and reports a durable receipt

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-1, AC-F3-2, F-2, F-3, DM-1, DM-5, EVT-1, NFR-4
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-start-detached.test.ts` **(new)**; `tests/fixtures/daemon/mount-harness.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` — the case must inject a recording `DaemonProcessPort` and a fake clock, and `ProductionCompositionFacts` exposes neither (the delivered `DaemonComposition` does). It does not prove the composer's wiring; `TC-DAEMON-040`/`TC-DAEMON-054` and `TC-DAEMON-010` cover that.
**Tags**: @backend, @cli, @daemon

**Preconditions**:
- A temp state root, a recording `DaemonProcessPort`, a fake `DaemonClockPort` whose `sleep` resolves immediately, and a composed runtime with `daemonEntry` set to an absolute fixture path.
- An injected environment record carrying a non-empty `PATH`, a `HOME` inside the temp root, and a working-name override variable.
- The store is empty (no instance, no heartbeat).

**Steps**:
1. Invoke `daemon start` without `--foreground`; capture the single `spawnDetached` request.
2. Assert `entry` equals the composed `daemonEntry` exactly and `args` equals `["daemon","start","--foreground"]`.
3. Assert `environment` contains the composed `<PREFIX>_STATE_DIR` key bound to the resolved state directory, and that this key is the **last** own property of the object (insertion order is the ordering evidence).
4. Assert the remaining keys are exactly the declared forwarded set derived from the injected facts — the composing `PATH`, `HOME` — with no other key present; the working-name override appears only when the injected value is set and non-empty (asserted in `TC-DAEMON-040`), and no ambient key is read from the test process.
5. Before the store contains an `acquired` instance, assert no success is returned: the poll has not resolved yet and the command has not written a receipt.
6. Append an `acquired` instance to the store from the fake child, advance one clock tick, and assert the command returns exit `0` with a receipt whose `instance.pid` equals the fake child pid, `socket.path` equals the resolved socket path, and `heartbeat.intervalMs` equals the resolved interval.
7. Assert `heartbeat.ageMs` is computed from the durable `beatAt` and the injected now, not from a literal.
8. Assert the poll used at most 20 `sleep(50)` calls and that the receipt carries `mode` from the delivered vocabulary.

**Expected Outcome**:
- The spawn request is exactly the declared shape: the running entry path, the declared argument vector, and the declared environment set with the state binding authoritative and written last.
- Success is reported only after a durable `acquired` instance exists, and every receipt value comes from durable state or the resolved settings.

**Notes / Clarifications**:
- The fake port records the request; the store is the readiness oracle. The child's streams are never consulted (GAP-T3).
- The environment set and its ordering are asserted in full by `TC-DAEMON-040`; the real-spawn counterpart that proves the interpreter resolves is `TC-DAEMON-039`.

#### TC-DAEMON-031 - A readiness timeout is a classified failure that claims nothing and appends nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-2, F-2, NFR-4, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-start-readiness-timeout.test.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` — a recording process port and a counting clock are `DaemonComposition` fields, not production facts.
**Tags**: @backend, @cli, @negative, @daemon

**Preconditions**:
- A recording process port whose `spawnDetached` returns a pid but whose fake child never writes an instance record.
- A fake clock that counts `sleep` calls.

**Steps**:
1. Invoke `daemon start`; let the fake clock advance through every poll without any instance appearing.
2. Assert the result is a failure envelope with code `daemon.state-recovery-failed` and a summary containing the readiness-timeout detail.
3. Assert the projected exit code is `2` and that no success `data` field is present in the same envelope.
4. Assert exactly 20 `sleep(50)` calls occurred and no 21st attempt was made.
5. Assert the store's instance-record count and heartbeat-record count are unchanged from before the invocation, and that no revocation or repair record was appended.
6. Run `daemon status` over the same root and assert it still reports the durable truth (absent or stale) at exit `0`, i.e. the failed start did not fabricate state.

**Expected Outcome**:
- A timeout is a classified failure with a stable identity and exit `2`.
- Nothing is appended and no success is claimed; the read side stays truthful.

**Notes / Clarifications**:
- This is the primary guard against a "returning child equals resident daemon" false green.

#### TC-DAEMON-032 - With no entry path the command stays mounted and the start returns at readiness in-process

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-3, AC-F1-5, F-2, F-8
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-start-in-process.test.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` — the recording process port proves the zero-spawn claim; the production composer cannot expose one.
**Tags**: @backend, @cli, @daemon

**Preconditions**:
- A composition with no `daemonEntry`, a recording process port, and a temp state root.

**Steps**:
1. Invoke `daemon start` without `--foreground`.
2. Assert `spawnDetached` was called zero times.
3. Assert the runtime's in-process `start` ran, returned the delivered readiness receipt, and the store now holds one `acquired` instance.
4. Assert exit `0` and that `daemon` is still registered in the composed program (the command is not dropped because the fact is absent).
5. Assert the receipt's `degraded` list contains `lane-executor-unavailable` (supervise-only) and never `daemon-unreachable`.

**Expected Outcome**:
- An absent entry path degrades only the detached start shape; the command and the in-process shape are unchanged.

**Notes / Clarifications**:
- This preserves the embedder and test shape the delivered runtime already provides.

#### TC-DAEMON-033 - `SIGTERM` drains a foreground daemon, records one release, removes both listeners, and returns the start snapshot

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-4, AC-NFR-3, F-2, DM-1, DM-2, EVT-1, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-foreground-lifetime.test.ts` **(new)**; `tests/fixtures/daemon/mount-harness.ts` **(new)**
**Tags**: @backend, @cli, @lifecycle

**Preconditions**:
- A composition with a recording signal host (capturing `once`/`removeListener` per event), a fake clock, and a temp state root with a delivering lane fixture.

**Steps**:
1. Invoke `daemon start --foreground`; assert the start snapshot is captured before the loop begins and that both `SIGINT` and `SIGTERM` listeners were installed exactly once each.
2. Advance the fake clock through three heartbeat intervals and assert three heartbeat records with contiguous ordinals.
3. Deliver `SIGTERM` to the recorded listener; assert `stop` runs with mode `drain`.
4. Assert exactly one `released` instance record with `releaseReason=drain`, and that each previously `delivering` lane has one `detached` lane record.
5. Assert both listeners were removed exactly once each and that the returned envelope is the snapshot captured at step 1 (identical `data`, exit `0`), not a post-stop recomputation.
6. Assert the loop promise settled before the command returned and that no listener remains registered on the signal host.

**Expected Outcome**:
- The foreground process owns its lifetime: the drain lands, the release is recorded once, the listeners are cleaned up, and the returned receipt is the start snapshot.

**Notes / Clarifications**:
- Latency is asserted separately by `TC-DAEMON-121`; this case asserts ordering and records only.

#### TC-DAEMON-034 - `SIGINT` stops immediately, records one `immediate-stop`, and a later stop is a `noop`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-5, F-2, F-6, DM-2, NFR-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-foreground-lifetime.test.ts` **(new)**
**Tags**: @backend, @cli, @lifecycle

**Preconditions**:
- The same harness as `TC-DAEMON-033`, with no delivering lanes.

**Steps**:
1. Start foreground, then deliver `SIGINT`.
2. Assert `stop` ran with mode `immediate` and that exactly one instance record with operation `immediate-stop` was appended.
3. Assert zero `released` records and zero `detached` lane records for this invocation.
4. Assert both listeners were removed and the command exited `0` with the start snapshot.
5. Close the writer handle, reopen a fresh handle over the same root, and run `daemon stop --mode drain`; assert `result=noop`, exit `0`, and that no signal was sent (zero `signal` calls).

**Expected Outcome**:
- `SIGINT` is the immediate path, recorded as its own operation, and the resulting state makes a later stop a noop.

**Notes / Clarifications**:
- The noop half proves the "released or absent ⇒ noop" rule at the state-derived surface, not at a cached in-process flag.

#### TC-DAEMON-035 - With no signal host the foreground start returns at readiness and starts no resident loop

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-6, F-2, F-8
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-foreground-lifetime.test.ts` **(new)**
**Tags**: @backend, @cli, @lifecycle

**Preconditions**:
- A composition with no `signalHost`, a recording clock, and a temp state root.

**Steps**:
1. Invoke `daemon start --foreground`.
2. Assert it returns the readiness receipt at exit `0` without awaiting any signal.
3. Assert the loop was not entered: zero `sleep` calls beyond the start path, zero heartbeat records after the first, and no listener registration exists.
4. Assert no `once`/`removeListener` call was recorded (the seam was not used).
5. Re-run with a signal host present and assert the loop is entered, so the difference is the host and not the flag.

**Expected Outcome**:
- An absent signal host preserves the delivered in-process shape exactly.
- The presence of the host is what installs the lifetime, so the two shapes are distinguishable.

**Notes / Clarifications**:
- This is the embedder contract the specification pins in AC-F2-6.

#### TC-DAEMON-036 - A second process drains the resident daemon over the recorded positive pid and reports `draining`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-7, AC-F6-3, F-2, F-6, EVT-1, EVT-3
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-stop-cross-process.test.ts` **(new)**
**Tags**: @backend, @cli, @daemon, @process

**Preconditions**:
- A live instance recorded with a positive pid and a delivering lane, written by a first store handle then closed.
- A second store handle over the same root and a recording process port.

**Steps**:
1. From the second handle, run `daemon stop --mode drain`.
2. Assert exactly one `signal` call with the recorded positive pid and `"SIGTERM"`, and zero calls with any other pid or signal.
3. Assert the result is `result=draining` at exit `0`, that `instance.pid` equals the recorded pid, and that the envelope claims no completed release (no `released` record exists yet).
4. Assert no second instance record was appended by the stopping process.
5. Deliver the recorded signal to the in-process resident handler, let it stop, then re-read from a fresh handle: assert one `released` record with `releaseReason=drain` and one `detached` record for the previously delivering lane.
6. Re-run `daemon stop --mode drain`; assert `result=noop` at exit `0` with zero further `signal` calls.

**Expected Outcome**:
- The drain request is `draining`, not a claim of completion; the resident then produces the release and the lane detach.
- A repeated stop is a noop with no signal.

**Notes / Clarifications**:
- The two processes are sequenced deterministically through two store handles (GAP-T2); `TC-DAEMON-039` provides the bounded real counterpart.

#### TC-DAEMON-037 - A failed release still terminates the loop, removes the listeners, and exits `2` with the state-write identity

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-8, F-2, DM-2, NFR-5, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-foreground-release-failure.test.ts` **(new)**
**Tags**: @backend, @cli, @negative, @lifecycle

**Preconditions**:
- A store fake whose instance append fails on the `released` write only (the acquisition still lands).
- A recording signal host and a loop driver whose cancellation must still be honoured.

**Steps**:
1. Start foreground; assert the acquisition landed and the loop is running.
2. Deliver `SIGTERM`; let `stop` attempt the release and fail with the delivered write-failure identity.
3. Assert the loop terminated: cancellation was observed before the release append was attempted, and the loop promise settled.
4. Assert both listeners were removed in the `finally` even on the failure path.
5. Assert the returned envelope is a failure with the delivered state-write identity and exit `2`, and that it does not contain a success `data` claiming a release.
6. Assert the store still shows the `acquired` instance (no fabricated `released`), and that a subsequent `daemon status` reports that truth at exit `0`.
7. Assert the failure path performed no retry loop: exactly one release attempt.

**Expected Outcome**:
- A failed release cannot hang the process or lie about it; the exit is a delivered identity at `2` and the durable truth is unchanged.

**Notes / Clarifications**:
- Cancellation-first ordering is the property that makes this non-blocking; it is asserted by ordering, not by a timeout.

#### TC-DAEMON-038 - A second signal produces exactly one stop and exactly one terminal record

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-9, F-2, DM-2, NFR-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-foreground-double-signal.test.ts` **(new)**
**Tags**: @backend, @cli, @lifecycle

**Preconditions**:
- A recording signal host that keeps the delivered listener until removal, so a second delivery is possible.
- A store handle for record counting.

**Steps**:
1. Start foreground and deliver `SIGTERM` twice in immediate succession (both deliveries before the loop settles).
2. Assert `stop` ran exactly once.
3. Assert exactly one terminal instance record exists (one `released` with `releaseReason=drain`) and zero `immediate-stop` records.
4. Assert both listeners were removed, and that a third delivery after removal is not observed by the command (the host has no listener).
5. Repeat with `SIGTERM` then `SIGINT`; assert the first signal's mode wins and exactly one terminal record exists.

**Expected Outcome**:
- Signals are idempotent at the lifetime boundary: one stop, one terminal record, no handler outliving the invocation.

**Notes / Clarifications**:
- The ordering of the two deliveries is fixed by the harness, so the case is deterministic.

#### TC-DAEMON-039 - **Integration-marked**: a bounded real `#!/usr/bin/env bun` detached re-entry reaches a durable `acquired` instance and is reaped

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F2-1, AC-F2-7, AC-F2-10, F-2, F-3, RSK-2
**Test Type(s)**: Integration, E2E
**Automation Level**: Automated (integration-marked)
**Target Layer / Location**: `tests/conformance/daemon-mount/real-reentry.test.ts` **(new)**; executed explicitly as `bun test tests/conformance/daemon-mount/real-reentry.test.ts`
**Composition under test**: directly composed `createDaemonCommandRuntime` with the real `createNodeProcessPort()` and the real clock — the case must not spawn through the production composer's host adapter without a reap, and the entry path is a `DaemonComposition` input.
**Tags**: @integration, @daemon, @process

**Preconditions**:
- A temp root created with `mkdtemp` under `$REPO_ROOT/tmp/`, containing `home/`, `config/`, and `state/`.
- The real `createNodeProcessPort()` (real `spawn`, real `kill`).
- A fixture entry script inside the temp root whose first line is exactly `#!/usr/bin/env bun` and which invokes the real `createDaemonMainEntry` against the temp state directory and exits on `SIGTERM`; the fixture is written with `chmod 0o755`.
- A composing environment whose `PATH` begins with the real `bun` directory (resolved from the running process's `process.execPath`) and whose `HOME` is the temp `home/`, injected as facts — the case never mutates the test process's own environment. The precondition asserts that this bun directory lies **outside** the `/usr/bin:/bin` fallback, so the interpreter proof cannot be satisfied by a system bun.
- A declared hard timeout of 20 000 ms for the whole case.

**Steps**:
1. Compose the runtime with `daemonEntry` pointing at the `#!/usr/bin/env bun` fixture entry, the injected environment record described above, and the temp state directory.
2. Record the spawn request; assert `environment` carries the state-directory binding **last**, plus `PATH` (non-empty, containing the bun directory) and `HOME` (the temp home), and that no key outside the declared set is present.
3. Invoke `daemon start` (non-foreground) with the real clock; assert the receipt reports a positive `instance.pid` and exit `0`, proving the child resolved its interpreter from the forwarded `PATH` and reached a durable `acquired` instance (a child that could not resolve `bun` would exit without writing one and the start would time out).
4. Read the child's own recorded evidence — the fixture writes its `process.env` key set, its absolute `process.execPath`, and its `process.argv[1]` into a probe file inside the temp root — and assert the key set equals the declared forwarded set (state binding, `PATH`, `HOME`, plus the working-name override only when the injected value was non-empty), that `PATH` is the forwarded value, and that the child's resolved interpreter is the `bun` binary **from the forwarded directory**: `path.dirname(process.execPath)` equals the forwarded bun directory (which the precondition asserts lies outside `/usr/bin:/bin`) and `path.basename(process.execPath)` is `bun`. A host whose system `bun` lives at `/usr/bin/bun` therefore cannot satisfy this step vacuously; a child that resolved any other interpreter fails on the directory comparison.
5. Invoke `daemon stop --mode drain` from the parent; assert `result=draining` at exit `0` and that the recorded pid matches the started pid.
6. Poll the durable store (bounded: at most 40 × 50 ms) until a `released` record with `releaseReason=drain` appears; assert it appears exactly once.
7. Assert the child process is no longer alive (`isAlive` false), and that the probe file contains no ambient value beyond the declared set — in particular no key the composing environment did not carry.
8. In `finally`, send `SIGKILL` to the recorded pid if it is still alive, remove every listener, and delete the temp root; assert the repo `git status --porcelain` is unchanged.

**Expected Outcome**:
- The real spawn path is exercised end to end inside a temp root, with the entry path, the declared environment set, the interpreter resolution, the durable readiness, the drain, and the release all observable.
- Nothing is written outside the temp root; the case cannot hang (hard timeout) or leak (reaped in `finally`).

**Notes / Clarifications**:
- This case asserts only what `TC-DAEMON-030`/`TC-DAEMON-036`/`TC-DAEMON-040` also assert with fakes; its purpose is to falsify a fake that agrees with an impossible real request (RSK-2) and to prove the shipped `#!/usr/bin/env bun` form is executable from the re-entry environment (AC-F2-10).
- The fail-closed residuals — a composing process that has already stripped `PATH`, and one with no home and no override — are `TC-DAEMON-041` and `TC-DAEMON-054`; this case never asserts a positive outcome for either environment.
- It never touches systemd, the real user state directory, the network, or `process.env` of the test process.

#### TC-DAEMON-040 - The re-entry environment is the authoritative state binding written last plus the composing `PATH`, home, and a set working-name override

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-10, AC-F2-1, AC-F3-2, AC-NFR-5, F-2, F-3, DM-1, DM-5, NFR-10
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-start-detached.test.ts` **(new)**; `tests/behaviour/daemon-state-scope.test.ts` **(new)**; `tests/fixtures/daemon/mount-harness.ts` **(new)**
**Composition under test**: both shapes from the same facts — the production composer to prove the derived environment is what the composer actually supplies, and a directly composed `createDaemonCommandRuntime` with a recording process port to capture the request (the composer's host port would really spawn). The two environments must be deeply equal (rule 10).
**Tags**: @backend, @cli, @daemon, @contract

**Preconditions**:
- Four injected environment fixtures over one temp root: (a) `PATH` and `HOME` set, working-name override unset; (b) the same plus a non-empty override; (c) `HOME` empty but `USERPROFILE` set; (d) an absolute `<PREFIX>_STATE_DIR` override whose value differs from the home default.
- A recording process port; no real spawn.

**Steps**:
1. For fixture (a), invoke `daemon start` and assert the captured `environment` key set is exactly `{ <PREFIX>_STATE_DIR, PATH, HOME }` — no `USERPROFILE`, no working-name variable, and no ambient key from the test process.
2. Assert the `<PREFIX>_STATE_DIR` key is the last own property of the environment object and that its value equals the composition's resolved state directory.
3. For fixture (b), assert the working-name variable appears exactly once with the injected value, and that the state binding is still last.
4. For fixture (c), assert `HOME` is absent, `USERPROFILE` is present with the injected value, and the state binding is last.
5. For fixture (d), assert the state binding equals the override directory, not the home default, and that the same value reaches the store the child would open (feed the captured environment through the delivered resolution, as `TC-DAEMON-051` does).
6. Assert the derived environment is a pure function of the injected facts: compose twice with identical facts and assert the two captured environments are deeply equal, and that no key came from `process.env` (arm a read guard on the ambient environment for the duration).
7. Assert the ordering is meaningful, not incidental: a mutant that writes the state binding **first** and lets a forwarded same-named value follow must fail a case naming the key order.
8. Assert the environment carries no value beyond the four declared facts — no credential, token, brand payload, or repository content (NFR-10).

**Expected Outcome**:
- The child receives exactly the declared set, derived from injected facts, with the state-directory binding authoritative because it is written last.
- The working-name override and the `HOME`/`USERPROFILE` fallback follow the declared rules rather than the caller's ambient environment.

**Notes / Clarifications**:
- This is the composition half of AC-F2-10: it proves the environment that makes the `#!/usr/bin/env bun` entry executable without spawning anything, so it stays hermetic. The real interpreter resolution is `TC-DAEMON-039`.
- Step 7 is the guard that keeps "written last" a contract rather than an artefact of object-literal ordering.

#### TC-DAEMON-041 - A stripped-`PATH` caller with a home fails closed at exit `2`, and a caller with no home composes the refusing runtime at exit `1`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-10, AC-F3-5, F-2, F-3, DM-5, NFR-4, NFR-7
**Test Type(s)**: Behaviour, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-start-env-stripped.test.ts` **(new)**; `tests/fixtures/daemon/mount-harness.ts` **(new)**
**Composition under test**: fixture (a) and fixture (c) use a directly composed `createDaemonCommandRuntime` with a recording process port and a counting clock (the spawn request and the poll count are `DaemonComposition` inputs, not production facts); fixture (b) uses the production composer, because the assertion is the composer's own three-outcome classification and no spawn is expected. All three fixtures invoke a composed command handler directly (handler shape): no step goes through `runEntrypoint` and none asserts selection or `fallback.internal`; `TC-DAEMON-015` is the entrypoint-shape counterpart at the Phase-6 gate.
**Tags**: @backend, @cli, @negative, @daemon

**Preconditions**:
- Three composing-environment fixtures over one temp root, chosen so each missing value is the one under test. The home is the **faithful** value the scenario names — never a silently injected temp home:
  - (a) no `PATH`, a `HOME` inside the temp root, no `<PREFIX>_STATE_DIR` — the state directory resolves from the home, the spawn is attempted, and the child cannot resolve `bun`;
  - (b) a `PATH`, `homeDirectory = ""` with no `HOME` and no `USERPROFILE`, no `<PREFIX>_STATE_DIR` — the state directory is **unresolvable**;
  - (c) no `PATH`, `homeDirectory = ""` (no `HOME`/`USERPROFILE`) **and** an absolute `<PREFIX>_STATE_DIR` inside the temp root — the override wins, so the runtime is full and the spawn is attempted without a `PATH`.
- A recording process port whose fake child never writes an instance record (mirroring a child that cannot resolve its interpreter), and a fake clock that counts `sleep` calls.
- A brand whose `stateDirectoryName` is unique to this run, so the root-level candidate `/<brand.stateDirectoryName>` cannot collide with an existing path; a filesystem oracle records its existence before and after each fixture.

**Steps**:
1. Fixture (a): compose and invoke `daemon start`; assert the captured `environment` carries no `PATH`, keeps `HOME` with the injected value, and carries the state binding **last** — the spawn never invents a value the caller did not have.
2. Fixture (a): assert the spawn is still attempted (the composition does not silently decide to run in-process) and that its request is well formed; let the poll exhaust; assert the result is `daemon.state-recovery-failed` at exit `2` with the readiness-timeout detail, no success `data`, and exactly 20 `sleep(50)` calls with no 21st.
3. Fixture (a): assert nothing was acquired and nothing was appended — the instance-record and heartbeat-record counts are unchanged from before the invocation, and no resource was held (zero lock acquires, zero transport connects).
4. Fixture (c): assert the spawn is attempted, the state binding is last and equals the override directory, and no `PATH` key was invented; let the poll exhaust; assert `daemon.state-recovery-failed` at exit `2` and nothing acquired or appended — the absolute override wins even with no home and no `PATH`.
5. Fixture (b): compose the production program with `homeDirectory = ""` and no override and invoke the `daemon` command's handler on that program (handler shape — no `runEntrypoint`, so this phase makes no claim about `selectPromptRequiredProgram` or `fallback.internal`); assert composition does not throw, `program.commands.daemon` is defined, and the composed daemon family is the **unavailable** runtime (no store, lock, settings, socket path, transport, supervisor scope, entry path, or pid composed). The selection/containment half of the same facts is `TC-DAEMON-015`, asserted through `runEntrypoint` at the Phase-6 gate.
6. Fixture (b): invoke `daemon start` (bare and `--foreground`) through the composed program's handler; assert `config.value.invalid` at exit `1` (`user-validation`, `not_landed`), no success `data`, and `spawnDetached` called **zero** times — no spawn is attempted because the directory never resolves.
7. Fixture (b) absence proof (GAP-T3): the supervisor fact is a recording fake and records zero calls; the store/lock/transport/process counters are not injectable through the production composer, so their absence is proven by a source scan anchored on the **local, non-exported refusing-runtime factory in `packages/cli/src/production.ts`** — the unavailable-runtime branch the plan's task 2.1(c) declares, whose `start`/`stop`/`status`/`loop`/`install`/`uninstall` handlers return the delivered `config.value.invalid` failure. The scan boundary is exactly that local factory: from its declaration to its closing brace, the branch that returns the refusing runtime. The scan asserts that boundary span constructs none of the store, lock, settings, transport, socket path, supervisor scope, entry path, or pid; it does not scan the rest of `production.ts`, and it makes no claim about the full-runtime branch. The absence is then corroborated by the filesystem and socket observations: `/<brand.stateDirectoryName>` does not exist before or after, no socket file exists at the delivered default socket path, and the listings of the temp root and the process working directory are unchanged.
8. Non-vacuity control: with `PATH` and a temp `HOME` restored on fixture (a), the same fixture start succeeds at exit `0` with a durable `acquired` instance, so the failures are caused by the stripped environment and not by the fixture.

**Expected Outcome**:
- A stripped `PATH` with a home present produces the classified recovery failure at exit `2`, never a claimed success and never a guessed interpreter.
- A caller with no home and no override produces the classified `config.value.invalid` refusal at exit `1` from the unavailable runtime, never a directory derived from an empty home and never a root-level store.
- The two residuals are distinct outcomes, each asserted on its own fixture; neither is repaired by the spawn.

**Notes / Clarifications**:
- This is the residual half of AC-F2-10 and the start shape of AC-F3-5 (DEC-16, DEC-18, RSK-2); the positive halves are `TC-DAEMON-039`/`TC-DAEMON-040`, and the family-wide AC-F3-5 sweep is `TC-DAEMON-054`. No two cases assert the same verdict for the same fixture.
- Step 8 is the control that keeps the case from passing because of a broken harness. Fixture (b)'s `homeDirectory = ""` is the scenario's actual input, not a placeholder for an injected home.

#### TC-DAEMON-050 - One resolved directory serves the store, lock, settings, socket, supervisor scope, and composition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-1, F-3, DM-5, DM-6, Appendix E
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-scope.test.ts` **(new)**
**Composition under test**: both shapes from the same facts — the production composer for the composed program and the edge-reported directory, and a directly composed `createDaemonCommandRuntime` for the observer recorder (store/lock/settings/socket/scope), because `ProductionCompositionFacts` exposes no observer seam; the two must agree character for character.
**Tags**: @backend, @composition, @state

**Preconditions**:
- An absolute override directory exists inside a temp root, distinct from `<home>/<brand.stateDirectoryName>`.
- A recording probe records every directory the composition passes to an observer (store root, lock root, settings input, transport socket directory, supervisor scope, daemon composition `stateDirectory`).

**Steps**:
1. Compose with `environment[<PREFIX>_STATE_DIR]` set to the absolute temp directory and `homeDirectory` set to a different temp directory.
2. Assert the store was opened over the override directory, the daemon lock over the override directory, and the settings resolver received the override directory.
3. Assert the composed socket path resolves inside the override directory and that the transport received the same socket path.
4. Assert the supervisor scope digest equals the delivered digest of the override directory, and that the daemon composition's `stateDirectory` equals it verbatim.
5. Assert the edge's own reported state directory (the value the CLI edge resolves for its commands) equals the composition's value, character for character — the composition does not resolve twice.
6. Assert the home-based template value appears in no observer's recorded facts.
7. Repeat with no override: assert every observer records `<home>/<brand.stateDirectoryName>` and that the two values still agree.

**Expected Outcome**:
- One value, one resolution, seven agreeing observers; the second-resolution divergence is gone.

**Notes / Clarifications**:
- The observer set is the composition's own inputs, so the assertion is about wiring rather than about a re-derived literal.

#### TC-DAEMON-051 - The detached child resolves the identical directory from the authoritative binding whatever else it receives, and records the same scope

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-3, DM-5, DM-6, EVT-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-scope.test.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` with a recording process port — the captured spawn environment is a `DaemonComposition` input, not a production fact.
**Tags**: @backend, @composition, @state

**Preconditions**:
- A recording process port that captures the spawn environment and can be programmed to run the composition's own resolution over that environment (the child's view) instead of spawning.
- An absolute override directory, an injected `PATH`, and an injected `HOME`.

**Steps**:
1. Invoke `daemon start` and capture the spawn environment.
2. Assert the environment carries the composed `<PREFIX>_STATE_DIR` key as its **last** own property, alongside the forwarded `PATH` and `HOME` and the working-name override when the injected value is non-empty; assert no key outside the declared set appears (the full set is asserted by `TC-DAEMON-040`).
3. Feed that captured environment to the delivered `resolveStateDirectoryScope` with the same brand prefix and assert the resolved value equals the parent's resolved value byte for byte.
4. Prepend a competing value: build a second captured environment in which a **forwarded** key of the same name as the state binding appears before the authoritative one and carries a different directory; assert the resolution still returns the authoritative value, so "written last" is the rule and not a coincidence of key uniqueness.
5. Have the fake child write an `acquired` instance; assert its `scope` equals the parent's supervisor scope digest and that the receipt's instance scope matches.
6. Assert the child's settings-derived socket path equals the parent's composed socket path.

**Expected Outcome**:
- The child lands on the same ledger, lock, and socket as the parent, and the provenance is the authoritative binding rather than "the only value it got".
- A forwarded look-alike value cannot displace the binding.

**Notes / Clarifications**:
- The brand-prefix agreement between parent and child now comes from the forwarded working-name override (DEC-16, RSK-6); the case asserts the shipped-default and one renamed-brand fixture, and the residual limitation is the caller's stripped environment (`TC-DAEMON-041`).

#### TC-DAEMON-052 - With no override the resolved directory is byte-identical to the previous home default

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, F-8
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-scope.test.ts` **(new)**; `tests/structure/state-scope.test.ts` **(control)**
**Composition under test**: both shapes from the same facts — the production composer proves the no-override mount, and a directly composed `createDaemonCommandRuntime` exposes the resolved `stateDirectory` value, which `ProductionCompositionFacts` does not (rule 10); the two are asserted equal.
**Tags**: @backend, @state, @regression

**Preconditions**:
- A temp `homeDirectory` with no trailing separator and an environment record with no `<PREFIX>_STATE_DIR` key.

**Steps**:
1. Compose with no override and capture the daemon composition's `stateDirectory`.
2. Assert it equals the delivered template value `${home}/${brand.stateDirectoryName}` exactly, including separator handling and the absence of a trailing slash.
3. Assert the store root the delivered edge resolves for the same facts is the identical string.
4. Repeat with a home directory that has a trailing slash and assert the normalized value is identical to case 1 (one normalization, not two).
5. Assert the pre-existing state-scope suite passes unmodified, so the delivered resolution edge keeps its contract.

**Expected Outcome**:
- An existing installation continues to read the state it already has; the change is invisible without the override.

**Notes / Clarifications**:
- This is the control that makes AC-F3-1's relocation a deliberate, disclosed behaviour change rather than a silent one (RSK-7).

#### TC-DAEMON-053 - A non-absolute override keeps the command mounted, keeps the home value, and throws nowhere

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-4, F-1, F-3, F-8
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-scope.test.ts` **(new)**
**Composition under test**: both shapes from the same facts — the production composer for "mounted and throws nowhere" and a directly composed `createDaemonCommandRuntime` for the kept home value (rule 10). The fixture carries a valid temp `homeDirectory`, as AC-F3-4 requires; the home-less cell is `TC-DAEMON-054`. **Invocation shape**: handler — the composed program's `daemon` handler is invoked directly, and the selection surface is not asserted here (`TC-DAEMON-015`, Phase-6 gate).
**Tags**: @backend, @negative, @state

**Preconditions**:
- An override value of `relative/state` (non-absolute) and a valid temp `homeDirectory`.

**Steps**:
1. Compose the production program with the invalid override.
2. Assert composition does not throw, and invoke the `daemon` command's handler on the composed program (handler shape: no `runEntrypoint`, so this phase makes no claim about selection or `fallback.internal`).
3. Assert `daemon` is registered in the composed program (`program.commands.daemon` is defined) and that the invalid override leaves the family mounted; the selection half — `selectPromptRequiredProgram` selects `daemon` — is `TC-DAEMON-015`'s at the Phase-6 gate.
4. Assert the daemon composition's `stateDirectory` equals the home-based template value (the previous behaviour is kept).
5. Assert the delivered resolution edge is unchanged for the same environment through its own public surface: it returns no store for the non-absolute override (its delivered `config.value.invalid` result), so the failure is not swallowed — it is reported where it already was — and no store is opened under the relative path.
6. Assert a normal command still runs at a delivered exit digit and that no partial store was created under the relative path.
7. Non-vacuity: a temp-copy mutant that lets the resolution failure suppress the daemon runtime must make step 3 fail.

**Expected Outcome**:
- An invalid override never removes a prompt-required command and never changes where state is written.
- The edge still returns no store for the invalid override and its own invalid result is unchanged, so the failure is not swallowed.

**Notes / Clarifications**:
- This is the exact case that would otherwise turn a user typo into `fallback.internal` on every command (RSK-5).
- The criterion is scoped to a **home present** fixture; with no home and no override the same non-absolute override is not the interesting cell — the unresolvable outcome is `TC-DAEMON-054`.

#### TC-DAEMON-054 - An unresolvable state directory keeps the family mounted over an unavailable runtime that refuses every subcommand at exit `1` and opens nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-5, AC-F2-10, F-1, F-3, F-8, DM-5, NFR-7
**Test Type(s)**: Behaviour, Structure, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-scope.test.ts` **(new)**; `tests/fixtures/daemon/mount-harness.ts` **(new)**; `packages/cli/src/production.ts`
**Composition under test**: production composer (`createProductionComposer`) — AC-F3-5 is a statement about the production composition and about every subcommand it mounts; no injected I/O seam is required because the expected behaviour is a refusal before any I/O. The absence counters that the composer does not expose are replaced by a source scan plus filesystem and socket observations (steps 6-7), never by a third production fact. **Invocation shape**: handler — each of the nine invocations runs the composed program's command handler (or `runCli` with that program), and no step asserts `selectPromptRequiredProgram` or `fallback.internal`; `TC-DAEMON-015` re-runs the same nine through `runEntrypoint` at the Phase-6 gate.
**Tags**: @backend, @cli, @negative, @state

**Preconditions**:
- Injected facts: `homeDirectory = ""` (the faithful empty value — **not** a silently injected temp home), an environment record with no `HOME`, no `USERPROFILE`, and no `<PREFIX>_STATE_DIR`, a temp `cwd`, and the synthetic brand.
- A brand whose `stateDirectoryName` is unique to this run, so the root-level candidate `/<brand.stateDirectoryName>` cannot collide with an existing path; the filesystem oracle records its existence, and the existence of the delivered default socket path, before and after each invocation.
- A recording `supervisor` fact (the one DM-5 I/O seam the composer accepts) whose counters start at zero.
- A control composition with a valid temp `homeDirectory` and the same brand, used to prove that the refusal is caused by the missing home.

**Steps**:
1. Compose the production program with `homeDirectory = ""` and no override; assert composition does not throw, `program.commands.daemon` is defined, and every other prompt-required command is still registered in the same program — the unresolvable outcome degrades the runtime, never the mount. Selection (`selectPromptRequiredProgram` returns `daemon`) and the absence of `fallback.internal` are asserted by `TC-DAEMON-015` at the Phase-6 gate, not here.
2. Invoke every subcommand's handler on the composed program (handler shape, not `runEntrypoint`): `daemon start`, `daemon start --foreground`, `daemon stop`, `daemon stop --mode drain`, `daemon stop --mode immediate`, `daemon status`, `daemon status --live`, `daemon install`, and `daemon uninstall`. For each, assert the failure identity is `config.value.invalid`, the projected exit code is `1`, the error's projection class resolves as `user-validation` with consequence `not_landed` (read from the delivered error-table row and the delivered `projectExitCode`, never a literal), and no success `data` is present.
3. Assert no spawn is attempted: `daemon start` (bare and `--foreground`) records zero `spawnDetached` calls, so the unresolvable path never reaches the readiness poll and never waits the 20 × 50 ms window.
4. Assert that a non-daemon command composed in the same program keeps the delivered home-based template: inspect the composition of `queue`/`lanes`/`status` in the same program and assert its state-directory value is the pre-change `/<brand.stateDirectoryName>` template, unchanged by this change. The non-daemon command is **not executed** in this fixture (executing it would attempt the delivered root-level path); the execution half is proven in the control composition where a home exists and the non-daemon command still resolves `<home>/<brand.stateDirectoryName>`.
5. Assert the refusal is the state-directory identity: the failure is the delivered `config.value.invalid` row — not a `daemon.*` row — so the classification is the state-directory refusal rather than a missing command. The containment half (no `daemon` invocation through `runEntrypoint` is `fallback.internal`) belongs to `TC-DAEMON-015` and is not asserted at handler level.
6. Absence proof for the daemon composition (GAP-T3): (i) the recording supervisor fact records zero write, zero enable, and zero linger calls; (ii) a source scan anchored on the **local, non-exported refusing-runtime factory in `packages/cli/src/production.ts`** — the plan's task 2.1(c) unavailable-runtime branch — covers exactly that factory's declaration through its closing brace and asserts the boundary span composes no store, lock, settings, transport, socket path, supervisor scope, entry path, or pid before returning the refusing runtime, constructing none of them on any path; the scan does not extend to the full-runtime branch of the same file, and makes no claim about it; (iii) zero signals and zero process probes are recorded.
7. Absence proof at the filesystem: `/<brand.stateDirectoryName>` does not exist before or after the run (so it was neither created nor, by construction of the scan in step 6, read or probed), no socket file exists at the delivered default socket path, and the temp `cwd` listing and the repo's `git status --porcelain` are unchanged.
8. Control — the full-runtime shape for the same five subcommands: with a valid temp `homeDirectory` and the same brand, compose the same program and run `daemon status`, `daemon status --live`, `daemon stop`, `daemon install`, and `daemon uninstall`; assert every one reaches its handler and returns a delivered envelope (`daemon.*` success or failure, never `config.value.invalid`), and run one non-daemon command (`status`) to assert it still resolves `<home>/<brand.stateDirectoryName>`, so the refusal in step 2 is attributable to the unresolvable directory rather than to the fixture or the command surface. `daemon start` is excluded from the control only because it would spawn or block; its full-runtime shape is `TC-DAEMON-030`/`TC-DAEMON-032`.
9. Non-vacuity: a temp-copy mutant that keeps `${homeDirectory}/${brand.stateDirectoryName}` for the unresolvable branch (composing a root-level `/<brand.stateDirectoryName>` store) makes step 2 return a `state.*` identity or step 7 find the root-level directory; the mutant must fail naming the root-level path.

**Expected Outcome**:
- An empty home and no override is a classified `user-validation` refusal at exit `1` for all five subcommands, while the same five subcommands in the full-runtime shape reach their handlers; the family stays mounted and registered in both shapes (selection through the prompt-required set is `TC-DAEMON-015`'s at the Phase-6 gate).
- Nothing is opened, spawned, signalled, or written; no root-level state directory is derived from an empty home; a non-daemon command in the same program keeps its delivered template.
- The three state-directory outcomes never collide: `TC-DAEMON-052` (home), `TC-DAEMON-053` (non-absolute override with a home), `TC-DAEMON-054` (no override, no home).

**Notes / Clarifications**:
- This is the family-wide shape of AC-F3-5 (DEC-18, DM-5, Appendix D/F); `TC-DAEMON-041` asserts the same outcome at the `start` shape and additionally proves the stripped-`PATH` residual at exit `2`. Neither case asserts the other's verdict for the other's fixture.
- The exit digit is **projected** from the delivered `config.value.invalid` row's `user-validation` class through `projectExitCode` (`packages/cli/src/projection.ts`), never authored, which is why the assertion is `1` and not the `2` of the recovery-class failures (`daemon.state-recovery-failed`).
- The unquoted-`Environment=` limitation (RSK-13) is irrelevant here: the unresolvable outcome renders no unit at all (step 2's `install` refuses).

#### TC-DAEMON-060 - A plain status in a new process probes the socket and reports the full durable projection with derived markers

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-1, AC-F5-6, F-4, F-5, EVT-1, EVT-2, DEC-14, DEC-15
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-status-durable.test.ts` **(new)**; `tests/golden/daemon-status-matrix.test.ts` **(control)**
**Composition under test**: directly composed `createDaemonCommandRuntime` with an injected control transport and socket path — a transport is a `DaemonComposition` field and is not a production fact, so the case proves the status surface against the delivered runtime rather than the composer's transport wiring (which `TC-DAEMON-063` covers).
**Tags**: @backend, @cli, @daemon

**Preconditions**:
- A store written by one handle and closed, then read by a fresh handle (GAP-T3), across four fixtures: live/fresh, released, absent, and live/fresh-with-unreachable-socket.
- A resident fixture composed with no lane executor, so the mode is `supervise-only`.
- An injected transport that answers the probe for the reachable fixtures and refuses it for the unreachable one.

**Steps**:
1. For the live/fresh fixture, run `daemon status` in a fresh composition; assert exit `0` and that `data.instance` reports `instanceId`, a positive `pid`, `scope`, `acquiredAt`, and `mode`.
2. Assert `data.heartbeat.ageMs` is the injected-now minus the durable `beatAt`, `data.heartbeat.intervalMs` equals the resolved interval, and `data.socket.path` equals the resolved socket path with a declared reachability boolean.
3. Assert `data.supervisor` carries kind, unit, scope, `installed: false` (DEC-14), linger, command form, service type, restart policy, and the environment binding.
4. Assert the derived `degraded` list is empty for the live/fresh fixture and that it contains `lane-executor-unavailable` only (never `daemon-unreachable`) for the resident-but-supervise-only shape (DEC-15).
5. For the released and absent fixtures, assert the report is still exit `0`, `instance` is null or the released record, `daemon-unreachable` is present in `degraded`, and `data.live` is `false` (no claim of a live daemon).
6. Assert the plain read **probes** the composed socket exactly once even without `--live`, and that the probed reachability is what the envelope reports (`true` for the live fixture, `false` for a fixture whose transport refuses the connection); assert the read appended no record and left the store byte-identical.
7. Assert unreachability is reported, not thrown: with the transport refusing, the plain status still exits `0` with a degraded payload, while `--live` over the same fixture fails closed (`TC-DAEMON-062`).
8. Assert the payload is byte-identical across two identical runs over the same store and instant.

**Expected Outcome**:
- The status payload answers "is a daemon running, which pid, which instance, how old is the heartbeat, which socket, is it answering, which supervisor" from durable state plus one probe, at exit `0`, with derived markers that distinguish absent from live.

**Notes / Clarifications**:
- `lane-executor-unavailable` and `daemon-unreachable` must stay distinct: this case is the guard against conflating the two markers (DEC-15).
- Plain status is a probe-and-report surface, not a fail-closed one: only `--live` turns an unreachable socket into a failure identity. The "zero connects" claim belongs to the queue/lanes degradation path only (`TC-DAEMON-076`, `TC-DAEMON-120`).

#### TC-DAEMON-061 - `status --live` against a resident daemon returns the live envelope at exit `0`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-status-live.test.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` with an injected control transport at the composed socket path — the transport is a `DaemonComposition` field, not a production fact.
**Tags**: @backend, @cli, @daemon

**Preconditions**:
- A live/fresh store fixture and an injected control transport that answers the status probe with a live payload at the composed socket path.

**Steps**:
1. Run `daemon status --live`; assert exactly one transport connect at the composed socket path and one status probe.
2. Assert exit `0` and `data.live: true` with the socket reported reachable and the heartbeat state `running`.
3. Assert the response timeout used is the resolved `daemon` branch value and that no second connect occurs.
4. Assert the same store read through plain `daemon status` produces the same projection with `live: false` and the same observed reachability — the flag and the fail-closed behaviour are the only differences between the two surfaces, not the probe.
5. Assert the read performed no write and appended no record, and that `--live` never reports `live: true` without a probe having reached the socket.

**Expected Outcome**:
- The live surface works against a resident daemon and reports reachability truthfully.

**Notes / Clarifications**:
- The transport is injected; no real socket is opened.
- `TC-DAEMON-060` pins the plain surface as probe-and-report at exit `0`; this case pins the live surface as the only fail-closed one.

#### TC-DAEMON-062 - `status --live` fails closed while a plain status stays a degraded success

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-3, F-4, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-status-live.test.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` with the three injected transport fixtures — the transport and the socket path are `DaemonComposition` fields, not production facts.
**Tags**: @backend, @negative, @daemon

**Preconditions**:
- Three fixtures: socket unreachable; socket reachable with a stale heartbeat; socket reachable with a fresh heartbeat (the control).

**Steps**:
1. For the unreachable fixture, run `status --live`; assert the failure identity is `daemon.socket-unreachable`, the exit is `2`, and no success `data` is present.
2. For the stale-heartbeat fixture, assert the failure identity is `daemon.heartbeat-stale` and the exit is `2`.
3. For both, run plain `daemon status`; assert exit `0` with a degraded `data` payload, `live: false`, the socket reported unreachable (the plain surface probes too), `daemon-unreachable` present in `degraded`, and no error envelope.
4. For the fresh control, assert `--live` succeeds at exit `0` so the failure paths are not vacuous.
5. Assert `--live` never reports `live: true` when the socket is unreachable or the beat is stale, and that the failure envelope names the socket path but never the lock token.
6. Assert the three fixtures produce exactly the three declared outcomes (one `0`, two `2`), so no exit outside `{0,1,2}` appears, and that doubling the probe count is not how the plain surface reaches its verdict — one connect per invocation on either surface.

**Expected Outcome**:
- Only the live surface fails; the plain surface remains a degraded success, and the two failure identities are distinguished by cause.

**Notes / Clarifications**:
- The staleness bound is the same configured `lockStalenessMs` the degradation predicate uses (`TC-DAEMON-075`).

#### TC-DAEMON-063 - The configured socket path and heartbeat interval reach the composed runtime, with an empty-branch fallback

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-4, F-4, DM-6, NFR-2
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-control-plane-config.test.ts` **(new)**; `tests/behaviour/config-*.test.ts` **(control)**
**Composition under test**: both shapes — the production composer for the configured/unavailable configuration branch (steps 1, 3, 4, 5, 6) and a directly composed `createDaemonCommandRuntime` with an injected clock and store for the heartbeat-ordinal advance (step 2), because `ProductionCompositionFacts` accepts no clock. **Invocation shape**: handler for both halves — the production half invokes the composed program's `status`/`start` handlers and the direct half invokes the runtime directly; no step goes through `runEntrypoint`, and the production half makes no claim about prompt-required selection or `fallback.internal` (`TC-DAEMON-015`, Phase-6 gate).
**Tags**: @backend, @config, @daemon

**Preconditions**:
- A configuration branch fixture setting `daemon.socket-path` to a path inside the temp root and `daemon.heartbeat-interval` to a value distinct from the shipped default.
- A second fixture in which configuration cannot be acquired at all.

**Steps**:
1. Compose with the configured branch; assert the composed socket path equals the configured path and the settings interval equals the configured interval.
2. Run a start through the direct runtime and advance the fake clock by that interval three times; assert three heartbeat records with contiguous ordinals spaced by the configured interval (not the default).
3. Run `daemon status` through the composed program's handler and assert the payload reports the configured interval and the configured socket path.
4. Compose with configuration unavailable; assert the same delivered resolver runs over an empty branch and the socket path and interval equal the shipped defaults, with defaults provenance.
5. Assert no literal default appears in the composition: a source scan finds no hardcoded socket name or interval constant in `production.ts`, and a temp-copy mutant replacing the resolver call with a literal fails.
6. Assert the resolved settings are identical across two identical compositions (determinism).

**Expected Outcome**:
- The `daemon` configuration branch actually reaches the runtime, and the fallback path is the same definition rather than a second set of literals.

**Notes / Clarifications**:
- Defaults are one definition; the empty-branch call is asserted by provenance, not by guessing values.

#### TC-DAEMON-070 - A live acquired instance with a matching fresh heartbeat yields `degraded: []` on both reads

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-1, AC-F5-6, F-5, DM-3, DM-4
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-degradation-derived.test.ts` **(new)**; `tests/behaviour/lanes-degradation-derived.test.ts` **(new)**
**Tags**: @backend, @degradation, @state

**Preconditions**:
- A store fixture with one instance record (`operation: "acquired"`) and one heartbeat whose `instanceId` matches and whose `beatAt` is within the configured staleness of the injected now.
- A production-shaped queue/lanes composition whose `degraded` is the durable resolver.

**Steps**:
1. Resolve the predicate directly with the injected now, the lock staleness, and the fixture facts; assert the result is an empty array.
2. Run `queue list`; assert exit `0` and `degraded: []`.
3. Run `lanes list`; assert exit `0` and `degraded: []`.
4. Repeat with `operation: "taken-over"` as the latest record; assert the empty array again.
5. Assert the bound is exclusive from the non-degraded side: with an age one millisecond below the bound the result is still `[]`, and the at-bound cell itself is `TC-DAEMON-073`'s (asserted there as degraded), so the boundary is asserted once from each side of the same strict comparison rather than twice with two different expectations.
6. Assert no socket connect, no `isAlive` call, and no `sleep` occurred during either read.

**Expected Outcome**:
- A live daemon removes the marker from both payloads while its heartbeat is strictly inside the staleness bound.
- The boundary is asserted from both sides with one comparison, so a `<=` drift fails a case rather than sliding through.

**Notes / Clarifications**:
- This is the direction that a hardcoded marker fails; it is asserted before the negative direction on purpose.

#### TC-DAEMON-071 - A released or immediate-stopped instance yields `["daemon-unreachable"]` on both reads

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-2, F-5, DM-4, EVT-1
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-degradation-derived.test.ts` **(new)**; `tests/behaviour/lanes-degradation-derived.test.ts` **(new)**
**Tags**: @backend, @degradation, @state

**Preconditions**:
- Two fixtures: a latest `released` record and a latest `immediate-stop` record, each preceded by an earlier `acquired` record, each with a heartbeat that would otherwise be fresh.

**Steps**:
1. Resolve the predicate for each fixture; assert `["daemon-unreachable"]` in both.
2. Run `queue list` and `lanes list` for each fixture; assert the marker array equals exactly `["daemon-unreachable"]` (one member, no duplicates) at exit `0`.
3. Assert the heartbeat's freshness does not rescue the verdict: an operation of `released` is terminal even with a fresh beat.
4. Assert the arrays are the only degraded value (no `daemon-heartbeat-stale` or `lane-executor-unavailable` added to the queue vocabulary, Appendix C).
5. Assert no write occurred during either read.

**Expected Outcome**:
- A released daemon restores the marker in both payloads, and a fresh heartbeat cannot mask a terminal operation.

**Notes / Clarifications**:
- The fixture deliberately keeps the heartbeat fresh so the operation is the only differentiator.

#### TC-DAEMON-072 - An absent instance yields `["daemon-unreachable"]` at exit `0` on both reads

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, F-5, DM-4
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-degradation-derived.test.ts` **(new)**; `tests/behaviour/lanes-degradation-derived.test.ts` **(new)**
**Tags**: @backend, @degradation, @state

**Preconditions**:
- A verified-empty store (no instance, no heartbeat) and a store with a heartbeat but no instance record.

**Steps**:
1. Resolve the predicate for the empty store; assert `["daemon-unreachable"]`.
2. Run `queue list` and `lanes list`; assert exit `0` and the exact marker array.
3. Resolve for the heartbeat-without-instance fixture; assert `["daemon-unreachable"]` (an orphan heartbeat never fabricates reachability). This case asserts the marker only; the accompanying statement that the delivered fold still reports `running` for the same fixture is `TC-DAEMON-078`, which owns the divergence and is the only case that reads both surfaces for it.
4. Assert a missing daemon is never an error on these surfaces: no `error` envelope, no exit outside `0`.
5. Assert the read is a bounded store projection (two reads at most) and wrote nothing.

**Expected Outcome**:
- "No daemon has ever run here" is the truthful, non-error case, which is the whole point of making the marker derived.

**Notes / Clarifications**:
- The orphan-heartbeat fixture is the fabrication guard: a heartbeat alone must not imply a live instance.

#### TC-DAEMON-073 - A heartbeat at or beyond the lock staleness yields `["daemon-unreachable"]` on both reads

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-4, AC-F5-6, F-5, DM-4, EVT-2
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-degradation-derived.test.ts` **(new)**; `tests/behaviour/lanes-degradation-derived.test.ts` **(new)**
**Tags**: @backend, @degradation, @state

**Preconditions**:
- An `acquired` instance with a matching heartbeat whose `beatAt` is older than the configured staleness by exactly 1 ms, plus a boundary control at exactly the bound.

**Steps**:
1. Resolve the predicate at `now − beatAt == lockStalenessMs + 1`; assert `["daemon-unreachable"]`.
2. Resolve at exactly the bound (`now − beatAt == lockStalenessMs`); assert `["daemon-unreachable"]` — the comparison is strictly-below, and the delivered status fold reports `stale` for the same cell, so the two surfaces agree at the bound instead of straddling it.
3. Run `queue list` and `lanes list` for the at-bound and the beyond-bound fixtures; assert the exact marker array at exit `0` for both.
4. Change only the configured staleness (double it) with the same timestamps and an age now strictly inside the new bound; assert the verdict flips to `[]`, proving the bound is configuration-driven and not a literal.
5. Assert no socket probe was used to decide, and that freshness is consulted only after ownership: the at-bound cell is asserted with an owning heartbeat (the unowned family is `TC-DAEMON-078`, so no case here asserts an outcome that case denies).

**Expected Outcome**:
- "Stale" means at or beyond the configured bound, decided by one strict comparison, and the marker follows it identically on both reads and in the status fold.

**Notes / Clarifications**:
- The double-staleness control is the guard against a hardcoded 30 000 ms.
- The at-bound cell is owned by this case (degraded, and the fold `stale`); `TC-DAEMON-070` owns the just-below cell (`[]`), so the pair asserts one strict `<` from both sides instead of two contradictory boundary expectations.

#### TC-DAEMON-074 - A watch flips the marker in both directions within one iteration

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-5, F-5, DM-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation-watch.test.ts` **(new)**; `tests/behaviour/queue-watch.test.ts` and `tests/behaviour/lanes-watch.test.ts` **(controls)**
**Tags**: @backend, @degradation, @watch

**Preconditions**:
- A watch runtime with an injected clock and an injected iteration seam (the delivered `maxIterations`/interval seams), over a temp store.
- An initial absent-instance store.

**Steps**:
1. Emit iteration 1; assert the snapshot's `degraded` is `["daemon-unreachable"]`.
2. Write an `acquired` instance and a matching fresh heartbeat between iterations; emit iteration 2; assert `degraded` is `[]` without restarting the watch.
3. Write a `released` instance between iterations; emit iteration 3; assert `degraded` is `["daemon-unreachable"]` again.
4. Repeat for `lanes watch`; assert the same three-iteration sequence.
5. Assert each iteration resolved exactly once (a call counter equals the iteration count) and that the resolver was not captured at composition time (a composition-time constant would repeat iteration 1's value).
6. Assert no iteration slept a real interval (the injected clock resolved the wait).

**Expected Outcome**:
- The marker follows durable state inside a running watch, in both directions, without a restart and without a composed constant.

**Notes / Clarifications**:
- This is the case that distinguishes "resolved per projection" from "resolved once and captured".

#### TC-DAEMON-075 - The degradation verdict and the status heartbeat fold share one strictly-below bound on every owned cell

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-6, AC-F4-1, F-5, F-4, DM-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation-agreement.test.ts` **(new)**
**Tags**: @backend, @degradation, @state

**Preconditions**:
- A generated matrix of durable record sets drawn from the domain AC-F5-6 states: (operation ∈ {acquired, taken-over, released, immediate-stop}) × (heartbeat ∈ {absent, fresh, at-bound, stale}), i.e. 16 cells in which the latest heartbeat is owned by the instance or absent, plus one cell with no instance record and no heartbeat at all.
- The unowned cells — no instance plus a fresh heartbeat, and a heartbeat whose `instanceId` names another instance — are deliberately **excluded** from this matrix; they belong to `TC-DAEMON-078`, where the two surfaces are asserted to diverge.
- The same store, injected now, and `lockStalenessMs` are shared by both surfaces.

**Steps**:
1. For every matrix cell, resolve the degradation predicate and the delivered `readDaemonStatus` fold with the same store, the same injected now, and the same `lockStalenessMs`.
2. Assert the invariant on this domain: `degraded === []` implies the fold's `heartbeat.state === "running"`, and `degraded === ["daemon-unreachable"]` implies the fold's state is `stale` or `stopped` (never `running`).
3. Assert the at-bound cell lands on the degraded side **and** the fold's `stale` side, so the model is one strict `<` applied identically rather than two adjacent bounds that agree only by luck.
4. Assert the invariant is not achieved by two different bounds: re-run the matrix with a doubled staleness; every cell that flipped in the predicate also flips in the fold.
5. Assert the matrix covers all 17 cells and that at least one cell lands in each of the two outcomes (non-vacuity of both directions), and assert the excluded unowned cells are not silently folded in (a cell-set assertion, so the exclusion is visible rather than an omission).
6. Assert neither surface appends a record while reading.

**Expected Outcome**:
- On every store where the instance owns the heartbeat or no heartbeat exists, the queue/lanes marker and `daemon status` cannot disagree about "stale", because they consume one bound with one comparison.
- The divergent unowned family is outside this case by construction and is asserted by `TC-DAEMON-078`, so no two cases claim different verdicts for the same cell.

**Notes / Clarifications**:
- The invariant is one-directional by construction: the fold exposes more states (`stopped`) than the marker's two outcomes, and that is expected.
- Excluding the unowned cells is what makes AC-F5-6 satisfiable; the exclusion is the declared divergence in DM-4, not a hole in the matrix.

#### TC-DAEMON-076 - A torn or unreadable read degrades, opens no socket, and raises no error identity

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-7, AC-NFR-2, F-5, DM-3, DM-4, NFR-3
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation-torn.test.ts` **(new)**; `tests/checks/daemon-hermetic.test.ts` **(update)**
**Tags**: @backend, @negative, @degradation

**Preconditions**:
- Fixtures: a truncated instance payload, an instance record with an unknown operation, a malformed heartbeat record, a heartbeat missing `instanceId`, and a permission-denied store root.
- A store fake that can fail the instance read, the heartbeat read, or both independently.

**Steps**:
1. For each corrupt fixture, resolve the degradation predicate; assert `["daemon-unreachable"]` in every case.
2. Assert the resolver raised no thrown error and produced no error identity (it returns a marker array, not a `Result`).
3. Run `queue list` and `lanes list` over each corrupt fixture; assert exit `0` with the marker array, and that no `daemon.*` or `state.*` error envelope appears for a corrupt daemon record.
4. Fail both reads; assert the marker array is still produced and that the resolver performed no socket connect, no `isAlive`, and no `sleep`.
5. For the permission-denied *queue store*, assert `queue list` fails through its own delivered `state.*` identity at exit `2` — the daemon-record tolerance must not swallow a store-level failure.
6. Assert each corrupt read left the records unchanged (the read path never repairs).

**Expected Outcome**:
- Unreadable daemon state degrades to the honest marker and never fabricates reachability or throws into a queue read; a genuinely unreadable queue store keeps its own failure identity.

**Notes / Clarifications**:
- The split in steps 3 and 5 is the whole point: tolerant about the daemon record, intolerant about the ledger itself.

#### TC-DAEMON-077 - Production supplies the durable resolver; the hardcoded marker is gone and cannot return

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-1, AC-F5-2, AC-F5-3, AC-F5-7, F-5, DEC-7
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-degradation-wiring.test.ts` **(new)**; `tests/checks/daemon-mutants.test.ts` **(update)**
**Tags**: @structure, @degradation, @mutant

**Preconditions**:
- The production composer's source and the delivered queue/lanes composition type.

**Steps**:
1. Compose the production program over a live/fresh store and assert `queue list` returns `degraded: []` — a composed constant would return the marker even with a live daemon.
2. Compose over a released store and assert `["daemon-unreachable"]`; the same composition therefore produces both values from state alone.
3. Scan `packages/cli/src/production.ts` for a literal array-valued `degraded` assignment; assert none exists and that the value is a function.
4. Assert the composed resolver, called twice with different stores between calls, returns different values (it is not memoized).
5. Non-vacuity: apply a temp-copy mutant that reinstates `degraded: ["daemon-unreachable"]`; assert `tests/checks/daemon-mutants.test.ts` fails naming the file and the mutant.
6. Assert the widening is type-level only: `QueueComposition.degraded` accepts both an array and a function, and the array member is still assignable (`tests/types/daemon-mount.type-test.ts`).

**Expected Outcome**:
- The hardcoded marker is removed at the wiring level and its reintroduction is caught by a mutant, so a correct predicate with a wrong wire cannot pass.

**Notes / Clarifications**:
- Step 1 is deliberately the live direction: with a constant, the live direction is the one that fails.

#### TC-DAEMON-078 - An unowned heartbeat degrades while the delivered fold reports `running`, and the divergence is named

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-8, F-5, DM-3, DM-4, EVT-2
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-degradation-derived.test.ts` **(new)**; `tests/behaviour/lanes-degradation-derived.test.ts` **(new)**; `tests/behaviour/daemon-degradation-agreement.test.ts` **(new)**
**Tags**: @backend, @degradation, @state

**Preconditions**:
- Two fixtures, each with a heartbeat whose `beatAt` is strictly below the configured staleness bound (age well inside the window, so freshness cannot be the reason for the verdict):
  - **orphan**: no instance record at all, plus one fresh heartbeat;
  - **foreign owner**: an `acquired` instance whose id is `A`, plus a fresh heartbeat whose `instanceId` is `B`.
- An injected now and the delivered `readDaemonStatus`, so both surfaces read the same store at the same instant.

**Steps**:
1. For each fixture, resolve the degradation predicate; assert exactly `["daemon-unreachable"]` — an unowned heartbeat is unreachable at any age, because ownership gates freshness.
2. Run `queue list` and `lanes list` for each fixture; assert exit `0` and the exact marker array (one member, no duplicates) even though the beat is fresh.
3. For each fixture, run the delivered status fold over the same store and instant; assert `heartbeat.state === "running"` — the full heartbeat interval is inside the bound, so the fold's liveness answer is genuine.
4. Assert the divergence explicitly: the same store and instant yield `degraded: ["daemon-unreachable"]` from the queue/lanes reads and `running` from the status fold, and the case asserts both in one test body so neither can be "fixed" by changing the other's expectation silently.
5. Assert the reason is ownership and not staleness: double the configured staleness and re-run; the marker stays `["daemon-unreachable"]` and the fold stays `running`, so the bound is not what produced the verdict.
6. Assert the reason is not an unreadable read: both fixtures parse cleanly (no torn payload), so the degraded marker comes from the ownership rule rather than the fail-closed path of `TC-DAEMON-076`.
7. Assert the operator-facing surfaces do not contradict each other silently: the queue and lanes payloads carry exactly the one marker and no claim that a daemon is running, while the status payload's `heartbeat.state` stays `running` — both are asserted in the same case so the divergence is visible in one place rather than hidden between two suites.

**Expected Outcome**:
- A heartbeat nobody owns degrades queue and lanes while the status fold honestly reports what it can see.
- The divergence is asserted, named, and bounded to this family, so the two criteria (agreement, divergence) cannot be read as contradictory.

**Notes / Clarifications**:
- This is the AC-F5-8 family and the deliberate counterpart of AC-F5-6: queue and lanes degrade on ownership because a heartbeat with no owner can be neither drained, signalled, nor reconciled, while the fold answers a liveness question only (DM-4, DEC-7).
- It is the case that would fail if a later change "harmonised" the predicate with the fold by dropping the owner requirement — a change that would make `daemon-unreachable` disappear for a daemon nobody can address.

#### TC-DAEMON-090 - A production start records the composing pid, and both surfaces report it

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-1, F-6, DM-1, EVT-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-instance-pid.test.ts` **(new)**
**Composition under test**: production composer — `processId` is an existing production fact and no entry path is composed, so the in-process start needs no process-port seam. **Invocation shape**: handler — the composed program's `start` and `status` handlers are invoked directly; no step goes through `runEntrypoint`, so the case makes no claim about prompt-required selection or `fallback.internal` (`TC-DAEMON-015`, Phase-6 gate).
**Tags**: @backend, @daemon, @state

**Preconditions**:
- A production-shaped composition with `processId: 4242` and a temp state root.
- A control composition with no `processId` (the delivered fallback).

**Steps**:
1. Invoke the composed `start` handler in-process; read the durable `acquired` instance from a fresh handle; assert `pid === 4242`.
2. Assert the value is a positive integer (`Number.isInteger(pid) && pid > 0`) and never `0`.
3. Assert the start receipt's `instance.pid` equals `4242`, and that the composed `status` handler in a new composition reports the same value.
4. Assert the composition forwards the pid only when it is a positive integer: with `processId: 0` or `undefined`, no positive pid is written and the delivered fallback behaviour is unchanged (recorded as `0`, with the stop refusal covering it at `TC-DAEMON-091`).
5. Assert the recorded pid is not derived from the brand, the cwd, or a random value: two compositions with the same injected pid record the same value.

**Expected Outcome**:
- The instance names the process that actually acquired the lock, and both read surfaces agree.

**Notes / Clarifications**:
- Recording the real pid is the fix; the refusal for anything else is the guard (`TC-DAEMON-091`).

#### TC-DAEMON-091 - A non-positive recorded pid refuses the stop and makes zero signal calls

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-2, F-6, NFR-8
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-stop-pid-refusal.test.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` with a recording process port — the zero-signal oracle needs the port, which is a `DaemonComposition` field and not a production fact.
**Tags**: @backend, @negative, @security, @process

**Preconditions**:
- Four durable instance fixtures with operation `acquired` and `pid` of `0`, `-1`, `1.5`, and a non-numeric value (the last through a torn payload).
- A recording process port whose `signal` increments a counter and would otherwise succeed.

**Steps**:
1. For each fixture, run `daemon stop --mode drain` and `daemon stop --mode immediate` from a fresh composition.
2. Assert the result is a failure with code `daemon.state-recovery-failed` and exit `2` for every fixture and mode.
3. Assert the process port's `signal` counter is exactly `0` after all eight invocations — no signal reached any pid, so no process group can be addressed.
4. Assert `isAlive` was not used as a substitute path to signalling (zero calls) and that no name-, pattern-, or string-based kill exists (source scan for `kill(`/`pkill`/`exec` on the stop path).
5. Assert no instance record was appended or mutated by the refusal.
6. Assert the failure summary names the torn/non-positive pid fact without printing a lock token or a full state payload.
7. Positive control: with `pid: 9999`, the same invocation signals exactly once (`TC-DAEMON-092`), so the refusal is about the value and not the path.

**Expected Outcome**:
- A `0`, negative, fractional, or torn pid can never be signalled; the refusal is proven by a zero counter, not only by an exit code.

**Notes / Clarifications**:
- This is the process-group hazard guard (RSK-1): the exit code alone would pass even if the signal had already been sent.

#### TC-DAEMON-092 - A positive pid receives the correct signal, that pid only, and a failed call is classified

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-3, F-6, NFR-8, NFR-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-stop-signal-target.test.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` with a recording (and failure-programmable) process port — the signal log is a `DaemonComposition` seam, not a production fact.
**Tags**: @backend, @process, @negative

**Preconditions**:
- A durable instance fixture with `pid: 9999`, `acquired`, and a delivering lane.
- A recording process port that can be told to fail the next `signal`.

**Steps**:
1. Run `stop --mode drain`; assert exactly one `signal(9999, "SIGTERM")` and zero calls with any other pid or signal, and `result=draining` at exit `0`.
2. Run `stop --mode immediate` on a fresh fixture; assert exactly one `signal(9999, "SIGINT")` and `result=stopped` at exit `0`.
3. Assert the recorded pid argument is never `0`, never negative, and never a process-group form (`-9999`), which a mutant using the negated pid would produce.
4. Configure the port to fail; assert the result is `daemon.state-recovery-failed` at exit `2` with the delivered detail, and that no success `data` is returned.
5. Assert a failed signal appends nothing and does not fabricate a `draining` result.
6. Assert exactly one signal call per invocation (no retry storm) and that no `isAlive` probe precedes the signal.

**Expected Outcome**:
- Each mode maps to its own signal on the recorded pid only, and a failed call is classified rather than silently swallowed.

**Notes / Clarifications**:
- The group-form mutant in step 3 is the structural guard against a later "helpful" refactor that signals `-pid`.

#### TC-DAEMON-100 - Install writes the brand-derived unit with the absolute entry path and the resolved binding

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-1, F-7, DM-6, NFR-6, NFR-10
**Test Type(s)**: Behaviour, Contract, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-install-identity.test.ts` **(new)**; `tests/golden/daemon-install.test.ts` **(control)**
**Invocation shape**: handler — `install` is invoked on the composed program's command handler (no `runEntrypoint`), so this phase asserts the runtime contract and makes no claim about prompt-required selection or `fallback.internal` (`TC-DAEMON-015`, Phase-6 gate).
**Tags**: @backend, @install, @contract

**Preconditions**:
- A Linux platform fixture, a temp configuration root, an absolute entry path inside the temp root, a resolved state directory, and a recording `SupervisorPort`.
- The synthetic brand whose `binaryName` is `example-product`.

**Steps**:
1. Run `daemon install`; assert exit `0`, `result=installed`, and that the unit path captured by the supervisor port is `<config root>/systemd/user/example-product-daemon.service`.
2. Parse the captured unit text; assert `ExecStart=<absolute entry path> daemon start --foreground` with the entry path byte-identical to the composed `daemonEntry`, and that the executable is not a bare binary name.
3. Assert one `Environment=<PREFIX>_STATE_DIR=<resolved state directory>` line whose variable name is exactly the composed `environmentName` and whose value is exactly the resolved directory.
4. Assert the delivered optional fields are unchanged (`Type=simple`, `WantedBy=default.target`, `Restart=on-failure`) and that the descriptor reports `kind`, `unit`, `scope`, `installed`, `linger`, `commandForm`, `serviceType`, `restartPolicy`, and the environment binding.
5. Assert the recorded command and filesystem sequence is exactly the delivered one: write the unit file, `systemctl --user enable <unit>`, `loginctl enable-linger` (when linger is requested), then write the ownership marker — in that order, with exactly one of each and no marker before the enablement commands succeed.
6. Assert the scope equals the delivered digest of the resolved state directory (not the brand name, not the cwd).
7. Assert no file was written outside the temp configuration root and that the state directory was not used as the unit directory.
8. Assert the unit text carries exactly one `Environment=` line — the state-directory binding — and no `PATH`/`HOME` line, so the re-entry environment of DM-1 stays a spawn concern and does not leak into the unit.

**Expected Outcome**:
- The installed unit is a unit systemd can read and start: absolute executable, correct identity, correct environment binding, enabled with linger.

**Notes / Clarifications**:
- The delivered golden for install stays a control; this case adds the production identity assertions around it.
- The order asserted in step 5 is the delivered adapter order (`packages/adapters/src/daemon/supervisor.ts`): unit write, `systemctl --user enable`, `loginctl enable-linger`, ownership marker last. The marker is written only after enablement succeeds, which is what makes the rollback in `TC-DAEMON-102` meaningful — an earlier order would leave a marker for a unit that was never enabled.

#### TC-DAEMON-101 - The configuration root is `XDG_CONFIG_HOME` when absolute, otherwise `<home>/.config`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, F-7, DM-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-install-config-root.test.ts` **(new)**
**Invocation shape**: handler — `install` is invoked on the composed program's command handler (no `runEntrypoint`); selection and `fallback.internal` are not asserted at this phase (`TC-DAEMON-015`, Phase-6 gate).
**Tags**: @backend, @install, @config

**Preconditions**:
- Four environment fixtures: `XDG_CONFIG_HOME` absolute and non-empty; unset; empty string; relative path.
- A temp `homeDirectory` and an absolute entry path.

**Steps**:
1. For the absolute fixture, assert the unit is written under `$XDG_CONFIG_HOME/systemd/user/` and that `<home>/.config` receives nothing.
2. For the unset, empty, and relative fixtures, assert the unit is written under `<home>/.config/systemd/user/` and that the relative value is not joined onto the cwd.
3. Assert the chosen root is the same root reported in the receipt's descriptor scope/unit information, so the receipt and the filesystem agree.
4. Assert a relative `XDG_CONFIG_HOME` is treated as absent (never resolved against the cwd), which a mutant that joins it would violate.
5. Assert the state directory is never used as the configuration root, the delivered default this change replaces.
6. Assert the write performed one bounded unit write and one marker write and created no other path under the root.

**Expected Outcome**:
- The unit lands in the root systemd reads, selected exactly as specified.

**Notes / Clarifications**:
- The relative-value case is the interesting one: joining it would silently write outside the user's configuration root.

#### TC-DAEMON-102 - An unsupported supervisor or a linger failure writes no unit and leaves nothing partial

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-3, F-7, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-install-unsupported.test.ts` **(new)**
**Composition under test**: directly composed `createDaemonCommandRuntime` — the case must set `platform` to `darwin` and `win32`, and `platform` is a delivered `DaemonComposition` field with no production fact (production forwards its host platform only). The recording `supervisor` is passed through the same input the production composer would use.
**Tags**: @backend, @negative, @install

**Preconditions**:
- A platform fixture with no delivered supervisor adapter (`darwin` and `win32`) and a Linux fixture whose linger enablement fails.
- A recording supervisor port and a temp configuration root listing helper.

**Steps**:
1. For each unsupported platform, run `daemon install`; assert `daemon.supervisor-unsupported` at exit `2`.
2. Assert the temporary configuration root contains no unit file and no ownership marker after the failure (directory listing equality).
3. Assert the failure summary carries the platform evidence (the platform name and the delivered detail), and no state payload or token.
4. For the linger-failure fixture, assert the error is `daemon.supervisor-unsupported` at exit `2` and that the unit and marker written before the failure were removed (rollback recorded as disable + remove in that order).
5. Assert no `enable` command was recorded after a failed linger, and that the recorded sequence ends with the rollback.
6. Assert a subsequent `daemon install` on a supported platform succeeds (the failure left no lock or marker blocking a retry).

**Expected Outcome**:
- An unsupported or failed install is classified, writes nothing durable, and cannot leave a half-installed unit behind.

**Notes / Clarifications**:
- Directory equality is the absence proof here (GAP-T3), not only the exit code.

#### TC-DAEMON-103 - Uninstall removes only its own artifacts, and an absent install is a `noop`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-4, F-7, NFR-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-uninstall.test.ts` **(new)**
**Invocation shape**: handler — `install` and `uninstall` are invoked on the composed program's command handlers (no `runEntrypoint`); selection and `fallback.internal` are not asserted at this phase (`TC-DAEMON-015`, Phase-6 gate).
**Tags**: @backend, @install, @idempotence

**Preconditions**:
- A temp configuration root containing: this installation's unit and marker, an unrelated unit file, and an unrelated marker.
- A fixture where nothing is installed.

**Steps**:
1. Run `daemon install` then `daemon uninstall`; assert `result=uninstalled` at exit `0`.
2. Assert this installation's unit and marker are gone and that both unrelated files are byte-unchanged (directory listing plus content equality).
3. Assert linger was disabled exactly once because this installation enabled it, and that no disable occurred for a unit this installation never enabled (second fixture).
4. Run `daemon uninstall` again; assert `result=noop` at exit `0` with zero disable and zero remove calls.
5. Run `daemon uninstall` with nothing installed at all; assert `result=noop` at exit `0`.
6. Assert uninstall never removes the state directory and never touches a unit whose name differs from `${brand.binaryName}-daemon.service`.

**Expected Outcome**:
- Uninstall is ownership-scoped and idempotent, and it cannot become a broad delete.

**Notes / Clarifications**:
- The unrelated-file control is the guard against an implementation that removes everything under `systemd/user/`.

#### TC-DAEMON-104 - Install without an entry path refuses and writes no unit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-5, F-7, F-1, NFR-8
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-install-no-entry.test.ts` **(new)**
**Tags**: @backend, @negative, @install

**Preconditions**:
- A composition with no `daemonEntry`, **a resolvable state directory** (AC-F7-5's "given a resolvable state directory" qualifier), an otherwise supported Linux platform fixture, and a temp configuration root. The refusal is keyed on entry-path absence only: `DaemonComposition.binary` is a required field that is always present, so the case never asserts a missing `binary`.
- The no-entry-path **and** no-state-directory cell is not this case's: it is the unresolvable outcome (`config.value.invalid` at exit `1`), asserted by `TC-DAEMON-054` step 2 and `TC-DAEMON-015` step 3.

**Invocation shape**: handler — `install` is invoked on the composed program's command handler (no `runEntrypoint`); selection and `fallback.internal` are not asserted at this phase (`TC-DAEMON-015`, Phase-6 gate).

**Steps**:
1. Run `daemon install`; assert `daemon.state-recovery-failed` at exit `2`.
2. Assert the temporary configuration root contains no unit and no marker (directory listing equality), so no unit was ever rendered.
3. Assert the supervisor port recorded zero write, zero enable, and zero linger calls.
4. Assert `daemon` is still registered and `daemon status` still works in the same composition, proving the absent fact degraded only the install shape.
5. Assert the failure summary explains that no executable path is composed, without printing a state payload.
6. Assert the refusal happens before rendering: a spy on `renderSystemdUnit` records zero calls, so no `ExecStart` — empty or otherwise — is ever produced from the absent entry path.

**Expected Outcome**:
- A unit can never be rendered with an empty `ExecStart`; the refusal is classified and nothing is written.

**Notes / Clarifications**:
- Steps 2 and 3 are the absence proof; step 6 proves the refusal happens before rendering rather than after.

#### TC-DAEMON-105 - **Manual**: a real user manager loads and enables the rendered unit, inside a temp config root

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F7-1, F-7, GAP-T4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: phase-9 operational verification recorded in §10; no committed test file
**Tags**: @manual, @install, @operations

**Preconditions**:
- A Linux host with a user systemd manager, a built CLI, and a temporary configuration root created under `$REPO_ROOT/tmp/` (not the operator's real `~/.config`).
- The Phase-3 manual record is taken at **handler level** — a §10 script that composes the production program and invokes its `install`/`uninstall` handlers — because until the Phase-6 membership the built binary's `runEntrypoint` cannot reach `daemon` (it answers `fallback.internal` at exit `2`). The real-binary form (`<binary> daemon install`) is re-run unchanged at the Phase-6 gate, after membership lands, and that run is the record that satisfies AC-F7-1.

**Invocation shape**: handler for the Phase-3 record; `entrypoint` for the Phase-6 re-run of the same procedure.

**Steps**:
1. Export `XDG_CONFIG_HOME` to the temp root and `<PREFIX>_STATE_DIR` to a temp state directory; run the composed `install` handler for the Phase-3 record (then `<binary> daemon install` for the Phase-6 re-run).
2. Assert the unit path is `<temp root>/systemd/user/<binaryName>-daemon.service` and inspect the rendered text for `ExecStart` and `Environment=`.
3. Run `systemctl --user daemon-reload` and `systemctl --user status <unit>`; assert the unit is known and enabled (not necessarily started).
4. Run `daemon uninstall`; assert the unit file is gone and `systemctl --user status` no longer finds it after a reload.
5. Record the host, the commands, and the observed output in §10.

**Expected Outcome**:
- The rendered unit is loadable by a real user manager and removable by uninstall, with no writes outside the temp root.

**Notes / Clarifications**:
- This is the only case that touches a real systemd; it is `Manual Only` by design and is not part of `pnpm test` (GAP-T4). It never enables login autostart for the operator's real account.

#### TC-DAEMON-110 - The error table is unchanged, every reached identity exists, and exits stay in `{0,1,2}`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-1, F-8, NFR-7, NFR-12
**Test Type(s)**: Contract, Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts` **(all controls, must pass unmodified)**; `scripts/checks/error-table-sync.ts`
**Tags**: @contract, @structure, @regression

**Preconditions**:
- The delivered error table and its exact-count assertions.

**Steps**:
1. Run the error-table structure suite unmodified; assert the entry count, the reserved two-segment set, and every delivered row are unchanged from the pre-change values.
2. Assert each identity this change reaches is present as a delivered row: `daemon.already-running`, `daemon.takeover-refused`, `daemon.heartbeat-stale`, `daemon.state-recovery-failed`, `daemon.socket-unreachable`, `daemon.supervisor-unsupported`, and the `state.*` family used by the mount.
3. Assert no `daemon.*` row was added, removed, or reworded by diffing the table's rendered rows against the committed expectation (the suite's own exact assertions are the oracle).
4. Run the sync check; assert zero drift between the machine table and the documented table.
5. Run the exit-code literal check; assert every mount path resolves to `0`, `1`, or `2`, and enumerate Appendix D outcomes asserting one identity plus one digit each.
6. Assert the mount introduces no `fallback.internal` outcome: every new failure path in the mount suite carries a `daemon.*` or `state.*` identity.

**Expected Outcome**:
- The change reuses the delivered identities only, and the exit projection stays total over `{0,1,2}`.

**Notes / Clarifications**:
- The proof of "no row changed" is that the exact suites pass **unmodified**; editing them would destroy the evidence.

#### TC-DAEMON-111 - The state schema, record kinds, and payload schemas are unchanged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-2, F-8, DM-7
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/state-contract.test.ts`, `tests/structure/daemon-contract.test.ts`, `tests/structure/daemon-vocabulary.test.ts` **(controls)**; `tests/types/daemon-mount.type-test.ts` **(new)**
**Tags**: @contract, @state, @regression

**Preconditions**:
- The delivered `STATE_SCHEMA_VERSION` constant and the delivered daemon record kinds.

**Steps**:
1. Assert `STATE_SCHEMA_VERSION` still equals `delivery.state.v1`.
2. Assert the set of daemon record kinds and payload schema ids is exactly the delivered set, with no addition.
3. Assert no migration or backfill entry point exists for the mount (source scan for a new migration directory or a schema-version bump).
4. Assert the only record-shape difference observable through the mount is the **value** of `daemon.instance.pid`: an `acquired` record written by the mount parses against the delivered payload type and validates, with no new required field.
5. Assert no `daemon` configuration key was added: the delivered `DAEMON_BRANCH` key set is unchanged and an unknown-key fixture still yields `config.key.unknown`.
6. Assert the type-level additivity: `DaemonComposition` accepts a literal without `pid`/`signalHost` and with them, and `ProductionCompositionFacts` accepts a literal without `daemonEntry`/`supervisor` and with them (`tests/types/daemon-mount.type-test.ts`).
7. Run the delivered state and daemon contract suites unmodified.

**Expected Outcome**:
- The state surface is untouched; only a value changes, and both additions are optional at the type level.

**Notes / Clarifications**:
- Step 4 is the criterion's own wording made observable: a value change is compatible, a shape change is not.

#### TC-DAEMON-112 - An array-valued `degraded` stays byte-identical and the absent fallback still applies

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-3, F-8, DM-3
**Test Type(s)**: Behaviour, Golden, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation-additivity.test.ts` **(new)**; `tests/behaviour/queue-cli.test.ts`, `tests/behaviour/lanes.test.ts`, `tests/golden/{queue-list,lanes-list}.test.ts` **(controls)**
**Tags**: @contract, @regression, @degradation

**Preconditions**:
- Two compositions over the same store: one with `degraded: ["daemon-unreachable"]` (array), one with `degraded` omitted.
- Recorded baseline payloads captured from the delivered behaviour for both.

**Steps**:
1. For the array composition, run `queue list`, `queue plan`, and `lanes list`; assert the serialized payloads are byte-identical to the recorded baselines, including the marker array's order and single member.
2. Run each queue mutation (`add`, `prioritize`, `dep`, `claim`, `release`) and assert each carries `degraded: ["daemon-unreachable"]` byte-identically to the baseline.
3. For the omitted composition, assert the delivered `["daemon-unreachable"]` fallback still applies to every read and mutation.
4. Assert the array member is not coerced into a function-shaped result: a static array yields the same value on two consecutive projections even when the store changes between them (the array is not re-resolved).
5. Assert a resolver that returns a different array on the second call is honoured at the second projection (the union actually dispatches on type).
6. Run the delivered queue, lanes, and golden suites unmodified.

**Expected Outcome**:
- Every existing embedder sees exactly the bytes it saw before, and the new resolver path is additive rather than a reinterpretation of the old one.

**Notes / Clarifications**:
- Steps 4 and 5 are the pair that proves the union is dispatched, not silently normalized.

#### TC-DAEMON-113 - The delivered suites pass with only the declared mount updates

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-4, AC-F1-1, AC-F1-4, F-8, GAP-T1
**Test Type(s)**: Regression, Structure, Manual
**Automation Level**: Automated (pass half) + Manual (diff half)
**Target Layer / Location**: full delivered suite run; the permitted update sites, derived from the tree rather than enumerated by count: `tests/behaviour/entrypoint-composition.test.ts` (expected-family list and the `daemon` absence assertions), `tests/behaviour/entrypoint-help.test.ts` (root family list), `tests/behaviour/entrypoint-help-coverage.test.ts` (the hard-coded command enumeration), `tests/fixtures/help-guide/coverage.json` (`commands` and `referencePages` rows), and `tests/checks/doc-conformance.test.ts` (`PROMPT_REQUIRED_PAGES` gains `daemon`)
**Tags**: @regression, @structure

**Preconditions**:
- The delivered suites listed in §2 under "Delivered suites that must keep passing".

**Steps**:
1. Run the named delivered suites: daemon lifecycle, daemon degradation, daemon lock, daemon lock concurrency, daemon supervisor install, queue CLI, control transport, entrypoint help, entrypoint help coverage, reference-page parity, queue-scheduling contract, daemon vocabulary, and doc conformance.
2. Assert each passes and that `git diff --name-only` reports changes in exactly the declared permitted test/fixture files plus the new files enumerated in §7.
3. Assert that in the updated behaviour files the only changed assertions are the expected-family list entry, the `daemon` removal from the absence list, the root-help family list entry, the coverage enumeration entry, the coverage inventory rows, and the conformance page list entry — verified by review of the diff, not by a permanent branch-diff assertion (GAP-T1).
4. Assert no delivered golden other than a reviewed one changed: `git status --porcelain` over `tests/golden/**` and `tests/fixtures/**/golden/**` shows no unexpected modification.
5. Assert the boundary suite and the fixture-coverage meta-check report no unenforced rule and no loosened rule.
6. Record the run in §10.2 with the exact command and result.

**Expected Outcome**:
- The delivered behaviour is preserved and the permitted update set is both enumerated up front and verified as the complete set at review.

**Notes / Clarifications**:
- If a delivered suite needs a semantic assertion change, that is a delivery defect against this criterion, not a plan update.

#### TC-DAEMON-114 - Help and version purity is unchanged for the mounted family

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-1, NFR-1
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-mount-help.test.ts` **(new, purity half — ships under this name, not `daemon-help.test.ts`)**; `tests/behaviour/entrypoint-help-isolation.test.ts` and `tests/behaviour/entrypoint-version.test.ts` **(controls)**
**Tags**: @purity, @cli, @help

**Preconditions**:
- An empty temp working directory, an armed filesystem-read guard, and a counting composer.

**Steps**:
1. Run `--help` and `--version` in the empty directory; assert exit `0`, zero composer invocations, and that the directory listing is unchanged before and after (zero writes).
2. Run `daemon --help` and each subcommand `--help`; assert zero composer invocations and an unchanged directory listing.
3. Arm a filesystem-read counter around the daemon help tuples; assert zero reads of the state directory, the configuration root, git metadata, or the network (the delivered isolation shape).
4. Assert the version output contains identity only (no state, config, or daemon facts).
5. Assert help/version do not consult the daemon composition at all: a composition whose factory throws is never invoked.
6. Run the delivered help-isolation and version suites unmodified.

**Expected Outcome**:
- The new surface does not make self-description depend on state, so help stays a pure render.

**Notes / Clarifications**:
- The purity claim is about the whole self-description surface, which is why the daemon tuples are added to it.

#### TC-DAEMON-120 - The degradation path stays within its read, socket, probe, sleep, and latency budget

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR-2, NFR-3
**Test Type(s)**: Performance, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation-read-cost.test.ts` **(new)**; `tests/checks/daemon-hermetic.test.ts` **(update)**
**Tags**: @perf, @degradation, @backend

**Preconditions**:
- A synthetic reference store with a declared size (instance plus heartbeat plus the queue/lane records the read needs) and an injected clock.
- Instrumented store, transport, and process-port fakes with call counters.

**Steps**:
1. Run `queue list` and `lanes list`; assert the instrumented store's read counter for the daemon facts is at most `2` per projection (instance and heartbeat).
2. Assert the transport's connect counter is `0`, the process port's `isAlive` counter is `0`, and the clock's `sleep` counter is `0`.
3. Measure p95 latency over a declared iteration count for both reads on the reference store, and measure the same baseline with an array-valued `degraded` in the same run; assert the regression is ≤ 10%.
4. Record the environment, the iteration count, the store shape, and both p95 values in the test output (GAP-T6).
5. Repeat for a mutation outcome and for a watch iteration; assert the same read budget per projection.
6. Assert the resolver performs no computation proportional to the record count: double the store's unrelated records and assert the daemon-fact read count is unchanged.

**Expected Outcome**:
- The derived marker costs two durable reads and nothing else; the read stays synchronous, local, and within the latency budget.

**Notes / Clarifications**:
- The bound is a relative p95 against a same-run baseline, so a slower host cannot fail the case spuriously (GAP-T6).

#### TC-DAEMON-121 - A foreground stop lands inside 1 000 ms with cancellation inside 250 ms

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR-3, AC-F2-4, NFR-5
**Test Type(s)**: Performance, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-foreground-stop-latency.test.ts` **(new)**
**Tags**: @perf, @lifecycle, @backend

**Preconditions**:
- A foreground start over a temp store with a delivering lane, an injected clock, and a real monotonic stopwatch used only for the wall-clock bound.

**Steps**:
1. Start foreground, then deliver `SIGTERM`; record `t0` at delivery.
2. Record `t1` when loop cancellation is observed (the loop promise's cancellation point) and assert `t1 − t0 ≤ 250 ms`.
3. Record `t2` when the command returns and assert `t2 − t0 ≤ 1 000 ms`; assert the `released` record exists at `t2`.
4. Repeat five times and assert the median and the maximum both hold; record every sample in the output.
5. Assert the timing is not achieved by skipping the release: the record count equals the iteration count.
6. Assert the wait path polls at ≤ 250 ms granularity (the delivered cancellation poll), so the bound is structural rather than incidental.

**Expected Outcome**:
- The stop is prompt and bounded, and the bound is met while still appending the release.

**Notes / Clarifications**:
- On a pathologically slow host the case is reported as `Semi-automated` with the recorded samples, per GAP-T6; it is never deleted or silently relaxed.

#### TC-DAEMON-122 - Status and live-status latency and output bounds hold

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR-4, NFR-6, NFR-11
**Test Type(s)**: Performance, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-status-performance.test.ts` **(new)**; `tests/golden/daemon-status-matrix.test.ts` **(control)**
**Tags**: @perf, @daemon, @cli

**Preconditions**:
- A reference store and an injected transport with a declared response time of zero (the timeout is not consumed).

**Steps**:
1. Measure `daemon status` p95 over a declared iteration count; assert ≤ 1 000 ms.
2. Measure `daemon status --live` p95; assert ≤ 2 000 ms and record the delivered response timeout used.
3. Assert the machine payload is within the delivered byte bound and the human rendering within the delivered line bound for every status fixture.
4. Assert the p95 measurement excludes process startup by measuring the command function directly, and record the method in the output.
5. Assert no status fixture appends a record (read-only) and that the output is byte-identical across two runs for the same fixture.
6. Record the environment and the iteration count (GAP-T6).

**Expected Outcome**:
- The mounted read side is fast enough to be usable and bounded in output, with the method disclosed.

**Notes / Clarifications**:
- The install/uninstall 2 000 ms bound is asserted in `TC-DAEMON-100` by excluding the supervisor runner from the measurement.

#### TC-DAEMON-123 - No new output carries sensitive content and the only new value is an absolute path

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-5, NFR-8, NFR-10
**Test Type(s)**: Checks, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/daemon-privacy.test.ts` **(new — create; the file does not exist in the delivered tree, so this is not an update)**; `tests/checks/fixture-privacy.test.ts` **(control)**
**Composition under test**: both shapes — a directly composed `createDaemonCommandRuntime` with a recording process port for the spawn-environment canary assertion, and the production composer with the `supervisor` fact for the unit-text assertion.
**Tags**: @privacy, @security, @checks

**Preconditions**:
- Fabricated canaries planted in every field that could carry content (brand working name, repository path, lane ref, question text, evidence summary), plus a canary credential in the injected credential port.

**Steps**:
1. Run every mounted path (start receipt, stop result, status, live status, install, uninstall, all help pages) with the canaries present; assert no canary, token, prompt, transcript, diff, or repository content appears in machine or human output.
2. Assert the spawn environment's keys are exactly the declared set: the state-directory variable (whose value is an absolute directory path inside the temp root), the composing `PATH`, `HOME`/`USERPROFILE`, and the working-name override when set — and that no key carries a credential, token, transcript, diff, or repository content. The forwarded values are compared byte-for-byte against the injected facts, so "forwarded unchanged" is asserted rather than assumed.
3. Assert the unit text contains only the absolute entry path and the resolved directory as external values, with no credential, content, or forwarded `PATH`/`HOME` line (the unit's environment binding stays the single state-directory variable).
4. Assert every daemon record written by the mount contains only identities, paths, counts, durations, pids, and closed-vocabulary values.
5. Assert the lock token is never rendered by any mounted path.
6. Run the delivered secret-read-boundary and privacy suites unmodified.

**Expected Outcome**:
- The mount adds no sensitive surface: the only environment value it introduces into a contract is an absolute directory path, and the re-entry set is the composing process's own values forwarded unchanged.

**Notes / Clarifications**:
- The spawn-environment assertion is the criterion's own wording: the path value is the only new contract value, while `PATH`, `HOME`/`USERPROFILE`, and the override are the caller's own and are forwarded unchanged (AC-NFR-5, NFR-10).
- `TC-DAEMON-040` asserts the same key set from the composition side with more fixtures; this case asserts it as a privacy property under canaries.

#### TC-DAEMON-124 - Install is idempotent, stop is a `noop` when released, and a live start refuses

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-6, NFR-9, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-idempotence.test.ts` **(new)**
**Tags**: @backend, @idempotence, @daemon

**Preconditions**:
- A supported install fixture with a temp configuration root; a released-instance store fixture; a live-instance store fixture with a positive pid.

**Invocation shape**: handler — `install`, `stop`, and `start` are invoked on the composed program's command handlers (no `runEntrypoint`); selection and `fallback.internal` are not asserted at this phase (`TC-DAEMON-015`, Phase-6 gate).

**Steps**:
1. Run `daemon install` twice; assert the second returns `result=installed` at exit `0` with byte-identical unit content and exactly one unit file and one marker (no duplicate, no rewrite churn beyond the idempotent write).
2. Assert the second install did not enable linger twice in a way that changes state (the recorded command sequence is idempotent at the adapter boundary).
3. Run `daemon stop --mode drain` against the released fixture; assert `result=noop` at exit `0` with zero signal calls.
4. Start a daemon in-process over the live fixture; run a second `daemon start`; assert `daemon.already-running` at exit `1` (the delivered `user-validation` projection class for that identity — not `2`) and that the instance-record count is unchanged (nothing appended).
5. Assert the refusal names the holder evidence (the recorded pid or instance) and does not print a token.
6. Assert `daemon.takeover-refused` is reachable for the live-lock case at exit `1` (also `user-validation`) and that no takeover occurred (the original instance record is still the latest acquisition).

**Expected Outcome**:
- The three repeated operations are safe: install idempotent, stop noop, start refused with nothing appended.

**Notes / Clarifications**:
- The already-running identity is delivered; this case proves the mount reaches it through the shipped binary.
- `daemon.already-running` and `daemon.takeover-refused` are both `user-validation` rows in the delivered error table, so both project to exit `1`; a case asserting `2` would be asserting an identity class the table does not declare.

## 6. Environments and Test Data

| Environment | Runtime / tool | Invocation | Scope |
|---|---|---|---|
| Local development | Bun `1.4.4` (repo pin), pnpm `10.18.3` | `bun test tests/behaviour/daemon-*.test.ts`, `bun test tests/structure/daemon-*.test.ts`, `bun test tests/checks/daemon-*.test.ts` | Behaviour, structure, checks, mutants |
| Local invariants | Bun | `bun run scripts/checks/{help-guide-coverage,prompt-conformance,error-table-sync,ambient-globals,workspace-entrypoints,secret-read-boundary}.ts` | Help/parity, prompt conformance, binding, purity, boundaries, secret boundary |
| Local integration | Bun | `bun test tests/conformance/daemon-mount/real-reentry.test.ts` | The one bounded real-child smoke (`TC-DAEMON-039`) |
| CI `ts-test` | Bun `1.4.4` | `pnpm test` after `pnpm install --frozen-lockfile` | Every `*.test.ts`, including the new suites |
| CI `ts-boundaries` | Bun | `pnpm build`; `pnpm check:boundaries` | Dependency-cruiser rules, ambient globals, workspace entrypoints, fixture-coverage meta-check |
| CI aggregate | Bun | `pnpm check` (lint → format:check → typecheck → test → check:boundaries → check:prompt → check:help → exports-parity); `git diff --check` | The full gate battery |
| Manual host verification | bash + `systemctl --user` | `TC-DAEMON-105` procedure; record in §10 | Real user-manager load and removal inside a temp `XDG_CONFIG_HOME` |

**Test data.**

- **State roots** live under `tests/fixtures/daemon/mount-states.ts` (new) as committed case definitions: verified-empty; live/fresh (`acquired` + matching heartbeat strictly inside staleness); at-bound (age exactly `lockStalenessMs`, expected degraded and fold `stale`); stale (age `lockStalenessMs + 1`); `taken-over`; `released` with `releaseReason=drain`; `immediate-stop`; orphan heartbeat without an instance (expected degraded, fold `running`); heartbeat from a different instance (expected degraded, fold `running`); torn instance payload; unknown instance operation; malformed heartbeat; missing `instanceId`; permission-denied root; and the four pid fixtures (`0`, `-1`, `1.5`, non-numeric). Each case declares the expected marker array and the expected status fold state, so the owned/divergent partition is a data property rather than a comment.
- **Re-entry and state-directory environment fixtures** live in the same file: `env-forwarded` (`PATH` + `HOME` + no override), `env-forwarded-override` (`PATH` + `HOME` + non-empty working-name override), `env-userprofile` (`HOME` empty, `USERPROFILE` set), `env-stripped-path` (no `PATH`, `HOME` present, no state binding), `env-stripped-home` (`PATH` present, `homeDirectory = ""`, no `HOME`, no `USERPROFILE`, no state binding — the faithful unresolvable fixture, never a silently injected home), `env-stripped-both` (no `PATH`, `homeDirectory = ""`, an absolute state binding, so the override wins). Each declares the expected forwarded key set, the expected key order (state binding last where present), and the expected verdict: `0` for the first three; `daemon.state-recovery-failed` at exit `2` for `env-stripped-path` and `env-stripped-both`; and, for `env-stripped-home`, **no spawn** and the unavailable runtime's `config.value.invalid` at exit `1`.
- **Mount harness** lives in `tests/fixtures/daemon/mount-harness.ts` (new) and exposes **two** entry points so a case never routes an undeclared field through the production composer (A2-5, §4 rule 10):
  - `runProduction(...)` calls `createProductionComposer` with only the facts that type declares (the two new optional facts are `daemonEntry` and `supervisor`; `environment`, `cwd`, `homeDirectory`, `workingName`, `processId`, and `signalHost` already exist) and then has **two** invocation modes that a case must choose explicitly: `invokeHandler(...)` runs the named `daemon` command's handler on the returned program (or `runCli` with that program), which is the mode for every Phase 2-5 case; `invokeEntrypoint(...)` runs the same program through `runEntrypoint`, which is permitted only for the Phase-6 selection/help cases (`TC-DAEMON-010` step 4, `-011`, `-012`, `-014`, `-015`, `-114`). It observes only the program, the injected supervisor, and the filesystem.
  - `runRuntime(...)` calls `createDaemonCommandRuntime` directly with the delivered `DaemonComposition` fields, including the recording process port, the injected transport and socket path, the fake clock, the observer store handle, and the `platform` value.
  - Both entry points record the brand, environment record, home directory, process id, signal host, clock, store reads and appends, spawn requests (including the exact environment object and its key insertion order), signal calls (pid and signal), listener registrations and removals, transport connects, supervisor commands, `isAlive` and `sleep` calls, and the composer invocation count. The recording process port inside the harness never spawns, signals, or probes a real process; the recording supervisor port never invokes `systemctl`.
- **Configuration fixtures** reuse `tests/fixtures/config/**`, with the `daemon` branch cases: absent branch, explicit socket path and heartbeat interval, unknown key, wrong type, wrong domain, and the state-directory override cases (absolute, absent, empty, relative).
- **Help fixtures** reuse `tests/fixtures/help-guide/coverage.json` (updated) and `tests/fixtures/entrypoint/programs.ts` (unchanged; its `HELP_TUPLES` and `syntheticPromptProgram` derive from `allHelpEntries()` and `PROMPT_REQUIRED_COMMANDS`, so the daemon tuples appear automatically).
- **Goldens** live under `tests/fixtures/daemon/mount-golden/` for the status matrices that this change introduces (new cases only). The delivered `tests/golden/daemon-{lifecycle,install,status-matrix}.test.ts`, `queue-list.test.ts`, and `lanes-list.test.ts` goldens are read-only controls; any diff is a defect unless it is a newly reviewed mount case.
- **Privacy canaries** are fabricated strings planted in the brand working name, the repository path, a lane ref, a question text, and an evidence summary, plus a fabricated credential in the credential port; every suite asserts the canary never appears in a receipt, a record, a unit, or an error envelope.
- **Mutants** live under `tests/fixtures/daemon/mount-mutants/**` and are applied to temp copies or in-memory strings; the live tree is never mutated. Each mutant declares the suite and assertion it must trip: `conditional-registration` (family registered only with an entry path), `hardcoded-degradation` (the constant marker reinstated), `captured-degradation` (resolver evaluated once at composition), `literal-socket` (a hardcoded socket name or interval), `binding-not-last` (the state binding merged first so a forwarded look-alike wins), `spawn-without-forwarded-env` (the delivered single-variable spawn kept, so a `#!/usr/bin/env bun` entry cannot resolve), `signal-without-pid-check`, `signal-negative-pid` (group form), `spawn-with-full-env` (ambient keys beyond the declared set), `fabricated-reachability` (orphan heartbeat treated as live), `owner-ignored` (freshness consulted without the `instanceId` match), `stale-inclusive` (`<=` at the bound), `duplicate-terminal-record` (a second stop on a double signal), `release-skip-cancellation`, `holder-not-removed` (listener leak), `bare-execstart`, `unit-under-state-dir`, `xdg-relative-joined`, `install-empty-executable`, `uninstall-broad-delete`, and `help-composer-invoked`.

**Isolation and cleanup.**

- Every filesystem-touching suite creates its root with `mkdtemp` under `$REPO_ROOT/tmp/` (the delivered shape) or `tmpdir()` where an existing suite already does, sets `HOME`, `XDG_CONFIG_HOME`, and `<PREFIX>_STATE_DIR` inside it, and removes the root in `afterEach`/`finally` including on failure; a guard rejects any root equal to `process.cwd()`, the real user state directory, or the real `$HOME`.
- Store handles and edges are closed in `finally`; a fresh reader handle over the same root is opened only after the writer closes.
- Injected fakes replace the clock, ids, brand, environment, process port, supervisor port, transport, config branch, and streams. No default suite reads the real `process.env`, `$HOME`, network, or a live harness store.
- The live worktree is never written; read-only and golden suites snapshot `git status --porcelain` before and after and assert it is unchanged (the integration case also asserts this).
- No default suite sends a real signal, spawns a real child, opens a socket, or installs a unit. The single real-child case is confined to `tests/conformance/daemon-mount/` and is bounded by a temp root, a 20 000 ms hard timeout, and a `finally` reap; the single real-systemd case is manual (GAP-T4).

## 7. Automation Plan and Implementation Mapping

**File-inventory authority.** The scenario-level file names in this table are the *intended grouping before consolidation*: each name is the file that would exist if one criterion produced one suite. The delivery plan's `TEST-SURFACE CONSOLIDATION` block is the authoritative file inventory — it groups these cases into the suites that actually ship (e.g. the `daemon-start-detached.test.ts` suite reusing its own name for `daemon-start-detached` and absorbing `daemon-start-readiness-timeout.test.ts`, `daemon-start-in-process.test.ts`, and `daemon-instance-pid.test.ts`; `daemon-degradation-projection.test.ts` absorbing the queue/lanes degradation, watch, agreement, torn, and additivity suites), keeps every TC name as its own `test(...)` title, and drops no assertion, counter, fixture, or negative control. Where the two disagree about a path, the plan's block wins and this table's name is the pre-consolidation grouping; where they disagree about an assertion, this table wins and the plan is defective. **Rename carried into this plan (A3-2):** the help suite ships as `tests/behaviour/daemon-mount-help.test.ts`; the earlier `daemon-help.test.ts` grouping name is superseded and appears in this plan only inside these rename statements.

**Composition under test (DM-5 seam discipline).** `ProductionCompositionFacts` gains exactly **two** optional facts (`daemonEntry?`, `supervisor?`); no case may inject a process port, a transport, a clock, a store handle, or a `platform` through the production composer, and none is added as a third fact. Each case therefore declares one of three shapes (A2-5):

| Shape | Cases | Basis |
|---|---|---|
| **P** — production composer (`createProductionComposer`) | 010, 014, 015, 054, 077, 090, 100, 101, 103, 104, 124, 105 (real binary, manual) | The case asserts a composition-level fact and needs only the declared facts (`daemonEntry`, `supervisor`, `environment`, `cwd`, `homeDirectory`, `workingName`, `processId`, `signalHost`). |
| **D** — directly composed `createDaemonCommandRuntime` | 030, 031, 032, 033, 034, 035, 036, 037, 038, 039, 051, 060, 061, 062, 091, 092, 102, 120, 121, 122 | The case needs an injected process port, transport, clock, store handle, or `platform` — all existing `DaemonComposition` fields. It proves the runtime contract, not the composer's wiring. |
| **P+D** — both, from the same facts, equal asserted | 040, 041, 050, 052, 053, 063, 123 | One half needs a production fact, the other an I/O seam; the two are composed from the same facts and must agree (rule 10). |
| **—** — neither composer | 011, 012, 013, 070, 071, 072, 073, 074, 075, 076, 078, 110, 111, 112, 113, 114 | Pure resolver, queue/lanes runtime, guards, goldens, and structure scans. |

TC-DAEMON-105 is a manual host procedure: the Phase-3 record runs the composed `install`/`uninstall` handlers, and the real-binary form is re-run at the Phase-6 gate; it uses no automated test seam.

**Invocation shape per case (RF3-1) — the `handler` / `entrypoint` axis of the inventory.** `PROMPT_REQUIRED_COMMANDS` holds the delivered 16 commands until Phase 6 adds `daemon`, and `selectPromptRequiredProgram` returns exactly that set and drops extras, so **any** invocation through `runEntrypoint` answers `fallback.internal` at exit `2` before the membership commit. Every case that exercises a command therefore declares one shape, and every case in the file inventory below has exactly one row here:

- **`handler`** — compose the program (production composer or `createDaemonCommandRuntime`) and invoke the `daemon` command's handler directly, or call `runCli` with that same program. No step depends on `daemon` being prompt-required, and no step asserts `selectPromptRequiredProgram` or `fallback.internal`.
- **`entrypoint`** — invoke through `runEntrypoint` against `PROMPT_REQUIRED_PROGRAM`/`PROMPT_REQUIRED_COMMANDS`. Permitted only at the Phase-6 gate and later, where `daemon` is a member and selection is a real assertion.
- **`n/a`** — the case invokes no command (pure predicate, guard, contract, or suite-run case).

| TC ID | Phase | Invocation shape | Basis |
|---|---|---|---|
| TC-DAEMON-030 | 2 | `handler` | direct runtime; the spawn request is captured, not routed through the entrypoint |
| TC-DAEMON-031 | 2 | `handler` | direct runtime; poll and store counters |
| TC-DAEMON-032 | 2 | `handler` | direct runtime; zero-spawn counter |
| TC-DAEMON-040 | 2 | `handler` | composed environment captured from the handler's spawn request |
| TC-DAEMON-041 | 2 | `handler` | fixtures (a)/(c) direct runtime, fixture (b) production program's handler; selection is `TC-DAEMON-015`'s |
| TC-DAEMON-050 | 2 | `handler` | production program's handler plus the observer recorder |
| TC-DAEMON-051 | 2 | `handler` | direct runtime; captured spawn environment |
| TC-DAEMON-052 | 2 | `handler` | composed handler; resolved directory read from the composition |
| TC-DAEMON-053 | 2 | `handler` | production program's handler; registration only, no selection claim |
| TC-DAEMON-054 | 2 | `handler` | all nine invocations run the composed program's handlers |
| TC-DAEMON-060 | 2 | `handler` | direct runtime; status handler over injected transport |
| TC-DAEMON-061 | 2 | `handler` | direct runtime; live-status handler |
| TC-DAEMON-062 | 2 | `handler` | direct runtime; three transport fixtures |
| TC-DAEMON-063 | 2 | `handler` | production program's `status`/`start` handlers plus the direct runtime |
| TC-DAEMON-090 | 2 | `handler` | production program's `start`/`status` handlers |
| TC-DAEMON-122 | 2 | `handler` | status handlers measured directly |
| TC-DAEMON-100 | 3 | `handler` | composed `install` handler |
| TC-DAEMON-101 | 3 | `handler` | composed `install` handler |
| TC-DAEMON-102 | 3 | `handler` | direct runtime; `platform` fixture |
| TC-DAEMON-103 | 3 | `handler` | composed `install`/`uninstall` handlers |
| TC-DAEMON-104 | 3 | `handler` | composed `install` handler |
| TC-DAEMON-124 | 3 | `handler` | composed `install`/`stop`/`start` handlers |
| TC-DAEMON-105 | 3 | `handler` (Phase-3 record) / `entrypoint` (Phase-6 re-run) | manual procedure over the composed handlers, then the real binary after membership |
| TC-DAEMON-033 | 4 | `handler` | direct runtime; recorded signal host |
| TC-DAEMON-034 | 4 | `handler` | direct runtime; recorded signal host |
| TC-DAEMON-035 | 4 | `handler` | direct runtime; no signal host |
| TC-DAEMON-036 | 4 | `handler` | direct runtime; two store handles |
| TC-DAEMON-037 | 4 | `handler` | direct runtime; failing release store |
| TC-DAEMON-038 | 4 | `handler` | direct runtime; double delivery |
| TC-DAEMON-039 | 4 | `handler` | the real child runs `createDaemonMainEntry`, never `runEntrypoint` |
| TC-DAEMON-091 | 4 | `handler` | direct runtime; signal counter |
| TC-DAEMON-092 | 4 | `handler` | direct runtime; signal log |
| TC-DAEMON-121 | 4 | `handler` | direct runtime; stop latency |
| TC-DAEMON-070 | 5 | `handler` (queue/lanes) | no daemon-family membership is involved |
| TC-DAEMON-071 | 5 | `handler` (queue/lanes) | same |
| TC-DAEMON-072 | 5 | `handler` (queue/lanes) | same |
| TC-DAEMON-073 | 5 | `handler` (queue/lanes) | same |
| TC-DAEMON-074 | 5 | `handler` (queue/lanes watch) | iteration seam, not the entrypoint |
| TC-DAEMON-075 | 5 | `n/a` | pure predicate plus the delivered `readDaemonStatus` fold |
| TC-DAEMON-076 | 5 | `handler` (queue/lanes) | same |
| TC-DAEMON-077 | 5 | `handler` (queue/lanes over the production program) + source scan | the composed resolver is read through the handler |
| TC-DAEMON-078 | 5 | `handler` (queue/lanes) + direct fold | both surfaces read the same store directly |
| TC-DAEMON-112 | 5 | `handler` (queue/lanes) | byte-identity of the handler payloads |
| TC-DAEMON-120 | 5 | `handler` (queue/lanes) | instrumented counters around the handler |
| TC-DAEMON-010 | 6 | `entrypoint` | step 4 invokes `["daemon","status"]` through `runEntrypoint`; step 3 asserts selection |
| TC-DAEMON-011 | 6 | `entrypoint` | help surfaces rendered through `runEntrypoint` |
| TC-DAEMON-012 | 6 | `entrypoint` | per-subcommand `--help` through `runEntrypoint` |
| TC-DAEMON-013 | 6 | `n/a` | guard suites and fixtures; invokes no command |
| TC-DAEMON-014 | 6 | `entrypoint` | selection asserted for all three fact sets |
| TC-DAEMON-015 | 6 | `entrypoint` | the selection/containment case; supersedes the half Phases 2-5 must not assert |
| TC-DAEMON-114 | 6 | `entrypoint` | help/version purity through `runEntrypoint` |
| TC-DAEMON-110 | 8 | `n/a` | structure, table, and exit-code checks |
| TC-DAEMON-111 | 8 | `n/a` | structure and type-level contract checks |
| TC-DAEMON-113 | 8 | `n/a` | suite runs plus the review-attested diff |
| TC-DAEMON-123 | 8 | `handler` (`entrypoint` permitted) | runs the mounted paths over composed handlers; the membership already exists at this phase |

Phases 1 and 7 map no case. A Phase 2-5 case that finds itself needing `runEntrypoint` is a plan defect, not a licence to weaken the assertion: the correct move is to add the missing proof to `TC-DAEMON-015` or move the assertion to a later phase.

| TC ID | Test file to create or update | Execution command | Mocking / fixtures | Status |
|---|---|---|---|---|
| TC-DAEMON-010 | `tests/structure/daemon-production-composition.test.ts` (new); `tests/behaviour/entrypoint-composition.test.ts` (update) | `bun test tests/structure/daemon-production-composition.test.ts tests/behaviour/entrypoint-composition.test.ts` | Injected facts; temp `HOME`; `EXPECTED` row; **both** absence loops (`:73` `["state","mcp","daemon","config","doctor"]` → `["state","mcp","config","doctor"]`, and `:86` `["state","mcp","daemon","frobnicate"]` → `["state","mcp","frobnicate"]`), plus the false doc comment; conditional-registration mutant | To Implement |
| TC-DAEMON-011 | `tests/behaviour/daemon-mount-help.test.ts` (new — ships under this name, renamed from the earlier `daemon-help.test.ts` grouping); `tests/behaviour/entrypoint-help.test.ts` (update) | `bun test tests/behaviour/daemon-mount-help.test.ts tests/behaviour/entrypoint-help.test.ts` | `countingComposer`; synthetic brand; help bounds | To Implement |
| TC-DAEMON-012 | `tests/behaviour/daemon-mount-help.test.ts` (new — ships under this name) | `bun test tests/behaviour/daemon-mount-help.test.ts` | `HELP_TUPLES` derived from `allHelpEntries()`; parser program | To Implement |
| TC-DAEMON-013 | `tests/fixtures/help-guide/coverage.json` (update); `tests/checks/doc-conformance.test.ts` (update); `doc/planning/oss-tooling/milestones/m1/commands/daemon.md` (update, phase 7) | `bun test tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts tests/checks/doc-conformance.test.ts`; `bun run scripts/checks/help-guide-coverage.ts` | Temp-copy inventory and page mutants | Existing – Update |
| TC-DAEMON-014 | `tests/structure/daemon-production-composition.test.ts` (new) | `bun test tests/structure/daemon-production-composition.test.ts` | Three fact sets; determinism comparison; conditional-registration mutant | To Implement |
| TC-DAEMON-015 | `tests/structure/daemon-production-composition.test.ts` (new); `tests/behaviour/entrypoint-composition.test.ts` (update) | `bun test tests/structure/daemon-production-composition.test.ts tests/behaviour/entrypoint-composition.test.ts` | **Production composer (`P`)**, invoked through `runEntrypoint`: full and unresolvable fact sets; selected-set equality with `PROMPT_REQUIRED_COMMANDS`; the nine exit-`1` invocations; help/version purity; membership-omission and conditional-registration mutants | To Implement |
| TC-DAEMON-030 | `tests/behaviour/daemon-start-detached.test.ts` (new); `tests/fixtures/daemon/mount-harness.ts` (new) | `bun test tests/behaviour/daemon-start-detached.test.ts` | **Direct runtime (`D`)**: recording process port + fake clock; fake child writes the instance; declared environment set with the state binding last; `spawn-with-full-env` mutant | To Implement |
| TC-DAEMON-031 | `tests/behaviour/daemon-start-readiness-timeout.test.ts` (new) | `bun test tests/behaviour/daemon-start-readiness-timeout.test.ts` | **Direct runtime (`D`)**: silent fake child; clock `sleep` counter; record-count oracle | To Implement |
| TC-DAEMON-032 | `tests/behaviour/daemon-start-in-process.test.ts` (new) | `bun test tests/behaviour/daemon-start-in-process.test.ts` | **Direct runtime (`D`)**: composition with no `daemonEntry`; recording process port; spawn counter | To Implement |
| TC-DAEMON-033 | `tests/behaviour/daemon-foreground-lifetime.test.ts` (new) | `bun test tests/behaviour/daemon-foreground-lifetime.test.ts` | Recording signal host; fake clock; delivering-lane fixture; listener counters | To Implement |
| TC-DAEMON-034 | `tests/behaviour/daemon-foreground-lifetime.test.ts` (new) | `bun test tests/behaviour/daemon-foreground-lifetime.test.ts` | `SIGINT` delivery; reopened store handle for the noop | To Implement |
| TC-DAEMON-035 | `tests/behaviour/daemon-foreground-lifetime.test.ts` (new) | `bun test tests/behaviour/daemon-foreground-lifetime.test.ts` | No signal host; loop-entry counters; presence control | To Implement |
| TC-DAEMON-036 | `tests/behaviour/daemon-stop-cross-process.test.ts` (new) | `bun test tests/behaviour/daemon-stop-cross-process.test.ts` | Two store handles over one root; recording process port; lane fixtures | To Implement |
| TC-DAEMON-037 | `tests/behaviour/daemon-foreground-release-failure.test.ts` (new) | `bun test tests/behaviour/daemon-foreground-release-failure.test.ts` | Store fake failing the `released` append; cancellation-order recorder; listener counters | To Implement |
| TC-DAEMON-038 | `tests/behaviour/daemon-foreground-double-signal.test.ts` (new) | `bun test tests/behaviour/daemon-foreground-double-signal.test.ts` | Double delivery; terminal-record counter | To Implement |
| TC-DAEMON-039 | `tests/conformance/daemon-mount/real-reentry.test.ts` (new, integration-marked) | `bun test tests/conformance/daemon-mount/real-reentry.test.ts` | Temp root; real `createNodeProcessPort`; `#!/usr/bin/env bun` fixture entry (mode `0755`); injected `PATH`/`HOME`; env probe file; 20 s timeout; `finally` reap | To Implement |
| TC-DAEMON-040 | `tests/behaviour/daemon-start-detached.test.ts` (new); `tests/behaviour/daemon-state-scope.test.ts` (new) | `bun test tests/behaviour/daemon-start-detached.test.ts tests/behaviour/daemon-state-scope.test.ts` | Four environment fixtures; key-order assertion; ambient-environment read guard; `binding-not-last` and `spawn-without-forwarded-env` mutants | To Implement |
| TC-DAEMON-041 | `tests/behaviour/daemon-start-env-stripped.test.ts` (new) | `bun test tests/behaviour/daemon-start-env-stripped.test.ts` | **P+D**: production composer for the no-home fixture; direct runtime for the stripped-`PATH` spawn assertions; three fixtures (stripped `PATH` + home → exit `2`; `homeDirectory = ""` + no override → no spawn, exit `1`; stripped `PATH` + absolute override → exit `2`); sleep counter; root-level-candidate oracle; restored-environment control | To Implement |
| TC-DAEMON-050 | `tests/behaviour/daemon-state-scope.test.ts` (new) | `bun test tests/behaviour/daemon-state-scope.test.ts` | Observer recorder for store/lock/settings/socket/scope/composition; override and default fixtures | To Implement |
| TC-DAEMON-051 | `tests/behaviour/daemon-state-scope.test.ts` (new) | `bun test tests/behaviour/daemon-state-scope.test.ts` | Captured spawn environment fed back through `resolveStateDirectoryScope`; forwarded look-alike key; scope digest oracle | To Implement |
| TC-DAEMON-052 | `tests/behaviour/daemon-state-scope.test.ts` (new); `tests/structure/state-scope.test.ts` (control) | `bun test tests/behaviour/daemon-state-scope.test.ts tests/structure/state-scope.test.ts` | Template equality; trailing-separator normalization | To Implement |
| TC-DAEMON-053 | `tests/behaviour/daemon-state-scope.test.ts` (new) | `bun test tests/behaviour/daemon-state-scope.test.ts` | **P+D**: relative override with a home present; containment counter; resolution-edge report; suppression mutant | To Implement |
| TC-DAEMON-054 | `tests/behaviour/daemon-state-scope.test.ts` (new); `packages/cli/src/production.ts` (source scan) | `bun test tests/behaviour/daemon-state-scope.test.ts` | **Production composer (`P`)**: `homeDirectory = ""`, no `HOME`/`USERPROFILE`, no override; all five subcommands; recording supervisor fact; source scan of the unresolvable branch; unique root-level-candidate and socket oracles; home-present control; root-level-template mutant | To Implement |
| TC-DAEMON-060 | `tests/behaviour/daemon-status-durable.test.ts` (new); `tests/golden/daemon-status-matrix.test.ts` (control) | `bun test tests/behaviour/daemon-status-durable.test.ts tests/golden/daemon-status-matrix.test.ts` | **Direct runtime (`D`)**: four store fixtures via two handles; reachable and refusing injected transports; supervise-only composition; connect counter | To Implement |
| TC-DAEMON-061 | `tests/behaviour/daemon-status-live.test.ts` (new) | `bun test tests/behaviour/daemon-status-live.test.ts` | **Direct runtime (`D`)**: injected transport answering the probe; connect counter | To Implement |
| TC-DAEMON-062 | `tests/behaviour/daemon-status-live.test.ts` (new) | `bun test tests/behaviour/daemon-status-live.test.ts` | **Direct runtime (`D`)**: unreachable, stale, and fresh transport/store fixtures; identity/exit oracle | To Implement |
| TC-DAEMON-063 | `tests/behaviour/daemon-control-plane-config.test.ts` (new); `tests/behaviour/config-*.test.ts` (control) | `bun test tests/behaviour/daemon-control-plane-config.test.ts tests/behaviour/config-*.test.ts` | **P+D**: production composer for the configured/unavailable branch; direct runtime with an injected clock for heartbeat ordinals; literal-socket mutant | To Implement |
| TC-DAEMON-070 | `tests/behaviour/queue-degradation-derived.test.ts` (new); `tests/behaviour/lanes-degradation-derived.test.ts` (new) | `bun test tests/behaviour/queue-degradation-derived.test.ts tests/behaviour/lanes-degradation-derived.test.ts` | Live/fresh and taken-over fixtures; just-below cell; connect/probe/sleep counters | To Implement |
| TC-DAEMON-071 | `tests/behaviour/queue-degradation-derived.test.ts` (new); `tests/behaviour/lanes-degradation-derived.test.ts` (new) | `bun test tests/behaviour/queue-degradation-derived.test.ts tests/behaviour/lanes-degradation-derived.test.ts` | Released and immediate-stop fixtures with a fresh heartbeat | To Implement |
| TC-DAEMON-072 | `tests/behaviour/queue-degradation-derived.test.ts` (new); `tests/behaviour/lanes-degradation-derived.test.ts` (new) | `bun test tests/behaviour/queue-degradation-derived.test.ts tests/behaviour/lanes-degradation-derived.test.ts` | Verified-empty and orphan-heartbeat fixtures (marker only; the fold claim is 078's) | To Implement |
| TC-DAEMON-073 | `tests/behaviour/queue-degradation-derived.test.ts` (new); `tests/behaviour/lanes-degradation-derived.test.ts` (new) | `bun test tests/behaviour/queue-degradation-derived.test.ts tests/behaviour/lanes-degradation-derived.test.ts` | At-bound and beyond-bound fixtures; doubled-staleness control; `stale-inclusive` mutant | To Implement |
| TC-DAEMON-074 | `tests/behaviour/daemon-degradation-watch.test.ts` (new); `tests/behaviour/{queue-watch,lanes-watch}.test.ts` (controls) | `bun test tests/behaviour/daemon-degradation-watch.test.ts tests/behaviour/queue-watch.test.ts tests/behaviour/lanes-watch.test.ts` | Injected iteration seam/clock; three-iteration sequence; resolver call counter | To Implement |
| TC-DAEMON-075 | `tests/behaviour/daemon-degradation-agreement.test.ts` (new) | `bun test tests/behaviour/daemon-degradation-agreement.test.ts` | 4×4 owned-cell matrix plus the no-instance/no-heartbeat cell (unowned cells excluded by an assertion); shared `readDaemonStatus`; doubled-staleness re-run | To Implement |
| TC-DAEMON-076 | `tests/behaviour/daemon-degradation-torn.test.ts` (new); `tests/checks/daemon-hermetic.test.ts` (update) | `bun test tests/behaviour/daemon-degradation-torn.test.ts tests/checks/daemon-hermetic.test.ts` | Torn/unknown/malformed/permission fixtures; per-read fault injection; fabrication mutant | To Implement |
| TC-DAEMON-077 | `tests/structure/daemon-degradation-wiring.test.ts` (new); `tests/checks/daemon-mutants.test.ts` (update); `tests/types/daemon-mount.type-test.ts` (new) | `bun test tests/structure/daemon-degradation-wiring.test.ts tests/checks/daemon-mutants.test.ts`; `pnpm typecheck` | Production composition over live and released stores; source scan; hardcoded-degradation and captured-degradation mutants | To Implement |
| TC-DAEMON-078 | `tests/behaviour/queue-degradation-derived.test.ts` (new); `tests/behaviour/lanes-degradation-derived.test.ts` (new); `tests/behaviour/daemon-degradation-agreement.test.ts` (new) | `bun test tests/behaviour/queue-degradation-derived.test.ts tests/behaviour/lanes-degradation-derived.test.ts tests/behaviour/daemon-degradation-agreement.test.ts` | Orphan-heartbeat and foreign-owner fixtures with a fresh beat; shared `readDaemonStatus` fold in the same test body; doubled-staleness control; `owner-ignored` mutant | To Implement |
| TC-DAEMON-090 | `tests/behaviour/daemon-instance-pid.test.ts` (new) | `bun test tests/behaviour/daemon-instance-pid.test.ts` | `processId: 4242`; fresh reader handle; receipt/status agreement; fallback control | To Implement |
| TC-DAEMON-091 | `tests/behaviour/daemon-stop-pid-refusal.test.ts` (new) | `bun test tests/behaviour/daemon-stop-pid-refusal.test.ts` | Four pid fixtures; signal counter; kill-path source scan; positive control | To Implement |
| TC-DAEMON-092 | `tests/behaviour/daemon-stop-signal-target.test.ts` (new) | `bun test tests/behaviour/daemon-stop-signal-target.test.ts` | Recording port with failing mode; signal log; negative-pid mutant | To Implement |
| TC-DAEMON-100 | `tests/behaviour/daemon-install-identity.test.ts` (new); `tests/golden/daemon-install.test.ts` (control) | `bun test tests/behaviour/daemon-install-identity.test.ts tests/golden/daemon-install.test.ts` | Recording supervisor port; unit parser; delivered command sequence (unit → enable → linger → marker); bare-execstart and unit-under-state-dir mutants | To Implement |
| TC-DAEMON-101 | `tests/behaviour/daemon-install-config-root.test.ts` (new) | `bun test tests/behaviour/daemon-install-config-root.test.ts` | Four `XDG_CONFIG_HOME` fixtures; directory listings; xdg-relative-joined mutant | To Implement |
| TC-DAEMON-102 | `tests/behaviour/daemon-install-unsupported.test.ts` (new) | `bun test tests/behaviour/daemon-install-unsupported.test.ts` | **Direct runtime (`D`)**: `platform` set to `darwin`/`win32` (the field has no production fact); linger-failure supervisor port; directory equality; rollback sequence | To Implement |
| TC-DAEMON-103 | `tests/behaviour/daemon-uninstall.test.ts` (new) | `bun test tests/behaviour/daemon-uninstall.test.ts` | Owned plus unrelated unit/marker fixtures; disable counter; broad-delete mutant | To Implement |
| TC-DAEMON-104 | `tests/behaviour/daemon-install-no-entry.test.ts` (new) | `bun test tests/behaviour/daemon-install-no-entry.test.ts` | No `daemonEntry` (the required `binary` field is present); `renderSystemdUnit` spy records zero calls; empty directory listing | To Implement |
| TC-DAEMON-105 | Manual procedure; evidence in §10 | `TC-DAEMON-105` steps with `systemctl --user` under a temp `XDG_CONFIG_HOME` | Temp config root; no real `~/.config` write | Manual Only |
| TC-DAEMON-110 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts` (controls) | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Delivered table and documented rows, unmodified | Existing – Control |
| TC-DAEMON-111 | `tests/structure/{state-contract,daemon-contract,daemon-vocabulary}.test.ts` (controls); `tests/types/daemon-mount.type-test.ts` (new) | `bun test tests/structure/state-contract.test.ts tests/structure/daemon-contract.test.ts tests/structure/daemon-vocabulary.test.ts`; `pnpm typecheck` | Delivered schema constants and record kinds; optional-property type asserts | Existing – Update (types file new) |
| TC-DAEMON-112 | `tests/behaviour/daemon-degradation-additivity.test.ts` (new); `tests/behaviour/{queue-cli,lanes}.test.ts` and `tests/golden/{queue-list,lanes-list}.test.ts` (controls) | `bun test tests/behaviour/daemon-degradation-additivity.test.ts tests/behaviour/queue-cli.test.ts tests/behaviour/lanes.test.ts tests/golden/queue-list.test.ts tests/golden/lanes-list.test.ts` | Recorded baselines; array/omitted/resolver triple; union-dispatch pair | To Implement |
| TC-DAEMON-113 | Full delivered suite list from §2; the declared permitted update sites | `bun test tests/structure tests/behaviour tests/golden tests/checks tests/boundaries`; `git diff --name-only`; `git status --porcelain tests/golden tests/fixtures` | Unchanged controls; declared update set; review-attested diff (GAP-T1) | Existing – Control |
| TC-DAEMON-114 | `tests/behaviour/daemon-mount-help.test.ts` (new, purity half — ships under this name); `tests/behaviour/{entrypoint-help-isolation,entrypoint-version}.test.ts` (controls) | `bun test tests/behaviour/daemon-mount-help.test.ts tests/behaviour/entrypoint-help-isolation.test.ts tests/behaviour/entrypoint-version.test.ts` | Counting composer; armed read guard; empty temp directory listing | To Implement |
| TC-DAEMON-120 | `tests/behaviour/daemon-degradation-read-cost.test.ts` (new); `tests/checks/daemon-hermetic.test.ts` (update) | `bun test tests/behaviour/daemon-degradation-read-cost.test.ts tests/checks/daemon-hermetic.test.ts` | Instrumented store/transport/port/clock counters; same-run p95 baseline; unrelated-record scaling | To Implement |
| TC-DAEMON-121 | `tests/behaviour/daemon-foreground-stop-latency.test.ts` (new) | `bun test tests/behaviour/daemon-foreground-stop-latency.test.ts` | Injected clock for ordering; monotonic stopwatch for the bound; five samples; record count oracle | To Implement |
| TC-DAEMON-122 | `tests/behaviour/daemon-status-performance.test.ts` (new); `tests/golden/daemon-status-matrix.test.ts` (control) | `bun test tests/behaviour/daemon-status-performance.test.ts tests/golden/daemon-status-matrix.test.ts` | Reference store; injected transport; bounded output oracle | To Implement |
| TC-DAEMON-123 | `tests/checks/daemon-privacy.test.ts` (new — create; it does not exist in the delivered tree); `tests/checks/fixture-privacy.test.ts` (control) | `bun test tests/checks/daemon-privacy.test.ts tests/checks/fixture-privacy.test.ts`; `bun run scripts/checks/secret-read-boundary.ts` | **P+D**: direct runtime for the spawn-environment canary assertion, production composer with the `supervisor` fact for the unit text; privacy canaries in every content-bearing field | To Implement |
| TC-DAEMON-124 | `tests/behaviour/daemon-idempotence.test.ts` (new) | `bun test tests/behaviour/daemon-idempotence.test.ts` | Double install; released fixture; live fixture with a positive pid; record-count oracle; exit-`1` assertion for `daemon.already-running`/`daemon.takeover-refused` | To Implement |

**Fixture helper obligations:**

- `tests/fixtures/daemon/mount-harness.ts` (new) — the single in-process mount harness: injected brand/environment/home/process identity/signal host/process port/supervisor port/clock/transport/config branch/state root/store handle, plus counters for spawn requests, signal calls (pid and signal recorded), listener registrations and removals, transport connects, supervisor commands, store reads, store appends, `isAlive`, `sleep`, and composer invocations. It also exposes a `failRelease()` switch and a `failSignal()` switch.
- `tests/fixtures/daemon/mount-states.ts` (new) — the committed durable-state case set (empty, live, at-bound, stale, taken-over, released, immediate-stop, orphan heartbeat, foreign-instance beat, torn instance, unknown operation, malformed heartbeat, permission denied, and the four pid fixtures) with the expected marker array and fold state per case, plus the six re-entry environment fixtures and their expected key sets, key order, and start verdicts.
- `tests/fixtures/daemon/mount-golden/` (new) — normalized status matrices introduced by this change; explicit regeneration only.
- `tests/fixtures/daemon/mount-mutants/` (new) — the twenty-one mutant modules and their expected tripping suite/message listed in §6.
- `tests/fixtures/help-guide/coverage.json` (update) — the two daemon rows, each appended at the end of its array (`commands`, `referencePages`); the order is not normative, so the fixture is neither sorted nor deduplicated; the only fixture change permitted for the mount.
- **Reused unchanged**: `tests/fixtures/state/harness.ts` (`makeTempRoot`, `makeIdentity`, `openStore`, `removeRoot`, `createTestEdge`), `tests/fixtures/entrypoint/programs.ts`, `tests/fixtures/config/**`, `tests/golden/helpers.ts` (`bufferSink`, `SYNTHETIC_BRAND`), `tests/fixtures/queue/**`, `tests/fixtures/status/**`.
- **Not touched**: `tests/structure/content-inventory.test.ts` and `tests/structure/inventory.json`. This change adds no module to `packages/**` and no new published export — every edit lands in existing modules (`production.ts`, `bin/delivery-os.ts`, `daemon-compose.ts`, `edge.ts`, `help.ts`, `help/prompt-required-commands.ts`) — so the inventory stays a byte-identical control. If delivery introduces a new module or export, the same phase must add the inventory row and `pnpm check:boundaries` must stay green; that is a delivery constraint, not an open question.

**Expected gate battery for this change.**

1. Narrow iteration: `bun test tests/behaviour/daemon-*.test.ts tests/behaviour/entrypoint-*.test.ts tests/behaviour/queue-*.test.ts tests/behaviour/lanes*.test.ts tests/structure/daemon-*.test.ts tests/checks/daemon-*.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts tests/checks/doc-conformance.test.ts`.
2. Guards: `bun run scripts/checks/help-guide-coverage.ts`; `bun run scripts/checks/prompt-conformance.ts`; `bun run scripts/checks/error-table-sync.ts`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/workspace-entrypoints.ts`; `bun run scripts/checks/secret-read-boundary.ts`; `bun run scripts/checks/forbidden-literals.ts` (the daemon reference page is an already-registered planning document; no new registration is expected, and a required registration is a delivery finding rather than a plan change).
3. Boundaries: `bun test tests/boundaries`; `pnpm check:boundaries`.
4. Typecheck: `pnpm typecheck` (includes `tests/types/tsconfig.json` and therefore the new type-level file).
5. Goldens: `bun test tests/golden` — the delivered daemon/queue/lanes goldens are controls; only the new mount matrices may be added.
6. Aggregate: `mkdir -p "$PWD/tmp/tmpdir" && TMPDIR="$PWD/tmp/tmpdir" pnpm check` — lint → format:check → typecheck → full `bun test` → check:boundaries → check:prompt → check:help → exports-parity — plus `git diff --check`.
7. Integration-marked: `bun test tests/conformance/daemon-mount/real-reentry.test.ts` (bounded real child, temp root, 20 s timeout).
8. Manual: the `TC-DAEMON-105` procedure on a Linux host with a user manager, recorded in §10.
9. Documentation: `bash scripts/.tests/test-doc-distribution.sh` only if a marker-scoped document changes; this change edits `doc/spec/**` and `doc/planning/**` (not marker-scoped), so the guard is expected to stay green unmodified.

**TMPDIR caveat.** `pnpm check`'s `tests/checks/ci-baseline-parity.test.ts` runs `git clone --local`, which fails with a cross-device hardlink error when `TMPDIR` sits on a different filesystem from the checkout (`/tmp` on tmpfs). The canonical local gate is therefore the `TMPDIR="$PWD/tmp/tmpdir" pnpm check` form above, with `tmp/tmpdir` created first. A default-`TMPDIR` run is classified as environmental **only** when its sole failing test is `CI baseline parity (hermetic partial clone)`; any other default failure, and any repo-local failure, is a delivery failure (`.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md`).

**Exit criteria.**

- All 50 ACs traced to at least one passing TC; no orphan TC; the Scenario Index, the Scenario Details, and this table name the same 55 IDs (55/55/55).
- Every TC green, except `TC-DAEMON-105` which is signed off in the §10 manual record with its commands and observed output.
- `pnpm check` green (lint, format, typecheck, full `bun test`, boundaries, prompt conformance, help coverage, exports parity) under the repo-local `TMPDIR`; `git diff --check` clean.
- `runHelpGuideCoverage()` returns `[]`; the reference-page parity suite passes; the doc-conformance page list includes `daemon`; root `--help` lists the family; all five subcommand `--help` tuples exit `0`.
- The error table, `STATE_SCHEMA_VERSION`, the delivered goldens, and the delivered suite assertions are unchanged; the only test/fixture edits are the declared permitted sites, derived from the tree.
- The spawn environment carries exactly the declared set — the state-directory binding last, plus `PATH`, `HOME`/`USERPROFILE`, and the working-name override only when set; a `#!/usr/bin/env bun` entry starts from it and resolves the forwarded `bun`; a stripped `PATH` fails closed at exit `2` with nothing acquired; a caller with no home and no override gets the unavailable runtime's `config.value.invalid` at exit `1` with no spawn and no root-level directory; the durable instance pid is positive; the signal counter is zero for every non-positive pid fixture; no unit is written for an unsupported supervisor or an absent entry path.
- The degradation marker is `[]` only for a live instance whose heartbeat it owns and which is strictly inside the bound, and `["daemon-unreachable"]` for released, immediate-stopped, absent, at-bound, beyond-bound, torn, unreadable, and unowned states, on both `queue list` and `lanes list`, including inside a watch; the unowned family additionally asserts the status fold's `running`, with the divergence named.
- Every integration-marked and manual case is bounded and recorded; no case writes outside a temp root.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| TR-1 | The family is mounted conditionally (only when an entry path or signal host exists), so every CLI invocation is contained as `fallback.internal`. | H | TC-DAEMON-014 composes with every optional fact absent and asserts selection succeeds; TC-DAEMON-015 proves it through `runEntrypoint` once membership lands; a conditional-registration mutant must fail; TC-DAEMON-053 asserts an invalid state-directory override also keeps the command. |
| TR-2 | A `start` reports success because the child process exists, without a durable `acquired` instance, so the operator believes a daemon is resident. | H | TC-DAEMON-030 reads the instance from the store before accepting the receipt and asserts the poll bound (20 × 50 ms); TC-DAEMON-031 asserts a timeout appends nothing and claims nothing. |
| TR-3 | The readiness window is widened, removed, or made unbounded, so a failing start hangs instead of failing closed. | M | TC-DAEMON-031 asserts exactly 20 sleeps and a 21st attempt never happens; NFR-4 is stated in the same numbers in §3.3. |
| TR-4 | A foreground daemon dies on a signal without releasing, leaving a held instance lock and undetached lanes. | H | TC-DAEMON-033/034 assert one release record and one detach per delivering lane; TC-DAEMON-037 asserts the release is attempted even when it fails; TC-DAEMON-038 asserts one terminal record under a double signal. |
| TR-5 | A listener outlives the invocation, so a second signal, or a later command in the same process, re-enters `stop`. | H | TC-DAEMON-033/034/035/037/038 assert `removeListener` per event exactly once and that no registration remains; a `holder-not-removed` mutant must fail. |
| TR-6 | The re-entry environment is rebuilt wrongly — the state binding is merged first so a forwarded look-alike wins, an ambient key leaks in, or the interpreter cannot be resolved because `PATH` was not forwarded. | H | TC-DAEMON-040 asserts the exact key set, the key order (state binding last), the `HOME`/`USERPROFILE` fallback, and the override-only-when-set rule; TC-DAEMON-051 feeds the captured environment back through the resolution with a competing same-named value; TC-DAEMON-039 proves a `#!/usr/bin/env bun` entry starts from it; `binding-not-last` and `spawn-without-forwarded-env` mutants must fail. The residuals — a caller that stripped `PATH`, and a caller with no home and no override — are declared (DEC-16, DEC-18, RSK-2) and asserted as two distinct fail-closed outcomes, not assumed away: a stripped `PATH` at exit `2` (`TC-DAEMON-041`), and no home with no override as the unavailable runtime's `config.value.invalid` at exit `1` (`TC-DAEMON-041`, `TC-DAEMON-054`). |
| TR-7 | The production composition keeps two state-directory resolutions, so the ledger, lock, or socket land somewhere the read side does not look. | H | TC-DAEMON-050 asserts seven observers agree character for character and that the home template appears in none of them under an override; TC-DAEMON-052 pins byte-identity with no override. |
| TR-8 | An invalid override is treated as a composition failure, removing a prompt-required command. | H | TC-DAEMON-053 asserts no throw, the command still selectable, the home value kept, and the report left to the resolution edge; a suppression mutant must fail. |
| TR-9 | The degradation resolver is correct but the wiring keeps a constant, so the marker never changes. | H | TC-DAEMON-077 asserts both directions through the production composition and a source scan finds no literal; a `hardcoded-degradation` mutant must fail. |
| TR-10 | The resolver is evaluated once at composition time and captured, so a watch cannot flip. | H | TC-DAEMON-074 asserts a three-iteration flip with a per-iteration call counter; a `captured-degradation` mutant must fail. |
| TR-11 | A torn or unreadable daemon record throws into a queue read, or is "repaired" into reachability. | H | TC-DAEMON-076 asserts the marker array in every corrupt case, zero socket/probe/sleep, and that the read never writes; a `fabricated-reachability` mutant must fail. |
| TR-12 | A store-level failure is swallowed by the tolerant daemon-record path, hiding a broken ledger. | M | TC-DAEMON-076 step 5 asserts a permission-denied queue store still fails through its own `state.*` identity at exit `2`. |
| TR-13 | A `0`, negative, fractional, or torn pid is signalled, addressing the caller's own process group. | H | TC-DAEMON-091 asserts a zero `signal` counter across eight invocations and a source scan for name/pattern kills; TC-DAEMON-092 adds a negative-pid (group form) mutant. |
| TR-14 | The real pid is not recorded, so `stop` refuses a record the mount itself wrote. | H | TC-DAEMON-090 asserts the instance pid equals the injected composing pid, both on the record and on both read surfaces, and never `0`. |
| TR-15 | The unit names a bare binary or is written under the state directory, so install reports success and does nothing. | H | TC-DAEMON-100 parses `ExecStart` and `Environment=` and asserts the unit path; `bare-execstart` and `unit-under-state-dir` mutants must fail. |
| TR-16 | A relative or empty `XDG_CONFIG_HOME` is joined onto the cwd, writing outside the user's configuration root. | M | TC-DAEMON-101 asserts the relative case is treated as absent; an `xdg-relative-joined` mutant must fail. |
| TR-17 | An unsupported platform or a linger failure leaves a half-installed unit behind. | M | TC-DAEMON-102 asserts directory equality after the failure and a recorded rollback; TC-DAEMON-103 asserts uninstall is ownership-scoped against unrelated files. |
| TR-18 | Install renders a unit with an empty executable when no entry path is composed. | H | TC-DAEMON-104 asserts the refusal precedes rendering (zero `renderSystemdUnit` calls) and nothing is written. |
| TR-19 | Adding `daemon` to the prompt-required set without the help page and inventory rows turns three guards red, and the fix is a guard relaxation. | H | TC-DAEMON-013 updates the two inventory surfaces and the conformance page list in the same phase and asserts each guard fails by name when a row or literal is removed; no guard is loosened. |
| TR-20 | The widening of `degraded` changes delivered bytes for an existing embedder. | H | TC-DAEMON-112 compares serialized payloads against recorded baselines for array-valued and omitted compositions, and asserts the union actually dispatches. |
| TR-21 | The mount edits a delivered suite's assertion to make it pass, hiding a regression. | H | TC-DAEMON-113 enumerates the permitted update sites (derived from the delivered tree: the family lists, the `daemon` absence assertions, the command enumeration in the coverage suite, the coverage inventory rows, and the conformance page list) and requires the rest to pass unmodified; the diff half is review-attested (GAP-T1) and any extra edit is a finding. |
| TR-22 | Help or version starts consulting state, configuration, or the daemon composition. | M | TC-DAEMON-114 asserts zero composer invocations, an unchanged directory listing, and an armed read guard for the daemon tuples. |
| TR-23 | The derived marker adds a socket probe, a process probe, or a sleep to a synchronous read. | H | TC-DAEMON-120 asserts the counters are zero and the budget is ≤ 2 additional daemon-fact reads; TC-DAEMON-076 re-asserts the same on the failure path. |
| TR-24 | Performance cases flake and are softened to a meaningless floor. | M | GAP-T6 pins the method, the reference store, and the relative p95 baseline; a bound change requires an explicit reviewed edit, and TC-DAEMON-120/121/122 record every sample. |
| TR-25 | The integration-marked real-child case leaks a process or writes outside its temp root in CI. | M | TC-DAEMON-039 uses a temp `HOME`/`XDG_CONFIG_HOME`/state dir, an injected `PATH` for the child, a 20 000 ms hard timeout, a `finally` `SIGKILL` reap, and a `git status --porcelain` assertion; it asserts the child's environment is exactly the declared forwarded set and that no ambient key reached it. |
| TR-26 | The degradation predicate and the status fold drift apart at the boundary or on ownership: a `<=` at the bound, or an owner requirement silently harmonised with the fold. | H | TC-DAEMON-073 asserts the at-bound cell as degraded and the fold as `stale`; TC-DAEMON-070 asserts the just-below cell as `[]`; TC-DAEMON-075 asserts agreement on every owned or heartbeat-less cell and refuses to fold the unowned cells in; TC-DAEMON-078 asserts the unowned family's divergence with both surfaces in one body; `stale-inclusive` and `owner-ignored` mutants must fail. |
| TR-27 | The unresolvable state directory (no override, no home) concatenates the empty home into a root-level `/<stateDirectoryName>` store, or suppresses the mount instead of composing the refusing runtime. | H | TC-DAEMON-054 asserts the family stays registered and selectable, every subcommand refuses with `config.value.invalid` at exit `1`, no `/<stateDirectoryName>` is created or probed, no socket/transport/supervisor path is opened, no spawn is attempted, and a non-daemon command keeps its delivered template; TC-DAEMON-041 pins the `start` shape; a temp-copy mutant that keeps the root-level template for the unresolvable branch must fail. |

### 8.2 Assumptions

- The delivered daemon engine, control protocol, supervisor adapter, status projection, process port, and durable records are stable current contracts; the mount consumes them without editing their semantics (spec §12).
- `process.argv[1]` is an absolute, executable path to the running entry, so the same value serves both detached re-entry and the unit's `ExecStart` (RSK-2, DEC-2).
- The composing process's own environment carries a non-empty `PATH` and a home value; the spawn forwards them unchanged and cannot repair a caller that has already stripped them — a stripped `PATH` fails closed at exit `2`, and a caller with no home and no override receives the unavailable runtime's `config.value.invalid` at exit `1` (DEC-16, DEC-18, RSK-2, AC-F2-10, AC-F3-5).
- `resolveStateDirectoryScope` and `resolveDaemonSettings` are the single resolution edges for the directory and the `daemon` branch, and a resolution failure is reported by the edge that owns it (DEC-5, DEC-6). The daemon composition's directory has exactly three outcomes — absolute override, home-based value when a home exists, unresolvable — and only the third composes the unavailable runtime (DEC-18, AC-F3-5).
- The composing process, the detached child, and the unit process resolve the same brand prefix, because the working-name override is forwarded when set and non-empty; the residual is the caller's own stripped environment, not the brand (DEC-16, RSK-6).
- The lock-staleness bound is the freshness threshold for "reachable", applied as strictly-below by the predicate and by the status fold, and requiring the heartbeat's owner; the two rules agree on every cell where the instance owns the latest heartbeat or no heartbeat exists, and diverge only on the unowned family (DEC-7, AC-F5-6, AC-F5-8).
- The daemon writes its instance and heartbeat records to the same store the queue and lanes read, so a durable predicate is a sufficient observation.
- Install is provable through the injected `SupervisorPort` (DEC-11) without a live systemd; a real user-manager load is a manual host verification (GAP-T4).
- `daemon status` keeps reporting `installed: false` in its supervisor descriptor because the delivered status composition performs no supervisor inspection; the receipts are the installation truth (DEC-14).
- Production composes no lane executor, so a production start reports `supervise-only` with `lane-executor-unavailable`, which is distinct from `daemon-unreachable` (DEC-15).
- Bun `1.4.4` is available and `bun:test` is the only runner; no Jest/Vitest.
- No new module or published export is introduced, so `tests/structure/inventory.json` and `tests/structure/content-inventory.test.ts` stay unmodified controls.

### 8.3 Open Questions

| ID | Question | Status | Resolution |
|---|---|---|---|
| OQ-T1 | Does the mount require a new entry seam in `bin/delivery-os.ts`, or composition only? | Resolved | Composition only: the bin supplies the entry path, the process id, and the signal host as facts; the prompt-required selection, envelope, error projection, help, and flag parser stay single-sourced (DEC-1, AC-F1-1, AC-F1-5). TC-DAEMON-010/014. |
| OQ-T2 | How is success of a bare start determined? | Resolved | From durable state: a durable `acquired` instance within the readiness window; the child's streams are never consulted (AC-F2-1, AC-F2-2). TC-DAEMON-030/031. |
| OQ-T3 | What happens when both signals arrive? | Resolved | Exactly one stop, one terminal record, listeners removed; the first signal selects the mode (AC-F2-9). TC-DAEMON-038. |
| OQ-T4 | Where does the state directory come from, and what happens on an invalid override or an absent home? | Resolved | `resolveStateDirectoryScope` with three outcomes: an absolute override wins; otherwise the home-based default applies only when a home exists; otherwise the directory is unresolvable and the family stays mounted over an unavailable runtime returning `config.value.invalid` at exit `1` (DEC-18). A non-absolute override keeps the home value when a home exists, and the report stays with the resolution edge (DEC-5, AC-F3-4, AC-F3-5). TC-DAEMON-050–054. |
| OQ-T5 | Is the degradation source durable state or a socket probe? | Resolved | Durable state: an instance whose latest operation is `acquired`/`taken-over`, a heartbeat whose `instanceId` matches it, and an age strictly below the lock staleness; no socket, no probe, no sleep, and an unowned heartbeat is never reachable (DEC-7, AC-F5-1..AC-F5-8). TC-DAEMON-070–078. |
| OQ-T6 | Which pid is recorded, and what does `stop` do with a non-positive one? | Resolved | The composing pid is recorded only when positive; `stop` refuses any non-positive or torn pid with `daemon.state-recovery-failed` and sends no signal (DEC-8, AC-F6-1..AC-F6-3). TC-DAEMON-090–092. |
| OQ-T7 | Which install identity values does production use? | Resolved | Absolute entry path as `ExecStart`; `${brand.binaryName}-daemon.service`; `XDG_CONFIG_HOME` when absolute and non-empty else `<home>/.config`; the exact `<PREFIX>_STATE_DIR` binding; the digest of the resolved directory as scope (DEC-9, DM-6). TC-DAEMON-100/101. |
| OQ-T8 | What does install do without an entry path? | Resolved | Refuses with `daemon.state-recovery-failed` at exit `2` and writes nothing; no unit is rendered with an empty executable (AC-F7-5). TC-DAEMON-104. |
| OQ-T9 | Are help entries added per subcommand or only for the family? | Resolved | The family plus one entry per subcommand, and the reference page gains a help section naming `--help` and `--version` (DEC-12, AC-F1-2..AC-F1-4). TC-DAEMON-011–013. |
| OQ-T10 | Does the doc-conformance page list also gain the two pre-existing omissions? | Resolved | No: only `daemon` is added; `dispatch` and `coordinator` stay as they are (DEC-13, AC-F1-3). TC-DAEMON-013. |
| OQ-T11 | Does `daemon status` start reporting install truth? | Resolved | No: the descriptor keeps `installed: false`; the receipts are the truth (DEC-14). TC-DAEMON-060. |
| OQ-T12 | Which mode does a production start report? | Resolved | `supervise-only` with `lane-executor-unavailable`, distinct from `daemon-unreachable` (DEC-15). TC-DAEMON-032/060. |
| OQ-T13 | Is the working-name override forwarded into the re-entry environment? | Resolved | Yes, when it is set and non-empty: the environment carries the authoritative state binding last plus the composing `PATH`, `HOME`/`USERPROFILE`, and that override, through one optional composition input; a forwarding failure is a defect, not a declared limitation (DEC-16, AC-F2-1, AC-F3-2). TC-DAEMON-040/051, TR-6. |
| OQ-T14 | Which rate is the daemon's lane restart bound? | Resolved | The resolved `lane.restart-budget`, with the shipped default when configuration cannot be acquired (DEC-10). TC-DAEMON-100. |
| OQ-T15 | Is the shipped `#!/usr/bin/env bun` entry executable from the re-entry environment, and what happens when the caller has no `PATH` / no home? | Resolved | Executable: the composing `PATH` and home are forwarded and the binding stays authoritative, so the child resolves the same interpreter the parent used (AC-F2-10, DEC-16). The residuals are the caller's own environment: a stripped `PATH` with a home present fails closed as `daemon.state-recovery-failed` at exit `2` with nothing acquired; a caller with no home and no override makes the directory unresolvable, so no spawn is attempted and the family refuses with `config.value.invalid` at exit `1`, never a root-level state path (DEC-18, AC-F3-5). TC-DAEMON-039/040 prove the first half, TC-DAEMON-041 both residual cells, TC-DAEMON-054 the family-wide unresolvable shape. |
| OQ-T16 | Do the queue/lanes marker and the status fold agree on an unowned heartbeat? | Resolved | No, deliberately: the predicate requires an owner, the fold answers a liveness question only, and the divergence is named and bounded to that family (DM-4, AC-F5-8). TC-DAEMON-075 asserts agreement on the owned cells, TC-DAEMON-078 the divergence. |

**No specification question remains open.** Every AC in the specification is testable as written; no criterion had to be reopened, reinterpreted, or deferred, and no placeholder or TODO row exists in this plan. The only items carried forward are the declared test-method constraints GAP-T1..GAP-T6, which are verification-method statements, not specification ambiguities.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-11 | test-plan-writer | Initial test plan derived from `chg-GH-286-spec.md` v1.0, TDR-0022, the GH-286 clarify-scope record, the delivered GH-238 daemon surfaces, the GH-241 coordinator-production-composition precedent, and `.ai/rules/testing-strategy.md`. **50 scenarios; 47/47 ACs covered** (41 capability plus 6 NFR) with a forward and backward trace on every row; Scenario Index = Scenario Details = Automation Plan (50/50/50). Sequence blocks: `01x` mount/help/coverage, `03x` detached start/foreground lifetime/cross-process stop plus one integration-marked real spawn, `05x` one state-directory scope, `06x` control plane and status, `07x` durable degradation, `09x` composing pid and fail-closed stop, `10x` install and uninstall identity plus one manual host verification, `11x` additive contract and non-regression, `12x` measured NFRs. Every scenario declares its planned file path with new-versus-update status; the four permitted delivered-suite update sites are enumerated in §7 and are the only edits allowed to existing tests/fixtures; byte-identical array-valued `degraded`, an unchanged error table, an unchanged `STATE_SCHEMA_VERSION`, unchanged help/version purity, and `--help` for all five subcommands are asserted as first-class cases; the negative and refusal paths (readiness timeout, pid-0 refusal with zero signal calls, unsupported supervisor with no unit, install with no entry path, invalid non-absolute override, torn reads, and the containment that must not fire) each get their own case with an absence-proof counter; both directions of degradation and the watch flip are asserted. GAP-T1..GAP-T6 record the verification-method constraints (review-attested diff, sequential two-handle process proof, three-observation absences, no real systemd in automated cases, delivery-bound names, performance method). The gate battery is pinned to `pnpm check` (lint → format:check → typecheck → test → check:boundaries → check:prompt → check:help → exports-parity) plus `git diff --check`, the named invariant scripts, the integration case, the manual host verification, and the repo-local `TMPDIR` caveat. No open question, no TODO, and no AC reopened. |
| 1.1 | 2026-11-11 | test-plan-writer | Revision closing DoR iteration 1 (`readiness-review/readiness-iter-1.md`, verdict `NOT_READY`) against `chg-GH-286-spec.md` v1.1. **RF-1/AC-F2-10** — `TC-DAEMON-030` and `TC-DAEMON-051` re-pinned from the withdrawn "one environment variable" contract to the amended TDR-0022 DC-1: `<PREFIX>_STATE_DIR` authoritative and written last, plus the composing `PATH`, `HOME`/`USERPROFILE`, and a working-name override only when set and non-empty, through one optional additive input; `TC-DAEMON-039` now spawns a real `#!/usr/bin/env bun` fixture entry and asserts the interpreter and the forwarded key set from the child's own evidence; new `TC-DAEMON-040` (hermetic composition and ordering) and `TC-DAEMON-041` (stripped `PATH`/`HOME` fails closed, nothing acquired, no root-level state path). **RF-2/AC-F5-8** — the reachability predicate is pinned to an owning instance plus `now − beatAt < lockStalenessMs`: `TC-DAEMON-070` step 5 no longer claims an inclusive boundary, `TC-DAEMON-073` moves the at-bound cell to the degraded side, `TC-DAEMON-075` restricts its agreement matrix to owned-or-heartbeat-less stores (17 cells, unowned cells excluded by assertion), and new `TC-DAEMON-078` asserts the unowned family's degradation alongside the delivered fold's `running`, with the divergence named. **RF-4** — plain `daemon status` is a probe-and-report surface at exit `0` (`TC-DAEMON-060` steps 6/7, `TC-DAEMON-061` step 4, `TC-DAEMON-062` step 3); the zero-connect claim is confined to the queue/lanes path. **RF-5** — `TC-DAEMON-100` step 5 asserts the delivered install order (unit write → `systemctl --user enable` → `loginctl enable-linger` → ownership marker). **RF-6** — `TC-DAEMON-124` asserts exit `1` for `daemon.already-running` and `daemon.takeover-refused` (`user-validation`). **A-4** — §7 now states that the delivery plan's consolidation block is the authoritative file inventory and that this plan's per-case paths are the pre-consolidation grouping. **A-8** — `TC-DAEMON-104` keys the refusal on entry-path absence only, since `DaemonComposition.binary` is required. Totals: **53 scenarios; 49/49 ACs covered** (43 capability plus 6 NFR); Scenario Index = Scenario Details = Automation Plan (53/53/53). Two mutants added (`binding-not-last`, `owner-ignored`) and one renamed (`stale-inclusive`); the re-entry environment fixtures are added to the committed state set. |
| 1.2 | 2026-11-11 | test-plan-writer | Revision closing DoR iteration 2 (`readiness-review/readiness-iter-2.md`, verdict `NOT_READY`) against `chg-GH-286-spec.md` v1.2. **RF2-4** — the state-directory contract is restated to its three outcomes. `TC-DAEMON-041` is rewritten: fixture (a) is a stripped `PATH` **with a home present**, which fails closed as `daemon.state-recovery-failed` at exit `2` with nothing acquired, and fixture (b) is a faithful `homeDirectory = ""` with no `HOME`/`USERPROFILE` and no override, which composes the unavailable runtime, attempts no spawn, and returns `config.value.invalid` at exit `1` while opening nothing and touching no `/<stateDirectoryName>` path; the old "no store opened / no root-level path" assertions are gone from the home-based cell, which never claimed them. New **`TC-DAEMON-054`** covers AC-F3-5 family-wide: all five subcommands in both shapes (full runtime control vs unavailable runtime), the projected exit digit, the absence proof, the non-daemon-command clause, and a root-level-template mutant. `AC-F3-3`/`AC-F3-4` are scoped to a home present; `AC-F2-10` is split across four cases. **RF2-5** — `TC-DAEMON-010` step 5 now names **both** daemon-absence sites in `tests/behaviour/entrypoint-composition.test.ts`: `:73` (`["state","mcp","daemon","config","doctor"]`) and `:86` (`["state","mcp","daemon","frobnicate"]`), states the exact resulting lists, and adds the now-false doc comment as the fourth edit while every assertion stays byte-identical. **A2-1** — the coverage-fixture edit is "append at the end; order is not normative" in both `TC-DAEMON-013` and §7; the "sorted, duplicate-free" wording is removed. **A2-4** — `tests/checks/daemon-privacy.test.ts` is marked **create**, not update. **A2-5** — §4 rule 10 and a new §7 composition-shape table state, per case, whether the composition under test is the production composer, a directly composed `createDaemonCommandRuntime`, or both from the same facts; the harness now exposes `runProduction`/`runRuntime`, and the six named cases plus their siblings carry an inline `Composition under test` line; no third production fact is introduced. **A2-6** — `TC-DAEMON-039` step 4 now asserts the child's resolved interpreter directory equals the forwarded bun directory (which the precondition pins outside `/usr/bin:/bin`), so the proof cannot be satisfied by a system bun. Totals: **54 scenarios; 50/50 ACs covered** (44 capability plus 6 NFR); Scenario Index = Scenario Details = Automation Plan (54/54/54). No existing TC id was renumbered and no scenario was deleted. Handoff (not a test-plan edit): the delivery plan's Phase-2 TC list and its plan-level totals still need `TC-DAEMON-054` added to the `daemon-state-scope.test.ts` group, which is a `delivery_planning` change. **Amended in v1.3 (A3-3):** that handoff was already stale when this row was written — plan v1.2 carries `TC-DAEMON-054` in its Phase-2 map and in the `daemon-state-scope.test.ts` group, so no `delivery_planning` change was outstanding and none is recorded. The row is amended rather than deleted so the history stays honest. |
| 1.3 | 2026-11-11 | test-plan-writer | Revision closing DoR iteration 3 (`readiness-review/readiness-iter-3.md`, verdict `NOT_READY`) against `chg-GH-286-spec.md` v1.3, plan v1.2. **RF3-1 — selection is asserted only after membership exists.** `PROMPT_REQUIRED_COMMANDS` holds the delivered 16 commands until Phase-6 task 6.1 and `selectPromptRequiredProgram` drops extras, so every pre-Phase-6 `runEntrypoint` invocation answers `fallback.internal` at exit `2`. §7 now states, per case, whether the case invokes a **`handler`** (composed program / `runCli`, no membership dependence) or the **`entrypoint`** (`runEntrypoint`), plus `n/a` for non-command cases; Phase 2-5 cases are all `handler` and Phase-6 membership/selection cases are all `entrypoint`. The affected steps are re-pinned: `TC-DAEMON-041` step 5, `TC-DAEMON-053` steps 2/3, `TC-DAEMON-054` steps 1/2/5, `TC-DAEMON-063`'s production half, `TC-DAEMON-090`, and the Phase-3 install battery (`TC-DAEMON-100`/`-101`/`-103`/`-104`/`-124`, plus the `TC-DAEMON-105` manual record) drop every claim about `selectPromptRequiredProgram` or `fallback.internal`. New **`TC-DAEMON-015`** owns the selection half at the Phase-6 gate, through `runEntrypoint`: `selectPromptRequiredProgram` selects `daemon` and the selected set equals `PROMPT_REQUIRED_COMMANDS`, a `daemon status` invocation is never `fallback.internal`, all nine unresolvable-outcome invocations return `config.value.invalid` at exit `1`, help/version stay pure, and a non-daemon command still resolves. It explicitly supersedes the selection half Phases 2/3 must not assert. **A3-1 (spec v1.3 alignment)** — `AC-F7-5` is restated as "given a resolvable state directory" with the unresolvable outcome taking precedence (`config.value.invalid` at exit `1`), `AC-F3-4` as "the edge returns no store for a non-absolute override", `TC-DAEMON-104`'s precondition gains the resolvable-state-directory qualifier, and Appendix D's row carries the same qualifier. **A3-2** — the help suite's path is the plan's `tests/behaviour/daemon-mount-help.test.ts` everywhere it appears, with the rename from the earlier `daemon-help.test.ts` grouping stated in §7 and in `TC-DAEMON-011`/`-012`/`-114`. **A3-3** — the v1.2 history row's `TC-DAEMON-054` handoff is amended in place: plan v1.2 already carried it, so no `delivery_planning` change was outstanding. **A3-5** — `TC-DAEMON-041` step 7 and `TC-DAEMON-054` step 6(ii) name the scan anchor as the local, non-exported refusing-runtime factory in `packages/cli/src/production.ts` (the plan's task 2.1(c) unavailable-runtime branch) and state the boundary exactly: that factory's declaration through its closing brace, asserting it constructs no store, lock, settings, transport, socket path, supervisor scope, entry path, or pid, with no claim about the rest of the file. Totals: **55 scenarios; 50/50 ACs covered** (44 capability plus 6 NFR); Scenario Index = Scenario Details = Automation Plan (55/55/55). No existing TC id was renumbered and no scenario was deleted; `TC-DAEMON-015` is the only added case. |

## 10. Test Execution Log

Run date: TBD at delivery. Environment: Bun `1.4.4`, pnpm `10.18.3`, Linux x64 (worktree `feat/GH-286/daemon-command-mounting`, base `main-tools`), with `TMPDIR="$PWD/tmp/tmpdir"` for the aggregate gate.

### 10.1 Per-TC results

| TC ID | Run Date | Result | Evidence |
|---|---|---|---|
| — | — | Not run | Populated by delivery. |

### 10.2 Aggregate gate evidence

| Gate | Command | Result | Evidence |
|---|---|---|---|
| Narrow behaviour | `bun test tests/behaviour/daemon-*.test.ts tests/behaviour/entrypoint-*.test.ts tests/behaviour/queue-*.test.ts tests/behaviour/lanes*.test.ts` | Not run | — |
| Structure and checks | `bun test tests/structure/daemon-*.test.ts tests/checks/daemon-*.test.ts tests/checks/{help-guide-coverage,reference-page-parity,doc-conformance}.test.ts` | Not run | — |
| Help coverage | `bun run scripts/checks/help-guide-coverage.ts` | Not run | — |
| Prompt conformance | `bun run scripts/checks/prompt-conformance.ts` | Not run | — |
| Error-table sync | `bun run scripts/checks/error-table-sync.ts` | Not run | — |
| Boundaries | `pnpm check:boundaries`; `bun test tests/boundaries` | Not run | — |
| Typecheck | `pnpm typecheck` | Not run | — |
| Integration (bounded) | `bun test tests/conformance/daemon-mount/real-reentry.test.ts` | Not run | — |
| Aggregate | `TMPDIR="$PWD/tmp/tmpdir" pnpm check` | Not run | — |
| Exports parity | `bun run scripts/checks/exports-parity.ts` | Not run | — |
| Diff hygiene | `git diff --check` | Not run | — |
| Manual host verification | `TC-DAEMON-105` procedure | Not run | — |

### 10.3 Deviations and observations (for the review gate)

- The plan asserts the delivered grammar and envelopes unchanged: `daemon start [--foreground]`, `daemon stop [--mode drain|immediate]`, `daemon status [--live]`, `daemon install`, `daemon uninstall`; the mount makes them reachable, not different.
- The re-entry environment is asserted as the declared set — `<PREFIX>_STATE_DIR` last and authoritative, plus `PATH`, `HOME`/`USERPROFILE`, and the working-name override only when set — never as "one variable". The real `#!/usr/bin/env bun` proof is `TC-DAEMON-039`, and it asserts the resolved interpreter comes from the forwarded bun directory (a directory outside `/usr/bin:/bin`), not merely that the basename is `bun`. The caller-side residuals are split and both asserted: a stripped `PATH` with a home present is `daemon.state-recovery-failed` at exit `2` (`TC-DAEMON-041` fixture a/c), and no home with no override is the unavailable runtime's `config.value.invalid` at exit `1` (`TC-DAEMON-041` fixture b, family-wide `TC-DAEMON-054`).
- The state directory has exactly three outcomes (spec §6 Flow 1 and Flow 7): an absolute override, the home default when a home exists, and the unresolvable case. `TC-DAEMON-052` pins the home cell, `TC-DAEMON-053` the non-absolute override **with a home present**, and `TC-DAEMON-054` the unresolvable cell — the family stays mounted, every subcommand refuses with the projected `user-validation` exit `1`, no `/<stateDirectoryName>` root-level path is created, read, or probed, no spawn is attempted, and a non-daemon command in the same program keeps the delivered template. No case asserts the root-level behaviour for the home-based cell.
- The degradation marker is asserted in both directions on both read surfaces, including the strictly-below boundary (at-bound is degraded and the fold says `stale`), the just-below control, the torn-read fail-closed path, and the unowned-heartbeat family where the marker degrades while the delivered fold reports `running` — the one declared divergence, asserted in a single body so neither surface can be "harmonised" silently. The production wiring case exists because a correct predicate with a constant wire would otherwise pass.
- Plain `daemon status` probes the composed socket and reports reachability at exit `0`; only `--live` fails closed. The zero-socket-connect claim is asserted for the queue/lanes degradation path only (`TC-DAEMON-076`, `TC-DAEMON-120`), never for status.
- The fail-closed stop is asserted by a **zero signal counter**, not by an exit code, and the negative-pid (group form) mutant guards against a later "helpful" refactor. `daemon.already-running` and `daemon.takeover-refused` are `user-validation` rows and therefore exit `1`, not `2`.
- The install proofs use the injected supervisor port end to end (content, the delivered command order — unit write, `systemctl --user enable`, `loginctl enable-linger`, ownership marker — rollback, ownership-scoped removal); exactly one manual case touches a real user manager, inside a temp `XDG_CONFIG_HOME`, and never enables login autostart for the operator's account.
- Exactly one case spawns a real child process (`TC-DAEMON-039`); it is integration-marked, temp-rooted, timeout-bounded, and reaped in `finally`. No automated case calls `systemctl` or opens a real socket.
- The permitted edits to delivered test/fixture files are those that carry the prompt-required enumeration or the family list derived from it, and nothing else: `tests/behaviour/entrypoint-composition.test.ts` (the expected-family list, **both** `daemon` absence loops at `:73` and `:86`, and the doc comment that would otherwise state a falsehood), `tests/behaviour/entrypoint-help.test.ts` (root family list), `tests/behaviour/entrypoint-help-coverage.test.ts` (the hard-coded command enumeration), `tests/fixtures/help-guide/coverage.json` (a `commands` row and a `referencePages` row, each appended at the end; the fixture is neither sorted nor deduplicated), and `tests/checks/doc-conformance.test.ts` (`PROMPT_REQUIRED_PAGES` gains `daemon`). The set is derived from the tree, not from a count. Any other change to a delivered suite's assertions is a defect against AC-F8-4; the diff-shape half is review-attested (GAP-T1), not asserted by a permanent branch-diff test.
- `tests/structure/content-inventory.test.ts` and `tests/structure/inventory.json` are expected to stay byte-identical because no module or published export is added; if delivery adds one, the same phase must add the inventory row and keep `pnpm check:boundaries` green.
- The aggregate gate is run with the repo-local `TMPDIR`; a default-`TMPDIR` failure is environmental only when its sole failing test is `CI baseline parity (hermetic partial clone)`.
