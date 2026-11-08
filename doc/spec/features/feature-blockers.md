---
ados_distribution: internal
id: SPEC-BLOCKERS
status: Current
created: 2026-11-06
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
summary: "The typed blocker and question channel: the closed four-type question vocabulary with one answer channel per type, the `owner` | `coordinator` audience and the delegation policy-as-data confused-deputy guard, the layered credential guard (registered-secret-value refusal on every content path including lane/ref identifiers, the variable-name shape on credential-missing question text, no pattern layer per TDR-0012), the append-only question and answer intent records with derived open/answered closure, the recorded `laneResume` projection (boundary-note, attach-continue, or the resume-prompt-reentry fallback with its prefill cost) conditioned on the adapter resume-injection capability, the deliberate `applied: false` v0 posture, the single shared ranking consumed by the blockers list, the digest `typed-questions` section, and the brief blocker-questions anchor, the bounded deterministic `blockers list`/`answer`/`publish` surface and its exit matrix, and the four-row `blockers` error family."
links:
  related_changes: ["GH-230", "GH-242"]
  related_decisions: ["ADR-0003", "TDR-0012"]
  contracts:
    - "packages/core/src/contracts/blockers.ts"
    - "packages/core/src/contracts/status.ts"
    - "packages/core/src/contracts/brief.ts"
---

# Feature: Typed Blocker and Question Channel

## Overview

The `blockers` command is the typed question channel for blocked delivery lanes. A lane that cannot proceed publishes a question with a closed type, an audience, a lane identifier, and bounded text; the question persists as an append-only record in the local state ledger. Answers are routed by the question's audience through a delegation policy held as contract data, so a coordinator identity cannot answer an owner-audience question unless policy explicitly delegates. Credential values are refused on every content path before any byte lands; a `credential-missing` question carries a variable name and never a value. An accepted answer is itself data: one intent record per question carrying the answering audience, the answer substance, the time, and a recorded `laneResume` projection that names the lane's resume path. Nothing is applied by this channel: the payload declares `applied: false`, no session is spawned, attached, resumed, or steered, and later consumers read the recorded intent.

Open questions rank through one shared pure ordering — priority class, then oldest asked time, then question id — consumed identically by `blockers list`, the status digest's `typed-questions` section, and the brief's `blocker-questions` anchored-action group. Every surface renders the audience and rank per question, caps its output, and declares every omission.

The channel is local-state-only: no tracker read or write, no provider call, no credential resolution, no network, and no child process. The binary name in human output comes from the injected branding configuration.

The surrounding contracts are described in [Status Digest](feature-status-digest.md), [Brief](feature-brief.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Owner-Gate SLA](feature-owner-gate-sla.md), [Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md), and [Branding Seam and Working Name](feature-branding-seam.md). Package placement follows [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); the credential-guard boundary is recorded in [TDR-0012](../../decisions/TDR-0012-blockers-credential-guard-pattern-deferral.md).

## Business Context

### Problem Statement

- **Problem:** A blocker that lives only in session prose has no durable, machine-readable statement of what is blocking a lane, who must answer, and what answers would unblock it. Without audience routing, a coordinator-side identity can silently answer an owner-side question; without a credential guard, a pasted value can persist; and without an answer-as-data record with a resume projection, unblocking requires re-entering a delivery session.
- **Affected Users:** The owner, the coordinator, lifecycle agents that hit a blocking condition mid-phase, and maintainers of the local state ledger and its attention surfaces.
- **Business Impact:** A typed, routed, guarded, ranked question channel turns lane-idle waiting into an answer-and-resume path with a durable audit trail. It keeps owner authority intact through the confused-deputy guard, keeps credential values out of persisted content, and lets the digest and brief surface the most actionable question first without a human polling by hand.

### Goals

- Persist every lane blocker as a validated, immutable question record rather than prose or silence.
- Route every answer by the question's audience and refuse a disallowed answerer with the delegation policy named.
- Refuse credential values on every content path and keep `credential-missing` questions structurally value-free.
- Record an accepted answer as data with an explicit resume projection and an explicit recorded-versus-applied posture.
- Rank open questions once and surface that same order on the list, the digest, and the brief.
- Keep output deterministic, bounded, brand-neutral, read-mostly, and inside the existing state schema, error table, and configuration surface.

## User Experience & Functionality

### Question vocabulary and answer channels

The question type set is closed at four values. Each type admits exactly one answer channel, and the type also derives a ranking priority class.

| Type | Answer channel | Priority class | Content rule |
|---|---|---|---|
| `decision-needed` | `--choice <n>` | 1 | Carries between 1 and 4 ordered options; the answer records the selected option value, never the 1-based index. |
| `spec-ambiguity` | `--text <answer>` | 2 | Bounded free text. |
| `credential-missing` | `--text <answer>` | 1 | The question text must match the declared variable-name shape; the answer carries the variable name and never a value. |
| `external-wait` | `--text <answer>` | 3 | Bounded free text. |

The priority map is contract data: `decision-needed` and `credential-missing` rank class 1, `spec-ambiguity` class 2, `external-wait` class 3. A question type outside the closed set is refused at publish with `blockers.invalid-type`, exit `1`, consequence `not_landed`, before any content, audience, or option validation or state read.

Options are admitted only on `decision-needed`; supplying `--options` on any other type is refused. Options are preserved verbatim, at least one and at most four, each at most 60 characters. A choice answer must be a positive integer index inside the published option range; the recorded substance is the option value at that index. A wrong channel, both channels, neither channel, an out-of-range or non-integer index, an empty answer, an over-cap answer, or an answer to an already-answered question is refused with the existing `input.value.rejected` identity, exit `1`, `not_landed`; the first authoritative answer is never replaced.

### Publishing a question

```
<binary> blockers publish <type> --lane <id> "<question>" [--options a,b] [--audience owner|coordinator]
```

Publish validates in a fixed order: type, audience, non-empty lane, non-empty and bounded question text, then options. `--audience` is validated against the closed `owner` | `coordinator` set and defaults to `coordinator` when absent. The question id is `q-` plus an opaque generated suffix, unique per store. `askedAt` comes from the injected clock. The question record is immutable once appended; its open/answered status is derived at read time from answer presence and is never a stored flag.

The command declares no `--ref` flag, so a CLI-published question records `ref: null`. The record shape and the credential guard admit a work-item ref for compositions that supply one.

### Audience routing and the delegation policy

Every question carries an audience from the closed set `owner` | `coordinator`. The answering audience is resolved from one injected caller-audience fact whose environment variable name is derived from the branding environment prefix plus `CALLER_AUDIENCE`; the value is honoured only when it is exactly `owner` or `coordinator`, and an absent or unrecognized value resolves to `owner`.

Routing consults the delegation policy-as-data map. The shipped map is total over the four audience combinations:

| Question audience | Answering audience | Allowed | Policy label |
|---|---|---|---|
| `owner` | `owner` | yes | `allowed` |
| `owner` | `coordinator` | no | `none` |
| `coordinator` | `coordinator` | yes | `allowed` |
| `coordinator` | `owner` | yes | `allowed` |

A missing row resolves to a declared refusal with policy label `none`; authority is never invented from the runtime. A refused answer returns `blockers.audience-mismatch`, exit `1`, `not_landed`, with a remediation hint naming the question's audience and the consulted policy (`delegation policy: none`). The question stays open and no answer record is applied. The policy validator rejects a duplicate combination, a missing combination, an unknown audience, and an allowed/label mismatch; adding or changing a row is owner-signed policy data.

### Credential guard

The guard has two declared layers, both contract data, both evaluated before any record lands.

- **Layer 1 — every content and identifier path:** question text, option values, free-text answer, and the `lane` and `ref` identifier fields are refused when they contain a registered secret value. The registered-secrets record is the same one the serialization redaction chokepoint consumes at the runtime-aware edge. A refusal returns `blockers.credential-value-rejected`, exit `1`, consequence `not_landed`, zero persisted bytes, and a hint stating that credential questions carry the variable name only and that the value comes from the environment.
- **Layer 2 — `credential-missing` question text:** the text must match the declared variable-name shape (`^[A-Z][A-Z0-9_]*$`, injectable as contract data). Anything beyond a name-shaped reference is refused with the same identity. Layer 2 is path-scoped: the same text on another question type is not refused by shape.

No token-shape pattern scan exists in the channel. The matching boundary is exactly the registered-value match plus the name-shape rule; this is the boundary recorded in [TDR-0012](../../decisions/TDR-0012-blockers-credential-guard-pattern-deferral.md), including its accepted residual for values that were never registered (see Security and Boundaries).

The answer path runs the free-text guard before its state read and re-evaluates the guard over the target question's stored text, options, lane, and ref, so an answer to a question whose stored content now collides with a registered value is refused before any append.

### Answering and the `laneResume` projection

```
<binary> blockers answer <id> [--choice <n>] [--text <answer>]
```

The answer path performs one business read of the verified ledger, resolves the question by id (`blockers.unknown-id`, exit `1`, when absent), guards the stored content and identifiers plus any supplied free text, routes the answering audience, validates the channel against the question's type, computes the resume projection, and appends exactly one answer intent record. Exactly one answer per question id is authoritative.

The `laneResume` projection is computed from an injected harness-adapter capability fact and recorded with the answer; it is never executed.

| Capability fact | Recorded mode | `sessionReentry` | `capabilitySource` | Prefill marker |
|---|---|---|---|---|
| `resumeInjection: true` with `mode: "boundary-note"` or `"attach-continue"` | The declared mode | `false` | `adapter-declared` | Absent |
| `resumeInjection: true` with no mode or an unrecognized mode | `boundary-note` | `false` | `adapter-declared` | Absent |
| `resumeInjection: false`, or the fact absent | `resume-prompt-reentry` | `true` | `capability-absent` | `prefillCost: full-context-reprefill` |

The answer payload and the answer record declare `applied: false`. That field is the explicit recorded-versus-applied boundary: the record is durable data for later consumers, and this channel touches no session. A read of an answer record whose `applied` is not `false` is a torn store, and the state boundary cross-checks the resume mode against `sessionReentry`, `capabilitySource`, and the prefill marker.

The single-line human forms are:

```
<binary> blockers published <id>  type=<type>  audience=<audience>  lane=<lane>
<binary> blockers answered <id>  audience=<audience>  choice "<value>" | text "<text>"  applied=false  laneResume=<mode> (sessionReentry=<bool>, source=<source>)[  prefillCost=full-context-reprefill]
```

### Shared ranking

One pure ranking produces the order for every attention surface.

1. Open questions sort by priority class ascending.
2. Within a class, the oldest parseable `askedAt` sorts first; an unparseable timestamp sorts last.
3. Ties break on question id ascending by Unicode code point.
4. Answered questions never interleave with open ones. They form a resolved group after all open questions, ordered by `askedAt` then id.
5. Ranks are contiguous `1..N` over the fully ranked open set, assigned before any render cap.

The declared pickup predicate is payload-determinable: an open question carrying `rank: 1` and `audience: "coordinator"` at the head of the digest ranking is the coordinator pickup signal. The channel only makes the predicate determinable; it wakes nothing and starts no iteration.

### List surface

```
<binary> blockers list [--open]
```

The default list renders all records: open questions ranked first, then a visibly separate resolved group of answered questions. `--open` restricts the payload to open questions; because that filter is a projection choice rather than a bound drop, filter-excluded answered rows do not contribute to `omitted` or set `truncated`. The machine payload is:

```
{
  schemaVersion: "delivery.blockers.v1",
  questions: [ ...open rows..., ...answered rows... ],
  truncated: boolean,
  omitted: number
}
```

An open row carries `id`, `type`, `audience`, `lane`, `ref`, `question`, `options`, `askedAt`, `age`, `rank`, and `status: "open"`. An answered row carries the same question fields plus `status: "answered"` and `answer: { choice? | text?, answeringAudience, answeredAt }`; it carries no `rank`. `ref` is `null` when unset.

The human render is deterministic, TTY-independent, and ANSI-free:

```
<binary> blockers  open=<n>  answered=<m>
  1. <id>  <type>  audience=<audience>  lane=<lane>  age=<age>  "<question>"  options=<a,b>
answered
  <id>  <type>  audience=<audience>  lane=<lane>  age=<age>  answered-by=<audience>  choice "<value>" | text "<text>"
```

Age renders as `<n>m` under one hour, `<n>h` under two days, `<n>d` thereafter, and a signed millisecond value when negative. A resolved group header appears only when answered rows are rendered. An empty list renders `  no questions`. Omitted rows append `+<n> more questions omitted`. `lane` and `ref` are clamped to 160 characters with a trailing `+` in the rendered list.

### Command grammar and exit matrix

The command is `blockers` with exactly three subcommands. The definition declares `--open`, and the value-taking flags `--lane`, `--options`, `--audience`, `--choice`, `--text`; positionals are capped at three. A missing subcommand, an unknown subcommand, an unexpected positional, an unknown flag, or a missing flag value is refused as `fallback.invocation` with exit `1` before any state read.

| Outcome | Envelope | Exit |
|---|---|---|
| `list` rendered, `publish` appended, or `answer` appended | Success envelope with one `delivery.blockers.v1` `data` payload | `0` |
| `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch` | Error envelope with the exact `blockers` identity | `1` |
| Malformed answer body (wrong channel, invalid index, already answered, empty or over-cap answer) | Error envelope with `input.value.rejected` | `1` |
| Rejected invocation grammar | Error envelope with `fallback.invocation` | `1` |
| State failure while reading or appending | Error envelope with the delivered `state.*` identity | Per the state row: `state.permission.denied` is `1`; `state.store.torn`, `state.store.unknown`, `state.lock.busy`, and the other platform state rows are `2` |

The handler owns no stream writes and chooses no exit code. It returns data or one classified failure; the CLI edge renders the human form or the standard envelope, projects the exit code, and applies the single redaction path. A handler-level grammar refusal uses the reserved `fallback` namespace and resolves through `fallback.invocation`.

### Digest integration

The status digest carries a ninth fixed section, `typed-questions` (title `Typed questions`), after `spend`. The section is state-sourced: one verified read of the blocker ledger per status invocation, exposed as the `blockers` evidence source.

| Condition | Section state | Evidence |
|---|---|---|
| Verified read succeeded, at least one open question | `observed` | `blockers: read`; reason `observed` |
| Verified read succeeded, no open questions (including a verified-empty store) | `observed` | `blockers: observed-empty`; reason `observed-empty` |
| Read failed or the store is torn/unknown | `unknown` | `blockers: failed` with the delivered state code as `failureCode`; reason `state-unreadable` |

`degraded`, `unavailable`, and `not-delivered` never apply to this section: it has one required local read, and an absent store is verified-empty evidence rather than an unavailable source. The section renders open questions only, ranked by the shared ranking, capped at eight; each item carries `id`, `type`, `audience`, `lane`, `ref`, `question`, `options`, `askedAt`, `age`, and `rank`. Counts report the open total as `observed` and `total`, zero unknown, and the omitted count; a truncation appends the `source-truncated` reason. A failed read yields zero counts and an empty `questions` array — never a fabricated question — and it is payload data, not a command failure: `status` still returns a success envelope with exit `0`. The digest `summary` counts nine sections and includes rendered typed questions in its actionable total.

The human digest renders one additional line after the spend line:

```
questions  <state>  <n|?> open[ (<reason>)]
```

`n` is the rendered open-question count and `?` appears whenever the section is not `observed`; a dropped row appends `+N`.

### Brief integration

The brief keeps exactly nine render surfaces: the seven digest sections, including `typed-questions`, plus the two named placeholders `gate-sla-states` and `lane-queue-engine`. The `typed-questions` surface is a digest-section mirror rather than a placeholder: it copies the section's `state`, `counts`, `truncated` flag, and first evidence reason, and it carries a fixed payload title.

The payload's `anchors` array carries three ranked groups in decision-first order: `ready-to-merge`, `blocker-questions`, `owner-gate-ages`. The `blocker-questions` group is a real ranked group mirroring the digest items: its state is the `typed-questions` section state, its items are one action per rendered open question with `identity` equal to the question id, and its evidence is `{ kind: "blocker-question", type, audience, lane, rank }`; its `truncated` and `omitted` values mirror the section. The placeholder catalog holds exactly two entries, `gate-sla-states` (owning story M1-S5) and `lane-queue-engine` (owning story M1-S17), both `not-delivered`.

The human brief renders the three anchors first, then the `gate-sla-states` placeholder line, then the six context surfaces:

```
blocker-questions  <state>  none | <rank>. <id> <type> audience=<audience> lane=<lane>, ...
```

An empty ranked group renders `blocker-questions  <state>  none` and a truncation appends `+N more`.

### Bounds and truncation

| Bound | Value |
|---|---|
| Rendered questions per surface | 8 (`BLOCKERS_MAX_QUESTIONS`, reused from the digest item cap) |
| Question text | 120 characters (`BLOCKER_MAX_QUESTION_CHARS`) |
| Ordered options per question | 1–4 (`BLOCKER_MAX_OPTIONS`) |
| One option value | 60 characters (`BLOCKER_MAX_OPTION_CHARS`) |
| Free-text answer | 160 characters (`BLOCKER_MAX_ANSWER_CHARS`) |
| Serialized machine `data` | 65 536 UTF-8 bytes (`BLOCKERS_MAX_MACHINE_BYTES`) |
| Human render | 32 lines / 6 144 UTF-8 bytes (`BLOCKERS_MAX_HUMAN_LINES`, `BLOCKERS_MAX_HUMAN_BYTES`) |
| Rendered `lane` / `ref` | 160 characters each, clamped with a trailing `+` |

The list renders at most eight rows across open and answered together; open questions keep their ranks before the cap, so a low-priority answered row is dropped before a high-priority open one. With `--open`, only open rows participate: the cap and `omitted` count open-only drops, and answered rows filtered out by the flag are never reported as omitted. The digest and the brief render at most eight open questions and report the omitted count. The machine projection drops trailing rows and increments `omitted` if the assembled payload would exceed its byte cap, setting `truncated`. The human render drops trailing body lines only after the header and marks the exact omitted count; no drop or clamp is silent.

### v0 recorded-versus-applied posture

| Capability | Recorded | Applied by this channel |
|---|---|---|
| Typed question | Yes — validated, guarded, persisted | — |
| Shared ranking on list, digest, brief | Yes — every invocation | — |
| Answer intent with `laneResume` | Yes — validated, routed, guarded, persisted | — |
| Lane resume (no re-entry) | Projection over injected capability facts | No session is touched |
| Lane resume (re-entry fallback) | Recorded with `sessionReentry: true` and the prefill cost | No |
| Coordinator pickup | Predicate determinable from the digest payload | No wake, no iteration |

The v0 production composition supplies no adapter capability fact, so a real published answer records `resume-prompt-reentry` with `prefillCost: full-context-reprefill` and `applied: false`. The `boundary-note` and `attach-continue` modes are exercisable over injected capability facts. The applying actors — the resident daemon (M1-S18), coordinator supervision (M1-S23), and the one-shot `dispatch --resume` path (M1-S9) — consume the recorded intent in later releases.

## Technical Architecture & Codebase Map

### Core components

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/blockers.ts` | The complete channel vocabulary: question types, per-type answer channel, priority map, audiences consumed from the owner-gate seam, default audience, resume modes and capability sources, prefill marker, variable-name pattern, content and render bounds, record kinds and payload schemas, the delegation policy rows, the four error codes, and the record, view, and payload types. Types and `as const` data only. |
| `packages/core/src/domain/blockers.ts` | The pure evaluator: publish and answer validation, the layered credential guard, name-shape check, answering-audience resolution, delegation validation and resolution, the one shared ranking, the pickup predicate, the resume projection, the bounded list/answer/publish projections, and the human renderers. No I/O, clock, randomness, or ambient environment. |
| `packages/core/src/state/blockers.ts` | The two additive record kinds over the injected state port: validated artifact-boundary declaration, verified ledger read with derived closure and fail-closed classification, and fenced appends with post-append coverage verification. |
| `packages/cli/src/commands/blockers.ts` | The `blockers` command definition: the three-subcommand grammar, validation and guard ordering, one read, at most one append, and data-or-classified-failure results with no stream writes or exit literals. |
| `packages/cli/src/edge.ts` | The blockers composition: `createBlockersCommandRuntime` wires the state store, clock, id suffix and fence-token factories, the capability and delegation snapshots, the brand, the registered secrets, and the branding-derived caller-audience environment fact; registration occurs only when a blockers composition is supplied. |
| `packages/cli/src/classify.ts` | Resolves the reserved `fallback` namespace returned by a handler for grammar-level refusals. |
| `packages/core/src/contracts/status.ts` | The ninth section id and title, the `blockers` evidence source, and the typed-question item and read types. |
| `packages/core/src/domain/status.ts` | Derives the bounded `typed-questions` section from the verified read through the shared ranking and renders the human question line. |
| `packages/core/src/contracts/brief.ts` | The nine-id surface order, the two-entry placeholder catalog, the three anchor-group ids, and the `blocker-question` action evidence type. |
| `packages/core/src/domain/brief.ts` | Mirrors the digest section into the `typed-questions` surface and projects the ranked `blocker-questions` anchor. |
| `packages/core/src/contracts/error-table.ts` | The `blockers` domain kind and its four documented rows. |

### Data flow

1. The edge composes the blockers runtime with the state store, the clock, the question-id suffix and fence-token factories, the optional capability and delegation snapshots, the brand, the registered secrets, and the caller-audience fact read from the branding-derived environment variable name.
2. `list` performs one verified read, ranks through the shared ranking, and returns the bounded payload.
3. `publish` validates the type, audience, lane, question, and options, evaluates the guard over the question and identifiers, generates the id and `askedAt`, and appends one question record under one fence with post-append coverage.
4. `answer` guards the supplied free text, reads once, resolves the question, guards the stored content and identifiers, resolves the answering audience, consults the delegation map, validates the channel, projects `laneResume`, and appends one answer record under one fence with post-append coverage.
5. The CLI edge renders the human form when `--json` is absent or the standard envelope when present, redacts registered values, and projects the exit code.
6. A `status` or `brief` invocation reads the blocker ledger once through the status runtime; the digest derives the ninth section and the brief derives the mirrored surface and ranked anchor from the same bytes.

### API and interface contracts

- **`validateBlockerPublish(input, limits?)`** — pure publish validation returning the typed, audience-resolved, bounded question or a `blockers.invalid-type` / `input.value.rejected` failure.
- **`validateBlockerAnswer(question, input, answered, limits?)`** — pure per-type channel, range, emptiness, cap, and already-answered validation; a choice answer resolves to the option value.
- **`evaluateBlockerGuard(request, contract?)`** — the layered guard over question, options, answer text, lane, and ref; returns `{ ok: true }` or the `blockers.credential-value-rejected` verdict with its remediation summary.
- **`isCredentialNameShaped(text, pattern?)`** — the declared name-shape predicate.
- **`resolveAnsweringAudience(fact)` / `callerAudienceVariableName(brand)`** — the exact-value resolver and the branding-derived variable name.
- **`validateBlockerDelegationPolicy(policy)` / `resolveBlockerDelegation(policy, questionAudience, answeringAudience)`** — the map validator and the pure routing decision; a missing row is a declared refusal.
- **`rankBlockerQuestions(questions, answers, nowMs, priorities?)`** — the one shared ranking returning contiguous-ranked open views and the resolved answered group.
- **`isCoordinatorPickup(items)`** — the payload-level pickup predicate.
- **`projectBlockerLaneResume(capability)`** — the recorded resume projection.
- **`buildBlockerListData(...)`, `buildBlockerAnswerData(record)`, `buildBlockerPublishData(record)`** — the bounded machine payloads.
- **`renderBlockersHuman(data, brand)`, `renderBlockerAnswerHuman(data, brand)`, `renderBlockerPublishHuman(data, brand)`** — the only human renderers; they read no source and use the injected binary name.
- **`readBlockerLedger(store)`, `appendBlockerQuestion(store, request)`, `appendBlockerAnswer(store, request)`** — the verified read with derived closure and the fenced, coverage-verified appends.
- **`blockerQuestionRecordKey(id)` / `blockerAnswerRecordKey(questionId)`** — the store-scoped record keys.

The contracts import only sibling shared-contract modules (the owner-gate audience tuple and the digest bounds); the domain imports the shared contracts; the state module imports `#contracts` and composes the shared artifact boundary; the CLI command imports the core root, `./contracts`, and `./state` types at the edge. No new package, subpath, or runtime-API location is introduced.

### Data architecture

| Element | Shape and persistence |
|---|---|
| Question record (EVT-1) | Kind `blocker.question`, payload schema `delivery.blocker.question.v1`: `schemaId`, `id`, `type`, `audience`, `lane`, `ref`, `question`, `options[]`, `askedAt`; append-only and immutable, one record per question id |
| Answer record (EVT-2) | Kind `blocker.answer`, payload schema `delivery.blocker.answer.v1`: `schemaId`, `questionId`, `answeringAudience`, `choice` or `text`, `answeredAt`, `applied: false`, embedded `laneResume`; the first record per question id is authoritative |
| `laneResume` | `mode`, `sessionReentry`, `capabilitySource`, and `prefillCost` only on the fallback; cross-field consistency is validated at read |
| Record keys | `blockers.questions:<id>` and `blockers.answers:<questionId>` under the boundary prefix `blockers.` |
| Closure | Derived at read time from answer presence; never stored on the question |
| Machine payloads | `delivery.blockers.v1` for list, publish, and answer `data`; bounded and deterministic |

Both record kinds are additive inside `delivery.state.v1`. No existing record kind, read, derived document, or schema version changes, and no migration or backfill exists. An absent store is verified-empty evidence; an undeclared kind, payload schema, missing field, or vocabulary value is `state.store.unknown`, while a duplicate question id, a duplicate answer for one question id, a structural violation inside a declared record, an `applied` value other than `false`, or an inconsistent resume projection is `state.store.torn`. Blocker history grows linearly and has no expiry, compaction, or delete surface.

## Security and Boundaries

- **Authority boundary:** the confused-deputy guard is structural for every answer. The answering audience is resolved from an injected fact and routed through the policy-as-data map; a coordinator identity answering an owner-audience question is refused with the policy named, and only an explicit policy row delegates. The handler holds no audience branch and takes its decision only from the injected map and the resolver.
- **Claimed-not-proven identity:** the caller-audience fact is unauthenticated attribution consumed for routing. It is never rendered as proven identity and never persisted as authentication evidence. An absent or unrecognized fact resolves to `owner`, the un-agented human at the terminal. The residual — an agent running outside an identity-bearing shell defaults to owner — is accepted and revisited when the invocation audit ledger lands (M1-S22).
- **Credential non-transit:** layer 1 refuses any registered secret value on the question text, the option values, the free-text answer, and the `lane` and `ref` identifier fields, with zero persisted bytes on refusal; layer 2 makes `credential-missing` question text structurally value-free. The guard reuses the delivered registered-secrets record and adds no secret-read allowlist entry. Content is capped at 120 characters for a question and 160 for an answer.
- **Accepted residual (owner review):** a credential value that was never registered in the environment record can transit a non-`credential-missing` question, an option, or any free-text answer and would persist locally and render on the list, the digest, and the brief. This residual is the boundary recorded in [TDR-0012](../../decisions/TDR-0012-blockers-credential-guard-pattern-deferral.md); acceptance is pending the human owner. The guard carries no token-shape pattern layer. Revisit triggers are agent-authored publishing (delivered by GH-242), the M1-S22 audit-identity review, availability of a shared system-level content policy (the preferred adoption shape), and any transit incident; adoption reuses the existing `blockers.credential-value-rejected` identity.
- **Owner-review flag:** the layer-1 scope extension to the `lane` and `ref` identifier fields is a change-scoped decision flagged for owner review. It uses the same registered-value match, cannot collide with system-generated lane ids or `<PREFIX>-<n>` refs, and is reversible.
- **State integrity:** writes use one single-writer fence and a post-append verified coverage read that requires exactly one new record. Duplicate questions or answers, undeclared kinds or payload schemas, missing fields, malformed payloads, resume-projection inconsistencies, and non-`false` `applied` values fail closed as classified state failures and are never served as truth.
- **Recorded intent, no execution:** the channel spawns no session, attaches nothing, resumes nothing, steers nothing, writes no control socket, and starts no timer or loop. An optional session port may be injected at the edge; the handler never calls it.
- **Read-mostly and offline:** `list`, `status`, and `brief` perform verified reads only; `publish` and `answer` perform at most one fenced append. The channel performs no tracker or provider call, no credential resolution, no network request, no shell, and no child process.
- **Privacy:** records are local, append-only, and content-minimal: typed questions, bounded text, audience, lane, optional ref, timestamps, and the resume projection. No ambient environment dump, tracker title, body, comment, or provider payload enters a record, a payload, or a render. The channel resolves no environment fact other than the branding-derived caller-audience variable; registered secret values arrive as an injected record.
- **Brand neutrality:** no product or binary literal is committed; every human render uses the injected brand binary name, and the caller-audience variable name derives from the brand environment prefix.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Determinism | Identical injected records, clock, brand, caller-audience fact, capability fact, delegation policy, and secrets produce byte-identical machine and human output on every surface; twenty identical runs differ in no byte, and changed facts change the bytes. |
| Read and write cost | One verified blocker-ledger read per list, digest, or brief invocation; one business read plus one fence, one append, and one coverage read per publish or answer; a refused operation appends nothing; zero outbound requests, retries, or pagination. |
| Latency | Pure validation, guard evaluation, ranking, and rendering complete within 50 ms on the reference environment (measured medians: pure path 0.052 ms, guard 0.001 ms, cap-sized render 0.030 ms). |
| Bounds | At most 8 rendered questions per surface; question 120 characters; 1–4 options at 60 characters each; answer 160 characters; machine `data` at most 65 536 UTF-8 bytes; human render at most 32 lines / 6 144 bytes; every drop or clamp marked. |
| Error identity | Exactly four new rows in one new `blockers` domain kind, all user-validation at exit `1`; malformed answer bodies reuse `input.value.rejected`; state faults reuse delivered rows; the documented table, machine table, and fixtures agree in both directions (57 identities). |
| Credential-guard coverage | Layer 1 covers question text, options, free-text answers, `lane`, and `ref`; layer 2 covers `credential-missing` question text; 100% of those paths are guarded before landing, and a refusal persists zero bytes. |
| State integrity | Exactly one authoritative answer per question id; every append is fenced and coverage-verified to increase the record count by exactly one; corrupt, duplicated, or undeclared records are classified, never served. |
| Privacy | Zero secrets, ambient values, tracker content, or raw provider payloads in records, payloads, or renders; hints name the contract without echoing rejected content. |
| Brand neutrality | Zero product or binary literals; every render and environment name derives from the injected brand configuration. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Structure | Contract vocabulary pinned exactly (types, channels, priorities, audiences, policy rows, resume modes, bounds, record kinds and schemas, error codes); pure-domain and state-port import confinement; CLI handler purity and grammar; inventory registration; four-code error-table allowlist | `tests/structure/blockers-contract.test.ts`, `blockers-imports.test.ts`, `blockers-cli-seam.test.ts`, `error-table.test.ts`, `tests/checks/error-table-sync.test.ts` |
| Behaviour — admission and persistence | Publish validation, immutable records, derived closure, durable reopen, torn/wrong-kind/malformed/verified-empty reads, duplicate and coverage verification, types, answer channels, option and content bounds | `tests/behaviour/blockers-publish.test.ts`, `blockers-records.test.ts`, `blockers-record-integrity.test.ts`, `blockers-types.test.ts`, `blockers-answer-channels.test.ts`, `blockers-options.test.ts` |
| Behaviour — guard and routing | Layer-1 refusals on question, option, and answer paths; layer-2 name shape; TDR-0012 negative controls; identifier-field refusals with legitimate identifier controls; audience set, default, invalid value; the pinned cross-audience refusal; policy delegation; identity resolution | `tests/behaviour/blockers-credential.test.ts`, `blockers-credential-shape.test.ts`, `blockers-credential-negative-controls.test.ts`, `blockers-credential-identifiers.test.ts`, `blockers-audience.test.ts`, `blockers-delegation.test.ts`, `blockers-identity.test.ts` |
| Behaviour — answer and attention | Answer-as-data and the `laneResume` matrix, `applied: false`, list payload and text parity, shared ranking equality across list/digest/brief, digest section and degradation, brief mirror and anchor, errors and exits | `tests/behaviour/blockers-lane-resume.test.ts`, `blockers-list.test.ts`, `blockers-ranking.test.ts`, `blockers-shared-ranking.test.ts`, `blockers-digest.test.ts`, `blockers-brief.test.ts`, `blockers-errors.test.ts` |
| Behaviour — quality attributes | Bounds and truncation, determinism, read cost, performance, privacy, non-regression of board/status/brief/queue/verify surfaces | `tests/behaviour/blockers-bounds.test.ts`, `blockers-determinism.test.ts`, `blockers-read-cost.test.ts`, `blockers-performance.test.ts`, `blockers-privacy.test.ts`, `blockers-nonregression.test.ts` |
| Corpus and golden | A committed 15-category corpus with a completeness meta-check, and byte-identical list and answer machine/human goldens | `tests/behaviour/blockers-corpus.test.ts` with `tests/fixtures/blockers/corpus/cases.ts`; `tests/golden/blockers.test.ts` with `tests/fixtures/blockers/golden/**` |
| Contract checks | Error-table sync, secret-read boundary, forbidden literals, exit-code literals, ambient globals, package boundaries, workspace entrypoints | `tests/checks/*.test.ts` and `scripts/checks/*.ts` in the aggregate gate |
| Aggregate | The whole workspace | `pnpm check` |

Every blockers suite runs in process through one injected harness: the command definition is built with the brand, clock, id and fence factories, state store, secrets, caller-audience fact, capability fact, delegation policy, and output streams supplied as data, and `runCli` renders the envelope. The fixed fixture clock is `2026-11-06T12:00:00Z`, and ages are deltas from it. State stores live under per-test temporary roots through the shared state harness; the live tree, the real state directory, the network, the ambient clock, and the ambient environment are never read. The golden fixtures are read-only at test time and are regenerated only by explicit scripts; mutation controls prove that a changed mode, rank, audience, or `applied` value breaks the pinned bytes. Credential refusals assert the exact identity, zero appended bytes, and the secret's absence from streams and records together, each paired with a clean control. The performance suite records its environment and keeps the declared 50 ms bound.

## Operational & Support

### Configuration

The channel adds no configuration key. Question types, answer channels, priorities, audiences, the delegation map, the variable-name shape, content and render bounds, and the resume-mode vocabulary are contract data. The delegation map is owner-signed policy data and the capability fact is injected at composition. The channel resolves one environment variable itself: the caller-audience variable, named as the branding environment prefix plus `CALLER_AUDIENCE`, consumed as a routing fact only; registered secret values arrive as an injected record at the edge. The `blockers` command declares the flags in its grammar table and no others beyond the global `--json` switch.

### Observability

The envelope's `runId` and `timing` identify each invocation. The machine payload is the observability surface: every rendered question carries its type, audience, lane, age, and rank; the answer payload carries the answering audience, the substance, `applied`, and the full `laneResume` projection; the digest section carries its evidence source, outcome, failure code, counts, and truncation. The persisted question and answer records are the durable audit trail of what blocked a lane, who answered, and which resume path was projected. No telemetry exporter, event sink, alert channel, or background process is added.

### Cost and read cost

One `blockers list`, `status`, or `brief` invocation performs one verified blocker-ledger read; `status` and `brief` add it to their existing read set and perform no extra network request. A `publish` or `answer` performs one business read, one fence, one append, and one coverage read. The evaluator is linear over the capped record set. There is no retry loop, pagination crawl, daemon, or new runtime dependency.

### Maintenance

- Changing a question type, channel, priority, bound, or resume mode is a contract-data edit plus validator, tests, fixtures, and documentation.
- Adding or changing a delegation row is an owner-signed policy-data change; the four-row totality validator and the contract test move together.
- Adding a surface consumes the existing shared ranking; a second comparator is never introduced.
- The `blockers` error family stays closed at four rows; a further failure class requires a named consumer and a reviewed change. Malformed answer bodies continue to reuse `input.value.rejected`.
- The applying actors (M1-S18, M1-S23, M1-S9) consume the recorded records without redefining their shapes or forking the ranking; the lifecycle prompts (GH-242) publish and answer through this channel today.
- The caller-audience fact is reconciled into the audit-identity convention when M1-S22 lands; that is a naming review, not a behavior change.

## Dependencies & Risks

- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for the append-only ledger, validated artifact boundaries, verified reads and verified-empty evidence, fences, and torn/unknown classification that carry both record kinds.
- **Depends on** the owner-gate SLA ([feature-owner-gate-sla.md](feature-owner-gate-sla.md)) for the `owner` | `coordinator` audience dimension, the policy-as-data and deterministic rank-key precedents, and the bounded-truncation discipline.
- **Depends on** the status digest ([feature-status-digest.md](feature-status-digest.md)) for the fixed-section vocabulary, the five-value section state, the closed reason set, the counts and bounds model, and the section-failures-are-payload-data rule the ninth section follows.
- **Depends on** the brief ([feature-brief.md](feature-brief.md)) for the nine-surface totality, the closed placeholder catalog, and the anchored-action model the mirrored surface and ranked group extend.
- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, the `blockers` domain kind and its four rows, the `{0, 1, 2}` projection, and the registered-secrets record layer 1 consumes.
- **Depends on** the branding seam ([feature-branding-seam.md](feature-branding-seam.md)) for the injected binary name and the environment-prefix naming discipline.
- **Depends on** lane contracts ([feature-watchdog-lane-contracts.md](feature-watchdog-lane-contracts.md)) for the lane vocabulary behind `--lane`; lane-registry existence is not verified here.
- **Feeds** the resident dispatch daemon (M1-S18), coordinator supervision (M1-S23), the one-shot `dispatch --resume` path (M1-S9), and the lifecycle prompts (GH-242), which consume the recorded intents and projections. The lifecycle prompts publish with `blockers publish` and answer with `blockers answer`; the pm-notes `blockers:` collection stays schema-allowed but is not an agent write target.
- **Feeds** session-lifecycle economics (M1-S15), which raises typed questions through this channel on budget exhaustion, and status collector expansion (M1-S10), which builds around the ninth section.
- **Risk — the ranking is forked per surface:** mitigated by one shared pure ranking consumed by the list, the digest section, and the brief anchor, with an equality test over identical facts.
- **Risk — an unregistered credential value transits the channel:** accepted residual under TDR-0012, bounded by content caps, the local-first posture, layer 2 on the highest-temptation type, and the named revisit triggers; no channel-local pattern layer exists.
- **Risk — the answering identity is claimed, not proven:** accepted residual; the guard is process discipline plus durable evidence, revisited at the M1-S22 audit-identity reconciliation.
- **Risk — the digest and brief edits ripple into existing consumers:** the closed-set evolution moves section order, surface set, placeholder catalog, anchors, bounds, corpus, goldens, and documentation together; every other command stays byte-stable.
- **Risk — the v0 posture is misread:** `applied: false` and the recorded-versus-applied table are pinned in the payload, the record, the render, fixtures, and goldens; the recorded resume mode is never an executed resume.
- **Risk — brand literals leak:** every render uses the injected binary name and the forbidden-literal gate covers the new modules and this spec.
- **Risk — a question waits on a mechanism that does not exist:** the surfacing bound is structural because every invocation reads the store; the daemon interval later preserves the same bound, and the pickup predicate is declarative only.

## Glossary & References

| Term | Definition |
|---|---|
| Typed question | A durable, validated blocker record with a closed type, audience, lane, and bounded content; the channel's unit of work. |
| Question type | One of `decision-needed`, `spec-ambiguity`, `credential-missing`, `external-wait`; the type fixes the answer channel and the priority class. |
| Audience | The routing field on every question: `owner` or `coordinator`. |
| Confused-deputy guard | The routing refusal that stops a cross-audience answer with the delegation policy named unless policy-as-data delegates. |
| Delegation policy | The closed, owner-signed map of question audience and answering audience to allowed or refused. |
| Credential guard | The two-layer refusal of credential values: registered-value match on every content and identifier path, plus the name shape on `credential-missing` question text. |
| Variable-name shape | The declared name pattern a `credential-missing` question text must match. |
| Answer intent record | The durable answer data: question id, answering audience, substance, time, `applied: false`, and the recorded `laneResume`. |
| `laneResume` | The recorded resume projection: `boundary-note` or `attach-continue` without re-entry when the adapter declares injection; `resume-prompt-reentry` with `sessionReentry: true` and the prefill cost otherwise. |
| Resume-injection capability | The harness adapter's declared ability to inject an answer into a live session, consumed as an injected fact. |
| Prefill cost | The declared full-context re-prefill marker carried only on the re-entry fallback. |
| `applied` | The explicit application posture on an answer: `false` while no applying actor consumes the record. |
| Pickup predicate | The payload-determinable signal that a rank-1 open question is addressed to the coordinator. |
| Collection cycle | The interval between ranked-surface reads: per invocation in v0, later a daemon interval that preserves the same surfacing bound. |
| Resolved group | The answered questions rendered after all open questions on the list, in age then id order. |

See also: [Status Digest](feature-status-digest.md), [Brief](feature-brief.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Owner-Gate SLA](feature-owner-gate-sla.md), [Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md), [Branding Seam and Working Name](feature-branding-seam.md), [TDR-0012](../../decisions/TDR-0012-blockers-credential-guard-pattern-deferral.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), the [command registry](../../planning/oss-tooling/cli-command-registry.md), and the [repository glossary](../../overview/glossary.md).

**Change record:** `doc/changes/2026-11/2026-11-06--GH-230--typed-blockers/`.
