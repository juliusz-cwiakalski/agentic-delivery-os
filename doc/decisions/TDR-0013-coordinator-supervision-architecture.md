---
id: TDR-0013
decision_type: tdr
status: Proposed
created: 2026-11-07
decision_date: null
last_updated: 2026-11-07
summary: "Coordinator supervision ships as its own supervised process and a `coordinator` command family (start/stop/status/tick) instead of a `daemon` command: the supervisor holds a state-dir single-instance fence and declares the supervisor-regime descriptor shape the future `daemon install` (M1-S18) must consume, with OS autostart an explicitly tested gap; every process effect crosses a new injected process/session-lifecycle port (spawn, resume, alive, kill-with-grace, sourced progress, capability declaration) implemented in adapters and faked in tests so the decision domain stays pure; each join-live/resume-context/spawn-fresh decision is recorded before it is applied and only recoveries consume a restart ordinal in a distinct per-epoch coordinator budget; and wake is strictly the delivered isCoordinatorPickup predicate with one wake per question lifetime deduped on coordinator id + question id + askedAt."
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
    - "M1-S18 resident dispatch daemon (must consume the regime descriptor, not fork it)"
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
  - "M1-S18 delivers `daemon install`: it must consume this regime descriptor (state-dir scope, fence, unit identity, process kind, budget store) rather than define a second one. If its unit or fence shape cannot consume the descriptor, reopen DC-2 here instead of forking a regime."
  - "A harness cannot expose a stable session handle, resume, or sourced progress, or a supported host cannot kill a process tree (for example Windows without a tree equivalent): reopen DC-3's capability model rather than adding a harness-specific branch in the decision domain."
  - "A `stuck` verdict terminates a session that was in fact progressing (false-kill incident): the kill path here and the verdict rule in TDR-0014 are reopened together; the corroborator is strengthened before the kill budget is loosened."
  - "Two coordinators, a second coordinator per state dir, or multi-host supervision is needed: the state-dir scope and the single-instance fence are re-decided, not widened silently."
  - "M1-S20 teaches agents to invoke `coordinator` directly: if agent-authored usage exposes a grammar, authority, or audience gap, reopen DC-1/DC-6 rather than adding implicit behaviours."
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
    - "doc/planning/oss-tooling/cli-command-registry.md"
    - "doc/planning/oss-tooling/milestones/m1/test-scenarios.md"
    - "doc/planning/oss-tooling/milestones/m1/contracts.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/state.ts"
    - "packages/core/src/contracts/economics.ts"
    - "packages/core/src/contracts/blockers.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/config/catalog.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0008", "ADR-0010", "TDR-0004", "TDR-0005", "TDR-0008", "TDR-0014"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S23", "M1-S18", "M4-S5"]
---

# TDR-0013: Coordinator Supervision Architecture — Separate Supervised Process, Shared Supervisor Regime, Injected Process-Lifecycle Port, Recorded Lifecycle Decisions, Predicate-Bound Wakes

## Context

- **FACT:** `scripts/ceo-loop.sh` (877 lines) is the only coordinator supervisor today. Its context-resume conditional, its stuck heuristic (session-message traffic plus delivery health — not typed artifacts), its TERM/KILL tree teardown, and its restart bound (`MAX_RESTARTS` default `10`, `scripts/ceo-loop.sh:59`) are bash, repository-specific, and unrecorded. Its prompt fixes the coordinator as the merge authority in Mode A (`scripts/ceo-loop.sh:91`). The command registry maps it to `ados daemon` loop driving (M1-S18) plus coordinator-session supervision (M1-S23), and states both are required before the M4-S5 bash retirement (`doc/planning/oss-tooling/cli-command-registry.md` strangler table).
- **FACT:** The delivered harness session port has `spawn`, `deliver`, `resume`, `collect`, `classify`, `liveness`, and `listSessions` — and **no** kill, no process identity, and no OS-process capability (`packages/core/src/contracts/harness.ts:367-379`). No OS-process port exists in the contracts tier.
- **FACT:** The delivered restart budget is **per delivery**: `lane.restart-budget` (default `3`) and `lane.liveness-interval` (default `30000` ms) via `ECONOMICS_CONFIG_KEYS`, with `economics.restart` / `economics.budget-exhaustion` records addressed by `economics/<workItemRef>` (`packages/core/src/contracts/economics.ts:56-61,137,145-148`; `packages/core/src/config/defaults.ts:65-66`). The GH-235 feature spec states the surface "classifies, records, and refuses" and "exposes no spawn, kill, steer, restart-execution, or supervision capability" (`doc/spec/features/feature-session-lifecycle-economics.md` §1).
- **FACT:** The delivered M1-S16 pickup predicate is implemented exactly as declared: `isCoordinatorPickup` is true when the head item has `rank === 1`, an absent-or-`open` status, and `audience === "coordinator"` (`packages/core/src/domain/blockers.ts:537-552`), over a ranking that is priority class, then oldest `askedAt`, then id, with contiguous `1..N` ranks assigned before any render cap (`packages/core/src/domain/blockers.ts:490-535`). `decision-needed` is priority class `1` (`packages/core/src/contracts/blockers.ts:53`). The channel documents itself as waking nothing and names M1-S23 as a future applying actor (`doc/spec/features/feature-blockers.md` §Shared ranking, §v0 recorded-versus-applied posture).
- **FACT:** M1-S18 is not delivered. The registry already reserves the `daemon` family (`start`, `stop`, `status`, `install`, `uninstall`) and the separate `supervise` family for the M2-S2 supervision battery; the registry's own disambiguation is "watchdog checks, daemon runs the loop, supervise runs the watch". The M1 contract baseline pins `daemon.heartbeat-cycle` at 60 s, distinct from `lane.liveness-interval` at 30 s (`doc/planning/oss-tooling/milestones/m1/contracts.md:402`).
- **FACT:** State records are additive through declarative artifact boundaries — a record-key prefix plus declared kinds and payload schemas — under the unchanged `delivery.state.v1` (`packages/core/src/contracts/state.ts:289-330`, `STATE_SCHEMA_VERSION` at line 12). No migration is implied by a new boundary.
- **FACT:** Tier purity is a standing architectural rule: the domain tier performs no I/O and reads no ambient environment; adapters own I/O and ports are injected (`doc/decisions/ADR-0003-oss-monorepo-structure.md`; `.ai/rules/typescript.md`).
- **FACT:** SC-M1-25 already pins the coordinator supervision lifecycle (join-or-resume recorded and applied; artifact-evidence stuck detection; kill with grace; restarted within budget; wake within one collection cycle; exhaustion escalates to the owner brief; the `ceo-loop` function map covered) (`doc/planning/oss-tooling/milestones/m1/test-scenarios.md:271`).
- **Why now:** GH-241 is the story that turns SC-M1-25 into a delivered surface, and `ceo-loop.sh` cannot retire while the coordinator is the one actor with no typed lifecycle.

## Problem Framing (Clarified)

Three separable questions hide inside "port the coordinator loop":

1. **Actor and ownership.** Does coordinator lifecycle belong to the future daemon, to a delivery lane, or to a supervisor of its own? M1-S18 does not exist, and the ticket's dependency list names only M1-S15 and M1-S16, so the story must be deliverable without it.
2. **Process boundary.** Where does the ability to kill a process tree, observe liveness, and resume a session live? The delivered harness port cannot kill and exposes no process identity; putting OS calls in the decision domain would break the tier rule and make the behaviour untestable.
3. **Recorded policy.** Which decisions must be durable, which event consumes a restart ordinal, and what exactly constitutes a wake? Today these are bash conditionals with no record, so the same crash produces different behaviour depending on what survived in memory.

Root cause versus symptom: the bash loop is a **symptom** of an actor with no typed ownership, no durable decision vocabulary, and no process seam. Rewriting bash in TypeScript without fixing those three would reproduce the same failure mode in a new language.

Desired outcomes: every join, resume, spawn, kill, and restart is reproducible from durable state after a crash; a destructive action is never taken on unknown state; the future daemon can adopt the same regime instead of forking it; and the decision logic is pure, deterministic, and fake-testable without spawning a real harness. Out of scope: the daemon and its installer, dispatch, prompt changes, lane/queue semantics, and any OS autostart.

## Constraints (Hard Requirements)

### C-1: No daemon command, socket, lane supervision, or OS unit installer in this change

- **Statement:** The change adds no `daemon` command, no control socket, no lane supervision, and no OS supervisor unit; the `daemon install` wiring is declared as the M1-S18 seam only, and OS autostart is a declared, tested gap naming M1-S18.
- **Source:** AC (GH-241 NG-1, NG-9, AC-F8-2)
- **Verification:** test (command-registry and unit-surface diff; a test asserts the gap declaration) + code review
- **Negotiable:** no

### C-2: Decision and render paths are pure

- **Statement:** No OS process API, filesystem read, wall clock, randomness, or ambient environment read occurs in the lifecycle, stuck, restart, wake, or render path; every effect and every fact crosses an injected port.
- **Source:** prior decision (ADR-0003 tier rules) + AC (GH-241 NFR-1, AC-NFR-3)
- **Verification:** test (boundary/dependency check plus injected-fake suites)
- **Negotiable:** no

### C-3: Coordinator records and budget occupy a distinct namespace

- **Statement:** Coordinator state lands under `coordinator/<coordinatorId>` with per-budget-epoch ordinals; `lane.restart-budget`, `lane.liveness-interval`, and `economics/<workItemRef>` are neither read as policy nor written by the supervisor.
- **Source:** AC (GH-241 AC-F5-1, NG-8)
- **Verification:** test (lane and economics records unchanged across a supervisor run)
- **Negotiable:** no

### C-4: Termination is kill-with-grace on the recorded handle only

- **Statement:** The only termination mechanism is TERM → wait `coordinator.kill-grace` → KILL on the recorded session/process-tree handle; there is no name- or pattern-based kill, no shell interpolation, and no kill by a process that does not hold the state-dir fence.
- **Source:** AC (GH-241 AC-F4-3, NFR-14) + security review (§21 "Kill is a privileged operation")
- **Verification:** test (target-identity controls) + code review
- **Negotiable:** no

### C-5: No CPU signal in the lifecycle or liveness decision path

- **Statement:** Zero CPU reads and zero CPU-derived thresholds exist in the decision path.
- **Source:** AC (GH-241 NFR-2, NG-5)
- **Verification:** test + audit
- **Negotiable:** no

### C-6: Wake eligibility is exactly the delivered pickup predicate

- **Statement:** A wake is issued only when the delivered `isCoordinatorPickup` predicate holds over the verified ranked open set; no second pickup rule, no heuristic wake, and no wake for a non-rank-1, answered, or owner-audience question.
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

**Table stakes** (every alternative already satisfies them, acknowledged once): the local same-user trust model with no network listener; bounded record and render sizes; one coordinator per state-dir scope.

## Decision Drivers

Ranked; the ordered list is authoritative.

1. **A recorded, deterministic lifecycle** — a crash must converge to the same decision and the same restart count, with the reason inspectable afterwards. This is the driver the bash loop cannot satisfy at all.
2. **Fail-closed on destructive actions** — unknown or torn state must never produce a kill or a restart. The cost asymmetry is stark: a wrong kill destroys a working session, while a delayed kill costs one window.
3. **Strangler reversibility** — additive records, an opt-in command family, no daemon dependency, no migration, and `ceo-loop.sh` untouched until M4-S5.
4. **One supervisor regime, not two** — the descriptor is the handoff the future `daemon install` must consume. Two independently invented regimes would be permanently expensive to reconcile and would make the M4-S5 retirement evidence ambiguous.
5. **Purity and testability** — an injected port keeps the decision domain deterministic and fake-testable in CI for both harnesses, including kill-failure and capability-gap paths that cannot be produced reliably with real processes.
6. **Actor-appropriate budget semantics** — the coordinator is one long-lived session; a per-delivery budget resets on the wrong event and conflates two policies.
7. **Operational legibility** — one `coordinator status` must answer "running? decided what? how many restarts remain? stuck? woken? exhausted?" without reading logs.
8. **Implementation cost** — reuse the delivered sourced progress signals, record patterns, fence discipline, and pickup predicate rather than inventing parallel machinery.

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
| The harness session port exposes no kill, no process identity, and no OS-process capability; no OS-process port exists in contracts. | FACT | `packages/core/src/contracts/harness.ts:367-379` | A new port would be unnecessary and the purity constraint would be satisfiable inside the existing session port; DC-3's extra surface would be over-engineering. | High |
| The delivered restart budget is per delivery, keyed `economics/<workItemRef>`, default `3`, with `lane.*` config keys. | FACT | `packages/core/src/contracts/economics.ts:56-61,137,145-148`; `packages/core/src/config/defaults.ts:65-66` | Reusing it would be defensible and C-3 would be wrong; a shared budget would also reset on the wrong event. | High |
| `isCoordinatorPickup` is delivered, payload-determinable, and true only for rank 1 + open + coordinator audience. | FACT | `packages/core/src/domain/blockers.ts:537-552` | A second predicate would be needed, reopening C-6 and the wake rule. | High |
| The shared question ranking assigns contiguous `1..N` ranks over the open set before any render cap. | FACT | `packages/core/src/domain/blockers.ts:490-535` | "Rank 1" could be a render artifact rather than a stable identity, making wake dedupe racy. | High |
| `daemon.heartbeat-cycle` (60 s) and `lane.liveness-interval` (30 s) already exist as distinct keys, so a third distinct coordinator cadence is consistent with the pattern. | FACT | `doc/planning/oss-tooling/milestones/m1/contracts.md:402`; `feature-session-lifecycle-economics.md` §3.1 | A shared cadence would be simpler but couples wake latency to lane tuning. | High |
| The state layer admits new additive record kinds through a declared boundary with no schema bump. | FACT | `packages/core/src/contracts/state.ts:12,289-330` | A schema bump and migration would be required, changing the rollout and rollback story. | High |
| The bash baseline's restart bound is `10` and its resume decision keys off the last session's context size. | FACT | `scripts/ceo-loop.sh:59,341-360,446-470,510-566` | The declared defaults would not mirror the behaviour being replaced, weakening parity claims. | High |
| A harness adapter can resolve a stable session handle and process identity sufficient for alive, resume, and kill-with-grace. | ASSUMPTION | GH-241 §12; capability declarations are authoritative where it cannot | The capability is a declared gap and the supervisor takes no destructive action; the kill path becomes unusable on that harness (RSK-8). | Medium |
| A detached `start` process identity is recoverable from a durable instance record after a supervisor crash, so the fence holder can be identified. | ASSUMPTION | GH-241 F-1/F-8; state fence discipline | Stale-fence takeover would rely on the age bound alone, weakening RSK-7's mitigation. | Medium |
| The future `daemon install` can host a foreground supervisor process and honour the declared descriptor. | ASSUMPTION | GH-241 G-7/F-8; registry `daemon` row | The S18 seam is not a seam and a second regime appears at M1-S18 (RSK-4, residual M). | Medium |
| A process-tree TERM/KILL implementation exists for every supported host, including a Windows equivalent. | TO-CONFIRM | GH-241 §8.4, RSK-3; no Windows harness evidence in-repo | Kill fails on that host: classified `coordinator.session.kill-failed` exit 2, never a silent success. | — |
| Both harnesses can source resume and progress facts at the fidelity the corroborator needs. | TO-CONFIRM | GH-241 §8.4, RSK-8; delivered sourced signals exist in the liveness path, not yet for the coordinator tree | The corroborator degrades to absent, and the verdict then leans on the artifact classes (TDR-0014 C-2). | — |

## Mental Models & Techniques Used

- **Inversion ("how do we kill a healthy coordinator?"):** enumerate the paths — stale verdict, torn ordinal read as zero, a second supervisor racing, a name-pattern kill hitting the wrong tree. Each becomes a constraint (C-4, C-5, C-7) or a fail-closed rule (unknown ⇒ no destructive action).
- **Second-order thinking:** shipping a coordinator-specific installer now would make M1-S18 reconcile two unit definitions forever; the descriptor is the cheap invariant that keeps the second-order cost bounded.
- **Systems thinking:** the fence, the durable records, and the injected port are one control system — the fence bounds who may act, the records bound what any actor knows, the port bounds what any actor can do.
- **Least mechanism (KISS):** one port with five declared capabilities and one explicit capability-gap outcome beats a per-harness kill strategy in the domain.
- **Opportunity cost:** every hour spent building an OS unit now is an hour not spent on the typed decisions that the ticket actually pins.
- **Real options:** recording the regime descriptor now preserves the option to be hosted by M1-S18 at near-zero carrying cost, without pre-paying for its installer.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 no daemon | C-2 pure | C-3 distinct namespace | C-4 handle-only kill | C-5 no CPU | C-6 exact predicate | C-7 additive+classified | C-8 function coverage |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep `ceo-loop.sh` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ALT-1 own supervised process + shared regime + injected port (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 build `daemon` + `daemon install` now and host it there | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 model the coordinator as a delivery lane (reuse lane supervisor + economics budget) | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 observe-and-escalate only (no kill, no restart) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken).

### Alternative 0 — Do Nothing (Keep `ceo-loop.sh` as the Coordinator Supervisor)

- **Eligibility:** Not eligible (fails C-6 — the bash loop applies no pickup predicate at all — and C-8 — no typed, durable outcome exists for any of the five functions).
- **Summary:** Leave the bash loop in place; deliver only the daemon later.
- **Constraint compliance:** Fails C-6 and C-8. C-4 passes in substance (group-scoped teardown over recorded PIDs, no shell interpolation) but not as a typed, fence-holding contract — a driver weakness rather than a constraint failure, and noted rather than scored.
- **Driver fit:** Best on D3 (zero change) and D8 (zero build cost); worst on D1, D2, D4, D7.
- **Pros:** No new surface, no new records, no new process kind.
- **Cons:** Every lifecycle action stays unrecorded; a wedged coordinator stays undetected by artifacts; exhaustion stays silent; wake-on-question stays unimplemented; M4-S5 stays blocked.
- **Why rejected:** It fails the story's pinned function-map coverage and leaves the delivery reliability and token-cost problem untouched.

### Alternative 1 — Coordinator Supervision as Its Own Supervised Process over a Shared Regime and an Injected Process-Lifecycle Port (selected)

- **Eligibility:** Eligible (C-1…C-8 all pass).
- **Summary:** A `coordinator` command family with `start [--foreground] [--fresh-budget]`, `stop`, `status [--live]`, and a bounded `tick`; a state-dir single-instance fence; a declared regime descriptor shared in shape with the future `daemon install`; one injected process/session-lifecycle port (spawn, resume, alive, kill-with-grace, sourced progress, capability declaration) implemented beside the harness adapters and faked in tests; a recorded lifecycle decision; a distinct per-epoch restart budget; and predicate-bound wakes.
- **Constraint compliance:** Passes every constraint; see the attestation.
- **Driver fit:** Best on D1 (durable decision before action), D2 (fail-closed on unknown), D4 (one regime, one seam), D5 (pure + fake-testable), D6 (coordinator-specific epoch budget), D7 (`status` answers the operator's questions).
- **Pros:** Every lifecycle action is inspectable after a crash; the destructive path is capability-declared and handle-scoped; `tick` gives a one-shot, testable, cron-driveable shape; the future daemon inherits a descriptor instead of a rival.
- **Cons:** A second resident process kind now exists during M1, before any OS unit exists; detached mode claims no OS supervision and says so; the adapter implementation cost tracks harness changes (see residual).
- **Why chosen:** See Decision.

### Alternative 2 — Build `daemon` + `daemon install` Now and Host Coordinator Supervision There

- **Eligibility:** Not eligible (fails C-1: a `daemon` command and an OS unit installer are exactly what the change must not add).
- **Summary:** Deliver M1-S18's surface early and register coordinator supervision under it.
- **Constraint compliance:** Fails C-1; passes the rest.
- **Driver fit:** Best on D4 by construction (there is only one regime because there is only one process family); worst on D3 (a large, unrequested scope) and D8.
- **Pros:** No interim dual-process period; the OS autostart question is answered once.
- **Cons:** The story's dependency list names only M1-S15/M1-S16; an untested installer would ship without its own acceptance criteria; the daemon's lane supervision, control socket, and startup reconciliation would all be guessed.
- **Why rejected:** It would duplicate and preempt M1-S18's installer, which is the precise failure RSK-4 names.

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
- **Why rejected:** It declines the story's central acceptance criterion. Its genuine insight — that killing is the riskiest thing here — is preserved as C-2/C-4/C-5 and as the fail-closed verdict rule in TDR-0014.

## Decision

- **Decision:** **ALT-1.** Coordinator supervision ships as its own supervised process and `coordinator` command family, behind a shared supervisor-regime descriptor, over a new injected process/session-lifecycle port, with a recorded lifecycle decision, a distinct per-epoch restart budget, and predicate-bound wakes.
- **Rationale (tied to drivers):** ALT-1 is the only eligible alternative that delivers all five functions (D1, C-8) while keeping the destructive path capability-declared, handle-scoped, and fail-closed (D2, C-4). It is reversible in the strangler sense the project cares about (D3): records are additive, the command is opt-in, no daemon is required, and `ceo-loop.sh` is untouched until M4-S5. It resolves the future-daemon collision with a descriptor instead of an installer (D4), which is the cheapest possible way to keep one regime. Purity (D5) is not decoration: it is what makes the kill-failure, capability-gap, torn-ordinal, and stale-fence paths testable in CI. The distinct budget (D6) is forced by semantics — a per-delivery budget resets on the wrong event for an actor that outlives deliveries.
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-241 PR review; not claimed by this record.
- **Conditions for revisit:** See `revisit_triggers`; the load-bearing ones are M1-S18 consuming the descriptor, a harness capability gap, and any false-kill incident.

### DC-1 — Separate supervised process and command family; no `daemon` command

`coordinator start [--foreground] [--fresh-budget]`, `coordinator stop`, `coordinator status [--live]`, and `coordinator tick` constitute the surface. `start` acquires the fence and runs the loop (foreground is the shape a future unit hosts; detached records `supervisor=external-unit-absent`). `tick` performs exactly one bounded collection cycle, acquires the fence for its duration, and is the testable one-shot shape. A `tick` or `start` while another supervisor holds the fence is refused with `coordinator.already-running` at exit `2`. No `daemon` command, socket, lane supervision, startup reconciliation, or OS unit installer is created.

### DC-2 — Shared supervisor-regime descriptor; the `daemon install` wiring is the M1-S18 seam

The descriptor declares state-dir scope, a single-instance fence scoped to the state dir, a unit identity derived from the state dir and the coordinator identity, a distinct process kind, and a distinct restart-budget store. It is shared **in shape** with the future `daemon install`; the daemon's own values are not invented here. A stale holder (recorded process gone, or fence record older than two collection intervals) is taken over with recorded evidence. OS autostart is an explicit, tested gap naming M1-S18, not an invented installer.

### DC-3 — One injected process/session-lifecycle port, implemented in adapters and faked in tests

The port declares spawn, resume, alive, kill-with-grace, and sourced progress as capabilities plus a capability declaration, so a harness that cannot expose resume, liveness, or progress is a declared gap rather than an assumed success. The contracts tier owns the shape; adapters own the implementation beside the delivered harness session adapters; tests inject a fake. The decision domain stays pure (C-2). A needed capability that is absent is `coordinator.process.capability-gap` at exit `2`, and no destructive action is taken. This is the TDR-0008 precedent (additive adapter-contract extensions recorded as a TDR), not the ADR-0008/ADR-0010 precedent of publishing a new primitive port surface.

### DC-4 — The lifecycle decision is recorded before it is applied; only recoveries consume an ordinal

`join-live` (recorded session alive) consumes no ordinal. `resume-context` consumes exactly one. `spawn-fresh` consumes one for the recovery reasons (`context-pressure`, `context-unknown`, `session-interrupted`) and none for `initial-start` or `clean-iteration-end`. The decision, session identity, context reading (or its explicit absence), reason, ordinal consumption, and iteration identity are recorded **before** the action is applied, so a kill mid-flight resumes or respawns per the last recorded decision and closed-out work (phase records, merge records, answers) is never re-executed. The budget is per **budget epoch**, durable across supervisor restarts, reset only by `start --fresh-budget`, and folded from contiguous ordinals starting at `1`; a torn or gapped ordinal is `unevaluable`, never count `0`.

### DC-5 — Context recoverability is fail-closed

Resume requires all of: no live session, a prior session that did not complete cleanly, a declared resume capability, and a *known* context reading below `coordinator.resume-context-limit`. Anything unknown — context at/above the limit, an unreadable reading, an absent reading, an undeclared resume capability — produces `spawn-fresh` with a classified reason. Re-paying prefill is the accepted cost of not resuming into a context that cannot be proven recoverable; the cheaper-by-default choice is the one whose failure mode is known.

### DC-6 — Wake is exactly the delivered pickup predicate, once per question lifetime

On each collection cycle the supervisor performs one verified blocker-ledger read, reuses that read for the `answer` evidence class (TDR-0014), applies the delivered shared ranking, and evaluates `isCoordinatorPickup` strictly. On a true predicate with an unwoken question it triggers the next iteration (live wake, resume, or spawn per DC-4/DC-5) and records one wake with the question id, rank, iteration identity, and outcome. Dedupe is `(coordinatorId, questionId, askedAt)`: one wake per question lifetime. `already-woken` is a no-op; `answered-before-wake` issues nothing; `delivery-failed` is `coordinator.wake.delivery-failed` at exit `2` and the next cycle retries without a duplicate record; `no-pickup` is a tick result, never a record.

### Constraint Compliance Attestation

The chosen alternative satisfies every constraint. C-1: no `daemon` command, socket, lane supervision, or installer exists; the gap is declared and tested (AC-F8-2). C-2: every effect and fact crosses an injected port; the domain reads no clock, filesystem, OS process API, or ambient environment (NFR-1, AC-NFR-3). C-3: coordinator state lives under `coordinator/<coordinatorId>` with per-epoch ordinals; lane and economics records are unchanged (AC-F5-1). C-4: termination is TERM → grace → KILL on the recorded handle, performed only by the fence holder (AC-F4-3, NFR-14). C-5: no CPU read exists in the path (NFR-2). C-6: wake eligibility is the delivered predicate, unmodified (DEC-9, AC-F7-3). C-7: records are additive under the unchanged schema and every non-zero outcome is a declared error identity in the `{0,1,2}` projection (DEC-12, NFR-12). C-8: all five functions map to acceptance criteria (AC-F10-5, Appendix A). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- Every join, resume, spawn, kill, and restart is reproducible from durable state after a supervisor crash — the failure mode that makes the bash loop unauditable disappears.
- The destructive path becomes the most constrained path in the change: a declared capability, a recorded handle, a state-dir fence, and a fail-closed verdict.
- `coordinator tick` provides the bounded one-shot surface that both tests and a future cron-like or unit caller need, without starting a background loop.
- The future daemon inherits a descriptor instead of a rival: M1-S18 consumes state-dir scope, fence, unit identity, process kind, and budget store rather than re-deciding them.
- Restart policy becomes actor-appropriate: coordinator recoveries are counted per epoch, lane restarts stay per delivery, and per-ticket cost truth is not polluted.
- Wake becomes enforceable rather than declared: the delivered predicate is consumed exactly, with one wake per question and consumption evidence (the answer record).
- Operator legibility improves to a single command: `coordinator status` answers running, decision, restarts, stuck, wake, and escalation state.

### Negative Outcomes

- A second resident process kind exists during M1, before any OS unit exists; the operator must run `start` (foreground under a future unit, or detached with the honest `external-unit-absent` marker).
- The adapter tier takes on a new capability surface that must be kept aligned with harness changes; the maintenance cost is ongoing and real.
- The coordinator cadence is a third timing key (`coordinator.collection-interval`) beside `daemon.heartbeat-cycle` and `lane.liveness-interval`; the distinctness is deliberate, but it is one more knob to reason about.
- Detached mode deliberately claims no OS-level supervision; an operator who reads "detached" as "managed" will be wrong, which is why the marker is recorded and rendered.

### Unresolved Questions

- [ ] Windows process-tree termination behind the port is unproven; the capability declaration and the `kill-failed` path bound the damage, but the host matrix is `TO-CONFIRM` (owner: `@coder`, verified at delivery).
- [ ] Session-handle-to-process-identity resolution for each harness is an assumption until the adapter work lands; a harness that cannot resolve it takes no destructive action (owner: `@coder`).
- [ ] M1-S18 must confirm that a user-level unit can host the foreground shape; until then the descriptor is a shape agreement, not a tested hosting contract (owner: `@pm` for M1-S18).
- [ ] The `daemon` value set (heartbeat cycle, unit naming) is deliberately not invented here; M1-S18 fills the descriptor's daemon-side values (owner: M1-S18).

## Implementation Plan

1. **Contracts tier.** Declare the coordinator vocabulary (lifecycle decisions, decision reasons, restart reasons, wake outcomes, kill outcomes, escalation states, config keys, error identities) as `as const` data, and the process/session-lifecycle port shape with its capability declaration. No behaviour.
2. **Domain tier.** Implement the pure decisions: context recoverability, lifecycle decision, restart admission, wake evaluation, escalation projection, and the status projection. Every input injected; no ambient reads.
3. **State tier.** Declare one `coordinator/` artifact boundary with the five additive kinds (iteration, restart, stuck, exhaustion, wake) and their payload schemas; validate kinds, vocabularies, and ordinal contiguity before serving; treat torn/unknown as `unevaluable`.
4. **Config tier.** Add the `coordinator` branch with `stuck-window`, `kill-grace`, `restart-budget`, `resume-context-limit`, and `collection-interval`, with declared defaults as policy data and no bound or default literal in the decision code.
5. **Adapter tier.** Implement the port beside the delivered harness session adapters, resolving session handle and process identity per harness; declare every capability gap explicitly.
6. **CLI tier.** Register the `coordinator` family and implement `start`, `stop`, `status`, `tick`, the `delivery.coordinator.v1` `data` shape, deterministic text output, and the `{0,1,2}` projection through the shared error table.
7. **Tests.** Fake the port and cover: each decision kind, ordinal accounting, torn/gapped ordinals, fence contention and stale takeover, kill terminated/forced/failed, capability gaps, idempotent re-runs, and the SC-M1-25 reconciliation in Appendix C of the change spec.
8. **Documentation.** Reconcile the new coordinator-supervision feature spec, the economics consumer/boundary note, the harness-adapter port note, the CLI registry and man-page pack, and the decision index.

## Verification Criteria

- Metric: lifecycle actions (join, resume, spawn, kill, restart) carrying a durable decision record — Target: 100% — Window: GH-241 delivery and the first supervised releases.
- Metric: `ceo-loop.sh` function-map coverage by passing acceptance criteria — Target: 5 of 5 — Window: GH-241 test run (AC-F10-5).
- Metric: CPU reads or CPU-derived thresholds in the decision path — Target: 0 — Window: GH-241 audit and review.
- Metric: restart-budget durability across a supervisor crash — Target: 100% with no duplicate or replayed ordinal — Window: GH-241 fault-injection suites.
- Metric: wake latency after a question becomes rank 1, open, coordinator-audience — Target: ≤ one `coordinator.collection-interval` — Window: delivery suite plus first supervised operation.
- Metric: concurrent supervisors on one state dir — Target: 0 (second start refused `coordinator.already-running` at exit `2`) — Window: delivery suite.
- Metric: `coordinator tick` / `coordinator status` p95 — Target: ≤ 2 000 ms / ≤ 1 000 ms over the reference state store — Window: delivery performance suite.
- Process checkpoints: the first retrospective after GH-241 implementation sets `review_date`; the S18 handoff is verified when M1-S18 consumes the descriptor.

## Confidence Rating

**Medium-high.** The evidence base is unusually strong because most of it is delivered code read directly: the harness port's missing kill, the per-delivery budget keys and record kinds, the pickup predicate and its ranking, the additive state boundary, and the bash baseline that is being replaced. What remains genuinely uncertain is empirical rather than analytical: per-harness process identity and resume fidelity, Windows process-tree termination, and whether the future daemon can actually consume the descriptor. Those are recorded as assumptions and `TO-CONFIRM` items with fail-closed consequences rather than assumed away. AI-generated confidence is not evidence; the owner's acceptance at PR review is the authoritative signal.

## References

- Change spec: `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-spec.md` — DEC-1, DEC-3, DEC-6, DEC-7, DEC-9; §5.1 F-1/F-2/F-4/F-7/F-8; §8.2 EVT-1/EVT-2/EVT-5; §17.1–17.5, §17.7–17.8; Appendix A (function map), Appendix E (record shapes), Appendix F (exit matrix).
- Delivered session lifecycle economics: `doc/spec/features/feature-session-lifecycle-economics.md` — sourced progress signals and the per-delivery budget that this decision deliberately does not reuse.
- Delivered blocker channel: `doc/spec/features/feature-blockers.md` — ranking, audiences, `isCoordinatorPickup`, and the statement that M1-S23 is the future applying actor.
- Delivered harness adapters: `doc/spec/features/feature-harness-adapters.md` — the session port this decision extends beside, never inside.
- Command registry and strangler table: `doc/planning/oss-tooling/cli-command-registry.md` — the `daemon` (M1-S18) and `supervise` (M2-S2) rows and the `ceo-loop.sh` handover.
- Seed scenario: `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` SC-M1-25; timing baseline `doc/planning/oss-tooling/milestones/m1/contracts.md` (`daemon.heartbeat-cycle` 60 s).
- Contracts read: `packages/core/src/contracts/harness.ts`, `packages/core/src/contracts/state.ts`, `packages/core/src/contracts/economics.ts`, `packages/core/src/contracts/blockers.ts`, `packages/core/src/contracts/error-table.ts`, `packages/core/src/config/catalog.ts`, `packages/core/src/config/defaults.ts`.
- Bash baseline being replaced: `scripts/ceo-loop.sh`.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier purity and runtime confinement; [ADR-0008](ADR-0008-harness-adapter-contract.md) — harness provider domain and session lifecycle; [ADR-0010](ADR-0010-session-admin-port-mutating-contract.md) — the mutating-port precedent this decision does not extend.
- [TDR-0004](TDR-0004-state-storage-engine.md) — additive record kinds, fences, and torn-store classification; [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the `{0,1,2}` projection and the closed error table; [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive adapter-contract extensions recorded as a TDR.
- [TDR-0014](TDR-0014-coordinator-artifact-evidence-and-brief-escalation.md) — the stuck-evidence rule and the owner-brief escalation that this architecture carries.
