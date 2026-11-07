---
id: chg-GH-241-coordinator-supervision
status: Updated
created: 2026-11-07T17:30:00Z
last_updated: 2026-11-07T20:00:00Z
owners: [engineering]
service: delivery-os
labels: [cli, supervision, session-lifecycle, state, blockers, harness, process-lifecycle, m1]
links:
  change_spec: ./chg-GH-241-spec.md
  change_test_plan: ./chg-GH-241-test-plan.md
  machine_plan: ./chg-GH-241-plan.yaml
summary: >
  M1-S23 coordinator supervision: deliver the `coordinator` command family
  (start/stop/status/tick) over a pure decision domain and an injected
  process-lifecycle port; recorded join-live/resume-context/spawn-fresh
  decisions that survive a supervisor restart and never re-execute closed-out
  work (SC-M1-25); artifact-evidence stuck detection with a sourced-progress
  prefill-safety veto and no CPU read; TERM-then-KILL with grace over the
  recorded handle after a `pid` + `processStartTimeMs` identity check; a
  durable per-epoch restart budget distinct from lane and economics; one
  classified owner-audience exhaustion question rendered first by index in
  the reserved escalation slot; strict isCoordinatorPickup wake (an absent
  status counts as open) with one persisted wake per question; a shared
  supervisor-regime descriptor and a state-dir append-only instance lease
  carried by durable `coordinator.fence` records; six config keys (including
  `coordinator.progress-bound`); six additive state records with
  STATE_SCHEMA_VERSION unchanged and a two-phase `coordinator.stuck` record;
  six error identities with the exact two-code two-segment allowlist
  (22→24, table 99→105); deterministic bounded output; and non-regression of
  the delivered status/brief/blockers/economics/lane surfaces. Aligned to
  specification v1.3 (48 ACs) and test-plan v1.3 (72 TCs).
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-241: M1-S23 Coordinator supervision

## Context and Goals

This plan delivers GH-241 against the change specification v1.3 (`chg-GH-241-spec.md`: F-1..F-10, 48 acceptance criteria, DEC-1..DEC-13, DM-1..DM-11, EVT-1..EVT-7, NFR-1..NFR-15, Appendix A..H) and the committed test plan v1.3 (`chg-GH-241-test-plan.md`: 72 TCs `TC-COORD-001..095`, 48/48 AC coverage, SC-M1-25 clause map in §3.4, file/command inventory in §7).

**Revision note (v1.3).** This revision applies the DoR iteration-2 findings (RF2-01..RF2-12) and the spec/test-plan v1.3 contracts. The lease is liveness-first: `alive=true` is held and refused regardless of age, `alive=false` is takeover-eligible, and the 2×`collection-interval` age fallback applies only when liveness is unknown. The claim/takeover is one fenced critical section (`acquireFence` → re-read the fold and `alive(handle)` → append one `acquired` or one `stale-takeover`, or refuse → `releaseFence`), with a claim-time `state.lock.busy` mapped to `coordinator.already-running` exit 2; `tick` shares that path and recovers a crashed holder; a `stale-takeover` is itself the new acquisition; a successful quiet tick appends exactly one lease pair and no other record. Every coordinator append uses the per-append state write fence helper (one `recoverFence` retry for an age-stale lock, else `state.lock.busy`/`state.write.failed`) with no `contracts/state.ts` change. v1 is foreground-only (a bare `start` is `fallback.invocation` exit 1 naming `--foreground` and the M1-S18 seam; `detached` is reserved and never produced; the supervisor records its own `pid`/`processStartTimeMs`). The payload separates the persisted `data.stuck` verdict from the per-tick `tickVerdict` (nullable `phase`/`reason`/`evidence` when `progressing`). Every coordinator fold orders by ledger sequence; `stuckId = iterationId` and a replay appends nothing. It adds TC-093, TC-094, and TC-095 at the Phase-6 command gate, and moves TC-040 from Phase 5 to Phase 6 so Phase 3 owns the record pair via the state API, Phase 5 returns only the adapter outcome, and Phase 6 owns the end-to-end `phase=outcome` append and budget check.

The delivery order follows the dependency chain:

1. **Contracts and the error family first** — the error-table sync gate blocks every later commit; the exact two-code allowlist and the 99→105 documented table must be green before domain, state, or CLI work lands.
2. **Pure domain second** — decisions are fixture-testable with zero I/O, so the highest-risk logic (stuck conjunction, ordinal accounting, predicate-bound wake) is proven before any adapter or command exists.
3. **Additive state records third** — the durable decisions, budget, stuck verdicts, exhaustion receipt, wake dedupe, and fence records are the crash-safety contract.
4. **Config, process port, CLI composition, and status/brief rendering** — each on its own boundary.
5. **Integration, determinism, privacy, performance, and SC-M1-25** — prove the assembled surface end to end.
6. **Registry, docs, changeset, gates, and release pinning** — close the change.

The goal is not merely to pass tests: it is to make the last unmanaged actor in the M1 end state supervised, so the bash `ceo-loop.sh` has a typed replacement and M4-S5 can retire it. The plan therefore treats each absence (`no CPU read`, `no model call`, `no re-execution`, `no duplicate wake`, `no silent exhaustion`, `no OS installer`) as something proven by capability absence, zero recorded invocation, and zero state mutation — never by a single happy-path assertion.

### Coverage summary

| Phase | TCs mapped | Primary ACs |
|---|---:|---|
| 1 Contracts + errors + result-contract sync | 3 | AC-F10-1, AC-F10-2 |
| 2 Pure coordinator domain | 4 | AC-F3-1/2/3, AC-NFR-3 |
| 3 Additive state records and recorded decisions | 14 | AC-F2-1..3, AC-F3-1/3, AC-F5-1/2/4, AC-F8-1, AC-F10-3 |
| 4 Config branch | 2 | AC-F10-1, AC-F5-2/3 |
| 5 Process-lifecycle port, identity check, new-turn mapping | 3 | AC-F3-1/2/3, AC-F4-3, AC-F10-4 |
| 6 CLI family + edge | 35 | AC-F1-1..4, AC-F2-4/5, AC-F3-3, AC-F4-1..4, AC-F5-3/4/5, AC-F6-1..3, AC-F7-1..6, AC-F8-1/3/4/5/6, AC-F9-1, AC-F10-2..4 |
| 7 Reserved escalation slot + consumer docs | 2 | AC-F6-1, AC-NFR-4 |
| 8 Integration + SC-M1-25 | 6 | AC-NFR-1..4, AC-F10-5 |
| 9 Registry + man page + changeset | 0 | (feeds TC-092 at Phase 10) |
| 10 Gates + release + spec reconciliation | 3 | AC-F8-2, AC-F10-2/5, AC-NFR-1 |
| **Total** | **72** | **48/48 covered** |

## Pinned non-negotiables

These are binding on every phase; a change to any of them reopens the test plan (GAP-T1) and requires `@pm` / `@decision-advisor` routing.

1. **Error allowlist exact.** Exactly `coordinator.already-running` and `coordinator.restart-budget-exhausted` are two-segment and join `RESERVED_TWO_SEGMENT_CODES` in **both** `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts`. Set 22→24; table 99→105. The other four coordinator identities are three-segment. No `coordinator.*` wildcard, no generic two-segment widening, a near-miss code remains rejected.
2. **Six records, additive, schema-neutral.** `coordinator.iteration`, `.restart`, `.stuck`, `.exhaustion`, `.wake`, `.fence` under `delivery.state.v1`; `STATE_SCHEMA_VERSION` unchanged; no migration, backfill, derived document, or separate instance record. `coordinator.stuck` is two-phase under one `stuckId` equal to the active expectation's `iterationId` (`phase=verdict` with `killOutcome=not-attempted` before the kill; `phase=outcome` after), folded latest-wins by **ledger sequence** (`recordedAt` is descriptive only); a replay appends nothing. Every coordinator fold — lease, stuck, last decision, and last wake — orders by ledger sequence.
3. **Instance lease, liveness-first and atomic, not a lifetime write fence.** Coordinator single-instance ownership is the append-only `coordinator.fence` lease (`acquired`, `released`, `stale-takeover`, `stop-requested`) folded from the latest record by ledger sequence into `instanceId`, `pid`, `holder`, `startedAt` (the acquisition record time), `supervisorMode` (`foreground` in v1; `detached` reserved and never produced), and `externalUnit` (`absent`). The claim/takeover is one fenced critical section: `acquireFence` → re-read the lease fold and `alive(handle)` → append one `acquired` (released/absent) or one `stale-takeover` (dead holder), or refuse → `releaseFence`; a claim-time `state.lock.busy` is `coordinator.already-running` exit 2 with the holder named when readable. Liveness is decided before age: `alive=true` is held/refused regardless of lease age; `alive=false` is takeover-eligible; `alive` unknown/unavailable uses the 2×`collection-interval` age fallback only. `start` and `tick` share that path, so a crashed holder is recovered by `tick`; a `stale-takeover` is itself the new acquisition and is never followed by `acquired`. A successful (claiming) tick appends exactly one lease pair and no other record even when the cycle is otherwise quiet; a refused tick appends nothing; there is no heartbeat or lease-refresh record. Every append uses the per-append state write fence helper (one `recoverFence` + one retry on an age-stale `state.lock.busy`, else `state.lock.busy`/`state.write.failed`); the delivered state write fence is never held across a cycle. `stop` is a request (`requested=true`, `released=false`); the live supervisor appends `released`. No `contracts/state.ts` change.
4. **Decision before action.** The lifecycle decision, session identity, context reading (or explicit absence), reason, ordinal consumption, and iteration identity are recorded before attach/resume/spawn. A supervisor restart reconstructs the same truth; closed-out phase/merge/answer artifacts are never re-executed.
5. **Ordinal accounting exact.** `join-live` consumes none. `resume-context` consumes one. `spawn-fresh` consumes one for `context-pressure`, `context-unknown`, `session-interrupted`; none for `initial-start` and `clean-iteration-end`.
6. **Stuck is artifact evidence, never CPU.** The digest fingerprint is the state event-log cursor plus the open coordinator-audience question count only; no ready-to-merge/tracker/CI input. `digest-consumed` requires a fingerprint advance **and** a new session turn (positive `token-delta` OR `session-traffic` mapped by the adapter; absent = `unknown`). `merge` and `answer` are post-expectation records; positive sourced progress within `coordinator.progress-bound` vetoes a stuck verdict; `progressing` is not persisted; all-unknown or an unreadable required store is `unevaluable`/`evidence-unevaluable` with no kill or restart; a torn/gapped ordinal is never count `0`.
7. **Kill is bounded and safe.** Before TERM the port verifies the recorded `pid` plus `processStartTimeMs`; a mismatch sends no signal and records `killOutcome=failed` with `killFailureReason=identity-mismatch`. TERM on the recorded handle/tree, wait `coordinator.kill-grace`, conditional KILL, outcomes `terminated`/`forced`; `failed` is `coordinator.session.kill-failed` exit 2 with consequence `unknown`; no name/pattern kill, no shell interpolation, no kill without the current instance lease, and the outcome append takes the state write fence for that append only.
8. **Budget distinct and durable.** Namespace `coordinator/<coordinatorId>`; contiguous ordinals from 1 per budget epoch; below-bound appends one record and proceeds; at/above-bound starts no replacement, returns `coordinator.restart-budget-exhausted` exit 1 with history, and runs escalation; `start --fresh-budget` opens a new epoch at 0 while old history remains.
9. **Escalation loud and idempotent.** Exactly one owner-audience `decision-needed` question per `(coordinatorId, budgetEpochId)` with `lane=coordinator`, `ref=<coordinatorId>#<budgetEpochId>`, count/bound/history/options; the terminal receipt lands only after the question; publish failure is `coordinator.escalation.publish-failed` exit 2 with `exhausted-escalation-failed`; repeated ticks reuse the open question and return idempotent `exhausted-escalated` exit 0 (never `escalated`).
10. **Reserved slot is payload-only and first.** The digest `typed-questions` and brief `blocker-questions` render the escalation at index 0 under a reserved slot selected by `type=decision-needed` AND `audience=owner` AND `lane=coordinator` AND the ref shape (exactly one `#`, both sides non-empty). Up to seven other questions follow in rank order; the lowest-ranked is displaced and counted as omitted; the bound stays eight; no new section/anchor/type; no coordinator-state read.
11. **Wake is strict and persisted-on-success.** `isCoordinatorPickup` is rank 1, open (an absent status counts as open), audience coordinator. Only a successful `woken` appends a `coordinator.wake` record and consumes the one-wake-per-question lifetime; `already-woken` is a no-op; `answered-before-wake`, `delivery-failed`, and `no-pickup` are tick results that append nothing, so retry cannot duplicate records. `no-pickup` is only for a non-rank-1 head, a non-coordinator audience, or an explicitly non-open status. Dedupe key: coordinator id + question id + `askedAt`; the last-wake fold orders by ledger sequence.
12. **Capability ownership is four-way.** Harness resume undeclared/unavailable → `spawn-fresh` reason `session-interrupted`, one ordinal, exit 0, no error. Harness spawn impossible/refused → delivered `harness.capability.gap` / `harness.spawn.refused` exit 1. Process-port alive or kill-with-grace absent → `coordinator.process.capability-gap` exit 2, no destructive action. Progress absent → `unknown` evidence class, never an error and never by itself a kill.
13. **Pure and private.** No CPU read, no model call, no ambient clock/randomness/environment in any decision or render path; no prompt/transcript/secret/credential value in any record, evidence, status, or error; evidence is bounded `key=value` at ≤ 512 UTF-8 bytes; exits only `{0,1,2}`.
14. **Foreground-only v1 and split payload.** `coordinator start` requires `--foreground`; a bare `start` is `fallback.invocation` exit 1 naming `--foreground` and the M1-S18 detached/OS-unit seam. `supervisorMode` is exactly `foreground`, `detached` is a reserved closed value never produced, `externalUnit` is exactly `absent`, and the supervisor records its own `pid`/`processStartTimeMs`. `data.stuck` is the last persisted verdict with non-null `phase`/`reason`/`evidence`; the tick result carries a separate `tickVerdict` whose `phase`/`reason`/`evidence` are nullable when `verdict=progressing`.
15. **Out of scope.** No `daemon` command, control socket, lane supervision, OS installer, startup reconciliation (M1-S18); no `dispatch`/spawn loop (M1-S9); no prompt changes (M1-S20); no queue/merge/closeout/status-collector redesign; no reuse of `lane.restart-budget`, `lane.liveness-interval`, or `economics/<workItemRef>`. `ceo-loop.sh` stays byte-unchanged.

## Plan decisions and delivery-bound readings

| ID | Decision | Rationale |
|---|---|---|
| PL-1 | Extra phase metadata (tasks, verification, AC/TC ids) lives in YAML comments and this MD; the parsed YAML carries only `delivery.plan.v1` keys. | Unknown phase keys are ignored by the validator, but a machine plan should stay strictly schema-shaped; GH-236 established the comment-carrier precedent. `plan validate GH-241` returns `valid` and `readyForDevelopment=true`. |
| PL-2 | `doneArtifacts` is declared on Phase 10 only (PR, pipeline, tracker transition). | Every phase produces one commit + a green narrow gate, not a separate MR/pipeline/deploy. Inventing per-phase artifact values would fabricate delivery evidence. |
| PL-3 | The process-lifecycle adapter lives at `packages/adapters/src/harness/process-lifecycle.ts` and is exported from the existing harness subpath, not a new `packages/adapters/src/process/**` subpath. | The test plan names `packages/adapters/src/process/**` as *expected*; GAP-T5 makes module paths delivery-bound. The harness subpath satisfies “beside the harness adapters” with no new package exports, workspaceImports entry, dependency-cruiser rule, or boundary-rule loosening. |
| PL-4 | Domain/state module names are declared by the `coordinator*` glob, not guessed exact files. | Delivery owns export names and file splits (GAP-T5); the glob keeps `plan diff` classifying all coordinator modules `within` without pinning a spelling the spec does not pin. |
| PL-5 | All 72 TCs map to exactly one phase; none is dropped, merged away, or reshaped. | Resolves OQ-T7 / GAP-T1. A phase may share a test file with another phase (for example `coordinator-fresh-budget.test.ts` for TC-054 and TC-016, and `coordinator-kill-grace.test.ts` for the Phase-5 adapter half and the Phase-6 TC-040 composition); the TC itself maps once. |
| PL-6 | Phases 1–10 are all `delivery` kind (lease-taking). No `planning` phase is needed; the planning artifacts already exist. | A phase scope that writes code or docs is delivery; planning phases are lease-free by contract. |
| PL-7 | Performance (TC-088) is semi-automated: structural/read-cost/bounds assertions gate CI; the p95 wall-clock assertion runs behind the declared manual performance gate if CI cannot keep it deterministic. | GAP-T6; the bound is never relaxed or deleted. |

### Delivery-bound spellings pinned by this plan

The spec pins behaviour, identities, exits, vocabularies, bounds, and AC traceability; it does not pin every module spelling (GAP-T5). The following are declared now so delivery does not improvise:

- Contracts module: `packages/core/src/contracts/coordinator.ts` (one data-only home).
- Domain modules: `packages/core/src/domain/coordinator*.ts` (renderers included).
- State module: `packages/core/src/state/coordinator*.ts`.
- Adapter: `packages/adapters/src/harness/process-lifecycle.ts`, exported from `packages/adapters/src/harness/index.ts`; it owns the pre-TERM `pid` + `processStartTimeMs` identity check and the `token-delta`/`session-traffic` → `newTurn`/`progressing` mapping.
- CLI: `packages/cli/src/commands/coordinator.ts`, text renderer `packages/cli/src/output/coordinator-text.ts`, registered in `commands/index.ts` and composed in `edge.ts`.
- Record-kind strings and payload schema ids: `coordinator.<kind>` / `delivery.coordinator.<kind>.v1`, read from the contract in tests, never guessed by a test.
- Observation payload: `delivery.coordinator.v1` with the lease-folded `instance` shape.
- Config keys: `coordinator.stuck-window`, `.kill-grace`, `.restart-budget`, `.resume-context-limit`, `.collection-interval`, `.progress-bound`.
- New/moved test surfaces: `tests/behaviour/coordinator-instance-lease.test.ts` (TC-018, Phase 6), `tests/behaviour/coordinator-new-turn.test.ts` (TC-029, Phase 5), `tests/behaviour/coordinator-kill-grace.test.ts` (adapter-only half in Phase 5, TC-040 end-to-end composition in Phase 6), `tests/behaviour/coordinator-lease-liveness.test.ts` (TC-093), `tests/behaviour/coordinator-claim-race.test.ts` (TC-094), `tests/behaviour/coordinator-tick-takeover.test.ts` (TC-095), `tests/behaviour/coordinator-state-fence-recovery.test.ts` (per-append helper, Phase 3), `tests/fixtures/coordinator/claim-race.ts`, `tests/behaviour/coordinator-kill-identity.test.ts` (TC-045, Phase 6), `tests/structure/coordinator-regime.test.ts` and `tests/golden/coordinator.test.ts` (first created in Phase 6).
- Changeset: `.changeset/gh-241-coordinator-supervision-minor.md`.

## Phase 1 — Contracts, coordinator error family, and result-contract sync

**Goal.** Land the runtime-neutral coordinator vocabulary, the six-row error family, the exact two-code two-segment allowlist, and the documented-table companion in one commit so `error-table-sync` is green at this boundary.

**Tasks**

- [ ] 1.1 Create `packages/core/src/contracts/coordinator.ts` with the closed vocabularies from spec Appendix B: lifecycle decisions (`join-live`, `resume-context`, `spawn-fresh`, `none`), decision reasons, restart reasons, stuck verdicts, stuck phases, stuck reasons, evidence classes/states, kill outcomes, kill failure reasons, wake persisted outcomes vs tick results, four fence actions, escalation states, recovery options, six config key paths, six record-kind identifiers, six payload schema ids, the `delivery.coordinator.v1` observation payload types (including the lease-folded `instance` shape), the regime descriptor type, and the injected process-lifecycle port/capability declaration types. Data only, no runtime import. **(TC-COORD-001; DM-1..DM-11; AC-F10-1/2)**
- [ ] 1.2 Export the module from `packages/core/src/contracts/index.ts`; register it in `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/structure/port-contract-inventory.test.ts`, and `tests/fixtures/ports/v1-contract-inventory.json`. **(TC-COORD-001/002)**
- [ ] 1.3 Add `coordinator` to `DOMAIN_KINDS` exactly once and append exactly six rows to `ERROR_TABLE`: `coordinator.already-running`, `coordinator.restart-budget-exhausted`, `coordinator.process.capability-gap`, `coordinator.session.kill-failed`, `coordinator.escalation.publish-failed`, `coordinator.wake.delivery-failed`. Each row declares category, retryable, consequence, remediation hint, projection class, and summary per Appendix F. Zero existing rows modified. **(TC-COORD-081; DM-10; AC-F10-2)**
- [ ] 1.4 Add exactly `coordinator.already-running` and `coordinator.restart-budget-exhausted` to `RESERVED_TWO_SEGMENT_CODES` in **both** `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts`; set 22→24; no wildcard, no pattern widening, near-miss rejected, other four three-segment. **(TC-COORD-081/082; AC-F10-2; DEC-11)**
- [ ] 1.5 Add the six documented rows to `doc/spec/features/feature-result-contract.md` (99→105) and extend `tests/fixtures/result/code-corpora` true/false positives with the six codes. **(TC-COORD-082; NFR-12)**
- [ ] 1.6 Create `tests/structure/coordinator-contract.test.ts` and `tests/types/coordinator.type-test.ts`; extend `tests/structure/error-table.test.ts` and `tests/checks/error-table-sync.test.ts` with exact kind/row/count/projection/round-trip/near-miss assertions; add the data-only detector mutant. **(TC-COORD-001/081/082)**

**Verification**

```bash
bun test tests/structure/coordinator-contract.test.ts \
  tests/structure/error-table.test.ts \
  tests/checks/error-table-sync.test.ts
bun run scripts/checks/error-table-sync.ts
pnpm typecheck
```

Expected: `error-table-sync` green with **105** entries, **105** documented rows, six coordinator identities recognized, and the reserved two-segment set exactly **24** in both gate files. `coordinator` appears once in `DOMAIN_KINDS`; the six rows are unique; no delivered row changed.

**Exit criteria.** Contracts are data-only; every coordinator vocabulary has one home; the error family and documented table bind both ways; the two-code allowlist is exact; no wildcard or generic widening exists.

---

## Phase 2 — Pure coordinator supervision domain

**Goal.** Implement every deterministic decision as a pure function over injected facts: no I/O, clock, randomness, environment, CPU, process, or model call.

**Tasks**

- [ ] 2.1 Implement the lifecycle decision: `join-live` when the session is alive; `resume-context` when the prior session did not complete cleanly, is resumable, has a known context below `resume-context-limit`, and the harness declares resume; `spawn-fresh` for `context-pressure`, `context-unknown`, `session-interrupted`, `initial-start`, and `clean-iteration-end`. Ordinal accounting exact. Implemented here; the durable-record TCs land in Phase 3. **(AC-F2-1/2/3/6; DEC-7)**
- [ ] 2.2 Implement the artifact-evidence stuck verdict: bounded digest-input fingerprint over the state event-log cursor and open coordinator-question count only (no ready-to-merge/tracker/CI input); `digest-consumed` requires a fingerprint advance **and** a new session turn (positive `token-delta` OR `session-traffic` mapped by the Phase-5 adapter; absent = `unknown`); `merge`/`answer` are post-expectation records; advanced/stale/unknown totality; verified-empty store is `stale` zero; unreadable store is `unknown`; all-unknown or unreadable required store is `unevaluable`/`evidence-unevaluable`; positive sourced progress within `coordinator.progress-bound` vetoes `stuck`; `progressing` is not persisted; no CPU field exists. **(TC-COORD-032/033/034; AC-F3-1/2/3; DEC-4)**
- [ ] 2.3 Implement the restart admission fold over the current epoch: contiguous ordinals from 1; below-bound admits exactly one; at/above-bound refuses; torn/gapped ordinal is `unevaluable`, never count 0. Implemented here; ordinal/record TCs land in Phase 3. **(AC-F5-2; DM-2)**
- [ ] 2.4 Implement wake evaluation: strict `isCoordinatorPickup` (rank 1, open with an absent status counting as open, audience coordinator), persisted-vs-tick outcomes, dedupe by coordinator id + question id + `askedAt`, `answered-before-wake` when the question closes between ranking and wake, `no-pickup` only for a non-rank-1 head, a non-coordinator audience, or an explicitly non-open status. Implemented here; full tick/record TCs land in Phase 6. **(AC-F7-1/3/4; DEC-9)**
- [ ] 2.5 Implement the escalation projection: the payload-only reserved-slot predicate as one pure data predicate and the bounded owner-question projection (coordinator id, epoch, count, bound, history, options); the escalation state vocabulary is `not-exhausted`, `exhausted-escalated`, `exhausted-escalation-failed` (no `escalated`); no state read, no renderer dependency. Implemented here; render/record TCs land in Phases 6–7. **(AC-F6-1; DEC-5)**
- [ ] 2.6 Implement the regime projection and deterministic observation renderers: `delivery.coordinator.v1` data (including the lease-folded `instance`) and bounded ANSI-free human text (≤ 32 lines) for start/stop/tick/status; `supervisorMode` is exactly `foreground` in v1 (`detached` is a reserved closed value never produced) and `externalUnit` is exactly `absent`. The payload separates the last persisted `data.stuck` verdict from the per-tick `tickVerdict` (nullable `phase`/`reason`/`evidence` when `progressing`). Implemented here; command TCs land in Phase 6. **(AC-F9-1; AC-F8-2; NFR-1/4)**
- [ ] 2.7 Export from `packages/core/src/domain/index.ts`; add import guards and temp-copy mutants proving no `node:`/`bun:`, clock, random, env, fetch, timer, child-process, filesystem, CPU, or model read is reachable from the decision/render path. **(TC-COORD-037; AC-NFR-3)**
- [ ] 2.8 Add the tests fully provable at this boundary: `coordinator-no-cpu`, `coordinator-mutants`, `coordinator-stuck-fingerprint`, `coordinator-stuck-corroborator`, `coordinator-stuck-unknown`, and the domain-import scan; fixtures `tests/fixtures/coordinator/lifecycle.ts`, `evidence.ts`, and the recording `process-port.ts` fake (reused by Phases 3 and 5). **(TC-COORD-032/033/034/037)**

**Verification**

```bash
bun test tests/structure/coordinator-imports.test.ts \
  tests/structure/coordinator-no-cpu.test.ts \
  tests/checks/coordinator-mutants.test.ts
bun test tests/behaviour/coordinator-stuck-fingerprint.test.ts \
  tests/behaviour/coordinator-stuck-corroborator.test.ts \
  tests/behaviour/coordinator-stuck-unknown.test.ts
pnpm check:boundaries
```

Expected: the pure-domain and structure suites are green; the no-CPU/no-model/no-ambient mutants trip by file and kind; fingerprint-plus-turn is required for `digest-consumed`; positive progress vetoes `stuck`; an absent progress source is `unknown`, never stale.

**Exit criteria.** Every decision is pure and deterministic; the fingerprint/corroborator/unknown rules match the spec; the wake and escalation predicates are payload-only; no CPU/clock/env/process/model path exists. This phase deliberately does **not** claim record-persistence or CLI TCs; those are proven at the Phase 3 and Phase 6 gates.

---

## Phase 3 — Additive coordinator state records and recorded decisions

**Goal.** Implement the six record kinds over the delivered artifact boundary with validated appends, verified reads, contiguous-ordinal checks, and crash durability. No schema bump.

**Tasks**

- [ ] 3.1 Create `packages/core/src/state/coordinator*.ts`: `coordinator.iteration`, `.restart`, two-phase `.stuck`, `.exhaustion`, `.wake`, `.fence` with kind/schema/required-field/vocabulary validation; append through the delivered fenced artifact boundary with post-append coverage; verified reads; torn/unknown/gapped classification. Every fold (lease, stuck, last decision, last wake) orders by ledger sequence with `recordedAt` descriptive only; `stuckId = the active expectation's iterationId`, and a replay appends nothing. **(TC-COORD-083; AC-F10-3; EVT-1..7; DM-1..5, DM-11)**
- [ ] 3.2 Implement the restart ordinal fold per budget epoch: contiguous from 1; torn/gapped is `unevaluable`, never count 0; a replayed ordinal appends nothing; namespace is `coordinator/<coordinatorId>`, disjoint from lane and economics. **(TC-COORD-026/050/051/053; AC-F5-1/2/4; DEC-8)**
- [ ] 3.3 Implement the `coordinator.fence` carrier as the append-only instance lease: `acquired`, `stop-requested`, `released`, `stale-takeover` with `instanceId`, `holder`, `pid`, `processStartTimeMs`, `supervisorMode`, `externalUnit`, `previousHolder`, `fenceAgeMs`, `recordedAt`; durable and status-readable; the latest record by ledger sequence folds the instance identity (`startedAt` = its acquisition record time); no separate instance record; no heartbeat or lease-refresh record; a `stale-takeover` is itself the new acquisition and is never followed by `acquired`; a torn fence never yields a fabricated holder. Each append takes the delivered state write fence for that append only. Supports the Phase-6 TC-017/018 and lease TCs. **(AC-F1-1/3/4; AC-F8-1/3; EVT-7; DM-11)**
- [ ] 3.4 Implement the exhaustion receipt: one terminal receipt per `(coordinatorId, budgetEpochId)`, lands only after the escalation question, carries the count/history/question id/options/`terminal:true`, and is idempotent. Supports the Phase-6 escalation TCs. **(AC-F6-1/3; DM-4)**
- [ ] 3.5 Implement decision durability and mid-iteration artifact preservation: a fresh store handle over the same temp root reconstructs the decision, ordinal, closed-out phase/merge/answer artifacts, and does not re-execute them. Supports the Phase-6 recovery/durability TCs. **(AC-F2-4/5; NFR-7)**
- [ ] 3.6 Implement the fresh-budget epoch: `start --fresh-budget` opens a new epoch at 0 while the old epoch and escalation remain in history. Supports the Phase-6 fresh-budget TC. **(AC-F5-5)**
- [ ] 3.7 Add the recorded-decision tests over the now-durable records: `coordinator-decision-join/resume/spawn`, `coordinator-ordinals`; assert the decision + reason + session + context + ordinal + iteration are written before the effect, nothing is spawned/resumed on `join-live`, exactly one ordinal is consumed on `resume-context` and each recovery `spawn-fresh`, and none on `initial-start`/`clean-iteration-end`. **(TC-COORD-020/021/022/023/026)**
- [ ] 3.8 Add the persisted-stuck tests: `coordinator-stuck-verdict`, `coordinator-stuck-matrix`, `coordinator-stuck-torn`, `coordinator-expectation`, `coordinator-stuck-reason`; prove the two-phase record pair **through the state API only** — an injected ordering fact appends `phase=verdict` with `killOutcome=not-attempted`, then `phase=outcome` under the same `stuckId = iterationId`, folded latest-wins by ledger sequence, with replay appending nothing — plus the closed `reason` coupling, the 3×3×3 matrix, one active expectation per coordinator, and a torn/gapped store never read as zero/stale. Phase 3 does not compose the kill or budget check; the end-to-end `phase=outcome` append is Phase 6 (TC-040). **(TC-COORD-030/031/036/038/039)**
- [ ] 3.9 Add the remaining state tests: `coordinator-records`, `coordinator-restart-namespace`, `coordinator-restart-admit`, `coordinator-restart-durability`; extend `tests/structure/state-contract.test.ts` and `tests/fixtures/state/harness.ts`; add `tests/fixtures/coordinator/states.ts`. Fence, recovery, fresh-budget, and torn-status TCs are completed at the Phase-6 command surface. **(TC-COORD-050/051/053/083)**
- [ ] 3.10 Implement the per-append state write fence helper used by every coordinator append (fence records, both stuck phases, restart, exhaustion, wake): `acquireFence`; on `state.lock.busy` call the delivered `fenceStatus()`; when the lock is age-stale perform exactly one `recoverFence` and one retry; if still busy or non-stale return the delivered `state.lock.busy`; a failed append returns `state.write.failed`; release in `finally`. No `contracts/state.ts` change and no lifetime fence hold. Prove the helper in `tests/behaviour/coordinator-state-fence-recovery.test.ts`; command-level proof is TC-017/043 at the Phase-6 gate.

**Verification**

```bash
bun test tests/behaviour/coordinator-decision-*.test.ts \
  tests/behaviour/coordinator-ordinals.test.ts
bun test tests/behaviour/coordinator-stuck-verdict.test.ts \
  tests/behaviour/coordinator-stuck-matrix.test.ts \
  tests/behaviour/coordinator-stuck-torn.test.ts \
  tests/behaviour/coordinator-expectation.test.ts \
  tests/behaviour/coordinator-stuck-reason.test.ts
bun test tests/behaviour/coordinator-records.test.ts \
  tests/behaviour/coordinator-restart-namespace.test.ts \
  tests/behaviour/coordinator-restart-admit.test.ts \
  tests/behaviour/coordinator-restart-durability.test.ts \
  tests/behaviour/coordinator-state-fence-recovery.test.ts \
  tests/structure/state-contract.test.ts
```

Expected: the lifecycle decision is recorded before the effect and consumes the declared ordinal; all six record kinds round-trip and validate; the two-phase `coordinator.stuck` record folds latest-wins by **ledger sequence** (`recordedAt` descriptive only) under `stuckId = iterationId`, and a replay appends nothing; the per-append helper recovers one age-stale state fence and retries once, then returns `state.lock.busy`/`state.write.failed`; malformed records classify (`state.store.torn`/`state.store.unknown`) and are never served; permission denial is `state.permission.denied` exit 1; `STATE_SCHEMA_VERSION` is unchanged; lane/economics records are byte-unchanged; no `contracts/state.ts` change.

**Exit criteria.** Records are additive and validated; ordinals are contiguous; recorded decisions and the two-phase persisted stuck verdicts are durable with a ledger-sequence fold; the instance-lease records and exhaustion receipts are durable; the per-append fence helper recovers one age-stale lock and otherwise fails closed; no migration, derived document, separate instance record, or heartbeat record exists. Command-level lease, recovery, fresh-budget, and torn-status proofs land at the Phase-6 gate.

---

## Phase 4 — Coordinator config branch

**Goal.** Add the six coordinator keys to the delivered config catalog/defaults/schema with declared domains; decisions read resolved values, never literals.

**Tasks**

- [ ] 4.1 Add `coordinator.stuck-window` (600000 ms, integer > 0), `coordinator.kill-grace` (20000 ms, integer > 0), `coordinator.restart-budget` (10, integer ≥ 0), `coordinator.resume-context-limit` (100000 tokens, integer > 0), `coordinator.collection-interval` (30000 ms, integer > 0), and `coordinator.progress-bound` (300000 ms, integer > 0) to `catalog.ts`, `defaults.ts`, and `schema.ts` with provenance. **(TC-COORD-080; AC-F10-1; DEC-10; DM-6)**
- [ ] 4.2 Wire resolution into the lifecycle, stuck, admission, wake, and progress-veto decisions; no default or bound literal in decision code; no alias to `lane.restart-budget`, `lane.liveness-interval`, or `daemon.heartbeat-cycle`. **(TC-COORD-056/080; AC-F10-1; AC-F5-2/3)**
- [ ] 4.3 Add `coordinator-config` (six keys; absent/explicit/unknown/invalid/boundary), `coordinator-budget-config` (0/1/10, observed at evaluation), the `progress-bound` default and 1 ms boundary, extend `tests/structure/config-contract.test.ts`, and add fixture roots. **(TC-COORD-056/080)**

**Verification**

```bash
bun test tests/behaviour/coordinator-config.test.ts \
  tests/behaviour/coordinator-budget-config.test.ts \
  tests/structure/config-contract.test.ts
bun run scripts/checks/ambient-globals.ts
```

Expected: defaults and domains exact; unknown key → `config.key.unknown`; wrong type/domain → `config.value.invalid`; budget 0 admits no restart and escalates; the progress bound defaults to 300000 ms and vetoes within the window; no decision-code literal; no cross-key aliasing.

**Exit criteria.** Six keys, six defaults, six domains; provenance recorded; policy is data; boundary values (0, 1 ms) behave; the coordinator interval is distinct from the daemon and lane intervals; `coordinator.progress-bound` is the veto window used by Phase 5.

---

## Phase 5 — Injected process-lifecycle port and adapters

**Goal.** Implement spawn/attach, alive, kill-with-grace, and sourced progress beside the harness adapters with an injected child-process runner; keep the domain pure and the delivered harness session port unchanged.

**Tasks**

- [ ] 5.1 Create `packages/adapters/src/harness/process-lifecycle.ts`: resolve the recorded session/process-tree handle, alive probe, pre-TERM `pid` + `processStartTimeMs` identity verification (mismatch sends no signal and returns `failed` with `killFailureReason=identity-mismatch`), TERM → wait `kill-grace` → conditional KILL, closed `terminated`/`forced`/`failed`, sourced-progress facts, and capability declarations/gaps. The adapter returns the closed outcome **only**: it appends no coordinator record, does not compose the `phase=outcome` append, and does not run the budget check; those are Phase 6 (TC-040). The child-process runner is injected. No name/pattern kill and no shell interpolation. **(TC-COORD-042; implements AC-F4-1/3/4 behavior, proved end to end by TC-040/045 at the Phase-6 gate; NFR-10/14)**
- [ ] 5.2 Export from `packages/adapters/src/harness/index.ts`; no new package subpath, dependency, or boundary-rule change. Supports the Phase-8 full-surface boundary test and TC-COORD-085. **(TC-COORD-085; AC-F4-3)**
- [ ] 5.3 Map the delivered harness liveness report to the domain facts: a positive `token-delta` OR positive `session-traffic` reading is `newTurn=true`/`progressing=true`; zero/negative is `false`; absent or unsupported is `unknown` (never zero). `coordinator.progress-bound` is the config-driven veto window. The mapping lives only in the adapter. **(TC-COORD-029; AC-F3-1/2/3; DEC-4; DM-7)**
- [ ] 5.4 Enforce capability ownership: missing alive or kill-with-grace → `coordinator.process.capability-gap` exit 2 with zero kill calls and zero restart records; resume uses the delivered harness resume as a decision input (no error), spawn uses the delivered harness identities, and progress absence is the `unknown` evidence class. **(TC-COORD-044 at the Phase-6 gate; AC-F10-4; DEC-11)**
- [ ] 5.5 Add the adapter-level `coordinator-kill-grace` (TERM/grace/KILL outcome and identity failure with **no record append**), `coordinator-kill-target`, `coordinator-new-turn`, the structure `coordinator-kill-target` scan, `tests/boundaries`, and the recording fake `tests/fixtures/coordinator/process-port.ts` with a fake clock, TERM/KILL phase log, matching/mismatched `pid` + `processStartTimeMs`, and positive/zero/absent liveness readings. The end-to-end kill-failed, kill-fence, capability-gap, identity-exit, and two-phase composition TCs land at the Phase-6 gate. **(TC-COORD-029/042/085)**

**Verification**

```bash
bun test tests/behaviour/coordinator-kill-grace.test.ts \
  tests/behaviour/coordinator-kill-target.test.ts \
  tests/behaviour/coordinator-new-turn.test.ts \
  tests/structure/coordinator-kill-target.test.ts
bun test tests/boundaries
pnpm check:boundaries
```

Expected: TERM → grace → conditional KILL is exact; a `pid`/start-time mismatch sends no signal; a failed kill is classified; the target is the recorded handle/tree only; the adapter returns the outcome without appending a record or running the budget check; `token-delta`/`session-traffic` map to `newTurn`/`progressing` and absent maps to `unknown`; no shell/network/privilege path.

**Exit criteria.** Kill is testable and safe at the adapter boundary; identity is verified before TERM; the fake port is non-vacuous (declared `failed` outcomes, phase log, matching/mismatched identity); capability gaps are classified; the harness session port is unchanged; adapter confinement holds; the new-turn mapping is adapter-local; the two-phase append and budget composition are explicitly deferred to Phase 6 (TC-040).

---

## Phase 6 — Coordinator CLI family and edge composition

**Goal.** Compose the command family over injected state, config, process, blocker, clock, id, brand, and harness seams. The handler is pure (no stream writes, no exit literals); the edge is the only writer and the only exit projector.

**Tasks**

- [ ] 6.1 Create `packages/cli/src/commands/coordinator.ts`: `start --foreground [--fresh-budget]`, `stop`, `status [--live]`, `tick`; closed grammar. v1 is foreground-only: a bare `start` without `--foreground` returns `fallback.invocation` exit 1 naming `--foreground` and the M1-S18 detached/OS-unit seam; `supervisorMode` is exactly `foreground`, `detached` is reserved and never produced, `externalUnit` is `absent`, and the supervisor records its own `pid`/`processStartTimeMs`. `delivery.coordinator.v1` data includes the lease-folded `instance`, the last persisted `data.stuck` verdict, and the separate `tickVerdict` (nullable `phase`/`reason`/`evidence` when `progressing`); deterministic bounded text renderer in `packages/cli/src/output/coordinator-text.ts`. **(TC-COORD-003/004; AC-F1-1; AC-F9-1; AC-F8-2)**
- [ ] 6.2 Compose in `packages/cli/src/edge.ts`: state dir + instance lease + per-append state write fence, config, fake-able process port, blocker verified read/append, injected clock, ids, brand, harness session facts; register exactly one `coordinator` family in `commands/index.ts`; no `daemon`, `dispatch`, or `supervise` command. **(TC-COORD-003/004)**
- [ ] 6.3 Instance-lease semantics: `start` and `tick` share **one** claim/takeover critical section — `acquireFence` → re-read the lease fold and `alive(handle)` under the fence → append one `acquired` (released/absent) or one `stale-takeover` (dead holder), or refuse → `releaseFence`. Decide liveness **before** age: `alive=true` is held and refused `coordinator.already-running` exit 2 regardless of lease age; `alive=false` is takeover-eligible; `alive` unknown/unavailable uses the 2×`collection-interval` age fallback only. A claim-time `state.lock.busy` maps to `coordinator.already-running` exit 2 with the holder named when the lease is readable. A `stale-takeover` is itself the new acquisition (new `holder`/`pid`/`processStartTimeMs`, `previousHolder`, `fenceAgeMs`) and is **never** followed by a second `acquired`. `start` appends the acquisition; `stop` appends `stop-requested` and reports `requested=true`/`released=false` (or `not-running` at exit 0 when the lease is `released`, the holder is dead, or liveness is unknown and age > 2×interval), never releases another process's handle; the live supervisor appends `released` at the next cycle boundary. A successful (claiming) tick appends exactly one lease pair (`acquired`+`released` or `stale-takeover`+`released`) and no other quiet record; a refused tick appends nothing; no heartbeat/refresh record exists. Every append uses the Phase-3 per-append state write fence helper; no `recoverFence` for the lease decision and no `contracts/state.ts` change; the latest record by ledger sequence folds the instance identity and no separate instance record exists. **(TC-COORD-010/011/012/015/017/018/093/094/095; AC-F1-1/2/3/4; AC-F8-1/3/4/5/6; DM-11)**
- [ ] 6.4 Lifecycle application and two-phase stuck composition: `join-live`/`resume-context`/`spawn-fresh`; killed-mid-iteration recovery without re-executing closed-out work; `--fresh-budget` only when stopped; `status` reports the lease-folded instance, lease action, durable decision/restart, the last persisted stuck verdict with non-null `phase`/`reason`/`evidence`, the separate tick verdict, wake, and escalation, and degrades `--live` honestly; `stuck-unevaluable`, torn/gapped budget, failed kill, PID mismatch, and capability gaps return the delivered identity at exit 2 with no unsafe action. The supervisor — not the adapter — composes the end-to-end kill sequence: `phase=verdict` with `killOutcome=not-attempted` is appended before the kill; after the adapter returns `terminated`/`forced`/`failed`, append `phase=outcome` under the same `stuckId = iterationId` (ledger-sequence fold) and only then run the budget check. **(TC-COORD-012/013/014/016/024/025/035/040/041/043/044/045/054/055; AC-F1-2; AC-F2-4/5; AC-F3-3; AC-F4-1..4; AC-F5-4/5; AC-F8-2; AC-F9-1; AC-F10-3/4)**
- [ ] 6.5 Escalation and wake integration: exactly one owner `decision-needed` question, terminal receipt after the question, publish failure exit 2 with `exhausted-escalation-failed`, idempotent reuse returning `exhausted-escalated` (never `escalated`); the delivered blocker append acquires its own state write fence and composes without a lock collision (no `packages/core/src/state/blockers.ts` change); strict pickup wake with an absent status counting as open and persisted `woken` only; `already-woken`/`answered-before-wake`/`delivery-failed`/`no-pickup` as tick results (`no-pickup` only for a non-rank-1 head, a non-coordinator audience, or an explicitly non-open status); retry without duplicate records. **(TC-COORD-052/060/061/062/065/070/071/072/073/074/075; AC-F5-3; AC-F6-1..3; AC-F7-1..6)**
- [ ] 6.6 Add the CLI tests: `coordinator-grammar`, `coordinator-envelope`, `coordinator-start`, `coordinator-stop`, `coordinator-tick`, `coordinator-status`, `coordinator-instance-lease`, `coordinator-fence-records`, `coordinator-fence-stale`, `coordinator-lease-liveness`, `coordinator-claim-race`, `coordinator-tick-takeover`, `coordinator-kill-grace` (end-to-end two-phase composition and budget), `coordinator-decision-durability`, `coordinator-decision-recovery`, `coordinator-fresh-budget`, `coordinator-restart-exhausted`, `coordinator-restart-torn`, `coordinator-stuck-unevaluable`, `coordinator-kill-failed`, `coordinator-kill-fence`, `coordinator-kill-identity`, `coordinator-capability-gap`, `coordinator-escalation-publish/idempotent/failed/reuse`, `coordinator-wake-pickup/answered/dedupe/paths/failed/next`; assert the persisted-`data.stuck`/`tickVerdict` split, the liveness-first matrix, the two-handle claim race and forced `state.lock.busy`, the quiet-tick single lease pair, and the dead-holder tick recovery. Add `tests/structure/coordinator-regime.test.ts` and `tests/golden/coordinator.test.ts`; extend `tests/checks/exit-code-literals.test.ts`; add fixtures `harness.ts`, `blockers.ts`, `claim-race.ts`, and the liveness/crashed-holder roots. **(all Phase-6 TCs)**

**Verification**

```bash
bun test tests/behaviour/coordinator-grammar.test.ts \
  tests/behaviour/coordinator-envelope.test.ts \
  tests/checks/exit-code-literals.test.ts
bun test tests/behaviour/coordinator-start.test.ts \
  tests/behaviour/coordinator-stop.test.ts \
  tests/behaviour/coordinator-tick.test.ts \
  tests/behaviour/coordinator-status.test.ts \
  tests/behaviour/coordinator-instance-lease.test.ts \
  tests/behaviour/coordinator-fence-records.test.ts \
  tests/behaviour/coordinator-fence-stale.test.ts \
  tests/behaviour/coordinator-lease-liveness.test.ts \
  tests/behaviour/coordinator-claim-race.test.ts \
  tests/behaviour/coordinator-tick-takeover.test.ts \
  tests/behaviour/coordinator-kill-grace.test.ts \
  tests/behaviour/coordinator-decision-durability.test.ts \
  tests/behaviour/coordinator-decision-recovery.test.ts \
  tests/behaviour/coordinator-fresh-budget.test.ts \
  tests/behaviour/coordinator-restart-torn.test.ts \
  tests/behaviour/coordinator-stuck-unevaluable.test.ts
bun test tests/behaviour/coordinator-restart-exhausted.test.ts \
  tests/behaviour/coordinator-kill-failed.test.ts \
  tests/behaviour/coordinator-kill-fence.test.ts \
  tests/behaviour/coordinator-kill-identity.test.ts \
  tests/behaviour/coordinator-capability-gap.test.ts \
  tests/structure/coordinator-regime.test.ts \
  tests/golden/coordinator.test.ts \
  tests/behaviour/coordinator-escalation-*.test.ts \
  tests/behaviour/coordinator-wake-*.test.ts
```

Expected: exactly one bounded envelope and one `{0,1,2}` exit per outcome; the instance lease appends `acquired`/`stop-requested`/`released`/single `stale-takeover` (never followed by `acquired`) with a per-append state write fence; liveness is decided before age; the claim is one fenced critical section; a claim-time `state.lock.busy` is `already-running`; `tick` shares the claim/takeover and recovers a dead holder; a successful quiet tick appends exactly one lease pair and no other record; the instance identity folds by ledger sequence and a second supervisor is refused; no heartbeat/refresh record and no `recoverFence` for the lease decision; the command family is closed and foreground-only; the payload schema is `delivery.coordinator.v1` with persisted `data.stuck` split from `tickVerdict`; `tick` is a one-shot cycle with no timer/daemon; recovery does not re-execute closed-out work; the end-to-end two-phase stuck append and budget check are composed here; `unevaluable`/torn budget/identity mismatch exit 2 with the state identity and no unsafe action; escalation is `exhausted-escalated`; wake is strict with absent status open.

**Exit criteria.** The command family matches Appendix G and v1 is foreground-only; every Appendix F outcome maps to one identity and one exit; no handler stream write or exit literal; the instance lease is liveness-first and atomically claimed, and is the only gate to a cycle and to a kill; lease-record history is durable and the instance identity folds by ledger sequence; a dead holder is recoverable by `tick`; recovery preserves closed-out artifacts; `unevaluable`/torn state and PID mismatch are fail-closed; the persisted-stuck/`tickVerdict` split, two-phase stuck composition, wake, and escalation behaviours are pinned.

---

## Phase 7 — Reserved owner-escalation slot and consumer docs

**Goal.** Add one bounded rendering rule to the delivered digest and brief: an open owner `decision-needed` coordinator question renders under a reserved slot inside the eight-question bound, selected from the payload alone.

**Tasks**

- [ ] 7.1 Add the payload-only reserved-slot predicate as one contracts datum: `type === "decision-needed"` AND `audience === "owner"` AND `lane === "coordinator"` AND `ref` matches `<coordinatorId>#<budgetEpochId>` with exactly one `#` and both sides non-empty. No coordinator-state read. **(TC-COORD-063; AC-F6-1; DEC-5)**
- [ ] 7.2 Update `packages/core/src/domain/status.ts`: render the reserved question at index 0 first, then at most seven other questions in normal rank order; the lowest-ranked is the one displaced and counted as omitted; preserve omitted/truncated counts, section ids, and evidence states; the bound stays eight rendered. **(TC-COORD-063/064; AC-F6-1; NFR-4)**
- [ ] 7.3 Update `packages/core/src/domain/brief.ts`: mirror the same first-index projection in `blocker-questions`; no new anchor, section, surface, or question type. **(TC-COORD-064; AC-F6-1; NFR-15)**
- [ ] 7.4 Regenerate the reserved-slot goldens only via the explicit scripts and diff field by field; a control golden without escalation stays byte-identical. **(TC-COORD-063/064; TC-COORD-089)**
- [ ] 7.5 Update `doc/spec/features/feature-status-digest.md`, `feature-brief.md`, and `feature-blockers.md` with the reserved-slot and enforcement-arm notes; keep the section read-only and add no read. **(TC-COORD-064/092)**
- [ ] 7.6 Add `coordinator-escalation-slot`, `coordinator-escalation-surface`, extend the status/brief/coordinator goldens; include the index-0 render assertion, the displaced-lowest and omitted-count oracle, near-miss predicate controls, and the dropped-slot / nine-rendered / widened-predicate mutants. **(TC-COORD-063/064)**

**Verification**

```bash
bun test tests/behaviour/coordinator-escalation-slot.test.ts \
  tests/behaviour/coordinator-escalation-surface.test.ts
bun test tests/golden/status-digest.test.ts tests/golden/brief.test.ts \
  tests/golden/coordinator.test.ts
bash scripts/.tests/test-doc-distribution.sh
```

Expected: the escalation renders first by index at the cap; exactly eight questions (seven others plus it); the lowest-ranked is displaced and the omitted count is truthful; near-miss payloads are not selected; zero coordinator-state reads; the only golden diff is the reserved-slot case; no new section/anchor/type.

**Exit criteria.** “Never silent” is true at the normal cap; the escalation renders at index 0 and the bound and rank order are otherwise unchanged; the lowest-ranked question is displaced and counted as omitted; digest and brief agree; the consumer docs are reconciled; no coordinator state read was added to either renderer.

---

## Phase 8 — Integration behaviour, determinism, privacy, performance, and SC-M1-25

**Goal.** Prove the assembled surface over an in-process CLI, synthetic state dir, fake process port, fake clock, fake harness capabilities, and fake blocker ledger; pin the seed scenario end to end.

**Tasks**

- [ ] 8.1 `tests/behaviour/coordinator-scenario.test.ts` (SC-M1-25): start/instance-lease/stop/status; liveness-first refusal, atomic claim, single-record takeover, and tick crash recovery; join/resume/spawn and killed-mid-iteration artifact preservation; two-phase stuck permutations and ledger-sequence fold; identity-verified kill outcomes; budget durability/exhaustion/`exhausted-escalated` idempotency/first-index reserved slot; absent-status pickup and wake outcomes/retry; `token-delta`/`session-traffic` progress bound; persisted `data.stuck` vs `tickVerdict`; config/state/error paths. **(TC-COORD-091; SC-M1-25; AC-F2-*, F3-*, F4-1, F5-2/3, F6-1, F7-1, F8-4/5/6, F10-5)**
- [ ] 8.2 Tier boundaries, purity, adapter confinement, and brand neutrality across the now-complete coordinator surface; contracts are data-only; domain imports only contracts/siblings; process/OS logic exists only in the adapter seam; no harness-name branch outside adapters; three mutants (`node:fs` in contracts, `Date.now` in domain, OS-signal in domain) must fail. **(TC-COORD-002; AC-NFR-3)**
- [ ] 8.3 Determinism: two identical roots byte-identical `data` and text; ambient scan; fresh instance/reopened store; zero model calls; locale/timezone independent. **(TC-COORD-086; AC-NFR-1/3)**
- [ ] 8.4 Idempotency: a second identical tick appends only its own lease pair and no decision/restart/stuck/wake/exhaustion record, and performs no destructive action; a changed fact still fires. **(TC-COORD-087; AC-NFR-1; NFR-6)**
- [ ] 8.5 Privacy: canaries and a synthetic registered secret across every command/record/evidence/error; bounded `key=value` ≤ 512 UTF-8 bytes; no credential read; no prompt/transcript. **(TC-COORD-084; AC-NFR-2; NFR-11)**
- [ ] 8.6 Performance/read cost: synthetic reference store, injected clock, `tick` p95 ≤ 2000 ms, `status` p95 ≤ 1000 ms, `start` p95 ≤ 2000 ms excluding spawn, one verified read per store per tick, ≤ 64 KiB machine and ≤ 32 human lines. **(TC-COORD-088; AC-NFR-4; NFR-4/5/9; GAP-T6)**
- [ ] 8.7 No-CPU/no-LLM/idempotency mutants; SC-M1-25 deterministic transcript; committed goldens under `tests/fixtures/coordinator/golden/`. **(TC-COORD-002/084/086/087/088/091)**

**Verification**

```bash
bun test tests/behaviour/coordinator-scenario.test.ts \
  tests/behaviour/coordinator-idempotency.test.ts
bun test tests/structure/coordinator-imports.test.ts \
  tests/checks/coordinator-determinism.test.ts \
  tests/checks/coordinator-privacy.test.ts
bun test tests/behaviour/coordinator-performance.test.ts \
  tests/behaviour/coordinator-read-cost.test.ts \
  tests/golden/coordinator.test.ts
pnpm check:boundaries
```

Expected: SC-M1-25 green end to end; tier boundaries hold across the complete surface; byte-identical replay; no duplicate record or destructive action; zero canary/secret leakage; p95/read-cost/bounds within threshold (or the timing half behind the declared manual gate); the transcript records environment and iteration count.

**Exit criteria.** The seed scenario is satisfied clause by clause; the full tier/purity/brand boundary holds; every absence is proven; determinism, privacy, idempotency, performance, and read cost are pinned; the golden surface is stable.

---

## Phase 9 — CLI registry, M1 command contract/man page, and changeset

**Goal.** Register the delivered surface in the planning documents and ship one lockstep minor changeset over the publishables.

**Tasks**

- [ ] 9.1 `doc/planning/oss-tooling/cli-command-registry.md`: add the `coordinator` family row (four subcommands/flags, `delivery.coordinator.v1`, the M1-S18 seam) and update the `ceo-loop.sh` strangler row to name coordinator supervision as the delivered replacement. **(feeds TC-COORD-092 at Phase 10; AC-F8-2; DEC-2)**
- [ ] 9.2 `doc/planning/oss-tooling/milestones/m1/contracts.md` and `man-page.md`: coordinator command contract and usage lines. **(feeds TC-COORD-092 at Phase 10)**
- [ ] 9.3 `.changeset/gh-241-coordinator-supervision-minor.md`: lockstep minor over the publishables. **(feeds TC-COORD-092 at Phase 10; NFR-15)**

**Verification**

```bash
git diff --check
bash scripts/.tests/test-doc-distribution.sh
bun run scripts/checks/changesets-group.ts
```

Expected: registry and command page match the delivered grammar; the strangler row names the replacement; the changeset validates; no daemon/dispatch/supervise claim is documented.

**Exit criteria.** The planning surface matches the delivered command family; the changeset is lockstep minor; no out-of-scope claim is documented.

---

## Phase 10 — Gate battery, release pinning, and spec reconciliation

**Goal.** Reconcile the current-truth system docs, run the full gate battery, pin the final AC/TC status, and declare the release obligations. Fix only within the declared change scope.

**Tasks**

- [ ] 10.1 Reconcile `doc/spec/features/feature-coordinator-supervision.md` as the current-truth home; add the consumer/boundary notes to `feature-session-lifecycle-economics.md` (distinct budget) and `feature-harness-adapters.md` (additive process port, identity check, new-turn mapping, four-way capability ownership); re-check `feature-result-contract.md`, the Phase-7 docs, and the Phase-9 registry/man-page output; update `doc/00-index.md`. **(TC-COORD-090/092; AC-F8-2)**
- [ ] 10.2 Non-regression: status/brief goldens differ only in the reserved-slot case; blockers ranking, economics records, lane records, and `ceo-loop.sh` byte-unchanged; no other command envelope/exit changes; no daemon/dispatch/supervise surface. **(TC-COORD-089; AC-NFR-1; NFR-15)**
- [ ] 10.3 `ceo-loop.sh` function-map trace: context resume decision (AC-F2-*), stuck detection (AC-F3-*), kill with grace (AC-F4-*), restart budget (AC-F5-*), wake on question (AC-F7-*), owner escalation (AC-F6-*), supervisor regime (AC-F8-*), each with a **passing** TC at DoD. **(TC-COORD-090; AC-F10-5; Appendix A)**
- [ ] 10.4 Full gate battery: `pnpm check`; error-table sync; ambient globals; forbidden/privacy literals; boundaries; exports parity; doc distribution; commitlint; `git diff --check`. **(TC-COORD-089/090)**
- [ ] 10.5 Verify TC-COORD-092 against the delivered surface, reconcile any registry/man-page drift, update this plan's completion acknowledgement and the AC/TC status table; leave the spec and test plan unedited (their status is owned by their authors); report per-phase evidence to `@pm`. **(TC-COORD-090/092)**

**Verification**

```bash
pnpm check
bun run scripts/checks/error-table-sync.ts
pnpm check:forbidden-literals
pnpm check:privacy-literals
pnpm check:boundaries
bun run scripts/checks/exports-parity.ts
bash scripts/.tests/test-doc-distribution.sh
git diff --check
```

Expected: every gate green; 105/105 error rows; set 24 in both gate files; exports parity; doc distribution green; no forbidden/privacy literal; commitlint clean; the only status/brief diff is the reserved-slot case; the registry/man page and feature spec agree with the delivered grammar.

**Exit criteria.** All 48 ACs and all 72 TCs have a passing result or a signed-off manual result; the `ceo-loop.sh` map is traced; every absence claim has its three observations; the only permitted digest/brief diff is the reserved slot; the release and spec-reconciliation obligations are declared in scope.

---

## Risks and rollback

| Risk | Mitigation in this plan | Residual |
|---|---|---|
| A large working session is killed as stuck | Phase 2 proves positive sourced progress vetoes `stuck`; Phase 5 kill intent only after a `stuck` verdict; TC-033/037 | M |
| A torn store is read as count `0` or fabricated stale | Phase 3 classifies torn/gapped as `unevaluable`; Phase 2/3 matrix; TC-035/036/055 | L |
| The budget is cached, conflated, or reset by a restart | Phase 3 reopened-store durability; distinct namespace; TC-025/050/053/055 | L |
| Exhaustion is “escalated” but crowded out | Phase 7 renders the reserved slot at index 0 with seven others in rank order and the lowest displaced/counted; TC-063/064 | L |
| A duplicate or thundering-herd wake | Phase 2 dedupe on coordinator+question+askedAt; Phase 6 persisted-`woken` only; TC-071/074 | L |
| A two-segment code fails the format gate | Phase 1 exact allowlist in both files; set 24; near-miss rejection; TC-081/082 | L |
| The status/brief goldens are regenerated wholesale | Phase 7 explicit regeneration + field-by-field diff + control golden; TC-064/089 | L |
| The fake process port makes the kill test vacuous | Phase 5 declared `failed`, phase log, matching/mismatched `pid`+start time, AST shell/name scan, kill-only-under-current-lease counter; TC-041/042/043/045/085 | L |
| A reused PID is signalled after a stale record | Phase 5 pre-TERM `pid` + `processStartTimeMs` verification; mismatch sends no signal and records `identity-mismatch`; TC-045 | L |
| A second supervisor or a racing tick double-evaluates | Phase 6 append-only instance lease, liveness-first decision, one atomic claim section, `already-running` refusal (including claim-time `state.lock.busy`), single-record takeover, quiet-tick lease pair; TC-010/015/017/018/043/093/094/095 | L |
| A live holder is stolen after 2×`collection-interval` | Phase 6 decides `alive` before age; `alive=true` is refused regardless of age and `stop` still records the request; the age fallback applies only to unknown liveness; TC-093 | L |
| A dead holder's lease blocks the one-shot surface forever | Phase 6 `tick` shares the claim/takeover path; a dead holder is recovered with one `stale-takeover` and one cycle; TC-095/043 | L |
| A writer dies holding the state write fence and blocks coordinator appends | Phase 3 per-append helper: one `fenceStatus()` check, one `recoverFence` + one retry for an age-stale lock, else `state.lock.busy`; TC-017/043 | L |
| The fingerprint grows an undeclared ready-to-merge/tracker/CI read | Phase 2 state-sourced fingerprint only (event-log cursor + open coordinator-question count); TC-032 | L |
| “Within one cycle” becomes a scheduler claim | GAP-T2: one-tick semantics with an injected clock; no sleep; TC-030/070 | L |
| Performance tests flake and get softened | GAP-T6 method; structural/read-cost gates in CI; timing behind the declared manual gate; TC-088 | M |
| The supervisor regime diverges from the future daemon | Phase 9/10 descriptor and M1-S18 seam in the registry/man page; no installer; TC-014/092 | M |

**Rollback.** Stop the supervisor (`coordinator stop`), stop invoking the command, and leave the additive records in place. No schema migration, backfill, or data reversal is required. The change is additive: existing commands, envelopes, exits, config keys, digest sections, and brief anchors are unchanged except for the declared reserved escalation slot. `ceo-loop.sh` remains in place until M4-S5. If the reserved-slot rendering rule is reverted, only the Phase-7 contract/domain/golden diff is reverted; the coordinator records and command family remain usable.

## Final gate battery

| Gate | Command | Expected |
|---|---|---|
| Narrow coordinator suites | `bun test tests/structure/coordinator-*.test.ts tests/behaviour/coordinator-*.test.ts tests/checks/coordinator-*.test.ts` | green |
| Error-table binding | `bun run scripts/checks/error-table-sync.ts` | 105 entries / 105 documented / set 24 |
| Ambient globals | `bun run scripts/checks/ambient-globals.ts` | green |
| Forbidden literals | `pnpm check:forbidden-literals` | green |
| Privacy literals | `pnpm check:privacy-literals` | green |
| Boundaries | `pnpm check:boundaries` | green |
| Exports parity | `bun run scripts/checks/exports-parity.ts` | green |
| Doc distribution | `bash scripts/.tests/test-doc-distribution.sh` | green |
| Commit message | `bunx commitlint --from=main-tools` | conventional |
| Diff hygiene | `git diff --check` | clean |
| Aggregate | `pnpm check` | lint + format + typecheck + test + boundaries + exports parity |

## AC → phase → TC traceability

| AC | Phase | TC(s) |
|---|---:|---|
| AC-F1-1 | 6 | TC-COORD-003, 010, 016, 018, 094 |
| AC-F1-2 | 6 | TC-COORD-003, 012, 017, 095 |
| AC-F1-3 | 6 | TC-COORD-003, 011, 017, 018, 093 |
| AC-F1-4 | 6 | TC-COORD-013, 018 |
| AC-F2-1 | 3, 8 | TC-COORD-020, 026, 091 |
| AC-F2-2 | 3, 8 | TC-COORD-021, 026, 091 |
| AC-F2-3 | 3, 8 | TC-COORD-022, 026, 091 |
| AC-F2-4 | 6 | TC-COORD-024 |
| AC-F2-5 | 6 | TC-COORD-025 |
| AC-F2-6 | 3, 6 | TC-COORD-012, 023, 026 |
| AC-F3-1 | 2, 3, 5, 8 | TC-COORD-029, 030, 031, 032, 038, 039, 091 |
| AC-F3-2 | 2, 5 | TC-COORD-029, 033 |
| AC-F3-3 | 2, 3, 5, 6 | TC-COORD-029, 031, 034, 035, 036, 039 |
| AC-F3-4 | 2 | TC-COORD-037 |
| AC-F4-1 | 6, 8 | TC-COORD-040, 045, 091 |
| AC-F4-2 | 6 | TC-COORD-041, 045 |
| AC-F4-3 | 5, 6 | TC-COORD-042, 043, 085 |
| AC-F4-4 | 6 | TC-COORD-045 |
| AC-F5-1 | 3 | TC-COORD-050, 083 |
| AC-F5-2 | 3, 4, 8 | TC-COORD-026, 051, 056, 091 |
| AC-F5-3 | 4, 6, 8 | TC-COORD-052, 056, 091 |
| AC-F5-4 | 3, 6 | TC-COORD-053, 055 |
| AC-F5-5 | 6 | TC-COORD-016, 054 |
| AC-F6-1 | 6, 7, 8 | TC-COORD-052, 060, 063, 064, 091 |
| AC-F6-2 | 6 | TC-COORD-062 |
| AC-F6-3 | 6 | TC-COORD-061, 065 |
| AC-F7-1 | 6, 8 | TC-COORD-070, 073, 091 |
| AC-F7-2 | 6 | TC-COORD-071 |
| AC-F7-3 | 6 | TC-COORD-070, 073 |
| AC-F7-4 | 6 | TC-COORD-072 |
| AC-F7-5 | 6 | TC-COORD-074 |
| AC-F7-6 | 6 | TC-COORD-075 |
| AC-F8-1 | 6 | TC-COORD-010, 017, 018, 043, 094 |
| AC-F8-2 | 6, 10 | TC-COORD-013, 014, 092 |
| AC-F8-3 | 6 | TC-COORD-015, 017, 018, 093, 095 |
| AC-F8-4 | 6 | TC-COORD-011, 015, 093 |
| AC-F8-5 | 6 | TC-COORD-010, 017, 094 |
| AC-F8-6 | 6 | TC-COORD-012, 043, 095 |
| AC-F9-1 | 6 | TC-COORD-003, 012, 013, 017, 018 |
| AC-F10-1 | 1, 4 | TC-COORD-001, 056, 080 |
| AC-F10-2 | 1, 6, 10 | TC-COORD-004, 081, 082, 092 |
| AC-F10-3 | 3, 6 | TC-COORD-035, 036, 055, 083 |
| AC-F10-4 | 6 | TC-COORD-044 |
| AC-F10-5 | 8, 10 | TC-COORD-090, 091 |
| AC-NFR-1 | 8, 10 | TC-COORD-086, 087, 089 |
| AC-NFR-2 | 5, 8 | TC-COORD-084, 085 |
| AC-NFR-3 | 2, 8 | TC-COORD-002, 037 |
| AC-NFR-4 | 7, 8 | TC-COORD-088 |

## TC → phase index

Complete mapping; every TC appears exactly once. The YAML header carries the same map in comment form.

| TC | Phase | Test surface |
|---|---:|---|
| TC-COORD-001 | 1 | `tests/structure/coordinator-contract.test.ts; tests/types/coordinator.type-test.ts` |
| TC-COORD-002 | 8 | `tests/structure/coordinator-imports.test.ts; tests/boundaries` |
| TC-COORD-003 | 6 | `tests/behaviour/coordinator-grammar.test.ts` |
| TC-COORD-004 | 6 | `tests/behaviour/coordinator-envelope.test.ts; tests/checks/exit-code-literals.test.ts` |
| TC-COORD-010 | 6 | `tests/behaviour/coordinator-start.test.ts` |
| TC-COORD-011 | 6 | `tests/behaviour/coordinator-stop.test.ts` |
| TC-COORD-012 | 6 | `tests/behaviour/coordinator-tick.test.ts; tests/golden/coordinator.test.ts` |
| TC-COORD-013 | 6 | `tests/behaviour/coordinator-status.test.ts; tests/golden/coordinator.test.ts` |
| TC-COORD-014 | 6 | `tests/structure/coordinator-regime.test.ts; tests/behaviour/coordinator-status.test.ts` |
| TC-COORD-015 | 6 | `tests/behaviour/coordinator-fence-stale.test.ts` |
| TC-COORD-016 | 6 | `tests/behaviour/coordinator-fresh-budget.test.ts` |
| TC-COORD-017 | 6 | `tests/behaviour/coordinator-fence-records.test.ts` |
| TC-COORD-018 | 6 | `tests/behaviour/coordinator-instance-lease.test.ts; tests/structure/coordinator-contract.test.ts` |
| TC-COORD-020 | 3 | `tests/behaviour/coordinator-decision-join.test.ts` |
| TC-COORD-021 | 3 | `tests/behaviour/coordinator-decision-resume.test.ts` |
| TC-COORD-022 | 3 | `tests/behaviour/coordinator-decision-spawn.test.ts` |
| TC-COORD-023 | 3 | `tests/behaviour/coordinator-decision-spawn.test.ts` |
| TC-COORD-024 | 6 | `tests/behaviour/coordinator-decision-recovery.test.ts` |
| TC-COORD-025 | 6 | `tests/behaviour/coordinator-decision-durability.test.ts` |
| TC-COORD-026 | 3 | `tests/behaviour/coordinator-ordinals.test.ts` |
| TC-COORD-029 | 5 | `tests/behaviour/coordinator-new-turn.test.ts; tests/fixtures/coordinator/process-port.ts` |
| TC-COORD-030 | 3 | `tests/behaviour/coordinator-stuck-verdict.test.ts` |
| TC-COORD-031 | 3 | `tests/behaviour/coordinator-stuck-matrix.test.ts` |
| TC-COORD-032 | 2 | `tests/behaviour/coordinator-stuck-fingerprint.test.ts` |
| TC-COORD-033 | 2 | `tests/behaviour/coordinator-stuck-corroborator.test.ts` |
| TC-COORD-034 | 2 | `tests/behaviour/coordinator-stuck-unknown.test.ts` |
| TC-COORD-035 | 6 | `tests/behaviour/coordinator-stuck-unevaluable.test.ts` |
| TC-COORD-036 | 3 | `tests/behaviour/coordinator-stuck-torn.test.ts` |
| TC-COORD-037 | 2 | `tests/structure/coordinator-no-cpu.test.ts; tests/checks/coordinator-mutants.test.ts` |
| TC-COORD-038 | 3 | `tests/behaviour/coordinator-expectation.test.ts` |
| TC-COORD-039 | 3 | `tests/behaviour/coordinator-stuck-reason.test.ts` |
| TC-COORD-040 | 6 | `tests/behaviour/coordinator-kill-grace.test.ts; tests/behaviour/coordinator-kill-fence.test.ts` |
| TC-COORD-041 | 6 | `tests/behaviour/coordinator-kill-failed.test.ts` |
| TC-COORD-042 | 5 | `tests/behaviour/coordinator-kill-target.test.ts; tests/structure/coordinator-kill-target.test.ts` |
| TC-COORD-043 | 6 | `tests/behaviour/coordinator-kill-fence.test.ts` |
| TC-COORD-044 | 6 | `tests/behaviour/coordinator-capability-gap.test.ts` |
| TC-COORD-045 | 6 | `tests/behaviour/coordinator-kill-identity.test.ts; tests/fixtures/coordinator/process-port.ts` |
| TC-COORD-050 | 3 | `tests/behaviour/coordinator-restart-namespace.test.ts` |
| TC-COORD-051 | 3 | `tests/behaviour/coordinator-restart-admit.test.ts` |
| TC-COORD-052 | 6 | `tests/behaviour/coordinator-restart-exhausted.test.ts` |
| TC-COORD-053 | 3 | `tests/behaviour/coordinator-restart-durability.test.ts` |
| TC-COORD-054 | 6 | `tests/behaviour/coordinator-fresh-budget.test.ts` |
| TC-COORD-055 | 6 | `tests/behaviour/coordinator-restart-torn.test.ts` |
| TC-COORD-056 | 4 | `tests/behaviour/coordinator-budget-config.test.ts` |
| TC-COORD-060 | 6 | `tests/behaviour/coordinator-escalation-publish.test.ts` |
| TC-COORD-061 | 6 | `tests/behaviour/coordinator-escalation-idempotent.test.ts` |
| TC-COORD-062 | 6 | `tests/behaviour/coordinator-escalation-failed.test.ts` |
| TC-COORD-063 | 7 | `tests/behaviour/coordinator-escalation-slot.test.ts; tests/golden/coordinator.test.ts` |
| TC-COORD-064 | 7 | `tests/behaviour/coordinator-escalation-surface.test.ts; tests/golden/{status-digest,brief}.test.ts` |
| TC-COORD-065 | 6 | `tests/behaviour/coordinator-escalation-reuse.test.ts` |
| TC-COORD-070 | 6 | `tests/behaviour/coordinator-wake-pickup.test.ts` |
| TC-COORD-071 | 6 | `tests/behaviour/coordinator-wake-dedupe.test.ts` |
| TC-COORD-072 | 6 | `tests/behaviour/coordinator-wake-answered.test.ts` |
| TC-COORD-073 | 6 | `tests/behaviour/coordinator-wake-paths.test.ts` |
| TC-COORD-074 | 6 | `tests/behaviour/coordinator-wake-failed.test.ts` |
| TC-COORD-075 | 6 | `tests/behaviour/coordinator-wake-next.test.ts` |
| TC-COORD-080 | 4 | `tests/behaviour/coordinator-config.test.ts` |
| TC-COORD-081 | 1 | `tests/structure/error-table.test.ts` |
| TC-COORD-082 | 1 | `tests/checks/error-table-sync.test.ts` |
| TC-COORD-083 | 3 | `tests/behaviour/coordinator-records.test.ts; tests/structure/state-contract.test.ts` |
| TC-COORD-084 | 8 | `tests/checks/coordinator-privacy.test.ts; tests/checks/secret-read-boundary.test.ts` |
| TC-COORD-085 | 5 | `tests/structure/coordinator-kill-target.test.ts; tests/boundaries` |
| TC-COORD-086 | 8 | `tests/checks/coordinator-determinism.test.ts; tests/golden/coordinator.test.ts` |
| TC-COORD-087 | 8 | `tests/behaviour/coordinator-idempotency.test.ts` |
| TC-COORD-088 | 8 | `tests/behaviour/coordinator-performance.test.ts; tests/behaviour/coordinator-read-cost.test.ts` |
| TC-COORD-089 | 10 | `existing tests/{structure,behaviour,golden,conformance,boundaries}` |
| TC-COORD-090 | 10 | `manual traceability review` |
| TC-COORD-091 | 8 | `tests/behaviour/coordinator-scenario.test.ts` |
| TC-COORD-092 | 10 | `manual review; bash scripts/.tests/test-doc-distribution.sh; git diff --check` |
| TC-COORD-093 | 6 | `tests/behaviour/coordinator-lease-liveness.test.ts` |
| TC-COORD-094 | 6 | `tests/behaviour/coordinator-claim-race.test.ts; tests/fixtures/state/harness.ts` |
| TC-COORD-095 | 6 | `tests/behaviour/coordinator-tick-takeover.test.ts` |


## SC-M1-25 reconciliation

| Seed clause | Phase | TC(s) | Plan obligation |
|---|---:|---|---|
| Given: coordinator session mid-iteration | 3, 6 | 020, 024 | A live session is `join-live`; a killed-mid-iteration session recovers per the recorded decision with closed-out artifacts untouched. |
| Given: context pressure rises | 3 | 021, 022 | `resume-context` below the limit; `spawn-fresh context-pressure` at/above it. |
| Given: coordinator-audience question ranked top | 6 | 070, 073 | Strict `isCoordinatorPickup` (an absent status counts as open); live/resume/spawn wake. |
| When: supervision evaluates | 3, 6 | 012, 026 | One bounded `tick`; the decision persists before the action. |
| Then: join-or-resume decision recorded and applied | 3, 6 | 020, 021, 024, 025, 026 | Decision + reason + session + context + ordinal + iteration recorded; durable across restart. |
| Then: no digest consumed, no merge, no answer within the window | 2, 3, 5 | 029, 030, 031, 032 | Three classes; fingerprint advance **and** a new session turn (`token-delta`/`session-traffic`) for `digest-consumed`; `progress-bound` veto. |
| Then: detected by artifact evidence | 2, 3, 5 | 029, 030, 031, 034, 037 | No CPU; unknown disclosed; positive progress vetoes. |
| Then: killed with grace | 5, 6 | 042 (adapter target), 040, 045 (composition) | Phase 5 proves the adapter target/identity/outcome only; Phase 6 composes the `phase=outcome` append and budget check. TERM → grace → conditional KILL after `pid`+start-time verification; recorded handle only. |
| Then: restarted within budget | 3, 6 | 051, 052, 054 | Below-bound appends the next ordinal; at/above refuses and escalates; fresh budget opens a new epoch. |
| Then: the typed question wakes within one collection cycle | 6 | 070, 073 | The next tick after the question qualifies issues the wake; no scheduler in v1 (GAP-T2). |
| Assert: restart events classified | 3, 6 | 026, 039, 051, 052 | Closed restart reasons and the distinct closed stuck reason. |
| Assert: exhaustion escalates to the owner brief, never silent | 6, 7 | 060, 062, 063, 064, 065 | One owner question; publish failure exit 2; reserved slot first by index at the cap; digest/brief agree; `exhausted-escalated` idempotency. |
| Assert: the ceo-loop function map is covered | 8, 10 | 090, 091 | Five functions plus owner escalation and regime, each with a passing trace. |

## Spec / test-plan issues found

1. **No blocking inconsistency after v1.3.** The spec v1.3 and test plan v1.3 agree on all 48 ACs, 72 TCs, the exact two-code allowlist (set 22→24), the 99→105 table, the payload-only reserved-slot predicate with first-index rendering, the persisted-`woken`-only rule, the two-phase `coordinator.stuck` record with `stuckId = iterationId`, the append-only `coordinator.fence` instance lease (liveness-first, atomic claim, single-record takeover, quiet-tick pair), `exhausted-escalated`, absent-status pickup, foreground-only v1 (`supervisorMode=foreground`, `detached` reserved but never produced, `externalUnit=absent`), the persisted-`data.stuck`/`tickVerdict` split, ledger-sequence-primary folds, and the six config keys including `coordinator.progress-bound`.
2. **One delivery-bound path divergence (non-blocking).** The test plan names `packages/adapters/src/process/**` as *expected* (TC-COORD-002/044 and §4). This plan places the port at `packages/adapters/src/harness/process-lifecycle.ts` and exports it from the existing harness subpath. GAP-T5 explicitly makes module paths delivery-bound, and the spec says “beside the harness adapters”; the choice avoids a new package subpath, workspaceImports entry, and dependency-cruiser rule. Tests must resolve the seam through the harness export; if delivery instead creates a `process` subpath, the test path is a mechanical adjustment that does not reshape any pinned identity, exit, vocabulary, or AC trace.
3. **Terminology corner.** The test plan §8.3 OQ-T7 says “Phase 4 must map TCs onto phases”; that refers to the delivery process's planning step, not this plan's Phase 4 (config). This plan resolves OQ-T7 by mapping all 72 TCs across Phases 1–10 without reshaping.
4. **DoR iteration-2 re-map.** The three new v1.3 TCs (TC-093, TC-094, TC-095) are mapped exactly once at the Phase-6 command gate. TC-040 moves from Phase 5 to Phase 6: Phase 3 proves the two-phase record pair through the state API, Phase 5 returns only the adapter outcome (TERM/grace/identity), and Phase 6 owns the end-to-end `phase=outcome` append under `stuckId = iterationId` and the budget check. `tests/behaviour/coordinator-kill-grace.test.ts` is created in Phase 5 for the adapter-only half and extended in Phase 6; the TC maps once. TC-092 remains at Phase 10 because the `feature-coordinator-supervision.md` current-truth spec is authored there; Phase 9 still writes the registry, man page, and changeset that TC-092 reviews. TC-041/043/044/045 remain at Phase 6 because they assert command exit/status behaviour; `tests/golden/coordinator.test.ts` and `tests/structure/coordinator-regime.test.ts` are created in Phase 6 where first needed.
5. **No spec/test-plan edit required.** This plan does not edit the spec, test plan, TDRs, pm-notes, or source. The test plan already links `./chg-GH-241-plan.yaml`; any later artifact-status edit remains with its author.

## Files read

- `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-spec.md` (v1.3: front matter, F-1/F-3/F-4/F-6/F-8/F-9/F-10, AC-F1..AC-NFR-4, §25, Appendix B/D/E/F/G)
- `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-test-plan.md` (v1.3: §1–§5.1, selected §5.2 scenarios including TC-010/012/013/014/017/018/029/040..045/063/093/094/095, §7–§10)
- `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/readiness-review/readiness-iter-1.md` and `readiness-iter-2.md` (RF-01..RF-12, A1/A2/A3/A6; RF2-01..RF2-12)
- `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-plan.yaml` and `.md` (v1.2 baseline for this update)
- `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-pm-notes.yaml` (context only, not read as truth)
- `doc/decisions/TDR-0013-coordinator-supervision-architecture.md` and `TDR-0014-coordinator-artifact-evidence-and-brief-escalation.md` (read-only contract cross-check)
- `doc/changes/2026-11/2026-11-06--GH-230--typed-blockers/chg-GH-230-plan.yaml` and `.md`
- `doc/changes/2026-11/2026-11-07--GH-236--spend-read-side/chg-GH-236-plan.yaml`
- `doc/changes/2026-11/2026-11-06--GH-225--merge-verify-deploy/chg-GH-225-plan.yaml`
- `doc/changes/2026-11/2026-11-07--GH-235--session-lifecycle-economics/chg-GH-235-plan.yaml`
- `doc/changes/2026-11/2026-11-06--GH-233--harness-adapters/chg-GH-233-plan.yaml`
- `doc/templates/implementation-plan-template.md`
- `doc/spec/features/feature-plan-schema.md`
- `packages/core/src/contracts/error-table.ts`
- `scripts/checks/error-table-sync.ts`
- `tests/structure/error-table.test.ts`
- `packages/core/src/domain/plan-validate.ts`
- `packages/adapters/src/file/plan-artifact.ts`
- `packages/adapters/src/file/yaml-parser.ts`
- `tests/fixtures/plan/harness/index.ts`
- `packages/cli/src/commands/plan.ts`
- `packages/cli/src/edge.ts` (plan registration and composition points)
- Repository tree inventory for `packages/core/src/{contracts,domain,state,config}`, `packages/adapters/src`, `packages/cli/src/commands`, `scripts/checks`, `tests/{structure,behaviour,checks,golden,fixtures}`

## Validation

- **Full delivered path:** `readPlanArtifact` (real change-folder location and YAML-before-markdown precedence) + `validatePlan` (real validator) + the real `parseConfigYaml` parser, run after building the workspace packages: artifact `chg-GH-241-plan.yaml` selected, verdict **valid**, `readyForDevelopment: true`, **0 errors**, phases 1–10.
- **Schema check:** `delivery.plan.v1`; `tier.name: full`; phases `[1..10]`; every phase has a non-empty scope; contracts are produced in Phase 1 and Phase 7; the only `doneArtifacts` block is the final release phase.
- **Coverage check:** 72/72 test-plan TCs appear in both the YAML header map and the complete MD table; phase assignments agree exactly; 48/48 ACs appear in the AC→phase→TC table.
- **Artifact precedence:** `chg-GH-241-plan.yaml` is authoritative; this MD is the execution companion. When both exist, the YAML wins and the verdict discloses the YAML artifact.
