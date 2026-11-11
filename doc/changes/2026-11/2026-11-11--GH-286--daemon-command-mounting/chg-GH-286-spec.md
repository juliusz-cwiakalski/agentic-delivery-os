---
change:
  ref: GH-286
  type: feat
  status: Proposed
  slug: daemon-command-mounting
  title: "Mount the daemon lifecycle command in the entrypoint (start/stop/status/install)"
  owners: ["engineering"]
  service: delivery-os
  labels:
    - cli
    - daemon
    - entrypoint
    - degradation
    - help
    - process-lifecycle
    - install
    - m1
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal:
      - "delivered resident daemon engine, control protocol, supervisor adapter, and status projection (M1-S18, GH-238)"
      - "prompt-required composition and self-description surface (GH-242)"
      - "production composition and state-directory scope resolution"
      - "coordinator supervision foreground-lifetime and signal-host precedent (M1-S23, GH-241)"
      - "state artifact boundary and durable instance/heartbeat records"
    external:
      - "POSIX process signals (SIGTERM, SIGINT) and detached process spawning"
      - "systemd user manager (unit file, enable, linger) on Linux"
      - "XDG user configuration root"
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/286
  related_changes: ["GH-286", "GH-238", "GH-241", "GH-242", "GH-284"]
  related_decisions: ["ADR-0003", "TDR-0004", "TDR-0005", "TDR-0017", "TDR-0022"]
  contracts:
    - "packages/cli/src/production.ts"
    - "packages/cli/bin/delivery-os.ts"
    - "packages/cli/src/daemon-compose.ts"
    - "packages/cli/src/edge.ts"
    - "packages/cli/src/help.ts"
    - "packages/cli/src/help/prompt-required-commands.ts"
    - "tests/fixtures/help-guide/coverage.json"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the delivered resident daemon reachable from the shipped binary — one production composition that starts a resident process, stops and drains it, reports its state, installs its user unit, and derives queue/lanes degradation from durable daemon state instead of a hardcoded marker.

## 1. SUMMARY

Mount the delivered `daemon` lifecycle family in the production entrypoint. The production composer supplies an unconditional daemon runtime built over the resolved state-directory scope, the composing process identity, the injected signal host, and the running entry path; the prompt-required command set gains `daemon`; and a help entry plus reference-page coverage ships with it. A bare `daemon start` leaves a resident, self-releasing process that records its own pid, and `daemon start --foreground` owns its lifetime through the injected signal host (`SIGTERM` → drain, `SIGINT` → immediate stop). `daemon install` writes the brand-derived user unit under the user configuration root. `queue list` and `lanes` resolve `daemon-unreachable` from durable instance and heartbeat records at each projection, so the marker becomes a fact in both directions.

The change is additive: no daemon engine, control-protocol, error-identity, or state-schema change. Every new surface is an optional composition input, one internal union widening, or one command-registry and help addition.

## 2. CONTEXT

### 2.1 Current State Snapshot

The resident daemon is delivered and its command family is defined, but the shipped binary cannot reach it:

- **The composition seam exists and is unused.** `ConfigProgramOptions.daemon?: DaemonCommandRuntime` is declared on the CLI program options and the program registers the definition only when the runtime is supplied (`packages/cli/src/edge.ts`). `createDaemonCommandRuntime` composes the delivered lifecycle from a `DaemonComposition` (`packages/cli/src/daemon-compose.ts`), whose required inputs are the state store, the daemon lock port, resolved daemon settings, the lane restart bound, the state directory, the unit name, the binary path, the environment variable name, and three identity factories; its optional inputs include the transport, socket path, entry path, wake source, supervisor adapter, platform, supervisor config directory, and lane composition.
- **Production supplies no daemon runtime.** `packages/cli/src/production.ts` declares no daemon composition and passes no `daemon` option, so `selectPromptRequiredProgram` composes the prompt-required set without it. `daemon` is absent from `PROMPT_REQUIRED_COMMANDS` (`packages/cli/src/help/prompt-required-commands.ts`), and the help inventory (`packages/cli/src/help.ts`) carries no `daemon` entry. The delivered `createDaemonMainEntry` (`packages/cli/src/daemon-main.ts`) has no caller.
- **Production derives its state directory from home only.** It builds `<home>/<brand.stateDirectoryName>` inline, while the CLI edge resolves the same value through `resolveStateDirectoryScope`, which gives `<PREFIX>_STATE_DIR` outright precedence and rejects a non-absolute override as `config.value.invalid` (`packages/core/src/config/catalog.ts`). The installed unit's only environment binding is `<PREFIX>_STATE_DIR=<state dir>` (`packages/adapters/src/daemon/supervisor.ts`), and a detached child is spawned with a replaced environment carrying that variable alone (`packages/adapters/src/daemon/process.ts`), which is the delivered shape this change extends.
- **A foreground start installs no lifetime.** `runtime.start` auto-runs the resident loop only when a wake source is composed; nothing installs signal handling, so a foreground daemon dies on `SIGTERM` without releasing the instance lock or marking delivering lanes `detached`. A cross-process `stop` signals the recorded pid from a different process.
- **No pid reaches the engine.** `DaemonRuntimePorts.pid` exists, but `DaemonComposition` exposes no `pid`, so the engine's `pid: 0` fallback is recorded. A later `stop` would call the delivered signal path with `0`, which on POSIX addresses the **caller's own process group**.
- **Degradation is hardcoded.** `QueueComposition.degraded?: readonly QueueDegradationReason[]` is captured once per runtime and consumed by the queue schedule, the mutation outcome, and the lanes read. Production hardcodes `degraded: ["daemon-unreachable"]` (`packages/cli/src/production.ts`), so every queue and lanes read reports a daemon that can never be reachable. `readDaemonStatus` derives that same marker from durable records and consumes socket reachability as an input alongside them (`packages/core/src/app/daemon-status.ts`).
- **The delivered install seam is unused by production.** The systemd user adapter writes `<configDirectory>/systemd/user/<unit>` plus an ownership marker beside it and enables linger; `renderSystemdUnit` emits `ExecStart=<binary> daemon start --foreground` and `Environment=<PREFIX>_STATE_DIR=<state dir>`. The command runtime defaults the config directory to the state directory, which is not a root systemd reads.
- **Current-truth documentation states the opposite of the target.** `doc/spec/features/feature-cli-entrypoint.md` records that the daemon is not prompt-required and that the production entrypoint supplies no daemon runtime; `doc/spec/features/feature-resident-daemon.md` records that the family is composed only when a runtime is supplied and that the production entrypoint supplies none; `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` records the registration gap as open product work with observed `unknown flag "--help"` and `unexpected argument "status"` evidence; `doc/planning/oss-tooling/milestones/m1/commands/daemon.md` records the command as not mounted.

**Users and current impact.** The operator (private-fleet operator and the owner) has no supported way to start, inspect, or stop the resident daemon from the installed binary; every queue and lanes read on a default install reports `daemon-unreachable` permanently, which makes the marker meaningless; and the M2 stories that presume a resident daemon cannot be exercised end to end.

### 2.2 Pain Points / Gaps

- **Unreachable lifecycle surface.** The family exists in the composition and in the planning docs but not in the shipped program; the ticket's whole acceptance is stated in terms of invocations that currently fail as unknown flags or arguments.
- **No resident start shape.** Nothing in the production path re-enters the CLI as a detached resident process, and nothing owns a foreground process's lifetime. A daemon that returns at readiness is not resident; one that is killed leaves a held instance lock behind.
- **No real instance pid.** The engine's `0` fallback is written to durable state, which turns `daemon stop` into a process-group signal hazard rather than a no-op.
- **Two state-directory resolutions.** The production store and its own edge can disagree about the state directory, and the installed unit and the detached child would agree with neither.
- **Permanent degradation marker.** The queue and lanes read side asserts a daemon fact it never observes, so the marker cannot distinguish a live daemon from an absent one.
- **Install identity undefined.** No caller supplies the absolute binary path, the legible unit name, or a configuration root systemd reads, so `daemon install` from the shipped binary could only write a unit that cannot start.
- **Help and reference coverage would withhold the command.** Even with a runtime composed, an absent `daemon` entry in the prompt-required set drops the command; adding it without a reference page and coverage inventory entries fails the help guards.

## 3. PROBLEM STATEMENT

Because the production composition supplies no daemon runtime, `daemon` is absent from the prompt-required set, no process owns a resident daemon's lifetime, no pid is recorded, and queue/lanes degradation is a constant, the operator cannot start, inspect, stop, or install the delivered resident daemon from the shipped binary; a foreground daemon cannot shut down cleanly, a stop could signal an unrelated process group, and every read surface reports a permanently unreachable daemon — which blocks the resident-daemon stories that depend on one.

**Who is affected.** The operator loses the only supported lifecycle surface; the owner loses an inspectable resident process and a user-level unit; the M2 subscribe and peak-pausing stories have no resident daemon to build on; and every agent reading `queue list` or `lanes` receives a degradation marker that carries no information.

## 4. GOALS

- **G-1** Mount the delivered `daemon` family in the production entrypoint so `start`, `stop`, `status`, `install`, and `uninstall` reach their handlers from the shipped binary.
- **G-2** Make a bare `daemon start` produce a resident, self-releasing daemon whose readiness evidence is durable state, not the child's output.
- **G-3** Make a foreground start own its process lifetime: `SIGTERM` drains, `SIGINT` stops immediately, and the instance lock is released on every exit.
- **G-4** Record the composing process's own pid and fail closed on any durable record whose pid is not a positive integer.
- **G-5** Resolve one canonical state directory for the composing process, the detached child, the installed unit, the store, the lock, the socket, and the queue read side.
- **G-6** Derive `daemon-unreachable` from durable daemon state at each queue and lanes projection, in both directions, and keep it consistent with `daemon status`.
- **G-7** Give `daemon install` a legible, brand-derived identity: an absolute `ExecStart`, one unit name per user, the user configuration root, and the state-directory environment binding the runtime actually reads.
- **G-8** Ship the command's help entry and reference coverage so the help, parity, and conformance guards pass and root `--help` lists the family.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|---|---|
| Lifecycle subcommands reachable from the shipped binary | 5 of 5 (`start`, `stop`, `status`, `install`, `uninstall`) |
| Queue and lanes reads reporting `daemon-unreachable` with a live, fresh daemon | 0 |
| Queue and lanes reads reporting `daemon-unreachable` with a released, absent, or stale daemon | 100% |
| Instance records carrying the composing pid (never `0`) from a production start | 100% |
| Signals sent to a non-positive recorded pid | 0 |
| State directories observed by parent, detached child, unit, store, lock, socket, and read side | 1 canonical directory |
| Prompt-required composition failures (the `fallback.internal` containment) on a production invocation | 0 |
| Help / reference coverage and parity guard failures | 0 |
| New error-table identities, record kinds, or schema versions | 0 |
| Existing tests that must change semantics to pass | 0 |

### 4.2 Non-Goals

- **NG-1** No change to daemon engine semantics, control-protocol frames, heartbeat or reconciliation records, or the daemon's own single-instance lock.
- **NG-2** No lane executor, dispatch lane composition, or supervision cadence added to the daemon; production keeps the delivered declared `supervise-only` mode.
- **NG-3** No `projects`, `events`, `attempts`, `board`, or any other M2 command.
- **NG-4** No change to the meaning of any existing envelope field or error-table row; every identity this change reaches is already in the table.
- **NG-5** No `--state-dir` flag and no daemon state-directory configuration key.
- **NG-6** No coordinator, dispatch, queue, merge, closeout, or status-digest behaviour change.
- **NG-7** No multi-state-directory install support, no coordinator unit, and no second OS supervisor adapter.
- **NG-8** No new dependency, no network listener beyond the delivered local unix socket, and no remote transport.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | Daemon lifecycle family mounted in the production entrypoint, with help and reference coverage | Turns a delivered-but-unreachable family into a shipped surface; registration implies the prompt-required set, the help inventory, and the coverage inventory together. |
| F-2 | Detached re-entry and signal-owned foreground lifetime | Makes `start` produce a resident daemon and makes `stop` observable: without re-entry a start returns and exits; without a lifetime owner a foreground daemon dies without releasing. |
| F-3 | One state-directory scope across parent, child, unit, store, lock, socket, and read side | Every value that must agree is currently undefined or resolved twice; one resolution removes a class of "works in tests, writes to the wrong ledger" failures. |
| F-4 | Composed control plane: resolved daemon settings and the delivered unix transport | `status --live` and `queue --watch` are only truthful against a socket the daemon actually binds at a path the client actually probes. |
| F-5 | Degradation resolved per projection from durable daemon state | Replaces a permanent lie with a derived fact, without turning synchronous reads into socket round-trips. |
| F-6 | Real instance pid and fail-closed stop | Removes the process-group signalling hazard and makes torn or legacy records safe instead of dangerous. |
| F-7 | Brand-derived install identity and classified unsupported supervisors | A unit that systemd does not read, or that names a bare binary, reports success and does nothing. |
| F-8 | Additive contract surface with preserved existing behaviour | Every new input is optional and every widening is internal, so embedders, fixtures, and delivered tests keep their contracts. |

### 5.1 Capability Details

**F-1 — Mounted family and its help surface.**
`PROMPT_REQUIRED_COMMANDS` gains `daemon`, and the production composer supplies a `daemon` runtime unconditionally. Unconditional is not a preference: `selectPromptRequiredProgram` throws when a prompt-required command is missing, so a conditionally registered family would turn every CLI invocation into the `fallback.internal` containment. The mount therefore never depends on the entry path, the signal host, a re-entry environment, a supervisor adapter being present, or the state directory resolving; an absent optional input — or the unresolvable state-directory outcome — degrades one start, spawn, or install shape and never removes the command. The help inventory gains a `daemon` family entry and one entry per subcommand, so `daemon start --help` resolves instead of failing as an unknown flag, and the family appears in root `--help` through the delivered family derivation. The coverage inventory gains `daemon` in `commands` and the daemon reference page in `referencePages`, and the reference page carries the `--help`/`--version` help section the coverage check requires.

**F-2 — Detached re-entry and foreground lifetime.**
A non-foreground `start` spawns the running entry path as `<entry> daemon start --foreground` in a detached process whose environment is rebuilt from the composing process and carries four things: the resolved state-directory binding (authoritative, written last), the composing `PATH`, its `HOME` (or `USERPROFILE` when `HOME` is empty), and the working-name override only when it is set and non-empty. The whole set arrives through one optional additive composition input, so an embedder or test that supplies none keeps the delivered single-variable spawn. The forward is not convenience: the spawned environment replaces the child's environment outright, the shipped entry is `#!/usr/bin/env bun`, and an environment without `PATH` leaves `/usr/bin/env` searching only its fallback directories, so a bare `start` could never resolve a user-local interpreter and never bring a daemon up. `start` waits for a durable `acquired` instance within the delivered readiness window and reports the start receipt from durable state (instance identity, the child's pid, socket, heartbeat, supervisor, degraded list). A readiness timeout is a classified failure, never a success claim. A foreground `start`, when a signal host is composed, performs: start the daemon and capture the readiness snapshot; install `SIGINT`/`SIGTERM` listeners; run the resident loop; wait for the first signal (`SIGTERM` → drain, `SIGINT` → immediate); stop with that mode; remove both listeners in a `finally`; await the loop; return the snapshot captured at start, or the stop failure when the release does not land. When no signal host is composed, `start` returns at readiness exactly as delivered, so embedders and tests keep the in-process shape.

**F-3 — One state-directory scope.**
The production composition resolves its state directory through the delivered scope resolution (environment override first, home default otherwise) and uses that single value for the store, the daemon lock, the daemon settings, the control socket, the supervisor scope, and the re-entry environment binding. The detached child, whose environment is replaced, still resolves the same directory: the state-directory binding is written into the child environment last and is the outright authority inside the resolution, so the forwarded `PATH`, `HOME`/`USERPROFILE`, and working-name override cannot influence it. The installed unit binds the same variable to the same directory; the queue and lanes read side reads the same store. Forwarding the home value also keeps the child's brand resolution and home default in agreement with the parent, so a missing home can never silently resolve to a root-level directory while the caller holds one. The remaining limitation is the caller's own environment: a process that strips `PATH` before invoking the product cannot be repaired by the spawn, and the child then fails closed at spawn or readiness with the classified `daemon.state-recovery-failed` (RSK-2, DEC-16); a caller that strips its home removes the only source of the default, which is the third outcome below (DEC-18). The resolution has exactly three outcomes: an absolute `<PREFIX>_STATE_DIR` override wins outright; otherwise the home-based `<home>/<brand.stateDirectoryName>` applies **only when a home exists**; otherwise — no override and no home — the directory is **unresolvable**. An unresolvable outcome does not suppress the mount (F-1, AC-F1-5 holds): the production composer still supplies the `daemon` family but composes an **unavailable daemon runtime**, so every subcommand returns the delivered `config.value.invalid` identity at exit `1` (`user-validation`) and the daemon composition opens no store, lock, socket, transport, or supervisor path; an empty home is never concatenated into a root-level `/<stateDirectoryName>`. A non-absolute override is not the unresolvable outcome: it keeps the delivered fallback to the home-based value when a home exists, and the invalid value is reported by the delivered resolution edge exactly as before. Non-daemon commands are untouched — their store composition keeps the existing home-based template (§7.2).

**F-4 — Composed control plane.**
Daemon settings resolve from the `daemon` configuration branch through the delivered resolver with the resolved state directory, falling back to the same resolver over an empty branch when configuration cannot be acquired, so defaults are never re-derived as literals and a configured socket path or heartbeat interval is honoured. Configuration that **is** acquired but whose `daemon` branch does not resolve is not silently replaced by the shipped defaults: the composition supplies the unavailable daemon runtime, so every daemon subcommand returns the delivered `config.value.invalid` identity at exit `1` and no daemon lock, transport, socket path, entry path, or supervisor scope is composed, while the `queue` and `lanes` read side reports `daemon-unreachable` in that same cell because it derives its marker from durable daemon records and consumes daemon configuration only for the staleness bound — the two surfaces diverge in exactly this cell, intentionally, and the divergence is declared in DEC-19. The delivered unix transport is composed at the resolved socket path with an ownership predicate that reports the lock as held by this process, so a leftover socket file from a crashed daemon is replaced by the next start rather than wedging restarts. A plain `status` reads durable state **and** probes the composed transport, reports the socket's reachability inside the same envelope, merges `daemon-unreachable` when the socket does not answer, and never fails closed: absent, released, stale, and unreachable are all one degraded success at exit `0`. Only `status --live` fails closed, when the socket is unreachable or the heartbeat is not `running`. The socket-free claim of this change is confined to the queue and lanes read path (F-5, NFR-3).

**F-5 — Degradation resolved per read.**
`QueueComposition.degraded` accepts either the delivered marker array or a resolver function, and the queue and lanes runtimes resolve it at every projection — the schedule read, the mutation outcome, the lanes read, and each watch iteration — instead of capturing it at composition time. Production supplies a resolver that is a pure predicate over injected facts: reachable **iff** an instance record exists whose latest operation is `acquired` or `taken-over`, the latest heartbeat record's `instanceId` equals that instance's identity, and the heartbeat age is strictly below the configured lock-staleness bound; otherwise `daemon-unreachable`. The predicate is an ownership rule, not a liveness rule: a heartbeat with no instance record, or one naming an instance other than the latest, is never reachable even though the delivered status fold calls a fresh heartbeat `running` — that divergence is declared and justified in DM-4 and AC-F5-8. Durable state is the source because the daemon writes both facts itself and because the queue and lanes reads are synchronous store projections that must not gain a socket dependency. The bound is the same one `daemon status` uses and is applied with the same strict comparison, so the two surfaces cannot disagree about what "stale" means; they agree on every cell where the heartbeat's owner is the instance record, which is exactly the domain AC-F5-6 states. An unreadable or torn instance or heartbeat read degrades to `daemon-unreachable`; it never fabricates reachability and never throws into a queue read.

**F-6 — Real pid and fail-closed stop.**
The daemon composition accepts an optional composing pid and forwards it to the runtime, so an instance record carries the process that actually acquired the lock. Because the engine's fallback is `0` and a zero pid addresses the caller's own process group, a cross-process `stop` refuses a durable record whose pid is not a positive integer: it returns the delivered recovery identity and sends no signal. Recording the real pid is the fix; the refusal is the guard that makes an absent or torn record safe.

**F-7 — Install identity and classification.**
`install` uses the same absolute entry path as `daemonEntry` for the unit's `ExecStart`, one legible unit name derived from the brand's binary name, the user configuration root (`XDG_CONFIG_HOME` when absolute and non-empty, otherwise `<home>/.config` when a home exists — with neither, the root is unresolvable and `install` refuses as DM-6 and AC-F7-2 state) as the directory systemd reads, and the exact state-directory environment variable name the runtime resolves, bound to the resolved directory. Linger stays enabled on a successful install, and the receipt reports the descriptor. A platform without a delivered supervisor adapter, or a linger failure, returns the classified unsupported identity and writes no unit. `uninstall` removes only what this installation created and reports `noop` when nothing is installed. With no entry path composed, `install` refuses rather than rendering a unit with an empty executable.

**F-8 — Additive contract.**
No existing exported signature narrows. `DaemonComposition` gains only optional inputs; `ProductionCompositionFacts` gains only optional facts; `QueueComposition.degraded` widens to a union whose array member is unchanged; the command definition, its grammar, and its envelope shapes are unchanged. No error identity, record kind, payload schema, or state schema version changes, and every identity this change reaches is a delivered row.

## 6. USER & SYSTEM FLOWS

**Flow 1 — Bare start, detached residency.**
```
operator -> <binary> daemon start
  -> resolve state directory (absolute override, else home-based when a home exists,
                                else unresolvable -> unavailable runtime, Flow 7),
     settings, transport, supervisor identity
  -> spawn <entry path> daemon start --foreground
       env: PATH, HOME (or USERPROFILE), the working-name override when set,
            then <PREFIX>_STATE_DIR=<dir> written last as the authority
  -> poll durable instance for an acquired record within the readiness window
  -> acquired -> report instance (child pid), socket, heartbeat, degraded, exit 0
  -> not acquired -> daemon.state-recovery-failed (resident-readiness-timeout), exit 2
```

**Flow 2 — Foreground lifetime and drain from another process.**
```
operator -> <binary> daemon start --foreground
  -> runtime.start, capture readiness snapshot, install SIGINT/SIGTERM listeners, run loop
operator (second shell) -> <binary> daemon stop --mode drain
  -> read latest instance record; pid is a positive integer
  -> SIGTERM to that pid; report result=draining (request accepted)
resident process -> handler: stop({mode:"drain"})
  -> delivering lanes appended as detached; instance appended as released (releaseReason=drain)
  -> loop cancels, listeners removed in a finally, process exits 0
operator -> <binary> daemon status  -> stopped/stale report, socket reachability reported,
                                     degraded derived from durable state, exit 0
```

**Flow 3 — Queue and lanes degradation follows the daemon.**
```
daemon start -> instance acquired + heartbeat beatAt
queue list / lanes   -> resolver: owned instance acquired/taken-over + matching heartbeat
                        + age strictly below the staleness bound -> degraded []
daemon stop --mode drain -> instance released
queue list / lanes   -> resolver: latest operation released -> degraded ["daemon-unreachable"]
```

**Flow 4 — Install and unsupported classifier.**
```
<binary> daemon install   (linux, entry path composed)
  -> <config root>/systemd/user/<binaryName>-daemon.service
       ExecStart=<entry path> daemon start --foreground
       Environment=<PREFIX>_STATE_DIR=<resolved dir>
  -> enable unit, enable linger; receipt installed=true
<binary> daemon install   (no delivered supervisor adapter, or linger failure)
  -> daemon.supervisor-unsupported, exit 2, no unit left behind
```

**Flow 5 — Live status against a resident daemon.**
```
<binary> daemon status --live
  -> transport connect at the resolved socket path -> status probe
  -> reachable + heartbeat running -> live envelope, exit 0
  -> unreachable -> daemon.socket-unreachable, exit 2
  -> stale heartbeat -> daemon.heartbeat-stale, exit 2
```

**Flow 6 — Help and version.**
```
<binary> --help            -> root listing includes the daemon family
<binary> daemon --help     -> family usage, options, examples, exit codes, see-also
<binary> daemon status --help -> subcommand usage
<binary> --version         -> identity only; no state, config, or network read
```

**Flow 7 — Unresolvable state directory (no override, no home).**
```
<binary> daemon <start|stop|status|install|uninstall>   (HOME and USERPROFILE empty, no override)
  -> state-directory outcome: unresolvable
  -> daemon family stays mounted over an unavailable daemon runtime
  -> config.value.invalid, exit 1; no store, lock, socket, transport, or supervisor path opened
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `daemon` added to the prompt-required command set and composed unconditionally by the production composer.
- A production daemon composition: state store, daemon lock, resolved daemon settings, lane restart bound, resolved state directory, unit identity, entry path, environment variable name, supervisor config root, composing pid, signal host, control transport, and socket path.
- A new optional production fact carrying the running entry path from the executable entry, and forwarding of the existing process-id and signal-host facts.
- A new optional signal-host input on the daemon composition and the foreground lifetime path (`SIGTERM` drain, `SIGINT` immediate, listener cleanup in a `finally`, readiness snapshot returned at exit).
- A new optional pid input on the daemon composition and the fail-closed refusal in cross-process `stop`.
- State-directory scope resolution in the production composition, and the re-entry environment: the state-directory binding as the authority, plus the composing `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override forwarded through one optional composition input.
- The daemon composition's three-outcome state-directory resolution and the unavailable daemon runtime supplied for the unresolvable outcome (no override, no home): the family stays mounted and every subcommand returns `config.value.invalid` with no store, lock, socket, transport, or supervisor path opened.
- `QueueComposition.degraded` widened to accept a resolver, resolved at every queue and lanes projection, with the durable-state predicate supplied by production.
- The help inventory entry for the family and its subcommands; the reference page's help section; the coverage inventory entries.
- Tests for every listed acceptance criterion, and the guard updates named in §8.5.

### 7.2 Out of Scope

- [OUT] Any daemon engine change: start/stop/tick semantics, reconciliation, heartbeat cadence, control frames, lane records, or the daemon's own lock semantics.
- [OUT] A lane executor, dispatch lane composition, supervision cadence, or any production value for the daemon's lane seam. `start` keeps the delivered declared `supervise-only` mode.
- [OUT] `projects`, `events`, `attempts`, `board`, `supervise`, or any other M2 command.
- [OUT] Changing the meaning of any existing envelope field, degraded marker, or error-table row, and adding any new error identity.
- [OUT] A `--state-dir` flag, a daemon state-directory configuration key, or a second state-directory resolution.
- [OUT] Changing the store composition of any non-daemon command: their state-directory template and their behaviour under an absent home stay exactly as delivered. The three-outcome resolution and the unavailable runtime apply to the daemon composition only.
- [OUT] `daemon status` reporting install state by inspecting the supervisor; the install and uninstall receipts remain the truth for installation (DEC-14).
- [OUT] Multi-state-directory installs, a coordinator unit, a macOS or Windows supervisor adapter, or remote/container transports.
- [OUT] Moving existing state when `<PREFIX>_STATE_DIR` is set; the override changes which directory is used, and no migration is performed.
- [OUT] Automatic startup of the daemon at login independent of `daemon install` (the unit's own enable and linger stay the delivered behaviour).
- [OUT] Changing the systemd unit renderer's `Environment=` line format: the delivered renderer emits the value unquoted, and this change does not modify it (declared limitation, RSK-13, DEC-17).
- [OUT] Any prompt, agent, or lifecycle-instruction change.

### 7.3 Deferred / Maybe-Later

- An event-log wake source for the resident loop; v1 relies on the delivered clock fallback at the heartbeat interval.
- A scope digest in the unit name once a second state directory must install its own unit.
- Refusing a non-executable or vanished entry path at composition time instead of surfacing a readiness timeout at start.
- Reporting supervisor installation truth from `daemon status` through the delivered supervisor inspection seam.
- Quoting or escaping the `Environment=` value in the unit renderer so a state directory containing whitespace renders a valid unit (RSK-13).
- Recovering `PATH` or `HOME` for a caller that stripped them from its own environment; v1 fails closed instead (DEC-16, RSK-2).
- A coordinator unit under the delivered install seam once the unit renderer gains an explicit command vector.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This change adds no HTTP or REST endpoint and no network listener beyond the delivered local unix control socket.

### 8.2 Events / Messages

No new record kind, payload schema, or event is introduced. The change reads and relies on three delivered records whose meaning is unchanged:

| ID | Record / message | Contract |
|---|---|---|
| EVT-1 | `daemon.instance` (unchanged) | The daemon's own claim about itself. The composition makes its `pid` the composing process id instead of `0`, and its `operation` (`acquired`, `taken-over`, `released`, `immediate-stop`) is the first half of the reachability predicate. No field, vocabulary, or schema changes. |
| EVT-2 | `daemon.heartbeat` (unchanged) | `instanceId` plus `beatAt` are the second half of the reachability predicate; the age bound is the configured lock staleness applied strictly (an age equal to the bound is stale), the same value and the same comparison the status fold uses. No cadence or field change. |
| EVT-3 | `daemon.lane` (unchanged) | A drain appends `detached` for every delivering lane, as delivered; this change reads that evidence and adds no state. |

No capsule event, command receipt, outbox effect, or telemetry record is added or redefined.

### 8.3 Data Model Impact

| ID | Element | Description |
|---|---|---|
| DM-1 | `DaemonComposition` additive inputs | `pid?: number` (forwarded to the runtime so the instance record carries the composing process), `signalHost?` (`once(SIGINT\|SIGTERM, listener)` and `removeListener` for the foreground lifetime), and one optional re-entry environment input carrying the additional variables the detached child receives (`PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override), merged beneath the state-directory binding the composition already supplies and with that binding written last. All optional; every existing field keeps its name, type, and meaning, and omitting the environment input keeps the delivered single-variable spawn. |
| DM-2 | Foreground lifetime contract | When a signal host is composed and `foreground` is true: start, capture the readiness snapshot, install listeners, run the resident loop, stop with the mode the first signal selects (`SIGTERM` → `drain`, `SIGINT` → `immediate`), remove listeners in a `finally`, await the loop, return the captured snapshot or the stop failure. When no signal host is composed, return at readiness as delivered. |
| DM-3 | `QueueComposition.degraded` union | `readonly QueueDegradationReason[] \| (() => readonly QueueDegradationReason[])`. The array member keeps the delivered semantics and the absent case keeps the delivered fallback. Resolution happens per projection: schedule, mutation outcome, lanes read, and every watch iteration. |
| DM-4 | Reachability predicate | Pure function of the latest instance record (presence, identity, operation), the latest heartbeat's `instanceId` and `beatAt`, the injected now, and the configured lock staleness. Reachable **iff** an instance record exists and its operation is `acquired` or `taken-over`, the latest heartbeat's `instanceId` equals that instance's identity, and `now − beatAt < lockStalenessMs` (strictly less; an age equal to the bound is stale); otherwise `["daemon-unreachable"]`. |
| DM-5 | `ProductionCompositionFacts` additive facts | `daemonEntry?: string` (the running entry path supplied by the executable entry), `supervisor?: SupervisorPort` (a pass-through seam so install is provable without a live systemd), and the existing `processId`/`signalHost` facts forwarded to the daemon composition. The re-entry environment input named in DM-1 is derived inside the production composer from facts it already holds — the injected environment record (`PATH`, `HOME`/`USERPROFILE`, and the working-name override variable) plus `homeDirectory` — so no new ambient read is introduced (NFR-2). **The daemon composition's state-directory resolver outcome is part of this contract.** The composer classifies the delivered scope resolution into exactly three outcomes — absolute override wins; otherwise the home-based value applies only when a home exists; otherwise unresolvable — and composes one of two runtimes: the full daemon runtime over the resolved directory, or, for the unresolvable outcome only, an **unavailable daemon runtime** that composes no store, lock, settings, transport, socket path, supervisor scope, entry path, or pid and whose every subcommand returns the delivered `config.value.invalid` identity at exit `1`. A non-absolute override is not unresolvable: the delivered edge reports `config.value.invalid` for it, and the composer keeps the home-based value when a home exists (DEC-5, DEC-18). **The settings-resolution outcome is part of the same contract.** A configuration that is acquired but whose `daemon` branch does not resolve yields no resolvable daemon settings, so the composer supplies the same unavailable daemon runtime — every daemon subcommand returns the delivered `config.value.invalid` identity at exit `1`, with no daemon lock, transport, socket path, entry path, or supervisor scope composed — rather than substituting the shipped defaults for a user's invalid branch. The queue and lanes read side is the deliberate opposite in that one cell: it derives its marker from durable instance and heartbeat records, consumes daemon configuration only for the staleness bound, and therefore reports `daemon-unreachable` instead of refusing a read, because a synchronous projection has nothing to fail closed against and no trustworthy bound to apply. The divergence is confined to the invalid-configuration cell and is declared (DEC-19). |
| DM-6 | Install identity values | `binary` = the absolute entry path; `unit` = `${brand.binaryName}-daemon.service`; `supervisorConfigDirectory` = `XDG_CONFIG_HOME` when absolute and non-empty, otherwise `${homeDirectory}/.config` **only when a home exists**, otherwise the user configuration root is **unresolvable** and `daemon install` refuses with the delivered `config.value.invalid` identity at exit `1` while writing no unit and no ownership marker (AC-F7-2), a refusal that precedes the missing-entry-path guard because the root is classified when the runtime is composed; `environmentName` = the exact `<PREFIX>_STATE_DIR` variable read by the state-directory resolution; `scope` = the delivered digest of the resolved state directory. The unit's environment binding stays the single state-directory variable: the re-entry environment of DM-1 is a process-spawn concern and adds no `Environment=` line, because systemd supplies its own `PATH` and `HOME`. |
| DM-7 | No state-schema change | `STATE_SCHEMA_VERSION` is unchanged, no record kind, payload schema, migration, or backfill is added, and no `daemon` configuration key is added. |

**Declared divergence from the delivered status fold (DM-4).** The delivered fold (`operation released|immediate-stop ⇒ stopped`; no heartbeat ⇒ `stale`; otherwise `ageMs >= stalenessMs ? stale : running`) reports `running` for a heartbeat whose owner is missing or different, because it folds liveness only. DM-4 additionally requires an owner. The two rules agree on every cell where the latest instance record is the heartbeat's owner or no heartbeat exists, and they diverge on exactly the unowned-heartbeat family — a heartbeat with no instance record, or one naming another instance. Queue and lanes require an owner because their degradation marker gates lane mutation and drain: an unowned heartbeat can be signalled by nobody, drained by nobody, and reconciled by nobody, so calling it a running daemon would be a claim about a process that the record set cannot identify. The divergence is declared, not accidental, and AC-F5-6 (agreement) and AC-F5-8 (the divergent family) partition the cells so neither criterion is unsatisfiable.

### 8.4 External Integrations

- **POSIX process lifecycle.** A detached spawn of the running entry path with a replaced environment built from the composing process: the state-directory binding (last, authoritative), `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override. `SIGTERM` for drain and `SIGINT` for immediate stop, delivered through the process port. No signal is ever sent to a non-positive pid, and no name- or pattern-based signalling exists.
- **systemd user manager (Linux).** Unit file under `<config root>/systemd/user/`, ownership marker beside it, unit enable, and linger enable with rollback on linger failure. macOS and Windows return the classified unsupported outcome and write no unit. **Declared limitation:** the delivered renderer emits the value unquoted (`Environment=<NAME>=<path>`), so a state directory containing whitespace would render a mis-parsed unit. This change does not modify the renderer; the limitation is recorded as RSK-13 and deferred in §7.3.
- **User configuration root.** `XDG_CONFIG_HOME` when it is absolute and non-empty, otherwise `<home>/.config` when a home exists — the root systemd reads for user units and the root the CLI already uses for user configuration. With neither, the root is unresolvable and `daemon install` refuses as `config.value.invalid` at exit `1`, writing no unit (DM-6, AC-F7-2).
- **No other integration.** No tracker, provider, network, or credential surface is touched; the change adds no external call.

### 8.5 Backward Compatibility

- **Additive composition only.** `DaemonComposition` gains three optional fields; `ProductionCompositionFacts` gains two optional facts; `QueueComposition.degraded` widens to a union whose array member is unchanged. No exported signature narrows, no required field appears, and no existing caller changes.
- **Unchanged command surface.** The `daemon` command definition, its flag set (`--foreground`, `--live`, `--mode`), its grammar, and its envelope shapes are unchanged; the change makes them reachable, not different.
- **Unchanged identities and schema.** No error-table row is added, removed, or reworded; `daemon.supervisor-unsupported`, `daemon.state-recovery-failed`, `daemon.socket-unreachable`, `daemon.heartbeat-stale`, `daemon.already-running`, and `daemon.takeover-refused` are the delivered rows this change reaches, together with the delivered `config.value.invalid` for the unresolvable state-directory outcome. `STATE_SCHEMA_VERSION` and the closed degraded-marker sets are unchanged.
- **Delivered behaviours that must not regress.** A composition that supplies an array-valued `degraded` keeps its exact output; a composition that omits `degraded` keeps the `["daemon-unreachable"]` fallback; a daemon composition without a pid, signal host, entry path, re-entry environment, transport, or supervisor keeps its delivered behaviour, including the delivered single-variable spawn; a foreground start without a signal host still returns at readiness. The delivered suites that must keep passing without semantic change include the daemon lifecycle, daemon degradation, daemon lock, daemon lock concurrency, daemon supervisor install, queue CLI, control transport, entrypoint help, entrypoint help coverage, reference-page parity, queue-scheduling contract, daemon vocabulary, and doc-conformance suites.
- **Guards that must be updated as part of the mount.** The entrypoint composition test's expected-family list and its absence assertions (the fixture derives its program from the prompt-required set, so only the hard-coded list and the `daemon` absence names change); `tests/behaviour/entrypoint-help.test.ts`'s root family list; `tests/behaviour/entrypoint-help-coverage.test.ts`, which hard-codes the 16-command enumeration and asserts equality with the coverage inventory's `commands`; the help coverage fixture (both `commands` and `referencePages`); and the doc-conformance page list, which gains `daemon` so the "every prompt-required reference page documents `--help`" assertion covers the newly mounted family. The permitted-edit set is **derived, not enumerated**: every delivered suite that contains the prompt-required 16-command enumeration (or the root family list derived from it) is in the set, because the mount changes that enumeration itself. The set is found by searching the suites for those literals and comparing the hits with the coverage inventory, not by listing the guard files a reviewer already remembers.
- **One behaviour intentionally changes for existing users.** A process that sets `<PREFIX>_STATE_DIR` previously saw the CLI composition ignore the override for its own store while the edge honoured it; the override now drives the whole production composition. Existing state at the home default is not moved (DEC-5, §19).
- **The daemon family's absent-home behaviour changes; every other family keeps its own.** The delivered production template concatenated an empty home into `/<stateDirectoryName>`, so a caller with no home and no override addressed a root-level store root. The daemon composition now classifies that input as unresolvable and composes the unavailable daemon runtime (DM-5, DEC-18), so the failure is a classified `config.value.invalid` at exit `1` instead of a root-level write. Non-daemon commands keep the delivered template unchanged, which is why this is a daemon-family behaviour and not a general store change (§7.2).
- **The detached child agrees with the parent on identity, and the remaining limitation is the caller's environment.** The re-entry environment carries `PATH`, `HOME`/`USERPROFILE`, the working-name override when set, and the state-directory binding as the authority, so a renamed product's child resolves the same brand prefix and the same home default as its parent, and a missing home cannot silently resolve to a root-level directory while the caller holds one. Forwarding is not repair: a caller that strips `PATH` from its own environment cannot be given it back by the spawn, and the child then fails closed at spawn or readiness with the classified `daemon.state-recovery-failed` (RSK-2, DEC-16); a caller that strips its home removes the default's only source, which the daemon composition now classifies as unresolvable and answers with `config.value.invalid` at exit `1` (DM-5, DEC-18). This is a declared limitation, not a silent assumption.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Help and version purity | 0 state, configuration, git, network, or filesystem reads and 0 writes on `--help` and `--version`; 0 command-composer invocations |
| NFR-2 | Composition determinism | 100% identical composed program and help inventory for identical brand and facts; no ambient environment read outside the injected facts |
| NFR-3 | Degradation read cost | At most 2 **additional** daemon-fact reads (instance, heartbeat) per queue or lanes projection, beyond the store reads that projection already performs (the lanes read already reads queue facts and lane records); 0 socket connects, 0 process probes, and 0 sleeps on that path; queue and lanes read p95 latency regression ≤ 10% against the reference store |
| NFR-4 | Start readiness | A bare `start` reports a start receipt or fails closed within the delivered readiness window (20 polls × 50 ms); 0 exit-`0` results without a durable `acquired` instance |
| NFR-5 | Foreground stop latency | After the signal, the resident process stops, appends its release, and exits within 1 000 ms, of which loop cancellation is ≤ 250 ms |
| NFR-6 | Command latency | `daemon status` p95 ≤ 1 000 ms; `daemon status --live` p95 ≤ 2 000 ms (the delivered response timeout); `daemon install`/`uninstall` p95 ≤ 2 000 ms excluding the supervisor command runner |
| NFR-7 | Exit taxonomy | Every outcome exits only `0`, `1`, or `2`, and every non-zero outcome resolves to a delivered error-table identity |
| NFR-8 | Signal safety | 0 signals to a pid that is not a positive integer; 0 signals to a process group; 0 name- or pattern-based kills |
| NFR-9 | Idempotence | A repeated `install` is idempotent; `stop` against a released or absent instance is a `noop` at exit `0`; a repeated start while an instance is live is `daemon.already-running` and appends nothing |
| NFR-10 | Privacy and secret safety | 0 credentials, tokens, prompts, transcripts, diffs, or repository contents in any new output; the only environment value this change introduces into a contract is an absolute directory path — the re-entry environment forwards the composing process's own `PATH`, `HOME`/`USERPROFILE`, and working-name override unchanged and adds no other value |
| NFR-11 | Bounded output | Existing envelope and human-output bounds are unchanged; the root listing and each help page stay within the delivered help bounds |
| NFR-12 | No new external dependency | 0 new package dependencies, 0 new listeners, 0 network egress added by the mount |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **Durable evidence is the telemetry.** The lifecycle is observable from `daemon.instance` (acquisition, takeover, release, immediate stop, with pid and scope), `daemon.heartbeat` (beats and age), and `daemon.lane` (detach on drain). No metric, trace, or event store is added.
- **One operational query.** `daemon status` answers "is a daemon running, which pid, which instance, how old is its heartbeat, which socket, is it reachable, and which supervisor identity is configured?"; a plain `status` already probes the composed transport and reports the socket's reachability, and `daemon status --live` is the same read with a fail-closed verdict (unreachable socket ⇒ `daemon.socket-unreachable`; heartbeat not `running` ⇒ `daemon.heartbeat-stale`). The plain report is a degraded success at exit `0` for every not-running shape — absent, released, stale, and unreachable — so `--live` is the only failing surface.
- **Derived, not asserted, degradation.** `queue` and `lanes` payloads carry the marker resolved at that projection, so a consumer can distinguish "no daemon" from "a daemon is running". Those two projections stay socket-free: the resolver reads durable instance and heartbeat facts only, with 0 connects, 0 process probes, and 0 sleeps (NFR-3). No new log line, alert, or dashboard is added.
- **Install receipts.** `daemon install` and `daemon uninstall` return the descriptor (kind, installed, linger, unit, scope, command form, service type, restart policy, environment binding), which is the truth for installation state.
- **No sensitive content.** Every reported value is an identity, a path, a count, a duration, or a closed vocabulary value.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | A `stop` signals the caller's own process group because the recorded pid is `0` | H | M | The composing pid is recorded, and `stop` refuses any durable pid that is not a positive integer with the delivered recovery identity before any signal call. | L |
| RSK-2 | The running entry path is not executable, or its interpreter is unresolvable, in the spawned environment (wrapper, shim, ephemeral path, or a stripped `PATH`) | H | M | The entry path is the only value guaranteed to be the running product; the re-entry environment forwards the composing `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override, so a `#!/usr/bin/env bun` entry resolves the same interpreter the parent did; a spawn or readiness failure — including a caller that stripped `PATH` or `HOME` — is a classified `daemon.state-recovery-failed`, never a PATH guess and never a silent root-level state path. Declared revisit trigger. | M |
| RSK-3 | A slow first start (reconciliation over a large store) exceeds the readiness window and reports a timeout while the daemon is live | M | M | The failure is classified and appends nothing; `daemon status` and the durable instance remain the truth. The window is unchanged in this change. | M |
| RSK-4 | Durable reachability disagrees with the live socket probe for up to the staleness window after a crash | M | M | Both surfaces share one bound (the configured lock staleness) applied with the same comparison, so they cannot disagree about staleness; ownership is the only declared divergence (DM-4, AC-F5-8), and the direction of the window is bounded and disclosed. | M |
| RSK-5 | The mount throws at composition because a prompt-required command is missing | H | L | The runtime is composed unconditionally and proven by the entrypoint composition suite; an absent optional input degrades one shape, never the command. | L |
| RSK-6 | A caller that strips `PATH` or `HOME`/`USERPROFILE` from its own environment cannot re-enter: the spawn rebuilds the child environment from what the parent holds, so the missing value stays missing | M | L | Declared limitation rather than a repair. A stripped `PATH` fails closed at spawn or readiness with the classified `daemon.state-recovery-failed` (exit `2`); a caller with no home and no override makes the state directory unresolvable, so the family stays mounted over an unavailable daemon runtime returning `config.value.invalid` (exit `1`) and opening no store, lock, socket, transport, or supervisor path — never a root-level directory and never a success claim (DM-5, DEC-18). The shipped default caller supplies both values; recovering them from another source is a recorded follow-up (§7.3). | L |
| RSK-7 | The override-aware state directory relocates a user's CLI state unexpectedly | M | L | Disclosed in rollout and operations: no automatic move, the override is the documented selection, and the previous home default stays readable on disk. | L |
| RSK-8 | `install` writes into the user configuration root with insufficient care | M | L | The adapter writes only its own unit and ownership marker, rolls back on linger failure, and `uninstall` removes only what this installation created; unsupported platforms write nothing. | L |
| RSK-9 | A foreground start shows no receipt until it stops, so an operator believes it failed | L | H | Declared: the receipt renders at exit like the delivered coordinator foreground loop; `daemon status` is the live read side, and the unit's own state plus `systemctl status` cover the unit case. | L |
| RSK-10 | The degradation widening regresses a delivered queue or lanes payload | M | L | The array member and the absent fallback are unchanged; the delivered queue, lanes, and watch suites keep their exact expectations, and four fixtures prove both directions. | L |
| RSK-11 | A stale socket file from a crashed daemon wedges a restart | M | L | The transport is composed with the ownership predicate the engine only consults after acquiring the lock in the same process, so a leftover socket is replaced by the next start. | L |
| RSK-12 | Two state directories overwrite each other's unit | M | L | Declared out of scope: one legible unit name per user; a scope digest in the name is a recorded follow-up. | L |
| RSK-13 | A state directory containing whitespace renders a mis-parsed unit, because the delivered renderer emits `Environment=<NAME>=<path>` unquoted | M | L | Declared limitation: this change does not modify the unit renderer, a default state directory under a home or XDG root contains no whitespace, and `daemon install` is optional. Quoting or escaping the value is a recorded follow-up (§7.3); a mis-parsed unit fails visibly at `systemctl --user` start rather than silently draining the wrong directory. | L |

## 12. ASSUMPTIONS

- The delivered daemon engine, control protocol, supervisor adapter, status projection, process port, and state records are stable current contracts; this change consumes them without editing their semantics.
- `process.argv[1]` is an absolute path to the running entry script or compiled binary and is executable; the delivered bin carries a shebang and executable mode.
- `brand.binaryName` is a sanitized product name, not a path; systemd resolves a bare `ExecStart` against its own search path, which is why the unit uses the absolute entry path.
- The composing process's environment normally carries `PATH` and a home directory (`HOME`, or `USERPROFILE` when `HOME` is empty); the spawn forwards them unchanged, so the re-entered child resolves the same interpreter, brand, and home default as its parent. A caller that strips `PATH` cannot be repaired by the spawn (RSK-6, DEC-16).
- The home-based default is meaningful only when a home exists. With no override and no home the daemon composition's state directory is unresolvable, so the composition supplies an unavailable daemon runtime instead of a root-level directory; that outcome is a fail-closed branch for an abnormal environment, not a supported configuration (DM-5, DEC-18).
- The composed working-name override, when set and non-empty, is forwarded into the re-entry environment, so the composing process, the detached child, and the unit process resolve the same brand prefix and therefore one environment-variable name and one state directory.
- The lock-staleness bound is the correct freshness threshold for "reachable", the same bound the status projection uses, and freshness is strictly below the bound (an age equal to it is stale) on both surfaces.
- The daemon writes its instance and heartbeat records on the same store the queue and lanes read, so a durable predicate is a sufficient observation.
- The delivered transport opens the control plane only after acquiring the instance lock in the same process, so an ownership predicate that reports held is safe.
- A Linux host has a user systemd manager; install is provable in tests through the injected supervisor seam without invoking `systemctl`.
- No `daemon` configuration key and no `--state-dir` flag is required: the environment override and the home default cover the documented selection.
- The delivered `supervise-only` mode is the correct production mode in v1 because no lane executor is composed, and lane execution is out of scope.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | Resident dispatch daemon (M1-S18, GH-238) | The command family, `createDaemonCommandRuntime`, the runtime start/stop/loop, the process port, the unix transport, the supervisor adapter and installer, the status projection, and the instance/heartbeat/lane records. Consumed unchanged. |
| Depends on | Prompt-required composition and self-description (GH-242) | `PROMPT_REQUIRED_COMMANDS`, the strict program selection that throws on a missing prompt-required command, the help inventory, the help coverage check, and the reference-page parity check. |
| Depends on | Production composition and state-directory scope | The production composer, the injected environment, home, and process facts, `resolveStateDirectoryScope`, and `resolveDaemonSettings`. |
| Depends on | Coordinator supervision precedent (M1-S23, GH-241) | The injected signal host and foreground loop shape this change reuses; no coordinator behaviour changes. |
| Depends on | M2 planning (GH-284) | Names the daemon mount as the prerequisite for the resident-daemon stories and records the finding this ticket closes. |
| Blocks | M2-S13 public event taxonomy | The subscribe surface presumes a resident daemon. |
| Blocks | M2-S17 provider-aware peak pausing | Peak parking and resume presume a resident daemon. |
| Interfaces with | Delivered error table and envelope conventions | Every reached identity is an existing row; no row changes. |
| External | POSIX signals and detached process spawning | `SIGTERM`/`SIGINT` to a recorded positive pid only. |
| External | systemd user manager and the XDG configuration root | Optional user-level unit installation; classified unsupported elsewhere. |

## 14. OPEN QUESTIONS

None. The four composition choices the clarify-scope phase routed to specification are recorded as DEC-1 through DEC-9 with tested outcomes; the composition values the decision record leaves open (the lane restart bound, the install test seam, the help inventory shape, the conformance page list, the delivered status install truth, the production start mode, the re-entry environment set and its residual, and the unit renderer's unquoted environment line) are resolved as DEC-10 through DEC-17, the daemon composition's three-outcome state-directory resolution with its unavailable-runtime outcome is DEC-18, and the acquired-but-invalid `daemon` configuration branch with its one-cell divergence from the queue and lanes read side is DEC-19. No product-scope ambiguity remains, and no decision is deferred to `@decision-advisor`.

| ID | Question | Context | Status |
|---|---|---|---|
| — | None | All choices inside the ticket and its cited decision record are resolved as DEC-1 through DEC-19 | Resolved |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 **(TDR-0022)** | Mount the delivered family by composing the runtime in the production entrypoint and adding `daemon` to the prompt-required set, with a help entry and reference-page coverage; do not add a second entry seam in the executable entry. | A second seam would bypass the prompt-required selection, the envelope, the error projection, the help surface, and the flag parser for one command, permanently. | 2026-11-11 |
| DEC-2 **(TDR-0022 DC-1, amended 2026-11-11)** | Production supplies the running entry path as an optional fact named `daemonEntry`, sourced from the executable entry's `process.argv[1]`, and forwards it as the daemon composition's entry path. The decision record's provisional name for the same fact, `entryScriptPath`, is retired by the record's 2026-11-11 amendment, so the record and this specification now pin the one name that the fact and the composition input it feeds both carry. | One fact serves re-entry and the unit's executable, so the child and the unit can never disagree about which executable this product is; naming it once removes a translation layer that no behaviour needs. | 2026-11-11 |
| DEC-3 **(TDR-0022 DC-1)** | A foreground start owns the process lifetime through the injected signal host: `SIGTERM` drains, `SIGINT` stops immediately, listeners are removed in a `finally`, and the readiness snapshot captured at start is returned at exit. | A foreground daemon that returns at readiness is not resident, and one that dies on a signal leaves a held lock and undetached lanes. The injected host keeps the path deterministic in tests. | 2026-11-11 |
| DEC-4 **(TDR-0022 DC-1e)** | Supply no wake source in v1; residency comes from the explicit loop, which falls back to the injected clock at the heartbeat interval. | The delivered fallback already bounds latency acceptably, and an event-log tail would force production to re-derive a private ledger path for an optimization no acceptance criterion needs. | 2026-11-11 |
| DEC-5 **(TDR-0022 DC-1c, amended 2026-11-11)** | The production composition resolves its state directory through the delivered scope resolution (override first, home default otherwise) and uses that value for the store, lock, settings, socket, supervisor scope, and re-entry binding; the mount is never suppressed. The home-based fallback applies only when a home exists: a non-absolute override keeps the previous home-based value, and the no-override-no-home outcome is the unresolvable case recorded in DEC-18, which composes the unavailable daemon runtime instead of a root-level directory. | The state-directory variable is the outright authority the child's resolution reads and the variable the unit binds; two resolutions would put the ledger, lock, and socket in different places, and the forwarded `PATH`/`HOME` facts cannot override it. A failure must not remove a prompt-required command. Scoping the fallback to an existing home is what makes the fail-closed half of the deliverable satisfiable: an empty home must produce a classified refusal, not `/<stateDirectoryName>` (amended 2026-11-11, DoR RF2-4). | 2026-11-11 |
| DEC-6 **(TDR-0022 DC-1d)** | Compose daemon settings through the delivered resolver over the resolved state directory, falling back to the same resolver over an empty branch, and compose the delivered unix transport at the resolved socket path with an ownership predicate that reports the lock held by this process. | Defaults stay one definition instead of literals, and the engine opens the control plane only after acquiring the lock in the same process, so stale-socket replacement is safe and a crash does not wedge restarts. | 2026-11-11 |
| DEC-7 **(TDR-0022 DC-2)** | `QueueComposition.degraded` accepts an array or a resolver and is resolved at every queue and lanes projection; production derives it from durable instance and heartbeat records — an instance record whose latest operation is `acquired` or `taken-over`, a latest heartbeat whose `instanceId` matches that instance, and an age strictly below the lock-staleness bound — and an unreadable read degrades rather than throws. | A hardcoded marker is the defect; a socket probe would make synchronous reads async, add a response timeout to every queue read, and give the same answer durable state already holds. Sharing the staleness bound keeps `queue list` and `daemon status` in agreement; requiring an owner is what makes the marker usable, because a heartbeat nobody owns cannot be drained, signalled, or reconciled (DM-4, AC-F5-8). | 2026-11-11 |
| DEC-8 **(TDR-0022 DC-3)** | Add an optional composing pid to the daemon composition and forward it; refuse a durable record whose pid is not a positive integer in cross-process `stop` with the delivered recovery identity and no signal. | The engine's `0` fallback addresses the caller's own process group; recording the real pid is the fix and failing closed is the guard that covers torn and legacy records. | 2026-11-11 |
| DEC-9 **(TDR-0022 DC-4)** | Install identity is the absolute entry path as the executable, `${brand.binaryName}-daemon.service` as the unit, the user configuration root as the unit directory, the exact state-directory variable as the environment binding, and the delivered digest of the resolved directory as the scope. | One legible name per user, a unit systemd reads, and an `ExecStart` that exists; a bare binary name would not resolve for a user-local install. | 2026-11-11 |
| DEC-10 | The daemon composition's restart bound is the resolved `lane.restart-budget` value, using the shipped default when configuration cannot be acquired. | The bound applies to the daemon's lane reconciliation, so it is the delivered per-delivery restart policy; inventing a second bound would let reconciliation and lanes disagree. | 2026-11-11 |
| DEC-11 | `ProductionCompositionFacts` gains an optional supervisor adapter pass-through so a test can prove the install request without a live systemd. Production omits it and the delivered real adapter composes. | The install contract is otherwise unprovable in CI without environment-dependent `systemctl` calls; the existing facts already carry comparable test seams. | 2026-11-11 |
| DEC-12 | The help inventory gains a `daemon` family entry plus one entry per subcommand, and the reference page gains a help section naming `--help` and `--version`. | The delivered convention is mixed (`queue` and `verify` document subcommands; `coordinator` documents the family only), and an operator typing `daemon status --help` should receive help rather than an unknown-flag refusal. | 2026-11-11 |
| DEC-13 | The doc-conformance prompt-required page list gains `daemon`; the two pre-existing omissions from that hand list (`dispatch`, `coordinator`) stay as they are. | The mounted family must be covered by the assertion it claims to satisfy; rewriting unrelated omissions would expand the change beyond its ticket. | 2026-11-11 |
| DEC-14 | `daemon status` keeps reporting `installed: false` in its supervisor descriptor because the delivered status composition performs no supervisor inspection; the install and uninstall receipts remain the truth for installation. | Changing status would add a filesystem probe to a read path the ticket does not ask to change; the residual is declared instead of silently contradicted. | 2026-11-11 |
| DEC-15 | Production composes no lane executor, so a production start reports the delivered `supervise-only` mode with `lane-executor-unavailable` degraded, while queue and lanes degradation covers daemon reachability only. | The ticket mounts the lifecycle and says nothing about lane execution; claiming `resident` mode without an executor would be a lie, and conflating the two markers would make `daemon-unreachable` mean two things. | 2026-11-11 |
| DEC-16 **(TDR-0022 DC-1, amended 2026-11-11)** | The detached child's environment is rebuilt from the composing process and carries `<PREFIX>_STATE_DIR` (authoritative, written last), the composing `PATH`, its `HOME` (or `USERPROFILE` when `HOME` is empty), and the working-name override only when set and non-empty — all through one optional additive composition input. A caller that strips `PATH` cannot be repaired by the spawn and fails closed as `daemon.state-recovery-failed`; a caller that strips `HOME`/`USERPROFILE` makes its own state-directory resolution unresolvable and receives `config.value.invalid` instead (DEC-18). | A replaced environment with no `PATH` cannot resolve the `#!/usr/bin/env bun` interpreter of the shipped entry, so the "one variable" pin made the ticket's primary acceptance unachievable; forwarding the minimum makes it executable and also removes the renamed-product limitation, because the override now reaches the child. The residual is the caller's own environment, which no spawn can repair. | 2026-11-11 |
| DEC-17 | The delivered unit renderer's unquoted `Environment=<NAME>=<path>` line is accepted as a declared limitation: this change does not modify the renderer, and quoting or escaping the value is deferred (§7.3, RSK-13). | Escaping the value is a renderer change with its own test surface, outside this ticket's additive inputs; the default state directory under a home or XDG root contains no whitespace, and a mis-parsed unit fails visibly at start rather than silently targeting another directory. | 2026-11-11 |
| DEC-18 | The daemon composition's state directory resolves to exactly three outcomes: (1) an absolute `<PREFIX>_STATE_DIR` override wins; (2) otherwise the home-based `<home>/<brand.stateDirectoryName>` applies **only when a home exists**; (3) otherwise — no override and no home — the directory is **unresolvable**. On the unresolvable outcome the `daemon` family stays mounted and the production composer supplies an **unavailable daemon runtime**: every subcommand returns the delivered `config.value.invalid` identity at exit `1` (`user-validation`) and the daemon composition opens no store, lock, socket, transport, or supervisor path. Non-daemon commands keep the delivered home-based template. | The delivered template concatenates an empty home into `/<stateDirectoryName>`, a root-level store root no supported install should ever touch; the delivered `resolveStateDirectoryScope` already classifies that input as `config.value.invalid`. The family cannot be dropped instead, because the strict prompt-required selection would turn every invocation into the `fallback.internal` containment, so the safe shape is a mounted family over a runtime that fails closed before any filesystem access. The exit digit is projected from the delivered row's `user-validation` class, never authored (Appendix D, AC-F8-1), which is why this path is `1` and not the `2` of the recovery-class failures. | 2026-11-11 |
| DEC-19 | A configuration that is acquired but whose `daemon` branch does not resolve composes the same **unavailable daemon runtime** as the unresolvable state-directory outcome: every daemon subcommand returns the delivered `config.value.invalid` identity at exit `1` (`user-validation`), no daemon lock, transport, socket path, entry path, or supervisor scope is composed, and no shipped default is substituted for the user's invalid branch. In that same cell `queue` and `lanes` keep deriving their marker from durable daemon state and report `daemon-unreachable`, because those projections read durable daemon records — consuming daemon configuration only for the staleness bound — and never refuse a read. The divergence between the two surfaces is confined to the invalid-configuration cell, is intentional, and is named here. | Fail closed on the family that owns the invalid configuration; degrade on the projections that do not read it. Silently substituting the shipped defaults would start a daemon on values the user explicitly set and got wrong, the opposite of the fail-closed rule DEC-18 applies to an unresolvable state directory. Refusing a queue or lanes read instead would turn a configuration error into an unavailable ledger for every agent, and those reads have no daemon setting to validate beyond the staleness bound: with that bound untrustworthy, `daemon-unreachable` is the only claim the record set supports. Naming the divergence keeps a later reader from "fixing" one surface into agreement with the other. | 2026-11-11 |

**Precedent-setting decisions:** `TDR-0022` captures DEC-1 through DEC-9 (mount path, entry-path re-entry, signal-owned lifetime, no wake source, one state-directory scope, composed control plane, durable degradation, real pid with fail-closed stop, brand-derived install identity). It is `Proposed`, pending owner acceptance at the pull-request review. DEC-10 through DEC-18 are composition and documentation policy inside the ticket, and DEC-19 declares the invalid-configuration branch and its one-cell divergence from the read side; this specification edits no TDR. DEC-16 adopts the 2026-11-11 amendment of TDR-0022 DC-1 rather than departing from it, and DEC-18 resolves the state-directory outcome matrix that this ticket's fail-closed requirement forces without altering DC-1c's one-resolution rule.

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| CLI production composition | Supplies the daemon composition unconditionally: store, lock, resolved settings, restart bound, resolved state directory, unit identity, entry path, environment variable name, supervisor config root, composing pid, signal host, control transport, socket path, and the re-entry environment derived from its own injected environment and home facts. Classifies the state-directory resolution into its three outcomes and supplies the unavailable daemon runtime when the outcome is unresolvable (DM-5, DEC-18). |
| CLI executable entry | Supplies the running entry path fact beside the existing process id and signal host. |
| CLI daemon composition | Forwards the composing pid; rebuilds the detached child's environment from the re-entry input with the state-directory binding last; adds the signal-owned foreground lifetime path; refuses a non-positive recorded pid in cross-stop. Command definition and envelope shapes unchanged. |
| CLI queue and lanes composition | Widens `degraded` to a resolver, resolves it per projection, and keeps the array member and absent fallback behaviour. |
| CLI prompt-required set | Adds `daemon`; the production composer must therefore supply the runtime unconditionally. |
| CLI help inventory | Adds the family entry and one entry per subcommand. |
| Help coverage fixture | Adds `daemon` to `commands` and the daemon reference page to `referencePages`. |
| Daemon engine, control protocol, supervisor adapter, state records | Consumer only; no engine, protocol, adapter, error-table, or schema change. |
| Tests | New lifecycle, mount, degradation, identity, install, and lifetime suites; the guard updates named in §8.5. |
| Documentation | Reconciled current-truth pages listed below. |

**Documentation impact.** The following pages asserted the opposite of the delivered behaviour before this change and were reconciled in the system-specification phase. Each entry names the claim being reversed. The list is the complete set the delivery reconciled; a page that needed no change is marked as such rather than omitted.

- `doc/spec/features/feature-cli-entrypoint.md` — the composition table gains the `daemon` row with its subcommands; the sentence "The resident daemon is not part of the prompt-required composition: its lifecycle family is composed only when a daemon runtime is supplied, and the production entrypoint supplies none, so `<binary> daemon ...` is refused rather than mounted" is reversed to state that the production composer supplies the daemon runtime unconditionally and the family is mounted; the summary's prompt-required enumeration gains `daemon`; `links.related_changes` gains `GH-286`, `links.related_decisions` gains `TDR-0022`, and `links.contracts` gains the production composition, executable entry, daemon composition, and help modules.
- `doc/spec/features/feature-resident-daemon.md` — the sentence "The family is composed only when a daemon runtime is supplied to the CLI composition; the production entrypoint supplies none, so `<binary> daemon ...` reaches no lifecycle handler and the invocation is refused at the entrypoint. Mounting the family is product work tracked in the M2 entrypoint delta" is reversed to state that the production composition composes the runtime unconditionally, that a bare start re-enters the entry path with the state-directory binding plus the composing `PATH`/`HOME` facts, that a foreground start owns its lifetime through the injected signal host, that the composing pid is recorded, that install identity is the brand-derived unit under the user configuration root, and that queue and lanes degradation is derived from durable state. The summary's "composed only when a daemon runtime is supplied and not mounted at the production entrypoint" phrase is replaced; `links.related_changes` gains `GH-286` and `links.related_decisions` gains `TDR-0022`.
- `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` — the "The daemon registration gap" section and its observed-invocation evidence (the `unknown flag "--help"` and `unexpected argument "status"` transcripts, and the statement that `daemon` is absent from the listing) are replaced with a closed-gap record: the listing now carries seventeen families including `daemon`, and the prerequisite sentence for S13 and S17 changes from "neither can ship a resident path before #286 lands" to naming the mount as delivered. The "Observed composition" section's family list and count are corrected.
- `doc/planning/oss-tooling/milestones/m1/commands/daemon.md` — the status block ("the lifecycle command is not mounted at the production entrypoint, and its registration is tracked in the M2 entrypoint delta note and issue #286") becomes a mounted status; the page gains a `## HELP` section documenting `<binary> daemon --help`, the per-subcommand help, root `--help`, and `--version` (the coverage check requires both literals on the page); the state-directory paragraph gains the statement that the production composition resolves the same scope; the page gains a short mount-and-lifetime paragraph (bare start re-enters the entry path; foreground owns its lifetime; `SIGTERM` drains, `SIGINT` stops immediately).
- `doc/planning/oss-tooling/milestones/m1/commands/entrypoint.md` — the composed command list gains `daemon`, and the sentence "`state`, `mcp`, and the resident daemon are not registered" becomes "`state` and `mcp` are not registered" with the daemon named among the composed families.
- `doc/spec/features/feature-agents-and-commands.md` — the lifecycle-invariant "Allowed command set" enumerated the prompt-required composition in full and closed with "the resident daemon is not claimed by the prompts"; the enumeration now includes `daemon`, and `links.related_changes` gains `GH-286`.
- `doc/spec/features/feature-config-layer.md` — the state-directory section stated the default `<home>/<brand.stateDirectoryName>` unconditionally; it now states that the default applies only when a home exists and that no override plus no home fails as `config.value.invalid`, and `links.related_changes` gains `GH-286`.
- `doc/spec/features/feature-dispatch-engine.md` — two paragraphs deferred the production daemon entry to "the resident-daemon change"; each now states that the production composition mounts the daemon family without a lane composition, so supplying the lane seam remains resident-daemon production scope (GH-238), and `links.related_changes` gains `GH-286`.
- `doc/spec/features/feature-harness-adapters.md` — the lane-executor paragraph deferred "the production daemon entry that supplies the lane composition" to resident-daemon scope; it now states that the production composition mounts the daemon family without a lane composition, so supplying that seam remains resident-daemon production scope (GH-238), and `links.related_changes` gains `GH-286`.
- `doc/overview/architecture-overview.md` — the topology paragraph stated "the production entrypoint supplies no daemon runtime, so the shipped CLI starts no resident service. Scheduling is one-shot, and no background scheduler exists"; it now states that the production entrypoint composes the daemon runtime unconditionally, that the CLI can start, inspect, stop, and install a resident daemon, and that scheduling stays one-shot because production composes no lane executor and a resident daemon runs the declared `supervise-only` mode. The CLI module row gains the mounted daemon lifecycle family, the resident-daemon section states that the production composition supplies no lane composition, and `links` gains `GH-286` and `TDR-0022`.
- `doc/overview/glossary.md` — the "Prompt-required command set" term listed sixteen commands and closed with "the resident daemon ships its own control surface"; it now includes `daemon` and states that the resident daemon is mounted through its lifecycle family, and `links` gains `GH-286` and `TDR-0022`.
- `doc/quality/test-specs/test-spec-resident-daemon.md` — the test spec scoped the suite to the delivered daemon engine and excluded prompt selection and measured performance budgets; it now declares the production-mount coverage (the mount, detached re-entry, foreground-lifetime, stop-safety, derived-degradation, install-identity, privacy, and additivity suites; four mount scenarios; the capability-to-suite map), narrows the exclusion to the declared measured budgets, and `links.related_changes` gains `GH-286`.
- `doc/quality/test-specs/test-spec-dispatch-engine.md` — the daemon-lane bullet deferred "the production daemon entry that supplies the lane composition" to resident-daemon scope; it now states that the production composition mounts the daemon family without a lane composition, so supplying it remains resident-daemon production scope (GH-238), and `links.related_changes` gains `GH-286`.
- `doc/planning/oss-tooling/milestones/m2/README.md` — the index row for `entrypoint-delta.md` described "the daemon registration gap with its evidence"; it now describes the closed daemon registration gap.
- `doc/planning/oss-tooling/cli-command-registry.md` — no change required: the `daemon` row already names the family as delivered with its full grammar, and the mount changes reachability rather than the row's contract.
- `doc/planning/oss-tooling/milestones/m1/man-page.md` — no change required: the `daemon start` row already shows the full grammar, and the page is a milestone snapshot of the intended surface.
- The documentation index is updated by the system-specification phase for the reconciled pages.

## 17. ACCEPTANCE CRITERIA

### 17.1 Mount, help, and reference coverage

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** the production composition, **when** the prompt-required program is selected, **then** `daemon` is a member of `PROMPT_REQUIRED_COMMANDS`, the production composer supplies a daemon runtime unconditionally, program selection completes without the containment throw, and `<binary> daemon status` reaches the lifecycle handler instead of failing as an unknown argument. | F-1, NFR-2 |
| AC-F1-2 | **Given** the shipped help surface, **when** root `--help` is rendered, **then** the listing contains the `daemon` family with a one-line summary, and `<binary> daemon --help` exits `0` with usage, options, examples, exit codes, and a see-also pointer naming the daemon reference page. | F-1, NFR-1, NFR-11 |
| AC-F1-3 | **Given** the help and reference guards, **when** they run, **then** `help-guide-coverage` reports zero failures (the daemon reference page exists, contains `--help` and `--version`, and is listed in both `commands` and `referencePages` of the coverage inventory), reference-page parity holds (the inventory's command list equals the prompt-required set and every see-also target exists and is registered), and the doc-conformance page list includes `daemon`. | F-1, DM-6 |
| AC-F1-4 | **Given** any daemon subcommand, **when** `<binary> daemon <start\|stop\|status\|install\|uninstall> --help` runs, **then** it exits `0` with the subcommand's usage and options rather than an unknown-flag refusal. | F-1, NFR-1 |
| AC-F1-5 | **Given** a production composer with no entry path, no signal host, and no injected supervisor, **when** the program is composed, **then** the `daemon` command is still registered and selectable, so an absent optional input degrades one start or install shape and never removes the command. | F-1, F-2, F-8 |

### 17.2 Detached start and foreground lifetime

| ID | Criterion | Linked |
|---|---|---|
| AC-F2-1 | **Given** a production composition with a composed entry path and no live instance, **when** `daemon start` runs without `--foreground`, **then** it spawns the entry path with arguments `daemon start --foreground` and an environment composed of the resolved state-directory binding plus the composing process's `PATH`, its `HOME` (or `USERPROFILE` when `HOME` is empty), and the working-name override when set and non-empty, with the state-directory binding written last and authoritative; it then waits for a durable `acquired` instance and reports a start receipt whose instance pid is the spawned process's pid, whose socket path is the resolved socket, and whose heartbeat age is reported from durable state. | F-2, F-3, DM-1, DM-5, EVT-1 |
| AC-F2-2 | **Given** a spawned child that never records an `acquired` instance within the delivered readiness window (20 polls × 50 ms), **when** `daemon start` runs, **then** it returns `daemon.state-recovery-failed` with the readiness-timeout detail at exit `2`, claims no success, and appends nothing; `daemon status` still reports whatever durable state exists. | F-2, NFR-4, NFR-7 |
| AC-F2-3 | **Given** a production composition with no composed entry path, **when** `daemon start` runs without `--foreground`, **then** it starts in the invoking process and returns at readiness exactly as delivered, the command remains mounted, and no spawn is attempted. | F-2, F-8 |
| AC-F2-4 | **Given** a composed signal host and no live instance, **when** `daemon start --foreground` runs, **then** it captures the readiness snapshot, installs `SIGINT` and `SIGTERM` listeners, runs the resident loop so heartbeats advance at the configured interval, and on the first `SIGTERM` stops with mode `drain`, appends one `released` instance record with `releaseReason=drain`, removes both listeners, and returns the snapshot captured at start at exit `0`. | F-2, DM-1, DM-2, EVT-1 |
| AC-F2-5 | **Given** a foreground daemon, **when** it receives `SIGINT`, **then** it stops with mode `immediate`, appends one `immediate-stop` instance record, removes both listeners, and exits `0`; a subsequent `daemon stop` against that instance is a `noop` at exit `0`. | F-2, F-6, DM-2 |
| AC-F2-6 | **Given** a daemon composition with no composed signal host, **when** `daemon start --foreground` runs, **then** it returns the readiness receipt at readiness exactly as delivered and the command path starts no resident loop, preserving the in-process embedder shape. | F-2, F-8 |
| AC-F2-7 | **Given** a resident daemon started by a bare `start` in one process, **when** `daemon stop --mode drain` runs in a second process, **then** it reads the latest instance record, sends `SIGTERM` to the recorded positive pid, and reports `result=draining` at exit `0` without claiming that the drain already completed; once the resident process handles the signal, durable state shows one `released` instance with `releaseReason=drain` and every previously `delivering` lane recorded as `detached`. | F-2, F-6, EVT-1, EVT-3 |
| AC-F2-8 | **Given** a foreground daemon whose release append fails, **when** the signal arrives, **then** the resident loop still terminates (cancellation precedes the append), both listeners are removed in the `finally`, and the command returns the delivered state-write identity at exit `2` instead of hanging or claiming a release. | F-2, NFR-5, NFR-7 |
| AC-F2-9 | **Given** a foreground daemon and a second signal, **when** both signals arrive, **then** exactly one stop runs, exactly one terminal instance record is appended, and the listener registrations are removed so no handler outlives the invocation. | F-2, DM-2, NFR-9 |
| AC-F2-10 | **Given** a composing process whose environment carries a non-empty `PATH` and a home directory and an entry script whose first line is `#!/usr/bin/env bun`, **when** a bare `daemon start` spawns that entry, **then** the child resolves its interpreter from the forwarded `PATH` rather than from the interpreter-search fallback, reaches a durable `acquired` instance within the readiness window, and records its own composing pid; **given** instead a composing environment that carries a home directory but no `PATH`, **then** the child acquires nothing and the start fails closed exactly as AC-F2-2 states with `daemon.state-recovery-failed` at exit `2`, never claiming success; **given** a composing environment with no home directory (`HOME` and `USERPROFILE` both absent or empty) and no `<PREFIX>_STATE_DIR` override, **then** the state directory is unresolvable, no spawn is attempted, and the invocation returns the delivered `config.value.invalid` identity at exit `1` as AC-F3-5 states, so no state directory is ever derived from an empty home. | F-2, F-3, DM-1, DM-5, NFR-4 |

### 17.3 One state-directory scope

| ID | Criterion | Linked |
|---|---|---|
| AC-F3-1 | **Given** an absolute `<PREFIX>_STATE_DIR` override, **when** any production command runs, **then** the state store, the daemon lock, the daemon settings, the control socket, the supervisor scope, and the daemon composition all use that one resolved directory, and the directory the edge reports equals the directory the daemon composition uses. | F-3, DM-6 |
| AC-F3-2 | **Given** the same override, **when** a bare `daemon start` spawns its child, **then** the child receives the state-directory binding last, alongside the forwarded `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override; the child resolves the identical directory from that binding even when the forwarded environment also carries a different value of the same variable name, and its `acquired` instance record carries the same scope digest the parent expects. | F-3, DM-1, DM-5, EVT-1 |
| AC-F3-3 | **Given** no override and a home directory, **when** the composition resolves the state directory, **then** the value is byte-identical to the previous `<home>/<brand.stateDirectoryName>` template, so an existing installation continues to read its existing state. | F-3, F-8 |
| AC-F3-4 | **Given** a non-absolute `<PREFIX>_STATE_DIR` override and a home directory, **when** the production composition resolves the state directory, **then** the `daemon` command is still composed and mounted, the composition keeps the home-based value it used before this change, and no composition-time throw or containment failure occurs; the delivered edge returns no store for that override, exactly as before. **Given** no override and no home, the unresolvable outcome is AC-F3-5. | F-1, F-3, F-8 |
| AC-F3-5 | **Given** a composing environment with no `<PREFIX>_STATE_DIR` override and no home directory (`HOME` and `USERPROFILE` both absent or empty), **when** the production composition composes the program and any `daemon` subcommand runs, **then** the `daemon` family is still registered and selectable (no containment throw), the subcommand returns the delivered `config.value.invalid` identity at exit `1` (the `user-validation` projection class), and the daemon composition opens no store, no lock, no socket, no transport, and no supervisor path — no `/<brand.stateDirectoryName>` root-level directory is read, created, or probed — while a non-daemon command composed in the same program keeps the delivered home-based template. | F-1, F-3, DM-5, NFR-7 |

### 17.4 Control plane and live status

| ID | Criterion | Linked |
|---|---|---|
| AC-F4-1 | **Given** a resident daemon and the composed transport, **when** `daemon status` runs in a new process without `--live`, **then** it reads durable state **and** probes the composed socket, reports the instance (identity, pid, scope, acquisition time, mode), heartbeat age and interval, socket path **and the observed reachability of that socket**, supervisor descriptor, and a `degraded` list derived from durable state, at exit `0`; with a live fresh instance the derived markers are empty. | F-4, F-5, EVT-1, EVT-2 |
| AC-F4-2 | **Given** a resident daemon, **when** `daemon status --live` runs, **then** it probes the composed transport and returns a live envelope (`live: true`, socket reachable, heartbeat `running`) at exit `0`. | F-4, NFR-6 |
| AC-F4-3 | **Given** no reachable daemon, **when** `daemon status --live` runs, **then** it fails closed with `daemon.socket-unreachable` (or `daemon.heartbeat-stale` when the socket answers but the heartbeat is not `running`) at exit `2`; **given** the same state, **when** a plain `daemon status` runs, **then** it exits `0`, reports the socket as unreachable in the envelope, carries `daemon-unreachable` in its `degraded` list, and reports no live claim. | F-4, NFR-7 |
| AC-F4-4 | **Given** a configuration that sets the daemon socket path or heartbeat interval, **when** the daemon is composed, **then** the resolved values are used for the bound socket and the heartbeat cadence (observable in the status payload and in advancing heartbeat ordinals), and no default is re-derived as a literal; when configuration cannot be acquired the same resolver runs over an empty branch and the shipped defaults apply. | F-4, DM-6, NFR-2 |

### 17.5 Degradation resolved from durable state

| ID | Criterion | Linked |
|---|---|---|
| AC-F5-1 | **Given** a live instance whose latest operation is `acquired` or `taken-over` with a heartbeat belonging to it and an age strictly below the lock-staleness bound, **when** `queue list` and `lanes list` run, **then** both payloads carry `degraded: []`. | F-5, DM-3, DM-4 |
| AC-F5-2 | **Given** a latest instance operation of `released` or `immediate-stop`, **when** `queue list` and `lanes list` run, **then** both payloads carry `degraded: ["daemon-unreachable"]`. | F-5, DM-4, EVT-1 |
| AC-F5-3 | **Given** no instance record at all, **when** `queue list` and `lanes list` run, **then** both payloads carry `degraded: ["daemon-unreachable"]` at exit `0`. | F-5, DM-4 |
| AC-F5-4 | **Given** an acquired instance whose latest heartbeat age is at or beyond the configured lock-staleness bound, **when** `queue list` and `lanes list` run, **then** both payloads carry `degraded: ["daemon-unreachable"]`. | F-5, DM-4, EVT-2 |
| AC-F5-5 | **Given** a queue or lanes watch, **when** the daemon's durable state changes between iterations (a start, then a release), **then** the next emitted snapshot carries the newly resolved degradation in both directions within one iteration. | F-5, DM-3 |
| AC-F5-6 | **Given** a durable record set that carries an instance record which is the owner of the latest heartbeat (its `instanceId` matches the heartbeat's) or which has no heartbeat at all, **when** `queue list` reports no degradation, **then** the delivered status fold reports heartbeat state `running` for the same store and instant, and when it reports `["daemon-unreachable"]` the fold reports `stale` or `stopped` — one shared bound, applied as strictly-below on both surfaces, no second rule. | F-5, DM-4 |
| AC-F5-7 | **Given** an unreadable or torn instance or heartbeat read, **when** the degradation resolver runs, **then** it returns `["daemon-unreachable"]`, performs no socket connect, raises no error identity, and does not fabricate reachability; an unreadable queue store still fails the queue read through its own delivered state identity. | F-5, DM-3, NFR-3 |
| AC-F5-8 | **Given** an unowned heartbeat — no instance record at all, or a latest heartbeat whose `instanceId` is not the latest instance's — with a `beatAt` strictly below the staleness bound, **when** `queue list` and `lanes list` run, **then** both payloads carry `degraded: ["daemon-unreachable"]` while the delivered status fold reports heartbeat state `running` for the same store and instant; the divergence is intentional and named: queue and lanes degrade on ownership, because a heartbeat with no owner can be neither drained, signalled, nor reconciled, and reporting it as a running daemon would assert a process the record set cannot identify (DM-4, DEC-7). | F-5, DM-3, DM-4, EVT-2 |

### 17.6 Instance pid and stop safety

| ID | Criterion | Linked |
|---|---|---|
| AC-F6-1 | **Given** a production start, **when** the instance record is written, **then** its `pid` is the composing process id and is a positive integer, never `0`; `daemon status` and the start receipt report that pid. | F-6, DM-1, EVT-1 |
| AC-F6-2 | **Given** a durable instance record whose pid is `0`, negative, or not an integer, **when** a cross-process `daemon stop` runs, **then** it returns `daemon.state-recovery-failed` at exit `2` and calls the process port's signal zero times, so no process group can be addressed. | F-6, NFR-8 |
| AC-F6-3 | **Given** a durable instance record with a positive pid, **when** `daemon stop --mode drain` and `daemon stop --mode immediate` run, **then** the first sends `SIGTERM` and the second `SIGINT` to that pid only, no signal targets a group, and a failed signal call returns the delivered recovery identity at exit `2`. | F-6, NFR-8, NFR-9 |

### 17.7 Install identity and supervisor classification

| ID | Criterion | Linked |
|---|---|---|
| AC-F7-1 | **Given** a Linux platform and a composed entry path, **when** `daemon install` runs, **then** the unit is written at `<config root>/systemd/user/<brand.binaryName>-daemon.service` containing `ExecStart=<absolute entry path> daemon start --foreground` and `Environment=<PREFIX>_STATE_DIR=<resolved state directory>`, the unit is enabled, linger is enabled, and the receipt reports `result=installed` with the descriptor (kind, unit, scope, installed, linger, command form, service type, restart policy, environment binding) at exit `0`. | F-7, DM-6 |
| AC-F7-2 | **Given** `XDG_CONFIG_HOME` is absolute and non-empty, **when** `daemon install` runs, **then** the unit is written under `$XDG_CONFIG_HOME/systemd/user/`; **given** it is unset, empty, or relative and a home directory exists, **then** the unit is written under `<home>/.config/systemd/user/`; **given** it is unset, empty, or relative and no home directory exists (`HOME` and `USERPROFILE` both absent or empty) **and** the state directory resolves from an absolute `<PREFIX>_STATE_DIR` override, **then** the user configuration root is unresolvable, `daemon install` refuses with the delivered `config.value.invalid` identity at exit `1`, writes no unit and no ownership marker, invokes no supervisor command, and creates no configuration-root directory; this outcome takes precedence over the missing-entry-path refusal of AC-F7-5, because the root is classified when the runtime is composed, and it is reachable only when the state directory resolves. | F-7, DM-6 |
| AC-F7-3 | **Given** a platform with no delivered supervisor adapter, or a linger enablement failure, **when** `daemon install` runs, **then** it returns `daemon.supervisor-unsupported` at exit `2`, writes no unit into the configuration root, reports the platform evidence, and leaves no partially installed unit behind. | F-7, NFR-7 |
| AC-F7-4 | **Given** an installed unit, **when** `daemon uninstall` runs, **then** it removes only the unit and ownership marker this installation created, disables linger only when it enabled it, and reports `result=uninstalled`; **given** no installed unit, **then** it reports `result=noop` at exit `0`. | F-7, NFR-9 |
| AC-F7-5 | **Given** a resolvable state directory and no composed entry path, **when** `daemon install` runs, **then** it refuses with `daemon.state-recovery-failed` at exit `2` and writes no unit, so no unit is ever rendered with an empty executable; the unresolvable state directory takes precedence over this guard, because the unavailable runtime is composed before any full-runtime guard, so `daemon install` with neither an entry path nor a state directory returns the `config.value.invalid` at exit `1` of AC-F3-5 instead. | F-7, NFR-8 |

### 17.8 Additive contract and preserved behaviour

| ID | Criterion | Linked |
|---|---|---|
| AC-F8-1 | **Given** the internal error table, **when** it is validated, **then** no row is added, removed, or reworded, every identity this change reaches (`daemon.already-running`, `daemon.takeover-refused`, `daemon.heartbeat-stale`, `daemon.state-recovery-failed`, `daemon.socket-unreachable`, `daemon.supervisor-unsupported`, the delivered `config.value.invalid` for the unresolvable state directory, and the delivered `state.*` family) is an existing row, and every path exits only `0`, `1`, or `2`. | F-8, NFR-7 |
| AC-F8-2 | **Given** the state schema, **when** it is validated, **then** `STATE_SCHEMA_VERSION` is unchanged, no record kind or payload schema is added, no migration exists, and the only record-shape change is the value of `daemon.instance.pid` (now a real process id). | F-8, DM-7 |
| AC-F8-3 | **Given** a composition that supplies an array-valued `degraded`, **when** `queue list`, `lanes list`, and their mutations run, **then** the payloads are byte-identical to the delivered output; **given** a composition that omits `degraded`, the delivered `["daemon-unreachable"]` fallback still applies. | F-8, DM-3 |
| AC-F8-4 | **Given** the delivered suites for daemon lifecycle, daemon degradation, daemon lock, daemon lock concurrency, daemon supervisor install, queue CLI, control transport, entrypoint help (root family list), entrypoint help coverage (the 16-command enumeration), reference-page parity, queue-scheduling contract, daemon vocabulary, and doc conformance, **when** the full gate runs, **then** each passes with only the mount-specific updates named in §8.5 (the expected-family list, the `daemon` absence assertions, the root family list, the 16-command enumeration in the coverage suite, the coverage inventory, and the conformance page list) and no semantic change to its assertions. The set of suites permitted an update is derived from the delivered tree — every suite that contains the prompt-required enumeration or the family list derived from it — not from this sentence. | F-8, NFR-2 |

### 17.9 Non-functional acceptance

| ID | Criterion | Linked |
|---|---|---|
| AC-NFR-1 | **Given** any `--help` or `--version` invocation, **then** it performs zero state, configuration, git, network, or filesystem reads, writes nothing, and invokes no command composer. | NFR-1 |
| AC-NFR-2 | **Given** a `queue list` or `lanes list` invocation, **when** the degradation resolves, **then** it performs at most two **additional** daemon-fact reads (latest instance, latest heartbeat) beyond the store reads that projection already performs, opens no socket, probes no process, sleeps zero times, and keeps the read's p95 latency within 10% of the delivered baseline on the reference store. | NFR-3 |
| AC-NFR-3 | **Given** a foreground daemon and a delivered `SIGTERM`, **when** the signal is handled, **then** the process stops, appends its release, and exits within 1 000 ms, with loop cancellation observed within 250 ms. | NFR-5 |
| AC-NFR-4 | **Given** the reference store, **when** `daemon status` and `daemon status --live` run, **then** their p95 latencies are within 1 000 ms and 2 000 ms respectively, and every output stays within the delivered bounds. | NFR-6, NFR-11 |
| AC-NFR-5 | **Given** any new output, record, or error evidence, **when** it is inspected, **then** it carries no credential, token, prompt, transcript, diff, or repository content, and the only environment value this change introduces into a contract is an absolute directory path — the re-entry environment forwards the composing process's own `PATH`, `HOME`/`USERPROFILE`, and working-name override unchanged and adds nothing else. | NFR-10 |
| AC-NFR-6 | **Given** a repeated `daemon install`, `daemon stop` against a released instance, and a `daemon start` while an instance is live, **then** install is idempotent, stop is a `noop` at exit `0`, and start returns `daemon.already-running` at exit `1` (the delivered `user-validation` projection class for that identity) appending nothing. | NFR-9, NFR-7 |

Each criterion names an observable — an envelope field, a degraded array, a durable record, a file under the configuration root, an exit code, or a help listing — so the test plan and delivery plan can place the corresponding proof. This specification prescribes no plan phase, test file location, or implementation step.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery shape.** One change on `feat/GH-286/daemon-command-mounting`, one pull request targeting `main-tools`. Runtime-neutral composition and help changes only.
- **No migration and no schema change.** Nothing is transformed, backfilled, or seeded.
- **Ordering inside the change.** The degradation seam and the composition inputs are independent of the mount; the mount, the prompt-required set, and the help/coverage inventory must land together because the strict program selection makes a partially mounted family a composition failure.
- **Adoption path.** An operator runs `daemon start` once and then reads `daemon status`, `queue list`, and `lanes`; `daemon install` is optional and only adds a user-level unit. Nothing changes for an operator who never starts a daemon except that the degradation marker becomes informational.
- **Disclosed behaviour change.** A process that sets `<PREFIX>_STATE_DIR` now sees the whole production composition honour the override. Existing state at the home default is not moved; the operator either keeps the variable set or moves the directory deliberately.
- **Rollback.** Stop the daemon, uninstall the unit if one was installed, and revert the change. Records are additive under the same schema and remain readable; no data loss and no migration reversal is required.
- **Communication.** The mount, the foreground lifetime, the install identity, and the derived degradation are recorded in the reconciled feature pages, the daemon command page, and the M2 entrypoint delta.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No record kind, payload schema, or schema version changes, and no record is transformed. Two operational notes stand in place of a migration:

- An installation that has never run a daemon has no instance or heartbeat record; that is a valid state and resolves to `daemon-unreachable`, which is now the truth rather than a constant.
- A process that sets `<PREFIX>_STATE_DIR` moves where the production composition reads and writes. Existing state under the home default stays on disk and is not copied; the operator either keeps the variable or relocates the directory. No automated move is performed and none is implied.

## 20. PRIVACY / COMPLIANCE REVIEW

- **No personal data or content.** The change reports identities, paths, counts, durations, pids, and closed vocabulary values only. No prompt, message, transcript, diff, diff hunk, repository content, or model output is stored or printed.
- **No secret material.** The only environment value this change introduces into a contract is an absolute directory path; the re-entry environment forwards the composing process's own `PATH`, `HOME`/`USERPROFILE`, and working-name override unchanged, and no credential, token, or provider payload is read, written, or rendered. The daemon lock token is never exposed by any command.
- **New write location is user-owned.** The unit and its ownership marker land under the user configuration root and are removed by `uninstall`; nothing is written outside the user's own configuration and the resolved state directory.
- **Trust model unchanged.** Same-user local process boundary; the control socket is inside the state directory; no privilege escalation, no remote transport, no new network destination.
- **Privacy guard impact.** None; the change adds no committed private literal and no cloud dependency.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Signalling is now bounded to a recorded positive pid.** The composing pid is recorded, and any record whose pid is not a positive integer is refused before a signal call, which removes the process-group hazard that a `0` fallback created. The target is always a pid read from durable state, never a name, pattern, or user-supplied string.
- **Foreground lifetime is an availability control.** A foreground daemon that owns its lifetime through the signal host releases its instance lock and detaches delivering lanes on `SIGTERM`, so a stop cannot leave a permanent lock holder.
- **Fail-closed on unreadable state.** A torn instance or heartbeat read degrades rather than asserting reachability; `status --live` is the only surface that fails on an unreachable transport; `install` refuses without an executable path; and an unresolvable state directory composes an unavailable daemon runtime that returns `config.value.invalid` before touching the filesystem, so an empty home can never become a root-level store root.
- **Writes are scoped and reversible.** The installer writes one unit and one ownership marker under the user configuration root, enables linger explicitly, rolls back on a linger failure, and removes only what this installation created.
- **No new attack surface.** No new listener, network egress, credential read, elevation, or execution path except the delivered lifecycle commands; the detached child is the same executable this process is running.
- **Residual risk.** A same-user process can interfere with durable state, as in the delivered trust model; a wrapper that makes the entry path non-executable, or a caller that strips `PATH` or `HOME` from its own environment, turns a start into a classified failure rather than an interpreter or directory guess. This change does not widen the boundary.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New operator surface.** `daemon start [--foreground]`, `daemon stop [--mode drain|immediate]`, `daemon status [--live]`, `daemon install`, `daemon uninstall` — reachable from the shipped binary, with help for the family and each subcommand.
- **Runbook.** Start with `daemon start` (returns a receipt) or `daemon start --foreground` in a terminal or under the installed unit (the receipt renders at stop). Inspect with `daemon status`; probe with `daemon status --live`. Stop with `daemon stop --mode drain` for an orderly detach or `--mode immediate`. Install the optional user unit with `daemon install` and remove it with `daemon uninstall`.
- **Operational interpretation.** `queue list` and `lanes` now report `daemon-unreachable` only when the durable record set says so; a live instance removes it, and a released, absent, or stale one restores it within one projection. `supervise-only` mode with `lane-executor-unavailable` is expected in production v1 and means "daemon running, no lane executor composed", which is distinct from "daemon unreachable".
- **Configuration.** No new key. The `daemon` branch's delivered keys (socket path, heartbeat interval/cycle, lock staleness, transports, bounds) now actually reach the composed runtime; the state directory remains the environment override or the home default.
- **State growth.** One instance record per start, takeover, release, or immediate stop; one heartbeat per interval while resident; one lane record per detach. A queue or lanes read appends nothing.
- **Failure handling.** A readiness timeout is retried after inspecting `daemon status`; a refused stop for a non-positive pid means the durable record is torn and should be inspected rather than forced; an unsupported supervisor means the platform has no delivered adapter and the daemon runs in the foreground or not at all.
- **Maintenance cost.** The composition values that must be kept in agreement (unit name, entry path, environment variable, config root, scope) are derived from the brand and one resolution, so the recurring cost is low; the main ongoing attention is the declared re-entry limit (a caller that strips `PATH` or `HOME` fails closed) and the unit renderer's unquoted environment value (RSK-13).

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Resident daemon | The delivered single-instance supervisor process: acquires the instance lock, writes heartbeats, serves the control socket, reconciles on start, drains or stops on request. |
| Lifecycle family | `daemon start`, `stop`, `status`, `install`, `uninstall` with the delivered grammar. |
| Entry path (`daemonEntry`) | The absolute path of the running executable entry, supplied by the executable as a production fact; used both to re-enter as a detached child and as the unit's executable. |
| Detached re-entry | A bare start spawning the entry path as `daemon start --foreground` in a detached process whose environment is rebuilt from the composing process: the state-directory binding written last as the authority, plus the composing `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override. |
| Re-entry environment limit | A caller that strips `PATH` from its own environment cannot be repaired by the spawn, and the child fails closed as `daemon.state-recovery-failed`; a caller that strips its home makes the state directory unresolvable and receives `config.value.invalid` (DEC-16, DEC-18). |
| Foreground lifetime | A foreground start owning its process lifetime through the injected signal host until the first signal, then stopping with that mode and returning the readiness snapshot. |
| Readiness snapshot | The start receipt captured after the runtime reports readiness; returned at exit by the foreground lifetime path. |
| Readiness window | The delivered bounded poll (20 attempts × 50 ms) for a durable `acquired` instance before a start reports a timeout. |
| Composing pid | The process id of the process that acquires the instance lock; recorded on the instance record instead of the `0` fallback. |
| Fail-closed stop | Refusing to signal a durable record whose pid is not a positive integer, returning the delivered recovery identity and sending nothing. |
| Reachability predicate | The durable rule: an instance record exists whose latest operation is `acquired`/`taken-over`, the latest heartbeat belongs to that instance by `instanceId`, and its age is strictly below the lock-staleness bound; otherwise `daemon-unreachable`. An unowned heartbeat is never reachable (DM-4, AC-F5-8). |
| Degradation resolver | The per-projection function that produces the queue or lanes `degraded` list from durable state instead of a captured constant. |
| State-directory scope | The canonical directory selected by `<PREFIX>_STATE_DIR` when absolute, otherwise `<home>/<brand.stateDirectoryName>` when a home exists; shared by store, lock, socket, unit, child, and read side. No override and no home makes it unresolvable (DEC-18). |
| Unresolvable state directory | The third scope outcome — no override and no home — in which the `daemon` family stays mounted over an unavailable daemon runtime: every subcommand returns `config.value.invalid` at exit `1`, and no store, lock, socket, transport, or supervisor path is opened. |
| Unit identity | `${brand.binaryName}-daemon.service` under the user configuration root, with the resolved state directory as its environment binding. |
| Configuration root | `XDG_CONFIG_HOME` when absolute and non-empty, otherwise `<home>/.config` when a home exists; with neither it is unresolvable and `daemon install` refuses with `config.value.invalid` at exit `1`, writing no unit (DM-6). |
| Supervise-only mode | The delivered daemon mode when no lane executor is composed: it reconciles, serves status and control, and reports `lane-executor-unavailable`. |
| Lock-staleness bound | The configured heartbeat age at or beyond which a daemon is considered stale; the single freshness bound for both `daemon status` and the queue/lanes degradation predicate, applied as strictly-below on both. |
| Prompt-required command | A command in the exact set the entrypoint composes; a missing member is a composition gap that throws and is contained as `fallback.internal`. |
| Help coverage inventory | The machine-readable list of prompt-required commands and reference pages the coverage and parity guards compare against the shipped help and the reference pages. |

## 24. APPENDICES

### Appendix A — Ticket-to-spec traceability

| Ticket acceptance criterion / pinned decision | Spec coverage |
|---|---|
| `daemon status` reports daemon state (running pid/url or a classified not-running outcome) with no degradation workaround | AC-F4-1..4, AC-F5-1..8, DEC-7 |
| `daemon start` brings the resident daemon up; `queue list` and `lanes` stop reporting `daemon-unreachable`; `daemon stop --mode drain` drains lanes per contract | AC-F2-1..10, AC-F5-1..8, AC-F6-1..3, DEC-2, DEC-3, DEC-7 |
| `daemon install`/`uninstall` manage the systemd unit on Linux; unsupported platforms classify cleanly | AC-F7-1..5, DEC-9, DEC-11 |
| Help/reference coverage guards pass; entrypoint listing shows the command | AC-F1-1..5, AC-F8-4, DEC-12, DEC-13 |
| Ticket scope: compose the runtime and mount the family per the daemon contract | F-1, AC-F1-1..5, DEC-1 |
| Ticket scope: prompt-required set, help reference page, man-page/entrypoint delta updates | AC-F1-2..4, §16 documentation impact |
| Ticket scope: install registers the optional user-level systemd unit with linger on Linux; unsupported supervisors return the classified outcome | AC-F7-1..5 |
| Provenance: GH-284 review board finding CG-DAEMON-001 | §2.1 current state, §16 entrypoint-delta reconciliation |
| Fail-closed state-directory outcome: with no override and no home the family stays mounted and refuses instead of using a root-level store root | AC-F3-5, AC-F2-10, DM-5, DEC-18 |

### Appendix B — TDR-0022 decision-to-AC map

| TDR position | Spec decision | Acceptance criteria |
|---|---|---|
| DC-1 entry path from the running executable, forwarded as a production fact | DEC-2 | AC-F2-1..3, AC-F2-10 |
| DC-1 re-entry environment (state directory authoritative, plus forwarded `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override, in one additive input) | DEC-16 | AC-F2-1, AC-F2-10, AC-F3-2 |
| DC-1 signal-owned foreground lifetime (`SIGTERM` drain, `SIGINT` immediate, cleanup in `finally`, snapshot at exit) | DEC-3 | AC-F2-4..9 |
| DC-1c one state-directory scope through the delivered resolution | DEC-5, DEC-18 | AC-F3-1..5 |
| DC-1d/1e resolved settings, delivered unix transport, ownership predicate, no wake | DEC-4, DEC-6 | AC-F4-1..4 |
| DC-2 per-read degradation from durable state | DEC-7 | AC-F5-1..8 |
| DC-3 real pid plus fail-closed stop | DEC-8 | AC-F6-1..3 |
| DC-4 brand-derived install identity; renderer environment line accepted as declared | DEC-9, DEC-17 | AC-F7-1..5 |
| C-5 prompt-required surface always composes | DEC-1 | AC-F1-1, AC-F1-5 |
| C-6 additive composition only | DEC-1, DEC-7, DEC-8, DEC-11 | AC-F8-1..4, AC-F8-2 |

### Appendix C — Closed vocabularies relied on (all unchanged)

| Vocabulary | Values used by this change |
|---|---|
| Instance operations | `acquired`, `taken-over`, `released`, `immediate-stop` |
| Release reasons | `drain`, `immediate`, `shutdown` |
| Heartbeat states | `running`, `stale`, `stopped` |
| Start modes | `resident`, `foreground`, `supervise-only` |
| Stop results | `stopped`, `draining`, `noop` |
| Stop modes | `drain`, `immediate` |
| Queue degradation reasons | `daemon-unreachable` (the only member) |
| Daemon degradation markers | `daemon-unreachable`, `daemon-heartbeat-stale`, `daemon-socket-unreachable`, `lane-executor-unavailable`, `subscriber-overflow` |
| Supervisor kinds | `systemd-user`, `launchd`, `windows-service` |
| Install/uninstall results | `installed`, `noop`, `uninstalled` |

No vocabulary is extended, narrowed, or reordered.

### Appendix D — Mount exit matrix

| Outcome | Identity | Exit | Consequence |
|---|---|---|---|
| Start reached readiness with a durable acquired instance | — (success `data`) | 0 | — |
| Foreground lifetime ended on a signal with the release landed | — (success `data`, snapshot captured at start) | 0 | — |
| Stop accepted for a live instance (`draining` or `stopped`) | — (success `data`) | 0 | — |
| Stop against a released or absent instance | — (success `data`, `result=noop`) | 0 | — |
| Plain status with no daemon, a stale heartbeat, or an unreachable socket | — (degraded success `data`) | 0 | — |
| Install installed, uninstall removed, or uninstall noop | — (success `data`) | 0 | — |
| Invalid invocation grammar | `fallback.invocation` | 1 | `not_landed` |
| State permission denied | the delivered `state.permission.denied` | 1 | `not_landed` |
| Instance already held | `daemon.already-running` (`user-validation`) | 1 | `not_landed` |
| Unresolvable state directory (no override, no home) | the delivered `config.value.invalid` (`user-validation`) | 1 | `not_landed`, nothing opened |
| Acquired configuration with an invalid `daemon` branch | the delivered `config.value.invalid` (`user-validation`) | 1 | `not_landed`, unavailable daemon runtime; `queue`/`lanes` report `daemon-unreachable` (DEC-19) |
| `daemon install` with an unresolvable user configuration root (no absolute `XDG_CONFIG_HOME`, no home) | the delivered `config.value.invalid` (`user-validation`) | 1 | `not_landed`, no unit written (AC-F7-2) |
| Takeover refused against a live lock | `daemon.takeover-refused` (`user-validation`) | 1 | `not_landed` |
| Readiness timeout, unreadable or torn instance state, failed signal call, refused stop for a non-positive pid, install without an executable path given a resolvable state directory | `daemon.state-recovery-failed` | 2 | `not_landed` |
| Live status with an unreachable transport | `daemon.socket-unreachable` | 2 | `not_landed` |
| Live status with a stale heartbeat | `daemon.heartbeat-stale` | 2 | `not_landed` |
| No delivered supervisor adapter, or a linger failure | `daemon.supervisor-unsupported` | 2 | `not_landed` |
| Failed state append | the delivered `state.write.failed` | 2 | `not_landed` |
| Unreadable queue store on a queue or lanes read | the delivered `state.*` identity for that read | 2 | `not_landed` |

A missing daemon is never an error on a state-derived surface: `queue`, `lanes`, and plain `daemon status` report it as degradation at exit `0`. An unresolvable state directory is not a degraded success: it is a `user-validation` refusal at exit `1` that opens nothing (DEC-18). Every non-zero outcome resolves to one delivered identity, and each exit digit is the one the delivered projection class assigns: `daemon.already-running`, `daemon.takeover-refused`, and `config.value.invalid` are `user-validation` rows and therefore exit `1`, not `2`; the `2` rows are the platform-class and recovery-class failures (`daemon.state-recovery-failed`, `daemon.socket-unreachable`, `daemon.heartbeat-stale`, `daemon.supervisor-unsupported`, and the delivered state identities).

### Appendix E — Identity matrix (the values that must agree)

| Observer | State directory | Entry path | Environment name | Unit | Scope |
|---|---|---|---|---|---|
| Composing process | resolved (override or home default) | `process.argv[1]` | `<PREFIX>_STATE_DIR` | `${binaryName}-daemon.service` | digest of the resolved directory |
| Detached child | same variable, same value | same path (it is the executable) | same name | — | same digest |
| Installed unit | `Environment=` binding | `ExecStart` | same name | same unit name | same digest |
| Store / lock / socket | same directory | — | — | — | — |
| Queue / lanes read side | reads the same store | — | — | — | compares instance scope implicitly through the record set |

The detached child's environment additionally carries the composing `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override (DEC-16); only the state-directory value is compared in this matrix, and that value remains the authority inside the child's resolution. The installed unit is unaffected by the forwarding: it binds the same single variable and systemd supplies its own `PATH` and `HOME`.

### Appendix F — Composition matrix (production values)

| Composition input | Production value | Basis |
|---|---|---|
| `store` | the production state store over the resolved directory | DEC-5 |
| `lock` | the delivered daemon lock port over the resolved directory | DEC-5 |
| `settings` | resolved `daemon` branch with the resolved directory, defaults over an empty branch | DEC-6 |
| `restartBound` | resolved `lane.restart-budget`, shipped default on failure | DEC-10 |
| `stateDirectory` | resolved scope value | DEC-5 |
| Unresolvable state directory (no override, no home) | unavailable daemon runtime: no store, lock, settings, transport, socket path, supervisor scope, entry path, or pid composed; every subcommand `config.value.invalid` at exit `1` | DEC-18 |
| Acquired configuration with an invalid `daemon` branch | unavailable daemon runtime: no daemon lock, transport, socket path, entry path, or supervisor scope composed; every subcommand `config.value.invalid` at exit `1`; `queue`/`lanes` report `daemon-unreachable` | DEC-19 |
| `unit` | `${brand.binaryName}-daemon.service` | DEC-9 |
| `binary` | the entry path | DEC-2, DEC-9 |
| `environmentName` | the exact `<PREFIX>_STATE_DIR` name | DEC-9 |
| `supervisorConfigDirectory` | `XDG_CONFIG_HOME`, else `<home>/.config` when a home exists, else unresolvable (install refuses, no unit) | DEC-9, AC-F7-2 |
| `daemonEntry` | the entry path when non-empty | DEC-2 |
| `pid` | the composing process id when positive | DEC-8 |
| `signalHost` | the injected signal host | DEC-3 |
| Re-entry environment input | the composing `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override, derived from the composer's injected environment and home facts, merged beneath the state-directory binding written last | DEC-16 |
| `transport`, `socketPath` | the delivered unix transport at the resolved socket path | DEC-6 |
| `supervisor` | omitted in production; injectable for tests | DEC-11 |
| `wake` | not supplied | DEC-4 |
| `executor`, `lane`, `supervision` | not supplied (supervise-only) | DEC-15 |
| `mergeCodePath` | `"absent"` | delivered |
| Degradation resolver | the durable-state predicate | DEC-7 |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-11 | `@spec-writer` | Initial specification for GH-286 / M1-S18 mount: 47 acceptance criteria (41 capability criteria across eight capabilities plus six non-functional criteria), 16 decisions, the additive contract deltas (`DaemonComposition.pid?`, `DaemonComposition.signalHost?`, `ProductionCompositionFacts.daemonEntry?`, `ProductionCompositionFacts.supervisor?`, the `QueueComposition.degraded` union, the foreground-lifetime contract), the reconciled documentation set with each reversed claim, and the composition gap the decision record leaves open (restart bound, install test seam, help inventory shape, conformance page list, status install truth, production start mode, re-entry environment limit) resolved as DEC-10 through DEC-16. |
| 1.1 | 2026-11-11 | `@spec-writer` | Revision closing DoR iteration 1 (`readiness-review/readiness-iter-1.md`, verdict `NOT_READY`). **RF-1** — the re-entry environment is restated to the amended TDR-0022 DC-1: the state-directory binding (authoritative, written last) plus the composing `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override, arriving through one optional additive composition input; the renamed-working-name limitation is deleted and replaced by the caller-that-strips-`PATH`/`HOME` residual, which fails closed as `daemon.state-recovery-failed`; new **AC-F2-10** proves a `#!/usr/bin/env bun` entry is executable from the re-entry environment and that a stripped environment fails closed. **RF-2** — the reachability predicate is pinned to an owning instance record plus `now − beatAt < lockStalenessMs`; DM-4 drops the `<=` form and declares the divergence from the delivered status fold; **AC-F5-6** is restated over stores whose latest heartbeat is owned by the instance record, and new **AC-F5-8** covers the orphan/mismatched-heartbeat cell (degraded, while the fold reports `running`). **RF-3** — `tests/behaviour/entrypoint-help-coverage.test.ts` and `tests/behaviour/entrypoint-help.test.ts` are added to §8.5 and AC-F8-4, with the rule that the permitted-edit set is derived from the tree rather than enumerated. **RF-4** — plain `status` is stated to probe the socket, report reachability, and stay a degraded success at exit `0`; only `--live` fails closed; the zero-connect claim is confined to the queue/lanes path. **RF-6** — `daemon.already-running` and `daemon.takeover-refused` exit `1` (`user-validation`), not `2`, in Appendix D and AC-NFR-6. Advisories: **A-1** (at most two *additional* daemon-fact reads), **A-2** (no root-level state path while `HOME` is forwarded), **A-6** (the renderer's unquoted `Environment=` line declared, RSK-13, DEC-17), **A-7** (counts). Totals: 49 acceptance criteria (43 capability criteria across eight capabilities plus six non-functional), 17 decisions. No AC id was renumbered; no criterion was deleted. |
| 1.2 | 2026-11-11 | `@spec-writer` | Revision closing DoR iteration 2 (`readiness-review/readiness-iter-2.md`, verdict `NOT_READY`). **RF2-4** — the daemon composition's state directory is pinned to exactly three outcomes: an absolute `<PREFIX>_STATE_DIR` override wins; otherwise the home-based `<home>/<brand.stateDirectoryName>` applies only when a home exists; otherwise the directory is unresolvable. The unresolvable outcome keeps the `daemon` family mounted over an **unavailable daemon runtime** — every subcommand returns the delivered `config.value.invalid` at exit `1` (`user-validation`) and no store, lock, socket, transport, or supervisor path is opened — so an empty home can never become `/<stateDirectoryName>`. F-3, DM-5, §6 Flow 1 and new Flow 7, §7.1/§7.2, §8.5, §12, §16, §21, the glossary, Appendix A, Appendix D, and Appendix F carry the outcome; **AC-F3-4** is scoped to the non-absolute override with a home present, new **AC-F3-5** proves the unresolvable runtime shape, and **AC-F2-10**'s second clause is split into the stripped-`PATH` case (`daemon.state-recovery-failed`, exit `2`) and the no-home case (`config.value.invalid`, exit `1`); DEC-5 is amended and **DEC-18** records the matrix and the projected exit digit. **A2-7** — the v1.0 row is marked superseded by v1.1 and v1.2. **A2-8** — §2.1 now states that `readDaemonStatus` consumes socket reachability as an input alongside the durable records instead of deriving its marker probe-free. **A2-9** — DEC-2 records that TDR-0022's provisional `entryScriptPath` name is retired by the record's 2026-11-11 amendment, leaving `daemonEntry` as the one pinned name. Totals: 50 acceptance criteria (44 capability criteria across eight capabilities plus six non-functional), 18 decisions. No existing AC id was renumbered; no criterion was deleted. |
| 1.3 | 2026-11-11 | `@spec-writer` | Revision closing DoR iteration 3 (`readiness-review/readiness-iter-3.md`) specification advisories. **A3-1** — the refusal precedence is made non-overlapping: **AC-F7-5** is scoped to "given a resolvable state directory", so `daemon install` with no entry path **and** no state directory no longer reads as `daemon.state-recovery-failed`; the criterion now states that the unresolvable state directory takes precedence because the unavailable runtime is composed before any full-runtime guard, so that invocation returns `config.value.invalid` at exit `1` (AC-F3-5) and the entry-path guard in the full runtime is unreachable. Appendix D's install-without-executable row carries the same qualifier. **A3-4** — **AC-F3-4** now states that the delivered edge returns no store for a non-absolute override, exactly as before, instead of describing the edge as reporting the invalid value. Totals unchanged: 50 acceptance criteria, 18 decisions; no AC id renumbered, added, or deleted. |
| 1.4 | 2026-11-11 | `@spec-writer` | Revision closing review iteration 1 (`review/review-iter-1.md`) declaration findings; no delivered behaviour changes. **F-7** — the acquired-but-invalid `daemon` configuration branch is declared rather than left as an undeclared divergence: the daemon family composes the refusing unavailable runtime and answers every subcommand with the delivered `config.value.invalid` at exit `1`, while `queue` and `lanes` keep reporting `daemon-unreachable` from durable state, so the two surfaces diverge in exactly that cell by design; **DEC-19** records the rule and the rationale, **F-4**, **DM-5**, Appendix D, and Appendix F carry it. **F-13** — the user configuration root is pinned to three outcomes: an absolute non-empty `XDG_CONFIG_HOME` wins; otherwise `<home>/.config` applies only when a home exists; otherwise the root is unresolvable and `daemon install` refuses with the delivered `config.value.invalid` at exit `1`, writing no unit and no ownership marker. **DM-6** states it, **AC-F7-2** is extended (not renumbered) with the no-home cell, and F-7, §8.4, the glossary, Appendix D, and Appendix F carry the same rule. **F-10** — the §16 documentation-impact declaration is extended from five reconciled pages to fourteen, adding `feature-agents-and-commands.md`, `feature-config-layer.md`, `feature-dispatch-engine.md`, `feature-harness-adapters.md`, `architecture-overview.md`, `glossary.md`, `test-spec-resident-daemon.md`, `test-spec-dispatch-engine.md`, and `m2/README.md`, each with the specific claim it reverses, and the header now states that the list is the complete reconciled set. Totals: 50 acceptance criteria (44 capability criteria plus six non-functional, unchanged), 19 decisions; no AC id renumbered, added, or deleted. |

**History hygiene (A2-7).** The 1.0 row above is historical: v1.1 and v1.2 supersede it and its `47 acceptance criteria` / `16 decisions` totals, which are kept only as the record of what that version claimed.

---

## AUTHORING GUIDELINES

- **Sources.** Authored from the GH-286 issue body (read live), the clarify-scope record in `chg-GH-286-pm-notes.yaml`, and the binding decision record `TDR-0022-daemon-lifecycle-mount-and-degradation-composition.md`. The delivered surfaces named as facts — the composition seam, `createDaemonCommandRuntime` and `DaemonComposition`, the runtime's start/stop/loop and failure paths, the process port's detached spawn and environment replacement, the state-directory scope resolution and the daemon settings resolver, the unix transport preconditions, the supervisor adapter and unit renderer, the status fold, the queue and lanes runtimes and their degradation consumers, the prompt-required set, the help inventory, and the help/parity/conformance guards — were read from the tree so the specification describes current behaviour rather than assumptions.
- **Approach.** The ticket's four acceptance themes are turned into eight capabilities and 50 acceptance criteria (44 capability criteria plus six non-functional), each with an observable (an envelope field, a degraded array, a durable record, a file under the configuration root, an exit code, or a help listing). The decision record's DC-1 through DC-4 are adopted as DEC-1 through DEC-9 and mapped one-to-one in Appendix B. The composition values the record leaves open are resolved rather than deferred: the lane restart bound, the install test seam, the help inventory shape, the conformance page list, the delivered status install truth, the production start mode, the re-entry environment set and its residual, the unit renderer's unquoted environment line, and the daemon composition's unresolvable state-directory outcome.
- **Contradictions resolved in this specification.** (1) The decision record names the production entry-path fact `entryScriptPath` while the change delegation names it `daemonEntry`; the specification adopts `daemonEntry` so the fact and the composition input share one name, and records the naming reconciliation in DEC-2. (2) The decision record's amended DC-1 pins the re-entry environment as the state-directory binding plus forwarded `PATH`, `HOME`/`USERPROFILE`, and a non-empty working-name override; the specification carries that set verbatim and names the residual the record also names — a caller that strips `PATH` fails closed rather than being repaired by the spawn, and a caller that strips its home is the unresolvable case (DEC-16, DEC-18, RSK-2, AC-F2-10). (3) The decision record does not name the daemon's lane restart bound, the install test seam, or the delivered status install truth; each is resolved as a decision with an explicit residual rather than left implicit (DEC-10, DEC-11, DEC-14). (4) The delivered status fold reports `running` for a heartbeat with no owning instance, while the queue/lanes reachability predicate requires an owner; rather than pretending the two rules are equivalent, the specification declares the divergence, partitions the cells between AC-F5-6 (agreement) and AC-F5-8 (the divergent family), and justifies it in DM-4 and DEC-7. (5) The delivered unit renderer emits its environment binding unquoted; the specification declares that limitation and states that this change does not modify the renderer (DEC-17, RSK-13). (6) The delivered production template concatenates an empty home into a root-level `/<stateDirectoryName>`, which contradicts the fail-closed requirement; rather than leaving the contradiction implicit, the specification pins the three-outcome resolution, composes an unavailable daemon runtime for the unresolvable outcome, and records the projected exit digit in DEC-18 (AC-F3-4, AC-F3-5, AC-F2-10).
- **Constraints observed.** The specification is contract-level: it names capabilities, composition inputs, durable records, identities, and observable outcomes, and it prescribes no plan phase, task sequence, or code structure. It preserves the delivered error taxonomy, the `{0,1,2}` exit projection, the additive state discipline, the no-new-dependency rule, and the purity boundary that keeps the reachability predicate free of I/O.
- **Open questions.** None. All choices inside the ticket are recorded as decisions; the decision record's own residual questions are either resolved here or named as deferred work in §7.3.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-286)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + authoring guidelines + validation checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, OQ-, DM-, EVT-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/EVT- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details beyond the named composition contracts, the permitted-edit suite set named by §8.5, and the reference pages
- [x] Every criterion remains observable, and no criterion claims a universal over cells its own predicate excludes (AC-F5-6 and AC-F5-8 partition the record-set cells; AC-F3-4, AC-F3-5, and AC-F2-10 partition the three state-directory outcomes)
- [x] Counts are internally consistent (50 acceptance criteria = 44 capability criteria + 6 non-functional; 8 capabilities; 19 decisions; 13 risks; 7 data-model elements; 3 events; 12 NFRs)
- [x] No content duplicated from linked docs beyond the necessary contract summary
- [x] Front matter validates per the authoring rules
