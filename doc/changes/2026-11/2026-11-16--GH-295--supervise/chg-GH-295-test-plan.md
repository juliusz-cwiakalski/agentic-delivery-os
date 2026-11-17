---
id: chg-GH-295-test-plan
status: Updated
version: 1.6
created: 2026-11-16T23:50:00Z
last_updated: 2026-11-17T15:05:00Z
owners: [engineering]
service: delivery-os supervision plane (operator-facing supervise battery over the resident dispatch daemon's lanes)
labels: [change, m2, supervise, daemon, lanes, watchdog, queue, state]
version_impact: minor
summary: "Pin the M2-S2 supervise battery as comparisons over durable-record folds: one operator-invoked run over the invoking checkout's managed repository projects a schema-versioned `delivery.supervision.v1` report carrying the scope key, one tri-state entry per lane (ref, heartbeat, live holder) and per supervision claim, the actions applied, counts, degradation, and named truncation; classification is a pure artifact-evidence fold over delivered daemon/queue/dispatch/phase/commit records where only the full corroboration combination (heartbeat age at or beyond the delivered 300,000 ms bound AND zero artifact progress) reads `stalled`, any advancing evidence reads `progressing` (prefill-safe), and absent evidence reads `unknown` and is never guessed — with no process-derived field in the classification input shape at all; lying liveness (advancing heartbeats over a flat artifact trail) classifies stalled by artifact evidence (the ticket AC), a corroborated lane stall is parked through the delivered park machinery with the new `liveness-stall` cause mapped onto the delivered expiry-carrying condition type and a non-null `until` (the cause is battery-written only — the operator path refuses `queue release --park liveness-stall` by name and every cause–writer pair either round-trips a park its own guard accepts or is refused, DEC-9(a); a `provider-window`-mapped park can never be appended with an empty `until`; over an actively held session the durable park record itself is the intent, reported as `safe-boundary-park-intent` with zero session effect and zero signals and an operator-visible outcome identical to the unheld case, DEC-9(b)), so `lanes show <ref>` reads `state: parked`, `reason: parked:liveness-stall`, and the additive active-park `until` exactly when an expiry-carrying park is active; duplicate supervision is read-time only (per-ref double-claims refuse through the delivered `queue.single-flight` identity naming the holder, and the one appended duplicate-supervision identity fires as a per-action refusal against a supervision authority actively acting over the targeted object — the acting artifact being the delivered `daemon.preemption` pending record read inside the imported corroboration bound, record-only detection with authority classes that leave no durable record declared as a detection limit (DEC-9(c)), and its run projects the failure envelope at exit 1, while claim tri-states and holders always ride report data at exit 0, daemon presence alone refuses nothing, and a park intent is a non-claiming action refused by neither identity, DEC-8), restart admission rides the delivered budget and resume economics with terminal exhaustion plus a typed question, nothing is silently requeued, no process is ever signalled, the error table gains exactly two retryable identities bound in both directions, determinism replays byte-identically under an injected clock, one whole-store read fold per run governs the decision path (park, restart, and claim decisions reuse the fold snapshot with no per-lane whole-store re-read, while the delivered append helpers' own bounded read-backs are declared rather than denied; DEC-9(d)), and a 200-lane run completes under 5,000 ms offline; a stalled lane is parked only when it carries no active park of any cause — an existing owner-hold, peak-window, or stuck clear-observed park is respected instead of stacked, so the delivered duplicate-active-park validator is never tripped and every action leaves `queue`/`lanes` reads healthy — and the typed exhaustion question is identity-stable per ref across repeated runs with different injected run ids (DEC-9(f)) (exactly one terminal record and one decision question; the run id is metadata, never identity); the inherited milestone seeds SC-M2-S2-01 and SC-M2-S2-02 are reconciled per DEC-2 (`parkReason` to the delivered `reason` template, the seed `until` to DM-3) and mapped to concrete cases; the refusal gap this plan reported as GAP-T1 is closed by spec v1.1 DEC-8, the delivery-time resolutions by spec v1.2 DEC-9, and the review-iteration-2 resolutions by spec v1.3, so all 58 cases are fully specified and executable."
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
- The supervised-stall park: one new cause value in the closed park-cause set, the declared many-to-one condition mapping, a non-null re-entry instant, the corroborating evidence on the record, the battery-only write discipline with the operator path refusing the cause by name and every cause–writer pair either round-tripping a park its own guard accepts or being refused, the empty-expiry hardening of the mapped condition type, the park-state interaction that respects an existing owner-hold, peak-window, quota, close-item-preemption, or stuck clear-observed park (DEC-9(e)) instead of stacking a second active park, healthy post-action reads, the safe-boundary path for an actively held session (the durable park record as the intent carrier), recovery only through the delivered classification, and the delivered `lanes show` read reflecting state, classified reason, and the additive `until` (F-5; AC-F5-1; DM-2, DM-3, DM-4; DEC-2, DEC-7, DEC-9(a)(b)(e); SC-M2-S2-02).
- Duplicate-supervision read-side truth: daemon instance claim, coordinator ledger-lease claim, live per-ref lease, each classified and named; per-ref double-claims refusing through the delivered single-flight identity with the holder named; the acting-authority artifact class read as the delivered `daemon.preemption` pending record inside the imported corroboration bound, with authority classes that leave no durable record declared as a detection limit rather than inferred into a gate; delivered lock/lease/single-flight mechanisms unchanged; production composition still supervise-only (F-6; AC-F6-1; DEC-3, DEC-8, DEC-9(c)).
- Restart-policy composition: admission through the delivered budget and resume economics for `liveness-stall`-parked lanes only, terminal exhaustion plus one identity-stable typed question per ref (the run id is record metadata, never the question's identity), the declared unavailable outcome for an unevaluable admission, no silent requeue, no reported action for a record that did not land, the never-signal discipline, and the injected run identity reaching every appended restart/exhaustion record as metadata (F-7; AC-F7-1; DEC-7, DEC-9(f); NFR-3, NFR-7).
- Error-table binding: exactly two appended `supervise` identities with declared category, retryability, and exit projection; zero delivered rows changed; both-direction binding through the delivered check (F-8; AC-F8-1; DEC-6).
- Determinism, the exact read discipline (one decision fold per run plus the delivered append helpers' declared read-backs, and no per-lane whole-store re-read), truncation, the human render as delivered (one line per entry, bounded by the lane cap, with no numeric byte bound claimed), latency, evidence totality and its cap, and offline isolation (NFR-3, NFR-4, NFR-5, NFR-6, NFR-7; DEC-9(d)).
- Composed-production verification: the production supervise wiring (park write port, economics closures, question raise) is exercised over a real checkout and consumes one shared closure factory with the test harness, so a production-only drift cannot stay green (F-6, F-7; AC-F6-1, AC-F7-1).
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
- **[GAP-T5 — resolved]** Review iteration 1 (`code-review/review-iter-1.yaml`) found the delivered battery honest but the requirements chain and several assertions still encoding unbuilt or unbounded mechanisms: a legal operator path writing a park record its own guard rejects (F-1), per-lane whole-store re-reads on the action path (F-2), and a deferred safe-boundary landing that was never built (F-4), plus assert-level gaps (F-6..F-9, F-11..F-13). These are **closed by spec v1.2 DEC-9(a)-(d) and this plan's v1.4 amendment**: TC-SUP-043 is rewritten to the delivered safe-boundary intent carrier, TC-SUP-051 is aligned to the `daemon.preemption` acting-authority class with an explicit detection-limit cell, TC-SUP-100..TC-SUP-103 are added (closed-set cause/writer round-trip, operator refusal, empty-expiry hardening, action-path one-fold), and the named existing cells are re-pointed at the corrections the remediation will make. No cell awaits a decision.
- **[GAP-T6 — resolved]** Review iteration 2 (`code-review/review-iter-2.yaml`) found the iteration-1 blocker genuinely closed but two defects of the same families still live: the battery appends a **second active park** when the lane is already parked under a *different* cause, which trips the delivered duplicate-active-park validator and makes every later `queue`/`lanes` read return `state.store.torn` (F-1 critical); and the F-8 run-id fix made the typed exhaustion question **run-scoped**, so every repeated run appends another owner-facing decision question (F-2 high). It also found the one-fold claim overstated for composed acting runs (F-3) and the harness still re-implementing production closures (F-4), plus two low residuals (a tautological normalizer assertion, F-7 there / F-17 in iteration 1, and an unbounded "bounded human render" claim, F-8 there / F-19 in iteration 1). All six are **closed by spec v1.3 (DEC-9(e) park-state interaction, DEC-9(f) question idempotence, the restated DEC-9(d)/NFR-4 read discipline, and §22's composition proof obligation) and this plan's v1.5 amendment**: TC-SUP-104 (park-state interaction), TC-SUP-105 (composed production), TC-SUP-106 (normalizer volatile-field integrity), the TC-SUP-061 question-identity rewrite, the TC-SUP-103 read-discipline rewrite, and the TC-SUP-082 human-render statement. No cell awaits a decision.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-295-spec.md`](./chg-GH-295-spec.md) | Binding source (**spec v1.4**): F-1..F-8 (including the DEC-9-revised F-2 action-path fold, F-5 safe-boundary intent carrier and park-state interaction, F-6 acting-authority artifact class, and the v1.3 question-identity and exact read-discipline resolutions), AC-F1-1..AC-F8-1, DM-1..DM-4, EVT-1, NFR-1..NFR-7 (NFR-4 carrying the exact read discipline), RSK-1..RSK-6, DEC-1..DEC-9 (with DEC-9(e) park-state interaction and DEC-9(f) question idempotence from spec v1.3, and the spec v1.4 attribution fix: the append seam performs no dedupe — the caller's occupancy gate is the protection), OQ-1, G-1..G-7, §6 flows 1–5, §7 boundaries, §8.5 backward compatibility, §17 AC table and traceability paragraph. |
| [`code-review/review-iter-1.yaml`](./code-review/review-iter-1.yaml) | Review iteration 1 (local mode, verdict FAIL): findings F-1 (critical, operator-path park record the guard rejects), F-2 (high, per-lane whole-store re-reads on the action path), F-4 (high, deferred safe-boundary landing never built) drove spec v1.2 DEC-9(a)-(d); findings F-6, F-7, F-8, F-9, F-11, F-12, F-13 drove the assertion-level corrections and the four added cases in this plan's v1.4 amendment. |
| [`code-review/review-iter-2.yaml`](./code-review/review-iter-2.yaml) | Review iteration 2 (local mode, verdict FAIL): F-1 (critical, second active park under a different cause tears every later read), F-2 (high, duplicate exhaustion questions across different run ids), F-3 (medium, one-fold claim false on composed acting runs — 8 reads measured, TC-SUP-103 passing via a store-free fake), F-4 (medium, harness re-implements production closures), plus the two low residuals (tautological normalizer assertion; unbounded human-render claim) drove this plan's v1.5 amendment and spec v1.3. |
| [`chg-GH-295-pm-notes.yaml`](./chg-GH-295-pm-notes.yaml) | Delivery state, ticket AC restatement, the two inherited seeds as recorded at clarify_scope, delivered-dependency verification (M1-S1, M1-S18), and delivery conventions (gate command, PR target `main-tools`, commit body width). |
| [`chg-GH-295-plan.yaml`](./chg-GH-295-plan.yaml) | Declares phase ownership of these cases (mirrored in §7.4); the PASS definitions live here, not there. |
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
| AC-F1-1 | One managed repository with an active lane; the battery runs and the report carries `repo` equal to that single managed repository key plus one lane entry with the lane's `ref`, last heartbeat observation (the lane's own latest observation, never the scope instance's heartbeat — the fallback, if ever taken, is declared as a degradation marker), and live lease holder; the report names no repository other than its own scope key. (Seed `SC-M2-S2-01`.) | TC-SUP-001, TC-SUP-002, TC-SUP-004, TC-SUP-005, TC-SUP-090 | Suite; Golden | Covered |
| AC-F2-1 | Folded lanes and claims classify to exactly one of `progressing` / `stalled` / `unknown`: advancing evidence → `progressing`; the full corroboration combination (heartbeat age at/beyond the delivered 300,000 ms bound AND zero artifact progress across the span) → `stalled`; absent or insufficient evidence → `unknown`, never guessed or defaulted; no process-derived value exists in the classification input shape; a lane already parked under another cause is still classified and reported honestly rather than reclassified to suit the action. | TC-SUP-010, TC-SUP-011, TC-SUP-012, TC-SUP-013, TC-SUP-014, TC-SUP-022, TC-SUP-023, TC-SUP-104 | Suite; Suite + mutation | Covered |
| AC-F3-1 | A lane or supervision claim whose recorded liveness continues while the artifact trail shows no phase completion, no recorded commit, no attempt progress, and no ledger-position movement across the span classifies `stalled` by artifact evidence alone; conversely advancing artifact evidence keeps `progressing` regardless of any process-shaped reading. (Ticket AC.) | TC-SUP-020, TC-SUP-021, TC-SUP-022, TC-SUP-054 | Suite; Suite + mutation | Covered |
| AC-F4-1 | The battery consumes the delivered watchdog probes, classification, corroboration bound, and prefill-safe rule instead of reimplementing them; an absent signal source contributes `unknown` rather than a coerced zero; no CPU-shaped or other process-shaped fact enters any evaluation. | TC-SUP-030, TC-SUP-031, TC-SUP-032, TC-SUP-014 | Suite; Suite + mutation | Covered |
| AC-F5-1 | A lane with a heartbeat beyond the stall threshold and a corroborating flat artifact trail is recorded as parked through the delivered park machinery with the classified supervised-stall cause and a non-null re-entry instant; `lanes show` reports state `parked`, the classified reason, and the active park's re-entry instant. The cause is battery-written only — every cause–writer pair either round-trips a park its own guard accepts or is refused by name, the operator path refuses `--park liveness-stall` with the delivered identity naming the cause, and a `provider-window`-mapped park can never be written with an empty/missing `until`. The append is gated on no active park of any cause: a lane carrying an owner-hold, peak-window, quota, close-item-preemption, or stuck clear-observed park is respected — no second active park is appended, the run still reports the lane honestly, and `queue`/`lanes` reads stay healthy. Over an actively held session the durable park record carries the intent immediately, the action reports `safe-boundary-park-intent`, session effect and signals are zero, and the operator-visible outcome is identical to the unheld case. (Seed `SC-M2-S2-02`; DEC-9(a)(b)(e).) | TC-SUP-040, TC-SUP-041, TC-SUP-042, TC-SUP-043, TC-SUP-045, TC-SUP-046, TC-SUP-047, TC-SUP-091, TC-SUP-093, TC-SUP-100, TC-SUP-101, TC-SUP-102, TC-SUP-104, TC-SUP-105 | Suite; Golden; Suite + mutation | Covered |
| AC-F6-1 | Live supervision claims intersecting the scope (daemon instance claim live under the delivered heartbeat-staleness fold, coordinator ledger-lease claim, live per-ref lease naming its holder) are carried with tri-state and holder **whether or not any action is refused**; an action that would double-claim a ref with a live holder is refused with the holder named through the delivered single-flight identity; an action whose object another supervision authority is **actively acting on** is refused with the duplicate-supervision identity naming the live claim and holder, the acting evidence being the delivered `daemon.preemption` pending record inside the imported corroboration bound (record-only detection, with authority classes that leave no durable record declared as a detection limit rather than inferred into a gate), and that run projects the failure envelope at exit `1` while a run whose actions all succeed (or need none) reports data at exit `0` even with live claims present; a live resident daemon's existence alone refuses nothing; a park intent, including its safe-boundary intent path, is refused by neither identity and lands through the delivered fenced append; no delivered lock/lease/single-flight mechanism changes; no lane composition is required; the composition that runs these paths is the production one, exercised over a real checkout. (DEC-8, DEC-9(c).) | TC-SUP-050, TC-SUP-051, TC-SUP-052, TC-SUP-053, TC-SUP-054, TC-SUP-092, TC-SUP-103, TC-SUP-105 | Suite; Golden | Covered |
| AC-F7-1 | A stalled `liveness-stall` lane with budget remaining admits a restart through the delivered budget and resume economics and appends the delivered restart record; on exhaustion the delivered terminal exhaustion record lands and the typed question is raised — exactly once per ref across repeated runs with different injected run ids, since the run id is record metadata and never the question's identity (DEC-9(f)); exhaustion never silently requeues, an unevaluable admission is reported as the declared unavailable outcome, no action is reported for a record that did not land, no process is ever signalled, and every appended restart/exhaustion record carries the run's injected identity as metadata. | TC-SUP-060, TC-SUP-061, TC-SUP-062, TC-SUP-063, TC-SUP-044, TC-SUP-104, TC-SUP-105 | Suite | Covered |
| AC-F8-1 | Exactly two identities are appended to the closed union (duplicate-supervision refusal at exit `1`, retryable; evidence-absent unknown answer at exit `2`, retryable); every other outcome reuses a delivered identity; no delivered row changes; machine rows, documented rows, and the corpus are bound in both directions by the delivered binding check. | TC-SUP-070, TC-SUP-071, TC-SUP-072, TC-SUP-092 | Suite; Suite + mutation; Golden | Covered |

Ticket-to-criteria mapping carried verbatim from spec §17: ticket AC ("a stuck supervisor is detected by artifact evidence, not process state") → AC-F3-1, reinforced by AC-F2-1 and AC-F6-1 (cases TC-SUP-020, TC-SUP-021, TC-SUP-010, TC-SUP-050). Ticket tasks map: tri-state status → AC-F2-1; progress watchdogs → AC-F4-1; duplicate-supervisor detection → AC-F6-1; lying-liveness signals by artifact evidence → AC-F3-1; restart policies over the resident dispatch daemon → AC-F7-1; supervisor battery and the stall park → AC-F1-1, AC-F5-1.

Goal coverage (spec §4): G-1 → AC-F1-1, AC-F2-1; G-2 → AC-F2-1, AC-F4-1 (TC-SUP-014, TC-SUP-022); G-3 → AC-F3-1 (TC-SUP-020, TC-SUP-021, TC-SUP-022); G-4 → AC-F5-1 (TC-SUP-040, TC-SUP-041); G-5 → AC-F6-1 (TC-SUP-050, TC-SUP-052, TC-SUP-053); G-6 → AC-F7-1 (TC-SUP-060, TC-SUP-061, TC-SUP-063); G-7 → AC-F1-1, AC-F2-1, AC-F8-1, DEC-6 (TC-SUP-012, TC-SUP-013, TC-SUP-072).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP surface is added or changed (spec §8.1), so there is no API-# family. The local command surface and the consumed local reads are covered as follows.

| ID | Element | TC ID(s) | Notes |
|----|---------|----------|-------|
| DM-1 | Supervision report payload `delivery.supervision.v1`: scope key; `lanes[]` (ref, tri-state, last heartbeat observation, live holder present exactly when a live lease exists, evidence); `supervisors[]` (claim identity, tri-state, last heartbeat observation, scope evidence); `actions[]` with evidence; counts; degradation markers; bounded truncation with a named reason; the run's recorded instant. | TC-SUP-001, TC-SUP-004, TC-SUP-050, TC-SUP-082, TC-SUP-090, TC-SUP-091, TC-SUP-094 | Shape totality (TC-SUP-004), one-home member declaration (TC-SUP-094), goldens (TC-SUP-090, TC-SUP-091), truncation (TC-SUP-082). |
| DM-2 | Supervised-stall park cause `liveness-stall`: one declared value appended to the closed cause set; mapped onto the delivered condition type whose evaluable shape carries an absolute re-entry instant; the park names corroborating evidence and carries a non-null `until` at the declared stall recheck horizon; re-evaluation rides the mapped condition type's declared recheck default; the cause is battery-written only (every cause–writer pair either round-trips a park its own validator accepts or is refused by name on the operator path, and the mapped condition type can never be built from an empty expiry); the battery appends only when the lane carries no active park of any cause (DEC-9(e)), so an owner-hold, peak-window, quota, close-item-preemption, or stuck clear-observed park is respected rather than stacked. | TC-SUP-040, TC-SUP-041, TC-SUP-042, TC-SUP-045, TC-SUP-046, TC-SUP-091, TC-SUP-093, TC-SUP-100, TC-SUP-101, TC-SUP-102, TC-SUP-104 | Closed-set equality both directions; mapping and recheck default asserted from the delivered constants, not hard-coded; writer round-trip per cause; empty-expiry guard asserted at the append seam; park-state cells assert zero appends beside an existing active park and a healthy delivered read afterwards. |
| DM-3 | Active-park re-entry instant on the lane projection: additive optional `until`, present exactly when an active expiry-carrying park exists, absent otherwise, never inferred or defaulted. | TC-SUP-041, TC-SUP-042, TC-SUP-093, TC-SUP-104 | Includes the negative twin (owner-hold/parked-without-expiry carries no `until`) and the park-state cells, where an existing park's projection is unchanged by the run. |
| DM-4 | Additive record discipline: no new record kind; appends only through the delivered park/restart/terminal-exhaustion paths; no in-place mutation, no schema bump, no migration; no append ever creates a second active park for one ref (the delivered duplicate-active-park validator is never tripped, so reads stay healthy). | TC-SUP-046, TC-SUP-061, TC-SUP-094, TC-SUP-104 | Record-kind set equality, pre-change replay, and post-action healthy-read assertions. |
| EVT-1 | No new topic and no new event kind; a supervised stall park is visible through the delivered lanes snapshot projection on the next publish. | TC-SUP-041 (projection half), TC-SUP-094 (taxonomy half) | The projection assertion consumes the delivered publish frame; the taxonomy assertion is the delivered drift/additivity suites passing **unchanged**. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (abridged) | TC ID(s) | Evidence |
|-----|------------------------|----------|----------|
| NFR-1 | `stalled` only on heartbeat age ≥ 300,000 ms AND zero artifact progress across the span; partial/advancing → `progressing`. | TC-SUP-010, TC-SUP-011, TC-SUP-023, TC-SUP-030 | Matrix cells at just-below / at / just-above the bound with flat and advancing trails. |
| NFR-2 | Evidence purity: no pid, process start time, or CPU field in the classification input shape; a process-only reading can never classify a verdict — asserted structurally, like the delivered watchdog no-CPU rule; and no declared input member is dead (every member of the shape is consumed by the classifier). | TC-SUP-014, TC-SUP-022, TC-SUP-054, TC-SUP-063 | Source scan (marker list), shape-member equality plus a consumed-member assertion, behavioural CPU/pid-shaped twin. |
| NFR-3 | Determinism: identical record sets + injected clock → identical report, evidence, actions, exit; evidence names refs, record kinds (the source kind per claim type), instants, codes; the golden normalizer replaces only the declared volatile fields, which never appear in a committed golden. | TC-SUP-080, TC-SUP-090, TC-SUP-091, TC-SUP-050, TC-SUP-092, TC-SUP-106 | Paired runs, replay from a captured record set, byte-exact goldens, per-claim-kind record-kind assertions, and a behavioural normalizer test over crafted volatile values. |
| NFR-4 | The read discipline stated exactly (DEC-9(d)): **one decision fold per run** (the delivered publish-tick read) supplies park, restart, and claim decisions, with **no per-lane whole-store re-read**; the delivered append helpers' own read-backs are declared and bounded (a restart append, an exhaustion append, the blocker ledger, and the blocker-question coverage read each occur a bounded number of times per run, never per lane) — measured over the composed production closures, not a fake; 200-lane cap with explicit truncation and a named reason; evidence respects the delivered evidence caps, including the single-oversized-entry boundary. | TC-SUP-081, TC-SUP-082, TC-SUP-103, TC-SUP-105 | Instrumented read log over a composed acting run: exactly one decision-path whole-store read, append read-backs within the declared per-run budget and flat against lane count; 201 lanes → 200 entries + `truncated` + named reason; evidence byte cap never exceeded (marker included). |
| NFR-5 | A full run at the 200-lane cap completes within 5,000 ms wall-clock in the offline behaviour suite. | TC-SUP-083 | Single measured run with a non-vacuous bound; no percentile smoothing. |
| NFR-6 | Every tri-state entry, every action, and every refusal carries non-empty evidence; failure evidence rides the failure summary, success evidence rides the report fields; no placeholder value stands in for evidence, and an over-cap evidence list is truncated with a declared marker (never silently cut, never exceeding the cap). | TC-SUP-084, TC-SUP-012, TC-SUP-082, TC-SUP-092 | Completeness control over a mixed-scope fixture, the forbidden-placeholder set, the evidence-cap boundary cell, plus the failure envelopes. |
| NFR-7 | Offline: every behaviour runs against a real temporary repository with injected clock, brand, and run identity; no network anywhere; a fixture guard rejects any root equal to the live workspace. | TC-SUP-085, TC-SUP-001 | Guard rejection assertions (live root, non-temp root) and a no-network recording seam. |

### 3.4 Inherited Seed Reconciliation (SC-M2-S2-01, SC-M2-S2-02)

Both seeds are inherited by name from the M2 pack and are reproduced here exactly as they assert. Per DEC-2 the second seed's label meets the delivered vocabulary and is reconciled, not restated; the reconciliation is recorded as a binding table so no case silently invents a field.

| Seed | Seed assertion (verbatim) | Reconciled form in this plan | Cases |
|---|---|---|---|
| `SC-M2-S2-01` — Supervision battery reports lane liveness per repository | "`supervise.data.lanes[]` has one entry with `ref`, `heartbeat`, and `holder`, and `supervise.data.repo` equals the single managed repo key." | No change of label is required: the new payload's scope member is `data.repo` and its lane entry carries `ref`, `heartbeat` (the lane's own last heartbeat observation — its daemon lane record's recorded observation instant, not a copy of the scope instance's heartbeat and not a process reading; a fallback to the scope heartbeat, if ever taken, is declared as a degradation marker), and `holder` (the recorded live-lease holder, present exactly when a live lease exists, equal to the lease's recorded holder, never inferred). "Single managed repo key" is the same key the delivered per-repository surfaces report for the invoking checkout. The seed's completeness control adds the positive restriction: the payload names **no** other repository. | TC-SUP-001 (seed), TC-SUP-002 (scope completeness control), TC-SUP-090 (golden) |
| `SC-M2-S2-02` — Supervise parks a stalled lane with a classified reason | "`lanes show <ref>.data.state == "parked"` with a classified `parkReason` and a non-null `until`." | **Reconciled per DEC-2**: `parkReason` maps to the delivered lane `reason` field, which carries the delivered `parked:<cause>` template; the classified value is therefore `reason == "parked:liveness-stall"` — the new cause `liveness-stall` joined to the closed set, mapped onto the delivered condition type whose evaluable shape carries an absolute re-entry instant (`provider-window`), with the mapped condition type's declared recheck default governing re-evaluation. The seed's `until` maps to DM-3's additive lane-read `until`: non-null on a parked lane iff an active expiry-carrying park exists, equal to the park record's `until`, never inferred, never defaulted, absent (not null) otherwise. The park record itself is unchanged in kind and appends a non-null `until` plus the corroborating evidence. | TC-SUP-040 (seed), TC-SUP-041 (seed read half), TC-SUP-042 (additivity negative twin), TC-SUP-091 / TC-SUP-093 (goldens) |

Concrete reconciled steps (both seeds share the fixture shape; the assertions differ):

1. Build a real temporary repository with `git init -b main`, a fixed author identity, and one managed-repository key; open the delivered state store inside it; assert the fixture root is not the live workspace.
2. Seed, through the delivered append/state seams, one active lane `GH-295` with a recorded heartbeat at the injected clock's `now - 120_000 ms` (seed 01) or `now - 300_000 ms` and a flat artifact trail across the span (seed 02), plus a live lease naming holder `holder-a` (seed 01 only) and a foreign repository's records in the same store (scope control, seed 01).
3. Run the battery once through the in-process program runner with an injected clock, brand, run id, and captured stdout/stderr buffers; assert `exit 0` and exactly one read fold over the store.
4. **Seed 01 assertions**: `data.schemaVersion == "delivery.supervision.v1"`; `data.repo` equals the managed key; `data.lanes` has length 1; that entry's `ref`, `heartbeat`, and `holder` equal the seeded values exactly; its tri-state is `progressing`; its `evidence` is non-empty and references only refs/record kinds/instants/codes bounded to the scope; no string in the serialized payload equals or contains the foreign repository key; `counts` agree with the entries.
5. **Seed 02 assertions**: exactly one park record appends with `cause == "liveness-stall"`, `conditionType == conditionTypeForCause("liveness-stall")` (asserted through the delivered resolver, not a literal), `until` non-null and equal to the declared stall recheck horizon from the injected clock, `recheckMs` equal to the mapped condition type's declared default, and non-empty corroborating evidence; `data.actions` names the action with evidence; `exit 0`; then `lanes show GH-295 --json` reads `state == "parked"`, `reason == "parked:liveness-stall"`, `until` equal to the park's `until`, and `counts.parked == 1`; the human render carries the same three facts.

Reconciliation note: the seeds are the *minimum*. They do not cover supervision-claim entries, the unknown answer, lying-liveness on a claim, refusal identities, restart composition, determinism, bounds, latency, evidence totality, the park-state interaction with an already-active park of another cause (TC-SUP-104), additivity, or mounting. Those arrive as new cases in this plan, declared in §5 and recorded in §9.

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

- **Mutation discipline.** Every structure/vocabulary guard that protects a closed set or a count pin is accompanied by a named mutation performed in a temporary copy (`mkdtemp`), never in the live tree: duplicate the cause, rename the mapping target, duplicate the bound literal, add a third `supervise` error row, drop a documented row, drop a corpus row, add a process-shaped field to the input shape, add an unused declared input member. Each mutation must make its case fail with the offending field named. The behaviour guards over the park writers, the park state, the question identity and the action path carry their own named mutations: make the operator path accept the battery-only cause (TC-SUP-100/101 must fail naming the cause); stack a second active park beside an existing owner-hold park (TC-SUP-104 must fail on the zero-append and healthy-read assertions); make the typed question's id run-scoped (TC-SUP-061 must fail with two questions across the two runs); re-introduce a per-lane whole-store read on the action path (TC-SUP-103 must fail with the observed read count and call site); duplicate the production economics closure in the fixture (TC-SUP-105 must fail the one-factory assertion).
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
| Cause/writer round-trip | Every member of the delivered cause set either round-trips a park record its own validator accepts through its sanctioned writer, or is refused by name on the operator path; a cause with no writable expiry is refused rather than written with an empty expiry (DEC-9(a)). Mutant: accept `liveness-stall` on the operator path → the case fails naming the cause. |
| Expiry-carrying park guard | A `provider-window`-mapped park can never be appended with an empty or missing `until`; the guard refuses before the append and every later park read stays healthy (no `state.store.torn`). Mutant: drop the guard → the case fails on the torn-read assertion. |
| One fold for the action path | The park, restart, and claim **decisions** receive the fold's snapshot; no action path re-reads the whole store per lane (DEC-9(d)); the delivered append helpers' own read-backs are declared and bounded per run, not denied. Mutant: re-read per lane → the instrumented read port records a per-lane whole-store read and the case fails. |
| No second active park | The park append is gated on no active park of any cause (DEC-9(e)), judged by the delivered **one occupancy home** (`activeParkRecords` in the queue-park domain) that the supervision fold also uses — so the fold's `activePark` and the duplicate-active-park validator are the same answer by construction. A `parked` record occupies the ref until a `recovered` or `released` record clears it, and a `clear-observed` marker leaves that occupancy standing (the stuck class); an owner-hold, peak-window, quota, close-item-preemption, or stuck clear-observed park is therefore respected, the validator is never tripped, and every action cell ends by asserting the delivered park and lanes reads are healthy. Mutant: **latest-record-wins occupancy** — drop the sequence semantics and take the last park record per ref, treating a non-`parked` latest state as free — → the stuck `clear-observed` cell appends and fails with a torn store. |
| Question identity is ref-stable | (DEC-9(f).) The typed exhaustion question's identity derives from the ref (and the delivered ledger identity), never from the run id; the run id rides the exhaustion record as metadata only, one terminal record and one question exist per ref across repeated runs with different run ids, and no action is reported for a record that did not land. |
| One closure factory | The production supervise composition and the test harness consume **one** shared economics/append closure factory; a duplicated closure implementation in the fixture fails a structure case, so production-only drift cannot stay green. |
| No new record kind, no schema bump | The state record-kind set and every delivered payload schema version are unchanged; the park payload schema version is unchanged; the new report payload is the only new schema identity. |
| Event taxonomy unchanged | No new topic/kind in the delivered declared sets; the delivered taxonomy drift/additivity suites pass without edits. |
| No process-derived input | The classification input shape's member set is exact and contains no pid/start-time/CPU member; every declared member is consumed by the classifier (an unused member fails, so a dead member cannot weaken the exact-shape guard); the supervise domain/state/CLI source carries no CPU/pid marker; the delivered no-CPU guard is extended, not forked. |
| Scope purity | The scope key is the only repository identity the fold can emit; the source scan finds no second-repository read path in the supervise modules. |
| Inventory and export registration | New source files are registered in `tests/structure/inventory.json`; the contract export inventory (`tests/structure/content-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`) is updated in the same change; the inventory test fails on an unregistered export. |
| Mounting | Root help lists the new family; `PROMPT_REQUIRED_COMMANDS` equals the single captured mounted list **exactly** (set equality against one captured base plus the appended family, never prefix containment), the delivered steer case reads that same captured list, and a stale-pin scan covers every pin file; family help answers `--help` and `--version`; the reference page exists (help-guide coverage check); the family carries no product/binary literal outside the branding seam. |
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
| TC-SUP-043 | A stall over an actively held session appends the durable park immediately and reports the safe-boundary park intent | Corner Case | Behaviour | Critical | AC-F5-1, AC-F7-1, DEC-7, DEC-9(b) |
| TC-SUP-044 | A parked stall lane recovers only through the delivered classification — never a scratch re-dispatch or silent requeue | Negative | Behaviour | Critical | AC-F5-1, AC-F7-1 |
| TC-SUP-045 | The cause joins the closed set additively with exactly one declared condition mapping | Regression | Structure | Critical | AC-F5-1, DM-2, RSK-1, RSK-6 |
| TC-SUP-046 | No new record kind, no schema bump, and pre-change records replay unchanged | Regression | Structure + Behaviour | High | AC-F5-1, DM-4 |
| TC-SUP-047 | The park carries its corroborating evidence so a wrong park is auditable | Edge Case | Behaviour | High | AC-F5-1, RSK-3 |
| TC-SUP-050 | Live supervision claims are inventoried with tri-state, holder, and scope evidence | Happy Path | Behaviour | Critical | AC-F6-1 |
| TC-SUP-051 | A per-action double-act against an actively acting authority is refused naming the live claim and holder; presence alone refuses nothing; an authority class with no durable acting artifact is a declared detection limit | Negative | Behaviour | Critical | AC-F6-1, AC-F8-1, DEC-8, DEC-9(c) |
| TC-SUP-052 | A per-ref double-claim is refused through the delivered single-flight identity with the holder named | Negative | Behaviour | Critical | AC-F6-1, DEC-8 |
| TC-SUP-053 | The delivered lock, lease, single-flight, and supervise-only composition are unchanged | Regression | Structure + Behaviour | Critical | AC-F6-1, NG-6, DEC-3 |
| TC-SUP-054 | Duplicate detection reads records only: zero process-port, pid, or CPU reads | Regression | Structure + Behaviour | Critical | AC-F3-1, AC-F6-1, NFR-2 |
| TC-SUP-060 | Restart admission rides the delivered budget and appends the delivered restart record | Happy Path | Behaviour | Critical | AC-F7-1 |
| TC-SUP-061 | Exhaustion is terminal and loud: one terminal record and one ref-stable decision question across repeated runs with different injected run ids | Negative | Behaviour | Critical | AC-F7-1, DM-4 |
| TC-SUP-062 | An unevaluable admission reports the declared unavailable outcome | Corner Case | Behaviour | High | AC-F7-1 |
| TC-SUP-063 | The never-signal discipline holds: no kill, spawn, or signal seam is reached | Regression | Structure + Behaviour | Critical | AC-F7-1, DEC-7, NG-3 |
| TC-SUP-070 | Exactly two `supervise` identities are appended and no delivered row changes | Regression | Structure | Critical | AC-F8-1 |
| TC-SUP-071 | Machine rows, documented rows, and corpus bind in both directions | Regression | Checks + Mutation | Critical | AC-F8-1, RSK-6 |
| TC-SUP-072 | Every other outcome reuses a delivered identity with the declared exit | Edge Case | Structure + Behaviour | High | AC-F8-1, DEC-6 |
| TC-SUP-080 | Identical record sets and an injected clock replay to an identical report, evidence, actions, and exit | Regression | Behaviour | Critical | NFR-3 |
| TC-SUP-081 | One whole-store read fold for a read-only run, and no per-lane re-read | Regression | Behaviour | High | NFR-4 |
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
| TC-SUP-096 | Mounting: prompt-required membership by exact set, root and family help, reference page, branding seam | Regression | Structure + Checks | High | AC-F1-1 |
| TC-SUP-097 | Phase-7 documentation reconciliation is verified | Happy Path | Docs | Medium | AC-F1-1, AC-F2-1, AC-F5-1 |
| TC-SUP-100 | Closed-set cause/writer round-trip: every park cause either round-trips a record its own validator accepts through its sanctioned writer, or is refused by name on the operator path | Regression | Behaviour | Critical | AC-F5-1, DM-2, DEC-9(a) |
| TC-SUP-101 | The operator path refuses `queue release --park liveness-stall` with the delivered identity naming the cause, appends nothing, and leaves later reads healthy | Negative | Behaviour | Critical | AC-F5-1, DM-2, DEC-9(a) |
| TC-SUP-102 | The park write path cannot append a `provider-window`-mapped park with an empty or missing `until`; the guard refuses and state stays readable | Negative | Behaviour | Critical | AC-F5-1, DM-2, DEC-9(a) |
| TC-SUP-103 | The decision path is one fold: exactly one decision read, no per-lane whole-store re-read, measured over the composed production closures | Regression | Behaviour | Critical | NFR-4, AC-F6-1, DEC-9(d) |
| TC-SUP-104 | Park-state interaction: a stalled lane already parked under another cause gains no second active park, is reported honestly, and leaves healthy reads; restart admission stays `liveness-stall`-only | Negative | Behaviour | Critical | AC-F2-1, AC-F5-1, AC-F7-1, DM-2, DM-4 |
| TC-SUP-105 | Composed-production acting run: park, restart, and exhaustion through the production closure factory, with outcomes and the declared read discipline asserted | Happy Path | Behaviour + Structure | Critical | AC-F5-1, AC-F6-1, AC-F7-1, NFR-4 |
| TC-SUP-106 | The golden normalizer replaces exactly the declared volatile fields, and no committed golden carries one of them | Regression | Golden | High | NFR-3, DM-1 |

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
- The delivered state store opened inside it; one active lane `GH-295` with an advancing artifact (one phase completion), a live lease naming `holder-a`, and two deliberately different recorded instants: the lane's own daemon lane record carries its observation at `now - 120_000 ms`, while the scope's daemon instance heartbeat is at `now - 30_000 ms`.

**Steps**:

1. Run the battery once through the in-process program runner with `--json`, injected clock, brand, run id, and captured buffers.
2. Parse the machine payload and compare the seeded lane to the report's single lane entry.
3. Serialize the whole payload and scan every string value for repository keys.

**Expected Outcome**:

- Exit `0`; `data.schemaVersion == "delivery.supervision.v1"`; `data.repo` equals the managed key.
- `data.lanes` length `1`; the entry's `ref` and `holder` equal the seeded values exactly (the holder is the lease's recorded holder, not a copy of the ref).
- `heartbeat` equals the **lane's own** recorded observation (`now - 120_000 ms`) and not the scope instance's heartbeat instant (`now - 30_000 ms`) — the two are deliberately different in the fixture, so an entry that inherits the scope heartbeat fails. No fallback marker is present when a lane observation exists.
- The entry's classification is `progressing`; `evidence` is non-empty and names a ref, a record kind, an instant, and a code.
- `counts` sum to the entry population; `actions` is empty; `degraded` names the daemon-absent state rather than logging it aside.

**Notes / Clarifications**:

- Review finding F-6: the lane `heartbeat` is the lane's own observation (the delivered daemon lane record's recorded observation instant), never a copy of the scope instance heartbeat. The scope heartbeat is a declared fallback only, and taking it emits a degradation marker — an entry that silently inherits it fails this case.

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

- Three scopes: zero lanes and zero claims but a readable store with a daemon instance record; one lane; twelve lanes across mixed classifications. The many-lane scope carries two lanes whose own observations differ from each other **and** from the scope instance heartbeat, plus one lane with no lane-record observation at all (the fallback cell).

**Steps**:

1. Run the battery for each scope.
2. Assert the member set of `data` against the declared report member set (no member missing, no extra member).
3. Assert counts against the entries and actions against the durable records.
4. Assert each lane entry's `heartbeat` against its own lane record (per-lane, not the scope instance heartbeat), and assert the observation-less lane's fallback is declared as a degradation marker rather than silently inheriting the scope instant.

**Expected Outcome**:

- Every case carries the same declared member set (`repo`, `lanes`, `supervisors`, `actions`, `counts`, `degraded`, `truncated`, the run instant, plus `truncationReason` only when truncated).
- Counts are derived, never copied: they equal the entry populations in each cell.
- An empty lane population still carries an empty `lanes` array and a zero count (no member omitted, no `null` standing in for an absent collection).
- Lane heartbeats are per-lane: the two differing lanes report their own instants (a report where every lane shows the scope heartbeat fails), and the observation-less lane carries the declared fallback marker instead of an inherited value presented as its own.
- No declared report member is unused: every member of the declared shape is populated by at least one cell (a declared-but-never-written member fails the shape assertion).

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
2. Assert every declared member is consumed by the classifier: for each member, the classifier reads it (a member with no consumer fails naming the member). A declared-but-dead member is a defect because it weakens the exact-shape guard — the delivered heartbeat evidence is derived from first/last instants, so an ordinal member must either be read or be absent.
3. Scan the supervise contract, domain, state, and CLI modules for process markers (`pid`, `ppid`, `process.start`, `starttime`, `cpuUsage`, `cpuPercent`, `os.cpus`, `ps -o`, `getrusage`, `kill(`), case-insensitively.
4. Extend the delivered `coordinator-no-cpu` guard to include the supervise tier (one list, not a fork).

**Expected Outcome**:

- The member set contains no process-derived member and matches the declared artifact-only list exactly (an added member fails).
- Every member has a consumer in the classifier; an unused member fails naming it (review finding F-12), so the shape cannot carry filler that makes the exact-equality guard look stronger than it is.
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
- Immediately after the run, the delivered park read and `queue list --json` / `lanes list --json` all succeed: an append that leaves the ledger torn fails this case even when the appended record looks right (review iteration 2, F-1).

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

#### TC-SUP-043 - A stall over an actively held session appends the durable park immediately and reports the safe-boundary park intent

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, AC-F7-1, DM-2, DM-4, DEC-7, DEC-9(b), RSK-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-stall-park.test.ts` over the delivered preemption read seam (`packages/core/src/app/daemon-preemption.ts`, consumed read-only as in `tests/behaviour/daemon-preemption.test.ts`)
**Tags**: @backend

**Preconditions**:

- A stalled lane whose session is actively held: a live per-ref lease naming its own session holder.
- An unheld twin lane with the identical stalled trail, for the outcome comparison.
- Armed recording seams over the process port (kill/signal/stop/spawn) and over session start/resume.

**Steps**:

1. Run the battery once over the held lane; capture the report and the durable tree.
2. Assert the park record that appended in that same run: cause, condition type (through the delivered resolver), `until`, `recheckMs`, evidence.
3. Assert the report's action entry for that lane (kind, target, evidence) and the lane entry's classification.
4. Run the battery over the unheld twin; read `lanes show` for both lanes and compare state, reason, and `until`.
5. Assert the recording seams and the durable tree for absence: zero kill/signal/stop/spawn calls, zero session start/resume calls, no `daemon.preemption` record appended, and no pending/deferred landing artifact for the park.
6. Re-run the battery at the same injected instant: assert no second park and no newly created deferral state.

**Expected Outcome**:

- Exactly one `liveness-stall` park record appends **in the detecting run**, with the expiry-carrying condition type, a non-null `until` equal to the declared stall recheck horizon from the injected clock, the mapped `recheckMs`, and non-empty corroborating evidence. The park record itself is the durable intent — nothing is deferred, queued, or landed later (DEC-9(b)); the earlier "park lands at the next safe boundary" expectation is retired.
- `data.actions` names the action as `safe-boundary-park-intent`; the lane entry classifies `stalled`; exit stays `0` (the run succeeded).
- Zero session effect and zero signals: the process/kill/session seams record zero calls, and no delivered preemption record is written for this park (the close-item preemption payload's fixed cause/closeRef cannot carry it, and DM-4/NG-6 forbid bending it).
- The operator-visible outcome is **identical to the unheld case**: `lanes show` on the held lane reports the same `state == "parked"`, `reason == "parked:liveness-stall"`, and `until` as the unheld twin, and each report counts the park.
- The re-run appends nothing further and creates no deferral state: the caller's occupancy gate sees the lane still occupied by the landed park, so no second park is attempted (the append seam performs no dedupe — spec v1.4, DEC-9(e)).
- Mutants: report the action as a plain park (fails the action-kind assertion); write a `daemon.preemption` record for the park (fails the absence assertion); omit the immediate append in favour of a pending artifact (fails both the durable-tree and the `lanes show` assertions).

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

**Notes / Clarifications**:

- This case pins the vocabulary and the mapping only. Writability is a separate obligation: a cause that joins the set but cannot be written through any sanctioned writer — or is writable on an operator path whose grammar cannot supply its required expiry — is a defect even with an exact vocabulary (review finding F-1). TC-SUP-100/TC-SUP-101 assert the cause/writer round-trip and the operator refusal; TC-SUP-102 asserts the empty-expiry guard.

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
**Related IDs**: F-6, AC-F6-1, DEC-3, NFR-3
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
4. Assert each entry's heartbeat evidence `recordKind` is the source record kind for that claim type — daemon instance claims name `daemon.heartbeat`, coordinator lease claims name `coordinator.iteration`, live per-ref leases name `queue.lease` — asserted through the delivered record-kind constants, never a literal.

**Expected Outcome**:

- Every claim is present with its tri-state and identity; the live per-ref holder appears on the lane entry exactly as the lease records it.
- Liveness is folded from records using the delivered staleness bound (imported, not re-declared); no socket or process probe is consulted for liveness.
- Heartbeat evidence is reconstructible: each entry's evidence names the record kind the instant actually came from, so a coordinator claim's heartbeat is not reported as `daemon.heartbeat` (review finding F-7). The per-claim-kind record kinds are asserted per entry, not just "a record kind is present".
- No holder is inferred for the lease-less lane, and no lock token or credential appears.

**Notes / Clarifications**:

- The delivered live-claims golden carries the same per-claim-kind record kinds (TC-SUP-092) and is regenerated when this assertion lands.

---

#### TC-SUP-051 - A per-action double-act against an actively acting authority is refused, naming the live claim and holder

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, F-8, AC-F6-1, AC-F8-1, DEC-3, DEC-6, DEC-7, DEC-8, DEC-9(c), NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-duplicate-refusal.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- **Acting-authority cell**: lane `GH-295` already carries an active `liveness-stall` park (from a prior run, so no park intent is pending) and a restart admission is due within the delivered budget; a **delivered `daemon.preemption` pending record** — the only durable acting-authority artifact class (DEC-9(c)) — names the same object `GH-295`, with the acting authority's identity and holder carried on that record and its recorded instant inside the imported corroboration bound.
- **Presence cell**: the same corroborated stall with **no** prior park and **no** acting record, plus a live resident daemon instance claim seeded genuinely live (instance record and a heartbeat trail that ends at the injected `now`, inside the delivered heartbeat-staleness bound — never a stale trail presented as live).
- **Held-session cell**: the corroborated stall over a lane whose session is actively held (live per-ref lease naming its own session holder), with the delivered safe-boundary machinery available.
- **Detection-limit cell**: the same corroborated stall with a second supervision authority that leaves **no** durable `daemon.preemption` record (an authority mid-fold with no pending preemption artifact).

**Steps**:

1. Run the battery for the acting-authority cell; assert the envelope, exit, identity, and evidence.
2. Assert no acting record for `GH-295` appended by this run and no second park appended; assert the other authority's `daemon.preemption` record is untouched (byte-identical).
3. Re-run after the other authority's record leaves the acting window (injected clock advanced past the imported corroboration bound); assert the retry succeeds.
4. Run the battery for the presence cell; assert exit `0`, the park applied, and the daemon claim carried in `data.supervisors` with a live classification (`progressing`) and its holder.
5. Run the battery for the held-session cell; assert the park intent is refused by neither identity and that the durable park record appends immediately (carrier per TC-SUP-043).
6. Run the battery for the detection-limit cell; assert no refusal occurs and record the limit explicitly.

**Expected Outcome**:

- Acting-authority cell: the failure envelope (no `data`) with the duplicate-supervision identity at exit `1`, retryable, `not_landed`; evidence names the live claim and its holder verbatim from the `daemon.preemption` pending record, and names that record kind; no action lands; the delivered lock/lease/single-flight mechanisms are untouched. Detection is record-only and bound-scoped: the same record outside the imported corroboration bound refuses nothing (step 3).
- Retry: once the other authority's record is outside the acting window, the same run applies the restart and reports data at exit `0` — retryability is demonstrated, not asserted as prose.
- Presence cell: exit `0` with report data; the daemon claim's live tri-state and holder ride `data.supervisors` (the claim is genuinely live in the fixture, so this is the real DEC-8 presence control, not a stale claim dressed as live); the park lands — a live daemon's existence refuses nothing and never gates a park (DEC-8a/DEC-8b).
- Held-session cell: neither identity refuses the park intent; the durable park record appends immediately as the intent carrier and the action reports `safe-boundary-park-intent` (TC-SUP-043) — its safety is the caller's occupancy gate plus the delivered fenced append and write serialization (a landed park leaves the lane occupied, so a second run appends nothing, and the append seam performs no dedupe — spec v1.4), never the duplicate-supervision refusal (DEC-8c).
- Detection-limit cell: no durable acting artifact exists, so no duplicate-supervision refusal fires and the action proceeds — this is the **declared detection limit** (DEC-9(c)), asserted as a limit rather than papered over with a gate that has no artifact behind it. The cell fails if the implementation invents a process- or presence-derived acting signal to manufacture a refusal.
- Claim classification is never a refusal: in every cell that produces a report, all claims carry tri-state and holder in `data`.
- Claim evidence names its **source record kind** per claim type in every reporting cell (review finding F-7): the presence cell's daemon claim carries the daemon-heartbeat kind, and a coordinator claim carried alongside carries its iteration-record kind — no claim borrows another kind's label in either the report or the refusal evidence.

**Notes / Clarifications**:

- The guarded object is a supervision authority **actively acting** over the object the battery's action targets (DEC-8a) — the action's target object, not the scope at large. The acting-authority artifact class is the delivered `daemon.preemption` **pending** record (the only durable record naming an object another authority is acting on), read inside the imported corroboration bound; detection never scans processes (DEC-9(c), TC-SUP-054).
- An authority class that leaves no such durable record is a declared limit, not an inferred gate. The plan records it in §8.2/§8.3 so no later reader mistakes the absence of a refusal for an unimplemented check.
- The refused action is an acting action (here, restart admission). A park intent — including its safe-boundary intent path — is declared non-claiming (DEC-8c), which is what keeps AC-F5-1's park reachable in exactly the session-held case the park exists for.

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
**Related IDs**: F-7, AC-F7-1, DEC-7, NFR-3, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-restart.test.ts`
**Tags**: @backend

**Preconditions**:

- A stalled lane with restart budget remaining (ordinals below the delivered bound) and a delivered resume-economics fixture that admits.
- An injected run id distinct from every delivered literal (`supervise`), so a hard-coded identity cannot masquerade as the injected one.

**Steps**:

1. Run the battery.
2. Read the appended restart record and the run's `actions`.
3. Assert the budget store's ordinal moved by exactly one delivered step and that the resume-economics seam was consulted once.
4. Assert the restart record's `runId` equals the injected run id exactly, and that the run's action evidence echoes the same identity.

**Expected Outcome**:

- Exactly one delivered restart record appends with the delivered reason vocabulary and the corroborating evidence; the decision names the budget source (delivered `coordinator-restart`/dispatch store as declared) rather than a battery-local counter.
- The restart record's `runId` is the run's **injected** identity (review finding F-8): a record carrying a hard-coded `supervise` literal, or any identity other than the injected one, fails. The same identity is echoed in the run's action evidence, so a restart can be correlated with the run that caused it.
- `data.actions` counts the restart; exit `0`.
- No process signal; no queue requeue record; no tracker write.

---

#### TC-SUP-061 - Exhaustion is terminal and loud: one terminal record and one ref-stable decision question across repeated runs with different injected run ids

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DM-4, DEC-7, DEC-9(f), NFR-3, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-restart.test.ts`
**Tags**: @backend

**Preconditions**:

- A stalled lane at the delivered budget bound (exhausted) and an occupied ledger with one open question slot.
- Two runs of the same battery over that lane with **two different injected run ids** (e.g. `run-invocation-1`, `run-invocation-2`) — the control that the identity of the question does not move with the run.

**Steps**:

1. Run the battery for the first run id; assert the delivered terminal exhaustion record and the typed question record.
2. Run the battery again for the second run id over the unchanged, still-exhausted lane.
3. Assert the economics record population: exactly one terminal exhaustion record for the ref, and exactly one decision-needed question for the ref across both runs.
4. Assert the question's id is ref-stable and carries no run id (compare the two runs' observed id; assert it is identical and does not embed either injected run id).
5. Assert the second run reports **no** `exhaustion-record` action (nothing landed) and appends no second question; assert the exhaustion record's `runId` still names the run that landed it (metadata, not identity).
6. Assert nothing else changed: no restart record, no queue entry mutation, no requeue.

**Expected Outcome**:

- Exactly **one** terminal exhaustion record and exactly **one** decision-needed question exist for the ref after both runs, even though the two runs carry different injected run ids: the question's identity is ref-stable, so the run id can never manufacture a second owner-facing question (review iteration 2, F-2 — the pre-fix run-scoped id appended one question per run).
- The question id does not embed either run id (asserted by comparison and by a substring check); the exhaustion record's `runId` is the landing run's identity, i.e. useful metadata and never the identity key.
- The second run reports no `exhaustion-record` action, because nothing landed; an action reported for a record that did not land fails the case.
- No silent requeue, no scratch re-dispatch, no auto-reopen, no tracker write (NG-7).
- Idempotency is proven by record population, not by reusing one injected run id: a mutation that restores the run-scoped id makes the case fail with two questions.

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
- Evidence names the seam and the reason, and names the run's injected identity rather than a hard-coded `supervise` literal (review finding F-8); the run reports it and exits `0` (or `2` only if the state itself is unreadable, which is the second cell — asserted separately).
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

- The delivered process-port and kill recording seams; the supervise source tree; an injected run id distinct from every delivered literal.

**Steps**:

1. Scan the supervise modules for signal/spawn/kill members (`kill`, `SIGTERM`, `SIGKILL`, `process.kill`, `spawn(`, `execFile(`, `child_process`).
2. Drive every action path (park, safe-boundary park, restart, exhaustion) and assert the kill/spawn recording seam recorded zero calls.
3. Assert the safe-boundary path's carrier is the delivered park record (no preemption write), so no signal-shaped artifact is created for a park.
4. Drive a run that parks one stalled lane and restarts another in the same invocation; assert every appended record carries the same injected run identity, and structure-assert that no `supervise` run-id, session-id, or question-id literal is hard-coded in the supervise tiers.

**Expected Outcome**:

- Zero marker hits in the supervise tier and zero recorded calls across all action paths.
- The only durable writes are delivered park/restart/exhaustion appends; the delivered preemption machinery owns any later effect, and the park append is its own intent carrier (no preemption record is bent to hold it).
- Every appended record in the combined park-and-restart run carries the run's injected identity (review finding F-8); a hard-coded `supervise` literal fails the structure assertion with the file named.
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

#### TC-SUP-081 - One whole-store read fold for a read-only run, and no per-lane re-read

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-read-cost.test.ts`
**Tags**: @backend

**Preconditions**:

- A recording store seam counting read passes with call sites; a 50-lane **read-only** scope (a scope with no action pending).
- The acting twin of the same shape, whose read discipline is asserted in TC-SUP-103.

**Steps**:

1. Run the battery once and read the counter.
2. Run a second time with 200 lanes and compare the counter.
3. Assert the human projection performs no additional fold.

**Expected Outcome**:

- Exactly one whole-store read pass for a **read-only** run, independent of lane count (the delivered publish-tick read discipline); no per-lane read, no second fold for the human render.
- The acting-run case is not asserted here: a run that acts also performs the delivered append helpers' own read-backs, whose bounded total and call sites are asserted in TC-SUP-103/105. Claiming `1` for an acting run would be the iteration-2 error this split removes.
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
- A third cell whose evidence is a **single** entry large enough on its own to reach or exceed the delivered evidence cap — the boundary a pop-until-one-remains strategy misses (review finding F-11).
- The human render captured for the 200- and 201-lane cells, for measurement and inspection (review iteration 2, F-8 / iteration-1 F-19).

**Steps**:

1. Run the battery for every cell.
2. Assert entry count, `truncated`, `truncationReason`, and counts semantics.
3. Measure the maximal evidence entry against the delivered evidence byte cap.
4. Measure the single-oversized-entry cell: serialize the evidence including any truncation marker and compare its byte length against the cap.
5. Capture the human render for both lane cells; measure its line count and byte size and inspect it for a truncation marker or a declared bound.

**Expected Outcome**:

- 200 lanes → 200 entries, `truncated == false`, no `truncationReason` member; 201 lanes → 200 entries, `truncated == true`, and a named reason drawn from the declared reason vocabulary (not a free string, not `null`).
- Counts report the population truthfully (the cap is disclosed, never silently rounded).
- Evidence never exceeds the delivered cap; an over-cap evidence value is truncated with a declared marker, and truncation is counted rather than hidden.
- The cap is a hard upper bound on the **serialized** evidence, marker included (review finding F-11): the single-oversized-entry cell must fit inside the cap, so a strategy that stops popping at one remaining entry and then appends the marker fails. The accepted conventions are: fit entries until the marker also fits, or replace the remaining entry with the marker; either way the final serialized size is asserted `<=` the cap and the marker is the declared one.
- The human render is bounded **only by the lane cap**: one line per entry plus one evidence-code list per line, with no numeric byte or line cap and no truncation marker in the delivered renderer. Its size at the cap is **measured and recorded** (and visually inspected for the one-line-per-entry shape) instead of being asserted against a bound that does not exist — the earlier "bounded human render" claim is corrected to this delivered behaviour (review iteration 2, F-8 / iteration-1 F-19). `supervisors[]` and `actions[]` carry no separate numeric cap (OQ-TP-1).

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
- The same scope in an **acting** configuration (several stalled lanes to park, one admitted restart, one exhaustion, live claims), measured separately — the read-only fold alone does not prove the bound for a run that acts (review finding F-2).

**Steps**:

1. Measure one full run (`performance.now()` around the run), asserting the exit is the expected one.
2. Assert the elapsed wall-clock is `< 5_000` ms.
3. Repeat once and assert both runs stay under the bound (guards against a cold-start pass).
4. Measure the acting run (the TC-SUP-103 fixture): assert the bound, the entry count, and that the actions actually landed.

**Expected Outcome**:

- Both runs complete under 5,000 ms at the declared cap, and the assertion is non-vacuous (the run actually folded 200 lanes: entry count asserted in the same test).
- The acting run at the same cap also completes under the bound, so the latency claim covers the action path (park, restart, exhaustion) and not only a read-only fold.
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
2. Normalize only the temp repo root, the run id, and timing; compare the machine payload structurally to the golden; assert the committed golden itself carries none of those volatile values (the normalizer proof lives in TC-SUP-106).
3. Compare the human output byte-exactly to the golden.

**Expected Outcome**:

- Structural equality with the golden; the golden names `repo`, the lane's `ref`/`heartbeat`/`holder`, the tri-state, evidence, counts, and degradation.
- The golden's lane `heartbeat` is the lane's **own** recorded observation, deliberately different in the fixture from the scope instance heartbeat (review finding F-6): a golden that carries the scope instant, or that shows the same heartbeat for two lanes with different observations, fails. A fallback lane would have to show the declared degradation marker in the same golden.
- Every record-kind string in the golden's evidence is the source kind for the entry it belongs to (no claim reported as `daemon.heartbeat` when its instant came from another kind).
- Human output byte-exact; the normalizer touches nothing else, and its volatile-field discipline is asserted behaviourally in TC-SUP-106 rather than by a tautological length check on a module constant (review iteration 2, F-7 / iteration-1 F-17).
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
- The golden's action kind matches its declared fixture cell — a plain park for an unheld target — and its `lanes[]` entry reads the parked outcome that TC-SUP-043 asserts is identical for the held twin. A held-cell golden, if one is added, may differ from the unheld one only in the action kind (`safe-boundary-park-intent`).
- The golden is stable across a second run and across both suite invocation paths (whole-file and filtered run).

---

#### TC-SUP-092 - Failure-envelope and live-claims data goldens: per-action refusal (exit 1) and the report with claims present (exit 0)

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-1, AC-F6-1, AC-F8-1, DEC-6, DEC-8, DEC-9(c), NFR-3
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/supervision-failure.test.ts`, `tests/golden/supervision-report.test.ts` + `tests/fixtures/supervision/golden/`
**Tags**: @golden, @backend

**Preconditions**:

- Three committed normalized goldens: the evidence-absent failure envelope (exit `2`), the per-action duplicate-supervision refusal envelope (exit `1`), and the paired live-claims data golden (exit `0`, a live daemon and coordinator claim present, every action succeeding or none needed).

**Steps**:

1. Run the evidence-absent cell; normalize and compare to its golden: five-field failure envelope, no `data`, the declared identity, exit `2`, evidence naming the missing sources.
2. Run the refusal cell (the TC-SUP-051 acting-authority fixture, whose only pending action is refused); compare to its golden: failure envelope, no `data`, the duplicate-supervision identity, exit `1`, `not_landed`, evidence naming the live claim and holder and the `daemon.preemption` record kind that carried the acting evidence.
3. Run the paired live-claims cell (the same claim records, no acting authority); compare to its golden: `data` present at exit `0`, `supervisors[]` carrying both claims with tri-states and holders, `lanes[]` carrying the parked state and the applied action, counts consistent with the entries; assert each claim's heartbeat evidence names the record kind its instant came from (daemon-instance → `daemon.heartbeat`, coordinator lease → `coordinator.iteration`, per-ref lease → `queue.lease`) and that the lane `heartbeat` is the lane's own observation.
4. Assert all three goldens carry no stack trace, no path outside the temp root, and no free text; assert the refusal golden carries no `data` member and the data golden carries no error identity.

**Expected Outcome**:

- The evidence-absent golden is exact and stable at exit `2`.
- The refusal golden is exact at exit `1`: the per-action refusal projects the failure envelope, names the live claim and holder in evidence, and carries no `data` (DEC-8b).
- The paired data golden proves the other half of the same rule on the same records: claims merely present never refuse anything, and a run whose actions all succeed reports data at exit `0` with live claims visible.
- The live-claims golden carries **per-claim-kind** record kinds in its evidence (review finding F-7): the pre-fix blanket `daemon.heartbeat` label on a coordinator or per-ref claim is a golden defect, not an accepted shape, and this golden is regenerated when the correction lands.
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

#### TC-SUP-096 - Mounting: prompt-required membership by exact set, root and family help, reference page, branding seam

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-1, F-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/supervision-mounting.test.ts`, `tests/behaviour/supervision-help.test.ts`, `scripts/checks/help-guide-coverage.ts`
**Tags**: @structure, @cli, @docs

**Preconditions**:

- One captured pre-change family list and one captured mounted list, both living in the mounting fixture and serving every pin; the reference-page directory.

**Steps**:

1. Assert `PROMPT_REQUIRED_COMMANDS` equals the single captured mounted list **exactly** — the captured base plus the appended family, set-for-set and in order — and that this is set equality, never prefix containment. Assert the delivered steer case reads that same captured list and is restored to exact-set equality (review finding F-13), and that the stale-pin scan covers every pin file with no filter that hides a pin behind a constant name.
2. Assert `supervise --help` answers at exit `0` with summary, usage, options, examples, exit codes, and a see-also pointer; assert `--version` answers.
3. Assert the reference page exists and is registered; run `help-guide-coverage`.
4. Assert no product/binary literal in the family outside the branding seam.
5. Assert the production composer produces the handler and answers over an empty store (the mounting half); the acting composed run is TC-SUP-105's cell, so this case does not duplicate it.

**Expected Outcome**:

- Prompt-required membership is real (a composed-but-unadvertised family fails the exact-set assertion) and the membership guard is **exact** rather than a prefix check: one captured list backs every family-count pin, and a weakening back to prefix containment fails the case (review finding F-13).
- Family help and reference page present; help-guide coverage PASS.
- Zero branding literal violations.
- The family is mounted and answers through the production composer; behaviour beyond mounting is owned by TC-SUP-105 (composed acting run) and TC-SUP-090/092 (goldens), so no environment-dependent behaviour is asserted here.

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

#### TC-SUP-100 - Closed-set cause/writer round-trip: every park cause either round-trips its own validator or is refused by name

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-2, DEC-9(a), RSK-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-park-writers.test.ts` over the delivered park writers (the battery park write port and `releaseQueueLease`) and the delivered record validator
**Tags**: @backend, @api

**Preconditions**:

- The delivered cause set and its cause→condition pair table read from the delivered constants (never a hand-written list), five delivered causes plus `liveness-stall`.
- For each cause, its sanctioned writer is identified (operator command path, battery writer, daemon path) — a cause with no identifiable writer is itself a failure.

**Steps**:

1. Enumerate the members of the delivered cause set and, for each, drive its sanctioned writer path against a real temp store.
2. For every accepting writer, read the appended record back through the delivered park read and run it through the delivered record validator.
3. For every refusing writer, assert the refusal names the cause and that no record was appended.
4. Assert the enumeration and the writers agree in both directions (every cause has an accounted writer row; every writer path is represented).
5. Mutants: make the operator path accept `liveness-stall` → the case fails naming the cause; remove the cause from the set → the battery writer's row has no member and the case fails; let a writer append a record its own validator rejects → the read-back fails naming the cause and record kind.

**Expected Outcome**:

- Every member of the closed set is accounted for **exactly once**: either a record that its own validator accepts after a read-back, or a refusal by name on the operator path. "Writable but invalid" cannot exist, and no cause is silently missing from the table.
- The `liveness-stall` row is accepted only through the battery writer (which always supplies `until`) and refused by name on the operator path with the delivered identity.
- Read-back uses the same validator the ecosystem uses on read, so write/read agreement is asserted rather than assumed.
- Every cell leaves the store readable: a final read of the delivered park family succeeds (no torn-store state).
- Mutants fail with the offending cause or record kind named.

**Notes / Clarifications**:

- This is the class-level guard review finding F-1 asked for. The defect was not a single mis-mapped pair but a closed set that admitted a writer whose record the set's own guard rejects; a case that pins only the vocabulary (TC-SUP-045) cannot catch it.

---

#### TC-SUP-101 - The operator path refuses `queue release --park liveness-stall` by name, appends nothing, and leaves state healthy

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-2, DEC-6, DEC-9(a), NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-park-writers.test.ts` through the delivered queue edge harness and the in-process program runner
**Tags**: @backend, @cli, @api

**Preconditions**:

- A live lease on `GH-295` held by `holder-a`, an unchanged queue entry, and a readable store.
- A recording seam over park appends and over lease mutations.

**Steps**:

1. Run `queue release GH-295 --holder holder-a --park liveness-stall --json`, and separately the human form and a variant carrying `--until`.
2. Assert the envelope, exit, identity, and the message that names the cause.
3. Assert zero park records appended, zero lease mutations, and the entry state unchanged.
4. Afterwards read `queue --json`, `lanes --json`, and the park family; assert all succeed.
5. Mutants: accept the cause on the operator path → the case fails naming the cause; accept it only when `--until` is supplied → still fails, because the contract is "battery-written only", not "writable when the grammar happens to fit".

**Expected Outcome**:

- Exit `1` with the delivered identity naming `liveness-stall`: a classified refusal in the failure envelope (no `data`), with the failure summary naming the cause and the accepted alternatives. Not a crash, not a success, not a silently dropped flag.
- No record appended and nothing mutated: the operator-visible state equals the pre-attempt state in every projection.
- Subsequent reads stay healthy: `queue`, `lanes`, and the park family all succeed. The pre-fix defect appended an invalid record and left every later park read failing closed with a torn store — that outcome is the failure this case exists to prevent.
- The refusal comes from the delivered identity/containment layer with a declared category and exit projection; no ad-hoc exit code is introduced, no new error identity is minted for it (the supervise kind still contributes exactly the two declared rows), and the same refusal is produced whether or not `--until` accompanies the flag.

**Notes / Clarifications**:

- `--until` is deliberately not a loophole: the cause's mapped condition type requires an absolute re-entry instant that an operator cannot derive from a stall observation, so the only honest writer is the battery. The parallel is the delivered owner-hold "one writer" rule.

---

#### TC-SUP-102 - The park write path cannot append a `provider-window`-mapped park with an empty or missing `until`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-2, DEC-9(a), NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-park-writers.test.ts` (writer-guard cell) plus the delivered validator read-back
**Tags**: @backend

**Preconditions**:

- Direct calls into the delivered park write path for every expiry-carrying cause, in two cells each: an empty-string expiry and a missing expiry.
- A readable store and a recording seam over appends.

**Steps**:

1. Attempt each cell and assert the writer's returned result class.
2. Read the park family and assert store health afterwards.
3. Assert the guard's decision is independent of which write entry point is used (drive at least two).
4. Mutant: remove the guard → the appended record fails the read-back validator and the store reads torn; the case fails naming the cell.

**Expected Outcome**:

- The guard refuses **before** the append: no record, a classified failure whose reason names the missing expiry, and no success envelope.
- State stays readable: no torn store, and the next legitimate battery-written park (with `until`) appends and validates — so the guard rejects the malformed record without poisoning the append-only ledger.
- One guard home: at least two write entry points are driven and both refuse, so a new writer cannot bypass the invariant.
- The invariant is stated positively in the assertion: an expiry-carrying park record always carries an expiry.

**Notes / Clarifications**:

- This is the hard boundary under DEC-9(a): even if a future grammar or caller could construct the condition, the record that would fail its own validator is never appended.

---

#### TC-SUP-103 - The decision path is one fold: no per-lane whole-store re-read, measured over the composed production closures

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-5, F-6, F-7, AC-F6-1, NFR-4, DEC-9(d), RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-read-cost.test.ts` (extending TC-SUP-081) over the **composed production closure factory** — the same shared economics/append factory the harness consumes — with an instrumented store port
**Tags**: @backend, @perf

**Preconditions**:

- A 50-lane acting scope and a 200-lane twin, each with at least two stalled lanes to park, one admitted restart, one exhaustion, and live claims.
- The composed production closures in place (no store-free fake economics port anywhere in the case).
- A store port that logs every whole-store read with its **call site** and scope (whole-store vs key-range), so decision reads and append-helper read-backs are attributable separately; the read-only twin of the same shape.

**Steps**:

1. Run the composed acting battery; capture the read log and assert the run actually acted (park, restart, and exhaustion counts plus their durable appends).
2. Assert exactly **one decision-path whole-store read** (the fold's `store.readRecords`), and that it is the same for 50 and 200 lanes.
3. Assert **no per-lane whole-store re-read**: no whole-store read is attributable to a lane loop or an admission closure, and the decision-closure whole-store read count stays at one however many lanes are stalled or parked.
4. Assert the blocker ledger is read **at most once per run**, including the typed-question raise path, and classify every remaining whole-store read by call site as a delivered append-helper read-back.
5. Assert the measured total equals the **declared bounded expectation** — the decision fold plus the append read-backs the run actually performs, each within its declared per-append bound — and assert the total is **flat** between 50 and 200 lanes. The literal `1` is never asserted for the composed total.
6. Mutants: (a) restore a per-lane `readRecords` inside an admission closure → the log scales with lane count; (b) drop the passed `current` ledger value so the question raise re-reads the blocker ledger → the ledger-read count exceeds one per run; (c) re-read the ledger per parked lane → scaling; each must fail naming the call site and the observed count.

**Expected Outcome**:

- Exactly one **decision** fold read per run; every park, restart, and claim decision cites that snapshot, and no decision path performs a second whole-store read (DEC-9(d)).
- No whole-store read whose count tracks lane count: the per-lane re-read defect (iteration-1 F-2, iteration-2 F-3) fails this case with the offending call site.
- The blocker ledger is read at most once per run; the typed-question raise consumes the already-read ledger value instead of re-reading it.
- The remaining whole-store reads are the delivered append helpers' own read-backs (restart append, exhaustion append, question coverage), each named and bounded; the case **records the measured total** and asserts that declared bound — a bare `count === 1` on a composed acting run is the wrong assertion and is rejected here.
- The case runs against the composed production closures: a store-free fake economics port is itself a failure, because a fake is exactly what let the iteration-2 defect pass while the suite stayed green.
- An acting run at the 200-lane cap also satisfies the NFR-5 latency bound (TC-SUP-083), and every declared snapshot member is consumed (no dead data).

**Notes / Clarifications**:

- Review iteration 1 measured the per-lane decision re-reads; review iteration 2 then measured 8 whole-store reads on a composed 50-lane acting run (one fold, two inside the restart append, two inside the exhaustion append, two blocker-ledger reads, one question-coverage read) and found the v1.4 form of this case passing only because it injected a store-free fake. The assertion is therefore split into three separate claims — one decision read, no per-lane re-read, bounded declared read-backs — measured where the production wiring actually runs.

---

#### TC-SUP-104 - A lane already parked under another cause gains no second active park and leaves healthy reads

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-7, AC-F2-1, AC-F5-1, AC-F7-1, DM-2, DM-4, DEC-9(e), RSK-2, RSK-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-park-state.test.ts` over the delivered park writer/read seams and the battery's park and admission paths
**Tags**: @backend, @api

**Preconditions**:

- Three cells, each a corroborated `liveness-stall` stall (heartbeat beyond the bound, flat trail) whose lane already carries a park the delivered read validator treats as occupied:
  (a) `owner-hold` (non-expiry condition);
  (b) `peak-window` (expiry-carrying, written by the delivered peak pause path);
  (c) a stuck `clear-observed` park — a park record followed by a `clear-observed` marker and no `recovered`/`released` record. Under the delivered one occupancy home a `clear-observed` marker does not clear the park, so this lane is occupied exactly as the `owner-hold` and `peak-window` lanes are; the cell pins that occupancy follows the sequence semantics rather than the latest record's state.
- Budget remaining in every cell, so restart admission is reachable; a recording seam over park appends.
- A healthy-read assertion available in every cell: the delivered park read plus `queue list --json` and `lanes list --json`.

**Steps**:

1. Run the battery for each cell.
2. Assert zero park records appended by the run; assert the pre-existing park record is byte-identical afterwards.
3. Assert the run still reports the lane honestly: the entry is present with its tri-state and evidence, and the report's action list states what was and was not done (no fabricated `supervised-stall-park` action).
4. Assert restart admission is `liveness-stall`-only: no cell admits a restart on the strength of a non-`liveness-stall` park, and the admission decision is reported with its evidence rather than silently taken.
5. Immediately after each run, assert the delivered park read succeeds and `queue list --json` / `lanes list --json` exit `0` — no `state.store.torn`.
6. Mutants: gate the park append on `cause === "liveness-stall"` instead of on the delivered occupancy → each cell appends a second occupied park, the validator trips, step 5 fails with a torn store; replace the one occupancy home with **latest-record-wins** semantics (take the last park record per ref and treat a non-`parked` latest state as free) → the stuck `clear-observed` cell sees no occupancy, appends, and step 5 fails with a torn store while the owner-hold and peak-window cells still pass, which isolates the defect; admit a restart for a non-`liveness-stall` park → the admission assertion fails.

**Expected Outcome**:

- Zero appends in every cell: the delivered duplicate-active-park invariant is preserved, and the run never stacks a `liveness-stall` park on top of an owner-hold, peak-window, or stuck clear-observed park (review iteration 2, F-1).
- Occupancy has **one home**: the fold's `activePark` and the duplicate-active-park validator are the same derivation (`activeParkRecords`), and a `clear-observed` marker keeps the occupancy standing until a `recovered`/`released` record arrives. The case therefore fails if either side re-derives its own answer — latest-record-wins or a cause filter — which is the defect class iteration-1 F-1 and iteration-2 F-1 both belonged to (a writer and a reader disagreeing about validity).
- The lane is reported honestly: an existing park is visible through the delivered projection, and the report does not claim an action the run did not take.
- Reads stay healthy after the action attempt: park read, `queue list`, and `lanes list` all succeed in every cell; the pre-fix behaviour (one invalid append → permanent `state.store.torn`) is the failure this case exists to prevent.
- Restart admission stays `liveness-stall`-only, so a lane parked for a product reason (owner decision, provider window) is not restarted behind the operator's back.
- The case is non-vacuous: each cell proves the lane is otherwise park-eligible (the same fixture without the pre-existing park does append exactly one park).

**Notes / Clarifications**:

- This is the class-level guard for review iteration 2 F-1: the defect was not a wrong cause mapping but a *state* question — "is this lane already parked?" — answered by cause instead of by the delivered occupancy home. The remediation put that answer in one place (`activeParkRecords`, whose sequence semantics also drive the read validator), so the case now asserts the shared derivation: a second re-derivation on either side (writer or reader) makes the stuck cell fail. Because the ledger is append-only, the original damage was permanent and disabled the operator's `queue`/`lanes` surfaces.
- Every other action case in this plan (§4.3, "No second active park") ends with the same healthy-read assertion, so a future writer cannot corrupt the ledger silently.

---

#### TC-SUP-105 - A composed-production acting run parks, restarts, and exhausts through the shared closure factory with the declared read discipline

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-6, F-7, AC-F5-1, AC-F6-1, AC-F7-1, NFR-4, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/supervision-composed-production.test.ts` over `createProductionComposer` and the shared economics/append closure factory, in a real temporary checkout; plus `tests/structure/supervision-composition-factory.test.ts`
**Tags**: @backend, @integration

**Preconditions**:

- A real temporary checkout with one managed repository key, the delivered state store, and a stalled scope that forces all three action paths in one run: at least one `liveness-stall` lane to park, one lane admitted for restart, and one lane at the exhausted budget bound; live claims present.
- No injected fake economics port: the run consumes the production closures (and the harness consumes the same factory).

**Steps**:

1. Run one acting battery through the production composer over the real checkout.
2. Assert the outcomes end to end: exactly one `liveness-stall` park appended (with `until`), one delivered restart record with the injected run id, one terminal exhaustion record plus exactly one ref-stable question; `data.actions` and `counts` agree with the durable records.
3. Assert schema and option fidelity against the declared production constants: the appended economics records carry the declared schema ids and option lists (read from shared constants, not re-declared literals), and the question carries the declared type/audience/options.
4. Assert the read discipline of the composed run: one decision fold read, no per-lane whole-store re-read, blocker ledger at most once per run (the TC-SUP-103 assertions, executed here over the same wiring).
5. Assert post-run health: delivered park read, `queue list --json`, and `lanes list --json` all succeed.
6. Structure half: assert the harness and the production composition obtain their economics/append closures from **one** shared factory — a duplicated closure implementation in `tests/fixtures/supervise/**` (re-declared schema id, option list, or question-id format) fails the case naming the duplicated symbol.

**Expected Outcome**:

- All three action paths run and land through the production wiring over a real checkout, not through a fixture copy: park, restart, and exhaustion outcomes match the durable records and the report.
- Production-only drift is caught: a wrong schema id, a wrong exhaustion option list, a wrong admission wiring, a lost holder, or a run-scoped question id makes this case fail — the failure mode that review iteration 2 F-4 identified (the harness copy reproducing the production bug while every suite stayed green).
- The one-factory assertion holds in both directions: production imports the factory and the harness imports the same factory; no second implementation exists to drift.
- The composed run's read discipline matches TC-SUP-103's measured expectations, and the post-run delivered reads are healthy.
- Offline: no network seam is reached, and the fixture guard rejects a live-workspace root.

**Notes / Clarifications**:

- This case is the composed-production counterpart of the fixture-based action cases. It exists because the iteration-1 F-10 residual (harness re-implementing production closures) is exactly what hid the iteration-2 F-2 and F-3 defects from a green suite.

---

#### TC-SUP-106 - The golden normalizer replaces exactly the declared volatile fields, and no committed golden carries one

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-3, DM-1, AC-F1-1
**Test Type(s)**: Unit, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/supervision-normalizer.test.ts` over `tests/fixtures/supervision/golden/normalize.ts` and the committed goldens
**Tags**: @golden, @backend

**Preconditions**:

- The normalizer under test and the committed supervision goldens; a crafted payload carrying a known temp-root path, a known injected run id, and known timing values (an instant and a duration).
- The declared volatile-field set: temp repository root, injected run id, timing.

**Steps**:

1. Normalize the crafted payload and assert each declared volatile value is replaced and the non-volatile content is untouched byte for byte.
2. Assert the replacement set is **exactly** the declared volatile fields **by behaviour**: a value of an undeclared kind (an ordinary ref, a record kind, a count) survives normalization unchanged, and a declared field is replaced wherever it appears.
3. Scan every committed golden for each volatile value (the temp-root prefix, the run-id literal, timing markers) and assert zero hits.
4. Assert the normalizer's replacement list is derived from, or bound to, the behaviour just asserted — a bare length check on a module constant is not accepted (review iteration 2, F-7 / iteration-1 F-17: `toHaveLength(3)` on a constant cannot fail when the normalizer changes).
5. Mutant: add a fourth replacement or drop one → step 1/2 fails naming the field; leave a volatile value in a golden → step 3 fails naming the file.

**Expected Outcome**:

- Replaced exactly: the temp root, the run id, and timing; nothing else is rewritten, so determinism is not bought by normalizing real content away.
- Committed goldens contain none of the volatile values; a golden carrying a temp path or a run id fails.
- The assertion is behavioural and non-tautological: it fails if the normalizer's actual replacements change, which the constant-length form could not do.
- Goldens remain stable across two runs and both suite invocation paths.

**Notes / Clarifications**:

- The delivered constant may still exist; it is simply not what the case asserts. This closes the iteration-1 F-17 residual (re-raised as review iteration 2 F-7).

---

## 6. Environments and Test Data

- **Environment**: local Linux runner, Bun test process, no network, no resident daemon required. Every behaviour case runs in-process through the delivered program runner with captured stdout/stderr buffers, an injected clock, injected brand, and a fixed run id.
- **Repository isolation**: every case that needs a repository builds a real temporary one under the OS temp directory (`TMPDIR`, which the gate sets to `$PWD/tmp/tmpdir`) with `git init -b main` and a fixed author identity, and removes it explicitly. The fixture guard rejects (a) any root equal to `process.cwd()`/the live workspace and (b) any root outside the temp directory, with distinct messages.
- **State isolation**: the delivered state store opens inside the temp repository via `tests/fixtures/state/harness.ts`; each case disposes its store. A recording store seam counts read passes and append calls **with the call site**, separating decision-path reads from the delivered append helpers' read-backs (TC-SUP-103, TC-SUP-105); a recording process/network seam counts prohibited calls.
- **One closure factory**: the production supervise composition and the test harness build their economics/append closures from the same shared factory (schema ids, option lists, question-id derivation, per-run ledger cache). A second implementation in the fixtures is a structure failure, not a convenience (review iteration 2, F-4; TC-SUP-105).
- **Record fixtures**: built through the delivered append/state seams (never hand-built literals — GAP-T4) for daemon instance/heartbeat/lane, queue entry/lease/park, dispatch attempt, phase, and commit receipt/effect records. Seeded via `tests/fixtures/supervision/records.ts`:
  - `advancingLane()` — heartbeat inside the bound plus one advancing artifact of each class (parameterized by class).
  - `lyingLane()` — heartbeats advancing to `now`, all four artifact classes flat across the span.
  - `uncorroboratedLane(ageMs)` — flat trail at a chosen age (matrix cells 299 999 / 300 000 / 300 001).
  - `evidenceAbsentLane()` / `evidenceAbsentClaim()` — records exist, observations absent.
  - `daemonClaim({live})` — instance plus heartbeat ordinals inside/outside the staleness bound. The `live: true` cell's trail **ends at the injected `now`** so the claim is genuinely live (the presence control in TC-SUP-051 depends on it, review finding F-9); `live: false` is the stale twin.
  - `coordinatorClaim({live})` — ledger lease plus flat or moving ledger position, with the iteration records that supply its heartbeat instants.
  - `liveLease({ref, holder})` — the delivered single-flight seeding helper.
  - `actingAuthority({object, authority})` — a delivered `daemon.preemption` **pending** record (the only acting-authority artifact class, DEC-9(c)) naming the targeted object, carrying the authority identity/holder, with a recorded instant the injected clock can move past; a companion builder produces an authority with **no** such record for the declared detection-limit cell.
  - `claimsOnly({daemonLive, coordinatorLive})` — claim records with no acting record, for the paired exit-`0` control.
  - `parkCauseRoundTrip()` — one cell per delivered cause: its sanctioned writer, the appended record read back through the delivered validator, or the operator-path refusal (TC-SUP-100/101/102).
  - `heldStallLane()` — the stalled lane whose session is actively held, plus its unheld twin, for the safe-boundary carrier comparison (TC-SUP-043).
  - `oversizedEvidenceEntry()` — a single evidence entry at or above the delivered evidence cap, for the cap boundary (TC-SUP-082).
  - `stalledLaneParkedUnder(cause)` — a park-eligible stalled lane already carrying one active park under the given cause (`owner-hold`, `peak-window`), written through the delivered writer for that cause, for the park-state cells (TC-SUP-104).
  - `staleClearObservedPark()` — a park record followed by a `clear-observed` marker and no `recovered`/`released` record; it keeps the lane occupied under the delivered occupancy home (the stuck cell, TC-SUP-104).
  - `composedProductionHarness({lanes, parks, restarts, exhaustions})` — `createProductionComposer` over a real temp checkout, built on the **shared** closure factory and exposing the instrumented store port; no store-free fake economics port (TC-SUP-105).
  - `volatilePayload()` — a crafted report payload carrying a known temp-root path, a known run id, and known timing values, for the normalizer behaviour case (TC-SUP-106).
  - `stalledAndParked()` — the seed-02 fixture (park record + lane read state).
  - `mixedScope()` — progressing + stalled + unknown + claims, for evidence totality and goldens.
  - `cappedScope(n)` — `n` lanes for the 200/201 bound and latency cells.
- **Injected inputs**: clock (`nowMs`/`nowIso`), brand, run id, and the probe seam (present/absent/zero facts). No case reads the wall clock, the environment, or the process table.
- **Golden data**: `tests/fixtures/supervision/golden/{supervision-report.json, supervision-report.txt, supervision-stalled.json, supervision-evidence-absent.json, supervision-refusal.json, supervision-live-claims.json, lanes-show-parked.json, lanes-show-parked.txt}` plus a captured delivered-table snapshot fixture (`tests/fixtures/supervision/error-table-baseline.json`) and the captured base/mounted family lists (one home for every pin). Normalization is limited to the temp repo root, the run id, and timing, and its volatile-field discipline is asserted behaviourally (TC-SUP-106): every committed golden is scanned for those values and must contain none of them. The healthy report golden carries the lane's own heartbeat instant (deliberately different from the scope instance heartbeat), and the live-claims golden carries per-claim-kind record kinds; both are corrected in the same change as the implementation fix (review findings F-6, F-7) rather than regenerated to match whatever the code prints.
- **Cleanup**: every temp repository and store is removed in a `finally`; a leaked temp root in the suite's own scratch directory fails the isolation case.

## 7. Automation Plan and Implementation Mapping

### 7.1 Case-to-file mapping

| TC ID(s) | Test file (create/update) | Level | Status | Notes |
|---|---|---|---|---|
| TC-SUP-001, TC-SUP-004 | `tests/behaviour/supervision-report.test.ts` | Behaviour | To Implement | New; uses `runProgram` with captured buffers; asserts the per-lane heartbeat (the lane's own observation, distinct from the scope instance heartbeat) and the fallback degradation marker. |
| TC-SUP-002 | `tests/behaviour/supervision-scope.test.ts` | Behaviour | To Implement | New; foreign-repository fixture. |
| TC-SUP-003 | `tests/behaviour/supervision-grammar.test.ts` | Behaviour | To Implement | New; recording store seam for the zero-read assertion. |
| TC-SUP-005, TC-SUP-013 | `tests/behaviour/supervision-evidence-absent.test.ts` | Behaviour | To Implement | New; empty scope vs all-unknown vs unreadable. |
| TC-SUP-010, TC-SUP-011, TC-SUP-012 | `tests/behaviour/supervision-classification.test.ts` + `tests/fixtures/supervision/matrix.ts` | Behaviour | To Implement | New; matrix file with totality guard. |
| TC-SUP-014 | `tests/structure/supervision-no-process-input.test.ts` | Structure | To Implement | Extends the delivered `coordinator-no-cpu` marker list (one list). |
| TC-SUP-020, TC-SUP-021, TC-SUP-022 | `tests/behaviour/supervision-lying-liveness.test.ts` | Behaviour | To Implement | New; ticket AC cell plus claim cell and the paired control. |
| TC-SUP-023 | `tests/behaviour/supervision-corroboration.test.ts` | Behaviour | To Implement | New; boundary cells from the imported constant. |
| TC-SUP-030 | `tests/structure/supervision-watchdog-consumption.test.ts` | Structure | To Implement | New; literal scan plus probe-name subset. |
| TC-SUP-031, TC-SUP-032 | `tests/behaviour/supervision-watchdog-consumption.test.ts` (+ the structure half above) | Behaviour/Structure | To Implement | New; absent-vs-zero cells. |
| TC-SUP-040, TC-SUP-043, TC-SUP-047 | `tests/behaviour/supervision-stall-park.test.ts` | Behaviour | To Implement | New; park append, the immediate safe-boundary intent carrier with its unheld twin (DEC-9(b)), evidence. |
| TC-SUP-041, TC-SUP-042 | `tests/behaviour/lanes-parked-stall.test.ts` | Behaviour | To Implement | New; extends the delivered lanes read fixtures. |
| TC-SUP-044 | `tests/behaviour/supervision-recovery.test.ts` | Behaviour | To Implement | New; no requeue/no re-dispatch. |
| TC-SUP-045 | `tests/structure/supervision-park-vocabulary.test.ts` + extend `tests/behaviour/queue-park-causes-s17.test.ts` equality | Structure/Behaviour | Existing – Update | The delivered exact-equality assertion gains one appended member and one pair. |
| TC-SUP-046 | `tests/structure/supervision-additivity.test.ts`, `tests/behaviour/supervision-additivity.test.ts` | Structure/Behaviour | To Implement | New; record-kind equality, schema strings, pre-change replay. |
| TC-SUP-050, TC-SUP-054 | `tests/behaviour/supervision-claims.test.ts` | Behaviour | To Implement | New; daemon/coordinator/ref claims, with per-claim-kind heartbeat record kinds asserted (F-7). |
| TC-SUP-051 | `tests/behaviour/supervision-duplicate-refusal.test.ts` | Behaviour | To Implement | New; four cells (acting authority via the `daemon.preemption` pending record, presence with a genuinely live claim, held session, declared detection limit) plus the retry-after-window control. |
| TC-SUP-052 | `tests/behaviour/supervision-single-flight.test.ts` | Behaviour | To Implement | New; consumes the delivered helper. |
| TC-SUP-053 | `tests/structure/supervision-nonregression.test.ts` (+ delivered suites unchanged) | Structure | To Implement | New; includes a "delivered files untouched" diff-free tree assertion (path allowlist, not a moving-base diff). |
| TC-SUP-060, TC-SUP-061, TC-SUP-062 | `tests/behaviour/supervision-restart.test.ts` | Behaviour | To Implement | New; budget, exhaustion (two runs with **different** run ids), unevaluable — the run id is asserted as record metadata, and the question's identity is asserted ref-stable and run-id-free. |
| TC-SUP-063 | `tests/structure/supervision-no-signal.test.ts` (+ the behaviour half in the restart suite) | Structure | To Implement | New; marker scan plus a no-hard-coded-run-identity scan and a combined park+restart run asserting the shared injected id. |
| TC-SUP-070, TC-SUP-072 | `tests/structure/supervision-error-family.test.ts` | Structure | To Implement | New; mirrors `daemon-vocabulary` style with a delivered-table baseline fixture. |
| TC-SUP-071 | `tests/checks/supervision-error-socialization.test.ts` + update `tests/checks/error-table-sync.test.ts` expectations | Checks | Existing – Update | The delivered mutation suite gains the supervise rows and count deltas. |
| TC-SUP-080 | `tests/behaviour/supervision-determinism.test.ts` | Behaviour | To Implement | New; paired runs + replay. |
| TC-SUP-081, TC-SUP-103 | `tests/behaviour/supervision-read-cost.test.ts` | Behaviour | To Implement | New; read counter over a read-only run (one fold) and over a composed acting run (one decision fold plus the declared append read-backs), with instrumented call-site scope (no per-lane whole-store read). |
| TC-SUP-082 | `tests/behaviour/supervision-bounds.test.ts` | Behaviour | To Implement | New; 200/201 cells, the maximal-evidence cell, and the single-oversized-entry cap boundary. |
| TC-SUP-083 | `tests/behaviour/supervision-performance.test.ts` | Behaviour | To Implement | New; single measured bound. |
| TC-SUP-084 | `tests/behaviour/supervision-evidence-totality.test.ts` | Behaviour | To Implement | New; structural walk. |
| TC-SUP-085 | `tests/behaviour/supervision-isolation.test.ts` + `tests/fixtures/supervision/temp-git.ts` | Behaviour | To Implement | New; guard and no-network. |
| TC-SUP-090, TC-SUP-091, TC-SUP-092 | `tests/golden/supervision-report.test.ts`, `tests/golden/supervision-failure.test.ts` + goldens | Golden | To Implement | Goldens **created** in this change: healthy report (lane's own heartbeat), stalled/parked report, evidence-absent envelope, per-action refusal envelope, and the paired live-claims data golden (per-claim-kind record kinds); the normalizer's volatile-field discipline is asserted in TC-SUP-106, not by a constant-length check. |
| TC-SUP-093 | `tests/golden/lanes-show.test.ts` (update) + new parked goldens | Golden | Existing – Update | The delivered golden family gains the parked cell; existing cells unchanged. |
| TC-SUP-094 | `tests/structure/supervision-contract.test.ts` | Structure | To Implement | Reuses `dataOnlyViolations`. |
| TC-SUP-095 | `tests/structure/supervision-imports.test.ts` + update `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json` | Structure | Existing – Update | Inventory/export registration is a mandatory same-change edit. |
| TC-SUP-096 | `tests/structure/supervision-mounting.test.ts` (exact-set), `tests/behaviour/supervision-help.test.ts`, reference page + help coverage inventory, and the restored exact-set assertion in `tests/structure/steer-mounting.test.ts` | Structure/Checks | Existing – Update | One captured mounted list backs every pin; the prefix assertion is removed (F-13); the acting composed run moved to TC-SUP-105 (one home, F-10/F-4). |
| TC-SUP-097 | content checks (no file to write in this change's test scope) | Docs | Manual Only | Evidence recorded in §10. |
| TC-SUP-100, TC-SUP-101, TC-SUP-102 | `tests/behaviour/supervision-park-writers.test.ts` | Behaviour | To Implement | New; closed-set cause/writer round-trip, the operator-path refusal with the healthy-reads assertion, and the empty/missing-expiry guard. |
| TC-SUP-103 | `tests/behaviour/supervision-read-cost.test.ts` (composed acting cells) | Behaviour | Existing – Update | Extends TC-SUP-081's file; the read port logs call sites so one decision fold, zero per-lane whole-store re-reads, and the declared append read-backs are asserted separately over the composed production closures. |
| TC-SUP-104 | `tests/behaviour/supervision-park-state.test.ts` | Behaviour | To Implement | New; three already-parked cells (owner-hold, peak-window, stuck clear-observed) with zero-append, honest-report, `liveness-stall`-only admission, and post-action healthy-read assertions. |
| TC-SUP-105 | `tests/behaviour/supervision-composed-production.test.ts` + `tests/structure/supervision-composition-factory.test.ts` | Behaviour/Structure | To Implement | New; one acting run through `createProductionComposer` (park + restart + exhaustion) plus the one-factory assertion over production and the harness. |
| TC-SUP-106 | `tests/golden/supervision-normalizer.test.ts` + `tests/fixtures/supervision/golden/normalize.ts` | Golden | To Implement | New; behavioural volatile-field replacement, undeclared values untouched, and zero volatile values in any committed golden. |

Execution commands: `bun test tests/structure tests/behaviour tests/golden tests/checks` while iterating; `TMPDIR=$PWD/tmp/tmpdir pnpm check` for the gate.

### 7.2 Mocking and seam requirements

- Injected fakes only (no `mock.module`): clock, brand, run id, probe seam, store seam, process seam, network seam.
- The probe seam must be able to return "absent" distinctly from "zero" — the distinction TC-SUP-031 asserts.
- The store seam must count read passes (TC-SUP-081) and append kinds (TC-SUP-046), and must record each read call's **scope** (whole-store vs key-range) and calling site, so a per-lane re-read on the action path is distinguishable from the single fold (TC-SUP-103).
- The park writer and the record validator must be drivable as a pair (write → read-back → validate), so the cause/writer round-trip and the empty-expiry guard are asserted at the seam and not only through the CLI (TC-SUP-100, TC-SUP-102).
- The economics/append closures must be the **production** closures obtained from the shared factory; substituting a store-free economics fake is a case failure, because that substitution is what hid the composed read-cost defect (TC-SUP-103, TC-SUP-105).
- The injected run identity must differ from every delivered literal (`supervise`), and the question-identity cell must inject **two distinct** run ids to prove the identity does not move with the run (TC-SUP-060..TC-SUP-063, TC-SUP-085, TC-SUP-061).
- The normalizer must be callable over a crafted payload carrying known volatile values, so its replacement set is asserted behaviourally (TC-SUP-106).
- The process seam must record calls without performing them (TC-SUP-054, TC-SUP-063).

### 7.3 Delivered-suite edits this change is allowed to make

Exactly these: the park cause/pair/policy equality in `tests/behaviour/queue-park-causes-s17.test.ts` (+1 cause, +1 pair, and the operator-path refusal of the battery-only cause); the error-table expectations and counts in `tests/checks/error-table-sync.test.ts` (+2 rows, documented page, corpora); the inventory/export registries (`tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`); the lanes golden family (`tests/golden/lanes-show.test.ts` + new fixtures); the family pins, now reading one captured mounted list with **exact-set** equality, including the restored exact-set assertion in `tests/structure/steer-mounting.test.ts` (review finding F-13); and the delivered queue command's printed accepted-cause/help text if it enumerates the causes. The shared supervise harness fixture (`tests/fixtures/supervise/harness.ts`) is rewritten to consume the production closure factory in this change (review iteration 2, F-4; asserted by TC-SUP-105), which is a fixture change, not a delivered-mechanism change. Anything else that must change is a **finding**: a delivered mechanism changed, or a delivered token was renamed.

### 7.4 What PASS means, per level, and the evidence each delivery stage must leave

| Level | PASS definition |
|---|---|
| Static/diff | `git diff --check` clean; no conflict markers; every new path follows the repository conventions (`tests/**/supervision-*.test.ts`, `tests/fixtures/supervision/**`). |
| Structure | `bun test tests/structure` green, including exact closed-set equality both directions, one-home constants, data-only contract AST, no process markers, the consumed-member (no dead input field) assertion, inventory/export registration, record-kind and taxonomy equality, exact-set family membership against one captured mounted list, and the one-closure-factory assertion over production and the harness. Any mutant named in §4.2 makes its case fail. |
| Behaviour | `bun test tests/behaviour` green, including every matrix cell executed (totality guard), the seed cases, both refusal cells (per-action duplicate-supervision and per-ref single-flight) with their presence, held-session and declared-detection-limit controls, the cause/writer round-trip and operator-refusal cells (with healthy reads after each refusal), the empty-expiry guard, the three park-state cells (an existing active park is respected, zero appends, healthy reads), the composed-production acting run, the two-run exhaustion cell with distinct run ids (one terminal record, one ref-stable question), the declared read discipline (one decision fold, no per-lane whole-store re-read, bounded append read-backs), determinism pairs, the 200/201 bound, the `< 5_000 ms` bound for both run shapes, evidence totality walk, and the isolation guard. |
| Golden | `bun test tests/golden` green against committed normalized goldens; the healthy report golden carries the lane's own heartbeat and the live-claims golden the per-claim-kind record kinds; the normalizer replaces exactly the declared volatile fields and no committed golden carries one of them; delivered non-parked lanes goldens unchanged. |
| Checks | `bun test tests/checks` green, including the sync check on the live tree and every mutation failing with the offending row/code; help-guide coverage green. |
| Boundaries | `check:boundaries` (depcruise + ambient guard + workspace entrypoints + secret-read boundary) green with no new rule or exemption. |
| Docs/content | New `supervise` page present and first-spec-only clean; watchdog/daemon boundary text reconciled with zero residual contradictions; links resolve; doc-conformance green. |
| Aggregate | `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits `0`, with the output recorded in §10. |

| Delivery stage (phase ownership in `chg-GH-295-plan.yaml`) | Minimum evidence that stage must leave |
|---|---|
| Contracts and vocabularies (report schema, tri-state set, cause/pair, two error rows) | Structure level green for TC-SUP-045, TC-SUP-070, TC-SUP-094; the delivered-table baseline fixture committed; inventory updated. |
| Park-writer hardening (battery-only cause, operator refusal, empty-expiry guard) | Behaviour green for TC-SUP-100, TC-SUP-101, TC-SUP-102 plus the updated `queue-park-causes-s17` policy equality; the store readable after every cell; the two named mutants fail. |
| Fold and classification (pure domain, delivered probes consumed) | Behaviour green for TC-SUP-010, TC-SUP-011, TC-SUP-012, TC-SUP-013, TC-SUP-014, TC-SUP-020, TC-SUP-021, TC-SUP-022, TC-SUP-023, TC-SUP-030, TC-SUP-031, TC-SUP-032; the matrix totality guard in place; the no-process-input structure case green, including the consumed-member (no dead field) assertion. |
| Report projection and mounting | Behaviour/golden green for TC-SUP-001, TC-SUP-002, TC-SUP-003, TC-SUP-004, TC-SUP-005, TC-SUP-090, TC-SUP-096; per-lane heartbeat assertions green (the lane's own observation, not the scope instance heartbeat); membership asserted by exact set against one captured mounted list; the production composer answers over an empty store (the acting composed run is TC-SUP-105's cell); human render from the same evidence. |
| Park-state interaction and composed production (DEC-9(e), DEC-9(f)) | Behaviour green for TC-SUP-104 (owner-hold, peak-window, stuck clear-observed; zero appends; honest report; `liveness-stall`-only admission; healthy `queue`/`lanes` reads) and TC-SUP-105 (one acting run through the production composer: park + restart + exhaustion with schema/option fidelity); structure green for the one-factory assertion. |
| Actions (park, safe-boundary intent carrier, restart composition) | Behaviour green for TC-SUP-040, TC-SUP-041, TC-SUP-042, TC-SUP-043, TC-SUP-044, TC-SUP-047, TC-SUP-060, TC-SUP-061, TC-SUP-062, TC-SUP-063, TC-SUP-104; the held-session carrier asserted as the immediate park record with the unheld-twins outcome comparison; the exhaustion cell run twice with different run ids (one record, one question); every action cell ends with a healthy delivered park/`queue`/`lanes` read; park vocabulary/additivity structure green; `lanes show` parked behaviour + golden green. |
| Claims and refusals | Behaviour green for TC-SUP-050, TC-SUP-051, TC-SUP-052, TC-SUP-053, TC-SUP-054 (all four TC-SUP-051 cells — acting authority, genuinely live presence, held session, declared detection limit — and the retry control); per-claim-kind heartbeat record kinds asserted; non-regression assertions on the delivered suites and composition. |
| Bounds, determinism, latency, isolation | Behaviour green for TC-SUP-080, TC-SUP-081, TC-SUP-082, TC-SUP-083, TC-SUP-084, TC-SUP-085, TC-SUP-103, TC-SUP-105; the measured decision-fold count, the declared append read-back total, the acting 200-lane latency, and the human render's measured size at the cap recorded (no byte bound claimed for the render); determinism replay recorded; the measured values recorded in §10. |
| Golden discipline and normalizer | Golden green for TC-SUP-090 plus TC-SUP-106: the normalizer replaces exactly the declared volatile fields (proven behaviourally, not by a constant's length) and no committed golden carries a temp root, a run id, or a timing value. |
| Failure envelopes and error socialisation | Golden green for TC-SUP-092 (evidence-absent envelope, per-action refusal envelope, paired live-claims data golden); checks green for TC-SUP-071, TC-SUP-072. |
| Documentation reconciliation | Content checks complete; TC-SUP-097 evidence recorded; doc-conformance green. |

A stage is **not** PASS-able on a partially green level: the aggregate gate is the final arbiter, and a level with a skipped or `.todo` case is reported as `PARTIAL` in §10 with the named reason. No case in this plan is expected to start as `PARTIAL` — the last blocking gap was closed by spec v1.1 DEC-8, the delivery-time resolutions by spec v1.2 DEC-9, and the review-iteration-2 resolutions by spec v1.3.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Testing risks

| ID | Risk | Mitigation in this plan |
|---|---|---|
| TR-1 | A delivery agent re-derives the pre-amendment refusal rule (a scope-level blanket refusal that lets a live daemon gate parks) and the refusal cases drift into encoding it. | TC-SUP-051's four cells pin DEC-8/DEC-9(c) against each other: the acting-authority cell must refuse (`daemon.preemption` pending record within the bound), the presence cell must park at exit `0` with a genuinely live claim, the held-session cell must append its park without refusal, and the detection-limit cell must record the absence of a refusal rather than invent a gate. Any one inverted fails. |
| TR-2 | Goldens created in this change could bake a wrong key name into a permanent assertion. | Goldens are authored after the contract structure case (TC-SUP-094) pins the member set; the review compares the golden's members against DM-1 semantics; seed/DEC-fixed names are listed as non-negotiable in §3.4. |
| TR-3 | The classification matrix could pass vacuously (empty matrix, unmapped cell). | The matrix file declares an expected value per cell and the case fails when executed cells ≠ declared cells (non-vacuity guard per the testing strategy). |
| TR-4 | A "one read fold" assertion could pass because the seam is not wired. | The read counter is asserted `> 0` and exactly `1`; a mutant that reads per lane proves scale sensitivity. |
| TR-5 | Latency at the 200-lane cap could flake on a loaded CI host. | The spec is a hard 5,000 ms bound; the case asserts it with the cap population proven non-empty. If it flakes, the delivery reports the measured value rather than relaxing the bound silently. |
| TR-6 | The deliver-then-verify order could let a case be satisfied by an implementation that merely exists. | Every case is authored failing-first against its owning stage (§7.4); a stage that cannot go red is reported. |
| TR-7 | Consumed delivered record shapes drift during delivery. | Fixtures build through delivered seams and fail loudly when a seam is missing (GAP-T4), so a drift is a compile/test failure, not a silent approximation. |
| TR-8 | Scope leakage could hide in human text while the machine payload is clean. | TC-SUP-002 scans both projections for the foreign key. |
| TR-9 | The closed cause set and the *writable* cause set diverge again: a cause joins the vocabulary but its operator or battery writer produces a record the validator rejects. | TC-SUP-100 enumerates the set and asserts round-trip-or-refusal per member; TC-SUP-101/102 assert the two concrete guards. A vocabulary-only case (TC-SUP-045) is explicitly not treated as sufficient. |
| TR-10 | The acting-authority detection silently becomes a presence gate again, or the declared detection limit is read as an unimplemented check and "fixed" with a process probe. | TC-SUP-051's presence cell uses a genuinely live claim and must still park at exit `0`; the detection-limit cell asserts no refusal and the limit is declared in §8.2/§8.3 and the spec (DEC-9(c)). TC-SUP-054 forbids the process alternative. |
| TR-11 | A golden is regenerated from the pre-fix implementation and bakes the wrong fact (scope heartbeat per lane, blanket `daemon.heartbeat`), turning a defect into a permanent assertion. | TC-SUP-090/092 require a fixture where the wrong answer is *visibly* wrong (two lanes with different observations; coordinator/per-ref instants distinct from the daemon heartbeat), so a blind regeneration fails. Regeneration is an explicit, reviewed act (§4.2, §10). |
| TR-12 | An action-path whole-store re-read hides behind the existing single-seam counter (the count looks like one because the counter watches only the fold port). | TC-SUP-103 instruments the read port's **scope and call site**, not just one seam's count, and asserts the count does not scale with lane count. |
| TR-13 | A "one predicate home" or "one fold" claim passes while being asserted only by identifier-shaped scans rather than by measurement. | The load-bearing assertions are measured: consumed-member checks (TC-SUP-014), call-scope logs (TC-SUP-103, TC-SUP-105), and read-back validation (TC-SUP-100/102). A name-grep alone is never accepted as PASS for these claims. |
| TR-14 | The park-state guard regresses to a cause comparison, so the battery stacks a second active park beside an owner-hold or peak-window park and permanently tears the ledger. | TC-SUP-104's three cells assert zero appends, an unchanged prior record, `liveness-stall`-only admission, and healthy post-action `queue`/`lanes` reads; every other action case carries the same healthy-read assertion, so a regression fails wherever it first appears. |
| TR-15 | The typed exhaustion question's identity drifts back to run-scoped, so repeated operator runs raise duplicate owner-facing questions. | TC-SUP-061 runs the battery twice with **different** injected run ids and asserts one terminal record and one ref-stable question; reusing a single run id in that cell would be a case defect, not a pass. |
| TR-16 | A read-cost claim is "proven" over a fixture fake while the composed production path keeps re-reading. | TC-SUP-103 and TC-SUP-105 forbid the store-free economics fake and measure the composed closures with call-site attribution; the declared total is compared to a bounded expectation, never to a bare `1`. |
| TR-17 | The fixture re-implements the production closures again, so a production-only drift (schema id, option list, question id) stays green. | TC-SUP-105's structure half asserts one shared factory in both directions; the harness is rewritten to consume it rather than to copy it. |
| TR-18 | An assertion cannot fail: a constant's length is asserted instead of the normalizer's behaviour, or a bound is claimed that the delivered code does not implement. | TC-SUP-106 asserts replacement behaviour over crafted values and scans the committed goldens; TC-SUP-082 states the human render's delivered bound (lane cap only) and measures its size rather than asserting a byte cap. No PASS is accepted on an assertion that cannot go red. |

### 8.2 Assumptions

- **AMB-1 (empty scope)**: a readable store with zero records yields an empty, evidence-complete report at exit `0`; exit `2` is reserved for an absent or unreadable source. Basis: DEC-6 ("evidence-absent or state is unreadable") and F-1's report-as-truth. TC-SUP-005 asserts this; a one-line spec clarification is recommended but not blocking.
- **AMB-2 (member names)**: the report's member names for the tri-state, supervisor entries, and actions are bound by the delivery contract; this plan pins the seed names `repo` / `lanes[].ref` / `lanes[].heartbeat` / `lanes[].holder` and the DEC-2/DM-3 names `reason` / `until` as non-negotiable, and treats a divergence in the remaining names as a delivery finding to be reconciled in review rather than a test-plan rewrite.
- **AMB-3 (observation span)**: the declared observation span for corroboration is the delivered 300,000 ms stall bound window (NFR-1's "across that span"). Cells are seeded at that span.
- **AMB-4 (claiming versus acting actions)**: settled by DEC-8 — a park intent, including its safe-boundary path, is **non-claiming** and is refused by neither identity; the per-ref single-flight refusal attaches to an action that would acquire the ref claim (the restart admission, TC-SUP-052), and the duplicate-supervision refusal attaches to an acting action whose object an authority is actively acting on (TC-SUP-051). The battery still launches no lane session (NG-2).
- **AMB-5 (tools)**: the delivered helper seam shapes (store, process port, probe) are consumed as injected ports; a missing port is a delivery finding, not a reason to hand-build a record.
- **AMB-6 (lane heartbeat source)**: the lane entry's `heartbeat` is the lane's **own** recorded observation (the delivered daemon lane record's observation instant). The scope instance heartbeat is a fallback only, and taking it emits a declared degradation marker (review finding F-6; asserted in TC-SUP-001, TC-SUP-004, TC-SUP-090).
- **AMB-7 (acting-authority artifact class)**: the only detectable acting artifact is the delivered `daemon.preemption` pending record, read inside the imported corroboration bound, record-only (spec v1.2 DEC-9(c)). An authority class leaving no such record is a **declared detection limit**, not a gate and not an unimplemented check (TC-SUP-051 detection-limit cell).
- **AMB-8 (park write discipline)**: `liveness-stall` is battery-written only; the operator path refuses it by name. Every cause–writer pair must round-trip a record its own validator accepts, or be refused by name (spec v1.2 DEC-9(a); TC-SUP-100/101/102).
- **AMB-9 (park-state policy, DEC-9(e))**: "already parked" is decided by no active park of any cause, judged by the delivered **one occupancy home** (`activeParkRecords` in the queue-park domain) that the supervision fold and the duplicate-active-park validator share: a `parked` record occupies the ref until a `recovered` or `released` record clears it, and a `clear-observed` marker leaves the occupancy standing, so a stuck clear-observed lane is occupied exactly like an owner-hold or peak-window lane. The fold's `activePark` is that answer, not a separate re-derivation, so the writer's gate and the reader's validator cannot disagree by construction (spec v1.3; TC-SUP-104).
- **AMB-10 (question identity, DEC-9(f))**: the typed exhaustion question is identity-stable per ref, derived from the ref (and the delivered ledger identity), never from the run id. The run id is record and evidence metadata, so repeated runs with different ids yield one terminal record and one question, and no action is reported for a record that did not land (spec v1.3; TC-SUP-061).
- **AMB-11 (exact read discipline)**: one **decision** fold read per run, no per-lane whole-store re-read, and the delivered append helpers' own read-backs declared and bounded per run — the blocker ledger at most once. A literal `count === 1` is not asserted for a composed acting run (spec v1.3; TC-SUP-103, TC-SUP-105).
- **AMB-12 (one closure factory)**: production and the test harness obtain economics/append closures from one shared factory; the harness never re-implements schema ids, option lists, or the question-id derivation (review iteration 2 F-4; TC-SUP-105).
- **AMB-13 (human render bound)**: the delivered human render is bounded only by the lane cap — one line per entry plus one evidence-code list per line, with no numeric byte/line cap and no truncation marker. Its size is measured and inspected, never asserted against a bound the renderer does not implement (review iteration 2 F-8 / iteration-1 F-19; TC-SUP-082).

### 8.3 Open questions and specification gaps

| ID | Question / gap | Status | Consequence for this plan |
|---|---|---|---|
| OQ-TP-1 | No bound is declared for `supervisors[]` or `actions[]` entry counts (NFR-4 bounds the report at the 200-lane cap only), and the report's truncation-reason vocabulary is not enumerated. | Non-blocking — deferred to phase 4 (`@plan-writer`) with the delivery. | TC-SUP-082 asserts only the lane cap plus `truncated`/`truncationReason` semantics; no supervisors-count cap is asserted. |
| OQ-TP-2 | For a coordinator-lease claim, F-3's "supervision artifacts" are named only as "no lane record progress, no reconciliation or action evidence" — there are no lane records for a coordinator. | Non-blocking — interpreted as reconciliation records plus ledger-position movement. | TC-SUP-021 asserts those two classes; a coordinator-specific artifact class added later extends the case rather than contradicts it. |
| OQ-TP-3 | The exact reason vocabulary for a truncated supervision report (the delivered precedent uses `lane-cap` / `status-lanes-bound`). | Non-blocking — a delivery naming decision, invisible to requirements. | TC-SUP-082 asserts "a non-empty named reason from a declared set", not a literal. |
| OQ-TP-4 | ~~Whether a repeated battery run over an already-parked lane appends a second park record or is a no-op.~~ | **Settled by DEC-8(c) and DEC-9(e)** — the park intent's safety is the caller's occupancy gate plus the delivered fenced append and write serialization: a landed park leaves the lane occupied, so a repeated run appends nothing; the append seam performs no dedupe (spec v1.4). No longer an open question. | TC-SUP-044 and TC-SUP-051's held-session cell assert "no second park while the lane remains occupied". |
| OQ-TP-5 | ~~The new cause joins the closed set, but the delivered operator path can write a park record the ecosystem's own validator rejects, poisoning every later park read (review F-1).~~ | **Closed by spec v1.2 DEC-9(a) and this plan's v1.4 amendment** — the cause is battery-written only, the operator path refuses it by name, and the class rule is "every cause–writer pair round-trips a record its own validator accepts, or is refused by name". | TC-SUP-100 (per-member round-trip), TC-SUP-101 (operator refusal, no append, healthy later reads), TC-SUP-102 (empty/missing-expiry guard); TC-SUP-045 is explicitly not treated as sufficient. |
| OQ-TP-6 | ~~A stall over an actively held session was specified as a park landing at the next safe boundary — a deferral no delivered record can carry (review F-4).~~ | **Closed by spec v1.2 DEC-9(b) and this plan's v1.4 amendment** — the durable park record is the intent carrier, the action reports `safe-boundary-park-intent`, zero session effect, zero signals, operator-visible outcome identical to the unheld case. | TC-SUP-043 rewritten (immediate append, absence assertions, unheld-twin comparison); TC-SUP-051's held-session cell aligned; the deferred-landing expectation retired. |
| OQ-TP-7 | ~~Which durable artifact proves another supervision authority is actively acting (DEC-8(a) named the behaviour, not the artifact class)?~~ | **Closed by spec v1.2 DEC-9(c)** — the delivered `daemon.preemption` pending record, read inside the imported corroboration bound, record-only; authority classes leaving no such record are a declared detection limit. | TC-SUP-051's acting-authority cell (positive) and detection-limit cell (declared absence), TC-SUP-054 (no process fallback). |
| OQ-TP-8 | ~~NFR-4's one-read fold covered only the verdicts; the action path re-read the whole ledger per lane, so the 200-lane latency claim proved a fold that does nothing (review F-2).~~ | **Closed by spec v1.2 DEC-9(d) and this plan's v1.4 amendment** — the single fold covers the action path; park, restart, and claim actions reuse the snapshot. | TC-SUP-103 (call-scope read count on an acting run), TC-SUP-081 (read-only twin), TC-SUP-083 (acting latency cell). |
| OQ-TP-9 | Review findings this plan deliberately does not turn into assertions: F-3 (declared commit subjects unused), F-5 (phase scope enumeration in pm-notes), F-14 (the park's re-entry horizon, now delivered and verified by the TC-SUP-044 cell), F-15 (the "one predicate home" claim is name-based). | **Routed, not open** — F-3/F-5 are plan/commit-hygiene and pm-notes items with no test-plan assertion; F-14 is closed by the remediation (verified in review iteration 2) and asserted by TC-SUP-044; F-15 remains accepted-with-disclosure and this plan does not treat a name-grep as proof (TR-13). | No case asserts a single-predicate implementation; TC-SUP-030/032 assert the imported bound and vocabulary only. |
| OQ-TP-10 | ~~The battery treats "already parked" as "parked under `liveness-stall`", so a lane parked under another cause gains a second active park that the delivered duplicate-active-park validator rejects (review iteration 2, F-1 critical).~~ | **Closed by spec v1.3 and this plan's v1.5 amendment** — the append is gated on no active park at all, restart admission stays `liveness-stall`-only, and every action cell ends with a healthy-read assertion. | TC-SUP-104 (three cells + mutants), TC-SUP-040/051 healthy-read bullets, §4.3 "No second active park". |
| OQ-TP-11 | ~~The typed exhaustion question's identity is run-scoped, so every repeated run appends another owner-facing question while the repeat cell passes by reusing one run id (review iteration 2, F-2 high).~~ | **Closed by spec v1.3 and this plan's v1.5 amendment** — the identity is ref-stable, the run id is metadata, and the repeat cell injects two different run ids. | TC-SUP-061 (rewritten two-run cell). |
| OQ-TP-12 | ~~The one-fold claim was false for composed acting runs (8 measured reads) and TC-SUP-103 passed only because it injected a store-free fake economics port (review iteration 2, F-3).~~ | **Closed by spec v1.3 and this plan's v1.5 amendment** — the assertion is split into one decision fold, no per-lane whole-store re-read, and declared bounded append read-backs, measured over the composed production closures. | TC-SUP-103 (rewritten), TC-SUP-105 (composed run), NFR-4 row. |
| OQ-TP-13 | ~~The harness re-implements the production economics closures, so production drift and the run-scoped question id stayed invisible (review iteration 2, F-4).~~ | **Closed by spec v1.3 and this plan's v1.5 amendment** — one shared factory, consumed by production and the harness, with a structure assertion against a second implementation. | TC-SUP-105 (behaviour + structure halves), §6 "One closure factory", §7.3. |
| OQ-TP-14 | ~~Two assertions could not fail: the normalizer's replacement list was asserted by a module constant's length (review iteration 2 F-7 / iteration-1 F-17), and the human render was described as bounded although only the lane population is capped (review iteration 2 F-8 / iteration-1 F-19).~~ | **Closed by this plan's v1.5 amendment** — the normalizer is asserted behaviourally with the committed goldens scanned, and the render statement is corrected to the delivered behaviour and measured. | TC-SUP-106 (normalizer), TC-SUP-082 (render cell), AMB-13. |

**Gap status:** GAP-T1 was the only gap requiring the specification phase to be reopened, and it is **closed by spec v1.1 DEC-8** (Decision Log DEC-8; revised F-6, F-8, G-5, AC-F6-1, DEC-6, §6 Flow 4, §18, §23). GAP-T5 (the iteration-1 review-driven gaps) is **closed by spec v1.2 DEC-9(a)-(d) and this plan's v1.4 amendment**. GAP-T6 (the iteration-2 review-driven gaps: park-state interaction, question identity, exact read discipline, one closure factory, and the two low residuals) is **closed by spec v1.3 and this plan's v1.5 amendment** (revised F-2, F-5, F-7, NFR-4, AC-F2-1, AC-F5-1, AC-F6-1, AC-F7-1, §4.3 obligations and §5 cases). All three resolutions are recorded in §9. **No open gap remains, and no cell in this plan is unowned, skipped, or awaiting a decision.** OQ-TP-1, OQ-TP-2 and OQ-TP-3 are unchanged phase-4 items (report bounds beyond the lane cap, coordinator-claim artifact enumeration, truncation-reason vocabulary); OQ-TP-4 is settled by DEC-8(c), OQ-TP-5..OQ-TP-8 are closed by DEC-9, OQ-TP-9 is routed outside this plan with its owners named, and OQ-TP-10..OQ-TP-14 are closed by this amendment — all retained only as closed records.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @test-plan-writer | Initial test plan from GH-295 spec v1.0: 51 cases across structure, behaviour, golden, checks, and docs levels; all eight ACs mapped; milestone seeds SC-M2-S2-01/02 reconciled per DEC-2 (parkReason → `reason` = `parked:liveness-stall`, seed `until` → DM-3 additive lane field) and mapped to concrete steps and assertions; delivered families mirrored for structure/behaviour/golden conventions; GAP-T1 reported as requiring a targeted specification amendment. |
| 1.1 | 2026-11-16 | @test-plan-writer | GAP-T1 resolution against **spec v1.1 DEC-8**: TC-SUP-051 rewritten as three cells (acting authority refuses per-action at exit `1` with the claim and holder named; live daemon presence parks at exit `0`; held-session park intent refused by neither identity) plus a retry-after-window control; TC-SUP-092 extended to the per-action refusal golden plus the paired live-claims data golden at exit `0`; AC-F6-1 flipped to **Covered**; index, §3.1, §5 details, §6 goldens/fixtures, §7.1/§7.4 mappings, TR-1, AMB-4 and §10 updated; OQ-TP-4 recorded as settled by DEC-8(c), OQ-TP-1..3 unchanged phase-4 items. IDs unchanged; 51 cases, none awaiting a decision. |
| 1.2 | 2026-11-17 | @test-plan-writer | Reference-path correction from DoR iteration 1: the two §2 rows naming retired pages replaced by the real current-truth homes (`feature-scheduling-engine.md`, `feature-queue-ready.md`, `feature-peak-pausing.md`); the landing-page path corrected to `doc/00-index.md`. No case, ID, coverage row, or assertion changed. |
| 1.3 | 2026-11-17 | @test-plan-writer | DEC range alignment with spec v1.1 DEC-8: §2's spec row now reads `DEC-1..DEC-8`. No case, ID, coverage row, or assertion changed. |
| 1.4 | 2026-11-17 | @test-plan-writer | **Review iteration 1 amendment** (`code-review/review-iter-1.yaml`: F-1 critical, F-2 high, F-4 high, plus medium F-6/F-7/F-8/F-9/F-11/F-12/F-13) against **spec v1.2 DEC-9**. TC-SUP-043 rewritten to the delivered DEC-9(b) carrier — immediate durable park record over a held session, action reported as `safe-boundary-park-intent`, zero session effect and zero signals, operator-visible outcome identical to the unheld twin; the deferred-landing expectation is retired. TC-SUP-051 aligned to DEC-9(c) — the acting artifact is the `daemon.preemption` pending record inside the imported corroboration bound, record-only, with a new **detection-limit cell** for authority classes that leave no durable record. Four cases added (55 total, IDs stable): TC-SUP-100 closed-set cause/writer round-trip, TC-SUP-101 operator refusal with healthy later reads, TC-SUP-102 empty/missing-expiry hardening, TC-SUP-103 action-path one-fold (NFR-4/DEC-9(d)). Existing oracles aligned to the remediation: per-lane heartbeat (F-6: TC-SUP-001/004/090 and the §3.4 seed reconciliation), per-claim-kind heartbeat record kinds (F-7: TC-SUP-050/092), injected run identity on restart/exhaustion/question records (F-8: TC-SUP-060..063), a genuinely live daemon claim in the presence cell (F-9: TC-SUP-051), the evidence-cap boundary cell (F-11: TC-SUP-082), no dead declared input member (F-12: TC-SUP-014), and restored exact-set family membership with one captured list backing every pin (F-13: TC-SUP-096 plus §7.3); the composed-production action path is now exercised (F-10, TC-SUP-096) and the acting-run read-cost/latency cells added (F-2). §3.1 AC rows (all eight still Covered; AC-F5-1 gains 043/100/101/102, AC-F6-1 gains 103), §3.2 DM-2, §3.3 NFR-2/3/4/6, §4.2/§4.3 obligations, §5 index and details, §6 fixtures/goldens, §7.1/§7.2/§7.3/§7.4, §8.1 (TR-9..TR-13), §8.2 (AMB-6..AMB-8), §8.3 (OQ-TP-5..OQ-TP-9 closed/routed) and §10 updated. No cell is skipped, unowned, or awaiting a decision. |
| 1.5 | 2026-11-17 | @test-plan-writer | **Review iteration 2 amendment** (`code-review/review-iter-2.yaml`: F-1 critical, F-2 high, F-3/F-4 medium, plus the two low residuals re-raised from iteration 1's F-17/F-19) against **spec v1.3**. TC-SUP-103 rewritten to the precise discipline: **one decision fold** read per run, **no per-lane whole-store re-read**, the blocker ledger read at most once per run, and the delivered append helpers' read-backs recorded as a **declared bounded expectation** (never a bare `1`) — measured over the **composed production closures**, with a store-free economics fake explicitly forbidden. TC-SUP-061 rewritten under DEC-9(f) to run twice with **different injected run ids** and assert exactly one terminal exhaustion record and exactly one ref-stable decision question (no question id may embed a run id; no action for a record that did not land). Three cases added (58 total, IDs stable): TC-SUP-104 park-state interaction under DEC-9(e) (owner-hold, peak-window, stuck clear-observed → zero appends, honest report, `liveness-stall`-only admission, healthy `queue`/`lanes` reads), TC-SUP-105 composed-production acting run (park + restart + exhaustion through `createProductionComposer` plus the one-shared-closure-factory structure assertion), TC-SUP-106 behavioural normalizer integrity (declared volatile fields replaced exactly, undeclared values untouched, no volatile value in any committed golden — replacing the tautological constant-length check, F-17). TC-SUP-082 gains the measured human-render cell and the corrected "bounded only by the lane cap" statement (F-19), TC-SUP-040 gains the post-action healthy-read assertion, and every action cell now ends healthy (§4.3). §2 (spec v1.3 + review-iter-2 row), §3.1 (AC-F2-1 ← 104; AC-F5-1 ← 104/105; AC-F6-1 ← 105; AC-F7-1 ← 104/105), §3.2 DM-2/DM-3/DM-4, §3.3 NFR-3/NFR-4, §4.2/§4.3 obligations, §5 index and details, §6 fixtures/goldens, §7.1/§7.2/§7.3/§7.4, §8.1 (TR-14..TR-18), §8.2 (AMB-9..AMB-13), §8.3 (OQ-TP-10..OQ-TP-14 closed, OQ-TP-9 updated) and §10 updated. No cell is skipped, unowned, or awaiting a decision. |
| 1.6 | 2026-11-17 | @test-plan-writer | **Review iteration 3, F-2 (medium, accuracy)**: mutant/occupancy wording corrected; no case ID or asserted expectation changed. Occupancy is now stated as the delivered **one home** — `activeParkRecords` in the queue-park domain, whose sequence semantics (`parked` occupies until `recovered`/`released`, `clear-observed` keeps the occupancy standing) are shared by the supervision fold's `activePark` and the duplicate-active-park validator, so a stuck `clear-observed` record occupies the lane and the writer's gate and the reader's validator cannot disagree by construction. The v1.5 wording described the pre-fix implementation — a fold that treated a clear-observed park as free — and its accompanying mutant was the delivered implementation itself, so it could never go red; both are replaced by a failing mutant — **latest-record-wins occupancy**, which drops the sequence semantics and treats a non-`parked` latest state as free, so the stuck/clear-observed cell appends and the later reads tear. Touched §4.3 ("No second active park"), TC-SUP-104's precondition (c), mutant list and occupancy bullet, the §6 `staleClearObservedPark()` fixture description, AMB-9, and — for the same mechanism-attribution class — the three seam-dedupe references now restated as the caller's occupancy gate (TC-SUP-043, TC-SUP-051 notes, OQ-TP-4) to match spec v1.4, which states the append seam performs no dedupe. §2 now pins spec v1.4. |

## 10. Test Execution Log

No cases have been executed at authoring time (verification map only). Phase ownership of these cases is declared in `chg-GH-295-plan.yaml` (phase 4).

| TC ID / group | Run date | Result | Notes |
|---|---|---|---|
| — | — | — | Populated during delivery. Record for each stage: the exact command, the exit, and either "PASS" or "PARTIAL (reason)". |
| Structure: TC-SUP-014/030/032/045/046/053/063/070/071/072/094/095/096 (phase 1-7 commits 1309166f, ae4ab741, 4094dd53, a330a531, 9ca4b26a, 70071c71, fbbe3c14) | 2026-11-17 | PASS | `bun test tests/structure tests/checks` green at every boundary; the error-table sync check reports entries=148 documented=148 allowlist=64 corpus=70; every named mutant fails. |
| Behaviour: classification/claims/watchdog/report/scope/grammar/evidence-absent/read-cost/isolation/stall-park/lanes-parked/lying-liveness/corroboration/additivity/restart/recovery/duplicate-refusal/single-flight/exits/determinism/bounds/performance/evidence-totality (phases 2-7) | 2026-11-17 | PASS | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/supervision*.test.ts tests/behaviour/lanes-parked-stall.test.ts` green; matrix totality 12/12 executed; one read pass per run at 50 and 200 lanes; 200-lane run measured 3.41 ms and 1.47 ms (bound 5,000 ms). |
| Golden: TC-SUP-090/091/092/093 | 2026-11-17 | PASS | `bun test tests/golden` green against the CREATED goldens (supervision-report.json/.txt, supervision-stalled.json, supervision-evidence-absent.json, supervision-refusal.json, supervision-live-claims.json, lanes-show-parked.json/.txt); the normalizer replacement list is exactly three entries; the delivered non-parked lanes goldens are unchanged. |
| Checks: TC-SUP-071/072/096 | 2026-11-17 | PASS | The live-tree sync check is green; both-direction mutations fail with the offending row named; help-guide coverage and reference-page parity green with the supervise row and M2 page. |
| Docs/content: TC-SUP-097 | 2026-11-17 | PASS (review-verified) | The delivery-side content record: the M2 reference page exists with the invocation, grammar, tri-state, park, exit codes, and no-process posture and is registered in the coverage inventory and the forbidden-literals corpus; the first `feature-supervise` page and the watchdog/daemon boundary-text reconciliation are authored in lifecycle phase 7 (@doc-syncer) per the plan handoff block, and are verified there by the content checks. |
| Error socialisation: TC-SUP-070/071/072 | 2026-11-17 | PASS | `tests/checks/supervision-error-socialization.test.ts` and the delivered sync suite green; four-way classifier/sync/mirror/carrier agreement on 148 entries / 147 delivered / 64 allowlist. |
| Aggregate: every plan-phase boundary and the delivered HEAD | 2026-11-17 | PASS | `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits 0 at each boundary (final run: 9984 pass / 0 fail). Three separate boundary attempts tripped one delivered timing-sensitive suite each under host load; each passed on the immediate rerun with no code change (recorded in pm-notes as environmental flakes). |
| Amendment coverage (v1.4): TC-SUP-100..TC-SUP-103 and the revised cells in TC-SUP-001/004/014/043/050/051/060-063/082/083/090/092/096 | 2026-11-17 | Superseded by remediation + review iteration 2 | These cells were authored against review iteration 1 and were executed by the remediation; review iteration 2 confirmed F-6/F-7/F-8/F-9/F-11/F-12/F-13 closed and re-opened the read-discipline cell (TC-SUP-103, now rewritten here) and the exhaustion repeat cell (TC-SUP-061, now rewritten here). |
| Amendment coverage (v1.5): TC-SUP-104/105/106 and the revised cells in TC-SUP-061/082/090/103 (+ the healthy-read bullet in TC-SUP-040) | 2026-11-17 | Not executed | Authored after review iteration 2. Expected to **fail against the pre-remediation tree** — that is their failing-first evidence: a lane parked under `owner-hold`/`peak-window` gains a second active park and the next read is torn (TC-SUP-104), two runs with different run ids raise two questions (TC-SUP-061), a composed acting run records 8 whole-store reads with the blocker ledger read twice (TC-SUP-103/105), the fixture duplicates the production closure (TC-SUP-105 structure half), and the normalizer assertion cannot fail (TC-SUP-106). No earlier PASS row is withdrawn; those rows are true for the tree they measured and become stale for the amended expectations, which the remediation's fix phase must resolve before the next gate run. |

Append-only gate evidence to record here when it exists: `TMPDIR=$PWD/tmp/tmpdir pnpm check` output summary after the remediation; the determinism replay record; the measured 200-lane latency for both the read-only and acting runs; the measured composed-run read total (decision fold plus append read-backs, with call sites); the measured human-render size at the cap; the golden-regeneration command used (if any) with the reviewed diff; the doc-reconciliation review record for TC-SUP-097; and a `PARTIAL` note with its reason if any case is ever skipped. No case awaits a decision: TC-SUP-051 and TC-SUP-092 are fully specified against DEC-8, the v1.4 cells against spec v1.2 DEC-9(a)-(d), and the v1.5 cells against spec v1.3.
