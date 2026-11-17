---
ados_distribution: internal
id: SPEC-SUPERVISE
status: Current
created: 2026-11-17
last_updated: 2026-11-17
owners: ["engineering"]
service: delivery-os
summary: "The operator-facing `supervise` family (M2-S2): one battery invocation over the invoking checkout's single managed repository that folds durable daemon, queue, dispatch, economics, and effect records into the schema-versioned `delivery.supervision.v1` report; per-lane and per-supervision-claim tri-state classification (`progressing` / `stalled` / `unknown`) from artifact evidence alone with lying-liveness detection and no process-derived input; watchdog classification, bound, and prefill-safe rule consumption instead of reimplementation; a lane's own `daemon.lane` heartbeat observation with the declared scope fallback; the battery-written-only supervised-stall park with the sixth `liveness-stall` cause (the operator path refuses `--park liveness-stall` by name and both append seams refuse an empty expiry), the resolver-mapped `provider-window` condition, a non-null re-entry instant, and the additive active-park `until` on the lane read; duplicate-supervision refusal against an authority actively acting (live daemon presence enriches the report and gates nothing; a park intent is non-claiming); restart-policy composition over the delivered budget, resume economics, terminal exhaustion, and typed question, with the park's re-entry horizon governing later actions; one whole-store fold per run that the park, restart, and claim actions reuse; exactly two `supervise` error identities in the closed two-segment allowlist; and the mount as the 24th prompt-required family with no new record kind and no event-taxonomy change."
links:
  related_changes: ["GH-295", "GH-238", "GH-221", "GH-235", "GH-292", "GH-241", "GH-237", "GH-174", "GH-172"]
  related_decisions: ["TDR-0025", "TDR-0027", "TDR-0028", "ADR-0003"]
  contracts:
    - "packages/core/src/contracts/supervise.ts"
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/domain/supervise.ts"
    - "packages/core/src/domain/queue-lanes.ts"
    - "packages/core/src/app/supervise.ts"
    - "packages/cli/src/commands/supervise.ts"
---

# Feature: Supervise (Supervisor Battery)

> **Role of this Document:** Source of truth for the delivered operator-facing supervision battery (M2-S2). It covers the invocation, the report contract, the artifact-evidence classification, the watchdog and daemon consumption boundaries, the supervised-stall park and lane projection, duplicate supervision, restart composition, the two error identities, and the testing map. Requirements live in the GH-295 change artifacts; this document describes current behavior. The daemon-internal supervision cycle keeps its own page ([Resident Dispatch Daemon](feature-resident-daemon.md)), the probe family keeps its own page ([Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md)), and the park vocabulary and lane projection keep theirs ([Scheduling Engine](feature-scheduling-engine.md)).

## 1. Overview

`supervise` is the operator-invoked supervisor battery. One invocation answers, for exactly one managed repository scope, what the supervision truth of that repository is right now: every lane and every intersecting supervision claim classifies to exactly one of `progressing`, `stalled`, or `unknown`, derived exclusively from durable artifact evidence; a corroborated stall is parked through the delivered park machinery with a classified reason and a re-entry instant; duplicate supervision is refused per action with the live authority named; and restart decisions ride the delivered economics rather than a battery-local policy.

| Invocation | Purpose | Outcome |
|---|---|---|
| `<binary> supervise` | One battery run over the invoking checkout's managed repository | The `delivery.supervision.v1` report (exit `0`), a classified refusal (exit `1`), or the evidence-absent/unreadable answer (exit `2`) |
| `<binary> supervise --json` | The same run on the machine envelope | The report as `data` under the shared envelope |
| `<binary> supervise --help` / `--version` | Self-description from the static inventory | Exit `0` with zero state, git, network, configuration, or spawn activity |

The family carries one battery invocation, no command-specific flags, and accepts no positionals; `--json` is the global machine-output switch. Grammar containment runs before any read: an extra positional or an unknown flag is refused through the delivered containment identity, and a recording store seam observes zero reads on that path.

The human render is produced from exactly the same report object as the machine payload — no second fold and no second read — and names the binary only through the branding seam:

```
<binary> supervise — <repo>
lanes <n> (progressing <n>, stalled <n>, unknown <n>)
lane <ref> <classification>[ holder <holder>][ heartbeat <instant>] — <evidence codes>
supervisors <n>
supervisor <claimKind> <identity> <classification>[ holder <holder>][ heartbeat <instant>] — <evidence codes>
actions <n>
action <kind>[ <ref>] — <evidence codes>
parked <n>
degraded <none|marker,...>
truncated <false|lane-cap>
observedAt <instant>
```

An empty readable scope states the empty population (`scope observed: no lanes and no supervision claims`) and never renders a healthy-lane claim; an empty human render is never invented.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** A delivery whose supervision has stopped — a resident daemon whose heartbeat records keep advancing while nothing it supervises progresses, or a lane whose session signals claim activity while no artifact advances — is visible today only by manual forensic inspection of the ledger. Delivered surfaces report what the records say; none evaluates whether the records themselves prove stagnation, and detection is not action.
- **Affected Users:** Operators and lifecycle agents responsible for stuck or lying deliveries; maintainers of the daemon, queue, dispatch, economics, and watchdog families the battery consumes.
- **Business Impact:** Stuck or lying deliveries are detected and acted on from system evidence instead of by hand, a stalled lane is parked where the `lanes` surface shows it, and duplicate supervision is refused before it double-parks or double-restarts.

### 2.2 Goals

- One battery run per repository scope that classifies every lane and every intersecting supervision claim.
- Artifact evidence as the only classification input; no process-derived value can reach a verdict.
- Lying-liveness detection: claimed aliveness contradicted by a flat artifact trail classifies `stalled`.
- A corroborated stalled lane is parked through the delivered park machinery with a classified reason and a non-null re-entry instant.
- Duplicate supervision is detected and refused per action with the live claim and holder named, composing with the delivered lock, lease, and single-flight semantics without changing them.
- Restart decisions compose with the delivered budget and resume economics; exhaustion stays terminal and loud.
- Truthful projection: the exclusive data/error envelope and the `{0, 1, 2}` exit taxonomy; `unknown` is a classified answer, never a guessed verdict or a defaulted zero.

## 3. Capabilities

### 3.1 Artifact-evidence classification

The classification is a pure read-time fold over the durable record set of one repository scope. The observation span is the delivered corroboration bound, `WATCHDOG_STALL_HEARTBEAT_MS` (300,000 ms), imported from its watchdog home; no 300,000 literal exists in the supervise tier.

The delivered rule, evaluated over the artifact-only classification input:

| Cell | Input facts | Classification |
|---|---|---|
| Source present, artifact advancing | Any artifact instant inside the observation span, or an advancing artifact flag | `progressing` — prefill-safe; advancing evidence is never overridden into `stalled` by any other reading |
| Source present, heartbeat fresh, artifacts flat | Last heartbeat younger than the bound, no advancing artifact | `progressing` — the delivered partial reading |
| Source present, heartbeat trail spans the span, artifacts flat | Heartbeat present, no advancing artifact, and the first heartbeat at or beyond the bound (a lying-liveness pattern) | `stalled` — the full corroboration combination |
| Source present, heartbeat aged, artifacts flat | Heartbeat present at or beyond the bound, no advancing artifact | `stalled` |
| Source absent | No heartbeat and no artifact instants (`sourcePresent: false`) | `unknown` — the evidence source is absent, never a coerced zero |
| Heartbeat absent, artifacts present but flat | No heartbeat instant, no advancing artifact | `unknown` |

The advancing/stale decision delegates to the delivered lane classification; the battery declares no second predicate. The tri-state is a declared mapping of the delivered vocabularies, never a renamed copy: daemon lane liveness `progressing`/`stalled`/`unknown` maps one-to-one, and the watchdog verdict family maps `ok`/`progressing` → `progressing`, `stalled` → `stalled`, `refused` → `unknown`.

The classification input shape has exactly the declared artifact-only members — `repository`, `ref`, `claimKind`, `identity`, `sourcePresent`, `lastHeartbeatAt`, `firstHeartbeatAt`, `heartbeatRecordKind`, `artifactClasses`, `artifactInstants`, `artifactAdvancing`. `heartbeatRecordKind` names the record kind the heartbeat instants actually came from (`daemon.lane`, `daemon.heartbeat`, `coordinator.iteration`, `queue.lease`), so every heartbeat evidence fact stays reconstructible. No pid, process start time, CPU, session identifier, or process-port value exists in the shape, so a process-only reading can never satisfy it or classify a verdict. The fold reads no process seam.

Artifact classes observed: `daemon-lane`, `dispatch-attempt`, `commit-record`, `effect-record`, `restart-record`, `reconciliation-record`, and `ledger-position`, sourced from the delivered daemon lane, dispatch attempt, outbox effect (including applied commit effects), economics restart, and daemon reconciliation records for the in-scope refs, plus the coordinator iteration records that evidence the coordinator claim. A lane's own observation is the delivered daemon lane record's `liveness.observedAt`; a lane carrying no own observation falls back to the scope `daemon.heartbeat` trail and the run declares that fallback through the `artifact-source-absent` degradation marker.

### 3.2 Report

The machine payload is schema-versioned `delivery.supervision.v1`:

| Member | Content |
|---|---|
| `schemaVersion` | Exactly `delivery.supervision.v1` |
| `repo` | The battery's own scope key |
| `lanes[]` | One entry per in-scope lane: `ref`, `classification`, optional `heartbeat`, optional `holder`, non-empty `evidence` |
| `supervisors[]` | One entry per supervision claim: `claimKind`, `identity`, `classification`, optional `heartbeat`, optional `holder`, non-empty `evidence` |
| `actions[]` | One entry per applied or declared-unavailable action: `kind`, optional `ref`, non-empty `evidence` |
| `counts` | `lanes`, `progressing`, `stalled`, `unknown`, `supervisors`, `actions`, `parked`, derived from the emitted entries |
| `degraded` | Closed markers: `daemon-absent`, `artifact-source-absent`, `partial-read` |
| `truncated` | `true` exactly when the lane cap dropped entries |
| `truncationReason` | Present exactly when `truncated` is true; the closed vocabulary has the single member `lane-cap` |
| `observedAt` | The run's recorded instant |

Every lane entry, supervisor entry, and action carries non-empty evidence naming refs, record kinds, instants, and codes from the closed evidence-code vocabulary (`artifact-heartbeat-fresh`, `artifact-heartbeat-aged`, `artifact-progress`, `artifact-flat`, `artifact-source-absent`, `claim-live`, `claim-not-live`, `holder-recorded`, `scope-bound`, `observation-span`, `bound-applied`, `park-applied`, `park-intent-recorded`, `restart-admitted`, `restart-exhausted`, `restart-unavailable`, `acting-authority-refused`, `single-flight-refused`, `evidence-truncated`). Heartbeat evidence names the source record kind — `daemon.lane` for a lane's own observation, `daemon.heartbeat` for a daemon claim or a declared scope fallback, `coordinator.iteration` for a coordinator claim, and `queue.lease` for a per-ref lease — and a restart-shaped action's evidence (admission, exhaustion, or unavailable) echoes the injected run identity. Evidence respects the delivered evidence byte cap as a hard upper bound on the serialized list including the `evidence-truncated` marker: an over-cap list keeps its leading entries and appends the marker, and a single entry that cannot fit beside the marker is dropped rather than leaving the list over the cap. A refusal names the live claim and holder in the failure summary.

A lane's `holder` is the recorded holder of that lane's live lease, present exactly when a live lease exists and never inferred. A lane's `heartbeat` is that lane's own `daemon.lane` observation instant (the delivered lane record's `liveness.observedAt`), falling back to the scope's last `daemon.heartbeat` only as a declared degradation, and absent when neither was observed. Degradation is declared per run: `daemon-absent` when no daemon instance claim exists, `artifact-source-absent` when a lane carries neither artifacts nor a heartbeat or when a lane's heartbeat comes from the declared scope fallback rather than its own observation, `partial-read` when an unparseable entry record was skipped. A degraded marker never changes the exit; the report is the truth.

### 3.3 Scope

The run folds exactly one repository scope:

- Lane population: queue entry records whose recorded repository equals the scope key, or that carry no repository; the canonical ref population is the sorted, de-duplicated entry ref set.
- Supervision claims: the daemon instance claim and its heartbeat trail (the latest instance record, its heartbeat ordinals, and the reconciliation instants), the coordinator ledger-lease claim and its iteration records, and every active per-ref queue lease, filtered to in-scope refs.
- Leases and parks are filtered to the in-scope ref set; the report names no repository other than its own scope key, and no foreign ref or holder can reach either projection.
- The production composition composes the family unconditionally over the invoking checkout's state store. The scope key is the resolved managed repository key; a checkout with no resolvable origin falls back to the lower-cased checkout-directory name.

### 3.4 Supervision claims and duplicate supervision

Claims classify with the same tri-state and always name their identity and, where recorded, their holder:

| Claim kind | Liveness evidence |
|---|---|
| `daemon-instance` | The latest instance record claims `acquired`/`taken-over`; live when the last `daemon.heartbeat` is inside the delivered heartbeat-staleness bound (`DAEMON_DEFAULT_LOCK_STALENESS_MS`); supervision artifacts are the daemon lane progress instants plus the reconciliation instants |
| `coordinator-lease` | The latest coordinator fence record carries a lease-held action; live by recorded ownership; supervision artifacts are the recorded iteration instants (ledger-position movement), and the heartbeat instants come from `coordinator.iteration` records |
| `per-ref-lease` | An active queue lease on an in-scope ref; the holder is exactly the recorded holder; the heartbeat instant comes from the `queue.lease` record and liveness is the delivered lease staleness rule |

Claim classification and holder reporting always ride report data and are never a refusal. A live resident daemon's existence therefore refuses nothing and gates nothing: it enriches the report with a claim entry. The duplicate-supervision refusal guards one object: an authority actively acting over the same object a battery action targets. Detection is artifact evidence — a pending daemon preemption record naming that ref and recorded inside the observation span — never a process scan.

The refusal is per action, never per claim. When the battery attempts an action whose object an acting authority holds, the run projects the failure envelope at exit `1` with `supervise.duplicate-supervision`, naming the live authority and its holder when recorded, and no action lands. A run whose actions all succeed, or that needs none, reports data at exit `0` even when live claims are present.

Per-ref double-claims stay with the delivered per-ref single-flight identity: a claiming action against a ref whose live lease records a holder is refused with `queue.single-flight` and the holder named, unchanged. A supervised-stall park intent — including a stall over a lane holding a live lease — is a non-claiming action: it is refused by neither identity, and its safety comes from the delivered fenced append and write serialization (a landed park refuses a second identical park).

### 3.5 Supervised-stall park

When a lane classifies `stalled` and the run composes the delivered park write path, the battery acts:

- It appends one park record through the delivered park record shape, key, and fence discipline, carrying cause `liveness-stall`, the delivered resolver's condition type for that cause (`provider-window`), and a non-null `until`. The battery is the only writer of this cause: the operator path `queue release --park liveness-stall` is refused by name before any read or write, whatever flags accompany it, and both park append seams refuse a `provider-window`-mapped park whose expiry is empty or missing, so a record the delivered read validator rejects can never reach the append-only ledger. The reported action's evidence names the corroborating facts (heartbeat observation, flat artifact classes, observation span, and the bound applied).
- `until` is the declared stall recheck horizon: the run instant plus the mapped condition type's delivered recheck default (`QUEUE_PARK_RECHECK_DEFAULTS["provider-window"]`, 60,000 ms), imported from its contract home rather than declared as a literal. `recheckMs` carries the same default. The corroboration bound (300,000 ms) is the classification input and is not the re-entry horizon.
- A stall over a lane holding a live lease appends the same durable park record and reports the action as `safe-boundary-park-intent` with the recorded holder in evidence; the record is the durable intent, the running session is never signalled or stopped, and it observes the park at its next boundary. A stall over an unheld lane reports the action as `supervised-stall-park`.
- The action is idempotent: while an active `liveness-stall` park stands for the lane, a second run appends no second park and reports no duplicate action. A second run inside the park's declared re-entry horizon appends nothing and consumes no restart budget (§3.6).
- The park action acquires no lease, releases no lease, mutates no queue entry, and writes no payload other than the park record. No process is signalled on any path.
- The delivered six-value lane state set, the `parked:<cause>` reason template, and every delivered render are unchanged; a parked stall lane reads `state: "parked"` with reason `parked:liveness-stall` on `lanes list|show` (with the active park's `until` on that read), so the lane reads as parked rather than healthy. The board's lanes section carries the delivering/failed lane facts and its `PARKED` episode population is the declared `peak-window`/`owner-hold` set, so a supervised-stall park is not a board `PARKED` row.

The lane machine read gains the active park's `until` additively: present exactly when an active expiry-carrying park exists for the lane, equal to the park record's re-entry instant, absent otherwise — never inferred, never defaulted, and never null. A pre-change record set replays unchanged, and the absence of the new cause is a classified absence rather than a default. A park with no expiry (`owner-hold`) contributes no `until`. No event topic or event kind is added: the parked state is a read-time projection over the delivered park records (the monitor `lanes` snapshot projects daemon execution records, not queue parks), and a `liveness-stall` park emits no park-edge episode frame.

### 3.6 Restart-policy composition

The battery applies no restart policy of its own. For a lane already parked under an active `liveness-stall` park that still classifies `stalled`, the run consults the injected delivered restart-budget admission and the delivered economics append paths. The park's declared re-entry instant governs this run too: while `now < park.until`, the run appends nothing, reports no action, and consumes no budget, so a re-run inside the recheck horizon is inert.

- `admit`: exactly one delivered restart record appends, with the ordinal moving one delivered step, and the run reports a `restart-admission` action.
- `exhausted`: the delivered terminal exhaustion record appends and the typed question is raised exactly once (identity `exhaustion-<ref>-<runId>`, decision-needed, owner audience, two declared options); the run reports an `exhaustion-record` action. Exhaustion never silently requeues.
- `unavailable`: the run reports the declared `unavailable-outcome` action, consumes no budget, and appends nothing.
- An acting authority refuses the action first (`supervise.duplicate-supervision`); a live per-ref lease refuses it through `queue.single-flight`.

The restart, exhaustion, and question records carry the invocation's injected run identity, and the action evidence echoes it, so every action is correlatable to the run that caused it. The budget admission consumes the run's single fold snapshot (the per-ref delivered restart records) instead of re-reading the ledger, and the per-ref single-flight answer is derived from the same snapshot's lease facts through the delivered predicate; the blocker ledger is read at most once per run. Every restart-shaped action rides the delivered seams; the battery never signals, kills, stops, or spawns a process, and recovery changes state only through the delivered classification.

### 3.7 Error-table binding

A `supervise` domain kind joins the closed error-table union with exactly two identities, appended after the existing rows; no delivered row changes.

| Code | Category | Retryable | Consequence | Projection class | Exit |
|---|---|---|---|---|---|
| `supervise.duplicate-supervision` | `user` | `true` | `not_landed` | `user-validation` | `1` |
| `supervise.evidence-absent` | `platform` | `true` | `not_landed` | `platform-provider` | `2` |

Both are exact kind-first two-segment codes and join the reserved two-segment allowlist by exact declaration, which now holds 64 declared identities; no `supervise.*` family or prefix widening exists. The machine rows, their documented rows in [Result Contract and Error Table](feature-result-contract.md), and the true-positive corpus rows are bound in both directions by `error-table-sync`. Every other outcome reuses a delivered identity: grammar and invocation refusals through the delivered containment identities, unreadable or torn scope state through the delivered `state.*` identities, per-ref double-claims through `queue.single-flight`.

### 3.8 Bounds and determinism

| Concern | Current bound |
|---|---|
| Lane entries | `QUEUE_MAX_LANES` (200); a larger population is cut to 200 with `truncated: true` and `truncationReason: "lane-cap"`; counts state the emitted entries |
| Supervisor entries and actions | No separate numeric cap; both derive from the same single scoped fold, and counts disclose the population truthfully |
| Evidence | The delivered daemon evidence byte cap, enforced as a hard upper bound on the serialized list including the `evidence-truncated` marker; a single oversized entry is dropped |
| Reads | One whole-store fold per battery run covers the verdicts and the action path: park, restart, and claim decisions reuse that snapshot with no per-lane whole-store re-read; the blocker ledger is read at most once per run; the human projection adds no read and no fold |
| Run latency | A full run at the 200-lane cap completes inside 5,000 ms in the offline behaviour suite |
| Determinism | Identical durable record sets replayed with an injected clock produce identical report, evidence, actions, and exit |

## 4. Verdict and Exit Matrix

| Outcome | Exit | Envelope | Identity |
|---|---|---|---|
| Report produced (healthy, stalled, parked, restarted, or with live claims present) | `0` | `data` = the report | — |
| Extra positional or unknown flag | `1` | `error` | `fallback.invocation` |
| An action whose object a supervision authority is actively acting on | `1` | `error`, no data | `supervise.duplicate-supervision` |
| A claiming action against a ref with a live lease holder | `1` | `error` | `queue.single-flight` (holder named) |
| All entries `unknown` in a non-empty scope | `2` | `error`, no data | `supervise.evidence-absent` |
| Unreadable or torn scope state | `2` | `error` | the delivered `state.*` identity |
| Empty readable scope | `0` | `data` = the empty evidence-complete report | — |
| `--help`, `--version` | `0` | success text | — |

A run that detects and parks a stall is a successful run: the parked state rides data and counts, and the exit stays `0`. A second run inside the park's re-entry horizon is likewise a successful report with no action and no budget consumption. The exit classifies the run's own outcome, never the severity of what it found. The evidence-absent answer appears only for a non-empty scope in which every lane and every claim is `unknown`; individual `unknown` entries inside a mixed report ride the data truthfully.

## 5. Contract Data and Interfaces

`packages/core/src/contracts/supervise.ts` is the single home of the supervision vocabulary:

- `SUPERVISION_SCHEMA_VERSION` — `delivery.supervision.v1`.
- `SUPERVISION_STATES` — `progressing`, `stalled`, `unknown`, in order.
- `SUPERVISION_STATE_FROM_DAEMON_LIVENESS` and `SUPERVISION_STATE_FROM_WATCHDOG_VERDICT` — the declared mappings, not renamed copies.
- `SUPERVISION_CLAIM_KINDS` — `daemon-instance`, `coordinator-lease`, `per-ref-lease`.
- `SUPERVISION_ACTION_KINDS` — `supervised-stall-park`, `safe-boundary-park-intent`, `restart-admission`, `exhaustion-record`, `unavailable-outcome`.
- `SUPERVISION_DEGRADATION_MARKERS`, `SUPERVISION_TRUNCATION_REASONS`, `SUPERVISION_ARTIFACT_CLASSES`, `SUPERVISION_EVIDENCE_CODES`.
- `SUPERVISION_CLASSIFICATION_INPUT_FIELDS` — the exact artifact-only member list, including `heartbeatRecordKind` and no ordinal.
- `SUPERVISION_REPORT_MEMBERS`, `SUPERVISION_OPTIONAL_REPORT_MEMBERS`, `SUPERVISION_LANE_ENTRY_FIELDS`, `SUPERVISION_SUPERVISOR_ENTRY_FIELDS`, `SUPERVISION_ACTION_FIELDS`, `SUPERVISION_COUNT_FIELDS`. The evidence member carries the optional injected `runId` on the action evidence that echoes it.
- Bounds imported from their delivered homes: `SUPERVISION_LANE_CAP` (`QUEUE_MAX_LANES`), `SUPERVISION_MAX_EVIDENCE_BYTES` (`DAEMON_MAX_EVIDENCE_BYTES`), `SUPERVISION_CLAIM_LIVENESS_BOUND_MS` (`DAEMON_DEFAULT_LOCK_STALENESS_MS`), `SUPERVISION_CORROBORATION_BOUND_MS` (`WATCHDOG_STALL_HEARTBEAT_MS`).
- `SUPERVISE_ERROR_CODES` — the two identities.

`packages/core/src/domain/supervise.ts` holds the pure classification, evidence bounding, lane bounding, and count derivation. `packages/core/src/app/supervise.ts` holds the scoped read port, the delivered park/restart/exhaustion write ports, the single fold snapshot that the park, restart, and claim actions reuse, and the battery orchestration. `packages/cli/src/commands/supervise.ts` holds the command definition: zero positionals, no family flags, one battery call with the invocation's injected run identity, no stream write, and no exit literal.

`packages/core/src/contracts/queue.ts` owns the extended park vocabulary this family appends to: `QUEUE_PARK_CAUSES` carries the delivered five in position plus `liveness-stall` sixth; `QUEUE_BATTERY_ONLY_PARK_CAUSES` declares `liveness-stall` as the one cause only the battery writes, refused by name on the operator path; `QUEUE_PARK_CAUSE_CONDITION_PAIRS` gains exactly one row mapping `liveness-stall` onto `provider-window`; `QUEUE_PARK_CONDITION_TYPES` and `QUEUE_PARK_RECHECK_DEFAULTS` are unchanged, so the mapped type's declared recheck default governs. `packages/core/src/domain/queue-park.ts` owns `parkConditionExpiryMissing`, the append-seam guard that refuses a `provider-window`-mapped park with an empty or missing expiry. `packages/core/src/domain/queue-lanes.ts` projects the additive `QueueLane.until`.

## 6. Boundaries

- **No duplicated daemon cycle.** The battery consumes the resident daemon's durable products — instance, heartbeat, lane, reconciliation, and preemption records — and the watchdog classification vocabulary; it neither reimplements nor replaces the daemon's internal supervision cycle. The daemon's production composition stays `supervise-only`, and no part of the battery requires a lane composition ([Resident Dispatch Daemon](feature-resident-daemon.md)).
- **The watchdog family still checks, never supervises.** The battery is the consumer that family's specification names: it consumes the delivered liveness classification and verdict vocabulary, the declared corroboration bound, the prefill-safe rule, and the signals-absent discipline instead of reimplementing them, and it declares no second advancing/stale predicate ([Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md)).
- **No process management.** No pid scan, no process signalling, no kill-with-grace, no spawn, and no process-derived classification input; identity-verified process seams remain the coordinator's ([Coordinator Supervision](feature-coordinator-supervision.md)).
- **No lane delivery or composition.** The battery launches no session, runs no phase, makes no commit, performs no delivery work, and auto-requeues or auto-reopens nothing.
- **No record kind, schema bump, or event change.** The battery folds delivered kinds and appends only through the delivered park, restart, exhaustion, and typed-question paths; the only new schema identity is `delivery.supervision.v1`; no event topic or kind joins the taxonomy.
- **Battery-written-only supervised-stall cause.** `liveness-stall` is the one park cause only the supervision battery writes. The operator `queue release --park liveness-stall` path is refused by name through the delivered containment identity at exit `1` before any read or write, whatever flags accompany it; the operator-writable alternative set is the five delivered causes. The battery writer always supplies `until`, and both append seams refuse a `provider-window`-mapped park whose expiry is empty or missing, so the append-only ledger never receives a record its own read validator rejects ([Scheduling Engine](feature-scheduling-engine.md)).
- **Single repository per run.** The battery is per-repository by contract; host-wide and grouped views belong to the board and project-group surfaces.
- **Delivered mechanisms unchanged.** The daemon lock, heartbeat fold, coordinator ledger lease, per-ref single-flight, restart economics, and watchdog probes behave exactly as delivered; composition is additive.

## 7. Testing

| Level | Suites | Scope |
|---|---|---|
| Structure | `tests/structure/supervision-contract.test.ts`, `supervision-park-vocabulary.test.ts`, `supervision-error-family.test.ts`, `supervision-no-process-input.test.ts`, `supervision-watchdog-consumption.test.ts`, `supervision-imports.test.ts`, `supervision-additivity.test.ts`, `supervision-nonregression.test.ts`, `supervision-no-signal.test.ts`, `supervision-mounting.test.ts` | One-home vocabularies and exact member sets, data-only contract AST, the sixth cause, the battery-only declaration, and pair with the resolved condition, exact two error rows and the 64-member allowlist, the artifact-only input shape with no dead ordinal member, the imported bound with no literal, record-kind and taxonomy additivity, delivered postures unchanged, presence of the 24th family and every family-count pin |
| Checks | `tests/checks/supervision-error-socialization.test.ts` | Both-direction error-table binding over documented rows and corpora, with fail-closed unparseable-table mutations |
| Behaviour | `tests/behaviour/supervision-report.test.ts`, `supervision-scope.test.ts`, `supervision-grammar.test.ts`, `supervision-evidence-absent.test.ts`, `supervision-classification.test.ts`, `supervision-lying-liveness.test.ts`, `supervision-corroboration.test.ts`, `supervision-watchdog-consumption.test.ts`, `supervision-claims.test.ts`, `supervision-stall-park.test.ts`, `supervision-park-writers.test.ts`, `lanes-parked-stall.test.ts`, `supervision-recovery.test.ts`, `supervision-duplicate-refusal.test.ts`, `supervision-single-flight.test.ts`, `supervision-restart.test.ts`, `supervision-exits.test.ts`, `supervision-determinism.test.ts`, `supervision-read-cost.test.ts`, `supervision-bounds.test.ts`, `supervision-performance.test.ts`, `supervision-evidence-totality.test.ts`, `supervision-isolation.test.ts`, `supervision-additivity.test.ts`, `supervision-help.test.ts` | Real temporary repositories with injected clock, brand, and run identity: the seed reports, scope purity, grammar before read, empty vs all-unknown vs unreadable, the full classification matrix, lying liveness for lanes and claims, the corroboration boundary, probe consumption and absent signals, the three claim kinds and holders, the stall park, the safe-boundary intent, the closed-set cause/writer round-trip with the operator refusal and the empty-expiry guard, idempotence and the re-entry horizon, the three DEC-8 refusal cells with the retry control, single-flight reuse, restart admission/exhaustion/unavailable, the reuse exit table, determinism and replay, one fold per run for read-only and acting runs, the 200/201 bound, the measured latency cell, evidence totality, offline isolation, and family help |
| Golden | `tests/golden/supervision-report.test.ts`, `supervision-failure.test.ts`, `lanes-show.test.ts` | Committed normalized envelopes: the healthy report (machine and human), the stalled/parked report, the exit-2 evidence-absent envelope, the exit-1 per-action refusal envelope, the paired exit-0 live-claims data golden, and the parked `lanes show` payload with the additive `until`; normalization covers only the temporary root, run id, and timing |

The change test plan is `doc/changes/2026-11/2026-11-16--GH-295--supervise/chg-GH-295-test-plan.md` (v1.4; 55 cases, TC-SUP-001..103, including TC-SUP-100..103 for the cause/writer round-trip, operator refusal, empty-expiry guard, and action-path one-fold). The operator reference page is `doc/planning/oss-tooling/milestones/m2/commands/supervise.md`.

## 8. Operational Notes

- **Configuration.** The family adds no configuration key. Its bounds are contract data imported from the delivered homes; a future supervise-specific corroboration bound would join the configuration layer rather than become a magic value.
- **Observability.** The report is the observability surface: counts per state, claim tri-states, applied actions with evidence, and declared degradation per run. The durable park, restart, exhaustion, and question records the actions append are the audit trail; the restart, exhaustion, and question records carry the invocation's injected run identity so an action correlates to the run that caused it. No new metrics emitter, log stream, or telemetry topic exists.
- **Read cost.** One whole-store fold per run covering the verdicts and the action path; no per-lane re-read, the blocker ledger is read at most once per run, and the human projection adds no read.
- **Failure posture.** A refused action lands nothing; an unreadable store presents no partial report as truth; an all-unknown scope presents the classified exit-2 answer instead of a guessed verdict.
- **Security posture.** The report carries refs, holders, record instants, tri-states, and evidence codes — never lock tokens, session identifiers, process identifiers, credentials, or message content. The battery adds no network surface and never signals a process.

## 9. Glossary

| Term | Definition |
|---|---|
| Supervisor battery | The operator-invoked `supervise` run: one scoped fold, one report, and the declared actions. |
| Tri-state | The closed classification set `progressing`, `stalled`, `unknown`, in that order. |
| Artifact evidence | The durable state-ledger record set plus the artifact trail those records reference; the only classification input. |
| Lying liveness | Claimed or recorded aliveness contradicted by a flat artifact trail across the observation span; classifies `stalled`. |
| Observation span | The delivered corroboration bound (`WATCHDOG_STALL_HEARTBEAT_MS`, 300,000 ms) window ending at the run instant. |
| Corroboration | The only `stalled` combination: heartbeat evidence present, no advancing artifact inside the span, and the heartbeat trail aged or spanning the span. |
| Supervision claim | A durable assertion that something supervises: a daemon instance claim, a coordinator ledger-lease claim, or a live per-ref lease. Claims always classify and name holders in report data and are never themselves a refusal. |
| Acting authority | A supervision authority actively acting over the same object a battery action targets, evidenced by a pending daemon preemption record inside the observation span; only such an authority triggers the duplicate-supervision refusal. |
| Supervised-stall park | A park record carrying cause `liveness-stall` with a non-null re-entry instant, battery-written only through the delivered park machinery; the operator path refuses the cause by name. |
| Safe-boundary park intent | The supervised-stall park over a lane holding a live lease: the durable park record lands, the running session observes it at its next boundary, and no process is signalled. |
| Re-entry instant (`until`) | The declared stall recheck horizon: the run instant plus the mapped `provider-window` recheck default (60,000 ms); surfaced additively on the parked lane read, and governing later battery actions so a run inside the horizon appends nothing. |
| Unknown | The classified answer when the artifact-evidence source is absent; never a guessed verdict or a defaulted zero. |
| Supervise-only mode | The delivered daemon composition fact: the resident daemon family runs without a lane composition. |

## 10. Related

- [Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md) — the liveness classification and verdict vocabulary, the corroboration bound, the prefill-safe rule, and the no-CPU discipline this battery consumes.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — the instance, heartbeat, lane, reconciliation, and preemption records the fold reads, the safe-boundary discipline, and the restart economics it composes.
- [Scheduling Engine](feature-scheduling-engine.md) — the park record family, the cause/condition vocabulary extended by `liveness-stall`, the single-flight refusal, and the lane projection carrying the additive `until`.
- [Provider Peak Pausing](feature-peak-pausing.md) — the many-to-one cause-to-condition mapping pattern the supervised-stall cause follows.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the restart budget, resume economics, terminal exhaustion record, and amplification view the battery composes.
- [Dispatch Engine](feature-dispatch-engine.md) — the per-ref admission predicate and attempt records consumed as claim and artifact evidence.
- [Coordinator Supervision](feature-coordinator-supervision.md) — the ledger-lease claim kind and the identity-verified process seams the battery does not use.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the `{0, 1, 2}` projection, the two `supervise` rows, and the 64-member two-segment allowlist.
- [State Layer](feature-state-layer.md) — the additive record kinds, fenced appends, and verified reads the fold and the writes ride.
- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the prompt-required composition and the 24th family mount.
- [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [TDR-0025](../../decisions/TDR-0025-public-event-taxonomy-v1-subscribe-surface.md), [TDR-0027](../../decisions/TDR-0027-command-failure-envelope-detail-slot.md), [TDR-0028](../../decisions/TDR-0028-no-nomination-classified-admission-refusal.md) — the architecture and decision records the composition follows.

**Change record:** `doc/changes/2026-11/2026-11-16--GH-295--supervise/` — the supervisor battery, the artifact-evidence tri-state fold, lying-liveness detection, the supervised-stall park cause and additive lane `until`, duplicate-supervision refusal, restart-policy composition, and the two error identities.
