---
ados_distribution: internal
id: SPEC-SPEND
status: Current
created: 2026-11-07
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The Learn-family spend read side: the read-only `spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]` command folding the closeout-captured harness.telemetry session-group and capture-outcome records plus phase.transition history into five-class token totals, calls, per-agent/model roll-ups, capture-time per-phase attribution with the named unknown fallback, restart counts over the union of run identities, the TDR-0011 resume-amplification ratio with the additive progressRun field and named restart-loop prefill re-pay events, the closed degradation disclosure, bounded deterministic human and machine output, the single spend.telemetry-absent error row, and the status digest section 8 projection fed by the same fold."
links:
  related_changes: ["GH-236"]
  related_decisions: ["TDR-0011", "ADR-0003", "TDR-0004", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/spend.ts"
    - "packages/core/src/contracts/harness-telemetry.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/status.ts"
---

# Feature: Spend Read Side

## Overview

The spend read side is the Learn-family `spend` command. Its surface is exactly `<binary> spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]`: a deterministic, read-only fold over the closeout-captured event log. It reports per-ticket and per-phase tokens by class, calls, per-agent/model roll-ups, per-delivery restart counts, and the resume-amplification metric with amplification events flagged by name. Every figure derives from verified state-ledger reads of the two `harness.telemetry` record families for one work-item ref plus that ref's `phase.transition` history; the command never opens a harness store, reads a session database, queries a provider, or writes state.

The success payload is the standard `CommandResult` envelope whose `data` carries schema identity `delivery.spend.v1` with exactly six keys: `tokensByClass`, `perPhase[]`, `perAgent[]`, `restarts`, `amplification`, and `degradation`. The schema identity is a declared contract constant, not a `data` key. `--amplification` adds the amplification section to the human digest; the machine envelope always carries the full amplification block. `--json` is the global machine-output switch.

Telemetry-absent is a first-class classified outcome (`spend.telemetry-absent`, exit 1) rather than an empty success or a zero report. Store damage keeps the delivered `state.*` identities and their own projections. The status digest's section 8 is fed by the same read-side fold, so the digest and the command report identical totals, restarts, and ratio from the same store.

## Business Context

### Problem Statement

- **Problem:** Delivery spend is invisible when it must be reconstructed by hand: per-ticket and per-phase token breakdowns, per-agent/model attribution, restart volume, and the paid-versus-progress waste signal are not answerable from the tooling, and a digest section without spend evidence is a placeholder rather than proof. Until a production capture composer is wired, every real store is telemetry-absent; a read side that treated absence as an edge case, a silent zero, or an unclassified failure would be wrong in every real invocation.
- **Affected Users:** The operator and coordinator reading delivery economics, lifecycle agents consuming the report, and the later alarm/burn-rate and model-routing surfaces that consume the amplification signal.
- **Business Impact:** The two operator waste classes this surface exists for — restart re-payment and re-run spend — become answerable from one invocation over the log alone, without harness re-query and without reconstructing numbers by hand.

### Goals

- Report a per-ticket and per-phase breakdown from the event log alone, with zero harness-store reads.
- Attribute records to delivery phases from the timestamped transition history already in the ledger.
- Count delivery-run restarts over the union of run identities in both telemetry families.
- Report the resume-amplification metric — tokens paid versus unique progress, approximately 1 for a healthy delivery — and flag amplification events by name.
- Classify telemetry-absent explicitly and reuse delivered state identities for store damage.
- Report spend evidence in the status digest's section 8 from the same fold.

## User Experience & Functionality

### Command surface

The handler owns the value grammar before any read and performs no stream write and chooses no exit code. `--json` is the global machine-output switch and adds no spend behavior.

| Invocation | Behavior |
|---|---|
| `spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]` | Reports the selection's spend. |
| `--ref` omitted | Resolves the active change ref from the local delivery context without touching the state store. |
| `--ref` with an unresolvable active context | Refuses `input.value.rejected` (exit 1) before any read. |
| `--ref <ref>` | Matches the canonical uppercase ref grammar (`^[A-Z][A-Z0-9]*-[0-9]+$`), case-sensitive with no folding. A malformed shape refuses `input.value.rejected` before any read. |
| `--phase <phase>` | Selects one canonical delivery phase; scopes the whole report (tokens, calls, `perAgent[]`, `perPhase[]`, restarts, and amplification) to the phase-attributed records. |
| `--phase` outside the eleven canonical phase ids | Refuses `input.value.rejected` (exit 1) before any read, naming the canonical vocabulary. |
| `--phase` naming a canonical phase whose window holds no records | Returns the scoped `spend.telemetry-absent`, naming the phase. |
| `--amplification` | Adds the amplification section to the human digest. The machine envelope always carries `amplification`. |
| Missing flag value or unexpected positional | Refuses `input.value.rejected` (exit 1). |
| Undeclared flag | Refuses through the shared parser as `fallback.invocation` (exit 1). |
| `--json` | Forces the standard envelope; the handler never inspects it. |
| `--help` | Not a command-local flag; usage lives on the documented help surfaces. |

Registration is composition-only: the command exists in a program only when its spend composition is supplied.

### Examples

Healthy single-run delivery (human digest, `--amplification` shown):

```
$ <binary> spend --ref GH-236 --amplification
spend
tokens     input 123 | output 52 | reasoning 7 | cacheRead 2 | cacheWrite 1
calls      4
agents
- planner/sonnet: 3 calls, 153 tokens
- coder/opus: 1 calls, 32 tokens
phases     capture-time windows (phase.transition)
- clarify_scope: 4 calls, 185 tokens (100%)
restarts   0 (runs that reached closeout capture)
limits
- run duplication is proven; semantic duplication is not
- runs that never reached closeout capture are invisible to this report
- restart counts share that capture-reached evidence basis
- a zero-token progress run reports no ratio and is named in amplification.progressRun (paid > 0 or paid = 0)
ratio      1 (paid 185 / progress 185)
events     none (no superseded record-bearing run)
degradation 0 record(s) with warnings
```

No captured telemetry for the selection (machine envelope):

```
$ <binary> spend --ref GH-236 --json
{"schemaVersion":"delivery.result.v1","runId":"run-01J8ZR8M6T","exitCode":1,"timing":{"totalMs":12},"error":{"code":"spend.telemetry-absent","category":"user","retryable":false,"consequence":"not_landed","remediationHint":"Capture harness telemetry (session-group and capture-outcome records) for the selected work item at closeout, then re-run spend.","summary":"spend: no captured harness telemetry for ref GH-236"}}
```

A restart loop reports a ratio above 1 and one `restart-loop prefill re-pay` event per superseded record-bearing run; a zero-token progress run reports `ratio: null` and names the run in `amplification.progressRun`; a capture-outcome-only store reports `ratio: null` and `progressRun: null` as a success.

### Spend breakdown

`tokensByClass` carries exactly the five delivered token classes — `input`, `output`, `reasoning`, `cacheRead`, `cacheWrite` — as non-negative integers summed across the selected captured session-group records. A token class absent at capture is excluded from every sum and never fabricated to zero. Calls are reported in the human digest total and in every `perAgent[]` and `perPhase[]` entry; the six-key machine payload carries no separate top-level calls key.

`perAgent[]` groups records by (agent, model) with `calls` and `tokens`. It orders by tokens descending, then agent ascending, then model ascending.

`degradation` discloses records with any null-when-missing token class, any closed-vocabulary warning, or a capture-outcome warning. It carries `records` (the count of affected records and outcomes) and `byReason` over the closed harness warning vocabulary: `optional-field-absent`, `non-numeric-value`, `cost-missing`, `version-drift`, `malformed-line`, `truncated`, `session-capture-failed`, `unattributable-session`, and `invalid-session-identity`. A capture-outcome warning is never dropped.

Cost is not aggregated and never rendered. A record's cost stays null-when-missing and token counts alone constitute the breakdown.

### Per-phase attribution

Telemetry records carry no phase field; attribution is derived. The fold orders the ref's `phase.transition` history and assigns each record's captured-at stamp under the capture-time rule:

- A stamp selects the phase of the earliest transition at or after the stamp.
- When several transitions share that stamp, the last one wins, so a `reopen` beats a `complete` at the same instant.
- A stamp after the final transition attributes to the final transitioned phase (the normal closeout position).
- A stamp before the first transition attributes to the first transitioned phase.
- A ref with no transition history places all spend in the single named `unknown` window, and the human digest names the attribution fallback.

`perPhase[]` carries one entry per phase id, aggregating all of that phase's windows: `phase`, `calls`, `tokens`, and an integer floored `share` percentage. Shares may not sum to 100. Entries order by window start ascending, then phase id ascending, with `unknown` last.

### Restarts

`restarts` is `max(0, N − 1)` where `N` is the size of the union of run identities across captured session-group records and capture-outcome records for the selection. Both families contribute identity, so a capture-outcome-only run is counted. The count is over runs that reached closeout capture; runs aborted before capture are invisible, and that evidence basis is disclosed in the report's own terms.

### Resume amplification

`amplification` is `{ ratio, progressRun, events[] }` per TDR-0011 as amended.

- **Paid** is the five-class token sum over all selected captured records.
- **Progress run** is the latest record-bearing captured run, ordered by captured-at descending with a run-id ascending tie-break. No run-id format property is assumed.
- **Ratio** is paid ÷ progress. A healthy delivery with exactly one record-bearing positive-spend run reads exactly 1.
- **Zero-token progress run.** A progress run that contributes zero tokens reports `ratio: null`, covering both paid > 0 and the degenerate paid = 0 case where every captured class is null or zero. The additive nullable `progressRun` names that run in every null case where a record-bearing progress run exists, and is null whenever progress > 0.
- **No record-bearing run.** A capture-outcome-only store — records exist but no session-group run does — is a success report with `ratio: null` and `progressRun: null`. It is never `spend.telemetry-absent`.
- **Events.** Each earlier record-bearing run with positive spend flags one event: `cause` is exactly `restart-loop prefill re-pay` (a closed single-entry v0 vocabulary), `window` is `{start, end}` where `start` is the previous record-bearing run's captured-at, the earliest transition timestamp for the first run, or a point at the run's own captured-at when no transitions exist, and `end` is that run's captured-at; `tokensWasted` is that run's spend. Events sort by window start, then run id. The progress run never raises an event.

The report renders these honesty-limit declarations verbatim:

- `run duplication is proven; semantic duplication is not`
- `runs that never reached closeout capture are invisible to this report`
- `restart counts share that capture-reached evidence basis`
- `a zero-token progress run reports no ratio and is named in amplification.progressRun (paid > 0 or paid = 0)`

### Output contract and bounds

The machine payload is the standard `CommandResult` envelope whose `data` is the six-key `delivery.spend.v1` report. The human digest is a deterministic, bounded rendering of the same data. `--amplification` controls only the human amplification section; the envelope always carries the full block.

| Bound | Value |
|---|---|
| Machine payload | ≤ 65 536 UTF-8 bytes |
| Human digest | ≤ 16 384 UTF-8 bytes and ≤ 200 lines |

The machine bound drops trailing `perAgent[]` entries first, then trailing `perPhase[]` entries, then trailing amplification events, recording the dropped counts in the warning channel and a deterministic `truncated` marker. The human renderer applies the same tail order and records the same marker. Token totals, `restarts`, `ratio`, and the `progressRun` identity are never truncated. All bounds are measured in UTF-8 bytes.

### Error identity and exits

One new domain kind, `spend`, carries exactly one row: `spend.telemetry-absent` (category `user`, non-retryable, consequence `not_landed`, projection `user-validation` → exit 1). Every other outcome keeps its delivered identity and projection. Kind-only `spend` lookup is never used; the identity resolves by exact code only, and a kind-only discriminant is contained by `fallback.internal`.

| Condition | Identity | Exit |
|---|---|---|
| Report rendered (including the degenerate all-zero report and a capture-outcome-only success) | — | 0 |
| No captured telemetry for the selection (including a canonical phase with an empty window) | `spend.telemetry-absent` | 1 |
| Malformed ref, unresolvable active context, out-of-vocabulary phase, missing value, unexpected positional | `input.value.rejected` | 1 |
| Undeclared flag | `fallback.invocation` | 1 |
| Permission violation on the store read | `state.permission.denied` (delivered `user-validation`) | 1 |
| Torn store, wrong record kind, malformed payload | `state.store.torn` | 2 |
| Unsupported store schema | `state.schema.mismatch` | 2 |
| Unknown store condition | `state.store.unknown` | 2 |
| Unclassifiable handler failure / kind-only `spend` | `fallback.internal` | 2 |

Machine consumers branch on the error code, never the exit code alone. Store damage is never re-projected as telemetry-absent, and telemetry-absent is never reused for store damage.

### Status digest collaboration

Status digest section 8 `spend` is a collector section fed by the same `readSpendLedger` call and pure fold the command consumes, over the digest's active change ref. Its delivered projections are:

| Store outcome | Section state | Evidence |
|---|---|---|
| Captured telemetry | `observed` with token-class totals, `restarts`, and the amplification ratio | source `state-log`, outcome `read`, reason `observed` |
| Verified-empty telemetry | `observed` with zero counts and the human line `no captured telemetry (absence of capture)` — never a zero-spend claim | source `state-log`, outcome `observed-empty`, reason `observed-empty` |
| Failed store read | `unknown` with the `state-unreadable` reason and the state failure code; the digest still renders all nine sections and exits 0 | source `state-log`, outcome `failed`, `failureCode` |
| No resolvable active change ref | `unknown` with reason `local-context-missing` and its code | source `state-log`, outcome `failed`, `failureCode` |

The digest carries the spend projection as the section's `spend` field. The section contributes zero to `actionable`; `placeholderSectionCount` is exactly 1 (the `blockers` placeholder). No spend placeholder line renders. The brief carries no spend surface.

## Technical Architecture & Codebase Map

### Core components

| Path | Component | Responsibility |
|---|---|---|
| `packages/core/src/contracts/spend.ts` | Spend vocabulary | The `delivery.spend.v1` schema constant, six data keys, amplification keys and closed cause, five-class totals, bounds, truncation targets and marker, ordering keys, disclosure statements, ref grammar, the one error code, report/read/selection/digest types, and the injected command runtime type. Types and `as const` data only. |
| `packages/core/src/contracts/harness-telemetry.ts` | Telemetry vocabulary | The `harness.telemetry` record kind, payload schemas, key prefixes, five token classes, and closed warning vocabulary the fold reuses by reference. |
| `packages/core/src/contracts/registry.ts` | Transition vocabulary | The `phase.transition` payload and history-read semantics the phase windows fold. |
| `packages/core/src/contracts/error-table.ts` | Error table | The `spend` domain kind, its one `spend.telemetry-absent` row, and the exact-code-only kind declaration. |
| `packages/core/src/state/spend-reads.ts` | Read consumer | One classified, verified, ref-scoped read composing both telemetry families and the ref's transition history over the injected state port; no append, fence, salvage, harness, session, or provider access. |
| `packages/core/src/domain/spend.ts` | Pure fold | Five-class sums with null exclusion, degradation accounting, per-agent roll-ups, capture-time phase attribution, restart counts, the TDR-0011 amplification formula, bounding, and the status-digest projection. Zero I/O, clock, or randomness. |
| `packages/core/src/domain/spend-text.ts` | Human renderer | The bounded deterministic human digest, disclosure lines, amplification emphasis section, and truncation marker. |
| `packages/cli/src/commands/spend.ts` | Command definition | The locked grammar, value validation before any read, default-ref resolution, human render and failure hooks. No stream write and no exit choice. |
| `packages/cli/src/edge.ts` | CLI edge | Composition of the read-only state and local-context seams, the command runtime, and the status digest's spend projection over the same fold. |

### Key functions

```ts
function readSpendLedger(store: StateStorePort, workItemRef: string): StateResult<SpendLedgerRead>;
function computeSpendReport(read: SpendLedgerRead, selection?: SpendSelection): SpendFoldOutcome;
function renderSpendHuman(report: SpendReport, options: SpendHumanOptions): string;
function spendDigestSection(read: SpendLedgerRead): SpendDigestSection;
function createSpendCommandDefinition(runtime: SpendCommandRuntime): CommandDefinition;
function createSpendCommandRuntime(options: SpendCompositionOptions): SpendCommandRuntime;
```

### Data architecture

- **No new record kind.** The command consumes `harness.telemetry` session-group records (`delivery.harness.telemetry.v1` under `harness.telemetry:<workItemRef>`), capture-outcome records (`delivery.harness.telemetry.capture.v1` under `harness-telemetry-capture:<workItemRef>:<runId>`), and the ref's `phase.transition` history. No payload schema, key prefix, append path, projection, or schema-version bump changes.
- **One classified read.** The three verified reads run in a fixed order — session telemetry, capture outcomes, transition history — so the failure identity is deterministic. Every failure is the delivered `state.*` result, never a partial or zeroed read.
- **Presence tolerance.** An absent store or an absent per-ref record family is explicit verified-empty evidence. When both telemetry families hold no records for the ref, the read is `verifiedEmpty` and the fold classifies `spend.telemetry-absent` (or the scoped phase absence).
- **Evidence.** The read carries the store path and a transition record count for diagnostics only; output carries statistics and identity references only.

### API and interface contracts

- `SpendCommandRuntime` exposes `resolveActiveRef()` and `report(selection)`; the CLI command definition consumes it and returns `data`, `warnings`, or a classified `error`.
- `SpendCommandFailure` is either the one `spend` code or an existing `state` code with `not_landed` and a safe location.
- `SpendDigestSection` is the digest projection: `{ state: "observed", captured: true, tokensByClass, restarts, ratio }`, `{ state: "observed", captured: false }`, or `{ state: "unknown", reason: "state-unreadable" | "local-context-missing", failureCode }`.

### Invariants and gates

- **Read-only by construction.** No append, fence, salvage, spawn, network, credential, or harness call is reachable on any invocation path; the read consumer imports no adapter, session reader, or provider client. Byte-snapshot tests prove the store is unchanged.
- **Deterministic render.** Identical store content, injected clock, and injected run-id render byte-identical output; the render path performs zero model calls and reads no ambient clock or randomness.
- **Contract exactness.** The six `data` keys, the three amplification keys, the closed single-entry cause vocabulary, and the five reused token classes are asserted from the contract module.
- **Error-table binding.** The one `spend` row round-trips with the documented table and resolves by exact code only; no exit literal lives outside the CLI projection module.
- **Composition-only registration.** The command registry carries a spend entry only when the spend composition supplies it.

## Security and Boundaries

- **Read-only state access.** The command acquires no fence and writes nothing; it cannot mutate an artifact.
- **Log-only source.** No harness store, session database, provider, or network read exists on any path.
- **Bounded hostile input.** Ref shape and phase vocabulary are validated before any read, and undeclared flags are rejected by the shared parser.
- **Privacy.** Output carries aggregate counts, refs, phase ids, agent/model names, run ids, and time windows only. It never carries prompt text, message bodies, transcripts, diffs, tool output, or credential material; the delivered serialization redaction chokepoint composes unchanged.
- **Brand neutrality.** The human surface uses the injected brand binary name; no product or binary literal is committed.
- **Honest claims.** The amplification block proves run duplication only and states its evidence limits in the report's own terms.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Bounded output | Machine payload ≤ 65 536 UTF-8 bytes; human digest ≤ 200 lines and ≤ 16 384 UTF-8 bytes; truncation is deterministic, tail-ordered, and marked. |
| Determinism | Byte-identical output for identical store content, injected clock, and injected run-id; zero model calls; declared ordering keys. |
| Read-only and log-only | Zero state writes, zero fences, zero harness-store reads, zero spawns, zero network, zero credential resolution; all reads verified. |
| Fold latency and bounded work | p95 ≤ 500 ms at 1 000 captured records and ≤ 2 s at 10 000 in the reference environment; CI gates the bounded work (one verified read per family, one fold, no per-record re-reads, no network). |
| Privacy | Statistics and identity references only; redaction chokepoint unchanged. |
| Contract sync | The machine and documented error tables agree on the `spend` row bidirectionally; no exit literals outside the projection module. |
| Offline evidence | Every reporting path is proven on fixture-seeded temp stores; zero live harness stores, credentials, or network. |

## Quality Assurance Strategy

Behaviour suites live under `tests/behaviour/spend-*.test.ts` and `tests/behaviour/status-spend-*.test.ts`; shared fixtures live in `tests/fixtures/spend/` and `tests/fixtures/status/`; committed spend goldens live in `tests/golden/fixtures/spend/`.

| Level | Suites | Scope |
|---|---|---|
| Structure and contract | `tests/structure/spend-contract`, `spend-imports`, `error-table`, `content-inventory` | Declaration-only contracts, exact key sets and closed vocabularies, tier/boundary confinement, no forbidden imports, and inventory registration. |
| Behaviour — read and breakdown | `spend-read-contract`, `spend-breakdown`, `spend-degradation`, `spend-cost-omission` | Log-only reads with zero harness calls, five-class sums, null exclusion, degradation by reason, agent/model roll-ups, and cost absence. |
| Behaviour — absence and damage | `spend-absent`, `spend-store-damage` | Classified `spend.telemetry-absent` and each delivered `state.*` projection with no partial report. |
| Behaviour — phase attribution | `spend-phase-attribution`, `spend-phase-fallback`, `spend-phase-filter` | Capture-time windows, terminal attribution, the `unknown` fallback, `--phase` scoping and refusals. |
| Behaviour — restarts and amplification | `spend-restarts`, `spend-run-substrate`, `spend-amplification-healthy`, `spend-amplification-events`, `spend-amplification-determinism`, `spend-amplification-null`, `spend-disclosure` | Union-of-runs counting, exact-1 healthy anchor, one named event per superseded positive-spend run, tie-break and permutation invariance, zero-progress and no-record-bearing-run cases, and the disclosure text. |
| Behaviour — surface and bounds | `spend-envelope`, `spend-bounds`, `spend-determinism`, `spend-privacy`, `spend-grammar`, `spend-ref-resolution`, `spend-readonly` | Envelope shape, mode emphasis, byte/line bounds, byte-identical replay, privacy canaries, locked grammar, default-ref resolution, and the read-only proof. |
| Behaviour — digest flip | `status-spend-section`, `status-spend-degraded`, `status-spend-parity` | Section 8 observed/unknown projections, absence-of-capture line, `state-log` evidence, placeholder retirement, and command/digest parity. |
| Golden | `tests/golden/spend` | Healthy, restart-loop, degraded, and over-cap machine and human bytes, never rewritten by the suite. |
| Performance | `spend-performance` | Bounded fold latency and read counts at 1 000 and 10 000 records. |
| Mutant and invariant | `tests/checks/spend-mutants` | Every pinned formula, ordering, bound, and read-only rule fails when disabled. |
| Aggregate | `pnpm check` | The whole workspace. |

Fixtures inject deterministic clocks, run ids, fence tokens, and per-test temp state stores; tests never open a live harness store, resolve a credential, or use the network. A skip never counts as a pass.

## Operational & Support

### Configuration

The command has no configuration keys. Composition injects the delivery state store and the local PM-context read; the ref is an explicit flag or the active change context, never an ambient default.

### Observability

The report is its own observability surface: the envelope's `runId` and `timing`, the classified error code, the `degradation` disclosure, and the deterministic human digest. When the command-audit seam is injected, every `spend` invocation lands its normal audit records; an audit-write failure is a diagnostic and never changes the outcome or exit code. No telemetry exporter or background process is added.

### Retention and cost

The command writes nothing and retains nothing. Its recurring cost is the local verified read and the in-process fold; there is no network, provider, or capture cost.

## Dependencies & Risks

- **Depends on** the harness adapters and closeout capture ([feature-harness-adapters.md](feature-harness-adapters.md)) for the neutral telemetry record vocabulary, five token classes, warning reasons, and the capture point. No production composer is wired yet; until then a real store is telemetry-absent by contract.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for verified reads, presence tolerance, and classified `state.*` failures.
- **Depends on** the delivery registry ([feature-pm-notes-lint-and-phase-transitions.md](feature-pm-notes-lint-and-phase-transitions.md)) for timestamped `phase.transition` history.
- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, error table, exact-code classification, exit projection, and redaction chokepoint.
- **Feeds** the status digest ([feature-status-digest.md](feature-status-digest.md)) section 8 and is consumed later by alarm/burn-rate (M2-S6) and model-profile routing (M1-S21).
- **Risk — over-interpreting the ratio:** mitigated by the in-report honesty limits and the closed cause name.
- **Risk — coarse per-phase attribution:** a record's whole spend lands on one phase under the capture-time rule; the basis and the `unknown` fallback are named, and finer attribution is deferred.
- **Risk — restart undercount:** runs aborted before closeout capture are invisible; the evidence basis is disclosed, and lane economics later enriches restart evidence.
- **Risk — telemetry-absent dominance until capture is wired:** absence is the first-class classified outcome, and every reporting path is proven on fixtures.

## Glossary & References

| Term | Definition |
|---|---|
| Spend read side | The read-only fold over closeout-captured telemetry that produces the spend report; never a harness re-query. |
| Token class | One of the five delivered classes: `input`, `output`, `reasoning`, `cacheRead`, `cacheWrite`. |
| Phase window | An interval derived from `phase.transition` timestamps within which a record's captured-at stamp selects its phase attribution. |
| Capture-time attribution | The v0 basis assigning each record to the phase selected at its captured-at stamp. |
| Telemetry-absent | The classified outcome when the log holds no captured telemetry for the selection; exit 1. |
| Restart (v0) | A distinct delivery run beyond the first, counted over the union of run identities in both telemetry record families. |
| Progress run | The latest record-bearing captured run by captured-at descending with run-id ascending; its spend is the unique-progress denominator. |
| Amplification ratio | Paid tokens ÷ the progress run's tokens; exactly 1 for a healthy single positive-spend run, null when the progress run contributes zero tokens. |
| Amplification event | A named `restart-loop prefill re-pay` flag attributing a superseded run's spend as re-paid, with its window and `tokensWasted`. |
| Degradation | The disclosure block counting records with null classes or closed-vocabulary warnings and their reasons. |
| `state-log` | The status-digest evidence source id naming state-ledger-derived sections. |

## Related

- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the `spend` row, exit projection, and redaction.
- [State Layer](feature-state-layer.md) — verified reads, telemetry record families, and classified failures.
- [Harness Adapters](feature-harness-adapters.md) — the neutral telemetry vocabulary and closeout capture point.
- [Status Digest](feature-status-digest.md) — the section 8 projection fed by the same fold.
- [Closeout Transaction](feature-closeout.md) — the capture-side producer of the records read here.
- [PM-Notes Lint and Phase Transitions](feature-pm-notes-lint-and-phase-transitions.md) — the `phase.transition` history.
- [Glossary](../../overview/glossary.md) — repository-wide terms.
- [TDR-0011](../../decisions/TDR-0011-spend-resume-amplification-v0-formula.md) — the amplification formula, amendment, and stability contract.
- Change record: `doc/changes/2026-11/2026-11-07--GH-236--spend-read-side/`.
