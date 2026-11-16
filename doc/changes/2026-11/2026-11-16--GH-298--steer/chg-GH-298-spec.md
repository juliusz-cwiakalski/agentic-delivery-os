---
change:
  ref: GH-298
  type: feat
  status: Proposed
  slug: steer
  title: "M2-S5: Steer (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [milestone-m2, cli, steering, typed-message-contract]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "M0-S10 (phase transitions and pm-notes lint — delivered: the phase-state records and the delivered phase fold the boundary-open condition reads)"
      - "M1-S11 (harness adapters — delivered: the session port whose resume/steer operations this surface deliberately does not invoke; the boundary read is a pull, never a push)"
      - "GH-230 (typed blocker channel — delivered: the open-question view, the PDR-0003 drawn-default join, the layered credential-guard pattern, the shared ranking, and the append-only record conventions this surface composes)"
      - "GH-297 (full board — delivered: the `ASKS` projection with drawnDefault, defaultState, and measured age that AC-1 composes at the boundary read; the board payload is the declared extension point for a later board surfacing of steering notes)"
      - "Delivered result contract, error table, state layer, and branding seam"
    external: []
  links:
    decisions: ["PDR-0003", "ADR-0003", "TDR-0012"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver `steer` — the first message type on the shared typed message record — so the owner files steering notes that queue with origin, a read receipt, and a TTL, land batched at the next phase boundary without killing the session or losing evidence, expire as classified outcomes when their TTL elapses, and complete against a proving artifact, making course corrections safe and auditable.

## 1. SUMMARY

The owner cannot change the course of a running delivery today without interrupting the session: course corrections mean killing or derailing live work, losing session context, or issuing unverifiable verbal directions. This change delivers the `steer` command family: the owner files a bounded steering note that persists as an append-only record in the repository's local state scope; the delivery reads queued notes at the declared read point — the phase boundary — where due notes land as one batch with a receipt each (origin block, read receipt, TTL), notes whose TTL elapsed are recorded as classified non-applied outcomes with the delivery continuing its previous course, and a landed note is completed later against the artifact that proves the course change.

Steer is not a bespoke owner-note channel: the note is stored on the shared typed message record schema (id, from, to, scope, kind, subject, ref, origin block, priority, created, ttl) with closed vocabularies declared once as contract data, so agent-to-agent messaging extends the same contract later without a schema fork. At the same boundary read, the payload batches the open owner-audience questions with their delivered drawn defaults and measured ages, so both directions of owner communication meet at one decision point. The family mounts at the production entrypoint as the twenty-third prompt-required command.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **A running delivery is interrupt-only today.** There is no surface for the owner to file a course correction against a live delivery. Interruption means session loss; verbal direction means no durable record; the pilot's carrier-inert inbox (unread for days while work continued) is the named anti-pattern.
- **The phase boundary exists and is recorded.** M0-S10 delivered the phase family: phase transitions are recorded as append-only phase-state records (began, completed, reopened kinds), and the delivered phase fold resolves a ref's lifecycle entries at read time. A boundary — a completed phase with the next not yet begun — is therefore an observable, recorded fact, not a convention.
- **The typed question channel is delivered and is the prior art.** GH-230 delivered the closed four-type question vocabulary, the owner/coordinator audience seam, the delegation policy-as-data, the layered credential guard (registered-secret-value refusal on every content path, no pattern layer per TDR-0012), the shared ranking (priority class, then oldest asked, then id), the append-only immutable records with derived closure, the bounded `blockers` surface with its exit matrix, and the deliberate `applied: false` posture: the channel records, later consumers act.
- **The drawn-default join is delivered.** PDR-0003's owner-gate policy map draws a silence default per defaultable gate; GH-297's board `ASKS` section projects open owner-audience questions with `drawnDefault`, `defaultState` (`none` | `pending` | `applied`), and measured `age` through the delivered open-question view. AC-1's "drawn defaults and measured aging" composes this delivered join; it does not re-derive it.
- **The messaging concept names steer as the first shipping vehicle.** The inter-agent communication concept defines the typed message record (id, from, to, scope, kind, subject, ref, origin `{change, repo, agent}`, priority, created, ttl, read receipt), the pull-at-read-points delivery semantics ("running work is never interrupted by messages"), the acknowledge→complete workflow with artifact-ref completion ("completion without an artifact is a lint finding"), the no-secrets rule, the untrusted-input posture, and the tooling-hides-the-format principle. It explicitly names `ados steer` (M2-S5) as the first message type on that record, with agent-to-agent messaging extending the same contract later.
- **The M2 journey defines the operator story.** "Steering a running delivery": the owner files a note that queues with origin, a read receipt, and a TTL; the note lands at the next phase boundary keeping session, branch, and evidence trail; a second note expires before any boundary, does not apply, and records the expiry with the delivery continuing its previous course; the record is auditable side by side (journey step 4 names the board; §7 and DEC-1 resolve that surface call for S5).
- **The contracts pack names the advisory surface.** `phase.state` (phase began, completed, reopened) is the event-taxonomy topic adjacent to steering; the pack marks it advisory for S5, with the owning story declaring the edge. S5's edge is the boundary-open derivation over the delivered phase-state records (DEC-5, DEC-10); no new event topic is declared.
- **The delivery conventions are settled.** Every payload stays inside the delivered five-field `delivery.result.v1` envelope with new keys under `data`; exit codes keep their meaning (`0` declared verdict, `1` refused, `2` platform/state failure); new identities register in the closed error table with exact two-segment allowlist entries; state records are append-only and additive; purity, determinism, bounds, and brand neutrality are delivered gates; mounting follows the prompt-required pattern (board mounted as the 21st family; the delivered set registers 22 today, `ceremony` having joined at index 21, so steer mounts as the 23rd).

### 2.2 Pain Points / Gaps

- **GAP-1**: No durable course-correction channel exists — the owner cannot queue a steering note against a running delivery, so corrections require interruption or unverifiable verbal direction.
- **GAP-2**: No receipts — even when a direction is communicated, nothing records who sent it, when it was read, or when it expired, so steering is unauditable and retro-blind.
- **GAP-3**: No expiry semantics — a stale direction delivered late is worse than none, and today nothing classifies a direction as no-longer-applicable.
- **GAP-4**: No shared message contract — an owner-specific note store would fork the schema the messaging concept requires for later agent-to-agent messaging.
- **GAP-5**: The boundary is recorded but unused as a read point — nothing composes the owner's pending notes and the delivery's open owner asks into one decision-point view where course correction and answers meet.

## 3. PROBLEM STATEMENT

Because a running delivery has no typed, receipted, expiring channel for owner course corrections, the owner cannot steer mid-delivery without killing the session or issuing unverifiable verbal directions — so corrections are unsafe, unauditable, and either lose session context and evidence or land too late with no record that they expired.

## 4. GOALS

- **G-1**: The owner files a steering note from the CLI; the note queues durably in the invoking repository's local state with its origin block, a drawn filing default for every field the owner omitted, and a TTL.
- **G-2**: A landed note carries its receipt — non-null origin, read receipt, and TTL — so every course correction is auditable evidence.
- **G-3**: Notes land batched at the next phase boundary: one read point, never an interruption; a note whose TTL elapsed before a boundary is recorded as a classified non-applied outcome and the delivery continues its previous course.
- **G-4**: The note lives on the shared typed message record schema with closed vocabularies declared once as contract data — not an owner-specific store — so agent-to-agent messaging extends the same contract later.
- **G-5**: The boundary read batches the open owner-audience questions with their delivered drawn defaults and measured ages, so steering and asks meet at one decision point.
- **G-6**: A landed note completes against the artifact that proves the course change; completion without an artifact is never recorded.
- **G-7**: The family is deterministic, bounded, local-state-only, brand-neutral, uses no LLM and no network, and never touches a live session.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance criteria demonstrated | 3 of 3 (§Appendix B maps each to its §17 criteria) |
| Scenario seeds green | SC-M2-S5-01 (landed note's `data.receipt` carries non-null `origin`, `readReceipt`, `ttl`) and SC-M2-S5-02 (TTL elapsed: exit `0`, `data.applied == false`, `data.expiry.reason == "ttl-elapsed"`) |
| Mid-phase interruptions caused by the read point | 0: a read while a phase is in progress lands nothing and appends no record (AC-F3-3) |
| Silent outcomes | 0: every note is queued, landed, expired, or completed with a durable record; an unreadable store withholds the command at exit `2` rather than rendering an empty queue |
| Unreceipted landings | 0: every landed note's receipt carries non-null `origin`, `readReceipt`, and `ttl` (100%) |
| Artifact-less completions | 0 recorded, 0 accepted (refused at exit `1`) |
| Schema sharing | 1 record schema declared once; 0 owner-specific fields, 0 owner-only vocabulary forks |
| Mounting completeness | 1 prompt-set entry, 1 root help entry, 1 family help, 1 reference page, 1 coverage-inventory row, 23 registered root families (the delivered base is 22; `ceremony` is the 22nd) |
| Determinism | Two runs over unchanged facts produce byte-identical human text and byte-identical machine `data` (envelope timing/run id excluded) |
| Quality gates | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens |

### 4.2 Non-Goals

- **NG-1**: No board surfacing of steering notes — no fifth board section, no board payload change, no `steering` column on any delivered board row (DEC-1; the board's ask schema remains the extension point for a later change).
- **NG-2**: No agent-to-agent messaging — no send path for agent principals, no inbox-per-agent mechanics, no threads, no group addressing, no remote backends (concept idea box; a later story extends the same contract).
- **NG-3**: No dispatch-as-wake: no urgency-driven session start, no push channel, no resident listener, no daemon, no timer (the read point is a pull performed by the delivery at the boundary).
- **NG-4**: No steering of a live harness session — the surface invokes no spawn, attach, resume, or harness steer operation and writes no control socket; the delivery adopts landed notes itself (DEC-12).
- **NG-5**: No new event topic, no subscription surface, and no telemetry export — steering evidence is git-persisted state records (DEC-10).
- **NG-6**: No resequencing beyond the shared derived rank — no automatic aging-based priority promotion of stored records (DEC-11).
- **NG-7**: No current-truth feature-spec amendment by this specification (phase 7 reconciles current truth; the one in-boundary exception is the error-table carrier, C-7).
- **NG-8**: No change to the delivered blockers, board, phase, or spend surfaces beyond the additive consumption described in §8 (the ask join reads; it never writes).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Owner filing of steering notes with drawn defaults | The owner needs a durable, ergonomic course-correction channel; every field the owner omits draws a declared default so a note always carries a complete record |
| F-2 | Notes on the shared typed message record schema | AC-3: the schema is shared, not owner-specific, so agent-to-agent messaging extends the same contract later |
| F-3 | Batched boundary delivery with receipts and TTL expiry | Notes must land without interrupting the session, carry receipts, and expire as classified outcomes (ticket AC-2, SC-01/SC-02) |
| F-4 | Batched owner asks with drawn defaults and measured aging at the boundary read | Ticket AC-1: owner asks are batched with drawn defaults and measured aging; the delivered join is composed, not re-derived |
| F-5 | Measured aging and the shared deterministic rank | Resequencing heuristics with measured aging: queue order is derived at every read, never stored |
| F-6 | Artifact-ref completion | The concept's acknowledge→complete workflow: a landed note closes against the proving artifact |
| F-7 | No-secrets guard on every content path | The concept's no-secrets rule; the delivered credential-guard pattern applies verbatim |
| F-8 | Production mounting (prompt set, composition, help, page, inventory) | A definition in the edge is not a reachable command; the delivery must be able to invoke the read point |
| F-9 | Classified refusals and failures with the declared exit projection | A silent or partial queue is a false all-clear; every refusal names its identity |
| F-10 | Deterministic, bounded, local-only, brand-neutral surface | Steering evidence must be reproducible, bounded, and safe |

### 5.1 Capability Details

- **F-1 — Owner filing with drawn defaults.** `steer send` accepts exactly one positional — the bounded note text — and the optional flags `--kind`, `--priority`, `--ttl`, `--ref`. Filing validates in a fixed order (text bounds, kind, priority, ttl, ref), then appends exactly one immutable message record to the invoking repository's steering queue. Every field the owner omits draws its declared default (DEC-6): kind `request`, priority `normal`, ttl 24 hours, ref `null`. The record's `origin` block is derived, never asked: `change` is the work-item ref when the invoking checkout's local PM context binds one (bare `null` with the derived absence when unbound), `repo` is the repository key, `agent` is `owner`. `created` comes from the injected clock. Filing performs no read of any remote source and answers with the queued record projection.
- **F-2 — The shared message record.** The steering note is one record on the shared typed message schema declared once as contract data: `id`, `from`, `to`, `scope`, `kind`, `subject`, `ref`, `origin {change, repo, agent}`, `priority`, `created`, `ttl` (DM-1). The vocabularies are the shared closed sets — scope `session | change | repo | fleet`, kind `ask | answer | notify | request | escalate | report | heartbeat`, priority `low | normal | high | urgent` — and S5 admits a filing subset (DEC-2): kind `request | escalate`, scope `repo`, `from` the human principal `owner`, `to` the receiving role `delivery`. No field is owner-specific, no record kind is owner-only, and a later agent-issued message validates against the same schema without a fork. The record is immutable once appended; lifecycle is derived at read time, never stored (DM-2).
- **F-3 — Batched boundary delivery.** `steer read` is the declared read point. It derives the boundary condition from the delivered phase-state records for the invoking repository: boundary-open when no phase record exists or every recorded lifecycle entry is completed, boundary-closed when an entry is in progress. At a boundary-open read, every due note (queued, TTL not elapsed) lands — the landing write is bounded by nothing but the queue's own contents, never by the payload's display cap (DM-8, AC-F3-4) — and the batch is returned in the shared rank order: one batched landing per boundary, never one-at-a-time. A note whose TTL elapsed before the read is recorded as an expired outcome with reason `ttl-elapsed`; it is not applied and the delivery continues its previous course. At a boundary-closed read nothing is applied and no record is written: the payload declines with the classified pending reason (DEC-5). A repeat read lands nothing new (NFR-5).
- **F-4 — Batched owner asks.** The read payload carries `asks[]`: the open owner-audience questions of the delivered typed-question ledger, projected through the delivered open-question view with the delivered PDR-0003 drawn-default join — `drawnDefault`, `defaultState` (`none | pending | applied`), measured `age` — under the delivered ranking and its bounds. The join composes the delivered view verbatim: no second ranking, no new question type, no ledger write, no coordinator-audience rows (NG-8). The boundary read is thus one decision-point view: pending course corrections one way, open asks with their silence defaults the other.
- **F-5 — Measured aging and the shared rank.** `age` is computed at read time from the injected clock for every note on every surface (send, list, read, complete). The queue order is the shared derived rank — priority class (`urgent` < `high` < `normal` < `low`), then oldest `created` first, then `id` ascending — recomputed at every read and never stored, so resequencing with measured aging is a property of the view, not a mutation (DEC-11). Ranks are contiguous `1..N` over the fully ranked set, assigned before any render cap.
- **F-6 — Artifact-ref completion.** `steer complete <id> --ref <artifact>` appends one completion record carrying the proving artifact reference for a landed note. The first authoritative completion is final; a repeated completion, a completion of a never-landed or expired note, and a completion without `--ref` are refused before any write. Completion without an artifact is never recorded (the concept's lint rule, enforced as a refusal rather than a finding).
- **F-7 — No-secrets guard.** Every content and identifier path — note text, `--ref`, and the derived origin values — is matched against the registered secret values and refused before any byte lands, with the same registered-secrets record the serialization redaction chokepoint consumes. No token-shape pattern scan exists; the boundary is exactly the registered-value match (TDR-0012).
- **F-8 — Production mounting.** `steer` joins the prompt-required command set as the twenty-third family (the delivered base is 22, `ceremony` being the 22nd): prompt-set entry, unconditional production composition over the delivered adapters, root and family help entries, a reference page serving the coverage check, and the coverage-inventory row. Mounting changes no other command's composition.
- **F-9 — Classified refusals and failures.** Three new identities join the closed error table under a new `steer` domain kind (DM-7): `steer.unknown-id` (user, exit `1`, scoped to `complete`), `steer.credential-value-rejected` (user, exit `1`), `steer.queue-unavailable` (platform, exit `2`). Value violations (empty or over-cap text, zero/negative/oversized/malformed ttl, unknown priority or kind, completion without `--ref` or without a read receipt, repeated completion) reuse the delivered `input.value.rejected` at exit `1`. Grammar violations (unknown flag, wrong positional count — including any positional on `read`, so `steer read <id>` is this refusal — missing flag value) are the delivered `fallback.invocation` at exit `1` before any state read. A store read or write failure, or a landing whose append cannot be verified, withholds the command as `steer.queue-unavailable` at exit `2` — a landing is never reported that did not durably land.
- **F-10 — Deterministic, bounded, local-only, brand-neutral.** Two runs over unchanged facts produce byte-identical human text and machine `data` (envelope timing and run id aside). Every array follows the declared order with unique identities. Output respects the declared bounds with every drop counted. The family reads and writes only the repository's local state scope: no tracker read or write, no provider call, no credential resolution, no network, no LLM, no timer, no daemon, no control socket, and no session operation of any kind (NG-4); the binary name in human output comes from the brand seam.

## 6. USER & SYSTEM FLOWS

```
Flow 1: The owner files a note (AC-F1-1)
  Owner runs `steer send "prefer smaller diffs; split the refactor"`
  → one message record appends with drawn defaults (kind request, priority normal, ttl 24h)
  → answer: the record projection (id, origin block, created, expiresAt), lifecycle "queued", exit 0.

Flow 2: The note lands at the boundary (AC-F3-1, SC-M2-S5-01)
  The delivery completes a phase; the boundary opens; the delivery runs `steer read`
  → boundary-open; the due note lands: one outcome record appends with the receipt
  → exit 0, the note carries `applied: true` and a receipt with non-null
    origin, readReceipt, and ttl; session, branch, and evidence trail are untouched.

Flow 3: The note expires (AC-F3-2, SC-M2-S5-02)
  A second note's TTL elapses before any boundary; the delivery runs `steer read`
  → the note is not applied: exit 0, `data.applied == false`,
    `data.expiry.reason == "ttl-elapsed"`; the expiry is recorded append-only
  → the delivery continues on its previous course; nothing else mutates.

Flow 4: The read never interrupts (AC-F3-3)
  A phase is in progress and `steer read` runs
  → boundary-closed: every note reads `applied: false` with
    `pendingReason: "phase-in-progress"`; no receipt or expiry record appends; exit 0.

Flow 5: One batched decision point (AC-F3-4, AC-F4-1)
  Two notes queue (one `escalate`, one older `request`) and one owner ask is open
  → `steer read` lands both notes in one batch in the shared rank order
  → `asks[]` carries the open owner ask with its drawnDefault, defaultState, and age
  → steering and asks meet in one payload, once per boundary.

Flow 6: Completion closes the loop (AC-F6-1)
  The delivery applies the course change and lands the proof
  → `steer complete <id> --ref <artifact>` appends the completion record
  → lifecycle derives "completed"; a second completion is refused.

Flow 7: The record is auditable (AC-F5-2)
  The owner runs `steer list`
  → queued, landed, and expired notes render side by side with receipts and expiry
    reasons, measured ages, and ranks — the journey's side-by-side record (DEC-1).
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `steer` command family with exactly four subcommands: `send` (file), `list` (queue view), `read` (the boundary read point), `complete` (artifact-ref completion), under one payload identity `delivery.steer.v1`.
- The shared typed message record schema (DM-1) declared once as contract data with the shared closed vocabularies, and the S5 filing subset (kind `request | escalate`, scope `repo`, `from: owner`, `to: delivery`).
- Three additive append-only state record kinds (message, outcome, completion) in the repository's local state scope, with derived lifecycle (`queued | landed | expired | completed`) and fenced appends with post-append verification.
- Boundary delivery: the boundary-open derivation from the delivered phase-state records, batched landing in the shared rank order, receipts on every landed note, `ttl-elapsed` expiry as a classified outcome, and the boundary-closed decline.
- The batched asks projection at the read point: the delivered open-question view with the delivered PDR-0003 drawn-default join and measured age, read-only.
- Measured aging and the shared derived rank on every surface; drawn filing defaults (kind, priority, ttl, ref).
- The no-secrets guard over every content and identifier path.
- Three new error identities (`steer.unknown-id`, `steer.credential-value-rejected`, `steer.queue-unavailable`) with the exact closed two-segment allowlist widening and every identity-count pin moved in the same change boundary (Appendix D).
- Production mounting: prompt-set entry as the 23rd family (22 delivered today), unconditional composition, root and family help, the reference page, the coverage-inventory row.
- Determinism, bounds, write discipline, purity, brand neutrality, and the declared exit projection.

### 7.2 Out of Scope

- [OUT] Board surfacing of steering notes: no fifth section, no board payload key, no change to any delivered board row or bound (DEC-1; the journey's side-by-side auditability is carried by the `steer list` view; a later change may extend the board through its declared ask-schema extension point).
- [OUT] Agent-to-agent messaging: agent send paths, per-agent inboxes, threads, group addressing, subscription/filter models, remote or service-backed backends (NG-2; the concept's idea box).
- [OUT] Dispatch-as-wake, urgency-driven session starts, push channels, resident listeners, daemons, and timers (NG-3).
- [OUT] Any session operation — spawn, attach, resume, harness steer, control socket (NG-4, DEC-12).
- [OUT] New event topics, subscription surfaces, or telemetry exports (NG-5, DEC-10).
- [OUT] Automatic aging-based priority promotion of stored notes (NG-6, DEC-11).
- [OUT] Message kinds beyond `request | escalate` on the filing path; the shared vocabulary declares the rest, and no S5 surface writes them.
- [OUT] Change-scoped, session-scoped, or fleet-scoped steering queues; the S5 queue is the repository's local state scope.
- [OUT] Current-truth feature-spec amendments by this specification (NG-7, with the C-7 carrier exception).

### 7.3 Deferred / Maybe-Later

- Board integration: a steering section or board rows for applied/expired notes, extending the delivered board payload through its declared extension point (DEC-1).
- Agent-to-agent send/read on the shared schema (the concept's second consumer rule: resist until a second consumer appears).
- The decision-point view at session start (the concept's bootstrap read point) — S5 delivers the boundary read point only.
- Aging-based escalation heuristics (promoting a note's rank class as its remaining TTL shrinks) if a measured need appears.
- History queries over completed steering records (per-change retro pulls) once receipts accumulate.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface is added or changed. The family is local-state-only: no tracker read or write, no provider call, no network request of any kind.

### 8.2 Events / Messages

No new event topic, kind, or payload shape ships in S5 (NG-5, DEC-10). Steering evidence is git-persisted append-only state records — the concept's rule that durable or authoritative means git. The contracts pack's `phase.state` topic stays the event-taxonomy subscription surface owned by M2-S13; S5's declared edge over it is the boundary-open derivation reading the delivered phase-state records (DEC-5), not a publisher or subscriber relationship. The delivered command-audit ledger records `steer` invocations as it records every composed command.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Shared message record | One schema, declared once as contract data: `id` (`msg-` + opaque per-store-unique suffix), `from` (principal; S5 writes `owner`), `to` (target; S5 writes the role `delivery`), `scope` (closed `session \| change \| repo \| fleet`; S5 writes `repo`), `kind` (closed `ask \| answer \| notify \| request \| escalate \| report \| heartbeat`; S5 files `request \| escalate`), `subject` (the bounded note text, ≤ 160 chars), `ref` (artifact reference or bare `null`, ≤ 160 chars), `origin` (`{change: string \| null, repo: string, agent: string}`; S5 writes `agent: "owner"`), `priority` (closed `low \| normal \| high \| urgent`), `created` (injected clock), `ttl` (declared grammar `<positive-integer><unit>` with unit `s \| m \| h \| d`; positive and ≤ `30d`; drawn default `24h`). No field is owner-specific; no vocabulary member is owner-only (DEC-2) |
| DM-2 | Lifecycle records and derived state | Three additive append-only record kinds in the repository state scope: `steering.message` (the immutable record of DM-1), `steering.outcome` (one per boundary resolution: a receipt — read timestamp, boundary context, recorded ttl — or an expiry with reason and timestamp), `steering.completion` (artifact ref, timestamp). The note's lifecycle is derived at read time, never stored: `queued` (message only), `landed` (applied outcome), `expired` (expired outcome), `completed` (landed + completion). Exactly one outcome per note; the first completion is authoritative |
| DM-3 | Read-point outcome | Per note: `applied` (`true` for landed, `false` for expired or pending), `receipt` (`{origin, readReceipt: {at, boundary}, ttl, expiresAt}` — all non-null on a landed note; SC-M2-S5-01), `expiry` (`{reason: "ttl-elapsed", recordedAt}` — present exactly on an expired note), `pendingReason` (`"phase-in-progress"` — present exactly on a boundary-closed decline). The payload-level `data.applied` is `true` iff at least one note landed in the read; `data.expiry.reason` is present exactly when at least one note expired (SC-M2-S5-02; DEC-7) |
| DM-4 | Queue view (`steer list`) | Three lifecycle groups side by side in declared order — `queued[]`, `landed[]`, `expired[]` — each row carrying the shared note fields, `age` (ms, injected clock), `rank`, and for landed rows the receipt and `completedWith` (artifact ref or bare `null`), for expired rows the expiry reason and timestamp. ≤ 8 rows per group with counted omissions (DEC-1: this view carries the journey's side-by-side auditability) |
| DM-5 | Shared rank and aging | Priority class map `urgent=1, high=2, normal=3, low=4`; rank key `(class asc, created asc, id asc)`; ranks contiguous `1..N` assigned before any render cap; `age` = injected-clock now − `created` in ms, computed at read time on every surface; queue order is derived, never stored (DEC-11) |
| DM-6 | Boundary asks batch | `asks[]` on the read payload: the open owner-audience questions through the delivered open-question view — `id`, type (delivered closed set), `ref` (delivered string or bare `null`), `lane`, bounded question text, `askedAt`, measured `age`, `drawnDefault` (delivered PDR-0003 join or bare `null`), `defaultState` (`none \| pending \| applied`), delivered rank — bounds and ordering exactly as delivered; coordinator-audience questions are never asks; no ledger write |
| DM-7 | Error identities | A new `steer` domain kind with exactly three rows: `steer.unknown-id` (user, exit `1`, `not_landed`: the id passed to `complete` is not a steering record of this repository; scoped to `complete` only — a positional on `read` is the `fallback.invocation` grammar refusal), `steer.credential-value-rejected` (user, exit `1`, `not_landed`, zero persisted bytes), `steer.queue-unavailable` (platform, exit `2`, `not_landed`: the steering store cannot be read or an append cannot be verified). All three join the closed two-segment allowlist by exact declaration — **56 → 59**, no `steer.*` family and no pattern widening — with the carrier counts moving **140 → 143** entries, **139 → 142** delivered rows, **140 → 143** documented identities, **3** `steer` domain-kind rows, and the sync-suite arithmetic **+106 → +109**; every count-pinning site is enumerated in Appendix D and moves in the same commit as the rows, followed by the repo-wide no-leftover scan and four-way agreement (DEC-8, C-7, C-16) |
| DM-8 | Bounds and caps | Note text ≤ 160 chars; `ref` ≤ 160 chars; ttl grammar `<positive-integer><unit>` (unit `s\|m\|h\|d`), ≤ `30d`; list ≤ 8 rows per lifecycle group; the read **payload** lists ≤ 20 notes with counted overflow, while the **landing write is not capped by that display bound** — every due note lands and is receipted, nothing is lost or rolled to a later boundary (AC-F3-4); asks ≤ 8 (delivered cap); serialized `data` ≤ 65 536 UTF-8 bytes; human render ≤ 32 lines / 6 144 bytes (the delivered status bounds, as blockers); when the byte cap binds, rows drop tail-first in the fixed order `asks` → `notes` (tail-first by rank within notes), each drop counted in `omitted` with `truncated: true`; the boundary block is never dropped |

**Command grammar.** `<binary> steer send "<text>" [--kind request|escalate] [--priority low|normal|high|urgent] [--ttl <duration>] [--ref <artifact>]`; `<binary> steer list`; `<binary> steer read`; `<binary> steer complete <id> --ref <artifact>`. `send` accepts exactly one positional (the text); `complete` exactly one (the id) with `--ref` required; `list` and `read` accept none — `steer read <id>` is therefore the `fallback.invocation` grammar refusal, never `steer.unknown-id` (the id-targeting refusal belongs to `complete` alone); `--json` is the global machine-output switch. **`--ttl <duration>` grammar**: `<duration>` is `<positive-integer><unit>` with unit ∈ `s | m | h | d` (the concept document's `14d` style); zero, negative, malformed (not matching the grammar), and oversized values are refused pre-write through the same `input.value.rejected` path as the other value violations; the declared maximum is `30d` (2 592 000 seconds) and the drawn default is `24h` (DEC-6). An unknown subcommand, unknown flag, wrong positional count, or missing flag value is refused as the delivered `fallback.invocation` at exit `1` before any state read.

**Contract shape.**

```
steer send.data = {
  schemaVersion: "delivery.steer.v1",
  record: { id, from, to, scope, kind, subject, ref, origin, priority, created, ttl, expiresAt },
  lifecycle: "queued"
}

steer read.data = {
  schemaVersion: "delivery.steer.v1",
  boundary: { open: boolean, phase: string | null, phaseUnknownReason?: "phase-unrecorded" },
  applied: boolean,
  expiry?: { reason: "ttl-elapsed" },
  notes: [{ id, kind, priority, subject, ref, origin, created, ttl, expiresAt, age, rank,
            lifecycle: "landed" | "expired" | "queued", applied,
            receipt?: { origin, readReceipt: { at, boundary }, ttl, expiresAt },
            expiry?: { reason, recordedAt }, pendingReason? }],
  asks: [{ id, type, ref, lane, question, askedAt, age, drawnDefault, defaultState, rank }],
  omitted: number, truncated: boolean
}

steer list.data = {
  schemaVersion: "delivery.steer.v1",
  queued: [row], landed: [row], expired: [row],
  omitted: number, truncated: boolean      // row = DM-4 shape
}

steer complete.data = {
  schemaVersion: "delivery.steer.v1",
  record: { id, lifecycle: "completed", completedAt, artifact }
}
```

**Ordering and identity invariants** (normative). `notes[]` orders by the shared rank (DM-5); `asks[]` orders by the delivered blocker rank; list groups order by the shared rank within each group; identity is `id`, unique across the repository's steering records. No ordering is influenced by store return order or filesystem order.

**Boundary resolution.** The boundary-open condition derives from the delivered phase-state records for the invoking repository: no phase record → open, `phase: null` + `phaseUnknownReason: "phase-unrecorded"`; a record whose every lifecycle entry is completed → open, `phase` = the latest completed entry; an entry in progress → closed. TTL judgement is `now >= created + ttl` against the injected clock, evaluated only at a read (DM-5, NFR-7).

**Exit projection.**

| Outcome | Envelope | Exit |
|---|---|---|
| `send`, `list`, `read`, or `complete` produced (including an empty queue and a boundary-closed decline) | Success envelope, `delivery.steer.v1` `data` | `0` |
| Value violation (empty/over-cap text, zero/negative/oversized/malformed or out-of-range ttl, bad priority/kind, completion without `--ref`, without a read receipt, or repeated) | Error envelope, `input.value.rejected` (delivered) | `1` |
| `complete` target id not a steering record of this repository | Error envelope, `steer.unknown-id` | `1` |
| Registered secret value on any content path | Error envelope, `steer.credential-value-rejected` | `1` |
| Grammar violation (unknown subcommand/flag, positional count, missing value — including any positional on `read`, so `steer read <id>` is this refusal, never `steer.unknown-id`) | Error envelope, `fallback.invocation` (delivered) | `1` |
| Steering store unreadable, unwritable, or an append unverifiable | Error envelope, `steer.queue-unavailable` | `2` |

### 8.4 External Integrations

N/A — no vendor or API integration. The family touches no tracker, provider, credential port, or network endpoint; an offline host behaves identically to an online one.

### 8.5 Backward Compatibility

- **No delivered surface changes shape.** The blockers ledger, board payload, phase records, and spend surface are read-only inputs (the asks join) or untouched; no delivered payload key is added, renamed, or re-semanted (NG-1, NG-8).
- **New payload identity.** `delivery.steer.v1` is a new payload identity; no consumer of delivered payloads sees a change.
- **New error identities.** The three `steer` rows are additive; the closed two-segment allowlist widens by exactly three codes (56 → 59, DEC-8); no delivered identity changes meaning, category, or exit.
- **New state record kinds.** The three steering record kinds are additive in the repository state scope; no delivered record kind, store layout, or state file changes, and no data migration occurs.
- **Grammar refusals** reuse the delivered `fallback.invocation`, so a consumer that already classifies a broken invocation keeps working.
- **Family count.** The prompt-required set grows 22 → 23 (the delivered base registers 22 with `ceremony` at index 21); the delivered family-count assertions move with the mount (F-8).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Envelope continuity: every new key lives under `data`, and the five-field `delivery.result.v1` envelope is untouched | 0 new top-level envelope keys; 0 `ok`/`command` fields anywhere |
| NFR-2 | Determinism and ordering: repeated runs over unchanged facts are stable, and every array follows its declared order | 2 of 2 runs byte-identical in human text and in JSON `data` (envelope timing/run id excluded); 0 undeclared order sources |
| NFR-3 | Identity and rank integrity: record ids are unique per store and ranks are contiguous | 0 duplicate ids; ranks exactly `1..N` over the fully ranked set before caps |
| NFR-4 | Bounds: machine and human output stay within the declared caps, and every drop is counted; the display caps never bind a landing write | `data` ≤ 65 536 UTF-8 bytes; human ≤ 32 lines / 6 144 bytes; text/ref ≤ 160 chars; ttl grammar `<positive-integer><unit>` (`s\|m\|h\|d`), ≤ `30d`; list ≤ 8 rows per group; read payload lists ≤ 20 notes (landing writes uncapped — every due note lands and is receipted, overflow counted per AC-F3-4); every drop counted with `truncated` set |
| NFR-5 | Write discipline: append-only, idempotent, fenced | `send` appends exactly 1 message record; `read` appends ≤ 1 outcome record per note and only for notes transitioning (0 for already-resolved notes); `complete` appends exactly 1 completion record, and a second completion appends 0; 0 edits, deletes, or prunes; an append that cannot be verified leaves no reported landing |
| NFR-6 | Purity: no LLM, no network, no tracker/provider access, no timer, no daemon, no control socket, no session operation, no product literal | 0 LLM calls; 0 network requests; 0 provider or tracker reads/writes; 0 timers/loops/sockets; 0 spawn/attach/resume/steer session operations; 0 hardcoded product or binary names (brand seam only) |
| NFR-7 | Clock discipline: all aging, TTL, and boundary judgement uses the injected clock | 0 ambient wall-clock reads in the pure domain; every `age`/expiry/boundary value reproducible from a fixed clock |
| NFR-8 | Read cost: one bounded pass per invocation | ≤ 1 verified steering-store read + ≤ 1 delivered phase-state read + ≤ 1 blocker-ledger read per `read` invocation; ≤ 1 store read per `list`/`complete`; 0 reads beyond the local state scope |
| NFR-9 | Quality gates for the delivering change | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens |
| NFR-10 | Commit hygiene for the delivering change | Conventional commit subjects via the commit primitive; every commit body/footer line ≤ 100 characters |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no new telemetry ships. Observability is the payload's own evidence discipline:

- Every note's record, receipt, expiry, and completion is a durable, readable state record — the steering stream is retro evidence by construction (origin linkage makes a change-level retro pull exactly the communication its delivery generated).
- `omitted` and `truncated` count every dropped row, so a bounded view never implies completeness.
- Failures are the classified identities of DM-7 with their exit rows; the summary names the failing condition.
- The delivered command-audit ledger records the invocation as it records every composed command; the family adds no counter, metric, or trace.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Schema fork: the note store grows owner-specific fields or vocabularies, and agent-to-agent messaging cannot reuse it | H | M | The shared schema is contract data declared once (DM-1); closed shared vocabularies; the filing subset is declared, not forked; AC-F2-1 asserts no owner-specific field and schema-level validation (F-2, DEC-2) | Low |
| RSK-2 | Interruption creep: notes land mid-phase and break running work | H | L | The boundary-open condition derives from the delivered phase-state records; a boundary-closed read declines without applying or recording (F-3, DM-3, DEC-5, AC-F3-3) | Low |
| RSK-3 | Silent note loss: a store failure or unverified append reports a queue that is not durable | H | M | Fail-closed: `steer.queue-unavailable` at exit `2` withholds the command; fenced appends with post-append verification; a landing is never reported that did not durably land (F-9, NFR-5, AC-F9-2) | Low |
| RSK-4 | Stale direction harm: an expired note applies late and steers the wrong course | M | M | TTL is judged at the read against the injected clock with the delivered `>=` boundary convention; expiry is recorded as a classified outcome and the delivery continues its previous course (F-3, DM-3, AC-F3-2) | Low |
| RSK-5 | Credential leak through a note | H | L | The layered guard refuses registered secret values on every content and identifier path before any byte lands; no pattern layer (TDR-0012 boundary) (F-7, AC-F7-1) | Low |
| RSK-6 | Count-pin drift in error-table registration | M | M | The exact allowlist widening (56 → 59) and every count-pinning site are enumerated in Appendix D and move in the same commit as the rows, followed by the repo-wide no-leftover scan and four-way agreement (DM-7, DEC-8, AC-F9-4) | Low |
| RSK-7 | Ask-join drift: the read re-derives ranking or defaults instead of composing the delivered view | M | L | `asks[]` is the delivered open-question view and PDR-0003 join verbatim — no second ranking, no ledger write (F-4, DM-6, NG-8, AC-F4-1) | Low |
| RSK-8 | Mounting gap: the read point is not reachable by the delivery, or the coverage check fails | M | M | Mounting is a declared capability with the complete unit: prompt-set entry, composition, help entries, reference page, inventory row, and the moved family-count assertions (F-8, AC-F8-1/2) | Low |

## 12. ASSUMPTIONS

- The delivered phase-state records and phase fold (M0-S10) stay stable; the boundary-open derivation consumes them and adds no phase record kind.
- The delivered typed-question ledger, open-question view, PDR-0003 policy map, and credential-guard pattern (GH-230) stay stable; the asks join consumes them read-only.
- The delivered result contract, error-table conventions, state-layer record conventions, and branding seam stay stable; the three steering record kinds and three error rows join them additively.
- A steering note is ephemeral-class by nature: every note carries a ttl (drawn when omitted), and no S5 surface writes a durable-class (ttl-less) message.
- The invoking checkout is the steered delivery; filing outside a bound checkout records the classified bare `null` origin change rather than refusing.
- The delivery invokes the read point at the boundary by convention (prompt-set membership makes the command reachable); S5 enforces the boundary mechanically on the read side, not by scheduling.
- Only the repository-local scope ships; a fleet- or change-scoped steering queue is a later extension of the same schema.
- The delivered five-field envelope shape, exit-code meaning, and error taxonomy remain unchanged.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S10 (phase transitions, pm-notes lint) | **Delivered** — the phase-state records and the delivered phase fold the boundary-open condition reads |
| Depends on | M1-S11 (harness adapters) | **Delivered** — the session port whose resume/steer operations this surface deliberately never invokes; the read point is a pull |
| Depends on | GH-230 (typed blocker channel) | **Delivered** — the open-question view, the drawn-default join, the credential-guard pattern, the shared-ranking precedent, the append-only record conventions |
| Depends on | GH-297 (full board) | **Delivered** — the `ASKS` projection (drawnDefault, defaultState, age) AC-1 composes; the declared extension point for any later board surfacing (DEC-1) |
| Depends on | Delivered result contract, error table, state layer, branding seam | The `steer` domain kind, its three rows, and the exact allowlist widening must be registered and documented in-boundary (C-7), including every count-pinning site (DEC-8, Appendix D) |
| Blocks | Nothing in M2 | M2-S6 metrics and the ceremony surfaces consume their own evidence; agent-to-agent messaging (concept) is a later consumer of the shared schema, not of this change's artifacts |
| Related | M2-S13 (event taxonomy) | Owns the `phase.state` topic; S5 declares no publisher or subscriber (DEC-10) |

## 14. OPEN QUESTIONS

The planning questions were resolved during specification: the board-surfacing boundary call (OQ-1), the receipt-path mapping for the scenario seed (OQ-2), the payload-level `applied`/`expiry` semantics (OQ-3), and the read-point verb (OQ-4) are closed as DEC-1, DM-3, DEC-7, and DEC-4 respectively. No question in this specification defers a decision to plan or test authoring.

| ID | Question (raised at planning) | Resolution | Where | Status |
|----|----------------------------------------|------------|-------|--------|
| OQ-1 | The journey shows the board displaying applied and expired notes side by side; the ticket AC set does not name the board. Is board surfacing in-scope for S5? | Deferred. The AC set is canonical and names no board; the board's four-section fixed order, bounds, and byte guard were just delivered (GH-297) and re-opening them without a board AC would fork a fresh contract. The journey's intent — an auditable side-by-side record — is carried by the `steer list` view (AC-F5-2); a later change may extend the board through its declared extension point. | §7.2, §7.3, DEC-1, NG-1 | Closed |
| OQ-2 | SC-M2-S5-01 asserts `data.receipt` carries non-null `origin`, `readReceipt`, and `ttl`; where does that block live in a batched payload? | The receipt block is per landed note at `notes[].receipt` with exactly those three members (plus `expiresAt`); the seed's `data.receipt` assertion maps to the landed note's receipt in the single-note fixture (test plan inherits the mapping). | DM-3, AC-F3-1, Appendix C | Closed |
| OQ-3 | SC-M2-S5-02 asserts payload-level `data.applied == false` and `data.expiry.reason`; how do these reconcile with a batch? | `data.applied` is `true` iff at least one note landed; `data.expiry.reason` is present exactly when at least one note expired. Total over empty, all-expired, mixed, and pending reads; both seed fixtures assert cleanly. | DM-3, DEC-7 | Closed |
| OQ-4 | Which verb names the boundary read point? | The concept's messaging-surface verbs verbatim: `send`, `list`, `read`, `complete`. `steer read` is the declared read point; no `collect`/`deliver`/`poll` coinage. | §8.3 grammar, F-3, DEC-4 | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Board surfacing of steering notes is **out of scope for S5**; the journey's side-by-side auditability is carried by the `steer list` view (queued/landed/expired groups with receipts and expiry reasons), and a later change may extend the board through its declared extension point | The ticket AC set is canonical and names no board; GH-297 delivered the board's four-section fixed order, bounds, and byte guard one day before this change and explicitly scoped steering out (its NG-1); re-opening a fresh contract without a board AC would fork it. The journey's step-4 outcome — the record is auditable side by side — is preserved on the steering surface's own view. Symmetry with GH-297: each surface leaves the other untouched | 2026-11-16 |
| DEC-2 | The steering note is stored on the shared typed message record (DM-1) with the concept's closed vocabularies declared once as contract data; S5 admits a declared filing subset (kind `request \| escalate`, scope `repo`, `from: owner`, `to: the role delivery`); the record is immutable once appended and lifecycle derives from appended outcome/completion records, never a stored flag | The ticket requires the schema shared, not owner-specific, and the concept names steer the first message type on that record. The immutable-record/derived-closure pattern is the delivered blockers precedent (GH-230); deriving lifecycle keeps the store append-only and the read total | 2026-11-16 |
| DEC-3 | One payload identity, `delivery.steer.v1`, across all four subcommands with per-form `data` shapes | The delivered blockers family uses one schemaVersion across list/answer/publish; four identities would fork the contract for no consumer benefit | 2026-11-16 |
| DEC-4 | The subcommand verbs are the concept's messaging-surface verbs verbatim: `send` (file), `list` (queue view), `read` (the declared boundary read point), `complete` (artifact-ref completion) | The concept states agents use "list, read, send, acknowledge, complete, query history"; reusing its verbs keeps the tooling-hides-the-format contract stable for the later agent-to-agent consumers of the same surface. The read receipt lands on `read`, making the verb's meaning literal | 2026-11-16 |
| DEC-5 | The boundary-open condition derives from the delivered phase-state records: no phase record → open with `phase: null` + `phase-unrecorded`; every recorded entry completed → open with `phase` = the latest completed entry; an entry in progress → closed. A closed read declines with `pendingReason: "phase-in-progress"`, applies nothing, and appends no record | The contracts pack names `phase.state` the advisory surface and the owning story declares the edge — this derivation is the edge. It makes "land at the next phase boundary, never interrupt" mechanical and testable rather than conventional, and it reuses the delivered phase vocabulary instead of inventing a boundary record kind | 2026-11-16 |
| DEC-6 | Drawn filing defaults: kind `request`, priority `normal`, ttl 24 hours, ref `null`; the origin block is derived from the checkout (bound ref, repository key, `owner`), never asked | AC-2 requires every note to carry origin, receipt, and ttl, so an omitted ttl must draw rather than absent; 24 h aligns with the delivered owner-gate escalation rhythm (the note either lands at the next boundary or expires on the same clock the gates use). Deriving origin honors the concept's every-message-carries-its-origin rule without CLI ceremony | 2026-11-16 |
| DEC-7 | `data.applied` is `true` iff at least one note landed in the read; `data.expiry.reason` is present exactly when at least one note expired; per-note `applied`, `receipt`, `expiry`, and `pendingReason` carry the full detail | The scenario seeds assert payload-level fields on single-note fixtures; the declared totals make both seeds assert cleanly while keeping mixed batches unambiguous (a mixed read is `applied: true` with a per-note `applied: false` and the payload `expiry` present) | 2026-11-16 |
| DEC-8 | Three error identities join a new `steer` domain kind — `steer.unknown-id`, `steer.credential-value-rejected`, `steer.queue-unavailable` — each an exact two-segment declaration in the closed allowlist (**56 → 59**, no `steer.*` family, no pattern widening), with the carrier counts **140 → 143** entries, **139 → 142** delivered rows, **140 → 143** documented identities, **3** steer rows, and the sync-suite arithmetic **+106 → +109**; every Appendix D site moves in the same commit as the rows, followed by the repo-wide no-leftover scan and four-way agreement. Value violations reuse the delivered `input.value.rejected`; grammar refusals reuse `fallback.invocation` | GH-230/GH-297 precedent (their DEC-9/DEC-20): a two-segment identity enters only by exact declaration, and the checks assert the exact set size so an undeclared addition is a red gate. Reusing the delivered containment and value identities avoids forking classifications consumers already match | 2026-11-16 |
| DEC-9 | `steer` mounts as the twenty-third prompt-required family (the delivered base registers 22 — `status` … `events`, `board`, `ceremony` — pinned by the entrypoint, board-mounting, events/dispatch/daemon composition, and ceremony suites): prompt-set entry, unconditional production composition, root and family help, the reference page serving `--help`/`--version`, and the coverage-inventory row; the family-count assertions move 22 → 23 with the mount | The delivery must be able to invoke the read point and the owner the filing surface; edge-only composition is not reachable (the board's delivered lesson). The mounting unit is the delivered pattern (GH-288, GH-289, GH-290, GH-309, GH-296, GH-297) | 2026-11-16 |
| DEC-10 | No new event topic in S5: steering evidence is git-persisted append-only state records; the `phase.state` topic stays M2-S13's subscription surface, and S5's edge over it is the boundary-open derivation only | The concept's persistence rule — durable or authoritative means git; ephemeral or signaling means the event stream — makes records the right plane for auditable steering. A topic without a subscriber would be speculative surface | 2026-11-16 |
| DEC-11 | Resequencing is the shared derived rank (priority class, then oldest created, then id) recomputed at every read and never stored; automatic aging-based priority promotion of stored notes is deferred | The ticket's "resequencing heuristics with measured aging" is satisfied by a deterministic, measured, derived order — the delivered blockers ranking pattern; promotion heuristics mutate policy, not views, and have no measured need yet (NG-6) | 2026-11-16 |
| DEC-12 | The surface declares no session operation: no spawn, attach, resume, or harness steer call, and no control socket; landed notes are adopted by the delivery itself at the read point | The concept's pull-at-read-points rule and the blockers channel's declared recorded-versus-applied posture: the surface records and returns; the consuming session acts. A steer command that steered sessions directly would reintroduce the interruption this change exists to remove | 2026-11-16 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `steer` CLI family (new command definition and edge composition in the CLI package) | New — the four subcommands, grammar, drawn defaults, exit projection, brand seam, and runtime composition over the state store, injected clock, id factory, and registered secrets |
| Steer contracts and pure domain (new contract and domain modules in the core package) | New — the shared record schema and vocabularies, bounds, validation order, the shared rank and aging, TTL and boundary judgement, lifecycle derivation, the asks-batch composition, and the bounded renderers |
| Steer state records (new state module over the injected state port) | New — the three additive record kinds, verified read with derived closure, fenced appends with post-append verification |
| Delivered phase-state read | Consumed unchanged — the boundary-open derivation reads the delivered phase fold; no phase record kind changes |
| Delivered blocker/question view | Consumed unchanged — the asks batch projects the delivered open-question view and PDR-0003 join read-only |
| Error table and classifier (core error-table contract, CLI classification, the sync check and its structural mirror) | Extended — the new `steer` domain kind and three rows; the closed two-segment allowlist gains exactly those three codes (56 → 59), and every identity-count pin in Appendix D moves with them (140 → 143; 139 → 142; +106 → +109; 143 documented) |
| CLI entrypoint, production composition, help, and prompt-required set | Extended — the 23rd prompt-required family: prompt-set entry, unconditional composition, root and family help entries |
| Help-coverage check and coverage inventory | Extended — the steer reference page and inventory row |
| Current-truth feature specs | Reconciled in phase 7 (see §16.1); the error-table carrier is the one in-boundary documentation write (C-7) |
| Planning corpus (backlog marker, M2 status, CLI command registry) | Maintained at delivery per milestone conventions |

### 16.1 Doc impact (phase-7 reconciliation)

| Document | Expected reconciliation |
|---|---|
| New current-truth feature spec (steer) | Authored in phase 7: the shared record schema, the filing subset and drawn defaults, the boundary read point and its derivation, receipts and expiry, completion, the asks batch, bounds, exit projection, and the no-session-operation posture |
| `doc/spec/features/feature-result-contract.md` | **In-boundary carrier (C-7):** the `steer` domain kind, its three rows with exit projections, and the closed two-segment allowlist paragraph gaining exactly the three steer codes (56 → 59, no family/pattern widening); the documented identity counts move 140 → 143 at both mentions, and the kind inventory gains the three steer rows. Phase 7 reconciles the surrounding prose and confirms the same numbers |
| `doc/spec/features/feature-blockers.md` | Additive note that the steer read composes the delivered open-question view and drawn-default join read-only; no delivered blockers behaviour changes |
| State-layer feature spec | The three additive steering record kinds are registered in the record-kind inventory per the delivered conventions |
| `doc/spec/features/feature-board.md` | No change (DEC-1); the board page stays the extension-point statement for any later steering surfacing |
| Event-taxonomy feature spec | No change confirmed (DEC-10): no new topic or kind |
| Planning corpus | Backlog M2-S5 progress marker, M2 status snapshot, CLI command registry row (23 families) |

## 17. ACCEPTANCE CRITERIA

**Filing and the shared record**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a bound checkout, **when** the owner runs `steer send "<text>"` with no flags, **then** exactly one message record appends carrying `from: "owner"`, `to: "delivery"`, `scope: "repo"`, `kind: "request"`, the bounded text, `origin {change: <bound ref>, repo: <repository key>, agent: "owner"}`, `priority: "normal"`, `created` from the injected clock, and `ttl` equal to the drawn 24-hour default with its derived `expiresAt`; the answer carries the record projection and `lifecycle: "queued"` at exit `0`; and **given** an unbound checkout, **then** `origin.change` is the bare `null` and the run still succeeds | F-1, F-2, DM-1, DEC-6 |
| AC-F1-2 | **Given** an empty or over-cap (over 160 chars) note text, a ttl that is zero, negative, oversized (over the declared `30d` maximum), or malformed (not `<positive-integer><unit>` with unit `s|m|h|d`), a priority or kind outside the closed filing set, or `--ref` over 160 chars, **when** `steer send` runs, **then** the run is refused with the delivered `input.value.rejected` at exit `1`, consequence `not_landed`, before any state read or write, with zero persisted bytes | F-1, F-9, DM-8, NFR-5 |
| AC-F2-1 | **Given** any appended steering record, **when** it is validated, **then** it conforms to the one shared message schema (DM-1) — the record carries no owner-specific field, every vocabulary it uses is a member of the shared closed sets declared once as contract data, and the filing subset (`request`/`escalate`, `repo`, `owner`, `delivery`) is a declared restriction of those sets rather than a separate schema — so a message issued by a non-owner principal against the same schema validates without an owner-specific branch | F-2, DM-1, DEC-2 |

**Queue view, aging, and the shared rank**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** queued notes with mixed priorities and creation times, **when** `steer list` or `steer read` runs, **then** every row carries `age` in milliseconds computed from the injected clock, the rows order by the shared rank (priority class, then oldest `created` first, then `id` ascending), ranks are contiguous `1..N` assigned before any render cap, and a repeat run over unchanged facts reproduces the identical order and ages | F-5, DM-5, NFR-2, NFR-7 |
| AC-F5-2 | **Given** a repository with queued, landed, and expired notes, **when** `steer list` runs, **then** the three lifecycle groups render side by side in declared order — landed rows carrying their receipts (`origin`, `readReceipt`, `ttl`) and `completedWith` where completed, expired rows carrying their `ttl-elapsed` reason and timestamp — with ≤ 8 rows per group and every omission counted, so the steering record is auditable on the steering surface itself (journey step 4's outcome; DEC-1) | F-5, DM-4, DEC-1 |

**Boundary delivery and expiry**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a queued note whose ttl has not elapsed and a boundary-open phase state (no phase record, or every recorded lifecycle entry completed), **when** `steer read` runs, **then** the note lands: exit `0`, the note carries `applied: true`, `lifecycle: "landed"`, and a `receipt` with non-null `origin`, `readReceipt`, and `ttl` (scenario seed SC-M2-S5-01; the seed's `data.receipt` assertion maps to the landed note's receipt per Appendix C), exactly one outcome record appends, and the delivery's session, branch, and evidence trail are untouched | F-3, DM-2, DM-3, DEC-5, DEC-12 |
| AC-F3-2 | **Given** a queued note whose ttl elapsed before any boundary (`now >= created + ttl` on the injected clock), **when** `steer read` runs at a boundary-open read, **then** the note is not applied: exit `0`, `data.applied == false`, `data.expiry.reason == "ttl-elapsed"`, the note carries `applied: false` and its `expiry {reason, recordedAt}`, exactly one expiry outcome record appends, and nothing else mutates — the delivery continues on its previous course (scenario seed SC-M2-S5-02) | F-3, DM-3, DEC-7 |
| AC-F3-3 | **Given** a phase record with a lifecycle entry in progress, **when** `steer read` runs, **then** the read declines: exit `0`, `boundary.open` is `false`, every note carries `applied: false` with `pendingReason: "phase-in-progress"`, no receipt or expiry record appends, and no note lands mid-phase | F-3, DM-3, DEC-5 |
| AC-F3-4 | **Given** multiple due notes with mixed kinds and priorities, **when** `steer read` runs at a boundary-open read, **then** **every** due note lands — the landing is a record write and is **not** capped by the payload's display bound: all outcome records (receipts) are written for all due notes, and nothing is dropped, deferred, or rolled to a later boundary — and the payload **lists** at most 20 notes, in shared-rank order, with any overflow counted in `omitted` (and `truncated` set), so a batch larger than the display cap is fully applied while partially listed (DM-8); the payload-level `data.applied` is `true` | F-3, F-5, DM-3, DM-5, DM-8 |
| AC-F3-5 | **Given** a read that has just landed notes, **when** `steer read` runs again immediately, **then** it lands nothing new, appends no record, returns the empty batch with `data.applied == false`, and exits `0` — the read point is idempotent in effect | F-3, NFR-5 |

**Batched owner asks**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** open owner-audience questions in the delivered ledger when `steer read` runs, **then** the read payload carries `asks[]` projected through the delivered open-question view — `id`, delivered closed type, `ref` (delivered string or bare `null`), `lane`, bounded text, `askedAt`, measured `age` — each with the delivered drawn-default join (`drawnDefault` per PDR-0003 or bare `null`, `defaultState` `none`/`pending`/`applied`) under the delivered ranking, bounded and ordered exactly as delivered; **given** a coordinator-audience question, **then** it is not an ask; and **when** writes are audited, **then** the asks join performs no ledger write and adds no second ranking or default mechanism (ticket AC-1: asks batched with drawn defaults and measured aging) | F-4, DM-6, DEC-11, NG-8 |

**Completion**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** a landed note, **when** `steer complete <id> --ref <artifact>` runs, **then** exactly one completion record appends carrying the artifact reference and timestamp, the answer derives `lifecycle: "completed"` at exit `0`, and the list view shows the row under landed with `completedWith` set; **when** the same id completes again, **then** the run is refused with `input.value.rejected` at exit `1` — the first authoritative completion is never replaced | F-6, DM-2, NFR-5 |
| AC-F6-2 | **Given** a note that was never landed, an expired note, or `steer complete` without `--ref`, **when** it runs, **then** the run is refused with `input.value.rejected` at exit `1` before any write — completion without a read receipt or without a proving artifact is never recorded | F-6, F-9 |

**No-secrets guard**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** a note text, `--ref`, or a derived origin value containing a registered secret value, **when** `steer send` runs, **then** the run is refused with `steer.credential-value-rejected` at exit `1`, consequence `not_landed`, zero persisted bytes, before any other validation writes; and **given** a value that was never registered, **then** no pattern-scan refusal exists (the TDR-0012 boundary holds) | F-7, DM-7 |

**Mounting**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** the delivered entrypoint, **when** root `--help` runs, **then** `steer` appears as a registered family among 23 families (the delivered base is 22, `ceremony` being the 22nd; five delivered suites pin the base list), and `steer --help` answers at exit `0` with the command's summary, usage, options, examples, exit codes, and see-also pointer | F-8, DEC-9 |
| AC-F8-2 | **Given** the delivered help-coverage check, **when** it runs, **then** the steer reference page exists, mentions `--help` and `--version`, and the coverage inventory carries the steer row — the check reports zero failures | F-8 |

**Classified outcomes, purity, determinism, and registration**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F9-1 | **Given** `steer complete` targeting an id that is not a steering record of the repository, **when** it runs, **then** the run is refused with `steer.unknown-id` at exit `1`, consequence `not_landed`; `steer.unknown-id` is scoped to `complete` only — a positional passed to `read` is a grammar violation (AC-F9-3 grammar row, `fallback.invocation`), because `read` accepts zero arguments | F-9, DM-7 |
| AC-F9-2 | **Given** a steering store that cannot be read, cannot be written, or an append whose post-append verification fails, **when** any steer subcommand runs, **then** the command is withheld with `steer.queue-unavailable` at exit `2`, nothing is reported landed or completed, and no partial result renders | F-9, NFR-5 |
| AC-F9-3 | **Given** any steer invocation, **when** it completes, **then** its envelope is the five-field `delivery.result.v1` shape with all new keys under `data`, its exit is `0`, `1`, or `2` exactly as the §8.3 exit projection declares, and every refused run names its classified identity | F-9, NFR-1 |
| AC-F9-4 | **Given** the delivered error-table sync check, its structural mirror, the dispatch-taxonomy and verify-suite-map suites, and the carrier, **when** the steer identities land, **then** (a) the closed two-segment allowlist contains exactly the three steer codes and no other `steer.*` code (**56 → 59**, exact declaration, no pattern or family widening); (b) every count-pinning site enumerated in **Appendix D** moves to its declared post-change value in the same commit as the three rows (**140 → 143** entries; **139 → 142** delivered; **56 → 59** allowlist; **140 → 143** documented; `BASELINE_ROWS.length + 106` → **+109**); (c) the repo-wide no-leftover scan over the named files, with its legacy-token list extended by the pre-change values (140, 139, 56, +106), finds no leftover pin; and (d) the classifier, sync check, structural mirror, and carrier agree on the same post-change numbers, and a near-miss two-segment `steer.*` code is rejected by the check rather than accepted by family matching | F-9, DM-7, DEC-8, C-7, C-16 |
| AC-F10-1 | **Given** any steer invocation, **when** its behaviour is inspected, **then** it makes no LLM call, no network request, no tracker or provider read or write, starts no timer, daemon, or listener, opens no control socket, performs no session spawn/attach/resume/steer operation, and renders no hardcoded product or binary name | F-10, NFR-6, DEC-12 |
| AC-F10-2 | **Given** unchanged facts, **when** any steer subcommand runs twice, **then** the human text and machine `data` are byte-identical (envelope timing and run id aside), every array follows its declared order, and record ids are unique per store | F-10, NFR-2, NFR-3 |
| AC-F10-3 | **Given** a produced result at the declared caps, **when** bounds are measured, **then** the 65 536-byte `data` cap, the 32-line / 6 144-byte human cap, the 160-char text and ref caps, the `30d` ttl cap and its declared `<positive-integer><unit>` grammar (`s\|m\|h\|d`), the 8-row group caps, and the 20-note read-payload cap hold — the read-payload cap being a display bound only, with every landing receipted regardless of it (AC-F3-4) — and every display drop sets `truncated` and increments `omitted` following the declared byte-guard order (`asks` → `notes`, tail-first by rank), with the boundary block never dropped | F-10, DM-8, NFR-4 |
| AC-NFR9-1 | **Given** the delivering change, **when** quality gates run before the PR opens, **then** `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green | NFR-9 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds the §17 acceptance criteria to a checkable outcome, names its verification method, and is proven in the delivering plan phase that owns the capability. This specification claims no passing evidence and no acceptance; the conditions define what must be proven.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | Filing appends one shared-schema record with drawn defaults and the derived origin block; unbound checkouts record the bare `null` origin change | F-1, F-2, AC-F1-1, AC-F2-1, DEC-6 | Filing contract tests green (defaults matrix, origin derivation, unbound cell) | Filing phase |
| DoD-2 | Value violations, grammar violations (including a positional on `read`), and the `complete`-only unknown-id case refuse with the declared identities and zero persisted bytes | F-1, F-6, F-9, AC-F1-2, AC-F6-2, AC-F9-1 | Refusal matrix tests green, ordered before any state read | Filing phase |
| DoD-3 | The record schema is shared: no owner-specific field, shared closed vocabularies declared once, filing subset declared as a restriction | F-2, AC-F2-1, DEC-2 | Schema conformance and non-owner-specificity tests green | Record-schema phase |
| DoD-4 | The boundary read lands due notes with complete receipts (SC-M2-S5-01 green) and one outcome record per landed note | F-3, AC-F3-1, DM-3 | Scenario seed SC-M2-S5-01 green; receipt-shape contract test green | Boundary-delivery phase |
| DoD-5 | TTL expiry is a classified outcome (SC-M2-S5-02 green): exit `0`, `data.applied == false`, `data.expiry.reason == "ttl-elapsed"`, expiry recorded, course unchanged | F-3, AC-F3-2, DEC-7 | Scenario seed SC-M2-S5-02 green; expiry-record test green | Boundary-delivery phase |
| DoD-6 | A boundary-closed read declines without applying or recording; the batch lands once in rank order; the read is idempotent in effect | F-3, F-5, AC-F3-3, AC-F3-4, AC-F3-5, DEC-5 | Mid-phase decline, batch-order, and idempotency tests green | Boundary-delivery phase |
| DoD-7 | The read batches open owner asks with the delivered drawn-default join and measured age, excluding coordinator questions, with no ledger write | F-4, AC-F4-1, DM-6 | Asks-batch composition tests green; write-discipline audit green | Asks-batch phase |
| DoD-8 | Aging and rank are measured and derived: injected-clock ages, shared rank order, contiguous ranks, deterministic repeats | F-5, AC-F5-1, NFR-2, NFR-7 | Rank/aging property tests green with a fixed clock | Aging/rank phase |
| DoD-9 | The list view renders queued/landed/expired side by side with receipts, expiry reasons, and completion markers, within caps and counted omissions | F-5, AC-F5-2, DM-4, DEC-1 | List projection tests green including the side-by-side fixture | Queue-view phase |
| DoD-10 | Completion requires a landed note and an artifact ref; first completion authoritative; duplicates and artifact-less completions refused | F-6, AC-F6-1, AC-F6-2 | Completion lifecycle tests green | Completion phase |
| DoD-11 | Registered secret values are refused on every content path; no pattern layer; zero persisted bytes on refusal | F-7, AC-F7-1, TDR-0012 | Credential-guard tests green over text, ref, and origin paths | Guard phase |
| DoD-12 | Mounting is complete: 23rd prompt-required family (22 delivered today), unconditional composition, root and family help, reference page serving the coverage check, inventory row, moved family-count assertions | F-8, AC-F8-1, AC-F8-2, DEC-9 | Root `--help` snapshot test green; help-coverage check green | Mounting phase |
| DoD-13 | Error identities are registered under the `steer` domain kind and documented in-boundary, with the exact allowlist widening (56 → 59), every Appendix D site moved in the same commit, the extended no-leftover scan green, and four-way agreement | F-9, DM-7, AC-F9-4, DEC-8, C-7, C-16 | All Appendix D sites moved; no-leftover scan green; classifier/sync/mirror/carrier agreement green; near-miss rejection green | Classification phase |
| DoD-14 | Store failures are fail-closed: `steer.queue-unavailable` at exit `2`, nothing reported landed, fenced appends verified | F-9, NFR-5, AC-F9-2 | Store-failure and unverified-append tests green | Boundary-delivery phase |
| DoD-15 | Purity, determinism, bounds, and write discipline hold across the family | F-10, NFR-2..NFR-6, AC-F10-1..AC-F10-3 | Purity, determinism, bounds, and write-audit tests green | Every phase's gate |
| DoD-16 | Full acceptance coverage: every §17 criterion green, with no uncovered criterion and no orphan test | §17, NFR-1..NFR-10 | Test-plan coverage matrix all Covered; execution evidence in pm-notes | Per-phase, roll-up at the final delivery phase |
| DoD-17 | The full gate battery is green at the delivered HEAD | NFR-9, AC-NFR9-1 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` recorded in pm-notes `notes:` | Final delivery phase / quality_gates |
| DoD-18 | PR posture: a pull request targets `main-tools` and is left open for human review with required CI green on the pushed HEAD; merge and owner acceptance are not claimed | §18 | PR record attached to the change | Lifecycle phase 11 |

A condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery**: the full 11-phase lifecycle on the feature branch created from `main-tools`; the PR targets `main-tools` and stops open for human review. Commits go through the commit primitive with conventional subjects and every body/footer line ≤100 characters; `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens (NFR-9, NFR-10).
- **Ordering inside the change**: the shared record schema and state records land before the boundary read point; the error identities register in the same boundary as their first refusing path (C-7); mounting completes before the gates phase so the coverage check gates the final state.
- **Adoption**: the owner gains the filing surface immediately; the delivery-side value accrues as deliveries invoke the boundary read. No migration, flag, or dual-run exists — the family is additive and inert until invoked.
- **Rollback**: reverting the change removes the family and its record kinds' writers; already-appended records are inert data in the local state scope and require no cleanup.
- **Communication**: the reference page is the operator documentation; the concept and journey documents already describe the operator story this change implements.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no migration. The three steering record kinds are additive in the repository state scope; an empty queue is verified-empty evidence, not an unavailable source (the blockers ledger's posture). No existing state file, record, or store layout changes.

## 20. PRIVACY / COMPLIANCE REVIEW

- **No secrets in messages, ever**: the registered-secret-value refusal covers note text, `--ref`, and derived origin values before any byte persists (F-7, AC-F7-1); the guard reuses the delivered registered-secrets record with no pattern layer (TDR-0012).
- **Local-only content**: steering notes persist only in the repository's local state scope; nothing replicates to a tracker, provider, or network destination (NFR-6).
- **Provenance over content**: records carry origin linkage (change, repo, agent) for audit; no content beyond the bounded note text and artifact reference is stored.
- **Untrusted-input posture**: notes are data, not instructions — no message content can override policy; the read point returns records for the delivery's own judgement (concept principle 3).

## 21. SECURITY REVIEW HIGHLIGHTS

- The no-secrets guard is the change's principal security surface; its boundary is exactly the registered-value match plus nothing else — no token-shape scan (TDR-0012 residual documented).
- The surface declares no session operation and no control socket: it cannot steer, kill, or resume a live session even when asked (NG-4, DEC-12) — the confused-deputy posture of the blockers channel applied to steering.
- Fail-closed persistence: an append that cannot be verified reports failure rather than success, so no receipt claims a landing that did not happen (NFR-5, AC-F9-2).
- Error identities are exact allowlist declarations; no `steer.*` family or pattern widening exists for a near-miss code to slip through (DEC-8, AC-F9-4).

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New family to maintain**: contracts, domain, state, and CLI modules for `steer` follow the delivered layering (ADR-0003); the pure domain carries validation, rank, aging, expiry, and lifecycle derivation with no I/O.
- **Record growth**: steering records accumulate append-only; the read point resolves each note once, so steady-state appends are bounded by owner filing rate. No prune ships; a future compaction story may add one without contract change.
- **Count pins**: the error-table identity counts (143/142/59/143/+109) are pinned in the sites Appendix D enumerates; future identity additions move them the same way.
- **Prompt surface**: the 23rd prompt-required family joins the prompt set; future agent-to-agent consumers extend the same schema and verbs rather than adding a parallel surface.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Steering note | The owner's bounded course-correction message, stored as one shared-schema message record with origin, receipt, and ttl |
| Shared message record | The typed record schema of DM-1 — id, from, to, scope, kind, subject, ref, origin, priority, created, ttl — declared once as contract data, not owner-specific |
| Origin block | The provenance triple `{change, repo, agent}` every message carries; derived at filing, never asked |
| Read point | The declared pull point where queued notes are delivered — for S5, `steer read` at a phase boundary; running work is never interrupted |
| Boundary-open | The phase-state condition under which notes may land: no phase record, or every recorded lifecycle entry completed |
| Landed | A note applied at a boundary-open read; carries its receipt and exactly one applied outcome record |
| Receipt | The non-null triple on a landed note: `origin`, `readReceipt` (timestamp + boundary), and `ttl` — the audit evidence of delivery |
| TTL expiry | The classified non-applied outcome when `now >= created + ttl` at a read: reason `ttl-elapsed`, recorded append-only; the delivery continues its previous course |
| Drawn default | The declared value a filed note carries for a field the owner omitted (kind `request`, priority `normal`, ttl 24 h, ref `null`) |
| Drawn-default join | The delivered PDR-0003 silence default (`drawnDefault`/`defaultState`) the asks batch composes from the delivered open-question view |
| Shared rank | The deterministic derived order — priority class, then oldest created, then id — recomputed at every read, never stored |
| Artifact-ref completion | The completion record attaching the proving artifact to a landed note; completion without an artifact is never recorded |
| Derived lifecycle | The read-time state `queued | landed | expired | completed`, derived from appended records, never a stored flag |
| Fenced append | An append with post-append verification whose failure is reported, never silently accepted |

## 24. APPENDICES

### Appendix A — Planning truth sources

| Source | What it contributed |
|--------|---------------------|
| Ticket GH-298 (M2-S5) | Goal, tasks, the three canonical ACs, dependencies (M0-S10, M1-S11), delivery conventions |
| pm-notes `chg-GH-298-pm-notes.yaml` | State detection, scope cross-check, AC restatement, the board-surfacing boundary call delegated to this spec, delivery conventions |
| `doc/planning/concepts/inter-agent-communication.md` | The typed message record model, read-point delivery semantics, ack→complete workflow with artifact-ref completion, no-secrets rule, untrusted-input posture, tooling-hides-the-format, steer as first shipping vehicle |
| `doc/planning/oss-tooling/milestones/m2/journeys.md` | "Steering a running delivery": queue with origin/receipt/ttl; land at the boundary keeping session/branch/evidence; expiry recorded with course unchanged; side-by-side auditability (step 4 → DEC-1) |
| `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` | SC-M2-S5-01 and SC-M2-S5-02 with their exact assertions |
| `doc/planning/oss-tooling/milestones/m2/contracts.md` | The `phase.state` topic named as steer's advisory contract surface (owning story declares the edge → DEC-5); no steer-specific contract page exists in the pack |
| `doc/spec/features/feature-blockers.md` | The typed-channel prior art: closed vocabularies, audiences, append-only immutable records with derived closure, shared ranking, credential guard (TDR-0012), bounds, exit matrix, `applied`-posture analog |
| `doc/spec/features/feature-board.md` and chg-GH-297-spec.md | The delivered `ASKS` projection (drawnDefault, defaultState, age), the four-section contract steer must not disturb, the error-table registration discipline (DEC-20 precedent), and the spec shape this document follows |
| Delivered result-contract, state-layer, delivery-lifecycle, event-taxonomy, CLI-entrypoint feature specs | Envelope, error-table, record-kind, phase-boundary, and mounting rules any new command family follows |

### Appendix B — Ticket AC decomposition

| Ticket AC | Spec decomposition |
|-----------|--------------------|
| AC-1: owner asks are batched with drawn defaults and measured aging | F-4, DM-6, AC-F4-1 (the boundary read batches the open owner-audience questions with the delivered PDR-0003 join and measured age); batching of notes is F-3/AC-F3-4; measured aging is F-5/AC-F5-1 |
| AC-2: a steering note carries origin, a read receipt, and TTL | F-1/F-3, DM-1/DM-3, AC-F1-1 (origin + ttl at filing), AC-F3-1 (receipt on landing; SC-M2-S5-01), AC-F3-2 (ttl expiry; SC-M2-S5-02) |
| AC-3: the message record schema is shared, not owner-specific | F-2, DM-1, AC-F2-1, DEC-2 |

### Appendix C — Scenario-seed mapping

| Seed | Declared surface path |
|------|----------------------|
| SC-M2-S5-01 (`data.receipt` carries non-null `origin`, `readReceipt`, `ttl` for the landed note) | `steer read` at a boundary-open read: the landed note's `notes[].receipt` block with exactly `origin`, `readReceipt {at, boundary}`, `ttl` (plus `expiresAt`); the single-note fixture asserts the seed's `data.receipt` path against this block (OQ-2) |
| SC-M2-S5-02 (exit `0`, `data.applied == false`, `data.expiry.reason == "ttl-elapsed"`) | `steer read` where the only queued note's ttl has elapsed: payload-level `data.applied` and `data.expiry.reason` per DM-3/DEC-7, the note's own `applied: false` and `expiry` block, and exactly one expiry outcome record appended |

### Appendix D — Error-table count-pinning sites (steer registration)

The current delivered numbers are **140** `ERROR_TABLE` entries, **139** delivered (spend-exclusion) rows, **56** closed two-segment allowlist codes, **2** `board` domain rows, and **140** documented identities, with the sync-suite oracle at `BASELINE_ROWS.length + 106`. The steer change adds exactly three rows (**140 → 143** entries, **139 → 142** delivered, **56 → 59** allowlist, **3** `steer` rows, **140 → 143** documented, **+106 → +109**) and every site below moves in the same commit as the rows, followed by a repo-wide no-leftover scan across the named files for the pre-change values **140**, **139**, **56**, and **+106** (the scan's legacy-token list gains them), with four-way agreement between the classifier, the sync check, its structural mirror, and the carrier:

| # | Site | Pin | Moves to |
|---|------|-----|----------|
| D-1 | `packages/core/src/contracts/error-table.ts` | The three new `steer` rows appended after the board rows, under a GH-298 comment declaring exact allowlist membership | 3 new rows (140 → 143 entries) |
| D-2 | `scripts/checks/error-table-sync.ts` | `RESERVED_TWO_SEGMENT_CODES` set gains exactly the three steer codes with the GH-298 comment | 56 → 59 members |
| D-3 | `tests/structure/error-table.test.ts` | The mirror `RESERVED_TWO_SEGMENT_CODES` set gains the same three codes | 56 → 59 members |
| D-4 | `tests/structure/error-table.test.ts` | `toHaveLength(140)` entry assertions (6 sites: the per-suite entry pins and the four-surfaces agreement) | 143 |
| D-5 | `tests/structure/error-table.test.ts` | Delivered-row (spend-exclusion) assertions `toHaveLength(139)` (2 sites) | 142 |
| D-6 | `tests/structure/error-table.test.ts` | Allowlist-size assertions `toHaveLength(56)` (4 sites) and the allowlist test name pinning "56 members" | 59 |
| D-7 | `tests/structure/error-table.test.ts` | The four-surfaces agreement test name "140 entries / 139 delivered / 56 allowlist / 2 board / 140 documented" | "143 entries / 142 delivered / 59 allowlist / 2 board / 3 steer / 143 documented" |
| D-8 | `tests/structure/error-table.test.ts` | Carrier/doc text pins `toContain("140 identities")` / `toContain("140 machine identities")` / `toContain("the same 140 identities")` (4 sites) | 143 wording |
| D-9 | `tests/structure/error-table.test.ts` | The legacy-token list and no-leftover scan arms (currently 136/135/138/137/53/52 and the +102 arithmetic string) gain the pre-steer values 140, 139, 56, and +106 so the scan stays complete | extended token list |
| D-10 | `tests/structure/dispatch-attempts-taxonomy.test.ts` | Header comment "the registry stays at 139 identities", test name "exactly 140 identities", and `toHaveLength(140)` | 142 / 143 / 143 |
| D-11 | `tests/structure/verify-gates-suite-map-contract.test.ts` | `result.counts.sourceEntries` and `result.counts.documentedRows` at 140 (2 sites) | 143 |
| D-12 | `tests/checks/error-table-sync.test.ts` | The frozen-oracle arithmetic `BASELINE_ROWS.length + 106` at all three sites (length check, failure message, counts assertion) | +109 |
| D-13 | `doc/spec/features/feature-result-contract.md` | The documented-table paragraph: "140 machine identities" (2 mentions), the kind inventory (gains "the three `steer` rows"), and the allowlist paragraph (gains the three steer codes, 56 → 59) | 143 wording, 3 steer rows, 59 codes |

The plan enumerates the exact post-change text for each site; the test plan owns the near-miss rejection case (a two-segment `steer.*` code outside the declared three is rejected) and the four-way agreement case. Any site discovered beyond this list during delivery joins the same commit and this appendix is amended — never silently.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @spec-writer (GH-298, phase 2 specification) | Initial specification |
| 1.1 | 2026-11-16 | @spec-writer (GH-298, specification reopened) | Verification fixes: family-count arithmetic corrected to the delivered base of 22 (`ceremony` is the 22nd) so steer mounts as the 23rd family, delta 22 → 23; `steer.unknown-id` scoped to `complete` with `steer read <id>` declared a `fallback.invocation` grammar refusal; landing-vs-display-cap tension resolved (landing writes uncapped, payload lists ≤ 20 with counted overflow); `--ttl` duration grammar declared (`<positive-integer><unit>`, unit `s\|m\|h\|d`, max `30d`, default `24h`) |

---

## AUTHORING GUIDELINES

- **Sources**: ticket GH-298 (canonical ACs and tasks), the GH-298 pm-notes (state detection, scope cross-check, the delegated board-surfacing call), the inter-agent communication concept (message model, delivery semantics, workflow, steer-as-first-vehicle), the M2 journey and test-scenario seeds, the M2 contracts pack advisory (`phase.state`), and the delivered feature specs for blockers, board, result contract, state layer, and lifecycle. Nothing in this specification is invented beyond those sources plus the repo's delivered conventions; where the sources were silent (payload-level seed reconciliation, drawn filing defaults, verb naming), the choice is recorded as a DEC with rationale.
- **Template**: the repository template (`doc/templates/change-spec-template.md`) defines the structure; the sibling GH-297 specification defines the density and registration discipline expected by the DoR gate.
- **Scope discipline**: the one planning ambiguity — board surfacing (journey step 4 vs the AC set) — is resolved explicitly (DEC-1) rather than silently, per the pm-notes delegation. Everything else in scope traces to a ticket AC, a scenario seed, a journey step, or a delivered convention the family must follow.
- **Testability**: every AC is Given/When/Then, references at least one F-/DM-/NFR- ID, and names its verification path; the two scenario seeds map to declared payload paths (Appendix C) so the test plan inherits them literally.
- **Registration discipline**: the error-table change is declared exactly (three codes, 56 → 59, every count pin enumerated in Appendix D) because the delivered checks assert exact set sizes; an undeclared widening would make the spec contradict the truth it cites (GH-297 OQ-8/9 precedent).
- **Tech neutrality**: the specification declares contracts, vocabularies, bounds, and behaviour; it prescribes no algorithm, data structure, or module-internal design. Component names in §16 follow the repo's package layout convention for planning traceability.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-298)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `milestone` equals the pm-notes `milestone` verbatim ("M2: Ceremonies, measurement, and memory")
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, API- n/a, EVT- n/a, DM-, NFR-, AC-, DEC-, RSK-, OQ-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details beyond the repo's high-level component convention (§16)
- [x] No content duplicated from linked docs; composed surfaces cited, not restated
- [x] Front matter validates per front_matter_rules
