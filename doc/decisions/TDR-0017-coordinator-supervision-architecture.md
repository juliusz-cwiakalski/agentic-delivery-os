---
id: TDR-0017
decision_type: tdr
status: Proposed
created: 2026-11-07
decision_date: null
last_updated: 2026-11-09
summary: "Coordinator supervision ships as its own supervised process and a `coordinator` command family (start/stop/status/tick) instead of a `daemon` command, with v1 restricted to foreground-only hosting: the only start shape is `coordinator start --foreground`, a bare `start` is `fallback.invocation` at exit 1, `supervisorMode` is exactly `foreground` (`detached` is a reserved closed value never produced in v1), `externalUnit` is `absent`, and detached or OS-unit hosting is the M1-S18 seam. `start --foreground` runs a declared claim-free evaluation loop with an injected cycle-driver/clock seam, one lifetime acquisition/release pair and no per-cycle lease records, and declared stop, fatal, and signal exits. Single-instance ownership is a durable **instance lease** folded by ledger sequence from append-only `coordinator.fence` records (acquired, released, stale-takeover, stop-requested) and claimed as **one fenced critical section** — `acquireFence`, re-read the fold and the holder's liveness under the fence, append one acquisition or refuse, `releaseFence` — decided **liveness-first**: a live holder is refused `coordinator.already-running` regardless of lease age, a dead holder is takeover-eligible through a single `stale-takeover` record that is itself the new acquisition, and lease age (2×`collection-interval`) is a fallback only when the declared alive capability returns no answer for the handle, while an undeclared alive capability at claim time is `coordinator.process.capability-gap`; `tick` uses the same claim path, so a crashed holder is recovered by a tick and every tick appends exactly one lease pair. The delivered state write fence is a short-lived per-append lock taken only for one append, with one age-stale `recoverFence` retry, never held for the supervisor's lifetime and never the source of the lease decision: the **claim acquire** performs the same one-shot stale recovery and maps only a still-busy or non-stale fence to `coordinator.already-running`, while a **non-claim append** maps a still-busy fence to the delivered `state.lock.busy`; the record declares the supervisor-regime descriptor shape the delivered M1-S18 `daemon install` must consume (a coordinator unit needs an additive explicit `command` vector in `SupervisorInstallRequest`/`renderSystemdUnit`, which today hardcode `daemon start --foreground`), with coordinator install/uninstall out of scope; every process effect crosses the delivered `DaemonProcessPort` (`isAlive`, `signal`) extended additively with `SIGKILL` and an optional `startTimeMs` identity capability and faked in tests so the decision domain stays pure, while harness resume is consumed from the delivered harness session port and an absent resume is a decision input selecting `spawn-fresh`/`session-interrupted`, never an error; each join-live/resume-context/spawn-fresh decision is recorded before it is applied and only recoveries consume a restart ordinal in a distinct per-epoch coordinator budget; and wake is strictly the delivered isCoordinatorPickup predicate with one wake per question lifetime deduped on coordinator id + question id + askedAt."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os coordinator supervision (M1-S23)"
decision_scope: repo
review_date: null
business_impact: "Removes the last unmanaged actor from the M1 end state: the coordinator gains a recorded, crash-safe lifecycle and a durable restart bound, and the M4-S5 bash retirement stops being blocked on ceo-loop.sh."
classification:
  domains: [architecture, operations, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: high
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@pm (delegated the change-scoped decisions in autonomous mode to unblock GH-241 specification)"
  decider: "Juliusz Ćwiąkalski — acceptance pending at the GH-241 PR review; the positions here are spec-fixed under that delegation for delivery unblocking (TDR-0003/TDR-0004/TDR-0006/TDR-0012 precedent)"
  contributors:
    - "@spec-writer (GH-241 DEC-1, DEC-3, DEC-6, DEC-7, DEC-9 and §5.1 F-1..F-2, F-4, F-7, F-8)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-241 PR review — the kill path and the S18 regime seam are owner-visible)"
  performers:
    - "@coder (GH-241 delivery: contracts, domain, state, config, adapters, CLI)"
    - "@doc-syncer (phase-7 reconciliation: coordinator-supervision feature spec and consumer notes)"
  informed:
    - "M1-S18 resident dispatch daemon (delivered; must consume the regime descriptor, not fork it)"
    - "M1-S9 dispatch (distinct loop, shared harness port)"
    - "M1-S20 agent integration (may teach the coordinator to call the command)"
    - "M4-S5 bash stack retirement (ceo-loop.sh replacement evidence)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M1-S18 extends `SupervisorInstallRequest`/`renderSystemdUnit` with an explicit `command` vector for a coordinator unit: it must consume this regime descriptor (state-dir scope, instance lease, unit identity, process kind, budget store) rather than define a second one. If its unit or lease shape cannot consume the descriptor, reopen DC-2 here instead of forking a regime."
  - "A coordinator unit or detached/OS-unit hosting is admitted and `detached` must become a produced `supervisorMode`: reopen DC-1/DC-2 to admit the hosted start shape; v1's foreground-only restriction is the seam, not a permanent design."
  - "A live holder is ever taken over because its lease aged, or a crashed holder's lease blocks `coordinator tick`: reopen DC-2's liveness-first claim rather than widening the age fallback."
  - "A harness cannot expose a stable session handle, resume, or sourced progress, or a supported host cannot kill a process tree (for example Windows without a tree equivalent): reopen the four-way capability ownership split in DC-3 rather than adding a harness-specific branch in the decision domain (resume remains a decision input, spawn keeps the delivered harness identity, progress remains an `unknown` class, and only process-port alive/kill is a capability gap)."
  - "A `stuck` verdict terminates a session that was in fact progressing (false-kill incident): the kill path here and the verdict rule in TDR-0018 are reopened together; the corroborator is strengthened before the kill budget is loosened."
  - "Two coordinators, a second coordinator per state dir, or multi-host supervision is needed: the state-dir scope and the single-instance instance lease are re-decided, not widened silently."
  - "M1-S20 teaches agents to invoke `coordinator` directly: if agent-authored usage exposes a grammar, authority, or audience gap, reopen DC-1/DC-6 rather than adding implicit behaviours."
  - "A non-coordinator state writer holds the write fence long enough to produce repeated claim-time `coordinator.already-running` refusals: revisit the shared-fence remediation hint and the identity naming rather than widening the claim into a destructive takeover."
  - "M1-S9 dispatch or a queue consumer needs to read or drive coordinator supervision: a shared projection or wake coupling needs its own decision; the coordinator namespace and the distinct budget stay."
  - "The coordinator stops being one long-lived session (for example a per-delivery coordinator): the budget epoch and recovery-ordinal accounting are re-decided."
links:
  related_changes: ["GH-241", "GH-235", "GH-230"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-spec.md"
    - "doc/spec/features/feature-session-lifecycle-economics.md"
    - "doc/spec/features/feature-blockers.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/spec/features/feature-resident-daemon.md"
    - "doc/planning/oss-tooling/cli-command-registry.md"
    - "doc/planning/oss-tooling/milestones/m1/test-scenarios.md"
    - "doc/planning/oss-tooling/milestones/m1/contracts.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/daemon.ts"
    - "packages/core/src/contracts/state.ts"
    - "packages/core/src/contracts/economics.ts"
    - "packages/core/src/contracts/blockers.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/config/catalog.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0008", "ADR-0010", "TDR-0004", "TDR-0005", "TDR-0008", "TDR-0018"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S23", "M1-S18", "M4-S5"]
---

# TDR-0017: Coordinator Supervision Architecture — Separate Supervised Process, Shared Supervisor Regime, Injected Process-Lifecycle Port, Recorded Lifecycle Decisions, Predicate-Bound Wakes

## Context

- **FACT:** `scripts/ceo-loop.sh` (877 lines) is the only coordinator supervisor today. Its context-resume conditional, its stuck heuristic (session-message traffic plus delivery health — not typed artifacts), its TERM/KILL tree teardown, and its restart bound (`MAX_RESTARTS` default `10`, `scripts/ceo-loop.sh:59`) are bash, repository-specific, and unrecorded. Its prompt fixes the coordinator as the merge authority in Mode A (`scripts/ceo-loop.sh:91`). The command registry maps it to `ados daemon` loop driving (M1-S18) plus coordinator-session supervision (M1-S23), and states both are required before the M4-S5 bash retirement (`doc/planning/oss-tooling/cli-command-registry.md` strangler table).
- **FACT:** The delivered harness session port has `spawn`, `deliver`, `resume`, `collect`, `classify`, `liveness`, and `listSessions` — and **no** kill, no process identity, and no OS-process capability (`packages/core/src/contracts/harness.ts:367-379`). The contracts tier does carry the delivered `DaemonProcessPort` (`spawnDetached`, `signal(pid, "SIGTERM" | "SIGINT")`, `isAlive(pid)`; `packages/core/src/contracts/daemon.ts:474-485`); it is the process port this decision reuses, extended additively with `"SIGKILL"` and an optional `startTimeMs` identity capability rather than forked into a second harness process port.
- **FACT:** The delivered restart budget is **per delivery**: `lane.restart-budget` (default `3`) and `lane.liveness-interval` (default `30000` ms) via `ECONOMICS_CONFIG_KEYS`, with `economics.restart` / `economics.budget-exhaustion` records addressed by `economics/<workItemRef>` (`packages/core/src/contracts/economics.ts:56-61,137,145-148`; `packages/core/src/config/defaults.ts:65-66`). The GH-235 feature spec states the surface "classifies, records, and refuses" and "exposes no spawn, kill, steer, restart-execution, or supervision capability" (`doc/spec/features/feature-session-lifecycle-economics.md` §1).
- **FACT:** The delivered M1-S16 pickup predicate is implemented exactly as declared: `isCoordinatorPickup` is true when the head item has `rank === 1`, an absent-or-`open` status, and `audience === "coordinator"` (`packages/core/src/domain/blockers.ts:537-552`), over a ranking that is priority class, then oldest `askedAt`, then id, with contiguous `1..N` ranks assigned before any render cap (`packages/core/src/domain/blockers.ts:490-535`). `decision-needed` is priority class `1` (`packages/core/src/contracts/blockers.ts:53`). The channel documents itself as waking nothing and names M1-S23 as a future applying actor (`doc/spec/features/feature-blockers.md` §Shared ranking, §v0 recorded-versus-applied posture).
- **FACT:** M1-S18 is delivered. The `daemon` family (`start`, `stop`, `status`, `install`, `uninstall`) and the `DaemonSupervisorDescriptor`/`SupervisorPort` seam exist (`packages/core/src/contracts/daemon.ts:256-266,544-575`), and `renderSystemdUnit` writes `ExecStart=<binary> daemon start --foreground` (`packages/core/src/domain/daemon-supervisor.ts:32-41`). Supporting a coordinator unit therefore requires an additive explicit `command` vector in `SupervisorInstallRequest`/`renderSystemdUnit`; coordinator install/uninstall is out of scope for this change. The separate `supervise` family remains reserved for the M2-S2 supervision battery. The M1 contract baseline pins `daemon.heartbeat-cycle` at 60 s, distinct from `lane.liveness-interval` at 30 s (`doc/planning/oss-tooling/milestones/m1/contracts.md:402`).
- **FACT:** State records are additive through declarative artifact boundaries — a record-key prefix plus declared kinds and payload schemas — under the unchanged `delivery.state.v1` (`packages/core/src/contracts/state.ts:289-330`, `STATE_SCHEMA_VERSION` at line 12). No migration is implied by a new boundary.
- **FACT:** The delivered state write fence is non-blocking and age-stale-aware: `acquireFence(token)` returns `state.lock.busy` whenever a lock file exists, stale or not; `fenceStatus()` reports `held`, `stale`, and `token`; and `recoverFence(token)` clears only a held-and-stale lock (`packages/core/src/state/index.ts:604-627,645-674`). A coordinator append therefore needs an explicit stale-lock branch; without one, a dead writer's lock would wedge every append (and the claim) until manual removal.
- **FACT:** Tier purity is a standing architectural rule: the domain tier performs no I/O and reads no ambient environment; adapters own I/O and ports are injected (`doc/decisions/ADR-0003-oss-monorepo-structure.md`; `.ai/rules/typescript.md`).
- **FACT:** SC-M1-25 already pins the coordinator supervision lifecycle (join-or-resume recorded and applied; artifact-evidence stuck detection; kill with grace; restarted within budget; wake within one collection cycle; exhaustion escalates to the owner brief; the `ceo-loop` function map covered) (`doc/planning/oss-tooling/milestones/m1/test-scenarios.md:271`).
- **Why now:** GH-241 is the story that turns SC-M1-25 into a delivered surface, and `ceo-loop.sh` cannot retire while the coordinator is the one actor with no typed lifecycle.

## Problem Framing (Clarified)

Three separable questions hide inside "port the coordinator loop":

1. **Actor and ownership.** Does coordinator lifecycle belong to the daemon, to a delivery lane, or to a supervisor of its own? M1-S18 is now delivered, but the ticket's dependency list names only M1-S15 and M1-S16, so the story must be deliverable without adopting the daemon's installer or preempting its unit definition.
2. **Process boundary.** Where does the ability to kill a process tree, observe liveness, and spawn a session live? The delivered harness port cannot kill and exposes no process identity; putting OS calls in the decision domain would break the tier rule and make the behaviour untestable. Resume stays where it is delivered — in the harness session port — and its absence is a decision input, not a new process capability.
3. **Recorded policy.** Which decisions must be durable, which event consumes a restart ordinal, and what exactly constitutes a wake? Today these are bash conditionals with no record, so the same crash produces different behaviour depending on what survived in memory.

Root cause versus symptom: the bash loop is a **symptom** of an actor with no typed ownership, no durable decision vocabulary, and no process seam. Rewriting bash in TypeScript without fixing those three would reproduce the same failure mode in a new language.

Desired outcomes: every join, resume, spawn, kill, and restart is reproducible from durable state after a crash; a destructive action is never taken on unknown state; the delivered daemon can adopt the same regime instead of forking it; and the decision logic is pure, deterministic, and fake-testable without spawning a real harness. Out of scope: the daemon and its installer, dispatch, prompt changes, lane/queue semantics, and any OS autostart.

## Constraints (Hard Requirements)

### C-1: No daemon command, socket, lane supervision, or OS unit installer; v1 is foreground-only

- **Statement:** The change adds no `daemon` command, no control socket, no lane supervision, and no OS supervisor unit. Installation stays owned by the delivered M1-S18 `SupervisorPort`/`DaemonSupervisorDescriptor`; a coordinator unit would require an additive explicit `command` vector in `SupervisorInstallRequest`/`renderSystemdUnit` (today they hardcode `daemon start --foreground`), and coordinator install/uninstall is out of scope. In v1 the only start shape is `coordinator start --foreground`: a bare `start` is `fallback.invocation` at exit `1` naming `--foreground`, and `detached` or OS-unit hosting is never produced in v1. `start --foreground` runs the declared supervision loop of DC-7, not an undeclared resident process.
- **Source:** AC (GH-241 NG-1, NG-9, NG-11, AC-F1-1, AC-F8-2)
- **Verification:** test (command-registry and unit-surface diff; a test asserts the gap declaration) + code review
- **Negotiable:** no

### C-2: Decision and render paths are pure

- **Statement:** No OS process API, filesystem read, wall clock, randomness, or ambient environment read occurs in the lifecycle, stuck, restart, wake, cycle, or render path; every effect and every fact crosses an injected port or the injected cycle-driver/clock seam.
- **Source:** prior decision (ADR-0003 tier rules) + AC (GH-241 NFR-1, AC-NFR-3)
- **Verification:** test (boundary/dependency check plus injected-fake suites)
- **Negotiable:** no

### C-3: Coordinator records and budget occupy a distinct namespace

- **Statement:** Coordinator state lands under `coordinator/<coordinatorId>` with per-budget-epoch ordinals; `lane.restart-budget`, `lane.liveness-interval`, and `economics/<workItemRef>` are neither read as policy nor written by the supervisor.
- **Source:** AC (GH-241 AC-F5-1, NG-8)
- **Verification:** test (lane and economics records unchanged across a supervisor run)
- **Negotiable:** no

### C-4: Termination is kill-with-grace on the recorded handle only

- **Statement:** The only termination mechanism is TERM → wait `coordinator.kill-grace` → KILL on the recorded session/process-tree handle through the delivered `DaemonProcessPort`, extended additively: `signal` accepts `"SIGKILL"` for the escalation half, and an optional `startTimeMs` capability carries the recorded `pid` plus process start time identity verification before TERM. There is no name- or pattern-based kill, no shell interpolation, and no kill by a process that does not hold the current instance lease. An absent `startTimeMs` capability at kill time is `coordinator.process.capability-gap` at exit `2` and sends no signal; an identity mismatch sends no signal and returns `identity-mismatch`.
- **Source:** AC (GH-241 AC-F4-3, AC-F4-4, NFR-14) + security review (§21 "Kill is a privileged operation")
- **Verification:** test (target-identity controls) + code review
- **Negotiable:** no

### C-5: No CPU signal in the lifecycle or liveness decision path

- **Statement:** Zero CPU reads and zero CPU-derived thresholds exist in the decision path.
- **Source:** AC (GH-241 NFR-2, NG-5)
- **Verification:** test + audit
- **Negotiable:** no

### C-6: Wake eligibility is exactly the delivered pickup predicate

- **Statement:** A wake is issued only when the delivered `isCoordinatorPickup` predicate holds over the verified ranked open set; no second pickup rule, no heuristic wake, and no wake for a non-rank-1, answered, or owner-audience question. An absent question `status` counts as open, matching the delivered predicate, and `no-pickup` applies only when the head is not rank 1, is not coordinator-audience, or is explicitly `answered` (non-open).
- **Source:** prior decision (GH-230, M1-S16 delivered predicate) + AC (GH-241 DEC-9, AC-F7-3)
- **Verification:** code review + test (predicate equivalence)
- **Negotiable:** no

### C-7: State is additive and every failure is classified

- **Statement:** Coordinator records are additive under `delivery.state.v1` with `STATE_SCHEMA_VERSION` unchanged and no migration; every non-zero outcome resolves to one declared error-table identity and exits within `{0,1,2}`.
- **Source:** prior decision (TDR-0005 exit taxonomy; TDR-0004 state engine) + AC (GH-241 DEC-12, NFR-12)
- **Verification:** test (schema and exit-projection matrices)
- **Negotiable:** no

### C-8: The five `ceo-loop.sh` functions each have a typed, durable, test-covered outcome

- **Statement:** Context-resume decision, stuck detection, kill-with-grace, restart budget, and wake-on-question are each traced to at least one passing acceptance criterion; no silent lifecycle or exhaustion path remains.
- **Source:** AC (GH-241 G-8, AC-F10-5, Appendix A function map)
- **Verification:** test (function-map trace) + code review
- **Negotiable:** no

### C-9: Single-instance ownership is an atomic, liveness-first append-only lease

- **Statement:** Coordinator single-instance ownership is a durable `coordinator.fence` instance lease claimed as **one fenced critical section**: acquire the state write fence, re-read the lease fold and the holder's liveness under it, then append exactly one `acquired` or one `stale-takeover` (itself the new acquisition) or refuse, then release. Liveness is decided before lease age: a live holder is refused `coordinator.already-running` regardless of lease age; a dead holder is takeover-eligible; lease age (two `coordinator.collection-interval`s) applies only when the declared alive capability returns no answer for the handle; and an **undeclared** alive capability at claim time is `coordinator.process.capability-gap` at exit `2` with no lease record and no takeover, never a destructive age takeover. Claim-time `state.lock.busy` is resolved by the **claim-acquire stale-fence rule**: read `fenceStatus()`; if `stale === true`, call `recoverFence` exactly once and retry `acquireFence` exactly once; only a still-busy or non-stale result maps to `coordinator.already-running` at exit `2` with no lease record and no append. Non-claim coordinator appends use the same one-shot recovery but map a still-busy fence to the delivered `state.lock.busy`. Two overlapping claims cannot both acquire.
- **Source:** AC (GH-241 AC-F8-1, AC-F8-3, AC-F8-4, AC-F8-5, AC-F8-6, DEC-6, NFR-6)
- **Verification:** test (two-store-handle overlapping-claim race, live-holder-past-age refusal, dead-holder single-record takeover, age fallback only when the declared alive capability returns no answer, claim-time undeclared-alive capability gap) + code review
- **Negotiable:** no

**Table stakes** (every alternative already satisfies them, acknowledged once): the local same-user trust model with no network listener; bounded record and render sizes; one coordinator per state-dir scope.

## Decision Drivers

Ranked; the ordered list is authoritative.

1. **A recorded, deterministic lifecycle** — a crash must converge to the same decision and the same restart count, with the reason inspectable afterwards. This is the driver the bash loop cannot satisfy at all.
2. **Fail-closed on destructive actions** — unknown or torn state must never produce a kill or a restart. The cost asymmetry is stark: a wrong kill destroys a working session, while a delayed kill costs one window.
3. **Strangler reversibility** — additive records, an opt-in command family, no daemon dependency, no migration, and `ceo-loop.sh` untouched until M4-S5.
4. **One supervisor regime, not two** — the descriptor is the handoff the delivered `daemon install` must consume. Two independently invented regimes would be permanently expensive to reconcile and would make the M4-S5 retirement evidence ambiguous.
5. **Purity and testability** — an injected port keeps the decision domain deterministic and fake-testable in CI for both harnesses, including kill-failure and capability-gap paths that cannot be produced reliably with real processes.
6. **Actor-appropriate budget semantics** — the coordinator is one long-lived session; a per-delivery budget resets on the wrong event and conflates two policies.
7. **Operational legibility** — one `coordinator status` must answer "running? decided what? how many restarts remain? stuck? woken? exhausted?" without reading logs.
8. **Implementation cost** — reuse the delivered sourced progress signals, record patterns, instance-lease discipline, and pickup predicate rather than inventing parallel machinery.

## Decision Rights (DACI)

- **Driver:** `@pm` — delegated the change-scoped decisions in autonomous mode to unblock GH-241 specification; `@decision-advisor` analysed and authored this record.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. **Acceptance is pending at the GH-241 PR review**; the record stays `Proposed` with `decision_date: null` until the owner accepts. The kill path and the S18 regime seam are owner-visible consequences, so their acceptance is explicitly human-owned.
- **Contributors:** `@spec-writer` (DEC-1, DEC-3, DEC-6, DEC-7, DEC-9; F-1/F-2/F-4/F-7/F-8); `@decision-advisor` (analysis, record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` during delivery; the human owner at PR review.
- **Performers:** `@coder` (contracts, domain, state, config, adapters, CLI); `@doc-syncer` (phase-7 reconciliation into the coordinator-supervision feature spec and the consumer notes).
- **Informed:** M1-S18 daemon delivery, M1-S9 dispatch, M1-S20 agent integration, M4-S5 bash retirement.
- **Timing and escalation:** recorded during GH-241 specification, before delivery tasks execute; implementation may proceed with acceptance pending (TDR-0003/TDR-0004/TDR-0012 precedent). Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The harness session port exposes no kill, no process identity, and no OS-process capability; the delivered `DaemonProcessPort` provides only `spawnDetached`, `signal(SIGTERM|SIGINT)`, and `isAlive(pid)`, so reuse requires additive `SIGKILL` and `startTimeMs` capabilities. | FACT | `packages/core/src/contracts/harness.ts:367-379`; `packages/core/src/contracts/daemon.ts:474-485` | A new port would be unnecessary and the purity constraint would be satisfiable inside the existing session port; forking a second process port would be over-engineering. | High |
| The delivered state write fence is non-blocking, `fenceStatus()` exposes staleness, and `recoverFence()` clears only a held-and-stale lock, so a claim can perform one stale recovery and retry without a contracts change. | FACT | `packages/core/src/state/index.ts:604-627,645-674` | A claim cannot recover a dead writer's lock and `start`/`tick` would wedge behind `coordinator.already-running` without a manual removal. | High |
| The delivered restart budget is per delivery, keyed `economics/<workItemRef>`, default `3`, with `lane.*` config keys. | FACT | `packages/core/src/contracts/economics.ts:56-61,137,145-148`; `packages/core/src/config/defaults.ts:65-66` | Reusing it would be defensible and C-3 would be wrong; a shared budget would also reset on the wrong event. | High |
| `isCoordinatorPickup` is delivered, payload-determinable, and true only for rank 1 + open + coordinator audience. | FACT | `packages/core/src/domain/blockers.ts:537-552` | A second predicate would be needed, reopening C-6 and the wake rule. | High |
| The shared question ranking assigns contiguous `1..N` ranks over the open set before any render cap. | FACT | `packages/core/src/domain/blockers.ts:490-535` | "Rank 1" could be a render artifact rather than a stable identity, making wake dedupe racy. | High |
| `daemon.heartbeat-cycle` (60 s) and `lane.liveness-interval` (30 s) already exist as distinct keys, so a third distinct coordinator cadence is consistent with the pattern. | FACT | `doc/planning/oss-tooling/milestones/m1/contracts.md:402`; `feature-session-lifecycle-economics.md` §3.1 | A shared cadence would be simpler but couples wake latency to lane tuning. | High |
| The state layer admits new additive record kinds through a declared boundary with no schema bump. | FACT | `packages/core/src/contracts/state.ts:12,289-330` | A schema bump and migration would be required, changing the rollout and rollback story. | High |
| The bash baseline's restart bound is `10` and its resume decision keys off the last session's context size. | FACT | `scripts/ceo-loop.sh:59,341-360,446-470,510-566` | The declared defaults would not mirror the behaviour being replaced, weakening parity claims. | High |
| A harness adapter can resolve a stable session handle and process identity sufficient for alive and kill-with-grace, and can perform resume through the delivered session port. | ASSUMPTION | GH-241 §12; capability ownership is authoritative where it cannot | An unavailable resume selects `spawn-fresh` (no error); an unresolved process identity makes alive/kill a declared gap and the supervisor takes no destructive action (RSK-8). | Medium |
| The foreground supervisor can record its own `pid` and `processStartTimeMs` in the lease, so the holder's identity is recoverable from the latest `coordinator.fence` record after a crash. | ASSUMPTION | GH-241 F-1/F-8; DM-11; state lease discipline | Holder-liveness takeover would degrade to the age fallback for every lease, weakening RSK-7's mitigation. | Medium |
| The delivered `daemon install` can host a foreground supervisor process once `SupervisorInstallRequest`/`renderSystemdUnit` gain an additive explicit `command` vector, and can honour the declared descriptor. | ASSUMPTION | GH-241 G-7/F-8; `packages/core/src/contracts/daemon.ts:544-575`; `packages/core/src/domain/daemon-supervisor.ts:32-41` | The S18 seam is not a seam and a second regime appears at M1-S18 (RSK-4, residual M). | Medium |
| A process-tree TERM/KILL implementation exists for every supported host, including a Windows equivalent. | TO-CONFIRM | GH-241 §8.4, RSK-3; no Windows harness evidence in-repo | Kill fails on that host: classified `coordinator.session.kill-failed` exit 2, never a silent success. | — |
| Both harnesses can source resume and progress facts at the fidelity the corroborator needs. | TO-CONFIRM | GH-241 §8.4, RSK-8; delivered sourced signals exist in the liveness path, not yet for the coordinator tree | An undeclared resume selects `spawn-fresh` (no error, one ordinal); absent progress makes the digest class `unknown` and the verdict leans on the artifact classes (TDR-0018 C-2/C-3); neither becomes a failure identity. | — |

## Mental Models & Techniques Used

- **Inversion ("how do we kill a healthy coordinator?"):** enumerate the paths — stale verdict, torn ordinal read as zero, a second supervisor racing, a name-pattern kill hitting the wrong tree. Each becomes a constraint (C-4, C-5, C-7) or a fail-closed rule (unknown ⇒ no destructive action).
- **Second-order thinking:** shipping a coordinator-specific installer now would make M1-S18 reconcile two unit definitions forever; the descriptor is the cheap invariant that keeps the second-order cost bounded.
- **Systems thinking:** the instance lease, the durable records, and the injected port are one control system — the lease bounds who may act, the records bound what any actor knows, the port bounds what any actor can do.
- **Least mechanism (KISS):** reuse the delivered `DaemonProcessPort` for the three process capabilities (`spawnDetached`, `isAlive`, `signal`) with additive `SIGKILL`/`startTimeMs`, and consume the delivered harness session port for resume and sourced progress, rather than inventing a per-harness kill strategy or a second process port.
- **Opportunity cost:** every hour spent building an OS unit now is an hour not spent on the typed decisions that the ticket actually pins.
- **Real options:** recording the regime descriptor now preserves the option to be hosted by M1-S18 at near-zero carrying cost, without pre-paying for its installer.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 no daemon | C-2 pure | C-3 distinct namespace | C-4 handle-only kill | C-5 no CPU | C-6 exact predicate | C-7 additive+classified | C-8 function coverage | C-9 atomic liveness-first lease |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep `ceo-loop.sh` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| ALT-1 own supervised process + shared regime + injected port (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 build `daemon` + `daemon install` now and host it there | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 model the coordinator as a delivery lane (reuse lane supervisor + economics budget) | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 observe-and-escalate only (no kill, no restart) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken). C-9 is the lease requirement that removes the age-OR takeover ambiguity; it changes no eligibility (ALT-0 already fails C-6/C-8, ALT-2 fails C-1, ALT-3 fails C-3, ALT-4 fails C-8).

### Alternative 0 — Do Nothing (Keep `ceo-loop.sh` as the Coordinator Supervisor)

- **Eligibility:** Not eligible (fails C-6 — the bash loop applies no pickup predicate at all — and C-8 — no typed, durable outcome exists for any of the five functions).
- **Summary:** Leave the bash loop in place; deliver only the daemon later.
- **Constraint compliance:** Fails C-6 and C-8. C-4 passes in substance (group-scoped teardown over recorded PIDs, no shell interpolation) but not as a typed, instance-lease-holding contract — a driver weakness rather than a constraint failure, and noted rather than scored.
- **Driver fit:** Best on D3 (zero change) and D8 (zero build cost); worst on D1, D2, D4, D7.
- **Pros:** No new surface, no new records, no new process kind.
- **Cons:** Every lifecycle action stays unrecorded; a wedged coordinator stays undetected by artifacts; exhaustion stays silent; wake-on-question stays unimplemented; M4-S5 stays blocked.
- **Why rejected:** It fails the story's pinned function-map coverage and leaves the delivery reliability and token-cost problem untouched.

### Alternative 1 — Coordinator Supervision as Its Own Supervised Process over a Shared Regime and an Injected Process-Lifecycle Port (selected)

- **Eligibility:** Eligible (C-1…C-9 all pass).
- **Summary:** A `coordinator` command family with `start --foreground [--fresh-budget]`, `stop`, `status [--live]`, and a bounded `tick`; a state-dir single-instance instance lease carried by append-only `coordinator.fence` records and claimed as one fenced, liveness-first critical section; a declared regime descriptor shared in shape with the delivered `daemon install`; the delivered `DaemonProcessPort` extended additively (`SIGKILL`, optional `startTimeMs` identity) and faked in tests, with harness resume consumed from the delivered harness session port; a declared foreground loop (DC-7); a recorded lifecycle decision; a distinct per-epoch restart budget; and predicate-bound wakes.
- **Constraint compliance:** Passes every constraint; see the attestation.
- **Driver fit:** Best on D1 (durable decision before action), D2 (fail-closed on unknown), D4 (one regime, one seam), D5 (pure + fake-testable), D6 (coordinator-specific epoch budget), D7 (`status` answers the operator's questions).
- **Pros:** Every lifecycle action is inspectable after a crash; the destructive path is capability-declared and handle-scoped; `tick` gives a one-shot, testable, cron-driveable shape; the delivered daemon inherits a descriptor instead of a rival.
- **Cons:** A second process kind exists during M1 without any OS supervision: v1 runs only in the foreground, so the supervisor lives and dies with the operator's terminal session until M1-S18 hosts it, and a bare `start` is a refused invocation rather than a background daemon; the adapter implementation cost tracks harness changes (see residual).
- **Why chosen:** See Decision.

### Alternative 2 — Host Coordinator Supervision Under the Delivered `daemon` + `daemon install`

- **Eligibility:** Not eligible (fails C-1: adding a coordinator unit to the delivered installer is exactly what this change must not do).
- **Summary:** Register coordinator supervision under the now-delivered M1-S18 daemon surface and extend `SupervisorInstallRequest`/`renderSystemdUnit` with a coordinator command.
- **Constraint compliance:** Fails C-1; passes the rest.
- **Driver fit:** Best on D4 by construction (there is only one regime because there is only one process family); worst on D3 (a large, unrequested scope) and D8.
- **Pros:** No interim dual-process period; the OS autostart question is answered once by the delivered installer.
- **Cons:** The story's dependency list names only M1-S15/M1-S16; the coordinator would inherit the daemon's unit, control socket, lane supervision, and startup reconciliation semantics without their acceptance criteria; the delivered installer would need an additive command vector and a second unit identity anyway.
- **Why rejected:** It would preempt and widen the delivered M1-S18 installer, which is the precise failure RSK-4 names.

### Alternative 3 — Model the Coordinator as a Delivery Lane and Reuse the Lane Supervisor and Economics Budget

- **Eligibility:** Not eligible (fails C-3: it reads `lane.restart-budget`/`lane.liveness-interval` as policy and writes `economics/<workItemRef>` for a non-delivery actor).
- **Summary:** Give the coordinator a synthetic lane identity and let the delivered economics budget, liveness signals, and eventually the lane supervisor cover it.
- **Constraint compliance:** Fails C-3; C-6 would be an applied predicate (scored as passing), but the budget and record conflation is disqualifying on its own.
- **Driver fit:** Good on D5 and D8 (maximum reuse); bad on D1 (lane records describe deliveries, not the coordinator's long-lived session) and D6 (the budget resets per delivery, which is the wrong event for a coordinator that outlives deliveries).
- **Pros:** No new record kinds, no new config branch, one budget implementation.
- **Cons:** Conflates two policies and two actors; `economics/<ref>` reads would mix coordinator restarts into per-ticket cost truth; the coordinator would appear as a fake delivery in lane projections that M2-S2 will later supervise.
- **Why rejected:** Distinct semantics require distinct records; the conflation would be permanent and would corrupt the delivered spend and lane read sides.

### Alternative 4 — Observe and Escalate Only (No Kill, No Restart)

- **Eligibility:** Not eligible (fails C-8: kill-with-grace and the restart budget are two of the five functions the story must cover).
- **Summary:** Detect a stuck coordinator, publish the owner question, and let a human intervene; never terminate or restart automatically.
- **Constraint compliance:** Passes C-4 vacuously and the rest; fails C-8.
- **Driver fit:** Excellent on D2 (no destructive action ever), poor on D1 (the stuck state has no bounded recovery), D3 (does not replace the bash function), and the delivery-reliability outcome.
- **Pros:** Zero false-kill risk; the smallest destructive surface.
- **Cons:** Contradicts the pinned ticket AC ("killed with grace ... restarted within budget"); a wedged coordinator burns tokens until a human notices; the bash loop would still be needed, so M4-S5 stays blocked.
- **Why rejected:** It declines the story's central acceptance criterion. Its genuine insight — that killing is the riskiest thing here — is preserved as C-2/C-4/C-5 and as the fail-closed verdict rule in TDR-0018.

## Decision

- **Decision:** **ALT-1.** Coordinator supervision ships as its own supervised process and `coordinator` command family (foreground-only in v1, with `start --foreground` running the declared DC-7 loop), behind a shared supervisor-regime descriptor and a durable instance lease claimed as one fenced, liveness-first critical section over append-only `coordinator.fence` records, over the delivered `DaemonProcessPort` extended additively plus the delivered harness session port for resume, with a recorded lifecycle decision, a distinct per-epoch restart budget, and predicate-bound wakes.
- **Rationale (tied to drivers):** ALT-1 is the only eligible alternative that delivers all five functions (D1, C-8) while keeping the destructive path capability-declared, handle-scoped, and fail-closed (D2, C-4). It is reversible in the strangler sense the project cares about (D3): records are additive, the command is opt-in, no daemon is required, and `ceo-loop.sh` is untouched until M4-S5. It resolves the daemon collision with a descriptor instead of a second installer (D4), which is the cheapest possible way to keep one regime now that M1-S18 is delivered. Purity (D5) is not decoration: it is what makes the kill-failure, capability-gap, torn-ordinal, and stale-lease paths testable in CI. The distinct budget (D6) is forced by semantics — a per-delivery budget resets on the wrong event for an actor that outlives deliveries.
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-241 PR review; not claimed by this record.
- **Conditions for revisit:** See `revisit_triggers`; the load-bearing ones are M1-S18 consuming the descriptor, a harness capability gap, and any false-kill incident.

### DC-1 — Separate supervised process and command family; no `daemon` command

`coordinator start --foreground [--fresh-budget]`, `coordinator stop`, `coordinator status [--live]`, and `coordinator tick` constitute the surface. In v1 the only start shape is `coordinator start --foreground`: a bare `start` is `fallback.invocation` at exit `1` naming that `--foreground` is required in v1 and that detached or OS-unit hosting is the M1-S18 seam, and the supervisor records its own `pid` and `processStartTimeMs` in the lease. `supervisorMode` is exactly `foreground` in v1 (`detached` is a reserved closed value and is never produced in v1); `externalUnit` is exactly `absent`. `start` claims the durable single-instance **instance lease** as one fenced critical section (DC-2), then runs the supervision loop in the foreground (DC-7). `tick` uses the **same claim/takeover path**: with a released or absent lease it appends `acquired`; with a dead holder it appends one `stale-takeover` that is itself the new acquisition; with a live holder it is refused `coordinator.already-running`; it then performs exactly one bounded collection cycle and appends `released`. `released` is attempted in a `finally` for every claimed tick, including non-zero exits; if it cannot land, the failure is disclosed in the tick result (TDR-0018 DC-7). Every `tick` therefore appends exactly one lease pair (`acquired`+`released` or `stale-takeover`+`released`) even when the cycle is otherwise quiet; that pair is expected volume, and NFR-6 idempotency covers action records (restart, stuck, wake, exhaustion), not the per-tick lease pair. The delivered state write fence is **not** held for the process lifetime or the cycle: every **non-claim** append — each `coordinator.fence` record and each coordinator record — uses the per-append helper (`acquireFence`; on `state.lock.busy` with `fenceStatus().stale === true`, one `recoverFence` and one retry; append; `releaseFence`; a still-busy fence returns the delivered `state.lock.busy`), so a separate `stop` process never releases another process's handle and `appendBlockerQuestion` composes because it acquires and releases its own fence. The **claim acquire** is the separate claim-acquire rule in DC-2: it performs the same one-shot stale recovery but maps only a still-busy or non-stale result to `coordinator.already-running`. `stop` is a request, not a remote release: with a held lease it appends `action=stop-requested` and reports `requested=true`, `released=false`; the live supervisor observes the request at the next cycle boundary, stops, and appends `action=released`. When the latest lease is `released`, its holder is not alive, or the declared alive capability returned no answer and the lease age exceeds two `coordinator.collection-interval`s, `stop` appends nothing and reports `not-running` at exit `0`. No `daemon` command, socket, lane supervision, startup reconciliation, or OS unit installer is created.

### DC-2 — Shared supervisor-regime descriptor; the delivered `daemon install` is the M1-S18 seam

The descriptor declares state-dir scope, a single-instance **instance lease** scoped to the state dir, a unit identity derived from the state dir and the coordinator identity, a distinct process kind, a distinct restart-budget store, `supervisorMode` (`foreground` in v1; `detached` is reserved and never produced in v1), and `externalUnit` (`absent`). It is shared **in shape** with the delivered M1-S18 `daemon install` (`DaemonSupervisorDescriptor`/`SupervisorPort`); the daemon's own values are not invented here. Supporting a coordinator unit requires an additive explicit `command` vector in `SupervisorInstallRequest`/`renderSystemdUnit`, which today hardcode `daemon start --foreground`; coordinator install/uninstall is out of scope for this change. Single-instance ownership is a durable **instance lease** carried by append-only `coordinator.fence` records (`acquired`, `released`, `stale-takeover`, `stop-requested`), **not** by holding the delivered state write fence for the process lifetime: that fence is a short-lived per-append lock whose release needs the in-process handle returned by `acquireFence`. The coordinator keeps its ledger lease rather than the delivered `daemon.lock` file lock because it needs durable acquisition, takeover, and stop-request evidence, ledger-sequence folds, and per-iteration claim/release; `daemon.lock` is a heartbeat-age single-instance file lock carrying instance identity, acquisition time, and heartbeat age only, and it remains the daemon's own instance lock. The current lease is folded from the latest record by **ledger sequence**, the primary key for every coordinator fold (lease, stuck, last decision, last wake); `recordedAt` is descriptive only and never the tie-break, except for lease age, which is anchored to the acquisition record's `recordedAt` (the `acquired` or `stale-takeover` record) and is the same quantity as `fenceAgeMs` (TDR-0018 DC-7); there is no heartbeat or lease-refresh record.

Lease liveness is decided **before** lease age, using the process port's `alive(handle)`:

- Latest action `released` → no holder; the lease is claimable and `stop` reports `not-running`.
- Latest action `acquired`, `stale-takeover`, or `stop-requested` with `alive=true` → the lease is **held**: a second `start` or `tick` is refused `coordinator.already-running` at exit `2` **regardless of lease age**, and `stop` appends `action=stop-requested` reporting `requested=true`, `released=false`.
- The same actions with `alive=false` → the lease is **takeover-eligible**: a `start` or `tick` appends exactly one `action=stale-takeover` record that is itself the new acquisition (new `holder`/`pid`/`processStartTimeMs`, `previousHolder`, `fenceAgeMs`), with **no following `acquired` record**. The fold over the four actions is total, so a crash immediately after a takeover leaves a lease that already names the new holder and no ambiguous intermediate state.
- The declared `alive` capability returns **no answer for the handle** (`unknown`) → takeover-eligible only when the lease age exceeds two `coordinator.collection-interval`s; otherwise the lease is treated as held and the claim is refused, so a possibly-live lease is never stolen.
- `alive` capability **undeclared** at claim time → `coordinator.process.capability-gap` at exit `2` with no lease record and no takeover; a missing capability is never resolved by a destructive age takeover.

The claim or takeover is **one fenced critical section**: `acquireFence`, re-read the lease fold and the holder's liveness under the fence, decide, then append one `acquired` or one `stale-takeover` (or append nothing and refuse), then `releaseFence`. Two concurrent claims over two store handles are therefore deterministic: exactly one appends an acquisition and the other is refused `coordinator.already-running`. Claim-time `state.lock.busy` is resolved by the **claim-acquire stale-fence rule**: read `fenceStatus()`; when `stale === true`, call `recoverFence` exactly once and retry `acquireFence` exactly once; if the fence is still busy or was not stale, the claim maps to `coordinator.already-running` at exit `2`, appends no lease record, and names the holder when the lease is readable. The remediation hint discloses the known ambiguity — the state write fence is shared with every other state writer (lane, blocker, and audit appends), so a momentary non-coordinator hold yields the same fail-safe identity; the caller should retry because the lock may be held by another state writer. The supervisor holds no write fence across a cycle.

Each **non-claim** coordinator append, including each lease append, uses the per-append helper: `acquireFence`; on `state.lock.busy` with `fenceStatus().stale === true`, one `recoverFence` and one retry; append; `releaseFence`. If the fence is still busy after that one recovery the delivered `state.lock.busy` identity is returned at exit `2`; a failed append returns the delivered `state.write.failed` identity. The claim acquire is not this rule: it performs the same one-shot stale recovery but maps a still-busy or non-stale result to `coordinator.already-running` (above), so a stale fence can never permanently wedge `start` or `tick`. The **lease decision is independent of state-fence staleness** — the age-stale recovery clears an abandoned append lock for that append and never decides the lease — and no change to `contracts/state.ts` is required. The instance identity for status is folded from the latest lease record: `instanceId`, `pid`, `holder` (pid plus process start time), `startedAt` (the acquisition record time — `acquired` or `stale-takeover`), `supervisorMode` (`foreground` in v1), and `externalUnit` (`absent`); there is no separate instance record. `stop` never releases another process's state write fence handle. OS autostart is an explicit, tested gap naming M1-S18, not an invented installer.

### DC-3 — Delivered `DaemonProcessPort` reused with additive capabilities; harness resume consumed from the session port; four-way capability ownership

The **process port is the delivered `DaemonProcessPort`** (`packages/core/src/contracts/daemon.ts:474-485`), reused rather than forked into a coordinator- or harness-specific process port. It already provides `spawnDetached`, `signal(pid, "SIGTERM" | "SIGINT")`, and `isAlive(pid)`; this decision extends it **additively** (the TDR-0008 precedent) with `"SIGKILL"` in the `signal` union for the kill-with-grace escalation half and an optional `startTimeMs` capability carrying the recorded PID-plus-start-time identity check before TERM. **Harness session resume is consumed from the delivered harness session port**, not redeclared as a process capability. Capability ownership is split four ways and never overloaded:

- **Harness resume** undeclared or unavailable is a **decision input**, not an error: it selects `spawn-fresh` with reason `session-interrupted`, consumes one recovery ordinal, exits `0`, and raises **no error identity**.
- **Harness spawn** impossible or refused reuses the delivered `harness.capability.gap` / `harness.spawn.refused` at exit `1`.
- **Process-port alive** or **kill-with-grace** absent is `coordinator.process.capability-gap` at exit `2`, with no destructive action taken. An `alive` probe that returns **no answer for the handle** is `unknown` (the age fallback in DC-2), not a gap; an absent `startTimeMs` identity capability at kill time is the same capability gap and sends no signal.
- **Progress sourcing** absent is an `unknown` evidence class: never a failure identity, and never by itself a cause to kill.

The contracts tier already owns the port shape; the additive extension lands in the same contracts module and is implemented by adapters beside the delivered daemon and harness session adapters; tests inject a fake. The decision domain stays pure (C-2). Before TERM, the port verifies the recorded `pid` plus `processStartTimeMs` identity through the optional `startTimeMs` capability; its absence is `coordinator.process.capability-gap` at exit `2` with no signal, and a mismatch sends no signal, records `killOutcome=failed` with `killFailureReason=identity-mismatch`, and returns `coordinator.session.kill-failed` at exit `2`, so a reused pid is never signalled. The same port's `isAlive(pid)` is the lease-liveness source for DC-2: liveness is decided first, and lease age is only the fallback when the declared capability returns no answer for the handle. This is the TDR-0008 precedent (additive adapter-contract extensions recorded as a TDR), not the ADR-0008/ADR-0010 precedent of publishing a new primitive port surface.

### DC-4 — The lifecycle decision is recorded before it is applied; only recoveries consume an ordinal

`join-live` (recorded session alive) consumes no ordinal. `resume-context` consumes exactly one. `spawn-fresh` consumes one for the recovery reasons (`context-pressure`, `context-unknown`, `session-interrupted`) and none for `initial-start` or `clean-iteration-end`. The decision, session identity, context reading (or its explicit absence), reason, ordinal consumption, and iteration identity are recorded **before** the action is applied, so a kill mid-flight resumes or respawns per the last recorded decision and closed-out work (phase records, merge records, answers) is never re-executed. The budget is per **budget epoch**, durable across supervisor restarts, reset only by `start --fresh-budget`, and folded from contiguous ordinals starting at `1`; a torn or gapped ordinal is `unevaluable`, never count `0`.

### DC-5 — Context recoverability is fail-closed

Resume requires all of: no live session, a prior session that did not complete cleanly, a **harness session port** that declares and can perform resume, and a *known* context reading below `coordinator.resume-context-limit`. Anything unknown — context at/above the limit, an unreadable or absent reading, or a resume capability that is undeclared or unavailable — produces `spawn-fresh` with a classified reason (`context-pressure`, `context-unknown`, or `session-interrupted`); resume absence raises no error identity. Re-paying prefill is the accepted cost of not resuming into a context that cannot be proven recoverable; the cheaper-by-default choice is the one whose failure mode is known.

### DC-6 — Wake is exactly the delivered pickup predicate, once per question lifetime

On each collection cycle the supervisor performs one verified blocker-ledger read, reuses that read for the `answer` evidence class (TDR-0018), applies the delivered shared ranking, and evaluates `isCoordinatorPickup` strictly: the head of the ranked open set must be `rank: 1`, open (an absent `status` counts as open, matching the delivered predicate), and `audience: coordinator`. On a true predicate with an unwoken question it triggers the next iteration (live wake, resume, or spawn per DC-4/DC-5) and records one wake with the question id, rank, persisted `askedAt`, iteration identity, and outcome. Dedupe is `(coordinatorId, questionId, askedAt)`: one wake per question lifetime. `already-woken` is a no-op; `answered-before-wake` issues nothing; `delivery-failed` is `coordinator.wake.delivery-failed` at exit `2` and the next cycle retries without a duplicate record; `no-pickup` is a tick result, never a record, and applies only when the head is not rank 1, is not coordinator-audience, or is explicitly `answered` (non-open).

### DC-7 — Foreground supervision loop: declared cycle, driver, and exits

`start --foreground` runs a supervision loop whose cycle body is the **claim-free evaluation cycle** — the same cycle body `tick` uses, minus its claim/release — while the supervisor holds the instance lease for its lifetime. The loop:

- appends one acquisition record at loop start (`acquired`, or `stale-takeover` when it takes over a dead holder) and exactly one `released` at loop exit for the supervisor's lifetime; it appends **no per-cycle lease record**;
- waits between cycles through an injected cycle-driver/clock seam (a bounded cancellable wait), with no ambient clock, `setTimeout`, or wall-clock timer in the decision or cycle path (C-2);
- observes a `stop-requested` at the cycle boundary and then exits;
- declares its exits: a stop request exits `0` after `released`; a fatal cycle error exits with its typed `{0,1,2}` error identity, attempting `released` in a `finally`; SIGINT/SIGTERM exits gracefully and attempts `released`, with the declared exit `0` after a successful release and `2` with the `released` append-failure identity when it cannot land.

A bare `start` remains `fallback.invocation` at exit `1` naming `--foreground`. The loop is not a resident scheduler: it ticks at `coordinator.collection-interval`, so NFR-8/NFR-9 are asserted on the next cycle. The cycle driver is a test seam: a fake driver advances exactly N cycles in-process, which is how the supervisor's cycle is driven without a second process.

### Constraint Compliance Attestation

The chosen alternative satisfies every constraint. C-1: no `daemon` command, socket, lane supervision, or installer is added; installation stays owned by the delivered M1-S18 `SupervisorPort`/`DaemonSupervisorDescriptor`, coordinator install/uninstall is out of scope, and a coordinator unit needs an additive explicit `command` vector; v1 ships only `coordinator start --foreground`, a bare `start` is `fallback.invocation` at exit `1`, that start runs the declared DC-7 loop, and the OS-hosting gap is declared and tested (AC-F1-1, AC-F8-2). C-2: every effect and fact crosses an injected port or the injected cycle-driver/clock seam; the domain reads no clock, filesystem, OS process API, or ambient environment (NFR-1, AC-NFR-3). C-3: coordinator state lives under `coordinator/<coordinatorId>` with per-epoch ordinals; lane and economics records are unchanged (AC-F5-1). C-4: termination is TERM → grace → KILL on the recorded handle through the delivered `DaemonProcessPort`, extended additively with `SIGKILL` and the optional `startTimeMs` identity capability, performed only by the current instance-lease holder, after verifying pid + process start time; an absent identity capability is `coordinator.process.capability-gap` with no signal (AC-F4-3, AC-F4-4, NFR-14). C-5: no CPU read exists in the path (NFR-2). C-6: wake eligibility is the delivered predicate, unmodified, with an absent status counting as open and `no-pickup` only for a non-rank-1, non-coordinator, or explicitly answered head (DEC-9, AC-F7-3). C-7: records are additive under the unchanged schema and every non-zero outcome is a declared error identity in the `{0,1,2}` projection (DEC-12, NFR-12). C-8: all five functions map to acceptance criteria (AC-F10-5, Appendix A). C-9: the lease is claimed as one fenced critical section, a live holder is refused regardless of lease age, a dead holder is taken over with one `stale-takeover` that is itself the acquisition, age applies only when the declared alive capability returns no answer for the handle, an undeclared alive capability at claim time is `coordinator.process.capability-gap`, and claim-time `state.lock.busy` performs one stale recovery before any `coordinator.already-running` refusal (AC-F8-1, AC-F8-3, AC-F8-4, AC-F8-5, AC-F8-6). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- Every join, resume, spawn, kill, and restart is reproducible from durable state after a supervisor crash — the failure mode that makes the bash loop unauditable disappears.
- The destructive path becomes the most constrained path in the change: a declared capability split, a recorded handle, a durable instance lease, pid-plus-start-time identity verification, and a fail-closed verdict.
- `coordinator tick` provides the bounded one-shot surface that both tests and a future cron-like or unit caller need, without starting a background loop.
- Single-instance ownership is decided on liveness rather than timestamps: a live supervisor is never stolen because its lease aged, and a crashed supervisor never blocks the one-shot surface behind its dead lease.
- Two overlapping claims cannot both acquire: the claim is one fenced critical section that re-reads the fold under the fence, so exactly one wins and the other receives a named refusal.
- The delivered daemon inherits a descriptor instead of a rival: M1-S18 consumes state-dir scope, instance lease, unit identity, process kind, and budget store rather than re-deciding them; a coordinator unit is a later additive `command` vector.
- Restart policy becomes actor-appropriate: coordinator recoveries are counted per epoch, lane restarts stay per delivery, and per-ticket cost truth is not polluted.
- Wake becomes enforceable rather than declared: the delivered predicate is consumed exactly, with one wake per question and consumption evidence (the answer record).
- Operator legibility improves to a single command: `coordinator status` answers running, decision, restarts, stuck, wake, and escalation state.

### Negative Outcomes

- A second process kind exists during M1 without OS supervision: v1 is foreground-only, so the supervisor lives and dies with the operator's terminal session until the delivered M1-S18 installer gains a coordinator unit command, and a bare `start` is a refused invocation rather than a background daemon.
- The adapter tier takes on a new capability surface that must be kept aligned with harness changes; the maintenance cost is ongoing and real.
- The coordinator cadence is a third timing key (`coordinator.collection-interval`) beside `daemon.heartbeat-cycle` and `lane.liveness-interval`; the distinctness is deliberate, but it is one more knob to reason about.
- Every tick appends one lease pair even when nothing else happens, so an idle one-shot caller grows the log by two records per cycle; the pair is bounded and carries no action semantics, but it is real volume.
- Foreground-only v1 deliberately claims no OS-level supervision, and `detached` stays a reserved, never-produced value, so no output promises a coordinator unit before the M1-S18 installer gains one.

### Unresolved Questions

- [ ] Windows process-tree termination behind the port is unproven; the capability declaration and the `kill-failed` path bound the damage, but the host matrix is `TO-CONFIRM` (owner: `@coder`, verified at delivery).
- [ ] Session-handle-to-process-identity resolution for each harness is an assumption until the adapter work lands; a harness that cannot resolve it takes no destructive action, and an unresolvable resume selects `spawn-fresh` (owner: `@coder`).
- [ ] The delivered M1-S18 `SupervisorPort` does not yet accept an explicit `command` vector, so a user-level unit cannot host the foreground coordinator shape; a coordinator unit is a declared follow-up, not part of this change (owner: `@pm` for the M1-S18 follow-up).
- [ ] The `daemon` value set (heartbeat cycle, unit naming) is deliberately not invented here; M1-S18 fills the descriptor's daemon-side values (owner: M1-S18).

## Implementation Plan

1. **Contracts tier.** Declare the coordinator vocabulary (lifecycle decisions, decision reasons, restart reasons, wake outcomes, kill outcomes, escalation states, config keys, error identities) as `as const` data, and extend the delivered `DaemonProcessPort` additively: `"SIGKILL"` in the `signal` union and an optional `startTimeMs` identity capability, with the capability declaration (harness resume is consumed from the delivered session port, not redeclared). No behaviour.
2. **Domain tier.** Implement the pure decisions: context recoverability, lifecycle decision, restart admission, wake evaluation, escalation projection, and the status projection. Every input injected; no ambient reads.
3. **State tier.** Declare one `coordinator/` artifact boundary with the six additive kinds (iteration, restart, two-phase stuck, exhaustion, wake, and the `coordinator.fence` instance lease) and their payload schemas; validate kinds, vocabularies, and ordinal contiguity before serving; treat torn/unknown as `unevaluable`; fold every coordinator record set by ledger sequence (`recordedAt` is descriptive only), with the four-action lease fold total over `acquired`, `released`, `stale-takeover`, and `stop-requested`.
4. **Config tier.** Add the `coordinator` branch with `stuck-window`, `kill-grace`, `restart-budget`, `resume-context-limit`, `collection-interval`, and `progress-bound`, with declared defaults as policy data and no bound or default literal in the decision code.
5. **Adapter tier.** Implement the additive `DaemonProcessPort` capabilities beside the delivered daemon and harness session adapters, resolving session handle and process identity per harness; declare every capability gap explicitly under the four-way split; verify pid + process start time through `startTimeMs` before TERM and use `SIGKILL` only in the grace-escalation half.
6. **CLI tier.** Register the `coordinator` family and implement `start --foreground` (a bare `start` is `fallback.invocation` at exit `1`), `stop`, `status`, and `tick` over the shared atomic claim/takeover path, the `delivery.coordinator.v1` `data` shape, deterministic text output, and the `{0,1,2}` projection through the shared error table. `start --foreground` runs the DC-7 loop with the injected cycle driver and one lifetime acquisition/release pair; `tick` attempts `released` in a `finally` for every claimed tick. `stop` appends a `stop-requested` lease record and never releases another process's handle. Non-claim appends go through the per-append state-fence helper with one age-stale `recoverFence` retry and a still-busy `state.lock.busy`; the claim acquire uses the separate claim-acquire rule (one stale recovery, then still-busy/non-stale → `coordinator.already-running`).
7. **Tests.** Fake the port and cover: each decision kind, ordinal accounting, torn/gapped ordinals, instance-lease contention, stop-request, liveness-first refusal of a live holder past two collection intervals, dead-holder takeover with one `stale-takeover` and no second `acquired`, age-fallback takeover only when the declared alive capability returns no answer, claim-time undeclared alive capability → `coordinator.process.capability-gap` with zero lease records, two overlapping claims over two store handles, tick recovery of a dead holder, claim-time stale-fence one recovery + retry success, claim-time still-busy/non-stale → `already-running` with zero lease records, non-claim still-busy → `state.lock.busy`, per-append stale-lock recovery, exactly one lease pair per tick (including a non-zero-exit tick with `released` attempted in a `finally`), the foreground loop over N injected cycles appending exactly one lifetime acquisition/release pair and observing a stop request at the cycle boundary, loop fatal-error and signal exits with `released` attempted, kill terminated/forced/failed including `identity-mismatch` and `SIGKILL` escalation, capability gaps, idempotent re-runs, and the SC-M1-25 reconciliation in Appendix C of the change spec.
8. **Documentation.** Reconcile the new coordinator-supervision feature spec, the economics consumer/boundary note, the harness-adapter port note, the CLI registry and man-page pack, and the decision index.

## Verification Criteria

- Metric: lifecycle actions (join, resume, spawn, kill, restart) carrying a durable decision record — Target: 100% — Window: GH-241 delivery and the first supervised releases.
- Metric: `ceo-loop.sh` function-map coverage by passing acceptance criteria — Target: 5 of 5 — Window: GH-241 test run (AC-F10-5).
- Metric: CPU reads or CPU-derived thresholds in the decision path — Target: 0 — Window: GH-241 audit and review.
- Metric: restart-budget durability across a supervisor crash — Target: 100% with no duplicate or replayed ordinal — Window: GH-241 fault-injection suites.
- Metric: wake latency after a question becomes rank 1, open, coordinator-audience — Target: ≤ one `coordinator.collection-interval` — Window: delivery suite plus first supervised operation.
- Metric: concurrent supervisors on one state dir — Target: 0, including two overlapping claims over two store handles (exactly one acquisition; the other `coordinator.already-running` at exit `2`) — Window: delivery suite.
- Metric: lease takeover decisions — Target: 0 takeovers of a live holder at any lease age, and 0 one-shot ticks blocked behind a dead holder's lease — Window: lease state-fold suite.
- Metric: lease records per tick — Target: exactly one pair (`acquired`+`released`, or `stale-takeover`+`released`) on quiet and non-zero-exit cycles, with `released` attempted in a `finally` — Window: quiet-cycle and failure-path suites.
- Metric: claim-time state-fence handling — Target: a stale fence performs exactly one `recoverFence` + one retry and then claims; a still-busy or non-stale fence refuses `coordinator.already-running` with 0 lease records and 0 appends; a non-claim still-busy fence returns `state.lock.busy` — Window: fence-contention suite.
- Metric: claim-time liveness capability — Target: 0 age takeovers when the alive capability is undeclared (that path is `coordinator.process.capability-gap` with 0 lease records); age fallback only when a declared probe returns no answer — Window: capability and lease suites.
- Metric: foreground supervisor lifetime lease records — Target: exactly one acquisition record (`acquired` or `stale-takeover`) and one `released`, 0 per-cycle lease records, with stop/fatal/signal exits declared — Window: foreground-loop suite.
- Metric: `coordinator tick` / `coordinator status` p95 — Target: ≤ 2 000 ms / ≤ 1 000 ms over the reference state store — Window: delivery performance suite.
- Process checkpoints: the first retrospective after GH-241 implementation sets `review_date`; the S18 handoff is verified when M1-S18 gains a coordinator `command` vector and consumes the descriptor.

## Confidence Rating

**Medium-high.** The evidence base is unusually strong because most of it is delivered code read directly: the harness port's missing kill, the per-delivery budget keys and record kinds, the pickup predicate and its ranking, the additive state boundary, and the bash baseline that is being replaced. What remains genuinely uncertain is empirical rather than analytical: per-harness process identity and resume fidelity, Windows process-tree termination, and whether the delivered daemon can consume the descriptor once its install request gains an explicit command vector. Those are recorded as assumptions and `TO-CONFIRM` items with fail-closed consequences rather than assumed away. AI-generated confidence is not evidence; the owner's acceptance at PR review is the authoritative signal.

## References

- Change spec: `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-spec.md` — DEC-1, DEC-3, DEC-6, DEC-7, DEC-9, DEC-10, DEC-11; §5.1 F-1/F-2/F-4/F-7/F-8/F-10; §8.2 EVT-1/EVT-2/EVT-5/EVT-7; §8.3 DM-11; §17.1–17.5, §17.7–17.10; Appendix A (function map), Appendix D (config defaults), Appendix E (record shapes), Appendix F (exit matrix).
- Delivered session lifecycle economics: `doc/spec/features/feature-session-lifecycle-economics.md` — sourced progress signals and the per-delivery budget that this decision deliberately does not reuse.
- Delivered blocker channel: `doc/spec/features/feature-blockers.md` — ranking, audiences, `isCoordinatorPickup`, and the statement that M1-S23 is the future applying actor.
- Delivered harness adapters: `doc/spec/features/feature-harness-adapters.md` — the session port this decision extends beside, never inside.
- Command registry and strangler table: `doc/planning/oss-tooling/cli-command-registry.md` — the `daemon` (M1-S18) and `supervise` (M2-S2) rows and the `ceo-loop.sh` handover.
- Seed scenario: `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` SC-M1-25; timing baseline `doc/planning/oss-tooling/milestones/m1/contracts.md` (`daemon.heartbeat-cycle` 60 s).
- Contracts read: `packages/core/src/contracts/harness.ts`, `packages/core/src/contracts/daemon.ts` (`DaemonProcessPort`, `DaemonSupervisorDescriptor`, `SupervisorInstallRequest`, `SupervisorPort`), `packages/core/src/contracts/state.ts`, `packages/core/src/contracts/economics.ts`, `packages/core/src/contracts/blockers.ts`, `packages/core/src/contracts/error-table.ts`, `packages/core/src/config/catalog.ts`, `packages/core/src/config/defaults.ts`; delivered state fence and daemon lock in `packages/core/src/state/index.ts` and `packages/core/src/state/daemon-lock.ts`; delivered unit renderer in `packages/core/src/domain/daemon-supervisor.ts`.
- Delivered resident daemon: `doc/spec/features/feature-resident-daemon.md` — the `daemon.lock` heartbeat-age single-instance lock that remains the daemon's own, and the `SupervisorPort` install seam this record leaves untouched.
- Bash baseline being replaced: `scripts/ceo-loop.sh`.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier purity and runtime confinement; [ADR-0008](ADR-0008-harness-adapter-contract.md) — harness provider domain and session lifecycle; [ADR-0010](ADR-0010-session-admin-port-mutating-contract.md) — the mutating-port precedent this decision does not extend.
- [TDR-0004](TDR-0004-state-storage-engine.md) — additive record kinds, fences, and torn-store classification; [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the `{0,1,2}` projection and the closed error table; [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive adapter-contract extensions recorded as a TDR.
- [TDR-0018](TDR-0018-coordinator-artifact-evidence-and-brief-escalation.md) — the stuck-evidence rule and the owner-brief escalation that this architecture carries.
