---
id: chg-GH-241-coordinator-supervision
status: Proposed
created: 2026-11-07T17:30:00Z
last_updated: 2026-11-07T17:30:00Z
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
  recorded handle; a durable per-epoch restart budget distinct from lane and
  economics; one classified owner-audience exhaustion question rendered under
  the reserved escalation slot; strict isCoordinatorPickup wake with one
  persisted wake per question; a shared supervisor-regime descriptor and
  state-dir fence with a durable `coordinator.fence` record; five config keys;
  six additive state records with STATE_SCHEMA_VERSION unchanged; six error
  identities with the exact two-code two-segment allowlist (22→24, table
  99→105); deterministic bounded output; and non-regression of the delivered
  status/brief/blockers/economics/lane surfaces.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-241: M1-S23 Coordinator supervision

## Context and Goals

This plan delivers GH-241 against the change specification v1.1 (`chg-GH-241-spec.md`: F-1..F-10, 43 acceptance criteria, DEC-1..DEC-13, DM-1..DM-11, EVT-1..EVT-7, NFR-1..NFR-15, Appendix A..H) and the committed test plan v1.1 (`chg-GH-241-test-plan.md`: 66 TCs `TC-COORD-001..092`, 43/43 AC coverage, SC-M1-25 clause map in §3.4, file/command inventory in §7).

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
| 5 Process-lifecycle port | 6 | AC-F4-1..3, AC-F10-4 |
| 6 CLI family + edge | 26 | AC-F1-1..3, AC-F2-4/5, AC-F3-3, AC-F5-3/4/5, AC-F6-1..3, AC-F7-1..6, AC-F8-1/3, AC-F9-1, AC-F10-2/3 |
| 7 Reserved escalation slot + consumer docs | 2 | AC-F6-1, AC-NFR-4 |
| 8 Integration + SC-M1-25 | 6 | AC-NFR-1..4, AC-F10-5 |
| 9 Registry + man page + changeset | 1 | AC-F8-2, AC-F10-2 |
| 10 Gates + release + spec reconciliation | 2 | AC-F10-5, AC-NFR-1 |
| **Total** | **66** | **43/43 covered** |

## Pinned non-negotiables

These are binding on every phase; a change to any of them reopens the test plan (GAP-T1) and requires `@pm` / `@decision-advisor` routing.

1. **Error allowlist exact.** Exactly `coordinator.already-running` and `coordinator.restart-budget-exhausted` are two-segment and join `RESERVED_TWO_SEGMENT_CODES` in **both** `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts`. Set 22→24; table 99→105. The other four coordinator identities are three-segment. No `coordinator.*` wildcard, no generic two-segment widening, a near-miss code remains rejected.
2. **Six records, additive, schema-neutral.** `coordinator.iteration`, `.restart`, `.stuck`, `.exhaustion`, `.wake`, `.fence` under `delivery.state.v1`; `STATE_SCHEMA_VERSION` unchanged; no migration, backfill, or derived document.
3. **Decision before action.** The lifecycle decision, session identity, context reading (or explicit absence), reason, ordinal consumption, and iteration identity are recorded before attach/resume/spawn. A supervisor restart reconstructs the same truth; closed-out phase/merge/answer artifacts are never re-executed.
4. **Ordinal accounting exact.** `join-live` consumes none. `resume-context` consumes one. `spawn-fresh` consumes one for `context-pressure`, `context-unknown`, `session-interrupted`; none for `initial-start` and `clean-iteration-end`.
5. **Stuck is artifact evidence, never CPU.** `digest-consumed` requires a fingerprint advance **and** a new session turn; `merge` and `answer` are post-expectation records; positive sourced progress vetoes a stuck verdict; `progressing` is not persisted; all-unknown or an unreadable required store is `unevaluable`/`evidence-unevaluable` with no kill or restart; a torn/gapped ordinal is never count `0`.
6. **Kill is bounded and safe.** TERM on the recorded handle/tree, wait `coordinator.kill-grace`, conditional KILL, outcomes `terminated`/`forced`; `failed` is `coordinator.session.kill-failed` exit 2 with consequence `unknown`; no name/pattern kill, no shell interpolation, and no kill without the state-dir fence.
7. **Budget distinct and durable.** Namespace `coordinator/<coordinatorId>`; contiguous ordinals from 1 per budget epoch; below-bound appends one record and proceeds; at/above-bound starts no replacement, returns `coordinator.restart-budget-exhausted` exit 1 with history, and runs escalation; `start --fresh-budget` opens a new epoch at 0 while old history remains.
8. **Escalation loud and idempotent.** Exactly one owner-audience `decision-needed` question per `(coordinatorId, budgetEpochId)` with `lane=coordinator`, `ref=<coordinatorId>#<budgetEpochId>`, count/bound/history/options; the terminal receipt lands only after the question; publish failure is `coordinator.escalation.publish-failed` exit 2; repeated ticks reuse the open question and return idempotent `escalated` exit 0.
9. **Reserved slot is payload-only.** The digest `typed-questions` and brief `blocker-questions` render the escalation under a reserved slot selected by `type=decision-needed` AND `audience=owner` AND `lane=coordinator` AND the ref shape (exactly one `#`, both sides non-empty). At most seven other questions render alongside it; omitted counts stay truthful; no new section/anchor/type; no coordinator-state read.
10. **Wake is strict and persisted-on-success.** `isCoordinatorPickup` is rank 1, open, audience coordinator. Only a successful `woken` appends a `coordinator.wake` record and consumes the one-wake-per-question lifetime; `already-woken` is a no-op; `answered-before-wake`, `delivery-failed`, and `no-pickup` are tick results that append nothing, so retry cannot duplicate records. Dedupe key: coordinator id + question id + `askedAt`.
11. **Capability ownership is four-way.** Harness resume undeclared/unavailable → `spawn-fresh` reason `session-interrupted`, one ordinal, exit 0, no error. Harness spawn impossible/refused → delivered `harness.capability.gap` / `harness.spawn.refused` exit 1. Process-port alive or kill-with-grace absent → `coordinator.process.capability-gap` exit 2, no destructive action. Progress absent → `unknown` evidence class, never an error and never by itself a kill.
12. **Pure and private.** No CPU read, no model call, no ambient clock/randomness/environment in any decision or render path; no prompt/transcript/secret/credential value in any record, evidence, status, or error; evidence is bounded `key=value` at ≤ 512 UTF-8 bytes; exits only `{0,1,2}`.
13. **Out of scope.** No `daemon` command, control socket, lane supervision, OS installer, startup reconciliation (M1-S18); no `dispatch`/spawn loop (M1-S9); no prompt changes (M1-S20); no queue/merge/closeout/status-collector redesign; no reuse of `lane.restart-budget`, `lane.liveness-interval`, or `economics/<workItemRef>`. `ceo-loop.sh` stays byte-unchanged.

## Plan decisions and delivery-bound readings

| ID | Decision | Rationale |
|---|---|---|
| PL-1 | Extra phase metadata (tasks, verification, AC/TC ids) lives in YAML comments and this MD; the parsed YAML carries only `delivery.plan.v1` keys. | Unknown phase keys are ignored by the validator, but a machine plan should stay strictly schema-shaped; GH-236 established the comment-carrier precedent. `plan validate GH-241` returns `valid` and `readyForDevelopment=true`. |
| PL-2 | `doneArtifacts` is declared on Phase 10 only (PR, pipeline, tracker transition). | Every phase produces one commit + a green narrow gate, not a separate MR/pipeline/deploy. Inventing per-phase artifact values would fabricate delivery evidence. |
| PL-3 | The process-lifecycle adapter lives at `packages/adapters/src/harness/process-lifecycle.ts` and is exported from the existing harness subpath, not a new `packages/adapters/src/process/**` subpath. | The test plan names `packages/adapters/src/process/**` as *expected*; GAP-T5 makes module paths delivery-bound. The harness subpath satisfies “beside the harness adapters” with no new package exports, workspaceImports entry, dependency-cruiser rule, or boundary-rule loosening. |
| PL-4 | Domain/state module names are declared by the `coordinator*` glob, not guessed exact files. | Delivery owns export names and file splits (GAP-T5); the glob keeps `plan diff` classifying all coordinator modules `within` without pinning a spelling the spec does not pin. |
| PL-5 | All 66 TCs map to exactly one phase; none is dropped, merged away, or reshaped. | Resolves OQ-T7 / GAP-T1. A phase may share a test file with another phase (for example `coordinator-fresh-budget.test.ts` for TC-054 and TC-016); the TC itself maps once. |
| PL-6 | Phases 1–10 are all `delivery` kind (lease-taking). No `planning` phase is needed; the planning artifacts already exist. | A phase scope that writes code or docs is delivery; planning phases are lease-free by contract. |
| PL-7 | Performance (TC-088) is semi-automated: structural/read-cost/bounds assertions gate CI; the p95 wall-clock assertion runs behind the declared manual performance gate if CI cannot keep it deterministic. | GAP-T6; the bound is never relaxed or deleted. |

### Delivery-bound spellings pinned by this plan

The spec pins behaviour, identities, exits, vocabularies, bounds, and AC traceability; it does not pin every module spelling (GAP-T5). The following are declared now so delivery does not improvise:

- Contracts module: `packages/core/src/contracts/coordinator.ts` (one data-only home).
- Domain modules: `packages/core/src/domain/coordinator*.ts` (renderers included).
- State module: `packages/core/src/state/coordinator*.ts`.
- Adapter: `packages/adapters/src/harness/process-lifecycle.ts`, exported from `packages/adapters/src/harness/index.ts`.
- CLI: `packages/cli/src/commands/coordinator.ts`, text renderer `packages/cli/src/output/coordinator-text.ts`, registered in `commands/index.ts` and composed in `edge.ts`.
- Record-kind strings and payload schema ids: `coordinator.<kind>` / `delivery.coordinator.<kind>.v1`, read from the contract in tests, never guessed by a test.
- Observation payload: `delivery.coordinator.v1`.
- Changeset: `.changeset/gh-241-coordinator-supervision-minor.md`.

## Phase 1 — Contracts, coordinator error family, and result-contract sync

**Goal.** Land the runtime-neutral coordinator vocabulary, the six-row error family, the exact two-code two-segment allowlist, and the documented-table companion in one commit so `error-table-sync` is green at this boundary.

**Tasks**

- [ ] 1.1 Create `packages/core/src/contracts/coordinator.ts` with the closed vocabularies from spec Appendix B: lifecycle decisions (`join-live`, `resume-context`, `spawn-fresh`, `none`), decision reasons, restart reasons, stuck verdicts, stuck reasons, evidence classes/states, kill outcomes, wake persisted outcomes vs tick results, fence actions, escalation states, recovery options, five config key paths, six record-kind identifiers, six payload schema ids, the `delivery.coordinator.v1` observation payload types, the regime descriptor type, and the injected process-lifecycle port/capability declaration types. Data only, no runtime import. **(TC-COORD-001; DM-1..DM-11; AC-F10-1/2)**
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
- [ ] 2.2 Implement the artifact-evidence stuck verdict: bounded digest-input fingerprint over the state event-log cursor, open coordinator-question count, and ready-to-merge count; `digest-consumed` requires a fingerprint advance **and** a new session turn; `merge`/`answer` are post-expectation records; advanced/stale/unknown totality; verified-empty store is `stale` zero; unreadable store is `unknown`; all-unknown or unreadable required store is `unevaluable`/`evidence-unevaluable`; positive sourced progress vetoes `stuck`; `progressing` is not persisted; no CPU field exists. **(TC-COORD-032/033/034; AC-F3-1/2/3; DEC-4)**
- [ ] 2.3 Implement the restart admission fold over the current epoch: contiguous ordinals from 1; below-bound admits exactly one; at/above-bound refuses; torn/gapped ordinal is `unevaluable`, never count 0. Implemented here; ordinal/record TCs land in Phase 3. **(AC-F5-2; DM-2)**
- [ ] 2.4 Implement wake evaluation: strict `isCoordinatorPickup` (rank 1, open, audience coordinator), persisted-vs-tick outcomes, dedupe by coordinator id + question id + `askedAt`, `answered-before-wake` when the question closes between ranking and wake, `no-pickup` for every non-qualifying head. Implemented here; full tick/record TCs land in Phase 6. **(AC-F7-1/3/4; DEC-9)**
- [ ] 2.5 Implement the escalation projection: the payload-only reserved-slot predicate as one pure data predicate and the bounded owner-question projection (coordinator id, epoch, count, bound, history, options); no state read, no renderer dependency. Implemented here; render/record TCs land in Phases 6–7. **(AC-F6-1; DEC-5)**
- [ ] 2.6 Implement the regime projection and deterministic observation renderers: `delivery.coordinator.v1` data and bounded ANSI-free human text (≤ 32 lines) for start/stop/tick/status. Implemented here; command TCs land in Phase 6. **(AC-F9-1; NFR-1/4)**
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

- [ ] 3.1 Create `packages/core/src/state/coordinator*.ts`: `coordinator.iteration`, `.restart`, `.stuck`, `.exhaustion`, `.wake`, `.fence` with kind/schema/required-field/vocabulary validation; append through the delivered fenced artifact boundary with post-append coverage; verified reads; torn/unknown/gapped classification. **(TC-COORD-083; AC-F10-3; EVT-1..7; DM-1..5, DM-11)**
- [ ] 3.2 Implement the restart ordinal fold per budget epoch: contiguous from 1; torn/gapped is `unevaluable`, never count 0; a replayed ordinal appends nothing; namespace is `coordinator/<coordinatorId>`, disjoint from lane and economics. **(TC-COORD-026/050/051/053; AC-F5-1/2/4; DEC-8)**
- [ ] 3.3 Implement the `coordinator.fence` carrier: `acquired`, `released`, `stale-takeover` with `holder`, `previousHolder`, `fenceAgeMs`, `recordedAt`; durable and status-readable; a torn fence never yields a fabricated holder. Supports the Phase-6 fence-record TC. **(AC-F8-1/3; EVT-7; DM-11)**
- [ ] 3.4 Implement the exhaustion receipt: one terminal receipt per `(coordinatorId, budgetEpochId)`, lands only after the escalation question, carries the count/history/question id/options/`terminal:true`, and is idempotent. Supports the Phase-6 escalation TCs. **(AC-F6-1/3; DM-4)**
- [ ] 3.5 Implement decision durability and mid-iteration artifact preservation: a fresh store handle over the same temp root reconstructs the decision, ordinal, closed-out phase/merge/answer artifacts, and does not re-execute them. Supports the Phase-6 recovery/durability TCs. **(AC-F2-4/5; NFR-7)**
- [ ] 3.6 Implement the fresh-budget epoch: `start --fresh-budget` opens a new epoch at 0 while the old epoch and escalation remain in history. Supports the Phase-6 fresh-budget TC. **(AC-F5-5)**
- [ ] 3.7 Add the recorded-decision tests over the now-durable records: `coordinator-decision-join/resume/spawn`, `coordinator-ordinals`; assert the decision + reason + session + context + ordinal + iteration are written before the effect, nothing is spawned/resumed on `join-live`, exactly one ordinal is consumed on `resume-context` and each recovery `spawn-fresh`, and none on `initial-start`/`clean-iteration-end`. **(TC-COORD-020/021/022/023/026)**
- [ ] 3.8 Add the persisted-stuck tests: `coordinator-stuck-verdict`, `coordinator-stuck-matrix`, `coordinator-stuck-torn`, `coordinator-expectation`, `coordinator-stuck-reason`; assert one `coordinator.stuck` record for `stuck`/`unevaluable`, the closed `reason` coupling, the 3×3×3 matrix, one active expectation per coordinator, and a torn/gapped store never read as zero/stale. **(TC-COORD-030/031/036/038/039)**
- [ ] 3.9 Add the remaining state tests: `coordinator-records`, `coordinator-restart-namespace`, `coordinator-restart-admit`, `coordinator-restart-durability`; extend `tests/structure/state-contract.test.ts` and `tests/fixtures/state/harness.ts`; add `tests/fixtures/coordinator/states.ts`. Fence, recovery, fresh-budget, and torn-status TCs are completed at the Phase-6 command surface. **(TC-COORD-050/051/053/083)**

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
  tests/structure/state-contract.test.ts
```

Expected: the lifecycle decision is recorded before the effect and consumes the declared ordinal; all six record kinds round-trip and validate; malformed records classify (`state.store.torn`/`state.store.unknown`) and are never served; permission denial is `state.permission.denied` exit 1; `STATE_SCHEMA_VERSION` is unchanged; lane/economics records are byte-unchanged.

**Exit criteria.** Records are additive and validated; ordinals are contiguous; recorded decisions and persisted stuck verdicts are durable; the fence and exhaustion receipts are durable; no migration or derived document exists. Command-level fence, recovery, fresh-budget, and torn-status proofs land at the Phase-6 gate.

---

## Phase 4 — Coordinator config branch

**Goal.** Add the five coordinator keys to the delivered config catalog/defaults/schema with declared domains; decisions read resolved values, never literals.

**Tasks**

- [ ] 4.1 Add `coordinator.stuck-window` (600000 ms, integer > 0), `coordinator.kill-grace` (20000 ms, integer > 0), `coordinator.restart-budget` (10, integer ≥ 0), `coordinator.resume-context-limit` (100000 tokens, integer > 0), and `coordinator.collection-interval` (30000 ms, integer > 0) to `catalog.ts`, `defaults.ts`, and `schema.ts` with provenance. **(TC-COORD-080; AC-F10-1; DEC-10; DM-6)**
- [ ] 4.2 Wire resolution into the lifecycle, stuck, admission, and wake decisions; no default or bound literal in decision code; no alias to `lane.restart-budget`, `lane.liveness-interval`, or `daemon.heartbeat-cycle`. **(TC-COORD-056/080; AC-F10-1; AC-F5-2/3)**
- [ ] 4.3 Add `coordinator-config` (absent/explicit/unknown/invalid/boundary), `coordinator-budget-config` (0/1/10, observed at evaluation), extend `tests/structure/config-contract.test.ts`, and add fixture roots. **(TC-COORD-056/080)**

**Verification**

```bash
bun test tests/behaviour/coordinator-config.test.ts \
  tests/behaviour/coordinator-budget-config.test.ts \
  tests/structure/config-contract.test.ts
bun run scripts/checks/ambient-globals.ts
```

Expected: defaults and domains exact; unknown key → `config.key.unknown`; wrong type/domain → `config.value.invalid`; budget 0 admits no restart and escalates; no decision-code literal; no cross-key aliasing.

**Exit criteria.** Five keys, five defaults, five domains; provenance recorded; policy is data; boundary values (0, 1 ms) behave; the coordinator interval is distinct from the daemon and lane intervals.

---

## Phase 5 — Injected process-lifecycle port and adapters

**Goal.** Implement spawn/attach, alive, kill-with-grace, and sourced progress beside the harness adapters with an injected child-process runner; keep the domain pure and the delivered harness session port unchanged.

**Tasks**

- [ ] 5.1 Create `packages/adapters/src/harness/process-lifecycle.ts`: resolve the recorded session/process-tree handle, alive probe, TERM → wait `kill-grace` → conditional KILL, closed `terminated`/`forced`/`failed`, sourced-progress facts, and capability declarations/gaps. The child-process runner is injected. No name/pattern kill and no shell interpolation. **(TC-COORD-040/041/042; AC-F4-1..3; NFR-10/14)**
- [ ] 5.2 Export from `packages/adapters/src/harness/index.ts`; no new package subpath, dependency, or boundary-rule change. Supports the Phase-8 full-surface boundary test and TC-COORD-085. **(TC-COORD-085; AC-F4-3)**
- [ ] 5.3 Enforce capability ownership: missing alive or kill-with-grace → `coordinator.process.capability-gap` exit 2 with zero kill calls and zero restart records; the other three owners (resume, spawn, progress) keep their distinct outcomes. **(TC-COORD-044; AC-F10-4; DEC-11)**
- [ ] 5.4 Add `coordinator-kill-grace`, `coordinator-kill-failed`, `coordinator-kill-target`, `coordinator-kill-fence`, `coordinator-capability-gap`, the structure `coordinator-kill-target` scan, `tests/boundaries`, and the recording fake `tests/fixtures/coordinator/process-port.ts` with a fake clock and TERM/KILL phase log. **(TC-COORD-040..044, 085)**

**Verification**

```bash
bun test tests/behaviour/coordinator-kill-*.test.ts \
  tests/behaviour/coordinator-capability-gap.test.ts \
  tests/structure/coordinator-kill-target.test.ts
bun test tests/boundaries
pnpm check:boundaries
```

Expected: TERM → grace → conditional KILL is exact; `terminated` and `forced` are distinguished; a failed kill is exit 2 and never success; the target is the recorded handle/tree only; no shell/network/privilege path; no kill without the fence.

**Exit criteria.** Kill is testable and safe; the fake port is non-vacuous (declared `failed` outcomes, phase log); capability gaps are classified; the harness session port is unchanged; adapter confinement holds.

---

## Phase 6 — Coordinator CLI family and edge composition

**Goal.** Compose the command family over injected state, config, process, blocker, clock, id, brand, and harness seams. The handler is pure (no stream writes, no exit literals); the edge is the only writer and the only exit projector.

**Tasks**

- [ ] 6.1 Create `packages/cli/src/commands/coordinator.ts`: `start [--foreground] [--fresh-budget]`, `stop`, `status [--live]`, `tick`; closed grammar; `delivery.coordinator.v1` data; deterministic bounded text renderer in `packages/cli/src/output/coordinator-text.ts`. **(TC-COORD-003/004; AC-F1-2; AC-F9-1)**
- [ ] 6.2 Compose in `packages/cli/src/edge.ts`: state dir + fence, config, fake-able process port, blocker verified read/append, injected clock, ids, brand, harness session facts; register exactly one `coordinator` family in `commands/index.ts`; no `daemon`, `dispatch`, or `supervise` command. **(TC-COORD-003/004)**
- [ ] 6.3 Fence semantics: `start` acquires and records the instance; a second start or contended tick → `coordinator.already-running` exit 2 with the holder named and no record; `stop` → graceful release with `released=true`, idempotent without a supervisor; stale-holder takeover with a `coordinator.fence` `stale-takeover` record; acquire/release/takeover each append exactly one validated record. **(TC-COORD-010/011/015/017; AC-F1-1/3; AC-F8-1/3)**
- [ ] 6.4 Lifecycle application: `join-live`/`resume-context`/`spawn-fresh`; killed-mid-iteration recovery without re-executing closed-out work; `--fresh-budget` only when stopped; `status` reports durable decision/restart/stuck/wake/escalation/fence and degrades `--live` honestly; `stuck-unevaluable` and torn/gapped budget return the delivered state identity at exit 2 with no kill or restart. **(TC-COORD-012/013/014/016/024/025/035/054/055; AC-F1-2; AC-F2-4/5; AC-F3-3; AC-F5-4/5; AC-F8-2; AC-F9-1; AC-F10-3)**
- [ ] 6.5 Escalation and wake integration: exactly one owner `decision-needed` question, terminal receipt after the question, publish failure exit 2, idempotent reuse; strict pickup wake with persisted `woken` only; `already-woken`/`answered-before-wake`/`delivery-failed`/`no-pickup` as tick results; retry without duplicate records. **(TC-COORD-052/060/061/062/065/070/071/072/073/074/075; AC-F5-3; AC-F6-1..3; AC-F7-1..6)**
- [ ] 6.6 Add the CLI tests: `coordinator-grammar`, `coordinator-envelope`, `coordinator-start`, `coordinator-stop`, `coordinator-tick`, `coordinator-status`, `coordinator-fence-records`, `coordinator-fence-stale`, `coordinator-decision-durability`, `coordinator-decision-recovery`, `coordinator-fresh-budget`, `coordinator-restart-exhausted`, `coordinator-restart-torn`, `coordinator-stuck-unevaluable`, `coordinator-escalation-publish/idempotent/failed/reuse`, `coordinator-wake-pickup/answered/dedupe/paths/failed/next`; extend `tests/checks/exit-code-literals.test.ts`; add fixtures `harness.ts` and `blockers.ts`. **(all Phase-6 TCs)**

**Verification**

```bash
bun test tests/behaviour/coordinator-grammar.test.ts \
  tests/behaviour/coordinator-envelope.test.ts \
  tests/checks/exit-code-literals.test.ts
bun test tests/behaviour/coordinator-start.test.ts \
  tests/behaviour/coordinator-stop.test.ts \
  tests/behaviour/coordinator-tick.test.ts \
  tests/behaviour/coordinator-status.test.ts \
  tests/behaviour/coordinator-fence-records.test.ts \
  tests/behaviour/coordinator-fence-stale.test.ts \
  tests/behaviour/coordinator-decision-durability.test.ts \
  tests/behaviour/coordinator-decision-recovery.test.ts \
  tests/behaviour/coordinator-fresh-budget.test.ts \
  tests/behaviour/coordinator-restart-torn.test.ts \
  tests/behaviour/coordinator-stuck-unevaluable.test.ts
bun test tests/behaviour/coordinator-restart-exhausted.test.ts \
  tests/behaviour/coordinator-escalation-*.test.ts \
  tests/behaviour/coordinator-wake-*.test.ts
```

Expected: exactly one bounded envelope and one `{0,1,2}` exit per outcome; fence acquisition/release/takeover each land one record; fence refusal and stale takeover exact; the command family is closed; the payload schema is `delivery.coordinator.v1`; `tick` is a one-shot cycle with no timer/daemon; recovery does not re-execute closed-out work; `unevaluable`/torn budget exits 2 with the state identity and no kill/restart; escalation and wake persistence rules hold.

**Exit criteria.** The command family matches Appendix G; every Appendix F outcome maps to one identity and one exit; no handler stream write or exit literal; the fence is the only gate to a kill or a cycle; fence-record history is durable; recovery preserves closed-out artifacts; `unevaluable`/torn state is fail-closed; wake and escalation behaviours are pinned.

---

## Phase 7 — Reserved owner-escalation slot and consumer docs

**Goal.** Add one bounded rendering rule to the delivered digest and brief: an open owner `decision-needed` coordinator question renders under a reserved slot inside the eight-question bound, selected from the payload alone.

**Tasks**

- [ ] 7.1 Add the payload-only reserved-slot predicate as one contracts datum: `type === "decision-needed"` AND `audience === "owner"` AND `lane === "coordinator"` AND `ref` matches `<coordinatorId>#<budgetEpochId>` with exactly one `#` and both sides non-empty. No coordinator-state read. **(TC-COORD-063; AC-F6-1; DEC-5)**
- [ ] 7.2 Update `packages/core/src/domain/status.ts`: keep at most seven other questions plus the reserved one; preserve ordering, omitted/truncated counts, section ids, and evidence states; the bound stays eight rendered. **(TC-COORD-063/064; AC-F6-1; NFR-4)**
- [ ] 7.3 Update `packages/core/src/domain/brief.ts`: mirror the same projection in `blocker-questions`; no new anchor, section, surface, or question type. **(TC-COORD-064; AC-F6-1; NFR-15)**
- [ ] 7.4 Regenerate the reserved-slot goldens only via the explicit scripts and diff field by field; a control golden without escalation stays byte-identical. **(TC-COORD-063/064; TC-COORD-089)**
- [ ] 7.5 Update `doc/spec/features/feature-status-digest.md`, `feature-brief.md`, and `feature-blockers.md` with the reserved-slot and enforcement-arm notes; keep the section read-only and add no read. **(TC-COORD-064/092)**
- [ ] 7.6 Add `coordinator-escalation-slot`, `coordinator-escalation-surface`, extend the status/brief goldens; include near-miss predicate controls and the dropped-slot / nine-rendered / widened-predicate mutants. **(TC-COORD-063/064)**

**Verification**

```bash
bun test tests/behaviour/coordinator-escalation-slot.test.ts \
  tests/behaviour/coordinator-escalation-surface.test.ts
bun test tests/golden/status-digest.test.ts tests/golden/brief.test.ts
bash scripts/.tests/test-doc-distribution.sh
```

Expected: the escalation renders at the cap; exactly eight questions (seven others plus it); the omitted count is truthful; near-miss payloads are not selected; zero coordinator-state reads; the only golden diff is the reserved-slot case; no new section/anchor/type.

**Exit criteria.** “Never silent” is true at the normal cap; the bound and ordering are unchanged; digest and brief agree; the consumer docs are reconciled; no coordinator state read was added to either renderer.

---

## Phase 8 — Integration behaviour, determinism, privacy, performance, and SC-M1-25

**Goal.** Prove the assembled surface over an in-process CLI, synthetic state dir, fake process port, fake clock, fake harness capabilities, and fake blocker ledger; pin the seed scenario end to end.

**Tasks**

- [ ] 8.1 `tests/behaviour/coordinator-scenario.test.ts` (SC-M1-25): start/fence/stop/status; join/resume/spawn and killed-mid-iteration artifact preservation; stuck permutations; kill outcomes; budget durability/exhaustion/escalation idempotency/reserved slot; wake outcomes and retry; config/state/error paths. **(TC-COORD-091; SC-M1-25; AC-F2-*, F3-*, F4-1, F5-2/3, F6-1, F7-1, F10-5)**
- [ ] 8.2 Tier boundaries, purity, adapter confinement, and brand neutrality across the now-complete coordinator surface; contracts are data-only; domain imports only contracts/siblings; process/OS logic exists only in the adapter seam; no harness-name branch outside adapters; three mutants (`node:fs` in contracts, `Date.now` in domain, OS-signal in domain) must fail. **(TC-COORD-002; AC-NFR-3)**
- [ ] 8.3 Determinism: two identical roots byte-identical `data` and text; ambient scan; fresh instance/reopened store; zero model calls; locale/timezone independent. **(TC-COORD-086; AC-NFR-1/3)**
- [ ] 8.4 Idempotency: a second identical tick appends no decision/restart/stuck/wake/exhaustion record and performs no destructive action; a changed fact still fires. **(TC-COORD-087; AC-NFR-1; NFR-6)**
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

- [ ] 9.1 `doc/planning/oss-tooling/cli-command-registry.md`: add the `coordinator` family row (four subcommands/flags, `delivery.coordinator.v1`, the M1-S18 seam) and update the `ceo-loop.sh` strangler row to name coordinator supervision as the delivered replacement. **(TC-COORD-092; AC-F8-2; DEC-2)**
- [ ] 9.2 `doc/planning/oss-tooling/milestones/m1/contracts.md` and `man-page.md`: coordinator command contract and usage lines. **(TC-COORD-092)**
- [ ] 9.3 `.changeset/gh-241-coordinator-supervision-minor.md`: lockstep minor over the publishables. **(TC-COORD-092; NFR-15)**

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

- [ ] 10.1 Reconcile `doc/spec/features/feature-coordinator-supervision.md` as the current-truth home; add the consumer/boundary notes to `feature-session-lifecycle-economics.md` (distinct budget) and `feature-harness-adapters.md` (additive process port and four-way capability ownership); re-check `feature-result-contract.md` and the Phase-7 docs; update `doc/00-index.md`. **(TC-COORD-090/092; AC-F8-2)**
- [ ] 10.2 Non-regression: status/brief goldens differ only in the reserved-slot case; blockers ranking, economics records, lane records, and `ceo-loop.sh` byte-unchanged; no other command envelope/exit changes; no daemon/dispatch/supervise surface. **(TC-COORD-089; AC-NFR-1; NFR-15)**
- [ ] 10.3 `ceo-loop.sh` function-map trace: context resume decision (AC-F2-*), stuck detection (AC-F3-*), kill with grace (AC-F4-*), restart budget (AC-F5-*), wake on question (AC-F7-*), owner escalation (AC-F6-*), supervisor regime (AC-F8-*), each with a **passing** TC at DoD. **(TC-COORD-090; AC-F10-5; Appendix A)**
- [ ] 10.4 Full gate battery: `pnpm check`; error-table sync; ambient globals; forbidden/privacy literals; boundaries; exports parity; doc distribution; commitlint; `git diff --check`. **(TC-COORD-089/090)**
- [ ] 10.5 Update this plan's completion acknowledgement and the AC/TC status table; leave the spec and test plan unedited (their status is owned by their authors); report per-phase evidence to `@pm`. **(TC-COORD-090/092)**

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

Expected: every gate green; 105/105 error rows; set 24 in both gate files; exports parity; doc distribution green; no forbidden/privacy literal; commitlint clean; the only status/brief diff is the reserved-slot case.

**Exit criteria.** All 43 ACs and all 66 TCs have a passing result or a signed-off manual result; the `ceo-loop.sh` map is traced; every absence claim has its three observations; the only permitted digest/brief diff is the reserved slot; the release and spec-reconciliation obligations are declared in scope.

---

## Risks and rollback

| Risk | Mitigation in this plan | Residual |
|---|---|---|
| A large working session is killed as stuck | Phase 2 proves positive sourced progress vetoes `stuck`; Phase 5 kill intent only after a `stuck` verdict; TC-033/037 | M |
| A torn store is read as count `0` or fabricated stale | Phase 3 classifies torn/gapped as `unevaluable`; Phase 2/3 matrix; TC-035/036/055 | L |
| The budget is cached, conflated, or reset by a restart | Phase 3 reopened-store durability; distinct namespace; TC-025/050/053/055 | L |
| Exhaustion is “escalated” but crowded out | Phase 7 reserved slot at the cap with seven others; TC-063/064 | L |
| A duplicate or thundering-herd wake | Phase 2 dedupe on coordinator+question+askedAt; Phase 6 persisted-`woken` only; TC-071/074 | L |
| A two-segment code fails the format gate | Phase 1 exact allowlist in both files; set 24; near-miss rejection; TC-081/082 | L |
| The status/brief goldens are regenerated wholesale | Phase 7 explicit regeneration + field-by-field diff + control golden; TC-064/089 | L |
| The fake process port makes the kill test vacuous | Phase 5 declared `failed`, phase log, AST shell/name scan, kill-only-under-fence counter; TC-041/042/043/085 | L |
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
| AC-F1-1 | 6 | TC-COORD-003, 010, 016 |
| AC-F1-2 | 6 | TC-COORD-003, 012 |
| AC-F1-3 | 6 | TC-COORD-003, 011 |
| AC-F2-1 | 3, 8 | TC-COORD-020, 026, 091 |
| AC-F2-2 | 3, 8 | TC-COORD-021, 026, 091 |
| AC-F2-3 | 3, 8 | TC-COORD-022, 026, 091 |
| AC-F2-4 | 6 | TC-COORD-024 |
| AC-F2-5 | 6 | TC-COORD-025 |
| AC-F2-6 | 3, 6 | TC-COORD-012, 023, 026 |
| AC-F3-1 | 2, 3, 8 | TC-COORD-030, 031, 032, 038, 039, 091 |
| AC-F3-2 | 2 | TC-COORD-033 |
| AC-F3-3 | 2, 3, 6 | TC-COORD-031, 034, 035, 036, 039 |
| AC-F3-4 | 2 | TC-COORD-037 |
| AC-F4-1 | 5, 8 | TC-COORD-040, 091 |
| AC-F4-2 | 5 | TC-COORD-041 |
| AC-F4-3 | 5 | TC-COORD-042, 043, 085 |
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
| AC-F8-1 | 5, 6 | TC-COORD-010, 017, 043 |
| AC-F8-2 | 6, 9 | TC-COORD-013, 014, 092 |
| AC-F8-3 | 6 | TC-COORD-015, 017 |
| AC-F9-1 | 6 | TC-COORD-003, 012, 013, 017 |
| AC-F10-1 | 1, 4 | TC-COORD-001, 056, 080 |
| AC-F10-2 | 1, 6, 9 | TC-COORD-004, 081, 082, 092 |
| AC-F10-3 | 3, 6 | TC-COORD-035, 036, 055, 083 |
| AC-F10-4 | 5 | TC-COORD-044 |
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
| TC-COORD-020 | 3 | `tests/behaviour/coordinator-decision-join.test.ts` |
| TC-COORD-021 | 3 | `tests/behaviour/coordinator-decision-resume.test.ts` |
| TC-COORD-022 | 3 | `tests/behaviour/coordinator-decision-spawn.test.ts` |
| TC-COORD-023 | 3 | `tests/behaviour/coordinator-decision-spawn.test.ts` |
| TC-COORD-024 | 6 | `tests/behaviour/coordinator-decision-recovery.test.ts` |
| TC-COORD-025 | 6 | `tests/behaviour/coordinator-decision-durability.test.ts` |
| TC-COORD-026 | 3 | `tests/behaviour/coordinator-ordinals.test.ts` |
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
| TC-COORD-040 | 5 | `tests/behaviour/coordinator-kill-grace.test.ts` |
| TC-COORD-041 | 5 | `tests/behaviour/coordinator-kill-failed.test.ts` |
| TC-COORD-042 | 5 | `tests/behaviour/coordinator-kill-target.test.ts; tests/structure/coordinator-kill-target.test.ts` |
| TC-COORD-043 | 5 | `tests/behaviour/coordinator-kill-fence.test.ts` |
| TC-COORD-044 | 5 | `tests/behaviour/coordinator-capability-gap.test.ts` |
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
| TC-COORD-092 | 9 | `manual review; bash scripts/.tests/test-doc-distribution.sh` |


## SC-M1-25 reconciliation

| Seed clause | Phase | TC(s) | Plan obligation |
|---|---:|---|---|
| Given: coordinator session mid-iteration | 3, 6 | 020, 024 | A live session is `join-live`; a killed-mid-iteration session recovers per the recorded decision with closed-out artifacts untouched. |
| Given: context pressure rises | 3 | 021, 022 | `resume-context` below the limit; `spawn-fresh context-pressure` at/above it. |
| Given: coordinator-audience question ranked top | 6 | 070, 073 | Strict `isCoordinatorPickup`; live/resume/spawn wake. |
| When: supervision evaluates | 3, 6 | 012, 026 | One bounded `tick`; the decision persists before the action. |
| Then: join-or-resume decision recorded and applied | 3, 6 | 020, 021, 024, 025, 026 | Decision + reason + session + context + ordinal + iteration recorded; durable across restart. |
| Then: no digest consumed, no merge, no answer within the window | 2, 3 | 030, 031, 032 | Three classes; fingerprint advance **and** a new session turn for `digest-consumed`. |
| Then: detected by artifact evidence | 2, 3 | 030, 031, 034, 037 | No CPU; unknown disclosed; positive progress vetoes. |
| Then: killed with grace | 5 | 040, 042 | TERM → grace → conditional KILL; recorded handle only. |
| Then: restarted within budget | 3, 6 | 051, 052, 054 | Below-bound appends the next ordinal; at/above refuses and escalates; fresh budget opens a new epoch. |
| Then: the typed question wakes within one collection cycle | 6 | 070, 073 | The next tick after the question qualifies issues the wake; no scheduler in v1 (GAP-T2). |
| Assert: restart events classified | 3, 6 | 026, 039, 051, 052 | Closed restart reasons and the distinct closed stuck reason. |
| Assert: exhaustion escalates to the owner brief, never silent | 6, 7 | 060, 062, 063, 064 | One owner question; publish failure exit 2; reserved slot at the cap; digest/brief agree. |
| Assert: the ceo-loop function map is covered | 8, 10 | 090, 091 | Five functions plus owner escalation and regime, each with a passing trace. |

## Spec / test-plan issues found

1. **No blocking inconsistency.** The spec v1.1 and test plan v1.1 agree on all 43 ACs, 66 TCs, the exact two-code allowlist (set 22→24), the 99→105 table, the payload-only reserved-slot predicate, the persisted-`woken`-only rule, the closed `coordinator.stuck.reason`, and the `coordinator.fence` record.
2. **One delivery-bound path divergence (non-blocking).** The test plan names `packages/adapters/src/process/**` as *expected* (TC-COORD-002/044 and §4). This plan places the port at `packages/adapters/src/harness/process-lifecycle.ts` and exports it from the existing harness subpath. GAP-T5 explicitly makes module paths delivery-bound, and the spec says “beside the harness adapters”; the choice avoids a new package subpath, workspaceImports entry, and dependency-cruiser rule. Tests must resolve the seam through the harness export; if delivery instead creates a `process` subpath, the test path is a mechanical adjustment that does not reshape any pinned identity, exit, vocabulary, or AC trace.
3. **Terminology corner.** The test plan §8.3 OQ-T7 says “Phase 4 must map TCs onto phases”; that refers to the delivery process's planning step, not this plan's Phase 4 (config). This plan resolves OQ-T7 by mapping all 66 TCs across Phases 1–10 without reshaping.
4. **No spec edit required.** The test plan's `links.implementation_plan` is still `null`; this plan does not edit the test plan. `@pm`/`@doc-syncer` may update the link during the normal artifact flow.

## Files read

- `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-spec.md` (v1.1, full)
- `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-test-plan.md` (v1.1: §1–§5.1, selected §5.2 scenarios, §7–§10)
- `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-pm-notes.yaml` (context only, not read as truth)
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
- **Coverage check:** 66/66 test-plan TCs appear in both the YAML header map and the complete MD table; phase assignments agree exactly; 43/43 ACs appear in the AC→phase→TC table.
- **Artifact precedence:** `chg-GH-241-plan.yaml` is authoritative; this MD is the execution companion. When both exist, the YAML wins and the verdict discloses the YAML artifact.
