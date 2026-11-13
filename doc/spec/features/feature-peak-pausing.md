---
ados_distribution: internal
id: SPEC-PEAK-PAUSING
status: Current
created: 2026-11-13
last_updated: 2026-11-13
owners: ["engineering"]
service: delivery-os
summary: "Provider-aware peak pausing (M2-S17): the provider profile nominated at dispatch admission and recorded on lane and attempt records with the classified no-nomination pre-session refusal, peak-window rules as versioned per-profile data (windows, multipliers, buffers, grace bounded by the buffer, fail-closed validation, UTC-only), the resident daemon's window watch with bounded-grace in-flight parking and the preserved|session-state-not-preserved classification, classification-routed window-end resume from preserved session state or the delivered interrupted-lane recovery with per-profile isolation and owner-hold precedence, taxonomy v2 stop/parked/resumed/park-edge episode events, the window-scoped zero-spend evidence over telemetry v2 with classified absence, the status/brief/lanes park surfaces, and the declared daemon-absent degradation to iteration-start gating."
links:
  related_changes: ["GH-294"]
  related_decisions: ["TDR-0025", "TDR-0028", "TDR-0029", "TDR-0030"]
  contracts:
    - "packages/core/src/contracts/provider-profile.ts"
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/contracts/taxonomy.ts"
    - "packages/core/src/contracts/status.ts"
    - "packages/core/src/contracts/spend.ts"
    - "packages/core/src/domain/daemon-peak-pause.ts"
---

# Feature: Provider Peak Pausing

> **Role of this Document:** Source of truth for the delivered provider-aware peak-pausing capability (M2-S17): nomination, rule data, in-flight enforcement, window-end resume, spend evidence, surfaces, and degradation. The composing features keep their own pages: profiles and admission gating in [Provider Profiles](feature-provider-profiles.md), the daemon loop in [Resident Dispatch Daemon](feature-resident-daemon.md), admission and attempt records in [Dispatch Engine](feature-dispatch-engine.md), park vocabulary in [Scheduling Engine](feature-scheduling-engine.md), kinds in [Event Taxonomy v2](feature-event-taxonomy.md), and the evidence read in [Spend Read Side](feature-spend.md).

## 1. Overview

Peak pausing extends provider peak windows from dispatch-admission gating to in-flight enforcement. Every delivery nominates its provider profile at admission; the resident daemon watches the nominated profiles' declared windows and parks in-flight lanes whose profile enters peak (bounded-grace stop, session state preserved); when the window ends the parked lanes resume automatically — from preserved session state where preservation succeeded, otherwise through the delivered interrupted-lane recovery — same branch, never a fresh re-dispatch. Telemetry proves zero billable model calls during the window, stop/park/resume land as taxonomy v2 ledger events surfaced in status and brief, and without a resident daemon the behavior degrades to the delivered iteration-start gating with the difference declared.

Lanes on other providers are untouched throughout: the park and resume decisions read only a lane's recorded nomination and that profile's window state. With no window declared for a profile, that profile has no peak enforcement and behaves exactly as delivered.

## 2. Nomination at admission

Every admitted delivery records its nominated provider profile as the additive `providerProfile` field on the dispatch attempt record family (`delivery.dispatch.attempt.v1`) and on the daemon lane record family, on both admission paths (one-shot `dispatch` and the composed daemon supervision claim); the attempt-history read, the lanes read, and the records agree. The nomination is a stored record field, never a rendering-time inference, and no read defaults, guesses, or borrows a profile.

A delivery that cannot nominate is refused at dispatch admission as a classified **pre-session refusal** — no lease, attempt, lane, or queue record and no event — carrying the provider-profile resolve identity for its shape: `provider.profile.absent` (empty or chain-less branch), `provider.profile.invalid` (invalid explicit nomination), or `provider.profile.capability-denied` at exit `1`, and `provider.profile.unavailable` (all candidates ineligible) at exit `2` with the eligibility list. No `dispatch.*` identity is added. The nomination gate runs immediately after input validation and before the credential preflight, the owner-hold gate, and the lease/single-flight predicates. There is no dispatch-default nomination: the preference chain's base profile remains the declared default through the normal resolve seam. Resumes never re-nominate — a pre-change lane resumes on its recorded absence, classified, and is simply not window-pausable (TDR-0028).

## 3. Peak-window rules as per-profile data

Each profile under `provider.profiles` may declare a `peakWindows` branch as versioned rule data:

| Field | Shape | Rule |
|---|---|---|
| `windows[]` | list | Each window declares `timezone` (`UTC` designation only), `startSecondsOfDay`, `endSecondsOfDay`, `multiplier`, `bufferBeforeSeconds`, `bufferAfterSeconds`. |
| `multiplier` | number ≥ 1 | Declared cost-accounting data; it never prices or converts spend. |
| `bufferBeforeSeconds` / `bufferAfterSeconds` | non-negative integers | The window opens at `start − bufferBefore` and its effective end is `end + bufferAfter`; the buffers bound the grace. |
| `graceSecondsDefault` | required integer | The profile's default bounded-grace stop bound. |
| `graceSecondsMax` | derived | The smallest declared buffer across the profile's windows, computed at parse time and exposed on the parsed value, so the applied grace can never outlast the buffer protecting the window. |

Validation is fail-closed and classified: only the `UTC` designation validates — any non-UTC zone literal is a validation refusal naming the field — an exact-duplicate window (same start and end) on one profile refuses as ambiguous, distinct overlapping windows validate without arbitration (enforcement unions the intervals; multipliers are never reconciled), a `graceSecondsDefault` above the derived maximum is a validation error, and every malformed field names the offending field and returns no partial decision. A profile with no `peakWindows` branch has no peak enforcement. Windows are declared and evaluated on the UTC basis only (DEC-1); the schema is validated at configuration time, so drift fails fast and classified.

## 4. Window watch and in-flight parking

The supervision cycle runs the profile-window watch once per cycle, before action handling. `decidePeakStops` reads each in-flight lane's recorded nomination and only that profile's window state against the injected clock: when a profile's window is open (buffer included), every in-flight lane nominated to it receives a bounded-grace stop whose deadline is recorded (`graceDeadline`), and the lane lands parked with reason `peak-window`, the profile named, `until` at the effective window end, and the recorded stop instant — one `queue.park` record per episode, appended under one fence, exactly once, with read-time expiry and no in-place mutation. The applied grace never exceeds `graceSecondsMax`. Lanes on other providers keep running, keep their leases, and keep their supervision unchanged for the whole window (per-profile isolation).

Session state is preserved so the episode is resumable, and the park carries the additive closed-value preservation classification `preserved | session-state-not-preserved` (TDR-0030). A preservation failure never refuses the park and never extends the grace: the lane still parks for the window with the classification naming the outcome. The stop composes with the delivered supervision, liveness, and safe-boundary contracts and adds no kill path; every lane parks within one observed supervision cycle of the window-open observation.

An active owner hold does not change the watcher: the hold is a read-time gate that parks nothing and writes no park record, so the watcher still parks `peak-window` with `until`; the hold's precedence manifests at claim and resume admission ([Scheduling Engine](feature-scheduling-engine.md), [Resident Dispatch Daemon](feature-resident-daemon.md)).

## 5. Window-end resume

At the effective window end (buffer included), observed by read-time expiry with no timer, `decidePeakResumes` routes every lane parked for that window by its preservation classification:

- **`preserved`** — the delivered session resume path: attach-and-continue on the same branch, the preserved session identity intact, consuming no restart ordinal and no fresh spawn.
- **`session-state-not-preserved`** — the delivered interrupted-lane recovery: resume from the ledger position on the same branch, exactly one restart ordinal under the restart budget and resume economics; budget exhaustion appends the delivered terminal exhaustion record and raises a typed question — never a silent requeue and never an automatic fresh re-dispatch. This recovery is a restart admission, not a session resume, and emits no `resumed` event; the episode's ledger truth is exactly one `stop` plus one `parked` carrying the failure classification.

Resume is automatic: zero operator commands, zero dispatch invocations; the decision derives solely from the window-end observation. The resumed lane's branch, artifacts, and queue state are unchanged by the episode — nothing is lost, nothing duplicated — and per-ref single-flight holds the ref through the parked interval. Isolation holds through resume: only the parked profile's lanes resume at its window end.

While an owner hold is active, the hold outranks the window: the lane stays parked under its existing park record (byte-unchanged), the hold writes no park record of its own, and window-end resume admission refuses `queue.precondition.unmet` with reason `owner-hold`, appending nothing; resume proceeds once the hold clears. No synthetic owner-hold park record is ever created by the watch or resume paths.

## 6. Episode events (taxonomy v2)

Each peak-pause episode is ledger evidence under the declared taxonomy **v2** — the single spoken version; v1 is retired, never served concurrently, and every v1 kind and payload stays byte-identical (TDR-0029):

| Topic | Kind | Payload fields |
|---|---|---|
| `dispatch.attempt` | `stop` | `ref`, `graceDeadline`, `providerProfile`, `windowEnd`, `stoppedAt`, `episodeId` |
| `dispatch.attempt` | `parked` | `ref`, `reason`, `providerProfile`, `until`, `preservation`, `recordedAt`, `episodeId` |
| `dispatch.attempt` | `resumed` | `ref`, `sessionRef`, `branch`, `reDispatched`, `resumedAt`, `episodeId` |
| `queue.graph` | `park-edge` | `ref`, `cause`, `until?`, `episodeId`, `recordedAt` |

Exactly one `stop`, `parked`, `resumed`, and `park-edge` lands per episode across many supervision ticks; the shared `episodeId` reconstructs the episode from the ledger alone. A parked-state record emits `stop`, `parked`, and `park-edge` once; a recovered record emits `resumed` with the no-re-dispatch fact (`reDispatched: false`); an `owner-hold` park emits `park-edge` with `until` as a classified absence; the delivered park causes emit nothing. Every kind stays within the bounded-evidence budget (≤ 20 payload fields, ≤ 1024 bytes). The full envelope, ordering, overflow, and v1-compatibility contract is specified in [Event Taxonomy v2](feature-event-taxonomy.md).

## 7. Zero-spend evidence

The spend read side provides a window-scoped zero-spend reading over the telemetry v2 attribution join: the count of billable model calls attributable to the parked lane (the lane dimension) from the park timestamp through the window end, **both boundary instants inclusive**. `spend --window-evidence --from <iso> --through <iso>` surfaces it; the reading names its basis (`delivery.telemetry.storage.v1`) and discloses the matched and excluded step positions with their boundary reasons (`pre-park`, `post-window`), so the scoping is visible rather than implied.

Zero is a positive reading backed by present telemetry; telemetry absence is a classified outcome carried by `telemetryState` and the count is absent with it — never fabricated as zero. A seeded mid-window call reads non-zero: the assertion is a count and can fail. The reading performs no harness-store query of its own.

## 8. Surfaces

- **`queue release --park peak-window --until <iso>`** — the expiry-carrying window cause: `--until` is required, as for `provider-window`. **`queue release --park owner-hold`** — refuses `--until`; an owner-hold park's `until` is a declared classified absence (the hold is a read-time gate with no expiry — DEC-12), and the invoked command is the one writer of an owner-hold park record: the hold itself writes none, and neither the watcher nor the window-end resume path creates a synthetic one.
- **`lanes`** — the `parked:<cause>` projection gains `parked:peak-window` and `parked:owner-hold` beside the delivered three, which render unchanged. The `lanes --json` machine read carries `peakEnforcement: { mode, parkClaimed }` (`window-watch` with a resident daemon; `iteration-start-gating` without one), with `parkClaimed` read from durable park records — the fold never claims a park that did not happen.
- **`status`** — the providers section gains the bounded `laneParks[]` park fields (`ref`, `reason`, `until`, `preservation`, `providerProfile`) for open episodes, read in the same collector pass and carried verbatim from the park records; fields clear after the episode closes and an owner-hold `until` renders absent.
- **`brief`** — the providers surface projects the identical park fields with zero added reads, rendering one `lane-park <ref> <reason> until=<instant|absent> <preservation>` line per open episode.

## 9. Daemon-absent degradation

Without a resident daemon there is no window watcher and no mid-flight park. Behavior degrades to the delivered iteration-start gating: profiles in window are ineligible for new dispatches at admission, exactly as delivered. The degradation is declared in the machine read — `peakEnforcement: { mode: "iteration-start-gating", parkClaimed: false }` on the lanes read, projected from the same collector facts into status and brief — and no surface reports a parked lane, a stop, or a resume that did not happen. Daemon-absent runs synthesize no zero-spend episode reading for a park that never happened.

## 10. Testing

| Level | Suites | Scope |
|---|---|---|
| Rules data | `provider-peak-rules-schema` | Round-trip, derived grace bound, the fail-closed matrix including the non-UTC refusal, duplicate-refuses, and overlap-validates fixtures. |
| Nomination | `provider-nomination-admission` | Records agreement across both admission paths, the four refusal identities at their exits, claim parity, pre-change classified absence, no-default/no-guess/no-borrow. |
| Watch and park | `daemon-peak-window-park` | Window-open stop with deadline, park record under one fence, grace-bound matrix, supervision-cycle bound, preservation-failure parking, stay-parked. |
| Resume and isolation | `daemon-peak-window-isolation`, `daemon-peak-window-resume` | Set-equality isolation matrix, preserved resume, recovery routing, budget exhaustion, owner-hold precedence with record-level no-append. |
| Evidence | `spend-zero-window` | Present zero, absence classified, inclusive boundary scoping, seeded-breach falsifiability. |
| Surfaces and events | `status-brief-park-fields`, `queue-park-causes-s17`, `pause-episode-events`, `event-taxonomy-v2-compat` | Park fields with value agreement, the `--until` rules and writer enumeration, exactly-once episode events with bounds, the six-point v1-compatibility statement. |
| Degradation and invariants | `daemon-absent-degradation`, `peak-window-utc-clock`, `peak-pause-determinism`, `peak-pause-hermetic` | Mode-declared no-false-claims, UTC boundary and DST matrices, paired-run byte determinism, zero live network/credential/sleep. |

## 11. Related

- [Provider Profiles](feature-provider-profiles.md) — the profiles branch, the resolve seam the nomination reads, and the delivered iteration-start gating.
- [Dispatch Engine](feature-dispatch-engine.md) — the admission order, attempt records, restart budget, and resume economics the nomination and recovery consume.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — the supervision cycle the watch rides and the lane composition requirement.
- [Scheduling Engine](feature-scheduling-engine.md) — the park record family, cause/condition vocabulary, owner hold, and the lanes surfaces.
- [Event Taxonomy v2](feature-event-taxonomy.md) — the declaration, envelope, and v1-compatibility contract the episode events join.
- [Spend Read Side](feature-spend.md) — the window-evidence form and its `telemetryState` disclosure.
- [Harness Telemetry v2](feature-telemetry-v2.md) — the storage identity and attribution join the evidence counts over.
- [Status Digest](feature-status-digest.md) and [Brief](feature-brief.md) — the park-field surfaces.
- [TDR-0028](../../decisions/TDR-0028-no-nomination-classified-admission-refusal.md), [TDR-0029](../../decisions/TDR-0029-event-taxonomy-v2-peak-pause-kinds.md), [TDR-0030](../../decisions/TDR-0030-park-preservation-failure-classification.md) — the binding decisions for the refusal, the taxonomy version, and the preservation classification.
