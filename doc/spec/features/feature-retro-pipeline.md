---
ados_distribution: internal
id: SPEC-RETRO-PIPELINE
status: Current
created: 2026-11-06
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The retro evidence pipeline: the `retro collect` and `retro report` command family over an independent append-only evidence sidecar outside the delivery state store, a distinct HMAC-SHA-256 keyed chain with its own store-managed key artifact, collector-assigned trace ids and claimed collector identity, one collector fence, verified reads that flag tamper, the two-level shape-crash guard, five pipeline-truth checks, the explicit no-target collect success, the validated retro registry with three record kinds and levels R1-R6, the periodic memory-audit trigger home, the bounded library-only export bundle, doctor state-store visibility, deterministic zero-model-call render paths, the read-only closeout coverage consumer, and four retro error identities."
links:
  related_changes: ["GH-232", "GH-240"]
  related_decisions: ["TDR-0009", "ADR-0003", "TDR-0004", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/retro.ts"
    - "packages/core/src/contracts/state.ts"
    - "packages/core/src/contracts/audit.ts"
    - "packages/core/src/contracts/error-table.ts"
---

# Feature: Retro Evidence Pipeline

## Overview

The retro evidence pipeline turns on-demand retrospectives into a mechanical fold over collector-truth evidence. Its command surface is exactly `retro collect [--level <name>]` and `retro report [--level <name>] [--json]`; an omitted level defaults to `change`. Collection reads delivered GET-only sources, appends each collected item to an independent evidence sidecar, runs the pipeline-truth checks, and records the run in the retro registry. Reporting folds verified evidence and registry run records into the level report `{level, findings[], followThrough[], evidenceRefs[]}`. Both paths are deterministic and perform zero model calls.

Evidence lives in an **independent evidence sidecar**: an append-only JSONL artifact family in the state directory, structurally outside the delivery state store's ledger. Only the collector write seam appends; each write — a single-record append or one run-level batch — holds one collector fence across its verified pre-append read, link computation, and write. Every record carries a collector-assigned `ev-` trace id, the level, the source, explicit collection-window bounds, the injected-clock collection timestamp, an optional claimed collector identity, payload references, the payload schema id, and a keyed chain link. There is no update, delete, reorder, or compaction path.

The chain is a distinct keyed construction from the cryptographic keyed-hash family: HMAC-SHA-256 over the sidecar chaining key, the previous link (or the chain anchor), and canonically ordered record content. The 32-byte key is generated once at the runtime edge and persisted as `chain-key.retro.<workspace>.json`, `0600`, with its own bytes separate from the audit ledger's chain key. Every later process reads the same artifact, so verification spans processes without false breaks. A recomputed link that diverges from the stored link is a chain break naming the record position and trace id; altered records are never served as verified findings.

The retro registry is a validated state-store boundary with exactly three additive record kinds: `retro.level` (levels R1-R6 declared, with trigger declarations and implementation status), `retro.run` (one validated record per collection run), and `retro.trigger` (the periodic memory-audit trigger). Levels `session`, `incident`, `window`, `project`, and `fleet` are declared but unimplemented; selecting one refuses classified with a hint naming its owning story. Only `change` (R1) is implemented.

The feature also provides the bounded export engine surface, the doctor state-store visibility of the retro registry, and four `retro` error identities. The result envelope, exit projection, redaction chokepoint, and existing state identities are consumed unchanged. See [Result Contract and Error Table](feature-result-contract.md), [State Layer](feature-state-layer.md), [Command Audit Ledger](feature-audit-ledger.md), and [Doctor](feature-doctor.md).

## Business Context

### Problem Statement

- **Problem:** Without a mechanical evidence plane, a retrospective reasons over memory and claims. A delivery agent can rewrite its own traces without detection, a malformed evidence entry can crash or be silently trusted, and a pipeline with zero activity reads as clean silence. The command audit ledger's bounded read surface has no consumer until this pipeline folds it into learning.
- **Affected Users:** Coordinators and agents running a change closeout retro, auditors reading the evidence trail, operators diagnosing the state directory, and the later ceremony, capsule, and action-registry surfaces that consume retro evidence.
- **Business Impact:** Collector-truth evidence keeps learning honest: alteration is detectable, malformed evidence preserves every valid entry, and vacuous green is refused. The pipeline is the substrate the M1/M2 learning loop and follow-through work build on.

### Goals

- Collect delivered GET-only sources into an independent, append-only, chain-verified evidence sidecar with trace ids and claimed collector identity.
- Detect evidence alteration within the pinned single-user trust model: a break is flagged and altered records are never served as verified.
- Survive a malformed entry without data loss: classify and preserve valid entries; fail closed on store-level damage through existing state identities.
- Distinguish verified-empty from vacuous green through five pipeline-truth checks, while keeping a null retro a success and a no-eligible-target collect an explicit exit-0 success.
- Declare levels R1-R6 in a validated registry and implement `change`.
- Host the periodic memory-audit trigger and record its runs as evidence without reimplementing the audit procedure.
- Keep export bounded and deterministic without adding a command or flag.

## User Experience & Functionality

### Command surface

The command is exactly the locked retro family. The handler owns the subcommand grammar, the `--level` value grammar, and declared-level validation before any runtime call; it performs no stream write and chooses no exit code.

| Invocation | Behavior |
|---|---|
| `retro collect [--level <name>]` | Selects one target, collects its evidence, appends to the sidecar, records the run, and returns a collection summary as `data`. |
| `retro report [--level <name>] [--json]` | Folds verified sidecar evidence and registry runs for the level into the four-key report as `data`. |
| `--level` omitted | Defaults to `change`. |
| Unknown level | Refuses `input.value.rejected` (exit 1) before any I/O. |
| Declared-but-unimplemented level | Refuses `input.value.rejected` (exit 1) before any I/O with `owning story: …`. |
| Missing subcommand, unknown subcommand, unexpected positional, missing `--level` value | Refuses `input.value.rejected` (exit 1). |
| Undeclared flag such as `--ref` | Refuses through the shared parser as `fallback.invocation` (exit 1). |
| `--json` | The global machine-output switch; it adds no retro behavior. |

There is no export verb, no `--ref`, and no windowing flag. Registration is composition-only: the command exists in a program only when its retro composition is supplied.

### Collection

One collection invocation covers one level and one target scope. The collectors are GET-only; collection reads its declared sources without mutating them. The delivered sources are:

| Source | Collection input | Sidecar evidence |
|---|---|---|
| `audit-ledger` | The bounded, filtered `readAuditLedger` surface at limit `1000` over the target window | One record per invocation, plus one record per skipped-ordinal orphan, plus one chain-verdict record carrying the verified flag, record count, breaks, and orphans |
| `phase-transitions` | The target change's phase-transition history | One record per transition |
| `closeout-outcomes` | The target change's closeout outcome history | One record per outcome |
| `commit-telemetry` | The target change's commit telemetry history | One record per telemetry event |
| `pm-notes` | The target change's typed `retro` notes | One record per note |
| `memory-audit` | Recorded through the separate memory-audit seam, not the default collect fold | One record per recorded outcome reference |

For every source, an empty fold appends an explicit `delivery.retro.verified-empty.v1` record naming the check that produced the verdict, so verified-empty is evidence rather than silence. The audit-ledger fold additionally carries skipped-ordinal findings and the chain verdict verbatim; neither is dropped. A consumed audit-read failure classifies through the delivered failure taxonomy: an input failure becomes `input.value.rejected`, a state failure keeps its delivered state code, and a state code outside the delivered state failure vocabulary classifies as `state.store.unknown` with `not_landed` rather than passing through unvalidated.

Target selection implements the `change` level: among changes whose last phase transition is a completed `pr_creation`, the most recent completion not already collected at the level is selected, ordered by completion descending and then change ref ascending. Re-collecting an already-collected scope is not selected again; a caller-supplied target that is not completed refuses `input.value.rejected`. The run id, trace ids, and fence tokens are injected factories.

Each appended record carries the target run id as a `run:<runId>` payload ref. All evidence drafts for the run land in one fenced batch — one verified read and one append — after which the collection appends one validated `retro.run` registry record with `mode: "collect"`, the target scope, counts (`collected`, `malformed`, `skippedSource`), the consumed sources' verdicts, and the pipeline-truth verdict. Evidence is appended before the run record, and the run record is written even when a blocking truth check later fails.

The collector identity is an injected claimed identity: when present it is recorded as `{ kind: "claimed", value }` without trimming and passes the redaction chokepoint. It is attribution only, never verified and never an authorization input. The CLI composition does not infer it from user, host, or session signals.

### Evidence sidecar

The sidecar is the artifact family `retro-evidence.<workspace>.jsonl` in the state directory. Its record shape is:

| Field | Type | Contract |
|---|---|---|
| `schemaId` | string | Constant `delivery.retro.evidence.v1`. |
| `traceId` | string | Collector-assigned, `ev-` prefixed, unique per sidecar. |
| `level` | string | One of the six declared level names. |
| `source` | string | One of the six declared evidence sources. |
| `windowStart`, `windowEnd` | number | Explicit collection-window bounds; `windowStart <= windowEnd`. |
| `collectedAt` | number | Injected-clock epoch-millisecond collection timestamp. |
| `collectorIdentity` | object | Optional `{ kind: "claimed", value: string }`. |
| `payloadRefs` | string array | Payload references, including `run:<runId>`. |
| `payloadSchemaId` | string | A declared evidence payload schema id. |
| `chainValue` | string | The keyed chain link, exactly 64 lowercase hex characters. |

The declared payload schemas are `delivery.retro.evidence.v1`, `delivery.audit.invocation.v1`, and the retro source schemas `delivery.retro.phase-transition.v1`, `delivery.retro.closeout-outcome.v1`, `delivery.retro.commit-telemetry.v1`, `delivery.retro.retro-note.v1`, `delivery.retro.finding.v1`, `delivery.retro.verified-empty.v1`, `delivery.retro.audit-orphan.v1`, `delivery.retro.audit-chain.v1`, `delivery.retro.follow-through.v1`, and `delivery.retro.memory-audit.v1`.

Appends are serialized by one collector fence file, `retro-evidence.<workspace>.lock`. A single-record append acquires the fence, performs a verified read of the current sidecar, refuses a malformed entry or a broken chain, refuses a duplicate trace id, ensures the chaining key exists, computes the link, appends one LF-terminated JSON line, applies `0600`, and releases the fence. `appendBatch` applies the same admission once for a run's drafts: one fence acquisition, one verified read, duplicate checks across both stored and batch trace ids, all link computations in memory, and one append that writes every record line. Collection uses the batch path; single-record append remains for other callers. A busy fence is `state.lock.busy`; a write failure is `state.write.failed`; a permission violation is `state.permission.denied`. Retention is forever.

### Keyed chain and key artifact

Verification walks the sidecar in ledger order from the anchor `retro.chain.anchor.v1`. The canonical content is the record's fields in the fixed order `schemaId`, `traceId`, `level`, `source`, `windowStart`, `windowEnd`, `collectedAt`, `collectorIdentity` (when present), `payloadRefs`, `payloadSchemaId`, with object keys canonically ordered and `chainValue` excluded. The delivered link is `HMAC-SHA-256(key, previousLink || NUL || canonicalContent)`, rendered as 64 lowercase hex characters.

The chaining key is separate store-managed material:

- It is 32 bytes rendered as 64 lowercase hex characters, generated once with runtime-edge cryptographic randomness.
- It is persisted as `chain-key.retro.<workspace>.json` with content `{ "schemaId": "delivery.retro.chain-key.v1", "key": "<64 hex>" }`, created `0600` and verified on open.
- Every later process reads the same artifact; unaltered history verifies continuously.
- A missing key on a non-empty sidecar is `state.keys.missing`; unparsable or wrong-schema content is `state.store.torn`; wrong permission bits are `state.permission.denied`.
- The key never appears in a record, output line, configuration, ambient environment, or lane environment.
- The artifact is distinct in name and bytes from the audit ledger's `chain-key.<workspace>.json`. Key rotation, escrow, and backup/restore are outside the contract.

### Verified reads and tamper evidence

Every sidecar read verifies the chain before returning values. The read result carries the verified records, entry-level malformations, and the chain verdict (`verified`, `records`, `breaks`, `anchor`, `affectedDomain`, `storePath`). Each break names a position and trace id only — never payload bytes, checksum bytes, or key material. Verification continues over the sequence so multiple breaks are reported.

A schema-valid record whose stored link diverges from the recomputed link is a break. A record that parses but fails schema validation is an entry-level malformation; its position is reported and verification continues from its `chainValue` when one is present. A reported explicit-salvage removal is not a break: verification continues over the surviving sequence.

`retro report` fails `retro.evidence.tamper-flagged` (exit 1) on any break, names the first break position and trace id, and preserves the verified records as partial output. The same identity classifies a consumed audit-ledger chain verdict that fails verification: the finding names the audit domain, never the sidecar. Collection appends the collected evidence and the run record before returning that blocking identity, so the evidence trail remains inspectable.

### Shape-crash guards

The guard is a two-level taxonomy:

- **Entry-level malformation.** A record that parses but fails boundary schema validation (missing field, unknown payload schema, undeclared kind, closed-vocabulary violation) is classified in-band. `retro collect` and `retro report` fail `retro.evidence.malformed-entry` (exit 1) naming the first position and bounded counts (`entriesProcessed`, `entriesPreserved`, `firstFlaggedPosition`), while every valid entry remains processed and the stores stay byte-unchanged. Human output renders the preserved trace ids before the diagnostic.
- **Store-level damage.** Framing tears, truncated tails, unparsable lines, unreadable files, missing key material, and permission violations classify through existing state identities: `state.store.torn` and `state.keys.missing` exit 2; `state.permission.denied` keeps its delivered `user-validation` projection and exits 1. Every class is fail-closed; explicit salvage is the only recovery. Delivered state rows are reused unchanged and never re-projected.

The same guards apply to retro-registry reads: a malformed registry entry is classified, never a crash and never a silent zero.

### Reporting

`retro report` performs a verified sidecar read, then a verified registry read, filters run records to the requested level, and folds the most recent run (append order). With no run record for the level, it returns an explicit empty report with exit 0.

The successful `data` is exactly four keys:

| Key | Contract |
|---|---|
| `level` | The requested level name. |
| `findings[]` | Mechanically folded findings, each `{ kind, text, evidenceRefs[] }`; sorted by kind then text. |
| `followThrough[]` | Recorded follow-through entries, each `{ action, verdict, artifactRef? }`; sorted by action. |
| `evidenceRefs[]` | The trace ids of the sidecar records selected for the run, in record order. |

The report shape's schema identity `delivery.retro.report.v1` is a declared contract constant, not an in-data field.

Finding kinds come from the closed vocabulary `retro-note`, `collector-finding`, `truth-check`, `tamper-flag`, `malformed-entry`, and `verified-empty`. The delivered fold emits `retro-note` from pm-notes records and `truth-check` from recorded truth-check findings; a recorded finding whose kind is in the closed vocabulary folds through with its evidence refs. Every folded finding's evidence refs are validated on the production fold against the known sidecar trace-id set, including consumer-supplied refs; a dangling referenced trace id is rendered as a `truth-check` finding and never enters `evidenceRefs`.

Follow-through verdicts are `verified` when the optional artifact verifier accepts the reference, `unverified` when an artifact reference is present but not verified, and `unknown` when no artifact reference exists. Entries fold only when a follow-through reader is injected; they are never invented, and an empty fold is an explicit empty array.

A clean run with an empty evidence fold is a verified-empty success: empty findings and follow-through, populated evidence refs where records exist, and exit 0. Findings are never fabricated to justify a run, and the render path contains zero model calls.

### Pipeline-truth checks

Collection evaluates five mechanical checks:

| Check | Trigger | Outcome | Blocking identity |
|---|---|---|---|
| `C-01` | A skipped audit ordinal (orphan reservation) in the consumed audit read | `finding` naming the ordinal, run id, and position | None; the finding folds into the report. |
| `C-02` | The consumed audit-ledger chain verdict is not verified | `blocked` naming the audit domain | `retro.evidence.tamper-flagged` (exit 1). |
| `C-03` | A referenced evidence trace id does not resolve | `finding` naming the dangling ref | None; the finding folds into the report. |
| `C-04` | A completed change's window has zero audit invocations, or the change has no closeout outcome record | `finding` naming the missing activity | None; the finding folds into the report. For a change that is not completed, the check is `verified-empty`. |
| `C-05` | The collection run executed and produced zero collector records | `blocked` naming the zero-record run | `retro.truth.vacuous-run` (exit 1). |

`C-05` counts collector evidence records only: chain-verdict, verified-empty, and finding records are metadata and do not make a run non-vacuous. Every check has a triggerable negative fixture; disabling a check is observable in the run's truth verdict. A check never fabricates a finding to fill a quiet window.

The run record's `truth` object carries `clean`, the blocking identity or `null`, and every check outcome with its findings and evidence refs. The registry reads it back as first-class run data.

### No-target outcome

When every completed change is already collected at the level, no collection run executes: no collector invocation, no sidecar append, no registry seed, and no run record. The command completes as an explicit success (exit 0) whose `data` is the collection summary with:

- `outcome: "no-target"`;
- `selection: { state: "empty", reason: "every completed change is already collected at this level" }`;
- zero counts and no `runId` or `truth`.

This is distinct from `retro.truth.vacuous-run`, which requires a run that actually executed and produced zero collector records. Human output renders `retro: no eligible <level> target (<reason>)`.

### Level registry

The retro registry is a validated boundary over the public state port with exactly three additive record kinds under the `retro.` key prefix:

| Kind | Payload schema | Identity | Store key | Content |
|---|---|---|---|---|
| `retro.level` | `delivery.retro.level.v1` | `name` | `retro.levels:<name>` | `levelId`, `scopeKind`, trigger declaration, status |
| `retro.run` | `delivery.retro.run.v1` | `runId` | `retro.runs:<runId>` | level, mode, scope, counts, consumed verdicts, truth verdict |
| `retro.trigger` | `delivery.retro.trigger.v1` | `name` | `retro.triggers:<name>` | kind, cadence, owning binding |

The boundary validates kind, payload schema, identity, required fields, and closed vocabularies; a nonconforming write refuses `state.store.unknown` with `not_landed`. Reads classify valid versus verified-empty and report entry-level malformations in band; torn and unknown stores propagate their state identities.

Collection seeds the registry additively and idempotently by identity: the six level records and the `memory-audit` trigger are written only when absent, under one fence. Re-seeding appends nothing already present. Registry appends and seeds acquire fences under the declared `retro-registry` fence namespace.

| Level | Name | Scope kind | Trigger | Status |
|---|---|---|---|---|
| `R1` | `change` | `change` | lifecycle: `change-closeout` | `implemented` |
| `R2` | `session` | `session` | event: `session-end` | `declared` (owning story M2-S3) |
| `R3` | `incident` | `incident` | event: `incident-severity` | `declared` (M2-S3) |
| `R4` | `window` | `window` | schedule: `daily` | `declared` (M2-S3) |
| `R5` | `project` | `project` | lifecycle: `milestone-end` | `declared` (M2-S3) |
| `R6` | `fleet` | `fleet` | schedule: `fleet-cadence` | `declared` (post-M4 fleet retro, unscheduled) |

### Closeout coverage read

Closeout's `retro-coverage-move` step is a read-only consumer of the registry. The production closeout composition reads the validated `retro.run` records at level `change`, determines whether a run's scope is the closed work item, and records the result as one idempotent `capsule.retro-coverage` capsule event with `state: "collected"` (a run exists) or `state: "pending"` (none) and the run id when present; an injected coverage fact overrides the read for tests. It appends no registry record, writes no evidence, and adds no mode value; the registry remains the selection authority for `retro collect`. An unreadable registry is a declared gap in the closeout step (`retro-registry-unavailable`) plus a `retro-coverage-unavailable` residue item, and the rest of closeout proceeds; a validated registry with no matching run is `pending`, not a gap. A re-run appends nothing for the same work item and level. The coverage contract is described in [Closeout Transaction](feature-closeout.md) and [Change Capsule](feature-capsule.md).

### Periodic memory audit

The registry hosts the periodic memory-audit trigger as data: `name: "memory-audit"`, `kind: "schedule"`, `cadence: "weekly"`, `owningBinding: "memory consolidation skill"`. Invocation is on demand in the delivered surface; scheduled invocation belongs to the ceremony runner.

The memory-audit seam appends one `delivery.retro.memory-audit.v1` evidence record per recorded outcome reference, with `source: "memory-audit"`, the trigger identity, the window bounds, the injected-clock timestamp, an optional run id, and the optional claimed identity. The audit procedure itself stays in the memory consolidation skill; the pipeline records that it ran, over what window, and with which evidence refs. There is no new memory-audit command.

### Evidence export

`exportRetroEvidence` is a bounded engine/library surface, not a CLI verb. It requires an explicit destination and an integer limit from `1` to `1000`; a missing destination or invalid limit refuses `input.value.rejected` before any write. It performs a verified sidecar read, refuses malformed or tampered evidence through the same identities, applies the limit, and writes a deterministic bundle:

| Field | Contract |
|---|---|
| `schemaId` | Constant `delivery.retro.export.v1`. |
| `level` | The requested level. |
| `limit` | The applied limit. |
| `truncated` | Whether the population exceeded the limit; in-band. |
| `chain` | The full chain verdict. |
| `records[]` | The selected evidence records with trace ids and watermarks. |

The serialized bundle passes the redaction chokepoint. The export never mutates the sidecar or the registry; a write failure is `state.write.failed`. There is no unbounded export path.

### Doctor visibility

The doctor `state` check reads the retro registry through the same verified boundary (when the retro read is composed) and contributes a `retro-registry` store verdict to the state-stores evidence. A verified-empty registry counts as verified-empty; a valid registry reports `valid`, and because the registry shares the delivery ledger its artifacts are already included in the shared record count rather than summed again; a torn or unknown registry fails the check with its classified reason; a malformed registry entry classifies as `store-unknown`. The check acquires no fence, writes nothing, and never repairs or salvages.

## Technical Architecture & Codebase Map

### Core components

| Path | Component | Responsibility |
|---|---|---|
| `packages/core/src/contracts/retro.ts` | Retro vocabulary | Level declarations, source/finding/truth-check vocabularies, sidecar record shape, chain constants and anchor, artifact names and paths, registry kinds and boundary declaration, report/export schema identities, collect/report/export types, and the data-only ports. Types and `as const` data only. |
| `packages/core/src/contracts/state.ts` | Store vocabulary | The public state port, artifact-boundary declarations, fences, and verified reads the registry consumer composes. |
| `packages/core/src/contracts/audit.ts` | Audit vocabulary | The bounded read query/outcome, chain verdict, and orphan findings the collector consumes. |
| `packages/core/src/contracts/error-table.ts` | Error table | The `retro` domain kind and its four rows. |
| `packages/core/src/state/retro-sidecar.ts` | Sidecar consumer | Collector-fenced append, key creation/read, canonical content, chain verification, entry-malformation classification, and verified reads over the injected sidecar I/O. |
| `packages/core/src/state/retro-registry.ts` | Registry consumer | Boundary-validated reads, level/trigger/run parsing, fenced append, and the additive idempotent seed over the public state port. |
| `packages/core/src/state/driver/runtime-edge.ts` | Runtime edge | The only runtime-API location: the sidecar filesystem/permission primitives, cryptographic `randomHex`, and the HMAC-SHA-256 `keyedHash`. |
| `packages/core/src/domain/retro.ts` | Pipeline engine | Target selection, GET-only collector fold, truth checks, finding/follow-through folds, collect/report runtimes, bounded export, memory-audit recording, and the out-of-seam write refusal. Pure over injected ports. |
| `packages/cli/src/commands/retro.ts` | Command definition | Subcommand and `--level` grammar, declared-level validation, and human render/failure hooks. No stream write and no exit choice. |
| `packages/cli/src/edge.ts` | CLI edge | Composition of the sidecar, registry port, GET-only collectors, change facts from the delivery registry, pm-notes retro notes, clocks and id factories, the command runtime, and `readRetroRegistryState` for doctor. |
| `packages/core/src/domain/doctor.ts`, `packages/core/src/contracts/doctor.ts` | Doctor consumer | The state-check store list and evidence rendering that include the retro registry verdict. |
| `scripts/checks/retro-render-purity.ts` | Invariant | Asserts zero inference adapters, provider clients, model identifiers, network modules, or ambient clock/random reads in the collect/report/export render path files. |
| `scripts/checks/retro-key-containment.ts` | Invariant | Asserts that key-shaped 64-hex literals appear only in the single synthetic allowlisted fixture. |

### Key functions

```ts
function createRetroSidecar(io: RetroSidecarIo): RetroSidecar;
function readRetroRegistry(store: StateStorePort): StateResult<RetroRegistryRead>;
function readRetroLevels(read: RetroRegistryRead): readonly RetroLevelRecord[];
function readRetroTriggers(read: RetroRegistryRead): readonly RetroTriggerRecord[];
function readRetroRuns(read: RetroRegistryRead): readonly RetroRunRecord[];
function recordRetroRun(store: StateStorePort, run: RetroRunRecord, fenceToken: string): StateResult<StateAppendOutcome>;
function seedRetroRegistry(store: StateStorePort, fenceToken: string): StateResult<readonly StateAppendOutcome[]>;

function collectRetro(deps: RetroCollectDeps): RetroCommandOutcome;
function reportRetro(deps: RetroReportDeps): RetroCommandOutcome;
function selectRetroTarget(changes: readonly RetroChangeFacts[], runs: readonly RetroRunRecord[], level: RetroLevelName): RetroChangeFacts | undefined;
function evaluateRetroTruthChecks(input: RetroTruthCheckInput, options?: RetroTruthCheckOptions): RetroTruthVerdict;
function exportRetroEvidence(deps: RetroExportDeps): RetroExportOutcome;
function recordMemoryAuditRun(deps: MemoryAuditDeps, input: MemoryAuditInput): readonly RetroEvidenceRecord[];
function attemptOutOfSeamEvidenceWrite(): { readonly ok: false; readonly error: RetroFailure };
```

### Data architecture

- **Sidecar artifacts.** `retro-evidence.<workspace>.jsonl` is the append-only evidence ledger. `chain-key.retro.<workspace>.json` is the distinct chaining-key artifact. `retro-evidence.<workspace>.lock` is the collector fence. All live directly in the state directory; the sidecar is outside the delivery state store's ledger, header, index, fence, and document family.
- **Registry records.** The three record kinds are wrapped in the state layer's normal record envelope and validated at the retro boundary. They are additive within `delivery.state.v1` with no schema-version bump, no migration, and no new runtime-API location.
- **Run identity.** A run's `scope` is the collected change ref. Evidence records reference the run through `run:<runId>` payload refs; the report selects records by that ref. The registry stores the run's counts, consumed source verdicts, and truth verdict.
- **Chain state.** The chain anchor is `retro.chain.anchor.v1`. The link sequence is the physical line order of the sidecar. The key artifact is shared by every process touching the workspace sidecar.
- **Level data.** Levels are registry data, not code branches: the declared trigger, scope kind, and status travel with the level record. The implemented set is asserted by the command grammar.

### API and interface contracts

- `RetroSidecarPort` exposes `append(draft, { fenceToken? })`, `appendBatch(drafts, { fenceToken? })`, `read({ reportedRemovals? })`, and `verify({ reportedRemovals? })`; it exposes no update, delete, reorder, or compaction member.
- `RetroRegistryPort` exposes `read()`, `runs(read)`, `recordRun(run, fenceToken)`, and `seed(fenceToken)`.
- `RetroCollectorRead` is injected: `readAuditLedger(query)`, `readStateFamilies(changeRef)`, and `readNotes(changeRef)`. The composition supplies the delivered implementations; tests inject deterministic fakes.
- `RetroCommandRuntime` exposes `collect({ level, changeRef? })` and `report({ level })`; the CLI command definition consumes it and returns `data` or a classified `error` with an optional partial string.
- `RetroFailure` is a union of a `retro` code, an existing `state` code, or `input.value.rejected`, always with consequence `not_landed`.

### Invariants and gates

- **Deterministic render paths.** `retro-render-purity.ts` scans `packages/core/src/domain/retro.ts`, `packages/cli/src/commands/retro.ts`, `packages/core/src/state/retro-sidecar.ts`, and `packages/core/src/state/retro-registry.ts`; forbidden imports include inference adapters, provider clients, network modules, and model SDKs; ambient `Date.now`, `Math.random`, and `fetch` are rejected.
- **Key containment.** `retro-key-containment.ts` scans retro-relevant files under source, committed fixtures, and goldens; the only allowed key-shaped literal is `tests/fixtures/retro/key-artifact.json`.
- **Error-table binding.** The four `retro` rows round-trip with `ERROR_TABLE` and the documented table; the sync check stays green.
- **No new runtime-API location.** Runtime APIs remain in the driver edge; the sidecar consumer and domain engine are pure over injected seams.
- **No CLI export surface.** The command registry carries no export entry and the command definition exposes no export subcommand.

## Security and Boundaries

- **Tamper evidence, not tamper prevention.** The guarantee is scoped to actors that do not possess the chaining key, including a delivery agent operating within its declared lane environment. A same-user process that deliberately reads the store-managed key artifact is outside the documented lane contract and inside the accepted single-user residual risk. The construction is deliberately stronger than the audit ledger's invertible link.
- **Key containment.** The sidecar key exists only as store-managed `0600` material and runtime-edge-injected data. It never enters records, output, configuration, ambient environment, or lane environment; the key artifact is distinct from the audit ledger's key. Key-shaped literals are structurally scanned.
- **Claimed identity.** Collector identity is attribution only, always marked `claimed`, never verified and never an authorization input.
- **Write-path ownership, not authentication.** `retro.evidence.denied` refuses a write outside the collector seam or from a delivery-agent context with exit 2 and `not_landed`; the sidecar is unmodified. `attemptOutOfSeamEvidenceWrite` is the structural refusal helper.
- **Fail-closed reads.** Chain breaks, malformed entries, torn stores, and missing key material never yield silently-trusted or silently-empty results. Explicit salvage is the only recovery and is distinguishable from tampering.
- **Redaction.** Evidence, reports, and bundles pass the single serialization/redaction chokepoint; registered secret values never survive.
- **Local only.** No network egress, no telemetry export, no third-party dependency. All artifacts live under the state directory's least-privilege contract.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Malformed-entry resilience | A schema-malformed entry classifies in-band with partial output preserved; valid entries are processed and stores stay byte-unchanged; no uncaught crash. |
| Tamper detection | Content edits, deletion, reorder, tail truncate-and-reappend, and edits with recomputed unkeyed checksums flag as chain breaks naming position and trace id; zero false "verified" verdicts on unaltered history; key substitution is detected. |
| Key separation and continuity | The key never enters records, output, configuration, or lane environments; unaltered history verifies across processes with zero false breaks. |
| Append-only discipline | No update, delete, reorder, or compaction path exists; reads never mutate; appends are serialized by the collector fence. |
| Boundedness | The audit collector read uses limit `1000`; export requires a limit from `1` to `1000` and reports truncation in band; no unbounded dump path exists. |
| Determinism | Identical sidecar and registry state, injected clock, and flags produce byte-identical output; no ambient clock, random, environment, or filesystem read outside the declared seams; zero model calls. |
| Performance | On a 10,000-record sidecar including full chain verification: collect ≤ 30 s, report ≤ 10 s, export ≤ 10 s. CI gates bounded work (one chain walk per read, one batched append per collection run, bounded per-record work); the declared seam timeout constants (`RETRO_READ_TIMEOUT_MS` 10,000 ms, `RETRO_APPEND_TIMEOUT_MS` 30,000 ms) are carried as seam data, not as a substitute for these budgets. |
| Error-table binding | Four `retro` rows round-trip exactly in both directions; store-level failures reuse existing state identities with their delivered projections. |
| Tier conformance | Contracts stay data-only; runtime APIs stay in the driver edge; registration is composition-only; no hardcoded product name. |
| Secret hygiene | Zero edge-registered secret survivors in any record, finding, report, or exported bundle. |

## Quality Assurance Strategy

The pipeline is exercised through automated `bun:test` suites and the two invariant checks. Behaviour suites live under `tests/behaviour/retro-*.test.ts` with shared fixtures in `tests/fixtures/retro/`; golden envelope cases live in `tests/golden/retro/cases.json`.

| Level | Suites | Scope |
|---|---|---|
| Behaviour — collection and selection | `retro-collect`, `retro-levels` | Target selection and ordering, no-target success, omitted-level default, declared-only refusals with owning-story hints, the locked surface, GET-only bounded reads, and additive run records. |
| Behaviour — sidecar and chain | `retro-sidecar-append`, `retro-chain`, `retro-chain-mutations`, `retro-chain-salvage`, `retro-chain-cross-process`, `retro-key-artifact`, `retro-malformed` | Single and batched append shape, one-read/one-append batch counts, permissions, clean and mutated chain verification, salvage continuity, cross-process key continuity, key open failures, and entry-level malformation preservation. |
| Behaviour — truth checks | `retro-truth-checks` | Each of the five checks with a negative fixture, blocking identities, verified-empty explicitness, and the no-target versus zero-collector distinction. |
| Behaviour — report and export | `retro-report`, `retro-export` | Four-key data shape, provenance, follow-through verdicts, dangling refs, null retro, scope selection, tamper refusal, limit bounds, truncation, and write refusal. |
| Behaviour — envelope and exit | `retro-output` | The golden exit/envelope matrix, `data` XOR `error`, one-line scripted output, and human partial output before the diagnostic. |
| Behaviour — denied and memory audit | `retro-denied`, `retro-memory-audit` | Out-of-seam and delivery-agent refusals, memory-audit evidence recording, and trigger identity. |
| Performance | `retro-performance` | One verified sidecar read and one batched append per collection run at 10 and 10,000 records, plus bounded collect/report/export over the declared 10,000-record ceiling. |
| Structure and contract | `tests/structure/retro-*`, `tests/checks/*` | Vocabulary constants, boundary declaration, imports, no export command, render-path purity, key containment, and error-table sync. |
| Doctor integration | `doctor-state` | The `retro-registry` verdict composition and its ok/verified-empty/torn/unknown cases. |

Fixtures inject deterministic clocks, id factories, fence tokens, and byte-level sidecar I/O; tests never touch the live state directory, spawn processes, or use the network. A skip never counts as a pass.

## Operational & Support

### Configuration

The pipeline has no configuration keys. The CLI composition injects the state store, state directory, workspace id, changes directory, pm-notes filesystem facts, clock, run/trace/fence id factories, optional claimed identity, optional context, and optional collector overrides. The export destination and limit are caller-supplied engine inputs, never ambient defaults.

### Observability

The sidecar and the retro registry are the observability surfaces. Trace ids correlate findings to evidence; the `retro.run` record correlates a collection with its counts, consumed source verdicts, and truth verdict. Chain breaks and malformation findings name positions, trace ids, and counts only. There is no metrics export, sampling, or network egress.

### Retention and storage

Retention follows the state layer: forever. The sidecar grows one record per collected item plus the finding and verified-empty records; the registry grows one run record per collection plus the six level records and one trigger record. There is no prune, delete, compaction, or expiry path. Operators read through the bounded surfaces, not by reading the files directly. Losing the sidecar key prevents verification and continuation for subsequently appended records; rotation, escrow, and backup/restore are outside the contract.

### Cost

The pipeline adds no network, provider, or telemetry cost. The recurring cost is local storage, one fenced batch append per collection run (one write for all its evidence drafts), and the deterministic fold. Collection is human- and agent-scale; the bounded reads cap the work.

## Dependencies & Risks

- **Depends on** the result contract and error table ([feature-result-contract.md](feature-result-contract.md)) for the envelope, exit projection, redaction chokepoint, and the four `retro` rows.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for the public port, validated boundaries, verified reads, fences, store-managed artifacts, least-privilege permissions, and forever retention.
- **Depends on** the command audit ledger ([feature-audit-ledger.md](feature-audit-ledger.md)) for the bounded read surface, chain verdict, skipped-ordinal findings, and claimed-identity convention.
- **Depends on** closeout outcome records and commit telemetry records as collector sources, and on pm-notes typed `retro` notes through the existing read surface.
- **Consumed by** closeout's read-only coverage move, the ceremony runner (M2-S3), and the action registry (M2-S10). Coverage is recorded as a capsule fact; the pipeline's own collection and truth rules are unchanged.
- **Risk — key loss:** losing the key artifact prevents verification and continuation. Mitigation: store-managed `0600` artifact under the state directory; rotation and backup/restore are deferred.
- **Risk — same-user key access:** a same-user process that reads the key artifact can forge links; this is outside the documented lane contract and accepted as residual single-user risk.
- **Risk — false breaks across processes:** mitigated by durable key material and cross-process suites; reported salvage removals are distinguished from breaks.
- **Risk — check vacuity:** every truth check ships a triggerable negative fixture; removing or disabling a check fails the suite.
- **Risk — scope creep:** the ceremony runner, action registry, and export CLI exposure are explicitly outside this feature; closeout's coverage read adds no write path to the registry or the sidecar.

## Glossary & References

| Term | Definition |
|---|---|
| Evidence sidecar | The independent append-only artifact family (`retro-evidence.<workspace>.jsonl`) beside the delivery state store where collector evidence lands. |
| Trace id | The collector-assigned `ev-`-prefixed identifier of one evidence record; the correlation key between findings, reports, and evidence. |
| Collection window | The explicit start/end bounds recorded on an evidence record describing the source fold's coverage. |
| Collector identity | The claimed attribution stamped on evidence records; never verified and never an authorization input. |
| Sidecar chain break | A recomputed keyed link diverging from the stored link; names position and trace id, never payload or checksum bytes. |
| Sidecar chaining key | The distinct 32-byte store-managed key behind the sidecar chain, persisted as `chain-key.retro.<workspace>.json`. |
| Keyed-chain construction | The HMAC-SHA-256 link over chaining key, previous link, and canonical record content. |
| Shape-crash guard | The schema-validated read discipline that classifies malformed entries in-band instead of crashing or dropping data. |
| Entry-level malformation | A record that parses but fails boundary schema validation; classifies `retro.evidence.malformed-entry` (exit 1). |
| Store-level damage | Framing tears, unparsable lines, missing key material, or permission violations; classifies through existing state identities and fails closed. |
| Pipeline-truth check | One of five mechanical validations (`C-01`..`C-05`) distinguishing verified-empty from vacuous green. |
| Vacuous run | A collection run that executed and produced zero collector records; classifies `retro.truth.vacuous-run` (exit 1). |
| No-target outcome | The explicit exit-0 collect success when every completed change is already collected at the level; no run executes. |
| Verified-empty | Explicit evidence that a source was checked and is legitimately empty, naming the check that produced it. |
| Null retro | A report with no supported findings; a valid success when truth checks pass. |
| Level registry | The validated registry declaring levels R1-R6 with scope kinds, trigger declarations, and implementation status. |
| Addendum | A record appended when an already-collected scope is re-collected; reruns append, never rewrite. |
| Follow-through read-fold | The report section folding recorded follow-through entries with their verification verdicts; enforcement is later work. |
| Evidence export | The bounded deterministic bundle of selected records plus the chain verdict, written only to an explicit destination. |

## Related

- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the `retro` domain kind and four rows, exit projection, and redaction.
- [State Layer](feature-state-layer.md) — the store, validated boundaries, fences, store-managed artifacts, and the retro registry in the store layout.
- [Command Audit Ledger](feature-audit-ledger.md) — the bounded read surface, chain verdict, skipped-ordinal findings, and claimed identity.
- [Doctor](feature-doctor.md) — the state check's `retro-registry` store verdict.
- [Closeout Transaction](feature-closeout.md) — the read-only `retro-coverage-move` consumer and a collector source; [Change Capsule](feature-capsule.md) — the capsule event that records coverage.
- [Commit Primitive](feature-commit-primitive.md) — a collector source.
- [Glossary](../../overview/glossary.md) — repository-wide terms.
- [TDR-0009](../../decisions/TDR-0009-retro-evidence-sidecar-keyed-chain-construction.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [TDR-0004](../../decisions/TDR-0004-state-storage-engine.md), [TDR-0005](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md).
- Change records: `doc/changes/2026-11/2026-11-06--GH-232--oss-retro-pipeline/`, `doc/changes/2026-11/2026-11-07--GH-240--capsule-closeout/`.
