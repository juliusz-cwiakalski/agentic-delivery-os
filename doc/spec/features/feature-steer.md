---
ados_distribution: internal
id: SPEC-STEER
status: Current
created: 2026-11-16
last_updated: 2026-11-16
owners: ["engineering"]
service: delivery-os
summary: "The `steer` family and the shared typed message record: `send` files one bounded owner note with drawn defaults (kind `request`, priority `normal`, ttl `24h`, ref `null`) and a derived origin block, `list` renders the queued/landed/expired groups side by side, `read` is the boundary read point where every due note lands in one rank-ordered batch with a complete receipt, `ttl-elapsed` is a classified non-applied outcome, a closed boundary declines without applying or recording, and the open owner asks batch with the delivered drawn-default join, and `complete` closes a landed note against its proving artifact; three additive `steering.*` state kinds with derived lifecycle and fenced verified appends, the registered-secret-value guard over every content path, the three `steer` error identities with a closed two-segment allowlist, machine `data` ≤ 65 536 bytes and a bounded human view with counted drops, and the mount as the 23rd prompt-required family."
links:
  related_changes: ["GH-230", "GH-297", "GH-298"]
  related_decisions: ["PDR-0003", "ADR-0003", "TDR-0012"]
  contracts:
    - "packages/core/src/contracts/steer.ts"
    - "packages/core/src/state/steering.ts"
    - "packages/cli/src/commands/steer.ts"
---

# Feature: Steer

## Overview

`steer` is the owner's course-correction channel for a running delivery. The owner files one bounded note, and the note persists as an append-only record in the invoking repository's local state scope. The delivery reads queued notes at the declared read point — the phase boundary — where due notes land as one batch with a receipt each, notes whose TTL elapsed are recorded as classified non-applied outcomes while the delivery continues its previous course, and a note is completed later against the artifact that proves the course change. Nothing interrupts a live session: the read point is a pull the delivery performs, never a push.

The note is not an owner-specific store. It is one record on the shared typed message record schema — `id`, `from`, `to`, `scope`, `kind`, `subject`, `ref`, `origin {change, repo, agent}`, `priority`, `created`, `ttl` — whose four closed vocabularies are declared once as contract data, so a message issued by another principal validates against the same schema without a fork. The S5 filing subset (kind `request` or `escalate`, scope `repo`, `from` `owner`, `to` `delivery`) is a declared restriction over those sets, not a second schema.

At the same boundary read, the payload batches the open `owner`-audience questions with their delivered drawn-default join and measured ages, so the owner's pending corrections and the delivery's open asks meet at one decision point. The family is local-state only: no tracker or provider access, no network, no LLM, no timer or daemon, no control socket, and no session spawn, attach, resume, or steer operation.

The family runs as `<binary> steer send|list|read|complete` under one payload identity, `delivery.steer.v1`, and is the twenty-third prompt-required command family. Its reference page is `doc/planning/oss-tooling/milestones/m2/commands/steer.md`.

## Business Context

### Problem Statement

- **Problem:** A running delivery has no typed, receipted, expiring channel for owner course corrections. A correction means killing or derailing live work, losing session context, or issuing an unverifiable verbal direction. Nothing records who sent a direction, when it was read, or when it expired, so steering is unauditable and retro-blind; a direction delivered late is worse than none because nothing classifies it as no-longer-applicable.
- **Affected Users:** The owner filing course corrections, the delivery reading them at the phase boundary, and maintainers of the local state ledger, the phase fold, and the typed-question channel.
- **Business Impact:** One durable, receipted, expiring note turns interruption into a safe pull at a recorded boundary. Origin linkage makes every note attributable, TTL expiry makes stale direction harmless, artifact-ref completion makes the applied course change provable, and one shared record schema means later agent-to-agent messaging extends the same contract instead of forking it.

### Goals

- File a durable note from the CLI with a declared drawn default for every omitted field and a derived origin block.
- Land notes batched at the next phase boundary, each with a non-null receipt, and never mid-phase.
- Classify an elapsed TTL as a non-applied outcome recorded append-only, with the previous course unchanged.
- Keep the record on the shared typed message schema with the shared closed vocabularies declared once.
- Batch the open owner asks beside the notes, with their drawn defaults and measured ages.
- Complete a landed note only against its proving artifact.
- Refuse registered credential values on every content path; keep output deterministic, bounded, brand-neutral, and local-only.

## User Experience & Functionality

### Command surface

```
<binary> steer send "<text>" [--kind request|escalate] [--priority low|normal|high|urgent] [--ttl <duration>] [--ref <artifact>]
<binary> steer list
<binary> steer read
<binary> steer complete <id> --ref <artifact>
```

`send` accepts exactly one positional (the note text) and the value-taking flags `--kind`, `--priority`, `--ttl`, and `--ref`. `complete` accepts exactly one positional (the note id) plus the required `--ref`. `list` and `read` accept no positional and no flag. `--json` is the global machine-output switch.

Grammar refusals resolve to the delivered containment identity `fallback.invocation` at exit `1` before any state read: a missing or unknown subcommand, an unknown flag, a missing flag value, and a wrong positional count — including any positional on `read` or `list`, so `steer read <id>` is a grammar refusal and never `steer.unknown-id`, because id targeting belongs to `complete` alone.

The command handler owns no stream writes and chooses no exit code. It returns one `delivery.steer.v1` `data` payload or one classified failure; the CLI edge renders the human form or the standard envelope, projects the exit code, and applies the single redaction path.

### The shared message record

The schema is declared exactly once in `packages/core/src/contracts/steer.ts` and carries exactly eleven fields, none owner-specific:

| Field | Type | Filing value |
|---|---|---|
| `id` | string | `msg-` plus an opaque per-store-unique suffix |
| `from` | string | the human principal `owner` |
| `to` | string | the receiving role `delivery` |
| `scope` | closed `session \| change \| repo \| fleet` | `repo` |
| `kind` | closed `ask \| answer \| notify \| request \| escalate \| report \| heartbeat` | `request` or `escalate` |
| `subject` | string | the bounded note text, at most 160 characters |
| `ref` | string or bare `null` | the optional artifact reference, at most 160 characters |
| `origin` | object `{change: string \| null, repo: string, agent: string}` | derived at filing, `agent: "owner"` |
| `priority` | closed `low \| normal \| high \| urgent` | `normal` |
| `created` | string | the injected clock |
| `ttl` | number (milliseconds) | `86 400 000` (the `24h` default) |

The vocabularies are the shared closed sets declared once; the filing path admits `request` and `escalate` only, so a shared member outside the subset (for example `notify`) is refused rather than widened into the filing path. A later principal's message validates against the same schema, and no owner-only field or vocabulary member exists. The record is immutable once appended; the artifact boundary validates the kind, payload schema, identity field, required fields, and closed vocabularies before any byte lands, and a malformed nested record is classified rather than defaulted.

### Filing and drawn defaults

Filing validates in a fixed order — text, kind, priority, ttl, ref — before any state read or write:

| Field | Rule | Drawn default when omitted |
|---|---|---|
| text | non-empty (not whitespace only), at most 160 characters | required positional |
| `--kind` | member of `request \| escalate` | `request` |
| `--priority` | member of `low \| normal \| high \| urgent` | `normal` |
| `--ttl` | grammar `<positive-integer><unit>`, unit `s \| m \| h \| d`, at most `30d` (2 592 000 s) | `24h` |
| `--ref` | non-empty, at most 160 characters | bare `null` |

Zero, negative, oversized, and malformed ttl values are value violations refused through the delivered `input.value.rejected` at exit `1` with zero persisted bytes; no value is coerced to a neighbouring duration. `1.5h`, `0h`, `-1h`, `24H`, and `31d` are all refusals.

The origin block is derived, never asked. `origin.change` is the invoking checkout's bound work-item ref from the local PM context, or the bare `null` with no absence-reason member when the checkout binds none — an unbound checkout still files, and the key is present as `null`. `origin.repo` is the normalized `host/owner/name` key of the checkout origin, falling back to the lower-cased checkout directory name, then to `repository`. `origin.agent` is `owner`. `created` comes from the injected clock, and the answer carries the record projection plus `expiresAt` and `age` with `lifecycle: "queued"`.

Filing performs no read of any remote source. The append path re-reads the steering store for duplicate-id detection and post-append coverage verification; a duplicate message id fails closed rather than overwriting history.

### Derived lifecycle

Three additive record kinds carry the state, and the note's lifecycle is derived at read time — never a stored flag:

| Record kind | Payload schema | Key | Meaning |
|---|---|---|---|
| `steering.message` | `delivery.steering.message.v1` | `steering.messages:<id>` | the immutable record, one per note |
| `steering.outcome` | `delivery.steering.outcome.v1` | `steering.outcomes:<id>` | exactly one per resolved note: an `applied` receipt or an `expired` outcome with its reason |
| `steering.completion` | `delivery.steering.completion.v1` | `steering.completions:<id>` | the artifact-ref completion, first one authoritative |

The derived lifecycle is `queued` (message only), `landed` (an applied outcome), `expired` (an expired outcome), or `completed` (landed plus a completion). Exactly one outcome per note exists; an append is refused when its note is missing, when the note already has an outcome or completion, when a completion targets a note with no applied outcome, or when the post-append coverage read does not prove exactly one new record.

### The boundary read point

`steer read` derives the boundary condition from the delivered phase-state records of the invoking checkout's bound change:

| Phase state | Boundary | Behavior |
|---|---|---|
| No phase record | `open: true`, `phase: null`, `phaseUnknownReason: "phase-unrecorded"` | due notes land |
| Every recorded lifecycle entry completed | `open: true`, `phase` = the latest completed entry | due notes land |
| An entry in progress | `open: false`, `phase` = that entry | every unresolved note reads `applied: false` with `pendingReason: "phase-in-progress"`; nothing appends |

At a boundary-open read every unresolved note is resolved: a due note (ttl not elapsed) lands with `lifecycle: "landed"`, `applied: true`, and a receipt; a note whose ttl elapsed (`now >= created + ttl` on the injected clock) is recorded as `lifecycle: "expired"`, `applied: false`, with `expiry {reason: "ttl-elapsed", recordedAt}` and the delivery continues its previous course. The closed boundary takes precedence over expiry: a note whose ttl elapsed while a phase is in progress reads pending, and nothing is resolved off-boundary by patience.

The landing is one batch in the shared rank order and is **not** bounded by the payload's display cap: all due notes are receipted in one fenced append whose post-append coverage read requires exactly the expected record count, so a batch larger than the display cap is fully applied while partially listed. A repeat read immediately afterwards lands nothing, appends nothing, and returns the empty batch with `data.applied == false`.

The read answer lists the notes it considered in this read — the transitions it performed or declined — not a replay of already-resolved history. Landed, expired, and completed notes stay visible on `steer list`, which is the historical view.

### Receipts and expiry

A receipt is the audit evidence of delivery and carries four non-null members: `origin` (the filing origin triple), `readReceipt {at, boundary}` (the read instant and the boundary label — the completed phase id or `phase-unrecorded`), `ttl` in milliseconds, and the derived `expiresAt`. Every landed note has one; a pending or expired note has none.

Payload-level classification is total over empty, all-expired, mixed, and pending reads:

- `data.applied` is `true` if and only if at least one note landed in this read.
- `data.expiry` is present as `{reason: "ttl-elapsed"}` if and only if at least one note expired in this read.
- A boundary-closed read carries neither a receipt nor an expiry record and writes nothing.

### The asks batch

`data.asks[]` carries the open `owner`-audience questions of the delivered typed-question ledger, projected through the delivered open-question view and the delivered PDR-0003 join: `id`, the delivered closed `type`, `ref` (a string or the delivered bare `null`), `lane`, bounded `question`, `askedAt`, measured `age`, `drawnDefault` (the PDR-0003 policy default for a defaultable gate on the same ref, or bare `null`), `defaultState` (`none` when no defaultable gate exists on the ref or the question names no ref, `pending` when one exists without a decision record, `applied` when one exists), and the delivered `rank`.

The batch is the delivered view verbatim: `owner`-audience rows only, the delivered ordering preserved, the delivered cap of eight, no second ranking, no new question type, and no ledger write. `coordinator`-audience questions are never asks. The join values are injected composition facts: the read point derives nothing itself, and the declared `none` truth is used when no fact exists — never an invented default.

### Queue view

`steer list` renders three lifecycle groups in declared order — `queued[]`, `landed[]`, `expired[]` — as the journey's side-by-side audit record. Each row carries the shared note fields, `age` in milliseconds, and `rank`. A landed row also carries its `receipt` and `completedWith` (the artifact reference, or bare `null` when not completed; a completed note stays in the landed group with `lifecycle: "completed"`). An expired row carries its `expiry` reason and timestamp. A queued row carries neither.

Ranks are contiguous `1..N` over the fully ranked set — priority class (`urgent` 1, `high` 2, `normal` 3, `low` 4), then oldest `created`, then `id` ascending — assigned before any cap, so a group's rows can carry non-adjacent ranks. Each group is capped at eight rows and every omission increments `omitted` and sets `truncated`.

### Payload contracts

```
steer send.data = {
  schemaVersion: "delivery.steer.v1",
  record: { id, from, to, scope, kind, subject, ref, origin, priority, created, ttl, expiresAt, age },
  lifecycle: "queued"
}

steer read.data = {
  schemaVersion: "delivery.steer.v1",
  boundary: { open, phase: string | null, phaseUnknownReason?: "phase-unrecorded" },
  applied: boolean,
  expiry?: { reason: "ttl-elapsed" },
  notes: [{ id, kind, priority, subject, ref, origin, created, ttl, expiresAt, age, rank,
            lifecycle: "landed" | "expired" | "queued", applied,
            receipt?: { origin, readReceipt: { at, boundary }, ttl, expiresAt },
            expiry?: { reason, recordedAt },
            pendingReason?: "phase-in-progress" }],
  asks: [{ id, type, ref, lane, question, askedAt, age, drawnDefault, defaultState, rank }],
  omitted: number, truncated: boolean
}

steer list.data = {
  schemaVersion: "delivery.steer.v1",
  queued: [row], landed: [row], expired: [row],
  omitted: number, truncated: boolean
}

steer complete.data = {
  schemaVersion: "delivery.steer.v1",
  record: { id, lifecycle: "completed", completedAt, artifact }
}

row = { id, from, to, scope, kind, subject, ref, origin, priority, created, ttl, expiresAt,
        age, rank, lifecycle, receipt?, completedWith?, expiry? }
```

Every new key lives under `data` inside the untouched five-field `delivery.result.v1` envelope. `notes[]` orders by the shared rank; `asks[]` orders by the delivered blocker rank; list groups order by the shared rank within the group. Identity is `id`, unique across the repository's steering records, and no ordering is influenced by store or filesystem return order.

### Bounds and drops

| Bound | Value |
|---|---|
| Note text | 160 characters |
| `ref` | 160 characters |
| ttl | `<positive-integer><unit>`, unit `s \| m \| h \| d`, at most `30d` |
| Queue-view rows per lifecycle group | 8 |
| Notes listed by `read` (display only) | 20 |
| Asks | 8 (the delivered board cap) |
| Serialized machine `data` | 65 536 UTF-8 bytes |
| Human render | 32 lines / 6 144 UTF-8 bytes (the delivered status bounds) |

The machine byte guard drops tail-first in a fixed order and counts every drop in `omitted` with `truncated: true`: on `read`, `asks` first and then `notes` tail-first by rank; on `list`, `expired` rows, then `landed`, then `queued`, tail-first within each group. The read's boundary block is never dropped. Every display drop and clamp is counted; a bounded view never implies completeness.

### Human render

```
<binary> steer queued <id>  kind=<kind>  priority=<priority>  ttl=<ms>ms  origin=<change|->@<repo>  age=<age>
<binary> steer list  queued=<n>  landed=<n>  expired=<n>
queued
  1. <id>  <kind>  priority=<priority>  age=<age>  "<subject>"
landed
  2. <id>  <kind>  priority=<priority>  age=<age>  receipt=<at>/<boundary> ttl=<ms>ms[  completedWith=<artifact>]  "<subject>"
expired
  4. <id>  <kind>  priority=<priority>  age=<age>  expired=<reason>  "<subject>"
<binary> steer read  notes=<n>  asks=<n>  applied=<true|false>
  boundary=<open|closed> phase=<id|->[ (<phase-unrecorded>)]
notes
  1. <id>  <kind>  priority=<priority>  age=<age>  receipt=<at>/<boundary> ttl=<ms>ms  "<subject>"
asks
  ask 1. <id>  <type>  lane=<lane>  age=<age>  drawnDefault=<default|->  defaultState=<state>
<binary> steer completed <id>  artifact=<artifact>  at=<completedAt>
```

The render is deterministic, TTY-independent, and ANSI-free. `age` renders as `<n>ms` under a minute, `<n>m` under an hour, `<n>h` under a day, `<n>d` thereafter. An empty queue renders `  no steering notes`. The human view drops body lines only after its header — `asks` before `notes` on `read` — and appends `+<n> more rows omitted` or `+<n> more notes omitted`, so the boundary block and the header survive every bound. The binary name comes from the injected brand identity.

### Classified outcomes

| Outcome | Envelope | Exit |
|---|---|---|
| `send`, `list`, `read`, or `complete` produced (including an empty queue and a boundary-closed decline) | Success envelope with one `delivery.steer.v1` `data` | `0` |
| Value violation: empty or over-cap text, zero/negative/oversized/malformed ttl, unknown filing kind or priority, over-cap `ref`, completion without `--ref`, completion of a queued/expired/completed note | Error envelope, `input.value.rejected` | `1` |
| `complete` target is not a steering record of this repository | Error envelope, `steer.unknown-id` | `1` |
| A registered secret value on a content path (note text, `--ref`, derived origin) | Error envelope, `steer.credential-value-rejected` | `1` |
| Grammar violation (missing/unknown subcommand, unknown flag, positional count, missing flag value) | Error envelope, `fallback.invocation` | `1` |
| The steering store cannot be read or written, or an append cannot be verified | Error envelope, `steer.queue-unavailable` | `2` |

The three `steer` rows are exact kind-first two-segment codes registered under a new `steer` domain kind, and they join the closed two-segment allowlist by exact declaration — no `steer.*` family and no pattern widening, so a near-miss `steer.*` code is rejected rather than matched by family. `steer.unknown-id` is scoped to `complete`; a store read failure, a write failure, or a landing whose post-append verification fails withholds the command, so a landing is never reported that did not durably land.

### Mounting

`steer` is the twenty-third prompt-required command family. The production composition supplies its runtime unconditionally — the invoking state store, the injected clock and fence factory, the derived checkout origin, the delivered phase fold, and the delivered open-question view with its join facts. Root `--help` lists the family, `steer --help` and each subcommand's `--help` answer from the static inventory at exit `0`, the M2 reference page serves the help-coverage check, and the coverage inventory carries the row. Mounting changes no other command's composition.

### Delivered limits

- **Asks join facts.** The production composition supplies no defaultable-gate facts to the read point, so a production `steer read` projects `drawnDefault: null` and `defaultState: "none"` for every ask. The join seam is injected and the payload derives `none`/`pending`/`applied` from whatever facts the composition supplies; a composition that supplies the PDR-0003 defaultable map lights the drawn default without a contract change.
- **No board surfacing.** Steering notes appear on `steer list`, not on the board: the board keeps its four sections and its payload, and its ask schema remains the declared extension point for any later board surfacing.
- **Read answer scope.** The read answer lists the notes it considered, so already-resolved notes are not replayed there; the historical record is `steer list`.
- **No history query, prune, or compaction.** Records accumulate append-only; the read point resolves each note once, so steady-state growth is bounded by the filing rate.
- **Completion has no `age` member.** The `complete` projection is the declared four-member record; aging is measured on `send`, `list`, and `read`.

## Technical Architecture & Codebase Map

### Core components

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/steer.ts` | The shared record schema and its eleven fields, four closed vocabularies, the S5 filing subset, the ttl grammar and limits, every bound, the priority class map and rank key, the payload identity `delivery.steer.v1`, the three record kinds and payload schemas, key prefixes, the derived lifecycle and reason vocabularies, the four `data` shapes, and the three error-code literals. Types and `as const` data only. |
| `packages/core/src/domain/steer.ts` | The pure domain: filing and completion validation, the ttl parser and inclusive predicate, measured aging, the shared derived rank, the boundary derivation over the delivered phase fold, derived lifecycle, the send/list/read/complete projections, the asks-batch composition, the registered-value guard, and the four bounded human renderers. No I/O, clock, randomness, or ambient environment. |
| `packages/core/src/state/steering.ts` | The three additive record kinds over the injected state port: the artifact-boundary declaration, the verified read folded by kind, single-record and batched fenced appends with post-append coverage verification, and fail-closed classification. |
| `packages/cli/src/commands/steer.ts` | The command definition over the injected runtime: subcommand dispatch, positional and flag shape, value validation and the guard before any state read, at most one queue read per subcommand, the batched landing write, and the four payloads. Owns no stream writes and chooses no exit code. |
| `packages/cli/src/edge.ts` | The steer composition seam (`SteerComposition`, `createSteerCommandRuntime`): the store, clock, id and fence factories, the origin derivation, the phase fold, the asks view, and the registered secrets. |
| `packages/cli/src/production.ts` | Composes the family unconditionally: the invoking store, the local PM-context origin derivation, the phase fold over the delivered registry, and the open-question view with the join facts. |
| `packages/cli/src/entrypoint.ts`, `help.ts`, `help/prompt-required-commands.ts` | The prompt-set entry (index 22, after `ceremony`), unconditional composition, and the root, family, and per-subcommand help entries. |
| `scripts/checks/help-guide-coverage.ts`, `tests/fixtures/help-guide/coverage.json`, `doc/planning/oss-tooling/milestones/m2/commands/steer.md` | The reference page and coverage-inventory row the help gate requires. |
| `packages/core/src/contracts/error-table.ts` | The `steer` domain kind and its three rows, with the projection classes that produce exit `1` and exit `2`. |

### Data flow

1. The handler validates the invocation shape, then validates values in the declared order, then applies the registered-value guard — all before any state read.
2. `send` derives the origin, builds the record with the injected clock and id factory, and appends one message record with post-append coverage verification.
3. `list` performs one verified steering-store read and projects the three lifecycle groups.
4. `read` performs one verified steering-store read, one phase-fold read (which performs no store read when no change ref is bound), and one blocker-ledger read; the pure domain plans the transitions, the edge appends the batch under one fence with one coverage read, and the payload lists at most the declared display cap.
5. `complete` performs one verified steering-store read, derives the lifecycle, validates the completion against it, and appends one completion record.
6. The CLI edge renders the human form or the standard envelope and projects the exit code from the classified outcome.

### API and interface contracts

- **`validateSteerSend(input)`** — the filing validation, in the fixed order text → kind → priority → ttl → ref; returns the validated request or one `input.value.rejected` failure naming the field.
- **`validateSteerCompletion(input, lifecycle)`** — landed-only completion requiring `--ref`; a queued, expired, or completed note and a missing, empty, or over-cap ref are refusals.
- **`parseSteerTtl(raw)` / `steerTtlElapsed(nowMs, created, ttlMs)` / `steerExpiresAt(created, ttlMs)` / `steerAgeMs(nowMs, created)`** — the one ttl grammar, the inclusive `>=` expiry judgement, the derived expiry instant, and non-negative measured age.
- **`validateSteerMessage(value)`** — the shared-schema conformance validator: exactly the eleven fields, no undeclared key, closed vocabularies, bounded text and ref, valid origin triple, parseable `created`, and a positive bounded ttl.
- **`rankSteerMessages(messages)` / `deriveSteerLifecycle(id, outcomes, completions)` / `deriveSteerBoundary(fold)`** — the shared derived rank, the derived lifecycle, and the boundary-open derivation.
- **`planSteerRead(input)` / `buildSteerReadData(plan, askSource)` / `buildSteerSendData` / `buildSteerListData` / `buildSteerCompleteData`** — the read plan (transitions plus rows) and the four bounded payloads.
- **`composeSteerAsks(source)` / `evaluateSteerGuard(request)`** — the asks batch over the delivered view and join facts, and the registered-value guard over the subject, ref, and origin paths.
- **`renderSteerSendHuman` / `renderSteerListHuman` / `renderSteerReadHuman` / `renderSteerCompleteHuman`** — the four human renderers; each reads no source and uses the injected brand binary name.
- **`createSteerCommandDefinition(runtime: SteerCommandRuntime)`** — the command definition: `requiresValue: ["--kind", "--priority", "--ttl", "--ref"]`, `positionals.max: 2`, the human renderer, and a handler over the injected read, append, clock, id, origin, phase-fold, asks, and secrets functions.

The contracts and the pure domain import only shared contracts; the command composes the core root and the edge runtime types. No new package, subpath, or runtime-API location is introduced.

### Data architecture

| Element | Shape and persistence |
|---|---|
| Steering records | Three additive kinds inside `delivery.state.v1` under the boundary key prefix `steering.`, with the per-kind prefixes `steering.messages:`, `steering.outcomes:`, `steering.completions:`; append-only, never rewritten |
| Record validation | One artifact-boundary declaration covers the three kinds, each with its identity field, required fields, and the closed `scope`, `kind`, `priority`, and `outcome` vocabularies; a nonconforming payload refuses `state.store.unknown`, an entry-level malformation classifies in band |
| Derived lifecycle | A read-time fold over message, outcome, and completion presence; no stored status field and no derived document |
| Payloads | `delivery.steer.v1` `data` inside the `delivery.result.v1` envelope; projection only, never persisted |
| Phase input | The delivered phase-state records of the bound change, folded read-only; no phase record kind changes |
| Asks input | The delivered blocker ledger read through the delivered open-question view and PDR-0003 join facts, read-only; no ledger write |

## Security and Boundaries

- **No-secrets guard:** every content and identifier path — note text, `--ref`, and the derived origin values — is matched against the registered secret values and refused before any byte lands, with zero persisted bytes on refusal. The boundary is exactly the registered-value match; no token-shape or pattern scan exists, per TDR-0012.
- **No session operation:** the family invokes no spawn, attach, resume, or harness steer operation and opens no control socket. A live session cannot be steered, killed, or resumed by `steer`, even when the CLI is asked to; the delivery adopts landed notes itself.
- **Fail closed:** an unreadable or unwritable store, or an append whose post-append verification fails, withholds the command at exit `2` with no partial result. A landing is never reported that did not durably land.
- **Exact error identities:** three declared codes, no family pattern, so a near-miss `steer.*` code cannot slip through the closed allowlist.
- **Untrusted input:** note text is data, not instruction. The read point returns records for the delivery's own judgement; no message content can override policy.
- **Local-only privacy:** notes persist only in the repository's local state scope — nothing replicates to a tracker, provider, or network destination. Records carry origin linkage plus the bounded text and artifact reference, never further content.
- **Brand neutrality:** no product or binary literal is committed; human output uses the injected brand binary name.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Envelope continuity | Every new key lives under `data`; the five-field `delivery.result.v1` envelope and the `{0, 1, 2}` exit meanings are unchanged; no `ok` or `command` field exists. |
| Determinism | Two runs over unchanged facts produce byte-identical human text and byte-identical machine `data` (envelope timing and run id aside); every array follows its declared order. |
| Identity and rank | 0 duplicate record ids per store; ranks are exactly `1..N` over the fully ranked set before caps; ordering never follows store or filesystem order. |
| Bounds | `data` ≤ 65 536 UTF-8 bytes; human ≤ 32 lines / 6 144 bytes; text and ref ≤ 160 characters; ttl grammar and the `30d` cap; 8 rows per list group; 20 listed read notes; 8 asks; every drop counted with `truncated` set. The display caps never bind a landing write. |
| Write discipline | `send` appends exactly one message record; `read` appends at most one outcome per transitioning note in one batch and none for already-resolved notes; `complete` appends exactly one completion record and a repeat appends none; 0 edits, deletes, prunes, or derived documents. |
| Purity | 0 LLM calls, 0 network requests, 0 tracker or provider reads or writes, 0 timers, loops, daemons, or sockets, 0 session operations, 0 hardcoded product or binary names. |
| Clock discipline | Every age, expiry, and boundary judgement uses the injected clock; no ambient wall-clock read exists in the pure domain. |
| Read cost | `read`: exactly one verified steering-store read, one phase-fold read (no store read when no change ref is bound), one blocker-ledger read, and at most one batched landing append with one coverage read. `list`: one verified store read. `complete`: one verified store read plus one append. `send`: no queue read before the append, one verified read inside the append path. |
| Responsiveness | Validation, rank, projection, and render complete inside the delivered command overhead; no retry loop, pagination crawl, or background process exists. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Structure | Contract data pinned exactly (eleven fields, four closed vocabularies, the filing subset, ttl grammar, bounds, rank key, record kinds, payload schemas, `delivery.steer.v1`, the three error literals); prompt-set membership as the 23rd family with every family-count pin moved; production composition; error-table contract and allowlist | `tests/structure/steer-contract.test.ts`, `tests/structure/steer-mounting.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` |
| Behaviour — filing and view | Drawn defaults, the derived origin block (bound and unbound), unique record ids, value and grammar refusals with zero persisted bytes, aging and the shared rank, the three lifecycle groups with counted caps | `tests/behaviour/steer-send.test.ts`, `steer-refusals.test.ts`, `steer-records.test.ts`, `steer-aging-rank.test.ts`, `steer-list.test.ts`, `steer-bounds.test.ts` |
| Behaviour — read point | Landing with complete receipts, `ttl-elapsed` expiry, the closed-boundary decline, batch landing above the display cap, idempotent re-read, the asks batch with the join and coordinator exclusion, read cost | `tests/behaviour/steer-read-landing.test.ts`, `steer-read-expiry.test.ts`, `steer-read-boundary-closed.test.ts`, `steer-read-idempotency.test.ts`, `steer-asks.test.ts`, `steer-read-cost.test.ts` |
| Behaviour — completion and identity | Artifact-ref completion, first-completion authority, artifact-less and non-landed refusals, the registered-value guard over text/ref/origin, the classified error matrix, envelope and exit projection | `tests/behaviour/steer-complete.test.ts`, `steer-credentials.test.ts`, `steer-errors.test.ts`, `steer-envelope.test.ts` |
| Behaviour — invariants | Determinism and permutation independence, purity and brand neutrality, the write matrix, and the non-vacuity controls (receipt sweep, silent-outcome set equality, mid-phase drift, artifact-less completion, schema fork) | `tests/behaviour/steer-determinism.test.ts`, `steer-purity.test.ts`, `steer-write-discipline.test.ts`, `steer-controls.test.ts`, `tests/checks/steer-mutants.test.ts` |
| Mounting and help | Root and family help, per-subcommand help, reference-page coverage, coverage-inventory row | `tests/behaviour/steer-help.test.ts`, `tests/behaviour/entrypoint-help-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` |
| Golden | Four committed payload and human goldens (send, list, read, complete) with an explicit regeneration path, byte-identical repeats, and permutation independence | `tests/golden/steer.test.ts` with `tests/fixtures/steer/golden/*` and `tests/fixtures/steer/golden/regenerate.ts` |
| Aggregate | The whole workspace | `pnpm check` |

All suites inject facts through the shared steer harness and its fixtures; nothing reads the live tree, the network, the ambient clock, or an environment variable. Golden fixtures are never rewritten by a suite and are regenerated only by the explicit regenerate path.

## Operational & Support

### Configuration

The family adds no configuration key. The schema, vocabularies, filing subset, ttl grammar and limits, bounds, rank map, record kinds, payload identity, and error literals are contract data. The state scope, the local PM context for the origin, the phase fold, and the blocker ledger come from the delivered composition.

### Observability

The payload is the observability surface: the standard envelope's `runId` and `timing`, the record projection, the boundary block, the per-note receipt or expiry, the asks batch, and the `omitted`/`truncated` counters. Every note is queued, landed, expired, or completed with a durable record; a failure carries its classified identity and exit. The delivered command-audit ledger records the invocation as it records every composed command. No metric, trace, event topic, or exporter is added.

### Cost and read cost

One invocation performs at most one steering-store read plus the append path's verified read, one fence acquisition per write, and — on `read` only — one phase-fold read and one blocker-ledger read. There is no retry loop, pagination, daemon, timer, or new runtime dependency. The display caps bound the payload and the human render, and the landing write is bounded by the queue's own due-note count, not by a display cap.

### Maintenance

- Changing a field, vocabulary, bound, or payload identity is a contract-data change plus domain, state, edge, renderer, tests, goldens, and documentation.
- A new consumer of the shared message record (agent-to-agent messaging, a board steering section) extends the same schema and appends its own kinds; it forks neither the schema nor the rank.
- The three error rows and their count pins move together under the declared registration discipline; the allowlist stays closed and exact.
- The asks join is a composition fact, not an owned default map: a consumer of the read point supplies the defaultable facts and the read derives `none`/`pending`/`applied` from them.

## Dependencies & Risks

- **Depends on** the phase-state records and the phase fold ([pm-notes lint and phase transitions](feature-pm-notes-lint-and-phase-transitions.md)) for the boundary-open derivation; no phase record kind is added.
- **Depends on** the typed blocker and question channel ([feature-blockers.md](feature-blockers.md)) for the open-question view, its ranking, and its audience filter, composed read-only.
- **Depends on** the owner-gate SLA and PDR-0003 ([feature-owner-gate-sla.md](feature-owner-gate-sla.md), [PDR-0003](../../decisions/PDR-0003-owner-gate-sla-default-map.md)) for the drawn-default semantics the ask join composes.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for the ledger, artifact boundaries, fences, and verified reads, and on the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, the `steer` domain kind, and the exit projection.
- **Depends on** the CLI entrypoint ([feature-cli-entrypoint.md](feature-cli-entrypoint.md)) for prompt-set membership, unconditional composition, and the help surfaces.
- **Depends on** the credential-guard decision ([TDR-0012](../../decisions/TDR-0012-blockers-credential-guard-pattern-deferral.md)) for the registered-value boundary and the absence of a pattern layer.
- **Risk — schema fork:** mitigated by one shared record schema and closed vocabularies with the filing subset declared as a restriction, asserted by the schema-conformance and non-owner-specificity tests.
- **Risk — interruption creep:** mitigated by the recorded boundary condition; a closed boundary applies nothing and appends nothing, and the closed case takes precedence over expiry.
- **Risk — silent note loss:** mitigated by fail-closed exit `2`, fenced appends, and post-append coverage verification.
- **Risk — stale direction applied late:** mitigated by the inclusive ttl judgement at the read and the classified `ttl-elapsed` outcome.
- **Risk — credential leak through a note:** mitigated by the registered-value guard on every content and identifier path, with zero persisted bytes on refusal.
- **Risk — ask-join drift:** mitigated by composing the delivered view and join facts verbatim, with no second ranking, no ledger write, and no invented default.

## Glossary & References

| Term | Definition |
|---|---|
| Steering note | The owner's bounded course-correction message, stored as one shared-schema message record with origin, receipt, and ttl. |
| Shared message record | The eleven-field typed record schema declared once as contract data; no field is owner-specific. |
| Filing subset | The declared restriction over the shared vocabularies the S5 filing path admits: `request`/`escalate`, scope `repo`, `from` `owner`, `to` `delivery`. |
| Origin block | The provenance triple `{change, repo, agent}` every message carries; derived at filing, with a bare `null` change when the checkout is unbound. |
| Read point | The declared pull point where queued notes are delivered — `steer read` at a phase boundary; running work is never interrupted. |
| Boundary-open | The phase-state condition under which notes may land: no phase record, or every recorded lifecycle entry completed. |
| Landed | A note applied at a boundary-open read; it carries a receipt and exactly one applied outcome record. |
| Receipt | The non-null quadruple on a landed note: `origin`, `readReceipt {at, boundary}`, `ttl`, and `expiresAt` — the audit evidence of delivery. |
| TTL expiry | The classified non-applied outcome when `now >= created + ttl` at a boundary-open read, recorded append-only with reason `ttl-elapsed`. |
| Drawn default | The declared value a filed note carries for an omitted field: kind `request`, priority `normal`, ttl `24h`, ref `null`. |
| Drawn-default join | The delivered PDR-0003 silence-default join (`drawnDefault`/`defaultState`) the asks batch composes from the delivered open-question view. |
| Shared rank | The deterministic derived order — priority class, then oldest `created`, then `id` — recomputed at every read and never stored. |
| Artifact-ref completion | The completion record attaching the proving artifact to a landed note; completion without an artifact is never recorded. |
| Derived lifecycle | The read-time state `queued \| landed \| expired \| completed`, derived from appended records rather than a stored flag. |

See also: [Typed Blocker and Question Channel](feature-blockers.md), [Owner-Gate SLA](feature-owner-gate-sla.md), [Board](feature-board.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md), [PM-Notes Lint and Phase Transitions](feature-pm-notes-lint-and-phase-transitions.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [TDR-0012](../../decisions/TDR-0012-blockers-credential-guard-pattern-deferral.md), the [command registry](../../planning/oss-tooling/cli-command-registry.md), and the M2 reference page `doc/planning/oss-tooling/milestones/m2/commands/steer.md`.

**Change records:** `doc/changes/2026-11/2026-11-16--GH-298--steer/` (the shared typed message record, the boundary read point, receipts and expiry, the asks batch, artifact-ref completion, and the twenty-third family mount).
