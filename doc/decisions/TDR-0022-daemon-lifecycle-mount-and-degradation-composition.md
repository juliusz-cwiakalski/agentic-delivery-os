---
id: TDR-0022
decision_type: tdr
status: Proposed
created: 2026-11-11
decision_date: null
last_updated: 2026-11-11
summary: "Mount the delivered daemon lifecycle family by composing it in the production entrypoint: `daemonEntry` is the running entry path supplied as a production fact, a foreground start owns the process lifetime through an injected signal host (SIGTERM drains, SIGINT stops immediately) and records the composing pid, the install identity is `<binaryName>-daemon.service` under the user config root with `ExecStart=<entry path> daemon start --foreground`, and queue/lanes degradation is resolved per read from durable daemon state instead of a hardcoded marker."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os CLI entrypoint and resident daemon (M1-S18 mount)"
decision_scope: repo
review_date: null
business_impact: "Closes the last gap between the delivered resident daemon and the shipped binary: `daemon start` becomes a real resident process, `daemon stop --mode drain` drains it, and `queue list` / `lanes` stop reporting a permanently unreachable daemon."
customer_impact: "An operator can start, inspect, and stop one supervised daemon from the installed binary without hand-composing a runtime; `daemon stop` can no longer signal an unrelated process group."
classification:
  domains: [architecture, operations, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: high
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@pm (change GH-286, autonomous delivery; composition choices inside the ticket's declared intent)"
  decider: "Juliusz Ćwiąkalski — acceptance pending at the GH-286 PR review; the positions here are the specification baseline under that delegation"
  contributors:
    - "@pm (clarify_scope: four composition choices routed to specification)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-286 PR review — install identity writes to the user config root and the state-directory resolution changes)"
  performers:
    - "@coder (GH-286: production composition, daemon composition inputs, queue/lanes degradation seam, help reference page)"
    - "@doc-syncer (phase-7 reconciliation: feature-resident-daemon and feature-cli-entrypoint)"
  informed:
    - "TDR-0017 coordinator supervision (shares the supervisor regime and the foreground-loop precedent)"
    - "M2 supervision battery (consumes `daemon status` / `lanes` degradation truth)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The running entry path is not an executable file at spawn time (wrapper, shim, or ephemeral path): reopen DC-1's `daemonEntry` source rather than guessing an interpreter or an install path."
  - "A composing caller strips `PATH` or `HOME`/`USERPROFILE` from its own environment: the spawn rebuilds the child environment from what the parent holds, so the child fails closed at spawn or readiness — reopen DC-1's re-entry environment only if the environment must be recovered by some other means."
  - "A second state directory (or a second product instance) must install its own unit: reopen DC-4's unit identity (today one legible unit name per user) before adding a scope digest to the name."
  - "An operator needs an immediate `result=started` line from `daemon start --foreground`: reopen DC-1's lifetime owner (awaiting handler vs loop-owned lifetime) instead of adding a second output path."
  - "Event-log or poke-driven wake latency becomes a stated requirement: add the delivered `createEventLogWake` as an additive composition input; do not reintroduce a private ledger-path derivation in the composition."
  - "The state-directory resolution change (DC-1c) proves to move state for anyone who sets `<PREFIX>_STATE_DIR`: revert to a daemon-only resolution input rather than making the override drive every production composition."
  - "`queue list` reports reachable while the socket probe in `daemon status --live` fails for longer than the lock-staleness window: reopen DC-2's authoritative source (durable state vs control-plane probe)."
links:
  related_changes: ["GH-286", "GH-238", "GH-241"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-resident-daemon.md"
    - "doc/spec/features/feature-cli-entrypoint.md"
    - "doc/planning/oss-tooling/milestones/m1/commands/daemon.md"
    - "doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md"
  contracts:
    - "packages/cli/src/daemon-compose.ts"
    - "packages/cli/src/commands/daemon.ts"
    - "packages/cli/src/daemon-main.ts"
    - "packages/cli/src/production.ts"
    - "packages/cli/src/edge.ts"
    - "packages/cli/src/help/prompt-required-commands.ts"
    - "packages/core/src/config/catalog.ts"
    - "packages/core/src/app/daemon-runtime.ts"
    - "packages/core/src/contracts/daemon.ts"
    - "packages/adapters/src/daemon/unix.ts"
    - "packages/adapters/src/daemon/supervisor.ts"
  diagrams: []
  decisions: ["ADR-0003", "TDR-0004", "TDR-0005", "TDR-0017"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S18"]
---

# TDR-0022: Daemon Lifecycle Mount and Degradation Composition — Entry-Path Re-entry, Signal-Owned Foreground Lifetime, Real Instance Pid, Brand-Derived Install Identity, Durable-State Degradation

## Context

- **FACT:** The daemon command definition and its composition seam are delivered but unmounted. `ConfigProgramOptions.daemon?: DaemonCommandRuntime` exists (`packages/cli/src/edge.ts:2997`) and `createConfigProgram` registers the definition only when the runtime is supplied (`edge.ts:3574-3576`); `daemon` is absent from `PROMPT_REQUIRED_COMMANDS` (`packages/cli/src/help/prompt-required-commands.ts:11-28`) and the production composer supplies no daemon runtime.
- **FACT:** `selectPromptRequiredProgram` **throws** when a prompt-required command is not composed (`packages/cli/src/entrypoint.ts:134-142`). Making `daemon` prompt-required therefore requires the production composer to compose it unconditionally — an optional, conditionally-registered runtime is not an option.
- **FACT:** `createDaemonCommandRuntime` composes the lifecycle from `DaemonComposition` (`packages/cli/src/daemon-compose.ts:83-154`, factory at `:365`). Required: `store`, `lock`, `settings`, `restartBound`, `stateDirectory`, `unit`, `binary`, `environmentName`, `newFenceToken`, `newLockToken`, `newInstanceId`. Optional and load-bearing here: `transport`, `socketPath`, `daemonEntry`, `wake`, `supervisor`, `platform`, `supervisorConfigDirectory`, `pid` (to be added, DC-3).
- **FACT:** `start` spawns a detached child only when it is non-foreground **and** `daemonEntry` is composed, then polls 20×50 ms for an acquired instance and otherwise fails `daemon.state-recovery-failed` (`daemon-compose.ts:669-735`). The child is spawned with `args: ["daemon","start","--foreground"]` and `environment: { [environmentName]: stateDirectory }`; `spawnDetached` passes `env: { ...environment }`, replacing the child environment entirely (`packages/adapters/src/daemon/process.ts:71-84`). The child must therefore be executable, able to resolve its own interpreter, and able to resolve the same state directory from `<PREFIX>_STATE_DIR`, which remains the authority. *(Amended 2026-11-11 — DoR RF-1: the re-entry environment additionally forwards `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override; see DC-1 and the Amendment section. The shipped entry is `#!/usr/bin/env bun`, so the earlier "`<PREFIX>_STATE_DIR` alone" pin was not executable.)*
- **FACT:** `runtime.start` auto-runs the resident wake loop only when `ports.wake !== undefined` (`packages/core/src/app/daemon-runtime.ts:396`); the loop otherwise sleeps on the injected clock at `heartbeatIntervalMs` (default 5 s) and supports cancellation polling at ≤250 ms (`packages/adapters/src/daemon/clock.ts`). Nothing in the foreground path installs signal handling, so a foreground daemon dies on SIGTERM without releasing the lock or recording lane detach; `stop` (`daemon-compose.ts:736-778`) signals the recorded pid from a different process.
- **FACT:** `runtime.stop` sets the loop cancellation flag **before** attempting the release append and lock removal (`daemon-runtime.ts:402-439`), so a failed release still terminates the resident loop.
- **FACT:** `ProductionCompositionFacts` already carries `processId` and `signalHost: { once(SIGINT|SIGTERM, listener), removeListener }` (`packages/cli/src/production.ts:255-261`), used by the coordinator foreground loop precedent (`production.ts:1483-1503`). The bin supplies `processId: process.pid` and `signalHost: process` (`packages/cli/bin/delivery-os.ts:26-34`).
- **FACT:** `DaemonComposition` has no pid input; `createDaemonRuntime` accepts `pid?: number` and falls back to `pid: 0` (`packages/core/src/app/daemon-runtime.ts:56,296,312`). A durable instance record therefore carries `pid: 0`, and `stop` from another process calls `process.kill(0, signal)` — POSIX `kill(0, …)` targets the **caller's own process group** (`daemon-compose.ts:762`, `process.ts:62-69`).
- **FACT:** Production derives `stateDirectory` as `<home>/<brand.stateDirectoryName>` inline (`production.ts:286`) while the delivered `resolveStateDirectoryScope` gives `<PREFIX>_STATE_DIR` outright precedence and otherwise falls back to home (`packages/core/src/config/catalog.ts:879-902`). The same resolution is what the state edge uses (`packages/cli/src/edge.ts:1397-1407`), so a composition that ignores `<PREFIX>_STATE_DIR` disagrees with its own edge — and with the installed unit, whose only environment is `Environment=<PREFIX>_STATE_DIR=<state dir>` (`packages/adapters/src/daemon/supervisor.ts:37-56`).
- **FACT:** The systemd user adapter writes `<configDirectory>/systemd/user/<unit>` and marks ownership beside it (`supervisor.ts:126-131`). `createDaemonCommandRuntime` defaults `supervisorConfigDirectory` to `composition.stateDirectory` (`daemon-compose.ts:380`), which is not a root systemd reads. `daemon install` passes `enableLinger: true` and `binary: composition.binary` (`daemon-compose.ts:781-795`); `renderSystemdUnit` emits `ExecStart=<binary> daemon start --foreground` and requires an absolute executable path.
- **FACT:** `scope` is `daemonScopeDigest(stateDirectory)` computed inside the command runtime (`daemon-compose.ts:375`, `packages/core/src/domain/daemon-lock.ts:14-15`); `DaemonComposition` has no scope input.
- **FACT:** `QueueComposition.degraded?: readonly QueueDegradationReason[]` (`edge.ts:3895`) is captured once per runtime and consumed by the queue schedule and mutation projections (`edge.ts:4255,4262,4270`) and the lanes runtime (`edge.ts:4492`); production hardcodes `degraded: ["daemon-unreachable"]` (`production.ts:470`). `queue` and `lanes` are synchronous store reads today.
- **FACT:** `readDaemonStatus` already folds durable instance and heartbeat records into `daemon-heartbeat-stale` / `daemon-unreachable` markers without any socket probe (`packages/core/src/app/daemon-status.ts:101-156`).
- **FACT:** `createUnixTransport` refuses a socket outside the state directory, requires a 0700 directory, and replaces a stale socket file only when `lockOwned()` is true (`packages/adapters/src/daemon/unix.ts:39-53`). The state edge creates its directory 0700 (`packages/core/src/state/driver/runtime-edge.ts:182-185`).
- **Why now:** GH-286 is the story that turns the delivered M1-S18 lifecycle into a surface the shipped binary actually exposes; the ticket's acceptance criterion is that `queue list` and `lanes` stop reporting `daemon-unreachable` once `daemon start` brings the daemon up, which cannot hold while no production composition exists.

## Problem Framing (Clarified)

"Mount the daemon" hides four separable composition questions. Each one, answered wrong, produces a *mount that looks correct in unit tests and fails in the shipped binary*:

1. **Who owns a foreground process's lifetime, and what does the detached child re-enter?** A foreground daemon that returns at readiness is not resident; a foreground daemon with no signal handling dies without releasing the instance lock; a detached child spawned with a replaced environment must be able to find both its executable and its state directory.
2. **What makes `daemon-unreachable` true or false?** A hardcoded marker is a permanent lie; an async control-plane probe turns every synchronous queue read into a socket round-trip.
3. **Whose pid is recorded?** The delivered fallback writes `0`, and `stop` then signals the caller's own process group.
4. **What identity does an install take on the user's machine?** A unit name, an absolute executable path, an environment variable name, and a config root must all be derivable from the brand and agree with what the runtime reads back.

Root cause versus symptom: the hardcoded degradation marker and the missing composition are **symptoms** of one gap — production has no daemon composition at all, so every value that must agree between the parent process, the detached child, the installed unit, and the queue read side is currently undefined. The desired outcome is one composition whose resolved state directory, entry path, and identity are the same strings everywhere they are observed.

Out of scope: lane executor/dispatch composition in the daemon, `projects`/`events`/`attempts`/`board`, daemon engine or control-protocol semantics beyond additive composition inputs and the one contract-conformance stale-lock takeover fix described under DC-4's scoped engine exception, multi-state-directory installs, and any new state schema.

## Constraints (Hard Requirements)

### C-1: A bare `daemon start` leaves a resident, self-releasing daemon

- **Statement:** From the production binary, `daemon start` (no `--foreground`) results in a process that has acquired the instance lock, writes heartbeats, and stays alive until it is stopped; it does not return-and-exit leaving a lock record behind.
- **Source:** AC (GH-286 — mount `daemon start/stop/status/install`)
- **Verification:** test (spawned-process test: start, observe instance + heartbeat, stop, observe release) + demonstration
- **Negotiable:** no

### C-2: A stop from another process terminates the resident daemon and drains it

- **Statement:** `daemon stop --mode drain` executed by a second process causes the resident daemon to mark delivering lanes `detached`, append a `released` instance record, and exit; `daemon stop --mode immediate` appends `immediate-stop`. No signal is ever sent to a non-positive pid.
- **Source:** AC (GH-286) + safety (POSIX `kill(0, …)` targets the caller's process group)
- **Verification:** test (second-process stop against a live daemon; a record with a non-positive pid is refused and no signal is sent)
- **Negotiable:** no

### C-3: `daemon status --live` succeeds against a running daemon

- **Statement:** With a resident daemon, `daemon status --live` returns a live envelope (socket reachable, heartbeat `running`) instead of `daemon.socket-unreachable`; without one it fails with the delivered classification.
- **Source:** AC (GH-286)
- **Verification:** test (live status against a started daemon; failure classification when none is running)
- **Negotiable:** no

### C-4: Queue and lanes degradation reflects durable daemon state

- **Statement:** `queue list` and `lanes` report `degraded=[]` when a daemon instance is live and its heartbeat is younger than the lock-staleness bound, and `degraded=[daemon-unreachable]` when the latest instance is released/absent or the heartbeat's age is **at or beyond** that bound — in the same process invocation, including watch iterations. *(Amended 2026-11-11 — DoR RF2-1, iteration 2: the bound is exclusive, so the boundary itself is unreachable. "Older than" implied the boundary was still reachable.)*
- **Source:** AC (GH-286 — "stop reporting `daemon-unreachable`")
- **Verification:** test (four fixtures: live instance, released instance, absent instance, stale heartbeat; plus a watch-iteration change)
- **Negotiable:** no

### C-5: The prompt-required surface always composes

- **Statement:** Adding `daemon` to `PROMPT_REQUIRED_COMMANDS` does not make the production entrypoint throw; the daemon runtime is composed unconditionally, and an absent re-entry path degrades one start shape instead of removing the command.
- **Source:** internal standard (`entrypoint.ts:134-142` — a missing prompt-required command is a composition gap and throws)
- **Verification:** test (entrypoint composition test; help-guide-coverage check) + code review
- **Negotiable:** no

### C-6: Additive composition only — no engine, contract, or schema change beyond stale-lock takeover conformance

- **Statement:** No daemon engine behaviour, control-protocol frame, error identity, or state schema changes, with **one scoped exception**: when `evaluateDaemonLock` has already proved a stale lock takeover-eligible, the engine removes exactly the lock record it observed — a `lockToken`-keyed compare-and-delete — before the exclusive re-acquire, so the delivered `taken-over` branch is reachable and a crashed daemon can restart. The loser of a concurrent race still receives `state.lock.busy` → `daemon.already-running` because the removal re-reads the token and leaves a replaced lock in place. No other engine semantics, durable record, protocol frame, or error row changes. New inputs are optional composition fields and an additive read seam. `STATE_SCHEMA_VERSION` is unchanged and no migration is implied.
- **Source:** internal standard (GH-286 clarify_scope scope boundary; ADR-0003 tier rules) + contract conformance (the delivered daemon contract claims crash-safety and takeover; `taken-over` is already appended)
- **Verification:** code review + test (schema version and error-table identity set unchanged; post-crash takeover restart test that starts with the stale lock file present)
- **Negotiable:** no

### C-7: One state-directory scope across parent, child, unit, and read side

- **Statement:** The composing process, the detached child, the installed unit's process, the state store, the daemon lock, the control socket, and the queue read side all resolve the identical canonical state directory; `<PREFIX>_STATE_DIR` wins over the home default for the daemon composition.
- **Source:** prior decision (state-directory scope resolution, `catalog.ts:879-902`) + AC (start/stop/status must agree)
- **Verification:** test (composition test with and without the override; ledger path identity across parent and foreground child)
- **Negotiable:** no

### C-8: No I/O or ambient read in the decision domain

- **Statement:** The reachability rule is a pure predicate over injected facts (instance record, heartbeat record, clock, staleness bound); the composition tier owns every filesystem, process, and environment read.
- **Source:** prior decision (ADR-0003 tier purity; `.ai/rules/typescript.md`)
- **Verification:** test (dependency/boundary check) + code review
- **Negotiable:** no

**Table stakes** (every alternative satisfies them, acknowledged once): no new dependency or vendor; no network listener beyond the existing local unix socket; the delivered error identities are reused rather than added; bounded output sizes are unchanged.

## Decision Drivers

Ranked; the ordered list is authoritative.

1. **The acceptance criteria are literally true for the installed binary.** Residency, live status, and drain are observable behaviours, not composition wiring.
2. **One composition path.** A second entry seam for the daemon (argv sniffing ahead of the entrypoint) would bypass the prompt-required selection, the envelope, the error projection, and the help surface — permanently.
3. **Honest failure.** No "started" claim without durable evidence; degradation markers must be derived, never asserted; a non-positive pid must fail closed rather than signal a process group.
4. **Testability without real processes.** Signal hosts, clocks, process ports, and stores are injected so the lifetime, refusal, and degradation paths are deterministic in CI.
5. **Minimal additive surface.** Reuse the delivered runtime, projections, supervisor adapter, and transport; add optional composition inputs only, plus the one scoped conformance fix that makes the delivered takeover branch reachable.
6. **Legible identity.** The unit name, executable path, config root, and environment variable that land on the user's machine must be explainable in one line each and must agree with what `status` reports.
7. **Solo-maintainer reversibility.** Every choice here is an additive input that can be changed or removed without a migration.

## Decision Rights (DACI)

- **Driver:** `@pm` — GH-286 runs in autonomous delivery mode; the four composition choices were routed to specification as recorded decisions at `clarify_scope`.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. **Acceptance is pending at the GH-286 PR review**; the record stays `Proposed` with `decision_date: null` until the owner accepts.
- **Contributors:** `@pm` (scope boundaries and the four routed choices); `@decision-advisor` (analysis, record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`; the human owner at PR review (DC-1c changes where state lives for anyone setting `<PREFIX>_STATE_DIR`, and DC-4 writes a unit into the user config root).
- **Performers:** `@coder` (production composition, daemon composition inputs, queue/lanes degradation seam, help reference page); `@doc-syncer` (spec reconciliation).
- **Informed:** TDR-0017 coordinator supervision (shared regime and loop precedent), the M2 supervision battery (consumes the degradation truth).
- **Timing and escalation:** recorded during GH-286 specification, before delivery. Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| `selectPromptRequiredProgram` throws for an uncomposed prompt-required command, so the daemon runtime must be composed unconditionally. | FACT | `packages/cli/src/entrypoint.ts:134-142` | A conditional composition would crash every CLI invocation once `daemon` is prompt-required. | High |
| `spawnDetached` replaces the child environment with exactly the supplied record. | FACT | `packages/adapters/src/daemon/process.ts:71-84` | A PATH- or HOME-dependent child resolution silently targets a different executable or state directory. | High |
| `resolveStateDirectoryScope` gives `<PREFIX>_STATE_DIR` outright precedence and is the edge's own resolution. | FACT | `packages/core/src/config/catalog.ts:879-902`; `packages/cli/src/edge.ts:1397-1407` | The installed unit's `Environment=` binding would be decorative and the detached child would write to a different ledger. | High |
| The production composer derives the state directory from home only. | FACT | `packages/cli/src/production.ts:286` | Parent, edge, unit, and child can disagree about one value. | High |
| `runtime.stop` cancels the resident loop before attempting the release append. | FACT | `packages/core/src/app/daemon-runtime.ts:402-439` | A failed release would leave a non-terminating loop and the start handler could hang. | High |
| `process.kill(0, signal)` targets the caller's process group. | FACT | POSIX `kill(2)`; `packages/adapters/src/daemon/process.ts:60-69` | `daemon stop` from a shell would signal the shell's own process group. | High |
| The systemd user adapter writes under `<configDirectory>/systemd/user/` and the composition defaults that root to the state directory. | FACT | `packages/adapters/src/daemon/supervisor.ts:126-131`; `packages/cli/src/daemon-compose.ts:380` | The unit would be written where systemd never looks, and `install` would "succeed" uselessly. | High |
| `readDaemonStatus` derives `daemon-unreachable` / `daemon-heartbeat-stale` from durable records alone. | FACT | `packages/core/src/app/daemon-status.ts:101-156` | A durable-state degradation rule would contradict the delivered status projection. | High |
| The user config root used elsewhere in the CLI is `XDG_CONFIG_HOME` or `<home>/.config`. | FACT | `packages/adapters/src/file/config-source.ts:54-69` | A different root would place the unit outside both systemd's and the CLI's config convention. | High |
| `process.argv[1]` is an absolute path to the running entry script (or the compiled binary) and is executable. | ASSUMPTION | Node/Bun argv contract; `packages/cli/bin/delivery-os.ts` is mode 100755 with a Bun shebang | A wrapper or ephemeral path would make the detached child or the unit `ExecStart` unexecutable; the honest answer is a declared failure, not a PATH guess. | Medium |
| `brand.binaryName` is the sanitized product name, not a path, and systemd resolves a bare `ExecStart` against its own fixed search path. | FACT | `packages/core/src/contracts/index.ts:41-54`; `supervisor.ts:50` | Using the name as `binary` would produce a unit that cannot start for a user-local install. | High |
| A live daemon whose heartbeat is stale is correctly reported as unreachable; a dead daemon's fresh last heartbeat is reported reachable for at most the lock-staleness window. | ASSUMPTION | `daemon-status.ts` fold; `DAEMON_DEFAULT_LOCK_STALENESS_MS = 30_000` | The degradation marker could be wrong by one staleness window in crash scenarios; the direction is bounded and disclosed. | Medium |
| The lock-staleness bound (`daemon.lock-staleness`, default 30 s) is the right freshness threshold for "reachable". | ASSUMPTION | `packages/core/src/contracts/daemon.ts:33`; `production.ts` daemon branch defaults | Too tight → flapping markers (the current bug, inverted); too loose → a long lie. | Medium |
| The daemon engine calls `transport.listen` only after acquiring the instance lock in the same process. | FACT | `packages/core/src/app/daemon-runtime.ts:293-349` | Stale-socket replacement would need an ownership proof the composition does not have. | High |
| A unit name shared by two state directories overwrites the first install. | TO-CONFIRM | DC-4 (one legible unit name per user) | Multi-state-dir installs collide; declared out of scope, named as a revisit trigger. | — |

## Mental Models & Techniques Used

- **Inversion ("how do we ship a mount that looks mounted?"):** enumerate the silent failures — a foreground `start` that returns at readiness, a child spawned without PATH/HOME, a unit written under the state directory, a recorded pid of `0` signalled as a process group, a degradation marker that never flips. Each becomes a constraint (C-1…C-4, C-7) or a fail-closed rule (DC-3b).
- **Second-order thinking:** one state-directory resolution shared by parent, child, unit, and read side keeps a single line of truth; two resolutions would produce "works in tests, writes to the wrong ledger from systemd" bugs that surface only on a user machine.
- **Systems thinking:** the four decisions are one control loop — identity (DC-3/DC-4) bounds who may act, lifetime (DC-1) bounds when, and degradation (DC-2) bounds what a read side believes.
- **Least mechanism (KISS):** reuse the delivered runtime, status projection, unix transport, supervisor adapter, and prompt-required selection rather than building a daemon-specific entry path or a second status fold.
- **Opportunity cost:** every hour spent on a second entry seam is an hour not spent on the four behaviours the ticket actually pins.

## Alternatives Considered

### Matrix — decision 1 (lifetime and re-entry)

| Option | C-1 resident | C-2 stop/drain | C-5 always composes | C-7 one scope | C-6 additive |
|--------|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no re-entry, no signal host | ❌ | ❌ | ✅ | ❌ | ✅ |
| **ALT-1 signal-owned foreground lifetime + entry fact (chosen)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 bin argv sniffing into `createDaemonMainEntry` | ✅ | ✅ | ❌ | ✅ | ❌ |
| ALT-3 always in-process, no `daemonEntry` | ❌ | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken).

#### Alternative 0 — Keep the delivered composition and mount it unchanged

- **Eligibility:** Not eligible (fails C-1, C-2, C-7).
- **Summary:** Register the runtime with `store`, `lock`, `settings`, `unit`, `binary`, and factories only.
- **Constraint compliance:** A bare `start` returns at readiness and the process exits (C-1); a foreground daemon dies on SIGTERM without releasing (C-2); the child would resolve the state directory from a replaced environment (C-7).
- **Driver fit:** Best on driver 5 (zero new surface), worst on drivers 1 and 3.
- **Why rejected:** It satisfies "the command exists" and nothing the ticket asks for.

#### Alternative 1 — Signal-owned foreground lifetime plus an explicit entry fact (selected)

- **Eligibility:** Eligible (C-1…C-8).
- **Summary:** Production composes `daemonEntry` from a new optional fact supplied by the bin as `process.argv[1]`; the foreground `start` path runs the resident loop and owns the lifetime through the injected signal host — SIGTERM waits for `stop({mode:"drain"})`, SIGINT for `stop({mode:"immediate"})` — then returns the readiness snapshot captured after `runtime.start`. Production also resolves its state directory through `resolveStateDirectoryScope` so the detached child and the installed unit agree.
- **Constraint compliance:** Resident because the foreground child runs the lifetime path and the parent polls durable readiness (C-1); releases and drains because `stop` is the delivered release path (C-2); composes unconditionally (C-5); one scope because the child's state directory comes from the one variable that resolution reads and nothing else in the forwarded environment can override it (C-7; *amended 2026-11-11, RF-1*); additive inputs only (C-6, C-8).
- **Driver fit:** Best on drivers 1, 2, 3, 5, 7; strong on 4 (the signal host is already an injected fact with a coordinator precedent).
- **Pros:** One composition path; the lifetime, stop mode, and release evidence are the delivered engine's; no new error identity; testable with an injected signal host and fake clock.
- **Cons:** A `--foreground` invocation renders its start receipt at exit, like `coordinator start`; the live read side is `daemon status`.
- **Why chosen:** See DC-1.

#### Alternative 2 — Sniff argv in the bin and route to `createDaemonMainEntry`

- **Eligibility:** Not eligible (fails C-5 and C-6): the bin would bypass `selectPromptRequiredProgram`, the envelope, the error projection, and the flag parser, and would hold a second definition of `--foreground`.
- **Summary:** Before `runEntrypoint`, match `["daemon","start",…]` and run the delivered main entry directly.
- **Constraint compliance:** Residency and drain pass; the second entry seam fails C-5 (the command is both prompt-required and separately handled) and C-6 (a second semantics surface).
- **Driver fit:** Reasonable on driver 1, bad on drivers 2, 4, 6.
- **Why rejected:** It is a permanent second path for one command, with its own exit-code and rendering behaviour.

#### Alternative 3 — Always in-process; accept that a bare start returns and exits

- **Eligibility:** Not eligible (fails C-1, C-2).
- **Summary:** Mount without `daemonEntry`; `start` always starts in the invoking process.
- **Constraint compliance:** C-1 fails (the invocation ends and the process exits); C-2 has no resident process to stop.
- **Why rejected:** It declines the ticket's central behaviour.

#### Sub-decision 1b — `daemonEntry` source

- **(i) `process.argv[1]` through a production fact (chosen):** the running entry path is the only value that is both executable and guaranteed to exist; it is the same value the unit's `ExecStart` needs, so one fact serves re-entry and install.
- **(ii) `brand.binaryName`:** not eligible — the name is not a path, and systemd does not search the user's install directory. *(Amended 2026-11-11, RF-1: the earlier "the child environment carries no PATH" ground is withdrawn; forwarding `PATH` does not make a bare name the running entry.)*
- **(iii) Read `process.argv[1]` inside the composer:** eligible on constraints, rejected on driver 4 and C-8's spirit — the composer takes every other process fact through injection (`processId`, `signalHost`).

#### Sub-decision 1c — how the child agrees on the state directory

- **(i) Resolve through `resolveStateDirectoryScope` (chosen):** the environment carries exactly one state-directory variable, bound to the resolved directory, and that variable is the outright authority inside this resolution — the forwarded `PATH`, `HOME`/`USERPROFILE`, and working-name override cannot influence it; the installed unit sets the same variable; the edge already resolves this way. *(Amended 2026-11-11, RF-1.)*
- **(ii) Pass `HOME` into the spawn environment:** not eligible (C-7) — two sources for one value, and the installed unit would still not read the variable it sets.
- **(iii) Keep the home-based template for the child only:** not eligible (C-7) — the child and parent would disagree.

#### Sub-decision 1d — control transport for `status --live`

- **(i) Compose the delivered unix transport with `settings.socketPath` (chosen):** `status --live` probes the same socket the daemon binds; `lockOwned` gates only stale-socket replacement inside `listen`, which the engine calls after acquiring the instance lock in the same process.
- **(ii) No transport:** not eligible (C-3).
- **(iii) Separate probe transport per command:** rejected on driver 5 (a second configuration of one socket).

#### Sub-decision 1e — wake source

- **(i) Omit wake in v1 (chosen):** residency comes from the explicit `runtime.loop()` in the lifetime path; the delivered loop already falls back to the injected clock at the heartbeat interval (5 s default), and `stop` is prompt because cancellation is polled at ≤250 ms.
- **(ii) Event-log tail wake:** rejected on driver 5 and the single-source-of-truth principle — production would have to re-derive the private ledger path (`ledger.<workspace>.jsonl`) that no exported accessor exposes, for a latency optimization with no acceptance criterion.
- **(iii) Wake with a constant size reader:** eligible but rejected as obfuscation — it expresses the delivered clock fallback through a seam that exists for a different purpose.

### Matrix — decision 2 (degradation source)

| Option | C-4 truthful | C-6 additive | C-8 pure | Sync read cost |
|--------|:---:|:---:|:---:|:---:|
| ALT-0 leave hardcoded | ❌ | ✅ | ✅ | ✅ |
| **ALT-1 per-read resolver over durable state (chosen)** | ✅ | ✅ | ✅ | ✅ |
| ALT-2 async control-plane probe inside reads | ✅ | ❌ | ✅ | ❌ |
| ALT-3 resolver over live PID probe | ✅ | ✅ | ❌ | ✅ |

#### Alternative 0 — Leave `degraded` hardcoded

- **Eligibility:** Not eligible (fails C-4).
- **Why rejected:** It is the defect the ticket names; no interpretation of the AC makes a permanent `daemon-unreachable` truthful.

#### Alternative 1 — Per-read resolver over durable daemon state (selected)

- **Eligibility:** Eligible.
- **Summary:** Widen `QueueComposition.degraded` to `readonly QueueDegradationReason[] | (() => readonly QueueDegradationReason[])` and resolve it at each projection (schedule, mutation outcome, lanes read, watch iteration). Production supplies a resolver that reads the latest instance record and heartbeat: live when the latest operation is `acquired`/`taken-over`, the heartbeat belongs to that instance, and `nowMs − beatAt` is strictly inside `lockStalenessMs` (an age equal to the bound is stale — *amended 2026-11-11, RF2-1*).
- **Constraint compliance:** Truthful within one staleness window (C-4); an additive optional union type (C-6); a pure predicate over injected facts (C-8).
- **Driver fit:** Best on drivers 1, 3, 4, 5.
- **Why chosen:** The durable record is the daemon's own claim about itself, written on the same store the queue reads; the freshness bound is the delivered lock-staleness semantics, so `queue list` and `daemon status` cannot disagree about what "stale" means.

#### Alternative 2 — Probe the control transport inside queue/lanes reads

- **Eligibility:** Not eligible (fails C-6): synchronous command runtimes would become async, and a 2 s response timeout would enter every queue read.
- **Why rejected:** Larger surface for the same answer, and it makes an offline read depend on a socket.

#### Alternative 3 — Resolver over `process.alive(recorded pid)`

- **Eligibility:** Not eligible (fails C-8): it puts a process probe in a read path and cannot verify identity (a reused pid reads alive).
- **Why rejected:** Liveness by pid alone is a weaker signal than the daemon's own heartbeat, and it breaks the pure-predicate rule.

### Matrix — decision 3 (instance pid)

| Option | C-2 safe stop | C-5 composes |
|--------|:---:|:---:|
| ALT-0 leave `pid: 0` | ❌ | ✅ |
| **ALT-1 compose `pid` + fail closed on non-positive (chosen)** | ✅ | ✅ |
| ALT-2 enumerate processes to find the daemon | ❌ | ✅ |

#### Alternative 0 — Leave the `pid: 0` fallback

- **Eligibility:** Not eligible (fails C-2): the recorded pid is `0` and `stop` would signal the caller's process group.
- **Why rejected:** It is a safety defect, not a cosmetic gap.

#### Alternative 1 — Add `pid?: number` to the composition and refuse non-positive pids on stop (selected)

- **Eligibility:** Eligible.
- **Summary:** Production passes `processId`; the composition forwards it to `createDaemonRuntime`. `stop` refuses a durable record whose pid is not a positive integer instead of signalling it.
- **Constraint compliance:** Records and signals the real process (C-2); one optional field plus a guard (C-6).
- **Why chosen:** The smallest change that removes the process-group hazard, and it makes `stop` fail closed on torn or legacy records.

#### Alternative 2 — Discover the daemon process by name or pattern

- **Eligibility:** Not eligible (fails C-2's "no signal to an unidentified target" intent and TDR-0017 C-4's handle-only termination rule).
- **Why rejected:** Name-based signalling is exactly the failure mode the coordinator decision forbids.

### Matrix — decision 4 (install identity)

| Option | C-1/C-3 startable unit | C-7 one identity | C-6 additive |
|--------|:---:|:---:|:---:|
| ALT-0 `binary = brand.binaryName`, config root = state dir | ❌ | ❌ | ✅ |
| **ALT-1 entry path, `<binaryName>-daemon.service`, user config root (chosen)** | ✅ | ✅ | ✅ |
| ALT-2 scope digest in the unit name | ✅ | ✅ | ✅ (rejected on legibility) |

#### Alternative 0 — Name-based binary and the default config root

- **Eligibility:** Not eligible (C-1/C-3): systemd would resolve a bare name against its own search path and the unit would be written under the state directory.
- **Why rejected:** Both halves produce an install that reports success and does nothing.

#### Alternative 1 — Brand-derived legible identity (selected)

- **Eligibility:** Eligible.
- **Summary:** `binary` = the same absolute entry path as `daemonEntry`; `unit` = `${brand.binaryName}-daemon.service`; `supervisorConfigDirectory` = `XDG_CONFIG_HOME` (when absolute and non-empty) or `<home>/.config`; `environmentName` = the exact `<PREFIX>_STATE_DIR` variable that `resolveStateDirectoryScope` reads; `scope` remains the engine's digest of the resolved state directory.
- **Constraint compliance:** Startable unit with the correct environment binding (C-1/C-3); one identity across install, status, and the child (C-7); composition values only (C-6).
- **Why chosen:** See DC-4.

#### Alternative 2 — Include the scope digest in the unit name

- **Eligibility:** Eligible; rejected on driver 6 (legibility) for v1.
- **Why rejected:** It solves a collision the ticket does not have, at the cost of a unit name no human can type or grep for. Recorded as a revisit trigger for multi-state-directory installs.

## Decision

- **Decision:** **Mount the delivered daemon family through the production entrypoint with four composition decisions:** (DC-1) the bin supplies the running entry path as a production fact, production resolves its state directory through `resolveStateDirectoryScope`, composes the delivered unix transport at the resolved socket path, and a foreground `start` owns the process lifetime through the injected signal host — SIGTERM drains, SIGINT stops immediately — returning the readiness snapshot captured at start; (DC-2) `QueueComposition.degraded` accepts a per-read resolver and production derives it from durable daemon state; (DC-3) the composing process id is recorded, and `stop` refuses a non-positive recorded pid; (DC-4) install identity is the brand-derived unit name under the user config root with the entry path as `ExecStart` binary and the resolved state variable as `Environment`.
- **Rationale (tied to drivers):** Driver 1 forces the lifetime and identity decisions to be observable behaviours rather than wiring: a start that returns is not resident, and a unit under the state directory is not a unit. Driver 2 is why the lifetime lives in the command runtime instead of a second bin path — the prompt-required selection and the envelope stay single-sourced. Driver 3 forces the degradation to be derived (the hardcoded marker is the defect) and the pid to fail closed (a `0` pid is a live hazard). Driver 4 is why the signal host and clock are injected: the refusal, drain, and staleness paths are otherwise untestable without real processes. Driver 5 keeps the change additive: optional composition fields, one union widening, no schema or error-table change, plus the one scoped takeover conformance fix. Driver 6 makes the unit name, config root, and variable name explainable in one line each, and driver 7 keeps every choice removable.
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-286 PR review; not claimed by this record.
- **Conditions for revisit:** See `revisit_triggers`; the load-bearing ones are a non-executable entry path, a second state directory, and any case where the durable reachability rule disagrees with the live socket probe beyond the staleness window.

### Constraint Compliance Attestation

The chosen alternatives satisfy C-1…C-8 as amended — C-6's scoped stale-lock takeover exception is written into the constraint itself, not taken as a waiver:

- **C-1** — the foreground lifetime path runs the delivered resident loop and releases only on stop; the parent proves readiness from the durable instance record.
- **C-2** — stop is the delivered release path (`drain` detaches lanes, `immediate` appends `immediate-stop`), and a non-positive recorded pid is refused before any signal.
- **C-3** — the composed unix transport binds the resolved socket path, and the state directory is created 0700 by the state edge, so `status --live` reaches a live daemon.
- **C-4** — the per-read resolver derives both directions from durable state in every projection, including watch iterations.
- **C-5** — the runtime is composed unconditionally; an absent entry path degrades one start shape.
- **C-6** — optional composition fields, one internal union widening, and one scoped engine exception (the `lockToken`-keyed compare-and-delete before the exclusive re-acquire, on an `evaluateDaemonLock` takeover decision only); no engine semantics beyond stale-lock takeover, and no protocol, error-table, or schema change.
- **C-7** — one resolution, one authoritative variable, one canonical directory across parent, child, unit, store, lock, socket, and read side; the re-entry environment carries additional path/home facts, but the state-directory variable is written last and wins outright (*amended 2026-11-11, RF-1*).
- **C-8** — the reachability rule is a pure predicate; I/O stays in the composition tier.

### DC-1 — Entry-path re-entry and signal-owned foreground lifetime

**Production supplies `daemonEntry` from an explicit fact.** `ProductionCompositionFacts` gains an optional `daemonEntry?: string` (*amended 2026-11-11, A2-9: the provisional name `entryScriptPath` is retired — the fact and the composition input it feeds share the one name the specification's DEC-2 adopts*); `packages/cli/bin/delivery-os.ts` supplies `process.argv[1]`. Production forwards it as `DaemonComposition.daemonEntry`, and only when it is a non-empty string. The value is **not** `brand.binaryName`: `spawnDetached` replaces the child environment rather than extending it, so every value the child needs must be supplied explicitly, and systemd resolves a bare `ExecStart` against its own fixed search path rather than the user's install directory. *(Amended 2026-11-11, RF-1: the earlier inference "the child inherits no PATH" is withdrawn — the re-entry environment forwards the path facts explicitly in the next paragraph.)* The same fact is reused as `binary` for install (DC-4), so re-entry and the unit can never disagree about which executable this product is.

**The re-entry environment forwards the minimum the child cannot resolve alone.** *(Added 2026-11-11 — DoR RF-1, iteration 1.)*

| Variable | Source | Why it is in the environment |
|----------|--------|------------------------------|
| `<PREFIX>_STATE_DIR` | the resolved state directory (written **last**) | The sole authority for the state directory; `resolveStateDirectoryScope` gives it outright precedence. |
| `PATH` | the composing process, when non-empty | The shipped entry is `#!/usr/bin/env bun`; with a replaced environment and no `PATH`, `/usr/bin/env` searches only its confstr default (`/usr/bin:/bin`) and cannot find a user-local `bun`, so a bare `daemon start` never brings the daemon up. |
| `HOME` (or `USERPROFILE` when `HOME` is empty) | the composing process, when non-empty | Keeps the child's brand/state resolution and the delivered home-default path in agreement with the parent, so a missing home can never silently resolve to a root-level directory. |
| the working-name override (`workingNameEnvironmentVariable()`) | the composing process, only when set and non-empty | A renamed product's child then resolves the same brand prefix as its parent, so the child and the installed unit agree. |

The extra variables arrive through one optional, additive composition input; an embedder or test that supplies none keeps the delivered single-variable spawn unchanged. The state-directory binding is emitted after them, so a stale `<PREFIX>_STATE_DIR` carried in the forwarded environment can never override the resolved directory. The install path is unchanged: systemd supplies its own `PATH`, and the unit already binds `<PREFIX>_STATE_DIR`.

**The foreground start owns the lifetime through the injected signal host.** When `signalHost` is composed and `foreground` is true, `start` performs, in order: `runtime.start({foreground:true})`; capture the readiness snapshot; start the resident loop (`running = runtime.loop()` — a no-op if a wake source ever auto-starts it); await a promise settled by the first of `SIGINT`/`SIGTERM` (`SIGTERM` → `"drain"`, `SIGINT` → `"immediate"`); `await runtime.stop({mode})`; remove both listeners in a `finally`; await `running`; return the captured snapshot, or the stop failure when the release fails. The cancellation-first ordering inside `runtime.stop` guarantees a failed release still terminates the loop, so the handler cannot hang. When no signal host is composed, `start` returns at readiness exactly as delivered — library embedders, tests, and the documented in-process shape are unchanged, and an absent entry path degrades only the non-foreground start shape rather than removing the command (C-5).

**Production resolves its state directory through `resolveStateDirectoryScope`.** The resolved value replaces the inline `<home>/<brand.stateDirectoryName>` template and feeds the store, the daemon lock, `resolveDaemonSettings`, the transport, the supervisor scope, and the `environmentName` binding. This is what makes the detached child (whose `<PREFIX>_STATE_DIR` binding is the authoritative state-directory input, whatever else its environment carries — *amended 2026-11-11, RF-1*) and the installed unit (`Environment=<PREFIX>_STATE_DIR=<dir>`) land on the same ledger, lock, and socket as the parent. When the variable is unset the value is identical to today's.

**Production composes the delivered control plane.** `settings` comes from `resolveDaemonSettings(values, origins, { stateDirectory })` and falls back to the same call over an empty branch, so defaults (including the socket path and name) are never re-derived as literals. The transport is `createUnixTransport({ stateDirectory, socketPath: settings.socketPath, lockOwned: () => true })`, passed with `socketPath`. `lockOwned` gates only stale-socket replacement inside `listen`, and the engine calls `listen` only after acquiring the instance lock in the same process; no client command calls `listen`, so a crashed daemon's leftover socket file is replaced by the next start instead of wedging restarts.

**No wake source in v1.** Residency comes from the explicit loop; the delivered loop already falls back to the injected clock at the heartbeat interval, and cancellation is polled at ≤250 ms so `stop` is prompt. An event-log tail would require the composition to re-derive the private ledger path for a latency optimization with no acceptance criterion.

### DC-2 — Degradation resolved per read from durable daemon state

`QueueComposition.degraded` widens to `readonly QueueDegradationReason[] | (() => readonly QueueDegradationReason[])`. Both the queue and lanes runtimes resolve it at each projection — schedule reads, mutation outcomes, and every watch iteration — instead of capturing it at composition time. The resolver is a pure predicate over injected facts, and production supplies it:

> reachable **iff** the latest instance record's operation is `acquired` or `taken-over`, **and** the latest heartbeat record belongs to that instance id, **and** `nowMs − Date.parse(beatAt) < lockStalenessMs`; otherwise `["daemon-unreachable"]`. *(Amended 2026-11-11 — DoR RF2-1: the bound is strict; the boundary note below states the equality case.)*

The bound is **exclusive**. A heartbeat whose age is exactly `lockStalenessMs` is stale: `ageMs === lockStalenessMs` reads as unreachable, and at that boundary `queue list` and `lanes` report `["daemon-unreachable"]`. This is the delivered fold's own rule — `foldDaemonLiveness` classifies `ageMs >= stalenessMs` as `stale` (`packages/core/src/domain/daemon-heartbeat.ts:63`) — and the same strict boundary the specification, plan, and test plan pin (DM-4, EVT-2, AC-F5-4, AC-F5-6, TC-073), so `queue list` and `daemon status` cannot disagree by one millisecond. *(Amended 2026-11-11 — DoR RF2-1, iteration 2: the earlier predicate pinned the inclusive `≤`, which would have implemented an off-by-one boundary and failed AC-F5-4/TC-073.)*

The authoritative source is **durable state**, not the control socket: the queue and lanes reads are synchronous store projections today, and making them await a socket round-trip with a response timeout would change the command surface for an answer the store already holds. The daemon writes both facts itself (instance on acquire/release, heartbeat on the heartbeat cadence), so the read side consumes the daemon's own claim rather than a second observation of it. Freshness uses the delivered lock-staleness semantics, which keeps `queue list` and `daemon status` consistent about what "stale" means; a live-but-wedged daemon is correctly reported unreachable, and a crash inside the staleness window is reported reachable for at most that window (bounded, disclosed, and identical to what `daemon status` would already say).

### DC-3 — The composing process id is recorded, and a non-positive pid is refused

`DaemonComposition` gains `readonly pid?: number`, forwarded to `createDaemonRuntime`. Production forwards `facts.processId` only when it is a positive integer, so each composing process (parent, or the detached child for its own invocation) records its own id. Because the engine's fallback is `0` and `process.kill(0, signal)` addresses the caller's process group, `stop` additionally refuses a durable record whose pid is not a positive integer, returning the delivered `daemon.state-recovery-failed` classification and sending no signal. The refusal covers torn or legacy records as well as any future composition that omits the field: recording the real pid is the fix, failing closed is the guard that makes an absent fact safe instead of dangerous.

### DC-4 — Brand-derived install identity

| Value | Production derivation | Why |
|-------|----------------------|-----|
| `binary` | the same absolute entry path as `daemonEntry` | `ExecStart` needs an absolute executable; the running entry is the only path guaranteed to exist and to be the same product. |
| `unit` | `${brand.binaryName}-daemon.service` | One legible name per user, names the actor (`-daemon`), and cannot collide with a future product-wide unit. |
| `supervisorConfigDirectory` | `environment.XDG_CONFIG_HOME` when absolute and non-empty, otherwise `${homeDirectory}/.config` | This is the root systemd reads for user units and the root the CLI already uses for user configuration; the delivered default (the state directory) is not a root systemd searches. |
| `environmentName` | the exact `<PREFIX>_STATE_DIR` variable read by `resolveStateDirectoryScope`, derived once and shared | The unit's `Environment=` and the daemon's resolution must be one definition, not two. |
| `scope` | `daemonScopeDigest(resolved state directory)` (computed inside the command runtime) | Scope identity is the state directory, never the brand name, the working name, or the cwd. |

The unit's optional fields keep their delivered forms (`Type=simple`, `WantedBy=default.target`, `Restart=on-failure`, linger enabled at install). One unit name per user means two state directories overwrite each other's unit; that limitation is declared, out of scope, and recorded as a revisit trigger.

**Scoped engine exception — stale-lock takeover conformance.** *(Added 2026-11-11 — review iteration 3, NF3-1.)* The delivered daemon contract already claims crash-safety and takeover, and the engine already appends `taken-over` when `evaluateDaemonLock` classifies the observed lock as stale. Without a reap, though, that branch was dead: the subsequent exclusive create hit the still-present `daemon.lock`, returned `state.lock.busy`, and mapped to `daemon.already-running`, so a crashed (SIGKILL/OOM/reboot) daemon could never restart. The mount therefore includes exactly one engine conformance fix: on a `takeover` decision, remove the record the staleness evaluation proved dead, keyed on the observed `lockToken` (`removeIfTokenMatches`, `packages/core/src/state/daemon-lock.ts:69-93`), before the exclusive re-acquire (`packages/core/src/app/daemon-runtime.ts:294-304`). The compare-and-delete keeps the race honest — a concurrent starter that replaced the lock in the meantime gets `state.lock.busy` → `daemon.already-running`, and the lock is left in place — and `evaluateDaemonLock` remains the only staleness decision. No other engine semantics, durable record, protocol frame, or error row changes.

## Trade-offs & Consequences

### Positive Outcomes

- `daemon start`, `daemon stop`, `daemon status --live`, and `daemon install` become real behaviours of the shipped binary, with the same readiness, drain, and release evidence the engine already records.
- One state-directory resolution removes a latent inconsistency between the production store and its own edge; the installed unit and the detached child now agree with the parent by construction.
- A recorded pid removes the process-group signalling hazard, and the fail-closed guard covers records the composition did not write.
- Queue and lanes degradation becomes derived truth, in both directions, and stays consistent with `daemon status` by construction.
- Every new input is optional and additive: no migration, no schema, and no error identity. The one engine change is the scoped takeover conformance fix — the stale-lock compare-and-delete that makes the delivered `taken-over` branch reachable — so a crashed daemon can restart; no other engine semantics, record, protocol frame, or error row changes.

### Negative Outcomes

- A `daemon start --foreground` invocation renders its start receipt when the handler resolves (at stop), matching `coordinator start`; an operator watching a terminal sees no started line until they stop it. The live read side is `daemon status`.
- The reachability rule is durable-state-based, so a crash inside the lock-staleness window (default 30 s) is reported reachable until the heartbeat goes stale.
- The unit name is one per user, so a second state directory overwrites the first install.
- `process.argv[1]` is an assumption about the host: a wrapper or ephemeral script path makes re-entry and `ExecStart` fail, and the failure is a declared readiness timeout rather than a PATH guess.
- The re-entry environment is rebuilt from the composing process's environment, so a caller that strips `PATH` or `HOME`/`USERPROFILE` from its own environment cannot be repaired by the spawn: the child fails closed at spawn or readiness with the classified `daemon.state-recovery-failed`. *(Added 2026-11-11, RF-1; this replaces the earlier working-name limitation — forwarding the override means a renamed product's child now resolves the same brand prefix as its parent.)*
- DC-1c changes where state lives for anyone who sets `<PREFIX>_STATE_DIR` today: the production composition starts honouring the documented override it previously ignored.
- The mount is no longer purely additive: it carries one engine change (the stale-lock compare-and-delete), so the takeover race is part of the review and regression surface, even though the exclusive create still arbitrates concurrent starters and no other lock semantics move.

### Unresolved Questions

- [ ] Should a non-executable or vanished entry path be refused at composition time (a startup error) instead of surfacing as a `resident-readiness-timeout` at start? (owner: `@spec-writer`)
- [ ] Should the unit name include a scope digest once a second state directory is supported? (owner: the follow-up change; revisit trigger recorded here)
- [ ] Should `createDaemonMainEntry` be removed now that the command runtime owns the lifetime, or retained as a library seam? (owner: `@plan-writer`)
- [ ] Should the degradation resolver be exposed on `daemon status` as the single shared predicate, or duplicated by the status fold? (owner: `@coder`, with a test asserting agreement)

## Implementation Plan

1. **Production composition.** Add the optional `daemonEntry` fact (*amended 2026-11-11, A2-9: the field is `daemonEntry`, not `entryScriptPath`*) and supply it from the bin; resolve the state directory through `resolveStateDirectoryScope`; forward the re-entry environment (state-directory binding, `PATH`, `HOME`/`USERPROFILE`, non-empty working-name override) through one optional additive input, with the state-directory binding written last; build the daemon composition (store, `createDaemonLockPort`, resolved settings, unix transport, supervisor root, unit, environment name, entry path, pid, scope-free engine inputs) and pass it as `ConfigProgramOptions.daemon` unconditionally.
2. **Composition inputs.** Add `pid` to `DaemonComposition` and forward it; add the foreground lifetime path to `start` (loop + signal host + stop) with listener cleanup in a `finally`; refuse a non-positive recorded pid in `stop`.
3. **Degradation seam.** Widen `QueueComposition.degraded` to accept a resolver, resolve it per projection in the queue and lanes runtimes, and supply a durable-state resolver (pure predicate) from production.
4. **Mount and documentation surface.** Add `daemon` to `PROMPT_REQUIRED_COMMANDS`; update the help reference page for `daemon` with the `--help`/`--version` coverage the help check requires; keep the entrypoint's help inventory consistent.
5. **Guardrails.** No new error identity and no schema change; one scoped engine fix only — the `lockToken`-keyed stale-lock removal before the exclusive re-acquire on an `evaluateDaemonLock` takeover decision (see the scoped engine exception) — with no other engine semantics, record, protocol frame, or error row touched; every new composition field optional; tests inject the signal host, clock, process port, and store so no test depends on a real signal or wall clock.

## Verification Criteria

- Metric: `daemon start` produces a durable `acquired` instance with the composing pid — Target: recorded pid equals the composing process id, never `0` — Window: composed-runtime test.
- Metric: a second-process `daemon stop --mode drain` empties the lane set into `detached` and appends `released` — Target: one released record, zero remaining `delivering` lanes — Window: two-process test.
- Metric: `daemon status --live` against a started daemon — Target: live envelope, socket reachable, heartbeat `running` — Window: test.
- Metric: `daemon install` unit content — Target: `<configDirectory>/systemd/user/<binaryName>-daemon.service` containing `ExecStart=<entry path> daemon start --foreground` and `Environment=<PREFIX>_STATE_DIR=<state dir>` — Window: test.
- Metric: `queue list` / `lanes` degradation — Target: `[]` for a live fresh instance, `[daemon-unreachable]` for released/absent/stale, including a watch iteration that changes state — Window: four-fixture test.
- Metric: parent/child/unit state-directory identity — Target: one canonical directory with and without `<PREFIX>_STATE_DIR` — Window: composition test.
- Metric: re-entry environment of a bare `daemon start` — Target: the child environment carries `<PREFIX>_STATE_DIR` bound to the resolved directory plus the parent's `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override; the state-directory binding wins over any stale value; a child spawned with no extra variables keeps the delivered single-variable shape — Window: composition test + a spawned-process test of the shipped `#!/usr/bin/env bun` entry.
- Metric: entrypoint composition — Target: `daemon` composed, no prompt-required throw, help reference coverage green — Window: entrypoint and help-check tests.

## Confidence Rating

**Medium-High.** The delivered seams, projections, transport preconditions, and supervisor path composition are read from source and referenced above, and the risky details (environment replacement, `kill(0)` semantics, loop cancellation ordering, config root) are facts rather than inferences. The two residual uncertainties are behavioural: the host's `argv[1]` guarantee under wrappers, and the choice of lock-staleness as the freshness bound. Both are bounded, disclosed, and named as revisit triggers; neither blocks delivery, and both are cheap to change.

## Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-11-11 | DC-1: the detached child's re-entry environment is no longer "exactly one variable". It carries `<PREFIX>_STATE_DIR` (the authoritative state directory, written last) **plus** the composing process's `PATH`, its `HOME` (or `USERPROFILE`), and a non-empty working-name override, delivered through one optional additive composition input. The Context FACT, sub-decisions 1b/1c, the C-7 attestation, the Negative Outcomes limitation, the Implementation Plan, the Verification Criteria, and the revisit triggers are aligned with it. | DoR finding RF-1 (readiness iteration 1, change GH-286): `spawnDetached` replaces the child environment and the shipped entry is `#!/usr/bin/env bun`, so with no `PATH` the interpreter is unresolvable and a bare `daemon start` cannot bring the daemon up. Forwarding the minimum set is the executable form of the pinned re-entry contract; it also removes the earlier working-name limitation, leaving a caller that strips `PATH`/`HOME` as the declared residual. |
| 2026-11-11 | DC-2: the reachability predicate pins a **strict** staleness bound — `nowMs − Date.parse(beatAt) < lockStalenessMs` — and states the boundary explicitly: a heartbeat whose age is exactly `lockStalenessMs` is stale, so `queue list` and `lanes` report `["daemon-unreachable"]` at that boundary, matching the delivered fold (`ageMs >= stalenessMs` → `stale`, `packages/core/src/domain/daemon-heartbeat.ts:63`). C-4 and the decision-2 chosen-alternative summary are aligned with the exclusive bound. | DoR finding RF2-1 (readiness iteration 2, change GH-286): the record pinned the inclusive `≤` while spec DM-4/EVT-2/AC-F5-1/AC-F5-4/AC-F5-6, the plan header with tasks 5.2–5.3, and test-plan TC-073 all pin strict `<`. An implementer following the declared-binding record would implement an off-by-one boundary and fail AC-F5-4/TC-073. |
| 2026-11-11 | DC-1: the production fact is named `daemonEntry` (not `entryScriptPath`), so the fact and the `DaemonComposition.daemonEntry` input it feeds carry one name; the Implementation Plan names the same field. | DoR advisory A2-9 (readiness iteration 2, change GH-286): the specification's DEC-2 adopts `daemonEntry` for both the fact and the composition input, and the record still named `ProductionCompositionFacts.entryScriptPath`, which would have sent an implementer looking for a field that does not exist. |
| 2026-11-11 | **Scope amendment (NF3-1, review iteration 3): the earlier "no daemon engine edit" scope statement is superseded by a scoped exception.** The Problem Framing out-of-scope note, C-6, the C-6 attestation, the Positive Outcomes line, the Negative Outcomes list, and the Implementation Plan guardrail now state that the mount includes **one contract-conformance engine fix**, limited to stale-lock takeover: on an `evaluateDaemonLock` `takeover` decision, remove the lock record that evaluation proved dead — a `lockToken`-keyed compare-and-delete (`removeIfTokenMatches`, `packages/core/src/state/daemon-lock.ts:69-93`) — before the exclusive re-acquire (`packages/core/src/app/daemon-runtime.ts:294-304`). The loser of a concurrent race still gets `state.lock.busy` → `daemon.already-running`; no other engine semantics, durable record, protocol frame, or error row changes. | Review finding NF3-1 (review iteration 3, change GH-286): the delivered daemon contract already claims crash-safety and takeover and the engine already appends `taken-over`, but without the reap that branch was dead — the exclusive create hit the still-present `daemon.lock` and returned `daemon.already-running`, so a crashed daemon could never restart. The record (and the change spec's non-goals) claimed no engine edit, which contradicted the shipped code. |

## References

- GH-286 change folder — `doc/changes/2026-11/2026-11-11--GH-286--daemon-command-mounting/` (clarify_scope notes name the four routed composition choices).
- GH-238 resident dispatch daemon — the delivered daemon engine, control plane, supervisor adapter, and status projection.
- [TDR-0017](TDR-0017-coordinator-supervision-architecture.md) — supervisor regime, instance lease, and the foreground-loop/signal precedent this record reuses in shape.
- [TDR-0004](TDR-0004-state-storage-engine.md) — state engine and additive record boundaries.
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — command result and exit taxonomy.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — package tiers, dependency rules, and composition ownership.
- `packages/cli/src/daemon-compose.ts`, `packages/cli/src/production.ts`, `packages/cli/src/entrypoint.ts`, `packages/core/src/config/catalog.ts`, `packages/adapters/src/daemon/{unix,supervisor,process,wake}.ts`.
