---
ados_distribution: internal
id: SPEC-CAPSULE
status: Current
created: 2026-11-07
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The change capsule: the existing change folder as a self-contained memory episode, an append-only delivery.capsule.event.v1 events.jsonl stream with a closed eleven-kind/four-writer vocabulary, deterministic per-capsule sequences and event keys, per-capsule append locking, torn-tail refusal, the first-event `capsule.opened` rule, and a terminal capsule.closed; the phase, commit, and verify producers with non-gating disclosure; the one-file-per-candidate `<id>.yaml` candidates/ layout, the candidate schema, capture bar, five evidence-link shapes, deterministic dedup and contradiction predicate; the closed promotion routing table with exactly one decision per candidate, confined lessons/tacit home writes, and sanctioned handoffs; and closeout's read-only validation, pre-contract backfill, review-verdict ingestion, per-candidate promotion decisions, and terminal close."
links:
  related_changes: ["GH-240"]
  contracts:
    - "packages/core/src/contracts/capsule.ts"
    - "packages/core/src/domain/capsule.ts"
    - "packages/core/src/domain/capsule-candidates.ts"
    - "packages/adapters/src/file/capsule.ts"
    - "packages/adapters/src/file/change-folder.ts"
    - "packages/adapters/src/file/memory-promotion.ts"
    - "packages/cli/src/commands/phase.ts"
    - "packages/cli/src/commands/commit.ts"
    - "packages/cli/src/commands/verify-gates.ts"
    - "packages/core/src/domain/closeout.ts"
---

# Feature: Change Capsule

> **Role of this Document:** Source of truth for the change-capsule feature. It describes the delivered capsule artifact, event contract, producers, candidate and promotion model, and closeout-side lifecycle. Requirements live in the GH-240 change artifacts; this document describes current behavior.

## 1. Overview

A change capsule is the existing change folder treated as a memory episode. It adds two artifacts in place: `events.jsonl`, an append-only stream of LF-terminated `delivery.capsule.event.v1` records, and `candidates/`, a directory of one memory-promotion candidate per YAML file. No archive tree, relocation, or second state file exists.

The stream has one writer per event kind. `phase` appends phase transitions, `commit` appends landed commits, `verify` appends gate outcomes, and closeout ingests review verdicts and appends its own closeout and capsule-lifecycle events. Every append is deduplicated by a deterministic event key, serialized under a per-capsule append lock, validated against the whole file before it writes, and refused when the capsule is damaged or capped. Capsule appends are non-gating: a failed append is disclosed beside the command's unchanged primary outcome.

Closeout is the consolidation ceremony. It validates the capsule read-only in both plan and apply modes, completes a pre-contract change folder with `capsule.opened` and `capsule.backfill-gap`, ingests readable review verdicts, records exactly one promotion decision per candidate through the capture bar, evidence link, dedup, contradiction, and routing rules, applies accepted lessons and tacit fragments to their canonical home, records sanctioned handoffs for the other promoted classes, and appends exactly one terminal `capsule.closed` event.

The capsule stream and the state-layer telemetry stream are separate. Capsule events are file-based episode evidence; `harness.telemetry` statistics live only in the state-layer ledger and are never copied into a capsule. The state ledger gains no capsule record kind and no schema-version bump.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** A merged change loses its own story across four durable surfaces (phase transitions, commit telemetry, gate verification, and review artifacts). Reconstructing the episode requires re-querying state. Memory promotion is prose convention: nothing executes the capture bar, evidence link, dedup, routing, or decision recording at the change boundary.
- **Affected Users:** Delivery agents and coordinators closing a change; the `@doc-syncer` and `@decision-advisor` roles that receive handoffs; the `consolidate-memory` curator; later retro, ceremony, and retrieval consumers.
- **Business Impact:** Without a capsule, phase-spanning evidence is lost, promotion is unaccountable, and preparation phases cannot safely run concurrently because a shared write surface would collide. A self-contained capsule with recorded decisions makes retrospection mechanical, promotion auditable, and preparation conflict-free.

### 2.2 Goals & Success Metrics

- **Primary goal:** Every merged change leaves a closed capsule with append-only events and exactly one promotion decision per candidate.
- **KPIs:** 100% of capsules carry an opening event before a close; 0 candidates promoted without a capture-bar basis or evidence link; 0 duplicate events or promotion decisions on a re-run; 0 cross-change writes during phases 1–10; 1 terminal `capsule.closed` per capsule; 0 telemetry records in the capsule.

## 3. User Experience & Functionality

### 3.1 Capabilities

#### Capsule location

The capsule is the change folder resolved by the one established convention: iterate `YYYY-MM` month directories in ascending name order, then the folders inside each month in ascending name order, and select the first folder whose name contains the exact token `--<workItemRef>--`. Resolution is read-only. It never creates a month directory, a change folder, an `events.jsonl`, or a `candidates/` directory. An invalid ref, an absent changes directory, or no matching folder is `capsule.folder-absent`; more than one matching folder in the same month is `capsule.folder-ambiguous`. Resolution is shared with the plan-artifact and PM-notes locators.

#### Event envelope

One capsule event line is exactly one JSON object with these nine keys and no others:

| Key | Contract |
|---|---|
| `schemaId` | Exactly `delivery.capsule.event.v1`. |
| `sequence` | Per-capsule integer, starting at `1` and equal to the 1-based line number. |
| `eventKey` | Non-empty deterministic identity of the logical event; unique within the capsule. |
| `workItemRef` | The capsule's work-item ref. |
| `runId` | The producing run identity. |
| `kind` | One of the eleven closed event kinds. |
| `writer` | One of the four closed writer identities. |
| `occurredAt` | The injected-clock timestamp string supplied by the producer. |
| `payload` | A bounded mapping whose key set is declared per kind. |

Lines are LF-terminated. CRLF framing is invalid. No line may follow `capsule.closed`. A file whose final line is not LF-terminated is a torn tail and is refused, never repaired or truncated. In every non-empty capsule the first event is `capsule.opened`; a first event of any other kind is invalid (`capsule.invalid-vocabulary`), and a pre-contract capsule is completed by appending `capsule.opened` before any later event. Event kinds and writers are closed:

**Event kinds (11):** `capsule.opened`, `phase.transition`, `commit.landed`, `gate.outcome`, `review.verdict`, `closeout.step`, `capsule.promotion`, `capsule.retro-coverage`, `capsule.compaction-checkpoint`, `capsule.backfill-gap`, `capsule.closed`.

**Writers (4):** `phase`, `commit`, `verify`, `closeout`.

Per-kind payload key sets are declared once. Missing required keys and undeclared keys are both invalid.

| Kind | Required payload keys | Optional payload keys |
|---|---|---|
| `capsule.opened` | `contractVersion`, `workItemRef` | — |
| `phase.transition` | `phaseId`, `operation`, `outcome` | `commitIntent`, `commitSha` |
| `commit.landed` | `commitSha` | `parentSha`, `messageSource`, `changeRef` |
| `gate.outcome` | `gateSet`, `headSha`, `gates` | — |
| `review.verdict` | `iteration`, `verdict` | `artifact` |
| `closeout.step` | `stepId`, `outcome` | `detail`, `filePath`, `lineHash`, `markerKind`, `workItemRef` |
| `capsule.promotion` | `id`, `class`, `decision` | `mode`, `home`, `reason`, `supersedes` |
| `capsule.retro-coverage` | `level`, `state` | `runId` |
| `capsule.compaction-checkpoint` | `sessions`, `sessionCount`, `workingStateFlushed`, `eventLogFlushed`, `unresolvedQuestions`, `lastVerifiedCommit` | `sessionTruncation`, `gap` |
| `capsule.backfill-gap` | `state` | `detail` |
| `capsule.closed` | `decisionCounts`, `eventCount`, `digest` | — |

For a `closeout.step` diff hit, `lineHash` is the lowercase SHA-256 content hash of the trimmed added line, not a line number; `filePath`, `markerKind`, and `workItemRef` complete the hit identity.

#### Bounds

| Constant | Value | Meaning |
|---|---|---|
| `CAPSULE_MAX_EVENTS` | `2_000` | Maximum events in one capsule. |
| `CAPSULE_MAX_BYTES` | `2 MiB` | Maximum total `events.jsonl` bytes. |
| `CAPSULE_MAX_EVENT_PAYLOAD_BYTES` | `4 KiB` | Maximum serialized payload bytes per event. |
| `CAPSULE_MAX_CANDIDATES` | `100` | Maximum candidate files. |
| `CAPSULE_MAX_CANDIDATE_BYTES` | `8 KiB` | Maximum bytes per candidate file. |
| `CAPSULE_MAX_INDEX_LINES` | `200` | Memory index line budget for home writes. |
| `CAPSULE_MAX_SESSIONS` | `64` | Compaction-checkpoint session identity cap. |
| `CAPSULE_CONTRACT_VERSION` | `delivery.capsule.v1` | Contract version carried by `capsule.opened`. |
| `CAPSULE_LOCK_MAX_ATTEMPTS` | `8` | Append-lock acquisition attempts. |
| `CAPSULE_LOCK_RETRY_MS` | `25` | Delay between append-lock attempts. |

A breach refuses the append or the close with a classified disclosure naming the cap and the refused or omitted count. The capsule is never silently truncated.

#### Append discipline and locking

An append resolves the capsule, validates the writer, kind, payload key set, and payload byte cap, then acquires a per-capsule exclusive lock at `events.jsonl.lock` using exclusive file creation with bounded retry. A lock that cannot be acquired within the declared attempts is `state.lock.busy` with `retryable: true` and a detail naming the capsule lock.

Under the lock the whole file is re-read and validated before any byte is written. A damaged file refuses the append with its classified refusal code and zero bytes written. If the capsule is empty and the requested kind is not `capsule.opened`, the runtime first appends the opening event with the requesting writer. A duplicate `eventKey` is a successful no-op with `appended: false` and `reason: "duplicate"`. A close on an already-closed capsule is a no-op with `reason: "already-closed"`. The declared event, byte, and payload caps are checked for the pending lines before the single append. There is no truncate, repair, reorder, compaction, or delete API.

#### Producers

Producers write only the event kinds they own, only into the capsule of the change they are executing.

- **`phase`** appends one `phase.transition` event when a phase completion or reopen lands. The payload carries `phaseId`, the operation (`complete` or `reopen`), `outcome: "landed"`, the commit intent (`atomic` or `record-only`), and the commit SHA when present. The event key is derived from the change ref, phase id, operation, and the commit SHA when present; when no commit SHA exists, the persisted phase-record timestamp is the deterministic `transitionId` discriminator. Two distinct no-commit transitions of one phase therefore produce distinct events, while re-running the same landed transition (same `transitionId`) appends nothing.
- **`commit`** appends one `commit.landed` event per landed commit. The payload carries the commit SHA, the parent SHA when known, the message source, and the change ref. The event key is the commit SHA. A landed commit without a SHA cannot be keyed and is disclosed as `capsule.commit-sha-absent` with no append.
- **`verify gates`** appends one `gate.outcome` event after the gate-verification state append for a full battery evaluation. The payload carries the gate-set identity (`<schemaVersion>:<id,id,...>`), the head SHA, and one bounded `{gateId, verdict, reason}` entry per evaluated gate. The event key is derived from the gate-set identity and head SHA.

Each producer returns a bounded disclosure `{appended, eventKey, code?, retryable?, detail?}` when the capsule port is present. An append failure or a thrown append becomes that disclosure; the command's primary outcome and its durable state record are unchanged. `verify gates` carries the disclosure on both its success data and its classified failure envelope. A producer never writes another change's capsule.

#### Candidates

Each candidate is one YAML file under `candidates/`, named `<id>.yaml`, where the file stem exactly equals the candidate `id` and the id matches the stable slug shape `^[a-z0-9][a-z0-9-]{2,63}$`. A non-`.yaml` file or a file whose stem differs from its id is a candidate file failure: `closeout.capsule-invalid` in apply and `would-refuse` in plan, with zero home writes. A candidate file is a mapping with exactly these required keys and optional keys:

| Field | Contract |
|---|---|
| `id` | Required; unique; stable slug; no path separator or `..`. |
| `class` | Required; one of `fact`, `decision`, `lesson`, `tacit`, `preference`, `workflow`, `norm`, `fleet`. |
| `scope` | Required; one of `change`, `component`, `repo`, `fleet`. |
| `statement` | Required; non-empty. |
| `evidence` | Required in the model; one of the five evidence-link shapes below, or empty to be rejected `evidence-missing`. |
| `basis` | Required in the model; one of the five capture-bar bases below, or empty to be rejected `capture-bar-unmet`. |
| `source` | Required; non-empty. |
| `trust` | Required; one of `T0`–`T5`. |
| `status` | Required; one of `candidate`, `authoritative`, `superseded`. |
| `created_by` | Required; non-empty. |
| `created` | Required; non-empty; the record year is read from its leading four digits. |
| `rationale` | Optional free text carried into the promoted record body. |
| `applies_when` | Optional; carried into the promoted record. |
| `supersedes` | Optional record-id list. |
| `contradicts` | Optional record-id list. |
| `hint` | Optional promotion hint; not acted on by the evaluator. |

A required-field or closed-vocabulary violation — including a malformed id, an out-of-set `class`, `scope`, `status`, or `trust`, a non-list `supersedes`/`contradicts`, an undeclared key, or an evidence value that is non-empty but outside the five shapes — is a candidate schema failure and therefore `closeout.capsule-invalid`, not a candidate-level rejection. A missing or empty `basis` is rejected `capture-bar-unmet`; a missing or empty `evidence` is rejected `evidence-missing`.

**Capture-bar bases (5):** `repeat-occurrence`, `review-catch`, `human-correction`, `verified-outcome`, `repeated-workflow`.

**Evidence-link shapes (5):** `review-verdict:<ref>`, `ci-verdict:<ref>`, `human-correction:<ref>`, `merged-pr:<ref>`, `test:<ref>`. `<ref>` must be non-empty.

#### Promotion decision

The evaluator processes candidate files in sorted file order and records exactly one decision per candidate: `promoted` or `rejected` with a reason from the closed set. It performs no similarity scoring, embedding, or model judgment. Before the capsule closes, every candidate must carry exactly one durable `capsule.promotion` event; a candidate with zero decisions or with more than one decision is `closeout.capsule-invalid` in apply mode (`would-refuse` in plan mode) and no promotion write lands for that run. Steps run in this order:

1. Validate the candidate schema. A failure makes the capsule invalid.
2. Skip a candidate that already has exactly one durable promotion decision, so a re-run appends nothing; a candidate with more than one decision is rejected before evaluation as `closeout.capsule-invalid`.
3. Reject an empty `basis` as `capture-bar-unmet`.
4. Reject an empty `evidence` as `evidence-missing`.
5. If the candidate id is itself a record id (`lesson-YYYY-NNN` or `tacit-YYYY-NNN`) and a memory record with that id exists, byte-equivalent statement is `satisfied` with a `home-write` promotion to the existing path; a different statement is rejected `duplicate:<existing-id>`.
6. Check `supersedes` and `contradicts` targets first: a path-shaped or unknown target is rejected `supersedes-unknown`.
7. A `contradicts` target that is not also named in `supersedes` is rejected `contradiction-requires-supersession`.
8. Exact normalized-statement equality against existing memory records or an earlier accepted candidate is rejected `duplicate:<existing-id>` (or `duplicate:<candidate-id>` for equality with an earlier candidate).
9. `preference` is rejected `home-not-implemented`; `fleet` is rejected `owner-approval-required`.
10. `fact`, `decision`, `norm`, and `workflow` are promoted as sanctioned handoffs.
11. `lesson` and `tacit` are promoted as home writes unless the memory index would exceed its line budget, which is rejected `index-budget-exceeded`.

Statement normalization for dedup is trim, lower-case under the `en-US` locale, and collapse internal whitespace runs to one space. No fuzzy matching participates.

**Rejection reasons (8):** `capture-bar-unmet`, `evidence-missing`, `duplicate:<existing-id>`, `contradiction-requires-supersession`, `supersedes-unknown`, `home-not-implemented`, `owner-approval-required`, `index-budget-exceeded`.

#### Promotion routing and home writes

| Class | Action | Home |
|---|---|---|
| `lesson` | home write | `.ai/memory/lessons/` |
| `tacit` | home write | `.ai/memory/tacit/` |
| `fact` | sanctioned handoff proposal | `doc/spec/**` |
| `decision` | sanctioned handoff proposal | `doc/decisions/**` |
| `norm` | sanctioned handoff proposal | `AGENTS.md` kernel, through the normal change process |
| `workflow` | sanctioned handoff proposal | command, skill, or playbook, through the normal change process |
| `preference` | rejected | `home-not-implemented` |
| `fleet` | rejected | `owner-approval-required` |

A home write is one record file plus one memory-index row. The record id is the candidate id when it is already a record id, otherwise the monotonic next free `lesson-YYYY-NNN` or `tacit-YYYY-NNN` for the candidate's year. The file path is `<class>s/<record-id>-<slug>.md`; the content carries the documented frontmatter with `status: "candidate"`, the statement, evidence, source, created_by, created, supersedes, and optional applies_when, plus the rationale body. The index row is `| \`<relative-path>\` | <statement, whitespace-collapsed and truncated to 120 characters> |`; it is appended to the injected memory root's `README.md` only when that exact row is absent. A declared `supersedes` list marks each named existing lesson/tacit record's status as `superseded`.

Home writes stay under the injected memory root. The candidate id/record name is validated against the slug shape before any write, and the resolved target is checked against the realpath of the memory root. A resolved escape is `closeout.step.capsule.failed` with zero writes; plan mode renders the capsule step `would-refuse`. A pre-existing target file with byte-identical content is a no-op; differing content is a conflict that refuses the capsule step with `closeout.capsule-invalid` and zero overwrite. No closeout run pushes, writes a remote, or rewrites history.

#### Compaction checkpoint key

The `capsule.compaction-checkpoint` event carries bounded session identities or a counted truncation, the session count, the working-state and event-log flushed flags, the unresolved-question count, the last verified commit, and the declared harness-compaction gap. Its event key is derived from the sorted session-id set plus the last verified commit: an identical session set and commit is a duplicate no-op, while a changed session set or commit is a distinct checkpoint event.

### 3.2 User Flows

**Capsule across phases 1–10.** Planning agents author the spec, plan, test plan, and PM notes in the change folder. `phase complete` appends a `phase.transition` event beside its state record; `commit` appends a `commit.landed` event; `verify gates` appends a `gate.outcome` event. Review artifacts stay plain files until closeout. A producer append failure is disclosed and does not change the command outcome. No command touches another change's capsule.

**Closeout validation and close.** `closeout <ref> --apply` resolves the folder and runs the full read-only pre-flight in both modes: `events.jsonl` parsing (including the first-event rule), candidate count/size caps, `<id>.yaml` naming, candidate schema, exactly one promotion decision per candidate, and promotion path confinement. The pre-flight completes before any provider write, git mutation, or state append; an invalid capsule renders `would-refuse` in plan mode and returns `closeout.capsule-invalid` in apply mode with zero effects. A folder with no events is completed with `capsule.opened` and `capsule.backfill-gap`. Readable review verdicts are ingested; candidates are evaluated and routed; one `capsule.promotion` event is appended per decision; before close the capsule verifies that every candidate has exactly one decision, and one terminal `capsule.closed` event completes it. The applied payload reports the closed state, event count, and per-candidate decision projection.

**Re-run.** A re-run re-reads the same capsule. Existing event keys are no-op appends, candidates with a durable decision are skipped, a closed capsule reports `already-closed`, and the outcome converges without a duplicate event, record file, or index row.

### 3.3 Edge Cases & Error Handling

- An absent capsule folder is a classified condition; resolution never creates it.
- A torn tail, CRLF framing, malformed JSON, non-contiguous sequence, duplicate event key, invalid kind/writer/payload, an undeclared payload key, a payload over 4 KiB, a first event other than `capsule.opened`, or a line after `capsule.closed` refuses the read or append.
- A busy append lock is the retryable `state.lock.busy`; it is never reported as capsule damage.
- A cap breach refuses with the cap and the refused/omitted count; the file is left unchanged.
- A candidate file that is not named `<id>.yaml`, whose stem differs from its id, that does not parse, or that does not satisfy the schema makes the capsule invalid and performs no promotion write.
- A candidate with zero or multiple promotion decisions makes the capsule invalid before the terminal close and performs no promotion write.
- An invalid capsule is refused in the read-only pre-flight before any provider write, git mutation, or state append, so it produces zero effects.
- A review artifact without readable `iteration:` and `status:` lines is `review-verdict-unreadable` residue, not capsule damage.
- A missing expected event, cross-checked against the durable phase, commit, and gate-verification records, is `capsule-event-gap` residue, not capsule damage.
- A re-run of a landed phase/commit/gate evaluation with the same identity appends nothing.

## 4. Technical Architecture & Codebase Map

### 4.1 High-Level Design

The contract tier declares the envelope, closed vocabularies, caps, payload field sets, candidate model, residue kinds, and marker data as types and `as const` data. The pure domain tier parses and validates event text, serializes events, derives event keys and the close digest, ingests review artifacts, computes event gaps, and evaluates candidates and promotion decisions deterministically. The file adapter owns change-folder resolution, the append-only capsule runtime with locking and caps, candidate/review reads, memory facts, and confined home writes. The CLI command layer wires the producer disclosures into `phase`, `commit`, and `verify gates`, and the closeout engine owns the capsule step, pre-flight, backfill, promotion, and terminal close. The edge composes the runtime over injected filesystem, clock, lock, and memory-root facts.

### 4.2 Core Components & Directory Structure

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/capsule.ts` | Envelope keys, eleven event kinds, four writers, per-kind payload field sets, caps, candidate classes/scopes/statuses/trust, capture-bar bases, evidence prefixes, rejection reasons, residue kinds, marker vocabulary, and the capsule/candidate/promotion/residue types. Types and `as const` data only. |
| `packages/core/src/domain/capsule.ts` | `parseCapsuleEvents`, `serializeCapsuleEvent`, `payloadFieldViolations`, `canonicalCapsuleJson`, `capsuleDigest`, `deriveCapsuleEventKey`, `capsulePhaseEventKey`, `capsuleGateEventKey`, `ingestReviewArtifacts`, `capsuleEventGaps`, `capsulePromotionCounts`, and `capsuleDisclosureOf`. |
| `packages/core/src/domain/capsule-candidates.ts` | `validateCandidate`, `candidateFileViolations`, `normalizeCandidateStatement`, `evaluateCandidates`, record-id allocation, record content and index-row rendering, and the declared rejection-reason check. |
| `packages/adapters/src/file/change-folder.ts` | The one read-only month-scan change-folder resolver. |
| `packages/adapters/src/file/capsule.ts` | `createCapsuleFileRuntime`, `nodeCapsuleFileSystemFacts`: read, append with lock/dedup/caps, terminal close, candidate and review reads, and the non-`.yaml` file refusal. |
| `packages/adapters/src/file/memory-promotion.ts` | `readMemoryFacts`, `applyPromotionWrite`, `checkPromotionConfinement`: confined, atomic, content-idempotent home writes and index rows. |
| `packages/cli/src/commands/phase.ts` | The `phase.transition` append point and its non-gating disclosure. |
| `packages/cli/src/commands/commit.ts` | The `commit.landed` append point and its non-gating disclosure. |
| `packages/cli/src/commands/verify-gates.ts` | The `gate.outcome` append point and its non-gating disclosure. |
| `packages/cli/src/edge.ts` | `createCapsuleProducerPort`, the capsule runtime composition, the memory-root promotion runtime, expected-event derivation, and the closeout plan facts. |
| `packages/core/src/domain/closeout.ts` | The `capsule` step, read-only pre-flight, pre-contract backfill, review ingestion, promotion execution, cross-check residue, terminal close, and the applied `capsule` output. |

### 4.3 Key Classes & Functions

```ts
resolveChangeFolder({ changeRef, changesDirectory, fs }): CapsuleLocation
createCapsuleFileRuntime({ changesDirectory, fs, nowIso, lock, rules }): CapsuleFileRuntime
parseCapsuleEvents(text): CapsuleReadResult
serializeCapsuleEvent(event): string
payloadFieldViolations(kind, payload): string[]
deriveCapsuleEventKey(parts): string
capsuleDigest(events): string
ingestReviewArtifacts(artifacts): CapsuleReviewIngestion
capsuleEventGaps(events, expected): CloseoutExpectedCapsuleEvent[]
validateCandidate(value): { ok: true, candidate } | { ok: false, detail }
candidateFileViolations(documents): readonly CandidateFileViolation[]
evaluateCandidates({ documents, memory, decided }): CapsuleCandidateEvaluation
readMemoryFacts(memoryRoot, fs?): CapsuleMemoryFacts
applyPromotionWrite(memoryRoot, write, fs?): PromotionWriteResult
checkPromotionConfinement(memoryRoot, write): PromotionWriteResult
createCapsuleProducerPort({ changesDirectory, fs?, nowIso, runId? }): CapsuleProducerPort
```

### 4.4 Data Architecture

`events.jsonl` is the append-only episode ledger inside the change folder. Each line is one schema-versioned event. The close digest is lowercase SHA-256 hex over the canonical JSON (sorted keys, no insignificant whitespace) of the pre-close event payloads; the close event itself is excluded. `candidates/` holds one `<id>.yaml` candidate per file. The capsule introduces no state-store record kind, no state schema-version change, no migration, and no derived document. The capsule is never compacted, relocated, or purged by this feature.

The applied closeout payload carries `capsule: {closed, events, candidates[]}`. Each candidate projection is exactly `{id, decision, home?, reason?}`. The durable `capsule.promotion` payload carries `{id, class, decision, mode?, home?, reason?, supersedes?}` with `mode`/`home` present only for a promotion and `reason` only for a rejection.

### 4.5 API & Interface Contracts

- **`CapsuleProducerPort.append(request)`** — the non-gating producer surface consumed by `phase`, `commit`, and `verify gates`; returns `CapsuleAppendResult`.
- **`CapsuleFileRuntime`** — `resolve`, `read`, `append`, `close`, `ensureCandidates`, `readCandidates`, `listReviewArtifacts`, `readCandidateDocuments`. `close` is idempotent and terminal.
- **`CloseoutPromotionRuntime`** — injected candidate documents, memory facts, a confined write function, and a resolve-only preflight used by plan mode.
- **`CloseoutExpectedCapsuleEvent`** — `{kind, eventKey, identity}` derived from `phase.transition`, `commit.telemetry`, and `merge.gate-verification` state records for the cross-check.
- **`CapsuleRules`** — the pure parse, serialize, payload-field, and event-key functions injected into the file runtime so the adapter imports contracts only.

## 5. Non-Functional Requirements

### 5.1 Security & Privacy

- **Append-only integrity.** One writer at a time per capsule, LF framing, whole-file validation before append, event-key dedup, terminal close, cap refusal, and torn-tail refusal prevent silent corruption and history rewriting. No truncation or repair path exists.
- **Writer ownership.** Only the command that owns an event kind appends it. No agent free-text write exists, and no command writes another change's capsule during phases 1–10.
- **Promotion boundary.** Home writes are limited to `lessons/` and `tacit/` under the injected memory root. `fact`, `decision`, `norm`, and `workflow` are handoffs; `preference` and `fleet` are rejected. Paths are slug-validated and realpath-confined. Closeout never pushes or rewrites history.
- **Privacy.** Events, candidates, decisions, and the digest carry refs, SHAs, ids, counts, paths, verdicts, and bounded statements only. No comment body, title, transcript, diff, prompt, tool output, credential, or environment value enters a capsule.
- **Telemetry separation.** The capsule carries no harness statistics, and no capsule event is written to `harness.telemetry`.

### 5.2 Performance & Scalability

- Validation and append are linear over the bounded capsule (at most 2,000 events, 2 MiB, 4 KiB payload).
- Candidate evaluation is one deterministic pass over at most 100 bounded candidates.
- The reference-fixture capsule validation budget is 2 s; measured delivery evidence is well below it. No daemon, background process, or network call participates.

### 5.3 Localization & Accessibility

No localization or accessibility surface is added. Event and candidate content is machine-readable ASCII-shaped data with bounded free text.

## 6. Quality Assurance Strategy

### 6.1 Testing Approach

| Level | Location | Scope |
|---|---|---|
| Structure | `tests/structure/capsule-contract.test.ts`, `capsule-imports.test.ts`, `content-inventory.test.ts`; `tests/checks/capsule-cli-parity.test.ts`, `capsule-ci-parity.test.ts` | Location resolution, envelope/vocabulary equality, contract-only imports, CLI/CI parity, and inventory coverage. |
| Behaviour | `tests/behaviour/capsule-{append,lock,reader,bounds,commit-producer,phase-producer,verify-producer,producer-nongating}.test.ts` | Append/dedup/refusal, lock contention, torn-tail and cap handling, each producer, deterministic phase/reopen keys, and non-gating disclosure. |
| Closeout behaviour | `tests/behaviour/closeout-capsule-{validation,close,backfill,review-ingest,plan,schema,dedup,decisions,supersession,payload,gap,idempotency,promotion,routing,naming}.test.ts` | Pre-flight (first event, naming, schema, decision completeness, confinement) before any effect, pre-contract backfill, review ingestion, candidate matrix, promotion routing and confinement, cross-check residue, terminal close, and re-run convergence. |
| Conformance | `tests/conformance/capsule-events.test.ts`; `packages/testkit/src/conformance/capsule.ts` | Capsule event conformance across injected runtimes. |
| Checks | `tests/checks/capsule-{bounds,determinism,latency,mutants,privacy}.test.ts` | Capsule bounds, byte-identical determinism and convergence, latency budgets, named mutants, and the no-content canary. |
| Types | `tests/types/capsule.type-test.ts` | Capsule and candidate type shapes through `typecheck`. |

### 6.2 Test Data & Scenarios

Capsule fixtures live under `tests/fixtures/capsule/`: a temporary change tree, an in-memory and node filesystem runtime, a producer harness, a promotion harness, and named mutants. Scenarios cover valid/pre-contract/torn/duplicate-key/post-close capsules, cap boundaries, lock contention, every producer and its failure disclosure, the full candidate matrix (bar, evidence, dedup, contradiction, supersession, routing, index budget, path escape), a re-run with no duplicate writes, and the privacy canary.

## 7. Operational & Support

### 7.1 Configuration

The capsule adds no configuration key. `phase`, `commit`, `verify gates`, and closeout receive the changes directory through their existing injected edge options. Closeout's promotion runtime receives the memory root as an injected fact; home writes never derive a path from configuration.

### 7.2 Observability

`events.jsonl` is the durable episode audit trail: one event per phase transition, landed commit, full gate evaluation, review verdict, closeout step, promotion decision, retro-coverage fact, compaction checkpoint, and capsule lifecycle transition. Closeout output reports the capsule's closed state, event count, and one bounded decision projection per candidate. Producer disclosures name `appended`, `eventKey`, a classified code, retryability, and a bounded detail; they never alter the primary outcome.

### 7.3 Cost & Infrastructure

The capsule adds no runtime dependency, daemon, scheduled job, or network call. It is local files inside the change folder. Home writes are local files under the memory root. Storage grows append-only per change; no compaction or deletion surface exists.

## 8. Dependencies & Risks

- **Depends on** the result contract ([Result Contract and Error Table](feature-result-contract.md)) for the classified error identities and the `attention` outcome used by closeout.
- **Depends on** the state layer ([State Layer](feature-state-layer.md)) for the durable phase, commit, and gate-verification records used by the closeout cross-check; the capsule itself is not a state record.
- **Depends on** the phase and commit primitives ([pm-notes lint and phase transitions](feature-pm-notes-lint-and-phase-transitions.md), [Commit Primitive](feature-commit-primitive.md)) and verify gates ([Verify Gates](feature-verify-gates.md)) for the producer append points.
- **Depends on** the closeout transaction ([Closeout Transaction](feature-closeout.md)) for validation, ingestion, promotion, and terminal close.
- **Consumed by** the memory lifecycle and `consolidate-memory` for the decisions and promoted records; later retro, ceremony, and retrieval surfaces read the capsule instead of re-querying transient sources.
- **Risk — concurrent appends corrupt the stream:** mitigated by the per-capsule lock, whole-file validation, LF framing, and torn-tail refusal.
- **Risk — promotion pollutes memory:** mitigated by the capture bar, mandatory evidence link, exact-statement dedup, explicit supersession, confined home writes, and idempotent decisions.
- **Risk — a cap blocks a long change:** mitigated by declared caps, a classified refusal naming the cap and count, and tunable contract data; no silent truncation exists.

## 9. Glossary & References

| Term | Definition |
|---|---|
| Change capsule | The change folder as a memory episode: existing artifacts plus append-only `events.jsonl` and `candidates/`. |
| Capsule event | One LF-terminated `delivery.capsule.event.v1` line. |
| Event key | The deterministic identity of one logical event; a duplicate key is a no-op append. |
| Pre-contract capsule | A change folder with no capsule events; closeout creates the stream and records `capsule.backfill-gap`. |
| Candidate | One YAML file under `candidates/` proposing a memory item. |
| Capture bar | The promotion gate: repeated occurrence, review catch, human correction, verified outcome, or repeated successful workflow. |
| Evidence link | The mandatory reference in one of the five declared shapes. |
| Promotion decision | Exactly one `promoted` or `rejected` verdict per candidate. |
| Home write | A promotion applied by writing one canonical record file and one index row. |
| Sanctioned handoff | A promotion recorded as a proposal to a single home without editing that home. |
| Terminal close | The one `capsule.closed` event; no writer appends after it. |
| Two streams | The capsule event stream and the state-layer telemetry stream; two owners, no duplication. |

See also: [Closeout Transaction](feature-closeout.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Harness Adapters](feature-harness-adapters.md), [pm-notes lint and phase transitions](feature-pm-notes-lint-and-phase-transitions.md), [Commit Primitive](feature-commit-primitive.md), [Verify Gates](feature-verify-gates.md), [Retro Evidence Pipeline](feature-retro-pipeline.md), [Session Database Administration](feature-session-database-admin.md), [Merge and Verify Deploy](feature-merge-verify-deploy.md), and the [repository glossary](../../overview/glossary.md).

**Change record:** `doc/changes/2026-11/2026-11-07--GH-240--capsule-closeout/`.
