# Concept: primitive catalogue

Status: Draft (2026-10-25). Feeds the adapter-contract decision record
scheduled in M0-S17. Companion to agent-primitive-surface.md, which defines
how primitives are exposed; this catalogue defines what the primitives are.

## Purpose

This is the catalogue of ADOS primitives: the smallest units of meaning the
system exposes, with stable semantic contracts that compose without
reconstructing internals. Rows start as Planned, gain typed contracts at
their milestone, and graduate to Delivered as stories land. Over time this
document becomes the record of the primitives ados actually delivers.

| Status | Meaning |
|---|---|
| Planned | Agreed direction; no typed contract yet |
| Typed | The contract exists in core `./contracts` (story delivered) |
| Delivered | Implemented, consumed by engines, conformance-tested |

Every row update links the story, decision record, or pull request that
changed the status.

## What a primitive is (and is not)

The test: an agent could receive this capability with its contract, examples,
and invariants, then build several materially different features by composing
it without inventing domain behavior.

A primitive is not a command, an engine, a package, a prompt, or a UI screen.
Commands and engines compose primitives; the CLI, MCP server, and opencode
integration are transports over the same core. This distinction keeps the
catalogue from becoming a feature list.

## Discipline

Maturity: Candidate (might be reusable) -> Emerging (used by more than one
capability) -> Stable (canonical; reuse before creating alternatives) ->
Deprecated (do not use for new development).

Change classification, applied per change:

- COMPOSE: build from existing primitives. Lowest risk.
- EXTEND: extend an existing primitive because the new behavior belongs to
  its semantic responsibility. Moderate risk.
- INTRODUCE: add a new primitive because composition and extension would
  violate boundaries. Highest scrutiny; must answer:
  - Which existing primitives did composition fail to cover?
  - Why is this not an extension of an existing responsibility?
  - Which invariants and does-not-own boundaries does it add?
  - Which consumers will depend on it, and how is it removed if wrong?

Card fields (only load-bearing primitives get full cards): status, scope,
owner, meaning, owns, does not own, invariants, capabilities, composition
examples, contracts (CLI, MCP, event, store, test), implementation,
consumers, decisions, limitations.

## Load-bearing set for M0-M1

The first typed core carries these; the rest stay candidates until a second
consumer needs them:

WorkItemRef, RepoRef, ChangeWorkspace, Phase, ArtifactPostcondition,
DeliveryOutcome, DurableRun, CommandReceipt, GateVerdict, MergeTransaction,
DispatchRun, HarnessSession, LaneLease, LivenessSignal, ReadySet,
ProviderRoute, StateStore, AuditEvent, AttentionState.

## Catalogue

Typed at: the milestone where the typed contract first appears. Status today
is Planned throughout; the bash delivery stack provides behavior prototypes,
not contracts.

### Context and configuration

| ID | Primitive | Kind | Meaning and invariant | Typed at |
|---|---|---|---|---|
| P-001 | WorkItemRef | context | Provider-qualified delivery identity; never predicted; resolves to tracker instance and project | M0 |
| P-002 | RepoRef | context | Canonical repo identity by resolved remote, not folder; two clones are one lease domain | M0 |
| P-003 | ChangeWorkspace | state | Per-change artifact set (spec, test plan, plan, notes); traceability anchor | M0 |
| P-004 | Phase | state | One of the 11 lifecycle phases; ordinal plus evidence, never a self-reported timestamp | M0 |
| P-005 | ConfigLayer | policy | Layered configuration chain; secrets environment-only | M0 |
| P-006 | SessionMapping | context | Ticket to session mapping, safe across branch switches | M3 |
| P-052 | ProviderInstance | context | One configured provider account or instance, separate from the route | M1 |

### Truth, merge, and lifecycle

| ID | Primitive | Kind | Meaning and invariant | Typed at |
|---|---|---|---|---|
| P-010 | ArtifactPostcondition | contract | Facts required before success: branch pushed, delivery request open or commit landed, ticket transitioned, head pipeline green; exit codes are not evidence | M0 |
| P-011 | DeliveryOutcome | contract | Terminal classification plus evidence: done-with-artifact, interrupted, state-fetch-failed, silent-noop, premature-end, failed, unknown; unknown is first-class | M0 |
| P-012 | GateVerdict | contract | Named merge precondition with pass or fail and citations; fail-closed on ambiguity | M1 |
| P-013 | OwnerGate | contract | Marker that only the owner can clear; never inferred from silence | M1 |
| P-014 | FreezeFlag | control | Machine-readable merge freeze; never prose | M1 |
| P-015 | MergeTransaction | capability | Re-fetch gates at merge time, squash, verify postconditions, record citations | M1 |
| P-016 | CloseoutTransaction | capability | Idempotent post-merge transaction: done flip, labels, unassign, owed flips, branch restore | M0 |
| P-017 | DeployVerification | capability | Verify by job trace, not pipeline color; "no changes" is a trigger | M1 |
| P-083 | CompletionLedger | state | Closed work cannot be re-dispatched by a stale prompt | M1 |

### Execution and supervision

| ID | Primitive | Kind | Meaning and invariant | Typed at |
|---|---|---|---|---|
| P-018 | DurableRun | state | Persisted run record: intent, phase, checkpoints, receipts, effects, replay policy; a crash never produces silent success | M0 schema, M1 build |
| P-019 | Checkpoint | state | Phase-boundary resume without re-derivation | M1 |
| P-020 | CommandReceipt | event | Every external mutation gets accepted, in-flight, applied, failed, or unknown | M0 schema |
| P-021 | OutboxEffect | state | Pending external effects with idempotency key and retry policy | M0 schema |
| P-030 | DispatchRun | capability | One ticket delivery execution with a single-flight lease and verification contract | M1 |
| P-031 | LaneLease | state | Per-remote ownership; one delivery per repo; heavy-build semaphore separate | M1 |
| P-032 | LivenessSignal | event | Multi-signal progress: session traffic, worktree activity, process; bounded | M1 |
| P-033 | WatchdogPolicy | policy | Phase-aware stall budgets and restart rules; no wall-clock-only kills | M1 |
| P-034 | Supervisor | capability | Singleton service that starts, watches, and restarts lanes; never a lane | M2 |
| P-035 | StopSignal | control | Durable stop and reset that survives restarts | M2 |
| P-036 | SteeringNote | control | Mid-flight instruction delivered at a phase boundary, with a receipt | M2 |
| P-037 | IdleSignal | event | Machine-readable "no dispatchable work"; replaces polling loops | M2 |

### Queue, scheduling, and provider

| ID | Primitive | Kind | Meaning and invariant | Typed at |
|---|---|---|---|---|
| P-040 | QueueEntry | state | Work item with deps, priority, tier, repo, notes | M2 |
| P-041 | DependencyEdge | state | Blocks and blocked-by, provider-normalized | M2 |
| P-042 | ReadySet | projection | Deps satisfied AND repo free AND gates pass AND provider available AND CI healthy; reproducible from source data | M0 read-only, M2 full |
| P-043 | Tier | policy | Delivery tier default with escalation triggers, recorded at intake | M2 |
| P-044 | ParkState | state | Named, scoped, self-expiring park with a blocking condition | M0 |
| P-045 | QuotaWindow | policy | Provider peak and reset window as scheduler input; pause, never substitute peak-priced | M0 |
| P-046 | SchedulePolicy | policy | When to dispatch: peaks, resets, deadlines, CI budgets | M2 |
| P-097 | OwnerGateSLA | policy | Aging, escalation, and default-on-expiry for owner decisions | M2 |
| P-050 | ProviderRoute | policy | Ordered provider resolution with hysteresis and fail-open | M0 |
| P-051 | QuotaSnapshot | state | Quota and balance state per provider and account | M0 |
| P-053 | ModelPolicy | policy | Model and tier selection by role and phase, quality-gated | M2 |
| P-054 | SpendRecord | event | Tokens and cost by agent, model, session, phase, ticket | M3 |

### Adapters and provider interaction

| ID | Primitive | Kind | Meaning and invariant | Typed at |
|---|---|---|---|---|
| P-060 | ExternalSystemInstance | context | Configured tracker, VCS, or CI instance with auth method | M0 |
| P-061 | AdapterContract | contract | Adapters declare capabilities and gaps; never pretend parity | M0 |
| P-062 | WorkItem | adapter | Normalized ticket: id, status, labels, assignee, relations, comments | M0 |
| P-063 | WorkflowMap | adapter | Native status to ADOS state alias plus transition mechanism | M0 |
| P-064 | Relation | adapter | Parent and child, blocks, relates-to | M0 |
| P-065 | ChangeRequest | adapter | Delivery request: PR or MR with target and source refs, review state, threads | M0 |
| P-066 | PipelineRun | adapter | Pipeline, job, and trace evidence, not just a status color | M0 |
| P-067 | RetryPolicy | policy | Only known-safe retries; unsafe writes never retry | M0 |
| P-068 | Compensation | capability | Reversible action for risky writes where feasible | M1 |
| P-084 | IdempotencyKey | contract | Safe retries for external writes | M0 |
| P-069 | HarnessInstance | context | Configured agent harness (opencode, claude-code, later pi.dev) with version and capability flags | M1 |
| P-070 | HarnessSession | capability | Spawn, resume, steer, and collect a delivery session; premature end is classified; liveness stays harness-agnostic | M1 |
| P-071 | HarnessPluginSurface | contract | Per-harness package format exposing the tooling (commands, agents, MCP), generated from the canonical source, sync-verified | M3 |
| P-072 | HarnessTelemetry | event | Read-only session statistics extracted from harness stores at capture points (closeout first): tokens by class, calls, tool usage, per agent and model, session-tree attributed to work items; persisted as events, harness-neutral schema | M1 |

### State, audit, and owner surfaces

| ID | Primitive | Kind | Meaning and invariant | Typed at |
|---|---|---|---|---|
| P-079 | RetroRecord | event | One retrospective finding with scope, evidence, and owner | M2 |
| P-080 | StateStore | store | Schema-guarded, single-writer, atomic store; parse failures are errors, never zeros | M1 |
| P-081 | AuditEvent | event | Actor, operation, target, result, duration, correlation | M0-M1 |
| P-082 | Provenance | contract | Who authored an action: owner, agent, service; agent-under-owner is distinct | M1 |
| P-085 | MemoryRecord | store | Append-only working memory with schema and dates | M1 |
| P-086 | RegistryWatermark | state | Collector-owned watermark; never hand-edited | M2 |
| P-087 | TelemetryEvent | event | Local, schema-versioned event log a hosted sink can consume without migration | M0 schema, M1 freeze |
| P-088 | Metric | metric | Native delivery metric with window and threshold | M3 |
| P-089 | Baseline | metric | Reproducible aggregation at gate time, never copied from prose | M3 |
| P-090 | AttentionState | state | Waiting, needs-decision, blocked, done; one state behind status, brief, board, and any inbox | M1 |
| P-091 | Finding | projection | Ranked anomaly with evidence and next action | M0 |
| P-092 | StatusDigest | projection | Bounded digest of findings and next actions | M0 |
| P-093 | Brief | projection | Owner brief rendered from source, with decision items and silence meaning | M2 |
| P-094 | DecisionItem | contract | One decidable item with options, recommendation, risk, default | M2 |
| P-095 | Ask | state | Owner question with answer record and provenance | M2 |
| P-096 | Ceremony | capability | Scheduled deterministic ritual with artifact verification and catch-up | M2 |
| P-038 | SessionView | projection | Snapshot plus operations for a running session, across CLI, MCP, and opencode | M3 |

Hosted-track note: hosted capabilities consume the open TelemetryEvent and
AuditEvent contracts and never create a second semantic model (see M4-S6 and
telemetry-and-events.md). Hosted-only primitives are out of scope for this
catalogue.

## Research candidates

Not ratified; strong candidates that influence M0-M3 design. Promoted into
the catalogue only when a second consumer appears.

| ID | Primitive | Proposed | Note |
|---|---|---|---|
| C-01 | AgentDiffIsolation | M1 | Agent-only diff isolation and branch comparison |
| C-02 | DurableTimer | M2 | Timers and wake contracts that survive restarts |
| C-03 | TaskTree | M2 | Delivery task tree with ownership and bottom-up abort |
| C-04 | PRWatch | M2 | Watch a delivery request with wake conditions and budgets |
| C-05 | EventTrigger | M2 | Event or webhook intake with filters, replay, coalesce |
| C-06 | HarnessAdapter | M3 | Absorbed into P-069/P-070/P-071; the remaining spike evaluates pi.dev and protocol compatibility |
| C-07 | CapabilityEnvelope | M3 | Phase capability envelope for agents |
| C-08 | ScopedAccessGrant | M3 | Pairing, consent, revocation, scoped approvals |
| C-09 | GuaranteeContract | M1 | Published guarantees and non-guarantees for the durable substrate |
| C-10 | CoordinationDocument | M1 | Revisioned coordination document with path operations |
| C-11 | ReplayPolicy | M1 | Per-operation replay rules; fold into DurableRun if adopted |
| C-12 | CrashRecord | M1 | Crash counting, parked task, retry semantics |
| C-13 | ReportTaxonomy | M1 | Typed report taxonomy merged with the exit taxonomy |
| C-14 | MultiModelFanout | M2 | Fan one task out to several models for comparison |
| C-15 | SnapshotIntake | M2 | Snapshot intake and grouped activity digest |
| C-16 | AutoResume | M2 | Resume and snooze at quota reset |
| C-20 | LinkedMultiPR | M3 | Linked and multi-delivery-request semantics, data model first |
| C-21 | SecretRequestFlow | M3 | Scoped secret request flow through MCP |
| C-22 | OpenTelemetryExport | M3 | OpenTelemetry export over the event schema |

## Dependency graph

Semantic composition order, not code dependency:

```text
WorkItemRef + RepoRef + Provenance
        |
        v
ChangeWorkspace -> Phase -> evidence
        |
        v
ArtifactPostcondition -> DeliveryOutcome
        |
        v
GateVerdict -> MergeTransaction -> CloseoutTransaction
        |                              |
        v                              v
DeployVerification              CompletionLedger

HarnessInstance -> HarnessSession -> DispatchRun -> LaneLease -> LivenessSignal -> WatchdogPolicy -> Supervisor
        |
        v
DurableRun -> Checkpoint -> CommandReceipt -> OutboxEffect -> IdempotencyKey

QueueEntry -> DependencyEdge -> ReadySet -> LaneLease -> DispatchRun

ExternalSystemInstance -> AdapterContract -> WorkItem / ChangeRequest / PipelineRun
        |
        v
RetryPolicy -> Compensation

StateStore -> AuditEvent -> Provenance -> TelemetryEvent -> Metric -> Baseline
        |
        v
AttentionState -> Finding -> StatusDigest -> Brief -> DecisionItem / Ask
```

Hard ordering constraints:

1. ArtifactPostcondition and DeliveryOutcome before any automated queue
   dispatch (the fleet-wedging scenario otherwise).
2. The status contract before the status aggregator; M0 ships both together.
3. Provider resolution and quota snapshots before the ceremony runner.
4. GateVerdict and MergeTransaction before merge authority moves to the CLI.
5. StateStore and IdempotencyKey before any retrying write path.
6. AttentionState before brief, board, or any inbox grows its own state model.
7. MCP follows engines one to one; no MCP-only logic.
8. Hosted capabilities consume open event contracts; no second semantic model.

## Composition examples

Deliver one change: WorkItemRef + RepoRef + ChangeWorkspace + DispatchRun +
LaneLease + LivenessSignal + ArtifactPostcondition + DeliveryOutcome +
GateVerdict + MergeTransaction + CloseoutTransaction = accepted delivery with
evidence (COMPOSE).

Compute a ready set: QueueEntry + DependencyEdge + RepoRef + LaneLease +
GateVerdict + ProviderRoute + QuotaSnapshot + PipelineRun health = ReadySet
(COMPOSE).

Recover a crashed lane: DurableRun + Checkpoint + LivenessSignal +
CommandReceipt + OutboxEffect + RetryPolicy = resumed run or classified
failure (COMPOSE).

Add a provider: ExternalSystemInstance + AdapterContract + WorkItem +
WorkflowMap + Relation + ChangeRequest + PipelineRun = normalized provider
surface (EXTEND; the adapter declares capability gaps, never fake parity).

## Non-primitives

Commands (`status`, `dispatch`, `verify change`, `verify gates`, `merge`,
`closeout`, `queue`, `ceremony`, `brief`), the MCP tool list, and the
opencode integration are transports and compositions, not primitives. The
command registry (cli-command-registry.md) maps every command to the
primitives it composes. Installers, updaters, validators, and repo bootstrap
are tools and surfaces. Domain primitives from unrelated products are method
examples, not ADOS primitives.

## Maintenance

- Add a primitive only when it appears in at least two capabilities, or a
  single capability cannot be expressed without it.
- Keep table rows short; promote to a full card only when a change needs it.
- Mark maturity honestly; bash-era behavior is a stable-behavior,
  candidate-contract combination.
- Renames keep the old name as an alias for one revision.
- Row status changes link the story, decision record, or PR that made them.
