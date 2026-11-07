---
ados_distribution: internal
id: SPEC-SESSION-LIFECYCLE-ECONOMICS
status: Current
created: 2026-11-07
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "Session lifecycle economics: adapter-sourced progress signals (heartbeat age, session traffic, token delta) projected into the unchanged watchdog signal shape with the exact-three liveness-kind vocabulary untouched, source-less lanes still classifying `watchdog.signals-absent` and no CPU signal anywhere; prefill/resume safety so a rising token delta or traffic classifies `progressing` and a stall requires the full corroboration; the classified `watchdog.liveness-stalled` refusal at exit 1; capability-driven attach-and-continue versus classified uneconomical re-entry; a durable per-delivery restart budget consumed by supervised-style and one-shot-style compositions through one gate, with the budget gate evaluated before evidence completeness, a loud `dispatch.restart-budget-exceeded` refusal, a terminal exhaustion record carrying the restart history, and a failed terminal append surfaced as `terminalAppendError`; additive `economics.restart` and `economics.budget-exhaustion` record kinds with no schema-version bump; a rebuildable per-delivery economics view deriving restart count, ordered history, and the resume-amplification signal with null-with-warning degradation; and the typed `lane.liveness-interval` and `lane.restart-budget` configuration branch."
links:
  related_changes: ["GH-235"]
  related_decisions: ["ADR-0003", "ADR-0008", "TDR-0004", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/economics.ts"
    - "packages/core/src/contracts/watchdog.ts"
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/config/catalog.ts"
---

# Feature: Session Lifecycle Economics

> **Role of this Document:** Source of truth for the delivered session lifecycle economics surface. It describes the signal-sourcing seam, the liveness and resume classifications, the durable restart budget, the economics records and view, the refusal-evidence carriage, and the lane configuration branch. Requirements live in the GH-235 change artifacts; this document describes current behavior.

## 1. Overview

The session lifecycle economics surface kills the resume-loop amplification class: a delivery that restarts repeatedly can re-pay its session prefill on every cycle. The feature makes progress-based liveness real by carrying adapter-sourced heartbeat age, session traffic, and token delta into the unchanged watchdog signal shape; classifies whether a resume attaches and continues or is refused as uneconomical; bounds restarts with a durable per-delivery budget consumed through one admission gate; and derives the restart count, restart history, and resume-amplification signal from durable records alone.

The machine surface stays inside the existing v1 envelope, the `{0, 1, 2}` exit taxonomy, and the closed error table. A fully corroborated stall is the classified refusal `watchdog.liveness-stalled` at exit `1`; `progressing` remains a success verdict at exit `0`; and a lane without signal sources keeps the `watchdog.signals-absent` answer at exit `2` — unknown, never guessed. Budget exhaustion is `dispatch.restart-budget-exceeded` and within-budget uneconomical re-entry is `dispatch.resume-uneconomical`, both at exit `1`, with bounded key=value evidence and the durable economics records as the resolvable full-history carrier.

The surface classifies, records, and refuses. It exposes no spawn, kill, steer, restart-execution, or supervision capability; the dispatch command, scheduler, daemon, queue marking, typed-question channel, and spend rendering are separate consumers.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** Without sourced progress signals, a stalled lane is indistinguishable from a progressing one; with naive sourcing, the largest resuming or prefilling session is exactly the session a liveness reading kills as stalled. Resuming without an economics check re-pays prefill at full token cost, restarts run without a durable bound, and exhaustion has no classified terminal state, so a degraded delivery can loop silently.
- **Affected Users:** Delivery coordinators and agents supervising lanes, operators investigating token spend, and the later queue, question, daemon, dispatch, and spend consumers.
- **Business Impact:** The resume-loop amplification class is the operator's largest measured token-waste incident class. A sourced, budgeted, evidence-bearing lifecycle makes the waste measurable, bounded, and terminal instead of silent.

### 2.2 Goals

- Make liveness evidence-based without changing the delivered liveness-kind vocabulary, the watchdog signal keys, or the stall bound.
- Guarantee that a prefilling or resuming session is never classified stalled: a rising token delta or traffic always classifies `progressing`.
- Classify every resume path as attach-and-continue, an admitted restart, an uneconomical refusal, or an unevaluable state — never a silent re-pay.
- Bound restarts durably and identically for supervised-style and one-shot-style paths, with a loud terminal exhaustion state carrying the restart history.
- Derive the per-delivery restart count, history, and amplification signal from state alone, degrading to `null` with a warning when a figure is unavailable.
- Keep every outcome inside the closed error table and the `{0, 1, 2}` exit taxonomy.

## 3. User Experience & Functionality

### 3.1 Capabilities

- **Sourced progress signals:** the harness adapter seam declares heartbeat age and token delta as additive sourced-signal sources beside the unchanged liveness kinds and carries their read-only readings; the neutral liveness assembly carries them additively, and the watchdog bridge projects heartbeat age, session traffic, and token delta into `heartbeatAgeMs`, `traffic`, and `tokenDelta`.
- **Prefill/resume liveness safety:** `stalled` requires the full corroboration — heartbeat age at or beyond the declared bound **and** token delta `0` **and** traffic `0`. Any partial reading and any rising delta or traffic classifies `progressing`.
- **Classified stall identity:** a fully corroborated stall returns `watchdog.liveness-stalled` on a failure envelope with no `data.verdict`, exit `1`, and the corroborating values in evidence.
- **Resume economics:** a declared attach capability resumes the existing session without re-paying prefill and consumes no restart ordinal; a re-entry that must re-pay prefill is admitted only while within budget and economical, and is otherwise refused with a classified reason.
- **Durable restart budget:** one `economics.restart` record per admitted restart, one terminal `economics.budget-exhaustion` record per delivery, and one admission gate composed by every resume path.
- **Economics view:** a rebuildable per-delivery fold yielding restart count, ordered restart history, the resume-amplification ratio, the `restart-loop` flag, degradation warnings, and the terminal record.
- **Lane configuration:** `lane.liveness-interval` (default `30000` ms) and `lane.restart-budget` (default `3` restarts per delivery) with existing configuration identities for invalid input.

### 3.2 Liveness evaluation

The watchdog liveness probe evaluates the declared signal shape from the composed signal source. The adapter-sourced composition assembles the neutral harness liveness report and projects its entries:

| Neutral entry | Declared watchdog key | Meaning |
|---|---|---|
| `session-traffic` | `traffic` | Observed session traffic. |
| `heartbeat-age` | `heartbeatAgeMs` | Elapsed milliseconds since the last sourced progress heartbeat. |
| `token-delta` | `tokenDelta` | Observed token delta since the prior observation. |

A signal with a source contributes its value; a signal without a source contributes no key and is never coerced to zero. There is no CPU field in the shape, no CPU-derived value in the evaluation, and no CPU signal source.

The classification is deterministic over the populated keys:

| Condition | Outcome |
|---|---|
| Heartbeat age at or beyond `WATCHDOG_STALL_HEARTBEAT_MS` (300000 ms), token delta `0`, and traffic `0` | `stalled` |
| Any present-signal combination that is not the full corroboration, including any rising token delta or traffic | `progressing` |
| The declared signal values are absent | Absent outcome, mapped to `watchdog.signals-absent` |

A large session that is prefilling or resuming has a rising token delta and/or traffic, so it classifies `progressing` at exit `0` with no kill and no restart event, regardless of its size or how long prefill takes. A corroborated stall is a classified refusal at exit `1`; absence remains the exit-`2` unknown answer and never triggers a stall response.

The watchdog composition accepts an injected `readSourcedSignals(lane)` seam over adapter-sourced facts. When the seam is supplied, the runtime composes the sourced bridge; when it is omitted, no source is declared and liveness keeps the absent answer. Lane-to-session fact acquisition belongs to the dispatch and session surfaces, not to the watchdog command.

### 3.3 Resume economics

Every resume attempt returns exactly one decision. Precedence is fixed:

1. **Capability.** An undeclared resume capability, or a declared capability whose attach mode is a gap, refuses `harness.capability.gap` at exit `1` naming the gap and session. A declared `attach-continue` capability continues at this step, reads no budget, and consumes no ordinal.
2. **Record availability and budget.** A path that must re-enter reads the delivery's verified records and evaluates the restart budget gate before evidence completeness and economics. An unreadable record set or an unevaluable gate refuses as `unevaluable` with its classified state identity and never admits. A delivery already at its bound refuses `dispatch.restart-budget-exceeded` at exit `1` and ensures the terminal exhaustion record exists — including when its token facts are unreadable or missing, so budget exhaustion always wins the classification.
3. **Evidence availability.** Unreadable token facts, an unreadable cost figure, or a missing prefill re-pay figure refuses `harness.telemetry.extraction-failed` at exit `1` naming the missing fact.
4. **Economics.** A re-entry that must re-pay prefill is economical only when the observed unique progress is a positive number and the re-pay total is at or below it. Otherwise it refuses `dispatch.resume-uneconomical` at exit `1` naming the reason and the re-pay token figure.
5. **Admission.** An economical re-entry appends one restart event with the next ordinal.

The two resume composition modes — `supervised` and `one-shot` — delegate to the same evaluation function and the same gate. They differ only in the composition label; refusal identity, reason, evidence, restart count, and history reference are identical.

### 3.4 Restart budget and records

The budget is per delivery and counts admitted restarts, not sessions, processes, or lanes. The gate folds the delivery's verified restart records, requires contiguous ordinals starting at `1`, and compares the count with the bound read at evaluation time. A changed resolved bound is observed on the next evaluation; no cached counter exists.

| Gate input | Decision |
|---|---|
| Count below the bound | `admit` with the current count, next ordinal, bound, and history reference |
| Count at or above the bound | `refuse-budget` with `dispatch.restart-budget-exceeded`, exit `1`, and the reason/restarts/history-reference corpus |
| Unreadable store, unknown record kind, torn or gapped ordinals, schema mismatch, missing keys, or permission denial | `unevaluable` with the classified state identity and a non-admitting decision |

An unevaluable gate never fabricates count `0`, never admits, and never falls back to `fallback.internal`. The permission-denied identity projects exit `1`; the remaining state identities project exit `2` per their delivered rows.

An admitted restart appends one `economics.restart` record through a fresh fence and reads it back before reporting success. A replay of the same `(run, ordinal)` appends nothing. A failed append is classified and never consumable as captured economics. The first refusal that observes exhaustion ensures the single terminal `economics.budget-exhaustion` record exists; later refusals re-read the same terminal truth and neither overwrite nor fork it.

When the terminal append itself fails, the budget refusal carries the classified failure additively as `terminalAppendError` — an `EconomicsRecordFailureCode` or `state.write.failed`. The refusal identity, exit, and evidence corpus are unchanged, so the field is the only signal that the escalation record did not land; a caller can never read the refusal as proof of durable terminal truth without checking it.

### 3.5 Economics view and amplification

The per-delivery view is a read-only fold over verified records:

| Field | Meaning |
|---|---|
| `restarts` | The number of verified restart events. |
| `restartHistory` | The restart entries ordered by ordinal, each carrying ordinal, reason, re-pay token classes when recorded, session identity, and recorded time. |
| `resumeAmplification` | Σ recorded re-pay tokens ÷ the latest observed unique-progress token figure; `null` when it cannot be derived. |
| `amplificationFlag` | `restart-loop` when the ratio is greater than the healthy baseline of `1`; otherwise `null`. |
| `warnings` | Closed degradation warnings, each naming the missing field and the record ordinal. |
| `terminal` | The delivery's terminal exhaustion record when one exists. |

A missing re-pay figure produces `missing-repay-tokens`; a missing or non-positive unique-progress figure produces `missing-unique-progress`. An incomplete derivation returns `resumeAmplification: null` with the warning — never a fabricated zero or an estimate. The view performs no harness-store query and appends nothing, so two fresh readers over the same records derive identical output.

### 3.6 Refusal evidence

Refusal evidence is a bounded, deterministic `key=value` corpus carried on the existing failure fields. It adds no structured field to the frozen error shape. Entries are joined by `; `, keys follow the declared fixed order per refusal class, and the total corpus is capped at 512 UTF-8 bytes. Values are counts, identities, and references only — never prompt text, transcript content, or secret material.

| Refusal class | Keys |
|---|---|
| Stall | `reason`, `heartbeatAgeMs`, `tokenDelta`, `traffic`, `stallBoundMs` |
| Budget exhaustion | `reason`, `restarts`, `historyRef` |
| Uneconomical resume | `reason`, `repayTokens`, `economicsRef` |
| Unevaluable economics | `reason`, `historyRef` |
| Capability gap | `reason`, `capability`, `session` |
| Incomplete evidence | `reason`, `field`, `historyRef` |

The budget and uneconomical references resolve to the delivery's durable records under the `economics/<workItemRef>` store key, so a consumer parses the bounded corpus for the immediate reason and resolves the full history through the record reference.

### 3.7 Outcome, identity, and exit matrix

| Outcome | Identity | Exit | Projection |
|---|---|---|---|
| Progressing from sourced signals | — (`data.verdict: "progressing"`) | `0` | Success |
| Fully corroborated stall | `watchdog.liveness-stalled` (failure envelope, no `data.verdict`) | `1` | Refusal |
| Signal sources absent | `watchdog.signals-absent` (no verdict) | `2` | Refusal |
| Restart admitted within budget | — (restart event recorded) | per owning surface | Record |
| Restart past budget | `dispatch.restart-budget-exceeded` | `1` | Refusal |
| Uneconomical resume | `dispatch.resume-uneconomical` | `1` | Refusal |

No outcome exits outside `{0, 1, 2}`, and exit `2` remains reserved for source-unavailable. Every refusal emits exactly one failure envelope; every success emits exactly one success envelope.

### 3.8 Configuration

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `lane.liveness-interval` | integer milliseconds | `30000` | The lane liveness evaluation cadence. Must be an integer greater than `0`. |
| `lane.restart-budget` | integer restarts per delivery | `3` | The per-delivery restart bound. Must be an integer greater than or equal to `0`; `0` is the valid admit-no-restarts policy. |

An absent `lane` branch resolves to both shipped defaults with `defaults` origins. An unknown key under `lane` fails `config.key.unknown`; a wrong type or an out-of-domain value fails `config.value.invalid` naming the key. Invalid input never silently falls back to the default. The values are policy data: resolving the branch starts no scheduler, and the gate reads the bound at evaluation time rather than capturing it at construction.

### 3.9 Edge cases

- A source-less lane — including a harness that declares its liveness kinds as gaps — classifies `watchdog.signals-absent` and never guesses a verdict.
- A partial liveness reading, including a stall-bound heartbeat with one progressing signal, classifies `progressing`.
- An unreadable economics store refuses; it is never read as an empty history.
- A duplicate or gapped restart ordinal is torn state, not a count.
- A restart past budget appends no restart event and performs no spawn.
- An uneconomical refusal leaves the existing session identity and records unchanged; it is a recorded decision, not a destructive act.
- A terminal exhaustion record is idempotent per delivery; a second refusal does not fork it.
- A failed terminal exhaustion append surfaces `terminalAppendError` on the budget refusal while the refusal identity, exit, and corpus stay unchanged.

## 4. Technical Architecture & Codebase Map

### 4.1 Contract home

`packages/core/src/contracts/economics.ts` is the one data-only home for the economics vocabulary:

- `ECONOMICS_SOURCED_SIGNAL_KINDS` — the additive closed sourced-signal kinds `heartbeat-age`, `token-delta`.
- `ECONOMICS_SOURCED_SIGNAL_ABSENCE_REASONS` — `harness-unsupported`, `not-observed`.
- `ECONOMICS_RESTART_REASONS` — `watchdog.liveness-stalled`, `session-interrupted`.
- `ECONOMICS_RESTART_RECORD_KIND` / `ECONOMICS_RESTART_SCHEMA_ID` — `economics.restart` / `delivery.economics.restart.v1`.
- `ECONOMICS_EXHAUSTION_RECORD_KIND` / `ECONOMICS_EXHAUSTION_SCHEMA_ID` — `economics.budget-exhaustion` / `delivery.economics.exhaustion.v1`.
- `ECONOMICS_RECORD_KEY_PREFIX` — `economics/`; the delivery key is `economics/<workItemRef>`.
- `ECONOMICS_EXHAUSTION_OPTIONS` — `requeue-fresh-budget`, `park-owner-review`.
- `ECONOMICS_OUTCOMES`, `ECONOMICS_OUTCOME_MATRIX`, and the exit constants — the declared outcome/identity/exit matrix.
- The view field and history field declarations, the amplification baseline and flag, the degradation-warning vocabulary, the evidence key orders and byte bound, and the injected store/policy port shapes.
- `EconomicsResumeDecision` — the per-attempt decision shape, including the additive `terminalAppendError` durability field on a budget refusal.

### 4.2 Pure domain

| Path | Responsibility |
|---|---|
| `packages/core/src/domain/economics-budget.ts` | `foldRestartRecords` and the single `evaluateRestartBudget` admission gate; fail-closed over unreadable, unknown, torn, or gapped records; no bound literal and no clock. |
| `packages/core/src/domain/economics-resume.ts` | Resume classification, `isEconomicalRepay`, the attach/refuse/admit decisions, and the supervised-style and one-shot-style compositions that delegate to the same gate. |
| `packages/core/src/domain/economics-view.ts` | The rebuildable per-delivery fold: count, ordered history, latest unique progress, amplification ratio, `restart-loop` flag, and degradation warnings. |
| `packages/core/src/domain/economics-evidence.ts` | The one deterministic `key=value` corpus formatter and parser, the fixed key orders, and the 512-byte bound. |
| `packages/core/src/domain/harness-liveness.ts` | The additive neutral liveness assembly and the watchdog bridge: sourced-signal entries beside the unchanged exact-three readings, all three declared keys projected, absent keys left absent. |

The domain modules are pure: no clock, randomness, environment, filesystem, or network access. Time and identities arrive as injected values; the store and policy arrive as injected ports. The run identity has one source: `ResumeEconomicsDeps.runId`. A resume attempt's input carries the work item, restart reason, and session evidence only.

### 4.3 State tier

`packages/core/src/state/economics.ts` composes the state port under the `economics/<workItemRef>` store key. It validates every payload, classifies torn and unknown record state, appends through a fresh fence, reads back before success, and folds verified records for the view. It follows the delivered `commit.telemetry` additive-record pattern and adds no schema-version bump, migration, or derived document.

### 4.4 Adapter and command seam

- `packages/core/src/contracts/harness.ts` carries the additive `sourcedSignalSources` and `sourcedSignalGaps` declarations and the optional `sourcedSignals` carriage on liveness facts and reports. `HARNESS_LIVENESS_KINDS` remains exactly `session-traffic`, `worktree-activity`, `process`.
- `packages/adapters/src/harness/opencode.ts` declares `session-traffic` and `process` as liveness sources and `heartbeat-age` and `token-delta` as sourced-signal sources; `worktree-activity` remains a declared gap. Injected sourced-signal facts are filtered to the declared sources and carried read-only into the assembly.
- `packages/adapters/src/harness/claude.ts` declares every liveness kind and both sourced-signal kinds as gaps (`provider-unsupported` / `headless-mode-limitation`). Declared gaps stay gaps.
- `packages/cli/src/commands/watchdog.ts` maps a fully corroborated stall to `watchdog.liveness-stalled` with the stall corpus, keeps `progressing` as success data, and keeps absent sources at `watchdog.signals-absent`.
- `packages/cli/src/edge.ts` composes the watchdog runtime; a supplied `readSourcedSignals` seam wires the sourced bridge over adapter facts.

### 4.5 Data model

| Record | Payload |
|---|---|
| `economics.restart` | `schemaId: delivery.economics.restart.v1`, work item, run, session identity, ordinal, restart reason, optional `repayTokens` token classes, optional observed unique-progress tokens (`null` when observed but unavailable), recorded time. |
| `economics.budget-exhaustion` | `schemaId: delivery.economics.exhaustion.v1`, work item, run, reason `dispatch.restart-budget-exceeded`, restart count, `historyRef`, `terminal: true`, the option pair, recorded time. |

The terminal record carries the fields the later consumers need: delivery identity, terminal state, classified reason, restart count, resolvable history reference, and the declared options.

### 4.6 Error-table rows

The error table declares the `dispatch` domain kind with exactly two economics identities and the fourth `watchdog` identity, bound in both directions with the documented rows in [Result Contract and Error Table](feature-result-contract.md):

| Code | Kind | Category | Retryable | Consequence | Projection | Exit |
|---|---|---|---|---|---|---|
| `watchdog.liveness-stalled` | `watchdog` | `user` | `false` | `not_landed` | `user-validation` | `1` |
| `dispatch.restart-budget-exceeded` | `dispatch` | `user` | `false` | `not_landed` | `user-validation` | `1` |
| `dispatch.resume-uneconomical` | `dispatch` | `user` | `false` | `not_landed` | `user-validation` | `1` |

Existing rows are unchanged. The dispatch command story's spawn-failure classification is not part of this table.

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| Determinism | Identical injected facts replay to identical verdicts, evidence corpora, records, and views. The domain reads no wall clock, randomness, locale, or ambient environment. |
| Bounded evidence | Every refusal carries a non-empty corpus of at most 512 UTF-8 bytes with stable keys; no prose-only or unbounded evidence. |
| No fabrication | Missing token, cost, or unique-progress figures degrade to `null` with a warning; absent signals stay absent; an unreadable store never becomes count `0`. |
| No re-query | The economics view derives from durable records alone; it performs no harness-store query and appends nothing. |
| No execution | The economics surface declares no spawn, kill, steer, restart-execution, or supervision operation and invokes none. |
| No CPU signal | No CPU field exists in the signal shape, no adapter maps a CPU fact, and a CPU-only reading cannot classify a verdict. |
| Closed surface | Every outcome emits exactly one valid envelope; exits stay in `{0, 1, 2}`; exit `2` is reserved for source-unavailable. |
| Additive state | The two record kinds live inside `delivery.state.v1`; no schema-version bump or migration exists. |
| Separation | Contracts are data-only, the domain is pure, per-harness sourcing lives in the adapter seam, and no product or binary literal appears in the surface. |

## 6. Quality Assurance Strategy

| Level | Suites | Scope |
|---|---|---|
| Structure | `tests/structure/economics-contract.test.ts`, `economics-imports.test.ts`, `economics-gate-seam.test.ts`, `error-table.test.ts` | Data-only contract homes, the exact-three liveness kinds with additive sourced kinds, one gate declaration, call-order dominance, tier and ambient boundaries, and the error-table rows. |
| Conformance | `tests/conformance/harness-liveness.test.ts` | The neutral report keeps the exact-three readings and carries sourced signals beside them; the bridge projects the declared keys and leaves absent keys absent. |
| Behaviour — liveness | `tests/behaviour/economics-liveness-sourcing.test.ts`, `economics-liveness-prefill.test.ts`, `economics-liveness-corroboration.test.ts`, `watchdog-liveness.test.ts`, `economics-envelope.test.ts` | Sourced wiring, the prefill matrix, the corroboration matrix, source-less absence, the stall identity, and the envelope/exit matrix. |
| Behaviour — economics | `tests/behaviour/economics-resume-*.test.ts`, `economics-restart-*.test.ts`, `economics-budget-*.test.ts`, `economics-exhaustion-record.test.ts`, `economics-view.test.ts`, `economics-amplification.test.ts`, `economics-degradation.test.ts` | Capability-first and budget-before-evidence precedence, attach/refusal decisions, durable records, process-boundary replay, path parity, fail-closed budget evaluation including a surfaced terminal-append failure, terminal-record fields, and view derivation. |
| Behaviour — config | `tests/behaviour/config-lane.test.ts`, `economics-budget-config.test.ts` | Defaults and origins, the invalid matrix, the budget `0` policy, and the evaluation-time bound. |
| Golden | `tests/golden/watchdog-output.test.ts`, `tests/golden/economics.test.ts` | Progressing, stalled, and absent envelopes in JSON and text mode; economics envelopes; narrow normalization; read-only goldens. |
| Checks | `tests/checks/economics-determinism.test.ts`, `economics-mutants.test.ts`, `forbidden-literals.test.ts`, `error-table-sync.test.ts` | Byte-identical replay, the eight guard mutants, brand/tier literals, and two-way error-table binding. |
| Structure behaviour | `tests/behaviour/economics-no-execution.test.ts` | No execution capability exists or is invoked across every fixture class. |

The binding checks are `scripts/checks/error-table-sync.ts` and `scripts/checks/forbidden-literals.ts`; the aggregate gate is `pnpm check`.

## 7. Operational & Support

### 7.1 Configuration

The lane branch is documented in [Configuration Layer and Inspection](feature-config-layer.md). The resolved interval is cadence policy data; no scheduler is started. The resolved restart budget is read by the gate at evaluation time through the injected budget-policy port, so a changed bound is observed without reconstruction.

### 7.2 Observability

The two record kinds are the observability substrate: restart count, per-restart re-pay, and amplification are durable, queryable data. Every refusal carries evidence naming the signals, reason, and history reference. Missing figures degrade with closed warnings rather than render zero. No new metrics, tracing, or alerting infrastructure is introduced.

### 7.3 Consumers and boundaries

The restart count, history, and amplification are the data the dispatch envelope declares (`restarts`, `resumeAmplification`), lane status renders, and spend consumes. Queue-entry failed-marking, typed-question publication and delivery, the daemon and its collection cycle, the dispatch command surface, and spend rendering are separate consumers of this substrate; the economics surface classifies, records, and refuses only.

Worktree-activity sourcing remains the declared opencode gap, and Claude Code's liveness gaps remain gaps. No state schema-version change, migration, or watchdog corroboration change exists.

## 8. Dependencies & Risks

- **Depends on** the watchdog liveness contract ([Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md)) for the verdict vocabulary, signal keys, stall bound, and the liveness command.
- **Depends on** the harness adapter seam ([Harness Adapters](feature-harness-adapters.md)) for capability declarations, the neutral liveness assembly, and read-only adapter facts.
- **Depends on** the result contract ([Result Contract and Error Table](feature-result-contract.md)) for the envelope, error table, and exit projection.
- **Depends on** the state layer ([State Layer](feature-state-layer.md)) for fenced verified appends, verified reads, and additive record kinds.
- **Depends on** the configuration layer ([Configuration Layer and Inspection](feature-config-layer.md)) for the lane branch.
- **Risk — prefill misclassification:** mitigated by the full-corroboration rule; a rising token delta or traffic always progresses.
- **Risk — noisy sourcing hides real stalls:** mitigated by evidence on every verdict and the declared bound; the bound stays configuration-adjacent without vocabulary change.
- **Risk — a resume path bypasses the gate:** mitigated by the single exported admission gate, call-order dominance, and the terminal record as durable truth.
- **Risk — over-refusal loses availability:** mitigated by preferring attach-and-continue and by naming the re-pay evidence; a fresh-budget requeue path remains available to the coordinator.

## 9. Glossary & References

| Term | Definition |
|---|---|
| Sourced signal | A heartbeat-age or token-delta observation carried beside the exact-three harness liveness kinds; absent when no source exists. |
| Sourced composition | The watchdog runtime composition over an injected `readSourcedSignals` seam that assembles the neutral liveness report and projects the declared signal keys. |
| Corroborated stall | The only combination that classifies `stalled`: heartbeat age at or beyond the bound, zero token delta, and zero traffic. |
| Restart budget | The per-delivery bound on admitted restarts, resolved from `lane.restart-budget` and folded from durable restart records. |
| Restart event | The `economics.restart` record appended per admitted restart, carrying ordinal, reason, session identity, and recorded re-pay. |
| Terminal exhaustion | The single `economics.budget-exhaustion` record per delivery, carrying the classified reason, restart count, history reference, and options. |
| Resume amplification | Σ re-pay tokens ÷ latest observed unique progress; above the baseline `1` it is flagged `restart-loop`. |
| Attach-and-continue | A resume that continues the existing session without re-paying prefill and without consuming a restart ordinal. |
| Uneconomical resume | A re-entry that would re-pay more prefill than the observed unique progress justifies; refused with `dispatch.resume-uneconomical`. |

See also: [Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md), [Harness Adapters](feature-harness-adapters.md), [Result Contract and Error Table](feature-result-contract.md), [State Layer](feature-state-layer.md), [Configuration Layer and Inspection](feature-config-layer.md), [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

**Change record:** `doc/changes/2026-11/2026-11-07--GH-235--session-lifecycle-economics/`.

## Scheduling engine reconciliation (GH-237)

The lane view consumes the delivered economics fold: restarts and the
resume-amplification signal are read, never recomputed, and an underivable value
is `null` with a warning rather than a fabricated zero. A lane failed past its
restart budget reports the closed `failed` state with reason
`restart-budget-exhausted`. See [Scheduling Engine](feature-scheduling-engine.md).
