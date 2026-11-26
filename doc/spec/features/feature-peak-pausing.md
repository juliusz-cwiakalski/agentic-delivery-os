---
ados_distribution: internal
id: SPEC-PEAK-PAUSING
status: Current
created: 2026-11-13
last_updated: 2026-11-26
owners: ["engineering"]
service: delivery-os
summary: "Provider-aware peak pausing (M2-S17, extended by GH-413): the provider profile nominated at dispatch admission and recorded on lane and attempt records with the classified no-nomination pre-session refusal, the additive nomination on every active dispatch lane record, peak-window rules as versioned per-profile data (windows, multipliers, buffers, grace bounded by the buffer, fail-closed validation, declared-zone grammar), the profile-window watch owned by the composition that owns the lane (the resident daemon for supervised lanes, the one-shot dispatch run path for the lane it started) with bounded-grace in-flight parking, standing-park occupancy and recovery, the preserved|session-state-not-preserved classification, classification-routed window-end resume from preserved session state or the delivered interrupted-lane recovery with per-profile isolation and owner-hold precedence, the operator `dispatch stop` for the peak-window cause, taxonomy v2 stop/parked/resumed/park-edge episode events, the window-scoped zero-spend evidence over telemetry v2 with classified absence, the status/brief/lanes/board park surfaces, and the configuration-derived composition-fact peak-enforcement read with the declared degradation to iteration-start gating when no composition supplies the watch."
links:
  related_changes: ["GH-294", "GH-297", "GH-287", "GH-295", "GH-293", "GH-350", "GH-377", "GH-413"]
  related_decisions: ["TDR-0025", "TDR-0028", "TDR-0029", "TDR-0030", "ADR-0013", "TDR-0077", "TDR-0078"]
  contracts:
    - "packages/core/src/contracts/provider-profile.ts"
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/contracts/taxonomy.ts"
    - "packages/core/src/contracts/status.ts"
    - "packages/core/src/contracts/spend.ts"
    - "packages/core/src/domain/daemon-peak-pause.ts"
    - "packages/core/src/app/dispatch-peak-pause.ts"
    - "packages/core/src/app/dispatch.ts"
---

# Feature: Provider Peak Pausing

> **Role of this Document:** Source of truth for the delivered provider-aware peak-pausing capability (M2-S17, extended for dispatch-started lanes): nomination, rule data, in-flight enforcement by the composition that owns the lane, window-end resume, the operator stop, spend evidence, surfaces, and degradation. The composing features keep their own pages: profiles and admission gating in [Provider Profiles](feature-provider-profiles.md), the daemon loop in [Resident Dispatch Daemon](feature-resident-daemon.md), admission, attempt records, and the `dispatch` operator surface in [Dispatch Engine](feature-dispatch-engine.md), park vocabulary in [Scheduling Engine](feature-scheduling-engine.md), kinds in [Event Taxonomy v2](feature-event-taxonomy.md), and the evidence read in [Spend Read Side](feature-spend.md).

## 1. Overview

Peak pausing extends provider peak windows from dispatch-admission gating to in-flight enforcement. Every delivery nominates its provider profile at admission; the composition that owns a lane watches the nominated profile's declared windows and parks in-flight lanes whose profile enters peak (bounded-grace stop, session state preserved); when the window ends the parked lanes resume automatically — from preserved session state where preservation succeeded, otherwise through the delivered interrupted-lane recovery — same branch, never a fresh re-dispatch. Telemetry proves zero billable model calls during the window, stop/park/resume land as taxonomy v2 ledger events surfaced in status and brief, and a composition that supplies no watch degrades to the delivered iteration-start gating with the difference declared.

A lane is watched by the composition that owns it. The resident daemon watches the lanes it supervises; a one-shot `dispatch` invocation watches the lane it started, at every observation for that lane's whole life, through the same decision functions, rule data, and injected clock, so the two compositions cannot drift into different answers for the same profile and instant. The dispatch-owned watch parks, keeps the lane's repository lease live through the pause, waits for the recorded end, resumes inside the same invocation, and returns one result; `dispatch stop <ref>` requests the same bounded-grace stop from an operator ([Dispatch Engine](feature-dispatch-engine.md)).

Lanes on other providers are untouched throughout: the park and resume decisions read only a lane's recorded nomination and that profile's window state. With no window declared for a profile, that profile has no peak enforcement and behaves exactly as delivered; only a profile that declares `peakWindows` is pausable, and the shipped defaults declare none.

## 2. Nomination at admission

Every admitted delivery records its nominated provider profile as the additive `providerProfile` field on the dispatch attempt record family (`delivery.dispatch.attempt.v1`) and on the daemon lane record family, on both admission paths (one-shot `dispatch` and the composed daemon supervision claim). The durable **dispatch** lane record additionally carries the nomination on **every** `active` record the invocation appends — the first acquisition and every restart or post-park resume iteration — so a latest-wins read always finds it and the watch, a stop issued by another process, the park and event payloads, and a resume after a killed invocation all read a stored field rather than an in-memory value or a rendering-time inference. It is absent on pre-change records and is never fabricated, defaulted, or inferred; a lane recorded without it is not window-pausable. The surfaces that carry the nomination are the attempt history, the daemon lane records, the dispatch lane records, the `dispatch status` lane facts and park fact, the `status.laneParks[]` park fields, the board's `PARKED` section, and the window-scoped spend evidence. The nomination is a stored record field, never a rendering-time inference, and no read defaults, guesses, or borrows a profile.

**Known limitation (lanes read).** `QueueLane` carries no `providerProfile` member and the `lanes` read projects none, so a `lanes list` reader cannot attribute a running lane to a provider profile from that read alone; the declared surfaces above are the ones that carry it. This is a declared limitation of the lanes projection, not a capability the read claims.

A delivery that cannot nominate is refused at dispatch admission as a classified **pre-session refusal** — no lease, attempt, lane, or queue record and no event — carrying the provider-profile resolve identity for its shape: `provider.profile.absent` (empty or chain-less branch), `provider.profile.invalid` (invalid explicit nomination), or `provider.profile.capability-denied` at exit `1`, and `provider.profile.unavailable` at exit `2` with the eligibility list. That exit-`2` refusal has two causes: every candidate profile is ineligible, or the refusal is seat-level — the selected profile is eligible but its effective seat model names a recorded-unavailable provider and no later profile supplies the seat. No `dispatch.*` identity is added. The nomination gate runs immediately after input validation and before the credential preflight, the owner-hold gate, and the lease/single-flight predicates. There is no dispatch-default nomination: the preference chain's base profile remains the declared default through the normal resolve seam. Resumes never re-nominate — a pre-change lane resumes on its recorded absence, classified, and is simply not window-pausable (TDR-0028).

## 3. Peak-window rules as per-profile data

Each profile under `provider.profiles` may declare a `peakWindows` branch as versioned rule data:

| Field | Shape | Rule |
|---|---|---|
| `windows[]` | list | Each window declares `timezone` (`UTC` or an IANA zone name matching the declared grammar), `startSecondsOfDay`, `endSecondsOfDay`, `multiplier`, `bufferBeforeSeconds`, `bufferAfterSeconds`. |
| `multiplier` | number ≥ 1 | Declared cost-accounting data; it never prices or converts spend. |
| `bufferBeforeSeconds` / `bufferAfterSeconds` | non-negative integers | The window opens at `start − bufferBefore` and its effective end is `end + bufferAfter`; the buffers bound the grace. |
| `graceSecondsDefault` | required integer | The profile's default bounded-grace stop bound. |
| `graceSecondsMax` | derived | The smallest declared buffer across the profile's windows, computed at parse time and exposed on the parsed value, so the applied grace can never outlast the buffer protecting the window. |

Validation is fail-closed and classified: a malformed zone literal refuses naming the field, a grammar-valid zone the composition cannot resolve refuses `provider.peak.zone-unknown` at the edge, an exact-duplicate window (same start and end) on one profile refuses as ambiguous, distinct overlapping windows validate without arbitration (the park end is the effective end of the first open window, so overlapping windows produce consecutive exactly-once episodes rather than one merged park, and multipliers are never reconciled), a `graceSecondsDefault` above the derived maximum is a validation error, and every malformed field names the offending field and returns no partial decision. A profile with no `peakWindows` branch has no peak enforcement. Windows are declared and evaluated on their declared zone's clock (ADR-0013 as revised), through the same `peakWindowEndInstantMs` derivation the admission gate uses, so a lane parks and resumes at the instant the gate computed; the schema is validated at configuration time, so drift fails fast and classified.

## 4. Window watch and in-flight parking

The supervision cycle runs the profile-window watch once per cycle, before action handling, when the composition supplies the peak-pause ports. `decidePeakStops` reads each in-flight lane's recorded nomination and only that profile's window state against the injected clock: when a profile's window is open (buffer included), every in-flight lane nominated to it receives a bounded-grace stop whose deadline is recorded (`graceDeadline`), and the lane lands parked with reason `peak-window`, the profile named, `until` at the effective window end, and the recorded stop instant — one `queue.park` record per episode, appended under one fence, exactly once, with read-time expiry and no in-place mutation. The applied grace never exceeds `graceSecondsMax`. Lanes on other providers keep running, keep their leases, and keep their supervision unchanged for the whole window (per-profile isolation).

Session state is preserved so the episode is resumable, and the park carries the additive closed-value preservation classification `preserved | session-state-not-preserved` (TDR-0030). A preservation failure never refuses the park and never extends the grace: the lane still parks for the window with the classification naming the outcome. The stop composes with the delivered supervision, liveness, and safe-boundary contracts and adds no kill path; every lane parks within one observed supervision cycle of the window-open observation.

An active owner hold does not change the watcher: the hold is a read-time gate that parks nothing and writes no park record, so the watcher still parks `peak-window` with `until`; the hold's precedence manifests at claim and resume admission ([Scheduling Engine](feature-scheduling-engine.md), [Resident Dispatch Daemon](feature-resident-daemon.md)).

### Dispatch-owned watch (one-shot lanes)

The one-shot `dispatch` run path composes the same profile-window watch for the lane it started, evaluated at every observation from the lane's first session acquisition to its terminal classification, through the same `decidePeakStops` / `runPeakWatch` decision layer and the same injected clock the daemon uses. Only the composition's own effective configuration decides whether the watch runs: automatic pausing is on unless `lane.disable-peak-pausing` is `true` ([Configuration Layer](feature-config-layer.md)). The rule source is the nominated profile's `peakWindows` branch, read from the lane's nomination — the profile the invocation resolved at admission and wrote on every `active` lane record, so a separately invoked stop and a later resume read the same stored value — with the delivered first-open-window end; a chain whose first entry declares no windows does not exempt a lane nominated to a later profile that does.

The episode is framed exactly as a daemon-owned one, with the one composed grace. Before its first stop decision the run path closes an expired standing `peak-window` park for the reference through the delivered mutating park pass (`recoverQueueParks`: the clear-observed marker, the recovered record, and the `park-auto-recovery` incident), so an episode that ended abnormally cannot leave a second active park behind. A standing `peak-window` park is occupancy: it suppresses a new stop whatever its `until`, because two active parks for one reference permanently degrade every park-reading surface through the delivered duplicate invariant. An **un-expired** standing park is a pre-session refusal, not an operator override: at the admission of a resume or a re-dispatch, beside the other admission refusals and before any session starts, the run is refused `dispatch.resume-parked` ([Result Contract and Error Table](feature-result-contract.md)) at exit `2`, naming the park's cause and `until`, and writes nothing — no session, no park, no event — while `lanes` and `board` keep showing the lane parked. Once the park has expired, the run proceeds and the first observation recovers it. An expired park the pass cannot recover refuses the run with a classified failure, no new episode, and no park written.

The lane stays single-flight for the whole pause. Because the delivered lease is stale at `queue.lease-ttl` (90 000 ms default) and the dispatch claim never renews, the invocation renews the existing repository lease through the delivered same-holder path at `min(lane.liveness-interval, queue.lease-ttl / 2)` for the run and the park, so the heartbeat cannot reach the TTL between renewals even when the liveness interval is at or above it ([TDR-0078](../../decisions/TDR-0078-lease-heartbeat-amends-tdr-0050.md)). The renewal is a no-op unless the live lease's latest heartbeat is the invocation's own last write: a re-dispatch's admission claim preserves the lease identity and appends a newer heartbeat, so the earlier invocation's remembered instant stops matching, its renewal appends and extends nothing, surfaces the bounded evidence `lease:not-owned`, and it performs no owner act on the lane — it observes to its own session's end and returns with `lease:not-owned`, leaving the successor's lease alone. The renewal never acquires, takes over, or displaces, and it does not pass the owner-hold gate, so a parked lane under a hold keeps renewing.

A parked dispatch lane stays parked until the recorded end or an owner act:
- The owning invocation returns a classified result when the delivered recovery refuses without being terminal, leaving the lane parked, the refusal on the result's bounded episode fact, and the lease released so the delivered operator resume path can take the reference.
- A terminated or dead owner leaves the park standing and the lane record's nomination intact; the delivered derivation reports `stale: true` truthfully, and the next invocation or the operator resume path recovers the park before any new episode.

`dispatch stop <ref> --cause peak-window --until <iso>` requests the same bounded-grace stop from an operator and writes the complete watcher-shaped episode frame only after a confirmed terminate ([Dispatch Engine](feature-dispatch-engine.md), [TDR-0077](../../decisions/TDR-0077-dispatch-owned-window-watch.md)).

**Declared residual.** A dispatch admitted while its nominated profile's window is already open is not refused at admission: it spawns and is parked at the first observation, so one observation cadence (`lane.liveness-interval`, 30 000 ms default) plus the applied grace (bounded by `coordinator.kill-grace`, 20 000 ms default) of billing precedes the park, and no billable call follows the park instant because calls already in flight complete during the stop grace. No pre-session park exists.

## 5. Window-end resume

At the effective window end (buffer included), observed by read-time expiry with no timer, `decidePeakResumes` routes every lane parked for that window by its preservation classification:

- **`preserved`** — the delivered session resume path: attach-and-continue on the same branch, the preserved session identity intact, consuming no restart ordinal and no fresh spawn.
- **`session-state-not-preserved`** — the delivered interrupted-lane recovery: resume from the ledger position on the same branch, exactly one restart ordinal under the restart budget and resume economics; budget exhaustion appends the delivered terminal exhaustion record and raises a typed question — never a silent requeue and never an automatic fresh re-dispatch. This recovery is a restart admission, not a session resume, and emits no `resumed` event; the episode's ledger truth is exactly one `stop` plus one `parked` carrying the failure classification.

Resume is automatic: zero operator commands, zero dispatch invocations; the decision derives solely from the window-end observation. The resumed lane's branch, artifacts, and queue state are unchanged by the episode — nothing is lost, nothing duplicated — and per-ref single-flight holds the ref through the parked interval. Isolation holds through resume: only the parked profile's lanes resume at its window end.

Resume admission re-evaluates the same nominated profile's window rules and never resumes a lane into an observed open window: safety outranks punctuality, so a rule change during an episode can only defer a resume, never advance it. When the delivered not-preserved recovery refuses without being terminal (the uneconomical-resume and unverifiable-state refusals), the owning invocation returns one classified result instead of waiting again; the lane stays parked, and the delivered operator resume path is the manual route.

A dispatch-owned episode resumes inside the same invocation, so one `dispatch` invocation spans the episode and returns one result; [Dispatch Engine](feature-dispatch-engine.md) states its wait and the returned result.

While an owner hold is active, the hold outranks the window: the lane stays parked under its existing park record (byte-unchanged), the hold writes no park record of its own, and window-end resume admission refuses `queue.precondition.unmet` with reason `owner-hold`, appending nothing; resume proceeds once the hold clears. No synthetic owner-hold park record is ever created by the watch or resume paths.

## 6. Episode events (taxonomy v2)

Each peak-pause episode is ledger evidence under the declared taxonomy **v2** — the single spoken version; v1 is retired, never served concurrently, and every v1 kind and payload stays byte-identical (TDR-0029):

| Topic | Kind | Payload fields |
|---|---|---|
| `dispatch.attempt` | `stop` | `ref`, `graceDeadline`, `providerProfile`, `windowEnd`, `stoppedAt`, `episodeId` |
| `dispatch.attempt` | `parked` | `ref`, `reason`, `providerProfile`, `until`, `preservation`, `recordedAt`, `episodeId` |
| `dispatch.attempt` | `resumed` | `ref`, `sessionRef`, `branch`, `reDispatched`, `resumedAt`, `episodeId` |
| `queue.graph` | `park-edge` | `ref`, `cause`, `until?`, `episodeId`, `recordedAt` |

Exactly one `stop`, `parked`, `resumed`, and `park-edge` lands per episode across many supervision ticks or observations; the shared `episodeId` reconstructs the episode from the ledger alone. The producers are the composition that owns the lane and the operator stop: the daemon's watch for the lanes it supervises, the dispatch-owned watch for the lane a one-shot invocation started, and `dispatch stop <ref>` for a running lane, which admits the `peak-window` cause only and writes its frame only after a confirmed terminate. The `stop` and `parked` frames are the watcher's episode frames: they emit only over a `peak-window` record whose DM-4 episode fields are complete — a non-empty `episodeId` and grace deadline, the window end and stop instant, and the closed-value preservation classification — and the `providerProfile` they carry is the lane's nomination, never re-resolved at park time. A recovered record emits `resumed` with the no-re-dispatch fact (`reDispatched: false`); a `preserved` standing park closed by the recovery pass projects one `resumed` frame with an empty `sessionRef` and `branch` under its original episode id, whether or not a session resumed; an `owner-hold` park emits `park-edge` with `until` as a classified absence; an operator-shaped `peak-window` park — the release writer stamps only the minimal episode identity and the operator-declared `until` — emits the `park-edge` alone, never a `stop` or `parked` frame and never a preservation value outside the closed set; the delivered park causes emit nothing. Where the nominated profile's windows overlap in effect, each episode is framed separately, so one lane can produce consecutive episodes. Every kind stays within the bounded-evidence budget (≤ 20 payload fields, ≤ 1024 bytes). The full envelope, ordering, overflow, and v1-compatibility contract is specified in [Event Taxonomy v2](feature-event-taxonomy.md).

## 7. Zero-spend evidence

The spend read side provides a window-scoped zero-spend reading over the telemetry v2 attribution join: the count of billable model calls attributable to the parked lane (the lane dimension) from the park timestamp through the window end, **both boundary instants inclusive**. `spend --window-evidence --from <iso> --through <iso>` surfaces it; the reading names its basis (`delivery.telemetry.storage.v1`) and discloses the matched and excluded step positions with their reasons from the closed set (`pre-park`, `post-window`, `other-lane`, `unreadable-instant`), so the scoping is visible rather than implied.

Zero is a positive reading backed by present telemetry; telemetry absence is a classified outcome carried by `telemetryState` and the count is absent with it — never fabricated as zero. A seeded mid-window call reads non-zero: the assertion is a count and can fail. The reading performs no harness-store query of its own.

## 8. Surfaces

- **`queue release --park peak-window --until <iso>`** — the expiry-carrying window cause: `--until` is required, as for `provider-window`. The release writer stamps the record's minimal episode identity (`peak-<ref>-<nowIso>`) and the operator-declared `until`; the watcher's episode fields stay unwritten, so the record projects the `park-edge` alone. **`queue release --park owner-hold`** — refuses `--until`; an owner-hold park's `until` is a declared classified absence (the hold is a read-time gate with no expiry — DEC-12), and the invoked command is the one writer of an owner-hold park record: the hold itself writes none, and neither the watcher nor the window-end resume path creates a synthetic one. **`queue release --park liveness-stall`** — refused by name before any read or write: the supervised-stall cause is battery-written only, and the `supervise` battery always supplies its re-entry instant.
- **`lanes`** — the `parked:<cause>` projection gains `parked:peak-window` and `parked:owner-hold` beside the other delivered causes, and the supervised-stall cause `liveness-stall` renders through the same `parked:<cause>` template; every delivered render is unchanged. The `lanes --json` machine read carries `peakEnforcement: { mode, parkClaimed }`. The mode reflects the composition fact from the reading composition's own effective configuration: it is `window-watch` when automatic pausing is enabled and the profile-window watch is therefore composed, and `iteration-start-gating` when pausing is disabled or the composition supplies no watch — never an inference from daemon reachability, which says nothing about whether a watcher exists. `parkClaimed` is read from durable park records — the fold never claims a park that did not happen. A production dispatch composition with automatic pausing on therefore reads `window-watch`; that is the one intended value change to this payload.
- **`dispatch status <ref>`** — the dispatch lane view gains one additive optional park fact for the addressed lane, carried verbatim from the latest open `peak-window` park record: the cause, the park end, the recorded stop instant, the preservation classification, and the recovery refusal the park record carries when it carries one. It is absent when no park stands, and every delivered member and line is unchanged. The delivered `stale`/`delivering` derivation is untouched: `stale` is true exactly when the advisory owner probe is `dead` and `delivering` is its negation, so a healthy parked lane answers `stale: false` and `delivering: true`, and only an orphaned park answers `stale: true`, with the park fact explaining that nothing will resume it ([Dispatch Engine](feature-dispatch-engine.md)).
- **`status`** — the providers section gains the bounded `laneParks[]` park fields (`ref`, `reason`, `until`, `preservation`, `providerProfile`) for open episodes, read in the same collector pass and carried verbatim from the park records; fields clear after the episode closes and an owner-hold `until` renders absent.
- **`brief`** — the providers surface projects the identical park fields with zero added reads, rendering one `lane-park <ref> <reason> until=<instant|absent> <preservation>` line per open episode.
- **`board`** — the `PARKED` section is the open lane park-episode population (`peak-window` and `owner-hold` only) with `ref`, `reason`, `until`, optional `preservation`, and optional `providerProfile`; an owner-hold row carries the classified `owner-hold-no-expiry` absence, and a `provider-quota` park never appears. The host-wide owner hold is carried once on the board payload as `ownerHold` ([Board](feature-board.md)).

### Effect-surface mapping

A hold or a peak window is an *input* to admission and parking; the engine-visible
data an operator acts on is the effect it causes. The mapping is declared here, and
no read of the input itself exists:

| Input condition | Delivered engine-visible effect surfaces |
|---|---|
| Owner hold (host-wide, no expiry) | Dispatch admission refusal; queue blocking; `status.ownerHold`; board `ownerHold` |
| Peak window (evaluated on its declared zone) | Lane parks with `reason: "peak-window"`, `until`, `preservation`; `dispatch status` park fact; `status.laneParks`; brief park fields; `lanes` `peakEnforcement`; window-scoped spend evidence; `stop` and `parked` events |

A declared or currently open peak window has **no read surface** of its own: it is
not listed, polled, or projected as a window object. The composing features name the
same surfaces ([Dispatch Engine](feature-dispatch-engine.md),
[Resident Dispatch Daemon](feature-resident-daemon.md)), so the mapping is reachable
from the feature that composes the watch.

## 9. Composition-owned watching and degradation

A lane is watched by the composition that owns it: the resident daemon watches the lanes it supervises, and the one-shot dispatch run path watches the lane it started. A composition that supplies neither the daemon nor the dispatch-owned watch enforces no in-flight window: behavior is the delivered iteration-start gating — profiles in window are ineligible for new dispatches at admission, exactly as delivered — and no surface reports a parked lane, a stop, or a resume that did not happen. Automatic pausing disabled by `lane.disable-peak-pausing: true` is that degradation, declared and deliberate.

The mode in the machine read reflects the composition fact and nothing else: `peakEnforcement.mode` is `window-watch` when the reading composition's own effective configuration enables automatic pausing and composes the profile-window watch, otherwise `iteration-start-gating` — never an inference from daemon reachability, which says nothing about whether a watcher exists (the same rule the [Resident Dispatch Daemon](feature-resident-daemon.md) states). Such a composition declares `peakEnforcement: { mode: "iteration-start-gating", parkClaimed: false }` on the lanes read, projected from the same collector facts into status and brief, and it synthesizes no zero-spend episode reading for a park that never happened.

## 10. Testing

| Level | Suites | Scope |
|---|---|---|
| Rules data | `provider-peak-rules-schema` | Round-trip, derived grace bound, the fail-closed matrix including the malformed-literal and runtime-unknown-zone arms, duplicate-refuses, and overlap-validates fixtures. |
| Nomination | `provider-nomination-admission` | Records agreement across both admission paths, the four refusal identities at their exits, claim parity, pre-change classified absence, no-default/no-guess/no-borrow. |
| Watch and park | `daemon-peak-window-park` | Window-open stop with deadline, park record under one fence, grace-bound matrix, supervision-cycle bound, preservation-failure parking, stay-parked. |
| Resume and isolation | `daemon-peak-window-isolation`, `daemon-peak-window-resume` | Set-equality isolation matrix, preserved resume, recovery routing, budget exhaustion, owner-hold precedence with record-level no-append. |
| Evidence | `spend-zero-window` | Present zero, absence classified, inclusive boundary scoping, seeded-breach falsifiability. |
| Surfaces and events | `status-brief-park-fields`, `queue-park-causes-s17`, `pause-episode-events`, `event-taxonomy-v2-compat` | Park fields with value agreement, the `--until` rules and writer enumeration, exactly-once episode events with bounds, the six-point v1-compatibility statement. |
| Composed edge | `peak-pause-composed-edge` | The production compositions end to end, through the real composition and never injected fakes alone: nomination wired in the composed dispatch runtime and the daemon supervision claim (attempt, history, and lane records carry `providerProfile`; the four no-nomination shapes refuse at their delivered exits with zero records), the release grammar landing a `peak-window` park through the composed CLI with the operator-shaped record projecting the `park-edge` alone through the real projector, status and brief rendering real park records, and the composition-fact `peakEnforcement.mode` derivation with record-derived `parkClaimed`. |
| Degradation and invariants | `daemon-absent-degradation`, `peak-window-utc-clock`, `peak-pause-determinism`, `peak-pause-hermetic` | Mode-declared no-false-claims, UTC boundary and DST matrices, paired-run byte determinism, zero live network/credential/sleep. |
| Dispatch-owned watch | `dispatch-peak-parity`, `dispatch-peak-watch`, `dispatch-peak-episode`, `dispatch-peak-stop-grace`, `dispatch-peak-preservation`, `dispatch-peak-recovery`, `dispatch-peak-isolation`, `dispatch-peak-owner-hold` | Watch/daemon parity over one profile and instant, mid-iteration and between-iteration parking with the exactly-once frame, the composed grace and the one terminate call, preservation routing, recovery and budget exhaustion, per-profile isolation, and owner-hold precedence. |
| Dispatch-owned standing park and lease | `dispatch-peak-standing-park`, `dispatch-lease-liveness` | Occupancy, the pre-session `dispatch.resume-parked` refusal with nothing written, the recovered expired park with exactly one active park afterwards, the unrecoverable-park refusal, renewal at `min(lane.liveness-interval, queue.lease-ttl / 2)` across several TTLs and with the interval above the TTL, `lease:not-owned`, and the lost-lease return. |
| Dispatch-owned resume and result | `dispatch-peak-resume`, `dispatch-peak-result`, `dispatch-peak-nomination`, `dispatch-peak-setting`, `dispatch-peak-spend` | Session resume with one `resumed` and no ordinal, the non-terminal refusal result, the one result whose summary states pause and resume, the nomination on every active lane record, the disabling key, and the zero-spend reading over dispatch-owned episodes. |
| Dispatch-owned surfaces and operator stop | `dispatch-peak-surfaces`, `dispatch-peak-mode`, `dispatch-peak-byte-identical`, `dispatch-stop`, `dispatch-stop-cause`, `dispatch-stop-refusal`, `dispatch-stop-safety`, `dispatch-stop-handoff`, `dispatch-stop-race` | The additive `status` park fact with the unchanged verdict, the configuration-derived mode, the no-park byte-identical payloads, and the stop's grammar refusals, confirmed terminate, not-running refusal, safety posture, and cross-process hand-off. |
| Dispatch-owned invariants | `dispatch-peak-determinism` | Paired-run determinism, hermeticity, and vocabulary economy for the dispatch-owned watch. |

## 11. Related

- [Provider Profiles](feature-provider-profiles.md) — the profiles branch, the resolve seam the nomination reads, the pausability precondition, and the delivered iteration-start gating.
- [Dispatch Engine](feature-dispatch-engine.md) — the admission order, the dispatch-owned watch and its operator surface, attempt records, restart budget, and resume economics the nomination and recovery consume.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — the supervision cycle the daemon-owned watch rides and the lane composition requirement.
- [Scheduling Engine](feature-scheduling-engine.md) — the park record family, cause/condition vocabulary, owner hold, and the lanes surfaces.
- [Configuration Layer](feature-config-layer.md) — the `lane.disable-peak-pausing` key and its delivered refusal.
- [Supervise](feature-supervise.md) — the operator battery whose supervised-stall cause rides the same many-to-one cause-to-condition mapping the `peak-window` cause established.
- [Event Taxonomy v2](feature-event-taxonomy.md) — the declaration, envelope, and v1-compatibility contract the episode events join.
- [Spend Read Side](feature-spend.md) — the window-evidence form and its `telemetryState` disclosure.
- [Harness Telemetry v2](feature-telemetry-v2.md) — the storage identity and attribution join the evidence counts over.
- [Status Digest](feature-status-digest.md) and [Brief](feature-brief.md) — the park-field surfaces.
- [Board](feature-board.md) — the fleet board read whose `PARKED` section is the lane park-episode population.
- [TDR-0028](../../decisions/TDR-0028-no-nomination-classified-admission-refusal.md), [TDR-0029](../../decisions/TDR-0029-event-taxonomy-v2-peak-pause-kinds.md), [TDR-0030](../../decisions/TDR-0030-park-preservation-failure-classification.md) — the binding decisions for the refusal, the taxonomy version, and the preservation classification.
- [TDR-0077](../../decisions/TDR-0077-dispatch-owned-window-watch.md) and [TDR-0078](../../decisions/TDR-0078-lease-heartbeat-amends-tdr-0050.md) — the dispatch-owned watch contract and the lease heartbeat that keeps a parked lane single-flight.
