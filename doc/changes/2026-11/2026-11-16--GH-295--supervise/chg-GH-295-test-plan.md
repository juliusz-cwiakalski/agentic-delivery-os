---
id: chg-GH-295-test-plan
status: Proposed
version: 1.3
created: 2026-11-16T23:50:00Z
last_updated: 2026-11-17T00:10:00Z
owners: [engineering]
service: delivery-os supervision plane (operator-facing supervise battery over the resident dispatch daemon's lanes)
labels: [change, m2, supervise, daemon, lanes, watchdog, queue, state]
version_impact: minor
summary: "Pin the M2-S2 supervise battery as comparisons over durable-record folds: one operator-invoked run over the invoking checkout's managed repository projects a schema-versioned `delivery.supervision.v1` report carrying the scope key, one tri-state entry per lane (ref, heartbeat, live holder) and per supervision claim, the actions applied, counts, degradation, and named truncation; classification is a pure artifact-evidence fold over delivered daemon/queue/dispatch/phase/commit records where only the full corroboration combination (heartbeat age at or beyond the delivered 300,000 ms bound AND zero artifact progress) reads `stalled`, any advancing evidence reads `progressing` (prefill-safe), and absent evidence reads `unknown` and is never guessed — with no process-derived field in the classification input shape at all; lying liveness (advancing heartbeats over a flat artifact trail) classifies stalled by artifact evidence (the ticket AC), a corroborated lane stall is parked through the delivered park machinery with the new `liveness-stall` cause mapped onto the delivered expiry-carrying condition type and a non-null `until`, so `lanes show <ref>` reads `state: parked`, `reason: parked:liveness-stall`, and the additive active-park `until` exactly when an expiry-carrying park is active; duplicate supervision is read-time only (per-ref double-claims refuse through the delivered `queue.single-flight` identity naming the holder, and the one appended duplicate-supervision identity fires as a per-action refusal against a supervision authority actively acting over the targeted object — its run projects the failure envelope at exit 1, while claim tri-states and holders always ride report data at exit 0, daemon presence alone refuses nothing, and a park intent is a non-claiming action refused by neither identity, DEC-8), restart admission rides the delivered budget and resume economics with terminal exhaustion plus a typed question, nothing is silently requeued, no process is ever signalled, the error table gains exactly two retryable identities bound in both directions, determinism replays byte-identically under an injected clock, one whole-store read fold per run holds, and a 200-lane run completes under 5,000 ms offline; the inherited milestone seeds SC-M2-S2-01 and SC-M2-S2-02 are reconciled per DEC-2 (`parkReason` to the delivered `reason` template, the seed `until` to DM-3) and mapped to concrete cases; the refusal gap this plan reported as GAP-T1 is closed by spec v1.1 DEC-8, so all 51 cases are fully specified and executable."
links:
  change_spec: ./chg-GH-295-spec.md
  implementation_plan: ./chg-GH-295-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S2: Supervise (M2)

## 1. Scope and Objectives

This plan protects one claim that the change exists to make true: **the supervision plane's answer about whether a delivery is alive is derived from durable artifacts, and a wrong answer is expensive in both directions.** A battery that reports `progressing` for a lane whose artifact trail has gone flat leaves a stuck supervisor untouched right up to the point where its stalled supervision makes the failure expensive; a battery that reports `stalled` for a resuming or prefilling lane parks a healthy delivery and spends the recovery budget it was meant to protect. A report that classified correctly but acted silently would leave the operator with a truth they cannot audit; a park that landed without a classified reason or a re-entry instant would make the board show a healthy lane while the ledger shows a park. A duplicate-supervision refusal that names nothing, or a restart path that requeues silently, turns a safety mechanism into a second source of double work. And a classification that accepted any process-shaped reading would quietly repeal the delivered no-CPU rule at exactly the plane whose job is to detect lying liveness.

Every property above is therefore asserted as a **comparison over payload bytes, appended-record counts, closed-set equality, counters, and exit codes** — never as a prose claim. Absence (no new record kind, no new event topic, no process signal, no second read fold) is proven the delivered way, in three forms together: a structural scan of the source, a recording seam that is asserted to have been called zero times, and a byte-or-count assertion on the durable tree.

The corpus is also deliberately built around the **composition boundary** this change sits on. The battery consumes four delivered families (daemon records and staleness fold, watchdog probes and corroboration bound, queue park/single-flight machinery, restart economics) and is forbidden to change any of them (NG-6, DEC-1, DEC-3). So roughly a third of the cases are non-regression assertions over delivered behaviour that must stay green *unchanged*, and the new behaviour's structure cases are written to fail if a constant is duplicated rather than imported.

This document is a verification map, not an execution claim. No case has been run against a new implementation at authoring time. Phase ownership belongs to `chg-GH-295-plan.yaml` (phase 4); this plan states the cases and the PASS definitions, and §7.4 states what evidence each delivery stage must leave behind.

### 1.1 In Scope

- The one battery invocation and its projection: grammar containment before any read, `--json` machine payload, human text rendered from the same evidence, the exclusive envelope and the `{0,1,2}` exit taxonomy, and the `delivery.supervision.v1` report shape (F-1; AC-F1-1; DM-1; DEC-6; SC-M2-S2-01).
- Scope discipline: the report names the invoking checkout's single managed repository key and no other repository, with entries bounded to that scope (F-1; AC-F1-1; NG-5).
- Tri-state derivation as a total, deterministic artifact-evidence fold: `progressing` / `stalled` / `unknown`, corroboration-bound `stalled`, prefill-safe `progressing`, truthful `unknown`, and an all-unknown scope projecting the classified evidence-absent outcome (F-2; AC-F2-1; DEC-4, DEC-5; NFR-1, NFR-6).
- Lying-liveness detection for lanes and for supervision claims, including the converse control that advancing artifacts defeat any process-shaped reading (F-3; AC-F3-1; the ticket AC).
- Consumption — not reimplementation — of the delivered watchdog probes, the delivered 300,000 ms corroboration bound, the no-CPU rule, and the signals-absent discipline (F-4; AC-F4-1; DEC-1; NFR-2).
- The supervised-stall park: one new cause value in the closed park-cause set, the declared many-to-one condition mapping, a non-null re-entry instant, the corroborating evidence on the record, the safe-boundary path for an actively held session, recovery only through the delivered classification, and the delivered `lanes show` read reflecting state, classified reason, and the additive `until` (F-5; AC-F5-1; DM-2, DM-3, DM-4; DEC-2, DEC-7; SC-M2-S2-02).
- Duplicate-supervision read-side truth: daemon instance claim, coordinator ledger-lease claim, live per-ref lease, each classified and named; per-ref double-claims refusing through the delivered single-flight identity with the holder named; delivered lock/lease/single-flight mechanisms unchanged; production composition still supervise-only (F-6; AC-F6-1; DEC-3).
- Restart-policy composition: admission through the delivered budget and resume economics, terminal exhaustion plus typed question, the declared unavailable outcome for an unevaluable admission, no silent requeue, and the never-signal discipline (F-7; AC-F7-1; DEC-7).
- Error-table binding: exactly two appended `supervise` identities with declared category, retryability, and exit projection; zero delivered rows changed; both-direction binding through the delivered check (F-8; AC-F8-1; DEC-6).
- Determinism, read bounds, truncation, latency, evidence totality, and offline isolation (NFR-3, NFR-4, NFR-5, NFR-6, NFR-7).
- Additivity: no new state record kind, no payload schema bump, no event taxonomy change, pre-change records replay unchanged (DM-4; EVT-1; §8.5, §19).
- The aggregate quality gate `TMPDIR=$PWD/tmp/tmpdir pnpm check` as the execution record for the whole battery.

### 1.2 Out of Scope & Known Gaps

- [OUT] A resident or scheduled supervision cadence (NG-1). No case drives a repeating battery; the daemon's resident cadence is only *consumed* as evidence and is asserted unchanged.
- [OUT] Lane delivery, composition, phase execution, or commit work from the battery (NG-2). No case asserts that a battery run starts, resumes, or steers a lane session; TC-SUP-044 and TC-SUP-063 assert the opposite.
- [OUT] Process management: pid scanning, signalling, kill-with-grace (NG-3). Asserted as absence; no case has a signal to observe.
- [OUT] A new event topic or kind (NG-4; EVT-1). The taxonomy drift/additivity suites are asserted to pass **unchanged**; no new topic fixture is added.
- [OUT] Multi-repository or host-wide aggregation (NG-5). TC-SUP-002 asserts the single-scope restriction; no aggregation case exists.
- [OUT] Changes to delivered daemon lock, coordinator lease, single-flight, watchdog checks, or queue/lease machinery (NG-6). Asserted as non-regression, never re-specified.
- [OUT] A durable supervision-claim record kind for cross-battery concurrency (OQ-1, RSK-2). No case asserts a claim record; the race residual is declared, not tested away.
- [OUT] Phase-7 documentation reconciliation *as a suite*. The first `supervise` feature page and the watchdog/daemon boundary-text reconciliation are verified by the testing strategy's content checks (manual traceability, link/path review, YAML/Markdown render review) and by the delivered doc-conformance check; TC-SUP-097 records that obligation as review-verified evidence, not as a new permanent assertion.
- [OUT] Commit hygiene, PR posture, and backlog marker maintenance. Recorded as gate/review evidence in §10.

Known gaps carried by this plan (detail and status in §8.3):

- **[GAP-T1 — resolved]** The duplicate-supervision refusal's *object granularity*, *projection*, and its composition with the AC-F5-1 safe-boundary park were reported as a blocking gap at plan v1.0 and are now **closed by spec v1.1 DEC-8** (targeted edits to F-6, F-8, G-5, AC-F6-1, DEC-6, §6 Flow 4, §18, §23). TC-SUP-051 and TC-SUP-092 are accordingly fully specified; no cell in this plan awaits a decision.
- **[GAP-T2 — naming, non-blocking]** DM-1 fixes the *semantics* of the report members but not their key spellings beyond the seed-fixed names. This plan pins `repo`, `lanes[].ref`, `lanes[].heartbeat`, `lanes[].holder` (seed) and `reason` / `until` (DEC-2, DM-3) as non-negotiable, and pins the remaining member names provisionally (AMB-2) so the golden is byte-exact; a divergence is a delivery finding, not a silent rename.
- **[GAP-T3 — no pre-change byte baseline]** No `supervise` surface or payload exists, so determinism cannot be asserted against a previous golden. It is asserted by paired runs plus replay from a captured record set, and the goldens are **created** (not regenerated) in this change.
- **[GAP-T4 — delivered evidence shapes are not restated]** The daemon instance/heartbeat/lane, queue lease/park, dispatch attempt, phase, and commit receipt/effect record shapes are consumed from the delivered contracts. Fixtures build them through the delivered app/state seams; a fixture that cannot resolve a seam **fails naming the missing contract** rather than falling back to a hand-built literal.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-295-spec.md`](./chg-GH-295-spec.md) | Binding source: F-1..F-8, AC-F1-1..AC-F8-1, DM-1..DM-4, EVT-1, NFR-1..NFR-7, RSK-1..RSK-6, DEC-1..DEC-8, OQ-1, G-1..G-7, §6 flows 1–5, §7 boundaries, §8.5 backward compatibility, §17 AC table and traceability paragraph. |
| [`chg-GH-295-pm-notes.yaml`](./chg-GH-295-pm-notes.yaml) | Delivery state, ticket AC restatement, the two inherited seeds as recorded at clarify_scope, delivered-dependency verification (M1-S1, M1-S18), and delivery conventions (gate command, PR target `main-tools`, commit body width). |
| [`chg-GH-295-plan.yaml`](./chg-GH-295-plan.yaml) | To be authored in phase 4. Phase ownership of these cases is declared there, not here. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Layers (static/diff, content, shell/tool, TypeScript workspace, invariants, boundaries, aggregate), module-to-test mapping, invariant-test authoring rules (no moving-base diffs; goldens regenerate only on explicit command; assert the value's meaning), and the aggregate gate. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict types, injected clock/environment, data-only contracts, pure domain, adapters own I/O, injected fakes over `mock.module`. |
| [M2 test scenarios](../../../planning/oss-tooling/milestones/m2/test-scenarios.md) | `SC-M2-S2-01` and `SC-M2-S2-02` verbatim bodies; reconciled in §3.4. |
| [M2 pack README](../../../planning/oss-tooling/milestones/m2/README.md) | Story-to-artifact map: "none in this pack" for M2-S2 architecture flow and contract surface; seeds are the inherited starting point. |
| [`feature-watchdog-lane-contracts.md`](../../../spec/features/feature-watchdog-lane-contracts.md) | §2.2 names supervise as the consumer of the probes; the no-CPU rule, the 300,000 ms stall bound, the signals-absent unknown answer, and the "checks never run/never supervise" boundary the battery must not contradict. |
| [`feature-resident-daemon.md`](../../../spec/features/feature-resident-daemon.md) | Instance/heartbeat/lane/reconciliation records as evidence, heartbeat-age staleness semantics, per-ref single-flight refusal naming the holder, safe-boundary preemption, and the supervise-only production composition. |
| [`feature-scheduling-engine.md`](../../../spec/features/feature-scheduling-engine.md) | Lanes, repo-exclusive leases and the fenced claim path; the lane projection (closed state set, `reason` as the `parked:<cause>` template over the closed park-cause set, the never-inferred `leaseHolder`, counts, bounds and truncation); the closed five-cause park vocabulary with per-type recheck and the declared cause→condition pairs; and the per-ref single-flight admission (`queue.single-flight`, holder at the envelope root) the refusal cases compose with. |
| [`feature-queue-ready.md`](../../../spec/features/feature-queue-ready.md) | The closed tri-state condition discipline with bounded evidence per condition, named blocking conditions, and the `unknown` rule (never coerced to satisfied, never a fabricated zero), plus the verified provider-park fold — the condition vocabulary and evidence shape the supervision tri-states and evidence follow. |
| [`feature-peak-pausing.md`](../../../spec/features/feature-peak-pausing.md) | The many-to-one cause→condition mapping precedent (`peak-window` riding the delivered `provider-window` condition type) that `liveness-stall` follows, the additive `parked:<cause>` projection entries, and the `until` classification rule (present on an expiry-carrying park, classified absence on a non-expiry park). |
| [`feature-result-contract.md`](../../../spec/features/feature-result-contract.md) | The exclusive envelope, the `{0,1,2}` exits, the closed union, the documented error table, and the binding check the two new rows must join. |
| [`feature-delivery-lifecycle.md`](../../../spec/features/feature-delivery-lifecycle.md) | Phase records, commit-artifact records, and attempt records — the artifact trail the fold reads. |
| [`feature-cli-entrypoint.md`](../../../spec/features/feature-cli-entrypoint.md) | The prompt-required family set, root/family help, `--version`, and the reference-page obligation for a new family. |
| **Delivered suites extended or reused as anchors** | `tests/structure/error-table.test.ts`, `tests/structure/daemon-vocabulary.test.ts`, `tests/structure/coordinator-no-cpu.test.ts`, `tests/structure/watchdog-contract.test.ts`, `tests/structure/queue-additivity.test.ts`, `tests/structure/queue-scheduling-contract.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json`, `tests/structure/daemon-production-composition.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/daemon-bounds.test.ts`, `tests/checks/help-guide-coverage.test.ts`, `tests/behaviour/queue-park-causes-s17.test.ts`, `tests/behaviour/daemon-single-flight.test.ts`, `tests/behaviour/daemon-lane-supervision.test.ts`, `tests/behaviour/coordinator-stuck-matrix.test.ts`, `tests/behaviour/coordinator-scenario.test.ts`, `tests/golden/lanes-show.test.ts`, `tests/golden/coordinator.test.ts`. |
| **Delivered harness seams reused** | `tests/fixtures/state/harness.ts` (`makeIdentity`, `makeTempRoot`, `openStore`, `removeRoot`); `tests/fixtures/watchdog/temp-git.ts` (real temporary repository with `git init -b main`, fixed author identity, live-workspace guard — extended for supervise); `tests/fixtures/queue/{single-flight,parks,lanes}/**`; `tests/fixtures/coordinator/{evidence,states}.ts`; `tests/fixtures/queue-ready/harness.ts` (`runProgram`, in-process CLI with captured buffers); `tests/fixtures/daemon/mount-golden/normalize.ts` (normalizer pattern); `tests/golden/helpers.ts`. |

## 3. Coverage Overview

Evidence classes used below: **Suite** (a committed assertion that runs under `pnpm check`), **Suite + mutation** (a suite assertion whose detection power is proven by a named in-place mutation performed in a temporary copy, never the live tree), **Golden** (a byte-exact committed artifact, normalized only for the temp repo root, run id, and timing), **Quality gate** (an execution record, not a permanent assertion), **Review-verified** (a diff/content inspection recorded in §10).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | One managed repository with an active lane; the battery runs and the report carries `repo` equal to that single managed repository key plus one lane entry with the lane's `ref`, last heartbeat observation, and live lease holder; the report names no repository other than its own scope key. (Seed `SC-M2-S2-01`.) | TC-SUP-001, TC-SUP-002, TC-SUP-004, TC-SUP-005, TC-SUP-090 | Suite; Golden | Covered |
| AC-F2-1 | Folded lanes and claims classify to exactly one of `progressing` / `stalled` / `unknown`: advancing evidence → `progressing`; the full corroboration combination (heartbeat age at/beyond the delivered 300,000 ms bound AND zero artifact progress across the span) → `stalled`; absent or insufficient evidence → `unknown`, never guessed or defaulted; no process-derived value exists in the classification input shape. | TC-SUP-010, TC-SUP-011, TC-SUP-012, TC-SUP-013, TC-SUP-014, TC-SUP-022, TC-SUP-023 | Suite; Suite + mutation | Covered |
| AC-F3-1 | A lane or supervision claim whose recorded liveness continues while the artifact trail shows no phase completion, no recorded commit, no attempt progress, and no ledger-position movement across the span classifies `stalled` by artifact evidence alone; conversely advancing artifact evidence keeps `progressing` regardless of any process-shaped reading. (Ticket AC.) | TC-SUP-020, TC-SUP-021, TC-SUP-022, TC-SUP-054 | Suite; Suite + mutation | Covered |
| AC-F4-1 | The battery consumes the delivered watchdog probes, classification, corroboration bound, and prefill-safe rule instead of reimplementing them; an absent signal source contributes `unknown` rather than a coerced zero; no CPU-shaped or other process-shaped fact enters any evaluation. | TC-SUP-030, TC-SUP-031, TC-SUP-032, TC-SUP-014 | Suite; Suite + mutation | Covered |
| AC-F5-1 | A lane with a heartbeat beyond the stall threshold and a corroborating flat artifact trail is recorded as parked through the delivered park machinery with the classified supervised-stall cause and a non-null re-entry instant; `lanes show` reports state `parked`, the classified reason, and the active park's re-entry instant. (Seed `SC-M2-S2-02`.) | TC-SUP-040, TC-SUP-041, TC-SUP-042, TC-SUP-045, TC-SUP-046, TC-SUP-047, TC-SUP-091, TC-SUP-093 | Suite; Golden; Suite + mutation | Covered |
| AC-F6-1 | Live supervision claims intersecting the scope (daemon instance claim live under the delivered heartbeat-staleness fold, coordinator ledger-lease claim, live per-ref lease naming its holder) are carried with tri-state and holder **whether or not any action is refused**; an action that would double-claim a ref with a live holder is refused with the holder named through the delivered single-flight identity; an action whose object another supervision authority is **actively acting on** is refused with the duplicate-supervision identity naming the live claim and holder, and that run projects the failure envelope at exit `1` while a run whose actions all succeed (or need none) reports data at exit `0` even with live claims present; a live resident daemon's existence alone refuses nothing; a park intent, including its safe-boundary intent path, is refused by neither identity and lands through the delivered fenced append; no delivered lock/lease/single-flight mechanism changes; no lane composition is required. (DEC-8.) | TC-SUP-050, TC-SUP-051, TC-SUP-052, TC-SUP-053, TC-SUP-054, TC-SUP-092 | Suite; Golden | Covered |
| AC-F7-1 | A stalled lane with budget remaining admits a restart through the delivered budget and resume economics and appends the delivered restart record; on exhaustion the delivered terminal exhaustion record lands and the typed question is raised; exhaustion never silently requeues, an unevaluable admission is reported as the declared unavailable outcome, and no process is ever signalled. | TC-SUP-060, TC-SUP-061, TC-SUP-062, TC-SUP-063, TC-SUP-044 | Suite | Covered |
| AC-F8-1 | Exactly two identities are appended to the closed union (duplicate-supervision refusal at exit `1`, retryable; evidence-absent unknown answer at exit `2`, retryable); every other outcome reuses a delivered identity; no delivered row changes; machine rows, documented rows, and the corpus are bound in both directions by the delivered binding check. | TC-SUP-070, TC-SUP-071, TC-SUP-072, TC-SUP-092 | Suite; Suite + mutation; Golden | Covered |

Ticket-to-criteria mapping carried verbatim from spec §17: ticket AC ("a stuck supervisor is detected by artifact evidence, not process state") → AC-F3-1, reinforced by AC-F2-1 and AC-F6-1 (cases TC-SUP-020, TC-SUP-021, TC-SUP-010, TC-SUP-050). Ticket tasks map: tri-state status → AC-F2-1; progress watchdogs → AC-F4-1; duplicate-supervisor detection → AC-F6-1; lying-liveness signals by artifact evidence → AC-F3-1; restart policies over the resident dispatch daemon → AC-F7-1; supervisor battery and the stall park → AC-F1-1, AC-F5-1.

Goal coverage (spec §4): G-1 → AC-F1-1, AC-F2-1; G-2 → AC-F2-1, AC-F4-1 (TC-SUP-014, TC-SUP-022); G-3 → AC-F3-1 (TC-SUP-020, TC-SUP-021, TC-SUP-022); G-4 → AC-F5-1 (TC-SUP-040, TC-SUP-041); G-5 → AC-F6-1 (TC-SUP-050, TC-SUP-052, TC-SUP-053); G-6 → AC-F7-1 (TC-SUP-060, TC-SUP-061, TC-SUP-063); G-7 → AC-F1-1, AC-F2-1, AC-F8-1, DEC-6 (TC-SUP-012, TC-SUP-013, TC-SUP-072).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP surface is added or changed (spec §8.1), so there is no API-# family. The local command surface and the consumed local reads are covered as follows.

| ID | Element | TC ID(s) | Notes |
|----|---------|----------|-------|
| DM-1 | Supervision report payload `delivery.supervision.v1`: scope key; `lanes[]` (ref, tri-state, last heartbeat observation, live holder present exactly when a live lease exists, evidence); `supervisors[]` (claim identity, tri-state, last heartbeat observation, scope evidence); `actions[]` with evidence; counts; degradation markers; bounded truncation with a named reason; the run's recorded instant. | TC-SUP-001, TC-SUP-004, TC-SUP-050, TC-SUP-082, TC-SUP-090, TC-SUP-091, TC-SUP-094 | Shape totality (TC-SUP-004), one-home member declaration (TC-SUP-094), goldens (TC-SUP-090, TC-SUP-091), truncation (TC-SUP-082). |
| DM-2 | Supervised-stall park cause `liveness-stall`: one declared value appended to the closed cause set; mapped onto the delivered condition type whose evaluable shape carries an absolute re-entry instant; the park names corroborating evidence and carries a non-null `until` at the declared stall recheck horizon; re-evaluation rides the mapped condition type's declared recheck default. | TC-SUP-040, TC-SUP-041, TC-SUP-042, TC-SUP-045, TC-SUP-046, TC-SUP-091, TC-SUP-093 | Closed-set equality both directions; mapping and recheck default asserted from the delivered constants, not hard-coded. |
| DM-3 | Active-park re-entry instant on the lane projection: additive optional `until`, present exactly when an active expiry-carrying park exists, absent otherwise, never inferred or defaulted. | TC-SUP-041, TC-SUP-042, TC-SUP-093 | Includes the negative twin (owner-hold/parked-without-expiry carries no `until`). |
| DM-4 | Additive record discipline: no new record kind; appends only through the delivered park/restart/terminal-exhaustion paths; no in-place mutation, no schema bump, no migration. | TC-SUP-046, TC-SUP-061, TC-SUP-094 | Record-kind set equality and pre-change replay. |
| EVT-1 | No new topic and no new event kind; a supervised stall park is visible through the delivered lanes snapshot projection on the next publish. | TC-SUP-041 (projection half), TC-SUP-094 (taxonomy half) | The projection assertion consumes the delivered publish frame; the taxonomy assertion is the delivered drift/additivity suites passing **unchanged**. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (abridged) | TC ID(s) | Evidence |
|-----|------------------------|----------|----------|
| NFR-1 | `stalled` only on heartbeat age ≥ 300,000 ms AND zero artifact progress across the span; partial/advancing → `progressing`. | TC-SUP-010, TC-SUP-011, TC-SUP-023, TC-SUP-030 | Matrix cells at just-below / at / just-above the bound with flat and advancing trails. |
| NFR-2 | Evidence purity: no pid, process start time, or CPU field in the classification input shape; a process-only reading can never classify a verdict — asserted structurally, like the delivered watchdog no-CPU rule. | TC-SUP-014, TC-SUP-022, TC-SUP-054, TC-SUP-063 | Source scan (marker list), shape-member equality, behavioural CPU/pid-shaped twin. |
| NFR-3 | Determinism: identical record sets + injected clock → identical report, evidence, actions, exit; evidence names refs, record kinds, instants, codes. | TC-SUP-080, TC-SUP-090, TC-SUP-091 | Paired runs, replay from a captured record set, byte-exact goldens. |
| NFR-4 | One whole-store read fold per run; 200-lane cap with explicit truncation and a named reason; evidence respects the delivered evidence caps. | TC-SUP-081, TC-SUP-082 | Recorded read count == 1; 201 lanes → 200 entries + `truncated` + named reason; evidence byte cap. |
| NFR-5 | A full run at the 200-lane cap completes within 5,000 ms wall-clock in the offline behaviour suite. | TC-SUP-083 | Single measured run with a non-vacuous bound; no percentile smoothing. |
| NFR-6 | Every tri-state entry, every action, and every refusal carries non-empty evidence; failure evidence rides the failure summary, success evidence rides the report fields. | TC-SUP-084, TC-SUP-012, TC-SUP-092 | Completeness control over a mixed-scope fixture plus the failure envelopes. |
| NFR-7 | Offline: every behaviour runs against a real temporary repository with injected clock, brand, and run identity; no network anywhere; a fixture guard rejects any root equal to the live workspace. | TC-SUP-085, TC-SUP-001 | Guard rejection assertions (live root, non-temp root) and a no-network recording seam. |

### 3.4 Inherited Seed Reconciliation (SC-M2-S2-01, SC-M2-S2-02)

Both seeds are inherited by name from the M2 pack and are reproduced here exactly as they assert. Per DEC-2 the second seed's label meets the delivered vocabulary and is reconciled, not restated; the reconciliation is recorded as a binding table so no case silently invents a field.

| Seed | Seed assertion (verbatim) | Reconciled form in this plan | Cases |
|---|---|---|---|
| `SC-M2-S2-01` — Supervision battery reports lane liveness per repository | "`supervise.data.lanes[]` has one entry with `ref`, `heartbeat`, and `holder`, and `supervise.data.repo` equals the single managed repo key." | No change of label is required: the new payload's scope member is `data.repo` and its lane entry carries `ref`, `heartbeat` (the lane's last heartbeat observation, the recorded instant — not an age and not a process reading), and `holder` (the recorded live-lease holder, present exactly when a live lease exists, equal to the lease's recorded holder, never inferred). "Single managed repo key" is the same key the delivered per-repository surfaces report for the invoking checkout. The seed's completeness control adds the positive restriction: the payload names **no** other repository. | TC-SUP-001 (seed), TC-SUP-002 (scope completeness control), TC-SUP-090 (golden) |
| `SC-M2-S2-02` — Supervise parks a stalled lane with a classified reason | "`lanes show <ref>.data.state == "parked"` with a classified `parkReason` and a non-null `until`." | **Reconciled per DEC-2**: `parkReason` maps to the delivered lane `reason` field, which carries the delivered `parked:<cause>` template; the classified value is therefore `reason == "parked:liveness-stall"` — the new cause `liveness-stall` joined to the closed set, mapped onto the delivered condition type whose evaluable shape carries an absolute re-entry instant (`provider-window`), with the mapped condition type's declared recheck default governing re-evaluation. The seed's `until` maps to DM-3's additive lane-read `until`: non-null on a parked lane iff an active expiry-carrying park exists, equal to the park record's `until`, never inferred, never defaulted, absent (not null) otherwise. The park record itself is unchanged in kind and appends a non-null `until` plus the corroborating evidence. | TC-SUP-040 (seed), TC-SUP-041 (seed read half), TC-SUP-042 (additivity negative twin), TC-SUP-091 / TC-SUP-093 (goldens) |

Concrete reconciled steps (both seeds share the fixture shape; the assertions differ):

1. Build a real temporary repository with `git init -b main`, a fixed author identity, and one managed-repository key; open the delivered state store inside it; assert the fixture root is not the live workspace.
2. Seed, through the delivered append/state seams, one active lane `GH-295` with a recorded heartbeat at the injected clock's `now - 120_000 ms` (seed 01) or `now - 300_000 ms` and a flat artifact trail across the span (seed 02), plus a live lease naming holder `holder-a` (seed 01 only) and a foreign repository's records in the same store (scope control, seed 01).
3. Run the battery once through the in-process program runner with an injected clock, brand, run id, and captured stdout/stderr buffers; assert `exit 0` and exactly one read fold over the store.
4. **Seed 01 assertions**: `data.schemaVersion == "delivery.supervision.v1"`; `data.repo` equals the managed key; `data.lanes` has length 1; that entry's `ref`, `heartbeat`, and `holder` equal the seeded values exactly; its tri-state is `progressing`; its `evidence` is non-empty and references only refs/record kinds/instants/codes bounded to the scope; no string in the serialized payload equals or contains the foreign repository key; `counts` agree with the entries.
5. **Seed 02 assertions**: exactly one park record appends with `cause == "liveness-stall"`, `conditionType == conditionTypeForCause("liveness-stall")` (asserted through the delivered resolver, not a literal), `until` non-null and equal to the declared stall recheck horizon from the injected clock, `recheckMs` equal to the mapped condition type's declared default, and non-empty corroborating evidence; `data.actions` names the action with evidence; `exit 0`; then `lanes show GH-295 --json` reads `state == "parked"`, `reason == "parked:liveness-stall"`, `until` equal to the park's `until`, and `counts.parked == 1`; the human render carries the same three facts.

Reconciliation note: the seeds are the *minimum*. They do not cover supervision-claim entries, the unknown answer, lying-liveness on a claim, refusal identities, restart composition, determinism, bounds, latency, evidence totality, additivity, or mounting. Those arrive as new cases in this plan, declared in §5 and recorded in §9.

## 4. Test Types and Layers

### 4.1 Layers used

| Layer | Location | Runner | Used for |
|---|---|---|---|
| Static/diff | — | `git diff --check`; changed-file convention review | Whitespace/conflict guard on every touched file; path/naming conventions for the new family. |
| Structure | `tests/structure/*.test.ts` | `bun test tests/structure` (inside `pnpm test`) | Exact closed vocabularies and their order, one-home constants (schemas, member sets, bound import, cause→condition pairs), data-only contract modules, no-process-field input shape, no duplicated 300,000 ms literal, inventory/export registration, record-kind and event-taxonomy additivity, delivered boundaries unchanged. |
| Behaviour | `tests/behaviour/*.test.ts` | `bun test tests/behaviour` | The battery as a real run: real temporary repository (`mkdtemp` + `git init -b main`), injected clock/brand/run id, captured stdout/stderr buffers, one whole-store read fold, classification cells, park appends, `lanes show` reads, refusals, restart composition, determinism, bounds, latency, offline isolation. |
| Golden | `tests/golden/*.test.ts` + `tests/fixtures/supervision/golden/**` | `bun test tests/golden` | Committed normalized envelopes: healthy report (machine + human), stalled/parked report, evidence-absent failure envelope, and the parked `lanes show` payload with the additive `until`. |
| Repository invariant checks | `scripts/checks/*.ts` (+ `tests/checks/*.test.ts` mutation suites) | `bun run scripts/checks/<check>.ts`; mutation suites in `bun test tests/checks` | The error-table binding check in both directions with its documented rows and true/false-positive corpora; bounds and evidence-cap behaviour where the delivered pattern lives in a check; help-guide coverage for the new family. |
| Boundaries | `tests/boundaries` + `check:boundaries` | `bun test tests/boundaries`; `depcruise packages` | Supervise domain stays pure (no I/O, no clock, no process), adapters own I/O, no undeclared cross-package edge, no ambient-global read. |
| Content (docs) | `doc/spec/**` reconciliation | manual review + delivered doc-conformance test | The first `supervise` feature page and the watchdog/daemon boundary-text reconciliation (TC-SUP-097). |
| Quality gate | repository root | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Aggregate evidence for the change (`lint → format:check → typecheck → test → check:boundaries → check:memory → prompt-conformance → help-guide-coverage → exports-parity`). |

### 4.2 Layer obligations that are not scenario-shaped

- **Mutation discipline.** Every structure/vocabulary guard that protects a closed set or a count pin is accompanied by a named mutation performed in a temporary copy (`mkdtemp`), never in the live tree: duplicate the cause, rename the mapping target, duplicate the bound literal, add a third `supervise` error row, drop a documented row, drop a corpus row, add a process-shaped field to the input shape. Each mutation must make its case fail with the offending field named.
- **No moving-base assertions.** No case compares against `origin/main-tools...HEAD`. Count pins are asserted as deltas against a captured base constant plus a repo-wide scan for stale pins (the delivered family-count discipline), so the suite survives later deliveries.
- **Goldens are created, then regenerated only on explicit command.** A normalized golden is updated deliberately in review; a blanket rewrite of `tests/fixtures/supervision/golden/**` is a review finding.
- **Fixture honesty.** No hand-built record literal where a delivered seam exists (GAP-T4); a fixture that cannot build its record fails loudly rather than approximating the shape.

### 4.3 Structure coverage obligations (permanent)

| Obligation | Assertion |
|---|---|
| One home for the report shape | `SUPERVISION_SCHEMA_VERSION`, the report member set, the tri-state set, and the claim-kind set are declared once in a data-only contract module; the structure case asserts exact member names and a data-only AST shape (declarations, imports, no executable statement, no `node:`/`bun:` runtime import). |
| Exact closed vocabularies | `SUPERVISION_STATES == ["progressing", "stalled", "unknown"]` exactly and in order; every report entry's classification is one of these; no fourth value and no synonym. |
| Bound is imported, never copied | No `300_000` / `300000` supervision literal; the corroboration bound resolves to the delivered `WATCHDOG_STALL_HEARTBEAT_MS`. Mutant: re-introduce the literal → case fails naming the file. |
| Cause set is additive and exact | `QUEUE_PARK_CAUSES` is the delivered five **plus** exactly `liveness-stall`, in position, with the delivered five unchanged; `QUEUE_PARK_CONDITION_TYPES` unchanged; the pair table is the delivered five plus exactly one row mapping `liveness-stall` to the expiry-carrying delivered type; `QUEUE_PARK_RECHECK_DEFAULTS` gains no new key. |
| No new record kind, no schema bump | The state record-kind set and every delivered payload schema version are unchanged; the park payload schema version is unchanged; the new report payload is the only new schema identity. |
| Event taxonomy unchanged | No new topic/kind in the delivered declared sets; the delivered taxonomy drift/additivity suites pass without edits. |
| No process-derived input | The classification input shape's member set is exact and contains no pid/start-time/CPU member; the supervise domain/state/CLI source carries no CPU/pid marker; the delivered no-CPU guard is extended, not forked. |
| Scope purity | The scope key is the only repository identity the fold can emit; the source scan finds no second-repository read path in the supervise modules. |
| Inventory and export registration | New source files are registered in `tests/structure/inventory.json`; the contract export inventory (`tests/structure/content-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`) is updated in the same change; the inventory test fails on an unregistered export. |
| Mounting | Root help lists the new family and the family-count delta is asserted against one captured base constant plus a stale-pin scan; family help answers `--help` and `--version`; the reference page exists (help-guide coverage check); the family carries no product/binary literal outside the branding seam. |
| Delivered postures unchanged | Daemon production composition still `supervise-only`; the watchdog surfaces still never supervise; the coordinator's ledger lease is still the only coordinator single-instance ownership; per-ref single-flight semantics unchanged. |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-SUP-001 | Seed SC-M2-S2-01: one run reports one lane's ref, heartbeat, and holder under the scope key | Happy Path | Behaviour | High | AC-F1-1 |
| TC-SUP-002 | The report names no repository other than its own scope key | Edge Case | Behaviour + Golden | High | AC-F1-1 |
| TC-SUP-003 | Grammar containment refuses an extra positional or unknown flag before any read; human text renders from the same evidence | Negative | Behaviour | High | AC-F1-1, AC-F8-1 |
| TC-SUP-004 | Report shape is total over empty, single, and many-lane scopes | Happy Path | Behaviour | High | AC-F1-1, DM-1 |
| TC-SUP-005 | A readable store with no records yields an empty evidence-complete report, not a guessed verdict | Corner Case | Behaviour | Medium | AC-F1-1, AC-F2-1 |
| TC-SUP-010 | The classification matrix is total, deterministic, and artifact-only | Happy Path | Behaviour | Critical | AC-F2-1, NFR-1, NFR-6 |
| TC-SUP-011 | Prefill/resume cells: any advancing evidence reads `progressing` | Edge Case | Behaviour | Critical | AC-F2-1, AC-F3-1 |
| TC-SUP-012 | `unknown` is truthful, carries evidence of absence, and is never defaulted | Edge Case | Behaviour | Critical | AC-F2-1, NFR-6 |
| TC-SUP-013 | An all-unknown scope projects the classified evidence-absent outcome at exit 2 | Corner Case | Behaviour + Golden | High | AC-F2-1, AC-F8-1, DEC-6 |
| TC-SUP-014 | The classification input shape declares no process-derived field, structurally | Regression | Structure | Critical | AC-F2-1, AC-F4-1, NFR-2 |
| TC-SUP-020 | Lying lane: advancing heartbeats over a flat artifact trail reads `stalled` (ticket AC) | Negative | Behaviour | Critical | AC-F3-1 |
| TC-SUP-021 | Lying supervisor claim: continuing liveness with flat supervision artifacts reads `stalled` | Negative | Behaviour | Critical | AC-F3-1 |
| TC-SUP-022 | Advancing artifacts defeat any process-shaped reading | Corner Case | Behaviour | Critical | AC-F3-1, NFR-2 |
| TC-SUP-023 | Corroboration bound cells: below / at / above 300,000 ms with zero progress | Edge Case | Behaviour | Critical | AC-F2-1, NFR-1 |
| TC-SUP-030 | The delivered bound, verdict family, and probes are consumed, not reimplemented | Regression | Structure | High | AC-F4-1, NFR-1 |
| TC-SUP-031 | An absent signal source contributes `unknown`, never a coerced zero | Edge Case | Behaviour | High | AC-F4-1 |
| TC-SUP-032 | The delivered prefill-safe rule and signals-absent discipline are reused, not forked | Regression | Structure + Behaviour | High | AC-F4-1 |
| TC-SUP-040 | Seed SC-M2-S2-02: a corroborated stall appends a `liveness-stall` park with a non-null `until` | Happy Path | Behaviour | Critical | AC-F5-1, DM-2 |
| TC-SUP-041 | `lanes show` reports state `parked`, reason `parked:liveness-stall`, the active `until`, and the snapshot projection follows | Happy Path | Behaviour + Golden | Critical | AC-F5-1, DM-2, DM-3, EVT-1 |
| TC-SUP-042 | The additive `until` is present exactly when an expiry-carrying park is active | Edge Case | Behaviour | High | AC-F5-1, DM-3 |
| TC-SUP-043 | A stall over an actively held session records durable intent and parks at the safe boundary, signalling nothing | Corner Case | Behaviour | Critical | AC-F5-1, AC-F7-1, DEC-7 |
| TC-SUP-044 | A parked stall lane recovers only through the delivered classification — never a scratch re-dispatch or silent requeue | Negative | Behaviour | Critical | AC-F5-1, AC-F7-1 |
| TC-SUP-045 | The cause joins the closed set additively with exactly one declared condition mapping | Regression | Structure | Critical | AC-F5-1, DM-2, RSK-1, RSK-6 |
| TC-SUP-046 | No new record kind, no schema bump, and pre-change records replay unchanged | Regression | Structure + Behaviour | High | AC-F5-1, DM-4 |
| TC-SUP-047 | The park carries its corroborating evidence so a wrong park is auditable | Edge Case | Behaviour | High | AC-F5-1, RSK-3 |
| TC-SUP-050 | Live supervision claims are inventoried with tri-state, holder, and scope evidence | Happy Path | Behaviour | Critical | AC-F6-1 |
| TC-SUP-051 | A per-action double-act against an actively acting authority is refused naming the live claim and holder; presence alone refuses nothing | Negative | Behaviour | Critical | AC-F6-1, AC-F8-1, DEC-8 |
| TC-SUP-052 | A per-ref double-claim is refused through the delivered single-flight identity with the holder named | Negative | Behaviour | Critical | AC-F6-1, DEC-8 |
| TC-SUP-053 | The delivered lock, lease, single-flight, and supervise-only composition are unchanged | Regression | Structure + Behaviour | Critical | AC-F6-1, NG-6, DEC-3 |
| TC-SUP-054 | Duplicate detection reads records only: zero process-port, pid, or CPU reads | Regression | Structure + Behaviour | Critical | AC-F3-1, AC-F6-1, NFR-2 |
| TC-SUP-060 | Restart admission rides the delivered budget and appends the delivered restart record | Happy Path | Behaviour | Critical | AC-F7-1 |
| TC-SUP-061 | Exhaustion is terminal and loud: exhaustion record plus typed question, no silent requeue | Negative | Behaviour | Critical | AC-F7-1, DM-4 |
| TC-SUP-062 | An unevaluable admission reports the declared unavailable outcome | Corner Case | Behaviour | High | AC-F7-1 |
| TC-SUP-063 | The never-signal discipline holds: no kill, spawn, or signal seam is reached | Regression | Structure + Behaviour | Critical | AC-F7-1, DEC-7, NG-3 |
| TC-SUP-070 | Exactly two `supervise` identities are appended and no delivered row changes | Regression | Structure | Critical | AC-F8-1 |
| TC-SUP-071 | Machine rows, documented rows, and corpus bind in both directions | Regression | Checks + Mutation | Critical | AC-F8-1, RSK-6 |
| TC-SUP-072 | Every other outcome reuses a delivered identity with the declared exit | Edge Case | Structure + Behaviour | High | AC-F8-1, DEC-6 |
| TC-SUP-080 | Identical record sets and an injected clock replay to an identical report, evidence, actions, and exit | Regression | Behaviour | Critical | NFR-3 |
| TC-SUP-081 | One whole-store read fold per run, and no per-lane re-read | Regression | Behaviour | High | NFR-4 |
| TC-SUP-082 | The report caps at 200 lanes with explicit truncation and a named reason; evidence respects its caps | Edge Case | Behaviour | High | NFR-4 |
| TC-SUP-083 | A full run at the 200-lane cap completes under 5,000 ms offline | Performance | Behaviour | High | NFR-5 |
| TC-SUP-084 | Every entry, action, and refusal carries non-empty evidence | Corner Case | Behaviour | Critical | NFR-6 |
| TC-SUP-085 | Offline isolation: the fixture guard rejects the live workspace and no network surface is reached | Regression | Behaviour | High | NFR-7 |
| TC-SUP-090 | Healthy report golden: machine and human are byte-identical after normalization | Happy Path | Golden | High | AC-F1-1, DM-1, NFR-3 |
| TC-SUP-091 | Stalled-and-parked report golden: entries, action, evidence, and counts | Happy Path | Golden | High | AC-F5-1, DM-1, DM-2 |
| TC-SUP-092 | Failure-envelope and live-claims data goldens: per-action refusal (exit 1) and the report with claims present (exit 0) | Negative | Golden | High | AC-F2-1, AC-F6-1, AC-F8-1, DEC-6, DEC-8 |
| TC-SUP-093 | `lanes show` parked golden carries `parked:liveness-stall` and the additive `until` | Happy Path | Golden | High | AC-F5-1, DM-2, DM-3 |
| TC-SUP-094 | Contract module is data-only and the report/state/taxonomy vocabularies have one home | Regression | Structure | Critical | DM-1, DM-4, EVT-1 |
| TC-SUP-095 | New modules are inventory-registered, boundary-clean, and ambient-pure | Regression | Structure | High | NFR-2, NFR-7 |
| TC-SUP-096 | Mounting: prompt-required membership, root and family help, reference page, branding seam | Regression | Structure + Checks | High | AC-F1-1 |
| TC-SUP-097 | Phase-7 documentation reconciliation is verified | Happy Path | Docs | Medium | AC-F1-1, AC-F2-1, AC-F5-1 |

### 5.2 Scenario Details

#### TC-SUP-001 - Seed SC-M2-S2-01: one run reports one lane's ref, heartbeat, and holder under the scope key

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-3, NFR-6, SC-M2-S2-01
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-report.test.ts` over `tests/fixtures/supervision/`
**Tags**: @backend, @cli, @api

**Preconditions**:

- Real temporary repository (`mkdtemp` under `TMPDIR`, `git init -b main`, fixed author identity) with one managed-repository key; fixture guard asserted.
- The delivered state store opened inside it; one active lane `GH-295` with a recorded heartbeat at `now - 120_000 ms`, an advancing artifact (one phase completion), and a live lease naming `holder-a`.

**Steps**:

1. Run the battery once through the in-process program runner with `--json`, injected clock, brand, run id, and captured buffers.
2. Parse the machine payload and compare the seeded lane to the report's single lane entry.
3. Serialize the whole payload and scan every string value for repository keys.

**Expected Outcome**:

- Exit `0`; `data.schemaVersion == "delivery.supervision.v1"`; `data.repo` equals the managed key.
- `data.lanes` length `1`; the entry's `ref`, `heartbeat`, and `holder` equal the seeded values exactly (the holder is the lease's recorded holder, not a copy of the ref).
- The entry's classification is `progressing`; `evidence` is non-empty and names a ref, a record kind, an instant, and a code.
- `counts` sum to the entry population; `actions` is empty; `degraded` names the daemon-absent state rather than logging it aside.

---

#### TC-SUP-002 - The report names no repository other than its own scope key

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NG-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-scope.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- The temp store carries records for the invoking checkout's managed repository **and** a second repository (lane, lease, and park records) with a distinguishable key.

**Steps**:

1. Run the battery once for the invoking scope.
2. Scan the serialized payload (and the human render) for the foreign key and for any foreign ref/holder that only the second repository's records carry.
3. Assert the entry population.

**Expected Outcome**:

- `data.repo` is the invoking scope key only.
- The foreign repository key does not appear anywhere in the payload or the human text; foreign refs/holders do not appear.
- Entry counts equal the scope's records only — the fold filtered by scope, it did not post-filter the rendering.
- Mutant (temp copy): drop the scope predicate → the case fails naming the leaked key.

---

#### TC-SUP-003 - Grammar containment refuses an extra positional or unknown flag before any read; human text renders from the same evidence

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F8-1, DEC-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-grammar.test.ts`
**Tags**: @cli, @api

**Preconditions**:

- A readable store; a recording store seam that counts read calls.

**Steps**:

1. Run `supervise GH-123`, `supervise --unknown-flag`, and `supervise --json extra`.
2. Read the recorded read count and the envelopes.
3. Run `supervise` (human) and `supervise --json` against the same seeded records and compare the projected facts.

**Expected Outcome**:

- Each malformed invocation exits `1` with the delivered containment identity, the failure envelope (no `data`), and **zero** store reads — containment runs before any read.
- The human render carries the same repo key, lane ref, classification, and holder as the machine payload; it performs no second fold (read count still one per run).
- No product or binary literal appears in either projection outside the branding seam.

---

#### TC-SUP-004 - Report shape is total over empty, single, and many-lane scopes

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-6
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-report.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Three scopes: zero lanes and zero claims but a readable store with a daemon instance record; one lane; twelve lanes across mixed classifications.

**Steps**:

1. Run the battery for each scope.
2. Assert the member set of `data` against the declared report member set (no member missing, no extra member).
3. Assert counts against the entries and actions against the durable records.

**Expected Outcome**:

- Every case carries the same declared member set (`repo`, `lanes`, `supervisors`, `actions`, `counts`, `degraded`, `truncated`, the run instant, plus `truncationReason` only when truncated).
- Counts are derived, never copied: they equal the entry populations in each cell.
- An empty lane population still carries an empty `lanes` array and a zero count (no member omitted, no `null` standing in for an absent collection).

---

#### TC-SUP-005 - A readable store with no records yields an empty evidence-complete report, not a guessed verdict

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-1, AC-F2-1, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-evidence-absent.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A fresh temp repository with a readable, empty delivered state store (no lane, claim, or artifact record).

**Steps**:

1. Run the battery once.
2. Assert the envelope class, the exit, and the entry populations.
3. Contrast with TC-SUP-013 (entries present but every one unknown) and with a missing/unreadable source.

**Expected Outcome**:

- Exit `0` with an empty report: `lanes == []`, `supervisors == []`, zero counts, no fabricated entry and no defaulted verdict. (Reading AMB-1: DEC-6's exit `2` covers an absent or unreadable *source*, not an empty readable scope.)
- No `progressing` default appears anywhere; the human render states the empty population rather than "healthy".
- With the store directory made unreadable (permissions removed, or the file truncated), the same invocation exits `2` with the delivered state/collector identity and no `data`.

---

#### TC-SUP-010 - The classification matrix is total, deterministic, and artifact-only

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, DEC-4, DEC-5, NFR-1, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-classification.test.ts` over `tests/fixtures/supervision/matrix.ts`
**Tags**: @backend, @api

**Preconditions**:

- A declared matrix file enumerating cells over {advancing, partial, flat-and-aged, absent} × {lane, daemon instance claim, coordinator lease claim}; every cell names its expected tri-state and its evidence shape.

**Steps**:

1. For every cell, seed only the declared records, run the battery, and read the entry's classification.
2. Assert the cell's expected value and that every cell in the declared matrix was exercised (no cell skipped, no cell missing an expectation).
3. Re-run each cell and compare the serialized entry.

**Expected Outcome**:

- Advancing or partial → `progressing`; flat-and-aged with zero progress across the span → `stalled`; absent/insufficient → `unknown`.
- The matrix is total: the declared cell count equals the executed count (a guard fails a matrix with an unmapped cell).
- Each cell's entry is byte-identical across the paired run; evidence is non-empty in all three states.

---

#### TC-SUP-011 - Prefill/resume cells: any advancing evidence reads `progressing`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-3, AC-F2-1, AC-F3-1, RSK-3, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-classification.test.ts`
**Tags**: @backend

**Preconditions**:

- Cells: a freshly started lane with a flat trail but an age **below** the bound; a lane with a flat trail and an age **at** the bound but exactly one advancing artifact (a phase completion, then separately a recorded commit, then an attempt-progress record, then ledger-position movement).

**Steps**:

1. Run the battery for each cell.
2. Assert the classification and the named evidence.
3. Mutant (temp copy): make the corroboration test ignore the artifact half → the case fails naming the ignored artifact.

**Expected Outcome**:

- Every cell reads `progressing`; the advancing artifact is named in the evidence.
- No cell is parked and no park record appends.
- The prefill-safe rule is the delivered one: the case asserts one artifact class at a time, so a detector that requires two artifacts also fails.

---

#### TC-SUP-012 - `unknown` is truthful, carries evidence of absence, and is never defaulted

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, DEC-5, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-classification.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A mixed scope: one advancing lane, one lane with no heartbeat and no artifact record, one claim with an instance record but no heartbeat record.

**Steps**:

1. Run the battery.
2. Assert each entry's classification, evidence, and presence in `counts`.
3. Assert the payload contains no zero standing in for an absent heartbeat (`heartbeat` absent, not `0`; no `0` age), and no guessed `progressing`.

**Expected Outcome**:

- The mixed scope exits `0` and rides all three states truthfully.
- `unknown` entries carry evidence naming the missing source (a record kind plus a code), never an empty string.
- Absent observations are absent members or classified absences — never `0`, `""`, or `null` used as a stand-in for "unknown".

---

#### TC-SUP-013 - An all-unknown scope projects the classified evidence-absent outcome at exit 2

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F8-1, DEC-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-evidence-absent.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A scope whose lanes and claims exist as records but whose every classification input is absent (no heartbeat, no artifact, no lease).

**Steps**:

1. Run the battery once.
2. Assert the envelope, exit, and identity.
3. Assert the failure carries the absence as evidence (which sources were missing) and no partial report hides in the error envelope.

**Expected Outcome**:

- Exit `2` with the declared evidence-absent identity (retryable, `not_landed`), and **no** `data` member — the exclusive envelope is not violated by carrying a half report.
- The failure summary names the missing sources per entry; no entry is silently dropped.
- A mixed scope with at least one non-unknown entry takes the report path at exit `0` instead (the boundary between the two cases is asserted in one file).

---

#### TC-SUP-014 - The classification input shape declares no process-derived field, structurally

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-4, AC-F2-1, AC-F4-1, NFR-2, DEC-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-no-process-input.test.ts`
**Tags**: @backend, @structure

**Preconditions**:

- The classification input type is exported from the supervise contract/domain module.

**Steps**:

1. Read the declared input shape's members and assert exact equality with the artifact-only member list.
2. Scan the supervise contract, domain, state, and CLI modules for process markers (`pid`, `ppid`, `process.start`, `starttime`, `cpuUsage`, `cpuPercent`, `os.cpus`, `ps -o`, `getrusage`, `kill(`), case-insensitively.
3. Extend the delivered `coordinator-no-cpu` guard to include the supervise tier (one list, not a fork).

**Expected Outcome**:

- The member set contains no process-derived member and matches the declared artifact-only list exactly (an added member fails).
- The marker scan finds zero hits; the mutation (add `pid` to the shape) fails with the field named.
- The delivered no-CPU guard's coverage list includes the supervise modules without duplicating its marker list.

---

#### TC-SUP-020 - Lying lane: advancing heartbeats over a flat artifact trail reads `stalled` (ticket AC)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, DEC-4, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-lying-liveness.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A lane with three heartbeat records whose ordinals advance to the injected `now` (age within the bound), session traffic claimed, and **no** phase completion, **no** recorded commit, **no** attempt progress, and **no** ledger-position movement across the 300,000 ms span.

**Steps**:

1. Run the battery once.
2. Assert the lane entry's classification and the evidence that decided it.
3. Assert the park action against the seeded lane (spec flow 3 → flow 2).

**Expected Outcome**:

- The entry classifies `stalled` while the heartbeat evidence is live-looking, and the evidence names the flat artifact classes and the span.
- A park record appends with `cause: liveness-stall`; `data.actions` counts it; exit stays `0` (the run succeeded).
- The case fails if the classification depends on heartbeat freshness alone (mutant: make the fold return `progressing` when heartbeats are live).

---

#### TC-SUP-021 - Lying supervisor claim: continuing liveness with flat supervision artifacts reads `stalled`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, F-6, DEC-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-lying-liveness.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A daemon instance record claiming liveness, heartbeat records whose ordinals keep advancing across the span, and no lane-record progress, no reconciliation record, and no action evidence in that window; separately, a coordinator lease claim with ledger position flat across the span.

**Steps**:

1. Run the battery once.
2. Assert each claim entry's classification, identity, and scope evidence.
3. Assert no park/restart action targets a claim entry (claims are classified, not acted on).

**Expected Outcome**:

- Both claim entries classify `stalled` by artifact evidence; the evidence names the flat supervision artifacts and the span.
- Identity and holder are named; no lock token, session id, or process identifier appears in the payload.
- The lane/claim distinction holds: the run does not park anything on account of a stalled claim. Claims are report evidence — they classify and name holders, and only an authority actively acting over a targeted action's object triggers the refusal (DEC-8).

---

#### TC-SUP-022 - Advancing artifacts defeat any process-shaped reading

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, NFR-2, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-lying-liveness.test.ts`
**Tags**: @backend

**Preconditions**:

- A lane whose artifacts advance inside the span, seeded together with every process-shaped fixture the repo can express (a stale-looking process record in a neighbouring fixture file, zero session traffic, an artificially low heartbeat ordinal), all outside the classification shape.

**Steps**:

1. Run the battery for the advancing lane.
2. Run a paired control where only process-shaped fixtures differ.
3. Compare the two reports byte-for-byte after normalization.

**Expected Outcome**:

- Both runs classify `progressing` and no park appends.
- The two reports are identical: the process-shaped fixtures changed nothing, which is the behavioural proof that they are not inputs.
- The case fails if a process-shaped value reaches a verdict (the paired comparison isolates that).

---

#### TC-SUP-023 - Corroboration bound cells: below / at / above 300,000 ms with zero progress

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-4, AC-F2-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-corroboration.test.ts`
**Tags**: @backend

**Preconditions**:

- Three lanes differing only in heartbeat age: `299_999`, `300_000`, and `300_001` ms, each with a flat artifact trail across its own span; a fourth lane at `300_001` ms with one advancing artifact.

**Steps**:

1. Run the battery for each cell (separate runs, one lane each).
2. Assert the classification and whether a park appended.

**Expected Outcome**:

- `299_999` → `progressing` (corroboration not met), no park; `300_000` and `300_001` → `stalled` with a park; the advancing twin → `progressing`, no park.
- The boundary is inclusive at the delivered bound and read from the delivered constant (a hard-coded `>` instead of `>=` fails the `300_000` cell).

---

#### TC-SUP-030 - The delivered bound, verdict family, and probes are consumed, not reimplemented

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-1, NFR-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-watchdog-consumption.test.ts`
**Tags**: @structure, @backend

**Preconditions**:

- The supervise modules import from the delivered watchdog contracts.

**Steps**:

1. Assert the supervise corroboration bound resolves to `WATCHDOG_STALL_HEARTBEAT_MS` and that no numeric literal `300000`/`300_000` exists in the supervise source.
2. Assert the probe names used by the battery are a subset of the declared `WATCHDOG_PROBES` and that no probe implementation is redeclared (no local `liveness`/`preflight`/`teardown` function body in the supervise modules).
3. Mutant: replace the import with a literal → the case fails naming the file and the literal.

**Expected Outcome**:

- Bound, verdict family, and probe names are imported; the supervise contract declares no second verdict vocabulary and no second bound.
- The delivered watchdog contract module and its structure suites are unmodified by this change.

---

#### TC-SUP-031 - An absent signal source contributes `unknown`, never a coerced zero

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-watchdog-consumption.test.ts`
**Tags**: @backend

**Preconditions**:

- Two cells: a lane with a source present but reporting zero delta and zero traffic; a lane with the source absent entirely.

**Steps**:

1. Run the battery for both cells.
2. Inspect the facts the fold sees (via the injected probe seam's recorded return) and the resulting classification.
3. Assert the two cells are distinguishable in the payload.

**Expected Outcome**:

- Present-but-zero contributes a corroborating fact (and classifies by the full combination); absent contributes `unknown` with evidence naming the absent source.
- No `0` is synthesized for an absent source; the recording seam shows the probe returned "absent", not a zeroed fact.
- Mutant: coerce absent to zero → the absent cell classifies `stalled` and the case fails.

---

#### TC-SUP-032 - The delivered prefill-safe rule and signals-absent discipline are reused, not forked

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-1, RSK-4
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-watchdog-consumption.test.ts`, `tests/behaviour/supervision-classification.test.ts`
**Tags**: @structure, @backend

**Preconditions**:

- The delivered watchdog liveness classification is reachable from the supervise fold.

**Steps**:

1. Assert structurally that the supervise domain contains no second "advancing?" / "stale?" predicate and calls the delivered one.
2. Assert behaviourally that the delivered prefill-safe cell and signals-absent cell produce the same tri-state as the delivered watchdog verdict family maps to (one table, both sides).
3. Assert the naming boundary: the supervise docs/contract text names the daemon-internal cycle as consumed, not replaced (DEC-1), and the watchdog surface still declares it never supervises.

**Expected Outcome**:

- One predicate home; the battery's cells agree with the delivered classification table.
- No contract or vocabulary drift: the delivered `WATCHDOG_VERDICTS` set is unchanged and the tri-state set is a distinct, declared mapping rather than a renamed copy.

---

#### TC-SUP-040 - Seed SC-M2-S2-02: a corroborated stall appends a `liveness-stall` park with a non-null `until`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-2, DEC-2, NFR-1, SC-M2-S2-02
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-stall-park.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- One lane with heartbeat age at/above the delivered bound, zero artifact progress across the span, and no live holder.

**Steps**:

1. Run the battery once.
2. Read the appended records through the delivered read seams (`readQueueParks` or equivalent) and the report's `actions`.
3. Assert the park's cause, condition mapping (through `conditionTypeForCause`), `until`, `recheckMs`, and evidence.

**Expected Outcome**:

- Exactly one park record appends; `cause == "liveness-stall"`; `conditionType` equals the delivered resolver's answer (`provider-window`, the expiry-carrying type); `until` is non-null, equals the declared stall recheck horizon computed from the injected clock, and is later than the run instant.
- `recheckMs` equals the mapped condition type's declared default (read from `QUEUE_PARK_RECHECK_DEFAULTS`, never a literal).
- The park's evidence names the ref, the heartbeat observation, the flat artifact classes, and the span; `data.actions` counts the action with the same evidence; exit `0`.
- No queue entry is mutated and no lease is created (the battery parks; it does not claim).

---

#### TC-SUP-041 - `lanes show` reports state `parked`, reason `parked:liveness-stall`, the active `until`, and the snapshot projection follows

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-2, DM-3, EVT-1, DEC-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-stall-park.test.ts`, `tests/behaviour/lanes-parked-stall.test.ts`
**Tags**: @backend, @cli, @api

**Preconditions**:

- The fixture from TC-SUP-040 after its battery run.

**Steps**:

1. Run `lanes show GH-295 --json` and the human form.
2. Assert state, reason, counts, and the additive `until`.
3. Feed the same read into the delivered lanes snapshot publish path and inspect the frame.

**Expected Outcome**:

- Machine read: `state == "parked"`, `reason == "parked:liveness-stall"`, `until` equal to the park's `until`, `counts.parked == 1`, `counts.delivering == 0`.
- Human read: the same three facts in the delivered rendering (byte-exact in the golden TC-SUP-093).
- The published lanes frame carries the parked state and the classified reason with no taxonomy change.

---

#### TC-SUP-042 - The additive `until` is present exactly when an expiry-carrying park is active

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-3, DEC-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/lanes-parked-stall.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Four lane cells: not parked at all; parked by `owner-hold` (non-expiry condition); parked by `peak-window` (expiry-carrying); parked by `liveness-stall` (expiry-carrying). Plus a pre-change park record written before the new cause existed.

**Steps**:

1. Read each lane through `lanes show`.
2. Assert the presence or absence of the `until` member (member absence, not `null`/empty string).
3. Replay the pre-change records and assert no crash and no inferred value.

**Expected Outcome**:

- `until` present exactly for the two expiry-carrying parks, equal to each park's `until`.
- Absent (member not present) for the un-parked lane and the `owner-hold` park; never `null`, never a defaulted timestamp.
- A pre-change park record without the cause reads as a classified absence; the new cause never appears by inference.

---

#### TC-SUP-043 - A stall over an actively held session records durable intent and parks at the safe boundary, signalling nothing

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, AC-F7-1, DEC-7, RSK-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-stall-park.test.ts` over the delivered preemption seams (`packages/core/src/app/daemon-preemption.ts`, exercised as in `tests/behaviour/daemon-preemption.test.ts`)
**Tags**: @backend

**Preconditions**:

- A stalled lane with a live lease naming its own session holder and an active session lease that the delivered preemption machinery recognizes as held.

**Steps**:

1. Run the battery.
2. Assert the durable intent record (delivered preemption pending state) and that no park is applied yet.
3. Advance the injected clock/reach the delivered safe-boundary applier; assert the park lands.
4. Assert the process-port/kill recording seam was never called.

**Expected Outcome**:

- The intent is durable and visible before the boundary (pending state with evidence); the park does not land mid-session.
- At the boundary the park lands with the `liveness-stall` cause and non-null `until`.
- Zero kill/signal/stop calls on the recorded seam; the run still exits `0`.

---

#### TC-SUP-044 - A parked stall lane recovers only through the delivered classification — never a scratch re-dispatch or silent requeue

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-7, AC-F5-1, AC-F7-1, NG-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-recovery.test.ts`
**Tags**: @backend

**Preconditions**:

- A lane parked by `liveness-stall`; the delivered queue/economics seams available read-only; a recording seam over session start/resume.

**Steps**:

1. Run a second battery after the park.
2. Run the delivered `queue plan`/lane read and the delivered restart admission path.
3. Assert no new lease, no queue-entry mutation, no auto-reopen, no tracker write.

**Expected Outcome**:

- The second run does not append a second park for the same lane while the active park stands (idempotent action), and does not restart it outside the delivered admission.
- Recovery changes state only through the delivered recovery classification (restart admission, resume economics, terminal exhaustion + typed question); zero session start/resume calls in the refusal path.
- Assertion holds the "no silent requeue" line: the lane never returns to `delivering` without a delivered restart record.

---

#### TC-SUP-045 - The cause joins the closed set additively with exactly one declared condition mapping

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-2, RSK-1, RSK-6, DEC-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-park-vocabulary.test.ts` (extending `tests/behaviour/queue-park-causes-s17.test.ts` equality style)
**Tags**: @structure, @backend

**Preconditions**:

- The delivered cause/condition constants.

**Steps**:

1. Assert exact set equality for `QUEUE_PARK_CAUSES` (delivered five in position, then `liveness-stall`) and `QUEUE_PARK_CONDITION_TYPES` (unchanged).
2. Assert the pair table is the delivered five plus exactly one row, and that the resolver returns the expiry-carrying type for `liveness-stall`.
3. Assert `QUEUE_PARK_RECHECK_DEFAULTS` has no new key and the mapped default is unchanged; assert the `parked:<cause>` template renders `parked:liveness-stall` and every delivered render unchanged.
4. Mutants: rename the cause; map it to `preemption`; add a fourth condition type; add a recheck default key. Each must fail.

**Expected Outcome**:

- One appended cause, one appended pair, no fourth vocabulary, no renamed or reordered delivered member.
- The mapping is asserted through the delivered resolver, so a later re-mapping is caught by the equality rather than tolerated by a literal.

---

#### TC-SUP-046 - No new record kind, no schema bump, and pre-change records replay unchanged

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-4, EVT-1
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-additivity.test.ts`, `tests/behaviour/supervision-additivity.test.ts`
**Tags**: @structure, @backend

**Preconditions**:

- The delivered record-kind set and payload schema registry; a captured pre-change store fixture (records written before this change, including a park and a lane).

**Steps**:

1. Assert record-kind set equality (no addition) and that every delivered payload schema version string is unchanged; assert the only new schema identity is the report payload.
2. Read the captured pre-change store through the delivered seams and the battery; assert no migration marker, no rewritten record, and no validation failure.
3. Assert the battery appends only through the delivered park/restart/exhaustion paths (no generic append).

**Expected Outcome**:

- Record kinds and delivered schemas unchanged; one new schema identity (`delivery.supervision.v1`).
- Pre-change records replay byte-identically (no in-place mutation); the fold treats a missing new cause as a classified absence.
- Assert the tree byte-for-byte before and after a read-only run: a read appends nothing.

---

#### TC-SUP-047 - The park carries its corroborating evidence so a wrong park is auditable

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, RSK-3, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-stall-park.test.ts`
**Tags**: @backend

**Preconditions**:

- Two stalls: one lane-based, one claim-based, each with distinguishable artifact facts.

**Steps**:

1. Read the appended park record's evidence members.
2. Assert the evidence is sufficient to reconstruct the decision (ref, heartbeat instant, artifact classes checked, span, bound used).
3. Assert evidence is bounded by the delivered evidence cap and carries no free-text content.

**Expected Outcome**:

- The park's evidence alone explains why the park happened; a reviewer can tell which artifacts were checked and found flat.
- Evidence respects the byte cap; overflow is truncated with a declared marker rather than silently cut.
- No message content, token, or path outside the scope appears in the evidence.

---

#### TC-SUP-050 - Live supervision claims are inventoried with tri-state, holder, and scope evidence

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, DEC-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-claims.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A daemon instance record with heartbeat records inside the delivered staleness bound; a coordinator ledger-lease claim proving live ownership; a live per-ref lease naming `holder-a`; a second lane with no lease.

**Steps**:

1. Run the battery once.
2. Assert one entry per claim kind in `supervisors[]` and the per-ref holder on the lane entry.
3. Assert each entry's tri-state, identity, and scope evidence; assert one claim whose heartbeat is outside the staleness bound is named as not live.

**Expected Outcome**:

- Every claim is present with its tri-state and identity; the live per-ref holder appears on the lane entry exactly as the lease records it.
- Liveness is folded from records using the delivered staleness bound (imported, not re-declared); no socket or process probe is consulted for liveness.
- No holder is inferred for the lease-less lane, and no lock token or credential appears.

---

#### TC-SUP-051 - A per-action double-act against an actively acting authority is refused, naming the live claim and holder

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, F-8, AC-F6-1, AC-F8-1, DEC-3, DEC-6, DEC-7, DEC-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-duplicate-refusal.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- **Acting-authority cell**: lane `GH-295` already carries an active `liveness-stall` park (from a prior run, so no park intent is pending) and a restart admission is due within the delivered budget; a durable record of another supervision authority — a second battery identity's in-flight/landed acting record, or a coordinator claim's acting record — names the same object `GH-295` inside the acting window.
- **Presence cell**: the same corroborated stall with **no** prior park and **no** acting record, plus a live resident daemon instance claim (instance record and heartbeats inside the delivered heartbeat-staleness bound).
- **Held-session cell**: the corroborated stall over a lane whose session is actively held (live per-ref lease naming its own session holder), with the delivered safe-boundary machinery available.

**Steps**:

1. Run the battery for the acting-authority cell; assert the envelope, exit, identity, and evidence.
2. Assert no acting record for `GH-295` appended by this run and no second park appended; assert the other authority's record is untouched.
3. Re-run after the other authority's record leaves the acting window (injected clock advanced past it); assert the retry succeeds.
4. Run the battery for the presence cell; assert exit `0`, the park applied, and the daemon claim carried in `data.supervisors` with its tri-state and holder.
5. Run the battery for the held-session cell; assert the park intent is refused by neither identity and records durable intent (landing per TC-SUP-043).

**Expected Outcome**:

- Acting-authority cell: the failure envelope (no `data`) with the duplicate-supervision identity at exit `1`, retryable, `not_landed`; evidence names the live claim and its holder verbatim from the durable record; no action lands; the delivered lock/lease/single-flight mechanisms are untouched.
- Retry: once the other authority is no longer acting, the same run applies the restart and reports data at exit `0` — retryability is demonstrated, not asserted as prose.
- Presence cell: exit `0` with report data; the daemon claim's tri-state and holder ride `data.supervisors`; the park lands — a live daemon's existence refuses nothing and never gates a park (DEC-8a/DEC-8b).
- Held-session cell: neither identity refuses the park intent; it is a non-claiming action whose safety is the delivered fenced append and write serialization (a landed park refuses a second identical park), never the duplicate-supervision refusal (DEC-8c).
- Claim classification is never a refusal: in every cell that produces a report, all claims carry tri-state and holder in `data`.

**Notes / Clarifications**:

- The guarded object is a supervision authority **actively acting** over the object the battery's action targets (DEC-8a) — the action's target object, not the scope at large. Detection reads durable records only, never a process scan (TC-SUP-054).
- The refused action is an acting action (here, restart admission). A park intent — including its safe-boundary preemption intent path — is declared non-claiming (DEC-8c), which is what keeps AC-F5-1's park reachable in exactly the session-held case the park exists for.

---

#### TC-SUP-052 - A per-ref double-claim is refused through the delivered single-flight identity with the holder named

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, DEC-3, DEC-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-single-flight.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A lane already parked by `liveness-stall` (so no park intent is pending) whose restart admission would acquire the ref claim through the delivered claim path, while a live lease on that ref names a foreign holder `holder-a`.

**Steps**:

1. Run the battery.
2. Assert the refusal identity, the named holder, and that no lease or claim record for that ref was created.
3. Assert the delivered single-flight helper (not a new predicate) produced the refusal.

**Expected Outcome**:

- The refusal reuses the delivered `queue.single-flight` identity and names `holder-a` exactly as recorded; the failure carries `not_landed` and the delivered exit class.
- Zero claim/lease appends for the ref; the existing lease is untouched.
- Assertion consumes the delivered tested helper, so the case fails if a parallel refusal predicate appears.

**Notes / Clarifications**:

- DEC-8(c) settles which action is a claiming action: a park intent is **non-claiming** and is refused by neither identity, so the claiming action in this case is the restart admission. No case asserts a park refused as a per-ref double-claim.

---

#### TC-SUP-053 - The delivered lock, lease, single-flight, and supervise-only composition are unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, NG-6, DEC-3, RSK-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-nonregression.test.ts` (targeted) plus the delivered suites `tests/structure/daemon-production-composition.test.ts`, `tests/behaviour/daemon-single-flight.test.ts`, `tests/behaviour/daemon-lock.test.ts`, `tests/behaviour/coordinator-instance-lease.test.ts` run unchanged
**Tags**: @structure, @backend

**Preconditions**:

- The delivered daemon, coordinator, and queue suites in their pre-change state.

**Steps**:

1. Run the delivered suites and assert green with **no edits** (a diff scan asserts the files are untouched).
2. Assert the daemon's production composition still declares `supervise-only` (the delivered mount test plus a direct assertion on the composition descriptor).
3. Assert the delivered lock/staleness/lease constants are unchanged and imported by the battery.

**Expected Outcome**:

- Zero edits to the delivered suites and zero changes to the delivered constant values.
- Production composition is still supervise-only: the battery is mounted without a lane composition, and no new composition path grants it one.
- The battery's duplicate detection consumes the folds; nothing reimplements the lock or the lease.

---

#### TC-SUP-054 - Duplicate detection reads records only: zero process-port, pid, or CPU reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, F-6, AC-F3-1, AC-F6-1, NFR-2, NG-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-claims.test.ts`, `tests/structure/supervision-no-process-input.test.ts`
**Tags**: @backend, @structure

**Preconditions**:

- An injected process-port recording seam (the delivered coordinator seam shape) available to the composition; a fixture whose "process" would look dead if scanned.

**Steps**:

1. Run the battery over the claims fixture.
2. Assert the process seam was called zero times and the pid scan markers are absent from the modules.
3. Assert a deliberately wrong process-shaped fixture (a dead pid file, a stale lock token) changes no classification.

**Expected Outcome**:

- Zero process-seam calls; zero pid/CPU markers; classifications driven by records alone.
- The dead-pid fixture changes nothing, while removing a heartbeat record flips the claim to `unknown` — the control that proves records are the input.

---

#### TC-SUP-060 - Restart admission rides the delivered budget and appends the delivered restart record

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-restart.test.ts`
**Tags**: @backend

**Preconditions**:

- A stalled lane with restart budget remaining (ordinals below the delivered bound) and a delivered resume-economics fixture that admits.

**Steps**:

1. Run the battery.
2. Read the appended restart record and the run's `actions`.
3. Assert the budget store's ordinal moved by exactly one delivered step and that the resume-economics seam was consulted once.

**Expected Outcome**:

- Exactly one delivered restart record appends with the delivered reason vocabulary and the corroborating evidence; the decision names the budget source (delivered `coordinator-restart`/dispatch store as declared) rather than a battery-local counter.
- `data.actions` counts the restart; exit `0`.
- No process signal; no queue requeue record; no tracker write.

---

#### TC-SUP-061 - Exhaustion is terminal and loud: exhaustion record plus typed question, no silent requeue

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DM-4, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-restart.test.ts`
**Tags**: @backend

**Preconditions**:

- A stalled lane at the delivered budget bound (exhausted) and an occupied ledger with one open question slot.

**Steps**:

1. Run the battery.
2. Assert the delivered terminal exhaustion record and the typed question record.
3. Assert nothing else changed: no restart record, no queue entry mutation, no second question, no requeue.

**Expected Outcome**:

- The delivered exhaustion record lands; the typed question is raised exactly once with the delivered question id shape; the report counts the exhaustion outcome and exits `0` (the battery ran and reported).
- No silent requeue, no scratch re-dispatch, no auto-reopen, no tracker write (NG-7).
- A repeated run does not duplicate the question (idempotent by the delivered ledger identity).

---

#### TC-SUP-062 - An unevaluable admission reports the declared unavailable outcome

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-restart.test.ts`
**Tags**: @backend

**Preconditions**:

- A stale lane with the resume-economics seam returning "unevaluable" (its delivered unevaluable/unavailable arm), and one with the budget source unreadable.

**Steps**:

1. Run the battery for each cell.
2. Assert the declared unavailable outcome in `actions` and the evidence.
3. Assert no restart record appends and no budget ordinal is consumed.

**Expected Outcome**:

- The outcome is the declared unavailable identity (delivered), not `progressing`, not a silent skip, not a fabricated restart.
- Evidence names the seam and the reason; the run reports it and exits `0` (or `2` only if the state itself is unreadable, which is the second cell — asserted separately).
- No budget is consumed by an unevaluable admission.

---

#### TC-SUP-063 - The never-signal discipline holds: no kill, spawn, or signal seam is reached

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DEC-7, NG-3
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-no-signal.test.ts`, `tests/behaviour/supervision-restart.test.ts`
**Tags**: @structure, @backend

**Preconditions**:

- The delivered process-port and kill recording seams; the supervise source tree.

**Steps**:

1. Scan the supervise modules for signal/spawn/kill members (`kill`, `SIGTERM`, `SIGKILL`, `process.kill`, `spawn(`, `execFile(`, `child_process`).
2. Drive every action path (park, safe-boundary park, restart, exhaustion) and assert the kill/spawn recording seam recorded zero calls.
3. Assert the safe-boundary path uses the delivered intent record instead.

**Expected Outcome**:

- Zero marker hits in the supervise tier and zero recorded calls across all action paths.
- The only durable writes are delivered park/restart/exhaustion appends; the delivered preemption machinery owns any later effect.
- Mutant: add a `process.kill` call → the structure case fails naming the file.

---

#### TC-SUP-070 - Exactly two `supervise` identities are appended and no delivered row changes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-1, DEC-6, RSK-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-error-family.test.ts` (mirroring `tests/structure/daemon-vocabulary.test.ts`)
**Tags**: @structure, @backend

**Preconditions**:

- The delivered error table and `DOMAIN_KINDS`.

**Steps**:

1. Assert `DOMAIN_KINDS` gains `supervise` and the table has exactly two rows with `domainKind == "supervise"`, each with its declared `code`, `category`, `retryable`, `consequence`, `projectionClass`, and `remediationHint`.
2. Assert every delivered row is byte-identical to its captured pre-change value (a snapshot of the delivered table taken before the change, committed as a fixture) and that no row was reordered.
3. Assert the codes are declared by exact identity (two-segment or three-segment as declared), not by family/pattern widening; assert the allowlist delta is exactly `+2` and the four-way agreement (classifier, table, structure mirror, carrier).
4. Assert the exit projection: duplicate-supervision refusal → exit `1`, retryable; evidence-absent unknown → exit `2`, retryable; both `not_landed`.

**Expected Outcome**:

- Exactly two appended rows; zero delivered changes; exact-identity declaration; the allowlist delta is `+2` and every count pin moved in the same change.
- Mutants: add a third supervise row; change a delivered row's category; register the codes by prefix → each fails naming the offending code.

---

#### TC-SUP-071 - Machine rows, documented rows, and corpus bind in both directions

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-1, RSK-6
**Test Type(s)**: Contract, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/supervision-error-socialization.test.ts` (mutation suite over `scripts/checks/error-table-sync.ts`), `tests/checks/error-table-sync.test.ts`
**Tags**: @checks, @docs

**Preconditions**:

- The documented error table in `doc/spec/features/feature-result-contract.md` updated with the two rows and the new count; the code corpora in `tests/fixtures/result/code-corpora`.

**Steps**:

1. Run the sync check over the live tree: zero failures, counts reported (`sourceEntries`, `documentedRows`, `corpusRows`).
2. In a temp copy: remove one documented `supervise` row → documented→machine direction fails; add an undocumented machine row → machine→documented direction fails; drop the corpus true-positive row → corpus direction fails; add a foreign-namespace literal → ignored and counted, not flagged.
3. Assert the check fails closed on a missing/empty/unparseable documented table.

**Expected Outcome**:

- Live tree: PASS with the declared row and count deltas; both directions non-vacuous.
- Every mutation fails with the offending code or row named; the live tree is never written (all mutations in `mkdtemp` copies).
- The corpus contains a true-positive row for each new identity and a lookalike that is not flagged.

---

#### TC-SUP-072 - Every other outcome reuses a delivered identity with the declared exit

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DEC-6
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-error-family.test.ts`, `tests/behaviour/supervision-exits.test.ts`
**Tags**: @structure, @backend

**Preconditions**:

- The delivered containment, state/collector, and single-flight identities.

**Steps**:

1. Drive each reuse cell: an extra positional (containment), an unknown flag (containment), unreadable state, a torn record, a per-ref double-claim (single-flight).
2. Assert the identity is the delivered code and the exit is the delivered mapping.
3. Assert no new identity was minted for any of these.

**Expected Outcome**:

- Three reuse classes assert the delivered codes exactly; the supervise kind contributes nothing for them.
- Exit taxonomy: `0` report, `1` classified refusal/grammar, `2` evidence-absent or unreadable state — asserted as one table over the observed cells.
- A parked stall inside a successful run keeps exit `0` (DEC-6): the report is the truth about what was found.

---

#### TC-SUP-080 - Identical record sets and an injected clock replay to an identical report, evidence, actions, and exit

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-3, AC-F1-1, AC-F2-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-determinism.test.ts`
**Tags**: @backend

**Preconditions**:

- A captured record set covering all three states, one action, one unknown, and one truncated report; the injected clock fixed at a constant instant; a fixed brand and run id.

**Steps**:

1. Run the battery twice from the same record set (fresh process each run) and compare serialized stdout and exit codes byte-for-byte.
2. Replay the captured record set into a second temp store and compare again (same evidence, same actions).
3. Assert evidence members are all refs/record kinds/instants/codes (no wall-clock, no hostname, no path, no random id).

**Expected Outcome**:

- Identical bytes across all three comparisons after the normalizer replaces only the temp repo root, the run id, and timing.
- No evidence member is derived from the wall clock: a run with the clock advanced by an arbitrary amount produces different instants only where record instants are echoed, never a different verdict.
- Mutant: sort entries by a Map iteration order → the case fails as non-deterministic.

---

#### TC-SUP-081 - One whole-store read fold per run, and no per-lane re-read

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-read-cost.test.ts`
**Tags**: @backend

**Preconditions**:

- A recording store seam counting read passes; a 50-lane scope.

**Steps**:

1. Run the battery once and read the counter.
2. Run a second time with 200 lanes and compare the counter.
3. Assert the human projection performs no additional fold.

**Expected Outcome**:

- Exactly one whole-store read pass per run, independent of lane count (the delivered publish-tick read discipline); no per-lane read, no second fold for the human render.
- Mutant: read per lane → the counter scales with lanes and the case fails with the observed count.

---

#### TC-SUP-082 - The report caps at 200 lanes with explicit truncation and a named reason; evidence respects its caps

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-4, DM-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-bounds.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A scope with 201 lanes (and a second cell with exactly 200); one entry carrying maximal evidence.

**Steps**:

1. Run the battery for both cells.
2. Assert entry count, `truncated`, `truncationReason`, and counts semantics.
3. Measure the maximal evidence entry against the delivered evidence byte cap.

**Expected Outcome**:

- 200 lanes → 200 entries, `truncated == false`, no `truncationReason` member; 201 lanes → 200 entries, `truncated == true`, and a named reason drawn from the declared reason vocabulary (not a free string, not `null`).
- Counts report the population truthfully (the cap is disclosed, never silently rounded).
- Evidence never exceeds the delivered cap; an over-cap evidence value is truncated with a declared marker, and truncation is counted rather than hidden.

---

#### TC-SUP-083 - A full run at the 200-lane cap completes under 5,000 ms offline

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-5
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-performance.test.ts`
**Tags**: @backend, @perf

**Preconditions**:

- A 200-lane scope with a realistic mix of record kinds; injected clock; no network; a warm in-process runner.

**Steps**:

1. Measure one full run (`performance.now()` around the run), asserting the exit is the expected one.
2. Assert the elapsed wall-clock is `< 5_000` ms.
3. Repeat once and assert both runs stay under the bound (guards against a cold-start pass).

**Expected Outcome**:

- Both runs complete under 5,000 ms at the declared cap, and the assertion is non-vacuous (the run actually folded 200 lanes: entry count asserted in the same test).
- The bound is the spec's literal; no percentile smoothing and no relaxed bound in CI.

---

#### TC-SUP-084 - Every entry, action, and refusal carries non-empty evidence

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-6, AC-F2-1, AC-F8-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-evidence-totality.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- A mixed scope producing at least one `progressing`, one `stalled` with an action, one `unknown`, and one refusal (both refusal cells are asserted: the per-ref single-flight refusal and the per-action duplicate-supervision refusal of TC-SUP-051).

**Steps**:

1. Run the battery and walk the payload structurally: every `lanes[]`, `supervisors[]`, and `actions[]` entry has a non-empty evidence value with at least one code.
2. Run a refusal and assert the failure summary carries evidence (the identity plus the claim/holder).
3. Mutant: drop an evidence member → the walk fails naming the entry index and path.

**Expected Outcome**:

- 100% of tri-state entries and actions carry non-empty evidence; refusals ride the failure summary with evidence.
- No evidence value is a placeholder (`""`, `"-"`, `"n/a"`) — asserted against a declared forbidden-value set.
- The completeness control is a walk, not a count, so a new entry kind cannot escape it.

---

#### TC-SUP-085 - Offline isolation: the fixture guard rejects the live workspace and no network surface is reached

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-isolation.test.ts` over `tests/fixtures/supervision/temp-git.ts`
**Tags**: @backend

**Preconditions**:

- The extended temp-repository fixture; a network-denying recording seam.

**Steps**:

1. Assert the fixture guard throws when handed `process.cwd()` and when handed a non-temp path.
2. Run the battery with the network seam armed and assert zero calls.
3. Assert the run's brand and run id came from the injected values (no environment read).

**Expected Outcome**:

- Guard rejection is asserted in both directions (live workspace, non-temp root) with distinct messages.
- Zero network calls; zero environment reads for brand/run id; the injected clock's instant is the only "now".
- The suite passes with `TMPDIR` unset and with the gate's `TMPDIR=$PWD/tmp/tmpdir`.

---

#### TC-SUP-090 - Healthy report golden: machine and human are byte-identical after normalization

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-1, DM-1, NFR-3
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/supervision-report.test.ts` + `tests/fixtures/supervision/golden/`
**Tags**: @golden, @backend

**Preconditions**:

- A committed record-set fixture and a committed normalized golden pair (`supervision-report.json`, `supervision-report.txt`), created in this change.

**Steps**:

1. Run the battery over the fixture with the injected clock, brand, and run id.
2. Normalize only the temp repo root, the run id, and timing; compare the machine payload structurally to the golden.
3. Compare the human output byte-exactly to the golden.

**Expected Outcome**:

- Structural equality with the golden; the golden names `repo`, the lane's `ref`/`heartbeat`/`holder`, the tri-state, evidence, counts, and degradation.
- Human output byte-exact; the normalizer touches nothing else (its replacement list is asserted to be exactly three entries).
- A stale golden fails; regeneration requires an explicit command recorded in §10.

---

#### TC-SUP-091 - Stalled-and-parked report golden: entries, action, evidence, and counts

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-1, DM-1, DM-2, NFR-3
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/supervision-report.test.ts`
**Tags**: @golden, @backend

**Preconditions**:

- A fixture with one stalled lane (parked), one progressing lane, and one unknown claim; committed golden.

**Steps**:

1. Run the battery; normalize and compare to the golden.
2. Assert the action's evidence and the counts match the durable records read separately.

**Expected Outcome**:

- The golden shows all three states side by side, the applied action with its evidence, and counts that equal the entries.
- The golden is stable across a second run and across both suite invocation paths (whole-file and filtered run).

---

#### TC-SUP-092 - Failure-envelope and live-claims data goldens: per-action refusal (exit 1) and the report with claims present (exit 0)

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-1, AC-F6-1, AC-F8-1, DEC-6, DEC-8
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/supervision-failure.test.ts`, `tests/golden/supervision-report.test.ts` + `tests/fixtures/supervision/golden/`
**Tags**: @golden, @backend

**Preconditions**:

- Three committed normalized goldens: the evidence-absent failure envelope (exit `2`), the per-action duplicate-supervision refusal envelope (exit `1`), and the paired live-claims data golden (exit `0`, a live daemon and coordinator claim present, every action succeeding or none needed).

**Steps**:

1. Run the evidence-absent cell; normalize and compare to its golden: five-field failure envelope, no `data`, the declared identity, exit `2`, evidence naming the missing sources.
2. Run the refusal cell (the TC-SUP-051 acting-authority fixture, whose only pending action is refused); compare to its golden: failure envelope, no `data`, the duplicate-supervision identity, exit `1`, `not_landed`, evidence naming the live claim and holder.
3. Run the paired live-claims cell (the same claim records, no acting authority); compare to its golden: `data` present at exit `0`, `supervisors[]` carrying both claims with tri-states and holders, `lanes[]` carrying the parked state and the applied action, counts consistent with the entries.
4. Assert all three goldens carry no stack trace, no path outside the temp root, and no free text; assert the refusal golden carries no `data` member and the data golden carries no error identity.

**Expected Outcome**:

- The evidence-absent golden is exact and stable at exit `2`.
- The refusal golden is exact at exit `1`: the per-action refusal projects the failure envelope, names the live claim and holder in evidence, and carries no `data` (DEC-8b).
- The paired data golden proves the other half of the same rule on the same records: claims merely present never refuse anything, and a run whose actions all succeed reports data at exit `0` with live claims visible.
- Goldens are stable across a second run; regeneration requires the explicit command recorded in §10.

---

#### TC-SUP-093 - `lanes show` parked golden carries `parked:liveness-stall` and the additive `until`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-1, DM-2, DM-3, DEC-2
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/lanes-show.test.ts` (extending the delivered lanes golden family) + `tests/fixtures/supervision/golden/lanes-show-parked.json` and `tests/fixtures/supervision/golden/lanes-show-parked.txt`
**Tags**: @golden, @backend

**Preconditions**:

- A park record with `cause: liveness-stall` and a non-null `until`; the delivered lanes program with its read seam.

**Steps**:

1. Run `lanes show GH-295 --json` and the human form through the delivered golden harness.
2. Compare structurally (machine) and byte-exactly (human) to the committed goldens.

**Expected Outcome**:

- Machine golden: `state == "parked"`, `reason == "parked:liveness-stall"`, `until` present and equal to the park's, counts updated, no other lane member changed.
- Human golden byte-exact; the new cause renders through the delivered template (no bespoke phrasing).
- The delivered non-parked lanes goldens are unchanged (a diff there is a regression, not a regeneration).

---

#### TC-SUP-094 - Contract module is data-only and the report/state/taxonomy vocabularies have one home

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: DM-1, DM-4, EVT-1, RSK-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-contract.test.ts` (reusing the delivered `dataOnlyViolations` pattern from `tests/structure/watchdog-contract.test.ts`)
**Tags**: @structure

**Preconditions**:

- The new supervise contract module.

**Steps**:

1. AST-assert the module is data-only: only type/interface/import/export/variable declarations, no executable statement, no `node:`/`bun:` runtime import, no call expression, no `new`.
2. Assert exact closed sets: `SUPERVISION_STATES` (three, ordered), the report member set, the claim-kind set; assert the schema version string.
3. Assert the record-kind set and the event topic/kind sets are unchanged (the delivered taxonomy declaration is the comparison source).
4. Mutants: add a helper function to the contract; add a fourth tri-state member; append a record kind → each fails.

**Expected Outcome**:

- One home per vocabulary; the contract is pure data; the taxonomy and record-kind sets are untouched.
- The report member set is the DM-1 semantics list (scope key, lanes, supervisors, actions, counts, degradation, truncation + reason, run instant) with no member omitted and no second naming.

---

#### TC-SUP-095 - New modules are inventory-registered, boundary-clean, and ambient-pure

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-2, NFR-7, AC-F1-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-imports.test.ts`
**Tags**: @structure, @boundaries

**Preconditions**:

- The new contract/domain/state/app/CLI modules and their exports.

**Steps**:

1. Assert every new source file is registered in `tests/structure/inventory.json` and every new export appears in the contract export inventory used by `tests/structure/content-inventory.test.ts` and `tests/fixtures/ports/v1-contract-inventory.json`.
2. Run the boundary battery: `depcruise packages`, the ambient-globals AST guard, and `workspace-entrypoints` (no new package edge, no undeclared import).
3. Assert the domain tier imports no adapter, no `node:fs`, no clock; the app tier owns the fold and the appends; the CLI tier owns rendering.

**Expected Outcome**:

- Inventory equality (no unregistered file, no unregistered export) — the expected failure message names the missing path.
- Boundaries green with no new rule and no exemption added; ambient globals zero for the new modules.
- Tier placement asserted structurally (domain pure, app composes, cli renders).

---

#### TC-SUP-096 - Mounting: prompt-required membership, root and family help, reference page, branding seam

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-1, F-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-mounting.test.ts`, `tests/behaviour/supervision-help.test.ts`, `scripts/checks/help-guide-coverage.ts`
**Tags**: @structure, @cli, @docs

**Preconditions**:

- The delivered prompt-required family set captured as one base constant before the change; the reference-page directory.

**Steps**:

1. Assert root `--help` lists the new family and that the family-count delta equals `+1` against the captured base constant; scan the repository for any stale family-count pin and assert none.
2. Assert `supervise --help` answers at exit `0` with summary, usage, options, examples, exit codes, and a see-also pointer; assert `--version` answers.
3. Assert the reference page exists and is registered; run `help-guide-coverage`.
4. Assert no product/binary literal in the family outside the branding seam.

**Expected Outcome**:

- Prompt-required membership is real (a composed-but-unadvertised family fails the count delta and the help test).
- Family help and reference page present; help-guide coverage PASS.
- Zero branding literal violations.

---

#### TC-SUP-097 - Phase-7 documentation reconciliation is verified

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-1, AC-F2-1, AC-F5-1, DEC-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-supervise.md` (new page, authored in phase 7), `feature-watchdog-lane-contracts.md`, `feature-resident-daemon.md`, `doc/00-index.md`
**Tags**: @docs

**Preconditions**:

- The delivery complete; the reconciliation phase (7) authored its changes.

**Steps**:

1. Content-review the new feature page for first-spec-only conformance: the current state described as truth, the consumed/watchdog boundary stated, the three states, the closed cause, the additive `until`, the two identities, and the exits.
2. Review the watchdog page's boundary text and the daemon page's supervise-only notes: the consumption relationship (DEC-1) replaces any "supervise is out of scope here" phrasing, with no contradiction left anywhere in the tree.
3. Run the content checks: link/path review for every changed reference, Markdown heading/table/fence render review, YAML syntax for changed front matter, and the delivered doc-conformance check.

**Expected Outcome**:

- The `supervise` page exists and is linked from the index; no first-spec-only rule violation.
- Zero residual "never supervises" contradiction: a repo-wide scan for the retired phrasing returns only the reconciled pages.
- All changed links resolve; front matter (`ados_distribution`) present; doc-conformance check green.

## 6. Environments and Test Data

- **Environment**: local Linux runner, Bun test process, no network, no resident daemon required. Every behaviour case runs in-process through the delivered program runner with captured stdout/stderr buffers, an injected clock, injected brand, and a fixed run id.
- **Repository isolation**: every case that needs a repository builds a real temporary one under the OS temp directory (`TMPDIR`, which the gate sets to `$PWD/tmp/tmpdir`) with `git init -b main` and a fixed author identity, and removes it explicitly. The fixture guard rejects (a) any root equal to `process.cwd()`/the live workspace and (b) any root outside the temp directory, with distinct messages.
- **State isolation**: the delivered state store opens inside the temp repository via `tests/fixtures/state/harness.ts`; each case disposes its store. A recording store seam counts read passes and append calls; a recording process/network seam counts prohibited calls.
- **Record fixtures**: built through the delivered append/state seams (never hand-built literals — GAP-T4) for daemon instance/heartbeat/lane, queue entry/lease/park, dispatch attempt, phase, and commit receipt/effect records. Seeded via `tests/fixtures/supervision/records.ts`:
  - `advancingLane()` — heartbeat inside the bound plus one advancing artifact of each class (parameterized by class).
  - `lyingLane()` — heartbeats advancing to `now`, all four artifact classes flat across the span.
  - `uncorroboratedLane(ageMs)` — flat trail at a chosen age (matrix cells 299 999 / 300 000 / 300 001).
  - `evidenceAbsentLane()` / `evidenceAbsentClaim()` — records exist, observations absent.
  - `daemonClaim({live})` — instance plus heartbeat ordinals inside/outside the staleness bound.
  - `coordinatorClaim({live})` — ledger lease plus flat or moving ledger position.
  - `liveLease({ref, holder})` — the delivered single-flight seeding helper.
  - `actingAuthority({object, authority})` — a durable acting record from another supervision authority (second battery identity or coordinator claim) naming the targeted object, with an acting-window instant the injected clock can move past.
  - `claimsOnly({daemonLive, coordinatorLive})` — claim records with no acting record, for the paired exit-`0` control.
  - `stalledAndParked()` — the seed-02 fixture (park record + lane read state).
  - `mixedScope()` — progressing + stalled + unknown + claims, for evidence totality and goldens.
  - `cappedScope(n)` — `n` lanes for the 200/201 bound and latency cells.
- **Injected inputs**: clock (`nowMs`/`nowIso`), brand, run id, and the probe seam (present/absent/zero facts). No case reads the wall clock, the environment, or the process table.
- **Golden data**: `tests/fixtures/supervision/golden/{supervision-report.json, supervision-report.txt, supervision-stalled.json, supervision-evidence-absent.json, supervision-refusal.json, supervision-live-claims.json, lanes-show-parked.json, lanes-show-parked.txt}` plus a captured delivered-table snapshot fixture (`tests/fixtures/supervision/error-table-baseline.json`) and a captured base family-count constant. Normalization is limited to the temp repo root, the run id, and timing; the normalizer's replacement list is itself asserted to be exactly those three entries.
- **Cleanup**: every temp repository and store is removed in a `finally`; a leaked temp root in the suite's own scratch directory fails the isolation case.

## 7. Automation Plan and Implementation Mapping

### 7.1 Case-to-file mapping

| TC ID(s) | Test file (create/update) | Level | Status | Notes |
|---|---|---|---|---|
| TC-SUP-001, TC-SUP-004 | `tests/behaviour/supervision-report.test.ts` | Behaviour | To Implement | New; uses `runProgram` with captured buffers. |
| TC-SUP-002 | `tests/behaviour/supervision-scope.test.ts` | Behaviour | To Implement | New; foreign-repository fixture. |
| TC-SUP-003 | `tests/behaviour/supervision-grammar.test.ts` | Behaviour | To Implement | New; recording store seam for the zero-read assertion. |
| TC-SUP-005, TC-SUP-013 | `tests/behaviour/supervision-evidence-absent.test.ts` | Behaviour | To Implement | New; empty scope vs all-unknown vs unreadable. |
| TC-SUP-010, TC-SUP-011, TC-SUP-012 | `tests/behaviour/supervision-classification.test.ts` + `tests/fixtures/supervision/matrix.ts` | Behaviour | To Implement | New; matrix file with totality guard. |
| TC-SUP-014 | `tests/structure/supervision-no-process-input.test.ts` | Structure | To Implement | Extends the delivered `coordinator-no-cpu` marker list (one list). |
| TC-SUP-020, TC-SUP-021, TC-SUP-022 | `tests/behaviour/supervision-lying-liveness.test.ts` | Behaviour | To Implement | New; ticket AC cell plus claim cell and the paired control. |
| TC-SUP-023 | `tests/behaviour/supervision-corroboration.test.ts` | Behaviour | To Implement | New; boundary cells from the imported constant. |
| TC-SUP-030 | `tests/structure/supervision-watchdog-consumption.test.ts` | Structure | To Implement | New; literal scan plus probe-name subset. |
| TC-SUP-031, TC-SUP-032 | `tests/behaviour/supervision-watchdog-consumption.test.ts` (+ the structure half above) | Behaviour/Structure | To Implement | New; absent-vs-zero cells. |
| TC-SUP-040, TC-SUP-043, TC-SUP-047 | `tests/behaviour/supervision-stall-park.test.ts` | Behaviour | To Implement | New; park append, safe-boundary, evidence. |
| TC-SUP-041, TC-SUP-042 | `tests/behaviour/lanes-parked-stall.test.ts` | Behaviour | To Implement | New; extends the delivered lanes read fixtures. |
| TC-SUP-044 | `tests/behaviour/supervision-recovery.test.ts` | Behaviour | To Implement | New; no requeue/no re-dispatch. |
| TC-SUP-045 | `tests/structure/supervision-park-vocabulary.test.ts` + extend `tests/behaviour/queue-park-causes-s17.test.ts` equality | Structure/Behaviour | Existing – Update | The delivered exact-equality assertion gains one appended member and one pair. |
| TC-SUP-046 | `tests/structure/supervision-additivity.test.ts`, `tests/behaviour/supervision-additivity.test.ts` | Structure/Behaviour | To Implement | New; record-kind equality, schema strings, pre-change replay. |
| TC-SUP-050, TC-SUP-054 | `tests/behaviour/supervision-claims.test.ts` | Behaviour | To Implement | New; daemon/coordinator/ref claims. |
| TC-SUP-051 | `tests/behaviour/supervision-duplicate-refusal.test.ts` | Behaviour | To Implement | New; three cells (acting authority, presence, held session) plus the retry-after-window control. |
| TC-SUP-052 | `tests/behaviour/supervision-single-flight.test.ts` | Behaviour | To Implement | New; consumes the delivered helper. |
| TC-SUP-053 | `tests/structure/supervision-nonregression.test.ts` (+ delivered suites unchanged) | Structure | To Implement | New; includes a "delivered files untouched" diff-free tree assertion (path allowlist, not a moving-base diff). |
| TC-SUP-060, TC-SUP-061, TC-SUP-062 | `tests/behaviour/supervision-restart.test.ts` | Behaviour | To Implement | New; budget, exhaustion, unevaluable. |
| TC-SUP-063 | `tests/structure/supervision-no-signal.test.ts` | Structure | To Implement | New; marker scan. |
| TC-SUP-070, TC-SUP-072 | `tests/structure/supervision-error-family.test.ts` | Structure | To Implement | New; mirrors `daemon-vocabulary` style with a delivered-table baseline fixture. |
| TC-SUP-071 | `tests/checks/supervision-error-socialization.test.ts` + update `tests/checks/error-table-sync.test.ts` expectations | Checks | Existing – Update | The delivered mutation suite gains the supervise rows and count deltas. |
| TC-SUP-080 | `tests/behaviour/supervision-determinism.test.ts` | Behaviour | To Implement | New; paired runs + replay. |
| TC-SUP-081 | `tests/behaviour/supervision-read-cost.test.ts` | Behaviour | To Implement | New; read counter. |
| TC-SUP-082 | `tests/behaviour/supervision-bounds.test.ts` | Behaviour | To Implement | New; 200/201 cells and evidence cap. |
| TC-SUP-083 | `tests/behaviour/supervision-performance.test.ts` | Behaviour | To Implement | New; single measured bound. |
| TC-SUP-084 | `tests/behaviour/supervision-evidence-totality.test.ts` | Behaviour | To Implement | New; structural walk. |
| TC-SUP-085 | `tests/behaviour/supervision-isolation.test.ts` + `tests/fixtures/supervision/temp-git.ts` | Behaviour | To Implement | New; guard and no-network. |
| TC-SUP-090, TC-SUP-091, TC-SUP-092 | `tests/golden/supervision-report.test.ts`, `tests/golden/supervision-failure.test.ts` + goldens | Golden | To Implement | Goldens **created** in this change: healthy report, stalled/parked report, evidence-absent envelope, per-action refusal envelope, and the paired live-claims data golden. |
| TC-SUP-093 | `tests/golden/lanes-show.test.ts` (update) + new parked goldens | Golden | Existing – Update | The delivered golden family gains the parked cell; existing cells unchanged. |
| TC-SUP-094 | `tests/structure/supervision-contract.test.ts` | Structure | To Implement | Reuses `dataOnlyViolations`. |
| TC-SUP-095 | `tests/structure/supervision-imports.test.ts` + update `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json` | Structure | Existing – Update | Inventory/export registration is a mandatory same-change edit. |
| TC-SUP-096 | `tests/structure/supervision-mounting.test.ts`, `tests/behaviour/supervision-help.test.ts`, reference page + help coverage inventory | Structure/Checks | To Implement | Family-count delta against one captured base + stale-pin scan. |
| TC-SUP-097 | content checks (no file to write in this change's test scope) | Docs | Manual Only | Evidence recorded in §10. |

Execution commands: `bun test tests/structure tests/behaviour tests/golden tests/checks` while iterating; `TMPDIR=$PWD/tmp/tmpdir pnpm check` for the gate.

### 7.2 Mocking and seam requirements

- Injected fakes only (no `mock.module`): clock, brand, run id, probe seam, store seam, process seam, network seam.
- The probe seam must be able to return "absent" distinctly from "zero" — the distinction TC-SUP-031 asserts.
- The store seam must count read passes (TC-SUP-081) and append kinds (TC-SUP-046).
- The process seam must record calls without performing them (TC-SUP-054, TC-SUP-063).

### 7.3 Delivered-suite edits this change is allowed to make

Exactly these, each additive: the park-cause/pair equality in `tests/behaviour/queue-park-causes-s17.test.ts` (+1 cause, +1 pair); the error-table expectations and counts in `tests/checks/error-table-sync.test.ts` (+2 rows, documented page, corpora); the inventory/export registries (`tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`); the lanes golden family (`tests/golden/lanes-show.test.ts` + new fixtures); the family-count pins (delta `+1`). Anything else that must change is a **finding**: a delivered mechanism changed, or a delivered token was renamed.

### 7.4 What PASS means, per level, and the evidence each delivery stage must leave

| Level | PASS definition |
|---|---|
| Static/diff | `git diff --check` clean; no conflict markers; every new path follows the repository conventions (`tests/**/supervision-*.test.ts`, `tests/fixtures/supervision/**`). |
| Structure | `bun test tests/structure` green, including exact closed-set equality both directions, one-home constants, data-only contract AST, no process markers, inventory/export registration, record-kind and taxonomy equality, and mounting counts. Any mutant named in §4.2 makes its case fail. |
| Behaviour | `bun test tests/behaviour` green, including every matrix cell executed (totality guard), the seed cases, both refusal cells (per-action duplicate-supervision and per-ref single-flight) with their presence and held-session controls, determinism pairs, read-count == 1, the 200/201 bound, the `< 5_000 ms` bound, evidence totality walk, and the isolation guard. |
| Golden | `bun test tests/golden` green against committed normalized goldens; the normalizer's replacement list asserted to be exactly three entries; delivered non-parked lanes goldens unchanged. |
| Checks | `bun test tests/checks` green, including the sync check on the live tree and every mutation failing with the offending row/code; help-guide coverage green. |
| Boundaries | `check:boundaries` (depcruise + ambient guard + workspace entrypoints + secret-read boundary) green with no new rule or exemption. |
| Docs/content | New `supervise` page present and first-spec-only clean; watchdog/daemon boundary text reconciled with zero residual contradictions; links resolve; doc-conformance green. |
| Aggregate | `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits `0`, with the output recorded in §10. |

| Delivery stage (phase ownership in `chg-GH-295-plan.yaml`) | Minimum evidence that stage must leave |
|---|---|
| Contracts and vocabularies (report schema, tri-state set, cause/pair, two error rows) | Structure level green for TC-SUP-045, TC-SUP-070, TC-SUP-094; the delivered-table baseline fixture committed; inventory updated. |
| Fold and classification (pure domain, delivered probes consumed) | Behaviour green for TC-SUP-010, TC-SUP-011, TC-SUP-012, TC-SUP-013, TC-SUP-014, TC-SUP-020, TC-SUP-021, TC-SUP-022, TC-SUP-023, TC-SUP-030, TC-SUP-031, TC-SUP-032; the matrix totality guard in place; the no-process-input structure case green. |
| Report projection and mounting | Behaviour/golden green for TC-SUP-001, TC-SUP-002, TC-SUP-003, TC-SUP-004, TC-SUP-005, TC-SUP-090, TC-SUP-096; mounting delta asserted; human render from the same evidence. |
| Actions (park, safe boundary, restart composition) | Behaviour green for TC-SUP-040, TC-SUP-041, TC-SUP-042, TC-SUP-043, TC-SUP-044, TC-SUP-047, TC-SUP-060, TC-SUP-061, TC-SUP-062, TC-SUP-063; park vocabulary/additivity structure green; `lanes show` parked behaviour + golden green. |
| Claims and refusals | Behaviour green for TC-SUP-050, TC-SUP-051, TC-SUP-052, TC-SUP-053, TC-SUP-054 (all three TC-SUP-051 cells and the retry control); non-regression assertions on the delivered suites and composition. |
| Bounds, determinism, latency, isolation | Behaviour green for TC-SUP-080, TC-SUP-081, TC-SUP-082, TC-SUP-083, TC-SUP-084, TC-SUP-085; determinism replay recorded; the 200-lane timing recorded with its measured value. |
| Failure envelopes and error socialisation | Golden green for TC-SUP-092 (evidence-absent envelope, per-action refusal envelope, paired live-claims data golden); checks green for TC-SUP-071, TC-SUP-072. |
| Documentation reconciliation | Content checks complete; TC-SUP-097 evidence recorded; doc-conformance green. |

A stage is **not** PASS-able on a partially green level: the aggregate gate is the final arbiter, and a level with a skipped or `.todo` case is reported as `PARTIAL` in §10 with the named reason. No case in this plan is expected to start as `PARTIAL` — the last blocking gap was closed by spec v1.1 DEC-8.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Testing risks

| ID | Risk | Mitigation in this plan |
|---|---|---|
| TR-1 | A delivery agent re-derives the pre-amendment refusal rule (a scope-level blanket refusal that lets a live daemon gate parks) and the refusal cases drift into encoding it. | TC-SUP-051's three cells pin DEC-8's three clauses against each other: the acting-authority cell must refuse, the presence cell must park at exit `0`, and the held-session cell must park without refusal. Any one inverted fails. |
| TR-2 | Goldens created in this change could bake a wrong key name into a permanent assertion. | Goldens are authored after the contract structure case (TC-SUP-094) pins the member set; the review compares the golden's members against DM-1 semantics; seed/DEC-fixed names are listed as non-negotiable in §3.4. |
| TR-3 | The classification matrix could pass vacuously (empty matrix, unmapped cell). | The matrix file declares an expected value per cell and the case fails when executed cells ≠ declared cells (non-vacuity guard per the testing strategy). |
| TR-4 | A "one read fold" assertion could pass because the seam is not wired. | The read counter is asserted `> 0` and exactly `1`; a mutant that reads per lane proves scale sensitivity. |
| TR-5 | Latency at the 200-lane cap could flake on a loaded CI host. | The spec is a hard 5,000 ms bound; the case asserts it with the cap population proven non-empty. If it flakes, the delivery reports the measured value rather than relaxing the bound silently. |
| TR-6 | The deliver-then-verify order could let a case be satisfied by an implementation that merely exists. | Every case is authored failing-first against its owning stage (§7.4); a stage that cannot go red is reported. |
| TR-7 | Consumed delivered record shapes drift during delivery. | Fixtures build through delivered seams and fail loudly when a seam is missing (GAP-T4), so a drift is a compile/test failure, not a silent approximation. |
| TR-8 | Scope leakage could hide in human text while the machine payload is clean. | TC-SUP-002 scans both projections for the foreign key. |

### 8.2 Assumptions

- **AMB-1 (empty scope)**: a readable store with zero records yields an empty, evidence-complete report at exit `0`; exit `2` is reserved for an absent or unreadable source. Basis: DEC-6 ("evidence-absent or state is unreadable") and F-1's report-as-truth. TC-SUP-005 asserts this; a one-line spec clarification is recommended but not blocking.
- **AMB-2 (member names)**: the report's member names for the tri-state, supervisor entries, and actions are bound by the delivery contract; this plan pins the seed names `repo` / `lanes[].ref` / `lanes[].heartbeat` / `lanes[].holder` and the DEC-2/DM-3 names `reason` / `until` as non-negotiable, and treats a divergence in the remaining names as a delivery finding to be reconciled in review rather than a test-plan rewrite.
- **AMB-3 (observation span)**: the declared observation span for corroboration is the delivered 300,000 ms stall bound window (NFR-1's "across that span"). Cells are seeded at that span.
- **AMB-4 (claiming versus acting actions)**: settled by DEC-8 — a park intent, including its safe-boundary path, is **non-claiming** and is refused by neither identity; the per-ref single-flight refusal attaches to an action that would acquire the ref claim (the restart admission, TC-SUP-052), and the duplicate-supervision refusal attaches to an acting action whose object an authority is actively acting on (TC-SUP-051). The battery still launches no lane session (NG-2).
- **AMB-5 (tools)**: the delivered helper seam shapes (store, process port, probe) are consumed as injected ports; a missing port is a delivery finding, not a reason to hand-build a record.

### 8.3 Open questions and specification gaps

| ID | Question / gap | Status | Consequence for this plan |
|---|---|---|---|
| OQ-TP-1 | No bound is declared for `supervisors[]` or `actions[]` entry counts (NFR-4 bounds the report at the 200-lane cap only), and the report's truncation-reason vocabulary is not enumerated. | Non-blocking — deferred to phase 4 (`@plan-writer`) with the delivery. | TC-SUP-082 asserts only the lane cap plus `truncated`/`truncationReason` semantics; no supervisors-count cap is asserted. |
| OQ-TP-2 | For a coordinator-lease claim, F-3's "supervision artifacts" are named only as "no lane record progress, no reconciliation or action evidence" — there are no lane records for a coordinator. | Non-blocking — interpreted as reconciliation records plus ledger-position movement. | TC-SUP-021 asserts those two classes; a coordinator-specific artifact class added later extends the case rather than contradicts it. |
| OQ-TP-3 | The exact reason vocabulary for a truncated supervision report (the delivered precedent uses `lane-cap` / `status-lanes-bound`). | Non-blocking — a delivery naming decision, invisible to requirements. | TC-SUP-082 asserts "a non-empty named reason from a declared set", not a literal. |
| OQ-TP-4 | ~~Whether a repeated battery run over an already-parked lane appends a second park record or is a no-op.~~ | **Settled by DEC-8(c)** — the park intent's safety is the delivered fenced append and write serialization, so a landed park refuses a second identical park. No longer an open question. | TC-SUP-044 and TC-SUP-051's held-session cell assert "no second identical park while the active park stands". |

**Gap status:** GAP-T1 was the only gap requiring the specification phase to be reopened, and it is **closed by spec v1.1 DEC-8** (Decision Log DEC-8; revised F-6, F-8, G-5, AC-F6-1, DEC-6, §6 Flow 4, §18, §23). Its resolution is recorded in §9. **No open gap remains in this plan.** OQ-TP-1, OQ-TP-2 and OQ-TP-3 are unchanged phase-4 items (report bounds beyond the lane cap, coordinator-claim artifact enumeration, truncation-reason vocabulary); OQ-TP-4 is settled by DEC-8(c) and is retained only as a closed record.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @test-plan-writer | Initial test plan from GH-295 spec v1.0: 51 cases across structure, behaviour, golden, checks, and docs levels; all eight ACs mapped; milestone seeds SC-M2-S2-01/02 reconciled per DEC-2 (parkReason → `reason` = `parked:liveness-stall`, seed `until` → DM-3 additive lane field) and mapped to concrete steps and assertions; delivered families mirrored for structure/behaviour/golden conventions; GAP-T1 reported as requiring a targeted specification amendment. |
| 1.1 | 2026-11-16 | @test-plan-writer | GAP-T1 resolution against **spec v1.1 DEC-8**: TC-SUP-051 rewritten as three cells (acting authority refuses per-action at exit `1` with the claim and holder named; live daemon presence parks at exit `0`; held-session park intent refused by neither identity) plus a retry-after-window control; TC-SUP-092 extended to the per-action refusal golden plus the paired live-claims data golden at exit `0`; AC-F6-1 flipped to **Covered**; index, §3.1, §5 details, §6 goldens/fixtures, §7.1/§7.4 mappings, TR-1, AMB-4 and §10 updated; OQ-TP-4 recorded as settled by DEC-8(c), OQ-TP-1..3 unchanged phase-4 items. IDs unchanged; 51 cases, none awaiting a decision. |
| 1.2 | 2026-11-17 | @test-plan-writer | Reference-path correction from DoR iteration 1: the two §2 rows naming retired pages replaced by the real current-truth homes (`feature-scheduling-engine.md`, `feature-queue-ready.md`, `feature-peak-pausing.md`); the landing-page path corrected to `doc/00-index.md`. No case, ID, coverage row, or assertion changed. |
| 1.3 | 2026-11-17 | @test-plan-writer | DEC range alignment with spec v1.1 DEC-8: §2's spec row now reads `DEC-1..DEC-8`. No case, ID, coverage row, or assertion changed. |

## 10. Test Execution Log

No cases have been executed at authoring time (verification map only). Phase ownership of these cases is declared in `chg-GH-295-plan.yaml` (phase 4).

| TC ID / group | Run date | Result | Notes |
|---|---|---|---|
| — | — | — | Populated during delivery. Record for each stage: the exact command, the exit, and either "PASS" or "PARTIAL (reason)". |

Append-only gate evidence to record here when it exists: `TMPDIR=$PWD/tmp/tmpdir pnpm check` output summary; the determinism replay record; the measured 200-lane latency; the golden-regeneration command used (if any); the doc-reconciliation review record for TC-SUP-097; and a `PARTIAL` note with its reason if any case is ever skipped. No case awaits a decision: TC-SUP-051 and TC-SUP-092 are fully specified against DEC-8.
