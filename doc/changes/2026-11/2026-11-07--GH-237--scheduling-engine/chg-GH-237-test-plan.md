---
id: chg-GH-237-test-plan
status: Updated
created: "2026-11-07T10:30:00Z"
last_updated: "2026-11-07T13:30:00Z"
owners: [engineering]
service: delivery-os scheduling engine
labels: [change, planning]
version_impact: minor
summary: "Prove the scheduling engine as machinery, not coordinator discipline: one fenced, replay-idempotent queue graph; readiness re-derived from artifacts on the delivered six-condition model; per-repo single-flight leases with a scope field and daemon-free fence-token claim/release; stale-lease takeover with evidence and zero live-lease takeover; build weight as a per-runner resource class, never a lane cap; producer-before-consumer batching with a deploy-verified gate; a declared total precedence in which closing beats opening; parks with per-type recheck, exact resume, recovery incidents, and the classified stuck-park finding; the queue and lanes command surfaces with bounded payloads and truthful daemon-down degradation; and additive, bidirectionally synchronized record kinds, error rows, collector ids, and configuration keys. The battery is hermetic and deterministic: injected clock, fence/state transport, provider reads, deploy reads, and economics fold; zero live network, live credentials, or real sleeps. 66 named TCs cover all 22 acceptance criteria (spec v1.2, including AC-F4-3, AC-F5-2, AC-F6-2, AC-F8-1's stuck-park hard exclusion, and AC-F10-3), the six seeded scenarios (SC-M1-08/09/10/11/17/17b) without weakening their assertions, and all 14 NFRs. DoR iteration-1 remediation (R-04, R-06, R-07, R-16) is folded in: TC-PARK-008 proves a stuck park is never a next action, Phases 3–5 command invocations are marked partial with their CLI rows completing in Phase 7, and TC-LEASE-002 pins 50 distinct holders."
links:
  change_spec: ./chg-GH-237-spec.md
  implementation_plan: ./chg-GH-237-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S17: Scheduling engine: queue, lanes, dependency batching

## 1. Scope and Objectives

This plan protects one behavioural thesis: **parallelism is computed from declared artifacts, not discovered by a coordinator**. That thesis fails if queue intent is not one durable, replay-idempotent graph; if readiness is ever inferred from a stale flag, a failed read, or a fabricated zero; if two same-repository claims can both acquire a lease; if a live lease can be taken over or a stale one is silently stranded; if build weight becomes a lane cap instead of a per-runner resource class; if a consumer lands before its producer's deploy verdict is `verified` while expectations are declared; if merge-ready work ranks below a new start; if a park resumes late, silently, or without a recovery incident; if a read surface writes, fabricates an empty view, or hides an unreadable store; or if any new vocabulary row drifts from its documented table.

The highest-severity surfaces are **same-repository mutual exclusion** (F-3, F-4; RSK-1) and **fail-closed truthfulness** (NFR-13; F-2). A single missing re-read inside the fence, a takeover of a live lease, an unreadable lease read as "free", or a failed source read as `satisfied` is a delivery-correctness defect, not a test inconvenience. The plan therefore proves concurrency behaviour with deterministic, fixture-driven interleavings — injected clock, injected fence/state transport, injected provider and deploy reads, and a scheduled single-writer gate — never with real OS races, real sleeps, live network, or live credentials (NFR-3, NFR-7).

The seeded scenarios `SC-M1-08`, `SC-M1-09`, `SC-M1-10`, `SC-M1-11`, `SC-M1-17`, and `SC-M1-17b` in `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` are binding and are inherited without weakening. Their assertions are folded into TC-LEASE-001, TC-LEASE-002, TC-LEASE-003, TC-LEASE-005, TC-LEASE-006, TC-WEIGHT-001, TC-WEIGHT-003, TC-RANK-001, TC-PARK-001, TC-PARK-002, TC-PARK-005, TC-PARK-008, TC-SCHED-008, TC-SCHED-009, and TC-SCHED-010.

### 1.1 In Scope

- Queue declaration and the folded graph: entries, explicit priorities, repository keys, each entry's recorded declaring-checkout root, dependency edges (including an edge to a ref with no entry, retained and evaluated `dependency-unobserved`), cycle refusal before append, idempotent replay, and superseding-entry semantics (F-1, F-2; DM-1, DM-2, DM-13; EVT-1, EVT-2; AC-F1-1; NFR-8).
- Artifact-computed readiness on the delivered six-condition model, with scheduler truth for `deps-satisfied`, `repo-free`, and `tier-known`, closed tri-state, bounded evidence, named blockers, and `unknown` for every failed/unavailable/unresolved source (F-2; DM-3; AC-F2-1; NFR-1, NFR-13).
- Per-repo single-flight leases with a `scope` field, repository-key normalization, the per-pass projection that holds the remainder of a repository's ready entries `repo-claimed-in-pass` (distinct from `lease-held`), the "only structural cap" invariant, and the absence of any capacity/bandwidth/CI-slot input (F-3, F-9; DM-4, DM-12; AC-F3-1(a), AC-F3-1(b), AC-F3-2; NFR-14).
- The daemon-free one-shot scheduling step: the two-stage claim (pre-fence readiness excludes `repo-free`; the in-fence verified lease read owns `queue.lease-conflict`; a genuinely unready entry is `queue.precondition.unmet` on the other five conditions), fence-token claim, in-fence re-read, post-append verification, conflict refusal with holder evidence, stale-lease takeover with evidence, renewal, release, and park-on-release atomicity; a no-ref claim selects the top-ranked eligible action deterministically (F-2, F-4; DM-4, DM-6; EVT-3, EVT-5; AC-F4-1, AC-F4-2, AC-F4-3; NFR-3, NFR-4, NFR-13).
- Build-weight classes as a per-runner resource class with conservative resolution and no lane-count reduction; an unreadable or absent plan resolves to `heavy`, never `standard` (F-5; DM-7; AC-F5-1, AC-F5-2; DEC-10).
- Dependency-aware batching, producer precedence, landing observation, and the deploy-verified gate with producer-bound expectations, producer-root discovery from entry-recorded roots (exact-key match; no match or a collision → `unknown`), and its bounded, memoized deploy-read budget (F-6; DM-1, DM-2, DM-9, DM-12; AC-F6-1, AC-F6-2; NFR-6, NFR-13).
- Closing-beats-opening rank classes, resumable-park ranking, computed preemption with the named park state, and the explicit release path (F-7; DM-8, DM-10; AC-F7-1, AC-F7-2).
- Parks with two distinct closed sets (condition types `{provider-window, provider-quota, preemption}` and causes `{provider-window, provider-quota, preempted-for-close-item}`) with the one-to-one cause↔condition pairing, per-type recheck configuration, exact resume, auto-recovery incidents, the stuck-park finding, the stuck park's hard exclusion from `nextActions`/`resume-parked`/no-ref selection, and fail-closed unreadable park history (F-7, F-8; DM-5, DM-6, DM-14; EVT-4, EVT-5; AC-F8-1, AC-F8-2; NFR-5, NFR-10, NFR-13).
- The declared total scheduling precedence: hard exclusions strictly before ordering, rank before producer tie-break, priority only inside a class, numeric suffix then ref text, and input-order invariance (F-9; AC-F9-1; Appendix B).
- `queue` (`list`, `plan`, `add`, `prioritize`, `dep`, `claim`, `release`) and `lanes` (`list`, `show`) command surfaces, envelope shapes, exit projection, refusal semantics, bounded payloads, truthful `daemon-unreachable` degradation, and fail-closed read projection at exit 2 when lease or park history is unreadable/torn/unknown-kind (F-10, F-11; AC-F10-1, AC-F10-2, AC-F10-3, AC-F11-1, AC-F11-2; NFR-2, NFR-9, NFR-13).
- Guarded vocabulary growth synchronized in-change: five additive record kinds plus one derived document, five `queue` error rows, the collector-id extension `tracker` → `{tracker, lanes}`, the typed `queue` configuration branch, and bidirectional documentation/code agreement (F-12; EVT-1..EVT-5; AC-F12-1; NFR-8, NFR-10, NFR-11, NFR-12, NFR-14).
- Backward compatibility: `queue ready` grammar, sources, ranking, caps, read-only posture, error rows, and byte-identical output preserved (NG-4; AC-F12-1).
- Cross-cutting guarantees: determinism, hermeticity, read purity, bounded output, and redaction (NFR-1, NFR-2, NFR-7, NFR-9, NFR-12).

Ticket-to-AC traceability: the six ticket ACs in Appendix G map to AC-F3-1(a)/AC-F3-1(b)/AC-F4-1/AC-F4-2 (same-repo single-flight), AC-F5-1 (heavy not co-scheduled), AC-F6-1 (producer before consumer), AC-F7-1/AC-F9-1 plus AC-F7-2 (close-first and preemption), AC-F8-1/AC-F8-2 (park resume and recheck), and AC-F10-1/AC-F10-2 (daemon-free one-shot).

### 1.2 Out of Scope & Known Gaps

- [OUT] Resident daemon, control socket, NDJSON wire protocol, `daemon start|stop|status|install`, startup reconciliation, restart budgeting across daemon restarts, concurrent connections, and subscribe overflow — NG-2; M1-S18 (GH-238); seeds SC-M1-16, SC-M1-18, SC-M1-20. Not tested here.
- [OUT] `dispatch`, session spawn, harness selection, resume handling, dispatch classification, dual-run summary, and handover — NG-1; M1-S9 (GH-239); seeds SC-M1-26..SC-M1-30. This plan proves the one-shot claim/release capability `dispatch` will compose; it does not drive a session.
- [OUT] Live `--watch` streaming on `lanes` or `queue`. Only the refusal path is tested (TC-LANES-004); no stream, frame, or daemon transport is exercised.
- [OUT] Automatic preemption execution. The pass computes and emits the preemption action; the release is performed by explicit `queue release --park` (AC-F7-2). Automatic execution belongs to M1-S18.
- [OUT] `worktree`-scoped leases, per-repository parallel mode, scope arbitration, and overlap-based lane splitting — NG-7. The `worktree` scope is declared-and-unused; TC-LEASE-009 asserts no delivered path acquires it.
- [OUT] Capacity, bandwidth, concurrency-budget, CI-slot, or spend-based scheduling — NG-8. TC-LEASE-009 asserts no such code path, configuration key, or decision rule exists.
- [OUT] Merge execution, gate evaluation, waiver handling, and rebase-refresh — NG-6. The engine only reads the delivered `verify deploy` verdict.
- [OUT] Tracker ticket creation, prioritization, state transition, label changes, and tracker-driven queue discovery — NG-5; OQ-1. Queue membership is explicit via `queue add`.
- [OUT] Fleet or multi-host coordination and any transport beyond the local state directory — NG-9.
- [OUT] Status-digest and brief behaviour change, including the digest's `lanes-or-queue` gap section — NG-10. Only the collector-id family extension is tested (TC-VOCAB-003).
- [OUT] Typed-question authoring and blocker round-trip — M1-S16; seed SC-M1-13. The engine names blocking conditions; it does not author questions.
- [OUT] M1-S21/S22/S23 provider-profile, audit, and coordinator-supervision behaviour — seeds SC-M1-21..SC-M1-25.

- [GAP-T1 — `queue ready` preservation is proved by fixture equivalence, not by never touching the file] AC-F12-1 and NG-4 require unchanged behaviour. The plan asserts byte-identical machine and human output over the existing `tests/fixtures/queue-ready/**` corpus and asserts the absence of new `queue` rows attributable to `ready` (TC-COMPAT-001, TC-VOCAB-002), plus a structural check that the six condition ids, fixed order, tri-state, and evidence vocabulary are unchanged (TC-VOCAB-005). It does not assert that no source file changed.
- [GAP-T2 — provider and deploy reads are fixture-proven, not live-proven] Tracker, pull-request, CI, provider, and deploy reads are external. Tests prove normalization, tri-state derivation, budget accounting, and "never green on unreadable" over committed fixtures; they never call a vendor. Live-shape drift remains a review/operations concern. A missing fixture fails the test naming the missing fixture rather than weakening the assertion.
- [GAP-T3 — concurrency is deterministic interleaving, not OS-level parallelism] NFR-3 and AC-F4-1 describe concurrent claims. The suite uses a scheduled single-writer fence fixture that forces both claims to observe "no lease" before the fence is acquired, then drains the fence in a declared order; it asserts exactly one acquisition and 49 refusals at the *algorithmic* contract. It does not prove OS-scheduler or multi-process memory behaviour. RSK-1 mitigation is the in-fence re-read plus post-append verification, both asserted structurally and behaviourally (TC-LEASE-002, TC-LEASE-004).
- [GAP-T4 — resolved by spec v1.1 C-3] F-8 says a park observed clear that is still active on a later pass — or whose recovery append was refused — is stuck. NFR-2 forbids reads from writing. Spec v1.1 pins the durable marker on the `queue.park` record (`delivery.queue.park.v1`, key `queue.parks:<REF>`, fields `clearObservedAt` and `recoveryState: clear-observed`) appended by a mutating pass before recovery (C-3, DM-5, EVT-4, Appendix D). TC-PARK-002 seeds exactly that record and asserts the marker precedes recovery and survives a refused recovery.
- [GAP-T5 — lane idle-reason vocabulary is closed in intent but not enumerated] F-11 says the idle reason is bounded and drawn from blocking conditions and scheduler holds; the exact strings are not listed. TC-LANES-001 asserts every reason resolves from the declared set and no free-form string leaks, without freezing names that delivery may choose.
- [GAP-T6 — NFR-6 "reference environment" is unspecified] The ≤ 250 ms plan over 500 entries and 1 000 edges excludes provider reads and depends on the runner. The perf test records the measured baseline and asserts the bound on the reference CI class; a slower local machine is not a defect. The test also asserts the *structural* bound (32 evaluated candidates, named truncation, memoization counts), which is environment-independent.
- [GAP-T7 — delivery-bound names and locations] Module paths, export names, record-kind strings, payload-schema identifiers, configuration keys, error identities, and fixture filenames are delivery-bound. The behaviours, closed sets, AC traces, and assertions are not. Per §4, a test that cannot resolve a seam must fail naming the missing contract instead of silently skipping.

## 2. References

- **Change specification**: [chg-GH-237-spec.md](./chg-GH-237-spec.md) — §5 F-1..F-12, §6 flows 1–7, §8 EVT-1..EVT-6 and DM-1..DM-14, §9 NFR-1..NFR-14, §10 telemetry, §11 RSK-1..RSK-10, §12 assumptions, §14 OQ-1..OQ-4, §15 DEC-1..DEC-13, §5.2 contract clarifications C-1..C-7, §17 AC-F1-1..AC-F12-1, §18 delivery order, §21 security, §24 Appendix A (seeded-scenario reconciliation), Appendix B (precedence order), Appendix C (envelope shapes), Appendix D (record kinds and derived document), Appendix E (configuration keys), Appendix F (error identities), Appendix G (ticket AC map).
- **Seed scenarios**: [doc/planning/oss-tooling/milestones/m1/test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-08, SC-M1-09, SC-M1-10, SC-M1-11, SC-M1-17, SC-M1-17b are binding; divergence after delivery is a defect.
- **M1 design pack**: [contracts.md](../../../planning/oss-tooling/milestones/m1/contracts.md) (envelope/exit/refusal pins, timing defaults), [commands/queue.md](../../../planning/oss-tooling/milestones/m1/commands/queue.md), [commands/lanes.md](../../../planning/oss-tooling/milestones/m1/commands/lanes.md), [architecture.md](../../../planning/oss-tooling/milestones/m1/architecture.md) (state-mediated truth, writer ownership, queue/lanes/parks placement), and [doc/planning/concepts/parallel-delivery.md](../../../planning/concepts/parallel-delivery.md) (lease scope and single-flight as policy).
- **PM record**: [chg-GH-237-pm-notes.yaml](./chg-GH-237-pm-notes.yaml) — context only: one-shot boundary, `--watch` scope, park-recheck on demand, `queue ready` preservation, OQ-2/OQ-3 dispositions, and OQ-1/OQ-4 acceptance. The spec is the source of truth.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` under `tests/**/*.test.ts`; fixtures never `*.test.ts`; permanent suites assert the current tree; goldens regenerated by an explicit command; `pnpm check` is the aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, ports and fakes over module mocking, the error contract, and deterministic `bun:test` authoring.
- **Delivered substrate reused, never re-implemented**:
  - Queue-ready contract and domain: `packages/core/src/contracts/queue-ready.ts`, `packages/core/src/domain/queue-ready.ts`, `packages/cli/src/commands/queue.ts` (`ready` only), `tests/fixtures/queue-ready/**`, and the fifteen `tests/behaviour/queue-ready-*.test.ts` suites.
  - State layer: `packages/core/src/contracts/state.ts` (`StateStorePort`, `StateFenceHandle`, verified reads, append, `replaceDocument`), `packages/core/src/state/**`, and the injected harness `tests/fixtures/state/harness.ts`.
  - Delivery plan schema: `packages/core/src/contracts/plan.ts`, `packages/core/src/domain/plan-validate.ts`, `plan-overlap.ts`, `tests/fixtures/plan/**`.
  - Merge and verify-deploy: `packages/core/src/contracts/verify-deploy.ts`, `packages/core/src/domain/verify-deploy.ts`, `tests/fixtures/verify-deploy/**`.
  - Session lifecycle economics: `packages/core/src/contracts/economics.ts`, `packages/core/src/domain/economics-view.ts`, `tests/fixtures/economics/**`.
  - Configuration layer: `packages/core/src/config/{catalog,defaults,resolver,schema,provenance}.ts`, `packages/core/src/contracts/config.ts`, `tests/fixtures/config/**`, `tests/behaviour/config-*.test.ts`.
  - Provider engine and parks: `packages/core/src/contracts/provider.ts`, `packages/core/src/provider/**`, `tests/fixtures/queue-ready/providers/**`.
  - Result contract and error table: `packages/core/src/contracts/{result,error-table,envelope}.ts`, `packages/cli/src/classify.ts`, `packages/cli/src/projection.ts`, `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts`.
  - Collector family: `packages/core/src/contracts/owner-gate-sla.ts` (`BOARD_COLLECTOR_IDS`, `status.collector.{id}.unavailable`), `packages/core/src/contracts/error-table.ts`, board collector suites.
  - Secret-read boundary: `scripts/checks/secret-read-boundary.ts`, `tests/checks/secret-read-boundary.test.ts`.
  - Boundary machinery: `.dependency-cruiser.cjs`, `scripts/checks/ambient-globals.ts`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/**`.
- **Precedent plans**: [chg-GH-234-test-plan.md](../../2026-11-07--GH-234--model-profiles/chg-GH-234-test-plan.md) (provider engine, 58 TCs) and [chg-GH-251-test-plan.md](../../2026-11-06--GH-251--ci-failure-propagation/chg-GH-251-test-plan.md) (failure-propagation rigour) — house format.
- **Related system specs**: `doc/spec/features/feature-queue-ready.md`, `feature-plan-schema.md`, `feature-state-layer.md`, `feature-merge-verify-deploy.md`, `feature-session-lifecycle-economics.md`, `feature-config-layer.md`, `feature-provider-engine.md`, and `feature-result-contract.md` (paths as delivered; reconcile at doc-sync).
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#237` — M1-S17: Scheduling engine: queue, lanes, dependency batching.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | Entry and first edge land under the fence; the entry records its repository key and declaring-checkout root; a seeded edge to a ref with no entry is retained and readiness reports `unknown` with `dependency-unobserved` until the producer is declared; a cycle-creating edge is refused with `queue.dependency-cycle` naming the existing path and appends nothing; identical replay appends nothing; `queue list` shows entry, repo key, recorded root, priority, and edge. | TC-SCHED-001, TC-SCHED-002, TC-SCHED-015, TC-DEPEND-001 | Covered |
| AC-F2-1 | Exactly six conditions in the delivered order with the closed tri-state; open dependency → `unsatisfied`, owner label → `unsatisfied`, unreadable CI → `unknown` with reason; every non-satisfied condition in `blockingConditions`; not ready; no fabricated zero and no `satisfied` from a failed read. | TC-SCHED-003, TC-SCHED-005 | Covered |
| AC-F3-1 | (a) Read-only projection: `queue plan`/`queue list` show exactly one eligible action per repository — before any lease exists, the other ready entry is held `repo-claimed-in-pass` (a per-pass projection reason distinct from `lease-held`), and once any lease exists for repo-alpha, names `lease-held` with holder and lease evidence for the other entry, without claiming or holding a lease; (b) mutating enforcement: concurrent or repeated claims on one repository acquire exactly one `repo-exclusive` lease and refuse the rest at exit 1 with `queue.lease-conflict` (never `queue.precondition.unmet` for repository exclusivity), naming holder and lease identity, so exactly one holder exists per repository and a same-holder repeat renews. (SC-M1-08) | TC-LEASE-001 (a,b), TC-SCHED-004 (a), TC-LEASE-002 (b) | Covered |
| AC-F3-2 | Every lease carries `scope: repo-exclusive`; no delivered path acquires another scope; no config key, code path, or rule reduces lane count for capacity/bandwidth/CI slots. | TC-LEASE-009, TC-VOCAB-004 | Covered |
| AC-F4-1 | Daemon down, no lease, two concurrent one-shots: exactly one acquires with a recorded heartbeat, the other refuses exit 1 `queue.lease-conflict`, consequence `not_landed`, naming holder and lease; repository exclusivity is decided only by the in-fence verified lease read and is never a pre-fence `queue.precondition.unmet`; a same-holder repeat claim renews; a lease at/beyond `queue.lease-ttl` is taken over with evidence, and a live lease is never taken over. (SC-M1-17b) | TC-LEASE-002, TC-LEASE-003, TC-LEASE-004, TC-LEASE-005, TC-LEASE-013 | Covered |
| AC-F4-2 | An unreadable/torn lease history makes a claim refuse with the classified `state.*` identity at exit 2, perform no append, and never report the repository free. | TC-LEASE-006, TC-SCHED-005 | Covered |
| AC-F4-3 | With eligible entries and no ref argument, `queue claim` selects the top-ranked eligible action from the declared precedence deterministically, names the selected ref in the envelope, and repeats the same selection on identical passes; with no eligible action it refuses at exit 1 with `queue.precondition.unmet`, reason `no-eligible-action`, and appends nothing. | TC-RANK-005 | Covered |
| AC-F5-1 | Runner R2 carries a heavy lease and GH-309 is heavy and ready: GH-309 held `weight-class`, at most one heavy per runner, standard entries continue, active repository count unchanged. (SC-M1-09) | TC-WEIGHT-001, TC-WEIGHT-003, TC-WEIGHT-004, TC-WEIGHT-002 | Covered |
| AC-F5-2 | An invalid, unreadable, or absent plan resolves weight to `heavy` with source evidence `plan-unreadable` or `plan-absent` (naming `plan.schema.invalid` or `plan.artifact.missing`), never to `standard`; an invalid/unreadable plan holds `tier-known` unknown, and an absent plan is subject to the heavy cap or the triage fallback's readiness verdict, so the entry is never scheduled as standard. | TC-WEIGHT-002, TC-SCHED-005 | Covered |
| AC-F6-1 | Consumer held `dependency-open` while producer unresolved; with producer landed and deploy expectations declared, consumer merge eligible only after `verify deploy` is `verified` with evidence, held `deploy-unverified` on `unknown`/`failed`/exhausted budget, landing-only with `deploy: not-declared` otherwise; producer ranks before consumer in one repository. | TC-DEPEND-001, TC-DEPEND-002, TC-DEPEND-003, TC-DEPEND-004, TC-DEPEND-005, TC-DEPEND-006 | Covered |
| AC-F6-2 | In a state directory spanning producer repo-alpha and consumer repo-beta, a dependent merge reads repo-alpha's deploy expectations from repo-alpha's own configuration bound to its recorded repository key through the entry-recorded root whose normalized remote matches that key, not from the invocation's configuration; no matching recorded root, two distinct roots claiming one key (collision), or a missing, unreadable, or invalid matched config yields `unknown` (never `not-declared` or `verified`) and the dependent holds `deploy-unverified`. | TC-DEPEND-003, TC-DEPEND-004 | Covered |
| AC-F7-1 | One merge-ready and one ready new start: `queue plan --next 2` ranks merge-ready first, both carry reasons, and the order is byte-identical across repeated runs. (SC-M1-10) | TC-RANK-001, TC-SCHED-008, TC-SCHED-006, TC-SCHED-013 | Covered |
| AC-F7-2 | A merge-ready entry on repo-alpha whose lease is held by a new start produces a preemption action naming `preempted-for-close-item` and the holder; the close item is not scheduled that pass; `queue release GH-311 --park preempted-for-close-item` releases and records the park in one fenced transaction (both or neither). | TC-RANK-003, TC-RANK-004, TC-LEASE-011 | Covered |
| AC-F8-1 | A provider-window park ending at T resumes within one interval of T when a mutating pass runs within that interval, with a `queue.incident` naming condition, clear time, evaluation time, and observation gap; when no mutating pass runs within one interval, the first pass after the gap recovers with a gap-naming incident and the park is never stuck solely because the gap exceeded the interval; a park observed clear yet still active, or a refused recovery append, is the `queue.park-condition-stuck` finding on reads at exit 0 and a refusal on claim at exit 1 with zero appends; a stuck park is a hard exclusion — never `resume-parked`, never in `nextActions`, never selected by a no-ref claim. (SC-M1-11) | TC-PARK-001, TC-PARK-002, TC-PARK-003, TC-PARK-005, TC-PARK-008 | Covered |
| AC-F8-2 | Changing only `queue.park-recheck.{type}` changes resume timing with no code change and is observable in park evidence; a non-integer, zero, or negative value is refused `config.value.invalid` naming the key. | TC-PARK-006, TC-VOCAB-004 | Covered |
| AC-F9-1 | A generated corpus mixing every gate, both weight classes, three park types, both dependency roles, close and new-start classes, and explicit priorities follows the declared total order exactly — hard exclusions before ordering, rank before producer tie-break, priority only inside a class, numeric suffix then ref text last — and input ordering never changes the result. | TC-SCHED-006, TC-SCHED-007, TC-RANK-002, TC-RANK-006, TC-SCHED-013 | Covered |
| AC-F10-1 | Daemon stopped and one ready entry: `queue plan --next 1` computes from state and exits 0 with `degraded: ["daemon-unreachable"]`; the one-shot claim lands a lease; state is consistent for later reconciliation; no daemon, socket, or background process is required at any point. (SC-M1-17) | TC-SCHED-008, TC-SCHED-009, TC-SCHED-010 | Covered |
| AC-F10-2 | Any successful mutating `queue` subcommand with no daemon reachable lands durably, an identical replay appends nothing, and the envelope reports degradation instead of failing silently or claiming a daemon notification; a refused mutation projects its own exit-1 identity and does not claim degradation as a success. | TC-SCHED-002, TC-SCHED-010, TC-LEASE-010 | Covered |
| AC-F10-3 | An unreadable, torn, or unknown-kind lease or park history makes `queue list`/`queue plan` exit 2 with the classified `state.*` identity and bounded evidence, reporting no success and presenting no `data` sibling, partial view, or empty view as a schedule; a readable park observed clear but still active remains the report-only `queue.park-condition-stuck` finding at exit 0. | TC-LEASE-006, TC-PARK-007, TC-SCHED-009, TC-SCHED-016 | Covered |
| AC-F11-1 | One delivering, one quota-parked, and one failed-past-budget lane: `lanes list` reports ref identity, closed state, bounded idle reason, lease holder and scope when held, restart count and amplification from the economics fold (`null` plus warning when underivable), and weight class — zero writes and zero fabricated values. | TC-LANES-001, TC-LANES-002, TC-LANES-003 | Covered |
| AC-F11-2 | Any `lanes` invocation carrying `--watch` is refused through `fallback.invocation` at exit 1 with a remediation hint naming the resident-daemon story and no empty/partial stream; an unreadable queue store returns `status.collector.lanes.unavailable` at exit 2, never a zero-lane view. | TC-LANES-004, TC-LANES-005 | Covered |
| AC-F12-1 | Delivered `queue ready` grammar, sources, ranking, caps, byte bounds, read-only guarantee, and error rows are unchanged with byte-identical output; the new `queue` rows and extended collector-id set agree across the machine table, documented table, source references, and fixtures in both directions. | TC-COMPAT-001, TC-VOCAB-001, TC-VOCAB-002, TC-VOCAB-003 | Covered |

**Coverage total**: 22 acceptance-criteria rows — 18 from spec v1.0 plus the four added by spec v1.1 (AC-F4-3, AC-F5-2, AC-F6-2, AC-F10-3), all retained and tightened by spec v1.2 (AC-F1-1, AC-F3-1(a), AC-F6-2, AC-F8-1). All are **Covered**; zero AC gaps. AC-F3-1 is a single row with its (a) read-only and (b) mutating clauses mapped to distinct TCs; AC-F8-1 carries the stuck-park hard exclusion in TC-PARK-008.

**Capability coverage** (every F-# has at least one TC):

- F-1 → TC-SCHED-001, 002, 015; TC-DEPEND-001
- F-2 → TC-SCHED-003, 004, 005; TC-DEPEND-001
- F-3 → TC-LEASE-001, 008, 009, 013; TC-SCHED-004
- F-4 → TC-LEASE-002..007, 010, 011, 012; TC-SCHED-010
- F-5 → TC-WEIGHT-001..004
- F-6 → TC-DEPEND-001..006
- F-7 → TC-RANK-001..006; TC-LEASE-011; TC-PARK-008
- F-8 → TC-PARK-001..008
- F-9 → TC-SCHED-006, 007; TC-RANK-002, 006
- F-10 → TC-SCHED-008, 009, 010, 016; TC-LEASE-005, 012; TC-LANES-004
- F-11 → TC-LANES-001..006
- F-12 → TC-VOCAB-001..006; TC-COMPAT-001

**Seeded-scenario traceability**:

| Seed | Binding assertions preserved | TC ID(s) |
|------|-----------------------------|----------|
| SC-M1-08 same-repo single-flight | Read-only projection shows exactly one eligible action per repository, holds the remainder `repo-claimed-in-pass` before any lease exists, and names `lease-held` with holder/lease evidence once a lease exists (AC-F3-1(a)); mutating claims yield exactly one `repo-exclusive` holder and refuse the rest with `queue.lease-conflict`, never `queue.precondition.unmet` for repository exclusivity (AC-F3-1(b)); different repositories never contend. | TC-LEASE-001, TC-LEASE-002, TC-SCHED-004 |
| SC-M1-09 heavy build not co-scheduled | At most one heavy-class job per runner; GH-309 held `weight-class`; standard-class entries still scheduled; the number of active repositories is unchanged (weight is not a lane cap). | TC-WEIGHT-001, TC-WEIGHT-003 |
| SC-M1-10 close-first ranking | Merge-ready ranks first in `queue plan --next 2`; reasons printed for both; byte-identical across repeated runs. | TC-RANK-001, TC-SCHED-013 |
| SC-M1-11 park resumes exactly when its condition clears | Resume timestamp within (T, T+interval] when a mutating pass runs inside the interval; a mutating pass appends the durable `clear-observed` marker before recovery; a park still active after the condition clears surfaces `queue.park-condition-stuck` as a report-only finding on reads and a claim refusal; recovery carries an incident; a stuck park is never a next action (never `resume-parked`, never in `nextActions`, never selected by a no-ref claim). | TC-PARK-001, TC-PARK-002, TC-PARK-005, TC-PARK-008 |
| SC-M1-17 one-shot works daemon-down | Plan computed from state; exit 0 with `degraded=daemon-unreachable`; claim lands a lease; state consistent for later daemon reconciliation. The executor is the scheduling step, not `dispatch`. | TC-SCHED-008, TC-SCHED-009, TC-SCHED-010 |
| SC-M1-17b daemon-down one-shots are mutually exclusive | Exactly one lease record with heartbeat; the refused process exits 1 naming the holder; a stale lease (TTL exceeded, no heartbeat) is taken over with evidence; unreadable state fails closed. | TC-LEASE-002, TC-LEASE-003, TC-LEASE-005, TC-LEASE-006 |

**Decision coverage**: DEC-1 → TC-LEASE-009, TC-WEIGHT-003; DEC-2 → TC-LEASE-002, TC-LEASE-003, TC-LEASE-004; DEC-3 → TC-PARK-001, TC-PARK-002, TC-PARK-006, TC-PARK-008; DEC-4 → TC-DEPEND-001..006, TC-RANK-001..004; DEC-5 → TC-SCHED-003, TC-SCHED-004, TC-COMPAT-001; DEC-6 → TC-SCHED-010, TC-LEASE-012; DEC-7 → TC-LANES-004; DEC-8 → TC-LANES-001, TC-LANES-002; DEC-9 → TC-SCHED-006, TC-SCHED-007; DEC-10 → TC-WEIGHT-002, TC-SCHED-005; DEC-11 → TC-LEASE-006, TC-PARK-007, TC-SCHED-009, TC-SCHED-016; DEC-12 → TC-RANK-005; DEC-13 → TC-DEPEND-003, TC-DEPEND-004.

**Risk coverage**: RSK-1 → TC-LEASE-002, TC-LEASE-004, TC-LEASE-006; RSK-2 → TC-LEASE-003, TC-LEASE-007; RSK-3 → TC-PARK-002, TC-PARK-003, TC-PARK-008; RSK-4 → TC-SCHED-011, TC-DEPEND-005; RSK-5 → TC-SCHED-006, TC-SCHED-013; RSK-6 → TC-DEPEND-003, TC-DEPEND-004, TC-DEPEND-005; RSK-7 → TC-SCHED-010, TC-SCHED-016; RSK-8 → TC-WEIGHT-002; RSK-9 → out of scope (status digest); RSK-10 → TC-VOCAB-002, TC-VOCAB-003, TC-VOCAB-004.

### 3.2 Interface Coverage (EVT-#, DM-#)

The spec declares no REST/HTTP endpoint and no `API-#` identifier (§8.1). The contract is the event payloads, data-model shapes, command envelopes, and error identities below.

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| EVT-1 `queue.entry` intent record | TC-SCHED-002, TC-SCHED-015 | Payload schema `delivery.queue.entry.v1`, store key `queue.entries:{REF}`, latest wins, identical replay appends zero, malformed/wrong kind is `state.*` and never a fabricated entry |
| EVT-2 `queue.dependency` intent record | TC-SCHED-001, TC-SCHED-002 | Schema `delivery.queue.dependency.v1`, key `queue.deps:{REF}`, acyclicity validated before append, duplicate edge appends zero, cycle lands zero |
| EVT-3 `queue.lease` execution record | TC-LEASE-001, TC-LEASE-002, TC-LEASE-003, TC-LEASE-004, TC-LEASE-005, TC-LEASE-011, TC-LEASE-013 | Schema `delivery.queue.lease.v1`, key `queue.leases:{repoKey}`, writer attribution, one new record per operation, post-append verification, takeover evidence |
| EVT-4 `queue.park` execution record | TC-PARK-001, TC-PARK-002, TC-PARK-004, TC-PARK-006, TC-PARK-008, TC-RANK-004 | Schema `delivery.queue.park.v1`, key `queue.parks:{REF}`, a cause from the closed cause set and a condition type from the distinct closed condition-type set with the one-to-one pairing, expiry/recheck/last-eval/clear/recovery, durable `clear-observed` marker (`clearObservedAt`, `recoveryState`) appended before recovery and superseded by `recovered`, at most one active park per entry |
| EVT-5 `queue.incident` execution record | TC-LEASE-003, TC-PARK-001, TC-PARK-003, TC-VOCAB-006 | Schema `delivery.queue.incident.v1`, key `queue.incidents:{REF}` or `{repoKey}`, bounded typed evidence, no free-form prose, no secret |
| EVT-6 computed schedule/findings view | TC-SCHED-008, TC-SCHED-009, TC-SCHED-013, TC-RANK-001 | Envelope-only `nextActions[]`, `entries[]`, `leases[]`, `weights`, `parks[]`, `findings[]`, `degraded[]`; never persisted; identical state → byte-identical output |
| DM-1 Queue entry | TC-SCHED-002, TC-SCHED-015 | Ref identity, repo key absent when unresolved, the declaring checkout's repository root recorded alongside the key, non-negative priority with default, recorded time; weight/tier/rank resolve per pass |
| DM-2 Dependency edge | TC-SCHED-001, TC-SCHED-002, TC-DEPEND-001, TC-DEPEND-003, TC-DEPEND-004 | Consumer→producer edge; an edge may name a ref with no queue entry and is retained, evaluating `unknown` with `dependency-unobserved` until the producer is declared; ordering role and deploy-gating applicability derived from the producer repository's own expectations bound to its recorded repository key |
| DM-3 Readiness evaluation | TC-SCHED-003, TC-SCHED-004, TC-SCHED-005 | Six conditions, fixed order, closed tri-state, bounded evidence, named blockers, ready only when all six satisfied |
| DM-4 Lease with scope | TC-LEASE-001, TC-LEASE-003, TC-LEASE-006, TC-LEASE-008, TC-LEASE-009, TC-LEASE-013 | Scope, repo key, holder, ref, runner, weight, acquired/heartbeat, TTL, lifecycle, takeover evidence |
| DM-5 Park | TC-PARK-001, TC-PARK-002, TC-PARK-004, TC-PARK-006, TC-PARK-007, TC-PARK-008 | Entry, repo key, a closed cause and a distinct closed condition type with the one-to-one pairing, absolute expiry, resolved recheck, last eval, clear/recovery, release cause, and the durable `clearObservedAt`/`recoveryState` marker (`parked`, `clear-observed`, `recovered`, `released`) |
| DM-6 Incident | TC-LEASE-003, TC-PARK-001, TC-PARK-003 | Type `park-auto-recovery` / `lease-stale-takeover`, bounded typed evidence, entry or repo key, recorded time |
| DM-7 Weight class | TC-WEIGHT-002, TC-SCHED-005 | Closed `standard`/`heavy`; validated plan omitting declaration → `standard`; declared-unrecognized → `heavy`; invalid/unreadable plan → `heavy` with `plan-unreadable`; absent plan → `heavy` with `plan-absent`; never `standard` when the plan cannot be read |
| DM-8 Scheduling rank class | TC-RANK-002 | Closed ordered `merge-ready` < `in-review` < `resume-parked` < `new-start`; derived, never frozen |
| DM-9 Scheduled action | TC-SCHED-004, TC-SCHED-008, TC-DEPEND-003, TC-RANK-005 | Ref, repo, rank, reason, priority, weight, lease status, blocking conditions, preemption block when applicable; `repo-claimed-in-pass` is a per-pass projection reason distinct from `lease-held`; a no-ref claim names the selected action's ref in the envelope (`selectedRef`) |
| DM-10 Preemption block | TC-RANK-003, TC-RANK-004 | Target ref, repo, holder, cause `preempted-for-close-item`, motivating close item |
| DM-11 Lane view | TC-LANES-001, TC-LANES-002, TC-LANES-003 | Ref identity, closed state, bounded reason, lease holder/scope, restarts, amplification (null+warning), weight class |
| DM-12 Repository key and root | TC-LEASE-008, TC-DEPEND-003, TC-DEPEND-004 | Normalized `host/owner/name`; protocol/credentials/userinfo/`.git` removed; contention domain; producer-root discovery uses only entry-recorded roots with exact-key matching, and no match or a two-root collision yields `unknown` (never a substituted invocation root) |
| DM-13 Queue graph document | TC-SCHED-002, TC-SCHED-009, TC-SCHED-012 | Rebuildable derived document; replaced atomically only on intent change; never truth when divergent; reads replace zero |
| DM-14 Finding | TC-PARK-002, TC-PARK-008, TC-SCHED-009 | Stable code + severity + bounded evidence; `queue.park-condition-stuck` is report-only at exit 0 on readable reads and a refusal at exit 1 on a claim, and a stuck park is never a scheduled next action |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR (requirement) | TC ID(s) | Status |
|-------------------|----------|--------|
| NFR-1 Determinism | TC-SCHED-006, TC-SCHED-013, TC-RANK-001 | Covered — 100 identical passes byte-identical; no ambient clock/randomness/locale/env/iteration-order input |
| NFR-2 Read purity | TC-SCHED-012, TC-LANES-006 | Covered — 0 writes, 0 fences, 0 appends, 0 derived replacements on the `queue list`, `queue plan`, `lanes list`, and `lanes show` surfaces |
| NFR-3 Claim atomicity | TC-LEASE-002, TC-LEASE-004 | Covered — 50 scheduled claims from 50 distinct holders → exactly 1 acquire / 0 renewals / 49 `queue.lease-conflict` refusals; 0 duplicate records; 0 unverified landings. The distinct-holder precondition is required because a repeat claim by the winner renews (TC-LEASE-013); NFR-3's unqualified "1 acquires and 49 refuse" is only true for distinct holders (R-07). |
| NFR-4 Lease staleness integrity | TC-LEASE-003 | Covered — 100 % at-or-beyond-TTL leases takeover-eligible; every takeover evidenced; 0 live takeovers |
| NFR-5 Park resume latency | TC-PARK-001, TC-PARK-002, TC-PARK-003, TC-PARK-005 | Covered — when a mutating pass runs within one interval of the clear, resume ≤ one interval after clear; the no-engine gap case recovers with a gap-naming incident and is never stuck solely because the gap exceeded the interval; 0 active-without-recovery-or-stuck once observed clear; a durable `clear-observed` marker without a later `recovered` record is the stuck condition |
| NFR-6 Bounded scheduling cost | TC-SCHED-011, TC-DEPEND-005 | Covered — 32 evaluated candidates, named truncation, memoized bounded reads, ≤ 250 ms structural/perf baseline |
| NFR-7 Hermetic tests | TC-SCHED-014 | Covered — 0 live network, 0 live credentials, 0 real sleeps; injected clock/state/providers/deploy |
| NFR-8 State compatibility | TC-VOCAB-001 | Covered — 0 schema bumps/migrations/backfills; 5 kinds + 1 document; existing stores verified-empty |
| NFR-9 Bounds | TC-SCHED-011, TC-LANES-006 | Covered — every entry/edge/action/lane/finding/reason/byte bound has an explicit truncation marker |
| NFR-10 Configuration-only tuning | TC-LEASE-007, TC-PARK-006, TC-VOCAB-004 | Covered — `queue.lease-ttl` and each `queue.park-recheck.{type}` change behaviour with 0 code changes; invalid values refuse |
| NFR-11 Error-table synchronization | TC-VOCAB-002, TC-VOCAB-003 | Covered — 5 rows and 1 collector id agree in both directions; 0 existing rows change |
| NFR-12 Secret and payload safety | TC-VOCAB-006, TC-PARK-001 | Covered — 0 secret/credential/raw-provider/free-form bytes; redaction chokepoint covers new payloads |
| NFR-13 Fail-closed state reads | TC-LEASE-006, TC-PARK-007, TC-LANES-005, TC-SCHED-005, TC-SCHED-016 | Covered — unreadable/torn/unknown lease or park history yields classified `state.*`, never "free"/"not parked"; claim exits 2 with zero writes; `queue list|plan` exit 2 with bounded evidence and no `data` sibling, partial view, or empty schedule (AC-F10-3) |
| NFR-14 Vocabulary stability | TC-LEASE-009, TC-VOCAB-005, TC-WEIGHT-002, TC-PARK-004 | Covered — closed sets; the park condition-type set `{provider-window, provider-quota, preemption}` and the park cause set `{provider-window, provider-quota, preempted-for-close-item}` are distinct with a one-to-one pairing; no capacity/bandwidth/CI-slot path; only `repo-exclusive` acquired |

## 4. Test Types and Layers

| Level | Scope | Proposed suites / files | Execution |
|---|---|---|---|
| Structure / contract inventory | Closed sets (condition ids/order/tri-state, rank classes, weight classes, park causes/condition types, lane states, record kinds, error rows, config keys), payload schemas, envelope field shapes, store-scoped key prefixes | `tests/structure/queue-scheduling-contract.test.ts`; extend `tests/structure/queue-ready-contract.test.ts` (if present) | `bun test tests/structure` |
| Behaviour — graph and declaration | Entry/add/prioritize/dep, cycle refusal, idempotent replay, superseding entry, unresolved binding, folded graph read | `tests/behaviour/queue-graph.test.ts`; `tests/fixtures/queue/graph/**` | `bun test tests/behaviour/queue-graph.test.ts` |
| Behaviour — readiness | Six-condition derivation, scheduler truth sources, tri-state unknown, plan tier first then triage fallback, evidence vocabulary | `tests/behaviour/queue-readiness.test.ts`; `tests/fixtures/queue/readiness/**`; reuse `tests/fixtures/queue-ready/**` | `bun test tests/behaviour/queue-readiness.test.ts` |
| Behaviour — schedule and precedence | `queue plan`/`queue list`, next actions, reasons, total precedence, priority/tie-break, bounded output, read purity | `tests/behaviour/queue-schedule.test.ts`, `tests/behaviour/queue-precedence.test.ts`; `tests/fixtures/queue/precedence/**`, `tests/fixtures/queue/golden/**` | `bun test tests/behaviour/queue-schedule.test.ts tests/behaviour/queue-precedence.test.ts` |
| Behaviour — leases | Single-flight, claim/release, renewal, stale takeover, conflict evidence, fail-closed state, read-surface fail-closed projection, repo-key normalization, scope | `tests/behaviour/queue-lease.test.ts`, `tests/behaviour/queue-lease-concurrency.test.ts`; `tests/fixtures/queue/leases/**` | `bun test tests/behaviour/queue-lease.test.ts tests/behaviour/queue-lease-concurrency.test.ts` |
| Behaviour — weight | Weight resolution, per-runner heavy cap, standard continuation, weight view, claim precondition | `tests/behaviour/queue-weight.test.ts`; `tests/fixtures/queue/weight/**` | `bun test tests/behaviour/queue-weight.test.ts` |
| Behaviour — dependency and deploy | Dependency-open, producer-first, landing observation, deploy-verified gating, producer-bound expectations, not-declared, read budget | `tests/behaviour/queue-depend.test.ts`; `tests/fixtures/queue/plan/**`, `tests/fixtures/queue/deploy/**` | `bun test tests/behaviour/queue-depend.test.ts` |
| Behaviour — ranking and preemption | Rank classes, close-first, resumable-park, computed preemption, release+park atomicity, outranked claim | `tests/behaviour/queue-rank.test.ts`; `tests/fixtures/queue/rank/**` | `bun test tests/behaviour/queue-rank.test.ts` |
| Behaviour — parks | Condition types, exact resume, incidents, durable `clear-observed` marker, stuck finding, observation gap, recheck config, unreadable parks | `tests/behaviour/queue-park.test.ts`; `tests/fixtures/queue/parks/**` | `bun test tests/behaviour/queue-park.test.ts` |
| Behaviour — lanes | Lane fold, state/reason/holder/restarts/amplification/weight, `show`, `--watch` refusal, unreadable store, purity and bounds | `tests/behaviour/lanes.test.ts`; `tests/fixtures/queue/economics/**`, `tests/fixtures/economics/**` | `bun test tests/behaviour/lanes.test.ts` |
| Behaviour — CLI and envelope | Grammars, exit projection, `result=`/`degraded=`, refusal shapes, `--json` vs text, `fallback.invocation` | `tests/behaviour/queue-cli.test.ts`; `tests/golden/queue-*.test.ts` | `bun test tests/behaviour/queue-cli.test.ts tests/golden` |
| Compatibility | `queue ready` byte-identical machine and human output over the existing corpus | `tests/behaviour/queue-ready-*.test.ts` (extend), `tests/golden/queue-ready.test.ts` (extend) | `bun test tests/behaviour/queue-ready-output.test.ts tests/golden` |
| Checks / invariants | Hermeticity, determinism, bounds, error-table sync, secret-read boundary, vocabulary stability, state compatibility | `tests/checks/queue-hermetic.test.ts`, `tests/checks/queue-bounds.test.ts`; extend `tests/checks/error-table-sync.test.ts`, `tests/checks/secret-read-boundary.test.ts`; `scripts/checks/*.ts` | `bun test tests/checks`; `bun run scripts/checks/error-table-sync.ts` |
| Boundaries | Runtime-API confinement, package/subpath/tier rules, ambient-globals | `.dependency-cruiser.cjs`, `tests/boundaries/**` | `bun test tests/boundaries`; `pnpm check:boundaries` |
| Performance | 500 entries × 1 000 edges plan ≤ 250 ms excluding provider reads; read-budget counts | `tests/behaviour/queue-schedule.test.ts` (perf case), `tests/behaviour/queue-depend.test.ts` (budget case) | `bun test tests/behaviour/queue-schedule.test.ts tests/behaviour/queue-depend.test.ts` |
| Aggregate | Whole workspace | all of the above | `pnpm check` |

All suites use `bun:test` under `tests/**`; fixtures are never named `*.test.ts`. Clock, fence/state transport, provider reads, deploy reads, and economics input are injected. Goldens carry no absolute paths, wall-clock timestamps, or unstable ordering and are regenerated only by an explicit command. No permanent suite asserts a diff against a moving base branch.

**Phase-surface note (R-06).** Behaviour suites assert pure domain/state policy. CLI grammar, envelope shape, `result=`, `selectedRef`, `degraded[]`, and exit projection are asserted in `tests/behaviour/queue-cli.test.ts` and the `tests/golden/queue-*.test.ts` files, which land with the queue command family in plan Phase 7; the lanes command family lands in Phase 6. A TC spanning both halves is marked partial in §5.2 and listed in §7.1.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Impact | Priority | AC |
|---|---|---|---|---|---|---|
| TC-SCHED-001 | Cycle-creating dependency edge refused before append | Negative | Behaviour | Critical | High | AC-F1-1 |
| TC-SCHED-002 | Entry, edge, priority land under the fence; replay is a no-op | Happy Path | Behaviour | Critical | High | AC-F1-1, AC-F10-2 |
| TC-SCHED-003 | Readiness reports exactly six conditions in fixed order | Happy Path | Behaviour | Critical | High | AC-F2-1 |
| TC-SCHED-004 | Scheduler truth for deps, repo-free, and tier | Happy Path | Behaviour | Critical | High | AC-F3-1(a), F-2 |
| TC-SCHED-005 | Failed or invalid sources yield `unknown`, never satisfied | Negative | Behaviour | Critical | High | AC-F2-1, AC-F4-2 |
| TC-SCHED-006 | Declared total precedence order over a generated corpus | Happy Path | Behaviour | Critical | High | AC-F9-1, AC-F7-1 |
| TC-SCHED-007 | Priority only inside a rank class; numeric suffix then ref text | Edge Case | Behaviour | Critical | High | AC-F9-1 |
| TC-SCHED-008 | `queue plan --next n` computes bounded next actions with reasons | Happy Path | Behaviour/CLI | Critical | High | AC-F7-1, AC-F10-1 |
| TC-SCHED-009 | `queue list` renders graph, leases, weights, parks, findings | Happy Path | Behaviour/CLI | Critical | High | AC-F10-1, AC-F10-3 |
| TC-SCHED-010 | One-shot works daemon-down end to end | Integration | Behaviour | Critical | High | AC-F10-1, AC-F10-2 |
| TC-SCHED-011 | Bounds, truncation markers, and bounded scheduling cost | Edge Case | Checks/Perf | Critical | High | NFR-6, NFR-9 |
| TC-SCHED-012 | Read surfaces perform zero writes and zero derived replacements | Regression | Behaviour | Critical | High | NFR-2 |
| TC-SCHED-013 | 100-run determinism and byte-identical ordering | Regression | Behaviour | Critical | High | NFR-1, AC-F9-1, AC-F7-1 |
| TC-SCHED-014 | Hermetic suite guarantees | Regression | Checks | Critical | High | NFR-7 |
| TC-SCHED-015 | Unresolved repository binding is recorded but never ready | Negative | Behaviour | Important | High | AC-F1-1, F-1 |
| TC-SCHED-016 | Envelope, exit projection, refusal, and degraded markers | Happy Path/Negative | Behaviour/Contract | Critical | High | AC-F10-1, AC-F10-3, AC-F11-2, F-10 |
| TC-LEASE-001 | Same-repo single-flight (SC-M1-08) | Happy Path | Behaviour | Critical | High | AC-F3-1(a), AC-F3-1(b) |
| TC-LEASE-002 | Two daemon-down one-shots are mutually exclusive (SC-M1-17b) | Regression | Behaviour/Concurrency | Critical | High | AC-F3-1(b), AC-F4-1, NFR-3 |
| TC-LEASE-003 | Stale takeover with evidence; live lease never taken over | Edge Case | Behaviour | Critical | High | AC-F4-1, NFR-4 |
| TC-LEASE-004 | Post-append verification and duplicate-acquisition refusal | Negative | Behaviour | Critical | High | AC-F4-1, NFR-3 |
| TC-LEASE-005 | Conflict refusal names holder, lease, heartbeat, takeover time | Negative | Behaviour/CLI | Critical | High | AC-F4-1 |
| TC-LEASE-006 | Unreadable/torn lease history fails closed at exit 2 | Negative | Behaviour | Critical | High | AC-F4-2, AC-F10-3, NFR-13 |
| TC-LEASE-007 | `queue.lease-ttl` is configuration-only tuning | Happy Path | Behaviour/Config | Critical | High | NFR-10 |
| TC-LEASE-008 | Repository key normalization defines the contention domain | Happy Path | Unit | Critical | High | F-3, DM-12 |
| TC-LEASE-009 | Scope is `repo-exclusive`; no capacity or CI-slot cap exists | Regression | Structure/Checks | Critical | High | AC-F3-2, NFR-14 |
| TC-LEASE-010 | Release is an explicit idempotent no-op when no lease exists | Edge Case | Behaviour | Important | High | AC-F10-2, F-4 |
| TC-LEASE-011 | Release another holder refuses; release+park lands atomically | Negative | Behaviour | Critical | High | AC-F7-2, F-4 |
| TC-LEASE-012 | Claim precondition unmet names the reason | Negative | Behaviour | Important | High | F-4, Appendix F |
| TC-LEASE-013 | Claim of one's own lease renews the heartbeat, not the holder | Happy Path | Behaviour | Important | High | F-4, DM-4 |
| TC-WEIGHT-001 | Heavy build is not co-scheduled (SC-M1-09) | Happy Path | Behaviour | Critical | High | AC-F5-1 |
| TC-WEIGHT-002 | Weight resolution: validated absent → standard; unrecognized or unreadable/absent plan → heavy | Edge Case | Behaviour | Critical | High | AC-F5-2, AC-F5-1, DEC-10 |
| TC-WEIGHT-003 | Weight is a per-runner resource class, not a lane cap | Happy Path | Behaviour | Critical | High | AC-F5-1 |
| TC-WEIGHT-004 | Heavy claim under an active heavy lease refuses; standard continues | Negative | Behaviour | Critical | High | AC-F5-1 |
| TC-DEPEND-001 | Consumer held `dependency-open` while producer unresolved | Happy Path | Behaviour | Critical | High | AC-F6-1 |
| TC-DEPEND-002 | Producer precedes consumer in one repository, regardless of priority | Happy Path | Behaviour | Critical | High | AC-F6-1 |
| TC-DEPEND-003 | Deploy-verified gate before a dependent merge | Happy Path | Behaviour | Critical | High | AC-F6-1, AC-F6-2 |
| TC-DEPEND-004 | No declared deploy expectation: landing-only with `deploy: not-declared` | Edge Case | Behaviour | Critical | High | AC-F6-1, AC-F6-2 |
| TC-DEPEND-005 | Deploy reads are bounded and memoized; overflow holds `deploy-unverified` | Edge Case | Behaviour | Critical | High | AC-F6-1, NFR-6 |
| TC-DEPEND-006 | Producer landing is observed; unlanded producer holds the consumer | Negative | Behaviour | Important | High | AC-F6-1 |
| TC-RANK-001 | Close-first ranking is deterministic (SC-M1-10) | Happy Path | Behaviour | Critical | High | AC-F7-1 |
| TC-RANK-002 | Rank classes are closed, ordered, and derived per pass | Happy Path | Behaviour/Structure | Critical | High | AC-F9-1, F-7 |
| TC-RANK-003 | Pass emits a preemption action under `preempted-for-close-item` | Happy Path | Behaviour | Critical | High | AC-F7-2 |
| TC-RANK-004 | Preemption release and park land in one fenced transaction | Happy Path | Behaviour | Critical | High | AC-F7-2 |
| TC-RANK-005 | Claiming an outranked entry refuses; no-ref claim selects deterministically | Negative | Behaviour | Important | High | F-4, F-9, AC-F4-3 |
| TC-RANK-006 | A hard gate removes a close item; ordering never admits past it | Negative | Behaviour | Critical | High | AC-F9-1, F-9 |
| TC-PARK-001 | Park resumes exactly on condition clear with an incident (SC-M1-11) | Happy Path | Behaviour | Critical | High | AC-F8-1, NFR-5 |
| TC-PARK-002 | A park observed clear but still active is the stuck finding | Negative | Behaviour | Critical | High | AC-F8-1, AC-F10-3 |
| TC-PARK-003 | Observation gap recovers with a gap-naming incident, never stuck | Edge Case | Behaviour | Critical | High | AC-F8-1 |
| TC-PARK-004 | Closed condition types and one active park per entry | Happy Path | Behaviour/Structure | Critical | High | F-8, DM-5 |
| TC-PARK-005 | Resume latency bound and no active-without-recovery park | Regression | Behaviour | Critical | High | AC-F8-1, NFR-5 |
| TC-PARK-006 | `queue.park-recheck.{type}` is configuration-only tuning | Happy Path | Behaviour/Config | Critical | High | AC-F8-2, NFR-10 |
| TC-PARK-007 | Unreadable park history is never "not parked" | Negative | Behaviour | Critical | High | NFR-13, AC-F10-3, F-8 |
| TC-PARK-008 | A stuck park is never a next action; claim refuses with zero appends | Negative | Behaviour | Critical | High | AC-F8-1, F-7, F-8, DM-14 |
| TC-LANES-001 | `lanes list` reports the full lane contract with no fabricated values | Happy Path | Behaviour/CLI | Critical | High | AC-F11-1 |
| TC-LANES-002 | `lanes show` returns one lane; an unobserved ref is classified | Happy Path/Negative | Behaviour/CLI | Important | High | AC-F11-1, Appendix F |
| TC-LANES-003 | Restarts and amplification come from the economics fold | Edge Case | Behaviour | Critical | High | AC-F11-1, F-11 |
| TC-LANES-004 | `--watch` is refused through `fallback.invocation` | Negative | Behaviour/CLI | Critical | High | AC-F11-2 |
| TC-LANES-005 | Unreadable store returns `status.collector.lanes.unavailable` at exit 2 | Negative | Behaviour/CLI | Critical | High | AC-F11-2, NFR-13 |
| TC-LANES-006 | Lanes reads are pure, bounded, and truthfully degraded/empty | Regression | Behaviour/Checks | Critical | High | NFR-2, NFR-9, AC-F11-1 |
| TC-VOCAB-001 | Five additive record kinds and one derived document | Contract | Structure/Behaviour | Critical | High | AC-F12-1, NFR-8 |
| TC-VOCAB-002 | Five `queue` error rows synchronized in both directions | Regression | Checks | Critical | High | AC-F12-1, NFR-11 |
| TC-VOCAB-003 | Collector-id set extends to `{tracker, lanes}` | Contract | Structure/Checks | Critical | High | AC-F12-1, AC-F11-2 |
| TC-VOCAB-004 | Typed `queue` configuration branch and defaults | Happy Path | Structure/Behaviour | Critical | High | AC-F3-2, AC-F8-2, NFR-10 |
| TC-VOCAB-005 | Vocabulary sets are closed and stable | Regression | Structure/Checks | Critical | High | NFR-14 |
| TC-VOCAB-006 | Secret and payload safety across envelopes, records, findings, incidents | Negative | Checks | Critical | High | NFR-12 |
| TC-COMPAT-001 | `queue ready` output and contract are byte-identical | Regression | Behaviour/Golden | Critical | High | AC-F12-1 |

### 5.2 Scenario Details

#### TC-SCHED-001 - Cycle-creating dependency edge refused before append

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-2, DM-13, EVT-2, NFR-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-graph.test.ts`, `tests/fixtures/queue/graph/cycle/**`
**Tags**: @backend, @queue, @negative

**Preconditions**:
- A temporary state store opened through `tests/fixtures/state/harness.ts` with a mutable injected clock.
- Seeded graph: GH-302 declares `dep GH-301`; GH-301 is not yet an entry.
- `queue add GH-301 --priority 5 --dep GH-300` has not run.

**Steps**:
1. Before GH-301 is declared, fold the graph; assert the seeded GH-302→GH-301 edge is retained even though GH-301 has no queue entry, and readiness for GH-302 reports `deps-satisfied` `unknown` with `dependency-unobserved` — never `satisfied` and never silently dropped.
2. Run `queue add GH-301 --priority 5 --dep GH-300`; assert the entry (with its repository key and recorded root) and the GH-301→GH-300 edge append under one fence.
3. Run `queue dep GH-301 GH-302` (which would create GH-301→GH-302→GH-301); assert the command exits 1 with `queue.dependency-cycle`, consequence `not_landed`, and the existing path token sequence `GH-301 -> GH-302 -> GH-301`.
4. Assert the ledger record count and sequence are byte-unchanged by the refused call (no append, no derived-document replacement).
5. Replay the identical refused call; assert the same refusal and still zero new records.

**Expected Outcome**:
- A seeded edge to a not-yet-declared producer is retained and evaluates `dependency-unobserved`; the successful entry and edge are durable and fenced; the cycle-creating edge lands nothing, names the existing path, and leaves the folded graph unchanged. Re-running a refused mutation is stable.

#### TC-SCHED-002 - Entry, edge, priority land under the fence; replay is a no-op

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F10-2, DM-1, DM-13, EVT-1, EVT-2, NFR-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-graph.test.ts`, `tests/behaviour/queue-cli.test.ts`, `tests/fixtures/queue/graph/**`
**Tags**: @backend, @queue, @state

**Preconditions**:
- No queue state; one repository binding resolving to `github.com/owner/repo-alpha`.
- A recording state store exposes appended kind, record key, payload schema, and sequence.

**Steps**:
1. Run `queue add GH-300 --priority 10`; assert one `queue.entry` append with schema `delivery.queue.entry.v1` and key `queue.entries:GH-300`, carrying ref, repo key, and priority 10.
2. Run `queue add GH-301 --priority 5 --dep GH-300`; assert one entry append and one `queue.dependency` append with schema `delivery.queue.dependency.v1` and key `queue.deps:GH-301`, carrying the GH-300 edge.
3. Run `queue prioritize GH-301 2`; assert one new `queue.entry` append and that the latest projection wins (priority 2), with no schema bump.
4. Replay steps 1–3 identically; assert zero new appends in each case and `result=noop` in the envelope where defined.
5. Run `queue add GH-301 --priority 1` as a superseding entry; assert the latest projection replaces the prior entry projection for GH-301 by identity and no duplicate entry line appears in `queue list`.
6. Assert the derived queue graph document is replaced atomically only when intent truth changed and is byte-identical to a rebuild from the ledger.

**Expected Outcome**:
- Intent is one durable, fenced graph; identical replays are no-ops; a superseding entry replaces its projection by identity; the derived document is a cache that never contradicts the ledger.

#### TC-SCHED-003 - Readiness reports exactly six conditions in fixed order

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-3, NFR-1, NFR-13
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-readiness.test.ts`, `tests/fixtures/queue/readiness/**`
**Tags**: @backend, @readiness

**Preconditions**:
- A queued entry has one open `blocked-by` dependency, one owner-attention label (`hand-back`), and an unreadable CI source.
- Injected facts provide a known plan tier, no provider park, and a clean binding.

**Steps**:
1. Evaluate readiness; assert `conditions` has exactly six entries in the fixed order `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available`.
2. Assert every condition state is one of `satisfied`, `unsatisfied`, `unknown`; assert no fourth state and no boolean.
3. Assert `deps-satisfied` is `unsatisfied` with the open dependency named in bounded evidence; `no-owner-gate` is `unsatisfied` with `hand-back` named.
4. Assert `ci-healthy` is `unknown` with the declared CI unknown reason and no `satisfied`.
5. Assert `blockingConditions` contains every non-satisfied condition exactly once; assert `ready` is `false`.
6. Assert there is no `0` or invented count in any evidence field, and no condition derives `satisfied` from a zero-length/failed read.

**Expected Outcome**:
- Readiness is the delivered six-condition contract with a closed tri-state: every non-satisfied condition is named, the entry is not ready, and failure is `unknown`, never green.

#### TC-SCHED-004 - Scheduler truth for deps, repo-free, and tier

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F3-1(a), AC-F2-1, DM-3, DM-4, DM-12, NFR-13, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-readiness.test.ts`, `tests/fixtures/queue/readiness/sources/**`
**Tags**: @backend, @readiness, @leases

**Phase-surface split**: Partial — readiness/read-projection rows land in Phase 3; `queue plan`/`queue list` grammar, envelope, and reason projection complete in Phase 7.

**Preconditions**:
- Cases cover: tracker relation only, declared edge only, both satisfied, either open, a declared edge stricter than tracker, and a declared edge to a ref with no queue entry (`unknown`/`dependency-unobserved`).
- Two ready entries target repo-alpha: a first case has no lease held; a paired case has a live lease held by `holder-a` with lease identity `lease-7`.
- One case has a validated plan tier `lite`; a paired case has no plan but a triage label `priority:high`.

**Steps**:
1. For each deps case, evaluate readiness and assert `deps-satisfied` reflects the union of normalized tracker `blocked-by` relations and declared edges, and the declared edge can only make it stricter, never looser.
2. With the live lease, assert `repo-free` is `unsatisfied` and its evidence names the holder `holder-a` and lease identity `lease-7`.
3. With no lease, assert `repo-free` is `satisfied` with no fabricated holder.
4. For `tier-known`, assert the validated plan tier wins when a plan exists; assert the triage label is used only when no plan artifact exists.
5. Assert condition ids, order, tri-state, and evidence vocabulary are identical to the delivered set (`QUEUE_READY_CONDITION_ORDER`, `QUEUE_READY_CONDITION_STATES`, `QUEUE_READY_EVIDENCE_REASONS`).
6. Run `queue plan`/`queue list` over the same state; with no lease held, assert the read-only projection shows exactly one eligible action for repo-alpha and holds the other ready entry `repo-claimed-in-pass` (a per-pass projection reason distinct from `lease-held`); once the live lease exists, assert the other entry names `lease-held` with holder and lease evidence; assert zero appends and zero fences in both cases (AC-F3-1(a)).
7. For the declared edge whose producer ref has no queue entry, assert the edge is retained in the fold and `deps-satisfied` is `unknown` with `dependency-unobserved`, never `satisfied` and never silently dropped.

**Expected Outcome**:
- The scheduler strengthens only the three sources it owns, reuses the delivered vocabulary verbatim, and never redefines readiness.

#### TC-SCHED-005 - Failed or invalid sources yield `unknown`, never satisfied

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F4-2, NFR-13, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-readiness.test.ts`, `tests/fixtures/queue/readiness/failures/**`
**Tags**: @backend, @readiness, @negative

**Preconditions**:
- One case each: tracker read failed, CI read not attempted, provider fact unavailable, repository binding unresolved, plan invalid, plan missing, and deploy read unreadable.
- A control case has every source healthy.

**Steps**:
1. For each failed/unattempted/unavailable/unresolved source, assert the affected condition is `unknown` with the declared reason (`read-failed`, `signal-unavailable`, `work-item-unobserved`, `addressing-unresolved`, `remote-unsupported`, or the delivered equivalent).
2. Assert no failed source maps to `satisfied`, and no value is coerced to zero or an empty set.
3. For an invalid plan, assert `tier-known` is `unknown` with the delivered `plan.*` identity and no tier is invented; for a missing plan, assert the triage fallback is used and marked as the weaker source.
4. Assert the entry is not ready and the condition appears in `blockingConditions`.
5. Assert the clean control is ready.

**Expected Outcome**:
- Every source failure is evidence, not success; an invalid or missing plan never invents a tier; fail-closed applies to readiness exactly as it does to claims.

#### TC-SCHED-006 - Declared total precedence order over a generated corpus

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, AC-F7-1, NFR-1, NFR-7, Appendix B
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-precedence.test.ts`, `tests/fixtures/queue/precedence/corpus/**`
**Tags**: @backend, @precedence, @determinism

**Preconditions**:
- A generated corpus mixes every hard gate (readiness, dependency/deploy, park, single-flight, weight), both weight classes, three park types, both dependency roles, merge-ready/in-review/resume-parked/new-start classes, and explicit priorities including ties.
- The same corpus is emitted in multiple shuffled input orders from a fixed seed.

**Steps**:
1. Compute the schedule for each input order; assert the ordered action list is identical across all orders.
2. Assert hard exclusions (steps 1–9 of Appendix B) remove candidates before any ordering rule and never merely reorder them.
3. Assert rank class (merge-ready < in-review < resume-parked < new-start) is applied before producer-before-consumer.
4. Assert producer-before-consumer applies only among entries contending for one repository.
5. Assert explicit priority ascending applies only inside one rank class.
6. Assert numeric ref suffix then canonical ref text resolve the final ties.
7. Assert each action carries a bounded reason from the declared vocabulary.

**Expected Outcome**:
- One declared total order produces one deterministic result independent of input order; hard exclusions and ordering never trade places.

#### TC-SCHED-007 - Priority only inside a rank class; numeric suffix then ref text

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DM-1, DM-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-precedence.test.ts`, `tests/fixtures/queue/precedence/ties/**`
**Tags**: @backend, @precedence

**Preconditions**:
- Fixtures declare: same rank class with priorities 1/5/5, a defaulted priority, refs `GH-10`, `GH-9`, `GH-010`, and `AB-2` versus `GH-2`.

**Steps**:
1. Assert lower priority is earlier inside one class and that an undeclared priority uses the declared default.
2. Assert priority cannot lift a `new-start` above a `merge-ready` entry.
3. Assert equal priorities break by numeric ref suffix ascending, then by canonical ref text.
4. Assert `GH-010` and `GH-10` are canonicalized before comparison and do not create a duplicate identity.
5. Assert changing only a priority reorders entries only inside the same class.

**Expected Outcome**:
- Priority is a bounded in-class tie-break with deterministic suffix/text fallbacks; it never overrides the rank class or a gate.

#### TC-SCHED-008 - `queue plan --next n` computes bounded next actions with reasons

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-7, AC-F7-1, AC-F10-1, DM-9, EVT-6, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-schedule.test.ts`, `tests/golden/queue-plan.test.ts`, `tests/fixtures/queue/golden/**`
**Tags**: @backend, @queue, @api

**Preconditions**:
- A queue with one merge-ready, one in-review, one resume-parked, and several new starts; one competing repository is lease-held.
- The injected provider clock is `2026-11-07T10:00:00Z`; no daemon is reachable.

**Steps**:
1. Run `queue plan --next 2`; assert `data.nextActions` has at most 2 items in precedence order.
2. Assert each action carries `ref`, `repository`, `rankClass`, `reason`, `priority`, `weightClass`, `lease`, and `blocking[]`.
3. Assert `data` also carries `entries[]`, `leases[]`, `weights`, `parks[]`, `findings[]`, `degraded[]`, and `truncated`.
4. Assert `degraded` contains `daemon-unreachable` and the command exits 0.
5. Assert default `--next` is 3 and a request above 20 clamps to 20 with an explicit truncation marker.
6. Assert two identical runs produce byte-identical `data`.

**Expected Outcome**:
- The plan is a bounded, deterministic, reasoned action list computed from state with truthful daemon-down degradation and an explicit truncation marker.

#### TC-SCHED-009 - `queue list` renders graph, leases, weights, parks, findings

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-11, AC-F10-1, AC-F10-3, DM-13, DM-14, EVT-6, NFR-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-schedule.test.ts`, `tests/golden/queue-list.test.ts`
**Tags**: @backend, @queue, @api

**Preconditions**:
- Seeded state: two entries, one edge, one live lease, one heavy weight load, one active park, one stuck-park finding, and no daemon.
- A paired empty-queue case.

**Steps**:
1. Run `queue list`; assert `entries[]` shows each ref with repository, state, rankClass, priority, weightClass, deps[], and blocking[].
2. Assert `leases[]` shows repository, holder, scope, ref, runner, weightClass, heartbeatAgeMs, and takeover evidence where applicable.
3. Assert `weights`, `parks[]`, `findings[]`, `degraded[]`, and `truncated` are present with bounded values.
4. Assert the stuck-park finding appears as a report-only finding, not an error, and the command exits 0.
5. For the empty queue, assert an explicit observed-empty view with counts and `degraded` present, never a fabricated lane/entry.
6. Assert `queue list` performs zero writes, fences, appends, and derived replacements.
7. Assert the paired unreadable/torn lease or park history makes `queue list` exit 2 with the classified `state.*` identity, bounded evidence, and no `data` sibling or empty/partial schedule (AC-F10-3), distinct from the readable report-only stuck-park finding at exit 0.

**Expected Outcome**:
- `queue list` is a truthful, bounded, read-only projection of graph, leases, weights, parks, and findings; absence is explicit, never silent.

#### TC-SCHED-010 - One-shot works daemon-down end to end

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-4, AC-F10-1, AC-F10-2, NFR-2, SC-M1-17
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/e2e/**`
**Tags**: @backend, @daemon-free, @integration

**Phase-surface split**: Partial — the plan→claim→release domain path lands in Phase 4; the CLI e2e rows complete in Phase 7.

**Preconditions**:
- No daemon process, no socket, no background task; a throwing-fetch guard is installed.
- One ready entry on repo-alpha; no lease held; a temp state store with a mutable clock.

**Steps**:
1. Run `queue plan --next 1`; assert exit 0, one `nextActions` item, and `degraded` contains `daemon-unreachable`.
2. Run `queue claim GH-320 --holder one-shot-1`; assert `result=claimed`, one `queue.lease` record with heartbeat, and `degraded` still present.
3. Assert no socket is opened, no child process is spawned, and no daemon notification is claimed in the envelope.
4. Run `queue release GH-320 --holder one-shot-1`; assert `result=released` and one release record.
5. Re-open the store with a fresh read; assert the ledger is consistent (latest lease lifecycle = released) and ready for a later daemon reconciliation.

**Expected Outcome**:
- The full planning/claim/release loop works with no daemon, no socket, and no background process, and leaves durable state a later daemon can reconcile.

#### TC-SCHED-011 - Bounds, truncation markers, and bounded scheduling cost

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, NFR-9, F-2, RSK-4
**Test Type(s)**: Unit, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/queue-bounds.test.ts`, `tests/behaviour/queue-schedule.test.ts`, `tests/fixtures/queue/bounds/**`
**Tags**: @backend, @perf, @bounds

**Preconditions**:
- A corpus of 500 entries and 1 000 edges, plus boundary cases at each declared cap.
- Injected provider/deploy read counters.

**Steps**:
1. Assert entries per folded read ≤ 500, edges per entry ≤ 32, next actions ≤ 20 (default 3), lanes ≤ 200, findings ≤ 20, reasons ≤ 8, serialized `data` ≤ 65 536 UTF-8 bytes, human output ≤ 40 lines and 8 192 UTF-8 bytes.
2. For each exceeded bound, assert an explicit truncation marker with a named reason, never a silent cut.
3. Assert readiness reads are performed for at most the first 32 ordered candidates and the remainder is marked truncated with a reason.
4. Assert at most 1 tracker page, 1 pull-request page per evaluated repository, 1 check-runs page per evaluated candidate, and 3 deploy verdict reads per pass, each memoized within the pass.
5. Measure the 500-entry/1 000-edge plan excluding provider reads; assert ≤ 250 ms on the reference CI class with a recorded baseline, and assert no I/O occurs during evaluation.

**Expected Outcome**:
- Every payload is finite and explicitly truncated, read cost is bounded and memoized, and the large-queue plan meets the reference bound.

#### TC-SCHED-012 - Read surfaces perform zero writes and zero derived replacements

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, F-10, F-11, DM-13
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-schedule.test.ts`, `tests/behaviour/lanes.test.ts`
**Tags**: @backend, @readonly, @state

**Phase-surface split**: Partial — queue read-purity rows land in Phase 3 and lanes read-purity in Phase 6; command-level zero-write rows complete in Phase 7 (queue) and Phase 6 (lanes).

**Preconditions**:
- A recording state store counts `append`, `replaceDocument`, `acquireFence`, and `releaseFence` calls.
- Seeded entries, leases, parks, and findings.

**Steps**:
1. Run `queue list`, `queue plan`, `lanes list`, and `lanes show GH-320` against the recording store.
2. Assert `append`, `replaceDocument`, `acquireFence`, and `releaseFence` were each called zero times.
3. Assert a park whose condition is clear is reported as resumable/clear evidence but is not recovered by the read (no incident append).
4. Assert the derived queue-graph document on disk is byte-unchanged.
5. Repeat each read twice; assert identical payloads and still zero writes.

**Expected Outcome**:
- Read surfaces are pure: they observe and report, never mutate, and a read-time park evaluation never performs recovery.

#### TC-SCHED-013 - 100-run determinism and byte-identical ordering

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, AC-F9-1, AC-F7-1, EVT-6
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-precedence.test.ts`, `tests/checks/queue-hermetic.test.ts`
**Tags**: @backend, @determinism

**Preconditions**:
- A fixed corpus with every gate, class, and tie-break represented.
- Injected clock fixed at one instant; locale, timezone, and environment varied between runs; insertion order varied.

**Steps**:
1. Compute the schedule 100 times over the identical state and injected dependencies; assert all 100 machine payloads are byte-identical.
2. Assert all 100 human renderings are byte-identical.
3. Vary the ambient locale/timezone and object insertion order between runs; assert the output is unchanged.
4. Assert no ambient clock, randomness, environment read, or iteration-order dependence is reachable from the scheduling path (structure + ambient-globals check).

**Expected Outcome**:
- Scheduling is a pure function of injected state and clock; repeated identical passes are byte-identical and ambient context cannot change the result.

#### TC-SCHED-014 - Hermetic suite guarantees

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, NFR-2, RSK-1
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/queue-hermetic.test.ts`
**Tags**: @checks, @hermetic

**Preconditions**:
- A throwing `globalThis.fetch` guard and a detecting credential-port spy.
- A fake sleep/clock seam that records any real timer use.

**Steps**:
1. Run the queue/lanes suites with the fetch guard armed; assert zero fetch calls and zero socket opens.
2. Assert zero live credential reads; all credential-dependent facts come from fixtures.
3. Assert zero real sleeps or timers; the clock advances only through the injected seam.
4. Assert provider and deploy reads are served only by injected fakes; a missing fixture fails the test naming the missing fixture.
5. Assert the scheduling domain imports no runtime API outside the declared allowed locations (boundary check).

**Expected Outcome**:
- The entire battery is hermetic: no live network, no live credentials, no real sleeps, and a missing seam fails loudly instead of silently skipping.

#### TC-SCHED-015 - Unresolved repository binding is recorded but never ready

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-graph.test.ts`, `tests/fixtures/queue/graph/binding/**`
**Tags**: @backend, @queue, @binding

**Preconditions**:
- One case with an unsupported remote (e.g. an `ssh://` host outside the supported set); one with no resolvable remote.
- A control case with a valid `github.com` remote.

**Steps**:
1. Run `queue add GH-320`; assert the entry is recorded with no repository key and `addressing-unresolved` or `remote-unsupported` as bounded evidence.
2. Assert the entry is never ready and `repo-free` cannot be `satisfied` from an absent key.
3. Assert `queue list` shows the entry with its missing repository key explicit, not an invented key.
4. Assert the control entry resolves `host/owner/name` and can be ready.

**Expected Outcome**:
- An unresolved binding is recorded honestly with delivered bundle reasons; the engine never assumes a repository and never marks such an entry ready.

#### TC-SCHED-016 - Envelope, exit projection, refusal, and degraded markers

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, AC-F10-3, AC-F11-2, Appendix C, RSK-7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-cli.test.ts`, `tests/golden/queue-envelope.test.ts`
**Tags**: @backend, @api, @envelope

**Preconditions**:
- One success case, one user refusal (cycle), one transient refusal (lease conflict), one platform/unverified case (unreadable state), and one invocation rejection (`--watch`).
- The delivered `CommandResult` envelope and projection are available.

**Steps**:
1. For each success, assert exit 0, `result=` text before human detail where defined, and `degraded[]` present.
2. For each refusal, assert exit 1, `result=refused`, the classified error with `category`, `retryable`, `consequence`, and `remediationHint`; assert `fallback.internal` containment for an unclassified failure.
3. For the unreadable-state case, assert exit 2, a classified `state.*` (or `status.collector.*` on the lanes surface) identity with bounded evidence, and no `data` sibling, partial view, or empty view presented as a schedule (AC-F10-3).
4. For the invocation rejection, assert exit 1, `fallback.invocation`, and a remediation hint naming the resident-daemon story.
5. Assert `--json` emits a parseable envelope with `schemaVersion`, and no secret or raw provider body appears.

**Expected Outcome**:
- Every outcome projects through the delivered `{0, 1, 2}` taxonomy with the correct refusal shape, no silent success, and truthful degradation.

#### TC-LEASE-001 - Same-repo single-flight (SC-M1-08)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-2, AC-F3-1(a), AC-F3-1(b), DM-4, DM-12, NFR-3, SC-M1-08
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/leases/single-flight/**`
**Tags**: @backend, @leases, @single-flight

**Phase-surface split**: Partial — single-flight state rows land in Phase 4; `queue plan`/`queue list`/`queue claim` envelope and exit rows complete in Phase 7.

**Preconditions**:
- Two ready entries GH-320 and GH-321 both target `github.com/owner/repo-alpha`; no lease held.
- One ready entry GH-322 targets `github.com/owner/repo-beta`.
- The injected clock is fixed; provider facts are all available.

**Steps**:
1. With no lease held, run `queue plan`/`queue list`; assert exactly one of GH-320/GH-321 is the repo-alpha eligible action, the other is held `repo-claimed-in-pass` (a per-pass projection reason, not `lease-held`), and the read surface itself claims or holds no lease (zero appends, zero fences) — the AC-F3-1(a) read-only projection.
2. Claim GH-320; assert exactly one `repo-exclusive` lease record for repo-alpha naming holder and lease identity.
3. Compute the schedule again; assert GH-321 is held with `lease-held`, its `repo-free` evidence names GH-320's holder and lease identity, and its `blockingConditions` includes `repo-free`.
4. Claim GH-321 from a second holder; assert exit 1 with `queue.lease-conflict`, consequence `not_landed`, naming GH-320's holder and lease identity, and assert exactly one holder remains for repo-alpha (AC-F3-1(b)); then assert GH-322 on repo-beta remains eligible and is not blocked by the repo-alpha lease.
5. Run a second claim for GH-322; assert a distinct lease for repo-beta exists concurrently.

**Expected Outcome**:
- Exactly one active lease exists per repository key; the waiting entry names the holder and lease identity; different repositories never contend, so single-flight does not reduce the number of active repositories.

#### TC-LEASE-002 - Two daemon-down one-shots are mutually exclusive (SC-M1-17b)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-4, EVT-3, NFR-3, RSK-1, SC-M1-17b
**Test Type(s)**: Integration, Concurrency
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease-concurrency.test.ts`, `tests/fixtures/queue/leases/fence-harness.ts`
**Tags**: @backend, @leases, @concurrency

**Phase-surface split**: Partial — concurrency state rows land in Phase 4; `result=` and exit-projection rows complete in Phase 7.

**Preconditions**:
- A deterministic fence harness implements the delivered `StateStorePort` with: a mutable injected clock, a single-writer fence token, an operation log, and a barrier hook at the pre-fence readiness read.
- No lease held for repo-alpha; 50 claim attempts for GH-320, each from a **distinct holder** (`holder-01` … `holder-50`), so no holder repeats and no attempt is a same-holder renewal.
- No real timer, worker thread, or OS race is used.

**Steps**:
1. Arm the barrier so all 50 claim attempts observe "no lease" during the pre-fence readiness read.
2. Release the barrier; drain the single-writer fence in a fixed declared order.
3. Assert exactly 1 claim returns `result=claimed`, exactly 0 return `result=renewed`, and the remaining 49 return `queue.lease-conflict` at exit 1 with consequence `not_landed`.
4. Assert exactly one `queue.lease` acquisition record exists for repo-alpha, with a recorded heartbeat, and zero duplicate records for one `(repository, holder, acquisition)`.
5. Assert the operation log proves every attempt performed its authoritative lease read *inside* the fence before appending.
6. Assert every claimed outcome has a post-append verification read of exactly one new record.
7. Run a second scenario with a state transport that refuses the append for one contender; assert it refuses with a classified `state.*` and does not retry into a duplicate.
8. Run a paired control with a single repeating holder; assert the repeat claim is `result=renewed` and is never counted as a conflict (TC-LEASE-013), proving why the distinct-holder fixture above is required.

**Expected Outcome**:
- Under a forced "all saw free" interleaving, the in-fence re-read plus single-writer serialization yields exactly one lease and 49 evidenced refusals, with zero renewals because no holder repeats; no duplicate record and no unverified landing exists. NFR-3's "1 acquires and 49 refuse" is thereby scoped to distinct holders.

#### TC-LEASE-003 - Stale takeover with evidence; live lease never taken over

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-4, DM-6, EVT-3, EVT-5, NFR-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/leases/staleness/**`
**Tags**: @backend, @leases, @takeover

**Preconditions**:
- `queue.lease-ttl` is 90 000 ms; the injected clock is fixed.
- Cases: heartbeat age 89 999 ms (live), 90 000 ms (at-bound), 120 000 ms (stale), and a fresh lease with a renewed heartbeat.

**Steps**:
1. Claim against the live lease; assert `queue.lease-conflict` and no takeover.
2. Claim against the at-bound lease; assert it is takeover-eligible and the claim appends a `taken-over` acquisition.
3. Claim against the stale lease; assert the new acquisition names the previous holder, previous lease identity, heartbeat age, and last heartbeat time, and appends one `queue.incident` of type `lease-stale-takeover`.
4. Assert a `renewed` heartbeat inside the TTL keeps the lease live and is never taken over.
5. Assert 100 % of fixtures at or beyond the TTL are takeover-eligible and 0 % below it are.

**Expected Outcome**:
- Staleness is stated at-bound; every takeover is evidenced and recorded as an incident; a live lease is never displaced.

#### TC-LEASE-004 - Post-append verification and duplicate-acquisition refusal

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, EVT-3, NFR-3, RSK-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/leases/verification/**`
**Tags**: @backend, @leases, @state

**Phase-surface split**: Partial — store/verification state rows land in Phase 4; the `result=claimed` projection row completes in Phase 7.

**Preconditions**:
- A recording store can return 0, 1, or 2 new records after an append.
- A store can append a duplicate acquisition for the same holder/acquisition id.

**Steps**:
1. With a normal store, assert every claim performs a post-append verification of exactly one new lease record of the expected kind under the repository key.
2. With a store returning 0 new records, assert the claim refuses with a classified `state.*` and does not report success.
3. With a store returning 2 new records, assert the claim refuses with a classified `state.*` and names the ambiguity.
4. With a duplicate acquisition for one holder, assert the projection classifies `state.*` and never serves a fabricated lease.
5. Assert no partial or unverified claim is projected as `result=claimed`.

**Expected Outcome**:
- A claim is successful only when the post-append verification proves exactly one new record; ambiguity and duplication fail closed.

#### TC-LEASE-005 - Conflict refusal names holder, lease, heartbeat, takeover time

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, Appendix C, Appendix F
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/golden/queue-lease-conflict.test.ts`
**Tags**: @backend, @leases, @refusal

**Phase-surface split**: Partial — conflict identity/evidence rows land in Phase 4; golden and text-mode `result=refused`/exit rows complete in Phase 7.

**Preconditions**:
- A live lease held by `holder-a` for repo-alpha with a known acquisition time and heartbeat age.
- The injected clock is fixed.

**Steps**:
1. Run `queue claim GH-320 --holder holder-b`; assert exit 1, `queue.lease-conflict`, category `transient`, `retryable: true`, consequence `not_landed`; assert the identity is never `queue.precondition.unmet`, because `repo-free` is excluded from the pre-fence gate and the in-fence lease read owns repository exclusivity (spec v1.2 F-4/C-2).
2. Assert the error/evidence names the holder `holder-a`, the lease identity, the acquisition time, the heartbeat age, and the earliest takeover-eligible time.
3. Assert text mode prints `result=refused` before the classified refusal and a remediation hint.
4. Assert no lease record or derived-document change occurred.
5. Re-run with the same holder (`holder-a`); assert it does not conflict but renews (see TC-LEASE-013).

**Expected Outcome**:
- A conflicting claim is a clean negative verdict with complete holder and timing evidence; it never lands and never omits the identity.

#### TC-LEASE-006 - Unreadable/torn lease history fails closed at exit 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F10-3, NFR-13, RSK-1, SC-M1-17b
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/leases/torn/**`
**Tags**: @backend, @leases, @fail-closed

**Phase-surface split**: Partial — claim `state.*` rows land in Phase 4; `queue list`/`queue plan` exit-2 rows complete in Phase 7.

**Preconditions**:
- A temp store with a torn ledger tail, an unreadable key, and an unknown record kind under `queue.leases:{repoKey}`.
- A control store with a healthy lease history.

**Steps**:
1. For each unreadable case, run `queue claim GH-320`; assert exit 2 with the classified `state.*` identity (e.g. `state.keys.missing`, `state.read.unverified`, or the delivered equivalent).
2. Assert zero appends, zero derived replacements, and zero fence leakage.
3. Assert the error never says "free", "available", or "no lease".
4. For each unreadable/torn/unknown-kind case, run `queue list` and `queue plan`; assert exit 2 with the same classified `state.*` identity, bounded evidence emitted on that identity, no `data` sibling, and no partial or empty view presented as a schedule (AC-F10-3). Assert neither surface reports the repository as free and no lease is invented.
5. Assert the healthy control claims successfully.
6. Assert a readable but still-active cleared park is not conflated with this exit-2 case: it remains a report-only finding at exit 0 (TC-PARK-002, TC-PARK-007).

**Expected Outcome**:
- Unreadable lease truth is a platform failure, never an implicit "free"; the claim refuses at exit 2 with zero writes, and `queue list`/`queue plan` exit 2 with bounded evidence and no `data` sibling or schedule view.

#### TC-LEASE-007 - `queue.lease-ttl` is configuration-only tuning

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-10, F-4, Appendix E, RSK-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/config/lease-ttl/**`
**Tags**: @backend, @config, @leases

**Preconditions**:
- Two paired fixtures differ only in `queue.lease-ttl`: 90 000 ms (default) and 10 000 ms.
- A lease has heartbeat age 20 000 ms and no renewal.

**Steps**:
1. With the default TTL, assert the lease is live and the claim conflicts.
2. With the 10 000 ms TTL and no source change, assert the same lease is stale and the claim takes it over with evidence.
3. Assert the resolved value and its origin are inspectable through the delivered configuration provenance surface.
4. Assert renewal cadence is derived as one third of the TTL with a one-second floor (10 000 → ~3 333 ms; 2 000 → 1 000 ms).
5. Assert a non-integer, zero, or negative TTL refuses with `config.value.invalid` naming `queue.lease-ttl`; assert an absent branch uses 90 000 with a `defaults` origin.

**Expected Outcome**:
- The TTL knob changes behaviour with zero code changes, is provenance-visible, and invalid values fail closed.

#### TC-LEASE-008 - Repository key normalization defines the contention domain

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-12, AC-F3-1(a), AC-F3-1(b), NFR-14
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/leases/repo-key/**`
**Tags**: @backend, @leases, @normalization

**Preconditions**:
- Remotes written as `https://github.com/Owner/Repo.git`, `git@github.com:Owner/Repo.git`, `ssh://git@github.com/Owner/Repo.git`, and a synthetic userinfo variant `https://user:redacted@github.com/Owner/Repo` (the `redacted` token is a placeholder, never a credential).
- A distinct remote `github.com/owner/repo-beta`.

**Steps**:
1. Normalize each variant; assert all variants of the same repository produce one key `github.com/Owner/Repo` (or the declared canonical case), with protocol, credentials, userinfo, and `.git` removed.
2. Assert two entries whose bindings normalize to the same key contend for one lease.
3. Assert the repo-beta key is distinct and its lease does not conflict.
4. Assert an unresolvable remote produces no key (TC-SCHED-015).
5. Assert the normalized key is the store key `queue.leases:{repoKey}` and the weight-accounting key.

**Expected Outcome**:
- The normalized remote is the single contention and accounting domain; equivalent remotes never bypass single-flight.

#### TC-LEASE-009 - Scope is `repo-exclusive`; no capacity or CI-slot cap exists

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-14, DEC-1, NG-8
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/checks/queue-bounds.test.ts`, `tests/fixtures/queue/leases/scope/**`
**Tags**: @structure, @leases, @scope

**Preconditions**:
- Every lease fixture and every acquired lease record in the corpus.
- The configuration catalog and the scheduling source tree.

**Steps**:
1. Assert every lease record carries `scope` and the value is `repo-exclusive`.
2. Assert no delivered command acquires `worktree` or any other scope; assert the `worktree` value is declared and unreachable.
3. Assert the configuration catalog contains no capacity, bandwidth, concurrency, CI-slot, or spend key, and no reserved placeholder.
4. Assert the scheduling code contains no branch that reduces lane count for capacity/bandwidth/CI slots (structure search plus review note).
5. Assert a schedule over N distinct repositories yields up to N concurrent leases in the bounded fixture.

**Expected Outcome**:
- Single-flight is the only structural cap; the scope field keeps it a policy, and no capacity policy exists in code or configuration.

#### TC-LEASE-010 - Release is an explicit idempotent no-op when no lease exists

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F10-2, Appendix C
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/leases/release/**`
**Tags**: @backend, @leases, @idempotence

**Phase-surface split**: Partial — release state/idempotence rows land in Phase 4; `result=noop` and `degraded[]` rows complete in Phase 7.

**Preconditions**:
- No lease exists for GH-320; a recording store counts appends.

**Steps**:
1. Run `queue release GH-320`; assert exit 0, `result=noop`, and zero appends.
2. Replay; assert `result=noop` and still zero appends.
3. Assert no fabricated lease or release record is emitted.
4. Assert `degraded` is present when no daemon is reachable and the mutation posture remains truthful.
5. Release an existing own lease and assert the same invocation then yields `result=released` with exactly one record.

**Expected Outcome**:
- Release converges safely: releasing nothing is an explicit no-op, never an error and never a fabricated record.

#### TC-LEASE-011 - Release another holder refuses; release+park lands atomically

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, AC-F7-2, EVT-3, EVT-4, DM-5, DM-10, NFR-14
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/behaviour/queue-rank.test.ts`, `tests/fixtures/queue/leases/release-park/**`
**Tags**: @backend, @leases, @parks

**Phase-surface split**: Partial — holder-refusal and release+park state rows land in Phases 4–5; `--park` grammar and exit rows complete in Phase 7.

**Preconditions**:
- A live lease held by `holder-a` for repo-alpha; the caller is `holder-b`.
- A fault-injecting store can refuse the second append in the release+park transaction.
- Paired invocations use a condition-type token (`--park preemption`) and an unknown token (`--park bogus`) as the cause.

**Steps**:
1. Run `queue release GH-320 --holder holder-b`; assert exit 1 with `queue.lease-conflict` (or the delivered release-conflict identity) and zero appends.
2. Run `queue release GH-320 --holder holder-a --park preempted-for-close-item`; assert one release record and one park record with cause `preempted-for-close-item` paired with condition type `preemption` in the same fenced transaction.
3. With the second append refused, assert neither the release nor the park lands (both or neither) and the lease remains active.
4. Assert at most one active park exists per entry after success.
5. Assert the park carries the resolved recheck interval for the `preemption` condition type (not a cause-keyed interval).
6. Run `queue release GH-320 --holder holder-a --park preemption` (a condition type, not a cause) and `queue release GH-320 --holder holder-a --park bogus` (unknown); assert each is an invocation rejection through `fallback.invocation` at exit 1 with zero appends, proving the cause set is exactly `{provider-window, provider-quota, preempted-for-close-item}` and is never widened by a condition-type token.

**Expected Outcome**:
- Release respects holder identity; a park-on-release is atomic and records the cause together with its paired condition type; an unknown or condition-type `--park` token is refused before any append, and a refused transaction leaves no partial state.

#### TC-LEASE-012 - Claim precondition unmet names the reason

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, F-9, Appendix F, AC-F5-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/leases/preconditions/**`
**Tags**: @backend, @leases, @negative

**Phase-surface split**: Partial — precondition-reason rows land in Phase 4; claim exit/envelope rows complete in Phase 7.

**Preconditions**:
- Three cases: an entry not ready on one of the five pre-fence conditions (owner gate), an entry outranked by a higher-ranked eligible action for its repository, and a heavy entry under the runner's active heavy lease.
- No case uses `repo-free` as a precondition: a repository held by another live holder is the `queue.lease-conflict` outcome proven in TC-LEASE-005, never this row (spec v1.2 F-4/C-2).
- A control eligible entry.

**Steps**:
1. Claim the not-ready entry; assert exit 1, `queue.precondition.unmet`, and the blocking conditions named.
2. Claim the outranked entry; assert `queue.precondition.unmet` naming the outranking ref.
3. Claim the heavy entry; assert `queue.precondition.unmet` with reason `weight-class` naming the carrying lease.
4. Assert zero appends in each refusal.
5. Claim the control; assert success.
6. Assert no refusal in this scenario carries `queue.lease-conflict`, and no held-repository case produces `queue.precondition.unmet` (repository exclusivity is never a pre-fence refusal).

**Expected Outcome**:
- A claim refuses an ineligible target with a precise reason; it never claims behind a gate.

#### TC-LEASE-013 - Claim of one's own lease renews the heartbeat, not the holder

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, F-3, DM-4, EVT-3, Appendix E
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/leases/renewal/**`
**Tags**: @backend, @leases, @renewal

**Phase-surface split**: Partial — renewal state rows land in Phase 4; `result=renewed` envelope rows complete in Phase 7.

**Preconditions**:
- A live lease held by `holder-a` with heartbeat at T.
- The injected clock can advance to T + 30 000 ms.

**Steps**:
1. Advance the clock; run `queue claim GH-320 --holder holder-a`; assert `result=renewed` and one `renewed` record with an advanced `heartbeatAt`.
2. Assert the holder, lease identity, and acquisition time are unchanged.
3. Assert the lease remains live and another holder still conflicts.
4. Assert no new holder and no takeover evidence are recorded.
5. Assert the renewal cadence is derived from the TTL, not a separate configuration key.

**Expected Outcome**:
- A holder can refresh its own lease without creating a second holder; renewal is a heartbeat change, not a takeover.

#### TC-WEIGHT-001 - Heavy build is not co-scheduled (SC-M1-09)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-7, SC-M1-09
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-weight.test.ts`, `tests/fixtures/queue/weight/heavy/**`
**Tags**: @backend, @weight

**Preconditions**:
- Runner `R2` carries an active heavy-class lease for GH-330.
- GH-309 is heavy-class and ready; GH-331 and GH-332 are standard-class and ready; all target distinct repositories.

**Steps**:
1. Compute the schedule; assert GH-309 is held with reason `weight-class` naming the carrying lease.
2. Assert at most one heavy-class action exists for R2.
3. Assert the standard-class entries remain scheduled and are not held by weight.
4. Assert the number of active repositories is unchanged compared with the no-heavy baseline (weight is not a lane cap).
5. Release the heavy lease and assert GH-309 becomes eligible in the next pass.

**Expected Outcome**:
- A runner never carries more than one heavy job; standard work continues, and the heavy cap does not reduce the number of active repositories.

#### TC-WEIGHT-002 - Weight resolution: absent → standard, unrecognized → heavy

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-2, DM-7, AC-F5-1, AC-F5-2, DEC-10, NFR-13, RSK-8
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-weight.test.ts`, `tests/fixtures/queue/plan/weight/**`
**Tags**: @backend, @weight, @plan

**Preconditions**:
- Plans declaring phase `weightClass: standard`, `weightClass: heavy`, `defaultWeightClass: heavy`, no weight declaration, and `weightClass: turbo` (unrecognized).
- A valid plan with a declared light class is rejected or echoed per the plan schema's existing rule.
- An absent plan artifact (`plan.artifact.missing`), an invalid plan (`plan.schema.invalid`), and an unreadable plan artifact.
- Cases in which the invalid/unreadable plan also drives `tier-known` unknown, and the absent plan drives the triage fallback.

**Steps**:
1. Assert an explicit `standard` resolves to `standard`.
2. Assert an explicit `heavy` or `defaultWeightClass: heavy` resolves to `heavy`.
3. Assert a validated plan that omits the weight declaration resolves to `standard` (absent declaration, not absent plan).
4. Assert a declared-but-unrecognized value resolves to `heavy` (conservative), and the resolution is visible in weight-load evidence.
5. Assert the closed vocabulary is exactly `standard` and `heavy`.
6. With an absent plan, assert weight resolves to `heavy` with source evidence `plan-absent` and the delivered `plan.artifact.missing` identity; assert it never resolves to `standard`.
7. With an invalid plan, assert weight resolves to `heavy` with source evidence `plan-unreadable` and the delivered `plan.schema.invalid` identity; assert it never resolves to `standard`.
8. With an unreadable plan, assert weight resolves to `heavy` with source evidence `plan-unreadable`; assert readiness holds `tier-known` unknown and the entry is not scheduled as standard.
9. With an absent plan, assert the entry is subject to the heavy cap and the triage fallback's readiness verdict, so it is never scheduled as standard.

**Expected Outcome**:
- Weight resolution is conservative and deterministic: a validated plan's absent declaration resolves to standard, a declared-unrecognized or unreadable/absent plan resolves to heavy, a typo never silently under-schedules, and no plan that cannot be read or validated is ever co-scheduled as standard.

#### TC-WEIGHT-003 - Weight is a per-runner resource class, not a lane cap

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-4, DM-7, DEC-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-weight.test.ts`, `tests/fixtures/queue/weight/accounting/**`
**Tags**: @backend, @weight, @accounting

**Preconditions**:
- Two heavy leases on two distinct runners (future-proofing the runner field) and one heavy lease on R1.
- A `weights` view fixture.

**Steps**:
1. Assert the runner identity is recorded on each lease.
2. Assert the `weights` view reports `runner`, `class`, and `active` counts, and that R1 shows one active heavy.
3. Assert the heavy constraint is scoped per runner: a heavy lease on R1 does not block a heavy lease on R2.
4. Assert a standard entry is scheduled regardless of the heavy count.
5. Assert no configuration key or code path treats the heavy count as a lane count.

**Expected Outcome**:
- Weight accounting is per runner, survives a future containerized/remote executor through the runner field, and never caps the total lane count.

#### TC-WEIGHT-004 - Heavy claim under an active heavy lease refuses; standard continues

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, F-4, Appendix F
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-weight.test.ts`, `tests/fixtures/queue/weight/claim/**`
**Tags**: @backend, @weight, @negative

**Phase-surface split**: Partial — weight-cap state rows land in Phase 4; claim exit/reason envelope rows complete in Phase 7.

**Preconditions**:
- R1 carries a heavy lease; GH-309 is heavy and ready; GH-331 is standard and ready.
- Both target different repositories.

**Steps**:
1. Claim GH-309; assert exit 1, `queue.precondition.unmet`, reason `weight-class`, naming the carrying lease.
2. Assert zero appends and no lease for GH-309.
3. Claim GH-331; assert success.
4. Release the heavy lease; claim GH-309; assert success.
5. Assert the refusal never returns exit 0 or a generic conflict.

**Expected Outcome**:
- The weight cap is a hard exclusion on a claim and is named precisely; standard work is unaffected.

#### TC-DEPEND-001 - Consumer held `dependency-open` while producer unresolved

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-6, AC-F1-1, AC-F6-1, DM-2, DM-9, NFR-13
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-depend.test.ts`, `tests/fixtures/queue/depend/open/**`
**Tags**: @backend, @depend

**Preconditions**:
- GH-300 is the producer and unresolved; GH-301 is the consumer with a declared edge to GH-300.
- A paired case builds on GH-302, which declares a seeded edge to GH-303 while GH-303 has no queue entry.
- Both primary entries are otherwise ready; GH-301's merge is ready.

**Steps**:
1. Compute the schedule; assert GH-301 is held with reason `dependency-open` and is not in `nextActions`.
2. Assert `deps-satisfied` is `unsatisfied` and names GH-300.
3. Assert GH-300 is eligible and appears.
4. Resolve GH-300 (landing evidence present) and recompute; assert GH-301 becomes eligible subject to the deploy gate.
5. Assert declared edges are additive and can only make `deps-satisfied` stricter.
6. For the edge that targets GH-303 with no queue entry, assert the edge is retained in the folded graph and `deps-satisfied` is `unknown` with the delivered `dependency-unobserved` reason; assert GH-302 is not ready and the edge is never `satisfied` and never dropped.

**Expected Outcome**:
- A consumer is removed from competition while its producer is unresolved, not merely reordered; an edge to a ref with no entry is visible evidence (`dependency-unobserved`), never a silent pass.

#### TC-DEPEND-002 - Producer precedes consumer in one repository, regardless of priority

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-9, AC-F6-1, DM-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-depend.test.ts`, `tests/fixtures/queue/depend/order/**`
**Tags**: @backend, @depend, @precedence

**Preconditions**:
- GH-300 (producer) and GH-301 (consumer) both target repo-alpha and are both eligible.
- GH-300 has a higher numeric priority value (lower precedence) than GH-301.

**Steps**:
1. Compute the schedule; assert GH-300 precedes GH-301 because of the producer role, regardless of priority.
2. Assert both actions carry their rank and reason.
3. Place them in different repositories and assert both may be concurrent, with GH-300 merely appearing first in the ordered action list.
4. Assert producer-before-consumer applies only within one repository's contending set.
5. Assert the order is deterministic across shuffled inputs.

**Expected Outcome**:
- Producer-first is an ordering rule inside a repository and does not serialize distinct repositories.

#### TC-DEPEND-003 - Deploy-verified gate before a dependent merge

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F6-2, DM-2, DM-9, DM-12, NFR-13, RSK-6
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-depend.test.ts`, `tests/fixtures/queue/deploy/verdicts/**`, `tests/fixtures/queue/deploy/producer-config/**`
**Tags**: @backend, @depend, @deploy

**Preconditions**:
- GH-300 (producer, repo-alpha) is landed; repo-alpha declares `merge.deploy-expectations`.
- GH-301 (consumer, repo-beta) has a ready merge.
- A multi-repository state directory contains repo-alpha and repo-beta; the invocation runs from repo-beta.
- Repo-alpha's queue entry records its declaration root (for example `/work/repo-alpha`) whose normalized remote equals repo-alpha's recorded key; roots are discovered only from entry records.
- A paired case where repo-beta's own configuration declares no deploy expectations while repo-alpha's does, and the reverse.
- Cases where no entry-recorded root matches repo-alpha's key, two distinct entry-recorded roots claim the same key (collision), and the matched config is missing, unreadable, or invalid.
- Deploy fixtures: `verified` with evidence, `unknown` (never ran / stale), and `failed` with a named step.

**Steps**:
1. With `verified`, assert GH-301's merge action is eligible and the evidence names the deploy verdict and its trace evidence.
2. With `unknown`, assert GH-301 holds at `deploy-unverified` and is not scheduled.
3. With `failed`, assert GH-301 holds at `deploy-unverified` and the failed step is named in evidence.
4. With an unreadable trace, assert the same hold and a classified deploy read identity.
5. Assert the hold is a hard exclusion and never a green fallback.
6. In the multi-repository directory with the invocation run from repo-beta, assert repo-alpha's expectations are read from repo-alpha's own configuration, discovered through the entry-recorded root whose normalized remote exactly matches repo-alpha's recorded key; assert the invocation's root/configuration never changes the verdict (AC-F6-2, DM-12).
7. With repo-alpha declaring expectations and repo-beta declaring none (and the reverse), assert the producer's declaration governs and the invocation checkout is irrelevant.
8. With no entry-recorded root matching repo-alpha's key, assert the expectation is `unknown` — never `not-declared` and never `verified` — and GH-301 holds `deploy-unverified` with no green deploy read.
9. With two distinct entry-recorded roots claiming repo-alpha's key (a collision), assert the expectation is `unknown` (the collision is never resolved by picking one), never `not-declared` and never `verified`, and GH-301 holds `deploy-unverified`.
10. With the matched repo-alpha config missing or unreadable, assert the expectation is `unknown` — never `not-declared` and never `verified` — and GH-301 holds `deploy-unverified` with no green deploy read.
11. With the matched repo-alpha config invalid, assert the same `unknown`/`deploy-unverified` hold.

**Expected Outcome**:
- A dependent merge is gated on a `verified` deploy verdict with evidence; unknown, failed, or unreadable is never green. Expectations come from the producer's own config discovered through its entry-recorded root whose normalized remote matches its recorded key; no match, a two-root collision, or a missing, unreadable, or invalid producer config is `unknown`, never `not-declared` or `verified`.

#### TC-DEPEND-004 - No declared deploy expectation: landing-only with `deploy: not-declared`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F6-2, DM-2, DM-12, NFR-13, RSK-6
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-depend.test.ts`, `tests/fixtures/queue/deploy/not-declared/**`, `tests/fixtures/queue/deploy/producer-config/**`
**Tags**: @backend, @depend, @deploy

**Preconditions**:
- GH-300 is landed; repo-alpha declares no `merge.deploy-expectations`.
- GH-301's merge is ready.
- A multi-repository case where the invocation runs from repo-beta and repo-beta's own config declares deploy expectations while repo-alpha's does not.
- A case where repo-alpha's config is missing or unreadable, and a case where two distinct entry-recorded roots claim repo-alpha's key (collision).

**Steps**:
1. Compute the schedule; assert GH-301's merge is eligible on landing evidence alone.
2. Assert the evidence records `deploy: not-declared` so the weaker guarantee is visible.
3. Assert no deploy read is performed for an undeclared producer (memoization/budget not consumed).
4. Assert a paired declared case with an `unknown` verdict stays held.
5. Assert the not-declared path never fabricates a `verified` verdict.
6. With the invocation run from repo-beta and repo-beta declaring expectations, assert repo-alpha's own config bound to its recorded key governs: the gate is landing-only with `deploy: not-declared`, and the invocation's configuration does not gate repo-alpha's producer (AC-F6-2).
7. With repo-alpha's config missing or unreadable, assert `deploy: not-declared` is never emitted; the expectation is `unknown` and GH-301 holds `deploy-unverified`.
8. With two distinct entry-recorded roots claiming repo-alpha's key (collision), assert `deploy: not-declared` is never emitted; the expectation is `unknown` and GH-301 holds `deploy-unverified`, with no root chosen arbitrarily.

**Expected Outcome**:
- Where the producer declares no expectations, the gate is landing-only and the weaker guarantee is explicitly visible; a missing, unreadable, or colliding producer root never masquerades as `not-declared`, and the invocation's config never supplies another repository's gate.

#### TC-DEPEND-005 - Deploy reads are bounded and memoized; overflow holds `deploy-unverified`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, NFR-6, AC-F6-1, RSK-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-depend.test.ts`, `tests/fixtures/queue/deploy/budget/**`
**Tags**: @backend, @depend, @budget

**Preconditions**:
- Five producer edges, each with a declared deploy expectation; a counting deploy-read fake.
- The declared per-pass deploy read bound is 3.

**Steps**:
1. Compute one pass; assert at most 3 deploy verdict reads occur.
2. Evaluate the same producer twice in one pass; assert exactly one read (memoized).
3. For the edges beyond the bound, assert they are held `deploy-unverified` with reason `read-budget-exhausted`.
4. Assert the held edges are not scheduled and never green.
5. In the next pass, assert the budget resets and previously held edges are evaluated in order.

**Expected Outcome**:
- Deploy gating is bounded and memoized per pass; overflow is an explicit hold with a named reason, never a silent pass.

#### TC-DEPEND-006 - Producer landing is observed; unlanded producer holds the consumer

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-depend.test.ts`, `tests/fixtures/queue/depend/landing/**`
**Tags**: @backend, @depend, @negative

**Preconditions**:
- GH-300 has a delivered landing record (SHA present on base) in one case and no landing record in another.
- GH-301 depends on GH-300.

**Steps**:
1. With landing evidence present, assert GH-301 advances to the deploy gate.
2. With no landing evidence, assert GH-301 is held with `producer-not-landed` (or the delivered reason) and not scheduled.
3. Assert the consumer never depends on the producer's exit code or narrative, only on recorded landing evidence.
4. Assert an unreadable landing read is `unknown` and holds, never passes.
5. Assert the control case is eligible after landing.

**Expected Outcome**:
- Landing is observed through delivered evidence; absence or unreadability holds the consumer closed.

#### TC-RANK-001 - Close-first ranking is deterministic (SC-M1-10)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-9, AC-F7-1, DM-8, NFR-1, SC-M1-10
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-rank.test.ts`, `tests/golden/queue-rank.test.ts`, `tests/fixtures/queue/rank/close-first/**`
**Tags**: @backend, @rank, @determinism

**Phase-surface split**: Partial — ordering rows land in Phase 3; `queue plan --next 2` and the golden/output rows complete in Phase 7.

**Preconditions**:
- One merge-ready entry and one ready new start, both eligible.
- A paired case where the merge-ready entry has a worse priority value.

**Steps**:
1. Run `queue plan --next 2`; assert the merge-ready entry is first.
2. Assert both actions carry reasons (`merge-ready`, `new-start`) and their rank classes.
3. Assert the order is unchanged when the new start's priority is numerically better.
4. Replay 100 times; assert byte-identical `data`.
5. Run the paired corpus with shuffled input; assert the same order.

**Expected Outcome**:
- Closing beats opening, reasons are explicit, and the order is byte-identical across repeated runs and input orders.

#### TC-RANK-002 - Rank classes are closed, ordered, and derived per pass

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F9-1, DM-8, NFR-14
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-rank.test.ts`, `tests/fixtures/queue/rank/classes/**`
**Tags**: @structure, @rank

**Preconditions**:
- Fixtures for each class: merge-ready (approval on non-draft open PR), in-review (other associated open PR), resume-parked (cleared park), new-start.
- An uncleared-park case.

**Steps**:
1. Assert the closed set and numeric order is `merge-ready`(0) < `in-review`(1) < `resume-parked`(2) < `new-start`(3).
2. Assert `merge-ready` requires an observed approval on a non-draft open PR; `in-review` covers every other associated open PR (the population `queue ready` calls `review-pending`).
3. Assert `resume-parked` applies only to a parked entry whose condition evaluated clear in this pass.
4. Assert an uncleared park is not a rank candidate at all (it is a hard exclusion).
5. Assert rank is re-derived per pass and never frozen on the entry.

**Expected Outcome**:
- Rank classes are a closed ordered contract derived from delivered close association and park state, not stored.

#### TC-RANK-003 - Pass emits a preemption action under `preempted-for-close-item`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DM-10, F-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-rank.test.ts`, `tests/fixtures/queue/rank/preemption/**`
**Tags**: @backend, @rank, @preemption

**Preconditions**:
- GH-310 is merge-ready on repo-alpha and eligible.
- GH-311 is a new start holding the repo-alpha lease.

**Steps**:
1. Compute the schedule; assert it emits a preemption action naming target GH-311, repo-alpha, holder, park cause `preempted-for-close-item`, and motivating close item GH-310.
2. Assert GH-310 is not scheduled in the same pass (single-flight still holds until release).
3. Assert the preemption is an action, never a lease violation or a silent release.
4. Assert no automatic release is performed by the read (zero writes).
5. Assert the action is deterministic and bounded.

**Expected Outcome**:
- Preemption is computed with a named park state and evidence; the close item waits one pass for the explicit release, and single-flight is never violated.

#### TC-RANK-004 - Preemption release and park land in one fenced transaction

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DM-5, DM-10, EVT-3, EVT-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-rank.test.ts`, `tests/fixtures/queue/rank/preemption-release/**`
**Tags**: @backend, @rank, @parks

**Phase-surface split**: Partial — release+park state rows land in Phase 5; `queue release --park` envelope and exit rows complete in Phase 7.

**Preconditions**:
- GH-311 holds the repo-alpha lease; GH-310 is merge-ready.
- A fault-injecting store can refuse the park append after the release append.

**Steps**:
1. Run `queue release GH-311 --holder holder-a --park preempted-for-close-item`; assert one release and one park record in the same fenced transaction.
2. Recompute; assert GH-310 is now eligible and scheduled, and GH-311 is `resume-parked` (condition clear) ranking above new starts.
3. With the park append refused, assert neither the release nor the park lands and GH-311 still holds the lease.
4. Assert the park carries cause `preempted-for-close-item`, condition type `preemption` (the one-to-one pair), entry, repo key, resolved recheck interval, and release cause.
5. Assert a subsequent pass resumes GH-311 exactly when its condition clears, with an incident per TC-PARK-001.

**Expected Outcome**:
- Release+park is atomic; the next pass schedules the close item and GH-311 becomes a resumable park with the named state.

#### TC-RANK-005 - Claiming an outranked entry refuses with the outranking ref

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, F-9, AC-F4-3, Appendix B, Appendix F, DEC-12
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-rank.test.ts`, `tests/fixtures/queue/rank/outranked/**`
**Tags**: @backend, @rank, @negative

**Phase-surface split**: Partial — outranked/no-ref selection rows land in Phase 3 and claim-enforcement rows in Phase 4; `selectedRef`, `no-eligible-action`, and exit-projection rows complete in Phase 7.

**Preconditions**:
- GH-310 merge-ready and eligible for repo-alpha; GH-311 new-start and eligible for repo-alpha but outranked.
- No lease held.

**Steps**:
1. Claim GH-311 explicitly; assert exit 1, `queue.precondition.unmet`, naming GH-310 as the outranking ref.
2. Assert zero appends.
3. Claim GH-310; assert success.
4. Assert the refusal is not a lease conflict and does not claim single-flight.
5. With no ref argument, assert `queue claim` selects the top-ranked eligible action from the Appendix B precedence deterministically (ties resolved by Appendix B steps 10–13), the envelope names the selected ref in `selectedRef`, and repeated identical passes select the same ref; assert that when no action is eligible it refuses `queue.precondition.unmet`, reason `no-eligible-action`, at exit 1 and appends nothing; assert a stuck park is never a selectable candidate (TC-PARK-008).

**Expected Outcome**:
- An outranked explicit claim refuses with the outranking ref; a no-ref claim equals the top-ranked eligible action and refuses `no-eligible-action` when none is eligible; the scheduler never lets an explicit request silently violate precedence.

#### TC-RANK-006 - A hard gate removes a close item; ordering never admits past it

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, Appendix B
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-precedence.test.ts`, `tests/fixtures/queue/precedence/gates/**`
**Tags**: @backend, @precedence, @negative

**Preconditions**:
- A merge-ready entry blocked by an owner gate; a new-start entry with no gate.
- A merge-ready entry blocked by a live lease held by a new start (preemption case separately).

**Steps**:
1. Compute; assert the merge-ready entry is removed with reason `owner-gate` naming the labels, not ranked below the new start.
2. Assert the new start is scheduled because the close item was excluded, not because it outranked it.
3. Assert removing the owner gate makes the close item first in the next pass.
4. Assert no ordering rule admits a gated entry; each gate appears in `blocking[]` with its reason.
5. Assert the same rule for dependency, deploy, park, lease, and weight gates.

**Expected Outcome**:
- Hard exclusions remove; ordering orders. A gate can never be traded against rank, and a close item is never silently demoted.

#### TC-PARK-001 - Park resumes exactly on condition clear with an incident (SC-M1-11)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-5, DM-6, EVT-4, EVT-5, NFR-5, SC-M1-11
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/parks/window/**`
**Tags**: @backend, @parks, @resume

**Phase-surface split**: Partial — park resume/incident state rows land in Phase 5; the `queue claim` mutating-pass CLI rows complete in Phase 7.

**Preconditions**:
- A lane is parked on a provider window ending at absolute `T`.
- The injected clock starts before T and advances past T; the recheck interval is the shipped 60 000 ms.
- A mutating pass (`queue claim`) is the surface.

**Steps**:
1. Advance to T + 1 (a mutating pass inside one recheck interval of T); run the mutating pass; assert the park condition evaluates clear and the entry resumes.
2. Assert the resume timestamp is within `(T, T + interval]`.
3. Assert exactly one `queue.incident` of type `park-auto-recovery` names the condition, the clear time T, the evaluation time, and the observation gap since the previous evaluation.
4. Assert exactly one park recovery record is appended and at most one active park remains per entry.
5. Assert the resumed entry ranks `resume-parked` if it is a park-only resume, or its normal class if it is eligible to start.

**Expected Outcome**:
- A cleared park resumes in the same mutating pass, within one interval of T, with a complete recovery incident and no duplicate park. The bound is scoped to a pass that runs inside the interval; the no-engine gap case is TC-PARK-003 and is never classified stuck solely because the gap exceeded the interval (spec v1.2 R-09/AC-F8-1).

#### TC-PARK-002 - A park observed clear but still active is the stuck finding

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, AC-F10-3, DM-5, DM-14, EVT-4, NFR-13, Appendix D, RSK-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/parks/stuck/**`
**Tags**: @backend, @parks, @negative

**Phase-surface split**: Partial — stuck finding/refusal state rows land in Phase 5; `queue list`/`queue plan`/`queue claim` envelope and exit rows complete in Phase 7.

**Preconditions**:
- Case A: a durable `clear-observed` `queue.park` record is seeded for the entry (`delivery.queue.park.v1`, key `queue.parks:<REF>`, fields `clearObservedAt` and `recoveryState: clear-observed`) per Appendix D, representing a prior mutating pass that observed the condition clear while the park remains active without a later `recovered` record.
- Case B: a mutating pass's recovery append is refused by the store.
- A control park that is genuinely unclear.

**Steps**:
1. For Case A, run `queue list`/`queue plan`; assert a report-only finding `queue.park-condition-stuck` with severity and bounded evidence; assert the command exits 0 and performs zero writes.
2. Run a claim on that entry; assert exit 1 with `queue.park-condition-stuck`, consequence `not_landed`, zero appends, and that it never falls through to a lease conflict.
3. For a mutating pass that observes a park condition clear, assert it appends a `clear-observed` `queue.park` record (same payload schema and key, fields `clearObservedAt`, evaluation time, observation gap, and `recoveryState: clear-observed`) before attempting recovery; assert a landed recovery appends a `recovered` record that supersedes the marker.
4. For Case B, run the mutating pass; assert the refused recovery leaves the `clear-observed` marker in place, returns the stuck identity, and leaves the park active with no partial recovery.
5. For the control, assert no stuck finding and normal reevaluation.
6. Assert the same identity never appears twice in one outcome (finding vs error is mutually exclusive per surface).

**Expected Outcome**:
- A park outliving a cleared condition is a classified bug: report-only on reads, a refusal on claim, never silence and never a claim behind the park; the durable `clear-observed` marker makes the prior-pass observation visible without any read writing.

#### TC-PARK-003 - Observation gap recovers with a gap-naming incident, never stuck

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-6, EVT-5, RSK-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/parks/gap/**`
**Tags**: @backend, @parks, @gap

**Preconditions**:
- A park whose condition cleared during a long interval in which no engine process ran.
- The injected clock advances by several recheck intervals.

**Steps**:
1. Run the first pass after the gap; assert the park is recovered, not reported stuck.
2. Assert the incident names the observation gap since the last evaluation, not a fabricated evaluation count.
3. Assert no `queue.park-condition-stuck` finding appears on this first pass.
4. Run a second pass; assert no duplicate incident.
5. Contrast with TC-PARK-002 Case A, where a prior observation exists and stuck applies.

**Expected Outcome**:
- Absence of a process is not a bug: a gap produces a gap-naming recovery incident; stuck requires a prior clear observation or a refused recovery.

#### TC-PARK-004 - Closed condition types and one active park per entry

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-5, DM-6, DM-10, EVT-4, NFR-14
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/parks/types/**`
**Tags**: @structure, @parks

**Preconditions**:
- Fixtures for condition types `provider-window` (absolute expiry), `provider-quota` (available again), and `preemption` (preempting lease released and entry ready).
- Fixtures for causes `provider-window`, `provider-quota`, and `preempted-for-close-item`, including each valid one-to-one pairing.
- An owner-gate and an external wait, which are not parks.

**Steps**:
1. Assert the closed condition-type set is exactly `{provider-window, provider-quota, preemption}`.
2. Assert the closed cause set is exactly `{provider-window, provider-quota, preempted-for-close-item}`, and assert the two sets are distinct and never conflated (`preemption` is a condition type, never a cause; `preempted-for-close-item` is a cause, never a condition type).
3. Assert the one-to-one pairing: cause `provider-window` ↔ condition type `provider-window`; cause `provider-quota` ↔ condition type `provider-quota`; cause `preempted-for-close-item` ↔ condition type `preemption`.
4. Assert `provider-window` clears at the absolute expiry; `provider-quota` clears on observed availability; `preemption` clears when the preempting lease is released and the entry is ready.
5. Assert an owner gate or external wait is a readiness blocker and not a park record.
6. Assert at most one active park exists per entry; a second active park is a classified `state.*`.
7. Assert each park carries a resolved recheck interval keyed by condition type and an optional absolute expiry only where the condition supplies one.
8. Assert `queue release --park` accepts exactly the cause set and rejects a condition-type token or an unknown token through `fallback.invocation` (cross-checked behaviourally in TC-LEASE-011).

**Expected Outcome**:
- The cause set and condition-type set are two distinct closed contracts with a one-to-one pairing; non-evaluable waits are not misclassified as parks, and no cause token can masquerade as a condition type or vice versa.

#### TC-PARK-005 - Resume latency bound and no active-without-recovery park

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, NFR-5, AC-F8-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/parks/latency/**`
**Tags**: @backend, @parks, @latency

**Preconditions**:
- Window and preemption intervals 60 000 ms; quota 300 000 ms.
- Bound cases: a mutating pass at the clear time T and at exactly T + interval.
- Gap case: a park clears with no mutating pass inside the interval, and the first pass runs at T + interval + 1 ms (or later).

**Steps**:
1. Assert that when a mutating pass runs within one recheck interval of the clear, the park is resumed in that pass within `≤ interval` of the clear time for each type.
2. Assert the shipped defaults are 60 000 ms for window/preemption and 300 000 ms for quota.
3. Assert the at-bound pass (exactly T + interval) still resumes in that pass; the bound is inclusive.
4. Assert the gap case (T + interval + 1 ms with no earlier pass): the first pass after the gap recovers the park with a gap-naming incident and is never reported stuck solely because the gap exceeded the interval (TC-PARK-003); the latency bound does not apply as a violation to this case.
5. Assert 0 parks remain active without either a recovery record or a `queue.park-condition-stuck` finding once a pass observed the condition clear.
6. Assert no real sleep is used; time advances through the injected clock.
7. Assert repeated passes do not append duplicate recovery records.

**Expected Outcome**:
- Park resume meets the inclusive latency bound for every type when a mutating pass runs inside one interval; the no-engine gap case recovers with a gap-naming incident and is never stuck solely because the gap exceeded the interval; no park can remain active unaccounted for after a clear observation.

#### TC-PARK-006 - `queue.park-recheck.{type}` is configuration-only tuning

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, NFR-10, Appendix E
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/config/park-recheck/**`
**Tags**: @backend, @config, @parks

**Preconditions**:
- Paired fixtures differ only in `queue.park-recheck.provider-window`: 60 000 ms versus 5 000 ms.
- A park condition clears at T; passes run at T + 5 001 and T + 60 001.

**Steps**:
1. With the default, assert no resume at T + 5 001 after the pass cadence and a resume by T + 60 001.
2. With the 5 000 ms value and no source change, assert the resume happens at the earlier pass and the new value is visible in park evidence.
3. Repeat for `provider-quota` and `preemption` (each type independently tunable).
4. Assert a non-integer, zero, or negative value is refused `config.value.invalid` naming the key.
5. Assert an unknown type key is `config.key.unknown`; an absent branch uses the shipped defaults with a `defaults` origin.

**Expected Outcome**:
- Each per-type interval changes resume timing through configuration alone, is evidence-visible, and invalid values fail closed.

#### TC-PARK-007 - Unreadable park history is never "not parked"

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F10-3, NFR-13, RSK-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/parks/unreadable/**`
**Tags**: @backend, @parks, @fail-closed

**Phase-surface split**: Partial — unreadable-park state rows land in Phase 5; `queue list`/`queue plan`/`queue claim` exit-2 rows complete in Phase 7.

**Preconditions**:
- A torn or unreadable `queue.parks:{REF}` history and a wrong-kind record under the prefix.
- A control healthy park.

**Steps**:
1. For each unreadable/torn/unknown-kind park case, run `queue list` and `queue plan`; assert exit 2 with the classified `state.*` identity, bounded evidence emitted on that identity, no `data` sibling, and no partial or empty parks view presented as a schedule; assert the result never reads as `not parked` or availability (AC-F10-3).
2. Run `queue claim` on that entry; assert exit 2 with the classified `state.*` identity and zero appends.
3. Assert no recovery is attempted on unreadable state (no appends, no fabricated incident).
4. Assert the control healthy park evaluates normally.
5. Assert the same fail-closed rule applies to a park record whose condition type is outside the closed set.
6. Assert the distinction holds: a readable park observed clear but still active is the report-only `queue.park-condition-stuck` finding at exit 0 (TC-PARK-002), never this exit-2 unreadable-history case.

**Expected Outcome**:
- Unreadable park truth fails closed: it is never served as unparked, `queue list`/`queue plan` exit 2 with bounded evidence and no schedule view, and a claim refuses at exit 2 without writing; a readable stuck park remains the distinct report-only case at exit 0.

#### TC-PARK-008 - A stuck park is never a next action; claim refuses with zero appends

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-8, AC-F8-1, DM-5, DM-14, Appendix B step 7b, NFR-13
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/parks/stuck-not-next-action/**`
**Tags**: @backend, @parks, @negative, @precedence

**Phase-surface split**: Partial — the hard-exclusion and claim-refusal policy lands in Phase 5; reads/claim envelope rows complete in Phase 7.

**Preconditions**:
- A durable `clear-observed` `queue.park` record is seeded for GH-340 (`delivery.queue.park.v1`, key `queue.parks:GH-340`, `clearObservedAt`, `recoveryState: clear-observed`) with no later `recovered` record, so the park is classified `queue.park-condition-stuck`.
- GH-340 is otherwise ready and would rank `resume-parked` if the cleared condition alone decided rank.
- A control new-start entry GH-341 is eligible in a different repository; a second control has a genuinely uncleared park (`parked:<cause>`), and a third control has no park.
- No lease held; no daemon; the injected clock is fixed.

**Steps**:
1. Run `queue plan` and `queue list`; assert GH-340 is absent from `nextActions` and from every eligible action, and is never classified `resume-parked`.
2. Assert the held entry carries the blocking reason `park-condition-stuck` and the report-only `queue.park-condition-stuck` finding at exit 0, with bounded evidence and zero appends, fences, or derived replacements.
3. Run `queue claim` with no ref; assert it selects GH-341 (or refuses `queue.precondition.unmet` with reason `no-eligible-action` when GH-341 is removed), and never selects GH-340.
4. Run `queue claim GH-340`; assert exit 1 with `queue.park-condition-stuck`, consequence `not_landed`, and zero appends; assert it is never a `queue.lease-conflict` and never `queue.precondition.unmet`.
5. Assert Appendix B step 7b removes GH-340 before rank assignment: the uncleared-park control is held `parked:<cause>` (a pre-rank hard exclusion, not stuck), and the no-park control is eligible.
6. Assert the same identity never appears twice in one outcome (finding on the read surface vs refusal on the claim are mutually exclusive per surface), and the read never attempts a park recovery.

**Expected Outcome**:
- A stuck park is a hard exclusion from scheduling, never a `resume-parked` candidate, never in `nextActions`, and never selected by a no-ref claim; an explicit claim on it refuses at exit 1 with `queue.park-condition-stuck` and zero appends, never a lease conflict or a generic precondition refusal.

#### TC-LANES-001 - `lanes list` reports the full lane contract with no fabricated values

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DM-11, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/lanes.test.ts`, `tests/golden/lanes-list.test.ts`, `tests/fixtures/queue/lanes/**`
**Tags**: @backend, @lanes, @api

**Preconditions**:
- One delivering lane with a live lease, one lane parked on `provider-quota`, and one lane failed past its restart budget.
- The economics fold provides a restart history for the failed lane and an underivable amplification for one lane.
- No daemon is reachable.

**Steps**:
1. Run `lanes list`; assert each lane's identity is the canonical ref and each `state` is from the closed set `delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review`, `failed`.
2. Assert each lane carries a bounded idle reason drawn from the declared set; assert no free-form string leaks.
3. Assert the delivering lane carries `lease` and `leaseScope`; assert the parked and failed lanes carry no fabricated lease.
4. Assert `restarts` is the delivered economics value and `amplification` is `null` with `amplificationWarning` where underivable, never `0`.
5. Assert `weightClass` is present and valid; assert `findings[]`, `degraded[]`, and `truncated` are present.
6. Assert the command performs zero writes and exits 0.

**Expected Outcome**:
- The lane view is a complete, bounded, read-only projection with no fabricated zero, no invented lease, and truthful degradation.

#### TC-LANES-002 - `lanes show` returns one lane; an unobserved ref is classified

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-11, AC-F11-1, Appendix F
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/lanes.test.ts`, `tests/golden/lanes-show.test.ts`
**Tags**: @backend, @lanes, @negative

**Preconditions**:
- A delivering lane for GH-320; a ref not present in the queue graph.
- An ambiguous-case check: lane identity is the canonical ref, not a synthetic ordinal.

**Steps**:
1. Run `lanes show GH-320`; assert it returns exactly one lane with the full contract and exit 0.
2. Run `lanes show GH-999`; assert exit 1 with `queue.entry.unobserved` and zero writes.
3. Assert `lanes show` accepts the same canonical form as `queue add` and rejects a malformed ref at invocation time.
4. Assert no synthetic `L` ordinal identity is produced.
5. Assert repeated runs are byte-identical.

**Expected Outcome**:
- Single-lane observation is ref-keyed and stable across restarts; an unobserved ref is a classified user error, never a fabricated lane.

#### TC-LANES-003 - Restarts and amplification come from the economics fold

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DM-11, F-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/lanes.test.ts`, `tests/fixtures/queue/economics/**`, `tests/fixtures/economics/**`
**Tags**: @backend, @lanes, @economics

**Preconditions**:
- Economics fixtures: three restarts with unique progress, a restart-loop amplification, a missing-unique-progress warning, and an underivable value.
- A lane tied to each fixture.

**Steps**:
1. Assert `restarts` equals the count derived from the delivered per-delivery economics view.
2. Assert `amplification` and `amplificationWarning` are sourced from the fold; a loop fixture reports the declared flag; an underivable fixture reports `null` plus a warning.
3. Assert the lane view never recomputes or fabricates a zero when the fold is absent.
4. Assert the lane state follows the fold (`failed` past budget) without storing a lane record.
5. Assert two identical folds produce identical lane values.

**Expected Outcome**:
- Lanes read economics; they never recompute it or hide an underivable value behind a zero.

#### TC-LANES-004 - `--watch` is refused through `fallback.invocation`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-10, AC-F11-2, DEC-7, NG-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/lanes.test.ts`, `tests/golden/lanes-watch-refusal.test.ts`
**Tags**: @backend, @lanes, @refusal

**Preconditions**:
- `lanes list --watch` and `lanes show GH-320 --watch`.
- A stream spy asserts no line is emitted.

**Steps**:
1. Run each invocation; assert exit 1 with `fallback.invocation`, `result=refused`, and a remediation hint naming the resident-daemon story.
2. Assert no empty, partial, or fabricated stream is emitted; the stream spy records zero event lines.
3. Assert no state read is required to refuse; the refusal is an invocation rejection.
4. Assert `queue ... --watch` is refused the same way if the grammar rejects it.
5. Assert a normal `lanes list` without `--watch` still succeeds (the refusal is scoped to the flag).

**Expected Outcome**:
- `--watch` is strictly refused with a truthful remediation hint; no silent empty stream is representable.

#### TC-LANES-005 - Unreadable store returns `status.collector.lanes.unavailable` at exit 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-2, NFR-13, NFR-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/lanes.test.ts`, `tests/fixtures/queue/lanes/unreadable/**`
**Tags**: @backend, @lanes, @fail-closed

**Preconditions**:
- An unreadable queue store (torn ledger / unreadable key) and a validated-empty store.
- The delivered collector family shape.

**Steps**:
1. Run `lanes list`; assert exit 2 with `status.collector.lanes.unavailable` and the family's declared fields.
2. Assert the payload has no `lanes[]` empty array that could be read as zero lanes; assert no `data` sibling.
3. Assert the sibling id `status.collector.tracker.unavailable` is unchanged.
4. For the validated-empty store, assert exit 0 with an explicit observed-empty view (count 0 and a marker), not the unavailable identity.
5. Assert no state write occurs in either case.

**Expected Outcome**:
- An unreadable store is a platform failure, never a zero-lane view; an empty store is explicitly observed-empty.

#### TC-LANES-006 - Lanes reads are pure, bounded, and truthfully degraded/empty

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, NFR-9, AC-F11-1, F-11
**Test Type(s)**: Checks, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/lanes.test.ts`, `tests/checks/queue-bounds.test.ts`, `tests/fixtures/queue/lanes/bounds/**`
**Tags**: @backend, @lanes, @bounds

**Preconditions**:
- A corpus with 200+ lanes, long refs, and a no-daemon environment.
- A recording store counts writes.

**Steps**:
1. Assert `lanes list` performs 0 writes, fences, appends, and derived replacements.
2. Assert `lanes` ≤ 200 with a truncation marker; `findings` ≤ 20; serialized `data` ≤ 65 536 bytes; human output ≤ 40 lines and 8 192 bytes.
3. Assert `degraded` contains `daemon-unreachable` when no daemon is reachable.
4. Assert an empty queue renders an explicit observed-empty with counts and a marker.
5. Assert repeated reads are byte-identical.

**Expected Outcome**:
- Lanes are a pure bounded fold with truthful degradation and an explicit empty state.

#### TC-VOCAB-001 - Five additive record kinds and one derived document

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, EVT-1..EVT-5, DM-13, NFR-8
**Test Type(s)**: Structure, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-graph.test.ts`, `tests/fixtures/queue/state/kinds/**`
**Tags**: @structure, @state, @contract

**Preconditions**:
- The delivered `delivery.state.v1` registry and store.
- A store that has never seen a queue record; a store with one record of each new kind; a store with a wrong-kind record.

**Steps**:
1. Assert exactly five additive kinds `queue.entry`, `queue.dependency`, `queue.lease`, `queue.park`, `queue.incident` with their declared payload schemas and store-scoped key prefixes.
2. Assert the derived document `delivery.queue.graph.v1` / `queue-graph.json` is rebuildable and never treated as truth.
3. Assert `STATE_SCHEMA_VERSION` is unchanged, with no migration, backfill, or rebuild command.
4. Assert a queue read on a never-seen store is verified-empty, never torn or zeroed.
5. Assert a wrong kind, malformed payload, duplicate acquisition for one holder, or a second active park for one entry is a classified `state.*` failure and never a fabricated value.
6. Assert existing record kinds and reads are unaffected.
7. Assert the `queue.park` payload carries the additive `clearObservedAt` and `recoveryState` observation fields inside `delivery.queue.park.v1` (no new record kind), and an older park record without them reads as a park with no clear observation.

**Expected Outcome**:
- Vocabulary growth is additive and fenced; the derived graph is a cache, and malformed state fails closed without a schema bump.

#### TC-VOCAB-002 - Five `queue` error rows synchronized in both directions

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, NFR-11, NFR-14, Appendix F
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (extend), `scripts/checks/error-table-sync.ts`, `tests/fixtures/queue/errors/**`
**Tags**: @checks, @errors, @sync

**Preconditions**:
- The new domain kind `queue` is declared; the documented error table is available.
- A fixture enumerates every reachable `queue` row.

**Steps**:
1. Assert exactly five `queue` rows exist: `queue.dependency-cycle`, `queue.lease-conflict`, `queue.park-condition-stuck`, `queue.entry.unobserved`, `queue.precondition.unmet`.
2. Assert each row's category, retryable, consequence, projection, and remediation hint match Appendix F and the documented table in both directions.
3. Assert each row is reachable by a test (no orphan row) and every reachable `queue` failure has a row (no orphan code).
4. Assert exit projection is `{0,1,2}` with the declared classes and `fallback.internal` containment.
5. Assert no existing row is renumbered, removed, or reinterpreted, and `queue ready` gains no row.
6. Run `bun run scripts/checks/error-table-sync.ts`; assert exit 0.

**Expected Outcome**:
- The machine table, documented table, source references, and fixtures agree exactly in both directions, with no drift and no existing-row change.

#### TC-VOCAB-003 - Collector-id set extends to `{tracker, lanes}`

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, AC-F11-2, NFR-11
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/behaviour/lanes.test.ts`
**Tags**: @structure, @collectors, @sync

**Preconditions**:
- The delivered collector-id declaration and the `status.collector.{id}.unavailable` family.

**Steps**:
1. Assert the closed set is exactly `{tracker, lanes}`.
2. Assert `status.collector.lanes.unavailable` resolves through the family with the unchanged family shape and exit-2 projection.
3. Assert a family code naming an undeclared id (e.g. `status.collector.board.unavailable`) is still unrecognized.
4. Assert `status.collector.tracker.unavailable` is unchanged.
5. Assert the documented collector set and the machine declaration agree.

**Expected Outcome**:
- One collector id is added with its row; the family shape and existing id are unchanged.

#### TC-VOCAB-004 - Typed `queue` configuration branch and defaults

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F3-2, AC-F8-2, NFR-10, Appendix E
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-park.test.ts`, `tests/fixtures/queue/config/**`
**Tags**: @structure, @config

**Preconditions**:
- The configuration catalog, layered resolver, and provenance surface.
- Valid, invalid, and absent `queue` branch fixtures.

**Steps**:
1. Assert the typed `queue` branch declares `queue.lease-ttl` (integer ms, default 90 000) and `queue.park-recheck.{provider-window,provider-quota,preemption}` (defaults 60 000 / 300 000 / 60 000).
2. Assert an absent branch resolves to the defaults with `defaults` origins.
3. Assert record-map merge and provenance match the delivered catalog rules.
4. Assert a non-integer, zero, or negative value is `config.value.invalid` naming the key; an unknown type key is `config.key.unknown`.
5. Assert no capacity, bandwidth, concurrency, CI-slot, or spend key exists or is reserved.

**Expected Outcome**:
- The configuration branch is typed, defaulted, provenance-visible, and free of any capacity policy.

#### TC-VOCAB-005 - Vocabulary sets are closed and stable

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-14, F-12, AC-F9-1, AC-F3-2
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/fixtures/queue/vocabulary/**`
**Tags**: @structure, @vocabulary

**Preconditions**:
- The delivered contract declarations and a snapshot of the closed sets.

**Steps**:
1. Assert the closed sets and their order: condition ids/order, `standard`/`heavy`, rank classes, the distinct park cause and condition-type sets with their one-to-one pairing, lane states, the blocking-reason vocabulary (including `repo-claimed-in-pass` as distinct from `lease-held` and `park-condition-stuck` as a reason, not a cause), record kinds, error rows, and configuration keys.
2. Assert no test or fixture introduces an undeclared value that the engine accepts.
3. Assert a growth attempt (an undeclared weight/rank/cause/state) is rejected or unrecognized, never silently accepted.
4. Assert `queue ready` condition ids, order, tri-state, and evidence reasons are unchanged.
5. Assert the inventory fails when a declared set changes without updating the fixture (the fixture is the executable contract).

**Expected Outcome**:
- Vocabulary is a closed, executable contract; growth requires a deliberate spec/fixture change, never drift.

#### TC-VOCAB-006 - Secret and payload safety across envelopes, records, findings, incidents

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-12, F-12, EVT-5, DM-14
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/queue-hermetic.test.ts`, `tests/checks/secret-read-boundary.test.ts` (extend), `tests/fixtures/queue/secret/**`
**Tags**: @checks, @security, @redaction

**Preconditions**:
- Synthetic canaries in provider responses, credentials, commit messages, and file content.
- The delivered redaction chokepoint and secret-read boundary.

**Steps**:
1. Run queue/lanes surfaces with canaries injected at the input seams; assert no canary byte appears in envelopes, records, findings, incidents, or evidence.
2. Assert no credential value, raw provider body, diff, file content, prompt, or transcript appears.
3. Assert incident and finding evidence is typed and bounded, never free-form prose.
4. Assert the redaction chokepoint covers the new payloads and the secret-read allowlist gains 0 entries.
5. Assert no new shell or child-process execution exists.

**Expected Outcome**:
- The new surfaces carry only bounded refs, keys, timestamps, and typed evidence; no secret or payload leak exists.

#### TC-COMPAT-001 - `queue ready` output and contract are byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F12-1, F-12, F-2, NG-4, NFR-11
**Test Type(s)**: Regression, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-*.test.ts` (extend), `tests/golden/queue-ready.test.ts` (extend), `tests/fixtures/queue-ready/**`
**Tags**: @backend, @queue-ready, @compat

**Preconditions**:
- The full existing `tests/fixtures/queue-ready/**` corpus and its golden machine and human outputs.
- The delivered `queue ready` command definition.

**Steps**:
1. Run the existing queue-ready corpus through the unmodified `ready` path; assert the machine payload is byte-identical to the committed golden.
2. Assert the human digest is byte-identical to the committed golden.
3. Assert the grammar (one subcommand, ≤ 32 refs, canonicalization) is unchanged.
4. Assert the six-condition ids, fixed order, tri-state, close association, ranking, caps, and read-only posture are unchanged.
5. Assert `queue ready` gains no error row and its exit projection is unchanged.
6. Assert the new `queue` subcommands are additive and do not alter `ready` dispatch.

**Expected Outcome**:
- `queue ready` is preserved verbatim and byte-identically; the scheduler consumes its vocabulary without changing the delivered surface.

## 6. Environments and Test Data

- **Runtime**: Bun (`bun test`) on the repository's pinned version; TypeScript strict mode; `pnpm check` is the aggregate gate. No test requires a live tracker, VCS, CI, provider, deploy trace, daemon, or credential.
- **Injected seams**: clock, single-writer fence/state transport (`StateStorePort` fake), tracker/pull-request/CI/provider reads, `verify deploy` verdict, economics fold, and repository-binding resolution. Scheduling policy is pure and receives facts as data.
- **Hermeticity**: zero live network calls, zero live credential reads, zero real sleeps, zero sockets. A throwing `globalThis.fetch` guard is armed for the queue/lanes suites; a missing fixture fails naming the missing fixture rather than silently skipping.
- **State**: temporary stores per test through `tests/fixtures/state/harness.ts` (temp root, injected edge, mutable clock, fence, verified reads); cleanup on exit. No test writes the repository's real state directory.
- **Time**: every park expiry, recheck boundary, lease TTL boundary, and heartbeat boundary is an exact injected instant; boundary values are tested at `bound - 1`, `bound`, and `bound + 1`. All windows are UTC.
- **Concurrency**: deterministic, fixture-driven. The fence harness serializes append attempts and uses a barrier at the pre-fence readiness read; no real OS race, worker thread, or timer is used. The operation log asserts read-inside-fence ordering (GAP-T3).
- **Performance reference**: NFR-6 is measured on the reference CI class with warm-up; the measured baseline is recorded in §10. Local variance is not a regression (GAP-T6).
- **Golden data**: normalized JSON and human output under `tests/fixtures/queue/golden/**` and the existing `tests/fixtures/queue-ready/golden/**`; no absolute paths, wall-clock timestamps, or unstable ordering. Regeneration is an explicit command, never a blanket rewrite.
- **Security data**: canaries are synthetic and clearly non-secret; no real credential value is committed. Redaction fixtures are inert strings.

**Fixture and state-corpus needs** (proposed; delivery-bound names):

| Corpus | Contents | Proposed location |
|---|---|---|
| Queue graph | entries (with recorded roots), priorities, declared edges, edge to a ref with no entry, duplicate edge, cycle path, superseding entry, unresolved binding, replay pairs | `tests/fixtures/queue/graph/**` |
| Readiness | six-condition cases: deps union (tracker/declared/both), `dependency-unobserved`, repo-free live/none, `repo-claimed-in-pass` read projection, tier plan/label, owner labels, CI healthy/failed/pending/unknown/none, provider available/parked/unavailable | `tests/fixtures/queue/readiness/**`; reuse `tests/fixtures/queue-ready/**` |
| Leases | no lease, live, at-bound, stale, renewed, taken-over, duplicate acquisition, 50 distinct holders, torn/unreadable history, conflict evidence, repo-key variants (including synthetic userinfo), release/no-op, release+park, precondition cases | `tests/fixtures/queue/leases/**` |
| Parks | provider-window/quota/preemption condition types and the distinct cause set with pairings, clear/unclear, observation gap, durable `clear-observed` marker, stuck (prior observation), stuck-not-next-action, refused recovery, unreadable history, recheck variants | `tests/fixtures/queue/parks/**` |
| Plans | tier, `weightClass`, `defaultWeightClass`, producer/consumer interactions, deploy expectations, invalid/missing plan, unknown weight | `tests/fixtures/queue/plan/**`; reuse `tests/fixtures/plan/**` |
| Deploy verdicts | verified with evidence, unknown (never ran / stale), failed with step, unreadable trace, read-budget overflow, producer-root discovery across repositories (match, no match, collision), producer-config binding, missing/unreadable/invalid producer config | `tests/fixtures/queue/deploy/**`; reuse `tests/fixtures/verify-deploy/**` |
| Economics | restart counts, restart-loop amplification, missing-unique-progress warning, underivable value | `tests/fixtures/queue/economics/**`; reuse `tests/fixtures/economics/**` |
| Precedence corpus | generated mix of every gate, class, weight, park type, dependency role, priority and tie-break, in multiple input orders | `tests/fixtures/queue/precedence/**` |
| State ledgers | one seed per new kind, verified-empty store, wrong-kind/malformed record, torn tail, unreadable key | `tests/fixtures/queue/state/**` |
| Config | absent branch/defaults, lease-ttl variants, park-recheck variants, invalid values, unknown key | `tests/fixtures/queue/config/**`; reuse `tests/fixtures/config/**` |
| Errors/docs | five new rows across machine, documented, source, and fixture; collector ids | `tests/checks/error-table-sync.test.ts` fixtures; `tests/fixtures/queue/errors/**` |
| Golden | machine/human output for plan/list/claim/release/lanes/refusals/empty/degraded | `tests/fixtures/queue/golden/**`, `tests/fixtures/queue-ready/golden/**` |

## 7. Automation Plan and Implementation Mapping

All scenarios are **To Implement** in this change except where an existing suite is extended. Every TC below appears in §5.1 and §5.2.

| TC ID | Test file(s) to create or update | Execution | Status |
|---|---|---|---|
| TC-SCHED-001 | `tests/behaviour/queue-graph.test.ts` | `bun test tests/behaviour/queue-graph.test.ts` | To Implement |
| TC-SCHED-002 | `tests/behaviour/queue-graph.test.ts`, `tests/behaviour/queue-cli.test.ts` | `bun test tests/behaviour/queue-graph.test.ts tests/behaviour/queue-cli.test.ts` | To Implement |
| TC-SCHED-003 | `tests/behaviour/queue-readiness.test.ts` | `bun test tests/behaviour/queue-readiness.test.ts` | To Implement |
| TC-SCHED-004 | `tests/behaviour/queue-readiness.test.ts` | `bun test tests/behaviour/queue-readiness.test.ts` | To Implement |
| TC-SCHED-005 | `tests/behaviour/queue-readiness.test.ts` | `bun test tests/behaviour/queue-readiness.test.ts` | To Implement |
| TC-SCHED-006 | `tests/behaviour/queue-precedence.test.ts` | `bun test tests/behaviour/queue-precedence.test.ts` | To Implement |
| TC-SCHED-007 | `tests/behaviour/queue-precedence.test.ts` | `bun test tests/behaviour/queue-precedence.test.ts` | To Implement |
| TC-SCHED-008 | `tests/behaviour/queue-schedule.test.ts`, `tests/golden/queue-plan.test.ts` | `bun test tests/behaviour/queue-schedule.test.ts tests/golden` | To Implement |
| TC-SCHED-009 | `tests/behaviour/queue-schedule.test.ts`, `tests/golden/queue-list.test.ts` | `bun test tests/behaviour/queue-schedule.test.ts tests/golden` | To Implement |
| TC-SCHED-010 | `tests/behaviour/queue-lease.test.ts`, `tests/fixtures/queue/e2e/**` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-SCHED-011 | `tests/checks/queue-bounds.test.ts`, `tests/behaviour/queue-schedule.test.ts` | `bun test tests/checks/queue-bounds.test.ts tests/behaviour/queue-schedule.test.ts` | To Implement |
| TC-SCHED-012 | `tests/behaviour/queue-schedule.test.ts`, `tests/behaviour/lanes.test.ts` | `bun test tests/behaviour/queue-schedule.test.ts tests/behaviour/lanes.test.ts` | To Implement |
| TC-SCHED-013 | `tests/behaviour/queue-precedence.test.ts`, `tests/checks/queue-hermetic.test.ts` | `bun test tests/behaviour/queue-precedence.test.ts tests/checks/queue-hermetic.test.ts` | To Implement |
| TC-SCHED-014 | `tests/checks/queue-hermetic.test.ts` | `bun test tests/checks/queue-hermetic.test.ts` | To Implement |
| TC-SCHED-015 | `tests/behaviour/queue-graph.test.ts` | `bun test tests/behaviour/queue-graph.test.ts` | To Implement |
| TC-SCHED-016 | `tests/behaviour/queue-cli.test.ts`, `tests/golden/queue-envelope.test.ts` | `bun test tests/behaviour/queue-cli.test.ts tests/golden` | To Implement |
| TC-LEASE-001 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-LEASE-002 | `tests/behaviour/queue-lease-concurrency.test.ts`, `tests/fixtures/queue/leases/fence-harness.ts` | `bun test tests/behaviour/queue-lease-concurrency.test.ts` | To Implement |
| TC-LEASE-003 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-LEASE-004 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-LEASE-005 | `tests/behaviour/queue-lease.test.ts`, `tests/golden/queue-lease-conflict.test.ts` | `bun test tests/behaviour/queue-lease.test.ts tests/golden` | To Implement |
| TC-LEASE-006 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-LEASE-007 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-LEASE-008 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-LEASE-009 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/checks/queue-bounds.test.ts` | `bun test tests/structure/queue-scheduling-contract.test.ts tests/checks/queue-bounds.test.ts` | To Implement |
| TC-LEASE-010 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-LEASE-011 | `tests/behaviour/queue-lease.test.ts`, `tests/behaviour/queue-rank.test.ts` | `bun test tests/behaviour/queue-lease.test.ts tests/behaviour/queue-rank.test.ts` | To Implement |
| TC-LEASE-012 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-LEASE-013 | `tests/behaviour/queue-lease.test.ts` | `bun test tests/behaviour/queue-lease.test.ts` | To Implement |
| TC-WEIGHT-001 | `tests/behaviour/queue-weight.test.ts` | `bun test tests/behaviour/queue-weight.test.ts` | To Implement |
| TC-WEIGHT-002 | `tests/behaviour/queue-weight.test.ts` | `bun test tests/behaviour/queue-weight.test.ts` | To Implement |
| TC-WEIGHT-003 | `tests/behaviour/queue-weight.test.ts` | `bun test tests/behaviour/queue-weight.test.ts` | To Implement |
| TC-WEIGHT-004 | `tests/behaviour/queue-weight.test.ts` | `bun test tests/behaviour/queue-weight.test.ts` | To Implement |
| TC-DEPEND-001 | `tests/behaviour/queue-depend.test.ts` | `bun test tests/behaviour/queue-depend.test.ts` | To Implement |
| TC-DEPEND-002 | `tests/behaviour/queue-depend.test.ts` | `bun test tests/behaviour/queue-depend.test.ts` | To Implement |
| TC-DEPEND-003 | `tests/behaviour/queue-depend.test.ts` | `bun test tests/behaviour/queue-depend.test.ts` | To Implement |
| TC-DEPEND-004 | `tests/behaviour/queue-depend.test.ts` | `bun test tests/behaviour/queue-depend.test.ts` | To Implement |
| TC-DEPEND-005 | `tests/behaviour/queue-depend.test.ts` | `bun test tests/behaviour/queue-depend.test.ts` | To Implement |
| TC-DEPEND-006 | `tests/behaviour/queue-depend.test.ts` | `bun test tests/behaviour/queue-depend.test.ts` | To Implement |
| TC-RANK-001 | `tests/behaviour/queue-rank.test.ts`, `tests/golden/queue-rank.test.ts` | `bun test tests/behaviour/queue-rank.test.ts tests/golden` | To Implement |
| TC-RANK-002 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-rank.test.ts` | `bun test tests/structure/queue-scheduling-contract.test.ts tests/behaviour/queue-rank.test.ts` | To Implement |
| TC-RANK-003 | `tests/behaviour/queue-rank.test.ts` | `bun test tests/behaviour/queue-rank.test.ts` | To Implement |
| TC-RANK-004 | `tests/behaviour/queue-rank.test.ts` | `bun test tests/behaviour/queue-rank.test.ts` | To Implement |
| TC-RANK-005 | `tests/behaviour/queue-rank.test.ts` | `bun test tests/behaviour/queue-rank.test.ts` | To Implement |
| TC-RANK-006 | `tests/behaviour/queue-precedence.test.ts` | `bun test tests/behaviour/queue-precedence.test.ts` | To Implement |
| TC-PARK-001 | `tests/behaviour/queue-park.test.ts` | `bun test tests/behaviour/queue-park.test.ts` | To Implement |
| TC-PARK-002 | `tests/behaviour/queue-park.test.ts` | `bun test tests/behaviour/queue-park.test.ts` | To Implement |
| TC-PARK-003 | `tests/behaviour/queue-park.test.ts` | `bun test tests/behaviour/queue-park.test.ts` | To Implement |
| TC-PARK-004 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-park.test.ts` | `bun test tests/structure/queue-scheduling-contract.test.ts tests/behaviour/queue-park.test.ts` | To Implement |
| TC-PARK-005 | `tests/behaviour/queue-park.test.ts` | `bun test tests/behaviour/queue-park.test.ts` | To Implement |
| TC-PARK-006 | `tests/behaviour/queue-park.test.ts` | `bun test tests/behaviour/queue-park.test.ts` | To Implement |
| TC-PARK-007 | `tests/behaviour/queue-park.test.ts` | `bun test tests/behaviour/queue-park.test.ts` | To Implement |
| TC-PARK-008 | `tests/behaviour/queue-park.test.ts`, `tests/behaviour/queue-cli.test.ts`, `tests/fixtures/queue/parks/stuck-not-next-action/**` | `bun test tests/behaviour/queue-park.test.ts tests/behaviour/queue-cli.test.ts` | To Implement |
| TC-LANES-001 | `tests/behaviour/lanes.test.ts`, `tests/golden/lanes-list.test.ts` | `bun test tests/behaviour/lanes.test.ts tests/golden` | To Implement |
| TC-LANES-002 | `tests/behaviour/lanes.test.ts`, `tests/golden/lanes-show.test.ts` | `bun test tests/behaviour/lanes.test.ts tests/golden` | To Implement |
| TC-LANES-003 | `tests/behaviour/lanes.test.ts` | `bun test tests/behaviour/lanes.test.ts` | To Implement |
| TC-LANES-004 | `tests/behaviour/lanes.test.ts`, `tests/golden/lanes-watch-refusal.test.ts` | `bun test tests/behaviour/lanes.test.ts tests/golden` | To Implement |
| TC-LANES-005 | `tests/behaviour/lanes.test.ts` | `bun test tests/behaviour/lanes.test.ts` | To Implement |
| TC-LANES-006 | `tests/behaviour/lanes.test.ts`, `tests/checks/queue-bounds.test.ts` | `bun test tests/behaviour/lanes.test.ts tests/checks/queue-bounds.test.ts` | To Implement |
| TC-VOCAB-001 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-graph.test.ts` | `bun test tests/structure/queue-scheduling-contract.test.ts tests/behaviour/queue-graph.test.ts` | To Implement |
| TC-VOCAB-002 | `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts` | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Existing — Update |
| TC-VOCAB-003 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/behaviour/lanes.test.ts` | `bun test tests/structure/queue-scheduling-contract.test.ts tests/checks/error-table-sync.test.ts tests/behaviour/lanes.test.ts` | To Implement |
| TC-VOCAB-004 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-park.test.ts` | `bun test tests/structure/queue-scheduling-contract.test.ts tests/behaviour/queue-park.test.ts` | To Implement |
| TC-VOCAB-005 | `tests/structure/queue-scheduling-contract.test.ts` | `bun test tests/structure/queue-scheduling-contract.test.ts` | To Implement |
| TC-VOCAB-006 | `tests/checks/queue-hermetic.test.ts`, `tests/checks/secret-read-boundary.test.ts` | `bun test tests/checks/queue-hermetic.test.ts tests/checks/secret-read-boundary.test.ts` | Existing — Update |
| TC-COMPAT-001 | `tests/behaviour/queue-ready-*.test.ts`, `tests/golden/queue-ready.test.ts` | `bun test tests/behaviour/queue-ready-output.test.ts tests/golden` | Existing — Extend |

### 7.1 Phase-surface split (R-06)

**Rule.** Pure domain/state assertions land in the phase that owns the policy. CLI grammar, envelope shape, `result=`, `selectedRef`, `degraded[]`, and exit-projection assertions complete only where the command family lands: the **queue** family in plan Phase 7, the **lanes** family in plan Phase 6. A TC that spans both surfaces is **partial** in the earlier phase and must not be marked "full" before the command exists; the earlier phase's test gate runs only the rows it can actually exercise. No assertion is weakened by the split — each half is still required, just at its real surface.

| TC ID | Domain/state rows land in | CLI grammar/envelope/exit rows complete in | Split note |
|---|---|---|---|
| TC-SCHED-004 | Phase 3 | Phase 7 | readiness and read projection; `queue plan/list` invocation and reason projection |
| TC-SCHED-012 | Phase 3 (queue) / Phase 6 (lanes) | Phase 7 (queue) / Phase 6 (lanes) | read purity at the domain fold; command-level zero-write rows at the command families |
| TC-RANK-001 | Phase 3 | Phase 7 | ordering rows in Phase 3; `queue plan --next 2` and goldens in Phase 7 |
| TC-RANK-005 | Phase 3 (selection) / Phase 4 (claim enforcement) | Phase 7 | `selectedRef` and `no-eligible-action` envelope/exit rows |
| TC-LEASE-001 | Phase 4 | Phase 7 | single-flight state; `queue plan/list/claim` envelopes |
| TC-LEASE-002 | Phase 4 | Phase 7 | concurrency state; `result=` and exit-projection rows |
| TC-LEASE-004 | Phase 4 | Phase 7 | store/verification state; the `result=claimed` projection row |
| TC-LEASE-005 | Phase 4 | Phase 7 | conflict identity/evidence; golden and text-mode exit rows |
| TC-LEASE-006 | Phase 4 | Phase 7 | claim `state.*`; `queue list/plan` exit-2 rows |
| TC-LEASE-010 | Phase 4 | Phase 7 | release state/idempotence; `result=noop` and `degraded[]` |
| TC-LEASE-011 | Phases 4–5 | Phase 7 | holder refusal and release+park state; `--park` grammar and exit rows |
| TC-LEASE-012 | Phase 4 | Phase 7 | precondition reasons; claim exit/envelope |
| TC-LEASE-013 | Phase 4 | Phase 7 | renewal state; `result=renewed` envelope |
| TC-WEIGHT-004 | Phase 4 | Phase 7 | weight-cap state; claim exit/reason envelope |
| TC-SCHED-010 | Phase 4 | Phase 7 | plan→claim→release domain path; full CLI e2e |
| TC-PARK-001 | Phase 5 | Phase 7 | park resume/incident state; `queue claim` mutating-pass CLI |
| TC-PARK-002 | Phase 5 | Phase 7 | stuck finding/refusal state; `queue list/plan/claim` envelopes and exits |
| TC-PARK-007 | Phase 5 | Phase 7 | unreadable park state; `queue list/plan/claim` exit-2 rows |
| TC-RANK-004 | Phase 5 | Phase 7 | release+park state; `queue release --park` envelope/exit |
| TC-PARK-008 | Phase 5 | Phase 7 | hard exclusion and claim-refusal policy; reads/claim envelope rows |

The same rule applies to Phase 2 command rows: TC-SCHED-002's CLI `result=noop` half is already assigned to Phase 7 by the plan, and TC-SCHED-015's `queue add`/`queue list` rows complete there too when the family exists.

### 7.2 Implementation-order mapping (plan phases 1–8)

Reconciled with `chg-GH-237-plan.yaml`; the plan is the sequencing authority and this section names only what each phase can prove.

1. **Plan Phase 1 — vocabulary, typed configuration, error identities** → TC-VOCAB-001 structure rows, TC-VOCAB-002, TC-VOCAB-003 structure/sync rows, TC-VOCAB-004, TC-VOCAB-005; TC-LEASE-007 config half; TC-PARK-006 config half.
2. **Plan Phase 2 — declaration and graph folding** → TC-SCHED-001, TC-SCHED-002 state/graph half, TC-SCHED-015; TC-VOCAB-001 entry/dependency round-trip.
3. **Plan Phase 3 — readiness, gates, precedence, ranking** → TC-SCHED-003..007, TC-SCHED-011, TC-SCHED-012 queue half, TC-SCHED-013 determinism rows; TC-WEIGHT-001 scheduling half, TC-WEIGHT-002; TC-DEPEND-001..006; TC-RANK-001 behaviour rows, TC-RANK-002, TC-RANK-003, TC-RANK-005 selection rows, TC-RANK-006.
4. **Plan Phase 4 — leases, claim, release** → TC-LEASE-001..006, TC-LEASE-007 completes, TC-LEASE-008..013; TC-WEIGHT-001 completes, TC-WEIGHT-003, TC-WEIGHT-004; TC-SCHED-010 domain half; TC-RANK-005 claim rows.
5. **Plan Phase 5 — parks, incidents, stuck finding** → TC-PARK-001..008; TC-RANK-003 re-asserted, TC-RANK-004; TC-LEASE-011 release+park half; TC-VOCAB-001 lease/park/incident round-trip.
6. **Plan Phase 6 — lane view** → TC-LANES-001..006; TC-SCHED-012 lanes half; TC-VOCAB-003 lanes/exit-2 half.
7. **Plan Phase 7 — queue command family, envelopes, exits, hermetic battery** → TC-SCHED-002 CLI half, TC-SCHED-008, TC-SCHED-009, TC-SCHED-010 CLI e2e, TC-SCHED-014, TC-SCHED-016; TC-LEASE-005 golden half, TC-LEASE-006/010/011/012/013 command rows; TC-WEIGHT-004 command rows; TC-RANK-001 golden half, TC-RANK-004 command rows, TC-RANK-005 envelope rows; TC-PARK-001/002/007/008 command rows; TC-VOCAB-006; TC-COMPAT-001.
8. **Plan Phase 8 — documentation reconciliation and aggregate gate** → TC-VOCAB-002 documented-table direction and TC-COMPAT-001 byte-identical corpus re-verified after docs edits; all 66 TCs gate through `pnpm check`. No new TC in this phase.

**Mocking/injection requirements**: no `mock.module`; inject fakes for clock, fence/state transport, provider reads, deploy reads, economics input, and repository binding. The concurrency suite uses the scheduled fence harness, never real OS concurrency. Tests that need a lease conflict assert the operation log, not wall-clock timing. Tests that need a golden consume normalized output and fail naming a missing fixture rather than skipping.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **T-RSK-1 — Concurrency is algorithmic, not OS-level (RSK-1; GAP-T3)**: the fence harness proves the in-fence re-read and single-writer serialization under a forced interleaving, not real multi-process memory races. Mitigation: TC-LEASE-002 asserts the operation order and post-append verification; TC-LEASE-004 asserts the refusal paths with injected stores; review confirms the fence is held for the write duration only.
- **T-RSK-2 — "Configuration-only" is structural (NFR-10)**: TC-LEASE-007 and TC-PARK-006 change fixtures only, not source. Mitigation: each pair differs only in configuration and provenance reports the changed value; review confirms no source diff accompanies the behaviour change.
- **T-RSK-3 — Performance bound is environment-sensitive (NFR-6; GAP-T6)**: the 250 ms bound depends on the runner. Mitigation: warm-up, committed baseline, recorded measurement, and structural budget assertions that are environment-independent.
- **T-RSK-4 — Stuck-park storage seam is pinned (C-3; formerly GAP-T4/OQ-T4)**: the durable `clear-observed` marker is a `queue.park` record (`delivery.queue.park.v1`, key `queue.parks:<REF>`, fields `clearObservedAt`, `recoveryState`) appended by a mutating pass before recovery; a later `recovered` record supersedes it and reads never append. Mitigation: TC-PARK-002 seeds that exact record, asserts the marker precedes recovery, and asserts it survives a refused recovery; TC-PARK-008 proves the stuck park is a hard exclusion (never `resume-parked`, never in `nextActions`, never selected by a no-ref claim) with a zero-append claim refusal. No open question remains.
- **T-RSK-5 — Lane idle-reason names are delivery-bound (GAP-T5)**: the closed set's exact strings are not enumerated. Mitigation: TC-LANES-001 asserts membership in the declared set and absence of free-form text, not specific spellings.
- **T-RSK-6 — Delivery-bound names and locations (GAP-T7)**: module paths, record kinds, schema strings, error ids, and fixture names may be chosen in delivery. Mitigation: tests resolve seams through delivered contracts and fail naming a missing contract; behaviours, AC traces, and IDs remain pinned.
- **T-RSK-7 — Provider/deploy fixtures are committed approximations (RSK-4, GAP-T2)**: live-shape drift will not fail CI. Mitigation: normalization is defensive, every malformed class holds or fails closed, and a missing fixture fails loudly.
- **T-RSK-8 — Read-surface exit projection is pinned (C-1, C-7, AC-F10-3)**: `queue list`/`queue plan` exit 2 with the classified `state.*` identity and bounded evidence when lease or park history is unreadable/torn/unknown-kind, presenting no `data` sibling, partial view, or empty view as a schedule; a readable stuck park remains report-only at exit 0. Mitigation: TC-LEASE-006, TC-PARK-007, TC-SCHED-009, and TC-SCHED-016 assert both sides of the distinction and zero writes.
- **T-RSK-9 — AC-F3-1 is split (C-2)**: (a) read-only projection shows exactly one eligible action per repository, holds the remainder `repo-claimed-in-pass` before any lease exists, and names `lease-held` with holder/lease evidence once a lease exists; (b) mutating claims acquire exactly one `repo-exclusive` holder and refuse the rest with `queue.lease-conflict`, never `queue.precondition.unmet` for repository exclusivity. Mitigation: TC-LEASE-001 proves (a) and (b), TC-SCHED-004 proves the readiness/evidence and `repo-claimed-in-pass` side, and TC-LEASE-002 proves concurrent enforcement.
- **T-RSK-10 — No-ref claim selection is pinned (C-4, AC-F4-3)**: `queue claim` without a ref selects the top-ranked eligible action deterministically and names `selectedRef`; no eligible action refuses `queue.precondition.unmet` with reason `no-eligible-action` at exit 1 and zero appends; a stuck park is never a selectable candidate. Mitigation: TC-RANK-005 step 5 asserts selection, determinism, the empty-case refusal, and the stuck-park exclusion; TC-PARK-008 proves the exclusion end to end.
- **T-RSK-11 — Deploy expectations are producer-bound (C-6, AC-F6-2)**: expectations resolve from the producer repository's own config bound to its recorded key, discovered only from entry-recorded roots whose normalized remote exactly matches that key; no matching root, a two-root collision, or a missing, unreadable, or invalid matched config is `unknown` and holds the dependent `deploy-unverified`, never `not-declared` or `verified`, and the invocation's root is never substituted. Mitigation: TC-DEPEND-003/004 assert the multi-repository discrimination, the no-match and collision cases, and the fail-closed producer-config cases.
- **T-RSK-12 — Phase-surface split (R-06)**: the queue command family lands in plan Phase 7, so Phases 3–5 can prove only domain/state rows; asserting CLI envelopes or exits earlier would require undeclared front-loading. Mitigation: §7.1 marks every affected TC partial with the completing phase, each phase's gate names only the rows it can run, and no assertion is dropped — the CLI half is still required in Phase 7.

### 8.2 Assumptions

- The delivered state layer exposes `readRecords`, `append`, `acquireFence`, `releaseFence`, and `replaceDocument` with writer-neutral fence semantics; the lease can be written by whichever process holds the fence.
- The delivered plan artifact authoritatively provides tier, weight class, and producer/consumer interactions; a triage label is only a tier fallback.
- The delivered `verify deploy` verdict is the only deploy evidence, and `merge.deploy-expectations` is how a repository declares expectations.
- The delivered economics fold is the only source of restart counts and amplification; `null` is the honest answer when derivation fails.
- One runner per state directory (the host); the runner field is carried for a future containerized/remote executor.
- Owner gates and external waits are readiness blockers, not parks.
- A queue entry's repository key resolves at declaration time; a multi-repository project adds each change from its own checkout.
- `queue ready` remains the read-only surface and its contract is preserved.
- The daemon (M1-S18) and `dispatch` (M1-S9) will consume this capability rather than introduce a second implementation.

### 8.3 Open Questions and Findings

All contract findings surfaced by v1.0 of this plan are resolved by spec v1.1 §5.2 (C-1..C-7) and the DoR iteration-1 findings are resolved by spec v1.2 plus this plan's v1.2 remediation; one delivery-bound naming question remains open.

**DoR iteration-1 remediation note (2026-11-07).** Addressed in this test plan: **R-04** (stuck park is not a next action — TC-PARK-008), **R-06** (phase-surface split — §7.1 and 20 partial TC marks), **R-07** (50 distinct holders — TC-LEASE-002), **R-16** (TC-LANES-002 step-4 typo). Spec-side R-01/R-02/R-03/R-05/R-09/R-10 are reflected in the aligned TC assertions and coverage rows; R-08 and R-11 are spec/PM-record dispositions with no test-assertion change; the spec is the authority for those changes.

| ID | Question / Finding | Disposition (2026-11-07) | Owner |
|----|--------------------|--------------------------|-------|
| OQ-T1 | Read-surface exit projection on unreadable lease/park state. | **Resolved** — `queue list`/`queue plan` exit 2 with the classified `state.*` identity, bounded evidence, no success verdict, and no `data` sibling/partial/empty schedule; a readable stuck park remains report-only at exit 0 (C-1, C-7, AC-F10-3, NFR-13). | spec v1.1 |
| OQ-T2 | AC-F3-1 mixed `queue plan`/`queue list` with mutating claims. | **Resolved** — split into AC-F3-1(a) read-only projection and AC-F3-1(b) mutating single-holder enforcement (C-2). | spec v1.1 |
| OQ-T3 | AC-F10-2 "any mutating subcommand" included refusals. | **Resolved** — scoped to successful mutations; refusals project their own exit-1 identity (AC-F10-2, Appendix C, Appendix F). | spec v1.1 |
| OQ-T4 | Durable location of a prior-pass "observed clear" park fact. | **Resolved** — durable `clear-observed` `queue.park` record (`delivery.queue.park.v1`, key `queue.parks:<REF>`, `clearObservedAt`, `recoveryState`) appended before recovery and superseded by `recovered` (C-3, DM-5, EVT-4, Appendix D). | spec v1.1 |
| OQ-T5 | No-ref `queue claim` selection rule. | **Resolved** — top-ranked eligible action under Appendix B, deterministic, selected ref named in the envelope; no eligible action refuses `queue.precondition.unmet`, reason `no-eligible-action`, exit 1, zero appends (C-4, AC-F4-3, DEC-12). | spec v1.1 |
| OQ-T6 | Weight resolution when the plan is invalid, unreadable, or absent. | **Resolved** — `heavy` with `plan-unreadable`/`plan-absent` evidence, never `standard`; an invalid/unreadable plan also holds `tier-known` unknown (C-5, AC-F5-2, DEC-10). | spec v1.1 |
| OQ-T7 | Deploy-expectation resolution scope in a multi-repository state directory. | **Resolved** — producer repository's own configuration bound to its recorded repository key through the entry-recorded root; no match/collision/missing/unreadable/invalid → `unknown`, dependent holds `deploy-unverified` (C-6, DM-12, AC-F6-2, DEC-13). | spec v1.2 |
| OQ-T9 (DoR R-04) | What is a stuck park's schedule status, and can a no-ref claim select it? | **Resolved** — Appendix B step 7b makes it a hard exclusion carrying `park-condition-stuck`, never `resume-parked`, never in `nextActions`, never selected by a no-ref claim; a claim refuses at exit 1 with zero appends (F-7, F-8, AC-F8-1). TC-PARK-008 added. | spec v1.2 / test plan v1.2 |
| OQ-T10 (DoR R-06) | Which Phase 3–5 TCs can be "full" before the `queue` command family lands in Phase 7? | **Resolved** — none that assert CLI grammar/envelope/exit rows; §7.1 marks the affected TCs partial and names the completing phase. No assertion is weakened. | test plan v1.2 |
| OQ-T11 (DoR R-07) | Is "50 claims → 1 acquire / 49 refuse" satisfiable with alternating holders? | **Resolved** — no; a repeat claim by the winner renews. TC-LEASE-002 now pins 50 distinct holders → 1 acquire / 0 renew / 49 `queue.lease-conflict`. The spec owner has amended NFR-3 to qualify "50 distinct holders" and to state that a same-holder repeat claim renews. | test plan v1.2 |
| OQ-T12 (DoR R-16) | Typo in TC-LANES-002 step 4. | **Resolved** — "Assert no synthetic `L` ordinal identity is produced." | test plan v1.2 |
| OQ-T8 | Exact lane idle-reason strings and the final module/record/error names (GAP-T5, GAP-T7). | **Open** — delivery-bound naming; fixtures use declared names and renames are contract changes, not test changes. | delivery / naming lock |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | test-plan-writer | Initial plan from `chg-GH-237-spec.md` v1.0, `chg-GH-237-pm-notes.yaml`, the M1 design pack, the six seeded scenarios (SC-M1-08/09/10/11/17/17b), and the delivered queue-ready/state/plan/verify-deploy/economics/config/provider/result precedents. 65 TCs; all 18 ACs traced; all 14 NFRs traced; six explicit spec ambiguities recorded as findings rather than lowered assertions. |
| 1.1 | 2026-11-07 | test-plan-writer | **Amendment reconciliation against spec v1.1** (§5.2 C-1..C-7). Pinned read-surface fail-closed exit 2 and the report-only readable-stuck exception (AC-F10-3) in TC-LEASE-006, TC-PARK-007, TC-SCHED-009, TC-SCHED-016; deterministic no-ref claim selection and `no-eligible-action` refusal (AC-F4-3) in TC-RANK-005; unreadable/absent-plan weight → `heavy` (AC-F5-2) in TC-WEIGHT-002; producer-bound deploy expectations (AC-F6-2) in TC-DEPEND-003/004; durable `clear-observed` park marker (C-3) in TC-PARK-002; AC-F3-1(a)/(b) split in TC-LEASE-001/TC-SCHED-004. Coverage table now 22 ACs (18 prior + 4 added: AC-F4-3, AC-F5-2, AC-F6-2, AC-F10-3), zero gaps; OQ-T1..OQ-T7 resolved, OQ-T8 retained. TC count unchanged at 65. Hermetic fixture-driven concurrency and the M1-S9/M1-S18 exclusions preserved. |
| 1.2 | 2026-11-07 | test-plan-writer | **DoR iteration-1 remediation and spec v1.2 reconciliation.** R-07: TC-LEASE-002 now seeds 50 **distinct** holders, asserting exactly 1 acquisition, 0 renewals, and 49 `queue.lease-conflict` refusals, plus a same-holder renewal control; NFR-3's unqualified "1 acquires and 49 refuse" is reported to the spec owner, not silently weakened. R-06: added §7.1 phase-surface split; 20 TCs spanning Phases 3–5 are marked partial with their CLI grammar/envelope/`result=`/`selectedRef`/`degraded[]`/exit rows completing in plan Phase 7 (lanes rows in Phase 6). R-04: added TC-PARK-008 proving a stuck park is never `resume-parked`, never in `nextActions`, never selected by a no-ref claim, and refuses a claim at exit 1 with zero appends; added to coverage, index, details, automation mapping, and fixture corpus. Spec v1.2 alignment: `repo-claimed-in-pass` distinguished from `lease-held` (TC-SCHED-004/TC-LEASE-001); the distinct park cause/condition-type sets and one-to-one pairing (TC-PARK-004/TC-LEASE-011/TC-RANK-004); two-stage claim with `repo-free` excluded pre-fence (TC-LEASE-005/TC-LEASE-012); producer-root discovery and collision → `unknown` (TC-DEPEND-003/004); edge to a non-entry ref → `dependency-unobserved` (TC-SCHED-001/TC-DEPEND-001); AC-F8-1 interval scoping and no-engine gap case (TC-PARK-001/TC-PARK-005). R-16: corrected the TC-LANES-002 step-4 typo. Privacy-literal guard: replaced the committed credential-bearing connection-string literal with the non-credential placeholder `https://user:redacted@github.com/Owner/Repo`; `pnpm check:privacy-literals` passes for this file. TC count 65 → 66; all 22 ACs and 14 NFRs remain traced; M1-S9/M1-S18 exclusions unchanged. |

## 10. Test Execution Log

Populated during delivery and quality gates. No execution has occurred at authoring time.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | NOT RUN | Plan authored; delivery has not started. |
| — (authoring gate) | 2026-11-07 | PASS | `pnpm check:privacy-literals` exit 0, 2 691 files scanned, 0 violations; the test plan's connection-string literal was sanitized to the placeholder `https://user:redacted@github.com/Owner/Repo`. |
