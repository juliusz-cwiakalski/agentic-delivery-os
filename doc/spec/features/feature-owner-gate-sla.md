---
ados_distribution: internal
id: SPEC-OWNER-GATE-SLA
status: Current
created: 2026-11-06
last_updated: 2026-11-09
owners: ["engineering"]
service: delivery-os
summary: "The owner-gate SLA: the shared owner-gate population and its provider-native age clock, the pinned 24 h escalation and 72 h default-on-expiry thresholds with `>=` boundary semantics, the three-value `slaState` with declared unknown age, the PDR-0003 two-row policy-as-data default map (owner-review never-merge and non-defaultable, waiver defaulting to owner-review-first), the per-class waiver-authorization policy consumed by the merge transaction, the append-only idempotent EVT-1 decision record, recorded merge waivers folded into gate kind and `waivedBy`, structural never-merge protection, never-silence declared collector unavailability, the render-once board command with its deterministic rank key, bounds, and truncation marks, and the owner/coordinator audience seam."
links:
  related_changes: ["GH-229", "GH-225", "GH-230", "GH-237", "GH-240", "GH-277"]
  related_decisions: ["ADR-0003", "ADR-0004", "ADR-0006", "PDR-0003"]
  contracts:
    - "packages/core/src/contracts/owner-gate-sla.ts"
---

# Feature: Owner-Gate SLA

## Overview

An owner gate is an open work item carrying a declared owner-attention label (`hand-back` or `human-input-needed`, case-insensitive). The owner-gate SLA gives that gate a deterministic lifecycle: its age is computed from the provider-native activity timestamp, escalation becomes visible at 24 hours, and a gate that crosses 72 hours receives exactly one pre-agreed default when its kind declares one and is allowed to proceed — otherwise it stays escalated and visible. Silence is not a state. A gate is rendered as `fresh`, `escalated`, or `default-applied`, and every default application is persisted as an append-only decision record.

The mechanism is `delivery.board.v1` plus the owner-gate policy contract data. Thresholds, the two-kind/two-class vocabulary, the default map, the per-class waiver-authorization policy, the SLA states, the unknown-age markers, the audience dimension, the collector-id set, and the render bounds are contract data, not configuration keys. The pure evaluator consumes injected facts (clock, gate facts, policy, decision history) and produces the bounded gate projection and the decisions the edge must persist. The `board` command is the SLA surface: it reads the tracker collector once, evaluates, renders the aging grid or one `CommandResult` envelope, and appends at most one decision record per newly defaulted gate. The command is render-once; it declares no command-specific flags (`--json` is the global machine-output switch) and never starts a timer, loop, or daemon.

The escalation mechanism carries an explicit audience dimension, `owner` or `coordinator`. The owner audience is the one the board renders. The typed blocker channel consumes the same audience dimension and the deterministic ranking and bounds discipline for its coordinator-audience questions; SLA aging, thresholds, default application, and decision records remain the board's mechanism and are not blocker-channel behavior.

The tracker collector maps an observed owner-attention item to kind `owner-review` and `waivedBy: null` unless a recorded authorized `owner-gate` waiver exists for the item's change ref; that waiver is collected as kind `waiver` with its recorded authorizer. The `owner-review` row is never-merge and non-defaultable, so an unwaived real gate stays fresh under 24 h, escalates from 24 h, and remains escalated past 72 h with no default application. A `waiver`-kind gate is defaultable and follows the 72 h default-on-expiry path with one persisted decision record. The classification map also carries the per-class waiver-authorization policy that the merge transaction consumes as its override authority; the owner-review↔never-merge mapping remains the PDR-0003 assumption.

The surrounding contracts are described in [Status Digest](feature-status-digest.md), [Queue Ready](feature-queue-ready.md), [Verify Gates](feature-verify-gates.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), and [Configuration Layer and Inspection](feature-config-layer.md). Package placement follows [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); activity-timestamp absence semantics follow [ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) and [ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md); the default map is recorded in [PDR-0003](../../decisions/PDR-0003-owner-gate-sla-default-map.md).

## Business Context

### Problem Statement

- **Problem:** An owner gate blocks `queue ready` and `verify gates` until the owner acts, but no delivered surface attaches a consequence to the gate's age. A hand-back from three weeks ago sorts exactly like one from three hours ago; a stale ask is indistinguishable from a fresh one; and if the owner never answers, nothing happens at all. The fleet idles on silence, and there is no evidence trail of what was waited on, for how long, or what was decided.
- **Affected Users:** The owner, the coordinator, lifecycle agents selecting next work, and maintainers of the tracker read slice and state ledger.
- **Business Impact:** An aging, escalating, and recorded default path turns an unbounded owner wait into a bounded, auditable decision without transferring merge authority to the tool. It keeps non-defaultable owner authority intact while making every expired ask visible.

### Goals

- Give every open owner gate an age derived from one truthful provider-native clock.
- Escalate visibly at 24 hours and keep the gate escalated until it resolves.
- Apply exactly one pre-agreed default at 72 hours where policy permits, and record that decision durably and idempotently.
- Never auto-proceed a never-merge class; a recorded waiver authored by an authorized principal remains the only override.
- Surface the aging picture through the `board` command with deterministic ordering, bounded output, and declared unavailability.
- Keep the audience dimension and deterministic ranking discipline reusable by the board's owner audience and the blocker channel's coordinator audience.

## User Experience & Functionality

### Owner-gate population and age clock

The population is the shared owner-gate definition, reused by reference from the status-digest contract data. A gate is an open work item (delivery state neither `done` nor `canceled`) carrying at least one label whose case-insensitive value equals `hand-back` or `human-input-needed`. `assignee` is never a signal because absence of the normalized field means the provider did not supply it ([ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md)).

Age is `now - activityAt`, where `activityAt` is the provider-native work-item activity timestamp the tracker collector already uses to rank owner hand-backs ([ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md)), and `now` is the injected clock. Age is derived only from a present, parseable timestamp. An absent or empty timestamp yields the unknown-age marker `activity-timestamp-absent`; an unparseable timestamp yields `activity-timestamp-unparseable`. A future timestamp produces a negative age, which is rendered truthfully and never clamped into freshness evidence. Unknown age is never fabricated as zero, never rendered fresh, and never eligible for a default.

Each gate carries a collector-supplied `id`, `kind`, and work-item `ref`, plus optional `activityAt` and `waivedBy`. The tracker edge maps an observed owner-attention item to id `<entityId>:owner-review`, kind `owner-review`, ref `entityId`, and the item's activity timestamp when present.

### SLA states and thresholds

The SLA state enum is closed at three values. Thresholds are milliseconds in the contract data, and the admitted comparator is `>=` (the contract also admits the declared alternative `>` for policy injection; the shipped policy uses `>=`).

| Condition (evaluated on the injected clock) | `slaState` | `default` |
|---|---|---|
| A decision record already exists for the gate | `default-applied` | The recorded default |
| Age is unknown (absent or unparseable timestamp) | `escalated` | `null` |
| Age `>= 86_400_000` ms (24 h) and `>= 259_200_000` ms (72 h) and the gate's policy row is defaultable, not never-merge, and declares a default | `default-applied` | The pre-agreed default |
| Age `>= 86_400_000` ms (24 h) | `escalated` | `null` |
| Otherwise | `fresh` | `null` |

At exactly 24 hours the gate is escalated. At exactly 72 hours a defaultable `waiver` gate is default-applied; a non-defaultable or never-merge gate is escalated. Escalation is derived state recomputed on every evaluation, not a timer and not a stored transition: it persists for as long as the gate resolves to the same posture. A gate leaves the population when the label is removed or the item closes.

### Policy-as-data and the default map

The SLA policy is one injectable snapshot: the comparator, the two thresholds, and the gate policy rows. The shipped map is the PDR-0003 least-privilege map:

| Kind | Class | Never-merge | Defaultable | Pre-agreed default |
|---|---|---|---|---|
| `owner-review` | `owner-review` | true | false | none |
| `waiver` | `waiver` | false | true | `owner-review-first` |

The map is a uniqueness and no-invention constraint: at most one default exists per kind, and exactly one exists where a row is defaultable. A gate whose kind is not declared in the map receives no default and keeps escalating. Adding a kind, a class, or a default is an owner-signed policy-data change, never a runtime invention and never a configuration key.

The pure `validateOwnerGateSlaPolicy` validator rejects a duplicate kind, a never-merge row carrying a default, a non-defaultable row carrying a default, a defaultable row without a default, an undeclared default value, a non-finite or non-positive threshold, and an undeclared comparator. The shipped map satisfies every check.

Never-merge protection is structural: the evaluator requires both `!neverMerge` and `defaultable` before it will apply a default, so a malformed or edited never-merge row cannot produce an automatic proceed decision. An expired never-merge gate continues in `escalated`, indefinitely and visibly.

### Default application and the decision record

When a defaultable gate crosses the expiry threshold and no record exists for it, the evaluation projects exactly one decision record. The record payload is `delivery.owner-gate.decision.v1` and carries the gate id, gate kind, work-item ref, applied default, application time (`appliedAt`), the crossed threshold in milliseconds, and the clock-source marker `activity-timestamp`. The evaluator returns the records the edge must append in `decisionsToApply`; it does not write.

The state layer persists each record as the additive record kind `owner-gate.decision` under the store-scoped key `owner-gate.decisions:<gateId>`. The first application per gate id is authoritative. `readOwnerGateSlaDecisions` is a presence-tolerant verified read: an absent key set is verified-empty evidence, while a wrong record kind under the decision prefix, a malformed payload, or two records for one gate id is a classified `state.store.torn` — never a zeroed history. `appendOwnerGateSlaDecision` reads the history, returns the existing record without a fence when the gate already has one, otherwise acquires one fence, re-reads, appends only the new record, re-reads for coverage, and requires the verified record count to have increased by exactly one. A distinct gate id is never suppressed by another gate's record. Re-evaluation after application is a no-op that honors the existing record.

A default application is a recorded decision, never a merge. It names the gate's proceed posture; the merge transaction remains an explicit coordinator action, and `waivedBy` carries the authorizer of a recorded waiver — never a default application artifact.

### Never-silence: declared unavailability, unknown age, truncation

A collector read that fails, is unconfigured, or has no credential surfaces the declared identity `status.collector.<id>.unavailable`. The board withholds the entire gate set rather than rendering a partial picture, returns the error envelope, and exits `2`. Zero fabricated gates are produced, and a failed read is never an observed-empty board.

Unknown age is a declared fact on the gate: `age` is `null`, `ageUnknownReason` names the absent or unparseable timestamp, and `slaState` is `escalated` unless a prior decision record exists. Such a gate is listed on every board render, ranks with the escalated class, and is never default-applied because a default requires observed clock evidence. Truncation is declared with `truncated: true` and an `omitted` count, and a clamped field carries a `+` marker; a dropped or clamped gate is never silent.

### Board command surface

The command is exactly `board`, composed where the other top-level commands are composed. It accepts zero positionals and declares no command-specific flags; `--json` is the existing global machine-output switch. A positional argument or an unknown flag such as `--watch` is rejected by the parser as `fallback.invocation` with exit `1` before any collector read. The handler owns no stream writes and chooses no exit code.

| Outcome | Envelope | Exit |
|---|---|---|
| Gates collected and evaluated | Success envelope with one `delivery.board.v1` `data` payload | `0` |
| Any required collector unavailable | Error envelope with `kind: "status"` and code `status.collector.<id>.unavailable` | `2` |
| Rejected invocation | Error envelope with `fallback.invocation` | `1` |

Every required collector is read exactly once, sequentially. On the first classified failure the run returns that collector's identity; successful reads from earlier collectors are not rendered as a partial board. A fully available run carries one `available` evidence entry per collector.

The machine `data` payload is `{ schemaVersion: "delivery.board.v1", audience, gates, truncated, omitted, collectors }`. Each gate record is:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Collector-supplied gate identity |
| `kind` | string | Collected gate kind (`owner-review`, `waiver`) |
| `ref` | string | Work-item reference |
| `age` | number \| null | Observed age in milliseconds, or `null` when unknown |
| `ageUnknownReason` | `activity-timestamp-absent` \| `activity-timestamp-unparseable` (optional) | Present only when `age` is `null` |
| `slaState` | `fresh` \| `escalated` \| `default-applied` | SLA posture |
| `default` | `owner-review-first` \| null | The applied or recorded default, else `null` |
| `waivedBy` | string \| null | The recorded waiver's authorizer, folded by the collector; never a default artifact |

The human grid is deterministic and TTY-independent:

```
<binary> board  audience=owner  collectors=tracker:available
<id>  <kind>  <ref>  age=<age>  sla=<state>  default=<default|null>  waivedBy=<principal|null>
```

`age` renders as `<n>m` under one hour, `<n>h` under two days, `<n>d` thereafter, `unknown:<reason>` for unknown age, and a signed millisecond value for a negative age. An available board with no gates renders `<binary> board  observed-empty  collectors=tracker:available`. The grid contains no titles, bodies, comments, secrets, or ANSI escapes.

### Ranking, bounds, and truncation

Ranking is normative. Gates order by severity class first — `escalated`, then `default-applied`, then `fresh` — so a non-fresh gate is never hidden behind a fresh one. Within a class, oldest age first; unknown age orders before every known age in the same class; ties break on gate id ascending. Collector order and provider return order never decide.

| Bound | Value |
|---|---|
| Rendered gates | 8 (`BOARD_MAX_GATES`) |
| Serialized `data` | 65 536 UTF-8 bytes (`BOARD_MAX_MACHINE_BYTES`) |
| Human grid | 24 lines / 4 096 UTF-8 bytes (`BOARD_MAX_HUMAN_LINES`, `BOARD_MAX_HUMAN_BYTES`) |
| Per-field display caps | id and kind 160, ref 160, waivedBy 120 characters |
| Human gate line | 400 UTF-8 bytes |

Every drop is marked: the payload sets `truncated` and counts `omitted`, the human grid appends `+N more gates omitted`, and an over-cap field is clamped with a trailing `+` (which also sets `truncated`). The serialization guard drops the trailing gate and marks the drop if the assembled `data` would exceed its byte cap. Truncation never removes an escalated gate ahead of a fresh one because ranking precedes the cap.

### Audience seam

The evaluator input and evaluation output each carry `audience` from the closed set `owner` | `coordinator`, and the board renders the owner audience. Aging, threshold comparison, state derivation, ranking, and the decision projection contain no owner-specific label, surface, routing, or blocker-channel assumption. A coordinator-audience consumer can consume the same contract with a different fact bundle; it does not require a change to the aging mechanism.

### Production posture

The tracker collector maps every observed owner-attention item to kind `owner-review` with `waivedBy: null` unless a recorded authorized waiver exists for the item's change ref. The board collector folds a recorded waiver whose gate id is `owner-gate`; a waiver for any other gate leaves the item as an unwaived `owner-review` gate. The board payload schema is unchanged and no authorizer is synthesized. An unwaived gate is never-merge and non-defaultable, so its real-data behavior is: fresh under 24 h, escalated from 24 h, and permanently escalated past 72 h with no default application and no decision record. That is the intended never-silence posture, not a defect. A waiver-kind gate at or past 72 h becomes `default-applied` with `owner-review-first` and one persisted decision record, so real-data defaulting is reachable exactly through recorded waivers.

### Waiver authority and recording

The per-class policy map carries its waiver-authorization datum: `owner-review` is `owner-authored` (only the provider-resolved owner principal authorizes an override) and `waiver` is `defaultable`. The merge transaction consumes this declared map as its authority for every override decision; the two-row vocabulary and the SLA thresholds stay as declared. An authorized override is appended as a `merge.waiver` record before any landing mutation; an unauthorized declaration records no waiver while the audit ledger still captures the attempt. See [Merge and Verify Deploy](feature-merge-verify-deploy.md).

## Technical Architecture & Codebase Map

### Core components

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/owner-gate-sla.ts` | The complete vocabulary: thresholds, comparator, gate kinds and classes, defaults, `slaState`, unknown-age reasons, audiences, rank order, decision record kind and payload schema, board schema, bounds, collector ids, the family prefix/suffix, the PDR-0003 policy rows, and the injected input/output types. Types and `as const` data only. |
| `packages/core/src/domain/owner-gate-sla.ts` | The pure evaluator and renderer: age parsing, threshold crossing, default eligibility, decision projection, policy validation, deterministic ranking and capping, field clamping, the human grid, the family-code formatter, and the family-code recognizer. No I/O, clock, randomness, or ambient environment. |
| `packages/core/src/state/owner-gate-sla.ts` | The `owner-gate.decision` ledger over the injected state port: validated record payloads, presence-tolerant verified history read, idempotent fenced append, and coverage verification. |
| `packages/cli/src/commands/board.ts` | The `board` command definition over injected collectors, policy, decision read/append, and clock; all-or-nothing collection, conditional history read, decision append, and no stream writes or exit-code choice. |
| `packages/cli/src/edge.ts` | The board composition: `createBoardCommandRuntime` wires the GitHub tracker read, the open/owner-attention filters, the recorded-waiver fold (kind and `waivedBy`), the state ledger, and injected clock/fence factories; registration occurs only when a board composition is supplied. |
| `packages/cli/src/classify.ts` | The runtime family recognizer that resolves any declared `status.collector.<id>.unavailable` shape to the documented status entry while the sync check enforces the closed collector-id set. |
| `packages/core/src/contracts/error-table.ts` | The two documented family anchors, `status.collector.tracker.unavailable` and `status.collector.lanes.unavailable`, that carry the family's identity and remediation. |
| `packages/cli/src/index.ts` | The optional pure `humanText` hook the board uses to render the aging grid; it receives an optional `HumanTextContext` third argument carrying the parsed `--verbose` fact, and an omitted context means non-verbose. |

### Data flow

1. The edge composes the board runtime with one required collector (`tracker`), the shipped policy, the state ledger's decision read/append and recorded-waiver read, and injected time and fence factories.
2. The handler reads every collector once. A failure returns the declared family error; nothing is evaluated and no partial board is rendered.
3. The handler evaluates the collected gates against an empty decision history. Only when some gate is eligible for a default does it read the verified decision history.
4. It re-evaluates with the history, appends each newly projected decision through the fenced, idempotent ledger append, and returns the bounded `data` payload.
5. The CLI edge renders the human grid when `--json` is absent, or the standard envelope when it is present, and projects the exit code from the classified outcome.

### API and interface contracts

- **`evaluateOwnerGateSla(input: OwnerGateSlaInput): OwnerGateSlaEvaluation`** — the pure evaluation. The input carries `audience`, `nowMs`, `nowIso`, `policy`, `gates`, and the existing `decisions`; the output carries `audience`, the bounded `gates`, `truncated`, `omitted`, and `decisionsToApply`.
- **`toBoardData(evaluation, collectors): BoardData`** — projects the evaluation into the `delivery.board.v1` payload and applies the defensive machine-byte guard.
- **`renderBoardHuman(data, brand): string`** — the only human renderer; it reads no source and uses the injected brand binary name.
- **`validateOwnerGateSlaPolicy(policy): readonly OwnerGateSlaPolicyViolation[]`** — the pure policy-map validator; an empty array means the map satisfies the uniqueness, never-merge, default, threshold, and comparator constraints.
- **`collectorUnavailableCode(collectorId)` / `isCollectorUnavailableFamilyCode(code)`** — the declared family code formatter and recognizer.
- **`readOwnerGateSlaDecisions(store)` / `appendOwnerGateSlaDecision(store, request)`** — the verified history read and the idempotent fenced append.

The contracts and domain import only the shared contracts; the state module imports `#contracts`; the CLI command imports the core root and `./contracts`/`./state` types at the edge. No new package, subpath, or runtime-API location is introduced.

### Data architecture

| Element | Shape and persistence |
|---|---|
| Gate record (board payload) | `id`, `kind`, `ref`, `age`/`ageUnknownReason`, `slaState`, `default`, `waivedBy`; rendered in the bounded projection, never persisted |
| Policy snapshot | comparator, escalation threshold, expiry threshold, and the two policy rows; contract data, injected whole |
| Decision record (EVT-1) | `schemaId: "delivery.owner-gate.decision.v1"`, `gateId`, `gateKind`, `workItemRef`, `appliedDefault`, `appliedAt`, `thresholdCrossedMs`, `clockSource`; append-only ledger payload |
| Decision key | `owner-gate.decisions:<gateId>`; one authoritative record per gate id |

The decision record kind is additive inside `delivery.state.v1`. No existing record kind, read, derived document, or schema version changes. History grows linearly with default applications and has no expiry or compaction surface.

## Security and Boundaries

- **Authority boundary:** the SLA never self-authorizes a merge. Automatic proceed decisions are limited to defaultable, non-never-merge kinds; expiry alone is never sufficient authority to override a never-merge class. A recorded waiver by an authorized principal remains the deliberate override path.
- **Recorded decisions:** every automatic proceed is persisted with gate, kind, ref, default, time, threshold, and clock-source evidence, so later audit can reconstruct what the tool decided and when.
- **State integrity:** the decision ledger rides the append-only ledger, fence, permission, and torn-state discipline. A torn, wrong-kind, malformed, or duplicated history fails closed and is never served as truth.
- **Conditional decision-history read:** the decision history is consulted only when a gate is currently default-eligible, so a gate with an existing applied default whose current observed age falls below the expiry threshold (for example after a clock regression or label churn) renders from current eligibility rather than the recorded decision and a torn decision ledger is not detected on a run with no eligible gate. An unwaived real gate is `owner-review` and non-defaultable, so a real-data run is eligible only when a recorded waiver is folded in as a `waiver`-kind gate.
- **Read-mostly posture:** collectors are read-only. The only mutation is the recorded, idempotent decision append; a board run with no eligible gate performs no history read, fence, or append.
- **Privacy:** gate ids, kinds, refs, ages, SLA states, policy values, and waiver authorizers only — no credentials, raw provider payloads, titles, bodies, comments, or free-form content enter the payload, record, or grid.
- **Brand neutrality:** no product or binary literal is committed. The human grid uses the injected brand binary name.
- **No daemon:** the command performs no polling, timer, signal handling, child process, or background work.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Determinism | Identical injected collector facts, clock, policy, and decision history produce byte-identical machine and human output; no run-to-run drift. |
| Read cost | One tracker collector read per invocation at the existing budget (`STATUS_SOURCE_ITEM_LIMIT`, 100), no pagination, no retries, no new request kinds; one merge-waiver ledger read per tracker read; at most one verified decision-history read and, per newly defaulted gate, one fence and one append. |
| Latency | Pure evaluation, ranking, and rendering complete within 50 ms on the reference environment over the capped gate set. |
| Bounds | At most 8 rendered gates; machine `data` at most 65 536 UTF-8 bytes; human grid at most 24 lines / 4 096 UTF-8 bytes; per-field caps enforced; every drop or clamp marked. |
| Precision | Thresholds are evaluated against the injected clock on every invocation with the declared `>=` comparator; escalation at exactly 24 h, expiry at exactly 72 h; no background timer. |
| Error identity | The only new identity shape is the `status.collector.<id>.unavailable` family, anchored by two documented family rows (`tracker`, `lanes`); the documented table, machine table, and fixtures agree; no other failure identity changes. |
| Auditability and idempotency | Exactly one persisted decision record per default application; re-evaluation honors the existing record and appends nothing; a duplicated gate history is torn, never truth. |
| Never-silence | A collector failure, unknown age, or truncation is always declared; a partial board is never rendered as an all-clear. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Structure | Contract data pinned exactly (thresholds, comparator, kinds, classes, defaults, states, markers, audiences, rank order, bounds, collector ids, record vocabulary); pure-domain import confinement and absence of clock/randomness/environment/network/child-process access; audience seam with no owner-specific assumption; additive non-regression of the shared label set, config schema, schema versions, and existing command modules; inventory registration | `tests/structure/owner-gate-sla-contract.test.ts`, `owner-gate-sla-imports.test.ts`, `owner-gate-sla-audience.test.ts`, `board-nonregression.test.ts` |
| Behaviour | Aging and unknown age, 24 h escalation and stickiness, exact threshold boundaries, 72 h default application, permanent owner-review escalation, structural never-merge protection, decision content and durability, exactly-one-record idempotency, torn/malformed history, policy-as-data, declared collector unavailability and partial-failure withholding, the never-silence matrix, command grammar, machine and text output, determinism, bounds and truncation, privacy, read cost, performance | `tests/behaviour/board-aging.test.ts`, `board-escalation.test.ts`, `board-defaults.test.ts`, `board-records.test.ts`, `board-collectors.test.ts`, `board-never-silence.test.ts`, `board-command.test.ts`, `board-output.test.ts`, `board-determinism.test.ts`, `board-bounds.test.ts`, `board-privacy.test.ts`, `board-read-cost.test.ts`, `board-performance.test.ts` |
| Corpus and golden | A committed 10-case corpus with a completeness meta-check, and byte-identical machine-envelope plus human-grid goldens | `tests/behaviour/board-corpus.test.ts` with `tests/fixtures/board/matrix.ts`; `tests/golden/board-grid.test.ts` with `tests/fixtures/board/golden/**` |
| Contract | Machine table, documented table, source references, and fixtures agree in both directions; the family recognizes only the declared prefix/suffix shape over the closed collector-id set | `tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` |
| Aggregate | The whole workspace | `pnpm check` |

All suites inject facts through the shared board harness and matrix; nothing reads the live tree, the network, the ambient clock, or an environment variable. The fixed fixture clock is `2026-11-06T12:00:00Z`, and ages are expressed as deltas from it. The golden fixtures are never rewritten by the suite, and mutation controls prove that a changed age, waiver authorizer, or kind breaks the pinned bytes.

## Operational & Support

### Owner hold and host scope

The owner hold is a stop-all control and stays **host-wide**. The marker is read
at the host root — an absolute `<PREFIX>_STATE_DIR` when set, otherwise
`<home>/<brand.stateDirectoryName>` — and the brand-derived environment source
keeps its precedence over the marker. No per-project marker exists and no code
path reads `<project root>/owner-hold`, so one hold stops every project on the
host and migration leaves it in place. The gating behaviour and the
`queue.precondition.unmet`/`owner-hold` refusal are in [Scheduling
Engine](feature-scheduling-engine.md); the state root it is read at is in
[Projects Host Overview](feature-projects.md).

### Configuration

The SLA adds no configuration key. Thresholds, comparator, gate kinds and classes, defaults, `slaState`, unknown-age reasons, audiences, caps, collector ids, and the family prefix/suffix are contract data. The `board` command accepts no command-specific flag beyond the global `--json` switch.

### Observability

The board payload is the observability surface: the standard envelope's `runId` and `timing`, the per-collector `available` evidence, the per-gate age and SLA state, the applied default, the waiver authorizer, and the truncation markers. The persisted decision record is the durable audit trail for every automatic proceed decision. No telemetry exporter, event sink, alert channel, or background process is added.

### Cost and read cost

One invocation performs one bounded tracker list read and, only when a default is eligible, one verified decision-history read; each applied default adds one fenced append. The evaluator is linear over the capped gate set. There is no retry loop, pagination crawl, daemon, or new runtime dependency.

### Maintenance

- Changing a threshold, comparator, or cap is a contract-data edit plus tests and documentation.
- Adding a gate kind, class, or default is an owner-signed policy-data change; the validator and the exact two-row contract test must be updated together.
- Adding a collector changes the collector-id set, the family's documented closure, the board evidence, and fixtures.
- Later surfaces (the brief, the full fleet grid) consume the same SLA state source; they do not fork the evaluator.
- Promoting a new failure class to an error-table row requires a named consumer and a reviewed change.

## Dependencies & Risks

- **Depends on** the status digest ([feature-status-digest.md](feature-status-digest.md)) for the declared owner-attention label set, the open-item family, the provider-native activity timestamp, and the thresholds-as-contract-data precedent; the set is reused by reference, not duplicated. The digest's M1-S10 owner-gate-age projection consumes `evaluateOwnerGateSla`, `OWNER_GATE_SLA_POLICY`, and the two unknown-age markers by reference read-only, writes no decision record, and never re-derives a threshold.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for the append-only ledger, verified reads, verified-empty evidence, fences, and torn-state classification that carry the decision record.
- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the `CommandResult` envelope, the `status` domain kind, the declared family identity, the `{0, 1, 2}` projection, and the redaction path.
- **Depends on** the configuration layer ([feature-config-layer.md](feature-config-layer.md)) for the resolved GitHub instance and credential reference; the SLA adds no key.
- **Shares the owner-gate definition with** [Queue Ready](feature-queue-ready.md) (`no-owner-gate`) and [Verify Gates](feature-verify-gates.md) (`owner-gate`); both keep their current behavior.
- **Feeds** the typed blocker channel, which reuses the audience seam for its coordinator audience; **feeds** the owner brief and the full fleet board, which read the same SLA state source.
- **Risk — a wrong default overrides owner intent:** mitigated by pre-agreed policy-as-data, one default per kind, the never-merge structural exclusion, and a persisted decision record for every application.
- **Risk — the activity clock misstates staleness:** mitigated by a pinned clock source, visibility-only escalation, and expiry requiring a pre-agreed default; a finer signal remains an ADR-0004 revisit candidate.
- **Risk — collector unavailability read as no gates:** mitigated by the declared family identity, exit `2`, all-or-nothing withholding, and negative-control tests.
- **Risk — unknown-age gates quietly escape the SLA:** mitigated by declared unknown age, escalated visibility, and ineligibility for defaults.
- **Risk — the audience seam is foreclosed:** mitigated by an explicit audience dimension in the contract and structure tests that reject owner-specific assumptions.
- **Risk — real-data defaulting is mistaken for delivered:** mitigated by the production-posture statement, the waiver-kind mapping being visible in the collector and its tests, and the default path remaining policy-gated by a recorded waiver.

## Glossary & References

| Term | Definition |
|---|---|
| Owner gate | An open work item carrying `hand-back` or `human-input-needed` (case-insensitive); the shared definition used by the tracker collector, `queue ready`, and `verify gates`. |
| Owner-gate SLA | The pinned aging policy: escalation at 24 h, default at 72 h where policy permits, one pre-agreed default per kind, silence impossible. |
| Age clock | The provider-native work-item activity timestamp; absent or unparseable means age unknown, never fabricated. |
| `slaState` | One of `fresh`, `escalated`, `default-applied`; the gate's SLA posture. |
| Stale-review escalation | The 24-hour consequence: the gate is visibly escalated and stays so until resolved; visibility only, never a decision. |
| Default-on-expiry | The 72-hour consequence: a defaultable gate's pre-agreed default is applied and recorded. |
| Pre-agreed default | Exactly one decision per defaultable kind/class, held as policy-as-data before expiry; never invented at runtime. |
| Never-merge class | A class the SLA never auto-proceeds; only a recorded waiver by an authorized principal overrides it. |
| Decision record (EVT-1) | The append-only, idempotent state record persisted at every default application. |
| Declared unavailability | The named `status.collector.<id>.unavailable` statement that a collector read did not succeed, projected as exit `2`. |
| Unknown age | A gate whose activity timestamp is absent or unparseable: age declared unknown, gate visible, never defaulted. |
| Audience seam | The explicit `owner` \| `coordinator` dimension shared by the board's aging mechanism and the typed blocker channel's answer routing. |
| Aging grid | The board's deterministic per-gate rendering: id, kind, ref, age, SLA state, default, waiver authorizer. |

See also: [Status Digest](feature-status-digest.md), [Queue Ready](feature-queue-ready.md), [Verify Gates](feature-verify-gates.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Configuration Layer and Inspection](feature-config-layer.md), [Typed Blocker and Question Channel](feature-blockers.md), [PDR-0003](../../decisions/PDR-0003-owner-gate-sla-default-map.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md), [ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md), the [command registry](../../planning/oss-tooling/cli-command-registry.md), and the [repository glossary](../../overview/glossary.md).

**Change records:** `doc/changes/2026-11/2026-11-06--GH-229--owner-gate-sla/` (the SLA and board), `doc/changes/2026-11/2026-11-06--GH-225--merge-verify-deploy/` (the merge transaction's waiver and override consumers), and `doc/changes/2026-11/2026-11-06--GH-230--typed-blockers/` (the shared audience dimension and ranking discipline consumed by the typed blocker channel).
